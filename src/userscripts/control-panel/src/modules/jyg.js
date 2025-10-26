import { $, $$, formatTime, now, safeText } from '../dom.js';
import { loadBoolean, loadJSON, saveBoolean, saveJSON } from '../storage.js';

const SCAN_MS = 400;
const CLICK_COOLDOWN_MS = 1000;
const LS_ENABLED = 'jyg_enabled_v1';
const LS_STATS = 'jyg_stats_v3';
const LS_STATS_LEGACY = ['jyg_stats_v2'];
const LOOT_REGEX = /捡到(.+?)x(\d+)/g;

let enabled = loadBoolean(LS_ENABLED);
let scanCount = 0;
let clickCount = 0;
let lastClickAt = 0;
let lastTarget = '-';
let targetBreakdown = {};
let lootTotals = {};
let seenLoot = new Set();
let scanTimer = null;

function loadStats() {
  let stats = loadJSON(LS_STATS);
  if (!stats) {
    for (const key of LS_STATS_LEGACY) {
      stats = loadJSON(key);
      if (stats) break;
    }
  }
  if (!stats) return;
  scanCount = Number(stats.scanCount) || 0;
  clickCount = Number(stats.clickCount) || 0;
  lastClickAt = typeof stats.lastClickAt === 'number' ? stats.lastClickAt : 0;
  lastTarget = stats.lastTarget ? String(stats.lastTarget) : '-';
  targetBreakdown =
    stats.targetBreakdown && typeof stats.targetBreakdown === 'object'
      ? { ...stats.targetBreakdown }
      : {};
  lootTotals =
    stats.lootTotals && typeof stats.lootTotals === 'object'
      ? { ...stats.lootTotals }
      : {};
}

function saveStats() {
  saveJSON(LS_STATS, {
    scanCount,
    clickCount,
    lastClickAt,
    lastTarget,
    targetBreakdown,
    lootTotals,
  });
}

function recordScan() {
  scanCount += 1;
  saveStats();
}

function recordClick(targetLabel) {
  clickCount += 1;
  lastClickAt = now();
  lastTarget = targetLabel;
  if (targetLabel) {
    targetBreakdown[targetLabel] = (targetBreakdown[targetLabel] || 0) + 1;
  }
  saveStats();
}

function recordLoot(text) {
  if (!text) return;
  let updated = false;
  LOOT_REGEX.lastIndex = 0;
  const matches = text.matchAll(LOOT_REGEX);
  for (const match of matches) {
    const full = match[0];
    if (seenLoot.has(full)) continue;
    seenLoot.add(full);
    const label = match[1] ? match[1].trim() : '';
    const count = Number(match[2]) || 0;
    if (!label || !count) continue;
    lootTotals[label] = (lootTotals[label] || 0) + count;
    updated = true;
  }
  if (updated) {
    saveStats();
    updateUI();
  }
}

function formatBreakdown() {
  const entries = Object.entries(targetBreakdown);
  if (!entries.length) return '-';
  return entries
    .sort((a, b) => b[1] - a[1])
    .map(([label, count]) => `${label}×${count}`)
    .join(' / ');
}

function formatLoot() {
  const entries = Object.entries(lootTotals);
  if (!entries.length) return '-';
  return entries
    .sort((a, b) => b[1] - a[1])
    .map(([label, count]) => `${label}×${count}`)
    .join(' / ');
}

function mountUI() {
  const body = $('#jyg-body');
  if (!body) return;
  body.innerHTML = `
    <div class="kv"><span class="label" data-label="状态"></span><span
        id="jyg-status"
        class="value state"
        data-state="${enabled ? 'on' : 'off'}"
      ></span></div>
    <div class="kv"><span class="label" data-label="点击次数"></span><span
        id="jyg-clicks"
        class="value"
        data-value="0"
      ></span></div>
    <div class="kv"><span class="label" data-label="上次目标"></span><span
        id="jyg-last-target"
        class="value"
        data-value="-"
      ></span></div>
    <div class="kv"><span class="label" data-label="上次点击"></span><span
        id="jyg-last"
        class="value"
        data-value="-"
      ></span></div>
    <div class="kv"><span class="label" data-label="轮询次数"></span><span
        id="jyg-scans"
        class="value"
        data-value="0"
      ></span></div>
    <div class="kv"><span class="label" data-label="目标统计"></span><span
        id="jyg-targets"
        class="value"
        data-value="-"
      ></span></div>
    <div class="kv"><span class="label" data-label="掉落统计"></span><span
        id="jyg-loot"
        class="value"
        data-value="-"
      ></span></div>
  `;
  const toggle = $('#jyg-toggle');
  if (toggle) {
    toggle.onclick = () => toggleEnabled();
  }
  updateUI();
}

function updateUI() {
  const status = $('#jyg-status');
  if (status) {
    status.dataset.state = enabled ? 'on' : 'off';
  }
  const toggle = $('#jyg-toggle');
  if (toggle) {
    toggle.dataset.mode = enabled ? 'on' : 'off';
    toggle.setAttribute('aria-pressed', enabled ? 'true' : 'false');
  }
  safeText($('#jyg-clicks'), clickCount);
  safeText($('#jyg-last-target'), lastTarget || '-');
  safeText($('#jyg-last'), formatTime(lastClickAt));
  safeText($('#jyg-scans'), scanCount);
  safeText($('#jyg-targets'), formatBreakdown());
  safeText($('#jyg-loot'), formatLoot());
}

function pickTarget(anchors) {
  const byExact = (txt) =>
    anchors.find((a) => a.textContent && a.textContent.trim() === txt);
  const byIncludes = (kw) =>
    anchors.filter((a) => a.textContent && a.textContent.includes(kw));

  const attempts = [
    () => {
      const el = byExact('攻击景阳岗小大虫');
      return el ? { el, label: '攻击景阳岗小大虫' } : null;
    },
    () => {
      const el = byExact('攻击景阳岗大虫');
      return el ? { el, label: '攻击景阳岗大虫' } : null;
    },
    () => {
      const el = byExact('景阳岗大虫');
      return el ? { el, label: '景阳岗大虫' } : null;
    },
    () => {
      const el = byExact('景阳岗小大虫');
      return el ? { el, label: '景阳岗小大虫' } : null;
    },
    () => {
      const arr = byIncludes('灵芝');
      return arr && arr.length ? { el: arr[0], label: '灵芝' } : null;
    },
    () => {
      const el = byExact('返回游戏');
      return el ? { el, label: '返回游戏' } : null;
    },
    () => {
      const woods = byIncludes('树林');
      if (woods && woods.length) {
        const idx = Math.floor(Math.random() * woods.length);
        return { el: woods[idx], label: '树林(随机)' };
      }
      return null;
    },
  ];

  for (const attempt of attempts) {
    const result = attempt();
    if (result) return result;
  }
  return null;
}

function start() {
  stop();
  scanTimer = setInterval(() => {
    if (!enabled) return;
    const text = document.body ? document.body.innerText : '';
    if (text) recordLoot(text);
    if (now() - lastClickAt < CLICK_COOLDOWN_MS) return;
    const anchors = $$('a');
    if (!anchors.length) return;
    const result = pickTarget(anchors);
    recordScan();
    if (result) {
      result.el.click();
      recordClick(result.label);
      updateUI();
    } else {
      updateUI();
    }
  }, SCAN_MS);
}

function stop() {
  if (scanTimer) clearInterval(scanTimer);
  scanTimer = null;
}

function enable() {
  enabled = true;
  saveBoolean(LS_ENABLED, true);
  start();
  updateUI();
}

function disable() {
  enabled = false;
  saveBoolean(LS_ENABLED, false);
  stop();
  saveStats();
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
  if (enabled) {
    start();
  }
}

export function pause() {
  stop();
  saveStats();
}

export function resume() {
  if (enabled) {
    start();
  }
}
