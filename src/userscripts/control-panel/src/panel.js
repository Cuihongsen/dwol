import { $, setPseudoText } from './dom.js';

const PANEL_STYLE_ID = 'um-style';
const PANEL_ID = 'um-panel';

const PANEL_STYLE = `
#um-panel{position:fixed;right:16px;bottom:16px;width:320px;max-width:calc(100vw - 32px);z-index:2147483647;font:12px/1.5 system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;background:rgba(17,24,39,.92);color:#f8fafc;border-radius:18px;backdrop-filter:blur(12px);box-shadow:0 20px 48px rgba(15,23,42,.45);overflow:hidden;letter-spacing:.2px}
#um-panel .sec{border-top:1px solid rgba(148,163,184,.14)}
#um-panel .sec:first-child{border-top:none}
#um-panel .hdr{display:flex;align-items:center;justify-content:space-between;padding:14px 16px;background:rgba(30,41,59,.6)}
#um-panel .hdr b{font-weight:600;font-size:13px;color:#e2e8f0;text-transform:uppercase;letter-spacing:.8px}
#um-panel .body{padding:14px 16px;display:grid;gap:12px;background:rgba(15,23,42,.35)}
#um-panel .kv{display:flex;align-items:center;justify-content:space-between;gap:12px}
#um-panel .kv span:first-child{color:#94a3b8;font-size:12px;text-transform:uppercase;letter-spacing:.6px}
#um-panel .kv span:last-child{font-size:13px;font-variant-numeric:tabular-nums;font-weight:600;color:#f8fafc}
#um-panel .status{padding:2px 10px;border-radius:999px;background:rgba(34,197,94,.18);color:#bbf7d0;font-weight:600;font-size:12px;text-transform:none}
#um-panel .status.off{background:rgba(248,113,113,.2);color:#fecaca}
#um-panel button{border:none;background:linear-gradient(135deg,#38bdf8,#6366f1);color:#0f172a;border-radius:999px;padding:6px 16px;cursor:pointer;font-weight:600;font-size:12px;box-shadow:0 12px 32px rgba(99,102,241,.35);transition:transform .2s ease,box-shadow .2s ease}
#um-panel button:hover{transform:translateY(-1px);box-shadow:0 16px 40px rgba(99,102,241,.5)}
#um-panel button:active{transform:translateY(0);box-shadow:0 8px 24px rgba(99,102,241,.3)}
#um-panel .um-text{position:relative;display:inline-flex;align-items:center;min-height:1em}
#um-panel .um-text::before{content:attr(data-text);white-space:pre}
`;

function buildSection(title, idPrefix) {
  const sec = document.createElement('div');
  sec.className = 'sec';

  const header = document.createElement('div');
  header.className = 'hdr';

  const label = document.createElement('b');
  setPseudoText(label, title);

  const toggle = document.createElement('button');
  toggle.id = `${idPrefix}-toggle`;
  setPseudoText(toggle, '开启');

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
