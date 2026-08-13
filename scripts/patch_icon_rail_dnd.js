#!/usr/bin/env node
/** Icon-rail mode, shapes, separate BGs, dashboard DnD shortcuts */
const fs = require('fs');
const SRC = process.argv[2] || '/workspace/Laegh_Final_11.5.17.html';
const OUT = process.argv[3] || '/workspace/Laegh_Final_12.5.17.html';
let html = fs.readFileSync(SRC, 'utf8');

function mustReplace(a, b, label) {
  if (!html.includes(a)) {
    console.error('❌ missing:', label);
    console.error(String(a).slice(0, 200));
    process.exit(1);
  }
  html = html.replace(a, b);
  console.log('✅', label);
}

const FEATURE_CSS = `
/* ══════ ریل آیکون + پس‌زمینه‌های مجزا + شورتکات داشبورد ══════ */
.sb, .main, #page-dashboard .dash-shell{
  background-size:cover!important;
  background-position:center center!important;
  background-repeat:no-repeat!important;
}
.sb.has-custom-bg{background-image:var(--sb-bg-img)!important;}
.main.has-custom-bg{
  background-image:var(--main-bg-img);
  background-color:transparent;
  position:relative;
}
.main.has-custom-bg::before{
  content:'';position:fixed;top:0;left:0;right:var(--sidebar);bottom:0;z-index:-1;
  background-image:var(--main-bg-img);
  background-size:cover;background-position:center;background-repeat:no-repeat;
  pointer-events:none;
}
#page-dashboard .dash-shell{
  min-height:calc(100vh - 0px);
  position:relative;
  overflow:hidden;
  border-radius:0;
}
#page-dashboard .dash-shell.has-dash-bg{
  background-image:var(--dash-bg-img);
}
#page-dashboard .dash-shell.has-dash-bg::after{
  content:'';position:absolute;inset:0;z-index:0;
  background:rgba(255,255,255,var(--dash-bg-overlay,0.35));
  pointer-events:none;
}
body.theme-dark #page-dashboard .dash-shell.has-dash-bg::after{
  background:rgba(10,12,15,var(--dash-bg-overlay,0.45));
}
#page-dashboard .dash-shell > *{position:relative;z-index:1;}

/* شکل آیکون */
body.nav-shape-circle .nav-it .nav-ico{border-radius:50%!important;}
body.nav-shape-square .nav-it .nav-ico{border-radius:4px!important;}
body.nav-shape-rect .nav-it .nav-ico{border-radius:8px!important;width:34px;height:26px;min-width:34px;}
body.nav-shape-rounded .nav-it .nav-ico{border-radius:10px!important;}

/* حالت فقط‌آیکون (ریل کلاسیک) */
body.sb-icons-only{--sidebar:78px;}
body.sb-icons-only .sb{width:78px;padding-right:6px;padding-left:6px;}
body.sb-icons-only .main{margin-right:78px;max-width:calc(100% - 78px);}
body.sb-icons-only .main.has-custom-bg::before{right:78px;}
body.sb-icons-only .sb-brand,
body.sb-icons-only #sb-clock,
body.sb-icons-only .gs-wrap,
body.sb-icons-only .sb-section,
body.sb-icons-only .nav-it .nav-txt,
body.sb-icons-only .sb-foot,
body.sb-icons-only .nav-badge{display:none!important;}
body.sb-icons-only .sb-logo img{max-width:48px;max-height:36px;}
body.sb-icons-only .sb-logo{padding:10px 4px;}
body.sb-icons-only .sb-group.collapsed .nav-it{display:flex!important;} /* در ریل همیشه دیده شوند */
body.sb-icons-only .nav-it{
  justify-content:center;align-items:center;
  padding:10px 6px;margin:4px 2px;border-radius:12px;
  position:relative;
}
body.sb-icons-only .nav-it .nav-ico{
  width:44px;height:44px;min-width:44px;min-height:44px;
  border-radius:12px;
}
body.sb-icons-only.nav-shape-circle .nav-it .nav-ico{border-radius:50%!important;}
body.sb-icons-only.nav-shape-rect .nav-it .nav-ico{width:48px;height:36px;min-width:48px;border-radius:8px!important;}
body.sb-icons-only .nav-it .nav-ico svg{width:22px;height:22px;}
body.sb-icons-only .nav-it.active{background:rgba(255,255,255,.18);}
/* تولتیپ هاور */
body.sb-icons-only .nav-it[data-tip]:hover::after{
  content:attr(data-tip);
  position:absolute;left:calc(100% + 10px);top:50%;transform:translateY(-50%);
  background:#1f2937;color:#fff;padding:7px 12px;border-radius:8px;
  font-size:12px;white-space:nowrap;z-index:2000;pointer-events:none;
  box-shadow:0 6px 18px rgba(0,0,0,.25);
}
body.sb-icons-only .nav-it[data-tip]:hover::before{
  content:'';position:absolute;left:calc(100% + 4px);top:50%;transform:translateY(-50%);
  border:6px solid transparent;border-left-color:#1f2937;z-index:2000;
}
/* در RTL سایدبار راست است → تولتیپ به سمت چپ (داخل صفحه) */
body.sb-icons-only .nav-it[data-tip]:hover::after{right:calc(100% + 10px);left:auto;}
body.sb-icons-only .nav-it[data-tip]:hover::before{
  right:calc(100% + 4px);left:auto;
  border-left-color:transparent;border-right-color:#1f2937;
}

/* شورتکات‌های داشبورد */
.dash-shortcuts{
  display:flex;flex-wrap:wrap;gap:12px;min-height:110px;
  padding:14px;margin-bottom:14px;
  border:2px dashed color-mix(in srgb,var(--blue) 45%,var(--border));
  border-radius:14px;background:rgba(255,255,255,.55);
  align-content:flex-start;align-items:flex-start;
  transition:border-color .15s, background .15s;
}
body.theme-dark .dash-shortcuts{background:rgba(20,24,30,.45);}
.dash-shortcuts.drag-over{
  border-color:var(--blue);background:color-mix(in srgb,var(--blue-l) 70%,transparent);
}
.dash-shortcuts-hint{
  width:100%;text-align:center;color:var(--text2);font-size:12px;padding:18px 8px;line-height:1.7;
}
.dash-sc{
  width:92px;min-height:92px;border-radius:14px;padding:10px 8px;
  background:var(--card);border:1px solid var(--border);
  box-shadow:0 2px 10px rgba(10,30,45,.08);
  display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;
  cursor:pointer;position:relative;user-select:none;
  transition:box-shadow .12s, transform .12s;
}
.dash-sc:hover{box-shadow:0 6px 16px rgba(10,30,45,.14);}
.dash-sc .nav-ico, .dash-sc-ico{
  width:42px;height:42px;border-radius:12px;display:flex;align-items:center;justify-content:center;color:#fff;
  box-shadow:inset 0 1px 0 rgba(255,255,255,.3),0 1px 2px rgba(0,0,0,.2);
}
.dash-sc .nav-ico svg, .dash-sc-ico svg{width:20px;height:20px;stroke:#fff;}
.dash-sc-lbl{font-size:11px;text-align:center;line-height:1.35;color:var(--text);max-width:100%;overflow-wrap:anywhere;}
.dash-sc-x{
  position:absolute;top:4px;left:4px;width:18px;height:18px;border:none;border-radius:50%;
  background:rgba(0,0,0,.45);color:#fff;font-size:11px;cursor:pointer;line-height:1;
}
.dash-sc-x:hover{background:var(--red);}
.dash-wallpaper-bar{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:0 16px 10px;}
.nav-it[draggable="true"]{cursor:grab;}
.nav-it[draggable="true"]:active{cursor:grabbing;}
`;

mustReplace(
`body.depth-3d .nav-it{margin:2px 4px;max-width:calc(100% - 8px);}
body.depth-3d .nav-it:hover{background:rgba(255,255,255,.12);}`,
`body.depth-3d .nav-it{margin:2px 4px;max-width:calc(100% - 8px);}
body.depth-3d .nav-it:hover{background:rgba(255,255,255,.12);}
${FEATURE_CSS}`,
'feature CSS');

// Dashboard HTML shell with wallpaper + shortcuts dock
mustReplace(
`<div class="page" id="page-dashboard">
<div class="topbar"><div class="topbar-title">🏠 داشبورد مرکزی</div></div>
<div style="padding:16px">
  <div id="dashboard-content"></div>
</div>
</div>`,
`<div class="page" id="page-dashboard">
<div class="dash-shell" id="dash-shell">
  <div class="topbar" style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap">
    <div class="topbar-title">🏠 داشبورد مرکزی</div>
    <div class="dash-wallpaper-bar">
      <button class="btn btn-sm" onclick="document.getElementById('dash-bg-inp').click()">🖼 پس‌زمینه داشبورد</button>
      <input type="file" id="dash-bg-inp" accept="image/*" style="display:none" onchange="setDashBgImage(this)">
      <button class="btn btn-sm btn-r" onclick="clearDashBgImage()">حذف عکس</button>
      <label style="font-size:11px;color:var(--text2);display:flex;align-items:center;gap:6px">روکش
        <input type="range" id="dash-bg-overlay" min="0" max="0.85" step="0.05" value="0.35" oninput="setDashBgOverlay(this.value)" style="width:90px">
      </label>
    </div>
  </div>
  <div style="padding:16px">
    <div class="card-title" style="margin-bottom:8px">📌 شورتکات‌ها — آیکون منو را بکشید و اینجا رها کنید</div>
    <div id="dash-shortcuts" class="dash-shortcuts" ondragover="onDashDragOver(event)" ondragleave="onDashDragLeave(event)" ondrop="onDashDrop(event)">
      <div class="dash-shortcuts-hint">آیکون‌های منوی راست را بکشید و در این کادر رها کنید تا شورتکات ساخته شود</div>
    </div>
    <div id="dashboard-content"></div>
  </div>
</div>
</div>`,
'dashboard shell + shortcuts');

// Appearance settings UI
mustReplace(
`    <div class="card">
      <div class="card-title">🖼 تصویر پس‌زمینه برنامه</div>
      <p style="font-size:11px;color:var(--text2);margin-bottom:8px">یک تصویر برای پس‌زمینه‌ی فضای پشت کارت‌ها انتخاب کنید. خود کارت‌ها همیشه سفید/خوانا باقی می‌مانند.</p>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px">
        <button class="btn btn-sm btn-p" onclick="document.getElementById('app-bg-inp').click()">🖼 انتخاب عکس</button>
        <input type="file" id="app-bg-inp" accept="image/*" style="display:none" onchange="setAppBgImage(this)">
        <button class="btn btn-sm btn-r" onclick="clearAppBgImage()">🗑 حذف پس‌زمینه</button>
      </div>
      <div class="f">
        <label>شفافیت روکش سفید (برای حفظ خوانایی متن)</label>
        <input type="range" id="app-bg-overlay" min="0" max="0.9" step="0.05" value="0.55" oninput="setAppBgOverlay(this.value)">
      </div>
    </div>

  </div>`,
`    <div class="card">
      <div class="card-title">📌 منوی راست — حالت و شکل آیکون</div>
      <div class="g2" style="margin-bottom:8px">
        <div class="f">
          <label>حالت منو</label>
          <select id="sb-mode-select" onchange="setSbMode(this.value)">
            <option value="full">کامل — آیکون + نوشته</option>
            <option value="icons">فقط آیکون‌های بزرگ (با هاور نام)</option>
          </select>
        </div>
        <div class="f">
          <label>شکل آیکون</label>
          <select id="nav-shape-select" onchange="setNavShape(this.value)">
            <option value="rounded">گرد گوشه</option>
            <option value="circle">دایره</option>
            <option value="square">مربع</option>
            <option value="rect">مستطیل</option>
          </select>
        </div>
      </div>
      <p style="font-size:10px;color:var(--text2);line-height:1.6">در حالت فقط‌آیکون، با بردن موس روی هر شکل، نامش نشان داده می‌شود. می‌توانید آیکون را به داشبورد بکشید تا شورتکات بسازید.</p>
    </div>

    <div class="card">
      <div class="card-title">🖼 پس‌زمینه‌ها (جدا از هم)</div>
      <p style="font-size:11px;color:var(--text2);margin-bottom:10px;line-height:1.7">هر ناحیه پس‌زمینهٔ خودش را دارد. عکس با <b>cover</b> دقیقاً در چهارچوب می‌نشیند و بیرون نمی‌زند (هر سایزی).</p>
      <div class="g2" style="margin-bottom:10px">
        <div>
          <div class="card-title">ستون راست (منو)</div>
          <button class="btn btn-sm btn-p" onclick="document.getElementById('sb-bg-inp').click()">انتخاب عکس</button>
          <input type="file" id="sb-bg-inp" accept="image/*" style="display:none" onchange="setSbBgImage(this)">
          <button class="btn btn-sm btn-r" onclick="clearSbBgImage()">حذف</button>
        </div>
        <div>
          <div class="card-title">وسط (صفحات)</div>
          <button class="btn btn-sm btn-p" onclick="document.getElementById('main-bg-inp').click()">انتخاب عکس</button>
          <input type="file" id="main-bg-inp" accept="image/*" style="display:none" onchange="setMainBgImage(this)">
          <button class="btn btn-sm btn-r" onclick="clearMainBgImage()">حذف</button>
        </div>
      </div>
      <div class="card-title">پس‌زمینه عمومی قدیمی (کل برنامه)</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px">
        <button class="btn btn-sm btn-p" onclick="document.getElementById('app-bg-inp').click()">🖼 انتخاب عکس</button>
        <input type="file" id="app-bg-inp" accept="image/*" style="display:none" onchange="setAppBgImage(this)">
        <button class="btn btn-sm btn-r" onclick="clearAppBgImage()">🗑 حذف پس‌زمینه</button>
      </div>
      <div class="f">
        <label>شفافیت روکش سفید (پس‌زمینه عمومی)</label>
        <input type="range" id="app-bg-overlay" min="0" max="0.9" step="0.05" value="0.55" oninput="setAppBgOverlay(this.value)">
      </div>
      <p style="font-size:10px;color:var(--text2);margin-top:8px">پس‌زمینهٔ اختصاصی داشبورد را از خود صفحهٔ داشبورد هم می‌توانید عوض کنید.</p>
    </div>

  </div>`,
'appearance UI for icons + separate BGs');

// Help
mustReplace(
`    <li><b>آیکون منو:</b> هر آیتم منوی سمت راست یک شکل رنگی کلاسیک دارد تا سریع‌تر پیدا شود (سبک نرم‌افزارهای قدیمی دسکتاپ).</li>
  </ul>`,
`    <li><b>آیکون منو:</b> هر آیتم منوی سمت راست یک شکل رنگی کلاسیک دارد تا سریع‌تر پیدا شود (سبک نرم‌افزارهای قدیمی دسکتاپ).</li>
    <li><b>حالت فقط‌آیکون:</b> از تنظیمات → ظاهر می‌توانید منو را فقط با آیکون‌های بزرگ ببینید؛ با هاور، نام نشان داده می‌شود. شکل آیکون (دایره/مربع/مستطیل) قابل تغییر است.</li>
    <li><b>پس‌زمینه جدا:</b> ستون راست، وسط برنامه، و داشبورد مرکزی هرکدام عکس جدا دارند. عکس با cover داخل چهارچوب می‌ماند و بیرون نمی‌زند.</li>
    <li><b>شورتکات داشبورد:</b> آیکون منو را بکشید و روی کادر شورتکات داشبورد رها کنید.</li>
  </ul>`,
'help bullets');

// Backup fields
mustReplace(
`      appBg: localStorage.getItem('laegh_app_bg')||'',
      appBgOverlay: localStorage.getItem('laegh_app_bg_overlay')||''
    },`,
`      appBg: localStorage.getItem('laegh_app_bg')||'',
      appBgOverlay: localStorage.getItem('laegh_app_bg_overlay')||'',
      sbMode: localStorage.getItem('laegh_sb_mode')||'',
      navShape: localStorage.getItem('laegh_nav_shape')||'',
      sbBg: localStorage.getItem('laegh_sb_bg')||'',
      mainBg: localStorage.getItem('laegh_main_bg')||'',
      dashBg: localStorage.getItem('laegh_dash_bg')||'',
      dashBgOverlay: localStorage.getItem('laegh_dash_bg_overlay')||'',
      dashShortcuts: localStorage.getItem('laegh_dash_shortcuts')||''
    },`,
'backup new appearance fields');

mustReplace(
`        if(ap.appBg) localStorage.setItem('laegh_app_bg', ap.appBg);
        if(ap.appBgOverlay) localStorage.setItem('laegh_app_bg_overlay', ap.appBgOverlay);
        if(typeof applyAppearanceSettings==='function') applyAppearanceSettings();
      }`,
`        if(ap.appBg) localStorage.setItem('laegh_app_bg', ap.appBg);
        if(ap.appBgOverlay) localStorage.setItem('laegh_app_bg_overlay', ap.appBgOverlay);
        if(ap.sbMode) localStorage.setItem('laegh_sb_mode', ap.sbMode);
        if(ap.navShape) localStorage.setItem('laegh_nav_shape', ap.navShape);
        if(ap.sbBg) localStorage.setItem('laegh_sb_bg', ap.sbBg);
        if(ap.mainBg) localStorage.setItem('laegh_main_bg', ap.mainBg);
        if(ap.dashBg) localStorage.setItem('laegh_dash_bg', ap.dashBg);
        if(ap.dashBgOverlay) localStorage.setItem('laegh_dash_bg_overlay', ap.dashBgOverlay);
        if(ap.dashShortcuts) localStorage.setItem('laegh_dash_shortcuts', ap.dashShortcuts);
        if(typeof applyAppearanceSettings==='function') applyAppearanceSettings();
        if(typeof renderDashShortcuts==='function') renderDashShortcuts();
      }`,
'restore new appearance fields');

mustReplace(
`  const protectedKeys = ['laegh_adminpw','laegh_theme','laegh_skin','laegh_depth3d','laegh_color_theme','laegh_logo','laegh_sender','laegh_autosave_enabled','laegh_autosave_interval'];`,
`  const protectedKeys = ['laegh_adminpw','laegh_theme','laegh_skin','laegh_depth3d','laegh_color_theme','laegh_sb_mode','laegh_nav_shape','laegh_logo','laegh_sender','laegh_autosave_enabled','laegh_autosave_interval'];`,
'protect new keys');

// JS feature block before enhanceSidebarNav
const FEATURE_JS = `
// ===== منوی فقط‌آیکون / شکل / پس‌زمینه‌های مجزا / شورتکات داشبورد =====
function setSbMode(val){
  var icons = val === 'icons';
  document.body.classList.toggle('sb-icons-only', icons);
  localStorage.setItem('laegh_sb_mode', icons ? 'icons' : 'full');
  refreshNavTooltips();
  ntf(icons ? 'حالت فقط‌آیکون فعال شد' : 'منوی کامل فعال شد');
}
function setNavShape(val){
  document.body.classList.remove('nav-shape-circle','nav-shape-square','nav-shape-rect','nav-shape-rounded');
  var map = {circle:'nav-shape-circle', square:'nav-shape-square', rect:'nav-shape-rect', rounded:'nav-shape-rounded'};
  document.body.classList.add(map[val] || 'nav-shape-rounded');
  localStorage.setItem('laegh_nav_shape', val || 'rounded');
  ntf('شکل آیکون تغییر کرد');
}
function _setCoverBg(targetSel, cssVar, storageKey, fileInput){
  var f = fileInput && fileInput.files && fileInput.files[0]; if(!f) return;
  var r = new FileReader();
  r.onload = function(e){
    localStorage.setItem(storageKey, e.target.result);
    applyLayerBackgrounds();
    ntf('پس‌زمینه تنظیم شد ✅');
  };
  r.readAsDataURL(f);
}
function setSbBgImage(inp){ _setCoverBg('.sb', '--sb-bg-img', 'laegh_sb_bg', inp); }
function clearSbBgImage(){ localStorage.removeItem('laegh_sb_bg'); applyLayerBackgrounds(); ntf('پس‌زمینه منو حذف شد'); }
function setMainBgImage(inp){ _setCoverBg('.main', '--main-bg-img', 'laegh_main_bg', inp); }
function clearMainBgImage(){ localStorage.removeItem('laegh_main_bg'); applyLayerBackgrounds(); ntf('پس‌زمینه وسط حذف شد'); }
function setDashBgImage(inp){ _setCoverBg('#dash-shell', '--dash-bg-img', 'laegh_dash_bg', inp); }
function clearDashBgImage(){ localStorage.removeItem('laegh_dash_bg'); applyLayerBackgrounds(); ntf('پس‌زمینه داشبورد حذف شد'); }
function setDashBgOverlay(val){
  localStorage.setItem('laegh_dash_bg_overlay', val);
  document.documentElement.style.setProperty('--dash-bg-overlay', val);
}
function applyLayerBackgrounds(){
  var sb = document.querySelector('.sb');
  var main = document.querySelector('.main');
  var dash = document.getElementById('dash-shell');
  var sbBg = localStorage.getItem('laegh_sb_bg') || '';
  var mainBg = localStorage.getItem('laegh_main_bg') || '';
  var dashBg = localStorage.getItem('laegh_dash_bg') || '';
  if(sb){
    if(sbBg){ sb.classList.add('has-custom-bg'); document.documentElement.style.setProperty('--sb-bg-img', 'url("'+sbBg.replace(/"/g,'%22')+'")'); }
    else { sb.classList.remove('has-custom-bg'); document.documentElement.style.removeProperty('--sb-bg-img'); }
  }
  if(main){
    if(mainBg){ main.classList.add('has-custom-bg'); document.documentElement.style.setProperty('--main-bg-img', 'url("'+mainBg.replace(/"/g,'%22')+'")'); }
    else { main.classList.remove('has-custom-bg'); document.documentElement.style.removeProperty('--main-bg-img'); }
  }
  if(dash){
    if(dashBg){ dash.classList.add('has-dash-bg'); document.documentElement.style.setProperty('--dash-bg-img', 'url("'+dashBg.replace(/"/g,'%22')+'")'); }
    else { dash.classList.remove('has-dash-bg'); document.documentElement.style.removeProperty('--dash-bg-img'); }
  }
  var ov = localStorage.getItem('laegh_dash_bg_overlay') || '0.35';
  document.documentElement.style.setProperty('--dash-bg-overlay', ov);
  var ovEl = document.getElementById('dash-bg-overlay'); if(ovEl) ovEl.value = ov;
}
function refreshNavTooltips(){
  document.querySelectorAll('.nav-it[data-page]').forEach(function(el){
    var label = '';
    var t = el.querySelector('.nav-txt');
    if(t) label = (t.textContent || '').trim();
    if(!label) label = el.getAttribute('data-page') || '';
    el.setAttribute('data-tip', label);
    el.setAttribute('title', label);
    el.setAttribute('draggable', 'true');
    if(!el._dragBound){
      el.addEventListener('dragstart', function(ev){
        var page = el.getAttribute('data-page') || '';
        var lbl = el.getAttribute('data-tip') || page;
        ev.dataTransfer.setData('text/laegh-page', page);
        ev.dataTransfer.setData('text/laegh-label', lbl);
        ev.dataTransfer.setData('text/plain', page);
        ev.dataTransfer.effectAllowed = 'copy';
      });
      el._dragBound = true;
    }
  });
}
function loadDashShortcuts(){
  try { return JSON.parse(localStorage.getItem('laegh_dash_shortcuts') || '[]') || []; }
  catch(e){ return []; }
}
function saveDashShortcuts(arr){
  localStorage.setItem('laegh_dash_shortcuts', JSON.stringify(arr || []));
}
function addDashShortcut(page, label){
  if(!page) return;
  var arr = loadDashShortcuts();
  if(arr.some(function(x){ return x.page === page; })){ ntf('این شورتکات از قبل هست'); return; }
  arr.push({ page: page, label: label || page });
  saveDashShortcuts(arr);
  renderDashShortcuts();
  ntf('شورتکات افزوده شد');
}
function removeDashShortcut(page, ev){
  if(ev) ev.stopPropagation();
  var arr = loadDashShortcuts().filter(function(x){ return x.page !== page; });
  saveDashShortcuts(arr);
  renderDashShortcuts();
}
function renderDashShortcuts(){
  var box = document.getElementById('dash-shortcuts');
  if(!box) return;
  var arr = loadDashShortcuts();
  box.innerHTML = '';
  if(!arr.length){
    var hint = document.createElement('div');
    hint.className = 'dash-shortcuts-hint';
    hint.textContent = 'آیکون‌های منوی راست را بکشید و در این کادر رها کنید تا شورتکات ساخته شود';
    box.appendChild(hint);
    return;
  }
  arr.forEach(function(s){
    var tile = document.createElement('div');
    tile.className = 'dash-sc';
    tile.title = String(s.label||s.page);
    var x = document.createElement('button');
    x.type = 'button';
    x.className = 'dash-sc-x';
    x.title = 'حذف';
    x.textContent = '×';
    x.addEventListener('click', function(ev){ removeDashShortcut(s.page, ev); });
    var srcNav = document.querySelector('.nav-it[data-page="'+s.page+'"] .nav-ico');
    if(srcNav){
      tile.appendChild(x);
      tile.appendChild(srcNav.cloneNode(true));
    } else {
      var ico = document.createElement('div');
      ico.className = 'dash-sc-ico';
      ico.style.background = 'var(--blue)';
      ico.textContent = '★';
      tile.appendChild(x);
      tile.appendChild(ico);
    }
    var lbl = document.createElement('div');
    lbl.className = 'dash-sc-lbl';
    lbl.textContent = String(s.label||s.page);
    tile.appendChild(lbl);
    tile.addEventListener('click', function(ev){
      if(ev.target && ev.target.classList && ev.target.classList.contains('dash-sc-x')) return;
      var nav = document.querySelector('.nav-it[data-page="'+s.page+'"]');
      showPage(s.page, nav);
    });
    box.appendChild(tile);
  });
}
function onDashDragOver(ev){
  ev.preventDefault();
  ev.dataTransfer.dropEffect = 'copy';
  ev.currentTarget.classList.add('drag-over');
}
function onDashDragLeave(ev){
  ev.currentTarget.classList.remove('drag-over');
}
function onDashDrop(ev){
  ev.preventDefault();
  ev.currentTarget.classList.remove('drag-over');
  var page = ev.dataTransfer.getData('text/laegh-page') || ev.dataTransfer.getData('text/plain');
  var label = ev.dataTransfer.getData('text/laegh-label') || page;
  if(page) addDashShortcut(page, label);
}
`;

mustReplace(
`applyAppearanceSettings(); // اعمال فوری تنظیمات ظاهری ذخیره‌شده، همان لحظه بارگذاری اسکریپت

// ===== کلاسیک‌سازی آیکون منو + برچسب قابل‌شکست =====`,
`applyAppearanceSettings(); // اعمال فوری تنظیمات ظاهری ذخیره‌شده، همان لحظه بارگذاری اسکریپت

${FEATURE_JS}

// ===== کلاسیک‌سازی آیکون منو + برچسب قابل‌شکست =====`,
'feature JS');

// Wire into applyAppearanceSettings - find and extend
mustReplace(
`  applyAppBg();
}`,
`  applyAppBg();
  // حالت منو / شکل آیکون / پس‌زمینه‌های لایه‌ای
  document.body.classList.toggle('sb-icons-only', localStorage.getItem('laegh_sb_mode')==='icons');
  document.body.classList.remove('nav-shape-circle','nav-shape-square','nav-shape-rect','nav-shape-rounded');
  var shape = localStorage.getItem('laegh_nav_shape') || 'rounded';
  var shapeMap = {circle:'nav-shape-circle', square:'nav-shape-square', rect:'nav-shape-rect', rounded:'nav-shape-rounded'};
  document.body.classList.add(shapeMap[shape] || 'nav-shape-rounded');
  applyLayerBackgrounds();
}`,
'applyAppearanceSettings layers');

mustReplace(
`  setSel('depth3d-select', (localStorage.getItem('laegh_depth3d') || 'on'));
  renderSkinCards();
  renderColorThemeSwatches();
}`,
`  setSel('depth3d-select', (localStorage.getItem('laegh_depth3d') || 'on'));
  setSel('sb-mode-select', localStorage.getItem('laegh_sb_mode') || 'full');
  setSel('nav-shape-select', localStorage.getItem('laegh_nav_shape') || 'rounded');
  renderSkinCards();
  renderColorThemeSwatches();
}`,
'loadAppearanceUI selects');

mustReplace(
`enhanceSidebarNav();`,
`enhanceSidebarNav();
refreshNavTooltips();
renderDashShortcuts();
applyLayerBackgrounds();`,
'init tooltips + shortcuts');

// Version bump → 12.5.17 (۱۷ مرداد ۱۴۰۵)
html = html.split('11.5.17').join('12.5.17');
html = html.split('۱۱.۵.۱۷').join('۱۲.۵.۱۷');
html = html.replace(/نسخه ۱۱\.۵\.۱۷/g, 'نسخه ۱۲.۵.۱۷');

fs.writeFileSync(OUT, html);
fs.writeFileSync('/workspace/Laegh_Final.html', html);
console.log('Wrote', OUT, 'bytes', html.length);
