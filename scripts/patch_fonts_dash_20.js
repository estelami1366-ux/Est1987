#!/usr/bin/env node
/** v20.5.17 — more fonts, dash tint color, persist settings (safe storage + last page) */
const fs = require('fs');
const SRC = process.argv[2] || '/workspace/Laegh_Final_19.5.17.html';
const OUT = process.argv[3] || '/workspace/Laegh_Final_20.5.17.html';
let html = fs.readFileSync(SRC, 'utf8');

function mustReplace(a, b, label) {
  if (!html.includes(a)) {
    console.error('❌ missing:', label);
    console.error(String(a).slice(0, 260));
    process.exit(1);
  }
  html = html.replace(a, b);
  console.log('✅', label);
}

// ── Google fonts import + CSS classes ──
mustReplace(
`@import url('https://fonts.googleapis.com/css2?family=Vazirmatn:wght@300;400;500;700&display=swap');
:root{
  --blue:#0B4F6C;--blue2:#062F40;--blue-l:#E5F3F7;
  --green:#1F7A4C;--green-l:#E6F6EE;
  --amber:#C45C12;--amber-l:#FFF1E6;
  --red:#B42318;--red-l:#FDECEA;
  --purple:#5B4B8A;--purple-l:#F1EEF8;
  --border:#D2DEE6;--bg:#EAF1F5;--card:#FFFFFF;
  --text:#152833;--text2:#5B7180;
  --sidebar:268px;
  --font:'Vazirmatn','Tahoma',sans-serif;
  --skin-accent:#1AABB8;
  --skin-sidebar-end:#0A5F73;
  --shadow-card:0 1px 2px rgba(15,40,55,.04),0 8px 24px rgba(15,40,55,.06);
}
body.fv{--font:'Vazirmatn','Tahoma',sans-serif;}
body.fc{--font:'Calibri','Tahoma',sans-serif;}
body.ffa{--font:'Arial',sans-serif;}`,
`@import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&family=Noto+Naskh+Arabic:wght@400;600;700&family=Noto+Sans+Arabic:wght@300;400;500;700&family=Rubik:wght@400;500;700&family=Tajawal:wght@400;500;700&family=Vazirmatn:wght@300;400;500;700&display=swap');
:root{
  --blue:#0B4F6C;--blue2:#062F40;--blue-l:#E5F3F7;
  --green:#1F7A4C;--green-l:#E6F6EE;
  --amber:#C45C12;--amber-l:#FFF1E6;
  --red:#B42318;--red-l:#FDECEA;
  --purple:#5B4B8A;--purple-l:#F1EEF8;
  --border:#D2DEE6;--bg:#EAF1F5;--card:#FFFFFF;
  --text:#152833;--text2:#5B7180;
  --sidebar:268px;
  --font:'Vazirmatn','Tahoma',sans-serif;
  --skin-accent:#1AABB8;
  --skin-sidebar-end:#0A5F73;
  --shadow-card:0 1px 2px rgba(15,40,55,.04),0 8px 24px rgba(15,40,55,.06);
  --dash-tint:linear-gradient(165deg,#dceef7 0%,#e8f4f1 45%,#f3efe6 100%);
}
body.fv{--font:'Vazirmatn','Tahoma',sans-serif;}
body.fc{--font:'Calibri','Tahoma',sans-serif;}
body.ffa{--font:'Arial',sans-serif;}
body.f-noto{--font:'Noto Sans Arabic','Vazirmatn','Tahoma',sans-serif;}
body.f-naskh{--font:'Noto Naskh Arabic','Tahoma',serif;}
body.f-cairo{--font:'Cairo','Vazirmatn','Tahoma',sans-serif;}
body.f-tajawal{--font:'Tajawal','Vazirmatn','Tahoma',sans-serif;}
body.f-rubik{--font:'Rubik','Vazirmatn','Tahoma',sans-serif;}
body.f-tahoma{--font:'Tahoma','Segoe UI',sans-serif;}`,
'fonts CSS + dash-tint var');

// Distinct dashboard background (not flat/same as main)
mustReplace(
`#page-dashboard .dash-shell{
  min-height:calc(100vh - 0px);
  position:relative;
  overflow:hidden;
  border-radius:0;
}
#page-dashboard .dash-shell.has-dash-bg{
  background-image:var(--dash-bg-img);
}`,
`#page-dashboard .dash-shell{
  min-height:calc(100vh - 0px);
  position:relative;
  overflow:hidden;
  border-radius:0;
  background:var(--dash-tint);
  box-shadow:inset 0 0 0 1px rgba(11,79,108,.08);
}
#page-dashboard .dash-shell.has-dash-bg{
  background-image:var(--dash-bg-img);
  background-color:transparent;
}
body.theme-dark #page-dashboard .dash-shell:not(.has-dash-bg){
  background:var(--dash-tint, linear-gradient(165deg,#1a2833 0%,#1e2f3a 50%,#243028 100%));
  box-shadow:inset 0 0 0 1px rgba(255,255,255,.06);
}
#page-dashboard .dash-kpi{
  background:rgba(255,255,255,.82);
  backdrop-filter:blur(4px);
}
body.theme-dark #page-dashboard .dash-kpi{
  background:rgba(30,36,44,.88);
}`,
'dash shell tint CSS');

// Font select options
mustReplace(
`          <select id="app-font-select" onchange="setAppFont(this.value)">
            <option value="Tahoma">Tahoma (پیش‌فرض)</option>
            <option value="Vazir">Vazirmatn (مدرن)</option>
            <option value="Arial">Arial</option>
            <option value="Calibri">Calibri</option>
          </select>`,
`          <select id="app-font-select" onchange="setAppFont(this.value)">
            <option value="Vazir">Vazirmatn (مدرن)</option>
            <option value="Tahoma">Tahoma</option>
            <option value="Noto">Noto Sans Arabic</option>
            <option value="Naskh">Noto Naskh (نستعلیق‌وار)</option>
            <option value="Cairo">Cairo</option>
            <option value="Tajawal">Tajawal</option>
            <option value="Rubik">Rubik</option>
            <option value="Arial">Arial</option>
            <option value="Calibri">Calibri</option>
          </select>`,
'font select options');

// More text color swatches
mustReplace(
`          <button type="button" onclick="setTextColor('#0f172a')" title="مشکی" style="width:28px;height:28px;border-radius:50%;border:2px solid var(--border);background:#0f172a;cursor:pointer;padding:0"></button>
          <label style="display:inline-flex;align-items:center;gap:6px;font-size:11px;cursor:pointer;margin-right:4px">
            سفارشی
            <input type="color" id="text-color-inp" value="#152833" onchange="setTextColor(this.value)" style="width:36px;height:28px;padding:0;border:1px solid var(--border);border-radius:6px;background:transparent;cursor:pointer">
          </label>`,
`          <button type="button" onclick="setTextColor('#0f172a')" title="مشکی" style="width:28px;height:28px;border-radius:50%;border:2px solid var(--border);background:#0f172a;cursor:pointer;padding:0"></button>
          <button type="button" onclick="setTextColor('#be123c')" title="سرخ تیره" style="width:28px;height:28px;border-radius:50%;border:2px solid var(--border);background:#be123c;cursor:pointer;padding:0"></button>
          <button type="button" onclick="setTextColor('#c2410c')" title="نارنجی" style="width:28px;height:28px;border-radius:50%;border:2px solid var(--border);background:#c2410c;cursor:pointer;padding:0"></button>
          <button type="button" onclick="setTextColor('#0e7490')" title="فیروزه‌ای" style="width:28px;height:28px;border-radius:50%;border:2px solid var(--border);background:#0e7490;cursor:pointer;padding:0"></button>
          <button type="button" onclick="setTextColor('#4c1d95')" title="بنفش تیره" style="width:28px;height:28px;border-radius:50%;border:2px solid var(--border);background:#4c1d95;cursor:pointer;padding:0"></button>
          <button type="button" onclick="setTextColor('#334155')" title="خاکستری" style="width:28px;height:28px;border-radius:50%;border:2px solid var(--border);background:#334155;cursor:pointer;padding:0"></button>
          <label style="display:inline-flex;align-items:center;gap:6px;font-size:11px;cursor:pointer;margin-right:4px">
            سفارشی
            <input type="color" id="text-color-inp" value="#152833" onchange="setTextColor(this.value)" style="width:36px;height:28px;padding:0;border:1px solid var(--border);border-radius:6px;background:transparent;cursor:pointer">
          </label>`,
'more text color swatches');

// Dashboard color UI (in dash wallpaper bar)
mustReplace(
`    <div class="dash-wallpaper-bar">
      <button class="btn btn-sm" onclick="document.getElementById('dash-bg-inp').click()">🖼 پس‌زمینه داشبورد</button>
      <input type="file" id="dash-bg-inp" accept="image/*" style="display:none" onchange="setDashBgImage(this)">
      <button class="btn btn-sm btn-r" onclick="clearDashBgImage()">حذف عکس</button>
      <label style="font-size:11px;color:var(--text2);display:flex;align-items:center;gap:6px">روکش
        <input type="range" id="dash-bg-overlay" min="0" max="0.85" step="0.05" value="0.35" oninput="setDashBgOverlay(this.value)" style="width:90px">
      </label>
    </div>`,
`    <div class="dash-wallpaper-bar">
      <button class="btn btn-sm" onclick="document.getElementById('dash-bg-inp').click()">🖼 عکس پس‌زمینه</button>
      <input type="file" id="dash-bg-inp" accept="image/*" style="display:none" onchange="setDashBgImage(this)">
      <button class="btn btn-sm btn-r" onclick="clearDashBgImage()">حذف عکس</button>
      <span style="font-size:11px;color:var(--text2);margin-right:4px">رنگ داشبورد:</span>
      <button type="button" class="btn btn-sm" onclick="setDashTint('default')" title="پیش‌فرض متمایز">پیش‌فرض</button>
      <button type="button" onclick="setDashTint('#dceef7')" title="آبی روشن" style="width:22px;height:22px;border-radius:50%;border:2px solid var(--border);background:#dceef7;cursor:pointer;padding:0"></button>
      <button type="button" onclick="setDashTint('#dcfce7')" title="سبز روشن" style="width:22px;height:22px;border-radius:50%;border:2px solid var(--border);background:#dcfce7;cursor:pointer;padding:0"></button>
      <button type="button" onclick="setDashTint('#fef3c7')" title="کهربایی" style="width:22px;height:22px;border-radius:50%;border:2px solid var(--border);background:#fef3c7;cursor:pointer;padding:0"></button>
      <button type="button" onclick="setDashTint('#fce7f3')" title="صورتی" style="width:22px;height:22px;border-radius:50%;border:2px solid var(--border);background:#fce7f3;cursor:pointer;padding:0"></button>
      <button type="button" onclick="setDashTint('#e0e7ff')" title="نیلی" style="width:22px;height:22px;border-radius:50%;border:2px solid var(--border);background:#e0e7ff;cursor:pointer;padding:0"></button>
      <button type="button" onclick="setDashTint('#f1f5f9')" title="خاکستری" style="width:22px;height:22px;border-radius:50%;border:2px solid var(--border);background:#f1f5f9;cursor:pointer;padding:0"></button>
      <input type="color" id="dash-tint-inp" value="#dceef7" onchange="setDashTint(this.value)" title="رنگ سفارشی" style="width:28px;height:22px;padding:0;border:1px solid var(--border);border-radius:4px;background:transparent;cursor:pointer">
      <label style="font-size:11px;color:var(--text2);display:flex;align-items:center;gap:6px">روکش عکس
        <input type="range" id="dash-bg-overlay" min="0" max="0.85" step="0.05" value="0.35" oninput="setDashBgOverlay(this.value)" style="width:90px">
      </label>
    </div>`,
'dash tint UI');

// Also add dash tint note in appearance backgrounds card
mustReplace(
`      <p style="font-size:10px;color:var(--text2);margin-top:8px">پس‌زمینهٔ اختصاصی داشبورد را از خود صفحهٔ داشبورد هم می‌توانید عوض کنید.</p>
    </div>`,
`      <p style="font-size:10px;color:var(--text2);margin-top:8px">رنگ و عکس اختصاصی داشبورد را از خود صفحهٔ «داشبورد مرکزی» تنظیم کنید تا از بقیهٔ صفحات متمایز بماند. تنظیمات ظاهر (فونت، رنگ متن، اسکین، رنگ داشبورد) در مرورگر ذخیره می‌شوند و بعد از بستن هم می‌مانند.</p>
      <div class="f" style="margin-top:10px">
        <label>رنگ زمینه داشبورد (میانبر)</label>
        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:6px">
          <button type="button" class="btn btn-sm" onclick="setDashTint('default')">پیش‌فرض متمایز</button>
          <button type="button" onclick="setDashTint('#dceef7')" style="width:24px;height:24px;border-radius:50%;border:2px solid var(--border);background:#dceef7;cursor:pointer;padding:0"></button>
          <button type="button" onclick="setDashTint('#dcfce7')" style="width:24px;height:24px;border-radius:50%;border:2px solid var(--border);background:#dcfce7;cursor:pointer;padding:0"></button>
          <button type="button" onclick="setDashTint('#fef3c7')" style="width:24px;height:24px;border-radius:50%;border:2px solid var(--border);background:#fef3c7;cursor:pointer;padding:0"></button>
          <button type="button" onclick="setDashTint('#fce7f3')" style="width:24px;height:24px;border-radius:50%;border:2px solid var(--border);background:#fce7f3;cursor:pointer;padding:0"></button>
          <button type="button" onclick="setDashTint('#e0e7ff')" style="width:24px;height:24px;border-radius:50%;border:2px solid var(--border);background:#e0e7ff;cursor:pointer;padding:0"></button>
        </div>
      </div>
    </div>`,
'appearance dash tint shortcut');

// Help text
mustReplace(
`    بعد از انتخاب اسکین، همچنان می‌توانید <b>تم رنگی</b>، <b>فونت</b>، <b>رنگ فونت</b> (مثلاً قرمز)، <b>تراکم</b>، <b>گردی گوشه</b> و <b>تصویر پس‌زمینه</b> را جداگانه تنظیم کنید. این تنظیمات در بک‌آپ هم ذخیره می‌شوند.`,
`    بعد از انتخاب اسکین، همچنان می‌توانید <b>تم رنگی</b>، <b>فونت</b> (چند خانواده مثل وزیر / نوتو / قاهره)، <b>رنگ فونت</b>، <b>رنگ زمینه داشبورد</b>، <b>تراکم</b>، <b>گردی گوشه</b> و <b>تصویر پس‌زمینه</b> را جداگانه تنظیم کنید. این‌ها در مرورگر می‌مانند و در بک‌آپ هم ذخیره می‌شوند. عکس‌های بزرگ قبل از ذخیره کوچک می‌شوند تا تنظیمات پاک نشوند.`,
'help fonts/dash');

// Backup appearance fields
mustReplace(
`      appFont: localStorage.getItem('laegh_app_font')||'',
      textSize: localStorage.getItem('laegh_text_size')||'',
      textColor: localStorage.getItem('laegh_text_color')||'',`,
`      appFont: localStorage.getItem('laegh_app_font')||'',
      textSize: localStorage.getItem('laegh_text_size')||'',
      textColor: localStorage.getItem('laegh_text_color')||'',
      dashTint: localStorage.getItem('laegh_dash_tint')||'',
      lastPage: localStorage.getItem('laegh_last_page')||'',`,
'backup dashTint lastPage');

mustReplace(
`        if(ap.textColor) localStorage.setItem('laegh_text_color', ap.textColor);
        else if(ap.textColor==='') localStorage.removeItem('laegh_text_color');
        if(ap.density) localStorage.setItem('laegh_density', ap.density);`,
`        if(ap.textColor) localStorage.setItem('laegh_text_color', ap.textColor);
        else if(ap.textColor==='') localStorage.removeItem('laegh_text_color');
        if(ap.dashTint) localStorage.setItem('laegh_dash_tint', ap.dashTint);
        else if(ap.dashTint==='') localStorage.removeItem('laegh_dash_tint');
        if(ap.lastPage) localStorage.setItem('laegh_last_page', ap.lastPage);
        if(ap.density) localStorage.setItem('laegh_density', ap.density);`,
'restore dashTint lastPage');

mustReplace(
`  const protectedKeys = ['laegh_adminpw','laegh_theme','laegh_skin','laegh_depth3d','laegh_color_theme','laegh_sb_mode','laegh_nav_shape','laegh_text_color','laegh_logo','laegh_sender','laegh_autosave_enabled','laegh_autosave_interval'];`,
`  const protectedKeys = ['laegh_adminpw','laegh_theme','laegh_skin','laegh_depth3d','laegh_color_theme','laegh_sb_mode','laegh_nav_shape','laegh_text_color','laegh_app_font','laegh_text_size','laegh_dash_tint','laegh_dash_bg','laegh_dash_bg_overlay','laegh_last_page','laegh_logo','laegh_sender','laegh_autosave_enabled','laegh_autosave_interval'];`,
'protect appearance keys');

// setAppFont expanded
mustReplace(
`function setAppFont(val){
  document.body.classList.remove('fv','fc','ffa');
  if(val==='Vazir') document.body.classList.add('fv');
  else if(val==='Arial') document.body.classList.add('ffa');
  else if(val==='Calibri') document.body.classList.add('fc');
  localStorage.setItem('laegh_app_font', val);
  ntf('فونت نرم‌افزار تغییر کرد');
}`,
`function setAppFont(val){
  document.body.classList.remove('fv','fc','ffa','f-noto','f-naskh','f-cairo','f-tajawal','f-rubik','f-tahoma');
  var map = {Vazir:'fv', Arial:'ffa', Calibri:'fc', Noto:'f-noto', Naskh:'f-naskh', Cairo:'f-cairo', Tajawal:'f-tajawal', Rubik:'f-rubik', Tahoma:'f-tahoma'};
  if(map[val]) document.body.classList.add(map[val]);
  try{ localStorage.setItem('laegh_app_font', val || 'Vazir'); }catch(e){ if(typeof ntf==='function') ntf('ذخیره فونت ناموفق بود (حافظه مرورگر پر است)','err'); }
  if(typeof ntf==='function') ntf('فونت نرم‌افزار تغییر کرد');
}`,
'setAppFont expanded');

// setFont on invoice should persist too
mustReplace(
`function setFont(cls,btn){
  document.body.classList.remove('fv','fc','ffa');
  if(cls) document.body.classList.add(cls);
  document.querySelectorAll('.btn[onclick^="setFont"]').forEach(b=>b.classList.remove('btn-p'));
  btn.classList.add('btn-p');
}`,
`function setFont(cls,btn){
  var rev = {'':'Tahoma','fv':'Vazir','fc':'Calibri','ffa':'Arial'};
  if(typeof setAppFont==='function') setAppFont(rev[cls] || 'Vazir');
  else {
    document.body.classList.remove('fv','fc','ffa','f-noto','f-naskh','f-cairo','f-tajawal','f-rubik','f-tahoma');
    if(cls) document.body.classList.add(cls);
  }
  document.querySelectorAll('.btn[onclick^="setFont"]').forEach(b=>b.classList.remove('btn-p'));
  if(btn) btn.classList.add('btn-p');
}`,
'setFont persists');

// showPage saves last page
mustReplace(
`function showPage(id, el){
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.nav-it').forEach(n=>n.classList.remove('active'));
  document.getElementById('page-'+id).classList.add('active');
  if(el) el.classList.add('active');`,
`function showPage(id, el){
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
  try{ localStorage.setItem('laegh_last_page', id); }catch(_e){}`,
'showPage persist last page');

// applyAppearanceSettings font classes
mustReplace(
`  document.body.classList.remove('fv','fc','ffa');
  const fontVal = localStorage.getItem('laegh_app_font') || ((SKIN_PRESETS[localStorage.getItem('laegh_skin')||'parsian']||{}).preferFont || '');
  if(fontVal==='Vazir') document.body.classList.add('fv');
  else if(fontVal==='Arial') document.body.classList.add('ffa');
  else if(fontVal==='Calibri') document.body.classList.add('fc');`,
`  document.body.classList.remove('fv','fc','ffa','f-noto','f-naskh','f-cairo','f-tajawal','f-rubik','f-tahoma');
  const fontVal = localStorage.getItem('laegh_app_font') || ((SKIN_PRESETS[localStorage.getItem('laegh_skin')||'parsian']||{}).preferFont || 'Vazir');
  var fontMap = {Vazir:'fv', Arial:'ffa', Calibri:'fc', Noto:'f-noto', Naskh:'f-naskh', Cairo:'f-cairo', Tajawal:'f-tajawal', Rubik:'f-rubik', Tahoma:'f-tahoma'};
  if(fontMap[fontVal]) document.body.classList.add(fontMap[fontVal]);`,
'applyAppearanceSettings fonts');

// After applyLayerBackgrounds in applyAppearanceSettings, also apply dash tint
mustReplace(
`  applyLayerBackgrounds();
}

function loadAppearanceUI(){`,
`  applyLayerBackgrounds();
  if(typeof applyDashTint==='function') applyDashTint();
}

function loadAppearanceUI(){`,
'applyAppearanceSettings dash tint');

// Image resize + dash tint + safe storage — replace _setCoverBg / applyLayerBackgrounds block start
mustReplace(
`function _setCoverBg(targetSel, cssVar, storageKey, fileInput){
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
}`,
`function _safeSetItem(key, val){
  try{
    localStorage.setItem(key, val);
    return true;
  }catch(e){
    try{
      // اگر پر بود، عکس‌های پس‌زمینه را نگه می‌داریم ولی هشدار می‌دهیم
      if(typeof ntf==='function') ntf('حافظه مرورگر پر است — عکس را کوچک‌تر کنید یا عکس‌های قبلی را حذف کنید','err');
    }catch(_e){}
    return false;
  }
}
function _compressImageDataUrl(dataUrl, maxW, quality, cb){
  try{
    var img = new Image();
    img.onload = function(){
      try{
        var w = img.width || 1, h = img.height || 1;
        var scale = Math.min(1, (maxW||1400) / Math.max(w, h));
        var cw = Math.max(1, Math.round(w * scale));
        var ch = Math.max(1, Math.round(h * scale));
        var c = document.createElement('canvas');
        c.width = cw; c.height = ch;
        var ctx = c.getContext('2d');
        ctx.drawImage(img, 0, 0, cw, ch);
        var out = c.toDataURL('image/jpeg', quality || 0.72);
        // اگر هنوز خیلی بزرگ بود یک دور دیگر فشرده کن
        if(out.length > 900000){
          scale = Math.min(1, 900 / Math.max(cw, ch));
          c.width = Math.max(1, Math.round(cw * scale));
          c.height = Math.max(1, Math.round(ch * scale));
          ctx = c.getContext('2d');
          ctx.drawImage(img, 0, 0, c.width, c.height);
          out = c.toDataURL('image/jpeg', 0.6);
        }
        cb(out);
      }catch(e){ cb(dataUrl); }
    };
    img.onerror = function(){ cb(dataUrl); };
    img.src = dataUrl;
  }catch(e){ cb(dataUrl); }
}
function _setCoverBg(targetSel, cssVar, storageKey, fileInput){
  var f = fileInput && fileInput.files && fileInput.files[0]; if(!f) return;
  var r = new FileReader();
  r.onload = function(e){
    _compressImageDataUrl(e.target.result, 1400, 0.72, function(out){
      if(_safeSetItem(storageKey, out)){
        applyLayerBackgrounds();
        ntf('پس‌زمینه تنظیم شد ✅ (برای ماندگاری فشرده شد)');
      }
      try{ fileInput.value = ''; }catch(_e){}
    });
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
  _safeSetItem('laegh_dash_bg_overlay', val);
  document.documentElement.style.setProperty('--dash-bg-overlay', val);
}
var DASH_TINT_DEFAULT = 'linear-gradient(165deg,#dceef7 0%,#e8f4f1 45%,#f3efe6 100%)';
var DASH_TINT_DEFAULT_DARK = 'linear-gradient(165deg,#1a2833 0%,#1e2f3a 50%,#243028 100%)';
function setDashTint(val){
  if(!val || val==='default'){
    localStorage.removeItem('laegh_dash_tint');
    applyDashTint();
    ntf('رنگ داشبورد به پیش‌فرض متمایز برگشت');
    return;
  }
  if(!/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(val)){
    ntf('رنگ نامعتبر است');
    return;
  }
  _safeSetItem('laegh_dash_tint', val);
  applyDashTint();
  var inp = document.getElementById('dash-tint-inp'); if(inp) inp.value = val;
  ntf('رنگ داشبورد تغییر کرد');
}
function applyDashTint(){
  var c = localStorage.getItem('laegh_dash_tint') || '';
  var dark = document.body.classList.contains('theme-dark');
  var tint;
  if(c){
    tint = 'linear-gradient(165deg,'+c+' 0%,'+c+'dd 55%,#ffffff 100%)';
    if(dark) tint = 'linear-gradient(165deg,'+c+' 0%,#1a222c 100%)';
  } else {
    tint = dark ? DASH_TINT_DEFAULT_DARK : DASH_TINT_DEFAULT;
  }
  document.documentElement.style.setProperty('--dash-tint', tint);
  var inp = document.getElementById('dash-tint-inp');
  if(inp) inp.value = c || '#dceef7';
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
  if(typeof applyDashTint==='function') applyDashTint();
}`,
'safe bg + dash tint functions');

// Boot: restore last page after applyAppearanceSettings
mustReplace(
`applyAppearanceSettings(); // اعمال فوری تنظیمات ظاهری ذخیره‌شده، همان لحظه بارگذاری اسکریپت


// ===== منوی فقط‌آیکون / شکل / پس‌زمینه‌های مجزا / شورتکات داشبورد =====`,
`applyAppearanceSettings(); // اعمال فوری تنظیمات ظاهری ذخیره‌شده، همان لحظه بارگذاری اسکریپت
(function restoreLastPageAndAppearance(){
  try{
    if(typeof applyDashTint==='function') applyDashTint();
    if(typeof applyLayerBackgrounds==='function') applyLayerBackgrounds();
    if(typeof applyTextColor==='function') applyTextColor();
    var last = localStorage.getItem('laegh_last_page') || '';
    if(last && document.getElementById('page-'+last) && typeof showPage==='function'){
      // تأخیر کوتاه تا بقیهٔ initها تمام شوند
      setTimeout(function(){ try{ showPage(last); }catch(_e){} }, 30);
    }
  }catch(_e){}
})();


// ===== منوی فقط‌آیکون / شکل / پس‌زمینه‌های مجزا / شورتکات داشبورد =====`,
'boot restore appearance + last page');

// Version bump
html = html.split('19.5.17').join('20.5.17');
html = html.split('۱۹.۵.۱۷').join('۲۰.۵.۱۷');

fs.writeFileSync(OUT, html);
fs.writeFileSync('/workspace/Laegh_Final.html', html);
console.log('Wrote', OUT, 'bytes', html.length);
