import { $$ } from './dom.js';
import { loadBoolean, saveBoolean } from './storage.js';

// Global throttle watcher: when the page shows the anti-frequent-access warning,
// pause all running modules, wait briefly, auto-click the "继续" link, and resume.
const WATCH_INTERVAL_MS = 300;
const CONTINUE_DELAY_MS = 1000;
const LS_ENABLED = 'watchdog_enabled_v1';

const listeners = new Set();

let enabled = loadBoolean(LS_ENABLED, true);
let throttled = false;
let watchTimer = null;
let continueTimer = null;
let boundModules = [];

function notifyListeners() {
  listeners.forEach((fn) => {
    try {
      fn(enabled);
    } catch (error) {
      // ignore listener errors to avoid breaking the watchdog
    }
  });
}

export function isWatchdogEnabled() {
  return enabled;
}

export function setWatchdogEnabled(nextEnabled) {
  enabled = Boolean(nextEnabled);
  saveBoolean(LS_ENABLED, enabled);
  if (!enabled) {
    throttled = false;
    if (continueTimer) {
      clearTimeout(continueTimer);
      continueTimer = null;
    }
    boundModules.forEach((mod) => mod.resume?.());
  }
  notifyListeners();
}

export function subscribeWatchdogState(listener) {
  if (typeof listener !== 'function') return () => {};
  listeners.add(listener);
  listener(enabled);
  return () => listeners.delete(listener);
}

export function startWatchdog(modules) {
  boundModules = Array.isArray(modules) ? modules : [];
  if (watchTimer) clearInterval(watchTimer);
  watchTimer = setInterval(() => {
    if (!enabled || throttled) return;
    const text = document.body ? document.body.innerText : '';
    if (text.indexOf('您的点击频度过快') >= 0) {
      throttled = true;
      boundModules.forEach((mod) => mod.pause?.());
      continueTimer = setTimeout(() => {
        const cont = $$('a').find(
          (el) => el.textContent && el.textContent.trim() === '继续'
        );
        if (cont) cont.click();
        throttled = false;
        boundModules.forEach((mod) => mod.resume?.());
        notifyListeners();
      }, CONTINUE_DELAY_MS);
      notifyListeners();
    }
  }, WATCH_INTERVAL_MS);
  notifyListeners();
}
