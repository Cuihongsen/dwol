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
    { id: "jyg", title: "\u666F\u9633\u5C97", enabledKey: "jyg_enabled_v1" },
    { id: "bc", title: "\u5237\u767D\u83DC", enabledKey: "bc_enabled_v1" }
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
    const enabled2 = pickEnabledModule();
    if (enabled2) return enabled2;
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
    const start = now();
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
      } else if (now() - start > 15e3) {
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

  // src/userscripts/control-panel/src/modules/explore/navigation.js
  var PENDING_MOVE_TTL_MS = 2 * 60 * 1e3;
  var VOLATILE_QUERY_PARAMS = /* @__PURE__ */ new Set(["sid"]);
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
  var EMPTY_NAV_STATE = () => ({
    nextLocationId: 1,
    aliasIndex: /* @__PURE__ */ new Map(),
    nodes: /* @__PURE__ */ new Map(),
    pendingMove: null
  });
  function canonicalizeHref(href) {
    if (!href) return "";
    try {
      const url = new URL(href, "https://invalid.example/");
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
      const pathname = url.pathname.replace(/^\//, "");
      const query = normalizedParams.toString();
      const hash = url.hash || "";
      if (!pathname && !query && !hash) {
        return "";
      }
      return `${pathname}${query ? `?${query}` : ""}${hash}`;
    } catch (err) {
      return href;
    }
  }
  function canonicalizeMovement(movement = []) {
    return movement.map((link) => {
      const normalizedHref = canonicalizeHref(link && link.href);
      let key = link ? link.key : "";
      if (key && key.startsWith("move:") && normalizedHref) {
        key = `move:${normalizedHref}`;
      }
      return __spreadProps(__spreadValues({}, link), {
        href: normalizedHref,
        key
      });
    });
  }
  function computeMovementSignature(movement = []) {
    if (!movement.length) return "";
    const parts = movement.map((link) => {
      const direction = link.direction || "";
      const href = link.href || "";
      const label = link.label || "";
      const key = link.key || "";
      return `${direction}|${href}|${label}|${key}`;
    }).sort();
    return parts.join("||");
  }
  function baseKeyIndex(baseKey) {
    return baseKey || "__no_key__";
  }
  function toMap(obj) {
    const map = /* @__PURE__ */ new Map();
    if (!obj) return map;
    for (const [key, value] of Object.entries(obj)) {
      map.set(key, value);
    }
    return map;
  }
  function toSet(arr) {
    const set = /* @__PURE__ */ new Set();
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
  function sanitizePendingMove(raw) {
    if (!raw || typeof raw !== "object") return null;
    const fromKey = typeof raw.fromKey === "string" && raw.fromKey ? raw.fromKey : null;
    const key = typeof raw.key === "string" && raw.key ? raw.key : null;
    if (!fromKey || !key) {
      return null;
    }
    const direction = typeof raw.direction === "string" && raw.direction ? raw.direction : null;
    const returnDirection = typeof raw.returnDirection === "string" && raw.returnDirection ? raw.returnDirection : null;
    const label = typeof raw.label === "string" && raw.label ? raw.label : "";
    const href = typeof raw.href === "string" && raw.href ? canonicalizeHref(raw.href) : "";
    const createdAt = typeof raw.createdAt === "number" ? raw.createdAt : 0;
    return {
      fromKey,
      direction,
      key,
      label,
      href,
      returnDirection,
      createdAt
    };
  }
  function serializePendingMove(pending) {
    if (!pending) return null;
    return {
      fromKey: pending.fromKey || null,
      direction: pending.direction || null,
      key: pending.key || null,
      label: pending.label || null,
      href: pending.href || "",
      returnDirection: pending.returnDirection || null,
      createdAt: pending.createdAt || 0
    };
  }
  function hashKey(str) {
    if (!str) return "";
    let hash = 0;
    for (let i = 0; i < str.length; i += 1) {
      hash = hash * 31 + str.charCodeAt(i) | 0;
    }
    return (hash >>> 0).toString(16);
  }
  function parseDirectionalLabel(text) {
    const raw = text ? text.trim() : "";
    if (!raw) {
      return { direction: null, label: "" };
    }
    const withoutArrow = raw.replace(/([←→↑↓])\s*$/, "").trim();
    const arrowMatch = raw.match(/([←→↑↓])\s*$/);
    const arrow = arrowMatch && arrowMatch[1] ? arrowMatch[1] : null;
    let direction = null;
    let label = withoutArrow;
    const prefixMatch = withoutArrow.match(/^(左|右|上|下)\s*[:：]\s*(.+)$/);
    if (prefixMatch) {
      direction = prefixMatch[1];
      label = prefixMatch[2] ? prefixMatch[2].trim() : "";
    }
    if (!direction && arrow && ARROW_DIRECTIONS[arrow]) {
      direction = ARROW_DIRECTIONS[arrow];
    }
    if (!label) {
      label = withoutArrow || raw;
    }
    return { direction, label };
  }
  function computeLocationKey(movement, hint) {
    const normalized = canonicalizeMovement(movement);
    const parts = normalized.map(({ key, href, label }) => `${key}|${href || ""}|${label}`).sort();
    if (hint) {
      parts.unshift(`hint:${hint}`);
    }
    if (!parts.length) {
      return hint || null;
    }
    return parts.join("||");
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
    if (!hint) return "";
    return hint.length > 20 ? `${hint.slice(0, 20)}\u2026` : hint;
  }
  function loadState(storageKey) {
    const raw = loadJSON(storageKey, null);
    if (!raw) {
      return EMPTY_NAV_STATE();
    }
    const state = {
      nextLocationId: Number(raw.nextLocationId) || 1,
      aliasIndex: /* @__PURE__ */ new Map(),
      nodes: /* @__PURE__ */ new Map()
    };
    if (raw.aliasIndex && typeof raw.aliasIndex === "object") {
      for (const [baseKey, aliases] of Object.entries(raw.aliasIndex)) {
        state.aliasIndex.set(baseKey, toSet(aliases));
      }
    }
    if (raw.nodes && typeof raw.nodes === "object") {
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
          movementSignature: node.movementSignature || "",
          neighbors: toMap(node.neighbors),
          linkMeta,
          tried: toSet(node.tried),
          visits: Number(node.visits) || 0,
          firstSeenAt: Number(node.firstSeenAt) || 0,
          lastSeenAt: Number(node.lastSeenAt) || 0
        });
      }
    }
    let pendingMove = sanitizePendingMove(raw.pendingMove);
    if (pendingMove && pendingMove.createdAt && now() - pendingMove.createdAt > PENDING_MOVE_TTL_MS) {
      pendingMove = null;
    }
    state.pendingMove = pendingMove;
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
        lastSeenAt: node.lastSeenAt
      })),
      pendingMove: serializePendingMove(state.pendingMove)
    };
    saveJSON(storageKey, data);
  }
  function formatLocationName(node, { includeHint = true } = {}) {
    if (!node) return "-";
    const visitSuffix = node.visits ? `\xD7${node.visits}` : "";
    const hashPart = node.baseHash ? ` [${node.baseHash}]` : "";
    if (!includeHint) {
      return `${node.alias}${visitSuffix}${hashPart}`;
    }
    const hint = shortenHint(node.lastHint);
    return hint ? `${node.alias}${visitSuffix}${hashPart} (${hint})` : `${node.alias}${visitSuffix}${hashPart}`;
  }
  function formatDirectionSummary(node, state) {
    if (!node) return "-";
    if (!node.linkMeta.size) return "-";
    const entries = Array.from(node.linkMeta.entries()).sort((a, b) => {
      const dirA = a[1].direction;
      const dirB = b[1].direction;
      return directionPriority(dirA) - directionPriority(dirB);
    });
    const parts = [];
    for (const [linkKey, meta] of entries) {
      const dir = meta.direction || "";
      const label = dir || meta.label || linkKey;
      const tried = node.tried.has(linkKey);
      const neighborKey = dir ? node.neighbors.get(dir) : null;
      const neighbor = neighborKey ? state.nodes.get(neighborKey) : null;
      const neighborLabel = neighbor ? formatLocationName(neighbor, { includeHint: false }) : "";
      const suffix = neighborLabel ? `\u2192${neighborLabel}` : "";
      parts.push(`${label}${dir ? "" : "(?)"}:${tried ? "\u2713" : "\xB7"}${suffix}`);
    }
    return parts.join(" / ");
  }
  function reconstructStackSummary(stack, state) {
    if (!stack.length) return "-";
    return stack.map(({ nodeKey }) => {
      const node = nodeKey ? state.nodes.get(nodeKey) : null;
      return node ? formatLocationName(node) : nodeKey || "-";
    }).join(" \u2192 ");
  }
  function formatPendingAction(pendingMove, lastAction, state) {
    const describe = (info) => {
      if (!info) return "-";
      const fromNode = info.fromKey ? state.nodes.get(info.fromKey) : null;
      const origin = fromNode ? formatLocationName(fromNode, { includeHint: false }) : info.fromKey || "-";
      const dir = info.direction ? `(${info.direction})` : "";
      const label = info.label || info.key || "-";
      return `${origin || "-"}\u2192${label}${dir}`;
    };
    if (pendingMove) {
      return describe(pendingMove);
    }
    if (lastAction) {
      return describe(lastAction);
    }
    return "-";
  }
  function formatPlannedRoute(route, state) {
    if (!route.length) return "-";
    const parts = [];
    for (const step of route) {
      const fromNode = step.from ? state.nodes.get(step.from) : null;
      const toNode = step.to ? state.nodes.get(step.to) : null;
      const fromLabel = fromNode ? formatLocationName(fromNode, { includeHint: false }) : step.from || "-";
      const toLabel = toNode ? formatLocationName(toNode, { includeHint: false }) : step.to || "-";
      const dir = step.direction ? `(${step.direction})` : "";
      parts.push(`${fromLabel}${dir}\u2192${toLabel}`);
    }
    return parts.join(" / ");
  }
  function createNavigator({ storageKey, logger = console, tag = "NAV" } = {}) {
    if (!storageKey) {
      throw new Error("createNavigator requires a storageKey");
    }
    const prefix = `[${tag}]`;
    let state = loadState(storageKey);
    let currentLocationKey = null;
    let pendingMove = state.pendingMove ? __spreadValues({}, state.pendingMove) : null;
    let lastNavigationAction = null;
    let navigationStack = [];
    let plannedRoute = [];
    const persist = () => {
      state.pendingMove = pendingMove ? serializePendingMove(pendingMove) : null;
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
          movementSignature: "",
          neighbors: /* @__PURE__ */ new Map(),
          linkMeta: /* @__PURE__ */ new Map(),
          tried: /* @__PURE__ */ new Set(),
          visits: 0,
          firstSeenAt: 0,
          lastSeenAt: 0
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
        set = /* @__PURE__ */ new Set();
        state.aliasIndex.set(indexKey, set);
      }
      set.add(alias);
    };
    const createAlias = (baseKey, hint) => {
      const alias = `loc#${state.nextLocationId++}`;
      if (logger && typeof logger.debug === "function") {
        const preview = baseKey && baseKey.length > 120 ? `${baseKey.slice(0, 117)}\u2026` : baseKey;
        logger.debug(`${prefix} \u521B\u5EFA\u65B0\u4F4D\u7F6E`, alias, {
          baseKey: preview,
          hint
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
        const ordered = candidates.map((alias) => state.nodes.get(alias)).filter(Boolean).sort((a, b) => (b.lastSeenAt || 0) - (a.lastSeenAt || 0));
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
            if (logger && typeof logger.debug === "function") {
              logger.debug(`${prefix} \u901A\u8FC7\u51FA\u5165\u53E3\u6307\u7EB9\u6821\u51C6\u4F4D\u7F6E`, signatureMatches[0], {
                baseHash: hashKey(baseKey)
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
            if (logger && typeof logger.debug === "function") {
              logger.debug(`${prefix} \u901A\u8FC7\u5730\u70B9\u63D0\u793A\u6821\u51C6\u4F4D\u7F6E`, hintMatches[0], {
                baseHash: hashKey(baseKey),
                hint
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
          if (logger && typeof logger.debug === "function") {
            logger.debug(`${prefix} \u901A\u8FC7\u6700\u8FD1\u8BBF\u95EE\u8BB0\u5F55\u63A8\u65AD\u4F4D\u7F6E`, resolved, {
              baseHash: hashKey(baseKey)
            });
          }
          return resolved;
        }
        if (logger && typeof logger.warn === "function") {
          logger.warn(`${prefix} \u65E0\u6CD5\u6839\u636E\u90BB\u63A5\u5173\u7CFB\u89E3\u6790\u4F4D\u7F6E\uFF0C\u521B\u5EFA\u65B0\u522B\u540D`, {
            baseHash: hashKey(baseKey),
            fromKey,
            direction,
            aliasCount: aliasSet.size,
            movementSignature,
            hint
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
    };
    const calibrateNeighbors = (node, movement) => {
      const timestamp = now();
      const seen = /* @__PURE__ */ new Set();
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
        meta.href = canonicalizeHref(link.href) || meta.href || "";
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
      persist();
    };
    const resetAll = () => {
      state = EMPTY_NAV_STATE();
      resetRuntime();
      persist();
    };
    const handleContext = ({ baseLocationKey, movement, hint }) => {
      const normalizedMovement = canonicalizeMovement(movement);
      if (!normalizedMovement.length) {
        if (logger && typeof logger.debug === "function") {
          logger.debug(`${prefix} \u8DF3\u8FC7\u65E0\u51FA\u5165\u53E3\u7684\u9875\u9762`, {
            hint: shortenHint(hint),
            pendingMove: pendingMove ? pendingMove.direction || pendingMove.key : null
          });
        }
        if (currentLocationKey) {
          const node2 = ensureNode(currentLocationKey);
          if (hint) {
            node2.lastHint = hint;
          }
          node2.lastSeenAt = now();
          persist();
        }
        return currentLocationKey;
      }
      if (!baseLocationKey) {
        resetRuntime();
        return null;
      }
      const fromKey = pendingMove ? pendingMove.fromKey : null;
      const moveDirection = pendingMove ? pendingMove.direction : null;
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
      const visited = /* @__PURE__ */ new Set([startKey]);
      const queue = [startKey];
      const prev = /* @__PURE__ */ new Map();
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
      plannedRoute = [];
      const forestMoves = normalizedMovement.filter((link) => link.label === "\u6811\u6797");
      const forestUntried = forestMoves.filter((link) => !node.tried.has(link.key));
      let candidates = forestUntried.length ? forestUntried : forestMoves;
      if (!candidates.length) {
        const untried = normalizedMovement.filter((link) => !node.tried.has(link.key));
        candidates = untried.length ? untried : normalizedMovement;
      }
      if (!candidates.length) {
        return null;
      }
      const chosen = candidates[Math.floor(Math.random() * candidates.length)];
      const returnDirection = chosen.direction ? DIRECTION_OPPOSITES[chosen.direction] || null : null;
      pendingMove = {
        fromKey: locationKey,
        direction: chosen.direction || null,
        key: chosen.key,
        label: chosen.label,
        href: chosen.href || "",
        returnDirection,
        createdAt: now()
      };
      lastNavigationAction = {
        fromKey: locationKey,
        direction: chosen.direction || null,
        label: chosen.direction ? `${chosen.label}(${chosen.direction})` : chosen.label
      };
      const moveLabel = chosen.direction ? `${chosen.label}(${chosen.direction})` : chosen.label;
      persist();
      return {
        el: chosen.el,
        label: moveLabel,
        direction: chosen.direction || null
      };
    };
    const getTelemetry = () => {
      const node = currentLocationKey ? state.nodes.get(currentLocationKey) : null;
      return {
        currentLocationKey,
        locationLabel: node ? formatLocationName(node) : "-",
        directionSummary: formatDirectionSummary(node, state),
        stackSummary: reconstructStackSummary(navigationStack, state),
        pendingAction: formatPendingAction(pendingMove, lastNavigationAction, state),
        locationCount: state.nodes.size,
        plannedRoute: formatPlannedRoute(plannedRoute, state)
      };
    };
    const markMoveFailure = () => {
      pendingMove = null;
      plannedRoute = [];
      persist();
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
      }
    };
  }

  // src/userscripts/control-panel/src/modules/explore/mapModuleFactory.js
  var SCAN_MS = 400;
  var CLICK_COOLDOWN_MS = 1e3;
  var LOOT_BLOCK_REGEX = /捡到[^\n\r]*/g;
  var LOOT_ITEM_REGEX = /(.+?)x(\d+)$/;
  function defaultExtractLocationHint(keywords = []) {
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
    const normalizedKeywords = Array.isArray(keywords) ? keywords.filter((kw) => typeof kw === "string" && kw) : [];
    for (const line of lines) {
      if (normalizedKeywords.some((kw) => line.includes(kw))) {
        return line.slice(0, 80);
      }
    }
    return lines.length ? lines[0].slice(0, 80) : "";
  }
  function createTargetRuleHelpers({ navigator, selectNavigationMove }) {
    const textContent = (node) => node && node.textContent ? node.textContent.trim() : "";
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
          const found = typeof predicate === "function" ? list.find(predicate) : list[0];
          if (!found) return null;
          if (markMoveFailure) navigator.markMoveFailure();
          return { el: found.el, label: label || found.label };
        };
      },
      navigationFallback() {
        return ({ context }) => selectNavigationMove(context);
      }
    };
  }
  function createMapModule(config = {}) {
    const { moduleId, storageKeys = {}, ui = {}, telemetryTag, navigation = {} } = config;
    if (!moduleId) {
      throw new Error("createMapModule requires a moduleId");
    }
    if (!storageKeys.enabled || !storageKeys.stats) {
      throw new Error("createMapModule requires storageKeys.enabled and storageKeys.stats");
    }
    if (!navigation.storageKey) {
      throw new Error("createMapModule requires navigation.storageKey");
    }
    if (typeof navigation.classifyAnchor !== "function") {
      throw new Error("createMapModule requires navigation.classifyAnchor");
    }
    const prefix = ui.prefix || moduleId;
    const statsLegacyKeys = Array.isArray(storageKeys.legacy) ? storageKeys.legacy : [];
    const logTag = telemetryTag || moduleId.toUpperCase();
    const navigator = createNavigator({
      storageKey: navigation.storageKey,
      logger: navigation.logger,
      tag: navigation.tag || logTag
    });
    const selectMove = (context) => navigator.selectNavigationMove({
      movement: context.movement,
      locationKey: context.locationKey
    });
    const targetHelpers = createTargetRuleHelpers({ navigator, selectNavigationMove: selectMove });
    let targetingRules = [];
    if (Array.isArray(config.targetingRules)) {
      targetingRules = config.targetingRules;
    } else if (typeof config.buildTargetingRules === "function") {
      const built = config.buildTargetingRules(targetHelpers);
      targetingRules = Array.isArray(built) ? built : [];
    }
    if (!targetingRules.length) {
      targetingRules = [targetHelpers.navigationFallback()];
    }
    const normalizeLabel = typeof navigation.normalizeLabel === "function" ? navigation.normalizeLabel : (label, text) => label || text;
    const extractHint = typeof config.extractLocationHint === "function" ? config.extractLocationHint : () => defaultExtractLocationHint(config.locationHintKeywords);
    let enabled2 = loadBoolean(storageKeys.enabled);
    let scanCount = 0;
    let clickCount = 0;
    let lastClickAt = 0;
    let lastTarget = "-";
    let targetBreakdown = {};
    let lootTotals = {};
    let seenLoot = /* @__PURE__ */ new Set();
    let scanTimer = null;
    let lastTelemetryDigest = null;
    function loadStats2() {
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
      lastClickAt = typeof stats.lastClickAt === "number" ? stats.lastClickAt : 0;
      lastTarget = stats.lastTarget ? String(stats.lastTarget) : "-";
      targetBreakdown = stats.targetBreakdown && typeof stats.targetBreakdown === "object" ? __spreadValues({}, stats.targetBreakdown) : {};
      lootTotals = stats.lootTotals && typeof stats.lootTotals === "object" ? __spreadValues({}, stats.lootTotals) : {};
    }
    function saveStats2() {
      saveJSON(storageKeys.stats, {
        scanCount,
        clickCount,
        lastClickAt,
        lastTarget,
        targetBreakdown,
        lootTotals
      });
    }
    function announceState2() {
      emitModuleState({ moduleId, enabled: enabled2 });
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
      navigator.resetRuntime();
      lastTelemetryDigest = null;
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
    function mountUI2() {
      const body = $(`#${prefix}-body`);
      if (!body) return;
      body.innerHTML = `
    <div class="kv"><span class="label" data-label="\u72B6\u6001"></span><span
        id="${prefix}-status"
        class="value state"
        data-state="${enabled2 ? "on" : "off"}"
      ></span></div>
    <div class="kv"><span class="label" data-label="\u70B9\u51FB\u6B21\u6570"></span><span
        id="${prefix}-clicks"
        class="value"
        data-value="0"
      ></span></div>
    <div class="kv"><span class="label" data-label="\u4E0A\u6B21\u76EE\u6807"></span><span
        id="${prefix}-last-target"
        class="value"
        data-value="-"
      ></span></div>
    <div class="kv"><span class="label" data-label="\u4E0A\u6B21\u70B9\u51FB"></span><span
        id="${prefix}-last"
        class="value"
        data-value="-"
      ></span></div>
    <div class="kv"><span class="label" data-label="\u8F6E\u8BE2\u6B21\u6570"></span><span
        id="${prefix}-scans"
        class="value"
        data-value="0"
      ></span></div>
    <div class="kv"><span class="label" data-label="\u76EE\u6807\u7EDF\u8BA1"></span><span
        id="${prefix}-targets"
        class="value"
        data-value="-"
      ></span></div>
    <div class="kv"><span class="label" data-label="\u6389\u843D\u7EDF\u8BA1"></span><span
        id="${prefix}-loot"
        class="value"
        data-value="-"
      ></span></div>
  `;
      const toggle = $(`#${prefix}-toggle`);
      if (toggle) {
        toggle.onclick = () => toggleEnabled2();
      }
      const reset = $(`#${prefix}-reset`);
      if (reset) {
        reset.onclick = () => resetStats2();
      }
      updateUI2();
    }
    function logTelemetry(telemetry) {
      if (!telemetry) return;
      const snapshot = JSON.stringify({
        key: telemetry.currentLocationKey || null,
        location: telemetry.locationLabel || "-",
        directions: telemetry.directionSummary || "-",
        stack: telemetry.stackSummary || "-",
        pending: telemetry.pendingAction || "-",
        route: telemetry.plannedRoute || "-",
        nodes: telemetry.locationCount || 0
      });
      if (snapshot === lastTelemetryDigest) {
        return;
      }
      lastTelemetryDigest = snapshot;
      console.info(`[${logTag}] \u5BFC\u822A\u9065\u6D4B`, {
        key: telemetry.currentLocationKey || null,
        location: telemetry.locationLabel || "-",
        directions: telemetry.directionSummary || "-",
        stack: telemetry.stackSummary || "-",
        pending: telemetry.pendingAction || "-",
        route: telemetry.plannedRoute || "-",
        nodes: telemetry.locationCount || 0
      });
    }
    function updateUI2() {
      const status = $(`#${prefix}-status`);
      if (status) {
        status.dataset.state = enabled2 ? "on" : "off";
      }
      const toggle = $(`#${prefix}-toggle`);
      if (toggle) {
        toggle.dataset.mode = enabled2 ? "on" : "off";
        toggle.setAttribute("aria-pressed", enabled2 ? "true" : "false");
      }
      safeText($(`#${prefix}-clicks`), clickCount);
      safeText($(`#${prefix}-last-target`), lastTarget || "-");
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
        const text = el && el.textContent ? el.textContent.trim() : "";
        if (!text) continue;
        const rawHref = el.getAttribute("href") || "";
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
          label: normalizedLabel
        };
        const classification = navigation.classifyAnchor(__spreadValues({}, base));
        const items = Array.isArray(classification) ? classification.filter(Boolean) : classification ? [classification] : [];
        for (const item of items) {
          const entry = __spreadProps(__spreadValues({}, base), {
            key: item.key || `${item.group || "misc"}:${href || normalizedLabel}`,
            label: item.label || normalizedLabel
          });
          switch (item.group) {
            case "movement":
              movement.push(entry);
              break;
            case "attack":
              attack.push(entry);
              break;
            case "gather":
              gather.push(entry);
              break;
            case "misc":
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
        locationKey: baseLocationKey
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
        if (typeof rule !== "function") continue;
        const result = rule(params);
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
        if (result && result.el) {
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
      saveBoolean(storageKeys.enabled, true);
      start();
      updateUI2();
      announceState2();
    }
    function disable2() {
      enabled2 = false;
      saveBoolean(storageKeys.enabled, false);
      stop();
      saveStats2();
      updateUI2();
      announceState2();
      navigator.resetRuntime();
      lastTelemetryDigest = null;
    }
    function toggleEnabled2() {
      if (enabled2) {
        disable2();
      } else {
        enable2();
      }
    }
    function init5() {
      loadStats2();
      mountUI2();
      announceState2();
      if (enabled2) {
        start();
      }
    }
    function pause4() {
      stop();
      saveStats2();
    }
    function resume4() {
      if (enabled2) {
        start();
      }
    }
    return {
      init: init5,
      pause: pause4,
      resume: resume4
    };
  }

  // src/userscripts/control-panel/src/modules/jyg.js
  var module = createMapModule({
    moduleId: "jyg",
    storageKeys: {
      enabled: "jyg_enabled_v1",
      stats: "jyg_stats_v3",
      legacy: ["jyg_stats_v2"]
    },
    ui: {
      prefix: "jyg"
    },
    telemetryTag: "JYG",
    navigation: {
      storageKey: "jyg_nav_state_v1",
      normalizeLabel: (label = "", text = "") => {
        const normalized = label || text || "";
        return normalized.includes("\u6811\u6797") ? "\u6811\u6797" : normalized;
      },
      classifyAnchor: ({ text = "", normalizedLabel, direction, href }) => {
        if (text.includes("\u653B\u51FB\u666F\u9633\u5C97")) {
          return { group: "attack", key: `attack:${href || normalizedLabel}` };
        }
        if (!text.includes("\u653B\u51FB") && text.includes("\u666F\u9633\u5C97\u5927\u866B")) {
          return { group: "attack", key: `boss:${href || normalizedLabel}` };
        }
        if (normalizedLabel === "\u6811\u6797") {
          const key = direction ? `dir:${direction}` : `move:${href || normalizedLabel}`;
          return { group: "movement", key };
        }
        if (text.includes("\u7075\u829D")) {
          return { group: "gather", key: `loot:${href || normalizedLabel}` };
        }
        if (text.includes("\u8FD4\u56DE\u6E38\u620F")) {
          return { group: "misc", key: `return:${href || normalizedLabel}` };
        }
        return null;
      }
    },
    locationHintKeywords: ["\u666F\u9633\u5C97", "\u6811\u6797"],
    buildTargetingRules: (helpers) => [
      helpers.byExact("\u653B\u51FB\u666F\u9633\u5C97\u5C0F\u5927\u866B"),
      helpers.byExact("\u653B\u51FB\u666F\u9633\u5C97\u5927\u866B"),
      helpers.byExact("\u666F\u9633\u5C97\u5927\u866B"),
      helpers.byExact("\u666F\u9633\u5C97\u5C0F\u5927\u866B"),
      helpers.byContextFirst("gather"),
      helpers.byIncludes("\u7075\u829D", { label: "\u7075\u829D" }),
      helpers.byContextFind("misc", (item) => item.label && item.label.includes("\u8FD4\u56DE")),
      helpers.byExact("\u8FD4\u56DE\u6E38\u620F"),
      helpers.navigationFallback()
    ]
  });
  var init2 = module.init;
  var pause2 = module.pause;
  var resume2 = module.resume;

  // src/userscripts/control-panel/src/modules/baicai.js
  var baicai_exports = {};
  __export(baicai_exports, {
    init: () => init3,
    pause: () => pause3,
    resume: () => resume3
  });
  var module2 = createMapModule({
    moduleId: "bc",
    storageKeys: {
      enabled: "bc_enabled_v1",
      stats: "bc_stats_v1"
    },
    ui: {
      prefix: "bc"
    },
    telemetryTag: "BAICAI",
    navigation: {
      storageKey: "bc_nav_state_v1",
      normalizeLabel: (label = "", text = "") => {
        const normalized = label || text || "";
        return normalized.includes("\u83DC\u7566") ? "\u83DC\u7566" : normalized;
      },
      classifyAnchor: ({ text = "", normalizedLabel, direction, href }) => {
        if (text.includes("\u653B\u51FB\u5077\u83DC\u76D7\u8D3C\u9996\u9886")) {
          return { group: "attack", key: `boss:${href || normalizedLabel}` };
        }
        if (text.includes("\u653B\u51FB\u5077\u83DC\u76D7\u8D3C")) {
          return { group: "attack", key: `attack:${href || normalizedLabel}` };
        }
        if (!text.includes("\u653B\u51FB") && text.includes("\u5077\u83DC\u76D7\u8D3C\u9996\u9886")) {
          return { group: "attack", key: `boss:${href || normalizedLabel}` };
        }
        if (normalizedLabel === "\u83DC\u7566") {
          const key = direction ? `dir:${direction}` : `move:${href || normalizedLabel}`;
          return { group: "movement", key };
        }
        if (text.includes("\u7075\u829D") || text.includes("\u767D\u83DC")) {
          return { group: "gather", key: `loot:${href || normalizedLabel}` };
        }
        if (text.includes("\u8FD4\u56DE\u6E38\u620F")) {
          return { group: "misc", key: `return:${href || normalizedLabel}` };
        }
        return null;
      }
    },
    locationHintKeywords: ["\u83DC\u7566"],
    buildTargetingRules: (helpers) => [
      helpers.byExact("\u653B\u51FB\u5077\u83DC\u76D7\u8D3C"),
      helpers.byExact("\u653B\u51FB\u5077\u83DC\u76D7\u8D3C\u9996\u9886"),
      helpers.byExact("\u5077\u83DC\u76D7\u8D3C\u9996\u9886"),
      helpers.byExact("\u5077\u83DC\u76D7\u8D3C"),
      helpers.byContextFirst("gather"),
      helpers.byIncludes("\u7075\u829D", { label: "\u7075\u829D" }),
      helpers.byIncludes("\u767D\u83DC", { label: "\u767D\u83DC" }),
      helpers.byContextFind("misc", (item) => item.label && item.label.includes("\u8FD4\u56DE")),
      helpers.byExact("\u8FD4\u56DE\u6E38\u620F"),
      helpers.navigationFallback()
    ]
  });
  var init3 = module2.init;
  var pause3 = module2.pause;
  var resume3 = module2.resume;

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
  function init4() {
    injectStyle();
    ensurePanel();
    init();
    init2();
    init3();
    startWatchdog([rm_exports, jyg_exports, baicai_exports]);
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init4);
  } else {
    init4();
  }
})();
