/**
 * capture.js – Screen capture page logic
 *
 * This page lives in its own tab so it can call getDisplayMedia (which
 * requires both a user gesture AND a visible, active page in MV3).
 *
 * Flow:
 *  1. User clicks "Share My Screen" → getDisplayMedia prompt appears
 *  2. On success, notify background ('captureReady')
 *  3. Listen for 'takeScreenshot' messages → draw video frame to canvas → send back dataURL
 *  4. On stream end (native stop-sharing banner) → notify background ('streamEnded')
 */

(function () {
  'use strict';

  const video     = document.getElementById('preview');
  const startBtn  = document.getElementById('start-btn');
  const dot       = document.getElementById('dot');
  const statusText = document.getElementById('status-text');
  const subtitle  = document.getElementById('subtitle');
  const errorMsg  = document.getElementById('error-msg');

  // Offscreen canvas reused for all snapshots
  const canvas = document.createElement('canvas');
  const ctx    = canvas.getContext('2d');

  let stream   = null;   // MediaStream from getDisplayMedia
  let isActive = false;  // Stream is live

  // ─── UI helpers ─────────────────────────────────────────────────────────────

  function setStatus(text, active = false) {
    dot.className = `status-dot${active ? ' active' : ''}`;
    statusText.innerHTML = `<span class="status-dot${active ? ' active' : ''}" id="dot"></span>${text}`;
  }

  function showError(msg) {
    errorMsg.textContent = msg;
    errorMsg.style.display = 'block';
  }

  function hideError() {
    errorMsg.style.display = 'none';
  }

  // ─── Start capture ──────────────────────────────────────────────────────────

  async function startCapture() {
    hideError();
    startBtn.disabled = true;
    setStatus('Requesting screen access…');

    try {
      stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          frameRate:    { ideal: 5, max: 10 },   // Low FPS – we only snapshot on demand
          displaySurface: 'monitor'               // Prefer full-monitor selection
        },
        audio: false
      });
    } catch (err) {
      startBtn.disabled = false;
      setStatus('Permission denied');
      if (err.name === 'NotAllowedError') {
        showError('Screen sharing was cancelled or denied. Please try again.');
      } else {
        showError(`Error: ${err.message}`);
      }
      return;
    }

    // Attach stream to hidden video element for frame capture
    video.srcObject = stream;
    await video.play();

    isActive = true;
    setStatus('Recording…', true);
    subtitle.textContent = 'Your screen is being monitored. Switch to any app and start working. ScribeClone will capture each step automatically.';
    startBtn.style.display = 'none';

    // Tell background the stream is live
    chrome.runtime.sendMessage({ action: 'captureReady' });

    // Handle native "Stop sharing" banner click or stream ending
    stream.getVideoTracks()[0].addEventListener('ended', onStreamEnded);
  }

  // ─── Stream ended (user hit native stop banner, or tab was closed) ──────────

  function onStreamEnded() {
    if (!isActive) return;
    isActive = false;
    console.log('[Capture] Stream ended – notifying background.');

    // Clean up
    if (stream) {
      stream.getTracks().forEach(t => t.stop());
      stream = null;
    }

    setStatus('Recording stopped');
    subtitle.textContent = 'Generating your guide…';

    chrome.runtime.sendMessage({ action: 'streamEnded' });
  }

  // ─── Take a single frame snapshot ───────────────────────────────────────────

  function takeScreenshot() {
    if (!isActive || !video.videoWidth) return null;

    canvas.width  = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // JPEG at 75% quality – good balance of size vs fidelity
    return canvas.toDataURL('image/jpeg', 0.75);
  }

  // ─── Message handler (from background.js) ───────────────────────────────────

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'takeScreenshot') {
      const dataURL = takeScreenshot();
      sendResponse({ dataURL: dataURL || null });
      return false; // synchronous response
    }

    if (message.action === 'stopCapture') {
      if (stream) stream.getTracks().forEach(t => t.stop());
      isActive = false;
      sendResponse({ ok: true });
      return false;
    }
  });

  // ─── Wire up button ──────────────────────────────────────────────────────────

  startBtn.addEventListener('click', startCapture);

})();
