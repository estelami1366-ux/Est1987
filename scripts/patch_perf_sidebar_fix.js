#!/usr/bin/env node
/** Fix sidebar clip + GPU lag (lightweight depth) */
const fs = require('fs');
const SRC = process.argv[2] || '/workspace/Laegh_Final.html';
const OUT = process.argv[3] || '/workspace/Laegh_Final_11.5.17.html';
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

// 1) Fix sidebar layout block — no 42vw shrink, solid physical padding, never transform
mustReplace(
`/* ══════ منوی کلاسیک + رفع بریدن متن سایدبار ══════ */
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
}`,
`/* ══════ منوی کلاسیک + رفع بریدن متن سایدبار ══════ */
:root{--sidebar:268px;}
html,body{max-width:100%;}
.sb{
  position:fixed;right:0;top:0;
  width:var(--sidebar);
  height:100vh;height:100dvh;
  overflow-x:hidden;
  overflow-y:auto;
  overscroll-behavior:contain;
  transform:none!important; /* هرگز با perspective جابه‌جا نشود */
  will-change:auto;
  contain:layout paint;
  padding-right:max(10px, env(safe-area-inset-right, 0px));
  padding-left:6px;
  box-sizing:border-box;
}
.main{margin-right:var(--sidebar);max-width:calc(100% - var(--sidebar));}
@media (max-width:900px){
  :root{--sidebar:240px;}
}
.nav-it{
  display:flex;align-items:flex-start;gap:10px;
  padding:8px 10px 8px 8px; /* راست بیشتر تا آیکون نبرد */
  min-width:0;max-width:100%;
  white-space:normal;line-height:1.35;
  overflow:hidden;box-sizing:border-box;
  transform:none!important;
}`,
'sidebar clip-proof layout');

mustReplace(
`body.depth-3d .nav-it{margin:2px 6px;max-width:calc(100% - 12px);}
body.depth-3d .nav-it:hover{transform:translateX(-2px);}`,
`body.depth-3d .nav-it{margin:2px 4px;max-width:calc(100% - 8px);}
body.depth-3d .nav-it:hover{background:rgba(255,255,255,.12);}`,
'remove nav hover transform');

// 2) Remove backdrop-filter blur (major lag source)
mustReplace(
`.topbar{background:color-mix(in srgb,var(--card) 88%,transparent);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);border-bottom:1px solid var(--border);padding:10px 20px;display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;position:sticky;top:0;z-index:50;}`,
`.topbar{background:var(--card);border-bottom:1px solid var(--border);padding:10px 20px;display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;position:sticky;top:0;z-index:50;}`,
'remove topbar backdrop-filter');

// 3) Atmosphere: no background-attachment fixed
mustReplace(
`body.has-skin-atmosphere{
  background-image:
    radial-gradient(1100px 520px at 8% -8%, color-mix(in srgb,var(--skin-accent,#1AABB8) 18%,transparent), transparent 58%),
    radial-gradient(900px 480px at 100% 0%, color-mix(in srgb,var(--blue) 14%,transparent), transparent 52%),
    linear-gradient(180deg, color-mix(in srgb,var(--bg) 92%,#fff) 0%, var(--bg) 100%);
  background-attachment:fixed;
}`,
`body.has-skin-atmosphere{
  background-image:
    radial-gradient(900px 420px at 8% -8%, color-mix(in srgb,var(--skin-accent,#1AABB8) 14%,transparent), transparent 58%),
    linear-gradient(180deg, color-mix(in srgb,var(--bg) 92%,#fff) 0%, var(--bg) 100%);
  background-attachment:scroll;
}`,
'lighter atmosphere no fixed bg');

mustReplace(
`  background-image:var(--bg-img);background-size:cover;background-position:center;background-attachment:fixed;`,
`  background-image:var(--bg-img);background-size:cover;background-position:center;background-attachment:scroll;`,
'bg image scroll not fixed');

// 4) Replace entire heavy depth-3d block with lightweight shadows-only version
mustReplace(
`/* ══════ عمق سه‌بعدی / 3D Depth ══════ */
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
}`,
`/* ══════ عمق سه‌بعدی سبک (بدون perspective/GPU سنگین) ══════ */
/* عمداً هیچ perspective / translateZ / rotateX / backdrop-filter نیست — همان حس حجمی با سایه */
body.depth-3d{
  --shadow-card:0 1px 2px rgba(10,30,45,.06),0 6px 16px rgba(10,30,45,.08);
  --shadow-card-hover:0 2px 4px rgba(10,30,45,.08),0 10px 22px rgba(10,30,45,.12);
  --shadow-btn:0 1px 0 rgba(255,255,255,.2) inset,0 2px 6px color-mix(in srgb,var(--blue) 28%,transparent);
}
body.depth-3d .card{
  position:relative;
  border:1px solid color-mix(in srgb,var(--border) 75%,#fff);
  box-shadow:var(--shadow-card);
  transition:box-shadow .15s ease;
}
body.depth-3d .card:hover{box-shadow:var(--shadow-card-hover);}
body.depth-3d .topbar{box-shadow:0 2px 10px rgba(10,30,45,.08);}
body.depth-3d .sb{
  box-shadow:-6px 0 18px rgba(0,0,0,.22), inset 2px 0 0 color-mix(in srgb,var(--skin-accent,#1AABB8) 45%,transparent);
  transform:none!important;
}
body.depth-3d .sb-logo{
  box-shadow:inset 0 1px 0 rgba(255,255,255,.14);
  border-radius:0 0 10px 10px;
  margin:0 6px;
}
body.depth-3d .nav-it{
  margin:2px 4px;
  border-radius:8px;
  border-right:none;
  transition:background .12s ease;
}
body.depth-3d .nav-it:hover{
  background:rgba(255,255,255,.12);
}
body.depth-3d .nav-it.active{
  background:color-mix(in srgb,var(--skin-accent,#1AABB8) 28%,rgba(255,255,255,.12));
  box-shadow:inset 0 1px 0 rgba(255,255,255,.15);
  border-right:none;
}
body.depth-3d .btn{
  box-shadow:0 1px 0 rgba(255,255,255,.55) inset, 0 2px 6px rgba(10,30,45,.08);
}
body.depth-3d .btn:hover{box-shadow:0 1px 0 rgba(255,255,255,.65) inset, 0 3px 10px rgba(10,30,45,.12);}
body.depth-3d .btn:active{box-shadow:inset 0 1px 3px rgba(0,0,0,.15);}
body.depth-3d .btn-p{box-shadow:var(--shadow-btn);}
body.depth-3d .f input,body.depth-3d .f select,body.depth-3d .f textarea{
  box-shadow:inset 0 1px 3px rgba(10,30,45,.06);
}
body.depth-3d .f input:focus,body.depth-3d .f select:focus,body.depth-3d .f textarea:focus{
  box-shadow:0 0 0 3px color-mix(in srgb,var(--blue) 20%,transparent);
}
body.depth-3d .modal{box-shadow:0 12px 36px rgba(10,30,45,.22);}
body.depth-3d .dev-card,body.depth-3d .prod-card,body.depth-3d .pb-card,body.depth-3d .stat-card,body.depth-3d .acc-card,body.depth-3d .dash-kpi{
  box-shadow:0 2px 8px rgba(10,30,45,.08);
  transition:box-shadow .12s ease;
}
body.depth-3d .dev-card:hover,body.depth-3d .prod-card:hover,body.depth-3d .pb-card:hover{
  box-shadow:0 4px 14px rgba(10,30,45,.12);
}
body.depth-3d .skin-card{box-shadow:0 2px 8px rgba(10,30,45,.08);}
body.depth-3d .skin-card:hover{box-shadow:0 4px 14px rgba(10,30,45,.12);}
body.depth-3d.theme-dark .card{box-shadow:0 2px 10px rgba(0,0,0,.28);}
body.depth-3d.theme-dark .f input,body.depth-3d.theme-dark .f select,body.depth-3d.theme-dark .f textarea{
  box-shadow:inset 0 1px 3px rgba(0,0,0,.35);
}`,
'lightweight depth-3d CSS');

// 5) Soften card hover in base appearance (was lifting with transform)
mustReplace(
`.card{transition:box-shadow .2s ease;}
.card:hover{box-shadow:0 4px 16px rgba(0,0,0,.08);}
.btn{transition:transform .12s ease, box-shadow .12s ease;}
.btn:hover{transform:translateY(-1px);}
.btn-p:hover,.btn-g:hover,.btn-o:hover,.btn-pu:hover{box-shadow:0 3px 10px rgba(0,0,0,.18);}`,
`.card{transition:box-shadow .15s ease;}
.card:hover{box-shadow:0 3px 12px rgba(0,0,0,.07);}
.btn{transition:box-shadow .12s ease, background .12s ease;}
.btn-p:hover,.btn-g:hover,.btn-o:hover,.btn-pu:hover{box-shadow:0 2px 8px rgba(0,0,0,.14);}`,
'soften global hover transforms');

// 6) Update settings hint text
mustReplace(
`      <p style="font-size:10px;color:var(--text2);margin-top:6px;line-height:1.6">سایهٔ لایه‌ای، برجستگی دکمه، و حرکت ملایم کارت‌ها. روی مانیتور معمولی بهترین نتیجه را می‌دهد.</p>`,
`      <p style="font-size:10px;color:var(--text2);margin-top:6px;line-height:1.6">حالت سبک: فقط سایهٔ حجمی — بدون blur و بدون ۳بعدی GPU تا روی سیستم‌های ضعیف هم روان باشد.</p>`,
'update depth hint');

fs.writeFileSync(OUT, html);
fs.writeFileSync('/workspace/Laegh_Final.html', html);
console.log('Wrote', OUT, 'bytes', html.length);

// sanity checks
const checks = [
  ['no perspective', !html.includes('perspective:1400px')],
  ['no sb translateZ', !html.includes('transform:translateZ(40px)')],
  ['sb transform none', html.includes('.sb{\n  position:fixed') || html.includes('transform:none!important')],
  ['no topbar blur', !html.includes('backdrop-filter:blur(10px)')],
];
checks.forEach(([n,ok]) => console.log(ok?'✅':'❌', n));
