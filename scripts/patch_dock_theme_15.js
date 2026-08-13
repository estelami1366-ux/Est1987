#!/usr/bin/env node
/** Bottom dock theme (Windows/iOS-like): icons at bottom, empty center, flyout submenus */
const fs = require('fs');
const SRC = process.argv[2] || '/workspace/Laegh_Final_14.5.17.html';
const OUT = process.argv[3] || '/workspace/Laegh_Final_15.5.17.html';
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

const DOCK_CSS = `
/* ══════ تم داک پایین (سبک ویندوز / iOS) ══════ */
.dock-flyout{display:contents;} /* در منوی کامل/ریل، ساختار DOM را خراب نکند */
body.sb-dock{
  --sidebar:0px;
  --dock-h:86px;
}
body.sb-dock .sb{
  position:fixed!important;
  right:auto!important;left:50%!important;top:auto!important;bottom:16px!important;
  transform:translateX(-50%)!important;
  width:auto!important;max-width:min(96vw,980px);
  height:auto!important;min-height:0;
  flex-direction:row;align-items:flex-end;justify-content:center;
  padding:10px 16px;border-radius:28px;
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
  gap:8px;flex:0 1 auto;width:auto;max-width:100%;
  overflow-x:auto;overflow-y:visible;padding:4px 2px 2px;
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
  position:absolute;bottom:calc(100% + 8px);left:50%;
  transform:translateX(-50%) translateY(6px);
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
}
body.sb-dock .sb-nav > .nav-it.active .nav-ico{
  box-shadow:0 0 0 3px rgba(255,255,255,.35), inset 0 1px 0 rgba(255,255,255,.35),0 1px 2px rgba(0,0,0,.28);
}
/* گروه: یک شکل در داک + زیرمجموعه از بالا */
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
}
body.sb-dock .sb-group > .sb-section .sec-ico{
  font-size:22px!important;margin:0!important;width:auto;height:auto;
  box-shadow:none;background:transparent;color:inherit;
}
body.sb-dock .sb-group > .sb-section .chev{display:none!important;}
body.sb-dock .sb-group.dock-open > .sb-section{
  box-shadow:0 0 0 3px rgba(255,255,255,.35), inset 0 1px 0 rgba(255,255,255,.3);
  transform:translateY(-2px);
}
body.sb-dock .dock-flyout{
  display:none;
  position:absolute;bottom:calc(100% + 14px);left:50%;
  transform:translateX(-50%) translateY(8px);
  flex-direction:column;gap:6px;align-items:stretch;
  min-width:200px;max-width:260px;padding:10px;
  background:rgba(15,23,42,.96);color:#fff;
  border-radius:16px;border:1px solid rgba(255,255,255,.14);
  box-shadow:0 14px 36px rgba(0,0,0,.4);
  z-index:560;opacity:0;pointer-events:none;
  transition:opacity .18s ease, transform .22s ease;
}
body.sb-dock .sb-group.dock-open > .dock-flyout{
  display:flex;opacity:1;pointer-events:auto;
  transform:translateX(-50%) translateY(0);
}
body.sb-dock .dock-flyout::after{
  content:'';position:absolute;top:100%;left:50%;transform:translateX(-50%);
  border:8px solid transparent;border-top-color:rgba(15,23,42,.96);
}
body.sb-dock .dock-flyout .nav-it{
  display:flex!important;align-items:center;gap:10px;
  padding:8px 10px;margin:0;border:none;border-radius:12px;
  background:rgba(255,255,255,.06)!important;color:#fff!important;
  white-space:normal;max-width:none;
}
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
/* خاموش کردن تولتیپ سراسری روی داک */
body.sb-dock .nav-it[data-tip]:hover::after,
body.sb-dock .nav-it[data-tip]:hover::before,
body.sb-dock .sb-section:hover::after,
body.sb-dock .sb-section:hover::before{content:none!important;display:none!important;}
@media (max-width:700px){
  body.sb-dock .sb{bottom:8px;padding:8px 10px;border-radius:22px;max-width:98vw;}
  body.sb-dock .sb-nav > .nav-it .nav-ico,
  body.sb-dock .sb-group > .sb-section{width:46px;height:46px;min-width:46px;}
}
`;

mustReplace(
`.nav-it[draggable="true"]{cursor:grab;}
.nav-it[draggable="true"]:active{cursor:grabbing;}`,
`.nav-it[draggable="true"]{cursor:grab;}
.nav-it[draggable="true"]:active{cursor:grabbing;}
${DOCK_CSS}`,
'dock CSS');

mustReplace(
`          <select id="sb-mode-select" onchange="setSbMode(this.value)">
            <option value="full">منوی کامل — آیکون + نوشته (تم‌های قبلی)</option>
            <option value="icons">ریل فقط‌شکل — هیچ نوشته‌ای دیده نمی‌شود</option>
          </select>`,
`          <select id="sb-mode-select" onchange="setSbMode(this.value)">
            <option value="full">منوی کامل — آیکون + نوشته (تم‌های قبلی)</option>
            <option value="icons">ریل فقط‌شکل — هیچ نوشته‌ای دیده نمی‌شود</option>
            <option value="dock">داک پایین — سبک ویندوز / iOS</option>
          </select>`,
'dock option in select');

mustReplace(
`      <p style="font-size:10px;color:var(--text2);line-height:1.6">در ریل فقط‌شکل، با بردن موس روی هر شکل، نامش به‌صورت <b>کشویی از راست به چپ</b> باز می‌شود. می‌توانید آیکون را به داشبورد بکشید تا شورتکات بسازید.</p>`,
`      <p style="font-size:10px;color:var(--text2);line-height:1.6">در ریل فقط‌شکل، نام با کشویی راست→چپ می‌آید. در <b>داک پایین</b> وسط صفحه خالی است و فقط آیکون‌ها پایین هستند؛ با زدن روی گروهی مثل «کالا و انبار»، زیرمجموعه‌ها از بالا باز می‌شوند. شکل آیکون‌ها قابل تغییر است.</p>`,
'dock help under appearance');

mustReplace(
`    <li><b>تم منو:</b> پوسته‌های قبلی همه سر جایشان هستند. حالت «ریل فقط‌شکل» هیچ نوشته‌ای نشان نمی‌دهد؛ با هاور، نام به‌صورت کشویی از راست به چپ باز می‌شود. شکل آیکون (دایره/مربع/مستطیل) جداگانه قابل تغییر است.</li>`,
`    <li><b>تم منو:</b> پوسته‌های قبلی همه سر جایشان هستند. «ریل فقط‌شکل» بدون نوشته است (نام کشویی). «داک پایین» مثل ویندوز/iOS فقط آیکون‌ها را پایین می‌گذارد و وسط خالی است؛ با زدن روی گروه (مثل انبارها) زیرمجموعه‌ها از بالا باز می‌شوند.</li>`,
'help dock bullet');

mustReplace(
`function toggleSbGroup(sectionEl){
  const grp = sectionEl.closest('.sb-group');
  grp.classList.toggle('collapsed');
  sectionEl.classList.toggle('collapsed');
  const st = JSON.parse(localStorage.getItem('laegh_sb_collapse')||'{}');
  st[grp.dataset.grp] = grp.classList.contains('collapsed');
  localStorage.setItem('laegh_sb_collapse', JSON.stringify(st));
}`,
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
'toggleSbGroup dock flyout');

mustReplace(
`  document.body.classList.toggle('sb-icons-only', localStorage.getItem('laegh_sb_mode')==='icons');
  document.body.classList.remove('nav-shape-circle','nav-shape-square','nav-shape-rect','nav-shape-rounded');`,
`  var _sbMode = localStorage.getItem('laegh_sb_mode') || 'full';
  document.body.classList.toggle('sb-icons-only', _sbMode==='icons');
  document.body.classList.toggle('sb-dock', _sbMode==='dock');
  if(_sbMode==='dock' && typeof ensureDockFlyouts==='function') ensureDockFlyouts();
  document.body.classList.remove('nav-shape-circle','nav-shape-square','nav-shape-rect','nav-shape-rounded');`,
'applyAppearanceSettings dock class');

mustReplace(
`function setSbMode(val){
  var icons = val === 'icons';
  document.body.classList.toggle('sb-icons-only', icons);
  localStorage.setItem('laegh_sb_mode', icons ? 'icons' : 'full');
  refreshNavTooltips();
  renderSbModeCards();
  var sel = document.getElementById('sb-mode-select'); if(sel) sel.value = icons ? 'icons' : 'full';
  ntf(icons ? 'ریل فقط‌شکل فعال شد' : 'منوی کامل فعال شد');
}
function renderSbModeCards(){
  var box = document.getElementById('sb-mode-cards');
  if(!box) return;
  var cur = localStorage.getItem('laegh_sb_mode') || 'full';
  var modes = [
    {key:'full', title:'منوی کامل', desc:'آیکون + نوشته — چیدمان تم‌های قبلی'},
    {key:'icons', title:'ریل فقط‌شکل', desc:'فقط شکل‌ها؛ نام با کشویی راست→چپ'}
  ];
  box.innerHTML = modes.map(function(m){
    var on = cur === m.key;
    return '<button type="button" onclick="setSbMode(\\''+m.key+'\\')" style="min-width:150px;text-align:right;padding:10px 12px;border-radius:12px;border:2px solid '+(on?'var(--blue)':'var(--border)')+';background:'+(on?'var(--blue-l)':'var(--card)')+';cursor:pointer">'
      +'<div style="font-weight:700;font-size:13px;margin-bottom:4px">'+m.title+'</div>'
      +'<div style="font-size:10px;color:var(--text2);line-height:1.5">'+m.desc+'</div></button>';
  }).join('');
}`,
`function setSbMode(val){
  if(val!=='full' && val!=='icons' && val!=='dock') val = 'full';
  document.body.classList.toggle('sb-icons-only', val==='icons');
  document.body.classList.toggle('sb-dock', val==='dock');
  localStorage.setItem('laegh_sb_mode', val);
  document.querySelectorAll('.sb-group.dock-open').forEach(function(g){ g.classList.remove('dock-open'); });
  if(val==='dock') ensureDockFlyouts();
  refreshNavTooltips();
  renderSbModeCards();
  var sel = document.getElementById('sb-mode-select'); if(sel) sel.value = val;
  var msg = val==='dock' ? 'داک پایین فعال شد' : (val==='icons' ? 'ریل فقط‌شکل فعال شد' : 'منوی کامل فعال شد');
  ntf(msg);
}
function ensureDockFlyouts(){
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
}
function renderSbModeCards(){
  var box = document.getElementById('sb-mode-cards');
  if(!box) return;
  var cur = localStorage.getItem('laegh_sb_mode') || 'full';
  var modes = [
    {key:'full', title:'منوی کامل', desc:'آیکون + نوشته — چیدمان تم‌های قبلی'},
    {key:'icons', title:'ریل فقط‌شکل', desc:'فقط شکل‌ها؛ نام با کشویی راست→چپ'},
    {key:'dock', title:'داک پایین', desc:'مثل ویندوز/iOS؛ وسط خالی؛ زیرمنو از بالا'}
  ];
  box.innerHTML = modes.map(function(m){
    var on = cur === m.key;
    return '<button type="button" onclick="setSbMode(\\''+m.key+'\\')" style="min-width:150px;text-align:right;padding:10px 12px;border-radius:12px;border:2px solid '+(on?'var(--blue)':'var(--border)')+';background:'+(on?'var(--blue-l)':'var(--card)')+';cursor:pointer">'
      +'<div style="font-weight:700;font-size:13px;margin-bottom:4px">'+m.title+'</div>'
      +'<div style="font-size:10px;color:var(--text2);line-height:1.5">'+m.desc+'</div></button>';
  }).join('');
}`,
'setSbMode + ensureDockFlyouts');

mustReplace(
`enhanceSidebarNav();
refreshNavTooltips();
renderDashShortcuts();
applyLayerBackgrounds();`,
`enhanceSidebarNav();
refreshNavTooltips();
renderDashShortcuts();
applyLayerBackgrounds();
if((localStorage.getItem('laegh_sb_mode')||'')==='dock') ensureDockFlyouts();`,
'init ensureDockFlyouts');

mustReplace(
`function refreshNavTooltips(){
  var iconsOnly = document.body.classList.contains('sb-icons-only');
  document.querySelectorAll('.nav-it[data-page]').forEach(function(el){
    var label = '';
    var t = el.querySelector('.nav-txt');
    if(t) label = (t.textContent || '').trim();
    if(!label) label = el.getAttribute('data-page') || '';
    el.setAttribute('data-tip', label);
    el.setAttribute('aria-label', label);
    // در ریل فقط‌شکل title مرورگر را برمی‌داریم تا با کشویی تداخل نکند
    if(iconsOnly) el.removeAttribute('title');
    else el.setAttribute('title', label);`,
`function refreshNavTooltips(){
  var iconsOnly = document.body.classList.contains('sb-icons-only');
  var dockMode = document.body.classList.contains('sb-dock');
  document.querySelectorAll('.nav-it[data-page]').forEach(function(el){
    var label = '';
    var t = el.querySelector('.nav-txt');
    if(t) label = (t.textContent || '').trim();
    if(!label) label = el.getAttribute('data-page') || '';
    el.setAttribute('data-tip', label);
    el.setAttribute('aria-label', label);
    // در ریل/داک title مرورگر را برمی‌داریم تا با کشویی تداخل نکند
    if(iconsOnly || dockMode) el.removeAttribute('title');
    else el.setAttribute('title', label);`,
'refreshNavTooltips dock title');

html = html.split('14.5.17').join('15.5.17');
html = html.split('۱۴.۵.۱۷').join('۱۵.۵.۱۷');

fs.writeFileSync(OUT, html);
fs.writeFileSync('/workspace/Laegh_Final.html', html);
console.log('Wrote', OUT, 'bytes', html.length);
