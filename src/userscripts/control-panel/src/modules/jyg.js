import { $, $$, formatTime, now, safeText } from '../dom.js';
import { loadBoolean, loadJSON, saveBoolean, saveJSON } from '../storage.js';
import { emitModuleState } from '../events.js';
import {
  createNavigator,
  computeLocationKey,
  canonicalizeHref,
  parseDirectionalLabel,
} from './jyg/navigation.js';

const SCAN_MS = 400;
const CLICK_COOLDOWN_MS = 1000;
const LS_ENABLED = 'jyg_enabled_v1';
const LS_STATS = 'jyg_stats_v3';
const LS_STATS_LEGACY = ['jyg_stats_v2'];
const LOOT_BLOCK_REGEX = /捡到[^\n\r]*/g;
const LOOT_ITEM_REGEX = /(.+?)x(\d+)$/;

const MODULE_ID = 'jyg';

const navigator = createNavigator();

let enabled = loadBoolean(LS_ENABLED);
let scanCount = 0;
let clickCount = 0;
let lastClickAt = 0;
let lastTarget = '-';
let targetBreakdown = {};
let lootTotals = {};
let seenLoot = new Set();
let scanTimer = null;
let lastTelemetryDigest = null;

function extractLocationHint() {
  const candidates = [
    document.querySelector('#ly_map strong'),
    document.querySelector('#ly_map b'),
    document.querySelector('#ly_map'),
  ];
  for (const node of candidates) {
    const text = node && node.textContent ? node.textContent.trim() : '';
    if (text) {
      return text.slice(0, 80);
    }
  }
  const body = document.body ? document.body.innerText : '';
  if (!body) return '';
  const lines = body
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  for (const line of lines) {
    if (line.includes('景阳岗') || line.includes('树林')) {
      return line.slice(0, 80);
    }
  }
  return lines.length ? lines[0].slice(0, 80) : '';
}

function buildNavigationContext(anchors) {
  const movement = [];
  const attack = [];
  const gather = [];
  const misc = [];

  for (const el of anchors) {
    const text = el.textContent ? el.textContent.trim() : '';
    if (!text) continue;
    const rawHref = el.getAttribute('href') || '';
    const href = canonicalizeHref(rawHref);
    const { direction, label } = parseDirectionalLabel(text);
    const normalizedLabel = label || text;
    const base = { el, text, direction, label: normalizedLabel, href };

    if (text.includes('攻击景阳岗')) {
      attack.push({ ...base, key: `attack:${href || normalizedLabel}` });
      continue;
    }
    if (!text.includes('攻击') && text.includes('景阳岗大虫')) {
      attack.push({ ...base, key: `boss:${href || normalizedLabel}` });
      continue;
    }
    if (normalizedLabel.includes('树林')) {
      const key = direction ? `dir:${direction}` : `move:${href || normalizedLabel}`;
      movement.push({ ...base, key });
      continue;
    }
    if (text.includes('灵芝')) {
      gather.push({ ...base, key: `loot:${href || normalizedLabel}` });
      continue;
    }
    if (text.includes('返回游戏')) {
      misc.push({ ...base, key: `return:${href || normalizedLabel}` });
      continue;
    }
  }

  const hint = extractLocationHint();
  const baseLocationKey = computeLocationKey(movement, hint);

  return {
    allAnchors: anchors,
    movement,
    attack,
    gather,
    misc,
    hint,
    baseLocationKey,
    locationKey: baseLocationKey,
  };
}

function handleLocationContext(context) {
  const { baseLocationKey, movement, hint } = context;
  const resolvedKey = navigator.handleContext({ baseLocationKey, movement, hint });
  context.locationKey = resolvedKey;
}

function selectNavigationMove(context) {
  return navigator.selectNavigationMove({
    movement: context.movement,
    locationKey: context.locationKey,
  });
}

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

function announceState() {
  emitModuleState({ moduleId: MODULE_ID, enabled });
}

function refreshSeenLootSnapshot() {
  seenLoot = new Set();
  const text = document.body ? document.body.innerText : '';
  if (!text) return;
  LOOT_BLOCK_REGEX.lastIndex = 0;
  const blocks = text.matchAll(LOOT_BLOCK_REGEX);
  for (const block of blocks) {
    const fullBlock = block[0] ? block[0].trim() : '';
    if (!fullBlock || fullBlock.length <= 2) continue;
    const entries = fullBlock
      .slice(2)
      .split(/[;；]+/)
      .map((entry) => entry.trim())
      .filter(Boolean);
    for (const entry of entries) {
      seenLoot.add(`捡到${entry}`);
    }
  }
}

function resetStats() {
  scanCount = 0;
  clickCount = 0;
  lastClickAt = 0;
  lastTarget = '-';
  targetBreakdown = {};
  lootTotals = {};
  refreshSeenLootSnapshot();
  saveStats();
  updateUI();
  navigator.resetRuntime();
  lastTelemetryDigest = null;
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
  LOOT_BLOCK_REGEX.lastIndex = 0;
  const blocks = text.matchAll(LOOT_BLOCK_REGEX);
  for (const block of blocks) {
    const fullBlock = block[0] ? block[0].trim() : '';
    if (!fullBlock || fullBlock.length <= 2) continue;
    const entries = fullBlock
      .slice(2)
      .split(/[;；]+/)
      .map((entry) => entry.trim())
      .filter(Boolean);
    for (const entry of entries) {
      const match = entry.match(LOOT_ITEM_REGEX);
      if (!match) continue;
      const key = `捡到${entry}`;
      if (seenLoot.has(key)) continue;
      seenLoot.add(key);
      const label = match[1] ? match[1].trim() : '';
      const count = Number(match[2]) || 0;
      if (!label || !count) continue;
      lootTotals[label] = (lootTotals[label] || 0) + count;
      updated = true;
    }
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
  const reset = $('#jyg-reset');
  if (reset) {
    reset.onclick = () => resetStats();
  }
  updateUI();
}

function logTelemetry(telemetry) {
  if (!telemetry) return;
  const snapshot = JSON.stringify({
    key: telemetry.currentLocationKey || null,
    location: telemetry.locationLabel || '-',
    directions: telemetry.directionSummary || '-',
    stack: telemetry.stackSummary || '-',
    pending: telemetry.pendingAction || '-',
    route: telemetry.plannedRoute || '-',
    nodes: telemetry.locationCount || 0,
  });
  if (snapshot === lastTelemetryDigest) {
    return;
  }
  lastTelemetryDigest = snapshot;
  console.info('[JYG] 导航遥测', {
    key: telemetry.currentLocationKey || null,
    location: telemetry.locationLabel || '-',
    directions: telemetry.directionSummary || '-',
    stack: telemetry.stackSummary || '-',
    pending: telemetry.pendingAction || '-',
    route: telemetry.plannedRoute || '-',
    nodes: telemetry.locationCount || 0,
  });
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
  const telemetry = navigator.getTelemetry();
  logTelemetry(telemetry);
}

function pickTarget(context) {
  const anchors = context.allAnchors;
  const byExact = (txt) =>
    anchors.find((a) => a.textContent && a.textContent.trim() === txt);
  const byIncludes = (kw) =>
    anchors.filter((a) => a.textContent && a.textContent.includes(kw));

  const attempts = [
    () => {
      const el = byExact('攻击景阳岗小大虫');
      if (el) {
        navigator.markMoveFailure();
        return { el, label: '攻击景阳岗小大虫' };
      }
      return null;
    },
    () => {
      const el = byExact('攻击景阳岗大虫');
      if (el) {
        navigator.markMoveFailure();
        return { el, label: '攻击景阳岗大虫' };
      }
      return null;
    },
    () => {
      const el = byExact('景阳岗大虫');
      if (el) {
        navigator.markMoveFailure();
        return { el, label: '景阳岗大虫' };
      }
      return null;
    },
    () => {
      const el = byExact('景阳岗小大虫');
      if (el) {
        navigator.markMoveFailure();
        return { el, label: '景阳岗小大虫' };
      }
      return null;
    },
    () => {
      if (context.gather.length) {
        const pick = context.gather[0];
        navigator.markMoveFailure();
        return { el: pick.el, label: pick.label };
      }
      const arr = byIncludes('灵芝');
      if (arr && arr.length) {
        navigator.markMoveFailure();
        return { el: arr[0], label: '灵芝' };
      }
      return null;
    },
    () => {
      if (context.misc.length) {
        const ret = context.misc.find((item) => item.label.includes('返回'));
        if (ret) {
          navigator.markMoveFailure();
          return { el: ret.el, label: ret.label };
        }
      }
      const el = byExact('返回游戏');
      if (el) {
        navigator.markMoveFailure();
        return { el, label: '返回游戏' };
      }
      return null;
    },
    () => selectNavigationMove(context),
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
    const context = buildNavigationContext(anchors);
    handleLocationContext(context);
    const result = pickTarget(context);
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
  announceState();
}

function disable() {
  enabled = false;
  saveBoolean(LS_ENABLED, false);
  stop();
  saveStats();
  updateUI();
  announceState();
  navigator.resetRuntime();
  lastTelemetryDigest = null;
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
  announceState();
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
