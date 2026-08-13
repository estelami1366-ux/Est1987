#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Patch Sirman_Final.html for seasonal/monthly glass warranty browse (1405.5.21τ)."""
from pathlib import Path

ROOT = Path("/workspace")
HTML = ROOT / "Sirman_Final.html"
text = HTML.read_text(encoding="utf-8")

CSS = r'''
<style id="war-browse-skin-css">
/* پوسته شیشه‌ای مرور گارانتی — پشتیبان HTML؛ در Sirman.exe از دات‌نت جایگزین می‌شود */
.war-browse-bar{display:flex;flex-wrap:wrap;align-items:center;gap:10px;margin-bottom:14px;justify-content:center}
.war-browse-modes{display:inline-flex;gap:6px;padding:5px;border-radius:16px;background:rgba(255,255,255,.28);border:1px solid rgba(255,255,255,.45);backdrop-filter:blur(18px) saturate(160%);-webkit-backdrop-filter:blur(18px) saturate(160%);box-shadow:0 8px 28px rgba(15,40,55,.08)}
.war-browse-mode{border:0;background:transparent;color:var(--text);font-family:var(--font);font-size:13px;font-weight:800;padding:8px 16px;border-radius:12px;cursor:pointer}
.war-browse-mode.active{background:rgba(255,255,255,.72);box-shadow:0 4px 14px rgba(15,40,55,.12);color:var(--blue2)}
.war-browse-crumb{font-size:12px;color:var(--text2);display:flex;gap:6px;align-items:center;flex-wrap:wrap}
.war-browse-crumb button{border:0;background:transparent;color:var(--blue2);font-weight:800;cursor:pointer;font-family:var(--font);font-size:12px}
#war-browse-year{padding:7px 10px;border-radius:10px;border:1px solid rgba(255,255,255,.5);background:rgba(255,255,255,.45);backdrop-filter:blur(12px);font-family:var(--font);font-size:12px}
#war-browse-gallery{display:none;gap:18px;justify-content:center;align-items:stretch;margin:18px auto 8px;max-width:980px;padding:8px 4px 24px}
#war-browse-gallery.war-gallery-season{display:grid;grid-template-columns:repeat(2,minmax(220px,1fr))}
#war-browse-gallery.war-gallery-month{display:grid;grid-template-columns:repeat(4,minmax(140px,1fr))}
@media (max-width:900px){#war-browse-gallery.war-gallery-month{grid-template-columns:repeat(3,minmax(130px,1fr))}}
@media (max-width:640px){#war-browse-gallery.war-gallery-season,#war-browse-gallery.war-gallery-month{grid-template-columns:1fr 1fr}}
.war-glass-card{position:relative;overflow:hidden;min-height:168px;border-radius:22px;padding:22px 18px 16px;cursor:pointer;text-align:center;color:#123;border:1px solid rgba(255,255,255,.55);background:rgba(255,255,255,.22);backdrop-filter:blur(22px) saturate(170%);-webkit-backdrop-filter:blur(22px) saturate(170%);box-shadow:0 18px 40px rgba(20,40,70,.12), inset 0 1px 0 rgba(255,255,255,.65);transition:transform .18s ease, box-shadow .18s ease}
.war-glass-card:hover{transform:translateY(-4px) scale(1.015);box-shadow:0 26px 48px rgba(20,40,70,.18), inset 0 1px 0 rgba(255,255,255,.8)}
.war-glass-card.month{min-height:132px;border-radius:18px;padding:16px 10px 12px}
.war-glass-symbol{font-size:42px;line-height:1;filter:drop-shadow(0 6px 10px rgba(0,0,0,.12));margin-bottom:8px}
.war-glass-card.month .war-glass-symbol{font-size:30px}
.war-glass-title{font-size:22px;font-weight:900;letter-spacing:-.3px}
.war-glass-card.month .war-glass-title{font-size:16px}
.war-glass-motif{font-size:12px;opacity:.82;margin-top:4px}
.war-glass-count{margin-top:12px;display:inline-flex;align-items:center;gap:6px;padding:4px 10px;border-radius:999px;background:rgba(255,255,255,.42);font-size:12px;font-weight:800}
.war-glass-card::before{content:"";position:absolute;inset:auto -20% -40% -20%;height:70%;background:radial-gradient(circle at 50% 0, rgba(255,255,255,.35), transparent 62%);pointer-events:none}
.war-glass-card.season-spring{background-image:radial-gradient(circle at 14% 18%, rgba(255,182,193,.75) 0 11px, transparent 12px),radial-gradient(circle at 78% 24%, rgba(255,255,255,.62) 0 13px, transparent 14px),radial-gradient(circle at 28% 78%, rgba(167,243,208,.55) 0 16px, transparent 17px),linear-gradient(155deg, rgba(255,241,242,.5), rgba(220,252,231,.42));box-shadow:0 18px 40px rgba(251,113,133,.18), inset 0 1px 0 rgba(255,255,255,.7)}
.war-glass-card.season-summer{background-image:radial-gradient(circle at 80% 12%, rgba(253,224,71,.8) 0 28px, transparent 29px),radial-gradient(circle at 18% 82%, rgba(251,146,60,.35) 0 22px, transparent 23px),linear-gradient(160deg, rgba(255,247,237,.5), rgba(253,230,138,.4));box-shadow:0 18px 40px rgba(245,158,11,.18), inset 0 1px 0 rgba(255,255,255,.7)}
.war-glass-card.season-autumn{background-image:radial-gradient(circle at 20% 20%, rgba(251,146,60,.55) 0 14px, transparent 15px),radial-gradient(circle at 72% 30%, rgba(220,38,38,.28) 0 18px, transparent 19px),radial-gradient(circle at 40% 80%, rgba(180,83,9,.28) 0 20px, transparent 21px),linear-gradient(150deg, rgba(255,247,237,.5), rgba(253,186,116,.42));box-shadow:0 18px 40px rgba(234,88,12,.18), inset 0 1px 0 rgba(255,255,255,.7)}
.war-glass-card.season-winter{background-image:radial-gradient(circle at 16% 16%, rgba(255,255,255,.9) 0 6px, transparent 7px),radial-gradient(circle at 70% 22%, rgba(255,255,255,.75) 0 5px, transparent 6px),radial-gradient(circle at 40% 70%, rgba(191,219,254,.7) 0 10px, transparent 11px),linear-gradient(160deg, rgba(239,246,255,.55), rgba(224,231,255,.42));box-shadow:0 18px 40px rgba(59,130,246,.16), inset 0 1px 0 rgba(255,255,255,.8)}
body.theme-dark .war-browse-modes,body.theme-dark .war-glass-card{color:#e8eef5;border-color:rgba(255,255,255,.16)}
body.theme-dark .war-browse-mode.active{background:rgba(30,48,64,.72);color:#fff}
body.theme-dark .war-glass-count{background:rgba(8,16,28,.35);color:#e8eef5}
</style>
'''

WAR_LIST_OLD = '''<!-- لیست -->
<div id="war-list">
<div class="card">
  <div class="s-bar">
    <input class="s-in" id="wq" placeholder="جستجو: نام، تلفن، مدل..." oninput="renderWar()">
    <select id="wsf" onchange="renderWar()" style="padding:6px 8px;border:1px solid var(--border);border-radius:6px;font-size:12px;font-family:var(--font)">
      <option value="">همه</option><option value="open">باز</option><option value="closed">بسته</option>
    </select>
    <select id="w-sort" onchange="renderWar()" style="padding:6px 8px;border:1px solid var(--border);border-radius:6px;font-size:12px;font-family:var(--font)" title="مرتب‌سازی">
      <option value="_idx:desc">جدیدترین</option>
      <option value="_idx:asc">قدیمی‌ترین</option>
      <option value="name:asc">نام مشتری</option>
      <option value="model:asc">مدل دستگاه</option>
      <option value="status:asc">وضعیت</option>
    </select>
    <span class="bulk-bar" id="war-bulk" style="display:none">
      <span class="bulk-cnt" id="war-sel-cnt">۰</span>
      <button class="btn btn-sm btn-r" onclick="delSelWars()">🗑 حذف انتخاب‌شده‌ها</button>
    </span>
  </div>
  <div id="war-tbl"></div>
</div>
</div><!-- /war-list -->
'''

WAR_LIST_NEW = '''<!-- لیست -->
<div id="war-list">
<div class="war-browse-bar" id="war-browse-bar">
  <div class="war-browse-modes" role="tablist" aria-label="نمای پرونده‌های گارانتی">
    <button type="button" class="war-browse-mode" data-mode="season" onclick="setWarBrowseMode('season')">🌸 فصلی</button>
    <button type="button" class="war-browse-mode" data-mode="month" onclick="setWarBrowseMode('month')">🗓 ماهیانه</button>
    <button type="button" class="war-browse-mode active" data-mode="list" onclick="setWarBrowseMode('list')">📋 لیستی</button>
  </div>
  <select id="war-browse-year" onchange="onWarBrowseYearChange()" title="سال شمسی"></select>
  <div id="war-browse-crumb" class="war-browse-crumb"></div>
</div>
<div id="war-browse-gallery" aria-live="polite"></div>
<div class="card" id="war-list-table-card">
  <div class="s-bar">
    <input class="s-in" id="wq" placeholder="جستجو: نام، تلفن، مدل..." oninput="renderWar()">
    <select id="wsf" onchange="renderWar()" style="padding:6px 8px;border:1px solid var(--border);border-radius:6px;font-size:12px;font-family:var(--font)">
      <option value="">همه</option><option value="open">باز</option><option value="closed">بسته</option>
    </select>
    <select id="w-sort" onchange="renderWar()" style="padding:6px 8px;border:1px solid var(--border);border-radius:6px;font-size:12px;font-family:var(--font)" title="مرتب‌سازی">
      <option value="_idx:desc">جدیدترین</option>
      <option value="_idx:asc">قدیمی‌ترین</option>
      <option value="name:asc">نام مشتری</option>
      <option value="model:asc">مدل دستگاه</option>
      <option value="status:asc">وضعیت</option>
    </select>
    <span class="bulk-bar" id="war-bulk" style="display:none">
      <span class="bulk-cnt" id="war-sel-cnt">۰</span>
      <button class="btn btn-sm btn-r" onclick="delSelWars()">🗑 حذف انتخاب‌شده‌ها</button>
    </span>
  </div>
  <div id="war-tbl"></div>
</div>
</div><!-- /war-list -->
'''

JS = r'''
function warLatinDigits(s){
  return String(s||'').replace(/[\u200e\u200f\u202a-\u202e]/g,'').replace(/[۰-۹]/g, function(d){ return String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)); }).replace(/[٠-٩]/g, function(d){ return String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)); });
}
function warJalaliParts(value){
  var s = warLatinDigits(value);
  var m = s.match(/(\d{3,4})\D+(\d{1,2})\D+(\d{1,2})/);
  if(!m) return null;
  var y=+m[1], mo=+m[2], d=+m[3];
  if(!y || mo<1 || mo>12 || d<1 || d>31) return null;
  return {y:y, m:mo, d:d};
}
function warSeasonOfMonth(month){
  var mo = parseInt(month,10)||0;
  if(mo>=1 && mo<=3) return 'spring';
  if(mo>=4 && mo<=6) return 'summer';
  if(mo>=7 && mo<=9) return 'autumn';
  if(mo>=10 && mo<=12) return 'winter';
  return '';
}
function defaultWarBrowseCatalog(){
  return {
    source:'html',
    seasons:[
      {id:'spring', nameFa:'بهار', symbol:'🌸', motif:'شکوفه', months:[1,2,3], from:'#fff1f2', to:'#d1fae5', accent:'#fb7185'},
      {id:'summer', nameFa:'تابستان', symbol:'☀️', motif:'آفتاب', months:[4,5,6], from:'#fff7ed', to:'#fde68a', accent:'#f59e0b'},
      {id:'autumn', nameFa:'پاییز', symbol:'🍂', motif:'برگ طلایی', months:[7,8,9], from:'#fff7ed', to:'#fdba74', accent:'#ea580c'},
      {id:'winter', nameFa:'زمستان', symbol:'❄️', motif:'برف', months:[10,11,12], from:'#eff6ff', to:'#e0e7ff', accent:'#3b82f6'}
    ],
    months:[
      {month:1, nameFa:'فروردین', symbol:'🌸', seasonId:'spring'},
      {month:2, nameFa:'اردیبهشت', symbol:'🌷', seasonId:'spring'},
      {month:3, nameFa:'خرداد', symbol:'🌿', seasonId:'spring'},
      {month:4, nameFa:'تیر', symbol:'☀️', seasonId:'summer'},
      {month:5, nameFa:'مرداد', symbol:'🔥', seasonId:'summer'},
      {month:6, nameFa:'شهریور', symbol:'🌾', seasonId:'summer'},
      {month:7, nameFa:'مهر', symbol:'🍂', seasonId:'autumn'},
      {month:8, nameFa:'آبان', symbol:'🍁', seasonId:'autumn'},
      {month:9, nameFa:'آذر', symbol:'🌧️', seasonId:'autumn'},
      {month:10, nameFa:'دی', symbol:'❄️', seasonId:'winter'},
      {month:11, nameFa:'بهمن', symbol:'⛄', seasonId:'winter'},
      {month:12, nameFa:'اسفند', symbol:'🌱', seasonId:'winter'}
    ]
  };
}
function getWarBrowseCatalog(){
  var cat = window.SIRMAN_WARRANTY_BROWSE_CATALOG;
  if(cat && typeof cat==='string'){
    try{ cat = JSON.parse(cat); }catch(_e){ cat = null; }
  }
  if(cat && Array.isArray(cat.seasons) && cat.seasons.length===4 && Array.isArray(cat.months) && cat.months.length===12) return cat;
  return defaultWarBrowseCatalog();
}
function applyWarBrowseSkinFromHost(){
  try{
    var cat = getWarBrowseCatalog();
    if(cat && cat.source==='dotnet') window.SIRMAN_WARRANTY_BROWSE_FROM_DOTNET = true;
  }catch(_e){}
  if(typeof renderWarBrowseBar==='function') renderWarBrowseBar();
}
function getWarBrowseState(){
  return {
    mode: window._warBrowseMode || 'list',
    year: window._warBrowseYear || 0,
    season: (window._warBrowseDrill && window._warBrowseDrill.season) || '',
    month: (window._warBrowseDrill && window._warBrowseDrill.month) || 0
  };
}
function warBrowseMatches(w, state){
  state = state || getWarBrowseState();
  var p = warJalaliParts(w && (w.date || w.createdAt || ''));
  if(state.year){
    if(!p || p.y !== state.year) return false;
  }
  if(state.season){
    if(!p) return false;
    return warSeasonOfMonth(p.m) === state.season;
  }
  if(state.month){
    if(!p) return false;
    return p.m === state.month;
  }
  return true;
}
function warBrowseCount(filter){
  var list = (typeof warranties!=='undefined' && Array.isArray(warranties)) ? warranties : [];
  var st = Object.assign({}, getWarBrowseState(), filter||{});
  var n=0;
  for(var i=0;i<list.length;i++){ if(warBrowseMatches(list[i], st)) n++; }
  return n;
}
function warBrowseYears(){
  var years={}, list=(typeof warranties!=='undefined' && Array.isArray(warranties))?warranties:[];
  list.forEach(function(w){
    var p=warJalaliParts(w && (w.date||w.createdAt||''));
    if(p && p.y) years[p.y]=true;
  });
  try{
    if(typeof jalaliToday==='function'){
      var t=jalaliToday();
      if(t && t[0]) years[t[0]]=true;
    }
  }catch(_t){}
  return Object.keys(years).map(Number).sort(function(a,b){ return b-a; });
}
function ensureWarBrowseState(){
  if(!window._warBrowseMode){
    try{ window._warBrowseMode = localStorage.getItem('laegh_war_browse_mode') || 'list'; }catch(_e){ window._warBrowseMode='list'; }
  }
  if(window._warBrowseYear===undefined){
    var y=0;
    try{ y=parseInt(localStorage.getItem('laegh_war_browse_year')||'0',10)||0; }catch(_y){ y=0; }
    window._warBrowseYear=y;
  }
  window._warBrowseDrill = window._warBrowseDrill || null;
}
function setWarBrowseMode(mode){
  ensureWarBrowseState();
  if(mode!=='season' && mode!=='month' && mode!=='list') mode='list';
  window._warBrowseMode=mode;
  window._warBrowseDrill=null;
  try{ localStorage.setItem('laegh_war_browse_mode', mode); }catch(_e){}
  renderWar();
}
function onWarBrowseYearChange(){
  var sel=document.getElementById('war-browse-year');
  window._warBrowseYear = sel ? (parseInt(sel.value,10)||0) : 0;
  try{ localStorage.setItem('laegh_war_browse_year', String(window._warBrowseYear||0)); }catch(_e){}
  renderWar();
}
function warBrowseClearDrill(){
  window._warBrowseDrill=null;
  renderWar();
}
function openWarBrowseSeason(id){
  window._warBrowseDrill={season:id, month:0};
  renderWar();
}
function openWarBrowseMonth(month){
  window._warBrowseDrill={season:'', month:parseInt(month,10)||0};
  renderWar();
}
function renderWarBrowseBar(){
  ensureWarBrowseState();
  var mode=window._warBrowseMode||'list';
  document.querySelectorAll('.war-browse-mode').forEach(function(btn){
    if(btn.classList && btn.classList.add){
      if(btn.getAttribute('data-mode')===mode) btn.classList.add('active');
      else btn.classList.remove('active');
    }
  });
  var yearSel=document.getElementById('war-browse-year');
  if(yearSel){
    var years=warBrowseYears();
    var cur=window._warBrowseYear||0;
    yearSel.innerHTML='<option value="0">همه سال‌ها</option>'+years.map(function(y){
      return '<option value="'+y+'"'+(y===cur?' selected':'')+'>'+y+'</option>';
    }).join('');
    yearSel.value=String(cur||0);
  }
  var crumb=document.getElementById('war-browse-crumb');
  if(crumb){
    var cat=getWarBrowseCatalog();
    var drill=window._warBrowseDrill;
    var html='';
    if(drill && drill.season){
      var s=(cat.seasons||[]).find(function(x){ return x.id===drill.season; });
      html='<button type="button" onclick="warBrowseClearDrill()">← بازگشت به فصل‌ها</button><span>'+(s? (s.symbol+' '+s.nameFa):drill.season)+'</span>';
    }else if(drill && drill.month){
      var mo=(cat.months||[]).find(function(x){ return x.month===drill.month; });
      html='<button type="button" onclick="warBrowseClearDrill()">← بازگشت به ماه‌ها</button><span>'+(mo? (mo.symbol+' '+mo.nameFa):('ماه '+drill.month))+'</span>';
    }
    crumb.innerHTML=html;
  }
}
function renderWarBrowseGallery(){
  var host=document.getElementById('war-browse-gallery');
  if(!host) return;
  var cat=getWarBrowseCatalog();
  var mode=window._warBrowseMode||'season';
  host.className = mode==='month' ? 'war-gallery-month' : 'war-gallery-season';
  if(mode==='month'){
    host.innerHTML=(cat.months||[]).map(function(mo){
      var n=warBrowseCount({season:'', month:mo.month});
      return '<button type="button" class="war-glass-card month season-'+mo.seasonId+'" onclick="openWarBrowseMonth('+mo.month+')">'
        +'<div class="war-glass-symbol">'+mo.symbol+'</div>'
        +'<div class="war-glass-title">'+mo.nameFa+'</div>'
        +'<div class="war-glass-count">'+n+' پرونده</div>'
        +'</button>';
    }).join('');
  }else{
    host.innerHTML=(cat.seasons||[]).map(function(s){
      var n=warBrowseCount({season:s.id, month:0});
      return '<button type="button" class="war-glass-card season-'+s.id+'" onclick="openWarBrowseSeason(\''+s.id+'\')">'
        +'<div class="war-glass-symbol">'+s.symbol+'</div>'
        +'<div class="war-glass-title">'+s.nameFa+'</div>'
        +'<div class="war-glass-motif">'+s.motif+'</div>'
        +'<div class="war-glass-count">'+n+' پرونده</div>'
        +'</button>';
    }).join('');
  }
}

'''

HELP = '''<div class="card help-card help-collapsed">
  <div class="card-title help-toggle" onclick="toggleHelpCard(this)"><span>نمای فصلی، ماهیانه و لیستی پرونده‌ها</span><span class="help-chev">▾</span></div>
  <ul style="font-size:13px;line-height:2.2;color:var(--text);padding-right:20px">
    <li><b>سه نما:</b> بالای فهرست گارانتی سه دکمه شیشه‌ای هست: <b>فصلی</b>، <b>ماهیانه</b> و <b>لیستی</b>.</li>
    <li><b>فصلی:</b> چهار کارت بزرگ وسط صفحه برای بهار (شکوفه)، تابستان (آفتاب)، پاییز (برگ طلایی) و زمستان (برف). هر کارت تعداد پرونده همان فصل را نشان می‌دهد. با کلیک، همان پرونده‌ها به‌صورت لیست باز می‌شوند.</li>
    <li><b>ماهیانه:</b> دوازده کلید شیشه‌ای با نماد و نام ماه شمسی. کلیک روی هر ماه لیست همان ماه را می‌آورد.</li>
    <li><b>لیستی:</b> همان جدول قبلی با جستجو، وضعیت باز/بسته و مرتب‌سازی.</li>
    <li><b>سال:</b> از منوی سال می‌توانید فقط یک سال شمسی را ببینید یا «همه سال‌ها» را نگه دارید.</li>
    <li><b>برگشت:</b> از داخل یک فصل یا ماه، دکمه بازگشت بالای صفحه یا کلید برگشت پنجره شما را به کارت‌های شیشه‌ای برمی‌گرداند.</li>
  </ul>
</div>
'''

def must_replace(src, old, new, label):
    if old not in src:
        raise SystemExit(f"anchor missing: {label}")
    if src.count(old) != 1:
        raise SystemExit(f"anchor not unique ({src.count(old)}): {label}")
    return src.replace(old, new, 1)

# CSS after autosave-dot style
anchor_css = '<style id="autosave-dot-css">'
if anchor_css not in text:
    raise SystemExit('autosave css missing')
text = text.replace(anchor_css, CSS + anchor_css, 1)

text = must_replace(text, WAR_LIST_OLD, WAR_LIST_NEW, 'war-list')

# JS before renderWar
anchor_js = "function renderWar(){\n// رندر لیست گارانتی — با نام مستعار renderWarList برای سازگاری با کدهای قدیمی"
if anchor_js not in text:
    raise SystemExit('renderWar anchor missing')
text = text.replace(anchor_js, JS + anchor_js, 1)

# Filter inside renderWar after existing filters
old_filter = """  let f=warranties.filter(w=>{
    const devs=warDevices(w);
    const models=devs.map(d=>d.model).join(' ');
    const m=!q||(w.name||'').includes(q)||(w.phone||'').includes(q)||models.includes(q)||(w.id||'').includes(q);
    const sm=!sf||(sf==='open'&&w.status!=='closed')||(sf==='closed'&&w.status==='closed');
    return m&&sm;
  });"""
new_filter = """  ensureWarBrowseState();
  renderWarBrowseBar();
  const drilled=!!window._warBrowseDrill;
  const browseMode=window._warBrowseMode||'list';
  const gallery=document.getElementById('war-browse-gallery');
  const tableCard=document.getElementById('war-list-table-card');
  if((browseMode==='season'||browseMode==='month') && !drilled){
    if(gallery){ gallery.style.display='grid'; renderWarBrowseGallery(); }
    if(tableCard) tableCard.style.display='none';
    window._warView=[];
    return;
  }
  if(gallery){ gallery.style.display='none'; gallery.className=''; }
  if(tableCard) tableCard.style.display='block';
  let f=warranties.filter(w=>{
    const devs=warDevices(w);
    const models=devs.map(d=>d.model).join(' ');
    const m=!q||(w.name||'').includes(q)||(w.phone||'').includes(q)||models.includes(q)||(w.id||'').includes(q);
    const sm=!sf||(sf==='open'&&w.status!=='closed')||(sf==='closed'&&w.status==='closed');
    return m&&sm&&warBrowseMatches(w);
  });"""
text = must_replace(text, old_filter, new_filter, 'renderWar filter')

# winBack drill
old_back = """  if(w.pageId==='warranty'){
    var form=document.getElementById('war-form');
    if(form && form.style.display!=='none'){
      showWarList();
      return;
    }
  }"""
new_back = """  if(w.pageId==='warranty'){
    var form=document.getElementById('war-form');
    if(form && form.style.display!=='none'){
      showWarList();
      return;
    }
    if(window._warBrowseDrill){
      warBrowseClearDrill();
      return;
    }
    if((window._warBrowseMode==='season'||window._warBrowseMode==='month')){
      setWarBrowseMode('list');
      return;
    }
  }"""
text = must_replace(text, old_back, new_back, 'winBack')

# context menu
old_ctx = "    warranty:[{id:'warranty-new', icon:'＋', label:'پرونده گارانتی جدید'}],"
new_ctx = "    warranty:[{id:'warranty-new', icon:'＋', label:'پرونده گارانتی جدید'},{id:'warranty-season', icon:'🌸', label:'نمای فصلی پرونده‌ها'},{id:'warranty-month', icon:'🗓', label:'نمای ماهیانه پرونده‌ها'},{id:'warranty-list', icon:'📋', label:'نمای لیستی پرونده‌ها'}],"
text = must_replace(text, old_ctx, new_ctx, 'context actions')

old_run = "    if(action==='warranty-new') return showWarForm();"
new_run = """    if(action==='warranty-new') return showWarForm();
    if(action==='warranty-season') return setWarBrowseMode('season');
    if(action==='warranty-month') return setWarBrowseMode('month');
    if(action==='warranty-list') return setWarBrowseMode('list');"""
text = must_replace(text, old_run, new_run, 'run page action')

# help card after first warranty help card block title
help_anchor = '<div class="help-cat-header">📦 مدیریت کالا و انبار</div>'
text = must_replace(text, help_anchor, HELP + help_anchor, 'help card')

# load hook
old_load = "  try{ startWarrantySlaAlerts(); }catch(_sla){}"
new_load = "  try{ startWarrantySlaAlerts(); }catch(_sla){}\n  try{ applyWarBrowseSkinFromHost(); }catch(_wb){}"
text = must_replace(text, old_load, new_load, 'load hook')

# version bump σ -> τ (but keep historical comments? skill says all version places)
# Do NOT replace minBaseVersion tests that mention σ in comments inside HTML if any.
# Replace the live version markers.
repls = [
    ('<meta name="app-version" content="1405.5.21σ">', '<meta name="app-version" content="1405.5.21τ">'),
    ("var APP_VERSION = '1405.5.21σ';", "var APP_VERSION = '1405.5.21τ';"),
    ("var APP_BASE_VERSION = '1405.5.21σ';", "var APP_BASE_VERSION = '1405.5.21τ';"),
    ("var APP_VERSION_FA = '۱۴۰۵.۵.۲۱σ';", "var APP_VERSION_FA = '۱۴۰۵.۵.۲۱τ';"),
    ("    version: '1405.5.21σ',", "    version: '1405.5.21τ',"),
    ('نسخه ۱۴۰۵.۵.۲۱σ', 'نسخه ۱۴۰۵.۵.۲۱τ'),
    ('v1405.5.21σ', 'v1405.5.21τ'),
    ("content=\"1405.5.21σ\"", "content=\"1405.5.21τ\""),
    ("sw.js?v=1405.5.21σ", "sw.js?v=1405.5.21τ"),
    ("'1405.5.21σ'", "'1405.5.21τ'"),
]
for old, new in repls:
    text = text.replace(old, new)

# leftover version strings that are the current app version
text = text.replace('1405.5.21σ', '1405.5.21τ')
text = text.replace('۱۴۰۵.۵.۲۱σ', '۱۴۰۵.۵.۲۱τ')

HTML.write_text(text, encoding="utf-8")
print("patched", HTML, "bytes", HTML.stat().st_size)
