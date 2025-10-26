import { ensurePanel, injectStyle } from './panel.js';
import * as RM from './modules/rm.js';
import * as JYG from './modules/jyg.js';
import { startWatchdog } from './watchdog.js';

function init() {
  injectStyle();
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
