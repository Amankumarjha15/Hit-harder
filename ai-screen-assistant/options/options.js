import { ext, isFirefox } from '../utils/browserAPI.js';
import { PROVIDERS, DEFAULT_SETTINGS, detectProviderFromKey } from '../utils/constants.js';
import { storageService } from '../storage/storageService.js';
import { testApiKey } from '../services/aiService.js';
import { renderMarkdown } from '../utils/markdown.js';

let settings = DEFAULT_SETTINGS;

// --- Navigation -------------------------------------------------------
const navBtns = Array.from(document.querySelectorAll('.opt-nav-btn'));
const sections = Array.from(document.querySelectorAll('.opt-section'));

function showSection(name) {
  navBtns.forEach((b) => b.classList.toggle('is-active', b.dataset.section === name));
  sections.forEach((s) => s.classList.toggle('is-active', s.id === `section-${name}`));
}

navBtns.forEach((btn) => btn.addEventListener('click', () => showSection(btn.dataset.section)));

// --- Provider section ---------------------------------------------------
const providerSelect = document.getElementById('provider-select');
const modelSelect = document.getElementById('model-select');
const providerNote = document.getElementById('provider-note');
const apiKeyInput = document.getElementById('api-key-input');
const keyHint = document.getElementById('key-hint');
const toggleKeyBtn = document.getElementById('toggle-key-visibility');
const testKeyBtn = document.getElementById('test-key-btn');
const keyTestResult = document.getElementById('key-test-result');
const saveProviderBtn = document.getElementById('save-provider-btn');
const providerSaveStatus = document.getElementById('provider-save-status');

function populateProviderSelect() {
  providerSelect.innerHTML = Object.values(PROVIDERS)
    .map((p) => `<option value="${p.id}">${p.label}</option>`).join('');
}

function populateModelSelect(providerId) {
  const meta = PROVIDERS[providerId];
  modelSelect.innerHTML = meta.models.map((m) => `<option value="${m}">${m}</option>`).join('');
  if (meta.note) {
    providerNote.hidden = false;
    providerNote.textContent = meta.note;
  } else {
    providerNote.hidden = true;
  }
}

function applyProviderChrome(providerId) {
  populateModelSelect(providerId);
  modelSelect.value = settings.models[providerId] || PROVIDERS[providerId].defaultModel;
  keyHint.textContent = PROVIDERS[providerId].keyHint;
}

function loadProviderIntoForm(providerId) {
  applyProviderChrome(providerId);
  apiKeyInput.value = settings.apiKeys[providerId] || '';
  apiKeyInput.type = 'text';
  toggleKeyBtn.textContent = '🙈';
  toggleKeyBtn.title = 'Hide key';
  toggleKeyBtn.setAttribute('aria-pressed', 'false');
  keyTestResult.textContent = '';
  keyTestResult.removeAttribute('data-ok');
  document.getElementById('key-paste-confirm').textContent = '';
}

providerSelect.addEventListener('change', () => loadProviderIntoForm(providerSelect.value));

toggleKeyBtn.addEventListener('click', () => {
  const nowHidden = apiKeyInput.type === 'text';
  apiKeyInput.type = nowHidden ? 'password' : 'text';
  toggleKeyBtn.textContent = nowHidden ? '👁' : '🙈';
  toggleKeyBtn.title = nowHidden ? 'Show key' : 'Hide key';
  toggleKeyBtn.setAttribute('aria-pressed', String(nowHidden));
});

const keyPasteConfirm = document.getElementById('key-paste-confirm');
let pasteConfirmTimeout;
apiKeyInput.addEventListener('paste', () => {
  // Confirms the paste actually landed in the field — useful since a
  // masked (password-type) field gives no visual feedback otherwise.
  setTimeout(() => {
    clearTimeout(pasteConfirmTimeout);
    const key = apiKeyInput.value.trim();

    if (!key) {
      keyPasteConfirm.textContent = 'Paste didn\u2019t seem to add anything — try clicking in the field first, then Ctrl+V (Cmd+V on Mac).';
      pasteConfirmTimeout = setTimeout(() => { keyPasteConfirm.textContent = ''; }, 4000);
      return;
    }

    const detected = detectProviderFromKey(key);
    if (detected && detected !== providerSelect.value) {
      providerSelect.value = detected;
      applyProviderChrome(detected);
      keyPasteConfirm.textContent = `✓ Detected ${PROVIDERS[detected].label} — model set to "${modelSelect.value}". Pasted (${key.length} characters). Click Test key to verify, then Save.`;
    } else {
      keyPasteConfirm.textContent = `✓ Pasted (${key.length} characters).`;
    }
    pasteConfirmTimeout = setTimeout(() => { keyPasteConfirm.textContent = ''; }, 6000);
  }, 0);
});

testKeyBtn.addEventListener('click', async () => {
  const providerId = providerSelect.value;
  const key = apiKeyInput.value;
  testKeyBtn.disabled = true;
  keyTestResult.textContent = 'Checking…';
  keyTestResult.removeAttribute('data-ok');
  try {
    const result = await testApiKey(providerId, key);
    keyTestResult.textContent = result.message;
    keyTestResult.setAttribute('data-ok', String(result.ok));
  } catch (err) {
    keyTestResult.textContent = `Could not test key: ${err.message}`;
    keyTestResult.setAttribute('data-ok', 'false');
  } finally {
    testKeyBtn.disabled = false;
  }
});

saveProviderBtn.addEventListener('click', async () => {
  const providerId = providerSelect.value;
  const updated = {
    provider: providerId,
    apiKeys: { ...settings.apiKeys, [providerId]: apiKeyInput.value.trim() },
    models: { ...settings.models, [providerId]: modelSelect.value }
  };
  settings = await storageService.saveSettings(updated);
  flashSaved(providerSaveStatus);
});

function flashSaved(el) {
  el.textContent = 'Saved ✓';
  setTimeout(() => { el.textContent = ''; }, 1800);
}

// --- Appearance section ---------------------------------------------------
const positionSelect = document.getElementById('position-select');
const widthRange = document.getElementById('width-range');
const widthValue = document.getElementById('width-value');
const fontsizeRange = document.getElementById('fontsize-range');
const fontsizeValue = document.getElementById('fontsize-value');
const themeSelect = document.getElementById('theme-select');
const saveAppearanceBtn = document.getElementById('save-appearance-btn');
const appearanceSaveStatus = document.getElementById('appearance-save-status');

function loadAppearanceIntoForm() {
  positionSelect.value = settings.popup.position;
  widthRange.value = settings.popup.width;
  widthValue.textContent = settings.popup.width;
  fontsizeRange.value = settings.popup.fontSize;
  fontsizeValue.textContent = settings.popup.fontSize;
  themeSelect.value = settings.popup.theme;
}

widthRange.addEventListener('input', () => { widthValue.textContent = widthRange.value; });
fontsizeRange.addEventListener('input', () => { fontsizeValue.textContent = fontsizeRange.value; });

saveAppearanceBtn.addEventListener('click', async () => {
  settings = await storageService.saveSettings({
    popup: {
      position: positionSelect.value,
      width: Number(widthRange.value),
      fontSize: Number(fontsizeRange.value),
      theme: themeSelect.value
    }
  });
  flashSaved(appearanceSaveStatus);
});

// --- Shortcut section ---------------------------------------------------
const currentShortcutEl = document.getElementById('current-shortcut');
const openShortcutsBtn = document.getElementById('open-shortcuts-btn');
const shortcutBrowserHint = document.getElementById('shortcut-browser-hint');

async function loadShortcutSection() {
  try {
    const commands = await ext.commands.getAll();
    const cmd = commands.find((c) => c.name === 'capture-and-analyze');
    currentShortcutEl.textContent = cmd?.shortcut || 'Not set';
  } catch {
    currentShortcutEl.textContent = 'Unavailable';
  }

  if (isFirefox) {
    shortcutBrowserHint.hidden = false;
    shortcutBrowserHint.textContent =
      'Firefox: open about:addons → the gear icon → "Manage Extension Shortcuts" (Firefox does not allow extensions to open this page automatically).';
    openShortcutsBtn.hidden = true;
  } else {
    shortcutBrowserHint.hidden = true;
  }
}

openShortcutsBtn.addEventListener('click', () => {
  ext.tabs.create({ url: 'chrome://extensions/shortcuts' }).catch(() => {
    shortcutBrowserHint.hidden = false;
    shortcutBrowserHint.textContent = 'Could not open the shortcuts page automatically — go to your browser\'s extension settings and look for "Keyboard shortcuts".';
  });
});

// --- History section ---------------------------------------------------
const historySearch = document.getElementById('history-search');
const historyList = document.getElementById('history-full-list');
const historyEmpty = document.getElementById('history-full-empty');
const clearHistoryBtn = document.getElementById('clear-history-btn');
const historyModal = document.getElementById('history-modal');
const historyModalBody = document.getElementById('history-modal-body');
const historyModalClose = document.getElementById('history-modal-close');

function formatDate(ts) {
  return new Date(ts).toLocaleString();
}

async function renderHistoryList(query = '') {
  const items = await storageService.searchHistory(query);
  historyList.innerHTML = '';
  historyEmpty.hidden = items.length > 0;

  for (const item of items) {
    const li = document.createElement('li');
    li.className = 'opt-history-item';
    li.innerHTML = `
      <div class="opt-history-item-top">
        <span>${item.provider || ''} · ${item.model || ''}</span>
        <span>${formatDate(item.timestamp)}</span>
      </div>
      ${item.prompt ? `<div class="opt-history-item-prompt"></div>` : ''}
      <div class="opt-history-item-snippet"></div>
      <div class="opt-history-item-actions">
        <button type="button" class="opt-open-link">Open</button>
        <button type="button" class="opt-delete-link">Delete</button>
      </div>
    `;
    if (item.prompt) li.querySelector('.opt-history-item-prompt').textContent = item.prompt;
    li.querySelector('.opt-history-item-snippet').textContent = item.response.slice(0, 220);

    li.querySelector('.opt-open-link').addEventListener('click', (e) => {
      e.stopPropagation();
      openHistoryModal(item);
    });
    li.querySelector('.opt-delete-link').addEventListener('click', async (e) => {
      e.stopPropagation();
      await storageService.deleteHistoryItem(item.id);
      renderHistoryList(historySearch.value.trim());
    });
    li.addEventListener('click', () => openHistoryModal(item));

    historyList.appendChild(li);
  }
}

function openHistoryModal(item) {
  historyModalBody.innerHTML = `
    <p style="opacity:.6;font-size:12.5px;margin:0 0 10px;">${item.provider} · ${item.model} · ${formatDate(item.timestamp)}${item.url ? ` · ${item.url}` : ''}</p>
    ${item.prompt ? `<p style="font-weight:600;margin:0 0 12px;">${item.prompt}</p>` : ''}
    <div>${renderMarkdown(item.response)}</div>
  `;
  historyModal.hidden = false;
}

historyModalClose.addEventListener('click', () => { historyModal.hidden = true; });
historyModal.addEventListener('click', (e) => { if (e.target === historyModal) historyModal.hidden = true; });

let searchDebounce;
historySearch.addEventListener('input', () => {
  clearTimeout(searchDebounce);
  searchDebounce = setTimeout(() => renderHistoryList(historySearch.value.trim()), 150);
});

clearHistoryBtn.addEventListener('click', async () => {
  if (!confirm('Delete all history? This cannot be undone.')) return;
  await storageService.clearHistory();
  renderHistoryList();
});

// --- Init -------------------------------------------------------------
async function init() {
  settings = await storageService.getSettings();
  populateProviderSelect();
  providerSelect.value = settings.provider;
  loadProviderIntoForm(settings.provider);
  loadAppearanceIntoForm();
  await loadShortcutSection();
  await renderHistoryList();

  const params = new URLSearchParams(location.search);
  const historyId = params.get('historyId');
  if (historyId) {
    const all = await storageService.getHistory();
    const item = all.find((h) => h.id === historyId);
    if (item) {
      showSection('history');
      openHistoryModal(item);
    }
  } else if (location.hash === '#history') {
    showSection('history');
  }
}

init();
