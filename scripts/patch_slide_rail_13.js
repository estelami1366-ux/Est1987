#!/usr/bin/env node
/** Refine icons-only rail: no text, slide-out name R→L; keep all prior skins */
const fs = require('fs');
const SRC = process.argv[2] || '/workspace/Laegh_Final_12.5.17.html';
const OUT = process.argv[3] || '/workspace/Laegh_Final_13.5.17.html';
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

const OLD_ICONS_CSS = `/* حالت فقط‌آیکون (ریل کلاسیک) */
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
}`;

const NEW_ICONS_CSS = `/* حالت فقط‌شکل (ریل آیکون) — هیچ نوشتهٔ ثابتی دیده نمی‌شود */
body.sb-icons-only{--sidebar:78px;}
body.sb-icons-only .sb{
  width:78px;padding-right:4px;padding-left:4px;
  overflow:visible!important; /* تا برچسب کشویی بیرون نبرد */
  contain:none!important;
  z-index:400;
}
body.sb-icons-only .sb-nav{
  overflow-y:auto;overflow-x:visible;
  max-height:calc(100dvh - 70px);
  padding:4px 0 12px;
}
body.sb-icons-only .main{margin-right:78px;max-width:calc(100% - 78px);}
body.sb-icons-only .main.has-custom-bg::before{right:78px;}
body.sb-icons-only .sb-brand,
body.sb-icons-only #sb-clock,
body.sb-icons-only .gs-wrap,
body.sb-icons-only .sb-section,
body.sb-icons-only .sb-foot,
body.sb-icons-only .nav-badge,
body.sb-icons-only .sb-group > .sb-section{display:none!important;}
body.sb-icons-only .sb-logo img{max-width:44px;max-height:34px;}
body.sb-icons-only .sb-logo{padding:10px 4px;border-bottom-color:rgba(255,255,255,.08);}
body.sb-icons-only .sb-group.collapsed .nav-it{display:flex!important;}
body.sb-icons-only .nav-it{
  justify-content:center;align-items:center;
  padding:10px 6px;margin:5px 2px;border-radius:12px;
  position:relative;overflow:visible;gap:0;
  border-right-color:transparent!important;
}
body.sb-icons-only .nav-it .nav-ico{
  width:46px;height:46px;min-width:46px;min-height:46px;
  border-radius:12px;flex-shrink:0;z-index:2;
}
body.sb-icons-only.nav-shape-circle .nav-it .nav-ico{border-radius:50%!important;}
body.sb-icons-only.nav-shape-square .nav-it .nav-ico{border-radius:4px!important;}
body.sb-icons-only.nav-shape-rect .nav-it .nav-ico{width:50px;height:36px;min-width:50px;border-radius:8px!important;}
body.sb-icons-only.nav-shape-rounded .nav-it .nav-ico{border-radius:12px!important;}
body.sb-icons-only .nav-it .nav-ico svg{width:22px;height:22px;}
body.sb-icons-only .nav-it.active{background:rgba(255,255,255,.18);}
/* خاموش کردن تولتیپ سراسری روی آیتم منو — فقط کشویی */
body.sb-icons-only .nav-it[data-tip]:hover::after,
body.sb-icons-only .nav-it[data-tip]:hover::before,
body.sb-icons-only .nav-it:hover::after,
body.sb-icons-only .nav-it:hover::before{
  content:none!important;display:none!important;
}
/* برچسب کشویی: از راست (کنار آیکون) به چپ (داخل صفحه) */
body.sb-icons-only .nav-it .nav-txt{
  display:flex!important;
  align-items:center;
  position:absolute;
  top:50%;
  right:calc(100% + 2px); /* دقیقاً چپِ آیکون — سمت داخل صفحه */
  left:auto;
  transform:translateY(-50%) translateX(12px);
  transform-origin:right center;
  max-width:0;
  opacity:0;
  overflow:hidden;
  white-space:nowrap;
  pointer-events:none;
  background:#111827;
  color:#fff;
  padding:0;
  border-radius:10px 0 0 10px;
  font-size:12px;font-weight:600;line-height:1.3;
  box-shadow:-6px 4px 18px rgba(0,0,0,.28);
  z-index:500;
  transition:max-width .28s ease, opacity .22s ease, transform .28s ease, padding .28s ease;
}
body.sb-icons-only .nav-it:hover .nav-txt,
body.sb-icons-only .nav-it:focus-visible .nav-txt,
body.sb-icons-only .nav-it.slide-open .nav-txt{
  max-width:220px;
  opacity:1;
  padding:9px 14px 9px 16px;
  transform:translateY(-50%) translateX(0);
}
body.sb-icons-only .nav-it:hover,
body.sb-icons-only .nav-it.slide-open{z-index:510;}`;

mustReplace(OLD_ICONS_CSS, NEW_ICONS_CSS, 'icons-only slide CSS');

mustReplace(
`      <div class="card-title">📌 منوی راست — حالت و شکل آیکون</div>
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
    </div>`,
`      <div class="card-title">📌 تم منوی راست — هر گزینه جداست</div>
      <p style="font-size:11px;color:var(--text2);margin-bottom:10px;line-height:1.7">پوسته‌های قبلی (پارسیان / اقیانوس / ذغال‌سنگی / مس صنعتی / کلاسیک) سر جایشان هستند. اینجا فقط <b>چیدمان منو</b> را عوض می‌کنید.</p>
      <div id="sb-mode-cards" style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:12px"></div>
      <div class="g2" style="margin-bottom:8px">
        <div class="f">
          <label>حالت منو</label>
          <select id="sb-mode-select" onchange="setSbMode(this.value)">
            <option value="full">منوی کامل — آیکون + نوشته (تم‌های قبلی)</option>
            <option value="icons">ریل فقط‌شکل — هیچ نوشته‌ای دیده نمی‌شود</option>
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
      <p style="font-size:10px;color:var(--text2);line-height:1.6">در ریل فقط‌شکل، با بردن موس روی هر شکل، نامش به‌صورت <b>کشویی از راست به چپ</b> باز می‌شود. می‌توانید آیکون را به داشبورد بکشید تا شورتکات بسازید.</p>
    </div>`,
'appearance UI menu themes');

mustReplace(
`    <li><b>حالت فقط‌آیکون:</b> از تنظیمات → ظاهر می‌توانید منو را فقط با آیکون‌های بزرگ ببینید؛ با هاور، نام نشان داده می‌شود. شکل آیکون (دایره/مربع/مستطیل) قابل تغییر است.</li>`,
`    <li><b>تم منو:</b> پوسته‌های قبلی همه سر جایشان هستند. حالت «ریل فقط‌شکل» هیچ نوشته‌ای نشان نمی‌دهد؛ با هاور، نام به‌صورت کشویی از راست به چپ باز می‌شود. شکل آیکون (دایره/مربع/مستطیل) جداگانه قابل تغییر است.</li>`,
'help update');

mustReplace(
`function setSbMode(val){
  var icons = val === 'icons';
  document.body.classList.toggle('sb-icons-only', icons);
  localStorage.setItem('laegh_sb_mode', icons ? 'icons' : 'full');
  refreshNavTooltips();
  ntf(icons ? 'حالت فقط‌آیکون فعال شد' : 'منوی کامل فعال شد');
}`,
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
'setSbMode + mode cards');

mustReplace(
`function refreshNavTooltips(){
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
}`,
`function refreshNavTooltips(){
  var iconsOnly = document.body.classList.contains('sb-icons-only');
  document.querySelectorAll('.nav-it[data-page]').forEach(function(el){
    var label = '';
    var t = el.querySelector('.nav-txt');
    if(t) label = (t.textContent || '').trim();
    if(!label) label = el.getAttribute('data-page') || '';
    el.setAttribute('data-tip', label);
    el.setAttribute('aria-label', label);
    // در ریل فقط‌شکل title مرورگر را برنمی‌داریم تا با کشویی تداخل نکند
    if(iconsOnly) el.removeAttribute('title');
    else el.setAttribute('title', label);
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
}`,
'refreshNavTooltips no native title in icons mode');

mustReplace(
`  setSel('sb-mode-select', localStorage.getItem('laegh_sb_mode') || 'full');
  setSel('nav-shape-select', localStorage.getItem('laegh_nav_shape') || 'rounded');
  renderSkinCards();
  renderColorThemeSwatches();
}`,
`  setSel('sb-mode-select', localStorage.getItem('laegh_sb_mode') || 'full');
  setSel('nav-shape-select', localStorage.getItem('laegh_nav_shape') || 'rounded');
  renderSkinCards();
  renderSbModeCards();
  renderColorThemeSwatches();
}`,
'loadAppearanceUI render mode cards');

// version bump 12.5.17 → 13.5.17
html = html.split('12.5.17').join('13.5.17');
html = html.split('۱۲.۵.۱۷').join('۱۳.۵.۱۷');

fs.writeFileSync(OUT, html);
fs.writeFileSync('/workspace/Laegh_Final.html', html);
console.log('Wrote', OUT, 'bytes', html.length);
