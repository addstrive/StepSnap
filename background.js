/**
 * background.js – ScribeClone Service Worker (MV3)
 *
 * Key design choices:
 *  - isRecording is ALWAYS read from chrome.storage.local, never cached in memory.
 *    This survives MV3 service-worker idle restarts with zero race conditions.
 *  - Content scripts are injected via chrome.tabs.onUpdated (no host_permissions
 *    needed) — every tab that finishes loading while recording is active gets
 *    content.js automatically via activeTab + scripting on navigation.
 *  - The capture tab (getDisplayMedia) lives as a regular tab so it can hold
 *    a MediaStream across service-worker restarts.
 */

const STATE_KEY = 'scribeclone_state';
const STEPS_KEY = 'scribeclone_steps';

// ─── Storage helpers (source of truth — no in-memory cache) ──────────────────

async function getState() {
  const r = await chrome.storage.local.get(STATE_KEY);
  return r[STATE_KEY] || { isRecording: false, captureTabId: null };
}

async function setState(patch) {
  const current = await getState();
  await chrome.storage.local.set({ [STATE_KEY]: { ...current, ...patch } });
}

async function getSteps() {
  const r = await chrome.storage.local.get(STEPS_KEY);
  return r[STEPS_KEY] || [];
}

async function saveStep(step) {
  const steps = await getSteps();
  steps.push(step);
  await chrome.storage.local.set({ [STEPS_KEY]: steps });
}

async function clearSteps() {
  await chrome.storage.local.remove(STEPS_KEY);
}

// ─── Screenshot helper ────────────────────────────────────────────────────────

function requestScreenshot(captureTabId) {
  return new Promise((resolve) => {
    if (!captureTabId) return resolve(null);
    const timer = setTimeout(() => resolve(null), 4000);
    chrome.tabs.sendMessage(captureTabId, { action: 'takeScreenshot' }, (res) => {
      clearTimeout(timer);
      if (chrome.runtime.lastError) return resolve(null);
      resolve(res?.dataURL || null);
    });
  });
}

// ─── Inject content script into a single tab (best-effort) ───────────────────

async function injectContentScript(tabId) {
  try {
    await chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] });
    console.log('[SC] Injected content.js → tab', tabId);
  } catch (e) {
    console.warn('[SC] Inject skipped tab', tabId, '—', e.message);
  }
}

// ─── Recording lifecycle ──────────────────────────────────────────────────────

async function startRecording() {
  const state = await getState();
  if (state.isRecording) return { success: false, error: 'Already recording.' };

  await clearSteps();
  console.log('[SC] startRecording — opening capture tab');

  const tab = await chrome.tabs.create({
    url: chrome.runtime.getURL('capture.html'),
    active: true,
  });

  await setState({ isRecording: true, captureTabId: tab.id });
  console.log('[SC] Recording started, captureTabId:', tab.id);

  // Inject content.js into every currently-open http/https tab so the user
  // can click on any tab without needing to reload it first.
  const allTabs = await chrome.tabs.query({ url: ['http://*/*', 'https://*/*'] });
  await Promise.all(
    allTabs
      .filter(t => t.id !== tab.id)
      .map(t => injectContentScript(t.id))
  );
  console.log('[SC] Injected content.js into', allTabs.length, 'existing tabs');

  return { success: true };
}

async function stopRecording() {
  const state = await getState();
  if (!state.isRecording) return { success: false, error: 'Not recording.' };

  if (state.captureTabId) {
    try { chrome.tabs.sendMessage(state.captureTabId, { action: 'stopCapture' }); } catch (_) {}
    try { await chrome.tabs.remove(state.captureTabId); } catch (_) {}
  }

  await setState({ isRecording: false, captureTabId: null });
  chrome.tabs.create({ url: chrome.runtime.getURL('dashboard.html') });
  console.log('[SC] Recording stopped');
  return { success: true };
}

// ─── Handle a user action ─────────────────────────────────────────────────────

async function handleUserAction(event) {
  const state = await getState();
  console.log('[SC] userAction — isRecording:', state.isRecording, '| desc:', event.description);

  if (!state.isRecording) {
    console.warn('[SC] Dropped — not recording');
    return;
  }

  const screenshot = await requestScreenshot(state.captureTabId);
  const step = {
    id:          Date.now(),
    timestamp:   event.timestamp || Date.now(),
    type:        event.type,
    description: event.description,
    url:         event.url,
    pageTitle:   event.pageTitle,
    screenshot,
  };

  await saveStep(step);
  console.log('[SC] Step saved ✓  total:', (await getSteps()).length);
}

// ─── Message router ───────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    switch (message.action) {

      case 'startRecording':
        sendResponse(await startRecording());
        break;

      case 'stopRecording':
        sendResponse(await stopRecording());
        break;

      case 'userAction':
        // Await keeps the service worker alive for the full screenshot round-trip.
        // Fire-and-forget allowed Chrome to idle-kill the SW before saveStep ran.
        await handleUserAction(message);
        sendResponse({ received: true });
        break;

      case 'getStatus': {
        const s = await getState();
        sendResponse({ isRecording: s.isRecording, captureTabId: s.captureTabId });
        break;
      }

      case 'captureReady':
        console.log('[SC] Capture tab ready — stream active');
        sendResponse({ ok: true });
        break;

      case 'streamEnded':
        console.log('[SC] Stream ended by user');
        await stopRecording();
        sendResponse({ ok: true });
        break;

      default:
        sendResponse({ error: 'Unknown action: ' + message.action });
    }
  })();
  return true; // keep port open for async sendResponse
});

// ─── Inject content.js whenever a tab finishes loading ───────────────────────

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status !== 'complete') return;
  if (!tab.url?.startsWith('http')) return;

  const state = await getState();
  if (!state.isRecording) return;
  if (tabId === state.captureTabId) return;

  await injectContentScript(tabId);
});

// ─── Inject when the user switches to a tab mid-recording ────────────────────
// host_permissions lets this succeed for any tab, not just the popup's activeTab.

chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  const state = await getState();
  if (!state.isRecording) return;
  if (tabId === state.captureTabId) return;

  try {
    const tab = await chrome.tabs.get(tabId);
    if (!tab.url?.startsWith('http')) return;
    await injectContentScript(tabId);
  } catch (_) {}
});

// ─── Clean up if capture tab is closed externally ────────────────────────────

chrome.tabs.onRemoved.addListener(async (tabId) => {
  const state = await getState();
  if (tabId === state.captureTabId && state.isRecording) {
    console.log('[SC] Capture tab closed — stopping recording');
    await setState({ isRecording: false, captureTabId: null });
    chrome.tabs.create({ url: chrome.runtime.getURL('dashboard.html') });
  }
});
