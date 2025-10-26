import { $ } from './dom.js';

const PANEL_STYLE_ID = 'um-style';
const PANEL_ID = 'um-panel';

const PANEL_STYLE = `
:root{color-scheme:light}
body{margin:0;min-height:100vh;background:linear-gradient(180deg,#f8fafc 0%,#e2e8f0 100%);color:#1f2937;font:13px/1.7 'Inter',system-ui,-apple-system,'PingFang SC',sans-serif;-webkit-font-smoothing:antialiased}
body>*:not(#um-panel){max-width:920px;margin-inline:auto;padding:0 24px}
main,section,article{display:block;margin-inline:auto;max-width:920px}
p{margin:14px auto;max-width:70ch}
li{max-width:70ch}
a{color:#2563eb;text-decoration:none}
a:hover{color:#7c3aed}
pre,code{font-family:'JetBrains Mono','Fira Code',ui-monospace,monospace}
pre{background:#f1f5f9;border:1px solid #cbd5f5;border-radius:12px;padding:16px;overflow:auto;color:#0f172a}
table{width:100%;border-collapse:collapse;background:#f8fafc;border:1px solid #d0d7ea;border-radius:12px;overflow:hidden}
th,td{padding:10px 14px;border-bottom:1px solid #e2e8f0;text-align:left}
th{color:#0f172a;font-weight:600;background:#e2e8f0}
tr:last-child td{border-bottom:none}
#um-panel{position:fixed;right:16px;bottom:16px;width:286px;z-index:2147483647;font:12px/1.55 'Inter',system-ui,-apple-system,'PingFang SC',sans-serif;color:#0f172a;background:linear-gradient(135deg,#ffffff 0%,#f1f5f9 100%);border:1px solid rgba(148,163,184,.38);border-radius:16px;box-shadow:0 16px 42px rgba(15,23,42,.14);backdrop-filter:blur(9px);overflow:hidden}
#um-panel::after{content:'';position:absolute;inset:1px;border-radius:14px;pointer-events:none;background:linear-gradient(130deg,rgba(255,255,255,.6),rgba(148,163,184,.16) 40%,transparent 75%)}
#um-panel .sec{position:relative;border-top:1px solid rgba(148,163,184,.22)}
#um-panel .sec:first-child{border-top:none}
#um-panel .hdr{display:flex;align-items:center;justify-content:space-between;padding:12px 16px 10px;background:rgba(226,232,240,.6)}
#um-panel .hdr b{position:relative;font-weight:600;letter-spacing:.04em}
#um-panel .hdr b::before{content:attr(data-label);display:block;color:#1d4ed8;text-shadow:0 2px 6px rgba(148,163,184,.28)}
#um-panel .hdr button{position:relative;min-width:72px;padding:5px 14px;border-radius:999px;border:1px solid rgba(59,130,246,.45);background:linear-gradient(135deg,#cfe1ff,#e3edff);box-shadow:inset 0 1px 0 rgba(255,255,255,.85);cursor:pointer;color:#1d4ed8;transition:all .2s ease;font-size:11px;letter-spacing:.08em}
#um-panel .hdr button:hover{border-color:rgba(59,130,246,.75);box-shadow:inset 0 1px 0 rgba(255,255,255,.85),0 4px 12px rgba(59,130,246,.22);transform:translateY(-1px)}
#um-panel .hdr button:active{transform:translateY(0)}
#um-panel .hdr button::before{content:'';font-weight:600}
#um-panel .hdr button[data-mode="on"]::before{content:'关闭'}
#um-panel .hdr button[data-mode="off"]::before{content:'开启'}
#um-panel .body{padding:12px 16px 14px;display:grid;gap:8px;background:rgba(248,250,252,.88)}
#um-panel .kv{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding:4px 0}
#um-panel .kv:not(:last-child){border-bottom:1px dashed rgba(148,163,184,.32)}
#um-panel .kv .label::before{content:attr(data-label);color:#475569;font-size:11px;letter-spacing:.04em;white-space:nowrap}
#um-panel .kv .value{position:relative;font-variant-numeric:tabular-nums;text-align:right}
#um-panel .kv .value::before{content:attr(data-value);color:#0f172a;font-size:12px}
#um-panel .kv .state[data-state="on"]::before{content:'运行中';color:#15803d;font-weight:600;text-shadow:0 0 8px rgba(74,222,128,.35)}
#um-panel .kv .state[data-state="off"]::before{content:'关闭中';color:#dc2626;font-weight:600;text-shadow:0 0 6px rgba(248,113,113,.3)}
#um-panel .hint::before{content:attr(data-label);color:#64748b;font-size:10px;letter-spacing:.04em}
`;

function buildSection(title, idPrefix) {
  const sec = document.createElement('div');
  sec.className = 'sec';

  const header = document.createElement('div');
  header.className = 'hdr';

  const label = document.createElement('b');
  label.setAttribute('data-label', title);

  const toggle = document.createElement('button');
  toggle.id = `${idPrefix}-toggle`;
  toggle.type = 'button';
  toggle.dataset.mode = 'off';
  toggle.setAttribute('aria-pressed', 'false');
  toggle.setAttribute('aria-label', `${title} 模块开关`);

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
