#!/usr/bin/env node
/**
 * Patch Laegh_Final.html → skin pack + version 11.5.17
 */
const fs = require('fs');
const path = require('path');

const SRC = process.argv[2] || '/tmp/laegh_work.html';
const OUT = process.argv[3] || '/workspace/Laegh_Final_11.5.17.html';

let html = fs.readFileSync(SRC, 'utf8');
const before = html.length;

function mustReplace(oldStr, newStr, label) {
  if (!html.includes(oldStr)) {
    console.error('❌ missing anchor for:', label);
    console.error(oldStr.slice(0, 120));
    process.exit(1);
  }
  html = html.replace(oldStr, newStr);
  console.log('✅', label);
}

function replaceAllLiteral(from, to, label) {
  const n = html.split(from).length - 1;
  if (n === 0) {
    console.error('❌ no occurrences:', label, from);
    process.exit(1);
  }
  html = html.split(from).join(to);
  console.log('✅', label, `(${n}×)`);
}

// ── Version bump (real Jalali today: 1405/05/17; Major↑ for strong skin) ──
replaceAllLiteral('10.5.20', '11.5.17', 'version numeric');
replaceAllLiteral('1405/05/20', '1405/05/17', 'app-date');
replaceAllLiteral('۱۰.۵.۲۰', '۱۱.۵.۱۷', 'version fa digits');

// ── Stronger default tokens (first paint before JS) ──
mustReplace(
`:root{
  --blue:#185FA5;--blue2:#0C447C;--blue-l:#E6F1FB;
  --green:#2E7D32;--green-l:#E8F5E9;
  --amber:#E65100;--amber-l:#FFF3E0;
  --red:#C62828;--red-l:#FFEBEE;
  --purple:#6A1B9A;--purple-l:#F3E5F5;
  --border:#E0E0E0;--bg:#F5F5F5;--card:#FFFFFF;
  --text:#212121;--text2:#757575;
  --sidebar:220px;
  --font:'Tahoma',sans-serif;
}`,
`:root{
  --blue:#0B4F6C;--blue2:#062F40;--blue-l:#E5F3F7;
  --green:#1F7A4C;--green-l:#E6F6EE;
  --amber:#C45C12;--amber-l:#FFF1E6;
  --red:#B42318;--red-l:#FDECEA;
  --purple:#5B4B8A;--purple-l:#F1EEF8;
  --border:#D2DEE6;--bg:#EAF1F5;--card:#FFFFFF;
  --text:#152833;--text2:#5B7180;
  --sidebar:220px;
  --font:'Vazirmatn','Tahoma',sans-serif;
  --skin-accent:#1AABB8;
  --skin-sidebar-end:#0A5F73;
  --shadow-card:0 1px 2px rgba(15,40,55,.04),0 8px 24px rgba(15,40,55,.06);
}`,
'default :root tokens');

// Default body font + soft atmosphere base
mustReplace(
`body{font-family:var(--font);background:var(--bg);color:var(--text);font-size:13px;}
/* SIDEBAR */
.sb{position:fixed;right:0;top:0;width:var(--sidebar);height:100vh;background:var(--blue2);color:#fff;display:flex;flex-direction:column;z-index:100;overflow-y:auto;}`,
`body{font-family:var(--font);background:var(--bg);color:var(--text);font-size:13px;}
/* SIDEBAR */
.sb{position:fixed;right:0;top:0;width:var(--sidebar);height:100vh;background:linear-gradient(185deg,var(--blue2) 0%,var(--skin-sidebar-end,#0A5F73) 100%);color:#fff;display:flex;flex-direction:column;z-index:100;overflow-y:auto;box-shadow:-6px 0 24px rgba(6,47,64,.18);}`,
'sidebar gradient base');

mustReplace(
`body.fv{--font:'Vazirmatn',sans-serif;}`,
`body.fv{--font:'Vazirmatn','Tahoma',sans-serif;}`,
'fv font stack');

// Card / topbar polish
mustReplace(
`.card{background:var(--card);border:1px solid var(--border);border-radius:10px;padding:16px 18px;margin-bottom:14px;box-shadow:0 1px 3px rgba(0,0,0,.04);}`,
`.card{background:var(--card);border:1px solid var(--border);border-radius:12px;padding:16px 18px;margin-bottom:14px;box-shadow:var(--shadow-card,0 1px 3px rgba(0,0,0,.04));}`,
'card elevation');

mustReplace(
`.topbar{background:var(--card);border-bottom:1px solid var(--border);padding:10px 20px;display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;position:sticky;top:0;z-index:50;}`,
`.topbar{background:color-mix(in srgb,var(--card) 88%,transparent);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);border-bottom:1px solid var(--border);padding:10px 20px;display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;position:sticky;top:0;z-index:50;}`,
'topbar glass');

// Skin pack CSS
const SKIN_CSS = `
/* ══════ اسکین قوی / Skin Pack (v11.5.17) ══════ */
.skin-card{width:148px;border:2px solid var(--border);border-radius:12px;padding:10px;cursor:pointer;background:var(--card);transition:.18s;text-align:right;}
.skin-card:hover{transform:translateY(-2px);box-shadow:0 8px 20px rgba(15,40,55,.10);}
.skin-card.selected{border-color:var(--blue);box-shadow:0 0 0 3px color-mix(in srgb,var(--blue) 25%,transparent);}
.skin-card .skin-preview{height:42px;border-radius:8px;margin-bottom:8px;position:relative;overflow:hidden;border:1px solid rgba(0,0,0,.06);}
.skin-card .skin-preview::after{content:'';position:absolute;inset:8px 8px 8px 40%;background:rgba(255,255,255,.88);border-radius:6px;}
.skin-card .skin-name{font-size:12px;font-weight:700;color:var(--text);}
.skin-card .skin-desc{font-size:10px;color:var(--text2);line-height:1.5;margin-top:2px;}
body.has-skin-atmosphere{
  background-image:
    radial-gradient(1100px 520px at 8% -8%, color-mix(in srgb,var(--skin-accent,#1AABB8) 18%,transparent), transparent 58%),
    radial-gradient(900px 480px at 100% 0%, color-mix(in srgb,var(--blue) 14%,transparent), transparent 52%),
    linear-gradient(180deg, color-mix(in srgb,var(--bg) 92%,#fff) 0%, var(--bg) 100%);
  background-attachment:fixed;
}
body.skin-parsian{--skin-accent:#1AABB8;--skin-sidebar-end:#0A5F73;}
body.skin-ocean{--skin-accent:#14B8A6;--skin-sidebar-end:#0F766E;}
body.skin-graphite{--skin-accent:#64748B;--skin-sidebar-end:#1E293B;}
body.skin-ember{--skin-accent:#EA580C;--skin-sidebar-end:#7C2D12;}
body.skin-classic{--skin-accent:#185FA5;--skin-sidebar-end:#0C447C;}
body.has-skin-atmosphere .sb-brand{color:rgba(255,255,255,.78);}
body.has-skin-atmosphere .nav-it.active{background:rgba(255,255,255,.18);border-right-color:var(--skin-accent,#fff);}
body.has-skin-atmosphere .btn-p{box-shadow:0 4px 14px color-mix(in srgb,var(--blue) 35%,transparent);}
body.has-skin-atmosphere .sb-logo{background:rgba(255,255,255,.06);}
`;

mustReplace(
`body.has-bg-image.theme-dark::after{background:rgba(10,12,15,var(--bg-overlay,0.55));}
/* Tooltip فارسی */`,
`body.has-bg-image.theme-dark::after{background:rgba(10,12,15,var(--bg-overlay,0.55));}
${SKIN_CSS}
/* Tooltip فارسی */`,
'skin CSS block');

// Appearance UI — skin picker card before light/dark
mustReplace(
`  <div class="stg-panel" id="stg-appearance">

    <div class="card">
      <div class="card-title">🌗 حالت نمایش</div>`,
`  <div class="stg-panel" id="stg-appearance">

    <div class="card">
      <div class="card-title">✨ پوسته / اسکین برنامه</div>
      <p style="font-size:11px;color:var(--text2);margin-bottom:10px;line-height:1.7">یک اسکین کامل انتخاب کنید — رنگ، سایدبار، پس‌زمینهٔ جوی و حس کلی رابط با هم عوض می‌شوند. بعداً می‌توانید تم رنگی یا فونت را جداگانه تنظیم کنید.</p>
      <div id="skin-preset-cards" style="display:flex;gap:10px;flex-wrap:wrap"></div>
    </div>

    <div class="card">
      <div class="card-title">🌗 حالت نمایش</div>`,
'skin picker UI');

// Help card (قانون ۷)
mustReplace(
`<div class="help-cat-header">🔔 اعلان و پیغام‌ها</div>`,
`<div class="help-cat-header">🎨 ظاهر و اسکین</div>
<div class="card help-card help-collapsed">
  <div class="card-title help-toggle" onclick="toggleHelpCard(this)"><span>✨ پوسته / اسکین برنامه</span><span class="help-chev">▾</span></div>
  <p style="font-size:13px;line-height:2;color:var(--text2)">
    از <b>تنظیمات → 🎨 ظاهر</b> می‌توانید یک <b>اسکین کامل</b> برای کل نرم‌افزار انتخاب کنید. اسکین فقط یک رنگ دکمه نیست؛ حس کلی برنامه (سایدبار، پس‌زمینه، کارت‌ها) را یکجا عوض می‌کند.
  </p>
  <ul style="font-size:13px;line-height:2.2;color:var(--text);padding-right:20px">
    <li><b>پارسیان:</b> اسکین اصلی برند — آبی نفتی با لمس فیروزه‌ای (پیشنهادی).</li>
    <li><b>اقیانوس:</b> سبزآبی خنک برای کار طولانی و خوانایی بالا.</li>
    <li><b>ذغال‌سنگی:</b> خاکستری حرفه‌ای و رسمی (حالت روشن، نه تاریک).</li>
    <li><b>مس صنعتی:</b> گرم و متمایز برای فضای کارگاهی.</li>
    <li><b>کلاسیک:</b> ظاهر قبلی آبی ساده، اگر به آن عادت دارید.</li>
  </ul>
  <p style="font-size:13px;line-height:2;color:var(--text2);margin-top:8px">
    بعد از انتخاب اسکین، همچنان می‌توانید <b>تم رنگی</b>، <b>فونت</b>، <b>تراکم</b>، <b>گردی گوشه</b> و <b>تصویر پس‌زمینه</b> را جداگانه تنظیم کنید. این تنظیمات در بک‌آپ هم ذخیره می‌شوند.
  </p>
</div>

<div class="help-cat-header">🔔 اعلان و پیغام‌ها</div>`,
'help card for skins');

// Backup appearance.skin
mustReplace(
`    appearance: {
      colorTheme: localStorage.getItem('laegh_color_theme')||'',
      theme: localStorage.getItem('laegh_theme')||'',
      appFont: localStorage.getItem('laegh_app_font')||'',
      textSize: localStorage.getItem('laegh_text_size')||'',
      density: localStorage.getItem('laegh_density')||'',
      radius: localStorage.getItem('laegh_radius')||'',
      appBg: localStorage.getItem('laegh_app_bg')||'',
      appBgOverlay: localStorage.getItem('laegh_app_bg_overlay')||''
    },`,
`    appearance: {
      skin: localStorage.getItem('laegh_skin')||'',
      colorTheme: localStorage.getItem('laegh_color_theme')||'',
      theme: localStorage.getItem('laegh_theme')||'',
      appFont: localStorage.getItem('laegh_app_font')||'',
      textSize: localStorage.getItem('laegh_text_size')||'',
      density: localStorage.getItem('laegh_density')||'',
      radius: localStorage.getItem('laegh_radius')||'',
      appBg: localStorage.getItem('laegh_app_bg')||'',
      appBgOverlay: localStorage.getItem('laegh_app_bg_overlay')||''
    },`,
'backup appearance.skin');

mustReplace(
`      if(d.appearance && typeof d.appearance==='object'){
        var ap = d.appearance;
        if(ap.colorTheme) localStorage.setItem('laegh_color_theme', ap.colorTheme);
        if(ap.theme) localStorage.setItem('laegh_theme', ap.theme);
        if(ap.appFont) localStorage.setItem('laegh_app_font', ap.appFont);
        if(ap.textSize) localStorage.setItem('laegh_text_size', ap.textSize);
        if(ap.density) localStorage.setItem('laegh_density', ap.density);
        if(ap.radius) localStorage.setItem('laegh_radius', ap.radius);
        if(ap.appBg) localStorage.setItem('laegh_app_bg', ap.appBg);
        if(ap.appBgOverlay) localStorage.setItem('laegh_app_bg_overlay', ap.appBgOverlay);
      }`,
`      if(d.appearance && typeof d.appearance==='object'){
        var ap = d.appearance;
        if(ap.skin) localStorage.setItem('laegh_skin', ap.skin);
        if(ap.colorTheme) localStorage.setItem('laegh_color_theme', ap.colorTheme);
        if(ap.theme) localStorage.setItem('laegh_theme', ap.theme);
        if(ap.appFont) localStorage.setItem('laegh_app_font', ap.appFont);
        if(ap.textSize) localStorage.setItem('laegh_text_size', ap.textSize);
        if(ap.density) localStorage.setItem('laegh_density', ap.density);
        if(ap.radius) localStorage.setItem('laegh_radius', ap.radius);
        if(ap.appBg) localStorage.setItem('laegh_app_bg', ap.appBg);
        if(ap.appBgOverlay) localStorage.setItem('laegh_app_bg_overlay', ap.appBgOverlay);
        if(typeof applyAppearanceSettings==='function') applyAppearanceSettings();
      }`,
'restore appearance.skin + reapply');

// Protect skin key on reset
mustReplace(
`  const protectedKeys = ['laegh_adminpw','laegh_theme','laegh_logo','laegh_sender','laegh_autosave_enabled','laegh_autosave_interval'];`,
`  const protectedKeys = ['laegh_adminpw','laegh_theme','laegh_skin','laegh_color_theme','laegh_logo','laegh_sender','laegh_autosave_enabled','laegh_autosave_interval'];`,
'protectedKeys include skin');

// Appearance JS — insert skin system before COLOR_THEMES and wire applyAppearanceSettings
mustReplace(
`// ===== APPEARANCE / THEME SYSTEM =====
const COLOR_THEMES = {
  blue:    { label:'آبی کلاسیک',  blue:'#185FA5', blue2:'#0C447C', blueL:'#E6F1FB' },
  emerald: { label:'سبز زمردی',   blue:'#0F9D58', blue2:'#0B7A43', blueL:'#E3F7EC' },
  violet:  { label:'بنفش یاقوتی', blue:'#7C3AED', blue2:'#5B21B6', blueL:'#F1E9FE' },
  amber:   { label:'نارنجی گرم',  blue:'#D97706', blue2:'#9A5B05', blueL:'#FEF3E2' },
  rose:    { label:'گلبهی',       blue:'#E11D48', blue2:'#9F1239', blueL:'#FDE8ED' },
  slate:   { label:'خاکستری مدرن', blue:'#475569', blue2:'#334155', blueL:'#EEF2F6' }
};`,
`// ===== APPEARANCE / THEME SYSTEM =====
// اسکین کامل (پوسته): پالت + جو + سایدبار — جدا از سواچ «تم رنگی»
const SKIN_PRESETS = {
  parsian: {
    label:'پارسیان', desc:'آبی نفتی + فیروزه — اسکین برند',
    preview:'linear-gradient(135deg,#062F40 0%,#0B4F6C 45%,#1AABB8 100%)',
    blue:'#0B4F6C', blue2:'#062F40', blueL:'#E5F3F7',
    bg:'#EAF1F5', card:'#FFFFFF', border:'#D2DEE6', text:'#152833', text2:'#5B7180',
    green:'#1F7A4C', greenL:'#E6F6EE', amber:'#C45C12', amberL:'#FFF1E6', red:'#B42318', redL:'#FDECEA',
    accent:'#1AABB8', sidebarEnd:'#0A5F73', atmosphere:true, preferFont:'Vazir'
  },
  ocean: {
    label:'اقیانوس', desc:'سبزآبی خنک و خوانا',
    preview:'linear-gradient(135deg,#134E4A 0%,#0F766E 50%,#14B8A6 100%)',
    blue:'#0F766E', blue2:'#115E59', blueL:'#E6F7F4',
    bg:'#E8F4F2', card:'#FFFFFF', border:'#CDE5E1', text:'#134E4A', text2:'#5B7C76',
    green:'#15803D', greenL:'#E8F8EE', amber:'#B45309', amberL:'#FFF7ED', red:'#B91C1C', redL:'#FEF2F2',
    accent:'#14B8A6', sidebarEnd:'#0F766E', atmosphere:true, preferFont:'Vazir'
  },
  graphite: {
    label:'ذغال‌سنگی', desc:'خاکستری رسمی و حرفه‌ای',
    preview:'linear-gradient(135deg,#0F172A 0%,#334155 55%,#94A3B8 100%)',
    blue:'#475569', blue2:'#1E293B', blueL:'#EEF2F6',
    bg:'#F1F5F9', card:'#FFFFFF', border:'#D8E0E8', text:'#0F172A', text2:'#64748B',
    green:'#166534', greenL:'#EAF7EF', amber:'#9A3412', amberL:'#FFF4ED', red:'#991B1B', redL:'#FEF2F2',
    accent:'#64748B', sidebarEnd:'#1E293B', atmosphere:true, preferFont:'Vazir'
  },
  ember: {
    label:'مس صنعتی', desc:'گرم کارگاهی با پایه فولادی',
    preview:'linear-gradient(135deg,#1C1917 0%,#9A3412 50%,#EA580C 100%)',
    blue:'#9A3412', blue2:'#7C2D12', blueL:'#FFF1E8',
    bg:'#F5F0EB', card:'#FFFCFA', border:'#E5D8CC', text:'#1C1917', text2:'#78716C',
    green:'#3F6212', greenL:'#F3F8E8', amber:'#C2410C', amberL:'#FFF4ED', red:'#B91C1C', redL:'#FEF2F2',
    accent:'#EA580C', sidebarEnd:'#7C2D12', atmosphere:true, preferFont:'Vazir'
  },
  classic: {
    label:'کلاسیک', desc:'آبی سادهٔ نسخه‌های قبلی',
    preview:'linear-gradient(135deg,#0C447C 0%,#185FA5 60%,#4C8DCA 100%)',
    blue:'#185FA5', blue2:'#0C447C', blueL:'#E6F1FB',
    bg:'#F5F5F5', card:'#FFFFFF', border:'#E0E0E0', text:'#212121', text2:'#757575',
    green:'#2E7D32', greenL:'#E8F5E9', amber:'#E65100', amberL:'#FFF3E0', red:'#C62828', redL:'#FFEBEE',
    accent:'#185FA5', sidebarEnd:'#0C447C', atmosphere:false, preferFont:null
  }
};

const COLOR_THEMES = {
  blue:    { label:'آبی کلاسیک',  blue:'#185FA5', blue2:'#0C447C', blueL:'#E6F1FB' },
  teal:    { label:'فیروزه‌ای',   blue:'#0B4F6C', blue2:'#062F40', blueL:'#E5F3F7' },
  emerald: { label:'سبز زمردی',   blue:'#0F9D58', blue2:'#0B7A43', blueL:'#E3F7EC' },
  violet:  { label:'بنفش یاقوتی', blue:'#7C3AED', blue2:'#5B21B6', blueL:'#F1E9FE' },
  amber:   { label:'نارنجی گرم',  blue:'#D97706', blue2:'#9A5B05', blueL:'#FEF3E2' },
  rose:    { label:'گلبهی',       blue:'#E11D48', blue2:'#9F1239', blueL:'#FDE8ED' },
  slate:   { label:'خاکستری مدرن', blue:'#475569', blue2:'#334155', blueL:'#EEF2F6' }
};

function applySkinVars(key){
  const s = SKIN_PRESETS[key] || SKIN_PRESETS.parsian;
  const root = document.documentElement;
  const set = (n,v)=>{ if(v!=null) root.style.setProperty(n, v); };
  set('--blue', s.blue); set('--blue2', s.blue2); set('--blue-l', s.blueL);
  set('--bg', s.bg); set('--card', s.card); set('--border', s.border);
  set('--text', s.text); set('--text2', s.text2);
  set('--green', s.green); set('--green-l', s.greenL);
  set('--amber', s.amber); set('--amber-l', s.amberL);
  set('--red', s.red); set('--red-l', s.redL);
  set('--skin-accent', s.accent); set('--skin-sidebar-end', s.sidebarEnd);
  document.body.classList.remove('skin-parsian','skin-ocean','skin-graphite','skin-ember','skin-classic','has-skin-atmosphere');
  document.body.classList.add('skin-'+key);
  if(s.atmosphere) document.body.classList.add('has-skin-atmosphere');
}
function setSkin(key){
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
function renderSkinCards(){
  const box = document.getElementById('skin-preset-cards');
  if(!box) return;
  const cur = localStorage.getItem('laegh_skin') || 'parsian';
  box.innerHTML = Object.keys(SKIN_PRESETS).map(key=>{
    const s = SKIN_PRESETS[key];
    return '<div class="skin-card'+(key===cur?' selected':'')+'" data-skin="'+key+'" onclick="setSkin(\\''+key+'\\')">'+
      '<div class="skin-preview" style="background:'+s.preview+'"></div>'+
      '<div class="skin-name">'+s.label+(key===cur?' ✓':'')+'</div>'+
      '<div class="skin-desc">'+s.desc+'</div></div>';
  }).join('');
}`,
'skin presets + helpers');

// Wire applyAppearanceSettings to apply skin first
mustReplace(
`function applyAppearanceSettings(){
  applyColorThemeVars(localStorage.getItem('laegh_color_theme') || 'blue');
  document.body.classList.toggle('theme-dark', localStorage.getItem('laegh_theme')==='dark');`,
`function applyAppearanceSettings(){
  const skinKey = localStorage.getItem('laegh_skin') || 'parsian';
  applySkinVars(skinKey);
  const colorKey = localStorage.getItem('laegh_color_theme');
  if(colorKey) applyColorThemeVars(colorKey);
  document.body.classList.toggle('theme-dark', localStorage.getItem('laegh_theme')==='dark');`,
'applyAppearanceSettings uses skin');

mustReplace(
`  document.body.classList.remove('fv','fc','ffa');
  const fontVal = localStorage.getItem('laegh_app_font');
  if(fontVal==='Vazir') document.body.classList.add('fv');
  else if(fontVal==='Arial') document.body.classList.add('ffa');
  else if(fontVal==='Calibri') document.body.classList.add('fc');`,
`  document.body.classList.remove('fv','fc','ffa');
  const fontVal = localStorage.getItem('laegh_app_font') || ((SKIN_PRESETS[localStorage.getItem('laegh_skin')||'parsian']||{}).preferFont || '');
  if(fontVal==='Vazir') document.body.classList.add('fv');
  else if(fontVal==='Arial') document.body.classList.add('ffa');
  else if(fontVal==='Calibri') document.body.classList.add('fc');`,
'default font follows skin preferFont');

mustReplace(
`function loadAppearanceUI(){
  const setSel = (id, val) => { const e=document.getElementById(id); if(e && val) e.value = val; };
  setSel('theme-select', localStorage.getItem('laegh_theme') || 'light');
  setSel('app-font-select', localStorage.getItem('laegh_app_font') || 'Tahoma');
  setSel('text-size-select', localStorage.getItem('laegh_text_size') || 'normal');
  setSel('density-select', localStorage.getItem('laegh_density') || 'normal');
  setSel('radius-select', localStorage.getItem('laegh_radius') || 'normal');
  const ovEl = document.getElementById('app-bg-overlay');
  if(ovEl) ovEl.value = localStorage.getItem('laegh_app_bg_overlay') || '0.55';
  renderColorThemeSwatches();
}`,
`function loadAppearanceUI(){
  const setSel = (id, val) => { const e=document.getElementById(id); if(e && val) e.value = val; };
  setSel('theme-select', localStorage.getItem('laegh_theme') || 'light');
  setSel('app-font-select', localStorage.getItem('laegh_app_font') || 'Vazir');
  setSel('text-size-select', localStorage.getItem('laegh_text_size') || 'normal');
  setSel('density-select', localStorage.getItem('laegh_density') || 'normal');
  setSel('radius-select', localStorage.getItem('laegh_radius') || 'normal');
  const ovEl = document.getElementById('app-bg-overlay');
  if(ovEl) ovEl.value = localStorage.getItem('laegh_app_bg_overlay') || '0.55';
  renderSkinCards();
  renderColorThemeSwatches();
}`,
'loadAppearanceUI renders skins');

// setColorTheme should not wipe skin class — only override accent blues (already does). OK.

fs.writeFileSync(OUT, html);
console.log('\\nWrote', OUT);
console.log('bytes', before, '→', html.length, 'delta', html.length - before);
