/**
 * popup.js - Extension popup controller
 */

(function () {
  'use strict';

  const startBtn    = document.getElementById('start-btn');
  const stopBtn     = document.getElementById('stop-btn');
  const viewBtn     = document.getElementById('view-btn');
  const statusPill  = document.getElementById('status-pill');
  const statusText  = document.getElementById('status-text');
  const stepCounter = document.getElementById('step-counter');
  const stepCount   = document.getElementById('step-count');
  const errorMsg    = document.getElementById('error-msg');
  const tipText     = document.getElementById('tip-text');

  // --- Helpers ---------------------------------------------------------------

  function showError(msg) {
    errorMsg.textContent = msg;
    errorMsg.style.display = 'block';
  }
  function hideError() {
    errorMsg.style.display = 'none';
  }

  function setRecordingUI(recording) {
    if (recording) {
      statusPill.className = 'status-pill recording';
      statusText.textContent = 'Recording...';
      startBtn.disabled = true;
      stopBtn.disabled  = false;
      stepCounter.style.display = 'flex';
      tipText.textContent = 'Switch to any app and perform actions. Click Stop when done.';
    } else {
      statusPill.className = 'status-pill';
      statusText.textContent = 'Ready to record';
      startBtn.disabled = false;
      stopBtn.disabled  = true;
      stepCounter.style.display = 'none';
      tipText.textContent = 'Click Start, then share your screen to begin capturing steps.';
    }
  }

  async function refreshStepCount() {
    const result = await chrome.storage.local.get('stepsnap_steps');
    const steps = result.stepsnap_steps || [];
    stepCount.textContent = steps.length;
  }

  async function checkForExistingGuide() {
    const result = await chrome.storage.local.get('stepsnap_steps');
    const steps = result.stepsnap_steps || [];
    viewBtn.style.display = steps.length > 0 ? 'block' : 'none';
  }

  // --- Init from background state --------------------------------------------

  async function init() {
    try {
      const status = await chrome.runtime.sendMessage({ action: 'getStatus' });
      setRecordingUI(status.isRecording);
      if (status.isRecording) {
        refreshStepCount();
        startStepCountPoller();
      }
    } catch (err) {
      setRecordingUI(false);
    }
    await checkForExistingGuide();
  }

  // --- Start recording -------------------------------------------------------

  startBtn.addEventListener('click', async () => {
    hideError();
    startBtn.disabled = true;
    statusText.textContent = 'Starting...';

    try {
      // KEY FIX: inject content.js into the active tab RIGHT NOW.
      // The popup has activeTab permission because the user just clicked the
      // extension icon - this is the only moment we can inject without
      // needing broad host_permissions that cause Chrome's access bars.
      const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (activeTab && activeTab.url && activeTab.url.startsWith('http')) {
        try {
          await chrome.scripting.executeScript({
            target: { tabId: activeTab.id },
            files: ['content.js'],
          });
          console.log('[SC-popup] Injected content.js into tab', activeTab.id, activeTab.url);
        } catch (injectErr) {
          // Non-fatal: manifest injection may have already done this
          console.warn('[SC-popup] Inject warning:', injectErr.message);
        }
      }

      // Tell background to open the capture tab and mark recording as started
      const result = await chrome.runtime.sendMessage({ action: 'startRecording' });
      if (result && result.success) {
        setRecordingUI(true);
        startStepCountPoller();
      } else {
        showError((result && result.error) || 'Could not start recording.');
        setRecordingUI(false);
      }
    } catch (err) {
      console.error('[SC-popup] Error:', err);
      showError('Failed to start. Try reloading the extension.');
      setRecordingUI(false);
    }
  });

  // --- Stop recording --------------------------------------------------------

  stopBtn.addEventListener('click', async () => {
    hideError();
    stopBtn.disabled = true;
    statusText.textContent = 'Generating guide...';

    try {
      await chrome.runtime.sendMessage({ action: 'stopRecording' });
      setRecordingUI(false);
      stopStepCountPoller();
      window.close();
    } catch (err) {
      showError('Could not stop recording.');
      stopBtn.disabled = false;
    }
  });

  // --- View last guide -------------------------------------------------------

  viewBtn.addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('dashboard.html') });
    window.close();
  });

  // --- Step count poller -----------------------------------------------------

  let poller = null;

  function startStepCountPoller() {
    if (poller) return;
    poller = setInterval(refreshStepCount, 1500);
  }

  function stopStepCountPoller() {
    if (poller) { clearInterval(poller); poller = null; }
  }

  // --- Boot ------------------------------------------------------------------

  init();

})();
