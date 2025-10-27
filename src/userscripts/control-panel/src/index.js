import { ensurePanel } from './panel.js';
import * as RM from './modules/rm.js';
import * as JYG from './modules/jyg.js';
import { startWatchdog } from './watchdog.js';
import { injectPanelTheme } from './styles/injector.js';

function init() {
  injectPanelTheme();
  ensurePanel();
  RM.init();
  JYG.init();
  startWatchdog([RM, JYG]);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
