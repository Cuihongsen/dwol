import { $ } from './dom.js';

const PANEL_STYLE_ID = 'um-style';
const PANEL_ID = 'um-panel';

const PANEL_STYLE = `
#um-panel{position:fixed;right:18px;bottom:18px;width:340px;z-index:2147483647;font:13px/1.5 'Inter',system-ui,-apple-system,'PingFang SC',sans-serif;color:#e2e8f0;background:radial-gradient(circle at 20% -10%,rgba(56,189,248,.32),transparent 55%),linear-gradient(135deg,rgba(15,23,42,.94),rgba(30,41,59,.92));border:1px solid rgba(148,163,184,.35);border-radius:18px;box-shadow:0 28px 60px rgba(15,23,42,.55);backdrop-filter:blur(18px);overflow:hidden}
#um-panel::after{content:'';position:absolute;inset:1px;border-radius:16px;pointer-events:none;background:linear-gradient(130deg,rgba(148,163,184,.18),rgba(96,165,250,.08) 35%,transparent 65%)}
#um-panel .sec{position:relative;border-top:1px solid rgba(148,163,184,.14)}
#um-panel .sec:first-child{border-top:none}
#um-panel .hdr{display:flex;align-items:center;justify-content:space-between;padding:16px 20px 14px;background:rgba(15,23,42,.55)}
#um-panel .hdr b{position:relative;font-weight:600;letter-spacing:.04em}
#um-panel .hdr b::before{content:attr(data-label);display:block;color:#cbd5f5;text-shadow:0 0 12px rgba(148,163,184,.35)}
#um-panel .hdr button{position:relative;min-width:84px;padding:6px 18px;border-radius:999px;border:1px solid rgba(94,234,212,.45);background:linear-gradient(135deg,rgba(45,212,191,.2),rgba(59,130,246,.2));box-shadow:inset 0 1px 0 rgba(255,255,255,.12);cursor:pointer;color:#f8fafc;transition:all .25s ease}
#um-panel .hdr button:hover{border-color:rgba(94,234,212,.7);box-shadow:inset 0 1px 0 rgba(255,255,255,.22),0 6px 16px rgba(14,116,144,.25);transform:translateY(-1px)}
#um-panel .hdr button:active{transform:translateY(0)}
#um-panel .hdr button::before{content:'';font-weight:600;letter-spacing:.08em}
#um-panel .hdr button[data-mode="on"]::before{content:'关闭'}
#um-panel .hdr button[data-mode="off"]::before{content:'开启'}
#um-panel .body{padding:14px 20px 18px;display:grid;gap:12px;background:rgba(15,23,42,.32)}
#um-panel .kv{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:8px 0}
#um-panel .kv:not(:last-child){border-bottom:1px dashed rgba(148,163,184,.15)}
#um-panel .kv .label::before{content:attr(data-label);color:#94a3b8;font-size:12px;letter-spacing:.04em}
#um-panel .kv .value{position:relative;font-variant-numeric:tabular-nums}
#um-panel .kv .value::before{content:attr(data-value);color:#f8fafc;font-size:13px}
#um-panel .kv .state[data-state="on"]::before{content:'运行中';color:#34d399;font-weight:600;text-shadow:0 0 12px rgba(52,211,153,.35)}
#um-panel .kv .state[data-state="off"]::before{content:'关闭中';color:#f87171;font-weight:600;text-shadow:0 0 10px rgba(248,113,113,.32)}
#um-panel .hint::before{content:attr(data-label);color:#64748b;font-size:11px;letter-spacing:.04em}
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
