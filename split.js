// Laegh Project — Split Script (ماژولار)
// فایل نهایی Laegh_Final_10.4.16.html را به پارتیشن‌های منطقی مستقل تقسیم می‌کند.
// هر پارتیشن یک واحد قابل‌ویرایش است (CSS، یک صفحه، یا یک ماژول JS).
// build.js دوباره همه را به یک فایل واحد بایت‌به‌بایت یکسان می‌چسباند.
//
// نحوه اجرا:
//   node split.js                          → فایل پیش‌فرض Laegh_Final_10.4.16.html
//   node split.js path/to/file.html        → فایل دلخواه
//
// اصل فنی حیاتی: چون توابع و globals در هم تنیده‌اند، جابجایی کد ممنوع است.
// تقسیم = بازه‌های خطی متوالی که کل فایل را بدون شکاف/هم‌پوشانی می‌پوشانند.
// مرزها روی anchor‌های طبیعی (شروع page div، شروع تابع) تنظیم شده‌اند.

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const SOURCE_FILE = process.argv[2] || 'Laegh_Final_10.4.16.html';
const OUT_DIR = path.join(ROOT, 'codes.10.4.6');
const sourcePath = path.join(ROOT, SOURCE_FILE);

// ───────────────────────────────────────────────────────────────────────
// ماتریس پارتیشن‌ها: نام فایل → بازه‌ی خطی [start, end] (۱-based، شامل هر دو سر)
// مهم: بازه‌ها باید پیوسته و بدون شکاف/هم‌پوشانی باشند و کل فایل را بپوشانند.
// split.js این را اعتبارسنجی می‌کند.
// ───────────────────────────────────────────────────────────────────────
// نام هر پارتیشن با پیشوند دو-رقمی «ترتیب مطلق» شروع می‌شود (00..30).
// این کار باعث می‌شود مرتب‌سازی لغویِ ساده (sort) دقیقاً ترتیب منطقی را بدهد،
// بدون نیاز به تکرار ماتریس در build.js.
// الگو: <order>_<layer>_<name>.<ext>
//   order: 00..30 برای ترتیب مطلق در فایل نهایی
//   layer: H(HTML) / J(JS) — فقط برای خوانایی انسانی
const PARTITIONS = [
  // ── HTML — لایه‌ی نمایش (۱۴ پارتیشن) ──
  ['00H_head_css.html',        1,    554],
  ['01H_shell_sidebar.html',   555,  803],
  ['02H_page_invoice.html',    804,  922],
  ['03H_page_inventory.html',  923,  1041],
  ['04H_page_contacts.html',   1042, 1111],
  ['05H_page_parts_svcs.html', 1112, 1165],
  ['06H_page_sales.html',      1166, 1308],
  ['07H_page_accounts.html',   1309, 1404],
  ['08H_page_warranty.html',   1405, 1618],
  ['09H_page_dataio.html',     1619, 1723],
  ['10H_page_settings.html',   1724, 2296],
  ['11H_page_tasks.html',      2297, 2461],
  ['12H_page_help.html',       2462, 2840],
  ['13H_modals.html',          2841, 3274],

  // ── JS — لایه‌ی منطق (۱۷ پارتیشن) ──
  ['14J_core.js',              3275, 4505],  // state, Event Bus, globalSearch, 360°, dashboard, _buildFullBackupData
  ['15J_invoice.js',           4506, 4845],  // closeInv کسر انبار + _applyStockMovement hook
  ['16J_products_inv.js',      4846, 4964],
  ['17J_phonebook.js',         4965, 5299],
  ['18J_dataio.js',            5300, 5852],  // SCHEMAS, diff, selective, migrateBackup (additive)
  ['19J_tasks.js',             5853, 6228],
  ['20J_auth.js',              6229, 6456],  // warehouseDocs/stockMoves + warehouse در ALL_PAGES
  ['21J_parts_svcs.js',        6457, 6619],
  ['22J_defective_audit.js',   6620, 7164],  // حواله‌های انبار + انبارگردانی + حرکت‌ها
  ['23J_calendar_help.js',     7165, 7274],
  ['24J_warranty.js',          7275, 7708],  // addWDev est/svc + closeWar واریز
  ['25J_sales.js',             7709, 8433],  // _deductStock hook _applyStockMovement
  ['26J_accounts.js',          8434, 9125],
  ['27J_settings.js',          9126, 9484],
  ['28J_debug_ai.js',          9485, 9934],
  ['29J_excel_import.js',      9935, 10241],
  ['30J_init.js',              10242, 10258],
];

// ───────────────────────────────────────────────────────────────────────
// اعتبارسنجی ماتریس: بازه‌ها باید پیوسته، بدون شکاف و هم‌پوشانی باشند.
// ───────────────────────────────────────────────────────────────────────
function validatePartitions(totalLines) {
  if (PARTITIONS.length === 0) {
    throw new Error('❌ ماتریس پارتیشن‌ها خالی است');
  }
  let expectedStart = 1;
  for (let i = 0; i < PARTITIONS.length; i++) {
    const [name, start, end] = PARTITIONS[i];
    if (!Number.isInteger(start) || !Number.isInteger(end)) {
      throw new Error(`❌ پارتیشن «${name}»: start/end باید عدد صحیح باشند`);
    }
    if (start < 1 || end < start) {
      throw new Error(`❌ پارتیشن «${name}»: بازه‌ی نامعتبر [${start}, ${end}]`);
    }
    if (start !== expectedStart) {
      const gapType = start > expectedStart ? 'شکاف' : 'هم‌پوشانی';
      throw new Error(
        `❌ ${gapType} در خط ${expectedStart}: پارتیشن «${name}» از خط ${start} شروع شده ` +
        `در حالی که باید از ${expectedStart} شروع می‌شد (پارتیشن قبلی تا ${expectedStart - 1}).`
      );
    }
    if (end > totalLines) {
      throw new Error(
        `❌ پارتیشن «${name}»: خط پایان ${end} از کل خطوط فایل (${totalLines}) بیشتر است`
      );
    }
    expectedStart = end + 1;
  }
  // پارتیشن آخر باید دقیقاً تا خط آخر برسد
  if (expectedStart !== totalLines + 1) {
    throw new Error(
      `❌ بازه‌ها کل فایل را نمی‌پوشانند: تا خط ${expectedStart - 1} رفته‌ایم ولی فایل ${totalLines} خط دارد. ` +
      `${totalLines + 1 - expectedStart} خط آخر بدون پارتیشن مانده‌اند.`
    );
  }
}

// ───────────────────────────────────────────────────────────────────────
// تابع اصلی split
// ───────────────────────────────────────────────────────────────────────
function split() {
  if (!fs.existsSync(sourcePath)) {
    console.error(`❌ فایل منبع پیدا نشد: ${sourcePath}`);
    process.exit(1);
  }

  // خواندن فایل به‌صورت UTF-8 (بدون BOM، newlineها دست‌نخورده)
  const content = fs.readFileSync(sourcePath, 'utf-8');
  const lines = content.split('\n');
  const totalLines = lines.length;

  console.log(`📂 منبع: ${SOURCE_FILE}`);
  console.log(`   ${totalLines} خط، ${(Buffer.byteLength(content, 'utf-8') / 1024).toFixed(1)} KB\n`);

  // اعتبارسنجی پیوستگی بازه‌ها
  validatePartitions(totalLines);
  console.log('✅ اعتبارسنجی: بازه‌ها پیوسته و بدون شکاف/هم‌پوشانی هستند.\n');

  // آماده‌سازی پوشه‌ی خروجی
  if (!fs.existsSync(OUT_DIR)) {
    fs.mkdirSync(OUT_DIR, { recursive: true });
  }

  // نوشتن هر پارتیشن
  console.log('✂️  تقسیم به پارتیشن‌ها:');
  let writtenBytes = 0;
  for (const [name, start, end] of PARTITIONS) {
    // lines شاخص‌گذاری 0-based است؛ بازه [start, end] به [start-1, end) تبدیل می‌شود
    const slice = lines.slice(start - 1, end);
    const partContent = slice.join('\n');
    const outPath = path.join(OUT_DIR, name);
    fs.writeFileSync(outPath, partContent, 'utf-8');
    writtenBytes += Buffer.byteLength(partContent, 'utf-8');
    console.log(`   ✅ ${name.padEnd(26)} خط ${String(start).padStart(4)}–${String(end).padStart(4)}  (${(end - start + 1)} خط, ${(Buffer.byteLength(partContent, 'utf-8') / 1024).toFixed(1)} KB)`);
  }

  console.log(`\n📦 Split کامل: ${PARTITIONS.length} پارتیشن در ${path.relative(ROOT, OUT_DIR)}/`);
  console.log(`\n💡 برای بازسازی: node build.js`);
}

split();
