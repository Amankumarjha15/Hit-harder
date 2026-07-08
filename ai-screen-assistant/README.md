# AI Screen Assistant

Capture what's visible in your browser tab, send it to an AI vision model of
your choice, and get an answer in a polished floating overlay — explanations
of code, error messages, math problems, diagrams, or documents, without
leaving the page.

Works on **Google Chrome** and **Mozilla Firefox** from a single codebase,
built on Manifest V3 and the standard WebExtensions API.

---

## Features

- **One shortcut, one flow.** Default `Ctrl+Shift+A` (`Cmd+Shift+A` on Mac)
  captures the visible tab and analyzes it immediately.
- **Bring your own AI.** OpenAI, Google Gemini, Anthropic (Claude), Groq,
  OpenRouter, or DeepSeek — pick a provider and model, paste in your API key.
- **Auto-detects your provider from a pasted key.** Paste any supported
  provider's API key into Settings and it recognizes the key format and
  switches the provider/model dropdowns for you.
- **Alt+Z hides/shows the overlay** instantly without losing your result or
  follow-up draft — handy for glancing back at the page underneath. Esc
  still closes it completely.
- **Floating overlay**, not a new tab: Markdown rendering, syntax
  highlighting, copy buttons, dark/light themes, draggable, resizable via
  settings, closes with Esc.
- **Follow-up questions** on the same screenshot without recapturing.
- **Local history** of past captures — searchable, reopenable, deletable.
- **Privacy-first**: API keys live only in this browser's local extension
  storage; all AI requests are made from the background service worker
  (never from a web page), so page scripts can never read your key.
- **Minimal permissions**: `activeTab`, `storage`, `commands`, `scripting` —
  no persistent access to your browsing.

## Folder structure

```
ai-screen-assistant/
├─ manifest.json              # MV3 manifest (Chrome + Firefox)
├─ background/
│  └─ background.js           # Service worker: orchestrates capture → AI → overlay
├─ content/
│  └─ content.js              # Injected on demand; renders the floating overlay
├─ overlay/
│  └─ overlay.css             # Overlay visual design (shadow-DOM scoped)
├─ options/
│  ├─ options.html/.css/.js   # Settings page (provider, appearance, history)
├─ popup/
│  ├─ popup.html/.css/.js     # Toolbar popup (quick capture + recent history)
├─ services/
│  └─ aiService.js            # Picks a provider adapter, runs the request
├─ providers/
│  ├─ openai.js / anthropic.js / gemini.js / groq.js / openrouter.js / deepseek.js
│  └─ openaiCompatible.js     # Shared logic for the OpenAI-style APIs
├─ storage/
│  └─ storageService.js       # Settings + history persistence (storage.local)
├─ utils/
│  ├─ browserAPI.js           # chrome/browser namespace shim
│  ├─ constants.js            # Message types, defaults, provider metadata
│  ├─ errors.js                # Shared error shape across providers
│  ├─ imageUtils.js           # data URL parsing helper
│  ├─ markdown.js              # Dependency-free Markdown → HTML renderer
│  └─ highlight.js             # Dependency-free syntax highlighter
├─ assets/icons/               # Extension icons (16/32/48/128)
└─ scripts/zip-extension.js    # Chrome packaging helper
```

## How it works, end to end

1. You press the shortcut (or click **Capture & Analyze** in the toolbar
   popup).
2. The background service worker injects the overlay content script into
   the active tab (only that tab, only at that moment — no persistent
   content script).
3. It calls `chrome.tabs.captureVisibleTab()` to grab a PNG of what's on
   screen.
4. It reads your saved provider/model/API key from `storage.local` and
   sends the image (plus a structured system prompt) to that provider's
   vision API, directly from the service worker.
5. The overlay is updated live through each stage: *Capturing → Uploading →
   Analyzing → Rendering → Done*.
6. The response is rendered as Markdown with syntax-highlighted code blocks
   inside the overlay, and saved to local history.

## Why some design choices were made

- **No content script runs by default.** The overlay script is injected
  on demand via `chrome.scripting.executeScript` scoped to `activeTab`,
  instead of a persistent `content_scripts` entry matching every page —
  this keeps the permission footprint (and performance impact) minimal.
- **No bundled Markdown/highlighting libraries.** Both are hand-rolled in
  `utils/markdown.js` and `utils/highlight.js`. This avoids pulling in
  remote or bundled third-party code, which keeps the extension's Content
  Security Policy simple and makes the review surface smaller for store
  submission.
- **Shadow DOM overlay.** The floating UI is rendered inside a Shadow DOM
  so the host page's CSS can never leak in (or the overlay's CSS leak out).

---

## Install for development

### Prerequisites

- Google Chrome 120+ and/or Mozilla Firefox 109+
- Node.js 18+ (only needed for linting/packaging scripts, not required to
  just load and run the extension)
- An API key from at least one supported provider

### Load in Chrome

1. Open `chrome://extensions`.
2. Enable **Developer mode** (top-right toggle).
3. Click **Load unpacked**.
4. Select the `ai-screen-assistant/` folder (the one containing
   `manifest.json`).
5. The extension icon appears in the toolbar. Pin it for quick access.

### Load in Firefox

1. Open `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on…**.
3. Select `manifest.json` inside the `ai-screen-assistant/` folder.
4. Note: temporary add-ons are removed when Firefox restarts. For a
   persistent install during development, use `web-ext run` (see below) or
   sign the build (see **Packaging for Firefox**).

### First-time setup

1. Click the toolbar icon → **Settings** (or right-click the icon →
   **Options**).
2. Under **AI Provider**, choose a provider, pick a model, and paste in
   your API key.
3. Click **Test key** to verify it's accepted, then **Save**.
4. Press `Ctrl+Shift+A` (`Cmd+Shift+A` on Mac) on any page to try it.

---

## Build / lint

No bundler or transpilation step is required — the code runs directly as
loaded. For linting during development:

```bash
npm install
npm run lint
```

## Packaging

### Chrome Web Store

```bash
npm install
npm run package:chrome
```

This produces `dist/ai-screen-assistant-chrome.zip`, ready to upload at
the [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole).
(Requires the `zip` command-line tool, present by default on macOS/Linux;
on Windows use WSL or `Compress-Archive` manually if `zip` isn't available.)

### Firefox Add-ons (AMO)

```bash
npm install
npm run package:firefox
```

This uses `web-ext build` to produce a signed-submission-ready `.zip` in
`dist/`. Upload it at
[addons.mozilla.org/developers](https://addons.mozilla.org/developers/) for
signing and (optionally) public listing.

To test live-reloading during development instead of packaging:

```bash
npm run start:firefox
```

---

## Configuring the keyboard shortcut

Browsers manage extension shortcuts in their own dedicated settings page,
which extensions cannot alter directly (this is a browser security
restriction, not a limitation of this extension):

- **Chrome**: `chrome://extensions/shortcuts`
- **Firefox**: `about:addons` → gear icon → **Manage Extension Shortcuts**

The Options page's **Keyboard Shortcut** tab links directly to the Chrome
page and gives the Firefox path (Firefox blocks extensions from opening
`about:` pages programmatically).

---

## Troubleshooting

**"Could not capture this tab."**
Some pages block screenshots by design — browser internal pages
(`chrome://…`, `about:…`), the Chrome Web Store, and some PDF viewers.
Try it on a regular web page.

**"No API key set for [provider]."**
Open Settings → AI Provider, make sure the provider selected there matches
the one you added a key for, then Save.

**"[Provider] rejected the API key (HTTP 401)."**
The key is invalid, revoked, or pasted with extra whitespace. Use **Test
key** in Settings to confirm, and regenerate the key from the provider's
dashboard if needed.

**"[Provider] rate limit reached (HTTP 429)."**
You've hit the provider's request-rate or quota limit. Wait a moment, or
check your usage/billing dashboard with that provider.

**"[Provider] model not found or doesn't support image input (HTTP 404)."**
Not every model from every provider accepts images. Switch to one of the
vision-capable models listed in the Model dropdown.

**The overlay doesn't appear at all.**
Check `chrome://extensions` (or `about:debugging` in Firefox) for errors on
the extension's service worker — click **Inspect views: service worker**
(Chrome) or **Inspect** (Firefox) to see console logs. Also confirm the
keyboard shortcut isn't bound to something else (see above).

**Follow-up question says "No screenshot on hand."**
The background worker only keeps the last screenshot per tab in memory
while it's running; if the browser recently restarted the service worker
(normal MV3 behavior after idling), just capture again.

**Firefox: the extension disappears after restarting the browser.**
That's expected for `about:debugging` temporary installs — package and
sign it (see **Packaging for Firefox**) for a persistent install, or use
`npm run start:firefox` during active development.

---

## Privacy

- API keys and history are stored only in this browser profile's local
  extension storage (`chrome.storage.local` / `browser.storage.local`) —
  never synced to any account, never sent anywhere except directly to the
  AI provider you configured.
- Screenshots go straight from your browser to the provider's official API
  endpoint over HTTPS. This extension does not run its own backend server.
- All provider requests originate in the background service worker, which
  page scripts cannot access — a malicious or compromised web page can
  never read your API key.

## Scope note

This extension only uses official, documented browser APIs
(`tabs.captureVisibleTab`, `storage`, `commands`, `scripting`) and makes
direct HTTPS requests to each AI provider's public API. It does not
include, and is not intended to include, functionality to bypass website
security, anti-cheat, proctoring, or extension-detection systems.
