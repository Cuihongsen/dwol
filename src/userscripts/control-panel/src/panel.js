import { $ } from './dom.js';
import { MODULE_STATE_EVENT } from './events.js';

const PANEL_STYLE_ID = 'um-style';
const PANEL_ID = 'um-panel';
const LS_ACTIVE_MODULE = 'um_active_module_v1';

const MODULES = [
  { id: 'rm', title: '刷新马', enabledKey: 'rm_enabled_v1' },
  { id: 'jyg', title: '景阳岗', enabledKey: 'jyg_enabled_v1' },
  { id: 'atk', title: '自动打怪', enabledKey: 'atk_enabled_v1' },
  { id: 'kgq', title: '金刚圈', enabledKey: 'kgq_enabled_v1' },
];

let navButtons = [];
let sections = [];
let currentActiveModule = null;
let listenersBound = false;

const PANEL_STYLE = `
:root{color-scheme:light}
body{margin:0;min-height:100vh;background:#f8fafc;color:#0f172a;font:13px/1.6 'Inter',system-ui,-apple-system,'PingFang SC',sans-serif;-webkit-font-smoothing:antialiased}
body>*:not(#um-panel){max-width:920px;margin-inline:auto;padding:0 22px}
main,section,article{display:block;margin-inline:auto;max-width:920px}
p{margin:12px auto;max-width:70ch}
li{max-width:70ch}
a{color:#2563eb;text-decoration:none}
a:hover{text-decoration:underline}
pre,code{font-family:'JetBrains Mono','Fira Code',ui-monospace,monospace}
pre{background:#f1f5f9;border:1px solid #cbd5f5;border-radius:12px;padding:12px;overflow:auto;color:#0f172a}
table{width:auto;max-width:100%;border-collapse:collapse;background:#fff;border:1px solid #d0d7ea;border-radius:12px;overflow:hidden}
th,td{padding:8px 10px;border-bottom:1px solid #e2e8f0;text-align:left}
th{color:#0f172a;font-weight:600;background:#e2e8f0}
tr:last-child td{border-bottom:none}
#um-panel{position:fixed;right:16px;bottom:16px;width:240px;z-index:2147483647;font:11px/1.55 'Inter',system-ui,-apple-system,'PingFang SC',sans-serif;color:#0f172a;background:#fff;border:1px solid #d0d7ea;border-radius:16px;box-shadow:0 12px 32px rgba(15,23,42,.14);overflow:hidden}
#um-panel .nav{display:flex;gap:6px;padding:10px 12px 6px;background:#f8fafc;border-bottom:1px solid #e2e8f0}
#um-panel .nav button{flex:1;border:1px solid transparent;border-radius:10px;padding:7px 0;background:transparent;cursor:pointer;transition:background .16s ease,border-color .16s ease,color .16s ease;min-width:0;font-weight:600;letter-spacing:.04em;color:#475569}
#um-panel .nav button[data-active="true"]{background:#e0f2fe;border-color:#bfdbfe;color:#1d4ed8}
#um-panel .nav button:focus-visible{outline:2px solid #38bdf8;outline-offset:2px}
#um-panel .modules{padding:6px 12px 12px}
#um-panel .module{display:none}
#um-panel .module[data-active="true"]{display:block}
#um-panel .hdr{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px}
#um-panel .hdr b{position:relative;font-weight:700;letter-spacing:.04em;flex:1;color:#0f172a}
#um-panel .hdr b::before{content:attr(data-label)}
#um-panel .hdr .actions{display:flex;align-items:center;gap:6px}
#um-panel .hdr .actions button{min-width:64px;padding:4px 12px;border-radius:999px;border:1px solid #cbd5e1;background:#f8fafc;cursor:pointer;color:#1e293b;transition:transform .12s ease,box-shadow .12s ease,border-color .12s ease;font-size:10px;letter-spacing:.08em;font-weight:600}
#um-panel .hdr .actions button:hover{border-color:#94a3b8;box-shadow:0 2px 8px rgba(15,23,42,.08);transform:translateY(-1px)}
#um-panel .hdr .actions button:active{transform:translateY(0)}
#um-panel .hdr .actions button:focus-visible{outline:2px solid #38bdf8;outline-offset:1px}
#um-panel .hdr .actions button[data-role="toggle"][data-mode="on"]::before{content:'关闭'}
#um-panel .hdr .actions button[data-role="toggle"][data-mode="off"]::before{content:'开启'}
#um-panel .hdr .actions button[data-role="reset"]{min-width:72px;background:#fef9c3;border-color:#f5d742;color:#92400e}
#um-panel .hdr .actions button[data-role="reset"]::before{content:'清空统计'}
#um-panel .body{padding:10px 12px;display:flex;flex-direction:column;gap:6px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px}
#um-panel .kv{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding:2px 0}
#um-panel .kv .label::before{content:attr(data-label);color:#475569;font-size:10px;letter-spacing:.04em;white-space:nowrap}
#um-panel .kv .value{position:relative;font-variant-numeric:tabular-nums;text-align:right}
#um-panel .kv .value::before{content:attr(data-value);color:#0f172a;font-size:11px}
#um-panel .kv .state[data-state="on"]::before{content:'运行中';color:#15803d;font-weight:700}
#um-panel .kv .state[data-state="off"]::before{content:'关闭中';color:#dc2626;font-weight:700}
#um-panel .hint::before{content:attr(data-label);color:#64748b;font-size:9px;letter-spacing:.04em}
#um-panel .global{padding:10px 12px 14px;display:flex;flex-direction:column;gap:8px;background:#fff;border-top:1px solid #e2e8f0}
`;

function buildSection(title, idPrefix) {
  const sec = document.createElement('section');
  sec.className = 'module';
  sec.dataset.module = idPrefix;

  const header = document.createElement('div');
  header.className = 'hdr';

  const label = document.createElement('b');
  label.setAttribute('data-label', title);

  const actions = document.createElement('div');
  actions.className = 'actions';

  const reset = document.createElement('button');
  reset.id = `${idPrefix}-reset`;
  reset.type = 'button';
  reset.dataset.role = 'reset';
  reset.setAttribute('aria-label', `${title} 统计清空`);

  const toggle = document.createElement('button');
  toggle.id = `${idPrefix}-toggle`;
  toggle.type = 'button';
  toggle.dataset.mode = 'off';
  toggle.dataset.role = 'toggle';
  toggle.setAttribute('aria-pressed', 'false');
  toggle.setAttribute('aria-label', `${title} 模块开关`);

  actions.appendChild(toggle);
  actions.appendChild(reset);

  header.appendChild(label);
  header.appendChild(actions);

  const body = document.createElement('div');
  body.className = 'body';
  body.id = `${idPrefix}-body`;

  sec.appendChild(header);
  sec.appendChild(body);

  return sec;
}

function pickEnabledModule(excludeId = null) {
  for (const mod of MODULES) {
    if (excludeId && mod.id === excludeId) continue;
    if (localStorage.getItem(mod.enabledKey) === '1') {
      return mod.id;
    }
  }
  return null;
}

function chooseInitialModule() {
  const stored = localStorage.getItem(LS_ACTIVE_MODULE);
  if (stored && MODULES.some((mod) => mod.id === stored)) {
    return stored;
  }
  const enabled = pickEnabledModule();
  if (enabled) return enabled;
  return MODULES[0]?.id ?? null;
}

function activate(moduleId, { persist = true } = {}) {
  if (!moduleId) return;
  if (!MODULES.some((mod) => mod.id === moduleId)) return;
  currentActiveModule = moduleId;
  for (const btn of navButtons) {
    const active = btn.dataset.module === moduleId;
    btn.dataset.active = active ? 'true' : 'false';
    btn.setAttribute('aria-pressed', active ? 'true' : 'false');
  }
  for (const sec of sections) {
    const active = sec.dataset.module === moduleId;
    sec.dataset.active = active ? 'true' : 'false';
    if (active) {
      sec.removeAttribute('hidden');
    } else {
      sec.setAttribute('hidden', '');
    }
  }
  if (persist) {
    localStorage.setItem(LS_ACTIVE_MODULE, moduleId);
  }
}

export function focusModule(moduleId, options) {
  activate(moduleId, options);
}

function bindModuleStateListener() {
  if (listenersBound) return;
  window.addEventListener(MODULE_STATE_EVENT, (event) => {
    const detail = event?.detail;
    if (!detail || !detail.moduleId) return;
    if (detail.enabled) {
      focusModule(detail.moduleId);
    } else if (currentActiveModule === detail.moduleId) {
      const next = pickEnabledModule(detail.moduleId) || MODULES[0]?.id;
      focusModule(next, { persist: true });
    }
  });
  listenersBound = true;
}

export function injectStyle() {
  if ($(`#${PANEL_STYLE_ID}`)) return;
  const style = document.createElement('style');
  style.id = PANEL_STYLE_ID;
  style.textContent = PANEL_STYLE;
  document.head.appendChild(style);
}

export function ensurePanel() {
  bindModuleStateListener();
  if ($(`#${PANEL_ID}`)) {
    const initialExisting = chooseInitialModule();
    if (initialExisting) {
      activate(initialExisting, { persist: false });
    }
    return;
  }

  const panel = document.createElement('div');
  panel.id = PANEL_ID;

  const nav = document.createElement('div');
  nav.className = 'nav';

  const modulesWrap = document.createElement('div');
  modulesWrap.className = 'modules';

  navButtons = [];
  sections = [];

  for (const [index, mod] of MODULES.entries()) {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.module = mod.id;
    button.dataset.label = mod.title;
    button.setAttribute('aria-label', `${mod.title} 面板`);
    button.setAttribute('aria-pressed', index === 0 ? 'true' : 'false');
    button.dataset.active = index === 0 ? 'true' : 'false';
    button.addEventListener('click', () => focusModule(mod.id));
    nav.appendChild(button);
    navButtons.push(button);

    const section = buildSection(mod.title, mod.id);
    if (index === 0) {
      section.dataset.active = 'true';
    } else {
      section.dataset.active = 'false';
      section.setAttribute('hidden', '');
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
