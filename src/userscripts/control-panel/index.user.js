// ==UserScript==
// @name         刷新马 + 景阳岗控制面板（含限速检测, 继续为a标签）
// @namespace    http://tampermonkey.net/
// @version      1.5
// @description  模块化控制面板：刷新马 & 景阳岗模块默认关闭且开关持久化；出现“您的点击频度过快”时暂停并在1秒后自动点文本为“继续”的<a>再恢复；景阳岗模块优先检测带“攻击”的项
// @match        http://81.68.161.24/*
// @grant        none
// ==/UserScript==

(() => {
  var __defProp = Object.defineProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };

  // src/userscripts/control-panel/src/dom.js
  var $ = (selector, root = document) => root.querySelector(selector);
  var $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  var safeText = (el, text) => {
    if (!el) return;
    el.textContent = "";
    if (text === void 0 || text === null) {
      el.removeAttribute("data-value");
      return;
    }
    el.setAttribute("data-value", String(text));
  };
  var now = () => Date.now();
  var formatTime = (timestamp) => timestamp ? new Date(timestamp).toLocaleTimeString() : "-";

  // src/userscripts/control-panel/src/panel.js
  var PANEL_STYLE_ID = "um-style";
  var PANEL_ID = "um-panel";
  var PANEL_STYLE = `
#um-panel{position:fixed;right:18px;bottom:18px;width:340px;z-index:2147483647;font:13px/1.5 'Inter',system-ui,-apple-system,'PingFang SC',sans-serif;color:#e2e8f0;background:radial-gradient(circle at 20% -10%,rgba(56,189,248,.32),transparent 55%),linear-gradient(135deg,rgba(15,23,42,.94),rgba(30,41,59,.92));border:1px solid rgba(148,163,184,.35);border-radius:18px;box-shadow:0 28px 60px rgba(15,23,42,.55);backdrop-filter:blur(18px);overflow:hidden}
#um-panel::after{content:'';position:absolute;inset:1px;border-radius:16px;pointer-events:none;background:linear-gradient(130deg,rgba(148,163,184,.18),rgba(96,165,250,.08) 35%,transparent 65%)}
#um-panel .sec{position:relative;border-top:1px solid rgba(148,163,184,.14)}
#um-panel .sec:first-child{border-top:none}
#um-panel .hdr{display:flex;align-items:center;justify-content:space-between;padding:16px 20px 14px;background:rgba(15,23,42,.55)}
#um-panel .hdr b{position:relative;font-weight:600;letter-spacing:.04em}
#um-panel .hdr b::before{content:attr(data-label);display:block;color:#cbd5f5;text-shadow:0 0 12px rgba(148,163,184,.35)}
#um-panel .hdr button{position:relative;min-width:84px;padding:6px 18px;border-radius:999px;border:1px solid rgba(94,234,212,.45);background:linear-gradient(135deg,rgba(45,212,191,.2),rgba(59,130,246,.2));box-shadow:inset 0 1px 0 rgba(255,255,255,.12);cursor:pointer;color:#f8fafc;transition:all .25s ease}
#um-panel .hdr button:hover{border-color:rgba(94,234,212,.7);box-shadow:inset 0 1px 0 rgba(255,255,255,.22),0 6px 16px rgba(14,116,144,.25);transform:translateY(-1px)}
#um-panel .hdr button:active{transform:translateY(0)}
#um-panel .hdr button::before{content:'';font-weight:600;letter-spacing:.08em}
#um-panel .hdr button[data-mode="on"]::before{content:'\u5173\u95ED'}
#um-panel .hdr button[data-mode="off"]::before{content:'\u5F00\u542F'}
#um-panel .body{padding:14px 20px 18px;display:grid;gap:12px;background:rgba(15,23,42,.32)}
#um-panel .kv{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:8px 0}
#um-panel .kv:not(:last-child){border-bottom:1px dashed rgba(148,163,184,.15)}
#um-panel .kv .label::before{content:attr(data-label);color:#94a3b8;font-size:12px;letter-spacing:.04em}
#um-panel .kv .value{position:relative;font-variant-numeric:tabular-nums}
#um-panel .kv .value::before{content:attr(data-value);color:#f8fafc;font-size:13px}
#um-panel .kv .state[data-state="on"]::before{content:'\u8FD0\u884C\u4E2D';color:#34d399;font-weight:600;text-shadow:0 0 12px rgba(52,211,153,.35)}
#um-panel .kv .state[data-state="off"]::before{content:'\u5173\u95ED\u4E2D';color:#f87171;font-weight:600;text-shadow:0 0 10px rgba(248,113,113,.32)}
#um-panel .hint::before{content:attr(data-label);color:#64748b;font-size:11px;letter-spacing:.04em}
`;
  function buildSection(title, idPrefix) {
    const sec = document.createElement("div");
    sec.className = "sec";
    const header = document.createElement("div");
    header.className = "hdr";
    const label = document.createElement("b");
    label.setAttribute("data-label", title);
    const toggle = document.createElement("button");
    toggle.id = `${idPrefix}-toggle`;
    toggle.type = "button";
    toggle.dataset.mode = "off";
    header.appendChild(label);
    header.appendChild(toggle);
    const body = document.createElement("div");
    body.className = "body";
    body.id = `${idPrefix}-body`;
    sec.appendChild(header);
    sec.appendChild(body);
    return sec;
  }
  function injectStyle() {
    if ($(`#${PANEL_STYLE_ID}`)) return;
    const style = document.createElement("style");
    style.id = PANEL_STYLE_ID;
    style.textContent = PANEL_STYLE;
    document.head.appendChild(style);
  }
  function ensurePanel() {
    if ($(`#${PANEL_ID}`)) return;
    const panel = document.createElement("div");
    panel.id = PANEL_ID;
    panel.appendChild(buildSection("\u5237\u65B0\u9A6C", "rm"));
    panel.appendChild(buildSection("\u666F\u9633\u5C97", "jyg"));
    document.body.appendChild(panel);
  }

  // src/userscripts/control-panel/src/modules/rm.js
  var rm_exports = {};
  __export(rm_exports, {
    init: () => init,
    pause: () => pause,
    resume: () => resume
  });

  // src/userscripts/control-panel/src/storage.js
  var loadBoolean = (key, defaultValue = false) => {
    const raw = localStorage.getItem(key);
    if (raw === null) return defaultValue;
    return raw === "1";
  };
  var saveBoolean = (key, value) => {
    localStorage.setItem(key, value ? "1" : "0");
  };
  var loadJSON = (key, fallback = void 0) => {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    try {
      return JSON.parse(raw);
    } catch (error) {
      return fallback;
    }
  };
  var saveJSON = (key, value) => {
    localStorage.setItem(key, JSON.stringify(value));
  };

  // src/userscripts/control-panel/src/modules/rm.js
  var REFRESH_MS = 2e3;
  var CHECK_MS = 2e3;
  var RESUME_DELAY_MS = 3e3;
  var TARGET_TEXT = "\u6C57\u8840\u5B9D\u9A6C";
  var TARGET_ALIAS = "\u76EE\u6807\u9A6C";
  var LS_STATS = "rm_stats_v1";
  var LS_PENDING_RETURN = "rm_pending_return_v1";
  var LS_ENABLED = "rm_enabled_v1";
  var enabled = loadBoolean(LS_ENABLED);
  var refreshCount = 0;
  var moveClickCount = 0;
  var lastTriggerTs = null;
  var foundCount = 0;
  var refreshInterval = null;
  var checkInterval = null;
  var actedThisRound = false;
  function loadStats() {
    const stats = loadJSON(LS_STATS);
    if (!stats) return;
    refreshCount = Number(stats.refreshCount) || 0;
    moveClickCount = Number(stats.moveClickCount) || 0;
    lastTriggerTs = typeof stats.lastTriggerTs === "number" ? stats.lastTriggerTs : null;
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
    const body = $("#rm-body");
    if (!body) return;
    body.innerHTML = `
    <div class="kv"><span class="label" data-label="\u72B6\u6001"></span><span
        id="rm-status"
        class="value state"
        data-state="${enabled ? "on" : "off"}"
      ></span></div>
    <div class="kv"><span class="label" data-label="\u5237\u65B0\u6B21\u6570"></span><span
        id="rm-refresh"
        class="value"
        data-value="0"
      ></span></div>
    <div class="kv"><span class="label" data-label="${TARGET_ALIAS} \u51FA\u73B0(\u5F53\u524D\u9875)"></span><span
        id="rm-found"
        class="value"
        data-value="0"
      ></span></div>
    <div class="kv"><span class="label" data-label="\u7275\u8D70\u6B21\u6570"></span><span
        id="rm-move"
        class="value"
        data-value="0"
      ></span></div>
    <div class="kv"><span class="label" data-label="\u4E0A\u6B21\u89E6\u53D1"></span><span
        id="rm-last"
        class="value"
        data-value="-"
      ></span></div>
  `;
    const toggle = $("#rm-toggle");
    if (toggle) {
      toggle.onclick = () => toggleEnabled();
    }
    updateUI();
  }
  function updateUI() {
    const status = $("#rm-status");
    if (status) {
      status.dataset.state = enabled ? "on" : "off";
    }
    const toggle = $("#rm-toggle");
    if (toggle) {
      toggle.dataset.mode = enabled ? "on" : "off";
    }
    safeText($("#rm-refresh"), refreshCount);
    safeText($("#rm-found"), foundCount);
    safeText($("#rm-move"), moveClickCount);
    safeText($("#rm-last"), formatTime(lastTriggerTs));
  }
  function startRefreshing() {
    stopRefreshing();
    refreshInterval = setInterval(() => {
      const link = $$("a").find((a) => a.textContent && a.textContent.includes("\u5237\u65B0"));
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
      const txt = document.body ? document.body.innerText : "";
      const matches = txt.match(new RegExp(TARGET_TEXT, "g"));
      foundCount = matches ? matches.length : 0;
      if (!actedThisRound && foundCount >= 2) {
        actedThisRound = true;
        stopRefreshing();
        stopChecking();
        const move = $$("a,button").find(
          (el) => el.textContent && el.textContent.includes("\u7275\u8D70")
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
    const start2 = now();
    const timer = setInterval(() => {
      const button = $$("a,button").find(
        (el) => el.textContent && el.textContent.trim() === "\u8FD4\u56DE\u6E38\u620F"
      );
      if (button) {
        button.click();
        setPendingReturn(false);
        clearInterval(timer);
        if (enabled) {
          startRefreshing();
          startChecking();
        }
      } else if (now() - start2 > 15e3) {
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
  function init() {
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
  function pause() {
    stopRefreshing();
    stopChecking();
  }
  function resume() {
    if (enabled) {
      startRefreshing();
      startChecking();
    }
  }

  // src/userscripts/control-panel/src/modules/jyg.js
  var jyg_exports = {};
  __export(jyg_exports, {
    init: () => init2,
    pause: () => pause2,
    resume: () => resume2
  });
  var SCAN_MS = 400;
  var CLICK_COOLDOWN_MS = 1e3;
  var LS_ENABLED2 = "jyg_enabled_v1";
  var enabled2 = loadBoolean(LS_ENABLED2);
  var clickCount = 0;
  var lastClickAt = 0;
  var scanTimer = null;
  function mountUI2() {
    const body = $("#jyg-body");
    if (!body) return;
    body.innerHTML = `
    <div class="kv"><span class="label" data-label="\u72B6\u6001"></span><span
        id="jyg-status"
        class="value state"
        data-state="${enabled2 ? "on" : "off"}"
      ></span></div>
    <div class="kv"><span class="label" data-label="\u70B9\u51FB\u6B21\u6570"></span><span
        id="jyg-clicks"
        class="value"
        data-value="0"
      ></span></div>
    <div class="kv"><span class="label" data-label="\u4E0A\u6B21\u70B9\u51FB"></span><span
        id="jyg-last"
        class="value"
        data-value="-"
      ></span></div>
  `;
    const toggle = $("#jyg-toggle");
    if (toggle) {
      toggle.onclick = () => toggleEnabled2();
    }
    updateUI2();
  }
  function updateUI2() {
    const status = $("#jyg-status");
    if (status) {
      status.dataset.state = enabled2 ? "on" : "off";
    }
    const toggle = $("#jyg-toggle");
    if (toggle) {
      toggle.dataset.mode = enabled2 ? "on" : "off";
    }
    safeText($("#jyg-clicks"), clickCount);
    safeText($("#jyg-last"), formatTime(lastClickAt));
  }
  function pickTarget(anchors) {
    const byExact = (txt) => anchors.find((a) => a.textContent && a.textContent.trim() === txt);
    const byIncludes = (kw) => anchors.filter((a) => a.textContent && a.textContent.includes(kw));
    let target = byExact("\u653B\u51FB\u666F\u9633\u5C97\u5C0F\u5927\u866B");
    if (!target) target = byExact("\u653B\u51FB\u666F\u9633\u5C97\u5927\u866B");
    if (!target) target = byExact("\u666F\u9633\u5C97\u5927\u866B");
    if (!target) target = byExact("\u666F\u9633\u5C97\u5C0F\u5927\u866B");
    if (!target) {
      const arr = byIncludes("\u7075\u829D");
      target = arr && arr.length ? arr[0] : null;
    }
    if (!target) target = byExact("\u8FD4\u56DE\u6E38\u620F");
    if (!target) {
      const woods = byIncludes("\u6811\u6797");
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
      if (!enabled2) return;
      if (now() - lastClickAt < CLICK_COOLDOWN_MS) return;
      const anchors = $$("a");
      if (!anchors.length) return;
      const target = pickTarget(anchors);
      if (target) {
        target.click();
        clickCount += 1;
        lastClickAt = now();
        updateUI2();
      }
    }, SCAN_MS);
  }
  function stop() {
    if (scanTimer) clearInterval(scanTimer);
    scanTimer = null;
  }
  function enable2() {
    enabled2 = true;
    saveBoolean(LS_ENABLED2, true);
    start();
    updateUI2();
  }
  function disable2() {
    enabled2 = false;
    saveBoolean(LS_ENABLED2, false);
    stop();
    updateUI2();
  }
  function toggleEnabled2() {
    if (enabled2) {
      disable2();
    } else {
      enable2();
    }
  }
  function init2() {
    mountUI2();
    if (enabled2) {
      start();
    }
  }
  function pause2() {
    stop();
  }
  function resume2() {
    if (enabled2) {
      start();
    }
  }

  // src/userscripts/control-panel/src/watchdog.js
  var WATCH_INTERVAL_MS = 300;
  var CONTINUE_DELAY_MS = 1e3;
  function startWatchdog(modules) {
    let throttled = false;
    setInterval(() => {
      if (throttled) return;
      const text = document.body ? document.body.innerText : "";
      if (text.indexOf("\u60A8\u7684\u70B9\u51FB\u9891\u5EA6\u8FC7\u5FEB") >= 0) {
        throttled = true;
        modules.forEach((mod) => mod.pause());
        setTimeout(() => {
          const cont = $$("a").find(
            (el) => el.textContent && el.textContent.trim() === "\u7EE7\u7EED"
          );
          if (cont) cont.click();
          throttled = false;
          modules.forEach((mod) => mod.resume());
        }, CONTINUE_DELAY_MS);
      }
    }, WATCH_INTERVAL_MS);
  }

  // src/userscripts/control-panel/src/index.js
  function init3() {
    injectStyle();
    ensurePanel();
    init();
    init2();
    startWatchdog([rm_exports, jyg_exports]);
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init3);
  } else {
    init3();
  }
})();
