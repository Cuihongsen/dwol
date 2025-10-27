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
  var __defProps = Object.defineProperties;
  var __getOwnPropDescs = Object.getOwnPropertyDescriptors;
  var __getOwnPropSymbols = Object.getOwnPropertySymbols;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __propIsEnum = Object.prototype.propertyIsEnumerable;
  var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
  var __spreadValues = (a, b) => {
    for (var prop in b || (b = {}))
      if (__hasOwnProp.call(b, prop))
        __defNormalProp(a, prop, b[prop]);
    if (__getOwnPropSymbols)
      for (var prop of __getOwnPropSymbols(b)) {
        if (__propIsEnum.call(b, prop))
          __defNormalProp(a, prop, b[prop]);
      }
    return a;
  };
  var __spreadProps = (a, b) => __defProps(a, __getOwnPropDescs(b));
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

  // src/userscripts/control-panel/src/events.js
  var MODULE_STATE_EVENT = "um:module-state";
  function emitModuleState(detail) {
    window.dispatchEvent(new CustomEvent(MODULE_STATE_EVENT, { detail }));
  }

  // src/userscripts/control-panel/src/panel.js
  var PANEL_STYLE_ID = "um-style";
  var PANEL_ID = "um-panel";
  var LS_ACTIVE_MODULE = "um_active_module_v1";
  var MODULES = [
    { id: "rm", title: "\u5237\u65B0\u9A6C", enabledKey: "rm_enabled_v1" },
    { id: "jyg", title: "\u666F\u9633\u5C97", enabledKey: "jyg_enabled_v1" }
  ];
  var navButtons = [];
  var sections = [];
  var currentActiveModule = null;
  var listenersBound = false;
  var PANEL_STYLE = `
:root{color-scheme:light}
body{margin:0;min-height:100vh;background:linear-gradient(180deg,#f8fafc 0%,#e2e8f0 100%);color:#1f2937;font:13px/1.7 'Inter',system-ui,-apple-system,'PingFang SC',sans-serif;-webkit-font-smoothing:antialiased}
body>*:not(#um-panel){max-width:920px;margin-inline:auto;padding:0 24px}
main,section,article{display:block;margin-inline:auto;max-width:920px}
p{margin:14px auto;max-width:70ch}
li{max-width:70ch}
a{color:#2563eb;text-decoration:none}
a:hover{color:#7c3aed}
pre,code{font-family:'JetBrains Mono','Fira Code',ui-monospace,monospace}
pre{background:#f1f5f9;border:1px solid #cbd5f5;border-radius:12px;padding:16px;overflow:auto;color:#0f172a}
table{width:100%;border-collapse:collapse;background:#f8fafc;border:1px solid #d0d7ea;border-radius:12px;overflow:hidden}
th,td{padding:10px 14px;border-bottom:1px solid #e2e8f0;text-align:left}
th{color:#0f172a;font-weight:600;background:#e2e8f0}
tr:last-child td{border-bottom:none}
#um-panel{position:fixed;right:16px;bottom:16px;width:248px;z-index:2147483647;font:11px/1.55 'Inter',system-ui,-apple-system,'PingFang SC',sans-serif;color:#0f172a;background:linear-gradient(140deg,#ffffff 0%,#eff4fb 100%);border:1px solid rgba(148,163,184,.38);border-radius:18px;box-shadow:0 18px 46px rgba(15,23,42,.16);backdrop-filter:blur(10px);overflow:hidden}
#um-panel::after{content:'';position:absolute;inset:1px;border-radius:16px;pointer-events:none;background:linear-gradient(125deg,rgba(255,255,255,.75),rgba(148,163,184,.14) 48%,transparent 78%)}
#um-panel .nav{display:flex;gap:6px;padding:10px 12px 6px;background:rgba(241,245,249,.85);backdrop-filter:blur(8px)}
#um-panel .nav button{flex:1;position:relative;border:none;border-radius:12px;padding:8px 0;background:transparent;cursor:pointer;transition:all .18s ease;min-width:0}
#um-panel .nav button::before{content:attr(data-label);display:block;font-weight:600;letter-spacing:.06em;color:#475569}
#um-panel .nav button[data-active="true"]{background:linear-gradient(135deg,#dbeafe,#e0f2fe);box-shadow:inset 0 1px 0 rgba(255,255,255,.9),0 6px 18px rgba(59,130,246,.18)}
#um-panel .nav button[data-active="true"]::before{color:#1d4ed8}
#um-panel .nav button:focus-visible{outline:2px solid #38bdf8;outline-offset:2px}
#um-panel .modules{padding:4px 12px 14px}
#um-panel .module{display:none}
#um-panel .module[data-active="true"]{display:block}
#um-panel .hdr{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px}
#um-panel .hdr b{position:relative;font-weight:600;letter-spacing:.04em;flex:1}
#um-panel .hdr b::before{content:attr(data-label);display:block;color:#1d4ed8;text-shadow:0 1px 6px rgba(148,163,184,.24)}
#um-panel .hdr .actions{display:flex;align-items:center;gap:6px}
#um-panel .hdr .actions button{position:relative;min-width:64px;padding:4px 12px;border-radius:999px;border:1px solid rgba(148,163,184,.45);background:linear-gradient(135deg,#f8fafc,#e2e8f0);box-shadow:inset 0 1px 0 rgba(255,255,255,.9);cursor:pointer;color:#1e293b;transition:all .18s ease;font-size:10px;letter-spacing:.08em}
#um-panel .hdr .actions button:hover{border-color:rgba(59,130,246,.65);box-shadow:inset 0 1px 0 rgba(255,255,255,.9),0 4px 12px rgba(59,130,246,.16);transform:translateY(-1px)}
#um-panel .hdr .actions button:active{transform:translateY(0)}
#um-panel .hdr .actions button:focus-visible{outline:2px solid #38bdf8;outline-offset:1px}
#um-panel .hdr .actions button::before{content:'';font-weight:600;color:#1d4ed8}
#um-panel .hdr .actions button[data-role="toggle"][data-mode="on"]::before{content:'\u5173\u95ED'}
#um-panel .hdr .actions button[data-role="toggle"][data-mode="off"]::before{content:'\u5F00\u542F'}
#um-panel .hdr .actions button[data-role="reset"]{min-width:72px;background:linear-gradient(135deg,#fef9c3,#fef3c7);border-color:rgba(250,204,21,.6);color:#92400e}
#um-panel .hdr .actions button[data-role="reset"]::before{content:'\u6E05\u7A7A\u7EDF\u8BA1'}
#um-panel .body{padding:10px 12px;display:flex;flex-direction:column;gap:6px;background:rgba(248,250,252,.9);border:1px solid rgba(148,163,184,.28);border-radius:12px}
#um-panel .kv{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding:2px 0}
#um-panel .kv .label::before{content:attr(data-label);color:#475569;font-size:10px;letter-spacing:.04em;white-space:nowrap}
#um-panel .kv .value{position:relative;font-variant-numeric:tabular-nums;text-align:right}
#um-panel .kv .value::before{content:attr(data-value);color:#0f172a;font-size:11px}
#um-panel .kv .state[data-state="on"]::before{content:'\u8FD0\u884C\u4E2D';color:#15803d;font-weight:600;text-shadow:0 0 8px rgba(74,222,128,.35)}
#um-panel .kv .state[data-state="off"]::before{content:'\u5173\u95ED\u4E2D';color:#dc2626;font-weight:600;text-shadow:0 0 6px rgba(248,113,113,.3)}
#um-panel .hint::before{content:attr(data-label);color:#64748b;font-size:9px;letter-spacing:.04em}
`;
  function buildSection(title, idPrefix) {
    const sec = document.createElement("section");
    sec.className = "module";
    sec.dataset.module = idPrefix;
    const header = document.createElement("div");
    header.className = "hdr";
    const label = document.createElement("b");
    label.setAttribute("data-label", title);
    const actions = document.createElement("div");
    actions.className = "actions";
    const reset = document.createElement("button");
    reset.id = `${idPrefix}-reset`;
    reset.type = "button";
    reset.dataset.role = "reset";
    reset.setAttribute("aria-label", `${title} \u7EDF\u8BA1\u6E05\u7A7A`);
    const toggle = document.createElement("button");
    toggle.id = `${idPrefix}-toggle`;
    toggle.type = "button";
    toggle.dataset.mode = "off";
    toggle.dataset.role = "toggle";
    toggle.setAttribute("aria-pressed", "false");
    toggle.setAttribute("aria-label", `${title} \u6A21\u5757\u5F00\u5173`);
    actions.appendChild(toggle);
    actions.appendChild(reset);
    header.appendChild(label);
    header.appendChild(actions);
    const body = document.createElement("div");
    body.className = "body";
    body.id = `${idPrefix}-body`;
    sec.appendChild(header);
    sec.appendChild(body);
    return sec;
  }
  function pickEnabledModule(excludeId = null) {
    for (const mod of MODULES) {
      if (excludeId && mod.id === excludeId) continue;
      if (localStorage.getItem(mod.enabledKey) === "1") {
        return mod.id;
      }
    }
    return null;
  }
  function chooseInitialModule() {
    var _a, _b;
    const stored = localStorage.getItem(LS_ACTIVE_MODULE);
    if (stored && MODULES.some((mod) => mod.id === stored)) {
      return stored;
    }
    const enabled3 = pickEnabledModule();
    if (enabled3) return enabled3;
    return (_b = (_a = MODULES[0]) == null ? void 0 : _a.id) != null ? _b : null;
  }
  function activate(moduleId, { persist = true } = {}) {
    if (!moduleId) return;
    if (!MODULES.some((mod) => mod.id === moduleId)) return;
    currentActiveModule = moduleId;
    for (const btn of navButtons) {
      const active = btn.dataset.module === moduleId;
      btn.dataset.active = active ? "true" : "false";
      btn.setAttribute("aria-pressed", active ? "true" : "false");
    }
    for (const sec of sections) {
      const active = sec.dataset.module === moduleId;
      sec.dataset.active = active ? "true" : "false";
      if (active) {
        sec.removeAttribute("hidden");
      } else {
        sec.setAttribute("hidden", "");
      }
    }
    if (persist) {
      localStorage.setItem(LS_ACTIVE_MODULE, moduleId);
    }
  }
  function focusModule(moduleId, options) {
    activate(moduleId, options);
  }
  function bindModuleStateListener() {
    if (listenersBound) return;
    window.addEventListener(MODULE_STATE_EVENT, (event) => {
      var _a;
      const detail = event == null ? void 0 : event.detail;
      if (!detail || !detail.moduleId) return;
      if (detail.enabled) {
        focusModule(detail.moduleId);
      } else if (currentActiveModule === detail.moduleId) {
        const next = pickEnabledModule(detail.moduleId) || ((_a = MODULES[0]) == null ? void 0 : _a.id);
        focusModule(next, { persist: true });
      }
    });
    listenersBound = true;
  }
  function injectStyle() {
    if ($(`#${PANEL_STYLE_ID}`)) return;
    const style = document.createElement("style");
    style.id = PANEL_STYLE_ID;
    style.textContent = PANEL_STYLE;
    document.head.appendChild(style);
  }
  function ensurePanel() {
    bindModuleStateListener();
    if ($(`#${PANEL_ID}`)) {
      const initialExisting = chooseInitialModule();
      if (initialExisting) {
        activate(initialExisting, { persist: false });
      }
      return;
    }
    const panel = document.createElement("div");
    panel.id = PANEL_ID;
    const nav = document.createElement("div");
    nav.className = "nav";
    const modulesWrap = document.createElement("div");
    modulesWrap.className = "modules";
    navButtons = [];
    sections = [];
    for (const [index, mod] of MODULES.entries()) {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.module = mod.id;
      button.dataset.label = mod.title;
      button.setAttribute("aria-label", `${mod.title} \u9762\u677F`);
      button.setAttribute("aria-pressed", index === 0 ? "true" : "false");
      button.dataset.active = index === 0 ? "true" : "false";
      button.addEventListener("click", () => focusModule(mod.id));
      nav.appendChild(button);
      navButtons.push(button);
      const section = buildSection(mod.title, mod.id);
      if (index === 0) {
        section.dataset.active = "true";
      } else {
        section.dataset.active = "false";
        section.setAttribute("hidden", "");
      }
      modulesWrap.appendChild(section);
      sections.push(section);
    }
    panel.appendChild(nav);
    panel.appendChild(modulesWrap);
    document.body.appendChild(panel);
    const initial = chooseInitialModule();
    if (initial) {
      activate(initial, { persist: false });
    }
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
  var MODULE_ID = "rm";
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
  function resetStats() {
    refreshCount = 0;
    moveClickCount = 0;
    lastTriggerTs = null;
    foundCount = 0;
    saveStats();
    updateUI();
  }
  function announceState() {
    emitModuleState({ moduleId: MODULE_ID, enabled });
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
    const reset = $("#rm-reset");
    if (reset) {
      reset.onclick = () => resetStats();
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
      toggle.setAttribute("aria-pressed", enabled ? "true" : "false");
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
    announceState();
  }
  function disable() {
    enabled = false;
    saveBoolean(LS_ENABLED, false);
    stopRefreshing();
    stopChecking();
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
  function init() {
    loadStats();
    mountUI();
    announceState();
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
  var LS_STATS2 = "jyg_stats_v3";
  var LS_STATS_LEGACY = ["jyg_stats_v2"];
  var LOOT_BLOCK_REGEX = /捡到[^\n\r]*/g;
  var LOOT_ITEM_REGEX = /(.+?)x(\d+)$/;
  var MODULE_ID2 = "jyg";
  var DIRECTION_OPPOSITES = {
    \u5DE6: "\u53F3",
    \u53F3: "\u5DE6",
    \u4E0A: "\u4E0B",
    \u4E0B: "\u4E0A"
  };
  var PREFERRED_DIRECTION_ORDER = ["\u53F3", "\u4E0B", "\u5DE6", "\u4E0A"];
  var ARROW_DIRECTIONS = {
    "\u2190": "\u5DE6",
    "\u2192": "\u53F3",
    "\u2191": "\u4E0A",
    "\u2193": "\u4E0B"
  };
  var enabled2 = loadBoolean(LS_ENABLED2);
  var scanCount = 0;
  var clickCount = 0;
  var lastClickAt = 0;
  var lastTarget = "-";
  var targetBreakdown = {};
  var lootTotals = {};
  var seenLoot = /* @__PURE__ */ new Set();
  var scanTimer = null;
  var currentLocationKey = null;
  var pendingMove = null;
  var locationGraph = /* @__PURE__ */ new Map();
  var navigationStack = [];
  var locationMetadata = /* @__PURE__ */ new Map();
  var baseKeyAliasMap = /* @__PURE__ */ new Map();
  var nextLocationId = 1;
  var lastNavigationAction = null;
  function parseDirectionalLabel(text) {
    const raw = text ? text.trim() : "";
    if (!raw) {
      return { direction: null, label: "" };
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
    locationMetadata.clear();
    baseKeyAliasMap.clear();
    nextLocationId = 1;
    lastNavigationAction = null;
  }
  function extractLocationHint() {
    const candidates = [
      document.querySelector("#ly_map strong"),
      document.querySelector("#ly_map b"),
      document.querySelector("#ly_map")
    ];
    for (const node of candidates) {
      const text = node && node.textContent ? node.textContent.trim() : "";
      if (text) {
        return text.slice(0, 80);
      }
    }
    const body = document.body ? document.body.innerText : "";
    if (!body) return "";
    const lines = body.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    for (const line of lines) {
      if (line.includes("\u666F\u9633\u5C97") || line.includes("\u6811\u6797")) {
        return line.slice(0, 80);
      }
    }
    return lines.length ? lines[0].slice(0, 80) : "";
  }
  function buildNavigationContext(anchors) {
    const movement = [];
    const attack = [];
    const gather = [];
    const misc = [];
    for (const el of anchors) {
      const text = el.textContent ? el.textContent.trim() : "";
      if (!text) continue;
      const href = el.getAttribute("href") || "";
      const { direction, label } = parseDirectionalLabel(text);
      const normalizedLabel = label || text;
      const base = { el, text, direction, label: normalizedLabel, href };
      if (text.includes("\u653B\u51FB\u666F\u9633\u5C97")) {
        attack.push(__spreadProps(__spreadValues({}, base), { key: `attack:${href || normalizedLabel}` }));
        continue;
      }
      if (!text.includes("\u653B\u51FB") && text.includes("\u666F\u9633\u5C97\u5927\u866B")) {
        attack.push(__spreadProps(__spreadValues({}, base), { key: `boss:${href || normalizedLabel}` }));
        continue;
      }
      if (normalizedLabel.includes("\u6811\u6797")) {
        const key = direction ? `dir:${direction}` : `move:${href || normalizedLabel}`;
        movement.push(__spreadProps(__spreadValues({}, base), { key }));
        continue;
      }
      if (text.includes("\u7075\u829D")) {
        gather.push(__spreadProps(__spreadValues({}, base), { key: `loot:${href || normalizedLabel}` }));
        continue;
      }
      if (text.includes("\u8FD4\u56DE\u6E38\u620F")) {
        misc.push(__spreadProps(__spreadValues({}, base), { key: `return:${href || normalizedLabel}` }));
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
      locationKey: baseLocationKey
    };
  }
  function baseKeyIndex(baseKey) {
    return baseKey || "__no_key__";
  }
  function registerAlias(alias, baseKey) {
    if (!alias) return;
    const key = baseKeyIndex(baseKey);
    let set = baseKeyAliasMap.get(key);
    if (!set) {
      set = /* @__PURE__ */ new Set();
      baseKeyAliasMap.set(key, set);
    }
    set.add(alias);
  }
  function createAlias(baseKey) {
    const alias = `loc#${nextLocationId++}`;
    registerAlias(alias, baseKey);
    return alias;
  }
  function hashKey(str) {
    if (!str) return "";
    let hash = 0;
    for (let i = 0; i < str.length; i += 1) {
      hash = hash * 31 + str.charCodeAt(i) | 0;
    }
    return (hash >>> 0).toString(16);
  }
  function recordLocationVisit(alias, baseKey, hint) {
    if (!alias) return;
    const timestamp = now();
    let meta = locationMetadata.get(alias);
    if (!meta) {
      meta = {
        baseKey: baseKey || null,
        baseHash: baseKey ? hashKey(baseKey) : null,
        lastHint: hint || null,
        visits: 0,
        firstSeenAt: timestamp,
        lastSeenAt: timestamp
      };
      locationMetadata.set(alias, meta);
    }
    if (baseKey) {
      meta.baseKey = baseKey;
      meta.baseHash = hashKey(baseKey);
    }
    if (hint) {
      meta.lastHint = hint;
    }
    if (alias !== currentLocationKey) {
      meta.visits += 1;
    }
    meta.lastSeenAt = timestamp;
  }
  function resolveLocationAlias(baseKey, hint, fromKey, direction) {
    if (!baseKey) {
      return null;
    }
    const indexKey = baseKeyIndex(baseKey);
    const aliasSet = baseKeyAliasMap.get(indexKey);
    if (fromKey && direction) {
      const fromNode = locationGraph.get(fromKey);
      if (fromNode) {
        const knownNeighbor = fromNode.neighbors.get(direction);
        if (knownNeighbor) {
          registerAlias(knownNeighbor, baseKey);
          return knownNeighbor;
        }
      }
    }
    if (aliasSet && aliasSet.size) {
      if (fromKey && direction) {
        const opposite = DIRECTION_OPPOSITES[direction] || null;
        if (opposite) {
          for (const alias2 of aliasSet.values()) {
            const node = locationGraph.get(alias2);
            if (node && node.neighbors.get(opposite) === fromKey) {
              registerAlias(alias2, baseKey);
              return alias2;
            }
          }
        }
      } else {
        const firstAlias = aliasSet.values().next().value;
        if (firstAlias) {
          registerAlias(firstAlias, baseKey);
          return firstAlias;
        }
      }
    }
    const alias = createAlias(baseKey);
    if (typeof console !== "undefined" && console.debug) {
      const preview = baseKey && baseKey.length > 120 ? `${baseKey.slice(0, 117)}\u2026` : baseKey;
      console.debug("[JYG] \u521B\u5EFA\u65B0\u4F4D\u7F6E", alias, {
        baseKey: preview,
        fromKey,
        direction,
        hint
      });
    }
    return alias;
  }
  function getLocationMeta(key) {
    return key ? locationMetadata.get(key) || null : null;
  }
  function computeLocationKey(movement, hint) {
    const parts = movement.map(({ key, href, label }) => `${key}|${href || ""}|${label}`).sort();
    if (hint) {
      parts.unshift(`hint:${hint}`);
    }
    if (!parts.length) {
      return hint || null;
    }
    return parts.join("||");
  }
  function ensureGraphNode(key) {
    if (!key) return null;
    let node = locationGraph.get(key);
    if (!node) {
      node = {
        tried: /* @__PURE__ */ new Set(),
        directionMeta: /* @__PURE__ */ new Map(),
        neighbors: /* @__PURE__ */ new Map()
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
        href: link.href
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
          returnDirection: null
        }
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
          returnDirection: null
        }
      ];
      return;
    }
    const fromEntry = navigationStack[fromIndex];
    const parentEntry = fromIndex > 0 ? navigationStack[fromIndex - 1] : null;
    const expectedBack = fromEntry ? fromEntry.returnDirection : null;
    if (parentEntry && parentEntry.nodeKey === toKey && expectedBack && viaDirection && expectedBack === viaDirection) {
      navigationStack = navigationStack.slice(0, fromIndex);
      return;
    }
    const returnDirection = viaDirection ? DIRECTION_OPPOSITES[viaDirection] || null : null;
    navigationStack = navigationStack.slice(0, fromIndex + 1);
    navigationStack.push({
      nodeKey: toKey,
      parentKey: fromKey,
      viaDirection,
      returnDirection
    });
  }
  function handleLocationContext(context) {
    const { baseLocationKey, movement, hint } = context;
    if (!baseLocationKey) {
      clearNavigationState();
      context.locationKey = null;
      return;
    }
    const fromKey = pendingMove ? pendingMove.fromKey : null;
    const moveDirection = pendingMove ? pendingMove.direction : null;
    const resolvedKey = resolveLocationAlias(baseLocationKey, hint, fromKey, moveDirection);
    context.locationKey = resolvedKey;
    if (!resolvedKey) {
      clearNavigationState();
      return;
    }
    recordLocationVisit(resolvedKey, baseLocationKey, hint);
    if (resolvedKey !== currentLocationKey) {
      const previousKey = currentLocationKey;
      currentLocationKey = resolvedKey;
      registerNodeDirections(resolvedKey, movement);
      if (pendingMove && previousKey && pendingMove.fromKey === previousKey) {
        const fromNode = locationGraph.get(previousKey);
        if (fromNode && pendingMove.key) {
          fromNode.tried.add(pendingMove.key);
        }
        if (fromNode && pendingMove.direction) {
          fromNode.neighbors.set(pendingMove.direction, resolvedKey);
        }
      }
      if (pendingMove && pendingMove.direction) {
        const opposite = DIRECTION_OPPOSITES[pendingMove.direction];
        if (opposite) {
          const node = ensureGraphNode(resolvedKey);
          if (node) {
            node.neighbors.set(opposite, pendingMove.fromKey || null);
          }
        }
      }
      alignNavigationStack(pendingMove ? pendingMove.fromKey : null, resolvedKey, moveDirection);
      pendingMove = null;
    } else {
      registerNodeDirections(resolvedKey, movement);
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
      href: chosen.href || "",
      returnDirection
    };
    const moveLabel = chosen.direction ? `${chosen.label}(${chosen.direction})` : chosen.label;
    lastNavigationAction = {
      fromKey: locationKey,
      direction: chosen.direction || null,
      label: moveLabel
    };
    return { el: chosen.el, label: moveLabel, direction: chosen.direction || null };
  }
  function loadStats2() {
    let stats = loadJSON(LS_STATS2);
    if (!stats) {
      for (const key of LS_STATS_LEGACY) {
        stats = loadJSON(key);
        if (stats) break;
      }
    }
    if (!stats) return;
    scanCount = Number(stats.scanCount) || 0;
    clickCount = Number(stats.clickCount) || 0;
    lastClickAt = typeof stats.lastClickAt === "number" ? stats.lastClickAt : 0;
    lastTarget = stats.lastTarget ? String(stats.lastTarget) : "-";
    targetBreakdown = stats.targetBreakdown && typeof stats.targetBreakdown === "object" ? __spreadValues({}, stats.targetBreakdown) : {};
    lootTotals = stats.lootTotals && typeof stats.lootTotals === "object" ? __spreadValues({}, stats.lootTotals) : {};
  }
  function saveStats2() {
    saveJSON(LS_STATS2, {
      scanCount,
      clickCount,
      lastClickAt,
      lastTarget,
      targetBreakdown,
      lootTotals
    });
  }
  function announceState2() {
    emitModuleState({ moduleId: MODULE_ID2, enabled: enabled2 });
  }
  function refreshSeenLootSnapshot() {
    seenLoot = /* @__PURE__ */ new Set();
    const text = document.body ? document.body.innerText : "";
    if (!text) return;
    LOOT_BLOCK_REGEX.lastIndex = 0;
    const blocks = text.matchAll(LOOT_BLOCK_REGEX);
    for (const block of blocks) {
      const fullBlock = block[0] ? block[0].trim() : "";
      if (!fullBlock || fullBlock.length <= 2) continue;
      const entries = fullBlock.slice(2).split(/[;；]+/).map((entry) => entry.trim()).filter(Boolean);
      for (const entry of entries) {
        seenLoot.add(`\u6361\u5230${entry}`);
      }
    }
  }
  function resetStats2() {
    scanCount = 0;
    clickCount = 0;
    lastClickAt = 0;
    lastTarget = "-";
    targetBreakdown = {};
    lootTotals = {};
    refreshSeenLootSnapshot();
    saveStats2();
    updateUI2();
    clearNavigationState();
  }
  function recordScan() {
    scanCount += 1;
    saveStats2();
  }
  function recordClick(targetLabel) {
    clickCount += 1;
    lastClickAt = now();
    lastTarget = targetLabel;
    if (targetLabel) {
      targetBreakdown[targetLabel] = (targetBreakdown[targetLabel] || 0) + 1;
    }
    saveStats2();
  }
  function recordLoot(text) {
    if (!text) return;
    let updated = false;
    LOOT_BLOCK_REGEX.lastIndex = 0;
    const blocks = text.matchAll(LOOT_BLOCK_REGEX);
    for (const block of blocks) {
      const fullBlock = block[0] ? block[0].trim() : "";
      if (!fullBlock || fullBlock.length <= 2) continue;
      const entries = fullBlock.slice(2).split(/[;；]+/).map((entry) => entry.trim()).filter(Boolean);
      for (const entry of entries) {
        const match = entry.match(LOOT_ITEM_REGEX);
        if (!match) continue;
        const key = `\u6361\u5230${entry}`;
        if (seenLoot.has(key)) continue;
        seenLoot.add(key);
        const label = match[1] ? match[1].trim() : "";
        const count = Number(match[2]) || 0;
        if (!label || !count) continue;
        lootTotals[label] = (lootTotals[label] || 0) + count;
        updated = true;
      }
    }
    if (updated) {
      saveStats2();
      updateUI2();
    }
  }
  function formatBreakdown() {
    const entries = Object.entries(targetBreakdown);
    if (!entries.length) return "-";
    return entries.sort((a, b) => b[1] - a[1]).map(([label, count]) => `${label}\xD7${count}`).join(" / ");
  }
  function formatLoot() {
    const entries = Object.entries(lootTotals);
    if (!entries.length) return "-";
    return entries.sort((a, b) => b[1] - a[1]).map(([label, count]) => `${label}\xD7${count}`).join(" / ");
  }
  function shortenHint(hint) {
    if (!hint) return "";
    return hint.length > 20 ? `${hint.slice(0, 20)}\u2026` : hint;
  }
  function formatLocationName(key, { includeHint = true } = {}) {
    if (!key) return "-";
    const meta = getLocationMeta(key);
    if (!meta) return key;
    const visitSuffix = meta.visits ? `\xD7${meta.visits}` : "";
    const hashPart = meta.baseHash ? ` [${meta.baseHash}]` : "";
    if (!includeHint) {
      return `${key}${visitSuffix}${hashPart}`;
    }
    const hint = shortenHint(meta.lastHint);
    return hint ? `${key}${visitSuffix}${hashPart} (${hint})` : `${key}${visitSuffix}${hashPart}`;
  }
  function formatDirectionSummary(key) {
    if (!key) return "-";
    const node = locationGraph.get(key);
    if (!node) return "-";
    const entries = [...node.directionMeta.entries()].sort(
      (a, b) => directionPriority(a[1].direction) - directionPriority(b[1].direction)
    );
    if (!entries.length) return "-";
    const parts = [];
    for (const [linkKey, meta] of entries) {
      const dir = meta.direction || "";
      const label = dir || meta.label || linkKey;
      const tried = node.tried.has(linkKey);
      const neighborKey = dir ? node.neighbors.get(dir) : null;
      const neighborLabel = neighborKey ? formatLocationName(neighborKey, { includeHint: false }) : "";
      const suffix = neighborLabel ? `\u2192${neighborLabel}` : "";
      parts.push(`${label}${dir ? "" : "(?)"}:${tried ? "\u2713" : "\xB7"}${suffix}`);
    }
    return parts.join(" / ");
  }
  function formatNavigationStackSummary() {
    if (!navigationStack.length) return "-";
    return navigationStack.map((entry) => formatLocationName(entry.nodeKey)).join(" \u2192 ");
  }
  function formatPendingAction() {
    if (pendingMove) {
      const origin = formatLocationName(pendingMove.fromKey, { includeHint: false });
      const dir = pendingMove.direction ? `(${pendingMove.direction})` : "";
      const label = pendingMove.label || pendingMove.key || "-";
      return `${origin || "-"}\u2192${label}${dir}`;
    }
    if (lastNavigationAction) {
      const origin = formatLocationName(lastNavigationAction.fromKey, { includeHint: false });
      const dir = lastNavigationAction.direction ? `(${lastNavigationAction.direction})` : "";
      return `${origin || "-"}\u2192${lastNavigationAction.label}${dir}`;
    }
    return "-";
  }
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
    <div class="kv"><span class="label" data-label="\u4E0A\u6B21\u76EE\u6807"></span><span
        id="jyg-last-target"
        class="value"
        data-value="-"
      ></span></div>
    <div class="kv"><span class="label" data-label="\u4E0A\u6B21\u70B9\u51FB"></span><span
        id="jyg-last"
        class="value"
        data-value="-"
      ></span></div>
    <div class="kv"><span class="label" data-label="\u8F6E\u8BE2\u6B21\u6570"></span><span
        id="jyg-scans"
        class="value"
        data-value="0"
      ></span></div>
    <div class="kv"><span class="label" data-label="\u76EE\u6807\u7EDF\u8BA1"></span><span
        id="jyg-targets"
        class="value"
        data-value="-"
      ></span></div>
    <div class="kv"><span class="label" data-label="\u6389\u843D\u7EDF\u8BA1"></span><span
        id="jyg-loot"
        class="value"
        data-value="-"
      ></span></div>
    <div class="kv"><span class="label" data-label="\u5F53\u524D\u4F4D\u7F6E"></span><span
        id="jyg-location"
        class="value"
        data-value="-"
      ></span></div>
    <div class="kv"><span class="label" data-label="\u65B9\u5411\u72B6\u6001"></span><span
        id="jyg-directions"
        class="value"
        data-value="-"
      ></span></div>
    <div class="kv"><span class="label" data-label="\u5BFC\u822A\u6808"></span><span
        id="jyg-stack"
        class="value"
        data-value="-"
      ></span></div>
    <div class="kv"><span class="label" data-label="\u5BFC\u822A\u52A8\u4F5C"></span><span
        id="jyg-pending"
        class="value"
        data-value="-"
      ></span></div>
    <div class="kv"><span class="label" data-label="\u8282\u70B9\u6570\u91CF"></span><span
        id="jyg-locations"
        class="value"
        data-value="0"
      ></span></div>
  `;
    const toggle = $("#jyg-toggle");
    if (toggle) {
      toggle.onclick = () => toggleEnabled2();
    }
    const reset = $("#jyg-reset");
    if (reset) {
      reset.onclick = () => resetStats2();
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
      toggle.setAttribute("aria-pressed", enabled2 ? "true" : "false");
    }
    safeText($("#jyg-clicks"), clickCount);
    safeText($("#jyg-last-target"), lastTarget || "-");
    safeText($("#jyg-last"), formatTime(lastClickAt));
    safeText($("#jyg-scans"), scanCount);
    safeText($("#jyg-targets"), formatBreakdown());
    safeText($("#jyg-loot"), formatLoot());
    safeText($("#jyg-location"), formatLocationName(currentLocationKey));
    safeText($("#jyg-directions"), formatDirectionSummary(currentLocationKey));
    safeText($("#jyg-stack"), formatNavigationStackSummary());
    safeText($("#jyg-pending"), formatPendingAction());
    safeText($("#jyg-locations"), locationGraph.size);
  }
  function pickTarget(context) {
    const anchors = context.allAnchors;
    const byExact = (txt) => anchors.find((a) => a.textContent && a.textContent.trim() === txt);
    const byIncludes = (kw) => anchors.filter((a) => a.textContent && a.textContent.includes(kw));
    const attempts = [
      () => {
        const el = byExact("\u653B\u51FB\u666F\u9633\u5C97\u5C0F\u5927\u866B");
        if (el) {
          pendingMove = null;
          return { el, label: "\u653B\u51FB\u666F\u9633\u5C97\u5C0F\u5927\u866B" };
        }
        return null;
      },
      () => {
        const el = byExact("\u653B\u51FB\u666F\u9633\u5C97\u5927\u866B");
        if (el) {
          pendingMove = null;
          return { el, label: "\u653B\u51FB\u666F\u9633\u5C97\u5927\u866B" };
        }
        return null;
      },
      () => {
        const el = byExact("\u666F\u9633\u5C97\u5927\u866B");
        if (el) {
          pendingMove = null;
          return { el, label: "\u666F\u9633\u5C97\u5927\u866B" };
        }
        return null;
      },
      () => {
        const el = byExact("\u666F\u9633\u5C97\u5C0F\u5927\u866B");
        if (el) {
          pendingMove = null;
          return { el, label: "\u666F\u9633\u5C97\u5C0F\u5927\u866B" };
        }
        return null;
      },
      () => {
        if (context.gather.length) {
          const pick = context.gather[0];
          pendingMove = null;
          return { el: pick.el, label: pick.label };
        }
        const arr = byIncludes("\u7075\u829D");
        if (arr && arr.length) {
          pendingMove = null;
          return { el: arr[0], label: "\u7075\u829D" };
        }
        return null;
      },
      () => {
        if (context.misc.length) {
          const ret = context.misc.find((item) => item.label.includes("\u8FD4\u56DE"));
          if (ret) {
            pendingMove = null;
            return { el: ret.el, label: ret.label };
          }
        }
        const el = byExact("\u8FD4\u56DE\u6E38\u620F");
        if (el) {
          pendingMove = null;
          return { el, label: "\u8FD4\u56DE\u6E38\u620F" };
        }
        return null;
      },
      () => selectNavigationMove(context)
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
      if (!enabled2) return;
      const text = document.body ? document.body.innerText : "";
      if (text) recordLoot(text);
      if (now() - lastClickAt < CLICK_COOLDOWN_MS) return;
      const anchors = $$("a");
      if (!anchors.length) return;
      const context = buildNavigationContext(anchors);
      handleLocationContext(context);
      const result = pickTarget(context);
      recordScan();
      if (result) {
        result.el.click();
        recordClick(result.label);
        updateUI2();
      } else {
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
    announceState2();
  }
  function disable2() {
    enabled2 = false;
    saveBoolean(LS_ENABLED2, false);
    stop();
    saveStats2();
    updateUI2();
    announceState2();
    clearNavigationState();
  }
  function toggleEnabled2() {
    if (enabled2) {
      disable2();
    } else {
      enable2();
    }
  }
  function init2() {
    loadStats2();
    mountUI2();
    announceState2();
    if (enabled2) {
      start();
    }
  }
  function pause2() {
    stop();
    saveStats2();
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
