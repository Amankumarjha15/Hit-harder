/**
 * storageService.js
 * ---------------------------------------------------------------------------
 * All persistence goes through this module so the rest of the app never
 * touches `browser.storage` directly. That keeps the storage shape (and any
 * future migration) in one place.
 *
 * Deliberate choice: everything lives in `storage.local`, INCLUDING api keys.
 * We do not use `storage.sync` for keys because sync storage is replicated
 * to the browser vendor's servers tied to the user's profile — local keeps
 * secrets on-device only.
 */

import { ext } from '../utils/browserAPI.js';
import { STORAGE_KEYS, DEFAULT_SETTINGS, MAX_HISTORY_ITEMS } from '../utils/constants.js';

function deepMerge(base, override) {
  const out = Array.isArray(base) ? [...base] : { ...base };
  for (const key of Object.keys(override || {})) {
    const bVal = base ? base[key] : undefined;
    const oVal = override[key];
    if (bVal && typeof bVal === 'object' && !Array.isArray(bVal) &&
        oVal && typeof oVal === 'object' && !Array.isArray(oVal)) {
      out[key] = deepMerge(bVal, oVal);
    } else {
      out[key] = oVal;
    }
  }
  return out;
}

export const storageService = {
  /** Returns settings merged with defaults, so new fields always have a value. */
  async getSettings() {
    const data = await ext.storage.local.get(STORAGE_KEYS.SETTINGS);
    const saved = data[STORAGE_KEYS.SETTINGS] || {};
    return deepMerge(DEFAULT_SETTINGS, saved);
  },

  async saveSettings(partialSettings) {
    const current = await this.getSettings();
    const merged = deepMerge(current, partialSettings);
    await ext.storage.local.set({ [STORAGE_KEYS.SETTINGS]: merged });
    return merged;
  },

  async resetSettings() {
    await ext.storage.local.set({ [STORAGE_KEYS.SETTINGS]: DEFAULT_SETTINGS });
    return DEFAULT_SETTINGS;
  },

  /** Returns history, most recent first. */
  async getHistory() {
    const data = await ext.storage.local.get(STORAGE_KEYS.HISTORY);
    return data[STORAGE_KEYS.HISTORY] || [];
  },

  async addHistoryItem(item) {
    const history = await this.getHistory();
    const entry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      timestamp: Date.now(),
      ...item
    };
    const updated = [entry, ...history].slice(0, MAX_HISTORY_ITEMS);
    await ext.storage.local.set({ [STORAGE_KEYS.HISTORY]: updated });
    return entry;
  },

  async deleteHistoryItem(id) {
    const history = await this.getHistory();
    const updated = history.filter((h) => h.id !== id);
    await ext.storage.local.set({ [STORAGE_KEYS.HISTORY]: updated });
    return updated;
  },

  async clearHistory() {
    await ext.storage.local.set({ [STORAGE_KEYS.HISTORY]: [] });
  },

  async searchHistory(query) {
    const history = await this.getHistory();
    if (!query) return history;
    const q = query.toLowerCase();
    return history.filter((h) =>
      (h.prompt || '').toLowerCase().includes(q) ||
      (h.response || '').toLowerCase().includes(q) ||
      (h.url || '').toLowerCase().includes(q) ||
      (h.title || '').toLowerCase().includes(q) ||
      (h.provider || '').toLowerCase().includes(q)
    );
  }
};
