import { $, $$, formatTime, now, safeText } from '../dom.js';
import { loadBoolean, loadJSON, saveBoolean, saveJSON } from '../storage.js';
import { emitModuleState } from '../events.js';

const SCAN_MS = 400;
const CLICK_COOLDOWN_MS = 1000;
const LS_ENABLED = 'jyg_enabled_v1';
const LS_STATS = 'jyg_stats_v3';
const LS_STATS_LEGACY = ['jyg_stats_v2'];
const LOOT_BLOCK_REGEX = /捡到[^\n\r]*/g;
const LOOT_ITEM_REGEX = /(.+?)x(\d+)$/;

const MODULE_ID = 'jyg';
const DIRECTION_OPPOSITES = {
  左: '右',
  右: '左',
  上: '下',
  下: '上',
};
const PREFERRED_DIRECTION_ORDER = ['右', '下', '左', '上'];
const ARROW_DIRECTIONS = {
  '←': '左',
  '→': '右',
  '↑': '上',
  '↓': '下',
};

let enabled = loadBoolean(LS_ENABLED);
let scanCount = 0;
let clickCount = 0;
let lastClickAt = 0;
let lastTarget = '-';
let targetBreakdown = {};
let lootTotals = {};
let seenLoot = new Set();
let scanTimer = null;
let currentLocationKey = null;
let pendingMove = null;
const locationGraph = new Map();
let navigationStack = [];

function parseDirectionalLabel(text) {
  const raw = text ? text.trim() : '';
  if (!raw) {
    return { direction: null, label: '' };
  }

  let direction = null;
  let label = raw;

  const prefixMatch = raw.match(/^(左|右|上|下)\s*[:：]\s*(.+)$/);
  if (prefixMatch) {
    direction = prefixMatch[1];
    label = prefixMatch[2] ? prefixMatch[2].trim() : label;
  }

  const arrowMatch = raw.match(/(.+?)([←→↑↓])\s*$/);
  if (arrowMatch) {
    label = arrowMatch[1] ? arrowMatch[1].trim() : label;
    const arrow = arrowMatch[2];
    if (arrow && ARROW_DIRECTIONS[arrow]) {
      direction = direction || ARROW_DIRECTIONS[arrow];
    }
  }

  if (!label) {
    label = raw;
  }

  return { direction, label };
}

function clearNavigationState() {
  currentLocationKey = null;
  pendingMove = null;
  navigationStack = [];
  locationGraph.clear();
}

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
    const href = el.getAttribute('href') || '';
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
  const locationKey = computeLocationKey(movement, hint);

  return {
    allAnchors: anchors,
    movement,
    attack,
    gather,
    misc,
    hint,
    locationKey,
  };
}

function computeLocationKey(movement, hint) {
  const parts = movement
    .map(({ key, href, label }) => `${key}|${href || ''}|${label}`)
    .sort();
  if (hint) {
    parts.unshift(`hint:${hint}`);
  }
  if (!parts.length) {
    return hint || null;
  }
  return parts.join('||');
}

function ensureGraphNode(key) {
  if (!key) return null;
  let node = locationGraph.get(key);
  if (!node) {
    node = {
      tried: new Set(),
      directionMeta: new Map(),
      neighbors: new Map(),
    };
    locationGraph.set(key, node);
  }
  return node;
}

function registerNodeDirections(key, movement) {
  const node = ensureGraphNode(key);
  if (!node) return null;
  node.directionMeta.clear();
  for (const link of movement) {
    node.directionMeta.set(link.key, {
      direction: link.direction,
      label: link.label,
      href: link.href,
    });
  }
  return node;
}

function hasUntriedDirections(key) {
  const node = key ? locationGraph.get(key) : null;
  if (!node) return false;
  for (const linkKey of node.directionMeta.keys()) {
    if (!node.tried.has(linkKey)) {
      return true;
    }
  }
  return false;
}

function alignNavigationStack(fromKey, toKey, viaDirection) {
  if (!fromKey || !toKey) {
    navigationStack = [
      {
        nodeKey: toKey,
        parentKey: null,
        viaDirection: null,
        returnDirection: null,
      },
    ];
    return;
  }
  const fromIndex = navigationStack.findIndex((entry) => entry.nodeKey === fromKey);
  if (fromIndex === -1) {
    navigationStack = [
      {
        nodeKey: toKey,
        parentKey: null,
        viaDirection: null,
        returnDirection: null,
      },
    ];
    return;
  }
  const fromEntry = navigationStack[fromIndex];
  const parentEntry = fromIndex > 0 ? navigationStack[fromIndex - 1] : null;
  const expectedBack = fromEntry ? fromEntry.returnDirection : null;
  if (
    parentEntry &&
    parentEntry.nodeKey === toKey &&
    expectedBack &&
    viaDirection &&
    expectedBack === viaDirection
  ) {
    navigationStack = navigationStack.slice(0, fromIndex);
    return;
  }
  const returnDirection = viaDirection ? DIRECTION_OPPOSITES[viaDirection] || null : null;
  navigationStack = navigationStack.slice(0, fromIndex + 1);
  navigationStack.push({
    nodeKey: toKey,
    parentKey: fromKey,
    viaDirection,
    returnDirection,
  });
}

function handleLocationContext(context) {
  const { locationKey, movement } = context;
  if (!locationKey) {
    clearNavigationState();
    return;
  }

  if (locationKey !== currentLocationKey) {
    const previousKey = currentLocationKey;
    currentLocationKey = locationKey;
    registerNodeDirections(locationKey, movement);
    if (pendingMove && previousKey && pendingMove.fromKey === previousKey) {
      const fromNode = locationGraph.get(previousKey);
      if (fromNode && pendingMove.key) {
        fromNode.tried.add(pendingMove.key);
      }
      if (fromNode && pendingMove.direction) {
        fromNode.neighbors.set(pendingMove.direction, locationKey);
      }
    }
    if (pendingMove && pendingMove.direction) {
      const opposite = DIRECTION_OPPOSITES[pendingMove.direction];
      if (opposite) {
        const node = ensureGraphNode(locationKey);
        if (node) {
          node.neighbors.set(opposite, pendingMove.fromKey || null);
        }
      }
    }
    const moveDirection = pendingMove && pendingMove.direction ? pendingMove.direction : null;
    alignNavigationStack(pendingMove ? pendingMove.fromKey : null, locationKey, moveDirection);
    pendingMove = null;
  } else {
    registerNodeDirections(locationKey, movement);
  }
}

function directionPriority(direction) {
  if (!direction) return PREFERRED_DIRECTION_ORDER.length + 1;
  const idx = PREFERRED_DIRECTION_ORDER.indexOf(direction);
  return idx === -1 ? PREFERRED_DIRECTION_ORDER.length : idx;
}

function selectNavigationMove(context) {
  const { movement, locationKey } = context;
  if (!movement.length || !locationKey) return null;

  const node = registerNodeDirections(locationKey, movement) || ensureGraphNode(locationKey);
  if (!node) return null;

  const sorted = [...movement].sort((a, b) => directionPriority(a.direction) - directionPriority(b.direction));
  const untried = sorted.filter((link) => !node.tried.has(link.key));
  let chosen = untried.length ? untried[0] : null;

  if (!chosen) {
    const entryIndex = navigationStack.findIndex((entry) => entry.nodeKey === locationKey);
    if (entryIndex !== -1) {
      const entry = navigationStack[entryIndex];
      if (entry && entry.returnDirection) {
        chosen = sorted.find((link) => link.direction === entry.returnDirection) || null;
      }
    }
  }

  if (!chosen) {
    for (const link of sorted) {
      const neighborKey = link.direction ? node.neighbors.get(link.direction) : null;
      if (neighborKey && hasUntriedDirections(neighborKey)) {
        chosen = link;
        break;
      }
    }
  }

  if (!chosen && sorted.length) {
    chosen = sorted[0];
  }

  if (!chosen) return null;

  const returnDirection = chosen.direction ? DIRECTION_OPPOSITES[chosen.direction] || null : null;
  pendingMove = {
    fromKey: locationKey,
    direction: chosen.direction || null,
    key: chosen.key,
    label: chosen.label,
    href: chosen.href || '',
    returnDirection,
  };
  if (node && !node.tried.has(chosen.key)) {
    node.tried.add(chosen.key);
  }

  const moveLabel = chosen.direction
    ? `${chosen.label}(${chosen.direction})`
    : chosen.label;
  return { el: chosen.el, label: moveLabel, direction: chosen.direction || null };
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
  clearNavigationState();
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
        pendingMove = null;
        return { el, label: '攻击景阳岗小大虫' };
      }
      return null;
    },
    () => {
      const el = byExact('攻击景阳岗大虫');
      if (el) {
        pendingMove = null;
        return { el, label: '攻击景阳岗大虫' };
      }
      return null;
    },
    () => {
      const el = byExact('景阳岗大虫');
      if (el) {
        pendingMove = null;
        return { el, label: '景阳岗大虫' };
      }
      return null;
    },
    () => {
      const el = byExact('景阳岗小大虫');
      if (el) {
        pendingMove = null;
        return { el, label: '景阳岗小大虫' };
      }
      return null;
    },
    () => {
      if (context.gather.length) {
        const pick = context.gather[0];
        pendingMove = null;
        return { el: pick.el, label: pick.label };
      }
      const arr = byIncludes('灵芝');
      if (arr && arr.length) {
        pendingMove = null;
        return { el: arr[0], label: '灵芝' };
      }
      return null;
    },
    () => {
      if (context.misc.length) {
        const ret = context.misc.find((item) => item.label.includes('返回'));
        if (ret) {
          pendingMove = null;
          return { el: ret.el, label: ret.label };
        }
      }
      const el = byExact('返回游戏');
      if (el) {
        pendingMove = null;
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
  clearNavigationState();
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
