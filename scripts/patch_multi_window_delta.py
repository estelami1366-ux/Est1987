#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Add multi-window workspace (tabs + split + min/max/close + back) — 1405.5.21δ"""
from pathlib import Path
import re

HTML = Path("/workspace/Sirman_Final.html")
text = HTML.read_text(encoding="utf-8")

OLD, NEW = "1405.5.21γ", "1405.5.21δ"
OLD_FA, NEW_FA = "۱۴۰۵.۵.۲۱γ", "۱۴۰۵.۵.۲۱δ"
if OLD not in text:
    raise SystemExit(f"expected {OLD}")
text = text.replace(OLD, NEW)
text = text.replace(OLD_FA, NEW_FA)

CSS = r"""
/* ══════ چندپنجره / تب‌های کاری (v1405.5.21δ) ══════ */
#win-chrome{
  position:sticky; top:0; z-index:60;
  display:flex; flex-wrap:wrap; align-items:center; gap:6px;
  padding:6px 10px; background:color-mix(in srgb, var(--card) 92%, var(--blue-l));
  border-bottom:1px solid var(--border);
  backdrop-filter:blur(8px);
}
#win-tabs{display:flex; flex-wrap:wrap; gap:4px; flex:1; min-width:120px; align-items:center;}
.win-tab{
  display:inline-flex; align-items:center; gap:6px;
  max-width:180px; padding:5px 8px; border-radius:8px;
  border:1px solid var(--border); background:var(--card); color:var(--text);
  font-size:11px; cursor:pointer; font-family:var(--font);
  transition:background .15s, border-color .15s, transform .15s;
}
.win-tab:hover{border-color:var(--blue); background:var(--blue-l);}
.win-tab.active{background:var(--blue); border-color:var(--blue); color:#fff;}
.win-tab .wt-title{overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:110px;}
.win-tab .wt-x{opacity:.7; font-size:12px; line-height:1; padding:0 2px; border:none; background:transparent; color:inherit; cursor:pointer;}
.win-tab .wt-x:hover{opacity:1;}
#win-actions{display:flex; gap:4px; flex-wrap:wrap; align-items:center;}
#win-min-tray{display:flex; flex-wrap:wrap; gap:4px; width:100%;}
.win-min-chip{
  font-size:10px; padding:3px 8px; border-radius:999px;
  border:1px dashed var(--border); background:var(--bg2, #f5f5f5);
  cursor:pointer; color:var(--text2);
}
.win-min-chip:hover{border-color:var(--blue); color:var(--blue);}
#win-workspace{
  display:grid; gap:8px; padding:8px;
  grid-template-columns:1fr;
  min-height:calc(100vh - 52px); min-height:calc(100dvh - 52px);
  align-content:stretch;
}
#win-workspace.win-split-2{ grid-template-columns:1fr 1fr; }
#win-workspace.win-split-3{ grid-template-columns:1fr 1fr 1fr; }
#win-workspace.win-split-4{ grid-template-columns:1fr 1fr; grid-template-rows:1fr 1fr; }
#win-workspace.win-has-max{ grid-template-columns:1fr; }
.win-pane{
  display:flex; flex-direction:column; min-height:280px;
  border:1px solid var(--border); border-radius:12px;
  background:var(--card); overflow:hidden;
  box-shadow:0 2px 10px rgba(0,0,0,.04);
  animation:winIn .22s ease-out;
}
@keyframes winIn{ from{opacity:0; transform:translateY(6px);} to{opacity:1; transform:none;} }
.win-pane.minimized{ display:none !important; }
.win-pane.maximized{ min-height:calc(100vh - 70px); }
.win-pane.active-pane{ border-color:var(--blue); box-shadow:0 0 0 2px color-mix(in srgb, var(--blue) 25%, transparent); }
.win-titlebar{
  display:flex; align-items:center; gap:6px; flex-wrap:wrap;
  padding:6px 8px; background:linear-gradient(180deg, rgba(0,0,0,.03), transparent);
  border-bottom:1px solid var(--border); user-select:none;
}
.win-titlebar .wt-label{ flex:1; font-size:12px; font-weight:700; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.win-titlebar .wt-btn{
  width:28px; height:24px; border-radius:6px; border:1px solid var(--border);
  background:var(--card); cursor:pointer; font-size:12px; line-height:1;
  display:inline-flex; align-items:center; justify-content:center; color:var(--text);
}
.win-titlebar .wt-btn:hover{ background:var(--blue-l); border-color:var(--blue); }
.win-titlebar .wt-btn.danger:hover{ background:var(--red-l, #fee2e2); border-color:var(--red); color:var(--red); }
.win-titlebar .wt-btn:disabled{ opacity:.35; cursor:default; }
.win-body{ flex:1; overflow:auto; position:relative; background:var(--bg); }
.win-body > .page{ display:none; padding:20px; }
.win-body > .page.active{ display:block; }
#page-parking{ display:none !important; }
body.win-mode .main > .page{ display:none !important; }
@media (max-width:900px){
  #win-workspace.win-split-2,
  #win-workspace.win-split-3,
  #win-workspace.win-split-4{ grid-template-columns:1fr; }
}
"""

# Insert CSS before closing of first big style or after autosave-dot-css
marker_css = "<style id=\"autosave-dot-css\">"
if marker_css not in text:
    raise SystemExit("autosave-dot-css not found")
text = text.replace(marker_css, "<style id=\"win-manager-css\">" + CSS + "</style>\n" + marker_css, 1)

# Soft-insert chrome placeholder comment after main open (runtime builds UI; keep parking hook)
old_main = '<div class="main">\n<button class="fab" id="fab-btn" onclick="addDev()">＋ دستگاه جدید</button>'
new_main = '''<div class="main">
<button class="fab" id="fab-btn" onclick="addDev()">＋ دستگاه جدید</button>
<!-- win-manager mounts here on boot -->
<div id="win-chrome" style="display:none" aria-label="نوار پنجره‌ها"></div>
<div id="win-workspace" style="display:none" aria-label="میزکار چندپنجره"></div>
<div id="page-parking" hidden></div>'''
if old_main not in text:
    raise SystemExit("main open marker not found")
text = text.replace(old_main, new_main, 1)

# Replace showPage with window-aware version + add WM API before it
old_show = """// ─── PAGES ─────────────────────────────────────────────────────────────────────
function showPage(id, el){
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.nav-it').forEach(n=>n.classList.remove('active'));
  var pageEl = document.getElementById('page-'+id);
  if(!pageEl){ if(typeof ntf==='function') ntf('صفحه پیدا نشد: '+id,'err'); return; }
  pageEl.classList.add('active');
  if(el) el.classList.add('active');
  else {
    var nav = document.querySelector('.nav-it[data-page="'+id+'"]');
    if(nav) nav.classList.add('active');
  }
  try{ localStorage.setItem('laegh_last_page', id); }catch(_e){}
  // دکمه شناور «افزودن دستگاه» — باید قبل از render توابع مدیریت شود
  // تا اگر تابعی خطا داد، این بخش باز هم اجرا شده باشد
  const fab=document.getElementById('fab-adddev');
  if(fab){
    if(id==='invoice') fab.classList.add('show');
    else fab.classList.remove('show');
  }
  try {
    if(id==='saved') renderSaved();
    if(id==='phonebook') renderPB();
    if(id==='products') renderProds();
    if(id==='inventory') renderInv();
    if(id==='defective') renderDefective();
    if(id==='datetime') renderCalPage();
    if(id==='audit') renderAuditLog();
    if(id==='dataio') renderDataStats();
    if(id==='parts') renderParts();
    if(id==='sales') renderSales();
    if(id==='services') renderSvcs();
    if(id==='warranty') renderWar();
    if(id==='settings'){ loadPrintSettingsUI(); loadCompanyInfo(); loadAutoSaveUI(); loadAppearanceUI(); if(typeof loadUpdateUI==='function') loadUpdateUI(); }
    if(id==='tasks') renderTasks();
    if(id==='accounts') renderAccounts();
    if(id==='dashboard') renderDashboard();
    if(id==='warehouse') renderWarehouseDocs();
    if(id==='warehouse-entities' && typeof renderWarehouseEntities==='function') renderWarehouseEntities();
    if(id==='daqi' && typeof renderDaqi==='function') renderDaqi();
  } catch(e){
    if(typeof ntf==='function') ntf('خطای نمایش صفحه: '+e.message,'err');
  }
  initTooltips();
}"""

NEW_WM = r'''// ─── PAGES + چندپنجره (۱۴۰۵.۵.۲۱δ) ───────────────────────────────────────────
window._wins = window._wins || [];
window._winActive = window._winActive || null;
window._winSeq = window._winSeq || 1;
window._winReady = false;

function winPageTitle(id){
  try{
    var nav = document.querySelector('.nav-it[data-page="'+id+'"]');
    if(nav){
      var t = (nav.getAttribute('data-tip') || nav.textContent || '').replace(/\s+/g,' ').trim();
      if(t) return t.slice(0,40);
    }
  }catch(_e){}
  var map = {
    dashboard:'داشبورد', tasks:'وظایف', invoice:'فاکتور', saved:'فاکتورهای ذخیره‌شده',
    products:'کالاها', inventory:'انبار کالا', defective:'معیوب', warehouse:'حواله انبار',
    'warehouse-entities':'مدیریت انبارها', phonebook:'دفترچه تلفن', postal:'برچسب پستی',
    parts:'قطعات', daqi:'داغی', services:'خدمات', sales:'فروش', accounts:'حساب‌ها',
    warranty:'گارانتی', dataio:'ورود/خروج داده', datetime:'تاریخ و زمان', audit:'گزارش فعالیت',
    settings:'تنظیمات', help:'راهنما'
  };
  return map[id] || id;
}

function winFind(wid){
  for(var i=0;i<(window._wins||[]).length;i++){
    if(window._wins[i].id === wid) return window._wins[i];
  }
  return null;
}

function ensureWindowManager(){
  if(window._winReady) return true;
  var main = document.querySelector('.main');
  if(!main) return false;
  var chrome = document.getElementById('win-chrome');
  var workspace = document.getElementById('win-workspace');
  var parking = document.getElementById('page-parking');
  if(!chrome || !workspace || !parking) return false;

  // انتقال صفحات مستقیمِ main به پارکینگ
  Array.prototype.slice.call(main.children).forEach(function(ch){
    if(ch.classList && ch.classList.contains('page')) parking.appendChild(ch);
  });

  chrome.style.display = 'flex';
  workspace.style.display = 'grid';
  document.body.classList.add('win-mode');
  window._winReady = true;

  if(!window._wins.length){
    var last = 'dashboard';
    try{ last = localStorage.getItem('laegh_last_page') || 'dashboard'; }catch(_e){}
    if(!document.getElementById('page-'+last)) last = 'invoice';
    winOpen(last, {silent:true, noHistoryPush:true});
  } else {
    renderWinChrome();
    renderWinWorkspace();
  }
  return true;
}

function winOpen(pageId, opts){
  opts = opts || {};
  ensureWindowManager();
  if((window._wins||[]).length >= 4){
    if(typeof ntf==='function') ntf('حداکثر ۴ پنجره همزمان — یکی را ببندید','err');
    return window._winActive;
  }
  var wid = 'w'+(window._winSeq++);
  var w = { id:wid, pageId:pageId||'dashboard', history:[pageId||'dashboard'], state:'normal' };
  window._wins.push(w);
  window._winActive = wid;
  renderWinChrome();
  renderWinWorkspace();
  winMountPage(wid, w.pageId, {push:false, skipNav:!!opts.silent});
  if(!opts.silent && typeof ntf==='function') ntf('پنجره جدید: '+winPageTitle(w.pageId));
  return wid;
}

function winClose(wid, ev){
  if(ev){ try{ ev.stopPropagation(); ev.preventDefault(); }catch(_e){} }
  var wins = window._wins || [];
  if(wins.length <= 1){
    // آخرین پنجره را نبند — برو داشبورد
    winNavigate(wins[0].id, 'dashboard');
    if(typeof ntf==='function') ntf('آخرین پنجره بسته نمی‌شود — به داشبورد برگشتید');
    return;
  }
  var w = winFind(wid);
  if(!w) return;
  // صفحه را به پارکینگ برگردان
  var pageEl = document.getElementById('page-'+w.pageId);
  var parking = document.getElementById('page-parking');
  if(pageEl && parking && pageEl.parentElement !== parking) parking.appendChild(pageEl);
  window._wins = wins.filter(function(x){ return x.id !== wid; });
  if(window._winActive === wid){
    window._winActive = window._wins[window._wins.length-1].id;
  }
  renderWinChrome();
  renderWinWorkspace();
  var cur = winFind(window._winActive);
  if(cur) winMountPage(cur.id, cur.pageId, {push:false});
}

function winMinimize(wid, ev){
  if(ev){ try{ ev.stopPropagation(); }catch(_e){} }
  var w = winFind(wid); if(!w) return;
  w.state = 'minimized';
  if(window._winActive === wid){
    var alt = (window._wins||[]).find(function(x){ return x.id!==wid && x.state!=='minimized'; });
    window._winActive = alt ? alt.id : wid;
  }
  renderWinChrome();
  renderWinWorkspace();
}

function winRestore(wid, ev){
  if(ev){ try{ ev.stopPropagation(); }catch(_e){} }
  var w = winFind(wid); if(!w) return;
  w.state = 'normal';
  // اگر دیگری ماکسیمایز است، آن را عادی کن
  (window._wins||[]).forEach(function(x){ if(x.state==='maximized' && x.id!==wid) x.state='normal'; });
  window._winActive = wid;
  renderWinChrome();
  renderWinWorkspace();
  winMountPage(wid, w.pageId, {push:false});
}

function winMaximize(wid, ev){
  if(ev){ try{ ev.stopPropagation(); }catch(_e){} }
  var w = winFind(wid); if(!w) return;
  if(w.state === 'maximized'){
    w.state = 'normal';
  } else {
    (window._wins||[]).forEach(function(x){
      if(x.id === wid) x.state = 'maximized';
      else if(x.state === 'maximized') x.state = 'normal';
    });
    window._winActive = wid;
  }
  renderWinChrome();
  renderWinWorkspace();
}

function winActivate(wid){
  var w = winFind(wid); if(!w) return;
  if(w.state === 'minimized') w.state = 'normal';
  window._winActive = wid;
  renderWinChrome();
  renderWinWorkspace();
  winMountPage(wid, w.pageId, {push:false});
}

function winBack(wid, ev){
  if(ev){ try{ ev.stopPropagation(); }catch(_e){} }
  var w = winFind(wid); if(!w) return;
  if(!w.history || w.history.length < 2){
    if(typeof ntf==='function') ntf('مسیر قبلی در این پنجره نیست');
    return;
  }
  w.history.pop();
  var prev = w.history[w.history.length-1];
  winMountPage(wid, prev, {push:false});
  renderWinChrome();
}

function winNavigate(wid, pageId){
  var w = winFind(wid); if(!w) return;
  if(w.state === 'minimized') w.state = 'normal';
  window._winActive = wid;
  winMountPage(wid, pageId, {push:true});
  renderWinChrome();
  renderWinWorkspace();
}

function winMountPage(wid, pageId, opts){
  opts = opts || {};
  var w = winFind(wid); if(!w) return;
  var pageEl = document.getElementById('page-'+pageId);
  if(!pageEl){ if(typeof ntf==='function') ntf('صفحه پیدا نشد: '+pageId,'err'); return; }
  var pane = document.querySelector('.win-pane[data-wid="'+wid+'"]');
  var body = pane ? pane.querySelector('.win-body') : null;
  if(!body){
    // workspace هنوز رندر نشده
    renderWinWorkspace();
    pane = document.querySelector('.win-pane[data-wid="'+wid+'"]');
    body = pane ? pane.querySelector('.win-body') : null;
  }
  if(!body) return;

  // اگر صفحه در پنجره دیگری است، آن پنجره را به صفحه‌ی قبلی‌اش یا داشبورد ببر
  (window._wins||[]).forEach(function(other){
    if(other.id === wid) return;
    if(other.pageId === pageId){
      var parking = document.getElementById('page-parking');
      var fallback = (other.history||[]).slice().reverse().find(function(h){ return h !== pageId; }) || 'dashboard';
      other.pageId = fallback;
      var fo = document.getElementById('page-'+fallback);
      var ob = document.querySelector('.win-pane[data-wid="'+other.id+'"] .win-body');
      if(fo && ob){ ob.appendChild(fo); }
      else if(fo && parking){ parking.appendChild(fo); }
    }
  });

  body.appendChild(pageEl);
  w.pageId = pageId;
  if(opts.push !== false){
    if(!w.history) w.history = [];
    if(w.history[w.history.length-1] !== pageId) w.history.push(pageId);
    if(w.history.length > 30) w.history = w.history.slice(-30);
  }

  // فقط صفحه داخل این بدنه active
  Array.prototype.forEach.call(body.querySelectorAll('.page'), function(p){ p.classList.remove('active'); });
  pageEl.classList.add('active');

  if(!opts.skipNav){
    document.querySelectorAll('.nav-it').forEach(function(n){ n.classList.remove('active'); });
    var nav = document.querySelector('.nav-it[data-page="'+pageId+'"]');
    if(nav) nav.classList.add('active');
  }
  try{ localStorage.setItem('laegh_last_page', pageId); }catch(_e){}

  var fab=document.getElementById('fab-adddev');
  if(fab){
    if(pageId==='invoice') fab.classList.add('show');
    else fab.classList.remove('show');
  }
  try {
    if(pageId==='saved') renderSaved();
    if(pageId==='phonebook') renderPB();
    if(pageId==='products') renderProds();
    if(pageId==='inventory') renderInv();
    if(pageId==='defective') renderDefective();
    if(pageId==='datetime') renderCalPage();
    if(pageId==='audit') renderAuditLog();
    if(pageId==='dataio') renderDataStats();
    if(pageId==='parts') renderParts();
    if(pageId==='sales') renderSales();
    if(pageId==='services') renderSvcs();
    if(pageId==='warranty') renderWar();
    if(pageId==='settings'){ loadPrintSettingsUI(); loadCompanyInfo(); loadAutoSaveUI(); loadAppearanceUI(); if(typeof loadUpdateUI==='function') loadUpdateUI(); }
    if(pageId==='tasks') renderTasks();
    if(pageId==='accounts') renderAccounts();
    if(pageId==='dashboard') renderDashboard();
    if(pageId==='warehouse') renderWarehouseDocs();
    if(pageId==='warehouse-entities' && typeof renderWarehouseEntities==='function') renderWarehouseEntities();
    if(pageId==='daqi' && typeof renderDaqi==='function') renderDaqi();
  } catch(e){
    if(typeof ntf==='function') ntf('خطای نمایش صفحه: '+e.message,'err');
  }
  if(typeof initTooltips==='function') initTooltips();
  renderWinChrome();
}

function renderWinChrome(){
  var chrome = document.getElementById('win-chrome');
  if(!chrome) return;
  var wins = window._wins || [];
  var tabs = wins.map(function(w){
    var active = (w.id === window._winActive) ? ' active' : '';
    var mark = w.state==='minimized' ? ' (کوچک)' : (w.state==='maximized' ? ' (بزرگ)' : '');
    return '<button type="button" class="win-tab'+active+'" data-wid="'+w.id+'" onclick="winActivate(\''+w.id+'\')" title="'+winPageTitle(w.pageId)+'">'
      +'<span class="wt-title">'+winPageTitle(w.pageId)+mark+'</span>'
      +'<span class="wt-x" onclick="winClose(\''+w.id+'\',event)" title="بستن">✕</span></button>';
  }).join('');
  var mins = wins.filter(function(w){ return w.state==='minimized'; }).map(function(w){
    return '<button type="button" class="win-min-chip" onclick="winRestore(\''+w.id+'\',event)">⬆ '+winPageTitle(w.pageId)+'</button>';
  }).join('');
  chrome.innerHTML =
    '<div id="win-tabs">'+tabs+'</div>'
    +'<div id="win-actions">'
    +'<button type="button" class="btn btn-sm" onclick="winOpenFromActive()" title="پنجره جدید با همان صفحه">＋ پنجره</button>'
    +'<button type="button" class="btn btn-sm btn-o" onclick="winOpen(\'dashboard\')" title="پنجره جدید داشبورد">＋ داشبورد</button>'
    +'</div>'
    +(mins ? '<div id="win-min-tray">'+mins+'</div>' : '');
}

function winOpenFromActive(){
  var w = winFind(window._winActive);
  var page = w ? w.pageId : 'dashboard';
  // صفحه جدید: اگر همان صفحه در پنجره دیگر است، داشبورد باز کن مگر کاربر صفحه دیگری بخواهد
  winOpen('dashboard');
}

function renderWinWorkspace(){
  var ws = document.getElementById('win-workspace');
  if(!ws) return;
  var wins = (window._wins||[]).filter(function(w){ return w.state !== 'minimized'; });
  var hasMax = wins.some(function(w){ return w.state === 'maximized'; });
  ws.className = '';
  if(hasMax){
    ws.classList.add('win-has-max');
    wins = wins.filter(function(w){ return w.state === 'maximized' || w.id === window._winActive; });
    // فقط ماکسیمایز را نشان بده
    wins = (window._wins||[]).filter(function(w){ return w.state === 'maximized'; });
    if(!wins.length){
      wins = (window._wins||[]).filter(function(w){ return w.state !== 'minimized'; });
    }
  } else {
    var n = wins.length;
    if(n === 2) ws.classList.add('win-split-2');
    else if(n === 3) ws.classList.add('win-split-3');
    else if(n >= 4) ws.classList.add('win-split-4');
  }

  // حفظ bodyهای موجود تا DOM صفحه از دست نرود
  var existing = {};
  Array.prototype.forEach.call(ws.querySelectorAll('.win-pane'), function(p){
    existing[p.getAttribute('data-wid')] = p;
  });

  var htmlPanes = [];
  var order = hasMax ? wins : (window._wins||[]).filter(function(w){ return w.state !== 'minimized'; });
  order.forEach(function(w){
    var canBack = (w.history && w.history.length > 1);
    var active = (w.id === window._winActive) ? ' active-pane' : '';
    var st = w.state === 'maximized' ? ' maximized' : '';
    htmlPanes.push(
      '<div class="win-pane'+active+st+'" data-wid="'+w.id+'" onclick="window._winActive=\''+w.id+'\';renderWinChrome();">'
      +'<div class="win-titlebar">'
      +'<button type="button" class="wt-btn" onclick="winBack(\''+w.id+'\',event)" title="برگشت در همین پنجره" '+(canBack?'':'disabled')+'>←</button>'
      +'<div class="wt-label">'+winPageTitle(w.pageId)+'</div>'
      +'<button type="button" class="wt-btn" onclick="winMinimize(\''+w.id+'\',event)" title="کوچک‌سازی">─</button>'
      +'<button type="button" class="wt-btn" onclick="winMaximize(\''+w.id+'\',event)" title="بزرگ‌نمایی / بازگشت">'+((w.state==='maximized')?'❐':'□')+'</button>'
      +'<button type="button" class="wt-btn danger" onclick="winClose(\''+w.id+'\',event)" title="بستن">✕</button>'
      +'</div>'
      +'<div class="win-body" data-wid-body="'+w.id+'"></div>'
      +'</div>'
    );
  });
  ws.innerHTML = htmlPanes.join('');

  // صفحات را دوباره به بدنه مربوطه وصل کن
  order.forEach(function(w){
    var body = ws.querySelector('[data-wid-body="'+w.id+'"]');
    var pageEl = document.getElementById('page-'+w.pageId);
    if(body && pageEl){
      body.appendChild(pageEl);
      pageEl.classList.add('active');
    }
  });
}

function showPage(id, el){
  ensureWindowManager();
  var ev = window.event;
  var openNew = false;
  try{
    if(ev && (ev.ctrlKey || ev.metaKey || ev.shiftKey || ev.button === 1)) openNew = true;
  }catch(_e){}
  // اگر از منو با کلید میانبر پنجره جدید
  if(openNew){
    // اگر همان صفحه الان در پنجره‌ای هست، باز هم پنجره جدید با داشبورد نساز — صفحه را در پنجره جدید باز کن
    // ولی چون یک DOM داریم، صفحه از پنجره قبلی جدا می‌شود؛ پنجره قبلی به history قبلی برمی‌گردد
    winOpen(id);
    if(el) el.classList.add('active');
    return;
  }
  var wid = window._winActive;
  if(!wid || !winFind(wid)){
    wid = winOpen(id, {silent:true, noHistoryPush:true});
  } else {
    winNavigate(wid, id);
  }
  if(el){
    document.querySelectorAll('.nav-it').forEach(function(n){ n.classList.remove('active'); });
    el.classList.add('active');
  }
}
'''

# Fix indentation in old_show - the file might have slightly different whitespace for if(id==='dataio') block
# Use regex to find showPage function
m = re.search(r"// ─── PAGES ─+\nfunction showPage\(id, el\)\{", text)
if not m:
    # try simpler
    m = re.search(r"function showPage\(id, el\)\{", text)
    if not m:
        raise SystemExit("showPage not found")
    start = m.start()
else:
    start = m.start()

# extract full showPage with brace count
brace = 0
i = text.find("{", start)
started = False
j = i
while j < len(text):
    if text[j] == "{":
        brace += 1
        started = True
    elif text[j] == "}":
        brace -= 1
        if started and brace == 0:
            j += 1
            break
    j += 1
old_fn = text[start:j]
if "function showPage" not in old_fn:
    raise SystemExit("failed to extract showPage")
text = text[:start] + NEW_WM + text[j:]

# Boot: call ensureWindowManager after DOM ready - find a good hook
# Look for restoreAutoSaveHandlesOnBoot call or applyAppearanceSettings on load
boot_hooks = [
    "restoreAutoSaveHandlesOnBoot()",
    "applyAppearanceSettings()",
    "restoreSbCollapse()",
]
# Add after startAutoSave or similar boot
boot_insert = """
try{ ensureWindowManager(); }catch(_wm){}
"""
# Find DOMContentLoaded or end boot block
if "ensureWindowManager()" not in text.split("function ensureWindowManager")[0]:
    # insert near restoreAutoSaveHandlesOnBoot().then or call site
    if "restoreAutoSaveHandlesOnBoot()" in text:
        text = text.replace(
            "restoreAutoSaveHandlesOnBoot()",
            "restoreAutoSaveHandlesOnBoot(); try{ ensureWindowManager(); }catch(_wm0){}",
            1,
        )
    # also delayed
    delayed = "setTimeout(function(){ try{ ensureWindowManager(); }catch(_wm1){} }, 0);"
    # after applyAppearanceSettings call if present in boot
    if "applyAppearanceSettings();" in text:
        text = text.replace(
            "applyAppearanceSettings();",
            "applyAppearanceSettings(); " + delayed,
            1,
        )

# Help text
help_needle = '<li><b>🖼 عکس و ضمیمه روی هارد:</b>'
help_add = '''<li><b>🗂 چندپنجره:</b> مثل تب‌های مرورگر می‌توانید چند بخش را باز کنید. از نوار بالای صفحه «＋ پنجره» بزنید، یا روی آیتم منو <b>Ctrl+کلیک</b> / <b>Shift+کلیک</b> کنید تا در پنجره جدید باز شود. دکمه‌های <b>─</b> کوچک‌سازی، <b>□</b> بزرگ‌نمایی و <b>✕</b> بستن هستند. دکمه <b>←</b> در نوار عنوان هر پنجره، مسیر قبلی همان پنجره را برمی‌گرداند. دو یا چند پنجره غیرکوچک کنار هم دیده می‌شوند.</li>
    ''' + help_needle
if help_needle in text:
    text = text.replace(help_needle, help_add, 1)

# Nav hint in autosave tip area? skip

HTML.write_text(text, encoding="utf-8")
print("OK", NEW, "showPage patched", "ensureWindowManager" in text)
print("winOpen count", text.count("function winOpen"))
print("fa version", text.count(NEW_FA))
