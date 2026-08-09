/**
 * dashboard.js – ScribeClone Guide Viewer
 *
 * Loads captured steps from chrome.storage.local and renders them as
 * a chronological, screenshot-rich step guide.
 * Provides "Export PDF" via CSS @media print + window.print().
 */

(function () {
  'use strict';

  const STEPS_KEY = 'scribeclone_steps';

  // ─── DOM refs ──────────────────────────────────────────────────────────────

  const stepsList    = document.getElementById('steps-list');
  const guideMeta    = document.getElementById('guide-meta');
  const guideSubtitle = document.getElementById('guide-subtitle');
  const titleInput   = document.getElementById('title-input');
  const printTitle   = document.getElementById('print-title');
  const exportBtn    = document.getElementById('export-pdf-btn');
  const clearBtn     = document.getElementById('clear-btn');
  const newRecBtn    = document.getElementById('new-recording-btn');

  // ─── Helpers ──────────────────────────────────────────────────────────────

  function formatTime(ts) {
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }

  function formatDate(ts) {
    return new Date(ts).toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  }

  function stripOrigin(url) {
    try {
      const u = new URL(url);
      return u.hostname + u.pathname.slice(0, 40) + (u.pathname.length > 40 ? '…' : '');
    } catch {
      return url ? url.slice(0, 50) : '';
    }
  }

  function typeIcon(type) {
    return { click: '🖱️', input: '⌨️', navigation: '🌐' }[type] || '▶️';
  }

  function typeClass(type) {
    return { navigation: 'nav-type', input: 'input-type' }[type] || '';
  }

  // ─── Render steps ─────────────────────────────────────────────────────────

  function renderEmpty() {
    stepsList.innerHTML = `
      <div class="empty-state">
        <div class="icon">📭</div>
        <h3>No steps recorded yet</h3>
        <p>Click <strong>New Recording</strong>, share your screen, and start working.<br>
           Every click and input will become a step in your guide.</p>
      </div>`;
    guideMeta.textContent = 'No steps captured';
    guideSubtitle.textContent = 'Start a recording to generate a guide.';
  }

  function renderSteps(steps) {
    if (!steps || steps.length === 0) { renderEmpty(); return; }

    const firstTs = steps[0].timestamp;
    const lastTs  = steps[steps.length - 1].timestamp;
    const duration = Math.round((lastTs - firstTs) / 1000);
    const mins = Math.floor(duration / 60);
    const secs = duration % 60;

    guideMeta.textContent = `${steps.length} step${steps.length !== 1 ? 's' : ''} · ${mins > 0 ? `${mins}m ` : ''}${secs}s · ${formatDate(firstTs)}`;
    guideSubtitle.textContent = `Recorded on ${formatDate(firstTs)} at ${formatTime(firstTs)}`;
    printTitle.textContent = titleInput.value || 'Untitled Guide';

    const fragment = document.createDocumentFragment();

    steps.forEach((step, i) => {
      const card = document.createElement('div');
      card.className = 'step-card';

      // Step number bubble
      const num = document.createElement('div');
      num.className = `step-number ${typeClass(step.type)}`;
      num.textContent = i + 1;

      // Card body
      const body = document.createElement('div');
      body.className = 'step-body';

      // Content row (icon + description + meta)
      const urlDisplay = step.url ? `<a href="${encodeURI(step.url)}" target="_blank" rel="noopener">${stripOrigin(step.url)}</a>` : '';
      body.innerHTML = `
        <div class="step-content">
          <span class="step-icon">${typeIcon(step.type)}</span>
          <div class="step-info">
            <div class="step-description">${escapeHtml(step.description || 'Action')}</div>
            <div class="step-meta">
              <span>${formatTime(step.timestamp)}</span>
              ${urlDisplay}
            </div>
          </div>
        </div>`;

      // Screenshot
      if (step.screenshot) {
        const shotDiv = document.createElement('div');
        shotDiv.className = 'step-screenshot';
        const img = document.createElement('img');
        img.src = step.screenshot;
        img.alt = `Screenshot for step ${i + 1}`;
        img.loading = 'lazy';
        // Prevent broken image from breaking layout
        img.onerror = () => { shotDiv.remove(); };
        shotDiv.appendChild(img);
        body.appendChild(shotDiv);
      } else {
        const noShot = document.createElement('div');
        noShot.className = 'no-screenshot';
        noShot.textContent = 'No screenshot available for this step.';
        body.appendChild(noShot);
      }

      card.appendChild(num);
      card.appendChild(body);
      fragment.appendChild(card);
    });

    stepsList.innerHTML = '';
    stepsList.appendChild(fragment);
  }

  // ─── Escape HTML to prevent XSS from captured text ────────────────────────

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g,  '&amp;')
      .replace(/</g,  '&lt;')
      .replace(/>/g,  '&gt;')
      .replace(/"/g,  '&quot;')
      .replace(/'/g,  '&#39;');
  }

  // ─── Load from storage ────────────────────────────────────────────────────

  async function loadAndRender() {
    try {
      const result = await chrome.storage.local.get(STEPS_KEY);
      const steps = result[STEPS_KEY] || [];
      renderSteps(steps);
    } catch (err) {
      stepsList.innerHTML = `<div class="empty-state"><div class="icon">⚠️</div><h3>Failed to load guide</h3><p>${escapeHtml(err.message)}</p></div>`;
    }
  }

  // ─── Export PDF ───────────────────────────────────────────────────────────

  exportBtn.addEventListener('click', () => {
    // Sync print title with current input value before printing
    printTitle.textContent = titleInput.value || 'Untitled Guide';

    // Brief delay to let DOM update, then print
    setTimeout(() => window.print(), 100);
  });

  // ─── Editable title syncs to print title ─────────────────────────────────

  titleInput.addEventListener('input', () => {
    printTitle.textContent = titleInput.value || 'Untitled Guide';
  });

  // ─── Clear guide ──────────────────────────────────────────────────────────

  clearBtn.addEventListener('click', async () => {
    const confirmed = window.confirm(
      'Clear all captured steps? This cannot be undone.'
    );
    if (!confirmed) return;
    await chrome.storage.local.remove(STEPS_KEY);
    renderEmpty();
  });

  // ─── New recording ────────────────────────────────────────────────────────

  newRecBtn.addEventListener('click', () => {
    // Open the extension popup programmatically isn't possible from a tab,
    // so guide the user to click the extension icon instead.
    alert('Click the ScribeClone icon in your Chrome toolbar to start a new recording.');
  });

  // ─── Boot ─────────────────────────────────────────────────────────────────

  loadAndRender();

  // Auto-refresh if this tab is open while recording is still happening
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes[STEPS_KEY]) {
      loadAndRender();
    }
  });

})();
