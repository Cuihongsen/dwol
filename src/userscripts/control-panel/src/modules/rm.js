import { $, $$, formatTime, now, safeText } from '../dom.js';
import { loadBoolean, loadJSON, saveBoolean, saveJSON } from '../storage.js';

const REFRESH_MS = 2000;
const CHECK_MS = 2000;
const RESUME_DELAY_MS = 3000;
const TARGET_TEXT = '汗血宝马';
const TARGET_ALIAS = '目标马';
const LS_STATS = 'rm_stats_v1';
const LS_PENDING_RETURN = 'rm_pending_return_v1';
const LS_ENABLED = 'rm_enabled_v1';

let enabled = loadBoolean(LS_ENABLED);
let refreshCount = 0;
let moveClickCount = 0;
let lastTriggerTs = null;
let foundCount = 0;
let refreshInterval = null;
let checkInterval = null;
let actedThisRound = false;

function loadStats() {
  const stats = loadJSON(LS_STATS);
  if (!stats) return;
  refreshCount = Number(stats.refreshCount) || 0;
  moveClickCount = Number(stats.moveClickCount) || 0;
  lastTriggerTs = typeof stats.lastTriggerTs === 'number' ? stats.lastTriggerTs : null;
}

function saveStats() {
  saveJSON(LS_STATS, { refreshCount, moveClickCount, lastTriggerTs });
}

function setPendingReturn(value) {
  saveBoolean(LS_PENDING_RETURN, value);
}

function isPendingReturn() {
  return loadBoolean(LS_PENDING_RETURN);
}

function mountUI() {
  const body = $('#rm-body');
  if (!body) return;
  body.innerHTML = `
    <div class="kv"><span class="label" data-label="状态"></span><span
        id="rm-status"
        class="value state"
        data-state="${enabled ? 'on' : 'off'}"
      ></span></div>
    <div class="kv"><span class="label" data-label="刷新次数"></span><span
        id="rm-refresh"
        class="value"
        data-value="0"
      ></span></div>
    <div class="kv"><span class="label" data-label="${TARGET_ALIAS} 出现(当前页)"></span><span
        id="rm-found"
        class="value"
        data-value="0"
      ></span></div>
    <div class="kv"><span class="label" data-label="牵走次数"></span><span
        id="rm-move"
        class="value"
        data-value="0"
      ></span></div>
    <div class="kv"><span class="label" data-label="上次触发"></span><span
        id="rm-last"
        class="value"
        data-value="-"
      ></span></div>
  `;
  const toggle = $('#rm-toggle');
  if (toggle) {
    toggle.onclick = () => toggleEnabled();
  }
  updateUI();
}

function updateUI() {
  const status = $('#rm-status');
  if (status) {
    status.dataset.state = enabled ? 'on' : 'off';
  }
  const toggle = $('#rm-toggle');
  if (toggle) {
    toggle.dataset.mode = enabled ? 'on' : 'off';
    toggle.setAttribute('aria-pressed', enabled ? 'true' : 'false');
  }
  safeText($('#rm-refresh'), refreshCount);
  safeText($('#rm-found'), foundCount);
  safeText($('#rm-move'), moveClickCount);
  safeText($('#rm-last'), formatTime(lastTriggerTs));
}

function startRefreshing() {
  stopRefreshing();
  refreshInterval = setInterval(() => {
    const link = $$('a').find((a) => a.textContent && a.textContent.includes('刷新'));
    if (link) {
      link.click();
      refreshCount += 1;
      saveStats();
    }
    updateUI();
  }, REFRESH_MS);
}

function stopRefreshing() {
  if (refreshInterval) clearInterval(refreshInterval);
  refreshInterval = null;
}

function startChecking() {
  stopChecking();
  actedThisRound = false;
  checkInterval = setInterval(() => {
    const txt = document.body ? document.body.innerText : '';
    const matches = txt.match(new RegExp(TARGET_TEXT, 'g'));
    foundCount = matches ? matches.length : 0;
    if (!actedThisRound && foundCount >= 2) {
      actedThisRound = true;
      stopRefreshing();
      stopChecking();
      const move = $$('a,button').find(
        (el) => el.textContent && el.textContent.includes('牵走')
      );
      if (move) {
        setPendingReturn(true);
        move.click();
        moveClickCount += 1;
        lastTriggerTs = now();
        saveStats();
      }
      setTimeout(() => {
        if (enabled) {
          startRefreshing();
          startChecking();
        }
      }, RESUME_DELAY_MS);
    }
    updateUI();
  }, CHECK_MS);
}

function stopChecking() {
  if (checkInterval) clearInterval(checkInterval);
  checkInterval = null;
}

function tryClickReturn() {
  if (!isPendingReturn()) return;
  const start = now();
  const timer = setInterval(() => {
    const button = $$('a,button').find(
      (el) => el.textContent && el.textContent.trim() === '返回游戏'
    );
    if (button) {
      button.click();
      setPendingReturn(false);
      clearInterval(timer);
      if (enabled) {
        startRefreshing();
        startChecking();
      }
    } else if (now() - start > 15000) {
      setPendingReturn(false);
      clearInterval(timer);
      if (enabled) {
        startRefreshing();
        startChecking();
      }
    }
  }, 600);
}

function enable() {
  enabled = true;
  saveBoolean(LS_ENABLED, true);
  startRefreshing();
  startChecking();
  updateUI();
}

function disable() {
  enabled = false;
  saveBoolean(LS_ENABLED, false);
  stopRefreshing();
  stopChecking();
  updateUI();
}

function toggleEnabled() {
  if (enabled) {
    disable();
  } else {
    enable();
  }
}

export function init() {
  loadStats();
  mountUI();
  if (!enabled) return;
  if (isPendingReturn()) {
    tryClickReturn();
  } else {
    startRefreshing();
    startChecking();
  }
}

export function pause() {
  stopRefreshing();
  stopChecking();
}

export function resume() {
  if (enabled) {
    startRefreshing();
    startChecking();
  }
}
