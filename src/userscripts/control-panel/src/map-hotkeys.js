import { parseDirectionalLabel } from './modules/jyg/navigation.js';

const KEY_DIRECTION = {
  ArrowUp: '上',
  ArrowDown: '下',
  ArrowLeft: '左',
  ArrowRight: '右',
};

const IGNORE_TAGS = new Set(['input', 'textarea', 'select', 'option', 'button']);

let hotkeysBound = false;

function isTextInput(target) {
  if (!target || !target.tagName) return false;
  const tag = target.tagName.toLowerCase();
  if (IGNORE_TAGS.has(tag)) return true;
  if (tag === 'div' && target.isContentEditable) return true;
  return false;
}

function matchDirection(el, direction) {
  if (!el) return false;
  const dataDir = el.dataset && el.dataset.direction ? el.dataset.direction.trim() : '';
  if (dataDir === direction) return true;
  const text = el.textContent ? el.textContent.trim() : '';
  if (!text) return false;
  if (text === direction) return true;
  const parsed = parseDirectionalLabel(text);
  return parsed.direction === direction;
}

function clickDirection(direction) {
  const mapContainer = document.querySelector('#ly_map');
  const anchorNodes = [];
  if (mapContainer) {
    anchorNodes.push(...mapContainer.querySelectorAll('a'));
  }
  anchorNodes.push(...document.querySelectorAll('a'));

  for (const anchor of anchorNodes) {
    if (matchDirection(anchor, direction)) {
      anchor.click();
      return true;
    }
  }
  return false;
}

function onKeydown(event) {
  if (event.defaultPrevented) return;
  if (event.altKey || event.ctrlKey || event.metaKey) return;
  const direction = KEY_DIRECTION[event.key];
  if (!direction) return;
  if (isTextInput(event.target)) return;
  const clicked = clickDirection(direction);
  if (clicked) {
    event.preventDefault();
  }
}

export function initMapHotkeys() {
  if (hotkeysBound) return;
  window.addEventListener('keydown', onKeydown);
  hotkeysBound = true;
}
