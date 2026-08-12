#!/usr/bin/env node
/** Classic menu icons + sidebar fullscreen text-clip fix */
const fs = require('fs');
const SRC = process.argv[2] || '/workspace/Laegh_Final.html';
const OUT = process.argv[3] || '/workspace/Laegh_Final_11.5.17.html';
let html = fs.readFileSync(SRC, 'utf8');

function mustReplace(a, b, label) {
  if (!html.includes(a)) {
    console.error('❌ missing:', label);
    console.error(String(a).slice(0, 180));
    process.exit(1);
  }
  html = html.replace(a, b);
  console.log('✅', label);
}

const NAV_CSS = `
/* ══════ منوی کلاسیک + رفع بریدن متن سایدبار ══════ */
:root{--sidebar:268px;}
html,body{overflow-x:hidden;max-width:100%;}
.sb{
  width:var(--sidebar);
  height:100vh;height:100dvh;
  max-width:min(var(--sidebar),42vw);
  overflow-x:hidden;
  overflow-y:auto;
  padding-inline-end:env(safe-area-inset-right,0px);
  overscroll-behavior:contain;
}
.main{margin-right:var(--sidebar);max-width:calc(100% - var(--sidebar));}
@media (max-width:900px){
  :root{--sidebar:240px;}
}
.nav-it{
  display:flex;align-items:flex-start;gap:10px;
  padding:8px 12px;min-width:0;max-width:100%;
  white-space:normal;line-height:1.35;
  overflow:visible;box-sizing:border-box;
}
.nav-it .nav-ico{
  width:26px;height:26px;min-width:26px;min-height:26px;
  border-radius:6px;display:inline-flex;align-items:center;justify-content:center;
  flex-shrink:0;color:#fff;
  box-shadow:inset 0 1px 0 rgba(255,255,255,.35),0 1px 2px rgba(0,0,0,.28);
  background:linear-gradient(180deg,rgba(255,255,255,.22),rgba(0,0,0,.18));
}
.nav-it .nav-ico svg{
  width:15px;height:15px;display:block;
  stroke:#fff;fill:none;
}
.nav-it .nav-txt{
  flex:1 1 auto;min-width:0;
  overflow-wrap:anywhere;word-break:break-word;
  padding-top:3px;
}
.nav-it .nav-badge{flex-shrink:0;margin-right:0;margin-top:2px;}
.sb-section{
  gap:8px;padding:10px 12px 4px;min-width:0;
  white-space:normal;line-height:1.4;
}
.sb-section .sec-ico{
  width:18px;height:18px;min-width:18px;border-radius:4px;
  display:inline-flex;align-items:center;justify-content:center;
  font-size:11px;margin-left:6px;
  box-shadow:inset 0 1px 0 rgba(255,255,255,.25),0 1px 1px rgba(0,0,0,.2);
}
.sb-brand{overflow-wrap:anywhere;padding:0 4px;}
.gs-wrap{padding:0 8px;box-sizing:border-box;max-width:100%;}
.gs-input{width:100%;max-width:100%;box-sizing:border-box;}
#sb-clock{max-width:100%;box-sizing:border-box;overflow-wrap:anywhere;}
/* رنگ‌های کلاسیک هر آیتم (سبک نرم‌افزارهای قدیمی دسکتاپ) */
.nav-it[data-page="dashboard"] .nav-ico{background:linear-gradient(180deg,#7dd3fc,#0284c7);}
.nav-it[data-page="tasks"] .nav-ico{background:linear-gradient(180deg,#fcd34d,#d97706);}
.nav-it[data-page="invoice"] .nav-ico{background:linear-gradient(180deg,#93c5fd,#2563eb);}
.nav-it[data-page="saved"] .nav-ico{background:linear-gradient(180deg,#a5b4fc,#4f46e5);}
.nav-it[data-page="products"] .nav-ico{background:linear-gradient(180deg,#86efac,#16a34a);}
.nav-it[data-page="inventory"] .nav-ico{background:linear-gradient(180deg,#6ee7b7,#0d9488);}
.nav-it[data-page="defective"] .nav-ico{background:linear-gradient(180deg,#fca5a5,#dc2626);}
.nav-it[data-page="warehouse"] .nav-ico{background:linear-gradient(180deg,#fdba74,#ea580c);}
.nav-it[data-page="warehouse-entities"] .nav-ico{background:linear-gradient(180deg,#c4b5fd,#7c3aed);}
.nav-it[data-page="phonebook"] .nav-ico{background:linear-gradient(180deg,#67e8f9,#0891b2);}
.nav-it[data-page="postal"] .nav-ico{background:linear-gradient(180deg,#f9a8d4,#db2777);}
.nav-it[data-page="parts"] .nav-ico{background:linear-gradient(180deg,#fde047,#ca8a04);}
.nav-it[data-page="daqi"] .nav-ico{background:linear-gradient(180deg,#fb923c,#c2410c);}
.nav-it[data-page="services"] .nav-ico{background:linear-gradient(180deg,#a3e635,#65a30d);}
.nav-it[data-page="sales"] .nav-ico{background:linear-gradient(180deg,#5eead4,#0f766e);}
.nav-it[data-page="accounts"] .nav-ico{background:linear-gradient(180deg,#86efac,#15803d);}
.nav-it[data-page="warranty"] .nav-ico{background:linear-gradient(180deg,#fda4af,#e11d48);}
.nav-it[data-page="dataio"] .nav-ico{background:linear-gradient(180deg,#94a3b8,#475569);}
.nav-it[data-page="datetime"] .nav-ico{background:linear-gradient(180deg,#7dd3fc,#0369a1);}
.nav-it[data-page="audit"] .nav-ico{background:linear-gradient(180deg,#d8b4fe,#7e22ce);}
.nav-it[data-page="settings"] .nav-ico{background:linear-gradient(180deg,#cbd5e1,#334155);}
.nav-it[data-page="help"] .nav-ico{background:linear-gradient(180deg,#fde68a,#b45309);}
body.depth-3d .nav-it{margin:2px 6px;max-width:calc(100% - 12px);}
body.depth-3d .nav-it:hover{transform:translateX(-2px);}
`;

mustReplace(
`.nav-it svg{width:16px;height:16px;flex-shrink:0;}
.sb-foot{padding:10px 14px;border-top:1px solid rgba(255,255,255,.1);font-size:10px;color:rgba(255,255,255,.4);text-align:center;}
/* MAIN */
.main{margin-right:var(--sidebar);min-height:100vh;}`,
`.nav-it svg{width:16px;height:16px;flex-shrink:0;}
.sb-foot{padding:10px 14px;border-top:1px solid rgba(255,255,255,.1);font-size:10px;color:rgba(255,255,255,.4);text-align:center;}
${NAV_CSS}
/* MAIN */
.main{margin-right:var(--sidebar);min-height:100vh;min-height:100dvh;}`,
'nav classic CSS + overflow fix');

// Widen default sidebar token (also set in NAV_CSS; keep root in sync)
mustReplace(
`  --sidebar:220px;`,
`  --sidebar:268px;`,
'widen --sidebar');

// Init enhancer: wrap svg+label for every nav-it; add section icons
const ENHANCE_JS = `
// ===== کلاسیک‌سازی آیکون منو + برچسب قابل‌شکست =====
function enhanceSidebarNav(){
  try{
    document.querySelectorAll('.nav-it').forEach(function(el){
      if(el.querySelector('.nav-ico')) return;
      var svg = el.querySelector('svg');
      if(!svg) return;
      var ico = document.createElement('span');
      ico.className = 'nav-ico';
      ico.setAttribute('aria-hidden','true');
      svg.parentNode.insertBefore(ico, svg);
      ico.appendChild(svg);
      // جمع‌آوری گره‌های متنی به .nav-txt (بدون badge)
      var txt = document.createElement('span');
      txt.className = 'nav-txt';
      var nodes = Array.prototype.slice.call(el.childNodes);
      nodes.forEach(function(n){
        if(n === ico) return;
        if(n.nodeType === 1 && n.classList && n.classList.contains('nav-badge')) return;
        if(n.nodeType === 1 && n.tagName === 'SVG') return;
        txt.appendChild(n);
      });
      // پاکسازی فاصله‌های اضافه
      txt.innerHTML = (txt.textContent || '').replace(/^[\\s\\u00A0]+|[\\s\\u00A0]+$/g,'').replace(/^🏠\\s*/,'');
      el.insertBefore(txt, el.querySelector('.nav-badge') || null);
    });
    // شکل برای عناوین گروه
    var SEC_ICONS = {
      'وظایف':'📅','فاکتور':'🧾','کالا':'📦','ارتباطات':'📞','خدمات':'🔧',
      'فروش':'🛒','مالی':'💰','گارانتی':'🛡️','داده‌ها':'💾','مدیریت':'⚙️'
    };
    document.querySelectorAll('.sb-section').forEach(function(sec){
      if(sec.querySelector('.sec-ico')) return;
      var raw = (sec.textContent || '').replace('▾','').trim();
      var icon = '▪';
      Object.keys(SEC_ICONS).forEach(function(k){ if(raw.indexOf(k)>=0) icon = SEC_ICONS[k]; });
      var span = document.createElement('span');
      span.className = 'sec-ico';
      span.textContent = icon;
      sec.insertBefore(span, sec.firstChild);
    });
  }catch(e){ console.warn('enhanceSidebarNav', e); }
}
enhanceSidebarNav();
`;

mustReplace(
`applyAppearanceSettings(); // اعمال فوری تنظیمات ظاهری ذخیره‌شده، همان لحظه بارگذاری اسکریپت`,
`applyAppearanceSettings(); // اعمال فوری تنظیمات ظاهری ذخیره‌شده، همان لحظه بارگذاری اسکریپت
${ENHANCE_JS}`,
'enhanceSidebarNav init');

// Help note
mustReplace(
`    <li><b>عمق سه‌بعدی:</b> از همان بخش ظاهر می‌توانید حالت حجمی را روشن/خاموش کنید — کارت‌ها شناور، دکمه‌ها برجسته، و سایدبار با سایهٔ عمیق دیده می‌شود.</li>
  </ul>`,
`    <li><b>عمق سه‌بعدی:</b> از همان بخش ظاهر می‌توانید حالت حجمی را روشن/خاموش کنید — کارت‌ها شناور، دکمه‌ها برجسته، و سایدبار با سایهٔ عمیق دیده می‌شود.</li>
    <li><b>آیکون منو:</b> هر آیتم منوی سمت راست یک شکل رنگی کلاسیک دارد تا سریع‌تر پیدا شود (سبک نرم‌افزارهای قدیمی دسکتاپ).</li>
  </ul>`,
'help menu icons');

fs.writeFileSync(OUT, html);
fs.writeFileSync('/workspace/Laegh_Final.html', html);
console.log('Wrote', OUT, 'bytes', html.length);
