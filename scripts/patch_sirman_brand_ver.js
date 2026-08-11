#!/usr/bin/env node
/**
 * Sirman rebrand + version Year.Month.Dayα + company FA/EN branding + print page backgrounds
 * Source: Laegh_Final_20.5.17.html → Sirman_Final_1405.5.17α.html
 */
const fs = require('fs');
const SRC = process.argv[2] || '/workspace/Laegh_Final_20.5.17.html';
const OUT = process.argv[3] || '/workspace/Sirman_Final_1405.5.17α.html';
const VER = '1405.5.17α';
const VER_FA = '۱۴۰۵.۵.۱۷α';
const DATE = '1405/05/17';

let html = fs.readFileSync(SRC, 'utf8');

function mustReplace(a, b, label) {
  if (!html.includes(a)) {
    console.error('❌ missing:', label);
    console.error(String(a).slice(0, 280));
    process.exit(1);
  }
  html = html.replace(a, b);
  console.log('✅', label);
}

function replaceAllSafe(a, b, label) {
  const n = html.split(a).length - 1;
  if (!n) {
    console.error('❌ missing all:', label);
    process.exit(1);
  }
  html = html.split(a).join(b);
  console.log('✅', label, '(' + n + ')');
}

// ── Version bump (ASCII first, then Greek display pieces) ──
replaceAllSafe('20.5.17', VER, 'version number');
replaceAllSafe('۲۰.۵.۱۷', VER_FA, 'version FA');
// Keep app-date
if (!html.includes('content="' + DATE + '"')) {
  // already 1405/05/17 from previous
}

// Title default
mustReplace(
  '<title>Laegh Electronic Parsian — سیستم خدمات پس از فروش</title>',
  '<title>سیرمان — سیستم خدمات پس از فروش</title>',
  'document title'
);

// Login brand
mustReplace(
  '<div style="font-size:17px;font-weight:800;color:#1e3a5f;margin-bottom:4px">Laegh Electronic Parsian</div>',
  '<div id="brand-login-title" style="font-size:17px;font-weight:800;color:#1e3a5f;margin-bottom:4px">سیرمان</div>',
  'login brand'
);

// Sidebar brand
mustReplace(
  '<div class="sb-brand">Laegh Electronic Parsian<br>سیستم خدمات پس از فروش</div>',
  '<div class="sb-brand" id="sb-brand"><span id="sb-brand-en">Sirman</span><br><span id="sb-brand-fa">سیستم خدمات پس از فروش</span></div>',
  'sidebar brand'
);

// Footer
mustReplace(
  '<div class="sb-foot">نسخه ۲۰.۵.۱۷ — Laegh EPS</div>'.replace('۲۰.۵.۱۷', VER_FA),
  '<div class="sb-foot" id="sb-foot">نسخه ' + VER_FA + ' — <span id="sb-foot-brand">سیرمان</span></div>',
  'sidebar footer'
);
// In case previous replace already changed version in foot before we got here — handle both
if (html.includes('نسخه ' + VER_FA + ' — Laegh EPS')) {
  html = html.replace(
    '<div class="sb-foot">نسخه ' + VER_FA + ' — Laegh EPS</div>',
    '<div class="sb-foot" id="sb-foot">نسخه ' + VER_FA + ' — <span id="sb-foot-brand">سیرمان</span></div>'
  );
  console.log('✅ sidebar footer (alt)');
}

// Help footer leftover
html = html.replace(
  /Laegh Electronic Parsian — سیستم خدمات پس از فروش — نسخه [۰-۹.]+/g,
  'سیرمان — سیستم خدمات پس از فروش — نسخه ' + VER_FA
);

// SVG Laegh EPS
html = html.replace(/>Laegh EPS</g, '>سیرمان<');

// Company settings UI
mustReplace(
`  <div class="stg-panel" id="stg-company">
    <div class="card">
      <div class="card-title">🏢 اطلاعات شرکت / فروشگاه</div>
      <p style="font-size:12px;color:var(--text2);margin-bottom:12px">این اطلاعات در سربرگ فاکتورها و پرینت‌ها نمایش داده می‌شود.</p>
      <div class="g2" style="margin-bottom:10px">
        <div class="f"><label>نام شرکت/فروشگاه</label><input id="co-name" placeholder="نام شرکت"></div>
        <div class="f"><label>تلفن</label><input id="co-phone" placeholder="021-XXXXXXXX"></div>
      </div>
      <div class="g2" style="margin-bottom:10px">
        <div class="f"><label>ایمیل</label><input id="co-email" placeholder="info@example.com"></div>
        <div class="f"><label>وب‌سایت</label><input id="co-web" placeholder="www.example.com"></div>
      </div>
      <div class="f" style="margin-bottom:10px"><label>آدرس</label><input id="co-addr" placeholder="آدرس کامل شرکت"></div>
      <div class="f" style="margin-bottom:14px"><label>شناسه ملی / کد اقتصادی</label><input id="co-tax" placeholder="کد اقتصادی"></div>
      <button class="btn btn-p btn-sm" onclick="saveCompanyInfo()">💾 ذخیره اطلاعات شرکت</button>
    </div>
  </div>`,
`  <div class="stg-panel" id="stg-company">
    <div class="card">
      <div class="card-title">🏢 برند و اطلاعات شرکت</div>
      <p style="font-size:12px;color:var(--text2);margin-bottom:12px;line-height:1.7">نام فارسی و انگلیسی اینجا، در <b>کل نرم‌افزار</b> دیده می‌شود: سایدبار، ورود، فاکتورها، گارانتی، فروش، گزارش‌ها و چاپ. اگر نرم‌افزار را به شرکت دیگری بدهید، فقط این نام‌ها را عوض کنید.</p>
      <div class="g2" style="margin-bottom:10px">
        <div class="f"><label>نام فارسی برند / شرکت</label><input id="co-name-fa" placeholder="مثلاً سیرمان یا لائق"></div>
        <div class="f"><label>نام انگلیسی برند / شرکت</label><input id="co-name-en" placeholder="e.g. Sirman" dir="ltr" style="text-align:left"></div>
      </div>
      <div class="g2" style="margin-bottom:10px">
        <div class="f"><label>شعار فارسی (زیر لوگو)</label><input id="co-tagline-fa" placeholder="سیستم خدمات پس از فروش"></div>
        <div class="f"><label>نام کوتاه (فوتر)</label><input id="co-short" placeholder="سیرمان"></div>
      </div>
      <div class="g2" style="margin-bottom:10px">
        <div class="f"><label>تلفن</label><input id="co-phone" placeholder="021-XXXXXXXX"></div>
        <div class="f"><label>ایمیل</label><input id="co-email" placeholder="info@example.com"></div>
      </div>
      <div class="g2" style="margin-bottom:10px">
        <div class="f"><label>وب‌سایت</label><input id="co-web" placeholder="www.example.com"></div>
        <div class="f"><label>شناسه ملی / کد اقتصادی</label><input id="co-tax" placeholder="کد اقتصادی"></div>
      </div>
      <div class="f" style="margin-bottom:14px"><label>آدرس</label><input id="co-addr" placeholder="آدرس کامل شرکت"></div>
      <button class="btn btn-p btn-sm" onclick="saveCompanyInfo()">💾 ذخیره و اعمال در کل برنامه</button>
    </div>
  </div>`,
'company branding UI');

// Print bg image UI helper snippet
const printBgBlock = (section) => `
      <div style="margin-top:12px;padding:10px;background:var(--bg2);border-radius:8px;border:1px dashed var(--border)">
        <div style="font-size:12px;font-weight:700;margin-bottom:6px">🖼 تصویر پس‌زمینه چاپ (مطابق اندازه کاغذ)</div>
        <p style="font-size:10px;color:var(--text2);margin-bottom:8px;line-height:1.6">لوگو یا سربرگ شرکت را به‌عنوان پس‌زمینهٔ کم‌رنگ روی کل صفحه چاپ بگذارید. با اندازه کاغذ همین بخش هماهنگ می‌شود.</p>
        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
          <button type="button" class="btn btn-sm btn-p" onclick="document.getElementById('ps-${section}-bgimg-inp').click()">انتخاب تصویر</button>
          <input type="file" id="ps-${section}-bgimg-inp" accept="image/*" style="display:none" onchange="setPrintBgImage('${section}',this)">
          <button type="button" class="btn btn-sm btn-r" onclick="clearPrintBgImage('${section}')">حذف تصویر</button>
          <label style="font-size:11px;color:var(--text2);display:inline-flex;align-items:center;gap:6px">شفافیت
            <input type="range" id="ps-${section}-bgimg-op" min="0.05" max="0.55" step="0.01" value="0.18" oninput="setPrintBgImageOpacity('${section}',this.value)" style="width:100px">
          </label>
          <select id="ps-${section}-bgimg-fit" onchange="setPrintBgImageFit('${section}',this.value)" style="font-size:11px;padding:4px 8px;border-radius:6px;border:1px solid var(--border)">
            <option value="cover">پوشش کامل (cover)</option>
            <option value="contain">جا شدن کامل (contain)</option>
          </select>
          <span id="ps-${section}-bgimg-status" style="font-size:10px;color:var(--text2)"></span>
        </div>
      </div>`;

// Insert print bg blocks before preview buttons for invoice/warranty, and before reset for postal/list
mustReplace(
`      <div style="margin-top:12px;display:flex;gap:8px">
        <button class="btn btn-p btn-sm" onclick="previewPrintSettings('invoice')">👁 پیش‌نمایش</button>
        <button class="btn btn-sm btn-o" onclick="resetPrintSection('invoice')">↺ بازنشانی</button>
      </div>
    </div>

    <!-- WARRANTY PRINT -->`,
printBgBlock('invoice') + `
      <div style="margin-top:12px;display:flex;gap:8px">
        <button class="btn btn-p btn-sm" onclick="previewPrintSettings('invoice')">👁 پیش‌نمایش</button>
        <button class="btn btn-sm btn-o" onclick="resetPrintSection('invoice')">↺ بازنشانی</button>
      </div>
    </div>

    <!-- WARRANTY PRINT -->`,
'invoice print bg UI');

mustReplace(
`      <div style="margin-top:12px;display:flex;gap:8px">
        <button class="btn btn-p btn-sm" onclick="previewPrintSettings('warranty')">👁 پیش‌نمایش</button>
        <button class="btn btn-sm btn-o" onclick="resetPrintSection('warranty')">↺ بازنشانی</button>
      </div>
    </div>

    <!-- POSTAL PRINT -->`,
printBgBlock('warranty') + `
      <div style="margin-top:12px;display:flex;gap:8px">
        <button class="btn btn-p btn-sm" onclick="previewPrintSettings('warranty')">👁 پیش‌نمایش</button>
        <button class="btn btn-sm btn-o" onclick="resetPrintSection('warranty')">↺ بازنشانی</button>
      </div>
    </div>

    <!-- POSTAL PRINT -->`,
'warranty print bg UI');

mustReplace(
`      <div style="margin-top:12px">
        <button class="btn btn-sm btn-o" onclick="resetPrintSection('postal')">↺ بازنشانی</button>
      </div>
    </div>

    <!-- PARTS/SERVICES PRINT -->`,
printBgBlock('postal') + `
      <div style="margin-top:12px">
        <button class="btn btn-sm btn-o" onclick="resetPrintSection('postal')">↺ بازنشانی</button>
      </div>
    </div>

    <!-- PARTS/SERVICES PRINT -->`,
'postal print bg UI');

mustReplace(
`      <div style="margin-top:12px">
        <button class="btn btn-sm btn-o" onclick="resetPrintSection('list')">↺ بازنشانی</button>
      </div>
    </div>

    <div style="padding:10px;background:var(--bg2);border-radius:8px;font-size:11px;color:var(--text2);margin-top:4px;line-height:1.8">
      💡 تنظیمات پرینت به‌صورت خودکار ذخیره می‌شوند و در تمام پرینت‌های نرم‌افزار اعمال می‌گردند.`,
printBgBlock('list') + `
      <div style="margin-top:12px">
        <button class="btn btn-sm btn-o" onclick="resetPrintSection('list')">↺ بازنشانی</button>
      </div>
    </div>

    <div style="padding:10px;background:var(--bg2);border-radius:8px;font-size:11px;color:var(--text2);margin-top:4px;line-height:1.8">
      💡 تنظیمات پرینت به‌صورت خودکار ذخیره می‌شوند و در تمام پرینت‌های نرم‌افزار اعمال می‌گردند.`,
'list print bg UI');

// Help note — find skin help and append branding/print help near appearance help
mustReplace(
`    بعد از انتخاب اسکین، همچنان می‌توانید <b>تم رنگی</b>، <b>فونت</b> (چند خانواده مثل وزیر / نوتو / قاهره)، <b>رنگ فونت</b>، <b>رنگ زمینه داشبورد</b>، <b>تراکم</b>، <b>گردی گوشه</b> و <b>تصویر پس‌زمینه</b> را جداگانه تنظیم کنید. این‌ها در مرورگر می‌مانند و در بک‌آپ هم ذخیره می‌شوند. عکس‌های بزرگ قبل از ذخیره کوچک می‌شوند تا تنظیمات پاک نشوند.`,
`    بعد از انتخاب اسکین، همچنان می‌توانید <b>تم رنگی</b>، <b>فونت</b>، <b>رنگ فونت</b>، <b>رنگ زمینه داشبورد</b>، <b>تراکم</b>، <b>گردی گوشه</b> و <b>تصویر پس‌زمینه</b> را جداگانه تنظیم کنید. نام برند را از <b>تنظیمات → اطلاعات شرکت</b> (فارسی و انگلیسی) عوض کنید تا در همه فاکتورها و چاپ‌ها عوض شود. برای هر بخش چاپ می‌توانید <b>تصویر پس‌زمینه</b> (مثلاً لوگوی شرکت) مطابق اندازه کاغذ بگذارید.`,
'help branding/print');

// Inject brand + print helpers before PRINT SETTINGS section
mustReplace(
`// ===== PRINT SETTINGS =====
const PS_KEY = 'laegh_printSettings';
const PS_DEFAULTS = {
  invoice: { paper:'A4 landscape', font:'Tahoma', fontsize:'11px', margin:'8mm', headercolor:'#2563eb', logo:'1', bg:'none', border:false, watermark:false, pagenum:false },
  warranty: { paper:'A5', headercolor:'#1e3a5f', logo:'1', bg:'none', border:false, qr:false },
  postal:   { paper:'A5', count:'1', logo:'1', fragile:true, border:true },
  list:     { paper:'A4', headercolor:'#2563eb', fontsize:'11px', zebra:true, logo:false, date:true }
};`,
`// ===== BRAND / COMPANY (white-label) =====
const APP_VERSION = '${VER}';
const APP_DATE = '${DATE}';
const BRAND_DEFAULTS = {
  nameFa: 'سیرمان',
  nameEn: 'Sirman',
  taglineFa: 'سیستم خدمات پس از فروش',
  shortName: 'سیرمان'
};
function getCompanyData(){
  try { return JSON.parse(localStorage.getItem('laegh_company')||'{}') || {}; }
  catch(e){ return {}; }
}
function getBrand(){
  var d = getCompanyData();
  var nameFa = (d.nameFa || d.name || BRAND_DEFAULTS.nameFa || '').trim() || BRAND_DEFAULTS.nameFa;
  var nameEn = (d.nameEn || '').trim() || BRAND_DEFAULTS.nameEn;
  var taglineFa = (d.taglineFa || BRAND_DEFAULTS.taglineFa || '').trim() || BRAND_DEFAULTS.taglineFa;
  var shortName = (d.shortName || nameFa || BRAND_DEFAULTS.shortName).trim() || BRAND_DEFAULTS.shortName;
  return { nameFa:nameFa, nameEn:nameEn, taglineFa:taglineFa, shortName:shortName, phone:d.phone||'', email:d.email||'', web:d.web||'', addr:d.addr||'', tax:d.tax||'' };
}
function applyBrand(){
  try{
    var b = getBrand();
    var t = document.getElementById('brand-login-title'); if(t) t.textContent = b.nameFa;
    var en = document.getElementById('sb-brand-en'); if(en) en.textContent = b.nameEn;
    var fa = document.getElementById('sb-brand-fa'); if(fa) fa.textContent = b.taglineFa;
    var foot = document.getElementById('sb-foot-brand'); if(foot) foot.textContent = b.shortName;
    document.title = b.nameFa + ' — ' + b.taglineFa;
  }catch(e){}
}

// ===== PRINT SETTINGS =====
const PS_KEY = 'laegh_printSettings';
const PS_DEFAULTS = {
  invoice: { paper:'A4 landscape', font:'Tahoma', fontsize:'11px', margin:'8mm', headercolor:'#2563eb', logo:'1', bg:'none', border:false, watermark:false, pagenum:false, bgImage:'', bgImageOpacity:0.18, bgImageFit:'cover' },
  warranty: { paper:'A5', headercolor:'#1e3a5f', logo:'1', bg:'none', border:false, qr:false, bgImage:'', bgImageOpacity:0.18, bgImageFit:'cover' },
  postal:   { paper:'A5', count:'1', logo:'1', fragile:true, border:true, bgImage:'', bgImageOpacity:0.18, bgImageFit:'cover' },
  list:     { paper:'A4', headercolor:'#2563eb', fontsize:'11px', zebra:true, logo:false, date:true, bgImage:'', bgImageOpacity:0.18, bgImageFit:'cover' }
};
function printBgCss(sectionOrSettings){
  var s = (typeof sectionOrSettings === 'string')
    ? ((getPrintSettings()[sectionOrSettings]) || PS_DEFAULTS[sectionOrSettings] || {})
    : (sectionOrSettings || {});
  var bgMap = {none:'#ffffff',blue:'linear-gradient(135deg,#e8f0fe,#f0f4ff)',green:'linear-gradient(135deg,#e8f5e9,#f1f8e9)',warm:'linear-gradient(135deg,#fff3e0,#fce4ec)',purple:'linear-gradient(135deg,#f3e5f5,#ede7f6)',lines:'repeating-linear-gradient(45deg,#f5f5f5,#f5f5f5 5px,#fff 5px,#fff 10px)'};
  var colorBg = bgMap[s.bg||'none'] || '#fff';
  if(s.bgImage){
    var op = (s.bgImageOpacity!=null ? s.bgImageOpacity : 0.18);
    var fit = s.bgImageFit || 'cover';
    var url = String(s.bgImage).replace(/\\\\/g,'\\\\').replace(/"/g,'%22');
    return 'html,body{min-height:100%;}body{background:'+colorBg+';position:relative;}'
      + 'body::before{content:"";position:fixed;inset:0;z-index:0;pointer-events:none;'
      + 'background-image:url("'+url+'");background-repeat:no-repeat;background-position:center center;'
      + 'background-size:'+fit+';opacity:'+op+';}'
      + 'body > *{position:relative;z-index:1;}';
  }
  return 'body{background:'+colorBg+';}';
}
function setPrintBgImage(section, inp){
  var f = inp && inp.files && inp.files[0]; if(!f) return;
  var r = new FileReader();
  r.onload = function(e){
    var compress = (typeof _compressImageDataUrl==='function') ? _compressImageDataUrl : function(d,_,__,cb){ cb(d); };
    compress(e.target.result, 1600, 0.75, function(out){
      var ps = getPrintSettings();
      if(!ps[section]) ps[section] = JSON.parse(JSON.stringify(PS_DEFAULTS[section]||{}));
      ps[section].bgImage = out;
      try{ localStorage.setItem(PS_KEY, JSON.stringify(ps)); }
      catch(err){ ntf('حافظه مرورگر پر است — تصویر کوچک‌تری انتخاب کنید','err'); return; }
      updatePrintBgStatus(section);
      ntf('تصویر پس‌زمینه چاپ ذخیره شد');
      try{ inp.value=''; }catch(_e){}
    });
  };
  r.readAsDataURL(f);
}
function clearPrintBgImage(section){
  var ps = getPrintSettings();
  if(!ps[section]) return;
  ps[section].bgImage = '';
  localStorage.setItem(PS_KEY, JSON.stringify(ps));
  updatePrintBgStatus(section);
  ntf('تصویر پس‌زمینه چاپ حذف شد');
}
function setPrintBgImageOpacity(section, val){
  var ps = getPrintSettings();
  if(!ps[section]) ps[section] = {};
  ps[section].bgImageOpacity = Number(val);
  localStorage.setItem(PS_KEY, JSON.stringify(ps));
}
function setPrintBgImageFit(section, val){
  var ps = getPrintSettings();
  if(!ps[section]) ps[section] = {};
  ps[section].bgImageFit = val || 'cover';
  localStorage.setItem(PS_KEY, JSON.stringify(ps));
}
function updatePrintBgStatus(section){
  var el = document.getElementById('ps-'+section+'-bgimg-status');
  if(!el) return;
  var s = (getPrintSettings()[section]) || {};
  el.textContent = s.bgImage ? '✅ تصویر تنظیم شده' : 'بدون تصویر';
  var op = document.getElementById('ps-'+section+'-bgimg-op');
  if(op && s.bgImageOpacity!=null) op.value = s.bgImageOpacity;
  var fit = document.getElementById('ps-'+section+'-bgimg-fit');
  if(fit && s.bgImageFit) fit.value = s.bgImageFit;
}`,
'brand + printBg helpers');

// Extend savePrintSettings to keep bgImage fields
mustReplace(
`  ps.invoice = {
    paper: read('ps-invoice-paper') || ps.invoice.paper,
    font: read('ps-invoice-font') || ps.invoice.font,
    fontsize: read('ps-invoice-fontsize') || ps.invoice.fontsize,
    margin: read('ps-invoice-margin') || ps.invoice.margin,
    headercolor: read('ps-invoice-headercolor') || ps.invoice.headercolor,
    logo: read('ps-invoice-logo') || ps.invoice.logo,
    bg: ps.invoice.bg,
    border: read('ps-invoice-border','chk'),
    watermark: read('ps-invoice-watermark','chk'),
    pagenum: read('ps-invoice-pagenum','chk')
  };
  ps.warranty = {
    paper: read('ps-warranty-paper') || ps.warranty.paper,
    headercolor: read('ps-warranty-headercolor') || ps.warranty.headercolor,
    logo: read('ps-warranty-logo') || ps.warranty.logo,
    bg: ps.warranty.bg,
    border: read('ps-warranty-border','chk'),
    qr: read('ps-warranty-qr','chk')
  };
  ps.postal = {
    paper: read('ps-postal-paper') || ps.postal.paper,
    count: read('ps-postal-count') || ps.postal.count,
    logo: read('ps-postal-logo') || ps.postal.logo,
    fragile: read('ps-postal-fragile','chk'),
    border: read('ps-postal-border','chk')
  };
  ps.list = {
    paper: read('ps-list-paper') || ps.list.paper,
    headercolor: read('ps-list-headercolor') || ps.list.headercolor,
    fontsize: read('ps-list-fontsize') || ps.list.fontsize,
    zebra: read('ps-list-zebra','chk'),
    logo: read('ps-list-logo','chk'),
    date: read('ps-list-date','chk')
  };`,
`  const keepBg = (sec, next) => {
    var prev = ps[sec] || {};
    next.bgImage = prev.bgImage || '';
    next.bgImageOpacity = prev.bgImageOpacity != null ? prev.bgImageOpacity : 0.18;
    next.bgImageFit = prev.bgImageFit || 'cover';
    return next;
  };
  ps.invoice = keepBg('invoice', {
    paper: read('ps-invoice-paper') || ps.invoice.paper,
    font: read('ps-invoice-font') || ps.invoice.font,
    fontsize: read('ps-invoice-fontsize') || ps.invoice.fontsize,
    margin: read('ps-invoice-margin') || ps.invoice.margin,
    headercolor: read('ps-invoice-headercolor') || ps.invoice.headercolor,
    logo: read('ps-invoice-logo') || ps.invoice.logo,
    bg: ps.invoice.bg,
    border: read('ps-invoice-border','chk'),
    watermark: read('ps-invoice-watermark','chk'),
    pagenum: read('ps-invoice-pagenum','chk')
  });
  ps.warranty = keepBg('warranty', {
    paper: read('ps-warranty-paper') || ps.warranty.paper,
    headercolor: read('ps-warranty-headercolor') || ps.warranty.headercolor,
    logo: read('ps-warranty-logo') || ps.warranty.logo,
    bg: ps.warranty.bg,
    border: read('ps-warranty-border','chk'),
    qr: read('ps-warranty-qr','chk')
  });
  ps.postal = keepBg('postal', {
    paper: read('ps-postal-paper') || ps.postal.paper,
    count: read('ps-postal-count') || ps.postal.count,
    logo: read('ps-postal-logo') || ps.postal.logo,
    fragile: read('ps-postal-fragile','chk'),
    border: read('ps-postal-border','chk')
  });
  ps.list = keepBg('list', {
    paper: read('ps-list-paper') || ps.list.paper,
    headercolor: read('ps-list-headercolor') || ps.list.headercolor,
    fontsize: read('ps-list-fontsize') || ps.list.fontsize,
    zebra: read('ps-list-zebra','chk'),
    logo: read('ps-list-logo','chk'),
    date: read('ps-list-date','chk')
  });`,
'savePrintSettings keep bgImage');

mustReplace(
`  set('ps-list-logo', lst.logo, 'chk');
  set('ps-list-date', lst.date, 'chk');
}`,
`  set('ps-list-logo', lst.logo, 'chk');
  set('ps-list-date', lst.date, 'chk');
  ['invoice','warranty','postal','list'].forEach(updatePrintBgStatus);
}`,
'loadPrintSettingsUI status');

// previewPrintSettings — rewrite by function extract (avoids \u200c escape mismatch)
(function patchPreview(){
  const start = html.indexOf('function previewPrintSettings(section)');
  if (start < 0) { console.error('❌ previewPrintSettings missing'); process.exit(1); }
  let brace = 0, i = start, begun = false;
  for (; i < html.length; i++) {
    if (html[i] === '{') { brace++; begun = true; }
    else if (html[i] === '}') { brace--; if (begun && brace === 0) { i++; break; } }
  }
  const neu = `function previewPrintSettings(section) {
  var ps = getPrintSettings();
  var s = ps[section] || PS_DEFAULTS[section];
  var logoSrc = localStorage.getItem('laegh_logo')||'';
  var coName = getBrand().nameFa;
  var sectionName = section==='invoice'?'فاکتور':section==='warranty'?'گارانتی':section==='postal'?'برچسب پستی':'لیست';
  var font = s.font||'Tahoma';
  var fsize = s.fontsize||'11px';
  var paper = s.paper||'A4';
  var margin = s.margin||'8mm';
  var hcolor = s.headercolor||'#2563eb';
  var borderStyle = s.border ? 'body{border:3px solid #333;border-radius:8px;}' : '';
  var watermarkHtml = s.watermark ? '<div style="position:fixed;top:50%;left:50%;transform:translate(-50%,-50%) rotate(-30deg);font-size:80px;opacity:0.05;font-weight:900;pointer-events:none;">رسمی</div>' : '';
  var logoHtml = (logoSrc&&s.logo=='1') ? '<img src="'+logoSrc+'" style="height:36px;object-fit:contain">' : '';
  var pagenumHtml = s.pagenum ? '<div style="position:fixed;bottom:8px;width:100%;text-align:center;font-size:9px;color:#999">صفحه ۱</div>' : '';
  var htmlDoc = '<!DOCTYPE html><html dir="rtl"><head><meta charset="UTF-8">'
    + '<style>'
    + 'body{font-family:'+font+';font-size:'+fsize+';margin:0;padding:20px;direction:rtl;}'
    + printBgCss(s)
    + '@page{size:'+paper+';margin:'+margin+';}'
    + '.hdr{background:'+hcolor+';color:#fff;padding:10px 16px;border-radius:6px;display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;}'
    + 'table{width:100%;border-collapse:collapse;font-size:inherit;}'
    + 'th{background:'+hcolor+';color:#fff;padding:5px;text-align:right;}'
    + 'td{border:1px solid #ddd;padding:5px;text-align:right;}'
    + borderStyle
    + '</style></head><body>'
    + watermarkHtml
    + '<div class="hdr">'
    + logoHtml
    + '<div><div style="font-size:14px;font-weight:700">'+coName+'</div><div style="font-size:10px;opacity:.8">پیش‌نمایش — '+sectionName+'</div></div>'
    + '<div style="text-align:left;font-size:11px">شماره: ۱۰۰۱<br>تاریخ: ۱۴۰۳/۰۱/۱۵</div>'
    + '</div>'
    + '<table><tr><th>ردیف</th><th>شرح</th><th>تعداد</th><th>قیمت واحد</th><th>جمع</th></tr>'
    + '<tr><td>۱</td><td>نمونه قطعه / کالا</td><td>۲</td><td>۵۰۰,۰۰۰</td><td>۱,۰۰۰,۰۰۰</td></tr>'
    + '<tr><td>۲</td><td>خدمت تعمیر</td><td>۱</td><td>۲۰۰,۰۰۰</td><td>۲۰۰,۰۰۰</td></tr>'
    + '</table>'
    + '<div style="text-align:left;margin-top:14px;font-weight:700">جمع کل: ۱,۲۰۰,۰۰۰ تومان</div>'
    + pagenumHtml
    + '<scr'+'ipt>window.onload=function(){window.print();}<\/scr'+'ipt>'
    + '</body></html>';
  var w = window.open('','_blank','width=750,height=550');
  w.document.write(htmlDoc);
  w.document.close();
}`;
  html = html.slice(0, start) + neu + html.slice(i);
  console.log('✅ previewPrintSettings brand+bg');
})();

// skip old mustReplace for preview — removed below
// saveCompanyInfo / loadCompanyInfo
mustReplace(
`function saveCompanyInfo() {
  const data = {
    name: document.getElementById('co-name')?.value||'',
    phone: document.getElementById('co-phone')?.value||'',
    email: document.getElementById('co-email')?.value||'',
    web: document.getElementById('co-web')?.value||'',
    addr: document.getElementById('co-addr')?.value||'',
    tax: document.getElementById('co-tax')?.value||''
  };
  localStorage.setItem('laegh_company', JSON.stringify(data));
  ntf('اطلاعات شرکت ذخیره شد','ok');
}

function loadCompanyInfo() {
  try {
    const d = JSON.parse(localStorage.getItem('laegh_company')||'{}');
    if(document.getElementById('co-name')) {
      document.getElementById('co-name').value = d.name||'';
      document.getElementById('co-phone').value = d.phone||'';
      document.getElementById('co-email').value = d.email||'';
      document.getElementById('co-web').value = d.web||'';
      document.getElementById('co-addr').value = d.addr||'';
      document.getElementById('co-tax').value = d.tax||'';
    }
  } catch(e){}
}`,
`function saveCompanyInfo() {
  const data = {
    nameFa: document.getElementById('co-name-fa')?.value||'',
    nameEn: document.getElementById('co-name-en')?.value||'',
    taglineFa: document.getElementById('co-tagline-fa')?.value||'',
    shortName: document.getElementById('co-short')?.value||'',
    // سازگاری با بک‌آپ‌های قدیمی که فقط name داشتند
    name: document.getElementById('co-name-fa')?.value||'',
    phone: document.getElementById('co-phone')?.value||'',
    email: document.getElementById('co-email')?.value||'',
    web: document.getElementById('co-web')?.value||'',
    addr: document.getElementById('co-addr')?.value||'',
    tax: document.getElementById('co-tax')?.value||''
  };
  localStorage.setItem('laegh_company', JSON.stringify(data));
  applyBrand();
  ntf('برند و اطلاعات شرکت در کل برنامه اعمال شد','ok');
}

function loadCompanyInfo() {
  try {
    const d = JSON.parse(localStorage.getItem('laegh_company')||'{}');
    const set = (id,v)=>{ const el=document.getElementById(id); if(el) el.value = v||''; };
    set('co-name-fa', d.nameFa || d.name || '');
    set('co-name-en', d.nameEn || '');
    set('co-tagline-fa', d.taglineFa || '');
    set('co-short', d.shortName || '');
    set('co-phone', d.phone||'');
    set('co-email', d.email||'');
    set('co-web', d.web||'');
    set('co-addr', d.addr||'');
    set('co-tax', d.tax||'');
  } catch(e){}
}`,
'save/load company branding');

// Protect company key
mustReplace(
`  const protectedKeys = ['laegh_adminpw','laegh_theme','laegh_skin','laegh_depth3d','laegh_color_theme','laegh_sb_mode','laegh_nav_shape','laegh_text_color','laegh_app_font','laegh_text_size','laegh_dash_tint','laegh_dash_bg','laegh_dash_bg_overlay','laegh_last_page','laegh_logo','laegh_sender','laegh_autosave_enabled','laegh_autosave_interval'];`,
`  const protectedKeys = ['laegh_adminpw','laegh_theme','laegh_skin','laegh_depth3d','laegh_color_theme','laegh_sb_mode','laegh_nav_shape','laegh_text_color','laegh_app_font','laegh_text_size','laegh_dash_tint','laegh_dash_bg','laegh_dash_bg_overlay','laegh_last_page','laegh_logo','laegh_sender','laegh_company','laegh_printSettings','laegh_autosave_enabled','laegh_autosave_interval'];`,
'protect company+print');

// Boot applyBrand — after restoreLastPage block
mustReplace(
`applyAppearanceSettings(); // اعمال فوری تنظیمات ظاهری ذخیره‌شده، همان لحظه بارگذاری اسکریپت
(function restoreLastPageAndAppearance(){`,
`applyAppearanceSettings(); // اعمال فوری تنظیمات ظاهری ذخیره‌شده، همان لحظه بارگذاری اسکریپت
try{ if(typeof applyBrand==='function') applyBrand(); }catch(_e){}
(function restoreLastPageAndAppearance(){`,
'boot applyBrand early');

// Note: applyBrand is defined later in file — boot call at applyAppearanceSettings is BEFORE getBrand definition!
// Need to move boot applyBrand to AFTER getBrand is defined, or call applyBrand at end of script.

// Fix: remove early applyBrand and add at end near applyLayerBackgrounds();
html = html.replace(
`try{ if(typeof applyBrand==='function') applyBrand(); }catch(_e){}
(function restoreLastPageAndAppearance(){`,
`(function restoreLastPageAndAppearance(){`
);

mustReplace(
`applyLayerBackgrounds();
`,
`applyLayerBackgrounds();
try{ if(typeof applyBrand==='function') applyBrand(); }catch(_e){}
`,
'boot applyBrand at end');

// Smart replace remaining Laegh Electronic Parsian in JS
function replaceBrandEnSmart() {
  const needle = 'Laegh Electronic Parsian';
  let out = '';
  let i = 0;
  let count = 0;
  while (i < html.length) {
    const idx = html.indexOf(needle, i);
    if (idx < 0) { out += html.slice(i); break; }
    const win = html.slice(Math.max(0, idx - 1000), idx);
    const ticks = (win.match(/`/g) || []).length;
    const inTemplate = (ticks % 2) === 1;
    // string literal default co.name||'...'
    const before = html.slice(Math.max(0, idx - 30), idx);
    let repl;
    if (inTemplate) repl = '${getBrand().nameEn}';
    else if (/\|\|'/.test(before) || /='/.test(before) || /="/.test(before) || before.endsWith("'") || before.endsWith('"')) {
      // inside quotes — close and concat
      if (before.endsWith("'") || /'\s*$/.test(before) || before.includes("||'")) {
        // pattern like ||'Laegh...' or ='Laegh...'
        repl = "'+getBrand().nameEn+'";
        // if surrounded by quotes already as full string 'Laegh...' 
        // handled below by checking exact quote wrap
      } else repl = "'+getBrand().nameEn+'";
    } else {
      repl = "'+getBrand().nameEn+'";
    }
    // Special: full quoted 'Laegh Electronic Parsian'
    if (html[idx - 1] === "'" && html[idx + needle.length] === "'") {
      // replace including quotes with getBrand().nameEn
      out += html.slice(i, idx - 1) + 'getBrand().nameEn';
      i = idx + needle.length + 1;
      count++;
      continue;
    }
    if (html[idx - 1] === '"' && html[idx + needle.length] === '"') {
      out += html.slice(i, idx - 1) + 'getBrand().nameEn';
      i = idx + needle.length + 1;
      count++;
      continue;
    }
    out += html.slice(i, idx) + repl;
    i = idx + needle.length;
    count++;
  }
  html = out;
  console.log('✅ smart brand EN replace', count);
}
replaceBrandEnSmart();

// Persian brand strings
replaceAllSafe('لایق الکترونیک پارسیان', "'+getBrand().nameFa+'", 'brand FA in JS-ish');
// Fix cases that broke HTML/static - check leftover broken ones
html = html.replace(/دستیار هوشمند نرم‌افزار '\+getBrand\(\)\.nameFa\+'/g, "دستیار هوشمند نرم‌افزار '+getBrand().nameFa+'");

// Fix AI greeting that might be broken
html = html.replace(
  /من دستیار هوشمند نرم‌افزار لایق هستم/g,
  'من دستیار هوشمند نرم‌افزار هستم'
);
html = html.replace(
  /شما دستیار هوشمند نرم‌افزار مدیریت خدمات پس از فروش '\+getBrand\(\)\.nameFa\+' هستید/g,
  "شما دستیار هوشمند نرم‌افزار مدیریت خدمات پس از فروش '+getBrand().nameFa+' هستید"
);
// sysPrompt is in single-quoted string - the replace may have broken it
html = html.replace(
  /var sysPrompt = 'شما دستیار هوشمند نرم‌افزار مدیریت خدمات پس از فروش '\+getBrand\(\)\.nameFa\+' هستید\. به فارسی پاسخ دهید\. کوتاه و مفید باشید\. اگر سوال درباره خطا یا عیب‌یابی است، راه‌حل عملی بدهید\.';/,
  `var sysPrompt = 'شما دستیار هوشمند نرم‌افزار مدیریت خدمات پس از فروش '+getBrand().nameFa+' هستید. به فارسی پاسخ دهید. کوتاه و مفید باشید. اگر سوال درباره خطا یا عیب‌یابی است، راه‌حل عملی بدهید.';`
);

// SMS / notify thank-you lines that used FA brand inside single quotes
html = html.replace(/با تشکر — '\+getBrand\(\)\.nameFa\+'/g, "با تشکر — '+getBrand().nameFa+'");
html = html.replace(/با تشکر — خدمات پس از فروش '\+getBrand\(\)\.nameFa\+'/g, "با تشکر — خدمات پس از فروش '+getBrand().nameFa+'");
html = html.replace(/پیام تست از نرم‌افزار '\+getBrand\(\)\.nameFa\+'/g, "پیام تست از نرم‌افزار '+getBrand().nameFa+'");

// printInv use printBgCss
(function patchPrintInv(){
  const start = html.indexOf('function printInv(){');
  if (start < 0) { console.error('❌ printInv missing'); process.exit(1); }
  // only rewrite the style/bg portion
  const marker = 'const bgMap={none:';
  const m = html.indexOf(marker, start);
  if (m < 0 || m - start > 400) { console.error('❌ printInv bgMap missing'); process.exit(1); }
  const styleStart = html.indexOf('<style>', m);
  const styleEnd = html.indexOf('</style>', styleStart);
  if (styleStart < 0 || styleEnd < 0) { console.error('❌ printInv style missing'); process.exit(1); }
  // remove bgMap lines up to document.write style
  const before = html.slice(0, m);
  // find "const w=window.open" between m and styleStart
  const wIdx = html.indexOf('const w=window.open', m);
  const mid = html.slice(wIdx, styleStart);
  const newStyle = `<style>body{font-family:\${pi.font||'Tahoma'},sans-serif;font-size:\${pi.fontsize||'11px'};direction:rtl;margin:0;padding:8px;}\${printBgCss(pi)}@page{size:\${pi.paper||'A4 landscape'};margin:\${pi.margin||'8mm'};}th,td{border:.5px solid #aaa;padding:2px 3px;text-align:right;}\${pi.border?'body{border:3px solid #333;border-radius:8px;}':''}\${pi.watermark?'.watermark{position:fixed;top:50%;left:50%;transform:translate(-50%,-50%) rotate(-30deg);font-size:100px;opacity:0.05;font-weight:900;pointer-events:none;}':''}\${pi.pagenum?'@page{@bottom-center{content:counter(page);}}':''}</style>`;
  // In source file the template uses ${} literally — we're editing the HTML source which contains ${ as characters
  // So we must write the literal characters $ { without interpolating in this patch script.
  const newStyleLit = '<style>body{font-family:${pi.font||\'Tahoma\'},sans-serif;font-size:${pi.fontsize||\'11px\'};direction:rtl;margin:0;padding:8px;}${printBgCss(pi)}@page{size:${pi.paper||\'A4 landscape\'};margin:${pi.margin||\'8mm\'};}th,td{border:.5px solid #aaa;padding:2px 3px;text-align:right;}${pi.border?\'body{border:3px solid #333;border-radius:8px;}\':\'\'}${pi.watermark?\'.watermark{position:fixed;top:50%;left:50%;transform:translate(-50%,-50%) rotate(-30deg);font-size:100px;opacity:0.05;font-weight:900;pointer-events:none;}\':\'\'}${pi.pagenum?\'@page{@bottom-center{content:counter(page);}}\':\'\'}</style>';
  html = before + mid + newStyleLit + html.slice(styleEnd + '</style>'.length);
  console.log('✅ printInv bg image');
})();

// buildPH brand line — after smart replace should already have ${getBrand().nameEn}
// Fix buildPH if it got '+getBrand().nameEn+' inside template
html = html.replace(
  /فاکتور خدمات پس از فروش — '\+getBrand\(\)\.nameEn\+'/g,
  'فاکتور خدمات پس از فروش — ${getBrand().nameEn}'
);
html = html.replace(
  /فاکتور خدمات پس از فروش — \$\{getBrand\(\)\.nameEn\}/g,
  'فاکتور خدمات پس از فروش — ${getBrand().nameFa}'
);

// Fix coName fallbacks already handled by smart replace of quoted strings

// AI sysPrompt - ensure works
if (!html.includes("getBrand().nameFa+' هستید")) {
  console.log('⚠️ AI sysPrompt brand may need manual check');
}

// Remaining Laegh EPS in foot already handled
html = html.replace(/Laegh EPS/g, 'سیرمان');
html = html.replace(/نرم‌افزار لایق/g, 'نرم‌افزار سیرمان');
html = html.replace(/اجرای لایق\.bat/g, 'اجرای سیرمان.bat');
html = html.replace(/«اجرای لایق\.bat»/g, '«اجرای سیرمان.bat»');

// backup version field should already be updated via 20.5.17 → VER

// Ensure meta version is correct
if (!html.includes('content="' + VER + '"')) {
  console.error('meta version missing after replace');
  process.exit(1);
}

fs.writeFileSync(OUT, html);
fs.writeFileSync('/workspace/Laegh_Final.html', html);
fs.writeFileSync('/workspace/Sirman_Final.html', html);
console.log('Wrote', OUT, 'bytes', html.length);
console.log('Remaining Laegh Electronic:', (html.match(/Laegh Electronic Parsian/g)||[]).length);
console.log('Remaining لایق الکترونیک:', (html.match(/لایق الکترونیک پارسیان/g)||[]).length);
