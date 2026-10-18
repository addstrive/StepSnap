# StepSnap: Security Summary for IT Review

StepSnap is a free, open-source Chrome extension that turns a browser task into a numbered, screenshot-by-screenshot job aid. It never sends data off the machine. This page is written for IT and security teams deciding whether to allow it.

## What it is

The user clicks record, does a task in the browser, and stops. StepSnap builds a step-by-step guide with a screenshot after each action, which the user can export to PDF through Chrome's own print dialog.

- **Source:** this repository, MIT license, version 1.1.0
- **Size:** about 900 lines of plain JavaScript, no external libraries or dependencies
- **Platform:** Chrome, Manifest V3
- **Publisher:** Max Konstanty (ADDStrive), a personal open-source project

## Data handling

The code makes no network requests of any kind: no analytics, telemetry, cloud service, account or update check.

| Question | Answer |
| --- | --- |
| What is captured, and when | Only while the user is recording: a screenshot after each action, a short description of each click, the page title and URL |
| Typed text | First 60 characters per field, or none at all if the user ticks "Leave typed text out of guides" |
| Passwords | Never recorded; only the field label is noted |
| When not recording | The page script ignores all clicks and typing; nothing is passed on or stored |
| Screenshot scope | Only the screen or window the user picks in Chrome's standard screen-share prompt |
| Where data is stored | `chrome.storage.local` on the user's own machine, readable only by the extension |
| Retention | Cleared when a new recording starts; everything removed when the extension is uninstalled |

Recommended practice: share a single window, not the whole screen, and tick the typed-text option when working in systems with sensitive data.

## Permissions

| Chrome permission | Why it's needed |
| --- | --- |
| `activeTab`, `tabs`, `scripting`, host access to all sites | To notice clicks and typing in whichever tab the user works in during a recording |
| `desktopCapture` | To take the screenshot after each step, from the screen or window the user chooses to share |
| `storage` | To keep recorded steps on the machine between recording and viewing the guide |

The broad site access is what lets a recording follow the user across tabs and sites. The extension does not request `cookies`, `history`, `downloads`, `webRequest` or any identity permissions.

## Installing

StepSnap is not on the Chrome Web Store yet, so it installs in developer mode (Load unpacked from the downloaded repository; see the README). Organizations that block developer mode can package it themselves and deploy it through Chrome enterprise policy.

## Reporting a security issue

Email max@addstrive.com with details. Please don't open a public issue for a suspected vulnerability.
