import { $ } from '../dom.js';
import { PANEL_STYLE_ID } from '../constants.js';
import { PANEL_THEME } from './theme.js';

export function injectPanelTheme() {
  if ($(`#${PANEL_STYLE_ID}`)) return;
  const style = document.createElement('style');
  style.id = PANEL_STYLE_ID;
  style.textContent = PANEL_THEME;
  document.head.append(style);
}
