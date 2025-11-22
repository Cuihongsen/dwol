import { $, $$, formatTime, now, safeText } from '../dom.js';
import { emitModuleState } from '../events.js';
import { loadBoolean, loadJSON, saveBoolean, saveJSON } from '../storage.js';

const CLICK_INTERVAL_MS = 700;
const TARGET_TEXT = '普通攻击';
const LS_ENABLED = 'atk_enabled_v1';
const LS_STATS = 'atk_stats_v1';
const MODULE_ID = 'atk';

let enabled = loadBoolean(LS_ENABLED);
let clickTimer = null;
let clickCount = 0;
let lastClickAt = 0;

function loadStats() {
  const stats = loadJSON(LS_STATS);
  if (!stats) return;
  clickCount = Number(stats.clickCount) || 0;
  lastClickAt = typeof stats.lastClickAt === 'number' ? stats.lastClickAt : 0;
}

function saveStats() {
  saveJSON(LS_STATS, { clickCount, lastClickAt });
}

function resetStats() {
  clickCount = 0;
  lastClickAt = 0;
  saveStats();
  updateUI();
}

function announceState() {
  emitModuleState({ moduleId: MODULE_ID, enabled });
}

function findAttackButton() {
  return $$('a,button,input[type="button"],input[type="submit"]').find((el) => {
    const text = el.textContent ? el.textContent.trim() : '';
    const value = el instanceof HTMLInputElement ? (el.value || '').trim() : '';
    return text === TARGET_TEXT || value === TARGET_TEXT;
  });
}

function startClicking() {
  stopClicking();
  clickTimer = setInterval(() => {
    const target = findAttackButton();
    if (!target) return;
    target.click();
    clickCount += 1;
    lastClickAt = now();
    saveStats();
    updateUI();
  }, CLICK_INTERVAL_MS);
}

function stopClicking() {
  if (clickTimer) clearInterval(clickTimer);
  clickTimer = null;
}

function enable() {
  enabled = true;
  saveBoolean(LS_ENABLED, true);
  startClicking();
  updateUI();
  announceState();
}

function disable() {
  enabled = false;
  saveBoolean(LS_ENABLED, false);
  stopClicking();
  updateUI();
  announceState();
}

function toggleEnabled() {
  if (enabled) {
    disable();
  } else {
    enable();
  }
}

function mountUI() {
  const body = $('#atk-body');
  if (!body) return;
  body.innerHTML = `
    <div class="kv"><span class="label" data-label="状态"></span><span
        id="atk-status"
        class="value state"
        data-state="${enabled ? 'on' : 'off'}"
      ></span></div>
    <div class="kv"><span class="label" data-label="累计点击"></span><span
        id="atk-count"
        class="value"
        data-value="0"
      ></span></div>
    <div class="kv"><span class="label" data-label="上次点击"></span><span
        id="atk-last"
        class="value"
        data-value="-"
      ></span></div>
  `;
  const toggle = $('#atk-toggle');
  if (toggle) {
    toggle.onclick = () => toggleEnabled();
  }
  const reset = $('#atk-reset');
  if (reset) {
    reset.onclick = () => resetStats();
  }
  updateUI();
}

function updateUI() {
  const status = $('#atk-status');
  if (status) {
    status.dataset.state = enabled ? 'on' : 'off';
  }
  const toggle = $('#atk-toggle');
  if (toggle) {
    toggle.dataset.mode = enabled ? 'on' : 'off';
    toggle.setAttribute('aria-pressed', enabled ? 'true' : 'false');
  }
  safeText($('#atk-count'), clickCount);
  safeText($('#atk-last'), formatTime(lastClickAt));
}

export function init() {
  loadStats();
  mountUI();
  announceState();
  if (enabled) {
    startClicking();
  }
}

export function pause() {
  stopClicking();
}

export function resume() {
  if (enabled) {
    startClicking();
  }
}
