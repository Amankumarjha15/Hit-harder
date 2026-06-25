/**
 * services/aiService.js
 * ---------------------------------------------------------------------------
 * Single entry point the background worker calls. Chooses the right
 * provider adapter, applies a request timeout, and normalizes errors.
 * Adding a new provider = write one file in /providers and add one line here.
 */
import { AIProviderError, ERROR_TYPES } from '../utils/errors.js';
import { PROVIDERS, SYSTEM_PROMPT } from '../utils/constants.js';

import * as openai from '../providers/openai.js';
import * as anthropic from '../providers/anthropic.js';
import * as gemini from '../providers/gemini.js';
import * as groq from '../providers/groq.js';
import * as openrouter from '../providers/openrouter.js';
import * as deepseek from '../providers/deepseek.js';

const ADAPTERS = { openai, anthropic, gemini, groq, openrouter, deepseek };
const REQUEST_TIMEOUT_MS = 60_000;

export function validateApiKeyFormat(providerId, apiKey) {
  const meta = PROVIDERS[providerId];
  if (!meta) return { valid: false, reason: 'Unknown provider.' };
  if (!apiKey || !apiKey.trim()) return { valid: false, reason: 'API key is empty.' };
  if (meta.keyPattern && !meta.keyPattern.test(apiKey.trim())) {
    return { valid: false, reason: `That doesn't look like a valid ${meta.label} key. ${meta.keyHint}` };
  }
  return { valid: true };
}

const PING_ENDPOINTS = {
  openai: { url: 'https://api.openai.com/v1/models', headerName: 'Authorization', headerValue: (k) => `Bearer ${k}` },
  groq: { url: 'https://api.groq.com/openai/v1/models', headerName: 'Authorization', headerValue: (k) => `Bearer ${k}` },
  openrouter: { url: 'https://openrouter.ai/api/v1/models', headerName: 'Authorization', headerValue: (k) => `Bearer ${k}` },
  deepseek: { url: 'https://api.deepseek.com/v1/models', headerName: 'Authorization', headerValue: (k) => `Bearer ${k}` },
  anthropic: null, // no lightweight models-list endpoint; format check only
  gemini: null     // key is passed as a query param; format check only
};

/**
 * Best-effort live check that an API key is accepted by the provider.
 * Falls back to "format looks valid" when a provider has no cheap
 * validation endpoint (Anthropic, Gemini), since a full vision call just
 * to validate a key would be wasteful and cost the user money.
 */
export async function testApiKey(providerId, apiKey) {
  const formatCheck = validateApiKeyFormat(providerId, apiKey);
  if (!formatCheck.valid) return { ok: false, message: formatCheck.reason };

  const ping = PING_ENDPOINTS[providerId];
  if (!ping) {
    return { ok: true, message: 'Key format looks valid. (This provider has no lightweight way to verify keys without making a real request.)' };
  }

  try {
    const res = await fetch(ping.url, { headers: { [ping.headerName]: ping.headerValue(apiKey.trim()) } });
    if (res.ok) return { ok: true, message: 'Key verified successfully.' };
    if (res.status === 401 || res.status === 403) return { ok: false, message: 'The provider rejected this key.' };
    return { ok: false, message: `Provider returned HTTP ${res.status} while checking the key.` };
  } catch (err) {
    return { ok: false, message: `Could not reach the provider to verify the key: ${err.message}` };
  }
}

/**
 * Runs a vision analysis request against the configured provider.
 * @param {object} opts
 * @param {string} opts.providerId
 * @param {string} opts.apiKey
 * @param {string} opts.model
 * @param {string} opts.imageDataUrl - data:image/png;base64,... from captureVisibleTab
 * @param {string} [opts.userPrompt]
 */
export async function analyzeScreenshot({ providerId, apiKey, model, imageDataUrl, userPrompt }) {
  const adapter = ADAPTERS[providerId];
  if (!adapter) {
    throw new AIProviderError(`Unknown AI provider: ${providerId}`, { type: ERROR_TYPES.UNSUPPORTED_MODEL });
  }
  if (!apiKey || !apiKey.trim()) {
    throw new AIProviderError(
      `No API key set for ${PROVIDERS[providerId]?.label || providerId}. Add one in Settings.`,
      { type: ERROR_TYPES.NO_API_KEY, providerId }
    );
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const text = await adapter.analyzeImage({
      apiKey: apiKey.trim(),
      model,
      imageDataUrl,
      systemPrompt: SYSTEM_PROMPT,
      userPrompt,
      signal: controller.signal
    });
    return text;
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new AIProviderError('The request timed out. Check your connection and try again.', { type: ERROR_TYPES.NETWORK, providerId });
    }
    if (err instanceof AIProviderError) {
      err.providerId = err.providerId || providerId;
      throw err;
    }
    throw new AIProviderError(err.message || 'Unknown error contacting the AI provider.', { type: ERROR_TYPES.UNKNOWN, providerId });
  } finally {
    clearTimeout(timeout);
  }
}
