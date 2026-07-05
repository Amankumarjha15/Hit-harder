/**
 * content/content.js
 * ---------------------------------------------------------------------------
 * Injected on demand (not a persistent content script) by the background
 * worker via chrome.scripting.executeScript, scoped to activeTab only.
 *
 * Renders the floating overlay inside a Shadow DOM so the host page's CSS
 * can never bleed in (or the overlay's CSS never bleeds out). Never touches
 * API keys — it only receives already-rendered text from the background
 * worker and sends follow-up prompts back to it.
 *
 * Wrapped in an IIFE + a `window.__aiScreenAssistant` guard because this
 * file can be injected more than once into the same page (once per capture
 * trigger) and top-level re-declarations would throw in the shared isolated
 * world.
 */
(function () {
  if (window.__aiScreenAssistant) {
    // Already set up in this page; nothing more to do. The existing
    // controller keeps listening for messages from the background worker.
    return;
  }

  const MSG = {
    SHOW_OVERLAY: 'SHOW_OVERLAY',
    UPDATE_STATE: 'UPDATE_STATE',
    SHOW_RESULT: 'SHOW_RESULT',
    SHOW_ERROR: 'SHOW_ERROR',
    CLOSE_OVERLAY: 'CLOSE_OVERLAY',
    ASK_FOLLOWUP: 'ASK_FOLLOWUP',
    OPEN_OPTIONS: 'OPEN_OPTIONS'
  };

  const STATE_LABELS = {
    CAPTURING: 'Capturing screen…',
    UPLOADING: 'Uploading image…',
    ANALYZING: 'Analyzing with AI…',
    RENDERING: 'Rendering response…',
    COMPLETED: 'Done',
    ERROR: 'Something went wrong'
  };

  const runtime = (typeof browser !== 'undefined') ? browser : chrome;

  const controller = {
    root: null,
    shadow: null,
    host: null,
    els: {},
    lastResultText: '',
    isHiddenByHotkey: false,
    settings: { position: 'top-right', width: 420, fontSize: 14, theme: 'auto' }
  };
  window.__aiScreenAssistant = controller;

  async function loadSettings() {
    try {
      const data = await runtime.storage.local.get('ai_screen_assistant_settings');
      const saved = data.ai_screen_assistant_settings;
      if (saved && saved.popup) {
        controller.settings = { ...controller.settings, ...saved.popup };
      }
    } catch {
      /* use defaults */
    }
  }

  function buildAperturSpinnerSVG() {
    // Signature loading motif: camera-iris blades rotating shut/open.
    const blades = 6;
    let paths = '';
    for (let i = 0; i < blades; i++) {
      const rotation = (360 / blades) * i;
      paths += `<path class="asa-blade" style="animation-delay:${(i * 0.08).toFixed(2)}s" d="M20 20 L36 8 A22 22 0 0 1 40 20 Z" transform="rotate(${rotation} 20 20)"></path>`;
    }
    return `<svg class="asa-aperture" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${paths}</svg>`;
  }

  async function injectStyles(shadow) {
    const cssUrl = runtime.runtime.getURL('overlay/overlay.css');
    try {
      const res = await fetch(cssUrl);
      const cssText = await res.text();
      const style = document.createElement('style');
      style.textContent = cssText;
      shadow.appendChild(style);
    } catch (err) {
      console.warn('[AI Screen Assistant] Failed to load overlay styles', err);
    }
  }

  function detectPreferredColorScheme() {
    if (controller.settings.theme === 'dark' || controller.settings.theme === 'light') {
      return controller.settings.theme;
    }
    return (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light';
  }

  async function buildOverlay() {
    await loadSettings();

    const host = document.createElement('div');
    host.id = 'ai-screen-assistant-host';
    host.style.all = 'initial';
    host.style.position = 'fixed';
    host.style.zIndex = '2147483647';
    host.style.top = '0';
    host.style.left = '0';
    host.style.width = '0';
    host.style.height = '0';
    document.documentElement.appendChild(host);

    const shadow = host.attachShadow({ mode: 'open' });
    await injectStyles(shadow);

    const theme = detectPreferredColorScheme();
    const root = document.createElement('div');
    root.className = `asa-root asa-theme-${theme} asa-pos-${controller.settings.position}`;
    root.style.setProperty('--asa-width', `${controller.settings.width}px`);
    root.style.setProperty('--asa-font-size', `${controller.settings.fontSize}px`);

    root.innerHTML = `
      <div class="asa-card" role="dialog" aria-modal="false" aria-live="polite" aria-label="AI Screen Assistant" title="Esc closes · Alt+Z hides/shows">
        <div class="asa-drag-handle" title="Drag to move"></div>
        <div class="asa-header">
          <div class="asa-brand">
            <svg class="asa-brand-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><circle cx="12" cy="12" r="3.2" class="asa-brand-dot"></circle></svg>
            <span>AI Screen Assistant</span>
          </div>
          <div class="asa-header-actions">
            <span class="asa-provider-badge" hidden></span>
            <button type="button" class="asa-icon-btn asa-theme-btn" aria-label="Toggle theme" title="Toggle theme">◐</button>
            <button type="button" class="asa-icon-btn asa-copy-btn" aria-label="Copy response" title="Copy response" hidden>⧉</button>
            <button type="button" class="asa-icon-btn asa-close-btn" aria-label="Close (Esc)" title="Close (Esc)">✕</button>
          </div>
        </div>

        <div class="asa-status-row">
          ${buildAperturSpinnerSVG()}
          <span class="asa-status-text">${STATE_LABELS.CAPTURING}</span>
        </div>

        <div class="asa-body">
          <div class="asa-result" hidden tabindex="0"></div>
          <div class="asa-error" hidden></div>
        </div>

        <div class="asa-footer" hidden>
          <input type="text" class="asa-followup-input" placeholder="Ask a follow-up about this screenshot…" aria-label="Follow-up question" />
          <button type="button" class="asa-followup-send">Ask</button>
        </div>
      </div>
    `;

    shadow.appendChild(root);

    controller.root = root;
    controller.shadow = shadow;
    controller.host = host;
    controller.els = {
      statusRow: root.querySelector('.asa-status-row'),
      statusText: root.querySelector('.asa-status-text'),
      result: root.querySelector('.asa-result'),
      error: root.querySelector('.asa-error'),
      footer: root.querySelector('.asa-footer'),
      followupInput: root.querySelector('.asa-followup-input'),
      followupSend: root.querySelector('.asa-followup-send'),
      closeBtn: root.querySelector('.asa-close-btn'),
      copyBtn: root.querySelector('.asa-copy-btn'),
      themeBtn: root.querySelector('.asa-theme-btn'),
      providerBadge: root.querySelector('.asa-provider-badge'),
      card: root.querySelector('.asa-card')
    };

    wireInteractions();
    return controller;
  }

  function wireInteractions() {
    const { els, root } = controller;

    els.closeBtn.addEventListener('click', destroyOverlay);

    document.addEventListener('keydown', onKeyDown, true);

    els.copyBtn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(controller.lastResultText);
        els.copyBtn.textContent = '✓';
        setTimeout(() => { els.copyBtn.textContent = '⧉'; }, 1200);
      } catch {
        /* clipboard may be unavailable on this page; fail silently */
      }
    });

    els.themeBtn.addEventListener('click', () => {
      const isDark = root.classList.contains('asa-theme-dark');
      root.classList.remove(isDark ? 'asa-theme-dark' : 'asa-theme-light');
      root.classList.add(isDark ? 'asa-theme-light' : 'asa-theme-dark');
    });

    els.followupSend.addEventListener('click', sendFollowup);
    els.followupInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') sendFollowup();
    });

    // Copy-code buttons are added dynamically inside rendered markdown.
    els.result.addEventListener('click', async (e) => {
      const btn = e.target.closest('.asa-copy-code-btn');
      if (!btn) return;
      const codeBlock = btn.closest('.asa-code-block')?.querySelector('code');
      if (!codeBlock) return;
      try {
        await navigator.clipboard.writeText(codeBlock.textContent);
        btn.textContent = 'Copied';
        setTimeout(() => { btn.textContent = 'Copy'; }, 1200);
      } catch {
        /* ignore */
      }
    });

    makeDraggable(root.querySelector('.asa-drag-handle'), root.querySelector('.asa-card'));
  }

  function onKeyDown(e) {
    if (e.key === 'Escape' && controller.root) {
      destroyOverlay();
      return;
    }
    // Alt+Z: hide/show the overlay without losing its state (result text,
    // scroll position, follow-up draft) — distinct from Esc, which closes
    // it entirely.
    if (e.altKey && (e.key === 'z' || e.key === 'Z' || e.code === 'KeyZ') && controller.root) {
      e.preventDefault();
      toggleOverlayVisibility();
    }
  }

  function toggleOverlayVisibility() {
    if (!controller.host) return;
    controller.isHiddenByHotkey = !controller.isHiddenByHotkey;
    controller.host.style.display = controller.isHiddenByHotkey ? 'none' : '';
  }

  function makeDraggable(handle, card) {
    let dragging = false;
    let offsetX = 0;
    let offsetY = 0;

    handle.addEventListener('mousedown', (e) => {
      dragging = true;
      const rect = card.getBoundingClientRect();
      offsetX = e.clientX - rect.left;
      offsetY = e.clientY - rect.top;
      e.preventDefault();
    });

    window.addEventListener('mousemove', (e) => {
      if (!dragging) return;
      card.style.position = 'fixed';
      card.style.left = `${e.clientX - offsetX}px`;
      card.style.top = `${e.clientY - offsetY}px`;
      card.style.right = 'auto';
      card.style.bottom = 'auto';
      card.style.margin = '0';
    });

    window.addEventListener('mouseup', () => { dragging = false; });
  }

  function sendFollowup() {
    const text = controller.els.followupInput.value.trim();
    if (!text) return;
    controller.els.followupInput.value = '';
    setState('ANALYZING');
    runtime.runtime.sendMessage({ type: MSG.ASK_FOLLOWUP, payload: { prompt: text } });
  }

  function setState(stateKey) {
    const { els } = controller;
    els.statusRow.hidden = false;
    els.statusText.textContent = STATE_LABELS[stateKey] || stateKey;
    els.result.hidden = true;
    els.error.hidden = true;
    els.footer.hidden = true;
    els.card.classList.toggle('asa-state-error', stateKey === 'ERROR');
  }

  async function showResult({ text, provider }) {
    const { els } = controller;
    controller.lastResultText = text;
    els.statusRow.hidden = true;
    els.error.hidden = true;
    els.result.hidden = false;
    els.footer.hidden = false;
    els.copyBtn.hidden = false;
    if (provider) {
      els.providerBadge.hidden = false;
      els.providerBadge.textContent = provider;
    }

    try {
      const markdownUrl = runtime.runtime.getURL('utils/markdown.js');
      const { renderMarkdown } = await import(markdownUrl);
      els.result.innerHTML = renderMarkdown(text);
    } catch (err) {
      // Fall back to plain text if the module import is ever blocked.
      els.result.textContent = text;
    }
    els.result.focus({ preventScroll: true });
  }

  function showError({ message }) {
    const { els } = controller;
    els.statusRow.hidden = true;
    els.result.hidden = true;
    els.footer.hidden = false;
    els.error.hidden = false;
    els.error.textContent = message || 'Something went wrong. Please try again.';
    els.card.classList.add('asa-state-error');
  }

  function unhideOverlay() {
    if (controller.host && controller.isHiddenByHotkey) {
      controller.host.style.display = '';
      controller.isHiddenByHotkey = false;
    }
  }

  function resetForNewRequest() {
    const { els } = controller;
    controller.lastResultText = '';
    els.result.innerHTML = '';
    els.error.textContent = '';
    els.copyBtn.hidden = true;
    els.providerBadge.hidden = true;
  }

  function destroyOverlay() {
    document.removeEventListener('keydown', onKeyDown, true);
    const host = document.getElementById('ai-screen-assistant-host');
    if (host) {
      host.classList?.add('asa-closing');
      host.remove();
    }
    window.__aiScreenAssistant = null;
  }

  // --- Message handling ------------------------------------------------
  runtime.runtime.onMessage.addListener((message) => {
    switch (message?.type) {
      case MSG.SHOW_OVERLAY:
        if (controller.root) {
          // Overlay already open from a previous trigger — reuse it.
          resetForNewRequest();
          unhideOverlay();
          setState(message.payload?.state || 'CAPTURING');
        } else {
          buildOverlay().then(() => setState(message.payload?.state || 'CAPTURING'));
        }
        break;
      case MSG.UPDATE_STATE:
        if (controller.els.statusText) setState(message.payload?.state);
        break;
      case MSG.SHOW_RESULT:
        showResult(message.payload || {});
        break;
      case MSG.SHOW_ERROR:
        if (!controller.root) {
          buildOverlay().then(() => showError(message.payload || {}));
        } else {
          showError(message.payload || {});
        }
        break;
      case MSG.CLOSE_OVERLAY:
        destroyOverlay();
        break;
      default:
        break;
    }
  });
})();
