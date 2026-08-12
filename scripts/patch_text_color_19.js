#!/usr/bin/env node
/** Add customizable font/text color (e.g. red) in appearance settings */
const fs = require('fs');
const SRC = process.argv[2] || '/workspace/Laegh_Final_18.5.17.html';
const OUT = process.argv[3] || '/workspace/Laegh_Final_19.5.17.html';
let html = fs.readFileSync(SRC, 'utf8');

function mustReplace(a, b, label) {
  if (!html.includes(a)) {
    console.error('❌ missing:', label);
    console.error(String(a).slice(0, 220));
    process.exit(1);
  }
  html = html.replace(a, b);
  console.log('✅', label);
}

mustReplace(
`    <div class="card">
      <div class="card-title">🔤 فونت و اندازه متن</div>
      <div class="g2">
        <div class="f">
          <label>فونت نرم‌افزار</label>
          <select id="app-font-select" onchange="setAppFont(this.value)">
            <option value="Tahoma">Tahoma (پیش‌فرض)</option>
            <option value="Vazir">Vazirmatn (مدرن)</option>
            <option value="Arial">Arial</option>
            <option value="Calibri">Calibri</option>
          </select>
        </div>
        <div class="f">
          <label>اندازه متن</label>
          <select id="text-size-select" onchange="setTextSize(this.value)">
            <option value="sm">کوچک</option>
            <option value="normal" selected>استاندارد</option>
            <option value="lg">بزرگ</option>
          </select>
        </div>
      </div>
    </div>`,
`    <div class="card">
      <div class="card-title">🔤 فونت، اندازه و رنگ متن</div>
      <div class="g2">
        <div class="f">
          <label>فونت نرم‌افزار</label>
          <select id="app-font-select" onchange="setAppFont(this.value)">
            <option value="Tahoma">Tahoma (پیش‌فرض)</option>
            <option value="Vazir">Vazirmatn (مدرن)</option>
            <option value="Arial">Arial</option>
            <option value="Calibri">Calibri</option>
          </select>
        </div>
        <div class="f">
          <label>اندازه متن</label>
          <select id="text-size-select" onchange="setTextSize(this.value)">
            <option value="sm">کوچک</option>
            <option value="normal" selected>استاندارد</option>
            <option value="lg">بزرگ</option>
          </select>
        </div>
      </div>
      <div class="f" style="margin-top:12px">
        <label>رنگ فونت / متن</label>
        <p style="font-size:10px;color:var(--text2);margin:4px 0 8px;line-height:1.6">رنگ نوشته‌های اصلی برنامه را عوض کنید (مثلاً قرمز). روی اسکین و تم تاریک هم اعمال می‌شود.</p>
        <div id="text-color-swatches" style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
          <button type="button" class="btn btn-sm" onclick="setTextColor('default')" title="رنگ پیش‌فرض اسکین">پیش‌فرض</button>
          <button type="button" onclick="setTextColor('#b91c1c')" title="قرمز" style="width:28px;height:28px;border-radius:50%;border:2px solid var(--border);background:#b91c1c;cursor:pointer;padding:0"></button>
          <button type="button" onclick="setTextColor('#1d4ed8')" title="آبی" style="width:28px;height:28px;border-radius:50%;border:2px solid var(--border);background:#1d4ed8;cursor:pointer;padding:0"></button>
          <button type="button" onclick="setTextColor('#15803d')" title="سبز" style="width:28px;height:28px;border-radius:50%;border:2px solid var(--border);background:#15803d;cursor:pointer;padding:0"></button>
          <button type="button" onclick="setTextColor('#a16207')" title="قهوه‌ای/طلایی" style="width:28px;height:28px;border-radius:50%;border:2px solid var(--border);background:#a16207;cursor:pointer;padding:0"></button>
          <button type="button" onclick="setTextColor('#7c3aed')" title="بنفش" style="width:28px;height:28px;border-radius:50%;border:2px solid var(--border);background:#7c3aed;cursor:pointer;padding:0"></button>
          <button type="button" onclick="setTextColor('#0f172a')" title="مشکی" style="width:28px;height:28px;border-radius:50%;border:2px solid var(--border);background:#0f172a;cursor:pointer;padding:0"></button>
          <label style="display:inline-flex;align-items:center;gap:6px;font-size:11px;cursor:pointer;margin-right:4px">
            سفارشی
            <input type="color" id="text-color-inp" value="#152833" onchange="setTextColor(this.value)" style="width:36px;height:28px;padding:0;border:1px solid var(--border);border-radius:6px;background:transparent;cursor:pointer">
          </label>
        </div>
      </div>
    </div>`,
'appearance UI text color');

mustReplace(
`    بعد از انتخاب اسکین، همچنان می‌توانید <b>تم رنگی</b>، <b>فونت</b>، <b>تراکم</b>، <b>گردی گوشه</b> و <b>تصویر پس‌زمینه</b> را جداگانه تنظیم کنید. این تنظیمات در بک‌آپ هم ذخیره می‌شوند.`,
`    بعد از انتخاب اسکین، همچنان می‌توانید <b>تم رنگی</b>، <b>فونت</b>، <b>رنگ فونت</b> (مثلاً قرمز)، <b>تراکم</b>، <b>گردی گوشه</b> و <b>تصویر پس‌زمینه</b> را جداگانه تنظیم کنید. این تنظیمات در بک‌آپ هم ذخیره می‌شوند.`,
'help text color');

mustReplace(
`      appFont: localStorage.getItem('laegh_app_font')||'',
      textSize: localStorage.getItem('laegh_text_size')||'',`,
`      appFont: localStorage.getItem('laegh_app_font')||'',
      textSize: localStorage.getItem('laegh_text_size')||'',
      textColor: localStorage.getItem('laegh_text_color')||'',`,
'backup textColor');

mustReplace(
`        if(ap.appFont) localStorage.setItem('laegh_app_font', ap.appFont);
        if(ap.textSize) localStorage.setItem('laegh_text_size', ap.textSize);`,
`        if(ap.appFont) localStorage.setItem('laegh_app_font', ap.appFont);
        if(ap.textSize) localStorage.setItem('laegh_text_size', ap.textSize);
        if(ap.textColor) localStorage.setItem('laegh_text_color', ap.textColor);
        else if(ap.textColor==='') localStorage.removeItem('laegh_text_color');`,
'restore textColor');

mustReplace(
`  const protectedKeys = ['laegh_adminpw','laegh_theme','laegh_skin','laegh_depth3d','laegh_color_theme','laegh_sb_mode','laegh_nav_shape','laegh_logo','laegh_sender','laegh_autosave_enabled','laegh_autosave_interval'];`,
`  const protectedKeys = ['laegh_adminpw','laegh_theme','laegh_skin','laegh_depth3d','laegh_color_theme','laegh_sb_mode','laegh_nav_shape','laegh_text_color','laegh_logo','laegh_sender','laegh_autosave_enabled','laegh_autosave_interval'];`,
'protect text color key');

mustReplace(
`function setTextSize(val){
  document.body.classList.remove('text-sm','text-lg');
  if(val==='sm') document.body.classList.add('text-sm');
  if(val==='lg') document.body.classList.add('text-lg');
  localStorage.setItem('laegh_text_size', val);
  ntf('اندازه متن تغییر کرد');
}`,
`function setTextSize(val){
  document.body.classList.remove('text-sm','text-lg');
  if(val==='sm') document.body.classList.add('text-sm');
  if(val==='lg') document.body.classList.add('text-lg');
  localStorage.setItem('laegh_text_size', val);
  ntf('اندازه متن تغییر کرد');
}

function _textColorMuted(hex){
  // رنگ فرعی کمی کم‌رنگ‌تر برای برچسب‌ها
  try{
    var h = String(hex||'').replace('#','');
    if(h.length===3) h = h[0]+h[0]+h[1]+h[1]+h[2]+h[2];
    if(h.length!==6) return hex;
    var r = parseInt(h.slice(0,2),16), g = parseInt(h.slice(2,4),16), b = parseInt(h.slice(4,6),16);
    var mix = function(c){ return Math.round(c*0.62 + 120*0.38); };
    var toHex = function(n){ var s=n.toString(16); return s.length<2?'0'+s:s; };
    return '#'+toHex(mix(r))+toHex(mix(g))+toHex(mix(b));
  }catch(e){ return hex; }
}
function setTextColor(val){
  if(!val || val==='default'){
    localStorage.removeItem('laegh_text_color');
    applyTextColor();
    ntf('رنگ فونت به پیش‌فرض برگشت');
    return;
  }
  // فقط رنگ‌های hex ساده
  if(!/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(val)){
    ntf('رنگ نامعتبر است');
    return;
  }
  localStorage.setItem('laegh_text_color', val);
  applyTextColor();
  var inp = document.getElementById('text-color-inp'); if(inp) inp.value = val;
  ntf('رنگ فونت تغییر کرد');
}
function applyTextColor(){
  var c = localStorage.getItem('laegh_text_color') || '';
  var root = document.documentElement;
  if(!c){
    document.body.style.removeProperty('--text');
    document.body.style.removeProperty('--text2');
    // بازگردانی رنگ متن اسکین فعلی (تم تاریک از CSS کلاس theme-dark می‌آید)
    try{
      var skinKey = localStorage.getItem('laegh_skin') || 'parsian';
      if(typeof applySkinVars==='function' && !document.body.classList.contains('theme-dark')){
        var s = (typeof SKIN_PRESETS!=='undefined' && SKIN_PRESETS[skinKey]) ? SKIN_PRESETS[skinKey] : null;
        if(s && s.text){
          root.style.setProperty('--text', s.text);
          if(s.text2) root.style.setProperty('--text2', s.text2);
        }
      } else if(document.body.classList.contains('theme-dark')){
        root.style.removeProperty('--text');
        root.style.removeProperty('--text2');
      }
    }catch(_e){}
    return;
  }
  // روی body ست می‌شود تا حتی در theme-dark هم رنگ سفارشی بماند
  document.body.style.setProperty('--text', c);
  document.body.style.setProperty('--text2', _textColorMuted(c));
  root.style.setProperty('--text', c);
  root.style.setProperty('--text2', _textColorMuted(c));
}`,
'setTextColor / applyTextColor functions');

mustReplace(
`  renderSkinCards();
  renderColorThemeSwatches();
  ntf('اسکین «'+(SKIN_PRESETS[key].label)+'» اعمال شد');
}`,
`  renderSkinCards();
  renderColorThemeSwatches();
  if(typeof applyTextColor==='function') applyTextColor();
  ntf('اسکین «'+(SKIN_PRESETS[key].label)+'» اعمال شد');
}`,
'setSkin keep text color');

mustReplace(
`  if(radVal==='sharp') document.body.classList.add('radius-sharp');
  if(radVal==='round') document.body.classList.add('radius-round');

  applyAppBg();`,
`  if(radVal==='sharp') document.body.classList.add('radius-sharp');
  if(radVal==='round') document.body.classList.add('radius-round');

  applyAppBg();
  if(typeof applyTextColor==='function') applyTextColor();`,
'applyAppearanceSettings text color');

mustReplace(
`  setSel('app-font-select', localStorage.getItem('laegh_app_font') || 'Vazir');
  setSel('text-size-select', localStorage.getItem('laegh_text_size') || 'normal');`,
`  setSel('app-font-select', localStorage.getItem('laegh_app_font') || 'Vazir');
  setSel('text-size-select', localStorage.getItem('laegh_text_size') || 'normal');
  var tc = localStorage.getItem('laegh_text_color') || '';
  var tcInp = document.getElementById('text-color-inp');
  if(tcInp) tcInp.value = tc || '#152833';`,
'loadAppearanceUI text color');

html = html.split('18.5.17').join('19.5.17');
html = html.split('۱۸.۵.۱۷').join('۱۹.۵.۱۷');

fs.writeFileSync(OUT, html);
fs.writeFileSync('/workspace/Laegh_Final.html', html);
console.log('Wrote', OUT, 'bytes', html.length);
