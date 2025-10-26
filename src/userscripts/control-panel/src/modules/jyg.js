import { $, $$, formatTime, now, safeText } from '../dom.js';
import { loadBoolean, saveBoolean } from '../storage.js';

const SCAN_MS = 400;
const CLICK_COOLDOWN_MS = 1000;
const LS_ENABLED = 'jyg_enabled_v1';

let enabled = loadBoolean(LS_ENABLED);
let clickCount = 0;
let lastClickAt = 0;
let scanTimer = null;

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
    <div class="kv"><span class="label" data-label="上次点击"></span><span
        id="jyg-last"
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
  safeText($('#jyg-last'), formatTime(lastClickAt));
}

function pickTarget(anchors) {
  const byExact = (txt) => anchors.find((a) => a.textContent && a.textContent.trim() === txt);
  const byIncludes = (kw) => anchors.filter((a) => a.textContent && a.textContent.includes(kw));

  let target = byExact('攻击景阳岗小大虫');
  if (!target) target = byExact('攻击景阳岗大虫');
  if (!target) target = byExact('景阳岗大虫');
  if (!target) target = byExact('景阳岗小大虫');
  if (!target) {
    const arr = byIncludes('灵芝');
    target = arr && arr.length ? arr[0] : null;
  }
  if (!target) target = byExact('返回游戏');
  if (!target) {
    const woods = byIncludes('树林');
    if (woods && woods.length) {
      const idx = Math.floor(Math.random() * woods.length);
      target = woods[idx];
    }
  }
  return target;
}

function start() {
  stop();
  scanTimer = setInterval(() => {
    if (!enabled) return;
    if (now() - lastClickAt < CLICK_COOLDOWN_MS) return;
    const anchors = $$('a');
    if (!anchors.length) return;
    const target = pickTarget(anchors);
    if (target) {
      target.click();
      clickCount += 1;
      lastClickAt = now();
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
  mountUI();
  if (enabled) {
    start();
  }
}

export function pause() {
  stop();
}

export function resume() {
  if (enabled) {
    start();
  }
}
