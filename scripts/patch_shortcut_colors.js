#!/usr/bin/env node
/** Fix dash shortcut icons losing color after drag */
const fs = require('fs');
const SRC = process.argv[2] || '/workspace/Laegh_Final_13.5.17.html';
const OUT = process.argv[3] || '/workspace/Laegh_Final_14.5.17.html';
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

const COLOR_PAGES = [
  ['dashboard', '#7dd3fc', '#0284c7'],
  ['tasks', '#fcd34d', '#d97706'],
  ['invoice', '#93c5fd', '#2563eb'],
  ['saved', '#a5b4fc', '#4f46e5'],
  ['products', '#86efac', '#16a34a'],
  ['inventory', '#6ee7b7', '#0d9488'],
  ['defective', '#fca5a5', '#dc2626'],
  ['warehouse', '#fdba74', '#ea580c'],
  ['warehouse-entities', '#c4b5fd', '#7c3aed'],
  ['phonebook', '#67e8f9', '#0891b2'],
  ['postal', '#f9a8d4', '#db2777'],
  ['parts', '#fde047', '#ca8a04'],
  ['daqi', '#fb923c', '#c2410c'],
  ['services', '#a3e635', '#65a30d'],
  ['sales', '#5eead4', '#0f766e'],
  ['accounts', '#86efac', '#15803d'],
  ['warranty', '#fda4af', '#e11d48'],
  ['dataio', '#94a3b8', '#475569'],
  ['datetime', '#7dd3fc', '#0369a1'],
  ['audit', '#d8b4fe', '#7e22ce'],
  ['settings', '#cbd5e1', '#334155'],
  ['help', '#fde68a', '#b45309'],
];

const DASH_COLOR_CSS = COLOR_PAGES.map(([p, a, b]) =>
  `.dash-sc[data-page="${p}"] .nav-ico,.dash-sc[data-page="${p}"] .dash-sc-ico{background:linear-gradient(180deg,${a},${b})!important;}`
).join('\n');

mustReplace(
`.dash-sc .nav-ico, .dash-sc-ico{
  width:42px;height:42px;border-radius:12px;display:flex;align-items:center;justify-content:center;color:#fff;
  box-shadow:inset 0 1px 0 rgba(255,255,255,.3),0 1px 2px rgba(0,0,0,.2);
}
.dash-sc .nav-ico svg, .dash-sc-ico svg{width:20px;height:20px;stroke:#fff;}`,
`.dash-sc .nav-ico, .dash-sc-ico{
  width:42px;height:42px;border-radius:12px;display:flex;align-items:center;justify-content:center;color:#fff;
  box-shadow:inset 0 1px 0 rgba(255,255,255,.3),0 1px 2px rgba(0,0,0,.2);
  background:linear-gradient(180deg,#93c5fd,#2563eb); /* پیش‌فرض تا سفید نشود */
  flex-shrink:0;
}
.dash-sc .nav-ico svg, .dash-sc-ico svg{width:20px;height:20px;stroke:#fff!important;fill:none!important;color:#fff;}
/* همان پالت رنگی منو برای شورتکات‌ها (چون بیرون از .nav-it هستند) */
${DASH_COLOR_CSS}`,
'dash shortcut color CSS');

mustReplace(
`    if(!el._dragBound){
      el.addEventListener('dragstart', function(ev){
        var page = el.getAttribute('data-page') || '';
        var lbl = el.getAttribute('data-tip') || page;
        ev.dataTransfer.setData('text/laegh-page', page);
        ev.dataTransfer.setData('text/laegh-label', lbl);
        ev.dataTransfer.setData('text/plain', page);
        ev.dataTransfer.effectAllowed = 'copy';
      });
      el._dragBound = true;
    }`,
`    if(!el._dragBound){
      el.addEventListener('dragstart', function(ev){
        var page = el.getAttribute('data-page') || '';
        var lbl = el.getAttribute('data-tip') || page;
        ev.dataTransfer.setData('text/laegh-page', page);
        ev.dataTransfer.setData('text/laegh-label', lbl);
        ev.dataTransfer.setData('text/plain', page);
        ev.dataTransfer.effectAllowed = 'copy';
        // تصویر درگ رنگی (جلوگیری از سفید شدن شبح درگ)
        try{
          var srcIco = el.querySelector('.nav-ico');
          if(srcIco && ev.dataTransfer.setDragImage){
            var ghost = srcIco.cloneNode(true);
            var cs = window.getComputedStyle(srcIco);
            ghost.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:46px;height:46px;min-width:46px;min-height:46px;display:flex;align-items:center;justify-content:center;border-radius:12px;color:#fff;background:'+cs.background+';box-shadow:0 4px 14px rgba(0,0,0,.35);pointer-events:none;z-index:99999;';
            var gsvg = ghost.querySelector('svg');
            if(gsvg){ gsvg.style.stroke='#fff'; gsvg.style.width='22px'; gsvg.style.height='22px'; }
            document.body.appendChild(ghost);
            ev.dataTransfer.setDragImage(ghost, 23, 23);
            setTimeout(function(){ if(ghost.parentNode) ghost.parentNode.removeChild(ghost); }, 0);
          }
        }catch(_e){}
      });
      el._dragBound = true;
    }`,
'colored drag ghost');

mustReplace(
`function renderDashShortcuts(){
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
}`,
`function renderDashShortcuts(){
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
    tile.setAttribute('data-page', s.page);
    tile.title = String(s.label||s.page);
    var x = document.createElement('button');
    x.type = 'button';
    x.className = 'dash-sc-x';
    x.title = 'حذف';
    x.textContent = '×';
    x.addEventListener('click', function(ev){ removeDashShortcut(s.page, ev); });
    tile.appendChild(x);
    var srcNav = document.querySelector('.nav-it[data-page="'+s.page+'"] .nav-ico');
    if(srcNav){
      var clone = srcNav.cloneNode(true);
      // کپی پس‌زمینهٔ محاسبه‌شده تا بیرون از .nav-it سفید نشود
      try{
        var cs = window.getComputedStyle(srcNav);
        if(cs.background && cs.background !== 'none') clone.style.background = cs.background;
        else if(cs.backgroundImage && cs.backgroundImage !== 'none') clone.style.backgroundImage = cs.backgroundImage;
      }catch(_e){}
      clone.style.color = '#fff';
      var svg = clone.querySelector('svg');
      if(svg){ svg.style.stroke = '#fff'; svg.style.fill = 'none'; }
      tile.appendChild(clone);
    } else {
      var ico = document.createElement('div');
      ico.className = 'dash-sc-ico';
      ico.textContent = '★';
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
}`,
'renderDashShortcuts preserve colors');

html = html.split('13.5.17').join('14.5.17');
html = html.split('۱۳.۵.۱۷').join('۱۴.۵.۱۷');

fs.writeFileSync(OUT, html);
fs.writeFileSync('/workspace/Laegh_Final.html', html);
console.log('Wrote', OUT, 'bytes', html.length);
