/**
 * background/background.js
 * ---------------------------------------------------------------------------
 * The orchestrator. Runs as an MV3 service worker (no persistent DOM/state
 * beyond what's kept in memory while active, or in storage across restarts).
 *
 * Flow for a capture request:
 *  1. Ensure the overlay content script is present in the active tab
 *     (scripting.executeScript — only runs on activeTab, on demand).
 *  2. Capture the visible tab as a PNG data URL.
 *  3. Load settings (provider, model, api key).
 *  4. Call the AI provider through services/aiService.js.
 *  5. Stream state updates + the final result (or an error) to the overlay.
 *  6. Save the interaction to history.
 *
 * API keys and all provider calls happen here, never in the content script
 * or page context, so a compromised/malicious page can never read them.
 */

import { ext } from '../utils/browserAPI.js';
import { MSG, PIPELINE_STATE } from '../utils/constants.js';
import { storageService } from '../storage/storageService.js';
import { analyzeScreenshot } from '../services/aiService.js';
import { AIProviderError } from '../utils/errors.js';

// Keeps the last screenshot per tab in memory so a follow-up question
// doesn't require re-capturing the screen.
const lastCaptureByTab = new Map();

async function ensureOverlayInjected(tabId) {
  await ext.scripting.executeScript({
    target: { tabId },
    files: ['content/content.js']
  });
}

function sendToTab(tabId, message) {
  return ext.tabs.sendMessage(tabId, message).catch(() => {
    // Tab may have navigated away or closed mid-flow; nothing to do.
  });
}

async function runCaptureAndAnalyze(tab, userPrompt = '') {
  if (!tab || !tab.id) return;
  const tabId = tab.id;

  try {
    await ensureOverlayInjected(tabId);
    await sendToTab(tabId, { type: MSG.SHOW_OVERLAY, payload: { state: PIPELINE_STATE.CAPTURING } });

    // 1. Capture
    let imageDataUrl;
    try {
      imageDataUrl = await ext.tabs.captureVisibleTab(tab.windowId, { format: 'png' });
    } catch (err) {
      throw new AIProviderError(
        'Could not capture this tab. Some pages (like the Chrome Web Store or browser settings) block screenshots.',
        { type: 'CAPTURE_FAILED' }
      );
    }
    lastCaptureByTab.set(tabId, imageDataUrl);

    await sendToTab(tabId, { type: MSG.UPDATE_STATE, payload: { state: PIPELINE_STATE.UPLOADING } });

    // 2. Settings
    const settings = await storageService.getSettings();
    const providerId = settings.provider;
    const apiKey = settings.apiKeys[providerId];
    const model = settings.models[providerId];

    await sendToTab(tabId, { type: MSG.UPDATE_STATE, payload: { state: PIPELINE_STATE.ANALYZING } });

    // 3. AI request
    const responseText = await analyzeScreenshot({
      providerId,
      apiKey,
      model,
      imageDataUrl,
      userPrompt
    });

    await sendToTab(tabId, { type: MSG.UPDATE_STATE, payload: { state: PIPELINE_STATE.RENDERING } });

    // 4. Deliver result
    await sendToTab(tabId, {
      type: MSG.SHOW_RESULT,
      payload: { text: responseText, provider: providerId, model }
    });

    // 5. History
    await storageService.addHistoryItem({
      url: tab.url ? safeStripQuery(tab.url) : '',
      title: tab.title || '',
      provider: providerId,
      model,
      prompt: userPrompt || '',
      response: responseText
    });
    ext.runtime.sendMessage({ type: MSG.HISTORY_UPDATED }).catch(() => {});
  } catch (err) {
    const message = err instanceof AIProviderError
      ? err.message
      : `Unexpected error: ${err.message || err}`;
    const type = err instanceof AIProviderError ? err.type : 'UNKNOWN';
    await sendToTab(tabId, { type: MSG.SHOW_ERROR, payload: { message, errorType: type } });
  }
}

function safeStripQuery(urlString) {
  try {
    const u = new URL(urlString);
    return `${u.origin}${u.pathname}`;
  } catch {
    return urlString;
  }
}

// --- Event wiring ----------------------------------------------------------

ext.commands.onCommand.addListener(async (command) => {
  if (command !== 'capture-and-analyze') return;
  const [activeTab] = await ext.tabs.query({ active: true, currentWindow: true });
  runCaptureAndAnalyze(activeTab);
});

ext.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    switch (message?.type) {
      case MSG.TRIGGER_CAPTURE: {
        const [activeTab] = await ext.tabs.query({ active: true, currentWindow: true });
        await runCaptureAndAnalyze(activeTab, message.payload?.prompt || '');
        sendResponse({ ok: true });
        break;
      }
      case MSG.ASK_FOLLOWUP: {
        const tabId = sender.tab?.id;
        const cachedImage = tabId != null ? lastCaptureByTab.get(tabId) : null;
        if (!cachedImage) {
          await sendToTab(tabId, { type: MSG.SHOW_ERROR, payload: { message: 'No screenshot on hand for a follow-up — try capturing again.' } });
          sendResponse({ ok: false });
          break;
        }
        try {
          await sendToTab(tabId, { type: MSG.UPDATE_STATE, payload: { state: PIPELINE_STATE.ANALYZING } });
          const settings = await storageService.getSettings();
          const providerId = settings.provider;
          const responseText = await analyzeScreenshot({
            providerId,
            apiKey: settings.apiKeys[providerId],
            model: settings.models[providerId],
            imageDataUrl: cachedImage,
            userPrompt: message.payload?.prompt || ''
          });
          await sendToTab(tabId, { type: MSG.SHOW_RESULT, payload: { text: responseText, provider: providerId, model: settings.models[providerId] } });
          await storageService.addHistoryItem({
            provider: providerId,
            model: settings.models[providerId],
            prompt: message.payload?.prompt || '',
            response: responseText
          });
        } catch (err) {
          const msg = err instanceof AIProviderError ? err.message : `Unexpected error: ${err.message || err}`;
          await sendToTab(tabId, { type: MSG.SHOW_ERROR, payload: { message: msg } });
        }
        sendResponse({ ok: true });
        break;
      }
      case MSG.OPEN_OPTIONS: {
        ext.runtime.openOptionsPage();
        sendResponse({ ok: true });
        break;
      }
      default:
        break;
    }
  })();
  return true; // keep the message channel open for the async response
});

ext.tabs.onRemoved.addListener((tabId) => {
  lastCaptureByTab.delete(tabId);
});
