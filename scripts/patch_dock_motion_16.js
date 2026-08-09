#!/usr/bin/env node
/** Fix dock errors (:scope), add hover lift + slide-up flyout animation */
const fs = require('fs');
const SRC = process.argv[2] || '/workspace/Laegh_Final_15.5.17.html';
const OUT = process.argv[3] || '/workspace/Laegh_Final_16.5.17.html';
let html = fs.readFileSync(SRC, 'utf8');

function mustReplace(a, b, label) {
  if (!html.includes(a)) {
    console.error('❌ missing:', label);
    console.error(String(a).slice(0, 240));
    process.exit(1);
  }
  html = html.replace(a, b);
  console.log('✅', label);
}

// Replace dock CSS block from marker through media query end
const cssStart = '/* ══════ تم داک پایین (سبک ویندوز / iOS) ══════ */';
const cssEndMarker = `@media (max-width:700px){
  body.sb-dock .sb{bottom:8px;padding:8px 10px;border-radius:22px;max-width:98vw;}
  body.sb-dock .sb-nav > .nav-it .nav-ico,
  body.sb-dock .sb-group > .sb-section{width:46px;height:46px;min-width:46px;}
}
`;

const idx = html.indexOf(cssStart);
const endIdx = html.indexOf(cssEndMarker);
if (idx < 0 || endIdx < 0) {
  console.error('dock CSS block not found', idx, endIdx);
  process.exit(1);
}
const cssEnd = endIdx + cssEndMarker.length;

const NEW_CSS = `/* ══════ تم داک پایین (سبک ویندوز / iOS) — پویا ══════ */
.dock-flyout{display:contents;} /* در منوی کامل/ریل، ساختار DOM را خراب نکند */
body.sb-dock{
  --sidebar:0px;
  --dock-h:96px;
}
body.sb-dock .sb{
  position:fixed!important;
  right:auto!important;left:50%!important;top:auto!important;bottom:16px!important;
  transform:translateX(-50%)!important;
  width:auto!important;max-width:min(96vw,980px);
  height:auto!important;min-height:0;
  flex-direction:row;align-items:flex-end;justify-content:center;
  padding:12px 18px;border-radius:28px;
  overflow:visible!important;contain:none!important;
  z-index:450;
  background:linear-gradient(180deg,rgba(20,30,45,.92),rgba(10,16,28,.96))!important;
  box-shadow:0 16px 48px rgba(0,0,0,.38), inset 0 1px 0 rgba(255,255,255,.18);
  border:1px solid rgba(255,255,255,.14);
}
body.sb-dock .sb.has-custom-bg{background-image:var(--sb-bg-img)!important;background-size:cover!important;}
body.sb-dock .main{
  margin-right:0!important;max-width:100%!important;
  padding-bottom:calc(var(--dock-h) + 28px);
  min-height:100vh;min-height:100dvh;
}
body.sb-dock .main.has-custom-bg::before{right:0!important;left:0;bottom:0;}
body.sb-dock .sb-logo,
body.sb-dock .sb-brand,
body.sb-dock #sb-clock,
body.sb-dock .gs-wrap,
body.sb-dock .sb-foot,
body.sb-dock .nav-badge,
body.sb-dock .sb > .btn{display:none!important;}
body.sb-dock .sb-nav{
  display:flex;flex-direction:row;align-items:flex-end;justify-content:center;
  gap:10px;flex:0 1 auto;width:auto;max-width:100%;
  overflow-x:auto;overflow-y:visible;padding:18px 2px 4px;
  max-height:none;scrollbar-width:thin;
}
/* آیتم تکی (مثل داشبورد) */
body.sb-dock .sb-nav > .nav-it{
  justify-content:center;align-items:center;gap:0;
  padding:8px;margin:0;border:none;border-radius:16px;
  position:relative;overflow:visible;background:transparent!important;
  min-width:56px;
}
body.sb-dock .sb-nav > .nav-it .nav-txt{
  position:absolute;bottom:calc(100% + 14px);left:50%;
  transform:translateX(-50%) translateY(8px);
  max-width:0;opacity:0;overflow:hidden;white-space:nowrap;
  background:#111827;color:#fff;font-size:11px;font-weight:600;
  padding:0;border-radius:8px;pointer-events:none;
  transition:max-width .22s ease, opacity .18s ease, transform .22s ease, padding .22s ease;
  z-index:520;
}
body.sb-dock .sb-nav > .nav-it:hover .nav-txt{
  max-width:180px;opacity:1;padding:6px 10px;
  transform:translateX(-50%) translateY(0);
}
body.sb-dock .sb-nav > .nav-it .nav-ico{
  width:52px;height:52px;min-width:52px;min-height:52px;border-radius:16px;
  transition:transform .22s cubic-bezier(.34,1.45,.64,1), box-shadow .2s ease;
  will-change:transform;
}
body.sb-dock .sb-nav > .nav-it:hover .nav-ico{
  transform:translateY(-12px) scale(1.12);
  box-shadow:0 12px 22px rgba(0,0,0,.35), inset 0 1px 0 rgba(255,255,255,.35);
}
body.sb-dock .sb-nav > .nav-it.active .nav-ico{
  box-shadow:0 0 0 3px rgba(255,255,255,.35), inset 0 1px 0 rgba(255,255,255,.35),0 1px 2px rgba(0,0,0,.28);
}
/* گروه: یک شکل در داک + زیرمجموعه کشویی از بالا */
body.sb-dock .sb-group{
  position:relative;display:flex;flex-direction:column;align-items:center;
  flex:0 0 auto;
}
body.sb-dock .sb-group > .sb-section{
  display:flex!important;align-items:center;justify-content:center;
  width:52px;height:52px;min-width:52px;padding:0;margin:0;
  border-radius:16px;cursor:pointer;position:relative;z-index:2;
  font-size:0!important;color:transparent!important;letter-spacing:0;
  background:linear-gradient(180deg,rgba(255,255,255,.2),rgba(0,0,0,.22));
  box-shadow:inset 0 1px 0 rgba(255,255,255,.3),0 2px 8px rgba(0,0,0,.25);
  border:1px solid rgba(255,255,255,.12);
  text-transform:none;
  transition:transform .22s cubic-bezier(.34,1.45,.64,1), box-shadow .2s ease;
  will-change:transform;
}
body.sb-dock .sb-group > .sb-section:hover{
  transform:translateY(-12px) scale(1.12);
  box-shadow:0 12px 22px rgba(0,0,0,.35), inset 0 1px 0 rgba(255,255,255,.35);
}
body.sb-dock .sb-group > .sb-section .sec-ico{
  font-size:22px!important;margin:0!important;width:auto;height:auto;
  box-shadow:none;background:transparent;color:inherit;
}
body.sb-dock .sb-group > .sb-section .chev{display:none!important;}
body.sb-dock .sb-group.dock-open > .sb-section{
  transform:translateY(-14px) scale(1.14);
  box-shadow:0 0 0 3px rgba(255,255,255,.4), 0 14px 24px rgba(0,0,0,.35), inset 0 1px 0 rgba(255,255,255,.3);
}
/* برچسب نام گروه روی هاور */
body.sb-dock .sb-group > .sb-section[data-tip]::after{
  content:attr(data-tip);
  position:absolute;bottom:calc(100% + 14px);left:50%;
  transform:translateX(-50%) translateY(8px);
  background:#111827;color:#fff;font-size:11px;font-weight:600;
  padding:6px 10px;border-radius:8px;white-space:nowrap;
  opacity:0;pointer-events:none;max-width:0;overflow:hidden;
  transition:opacity .18s ease, transform .22s ease, max-width .22s ease;
  z-index:530;font-size:11px!important;color:#fff!important;
}
body.sb-dock .sb-group > .sb-section:hover::after,
body.sb-dock .sb-group.dock-open > .sb-section::after{
  opacity:1;max-width:200px;transform:translateX(-50%) translateY(0);
}
body.sb-dock .dock-flyout{
  display:flex;
  flex-direction:column;gap:6px;align-items:stretch;
  position:absolute;bottom:calc(100% + 18px);left:50%;
  min-width:210px;max-width:280px;padding:10px;
  background:rgba(15,23,42,.97);color:#fff;
  border-radius:16px;border:1px solid rgba(255,255,255,.14);
  box-shadow:0 14px 36px rgba(0,0,0,.42);
  z-index:560;
  /* بسته: کشویی پایین‌رفته و نامرئی */
  opacity:0;
  visibility:hidden;
  pointer-events:none;
  transform:translateX(-50%) translateY(16px) scale(.94);
  max-height:0;
  overflow:hidden;
  padding-top:0;padding-bottom:0;margin:0;border-width:0;
  transition:opacity .22s ease, transform .28s cubic-bezier(.22,1,.36,1), max-height .28s ease, padding .22s ease, visibility .22s, border-width 0s .22s;
}
body.sb-dock .sb-group.dock-open > .dock-flyout{
  opacity:1;
  visibility:visible;
  pointer-events:auto;
  transform:translateX(-50%) translateY(0) scale(1);
  max-height:70vh;
  padding:10px;
  border-width:1px;
  overflow:auto;
  transition:opacity .22s ease, transform .28s cubic-bezier(.22,1,.36,1), max-height .32s ease, padding .22s ease, visibility 0s, border-width 0s;
}
body.sb-dock .dock-flyout::after{
  content:'';position:absolute;top:100%;left:50%;transform:translateX(-50%);
  border:8px solid transparent;border-top-color:rgba(15,23,42,.97);
}
body.sb-dock .dock-flyout .nav-it{
  display:flex!important;align-items:center;gap:10px;
  padding:8px 10px;margin:0;border:none;border-radius:12px;
  background:rgba(255,255,255,.06)!important;color:#fff!important;
  white-space:normal;max-width:none;
  opacity:0;transform:translateY(10px);
  transition:opacity .2s ease, transform .24s cubic-bezier(.22,1,.36,1), background .15s;
}
body.sb-dock .sb-group.dock-open > .dock-flyout .nav-it{
  opacity:1;transform:translateY(0);
}
body.sb-dock .sb-group.dock-open > .dock-flyout .nav-it:nth-child(1){transition-delay:.04s}
body.sb-dock .sb-group.dock-open > .dock-flyout .nav-it:nth-child(2){transition-delay:.08s}
body.sb-dock .sb-group.dock-open > .dock-flyout .nav-it:nth-child(3){transition-delay:.12s}
body.sb-dock .sb-group.dock-open > .dock-flyout .nav-it:nth-child(4){transition-delay:.16s}
body.sb-dock .sb-group.dock-open > .dock-flyout .nav-it:nth-child(5){transition-delay:.2s}
body.sb-dock .sb-group.dock-open > .dock-flyout .nav-it:nth-child(n+6){transition-delay:.24s}
body.sb-dock .dock-flyout .nav-it:hover{background:rgba(255,255,255,.14)!important;}
body.sb-dock .dock-flyout .nav-it.active{background:rgba(255,255,255,.2)!important;}
body.sb-dock .dock-flyout .nav-it .nav-txt{
  display:block!important;position:static!important;transform:none!important;
  max-width:none!important;opacity:1!important;padding:0!important;
  background:transparent!important;color:#fff!important;font-size:12px;font-weight:600;
  box-shadow:none!important;overflow:visible!important;white-space:normal!important;
}
body.sb-dock .dock-flyout .nav-it .nav-ico{
  width:34px;height:34px;min-width:34px;min-height:34px;border-radius:10px;
  transition:none;transform:none!important;
}
body.sb-dock .sb-group.collapsed .dock-flyout .nav-it,
body.sb-dock .sb-group.collapsed .nav-it{display:flex!important;}
/* شکل‌ها روی داک */
body.sb-dock.nav-shape-circle .sb-nav > .nav-it .nav-ico,
body.sb-dock.nav-shape-circle .sb-group > .sb-section,
body.sb-dock.nav-shape-circle .dock-flyout .nav-ico{border-radius:50%!important;}
body.sb-dock.nav-shape-square .sb-nav > .nav-it .nav-ico,
body.sb-dock.nav-shape-square .sb-group > .sb-section,
body.sb-dock.nav-shape-square .dock-flyout .nav-ico{border-radius:4px!important;}
body.sb-dock.nav-shape-rect .sb-nav > .nav-it .nav-ico,
body.sb-dock.nav-shape-rect .sb-group > .sb-section{
  border-radius:10px!important;width:58px;height:42px;min-width:58px;
}
body.sb-dock.nav-shape-rounded .sb-nav > .nav-it .nav-ico,
body.sb-dock.nav-shape-rounded .sb-group > .sb-section{border-radius:16px!important;}
/* خاموش کردن تولتیپ سراسری روی آیتم‌های منو در داک (نه روی section که برچسب دارد) */
body.sb-dock .nav-it[data-tip]:hover::after,
body.sb-dock .nav-it[data-tip]:hover::before{content:none!important;display:none!important;}
@media (max-width:700px){
  body.sb-dock .sb{bottom:8px;padding:8px 10px;border-radius:22px;max-width:98vw;}
  body.sb-dock .sb-nav > .nav-it .nav-ico,
  body.sb-dock .sb-group > .sb-section{width:46px;height:46px;min-width:46px;}
}
`;

html = html.slice(0, idx) + NEW_CSS + html.slice(cssEnd);
console.log('✅ dock CSS replaced with animated version');

mustReplace(
`function toggleSbGroup(sectionEl){
  const grp = sectionEl.closest('.sb-group');
  if(!grp) return;
  // در تم داک: زیرمجموعه‌ها از بالا باز/بسته می‌شوند
  if(document.body.classList.contains('sb-dock')){
    const wasOpen = grp.classList.contains('dock-open');
    document.querySelectorAll('.sb-group.dock-open').forEach(function(g){ g.classList.remove('dock-open'); });
    if(!wasOpen) grp.classList.add('dock-open');
    return;
  }
  grp.classList.toggle('collapsed');
  sectionEl.classList.toggle('collapsed');
  const st = JSON.parse(localStorage.getItem('laegh_sb_collapse')||'{}');
  st[grp.dataset.grp] = grp.classList.contains('collapsed');
  localStorage.setItem('laegh_sb_collapse', JSON.stringify(st));
}`,
`function toggleSbGroup(sectionEl){
  try{
    if(!sectionEl) return;
    const grp = sectionEl.closest ? sectionEl.closest('.sb-group') : null;
    if(!grp) return;
    // در تم داک: زیرمجموعه‌ها کشویی از بالا باز/بسته می‌شوند
    if(document.body.classList.contains('sb-dock')){
      if(typeof ensureDockFlyouts==='function') ensureDockFlyouts();
      const wasOpen = grp.classList.contains('dock-open');
      document.querySelectorAll('.sb-group.dock-open').forEach(function(g){ g.classList.remove('dock-open'); });
      if(!wasOpen){
        grp.classList.add('dock-open');
        // اجبار ریفلو برای انیمیشن روان
        var fly = null;
        for(var i=0;i<grp.children.length;i++){
          if(grp.children[i].classList && grp.children[i].classList.contains('dock-flyout')){ fly = grp.children[i]; break; }
        }
        if(fly){ void fly.offsetWidth; }
      }
      if(window.event){ try{ window.event.stopPropagation(); }catch(_e){} }
      return;
    }
    grp.classList.toggle('collapsed');
    sectionEl.classList.toggle('collapsed');
    const st = JSON.parse(localStorage.getItem('laegh_sb_collapse')||'{}');
    st[grp.dataset.grp] = grp.classList.contains('collapsed');
    localStorage.setItem('laegh_sb_collapse', JSON.stringify(st));
  }catch(err){ console.warn('toggleSbGroup', err); }
}`,
'toggleSbGroup safe + ensure flyouts');

mustReplace(
`function ensureDockFlyouts(){
  document.querySelectorAll('.sb-group').forEach(function(grp){
    if(grp.querySelector(':scope > .dock-flyout')) return;
    var fly = document.createElement('div');
    fly.className = 'dock-flyout';
    fly.setAttribute('role','menu');
    var kids = Array.prototype.slice.call(grp.querySelectorAll(':scope > .nav-it'));
    kids.forEach(function(n){ fly.appendChild(n); });
    grp.appendChild(fly);
    // رنگ دکمه گروه از اولین آیکون فرزند
    var sec = grp.querySelector(':scope > .sb-section');
    var firstIco = fly.querySelector('.nav-ico');
    if(sec && firstIco){
      try{
        var cs = window.getComputedStyle(firstIco);
        if(cs.background && cs.background!=='none') sec.style.background = cs.background;
      }catch(_e){}
    }
    if(sec){
      var label = (sec.textContent||'').replace('▾','').trim();
      sec.setAttribute('aria-label', label);
      sec.setAttribute('data-tip', label);
      sec.title = label;
    }
    fly.querySelectorAll('.nav-it').forEach(function(n){
      if(n._dockCloseBound) return;
      n.addEventListener('click', function(){
        document.querySelectorAll('.sb-group.dock-open').forEach(function(g){ g.classList.remove('dock-open'); });
      });
      n._dockCloseBound = true;
    });
  });
}
if(!window._dockOutsideBound){
  document.addEventListener('click', function(e){
    if(!document.body.classList.contains('sb-dock')) return;
    if(e.target.closest && e.target.closest('.sb-group')) return;
    document.querySelectorAll('.sb-group.dock-open').forEach(function(g){ g.classList.remove('dock-open'); });
  });
  window._dockOutsideBound = true;
}`,
`function _dockDirectChild(grp, className){
  if(!grp || !grp.children) return null;
  for(var i=0;i<grp.children.length;i++){
    var ch = grp.children[i];
    if(ch && ch.classList && ch.classList.contains(className)) return ch;
  }
  return null;
}
function _dockDirectChildren(grp, className){
  var out = [];
  if(!grp || !grp.children) return out;
  for(var i=0;i<grp.children.length;i++){
    var ch = grp.children[i];
    if(ch && ch.classList && ch.classList.contains(className)) out.push(ch);
  }
  return out;
}
function ensureDockFlyouts(){
  try{
    document.querySelectorAll('.sb-group').forEach(function(grp){
      try{
        if(_dockDirectChild(grp, 'dock-flyout')) return;
        var fly = document.createElement('div');
        fly.className = 'dock-flyout';
        fly.setAttribute('role','menu');
        var kids = _dockDirectChildren(grp, 'nav-it');
        kids.forEach(function(n){ fly.appendChild(n); });
        grp.appendChild(fly);
        var sec = _dockDirectChild(grp, 'sb-section');
        var firstIco = fly.querySelector('.nav-ico');
        if(sec && firstIco){
          try{
            var cs = window.getComputedStyle(firstIco);
            if(cs.background && cs.background!=='none') sec.style.background = cs.background;
          }catch(_e){}
        }
        if(sec){
          var label = (sec.textContent||'').replace(/▾/g,'').replace(/\\s+/g,' ').trim();
          sec.setAttribute('aria-label', label);
          sec.setAttribute('data-tip', label);
          // title مرورگر را نمی‌گذاریم تا با برچسب CSS تداخل نکند
          sec.removeAttribute('title');
          sec.addEventListener('click', function(ev){ try{ ev.stopPropagation(); }catch(_e){} });
        }
        fly.querySelectorAll('.nav-it').forEach(function(n){
          if(n._dockCloseBound) return;
          n.addEventListener('click', function(){
            document.querySelectorAll('.sb-group.dock-open').forEach(function(g){ g.classList.remove('dock-open'); });
          });
          n._dockCloseBound = true;
        });
      }catch(inner){ console.warn('ensureDockFlyouts group', inner); }
    });
  }catch(err){ console.warn('ensureDockFlyouts', err); }
}
if(!window._dockOutsideBound){
  document.addEventListener('click', function(e){
    try{
      if(!document.body.classList.contains('sb-dock')) return;
      var t = e.target;
      if(t && t.nodeType !== 1) t = t.parentElement;
      if(t && t.closest && t.closest('.sb-group')) return;
      document.querySelectorAll('.sb-group.dock-open').forEach(function(g){ g.classList.remove('dock-open'); });
    }catch(_e){}
  });
  window._dockOutsideBound = true;
}`,
'ensureDockFlyouts without :scope + safe outside click');

mustReplace(
`  if(val==='dock') ensureDockFlyouts();
  refreshNavTooltips();`,
`  try{ if(val==='dock') ensureDockFlyouts(); }catch(_e){ console.warn('dock init', _e); }
  refreshNavTooltips();`,
'setSbMode try/catch dock');

html = html.split('15.5.17').join('16.5.17');
html = html.split('۱۵.۵.۱۷').join('۱۶.۵.۱۷');

fs.writeFileSync(OUT, html);
fs.writeFileSync('/workspace/Laegh_Final.html', html);
console.log('Wrote', OUT, 'bytes', html.length);
