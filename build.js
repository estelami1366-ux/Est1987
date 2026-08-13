// Laegh Project — Build Script (ماژولار)
// پارتیشن‌های منطقی codes.10.4.6/ را به ترتیب نام (00_ → 99_) می‌خواند و به هم می‌چسباند
// تا فایل نهایی Laegh_Final.html ساخته شود.
//
// نحوه اجرا:
//   node build.js                              → build + تأیید خودکار byte-identical
//   node build.js path/to/output.html          → نام فایل خروجی دلخواه
//   node build.js path/to/output.html --no-verify  → بدون تأیید byte-identical
//
// قانون پروژه (قانون ۳): خروجی نهایی یک فایل HTML تک‌تکه است.
// این اسکریپت تضمین می‌کند خروجی دقیقاً همان بایت‌های فایل منبع را دارد.

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const SRC_DIR = path.join(ROOT, 'codes.10.4.6');
const DEFAULT_OUTPUT = 'Laegh_Final.html';
// فایل مرجع برای مقایسه‌ی byte-identical (اگر موجود باشد)
const REFERENCE_FILE = 'Laegh_Final_10.4.16.html';

// الگوی نام‌گذاری پارتیشن: <order:2digit><layer:H|J|K>_<name>.<ext>
// layer: H = HTML، J = JavaScript اصلی، K = JavaScript افزونه (مثل ماژول‌های جدید که به state تعریف‌شده در J وابسته‌اند)
// مثال: 00H_head_css.html ، 14J_core.js ، 22K_warehouses.js
// order (دو رقم اول) ترتیب مطلق پارتیشن در فایل نهایی را تعیین می‌کند.
// مرتب‌سازی لغویِ ساده همین ترتیب را می‌دهد (چون همه دو-رقمی‌اند).
const VALID_PATTERN = /^\d{2}[HJK]_.+\.(html|js)$/i;

function build() {
  if (!fs.existsSync(SRC_DIR)) {
    console.error(`❌ پوشه‌ی منبع پیدا نشد: ${SRC_DIR}`);
    process.exit(1);
  }

  // یافتن همه‌ی فایل‌های پارتیشن معتبر
  const allFiles = fs.readdirSync(SRC_DIR);
  const files = allFiles
    .filter(f => VALID_PATTERN.test(f))
    .sort(); // مرتب‌سازی لغوی → ترتیب 00_, 10_, 20_, ... 99_ تضمین می‌شود

  if (files.length === 0) {
    console.error(`❌ هیچ فایل پارتیشن معتبری در ${SRC_DIR} پیدا نشد.`);
    console.error(`   الگوی مجاز: ${VALID_PATTERN}`);
    console.error(`   ابتدا اجرا کنید: node split.js`);
    process.exit(1);
  }

  // هشدار اگر فایل‌هایی هستن که الگو را نمی‌خورن (احتمالاً زباله)
  const ignored = allFiles.filter(f => !VALID_PATTERN.test(f) && /\.(html|js|txt)$/i.test(f));
  if (ignored.length > 0) {
    console.warn(`⚠️  این فایل‌ها نادیده گرفته شدند (الگوی نام‌گذاری را رعایت نکردند):`);
    ignored.forEach(f => console.warn(`     - ${f}`));
    console.warn('');
  }

  console.log(`🔍 پوشه‌ی منبع: ${path.relative(ROOT, SRC_DIR)}/`);
  console.log(`   ${files.length} پارتیشن معتبر پیدا شد.\n`);

  // خواندن و چسباندن پارتیشن‌ها
  // مهم برای byte-identical: پارتیشن‌ها با '\n' از هم جدا می‌شوند چون split.js
  // همین‌طور خطوط را جدا کرده بود. آخرین پارتیشن به‌طور طبیعی شامل خط آخر فایل است
  // که با '\n' ختم می‌شود (خط خالی پایانی فایل منبع).
  const parts = [];
  let totalLines = 0;
  let totalBytes = 0;

  console.log('📦 چسباندن پارتیشن‌ها:');
  for (const f of files) {
    const filePath = path.join(SRC_DIR, f);
    const content = fs.readFileSync(filePath, 'utf-8');
    parts.push(content);
    const lines = content.split('\n').length;
    const bytes = Buffer.byteLength(content, 'utf-8');
    totalLines += lines;
    totalBytes += bytes;
    console.log(`   ✅ ${f.padEnd(26)} ${String(lines).padStart(5)} خط  ${(bytes / 1024).toFixed(1).padStart(8)} KB`);
  }

  // چسباندن: بین هر دو پارتیشن یک '\n' (مرز خطی که split جدا کرده بود).
  // نکته: split.js محتوای هر پارتیشن را با join('\n') خطوطش ساخته بود، یعنی
  // پارتیشن هیچ '\n' پایانی ندارد. پس برای بازسازی فایل، بین پارتیشن‌ها '\n' می‌گذاریم.
  const combined = parts.join('\n');

  // تعیین فایل خروجی
  const args = process.argv.slice(2).filter(a => a !== '--no-verify');
  const outputFile = args[0] || DEFAULT_OUTPUT;
  const skipVerify = process.argv.includes('--no-verify');

  const outputPath = path.join(ROOT, outputFile);
  fs.writeFileSync(outputPath, combined, 'utf-8');

  const outBytes = Buffer.byteLength(combined, 'utf-8');
  console.log(`\n📦 Build کامل: ${outputFile}`);
  console.log(`   ${files.length} پارتیشن، ~${totalLines} خط، ${(outBytes / 1024).toFixed(1)} KB`);

  // ─────────────────────────────────────────────────────────────────────
  // تأیید خودکار byte-identical با فایل مرجع (اگر موجود باشد)
  // ─────────────────────────────────────────────────────────────────────
  const referencePath = path.join(ROOT, REFERENCE_FILE);
  if (skipVerify) {
    console.log(`\n⏭️  تأیید byte-identical نادیده گرفته شد (--no-verify).`);
    return;
  }
  if (!fs.existsSync(referencePath)) {
    console.log(`\nℹ️  فایل مرجع «${REFERENCE_FILE}» پیدا نشد — تأیید byte-identical انجام نشد.`);
    console.log(`    این طبیعی است اگر نسخه‌ی مرجع را هنوز نساخته‌اید.`);
    return;
  }

  const reference = fs.readFileSync(referencePath, 'utf-8');
  if (combined === reference) {
    console.log(`\n✅ تأیید byte-identical: خروجی build دقیقاً با «${REFERENCE_FILE}» یکسان است.`);
    console.log(`   ${outBytes} bytes === ${Buffer.byteLength(reference, 'utf-8')} bytes  (صفر تفاوت)`);
  } else {
    // پیدا کردن اولین تفاوت
    const refLines = reference.split('\n');
    const outLines = combined.split('\n');
    console.error(`\n❌ خطای حیاتی: خروجی build با «${REFERENCE_FILE}» یکسان نیست!`);
    console.error(`   خروجی: ${outLines.length} خط، ${outBytes} bytes`);
    console.error(`   مرجع:  ${refLines.length} خط، ${Buffer.byteLength(reference, 'utf-8')} bytes`);
    let firstDiff = -1;
    const maxLen = Math.max(refLines.length, outLines.length);
    for (let i = 0; i < maxLen; i++) {
      if (refLines[i] !== outLines[i]) {
        firstDiff = i + 1;
        break;
      }
    }
    if (firstDiff > 0) {
      console.error(`   اولین تفاوت در خط ${firstDiff}:`);
      console.error(`     خروجی: ${JSON.stringify(outLines[firstDiff - 1] || '(خط نهایی)').slice(0, 80)}`);
      console.error(`     مرجع:  ${JSON.stringify(refLines[firstDiff - 1] || '(خط نهایی)').slice(0, 80)}`);
    }
    console.error(`\n   ⚠️  این یعنی split یا ویرایش پارتیشن، چیزی را خراب کرده است.`);
    console.error(`   قبل از تحویل، این را رفع کنید.`);
    process.exit(1);
  }
}

build();
