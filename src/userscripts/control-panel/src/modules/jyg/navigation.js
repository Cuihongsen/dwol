import { now } from '../../dom.js';
import { loadJSON, saveJSON } from '../../storage.js';

const STORAGE_KEY = 'jyg_nav_state_v1';
const VOLATILE_QUERY_PARAMS = new Set(['sid']);

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

const EMPTY_NAV_STATE = () => ({
  nextLocationId: 1,
  aliasIndex: new Map(),
  nodes: new Map(),
});

function canonicalizeHref(href) {
  if (!href) return '';
  try {
    const url = new URL(href, 'https://invalid.example/');
    const params = new URLSearchParams(url.search);
    for (const key of Array.from(params.keys())) {
      if (VOLATILE_QUERY_PARAMS.has(key)) {
        params.delete(key);
      }
    }
    const ordered = Array.from(params.entries()).sort((a, b) => {
      if (a[0] === b[0]) {
        return a[1].localeCompare(b[1]);
      }
      return a[0].localeCompare(b[0]);
    });
    const normalizedParams = new URLSearchParams();
    for (const [key, value] of ordered) {
      normalizedParams.append(key, value);
    }
    const pathname = url.pathname.replace(/^\//, '');
    const query = normalizedParams.toString();
    const hash = url.hash || '';
    if (!pathname && !query && !hash) {
      return '';
    }
    return `${pathname}${query ? `?${query}` : ''}${hash}`;
  } catch (err) {
    return href;
  }
}

function canonicalizeMovement(movement = []) {
  return movement.map((link) => {
    const normalizedHref = canonicalizeHref(link && link.href);
    let key = link ? link.key : '';
    if (key && key.startsWith('move:') && normalizedHref) {
      key = `move:${normalizedHref}`;
    }
    return {
      ...link,
      href: normalizedHref,
      key,
    };
  });
}

function computeMovementSignature(movement = []) {
  if (!movement.length) return '';
  const parts = movement
    .map((link) => {
      const direction = link.direction || '';
      const href = link.href || '';
      const label = link.label || '';
      const key = link.key || '';
      return `${direction}|${href}|${label}|${key}`;
    })
    .sort();
  return parts.join('||');
}

function baseKeyIndex(baseKey) {
  return baseKey || '__no_key__';
}

function toMap(obj) {
  const map = new Map();
  if (!obj) return map;
  for (const [key, value] of Object.entries(obj)) {
    map.set(key, value);
  }
  return map;
}

function toSet(arr) {
  const set = new Set();
  if (!Array.isArray(arr)) return set;
  for (const value of arr) {
    set.add(value);
  }
  return set;
}

function serializeMap(map, transform = (value) => value) {
  const obj = {};
  if (!map) return obj;
  for (const [key, value] of map.entries()) {
    obj[key] = transform(value, key);
  }
  return obj;
}

function hashKey(str) {
  if (!str) return '';
  let hash = 0;
  for (let i = 0; i < str.length; i += 1) {
    hash = (hash * 31 + str.charCodeAt(i)) | 0;
  }
  return (hash >>> 0).toString(16);
}

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

function computeLocationKey(movement, hint) {
  const normalized = canonicalizeMovement(movement);
  const parts = normalized
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

function directionPriority(direction) {
  if (!direction) return PREFERRED_DIRECTION_ORDER.length + 1;
  const idx = PREFERRED_DIRECTION_ORDER.indexOf(direction);
  return idx === -1 ? PREFERRED_DIRECTION_ORDER.length : idx;
}

function hasUntriedDirections(node) {
  if (!node) return false;
  for (const key of node.linkMeta.keys()) {
    if (!node.tried.has(key)) {
      return true;
    }
  }
  return false;
}

function shortenHint(hint) {
  if (!hint) return '';
  return hint.length > 20 ? `${hint.slice(0, 20)}…` : hint;
}

function loadState(storageKey) {
  const raw = loadJSON(storageKey, null);
  if (!raw) {
    return EMPTY_NAV_STATE();
  }
  const state = {
    nextLocationId: Number(raw.nextLocationId) || 1,
    aliasIndex: new Map(),
    nodes: new Map(),
  };
  if (raw.aliasIndex && typeof raw.aliasIndex === 'object') {
    for (const [baseKey, aliases] of Object.entries(raw.aliasIndex)) {
      state.aliasIndex.set(baseKey, toSet(aliases));
    }
  }
  if (raw.nodes && typeof raw.nodes === 'object') {
    for (const [alias, node] of Object.entries(raw.nodes)) {
      const linkMeta = toMap(node.linkMeta);
      for (const meta of linkMeta.values()) {
        if (meta && meta.href) {
          meta.href = canonicalizeHref(meta.href);
        }
      }
      state.nodes.set(alias, {
        alias,
        baseKey: node.baseKey || null,
        baseHash: node.baseHash || null,
        lastHint: node.lastHint || null,
        movementSignature: node.movementSignature || '',
        neighbors: toMap(node.neighbors),
        linkMeta,
        tried: toSet(node.tried),
        visits: Number(node.visits) || 0,
        firstSeenAt: Number(node.firstSeenAt) || 0,
        lastSeenAt: Number(node.lastSeenAt) || 0,
      });
    }
  }
  return state;
}

function saveState(storageKey, state) {
  const data = {
    nextLocationId: state.nextLocationId,
    aliasIndex: serializeMap(state.aliasIndex, (set) => Array.from(set.values())),
    nodes: serializeMap(state.nodes, (node) => ({
      baseKey: node.baseKey,
      baseHash: node.baseHash,
      lastHint: node.lastHint,
      movementSignature: node.movementSignature,
      neighbors: serializeMap(node.neighbors),
      linkMeta: serializeMap(node.linkMeta),
      tried: Array.from(node.tried.values()),
      visits: node.visits,
      firstSeenAt: node.firstSeenAt,
      lastSeenAt: node.lastSeenAt,
    })),
  };
  saveJSON(storageKey, data);
}

function formatLocationName(node, { includeHint = true } = {}) {
  if (!node) return '-';
  const visitSuffix = node.visits ? `×${node.visits}` : '';
  const hashPart = node.baseHash ? ` [${node.baseHash}]` : '';
  if (!includeHint) {
    return `${node.alias}${visitSuffix}${hashPart}`;
  }
  const hint = shortenHint(node.lastHint);
  return hint
    ? `${node.alias}${visitSuffix}${hashPart} (${hint})`
    : `${node.alias}${visitSuffix}${hashPart}`;
}

function formatDirectionSummary(node, state) {
  if (!node) return '-';
  if (!node.linkMeta.size) return '-';
  const entries = Array.from(node.linkMeta.entries()).sort((a, b) => {
    const dirA = a[1].direction;
    const dirB = b[1].direction;
    return directionPriority(dirA) - directionPriority(dirB);
  });
  const parts = [];
  for (const [linkKey, meta] of entries) {
    const dir = meta.direction || '';
    const label = dir || meta.label || linkKey;
    const tried = node.tried.has(linkKey);
    const neighborKey = dir ? node.neighbors.get(dir) : null;
    const neighbor = neighborKey ? state.nodes.get(neighborKey) : null;
    const neighborLabel = neighbor
      ? formatLocationName(neighbor, { includeHint: false })
      : '';
    const suffix = neighborLabel ? `→${neighborLabel}` : '';
    parts.push(`${label}${dir ? '' : '(?)'}:${tried ? '✓' : '·'}${suffix}`);
  }
  return parts.join(' / ');
}

function reconstructStackSummary(stack, state) {
  if (!stack.length) return '-';
  return stack
    .map(({ nodeKey }) => {
      const node = nodeKey ? state.nodes.get(nodeKey) : null;
      return node ? formatLocationName(node) : nodeKey || '-';
    })
    .join(' → ');
}

function formatPendingAction(pendingMove, lastAction, state) {
  const describe = (info) => {
    if (!info) return '-';
    const fromNode = info.fromKey ? state.nodes.get(info.fromKey) : null;
    const origin = fromNode
      ? formatLocationName(fromNode, { includeHint: false })
      : info.fromKey || '-';
    const dir = info.direction ? `(${info.direction})` : '';
    const label = info.label || info.key || '-';
    return `${origin || '-'}→${label}${dir}`;
  };
  if (pendingMove) {
    return describe(pendingMove);
  }
  if (lastAction) {
    return describe(lastAction);
  }
  return '-';
}

function formatPlannedRoute(route, state) {
  if (!route.length) return '-';
  const parts = [];
  for (const step of route) {
    const fromNode = step.from ? state.nodes.get(step.from) : null;
    const toNode = step.to ? state.nodes.get(step.to) : null;
    const fromLabel = fromNode
      ? formatLocationName(fromNode, { includeHint: false })
      : step.from || '-';
    const toLabel = toNode
      ? formatLocationName(toNode, { includeHint: false })
      : step.to || '-';
    const dir = step.direction ? `(${step.direction})` : '';
    parts.push(`${fromLabel}${dir}→${toLabel}`);
  }
  return parts.join(' / ');
}

export function createNavigator({ storageKey = STORAGE_KEY, logger = console } = {}) {
  let state = loadState(storageKey);
  let currentLocationKey = null;
  let pendingMove = null;
  let lastNavigationAction = null;
  let navigationStack = [];
  let plannedRoute = [];

  const persist = () => {
    saveState(storageKey, state);
  };

  const ensureNode = (alias) => {
    if (!alias) return null;
    let node = state.nodes.get(alias);
    if (!node) {
      node = {
        alias,
        baseKey: null,
        baseHash: null,
        lastHint: null,
        movementSignature: '',
        neighbors: new Map(),
        linkMeta: new Map(),
        tried: new Set(),
        visits: 0,
        firstSeenAt: 0,
        lastSeenAt: 0,
      };
      state.nodes.set(alias, node);
    }
    return node;
  };

  const registerAlias = (alias, baseKey) => {
    if (!alias) return;
    const indexKey = baseKeyIndex(baseKey);
    let set = state.aliasIndex.get(indexKey);
    if (!set) {
      set = new Set();
      state.aliasIndex.set(indexKey, set);
    }
    set.add(alias);
  };

  const createAlias = (baseKey, hint) => {
    const alias = `loc#${state.nextLocationId++}`;
    if (logger && typeof logger.debug === 'function') {
      const preview = baseKey && baseKey.length > 120 ? `${baseKey.slice(0, 117)}…` : baseKey;
      logger.debug('[JYG] 创建新位置', alias, {
        baseKey: preview,
        hint,
      });
    }
    registerAlias(alias, baseKey);
    ensureNode(alias);
    persist();
    return alias;
  };

  const resolveLocationAlias = (baseKey, hint, fromKey, direction, movement) => {
    if (!baseKey) return null;
    const indexKey = baseKeyIndex(baseKey);
    const aliasSet = state.aliasIndex.get(indexKey);
    const movementSignature = computeMovementSignature(movement);
    if (fromKey && direction) {
      const fromNode = state.nodes.get(fromKey);
      if (fromNode) {
        const knownNeighbor = fromNode.neighbors.get(direction);
        if (knownNeighbor) {
          registerAlias(knownNeighbor, baseKey);
          return knownNeighbor;
        }
      }
    }
    const pickByRecency = (candidates) => {
      if (!candidates || !candidates.length) {
        return null;
      }
      if (candidates.length === 1) {
        return candidates[0];
      }
      const ordered = candidates
        .map((alias) => state.nodes.get(alias))
        .filter(Boolean)
        .sort((a, b) => (b.lastSeenAt || 0) - (a.lastSeenAt || 0));
      return ordered.length ? ordered[0].alias : candidates[0];
    };

    if (aliasSet && aliasSet.size) {
      if (fromKey && direction) {
        const opposite = DIRECTION_OPPOSITES[direction] || null;
        if (opposite) {
          for (const alias of aliasSet.values()) {
            const node = state.nodes.get(alias);
            if (node && node.neighbors.get(opposite) === fromKey) {
              registerAlias(alias, baseKey);
              return alias;
            }
          }
        }
      }

      let candidates = Array.from(aliasSet.values());
      if (movementSignature) {
        const signatureMatches = candidates.filter((alias) => {
          const node = state.nodes.get(alias);
          return node && node.movementSignature === movementSignature;
        });
        if (signatureMatches.length === 1) {
          registerAlias(signatureMatches[0], baseKey);
          if (logger && typeof logger.debug === 'function') {
            logger.debug('[JYG] 通过出入口指纹校准位置', signatureMatches[0], {
              baseHash: hashKey(baseKey),
            });
          }
          return signatureMatches[0];
        }
        if (signatureMatches.length) {
          candidates = signatureMatches;
        }
      }

      if (hint) {
        const hintMatches = candidates.filter((alias) => {
          const node = state.nodes.get(alias);
          return node && node.lastHint === hint;
        });
        if (hintMatches.length === 1) {
          registerAlias(hintMatches[0], baseKey);
          if (logger && typeof logger.debug === 'function') {
            logger.debug('[JYG] 通过地点提示校准位置', hintMatches[0], {
              baseHash: hashKey(baseKey),
              hint,
            });
          }
          return hintMatches[0];
        }
        if (hintMatches.length) {
          candidates = hintMatches;
        }
      }

      const resolved = pickByRecency(candidates);
      if (resolved) {
        registerAlias(resolved, baseKey);
        if (logger && typeof logger.debug === 'function') {
          logger.debug('[JYG] 通过最近访问记录推断位置', resolved, {
            baseHash: hashKey(baseKey),
          });
        }
        return resolved;
      }

      if (logger && typeof logger.warn === 'function') {
        logger.warn('[JYG] 无法根据邻接关系解析位置，创建新别名', {
          baseHash: hashKey(baseKey),
          fromKey,
          direction,
          aliasCount: aliasSet.size,
          movementSignature,
          hint,
        });
      }
      return createAlias(baseKey, hint);
    }
    const firstAlias = aliasSet && aliasSet.size ? aliasSet.values().next().value : null;
    if (firstAlias) {
      registerAlias(firstAlias, baseKey);
      return firstAlias;
    }
    return createAlias(baseKey, hint);
  };

  const alignNavigationStack = (fromKey, toKey, viaDirection) => {
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
  };

  const calibrateNeighbors = (node, movement) => {
    const timestamp = now();
    const seen = new Set();
    node.movementSignature = computeMovementSignature(movement);
    for (const link of movement) {
      seen.add(link.key);
      let meta = node.linkMeta.get(link.key);
      if (!meta) {
        meta = {};
        node.linkMeta.set(link.key, meta);
      }
      meta.direction = link.direction || meta.direction || null;
      meta.label = link.label || meta.label || link.key;
      meta.href = canonicalizeHref(link.href) || meta.href || '';
      meta.lastSeenAt = timestamp;
    }
    for (const key of Array.from(node.linkMeta.keys())) {
      if (!seen.has(key)) {
        node.linkMeta.delete(key);
        node.tried.delete(key);
      }
    }
    for (const [direction] of Array.from(node.neighbors.entries())) {
      if (!movement.some((link) => link.direction === direction)) {
        node.neighbors.delete(direction);
      }
    }
  };

  const resetRuntime = () => {
    currentLocationKey = null;
    pendingMove = null;
    lastNavigationAction = null;
    navigationStack = [];
    plannedRoute = [];
  };

  const resetAll = () => {
    state = EMPTY_NAV_STATE();
    resetRuntime();
    persist();
  };

  const handleContext = ({ baseLocationKey, movement, hint }) => {
    if (!baseLocationKey) {
      resetRuntime();
      return null;
    }
    const fromKey = pendingMove ? pendingMove.fromKey : null;
    const moveDirection = pendingMove ? pendingMove.direction : null;
    const normalizedMovement = canonicalizeMovement(movement);
    const resolvedKey = resolveLocationAlias(
      baseLocationKey,
      hint,
      fromKey,
      moveDirection,
      normalizedMovement
    );
    if (!resolvedKey) {
      resetRuntime();
      return null;
    }
    const node = ensureNode(resolvedKey);
    if (baseLocationKey) {
      node.baseKey = baseLocationKey;
      node.baseHash = hashKey(baseLocationKey);
    }
    if (hint) {
      node.lastHint = hint;
    }
    const timestamp = now();
    if (node.visits === 0) {
      node.firstSeenAt = timestamp;
    }
    if (node.visits === 0 || resolvedKey !== currentLocationKey) {
      node.visits += 1;
    }
    node.lastSeenAt = timestamp;
    calibrateNeighbors(node, normalizedMovement);
    if (pendingMove && pendingMove.fromKey) {
      const prevNode = ensureNode(pendingMove.fromKey);
      if (pendingMove.key) {
        prevNode.tried.add(pendingMove.key);
      }
      if (pendingMove.direction) {
        prevNode.neighbors.set(pendingMove.direction, resolvedKey);
      }
    }
    if (pendingMove && pendingMove.direction) {
      const opposite = DIRECTION_OPPOSITES[pendingMove.direction];
      if (opposite) {
        const here = ensureNode(resolvedKey);
        here.neighbors.set(opposite, pendingMove.fromKey || null);
      }
    }
    alignNavigationStack(pendingMove ? pendingMove.fromKey : null, resolvedKey, moveDirection);
    pendingMove = null;
    currentLocationKey = resolvedKey;
    persist();
    return resolvedKey;
  };

  const findRouteToUntried = (startKey) => {
    if (!startKey) return [];
    const startNode = state.nodes.get(startKey);
    if (!startNode) return [];
    if (hasUntriedDirections(startNode)) {
      return [];
    }
    const visited = new Set([startKey]);
    const queue = [startKey];
    const prev = new Map();
    let target = null;
    while (queue.length) {
      const key = queue.shift();
      const node = state.nodes.get(key);
      if (!node) continue;
      if (key !== startKey && hasUntriedDirections(node)) {
        target = key;
        break;
      }
      for (const [direction, neighborKey] of node.neighbors.entries()) {
        if (!neighborKey) continue;
        if (visited.has(neighborKey)) continue;
        if (!state.nodes.has(neighborKey)) continue;
        visited.add(neighborKey);
        prev.set(neighborKey, { prev: key, direction });
        queue.push(neighborKey);
      }
    }
    if (!target) return [];
    const steps = [];
    let cursor = target;
    while (cursor !== startKey) {
      const entry = prev.get(cursor);
      if (!entry) break;
      steps.push({ from: entry.prev, direction: entry.direction, to: cursor });
      cursor = entry.prev;
    }
    steps.reverse();
    return steps;
  };

  const selectNavigationMove = ({ movement, locationKey }) => {
    if (!movement.length || !locationKey) return null;
    const normalizedMovement = canonicalizeMovement(movement);
    const node = state.nodes.get(locationKey);
    if (!node) return null;
    plannedRoute = plannedRoute.filter((step) => state.nodes.has(step.from) && state.nodes.has(step.to));
    if (!plannedRoute.length || plannedRoute[0].from !== locationKey) {
      plannedRoute = findRouteToUntried(locationKey);
    }
    if (plannedRoute.length) {
      const step = plannedRoute.shift();
      const link = normalizedMovement.find(
        (item) => item.direction === step.direction && node.neighbors.get(step.direction) === step.to
      );
      if (link) {
        const returnDirection = step.direction ? DIRECTION_OPPOSITES[step.direction] || null : null;
        pendingMove = {
          fromKey: locationKey,
          direction: step.direction || null,
          key: link.key,
          label: link.label,
          href: link.href || '',
          returnDirection,
        };
        lastNavigationAction = {
          fromKey: locationKey,
          direction: step.direction || null,
          label: link.direction ? `${link.label}(${link.direction})` : link.label,
        };
        const moveLabel = link.direction ? `${link.label}(${link.direction})` : link.label;
        return { el: link.el, label: moveLabel, direction: link.direction || null };
      }
      plannedRoute = [];
    }
    const sorted = [...normalizedMovement].sort(
      (a, b) => directionPriority(a.direction) - directionPriority(b.direction)
    );
    const untried = sorted.filter((link) => !node.tried.has(link.key));
    let chosen = untried.length ? untried[0] : null;
    if (!chosen) {
      for (const link of sorted) {
        const neighborKey = link.direction ? node.neighbors.get(link.direction) : null;
        if (neighborKey) {
          const neighbor = state.nodes.get(neighborKey);
          if (neighbor && hasUntriedDirections(neighbor)) {
            chosen = link;
            break;
          }
        }
      }
    }
    if (!chosen && sorted.length) {
      chosen = sorted[0];
    }
    if (!chosen) return null;
    plannedRoute = [];
    const returnDirection = chosen.direction ? DIRECTION_OPPOSITES[chosen.direction] || null : null;
    pendingMove = {
      fromKey: locationKey,
      direction: chosen.direction || null,
      key: chosen.key,
      label: chosen.label,
      href: chosen.href || '',
      returnDirection,
    };
    lastNavigationAction = {
      fromKey: locationKey,
      direction: chosen.direction || null,
      label: chosen.direction ? `${chosen.label}(${chosen.direction})` : chosen.label,
    };
    const moveLabel = chosen.direction ? `${chosen.label}(${chosen.direction})` : chosen.label;
    return {
      el: chosen.el,
      label: moveLabel,
      direction: chosen.direction || null,
    };
  };

  const getTelemetry = () => {
    const node = currentLocationKey ? state.nodes.get(currentLocationKey) : null;
    return {
      currentLocationKey,
      locationLabel: node ? formatLocationName(node) : '-',
      directionSummary: formatDirectionSummary(node, state),
      stackSummary: reconstructStackSummary(navigationStack, state),
      pendingAction: formatPendingAction(pendingMove, lastNavigationAction, state),
      locationCount: state.nodes.size,
      plannedRoute: formatPlannedRoute(plannedRoute, state),
    };
  };

  const markMoveFailure = () => {
    pendingMove = null;
    plannedRoute = [];
  };

  return {
    resetRuntime,
    resetAll,
    handleContext,
    selectNavigationMove,
    getTelemetry,
    parseDirectionalLabel,
    computeLocationKey,
    markMoveFailure,
    get currentLocationKey() {
      return currentLocationKey;
    },
  };
}

export {
  DIRECTION_OPPOSITES,
  PREFERRED_DIRECTION_ORDER,
  parseDirectionalLabel,
  computeLocationKey,
  canonicalizeHref,
};

