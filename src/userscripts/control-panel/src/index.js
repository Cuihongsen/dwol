import { ensurePanel, injectStyle } from './panel.js';
import * as RM from './modules/rm.js';
import * as JYG from './modules/jyg.js';
import * as ATK from './modules/atk.js';
import * as KGQ from './modules/kgq.js';
import { startWatchdog } from './watchdog.js';
import { initMapHotkeys } from './map-hotkeys.js';
import { mountWatchdogControls } from './watchdog-ui.js';

function init() {
  injectStyle();
  ensurePanel();
  RM.init();
  JYG.init();
  ATK.init();
  KGQ.init();
  initMapHotkeys();
  mountWatchdogControls();
  startWatchdog([RM, JYG, ATK, KGQ]);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
