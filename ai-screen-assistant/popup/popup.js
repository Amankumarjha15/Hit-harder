import { ext } from '../utils/browserAPI.js';
import { MSG } from '../utils/constants.js';
import { storageService } from '../storage/storageService.js';

const els = {
  promptInput: document.getElementById('prompt-input'),
  captureBtn: document.getElementById('capture-btn'),
  shortcutLabel: document.getElementById('shortcut-label'),
  historyList: document.getElementById('history-list'),
  historyEmpty: document.getElementById('history-empty'),
  viewAllBtn: document.getElementById('view-all-btn'),
  settingsBtn: document.getElementById('settings-btn')
};

function timeAgo(ts) {
  const diff = Date.now() - ts;
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return `${Math.floor(hr / 24)}d ago`;
}

async function renderHistory() {
  const history = await storageService.getHistory();
  const recent = history.slice(0, 5);
  els.historyList.innerHTML = '';
  els.historyEmpty.hidden = recent.length > 0;

  for (const item of recent) {
    const li = document.createElement('li');
    li.className = 'pop-history-item';
    li.innerHTML = `
      <div class="pop-history-item-top">
        <span>${item.provider || ''}</span>
        <span>${timeAgo(item.timestamp)}</span>
      </div>
      <div class="pop-history-item-snippet"></div>
    `;
    li.querySelector('.pop-history-item-snippet').textContent =
      (item.prompt ? `Q: ${item.prompt} — ` : '') + item.response.slice(0, 140);
    li.addEventListener('click', () => {
      ext.tabs.create({ url: ext.runtime.getURL(`options/options.html?historyId=${item.id}`) });
    });
    els.historyList.appendChild(li);
  }
}

async function loadShortcut() {
  try {
    const commands = await ext.commands.getAll();
    const cmd = commands.find((c) => c.name === 'capture-and-analyze');
    if (cmd?.shortcut) {
      els.shortcutLabel.textContent = cmd.shortcut;
    } else {
      els.shortcutLabel.textContent = 'Not set — configure in browser settings';
    }
  } catch {
    /* commands.getAll isn't available in all contexts; keep default label */
  }
}

els.captureBtn.addEventListener('click', async () => {
  els.captureBtn.disabled = true;
  els.captureBtn.textContent = 'Capturing…';
  try {
    await ext.runtime.sendMessage({
      type: MSG.TRIGGER_CAPTURE,
      payload: { prompt: els.promptInput.value.trim() }
    });
    window.close();
  } catch (err) {
    els.captureBtn.textContent = 'Capture & Analyze';
    els.captureBtn.disabled = false;
  }
});

els.viewAllBtn.addEventListener('click', () => {
  ext.tabs.create({ url: ext.runtime.getURL('options/options.html#history') });
});

els.settingsBtn.addEventListener('click', () => {
  ext.runtime.openOptionsPage();
});

loadShortcut();
renderHistory();
