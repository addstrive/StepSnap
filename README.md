# StepSnap – Auto Guide Recorder

A free, open-source Chrome Extension (Manifest V3) that automatically records your browser actions and compiles them into a printable PDF step-by-step guide — like Scribe / ScribeHow, but 100% local and free.

## Features

- 🎥 Records clicks, typing, and navigation across any website
- 📸 Takes a screenshot after every action
- 📋 Renders a numbered step-by-step guide with screenshots
- 🖨️ One-click PDF export via browser print
- 🔒 100% local — no data leaves your machine

## Installation (Developer Mode)

1. Clone or download this repo
2. Open Chrome and go to `chrome://extensions`
3. Enable **Developer mode** (top-right toggle)
4. Click **Load unpacked** and select the `StepSnap` folder
5. The StepSnap icon will appear in your toolbar

## How to Use

1. Click the **StepSnap** icon in Chrome
2. Click **Start Recording**
3. In the capture tab that opens, click **Share My Screen** and select your monitor
4. Switch to any website and start working — every click and input is captured
5. When done, click the StepSnap icon → **Stop Recording**
6. Your guide opens automatically with all steps and screenshots
7. Click **Export PDF** to print or save as PDF

## Project Structure

```
StepSnap/
├── manifest.json      # Chrome Extension MV3 manifest
├── background.js      # Service worker — state, screenshot requests, step storage
├── content.js         # Injected into pages — captures clicks and inputs
├── capture.html/.js   # Dedicated tab for getDisplayMedia screen capture
├── popup.html/.js     # Extension popup UI (Start / Stop / View)
├── dashboard.html/.js # Step guide viewer + PDF export
└── icons/             # Extension icons (16px, 48px, 128px)
```

## Tech Notes

- **Manifest V3** service worker with all state persisted to `chrome.storage.local` (survives SW idle restarts)
- `getDisplayMedia` runs in a dedicated tab (MV3 service workers can't call MediaDevices)
- Screenshots are canvas snapshots of the display stream, encoded as JPEG
- PDF export uses `@media print` CSS + `window.print()` — no external libraries
- `host_permissions: ["<all_urls>"]` allows injection into any open tab when recording starts

## Privacy

StepSnap processes everything locally in your browser. No data is sent to any server. Recorded steps and screenshots are stored only in `chrome.storage.local` and cleared when you start a new recording.

## License

MIT
