namespace Sirman.Desktop;

/// <summary>
/// پوستهٔ شیشه‌ای فصلی/ماهیانه برای مرور پرونده‌های گارانتی.
/// منبع ظاهر از دات‌نت است و به WebView2 تزریق می‌شود؛ HTML همان کاتالوگ را به‌عنوان پشتیبان دارد.
/// </summary>
public static class SeasonalGlassTheme
{
    public const string StyleElementId = "war-browse-skin-css";

    public static string CatalogJson() => """
{
  "source": "dotnet",
  "seasons": [
    {"id":"spring","nameFa":"بهار","symbol":"🌸","motif":"شکوفه","months":[1,2,3],"from":"#fff1f2","to":"#d1fae5","accent":"#fb7185"},
    {"id":"summer","nameFa":"تابستان","symbol":"☀️","motif":"آفتاب","months":[4,5,6],"from":"#fff7ed","to":"#fde68a","accent":"#f59e0b"},
    {"id":"autumn","nameFa":"پاییز","symbol":"🍂","motif":"برگ طلایی","months":[7,8,9],"from":"#fff7ed","to":"#fdba74","accent":"#ea580c"},
    {"id":"winter","nameFa":"زمستان","symbol":"❄️","motif":"برف","months":[10,11,12],"from":"#eff6ff","to":"#e0e7ff","accent":"#3b82f6"}
  ],
  "months": [
    {"month":1,"nameFa":"فروردین","symbol":"🌸","seasonId":"spring"},
    {"month":2,"nameFa":"اردیبهشت","symbol":"🌷","seasonId":"spring"},
    {"month":3,"nameFa":"خرداد","symbol":"🌿","seasonId":"spring"},
    {"month":4,"nameFa":"تیر","symbol":"☀️","seasonId":"summer"},
    {"month":5,"nameFa":"مرداد","symbol":"🔥","seasonId":"summer"},
    {"month":6,"nameFa":"شهریور","symbol":"🌾","seasonId":"summer"},
    {"month":7,"nameFa":"مهر","symbol":"🍂","seasonId":"autumn"},
    {"month":8,"nameFa":"آبان","symbol":"🍁","seasonId":"autumn"},
    {"month":9,"nameFa":"آذر","symbol":"🌧️","seasonId":"autumn"},
    {"month":10,"nameFa":"دی","symbol":"❄️","seasonId":"winter"},
    {"month":11,"nameFa":"بهمن","symbol":"⛄","seasonId":"winter"},
    {"month":12,"nameFa":"اسفند","symbol":"🌱","seasonId":"winter"}
  ]
}
""";

    public static string Css() => """
/* پوسته شیشه‌ای مرور گارانتی — منبع دات‌نت (SeasonalGlassTheme) */
.war-browse-bar{display:flex;flex-wrap:wrap;align-items:center;gap:10px;margin-bottom:14px;justify-content:center}
.war-browse-modes{display:inline-flex;gap:6px;padding:5px;border-radius:16px;background:rgba(255,255,255,.28);border:1px solid rgba(255,255,255,.45);backdrop-filter:blur(18px) saturate(160%);-webkit-backdrop-filter:blur(18px) saturate(160%);box-shadow:0 8px 28px rgba(15,40,55,.08)}
.war-browse-mode{border:0;background:transparent;color:var(--text);font-family:var(--font);font-size:13px;font-weight:800;padding:8px 16px;border-radius:12px;cursor:pointer}
.war-browse-mode.active{background:rgba(255,255,255,.72);box-shadow:0 4px 14px rgba(15,40,55,.12);color:var(--blue2)}
.war-browse-crumb{font-size:12px;color:var(--text2);display:flex;gap:6px;align-items:center;flex-wrap:wrap}
.war-browse-crumb button{border:0;background:transparent;color:var(--blue2);font-weight:800;cursor:pointer;font-family:var(--font);font-size:12px}
.war-year-dd{position:relative;z-index:30}
.war-year-dd-btn{min-width:148px;padding:8px 14px;border-radius:12px;border:1px solid rgba(255,255,255,.58);background:linear-gradient(180deg,rgba(255,255,255,.72),rgba(255,255,255,.40));box-shadow:0 8px 22px rgba(15,40,55,.10), inset 0 1px 0 rgba(255,255,255,.85);font-family:var(--font);font-size:12px;font-weight:800;color:var(--text);display:inline-flex;align-items:center;justify-content:space-between;gap:12px;cursor:pointer}
.war-year-dd-btn:hover{box-shadow:0 10px 24px rgba(15,40,55,.14), inset 0 1px 0 rgba(255,255,255,.95)}
.war-year-dd-chev{opacity:.7;font-size:11px}
.war-year-dd.open .war-year-dd-chev{transform:rotate(180deg)}
.war-year-dd-menu{position:fixed;z-index:1200;min-width:148px;max-height:260px;overflow:auto;padding:6px;border-radius:14px;border:1px solid rgba(255,255,255,.62);background:linear-gradient(180deg,rgba(255,255,255,.96),rgba(248,252,255,.92));box-shadow:0 18px 40px rgba(20,40,70,.20);direction:rtl}
.war-year-dd-item{display:block;width:100%;text-align:right;border:0;background:transparent;padding:8px 10px;border-radius:10px;font-family:var(--font);font-size:12px;font-weight:700;color:var(--text);cursor:pointer}
.war-year-dd-item:hover,.war-year-dd-item.active{background:rgba(11,79,108,.10);color:var(--blue2)}
#war-browse-year{position:absolute;width:1px;height:1px;opacity:0;pointer-events:none}
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
body.theme-dark .war-browse-modes,body.theme-dark .war-glass-card,body.theme-dark .war-year-dd-btn,body.theme-dark .war-year-dd-menu{color:#e8eef5;border-color:rgba(255,255,255,.16)}
body.theme-dark .war-year-dd-btn,body.theme-dark .war-year-dd-menu{background:linear-gradient(180deg,rgba(30,48,64,.94),rgba(18,32,44,.90))}
body.theme-dark .war-year-dd-item:hover,body.theme-dark .war-year-dd-item.active{background:rgba(96,205,255,.16);color:#fff}
body.theme-dark .war-browse-mode.active{background:rgba(30,48,64,.72);color:#fff}
body.theme-dark .war-glass-count{background:rgba(8,16,28,.35);color:#e8eef5}
""";
}
