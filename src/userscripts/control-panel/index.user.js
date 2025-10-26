// ==UserScript==
// @name         刷新马 + 景阳岗控制面板（含限速检测, 继续为a标签）
// @namespace    http://tampermonkey.net/
// @version      1.5
// @description  模块化控制面板：刷新马 & 景阳岗模块默认关闭且开关持久化；出现“您的点击频度过快”时暂停并在1秒后自动点文本为“继续”的<a>再恢复；景阳岗模块优先检测带“攻击”的项
// @match        http://81.68.161.24/*
// @grant        none
// ==/UserScript==

(function () {
  'use strict';
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const safeText = (el, t) => { if (!el) return; el.textContent = t; };
  const now = () => Date.now();

  function injectStyle() {
    if ($('#um-style')) return;
    const s = document.createElement('style');
    s.id = 'um-style';
    s.textContent = `
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
    document.head.appendChild(s);
  }

  function buildSection(title, idPrefix, enabled) {
    const sec = document.createElement('div'); sec.className = 'sec';
    const hdr = document.createElement('div'); hdr.className = 'hdr';
    const b = document.createElement('b'); b.textContent = title;
    const btn = document.createElement('button'); btn.id = idPrefix + '-toggle'; btn.textContent = enabled ? '关闭' : '开启';
    hdr.appendChild(b); hdr.appendChild(btn);
    const body = document.createElement('div'); body.className = 'body'; body.id = idPrefix + '-body';
    sec.appendChild(hdr); sec.appendChild(body);
    return sec;
  }

  function ensurePanel() {
    if ($('#um-panel')) return;
    const p = document.createElement('div'); p.id = 'um-panel';
    p.appendChild(buildSection('刷新马', 'rm', false));
    p.appendChild(buildSection('景阳岗', 'jyg', false));
    document.body.appendChild(p);
  }

  const RM = (() => {
    const REFRESH_MS = 2000;
    const CHECK_MS = 2000;
    const RESUME_DELAY_MS = 3000;
    const TARGET_TEXT = '汗血宝马';
    const TARGET_ALIAS = '目标马';
    const LS_STATS = 'rm_stats_v1';
    const LS_PENDING_RETURN = 'rm_pending_return_v1';
    const LS_ENABLED = 'rm_enabled_v1';
    let enabled = loadEnabled();
    let refreshCount = 0, moveClickCount = 0, lastTriggerTs = null;
    let foundCount = 0;
    let refreshInterval = null, checkInterval = null;
    let actedThisRound = false;

    function loadEnabled(){ return localStorage.getItem(LS_ENABLED) === '1'; }
    function saveEnabled(v){ localStorage.setItem(LS_ENABLED, v ? '1':'0'); }
    function loadStats(){ try{const raw=localStorage.getItem(LS_STATS);if(!raw)return;const s=JSON.parse(raw);refreshCount=Number(s.refreshCount)||0;moveClickCount=Number(s.moveClickCount)||0;lastTriggerTs=s.lastTriggerTs||null;}catch{} }
    function saveStats(){ localStorage.setItem(LS_STATS, JSON.stringify({ refreshCount, moveClickCount, lastTriggerTs })); }
    function setPendingReturn(v){ localStorage.setItem(LS_PENDING_RETURN,v?'1':''); }
    function isPendingReturn(){ return localStorage.getItem(LS_PENDING_RETURN)==='1'; }
    function fmt(ts){ return ts?new Date(ts).toLocaleTimeString():'-'; }

    function mountUI(){
      const body=$('#rm-body');if(!body)return;
      body.innerHTML='<div class="kv"><span>状态</span><span id="rm-status">'+(enabled?'运行中':'关闭中')+'</span></div><div class="kv"><span>刷新次数</span><span id="rm-refresh">0</span></div><div class="kv"><span>'+TARGET_ALIAS+' 出现(当前页)</span><span id="rm-found">0</span></div><div class="kv"><span>牵走次数</span><span id="rm-move">0</span></div><div class="kv"><span>上次触发</span><span id="rm-last">-</span></div>';
      $('#rm-toggle').onclick=()=>toggle();updateUI();
    }

    function updateUI(){
      safeText($('#rm-status'),enabled?'运行中':'关闭中');
      $('#rm-toggle').textContent=enabled?'关闭':'开启';
      safeText($('#rm-refresh'),refreshCount);
      safeText($('#rm-found'),foundCount);
      safeText($('#rm-move'),moveClickCount);
      safeText($('#rm-last'),fmt(lastTriggerTs));
    }

    function startRefreshing(){
      stopRefreshing();
      refreshInterval=setInterval(()=>{
        const link=$$('a').find(a=>a.textContent&&a.textContent.includes('刷新'));
        if(link){link.click();refreshCount++;saveStats();}
        updateUI();
      },REFRESH_MS);
    }

    function stopRefreshing(){ if(refreshInterval)clearInterval(refreshInterval);refreshInterval=null; }

    function startChecking(){
      stopChecking();actedThisRound=false;
      checkInterval=setInterval(()=>{
        const txt=document.body?document.body.innerText:'';
        const m=txt.match(new RegExp(TARGET_TEXT,'g'));
        foundCount=m?m.length:0;
        if(!actedThisRound&&foundCount>=2){
          actedThisRound=true;
          stopRefreshing();stopChecking();
          const move=$$('a,button').find(e=>e.textContent&&e.textContent.includes('牵走'));
          if(move){setPendingReturn(true);move.click();moveClickCount++;lastTriggerTs=now();saveStats();}
          setTimeout(()=>{if(enabled){startRefreshing();startChecking();}},RESUME_DELAY_MS);
        }
        updateUI();
      },CHECK_MS);
    }

    function stopChecking(){ if(checkInterval)clearInterval(checkInterval);checkInterval=null; }

    function tryClickReturn(){
      if(!isPendingReturn())return;
      const start=now();
      const timer=setInterval(()=>{
        const btn=$$('a,button').find(e=>e.textContent&&e.textContent.trim()==='返回游戏');
        if(btn){
          btn.click();
          setPendingReturn(false);
          clearInterval(timer);
          if(enabled){startRefreshing();startChecking();}
        }else if(now()-start>15000){
          setPendingReturn(false);
          clearInterval(timer);
          if(enabled){startRefreshing();startChecking();}
        }
      },600);
    }

    function enable(){enabled=true;saveEnabled(true);startRefreshing();startChecking();updateUI();}
    function disable(){enabled=false;saveEnabled(false);stopRefreshing();stopChecking();updateUI();}
    function toggle(){enabled?disable():enable();}
    function pause(){stopRefreshing();stopChecking();}
    function resume(){if(enabled){startRefreshing();startChecking();}}
    function init(){loadStats();mountUI();if(!enabled)return;if(isPendingReturn())tryClickReturn();else{startRefreshing();startChecking();}}

    return {init,pause,resume};
  })();

  const JYG = (() => {
    const SCAN_MS=400;
    const CLICK_COOLDOWN_MS=1000;
    const LS_ENABLED='jyg_enabled_v1';
    let enabled=loadEnabled();
    function loadEnabled(){return localStorage.getItem(LS_ENABLED)==='1';}
    function saveEnabled(v){localStorage.setItem(LS_ENABLED,v?'1':'0');}
    let clickCount=0;let lastClickAt=0;let scanTimer=null;

    function mountUI(){
      const body=$('#jyg-body');if(!body)return;
      body.innerHTML='<div class="kv"><span>状态</span><span id="jyg-status">'+(enabled?'运行中':'关闭中')+'</span></div><div class="kv"><span>点击次数</span><span id="jyg-clicks">0</span></div><div class="kv"><span>上次点击</span><span id="jyg-last">-</span></div>';
      $('#jyg-toggle').onclick=()=>toggle();updateUI();
    }

    function fmt(ts){return ts?new Date(ts).toLocaleTimeString():'-';}
    function updateUI(){safeText($('#jyg-status'),enabled?'运行中':'关闭中');$('#jyg-toggle').textContent=enabled?'关闭':'开启';safeText($('#jyg-clicks'),clickCount);safeText($('#jyg-last'),fmt(lastClickAt));}

    function start(){
      stop();
      scanTimer=setInterval(()=>{
        if(!enabled)return;
        if(now()-lastClickAt<CLICK_COOLDOWN_MS)return;
        const anchors=$$('a');
        if(!anchors.length)return;
        const byExact=(txt)=>anchors.find(a=>a.textContent&&a.textContent.trim()===txt);
        const byIncludes=(kw)=>anchors.filter(a=>a.textContent&&a.textContent.includes(kw));
        let target=byExact('攻击景阳岗小大虫');
        if(!target)target=byExact('攻击景阳岗大虫');
        if(!target)target=byExact('景阳岗大虫');
        if(!target)target=byExact('景阳岗小大虫');
        if(!target){const arr=byIncludes('灵芝');target=arr&&arr.length?arr[0]:null;}
        if(!target)target=byExact('返回游戏');
        if(!target){const woods=byIncludes('树林');if(woods&&woods.length){const idx=Math.floor(Math.random()*woods.length);target=woods[idx];}}
        if(target){
          target.click();
          clickCount++;
          lastClickAt=now();
          updateUI();
        }
      },SCAN_MS);
    }

    function stop(){if(scanTimer)clearInterval(scanTimer);scanTimer=null;}
    function enable(){enabled=true;saveEnabled(true);start();updateUI();}
    function disable(){enabled=false;saveEnabled(false);stop();updateUI();}
    function toggle(){enabled?disable():enable();}
    function pause(){stop();}
    function resume(){if(enabled)start();}
    function init(){mountUI();if(enabled)start();}

    return {init,pause,resume};
  })();

  let throttled=false;
  function startWatchdog(){
    setInterval(()=>{
      if(throttled)return;
      const txt=document.body?document.body.innerText:'';
      if(txt.indexOf('您的点击频度过快')>=0){
        throttled=true;
        RM.pause();JYG.pause();
        setTimeout(()=>{
          const cont=$$('a').find(e=>e.textContent&&e.textContent.trim()==='继续');
          if(cont) cont.click();
          throttled=false;
          RM.resume();JYG.resume();
        },1000);
      }
    },300);
  }

  function init(){injectStyle();ensurePanel();RM.init();JYG.init();startWatchdog();}
  if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',init);}else{init();}
})();
