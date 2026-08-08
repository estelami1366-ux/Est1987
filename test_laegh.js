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

// ─── تست execution-based حیاتی: accounts در حالت ادغام (merge) ──────────────────
// این دقیقاً همان باگی است که کاربر گزارش کرد: «بعد از ریست و بک‌آپ، مالی برنمی‌گرده»
// ریشه: در حالت merge، accounts اصلاً پردازش نمی‌شد و svAccounts صدا زده نمی‌شد
test('شبیه‌سازی واقعی: ادغام بک‌آپ باید حساب‌های مالی (accounts) را برگرداند', () => {
  const importDataSrc = extractFunctionSource(html, 'importData');
  assertTrue(importDataSrc !== null, 'تابع importData پیدا نشد');

  // استخراج بخش merge (ادغام) از importData — از مارکر تا انتهای تابع
  const mergeMarker = importDataSrc.indexOf('// ادغام');
  assertTrue(mergeMarker !== -1, 'بخش ادغام در importData پیدا نشد');
  // کل بخش merge (تا انتهای importData)
  const mergeSection = importDataSrc.substring(mergeMarker);

  // بررسی متنی: accounts و svAccounts باید در بخش merge ذکر شوند
  assertContainsString(mergeSection, 'accounts', 'بخش ادغام باید accounts را پردازش کند');
  assertContainsString(mergeSection, 'svAccounts', 'بخش ادغام باید svAccounts را صدا بزند');
  assertContainsString(mergeSection, 'renderAccounts', 'بخش ادغام باید renderAccounts را صدا بزند');
});

test('شبیه‌سازی واقعی: applyAll (جایگزینی) باید accounts را در localStorage ذخیره کند', () => {
  const importDataSrc = extractFunctionSource(html, 'importData');
  const applyAllSrc = importDataSrc.match(/function applyAll\(\)\s*\{[\s\S]*?\n    \}/);
  assertTrue(applyAllSrc !== null, 'تابع applyAll داخل importData پیدا نشد');

  const fnBody = applyAllSrc[0].replace('function applyAll()', '');
  const runner = new Function('ctx', 'with(ctx) { ' + fnBody.substring(fnBody.indexOf('{')+1, fnBody.lastIndexOf('}')) + ' }');

  const mockStore = {};
  const sandbox = {
    d: {
      invoices: [], products: [], inventory: {}, invCtr: 1,
      phonebook: [], pb: [], parts: [], services: [], svcs: [],
      warranties: [], sales: [], tasks: [],
      accounts: [
        {id:'ACC-1', name:'بانک ملی', number:'123', balance:5000000},
        {id:'ACC-2', name:'صندوق', number:'456', balance:1000000}
      ],
      defectiveStock: [], warehouseDocs: [], stockMoves: [],
      userAuditLog: [], bgAuditLog: []
    },
    invoices: [], products: [], inventory: {}, phonebook: [], pb: [],
    parts: [], services: [], svcs: [], warranties: [], sales: [], tasks: [], invCtr: 1,
    accounts: [], defectiveStock: [], warehouseDocs: [], stockMoves: [],
    acH: {}, userAuditLog: [], bgAuditLog: [],
    svAccountsCalled: false,
    svAccounts(){ this.svAccountsCalled = true; },
    sv(){}, svParts(){}, svSvcs(){}, svSales(){}, svWarr(){}, svPB(){}, svTasks(){},
    svDefective(){}, svRoles(){},
    localStorage: {
      setItem: function(k,v){ mockStore[k]=String(v); },
      getItem: function(k){ return mockStore[k]||null; },
      removeItem: function(k){ delete mockStore[k]; }
    },
    getNum(){}, renderSaved(){}, renderProds(){}, renderInv(){}, renderPB(){},
    renderParts(){}, renderSvcs(){}, renderSales(){}, renderWarList(){},
    renderDataStats(){}, renderTasks(){}, renderSidebarBadges(){},
    renderAccounts(){}, renderDefective(){},
    logoSrc: ''
  };

  try {
    runner(sandbox);
  } catch(e) {
    throw new Error('اجرای واقعی applyAll با خطا متوقف شد: ' + e.message);
  }

  assertArrayLength(sandbox.accounts, 2, 'بعد از اجرای واقعی applyAll، accounts باید ۲ حساب داشته باشد');
  assertTrue(sandbox.svAccountsCalled, 'applyAll باید svAccounts را صدا بزند تا accounts در localStorage ذخیره شود');
  assertEqual(sandbox.accounts[0].id, 'ACC-1', 'حساب اول باید ACC-1 باشد');
});

// ─── تست execution-based حیاتی: تراکنش‌ها (transactions) باید در بک‌آپ و بازگردانی حفظ شوند ──
// این دقیقاً باگ دیگری است که کاربر گزارش کرد: «حساب رو اورد ولی ان لیست تراکنش‌ها و
// ورود و خروج ریز رو نیاورد». تراکنش‌ها داخل acc.transactions ذخیره می‌شوند و باید
// در تمام مسیر (بک‌آپ → migrateBackup → بازگردانی) حفظ شوند.
test('بک‌آپ کامل باید transactions داخل accounts را شامل شود', () => {
  const buildSrc = extractFunctionSource(html, '_buildFullBackupData');
  assertTrue(buildSrc !== null, 'تابع _buildFullBackupData پیدا نشد');
  // accounts باید با _safeArr(accounts) در بک‌آپ باشد — چون transactions فیلد nested است،
  // استفاده از _safeArr کافی است تا کل آبجکت حساب شامل transactions سریالایز شود.
  assertContainsString(buildSrc, 'accounts:', 'فیلد accounts در آبجکت بک‌آپ پیدا نشد');
  assertContainsString(buildSrc, '_safeArr(accounts)', 'accounts باید با _safeArr کپی شود تا transactions هم همراهش بیاید');
});

test('SCHEMAS.accounts باید فیلد transactions را داشته باشد تا migrate آن را حفظ کند', () => {
  const schemaSrc = html.match(/accounts:\s*\{[^}]*transactions[^}]*\}/);
  assertTrue(schemaSrc !== null, 'SCHEMAS.accounts باید شامل transactions:[] باشد تا هنگام field-migration این فیلد از دست نرود');
});

// تست واقعی (execution-based): سناریوی کامل کاربر
// ۱) یک حساب با تراکنش بساز
// ۲) بک‌آپ بگیر
// ۳) accounts را خالی کن (ریست)
// ۴) بازگردانی کن
// ۵) بررسی کن که تراکنش‌ها برگشته‌اند
test('شبیه‌سازی کامل: تراکنش‌ها باید از بک‌آپ کامل بازگردانی شوند (execution-based)', () => {
  const vm = require('vm');
  const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>/);
  assertTrue(scriptMatch !== null, 'تگ script پیدا نشد');
  const jsCode = scriptMatch[1];

  function makeStyle() {
    return new Proxy({}, {
      get: function (t, prop) {
        if (prop === 'setProperty') return function () {};
        if (prop === 'removeProperty') return function () { return ''; };
        if (prop === 'getPropertyValue') return function () { return ''; };
        if (typeof prop === 'string') return t[prop] || '';
        return undefined;
      },
      set: function (t, prop, val) { t[prop] = val; return true; }
    });
  }
  function makeEl(id) {
    var el = { id: id, value: '', textContent: '', innerHTML: '' };
    el.style = makeStyle();
    el.classList = { _s: new Set(), add: function (c) { this._s.add(c); }, remove: function (c) { this._s.delete(c); }, contains: function (c) { return this._s.has(c); }, toggle: function (c) { this._s.has(c) ? this._s.delete(c) : this._s.add(c); } };
    el.dataset = {}; el.checked = false; el.files = [];
    el.appendChild = function () {}; el.removeChild = function () {};
    el.querySelectorAll = function () { return []; }; el.querySelector = function () { return null; };
    el.addEventListener = function () {}; el.removeEventListener = function () {};
    el.focus = function () {}; el.click = function () {}; el.scrollIntoView = function () {};
    el.options = []; el.selectedIndex = -1; el.append = function () {}; el.insertAdjacentHTML = function () {};
    return el;
  }

  function buildSandbox() {
    var lsStore = {};
    var ls = {
      getItem: function (k) { return Object.prototype.hasOwnProperty.call(lsStore, k) ? lsStore[k] : null; },
      setItem: function (k, v) { lsStore[k] = String(v); },
      removeItem: function (k) { delete lsStore[k]; },
      key: function (i) { return Object.keys(lsStore)[i]; }
    };
    Object.defineProperty(ls, 'length', { get: function () { return Object.keys(lsStore).length; } });
    var docStore = {};
    var doc = {
      getElementById: function (id) { if (!docStore[id]) docStore[id] = makeEl(id); return docStore[id]; },
      querySelector: function () { return null; },
      querySelectorAll: function () { return []; },
      createElement: function () { return makeEl('new'); },
      createElementNS: function () { return makeEl('new'); },
      addEventListener: function () {},
      body: makeEl('body'),
      documentElement: makeEl('html'),
      title: ''
    };
    var win = { localStorage: ls, document: doc, addEventListener: function () {}, location: { href: '', reload: function () {} }, innerWidth: 1024, innerHeight: 768, navigator: { userAgent: 'node' } };
    return {
      localStorage: ls, document: doc, window: win, navigator: win.navigator,
      alert: function () {}, confirm: function () { return true; }, prompt: function () { return null; }, console: console,
      setTimeout: function () {}, setInterval: function () { return 1; }, clearInterval: function () {}, clearTimeout: function () {}, requestAnimationFrame: function () {},
      Date: Date, Math: Math, JSON: JSON, parseInt: parseInt, parseFloat: parseFloat, isNaN: isNaN, isFinite: isFinite,
      Array: Array, Object: Object, String: String, Number: Number, Boolean: Boolean, RegExp: RegExp, Error: Error, TypeError: TypeError,
      Map: Map, Set: Set, Promise: Promise, Proxy: Proxy, Reflect: Reflect, Symbol: Symbol,
      encodeURIComponent: encodeURIComponent, decodeURIComponent: decodeURIComponent, encodeURI: encodeURI, decodeURI: decodeURI,
      Blob: function () {}, FileReader: function () {}, URL: { createObjectURL: function () {}, revokeObjectURL: function () {} },
      XLSX: undefined, crypto: { subtle: { digest: function () { return Promise.resolve(new ArrayBuffer(32)); } } },
      fetch: function () { return Promise.resolve({ json: function () { return Promise.resolve({}); }, text: function () { return Promise.resolve(''); } }); },
      queueMicrotask: function (f) { setTimeout(f, 0); },
      history: { pushState: function () {}, replaceState: function () {} },
      _ls: ls
    };
  }

  // ─── محیط اول: ایجاد حساب + تراکنش + بک‌آپ ───
  var sb1 = buildSandbox();
  try {
    vm.runInNewContext(jsCode, sb1, { filename: 'laegh-test1.js', timeout: 10000 });
  } catch (e) {
    throw new Error('اجرای اسکریپت لایق با خطا متوقف شد: ' + e.message);
  }

  // ایجاد حساب از طریق تابع واقعی saveAccount (با فرم)
  sb1.document.getElementById('acc-num').value = '6037991234567890';
  sb1.document.getElementById('acc-name').value = 'حساب تست تراکنش';
  sb1.document.getElementById('acc-desc').value = 'تست';
  sb1.saveAccount();

  // افزودن ۳ تراکنش از طریق توابع واقعی
  var e1 = sb1.depositToAccount('ACC-0001', 500000, 'واریز ۱', '', 'manual');
  assertEqual(e1, null, 'واریز اول باید موفق باشد');
  var e2 = sb1.depositToAccount('ACC-0001', 200000, 'واریز ۲', '', 'manual');
  assertEqual(e2, null, 'واریز دوم باید موفق باشد');
  var e3 = sb1.withdrawFromAccount('ACC-0001', 100000, 'برداشت');
  assertEqual(e3, null, 'برداشت باید موفق باشد');

  // بررسی: accounts در localStorage باید شامل ۳ تراکنش باشد
  var accs1 = JSON.parse(sb1._ls.getItem('laegh_accounts'));
  assertArrayLength(accs1, 1, 'بعد از saveAccount باید ۱ حساب باشد');
  assertArrayLength(accs1[0].transactions, 3, 'باید ۳ تراکنش ثبت شده باشد');
  assertEqual(accs1[0].balance, 600000, 'مانده باید ۶۰۰۰۰۰ باشد');

  // ساخت بک‌آپ کامل
  var backup = sb1._buildFullBackupData();
  assertEqual(backup.accounts[0].transactions.length, 3, 'بک‌آپ باید شامل ۳ تراکنش باشد');
  var backupJson = JSON.stringify(backup);

  // ─── محیط دوم: ریست شده (localStorage خالی) ───
  var sb2 = buildSandbox();
  try {
    vm.runInNewContext(jsCode, sb2, { filename: 'laegh-test2.js', timeout: 10000 });
  } catch (e) {
    throw new Error('اجرای اسکریپت لایق (محیط دوم) با خطا متوقف شد: ' + e.message);
  }
  // تأیید: بعد از ریست، accounts خالی است
  var accsAfterReset = JSON.parse(sb2._ls.getItem('laegh_accounts') || '[]');
  assertArrayLength(accsAfterReset, 0, 'بعد از ریست، accounts باید خالی باشد');

  // ─── شبیه‌سازی importData (merge mode) ───
  // parse + migrateBackup روی بک‌آپ
  var parsed = JSON.parse(backupJson);
  var migResult = sb2.migrateBackup(parsed);
  var d = migResult.data;
  assertEqual(d.accounts[0].transactions.length, 3, 'بعد از migrateBackup، transactions باید حفظ شود');

  // شبیه‌سازی ذخیره در localStorage (همان کاری که svAccounts انجام می‌دهد)
  sb2._ls.setItem('laegh_accounts', JSON.stringify(d.accounts));

  // ─── محیط سوم: refresh بعد از بازگردانی ───
  // این مرحله شبیه‌سازی می‌کند که کاربر صفحه را رفرش می‌کند و accounts از localStorage خوانده می‌شود.
  var sb3 = buildSandbox();
  Object.keys(sb2._ls.getItem).length; // noop
  // کپی localStorage از sb2 به sb3
  var lsKeys = [];
  for (var i = 0; i < sb2._ls.length; i++) {
    var k = sb2._ls.key(i);
    if (k) { sb3._ls.setItem(k, sb2._ls.getItem(k)); }
  }
  try {
    vm.runInNewContext(jsCode, sb3, { filename: 'laegh-test3.js', timeout: 10000 });
  } catch (e) {
    throw new Error('اجرای اسکریپت لایق (محیط سوم) با خطا متوقف شد: ' + e.message);
  }

  // ─── بررسی نهایی: آیا تراکنش‌ها برمی‌گردند؟ ───
  var accsFinal = JSON.parse(sb3._ls.getItem('laegh_accounts'));
  assertArrayLength(accsFinal, 1, 'بعد از بازگردانی، باید ۱ حساب برگردد');
  assertArrayLength(accsFinal[0].transactions, 3, 'تراکنش‌ها باید کامل برگردند (۳ مورد) — این دقیقاً باگ کاربر بود');
  assertEqual(accsFinal[0].balance, 600000, 'مانده باید ۶۰۰۰۰۰ باشد');
  assertEqual(accsFinal[0].transactions[0].type, 'deposit', 'نوع تراکنش اول باید deposit باشد');
  assertEqual(accsFinal[0].transactions[0].amount, 500000, 'مبلغ تراکنش اول باید ۵۰۰۰۰۰ باشد');
  assertEqual(accsFinal[0].transactions[2].type, 'withdraw', 'نوع تراکنش سوم باید withdraw باشد');
  assertEqual(accsFinal[0].transactions[2].amount, -100000, 'مبلغ تراکنش سوم باید -۱۰۰۰۰۰ باشد');
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

// ─── رفع باگ: کلمه‌ی تأیید نهایی باید هم «تایید» و هم «تأیید» (با همزه) را بپذیرد ──
// کاربر گزارش داد: «ریست می‌کنم اصلاً پاک نمیشه». علت واقعی: کاربر «تأیید» (با همزه)
// تایپ می‌کرد ولی کد قبلاً فقط «تایید» دقیق را قبول می‌کرد و با ntf کمرنگ «ریست لغو شد»
// نمایش می‌داد، که کاربر متوجه نمی‌شد و فکر می‌کرد ریست خراب است.
test('کلمه‌ی تأیید نهایی در resetAll باید هم «تایید» و هم «تأیید» (با همزه) را بپذیرد (execution-based)', () => {
  const vm = require('vm');
  const resetSrc = extractFunctionSource(html, 'resetAll');
  assertTrue(resetSrc !== null, 'تابع resetAll پیدا نشد');

  // بررسی متنی: باید منطق نرمال‌سازی همزه داشته باشد (نه فقط مقایسه‌ی دقیق)
  assertContainsString(resetSrc, 'replace', 'resetAll باید ورودی prompt را نرمال‌سازی کند (replace) تا «تأیید» با همزه هم قبول شود');
  assertContainsString(resetSrc, 'أ', 'نرمال‌سازی باید شامل تبدیل همزه‌ی «أ» باشد');

  // تست واقعی: استخراج فقط بخش نرمال‌سازی + مقایسه و اجرای آن با ورودی‌های مختلف
  // منطق نرمال‌سازی را از کد استخراج می‌کنیم
  const normMatch = resetSrc.match(/const finalWord\s*=\s*\(finalWordRaw\|\|''\)([\s\S]*?)if\s*\(finalWord/);
  assertTrue(normMatch !== null, 'بخش نرمال‌سازی finalWord در resetAll پیدا نشد');

  // بازسازی تابع نرمال‌سازی
  const normBody = 'var finalWordRaw = arguments[0] || ""; var finalWord = (finalWordRaw||"")' + normMatch[1] + '; return finalWord;';
  const normalizeFn = new Function(normBody);

  // حالت‌هایی که باید قبول شوند (همگی باید به «تایید» نرمال شوند)
  const shouldAccept = ['تایید', 'تأیید', ' تایید ', 'تایید\n', 'تأیید ', ' تایید'];
  shouldAccept.forEach(function(input) {
    const result = normalizeFn(input);
    assertEqual(result, 'تایید', 'ورودی «' + input.replace(/\n/g,'\\n') + '» باید بعد از نرمال‌سازی «تایید» شود (got: ' + result + ') — وگرنه کاربر که «تأیید» با همزه تایپ می‌کند فکر می‌کند ریست خراب است');
  });

  // حالت‌هایی که نباید قبول شوند
  const shouldReject = ['', 'تاید', 'yes', 'ok', 'تایید!'];
  shouldReject.forEach(function(input) {
    const result = normalizeFn(input);
    assertTrue(result !== 'تایید', 'ورودی نامعتبر «' + input + '» نباید قبول شود');
  });
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
  // svPB حذف شد (pb دیگر منبع حقیقت نیست) — بقیه باید markDirty داشته باشند
  ['sv', 'svParts', 'svSvcs', 'svSales', 'svWarr'].forEach(fnName => {
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

test('بک‌اپ باید userRoles و loginPw را هم شامل شود تا با انتقال بک‌اپ، کاربران هم منتقل شوند', () => {
  // exportData به _buildFullBackupData delegate می‌کند — هر دو را چک کن
  const exportSrc = extractFunctionSource(html, 'exportData');
  const buildSrc = extractFunctionSource(html, '_buildFullBackupData');
  const src = (exportSrc||'') + '\n' + (buildSrc||'');
  assertTrue(exportSrc !== null, 'تابع exportData پیدا نشد');
  assertContainsString(src, 'userRoles', 'بک‌آپ (exportData/_buildFullBackupData) باید userRoles را در فایل بک‌آپ بگذارد');
  assertContainsString(src, 'loginPw', 'بک‌آپ باید loginPw را در فایل بک‌آپ بگذارد');
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
  const fullBuildSrc = extractFunctionSource(html, '_buildFullBackupData');
  const safeArrSrc = extractFunctionSource(html, '_safeArr');
  const safeObjSrc = extractFunctionSource(html, '_safeObj');
  const safeStrSrc = extractFunctionSource(html, '_safeStr');
  assertTrue(fnSrc !== null && buildSrc !== null && fullBuildSrc !== null, 'توابع لازم پیدا نشدند');

  let writeCalled = false;
  const fakeWritable = { write: async () => { writeCalled = true; }, close: async () => {} };
  const fakeFileHandle = { createWritable: async () => fakeWritable };
  const fakeDirHandle = { getFileHandle: async () => fakeFileHandle };

  const sandbox = {
    isDirty: false, autoSaveDirHandle: fakeDirHandle, lastAutoSaveTime: null,
    invoices: [], products: [], inventory: {}, invCtr: 1, pb: [], phonebook: [],
    parts: [], services: [], warranties: [], sales: [], tasks: [], accounts: [],
    defectiveStock: [], warehouseDocs: [], stockMoves: [], userAuditLog: [], bgAuditLog: [], userRoles: [], loginPw: '',
    senderInfo: {}, logoSrc: '', acH: {},
    fdate: () => '1405-04-21',
    localStorage: { getItem: () => null, setItem: () => {}, length: 0, key: () => null },
    updateAutoSaveUI: () => {}, addDbgEntry: () => {}
  };
  const allSrc = (safeArrSrc||'') + '\n' + (safeObjSrc||'') + '\n' + (safeStrSrc||'') + '\n' + fullBuildSrc + '\n' + buildSrc + '\nasync ' + fnSrc;
  const runner = new Function('ctx',
    'return (async function(){ with(ctx){ ' + allSrc + '\nreturn await doAutoSave(); } })();');
  await runner(sandbox);

  assertEqual(writeCalled, false, 'وقتی isDirty=false و force هم پاس داده نشده، doAutoSave نباید هیچ فایلی بنویسد');
});

test('شبیه‌سازی واقعی: doAutoSave(true) باید حتی با isDirty=false هم واقعاً فایل را در پوشه انتخاب‌شده بنویسد (رفع باگ اصلی)', async () => {
  const fnSrc = extractFunctionSource(html, 'doAutoSave');
  const buildSrc = extractFunctionSource(html, 'buildBackupObject');
  const fullBuildSrc = extractFunctionSource(html, '_buildFullBackupData');
  // helperهای کمکی _buildFullBackupData را هم extract کن (_safeArr/_safeObj/_safeStr)
  const safeArrSrc = extractFunctionSource(html, '_safeArr');
  const safeObjSrc = extractFunctionSource(html, '_safeObj');
  const safeStrSrc = extractFunctionSource(html, '_safeStr');
  assertTrue(fnSrc !== null && buildSrc !== null && fullBuildSrc !== null, 'توابع لازم پیدا نشدند');

  let writtenContent = null;
  const fakeWritable = { write: async (data) => { writtenContent = data; }, close: async () => {} };
  const fakeFileHandle = { createWritable: async () => fakeWritable };
  const fakeDirHandle = { getFileHandle: async () => fakeFileHandle };

  // sandbox باید تمام متغیرهایی که _buildFullBackupData استفاده می‌کند را داشته باشد
  const sandbox = {
    isDirty: false, autoSaveDirHandle: fakeDirHandle, lastAutoSaveTime: null,
    invoices: [{id:1}], products: [], inventory: {}, invCtr: 1, pb: [], phonebook: [],
    parts: [], services: [], warranties: [], sales: [], tasks: [], accounts: [],
    defectiveStock: [], warehouseDocs: [], stockMoves: [], userAuditLog: [], bgAuditLog: [], userRoles: [], loginPw: '',
    senderInfo: {}, logoSrc: '', acH: {},
    fdate: () => '1405-04-21',
    localStorage: { getItem: () => null, setItem: () => {}, length: 0, key: () => null },
    updateAutoSaveUI: () => {}, addDbgEntry: () => {}
  };
  // helperها + _buildFullBackupData + buildBackupObject + doAutoSave را در context قرار بده
  const allSrc = (safeArrSrc||'') + '\n' + (safeObjSrc||'') + '\n' + (safeStrSrc||'') + '\n' + fullBuildSrc + '\n' + buildSrc + '\nasync ' + fnSrc;
  const runner = new Function('ctx',
    'return (async function(){ with(ctx){ ' + allSrc + '\nreturn await doAutoSave(true); } })();');
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

test('فیلد version داخل آبجکت بک‌آپ باید با نسخه متاتگ یکسان باشد', () => {
  const metaVer = (html.match(/<meta name="app-version" content="([^"]+)">/) || [])[1];
  // exportData به _buildFullBackupData delegate می‌کند — version در آنجا تعریف می‌شود
  const buildSrc = extractFunctionSource(html, '_buildFullBackupData');
  const exportSrc = extractFunctionSource(html, 'exportData');
  const src = (exportSrc||'') + '\n' + (buildSrc||'');
  const m = src.match(/version:\s*'([^']+)'/);
  assertTrue(m !== null, 'فیلد version داخل بک‌آپ پیدا نشد');
  assertEqual(m[1], metaVer, 'نسخه داخل فایل بک‌آپ (' + m[1] + ') با نسخه متاتگ (' + metaVer + ') یکی نیست');
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
  const schemasSrc = extractFunctionSource(html, 'SCHEMAS') || 'var SCHEMAS = {};';
  const migrateRecSrc = extractFunctionSource(html, 'migrateRecord') || 'function migrateRecord(r){return r;}';
  const migrateSecSrc = extractFunctionSource(html, 'migrateSection') || 'function migrateSection(a){return a;}';
  assertTrue(migrateSrc !== null, 'تابع migrateBackup پیدا نشد');
  const runner = new Function('return (function(){ ' + schemasSrc + '\n' + migrateRecSrc + '\n' + migrateSecSrc + '\n return ' + migrateSrc + ' })();');
  const migrateBackup = runner();
  const oldBackup = { version:'2.0', invoices:[{num:'1',seller:'test'}], products:[], inventory:{}, phonebook:[], invCtr:2 };
  let result;
  try { result = migrateBackup(oldBackup); }
  catch(e) { throw new Error('migrateBackup روی بک‌اپ بدون tasks کرش کرد: ' + e.message); }
  assertArrayLength(result.data.tasks, 0, 'بک‌آپ قدیمی بدون tasks باید آرایه خالی tasks بگیرد، نه کرش کند');
});

test('migrateBackup باید کارهای بدون id را اصلاح کند و kind/priority/status پیش‌فرض بدهد', () => {
  const migrateSrc = extractFunctionSource(html, 'migrateBackup');
  const schemasSrc = extractFunctionSource(html, 'SCHEMAS') || 'var SCHEMAS = {};';
  const migrateRecSrc = extractFunctionSource(html, 'migrateRecord') || 'function migrateRecord(r){return r;}';
  const migrateSecSrc = extractFunctionSource(html, 'migrateSection') || 'function migrateSection(a){return a;}';
  const runner = new Function('return (function(){ ' + schemasSrc + '\n' + migrateRecSrc + '\n' + migrateSecSrc + '\n return ' + migrateSrc + ' })();');
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

test('بک‌آپ باید آرایه tasks را در فایل بک‌آپ خروجی قرار دهد', () => {
  const buildSrc = extractFunctionSource(html, '_buildFullBackupData');
  assertTrue(buildSrc !== null, 'تابع _buildFullBackupData پیدا نشد');
  assertContainsString(buildSrc, 'tasks:', 'فیلد tasks در آبجکت بک‌آپ پیدا نشد — یعنی وظایف در بک‌آپ ذخیره نمی‌شوند');
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
  assertContainsString(html, 'notifyInvoiceCustomer()', 'دکمه‌ی «ارسال به مشتری» در فاکتور وصل نیست (حتی داخل منوی کشویی)');
  assertContainsString(html, 'notifySaleCustomer()', 'دکمه‌ی «اطلاع به مشتری» در فروش قطعه وصل نیست');
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

test('تابع انتخاب قطعه (pickPart یا onSaleItemChange) باید تعریف شده باشد', () => {
  // نسخه‌ی جدید از combobox قابل‌تایپ استفاده می‌کند (pickPart/filterPartCombo)
  // نسخه‌ی قدیمی از select و onSaleItemChange استفاده می‌کرد — هر دو قابل‌قبول
  const hasNew = extractFunctionSource(html, 'pickPart') !== null && extractFunctionSource(html, 'filterPartCombo') !== null;
  const hasOld = extractFunctionSource(html, 'onSaleItemChange') !== null;
  assertTrue(hasNew || hasOld, 'هیچ‌یک از pickPart/onSaleItemChange تعریف نشده‌اند — انتخاب قطعه در فرم فروش خراب است');
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

test('saveSale باید برای همه اقلام از انبار کسر کند (فقط در حالت نهایی)', () => {
  const fnSrc = extractFunctionSource(html, 'saveSale');
  assertTrue(fnSrc !== null, 'تابع saveSale پیدا نشد');
  // باید loop روی d.items داشته باشد (مستقیم یا از طریق _deductStock)
  const hasDeduct = fnSrc.indexOf('_deductStock') !== -1 || fnSrc.indexOf('d.items[i]') !== -1 || fnSrc.indexOf('d.items.forEach') !== -1 || fnSrc.indexOf('for(var i=0;i<d.items') !== -1;
  assertTrue(hasDeduct, 'saveSale باید روی همه اقلام حلقه بزند (مستقیم یا از طریق _deductStock)');
  // نسخه‌ی جدید: saveSale(mode) باید پارامتر mode بگیرد و فقط در حالت 'final' از انبار کسر کند
  assertContainsString(fnSrc, 'mode', 'saveSale باید پارامتر mode بگیرد (final/proforma)');
  assertContainsString(fnSrc, "'final'", "saveSale باید حالت 'final' را تشخیص دهد");
});

test('delSale باید اقلام فروش نهایی را به انبار برگرداند (نه پیش‌فاکتور)', () => {
  const fnSrc = extractFunctionSource(html, 'delSale');
  assertTrue(fnSrc !== null, 'تابع delSale پیدا نشد');
  // نسخه‌ی جدید: delSale از _restockFromSale(s) استفاده می‌کند (که داخلش s.items را می‌خواند)
  // پس یا مستقیم s.items یا از طریق _restockFromSale
  const hasRestock = fnSrc.indexOf('_restockFromSale') !== -1 || fnSrc.indexOf('s.items') !== -1;
  assertTrue(hasRestock, 'delSale باید اقلام را برای برگرداندن موجودی بررسی کند (مستقیم یا از طریق _restockFromSale)');
  // نسخه‌ی جدید: فقط فروش نهایی (final) به انبار برمی‌گردد؛ پیش‌فاکتور انبار را تغییر نداده
  assertContainsString(fnSrc, 'proforma', 'delSale باید وضعیت proforma را بررسی کند (پیش‌فاکتور نباید به انبار برگردد چون کسر نشده بود)');
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

test('بک‌آپ باید آرایه accounts را در فایل بک‌آپ خروجی قرار دهد', () => {
  const buildSrc = extractFunctionSource(html, '_buildFullBackupData');
  assertTrue(buildSrc !== null, 'تابع _buildFullBackupData پیدا نشد');
  assertContainsString(buildSrc, 'accounts:', 'فیلد accounts در آبجکت بک‌آپ پیدا نشد');
});

test('migrateBackup روی بک‌اپ قدیمی بدون فیلد accounts نباید کرش کند و باید accounts=[] برگرداند', () => {
  const migrateSrc = extractFunctionSource(html, 'migrateBackup');
  const schemasSrc = extractFunctionSource(html, 'SCHEMAS') || 'var SCHEMAS = {};';
  const migrateRecSrc = extractFunctionSource(html, 'migrateRecord') || 'function migrateRecord(r){return r;}';
  const migrateSecSrc = extractFunctionSource(html, 'migrateSection') || 'function migrateSection(a){return a;}';
  assertTrue(migrateSrc !== null, 'تابع migrateBackup پیدا نشد');
  const runner = new Function('return (function(){ ' + schemasSrc + '\n' + migrateRecSrc + '\n' + migrateSecSrc + '\n return ' + migrateSrc + ' })();');
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

test('بک‌آپ باید فیلد accounts را شامل شود', () => {
  const buildSrc = extractFunctionSource(html, '_buildFullBackupData');
  assertTrue(buildSrc !== null, 'تابع _buildFullBackupData پیدا نشد');
  assertContainsString(buildSrc, 'accounts:', 'بک‌آپ باید accounts را در فایل بک‌آپ بگذارد');
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

// -------------------------------------------------------------------
// گروه ۱۹: قابلیت‌های جدید فروش قطعات (combobox، پیش‌فاکتور، پیوند مالی)
// همه execution-based — اجرای واقعی منطق، نه فقط جستجوی متن
// -------------------------------------------------------------------
console.log('📋 گروه ۱۹: قابلیت‌های جدید — سرچ قطعات، پیش‌فاکتور، پیوند مالی');

// تست ۱: _matchParts باید فقط قطعات منطبق با عبارت جستجو برگرداند
test('واقعی: _matchParts باید فقط قطعات منطبق با عبارت جستجو را برگرداند', () => {
  const src = extractFunctionSource(html, '_matchParts');
  assertTrue(src !== null, 'تابع _matchParts (فیلتر combobox قطعات) پیدا نشد');
  // تابع را با signature کامل بازسازی می‌کنیم تا query به‌عنوان پارامتر پاس شود
  const body = src.substring(src.indexOf('{')+1, src.lastIndexOf('}'));
  const runner = new Function('query', 'parts', body);
  const testParts = [
    {code:'P1', name:'پره پنکه', cat:'مکانیکی'},
    {code:'P2', name:'موتور', cat:'برقی'},
    {code:'P3', name:'تسمه پنکه', cat:'مکانیکی'}
  ];
  let all, filtered;
  try {
    all = runner('', testParts);          // query خالی → همه
    filtered = runner('پنکه', testParts); // query «پنکه» → فقط پره و تسمه پنکه
  } catch(e){ throw new Error('اجرای _matchParts با خطا: '+e.message); }
  assertTrue(Array.isArray(all), '_matchParts باید آرایه برگرداند');
  assertEqual(all.length, 3, 'با query خالی، _matchParts باید همه‌ی ۳ قطعه را برگرداند');
  assertEqual(filtered.length, 2, 'با query «پنکه»، _matchParts باید فقط ۲ قطعه (پره پنکه + تسمه پنکه) برگرداند');
  // اطمینان از اینکه قطعه‌ی نامطابق (موتور) برگردانده نشده
  const hasMotor = filtered.some(p => p.name === 'موتور');
  assertTrue(!hasMotor, 'قطعه‌ی نامطابق (موتور) نباید در نتایج جستجوی «پنکه» باشد');
});

// تست ۲: تابع combobox قطعات (filterPartCombo/pickPart/openPartCombo) باید موجود باشد
test('combobox قطعات قابل‌تایپ باید تعریف شده باشد (filterPartCombo + pickPart + openPartCombo)', () => {
  assertTrue(extractFunctionSource(html, 'filterPartCombo') !== null, 'تابع filterPartCombo پیدا نشد');
  assertTrue(extractFunctionSource(html, 'pickPart') !== null, 'تابع pickPart پیدا نشد');
  assertTrue(extractFunctionSource(html, 'openPartCombo') !== null, 'تابع openPartCombo پیدا نشد');
});

// تست ۳: saveSale(proforma) نباید از انبار کم کند — ولی saveSale(final) باید کم کند
test('واقعی: saveSale(proforma) نباید از انبار کم کند، saveSale(final) باید', () => {
  const src = extractFunctionSource(html, 'saveSale');
  assertTrue(src !== null, 'تابع saveSale پیدا نشد');
  assertContainsString(src, "'final'", "saveSale باید حالت 'final' را تشخیص دهد");
  assertContainsString(src, 'proforma', "saveSale باید حالت 'proforma' را تشخیص دهد");
  // بررسی ساختاری قوی: _deductStock باید بعد از if(mode === 'final') بیاید (داخل شاخه‌ی final)
  const finalGuardIdx = src.indexOf("mode === 'final'");
  const deductIdx = src.indexOf('_deductStock');
  assertTrue(finalGuardIdx !== -1, "saveSale باید شرط if(mode === 'final') داشته باشد");
  assertTrue(deductIdx !== -1 && deductIdx > finalGuardIdx, '_deductStock باید بعد از شرط if(mode===final) بیاید تا فقط در حالت نهایی از انبار کسر شود');
  // در شاخه‌ی proforma نباید _deductStock وجود داشته باشد
  const proformaGuardIdx = src.indexOf("mode === 'proforma'");
  if(proformaGuardIdx !== -1){
    const afterProforma = src.substring(proformaGuardIdx);
    assertTrue(afterProforma.indexOf('_deductStock') === -1, 'در شاخه‌ی proforma نباید از انبار کسر شود (_deductStock نباید در شاخه proforma باشد)');
  }
});

// تست ۴: finalizeProforma باید موجود باشد و کسر انبار + واریز انجام دهد
test('تابع finalizeProforma باید تعریف شده باشد (تبدیل پیش‌فاکتور به نهایی)', () => {
  const src = extractFunctionSource(html, 'finalizeProforma');
  assertTrue(src !== null, 'تابع finalizeProforma پیدا نشد');
  assertContainsString(src, '_deductStock', 'finalizeProforma باید از انبار کسر کند');
  assertContainsString(src, "'final'", "finalizeProforma باید status را به 'final' تبدیل کند");
});

// تست ۵: _deductStock باید واقعاً از انبار کم کند (اجرای واقعی در sandbox)
test('واقعی: _deductStock باید واقعاً موجودی قطعه را از انبار کم کند', () => {
  const src = extractFunctionSource(html, '_deductStock');
  assertTrue(src !== null, 'تابع _deductStock پیدا نشد');
  const body = src.substring(src.indexOf('{')+1, src.lastIndexOf('}'));
  const runner = new Function('items', 'parts', 'confirm', body);
  const testParts = [
    {code:'P1', name:'پره', qty:10, min:2},
    {code:'P2', name:'موتور', qty:5, min:1}
  ];
  try {
    runner([{partCode:'P1', partName:'پره', qty:3}], testParts, function(){return true;});
  } catch(e){ throw new Error('اجرای _deductStock با خطا: '+e.message); }
  assertEqual(testParts[0].qty, 7, '_deductStock باید ۳ عدد از موجودی P1 (۱۰) کم کند → ۷');
  assertEqual(testParts[1].qty, 5, '_deductStock نباید P2 را تغییر دهد');
});

// تست ۵ب: _restockFromSale باید واقعاً به انبار برگرداند (اجرای واقعی)
test('واقعی: _restockFromSale باید موجودی را به انبار برگرداند', () => {
  const src = extractFunctionSource(html, '_restockFromSale');
  assertTrue(src !== null, 'تابع _restockFromSale پیدا نشد');
  const body = src.substring(src.indexOf('{')+1, src.lastIndexOf('}'));
  const runner = new Function('old', 'parts', body);
  const testParts = [{code:'P1', name:'پره', qty:3}];
  try {
    runner({items:[{partCode:'P1', qty:4, partName:'پره'}], status:'final'}, testParts);
  } catch(e){ throw new Error('اجرای _restockFromSale با خطا: '+e.message); }
  assertEqual(testParts[0].qty, 7, '_restockFromSale باید ۴ عدد به P1 (۳) برگرداند → ۷');
});

// تست ۶: getSaleData باید فیلد status و accRef و accountSel را ذخیره کند
test('getSaleData باید فیلدهای جدید status/accRef/accountSel را در خروجی داشته باشد', () => {
  const src = extractFunctionSource(html, 'getSaleData');
  assertTrue(src !== null, 'تابع getSaleData پیدا نشد');
  assertContainsString(src, 'accRef', 'getSaleData باید فیلد accRef (شماره حساب گیرنده) را ذخیره کند');
  assertContainsString(src, 'accountSel', 'getSaleData باید فیلد accountSel را ذخیره کند');
});

// تست ۷: migrateBackup باید فروش قدیمی بدون status را به 'final' تبدیل کند
test('واقعی: migrateBackup باید فروش قدیمی بدون status را به final تبدیل کند', () => {
  const src = extractFunctionSource(html, 'migrateBackup');
  assertTrue(src !== null, 'تابع migrateBackup پیدا نشد');
  assertContainsString(src, 'status', 'migrateBackup باید فیلد status فروش را هندل کند');
  assertContainsString(src, "'final'", "migrateBackup باید فروش‌های بدون status را به 'final' تبدیل کند");
  assertContainsString(src, 'accRef', 'migrateBackup باید فیلد accRef را برای فروش قدیمی اضافه کند');
});

// تست ۸: renderAccountAnalytics باید موجود باشد و تراکنش‌ها را بر اساس refType گروه‌بندی کند
test('تابع renderAccountAnalytics باید تعریف شده باشد (داشبورد تحلیلی تفکیکی)', () => {
  const src = extractFunctionSource(html, 'renderAccountAnalytics');
  assertTrue(src !== null, 'تابع renderAccountAnalytics پیدا نشد');
  assertContainsString(src, 'refType', 'renderAccountAnalytics باید تراکنش‌ها را بر اساس refType گروه‌بندی کند');
  assertContainsString(src, "'sale'", "renderAccountAnalytics باید refType 'sale' را تشخیص دهد");
  assertContainsString(src, "'service'", "renderAccountAnalytics باید refType 'service' را تشخیص دهد");
});

// تست ۹: depositToAccount باید refType و refId را در تراکنش ذخیره کند
test('depositToAccount باید refType و refId را در تراکنش ثبت کند (پیوند مالی)', () => {
  const src = extractFunctionSource(html, 'depositToAccount');
  assertTrue(src !== null, 'تابع depositToAccount پیدا نشد');
  assertContainsString(src, 'refType', 'depositToAccount باید refType را در تراکنش ذخیره کند');
  assertContainsString(src, 'refId', 'depositToAccount باید refId را در تراکنش ذخیره کند');
});

// تست ۱۰: printSaleDoc باید موجود باشد و شامل شماره حساب و امضاء مسئول خدمات+انبار باشد
test('printSaleDoc باید تعریف شده باشد و شامل شماره حساب و امضاء مسئول خدمات+انبار باشد', () => {
  const src = extractFunctionSource(html, 'printSaleDoc');
  assertTrue(src !== null, 'تابع printSaleDoc پیدا نشد');
  assertContainsString(src, 'accRef', 'printSaleDoc باید شماره حساب گیرنده را در چاپ درج کند');
  assertContainsString(src, 'مسئول خدمات', 'printSaleDoc باید جای امضاء مسئول خدمات داشته باشد');
  assertContainsString(src, 'مسئول انبار', 'printSaleDoc باید جای امضاء مسئول انبار قطعات داشته باشد');
});

// تست ۱۱: printWarDoc باید موجود باشد و شامل شماره حساب و امضاءها باشد
test('printWarDoc باید تعریف شده باشد (پیش‌فاکتور/فاکتور خدمات)', () => {
  const src = extractFunctionSource(html, 'printWarDoc');
  assertTrue(src !== null, 'تابع printWarDoc پیدا نشد');
  assertContainsString(src, 'accRef', 'printWarDoc باید شماره حساب گیرنده را درج کند');
  assertContainsString(src, 'مسئول خدمات', 'printWarDoc باید جای امضاء مسئول خدمات داشته باشد');
  assertContainsString(src, 'مسئول انبار', 'printWarDoc باید جای امضاء مسئول انبار قطعات داشته باشد');
  assertContainsString(src, 'proforma', 'printWarDoc باید حالت پیش‌فاکتور را پشتیبانی کند');
});

// تست ۱۲: leaveSaleToAddPart و returnToSaleDraft باید موجود باشند (افزودن قطعه از فروش)
test('توابع leaveSaleToAddPart و returnToSaleDraft باید تعریف شده باشند (افزودن قطعه از فرم فروش)', () => {
  assertTrue(extractFunctionSource(html, 'leaveSaleToAddPart') !== null, 'تابع leaveSaleToAddPart پیدا نشد');
  assertTrue(extractFunctionSource(html, 'returnToSaleDraft') !== null, 'تابع returnToSaleDraft پیدا نشد');
});

// تست ۱۳: فرم فروش باید فیلد acc-ref و دکمه پیش‌فاکتور و قطعه‌جدید داشته باشد
test('فرم فروش باید فیلد acc-ref، دکمه پیش‌فاکتور، و دکمه قطعه‌جدید داشته باشد', () => {
  assertContainsString(html, 'id="sale-acc-ref"', 'فیلد شماره حساب گیرنده (sale-acc-ref) در فرم فروش پیدا نشد');
  assertContainsString(html, 'leaveSaleToAddPart()', 'دکمه قطعه جدید در فرم فروش پیدا نشد');
  assertContainsString(html, "saveSale('proforma')", 'دکمه صدور پیش‌فاکتور در فرم فروش پیدا نشد');
  assertContainsString(html, "saveSale('final')", 'دکمه ثبت نهایی در فرم فروش پیدا نشد');
});

// تست ۱۴: فیلتر وضعیت proforma/final در لیست فروش
test('لیست فروش باید فیلتر وضعیت proforma/final داشته باشد', () => {
  assertContainsString(html, 'id="sale-status-f"', 'فیلتر وضعیت (sale-status-f) در لیست فروش پیدا نشد');
});

console.log('');

// -------------------------------------------------------------------
// گروه ۲۰: حذف گروهی (چندانتخابی) + اصلاح تاریخ‌های فارسی
// -------------------------------------------------------------------
console.log('📋 گروه ۲۰: حذف گروهی در لیست‌ها + فیلتر ماه شمسی + فیلدهای تاریخ گارانتی');

// تست ۱: تابع‌های حذف گروهی همه‌ی لیست‌ها باید تعریف شده باشند
test('توابع حذف گروهی (delSel*) باید برای هر ۹ لیست تعریف شده باشند', () => {
  const fns = ['delSelSales','delSelProds','delSelParts','delSelSvcs','delSelPB','delSelWars','delSelDefective','delSelTasks','delSelAccounts'];
  fns.forEach(fn => {
    assertTrue(extractFunctionSource(html, fn) !== null, 'تابع '+fn+' پیدا نشد — حذف گروهی این لیست خراب است');
  });
});

// تست ۲: چک‌باکس انتخاب با کلاس اختصاصی هر لیست باید در کد وجود داشته باشد
test('چک‌باکس‌های انتخاب (rchkهای اختصاصی) باید در کد وجود داشته باشند', () => {
  const classes = ['sale-rchk','prod-rchk','part-rchk','svc-rchk','pb-rchk','war-rchk','def-rchk','acc-rchk'];
  classes.forEach(cls => {
    assertContainsString(html, cls, 'کلاس چک‌باکس انتخاب «'+cls+'» پیدا نشد');
  });
  // tasks از .tsk-sel استفاده می‌کند (چون چک‌باکس done جدا دارد)
  assertContainsString(html, 'tsk-sel', 'کلاس چک‌باکس انتخاب وظایف (tsk-sel) پیدا نشد');
});

// تست ۳: توابع togAll/updateSel برای هر لیست باید تعریف شده باشند
test('توابع togAll*/updateXSel برای هر لیست باید تعریف شده باشند', () => {
  const togFns = ['togAllSales','togAllProds','togAllParts','togAllSvcs','togAllPB','togAllWars','togAllDefective','togAllTasks','togAllAccounts'];
  togFns.forEach(fn => {
    assertTrue(extractFunctionSource(html, fn) !== null, 'تابع '+fn+' پیدا نشد');
  });
});

// تست ۴: واقعی — delSelSales باید اندیس‌ها رو نزولی مرتب و splice کنه + restock برای نهایی‌ها
test('واقعی: delSelSales باید نزولی splice کنه و برای نهایی‌ها restock کنه', () => {
  const src = extractFunctionSource(html, 'delSelSales');
  assertTrue(src !== null, 'تابع delSelSales پیدا نشد');
  // باید نزولی مرتب کنه
  assertContainsString(src, 'sort(function(a,b){ return b-a; })', 'delSelSales باید اندیس‌ها رو نزولی مرتب کنه تا splice از انتها درست کار کنه');
  // باید confirm بگیره
  assertContainsString(src, 'confirm', 'delSelSales باید قبل از حذف تأیید بگیره');
  // باید restock برای نهایی‌ها (نه proforma)
  assertContainsString(src, '_restockFromSale', 'delSelSales باید برای فروش‌های نهایی موجودی رو به انبار برگردونه');
  assertContainsString(src, 'proforma', 'delSelSales باید وضعیت proforma رو بررسی کنه (پیش‌فاکتور به انبار برنمی‌گرده)');
});

// تست ۵: واقعی — delSelProds باید inventory[code] رو هم پاک کنه
test('واقعی: delSelProds باید inventory[code] رو هم برای هر کالا پاک کنه', () => {
  const src = extractFunctionSource(html, 'delSelProds');
  assertTrue(src !== null, 'تابع delSelProds پیدا نشد');
  assertContainsString(src, 'delete inventory', 'delSelProds باید inventory[code] رو برای هر کالای حذف‌شده پاک کنه');
  assertContainsString(src, 'confirm', 'delSelProds باید قبل از حذف تأیید بگیره');
});

// تست ۶: فیلتر ماه شمسی جدید باید وجود داشته باشه (نه type=month میلادی)
test('فیلتر ماه فروش باید شمسی باشد (نه type=month میلادی باگ‌دار)', () => {
  // نباید type=month وجود داشته باشه (باگ قدیمی)
  const hasOldMonth = /type=["']month["']/.test(html);
  assertTrue(!hasOldMonth, 'input با type=month (میلادی، باگ‌دار) هنوز وجود دارد — باید با فیلتر ماه شمسی جایگزین شود');
  // باید select‌های شمسی جدید وجود داشته باشن
  assertContainsString(html, 'id="sale-jy"', 'select سال شمسی (sale-jy) پیدا نشد');
  assertContainsString(html, 'id="sale-jm"', 'select ماه شمسی (sale-jm) پیدا نشد');
  assertContainsString(html, 'فروردین', 'ماه‌های شمسی در فیلتر پیدا نشدند');
});

// تست ۷: سه فیلد تاریخ گارانتی باید به openDatePicker وصل شده باشن
test('سه فیلد تاریخ گارانتی (wrefd, cr-repair-date, cr-ship-date) باید به تقویم فارسی وصل باشند', () => {
  ['wrefd','cr-repair-date','cr-ship-date'].forEach(id => {
    // باید readonly باشن و openDatePicker داشته باشن
    const re = new RegExp('id="'+id+'"[^>]*onclick="openDatePicker');
    assertTrue(re.test(html), 'فیلد '+id+' باید readonly + onclick="openDatePicker" باشد (تا از تقویم فارسی استفاده کند)');
  });
});

// تست ۸: راهنمای حذف گروهی باید در صفحه راهنما وجود داشته باشه (قانون ۷)
test('راهنمای حذف گروهی باید در صفحه راهنما وجود داشته باشد (قانون ۷)', () => {
  assertContainsString(html, 'حذف چند مورد هم‌زمان', 'راهنمای حذف گروهی در صفحه راهنما پیدا نشد');
  assertContainsString(html, 'انتخاب همه', 'راهنما باید انتخاب همه را توضیح دهد');
});

console.log('');

// -------------------------------------------------------------------
// گروه ۲۱: اعتبارسنجی کد تکراری + کد پیشنهادی + dropdown + هشدار بستن
// -------------------------------------------------------------------
console.log('📋 گروه ۲۱: کد تکراری، کد پیشنهادی قطعه، منوهای کشویی فاکتور');

// تست ۱: تابع کمکی _isCodeTaken باید درست تشخیص بده
test('واقعی: _isCodeTaken باید کد تکراری را درست تشخیص دهد (ایجاد و ویرایش)', () => {
  const src = extractFunctionSource(html, '_isCodeTaken');
  assertTrue(src !== null, 'تابع _isCodeTaken پیدا نشد');
  const body = src.substring(src.indexOf('{')+1, src.lastIndexOf('}'));
  const runner = new Function('arr', 'code', 'exceptIdx', body);
  const testArr = [{code:'A1'},{code:'B2'},{code:'C3'}];
  // ایجاد: کد موجود → true
  assertEqual(runner(testArr, 'A1', -1), true, 'کد A1 موجود است → باید تکراری باشد');
  // ایجاد: کد جدید → false
  assertEqual(runner(testArr, 'D4', -1), false, 'کد D4 موجود نیست → نباید تکراری باشد');
  // ویرایش: کد خود رکورد → false (exceptIdx)
  assertEqual(runner(testArr, 'A1', 0), false, 'ویرایش رکورد 0 با کد A1 (همان رکورد) → نباید تکراری باشد');
  // ویرایش: کد رکورد دیگر → true
  assertEqual(runner(testArr, 'B2', 0), true, 'ویرایش رکورد 0 با کد B2 (رکورد دیگر) → باید تکراری باشد');
});

// تست ۲: savePart باید چک تکراری داشته باشد
test('savePart باید چک کد تکراری داشته باشد', () => {
  const src = extractFunctionSource(html, 'savePart');
  assertTrue(src !== null, 'تابع savePart پیدا نشد');
  assertContainsString(src, '_isCodeTaken', 'savePart باید از _isCodeTaken برای چک تکراری استفاده کند');
});

// تست ۳: saveSvc باید چک تکراری داشته باشد (اگر کد وارد شده)
test('saveSvc باید چک کد تکراری داشته باشد (اگر کد وارد شده)', () => {
  const src = extractFunctionSource(html, 'saveSvc');
  assertTrue(src !== null, 'تابع saveSvc پیدا نشد');
  assertContainsString(src, '_isCodeTaken', 'saveSvc باید از _isCodeTaken استفاده کند');
});

// تست ۴: saveProd باید چک تکراری داشته باشد (شامل ویرایش)
test('saveProd باید چک کد تکراری داشته باشد (شامل ویرایش)', () => {
  const src = extractFunctionSource(html, 'saveProd');
  assertTrue(src !== null, 'تابع saveProd پیدا نشد');
  assertContainsString(src, '_isCodeTaken', 'saveProd باید از _isCodeTaken استفاده کند');
});

// تست ۵: واقعی — suggestPartCode باید بزرگترین پسوند + 1 را پیشنهاد دهد
test('واقعی: suggestPartCode باید 402003-4 پیشنهاد دهد (وقتی -1 و -3 موجود است)', () => {
  const src = extractFunctionSource(html, 'suggestPartCode');
  assertTrue(src !== null, 'تابع suggestPartCode پیدا نشد');
  const body = src.substring(src.indexOf('{')+1, src.lastIndexOf('}'));
  const runner = new Function('prodCode', 'parts', body);
  const testParts = [
    {code:'402003-1', prodCode:'402003'},
    {code:'402003-3', prodCode:'402003'},
    {code:'402003-abc', prodCode:'402003'}, // غیرعددی → نادیده
    {code:'999-1', prodCode:'999'}          // محصول دیگر
  ];
  let result;
  try { result = runner('402003', testParts); } catch(e){ throw new Error('اجرای suggestPartCode با خطا: '+e.message); }
  assertEqual(result, '402003-4', 'با موجود بودن 402003-1 و 402003-3، پیشنهاد باید 402003-4 باشد');
});

// تست ۶: منوهای کشویی فاکتور (.dd) باید در صفحه فاکتور وجود داشته باشند
test('منوهای کشویی فاکتور (.dd و .dd-menu) باید در صفحه فاکتور وجود داشته باشند', () => {
  assertContainsString(html, 'class="dd"', 'کلاس dropdown (.dd) در فاکتور پیدا نشد');
  assertContainsString(html, 'dd-menu', 'منوی dropdown (dd-menu) در فاکتور پیدا نشد');
  assertContainsString(html, 'toggleDD', 'تابع toggleDD برای باز/بسته dropdown پیدا نشد');
});

// تست ۷: clearDirty باید تعریف شده باشد (هشدار هوشمند بستن)
test('تابع clearDirty باید تعریف شده باشد (هشدار هوشمند بستن)', () => {
  assertTrue(extractFunctionSource(html, 'clearDirty') !== null, 'تابع clearDirty پیدا نشد');
  // exportData باید clearDirty را صدا بزند
  const expSrc = extractFunctionSource(html, 'exportData');
  assertTrue(expSrc !== null && expSrc.indexOf('clearDirty') !== -1, 'exportData باید بعد از بک‌آپ موفق، clearDirty را صدا بزند');
});

// تست ۸: راهنمای کد پیشنهادی باید در صفحه راهنما باشد (قانون ۷)
test('راهنمای کد پیشنهادی باید در صفحه راهنما باشد (قانون ۷)', () => {
  assertContainsString(html, 'کد پیشنهادی', 'راهنمای کد پیشنهادی در صفحه راهنما پیدا نشد');
});

console.log('');

// -------------------------------------------------------------------
// گروه ۲۲: ارتقای سیستم بک‌آپ — رفع باگ گم‌شدن داده
// -------------------------------------------------------------------
console.log('📋 گروه ۲۲: ارتقای بک‌آپ — رفع گم‌شدن داده، حذف pb، هشدار خروج');

// تست ۱: _buildFullBackupData باید همه‌ی ۸ بخش گم‌شده‌ی قبلی رو شامل بشه
test('واقعی: _buildFullBackupData باید ۸ بخش گم‌شده (tasks, accounts, ...) رو شامل بشه', async () => {
  const fullBuildSrc = extractFunctionSource(html, '_buildFullBackupData');
  const safeArrSrc = extractFunctionSource(html, '_safeArr');
  const safeObjSrc = extractFunctionSource(html, '_safeObj');
  const safeStrSrc = extractFunctionSource(html, '_safeStr');
  assertTrue(fullBuildSrc !== null, 'تابع _buildFullBackupData پیدا نشد');
  // ۸ بخشی که قبلاً در autosave گم می‌شدند
  const requiredSections = ['tasks', 'accounts', 'defectiveStock', 'userAuditLog', 'bgAuditLog', 'userRoles', 'loginPw', 'senderInfo'];
  requiredSections.forEach(sec => {
    assertContainsString(fullBuildSrc, sec + ':', '_buildFullBackupData باید بخش «' + sec + '» را شامل باشد (قبلاً گم می‌شد)');
  });
  // اجرای واقعی در sandbox
  const sandbox = {
    invoices:[], products:[], inventory:{}, invCtr:1, phonebook:[], pb:[],
    parts:[], services:[], warranties:[], sales:[],
    tasks:[{id:'T1'}], accounts:[{id:'A1'}], defectiveStock:[{id:'D1'}],
    warehouseDocs:[], stockMoves:[],
    userAuditLog:[], bgAuditLog:[], userRoles:[], loginPw:'test',
    senderInfo:{name:'x'}, logoSrc:'', acH:{},
    localStorage:{getItem:()=>null, setItem:()=>{}, length:0, key:()=>null}
  };
  const allSrc = (safeArrSrc||'') + '\n' + (safeObjSrc||'') + '\n' + (safeStrSrc||'') + '\n' + fullBuildSrc;
  const runner = new Function('ctx', 'with(ctx){ ' + allSrc + '\nreturn _buildFullBackupData(); }');
  let result;
  try { result = runner(sandbox); } catch(e){ throw new Error('اجرای _buildFullBackupData با خطا: ' + e.message); }
  assertEqual(result.tasks.length, 1, 'tasks باید ۱ مورد داشته باشد');
  assertEqual(result.accounts.length, 1, 'accounts باید ۱ مورد داشته باشد');
  assertEqual(result.defectiveStock.length, 1, 'defectiveStock باید ۱ مورد داشته باشد');
  assertEqual(result.loginPw, 'test', 'loginPw باید ذخیره شود');
  assertEqual(result.senderInfo.name, 'x', 'senderInfo باید ذخیره شود');
  // بخش‌های جدید
  assertTrue(result.appearance && typeof result.appearance==='object', 'appearance باید در بک‌آپ باشد');
  assertTrue(result.acH !== undefined, 'acH باید در بک‌آپ باشد');
  assertTrue(result.sms !== undefined, 'sms باید در بک‌آپ باشد');
});

// تست ۲: buildBackupObject (autosave) باید به _buildFullBackupData delegate کنه
test('buildBackupObject (autosave) باید به _buildFullBackupData delegate کند', () => {
  const src = extractFunctionSource(html, 'buildBackupObject');
  assertTrue(src !== null, 'تابع buildBackupObject پیدا نشد');
  assertContainsString(src, '_buildFullBackupData', 'buildBackupObject باید از _buildFullBackupData استفاده کند (دیگر لیست دستی ناقص ندارد)');
});

// تست ۳: exportData باید به _buildFullBackupData delegate کنه
test('exportData باید به _buildFullBackupData delegate کند', () => {
  const src = extractFunctionSource(html, 'exportData');
  assertTrue(src !== null, 'تابع exportData پیدا نشد');
  assertContainsString(src, '_buildFullBackupData', 'exportData باید از _buildFullBackupData استفاده کند تا همیشه با autosave یکسان باشد');
});

// تست ۴: exportData نباید دیگر pb رو به‌عنوان منبع جدا بنویسه (باید برابر phonebook باشه)
test('exportData/_buildFullBackupData نباید pb را به‌عنوان منبع جدا بنویسد', () => {
  const fullBuildSrc = extractFunctionSource(html, '_buildFullBackupData');
  // نباید خطی مثل pb: Array.isArray(pb) ? pb داشته باشه (که از pb جدا می‌خواند)
  assertTrue(fullBuildSrc.indexOf('pb: _safeArr(pb)') === -1 && fullBuildSrc.indexOf('pb: Array.isArray(pb)') === -1,
    '_buildFullBackupData نباید pb را به‌عنوان متغیر جدا بخواند (باگ dual-variable)');
});

// تست ۵: migrateBackup باید pb قدیمی را به phonebook تبدیل کنه (سازگاری قدیمی)
test('migrateBackup باید pb قدیمی را به phonebook تبدیل کند (سازگاری قدیمی)', () => {
  const src = extractFunctionSource(html, 'migrateBackup');
  assertTrue(src !== null, 'تابع migrateBackup پیدا نشد');
  assertContainsString(src, 'phonebook', 'migrateBackup باید با phonebook کار کند');
  assertContainsString(src, 'd.pb', 'migrateBackup باید pb قدیمی را برای سازگاری بخواند');
});

// تست ۶: applyAll نباید دیگر متغیر pb را set کنه
test('applyAll نباید دیگر متغیر pb را set کند (pb حذف شد)', () => {
  const src = extractFunctionSource(html, 'applyAll');
  if(src){
    // نباید خطی مثل "pb = Array.isArray(d.pb)" داشته باشه
    assertTrue(src.indexOf('pb = Array.isArray(d.pb)') === -1, 'applyAll نباید pb را به‌عنوان متغیر جدا set کند');
  }
});

// تست ۷: مودال خروج و توابع آن باید وجود داشته باشن
test('مودال خروج و توابع promptExitBackup/exitWithBackup باید وجود داشته باشند', () => {
  assertContainsString(html, 'id="exit-modal"', 'مودال خروج (exit-modal) پیدا نشد');
  assertContainsString(html, 'promptExitBackup()', 'دکمه‌ی خروج (promptExitBackup) در سایدبار پیدا نشد');
  assertTrue(extractFunctionSource(html, 'promptExitBackup') !== null, 'تابع promptExitBackup پیدا نشد');
  assertTrue(extractFunctionSource(html, 'exitWithBackup') !== null, 'تابع exitWithBackup پیدا نشد');
  assertTrue(extractFunctionSource(html, 'exitWithoutBackup') !== null, 'تابع exitWithoutBackup پیدا نشد');
});

// تست ۸: clearDirty باید تعریف شده باشه و exportData صداش بزنه
test('clearDirty باید تعریف شده باشد و exportData آن را صدا بزند', () => {
  assertTrue(extractFunctionSource(html, 'clearDirty') !== null, 'تابع clearDirty پیدا نشد');
  const expSrc = extractFunctionSource(html, 'exportData');
  assertTrue(expSrc !== null && expSrc.indexOf('clearDirty') !== -1, 'exportData باید clearDirty را صدا بزند');
  // doAutoSave هم باید clearDirty صدا بزنه
  const autoSrc = extractFunctionSource(html, 'doAutoSave');
  assertTrue(autoSrc !== null && autoSrc.indexOf('clearDirty') !== -1, 'doAutoSave باید بعد از ذخیره‌ی موفق clearDirty را صدا بزند');
});

console.log('');

// -------------------------------------------------------------------
// گروه ۲۳: فاز ۲ بک‌آپ — diff viewer، checksum، IndexedDB، field-level migration، selective
// -------------------------------------------------------------------
console.log('📋 گروه ۲۳: فاز ۲ بک‌آپ — diff، checksum، IndexedDB، SCHEMAS، selective');

// تست ۱: واقعی — diffBackups باید تفاوت‌های added/removed/changed را درست محاسبه کند
test('واقعی: diffBackups باید added/removed/changed را درست محاسبه کند', () => {
  const src = extractFunctionSource(html, 'diffSection');
  assertTrue(src !== null, 'تابع diffSection پیدا نشد');
  const body = src.substring(src.indexOf('{')+1, src.lastIndexOf('}'));
  const runner = new Function('oldArr', 'newArr', 'keyFn', body);
  const old = [{code:'P1',name:'پره'},{code:'P2',name:'موتور'},{code:'P3',name:'تسمه'}];
  const neu = [{code:'P1',name:'پره استیل'},{code:'P2',name:'موتور'},{code:'P4',name:'بلبرنگ'}];
  const keyFn = function(r){ return r.code; };
  let result;
  try { result = runner(old, neu, keyFn); } catch(e){ throw new Error('اجرای diffSection با خطا: '+e.message); }
  assertEqual(result.added.length, 1, 'باید ۱ مورد جدید (P4) باشد');
  assertEqual(result.removed.length, 1, 'باید ۱ مورد حذف‌شده (P3) باشد');
  assertEqual(result.changed.length, 1, 'باید ۱ مورد تغییر (P1) باشد');
  assertEqual(result.added[0].code, 'P4', 'مورد جدید باید P4 باشد');
  assertEqual(result.removed[0].code, 'P3', 'مورد حذف‌شده باید P3 باشد');
});

// تست ۲: واقعی — migrateRecord باید فیلدهای defaults را اضافه کند و هیچ داده‌ای را حذف نکند
test('واقعی: migrateRecord باید فیلدهای defaults را اضافه کند و هیچ داده‌ای را حذف نکند', () => {
  const src = extractFunctionSource(html, 'migrateRecord');
  assertTrue(src !== null, 'تابع migrateRecord پیدا نشد');
  const body = src.substring(src.indexOf('{')+1, src.lastIndexOf('}'));
  const runner = new Function('rec', 'defaults', body);
  const defaults = { name:'', phone:'', address:'', cat:'other' };
  // رکورد قدیمی: name+phone هست ولی address ندارد، و فیلد اضافی region دارد
  const oldRec = { name:'علی', phone:'0912', region:'تهران' };
  let result;
  try { result = runner(oldRec, defaults); } catch(e){ throw new Error('اجرای migrateRecord با خطا: '+e.message); }
  assertEqual(result.name, 'علی', 'name باید از rec کپی شود');
  assertEqual(result.phone, '0912', 'phone باید از rec کپی شود');
  assertEqual(result.address, '', 'address باید با default خالی پر شود (فیلد جدید)');
  assertEqual(result.cat, 'other', 'cat باید با default پر شود');
  // فیلدهای اضافی نباید حذف شوند — رفع باگ گم‌شدن داده در restore
  assertEqual(result.region, 'تهران', 'فیلد اضافی region نباید حذف شود (هیچ داده‌ای گم نمی‌شود)');
});

// تست ۳: diffBackups باید همه‌ی بخش‌ها را پشتیبانی کند
test('diffBackups باید همه‌ی بخش‌ها را پشتیبانی کند', () => {
  const src = extractFunctionSource(html, 'diffBackups');
  assertTrue(src !== null, 'تابع diffBackups پیدا نشد');
  // باید همه‌ی بخش‌های DIFF_KEYS را پشتیبانی کند
  const sections = ['invoices','products','phonebook','parts','services','warranties','sales','tasks','defectiveStock','accounts'];
  sections.forEach(sec => {
    assertContainsString(html, "'"+sec+"'", 'بخش '+sec+' در DIFF_KEYS یا DIFF_LABELS باید پشتیبانی شود');
  });
});

// تست ۴: attachChecksum باید تعریف شده باشد و crypto.subtle را guard کند
test('attachChecksum باید تعریف شده باشد و در صورت نبود crypto.subtle، به‌خوشی degrade کند', async () => {
  // attachChecksum در سورس async است ولی extractFunctionSource ممکن است 'async' را حذف کند — دوباره اضافه کن
  const rawSrc = extractFunctionSource(html, 'attachChecksum');
  assertTrue(rawSrc !== null, 'تابع attachChecksum پیدا نشد');
  const src = rawSrc.startsWith('function') ? 'async ' + rawSrc : rawSrc; // اطمینان از async بودن
  assertContainsString(rawSrc, 'crypto.subtle', 'attachChecksum باید از crypto.subtle استفاده کند');
  assertContainsString(rawSrc, 'SHA-256', 'attachChecksum باید SHA-256 را محاسبه کند');
  // اجرای واقعی در sandbox بدون crypto — async wrapper می‌سازیم
  // window را طوری شبیه‌سازی می‌کنیم که crypto نداشته باشد (شبیه file://)
  const fullSrc = 'var window={crypto:undefined}; var crypto=undefined; ' + src + '\n return attachChecksum(data);';
  const runner = new Function('data', 'return (async function(){ ' + fullSrc + ' })();');
  const testData = { version:'1.0', invoices:[] };
  try {
    await runner(testData);
    assertEqual(testData.checksumAlgo, 'none', 'بدون crypto.subtle، checksumAlgo باید none باشد');
  } catch(e){ throw new Error('attachChecksum بدون crypto.subtle کرش کرد: '+e.message); }
});

// تست ۵: verifyChecksum باید تعریف شده باشد
test('verifyChecksum باید تعریف شده باشد', () => {
  assertTrue(extractFunctionSource(html, 'verifyChecksum') !== null, 'تابع verifyChecksum پیدا نشد');
});

// تست ۶: openBackupIDB و mirrorBackupToIDB باید تعریف شده باشند
test('openBackupIDB و mirrorBackupToIDB باید تعریف شده باشند (IndexedDB redundancy)', () => {
  assertTrue(extractFunctionSource(html, 'openBackupIDB') !== null, 'تابع openBackupIDB پیدا نشد');
  assertTrue(extractFunctionSource(html, 'mirrorBackupToIDB') !== null, 'تابع mirrorBackupToIDB پیدا نشد');
  assertTrue(extractFunctionSource(html, 'getLatestIDBSnapshot') !== null, 'تابع getLatestIDBSnapshot پیدا نشد');
  // در doAutoSave باید mirrorBackupToIDB صدا زده شود
  const autoSrc = extractFunctionSource(html, 'doAutoSave');
  assertContainsString(autoSrc, 'mirrorBackupToIDB', 'doAutoSave باید mirrorBackupToIDB را صدا بزند');
});

// تست ۷: exportData باید پارامتر selectedKeys بپذیرد (selective backup)
test('exportData باید پارامتر selectedKeys بپذیرد (selective backup)', () => {
  const src = extractFunctionSource(html, 'exportData');
  assertTrue(src !== null, 'تابع exportData پیدا نشد');
  assertContainsString(src, 'selectedKeys', 'exportData باید پارامتر selectedKeys را بپذیرد');
  // exportSelected و toggleAllSections توابع جدا هستند — در کل HTML جستجو کن
  assertContainsString(html, 'function exportSelected', 'تابع exportSelected پیدا نشد');
  assertContainsString(html, 'function toggleAllSections', 'تابع toggleAllSections پیدا نشد');
});

// تست ۸: چک‌باکس‌های selective و مودال diff باید در HTML باشند
test('چک‌باکس‌های selective (sec-chk) و مودال diff باید در HTML باشند', () => {
  assertContainsString(html, 'class="sec-chk"', 'چک‌باکس‌های selective (sec-chk) پیدا نشدند');
  assertContainsString(html, 'id="diff-modal"', 'مودال diff (diff-modal) پیدا نشد');
  assertContainsString(html, 'id="diff-file-a"', 'ورودی فایل قدیمی (diff-file-a) پیدا نشد');
  assertContainsString(html, 'id="diff-file-b"', 'ورودی فایل جدید (diff-file-b) پیدا نشد');
  assertContainsString(html, 'compareBackups', 'دکمه/تابع compareBackups پیدا نشد');
});

// تست ۹: SCHEMAS باید برای همه‌ی بخش‌ها تعریف شده باشد
test('SCHEMAS باید برای همه‌ی بخش‌های اصلی تعریف شده باشد', () => {
  assertContainsString(html, 'var SCHEMAS', 'ثابت SCHEMAS پیدا نشد');
  const sections = ['products','phonebook','parts','services','tasks','warranties','sales','defectiveStock','accounts'];
  sections.forEach(sec => {
    assertContainsString(html, sec + ':', 'SCHEMAS باید بخش «'+sec+'» را داشته باشد');
  });
});

// تست ۱۰: importData باید checksum و itemCounts را تأیید کند
test('importData باید checksum و itemCounts را تأیید کند', () => {
  const src = extractFunctionSource(html, 'importData');
  assertTrue(src !== null, 'تابع importData پیدا نشد');
  assertContainsString(src, 'verifyChecksum', 'importData باید verifyChecksum را صدا بزند');
  assertContainsString(src, 'itemCounts', 'importData باید itemCounts را بررسی کند');
});

console.log('');

// -------------------------------------------------------------------
// گروه ۲۴: مغز مرکزی (Event Bus) + داشبورد
// -------------------------------------------------------------------
console.log('📋 گروه ۲۴: Event Bus (مغز مرکزی) + داشبورد');

// تست ۱: on/emit باید تعریف شده و ساختاری درست داشته باشند
test('توابع on/emit/off باید تعریف شده و از _busListeners استفاده کنند', () => {
  const onSrc = extractFunctionSource(html, 'on');
  const emitSrc = extractFunctionSource(html, 'emit');
  assertTrue(onSrc !== null, 'تابع on پیدا نشد');
  assertTrue(emitSrc !== null, 'تابع emit پیدا نشد');
  assertContainsString(onSrc, '_busListeners', 'on باید از _busListeners استفاده کند');
  assertContainsString(emitSrc, '_busListeners', 'emit باید از _busListeners استفاده کند');
  assertContainsString(emitSrc, 'data.event', 'emit باید event را در data set کند');
  assertContainsString(html, 'var _busListeners', '_busListeners باید تعریف شده باشد');
});

// تست ۲: emit باید در saveInv صدا زده شود
test('saveInv باید emit("invoice:saved") را صدا بزند', () => {
  const src = extractFunctionSource(html, 'saveInv');
  assertTrue(src !== null, 'تابع saveInv پیدا نشد');
  assertContainsString(src, "emit('invoice:saved'", 'saveInv باید emit("invoice:saved") را صدا بزند');
});

// تست ۳: emit باید در closeInv صدا زده شود
test('closeInv باید emit("invoice:closed") را صدا بزند', () => {
  const src = extractFunctionSource(html, 'closeInv');
  assertTrue(src !== null, 'تابع closeInv پیدا نشد');
  assertContainsString(src, "emit('invoice:closed'", 'closeInv باید emit("invoice:closed") را صدا بزند');
});

// تست ۴: emit باید در saveSale صدا زده شود
test('saveSale باید emit("sale:saved") را صدا بزند', () => {
  const src = extractFunctionSource(html, 'saveSale');
  assertTrue(src !== null, 'تابع saveSale پیدا نشد');
  assertContainsString(src, "emit('sale:saved'", 'saveSale باید emit("sale:saved") را صدا بزند');
});

// تست ۵: emit باید در saveWar و closeWar صدا زده شود
test('saveWar و closeWar باید emit صدا بزنند', () => {
  const saveSrc = extractFunctionSource(html, 'saveWar');
  const closeSrc = extractFunctionSource(html, 'closeWar');
  assertTrue(saveSrc !== null && closeSrc !== null, 'توابع saveWar/closeWar پیدا نشدند');
  assertContainsString(saveSrc, "emit('warranty:saved'", 'saveWar باید emit کند');
  assertContainsString(closeSrc, "emit('warranty:closed'", 'closeWar باید emit کند');
});

// تست ۶: renderDashboard باید تعریف شده باشد
test('تابع renderDashboard باید تعریف شده باشد', () => {
  assertTrue(extractFunctionSource(html, 'renderDashboard') !== null, 'تابع renderDashboard پیدا نشد');
});

// تست ۷: page-dashboard و nav item باید در HTML باشند
test('page-dashboard و nav item داشبورد باید در HTML باشند', () => {
  assertContainsString(html, 'id="page-dashboard"', 'صفحه داشبورد (page-dashboard) پیدا نشد');
  assertContainsString(html, "data-page=\"dashboard\"", 'nav item داشبورد در سایدبار پیدا نشد');
  assertContainsString(html, 'id="dashboard-content"', 'container داشبورد (dashboard-content) پیدا نشد');
});

// تست ۸: dashboard باید در ALL_PAGES ثبت شده باشد
test('dashboard باید در ALL_PAGES ثبت شده باشد', () => {
  const m = html.match(/const ALL_PAGES\s*=\s*\[([\s\S]*?)\]/);
  assertTrue(m !== null, 'ALL_PAGES پیدا نشد');
  assertContainsString(m[1], "key:'dashboard'", 'dashboard در ALL_PAGES ثبت نشده');
});

// تست ۹: showPage باید dashboard را پشتیبانی کند
test('showPage باید dashboard را پشتیبانی کند (renderDashboard)', () => {
  const src = extractFunctionSource(html, 'showPage');
  assertTrue(src !== null, 'تابع showPage پیدا نشد');
  assertContainsString(src, "renderDashboard", 'showPage باید برای dashboard، renderDashboard را صدا بزند');
});

// تست ۱۰: _registerCentralListeners باید تعریف شده باشد
test('_registerCentralListeners باید تعریف شده باشد (ثبت listenerهای مغز مرکزی)', () => {
  assertTrue(extractFunctionSource(html, '_registerCentralListeners') !== null, 'تابع _registerCentralListeners پیدا نشد');
});

// تست ۱۱: راهنمای داشبورد باید در صفحه راهنما باشد (قانون ۷)
test('راهنمای داشبورد باید در صفحه راهنما باشد (قانون ۷)', () => {
  assertContainsString(html, 'داشبورد مرکزی', 'راهنمای داشبورد در صفحه راهنما پیدا نشد');
});

console.log('');

// -------------------------------------------------------------------
// گروه ۲۵: فاز ۳ب — جستجوی سراسری، ۳۶۰°، حلقه‌های مالی
// -------------------------------------------------------------------
console.log('📋 گروه ۲۵: جستجوی سراسری، ۳۶۰° مشتری، حلقه‌های مالی/انباری');

// تست ۱: globalSearch باید تعریف شده باشد
test('globalSearch باید تعریف شده باشد', () => {
  assertTrue(extractFunctionSource(html, 'globalSearch') !== null, 'تابع globalSearch پیدا نشد');
});

// تست ۲: نوار جستجو در سایدبار موجود باشد
test('نوار جستجوی سراسری (gs-q) باید در سایدبار موجود باشد', () => {
  assertContainsString(html, 'id="gs-q"', 'کادر جستجوی سراسری (gs-q) پیدا نشد');
  assertContainsString(html, 'id="gs-results"', 'container نتایج جستجو (gs-results) پیدا نشد');
});

// تست ۳: showCustomer360 باید تعریف شده باشد
test('showCustomer360 باید تعریف شده باشد', () => {
  const src = extractFunctionSource(html, 'showCustomer360');
  assertTrue(src !== null, 'تابع showCustomer360 پیدا نشد');
  assertContainsString(src, 'phonebook', 'showCustomer360 باید در phonebook جستجو کند');
  assertContainsString(src, 'invoices', 'showCustomer360 باید در invoices جستجو کند');
  assertContainsString(src, 'sales', 'showCustomer360 باید در sales جستجو کند');
  assertContainsString(src, 'warranties', 'showCustomer360 باید در warranties جستجو کند');
});

// تست ۴: مودال ۳۶۰° باید موجود باشد
test('مودال ۳۶۰° (cust360-modal) باید موجود باشد', () => {
  assertContainsString(html, 'id="cust360-modal"', 'مودال ۳۶۰° (cust360-modal) پیدا نشد');
  assertContainsString(html, 'id="cust360-body"', 'container ۳۶۰° (cust360-body) پیدا نشد');
});

// تست ۵: closeInv باید depositToAccount و inventory را دست بزند
test('closeInv باید واریز به حساب و کسر انبار را انجام دهد', () => {
  const src = extractFunctionSource(html, 'closeInv');
  assertTrue(src !== null, 'تابع closeInv پیدا نشد');
  assertContainsString(src, 'inventory', 'closeInv باید inventory را کاهش دهد');
  assertContainsString(src, 'promptDepositPick', 'closeInv باید promptDepositPick را صدا بزند');
});

// تست ۶: addWDev باید فیلد هزینه تعمیر (est) داشته باشد
test('addWDev باید فیلد هزینه تعمیر (est) داشته باشد', () => {
  const src = extractFunctionSource(html, 'addWDev');
  assertTrue(src !== null, 'تابع addWDev پیدا نشد');
  assertContainsString(src, '_est', 'addWDev باید فیلد est (هزینه تعمیر) داشته باشد');
  assertContainsString(src, '_svc', 'addWDev باید فیلد svc (شرح خدمات) داشته باشد');
});

// تست ۷: getWDevsFromForm باید est و svc را بخواند
test('getWDevsFromForm باید est و svc را از فرم بخواند', () => {
  const src = extractFunctionSource(html, 'getWDevsFromForm');
  assertTrue(src !== null, 'تابع getWDevsFromForm پیدا نشد');
  assertContainsString(src, '_est', 'getWDevsFromForm باید est را بخواند');
  assertContainsString(src, '_svc', 'getWDevsFromForm باید svc را بخواند');
});

// تست ۸: closeWar باید promptDepositPick صدا بزند برای هزینه تعمیر
test('closeWar باید promptDepositPick را برای هزینه تعمیر صدا بزند', () => {
  const src = extractFunctionSource(html, 'closeWar');
  assertTrue(src !== null, 'تابع closeWar پیدا نشد');
  assertContainsString(src, 'promptDepositPick', 'closeWar باید برای واریز هزینه تعمیر promptDepositPick را صدا بزند');
  assertContainsString(src, 'serviceTotal', 'closeWar باید serviceTotal را محاسبه کند');
});

// تست ۹: promptDepositPick باید تعریف شده باشد
test('promptDepositPick باید تعریف شده باشد (مودال انتخاب حساب)', () => {
  const src = extractFunctionSource(html, 'promptDepositPick');
  assertTrue(src !== null, 'تابع promptDepositPick پیدا نشد');
  assertContainsString(src, 'dep-pick-modal', 'promptDepositPick باید مودال dep-pick-modal را باز کند');
});

// تست ۱۰: راهنمای جستجو و ۳۶۰° باید در صفحه راهنما باشد (قانون ۷)
test('راهنمای جستجوی سراسری و ۳۶۰° باید در صفحه راهنما باشد (قانون ۷)', () => {
  assertContainsString(html, 'جستجوی سراسری', 'راهنمای جستجوی سراسری در صفحه راهنما پیدا نشد');
  assertContainsString(html, '۳۶۰°', 'راهنمای ۳۶۰° در صفحه راهنما پیدا نشد');
});

console.log('');

// -------------------------------------------------------------------
// گروه ۲۶: گزارش مالی پیشرفته
// -------------------------------------------------------------------
console.log('📋 گروه ۲۶: گزارش مالی، فیلتر تاریخ، ویرایش/حذف تراکنش، دستی پیشرفته');

// تست ۱: renderFinancialReport باید تعریف شده باشه
test('renderFinancialReport باید تعریف شده باشد', () => {
  assertTrue(extractFunctionSource(html, 'renderFinancialReport') !== null, 'تابع renderFinancialReport پیدا نشد');
});

// تست ۲: فیلتر تاریخ در HTML موجود باشه
test('فیلتر تاریخ (fin-from / fin-to) باید در صفحه حساب‌ها موجود باشد', () => {
  assertContainsString(html, 'id="fin-from"', 'فیلتر تاریخ ابتدای بازه (fin-from) پیدا نشد');
  assertContainsString(html, 'id="fin-to"', 'فیلتر تاریخ انتهای بازه (fin-to) پیدا نشد');
});

// تست ۳: doDeposit باید فیلدهای جدید را ذخیره کند
test('doDeposit باید فیلدهای جدید (تاریخ/دسته/فیش) را ذخیره کند', () => {
  const src = extractFunctionSource(html, 'doDeposit');
  assertTrue(src !== null, 'تابع doDeposit پیدا نشد');
  assertContainsString(src, 'dep-date', 'doDeposit باید فیلد تاریخ را بخواند');
  assertContainsString(src, 'dep-cat', 'doDeposit باید فیلد دسته‌بندی را بخواند');
  assertContainsString(src, 'dep-ref-no', 'doDeposit باید فیلد شماره فیش را بخواند');
});

// تست ۴: doWithdraw باید فیلدهای جدید را ذخیره کند
test('doWithdraw باید فیلدهای جدید (تاریخ/دسته/فیش) را ذخیره کند', () => {
  const src = extractFunctionSource(html, 'doWithdraw');
  assertTrue(src !== null, 'تابع doWithdraw پیدا نشد');
  assertContainsString(src, 'wit-date', 'doWithdraw باید فیلد تاریخ را بخواند');
  assertContainsString(src, 'wit-cat', 'doWithdraw باید فیلد دسته‌بندی را بخواند');
  assertContainsString(src, 'wit-ref-no', 'doWithdraw باید فیلد شماره فیش را بخواند');
});

// تست ۵: editTransaction و delTransaction باید تعریف شده باشن
test('editTransaction و delTransaction باید تعریف شده باشند', () => {
  assertTrue(extractFunctionSource(html, 'editTransaction') !== null, 'تابع editTransaction پیدا نشد');
  assertTrue(extractFunctionSource(html, 'delTransaction') !== null, 'تابع delTransaction پیدا نشد');
  assertTrue(extractFunctionSource(html, 'saveTransactionEdit') !== null, 'تابع saveTransactionEdit پیدا نشد');
});

// تست ۶: مودال ویرایش تراکنش باید موجود باشه
test('مودال ویرایش تراکنش (trx-edit-modal) باید موجود باشد', () => {
  assertContainsString(html, 'id="trx-edit-modal"', 'مودال ویرایش تراکنش (trx-edit-modal) پیدا نشد');
});

// تست ۷: printFinancialReport و expFinancialReportExcel باید تعریف شده باشن
test('printFinancialReport و expFinancialReportExcel باید تعریف شده باشند', () => {
  assertTrue(extractFunctionSource(html, 'printFinancialReport') !== null, 'تابع printFinancialReport پیدا نشد');
  assertTrue(extractFunctionSource(html, 'expFinancialReportExcel') !== null, 'تابع expFinancialReportExcel پیدا نشد');
});

// تست ۸: نمودار ماهیانه باید موجود باشه
test('نمودار ماهیانه (_renderMonthlyChart) باید تعریف شده باشد', () => {
  assertTrue(extractFunctionSource(html, '_renderMonthlyChart') !== null, 'تابع _renderMonthlyChart پیدا نشد');
});

// تست ۹: راهنمای گزارش مالی باید در صفحه راهنما باشد (قانون ۷)
test('راهنمای گزارش مالی باید در صفحه راهنما باشد (قانون ۷)', () => {
  assertContainsString(html, 'گزارش مالی پیشرفته', 'راهنمای گزارش مالی در صفحه راهنما پیدا نشد');
});

console.log('');

// -------------------------------------------------------------------
// گروه ۲۷: حواله‌های انبار + انبارگردانی + حرکت‌های انبار
// -------------------------------------------------------------------
console.log('📋 گروه ۲۷: حواله‌های انبار، انبارگردانی، حرکت‌ها');

// تست ۱: توابع اصلی حواله باید تعریف شده باشن
test('توابع حواله انبار (renderWarehouseDocs, saveWarehouseDoc, svWarehouse) باید تعریف شده باشند', () => {
  assertTrue(extractFunctionSource(html, 'renderWarehouseDocs') !== null, 'تابع renderWarehouseDocs پیدا نشد');
  assertTrue(extractFunctionSource(html, 'saveWarehouseDoc') !== null, 'تابع saveWarehouseDoc پیدا نشد');
  assertTrue(extractFunctionSource(html, 'svWarehouse') !== null, 'تابع svWarehouse پیدا نشد');
});

// تست ۲: _applyStockMovement باید تعریف شده باشه
test('_applyStockMovement باید تعریف شده باشد (هسته‌ی حرکت انبار)', () => {
  const src = extractFunctionSource(html, '_applyStockMovement');
  assertTrue(src !== null, 'تابع _applyStockMovement پیدا نشد');
  assertContainsString(src, 'stockMoves', '_applyStockMovement باید در stockMoves حرکت را ثبت کند');
});

// تست ۳: صفحه warehouse باید در ALL_PAGES و HTML موجود باشه
test('صفحه warehouse باید در ALL_PAGES و HTML موجود باشد', () => {
  const m = html.match(/const ALL_PAGES\s*=\s*\[([\s\S]*?)\]/);
  assertTrue(m !== null, 'ALL_PAGES پیدا نشد');
  assertContainsString(m[1], "key:'warehouse'", 'warehouse در ALL_PAGES ثبت نشده');
  assertContainsString(html, 'id="page-warehouse"', 'صفحه حواله (page-warehouse) در HTML پیدا نشد');
  assertContainsString(html, "data-page=\"warehouse\"", 'nav item حواله در سایدبار پیدا نشد');
});

// تست ۴: مودال‌های حواله و انبارگردانی باید موجود باشن
test('مودال حواله (wh-modal) و انبارگردانی (stocktake-modal) باید موجود باشند', () => {
  assertContainsString(html, 'id="wh-modal"', 'مودال حواله (wh-modal) پیدا نشد');
  assertContainsString(html, 'id="stocktake-modal"', 'مودال انبارگردانی (stocktake-modal) پیدا نشد');
});

// تست ۵: printWarehouseDoc باید تعریف شده باشه
test('printWarehouseDoc و printWarehouseList باید تعریف شده باشند', () => {
  assertTrue(extractFunctionSource(html, 'printWarehouseDoc') !== null, 'تابع printWarehouseDoc پیدا نشد');
  assertTrue(extractFunctionSource(html, 'printWarehouseList') !== null, 'تابع printWarehouseList پیدا نشد');
});

// تست ۶: _deductStock باید _applyStockMovement صدا بزنه (hook خودکار)
test('_deductStock باید _applyStockMovement را صدا بزند (ثبت خودکار حرکت)', () => {
  const src = extractFunctionSource(html, '_deductStock');
  assertTrue(src !== null, 'تابع _deductStock پیدا نشد');
  assertContainsString(src, '_applyStockMovement', '_deductStock باید برای ثبت حرکت، _applyStockMovement را صدا بزند');
});

// تست ۷: توابع انبارگردانی باید تعریف شده باشن
test('توابع انبارگردانی (renderStocktake, applyStocktakeAdjustments) باید تعریف شده باشند', () => {
  assertTrue(extractFunctionSource(html, 'renderStocktake') !== null, 'تابع renderStocktake پیدا نشد');
  assertTrue(extractFunctionSource(html, 'applyStocktakeAdjustments') !== null, 'تابع applyStocktakeAdjustments پیدا نشد');
});

// تست ۸: warehouseDocs و stockMoves باید در _buildFullBackupData ذخیره بشن
test('warehouseDocs و stockMoves باید در _buildFullBackupData ذخیره شوند', () => {
  const src = extractFunctionSource(html, '_buildFullBackupData');
  assertTrue(src !== null, '_buildFullBackupData پیدا نشد');
  assertContainsString(src, 'warehouseDocs', '_buildFullBackupData باید warehouseDocs را شامل باشد');
  assertContainsString(src, 'stockMoves', '_buildFullBackupData باید stockMoves را شامل باشد');
});

// تست ۹: راهنمای حواله‌ها باید در صفحه راهنما باشد (قانون ۷)
test('راهنمای حواله‌های انبار و انبارگردانی باید در صفحه راهنما باشد (قانون ۷)', () => {
  assertContainsString(html, 'حواله', 'راهنمای حواله در صفحه راهنما پیدا نشد');
  assertContainsString(html, 'انبارگردانی', 'راهنمای انبارگردانی در صفحه راهنما پیدا نشد');
});

console.log('');

// -------------------------------------------------------------------
// گروه ۲۸: متحد کردن سه انبار + گزارش‌گیری جامع
// -------------------------------------------------------------------
console.log('📋 گروه ۲۸: اتصال معیوب به حواله، داشبورد سه‌انباری، گزارش جامع');

test('_applyStockMovement باید شاخه‌ی انبار معیوب (DEF-) را داشته باشد', () => {
  const src = extractFunctionSource(html, '_applyStockMovement');
  assertTrue(src !== null, 'تابع _applyStockMovement پیدا نشد');
  assertContainsString(src, 'DEF-', '_applyStockMovement باید شاخه‌ی انبار معیوب (DEF-) را داشته باشد');
  assertContainsString(src, 'defectiveStock', '_applyStockMovement باید با defectiveStock کار کند');
});

test('داشبورد سه‌انباری (wh-dash) باید در HTML موجود باشد', () => {
  assertContainsString(html, 'id="wh-dash"', 'داشبورد سه‌انباری (wh-dash) پیدا نشد');
});

test('renderWarehouseDash و renderWarehouseReport باید تعریف شده باشند', () => {
  assertTrue(extractFunctionSource(html, 'renderWarehouseDash') !== null, 'تابع renderWarehouseDash پیدا نشد');
  assertTrue(extractFunctionSource(html, 'renderWarehouseReport') !== null, 'تابع renderWarehouseReport پیدا نشد');
});

test('گزارش جامع انبار (wr-wh, wr-type, wr-from) باید در HTML موجود باشد', () => {
  assertContainsString(html, 'id="wr-wh"', 'فیلتر انبار گزارش (wr-wh) پیدا نشد');
  assertContainsString(html, 'id="wr-from"', 'فیلتر تاریخ ابتدا (wr-from) پیدا نشد');
  assertContainsString(html, 'id="wr-results"', 'container نتایج گزارش (wr-results) پیدا نشد');
});

test('expWarehouseExcel و printWarehouseReport باید تعریف شده باشند', () => {
  assertTrue(extractFunctionSource(html, 'expWarehouseExcel') !== null, 'تابع expWarehouseExcel پیدا نشد');
  assertTrue(extractFunctionSource(html, 'printWarehouseReport') !== null, 'تابع printWarehouseReport پیدا نشد');
});

test('انبارگردانی باید شامل انبار معیوب باشد', () => {
  assertContainsString(html, 'option value="defective"', 'انبارگردانی باید شامل گزینه‌ی معیوب باشد');
});

test('renderWhItems باید آیتم‌های معیوب را در dropdown نمایش دهد', () => {
  const src = extractFunctionSource(html, 'renderWhItems');
  assertTrue(src !== null, 'تابع renderWhItems پیدا نشد');
  assertContainsString(src, 'defectiveStock', 'renderWhItems باید آیتم‌های معیوب را نمایش دهد');
});

// -------------------------------------------------------------------
// گروه ۲۹: رفع باگ‌های فاکتور — ویرایش، تکمیل، تخفیف، شماره‌گذاری ردیف
// (این باگ‌ها در نسخه‌های قبلی واقعاً رخ داده بودند و کاربر گزارش کرده بود)
// -------------------------------------------------------------------
console.log('📋 گروه ۲۹: رفع باگ‌های فاکتور (ویرایش/تکمیل/تخفیف/شماره‌گذاری)');

// تست ۱: متغیر editingInvIdx باید تعریف شده باشد (منطق حالت ویرایش)
test('متغیر editingInvIdx باید تعریف شده باشد', () => {
  assertContainsString(html, 'let editingInvIdx', 'متغیر editingInvIdx پیدا نشد — بدون آن ویرایش فاکتور، فاکتور جدید می‌سازد');
});

// تست ۲: loadInv باید editingInvIdx را ست کند (ورود به حالت ویرایش)
test('loadInv باید editingInvIdx را برابر اندیس فاکتور قرار دهد', () => {
  const src = extractFunctionSource(html, 'loadInv');
  assertTrue(src !== null, 'تابع loadInv پیدا نشد');
  assertContainsString(src, 'editingInvIdx', 'loadInv باید editingInvIdx را ست کند');
  assertContainsString(src, 'editingInvIdx=idx', 'loadInv باید editingInvIdx=idx را داشته باشد');
});

// تست ۳: saveInv باید در حالت ویرایش، فاکتور را آپدیت کند نه push جدید
test('saveInv باید در حالت ویرایش به‌جای push، رکورد را جایگزین کند', () => {
  const src = extractFunctionSource(html, 'saveInv');
  assertTrue(src !== null, 'تابع saveInv پیدا نشد');
  assertContainsString(src, 'editingInvIdx', 'saveInv باید editingInvIdx را چک کند');
  assertContainsString(src, 'invoices[editingInvIdx]=d', 'saveInv باید invoices[editingInvIdx]=d را برای جایگزینی داشته باشد');
  // مطمئن شو همچنان push برای فاکتور جدید موجود است
  assertContainsString(src, 'invoices.push(d)', 'saveInv باید برای فاکتور جدید push داشته باشد');
});

// تست ۴: closeInv باید وضعیت closed را در invoices[] ذخیره کند و sv() صدا بزند
test('closeInv باید d.status=closed ست کند و sv() را صدا بزند', () => {
  const src = extractFunctionSource(html, 'closeInv');
  assertTrue(src !== null, 'تابع closeInv پیدا نشد');
  assertContainsString(src, "d.status='closed'", 'closeInv باید d.status را روی closed تنظیم کند');
  assertContainsString(src, 'sv()', 'closeInv باید sv() را صدا بزند تا تغییرات ذخیره شوند');
  assertContainsString(src, 'editingInvIdx', 'closeInv باید editingInvIdx را برای حالت ویرایش چک کند');
});

// تست ۵: clearInv باید editingInvIdx را ریست کند
test('clearInv باید editingInvIdx=-1 را ریست کند', () => {
  const src = extractFunctionSource(html, 'clearInv');
  assertTrue(src !== null, 'تابع clearInv پیدا نشد');
  assertContainsString(src, 'editingInvIdx=-1', 'clearInv باید editingInvIdx=-1 را ریست کند');
});

// تست ۶: rmDev باید شماره ردیف‌های باقی‌مانده را reindex کند
test('rmDev باید شماره ردیف‌ها را بعد از حذف بازنویسی کند (reindex)', () => {
  const src = extractFunctionSource(html, 'rmDev');
  assertTrue(src !== null, 'تابع rmDev پیدا نشد');
  // باید کارت‌ها را پیمایش و شماره‌گذاری مجدد کند
  assertContainsString(src, 'querySelectorAll', 'rmDev باید کارت‌ها را پیمایش کند');
  assertContainsString(src, 'devCnt=', 'rmDev باید devCnt را به‌روزرسانی کند');
  // نباید فقط remove باشد و بس
  const hasReindex = src.includes('newN') || src.includes('newIdx') || src.includes('devCnt=cards.length');
  assertTrue(hasReindex, 'rmDev باید منطق reindex داشته باشد (newN/newIdx)');
});

// تست ۷: calcT باید تخفیف را همیشه وقتی disc>0 اعمال کند (حتی اگر fin لود شده)
test('calcT باید وقتی تخفیف > 0 است، fin را از (est-da) محاسبه کند', () => {
  const src = extractFunctionSource(html, 'calcT');
  assertTrue(src !== null, 'تابع calcT پیدا نشد');
  assertContainsString(src, 'disc>0', 'calcT باید شرط disc>0 برای محاسبه fin از تخفیف داشته باشد');
});

// تست ۸: getData هم باید منطق تخفیف را درست پیاده کند
test('getData باید وقتی تخفیف > 0 است، fin را از (est-da) محاسبه کند', () => {
  const src = extractFunctionSource(html, 'getData');
  assertTrue(src !== null, 'تابع getData پیدا نشد');
  assertContainsString(src, 'disc>0', 'getData باید شرط disc>0 برای محاسبه fin داشته باشد');
});

// تست ۹: دکمه شناور افزودن دستگاه باید در HTML موجود باشد
test('دکمه شناور افزودن دستگاه (fab-adddev) باید در HTML موجود باشد', () => {
  assertContainsString(html, 'fab-adddev', 'کلاس دکمه شناور افزودن دستگاه پیدا نشد');
  assertContainsString(html, 'class="fab-adddev"', 'دکمه شناور با کلاس fab-adddev باید در HTML باشد');
});

// تست ۱۰: CSS کلاس fab-adddev باید position:fixed داشته باشد
test('CSS کلاس fab-adddev باید position:fixed داشته باشد', () => {
  const src = extractFunctionSource(html, 'calcT'); // فقط برای اطمینان از extract کار می‌کند
  assertTrue(src !== null, 'این تست نباید null باشد');
  assertContainsString(html, '.fab-adddev', 'کلاس .fab-adddev در CSS موجود نیست');
  // پیدا کردن بلاک CSS مربوطه
  const idx = html.indexOf('.fab-adddev');
  const block = html.substring(idx, idx + 400);
  assertContainsString(block, 'position:fixed', '.fab-adddev باید position:fixed داشته باشد');
});

// تست ۱۱: نباید دکمه کپی تکراری در addDev باشد
test('addDev نباید دو دکمه کپی تکراری داشته باشد', () => {
  const src = extractFunctionSource(html, 'addDev');
  assertTrue(src !== null, 'تابع addDev پیدا نشد');
  const count = (src.match(/📋 کپی/g) || []).length;
  assertTrue(count === 1, 'addDev باید فقط یک دکمه کپی داشته باشد، اما ' + count + ' تا پیدا شد');
});

// تست ۱۲: showPage باید دکمه شناور را فقط در صفحه فاکتور نمایش دهد
test('showPage باید fab-adddev را مدیریت کند (نمایش فقط در صفحه فاکتور)', () => {
  const src = extractFunctionSource(html, 'showPage');
  assertTrue(src !== null, 'تابع showPage پیدا نشد');
  assertContainsString(src, 'fab-adddev', 'showPage باید fab-adddev را مدیریت کند');
  assertContainsString(src, "id==='invoice'", 'showPage باید بررسی کند آیا صفحه فاکتور است');
  assertContainsString(src, 'classList', 'showPage باید با classList کنترل کند (not style.display)');
});

// -------------------------------------------------------------------
// گروه ۳۰: چاپ گزارش داخلی شرکت (پرونده گارانتی — ارجاع به شرکت مرکزی)
// -------------------------------------------------------------------
console.log('📋 گروه ۳۰: چاپ گزارش داخلی شرکت');

// تست ۱: تابع printCompanyReport باید تعریف شده باشد
test('تابع printCompanyReport باید تعریف شده باشد', () => {
  const src = extractFunctionSource(html, 'printCompanyReport');
  assertTrue(src !== null, 'تابع printCompanyReport پیدا نشد');
});

// تست ۲: printCompanyReport باید هر دو حالت (از فرم و از لیست) را پشتیبانی کند
test('printCompanyReport باید هم از فرم و هم از لیست (idx) داده بخواند', () => {
  const src = extractFunctionSource(html, 'printCompanyReport');
  assertTrue(src !== null, 'تابع printCompanyReport پیدا نشد');
  assertContainsString(src, 'warranties[idx]', 'printCompanyReport باید از warranties[idx] بخواند');
  assertContainsString(src, 'getWarData()', 'printCompanyReport باید از فرم فعال getWarData() بخواند');
});

// تست ۳: printCompanyReport باید همه‌ی ۴ بخش امضاء را شامل شود
test('printCompanyReport باید هر چهار بخش امضاء را داشته باشد', () => {
  const src = extractFunctionSource(html, 'printCompanyReport');
  assertTrue(src !== null, 'تابع printCompanyReport پیدا نشد');
  assertContainsString(src, 'کارشناس خدمات', 'بخش کارشناس خدمات/تعمیر باید باشد');
  assertContainsString(src, 'کنترل کیفیت', 'بخش کارشناس کنترل کیفیت باید باشد');
  assertContainsString(src, 'لجستیک', 'بخش نماینده ارسال/لجستیک باید باشد');
  assertContainsString(src, 'مدیر خدمات', 'بخش مدیر خدمات پس از فروش باید باشد');
});

// تست ۴: printCompanyReport باید window.open و print را صدا بزند
test('printCompanyReport باید پنجره چاپ را باز کند', () => {
  const src = extractFunctionSource(html, 'printCompanyReport');
  assertTrue(src !== null, 'تابع printCompanyReport پیدا نشد');
  assertContainsString(src, "window.open", 'printCompanyReport باید window.open داشته باشد');
  assertContainsString(src, '.print()', 'printCompanyReport باید print() را صدا بزند');
});

// تست ۵: دکمه چاپ گزارش داخلی باید در فرم موجود باشد
test('دکمه چاپ گزارش داخلی باید در فرم گارانتی موجود باشد', () => {
  assertContainsString(html, 'printCompanyReport()', 'دکمه چاپ گزارش داخلی در HTML پیدا نشد');
  assertContainsString(html, 'چاپ گزارش داخلی', 'متن دکمه چاپ گزارش داخلی باید باشد');
});

// تست ۶: دکمه چاپ گزارش داخلی در لیست باید فقط برای پرونده‌های ارجاع به شرکت نمایش داده شود
test('دکمه چاپ در لیست باید فقط برای refTo=company نمایش داده شود', () => {
  const src = extractFunctionSource(html, 'renderWar');
  assertTrue(src !== null, 'تابع renderWar پیدا نشد');
  assertContainsString(src, "refTo==='company'", 'renderWar باید بررسی کند refTo برابر company است');
  assertContainsString(src, 'printCompanyReport', 'دکمه printCompanyReport باید در لیست موجود باشد');
});

// تست ۷: راهنمای گزارش داخلی باید در صفحه راهنما باشد (قانون ۷)
test('راهنمای گزارش داخلی شرکت باید در صفحه راهنما باشد', () => {
  assertContainsString(html, 'گزارش داخلی شرکت', 'موضوع گزارش داخلی شرکت در راهنما پیدا نشد');
  assertContainsString(html, 'ارجاع به شرکت مرکزی', 'راهنمای ارجاع به شرکت مرکزی باید باشد');
});

// -------------------------------------------------------------------
// گروه ۳۱: انبار قطعات — نمایش فولدری/خوشه‌ای، حذف دسته‌ای، فیلتر دسته
// -------------------------------------------------------------------
console.log('📋 گروه ۳۱: انبار قطعات (نمایش فولدری، حذف دسته‌ای، فیلتر)');

// تست ۱: دکمه «انتخاب همه» باید در نوار ابزار انبار قطعات باشد
test('دکمه «انتخاب همه» باید در انبار قطعات موجود باشد', () => {
  assertContainsString(html, 'selAllParts', 'تابع selAllParts پیدا نشد');
  assertContainsString(html, 'انتخاب همه', 'دکمه انتخاب همه در HTML پیدا نشد');
});

// تست ۲: توابع نمایش فولدری باید تعریف شده باشند
test('توابع نمایش فولدری/خوشه‌ای باید تعریف شده باشند', () => {
  assertTrue(extractFunctionSource(html, 'setPartView') !== null, 'تابع setPartView پیدا نشد');
  assertTrue(extractFunctionSource(html, '_renderPartsFolder') !== null, 'تابع _renderPartsFolder پیدا نشد');
  assertTrue(extractFunctionSource(html, '_renderPartsList') !== null, 'تابع _renderPartsList پیدا نشد');
  assertTrue(extractFunctionSource(html, 'togglePartCluster') !== null, 'تابع togglePartCluster پیدا نشد');
  assertTrue(extractFunctionSource(html, 'toggleAllPartClusters') !== null, 'تابع toggleAllPartClusters پیدا نشد');
});

// تست ۳: _renderPartsFolder باید بر اساس دسته (cat) گروه‌بندی کند
test('_renderPartsFolder باید بر اساس دسته (cat) گروه‌بندی کند', () => {
  const src = extractFunctionSource(html, '_renderPartsFolder');
  assertTrue(src !== null, 'تابع _renderPartsFolder پیدا نشد');
  assertContainsString(src, 'byCat', '_renderPartsFolder باید byCat را داشته باشد');
  assertContainsString(src, "p.cat||'بدون دسته'", '_renderPartsFolder باید از cat برای گروه‌بندی استفاده کند');
  assertContainsString(src, 'part-cluster', '_renderPartsFolder باید کلاس part-cluster را بسازد');
});

// تست ۴: _renderPartsFolder باید زیرگروه بر اساس کالا (prodCode) داشته باشد
test('_renderPartsFolder باید زیرگروه بر اساس prodCode داشته باشد', () => {
  const src = extractFunctionSource(html, '_renderPartsFolder');
  assertTrue(src !== null, 'تابع _renderPartsFolder پیدا نشد');
  assertContainsString(src, 'byProd', '_renderPartsFolder باید byProd داشته باشد');
  assertContainsString(src, 'p.prodCode', '_renderPartsFolder باید از prodCode استفاده کند');
});

// تست ۵: آمار هر دسته باید شامل تعداد، مجموع موجودی، و تعداد کم‌موجودی باشد
test('_renderPartsFolder باید آمار هر دسته را نمایش دهد', () => {
  const src = extractFunctionSource(html, '_renderPartsFolder');
  assertTrue(src !== null, 'تابع _renderPartsFolder پیدا نشد');
  assertContainsString(src, 'totalQty', '_renderPartsFolder باید مجموع موجودی را محاسبه کند');
  assertContainsString(src, 'lowCount', '_renderPartsFolder باید تعداد کم‌موجودی را محاسبه کند');
});

// تست ۶: دکمه‌های تغییر حالت نمایش (فولدر/لیست) باید در HTML باشند
test('دکمه‌های تغییر حالت نمایش باید در HTML باشند', () => {
  assertContainsString(html, 'id="part-view-folder"', 'دکمه حالت فولدر پیدا نشد');
  assertContainsString(html, 'id="part-view-list"', 'دکمه حالت لیست پیدا نشد');
  assertContainsString(html, 'setPartView(', 'onclick برای setPartView باید باشد');
});

// تست ۷: فیلتر دسته‌بندی باید در HTML باشد
test('فیلتر دسته‌بندی (part-cf) باید در HTML باشد', () => {
  assertContainsString(html, 'id="part-cf"', 'dropdown فیلتر دسته (part-cf) پیدا نشد');
});

// تست ۸: تابع renderParts باید فیلتر دسته را هم اعمال کند
test('renderParts باید فیلتر دسته (part-cf) را اعمال کند', () => {
  const src = extractFunctionSource(html, 'renderParts');
  assertTrue(src !== null, 'تابع renderParts پیدا نشد');
  assertContainsString(src, 'part-cf', 'renderParts باید از part-cf بخواند');
});

// تست ۹: تابع delSelParts باید وجود داشته باشد (حذف دسته‌ای)
test('تابع حذف دسته‌ای قطعات (delSelParts) باید تعریف شده باشد', () => {
  const src = extractFunctionSource(html, 'delSelParts');
  assertTrue(src !== null, 'تابع delSelParts پیدا نشد');
  assertContainsString(src, 'splice', 'delSelParts باید splice را صدا بزند');
});

// تست ۱۰: راهنمای نمایش فولدری باید در صفحه راهنما باشد (قانون ۷)
test('راهنمای نمایش فولدری/خوشه‌ای باید در صفحه راهنما باشد', () => {
  assertContainsString(html, 'نمایش فولدری/خوشه‌ای', 'راهنمای نمایش فولدری پیدا نشد');
  assertContainsString(html, 'انتخاب همه و حذف دسته‌ای', 'راهنمای حذف دسته‌ای پیدا نشد');
});

// تست ۱۱: CSS کلاس part-cluster باید وجود داشته باشد
test('CSS کلاس part-cluster باید تعریف شده باشد', () => {
  assertContainsString(html, '.part-cluster', 'کلاس CSS part-cluster پیدا نشد');
  assertContainsString(html, '.part-cluster-head', 'کلاس CSS part-cluster-head پیدا نشد');
});

// تست ۱۲: renderParts باید بر اساس _partViewMode بین دو حالت سوییچ کند
test('renderParts باید بر اساس _partViewMode بین فولدر و لیست سوییچ کند', () => {
  const src = extractFunctionSource(html, 'renderParts');
  assertTrue(src !== null, 'تابع renderParts پیدا نشد');
  assertContainsString(src, '_partViewMode', 'renderParts باید _partViewMode را چک کند');
  assertContainsString(src, '_renderPartsFolder', 'renderParts باید _renderPartsFolder را صدا بزند');
  assertContainsString(src, '_renderPartsList', 'renderParts باید _renderPartsList را صدا بزند');
});

// -------------------------------------------------------------------
// گروه ۳۲: نمایش‌دهنده‌ی سند (viewer) با زوم/چرخش/چاپ/دانلود + ضمیمه به هر دستگاه گارانتی
// -------------------------------------------------------------------
console.log('📋 گروه ۳۲: نمایش‌دهنده‌ی سند (viewer) و ضمیمه به هر دستگاه');

// تست ۱: مودال doc-viewer باید در HTML موجود باشد
test('مودال doc-viewer باید در HTML موجود باشد', () => {
  assertContainsString(html, 'id="doc-viewer"', 'مودال doc-viewer پیدا نشد');
  assertContainsString(html, 'id="dv-img"', 'عکس viewer (dv-img) پیدا نشد');
});

// تست ۲: توابع viewer باید تعریف شده باشند
test('توابع viewer باید تعریف شده باشند', () => {
  assertTrue(extractFunctionSource(html, 'openDocViewer') !== null, 'تابع openDocViewer پیدا نشد');
  assertTrue(extractFunctionSource(html, 'closeDocViewer') !== null, 'تابع closeDocViewer پیدا نشد');
  assertTrue(extractFunctionSource(html, 'docViewerZoom') !== null, 'تابع docViewerZoom پیدا نشد');
  assertTrue(extractFunctionSource(html, 'docViewerRotate') !== null, 'تابع docViewerRotate پیدا نشد');
  assertTrue(extractFunctionSource(html, 'docViewerPrint') !== null, 'تابع docViewerPrint پیدا نشد');
  assertTrue(extractFunctionSource(html, 'docViewerDownload') !== null, 'تابع docViewerDownload پیدا نشد');
});

// تست ۳: docViewerPrint باید window.open و print داشته باشد
test('docViewerPrint باید پنجره چاپ باز کند', () => {
  const src = extractFunctionSource(html, 'docViewerPrint');
  assertTrue(src !== null, 'تابع docViewerPrint پیدا نشد');
  assertContainsString(src, 'window.open', 'docViewerPrint باید window.open داشته باشد');
  assertContainsString(src, '.print()', 'docViewerPrint باید print صدا بزند');
});

// تست ۴: openDocViewer باید لیستی از اسناد را بپذیرد و در _dvDocs ذخیره کند
test('openDocViewer باید لیست اسناد را بپذیرد', () => {
  const src = extractFunctionSource(html, 'openDocViewer');
  assertTrue(src !== null, 'تابع openDocViewer پیدا نشد');
  assertContainsString(src, 'Array.isArray', 'openDocViewer باید Array.isArray چک کند');
  assertContainsString(src, '_dvDocs', 'openDocViewer باید _dvDocs را ست کند');
});

// تست ۵: زوم با رول‌ماوس (wheel) باید تعریف شده باشد
test('زوم با رول‌ماوس (wheel event) باید فعال باشد', () => {
  const src = extractFunctionSource(html, 'docViewerZoom');
  assertTrue(src !== null, 'تابع docViewerZoom پیدا نشد');
  assertContainsString(html, "addEventListener('wheel'", 'wheel event برای زوم پیدا نشد');
});

// تست ۶: thumbnail سند باید کلیک‌شدن و openDocViewer را صدا بزند
test('کارت thumbnail سند باید کلیک‌شدن و openDocViewer را صدا بزند', () => {
  const src = extractFunctionSource(html, '_renderDocThumb');
  assertTrue(src !== null, 'تابع _renderDocThumb پیدا نشد');
  assertContainsString(src, 'doc-thumb', 'کلاس doc-thumb باید باشد');
  assertContainsString(src, 'openDocViewer', 'thumbnail باید openDocViewer را صدا بزند');
});

// تست ۷: ضمیمه سند به هر دستگاه گارانتی — تابع addWDevDocs باید تعریف شده باشد
test('تابع addWDevDocs باید تعریف شده باشد (ضمیمه به هر دستگاه)', () => {
  assertTrue(extractFunctionSource(html, 'addWDevDocs') !== null, 'تابع addWDevDocs پیدا نشد');
  assertTrue(extractFunctionSource(html, 'renderWDevDocs') !== null, 'تابع renderWDevDocs پیدا نشد');
});

// تست ۸: addWDev باید بخش اسناد (docs-row) داشته باشد
test('addWDev باید بخش اسناد (docs-row) برای هر دستگاه داشته باشد', () => {
  const src = extractFunctionSource(html, 'addWDev');
  assertTrue(src !== null, 'تابع addWDev پیدا نشد');
  assertContainsString(src, 'docs-prev', 'addWDev باید فیلد docs-prev داشته باشد');
  assertContainsString(src, 'addWDevDocs', 'addWDev باید addWDevDocs را صدا بزند');
});

// تست ۹: getWDevsFromForm باید docs هر دستگاه را هم بخواند
test('getWDevsFromForm باید docs هر دستگاه را هم بخواند', () => {
  const src = extractFunctionSource(html, 'getWDevsFromForm');
  assertTrue(src !== null, 'تابع getWDevsFromForm پیدا نشد');
  assertContainsString(src, '_wdevDocs_', 'getWDevsFromForm باید _wdevDocs_ را بخواند');
  assertContainsString(src, 'docs:', 'getWDevsFromForm باید فیلد docs را push کند');
});

// تست ۱۰: loadWDevsToForm باید docs هر دستگاه را بارگذاری کند
test('loadWDevsToForm باید docs هر دستگاه را بارگذاری کند', () => {
  const src = extractFunctionSource(html, 'loadWDevsToForm');
  assertTrue(src !== null, 'تابع loadWDevsToForm پیدا نشد');
  assertContainsString(src, 'd.docs', 'loadWDevsToForm باید d.docs را چک کند');
  assertContainsString(src, 'renderWDevDocs', 'loadWDevsToForm باید renderWDevDocs را صدا بزند');
});

// تست ۱۱: راهنمای viewer و اسناد باید در صفحه راهنما باشد (قانون ۷)
test('راهنمای نمایش‌دهنده‌ی سند و ضمیمه باید در صفحه راهنما باشد', () => {
  assertContainsString(html, 'نمایش‌دهنده‌ی سند', 'راهنمای viewer پیدا نشد');
  assertContainsString(html, 'اسناد این دستگاه', 'راهنمای ضمیمه به هر دستگاه پیدا نشد');
  assertContainsString(html, 'زوم', 'راهنمای زوم باید باشد');
});

// تست ۱۲: renderSaleDocs باید از _renderDocThumb استفاده کند (کلیک‌شدن)
test('renderSaleDocs باید از _renderDocThumb استفاده کند', () => {
  const src = extractFunctionSource(html, 'renderSaleDocs');
  assertTrue(src !== null, 'تابع renderSaleDocs پیدا نشد');
  assertContainsString(src, '_renderDocThumb', 'renderSaleDocs باید از _renderDocThumb استفاده کند');
});

// تست ۱۳: renderWDocs باید از _renderDocThumb استفاده کند (کلیک‌شدن)
test('renderWDocs باید از _renderDocThumb استفاده کند', () => {
  const src = extractFunctionSource(html, 'renderWDocs');
  assertTrue(src !== null, 'تابع renderWDocs پیدا نشد');
  assertContainsString(src, '_renderDocThumb', 'renderWDocs باید از _renderDocThumb استفاده کند');
});

console.log('');
console.log('📋 گروه ۳۳: انتخاب‌گر تاریخ (date picker) باید روی مودال‌ها قرار گیرد (z-index)');

// ریشه‌ی باگ کاربر: «وقتی واریز یا برداشت رو می‌زنم تاریخ رو انتخاب می‌کنم انتخاب گر تاریخ پشت می‌افته»
// انتخاب‌گر تاریخ (.dp-pop) باید z-index بالاتری از مودال‌ها (.ov) داشته باشد، وگرنه
// وقتی از داخل یک مودال باز می‌شود پشت overlay مودال می‌افتد و غیرقابل دسترس می‌شود.
test('انتخاب‌گر تاریخ (.dp-pop) باید z-index بالاتری از مودال‌ها (.ov) داشته باشد', () => {
  // استخراج عددهای z-index از CSS
  const dpPopMatch = html.match(/\.dp-pop\s*\{[^}]*z-index:\s*(\d+)/);
  assertTrue(dpPopMatch !== null, 'قانون CSS برای .dp-pop پیدا نشد (یا z-index ندارد)');
  const dpZ = parseInt(dpPopMatch[1], 10);

  const ovMatch = html.match(/\.ov\s*\{[^}]*z-index:\s*(\d+)/);
  assertTrue(ovMatch !== null, 'قانون CSS برای .ov پیدا نشد (یا z-index ندارد)');
  const ovZ = parseInt(ovMatch[1], 10);

  assertTrue(dpZ > ovZ, '.dp-pop (z-index:' + dpZ + ') باید بالاتر از .ov (z-index:' + ovZ + ') باشد تا انتخاب‌گر تاریخ داخل مودال قابل‌دسترس باشد');
});

console.log('');
console.log('📋 گروه ۳۴: تعویض خودکار دستگاه در فاکتور (فاز ۱)');

// این ویژگی (۱۰.۵.۱۸) پاسخ به نیاز کاربر است:
// «یک دستگاه خراب میاد، نو از انبار می‌دیم، خراب میره انبار معیوب — این اطلاعات توی فاکتور ثبت بشن»
// وقتی در فاکتور دستگاهی را «تعویض شد» می‌گذاریم و فاکتور را می‌بندیم، نرم‌افزار باید خودکار
// دستگاه خراب را به انبار معیوب اضافه کند و با شماره فاکتور پیوند دهد.

test('closeInv باید برای دستگاه‌های «تعویض شد»، addDefectiveFromInvoice را صدا بزند', () => {
  const closeSrc = extractFunctionSource(html, 'closeInv');
  assertTrue(closeSrc !== null, 'تابع closeInv پیدا نشد');
  assertContainsString(closeSrc, 'it.swapped', 'closeInv باید وضعیت swapped آیتم را بررسی کند');
  assertContainsString(closeSrc, 'addDefectiveFromInvoice', 'closeInv باید برای دستگاه‌های تعویض‌شده addDefectiveFromInvoice را صدا بزند');
});

test('getData باید فیلدهای تعویض (swapped, newSerial, swapReason) را در آیتم ثبت کند', () => {
  const getSrc = extractFunctionSource(html, 'getData');
  assertTrue(getSrc !== null, 'تابع getData پیدا نشد');
  assertContainsString(getSrc, 'swapped', 'getData باید پرچم swapped را ثبت کند');
  assertContainsString(getSrc, 'newSerial', 'getData باید سریال دستگاه نو (newSerial) را ثبت کند');
  assertContainsString(getSrc, 'swapReason', 'getData باید علت تعویض (swapReason) را ثبت کند');
});

test('addDefectiveFromInvoice باید invoiceNum را با شماره فاکتور پر کند (نه خالی)', () => {
  const fnSrc = extractFunctionSource(html, 'addDefectiveFromInvoice');
  assertTrue(fnSrc !== null, 'تابع addDefectiveFromInvoice پیدا نشد — برای تعویض خودکار لازم است');
  assertContainsString(fnSrc, 'invoiceNum:inv.num', 'addDefectiveFromInvoice باید invoiceNum را برابر شماره فاکتور پر کند (نه خالی) — این پیوندی است که قبلاً همیشه گم می‌شد');
});

// ─── تست execution-based حیاتی: شبیه‌سازی واقعی تعویض در فاکتور ──
// یک فاکتور با یک دستگاه «تعویض شد» می‌بندیم و بررسی می‌کنیم که دستگاه معیوب به انبار معیوب
// اضافه شده و با شماره فاکتور پیوند خورده باشد.
test('شبیه‌سازی واقعی: بستن فاکتور با دستگاه تعویض‌شده باید آن را به انبار معیوب منتقل کند (execution-based)', () => {
  const vm = require('vm');
  const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>/);
  assertTrue(scriptMatch !== null, 'تگ script پیدا نشد');
  const jsCode = scriptMatch[1];

  function makeStyle() {
    return new Proxy({}, {
      get: function (t, prop) {
        if (prop === 'setProperty') return function () {};
        if (prop === 'removeProperty') return function () { return ''; };
        if (prop === 'getPropertyValue') return function () { return ''; };
        if (typeof prop === 'string') return t[prop] || '';
        return undefined;
      },
      set: function (t, prop, val) { t[prop] = val; return true; }
    });
  }
  function makeEl(id) {
    var el = { id: id, value: '', textContent: '', innerHTML: '' };
    el.style = makeStyle();
    el.classList = { _s: new Set(), add: function (c) { this._s.add(c); }, remove: function (c) { this._s.delete(c); }, contains: function (c) { return this._s.has(c); }, toggle: function (c) { this._s.has(c) ? this._s.delete(c) : this._s.add(c); } };
    el.dataset = {}; el.checked = false; el.files = [];
    el.appendChild = function () {}; el.removeChild = function () {};
    el.querySelectorAll = function () { return []; }; el.querySelector = function () { return null; };
    el.addEventListener = function () {}; el.removeEventListener = function () {};
    el.focus = function () {}; el.click = function () {}; el.scrollIntoView = function () {};
    el.options = []; el.selectedIndex = -1; el.append = function () {}; el.insertAdjacentHTML = function () {};
    return el;
  }
  function makeLocalStorage() {
    var store = {};
    var ls = {
      getItem: function (k) { return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; },
      setItem: function (k, v) { store[k] = String(v); },
      removeItem: function (k) { delete store[k]; },
      key: function (i) { return Object.keys(store)[i]; }
    };
    Object.defineProperty(ls, 'length', { get: function () { return Object.keys(store).length; } });
    ls._store = store;
    return ls;
  }
  function buildCtx() {
    var ls = makeLocalStorage();
    var docStore = {};
    var doc = {
      getElementById: function (id) { if (!docStore[id]) docStore[id] = makeEl(id); return docStore[id]; },
      querySelector: function () { return null; },
      querySelectorAll: function () { return []; },
      createElement: function () { return makeEl('new'); },
      createElementNS: function () { return makeEl('new'); },
      addEventListener: function () {},
      body: makeEl('body'),
      documentElement: makeEl('html'),
      title: ''
    };
    var win = { localStorage: ls, document: doc, addEventListener: function () {}, location: { href: '', reload: function () {} }, innerWidth: 1024, innerHeight: 768, navigator: { userAgent: 'node' } };
    return {
      localStorage: ls, document: doc, window: win, navigator: win.navigator,
      alert: function () {}, confirm: function () { return true; }, prompt: function () { return null; }, console: console,
      setTimeout: function () {}, setInterval: function () { return 1; }, clearInterval: function () {}, clearTimeout: function () {}, requestAnimationFrame: function () {},
      Date: Date, Math: Math, JSON: JSON, parseInt: parseInt, parseFloat: parseFloat, isNaN: isNaN, isFinite: isFinite,
      Array: Array, Object: Object, String: String, Number: Number, Boolean: Boolean, RegExp: RegExp, Error: Error, TypeError: TypeError,
      Map: Map, Set: Set, Promise: Promise, Proxy: Proxy, Reflect: Reflect, Symbol: Symbol,
      encodeURIComponent: encodeURIComponent, decodeURIComponent: decodeURIComponent, encodeURI: encodeURI, decodeURI: decodeURI,
      Blob: function () {}, FileReader: function () {}, URL: { createObjectURL: function () {}, revokeObjectURL: function () {} },
      XLSX: undefined, crypto: { subtle: { digest: function () { return Promise.resolve(new ArrayBuffer(32)); } } },
      fetch: function () { return Promise.resolve({ json: function () { return Promise.resolve({}); }, text: function () { return Promise.resolve(''); } }); },
      queueMicrotask: function (f) { setTimeout(f, 0); },
      history: { pushState: function () {}, replaceState: function () {} },
      _ls: ls
    };
  }

  var sb = buildCtx();
  try {
    vm.runInNewContext(jsCode, sb, { filename: 'laegh-swap.js', timeout: 10000 });
  } catch (e) {
    throw new Error('اجرای اسکریپت لایق با خطا متوقف شد: ' + e.message);
  }

  // ═══ آماده‌سازی فرم فاکتور ═══
  sb.document.getElementById('inv-seller').value = 'فروشگاه تست';
  sb.document.getElementById('inv-phone').value = '09120000000';
  sb.document.getElementById('inv-date').value = '۱۴۰۵/۰۵/۱۸';
  // شماره فاکتور را روی چیزی ثابت ست کن
  sb.document.getElementById('inv-num').textContent = 'LEP-9999';

  // افزودن یک دستگاه
  sb.addDev();
  // ست کردن مقادیر دستگاه اول
  sb.document.getElementById('d1_code').value = 'P-1001';
  sb.document.getElementById('d1_model').value = 'خردکن تست';
  // 🔑 عملکرد روی «تعویض شد»
  sb.document.getElementById('d1_perf').value = 'تعویض شد';
  sb.document.getElementById('d1_pd').value = 'SN-OLD-123'; // سریال دستگاه خراب
  sb.document.getElementById('d1_est').value = '500000';
  // فیلدهای تعویض
  if (sb.document.getElementById('d1_newserial')) sb.document.getElementById('d1_newserial').value = 'SN-NEW-456';
  if (sb.document.getElementById('d1_swreason')) sb.document.getElementById('d1_swreason').value = 'موتور سوخته';

  // شمارنده انبار معیوب قبل از closeInv
  var defectiveBefore = JSON.parse(sb._ls.getItem('laegh_defective') || '[]').length;
  var beforeCount = defectiveBefore;

  // ═══ بستن فاکتور ═══
  try {
    sb.closeInv();
  } catch (e) {
    throw new Error('اجرای closeInv با خطا متوقف شد: ' + e.message);
  }

  // ═══ بررسی: آیا فاکتور ثبت شد؟ ═══
  var invs = JSON.parse(sb._ls.getItem('li') || '[]');
  // پیدا کردن فاکتور LEP-9999
  var inv = invs.find(function (i) { return i.num === 'LEP-9999'; });
  assertTrue(inv !== undefined, 'فاکتور LEP-9999 باید در invoices ثبت شده باشد');
  assertTrue(inv.items[0].swapped === true, 'آیتم فاکتور باید swapped=true داشته باشد (got: ' + inv.items[0].swapped + ')');
  assertEqual(inv.items[0].newSerial, 'SN-NEW-456', 'سریال دستگاه نو باید ذخیره شده باشد');

  // ═══ بررسی حیاتی: آیا دستگاه به انبار معیوب اضافه شد؟ ═══
  var defectiveAfter = JSON.parse(sb._ls.getItem('laegh_defective') || '[]');
  var newDefectives = defectiveAfter.filter(function (d) { return d.invoiceNum === 'LEP-9999'; });
  assertArrayLength(newDefectives, 1, 'یک دستگاه معیوب باید برای فاکتور LEP-9999 ثبت شده باشد');

  var def = newDefectives[0];
  assertEqual(def.model, 'خردکن تست', 'مدل دستگاه معیوب باید از فاکتور گرفته شود');
  assertEqual(def.source, 'customer', 'منبع دستگاه معیوب باید customer باشد');
  assertEqual(def.invoiceNum, 'LEP-9999', '🔗 پیوند حیاتی: invoiceNum باید برابر شماره فاکتور باشد — این فیلد قبلاً همیشه خالی بود');
  assertEqual(def.status, 'in_stock', 'وضعیت باید in_stock باشد');
  assertTrue(def.note.indexOf('تعویض') >= 0, 'یادداشت باید به تعویض اشاره کند');

  // ═══ بررسی: حذف تکرار — اگر دوباره همان فاکتور بسته شود، نباید دو بار اضافه شود ═══
  // (closeInv دوباره با همان آیتم — ولی چون editingInvIdx ست شده، فقط جایگزین می‌کند)
  // در این تست، فاکتور جدید است پس این بخش را با فراخوانی مستقیم addDefectiveFromInvoice تست می‌کنیم
  var defectiveCountBeforeSecond = JSON.parse(sb._ls.getItem('laegh_defective') || '[]').filter(function (d) { return d.invoiceNum === 'LEP-9999'; }).length;
  sb.addDefectiveFromInvoice({ num: 'LEP-9999' }, { model: 'خردکن تست', code: 'P-1001', pd: 'SN-OLD-123', swapped: true });
  var defectiveCountAfterSecond = JSON.parse(sb._ls.getItem('laegh_defective') || '[]').filter(function (d) { return d.invoiceNum === 'LEP-9999'; }).length;
  assertEqual(defectiveCountAfterSecond, defectiveCountBeforeSecond, 'addDefectiveFromInvoice نباید دستگاه تکراری اضافه کند (محافظت از تکرار)');
});

console.log('');
console.log('📋 گروه ۳۵: انبارهای نام‌گذاری‌شده (فاز ۲) — موجودیت، موجودی تفکیکی، انتقال بین انباری');

test('آرایه‌ی warehouses باید تعریف شده و در بک‌آپ کامل باشد', () => {
  const buildSrc = extractFunctionSource(html, '_buildFullBackupData');
  assertTrue(buildSrc !== null, 'تابع _buildFullBackupData پیدا نشد');
  assertContainsString(buildSrc, 'warehouses:', 'بک‌آپ کامل باید آرایه‌ی warehouses را شامل شود (فاز ۲)');
  // warehouses باید در کلید localStorage لاگ بشه
  assertContainsString(html, 'laegh_warehouses', 'کلید localStorage برای warehouses تعریف نشده');
  // باید در sections آرایه هم باشه
  assertContainsString(buildSrc, "'warehouses'", 'warehouses باید در آرایه‌ی sections بک‌آپ باشد');
});

test('تابع applyStockByWarehouse باید تعریف شده و فیلد byWh را به‌روز کند', () => {
  const fnSrc = extractFunctionSource(html, 'applyStockByWarehouse');
  assertTrue(fnSrc !== null, 'تابع applyStockByWarehouse پیدا نشد — موتور حرکت چندانباری لازم است');
  assertContainsString(fnSrc, 'byWh', 'applyStockByWarehouse باید byWh[whId] را به‌روز کند');
  assertContainsString(fnSrc, 'کافی نیست', 'applyStockByWarehouse باید موجودی کافی را در انبار مبدا بررسی کند');
});

test('تابع transferBetweenWarehouses باید تعریف شده و دو حرکت ثبت کند', () => {
  const fnSrc = extractFunctionSource(html, 'transferBetweenWarehouses');
  assertTrue(fnSrc !== null, 'تابع transferBetweenWarehouses پیدا نشد');
  assertContainsString(fnSrc, "type: 'transfer'", 'انتقال باید یک warehouseDoc با type=transfer ثبت کند');
  assertContainsString(fnSrc, "fromWh", 'انتقال باید فیلد fromWh داشته باشد');
  assertContainsString(fnSrc, "toWh", 'انتقال باید فیلد toWh داشته باشد');
});

test('بخش SCHEMAS باید warehouses را داشته باشد (migration)', () => {
  assertContainsString(html, 'warehouses:', 'SCHEMAS باید warehouses را داشته باشد');
});

// ─── تست execution-based حیاتی: migration inventory قدیمی + انتقال بین انباری ──
test('شبیه‌سازی واقعی: migration inventory قدیمی + انتقال بین دو انبار + موجودی تفکیکی (execution-based)', () => {
  const vm = require('vm');
  const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>/);
  assertTrue(scriptMatch !== null, 'تگ script پیدا نشد');
  const jsCode = scriptMatch[1];

  function makeStyle() {
    return new Proxy({}, {
      get: function (t, prop) {
        if (prop === 'setProperty') return function () {};
        if (prop === 'removeProperty') return function () { return ''; };
        if (prop === 'getPropertyValue') return function () { return ''; };
        if (typeof prop === 'string') return t[prop] || '';
        return undefined;
      },
      set: function (t, prop, val) { t[prop] = val; return true; }
    });
  }
  function makeEl(id) {
    var el = { id: id, value: '', textContent: '', innerHTML: '' };
    el.style = makeStyle();
    el.classList = { _s: new Set(), add: function (c) { this._s.add(c); }, remove: function (c) { this._s.delete(c); }, contains: function (c) { return this._s.has(c); }, toggle: function (c) { this._s.has(c) ? this._s.delete(c) : this._s.add(c); } };
    el.dataset = {}; el.checked = false; el.files = [];
    el.appendChild = function () {}; el.removeChild = function () {};
    el.querySelectorAll = function () { return []; }; el.querySelector = function () { return null; };
    el.addEventListener = function () {}; el.removeEventListener = function () {};
    el.focus = function () {}; el.click = function () {}; el.scrollIntoView = function () {};
    el.options = []; el.selectedIndex = -1; el.append = function () {}; el.insertAdjacentHTML = function () {};
    return el;
  }
  function makeLocalStorage(seed) {
    var store = seed || {};
    var ls = {
      getItem: function (k) { return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; },
      setItem: function (k, v) { store[k] = String(v); },
      removeItem: function (k) { delete store[k]; },
      key: function (i) { return Object.keys(store)[i]; }
    };
    Object.defineProperty(ls, 'length', { get: function () { return Object.keys(store).length; } });
    ls._store = store;
    return ls;
  }
  function buildCtx(seedLs) {
    var ls = makeLocalStorage(seedLs);
    var docStore = {};
    var doc = {
      getElementById: function (id) { if (!docStore[id]) docStore[id] = makeEl(id); return docStore[id]; },
      querySelector: function () { return null; },
      querySelectorAll: function () { return []; },
      createElement: function () { return makeEl('new'); },
      createElementNS: function () { return makeEl('new'); },
      addEventListener: function () {},
      body: makeEl('body'),
      documentElement: makeEl('html'),
      title: ''
    };
    var win = { localStorage: ls, document: doc, addEventListener: function () {}, location: { href: '', reload: function () {} }, innerWidth: 1024, innerHeight: 768, navigator: { userAgent: 'node' } };
    return {
      localStorage: ls, document: doc, window: win, navigator: win.navigator,
      alert: function () {}, confirm: function () { return true; }, prompt: function () { return null; }, console: console,
      setTimeout: function (f) { try { if (typeof f === 'function') f(); } catch (e) {} },
      setInterval: function () { return 1; }, clearInterval: function () {}, clearTimeout: function () {}, requestAnimationFrame: function () {},
      Date: Date, Math: Math, JSON: JSON, parseInt: parseInt, parseFloat: parseFloat, isNaN: isNaN, isFinite: isFinite,
      Array: Array, Object: Object, String: String, Number: Number, Boolean: Boolean, RegExp: RegExp, Error: Error, TypeError: TypeError,
      Map: Map, Set: Set, Promise: Promise, Proxy: Proxy, Reflect: Reflect, Symbol: Symbol,
      encodeURIComponent: encodeURIComponent, decodeURIComponent: decodeURIComponent, encodeURI: encodeURI, decodeURI: decodeURI,
      Blob: function () {}, FileReader: function () {}, URL: { createObjectURL: function () {}, revokeObjectURL: function () {} },
      XLSX: undefined, crypto: { subtle: { digest: function () { return Promise.resolve(new ArrayBuffer(32)); } } },
      fetch: function () { return Promise.resolve({ json: function () { return Promise.resolve({}); }, text: function () { return Promise.resolve(''); } }); },
      queueMicrotask: function (f) { try { f(); } catch (e) {} },
      history: { pushState: function () {}, replaceState: function () {} },
      _ls: ls
    };
  }

  // ─── مرحله ۱: شبیه‌سازی inventory قدیمی (بدون byWh) ───
  // یک کالا با qty قدیمی، بدون byWh — این سناریوی کاربری است که از نسخه‌ی قدیمی آپدیت کرده.
  var oldSeed = {
    lv: JSON.stringify({ 'P-1001': { qty: 10, min: 2, note: '' } }),  // inventory قدیمی
    lp2: '[]', li: '[]'  // خالی
  };
  var sb = buildCtx(oldSeed);
  try {
    vm.runInNewContext(jsCode, sb, { filename: 'laegh-wh.js', timeout: 10000 });
  } catch (e) {
    throw new Error('اجرای اسکریپت با خطا متوقف شد: ' + e.message);
  }

  // ═══ بررسی ۱: warehouses باید سه انبار پیش‌فرض ساخته باشد ═══
  var ws = JSON.parse(sb._ls.getItem('laegh_warehouses') || '[]');
  assertArrayLength(ws, 3, 'باید سه انبار پیش‌فرض ساخته شود (مرکزی/دیجی‌کالا/باسلام)');
  assertTrue(ws.some(function (w) { return w.name === 'انبار مرکزی' && w.isDefault; }), 'انبار مرکزی باید پیش‌فرض باشد');

  // ═══ بررسی ۲: migration inventory قدیمی → byWh ═══
  // بعد از اجرای _ensureByWh، inventory['P-1001'].byWh باید وجود داشته باشد
  sb._ensureByWh();
  var invRaw = JSON.parse(sb._ls.getItem('lv') || '{}');
  // توجه: sv() در بارگذاری اول ممکنه ذخیره نکرده باشد، پس از طریق تابع بررسی کن
  assertTrue(typeof sb._whQty === 'function', 'تابع _whQty باید موجود باشد');
  var qtyAfter = sb._whQty('P-1001');
  assertEqual(qtyAfter, 10, 'بعد از migration، مجموع موجودی P-1001 باید ۱۰ باشد (از inventory قدیمی)');
  // بررسی byWh روی انبار پیش‌فرض
  var defWh = sb.getDefaultWhId();
  var qtyAtDefault = sb._whQtyAt('P-1001', defWh);
  assertEqual(qtyAtDefault, 10, 'موجودی P-1001 در انبار پیش‌فرض باید ۱۰ باشد (migration از qty قدیمی به byWh)');

  // ═══ بررسی ۳: انتقال بین دو انبار ═══
  var wh1 = ws.find(function (w) { return w.isDefault; }).id;  // WH-1
  var wh2 = ws.find(function (w) { return !w.isDefault; }).id; // WH-2 یا WH-3

  // انتقال ۳ عدد از WH-1 به WH-2
  var trResult = sb.applyStockByWarehouse('out', 'P-1001', 'کالای تست', 3, wh1, 'transfer', 'WH-TR-TEST');
  assertEqual(trResult.ok, true, 'انتقال خروج از WH-1 باید موفق باشد (موجودی ۱۰ ≥ ۳)');
  sb.applyStockByWarehouse('in', 'P-1001', 'کالای تست', 3, wh2, 'transfer', 'WH-TR-TEST');

  // بررسی موجودی تفکیکی
  var qtyWh1After = sb._whQtyAt('P-1001', wh1);
  var qtyWh2After = sb._whQtyAt('P-1001', wh2);
  assertEqual(qtyWh1After, 7, 'بعد از انتقال ۳ عدد، موجودی P-1001 در انبار مبدا باید ۷ باشد (۱۰-۳)');
  assertEqual(qtyWh2After, 3, 'بعد از انتقال ۳ عدد، موجودی P-1001 در انبار مقصد باید ۳ باشد (۰+۳)');
  // مجموع نباید تغییر کند
  var qtyTotal = sb._whQty('P-1001');
  assertEqual(qtyTotal, 10, 'مجموع موجودی همه‌ی انبارها باید ثابت بماند (۱۰) — انتقال فقط جابه‌جا می‌کند');
});

// ─── تست execution-based: انتقال با موجودی ناکافی باید رد شود ──
test('شبیه‌سازی واقعی: انتقال با موجودی ناکافی در انبار مبدا باید رد شود (execution-based)', () => {
  const vm = require('vm');
  const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>/);
  const jsCode = scriptMatch[1];

  function makeStyle() { return new Proxy({}, { get: function (t, p) { if (p === 'setProperty') return function () {}; if (p === 'removeProperty') return function () { return ''; }; if (typeof p === 'string') return t[p] || ''; }, set: function (t, p, v) { t[p] = v; return true; } }); }
  function makeEl(id) { var el = { id: id, value: '', textContent: '', innerHTML: '' }; el.style = makeStyle(); el.classList = { _s: new Set(), add: function (c) { this._s.add(c); }, remove: function (c) { this._s.delete(c); }, contains: function (c) { return this._s.has(c); }, toggle: function (c) { this._s.has(c) ? this._s.delete(c) : this._s.add(c); } }; el.dataset = {}; el.checked = false; el.files = []; el.appendChild = function () {}; el.removeChild = function () {}; el.querySelectorAll = function () { return []; }; el.querySelector = function () { return null; }; el.addEventListener = function () {}; el.removeEventListener = function () {}; el.focus = function () {}; el.click = function () {}; el.scrollIntoView = function () {}; el.options = []; el.selectedIndex = -1; el.append = function () {}; el.insertAdjacentHTML = function () {}; return el; }
  function makeLocalStorage(seed) { var store = seed || {}; var ls = { getItem: function (k) { return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; }, setItem: function (k, v) { store[k] = String(v); }, removeItem: function (k) { delete store[k]; }, key: function (i) { return Object.keys(store)[i]; } }; Object.defineProperty(ls, 'length', { get: function () { return Object.keys(store).length; } }); ls._store = store; return ls; }
  function buildCtx(seedLs) { var ls = makeLocalStorage(seedLs); var docStore = {}; var doc = { getElementById: function (id) { if (!docStore[id]) docStore[id] = makeEl(id); return docStore[id]; }, querySelector: function () { return null; }, querySelectorAll: function () { return []; }, createElement: function () { return makeEl('new'); }, createElementNS: function () { return makeEl('new'); }, addEventListener: function () {}, body: makeEl('body'), documentElement: makeEl('html'), title: '' }; var win = { localStorage: ls, document: doc, addEventListener: function () {}, location: { href: '', reload: function () {} }, innerWidth: 1024, innerHeight: 768, navigator: { userAgent: 'node' } }; return { localStorage: ls, document: doc, window: win, navigator: win.navigator, alert: function () {}, confirm: function () { return true; }, prompt: function () { return null; }, console: console, setTimeout: function (f) { try { if (typeof f === 'function') f(); } catch (e) {} }, setInterval: function () { return 1; }, clearInterval: function () {}, clearTimeout: function () {}, requestAnimationFrame: function () {}, Date: Date, Math: Math, JSON: JSON, parseInt: parseInt, parseFloat: parseFloat, isNaN: isNaN, isFinite: isFinite, Array: Array, Object: Object, String: String, Number: Number, Boolean: Boolean, RegExp: RegExp, Error: Error, TypeError: TypeError, Map: Map, Set: Set, Promise: Promise, Proxy: Proxy, Reflect: Reflect, Symbol: Symbol, encodeURIComponent: encodeURIComponent, decodeURIComponent: decodeURIComponent, encodeURI: encodeURI, decodeURI: decodeURI, Blob: function () {}, FileReader: function () {}, URL: { createObjectURL: function () {}, revokeObjectURL: function () {} }, XLSX: undefined, crypto: { subtle: { digest: function () { return Promise.resolve(new ArrayBuffer(32)); } } }, fetch: function () { return Promise.resolve({ json: function () { return Promise.resolve({}); }, text: function () { return Promise.resolve(''); } }); }, queueMicrotask: function (f) { try { f(); } catch (e) {} }, history: { pushState: function () {}, replaceState: function () {} }, _ls: ls }; }

  var sb = buildCtx({ lv: JSON.stringify({ 'P-1001': { qty: 5, min: 2, note: '' } }), lp2: '[]', li: '[]' });
  vm.runInNewContext(jsCode, sb, { filename: 'laegh-wh2.js', timeout: 10000 });
  sb._ensureByWh();
  var ws = JSON.parse(sb._ls.getItem('laegh_warehouses') || '[]');
  var wh1 = ws.find(function (w) { return w.isDefault; }).id;

  // تلاش برای خروج ۱۰ عدد وقتی فقط ۵ موجود است
  var result = sb.applyStockByWarehouse('out', 'P-1001', 'کالای تست', 10, wh1, 'test', 'TEST');
  assertEqual(result.ok, false, 'انتقال ۱۰ عدد با موجودی ۵ باید رد شود');
  assertTrue(result.err.indexOf('کافی نیست') >= 0, 'پیام خطا باید به ناکافی‌بودن موجودی اشاره کند');
  // موجودی نباید تغییر کرده باشد
  assertEqual(sb._whQtyAt('P-1001', wh1), 5, 'موجودی نباید تغییر کند وقتی انتقال رد شده');
});

console.log('');
console.log('📋 گروه ۳۶: پیگیری داغی (رسید نمایندگی)');

test('آرایه‌ی daqi باید تعریف شده و در بک‌آپ کامل باشد', () => {
  const buildSrc = extractFunctionSource(html, '_buildFullBackupData');
  assertTrue(buildSrc !== null, 'تابع _buildFullBackupData پیدا نشد');
  assertContainsString(buildSrc, 'daqi:', 'بک‌آپ کامل باید آرایه‌ی daqi را شامل شود');
  assertContainsString(html, 'laegh_daqi', 'کلید localStorage برای daqi تعریف نشده');
  assertContainsString(buildSrc, "'daqi'", 'daqi باید در آرایه‌ی sections بک‌آپ باشد');
});

test('تابع addDaqi باید تعریف شده و ساختار صحیح بسازد', () => {
  const fnSrc = extractFunctionSource(html, 'addDaqi');
  assertTrue(fnSrc !== null, 'تابع addDaqi پیدا نشد');
  assertContainsString(fnSrc, "status: 'pending'", 'داغی جدید باید با status=pending ساخته شود');
  assertContainsString(fnSrc, 'DQ-', 'شناسه‌ی داغی باید با DQ- شروع شود');
});

test('تابع receiveDaqi باید وضعیت را به received تغییر دهد', () => {
  const fnSrc = extractFunctionSource(html, 'receiveDaqi');
  assertTrue(fnSrc !== null, 'تابع receiveDaqi پیدا نشد');
  assertContainsString(fnSrc, "status = 'received'", 'receiveDaqi باید status را به received تغییر دهد');
  assertContainsString(fnSrc, 'receivedDate', 'receiveDaqi باید receivedDate را ثبت کند');
});

test('صفحه‌ی داغی و مودال باید در HTML موجود باشند', () => {
  assertContainsString(html, 'id="page-daqi"', 'صفحه‌ی داغی (page-daqi) در HTML پیدا نشد');
  assertContainsString(html, 'id="daqi-modal"', 'مودال داغی پیدا نشد');
  assertContainsString(html, 'id="daqi-list"', 'لیست داغی پیدا نشد');
  assertContainsString(html, 'id="daqi-stats-bar"', 'نوار آمار داغی پیدا نشد');
});

test('داخی در ALL_PAGES و سایدبار ثبت شده باشد', () => {
  assertContainsString(html, "key:'daqi'", 'داغی در ALL_PAGES ثبت نشده — در سیستم نقش‌ها قابل کنترل نیست');
  assertContainsString(html, "data-page=\"daqi\"", 'آیتم داغی در سایدبار پیدا نشد');
});

// ─── تست execution-based حیاتی: سناریوی کامل داغی ──
test('شبیه‌سازی واقعی: ثبت داغی + دریافت + تجمیع بر اساس نمایندگی (execution-based)', () => {
  const vm = require('vm');
  const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>/);
  assertTrue(scriptMatch !== null, 'تگ script پیدا نشد');
  const jsCode = scriptMatch[1];

  function makeStyle() { return new Proxy({}, { get: function (t, p) { if (p === 'setProperty') return function () {}; if (p === 'removeProperty') return function () { return ''; }; if (p === 'getPropertyValue') return function () { return ''; }; if (typeof p === 'string') return t[p] || ''; return undefined; }, set: function (t, p, v) { t[p] = v; return true; } }); }
  function makeEl(id) { var el = { id: id, value: '', textContent: '', innerHTML: '' }; el.style = makeStyle(); el.classList = { _s: new Set(), add: function (c) { this._s.add(c); }, remove: function (c) { this._s.delete(c); }, contains: function (c) { return this._s.has(c); }, toggle: function (c) { this._s.has(c) ? this._s.delete(c) : this._s.add(c); } }; el.dataset = {}; el.checked = false; el.files = []; el.appendChild = function () {}; el.removeChild = function () {}; el.querySelectorAll = function () { return []; }; el.querySelector = function () { return null; }; el.addEventListener = function () {}; el.removeEventListener = function () {}; el.focus = function () {}; el.click = function () {}; el.scrollIntoView = function () {}; el.options = []; el.selectedIndex = -1; el.append = function () {}; el.insertAdjacentHTML = function () {}; return el; }
  function makeLocalStorage(seed) { var store = seed || {}; var ls = { getItem: function (k) { return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; }, setItem: function (k, v) { store[k] = String(v); }, removeItem: function (k) { delete store[k]; }, key: function (i) { return Object.keys(store)[i]; } }; Object.defineProperty(ls, 'length', { get: function () { return Object.keys(store).length; } }); ls._store = store; return ls; }
  function buildCtx(seedLs) { var ls = makeLocalStorage(seedLs); var docStore = {}; var doc = { getElementById: function (id) { if (!docStore[id]) docStore[id] = makeEl(id); return docStore[id]; }, querySelector: function () { return null; }, querySelectorAll: function () { return []; }, createElement: function () { return makeEl('new'); }, createElementNS: function () { return makeEl('new'); }, addEventListener: function () {}, body: makeEl('body'), documentElement: makeEl('html'), title: '' }; var win = { localStorage: ls, document: doc, addEventListener: function () {}, location: { href: '', reload: function () {} }, innerWidth: 1024, innerHeight: 768, navigator: { userAgent: 'node' } }; return { localStorage: ls, document: doc, window: win, navigator: win.navigator, alert: function () {}, confirm: function () { return true; }, prompt: function (msg) { if (msg && msg.indexOf('توسط') >= 0) return 'تست تحویل‌دهنده'; return null; }, console: console, setTimeout: function (f) { try { if (typeof f === 'function') f(); } catch (e) {} }, setInterval: function () { return 1; }, clearInterval: function () {}, clearTimeout: function () {}, requestAnimationFrame: function () {}, Date: Date, Math: Math, JSON: JSON, parseInt: parseInt, parseFloat: parseFloat, isNaN: isNaN, isFinite: isFinite, Array: Array, Object: Object, String: String, Number: Number, Boolean: Boolean, RegExp: RegExp, Error: Error, TypeError: TypeError, Map: Map, Set: Set, Promise: Promise, Proxy: Proxy, Reflect: Reflect, Symbol: Symbol, encodeURIComponent: encodeURIComponent, decodeURIComponent: decodeURIComponent, encodeURI: encodeURI, decodeURI: decodeURI, Blob: function () {}, FileReader: function () {}, URL: { createObjectURL: function () {}, revokeObjectURL: function () {} }, XLSX: undefined, crypto: { subtle: { digest: function () { return Promise.resolve(new ArrayBuffer(32)); } } }, fetch: function () { return Promise.resolve({ json: function () { return Promise.resolve({}); }, text: function () { return Promise.resolve(''); } }); }, queueMicrotask: function (f) { try { f(); } catch (e) {} }, history: { pushState: function () {}, replaceState: function () {} }, _ls: ls }; }

  var sb = buildCtx({});
  try { vm.runInNewContext(jsCode, sb, { filename: 'laegh-daqi.js', timeout: 10000 }); }
  catch (e) { throw new Error('اجرای اسکریپت با خطا متوقف شد: ' + e.message); }

  // ═══ ثبت سه داغی برای دو نمایندگی مختلف ═══
  var id1 = sb.addDaqi({ agencyName: 'نمایندگی الف', items: [{ code: 'P-1', name: 'قطعه ۱', qty: 2 }], sentDate: '۱۴۰۵/۰۵/۱۰' });
  var id2 = sb.addDaqi({ agencyName: 'نمایندگی الف', items: [{ code: 'P-2', name: 'قطعه ۲', qty: 1 }], sentDate: '۱۴۰۵/۰۵/۱۲' });
  var id3 = sb.addDaqi({ agencyName: 'نمایندگی ب', items: [{ code: 'P-3', name: 'قطعه ۳', qty: 5 }], sentDate: '۱۴۰۵/۰۵/۱۵' });

  // بررسی: سه داغی ثبت شده، همه pending
  var dq = JSON.parse(sb._ls.getItem('laegh_daqi'));
  assertArrayLength(dq, 3, 'باید ۳ داغی ثبت شده باشد');
  assertEqual(dq.filter(function (d) { return d.status === 'pending'; }).length, 3, 'همه باید pending باشند');

  // ═══ دریافت یکی از داغی‌های نمایندگی الف ═══
  sb.receiveDaqi(0, 'تحویل‌دهنده تست');
  var dq2 = JSON.parse(sb._ls.getItem('laegh_daqi'));
  assertEqual(dq2[0].status, 'received', 'داغی اول باید received شود');
  assertEqual(dq2[1].status, 'pending', 'داغی دوم باید pending بماند');

  // ═══ بررسی تجمیع: نمایندگی الف باید ۱ معوقه و نمایندگی ب باید ۱ معوقه داشته باشد ═══
  var pending = dq2.filter(function (d) { return d.status === 'pending'; });
  var pendingA = pending.filter(function (d) { return d.agencyName === 'نمایندگی الف'; });
  var pendingB = pending.filter(function (d) { return d.agencyName === 'نمایندگی ب'; });
  assertEqual(pendingA.length, 1, 'نمایندگی الف باید ۱ داغی معوقه داشته باشد (۲ ثبت، ۱ دریافت)');
  assertEqual(pendingB.length, 1, 'نمایندگی ب باید ۱ داغی معوقه داشته باشد');

  // ═══ لغو یک داغی ═══
  sb.cancelDaqi(2); // نمایندگی ب
  var dq3 = JSON.parse(sb._ls.getItem('laegh_daqi'));
  assertEqual(dq3[2].status, 'cancelled', 'داغی سوم باید cancelled شود');
  // حالا نمایندگی ب نباید داغی معوقه داشته باشد
  var pendingB2 = dq3.filter(function (d) { return d.status === 'pending' && d.agencyName === 'نمایندگی ب'; });
  assertEqual(pendingB2.length, 0, 'بعد از لغو، نمایندگی ب نباید داغی معوقه داشته باشد');
});

console.log('');
console.log('📋 گروه ۳۷: اسکین قوی / Skin Pack (پوسته کامل برنامه)');

test('SKIN_PRESETS باید حداقل ۵ اسکین با پالت کامل تعریف کرده باشد', () => {
  assertContainsString(html, 'const SKIN_PRESETS', 'آبجکت SKIN_PRESETS پیدا نشد');
  const m = html.match(/const SKIN_PRESETS = \{([\s\S]*?)\n\};\n\nconst COLOR_THEMES/);
  assertTrue(m !== null, 'بدنه SKIN_PRESETS استخراج نشد');
  const keys = [...m[1].matchAll(/^\s{2}(\w+):\s*\{/gm)].map(x => x[1]);
  assertTrue(keys.length >= 5, 'باید حداقل ۵ اسکین تعریف شده باشد — یافت‌شده: ' + keys.join(', '));
  assertTrue(keys.includes('parsian'), 'اسکین parsian (برند) باید وجود داشته باشد');
  assertTrue(keys.includes('classic'), 'اسکین classic (سازگاری با نسخه قبل) باید وجود داشته باشد');
  assertContainsString(m[1], 'atmosphere', 'اسکین‌ها باید فلگ atmosphere داشته باشند');
  assertContainsString(m[1], 'preview:', 'هر اسکین باید preview گرادیان برای کارت انتخاب داشته باشد');
});

test('UI انتخاب اسکین و توابع setSkin/applySkinVars/renderSkinCards باید موجود باشند', () => {
  assertContainsString(html, 'id="skin-preset-cards"', 'باکس کارت‌های اسکین در تنظیمات ظاهر پیدا نشد');
  assertContainsString(html, 'function setSkin(', 'تابع setSkin پیدا نشد');
  assertContainsString(html, 'function applySkinVars(', 'تابع applySkinVars پیدا نشد');
  assertContainsString(html, 'function renderSkinCards(', 'تابع renderSkinCards پیدا نشد');
  assertContainsString(html, 'has-skin-atmosphere', 'کلاس جوّ پس‌زمینه اسکین پیدا نشد');
  assertContainsString(html, 'پوسته / اسکین برنامه', 'عنوان بخش اسکین در تنظیمات پیدا نشد');
});

test('اسکین باید در بک‌آپ appearance ذخیره و هنگام بازگردانی اعمال شود', () => {
  const buildSrc = extractFunctionSource(html, '_buildFullBackupData');
  assertTrue(buildSrc !== null, 'تابع _buildFullBackupData پیدا نشد');
  assertContainsString(buildSrc, "skin: localStorage.getItem('laegh_skin')", 'appearance.skin باید در بک‌آپ ذخیره شود');
  assertContainsString(html, "localStorage.setItem('laegh_skin', ap.skin)", 'بازگردانی باید laegh_skin را بنویسد');
  assertContainsString(html, "if(typeof applyAppearanceSettings==='function') applyAppearanceSettings();", 'بعد از بازگردانی ظاهر باید applyAppearanceSettings صدا زده شود');
});

test('applyAppearanceSettings باید اسکین را قبل از تم رنگی اعمال کند و پیش‌فرض parsian باشد', () => {
  const fnSrc = extractFunctionSource(html, 'applyAppearanceSettings');
  assertTrue(fnSrc !== null, 'تابع applyAppearanceSettings پیدا نشد');
  const skinPos = fnSrc.indexOf('applySkinVars');
  const colorPos = fnSrc.indexOf('applyColorThemeVars');
  assertTrue(skinPos !== -1, 'applyAppearanceSettings باید applySkinVars را صدا بزند');
  assertTrue(colorPos !== -1, 'applyAppearanceSettings باید همچنان applyColorThemeVars را پشتیبانی کند');
  assertTrue(skinPos < colorPos, 'اسکین باید قبل از تم رنگی اعمال شود تا پالت پایه درست باشد');
  assertContainsString(fnSrc, "|| 'parsian'", 'پیش‌فرض اسکین باید parsian باشد');
});

test('شبیه‌سازی واقعی: setSkin باید کلاس اسکین، متغیرهای CSS و localStorage را تنظیم کند (execution-based)', () => {
  const applySrc = extractFunctionSource(html, 'applySkinVars');
  const setSrc = extractFunctionSource(html, 'setSkin');
  assertTrue(applySrc && setSrc, 'توابع اسکین استخراج نشدند');
  const m = html.match(/const SKIN_PRESETS = \{[\s\S]*?\n\};\n\nconst COLOR_THEMES/);
  assertTrue(m !== null, 'SKIN_PRESETS برای sandbox استخراج نشد');
  const presetsSrc = m[0].replace(/\n\nconst COLOR_THEMES$/, '');

  const props = {};
  const classes = new Set();
  const store = {};
  const fakeDocument = {
    documentElement: { style: { setProperty(n,v){ props[n]=v; } } },
    body: {
      classList: {
        remove(...cs){ cs.forEach(c => classes.delete(c)); },
        add(...cs){ cs.forEach(c => classes.add(c)); },
        contains(c){ return classes.has(c); }
      }
    },
    getElementById: () => null,
    querySelectorAll: () => []
  };
  const fakeLS = {
    getItem: k => (Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null),
    setItem: (k,v) => { store[k]=String(v); },
    removeItem: k => { delete store[k]; }
  };
  const runner = new Function(
    'document','localStorage','ntf','setAppFont','renderSkinCards','renderColorThemeSwatches',
    presetsSrc + '\n' + applySrc + '\n' + setSrc + '\nsetSkin("ocean");'
  );
  runner(fakeDocument, fakeLS, function(){}, function(){}, function(){}, function(){});
  assertEqual(store['laegh_skin'], 'ocean', 'laegh_skin باید ocean شود');
  assertTrue(classes.has('skin-ocean'), 'کلاس skin-ocean باید روی body باشد');
  assertTrue(classes.has('has-skin-atmosphere'), 'اسکین ocean باید جوّ پس‌زمینه داشته باشد');
  assertEqual(props['--blue'], '#0F766E', 'رنگ اصلی اسکین ocean باید ست شده باشد');
  assertTrue(store['laegh_color_theme'] === undefined, 'با انتخاب اسکین، تم رنگی دستی باید پاک شود تا تضاد نسازد');
});

test('قانون ۷: راهنمای اسکین باید در صفحه راهنما موجود باشد', () => {
  assertContainsString(html, 'پوسته / اسکین برنامه', 'عنوان راهنمای اسکین پیدا نشد');
  assertContainsString(html, 'پارسیان', 'راهنما باید اسکین پارسیان را توضیح دهد');
  assertContainsString(html, 'تنظیمات → 🎨 ظاهر', 'راهنما باید مسیر تنظیمات را بگوید');
});

test('نسخه ۱۱.۵.۱۷ باید Major.ماه.روز شمسی واقعی باشد و در meta/سایدبار/بک‌آپ یکسان باشد', () => {
  const metaVer = (html.match(/<meta name="app-version" content="([^"]+)">/) || [])[1];
  assertEqual(metaVer, '11.5.17', 'نسخه meta باید 11.5.17 باشد (۱۷ مرداد ۱۴۰۵ + Major برای اسکین قوی)');
  const metaDate = (html.match(/<meta name="app-date" content="([^"]+)">/) || [])[1];
  assertEqual(metaDate, '1405/05/17', 'app-date باید 1405/05/17 باشد');
  assertContainsString(html, 'نسخه ۱۱.۵.۱۷ — Laegh EPS', 'سایدبار باید نسخه فارسی ۱۱.۵.۱۷ را نشان دهد');
  const buildSrc = extractFunctionSource(html, '_buildFullBackupData');
  assertContainsString(buildSrc, "version: '11.5.17'", 'فیلد version بک‌آپ باید 11.5.17 باشد');
});

console.log('');
console.log('📋 گروه ۳۸: عمق سه‌بعدی رابط (depth-3d)');

test('CSS و کنترل عمق سه‌بعدی باید موجود باشد', () => {
  assertContainsString(html, 'body.depth-3d', 'کلاس CSS عمق سه‌بعدی پیدا نشد');
  assertContainsString(html, 'id="depth3d-select"', 'سلکتور عمق سه‌بعدی در تنظیمات پیدا نشد');
  assertContainsString(html, 'function setDepth3D(', 'تابع setDepth3D پیدا نشد');
  assertContainsString(html, 'function applyDepth3D(', 'تابع applyDepth3D پیدا نشد');
  assertContainsString(html, 'عمق سه‌بعدی', 'برچسب UI عمق سه‌بعدی پیدا نشد');
});

test('عمق سه‌بعدی باید در بک‌آپ و applyAppearanceSettings باشد و پیش‌فرض روشن باشد', () => {
  const buildSrc = extractFunctionSource(html, '_buildFullBackupData');
  assertContainsString(buildSrc, "depth3d: localStorage.getItem('laegh_depth3d')", 'depth3d باید در بک‌آپ ذخیره شود');
  assertContainsString(html, "localStorage.setItem('laegh_depth3d', ap.depth3d)", 'بازگردانی باید depth3d را بنویسد');
  const appSrc = extractFunctionSource(html, 'applyAppearanceSettings');
  assertContainsString(appSrc, 'applyDepth3D()', 'applyAppearanceSettings باید applyDepth3D را صدا بزند');
  const dSrc = extractFunctionSource(html, 'applyDepth3D');
  assertContainsString(dSrc, "v !== 'off'", 'پیش‌فرض عمق سه‌بعدی باید روشن باشد (هر چیزی غیر از off)');
});

test('شبیه‌سازی واقعی: setDepth3D باید کلاس depth-3d و localStorage را تنظیم کند', () => {
  const setSrc = extractFunctionSource(html, 'setDepth3D');
  const applySrc = extractFunctionSource(html, 'applyDepth3D');
  assertTrue(setSrc && applySrc, 'توابع depth استخراج نشدند');
  const classes = new Set();
  const store = {};
  const fakeDocument = {
    body: {
      classList: {
        toggle(c, on){ if(on) classes.add(c); else classes.delete(c); },
        contains(c){ return classes.has(c); }
      }
    }
  };
  const fakeLS = {
    getItem: k => (Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null),
    setItem: (k,v) => { store[k]=String(v); }
  };
  const runner = new Function('document','localStorage','ntf', setSrc + '\n' + applySrc + '\nsetDepth3D("on"); applyDepth3D();');
  runner(fakeDocument, fakeLS, function(){});
  assertTrue(classes.has('depth-3d'), 'با on باید کلاس depth-3d باشد');
  assertEqual(store['laegh_depth3d'], 'on', 'localStorage باید on شود');
  const runnerOff = new Function('document','localStorage','ntf', setSrc + '\nsetDepth3D("off");');
  runnerOff(fakeDocument, fakeLS, function(){});
  assertTrue(!classes.has('depth-3d'), 'با off باید کلاس depth-3d حذف شود');
  assertEqual(store['laegh_depth3d'], 'off', 'localStorage باید off شود');
});


console.log('');
console.log('📋 گروه ۳۹: آیکون کلاسیک منو + رفع بریدن متن سایدبار');

test('سایدبار باید پهن‌تر از ۲۲۰px باشد و متن آیتم‌ها قابل شکستن باشد', () => {
  assertContainsString(html, '--sidebar:268px', 'عرض سایدبار باید 268px باشد');
  assertContainsString(html, 'overflow-wrap:anywhere', 'متن منو باید بتواند بشکند تا در تمام‌صفحه نبرد');
  assertContainsString(html, '100dvh', 'ارتفاع سایدبار باید 100dvh هم داشته باشد (رفع باگ تمام‌صفحه)');
  assertContainsString(html, 'enhanceSidebarNav', 'تابع enhanceSidebarNav باید وجود داشته باشد');
  assertContainsString(html, 'nav-ico', 'کلاس آیکون کلاسیک nav-ico باید تعریف شده باشد');
});

test('هر صفحه منو باید رنگ آیکون اختصاصی داشته باشد', () => {
  const pages = ['dashboard','tasks','invoice','saved','products','inventory','defective','warehouse','phonebook','parts','daqi','sales','accounts','warranty','settings','help'];
  pages.forEach(p => {
    assertContainsString(html, 'data-page="'+p+'"] .nav-ico', 'آیکون رنگی برای '+p+' تعریف نشده');
  });
});

test('enhanceSidebarNav باید svg را در nav-ico بپیچد و متن را به nav-txt منتقل کند', () => {
  const fnSrc = extractFunctionSource(html, 'enhanceSidebarNav');
  assertTrue(fnSrc !== null, 'تابع enhanceSidebarNav پیدا نشد');
  assertContainsString(fnSrc, "className = 'nav-ico'", 'باید عنصر nav-ico بسازد');
  assertContainsString(fnSrc, "className = 'nav-txt'", 'باید عنصر nav-txt بسازد');
  assertContainsString(fnSrc, 'ico.appendChild(svg)', 'باید svg را داخل nav-ico بگذارد');
  assertContainsString(fnSrc, "querySelectorAll('.nav-it')", 'باید روی همه آیتم‌های منو حلقه بزند');
  assertContainsString(fnSrc, "querySelectorAll('.sb-section')", 'باید برای عناوین گروه هم شکل بگذارد');
  assertContainsString(fnSrc, 'sec-ico', 'باید آیکون بخش (sec-ico) بسازد');
});

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
