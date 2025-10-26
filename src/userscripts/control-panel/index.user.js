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
    el.textContent = text;
  };
  var setPseudoText = (el, text) => {
    if (!el) return;
    el.textContent = "";
    el.dataset.text = text != null ? text : "";
    el.setAttribute("aria-label", text != null ? text : "");
    el.classList.add("um-text");
  };
  var now = () => Date.now();
  var formatTime = (timestamp) => timestamp ? new Date(timestamp).toLocaleTimeString() : "-";

  // src/userscripts/control-panel/src/panel.js
  var PANEL_STYLE_ID = "um-style";
  var PANEL_ID = "um-panel";
  var PANEL_STYLE = `
#um-panel{position:fixed;right:16px;bottom:16px;width:320px;max-width:calc(100vw - 32px);z-index:2147483647;font:12px/1.5 system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;background:rgba(17,24,39,.92);color:#f8fafc;border-radius:18px;backdrop-filter:blur(12px);box-shadow:0 20px 48px rgba(15,23,42,.45);overflow:hidden;letter-spacing:.2px}
#um-panel .sec{border-top:1px solid rgba(148,163,184,.14)}
#um-panel .sec:first-child{border-top:none}
#um-panel .hdr{display:flex;align-items:center;justify-content:space-between;padding:14px 16px;background:rgba(30,41,59,.6)}
#um-panel .hdr b{font-weight:600;font-size:13px;color:#e2e8f0;text-transform:uppercase;letter-spacing:.8px}
#um-panel .body{padding:14px 16px;display:grid;gap:12px;background:rgba(15,23,42,.35)}
#um-panel .kv{display:flex;align-items:center;justify-content:space-between;gap:12px}
#um-panel .kv span:first-child{color:#94a3b8;font-size:12px;text-transform:uppercase;letter-spacing:.6px}
#um-panel .kv span:last-child{font-size:13px;font-variant-numeric:tabular-nums;font-weight:600;color:#f8fafc}
#um-panel .status{padding:2px 10px;border-radius:999px;background:rgba(34,197,94,.18);color:#bbf7d0;font-weight:600;font-size:12px;text-transform:none}
#um-panel .status.off{background:rgba(248,113,113,.2);color:#fecaca}
#um-panel button{border:none;background:linear-gradient(135deg,#38bdf8,#6366f1);color:#0f172a;border-radius:999px;padding:6px 16px;cursor:pointer;font-weight:600;font-size:12px;box-shadow:0 12px 32px rgba(99,102,241,.35);transition:transform .2s ease,box-shadow .2s ease}
#um-panel button:hover{transform:translateY(-1px);box-shadow:0 16px 40px rgba(99,102,241,.5)}
#um-panel button:active{transform:translateY(0);box-shadow:0 8px 24px rgba(99,102,241,.3)}
#um-panel .um-text{position:relative;display:inline-flex;align-items:center;min-height:1em}
#um-panel .um-text::before{content:attr(data-text);white-space:pre}
`;
  function buildSection(title, idPrefix) {
    const sec = document.createElement("div");
    sec.className = "sec";
    const header = document.createElement("div");
    header.className = "hdr";
    const label = document.createElement("b");
    setPseudoText(label, title);
    const toggle = document.createElement("button");
    toggle.id = `${idPrefix}-toggle`;
    setPseudoText(toggle, "\u5F00\u542F");
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
  function isInsidePanel(node, panel) {
    if (!panel) return false;
    let current = node ? node.parentNode : null;
    while (current) {
      if (current === panel) return true;
      current = current.parentNode;
    }
    return false;
  }
  function pageTextExcludingPanel() {
    if (!document.body) return "";
    const panel = $("#um-panel");
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode(node) {
          return isInsidePanel(node, panel) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
        }
      }
    );
    const parts = [];
    let current = walker.nextNode();
    while (current) {
      parts.push(current.nodeValue);
      current = walker.nextNode();
    }
    return parts.join("");
  }
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
  function createRow(labelText, valueId, valueClass) {
    const row = document.createElement("div");
    row.className = "kv";
    const label = document.createElement("span");
    setPseudoText(label, labelText);
    row.appendChild(label);
    const value = document.createElement("span");
    if (valueId) value.id = valueId;
    if (valueClass) value.className = valueClass;
    row.appendChild(value);
    return row;
  }
  function mountUI() {
    const body = $("#rm-body");
    if (!body) return;
    body.innerHTML = "";
    body.appendChild(createRow("\u72B6\u6001", "rm-status", "status"));
    body.appendChild(createRow("\u5237\u65B0\u6B21\u6570", "rm-refresh"));
    body.appendChild(createRow(`${TARGET_ALIAS} \u51FA\u73B0(\u5F53\u524D\u9875)`, "rm-found"));
    body.appendChild(createRow("\u7275\u8D70\u6B21\u6570", "rm-move"));
    body.appendChild(createRow("\u4E0A\u6B21\u89E6\u53D1", "rm-last"));
    const toggle = $("#rm-toggle");
    if (toggle) {
      toggle.onclick = () => toggleEnabled();
    }
    updateUI();
  }
  function updateUI() {
    const status = $("#rm-status");
    if (status) {
      status.classList.add("status");
      status.classList.toggle("off", !enabled);
      setPseudoText(status, enabled ? "\u8FD0\u884C\u4E2D" : "\u5173\u95ED\u4E2D");
    }
    const toggle = $("#rm-toggle");
    if (toggle) {
      setPseudoText(toggle, enabled ? "\u5173\u95ED" : "\u5F00\u542F");
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
      const txt = pageTextExcludingPanel();
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
    if (!enabled) return;
    if (isPendingReturn()) {
      tryClickReturn();
    } else {
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
  function createRow2(labelText, valueId, valueClass) {
    const row = document.createElement("div");
    row.className = "kv";
    const label = document.createElement("span");
    setPseudoText(label, labelText);
    row.appendChild(label);
    const value = document.createElement("span");
    if (valueId) value.id = valueId;
    if (valueClass) value.className = valueClass;
    row.appendChild(value);
    return row;
  }
  function mountUI2() {
    const body = $("#jyg-body");
    if (!body) return;
    body.innerHTML = "";
    body.appendChild(createRow2("\u72B6\u6001", "jyg-status", "status"));
    body.appendChild(createRow2("\u70B9\u51FB\u6B21\u6570", "jyg-clicks"));
    body.appendChild(createRow2("\u4E0A\u6B21\u70B9\u51FB", "jyg-last"));
    const toggle = $("#jyg-toggle");
    if (toggle) {
      toggle.onclick = () => toggleEnabled2();
    }
    updateUI2();
  }
  function updateUI2() {
    const status = $("#jyg-status");
    if (status) {
      status.classList.add("status");
      status.classList.toggle("off", !enabled2);
      setPseudoText(status, enabled2 ? "\u8FD0\u884C\u4E2D" : "\u5173\u95ED\u4E2D");
    }
    const toggle = $("#jyg-toggle");
    if (toggle) {
      setPseudoText(toggle, enabled2 ? "\u5173\u95ED" : "\u5F00\u542F");
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
