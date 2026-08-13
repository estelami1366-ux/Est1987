#!/usr/bin/env node
/** Fix dock flyout under content + center main; portal flyout to body as fixed */
const fs = require('fs');
const SRC = process.argv[2] || '/workspace/Laegh_Final_16.5.17.html';
const OUT = process.argv[3] || '/workspace/Laegh_Final_17.5.17.html';
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

const cssStart = '/* ══════ تم داک پایین (سبک ویندوز / iOS) — پویا ══════ */';
const cssEndMarker = `@media (max-width:700px){
  body.sb-dock .sb{bottom:8px;padding:8px 10px;border-radius:22px;max-width:98vw;}
  body.sb-dock .sb-nav > .nav-it .nav-ico,
  body.sb-dock .sb-group > .sb-section{width:46px;height:46px;min-width:46px;}
}
`;
const idx = html.indexOf(cssStart);
const endIdx = html.indexOf(cssEndMarker);
if (idx < 0 || endIdx < 0) {
  console.error('CSS block not found', idx, endIdx);
  process.exit(1);
}
const cssEnd = endIdx + cssEndMarker.length;

const NEW_CSS = `/* ══════ تم داک پایین (سبک ویندوز / iOS) — پورتال ثابت + وسط‌چین ══════ */
.dock-flyout{display:contents;} /* در منوی کامل/ریل، ساختار DOM را خراب نکند */
body.sb-dock{
  --sidebar:0px!important;
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
  z-index:9000!important; /* بالای محتوای وسط تا زیرمنو دیده شود */
  background:linear-gradient(180deg,rgba(20,30,45,.92),rgba(10,16,28,.96))!important;
  box-shadow:0 16px 48px rgba(0,0,0,.38), inset 0 1px 0 rgba(255,255,255,.18);
  border:1px solid rgba(255,255,255,.14);
}
body.sb-dock .sb.has-custom-bg{background-image:var(--sb-bg-img)!important;background-size:cover!important;}
/* صفحه وسط: تمام‌عرض مانیتور و محتوای متقارن وسط‌چین */
body.sb-dock .main{
  margin:0!important;
  margin-right:0!important;
  margin-left:0!important;
  width:100%!important;
  max-width:100%!important;
  padding:0 16px calc(110px + 28px)!important;
  box-sizing:border-box;
  min-height:100vh;min-height:100dvh;
  position:relative;
  z-index:1;
}
body.sb-dock .main.has-custom-bg::before{right:0!important;left:0;bottom:0;}
body.sb-dock .page,
body.sb-dock .page.active{
  max-width:1080px!important;
  margin-left:auto!important;
  margin-right:auto!important;
  width:100%;
  box-sizing:border-box;
}
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
  overflow:visible!important; /* مهم: وگرنه زیرمنو بریده/زیر می‌رود */
  padding:18px 2px 4px;
  max-height:none;
}
body.sb-dock .sb-nav > .nav-it{
  justify-content:center;align-items:center;gap:0;
  padding:8px;margin:0;border:none;border-radius:16px;
  position:relative;overflow:visible;background:transparent!important;
  min-width:56px;
}
body.sb-dock .sb-nav > .nav-it .nav-txt{
  position:absolute;bottom:calc(100% + 14px);left:50%;
  transform:translateX(-50%) translateY(8px)!important;
  max-width:0;opacity:0;overflow:hidden;white-space:nowrap;
  background:#111827;color:#fff;font-size:11px;font-weight:600;
  padding:0;border-radius:8px;pointer-events:none;
  transition:max-width .22s ease, opacity .18s ease, transform .22s ease, padding .22s ease;
  z-index:9200;
}
body.sb-dock .sb-nav > .nav-it:hover .nav-txt{
  max-width:180px;opacity:1;padding:6px 10px;
  transform:translateX(-50%) translateY(0)!important;
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
body.sb-dock .sb-group{
  position:relative;display:flex;flex-direction:column;align-items:center;
  flex:0 0 auto;overflow:visible;
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
body.sb-dock .sb-group > .sb-section[data-tip]::after{
  content:attr(data-tip);
  position:absolute;bottom:calc(100% + 14px);left:50%;
  transform:translateX(-50%) translateY(8px);
  background:#111827;color:#fff;font-size:11px!important;font-weight:600;
  padding:6px 10px;border-radius:8px;white-space:nowrap;
  opacity:0;pointer-events:none;max-width:0;overflow:hidden;
  transition:opacity .18s ease, transform .22s ease, max-width .22s ease;
  z-index:9300;color:#fff!important;
}
body.sb-dock .sb-group > .sb-section:hover::after,
body.sb-dock .sb-group.dock-open > .sb-section::after{
  opacity:1;max-width:200px;transform:translateX(-50%) translateY(0);
}
/* زیرمنوی پورتال‌شده روی body — بالای همه لایه‌ها */
body.sb-dock .dock-flyout.dock-flyout-portal{
  display:flex!important;
  flex-direction:column;gap:6px;align-items:stretch;
  position:fixed!important;
  min-width:220px;max-width:min(300px,92vw);padding:10px;
  background:rgba(15,23,42,.98);color:#fff;
  border-radius:16px;border:1px solid rgba(255,255,255,.16);
  box-shadow:0 18px 48px rgba(0,0,0,.5);
  z-index:10050!important;
  opacity:0;visibility:hidden;pointer-events:none;
  transform:translateX(-50%) translateY(18px) scale(.94);
  max-height:0;overflow:hidden;
  transition:opacity .22s ease, transform .28s cubic-bezier(.22,1,.36,1), max-height .3s ease, padding .2s ease, visibility .22s;
}
body.sb-dock .dock-flyout.dock-flyout-portal.dock-flyout-open{
  opacity:1;visibility:visible;pointer-events:auto;
  transform:translateX(-50%) translateY(0) scale(1);
  max-height:min(70vh,520px);overflow:auto;padding:10px;
}
body.sb-dock .dock-flyout.dock-flyout-portal::after{
  content:'';position:absolute;top:100%;left:50%;transform:translateX(-50%);
  border:8px solid transparent;border-top-color:rgba(15,23,42,.98);
}
body.sb-dock .dock-flyout .nav-it{
  display:flex!important;align-items:center;gap:10px;
  padding:8px 10px;margin:0;border:none;border-radius:12px;
  background:rgba(255,255,255,.06)!important;color:#fff!important;
  white-space:normal;max-width:none;overflow:visible!important;
  opacity:0;
  transform:translateY(10px)!important; /* غلبه بر transform:none عمومی */
  transition:opacity .2s ease, transform .24s cubic-bezier(.22,1,.36,1), background .15s;
}
body.sb-dock .dock-flyout.dock-flyout-open .nav-it{
  opacity:1;transform:translateY(0)!important;
}
body.sb-dock .dock-flyout.dock-flyout-open .nav-it:nth-child(1){transition-delay:.04s}
body.sb-dock .dock-flyout.dock-flyout-open .nav-it:nth-child(2){transition-delay:.08s}
body.sb-dock .dock-flyout.dock-flyout-open .nav-it:nth-child(3){transition-delay:.12s}
body.sb-dock .dock-flyout.dock-flyout-open .nav-it:nth-child(4){transition-delay:.16s}
body.sb-dock .dock-flyout.dock-flyout-open .nav-it:nth-child(5){transition-delay:.2s}
body.sb-dock .dock-flyout.dock-flyout-open .nav-it:nth-child(n+6){transition-delay:.24s}
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
body.sb-dock .nav-it[data-tip]:hover::after,
body.sb-dock .nav-it[data-tip]:hover::before{content:none!important;display:none!important;}
body.sb-dock .fab{bottom:110px;} /* بالاتر از داک */
@media (max-width:700px){
  body.sb-dock .sb{bottom:8px;padding:8px 10px;border-radius:22px;max-width:98vw;}
  body.sb-dock .sb-nav > .nav-it .nav-ico,
  body.sb-dock .sb-group > .sb-section{width:46px;height:46px;min-width:46px;}
  body.sb-dock .page, body.sb-dock .page.active{max-width:100%!important;}
}
`;

html = html.slice(0, idx) + NEW_CSS + html.slice(cssEnd);
console.log('✅ dock CSS portal + center');

mustReplace(
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
`function toggleSbGroup(sectionEl){
  try{
    if(!sectionEl) return;
    const grp = sectionEl.closest ? sectionEl.closest('.sb-group') : null;
    if(!grp) return;
    if(document.body.classList.contains('sb-dock')){
      var wasOpen = grp.classList.contains('dock-open');
      closeAllDockFlyouts();
      if(!wasOpen) openDockFlyout(grp);
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
'toggleSbGroup portal open/close');

mustReplace(
`function ensureDockFlyouts(){
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
`function ensureDockFlyouts(){
  try{
    document.querySelectorAll('.sb-group').forEach(function(grp){
      try{
        if(_dockDirectChild(grp, 'dock-flyout')) return;
        // اگر از قبل پورتال شده روی body باشد
        var gid = grp.getAttribute('data-grp') || '';
        if(gid && document.querySelector('.dock-flyout.dock-flyout-portal[data-grp="'+gid+'"]')) return;
        var fly = document.createElement('div');
        fly.className = 'dock-flyout';
        fly.setAttribute('role','menu');
        if(gid) fly.setAttribute('data-grp', gid);
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
          sec.removeAttribute('title');
          if(!sec._dockStopBound){
            sec.addEventListener('click', function(ev){ try{ ev.stopPropagation(); }catch(_e){} });
            sec._dockStopBound = true;
          }
        }
        fly.querySelectorAll('.nav-it').forEach(function(n){
          if(n._dockCloseBound) return;
          n.addEventListener('click', function(){ closeAllDockFlyouts(); });
          n._dockCloseBound = true;
        });
      }catch(inner){ console.warn('ensureDockFlyouts group', inner); }
    });
  }catch(err){ console.warn('ensureDockFlyouts', err); }
}
function positionDockFlyout(sec, fly){
  if(!sec || !fly) return;
  var r = sec.getBoundingClientRect();
  var left = r.left + r.width / 2;
  var half = 130;
  if(left < half + 8) left = half + 8;
  if(left > window.innerWidth - half - 8) left = window.innerWidth - half - 8;
  var bottom = Math.max(12, window.innerHeight - r.top + 14);
  fly.style.left = Math.round(left) + 'px';
  fly.style.bottom = Math.round(bottom) + 'px';
  fly.style.top = 'auto';
  fly.style.right = 'auto';
}
function closeAllDockFlyouts(){
  document.querySelectorAll('.sb-group.dock-open').forEach(function(g){ g.classList.remove('dock-open'); });
  document.querySelectorAll('.dock-flyout.dock-flyout-portal').forEach(function(fly){
    fly.classList.remove('dock-flyout-open');
    var gid = fly.getAttribute('data-grp') || '';
    var grp = gid ? document.querySelector('.sb-group[data-grp="'+gid+'"]') : null;
    fly.classList.remove('dock-flyout-portal');
    fly.style.left = '';
    fly.style.bottom = '';
    fly.style.top = '';
    fly.style.right = '';
    if(grp) grp.appendChild(fly);
    else if(fly.parentNode) fly.parentNode.removeChild(fly);
  });
}
function openDockFlyout(grp){
  if(!grp) return;
  ensureDockFlyouts();
  closeAllDockFlyouts();
  grp.classList.add('dock-open');
  var fly = _dockDirectChild(grp, 'dock-flyout');
  var sec = _dockDirectChild(grp, 'sb-section');
  if(!fly || !sec) return;
  var gid = grp.getAttribute('data-grp') || '';
  if(gid) fly.setAttribute('data-grp', gid);
  document.body.appendChild(fly);
  fly.classList.add('dock-flyout-portal');
  positionDockFlyout(sec, fly);
  // دو فریم برای انیمیشن باز شدن
  requestAnimationFrame(function(){
    positionDockFlyout(sec, fly);
    fly.classList.add('dock-flyout-open');
  });
}
if(!window._dockOutsideBound){
  document.addEventListener('click', function(e){
    try{
      if(!document.body.classList.contains('sb-dock')) return;
      var t = e.target;
      if(t && t.nodeType !== 1) t = t.parentElement;
      if(t && t.closest && (t.closest('.sb-group') || t.closest('.dock-flyout'))) return;
      closeAllDockFlyouts();
    }catch(_e){}
  });
  window.addEventListener('resize', function(){
    if(!document.body.classList.contains('sb-dock')) return;
    document.querySelectorAll('.dock-flyout.dock-flyout-open').forEach(function(fly){
      var gid = fly.getAttribute('data-grp') || '';
      var grp = gid ? document.querySelector('.sb-group[data-grp="'+gid+'"]') : null;
      var sec = grp ? _dockDirectChild(grp, 'sb-section') : null;
      if(sec) positionDockFlyout(sec, fly);
    });
  });
  window._dockOutsideBound = true;
}`,
'dock portal open/close/position');

mustReplace(
`  document.querySelectorAll('.sb-group.dock-open').forEach(function(g){ g.classList.remove('dock-open'); });
  try{ if(val==='dock') ensureDockFlyouts(); }catch(_e){ console.warn('dock init', _e); }`,
`  try{ closeAllDockFlyouts(); }catch(_e){}
  try{ if(val==='dock') ensureDockFlyouts(); }catch(_e){ console.warn('dock init', _e); }`,
'setSbMode close flyouts on switch');

html = html.split('16.5.17').join('17.5.17');
html = html.split('۱۶.۵.۱۷').join('۱۷.۵.۱۷');

fs.writeFileSync(OUT, html);
fs.writeFileSync('/workspace/Laegh_Final.html', html);
console.log('Wrote', OUT, 'bytes', html.length);
