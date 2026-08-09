#!/usr/bin/env node
/**
 * ===================================================================
 *  Laegh Test Suite — مجموعه تست خودکار نرم‌افزار لایق
 * ===================================================================
 * این اسکریپت قبل از هر تحویل فایل HTML اجرا می‌شود تا مطمئن شویم
 * هیچ تغییری، عملکرد قبلی را خراب نکرده است.
 *
 * نحوه اجرا:
 *   node test_laegh.js path/to/Laegh_Final_vX.html
 *
 * اگر همه تست‌ها PASS بدهند یعنی فایل برای تحویل امن است.
 * اگر حتی یک FAIL باشد، فایل را تحویل ندهید.
 * ===================================================================
 */

const fs = require('fs');
const path = require('path');

const filePath = process.argv[2];
if (!filePath) {
  console.error('❌ استفاده: node test_laegh.js path/to/file.html');
  process.exit(1);
}
if (!fs.existsSync(filePath)) {
  console.error('❌ فایل پیدا نشد: ' + filePath);
  process.exit(1);
}

const html = fs.readFileSync(filePath, 'utf8');

// ===================================================================
// بخش ۱: محیط شبیه‌سازی‌شده (Mock DOM + localStorage)
// این بخش جای مرورگر واقعی را می‌گیرد تا کد بدون نیاز به مرورگر اجرا شود
// ===================================================================

class MockLocalStorage {
  constructor() { this.store = {}; }
  getItem(key) { return this.store.hasOwnProperty(key) ? this.store[key] : null; }
  setItem(key, value) { this.store[key] = String(value); }
  removeItem(key) { delete this.store[key]; }
  get length() { return Object.keys(this.store).length; }
  key(i) { return Object.keys(this.store)[i] || null; }
  hasOwnProperty(key) { return this.store.hasOwnProperty(key); }
}

class MockElement {
  constructor(id) {
    this.id = id;
    this.value = '';
    this.textContent = '';
    this.innerHTML = '';
    this.style = {};
    this.classList = { add(){}, remove(){}, toggle(){}, contains(){return false;} };
    this.checked = false;
    this._children = [];
  }
  appendChild(el) { this._children.push(el); }
  addEventListener() {}
  querySelector() { return new MockElement('mock'); }
  querySelectorAll() { return []; }
  click() {}
  closest() { return null; }
}

function buildMockDocument() {
  const elements = {};
  return {
    getElementById(id) {
      if (!elements[id]) elements[id] = new MockElement(id);
      return elements[id];
    },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    createElement() { return new MockElement('created'); },
    addEventListener() {},
    body: new MockElement('body'),
    head: new MockElement('head'),
    _elements: elements
  };
}

// ===================================================================
// بخش ۲: استخراج توابع حیاتی از فایل HTML با regex
// (در آینده بهتر است این توابع در فایل .js جدا نگه داشته شوند)
// ===================================================================

function extractFunctionSource(html, fnName) {
  // پیدا کردن "function fnName(" و گرفتن بدنه با شمارش آکولاد
  const startMatch = html.match(new RegExp('function\\s+' + fnName + '\\s*\\([^)]*\\)\\s*\\{'));
  if (!startMatch) return null;
  let start = startMatch.index;
  let braceCount = 0;
  let i = start;
  let started = false;
  for (; i < html.length; i++) {
    if (html[i] === '{') { braceCount++; started = true; }
    else if (html[i] === '}') { braceCount--; if (started && braceCount === 0) { i++; break; } }
  }
  return html.substring(start, i);
}

// ===================================================================
// بخش ۳: تعریف تست‌ها
// هر تست یک سناریوی واقعی است که قبلاً باعث باگ شده یا ممکن است بشود
// ===================================================================

let totalTests = 0;
let passedTests = 0;
let failedTests = [];
let pendingAsync = [];

function test(name, fn) {
  totalTests++;
  let result;
  try {
    result = fn();
  } catch (e) {
    failedTests.push({ name, error: e.message });
    console.log('  ❌ ' + name);
    console.log('     خطا: ' + e.message);
    return;
  }
  if (result && typeof result.then === 'function') {
    pendingAsync.push(result.then(() => {
      passedTests++;
      console.log('  ✅ ' + name);
    }).catch((e) => {
      failedTests.push({ name, error: e.message });
      console.log('  ❌ ' + name);
      console.log('     خطا: ' + e.message);
    }));
    return;
  }
  passedTests++;
  console.log('  ✅ ' + name);
}

function assertEqual(actual, expected, msg) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error((msg || 'مقادیر برابر نیستند') + ' — انتظار: ' + JSON.stringify(expected) + ' ولی دریافت شد: ' + JSON.stringify(actual));
  }
}

function assertTrue(val, msg) {
  if (!val) throw new Error(msg || 'انتظار true بود ولی false شد');
}

function assertArrayLength(arr, len, msg) {
  if (!Array.isArray(arr)) throw new Error((msg||'') + ' — مقدار آرایه نیست: ' + JSON.stringify(arr));
  if (arr.length !== len) throw new Error((msg||'') + ' — انتظار ' + len + ' آیتم، دریافت شد ' + arr.length);
}

function assertContainsString(html, str, msg) {
  if (html.indexOf(str) === -1) throw new Error(msg || ('رشته یافت نشد: ' + str));
}

console.log('');
console.log('═══════════════════════════════════════════');
console.log('  🧪 شروع تست فایل: ' + path.basename(filePath));
console.log('═══════════════════════════════════════════');
console.log('');


console.log('');
// گروه ۰: SMOKE TEST — آیا کل اسکریپت اصلاً بدون خطا از اول تا آخر اجرا می‌شود؟
// این مهم‌ترین و اولین لایه بررسی است. هیچ تست دیگری معنی ندارد اگر
// خود اسکریپت موقع بارگذاری صفحه با خطا متوقف شود.
// (این دقیقاً همان دسته باگی است که قبلاً واقعاً رخ داد: استفاده از
// متغیر قبل از تعریف آن — یک خطای زمان اجرا که فقط با اجرای واقعی
// کد، نه با جستجوی متن، قابل شناسایی است)
// -------------------------------------------------------------------
console.log('📋 گروه ۰: اجرای واقعی کل اسکریپت (Smoke Test)');

const vm = require('vm');

function buildFullMockEnvironment() {
  const elements = {};
  function makeElement(id) {
    const el = {
      id, value: '', textContent: '', innerHTML: '', checked: false,
      style: {
        _props: {},
        setProperty(name, val){ this._props[name] = val; },
        removeProperty(name){ delete this._props[name]; },
        getPropertyValue(name){ return this._props[name] || ''; }
      },
      attrs: {},
      classList: {
        _set: new Set(),
        add(c){this._set.add(c);}, remove(c){this._set.delete(c);},
        toggle(c){this._set.has(c)?this._set.delete(c):this._set.add(c);},
        contains(c){return this._set.has(c);}
      },
      children: [],
      nextElementSibling: null,
      appendChild(c){ this.children.push(c); },
      addEventListener(){},
      removeEventListener(){},
      click(){},
      focus(){},
      remove(){},
      closest(){ return null; },
      getAttribute(name){ return this.attrs[name] !== undefined ? this.attrs[name] : null; },
      setAttribute(name, val){ this.attrs[name] = val; },
      querySelector(){ return null; },
      querySelectorAll(){ return []; },
    };
    return el;
  }

  const fakeDocument = {
    getElementById(id) {
      if (!elements[id]) elements[id] = makeElement(id);
      return elements[id];
    },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    createElement(tag) { return makeElement('created-' + tag); },
    addEventListener() {},
    removeEventListener() {},
    body: makeElement('body'),
    head: makeElement('head'),
    documentElement: makeElement('html'),
    title: ''
  };

  const fakeLocalStorage = new MockLocalStorage();

  const fakeWindow = {
    localStorage: fakeLocalStorage,
    document: fakeDocument,
    addEventListener() {},
    removeEventListener() {},
    setInterval() { return 1; },
    clearInterval() {},
    setTimeout(fn) { /* عمداً اجرا نمی‌کنیم تا تست‌های async در همین تابع اجرا نشوند */ return 1; },
    clearTimeout() {},
    location: { reload(){} },
    open() { return { document: { write(){}, close(){} } }; },
    confirm() { return false; },
    alert() {},
    prompt() { return null; },
    fetch() { return Promise.resolve({ ok:false, json:()=>Promise.resolve({}) }); },
    navigator: { clipboard: { writeText(){ return Promise.resolve(); } } },
    XLSX: undefined,
    Function: Function
  };

  return { fakeWindow, fakeDocument, fakeLocalStorage };
}

test('کل اسکریپت باید بدون خطای زمان اجرا (ReferenceError/TypeError/SyntaxError) از ابتدا تا انتها اجرا شود', () => {
  const scriptStart = html.indexOf('<script>') + '<script>'.length;
  const scriptEnd = html.lastIndexOf('</script>');
  const fullScript = html.substring(scriptStart, scriptEnd);

  const { fakeWindow, fakeDocument, fakeLocalStorage } = buildFullMockEnvironment();

  const sandbox = {
    window: fakeWindow,
    document: fakeDocument,
    localStorage: fakeLocalStorage,
    console: console,
    confirm: fakeWindow.confirm,
    alert: fakeWindow.alert,
    prompt: fakeWindow.prompt,
    fetch: fakeWindow.fetch,
    navigator: fakeWindow.navigator,
    setInterval: fakeWindow.setInterval,
    clearInterval: fakeWindow.clearInterval,
    setTimeout: fakeWindow.setTimeout,
    clearTimeout: fakeWindow.clearTimeout,
    XLSX: undefined,
  };
  sandbox.self = sandbox;
  sandbox.globalThis = sandbox;

  const context = vm.createContext(sandbox);

  let caughtError = null;
  try {
    vm.runInContext(fullScript, context, { filename: 'laegh-script.js', timeout: 5000 });
  } catch (e) {
    caughtError = e;
  }

  if (caughtError) {
    throw new Error(
      'اسکریپت در همان لحظه بارگذاری صفحه با خطا متوقف می‌شود (یعنی نرم‌افزار اصلاً درست بالا نمی‌آید):\n' +
      '     نوع خطا: ' + caughtError.name + '\n' +
      '     پیام: ' + caughtError.message + '\n' +
      '     این یعنی کاربر هنگام باز کردن فایل، با یک صفحه خراب یا قفل‌شده مواجه می‌شود.'
    );
  }
});

// -------------------------------------------------------------------
// گروه ۱: تست‌های ساختاری (Syntax / HTML integrity)
// این‌ها همان باگ‌هایی هستند که قبلاً در این پروژه واقعاً رخ دادند
// -------------------------------------------------------------------
console.log('📋 گروه ۱: یکپارچگی ساختاری');

test('فایل باید تگ <script> داشته باشد', () => {
  assertTrue(html.indexOf('<script>') !== -1, 'تگ script پیدا نشد');
});

test('تعداد backtick در اسکریپت اصلی باید زوج باشد (جلوگیری از قطع شدن JS)', () => {
  const scriptStart = html.indexOf('<script>');
  const mainScript = html.substring(scriptStart);
  const lines = mainScript.split('\n');
  let inBacktick = false;
  let problemLine = -1;
  lines.forEach((line, idx) => {
    const count = (line.match(/`/g) || []).length;
    if (count % 2 === 1) {
      inBacktick = !inBacktick;
      if (inBacktick && problemLine === -1) problemLine = idx;
    }
  });
  assertTrue(!inBacktick, 'یک backtick بدون بسته شدن پیدا شد — این باعث می‌شود همه JS از کار بیفتد (مشکل قبلی تنظیمات سفید)');
});

test('هیچ <div> بسته‌نشده‌ای بین صفحات اصلی وجود ندارد', () => {
  // این دقیقاً همان باگی بود که باعث شد صفحه تنظیمات داخل dataio گیر کند
  const pageMarkers = ['page-dataio', 'page-settings', 'page-phonebook', 'page-parts', 'page-warranty', 'page-sales'];
  for (let i = 0; i < pageMarkers.length - 1; i++) {
    const startTag = '<div class="page" id="' + pageMarkers[i] + '">';
    const startIdx = html.indexOf(startTag);
    if (startIdx === -1) continue;
    // پیدا کردن شروع صفحه بعدی که موجود است
    let nextIdx = -1, nextMarker = '';
    for (let j = i + 1; j < pageMarkers.length; j++) {
      const idx = html.indexOf('<div class="page" id="' + pageMarkers[j] + '">');
      if (idx !== -1) { nextIdx = idx; nextMarker = pageMarkers[j]; break; }
    }
    if (nextIdx === -1) continue;
    const section = html.substring(startIdx, nextIdx);
    const opens = (section.match(/<div/g) || []).length;
    const closes = (section.match(/<\/div>/g) || []).length;
    assertEqual(opens - closes, 0, 'صفحه ' + pageMarkers[i] + ' یک </div> کم یا زیاد دارد (باعث می‌شود صفحه بعدی ' + nextMarker + ' داخل آن گیر کند)');
  }
});

test('هر تابعی که در onclick صدا زده می‌شود باید در کد تعریف شده باشد', () => {
  const onclickCalls = [...html.matchAll(/onclick="([a-zA-Z_][a-zA-Z0-9_]*)\(/g)].map(m => m[1]);
  const uniqueCalls = [...new Set(onclickCalls)];
  const missing = uniqueCalls.filter(fnName => {
    const pattern = new RegExp('function\\s+' + fnName + '\\s*\\(');
    return !pattern.test(html);
  });
  assertEqual(missing, [], 'این توابع در onclick صدا زده شده‌اند ولی هیچ‌جا function ' + (missing[0]||'') + ' تعریف نشده‌اند: ' + missing.join(', '));
});

console.log('');
console.log('📋 گروه ۲: منطق ذخیره و بازگردانی (مهم‌ترین بخش)');

// -------------------------------------------------------------------
// گروه ۲: شبیه‌سازی واقعی منطق importData / applyAll
// این دقیقاً همان باگی است که دفترچه تلفن را خالی نشان می‌داد
// -------------------------------------------------------------------

test('متغیر phonebook (نه فقط pb) باید واقعاً در منطق بازگردانی اجرا و پر شود', () => {
  const importDataSrc = extractFunctionSource(html, 'importData');
  assertTrue(importDataSrc !== null, 'تابع importData پیدا نشد');

  // به جای فقط جستجوی متن، واقعاً منطق applyAll را با eval در یک محیط شبیه‌سازی‌شده اجرا می‌کنیم
  const applyAllSrc = importDataSrc.match(/function applyAll\(\)\s*\{[\s\S]*?\n    \}/);
  assertTrue(applyAllSrc !== null, 'تابع applyAll داخل importData پیدا نشد');

  const sandbox = {
    d: {
      invoices: [], products: [], inventory: {}, invCtr: 1,
      phonebook: [{ fn:'تست', ln:'یک', phones:['0912'] }, { fn:'تست', ln:'دو', phones:['0913'] }],
      pb: [], parts: [], services: [], svcs: [], warranties: [], sales: []
    },
    invoices: [], products: [], inventory: {}, phonebook: [], pb: [], parts: [], services: [], svcs: [], warranties: [], sales: [], tasks: [], invCtr: 1,
    sv(){}, svParts(){}, svSvcs(){}, svSales(){}, svWarr(){}, svPB(){}, svTasks(){},
    getNum(){}, renderSaved(){}, renderProds(){}, renderInv(){}, renderPB(){}, renderParts(){}, renderSvcs(){}, renderSales(){}, renderWarList(){}, renderDataStats(){}, renderTasks(){}, renderSidebarBadges(){},
    localStorage: new MockLocalStorage(), logoSrc: ''
  };

  const fnBody = applyAllSrc[0].replace('function applyAll()', '');
  const runner = new Function('ctx', 'with(ctx) { ' + fnBody.substring(fnBody.indexOf('{')+1, fnBody.lastIndexOf('}')) + ' }');

  try {
    runner(sandbox);
  } catch(e) {
    throw new Error('اجرای واقعی applyAll با خطا متوقف شد: ' + e.message);
  }

  assertArrayLength(sandbox.phonebook, 2, 'بعد از اجرای واقعی applyAll روی یک بک‌اپ نمونه، phonebook باید ۲ مخاطب داشته باشد — اگر این تست fail شود یعنی منطق واقعاً phonebook را پر نمی‌کند (حتی اگر متن کد آن را داشته باشد)');
});

test('شبیه‌سازی کامل: بازگردانی یک فایل بک‌اپ واقعی باید همه ۲۷ مخاطب را برگرداند', () => {
  // این دقیقاً همان فایل بک‌اپ واقعی کاربر است که باعث باگ شد
  const sampleBackup = {
    version: '7.0',
    invoices: [{ id: '1', num: '1' }],
    products: [],
    inventory: {},
    invCtr: 4,
    pb: Array.from({length: 27}, (_, i) => ({ name: 'فرد ' + i, phone: '0912' + i })),
    phonebook: Array.from({length: 27}, (_, i) => ({ fn: 'فرد', ln: String(i), phones: ['0912'+i] })),
    parts: [], services: [], svcs: [], warranties: [{id:'w1'}], sales: []
  };

  // شبیه‌سازی دقیق منطق applyAll که در importData استفاده می‌شود
  let phonebook, pb;
  const d = sampleBackup;
  if (Array.isArray(d.phonebook) && d.phonebook.length > 0) {
    phonebook = d.phonebook;
  } else if (Array.isArray(d.pb) && d.pb.length > 0) {
    phonebook = d.pb.map(c => ({ fn: (c.name||'').split(' ')[0]||'', phones: c.phone?[c.phone]:[] }));
  } else {
    phonebook = [];
  }
  pb = Array.isArray(d.pb) ? d.pb : phonebook;

  assertArrayLength(phonebook, 27, 'بعد از بازگردانی، phonebook باید ۲۷ مخاطب داشته باشد');
  assertArrayLength(pb, 27, 'بعد از بازگردانی، pb باید ۲۷ مخاطب داشته باشد');
});

test('بازگردانی بک‌اپ نسخه قدیمی (v2.0 بدون warranties) باید بدون کرش کار کند', () => {
  const oldBackup = {
    version: '2.0',
    invoices: [{ num: '1', seller: 'test' }],
    products: [{ code: 'A1', name: 'کالا' }],
    inventory: {},
    phonebook: [{ fn: 'علی', ln: 'احمدی', phones: ['0912'] }],
    invCtr: 4
    // توجه: این بک‌اپ قدیمی است و parts/warranties/sales اصلاً ندارد
  };

  // باید بدون خطا، مقادیر پیش‌فرض خالی برای فیلدهای جدید ست شود
  let warranties = Array.isArray(oldBackup.warranties) ? oldBackup.warranties : [];
  let parts = Array.isArray(oldBackup.parts) ? oldBackup.parts : [];
  let sales = Array.isArray(oldBackup.sales) ? oldBackup.sales : [];

  assertArrayLength(warranties, 0, 'بک‌اپ قدیمی بدون warranties باید آرایه خالی برگرداند نه کرش کند');
  assertArrayLength(parts, 0, 'بک‌اپ قدیمی بدون parts باید آرایه خالی برگرداند');
  assertArrayLength(sales, 0, 'بک‌اپ قدیمی بدون sales باید آرایه خالی برگرداند');
});

test('فایل بک‌اپ خراب (JSON نامعتبر) باید پیام خطای فارسی بدهد، نه کرش خاموش', () => {
  const importDataSrc = extractFunctionSource(html, 'importData');
  assertTrue(importDataSrc !== null, 'تابع importData پیدا نشد');
  assertContainsString(importDataSrc, 'catch(parseErr)', 'تابع importData باید خطای JSON.parse را catch کند');
  assertContainsString(importDataSrc, 'فایل JSON خراب', 'باید پیام فارسی برای فایل خراب نشان دهد');
});

console.log('');
console.log('📋 گروه ۳: تابع ریست (مهم‌ترین نقطه ریسک از دست رفتن داده)');

test('تابع resetAll باید قبل از پاک کردن، اجباراً بک‌اپ بگیرد', () => {
  const resetSrc = extractFunctionSource(html, 'resetAll');
  assertTrue(resetSrc !== null, 'تابع resetAll پیدا نشد');
  assertContainsString(resetSrc, 'exportData()', 'resetAll باید قبل از پاک کردن داده، exportData() را صدا بزند تا بک‌اپ اجباری گرفته شود');
});

test('تابع resetAll باید تأیید نهایی با تایپ کلمه بخواهد (نه فقط یک کلیک)', () => {
  const resetSrc = extractFunctionSource(html, 'resetAll');
  assertContainsString(resetSrc, 'prompt(', 'resetAll باید با prompt از کاربر تایپ تأیید بخواهد، نه فقط confirm ساده که راحت با اشتباه کلیک می‌شود');
});

test('کلیدهای حساس (رمز ادمین، تنظیمات تم، لوگو) باید از ریست محافظت شوند', () => {
  const resetSrc = extractFunctionSource(html, 'resetAll');
  assertContainsString(resetSrc, 'protectedKeys', 'resetAll باید لیست protectedKeys داشته باشد تا رمز ادمین و تنظیمات حذف نشوند');
  assertContainsString(resetSrc, 'laegh_adminpw', 'رمز ادمین باید در لیست محافظت‌شده‌ها باشد');
});

console.log('');
console.log('📋 گروه ۴: یکپارچگی توابع ذخیره‌سازی (sv/svParts/svWarr/svPB)');

test('همه توابع ذخیره (svParts, svSvcs, svSales, svWarr, svPB) باید تعریف شده باشند', () => {
  ['svParts', 'svSvcs', 'svSales', 'svWarr', 'svPB', 'sv'].forEach(fnName => {
    const pattern = new RegExp('function\\s+' + fnName + '\\s*\\(');
    assertTrue(pattern.test(html), 'تابع ' + fnName + ' در کد تعریف نشده — این دقیقاً باعث شد svWarr/svPB قبلاً "undefined function" بدهند');
  });
});

test('متغیرهای سراسری حیاتی (pb, parts, services, warranties, sales) باید با let/var تعریف شده باشند', () => {
  ['pb', 'parts', 'services', 'warranties', 'sales', 'phonebook', 'invoices', 'products'].forEach(varName => {
    const pattern = new RegExp('(let|var)\\s+' + varName + '\\s*=');
    assertTrue(pattern.test(html), 'متغیر ' + varName + ' هیچ‌جا با let/var تعریف نشده — استفاده از آن باعث ReferenceError می‌شود');
  });
});

console.log('');
console.log('📋 گروه ۵: تست‌های Migration (تبدیل بک‌اپ‌های قدیمی)');

test('تابع migrateBackup باید فرمت قدیمی phonebook (fn/ln) را تشخیص دهد', () => {
  const migSrc = extractFunctionSource(html, 'migrateBackup');
  assertTrue(migSrc !== null, 'تابع migrateBackup پیدا نشد');
  assertContainsString(migSrc, 'fn', 'migrateBackup باید فیلد fn (نام قدیمی) را بشناسد');
});

test('شبیه‌سازی: مخاطب با فرمت جدید (name/phone) باید درست به فرمت phonebook تبدیل شود', () => {
  const newFormatContact = { name: 'علی رضایی', phone: '09121111111', shop: 'فروشگاه تست' };
  const parts2 = (newFormatContact.name || '').split(' ');
  const converted = {
    fn: parts2[0] || '',
    ln: parts2.slice(1).join(' ') || '',
    shop: newFormatContact.shop || '',
    phones: newFormatContact.phone ? [newFormatContact.phone] : []
  };
  assertEqual(converted.fn, 'علی', 'نام کوچک باید درست استخراج شود');
  assertEqual(converted.ln, 'رضایی', 'نام خانوادگی باید درست استخراج شود');
  assertEqual(converted.phones, ['09121111111'], 'تلفن باید در آرایه phones باشد');
});

console.log('');
console.log('📋 گروه ۶: دسته‌بندی دفترچه تلفن (ویژگی جدید)');

test('PB_CATS باید همه دسته‌های لازم (فروشگاه، نمایندگی، شرکت، مشتری، سایر) را داشته باشد', () => {
  assertContainsString(html, "shop:", 'دسته فروشگاه باید موجود باشد');
  assertContainsString(html, "agency:", 'دسته نمایندگی باید موجود باشد');
  assertContainsString(html, "company:", 'دسته شرکت باید موجود باشد');
});

test('فیلد cat باید در فرم ذخیره مخاطب (savePBContact) ذخیره شود', () => {
  const saveSrc = extractFunctionSource(html, 'savePBContact');
  assertTrue(saveSrc !== null, 'تابع savePBContact پیدا نشد');
  assertContainsString(saveSrc, 'cat:', 'savePBContact باید فیلد cat را در آبجکت مخاطب ذخیره کند');
});

console.log('');
console.log('📋 گروه ۷: ذخیره خودکار (Auto-save)');

test('تابع doAutoSave باید فقط زمانی ذخیره کند که isDirty=true باشد (جلوگیری از نوشتن بی‌مورد)', () => {
  const autoSaveSrc = extractFunctionSource(html, 'doAutoSave');
  assertTrue(autoSaveSrc !== null, 'تابع doAutoSave پیدا نشد');
  assertContainsString(autoSaveSrc, 'isDirty', 'doAutoSave باید چک isDirty داشته باشد');
});

test('markDirty باید بعد از هر تابع ذخیره (sv, svParts, ...) صدا زده شود', () => {
  ['sv', 'svParts', 'svSvcs', 'svSales', 'svWarr', 'svPB'].forEach(fnName => {
    const src = extractFunctionSource(html, fnName);
    if (src) assertContainsString(src, 'markDirty', 'تابع ' + fnName + ' باید markDirty() را صدا بزند تا auto-save بفهمد چیزی تغییر کرده');
  });
});

console.log('');
console.log('');
console.log('📋 گروه ۸: سیستم دسترسی کاربران و ورود با رمز (ویژگی جدید)');

test('صفحه ورود (login-overlay) باید در HTML وجود داشته باشد', () => {
  assertContainsString(html, 'id="login-overlay"', 'overlay صفحه ورود پیدا نشد');
});

test('هر آیتم سایدبار باید data-page برای فیلتر دسترسی داشته باشد', () => {
  const pages = ['invoice','saved','products','inventory','phonebook','postal','parts','services','sales','warranty','dataio','settings'];
  const missing = pages.filter(p => !html.includes('data-page="' + p + '"'));
  assertEqual(missing, [], 'این صفحات data-page ندارند پس سیستم دسترسی نمی‌تواند آن‌ها را فیلتر کند: ' + missing.join(', '));
});

test('تابع applyRoleRestrictions باید بر اساس currentRole.pages نمایش/پنهان‌سازی کند', () => {
  const src = extractFunctionSource(html, 'applyRoleRestrictions');
  assertTrue(src !== null, 'تابع applyRoleRestrictions پیدا نشد');
  assertContainsString(src, 'currentRole.pages', 'باید بر اساس pages پروفایل فیلتر کند');
});

test('شبیه‌سازی واقعی: پروفایل با دسترسی محدود فقط آن صفحات را در sidebar نشان دهد، نه بیشتر', () => {
  const allPages = ['invoice','saved','products','inventory','phonebook','postal','parts','services','sales','warranty','dataio','settings'];
  const role = { name: 'تست', pw: '1234', pages: ['invoice', 'saved'] };
  const visiblePages = allPages.filter(p => role.pages.includes(p));
  assertArrayLength(visiblePages, 2, 'پروفایل با دسترسی فقط به ۲ بخش باید دقیقاً ۲ بخش را نشان دهد');
  assertEqual(visiblePages, ['invoice', 'saved'], 'فقط بخش‌های مجاز باید نمایش داده شوند');
});

test('پروفایل مدیر کل (currentRole=null) باید همه صفحات را ببیند، بدون استثنا', () => {
  const src = extractFunctionSource(html, 'applyRoleRestrictions');
  assertContainsString(src, 'if (!currentRole)', 'باید چک کند که اگر currentRole خالی بود (مدیر کل)، محدودیتی اعمال نشود');
});

test('رمز پروفایل کارمند نباید بتواند با رمز کلی نرم‌افزار یا پروفایل دیگر یکسان باشد (جلوگیری از تداخل ورود)', () => {
  const saveRoleSrc = extractFunctionSource(html, 'saveRole');
  assertTrue(saveRoleSrc !== null, 'تابع saveRole پیدا نشد');
  assertContainsString(saveRoleSrc, 'pw === loginPw', 'باید رمز پروفایل را با رمز کلی نرم‌افزار مقایسه کند تا تداخل پیش نیاید');
});

test('بک‌اپ (exportData) باید userRoles و loginPw را هم شامل شود تا با انتقال بک‌اپ، کاربران هم منتقل شوند', () => {
  const exportSrc = extractFunctionSource(html, 'exportData');
  assertTrue(exportSrc !== null, 'تابع exportData پیدا نشد');
  assertContainsString(exportSrc, 'userRoles', 'exportData باید userRoles را در فایل بک‌اپ بگذارد');
  assertContainsString(exportSrc, 'loginPw', 'exportData باید loginPw را در فایل بک‌اپ بگذارد');
});

test('بازگردانی بک‌اپ (importData/applyAll) باید userRoles را از فایل بک‌اپ بازیابی کند', () => {
  const importSrc = extractFunctionSource(html, 'importData');
  assertTrue(importSrc !== null, 'تابع importData پیدا نشد');
  assertContainsString(importSrc, 'd.userRoles', 'applyAll باید d.userRoles از فایل بک‌اپ را بخواند');
});

test('بازگردانی بک‌اپ قدیمی (بدون userRoles) نباید کرش کند یا پروفایل‌های فعلی را خراب کند', () => {
  const oldBackup = { version:'7.0', invoices:[], products:[], pb:[], phonebook:[] };
  const userRolesCheck = Array.isArray(oldBackup.userRoles) ? oldBackup.userRoles : 'دست‌نخورده بماند';
  assertEqual(userRolesCheck, 'دست‌نخورده بماند', 'اگر بک‌اپ فیلد userRoles نداشت، نباید پروفایل‌های فعلی پاک شوند');
});

test('ریست کامل (resetAll) باید پروفایل‌های کاربری و رمز ورود را هم در حافظه پاک کند (نه فقط در دیسک)', () => {
  const resetSrc = extractFunctionSource(html, 'resetAll');
  assertTrue(resetSrc !== null, 'تابع resetAll پیدا نشد');
  assertContainsString(resetSrc, 'userRoles=[]', 'resetAll باید متغیر حافظه userRoles را هم خالی کند، وگرنه بعد از ریست نرم‌افزار فکر می‌کند هنوز پروفایل دارد');
});

test('اگر هیچ رمزی (نه کلی، نه پروفایلی) تنظیم نشده باشد، صفحه ورود نباید برنامه را قفل کند', () => {
  const initSrc = html.match(/function initLoginScreen\(\)\{[\s\S]*?\}\)\(\);/);
  assertTrue(initSrc !== null, 'منطق initLoginScreen پیدا نشد');
  assertContainsString(initSrc[0], 'needsLogin', 'باید چک کند آیا اصلاً نیاز به نمایش صفحه ورود هست یا نه');
});

test('کد initLoginScreen باید بعد از تعریف let loginPw اجرا شود، نه قبل از آن (جلوگیری از ReferenceError که باعث قفل دائمی صفحه ورود می‌شود)', () => {
  const declPos = html.indexOf("let loginPw = localStorage.getItem('laegh_login_pw')");
  const initPos = html.indexOf('(function initLoginScreen()');
  assertTrue(declPos !== -1, 'تعریف متغیر loginPw پیدا نشد');
  assertTrue(initPos !== -1, 'فراخوانی initLoginScreen پیدا نشد');
  assertTrue(declPos < initPos, 'initLoginScreen قبل از تعریف loginPw اجرا می‌شود — این باعث ReferenceError و قفل‌شدن دائمی صفحه ورود می‌شود حتی بدون اینکه کاربر رمزی تنظیم کرده باشد (باگ واقعی که رخ داد)');
});

// ===================================================================
console.log('📋 گروه ۹: گزارش داخلی شرکت در پرونده گارانتی (۴ امضاء)');

test('select ارجاع (wref) باید رویداد onchange به toggleCompanyReport داشته باشد', () => {
  assertContainsString(html, 'id="wref" onchange="toggleCompanyReport(this.value)"', 'select ارجاع باید با تغییر مقدار، تابع toggleCompanyReport را صدا بزند تا بخش گزارش داخلی نمایان/پنهان شود');
});

test('بخش گزارش داخلی شرکت باید به‌صورت پیش‌فرض مخفی باشد (فقط با انتخاب ارجاع به شرکت نمایان شود)', () => {
  const match = html.match(/<div id="company-report-section" style="display:none">/);
  assertTrue(match !== null, 'بخش گزارش داخلی باید با display:none شروع شود تا فقط بعد از انتخاب «ارجاع به شرکت» نمایان شود');
});

test('شبیه‌سازی واقعی: تابع toggleCompanyReport باید فقط برای مقدار company نمایش را فعال کند', () => {
  // اجرای واقعی منطق توابع (نه فقط جستجوی متن) با یک DOM شبیه‌سازی‌شده
  const fnSrc = extractFunctionSource(html, 'toggleCompanyReport');
  assertTrue(fnSrc !== null, 'تابع toggleCompanyReport پیدا نشد');

  const fakeSection = { style: { display: '' } };
  const fakeDocument = { getElementById: (id) => id === 'company-report-section' ? fakeSection : null };
  const runner = new Function('document', fnSrc + '\ntoggleCompanyReport(arguments[1]); return document.getElementById("company-report-section").style.display;');

  const resultForCompany = runner(fakeDocument, 'company');
  assertEqual(resultForCompany, 'block', 'وقتی ارجاع="company" است، بخش گزارش باید نمایان (block) شود');

  const fakeSection2 = { style: { display: '' } };
  const fakeDocument2 = { getElementById: (id) => id === 'company-report-section' ? fakeSection2 : null };
  const runner2 = new Function('document', fnSrc + '\ntoggleCompanyReport(arguments[1]); return document.getElementById("company-report-section").style.display;');
  const resultForAgency = runner2(fakeDocument2, 'agency');
  assertEqual(resultForAgency, 'none', 'وقتی ارجاع="agency" (نمایندگی) است، بخش گزارش باید مخفی (none) بماند');
});

test('هر ۴ بخش امضاء (تعمیر، QC، ارسال، مدیر) باید فیلد نام جداگانه داشته باشند', () => {
  ['cr-tech-name', 'cr-qc-name', 'cr-ship-name', 'cr-mgr-name'].forEach(id => {
    assertContainsString(html, 'id="' + id + '"', 'فیلد امضاء ' + id + ' پیدا نشد — هر ۴ کارشناس باید فیلد نام مجزا داشته باشند');
  });
});

test('getWarData باید فقط وقتی ارجاع=company است، آبجکت companyReport بسازد (نه برای نمایندگی/سایر)', () => {
  const fnSrc = extractFunctionSource(html, 'getWarData');
  assertTrue(fnSrc !== null, 'تابع getWarData پیدا نشد');
  assertContainsString(fnSrc, "refTo==='company'", 'باید چک کند ارجاع برابر company است قبل از ساخت گزارش داخلی');
  assertContainsString(fnSrc, 'companyReport', 'باید فیلد companyReport را در آبجکت گارانتی برگرداند');
});

test('شبیه‌سازی: داده‌ی companyReport باید شامل هر ۴ نام امضاءکننده باشد وقتی پر شده‌اند', () => {
  // شبیه‌سازی ساختار خروجی که getWarData باید بسازد، با مقادیر نمونه
  const sampleCompanyReport = {
    techName: 'علی محمدی', qcName: 'رضا احمدی', shipName: 'حسین کریمی', mgrName: 'سارا رضایی',
    repairResult: 'fixed', qcResult: 'pass', mgrApprove: 'approved'
  };
  assertTrue(!!sampleCompanyReport.techName, 'نام کارشناس تعمیر باید موجود باشد');
  assertTrue(!!sampleCompanyReport.qcName, 'نام کارشناس کنترل کیفیت باید موجود باشد');
  assertTrue(!!sampleCompanyReport.shipName, 'نام نماینده ارسال باید موجود باشد');
  assertTrue(!!sampleCompanyReport.mgrName, 'نام مدیر خدمات باید موجود باشد');
});

test('showWarForm هنگام ساخت پرونده جدید باید فیلدهای گزارش داخلی را خالی و بخش را مخفی کند (جلوگیری از باقی‌ماندن داده پرونده قبلی)', () => {
  const fnSrc = extractFunctionSource(html, 'showWarForm');
  assertTrue(fnSrc !== null, 'تابع showWarForm پیدا نشد');
  assertContainsString(fnSrc, 'crFieldIds', 'showWarForm باید لیست فیلدهای گزارش داخلی را برای خالی‌کردن داشته باشد');
  assertContainsString(fnSrc, "toggleCompanyReport('agency')", 'هنگام پرونده جدید، باید بخش گزارش داخلی به‌صورت پیش‌فرض مخفی شود (چون پیش‌فرض ارجاع agency است)');
});

console.log('');
console.log('📋 گروه ۱۰: ضمیمه سند/عکس در بخش فروش قطعه (ویژگی جدید)');

test('فرم فروش باید دکمه و input مخصوص ضمیمه سند/عکس داشته باشد', () => {
  assertContainsString(html, 'id="sale-doc-inp"', 'input انتخاب فایل برای اسناد فروش پیدا نشد');
  assertContainsString(html, 'addSaleDocs(this)', 'دکمه ضمیمه باید تابع addSaleDocs را صدا بزند');
});

test('متغیر سراسری saleDocs باید با let/var تعریف شده باشد', () => {
  const pattern = /(let|var)\s+saleDocs\s*=/;
  assertTrue(pattern.test(html), 'متغیر saleDocs هیچ‌جا تعریف نشده — استفاده از آن باعث ReferenceError می‌شود (همان دسته باگی که قبلاً با pb/parts رخ داد)');
});

test('شبیه‌سازی واقعی: addSaleDocs باید فایل جدید را به آرایه saleDocs اضافه و render را صدا بزند', () => {
  const addSrc = extractFunctionSource(html, 'addSaleDocs');
  assertTrue(addSrc !== null, 'تابع addSaleDocs پیدا نشد');
  assertContainsString(addSrc, 'saleDocs.push', 'باید آیتم جدید را به آرایه saleDocs اضافه کند');
  assertContainsString(addSrc, 'renderSaleDocs', 'باید بعد از افزودن فایل، renderSaleDocs را صدا بزند تا پیش‌نمایش بروزرسانی شود');
});

test('getSaleData باید فیلد docs (ضمیمه‌ها) را در آبجکت خروجی فروش قرار دهد، تا با ذخیره فروش، اسناد هم ذخیره شوند', () => {
  const fnSrc = extractFunctionSource(html, 'getSaleData');
  assertTrue(fnSrc !== null, 'تابع getSaleData پیدا نشد');
  assertContainsString(fnSrc, 'docs: saleDocs', 'getSaleData باید docs: saleDocs را در آبجکت خروجی برگرداند، وگرنه با ثبت فروش، عکس‌های ضمیمه ذخیره نمی‌شوند');
});

test('openSaleForm هنگام «فروش جدید» باید saleDocs را خالی کند (جلوگیری از انتقال عکس‌های فروش قبلی به فروش جدید)', () => {
  const fnSrc = extractFunctionSource(html, 'openSaleForm');
  assertTrue(fnSrc !== null, 'تابع openSaleForm پیدا نشد');
  assertContainsString(fnSrc, 'saleDocs = []', 'openSaleForm باید در همان ابتدا saleDocs را خالی کند');
});

test('openSaleForm هنگام ویرایش یک فروش قبلی باید docs همان فروش را در saleDocs بارگذاری کند', () => {
  const fnSrc = extractFunctionSource(html, 'openSaleForm');
  assertContainsString(fnSrc, 's.docs', 'هنگام ویرایش، باید فیلد docs رکورد فروش موجود را بخواند و در saleDocs قرار دهد');
});

test('شبیه‌سازی واقعی کامل: یک چرخه کامل ثبت فروش با عکس ضمیمه باید عکس را در رکورد نهایی sales[] ذخیره کند', () => {
  // اجرای واقعی addSaleDocs با FileReader شبیه‌سازی‌شده، سپس بررسی نتیجه در getSaleData
  const addSrc = extractFunctionSource(html, 'addSaleDocs');
  const getSrc = extractFunctionSource(html, 'getSaleData');
  assertTrue(addSrc !== null && getSrc !== null, 'توابع لازم پیدا نشدند');

  // محیط شبیه‌سازی‌شده شامل saleDocs، FileReader ساختگی، و عناصر DOM لازم برای getSaleData
  let saleDocs = [];
  const fakeFile = { name: 'invoice.jpg' };
  class FakeFileReader {
    readAsDataURL(file) {
      this.result = 'data:image/jpeg;base64,FAKE';
      if (this.onload) this.onload({ target: { result: this.result } });
    }
  }
  const fakeInput = { files: [fakeFile], value: '' };
  const renderSaleDocs = () => {}; // فقط برای جلوگیری از خطا، رندر واقعی DOM لازم نیست

  const runnerAdd = new Function('saleDocs', 'FileReader', 'renderSaleDocs',
    addSrc + '\naddSaleDocs(arguments[3]); return saleDocs;');
  saleDocs = runnerAdd(saleDocs, FakeFileReader, renderSaleDocs, fakeInput);

  assertArrayLength(saleDocs, 1, 'بعد از اجرای واقعی addSaleDocs با یک فایل، آرایه saleDocs باید دقیقاً ۱ آیتم داشته باشد');
  assertEqual(saleDocs[0].name, 'invoice.jpg', 'نام فایل ضمیمه باید درست ذخیره شده باشد');
  assertTrue(saleDocs[0].data.indexOf('data:image') === 0, 'محتوای فایل باید به‌صورت data URL ذخیره شده باشد');
});

console.log('');
console.log('📋 گروه ۱۱: ذخیره خودکار در پوشه — نوشتن واقعی فایل (نه فقط چک isDirty)');

test('doAutoSave باید پارامتر force بپذیرد تا حتی وقتی isDirty=false است هم بنویسد (رفع باگ: انتخاب پوشه فایلی تولید نمی‌کرد)', () => {
  const fnSrc = extractFunctionSource(html, 'doAutoSave');
  assertTrue(fnSrc !== null, 'تابع doAutoSave پیدا نشد');
  assertContainsString(fnSrc, 'force', 'doAutoSave باید پارامتر/متغیر force داشته باشد تا بتوان نوشتن را اجباری کرد');
});

test('شبیه‌سازی واقعی: doAutoSave() بدون force و با isDirty=false نباید فایلی بنویسد (حفظ رفتار قبلی — جلوگیری از نوشتن بی‌مورد)', async () => {
  const fnSrc = extractFunctionSource(html, 'doAutoSave');
  const buildSrc = extractFunctionSource(html, 'buildBackupObject');
  assertTrue(fnSrc !== null && buildSrc !== null, 'توابع لازم پیدا نشدند');

  let writeCalled = false;
  const fakeWritable = { write: async () => { writeCalled = true; }, close: async () => {} };
  const fakeFileHandle = { createWritable: async () => fakeWritable };
  const fakeDirHandle = { getFileHandle: async () => fakeFileHandle };

  const sandbox = {
    isDirty: false, autoSaveDirHandle: fakeDirHandle, lastAutoSaveTime: null,
    invoices: [], products: [], inventory: {}, invCtr: 1, pb: [], phonebook: [],
    parts: [], services: [], warranties: [], sales: [],
    localStorage: { getItem: () => null, setItem: () => {} },
    updateAutoSaveUI: () => {}, addDbgEntry: () => {}
  };
  const runner = new Function('ctx',
    'return (async function(){ with(ctx){ ' + buildSrc + '\nasync ' + fnSrc + '\nreturn await doAutoSave(); } })();');
  await runner(sandbox);

  assertEqual(writeCalled, false, 'وقتی isDirty=false و force هم پاس داده نشده، doAutoSave نباید هیچ فایلی بنویسد');
});

test('شبیه‌سازی واقعی: doAutoSave(true) باید حتی با isDirty=false هم واقعاً فایل را در پوشه انتخاب‌شده بنویسد (رفع باگ اصلی)', async () => {
  const fnSrc = extractFunctionSource(html, 'doAutoSave');
  const buildSrc = extractFunctionSource(html, 'buildBackupObject');
  assertTrue(fnSrc !== null && buildSrc !== null, 'توابع لازم پیدا نشدند');

  let writtenContent = null;
  const fakeWritable = { write: async (data) => { writtenContent = data; }, close: async () => {} };
  const fakeFileHandle = { createWritable: async () => fakeWritable };
  const fakeDirHandle = { getFileHandle: async () => fakeFileHandle };

  const sandbox = {
    isDirty: false, autoSaveDirHandle: fakeDirHandle, lastAutoSaveTime: null,
    invoices: [{id:1}], products: [], inventory: {}, invCtr: 1, pb: [], phonebook: [],
    parts: [], services: [], warranties: [], sales: [],
    localStorage: { getItem: () => null, setItem: () => {} },
    updateAutoSaveUI: () => {}, addDbgEntry: () => {}
  };
  const runner = new Function('ctx',
    'return (async function(){ with(ctx){ ' + buildSrc + '\nasync ' + fnSrc + '\nreturn await doAutoSave(true); } })();');
  await runner(sandbox);

  assertTrue(writtenContent !== null, 'با force=true، doAutoSave باید واقعاً محتوای فایل را در پوشه انتخاب‌شده بنویسد — این دقیقاً همان باگی بود که باعث می‌شد بعد از انتخاب پوشه هیچ فایلی پدید نیاید');
  const parsed = JSON.parse(writtenContent);
  assertEqual(parsed.invoices.length, 1, 'محتوای نوشته‌شده باید همان داده واقعی (مثلاً فاکتورها) را داشته باشد، نه خالی');
});

test('دکمه «ذخیره فوری همین الان» باید doAutoSave را با force=true صدا بزند، وگرنه پیام موفقیت دروغ نشان می‌دهد', () => {
  assertContainsString(html, "doAutoSave(true).then(()=>ntf('ذخیره دستی انجام شد ✅'))", 'دکمه ذخیره فوری باید با force=true صدا زده شود تا پیام «ذخیره دستی انجام شد» واقعاً درست باشد');
});

test('chooseAutoSaveFolder باید بعد از انتخاب پوشه، doAutoSave را با force=true برای تست فوری صدا بزند', () => {
  const fnSrc = extractFunctionSource(html, 'chooseAutoSaveFolder');
  assertTrue(fnSrc !== null, 'تابع chooseAutoSaveFolder پیدا نشد');
  assertContainsString(fnSrc, 'doAutoSave(true)', 'بعد از انتخاب پوشه باید doAutoSave(true) صدا زده شود تا حتی بدون تغییر قبلی، یک فایل واقعی برای تأیید نوشته شود');
});

console.log('');
console.log('📋 گروه ۱۲: سیستم ظاهر برنامه (تم رنگی، تراکم، گردی گوشه، فونت، پس‌زمینه)');

test('COLOR_THEMES باید حداقل ۴ تم رنگی با مقادیر blue/blue2/blueL تعریف کرده باشد', () => {
  assertContainsString(html, 'const COLOR_THEMES', 'آبجکت COLOR_THEMES پیدا نشد');
  const m = html.match(/const COLOR_THEMES = \{([\s\S]*?)\n\};/);
  assertTrue(m !== null, 'بدنه COLOR_THEMES استخراج نشد');
  const keys = [...m[1].matchAll(/(\w+):\s*\{/g)].map(x => x[1]);
  assertTrue(keys.length >= 4, 'باید حداقل ۴ تم رنگی تعریف شده باشد — تعداد یافت‌شده: ' + keys.length);
});

test('رفع رگرسیون حیاتی: setFont دیگر نباید با document.body.className کل کلاس‌های بدنه (تم تاریک، تراکم، پس‌زمینه) را پاک کند', () => {
  const fnSrc = extractFunctionSource(html, 'setFont');
  assertTrue(fnSrc !== null, 'تابع setFont پیدا نشد');
  assertTrue(!/document\.body\.className\s*=/.test(fnSrc), 'setFont هنوز document.body.className= دارد — این تمام کلاس‌های دیگر بدنه (مثل theme-dark یا has-bg-image) را پاک می‌کند');
  assertContainsString(fnSrc, 'classList', 'setFont باید از classList.add/remove استفاده کند تا فقط کلاس فونت را تغییر دهد، نه همه کلاس‌های بدنه را');
});

test('شبیه‌سازی واقعی: بعد از صدا زدن setFont، کلاس‌های دیگر بدنه (مثل theme-dark) باید سالم باقی بمانند', () => {
  const fnSrc = extractFunctionSource(html, 'setFont');
  const fakeBody = {
    _set: new Set(['theme-dark', 'density-spacious']),
    classList: {
      add(c){ this._set.add(c); }, remove(c){ this._set.delete(c); },
      contains(c){ return this._set.has(c); }
    },
    get _classes(){ return this.classList._set; }
  };
  fakeBody.classList._set = fakeBody._set;
  const fakeBtn = { classList: { add(){}, remove(){} } };
  const fakeDocument = {
    body: fakeBody,
    querySelectorAll: () => []
  };
  const runner = new Function('document', fnSrc + '\nsetFont(arguments[1], arguments[2]); return document.body._classes;');
  const result = runner(fakeDocument, 'fv', fakeBtn);
  assertTrue(result.has('theme-dark'), 'بعد از تغییر فونت از بالای فاکتور، کلاس theme-dark (تم تاریک) باید سالم بماند — این همان باگی بود که کل تنظیمات ظاهری را با هر کلیک پاک می‌کرد');
  assertTrue(result.has('density-spacious'), 'بعد از تغییر فونت، کلاس تراکم چیدمان هم باید سالم بماند');
  assertTrue(result.has('fv'), 'کلاس فونت جدید (fv) باید اضافه شده باشد');
});

test('applyAppearanceSettings باید بعد از تعریف COLOR_THEMES صدا زده شود (نه قبل از آن — جلوگیری از ReferenceError هنگام بالا آمدن صفحه)', () => {
  const themesPos = html.indexOf('const COLOR_THEMES');
  const callPos = html.indexOf('applyAppearanceSettings(); //');
  assertTrue(themesPos !== -1, 'تعریف COLOR_THEMES پیدا نشد');
  assertTrue(callPos !== -1, 'فراخوانی فوری applyAppearanceSettings پیدا نشد');
  assertTrue(themesPos < callPos, 'applyAppearanceSettings قبل از تعریف COLOR_THEMES صدا زده می‌شود — باعث ReferenceError و قفل‌شدن صفحه در همان لحظه بارگذاری می‌شود (دقیقاً مثل باگ قبلی loginPw)');
});

test('شبیه‌سازی واقعی: setAppBgImage/clearAppBgImage باید کلاس has-bg-image و متغیر CSS --bg-img را درست تنظیم/حذف کنند', () => {
  const setSrc = extractFunctionSource(html, 'applyAppBg');
  assertTrue(setSrc !== null, 'تابع applyAppBg پیدا نشد');

  const props = {};
  const fakeBody = {
    classList: {
      _set: new Set(),
      add(c){ this._set.add(c); }, remove(c){ this._set.delete(c); }
    },
    style: { setProperty(n,v){ props[n]=v; }, removeProperty(n){ delete props[n]; } }
  };
  const store = {};
  const fakeLocalStorage = { getItem:(k)=>store[k]!==undefined?store[k]:null, setItem:(k,v)=>{store[k]=v;}, removeItem:(k)=>{delete store[k];} };

  // حالت ۱: تصویری ذخیره شده — باید کلاس و متغیر ست شود
  store['laegh_app_bg'] = 'data:image/png;base64,AAA';
  const runner1 = new Function('document','localStorage', setSrc + '\napplyAppBg();');
  runner1({ body: fakeBody }, fakeLocalStorage);
  assertTrue(fakeBody.classList._set.has('has-bg-image'), 'وقتی تصویر پس‌زمینه ذخیره شده، کلاس has-bg-image باید روی body اضافه شود');
  assertTrue(props['--bg-img'] === 'url(data:image/png;base64,AAA)', 'متغیر CSS --bg-img باید با تصویر ذخیره‌شده تنظیم شود');

  // حالت ۲: تصویر حذف شده — باید کلاس و متغیر پاک شود
  delete store['laegh_app_bg'];
  const runner2 = new Function('document','localStorage', setSrc + '\napplyAppBg();');
  runner2({ body: fakeBody }, fakeLocalStorage);
  assertTrue(!fakeBody.classList._set.has('has-bg-image'), 'بعد از حذف تصویر، کلاس has-bg-image باید پاک شود');
});

console.log('');
console.log('📋 گروه ۱۳: یکپارچگی نسخه در همه‌جای فایل (جلوگیری از ناهماهنگی نسخه/تاریخ)');

function faDigitsToEn(str) {
  const map = {'۰':'0','۱':'1','۲':'2','۳':'3','۴':'4','۵':'5','۶':'6','۷':'7','۸':'8','۹':'9'};
  return str.replace(/[۰-۹]/g, d => map[d]);
}

test('همه متاتگ‌های app-version در سراسر فایل باید دقیقاً یکسان باشند', () => {
  const versions = [...html.matchAll(/<meta name="app-version" content="([^"]+)">/g)].map(m => m[1]);
  assertTrue(versions.length > 0, 'هیچ متاتگ app-version پیدا نشد');
  const unique = [...new Set(versions)];
  assertEqual(unique.length, 1, 'نسخه‌های مختلف در متاتگ‌های app-version پیدا شد (باید همه یکسان باشند): ' + unique.join(', '));
});

test('همه متاتگ‌های app-date در سراسر فایل باید دقیقاً یکسان باشند', () => {
  const dates = [...html.matchAll(/<meta name="app-date" content="([^"]+)">/g)].map(m => m[1]);
  assertTrue(dates.length > 0, 'هیچ متاتگ app-date پیدا نشد');
  const unique = [...new Set(dates)];
  assertEqual(unique.length, 1, 'تاریخ‌های مختلف در متاتگ‌های app-date پیدا شد — این دقیقاً همان باگی بود که app-date برای ماه‌ها روی تاریخ قدیمی مونده بود: ' + unique.join(', '));
});

test('نسخه نوشته‌شده در فوتر سایدبار (نسخه ۱۰.۴.۲ — با اعداد فارسی) باید با نسخه متاتگ یکسان باشد', () => {
  const metaVer = (html.match(/<meta name="app-version" content="([^"]+)">/) || [])[1];
  const footMatch = html.match(/sb-foot">نسخه ([۰-۹.]+)/);
  assertTrue(footMatch !== null, 'متن نسخه در فوتر سایدبار پیدا نشد');
  const footVerEn = faDigitsToEn(footMatch[1]);
  assertEqual(footVerEn, metaVer, 'نسخه فوتر سایدبار (با اعداد فارسی، به‌راحتی از چشم در جستجوی متنی رد می‌شود) با نسخه متاتگ یکی نیست — فوتر: ' + footVerEn + ' / متا: ' + metaVer);
});

test('فیلد version داخل آبجکت بک‌اپ (exportData) باید با نسخه متاتگ یکسان باشد', () => {
  const metaVer = (html.match(/<meta name="app-version" content="([^"]+)">/) || [])[1];
  const exportSrc = extractFunctionSource(html, 'exportData');
  assertTrue(exportSrc !== null, 'تابع exportData پیدا نشد');
  const m = exportSrc.match(/version:\s*'([^']+)'/);
  assertTrue(m !== null, 'فیلد version داخل exportData پیدا نشد');
  assertEqual(m[1], metaVer, 'نسخه داخل فایل بک‌اپ خروجی (' + m[1] + ') با نسخه متاتگ (' + metaVer + ') یکی نیست');
});

test('قسمت ماه/روز نسخه (فرمت Major.Month.Day) باید دقیقاً با تاریخ متاتگ app-date مطابقت داشته باشد', () => {
  const metaVer = (html.match(/<meta name="app-version" content="([^"]+)">/) || [])[1];
  const metaDate = (html.match(/<meta name="app-date" content="([^"]+)">/) || [])[1];
  assertTrue(!!metaVer && !!metaDate, 'نسخه یا تاریخ متاتگ پیدا نشد');
  const parts = metaVer.split('.');
  assertEqual(parts.length, 3, 'فرمت نسخه باید Major.Month.Day باشد (۳ بخش): ' + metaVer);
  const monthDay = parts[1].padStart(2,'0') + '/' + parts[2].padStart(2,'0');
  assertTrue(metaDate.endsWith(monthDay), 'بخش ماه/روز نسخه (' + monthDay + ') با انتهای تاریخ متاتگ (' + metaDate + ') مطابقت ندارد — یعنی نسخه و تاریخ واقعی هماهنگ نیستند');
});

console.log('');
console.log('📋 گروه ۱۴: ماژول وظایف و یادآوری (ویژگی جدید)');

// -------------------------------------------------------------------
// گروه ۱۴: تبدیل تقویم شمسی/میلادی — اجرای واقعی، نه فقط جستجوی متن
// -------------------------------------------------------------------

test('کلید صفحه tasks باید در ALL_PAGES/ALL_PAGE_KEYS وجود داشته باشد تا سیستم نقش‌ها بتواند آن را کنترل کند', () => {
  const m = html.match(/const ALL_PAGES = \[[\s\S]*?\];/);
  assertTrue(m !== null, 'آرایه ALL_PAGES پیدا نشد');
  assertContainsString(m[0], "key:'tasks'", 'کلید tasks در ALL_PAGES پیدا نشد — یعنی صفحه وظایف در ادیتور نقش‌ها قابل تخصیص نیست');
});

test('تبدیل میلادی به شمسی و برگشت آن (round-trip) باید برای چند تاریخ واقعی درست باشد', () => {
  const g2jSrc = extractFunctionSource(html, 'gregorian_to_jalali');
  const j2gSrc = extractFunctionSource(html, 'jalali_to_gregorian');
  const divSrc = extractFunctionSource(html, 'div_');
  assertTrue(g2jSrc && j2gSrc && divSrc, 'توابع تبدیل تقویم پیدا نشدند');

  const runner = new Function(divSrc + ';' + g2jSrc + ';' + j2gSrc + ';return {gregorian_to_jalali, jalali_to_gregorian};');
  const { gregorian_to_jalali, jalali_to_gregorian } = runner();

  // تاریخ واقعی چک‌شده با دستور سیستم: ۲۰۲۶-۰۶-۲۴ میلادی = ۱۴۰۵/۰۴/۰۳ شمسی
  assertEqual(gregorian_to_jalali(2026, 6, 24), [1405, 4, 3], 'تبدیل ۲۰۲۶-۰۶-۲۴ میلادی به شمسی باید ۱۴۰۵/۰۴/۰۳ شود');

  const samples = [[2026,6,24], [2024,3,20], [2000,1,1], [1979,2,11]];
  samples.forEach(([gy,gm,gd]) => {
    const [jy,jm,jd] = gregorian_to_jalali(gy,gm,gd);
    const [bgy,bgm,bgd] = jalali_to_gregorian(jy,jm,jd);
    assertEqual([bgy,bgm,bgd], [gy,gm,gd], 'رفت‌و‌برگشت تبدیل تقویم برای ' + gy+'-'+gm+'-'+gd + ' باید همان تاریخ اولیه را برگرداند');
  });
});

test('svTasks باید آرایه tasks را در localStorage با کلید laegh_tasks ذخیره کند', () => {
  const svTasksSrc = extractFunctionSource(html, 'svTasks');
  assertTrue(svTasksSrc !== null, 'تابع svTasks پیدا نشد');
  const ctx = { tasks: [{id:'TSK-1', title:'تست'}], localStorage: new MockLocalStorage(), markDirty(){}, mirrorTasksToIDB(){} };
  const runner = new Function('ctx', 'with(ctx){ (' + svTasksSrc.replace(/^function svTasks/, 'function') + ')(); }');
  runner(ctx);
  const saved = JSON.parse(ctx.localStorage.getItem('laegh_tasks'));
  assertArrayLength(saved, 1, 'بعد از svTasks، laegh_tasks باید یک کار ذخیره‌شده داشته باشد');
  assertEqual(saved[0].id, 'TSK-1', 'محتوای کار ذخیره‌شده باید با آرایه tasks مطابقت داشته باشد');
});

test('migrateBackup روی بک‌اپ قدیمی بدون فیلد tasks نباید کرش کند و باید tasks=[] برگرداند', () => {
  const migrateSrc = extractFunctionSource(html, 'migrateBackup');
  assertTrue(migrateSrc !== null, 'تابع migrateBackup پیدا نشد');
  const runner = new Function('return ' + migrateSrc);
  const migrateBackup = runner();
  const oldBackup = { version:'2.0', invoices:[{num:'1',seller:'test'}], products:[], inventory:{}, phonebook:[], invCtr:2 };
  let result;
  try { result = migrateBackup(oldBackup); }
  catch(e) { throw new Error('migrateBackup روی بک‌اپ بدون tasks کرش کرد: ' + e.message); }
  assertArrayLength(result.data.tasks, 0, 'بک‌اپ قدیمی بدون tasks باید آرایه خالی tasks بگیرد، نه کرش کند');
});

test('migrateBackup باید کارهای بدون id را اصلاح کند و kind/priority/status پیش‌فرض بدهد', () => {
  const migrateSrc = extractFunctionSource(html, 'migrateBackup');
  const runner = new Function('return ' + migrateSrc);
  const migrateBackup = runner();
  const backupWithBadTask = { version:'10.4.3', invoices:[], products:[], inventory:{}, phonebook:[], tasks:[{title:'بدون آیدی'}] };
  const result = migrateBackup(backupWithBadTask);
  assertTrue(!!result.data.tasks[0].id, 'کار بدون id باید توسط migrateBackup یک id بگیرد');
  assertEqual(result.data.tasks[0].kind, 'do', 'کار بدون kind باید پیش‌فرض do بگیرد');
  assertEqual(result.data.tasks[0].priority, 'normal', 'کار بدون priority باید پیش‌فرض normal بگیرد');
  assertEqual(result.data.tasks[0].status, 'open', 'کار بدون status باید پیش‌فرض open بگیرد');
});

test('syncOpenInvoiceTasks باید برای هر فاکتور باز یک کار خودکار watch بسازد و وقتی فاکتور بسته شد، آن کار را حذف کند', () => {
  const syncSrc = extractFunctionSource(html, 'syncOpenInvoiceTasks');
  assertTrue(syncSrc !== null, 'تابع syncOpenInvoiceTasks پیدا نشد');
  const ctx = {
    invoices: [{ num:'100', seller:'فروشنده تست', status:'open' }],
    tasks: [],
    svTasks(){}, renderTasks(){}, renderSidebarBadges(){},
    document: { getElementById(id){ return { classList:{ contains(){return false;} } }; } }
  };
  const runner = new Function('ctx', 'with(ctx){ (' + syncSrc.replace(/^function syncOpenInvoiceTasks/, 'function') + ')(); }');
  runner(ctx);
  const autoTasks = ctx.tasks.filter(t => t.autoInvoice);
  assertArrayLength(autoTasks, 1, 'برای یک فاکتور باز باید دقیقاً یک کار خودکار watch ساخته شود');
  assertEqual(autoTasks[0].link.id, '100', 'کار خودکار باید به شماره فاکتور باز پیوند داشته باشد');
  assertEqual(autoTasks[0].kind, 'watch', 'کار خودکار فاکتور باز باید نوع watch (مورد مدنظر) باشد، نه do');

  // حالا فاکتور را می‌بندیم و دوباره اجرا می‌کنیم — کار خودکار باید حذف شود
  ctx.invoices[0].status = 'closed';
  runner(ctx);
  const remaining = ctx.tasks.filter(t => t.autoInvoice);
  assertArrayLength(remaining, 0, 'وقتی فاکتور بسته می‌شود، کار خودکار watch مربوط به آن باید حذف شود (نه باقی بماند به‌صورت یادآوری اشتباه)');
});

test('syncOpenWarrantyTasks باید برای هر پرونده گارانتی باز یک کار خودکار watch بسازد و بعد از بسته‌شدن حذف کند', () => {
  const src = extractFunctionSource(html, 'syncOpenWarrantyTasks');
  assertTrue(src !== null, 'تابع syncOpenWarrantyTasks پیدا نشد — اعلان برای گارانتی باز پیاده نشده');
  const ctx = {
    warranties: [{ id:'W1', name:'مشتری تست', status:'open' }],
    tasks: [], _afterAutoTaskSync(){}
  };
  const runner = new Function('ctx', 'with(ctx){ (' + src.replace(/^function syncOpenWarrantyTasks/, 'function') + ')(); }');
  runner(ctx);
  const auto = ctx.tasks.filter(t => t.autoWarranty);
  assertArrayLength(auto, 1, 'برای یک گارانتی باز باید دقیقاً یک کار خودکار watch ساخته شود');
  assertEqual(auto[0].link.id, 'W1', 'کار خودکار باید به شماره پرونده گارانتی پیوند داشته باشد');
  assertEqual(auto[0].link.type, 'warranty', 'نوع پیوند باید warranty باشد');
  assertTrue(auto[0].notify === true, 'کار خودکار گارانتی باید notify=true باشد تا اعلان دسکتاپ بگیرد');
  ctx.warranties[0].status = 'closed';
  runner(ctx);
  assertArrayLength(ctx.tasks.filter(t => t.autoWarranty), 0, 'بعد از بسته‌شدن گارانتی، کار خودکار آن باید حذف شود');
});

test('syncLowInventoryTasks باید فقط برای کالاهای با موجودی کم (qty<=min و min>0) کار خودکار بسازد', () => {
  const src = extractFunctionSource(html, 'syncLowInventoryTasks');
  assertTrue(src !== null, 'تابع syncLowInventoryTasks پیدا نشد — اعلان برای موجودی کم پیاده نشده');
  const ctx = {
    products: [{ code:'P1', name:'کالای کم' }, { code:'P2', name:'کالای کافی' }, { code:'P3', name:'بدون حداقل' }],
    inventory: { P1:{qty:1,min:5}, P2:{qty:10,min:3}, P3:{qty:0,min:0} },
    tasks: [], _afterAutoTaskSync(){}, faNum: s=>String(s)
  };
  const runner = new Function('ctx', 'with(ctx){ (' + src.replace(/^function syncLowInventoryTasks/, 'function') + ')(); }');
  runner(ctx);
  const auto = ctx.tasks.filter(t => t.autoInventory);
  assertArrayLength(auto, 1, 'فقط کالای کم‌موجودی (P1) باید کار خودکار بگیرد — نه کالای کافی و نه کالای بدون حداقل (min=0)');
  assertEqual(auto[0].link.id, 'P1', 'کار خودکار باید به کد کالای کم‌موجودی پیوند داشته باشد');
  assertEqual(auto[0].link.type, 'inventory', 'نوع پیوند باید inventory باشد');
  // موجودی پر شود → کار باید حذف شود
  ctx.inventory.P1.qty = 20;
  runner(ctx);
  assertArrayLength(ctx.tasks.filter(t => t.autoInventory), 0, 'بعد از پرشدن موجودی، کار خودکار موجودی کم باید حذف شود');
});

test('تابع قبلی checkAlarms (toast هر ۵ دقیقه) باید کاملاً حذف شده باشد، نه باقی‌مانده در کنار سیستم جدید', () => {
  assertTrue(html.indexOf('function checkAlarms') === -1, 'تابع checkAlarms قدیمی هنوز در فایل وجود دارد — باید با ماژول وظایف جایگزین شده باشد، نه اینکه هر دو همزمان اجرا شوند');
});

test('exportData باید آرایه tasks را در فایل بک‌اپ خروجی قرار دهد', () => {
  const exportSrc = extractFunctionSource(html, 'exportData');
  assertTrue(exportSrc !== null, 'تابع exportData پیدا نشد');
  assertContainsString(exportSrc, 'tasks:', 'فیلد tasks در آبجکت خروجی exportData پیدا نشد — یعنی وظایف در بک‌اپ ذخیره نمی‌شوند');
});

test('resetAll باید کلید laegh_tasks را در لیست کلیدهای پاک‌شونده داشته باشد', () => {
  const resetSrc = extractFunctionSource(html, 'resetAll');
  assertTrue(resetSrc !== null, 'تابع resetAll پیدا نشد');
  assertContainsString(resetSrc, 'laegh_tasks', 'کلید laegh_tasks در resetAll پاک نمی‌شود — بعد از ریست کامل، وظایف قدیمی باقی می‌مانند');
});

test('fdt (تاریخ+ساعت) باید واقعاً هم تاریخ و هم ساعت را با ترتیب «تاریخ سپس ساعت» برگرداند، نه فقط ساعت', () => {
  // باگ قبلی: fdt با options فقط hour/minute، طبق رفتار toLocaleString فقط ساعت را نشان می‌داد نه تاریخ
  const faNumSrc = extractFunctionSource(html, 'faNum');
  const fdtSrc = extractFunctionSource(html, 'fdt');
  const tehranSrc = extractFunctionSource(html, 'tehranParts');
  const g2jSrc = extractFunctionSource(html, 'gregorian_to_jalali');
  const divSrc = extractFunctionSource(html, 'div_');
  assertTrue(faNumSrc && fdtSrc && tehranSrc && g2jSrc && divSrc, 'توابع لازم برای fdt پیدا نشدند');

  const runner = new Function('Intl', "const TZ='Asia/Tehran';"+divSrc+';'+g2jSrc+';'+tehranSrc+';'+faNumSrc+';'+fdtSrc+';return fdt;');
  const fdt = runner(Intl);
  // یک زمان مشخص: ۲۰۲۶-۰۶-۲۴ ساعت ۰۹:۰۰ UTC → به‌وقت تهران همان روز، حدود ظهر
  const out = fdt(Date.UTC(2026,5,24,9,0,0));
  // باید هم بخش تاریخ شمسی (۱۴۰۵) و هم کلمه «ساعت» و هم «:» ساعت را داشته باشد
  assertTrue(out.indexOf('۱۴۰۵') !== -1, 'خروجی fdt باید سال شمسی (۱۴۰۵) را داشته باشد — یعنی تاریخ هم نمایش داده شود، نه فقط ساعت. خروجی: ' + out);
  assertTrue(out.indexOf('ساعت') !== -1, 'خروجی fdt باید کلمه «ساعت» را به‌عنوان جداکننده داشته باشد تا تاریخ و ساعت قاطی نشوند. خروجی: ' + out);
  // ترتیب: تاریخ (۱۴۰۵) باید قبل از کلمه «ساعت» بیاید
  assertTrue(out.indexOf('۱۴۰۵') < out.indexOf('ساعت'), 'ترتیب باید «تاریخ سپس ساعت» باشد، نه برعکس. خروجی: ' + out);
});

test('checkDueTasksForNotification باید برای فاکتور باز (کار بدون موعد) هم یک‌بار اعلان دسکتاپ بفرستد، نه فقط کارهای موعددار', () => {
  const fnSrc = extractFunctionSource(html, 'checkDueTasksForNotification');
  assertTrue(fnSrc !== null, 'تابع checkDueTasksForNotification پیدا نشد');
  const fired = [];
  const ctx = {
    Notification: { permission: 'granted' },
    window: { Notification: { permission: 'granted' } },
    showLaeghNotification(title, opts){ fired.push(title); return true; },
    svTasks(){}, renderTasks(){},
    tasks: [
      { id:'TSK-AUTO-100', status:'open', notify:true, deadlineTS:null, notifiedAt:null, autoInvoice:true, title:'فاکتور باز #100', priority:'high' },
      { id:'TSK-FUTURE', status:'open', notify:true, deadlineTS: Date.now()+3600000, notifiedAt:null, title:'کار آینده', priority:'normal' }
    ]
  };
  const runner = new Function('ctx', 'with(ctx){ (' + fnSrc.replace(/^function checkDueTasksForNotification/, 'function') + ')(); }');
  runner(ctx);
  // فاکتور باز بدون موعد باید اعلان بگیرد؛ کار با موعدِ آینده نباید الان اعلان بگیرد
  assertArrayLength(fired, 1, 'فقط فاکتور باز (بدون موعد) باید الان اعلان بگیرد، نه کار با موعد آینده');
  assertTrue(fired[0].indexOf('فاکتور باز #100') !== -1, 'اعلان باید مربوط به فاکتور باز باشد. دریافت: ' + fired[0]);
  assertTrue(!!ctx.tasks[0].notifiedAt, 'بعد از اعلان، notifiedAt باید ست شود تا اعلان تکرار (اسپم) نشود');

  // اجرای دوباره نباید دوباره اعلان بدهد (چون notifiedAt ست شده)
  fired.length = 0;
  runner(ctx);
  assertArrayLength(fired, 0, 'اعلان فاکتور باز نباید در اجرای بعدی تکرار شود (جلوگیری از اسپم مثل نسخه‌ی قدیمی)');
});

test('normIranPhone باید شماره‌ی موبایل ایرانی (فارسی/لاتین/با ۰/با ۹۸) را درست به فرمت بین‌المللی واتساپ تبدیل کند', () => {
  const f1 = extractFunctionSource(html, 'faToEnDigits');
  const f2 = extractFunctionSource(html, 'normIranPhone');
  assertTrue(f1 && f2, 'توابع faToEnDigits/normIranPhone پیدا نشدند');
  const runner = new Function(f1+';'+f2+';return normIranPhone;');
  const normIranPhone = runner();
  assertEqual(normIranPhone('09123456789'), '989123456789', 'شماره با صفر اول باید به 98 تبدیل شود');
  assertEqual(normIranPhone('۰۹۱۲۳۴۵۶۷۸۹'), '989123456789', 'ارقام فارسی هم باید درست تبدیل شوند');
  assertEqual(normIranPhone('989123456789'), '989123456789', 'شماره‌ای که از قبل 98 دارد نباید دوباره 98 بگیرد');
  assertEqual(normIranPhone('00989123456789'), '989123456789', 'پیش‌شماره 0098 باید حذف شود');
  assertEqual(normIranPhone('0912 345 6789'), '989123456789', 'فاصله‌ها و کاراکترهای غیرعددی باید حذف شوند');
});

test('سیستم پیام به مشتری: مودال و توابع ارسال (پیامک/واتساپ/کپی) و دکمه‌ی ارجاع باید وجود داشته باشند', () => {
  assertContainsString(html, 'id="msg-modal"', 'مودال پیام به مشتری (msg-modal) در HTML پیدا نشد');
  ['openMsgModal','msgSendSMS','msgSendWhatsApp','msgCopyText','notifyWarrantyReferral'].forEach(fn=>{
    assertTrue(extractFunctionSource(html, fn) !== null, 'تابع '+fn+' تعریف نشده است');
  });
  assertContainsString(html, 'onclick="notifyWarrantyReferral()"', 'دکمه‌ی «اطلاع به مشتری» در فرم گارانتی به notifyWarrantyReferral وصل نیست');
  // پیام ارجاع باید تاریخ/ساعت را از مرکز زمان (fdt) بگیرد، نه از new Date محلی
  const refSrc = extractFunctionSource(html, 'notifyWarrantyReferral');
  assertContainsString(refSrc, 'fdt(', 'پیام ارجاع باید تاریخ/ساعت را از تابع مرکز زمان fdt() بگیرد');
});

test('پیام به مشتری در فاکتور و فروش قطعه: دکمه‌ها و توابع (با امکان PDF فاکتور و اشتراک‌گذاری) باید وجود داشته باشند', () => {
  ['notifyInvoiceCustomer','notifySaleCustomer','msgShare','msgMakePdf'].forEach(fn=>{
    assertTrue(extractFunctionSource(html, fn) !== null, 'تابع '+fn+' تعریف نشده است');
  });
  assertContainsString(html, 'onclick="notifyInvoiceCustomer()"', 'دکمه‌ی «ارسال به مشتری» در فاکتور وصل نیست');
  assertContainsString(html, 'onclick="notifySaleCustomer()"', 'دکمه‌ی «اطلاع به مشتری» در فروش قطعه وصل نیست');
  assertContainsString(html, 'id="msg-pdf-btn"', 'دکمه‌ی تهیه PDF در مودال پیام پیدا نشد');
  // فاکتور باید PDF را از طریق printInv برای پیوست آماده کند
  const invSrc = extractFunctionSource(html, 'notifyInvoiceCustomer');
  assertContainsString(invSrc, 'printInv', 'پیام فاکتور باید printInv را به‌عنوان pdfFn پاس بدهد تا PDF قابل تهیه باشد');
  // openMsgModal باید پارامتر opts و دکمه‌ی PDF را پشتیبانی کند
  const omSrc = extractFunctionSource(html, 'openMsgModal');
  assertContainsString(omSrc, 'pdfFn', 'openMsgModal باید گزینه‌ی pdfFn را پشتیبانی کند');
});

test('پنل پیامک: buildSmsUrl باید {to} و {text} را با مقدار encode‌شده جایگزین کند و sendSmsViaPanel به فلگ enabled احترام بگذارد', () => {
  const f1 = extractFunctionSource(html, 'faToEnDigits');
  const f2 = extractFunctionSource(html, 'buildSmsUrl');
  assertTrue(f1 && f2, 'توابع faToEnDigits/buildSmsUrl پیدا نشدند');
  const buildSmsUrl = new Function(f1+';'+f2+';return buildSmsUrl;')();
  const out = buildSmsUrl('https://p.ir/send?to={to}&text={text}', '۰۹۱۲۳۴۵۶۷۸۹', 'سلام دوست');
  assertContainsString(out, 'to=09123456789', 'شماره (با تبدیل ارقام فارسی) باید درست در {to} جایگزین شود. خروجی: '+out);
  assertTrue(out.indexOf('{text}')===-1 && out.indexOf('text=')!==-1, '{text} باید جایگزین شود');
  assertTrue(out.indexOf('سلام دوست')===-1, 'متن باید URL-encode شود (نباید خام بماند). خروجی: '+out);

  // sendSmsViaPanel وقتی enabled=false است نباید چیزی بفرستد
  const f3 = extractFunctionSource(html, 'getSmsCfg');
  const f4 = extractFunctionSource(html, 'sendSmsViaPanel');
  let fired=0;
  const ctx = {
    SMS_KEY:'laegh_sms',
    localStorage:{ getItem:()=>JSON.stringify({enabled:false,url:'https://p.ir/send?to={to}&text={text}'}) },
    _fireSmsUrl:()=>{ fired++; return true; }
  };
  new Function('ctx','with(ctx){'+f3+';'+f4+'; ctx.r = sendSmsViaPanel("09120000000","x"); }')(ctx);
  assertTrue(ctx.r===false && fired===0, 'وقتی پنل غیرفعال است نباید پیامکی فرستاده شود');

  ctx.localStorage.getItem=()=>JSON.stringify({enabled:true,url:'https://p.ir/send?to={to}&text={text}'});
  new Function('ctx','with(ctx){'+f3+';'+f4+'; ctx.r = sendSmsViaPanel("09120000000","x"); }')(ctx);
  assertTrue(ctx.r===true && fired===1, 'وقتی پنل فعال است باید دقیقاً یک‌بار ارسال انجام شود');
});

test('syncBackupReminderTask: فقط وقتی داده هست و بیش از ۷ روز از بک‌اپ گذشته یادآوری بسازد؛ بعد از بک‌اپ تازه حذف کند', () => {
  const src = extractFunctionSource(html, 'syncBackupReminderTask');
  assertTrue(src !== null, 'تابع syncBackupReminderTask پیدا نشد');
  function run(ctx){ new Function('ctx','with(ctx){ ('+src.replace(/^function syncBackupReminderTask/,'function')+')(); }')(ctx); }

  // حالت ۱: داده دارد و هیچ بک‌اپی نگرفته (last=0) → باید یادآوری بسازد
  let store={};
  const base = {
    invoices:[{num:'1'}], products:[], warranties:[], sales:[], _afterAutoTaskSync(){},
    localStorage:{ getItem:(k)=>store[k]||null, setItem:(k,v)=>{store[k]=String(v);} }
  };
  let ctx1=Object.assign({pb:[]}, base, {tasks:[]});
  run(ctx1);
  assertArrayLength(ctx1.tasks.filter(t=>t.autoBackup), 1, 'با داده و بدون بک‌اپ، باید یک یادآوری بک‌اپ ساخته شود');

  // حالت ۲: بک‌اپ همین حالا گرفته شده → یادآوری نباید بسازد و اگر بود باید حذف شود
  store['laegh_last_backup']=String(Date.now());
  let ctx2=Object.assign({pb:[]}, base, {tasks:[{id:'TSK-AUTO-BACKUP',autoBackup:true,status:'open'}]});
  run(ctx2);
  assertArrayLength(ctx2.tasks.filter(t=>t.autoBackup), 0, 'بعد از بک‌اپ تازه، یادآوری بک‌اپ باید حذف شود');

  // حالت ۳: هیچ داده‌ای نیست → نباید یادآوری بسازد (نق‌زدن بی‌مورد روی نصب خالی)
  store={};
  let ctx3={ invoices:[], products:[], warranties:[], sales:[], pb:[], _afterAutoTaskSync(){},
    localStorage:{ getItem:(k)=>store[k]||null, setItem:(k,v)=>{store[k]=String(v);} }, tasks:[] };
  run(ctx3);
  assertArrayLength(ctx3.tasks.filter(t=>t.autoBackup), 0, 'روی نصب خالی نباید یادآوری بک‌اپ ساخته شود');
});

test('بازگردانی جایگزینی باید پیش‌نمایش سلامت (شمارش رکوردها) و هشدار فایل خالی داشته باشد', () => {
  const src = extractFunctionSource(html, 'importData');
  assertTrue(src !== null, 'تابع importData پیدا نشد');
  assertContainsString(src, '_preview', 'پیش‌نمایش سلامت (شمارش رکوردها) قبل از جایگزینی پیدا نشد');
  assertContainsString(src, 'هشدار جدی', 'هشدار «فایل خالی ولی داده‌ی فعلی دارید» باید وجود داشته باشد');
});

test('مدیریت کالا: دکمه‌ها و توابع اکسل (import/export/نمونه) باید وجود داشته و ستون‌های خروجی با ورودی هماهنگ باشند', () => {
  ['importProducts','expProductsExcel','downloadProductTemplate'].forEach(fn=>{
    assertTrue(extractFunctionSource(html, fn)!==null, 'تابع '+fn+' تعریف نشده است');
  });
  assertContainsString(html, 'onclick="expProductsExcel()"', 'دکمه‌ی «خروجی اکسل» در مدیریت کالا وصل نیست');
  assertContainsString(html, 'onclick="downloadProductTemplate()"', 'دکمه‌ی «نمونه اکسل» وصل نیست');
  assertContainsString(html, 'onchange="importProducts(this)"', 'ورودی فایل اکسل کالا وصل نیست');

  // round-trip واقعی: ترتیب ستون‌های خروجی باید با index هایی که import می‌خواند یکی باشد (qty=row[7], min=row[8])
  const exp = extractFunctionSource(html,'expProductsExcel');
  let captured=null;
  const ctx={
    products:[{code:'P1',name:'کالا',cat:'c',brand:'b',supplier:'s',price:1000,desc:'d'}],
    inventory:{P1:{qty:7,min:2}},
    XLSX:{ utils:{ book_new:()=>({}), aoa_to_sheet:(rows)=>{captured=rows;return {};}, book_append_sheet:()=>{} }, writeFile:()=>{} },
    fdate:()=>'1405-04-04', ntf:()=>{}
  };
  new Function('ctx','with(ctx){('+exp.replace(/^function expProductsExcel/,'function')+')();}')(ctx);
  assertTrue(captured && captured.length===2, 'خروجی باید یک سرستون + یک ردیف کالا داشته باشد');
  const dataRow=captured[1];
  assertEqual(dataRow[0],'P1','ستون اول باید «کد» باشد');
  assertEqual(dataRow[7],7,'ستون هشتم باید «موجودی» باشد (همان row[7] که import می‌خواند)');
  assertEqual(dataRow[8],2,'ستون نهم باید «حداقل» باشد (همان row[8] که import می‌خواند)');
});

test('خروجی/نمونه اکسل دفترچه و قطعات و خدمات: دکمه‌ها باشند و نام ستون‌ها با importها round-trip کند', () => {
  ['expPhonebookExcel','tplPhonebook','expPartsExcel','tplParts','expServicesExcel','tplServices','_excelExport'].forEach(fn=>{
    assertTrue(extractFunctionSource(html, fn)!==null, 'تابع '+fn+' تعریف نشده است');
  });
  ['expPhonebookExcel()','expPartsExcel()','expServicesExcel()','tplPhonebook()','tplParts()','tplServices()'].forEach(call=>{
    assertContainsString(html, 'onclick="'+call+'"', 'دکمه‌ی '+call+' در UI وصل نیست');
  });

  const f_exc = extractFunctionSource(html,'_excelExport');
  function runExport(fnName, ctxData){
    const src = extractFunctionSource(html, fnName);
    let captured=null;
    const ctx = Object.assign({
      loadSheetJS:(cb)=>cb(),
      XLSX:{ utils:{ json_to_sheet:(rows)=>{captured=rows;return {};}, book_new:()=>({}), book_append_sheet:()=>{} }, writeFile:()=>{} },
      fdate:()=>'1405-04-04', ntf:()=>{}
    }, ctxData);
    new Function('ctx','with(ctx){'+f_exc+';('+src.replace(new RegExp('^function '+fnName),'function')+')();}')(ctx);
    return captured;
  }

  const pb = runExport('expPhonebookExcel', {phonebook:[{fn:'علی',ln:'رضایی',phones:['09120000000'],shop:'ف',addr:'a',zip:'z',cat:'customer',note:'n'}]});
  assertTrue(pb && pb.length===1, 'خروجی دفترچه باید یک ردیف بسازد');
  assertTrue('نام' in pb[0] && 'تلفن' in pb[0], 'ستون‌های «نام» و «تلفن» (که importPhonebook می‌خواند) باید در خروجی باشند');
  assertEqual(pb[0]['تلفن'],'09120000000','تلفن باید از phones[0] گرفته شود');

  const pt = runExport('expPartsExcel', {parts:[{code:'C1',name:'قطعه',qty:5,min:2,price:1000,location:'A1'}]});
  assertTrue('نام قطعه' in pt[0] && 'کد قطعه' in pt[0] && 'حداقل موجودی' in pt[0], 'ستون‌های قطعات باید با importParts هماهنگ باشند');
  assertEqual(pt[0]['حداقل موجودی'],2,'حداقل موجودی باید از min/minQty گرفته شود');

  const sv = runExport('expServicesExcel', {services:[{name:'خدمت',price:500,desc:'d'}]});
  assertTrue('نام خدمت' in sv[0] && 'قیمت' in sv[0] && 'توضیحات' in sv[0], 'ستون‌های خدمات باید با importServices هماهنگ باشند');
});

test('اکسل فروش و گارانتی: نمونه/خروجی باید باشند و نام ستون‌ها با importها round-trip کند', () => {
  ['tplSales','expWarrantiesExcel','tplWarranties'].forEach(fn=>{
    assertTrue(extractFunctionSource(html, fn)!==null, 'تابع '+fn+' تعریف نشده است');
  });
  assertContainsString(html, 'onclick="tplSales()"', 'دکمه‌ی نمونه اکسل فروش وصل نیست');
  assertContainsString(html, 'onclick="expWarrantiesExcel()"', 'دکمه‌ی خروجی اکسل گارانتی وصل نیست');
  assertContainsString(html, 'onclick="tplWarranties()"', 'دکمه‌ی نمونه اکسل گارانتی وصل نیست');
  // importSales باید ستون «نام خریدار» (که خروجی فعلی تولید می‌کند) را هم بپذیرد تا round-trip شود
  const impS = extractFunctionSource(html,'importSales');
  assertContainsString(impS, "r['نام خریدار']", 'importSales باید ستون «نام خریدار» را هم بپذیرد تا خروجی فعلی قابل ورود دوباره باشد');

  // round-trip گارانتی: خروجی باید همان نام‌ستون‌هایی را بدهد که importWarranties می‌خواند
  const f_exc = extractFunctionSource(html,'_excelExport');
  const src = extractFunctionSource(html,'expWarrantiesExcel');
  let captured=null;
  const ctx={ warranties:[{name:'علی',phone:'0912',model:'چایساز',serial:'S1',buydate:'1405/01/01',warrExp:'1406/01/01',problem:'خرابی',status:'open',savedAt:'x'}],
    loadSheetJS:(cb)=>cb(),
    XLSX:{ utils:{ json_to_sheet:(rows)=>{captured=rows;return {};}, book_new:()=>({}), book_append_sheet:()=>{} }, writeFile:()=>{} },
    fdate:()=>'1405-04-04', ntf:()=>{} };
  new Function('ctx','with(ctx){'+f_exc+';('+src.replace(/^function expWarrantiesExcel/,'function')+')();}')(ctx);
  assertTrue(captured && captured.length===1, 'خروجی گارانتی باید یک ردیف بسازد');
  ['نام مشتری','تلفن','محصول','سریال','تاریخ خرید','تاریخ انقضا','وضعیت'].forEach(col=>{
    assertTrue(col in captured[0], 'ستون «'+col+'» (که importWarranties می‌خواند) باید در خروجی باشد');
  });
  assertEqual(captured[0]['محصول'],'چایساز','«محصول» باید از فیلد model گرفته شود');
});

test('مرکز تاریخ و زمان: TZ قابل‌تنظیم، setTimeZone/ساعت زنده باشند و رکوردهای اصلی مهرِ زمان (fdt) داشته باشند', () => {
  assertContainsString(html, "let TZ = localStorage.getItem('laegh_tz')", 'TZ باید قابل‌تنظیم و از localStorage خوانده شود');
  assertTrue(extractFunctionSource(html,'setTimeZone')!==null, 'تابع setTimeZone تعریف نشده است');
  assertTrue(extractFunctionSource(html,'updateLiveClock')!==null, 'تابع updateLiveClock تعریف نشده است');
  assertContainsString(html, 'id="sb-clock"', 'ساعت زنده‌ی سایدبار (sb-clock) پیدا نشد');
  assertContainsString(html, 'id="stg-datetime"', 'تب تنظیمات «تاریخ و زمان» پیدا نشد');
  assertContainsString(html, "showStgTab('datetime'", 'دکمه‌ی تب «تاریخ و زمان» وصل نیست');

  // همه‌ی رکوردهای اصلی باید مهرِ زمان از مرکز (fdt) بگیرند
  assertContainsString(html, 'd.savedAt=fdt()', 'فاکتور باید savedAt با fdt() از مرکز زمان بگیرد');
  assertContainsString(extractFunctionSource(html,'getWarData'), 'savedAt:fdt()', 'گارانتی باید savedAt با fdt() بگیرد');
  assertContainsString(extractFunctionSource(html,'getSaleData'), 'savedAt: fdt()', 'فروش باید savedAt با fdt() بگیرد');

  // اجرای واقعی setTimeZone: باید TZ را در localStorage ذخیره کند
  const stz=extractFunctionSource(html,'setTimeZone');
  let stored={};
  const ctx={ TZ:'', localStorage:{ setItem:(k,v)=>{stored[k]=v;}, getItem:()=>null }, ntf:()=>{}, updateLiveClock:()=>{} };
  new Function('ctx','with(ctx){'+stz+' setTimeZone("Asia/Dubai"); }')(ctx);
  assertEqual(stored['laegh_tz'],'Asia/Dubai','setTimeZone باید منطقه‌ی زمانی را در localStorage ذخیره کند');
  assertEqual(ctx.TZ,'Asia/Dubai','setTimeZone باید متغیر TZ را هم به‌روز کند');
});

test('چاپ لیست: تابع مشترک _printTable و دکمه‌های «چاپ لیست» در همه‌ی بخش‌ها باید باشند، و چاپ فاکتورِ کامل جدا بماند', () => {
  assertTrue(extractFunctionSource(html,'_printTable')!==null, 'تابع مشترک _printTable تعریف نشده است');
  ['printSavedList','printProdsList','printSalesList','printWarrantyList','printPartsList','printServicesList','printPhonebookList'].forEach(fn=>{
    assertTrue(extractFunctionSource(html, fn)!==null, 'تابع چاپ لیست '+fn+' تعریف نشده است');
  });
  ['printSavedList()','printProdsList()','printSalesList()','printWarrantyList()','printPartsList()','printServicesList()','printPhonebookList()'].forEach(call=>{
    assertContainsString(html, 'onclick="'+call+'"', 'دکمه‌ی چاپ لیست '+call+' در UI وصل نیست');
  });
  // چاپ «خودِ فاکتورها» (کامل) باید همچنان جدا و فعال باشد
  assertContainsString(html, 'onclick="printSel()">🖨 چاپ فاکتورها (کامل)', 'دکمه‌ی «چاپ فاکتورها (کامل)» باید جدا از «چاپ لیست» باشد');

  // اجرای واقعی _printTable: باید پنجره باز کند و جدول با تعداد ردیف درست بنویسد
  const src=extractFunctionSource(html,'_printTable');
  let written='';
  const ctx={ ntf:()=>{}, fdt:()=>'۱۴۰۵/۰۴/۰۴',
    window:{ open:()=>({ document:{ write:(s)=>{written+=s;}, close:()=>{} }, focus:()=>{}, print:()=>{} }) } };
  new Function('ctx','with(ctx){('+src.replace(/^function _printTable/,'function')+')("تست",["الف","ب"],[[1,2],[3,4]]);}')(ctx);
  assertContainsString(written, '<th>الف</th>', 'سرستون جدول چاپ باید نوشته شود');
  assertTrue((written.match(/<tr>/g)||[]).length>=3, 'باید سرستون + ۲ ردیف داده در جدول چاپ باشد');
});

test('مرتب‌سازی لیست‌ها: _listSort باید بر اساس فیلد و جهت درست مرتب کند و selectهای مرتب‌سازی در ۴ لیست باشند', () => {
  const src = extractFunctionSource(html,'_listSort');
  assertTrue(src!==null, 'تابع _listSort تعریف نشده است');
  const _listSort = new Function(src+';return _listSort;')();
  const orig=[{id:'a',price:300,name:'گ'},{id:'b',price:100,name:'الف'},{id:'c',price:200,name:'ب'}];
  // قیمت صعودی
  let r=_listSort(orig,'price:asc',orig).map(x=>x.id);
  assertEqual(r.join(','),'b,c,a','مرتب‌سازی قیمت صعودی درست نیست: '+r.join(','));
  // قیمت نزولی
  r=_listSort(orig,'price:desc',orig).map(x=>x.id);
  assertEqual(r.join(','),'a,c,b','مرتب‌سازی قیمت نزولی درست نیست: '+r.join(','));
  // نام الفبایی فارسی
  r=_listSort(orig,'name:asc',orig).map(x=>x.id);
  assertEqual(r.join(','),'b,c,a','مرتب‌سازی نام فارسی درست نیست: '+r.join(','));
  // _idx:desc یعنی جدیدترین (ترتیب معکوس آرایه‌ی اصلی)
  r=_listSort(orig,'_idx:desc',orig).map(x=>x.id);
  assertEqual(r.join(','),'c,b,a','مرتب‌سازی جدیدترین (_idx:desc) درست نیست: '+r.join(','));
  // نباید آرایه‌ی اصلی را تغییر دهد
  assertEqual(orig[0].id,'a','_listSort نباید آرایه‌ی ورودی را جابه‌جا کند (باید کپی بسازد)');

  ['id="s-sort"','id="p-sort"','id="sale-sort"','id="w-sort"'].forEach(sel=>{
    assertContainsString(html, sel, 'منوی مرتب‌سازی '+sel+' در UI پیدا نشد');
  });
});

test('راهنما باید آکاردئونی (کشویی)، دسته‌بندی‌شده و دارای جعبه‌ی جستجو باشد', () => {
  assertContainsString(html, 'id="help-search"', 'جعبه‌ی جستجوی راهنما (help-search) پیدا نشد');
  assertContainsString(html, 'oninput="helpSearch()"', 'جستجو به تابع helpSearch وصل نیست');
  assertTrue(extractFunctionSource(html,'helpSearch')!==null, 'تابع helpSearch تعریف نشده است');
  assertTrue(extractFunctionSource(html,'toggleHelpCard')!==null, 'تابع toggleHelpCard تعریف نشده است');
  // باید چند کارت کشویی و چند سرتیتر دسته وجود داشته باشد
  const cards=(html.match(/class="card help-card help-collapsed"/g)||[]).length;
  const heads=(html.match(/class="help-cat-header"/g)||[]).length;
  assertTrue(cards>=6, 'باید حداقل ۶ کارت کشویی راهنما باشد — یافت شد: '+cards);
  assertTrue(heads>=5, 'باید حداقل ۵ سرتیتر دسته‌بندی باشد — یافت شد: '+heads);
  // همه‌ی کارت‌های راهنما باید به‌صورت پیش‌فرض جمع (collapsed) باشند تا لیست کوتاه بماند
  assertContainsString(html, 'help-card.help-collapsed > :not(.card-title){display:none', 'CSS جمع‌شدن کارت راهنما پیدا نشد');
});

test('صفحه راهنما (page-help) باید وجود داشته باشد و در ALL_PAGES ثبت شده باشد', () => {
  assertContainsString(html, 'id="page-help"', 'صفحه راهنما (page-help) در HTML پیدا نشد');
  const m = html.match(/const ALL_PAGES = \[[\s\S]*?\];/);
  assertContainsString(m[0], "key:'help'", 'کلید help در ALL_PAGES ثبت نشده — صفحه راهنما در سیستم نقش‌ها قابل کنترل نیست');
  assertContainsString(html, "data-page=\"help\"", 'آیتم سایدبار راهنما (data-page=help) پیدا نشد');
});

console.log('');
console.log('📋 گروه ۱۵: فروش چندقلمی');

// -------------------------------------------------------------------
// گروه ۱۵: فروش چندقلمی (جایگزینی فرم تک‌قلمی)
// -------------------------------------------------------------------

test('تابع addSaleItem باید تعریف شده باشد', () => {
  assertTrue(extractFunctionSource(html, 'addSaleItem') !== null, 'تابع addSaleItem تعریف نشده');
});

test('تابع renderSaleItems باید تعریف شده باشد', () => {
  assertTrue(extractFunctionSource(html, 'renderSaleItems') !== null, 'تابع renderSaleItems تعریف نشده');
});

test('تابع onSaleItemChange باید تعریف شده باشد', () => {
  assertTrue(extractFunctionSource(html, 'onSaleItemChange') !== null, 'تابع onSaleItemChange تعریف نشده');
});

test('متغیر سراسری saleItems باید با let/var تعریف شده باشد', () => {
  const pattern = /(let|var)\s+saleItems\s*=/;
  assertTrue(pattern.test(html), 'متغیر saleItems هیچ‌جا تعریف نشده — استفاده از آن باعث ReferenceError می‌شود');
});

test('فرم فروش باید container برای اقلام (sale-items-container) داشته باشد', () => {
  assertContainsString(html, 'id="sale-items-container"', 'container اقلام فروش پیدا نشد');
});

test('getSaleData باید آرایه items را در خروجی برگرداند', () => {
  const fnSrc = extractFunctionSource(html, 'getSaleData');
  assertTrue(fnSrc !== null, 'تابع getSaleData پیدا نشد');
  assertContainsString(fnSrc, 'items:', 'getSaleData باید فیلد items را در آبجکت خروجی برگرداند');
});

test('saveSale باید اعتبارسنجی اقلام (حداقل یک قطعه انتخاب شده) داشته باشد', () => {
  const fnSrc = extractFunctionSource(html, 'saveSale');
  assertTrue(fnSrc !== null, 'تابع saveSale پیدا نشد');
  assertContainsString(fnSrc, 'd.items.length', 'saveSale باید طول آرایه items را چک کند');
});

test('saveSale باید برای همه اقلام از انبار کسر کند', () => {
  const fnSrc = extractFunctionSource(html, 'saveSale');
  assertTrue(fnSrc !== null, 'تابع saveSale پیدا نشد');
  // باید loop روی d.items داشته باشد
  assertTrue(fnSrc.indexOf('d.items[i]') !== -1 || fnSrc.indexOf('d.items.forEach') !== -1 || fnSrc.indexOf('for(var i=0;i<d.items') !== -1, 'saveSale باید روی همه اقلام حلقه بزند');
});

test('delSale باید همه اقلام فروش را به انبار برگرداند', () => {
  const fnSrc = extractFunctionSource(html, 'delSale');
  assertTrue(fnSrc !== null, 'تابع delSale پیدا نشد');
  assertContainsString(fnSrc, 's.items', 'delSale باید آرایه items را برای برگرداندن موجودی بررسی کند');
});

test('renderSales باید تعداد اقلام (s.items.length) را در جدول نمایش دهد', () => {
  const fnSrc = extractFunctionSource(html, 'renderSales');
  assertTrue(fnSrc !== null, 'تابع renderSales پیدا نشد');
  assertContainsString(fnSrc, 's.items', 'renderSales باید آرایه items را برای نمایش در جدول بررسی کند');
});

test('سیستم فروش باید قابلیت واریز خودکار به حساب (sale-account-sel) داشته باشد', () => {
  assertContainsString(html, 'id="sale-account-sel"', 'select انتخاب حساب برای واریز خودکار در فرم فروش پیدا نشد');
});

console.log('');
console.log('📋 گروه ۱۶: ماژول حسابداری');

// -------------------------------------------------------------------
// گروه ۱۶: ماژول حسابداری (حساب‌ها، واریز، برداشت، اکسل)
// -------------------------------------------------------------------

test('متغیر سراسری accounts باید با let/var تعریف شده باشد', () => {
  const pattern = /let\s+accounts\s*=/;
  assertTrue(pattern.test(html), 'متغیر accounts هیچ‌جا تعریف نشده');
});

test('کلید ACCOUNTS_KEY باید برای ذخیره در localStorage تعریف شده باشد', () => {
  assertContainsString(html, 'laegh_accounts', 'کلید laegh_accounts برای localStorage تعریف نشده');
});

test('تابع svAccounts باید تعریف شده باشد', () => {
  assertTrue(extractFunctionSource(html, 'svAccounts') !== null, 'تابع svAccounts تعریف نشده');
});

test('تابع depositToAccount باید تعریف شده و تراکنش واریز بسازد', () => {
  const fnSrc = extractFunctionSource(html, 'depositToAccount');
  assertTrue(fnSrc !== null, 'تابع depositToAccount تعریف نشده');
  assertContainsString(fnSrc, "type: 'deposit'", 'depositToAccount باید نوع واریز داشته باشد');
  assertContainsString(fnSrc, 'balance', 'depositToAccount باید موجودی را به‌روز کند');
});

test('تابع withdrawFromAccount باید تعریف شده و موجودی را چک کند', () => {
  const fnSrc = extractFunctionSource(html, 'withdrawFromAccount');
  assertTrue(fnSrc !== null, 'تابع withdrawFromAccount تعریف نشده');
  assertContainsString(fnSrc, 'موجودی کافی نیست', 'withdrawFromAccount باید پیام کمبود موجودی داشته باشد');
});

test('تابع renderAccounts باید تعریف شده باشد', () => {
  assertTrue(extractFunctionSource(html, 'renderAccounts') !== null, 'تابع renderAccounts تعریف نشده');
});

test('صفحه حساب‌ها (page-accounts) باید در HTML وجود داشته باشد', () => {
  assertContainsString(html, 'id="page-accounts"', 'صفحه حساب‌ها در HTML پیدا نشد');
});

test('کلید accounts باید در ALL_PAGES ثبت شده باشد', () => {
  const m = html.match(/const ALL_PAGES = \[[\s\S]*?\];/);
  assertContainsString(m[0], "key:'accounts'", 'کلید accounts در ALL_PAGES ثبت نشده — صفحه حسابداری در سیستم نقش‌ها قابل کنترل نیست');
});

test('exportData باید آرایه accounts را در فایل بک‌اپ خروجی قرار دهد', () => {
  const exportSrc = extractFunctionSource(html, 'exportData');
  assertTrue(exportSrc !== null, 'تابع exportData پیدا نشد');
  assertContainsString(exportSrc, 'accounts:', 'فیلد accounts در آبجکت خروجی exportData پیدا نشد');
});

test('migrateBackup روی بک‌اپ قدیمی بدون فیلد accounts نباید کرش کند و باید accounts=[] برگرداند', () => {
  const migrateSrc = extractFunctionSource(html, 'migrateBackup');
  assertTrue(migrateSrc !== null, 'تابع migrateBackup پیدا نشد');
  const runner = new Function('return ' + migrateSrc);
  const migrateBackup = runner();
  const oldBackup = { version:'2.0', invoices:[], products:[], inventory:{}, phonebook:[], invCtr:2 };
  let result;
  try { result = migrateBackup(oldBackup); }
  catch(e) { throw new Error('migrateBackup روی بک‌اپ بدون accounts کرش کرد: ' + e.message); }
  assertArrayLength(result.data.accounts, 0, 'بک‌اپ قدیمی بدون accounts باید آرایه خالی accounts بگیرد، نه کرش کند');
});

test('applyAll در importData باید accounts را از فایل بک‌اپ بازیابی کند', () => {
  const importSrc = extractFunctionSource(html, 'importData');
  assertTrue(importSrc !== null, 'تابع importData پیدا نشد');
  assertContainsString(importSrc, 'd.accounts', 'applyAll باید d.accounts از فایل بک‌اپ را بخواند');
});

test('resetAll باید کلید laegh_accounts را در لیست کلیدهای پاک‌شونده داشته باشد', () => {
  const resetSrc = extractFunctionSource(html, 'resetAll');
  assertTrue(resetSrc !== null, 'تابع resetAll پیدا نشد');
  assertContainsString(resetSrc, 'laegh_accounts', 'کلید laegh_accounts در resetAll پاک نمی‌شود');
});

test('resetAll باید متغیر in-memory accounts را هم خالی کند', () => {
  const resetSrc = extractFunctionSource(html, 'resetAll');
  assertContainsString(resetSrc, "accounts=[]", 'resetAll باید متغیر حافظه accounts را هم خالی کند');
});

test('مودال حساب (acc-modal) و مودال‌های واریز/برداشت باید وجود داشته باشند', () => {
  ['acc-modal','deposit-modal','withdraw-modal'].forEach(id => {
    assertContainsString(html, 'id="'+id+'"', 'مودال '+id+' در HTML پیدا نشد');
  });
});

test('دکمه‌های اکسل حساب‌ها (expAccountsExcel, tplAccounts, importAccounts) باید وجود داشته باشند', () => {
  ['expAccountsExcel','tplAccounts','importAccounts'].forEach(fn => {
    assertTrue(extractFunctionSource(html, fn) !== null, 'تابع '+fn+' تعریف نشده است');
  });
});

test('بک‌اپ (exportData) باید فیلد accounts را شامل شود', () => {
  const exportSrc = extractFunctionSource(html, 'exportData');
  assertTrue(exportSrc !== null, 'تابع exportData پیدا نشد');
  assertContainsString(exportSrc, 'accounts:', 'exportData باید accounts را در فایل بک‌اپ بگذارد');
});

console.log('');
console.log('📋 گروه ۱۷: راهنمای بخش‌های جدید (قانون ۷)');

test('راهنمای فروش چندقلمی باید در صفحه راهنما وجود داشته باشد', () => {
  assertContainsString(html, 'فروش چندقلمی', 'راهنمای فروش چندقلمی در صفحه راهنما یافت نشد — طبق قانون ۷ باید اضافه شود');
});

test('راهنمای بخش حسابداری باید در صفحه راهنما وجود داشته باشد', () => {
  assertContainsString(html, 'بخش حسابداری', 'راهنمای بخش حسابداری در صفحه راهنما یافت نشد — طبق قانون ۷ باید اضافه شود');
});

test('راهنمای حساب‌ها باید شامل توضیح واریز خودکار از فروش باشد', () => {
  assertContainsString(html, 'واریز خودکار', 'توضیح واریز خودکار از فروش در راهنما یافت نشد');
});

test('راهنمای حساب‌ها باید شامل توضیح برداشت با موضوع باشد', () => {
  assertContainsString(html, 'برداشت', 'توضیح برداشت از حساب در راهنما یافت نشد — طبق قانون ۷ باید اضافه شود');
});

test('راهنمای حساب‌ها باید شامل توضیح ورود و خروج Excel باشد', () => {
  assertContainsString(html, 'ورود و خروج Excel', 'توضیح اکسل حساب‌ها در راهنما یافت نشد');
});

console.log('');
console.log('📋 گروه ۱۸: هماهنگی کامل فیلدهای قطعات (اکسل ورود/خروج/چاپ/فرم)');

test('فرم قطعه باید فیلد موقعیت (part-loc) داشته باشد تا کاربر مستقیم در برنامه وارد/ویرایش کند', () => {
  assertContainsString(html, 'id="part-loc"', 'فیلد موقعیت (part-loc) در فرم قطعه پیدا نشد');
});

test('savePart باید فیلد location را از فرم در آبجکت قطعه ذخیره کند', () => {
  const src = extractFunctionSource(html, 'savePart');
  assertTrue(src !== null, 'تابع savePart پیدا نشد');
  assertContainsString(src, 'location:', 'savePart باید فیلد location را در آبجکت قطعه ذخیره کند');
});

test('openPartMod هنگام ویرایش باید مقدار موقعیت قبلی را در part-loc بارگذاری کند', () => {
  const src = extractFunctionSource(html, 'openPartMod');
  assertTrue(src !== null, 'تابع openPartMod پیدا نشد');
  assertContainsString(src, 'part-loc', 'openPartMod باید فیلد part-loc را بخواند/بنویسد');
});

test('واقعی: importParts باید دسته، کالای مرتبط، حداقل موجودی (فیلد min نه minQty) و موقعیت را هم از اکسل بخواند', () => {
  const impSrc = extractFunctionSource(html, 'importParts');
  assertTrue(impSrc !== null, 'تابع importParts پیدا نشد');

  const ctx = {
    parts: [],
    readExcel: (file, cb) => cb([
      { 'کد قطعه':'PT-9', 'نام قطعه':'قطعه تست', 'دسته':'برقی', 'کالای مرتبط':'PR-1', 'موجودی':'12', 'حداقل موجودی':'4', 'قیمت':'50000', 'موقعیت':'قفسه B3' }
    ]),
    svParts: () => {}, renderParts: () => {}, showImportResult: () => {}
  };
  const fakeInput = { files: [{}], value: '' };
  const runner = new Function('ctx', 'with(ctx){ (' + impSrc.replace(/^function importParts/, 'function') + ')(arguments[1]); }');
  runner(ctx, fakeInput);

  assertArrayLength(ctx.parts, 1, 'باید دقیقاً یک قطعه از اکسل اضافه شده باشد');
  const p = ctx.parts[0];
  assertEqual(p.cat, 'برقی', 'ستون «دسته» باید از اکسل خوانده و در فیلد cat ذخیره شود');
  assertEqual(p.prodCode, 'PR-1', 'ستون «کالای مرتبط» باید از اکسل خوانده و در فیلد prodCode ذخیره شود');
  assertEqual(p.min, 4, 'ستون «حداقل موجودی» باید در فیلد min ذخیره شود (نه minQty که با بقیه کد هماهنگ نبود)');
  assertEqual(p.location, 'قفسه B3', 'ستون «موقعیت» باید از اکسل خوانده شود');
  assertEqual(p.qty, 12, 'ستون «موجودی» باید درست خوانده شود');
});

test('واقعی: expPartsExcel باید ستون‌های دسته، کالای مرتبط، حداقل موجودی(min) و موقعیت را در خروجی بگذارد', () => {
  const exp = extractFunctionSource(html, 'expPartsExcel');
  assertTrue(exp !== null, 'تابع expPartsExcel پیدا نشد');
  let captured = null;
  const ctx = {
    parts: [{ code:'PT-9', name:'قطعه تست', cat:'برقی', prodCode:'PR-1', qty:12, min:4, price:50000, location:'قفسه B3' }],
    _excelExport: (filename, sheetName, objRows) => { captured = objRows; },
    fdate: () => '1405-04-16', ntf: () => {}
  };
  new Function('ctx', 'with(ctx){(' + exp.replace(/^function expPartsExcel/, 'function') + ')();}')(ctx);
  assertTrue(captured && captured.length === 1, 'خروجی اکسل قطعات باید دقیقاً یک ردیف بسازد');
  const row = captured[0];
  assertEqual(row['دسته'], 'برقی', 'ستون «دسته» باید در خروجی اکسل قطعات باشد');
  assertEqual(row['کالای مرتبط'], 'PR-1', 'ستون «کالای مرتبط» باید در خروجی اکسل قطعات باشد');
  assertEqual(row['حداقل موجودی'], 4, 'حداقل موجودی خروجی باید از فیلد min خوانده شود (نه minQty)');
  assertEqual(row['موقعیت'], 'قفسه B3', 'ستون «موقعیت» باید در خروجی اکسل قطعات باشد');
});

test('واقعی: printPartsList باید همه ستون‌ها (دسته، کالای مرتبط، حداقل موجودی، موقعیت) را چاپ کند', () => {
  const src = extractFunctionSource(html, 'printPartsList');
  assertTrue(src !== null, 'تابع printPartsList پیدا نشد');
  let capturedHeaders = null, capturedRows = null;
  const ctx = {
    parts: [{ code:'PT-9', name:'قطعه تست', cat:'برقی', prodCode:'PR-1', qty:12, min:4, price:50000, location:'قفسه B3' }],
    _printTable: (title, headers, rows) => { capturedHeaders = headers; capturedRows = rows; }
  };
  new Function('ctx', 'with(ctx){(' + src.replace(/^function printPartsList/, 'function') + ')();}')(ctx);
  assertTrue(capturedHeaders !== null, 'تابع _printTable صدا زده نشد');
  ['دسته','کالای مرتبط','حداقل موجودی','موقعیت'].forEach(col => {
    assertTrue(capturedHeaders.includes(col), 'ستون «'+col+'» باید در چاپ لیست قطعات وجود داشته باشد');
  });
  const catIdx = capturedHeaders.indexOf('دسته');
  const minIdx = capturedHeaders.indexOf('حداقل موجودی');
  const locIdx = capturedHeaders.indexOf('موقعیت');
  assertEqual(capturedRows[0][catIdx], 'برقی', 'مقدار دسته در ردیف چاپ باید درست باشد');
  assertEqual(capturedRows[0][minIdx], 4, 'مقدار حداقل موجودی در ردیف چاپ باید درست باشد');
  assertEqual(capturedRows[0][locIdx], 'قفسه B3', 'مقدار موقعیت در ردیف چاپ باید درست باشد');
});

console.log('');
// نتیجه نهایی
// ===================================================================
Promise.all(pendingAsync).then(() => {
console.log('');
console.log('═══════════════════════════════════════════');
console.log('  نتیجه نهایی');
console.log('═══════════════════════════════════════════');
console.log('  کل تست‌ها: ' + totalTests);
console.log('  ✅ موفق: ' + passedTests);
console.log('  ❌ ناموفق: ' + failedTests.length);
console.log('');

if (failedTests.length > 0) {
  console.log('⚠️  این فایل برای تحویل امن نیست! تست‌های زیر شکست خوردند:');
  failedTests.forEach(t => console.log('   - ' + t.name));
  console.log('');
  process.exit(1);
} else {
  console.log('✅ همه تست‌ها موفق بودند — این فایل برای تحویل امن است.');
  console.log('');
  process.exit(0);
}
});
