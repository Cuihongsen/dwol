import { $ } from './dom.js';
import {
  isWatchdogEnabled,
  setWatchdogEnabled,
  subscribeWatchdogState,
} from './watchdog.js';

const WATCHDOG_ID = 'watchdog-controls';
const TOGGLE_ID = 'watchdog-toggle';
const STATUS_ID = 'watchdog-status';

function updateUI(enabled) {
  const status = $(`#${STATUS_ID}`);
  if (status) {
    status.dataset.state = enabled ? 'on' : 'off';
  }
  const toggle = $(`#${TOGGLE_ID}`);
  if (toggle) {
    toggle.dataset.mode = enabled ? 'on' : 'off';
    toggle.setAttribute('aria-pressed', enabled ? 'true' : 'false');
  }
}

function bindHandlers() {
  const toggle = $(`#${TOGGLE_ID}`);
  if (toggle) {
    toggle.onclick = () => setWatchdogEnabled(!isWatchdogEnabled());
  }
}

export function mountWatchdogControls() {
  const panel = $('#um-panel');
  if (!panel) return;
  if ($(`#${WATCHDOG_ID}`)) {
    updateUI(isWatchdogEnabled());
    return;
  }

  const global = document.createElement('div');
  global.id = WATCHDOG_ID;
  global.className = 'global';
  global.innerHTML = `
    <div class="hdr">
      <b data-label="全局"></b>
      <div class="actions">
        <button
          id="${TOGGLE_ID}"
          type="button"
          data-role="toggle"
          data-mode="${isWatchdogEnabled() ? 'on' : 'off'}"
          aria-label="访问频繁自动继续开关"
          aria-pressed="${isWatchdogEnabled() ? 'true' : 'false'}"
        ></button>
      </div>
    </div>
    <div class="body">
      <div class="kv">
        <span class="label" data-label="访问频繁自动继续"></span>
        <span
          id="${STATUS_ID}"
          class="value state"
          data-state="${isWatchdogEnabled() ? 'on' : 'off'}"
        ></span>
      </div>
      <div class="hint" data-label="出现“您的点击频度过快”时自动暂停各模块并点击“继续”。"></div>
    </div>
  `;

  panel.appendChild(global);
  bindHandlers();
  subscribeWatchdogState(updateUI);
  updateUI(isWatchdogEnabled());
}
