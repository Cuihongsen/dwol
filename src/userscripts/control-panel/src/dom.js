export const $ = (selector, root = document) => root.querySelector(selector);

export const $$ = (selector, root = document) =>
  Array.from(root.querySelectorAll(selector));

export const safeText = (el, text) => {
  if (!el) return;
  el.textContent = '';
  if (text === undefined || text === null) {
    el.removeAttribute('data-value');
    return;
  }
  el.setAttribute('data-value', String(text));
};

export const now = () => Date.now();

export const formatTime = (timestamp) =>
  timestamp ? new Date(timestamp).toLocaleTimeString() : '-';
