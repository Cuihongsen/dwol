import { $ } from './dom.js';
import { MODULE_STATE_EVENT } from './events.js';
import { LS_ACTIVE_MODULE, MODULES, PANEL_ID } from './constants.js';

let navButtons = [];
let sections = [];
let currentActiveModule = null;
let listenersBound = false;

function buildSection(title, idPrefix) {
  const sec = document.createElement('section');
  sec.className = 'module';
  sec.dataset.module = idPrefix;

  const header = document.createElement('div');
  header.className = 'hdr';

  const label = document.createElement('b');
  label.textContent = title;

  const actions = document.createElement('div');
  actions.className = 'actions';

  const toggle = document.createElement('button');
  toggle.id = `${idPrefix}-toggle`;
  toggle.type = 'button';
  toggle.dataset.mode = 'off';
  toggle.dataset.role = 'toggle';
  toggle.textContent = '开启';
  toggle.setAttribute('aria-pressed', 'false');
  toggle.setAttribute('aria-label', `${title} 模块开关`);

  const reset = document.createElement('button');
  reset.id = `${idPrefix}-reset`;
  reset.type = 'button';
  reset.dataset.role = 'reset';
  reset.textContent = '清空统计';
  reset.setAttribute('aria-label', `${title} 统计清空`);

  actions.append(toggle, reset);

  header.append(label, actions);

  const body = document.createElement('div');
  body.className = 'body';
  body.id = `${idPrefix}-body`;

  sec.append(header, body);

  return sec;
}

function createNavButton(mod, isActive) {
  const button = document.createElement('button');
  button.type = 'button';
  button.dataset.module = mod.id;
  button.dataset.active = isActive ? 'true' : 'false';
  button.textContent = mod.title;
  button.setAttribute('aria-label', `${mod.title} 面板`);
  button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
  button.addEventListener('click', () => focusModule(mod.id));
  return button;
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
    const button = createNavButton(mod, index === 0);
    nav.append(button);
    navButtons.push(button);

    const section = buildSection(mod.title, mod.id);
    if (index === 0) {
      section.dataset.active = 'true';
    } else {
      section.dataset.active = 'false';
      section.setAttribute('hidden', '');
    }
    modulesWrap.append(section);
    sections.push(section);
  }

  panel.append(nav, modulesWrap);

  document.body.append(panel);

  const initial = chooseInitialModule();
  if (initial) {
    activate(initial, { persist: false });
  }
}
