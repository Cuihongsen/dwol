import { $, $$, formatTime, now, safeText } from '../../dom.js';
import { loadBoolean, loadJSON, saveBoolean, saveJSON } from '../../storage.js';
import { emitModuleState } from '../../events.js';
import {
  createNavigator,
  computeLocationKey,
  canonicalizeHref,
  parseDirectionalLabel,
} from './navigation.js';

const SCAN_MS = 400;
const CLICK_COOLDOWN_MS = 1000;
const LOOT_BLOCK_REGEX = /捡到[^\n\r]*/g;
const LOOT_ITEM_REGEX = /(.+?)x(\d+)$/;

function defaultExtractLocationHint(keywords = []) {
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
  const normalizedKeywords = Array.isArray(keywords)
    ? keywords.filter((kw) => typeof kw === 'string' && kw)
    : [];
  for (const line of lines) {
    if (normalizedKeywords.some((kw) => line.includes(kw))) {
      return line.slice(0, 80);
    }
  }
  return lines.length ? lines[0].slice(0, 80) : '';
}

function createTargetRuleHelpers({ navigator, selectNavigationMove }) {
  const textContent = (node) => (node && node.textContent ? node.textContent.trim() : '');
  return {
    byExact(text, { label = text, markMoveFailure = true } = {}) {
      return ({ anchors }) => {
        const target = anchors.find((anchor) => textContent(anchor) === text);
        if (!target) return null;
        if (markMoveFailure) navigator.markMoveFailure();
        return { el: target, label };
      };
    },
    byIncludes(keyword, { label = keyword, markMoveFailure = true } = {}) {
      return ({ anchors }) => {
        const target = anchors.find(
          (anchor) => anchor && anchor.textContent && anchor.textContent.includes(keyword)
        );
        if (!target) return null;
        if (markMoveFailure) navigator.markMoveFailure();
        return { el: target, label };
      };
    },
    byContextFirst(group, { markMoveFailure = true } = {}) {
      return ({ context }) => {
        const list = context[group];
        if (!Array.isArray(list) || !list.length) return null;
        const pick = list[0];
        if (!pick) return null;
        if (markMoveFailure) navigator.markMoveFailure();
        return { el: pick.el, label: pick.label };
      };
    },
    byContextFind(group, predicate, { markMoveFailure = true, label } = {}) {
      return ({ context }) => {
        const list = context[group];
        if (!Array.isArray(list) || !list.length) return null;
        const found = typeof predicate === 'function' ? list.find(predicate) : list[0];
        if (!found) return null;
        if (markMoveFailure) navigator.markMoveFailure();
        return { el: found.el, label: label || found.label };
      };
    },
    navigationFallback() {
      return ({ context }) => selectNavigationMove(context);
    },
  };
}

export function createMapModule(config = {}) {
  const { moduleId, storageKeys = {}, ui = {}, telemetryTag, navigation = {} } = config;
  if (!moduleId) {
    throw new Error('createMapModule requires a moduleId');
  }
  if (!storageKeys.enabled || !storageKeys.stats) {
    throw new Error('createMapModule requires storageKeys.enabled and storageKeys.stats');
  }
  if (!navigation.storageKey) {
    throw new Error('createMapModule requires navigation.storageKey');
  }
  if (typeof navigation.classifyAnchor !== 'function') {
    throw new Error('createMapModule requires navigation.classifyAnchor');
  }

  const prefix = ui.prefix || moduleId;
  const statsLegacyKeys = Array.isArray(storageKeys.legacy) ? storageKeys.legacy : [];
  const logTag = telemetryTag || moduleId.toUpperCase();

  const navigator = createNavigator({
    storageKey: navigation.storageKey,
    logger: navigation.logger,
    tag: navigation.tag || logTag,
  });

  const selectMove = (context) =>
    navigator.selectNavigationMove({
      movement: context.movement,
      locationKey: context.locationKey,
    });

  const targetHelpers = createTargetRuleHelpers({ navigator, selectNavigationMove: selectMove });
  let targetingRules = [];
  if (Array.isArray(config.targetingRules)) {
    targetingRules = config.targetingRules;
  } else if (typeof config.buildTargetingRules === 'function') {
    const built = config.buildTargetingRules(targetHelpers);
    targetingRules = Array.isArray(built) ? built : [];
  }
  if (!targetingRules.length) {
    targetingRules = [targetHelpers.navigationFallback()];
  }

  const normalizeLabel =
    typeof navigation.normalizeLabel === 'function'
      ? navigation.normalizeLabel
      : (label, text) => label || text;

  const extractHint =
    typeof config.extractLocationHint === 'function'
      ? config.extractLocationHint
      : () => defaultExtractLocationHint(config.locationHintKeywords);

  let enabled = loadBoolean(storageKeys.enabled);
  let scanCount = 0;
  let clickCount = 0;
  let lastClickAt = 0;
  let lastTarget = '-';
  let targetBreakdown = {};
  let lootTotals = {};
  let seenLoot = new Set();
  let scanTimer = null;
  let lastTelemetryDigest = null;

  function loadStats() {
    let stats = loadJSON(storageKeys.stats);
    if (!stats) {
      for (const key of statsLegacyKeys) {
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
    saveJSON(storageKeys.stats, {
      scanCount,
      clickCount,
      lastClickAt,
      lastTarget,
      targetBreakdown,
      lootTotals,
    });
  }

  function announceState() {
    emitModuleState({ moduleId, enabled });
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
    const body = $(`#${prefix}-body`);
    if (!body) return;
    body.innerHTML = `
    <div class="kv"><span class="label" data-label="状态"></span><span
        id="${prefix}-status"
        class="value state"
        data-state="${enabled ? 'on' : 'off'}"
      ></span></div>
    <div class="kv"><span class="label" data-label="点击次数"></span><span
        id="${prefix}-clicks"
        class="value"
        data-value="0"
      ></span></div>
    <div class="kv"><span class="label" data-label="上次目标"></span><span
        id="${prefix}-last-target"
        class="value"
        data-value="-"
      ></span></div>
    <div class="kv"><span class="label" data-label="上次点击"></span><span
        id="${prefix}-last"
        class="value"
        data-value="-"
      ></span></div>
    <div class="kv"><span class="label" data-label="轮询次数"></span><span
        id="${prefix}-scans"
        class="value"
        data-value="0"
      ></span></div>
    <div class="kv"><span class="label" data-label="目标统计"></span><span
        id="${prefix}-targets"
        class="value"
        data-value="-"
      ></span></div>
    <div class="kv"><span class="label" data-label="掉落统计"></span><span
        id="${prefix}-loot"
        class="value"
        data-value="-"
      ></span></div>
  `;
    const toggle = $(`#${prefix}-toggle`);
    if (toggle) {
      toggle.onclick = () => toggleEnabled();
    }
    const reset = $(`#${prefix}-reset`);
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
    console.info(`[${logTag}] 导航遥测`, {
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
    const status = $(`#${prefix}-status`);
    if (status) {
      status.dataset.state = enabled ? 'on' : 'off';
    }
    const toggle = $(`#${prefix}-toggle`);
    if (toggle) {
      toggle.dataset.mode = enabled ? 'on' : 'off';
      toggle.setAttribute('aria-pressed', enabled ? 'true' : 'false');
    }
    safeText($(`#${prefix}-clicks`), clickCount);
    safeText($(`#${prefix}-last-target`), lastTarget || '-');
    safeText($(`#${prefix}-last`), formatTime(lastClickAt));
    safeText($(`#${prefix}-scans`), scanCount);
    safeText($(`#${prefix}-targets`), formatBreakdown());
    safeText($(`#${prefix}-loot`), formatLoot());
    logTelemetry(navigator.getTelemetry());
  }

  function extractLocationHint() {
    return extractHint();
  }

  function buildNavigationContext(anchors) {
    const movement = [];
    const attack = [];
    const gather = [];
    const misc = [];

    for (const el of anchors) {
      const text = el && el.textContent ? el.textContent.trim() : '';
      if (!text) continue;
      const rawHref = el.getAttribute('href') || '';
      const href = canonicalizeHref(rawHref);
      const { direction, label } = parseDirectionalLabel(text);
      const normalizedLabel = normalizeLabel(label, text, el) || label || text;
      const base = {
        el,
        text,
        direction,
        href,
        rawLabel: label,
        normalizedLabel,
        label: normalizedLabel,
      };
      const classification = navigation.classifyAnchor({ ...base });
      const items = Array.isArray(classification)
        ? classification.filter(Boolean)
        : classification
        ? [classification]
        : [];
      for (const item of items) {
        const entry = {
          ...base,
          key: item.key || `${item.group || 'misc'}:${href || normalizedLabel}`,
          label: item.label || normalizedLabel,
        };
        switch (item.group) {
          case 'movement':
            movement.push(entry);
            break;
          case 'attack':
            attack.push(entry);
            break;
          case 'gather':
            gather.push(entry);
            break;
          case 'misc':
          default:
            misc.push(entry);
            break;
        }
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

  function pickTarget(context) {
    const params = { anchors: context.allAnchors, context };
    for (const rule of targetingRules) {
      if (typeof rule !== 'function') continue;
      const result = rule(params);
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
      if (result && result.el) {
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
    saveBoolean(storageKeys.enabled, true);
    start();
    updateUI();
    announceState();
  }

  function disable() {
    enabled = false;
    saveBoolean(storageKeys.enabled, false);
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

  function init() {
    loadStats();
    mountUI();
    announceState();
    if (enabled) {
      start();
    }
  }

  function pause() {
    stop();
    saveStats();
  }

  function resume() {
    if (enabled) {
      start();
    }
  }

  return {
    init,
    pause,
    resume,
  };
}
