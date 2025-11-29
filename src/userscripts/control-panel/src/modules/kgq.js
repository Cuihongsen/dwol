import { $, formatTime, now, safeText } from '../dom.js';
import { emitModuleState } from '../events.js';
import { loadBoolean, loadJSON, saveBoolean, saveJSON } from '../storage.js';
import { parseDirectionalLabel } from './jyg/navigation.js';

const MOVE_INTERVAL_MS = 800;
const MODULE_ID = 'kgq';
const LS_ENABLED = 'kgq_enabled_v1';
const LS_SIZE = 'kgq_size_v1';
const LS_STATS = 'kgq_stats_v1';
const TOKEN_TEXT = '[金刚圈]';
const MAP_SIZES = [3, 5, 7, 9, 11, 13];

let enabled = loadBoolean(LS_ENABLED);
let size = loadSize();
let route = buildRoute(size);
let moveTimer = null;
let stepIndex = 0;
let moveCount = 0;
let lastDirection = '-';
let lastMoveAt = 0;

function loadSize() {
  const stored = Number(localStorage.getItem(LS_SIZE));
  const normalized = normalizeSize(Number.isFinite(stored) ? stored : null);
  return normalized;
}

function saveSize(value) {
  localStorage.setItem(LS_SIZE, String(value));
}

function normalizeSize(value) {
  const fallback = MAP_SIZES[1] || 5;
  const candidate = Number.isFinite(value) ? Math.max(3, Math.floor(value)) : fallback;
  return candidate % 2 === 0 ? candidate + 1 : candidate;
}

function loadStats() {
  const stats = loadJSON(LS_STATS);
  if (!stats) return;
  const loadedIndex = Number(stats.stepIndex) || 0;
  moveCount = Number(stats.moveCount) || 0;
  lastDirection = stats.lastDirection ? String(stats.lastDirection) : '-';
  lastMoveAt = typeof stats.lastMoveAt === 'number' ? stats.lastMoveAt : 0;
  stepIndex = route.length ? Math.min(loadedIndex, route.length - 1) : 0;
}

function saveStats() {
  saveJSON(LS_STATS, { stepIndex, moveCount, lastDirection, lastMoveAt });
}

function resetStats() {
  stepIndex = 0;
  moveCount = 0;
  lastDirection = '-';
  lastMoveAt = 0;
  saveStats();
  updateUI();
}

function announceState() {
  emitModuleState({ moduleId: MODULE_ID, enabled });
}

function shouldContinue() {
  const body = document.body ? document.body.innerText : '';
  return body.includes(TOKEN_TEXT);
}

function directionDelta(direction) {
  switch (direction) {
    case '上':
      return { dx: 0, dy: -1 };
    case '下':
      return { dx: 0, dy: 1 };
    case '左':
      return { dx: -1, dy: 0 };
    case '右':
      return { dx: 1, dy: 0 };
    default:
      return { dx: 0, dy: 0 };
  }
}

function buildRoute(sizeValue) {
  const limit = Math.max(1, Math.floor(normalizeSize(sizeValue) / 2));
  const targetSteps = normalizeSize(sizeValue) * normalizeSize(sizeValue) - 1;
  const directions = ['右', '下', '左', '上'];
  let stepLength = 1;
  let directionIndex = 0;
  const steps = [];
  let posX = 0;
  let posY = 0;
  let guard = 0;

  const appendSteps = (direction, count) => {
    const { dx, dy } = directionDelta(direction);
    for (let i = 0; i < count; i += 1) {
      const nextX = posX + dx;
      const nextY = posY + dy;
      if (Math.abs(nextX) > limit || Math.abs(nextY) > limit) {
        break;
      }
      posX = nextX;
      posY = nextY;
      steps.push(direction);
      if (steps.length >= targetSteps) {
        return true;
      }
    }
    return false;
  };

  while (steps.length < targetSteps && guard < targetSteps * 2) {
    const dirA = directions[directionIndex % directions.length];
    if (appendSteps(dirA, stepLength)) break;
    directionIndex += 1;

    const dirB = directions[directionIndex % directions.length];
    if (appendSteps(dirB, stepLength)) break;
    directionIndex += 1;

    stepLength += 1;
    guard += 1;
  }

  return steps;
}

function matchDirection(el, direction) {
  if (!el) return false;
  const dataDir = el.dataset && el.dataset.direction ? el.dataset.direction.trim() : '';
  if (dataDir === direction) return true;
  const text = el.textContent ? el.textContent.trim() : '';
  if (!text) return false;
  if (text === direction) return true;
  const parsed = parseDirectionalLabel(text);
  return parsed.direction === direction;
}

function findDirectionAnchor(direction) {
  const anchors = [];
  const mapContainer = document.querySelector('#ly_map');
  if (mapContainer) {
    anchors.push(...mapContainer.querySelectorAll('a'));
  }
  anchors.push(...document.querySelectorAll('a'));

  return anchors.find((anchor) => matchDirection(anchor, direction));
}

function clickDirection(direction) {
  const anchor = findDirectionAnchor(direction);
  if (!anchor) return false;
  anchor.click();
  return true;
}

function startMoving() {
  stopMoving();
  moveTimer = setInterval(() => {
    if (!shouldContinue()) return;
    if (!route.length) return;

    const direction = route[stepIndex] || '右';
    const clicked = clickDirection(direction);
    if (!clicked) return;

    lastDirection = direction;
    lastMoveAt = now();
    moveCount += 1;
    stepIndex = (stepIndex + 1) % route.length;
    saveStats();
    updateUI();
  }, MOVE_INTERVAL_MS);
}

function stopMoving() {
  if (moveTimer) clearInterval(moveTimer);
  moveTimer = null;
}

function enable() {
  enabled = true;
  saveBoolean(LS_ENABLED, true);
  startMoving();
  updateUI();
  announceState();
}

function disable() {
  enabled = false;
  saveBoolean(LS_ENABLED, false);
  stopMoving();
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

function handleSizeChange(next) {
  const normalized = normalizeSize(next);
  size = normalized;
  saveSize(size);
  route = buildRoute(size);
  resetStats();
}

function mountUI() {
  const body = $('#kgq-body');
  if (!body) return;
  body.innerHTML = `
    <div class="kv"><span class="label" data-label="状态"></span><span
        id="kgq-status"
        class="value state"
        data-state="${enabled ? 'on' : 'off'}"
      ></span></div>
    <div class="kv"><span class="label" data-label="地图边长"></span><span
        class="value"
      ><select id="kgq-size" aria-label="金刚圈 地图边长">
        ${MAP_SIZES.map((value) => `<option value="${value}">${value} x ${value}</option>`).join('')}
      </select></span></div>
    <div class="kv"><span class="label" data-label="总步数"></span><span
        id="kgq-total"
        class="value"
        data-value="0"
      ></span></div>
    <div class="kv"><span class="label" data-label="已走步数"></span><span
        id="kgq-progress"
        class="value"
        data-value="0"
      ></span></div>
    <div class="kv"><span class="label" data-label="当前方向"></span><span
        id="kgq-direction"
        class="value"
        data-value="-"
      ></span></div>
    <div class="kv"><span class="label" data-label="上次移动"></span><span
        id="kgq-last"
        class="value"
        data-value="-"
      ></span></div>
  `;
  const toggle = $('#kgq-toggle');
  if (toggle) {
    toggle.onclick = () => toggleEnabled();
  }
  const reset = $('#kgq-reset');
  if (reset) {
    reset.onclick = () => resetStats();
  }
  const sizeSelect = $('#kgq-size');
  if (sizeSelect instanceof HTMLSelectElement) {
    sizeSelect.onchange = () => {
      const nextSize = Number(sizeSelect.value);
      if (!Number.isFinite(nextSize)) return;
      handleSizeChange(nextSize);
      if (enabled) {
        startMoving();
      }
    };
  }
  updateUI();
}

function updateUI() {
  const status = $('#kgq-status');
  if (status) {
    status.dataset.state = enabled ? 'on' : 'off';
  }
  const toggle = $('#kgq-toggle');
  if (toggle) {
    toggle.dataset.mode = enabled ? 'on' : 'off';
    toggle.setAttribute('aria-pressed', enabled ? 'true' : 'false');
  }
  const sizeSelect = $('#kgq-size');
  if (sizeSelect instanceof HTMLSelectElement) {
    const normalized = normalizeSize(size);
    if (!MAP_SIZES.includes(normalized)) {
      const opt = document.createElement('option');
      opt.value = String(normalized);
      opt.textContent = `${normalized} x ${normalized}`;
      sizeSelect.appendChild(opt);
    }
    sizeSelect.value = String(normalized);
  }
  safeText($('#kgq-total'), route.length);
  safeText($('#kgq-progress'), moveCount);
  safeText($('#kgq-direction'), lastDirection);
  safeText($('#kgq-last'), formatTime(lastMoveAt));
}

export function init() {
  loadStats();
  mountUI();
  announceState();
  if (enabled) {
    startMoving();
  }
}

export function pause() {
  stopMoving();
}

export function resume() {
  if (enabled) {
    startMoving();
  }
}
