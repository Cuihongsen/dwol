import { $$ } from './dom.js';

// Global throttle watcher: when the page shows the anti-frequent-access warning,
// pause all running modules, wait briefly, auto-click the "继续" link, and resume.
const WATCH_INTERVAL_MS = 300;
const CONTINUE_DELAY_MS = 1000;

export function startWatchdog(modules) {
  let throttled = false;
  setInterval(() => {
    if (throttled) return;
    const text = document.body ? document.body.innerText : '';
    if (text.indexOf('您的点击频度过快') >= 0) {
      throttled = true;
      modules.forEach((mod) => mod.pause());
      setTimeout(() => {
        const cont = $$('a').find(
          (el) => el.textContent && el.textContent.trim() === '继续'
        );
        if (cont) cont.click();
        throttled = false;
        modules.forEach((mod) => mod.resume());
      }, CONTINUE_DELAY_MS);
    }
  }, WATCH_INTERVAL_MS);
}
