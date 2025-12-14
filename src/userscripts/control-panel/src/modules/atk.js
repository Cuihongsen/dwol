import { $, $$, formatTime, now, safeText } from '../dom.js';
import { emitModuleState } from '../events.js';
import { loadBoolean, loadJSON, saveBoolean, saveJSON } from '../storage.js';

const CLICK_INTERVAL_MS = 700;
const STATS_FLUSH_MS = 3_000;
const RETURN_TEXT = '返回游戏';
const END_TEXT = '战斗已经结束';
const LS_ENABLED = 'atk_enabled_v1';
const LS_STATS = 'atk_stats_v1';
const LS_ACTION = 'atk_action_v1';
const MODULE_ID = 'atk';

const ATTACK_OPTIONS = [
  { value: 'normal', label: '普通攻击' },
  { value: 'elixir', label: '万年灵芝' },
];

let enabled = loadBoolean(LS_ENABLED);
let clickTimer = null;
let clickCount = 0;
let lastClickAt = 0;
let statsFlushTimer = null;
let action = ATTACK_OPTIONS[0].value;

function loadStats() {
  const stats = loadJSON(LS_STATS);
  if (!stats) return;
  clickCount = Number(stats.clickCount) || 0;
  lastClickAt = typeof stats.lastClickAt === 'number' ? stats.lastClickAt : 0;
}

function loadAction() {
  const stored = loadJSON(LS_ACTION);
  if (typeof stored === 'string' && ATTACK_OPTIONS.some((item) => item.value === stored)) {
    action = stored;
  }
}

function saveStats() {
  saveJSON(LS_STATS, { clickCount, lastClickAt });
}

function flushStats() {
  if (statsFlushTimer) {
    clearTimeout(statsFlushTimer);
    statsFlushTimer = null;
  }
  saveStats();
}

function scheduleStatsFlush() {
  if (statsFlushTimer) return;
  statsFlushTimer = setTimeout(() => {
    statsFlushTimer = null;
    saveStats();
  }, STATS_FLUSH_MS);
}

function saveAction() {
  saveJSON(LS_ACTION, action);
}

function resetStats() {
  clickCount = 0;
  lastClickAt = 0;
  flushStats();
  updateUI();
}

function announceState() {
  emitModuleState({ moduleId: MODULE_ID, enabled });
}

function findAttackButton() {
  const targetText = ATTACK_OPTIONS.find((item) => item.value === action)?.label ?? ATTACK_OPTIONS[0].label;
  return $$('a,button,input[type="button"],input[type="submit"]').find((el) => {
    const text = el.textContent ? el.textContent.trim() : '';
    const value = el instanceof HTMLInputElement ? (el.value || '').trim() : '';
    return text === targetText || value === targetText;
  });
}

function findReturnButton() {
  return $$('a,button,input[type="button"],input[type="submit"]').find((el) => {
    const text = el.textContent ? el.textContent.trim() : '';
    const value = el instanceof HTMLInputElement ? (el.value || '').trim() : '';
    return text === RETURN_TEXT || value === RETURN_TEXT;
  });
}

function hasBattleEnded() {
  const body = document.body;
  if (!body) return false;
  const text = body.innerText || '';
  return text.includes(END_TEXT);
}

function startClicking() {
  stopClicking();
  clickTimer = setInterval(() => {
    if (hasBattleEnded()) {
      const returnButton = findReturnButton();
      if (returnButton) {
        returnButton.click();
        return;
      }
    }
    const target = findAttackButton();
    if (!target) return;
    target.click();
    clickCount += 1;
    lastClickAt = now();
    scheduleStatsFlush();
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
  flushStats();
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
    <div class="kv"><span class="label" data-label="招式"></span><span
        class="value"
      ><select id="atk-action" aria-label="自动打怪 招式选择">
        ${ATTACK_OPTIONS.map((item) => `<option value="${item.value}">${item.label}</option>`).join('')}
      </select></span></div>
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
  const actionSelect = $('#atk-action');
  if (actionSelect instanceof HTMLSelectElement) {
    actionSelect.onchange = () => {
      const next = actionSelect.value;
      const valid = ATTACK_OPTIONS.some((item) => item.value === next);
      if (!valid) return;
      action = next;
      saveAction();
      if (enabled) {
        startClicking();
      }
    };
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
  const actionSelect = $('#atk-action');
  if (actionSelect instanceof HTMLSelectElement) {
    actionSelect.value = action;
  }
  safeText($('#atk-count'), clickCount);
  safeText($('#atk-last'), formatTime(lastClickAt));
}

export function init() {
  loadStats();
  loadAction();
  mountUI();
  announceState();
  window.addEventListener('beforeunload', () => flushStats());
  if (enabled) {
    startClicking();
  }
}

export function pause() {
  stopClicking();
  flushStats();
}

export function resume() {
  if (enabled) {
    startClicking();
  }
}
