/**
 * content.js – StepSnap page-level event recorder
 *
 * Injected into every page. Listens for:
 *  - click:  any user click (with meaningful element description)
 *  - input / change: text / select / checkbox changes
 *  - navigation cues (popstate, hashchange)
 *
 * Events are sent to background.js which pairs them with a screenshot.
 */

(function () {
  'use strict';

  // Guard: don't inject twice
  if (window.__stepsnapInjected) {
    console.log('[SS-content] already injected, skipping');
    return;
  }
  window.__stepsnapInjected = true;

  // ─── Recording gate ────────────────────────────────────────────────────────
  // Nothing is passed to the extension unless a recording is running.
  // The flag mirrors chrome.storage.local, so it stays correct across tabs.

  const STATE_KEY = 'stepsnap_state';
  const PREFS_KEY = 'stepsnap_prefs';
  let recording  = false;
  let hideTyping = false;

  chrome.storage.local.get([STATE_KEY, PREFS_KEY], (r) => {
    recording  = !!(r[STATE_KEY] && r[STATE_KEY].isRecording);
    hideTyping = !!(r[PREFS_KEY] && r[PREFS_KEY].hideTyping);
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    if (changes[STATE_KEY]) {
      const v = changes[STATE_KEY].newValue;
      recording = !!(v && v.isRecording);
    }
    if (changes[PREFS_KEY]) {
      const v = changes[PREFS_KEY].newValue;
      hideTyping = !!(v && v.hideTyping);
    }
  });

  // ─── Helpers ───────────────────────────────────────────────────────────────

  /** Extract a human-readable label for a DOM element */
  function describeElement(el) {
    if (!el) return 'unknown element';

    // Prefer explicit labels
    const ariaLabel = el.getAttribute('aria-label');
    if (ariaLabel) return ariaLabel.trim();

    // <label> associated via for= or wrapping
    if (el.id) {
      const lbl = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
      if (lbl) return lbl.textContent.trim();
    }
    const parentLabel = el.closest('label');
    if (parentLabel) return parentLabel.textContent.trim().slice(0, 80);

    // Visible text content (buttons, links, etc.)
    const text = (el.textContent || el.innerText || '').trim().replace(/\s+/g, ' ');
    if (text && text.length > 0 && text.length <= 80) return text;

    // Form-specific attributes
    const placeholder = el.getAttribute('placeholder');
    if (placeholder) return placeholder.trim();

    const title = el.getAttribute('title');
    if (title) return title.trim();

    const name = el.getAttribute('name');
    if (name) return name.trim();

    // Fallback: tag + type/role
    const tag  = el.tagName.toLowerCase();
    const type = el.getAttribute('type') || '';
    const role = el.getAttribute('role') || '';
    return [tag, type && `[type="${type}"]`, role && `[role="${role}"]`]
      .filter(Boolean).join('');
  }

  /** Get a CSS-selector-like breadcrumb (for context) */
  function selectorOf(el) {
    if (!el || el === document.body) return '';
    const parts = [];
    let node = el;
    while (node && node !== document.body && parts.length < 4) {
      let part = node.tagName.toLowerCase();
      if (node.id) { part += `#${node.id}`; parts.unshift(part); break; }
      if (node.className) {
        const cls = [...node.classList].slice(0, 2).join('.');
        if (cls) part += `.${cls}`;
      }
      parts.unshift(part);
      node = node.parentElement;
    }
    return parts.join(' > ');
  }

  /** Send an action to the background service worker */
  function sendAction(type, description, extra = {}) {
    if (!recording) return; // not recording: the event never leaves the page
    // Use callback form (not Promise) — avoids "message port closed" errors
    // that silently drop messages when the SW is waking from idle.
    chrome.runtime.sendMessage(
      {
        action:    'userAction',
        type,
        description,
        url:       window.location.href,
        pageTitle: document.title,
        timestamp: Date.now(),
        ...extra
      },
      () => { void chrome.runtime.lastError; } // suppress unchecked error
    );
  }

  // ─── Debounce utility ──────────────────────────────────────────────────────

  function debounce(fn, ms) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), ms);
    };
  }

  // ─── Click handler ─────────────────────────────────────────────────────────
  // sendAction() drops events unless a recording is running (see Recording gate).

  document.addEventListener('click', (e) => {
    const el  = e.target.closest('a, button, input, select, [role="button"], [role="link"], [role="option"], [role="menuitem"]') || e.target;
    const desc = describeElement(el);
    const tag  = el.tagName.toLowerCase();

    let actionVerb = 'Clicked';
    if (tag === 'a')      actionVerb = 'Clicked link';
    if (tag === 'button') actionVerb = 'Clicked button';
    if (tag === 'input' && (el.type === 'checkbox' || el.type === 'radio')) {
      actionVerb = el.checked ? 'Checked' : 'Unchecked';
    }
    if (tag === 'input' && el.type === 'submit') actionVerb = 'Submitted';
    if (el.getAttribute('role') === 'button')    actionVerb = 'Clicked button';

    sendAction('click', `${actionVerb}: "${desc}"`, {
      selector: selectorOf(el),
      href: el.href || null
    });
  }, true); // capture phase for reliability

  // ─── Input / change handler (debounced) ────────────────────────────────────

  const handleInputChange = debounce((e) => {
    const el    = e.target;
    const tag   = el.tagName.toLowerCase();
    const type  = (el.type || '').toLowerCase();
    const label = describeElement(el);

    let description = '';

    if (tag === 'select') {
      const selectedText = el.options[el.selectedIndex]?.text || el.value;
      description = `Selected "${selectedText}" from "${label}"`;
    } else if (type === 'checkbox' || type === 'radio') {
      return; // handled by click listener
    } else if (tag === 'input' || tag === 'textarea') {
      if (type === 'password') {
        description = `Typed in password field: "${label}"`;
      } else {
        if (hideTyping) {
          description = `Typed in "${label}"`;
        } else {
          const val = (el.value || '').trim().slice(0, 60);
          description = `Typed "${val}" in "${label}"`;
        }
      }
    } else {
      description = `Changed "${label}"`;
    }

    sendAction('input', description, { selector: selectorOf(el) });
  }, 800);

  document.addEventListener('input',  handleInputChange, true);
  document.addEventListener('change', handleInputChange, true);

  // ─── Navigation / URL changes ──────────────────────────────────────────────

  function onNavigation() {
    sendAction('navigation', `Navigated to: ${document.title || window.location.pathname}`);
  }

  window.addEventListener('popstate',   onNavigation);
  window.addEventListener('hashchange', onNavigation);

  // Fire once on initial page load
  window.addEventListener('load', () => {
    sendAction('navigation', `Page loaded: ${document.title || window.location.href}`);
  });

})();
