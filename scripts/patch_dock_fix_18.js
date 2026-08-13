#!/usr/bin/env node
/** Emergency fix: dock display:contents leak spilled all nav items; compact dock + visible icons */
const fs = require('fs');
const SRC = process.argv[2] || '/workspace/Laegh_Final_17.5.17.html';
const OUT = process.argv[3] || '/workspace/Laegh_Final_18.5.17.html';
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

const cssStart = '/* ══════ تم داک پایین (سبک ویندوز / iOS) — پورتال ثابت + وسط‌چین ══════ */';
const cssEndMarker = `@media (max-width:700px){
  body.sb-dock .sb{bottom:8px;padding:8px 10px;border-radius:22px;max-width:98vw;}
  body.sb-dock .sb-nav > .nav-it .nav-ico,
  body.sb-dock .sb-group > .sb-section{width:46px;height:46px;min-width:46px;}
  body.sb-dock .page, body.sb-dock .page.active{max-width:100%!important;}
}
`;
const idx = html.indexOf(cssStart);
const endIdx = html.indexOf(cssEndMarker);
if (idx < 0 || endIdx < 0) {
  console.error('CSS block not found', idx, endIdx);
  process.exit(1);
}

const NEW_CSS = `/* ══════ تم داک پایین — اصلاح نشت display:contents + داک جمع‌وجور ══════ */
/* در حالت عادی: contents تا ساختار منوی کامل خراب نشود */
.dock-flyout{display:contents;}
body.sb-dock{
  --sidebar:0px!important;
}
/* در داک: زیرمنو تا پورتال‌شدن کاملاً مخفی — وگرنه همه آیتم‌ها داخل داک پخش می‌شوند */
body.sb-dock .dock-flyout{
  display:none!important;
}
body.sb-dock .sb{
  position:fixed!important;
  right:auto!important;left:50%!important;top:auto!important;bottom:14px!important;
  transform:translateX(-50%)!important;
  width:max-content!important;max-width:min(94vw,920px)!important;
  height:auto!important;max-height:88px!important;min-height:0!important;
  flex-direction:row;align-items:center;justify-content:center;
  padding:10px 14px!important;border-radius:26px;
  overflow:visible!important;contain:none!important;
  z-index:9000!important;
  background:linear-gradient(180deg,rgba(22,32,48,.94),rgba(10,14,24,.97))!important;
  background-image:none!important; /* عکس پس‌زمینه ستون را روی داک نکش */
  box-shadow:0 14px 40px rgba(0,0,0,.42), inset 0 1px 0 rgba(255,255,255,.16);
  border:1px solid rgba(255,255,255,.14);
}
body.sb-dock .sb.has-custom-bg{
  background-image:none!important;
  background:linear-gradient(180deg,rgba(22,32,48,.94),rgba(10,14,24,.97))!important;
}
body.sb-dock .main{
  margin:0!important;
  width:100%!important;max-width:100%!important;
  padding:0 16px 130px!important;
  box-sizing:border-box;
  min-height:100vh;min-height:100dvh;
  position:relative;z-index:1;
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
  display:flex!important;flex-direction:row;align-items:center;justify-content:center;
  flex-wrap:nowrap;gap:8px;width:auto;max-width:100%;
  overflow-x:auto;overflow-y:visible;padding:6px 2px;
  max-height:none;height:auto;
}
/* فقط آیتم‌های ریشه (مثل داشبورد) + دکمه گروه — نه فرزندان مخفی */
body.sb-dock .sb-nav > .nav-it{
  justify-content:center;align-items:center;gap:0;
  padding:6px;margin:0;border:none;border-radius:16px;
  position:relative;overflow:visible;background:transparent!important;
  min-width:52px;flex:0 0 auto;
}
body.sb-dock .sb-nav > .nav-it .nav-txt{
  position:absolute;bottom:calc(100% + 12px);left:50%;
  transform:translateX(-50%) translateY(6px)!important;
  max-width:0;opacity:0;overflow:hidden;white-space:nowrap;
  background:#111827;color:#fff;font-size:11px;font-weight:600;
  padding:0;border-radius:8px;pointer-events:none;
  transition:max-width .2s ease, opacity .16s ease, transform .2s ease, padding .2s ease;
  z-index:9200;
}
body.sb-dock .sb-nav > .nav-it:hover .nav-txt{
  max-width:180px;opacity:1;padding:6px 10px;
  transform:translateX(-50%) translateY(0)!important;
}
body.sb-dock .sb-nav > .nav-it .nav-ico{
  width:48px;height:48px;min-width:48px;min-height:48px;border-radius:14px;
  display:inline-flex!important;align-items:center;justify-content:center;
  color:#fff!important;
  transition:transform .2s cubic-bezier(.34,1.45,.64,1), box-shadow .18s ease;
}
body.sb-dock .sb-nav > .nav-it .nav-ico svg{
  width:22px;height:22px;stroke:#fff!important;fill:none!important;display:block!important;
}
body.sb-dock .sb-nav > .nav-it:hover .nav-ico{
  transform:translateY(-10px) scale(1.1);
  box-shadow:0 10px 20px rgba(0,0,0,.35), inset 0 1px 0 rgba(255,255,255,.35);
}
body.sb-dock .sb-nav > .nav-it.active .nav-ico{
  box-shadow:0 0 0 3px rgba(255,255,255,.35), inset 0 1px 0 rgba(255,255,255,.35);
}
body.sb-dock .sb-group{
  position:relative;display:flex;flex-direction:column;align-items:center;
  flex:0 0 auto;overflow:visible;width:auto;
}
/* مخفی کردن هر nav-it داخل گروه تا وقتی پورتال باز نشده */
body.sb-dock .sb-group .nav-it{display:none!important;}
body.sb-dock .sb-group > .sb-section{
  display:flex!important;align-items:center;justify-content:center;
  width:48px;height:48px;min-width:48px;padding:0;margin:0;
  border-radius:14px;cursor:pointer;position:relative;z-index:2;
  font-size:0!important;line-height:0!important;color:transparent!important;letter-spacing:0;
  background:linear-gradient(180deg,#7dd3fc,#0284c7);
  box-shadow:inset 0 1px 0 rgba(255,255,255,.35),0 2px 8px rgba(0,0,0,.28);
  border:1px solid rgba(255,255,255,.14);
  text-transform:none;overflow:visible;
  transition:transform .2s cubic-bezier(.34,1.45,.64,1), box-shadow .18s ease;
}
body.sb-dock .sb-group > .sb-section:hover{
  transform:translateY(-10px) scale(1.1);
  box-shadow:0 10px 20px rgba(0,0,0,.35), inset 0 1px 0 rgba(255,255,255,.35);
}
body.sb-dock .sb-group > .sb-section .dock-face{
  display:flex!important;align-items:center;justify-content:center;
  width:100%;height:100%;pointer-events:none;
}
body.sb-dock .sb-group > .sb-section .dock-face .nav-ico{
  width:48px!important;height:48px!important;min-width:48px!important;min-height:48px!important;
  border-radius:14px!important;box-shadow:none!important;
  display:flex!important;align-items:center;justify-content:center;
  background:transparent!important;
}
body.sb-dock .sb-group > .sb-section .dock-face .nav-ico svg{
  width:22px!important;height:22px!important;stroke:#fff!important;fill:none!important;display:block!important;
}
body.sb-dock .sb-group > .sb-section .sec-ico{
  font-size:22px!important;margin:0!important;width:auto;height:auto;
  box-shadow:none;background:transparent;color:#fff!important;line-height:1!important;
}
body.sb-dock .sb-group > .sb-section .dock-face + .sec-ico,
body.sb-dock .sb-group > .sb-section .chev{display:none!important;}
body.sb-dock .sb-group.dock-open > .sb-section{
  transform:translateY(-12px) scale(1.12);
  box-shadow:0 0 0 3px rgba(255,255,255,.4), 0 12px 22px rgba(0,0,0,.35);
}
body.sb-dock .sb-group > .sb-section[data-tip]::after{
  content:attr(data-tip);
  position:absolute;bottom:calc(100% + 12px);left:50%;
  transform:translateX(-50%) translateY(6px);
  background:#111827;color:#fff!important;font-size:11px!important;font-weight:600;
  padding:6px 10px;border-radius:8px;white-space:nowrap;line-height:1.3!important;
  opacity:0;pointer-events:none;max-width:0;overflow:hidden;
  transition:opacity .16s ease, transform .2s ease, max-width .2s ease;
  z-index:9300;
}
body.sb-dock .sb-group > .sb-section:hover::after,
body.sb-dock .sb-group.dock-open > .sb-section::after{
  opacity:1;max-width:220px;transform:translateX(-50%) translateY(0);
}
/* پورتال زیرمنو روی body */
body.sb-dock .dock-flyout.dock-flyout-portal{
  display:flex!important;
  flex-direction:column;gap:6px;align-items:stretch;
  position:fixed!important;
  min-width:220px;max-width:min(300px,92vw);
  background:rgba(15,23,42,.98);color:#fff;
  border-radius:16px;border:1px solid rgba(255,255,255,.16);
  box-shadow:0 18px 48px rgba(0,0,0,.5);
  z-index:10050!important;
  opacity:0;visibility:hidden;pointer-events:none;
  transform:translateX(-50%) translateY(16px) scale(.96);
  max-height:0;overflow:hidden;padding:0;
  transition:opacity .2s ease, transform .26s cubic-bezier(.22,1,.36,1), max-height .28s ease, padding .18s ease, visibility .2s;
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
body.sb-dock .dock-flyout.dock-flyout-portal .nav-it{
  display:flex!important;align-items:center;gap:10px;
  padding:8px 10px;margin:0;border:none;border-radius:12px;
  background:rgba(255,255,255,.08)!important;color:#fff!important;
  white-space:normal;max-width:none;overflow:visible!important;
  opacity:0;transform:translateY(8px)!important;
  transition:opacity .18s ease, transform .22s cubic-bezier(.22,1,.36,1), background .15s;
}
body.sb-dock .dock-flyout.dock-flyout-portal.dock-flyout-open .nav-it{
  opacity:1;transform:translateY(0)!important;
}
body.sb-dock .dock-flyout.dock-flyout-portal.dock-flyout-open .nav-it:nth-child(1){transition-delay:.03s}
body.sb-dock .dock-flyout.dock-flyout-portal.dock-flyout-open .nav-it:nth-child(2){transition-delay:.06s}
body.sb-dock .dock-flyout.dock-flyout-portal.dock-flyout-open .nav-it:nth-child(3){transition-delay:.09s}
body.sb-dock .dock-flyout.dock-flyout-portal.dock-flyout-open .nav-it:nth-child(4){transition-delay:.12s}
body.sb-dock .dock-flyout.dock-flyout-portal.dock-flyout-open .nav-it:nth-child(5){transition-delay:.15s}
body.sb-dock .dock-flyout.dock-flyout-portal.dock-flyout-open .nav-it:nth-child(n+6){transition-delay:.18s}
body.sb-dock .dock-flyout.dock-flyout-portal .nav-it:hover{background:rgba(255,255,255,.16)!important;}
body.sb-dock .dock-flyout.dock-flyout-portal .nav-it .nav-txt{
  display:block!important;position:static!important;transform:none!important;
  max-width:none!important;opacity:1!important;padding:0!important;
  background:transparent!important;color:#fff!important;font-size:12px;font-weight:600;
  box-shadow:none!important;overflow:visible!important;white-space:normal!important;
}
body.sb-dock .dock-flyout.dock-flyout-portal .nav-it .nav-ico{
  width:34px;height:34px;min-width:34px;min-height:34px;border-radius:10px;
  display:flex!important;transform:none!important;
}
body.sb-dock .dock-flyout.dock-flyout-portal .nav-it .nav-ico svg{
  width:18px;height:18px;stroke:#fff!important;display:block!important;
}
body.sb-dock.nav-shape-circle .sb-nav > .nav-it .nav-ico,
body.sb-dock.nav-shape-circle .sb-group > .sb-section,
body.sb-dock.nav-shape-circle .dock-face .nav-ico,
body.sb-dock.nav-shape-circle .dock-flyout .nav-ico{border-radius:50%!important;}
body.sb-dock.nav-shape-square .sb-nav > .nav-it .nav-ico,
body.sb-dock.nav-shape-square .sb-group > .sb-section,
body.sb-dock.nav-shape-square .dock-face .nav-ico,
body.sb-dock.nav-shape-square .dock-flyout .nav-ico{border-radius:4px!important;}
body.sb-dock.nav-shape-rect .sb-nav > .nav-it .nav-ico,
body.sb-dock.nav-shape-rect .sb-group > .sb-section{
  border-radius:10px!important;width:56px;height:40px;min-width:56px;
}
body.sb-dock.nav-shape-rounded .sb-nav > .nav-it .nav-ico,
body.sb-dock.nav-shape-rounded .sb-group > .sb-section{border-radius:14px!important;}
body.sb-dock .nav-it[data-tip]:hover::after,
body.sb-dock .nav-it[data-tip]:hover::before{content:none!important;display:none!important;}
body.sb-dock .fab{bottom:110px;z-index:8000;}
@media (max-width:700px){
  body.sb-dock .sb{bottom:8px;padding:8px 10px;border-radius:22px;max-width:98vw;max-height:80px!important;}
  body.sb-dock .sb-nav > .nav-it .nav-ico,
  body.sb-dock .sb-group > .sb-section{width:44px;height:44px;min-width:44px;}
  body.sb-dock .page, body.sb-dock .page.active{max-width:100%!important;}
}
`;

html = html.slice(0, idx) + NEW_CSS + html.slice(endIdx + cssEndMarker.length);
console.log('✅ dock CSS emergency fix');

// Enhance ensureDockFlyouts to add dock-face icon clone
mustReplace(
`        if(sec){
          var label = (sec.textContent||'').replace(/▾/g,'').replace(/\\s+/g,' ').trim();
          sec.setAttribute('aria-label', label);
          sec.setAttribute('data-tip', label);
          sec.removeAttribute('title');
          if(!sec._dockStopBound){
            sec.addEventListener('click', function(ev){ try{ ev.stopPropagation(); }catch(_e){} });
            sec._dockStopBound = true;
          }
        }`,
`        if(sec){
          var label = (sec.textContent||'').replace(/▾/g,'').replace(/\\s+/g,' ').trim();
          sec.setAttribute('aria-label', label);
          sec.setAttribute('data-tip', label);
          sec.removeAttribute('title');
          if(!sec.querySelector('.dock-face')){
            var face = document.createElement('span');
            face.className = 'dock-face';
            face.setAttribute('aria-hidden','true');
            if(firstIco){
              face.appendChild(firstIco.cloneNode(true));
            } else {
              var emoji = sec.querySelector('.sec-ico');
              face.textContent = emoji ? (emoji.textContent||'▪') : '▪';
              face.style.fontSize = '22px';
              face.style.color = '#fff';
            }
            sec.insertBefore(face, sec.firstChild);
          }
          if(firstIco){
            try{
              var cs2 = window.getComputedStyle(firstIco);
              if(cs2.background && cs2.background!=='none') sec.style.background = cs2.background;
            }catch(_e){}
          }
          if(!sec._dockStopBound){
            sec.addEventListener('click', function(ev){ try{ ev.stopPropagation(); }catch(_e){} });
            sec._dockStopBound = true;
          }
        }`,
'dock-face icon on group buttons');

// When leaving dock mode, cleanup portal leftovers
mustReplace(
`  try{ closeAllDockFlyouts(); }catch(_e){}
  try{ if(val==='dock') ensureDockFlyouts(); }catch(_e){ console.warn('dock init', _e); }`,
`  try{ closeAllDockFlyouts(); }catch(_e){}
  try{
    if(val==='dock') ensureDockFlyouts();
    else {
      // پاکسازی چهره‌های داک وقتی از داک خارج می‌شویم
      document.querySelectorAll('.sb-section .dock-face').forEach(function(f){ if(f.parentNode) f.parentNode.removeChild(f); });
      document.querySelectorAll('.sb-section').forEach(function(s){ s.style.background=''; });
    }
  }catch(_e){ console.warn('dock init', _e); }`,
'cleanup dock-face on mode switch');

html = html.split('17.5.17').join('18.5.17');
html = html.split('۱۷.۵.۱۷').join('۱۸.۵.۱۷');

fs.writeFileSync(OUT, html);
fs.writeFileSync('/workspace/Laegh_Final.html', html);
console.log('Wrote', OUT, 'bytes', html.length);
