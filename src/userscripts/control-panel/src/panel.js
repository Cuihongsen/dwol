import { $ } from './dom.js';

const PANEL_STYLE_ID = 'um-style';
const PANEL_ID = 'um-panel';

const PANEL_STYLE = `
#um-panel{position:fixed;right:16px;bottom:16px;width:320px;z-index:2147483647;font:12px/1.4 system-ui,-apple-system,Segoe UI,Roboto;background:#fff;color:#111;border:1px solid #e5e7eb;border-radius:12px;box-shadow:0 6px 24px rgba(0,0,0,.12);overflow:hidden}
#um-panel .sec{border-top:1px solid #f1f5f9}
#um-panel .hdr{display:flex;align-items:center;justify-content:space-between;padding:10px 12px;background:#f8fafc}
#um-panel .hdr b{font-weight:700}
#um-panel .body{padding:10px 12px;display:grid;gap:6px}
#um-panel .kv{display:flex;justify-content:space-between}
#um-panel .muted{color:#6b7280}
#um-panel button{border:1px solid #e5e7eb;background:#fff;border-radius:8px;padding:4px 8px;cursor:pointer}
#um-panel button:hover{background:#f3f4f6}
`;

function buildSection(title, idPrefix) {
  const sec = document.createElement('div');
  sec.className = 'sec';

  const header = document.createElement('div');
  header.className = 'hdr';

  const label = document.createElement('b');
  label.textContent = title;

  const toggle = document.createElement('button');
  toggle.id = `${idPrefix}-toggle`;
  toggle.textContent = '开启';

  header.appendChild(label);
  header.appendChild(toggle);

  const body = document.createElement('div');
  body.className = 'body';
  body.id = `${idPrefix}-body`;

  sec.appendChild(header);
  sec.appendChild(body);

  return sec;
}

export function injectStyle() {
  if ($(`#${PANEL_STYLE_ID}`)) return;
  const style = document.createElement('style');
  style.id = PANEL_STYLE_ID;
  style.textContent = PANEL_STYLE;
  document.head.appendChild(style);
}

export function ensurePanel() {
  if ($(`#${PANEL_ID}`)) return;
  const panel = document.createElement('div');
  panel.id = PANEL_ID;
  panel.appendChild(buildSection('刷新马', 'rm'));
  panel.appendChild(buildSection('景阳岗', 'jyg'));
  document.body.appendChild(panel);
}
