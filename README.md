# StepSnap: Auto Guide Recorder

A free, open-source Chrome extension that turns any browser task into a clean, numbered, screenshot-by-screenshot job aid you can export to PDF. No design tool required.

## Privacy and security at a glance

For anyone reviewing this before installing it at work:

- **No network access of any kind.** The code makes no outbound requests: no analytics, no telemetry, no cloud service, no account.
- **Storage is local only.** Recorded steps and screenshots live in `chrome.storage.local` on your machine. Starting a new recording clears the previous one; uninstalling the extension removes everything.
- **Passwords are never recorded.** In a password field, StepSnap notes only the field's label, never the value.
- **What it does capture while recording:** a screenshot after each action, a short description of each click, the first 60 characters of text typed into non-password fields, and the page title and URL. Tick **Leave typed text out of guides** in the popup to record only the field name, never what was typed.
- **Screenshots show only what you choose to share.** Recording starts with Chrome's standard screen-share prompt. Share a single window rather than your whole screen if other apps might show sensitive information.
- **Fully open source (MIT).** Every line is in this repo, about 900 lines of plain JavaScript with no external libraries, so it can be audited in under an hour.

### Permissions, in plain terms

| Permission | Why it's needed |
| --- | --- |
| `activeTab`, `tabs`, `scripting`, host access to all sites | To notice clicks and typing in whichever tab you are working in during a recording |
| `desktopCapture` | To take the screenshot after each step, from the screen or window you choose to share |
| `storage` | To keep your recorded steps on your machine between recording and viewing the guide |

A note for reviewers: the page script loads on every site so it is ready when you press record. When you are not recording, it ignores clicks and typing entirely: nothing is passed to the rest of the extension, nothing is stored, and nothing leaves the browser.

## Why I built this

Most of what people know how to do at work, they've never written down. Not because they're bad at documentation, but because writing an SOP is tedious, and the person who knows the process best is usually the one too busy doing it to stop and explain it.

I built StepSnap to remove that excuse. Click record, do the task in your browser like normal, and it captures every click, keystroke and page change with a screenshot after each action. Stop recording, and you have a print-ready job aid.

## Install (developer mode)

1. Download this repo (green **Code** button, then **Download ZIP**) and unzip it.
2. Open Chrome and go to `chrome://extensions`.
3. Turn on **Developer mode** (top-right toggle).
4. Click **Load unpacked** and select the unzipped folder.
5. The StepSnap icon appears in your toolbar.

If your company's Chrome is managed, developer mode may be blocked. Check with IT before rolling it out to a team.

## How to use it

1. Click the **StepSnap** icon in Chrome.
2. Click **Start Recording**.
3. In the capture tab that opens, click **Share My Screen** and pick the window you'll work in.
4. Switch to that window and do the task as you normally would.
5. When you're done, click the StepSnap icon, then **Stop Recording**.
6. Your guide opens with every step and screenshot.
7. Click **Export PDF** to print it or save it as a PDF.

## Project structure

```
StepSnap/
├── manifest.json      # Chrome extension manifest (Manifest V3)
├── background.js      # Service worker: recording state, screenshots, step storage
├── content.js         # Page script: notices clicks and typing
├── capture.html/.js   # Tab that holds the screen-share stream for screenshots
├── popup.html/.js     # Toolbar popup (Start, Stop, View)
├── dashboard.html/.js # Guide viewer and PDF export
├── docs/privacy.html  # Privacy policy
└── icons/             # Extension icons
```

## Tech notes

- Manifest V3 service worker; all state is kept in `chrome.storage.local` so it survives the worker going idle.
- Screen capture runs in its own tab, because Manifest V3 service workers can't use the screen-capture API directly.
- Screenshots are canvas snapshots of the shared stream, saved as JPEG.
- PDF export uses print CSS and the browser's own print dialog. No external libraries.

## License

MIT. Use it as is, change it, share it.
