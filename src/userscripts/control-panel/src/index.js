import { ensurePanel, injectStyle, setPanelModules } from './panel.js';
import * as RM from './modules/rm.js';
import { configuredExploreModules } from './modules/explore/index.js';
import { startWatchdog } from './watchdog.js';

function init() {
  injectStyle();
  const exploreEntries = configuredExploreModules;
  const modules = [RM, ...exploreEntries.map((entry) => entry.module)];
  setPanelModules([
    { id: 'rm', title: '刷新马', enabledKey: 'rm_enabled_v1' },
    ...exploreEntries.map((entry) => ({
      id: entry.moduleId,
      title: entry.title,
      enabledKey: entry.enabledKey,
    })),
  ]);
  ensurePanel();
  for (const mod of modules) {
    mod.init();
  }
  startWatchdog(modules);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
