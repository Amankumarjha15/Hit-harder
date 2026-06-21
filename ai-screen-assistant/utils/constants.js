/**
 * constants.js — single source of truth for message names, storage keys,
 * default settings and provider metadata. Import from anywhere instead of
 * re-typing string literals, so a typo becomes a linter/import error rather
 * than a silent runtime bug.
 */

// ---------------------------------------------------------------------------
// Runtime message types (background <-> content script <-> popup/options)
// ---------------------------------------------------------------------------
export const MSG = {
  TRIGGER_CAPTURE: 'TRIGGER_CAPTURE',       // popup -> background
  SHOW_OVERLAY: 'SHOW_OVERLAY',             // background -> content
  UPDATE_STATE: 'UPDATE_STATE',             // background -> content
  SHOW_RESULT: 'SHOW_RESULT',               // background -> content
  SHOW_ERROR: 'SHOW_ERROR',                 // background -> content
  CLOSE_OVERLAY: 'CLOSE_OVERLAY',           // content -> background (fyi) / background -> content
  ASK_FOLLOWUP: 'ASK_FOLLOWUP',             // content -> background
  OVERLAY_READY: 'OVERLAY_READY',           // content -> background (ack)
  OPEN_OPTIONS: 'OPEN_OPTIONS',             // any -> background
  HISTORY_UPDATED: 'HISTORY_UPDATED'        // background -> options/popup
};

// Pipeline states shown in the overlay while a request is in flight.
export const PIPELINE_STATE = {
  CAPTURING: 'CAPTURING',
  UPLOADING: 'UPLOADING',
  ANALYZING: 'ANALYZING',
  RENDERING: 'RENDERING',
  COMPLETED: 'COMPLETED',
  ERROR: 'ERROR'
};

export const STATE_LABELS = {
  [PIPELINE_STATE.CAPTURING]: 'Capturing screen…',
  [PIPELINE_STATE.UPLOADING]: 'Uploading image…',
  [PIPELINE_STATE.ANALYZING]: 'Analyzing with AI…',
  [PIPELINE_STATE.RENDERING]: 'Rendering response…',
  [PIPELINE_STATE.COMPLETED]: 'Done',
  [PIPELINE_STATE.ERROR]: 'Something went wrong'
};

// ---------------------------------------------------------------------------
// Storage keys
// ---------------------------------------------------------------------------
export const STORAGE_KEYS = {
  SETTINGS: 'ai_screen_assistant_settings',
  HISTORY: 'ai_screen_assistant_history'
};

export const MAX_HISTORY_ITEMS = 100;

// ---------------------------------------------------------------------------
// Providers
// ---------------------------------------------------------------------------
export const PROVIDERS = {
  openai: {
    id: 'openai',
    label: 'OpenAI',
    defaultModel: 'gpt-4o',
    models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4.1', 'gpt-4.1-mini'],
    keyHint: 'Starts with "sk-". Create one at platform.openai.com/api-keys',
    keyPattern: /^sk-[A-Za-z0-9_-]{16,}$/
  },
  gemini: {
    id: 'gemini',
    label: 'Google Gemini',
    defaultModel: 'gemini-1.5-flash',
    models: ['gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-2.0-flash'],
    keyHint: 'Create one at aistudio.google.com/apikey',
    keyPattern: /^[A-Za-z0-9_-]{20,}$/
  },
  anthropic: {
    id: 'anthropic',
    label: 'Anthropic (Claude)',
    defaultModel: 'claude-3-5-sonnet-20241022',
    models: ['claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022', 'claude-3-opus-20240229'],
    keyHint: 'Starts with "sk-ant-". Create one at console.anthropic.com',
    keyPattern: /^sk-ant-[A-Za-z0-9_-]{16,}$/
  },
  groq: {
    id: 'groq',
    label: 'Groq',
    defaultModel: 'meta-llama/llama-4-scout-17b-16e-instruct',
    models: ['meta-llama/llama-4-scout-17b-16e-instruct', 'qwen/qwen3.6-27b'],
    keyHint: 'Starts with "gsk_". Create one at console.groq.com/keys',
    keyPattern: /^gsk_[A-Za-z0-9_-]{16,}$/,
    note: 'Groq retires preview models on short notice. If a model stops working, check console.groq.com/docs/models for the current vision-capable lineup.'
  },
  openrouter: {
    id: 'openrouter',
    label: 'OpenRouter',
    defaultModel: 'openai/gpt-4o',
    models: ['openai/gpt-4o', 'anthropic/claude-3.5-sonnet', 'google/gemini-flash-1.5'],
    keyHint: 'Starts with "sk-or-". Create one at openrouter.ai/keys',
    keyPattern: /^sk-or-[A-Za-z0-9_-]{16,}$/
  },
  deepseek: {
    id: 'deepseek',
    label: 'DeepSeek',
    defaultModel: 'deepseek-vl',
    models: ['deepseek-vl'],
    keyHint: 'Starts with "sk-". Create one at platform.deepseek.com',
    keyPattern: /^sk-[A-Za-z0-9_-]{16,}$/,
    note: 'DeepSeek support depends on their API exposing an OpenAI-compatible vision endpoint. Verify availability before relying on it.'
  }
};

/**
 * Best-effort provider detection from an API key's shape. Ordered from most
 * specific prefix to least, since some providers' generic "sk-" prefix
 * overlaps with others (Anthropic, OpenRouter, and DeepSeek all start with
 * variants of "sk-"). Returns null if nothing matches confidently.
 *
 * Known limitation: OpenAI and DeepSeek keys can both look like a bare
 * "sk-xxxxxxxx" with no other distinguishing marker, so a DeepSeek key may
 * get detected as OpenAI. If that happens, just pick DeepSeek manually from
 * the provider dropdown — the pasted key is preserved either way.
 */
export function detectProviderFromKey(rawKey) {
  const key = (rawKey || '').trim();
  if (!key) return null;

  if (/^sk-ant-/.test(key)) return 'anthropic';
  if (/^sk-or-/.test(key)) return 'openrouter';
  if (/^gsk_/.test(key)) return 'groq';
  if (/^AIza/.test(key)) return 'gemini';
  if (/^sk-proj-/.test(key)) return 'openai';
  if (/^sk-/.test(key)) return 'openai'; // best-effort default for bare "sk-" keys

  return null;
}

export const DEFAULT_SETTINGS = {
  provider: 'openai',
  apiKeys: {
    openai: '', gemini: '', anthropic: '', groq: '', openrouter: '', deepseek: ''
  },
  models: {
    openai: PROVIDERS.openai.defaultModel,
    gemini: PROVIDERS.gemini.defaultModel,
    anthropic: PROVIDERS.anthropic.defaultModel,
    groq: PROVIDERS.groq.defaultModel,
    openrouter: PROVIDERS.openrouter.defaultModel,
    deepseek: PROVIDERS.deepseek.defaultModel
  },
  popup: {
    position: 'top-right',   // top-right | top-left | bottom-right | bottom-left | center
    width: 420,
    fontSize: 14,
    theme: 'auto'            // auto | dark | light
  }
};

// System prompt sent with every vision request.
export const SYSTEM_PROMPT = `You are AI Screen Assistant, a concise and accurate visual analysis assistant embedded in a browser extension.
You will be shown a screenshot of a user's browser tab. Depending on what's visible, you should:
- Answer any questions shown in the image directly and accurately.
- Explain code: what it does, potential bugs, and how to fix errors if any are shown.
- Summarize documents or articles concisely.
- Solve visible math problems, showing key steps.
- Explain compiler, runtime, or console errors and suggest fixes.
- Describe diagrams, charts, or UI layouts when relevant.
- If a user's own text prompt is included, prioritize answering that about the image.
Keep responses concise and well-formatted in Markdown by default. Use code blocks with language hints for code. Only go into more depth if the user explicitly asks for it. If the screenshot is ambiguous or unreadable, say so plainly instead of guessing.`;
