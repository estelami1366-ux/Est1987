#!/usr/bin/env node
/** Add 3D depth look to Laegh (same-day 11.5.17 iteration) */
const fs = require('fs');
const SRC = process.argv[2] || '/workspace/Laegh_Final.html';
const OUT = process.argv[3] || '/workspace/Laegh_Final_11.5.17.html';
let html = fs.readFileSync(SRC, 'utf8');

function mustReplace(a, b, label) {
  if (!html.includes(a)) {
    console.error('❌ missing:', label);
    console.error(a.slice(0, 160));
    process.exit(1);
  }
  html = html.replace(a, b);
  console.log('✅', label);
}

const DEPTH_CSS = `
/* ══════ عمق سه‌بعدی / 3D Depth ══════ */
body.depth-3d{
  --shadow-card:0 2px 4px rgba(10,30,45,.05),0 10px 28px rgba(10,30,45,.10),0 28px 48px rgba(10,30,45,.06);
  --shadow-card-hover:0 4px 8px rgba(10,30,45,.07),0 18px 40px rgba(10,30,45,.14),0 36px 64px rgba(10,30,45,.08);
  --shadow-btn:0 2px 0 color-mix(in srgb,var(--blue2) 55%,#000),0 6px 16px color-mix(in srgb,var(--blue) 35%,transparent);
  perspective:1400px;
}
body.depth-3d .main{
  transform-style:preserve-3d;
}
body.depth-3d .card{
  position:relative;
  border:1px solid color-mix(in srgb,var(--border) 70%,#fff);
  box-shadow:var(--shadow-card);
  transform:translateZ(0);
  transition:transform .22s ease, box-shadow .22s ease;
  background:
    linear-gradient(165deg, color-mix(in srgb,var(--card) 92%,#fff) 0%, var(--card) 45%, color-mix(in srgb,var(--card) 94%,var(--blue-l)) 100%);
}
body.depth-3d .card::before{
  content:'';position:absolute;inset:0;border-radius:inherit;pointer-events:none;
  background:linear-gradient(145deg,rgba(255,255,255,.55) 0%,rgba(255,255,255,0) 42%);
  opacity:.7;
}
body.depth-3d .card:hover{
  transform:translateY(-3px) rotateX(1.2deg);
  box-shadow:var(--shadow-card-hover);
}
body.depth-3d .topbar{
  box-shadow:0 8px 28px rgba(10,30,45,.10);
  border-bottom-color:transparent;
  background:color-mix(in srgb,var(--card) 78%,transparent);
}
body.depth-3d .sb{
  box-shadow:-14px 0 40px rgba(0,0,0,.28), inset 3px 0 0 color-mix(in srgb,var(--skin-accent,#1AABB8) 55%,transparent);
  transform:translateZ(40px);
}
body.depth-3d .sb-logo{
  box-shadow:inset 0 1px 0 rgba(255,255,255,.18), 0 8px 20px rgba(0,0,0,.18);
  border-radius:0 0 14px 14px;
  margin:0 8px;
}
body.depth-3d .nav-it{
  margin:2px 8px;
  border-radius:10px;
  border-right:none;
  box-shadow:none;
  transition:transform .15s ease, background .15s ease, box-shadow .15s ease;
}
body.depth-3d .nav-it:hover{
  transform:translateX(-3px);
  background:rgba(255,255,255,.12);
  box-shadow:0 6px 14px rgba(0,0,0,.18);
}
body.depth-3d .nav-it.active{
  background:linear-gradient(90deg, color-mix(in srgb,var(--skin-accent,#1AABB8) 35%,transparent), rgba(255,255,255,.16));
  box-shadow:inset 0 1px 0 rgba(255,255,255,.2), 0 8px 18px rgba(0,0,0,.22);
  border-right:none;
}
body.depth-3d .btn{
  box-shadow:0 1px 0 rgba(255,255,255,.7) inset, 0 2px 0 rgba(0,0,0,.06), 0 6px 14px rgba(10,30,45,.08);
  transform:translateY(0);
}
body.depth-3d .btn:hover{
  transform:translateY(-2px);
  box-shadow:0 1px 0 rgba(255,255,255,.8) inset, 0 4px 0 rgba(0,0,0,.05), 0 12px 22px rgba(10,30,45,.14);
}
body.depth-3d .btn:active{
  transform:translateY(1px);
  box-shadow:0 1px 0 rgba(0,0,0,.12) inset, 0 2px 6px rgba(10,30,45,.12);
}
body.depth-3d .btn-p{
  box-shadow:0 1px 0 rgba(255,255,255,.25) inset, var(--shadow-btn);
}
body.depth-3d .btn-p:hover{
  box-shadow:0 1px 0 rgba(255,255,255,.3) inset, 0 3px 0 color-mix(in srgb,var(--blue2) 65%,#000), 0 12px 24px color-mix(in srgb,var(--blue) 40%,transparent);
}
body.depth-3d .f input,body.depth-3d .f select,body.depth-3d .f textarea{
  box-shadow:inset 0 2px 5px rgba(10,30,45,.06), 0 1px 0 rgba(255,255,255,.8);
  background:linear-gradient(180deg,#fff 0%, color-mix(in srgb,var(--bg) 35%,#fff) 100%);
}
body.depth-3d .f input:focus,body.depth-3d .f select:focus,body.depth-3d .f textarea:focus{
  box-shadow:inset 0 1px 2px rgba(10,30,45,.04), 0 0 0 3px color-mix(in srgb,var(--blue) 22%,transparent);
}
body.depth-3d .modal{
  box-shadow:0 24px 64px rgba(10,30,45,.28), 0 2px 0 rgba(255,255,255,.5) inset;
  transform:translateZ(60px);
  background:linear-gradient(165deg,#fff 0%, color-mix(in srgb,var(--card) 90%,var(--blue-l)) 100%);
}
body.depth-3d .dev-card,body.depth-3d .prod-card,body.depth-3d .pb-card,body.depth-3d .stat-card,body.depth-3d .acc-card,body.depth-3d .dash-kpi{
  box-shadow:0 2px 4px rgba(10,30,45,.05), 0 10px 22px rgba(10,30,45,.08);
  transform:translateZ(0);
  transition:transform .18s ease, box-shadow .18s ease;
}
body.depth-3d .dev-card:hover,body.depth-3d .prod-card:hover,body.depth-3d .pb-card:hover{
  transform:translateY(-2px) scale(1.01);
  box-shadow:0 8px 24px rgba(10,30,45,.14);
}
body.depth-3d .skin-card{
  box-shadow:0 4px 14px rgba(10,30,45,.08);
  transform-style:preserve-3d;
}
body.depth-3d .skin-card:hover{
  transform:translateY(-4px) rotateX(4deg);
}
body.depth-3d .skin-preview{
  box-shadow:inset 0 -8px 16px rgba(0,0,0,.18), 0 4px 10px rgba(0,0,0,.12);
}
body.depth-3d.theme-dark .card{
  background:linear-gradient(165deg, color-mix(in srgb,var(--card) 90%,#fff) 0%, var(--card) 100%);
  box-shadow:0 2px 4px rgba(0,0,0,.25), 0 14px 32px rgba(0,0,0,.35);
}
body.depth-3d.theme-dark .f input,body.depth-3d.theme-dark .f select,body.depth-3d.theme-dark .f textarea{
  background:linear-gradient(180deg,#2a323c 0%,#232a33 100%);
  box-shadow:inset 0 2px 5px rgba(0,0,0,.35);
}
`;

mustReplace(
`body.has-skin-atmosphere .sb-logo{background:rgba(255,255,255,.06);}

/* Tooltip فارسی */`,
`body.has-skin-atmosphere .sb-logo{background:rgba(255,255,255,.06);}
${DEPTH_CSS}
/* Tooltip فارسی */`,
'3D depth CSS');

mustReplace(
`      <div id="skin-preset-cards" style="display:flex;gap:10px;flex-wrap:wrap"></div>
    </div>

    <div class="card">
      <div class="card-title">🌗 حالت نمایش</div>`,
`      <div id="skin-preset-cards" style="display:flex;gap:10px;flex-wrap:wrap"></div>
      <div class="f" style="margin-top:14px">
        <label>عمق سه‌بعدی رابط</label>
        <select id="depth3d-select" onchange="setDepth3D(this.value)">
          <option value="on">فعال — کارت‌ها و دکمه‌ها حجمی</option>
          <option value="off">خاموش — تخت و ساده</option>
        </select>
      </div>
      <p style="font-size:10px;color:var(--text2);margin-top:6px;line-height:1.6">سایهٔ لایه‌ای، برجستگی دکمه، و حرکت ملایم کارت‌ها. روی مانیتور معمولی بهترین نتیجه را می‌دهد.</p>
    </div>

    <div class="card">
      <div class="card-title">🌗 حالت نمایش</div>`,
'3D toggle UI');

mustReplace(
`    <li><b>کلاسیک:</b> ظاهر قبلی آبی ساده، اگر به آن عادت دارید.</li>
  </ul>
  <p style="font-size:13px;line-height:2;color:var(--text2);margin-top:8px">
    بعد از انتخاب اسکین، همچنان می‌توانید <b>تم رنگی</b>، <b>فونت</b>، <b>تراکم</b>، <b>گردی گوشه</b> و <b>تصویر پس‌زمینه</b> را جداگانه تنظیم کنید. این تنظیمات در بک‌آپ هم ذخیره می‌شوند.
  </p>
</div>`,
`    <li><b>کلاسیک:</b> ظاهر قبلی آبی ساده، اگر به آن عادت دارید.</li>
    <li><b>عمق سه‌بعدی:</b> از همان بخش ظاهر می‌توانید حالت حجمی را روشن/خاموش کنید — کارت‌ها شناور، دکمه‌ها برجسته، و سایدبار با سایهٔ عمیق دیده می‌شود.</li>
  </ul>
  <p style="font-size:13px;line-height:2;color:var(--text2);margin-top:8px">
    بعد از انتخاب اسکین، همچنان می‌توانید <b>تم رنگی</b>، <b>فونت</b>، <b>تراکم</b>، <b>گردی گوشه</b> و <b>تصویر پس‌زمینه</b> را جداگانه تنظیم کنید. این تنظیمات در بک‌آپ هم ذخیره می‌شوند.
  </p>
</div>`,
'help 3D bullet');

mustReplace(
`      skin: localStorage.getItem('laegh_skin')||'',
      colorTheme: localStorage.getItem('laegh_color_theme')||'',`,
`      skin: localStorage.getItem('laegh_skin')||'',
      depth3d: localStorage.getItem('laegh_depth3d')||'',
      colorTheme: localStorage.getItem('laegh_color_theme')||'',`,
'backup depth3d');

mustReplace(
`        if(ap.skin) localStorage.setItem('laegh_skin', ap.skin);
        if(ap.colorTheme) localStorage.setItem('laegh_color_theme', ap.colorTheme);`,
`        if(ap.skin) localStorage.setItem('laegh_skin', ap.skin);
        if(ap.depth3d) localStorage.setItem('laegh_depth3d', ap.depth3d);
        if(ap.colorTheme) localStorage.setItem('laegh_color_theme', ap.colorTheme);`,
'restore depth3d');

mustReplace(
`  const protectedKeys = ['laegh_adminpw','laegh_theme','laegh_skin','laegh_color_theme','laegh_logo','laegh_sender','laegh_autosave_enabled','laegh_autosave_interval'];`,
`  const protectedKeys = ['laegh_adminpw','laegh_theme','laegh_skin','laegh_depth3d','laegh_color_theme','laegh_logo','laegh_sender','laegh_autosave_enabled','laegh_autosave_interval'];`,
'protect depth3d key');

mustReplace(
`function setSkin(key){
  if(!SKIN_PRESETS[key]) key = 'parsian';
  applySkinVars(key);
  localStorage.setItem('laegh_skin', key);
  // اسکین پالت کامل می‌آورد؛ تم رنگی دستی را ریست می‌کنیم تا تضاد ایجاد نشود
  localStorage.removeItem('laegh_color_theme');
  if(!localStorage.getItem('laegh_app_font') && SKIN_PRESETS[key].preferFont){
    setAppFont(SKIN_PRESETS[key].preferFont);
  }
  renderSkinCards();
  renderColorThemeSwatches();
  ntf('اسکین «'+(SKIN_PRESETS[key].label)+'» اعمال شد');
}`,
`function setSkin(key){
  if(!SKIN_PRESETS[key]) key = 'parsian';
  applySkinVars(key);
  localStorage.setItem('laegh_skin', key);
  // اسکین پالت کامل می‌آورد؛ تم رنگی دستی را ریست می‌کنیم تا تضاد ایجاد نشود
  localStorage.removeItem('laegh_color_theme');
  if(!localStorage.getItem('laegh_app_font') && SKIN_PRESETS[key].preferFont){
    setAppFont(SKIN_PRESETS[key].preferFont);
  }
  renderSkinCards();
  renderColorThemeSwatches();
  ntf('اسکین «'+(SKIN_PRESETS[key].label)+'» اعمال شد');
}
function setDepth3D(val){
  const on = val !== 'off';
  document.body.classList.toggle('depth-3d', on);
  localStorage.setItem('laegh_depth3d', on ? 'on' : 'off');
  ntf(on ? 'عمق سه‌بعدی فعال شد' : 'عمق سه‌بعدی خاموش شد');
}
function applyDepth3D(){
  const v = localStorage.getItem('laegh_depth3d');
  const on = v !== 'off'; // پیش‌فرض: روشن
  document.body.classList.toggle('depth-3d', on);
}`,
'setDepth3D helpers');

mustReplace(
`function applyAppearanceSettings(){
  const skinKey = localStorage.getItem('laegh_skin') || 'parsian';
  applySkinVars(skinKey);
  const colorKey = localStorage.getItem('laegh_color_theme');
  if(colorKey) applyColorThemeVars(colorKey);
  document.body.classList.toggle('theme-dark', localStorage.getItem('laegh_theme')==='dark');`,
`function applyAppearanceSettings(){
  const skinKey = localStorage.getItem('laegh_skin') || 'parsian';
  applySkinVars(skinKey);
  applyDepth3D();
  const colorKey = localStorage.getItem('laegh_color_theme');
  if(colorKey) applyColorThemeVars(colorKey);
  document.body.classList.toggle('theme-dark', localStorage.getItem('laegh_theme')==='dark');`,
'applyAppearanceSettings calls depth');

mustReplace(
`  if(ovEl) ovEl.value = localStorage.getItem('laegh_app_bg_overlay') || '0.55';
  renderSkinCards();
  renderColorThemeSwatches();
}`,
`  if(ovEl) ovEl.value = localStorage.getItem('laegh_app_bg_overlay') || '0.55';
  setSel('depth3d-select', (localStorage.getItem('laegh_depth3d') || 'on'));
  renderSkinCards();
  renderColorThemeSwatches();
}`,
'loadAppearanceUI depth select');

fs.writeFileSync(OUT, html);
fs.writeFileSync('/workspace/Laegh_Final.html', html);
console.log('Wrote', OUT, 'bytes', html.length);
