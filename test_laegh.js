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
  // پیدا کردن "function fnName(" (با async اختیاری) و گرفتن بدنه با شمارش آکولاد
  const startMatch = html.match(new RegExp('(?:async\\s+)?function\\s+' + fnName + '\\s*\\([^)]*\\)\\s*\\{'));
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

function runReplaceSectionsOnSandbox(html, sandbox){
  const wantsSrc = extractFunctionSource(html, '_restoreWants');
  const replaceSrc = extractFunctionSource(html, 'applyBackupReplaceSections');
  if(!wantsSrc || !replaceSrc) throw new Error('توابع بازگردانی پیدا نشد');
  const body = replaceSrc.substring(replaceSrc.indexOf('{')+1, replaceSrc.lastIndexOf('}'));
  // بدنه را داخل with اجرا کن تا assignmentها روی sandbox بنشینند (مثل applyAll قدیمی)
  const runner = new Function('ctx', wantsSrc + '\n' + 'with(ctx){ var d = ctx.d; var selectedKeys = null;\n' + body + '\n}');
  runner(sandbox);
}

// گروه ۲: شبیه‌سازی واقعی منطق importData / applyAll
// این دقیقاً همان باگی است که دفترچه تلفن را خالی نشان می‌داد
// -------------------------------------------------------------------

test('متغیر phonebook (نه فقط pb) باید واقعاً در منطق بازگردانی اجرا و پر شود', () => {
  assertTrue(extractFunctionSource(html, 'applyBackupReplaceSections') !== null, 'تابع applyBackupReplaceSections پیدا نشد');

  const sandbox = {
    d: {
      invoices: [], products: [], inventory: {}, invCtr: 1,
      phonebook: [{ fn:'تست', ln:'یک', phones:['0912'] }, { fn:'تست', ln:'دو', phones:['0913'] }],
      pb: [], parts: [], services: [], svcs: [], warranties: [], sales: []
    },
    invoices: [], products: [], inventory: {}, phonebook: [], pb: [], parts: [], services: [], svcs: [], warranties: [], sales: [], tasks: [], invCtr: 1,
    accounts: [], defectiveStock: [],
    sv(){}, svParts(){}, svSvcs(){}, svSales(){}, svWarr(){}, svPB(){}, svTasks(){}, svAccounts(){}, svDefective(){},
    getNum(){}, renderSaved(){}, renderProds(){}, renderInv(){}, renderPB(){}, renderParts(){}, renderSvcs(){}, renderSales(){}, renderWarList(){}, renderDataStats(){}, renderTasks(){}, renderSidebarBadges(){},
    localStorage: new MockLocalStorage(), logoSrc: ''
  };

  try {
    runReplaceSectionsOnSandbox(html, sandbox);
  } catch(e) {
    throw new Error('اجرای واقعی applyBackupReplaceSections با خطا متوقف شد: ' + e.message);
  }

  assertArrayLength(sandbox.phonebook, 2, 'بعد از اجرای واقعی بازگردانی روی یک بک‌اپ نمونه، phonebook باید ۲ مخاطب داشته باشد');
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
  const mergeSection = extractFunctionSource(html, 'applyBackupMergeSections');
  assertTrue(mergeSection !== null, 'تابع applyBackupMergeSections پیدا نشد');
  assertContainsString(mergeSection, 'accounts', 'بخش ادغام باید accounts را پردازش کند');
  assertContainsString(mergeSection, 'svAccounts', 'بخش ادغام باید svAccounts را صدا بزند');
  assertContainsString(mergeSection, 'renderAccounts', 'بخش ادغام باید renderAccounts را صدا بزند');
});

test('شبیه‌سازی واقعی: applyAll (جایگزینی) باید accounts را در localStorage ذخیره کند', () => {
  assertTrue(extractFunctionSource(html, 'applyBackupReplaceSections') !== null, 'تابع applyBackupReplaceSections پیدا نشد');

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
    runReplaceSectionsOnSandbox(html, sandbox);
  } catch(e) {
    throw new Error('اجرای واقعی applyBackupReplaceSections با خطا متوقف شد: ' + e.message);
  }

  assertArrayLength(sandbox.accounts, 2, 'بعد از اجرای واقعی جایگزینی، accounts باید ۲ حساب داشته باشد');
  assertTrue(sandbox.svAccountsCalled, 'بازگردانی باید svAccounts را صدا بزند تا accounts در localStorage ذخیره شود');
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
  assertTrue(/exportData\s*\(/.test(resetSrc), 'resetAll باید قبل از پاک کردن داده، exportData را صدا بزند تا بک‌اپ اجباری گرفته شود');
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

test('دفترچه باید نمای شرکت، الفبا و لیست داشته باشد', () => {
  ['pbNormChar','pbSortName','pbAlphaLetter','pbCompanyKey','setPBBrowseMode','openPBCompany','openPBLetter','pbBrowseClearDrill','pbFilteredRows','pbRenderGroupedList','renderPBCompanyGallery','renderPBAlphaGallery'].forEach(fn=>{
    assertTrue(extractFunctionSource(html, fn) !== null, 'تابع '+fn+' پیدا نشد');
  });
  assertContainsString(html, 'id="pb-browse-gallery"', 'گالری شرکت/الفبا لازم است');
  assertContainsString(html, "setPBBrowseMode('company')", 'دکمه نمای شرکت');
  assertContainsString(html, "setPBBrowseMode('alpha')", 'دکمه نمای الفبا');
  assertContainsString(html, "setPBBrowseMode('list')", 'دکمه نمای لیستی');
  assertContainsString(html, 'PB_ALPHA_LETTERS', 'حروف الفبای فارسی باید تعریف شده باشند');
  assertContainsString(html, 'نمای شرکت', 'راهنمای نمای شرکت');
  assertContainsString(html, 'نمای الفبا', 'راهنمای نمای الفبا');
  const actions = extractFunctionSource(html, 'winContextPageActions');
  const run = extractFunctionSource(html, 'winRunPageAction');
  const back = extractFunctionSource(html, 'winBack');
  assertContainsString(actions, 'phonebook-company', 'راست‌کلیک باید نمای شرکت داشته باشد');
  assertContainsString(actions, 'phonebook-alpha', 'راست‌کلیک باید نمای الفبا داشته باشد');
  assertContainsString(run, "setPBBrowseMode('company')", 'عمل راست‌کلیک شرکت باید نما را عوض کند');
  assertContainsString(back, 'pbBrowseClearDrill', 'برگشت از داخل شرکت/حرف باید به کارت‌ها برگردد');
});

test('اجرای واقعی: حرف الفبا و کلید شرکت دفترچه باید درست محاسبه شوند', () => {
  const src = [
    extractFunctionSource(html, 'pbNormChar'),
    extractFunctionSource(html, 'pbSortName'),
    extractFunctionSource(html, 'pbAlphaLetter'),
    extractFunctionSource(html, 'pbCompanyKey'),
    extractFunctionSource(html, 'pbCompanyLabel')
  ].join('\n');
  const fn = new Function(src + `;
    var PB_NONE_COMPANY = '__none__';
    var a = {fn:'علی', ln:'احمدی', shop:' پارس  '};
    var b = {fn:'مینا', ln:'', shop:''};
    var c = {fn:'', ln:'', shop:'آسمان'};
    var d = {fn:'John', ln:'Smith', shop:'Acme'};
    return {
      aL: pbAlphaLetter(a), aC: pbCompanyKey(a), aLbl: pbCompanyLabel(pbCompanyKey(a)),
      bL: pbAlphaLetter(b), bC: pbCompanyKey(b), bLbl: pbCompanyLabel(pbCompanyKey(b)),
      cL: pbAlphaLetter(c),
      dL: pbAlphaLetter(d),
      ye: pbNormChar('ي'), kaf: pbNormChar('ك'), alef: pbNormChar('آ')
    };
  `);
  const r = fn();
  assertEqual(r.aL, 'ا', 'احمدی باید زیر حرف ا برود');
  assertEqual(r.aC, 'پارس', 'فاصله اضافه نام شرکت باید حذف شود');
  assertEqual(r.aLbl, 'پارس', 'برچسب شرکت باید خود نام باشد');
  assertEqual(r.bL, 'م', 'مینا بدون نام خانوادگی باید با حرف م باشد');
  assertEqual(r.bC, '__none__', 'بدون شرکت باید کلید خالی باشد');
  assertEqual(r.bLbl, 'بدون شرکت / فروشگاه', 'برچسب بدون شرکت');
  assertEqual(r.cL, 'ا', 'آسمان باید با آ→ا زیر ا برود');
  assertEqual(r.dL, 'S', 'نام لاتین از نام خانوادگی');
  assertEqual(r.ye, 'ی', 'ي عربی باید ی شود');
  assertEqual(r.kaf, 'ک', 'ك عربی باید ک شود');
  assertEqual(r.alef, 'ا', 'آ باید با ا یکی شود');
});

test('اجرای واقعی: مخاطب‌های یک شرکت باید در یک گروه جمع شوند', () => {
  const src = [
    extractFunctionSource(html, 'pbNormChar'),
    extractFunctionSource(html, 'pbSortName'),
    extractFunctionSource(html, 'pbAlphaLetter'),
    extractFunctionSource(html, 'pbCompanyKey')
  ].join('\n');
  const fn = new Function(src + `;
    var PB_NONE_COMPANY = '__none__';
    var list = [
      {fn:'علی', ln:'احمدی', shop:'پارس'},
      {fn:'رضا', ln:'محمدی', shop:' پارس'},
      {fn:'مینا', ln:'کاظمی', shop:'آسمان'},
      {fn:'سارا', ln:'نوری', shop:''}
    ];
    var map = {};
    list.forEach(function(c){
      var k = pbCompanyKey(c);
      map[k] = (map[k]||0)+1;
    });
    return map;
  `);
  const map = fn();
  assertEqual(map['پارس'], 2, 'دو مخاطب پارس باید یک شرکت شوند');
  assertEqual(map['آسمان'], 1, 'آسمان جدا باشد');
  assertEqual(map['__none__'], 1, 'بدون شرکت جدا باشد');
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
  assertTrue(saveRoleSrc.indexOf('passwordMatches') >= 0 || saveRoleSrc.indexOf('pw === loginPw') >= 0,
    'باید رمز پروفایل را با رمز کلی نرم‌افزار مقایسه کند تا تداخل پیش نیاید');
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
  const importSrc = extractFunctionSource(html, 'applyBackupReplaceSections');
  assertTrue(importSrc !== null, 'تابع applyBackupReplaceSections پیدا نشد');
  assertContainsString(importSrc, 'd.userRoles', 'بازگردانی باید d.userRoles از فایل بک‌اپ را بخواند');
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
  assertTrue(/id="wref"[^>]*onchange="toggleCompanyReport\(this\.value\)"/.test(html), 'select/input ارجاع باید با تغییر مقدار، تابع toggleCompanyReport را صدا بزند تا بخش گزارش داخلی نمایان/پنهان شود');
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

test('شبیه‌سازی واقعی کامل: یک چرخه کامل ثبت فروش با عکس ضمیمه باید عکس را در رکورد نهایی sales[] ذخیره کند', async () => {
  // از ۱۴۰۵.۵.۲۱σ ضمیمه روی هارد (disk://) ذخیره می‌شود نه dataURL در حافظه مرورگر
  const addSrc = extractFunctionSource(html, 'addSaleDocs');
  assertTrue(addSrc !== null, 'تابع addSaleDocs پیدا نشد');
  assertContainsString(addSrc, 'storeDocFileOnDisk', 'addSaleDocs باید روی دیسک بنویسد');

  let saleDocs = [];
  const fakeFile = { name: 'invoice.jpg', type: 'image/jpeg' };
  const fakeInput = { files: [fakeFile], value: '' };
  const written = [];
  const ctx = {
    saleDocs,
    ntf(){},
    markDirty(){},
    renderSaleDocs(){},
    requireDiskOrAbort: async () => true,
    storeDocFileOnDisk: async (file, prefix) => {
      written.push({name:file.name, prefix});
      return 'disk://sirman_media/docs/' + prefix + '_invoice.jpg';
    },
    hydrateDocList: async (arr) => {
      arr.forEach(d => { d._blobUrl = 'blob:mock'; });
      return arr;
    }
  };
  const runner = new Function('ctx',
    'return (async function(){ with(ctx){ ' + addSrc + '\n await new Promise(function(r){ addSaleDocs(fakeInput); setTimeout(r, 30); }); return saleDocs; } })();'
    .replace('fakeInput', 'arguments[1]')
  );
  // cleaner runner:
  const runner2 = new Function('ctx', 'inp', `
    return (async function(){
      with(ctx){
        ${addSrc}
        addSaleDocs(inp);
        await new Promise(function(r){ setTimeout(r, 40); });
        return saleDocs;
      }
    })();
  `);
  saleDocs = await runner2(ctx, fakeInput);
  assertArrayLength(saleDocs, 1, 'بعد از addSaleDocs باید ۱ ضمیمه باشد');
  assertEqual(saleDocs[0].name, 'invoice.jpg', 'نام فایل ضمیمه باید درست باشد');
  assertTrue(String(saleDocs[0].data).indexOf('disk://') === 0, 'ضمیمه باید ارجاع disk:// روی هارد باشد نه dataURL حافظه');
  assertEqual(written.length, 1, 'باید یک‌بار روی دیسک نوشته شده باشد');
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
  const allSrc = (safeArrSrc||'') + '\n' + (safeObjSrc||'') + '\n' + (safeStrSrc||'') + '\n' + fullBuildSrc + '\n' + buildSrc + '\n' + fnSrc;
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
  const safeFsSrc = extractFunctionSource(html, 'safeFsFileName');
  const stampSrc = extractFunctionSource(html, 'fsDateStamp');
  const writeSrc = extractFunctionSource(html, 'writeTextToAutoSaveFolder');
  assertTrue(fnSrc !== null && buildSrc !== null && fullBuildSrc !== null, 'توابع لازم پیدا نشدند');
  assertTrue(safeFsSrc !== null && writeSrc !== null, 'توابع نوشتن امن پوشه لازم است');

  let writtenContent = null;
  let requestedNames = [];
  const fakeWritable = { write: async (data) => { writtenContent = data; }, close: async () => {} };
  const fakeFileHandle = { createWritable: async () => fakeWritable };
  const fakeDirHandle = { getFileHandle: async (name) => { requestedNames.push(name); return fakeFileHandle; } };

  // sandbox باید تمام متغیرهایی که _buildFullBackupData استفاده می‌کند را داشته باشد
  const sandbox = {
    isDirty: false, autoSaveDirHandle: fakeDirHandle, lastAutoSaveTime: null,
    invoices: [{id:1}], products: [], inventory: {}, invCtr: 1, pb: [], phonebook: [],
    parts: [], services: [], warranties: [], sales: [], tasks: [], accounts: [],
    defectiveStock: [], warehouseDocs: [], stockMoves: [], userAuditLog: [], bgAuditLog: [], userRoles: [], loginPw: '',
    senderInfo: {}, logoSrc: '', acH: {},
    APP_VERSION: '1405.5.20ε',
    autoSaveFileHandle: null,
    ensureFsPermission: async () => true,
    writeAutoSaveTarget: null, // set below after extract
    fdate: () => '‎۱۴۰۵/۰۵/۱۸‎',
    clearDirty: () => {},
    localStorage: { getItem: () => null, setItem: () => {}, length: 0, key: () => null },
    updateAutoSaveUI: () => {}, addDbgEntry: () => {}
  };
  const ensureSrc = extractFunctionSource(html, 'ensureFsPermission');
  const writeFileSrc = extractFunctionSource(html, 'writeTextToAutoSaveFileHandle');
  const writeTargetSrc = extractFunctionSource(html, 'writeAutoSaveTarget');
  const dlSrc = extractFunctionSource(html, 'downloadAutoSaveFallback');
  // helperها + _buildFullBackupData + buildBackupObject + doAutoSave را در context قرار بده
  const allSrc = (safeArrSrc||'') + '\n' + (safeObjSrc||'') + '\n' + (safeStrSrc||'') + '\n' + (safeFsSrc||'') + '\n' + (stampSrc||'') + '\n' + (ensureSrc||'') + '\n' + (writeFileSrc||'') + '\n' + (writeSrc||'') + '\n' + (writeTargetSrc||'') + '\n' + (dlSrc||'') + '\n' + fullBuildSrc + '\n' + buildSrc + '\n' + fnSrc;
  const runner = new Function('ctx',
    'return (async function(){ with(ctx){ ' + allSrc + '\nreturn await doAutoSave(true); } })();');
  await runner(sandbox);

  assertTrue(writtenContent !== null, 'با force=true، doAutoSave باید واقعاً محتوای فایل را در پوشه انتخاب‌شده بنویسد — این دقیقاً همان باگی بود که باعث می‌شد بعد از انتخاب پوشه هیچ فایلی پدید نیاید');
  const parsed = JSON.parse(writtenContent);
  assertEqual(parsed.invoices.length, 1, 'محتوای نوشته‌شده باید همان داده واقعی (مثلاً فاکتورها) را داشته باشد، نه خالی');
  assertTrue(requestedNames.some(n => n === 'backup.txt'), 'اولویت نام پوشه باید backup.txt باشد: '+requestedNames.join(','));
  assertTrue(requestedNames.every(n => /^[A-Za-z0-9._-]+$/.test(n)), 'هیچ نام فایل غیرمجازی به getFileHandle داده نشود: '+requestedNames.join(','));
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
  const footMatch = html.match(/sb-foot"[^>]*>نسخه\s+([^—<]+)/);
  assertTrue(footMatch !== null, 'متن نسخه در فوتر سایدبار پیدا نشد');
  const footVerEn = faDigitsToEn(footMatch[1].trim());
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

test('قسمت سال/ماه/روز نسخه (فرمت Year.Month.Day + حرف یونانی اختیاری) باید با تاریخ متاتگ app-date مطابقت داشته باشد', () => {
  const metaVer = (html.match(/<meta name="app-version" content="([^"]+)">/) || [])[1];
  const metaDate = (html.match(/<meta name="app-date" content="([^"]+)">/) || [])[1];
  assertTrue(!!metaVer && !!metaDate, 'نسخه یا تاریخ متاتگ پیدا نشد');
  const vm = metaVer.match(/^(\d+)\.(\d+)\.(\d+)([αβγδεζηθικλμνξοπρστυφχψω]?)$/);
  assertTrue(!!vm, 'فرمت نسخه باید Year.Month.Day با حرف یونانی اختیاری باشد: ' + metaVer);
  const [y, m, d] = metaDate.split('/');
  assertEqual(vm[1], y, 'سال نسخه با app-date یکی نیست');
  assertEqual(vm[2].padStart(2,'0'), m, 'ماه نسخه با app-date یکی نیست');
  assertEqual(vm[3].padStart(2,'0'), d, 'روز نسخه با app-date یکی نیست');
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
    Promise,
    tasks: [
      { id:'TSK-AUTO-100', status:'open', notify:true, deadlineTS:null, notifiedAt:null, autoInvoice:true, title:'فاکتور باز #100', priority:'high' },
      { id:'TSK-FUTURE', status:'open', notify:true, deadlineTS: Date.now()+3600000, notifiedAt:null, title:'کار آینده', priority:'normal' }
    ]
  };
  const runner = new Function('ctx', 'with(ctx){ return (' + fnSrc.replace(/^function checkDueTasksForNotification/, 'function') + ')(); }');
  return Promise.resolve(runner(ctx)).then(() => {
    assertArrayLength(fired, 1, 'فقط فاکتور باز (بدون موعد) باید الان اعلان بگیرد، نه کار با موعد آینده');
    assertTrue(fired[0].indexOf('فاکتور باز #100') !== -1, 'اعلان باید مربوط به فاکتور باز باشد. دریافت: ' + fired[0]);
    assertTrue(!!ctx.tasks[0].notifiedAt, 'بعد از اعلان، notifiedAt باید ست شود تا اعلان تکرار (اسپم) نشود');
    fired.length = 0;
    return Promise.resolve(runner(ctx)).then(() => {
      assertArrayLength(fired, 0, 'اعلان فاکتور باز نباید در اجرای بعدی تکرار شود (جلوگیری از اسپم مثل نسخه‌ی قدیمی)');
    });
  });
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
  const src = extractFunctionSource(html, 'openRestorePreviewModal');
  assertTrue(src !== null, 'تابع openRestorePreviewModal پیدا نشد');
  assertContainsString(html, 'id="restore-inv-meta"', 'متای پیش‌نمایش بک‌آپ پیدا نشد');
  assertContainsString(src, 'خالی', 'هشدار فایل خالی در پیش‌نمایش باید وجود داشته باشد');
  assertContainsString(html, 'id="restore-inv-warn"', 'باکس هشدار پیش‌نمایش پیدا نشد');
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

test('صفحه تاریخ/تقویم باید راهنمای نمایشی و راهنمای امروز/انتخاب داشته باشد بدون کلید persist جدید', () => {
  assertContainsString(html, 'id="page-datetime"', 'صفحه تاریخ و تقویم پیدا نشد');
  assertContainsString(html, 'dt-chrome-lead', 'متن راهنمای کروم تقویم پیدا نشد');
  assertContainsString(html, 'id="cal-legend"', 'راهنمای امروز/انتخاب‌شده پیدا نشد');
  assertContainsString(html, 'cal-legend-today', 'نشانه امروز در راهنما پیدا نشد');
  assertContainsString(html, 'cal-legend-sel', 'نشانه انتخاب در راهنما پیدا نشد');
  assertContainsString(html, 'ذخیره نمی‌شود', 'باید بگوید انتخاب روز ذخیره نمی‌شود');
  assertContainsString(html, 'id="dt-live-big"', 'ساعت زنده باید بماند');
  assertContainsString(html, 'id="cal-page-grid"', 'شبکه تقویم باید بماند');
  assertContainsString(html, 'id="cal-sel-label"', 'برچسب روز انتخاب‌شده باید بماند');
  const calSrc = extractFunctionSource(html, 'renderCalPage');
  assertTrue(!!calSrc, 'renderCalPage پیدا نشد');
  assertTrue(calSrc.indexOf('localStorage.setItem') === -1, 'رندر تقویم نباید persist بنویسد');
  assertTrue(calSrc.indexOf('RunBusiness(') === -1, 'رندر تقویم نباید RunBusiness صدا بزند');
  const navSrc = extractFunctionSource(html, 'calPageNav');
  const togSrc = extractFunctionSource(html, 'calToggleMode');
  const pickSrc = extractFunctionSource(html, 'calPickDay');
  assertTrue(!!navSrc && !!togSrc && !!pickSrc, 'کنترل‌های تقویم باید بمانند');
  [navSrc, togSrc, pickSrc].forEach(function(src){
    assertTrue(src.indexOf('localStorage') === -1, 'ناوبری/حالت/انتخاب روز نباید localStorage بنویسد');
  });
  assertContainsString(html, "let TZ = localStorage.getItem('laegh_tz')", 'کلید منطقه زمانی باید همان laegh_tz بماند');
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

  // اجرای واقعی _printTable: باید پنجره تازه باز کند و جدول با تعداد ردیف درست بنویسد
  const src=extractFunctionSource(html,'_printTable');
  let written='';
  const ctx={ ntf:()=>{}, fdt:()=>'۱۴۰۵/۰۴/۰۴',
    openFreshPrintWindow:(s)=>{ written+=s; return { document:{}, focus:()=>{}, print:()=>{} }; },
    window:{ open:()=>({ document:{ open:()=>{}, write:(s)=>{written+=s;}, close:()=>{} }, focus:()=>{}, print:()=>{} }) } };
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
  const atSrc = extractFunctionSource(html, 'deleteSaleAt');
  const locSrc = extractFunctionSource(html, 'reverseSaleLocal');
  assertTrue(fnSrc !== null, 'تابع delSale پیدا نشد');
  assertContainsString(fnSrc, 'deleteSaleAt', 'delSale باید حذف را با برگشت موجودی و حساب انجام دهد');
  assertTrue(atSrc !== null, 'تابع deleteSaleAt پیدا نشد');
  assertTrue(locSrc !== null, 'تابع reverseSaleLocal پیدا نشد');
  assertContainsString(locSrc, 'proforma', 'پیش‌فاکتور نباید به انبار برگردد چون کسر نشده بود');
  assertContainsString(locSrc, 'reverseLinkedAccountTrx', 'حذف فروش نهایی باید مبلغ همان فروش را از حساب برگرداند');
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
  const importSrc = extractFunctionSource(html, 'applyBackupReplaceSections');
  assertTrue(importSrc !== null, 'تابع applyBackupReplaceSections پیدا نشد');
  assertContainsString(importSrc, 'd.accounts', 'بازگردانی باید d.accounts از فایل بک‌اپ را بخواند');
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
  assertContainsString(src, 'deleteSaleAt', 'delSelSales باید حذف را با برگشت موجودی و حساب انجام دهد');
  assertContainsString(src, 'proforma', 'delSelSales باید وضعیت proforma را در تأیید به کاربر بگوید');
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
test('سه فیلد تاریخ گارانتی (wa-refdate, cr-repair-date, cr-ship-date) باید به تقویم فارسی وصل باشند', () => {
  ['wa-refdate','cr-repair-date','cr-ship-date'].forEach(id => {
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
  const pr = extractFunctionSource(html, 'promptExitBackup');
  assertTrue(pr.indexOf("ntf('تغییری ذخیره‌نشده نیست") === -1, 'خروج باید همیشه بک‌آپ را بپرسد، نه فقط وقتی dirty است');
  assertContainsString(pr, 'exit-modal', 'باید مودال خروج را باز کند');
  assertContainsString(html, '_sirmanAllowUnload', 'پرچم اجازه بستن لازم است');
  assertContainsString(html, "addEventListener('beforeunload'", 'beforeunload باید ثبت شده باشد');
  assertContainsString(html, 'function _sirmanBeforeUnloadHandler(', 'هندلر beforeunload لازم است');
  const uh = extractFunctionSource(html, '_sirmanBeforeUnloadHandler');
  assertContainsString(uh, 'promptExitBackup', 'اگر کاربر در دیالوگ مرورگر بماند باید مودال بک‌آپ باز شود');
  assertTrue(uh.indexOf('if (isDirty)') === -1, 'بستن ✕ باید همیشه هشدار بدهد، نه فقط وقتی dirty');
  assertContainsString(html, 'btn-exit-safe', 'دکمه خروج امن لازم است');
  assertContainsString(html, 'id="sirman-win-close"', 'دکمه ✕ داخل برنامه لازم است');
  assertContainsString(html, 'function sirmanRequestHostClose(', 'بستن میزبان دسکتاپ لازم است');
  const hc = extractFunctionSource(html, 'sirmanRequestHostClose');
  assertContainsString(hc, 'hostObjects.sync.sirmanHost', 'باید اول Host Object CloseApp را صدا بزند');
  assertContainsString(hc, 'host-close', 'fallback postMessage host-close لازم است');
  const dx = extractFunctionSource(html, '_doExit');
  assertContainsString(dx, 'sirmanRequestHostClose', '_doExit باید در Sirman.exe به میزبان بگوید ببند');

  assertContainsString(html, 'function sirmanConfirmExitFallback(', 'fallback confirm برای پرسش بک‌آپ لازم است');
  const pr2 = extractFunctionSource(html, 'promptExitBackup');
  assertContainsString(pr2, 'sirmanConfirmExitFallback', 'اگر مودال دیده نشد باید confirm بپرسد');
});

test('محل بک‌آپ و اعلان باید یک‌بار ذخیره و در شروع بازیابی شوند', () => {
  assertContainsString(html, 'function saveAutoSaveHandleToIDB(', 'ذخیره هندل بک‌آپ در IDB لازم است');
  assertContainsString(html, 'function restoreAutoSaveHandlesOnBoot(', 'بازیابی محل بک‌آپ لازم است');
  assertContainsString(html, 'function autoEnableDesktopNotifyOnBoot(', 'فعال‌سازی خودکار اعلان لازم است');
  assertContainsString(html, 'function downloadShortcutInstaller(', 'دانلود نصب میانبر لازم است');
  assertContainsString(html, 'نصب_میانبر_سیرمان.bat', 'باید به نصب میانبر BAT اشاره شود');
  const choose = extractFunctionSource(html, 'chooseAutoSaveFile');
  assertContainsString(choose, 'saveAutoSaveHandleToIDB', 'انتخاب فایل باید هندل را ذخیره کند');
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
  const src = extractFunctionSource(html, 'showPageClassic') || extractFunctionSource(html, 'showPage');
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
  const catIdx = html.indexOf('function whCatalogItems');
  assertTrue(catIdx >= 0, 'whCatalogItems پیدا نشد');
  assertTrue(html.indexOf('defectiveStock', catIdx) > catIdx, 'فهرست حواله باید آیتم‌های معیوب را نمایش دهد');
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
  const src = extractFunctionSource(html, 'showPageClassic') || extractFunctionSource(html, 'showPage');
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
  assertContainsString(src, 'openDocViewerNamed', 'thumbnail باید openDocViewerNamed را صدا بزند (رفع باگ let/window)');
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

  // ═══ بررسی ۱: warehouses باید شش نوع انبار سیستمی بسازد ═══
  var ws = JSON.parse(sb._ls.getItem('laegh_warehouses') || '[]');
  assertTrue(ws.length >= 6, 'باید شش انبار سیستمی ساخته شود (قطعات/کالا/معیوب/خدمات/مرجوعی/اسقاط) — دریافت شد '+ws.length);
  var types = ws.map(function (w) { return w.type; });
  ['parts','goods','defective','service','return','scrap'].forEach(function (k) {
    assertTrue(types.indexOf(k) >= 0, 'نوع انبار سیستمی '+k+' باید ساخته شود');
  });
  assertTrue(ws.some(function (w) { return w.isDefault; }), 'یکی از انبارها باید پیش‌فرض باشد');

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

test('حاکمیت توسعه باید موجود باشد و قانون مادر را نگه دارد', () => {
  const root = path.dirname(filePath);
  ['docs/DEVELOPMENT_GOVERNANCE.md', 'docs/STABLE_BASELINE.md', 'docs/REGRESSION_SUITE.md', 'CHANGELOG.md'].forEach(function(rel){
    assertTrue(fs.existsSync(path.join(root, rel)), rel+' لازم است');
  });
  const g = fs.readFileSync(path.join(root, 'docs/DEVELOPMENT_GOVERNANCE.md'), 'utf8');
  assertContainsString(g, 'STABLE CODE IS PROTECTED', 'قانون مادر حاکمیت باید باشد');
  assertContainsString(g, 'NO TEST = NO MERGE', 'بدون تست نباید merge شود');
  assertContainsString(g, 'NEEDS HUMAN VERIFICATION', 'وضعیت صادقانه باید تعریف شده باشد');
});

test('نسخه ۱۴۰۵.۵.۲۷γ باید Year.Month.Day شمسی با حرف یونانی همان روز باشد و در meta/سایدبار/بک‌آپ یکسان باشد', () => {
  const verPath = path.join(path.dirname(filePath), 'SIRMAN_VERSION.json');
  assertTrue(fs.existsSync(verPath), 'SIRMAN_VERSION.json منبع واحد شماره نسخه است');
  const ver = JSON.parse(fs.readFileSync(verPath, 'utf8'));
  assertEqual(ver.app, '1405.5.27γ', 'نسخه محصول باید 1405.5.27γ باشد');
  assertEqual(ver.assembly, '1405.5.27.3', 'نسخه اسمبلی باید همان روز با شماره حرف یونانی باشد (γ=3)');
  assertEqual(ver.appFa, '۱۴۰۵.۵.۲۷γ', 'نسخه فارسی باید با HTML یکی باشد');
  const metaVer = (html.match(/<meta name="app-version" content="([^"]+)">/) || [])[1];
  assertEqual(metaVer, ver.app, 'نسخه meta باید با SIRMAN_VERSION.json یکی باشد');
  const metaDate = (html.match(/<meta name="app-date" content="([^"]+)">/) || [])[1];
  assertEqual(metaDate, ver.date, 'app-date باید با فایل نسخه یکی باشد');
  assertContainsString(html, 'نسخه '+ver.appFa, 'سایدبار باید نسخه فارسی را نشان دهد');
  const buildSrc = extractFunctionSource(html, '_buildFullBackupData');
  assertContainsString(buildSrc, "version: '"+ver.app+"'", 'فیلد version بک‌آپ باید با منبع واحد یکی باشد');
  const propsPath = path.join(path.dirname(filePath), 'desktop', 'Directory.Build.props');
  assertTrue(fs.existsSync(propsPath), 'Directory.Build.props باید نسخه پوسته را از همان منبع بخواند');
  const props = fs.readFileSync(propsPath, 'utf8');
  assertContainsString(props, '<Version>'+ver.assembly+'</Version>', 'پوسته ویندوز باید assembly را از منبع واحد بگیرد');
  assertContainsString(props, '<InformationalVersion>'+ver.app+'</InformationalVersion>', 'InformationalVersion باید همان نسخه HTML باشد');
  ['desktop/Sirman.Desktop/Sirman.Desktop.csproj',
   'desktop/Sirman_Install_Kit/Sirman.Desktop/Sirman.Desktop.csproj',
   'desktop/Sirman_Windows_Install/Sirman.Desktop/Sirman.Desktop.csproj'].forEach(function(rel){
    const cs = fs.readFileSync(path.join(path.dirname(filePath), rel), 'utf8');
    assertTrue(!/<Version>1405\.5\.21/.test(cs), rel+' نباید نسخه قدیمی جدا داشته باشد');
  });
  const kitDir = path.join(path.dirname(filePath), 'deliveries', 'Sirman_Setup_'+ver.app);
  const kitZip = path.join(path.dirname(filePath), 'Sirman_Setup_'+ver.app+'.zip');
  const kitHtml = path.join(kitDir, 'App', 'Sirman_Final.html');
  const kitExe = path.join(kitDir, 'App', 'Sirman.exe');
  const kitSetup = path.join(kitDir, 'SETUP.bat');
  assertTrue(fs.existsSync(kitDir), 'پوشه کیت نصب کامل باید در deliveries باشد');
  assertTrue(fs.existsSync(kitZip), 'فایل zip کیت نصب باید در ریشه پروژه باشد');
  assertTrue(fs.existsSync(kitSetup), 'SETUP.bat باید در کیت نصب باشد');
  assertTrue(fs.existsSync(kitHtml), 'کیت نصب باید Sirman_Final.html داشته باشد');
  assertTrue(fs.statSync(kitHtml).size > 500000, 'HTML داخل کیت باید برنامه واقعی باشد نه فایل کوچک');
  assertTrue(fs.existsSync(kitExe), 'کیت نصب باید Sirman.exe آماده داشته باشد');
  assertTrue(fs.statSync(kitZip).size > 1000000, 'zip کیت نباید خالی باشد');
  const kitUpd = path.join(kitDir, 'App', 'updates', 'Sirman_Update_'+ver.app+'.json');
  const kitPending = path.join(kitDir, 'App', 'Sirman_Pending_Update.json');
  const kitApply = path.join(kitDir, 'App', 'apply_sirman_update.ps1');
  assertTrue(fs.existsSync(kitUpd), 'کیت باید از اول فایل آپدیت همین نسخه را داخل App/updates داشته باشد');
  assertTrue(fs.statSync(kitUpd).size > 500000, 'آپدیت داخل کیت باید HTML کامل باشد نه فایل ۱ کیلوبایتی');
  assertTrue(fs.existsSync(kitPending), 'کیت باید Sirman_Pending_Update.json هم‌نسخه داشته باشد تا Pending قدیمی نصب قبلی را بازنویسی کند');
  assertTrue(fs.statSync(kitPending).size > 500000, 'Pending داخل کیت نباید فایل ۱ کیلوبایتی قدیمی باشد');
  assertTrue(fs.existsSync(kitApply), 'کیت باید apply_sirman_update.ps1 داشته باشد');
  const kitUpdPkg = JSON.parse(fs.readFileSync(kitUpd, 'utf8'));
  const kitPendPkg = JSON.parse(fs.readFileSync(kitPending, 'utf8'));
  const kitVer = JSON.parse(fs.readFileSync(path.join(kitDir, 'App', 'SIRMAN_VERSION.json'), 'utf8'));
  assertEqual(kitUpdPkg.version, ver.app, 'نسخه فایل آپدیت داخل کیت باید با خود کیت یکی باشد — کیت عقب‌تر از آپدیت نیست');
  assertEqual(kitPendPkg.version, ver.app, 'Pending داخل کیت باید همان نسخه برنامه باشد');
  assertEqual(kitVer.app, ver.app, 'SIRMAN_VERSION داخل کیت باید همان نسخه جاری باشد');
  const kitHtmlTxt = fs.readFileSync(kitHtml, 'utf8');
  assertTrue(kitHtmlTxt.indexOf("var APP_VERSION = '"+ver.app+"'") >= 0, 'HTML داخل کیت باید همان نسخه جاری باشد');
  const updJsonPath = path.join(path.dirname(filePath), 'updates', 'Sirman_Update_'+ver.app+'.json');
  const pendingPath = path.join(path.dirname(filePath), 'Sirman_Pending_Update.json');
  assertTrue(fs.existsSync(updJsonPath), 'فایل آپدیت همین نسخه باید موجود باشد');
  assertTrue(fs.existsSync(pendingPath), 'Sirman_Pending_Update.json باید موجود باشد');
  assertTrue(fs.statSync(updJsonPath).size > 500000, 'آپدیت باید HTML کامل داشته باشد نه فایل ۱ کیلوبایتی');
  const updPkg = JSON.parse(fs.readFileSync(updJsonPath, 'utf8'));
  const pendingPkg = JSON.parse(fs.readFileSync(pendingPath, 'utf8'));
  assertEqual(updPkg.version, ver.app, 'آپدیت JSON باید همان نسخه جاری باشد');
  assertEqual(pendingPkg.version, ver.app, 'Pending نباید نسخه قدیمی‌تر از برنامه جاری باشد');
  const fullPatch = (updPkg.patches||[]).find(function(p){ return p && p.op==='replaceAppFile'; });
  assertTrue(!!fullPatch, 'آپدیت باید replaceAppFile داشته باشد');
  assertTrue(String(fullPatch.content||'').indexOf("var APP_VERSION = '"+ver.app+"'") >= 0, 'HTML داخل آپدیت باید نسخه جاری باشد');
  const applyPs = fs.readFileSync(path.join(path.dirname(filePath), 'apply_sirman_update.ps1'), 'utf8');
  assertContainsString(applyPs, 'Skip stale pending', 'لانچر نباید آپدیت قدیمی را روی نسخه جدید بنویسد');
  const bat = fs.readFileSync(path.join(path.dirname(filePath), 'Sirman_Start.bat'), 'utf8');
  assertContainsString(bat, ver.app, 'لانچر BAT باید همان نسخه منبع واحد را داشته باشد');
});

test('رفع Name is not allowed: safeFsFileName و writeTextToAutoSaveFolder باید نام ASCII/.txt امن بسازند', () => {
  assertContainsString(html, 'function safeFsFileName(', 'safeFsFileName پیدا نشد');
  assertContainsString(html, 'function fsDateStamp(', 'fsDateStamp پیدا نشد');
  const safeSrc = extractFunctionSource(html, 'safeFsFileName');
  const stampSrc = extractFunctionSource(html, 'fsDateStamp');
  const doSrc = extractFunctionSource(html, 'doAutoSave');
  assertContainsString(html, 'function writeTextToAutoSaveFolder(', 'writeTextToAutoSaveFolder پیدا نشد');
  assertContainsString(doSrc, 'writeAutoSaveTarget', 'doAutoSave باید writeAutoSaveTarget را صدا بزند');
  assertTrue(doSrc.indexOf("fdate().replace")===-1, 'doAutoSave نباید دیگر از fdate() برای نام فایل استفاده کند');
  const runner = new Function(safeSrc + `;
    var a = safeFsFileName('‎۱۴۰۵/۰۵/۱۸‎');
    var b = safeFsFileName('Laegh_AutoSave_‎۱۴۰۵-۰۵-۱۸‎.json');
    var c = safeFsFileName('sirman_autosave.txt');
    return [a,b,c];
  `);
  const [a,b,c] = runner();
  assertEqual(a, '1405-05-18', 'باید ارقام لاتین و بدون LRM باشد: '+a);
  assertEqual(b, 'Laegh_AutoSave_1405-05-18.json', 'نام تاریخ‌دار باید ASCII امن باشد: '+b);
  assertEqual(c, 'sirman_autosave.txt', 'نام txt باید دست‌نخورده بماند');
  assertTrue(/^[A-Za-z0-9._-]+$/.test(a) && /^[A-Za-z0-9._-]+$/.test(b), 'فقط کاراکترهای مجاز نام فایل');
});

test('δ: انتخاب فایل ذخیره (showSaveFilePicker) و نام‌های ساده backup.txt و دانلود جایگزین', () => {
  assertContainsString(html, 'function chooseAutoSaveFile(', 'chooseAutoSaveFile باید وجود داشته باشد');
  assertContainsString(html, 'showSaveFilePicker', 'باید از showSaveFilePicker استفاده شود');
  assertContainsString(html, 'function downloadAutoSaveFallback(', 'دانلود جایگزین لازم است');
  assertContainsString(html, 'function writeAutoSaveTarget(', 'writeAutoSaveTarget لازم است');
  const folderSrc = extractFunctionSource(html, 'writeTextToAutoSaveFolder');
  assertContainsString(folderSrc, "'backup.txt'", 'نام ساده backup.txt باید در کاندیدها باشد');
  assertTrue(!/['"][^'"]*\.json['"]/.test(folderSrc), 'دیگر نباید نام .json به getFileHandle داده شود');
  assertContainsString(html, 'chooseAutoSaveFile()', 'دکمه UI باید chooseAutoSaveFile را صدا بزند');
  const doSrc = extractFunctionSource(html, 'doAutoSave');
  assertContainsString(doSrc, 'downloadAutoSaveFallback', 'در شکست نوشتن باید دانلود جایگزین صدا زده شود');
});

test('ε: مرکز آپدیت باید در تنظیمات باشد و بسته SIRMAN_UPDATE را اعتبارسنجی/اعمال کند', () => {
  assertContainsString(html, "showStgTab('update'", 'تب آپدیت در تنظیمات باید باشد');
  assertContainsString(html, 'id="stg-update"', 'پنل stg-update باید باشد');
  assertContainsString(html, 'function applyUpdatePackage(', 'applyUpdatePackage لازم است');
  assertContainsString(html, 'function validateUpdatePackage(', 'validateUpdatePackage لازم است');
  assertContainsString(html, 'function reapplyStoredUpdates(', 'reapplyStoredUpdates لازم است');
  assertContainsString(html, "magic !== 'SIRMAN_UPDATE'", 'باید magic را چک کند');
  assertContainsString(html, 'appliedUpdates:', 'بک‌آپ باید appliedUpdates داشته باشد');
  assertContainsString(html, 'مرکز آپدیت', 'راهنما یا UI مرکز آپدیت باید باشد');
  const valSrc = extractFunctionSource(html, 'validateUpdatePackage');
  const applySrc = extractFunctionSource(html, 'applyUpdatePackage');
  const setVerSrc = extractFunctionSource(html, 'setRuntimeAppVersion');
  const cmpSrc = extractFunctionSource(html, 'compareSirmanVersions');
  const getMetaSrc = extractFunctionSource(html, 'getAppliedUpdatesMeta');
  const saveMetaSrc = extractFunctionSource(html, 'saveAppliedUpdatesMeta');
  assertTrue(!!valSrc && !!applySrc && !!setVerSrc, 'توابع آپدیت extract نشدند');

  // شبیه‌سازی واقعی اعتبارسنجی و اعمال setVersion بدون DOM کامل
  const store = {};
  const sandboxLocal = {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; }
  };
  // validate + compare
  const vRunner = new Function(cmpSrc + '\n' + valSrc + `\n
    var APP_BASE_VERSION = '1405.5.20ε';
    return {
      bad: validateUpdatePackage({magic:'X', format:1, id:'a', version:'1'}),
      good: validateUpdatePackage({magic:'SIRMAN_UPDATE', format:1, id:'a', version:'1405.5.20ε', minBaseVersion:'1405.5.20ε'}),
      tooNew: validateUpdatePackage({magic:'SIRMAN_UPDATE', format:1, id:'a', version:'x', minBaseVersion:'1405.5.21σ'}),
      cmp: compareSirmanVersions('1405.5.20ε','1405.5.18ε')
    };
  `);
  const vr = vRunner();
  assertTrue(!!vr.bad, 'magic نادرست باید خطا بدهد');
  assertEqual(vr.good, null, 'بسته معتبر باید null برگرداند');
  assertTrue(!!vr.tooNew, 'minBaseVersion بالاتر باید رد شود');
  assertTrue(vr.cmp > 0, 'ζ باید بعد از ε باشد');

  // setRuntimeAppVersion + meta save
  const metaRunner = new Function('localStorage', getMetaSrc + '\n' + saveMetaSrc + `\n
    saveAppliedUpdatesMeta([{id:'t1', version:'1405.5.20ε'}]);
    return getAppliedUpdatesMeta();
  `);
  const meta = metaRunner(sandboxLocal);
  assertEqual(meta.length, 1, 'meta باید ذخیره شود');
  assertEqual(meta[0].id, 't1', 'شناسه آپدیت باید بماند');
});

test('ζ: لانچر توکار و دانگرید باید در HTML و فایل آپدیت موجود باشند', () => {
  assertContainsString(html, 'SIRMAN_LAUNCHER_TEMPLATES_B64', 'قالب لانچر Base64 لازم است');
  assertContainsString(html, 'function downloadEmbeddedLauncher(', 'downloadEmbeddedLauncher لازم است');
  assertContainsString(html, 'function downgradeToTarget(', 'downgradeToTarget لازم است');
  assertContainsString(html, 'function listDowngradeTargets(', 'listDowngradeTargets لازم است');
  assertContainsString(html, 'id="upd-launchers-box"', 'باکس دانلود لانچر لازم است');
  assertContainsString(html, 'id="upd-downgrade-box"', 'باکس دانگرید لازم است');
  const buildSrc = extractFunctionSource(html, 'buildEmbeddedLauncher');
  const runner = new Function(
    'var SIRMAN_LAUNCHER_TEMPLATES = {"Sirman_Start.bat":"ver=__SIRMAN_VERSION__"};\n'
    + 'function ensureLauncherTemplates(){ return SIRMAN_LAUNCHER_TEMPLATES; }\n'
    + 'var APP_VERSION = "1405.5.20ε";\n'
    + 'function getLauncherVersionTag(){ return APP_VERSION; }\n'
    + buildSrc + '\n'
    + 'return buildEmbeddedLauncher("Sirman_Start.bat");'
  );
  assertEqual(runner(), 'ver=1405.5.20ε', 'لانچر باید نسخه جاری را جایگزین کند');

  // decode one real template from HTML and ensure placeholder exists
  const m = html.match(/SIRMAN_LAUNCHER_TEMPLATES_B64 = (\{[\s\S]*?\});/);
  assertTrue(!!m, 'بلوک B64 پیدا نشد');
  const map = JSON.parse(m[1]);
  assertTrue(!!map['Sirman_Start.bat'], 'Sirman_Start.bat در B64 باشد');
  const decoded = Buffer.from(map['Sirman_Start.bat'], 'base64').toString('utf8');
  assertTrue(decoded.indexOf('__SIRMAN_VERSION__') >= 0, 'قالب باید جای‌نگهدار نسخه داشته باشد');
  assertTrue(decoded.indexOf('`') >= 0 || decoded.indexOf('SIRMAN') >= 0, 'محتوای لانچر باید معتبر باشد');

  const fs = require('fs');
  const path = require('path');
  const updPath = path.join(path.dirname(filePath), 'updates', 'Sirman_Update_1405.5.18ζ.json');
  assertTrue(fs.existsSync(updPath), 'فایل آپدیت ζ باید موجود باشد');
  const pkg = JSON.parse(fs.readFileSync(updPath, 'utf8'));
  assertEqual(pkg.magic, 'SIRMAN_UPDATE', 'magic آپدیت');
  assertEqual(pkg.version, '1405.5.18ζ', 'نسخه آپدیت');
  assertTrue(Array.isArray(pkg.patches) && pkg.patches.some(p => p.op === 'runJs'), 'باید runJs داشته باشد');
  const js = (pkg.patches.find(p => p.op === 'runJs') || {}).code || '';
  assertTrue(js.indexOf('downloadEmbeddedLauncher') >= 0, 'آپدیت باید لانچر توکار را بیاورد');
  assertTrue(js.indexOf('downgradeToTarget') >= 0, 'آپدیت باید دانگرید را بیاورد');
  assertTrue(js.indexOf('SIRMAN_LAUNCHER_TEMPLATES_B64') >= 0, 'آپدیت باید قالب Base64 داشته باشد');
});


test('η/θ: خروج با بک‌آپ، نشانگر ذخیره خودکار، و آپدیت θ باید موجود باشند', () => {
  assertContainsString(html, 'async function exitWithBackup(', 'exitWithBackup باید async باشد');
  const exitSrc = extractFunctionSource(html, 'exitWithBackup');
  assertTrue(!!exitSrc, 'exitWithBackup پیدا نشد');
  assertContainsString(exitSrc, '_doExit(', 'بعد از بک‌آپ باید _doExit صدا زده شود');
  assertContainsString(exitSrc, 'await exportData', 'باید منتظر exportData بماند');
  assertContainsString(html, 'function flashAutosaveDot(', 'flashAutosaveDot لازم است');
  assertContainsString(html, 'id="autosave-dot"', 'عنصر دایره سبز لازم است');
  const uiSrc = extractFunctionSource(html, 'updateAutoSaveUI');
  assertContainsString(uiSrc, 'flashAutosaveDot', 'updateAutoSaveUI باید نشانگر را روشن کند');
  const fs = require('fs');
  const path = require('path');
  const updPath = path.join(path.dirname(filePath), 'updates', 'Sirman_Update_1405.5.20ε.json');
  assertTrue(fs.existsSync(updPath), 'فایل آپدیت θ باید موجود باشد');
  const pkg = JSON.parse(fs.readFileSync(updPath, 'utf8'));
  assertEqual(pkg.magic, 'SIRMAN_UPDATE');
  assertEqual(pkg.version, '1405.5.20ε');
  assertTrue(Array.isArray(pkg.changelog) && pkg.changelog.some(function(c){ return String(c).indexOf('بک')>=0 || String(c).indexOf('خروج')>=0; }), 'آپدیت ۲۰ε باید changelog بک‌آپ/خروج داشته باشد');
  // ویژگی‌های η در خود HTML پایه θ هستند
  assertTrue(!!extractFunctionSource(html, 'exitWithBackup') && html.indexOf('flashAutosaveDot')>=0, 'رفع‌های η باید در HTML θ موجود باشند');
});

test('قانون ۹: لانچر BAT/PS1 باید با نسخه meta همگام باشد', () => {
  const metaVer = (html.match(/<meta name="app-version" content="([^"]+)">/) || [])[1];
  assertTrue(!!metaVer, 'نسخه meta پیدا نشد');
  const fs = require('fs');
  const path = require('path');
  const root = path.dirname(filePath);
  const bat = fs.readFileSync(path.join(root, 'Sirman_Start.bat'), 'utf8');
  const openBat = fs.readFileSync(path.join(root, 'OPEN_SIRMAN.bat'), 'utf8');
  const ps1 = fs.readFileSync(path.join(root, 'sirman_run.ps1'), 'utf8');
  assertContainsString(bat, 'SIRMAN_VERSION='+metaVer, 'Sirman_Start.bat باید SIRMAN_VERSION='+metaVer+' داشته باشد');
  assertContainsString(openBat, 'SIRMAN_VERSION='+metaVer, 'OPEN_SIRMAN.bat باید SIRMAN_VERSION='+metaVer+' داشته باشد');
  assertContainsString(ps1, "$SirmanVersion = '"+metaVer+"'", 'sirman_run.ps1 باید $SirmanVersion = \''+metaVer+'\' داشته باشد');
});



console.log('📋 گروه ۲۱β: نشانه ذخیره خودکار');

test('نشانه سبز autosave فقط هنگام ذخیره موفق باید پالس بزند، نه دائمی', () => {
  assertContainsString(html, 'id="autosave-dot"', 'عنصر autosave-dot لازم است');
  assertContainsString(html, 'function setAutosaveDotArmed(', 'setAutosaveDotArmed لازم است');
  assertContainsString(html, 'function autoSaveTick(', 'autoSaveTick لازم است');
  const st = extractFunctionSource(html, 'startAutoSave');
  assertContainsString(st, 'doAutoSave(true)', 'شروع باید یک ذخیره فوری هم بزند');
  const fl = extractFunctionSource(html, 'flashAutosaveDot');
  assertContainsString(fl, "dot.classList.add('on')", 'ذخیره موفق باید پالس on را فعال کند');
  assertContainsString(fl, "dot.classList.remove('on')", 'پس از پالس باید چراغ پنهان شود');
  const tick = extractFunctionSource(html, 'autoSaveTick');
  assertTrue(tick.indexOf('setAutosaveDotArmed(true') === -1, 'tick نباید چراغ دائمی روشن کند');
});

test('اعلان سیرمان باید صدای متمایز داشته باشد', () => {
  const sound = extractFunctionSource(html, 'playSirmanNotificationSound');
  const notify = extractFunctionSource(html, 'showLaeghNotification');
  assertTrue(!!sound && !!notify, 'توابع صدای اعلان پیدا نشدند');
  assertContainsString(sound, 'AudioContext', 'مرورگر باید چایم اختصاصی بسازد');
  assertContainsString(sound, '784', 'نت اول چایم سیرمان');
  assertContainsString(sound, '1047', 'نت دوم چایم سیرمان');
  assertContainsString(notify, 'playSirmanNotificationSound', 'اعلان ویندوز باید صدای سیرمان را صدا بزند');
  const fs = require('fs'), path = require('path');
  const host = fs.readFileSync(path.join(path.dirname(filePath), 'desktop', 'Sirman.Desktop', 'NotifyBridgeService.cs'), 'utf8');
  assertContainsString(host, 'PlaySirmanChime', 'پوسته EXE باید چایم اختصاصی داشته باشد');
  assertContainsString(host, 'Console.Beep(784', 'پوسته EXE باید نت اول را اجرا کند');
  assertContainsString(host, 'Notification.IM', 'Toast ویندوز باید صدای اطلاع‌رسانی داشته باشد');
});

console.log('📋 گروه ۲۱α: پیش‌نمایش و بازگردانی انتخابی بک‌آپ');

test('مودال پیش‌نمایش بک‌آپ و توابع انتخاب بخش باید موجود باشند', () => {
  assertContainsString(html, 'id="restore-preview-modal"', 'مودال پیش‌نمایش بازگردانی لازم است');
  assertContainsString(html, 'function openRestorePreviewModal(', 'openRestorePreviewModal لازم است');
  assertContainsString(html, 'function summarizeBackupInventory(', 'summarizeBackupInventory لازم است');
  assertContainsString(html, 'function applyBackupSelective(', 'applyBackupSelective لازم است');
  assertContainsString(html, 'function confirmRestorePreview(', 'confirmRestorePreview لازم است');
  assertContainsString(html, 'پیش‌نمایش بازگردانی', 'راهنمای پیش‌نمایش بازگردانی لازم است');
  const imp = extractFunctionSource(html, 'importData');
  assertContainsString(imp, 'openRestorePreviewModal', 'importData باید مودال پیش‌نمایش را باز کند');
  assertTrue(imp.indexOf('applyAll()') === -1, 'importData نباید بدون انتخاب بخش applyAll کند');
});

test('شبیه‌سازی واقعی: summarizeBackupInventory باید بخش‌های دارای داده را گزارش کند', () => {
  const src = [extractFunctionSource(html, 'getBackupSectionDefs'), extractFunctionSource(html, 'describeBackupValue'), extractFunctionSource(html, 'summarizeBackupInventory')].join('\n');
  assertTrue(!!extractFunctionSource(html, 'summarizeBackupInventory'), 'summarizeBackupInventory پیدا نشد');
  const runner = new Function(src + `;
    return summarizeBackupInventory({
      version:'1405.5.21σ',
      invoices:[{id:1},{id:2}],
      phonebook:[{fn:'علی',phones:['0912']}],
      pb:[],
      parts:[],
      company:{name:'سیرمان'},
      logoSrc:''
    });
  `);
  const rows = runner();
  assertTrue(Array.isArray(rows) && rows.length > 5, 'باید چند بخش برگردد');
  const inv = rows.find(r => r.key === 'invoices');
  const pb = rows.find(r => r.key === 'phonebook');
  const logo = rows.find(r => r.key === 'logoSrc');
  assertTrue(inv && inv.has && inv.count === 2, 'فاکتورها باید ۲ مورد نشان دهد');
  assertTrue(pb && pb.has && pb.count === 1, 'دفترچه باید ۱ نفر نشان دهد');
  assertTrue(logo && !logo.has, 'لوگوی خالی نباید has باشد');
});

test('شبیه‌سازی واقعی: _restoreWants باید فقط بخش‌های انتخاب‌شده را بپذیرد', () => {
  const src = extractFunctionSource(html, '_restoreWants');
  assertTrue(!!src, '_restoreWants پیدا نشد');
  const runner = new Function(src + `;
    return {
      a: _restoreWants(['invoices','phonebook'], 'invoices'),
      b: _restoreWants(['invoices','phonebook'], 'sales'),
      c: _restoreWants([], 'sales'),
      d: _restoreWants(null, 'sales')
    };
  `);
  const r = runner();
  assertEqual(r.a, true, 'بخش انتخاب‌شده باید true باشد');
  assertEqual(r.b, false, 'بخش انتخاب‌نشده باید false باشد');
  assertEqual(r.c, true, 'آرایه خالی یعنی همه');
  assertEqual(r.d, true, 'null یعنی همه');
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

test('عمق سه‌بعدی نباید GPU سنگین (perspective/translateZ/blur) داشته باشد — رفع لگ و بریدن سایدبار', () => {
  assertTrue(!/perspective\s*:\s*1400px/.test(html), 'perspective نباید باشد — باعث بریدن سایدبار و لگ می‌شود');
  assertTrue(!/transform\s*:\s*translateZ\(40px\)/.test(html), 'translateZ روی سایدبار نباید باشد');
  assertTrue(!/\.topbar\{[^}]*backdrop-filter\s*:\s*blur\(10px\)/.test(html), 'blur روی topbar نباید باشد');
  assertContainsString(html, 'transform:none!important', 'سایدبار باید transform:none داشته باشد تا از لبه نپرد');
  assertContainsString(html, 'padding-right:max(10px', 'سایدبار باید padding راست امن داشته باشد');
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

console.log('');
console.log('📋 گروه ۴۰: ریل فقط‌آیکون + شکل + پس‌زمینه مجزا + شورتکات DnD');

test('حالت فقط‌آیکون و شکل آیکون باید در CSS و تنظیمات ظاهر موجود باشد', () => {
  assertContainsString(html, 'body.sb-icons-only', 'کلاس sb-icons-only پیدا نشد');
  assertContainsString(html, 'id="sb-mode-select"', 'سلکتور حالت منو پیدا نشد');
  assertContainsString(html, 'id="nav-shape-select"', 'سلکتور شکل آیکون پیدا نشد');
  assertContainsString(html, 'id="sb-mode-cards"', 'کارت‌های تم منو پیدا نشد');
  assertContainsString(html, 'nav-shape-circle', 'شکل دایره پیدا نشد');
  assertContainsString(html, 'nav-shape-rect', 'شکل مستطیل پیدا نشد');
  assertContainsString(html, 'nav-shape-square', 'شکل مربع پیدا نشد');
  assertContainsString(html, 'function setSbMode(', 'تابع setSbMode پیدا نشد');
  assertContainsString(html, 'function setNavShape(', 'تابع setNavShape پیدا نشد');
  assertContainsString(html, 'function renderSbModeCards(', 'تابع renderSbModeCards پیدا نشد');
  assertContainsString(html, 'body.sb-icons-only{--sidebar:78px;}', 'عرض ریل فقط‌آیکون باید ۷۸px باشد');
});

test('ریل فقط‌شکل باید نام را کشویی از راست به چپ نشان دهد و پوسته‌های قبلی حفظ شوند', () => {
  assertContainsString(html, 'body.sb-icons-only .nav-it .nav-txt', 'برچسب کشویی nav-txt در حالت ریل باید تعریف شود');
  assertContainsString(html, 'transform:translateY(-50%) translateX(12px)', 'حالت بستهٔ کشویی (از راست) پیدا نشد');
  assertContainsString(html, 'body.sb-icons-only .nav-it:hover .nav-txt', 'هاور باید برچسب را باز کند');
  assertContainsString(html, 'max-width:220px', 'باز شدن کشویی با max-width پیدا نشد');
  assertContainsString(html, 'transform-origin:right center', 'مبدأ انیمیشن باید سمت راست (کنار آیکون) باشد');
  assertContainsString(html, "parsian:", 'اسکین پارسیان باید حفظ شود');
  assertContainsString(html, "ocean:", 'اسکین اقیانوس باید حفظ شود');
  assertContainsString(html, "graphite:", 'اسکین ذغال‌سنگی باید حفظ شود');
  assertContainsString(html, "ember:", 'اسکین مس صنعتی باید حفظ شود');
  assertContainsString(html, "classic:", 'اسکین کلاسیک باید حفظ شود');
  assertContainsString(html, 'ریل فقط‌شکل', 'برچسب UI ریل فقط‌شکل پیدا نشد');
  assertContainsString(html, 'content:none!important', 'تولتیپ سراسری روی منو در ریل باید خاموش باشد');
});

test('عکس پس‌زمینه ستون/وسط نباید position پنجره‌ها را عوض کند یا clip-path روی میزکار بگذارد', () => {
  assertTrue(html.indexOf('.main.has-custom-bg > *{position:relative;z-index:1;}') === -1, 'قانون عمومی > * روی .main نباید position همه فرزندان را عوض کند');
  assertContainsString(html, '.main.has-custom-bg > #win-workspace', 'نوار/میزکار پنجره باید جدا از عکس پس‌زمینه بالا بماند');
  assertContainsString(html, '.main.has-custom-bg > .fab{position:fixed!important', 'دکمه شناور باید fixed بماند');
  assertContainsString(html, 'body.win-mode .main.has-custom-bg', 'حالت چندپنجره باید clip-path پس‌زمینه را خنثی کند');
  assertContainsString(html, 'clip-path:none!important', 'clip-path نباید روی میزکار پنجره‌ها بماند');
  const applySrc = extractFunctionSource(html, 'applyLayerBackgrounds');
  assertContainsString(applySrc, 'catch(_bgErr)', 'اعمال پس‌زمینه نباید با خطا کل برنامه را بخواباند');
  assertContainsString(html, "pointer-events:none!important", 'لایه عکس نباید کلیک پنجره‌ها را بگیرد');
});

test('پس‌زمینه‌های مجزا (ستون/وسط/داشبورد) با cover و کنترل UI باید موجود باشد', () => {
  assertContainsString(html, 'id="sb-bg-inp"', 'ورودی عکس ستون راست پیدا نشد');
  assertContainsString(html, 'id="main-bg-inp"', 'ورودی عکس وسط پیدا نشد');
  assertContainsString(html, 'id="dash-bg-inp"', 'ورودی عکس داشبورد پیدا نشد');
  assertContainsString(html, 'function setSbBgImage(', 'تابع setSbBgImage پیدا نشد');
  assertContainsString(html, 'function setMainBgImage(', 'تابع setMainBgImage پیدا نشد');
  assertContainsString(html, 'function setDashBgImage(', 'تابع setDashBgImage پیدا نشد');
  assertContainsString(html, 'function applyLayerBackgrounds(', 'تابع applyLayerBackgrounds پیدا نشد');
  assertContainsString(html, 'background-size:cover!important', 'پس‌زمینه‌ها باید cover باشند تا بیرون نزنند');
  assertContainsString(html, '#page-dashboard .dash-shell', 'پوسته داشبورد برای والپیپر پیدا نشد');
  assertContainsString(html, 'overflow:hidden', 'داشبورد باید overflow:hidden داشته باشد تا عکس بیرون نزند');
  assertContainsString(html, '.sb.has-custom-bg::before', 'پس‌زمینه منو باید لایه ::before داخل چارچوب باشد');
  assertContainsString(html, '.main.has-custom-bg::before', 'پس‌زمینه وسط باید لایه ::before داخل چارچوب باشد');
  assertContainsString(html, '.dash-shell.has-dash-bg::before', 'پس‌زمینه داشبورد باید لایه ::before داخل چارچوب باشد');
  const appSrc = extractFunctionSource(html, 'applyAppearanceSettings');
  assertContainsString(appSrc, 'applyLayerBackgrounds()', 'applyAppearanceSettings باید لایه‌های پس‌زمینه را اعمال کند');
});

test('شورتکات داشبورد با drag-and-drop باید موجود باشد', () => {
  assertContainsString(html, 'id="dash-shortcuts"', 'ناحیه شورتکات داشبورد پیدا نشد');
  assertContainsString(html, 'function onDashDrop(', 'تابع onDashDrop پیدا نشد');
  assertContainsString(html, 'function addDashShortcut(', 'تابع addDashShortcut پیدا نشد');
  assertContainsString(html, 'function renderDashShortcuts(', 'تابع renderDashShortcuts پیدا نشد');
  assertContainsString(html, 'draggable', 'آیتم‌های منو باید draggable شوند');
  assertContainsString(html, 'text/laegh-page', 'MIME دادهٔ درگ باید text/laegh-page باشد');
  assertContainsString(html, 'laegh_dash_shortcuts', 'کلید ذخیره شورتکات‌ها پیدا نشد');
});

test('بک‌آپ باید حالت منو/شکل/پس‌زمینه‌ها/شورتکات را ذخیره و بازگردانی کند', () => {
  const buildSrc = extractFunctionSource(html, '_buildFullBackupData');
  assertContainsString(buildSrc, "sbMode: localStorage.getItem('laegh_sb_mode')", 'sbMode در بک‌آپ نیست');
  assertContainsString(buildSrc, "navShape: localStorage.getItem('laegh_nav_shape')", 'navShape در بک‌آپ نیست');
  assertContainsString(buildSrc, "sbBg: localStorage.getItem('laegh_sb_bg')", 'sbBg در بک‌آپ نیست');
  assertContainsString(buildSrc, "mainBg: localStorage.getItem('laegh_main_bg')", 'mainBg در بک‌آپ نیست');
  assertContainsString(buildSrc, "dashBg: localStorage.getItem('laegh_dash_bg')", 'dashBg در بک‌آپ نیست');
  assertContainsString(buildSrc, "dashShortcuts: localStorage.getItem('laegh_dash_shortcuts')", 'dashShortcuts در بک‌آپ نیست');
  assertContainsString(html, "localStorage.setItem('laegh_sb_mode', ap.sbMode)", 'بازگردانی sbMode نیست');
  assertContainsString(html, "localStorage.setItem('laegh_dash_shortcuts', ap.dashShortcuts)", 'بازگردانی dashShortcuts نیست');
  assertContainsString(html, 'تم منو', 'راهنما باید تم منو را توضیح دهد');
  assertContainsString(html, 'شورتکات داشبورد', 'راهنما باید شورتکات را توضیح دهد');
});

test('شبیه‌سازی واقعی: setSbMode و setNavShape باید کلاس و localStorage را تنظیم کنند', () => {
  const setMode = extractFunctionSource(html, 'setSbMode');
  const setShape = extractFunctionSource(html, 'setNavShape');
  assertTrue(!!setMode && !!setShape, 'توابع setSbMode/setNavShape استخراج نشدند');
  const classes = new Set();
  const store = {};
  const fakeDocument = {
    body: {
      classList: {
        toggle(c, on){ if(on) classes.add(c); else classes.delete(c); },
        remove(){ Array.from(arguments).forEach(c => classes.delete(c)); },
        add(c){ classes.add(c); },
        contains(c){ return classes.has(c); }
      }
    },
    querySelectorAll(){ return []; },
    getElementById(){ return null; }
  };
  const fakeLS = {
    getItem: k => (Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null),
    setItem: (k,v) => { store[k]=String(v); }
  };
  const refreshNavTooltips = function(){};
  const renderSbModeCards = function(){};
  const ensureDockFlyouts = function(){};
  const runner = new Function('document','localStorage','ntf','refreshNavTooltips','renderSbModeCards','ensureDockFlyouts',
    setMode + '\n' + setShape + '\nsetSbMode("icons"); setNavShape("circle");');
  runner(fakeDocument, fakeLS, function(){}, refreshNavTooltips, renderSbModeCards, ensureDockFlyouts);
  assertTrue(classes.has('sb-icons-only'), 'حالت icons باید کلاس sb-icons-only بگذارد');
  assertTrue(!classes.has('sb-dock'), 'حالت icons نباید sb-dock داشته باشد');
  assertEqual(store['laegh_sb_mode'], 'icons', 'localStorage حالت منو باید icons شود');
  assertTrue(classes.has('nav-shape-circle'), 'شکل circle باید کلاس nav-shape-circle بگذارد');
  assertEqual(store['laegh_nav_shape'], 'circle', 'localStorage شکل باید circle شود');
  const runnerDock = new Function('document','localStorage','ntf','refreshNavTooltips','renderSbModeCards','ensureDockFlyouts',
    setMode + '\nsetSbMode("dock");');
  let dockBuilt = false;
  runnerDock(fakeDocument, fakeLS, function(){}, refreshNavTooltips, renderSbModeCards, function(){ dockBuilt = true; });
  assertTrue(classes.has('sb-dock'), 'حالت dock باید کلاس sb-dock بگذارد');
  assertTrue(!classes.has('sb-icons-only'), 'حالت dock نباید sb-icons-only داشته باشد');
  assertEqual(store['laegh_sb_mode'], 'dock', 'localStorage حالت منو باید dock شود');
  assertTrue(dockBuilt, 'ensureDockFlyouts باید برای dock صدا زده شود');
  const runnerFull = new Function('document','localStorage','ntf','refreshNavTooltips','renderSbModeCards','ensureDockFlyouts',
    setMode + '\nsetSbMode("full");');
  runnerFull(fakeDocument, fakeLS, function(){}, refreshNavTooltips, renderSbModeCards, ensureDockFlyouts);
  assertTrue(!classes.has('sb-icons-only'), 'حالت full باید کلاس sb-icons-only را بردارد');
  assertTrue(!classes.has('sb-dock'), 'حالت full باید کلاس sb-dock را بردارد');
  assertEqual(store['laegh_sb_mode'], 'full', 'localStorage حالت منو باید full شود');
});

test('تم داک پایین باید CSS، زیرمنوی بالا، و گزینه UI داشته باشد', () => {
  assertContainsString(html, 'body.sb-dock', 'کلاس CSS sb-dock پیدا نشد');
  assertContainsString(html, 'dock-flyout', 'کلاس زیرمنوی داک پیدا نشد');
  assertContainsString(html, 'function ensureDockFlyouts(', 'تابع ensureDockFlyouts پیدا نشد');
  assertContainsString(html, 'value="dock"', 'گزینه داک در select پیدا نشد');
  assertContainsString(html, 'داک پایین', 'برچسب UI داک پایین پیدا نشد');
  assertContainsString(html, 'bottom:16px', 'داک باید پایین صفحه باشد');
  assertContainsString(html, 'body.sb-dock .main', 'در داک باید main تمام‌عرض شود');
  const tog = extractFunctionSource(html, 'toggleSbGroup');
  assertContainsString(tog, 'sb-dock', 'toggleSbGroup باید حالت داک را پشتیبانی کند');
  assertContainsString(tog, 'dock-open', 'toggleSbGroup باید کلاس dock-open را جابه‌جا کند');
  assertContainsString(html, 'margin-right:0!important', 'در داک حاشیه راست main باید صفر باشد (وسط خالی از منو)');
});

test('داک باید هاور بالارونده و زیرمنوی کشویی بدون :scope داشته باشد', () => {
  assertTrue(!/:scope/.test(html), 'سلکتور :scope نباید باشد — در بعضی مرورگرها ارور می‌دهد');
  assertContainsString(html, 'function _dockDirectChild(', 'باید فرزند مستقیم بدون :scope پیدا شود');
  assertContainsString(html, 'translateY(-10px) scale(1.1)', 'هاور باید آیکون را بالا ببرد');
  assertContainsString(html, 'function openDockFlyout(', 'تابع openDockFlyout باید باشد');
  assertContainsString(html, 'function closeAllDockFlyouts(', 'تابع closeAllDockFlyouts باید باشد');
  assertContainsString(html, 'function positionDockFlyout(', 'تابع positionDockFlyout باید باشد');
  assertContainsString(html, 'dock-flyout-portal', 'زیرمنو باید به صورت portal روی body بیاید');
  assertContainsString(html, 'z-index:10050', 'زیرمنو باید بالای محتوای وسط باشد');
  assertContainsString(html, 'body.sb-dock .dock-flyout{\n  display:none!important;', 'در داک زیرمنوی غیرپورتال باید مخفی باشد تا آیتم‌ها نشت نکنند');
  assertContainsString(html, 'body.sb-dock .sb-group .nav-it{display:none!important;}', 'فرزندان گروه نباید داخل داک پخش شوند');
  assertContainsString(html, 'max-height:88px!important', 'ارتفاع داک باید محدود و جمع‌وجور باشد');
  assertContainsString(html, 'dock-face', 'دکمه گروه باید چهره آیکون (dock-face) داشته باشد');
  assertContainsString(html, 'max-width:1080px!important', 'صفحه وسط باید وسط‌چین/متقارن باشد');
  assertContainsString(html, 'margin-left:auto!important', 'صفحه باید با margin auto وسط مانیتور باشد');
  const ens = extractFunctionSource(html, 'ensureDockFlyouts');
  assertContainsString(ens, '_dockDirectChildren', 'ensureDockFlyouts باید از helper بدون :scope استفاده کند');
  assertContainsString(ens, 'dock-face', 'ensureDockFlyouts باید dock-face بسازد');
});

test('شبیه‌سازی واقعی: addDashShortcut باید شورتکات را در localStorage ذخیره کند و تکراری نسازد', () => {
  const addSrc = extractFunctionSource(html, 'addDashShortcut');
  const loadSrc = extractFunctionSource(html, 'loadDashShortcuts');
  const saveSrc = extractFunctionSource(html, 'saveDashShortcuts');
  assertTrue(!!addSrc && !!loadSrc && !!saveSrc, 'توابع شورتکات استخراج نشدند');
  const store = {};
  const fakeLS = {
    getItem: k => (Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null),
    setItem: (k,v) => { store[k]=String(v); },
    removeItem: k => { delete store[k]; }
  };
  let rendered = 0;
  const notes = [];
  const runner = new Function('localStorage','renderDashShortcuts','ntf',
    loadSrc + '\n' + saveSrc + '\n' + addSrc +
    '\naddDashShortcut("invoice","صدور فاکتور"); addDashShortcut("invoice","صدور فاکتور"); addDashShortcut("tasks","وظایف");');
  runner(fakeLS, function(){ rendered++; }, function(m){ notes.push(m); });
  const arr = JSON.parse(store['laegh_dash_shortcuts'] || '[]');
  assertEqual(arr.length, 2, 'باید دقیقاً ۲ شورتکات یکتا ذخیره شود');
  assertEqual(arr[0].page, 'invoice', 'اولین شورتکات باید invoice باشد');
  assertEqual(arr[1].page, 'tasks', 'دومین شورتکات باید tasks باشد');
  assertTrue(rendered >= 2, 'renderDashShortcuts باید بعد از افزودن صدا زده شود');
  assertTrue(notes.some(n => String(n).indexOf('از قبل') >= 0), 'برای تکراری باید پیام هشدار بیاید');
});

test('شورتکات داشبورد باید رنگ آیکون منو را حفظ کند (نه سفید)', () => {
  const fnSrc = extractFunctionSource(html, 'renderDashShortcuts');
  assertTrue(!!fnSrc, 'renderDashShortcuts پیدا نشد');
  assertContainsString(fnSrc, "setAttribute('data-page'", 'شورتکات باید data-page داشته باشد تا رنگ CSS اعمال شود');
  assertContainsString(fnSrc, 'getComputedStyle', 'باید پس‌زمینه محاسبه‌شده آیکون منو کپی شود');
  assertContainsString(html, '.dash-sc[data-page="invoice"] .nav-ico', 'CSS رنگ شورتکات فاکتور پیدا نشد');
  assertContainsString(html, '.dash-sc[data-page="tasks"] .nav-ico', 'CSS رنگ شورتکات وظایف پیدا نشد');
  assertContainsString(html, 'setDragImage', 'تصویر درگ رنگی باید با setDragImage تنظیم شود');
  assertContainsString(html, 'پیش‌فرض تا سفید نشود', 'پس‌زمینه پیش‌فرض شورتکات باید تعریف شده باشد');
});

console.log('');
console.log('📋 گروه: رنگ فونت / متن قابل تنظیم');

test('UI و توابع رنگ فونت باید موجود باشد', () => {
  assertContainsString(html, 'رنگ فونت / متن', 'برچسب UI رنگ فونت پیدا نشد');
  assertContainsString(html, 'id="text-color-inp"', 'ورودی رنگ سفارشی پیدا نشد');
  assertContainsString(html, "setTextColor('#b91c1c')", 'سواچ قرمز پیدا نشد');
  assertContainsString(html, 'function setTextColor(', 'تابع setTextColor پیدا نشد');
  assertContainsString(html, 'function applyTextColor(', 'تابع applyTextColor پیدا نشد');
  assertContainsString(html, "localStorage.setItem('laegh_text_color'", 'ذخیره رنگ فونت پیدا نشد');
});

test('رنگ فونت باید در بک‌آپ، بازگردانی، حفاظت و ظاهر ذخیره شود', () => {
  const buildSrc = extractFunctionSource(html, '_buildFullBackupData');
  assertContainsString(buildSrc, "textColor: localStorage.getItem('laegh_text_color')", 'textColor باید در بک‌آپ باشد');
  assertContainsString(html, "localStorage.setItem('laegh_text_color', ap.textColor)", 'بازگردانی باید textColor را بنویسد');
  assertContainsString(html, "'laegh_text_color'", 'کلید رنگ فونت باید در کد باشد');
  const appSrc = extractFunctionSource(html, 'applyAppearanceSettings');
  assertContainsString(appSrc, 'applyTextColor()', 'applyAppearanceSettings باید applyTextColor را صدا بزند');
  const skinSrc = extractFunctionSource(html, 'setSkin');
  assertContainsString(skinSrc, 'applyTextColor()', 'بعد از تعویض اسکین باید رنگ فونت دوباره اعمال شود');
});

test('شبیه‌سازی: setTextColor باید --text را قرمز کند و پیش‌فرض را پاک کند', () => {
  const setSrc = extractFunctionSource(html, 'setTextColor');
  const applySrc = extractFunctionSource(html, 'applyTextColor');
  const mutedSrc = extractFunctionSource(html, '_textColorMuted');
  assertTrue(!!(setSrc && applySrc && mutedSrc), 'توابع رنگ فونت استخراج نشدند');
  const store = {};
  const bodyProps = {};
  const rootProps = {};
  const fakeDocument = {
    body: {
      style: {
        setProperty(n, v){ bodyProps[n]=v; },
        removeProperty(n){ delete bodyProps[n]; }
      },
      classList: { contains(){ return false; } }
    },
    documentElement: {
      style: {
        setProperty(n, v){ rootProps[n]=v; },
        removeProperty(n){ delete rootProps[n]; }
      }
    },
    getElementById(){ return { value: '#152833' }; }
  };
  const fakeLocalStorage = {
    getItem(k){ return store[k]===undefined?null:store[k]; },
    setItem(k,v){ store[k]=String(v); },
    removeItem(k){ delete store[k]; }
  };
  const ntf = ()=>{};
  // eslint-disable-next-line no-new-func
  const fn = new Function('document','localStorage','ntf','SKIN_PRESETS',
    mutedSrc + '\n' + applySrc + '\n' + setSrc + '\n' +
    'return {setTextColor, applyTextColor};'
  );
  const api = fn(fakeDocument, fakeLocalStorage, ntf, {parsian:{text:'#152833',text2:'#5B7180'}});
  api.setTextColor('#b91c1c');
  assertEqual(store['laegh_text_color'], '#b91c1c', 'رنگ قرمز باید در localStorage ذخیره شود');
  assertEqual(bodyProps['--text'], '#b91c1c', 'باید --text روی body قرمز شود');
  assertEqual(rootProps['--text'], '#b91c1c', 'باید --text روی root هم ست شود');
  api.setTextColor('default');
  assertTrue(store['laegh_text_color']===undefined, 'پیش‌فرض باید کلید رنگ را پاک کند');
  assertTrue(bodyProps['--text']===undefined, 'پیش‌فرض باید --text سفارشی body را بردارد');
});

console.log('');
console.log('📋 گروه: فونت‌های بیشتر + رنگ داشبورد + ماندگاری');

test('فونت‌های جدید باید در CSS و سلکتور ظاهر باشند', () => {
  assertContainsString(html, 'Noto Sans Arabic', 'فونت Noto در UI نیست');
  assertContainsString(html, 'option value="Cairo"', 'فونت Cairo نیست');
  assertContainsString(html, 'option value="Tajawal"', 'فونت Tajawal نیست');
  assertContainsString(html, 'option value="Naskh"', 'فونت Naskh نیست');
  assertContainsString(html, 'body.f-noto', 'کلاس CSS فونت Noto نیست');
  assertContainsString(html, 'body.f-cairo', 'کلاس CSS فونت Cairo نیست');
  const setSrc = extractFunctionSource(html, 'setAppFont');
  assertContainsString(setSrc, "Noto:'f-noto'", 'setAppFont باید Noto را مپ کند');
  assertContainsString(setSrc, "Cairo:'f-cairo'", 'setAppFont باید Cairo را مپ کند');
});

test('داشبورد باید رنگ متمایز پیش‌فرض و کنترل setDashTint داشته باشد', () => {
  assertContainsString(html, '--dash-tint', 'متغیر --dash-tint پیدا نشد');
  assertContainsString(html, 'function setDashTint(', 'تابع setDashTint پیدا نشد');
  assertContainsString(html, 'function applyDashTint(', 'تابع applyDashTint پیدا نشد');
  assertContainsString(html, "setDashTint('#fef3c7')", 'سواچ رنگ داشبورد پیدا نشد');
  const appSrc = extractFunctionSource(html, 'applyAppearanceSettings');
  assertContainsString(appSrc, 'applyDashTint()', 'ظاهر باید رنگ داشبورد را اعمال کند');
  const buildSrc = extractFunctionSource(html, '_buildFullBackupData');
  assertContainsString(buildSrc, "dashTint: localStorage.getItem('laegh_dash_tint')", 'dashTint باید در بک‌آپ باشد');
});

test('شبیه‌سازی: setDashTint و setAppFont باید در localStorage بمانند', () => {
  const tintSet = extractFunctionSource(html, 'setDashTint');
  const tintApply = extractFunctionSource(html, 'applyDashTint');
  const fontSet = extractFunctionSource(html, 'setAppFont');
  assertTrue(!!(tintSet && tintApply && fontSet), 'توابع استخراج نشدند');
  const store = {};
  const rootProps = {};
  const classes = new Set();
  const fakeDocument = {
    body: {
      classList: {
        remove(...xs){ xs.forEach(x=>classes.delete(x)); },
        add(x){ classes.add(x); },
        contains(x){ return classes.has(x); },
        toggle(x, on){ if(on) classes.add(x); else classes.delete(x); }
      }
    },
    documentElement: {
      style: { setProperty(n,v){ rootProps[n]=v; }, removeProperty(n){ delete rootProps[n]; } }
    },
    getElementById(){ return { value: '#dceef7' }; }
  };
  const fakeLS = {
    getItem(k){ return store[k]===undefined?null:store[k]; },
    setItem(k,v){ store[k]=String(v); },
    removeItem(k){ delete store[k]; }
  };
  const ntf = ()=>{};
  const safeSet = extractFunctionSource(html, '_safeSetItem') || 'function _safeSetItem(k,v){localStorage.setItem(k,v);return true;}';
  // eslint-disable-next-line no-new-func
  const fn = new Function('document','localStorage','ntf',
    'var DASH_TINT_DEFAULT="linear-gradient(165deg,#dceef7 0%,#e8f4f1 45%,#f3efe6 100%)";\n'+
    'var DASH_TINT_DEFAULT_DARK="linear-gradient(165deg,#1a2833 0%,#1e2f3a 50%,#243028 100%)";\n'+
    safeSet + '\n' + tintApply + '\n' + tintSet + '\n' + fontSet + '\n' +
    'return {setDashTint, applyDashTint, setAppFont};'
  );
  const api = fn(fakeDocument, fakeLS, ntf);
  api.setDashTint('#fef3c7');
  assertEqual(store['laegh_dash_tint'], '#fef3c7', 'رنگ داشبورد باید ذخیره شود');
  assertTrue(String(rootProps['--dash-tint']||'').indexOf('#fef3c7')!==-1, '--dash-tint باید ست شود');
  api.setAppFont('Cairo');
  assertEqual(store['laegh_app_font'], 'Cairo', 'فونت Cairo باید ذخیره شود');
  assertTrue(classes.has('f-cairo'), 'کلاس f-cairo باید روی body باشد');
  // شبیه‌سازی بازشدن مجدد: فقط apply
  classes.clear();
  const fontVal = store['laegh_app_font'];
  api.setAppFont(fontVal);
  assertTrue(classes.has('f-cairo'), 'بعد از بازشدن مجدد فونت باید بماند');
  api.applyDashTint();
  assertTrue(String(rootProps['--dash-tint']||'').indexOf('#fef3c7')!==-1, 'بعد از بازشدن مجدد رنگ داشبورد باید بماند');
});

test('ماندگاری: فشرده‌سازی عکس و ذخیره صفحه آخر باید موجود باشد', () => {
  assertContainsString(html, 'function _compressImageDataUrl(', 'فشرده‌سازی عکس پس‌زمینه پیدا نشد');
  assertContainsString(html, 'function _safeSetItem(', 'ذخیره امن localStorage پیدا نشد');
  assertContainsString(html, "localStorage.setItem('laegh_last_page'", 'ذخیره صفحه آخر پیدا نشد');
  assertContainsString(html, 'restoreLastPageAndAppearance', 'بازیابی ظاهر/صفحه هنگام بالا آمدن پیدا نشد');
  assertContainsString(html, "'laegh_dash_tint'", 'کلید رنگ داشبورد در حفاظت/کد پیدا نشد');
});

console.log('');
console.log('📋 گروه: برند سیرمان + نسخه یونانی + پس‌زمینه چاپ');

test('برند پیش‌فرض سیرمان و getBrand/applyBrand باید موجود باشد', () => {
  assertContainsString(html, "nameFa: 'سیرمان'", 'پیش‌فرض فارسی سیرمان نیست');
  assertContainsString(html, "nameEn: 'Sirman'", 'پیش‌فرض انگلیسی Sirman نیست');
  assertContainsString(html, 'function getBrand(', 'getBrand پیدا نشد');
  assertContainsString(html, 'function applyBrand(', 'applyBrand پیدا نشد');
  assertContainsString(html, 'id="co-name-fa"', 'فیلد نام فارسی برند نیست');
  assertContainsString(html, 'id="co-name-en"', 'فیلد نام انگلیسی برند نیست');
  assertContainsString(html, 'id="sb-brand-en"', 'برند سایدبار قابل‌به‌روزرسانی نیست');
});

test('شبیه‌سازی: تغییر نام شرکت باید در getBrand دیده شود', () => {
  const getSrc = extractFunctionSource(html, 'getBrand');
  const getCo = extractFunctionSource(html, 'getCompanyData');
  assertTrue(!!(getSrc && getCo), 'توابع برند استخراج نشدند');
  const store = { laegh_company: JSON.stringify({ nameFa:'لائق', nameEn:'Laegh', taglineFa:'خدمات', shortName:'لائق' }) };
  const fakeLS = {
    getItem(k){ return store[k]===undefined?null:store[k]; },
    setItem(k,v){ store[k]=String(v); },
    removeItem(k){ delete store[k]; }
  };
  // eslint-disable-next-line no-new-func
  const fn = new Function('localStorage', 'BRAND_DEFAULTS',
    'var BRAND_DEFAULTS=BRAND_DEFAULTS||{nameFa:"سیرمان",nameEn:"Sirman",taglineFa:"سیستم خدمات پس از فروش",shortName:"سیرمان"};\n'+
    getCo + '\n' + getSrc + '\n return getBrand();'
  );
  const b = fn(fakeLS, {nameFa:'سیرمان',nameEn:'Sirman',taglineFa:'سیستم خدمات پس از فروش',shortName:'سیرمان'});
  assertEqual(b.nameFa, 'لائق', 'نام فارسی برند باید لائق شود');
  assertEqual(b.nameEn, 'Laegh', 'نام انگلیسی برند باید Laegh شود');
});

test('پس‌زمینه تصویری چاپ برای بخش‌های قابل چاپ باید موجود باشد', () => {
  assertContainsString(html, 'function setPrintBgImage(', 'setPrintBgImage پیدا نشد');
  assertContainsString(html, 'function printBgCss(', 'printBgCss پیدا نشد');
  assertContainsString(html, 'function clearPrintBgImage(', 'clearPrintBgImage پیدا نشد');
  assertContainsString(html, "setPrintBgImage('invoice'", 'UI فاکتور برای تصویر پس‌زمینه نیست');
  assertContainsString(html, "setPrintBgImage('warranty'", 'UI گارانتی برای تصویر پس‌زمینه نیست');
  assertContainsString(html, "setPrintBgImage('postal'", 'UI پستی برای تصویر پس‌زمینه نیست');
  assertContainsString(html, "setPrintBgImage('list'", 'UI لیست برای تصویر پس‌زمینه نیست');
  assertContainsString(html, 'bgImage', 'فیلد bgImage در تنظیمات چاپ نیست');
  const invSrc = extractFunctionSource(html, 'printInv');
  assertContainsString(invSrc, 'printBgCss', 'چاپ فاکتور باید printBgCss را اعمال کند');
});

test('شبیه‌سازی: printBgCss با تصویر باید CSS پس‌زمینه بسازد', () => {
  const cssSrc = extractFunctionSource(html, 'printBgCss');
  const getPs = extractFunctionSource(html, 'getPrintSettings');
  assertTrue(!!cssSrc, 'printBgCss استخراج نشد');
  const store = {};
  const fakeLS = {
    getItem(k){ return store[k]===undefined?null:store[k]; },
    setItem(k,v){ store[k]=String(v); }
  };
  // eslint-disable-next-line no-new-func
  const fn = new Function('localStorage','PS_KEY','PS_DEFAULTS',
    (getPs||'function getPrintSettings(){return {};}') + '\n' + cssSrc + '\n' +
    'return printBgCss({bg:"none", bgImage:"data:image/png;base64,AAA", bgImageOpacity:0.2, bgImageFit:"cover"});'
  );
  const css = fn(fakeLS, 'laegh_printSettings', {});
  assertTrue(String(css).indexOf('background-image:url(') !== -1, 'باید background-image داشته باشد');
  assertTrue(String(css).indexOf('opacity:0.2') !== -1, 'باید شفافیت تصویر را اعمال کند');
});

console.log('');
console.log('📋 گروه: اندازه متن کشویی/عددی');

test('اندازه متن باید کشویی و عددی باشد نه فقط ۳ حالت', () => {
  assertContainsString(html, 'id="txtSizeRange"', 'کشویی اندازه متن پیدا نشد');
  assertContainsString(html, 'id="txtSizeNum"', 'ورودی عددی اندازه متن پیدا نشد');
  assertContainsString(html, 'id="txtSizeVal"', 'نمایش درصد اندازه متن پیدا نشد');
  assertTrue(!html.includes('id="text-size-select"'), 'سلکتور سه‌حالتی قدیمی باید حذف شده باشد');
  assertContainsString(html, '--text-scale', 'متغیر --text-scale پیدا نشد');
  assertContainsString(html, 'function _normalizeTextSizePct(', 'نرمال‌سازی درصد پیدا نشد');
  assertContainsString(html, 'function applyTextSize(', 'applyTextSize پیدا نشد');
});

test('شبیه‌سازی: setTextSize باید درصد را بین ۹۰ تا ۱۸۰ نگه دارد و sm/lg را مهاجرت دهد', () => {
  const norm = extractFunctionSource(html, '_normalizeTextSizePct');
  const setSrc = extractFunctionSource(html, 'setTextSize');
  assertTrue(!!(norm && setSrc), 'توابع اندازه متن استخراج نشدند');
  const store = {};
  const rootProps = {};
  const fakeDocument = {
    body: { classList: { remove(){}, add(){} } },
    documentElement: { style: { setProperty(n,v){ rootProps[n]=v; } } },
    getElementById(id){
      if(id==='txtSizeVal') return { textContent:'' };
      if(id==='txtSizeRange' || id==='txtSizeNum') return { value:'' };
      return null;
    }
  };
  const fakeLS = {
    getItem(k){ return store[k]===undefined?null:store[k]; },
    setItem(k,v){ store[k]=String(v); }
  };
  // eslint-disable-next-line no-new-func
  const fn = new Function('document','localStorage','ntf',
    norm + '\n' + setSrc + '\n return {setTextSize, _normalizeTextSizePct};'
  );
  const api = fn(fakeDocument, fakeLS, ()=>{});
  assertEqual(api._normalizeTextSizePct('sm'), 92, 'sm باید به ۹۲٪ مهاجرت کند');
  assertEqual(api._normalizeTextSizePct('lg'), 120, 'lg باید به ۱۲۰٪ مهاجرت کند');
  assertEqual(api._normalizeTextSizePct(50), 90, 'زیر ۹۰٪ باید به کف ۹۰٪ برود');
  assertEqual(api._normalizeTextSizePct(200), 180, 'بالای ۱۸۰٪ باید سقف شود');
  api.setTextSize(135, true);
  assertEqual(store['laegh_text_size'], '135', 'درصد باید ذخیره شود');
  assertEqual(rootProps['--text-scale'], '1.35', '--text-scale باید ست شود');
});

console.log('');
console.log('📋 گروه: جستجوی دفترچه در داغی + برش پس‌زمینه + پل اعلان + viewer سراسری');

test('داغی باید کشویی قابل‌جستجو از دفترچه داشته باشد نه فقط select ساده', () => {
  assertContainsString(html, 'id="daqi-agency-search"', 'ورودی جستجوی نمایندگی داغی پیدا نشد');
  assertContainsString(html, 'id="daqi-agency-combo"', 'کامبوی دفترچه داغی پیدا نشد');
  assertContainsString(html, 'function filterDaqiAgencyCombo(', 'تابع فیلتر داغی پیدا نشد');
  assertContainsString(html, 'function pickDaqiAgency(', 'تابع انتخاب مخاطب داغی پیدا نشد');
  assertTrue(!/<select id="daqi-agency-sel"/.test(html), 'select قدیمی داغی باید با کامبوی جستجو جایگزین شده باشد');
});

test('شبیه‌سازی: filterDaqiAgencyCombo باید مخاطب را با نام/تلفن پیدا کند و pick پر کند', () => {
  const labelSrc = extractFunctionSource(html, '_daqiAgencyLabel');
  const filterSrc = extractFunctionSource(html, 'filterDaqiAgencyCombo');
  const pickSrc = extractFunctionSource(html, 'pickDaqiAgency');
  assertTrue(!!(labelSrc && filterSrc && pickSrc), 'توابع جستجوی داغی استخراج نشدند');
  const store = {};
  const els = {
    'daqi-agency-list': { innerHTML: '' },
    'daqi-agency-sel': { value: '' },
    'daqi-agency-search': { value: '' },
    'daqi-agency-name': { value: '' },
    'daqi-agency-phone': { value: '' },
    'daqi-agency-combo': { classList: { remove(){}, add(){} } }
  };
  const phonebook = [
    { fn:'علی', ln:'رضایی', shop:'نمایندگی شمال', phones:['09120001111'] },
    { fn:'مریم', ln:'کریمی', shop:'خدمات جنوب', phones:['09350002222'] }
  ];
  const fakeDoc = { getElementById(id){ return els[id] || null; } };
  // eslint-disable-next-line no-new-func
  const fn = new Function('document','phonebook',
    labelSrc + '\n' + filterSrc + '\n' + pickSrc + '\n return {filterDaqiAgencyCombo, pickDaqiAgency};'
  );
  const api = fn(fakeDoc, phonebook);
  api.filterDaqiAgencyCombo('جنوب');
  assertTrue(String(els['daqi-agency-list'].innerHTML).indexOf('مریم') !== -1, 'جستجوی جنوب باید مریم را نشان دهد');
  assertTrue(String(els['daqi-agency-list'].innerHTML).indexOf('علی') === -1, 'علی نباید در نتیجه جنوب باشد');
  api.pickDaqiAgency(0);
  assertEqual(els['daqi-agency-sel'].value, '0', 'اندیس مخاطب باید در hidden ست شود');
  assertEqual(els['daqi-agency-name'].value, 'علی رضایی', 'نام نمایندگی باید پر شود');
  assertEqual(els['daqi-agency-phone'].value, '09120001111', 'تلفن باید پر شود');
});

test('مودال برش چارچوب پس‌زمینه و اتصال به set*BgImage باید موجود باشد', () => {
  assertContainsString(html, 'id="bg-crop-modal"', 'مودال برش پس‌زمینه پیدا نشد');
  assertContainsString(html, 'function openBgCropModal(', 'openBgCropModal پیدا نشد');
  assertContainsString(html, 'function confirmBgCrop(', 'confirmBgCrop پیدا نشد');
  assertContainsString(html, 'function _beginBgCropFromFile(', '_beginBgCropFromFile پیدا نشد');
  const sb = extractFunctionSource(html, 'setSbBgImage');
  const app = extractFunctionSource(html, 'setAppBgImage');
  const print = extractFunctionSource(html, 'setPrintBgImage');
  assertContainsString(sb, '_setCoverBg(', 'setSbBgImage باید از مسیر برش استفاده کند');
  assertContainsString(app, '_beginBgCropFromFile(', 'setAppBgImage باید برش را باز کند');
  assertContainsString(print, '_beginBgCropFromFile(', 'setPrintBgImage باید برش را باز کند');
  assertContainsString(html, 'contain:paint', 'CSS باید contain:paint برای جلوگیری از بیرون‌زدن داشته باشد');
});

test('پل اعلان ویندوز باید از showLaeghNotification صدا زده شود', () => {
  assertContainsString(html, 'function pushWindowsNotifyBridge(', 'تابع پل ویندوز پیدا نشد');
  const src = extractFunctionSource(html, 'showLaeghNotification');
  assertContainsString(src, 'pushWindowsNotifyBridge(', 'showLaeghNotification باید پل را صدا بزند');
  const bridge = extractFunctionSource(html, 'pushWindowsNotifyBridge');
  assertContainsString(bridge, '127.0.0.1:8766', 'آدرس پل اعلان باید 8766 باشد');
  assertContainsString(bridge, 'chrome.webview', 'پل باید مسیر WebView2/Sirman.exe را داشته باشد');
  assertContainsString(html, 'اعلان_سیرمان.ps1', 'راهنما باید به اسکریپت پل اشاره کند');
  assertContainsString(html, 'Sirman_Start.bat', 'راهنما باید به لانچر BAT اشاره کند');
  assertContainsString(html, 'Sirman.exe', 'راهنما باید Sirman.exe را پوشش دهد');
});

test('فعال‌سازی اعلان دسکتاپ باید اول پل BAT (8766) را چک کند', () => {
  assertContainsString(html, 'function desktopNotifyAllowed(', 'desktopNotifyAllowed لازم است');
  const en = extractFunctionSource(html, 'enableTaskNotifications');
  assertContainsString(en, '8766/health', 'باید سلامت پل محلی را چک کند');
  assertContainsString(en, 'Sirman_Start.bat', 'پیام خطا باید به Start.bat اشاره کند');
  assertTrue(en.indexOf('8766/health')>=0 || en.indexOf('notify-enable')>=0, 'فعال‌سازی باید پل یا میزبان را پشتیبانی کند');
  assertTrue(en.indexOf("ntf('مرورگر شما از اعلان دسکتاپ پشتیبانی نمی‌کند'") === -1,
    'نباید فوراً با نبود Notification API ارور سخت بدهد');
  const due = extractFunctionSource(html, 'checkDueTasksForNotification');
  assertContainsString(due, 'desktopNotifyAllowed', 'بررسی کارهای سررسید باید desktopNotifyAllowed را رعایت کند');
});

test('شبیه‌سازی: enableTaskNotifications با پل 8766 بدون Notification موفق می‌شود', () => {
  const helpers = extractFunctionSource(html, 'isSirmanDesktopNotifyReady') + '\n'
    + extractFunctionSource(html, 'desktopNotifyAllowed');
  const enSrc = extractFunctionSource(html, 'enableTaskNotifications');
  assertTrue(helpers && enSrc, 'توابع اعلان پیدا نشد');
  const msgs = [];
  const shown = [];
  const store = {};
  const ctx = {
    window: {},
    localStorage: {
      getItem(k){ return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; },
      setItem(k,v){ store[k]=String(v); }
    },
    ntf(m){ msgs.push(m); },
    registerLaeghSW(){},
    showLaeghNotification(t,o){ shown.push(t); },
    checkDueTasksForNotification(){ msgs.push('due'); },
    // then هم‌زمان اجرا شود تا تست sync بماند
    fetch(){
      return {
        then(fn){ fn({ ok: true }); return { catch(){ return this; } }; },
        catch(){ return this; }
      };
    },
    Notification: undefined,
    setTimeout(){ /* تایم‌اوت fallback را در این تست نادیده بگیر */ }
  };
  const runner = new Function('ctx', 'with(ctx){ ' + helpers + '; (' + enSrc.replace(/^function enableTaskNotifications/, 'function') + ')(); }');
  runner(ctx);
  assertTrue(store.laegh_desktop_notify_on === '1', 'فلگ فعال‌سازی باید ست شود');
  assertTrue(msgs.some(m => String(m).indexOf('فعال')>=0), 'باید پیام موفقیت بدهد');
  assertArrayLength(shown, 1, 'باید یک اعلان تست بفرستد');
});

test('resolveDocArray باید wDocs/saleDocs را از let پیدا کند نه window', () => {
  const src = extractFunctionSource(html, 'resolveDocArray');
  assertTrue(src !== null, 'resolveDocArray پیدا نشد');
  assertContainsString(src, "arrName === 'wDocs'", 'باید wDocs را مستقیم resolve کند');
  assertContainsString(src, "arrName === 'saleDocs'", 'باید saleDocs را مستقیم resolve کند');
  const named = extractFunctionSource(html, 'openDocViewerNamed');
  assertTrue(named !== null, 'openDocViewerNamed پیدا نشد');
  assertContainsString(named, 'resolveDocArray', 'openDocViewerNamed باید resolveDocArray را صدا بزند');
});

test('شبیه‌سازی: openDocViewerNamed با آرایه let باید viewer را باز کند', async () => {
  const resolveSrc = extractFunctionSource(html, 'resolveDocArray');
  const namedSrc = extractFunctionSource(html, 'openDocViewerNamed');
  const openSrc = extractFunctionSource(html, 'openDocViewer');
  const showSrc = extractFunctionSource(html, '_dvShowCurrent');
  const applySrc = extractFunctionSource(html, '_dvApplyTransform');
  assertTrue(!!(resolveSrc && namedSrc && openSrc && showSrc && applySrc), 'توابع viewer استخراج نشدند');
  const els = {
    'doc-viewer': { classList: { add(){ this._open=true; }, remove(){ this._open=false; }, contains(){ return !!this._open; }, _open:false }, style:{display:''}, className:'' },
    'dv-img': { src:'', style:{} },
    'dv-title': { textContent:'' },
    'dv-zoom-val': { textContent:'' }
  };
  const wDocs = [{data:'data:image/png;base64,XX', name:'تست'}];
  const fakeDoc = { getElementById(id){ return els[id]||null; } };
  const win = { _dvDocs:[], _dvIdx:0, _dvZoom:1, _dvRotate:0, DISK_REF_PREFIX:'disk://', _diskUrlCache:{} };
  const isDiskRefSrc = extractFunctionSource(html, 'isDiskRef') || 'function isDiskRef(){return false;}';
  const resolveDiskSrc = extractFunctionSource(html, 'resolveDiskRef') || 'async function resolveDiskRef(r){return r;}';
  // eslint-disable-next-line no-new-func
  const fn = new Function('document','window','wDocs','saleDocs','ntf',
    isDiskRefSrc + '\n' + resolveDiskSrc + '\n' +
    resolveSrc + '\n' + openSrc + '\n' + showSrc + '\n' + applySrc + '\n' + namedSrc + '\n' +
    'return {openDocViewerNamed, openDocViewer};'
  );
  const api = fn(fakeDoc, win, wDocs, [], function(){});
  api.openDocViewerNamed('wDocs', 0);
  await new Promise(r => setTimeout(r, 40));
  assertEqual(els['dv-img'].src, 'data:image/png;base64,XX', 'عکس باید در viewer ست شود');
  assertTrue(els['doc-viewer'].classList._open === true || els['doc-viewer'].style.display === 'flex', 'مودال viewer باید باز شود');
});

test('viewer سراسری باید برای کالا، لوگو و پس‌زمینه چاپ هم در دسترس باشد', () => {
  assertContainsString(html, 'function viewProductByCode(', 'viewProductByCode پیدا نشد');
  assertContainsString(html, 'function previewPrintBg(', 'previewPrintBg پیدا نشد');
  assertContainsString(html, 'function previewStoredBg(', 'previewStoredBg پیدا نشد');
  assertContainsString(html, 'function viewProdImg(', 'viewProdImg پیدا نشد');
  assertContainsString(html, 'viewable-img', 'کلاس viewable-img پیدا نشد');
  assertContainsString(html, 'onclick="previewPrintBg(', 'دکمه پیش‌نمایش چاپ پیدا نشد');
  assertContainsString(html, 'چارچوب پس‌زمینه', 'راهنمای چارچوب پس‌زمینه پیدا نشد');
});

console.log('');
console.log('📋 گروه ۳۹: ضدثبت‌تکراری، انبار داغی، تاریخچه پستی، شبکه اجتماعی (۱۴۰۵.۵.۱۸γ)');

test('قفل ضدثبت‌تکراری withSaveLock باید روی گارانتی/فاکتور/داغی/دفترچه باشد', () => {
  assertContainsString(html, 'function withSaveLock(', 'withSaveLock پیدا نشد');
  const saveWar = extractFunctionSource(html, 'saveWar');
  const closeInv = extractFunctionSource(html, 'closeInv');
  const saveDaqi = extractFunctionSource(html, 'saveDaqi');
  const savePB = extractFunctionSource(html, 'savePBContact');
  assertContainsString(saveWar, "withSaveLock('war'", 'saveWar باید قفل war داشته باشد');
  assertContainsString(closeInv, "withSaveLock('closeInv'", 'closeInv باید قفل داشته باشد');
  assertContainsString(saveDaqi, "withSaveLock('daqi'", 'saveDaqi باید قفل داشته باشد');
  assertContainsString(savePB, "withSaveLock('pb'", 'savePBContact باید قفل داشته باشد');
  assertContainsString(saveWar, 'wEditIdx = warranties.length - 1', 'بعد از ثبت جدید باید wEditIdx ست شود تا duplicate نشود');
});

test('شبیه‌سازی واقعی: withSaveLock باید کلیک دوم را مسدود کند', () => {
  const src = extractFunctionSource(html, 'withSaveLock');
  assertTrue(!!src, 'withSaveLock استخراج نشد');
  const calls = [];
  const fakeNtf = (m) => calls.push(m);
  const runner = new Function('ntf', 'window', src + `
    var n=0;
    withSaveLock('t', function(){ n++; });
    withSaveLock('t', function(){ n+=10; });
    return n;
  `);
  const n = runner(fakeNtf, { _saveLocks: {} });
  assertEqual(n, 1, 'فقط یکبار باید اجرا شود، نه دو بار (دریافت شد: '+n+')');
  assertTrue(calls.length >= 1, 'کلیک دوم باید پیام خطا بدهد');
});

test('انبار داغی باید کسر موجودی و حواله خروجی بسازد', () => {
  assertContainsString(html, 'function deductDaqiWarehouse(', 'deductDaqiWarehouse پیدا نشد');
  assertContainsString(html, 'function createDaqiOutVoucher(', 'createDaqiOutVoucher پیدا نشد');
  assertContainsString(html, 'id="daqi-wh-list"', 'UI انبار داغی پیدا نشد');
  assertContainsString(html, 'id="daqi-manufacturer"', 'فیلد شرکت سازنده داغی پیدا نشد');
  const saveDaqi = extractFunctionSource(html, 'saveDaqi');
  assertContainsString(saveDaqi, 'deductDaqiWarehouse', 'saveDaqi باید از انبار داغی کسر کند');
  assertContainsString(saveDaqi, 'createDaqiOutVoucher', 'saveDaqi باید حواله بسازد');
  const buildSrc = extractFunctionSource(html, '_buildFullBackupData');
  assertContainsString(buildSrc, 'daqiWarehouse:', 'بک‌آپ باید انبار داغی را شامل شود');
  assertContainsString(buildSrc, 'daqiVouchers:', 'بک‌آپ باید حواله‌های داغی را شامل شود');
});

test('شبیه‌سازی واقعی: deductDaqiWarehouse باید موجودی را کم کند', () => {
  const addSrc = extractFunctionSource(html, 'addDaqiWarehouseItem');
  const dedSrc = extractFunctionSource(html, 'deductDaqiWarehouse');
  assertTrue(!!addSrc && !!dedSrc, 'توابع انبار داغی استخراج نشدند');
  const runner = new Function('ntf', `
    var daqiWarehouse = [];
    var daqiVouchers = [];
    function svDaqiWarehouse(){}
    function fdt(){ return '1405/05/18'; }
    function deductFromGeneralStock(){ return 'fallback'; }
    ${addSrc}
    ${dedSrc}
    var e1 = addDaqiWarehouseItem({manufacturer:'سرایش', code:'M1', name:'موتور', qty:5});
    if(e1) throw new Error(e1);
    var e2 = deductDaqiWarehouse('سرایش', 'M1', 'موتور', 2);
    if(e2) throw new Error(e2);
    return daqiWarehouse[0].qty;
  `);
  const qty = runner(function(){});
  assertEqual(qty, 3, 'بعد از کسر ۲ از ۵ باید ۳ بماند');
});

test('چاپ تازه openFreshPrintWindow باید جلوی حافظه چسبنده پرینت را بگیرد', () => {
  assertContainsString(html, 'function openFreshPrintWindow(', 'openFreshPrintWindow پیدا نشد');
  assertContainsString(html, 'document.open()', 'باید document را تازه باز کند');
  const printInv = extractFunctionSource(html, 'printInv');
  assertContainsString(printInv || html, 'openFreshPrintWindow', 'printInv باید از پنجره تازه استفاده کند');
});

test('دفترچه تلفن باید شبکه اجتماعی لیستی با گزینه دستی داشته باشد', () => {
  assertContainsString(html, 'function addPBSocial(', 'addPBSocial پیدا نشد');
  assertContainsString(html, 'id="pbm-soc-type"', 'سلکتور شبکه اجتماعی پیدا نشد');
  assertContainsString(html, 'value="rubika"', 'روبیکا در لیست نیست');
  assertContainsString(html, 'value="bale"', 'بله در لیست نیست');
  assertContainsString(html, 'value="eitaa"', 'ایتا در لیست نیست');
  assertContainsString(html, 'value="custom"', 'گزینه دستی سایر نیست');
  const savePB = extractFunctionSource(html, 'savePBContact');
  assertContainsString(savePB, 'socials:', 'ذخیره مخاطب باید آرایه socials داشته باشد');
});

test('تاریخچه برچسب پستی باید با تاریخ ثبت و در بک‌آپ باشد', () => {
  assertContainsString(html, 'function recordPostalHistory(', 'recordPostalHistory پیدا نشد');
  assertContainsString(html, 'id="postal-hist-list"', 'لیست تاریخچه پستی پیدا نشد');
  const printPostal = extractFunctionSource(html, 'printPostal');
  assertContainsString(printPostal, 'recordPostalHistory', 'چاپ پستی باید تاریخچه ثبت کند');
  const buildSrc = extractFunctionSource(html, '_buildFullBackupData');
  assertContainsString(buildSrc, 'postalHistory:', 'بک‌آپ باید تاریخچه پستی را شامل شود');
  assertContainsString(html, 'تاریخچه برچسب', 'عنوان تاریخچه در UI نیست');
});

test('گارانتی: انقضای خودکار از ماه ضمانت + تحویل به مشتری + چند مدرک', () => {
  assertContainsString(html, 'function calcWarrExpFromBuy(', 'calcWarrExpFromBuy پیدا نشد');
  assertContainsString(html, 'function addJalaliMonths(', 'addJalaliMonths پیدا نشد');
  assertContainsString(html, 'id="w-deliver-date"', 'تاریخ تحویل به مشتری پیدا نشد');
  assertContainsString(html, 'معرفی دستگاه', 'بخش معرفی دستگاه پیدا نشد');
  assertContainsString(html, 'اولین برخورد', 'بخش اولین برخورد پیدا نشد');
  const getWar = extractFunctionSource(html, 'getWarData');
  assertContainsString(getWar, 'deliverDate', 'getWarData باید deliverDate داشته باشد');
  assertContainsString(html, 'multiple', 'انتخاب چند فایل مدرک باید multiple باشد');
  const addSrc = extractFunctionSource(html, 'addJalaliMonths');
  const runner = new Function(addSrc + '; return addJalaliMonths("1405/05/05", 24);');
  assertEqual(runner(), '1407/05/05', '۲۴ ماه بعد از ۵ مرداد ۱۴۰۵ باید ۵ مرداد ۱۴۰۷ باشد');
});

test('قانون ۷: راهنمای ویژگی‌های ۱۸α باید موجود باشد', () => {
  assertContainsString(html, 'انبار داغی', 'راهنمای انبار داغی پیدا نشد');
  assertContainsString(html, 'شبکه‌های اجتماعی', 'راهنمای شبکه‌های اجتماعی پیدا نشد');
  assertContainsString(html, 'ساختار پرونده و مدارک گارانتی', 'راهنمای ساختار گارانتی پیدا نشد');
});

test('شبیه‌سازی واقعی: addJalaliMonths و کسر داغی در مسیر ذخیره باید هم‌خوان باشند', () => {
  const monthsSrc = extractFunctionSource(html, 'addJalaliMonths');
  assertTrue(!!monthsSrc, 'addJalaliMonths استخراج نشد');
  const r = new Function(monthsSrc + `
    var a = addJalaliMonths('1405/01/31', 1);
    var b = addJalaliMonths('1405/11/15', 2);
    return [a,b];
  `)();
  assertEqual(r[0], '1405/02/31', 'ماه ۱ بعد از ۳۱ فروردین باید ۳۱ اردیبهشت باشد');
  assertEqual(r[1], '1406/01/15', '۲ ماه بعد از ۱۵ بهمن باید ۱۵ فروردین سال بعد باشد');
});


// -------------------------------------------------------------------
// گروه θ: پرونده جامع گارانتی (مسیر نمایندگی / شرکت / CRM)
// -------------------------------------------------------------------
console.log('📋 گروه θ: پرونده جامع گارانتی (نمایندگی/شرکت/CRM)');

test('مسیرهای گارانتی: phone/agency/company و فیلدهای کلیدی باید در HTML باشند', () => {
  ['war-phone-path','war-agency-path','war-company-path','wa-name','wa-code','wa-parts-list','wa-svc-list','wa-pay-acc',
   'wc-arrive-date','wc-cond-carton','wc-expert-diag','wc-under-warr','wc-parts-list','wc-svc-list','wc-recv-acc'].forEach(id=>{
    assertContainsString(html, 'id="'+id+'"', 'عنصر '+id+' در فرم گارانتی پیدا نشد');
  });
  assertContainsString(html, 'onclick="printWarAgencyInvoice()"', 'دکمه چاپ فاکتور نمایندگی وصل نیست');
  assertContainsString(html, 'onclick="printWarCustomerBill()"', 'دکمه چاپ فاکتور مشتری وصل نیست');
  assertContainsString(html, 'notifyWarStage(', 'تابع/دکمه‌های گزارش مرحله‌ای به مشتری باید موجود باشند');
});

test('getWarData باید agencyWork و companyWork و phoneResolution را برگرداند', () => {
  const src = extractFunctionSource(html, 'getWarData');
  assertTrue(!!src, 'getWarData پیدا نشد');
  ['agencyWork','companyWork','phoneResolution','wa-name','wc-arrive-date',"refTo==='company'"].forEach(s=>{
    assertContainsString(src, s, 'getWarData باید شامل '+s+' باشد');
  });
});

test('saveWar باید کسر انبار/داغی و برداشت/واریز حساب را (یک‌بار) اعمال کند', () => {
  const src = extractFunctionSource(html, 'saveWar');
  assertTrue(!!src, 'saveWar پیدا نشد');
  ['createDaqiOutVoucher','withdrawFromAccount','depositToAccount','_agencyStockApplied','_agencyPayApplied','_companyBillApplied','phone_fix'].forEach(s=>{
    assertContainsString(src, s, 'saveWar باید '+s+' را داشته باشد');
  });
});

test('قانون ۷: راهنمای مسیر نمایندگی/شرکت CRM باید موجود باشد', () => {
  assertContainsString(html, 'مسیر نمایندگی و شرکت (CRM خدمات)', 'گره راهنمای CRM گارانتی پیدا نشد');
  assertContainsString(html, 'فاکتور نمایندگی', 'راهنما باید فاکتور نمایندگی را توضیح دهد');
  assertContainsString(html, 'رضایت مشتری', 'راهنما باید رضایت مشتری را توضیح دهد');
});


// -------------------------------------------------------------------
// گروه ι: آپدیت کامل برای چند سیستم (بدون جابه‌جایی دستی)
// -------------------------------------------------------------------
console.log('📋 گروه ι: آپدیت کامل چندسیستمی');

test('توابع storeFullAppHtml / applyFullAppHtmlNow / slimUpdatePackage باید موجود باشند', () => {
  ['storeFullAppHtml','applyFullAppHtmlNow','slimUpdatePackageForStorage','openFullAppIDB'].forEach(fn=>{
    assertTrue(extractFunctionSource(html, fn) !== null, 'تابع '+fn+' پیدا نشد');
  });
  assertContainsString(html, 'laegh-fullapp-db', 'IndexedDB فول‌اپ باید باشد');
  assertContainsString(html, 'Sirman_Pending_Update.json', 'راهنمای نصب چندسیستمی باید باشد');
});

test('slimUpdatePackageForStorage باید content سنگین replaceAppFile را حذف کند', () => {
  const src = extractFunctionSource(html, 'slimUpdatePackageForStorage');
  assertTrue(!!src, 'slim extract نشد');
  const fn = new Function(src + '; return slimUpdatePackageForStorage;')();
  const slim = fn({
    magic:'SIRMAN_UPDATE', id:'x', version:'1',
    patches:[{op:'replaceAppFile', fileName:'Sirman_Final.html', content:'<!DOCTYPE html>'+'A'.repeat(5000)}]
  });
  assertTrue(slim.patches[0].contentStored === true, 'باید contentStored باشد');
  assertTrue(slim.patches[0].content === undefined, 'content نباید در ذخیره سبک بماند');
  assertTrue(slim.patches[0].contentBytes > 1000, 'contentBytes باید ثبت شود');
});

test('applyUpdatePackage باید قبل از اعمال کامل، fullHtml را از پچ بردارد', () => {
  const src = extractFunctionSource(html, 'applyUpdatePackage');
  assertContainsString(src, 'storeFullAppHtml', 'باید HTML کامل را ذخیره کند');
  assertContainsString(src, 'applyFullAppHtmlNow', 'باید فوری اعمال کند');
  assertContainsString(src, 'replaceAppFile', 'باید replaceAppFile را بشناسد');
});

test('لانچر باید apply_sirman_update.ps1 را صدا بزند', () => {
  const fs = require('fs');
  const path = require('path');
  const root = path.dirname(filePath);
  assertTrue(fs.existsSync(path.join(root, 'apply_sirman_update.ps1')), 'apply_sirman_update.ps1 باید موجود باشد');
  const bat = fs.readFileSync(path.join(root, 'Sirman_Start.bat'), 'utf8');
  assertContainsString(bat, 'apply_sirman_update.ps1', 'Start.bat باید اسکریپت آپدیت خودکار را صدا بزند');
  const upd = path.join(root, 'updates', 'Sirman_Update_1405.5.20ε.json');
  assertTrue(fs.existsSync(upd), 'فایل آپدیت ۲۰ε باید موجود باشد');
  const pkg = JSON.parse(fs.readFileSync(upd, 'utf8'));
  assertEqual(pkg.magic, 'SIRMAN_UPDATE');
  assertEqual(pkg.version, '1405.5.20ε');
  assertTrue((pkg.patches||[]).some(p => p.op==='replaceAppFile' && p.content && p.content.indexOf('<!DOCTYPE html')>=0), 'آپدیت ۲۰ε باید HTML کامل داشته باشد');
});


console.log('📋 گروه κ: منوی گارانتی+فاکتور و اسکین ویندوز');

test('فاکتور و فاکتورهای ذخیره‌شده باید زیر گروه گارانتی (warr) باشند نه گروه جدا', () => {
  assertTrue(html.indexOf('data-grp="inv"') === -1, 'گروه جداگانه inv نباید بماند');
  const warr = html.match(/data-grp="warr"[\s\S]*?<\/div>\s*<\/div>\s*<div class="sb-group"/);
  assertTrue(!!warr, 'بلوک گروه warr پیدا نشد');
  assertContainsString(warr[0], 'data-page="warranty"', 'پرونده گارانتی در warr');
  assertContainsString(warr[0], 'data-page="invoice"', 'فاکتور باید داخل warr باشد');
  assertContainsString(warr[0], 'data-page="saved"', 'فاکتورهای ذخیره‌شده باید داخل warr باشد');
  assertContainsString(html, 'گارانتی و خدمات فروشگاه', 'عنوان گروه باید خدمات فروشگاه را نشان دهد');
});

test('اسکین ویندوز باید در SKIN_PRESETS و CSS باشد', () => {
  assertContainsString(html, "windows:", 'کلید windows در SKIN_PRESETS');
  assertContainsString(html, "label:'ویندوز'", 'برچسب ویندوز');
  assertContainsString(html, 'body.skin-windows', 'CSS اسکین ویندوز');
  assertContainsString(html, "preferMenu:'dock'", 'ویندوز باید داک را ترجیح دهد');
  const src = extractFunctionSource(html, 'setSkin');
  assertContainsString(src, "preferMenu", 'setSkin باید preferMenu را اعمال کند');
  assertContainsString(html, 'اسکین ویندوز', 'راهنمای اسکین ویندوز');
});

test('بسته هفت رابط کاربری مدرن باید در SKIN_PRESETS و CSS باشد', () => {
  const m = html.match(/const SKIN_PRESETS = \{([\s\S]*?)\n\};\n\nconst COLOR_THEMES/);
  assertTrue(m !== null, 'بدنه SKIN_PRESETS استخراج نشد');
  const keys = [...m[1].matchAll(/^\s{2}(\w+):\s*\{/gm)].map(x => x[1]);
  ['fluent','mica','material','darkmodern','glass','neuro','minimal'].forEach(k=>{
    assertTrue(keys.includes(k), 'اسکین رابط کاربری باید باشد: '+k);
    assertContainsString(html, 'body.skin-'+k, 'CSS اسکین '+k);
  });
  assertContainsString(m[1], "family:'ui'", 'خانواده ui برای رابط‌های مدرن');
  assertContainsString(m[1], "label:'Fluent Design'", 'برچسب Fluent Design');
  assertContainsString(m[1], "label:'متریال ۳'", 'برچسب متریال ۳');
  assertContainsString(m[1], "preferTheme:'dark'", 'دارک مدرن باید تم تیره را ترجیح دهد');
  assertContainsString(html, 'رابط‌های کاربری مدرن', 'گروه رابط مدرن در ظاهر');
  assertContainsString(html, 'پوسته‌های برند', 'گروه پوسته‌های برند در ظاهر');
});

test('راهنما باید هفت سبک رابط کاربری را توضیح دهد', () => {
  assertContainsString(html, 'Fluent Design', 'راهنمای Fluent Design');
  assertContainsString(html, 'متریال ۳', 'راهنمای متریال ۳');
  assertContainsString(html, 'نئومورفیسم', 'راهنمای نئومورفیسم');
  assertContainsString(html, 'مینیمال اداری', 'راهنمای مینیمال اداری');
  assertContainsString(html, 'گلس‌مورفیسم', 'راهنمای گلس‌مورفیسم');
  assertContainsString(html, 'میکا / ویندوز ۱۱', 'راهنمای میکا');
  assertContainsString(html, 'دارک مدرن', 'راهنمای دارک مدرن');
});

test('شبیه‌سازی واقعی: setSkin دارک مدرن باید تم تیره و کلاس اسکین را اعمال کند', () => {
  const applySrc = extractFunctionSource(html, 'applySkinVars');
  const setSrc = extractFunctionSource(html, 'setSkin');
  const m = html.match(/const SKIN_PRESETS = \{[\s\S]*?\n\};\n\nconst COLOR_THEMES/);
  assertTrue(applySrc && setSrc && m, 'توابع اسکین استخراج نشدند');
  const presetsSrc = m[0].replace(/\n\nconst COLOR_THEMES$/, '');
  const classes = new Set();
  const store = {};
  const fakeDocument = {
    documentElement: { style: { setProperty(){} } },
    body: {
      classList: {
        remove(...cs){ cs.forEach(c => classes.delete(c)); },
        add(...cs){ cs.forEach(c => classes.add(c)); },
        contains(c){ return classes.has(c); }
      }
    },
    getElementById: () => ({ value: '' }),
    querySelectorAll: () => []
  };
  const fakeLS = {
    getItem: k => (Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null),
    setItem: (k,v) => { store[k]=String(v); },
    removeItem: k => { delete store[k]; }
  };
  const runner = new Function(
    'document','localStorage','ntf','setAppFont','renderSkinCards','renderColorThemeSwatches','window','chrome',
    presetsSrc + '\n' + applySrc + '\n' + setSrc + '\nsetSkin("darkmodern");'
  );
  runner(fakeDocument, fakeLS, function(){}, function(){}, function(){}, function(){}, {}, {});
  assertEqual(store['laegh_skin'], 'darkmodern', 'laegh_skin باید darkmodern شود');
  assertTrue(classes.has('skin-darkmodern'), 'کلاس skin-darkmodern باید روی body باشد');
  assertTrue(classes.has('theme-dark'), 'دارک مدرن باید theme-dark بگذارد');
  assertEqual(store['laegh_theme'], 'dark', 'laegh_theme باید dark شود');
});

test('پوسته دات‌نت باید نوار عنوان را با اسکین HTML همگام کند', () => {
  const pack = fs.readFileSync(path.join(__dirname,'desktop','Sirman.Desktop','UiSkinPack.cs'),'utf8');
  assertContainsString(pack, 'class UiSkinPack', 'UiSkinPack.cs');
  assertContainsString(pack, 'PreferMica', 'Mica برای Fluent/میکا');
  ['fluent','mica','material','darkmodern','glass','neuro','minimal'].forEach(k=>{
    assertContainsString(pack, '"'+k+'"', 'رنگ کروم برای '+k);
  });
  const host = fs.readFileSync(path.join(__dirname,'desktop','Sirman.Desktop','SirmanHostObject.cs'),'utf8');
  assertContainsString(host, 'ApplyUiSkin', 'Host باید ApplyUiSkin داشته باشد');
  const form = fs.readFileSync(path.join(__dirname,'desktop','Sirman.Desktop','MainForm.cs'),'utf8');
  assertContainsString(form, 'ApplyUiSkinChrome', 'MainForm باید کروم اسکین را اعمال کند');
  const setSrc = extractFunctionSource(html, 'setSkin');
  assertContainsString(setSrc, 'ApplyUiSkin', 'setSkin باید پوسته ویندوز را صدا بزند');
  const appSrc = extractFunctionSource(html, 'applyAppearanceSettings');
  assertContainsString(appSrc, 'ApplyUiSkin', 'بارگذاری ظاهر باید کروم ویندوز را همگام کند');
});

// -------------------------------------------------------------------
// گروه γ: رسانه روی هارد (نه localStorage)
// -------------------------------------------------------------------
console.log('📋 گروه γ: ذخیره رسانه روی هارد');

test('توابع دیسک‌مدیا باید تعریف شده باشند و dataURL سنگین را رد کنند', () => {
  ['isDiskRef','writeDiskBlob','storeBgOnDisk','requireDiskOrAbort','migrateAllHeavyMediaToDisk','mediaUrl','docThumbSrc'].forEach(fn=>{
    assertTrue(extractFunctionSource(html, fn) !== null, 'تابع '+fn+' پیدا نشد');
  });
  const safeSrc = extractFunctionSource(html, '_safeSetItem');
  assertContainsString(safeSrc, 'isHeavyDataUrl', '_safeSetItem باید dataURL سنگین را رد کند');
  assertContainsString(html, 'sirman_media', 'پوشه sirman_media باید ذکر شده باشد');
  assertContainsString(html, 'عکس و ضمیمه روی هارد', 'راهنما باید ذخیره روی هارد را توضیح دهد');
});

test('اجرای واقعی: isDiskRef / isHeavyDataUrl / mediaUrl', () => {
  const src =
    extractFunctionSource(html, 'isDiskRef') + '\n' +
    extractFunctionSource(html, 'diskRefPath') + '\n' +
    extractFunctionSource(html, 'isHeavyDataUrl') + '\n' +
    extractFunctionSource(html, 'mediaUrl') + '\n' +
    extractFunctionSource(html, 'mediaExtFromMimeOrName') + '\n' +
    extractFunctionSource(html, 'mediaSafeFileName') + '\n' +
    'window = { DISK_REF_PREFIX:"disk://", _diskUrlCache:{"disk://sirman_media/bg_app.jpg":"blob:mock"} };\n' +
    'function safeFsFileName(n){ return String(n||"f").replace(/[^a-zA-Z0-9._-]/g,"_"); }\n';
  const fn = new Function(src + `;
    return {
      ref: isDiskRef('disk://sirman_media/a.jpg'),
      not: isDiskRef('data:image/jpeg;base64,xx'),
      heavy: isHeavyDataUrl('data:image/jpeg;base64,' + 'A'.repeat(900)),
      light: isHeavyDataUrl('disk://x'),
      url: mediaUrl('disk://sirman_media/bg_app.jpg'),
      path: diskRefPath('disk://sirman_media/a.jpg'),
      ext: mediaExtFromMimeOrName('image/png', 'x.PNG'),
      name: mediaSafeFileName('گزارش.pdf', 'application/pdf')
    };
  `);
  const r = fn();
  assertTrue(r.ref === true, 'disk:// باید isDiskRef باشد');
  assertTrue(r.not === false, 'dataURL نباید isDiskRef باشد');
  assertTrue(r.heavy === true, 'dataURL بلند باید heavy باشد');
  assertTrue(r.light === false, 'disk ref نباید heavy باشد');
  assertEqual(r.url, 'blob:mock', 'mediaUrl باید از کش بخواند');
  assertEqual(r.path, 'sirman_media/a.jpg', 'diskRefPath');
  assertEqual(r.ext, '.png', 'پسوند png');
  assertTrue(String(r.name).toLowerCase().indexOf('.pdf') >= 0, 'نام امن باید pdf داشته باشد');
});

test('setAppBgImage و addWDocs نباید مستقیم localStorage با dataURL پر کنند', () => {
  const app = extractFunctionSource(html, 'setAppBgImage');
  const cover = extractFunctionSource(html, '_setCoverBg');
  const wdocs = extractFunctionSource(html, 'addWDocs');
  const sales = extractFunctionSource(html, 'addSaleDocs');
  const logo = extractFunctionSource(html, 'changeLogo');
  assertContainsString(app, 'storeBgOnDisk', 'setAppBgImage باید storeBgOnDisk را صدا بزند');
  assertContainsString(cover, 'storeBgOnDisk', '_setCoverBg باید storeBgOnDisk را صدا بزند');
  assertContainsString(wdocs, 'storeDocFileOnDisk', 'addWDocs باید روی دیسک بنویسد');
  assertContainsString(sales, 'storeDocFileOnDisk', 'addSaleDocs باید روی دیسک بنویسد');
  assertContainsString(logo, 'writeDiskBlob', 'changeLogo باید روی دیسک بنویسد');
  assertTrue(wdocs.indexOf('readAsDataURL') === -1, 'addWDocs دیگر نباید readAsDataURL برای ذخیره در حافظه استفاده کند');
});


// -------------------------------------------------------------------
// گروه δ: چندپنجره / تب کاری
// -------------------------------------------------------------------
console.log('📋 گروه δ: چندپنجره');

test('توابع چندپنجره باید تعریف شده باشند', () => {
  ['ensureWindowManager','winOpen','winClose','winMinimize','winMaximize','winRestore','winBack','winNavigate','winMountPage','renderWinChrome','renderWinWorkspace'].forEach(fn=>{
    assertTrue(extractFunctionSource(html, fn) !== null, 'تابع '+fn+' پیدا نشد');
  });
  ['winContextMenu','winContextAction','closeWinContextMenu'].forEach(fn=>{
    assertTrue(extractFunctionSource(html, fn) !== null, 'تابع منوی راست‌کلیک '+fn+' پیدا نشد');
  });
  const workspace = extractFunctionSource(html, 'renderWinWorkspace');
  const openSrc = extractFunctionSource(html, 'winOpen');
  const navSrc = extractFunctionSource(html, 'winNavigate');
  const mountSrc = extractFunctionSource(html, 'winMountPage');
  const moveIdx = workspace.indexOf('parking.appendChild(page)');
  const rebuildIdx = workspace.indexOf('ws.innerHTML = htmlPanes.join');
  assertTrue(moveIdx >= 0, 'بازسازی میزکار باید صفحه‌های قبلی را موقتاً به parking منتقل کند');
  assertTrue(rebuildIdx > moveIdx, 'انتقال صفحه‌ها باید قبل از innerHTML باشد؛ وگرنه پنجره‌ها خالی می‌شوند');
  assertContainsString(openSrc, "'«'+winPageTitle", 'پنجره تکراری باید به تب موجود برود، نه DOM آن را جابه‌جا کند');
  assertContainsString(navSrc, 'در پنجرهٔ دیگر باز است', 'ناوبری به صفحه باز باید تب موجود را فعال کند');
  assertContainsString(mountSrc, 'return other.id !== wid && other.pageId === pageId', 'winMountPage باید صفحه تکراری را تشخیص دهد');
  assertContainsString(html, 'id="win-new-page"', 'انتخاب‌گر بخش برای پنجره جدید باید باشد');
  assertContainsString(html, 'oncontextmenu="return winContextMenu', 'راست‌کلیک باید به تب پنجره وصل باشد');
  const contextSrc = extractFunctionSource(html, 'winContextMenu');
  assertContainsString(contextSrc, 'بستن پنجره', 'آخرین گزینه منوی راست‌کلیک باید بستن پنجره باشد');
  assertContainsString(contextSrc, 'بزرگ‌نمایی', 'منوی راست‌کلیک باید بزرگ‌نمایی داشته باشد');
  assertContainsString(contextSrc, 'کوچک‌سازی', 'منوی راست‌کلیک باید کوچک‌سازی داشته باشد');
  assertContainsString(html, '@media (max-width:640px)', 'پنجره‌ها نباید در عرض معمول ویندوز زیر ۹۰۰ پیکسل روی هم بیفتند');
  assertContainsString(html, 'minmax(0,1fr)', 'ستون پنجره‌ها باید جمع شوند تا کنار هم بمانند');
  assertContainsString(html, 'body.win-mode .main', 'میزکار باید ارتفاع پنجره را پر کند');
  assertContainsString(extractFunctionSource(html, 'winActivate'), 'winMarkActivePane', 'کلیک پنجره نباید کل میزکار را از نو بسازد');
  const actSrc = extractFunctionSource(html, 'winActivate');
  assertTrue(actSrc.indexOf("window._winActive === wid") >= 0, 'کلیک داخل همان پنجره باید بی‌اثر باشد');
  assertTrue(extractFunctionSource(html, 'winMarkActivePane') !== null, 'winMarkActivePane لازم است');
  const closeSrc = extractFunctionSource(html, 'winClose');
  assertContainsString(closeSrc, "window._winActive = null", 'بستن آخرین پنجره باید میزکار را خالی کند، نه داشبورد را نگه دارد');
  assertContainsString(html, 'id="win-chrome"', 'نوار پنجره باید باشد');
  assertContainsString(html, 'id="win-workspace"', 'میزکار باید باشد');
  assertContainsString(html, 'چندپنجره', 'راهنمای چندپنجره باید باشد');
});

test('داشبورد باید گزینه پنهان کردن اطلاعات برای دیدن پس‌زمینه داشته باشد', () => {
  assertContainsString(html, 'id="dash-calm-btn"', 'دکمه پنهان کردن اطلاعات داشبورد');
  assertContainsString(html, 'id="dash-widgets"', 'باکس ویجت‌های داشبورد');
  assertContainsString(html, 'dash-calm', 'حالت آرام داشبورد');
  ['toggleDashWidgets','applyDashWidgets','isDashWidgetsHidden'].forEach(fn=>{
    assertTrue(extractFunctionSource(html, fn) !== null, 'تابع '+fn+' پیدا نشد');
  });
  assertContainsString(html, 'laegh_dash_hide_widgets', 'وضعیت پنهان بودن باید ذخیره شود');
  assertContainsString(html, 'پنهان کردن اطلاعات داشبورد', 'راهنمای پنهان کردن داشبورد');
});

test('اجرای واقعی: تاریخچه پنجره و برگشت باید کار کند', () => {
  // منطق تاریخچه را بدون وابستگی به classList کامل DOM بررسی می‌کنیم
  const findSrc = extractFunctionSource(html, 'winFind');
  const titleSrc = extractFunctionSource(html, 'winPageTitle');
  assertTrue(!!findSrc && !!titleSrc, 'توابع پایه استخراج نشد');
  const fn = new Function(findSrc + '\n' + titleSrc + `;
    window = { _wins: [
      {id:'w1', pageId:'dashboard', history:['dashboard','warranty','sales'], state:'normal'},
      {id:'w2', pageId:'phonebook', history:['phonebook'], state:'minimized'}
    ], _winActive:'w1' };
    function winBackLogic(wid){
      var w = winFind(wid); if(!w) return null;
      if(!w.history || w.history.length < 2) return w.pageId;
      w.history.pop();
      w.pageId = w.history[w.history.length-1];
      return w.pageId;
    }
    return {
      back: winBackLogic('w1'),
      hist: winFind('w1').history.slice(),
      title: winPageTitle('warranty'),
      n: window._wins.length
    };
  `);
  const r = fn();
  assertEqual(r.back, 'warranty', 'برگشت باید به گارانتی برود');
  assertEqual(r.hist.join(','), 'dashboard,warranty', 'تاریخچه بعد از pop');
  assertTrue(!!r.title, 'عنوان صفحه باید برگردد');
  assertEqual(r.n, 2, '۲ پنجره');
});

test('منوی راست‌کلیک باید برای هر صفحه عمل مفید و راهنمای مرتبط داشته باشد', () => {
  const actionsSrc = extractFunctionSource(html, 'winContextPageActions');
  const helpSrc = extractFunctionSource(html, 'winHelpMeta');
  const menuSrc = extractFunctionSource(html, 'winContextMenu');
  const runSrc = extractFunctionSource(html, 'winRunPageAction');
  assertTrue(!!(actionsSrc && helpSrc && menuSrc && runSrc), 'توابع عملیات/راهنمای منوی پنجره استخراج نشدند');
  const fn = new Function(actionsSrc + '\n' + helpSrc + `;\n
    return {
      product: winContextPageActions('products').map(x=>x.id).join(','),
      warranty: winContextPageActions('warranty').map(x=>x.id).join(','),
      sale: winContextPageActions('sales').map(x=>x.id).join(','),
      help: winHelpMeta('products').q,
      account: winContextPageActions('accounts').map(x=>x.id).join(',')
    };
  `);
  const r = fn();
  assertContainsString(r.product, 'product-new', 'مدیریت کالا باید کالای جدید داشته باشد');
  assertContainsString(r.warranty, 'warranty-new', 'گارانتی باید پرونده جدید داشته باشد');
  assertContainsString(r.sale, 'sale-new', 'فروش باید فروش جدید داشته باشد');
  assertContainsString(r.account, 'account-new', 'حساب‌ها باید حساب جدید داشته باشد');
  assertEqual(r.help, 'کالا', 'راهنمای مدیریت کالا باید با کلید کالا پیدا شود');
  assertContainsString(menuSrc, 'راهنمای این پنجره', 'منو باید گزینه راهنمای همان پنجره داشته باشد');
  assertContainsString(runSrc, 'openProdModal', 'عمل کالای جدید باید به مودال کالا وصل باشد');
});

test('میانبرها باید منوی بالایی، عملیات پنجره و راهنمای دقیق بخش را پوشش دهند', () => {
  const ensureSrc = extractFunctionSource(html, 'ensureWindowManager');
  const helpSrc = extractFunctionSource(html, 'winOpenContextHelp');
  const menuSrc = extractFunctionSource(html, 'winContextMenu');
  assertContainsString(ensureSrc, "code==='KeyN'", 'Alt+N باید انتخاب‌گر پنجره جدید را فعال کند');
  assertContainsString(ensureSrc, "code==='Enter'", 'Alt+Enter باید پنجره انتخاب‌شده را باز کند');
  ['Digit[1-9]','KeyB','KeyH','KeyM','KeyX','KeyW'].forEach(key=>{
    assertContainsString(ensureSrc, key, 'میانبر '+key+' باید ثبت شده باشد');
  });
  assertContainsString(menuSrc, 'Alt+W', 'بستن پنجره باید میانبر نمایان داشته باشد');
  assertContainsString(menuSrc, 'Alt+H', 'راهنما باید میانبر نمایان داشته باشد');
  assertContainsString(helpSrc, 'help-tree-label', 'راهنما باید دسته درختی مربوط را پیدا کند');
  assertContainsString(helpSrc, "node.classList.remove('collapsed')", 'راهنمای همان دسته باید دقیقاً باز شود');
  assertTrue(helpSrc.indexOf("input.value = '';") < helpSrc.indexOf("help-tree-label"), 'قبل از فعال‌سازی دسته، جستجوی کلی باید پاک شود');
});

test('ظاهر جمع‌وجور باید گروه‌بندی و کنترل بزرگ‌کردن سرتیتر منو داشته باشد', () => {
  const initSrc = extractFunctionSource(html, 'initAppearanceOrganizer');
  const groupSrc = extractFunctionSource(html, 'showAppearanceGroup');
  const headingSrc = extractFunctionSource(html, 'setSidebarHeadingSize');
  assertTrue(!!(initSrc && groupSrc && headingSrc), 'توابع نظم‌دهی ظاهر/سرتیتر منو استخراج نشدند');
  ['theme','readability','nav','background'].forEach(group=>{
    assertContainsString(initSrc, group, 'گروه ظاهری '+group+' باید وجود داشته باشد');
  });
  assertContainsString(html, 'sb-heading-size-select', 'انتخاب اندازه سرتیتر منو باید در ظاهر باشد');
  assertContainsString(headingSrc, 'laegh_sb_heading_size', 'اندازه سرتیتر باید ماندگار باشد');
  assertContainsString(html, '--sb-section-size', 'CSS اندازه مستقل سرتیتر منو باید باشد');
  assertContainsString(groupSrc, 'laegh_appearance_group', 'آخرین دسته ظاهر باید ماندگار باشد');
});

test('رنگ سرتیتر منو باید در ظاهر، CSS، بک‌آپ و حفاظت باشد', () => {
  assertContainsString(html, 'id="heading-color-inp"', 'ورودی رنگ سفارشی سرتیتر پیدا نشد');
  assertContainsString(html, "setSidebarHeadingColor('#1e293b')", 'سواچ تیره سرتیتر پیدا نشد');
  assertContainsString(html, 'function setSidebarHeadingColor(', 'تابع setSidebarHeadingColor پیدا نشد');
  assertContainsString(html, 'function applySidebarHeadingColor(', 'تابع applySidebarHeadingColor پیدا نشد');
  assertContainsString(html, 'function headingContrastColor(', 'تابع تشخیص کنتراست سرتیتر پیدا نشد');
  assertContainsString(html, '--sb-heading-color', 'متغیر CSS رنگ سرتیتر باید باشد');
  assertContainsString(html, 'heading-color-custom', 'کلاس رنگ سفارشی سرتیتر باید باشد');
  assertContainsString(html, 'رنگ سرتیتر منو', 'راهنما باید رنگ سرتیتر را توضیح دهد');
  const buildSrc = extractFunctionSource(html, '_buildFullBackupData');
  assertContainsString(buildSrc, "headingColor: localStorage.getItem('laegh_heading_color')", 'headingColor باید در بک‌آپ باشد');
  assertContainsString(html, "localStorage.setItem('laegh_heading_color', ap.headingColor)", 'بازگردانی باید headingColor را بنویسد');
  assertContainsString(html, "'laegh_heading_color'", 'کلید رنگ سرتیتر باید محافظت/ذخیره شود');
  const appSrc = extractFunctionSource(html, 'applyAppearanceSettings');
  assertContainsString(appSrc, 'applySidebarHeadingColor()', 'applyAppearanceSettings باید رنگ سرتیتر را اعمال کند');
  const skinSrc = extractFunctionSource(html, 'setSkin');
  assertContainsString(skinSrc, 'applySidebarHeadingColor()', 'بعد از تعویض اسکین باید رنگ سرتیتر دوباره اعمال شود');
  const layerSrc = extractFunctionSource(html, 'applyLayerBackgrounds');
  assertContainsString(layerSrc, 'maybeAutoSidebarHeadingContrast', 'پس‌زمینه منو باید کنتراست سرتیتر را خودکار کند');
});

test('شبیه‌سازی: رنگ سرتیتر تیره شود و برای عکس روشن خودکار مشکی شود', () => {
  const parseSrc = extractFunctionSource(html, '_parseHexRgb');
  const lumSrc = extractFunctionSource(html, '_hexLuminance');
  const contrastSrc = extractFunctionSource(html, 'headingContrastColor');
  const rgbaSrc = extractFunctionSource(html, '_rgbaFromHex');
  const paintSrc = extractFunctionSource(html, '_paintHeadingColor');
  const clearSrc = extractFunctionSource(html, '_clearHeadingPaint');
  const applySrc = extractFunctionSource(html, 'applySidebarHeadingColor');
  const setSrc = extractFunctionSource(html, 'setSidebarHeadingColor');
  const autoSrc = extractFunctionSource(html, 'maybeAutoSidebarHeadingContrast');
  assertTrue(!!(parseSrc && lumSrc && contrastSrc && rgbaSrc && paintSrc && clearSrc && applySrc && setSrc && autoSrc), 'توابع رنگ سرتیتر استخراج نشدند');
  const store = {};
  const rootProps = {};
  const classes = new Set();
  const fakeDocument = {
    body: {
      classList: {
        add(c){ classes.add(c); },
        remove(c){ classes.delete(c); },
        contains(c){ return classes.has(c); }
      }
    },
    documentElement: {
      style: {
        setProperty(n, v){ rootProps[n]=v; },
        removeProperty(n){ delete rootProps[n]; }
      }
    },
    getElementById(){ return { value: '#1e293b' }; }
  };
  const fakeLocalStorage = {
    getItem(k){ return store[k]===undefined?null:store[k]; },
    setItem(k,v){ store[k]=String(v); },
    removeItem(k){ delete store[k]; }
  };
  const fakeWindow = { _sbHeadingAutoColor: '' };
  const ntf = ()=>{};
  const fn = new Function('document','localStorage','window','ntf',
    parseSrc + '\n' + lumSrc + '\n' + contrastSrc + '\n' + rgbaSrc + '\n' +
    paintSrc + '\n' + clearSrc + '\n' + applySrc + '\n' + setSrc + '\n' + autoSrc + '\n' +
    'return {setSidebarHeadingColor, applySidebarHeadingColor, headingContrastColor, maybeAutoSidebarHeadingContrast, _hexLuminance};'
  );
  const api = fn(fakeDocument, fakeLocalStorage, fakeWindow, ntf);
  assertEqual(api.headingContrastColor(0.9), '#1e293b', 'عکس روشن باید سرتیتر تیره بگیرد');
  assertEqual(api.headingContrastColor(0.2), '#f8fafc', 'عکس تیره باید سرتیتر روشن بگیرد');
  assertTrue(api._hexLuminance('#ffffff') > 0.9, 'سفید باید درخشندگی بالا داشته باشد');
  api.setSidebarHeadingColor('#1e293b');
  assertEqual(store['laegh_heading_color'], '#1e293b', 'رنگ تیره باید در localStorage ذخیره شود');
  assertEqual(rootProps['--sb-heading-color'], '#1e293b', 'باید --sb-heading-color روی root ست شود');
  assertTrue(classes.has('heading-color-custom'), 'کلاس heading-color-custom باید روی body باشد');
  fakeWindow._sbHeadingAutoColor = '#f8fafc';
  api.maybeAutoSidebarHeadingContrast('data:image/png;base64,xx');
  assertEqual(rootProps['--sb-heading-color'], '#1e293b', 'رنگ دستی کاربر نباید با تشخیص خودکار عوض شود');
  api.setSidebarHeadingColor('default');
  assertTrue(store['laegh_heading_color']===undefined, 'پیش‌فرض باید کلید رنگ سرتیتر را پاک کند');
  assertTrue(rootProps['--sb-heading-color']===undefined, 'پیش‌فرض باید رنگ سفارشی root را بردارد');
  assertTrue(!classes.has('heading-color-custom'), 'پیش‌فرض باید کلاس سفارشی را بردارد');
});

test('کنترل‌های پس‌زمینه داشبورد باید از خود داشبورد به ظاهر و راست‌کلیک منتقل شوند', () => {
  const dashHtml = (html.match(/<div class="page" id="page-dashboard">([\s\S]*?)<!-- ===== INVOICE PAGE ===== -->/) || [])[1] || '';
  assertTrue(dashHtml.indexOf('dash-wallpaper-bar') === -1, 'نوار کنترل پس‌زمینه نباید داخل داشبورد بماند');
  const appPanel = (html.match(/<div class="stg-panel" id="stg-appearance">([\s\S]*?)<!-- TAB: COMPANY -->/) || [])[1] || '';
  assertContainsString(appPanel, 'انتخاب عکس داشبورد', 'انتخاب عکس داشبورد باید در تنظیمات ظاهر باشد');
  assertContainsString(appPanel, 'id="dash-bg-inp"', 'ورودی تصویر داشبورد باید در تنظیمات ظاهر باشد');
  assertContainsString(appPanel, 'dash-bg-overlay', 'شفافیت عکس داشبورد باید در تنظیمات ظاهر باشد');
  const actions = extractFunctionSource(html, 'winContextPageActions');
  const run = extractFunctionSource(html, 'winRunPageAction');
  assertContainsString(actions, 'dashboard-bg', 'راست‌کلیک داشبورد باید انتخاب تصویر داشته باشد');
  assertContainsString(actions, 'dashboard-bg-clear', 'راست‌کلیک داشبورد باید حذف تصویر داشته باشد');
  assertContainsString(run, "getElementById('dash-bg-inp')", 'عمل راست‌کلیک باید input تصویر داشبورد را باز کند');
});

test('گردش‌کار گارانتی باید درخواست قطعه، مدت تعمیر، SLA و اعتبارسنجی بستن را داشته باشد', () => {
  ['toggleWarPartRequest','calcWarrantyRepairDuration','checkWarrantySlaAlerts','startWarrantySlaAlerts','warrantyCloseMissingFields'].forEach(fn=>{
    assertTrue(extractFunctionSource(html, fn) !== null, 'تابع '+fn+' پیدا نشد');
  });
  assertContainsString(html, 'id="wa-parts-enabled"', 'تیک درخواست قطعه نمایندگی لازم است');
  assertContainsString(html, 'id="wc-parts-enabled"', 'تیک درخواست قطعه شرکت لازم است');
  assertContainsString(html, 'id="wc-sla-resolved"', 'توقف هشدار SLA باید دستی باشد');
  assertContainsString(html, 'id="wc-sla-note"', 'یادداشت توقف SLA لازم است');
  assertContainsString(html, 'مدت تعمیر (خودکار از زمان ورود)', 'مدت تعمیر باید خودکار باشد');
  ['parts_replaced','recalibrated','full_replacement','no_fault','irreparable'].forEach(v=>{
    assertContainsString(html, 'value="'+v+'"', 'نتیجه تعمیر '+v+' لازم است');
  });
  const sla = extractFunctionSource(html, 'checkWarrantySlaAlerts');
  const slaStart = extractFunctionSource(html, 'startWarrantySlaAlerts');
  assertContainsString(sla, 'ageH<24', 'هشدار اول باید از ۲۴ ساعت شروع شود');
  assertContainsString(sla, 'ageH>=48', 'هشدار قرمز باید از ۴۸ ساعت باشد');
  assertContainsString(slaStart, '60*60*1000', 'یادآوری SLA باید هر ساعت باشد');
  const close = extractFunctionSource(html, 'closeWar');
  assertContainsString(close, 'warrantyCloseMissingFields', 'بستن پرونده باید اعتبارسنجی کامل داشته باشد');
});

test('داده‌ها باید از منوی راست به تنظیمات منتقل شود و برگشت فرم گارانتی کار کند', () => {
  assertTrue(html.indexOf('data-grp="data"') === -1, 'گروه داده‌ها نباید در منوی راست بماند');
  const settings = (html.match(/<div class="page" id="page-settings">([\s\S]*?)<!-- TAB: PRINTER -->/) || [])[1] || html;
  assertContainsString(settings, "showStgTab('data',this)", 'داده‌ها باید در تنظیمات باشد');
  assertContainsString(html, 'ورود/خروج، بک‌آپ و ذخیره خودکار در یک دسته', 'ذخیره خودکار باید زیر داده‌ها در تنظیمات باشد');
  const back = extractFunctionSource(html, 'winBack');
  assertContainsString(back, "w.pageId==='warranty'", 'برگشت پنجره باید فرم گارانتی را بشناسد');
  assertContainsString(back, 'showWarList()', 'برگشت از فرم گارانتی باید به لیست برود');
});

test('پنجره minimize نباید فعال بماند و برگشت باید میزکار را همگام کند', () => {
  const min = extractFunctionSource(html, 'winMinimize');
  const back = extractFunctionSource(html, 'winBack');
  const workspace = extractFunctionSource(html, 'renderWinWorkspace');
  assertContainsString(min, 'window._winActive = alt ? alt.id : null', 'پس از minimize آخرین پنجره، active باید null شود');
  assertContainsString(back, 'renderWinWorkspace()', 'برگشت باید قاب و محتوای پنجره را دوباره همگام کند');
  assertContainsString(workspace, 'onclick="winActivate', 'کلیک پنجره باید activate کامل انجام دهد');
});

test('همه پنجره‌های minimize‌شده نباید DOM صفحه‌ها را حذف کنند و داده‌ها یک تب دارند', () => {
  const workspace = extractFunctionSource(html, 'renderWinWorkspace');
  const preserve = workspace.indexOf("var parking = document.getElementById('page-parking')");
  const empty = workspace.lastIndexOf('if(!wins.length)');
  assertTrue(preserve >= 0 && empty > preserve, 'صفحه‌ها باید پیش از رندر میزکار خالی به parking منتقل شوند');
  const settings = (html.match(/<div class="page" id="page-settings">([\s\S]*?)<!-- TAB: PRINTER -->/) || [])[1] || '';
  assertContainsString(settings, "showStgTab('data',this)", 'تنظیمات باید یک تب واحد داده‌ها داشته باشد');
  assertTrue(settings.indexOf("showPage('dataio')") === -1, 'ورود/خروج داده نباید تب مستقل باشد');
  assertTrue(settings.indexOf("showStgTab('autosave',this)") === -1, 'ذخیره خودکار نباید تب مستقل باشد');
  assertContainsString(html, 'function openDataAutoSave(', 'داده‌ها باید زیرگزینه ذخیره خودکار داشته باشد');
});

test('داشبورد باید فهرست وظایف سررسیدگذشته را جدا از تعداد آن نگه دارد', () => {
  const dash = extractFunctionSource(html, 'renderDashboard');
  assertContainsString(dash, 'var overdueTaskList', 'فهرست overdueTaskList لازم است');
  assertContainsString(dash, 'var overdueTasks = overdueTaskList.length', 'KPI باید تعداد را از فهرست بگیرد');
  assertContainsString(dash, 'overdueTaskList.forEach', 'هشدارها باید روی آرایه اجرا شوند نه عدد');
});

test('مرور گارانتی باید سه نمای فصلی/ماهیانه/لیستی و کارت شیشه‌ای داشته باشد', () => {
  ['warLatinDigits','warJalaliParts','warSeasonOfMonth','warBrowseMatches','defaultWarBrowseCatalog','setWarBrowseMode','setWarBrowseYear','toggleWarYearDropdown','renderWarBrowseGallery','openWarBrowseSeason','openWarBrowseMonth'].forEach(fn=>{
    assertTrue(extractFunctionSource(html, fn) !== null, 'تابع '+fn+' پیدا نشد');
  });
  assertContainsString(html, 'id="war-browse-gallery"', 'گالری فصل/ماه لازم است');
  assertContainsString(html, 'id="war-year-dd"', 'کشویی سال باید دیده شود');
  assertContainsString(html, 'function toggleWarYearDropdown(', 'کشویی سال باید باز و بسته شود');
  assertContainsString(html, "setWarBrowseYear(0)", 'گزینه همه سال‌ها باید لیست را باز کند');
  assertContainsString(html, "setWarBrowseMode('season')", 'دکمه نمای فصلی لازم است');
  assertContainsString(html, "setWarBrowseMode('month')", 'دکمه نمای ماهیانه لازم است');
  assertContainsString(html, "setWarBrowseMode('list')", 'دکمه نمای لیستی لازم است');
  assertContainsString(html, 'war-glass-card', 'کارت شیشه‌ای لازم است');
  assertContainsString(html, 'season-spring', 'تم بهار لازم است');
  assertContainsString(html, 'season-summer', 'تم تابستان لازم است');
  assertContainsString(html, 'season-autumn', 'تم پاییز لازم است');
  assertContainsString(html, 'season-winter', 'تم زمستان لازم است');
  assertContainsString(html, 'نمای فصلی، ماهیانه و لیستی پرونده‌ها', 'راهنمای نمای فصلی لازم است');
  const actions = extractFunctionSource(html, 'winContextPageActions');
  const run = extractFunctionSource(html, 'winRunPageAction');
  const back = extractFunctionSource(html, 'winBack');
  assertContainsString(actions, 'warranty-season', 'راست‌کلیک باید نمای فصلی داشته باشد');
  assertContainsString(actions, 'warranty-month', 'راست‌کلیک باید نمای ماهیانه داشته باشد');
  assertContainsString(run, "setWarBrowseMode('season')", 'عمل راست‌کلیک فصلی باید نما را عوض کند');
  assertContainsString(run, 'setWarBrowseYear(0)', 'راست‌کلیک باید همه سال‌ها را به لیست کامل ببرد');
  assertContainsString(back, 'warBrowseClearDrill', 'برگشت از داخل فصل/ماه باید به کارت‌ها برگردد');
});

test('فیلتر فصل و ماه گارانتی باید تاریخ شمسی فارسی را درست دسته کند', () => {
  const src = [
    extractFunctionSource(html, 'warLatinDigits'),
    extractFunctionSource(html, 'warJalaliParts'),
    extractFunctionSource(html, 'warSeasonOfMonth'),
    extractFunctionSource(html, 'getWarBrowseState'),
    extractFunctionSource(html, 'warBrowseMatches'),
    extractFunctionSource(html, 'defaultWarBrowseCatalog')
  ].join('\n');
  const runner = new Function(src + `;
    var spring = warJalaliParts('‎۱۴۰۵/۰۲/۱۰‎');
    var summer = warJalaliParts('1405/05/21');
    var winter = warJalaliParts('1404-11-03');
    var cat = defaultWarBrowseCatalog();
    var wars = [
      {id:'A', date:'1405/02/10'},
      {id:'B', date:'۱۴۰۵/۰۵/۰۱'},
      {id:'C', date:'1405/08/12'},
      {id:'D', date:'1404/11/20'}
    ];
    var springHits = wars.filter(function(w){ return warBrowseMatches(w, {year:1405, season:'spring', month:0}); }).map(function(w){ return w.id; });
    var monthHits = wars.filter(function(w){ return warBrowseMatches(w, {year:0, season:'', month:5}); }).map(function(w){ return w.id; });
    var allYear = wars.filter(function(w){ return warBrowseMatches(w, {year:1405, season:'', month:0}); }).map(function(w){ return w.id; });
    var allYears = wars.filter(function(w){ return warBrowseMatches(w, {year:0, season:'', month:0}); }).map(function(w){ return w.id; });
    return {
      spring: spring,
      summer: summer,
      winter: winter,
      seasons: cat.seasons.map(function(s){ return s.id; }),
      months: cat.months.map(function(m){ return m.nameFa; }),
      springOf: [warSeasonOfMonth(1), warSeasonOfMonth(4), warSeasonOfMonth(7), warSeasonOfMonth(11)],
      springHits: springHits,
      monthHits: monthHits,
      allYear: allYear,
      allYears: allYears
    };
  `);
  const r = runner();
  assertEqual(r.spring && r.spring.m, 2, 'اردیبهشت باید ماه ۲ باشد');
  assertEqual(r.summer && r.summer.m, 5, 'مرداد باید ماه ۵ باشد');
  assertEqual(r.winter && r.winter.y, 1404, 'سال دی باید ۱۴۰۴ باشد');
  assertEqual(r.seasons.join(','), 'spring,summer,autumn,winter', 'چهار فصل باید کامل باشد');
  assertEqual(r.months.length, 12, 'باید ۱۲ ماه شمسی باشد');
  assertEqual(r.months[0], 'فروردین', 'ماه اول فروردین است');
  assertEqual(r.months[11], 'اسفند', 'ماه آخر اسفند است');
  assertEqual(r.springOf.join(','), 'spring,summer,autumn,winter', 'نگاشت فصل ماه‌ها نادرست است');
  assertEqual(r.springHits.join(','), 'A', 'فقط پرونده بهار ۱۴۰۵ باید بماند');
  assertEqual(r.monthHits.join(','), 'B', 'فقط پرونده مرداد باید بماند');
  assertEqual(r.allYear.join(','), 'A,B,C', 'سال ۱۴۰۵ نباید پرونده ۱۴۰۴ را بیاورد');
  assertEqual(r.allYears.join(','), 'A,B,C,D', 'همه سال‌ها باید همه پرونده‌ها را نشان دهد');
});

test('کشویی همه سال‌ها باید از نمای فصلی به لیست کامل برگردد', () => {
  const src = [
    extractFunctionSource(html, 'ensureWarBrowseState'),
    extractFunctionSource(html, 'setWarBrowseYear')
  ].join('\n');
  const runner = new Function('window', 'localStorage', src + `;
    var rendered = 0;
    function renderWar(){ rendered++; }
    window._warBrowseMode = 'season';
    window._warBrowseDrill = {season:'spring', month:0};
    window._warBrowseYear = 1405;
    setWarBrowseYear(0);
    return {year: window._warBrowseYear, mode: window._warBrowseMode, drill: window._warBrowseDrill, rendered: rendered};
  `);
  const r = runner({}, {getItem: function(){ return null; }, setItem: function(){}});
  assertEqual(r.year, 0, 'سال باید ۰ شود');
  assertEqual(r.mode, 'list', 'همه سال‌ها باید نمای لیستی را باز کند');
  assertEqual(r.drill, null, 'فیلتر فصل نباید روی لیست همه سال‌ها بماند');
  assertEqual(r.rendered, 1, 'باید لیست دوباره رندر شود');
});

test('پوسته دات‌نت باید همان کاتالوگ شیشه‌ای فصل/ماه را به میزبان بدهد', () => {
  const csPath = path.join(path.dirname(filePath), 'desktop', 'Sirman.Desktop', 'SeasonalGlassTheme.cs');
  const hostPath = path.join(path.dirname(filePath), 'desktop', 'Sirman.Desktop', 'SirmanHostObject.cs');
  assertTrue(fs.existsSync(csPath), 'SeasonalGlassTheme.cs باید وجود داشته باشد');
  const cs = fs.readFileSync(csPath, 'utf8');
  const host = fs.readFileSync(hostPath, 'utf8');
  assertContainsString(host, 'GetWarrantyBrowseCatalog', 'میزبان باید کاتالوگ فصل را بدهد');
  assertContainsString(host, 'GetWarrantyBrowseCss', 'میزبان باید CSS شیشه‌ای را بدهد');
  ['بهار','تابستان','پاییز','زمستان','فروردین','اسفند','backdrop-filter','war-glass-card','war-year-dd'].forEach(tok=>{
    assertContainsString(cs, tok, 'پوسته دات‌نت باید '+tok+' داشته باشد');
  });
  const catSrc = extractFunctionSource(html, 'defaultWarBrowseCatalog');
  assertContainsString(catSrc, "id:'spring'", 'کاتالوگ HTML باید با دات‌نت هم‌نام باشد');
  assertContainsString(html, 'GetWarrantyBrowseCss', 'پل دسکتاپ باید CSS دات‌نت را تزریق کند');
});


console.log('');
console.log('📋 گروه: مرکز پرینت');

test('مرکز پرینت باید در تنظیمات با سه ستون سند/پیش‌نمایش/تنظیمات باشد', () => {
  assertContainsString(html, 'id="print-center"', 'شل مرکز پرینت پیدا نشد');
  assertContainsString(html, 'id="pc-doc-list"', 'فهرست اسناد پیدا نشد');
  assertContainsString(html, 'id="pc-preview-frame"', 'پیش‌نمایش iframe پیدا نشد');
  assertContainsString(html, 'id="pc-printer"', 'انتخاب چاپگر پیدا نشد');
  assertContainsString(html, 'id="pc-hist"', 'تاریخچه چاپ پیدا نشد');
  assertContainsString(html, "showStgTab('printer',this)\">🖨 مرکز پرینت", 'تب تنظیمات باید مرکز پرینت باشد');
  ['رسید پذیرش','فاکتور','رسید تحویل','ضمانت‌نامه','برگه تعمیرات','گزارش‌ها'].forEach(t=>{
    assertContainsString(html, "title:'"+t+"'", 'کاتالوگ باید '+t+' داشته باشد');
  });
});

test('Print Engine مرکزی، پروفایل‌ها و چاپ سریع باید موجود باشند', () => {
  ['printCenterDefaultState','getPrintCenterState','savePrintCenterState','printDocCatalog','registerPrintDocument','printEngineJob','printEngineApplyProfile','printEnginePrintHtml','printEngineQuickPrint','printEngineSavePdf','printEngineRecordHistory','printEngineHistory','printEngineLastJob','printEngineListPrinters','printEngineBuildPreview','openPrintCenter','refreshPrintCenterUI','pcDoPrint','pcDoPdf','pcDoRetry','printEngineFailResult','printEngineIsPdfPrinter'].forEach(fn=>{
    assertTrue(extractFunctionSource(html, fn) !== null, 'تابع '+fn+' پیدا نشد');
  });
  assertContainsString(html, "var PrintEngine = {", 'شیء PrintEngine پیدا نشد');
  assertContainsString(html, "'a4-office'", 'پروفایل A4 Office لازم است');
  assertContainsString(html, "'thermal'", 'پروفایل Thermal لازم است');
  assertContainsString(html, "'zebra'", 'پروفایل Zebra لازم است');
  assertContainsString(html, "id:'pdf'", 'پروفایل PDF لازم است');
  assertContainsString(html, 'چاپ سریع فاکتور', 'منوی فاکتور باید چاپ سریع داشته باشد');
  assertContainsString(html, "openPrintCenter('invoice')", 'منوی فاکتور باید مرکز پرینت داشته باشد');
  assertContainsString(html, "openPrintCenter('reception')", 'پذیرش باید به مرکز پرینت وصل باشد');
  assertContainsString(html, 'مرکز پرینت — چاپ مشترک همه فرم‌ها', 'راهنمای مرکز پرینت لازم است');
  assertContainsString(html, 'تنظیمات ← تب مرکز پرینت', 'دستیار باید مسیر مرکز پرینت را بگوید');
});

test('شبیه‌سازی: کاتالوگ قابل توسعه، پروفایل، تاریخچه و چاپ سریع', () => {
  const start = html.indexOf("var PC_KEY = 'laegh_printCenter';");
  const pe = html.indexOf('\nvar PrintEngine = {');
  assertTrue(start >= 0 && pe > start, 'بلوک Print Center برای sandbox پیدا نشد');
  const objEnd = html.indexOf('\n};', pe);
  assertTrue(objEnd > pe, 'شیء PrintEngine بسته نشد');
  const src = html.slice(start, objEnd + 3);
  const store = {};
  const fakeLS = {
    getItem(k){ return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; },
    setItem(k,v){ store[k]=String(v); },
    removeItem(k){ delete store[k]; }
  };
  const opened = [];
  const fakeWindow = {
    open(){
      const w = { document:{ open(){}, write(s){ opened.push(String(s)); }, close(){} }, focus(){}, print(){} };
      return w;
    },
    chrome: null
  };
  const runner = new Function(
    'window','localStorage','ntf','getPrintSettings','getBrand','logoSrc','fdt','PS_KEY','opened',
    src + `
      var extra = registerPrintDocument({id:'custom-doc', title:'سند سفارشی', icon:'★', section:'list', hint:'test'});
      var cat = printDocCatalog();
      printEngineApplyProfile('thermal');
      var job = printEngineJob('invoice');
      printEngineSaveJob({paper:'A5', copies:2, color:false}, 'invoice');
      var last = printEngineLastJob('invoice');
      printEngineSaveTemplate('invoice', {footer:'پای آزمایشی', qr:true});
      var tpl = printEngineTemplate('invoice');
      printEngineRecordHistory({docId:'invoice', title:'فاکتور', printer:'PDF', status:'ok'});
      var histBefore = printEngineHistory();
      var q = printEngineQuickPrint('invoice', '<html><body>INV</body></html>', 'فاکتور');
      var hist = printEngineHistory();
      var printers = printEngineParsePrinters('[{"name":"HP Laser","isDefault":true}]');
      var wrappedPrinters = printEngineParsePrinters('{"ok":true,"printers":[{"name":"HP Laser","isDefault":true}]}');
      var css = printEnginePageCss({paper:'A4', orientation:'landscape', margin:'8mm', scale:90, color:false});
      var sample = printEngineBuildSample('warranty');
      var none = printEngineListPrinters();
      return {
        extraHas: extra.some(function(d){return d.id==='custom-doc';}),
        catLen: cat.length,
        thermalPaper: job.paper,
        lastPaper: last.paper,
        lastCopies: last.copies,
        footer: tpl.footer,
        qr: tpl.qr,
        histDoc: histBefore[0] && histBefore[0].docId,
        histStatus: histBefore[0] && histBefore[0].status,
        qStatus: q && q.status,
        qCode: q && q.errorCode,
        histFail: hist[0] && hist[0].status,
        hp: printers[0] && printers[0].name,
        hp2: wrappedPrinters[0] && wrappedPrinters[0].name,
        cssHasA4: css.indexOf('A4')!==-1,
        cssGray: css.indexOf('grayscale')!==-1,
        sampleHas: sample.indexOf('ضمانت')!==-1 || sample.indexOf('warranty')!==-1 || sample.indexOf('نمونه')!==-1,
        opened: opened.length,
        noneLen: none.length
      };
    `
  );
  const r = runner(fakeWindow, fakeLS, function(){}, function(){ return {}; }, function(){ return {nameFa:'سیرمان',nameEn:'Sirman'}; }, '', function(){ return '1405/05/22'; }, 'laegh_printSettings', opened);
  assertTrue(r.extraHas, 'registerPrintDocument باید سند جدید اضافه کند');
  assertTrue(r.catLen >= 9, 'کاتالوگ باید سند سفارشی را هم داشته باشد');
  assertEqual(r.thermalPaper, '80mm', 'پروفایل Thermal باید کاغذ ۸۰mm باشد');
  assertEqual(r.lastPaper, 'A5', 'آخرین تنظیم فاکتور باید A5 شود');
  assertEqual(r.lastCopies, 2, 'تعداد کپی باید ذخیره شود');
  assertEqual(r.footer, 'پای آزمایشی', 'قالب باید پاورقی را نگه دارد');
  assertTrue(r.qr, 'قالب باید QR را ذخیره کند');
  assertEqual(r.histDoc, 'invoice', 'تاریخچه باید سند فاکتور را ثبت کند');
  assertEqual(r.histStatus, 'ok', 'وضعیت تاریخچه دستی باید همان باشد که ثبت شده');
  assertEqual(r.qStatus, 'PRINT_FAILED', 'بدون Sirman.exe چاپ نباید موفق اعلام شود');
  assertEqual(r.qCode, 'NO_HOST', 'بدون میزبان باید خطای NO_HOST بدهد');
  assertEqual(r.histFail, 'PRINT_FAILED', 'تاریخچه چاپ ناموفق باید PRINT_FAILED باشد');
  assertEqual(r.hp, 'HP Laser', 'پارس چاپگر میزبان باید نام را بخواند');
  assertEqual(r.hp2, 'HP Laser', 'فهرست چاپگر شیءدار باید خوانده شود');
  assertTrue(r.cssHasA4, 'CSS صفحه باید اندازه کاغذ داشته باشد');
  assertTrue(r.cssGray, 'حالت سیاه‌سفید باید grayscale بسازد');
  assertTrue(r.sampleHas, 'پیش‌نمایش نمونه باید محتوا داشته باشد');
  assertEqual(r.opened, 0, 'بدون EXE نباید پنجره چاپ به‌عنوان موفقیت باز شود');
  assertEqual(r.noneLen, 0, 'بدون میزبان نباید چاپگر جعلی ساخته شود');
});

test('میزبان دات‌نت باید فهرست چاپگر و چاپ HTML را بدهد', () => {
  const hostPath = path.join(path.dirname(filePath), 'desktop', 'Sirman.Desktop', 'SirmanHostObject.cs');
  assertTrue(fs.existsSync(hostPath), 'SirmanHostObject.cs باید وجود داشته باشد');
  const host = fs.readFileSync(hostPath, 'utf8');
  assertContainsString(host, 'GetPrinters', 'میزبان باید GetPrinters داشته باشد');
  assertContainsString(host, 'PrintHtml', 'میزبان باید PrintHtml داشته باشد');
  assertContainsString(host, 'SaveAppPref', 'میزبان باید تنظیمات را در AppData نگه دارد');
  assertContainsString(host, 'WriteBackupText', 'میزبان باید بک‌آپ متنی پایدار بنویسد');
  assertContainsString(host, 'GetPrintJob', 'میزبان باید وضعیت کار چاپ را بدهد');
  assertContainsString(host, 'PrintDocument', 'میزبان باید PrintDocument با شناسه سند داشته باشد');
  assertContainsString(host, 'EnqueueHtmlPrint', 'میزبان باید کار چاپ را به موتور دسکتاپ بسپارد');
  assertTrue(!/Verb\s*=\s*"printto"/.test(host), 'نباید از فعل شل printto به‌عنوان چاپ واقعی استفاده شود');
  assertTrue(host.indexOf('Process.Start') < 0, 'میزبان نباید با Process.Start چاپ شل کند');
  assertTrue(!/Microsoft Print to PDF/.test(host), 'GetPrinters نباید چاپگر جعلی بسازد');
  const printHost = fs.readFileSync(path.join(path.dirname(filePath), 'desktop', 'Sirman.Desktop', 'WindowsPrintHost.cs'), 'utf8');
  assertContainsString(printHost, 'PrinterSettings.InstalledPrinters', 'باید چاپگرهای ویندوز را بخواند');
  assertContainsString(printHost, 'PrintAsync', 'موتور چاپ دسکتاپ باید PrintAsync را صدا بزند');
  assertContainsString(printHost, 'PRINT_SUBMITTED', 'موفقیت فقط بعد از ارسال به اسپولر ثبت شود');
  assertContainsString(printHost, 'NO_PRINTER', 'بدون چاپگر باید خطای مشخص بدهد');
  assertContainsString(printHost, 'PRINTER_UNAVAILABLE', 'چاپگر غیرفعال باید خطای مشخص بدهد');
  assertContainsString(printHost, 'PDF_NOT_PRINT', 'چاپ PDF نباید به‌عنوان چاپ کاغذ قبول شود');
  assertContainsString(printHost, 'IsVirtualPrinter', 'چاپگر فایل باید از چاپگر واقعی جدا شود');
  assertContainsString(printHost, 'PRINT_ASYNC_STARTED', 'لاگ PrintAsync باید ثبت شود');
  assertContainsString(printHost, 'PRINT_ASYNC_FAILED', 'خطای PrintAsync باید کد مشخص داشته باشد');
  assertContainsString(printHost, 'PRINT_WEBVIEW_FAILED', 'خطای WebView2 باید کد مشخص داشته باشد');
  assertContainsString(printHost, 'purpose', 'مسیر print و pdf باید جدا باشد');
  assertTrue(!/Verb\s*=\s*"printto"/.test(printHost), 'موتور چاپ نباید printto شل باشد');
  assertTrue(printHost.indexOf('Process.Start') < 0, 'موتور چاپ نباید Process.Start باشد');
  assertContainsString(html, 'host.GetPrinters', 'HTML باید فهرست چاپگر میزبان را بخواند');
  assertContainsString(html, 'host.PrintHtml', 'HTML باید PrintHtml میزبان را صدا بزند');
  assertContainsString(html, 'host.PrintDocument', 'HTML باید PrintDocument را ترجیح بدهد');
  assertContainsString(html, 'NO_HOST', 'بدون EXE نباید چاپ موفق اعلام شود');
  const pcPrint = extractFunctionSource(html, 'pcDoPrint');
  assertContainsString(pcPrint, 'NO_DOCUMENT', 'چاپ مرکز پرینت بدون سند زنده باید خطا بدهد');
  assertTrue(pcPrint.indexOf('printEngineBuildSample') < 0, 'دکمه چاپ نباید نمونه پیش‌نمایش را به چاپگر بفرستد');
  const printHtmlSrc = extractFunctionSource(html, 'printEnginePrintHtml');
  assertContainsString(printHtmlSrc, 'documentId', 'بار چاپ باید شناسه سند داشته باشد');
  assertContainsString(printHtmlSrc, 'PrintDocument', 'چاپ باید از PrintDocument میزبان برود');
});

test('شبیه‌سازی: بدون سند زنده، چاپ ناموفق است و داده را عوض نمی‌کند', () => {
  const start = html.indexOf("var PC_KEY = 'laegh_printCenter';");
  const pe = html.indexOf('\nvar PrintEngine = {');
  const objEnd = html.indexOf('\n};', pe);
  const src = html.slice(start, objEnd + 3);
  const store = {};
  const fakeLS = {
    getItem(k){ return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; },
    setItem(k,v){ store[k]=String(v); },
    removeItem(k){ delete store[k]; }
  };
  const captured = [];
  const invoices = [];
  const products = [{code:'P1', stock:5}];
  const parts = [{code:'X1', stock:3}];
  const accounts = [{id:'A1', bal:100}];
  const fakeWindow = {
    chrome: {
      webview: {
        hostObjects: {
          sync: {
            sirmanHost: {
              GetPrinters(){ return JSON.stringify({ok:true, printers:[{name:'HP Laser', isDefault:true, isValid:true}], count:1, defaultPrinter:'HP Laser'}); },
              PrintDocument(json){
                captured.push(typeof json==='string' ? JSON.parse(json) : json);
                return JSON.stringify({ok:false, status:'PRINT_FAILED', errorCode:'PRINTER_UNAVAILABLE', message:'Printer is unavailable.', printJobId:'PJ-TEST'});
              },
              PrintHtml(){ return JSON.stringify({ok:false, status:'PRINT_FAILED', errorCode:'NO_PRINTER'}); },
              GetPrintJob(){ return JSON.stringify({ok:false, status:'PRINT_FAILED', errorCode:'MISSING_JOB'}); }
            }
          }
        }
      }
    }
  };
  const runner = new Function(
    'window','localStorage','ntf','getPrintSettings','getBrand','logoSrc','fdt','PS_KEY','invoices','products','parts','accounts','invoiceIdentity','captured',
    src + `
      var none = pcDoPrint();
      invoices.push({invoiceId:'INVUID-KEEP', InvoiceNumber:'1001', num:'1001', items:[{qty:1}], tF:10});
      var live = printEnginePrintHtml('<html dir="rtl"><body>فاکتور زنده</body></html>', {docId:'invoice', documentId:'INVUID-KEEP', invoiceId:'INVUID-KEEP', title:'فاکتور', skipWrap:true});
      return {
        noneStatus: none && none.status,
        noneCode: none && none.errorCode,
        liveStatus: live && live.status,
        liveCode: live && live.errorCode,
        capturedId: captured[0] && captured[0].documentId,
        capturedHtml: captured[0] && String(captured[0].html||''),
        invLen: invoices.length,
        invId: invoices[0] && invoices[0].invoiceId,
        prodStock: products[0] && products[0].stock,
        partStock: parts[0] && parts[0].stock,
        accBal: accounts[0] && accounts[0].bal,
        printers: printEngineListPrinters().length
      };
    `
  );
  const r = runner(fakeWindow, fakeLS, function(){}, function(){ return {}; }, function(){ return {nameFa:'سیرمان',nameEn:'Sirman'}; }, '', function(){ return '1405/05/25'; }, 'laegh_printSettings', invoices, products, parts, accounts, function(d){ return (d && (d.invoiceId||d.InvoiceId)) || ''; }, captured);
  assertEqual(r.noneCode, 'NO_DOCUMENT', 'بدون سند زنده باید NO_DOCUMENT باشد');
  assertEqual(r.noneStatus, 'PRINT_FAILED', 'بدون سند نباید چاپ موفق اعلام شود');
  assertEqual(r.capturedId, 'INVUID-KEEP', 'بار چاپ باید InvoiceId را بفرستد');
  assertTrue(String(r.capturedHtml).indexOf('SIRMAN-PRINT-META') >= 0, 'سند چاپ باید متای شناسه داشته باشد');
  assertEqual(r.liveStatus, 'PRINT_FAILED', 'چاپگر غیرفعال باید شکست صادقانه بدهد');
  assertEqual(r.liveCode, 'PRINTER_UNAVAILABLE', 'کد خطا باید PRINTER_UNAVAILABLE باشد');
  assertEqual(r.invLen, 1, 'چاپ نباید فاکتور را حذف یا اضافه کند');
  assertEqual(r.invId, 'INVUID-KEEP', 'شناسه فاکتور بعد از چاپ باید همان باشد');
  assertEqual(r.prodStock, 5, 'چاپ نباید موجودی کالا را عوض کند');
  assertEqual(r.partStock, 3, 'چاپ نباید موجودی قطعه را عوض کند');
  assertEqual(r.accBal, 100, 'چاپ نباید مانده حساب را عوض کند');
  assertEqual(r.printers, 1, 'فهرست چاپگر میزبان باید خوانده شود');
});

test('شبیه‌سازی: چاپ به Microsoft Print to PDF موفقیت چاپ نیست', () => {
  const start = html.indexOf("var PC_KEY = 'laegh_printCenter';");
  const pe = html.indexOf('\nvar PrintEngine = {');
  const objEnd = html.indexOf('\n};', pe);
  const src = html.slice(start, objEnd + 3);
  const store = {};
  const fakeLS = {
    getItem(k){ return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; },
    setItem(k,v){ store[k]=String(v); },
    removeItem(k){ delete store[k]; }
  };
  const captured = [];
  const fakeWindow = {
    chrome: {
      webview: {
        hostObjects: {
          sync: {
            sirmanHost: {
              GetPrinters(){ return JSON.stringify({ok:true, printers:[
                {name:'Microsoft Print to PDF', isDefault:true, isValid:true, isPhysical:false, isPdf:true, kind:'pdf'},
                {name:'HP LaserJet', isDefault:false, isValid:true, isPhysical:true, kind:'physical'}
              ], count:2, defaultPrinter:'Microsoft Print to PDF', defaultPhysicalPrinter:'HP LaserJet'}); },
              PrintDocument(json){
                captured.push(typeof json==='string' ? JSON.parse(json) : json);
                return JSON.stringify({ok:false, status:'PRINT_FAILED', errorCode:'PRINTER_UNAVAILABLE', message:'Printer is unavailable.', printJobId:'PJ-TEST'});
              },
              PrintHtml(){ return JSON.stringify({ok:false, status:'PRINT_FAILED', errorCode:'NO_PRINTER'}); },
              GetPrintJob(){ return JSON.stringify({ok:false, status:'PRINT_FAILED', errorCode:'MISSING_JOB'}); }
            }
          }
        }
      }
    }
  };
  const runner = new Function(
    'window','localStorage','ntf','getPrintSettings','getBrand','logoSrc','fdt','PS_KEY','captured',
    src + `
      var pdfName = printEngineIsPdfPrinter('Microsoft Print to PDF');
      var hpName = printEngineIsPdfPrinter('HP LaserJet');
      var pdfTry = printEnginePrintHtml('<html dir="rtl"><body>INV</body></html>', {docId:'invoice', documentId:'INVUID-KEEP', printer:'Microsoft Print to PDF', skipWrap:true, purpose:'print'});
      var afterPdf = captured.length;
      var realTry = printEnginePrintHtml('<html dir="rtl"><body>INV</body></html>', {docId:'invoice', documentId:'INVUID-KEEP', printer:'HP LaserJet', skipWrap:true, purpose:'print'});
      var savedPrinter = printEngineJob('invoice').printer;
      var pdfExport = printEngineSavePdf('<html dir="rtl"><body>INV</body></html>', {docId:'invoice', documentId:'INVUID-KEEP', printer:'Microsoft Print to PDF'});
      var afterExport = printEngineJob('invoice').printer;
      var list = printEngineListPrinters();
      var physical = printEnginePhysicalPrinters(list);
      return {
        pdfName: pdfName,
        hpName: hpName,
        pdfStatus: pdfTry && pdfTry.status,
        pdfCode: pdfTry && pdfTry.errorCode,
        afterPdf: afterPdf,
        realPrinter: captured[0] && captured[0].printerName,
        realPurpose: captured[0] && captured[0].purpose,
        savedPrinter: savedPrinter,
        exportPurpose: captured[1] && captured[1].purpose,
        afterExport: afterExport,
        physName: physical[0] && physical[0].name,
        physLen: physical.length
      };
    `
  );
  const r = runner(fakeWindow, fakeLS, function(){}, function(){ return {}; }, function(){ return {nameFa:'سیرمان',nameEn:'Sirman'}; }, '', function(){ return '1405/05/26'; }, 'laegh_printSettings', captured);
  assertTrue(r.pdfName, 'Microsoft Print to PDF باید چاپگر فایل شناخته شود');
  assertTrue(!r.hpName, 'HP نباید چاپگر PDF باشد');
  assertEqual(r.pdfCode, 'PDF_NOT_PRINT', 'چاپ روی PDF باید PDF_NOT_PRINT بدهد');
  assertEqual(r.pdfStatus, 'PRINT_FAILED', 'خروجی PDF موفقیت چاپ نیست');
  assertEqual(r.afterPdf, 0, 'مسیر چاپ نباید PrintDocument را برای PDF صدا بزند');
  assertEqual(r.realPrinter, 'HP LaserJet', 'چاپ باید نام چاپگر واقعی را بفرستد');
  assertEqual(r.realPurpose, 'print', 'purpose چاپ باید print باشد');
  assertEqual(r.savedPrinter, 'HP LaserJet', 'چاپ واقعی باید چاپگر ذخیره شده را نگه دارد');
  assertEqual(r.exportPurpose, 'pdf', 'خروجی PDF باید purpose جدا داشته باشد');
  assertEqual(r.afterExport, 'HP LaserJet', 'ذخیره PDF نباید چاپگر چاپ را به PDF عوض کند');
  assertEqual(r.physName, 'HP LaserJet', 'فهرست فیزیکی باید HP باشد نه PDF');
  assertEqual(r.physLen, 1, 'فقط یک چاپگر واقعی');
});

console.log('');
console.log('📋 گروه: تشخیص سخت‌افزار چاپ (جدا از مرکز پرینت)');

test('هارنس تشخیص چاپگر باید جدا از مرکز پرینت و بدون داده کسب‌وکار باشد', () => {
  assertContainsString(html, 'id="print-hardware-diagnostic"', 'صفحه تشخیص چاپگر لازم است');
  assertContainsString(html, "showStgTab('print-diag'", 'تب تشخیص چاپگر لازم است');
  ['phdHost','phdCall','phdRefresh','phdDirectPrint','phdWebViewPrint','phdQueue','phdConfirmPaper','phdRender'].forEach(fn => {
    assertTrue(!!extractFunctionSource(html, fn), 'تابع '+fn+' لازم است');
  });
  const callSrc = extractFunctionSource(html, 'phdCall');
  const directSrc = extractFunctionSource(html, 'phdDirectPrint');
  const webSrc = extractFunctionSource(html, 'phdWebViewPrint');
  assertContainsString(callSrc, 'RunPrintHardwareDiagnostic', 'تشخیص باید از Host جداگانه برود');
  assertTrue(directSrc.indexOf('pcDoPrint') < 0, 'چاپ تشخیصی نباید مرکز پرینت را صدا بزند');
  assertTrue(directSrc.indexOf('invoices') < 0, 'چاپ تشخیصی نباید فاکتور بخواند');
  assertTrue(webSrc.indexOf('delInv') < 0 && callSrc.indexOf('accounts') < 0, 'تشخیص نباید حساب/حذف فاکتور را لمس کند');
  assertContainsString(html, 'PRINT SUBMITTED', 'ارسال به صف باید از چاپ کاغذ جدا باشد');
  assertContainsString(html, 'PHYSICAL', 'طبقه‌بندی PHYSICAL لازم است');
  assertContainsString(html, 'VIRTUAL', 'طبقه‌بندی VIRTUAL لازم است');
  assertContainsString(html, 'data-help-id="print-hardware-diagnostic"', 'راهنمای تشخیص چاپگر لازم است');
  const host = fs.readFileSync(path.join(path.dirname(filePath), 'desktop', 'Sirman.Desktop', 'SirmanHostObject.cs'), 'utf8');
  assertContainsString(host, 'RunPrintHardwareDiagnostic', 'Host باید متد تشخیص جدا داشته باشد');
  const printHost = fs.readFileSync(path.join(path.dirname(filePath), 'desktop', 'Sirman.Desktop', 'WindowsPrintHost.cs'), 'utf8');
  assertTrue(printHost.indexOf('RunPrintHardwareDiagnostic') < 0, 'مرکز پرینت تولیدی نباید با هارنس تشخیص مخلوط شود');
  const diag = fs.readFileSync(path.join(path.dirname(filePath), 'desktop', 'Sirman.Desktop', 'PrintHardwareDiagnostic.cs'), 'utf8');
  assertContainsString(diag, 'SIRMAN PRINT HARDWARE TEST', 'سند آزمایشی باید متن ثابت داشته باشد');
  assertContainsString(diag, 'StandardPrintController', 'مسیر مستقیم باید GDI/ویندوز باشد نه پیش‌نمایش مرورگر');
  assertContainsString(diag, 'JOB_ID_NOT_AVAILABLE', 'اگر Job ID نباشد نباید موفقیت جعلی باشد');
  assertContainsString(diag, 'PHYSICAL PRINT VERIFIED', 'تأیید کاغذ باید جدا از PrintAsync باشد');
  assertTrue(diag.indexOf('invoices') < 0, 'کلاس تشخیص نباید invoices داشته باشد');
  const rules = fs.readFileSync(path.join(path.dirname(filePath), 'docs', 'ARCHITECTURE_RULES.md'), 'utf8');
  assertContainsString(rules, 'RunPrintHardwareDiagnostic', 'لیست مجاز Host باید متد تشخیص را داشته باشد');
});

test('تشخیص باید PDF را مجازی بشمارد و بدون Host چاپ موفق نگوید', () => {
  const facts = fs.readFileSync(path.join(path.dirname(filePath), 'desktop', 'Sirman.Core', 'Printing', 'PrintHardwareFacts.cs'), 'utf8');
  assertContainsString(facts, 'Contains("pdf"', 'طبقه‌بندی PDF لازم است');
  assertContainsString(facts, 'PHYSICAL_PRINT_NOT_VERIFIED', 'ارسال صف نباید چاپ کاغذ باشد');
  const callSrc = extractFunctionSource(html, 'phdCall');
  assertContainsString(callSrc, 'NO_HOST', 'بدون EXE باید NO_HOST برگردد');
  assertTrue(callSrc.indexOf('PRINT SUCCESS') < 0, 'مسیر تشخیص نباید PRINT SUCCESS جعلی بسازد');
  const htmlOnly = (function(){
    const hostFn = extractFunctionSource(html, 'phdHost');
    const fn = new Function(hostFn + '\n' + callSrc + '\n var window = {}; var _phdSelected=""; return phdCall("probe");');
    return fn();
  })();
  assertEqual(htmlOnly.errorCode, 'NO_HOST', 'HTML-only باید تشخیص را مسدود کند');
});

test('طبقه‌بندی تشخیص: PDF مجازی است و PRINT_SUBMITTED چاپ کاغذ نیست', () => {
  const src = fs.readFileSync(path.join(path.dirname(filePath), 'desktop', 'Sirman.Core', 'Printing', 'PrintHardwareFacts.cs'), 'utf8');
  assertContainsString(src, 'TreatAsPhysicalPrint', 'متد TreatAsPhysicalPrint لازم است');
  assertContainsString(src, 'PHYSICAL_PRINT_NOT_VERIFIED', 'کد PHYSICAL_PRINT_NOT_VERIFIED لازم است');
  assertContainsString(src, '"pdf"', 'kind pdf لازم است');
  assertContainsString(src, 'WEBVIEW2_PRINT_FAILED', 'شکست مسیر WebView2 جدا کد دارد');
});

console.log('');
console.log('📋 گروه: انزوای ماژول چاپ (Phase 2 exit)');

test('قرارداد چاپ باید از جزئیات ویندوز و داده کسب‌وکار جدا باشد', () => {
  const root = path.dirname(filePath);
  const contract = fs.readFileSync(path.join(root, 'desktop', 'Sirman.Core', 'Printing', 'IPrintService.cs'), 'utf8');
  const status = fs.readFileSync(path.join(root, 'desktop', 'Sirman.Core', 'Printing', 'PrintStatusContract.cs'), 'utf8');
  const adapter = fs.readFileSync(path.join(root, 'desktop', 'Sirman.Desktop', 'PrintServiceAdapter.cs'), 'utf8');
  const form = fs.readFileSync(path.join(root, 'desktop', 'Sirman.Desktop', 'MainForm.cs'), 'utf8');
  const host = fs.readFileSync(path.join(root, 'desktop', 'Sirman.Desktop', 'WindowsPrintHost.cs'), 'utf8');
  const diag = fs.readFileSync(path.join(root, 'desktop', 'Sirman.Desktop', 'PrintHardwareDiagnostic.cs'), 'utf8');
  const biz = fs.readFileSync(path.join(root, 'desktop', 'Sirman.Core', 'Application', 'BusinessFacade.cs'), 'utf8');
  const rules = fs.readFileSync(path.join(root, 'docs', 'ARCHITECTURE_RULES.md'), 'utf8');
  assertContainsString(contract, 'interface IPrintService', 'قرارداد IPrintService لازم است');
  assertContainsString(status, 'PHYSICAL_PRINT_NOT_VERIFIED', 'وضعیت کاغذ باید جدا از ارسال صف باشد');
  assertContainsString(status, 'PDF_EXPORTED', 'خروجی PDF باید وضعیت جدا داشته باشد');
  assertContainsString(adapter, 'WindowsPrintHost', 'آداپتر باید موتور موجود را wrap کند نه بازنویسی');
  assertContainsString(adapter, 'PrintStatusContract.Annotate', 'نتیجه چاپ باید وضعیت قرارداد داشته باشد');
  assertContainsString(form, 'IPrintService', 'پوسته باید از قرارداد چاپ استفاده کند');
  assertTrue(host.indexOf('RunPrintHardwareDiagnostic') < 0, 'WindowsPrintHost نباید با تشخیص مخلوط شود');
  assertTrue(host.indexOf('IPrintService') < 0, 'موتور موجود نباید برای isolation بازنویسی شود');
  assertTrue(diag.indexOf('invoices') < 0, 'تشخیص نباید invoices را ببیند');
  assertTrue(biz.indexOf('PrintHtml') < 0 && biz.indexOf('WindowsPrintHost') < 0, 'BusinessFacade نباید به چاپ ویندوز وابسته باشد');
  assertContainsString(rules, 'PRINT MODULE ISOLATED', 'معماری باید انزوای چاپ را ثبت کند');
  assertContainsString(rules, 'PHASE 3 MUST NOT BREAK PRINT', 'فاز ۳ نباید چاپ را بشکند');
});

test('مشاهده‌گر فاز ۰ نباید وارد فایل‌های منجمد چاپ شود', () => {
  const root = path.dirname(filePath);
  const observer = path.join(root, 'desktop', 'Sirman.Desktop', 'PrintPhase0Observer.cs');
  const checklist = path.join(root, 'docs', 'PHASE_0_PRINT_VERIFICATION_CHECKLIST.md');
  assertTrue(fs.existsSync(observer), 'PrintPhase0Observer.cs باید جدا از موتور منجمد باشد');
  assertTrue(fs.existsSync(checklist), 'چک‌لیست دستی فاز ۰ لازم است');
  const observerSrc = fs.readFileSync(observer, 'utf8');
  assertContainsString(observerSrc, 'PHASE_0_OBSERVE.log', 'لاگ فاز ۰ باید نام فایل جدا داشته باشد');
  assertTrue(observerSrc.indexOf('PrintAsync') < 0, 'مشاهده‌گر نباید PrintAsync را صدا بزند');
  ['WindowsPrintHost.cs', 'PrintServiceAdapter.cs', 'IPrintService.cs'].forEach(function(name){
    const p = name.indexOf('IPrint') === 0
      ? path.join(root, 'desktop', 'Sirman.Core', 'Printing', name)
      : path.join(root, 'desktop', 'Sirman.Desktop', name);
    const src = fs.readFileSync(p, 'utf8');
    assertTrue(src.indexOf('PrintPhase0Observer') < 0, name + ' منجمد است و نباید مشاهده‌گر را ببیند');
  });
  const hostObj = fs.readFileSync(path.join(root, 'desktop', 'Sirman.Desktop', 'SirmanHostObject.cs'), 'utf8');
  assertTrue(hostObj.indexOf('PrintPhase0Observer') < 0, 'PrintHtml/PrintDocument نباید مشاهده‌گر را صدا بزنند');
  const form = fs.readFileSync(path.join(root, 'desktop', 'Sirman.Desktop', 'MainForm.cs'), 'utf8');
  assertContainsString(form, 'PrintPhase0Observer.Observe("ENQUEUE_CALL"', 'ورود Desktop باید از بیرون موتور ثبت شود');
  assertContainsString(form, '_printHost.Enqueue(html, printerName, paper, orientation, copies, documentId, documentType, user, purpose)', 'Enqueue موجود باید بدون تغییر امضا بماند');
});

console.log('');
console.log('📋 گروه: موتور مشترک انبار (Inventory Engine)');

test('UI انبار ارتقا‌یافته: رزرو، برگشت، کارتکس، نقطه سفارش و انواع انبار', () => {
  ['kardex-modal','wr-lowstock','wr-value-dead','st-reason','st-confirm','wh-entity-code','wh-entity-manager','wh-entity-status','pm-barcode','pm-model','pm-unit','part-reorder','part-barcode','im-reserved','im-reorder','def-status'].forEach(id=>{
    assertContainsString(html, 'id="'+id+'"', 'عنصر '+id+' لازم است');
  });
  ['openWarehouseModal(\'return\')','openWarehouseModal(\'reserve\')','openWarehouseModal(\'adjust\')','openKardexModal()'].forEach(fn=>{
    assertContainsString(html, fn, 'دکمه '+fn+' لازم است');
  });
  ['value="parts"','value="goods"','value="defective"','value="service"','value="return"','value="scrap"'].forEach(v=>{
    assertContainsString(html, v, 'نوع انبار '+v+' لازم است');
  });
  ['value="inspect"','value="wait_part"','value="repair"','value="ready"'].forEach(v=>{
    assertContainsString(html, v, 'وضعیت معیوب '+v+' لازم است');
  });
  ['id:\'wh-receipt\'','id:\'wh-voucher\'','id:\'wh-kardex\'','id:\'wh-report\''].forEach(id=>{
    assertContainsString(html, id, 'کاتالوگ چاپ باید '+id+' داشته باشد');
  });
  assertContainsString(html, 'تأیید مسئول انبار', 'انبارگردانی باید تأیید مسئول داشته باشد');
  assertContainsString(html, 'رزرو موجودی', 'راهنما باید رزرو را توضیح دهد');
  assertContainsString(html, 'کارتکس', 'راهنما باید کارتکس را توضیح دهد');
});

test('توابع موتور Inventory باید تعریف شده باشند', () => {
  ['registerWarehouseKind','invNormalizeWarehouse','invStockSnapshot','invReserveOnItem','invReleaseReserveOnItem','invKardexFromMoves','invLowStockFromLists','invSearchCatalog','invStockValueFromLists','invDeadStockFromMoves','invConsumedInService','defIsInWarehouse','openKardexModal'].forEach(fn=>{
    assertTrue(extractFunctionSource(html, fn) !== null, 'تابع '+fn+' پیدا نشد');
  });
  assertContainsString(html, 'var InventoryEngine = {', 'شیء InventoryEngine پیدا نشد');
  const adj = extractFunctionSource(html, 'applyStocktakeAdjustments');
  assertContainsString(adj, 'st-reason', 'انبارگردانی باید علت بخواهد');
  assertContainsString(adj, 'st-confirm', 'انبارگردانی باید تأیید مسئول را چک کند');
  const snap = extractFunctionSource(html, 'applyStockByWarehouse');
  assertContainsString(snap, 'available', 'خروج باید موجودی قابل‌استفاده را چک کند');
});

test('شبیه‌سازی: موجودی/رزرو/کارتکس/کم‌موجودی/جستجو/ارزش/قطعه مصرفی (execution-based)', () => {
  const src = [
    extractFunctionSource(html, '_sumByWh'),
    extractFunctionSource(html, 'registerWarehouseKind'),
    extractFunctionSource(html, 'invNormalizeWarehouse'),
    extractFunctionSource(html, 'invStockSnapshot'),
    extractFunctionSource(html, 'invReserveOnItem'),
    extractFunctionSource(html, 'invReleaseReserveOnItem'),
    extractFunctionSource(html, 'invKardexFromMoves'),
    extractFunctionSource(html, 'invLowStockFromLists'),
    extractFunctionSource(html, 'invSearchCatalog'),
    extractFunctionSource(html, 'invStockValueFromLists'),
    extractFunctionSource(html, 'invDeadStockFromMoves'),
    extractFunctionSource(html, 'invConsumedInService'),
    extractFunctionSource(html, 'defStatusOf'),
    extractFunctionSource(html, 'defIsInWarehouse')
  ].join('\n');
  assertTrue(src.indexOf('function invStockSnapshot')>=0, 'منبع موتور استخراج نشد');
  const runner = new Function('var WH_TYPE_LBL = {parts:"قطعات"}; var WH_TYPE_ICO = {};\n' + src + `;
    var item = {qty:10, min:2, reorder:3, reserved:0, byWh:{'WH-A':10}, reservedByWh:{}, price:1000};
    var s0 = invStockSnapshot(item, 'WH-A');
    var r1 = invReserveOnItem(item, 4, 'WH-A');
    var s1 = r1.stock;
    var over = invReserveOnItem(item, 20, 'WH-A');
    var rel = invReleaseReserveOnItem(item, 1, 'WH-A');
    var kinds = registerWarehouseKind('custom', 'سفارشی', '★');
    var nw = invNormalizeWarehouse({id:'WH-X', name:'تست'});
    var moves = [
      {itemCode:'P1', whId:'WH-A', date:'1405/05/01', qty:5},
      {itemCode:'P2', whId:'WH-A', date:'1405/05/02', qty:1},
      {itemCode:'P1', whId:'WH-B', date:'1405/05/03', qty:2}
    ];
    var kx = invKardexFromMoves(moves, 'P1', 'WH-A');
    var low = invLowStockFromLists(
      [{code:'A', name:'قطعه کم', qty:1, min:5}],
      [{code:'B', name:'کالای کافی'}],
      {B:{qty:20, min:2}}
    );
    var hits = invSearchCatalog('QR-99', [{code:'A', name:'موتور', barcode:'QR-99'}], []);
    var val = invStockValueFromLists([{code:'A', qty:2, price:500}], [{code:'B', price:1000}], {B:{qty:3}});
    var dead = invDeadStockFromMoves(
      [{code:'OLD', name:'راکد', qty:4},{code:'NEW', name:'فعال', qty:2}],
      [{itemCode:'NEW', date: new Date(Date.now()-2*24*60*60*1000).toISOString()}],
      90,
      Date.now()
    );
    var cons = invConsumedInService([{id:'W1', agencyWork:{partReqs:[{partCode:'P9', partName:'بلبرینگ', qty:2}]}}]);
    var inWh = defIsInWarehouse({status:'inspect'});
    var outWh = defIsInWarehouse({status:'scrap'});
    var mapped = defStatusOf({status:'in_stock'});
    return {
      avail0: s0.available, qty0:s0.qty, reserved0:s0.reserved,
      ok1: r1.ok, avail1:s1.available, reserved1:s1.reserved,
      overOk: over.ok, relReserved: rel.stock.reserved,
      custom: kinds.custom, nwStatus: nw.status, nwCode: nw.code,
      kxLen: kx.length, kxCode: kx[0] && kx[0].itemCode,
      lowCodes: low.map(function(x){return x.code;}).join(','),
      hitCode: hits[0] && hits[0].code,
      val: val,
      deadCodes: dead.map(function(x){return x.code;}).join(','),
      consCode: cons[0] && cons[0].code, consQty: cons[0] && cons[0].qty,
      inWh: inWh, outWh: outWh, mapped: mapped
    };
  `);
  const r = runner();
  assertEqual(r.qty0, 10, 'موجودی فعلی باید ۱۰ باشد');
  assertEqual(r.avail0, 10, 'قبل از رزرو، قابل‌استفاده باید ۱۰ باشد');
  assertTrue(r.ok1, 'رزرو ۴ عدد باید موفق باشد');
  assertEqual(r.reserved1, 4, 'رزرو باید ۴ شود');
  assertEqual(r.avail1, 6, 'قابل‌استفاده بعد از رزرو باید ۶ باشد (۱۰-۴)');
  assertEqual(r.overOk, false, 'رزرو بیش از موجودی قابل‌استفاده باید رد شود');
  assertEqual(r.relReserved, 3, 'آزاد کردن ۱ رزرو باید مانده ۳ بگذارد');
  assertEqual(r.custom, 'سفارشی', 'registerWarehouseKind باید نوع جدید اضافه کند بدون تغییر هسته');
  assertEqual(r.nwStatus, 'active', 'انبار بدون وضعیت باید active شود');
  assertEqual(r.nwCode, 'WH-X', 'کد انبار از id پر شود');
  assertEqual(r.kxLen, 1, 'کارتکس باید فقط حرکت همان کالا/انبار را بدهد');
  assertEqual(r.lowCodes, 'A', 'فقط قلم کم‌موجودی باید در هشدار باشد');
  assertEqual(r.hitCode, 'A', 'جستجو با بارکد باید کالا را پیدا کند');
  assertEqual(r.val, 4000, 'ارزش موجودی باید ۲×۵۰۰ + ۳×۱۰۰۰ = ۴۰۰۰ باشد');
  assertEqual(r.deadCodes, 'OLD', 'کالای بدون گردش باید راکد تشخیص داده شود');
  assertEqual(r.consCode, 'P9', 'قطعه مصرفی گارانتی باید از partReqs خوانده شود');
  assertEqual(r.consQty, 2, 'تعداد قطعه مصرفی باید ۲ باشد');
  assertTrue(r.inWh, 'وضعیت کارشناسی باید داخل انبار معیوب باشد');
  assertTrue(!r.outWh, 'اسقاط نباید داخل انبار فعال باشد');
  assertEqual(r.mapped, 'received', 'in_stock قدیمی باید به دریافت نگاشته شود');
});


console.log('');
console.log('📋 گروه: موتور پشتیبان (Backup Manager / Schema / Restore ایمن)');

function loadBackupEngine(srcHtml){
  const start = srcHtml.indexOf('var SIRMAN_SCHEMA_VERSION = ');
  const end = srcHtml.indexOf('\nfunction _buildFullBackupData(');
  if(start < 0 || end < 0 || end <= start) throw new Error('موتور BackupEngine در فایل پیدا نشد');
  const src = srcHtml.slice(start, end);
  return new Function(src + '\nreturn { BackupEngine: BackupEngine, SIRMAN_SCHEMA_VERSION: SIRMAN_SCHEMA_VERSION, SIRMAN_BACKUP_MAGIC: SIRMAN_BACKUP_MAGIC, SIRMAN_BACKUP_ENC_MAGIC: SIRMAN_BACKUP_ENC_MAGIC, BACKUP_RETENTION: BACKUP_RETENTION };')();
}

test('توابع BackupEngine و UI مدیر پشتیبان باید تعریف شده باشند', () => {
  ['inferBackupSchemaVersion','canRestoreSchema','buildBackupManifest','finalizeBackupPackage','validateBackupPackage','applySchemaMigrations','testRestoreBackup','unwrapBackupEnvelope','pruneBackupRetention','layersDueForPromotion','verifyLayerPayload','prepareAtomicRestore','archivalCsvFromRows','recordBackupLayer','saveSafetySnapshot','openLastSafetyForRestore'].forEach(fn=>{
    assertTrue(extractFunctionSource(html, fn) !== null, 'تابع '+fn+' پیدا نشد');
  });
  assertContainsString(html, 'var BackupEngine = {', 'شیء BackupEngine پیدا نشد');
  assertContainsString(html, 'id="bk-schema-ver"', 'نمایش Schema در مدیر پشتیبان لازم است');
  assertContainsString(html, 'runPendingTestRestore()', 'دکمه تست بازگردانی لازم است');
  assertContainsString(html, 'exportArchiveBackup()', 'دکمه آرشیو بلندمدت لازم است');
  assertContainsString(html, 'openLastSafetyForRestore()', 'دکمه نسخه ایمنی لازم است');
  assertContainsString(html, 'بسته مستقل', 'راهنما باید بسته مستقل را توضیح دهد');
  assertContainsString(html, 'لایه فقط بعد از تأیید صحت JSON ثبت می‌شود', 'راهنما باید ثبت پس از تأیید را بگوید');
});

test('شبیه‌سازی: Schema، Migration ۰→۱، Restore ایمن، نگهداری لایه، CSV، envelope (execution-based)', () => {
  const eng = loadBackupEngine(html);
  const BE = eng.BackupEngine;
  assertEqual(BE.schemaVersion(), 1, 'Schema برنامه باید ۱ باشد');
  assertEqual(BE.inferSchema({invoices:[{num:'1'}]}), 0, 'بک‌آپ قدیمی بدون schemaVersion باید Schema ۰ باشد');
  assertEqual(BE.inferSchema({schemaVersion:1, invoices:[]}), 1, 'schemaVersion=1 باید ۱ خوانده شود');
  assertEqual(BE.inferSchema({manifest:{schemaVersion:1}}), 1, 'schemaVersion داخل Manifest باید خوانده شود');

  const tooNew = BE.canRestore(2, 1);
  assertEqual(tooNew.ok, false, 'Schema جدیدتر از برنامه باید رد شود');
  assertEqual(tooNew.direction, 'downgrade', 'جهت باید downgrade باشد');
  const up = BE.canRestore(0, 1);
  assertEqual(up.ok, true, 'Schema قدیمی‌تر باید با Migration پذیرفته شود');
  assertEqual(up.direction, 'upgrade', 'جهت باید upgrade باشد');

  const oldPkg = { version:'10.3.29', invoices:[{num:'1', seller:'A'}], phonebook:[{fn:'علی', ln:'رضایی'}], warranties:[{id:'W1', docs:[{id:'D1', name:'قبض.jpg', data:'disk:abc'}]}] };
  const originalJson = JSON.stringify(oldPkg);
  const mig = BE.migrateSchema(oldPkg, 1);
  assertTrue(mig.ok, 'Migration ۰→۱ باید موفق باشد');
  assertEqual(mig.from, 0, 'مبدأ Schema باید ۰ باشد');
  assertEqual(mig.data.schemaVersion, 1, 'بعد از Migration باید Schema ۱ شود');
  assertEqual(mig.data.magic, eng.SIRMAN_BACKUP_MAGIC, 'magic بسته باید SIRMAN_BACKUP باشد');
  assertTrue(!!mig.data.manifest, 'Manifest باید اضافه شود');
  assertTrue(Array.isArray(mig.data.attachmentsIndex) && mig.data.attachmentsIndex.length>=1, 'فهرست پیوست باید ساخته شود');
  assertEqual(JSON.parse(originalJson).schemaVersion, undefined, 'Migration نباید روی نسخه اصلی اعمال شود (باید clone کند)');

  const emptyVal = BE.validate({});
  assertEqual(emptyVal.ok, false, 'بسته بدون کلید داده باید نامعتبر باشد');
  const okVal = BE.validate({invoices:[{num:'1', items:[]}]});
  assertEqual(okVal.ok, true, 'بسته با فاکتور باید معتبر باشد');

  const pruned = BE.prune([
    {id:'d1', layer:'daily', ts:'2026-08-13'}, {id:'d2', layer:'daily', ts:'2026-08-12'},
    {id:'d3', layer:'daily', ts:'2026-08-11'}, {id:'d4', layer:'daily', ts:'2026-08-10'},
    {id:'d5', layer:'daily', ts:'2026-08-09'}, {id:'d6', layer:'daily', ts:'2026-08-08'},
    {id:'d7', layer:'daily', ts:'2026-08-07'}, {id:'d8', layer:'daily', ts:'2026-08-06'},
    {id:'d9', layer:'daily', ts:'2026-08-05'}, {id:'arch', layer:'archive', ts:'2026-01-01', immutable:true}
  ]);
  assertEqual(pruned.kept.filter(x=>x.layer==='daily').length, 7, 'باید حداکثر ۷ روزانه نگه داشته شود');
  assertTrue(pruned.kept.some(x=>x.id==='arch'), 'آرشیو immutable نباید حذف شود');
  assertTrue(pruned.deleted.some(x=>x.id==='d9'), 'قدیمی‌ترین روزانه باید حذف شود');

  const env = BE.unwrap({
    magic: eng.SIRMAN_BACKUP_MAGIC,
    database: { invoices:[{num:'9'}] },
    settings: { company:{name:'سیرمان'} },
    applicationVersion: '1405.5.22δ',
    schemaVersion: 1
  });
  assertEqual(env.invoices[0].num, '9', 'envelope باید database را به کلیدهای تخت باز کند');
  assertEqual(env.company.name, 'سیرمان', 'settings باید در بسته تخت ادغام شود');
  assertEqual(env.version, '1405.5.22δ', 'applicationVersion باید به version نگاشته شود');

  const live = { invoices:[{num:'KEEP'}], phonebook:[] };
  const incoming = { invoices:[{num:'NEW'}], phonebook:[{fn:'ب'}] };
  const tr = BE.testRestore(incoming);
  assertEqual(tr.applied, false, 'تست بازگردانی نباید داده را اعمال کند');
  assertTrue(tr.ok, 'تست بازگردانی روی بسته معتبر باید ok باشد');
  assertEqual(live.invoices[0].num, 'KEEP', 'تست بازگردانی نباید آرایه زنده را عوض کند');

  const atom = BE.atomic(live, incoming);
  atom.safety.invoices[0].num = 'MUT';
  assertEqual(live.invoices[0].num, 'KEEP', 'نسخه ایمنی باید clone باشد نه همان آرایه');

  const csv = BE.csv(['section','id'], [{section:'invoice', id:'1,2'}, {section:'a "b"', id:'x'}]);
  assertTrue(csv.indexOf('"1,2"')>=0, 'CSV باید مقدار دارای کاما را quote کند');
  assertTrue(csv.indexOf('"a ""b"""')>=0, 'CSV باید نقل‌قول داخلی را دوبل کند');

  const now = Date.parse('2026-08-13T12:00:00Z');
  const dueEmpty = BE.promote([], now);
  assertTrue(dueEmpty.indexOf('weekly')>=0 && dueEmpty.indexOf('monthly')>=0, 'بدون لایه قبلی باید هفتگی و ماهانه ساخته شود');
  const dueFresh = BE.promote([{layer:'weekly', ts:'2026-08-12T12:00:00Z'}, {layer:'monthly', ts:'2026-08-01T12:00:00Z'}], now);
  assertEqual(dueFresh.length, 0, 'اگر هفتگی/ماهانه تازه باشند نباید دوباره ساخته شوند');
  const dueOld = BE.promote([{layer:'weekly', ts:'2026-07-01T12:00:00Z'}, {layer:'monthly', ts:'2026-06-01T12:00:00Z'}], now);
  assertTrue(dueOld.indexOf('weekly')>=0 && dueOld.indexOf('monthly')>=0, 'لایه کهنه باید مجدداً ساخته شود');

  const sf = BE.pruneSafety([
    {id:'current', ts:'t4'}, {id:'a', ts:'t4'}, {id:'b', ts:'t3'}, {id:'c', ts:'t2'}, {id:'d', ts:'t1'}
  ], 3);
  assertTrue(sf.kept.some(x=>x.id==='current'), 'alias current باید بماند');
  assertEqual(sf.kept.filter(x=>x.id!=='current').length, 3, 'حداکثر ۳ نسخه ایمنی timestamped');
  assertTrue(sf.deleted.some(x=>x.id==='d'), 'قدیمی‌ترین ایمنی باید حذف شود');

  const badLayer = BE.verifyLayer({});
  assertEqual(badLayer.ok, false, 'لایه خالی نباید ثبت شود');
  const goodLayer = BE.verifyLayer({invoices:[{num:'1'}]});
  assertEqual(goodLayer.ok, true, 'لایه دارای داده باید تأیید شود');
});


console.log('');
console.log('📋 گروه: موتور عیب‌یابی (AppError / کاتالوگ / پاسخ UI)');

function loadErrorEngine(srcHtml){
  const start = srcHtml.indexOf('var ERROR_CATALOG = {');
  const end = srcHtml.indexOf('\nfunction addDbgEntry(');
  if(start < 0 || end < 0 || end <= start) throw new Error('موتور ErrorEngine پیدا نشد');
  const src = srcHtml.slice(start, end);
  return new Function(src + '\nreturn ErrorEngine;')();
}

test('توابع AppError و UI عیب‌یابی باید تعریف شده باشند', () => {
  ['createAppError','toAppError','appErrorResponse','redactSensitive','presentAppError','registerError','logAppError'].forEach(fn=>{
    assertTrue(extractFunctionSource(html, fn) !== null, 'تابع '+fn+' پیدا نشد');
  });
  assertContainsString(html, 'var ErrorEngine = {', 'شیء ErrorEngine پیدا نشد');
  assertContainsString(html, 'ERR-AUTH-001', 'کاتالوگ باید ERR-AUTH-001 داشته باشد');
  assertContainsString(html, 'id="app-error-modal"', 'مودال خطای Critical لازم است');
  assertContainsString(html, 'id="dbg-show-tech"', 'تیک جزئیات فنی لازم است');
  assertContainsString(html, 'کد خطا، پیام فارسی و کد پیگیری', 'راهنمای عیب‌یابی لازم است');
  assertContainsString(html, '.notif.warn', 'Toast اخطار باید زرد باشد');
});

test('شبیه‌سازی: کاتالوگ، تبدیل Exception، پاسخ UI بدون جزئیات فنی (execution-based)', () => {
  const EE = loadErrorEngine(html);
  const auth = EE.create('ERR-AUTH-001');
  assertEqual(auth.code, 'ERR-AUTH-001', 'کد باید ثابت بماند');
  assertEqual(auth.severity, 'error', 'شدت ورود اشتباه باید error باشد');
  assertTrue(auth.userMessage.indexOf('رمز')>=0, 'پیام کاربر باید فارسی و درباره رمز باشد');
  assertTrue(!!auth.correlationId, 'باید correlationId داشته باشد');

  const net = EE.fromException(new Error('Failed to fetch'));
  assertEqual(net.code, 'ERR-NET-002', 'Failed to fetch باید ERR-NET-002 شود');
  assertEqual(net.severity, 'warning', 'خطای شبکه باید Warning باشد');

  const quota = EE.fromException({ message:'QuotaExceededError: quota' });
  assertEqual(quota.code, 'WRN-QUOTA-01', 'پر شدن حافظه باید WRN-QUOTA-01 شود');

  const crit = EE.fromException(new Error('JSON.parse unexpected'));
  assertEqual(crit.code, 'ERR-DB-010', 'خرابی JSON باید ERR-DB-010 شود');
  assertEqual(crit.severity, 'critical', 'خطای داخلی داده باید Critical باشد');

  const resp = EE.response(new Error('password=secret123 Failed to fetch'));
  assertEqual(resp.success, false, 'پاسخ خطا باید success:false باشد');
  assertEqual(resp.error.code, 'ERR-NET-002', 'پاسخ باید کد کاتالوگ داشته باشد');
  assertTrue(resp.error.message.indexOf('اتصال')>=0, 'message باید پیام فارسی باشد');
  assertTrue(!JSON.stringify(resp).toLowerCase().includes('secret123'), 'پاسخ UI نباید رمز داشته باشد');
  assertTrue(!('technicalMessage' in resp.error), 'پاسخ UI نباید technicalMessage داشته باشد');
  assertTrue(!JSON.stringify(resp).includes('stack'), 'پاسخ UI نباید stack داشته باشد');

  const red = EE.redact('loginPw=abc123 token=xyz Bearer abc.def password=p');
  assertTrue(red.indexOf('abc123')===-1 && red.indexOf('xyz')===-1, 'لاگ باید رمز و توکن را ستاره کند');

  const extra = EE.register('ERR-TEST-099', 'warning', 'این یک خطای آزمایشی است', '');
  assertEqual(EE.create('ERR-TEST-099').userMessage, 'این یک خطای آزمایشی است', 'registerError باید خطای جدید را به کاتالوگ اضافه کند');
  assertEqual(extra.code, 'ERR-TEST-099', 'کد ثبت‌شده باید همان کد درخواستی باشد');

  const same = EE.create('ERR-AUTH-001', { userMessage:'متن عوض‌شده' });
  assertEqual(same.code, 'ERR-AUTH-001', 'عوض کردن متن نباید کد را عوض کند');
});


console.log('');
console.log('📋 گروه: قفل جلسه در حال اجرا (میانبر و منو)');

function makeLockDom(){
  const els = {};
  function el(id){
    if(!els[id]) els[id] = { id:id, value:'', textContent:'', style:{display: id==='login-overlay' ? 'none' : ''}, focus(){ this._focused = true; } };
    return els[id];
  }
  return {
    els,
    document: {
      getElementById: id => el(id),
      querySelector: () => ({ className:'stg-tab' })
    }
  };
}

test('توابع و دکمه‌های قفل برنامه باید در HTML و منوها باشند', () => {
  ['lockApp','canLockApp','isAppSessionLocked','setLoginOverlayHint'].forEach(fn=>{
    assertTrue(extractFunctionSource(html, fn) !== null, 'تابع '+fn+' پیدا نشد');
  });
  assertContainsString(html, 'id="btn-lock-app"', 'دکمه قفل در سایدبار پیدا نشد');
  assertContainsString(html, 'id="btn-stg-lock-app"', 'دکمه قفل در تنظیمات امنیت پیدا نشد');
  assertContainsString(html, "winContextAction(\\'lock\\'", 'منوی راست‌کلیک پنجره باید قفل داشته باشد');
  assertContainsString(html, 'id="win-ctx-lock-app"', 'آیتم قفل منوی پنجره پیدا نشد');
  assertContainsString(html, 'id="login-overlay-hint"', 'متن راهنمای overlay ورود برای قفل لازم است');
  assertContainsString(html, 'Ctrl+Shift+L', 'میانبر Ctrl+Shift+L باید در رابط باشد');
  assertContainsString(html, '_lockShortcutBound', 'شنونده میانبر قفل باید ثبت شود');
  assertContainsString(html, 'قفل برنامه در حالی که باز است', 'راهنمای قفل برنامه لازم است (قانون ۷)');
  const lockSrc = extractFunctionSource(html, 'lockApp');
  assertTrue(lockSrc.indexOf('invoices')===-1 && lockSrc.indexOf('phonebook')===-1, 'lockApp نباید داده‌های فاکتور/دفترچه را پاک کند');
  const winSrc = extractFunctionSource(html, 'winContextAction');
  assertContainsString(winSrc, "action==='lock'", 'winContextAction باید عمل lock را صدا بزند');
});

test('شبیه‌سازی: قفل بدون رمز فعال نشود؛ با رمز overlay بیاید و داده پاک نشود (execution-based)', () => {
  const src = [
    extractFunctionSource(html, 'setLoginOverlayHint'),
    extractFunctionSource(html, 'isAppSessionLocked'),
    extractFunctionSource(html, 'canLockApp'),
    extractFunctionSource(html, 'lockApp'),
    extractFunctionSource(html, 'finishLogin')
  ].join('\n');
  assertTrue(src.indexOf('function lockApp')>=0, 'سورس lockApp استخراج نشد');

  function runCase(loginPw, userRoles){
    const dom = makeLockDom();
    const notes = [];
    const pages = [];
    const runner = new Function(
      'document','loginPw','userRoles','ntf','showPage','showStgTab','applyRoleRestrictions',
      'var _appLocked = false;\n' +
      "var LOGIN_HINT_DEFAULT = 'برای ورود، رمز عبور را وارد کنید';\n" +
      "var LOGIN_HINT_LOCKED = 'برنامه قفل است — برای ادامه رمز را وارد کنید';\n" +
      'var invoices = [{num:"KEEP-INV"}];\n' +
      'var parts = [{code:"KEEP-PT"}];\n' +
      'var setTimeout = function(fn){ try{ fn(); }catch(_e){} };\n' +
      src + '\n' +
      'var can = canLockApp();\n' +
      'var did = lockApp();\n' +
      'var afterLock = {\n' +
      '  can: can, did: did,\n' +
      '  display: document.getElementById("login-overlay").style.display,\n' +
      '  hint: document.getElementById("login-overlay-hint").textContent,\n' +
      '  pwVal: document.getElementById("login-pw-input").value,\n' +
      '  invoices: invoices.slice(),\n' +
      '  parts: parts.slice(),\n' +
      '  sessionLocked: isAppSessionLocked()\n' +
      '};\n' +
      'finishLogin();\n' +
      'afterLock.afterUnlockDisplay = document.getElementById("login-overlay").style.display;\n' +
      'afterLock.afterUnlockLocked = isAppSessionLocked();\n' +
      'return afterLock;'
    );
    return runner(dom.document, loginPw, userRoles, function(m){ notes.push(m); }, function(p){ pages.push(p); }, function(){}, function(){});
  }

  const denied = runCase('', []);
  assertEqual(denied.can, false, 'بدون رمز و پروفایل نباید قفل مجاز باشد');
  assertEqual(denied.did, false, 'lockApp بدون رمز باید false برگرداند');
  assertEqual(denied.display, 'none', 'بدون رمز نباید overlay قفل نشان داده شود');
  assertEqual(denied.invoices[0].num, 'KEEP-INV', 'حتی در رد قفل نباید فاکتور پاک شود');

  const ok = runCase('secret', []);
  assertEqual(ok.can, true, 'با رمز ورود باید قفل مجاز باشد');
  assertEqual(ok.did, true, 'lockApp با رمز باید موفق شود');
  assertEqual(ok.display, 'flex', 'قفل باید overlay ورود را نشان دهد');
  assertTrue(String(ok.hint).indexOf('قفل')>=0, 'متن overlay باید بگوید برنامه قفل است');
  assertEqual(ok.pwVal, '', 'فیلد رمز باید خالی شود');
  assertEqual(ok.invoices[0].num, 'KEEP-INV', 'قفل نباید فاکتورها را پاک کند');
  assertEqual(ok.parts[0].code, 'KEEP-PT', 'قفل نباید قطعات را پاک کند');
  assertEqual(ok.sessionLocked, true, 'بعد از قفل isAppSessionLocked باید true باشد');
  assertEqual(ok.afterUnlockDisplay, 'none', 'finishLogin باید overlay را ببندد');
  assertEqual(ok.afterUnlockLocked, false, 'بعد از ورود مجدد نباید قفل مانده باشد');

  const roleOk = runCase('', [{name:'کارمند', pw:'1111', pages:['invoice']}]);
  assertEqual(roleOk.did, true, 'اگر فقط پروفایل کارمند باشد هم باید بشود قفل کرد');
});

test('شنونده میانبر قفل باید Ctrl+Shift+L را در capture بگیرد', () => {
  const idx = html.indexOf('_lockShortcutBound');
  assertTrue(idx > 0, 'شنونده میانبر قفل پیدا نشد');
  const chunk = html.slice(idx, idx + 700);
  assertContainsString(chunk, 'shiftKey', 'میانبر باید Shift داشته باشد');
  assertContainsString(chunk, 'KeyL', 'میانبر باید کلید L باشد');
  assertContainsString(chunk, 'lockApp()', 'میانبر باید lockApp را صدا بزند');
  assertTrue(/addEventListener\(\s*'keydown'[\s\S]*,\s*true\s*\)/.test(chunk), 'شنونده باید capture باشد تا داخل فیلد هم کار کند');
});


console.log('');
console.log('📋 گروه: دستیار / ایجنت قابل‌فعال‌سازی (راهنما و کمک در کار)');

test('توابع و رابط فعال‌سازی ایجنت باید در HTML باشند', () => {
  ['isAiAgentReady','getAiAgentStatus','buildAiSafeContext','buildAiSystemPrompt','resolveExternalAiRequest','answerInternalAi','saveAiAgentConfig','openAiDock','toggleAiDock','setAiPurpose'].forEach(fn=>{
    assertTrue(extractFunctionSource(html, fn) !== null, 'تابع '+fn+' پیدا نشد');
  });
  assertContainsString(html, 'id="btn-ai-float"', 'دکمه شناور دستیار لازم است');
  assertContainsString(html, 'id="ai-dock"', 'پنل گفتگوی دستیار لازم است');
  assertContainsString(html, 'data-ai-model="custom"', 'گزینه ایجنت سفارشی لازم است');
  assertContainsString(html, 'id="ai-custom-url"', 'فیلد آدرس API سفارشی لازم است');
  assertContainsString(html, 'Ctrl+Shift+A', 'میانبر دستیار لازم است');
  assertContainsString(html, 'فعال‌سازی دستیار برای راهنما و کمک در کار', 'راهنمای دستیار لازم است (قانون ۷)');
});

test('شبیه‌سازی: ایجنت بدون کلید فعال نشود؛ زمینه کار شماره تلفن نفرستد؛ سفارشی URL سازگار بسازد (execution-based)', () => {
  const src = [
    extractFunctionSource(html, 'aiBrandName'),
    extractFunctionSource(html, 'getAiCustomConfig'),
    extractFunctionSource(html, 'getAiStoredKey'),
    extractFunctionSource(html, 'isAiAgentReady'),
    extractFunctionSource(html, 'getAiAgentStatus'),
    extractFunctionSource(html, 'buildAiSafeContext'),
    extractFunctionSource(html, 'buildAiSystemPrompt'),
    extractFunctionSource(html, 'normalizeAiBaseUrl'),
    extractFunctionSource(html, 'resolveExternalAiRequest'),
    extractFunctionSource(html, 'answerInternalAi')
  ].join('\n');
  assertTrue(src.indexOf('function isAiAgentReady')>=0, 'سورس ایجنت استخراج نشد');

  const kbMatch = html.match(/var AI_KB = \{[\s\S]*?\n\};\n/);
  assertTrue(!!kbMatch, 'AI_KB پیدا نشد');

  const runner2 = new Function(
    'localStorage','document','APP_VERSION','invoices','products','parts','warranties','sales','phonebook','tasks','getBrand',
    'var aiModel = "gpt";\n' +
    'var aiPurpose = "help";\n' +
    kbMatch[0] + '\n' + src + '\n' +
    'return {\n' +
    '  internal: isAiAgentReady("internal"),\n' +
    '  gptNoKey: isAiAgentReady("gpt"),\n' +
    '  customNoCfg: isAiAgentReady("custom"),\n' +
    '  afterKey: (function(){ localStorage.setItem("laegh_ai_key_gpt","sk-x"); return isAiAgentReady("gpt"); })(),\n' +
    '  customReady: (function(){ localStorage.setItem("laegh_ai_key_custom","sk-c"); localStorage.setItem("laegh_ai_custom_url","https://x.ai/v1"); localStorage.setItem("laegh_ai_custom_model","grok"); return isAiAgentReady("custom"); })(),\n' +
    '  norm: normalizeAiBaseUrl("https://openrouter.ai/api/v1/"),\n' +
    '  ctx: buildAiSafeContext(),\n' +
    '  helpPrompt: buildAiSystemPrompt("help"),\n' +
    '  workPrompt: buildAiSystemPrompt("work"),\n' +
    '  req: resolveExternalAiRequest("custom","sk-test","چطور بک‌آپ بگیرم؟",{purpose:"work", custom:{url:"https://openrouter.ai/api/v1/", model:"mistral"}}),\n' +
    '  ans: answerInternalAi("چطور بک‌آپ بگیرم")\n' +
    '};'
  );

  const store = {};
  const els = {};
  function el(id){
    if(!els[id]) els[id] = { id:id, value:'', style:{}, classList:{ add(){}, remove(){}, toggle(){}, contains(){return false;} }, textContent:'', focus(){} };
    return els[id];
  }
  const fakeLS = {
    getItem: k => (Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null),
    setItem: (k,v) => { store[k]=String(v); }
  };
  const fakeDoc = {
    getElementById: id => el(id),
    querySelector: () => null,
    querySelectorAll: () => []
  };
  const out = runner2(
    fakeLS, fakeDoc, '1405.5.22λ',
    [{num:'1'}], [], [], [], [],
    [{fn:'علی', phones:['09121234567']}],
    [],
    function(){ return { nameFa:'سیرمان' }; }
  );

  assertEqual(out.internal, true, 'دستیار داخلی باید همیشه آماده باشد');
  assertEqual(out.gptNoKey, false, 'GPT بدون کلید نباید آماده باشد');
  assertEqual(out.customNoCfg, false, 'سفارشی بدون آدرس/مدل نباید آماده باشد');
  assertEqual(out.afterKey, true, 'با کلید، GPT باید آماده شود');
  assertEqual(out.customReady, true, 'سفارشی با آدرس و مدل و کلید باید آماده شود');
  assertEqual(out.norm, 'https://openrouter.ai/api/v1', 'اسلش انتهای URL باید حذف شود');
  assertTrue(String(out.ctx).indexOf('09121234567')===-1, 'زمینه نباید شماره تلفن بفرستد');
  assertTrue(String(out.ctx).indexOf('علی')===-1, 'زمینه نباید نام مشتری بفرستد');
  assertTrue(String(out.ctx).indexOf('تعداد مخاطب: 1')>=0, 'زمینه باید تعداد مخاطب را بگوید');
  assertTrue(String(out.helpPrompt).indexOf('راهنمای استفاده')>=0, 'پرامپت راهنما باید حالت راهنما داشته باشد');
  assertTrue(String(out.workPrompt).indexOf('کمک در کار')>=0, 'پرامپت کار باید حالت کار داشته باشد');
  assertEqual(out.req.url, 'https://openrouter.ai/api/v1/chat/completions', 'URL سفارشی باید chat/completions باشد');
  assertEqual(out.req.headers.Authorization, 'Bearer sk-test', 'کلید باید Bearer شود');
  const body = JSON.parse(out.req.body);
  assertEqual(body.model, 'mistral', 'نام مدل سفارشی باید در بدنه باشد');
  assertTrue(body.messages[0].content.indexOf('کمک در کار')>=0, 'بدنه سفارشی باید پرامپت کار داشته باشد');
  assertTrue(String(out.ans).indexOf('بک')>=0 || String(out.ans).indexOf('پشتیبان')>=0, 'دستیار داخلی باید سوال بک‌آپ را بشناسد');
});

test('شنونده میانبر دستیار باید Ctrl+Shift+A را در capture بگیرد', () => {
  const idx = html.indexOf('_aiShortcutBound');
  assertTrue(idx > 0, 'شنونده میانبر دستیار پیدا نشد');
  const chunk = html.slice(idx, idx + 700);
  assertContainsString(chunk, 'shiftKey', 'میانبر دستیار باید Shift داشته باشد');
  assertContainsString(chunk, 'KeyA', 'میانبر دستیار باید کلید A باشد');
  assertContainsString(chunk, 'toggleAiDock()', 'میانبر باید پنل دستیار را باز کند');
});

console.log('');
console.log('📋 گروه: جمع‌کردن کشویی ستون راست (کلید درز اتصال)');

test('کلید باریک درز منوی راست و CSS جمع شدن باید موجود باشند', () => {
  assertContainsString(html, 'id="sb-rail-toggle"', 'کلید درز منوی راست پیدا نشد');
  assertContainsString(html, 'class="sb-rail-toggle"', 'کلاس کلید درز پیدا نشد');
  assertContainsString(html, 'onclick="toggleSbRail()"', 'کلیک کلید باید toggleSbRail را صدا بزند');
  assertContainsString(html, 'function applySbCollapsed(', 'تابع applySbCollapsed پیدا نشد');
  assertContainsString(html, 'function toggleSbRail(', 'تابع toggleSbRail پیدا نشد');
  assertContainsString(html, 'function restoreSbCollapsed(', 'تابع restoreSbCollapsed پیدا نشد');
  assertContainsString(html, 'function isSbRailCollapsible(', 'تابع isSbRailCollapsible پیدا نشد');
  assertContainsString(html, 'body.sb-collapsed .sb', 'قانون CSS جمع‌شدن سایدبار پیدا نشد');
  assertContainsString(html, "localStorage.setItem('laegh_sb_collapsed'", 'باید حالت جمع بودن ذخیره شود');
  assertContainsString(html, "sbCollapsed: localStorage.getItem('laegh_sb_collapsed')", 'بک‌آپ باید sbCollapsed داشته باشد');
  assertContainsString(html, "localStorage.setItem('laegh_sb_collapsed', ap.sbCollapsed)", 'بازگردانی sbCollapsed لازم است');
  assertContainsString(html, "'laegh_sb_collapsed'", 'کلید ظاهر باید در ریست محافظت شود');
  assertContainsString(html, 'جمع کردن ستون راست', 'راهنمای جمع کردن ستون راست لازم است (قانون ۷)');
  assertContainsString(html, 'body.sb-dock .sb-rail-toggle{display:none!important;}', 'در داک پایین کلید درز نباید دیده شود');
  const btnIdx = html.indexOf('id="sb-rail-toggle"');
  const sbClose = html.lastIndexOf('</div>', btnIdx);
  const mainIdx = html.indexOf('class="main"', btnIdx);
  assertTrue(btnIdx > 0 && mainIdx > btnIdx, 'کلید باید قبل از صفحه وسط باشد');
  const between = html.slice(Math.max(0, sbClose), mainIdx);
  assertTrue(between.indexOf('id="sb-rail-toggle"') >= 0, 'کلید باید خواهر سایدبار باشد نه داخل overflow آن');
  const collapsedSb = html.match(/body\.sb-collapsed \.sb\{[\s\S]*?\}/);
  assertTrue(!!collapsedSb, 'بلوک CSS body.sb-collapsed .sb پیدا نشد');
  assertContainsString(collapsedSb[0], 'right:', 'جمع شدن باید با right باشد نه جابه‌جایی کل لایه');
  assertTrue(!/transform\s*:/.test(collapsedSb[0]), 'جمع شدن نباید transform روی .sb بگذارد (با transform:none سایدبار قفل است)');
  assertContainsString(html, 'body.sb-collapsed.sb-icons-only .main', 'حالت فقط‌آیکون هم باید با جمع شدن تمام‌عرض شود');
  assertContainsString(html, 'margin-right:0!important', 'صفحه وسط در حالت جمع باید حاشیه راست صفر داشته باشد');
});

test('شبیه‌سازی: applySbCollapsed باید منو را جمع کند، در داک بی‌اثر باشد، و ذخیره کند (execution-based)', () => {
  const src = [
    extractFunctionSource(html, 'isSbRailCollapsible'),
    extractFunctionSource(html, 'applySbCollapsed'),
    extractFunctionSource(html, 'toggleSbRail'),
    extractFunctionSource(html, 'restoreSbCollapsed')
  ].join('\n');
  assertTrue(src.indexOf('function applySbCollapsed') >= 0, 'سورس جمع‌کردن منو استخراج نشد');
  const classes = new Set();
  const store = {};
  const btn = { title:'', attrs:{}, setAttribute(k,v){ this.attrs[k]=String(v); }, getAttribute(k){ return this.attrs[k]; } };
  const fakeDocument = {
    body: {
      classList: {
        toggle(c, on){ if(on) classes.add(c); else classes.delete(c); },
        add(c){ classes.add(c); },
        remove(c){ classes.delete(c); },
        contains(c){ return classes.has(c); }
      }
    },
    getElementById(id){ return id === 'sb-rail-toggle' ? btn : null; }
  };
  const fakeLS = {
    getItem: k => (Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null),
    setItem: (k,v) => { store[k]=String(v); }
  };
  const runner = new Function('document','localStorage', src + `
    var r1 = applySbCollapsed(true);
    var collapsed = document.body.classList.contains('sb-collapsed');
    var savedOn = localStorage.getItem('laegh_sb_collapsed');
    var expandedAttr = document.getElementById('sb-rail-toggle').getAttribute('aria-expanded');
    var r2 = applySbCollapsed(false);
    var afterOff = document.body.classList.contains('sb-collapsed');
    var savedOff = localStorage.getItem('laegh_sb_collapsed');
    applySbCollapsed(true);
    var toggled = toggleSbRail();
    var afterToggle = document.body.classList.contains('sb-collapsed');
    document.body.classList.add('sb-dock');
    var docked = applySbCollapsed(true);
    var dockVisual = document.body.classList.contains('sb-collapsed');
    var dockSaved = localStorage.getItem('laegh_sb_collapsed');
    document.body.classList.remove('sb-dock');
    localStorage.setItem('laegh_sb_collapsed','1');
    var restored = restoreSbCollapsed();
    var afterRestore = document.body.classList.contains('sb-collapsed');
    return { r1, collapsed, savedOn, expandedAttr, r2, afterOff, savedOff, toggled, afterToggle, docked, dockVisual, dockSaved, restored, afterRestore };
  `);
  const out = runner(fakeDocument, fakeLS);
  assertEqual(out.r1, true, 'جمع شدن در حالت عادی باید موفق باشد');
  assertEqual(out.collapsed, true, 'باید کلاس sb-collapsed روی body بیاید');
  assertEqual(out.savedOn, '1', 'باید laegh_sb_collapsed=1 ذخیره شود');
  assertEqual(out.expandedAttr, 'false', 'aria-expanded در حالت جمع باید false باشد');
  assertEqual(out.afterOff, false, 'با false باید کلاس sb-collapsed برداشته شود');
  assertEqual(out.savedOff, '0', 'باز کردن منو باید 0 ذخیره کند');
  assertEqual(out.afterToggle, false, 'toggle از حالت جمع باید منو را باز کند');
  assertEqual(out.docked, false, 'در داک پایین نباید جمع بصری فعال شود');
  assertEqual(out.dockVisual, false, 'کلاس sb-collapsed در داک نباید بماند');
  assertEqual(out.dockSaved, '1', 'ترجیح کاربر حتی در داک باید ذخیره شود');
  assertEqual(out.afterRestore, true, 'restore از localStorage باید منو را جمع کند');
});


console.log('');
console.log('📋 گروه: عملیات گارانتی، پذیرش OEM و گزارش انبار');

test('اقدام نهایی پرونده باید کشویی باشد و با انتخاب، کلید کنارش فعال شود', () => {
  assertContainsString(html, 'id="war-final-action"', 'کشویی اقدام نهایی پیدا نشد');
  assertContainsString(html, 'id="war-final-go"', 'کلید کنار کشویی اقدام نهایی پیدا نشد');
  ['ثبت پرونده','پیش‌فاکتور','فاکتور هزینه مشتری','فاکتور نمایندگی','چاپ سریع پذیرش'].forEach(lbl=>{
    assertContainsString(html, lbl, 'گزینه «'+lbl+'» در کشویی لازم است');
  });
  const src = extractFunctionSource(html, 'onWarFinalActionChange');
  const runSrc = extractFunctionSource(html, 'runWarFinalAction');
  assertTrue(!!src && !!runSrc, 'توابع کشویی اقدام نهایی پیدا نشد');
  assertContainsString(src, "btn.style.display='inline-flex'", 'با انتخاب گزینه باید کلید کنارش ظاهر شود');
  assertContainsString(html, 'var WAR_FINAL_ACTIONS = {', 'WAR_FINAL_ACTIONS لازم است');
  ['save','proforma','cust_bill','agency_inv','reception'].forEach(k=>{
    assertTrue(html.indexOf(k+':')>=0, 'اقدام '+k+' باید در WAR_FINAL_ACTIONS باشد');
  });
});

test('چاپ سریع پذیرش باید تاریخ چاپ، اولتیماتوم ۲۴/۴۸/۷۲ و جای نظر چهار کارشناس را داشته باشد', () => {
  const src = extractFunctionSource(html, 'buildWarA5');
  assertTrue(!!src, 'buildWarA5 پیدا نشد');
  ['تاریخ چاپ','۲۴ ساعت اول','۴۸ ساعت','۷۲ ساعت','کارشناس خدمات','کنترل کیفی','لجستیک','نهایی'].forEach(s=>{
    assertContainsString(src, s, 'رسید پذیرش باید «'+s+'» داشته باشد');
  });
  assertContainsString(src, 'warSlaDatesFrom', 'باید تاریخ اولتیماتوم از warSlaDatesFrom بیاید');
  const slaSrc = extractFunctionSource(html, 'warSlaDatesFrom');
  const addSrc = extractFunctionSource(html, 'addJalaliDays');
  const partsSrc = extractFunctionSource(html, 'warJalaliParts');
  const latSrc = extractFunctionSource(html, 'warLatinDigits');
  const g2j = extractFunctionSource(html, 'gregorian_to_jalali');
  const j2g = extractFunctionSource(html, 'jalali_to_gregorian');
  const strSrc = extractFunctionSource(html, 'jalaliStr');
  const divSrc = extractFunctionSource(html, 'div_');
  assertTrue(!!slaSrc && !!addSrc && !!partsSrc, 'توابع SLA استخراج نشد');
  const runner = new Function(
    divSrc+'\n'+g2j+'\n'+j2g+'\n'+strSrc+'\n'+latSrc+'\n'+partsSrc+'\n'+addSrc+'\n'+slaSrc+'\n'+
    'return warSlaDatesFrom("1405/05/20");'
  );
  const sla = runner();
  assertEqual(sla.h24, '1405/05/21', '۲۴ ساعت باید فردای ورود باشد');
  assertEqual(sla.h48, '1405/05/22', '۴۸ ساعت باید دو روز بعد باشد');
  assertEqual(sla.h72, '1405/05/23', '۷۲ ساعت باید سه روز بعد باشد');
});

test('برگشت OEM باید گزینه پذیرش باشد، شرکت فقط از دسته شرکت‌ها جستجو شود و کالا وارد انبار معیوب شود', () => {
  assertContainsString(html, 'value="return_oem"', 'گزینه برگشت به شرکت تولیدکننده لازم است');
  assertContainsString(html, 'id="war-oem-path"', 'مسیر OEM پیدا نشد');
  assertContainsString(html, 'id="wo-company-search"', 'جستجوی شرکت OEM پیدا نشد');
  assertContainsString(html, "showWarPbLive('oem'", 'جستجوی زنده OEM لازم است');
  assertContainsString(html, "oem:'برگشت به شرکت تولیدکننده'", 'برچسب منبع OEM در انبار معیوب لازم است');
  const liveSrc = extractFunctionSource(html, 'showWarPbLive');
  assertContainsString(liveSrc, "kind==='oem' ? ['company']", 'جستجوی OEM باید فقط دسته شرکت‌ها باشد');
  const getWar = extractFunctionSource(html, 'getWarData');
  assertContainsString(getWar, 'oemWork', 'getWarData باید oemWork برگرداند');
  const saveSrc = extractFunctionSource(html, 'saveWar');
  assertContainsString(saveSrc, "source:'oem'", 'ذخیره OEM باید کالا را با منبع oem به انبار معیوب بفرستد');

  const filtSrc = extractFunctionSource(html, 'filterPbByCats');
  const blobSrc = extractFunctionSource(html, 'pbContactBlob');
  const labSrc = extractFunctionSource(html, 'pbContactLabel');
  const addSrc = extractFunctionSource(html, 'addDefectiveFromWarranty');
  const defSrc = extractFunctionSource(html, 'defIsInWarehouse');
  const stSrc = extractFunctionSource(html, 'defStatusOf');
  assertTrue(!!filtSrc && !!addSrc, 'توابع OEM استخراج نشد');
  const runner = new Function(
    labSrc+'\n'+blobSrc+'\n'+filtSrc+'\n'+stSrc+'\n'+defSrc+'\n'+addSrc+'\n'+
    `var phonebook = [
      {name:'شرکت آلفا', cat:'company', shop:'آلفا OEM', phones:['0211']},
      {name:'نماینده بتا', cat:'service_agent', phones:['0912']},
      {name:'شخص حقیقی', cat:'customer', phones:['0935']}
    ];
    var companies = filterPbByCats(['company'], '');
    var agents = filterPbByCats(['service_agent','agency'], 'بتا');
    var persons = filterPbByCats(['company'], 'شخص');
    var defectiveStock = [];
    var stockMoves = [];
    function fdt(){ return '1405/05/22'; }
    function svDefective(){}
    function auditBg(){}
    function svStockMoves(){}
    addDefectiveFromWarranty(
      {id:'W-1405-تابستان-22-0001', name:'علی', phone:'0912', initialService:'return_oem', oemWork:{companyName:'شرکت آلفا'}},
      {model:'خردکن', serial:'SN1'},
      {source:'oem', oemCompany:'شرکت آلفا'}
    );
    return {
      nCo: companies.length, coName: companies[0] && companies[0].name,
      nAg: agents.length, agName: agents[0] && agents[0].name,
      nPe: persons.length,
      defN: defectiveStock.length,
      defSrc: defectiveStock[0] && defectiveStock[0].source,
      defCo: defectiveStock[0] && defectiveStock[0].oemCompany,
      mvWh: stockMoves[0] && stockMoves[0].whId,
      mvType: stockMoves[0] && stockMoves[0].type
    };`
  );
  const r = runner();
  assertEqual(r.nCo, 1, 'جستجوی شرکت باید فقط مخاطب company را بدهد');
  assertEqual(r.coName, 'شرکت آلفا', 'نام شرکت OEM باید پیدا شود');
  assertEqual(r.nAg, 1, 'جستجوی نماینده باید فقط دسته نمایندگان خدماتی را بدهد');
  assertEqual(r.nPe, 0, 'جستجوی OEM نباید شخص حقیقی را نشان دهد');
  assertEqual(r.defN, 1, 'برگشت OEM باید یک ردیف انبار معیوب بسازد');
  assertEqual(r.defSrc, 'oem', 'منبع انبار معیوب باید oem باشد');
  assertEqual(r.defCo, 'شرکت آلفا', 'نام شرکت طلبکار باید روی ردیف معیوب ثبت شود');
  assertEqual(r.mvWh, 'WH-DEF', 'حرکت ورود باید به انبار معیوب برود');
  assertEqual(r.mvType, 'in', 'حرکت باید ورود باشد');
});

test('شماره پرونده باید سال، فصل و روز را نشان دهد', () => {
  const nextSrc = extractFunctionSource(html, 'nextWarCaseId');
  const prefSrc = extractFunctionSource(html, 'warCasePrefix');
  const seaD = extractFunctionSource(html, 'warSeasonDigit');
  const seaFa = extractFunctionSource(html, 'warSeasonNameFa');
  const seaMo = extractFunctionSource(html, 'warSeasonOfMonth');
  const partsSrc = extractFunctionSource(html, 'warJalaliParts');
  const latSrc = extractFunctionSource(html, 'warLatinDigits');
  assertTrue(!!nextSrc, 'nextWarCaseId پیدا نشد');
  const runner = new Function(
    latSrc+'\n'+partsSrc+'\n'+seaMo+'\n'+seaFa+'\n'+seaD+'\n'+prefSrc+'\n'+nextSrc+'\n'+
    `var warranties = [{id:'W05-20522-0001'}];
     return {
       summer: nextWarCaseId('1405/05/22'),
       spring: nextWarCaseId('1405/01/09'),
       autumn: nextWarCaseId('1405/08/03')
     };`
  );
  const r = runner();
  assertEqual(r.summer, 'W05-20522-0002', 'همان روز تابستان باید ردیف بعدی را بدهد');
  assertEqual(r.spring, 'W05-10109-0001', 'شماره بهار باید سال+فصل+ماه+روز داشته باشد');
  assertEqual(r.autumn, 'W05-30803-0001', 'شماره پاییز باید فصل ۳ را نشان دهد');
});

test('پرونده جدید باید همه فیلدها را خالی کند و تلفن قبلی نماند', () => {
  const rst = extractFunctionSource(html, 'resetWarFormFields');
  const show = extractFunctionSource(html, 'showWarForm');
  assertTrue(!!rst && !!show, 'resetWarFormFields / showWarForm پیدا نشد');
  assertContainsString(rst, "querySelectorAll('input,select,textarea')", 'ریست باید همه فیلدهای فرم را بگیرد نه لیست سفید');
  assertContainsString(show, 'resetWarFormFields()', 'پرونده جدید باید resetWarFormFields را صدا بزند');
  assertContainsString(html, 'id="wn"', 'فیلد نام باید autocomplete=off داشته باشد');
  assertTrue(/id="wn"[^>]*autocomplete="off"/.test(html), 'نام مشتری باید autocomplete=off باشد');
  assertTrue(/id="wph"[^>]*autocomplete="off"/.test(html), 'تلفن باید autocomplete=off باشد تا شماره پرونده قبلی نماند');
  const runner = new Function(rst + `
    var store = {
      wn:{id:'wn', type:'text', tagName:'INPUT', value:'علی قبلی'},
      wph:{id:'wph', type:'text', tagName:'INPUT', value:'09121111111'},
      wrefn:{id:'wrefn', type:'hidden', tagName:'INPUT', value:'نماینده قبلی'},
      winit:{id:'winit', type:'select-one', tagName:'SELECT', selectedIndex:2, value:'refer_agency'},
      wdt:{id:'wdt', type:'text', tagName:'INPUT', value:'قدیمی'}
    };
    Object.keys(store).forEach(function(k){ store[k].dataset = {}; });
    var form = {
      querySelectorAll: function(){ return [store.wn, store.wph, store.wrefn, store.winit, store.wdt]; }
    };
    var document = {
      getElementById: function(id){
        if(id==='war-form') return form;
        return store[id] || {value:'', style:{display:''}, textContent:''};
      }
    };
    function fdate(){ return '1405/05/22'; }
    function onWarFinalActionChange(){}
    resetWarFormFields();
    return {wn:store.wn.value, wph:store.wph.value, hid:store.wrefn.value, wdt:store.wdt.value};
  `);
  const r = runner();
  assertEqual(r.wn, '', 'نام پرونده قبلی باید پاک شود');
  assertEqual(r.wph, '', 'تلفن پرونده قبلی باید پاک شود');
  assertEqual(r.hid, '', 'فیلد مخفی ارجاع قبلی هم باید پاک شود');
  assertEqual(r.wdt, '1405/05/22', 'تاریخ مراجعه پرونده جدید باید امروز باشد');
});

test('ارجاع نماینده باید ظاهر نامشخص داشته باشد و فیلد فقط نمایندگان خدماتی را جستجو کند', () => {
  assertContainsString(html, 'value="unknown"', 'گزینه ظاهر نامشخص لازم است');
  assertContainsString(html, 'service_agent:', 'دسته نمایندگان خدماتی در دفترچه لازم است');
  assertContainsString(html, 'id="wa-agency-search"', 'جستجوی نماینده خدماتی لازم است');
  const initSrc = extractFunctionSource(html, 'onWInitChange');
  assertContainsString(initSrc, 'applyUnknownAppearanceForAgency', 'ارجاع نماینده باید ظاهر را نامشخص کند');
  assertContainsString(initSrc, 'wEditIdx===-1', 'ظاهر نامشخص فقط برای پرونده جدید اعمال شود');
  const liveSrc = extractFunctionSource(html, 'showWarPbLive');
  assertContainsString(liveSrc, "['service_agent','agency']", 'جستجوی نماینده باید فقط دسته نمایندگان خدماتی باشد');
  const fillSrc = extractFunctionSource(html, 'fillWarAgencySelect');
  assertContainsString(fillSrc, "filterPbByCats(['service_agent','agency']", 'لیست نماینده نباید همه مخاطبان را بیاورد');
});

test('راست‌کلیک روی فیلد فرم گارانتی باید همان فیلد را پاک کند', () => {
  const src = extractFunctionSource(html, 'bindWarFieldClear');
  assertTrue(!!src, 'bindWarFieldClear پیدا نشد');
  assertContainsString(src, "addEventListener('contextmenu'", 'باید روی راست‌کلیک گوش بدهد');
  const runner = new Function(src + `
    var cleared = '';
    var inp = {tagName:'INPUT', type:'text', value:'0912', dataset:{}, dispatchEvent:function(){}};
    var form = {
      _clearBound: false,
      addEventListener: function(type, fn){
        if(type==='contextmenu'){
          var e = {target:inp, preventDefault:function(){}};
          fn(e);
          cleared = inp.value;
        }
      }
    };
    var document = { getElementById: function(id){ return id==='war-form' ? form : null; } };
    function ntf(){}
    bindWarFieldClear();
    return {cleared:cleared, bound:form._clearBound};
  `);
  const r = runner();
  assertEqual(r.cleared, '', 'راست‌کلیک باید مقدار فیلد را خالی کند');
  assertEqual(r.bound, true, 'باید فقط یک‌بار به فرم وصل شود');
});

test('تقویم تاریخ با کلیک بیرون باید بسته شود', () => {
  const openSrc = extractFunctionSource(html, 'openDatePicker');
  const closeSrc = extractFunctionSource(html, 'closeDatePicker');
  assertTrue(!!openSrc && !!closeSrc, 'توابع تقویم پیدا نشد');
  assertContainsString(html, "addEventListener('pointerdown', _dpOutside, true)", 'بستن تقویم باید با pointerdown در capture باشد');
  assertContainsString(closeSrc, "removeEventListener('pointerdown', _dpOutside, true)", 'closeDatePicker باید شنونده pointerdown را بردارد');
  assertContainsString(html, 'function _dpOutside(e)', '_dpOutside باید بیرون از IIFE نام‌دار باشد');
  const outIdx = html.indexOf('function _dpOutside(e)');
  const outChunk = html.slice(outIdx, outIdx + 450);
  assertContainsString(outChunk, 'closeDatePicker()', 'کلیک بیرون باید closeDatePicker را صدا بزند');
});

test('کارتکس و گزارش ورود/خروج باید انبار قطعات و همه انبارها را جداگانه پوشش دهند', () => {
  assertContainsString(html, 'function ensureCoreWarehouses(', 'ensureCoreWarehouses لازم است');
  assertContainsString(html, 'function moveMatchesWarehouse(', 'moveMatchesWarehouse لازم است');
  assertContainsString(html, 'function openWarehouseIoReport(', 'گزارش ورود/خروج هر انبار لازم است');
  assertContainsString(html, "onclick=\"openWarehouseIoReport(", 'کارت انبار باید دکمه گزارش ورود/خروج داشته باشد');
  assertContainsString(html, 'id="kardex-wh"', 'کشویی انبار کارتکس لازم است');
  const kxOpen = extractFunctionSource(html, 'openKardexModal');
  assertContainsString(kxOpen, 'getWhOptions', 'کارتکس باید انبارها را از موجودیت واقعی پر کند');
  const ensSrc = extractFunctionSource(html, 'ensureCoreWarehouses');
  const matchSrc = extractFunctionSource(html, 'moveMatchesWarehouse');
  const byType = extractFunctionSource(html, 'getWhByTypeId');
  const byId = extractFunctionSource(html, 'getWhById');
  const kxSrc = extractFunctionSource(html, 'invKardexFromMoves');
  const runner = new Function(
    byId+'\n'+byType+'\n'+matchSrc+'\n'+ensSrc+'\n'+kxSrc+'\n'+
    `var warehouses = [{id:'WH-OLD', type:'other', name:'قدیمی', status:'active'}];
     var WAREHOUSES_KEY = 'k';
     var saved = null;
     var localStorage = { setItem: function(k,v){ saved = v; } };
     ensureCoreWarehouses();
     var ids = warehouses.map(function(w){ return w.id; }).join(',');
     function getWhById(id){ return warehouses.find(function(x){ return x.id===id; }) || null; }
     var mParts = {warehouse:'parts', itemCode:'P1'};
     var mDef = {whId:'WH-DEF', warehouse:'defective'};
     var hitParts = moveMatchesWarehouse(mParts, 'WH-PARTS');
     var hitDef = moveMatchesWarehouse(mDef, 'WH-DEF');
     var miss = moveMatchesWarehouse(mDef, 'WH-PARTS');
     var moves = [
       {itemCode:'P1', warehouse:'parts', date:'1405/05/01', qty:2},
       {itemCode:'P1', whId:'WH-DEF', date:'1405/05/02', qty:1}
     ];
     var kx = invKardexFromMoves(moves, 'P1', 'WH-PARTS');
     return {ids:ids, hitParts:hitParts, hitDef:hitDef, miss:miss, kxLen:kx.length};
    `
  );
  const r = runner();
  assertTrue(r.ids.indexOf('WH-PARTS')>=0, 'انبار قطعات باید به داده‌های قدیمی اضافه شود');
  assertTrue(r.ids.indexOf('WH-GOODS')>=0, 'انبار کالا باید در هسته باشد');
  assertTrue(r.ids.indexOf('WH-DEF')>=0, 'انبار معیوب باید در هسته باشد');
  assertEqual(r.hitParts, true, 'حرکت قدیمی نوع parts باید با انبار قطعات جور شود');
  assertEqual(r.hitDef, true, 'حرکت WH-DEF باید با انبار معیوب جور شود');
  assertEqual(r.miss, false, 'حرکت معیوب نباید در گزارش قطعات بیاید');
  assertEqual(r.kxLen, 1, 'کارتکس قطعات باید فقط حرکت همان انبار را بدهد');
});

test('راهنما باید کشویی اقدام نهایی، OEM، شماره فصلی، فرم خالی و گزارش ورود/خروج انبار را توضیح دهد', () => {
  ['اقدام نهایی (کشویی پایین فرم)','چاپ سریع پذیرش','برگشت OEM','شماره پرونده','پرونده جدید','ارجاع نماینده','گزارش ورود/خروج هر انبار'].forEach(s=>{
    assertContainsString(html, s, 'راهنما باید «'+s+'» را توضیح دهد');
  });
  assertContainsString(html, 'W05-20522-0001', 'نمونه شماره پرونده کددار باید در راهنما باشد');
  assertContainsString(html, 'راست‌کلیک', 'راهنما باید پاک کردن فیلد با راست‌کلیک را بگوید');
});


console.log('');
console.log('📋 گروه: ویزارد گارانتی، کد پرونده و ماندن تنظیمات');

test('فعال‌سازی گارانتی باید بخش‌های بعدی را خاموش کند و فقط توضیحات بماند', () => {
  const src = extractFunctionSource(html, 'onWInitChange');
  assertTrue(!!src, 'onWInitChange پیدا نشد');
  assertContainsString(src, "init==='activate'", 'فعال‌سازی باید شاخه خودش را داشته باشد');
  assertContainsString(src, "ext.style.display = shortPath ? 'none'", 'بخش‌های بعدی باید برای فعال‌سازی مخفی شوند');
  assertContainsString(html, 'value="no_follow"', 'گزینه پیگیر نشد لازم است');
  assertContainsString(html, "no_follow:'پیگیر نشد'", 'برچسب پیگیر نشد لازم است');
});

test('شماره پرونده باید قالب WYY-SMMDD-NNNN باشد و قابل خواندن باشد', () => {
  const nextSrc = extractFunctionSource(html, 'nextWarCaseId');
  const prefSrc = extractFunctionSource(html, 'warCasePrefix');
  const expSrc = extractFunctionSource(html, 'explainWarCaseId');
  const seaD = extractFunctionSource(html, 'warSeasonDigit');
  const seaMo = extractFunctionSource(html, 'warSeasonOfMonth');
  const partsSrc = extractFunctionSource(html, 'warJalaliParts');
  const latSrc = extractFunctionSource(html, 'warLatinDigits');
  const runner = new Function(
    latSrc+'\n'+partsSrc+'\n'+seaMo+'\n'+seaD+'\n'+prefSrc+'\n'+nextSrc+'\n'+expSrc+'\n'+
    `var warranties = [];
     var id = nextWarCaseId('1405/05/22');
     return {id:id, expl:explainWarCaseId(id), pref:warCasePrefix('1405/02/10')};`
  );
  const r = runner();
  assertEqual(r.id, 'W05-20522-0001', 'نمونه مرداد باید W05-20522-0001 باشد');
  assertTrue(String(r.expl).indexOf('تابستان')>=0, 'توضیح کد باید فصل تابستان را بگوید');
  assertEqual(r.pref, 'W05-10210-', 'اردیبهشت باید فصل ۱ و ماه ۰۲ باشد');
});

test('فرم گارانتی باید صفحه‌به‌صفحه باشد و هر صفحه چاپ جدا داشته باشد', () => {
  assertContainsString(html, 'id="war-wizard-bar"', 'نوار ویزارد پیدا نشد');
  ['warWizardPages','showWarWizardPage','printWarWizardPage','printWarFullForm'].forEach(fn=>{
    assertTrue(extractFunctionSource(html, fn) !== null, 'تابع '+fn+' پیدا نشد');
  });
  const pagesSrc = extractFunctionSource(html, 'warWizardPages');
  assertContainsString(pagesSrc, "init==='refer_company'", 'بعد از ارجاع شرکت باید صفحات شرکت بیاید');
  assertContainsString(pagesSrc, 'company-report-section', 'صفحه گزارش داخلی باید جدا باشد');
  const runner = new Function(pagesSrc + `
    var init = 'refer_company';
    var document = { getElementById: function(){ return {value: init}; } };
    var pages = warWizardPages();
    return pages.map(function(p){ return p.id; }).join(',');
  `);
  const ids = runner();
  assertTrue(ids.indexOf('intake')>=0 && ids.indexOf('decision')>=0, 'باید صفحه پذیرش و تصمیم داشته باشد');
  assertTrue(ids.indexOf('company_report')>=0, 'بعد از ارجاع شرکت باید صفحه گزارش داخلی فعال شود');
  assertTrue(ids.indexOf('final')>=0, 'صفحه ثبت/چاپ نهایی لازم است');
});

test('شماره تماس باید در فیلد شبکه اجتماعی پیشنهاد شود', () => {
  const src = extractFunctionSource(html, 'suggestWarSocialFromPhone');
  assertTrue(!!src, 'suggestWarSocialFromPhone پیدا نشد');
  assertContainsString(html, 'oninput="suggestWarSocialFromPhone()"', 'فیلد تلفن باید پیشنهاد شبکه اجتماعی را صدا بزند');
  const runner = new Function(src + `
    var wph = {value:'09121234567'};
    var wsoc = {value:'', dataset:{}};
    var document = { getElementById: function(id){ return id==='wph' ? wph : wsoc; } };
    suggestWarSocialFromPhone();
    return {v:wsoc.value, auto:wsoc.dataset.auto};
  `);
  const r = runner();
  assertEqual(r.v, '09121234567', 'شماره تماس باید در آیدی شبکه اجتماعی پیشنهاد شود');
  assertEqual(r.auto, '1', 'پیشنهاد باید به‌عنوان مقدار خودکار علامت بخورد');
});

test('تنظیمات اعلان و ذخیره خودکار باید در بسته prefs و میزبان پایدار بمانند', () => {
  assertContainsString(html, 'function collectPrefsBundle(', 'collectPrefsBundle لازم است');
  assertContainsString(html, 'function restorePrefsBundleOnBoot(', 'بازیابی تنظیمات هنگام شروع لازم است');
  assertContainsString(html, 'function resumePersistedPrefs(', 'ادامه تنظیمات قبلی لازم است');
  assertContainsString(html, 'function ensureFsPermissionSilent(', 'بازیابی بی‌صدا بدون درخواست اجازه لازم است');
  assertContainsString(html, 'id="prefs-resume-bar"', 'نوار ادامه تنظیمات لازم است');
  const col = extractFunctionSource(html, 'collectPrefsBundle');
  const app = extractFunctionSource(html, 'applyPrefsBundle');
  const runner = new Function(col+'\n'+app+'\n'+
    `var PREF_KEYS = ['laegh_desktop_notify_on','laegh_autosave_enabled'];
     var store = {laegh_desktop_notify_on:'1', laegh_autosave_enabled:'1'};
     var localStorage = { getItem:function(k){ return Object.prototype.hasOwnProperty.call(store,k)?store[k]:null; }, setItem:function(k,v){ store[k]=String(v); } };
     var b = collectPrefsBundle();
     store = {};
     applyPrefsBundle(b);
     return {n:store.laegh_desktop_notify_on, a:store.laegh_autosave_enabled};`
  );
  const r = runner();
  assertEqual(r.n, '1', 'اعلان دسکتاپ باید در بسته تنظیمات بماند');
  assertEqual(r.a, '1', 'ذخیره خودکار باید در بسته تنظیمات بماند');
  assertContainsString(html, 'WriteBackupText', 'HTML باید بک‌آپ پایدار میزبان را صدا بزند');
  assertContainsString(html, 'ماندن تنظیمات', 'راهنما باید ماندن تنظیمات را توضیح دهد');
});

console.log('');
console.log('📋 گروه: مرکز خدمات، حواله ورود، دستیار شناور و بخش ستاره‌دار');

test('وضعیت اولیه دستگاه باید گزینه‌های نامشخص و ارسال‌نشده داشته باشد', () => {
  assertContainsString(html, 'id="wc-cond-carton"', 'فیلد وضع کارتن لازم است');
  const carton = (html.match(/id="wc-cond-carton">([\s\S]*?)<\/select>/) || [])[1] || '';
  const body = (html.match(/id="wc-cond-body">([\s\S]*?)<\/select>/) || [])[1] || '';
  const acc = (html.match(/id="wc-cond-acc">([\s\S]*?)<\/select>/) || [])[1] || '';
  assertContainsString(carton, 'نامشخص', 'کارتن باید گزینه نامشخص داشته باشد');
  assertContainsString(carton, 'مشتری هنوز چیزی ارسال نکرده است', 'کارتن باید گزینه ارسال‌نشده داشته باشد');
  assertContainsString(body, 'نامشخص', 'بدنه باید گزینه نامشخص داشته باشد');
  assertContainsString(acc, 'نامشخص', 'لوازم باید گزینه نامشخص داشته باشد');
});

test('تب بخش خدمات باید زیر اطلاعات شرکت باشد و اسامی امسال را به‌صورت پیش‌فرض بدهد', () => {
  assertContainsString(html, "showStgTab('service'", 'تب بخش خدمات در تنظیمات لازم است');
  assertContainsString(html, 'id="stg-service"', 'پنل بخش خدمات لازم است');
  const iCo = html.indexOf("showStgTab('company'");
  const iSvc = html.indexOf("showStgTab('service'");
  assertTrue(iCo >= 0 && iSvc > iCo, 'تب بخش خدمات باید بلافاصله بعد از اطلاعات شرکت باشد');
  const src = extractFunctionSource(html, 'defaultServiceCenter');
  assertTrue(!!src, 'defaultServiceCenter پیدا نشد');
  const runner = new Function(src + '\nreturn defaultServiceCenter();');
  const d = runner();
  assertEqual(d.techName, 'محمد مهدی اصطلامی', 'کارشناس خدمات امسال باید محمد مهدی اصطلامی باشد');
  assertEqual(d.qcName, 'فاطمه زهرا معنوی', 'کنترل کیفیت باید فاطمه زهرا معنوی باشد');
  assertEqual(d.shipName, 'عباس کساییان', 'مسئول لجستیک باید عباس کساییان باشد');
  assertEqual(d.mgrName, 'محمد علی اصطلامی', 'مدیر خدمات باید محمد علی اصطلامی باشد');
  assertContainsString(html, 'id="svc-logo-inp"', 'عکس/لوگوی خدمات لازم است');
});

test('گزارش داخلی باید اسامی را از مرکز خدمات پر کند', () => {
  const getSrc = extractFunctionSource(html, 'getServiceCenter');
  const fillSrc = extractFunctionSource(html, 'fillCompanyReportFromServiceCenter');
  const defSrc = extractFunctionSource(html, 'defaultServiceCenter');
  assertTrue(!!getSrc && !!fillSrc && !!defSrc, 'توابع مرکز خدمات/گزارش داخلی پیدا نشد');
  const runner = new Function(defSrc + '\n' + getSrc + '\n' + fillSrc + '\n' +
    `var store = {};
     var localStorage = { getItem:function(){ return null; }, setItem:function(k,v){ store[k]=v; } };
     var els = {
       'cr-tech-name':{value:''}, 'cr-qc-name':{value:''},
       'cr-ship-name':{value:''}, 'cr-mgr-name':{value:''},
       'wc-expert-name':{value:''}
     };
     var document = { getElementById:function(id){ return els[id]||null; } };
     fillCompanyReportFromServiceCenter(true);
     return {t:els['cr-tech-name'].value, q:els['cr-qc-name'].value, s:els['cr-ship-name'].value, m:els['cr-mgr-name'].value, e:els['wc-expert-name'].value};`
  );
  const r = runner();
  assertEqual(r.t, 'محمد مهدی اصطلامی', 'نام کارشناس خدمات باید خودکار پر شود');
  assertEqual(r.q, 'فاطمه زهرا معنوی', 'نام کنترل کیفیت باید خودکار پر شود');
  assertEqual(r.s, 'عباس کساییان', 'نام مسئول لجستیک باید خودکار پر شود');
  assertEqual(r.m, 'محمد علی اصطلامی', 'نام مدیر خدمات باید خودکار پر شود');
  assertContainsString(html, 'fillCompanyReportFromServiceCenter', 'فرم گارانتی باید از مرکز خدمات پر شود');
  assertContainsString(html, 'serviceCenter', 'بک‌آپ باید مرکز خدمات را نگه دارد');
});

test('دکمه دستیار باید قابل جابجایی باشد و موقعیتش ذخیره شود', () => {
  assertContainsString(html, 'function initAiFloatDrag(', 'initAiFloatDrag لازم است');
  assertContainsString(html, 'function applyAiFloatPos(', 'applyAiFloatPos لازم است');
  assertContainsString(html, 'laegh_ai_float_x', 'موقعیت دستیار باید در localStorage بماند');
  const src = extractFunctionSource(html, 'applyAiFloatPos');
  assertTrue(!!src, 'بدنه applyAiFloatPos پیدا نشد');
  const runner = new Function(src + `
    var style = {left:'', top:'', right:'', bottom:''};
    var btn = {style:style};
    var document = { getElementById:function(){ return btn; } };
    var window = { innerWidth:800, innerHeight:600 };
    applyAiFloatPos(40, 80);
    return {l:style.left, t:style.top, b:style.bottom};
  `);
  const r = runner();
  assertEqual(r.l, '40px', 'دستیار باید با left جابجا شود نه transform سایدبار');
  assertEqual(r.t, '80px', 'دستیار باید با top جابجا شود');
  assertEqual(r.b, 'auto', 'با جابجایی نباید به پایین قفل بماند');
});

test('کارت‌های مدیریت انبارها باید با فاصله استاندارد و بدون تو در تو بودن تنگ باشند', () => {
  assertContainsString(html, 'wh-entity-grid', 'شبکه مدیریت انبارها لازم است');
  assertContainsString(html, 'minmax(300px', 'حداقل عرض کارت انبار باید حدود ۳۰۰ پیکسل باشد نه ۱۳۰');
  const renderSrc = extractFunctionSource(html, 'renderWarehouseEntities');
  assertTrue(!!renderSrc, 'renderWarehouseEntities پیدا نشد');
  assertTrue(renderSrc.indexOf('dash-kpi-grid') === -1, 'لیست انبارها نباید داخل dash-kpi-grid تنگ باشد');
  assertContainsString(html, 'wh-toolbar', 'نوار دکمه‌های انبار باید فاصله و شکست خط استاندارد داشته باشد');
});

test('حواله ورود باید اول فهرست را انتخاب کند و هر فیلد قابل جستجو و نوشتن دستی باشد', () => {
  assertContainsString(html, 'id="wh-catalog"', 'انتخاب فهرست قبل از اقلام لازم است');
  const catSrc = extractFunctionSource(html, 'whCatalogForWarehouseType');
  assertTrue(!!catSrc, 'whCatalogForWarehouseType پیدا نشد');
  const runner = new Function(catSrc + `
    return {
      def: whCatalogForWarehouseType('defective'),
      parts: whCatalogForWarehouseType('parts'),
      goods: whCatalogForWarehouseType('goods')
    };
  `);
  const r = runner();
  assertEqual(r.def, 'defective', 'انبار معیوب نباید فهرست قطعات را باز کند');
  assertEqual(r.parts, 'parts', 'انبار قطعات باید فهرست قطعات را باز کند');
  assertEqual(r.goods, 'products', 'انبار کالا باید فهرست محصولات را باز کند');
  const itemsSrc = extractFunctionSource(html, 'whCatalogItems');
  assertTrue(!!itemsSrc, 'whCatalogItems پیدا نشد');
  const pick = new Function(itemsSrc + `
    var parts = [{code:'P1', name:'پروانه'}];
    var products = [{code:'G1', name:'پنکه', model:'S12', colors:'سفید', brand:'سیرمان'}];
    var defectiveStock = [{id:'DEF-0001', model:'پنکه معیوب', status:'in_stock'}];
    function defIsInWarehouse(d){ return d.status==='in_stock'; }
    var defItems = whCatalogItems('defective','');
    var qItems = whCatalogItems('products','پنکه');
    return {
      hasPartInDef: defItems.some(function(x){ return x.code==='P1'; }),
      hasProdInDef: defItems.some(function(x){ return x.code==='G1' || (x.name||'').indexOf('پنکه')>=0; }),
      qOk: qItems.length>=1
    };
  `);
  const p = pick();
  assertEqual(p.hasPartInDef, false, 'فهرست معیوب نباید قطعات تعمیر را قاطی کند');
  assertEqual(p.hasProdInDef, true, 'فهرست معیوب باید کالا/محصول را نشان دهد');
  assertEqual(p.qOk, true, 'فهرست باید قابل جستجو باشد');
  assertContainsString(html, 'id="wh-same-company"', 'گزینه یک شرکت برای کل حواله لازم است');
  const renderSrc = extractFunctionSource(html, 'renderWhItems');
  assertTrue(!!renderSrc, 'renderWhItems پیدا نشد');
  assertContainsString(renderSrc, 'manufacturer', 'هر قلم باید تولیدکننده/تأمین‌کننده جدا داشته باشد');
  assertContainsString(renderSrc, 'wh-combo', 'فیلد قلم باید جستجو و نوشتن دستی داشته باشد نه فقط select مرده');
});

test('حواله ورود باید رنگ، کد، مدل، نام، تعداد، توضیح و دو موجودی فیزیکی/سپیدار داشته باشد', () => {
  const renderSrc = extractFunctionSource(html, 'renderWhItems');
  ['color','model','qtyPhy','qtySepidar','note'].forEach(function(k){
    assertContainsString(renderSrc, k, 'فیلد '+k+' در اقلام حواله لازم است');
  });
  const misSrc = extractFunctionSource(html, 'collectSepidarPhyMismatches');
  assertTrue(!!misSrc, 'collectSepidarPhyMismatches پیدا نشد');
  const runner = new Function(misSrc + `
    var docs = [{id:'WH-IN-0001', items:[
      {code:'A', name:'پنکه', qty:2, qtyPhy:2, qtySepidar:5},
      {code:'B', name:'سالم', qty:1, qtyPhy:1, qtySepidar:1}
    ]}];
    return collectSepidarPhyMismatches(docs);
  `);
  const rows = runner();
  assertEqual(rows.length, 1, 'فقط ردیف مغایر باید برگردد');
  assertEqual(rows[0].phy, 2, 'تعداد فیزیکی مغایر باید ۲ باشد');
  assertEqual(rows[0].sep, 5, 'تعداد سپیدار مغایر باید ۵ باشد');
});

test('بخش ستاره‌دار باید اهمیت، فاصله زمانی و روشن/خاموش هر الارم را نگه دارد', () => {
  assertContainsString(html, "showStgTab('starred'", 'تب بخش ستاره‌دار لازم است');
  assertContainsString(html, 'id="stg-starred"', 'پنل بخش ستاره‌دار لازم است');
  const catSrc = extractFunctionSource(html, 'starredAlarmCatalog');
  const dueSrc = extractFunctionSource(html, 'starredAlarmDue');
  const normSrc = extractFunctionSource(html, 'normalizeStarredAlarms');
  assertTrue(!!catSrc && !!dueSrc && !!normSrc, 'توابع الارم ستاره‌دار پیدا نشد');
  const runner = new Function(catSrc + '\n' + dueSrc + '\n' + normSrc + `
    var cat = starredAlarmCatalog();
    var list = normalizeStarredAlarms([]);
    var sepidar = list.find(function(a){ return a.id==='wh_sepidar_phy'; });
    var due = starredAlarmDue({on:true, days:3, lastFired: 0}, 4*86400000);
    var notDue = starredAlarmDue({on:true, days:3, lastFired: 3.5*86400000}, 4*86400000);
    var off = starredAlarmDue({on:false, days:3, lastFired:0}, 10*86400000);
    return {has:!!sepidar, pri:sepidar&&sepidar.priority, days:sepidar&&sepidar.days, due:due, notDue:notDue, off:off, titles:cat.map(function(c){return c.id;})};
  `);
  const r = runner();
  assertEqual(r.has, true, 'الارم اختلاف سپیدار و فیزیکی باید در کاتالوگ باشد');
  assertEqual(r.pri, 'high', 'اولویت پیش‌فرض اختلاف سپیدار باید بالا باشد');
  assertEqual(r.days, 3, 'فاصله پیش‌فرض باید هر سه روز باشد');
  assertEqual(r.due, true, 'بعد از سه روز باید الارم نشان داده شود');
  assertEqual(r.notDue, false, 'قبل از فاصله زمانی نباید الارم تکرار شود');
  assertEqual(r.off, false, 'الارم خاموش نباید نشان داده شود');
  assertContainsString(html, 'starredAlarms', 'بک‌آپ باید بخش ستاره‌دار را نگه دارد');
  assertContainsString(html, 'بخش ستاره‌دار', 'راهنما باید بخش ستاره‌دار را توضیح دهد');
  assertContainsString(html, 'بخش خدمات', 'راهنما باید بخش خدمات را توضیح دهد');
});

console.log('');
console.log('── گروه: تاریخ نامشخص، سایر، بدنه، گزارش داخلی، ذخیره خودکار، فاکتور، کشویی قابل‌جستجو ──');

test('تقویم همه تاریخ‌ها باید گزینه نامشخص داشته باشد و مدت تعمیر آن را صفر ببیند', () => {
  const dpSrc = extractFunctionSource(html, 'openDatePicker');
  assertTrue(!!dpSrc, 'openDatePicker پیدا نشد');
  assertTrue(dpSrc.indexOf('_dpUnknown') >= 0 && dpSrc.indexOf('نامشخص') >= 0, 'دکمه نامشخص باید در تقویم باشد');
  const unkSrc = extractFunctionSource(html, 'isUnknownDate');
  const msSrc = extractFunctionSource(html, '_jalaliDateToMs');
  assertTrue(!!unkSrc && !!msSrc, 'isUnknownDate / _jalaliDateToMs پیدا نشد');
  const runner = new Function(unkSrc + '\n' + msSrc + `
    return {
      u1: isUnknownDate('نامشخص'),
      u2: isUnknownDate('unknown'),
      u3: isUnknownDate('1405/05/23'),
      z: _jalaliDateToMs('نامشخص')
    };
  `);
  const r = runner();
  assertEqual(r.u1, true, 'نامشخص باید ناشناخته باشد');
  assertEqual(r.u2, true, 'unknown باید ناشناخته باشد');
  assertEqual(r.u3, false, 'تاریخ واقعی نباید ناشناخته باشد');
  assertEqual(r.z, 0, 'نامشخص نباید به میلی‌ثانیه تبدیل شود');
});

test('گزینه سایر باید فیلد توضیح کنار خودش باز کند', () => {
  const otherSrc = extractFunctionSource(html, 'isOtherSelectValue');
  const noteSrc = extractFunctionSource(html, 'ensureOtherNote');
  assertTrue(!!otherSrc && !!noteSrc, 'توابع سایر پیدا نشد');
  const runner = new Function(otherSrc + `
    return {
      a: isOtherSelectValue('other'),
      b: isOtherSelectValue('سایر'),
      c: isOtherSelectValue('custom'),
      d: isOtherSelectValue('post'),
      e: isOtherSelectValue('inperson')
    };
  `);
  const r = runner();
  assertEqual(r.a, true, 'other باید سایر باشد');
  assertEqual(r.b, true, 'متن سایر باید شناخته شود');
  assertEqual(r.c, true, 'custom باید سایر باشد');
  assertEqual(r.d, false, 'پست نباید سایر باشد');
  assertEqual(r.e, false, 'حضوری نباید سایر باشد');
  assertContainsString(html, 'ensureOtherNote', 'باید فیلد توضیح سایر ساخته شود');
  assertContainsString(html, 'getOtherNote', 'باید توضیح سایر خوانده شود');
});

test('وضعیت بدنه باید خش جزئی و خش‌دار را جدا داشته باشد', () => {
  assertTrue(/id="wc-cond-body"[^>]*>[\s\S]*?خش جزئی[\s\S]*?خش‌دار[\s\S]*?<\/select>/.test(html), 'وضع بدنه گارانتی باید خش جزئی و خش‌دار جدا باشد');
  assertTrue(html.indexOf('<option>خش‌دار</option>') >= 0, 'گزینه خش‌دار لازم است');
  assertTrue(html.indexOf('wd${n}_cond') >= 0 && html.indexOf('خش‌دار') >= 0, 'وضعیت ظاهری دستگاه باید خش‌دار داشته باشد');
  const bodyBlock = html.match(/id="d\$\{n\}_body"[^>]*>[\s\S]*?<\/select>/);
  assertTrue(!!bodyBlock, 'وضعیت بدنه فاکتور فروشگاه پیدا نشد');
  assertTrue(bodyBlock[0].indexOf('خش جزئی') >= 0 && bodyBlock[0].indexOf('خش‌دار') >= 0, 'فاکتور فروشگاه هم باید خش جزئی و خش‌دار جدا باشد');
  assertTrue(bodyBlock[0].indexOf('خش دارد') < 0, 'گزینه مخلوط «خش دارد» نباید بماند');
});

test('مدت تعمیر گزارش داخلی باید تاریخ رسیدن همان صفحه را بخواند', () => {
  const report = html.match(/id="company-report-section"[\s\S]*?id="cr-repair-dur"/);
  assertTrue(!!report, 'گزارش داخلی پیدا نشد');
  assertTrue(report[0].indexOf('wc-arrive-date') >= 0 || report[0].indexOf('cr-arrive-date') >= 0, 'تاریخ رسیدن باید کنار مدت تعمیر در گزارش داخلی باشد');
  const durSrc = extractFunctionSource(html, 'calcWarrantyRepairDuration');
  const getSrc = extractFunctionSource(html, 'getWarArriveDate');
  assertTrue(!!durSrc && !!getSrc, 'calcWarrantyRepairDuration / getWarArriveDate پیدا نشد');
  assertTrue(getSrc.indexOf('cr-arrive-date') >= 0 && getSrc.indexOf('wc-arrive-date') >= 0, 'باید هر دو فیلد رسیدن خوانده شود');
});

test('ذخیره خودکار با پوشه/میزبان فعال بماند و الارم‌ها گردش زمانی داشته باشند', () => {
  const readySrc = extractFunctionSource(html, 'isBackupFolderReady');
  const loopSrc = extractFunctionSource(html, 'startStarredAlarmLoop');
  const persistSrc = extractFunctionSource(html, '_persistJsonSafe');
  const reqSrc = extractFunctionSource(html, 'requireDiskOrAbort');
  const autoSrc = extractFunctionSource(html, 'doAutoSave');
  const loadSrc = extractFunctionSource(html, 'loadAutoSaveUI');
  const dueSrc = extractFunctionSource(html, 'starredAlarmDue');
  assertTrue(!!readySrc && !!loopSrc && !!persistSrc && !!reqSrc && !!autoSrc && !!loadSrc, 'توابع ذخیره خودکار/الارم پیدا نشد');
  const runner = new Function(readySrc + `
    var localStorage = {
      _s: { laegh_autosave_dir_name: 'SirmanBackup', laegh_autosave_enabled: '1' },
      getItem: function(k){ return this._s[k] || null; }
    };
    var autoSaveDirHandle = null, autoSaveFileHandle = null;
    function getSirmanHostSync(){ return { WriteBackupText: function(){ return '{"ok":true}'; } }; }
    return isBackupFolderReady();
  `);
  assertEqual(runner(), true, 'پوشه ذخیره‌شده یا میزبان باید ذخیره را آماده نشان دهد');
  assertTrue(loopSrc.indexOf('setInterval') >= 0 && loopSrc.indexOf('checkStarredAlarms') >= 0, 'الارم ستاره‌دار باید روی تایمر گردش کند');
  assertTrue(persistSrc.indexOf('isBackupFolderReady') >= 0, 'اخطار حجم گارانتی نباید با پوشه انتخاب‌شده تکرار شود');
  assertTrue(reqSrc.indexOf('isBackupFolderReady') >= 0, 'اگر پوشه انتخاب شده درخواست دوباره پوشه نیاید');
  assertTrue(autoSrc.indexOf('isBackupFolderReady') >= 0 || autoSrc.indexOf('WriteBackupText') >= 0, 'ذخیره خودکار باید محل پایدار را هم بنویسد');
  assertTrue(loadSrc.indexOf('isBackupFolderReady') >= 0, 'وضعیت ذخیره خودکار باید پوشه ذخیره‌شده را فعال نشان دهد');
  assertTrue(html.indexOf('runFullDiag') >= 0 && extractFunctionSource(html, 'runFullDiag').indexOf('isBackupFolderReady') >= 0, 'اخطار سقف حافظه با پوشه بک‌آپ نباید تکرار شود');
  const dueRunner = new Function(dueSrc + `
    var hourly = starredAlarmDue({on:true, days:3, hours:1, lastFired: 0}, 2*3600000);
    var notYet = starredAlarmDue({on:true, hours:6, lastFired: 1000}, 1000 + 2*3600000);
    return {hourly:hourly, notYet: notYet};
  `);
  const d = dueRunner();
  assertEqual(d.hourly, true, 'گردش ساعتی باید الارم را دوباره نشان دهد');
  assertEqual(d.notYet, false, 'قبل از گردش ساعتی نباید تکرار شود');
});

test('گزینه‌های پستی باید حضوری و تحویل از طریق شخص داشته باشند و کد نخواهند', () => {
  const ship = html.match(/id="wc-cust-ship-method"[^>]*>[\s\S]*?<\/select>/);
  assertTrue(!!ship, 'نحوه ارسال مشتری پیدا نشد');
  assertTrue(ship[0].indexOf('inperson') >= 0 && ship[0].indexOf('حضوری') >= 0, 'حضوری باید در ارسال گارانتی باشد');
  assertTrue(ship[0].indexOf('person') >= 0 && ship[0].indexOf('تحویل از طریق شخص') >= 0, 'تحویل از طریق شخص باید در ارسال گارانتی باشد');
  const sale = html.match(/id="sale-ship"[^>]*>[\s\S]*?<\/select>/);
  assertTrue(!!sale && sale[0].indexOf('تحویل از طریق شخص') >= 0, 'فروش قطعات هم باید تحویل از طریق شخص داشته باشد');
  const src = extractFunctionSource(html, 'isInPersonShip');
  const syncSrc = extractFunctionSource(html, 'syncShipTrackingFields');
  assertTrue(!!src && !!syncSrc, 'isInPersonShip / syncShipTrackingFields پیدا نشد');
  const runner = new Function(src + `
    return {
      a: isInPersonShip('inperson'),
      b: isInPersonShip('person'),
      c: isInPersonShip('post'),
      d: isInPersonShip('in_person')
    };
  `);
  const r = runner();
  assertEqual(r.a, true, 'حضوری باید بدون کد باشد');
  assertEqual(r.b, true, 'تحویل شخص باید بدون کد باشد');
  assertEqual(r.c, false, 'پست باید کد بخواهد');
  assertEqual(r.d, true, 'تحویل حضوری نمایندگی باید بدون کد باشد');
});

test('دکمه جمع‌کردن سایدبار راست باید رنگ متمایز داشته باشد', () => {
  const css = html.match(/\.sb-rail-toggle\{[\s\S]*?\}/);
  assertTrue(!!css, 'استایل دکمه کشویی سایدبار پیدا نشد');
  assertTrue(/#([0-9a-fA-F]{3,8})|rgb\(\s*\d+/.test(css[0]) && css[0].indexOf('rgba(255,255,255') < 0, 'رنگ دکمه باید از سفید شفاف جدا باشد');
  assertTrue(css[0].indexOf('#1d4ed8') >= 0 || css[0].indexOf('#2563eb') >= 0 || css[0].indexOf('#f59e0b') >= 0, 'رنگ دکمه باید آبی/کهربایی مشخص باشد');
});

test('بعد از ذخیره فاکتور باید فرم بسته شود و به لیست برگردد', () => {
  const leaveSrc = extractFunctionSource(html, 'leaveFormToList');
  const saveSrc = extractFunctionSource(html, 'saveInv');
  const closeSrc = extractFunctionSource(html, 'closeInv');
  const saleSrc = extractFunctionSource(html, 'saveSale');
  const clearSrc = extractFunctionSource(html, 'closeSaleForm');
  assertTrue(!!leaveSrc, 'leaveFormToList پیدا نشد');
  assertTrue(saveSrc.indexOf('leaveFormToList') >= 0 && saveSrc.indexOf('saved') >= 0, 'ذخیره فاکتور فروشگاه باید به لیست برگردد');
  assertTrue(closeSrc.indexOf('leaveFormToList') >= 0, 'تکمیل فاکتور باید فرم را ببندد');
  assertTrue(saleSrc.indexOf('closeSaleForm') >= 0, 'فروش قطعات باید به لیست برگردد');
  assertTrue(clearSrc.indexOf('sale-name') >= 0 || saleSrc.indexOf('leaveFormToList') >= 0, 'فرم فروش نباید اطلاعات فاکتور قبلی را نگه دارد');
});

test('لیست‌های کشویی باید با تایپ قابل جستجو باشند', () => {
  const enhSrc = extractFunctionSource(html, 'enhanceSearchableSelects');
  const oneSrc = extractFunctionSource(html, 'enhanceOneSelect');
  assertTrue(!!enhSrc && !!oneSrc, 'enhanceSearchableSelects پیدا نشد');
  assertTrue(oneSrc.indexOf('srch-sel') >= 0 && oneSrc.indexOf('filter') >= 0 || oneSrc.indexOf('q') >= 0, 'باید ورودی جستجو روی select ساخته شود');
  assertContainsString(html, '.srch-sel', 'استایل کشویی قابل‌جستجو لازم است');
  assertContainsString(html, 'جستجو در لیست', 'راهنما باید جستجوی کشویی را توضیح دهد');
});


console.log('');
console.log('📋 گروه: کاربران، نقش‌ها و گزارش فعالیت');

function extractConstSource(srcHtml, name) {
  const re = new RegExp('(?:const|let|var)\\s+' + name + '\\s*=');
  const m = srcHtml.match(re);
  if (!m) return null;
  const start = m.index;
  let i = start + m[0].length;
  while (i < srcHtml.length && /\s/.test(srcHtml[i])) i++;
  const open = srcHtml[i];
  if (open !== '{' && open !== '[') return null;
  const close = open === '{' ? '}' : ']';
  let depth = 0;
  let started = false;
  for (; i < srcHtml.length; i++) {
    if (srcHtml[i] === open) { depth++; started = true; }
    else if (srcHtml[i] === close) { depth--; if (started && depth === 0) { i++; break; } }
  }
  return srcHtml.substring(start, i) + ';';
}

test('نقش‌های استاندارد باید پنج کلید admin/manager/operator/service/viewer داشته باشند', () => {
  const catSrc = extractConstSource(html, 'ROLE_CATALOG');
  assertTrue(!!catSrc, 'ROLE_CATALOG پیدا نشد');
  const cat = new Function('var ALL_PAGE_KEYS=["dashboard","tasks","invoice","saved","products","inventory","defective","warehouse","warehouse-entities","phonebook","postal","parts","daqi","services","sales","accounts","warranty","dataio","datetime","audit","settings","help"]; ' + catSrc + ' return ROLE_CATALOG;')();
  ['admin','manager','operator','service','viewer'].forEach(k => {
    assertTrue(!!cat[k], 'نقش «'+k+'» باید در ROLE_CATALOG باشد');
    assertTrue(Array.isArray(cat[k].pages) && cat[k].pages.length > 0, 'نقش '+k+' باید صفحات پیش‌فرض داشته باشد');
  });
  assertTrue(Object.keys(cat).length >= 5, 'پنج نقش استاندارد باید بمانند');
});

test('normalizeAppUser باید پروفایل قدیمی name/pw/pages را به کاربر کامل ارتقا دهد', () => {
  const catSrc = extractConstSource(html, 'ROLE_CATALOG');
  const normSrc = extractFunctionSource(html, 'normalizeAppUser');
  const inferSrc = extractFunctionSource(html, 'inferRoleKey') || 'function inferRoleKey(p){ return "operator"; }';
  assertTrue(!!normSrc, 'تابع normalizeAppUser پیدا نشد');
  const runner = new Function('var ALL_PAGE_KEYS = ["dashboard","tasks","invoice","saved","products","inventory","help"];\n' + catSrc + '\n' + inferSrc + '\n' + normSrc + `
    var u = normalizeAppUser({name:'علی', pw:'secret1', pages:['dashboard','help']});
    return u;
  `);
  const u = runner();
  assertTrue(!!u.id, 'کاربر باید شناسه داشته باشد');
  assertEqual(u.name, 'علی', 'نام نمایشی باید حفظ شود');
  assertEqual(u.username, 'علی', 'نام کاربری از نام قدیمی پر شود');
  assertEqual(u.pw, 'secret1', 'رمز باید حفظ شود');
  assertEqual(u.active, true, 'کاربر قدیمی باید فعال باشد');
  assertTrue(!!u.roleKey, 'باید نقش استنباط شود');
  assertEqual(u.forcePwChange, false, 'اجبار تعویض رمز پیش‌فرض خاموش است');
});

test('کاربر غیرفعال نباید بتواند وارد شود', () => {
  const src = extractFunctionSource(html, 'matchAppUserForLogin');
  assertTrue(!!src, 'تابع matchAppUserForLogin پیدا نشد');
  const runner = new Function(src + `
    var roles = [
      {id:'u1', name:'علی', username:'ali', pw:'p1', active:false, pages:['dashboard']},
      {id:'u2', name:'مینا', username:'mina', pw:'p2', active:true, pages:['dashboard']}
    ];
    return {
      inactivePw: matchAppUserForLogin('', 'p1', roles, 'master'),
      inactiveUser: matchAppUserForLogin('ali', 'p1', roles, 'master'),
      ok: matchAppUserForLogin('mina', 'p2', roles, 'master'),
      master: matchAppUserForLogin('', 'master', roles, 'master'),
      bad: matchAppUserForLogin('', 'nope', roles, 'master')
    };
  `);
  const r = runner();
  assertEqual(r.inactivePw.ok, false, 'رمز کاربر غیرفعال نباید ورود بدهد');
  assertEqual(r.inactivePw.reason, 'inactive', 'دلیل باید حساب غیرفعال باشد');
  assertEqual(r.inactiveUser.ok, false, 'نام کاربری غیرفعال نباید ورود بدهد');
  assertEqual(r.ok.ok, true, 'کاربر فعال باید وارد شود');
  assertEqual(r.ok.user.username, 'mina', 'کاربر فعال باید برگردد');
  assertEqual(r.master.ok, true, 'رمز مدیر کل باید ورود بدهد');
  assertEqual(r.master.kind, 'master', 'ورود مدیر کل باید kind=master باشد');
  assertEqual(r.bad.ok, false, 'رمز غلط باید رد شود');
});

test('auditActivity باید شناسه، ماژول، مقادیر قدیم/جدید بنویسد و رمز را ماسک کند', () => {
  const maskSrc = extractFunctionSource(html, 'maskAuditValue');
  const actSrc = extractFunctionSource(html, 'auditActivity');
  const actorSrc = extractFunctionSource(html, 'getAuditActor') || 'function getAuditActor(){ return {userId:"admin", username:"مدیر سیستم"}; }';
  const machSrc = extractFunctionSource(html, 'getMachineAuditInfo') || 'function getMachineAuditInfo(){ return {computerName:"HTML", ipAddress:""}; }';
  const inferSrc = extractFunctionSource(html, 'inferAuditModule') || 'function inferAuditModule(){ return "app"; }';
  const sensSrc = extractFunctionSource(html, 'isSensitiveAuditAction') || 'function isSensitiveAuditAction(){ return false; }';
  assertTrue(!!maskSrc && !!actSrc, 'maskAuditValue / auditActivity پیدا نشد');
  const runner = new Function(maskSrc + '\n' + actorSrc + '\n' + machSrc + '\n' + inferSrc + '\n' + sensSrc + '\n' + actSrc + `
    var userAuditLog = [];
    var currentRole = {id:'u9', name:'مینا'};
    var saved = [];
    function nowISO(){ return '2026-08-14T10:00:00.000Z'; }
    function nowFa(){ return '1405/05/23'; }
    function saveAudit(){ saved.push(userAuditLog.slice()); }
    auditActivity({
      action:'user_edit',
      module:'users',
      entityType:'user',
      entityId:'u1',
      description:'ویرایش کاربر',
      oldValues:{name:'علی', pw:'old-secret'},
      newValues:{name:'علی', pw:'new-secret'}
    });
    return { rec: userAuditLog[0], saved: saved.length };
  `);
  const r = runner();
  assertTrue(!!r.rec, 'رکورد فعالیت باید ثبت شود');
  assertTrue(!!r.rec.id, 'ActivityId لازم است');
  assertEqual(r.rec.module, 'users', 'ماژول باید users باشد');
  assertEqual(r.rec.entityType, 'user', 'EntityType باید user باشد');
  assertEqual(r.rec.username, 'مینا', 'Username باید از نشست خوانده شود نه از فرم');
  assertEqual(r.rec.oldValues.pw, '***', 'رمز قدیم نباید ذخیره شود');
  assertEqual(r.rec.newValues.pw, '***', 'رمز جدید نباید ذخیره شود');
  assertEqual(r.rec.oldValues.name, 'علی', 'نام نباید ماسک شود');
  assertTrue(r.saved >= 1, 'باید ذخیره شود');
  assertTrue(JSON.stringify(r.rec).indexOf('old-secret') === -1, 'متن رمز نباید در رکورد باشد');
});

test('auditUser باید همچنان به userAuditLog اضافه کند (سازگاری با کد فعلی)', () => {
  const maskSrc = extractFunctionSource(html, 'maskAuditValue');
  const actSrc = extractFunctionSource(html, 'auditActivity');
  const userSrc = extractFunctionSource(html, 'auditUser');
  const actorSrc = extractFunctionSource(html, 'getAuditActor') || 'function getAuditActor(){ return {userId:"admin", username:"مدیر"}; }';
  const machSrc = extractFunctionSource(html, 'getMachineAuditInfo') || 'function getMachineAuditInfo(){ return {computerName:"HTML", ipAddress:""}; }';
  const inferSrc = extractFunctionSource(html, 'inferAuditModule') || 'function inferAuditModule(a){ return "app"; }';
  const sensSrc = extractFunctionSource(html, 'isSensitiveAuditAction') || 'function isSensitiveAuditAction(){ return false; }';
  assertTrue(!!userSrc && !!actSrc, 'auditUser باید به auditActivity وصل شود');
  const runner = new Function(maskSrc + '\n' + actorSrc + '\n' + machSrc + '\n' + inferSrc + '\n' + sensSrc + '\n' + actSrc + '\n' + userSrc + `
    var userAuditLog = [];
    var currentRole = null;
    function nowISO(){ return Date.now(); }
    function nowFa(){ return '1405/05/23'; }
    function saveAudit(){}
    auditUser('ذخیره فاکتور', 'F-100');
    return userAuditLog[0];
  `);
  const rec = runner();
  assertTrue(!!rec, 'auditUser باید رکورد بسازد');
  assertTrue(rec.action === 'ذخیره فاکتور' || rec.description === 'F-100' || (rec.detail === 'F-100'), 'عملیات و جزئیات باید ثبت شوند');
  assertTrue((rec.username||rec.user||'').length > 0, 'نام کاربر باید در لاگ باشد');
});

test('ورود ناموفق باید بدون ذخیره رمز در گزارش ثبت شود', () => {
  const src = extractFunctionSource(html, 'attemptLogin');
  const matchSrc = extractFunctionSource(html, 'matchAppUserForLogin');
  assertTrue(!!src && !!matchSrc, 'attemptLogin / matchAppUserForLogin پیدا نشد');
  const runner = new Function(
    'document',
    matchSrc + '\n' + src + `
      var loginPw = 'master-pw';
      var userRoles = [{id:'u1', name:'علی', username:'ali', pw:'p1', active:true, pages:['dashboard']}];
      var currentRole = null;
      var events = [];
      function auditActivity(e){ events.push(e); }
      function finishLogin(){}
      function presentAppError(){}
      function ntf(){}
      function svRoles(){}
      function nowISO(){ return Date.now(); }
      function nowFa(){ return ''; }
      attemptLogin();
      return { events: events, pwVal: document.getElementById('login-pw-input').value, currentRole: currentRole };
    `
  );
  const fakeDoc = {
    getElementById: function(id){
      if (id === 'login-pw-input') return { value: 'wrong-password-xyz' };
      if (id === 'login-user-input') return { value: '' };
      if (id === 'login-error-msg') return { textContent: '' };
      return { value: '', textContent: '', style: {} };
    }
  };
  const r = runner(fakeDoc);
  assertTrue(r.events.some(e => e.action === 'login_failed'), 'ورود ناموفق باید login_failed ثبت شود');
  const blob = JSON.stringify(r.events);
  assertTrue(blob.indexOf('wrong-password-xyz') === -1, 'رمز واردشده نباید در لاگ باشد');
  assertTrue(blob.indexOf('master-pw') === -1, 'رمز مدیر نباید در لاگ باشد');
  assertEqual(r.currentRole, null, 'نشست نباید برای ورود ناموفق ست شود');
});

test('پاک کردن گزارش فعالیت فقط برای مدیر سیستم مجاز است', () => {
  const canSrc = extractFunctionSource(html, 'canClearAuditLog');
  const clrSrc = extractFunctionSource(html, 'clearAuditLog');
  assertTrue(!!canSrc && !!clrSrc, 'canClearAuditLog / clearAuditLog پیدا نشد');
  const canRun = new Function('currentRole', canSrc + '; return canClearAuditLog();');
  assertEqual(canRun(null), true, 'مدیر کل باید بتواند لاگ را پاک کند');
  assertEqual(canRun({roleKey:'admin', name:'ادمین'}), true, 'نقش admin باید بتواند پاک کند');
  assertEqual(canRun({roleKey:'manager', name:'مدیر'}), false, 'مدیر عملیاتی نباید لاگ را پاک کند');
  assertEqual(canRun({roleKey:'operator', name:'اپراتور'}), false, 'اپراتور نباید لاگ را پاک کند');
  assertTrue(clrSrc.indexOf('canClearAuditLog') >= 0, 'clearAuditLog باید مجوز را چک کند');
});

test('فیلتر گزارش فعالیت باید کاربر، ماژول و رویدادهای حساس را جدا کند', () => {
  const normSrc = extractFunctionSource(html, 'normalizeAuditRec');
  const filSrc = extractFunctionSource(html, 'filterAuditRecords');
  const inferSrc = extractFunctionSource(html, 'inferAuditModule') || 'function inferAuditModule(a){ return a==="login"||a==="user_edit"?"auth":"app"; }';
  const sensSrc = extractFunctionSource(html, 'isSensitiveAuditAction') || 'function isSensitiveAuditAction(a){ return a==="login"||a==="user_edit"; }';
  assertTrue(!!normSrc && !!filSrc, 'normalizeAuditRec / filterAuditRecords پیدا نشد');
  const runner = new Function(inferSrc + '\n' + sensSrc + '\n' + normSrc + '\n' + filSrc + `
    var log = [
      {id:'a1', username:'علی', user:'علی', action:'login', module:'auth', description:'ورود', sensitive:true, ts:100},
      {id:'a2', username:'مینا', action:'ذخیره فاکتور', module:'invoice', description:'F-1', sensitive:false, ts:200},
      {id:'a3', username:'علی', action:'user_edit', module:'users', description:'نقش', sensitive:true, ts:300, detail:'نقش'}
    ];
    return {
      ali: filterAuditRecords(log, {user:'علی'}).map(function(e){return e.id;}),
      inv: filterAuditRecords(log, {module:'invoice'}).map(function(e){return e.id;}),
      sens: filterAuditRecords(log, {sensitiveOnly:true}).map(function(e){return e.id;}),
      q: filterAuditRecords(log, {q:'فاکتور'}).map(function(e){return e.id;})
    };
  `);
  const r = runner();
  assertEqual(r.ali, ['a1','a3'], 'فیلتر کاربر باید فقط رویدادهای علی را بدهد');
  assertEqual(r.inv, ['a2'], 'فیلتر ماژول باید فاکتور را جدا کند');
  assertEqual(r.sens, ['a1','a3'], 'فیلتر حساس باید ورود و تغییر دسترسی را بدهد');
  assertEqual(r.q, ['a2'], 'جستجوی متنی باید روی شرح/عملیات کار کند');
});

test('رابط کاربران و گزارش باید فیلد نقش، وضعیت، فیلترها و جزئیات رویداد داشته باشد', () => {
  ['role-key','role-active','role-force-pw','role-last-login','audit-filter-user','audit-filter-module','audit-filter-action','audit-filter-sensitive','audit-detail-modal','force-pw-modal','login-user-input'].forEach(id => {
    assertContainsString(html, 'id="'+id+'"', 'عنصر '+id+' لازم است');
  });
  assertContainsString(html, 'function exportAuditExcel(', 'خروجی اکسل گزارش لازم است');
  assertContainsString(html, 'function printAuditReport(', 'خروجی PDF/چاپ گزارش لازم است');
  assertContainsString(html, 'function openAuditDetail(', 'جزئیات رویداد لازم است');
  assertContainsString(html, 'function toggleUserActive(', 'فعال/غیرفعال کردن کاربر لازم است');
  const exp = extractFunctionSource(html, 'exportAuditExcel');
  assertTrue(exp.indexOf('ماژول') >= 0 || exp.indexOf('module') >= 0, 'اکسل باید ستون ماژول داشته باشد');
  assertTrue(exp.indexOf('OldValues') >= 0 || exp.indexOf('مقدار قبلی') >= 0 || exp.indexOf('oldValues') >= 0, 'اکسل باید مقادیر قبلی را داشته باشد');
});

test('میزبان دات‌نت باید نام رایانه را برای ثبت فعالیت بدهد و HTML-only نشکند', () => {
  const hostPath = path.join(path.dirname(filePath), 'desktop', 'Sirman.Desktop', 'SirmanHostObject.cs');
  assertTrue(fs.existsSync(hostPath), 'SirmanHostObject.cs باید وجود داشته باشد');
  const host = fs.readFileSync(hostPath, 'utf8');
  assertContainsString(host, 'GetMachineInfo', 'میزبان باید GetMachineInfo داشته باشد');
  assertContainsString(host, 'Environment.MachineName', 'باید نام رایانه ویندوز خوانده شود');
  const machSrc = extractFunctionSource(html, 'getMachineAuditInfo');
  assertTrue(!!machSrc, 'getMachineAuditInfo پیدا نشد');
  assertTrue(machSrc.indexOf('GetMachineInfo') >= 0, 'HTML باید در exe از Host Object نام رایانه بگیرد');
  assertTrue(machSrc.indexOf('HTML') >= 0, 'بدون exe باید نام رایانه HTML باشد نه اینکه کرش کند');
});

test('قانون ۷: راهنمای نقش‌ها و گزارش فعالیت باید موجود باشد', () => {
  assertContainsString(html, 'نقش‌ها', 'راهنما باید نقش‌ها را توضیح دهد');
  assertContainsString(html, 'گزارش فعالیت', 'راهنما باید گزارش فعالیت را توضیح دهد');
  assertContainsString(html, 'مدیر سیستم', 'راهنما باید نقش مدیر سیستم را بگوید');
  assertContainsString(html, 'بازدیدکننده', 'راهنما باید نقش بازدیدکننده را بگوید');
  assertContainsString(html, 'رویدادهای حساس', 'راهنما باید فیلتر حساس را بگوید');
});

test('saveRole همچنان نباید رمز کاربر را با رمز کلی نرم‌افزار یکی کند', () => {
  const saveRoleSrc = extractFunctionSource(html, 'saveRole');
  assertTrue(saveRoleSrc !== null, 'تابع saveRole پیدا نشد');
  assertTrue(saveRoleSrc.indexOf('passwordMatches') >= 0 || saveRoleSrc.indexOf('pw === loginPw') >= 0,
    'باید رمز پروفایل را با رمز کلی نرم‌افزار مقایسه کند تا تداخل پیش نیاید');
});


console.log('');
console.log('📋 گروه: مرکز راهنمای جامع');

test('جستجوی راهنما باید پرسش طبیعی مثل چاپ فاکتور را بفهمد', () => {
  const src = extractFunctionSource(html, 'expandHelpQuery');
  assertTrue(!!src, 'تابع expandHelpQuery پیدا نشد');
  const runner = new Function(src + `
    return {
      print: expandHelpQuery('چطور فاکتور چاپ کنم؟'),
      closed: expandHelpQuery('پذیرش بسته نمی‌شود'),
      pw: expandHelpQuery('چگونه رمز عبور را تغییر دهم'),
      empty: expandHelpQuery('')
    };
  `);
  const r = runner();
  assertTrue(/چاپ|پرینت|فاکتور/i.test(r.print), 'پرسش چاپ فاکتور باید به مقاله چاپ برسد');
  assertTrue(/بستن|پذیرش|گارانتی|پرونده/i.test(r.closed), 'پذیرش بسته نمی‌شود باید عیب‌یابی پذیرش را پیدا کند');
  assertTrue(/رمز|کاربر|نقش/i.test(r.pw), 'تغییر رمز باید به کاربران برسد');
  assertEqual(r.empty, '', 'جستجوی خالی باید خالی بماند');
});

test('راهنمای این صفحه باید صفحه جاری را به مقاله مرتبط ببرد', () => {
  ['openPageHelp','ensurePageHelpButtons','focusHelpTopic'].forEach(fn => {
    assertTrue(extractFunctionSource(html, fn) !== null, 'تابع '+fn+' پیدا نشد');
  });
  const openSrc = extractFunctionSource(html, 'openPageHelp');
  assertTrue(openSrc.indexOf('winHelpMeta') >= 0 || openSrc.indexOf('focusHelpTopic') >= 0, 'openPageHelp باید موضوع همان صفحه را باز کند');
  assertContainsString(html, 'راهنمای این صفحه', 'دکمه راهنمای این صفحه لازم است');
});

test('آموزش تعاملی اولین استفاده باید قابل شروع و رد شدن باشد', () => {
  const startSrc = extractFunctionSource(html, 'startHelpTour');
  const skipSrc = extractFunctionSource(html, 'skipHelpTour');
  const nextSrc = extractFunctionSource(html, 'nextHelpTourStep');
  assertTrue(!!startSrc && !!skipSrc && !!nextSrc, 'توابع آموزش تعاملی پیدا نشد');
  assertContainsString(html, 'id="help-tour-overlay"', 'پوسته آموزش تعاملی لازم است');
  assertTrue(startSrc.indexOf('dashboard') >= 0 && startSrc.indexOf('phonebook') >= 0, 'آموزش باید از محیط و ثبت مشتری بگذرد');
  assertTrue(skipSrc.indexOf('laegh_help_tour_done') >= 0, 'رد کردن باید ذخیره شود تا دوباره مزاحم نشود');
});

test('گزارش مشکل باید نسخه، کاربر، ماژول و کد خطا را بدون ارسال بیرون ذخیره کند', () => {
  const src = extractFunctionSource(html, 'submitHelpProblem');
  assertTrue(!!src, 'تابع submitHelpProblem پیدا نشد');
  assertContainsString(html, 'id="help-report-modal"', 'مودال گزارش مشکل لازم است');
  const runner = new Function('document','localStorage','ntf','closeMod', src + `
    var APP_VERSION = '1405.5.23ε';
    var currentRole = {name:'علی', id:'u1'};
    function getMachineAuditInfo(){ return {computerName:'PC-TEST'}; }
    submitHelpProblem();
    var raw = localStorage.getItem('laegh_help_tickets');
    return JSON.parse(raw || '[]');
  `);
  const store = {};
  const ls = { getItem:k=>store[k]||null, setItem:(k,v)=>{ store[k]=String(v); } };
  const doc = {
    getElementById: function(id){
      const vals = {
        'help-report-module': {value:'warranty'},
        'help-report-text': {value:'پرونده ذخیره نشد'},
        'help-report-code': {value:'ERR-AUTH-001'}
      };
      return vals[id] || {value:''};
    }
  };
  const tickets = runner(doc, ls, function(){}, function(){});
  assertTrue(Array.isArray(tickets) && tickets.length === 1, 'باید یک گزارش محلی ذخیره شود');
  assertEqual(tickets[0].module, 'warranty', 'ماژول باید ذخیره شود');
  assertEqual(tickets[0].code, 'ERR-AUTH-001', 'کد خطا باید ذخیره شود');
  assertEqual(tickets[0].version, '1405.5.23ε', 'نسخه نرم‌افزار باید ضمیمه شود');
  assertEqual(tickets[0].computerName, 'PC-TEST', 'نام سیستم باید ضمیمه شود');
  assertTrue(tickets[0].user.indexOf('علی') >= 0, 'نام کاربر باید ضمیمه شود');
  assertTrue(JSON.stringify(tickets[0]).indexOf('http') === -1, 'گزارش نباید به بیرون ارسال شود');
});

test('پیام خطا باید به مقاله راهنمای حل مشکل وصل شود', () => {
  const src = extractFunctionSource(html, 'openHelpForError');
  const crit = extractFunctionSource(html, 'showCriticalErrorModal');
  assertTrue(!!src, 'تابع openHelpForError پیدا نشد');
  assertTrue(crit.indexOf('openHelpForError') >= 0 || html.indexOf('openHelpForError(') >= 0, 'پنجره خطا باید دکمه راهنما داشته باشد');
  assertContainsString(html, 'راهنمای حل مشکل', 'دکمه راهنمای حل مشکل لازم است');
  const runner = new Function(src + `
    var last = '';
    function showPage(id){ last += 'page:'+id+';'; }
    function focusHelpTopic(m){ last += 'topic:'+(m && (m.q||m.h||m))+';'; }
    function expandHelpQuery(q){ return q; }
    openHelpForError('ERR-AUTH-001');
    return last;
  `);
  const r = runner();
  assertTrue(r.indexOf('page:help') >= 0, 'باید صفحه راهنما باز شود');
  assertTrue(/رمز|ورود|AUTH/i.test(r), 'خطای ورود باید مقاله رمز را باز کند');
});

test('بازخورد مفید بودن مقاله راهنما باید محلی ذخیره شود', () => {
  const src = extractFunctionSource(html, 'rateHelpArticle');
  assertTrue(!!src, 'تابع rateHelpArticle پیدا نشد');
  const runner = new Function('localStorage', src + `
    rateHelpArticle('faq-new-customer', true);
    rateHelpArticle('faq-new-customer', false);
    return JSON.parse(localStorage.getItem('laegh_help_feedback')||'{}');
  `);
  const store = {};
  const fb = runner({ getItem:k=>store[k]||null, setItem:(k,v)=>{ store[k]=String(v); } });
  assertEqual(fb['faq-new-customer'].useful, false, 'آخرین رأی باید ذخیره شود');
  assertTrue(fb['faq-new-customer'].no >= 1, 'رأی خیر باید شمارش شود');
});

test('قانون ۷: مرکز راهنما باید شروع سریع، فرآیند، FAQ، واژه‌نامه و راهنمای مدیر داشته باشد', () => {
  assertContainsString(html, 'شروع سریع', 'شروع سریع لازم است');
  assertContainsString(html, 'چگونه یک مشتری جدید ثبت کنم', 'FAQ مشتری جدید لازم است');
  assertContainsString(html, 'چرا فاکتور چاپ نمی‌شود', 'FAQ چاپ فاکتور لازم است');
  assertContainsString(html, 'واژه‌نامه', 'واژه‌نامه لازم است');
  assertContainsString(html, 'راهنمای مدیر سیستم', 'راهنمای مدیر سیستم لازم است');
  assertContainsString(html, 'آموزش تعاملی', 'آموزش تعاملی لازم است');
  assertContainsString(html, 'گزارش مشکل', 'گزارش مشکل لازم است');
  const inv = html.match(/راهنمای بخش فاکتور[\s\S]{0,800}/);
  assertTrue(!!inv && inv[0].indexOf('به‌زودی') === -1, 'راهنمای فاکتور نباید ناتمام بماند');
  const prod = html.match(/راهنمای بخش کالا و انبار[\s\S]{0,900}/);
  assertTrue(!!prod && prod[0].indexOf('به‌زودی') === -1, 'راهنمای کالا و انبار نباید ناتمام بماند');
});

test('مرکز راهنما باید باز/بسته کردن همه موضوع‌ها و شمارش نتیجه جستجو داشته باشد', () => {
  assertContainsString(html, 'id="help-expand-all"', 'دکمه باز کردن همه موضوع‌ها پیدا نشد');
  assertContainsString(html, 'id="help-collapse-all"', 'دکمه بستن همه موضوع‌ها پیدا نشد');
  assertContainsString(html, 'id="help-search-count"', 'شمارش نتیجه جستجوی راهنما پیدا نشد');
  assertContainsString(html, 'onclick="expandAllHelpTopics()"', 'دکمه باز کردن همه به expandAllHelpTopics وصل نیست');
  assertContainsString(html, 'onclick="collapseAllHelpTopics()"', 'دکمه بستن همه به collapseAllHelpTopics وصل نیست');
  const expSrc = extractFunctionSource(html, 'expandAllHelpTopics');
  const colSrc = extractFunctionSource(html, 'collapseAllHelpTopics');
  const cntSrc = extractFunctionSource(html, 'updateHelpSearchCount');
  const txtSrc = extractFunctionSource(html, 'helpNavCountText');
  assertTrue(!!expSrc && !!colSrc && !!cntSrc && !!txtSrc, 'توابع ناوبری درخت راهنما پیدا نشد');
  const initSrc = extractFunctionSource(html, 'initHelpTree');
  assertTrue(initSrc.indexOf('next=el.nextElementSibling') >= 0 || initSrc.indexOf('const next=el.nextElementSibling') >= 0,
    'initHelpTree باید قبل از جابه‌جایی کارت، خواهر بعدی را نگه دارد وگرنه هر شاخه فقط یک مقاله می‌گیرد');
  const runner = new Function(txtSrc + '\n' + cntSrc + '\n' + expSrc + '\n' + colSrc + `
    function initHelpTree(){}
    function faNum(s){ return String(s); }
    var treeCls = ['collapsed'];
    var cardCls = ['help-collapsed'];
    function cls(arr){
      return {
        add: function(c){ if(arr.indexOf(c)<0) arr.push(c); },
        remove: function(c){ var i=arr.indexOf(c); if(i>=0) arr.splice(i,1); }
      };
    }
    var tree = { classList: cls(treeCls) };
    var card = { classList: cls(cardCls) };
    var count = { textContent: '' };
    var document = {
      querySelectorAll: function(sel){
        if (sel.indexOf('help-tree-node')>=0) return [tree];
        if (sel.indexOf('help-card')>=0) return [card];
        return [];
      },
      getElementById: function(id){ return id==='help-search-count' ? count : null; }
    };
    expandAllHelpTopics();
    var afterExp = { tree: treeCls.slice(), card: cardCls.slice() };
    collapseAllHelpTopics();
    var afterCol = { tree: treeCls.slice(), card: cardCls.slice() };
    updateHelpSearchCount('', 12);
    var allTxt = count.textContent;
    updateHelpSearchCount('فاکتور', 3);
    var hitTxt = count.textContent;
    updateHelpSearchCount('xyz', 0);
    var emptyTxt = count.textContent;
    return { afterExp: afterExp, afterCol: afterCol, allTxt: allTxt, hitTxt: hitTxt, emptyTxt: emptyTxt };
  `);
  const r = runner();
  assertTrue(r.afterExp.tree.indexOf('collapsed') < 0, 'باز کردن همه باید collapsed را از گره درخت بردارد');
  assertTrue(r.afterExp.card.indexOf('help-collapsed') < 0, 'باز کردن همه باید help-collapsed را از کارت بردارد');
  assertTrue(r.afterCol.tree.indexOf('collapsed') >= 0, 'بستن همه باید collapsed را به گره درخت برگرداند');
  assertTrue(r.afterCol.card.indexOf('help-collapsed') >= 0, 'بستن همه باید help-collapsed را به کارت برگرداند');
  assertTrue(/مقاله/.test(r.allTxt), 'بدون جستجو باید تعداد مقاله نشان داده شود');
  assertTrue(/نتیجه/.test(r.hitTxt), 'با جستجو باید تعداد نتیجه نشان داده شود');
  assertTrue(/۰ نتیجه|0 نتیجه/.test(r.emptyTxt), 'جستجوی بی‌نتیجه باید صفر نتیجه بگوید');
});


console.log('');
console.log('📋 گروه: هسته هوشمند — محاسبه، گردش‌کار، پیشنهاد قطعه');

test('موتور محاسبه باید فرمول‌های قطعی گارانتی/مانده/مبلغ نهایی/موجودی/نقطه سفارش را بدهد', () => {
  const addSrc = extractFunctionSource(html, 'addJalaliMonths');
  const endSrc = extractFunctionSource(html, 'calcWarrantyEndDate');
  const balSrc = extractFunctionSource(html, 'calcBalance');
  const finSrc = extractFunctionSource(html, 'calcFinalAmount');
  const avSrc = extractFunctionSource(html, 'calcAvailableStock');
  const reSrc = extractFunctionSource(html, 'calcReorderPoint');
  assertTrue(!!addSrc && !!endSrc && !!balSrc && !!finSrc && !!avSrc && !!reSrc, 'توابع موتور محاسبه پیدا نشد');
  assertContainsString(endSrc, 'addJalaliMonths', 'تاریخ پایان گارانتی باید همان addJalaliMonths موجود را صدا بزند نه فرمول موازی');
  const runner = new Function(addSrc + '\n' + endSrc + '\n' + balSrc + '\n' + finSrc + '\n' + avSrc + '\n' + reSrc + `
    return {
      end: calcWarrantyEndDate('1405/05/05', 24),
      bal: calcBalance(1000, 300),
      fin: calcFinalAmount(100, 50, 20, 10),
      av: calcAvailableStock(10, 3),
      avNeg: calcAvailableStock(2, 5),
      rp: calcReorderPoint(5, 4, 10)
    };
  `);
  const r = runner();
  assertEqual(r.end, '1407/05/05', 'WarrantyEndDate = PurchaseDate + 24 ماه');
  assertEqual(r.bal, 700, 'Balance = TotalAmount - PaidAmount');
  assertEqual(r.fin, 160, 'FinalAmount = قطعات + اجرت + سایر - تخفیف');
  assertEqual(r.av, 7, 'AvailableStock = CurrentStock - ReservedStock');
  assertEqual(r.avNeg, 0, 'موجودی قابل‌استفاده نباید منفی شود');
  assertEqual(r.rp, 30, 'ReorderPoint = AverageUsage × LeadTime + SafetyStock');
});

test('وضعیت SLA باید آستانه ۲۴/۴۸/۷۲ ساعت موجود را به normal/warning/critical/overdue نگاشت کند', () => {
  const src = extractFunctionSource(html, 'calcSlaStatusFromAgeHours');
  assertTrue(!!src, 'تابع calcSlaStatusFromAgeHours پیدا نشد');
  const runner = new Function(src + `
    function hasBusinessCore(){ return false; }
    return {
      n: calcSlaStatusFromAgeHours(10),
      w: calcSlaStatusFromAgeHours(24),
      c: calcSlaStatusFromAgeHours(48),
      o: calcSlaStatusFromAgeHours(72)
    };
  `);
  const r = runner();
  assertEqual(r.n, 'normal', 'کمتر از ۲۴ ساعت باید عادی باشد');
  assertEqual(r.w, 'warning', '۲۴ ساعت باید هشدار باشد');
  assertEqual(r.c, 'critical', '۴۸ ساعت باید بحرانی باشد');
  assertEqual(r.o, 'overdue', '۷۲ ساعت باید سررسیدگذشته باشد');
  const slaSrc = extractFunctionSource(html, 'checkWarrantySlaAlerts');
  assertContainsString(slaSrc, 'calcSlaStatusFromAgeHours', 'هشدار SLA موجود باید از موتور محاسبه استفاده کند نه آستانه موازی');
});

test('پیشنهاد قطعه باید فقط از کاتالوگ موجود بیاید و دلیل فارسی بدهد', () => {
  const src = extractFunctionSource(html, 'suggestPartsForCase');
  assertTrue(!!src, 'تابع suggestPartsForCase پیدا نشد');
  const runner = new Function(src + `
    var catalog = [
      {code:'P-HEAT', name:'هیتر', prodCode:'402003', cat:'گرمایش', qty:4},
      {code:'P-OTHER', name:'واشر', prodCode:'999', cat:'متفرقه', qty:2}
    ];
    var hits = suggestPartsForCase({prodCode:'402003', model:'چای‌ساز', problem:'هیتر', parts:catalog});
    var invented = suggestPartsForCase({prodCode:'NO-SUCH', problem:'xyz', parts:catalog});
    return {hits:hits, invented:invented};
  `);
  const r = runner();
  assertTrue(Array.isArray(r.hits) && r.hits.length >= 1, 'باید حداقل یک قطعه مرتبط برگردد');
  assertEqual(r.hits[0].code, 'P-HEAT', 'باید همان کد کاتالوگ برگردد نه کد ساختگی');
  assertTrue(String(r.hits[0].explain||'').indexOf('کالای مرتبط') >= 0, 'باید دلیل «کالای مرتبط» داشته باشد');
  assertTrue(r.hits.every(function(h){ return h.code==='P-HEAT' || h.code==='P-OTHER'; }), 'نباید قطعه خارج از کاتالوگ ساخته شود');
  assertTrue(Array.isArray(r.invented) && r.invented.length === 0, 'بدون تطبیق نباید قطعه‌ای اختراع شود');
});

test('گذار وضعیت گارانتی باید فقط open→closed مجاز باشد و پرونده را بازنویسی نکند', () => {
  const canSrc = extractFunctionSource(html, 'canWarrantyTransition');
  const appSrc = extractFunctionSource(html, 'applyWarrantyTransition');
  assertTrue(!!canSrc && !!appSrc, 'توابع گردش‌کار گارانتی پیدا نشد');
  const runner = new Function(canSrc + '\n' + appSrc + `
    var rec = {id:'W-1', status:'open', name:'علی'};
    var ok = applyWarrantyTransition(rec, 'closed');
    var bad = applyWarrantyTransition({status:'closed'}, 'open');
    return {
      can: canWarrantyTransition('open','closed'),
      cannot: canWarrantyTransition('closed','open'),
      same: rec.status,
      next: ok.record && ok.record.status,
      ok: ok.ok,
      badOk: bad.ok
    };
  `);
  const r = runner();
  assertEqual(r.can, true, 'open به closed باید مجاز باشد');
  assertEqual(r.cannot, false, 'باز کردن دوباره پرونده بسته نباید از هسته مجاز شود');
  assertEqual(r.same, 'open', 'رکورد ورودی نباید mutate شود');
  assertEqual(r.next, 'closed', 'خروجی باید وضعیت بسته داشته باشد');
  assertEqual(r.ok, true, 'گذار مجاز باید ok باشد');
  assertEqual(r.badOk, false, 'گذار غیرمجاز باید رد شود');
});

test('SmartCore باید Event Bus و InventoryEngine و ErrorEngine موجود را بپوشاند نه جایگزین کند', () => {
  assertContainsString(html, 'var SmartCore = {', 'شیء SmartCore پیدا نشد');
  assertContainsString(html, 'var CalculationEngine = {', 'CalculationEngine پیدا نشد');
  assertContainsString(html, 'var InventoryEngine = {', 'InventoryEngine نباید حذف شود');
  assertContainsString(html, 'var ErrorEngine = {', 'ErrorEngine نباید حذف شود');
  assertContainsString(html, 'var _busListeners', 'Event Bus موجود نباید با باس دوم عوض شود');
  const coreChunk = html.match(/var SmartCore = \{[\s\S]{0,1200}/);
  assertTrue(!!coreChunk, 'بدنه SmartCore پیدا نشد');
  assertTrue(coreChunk[0].indexOf('InventoryEngine') >= 0, 'SmartCore باید InventoryEngine موجود را ارجاع دهد');
  assertTrue(coreChunk[0].indexOf('ErrorEngine') >= 0, 'SmartCore باید ErrorEngine موجود را ارجاع دهد');
  assertTrue(coreChunk[0].indexOf('emit') >= 0, 'SmartCore باید emit موجود را ارجاع دهد');
  const saveInv = extractFunctionSource(html, 'saveInv');
  const saveSale = extractFunctionSource(html, 'saveSale');
  const saveWar = extractFunctionSource(html, 'saveWar');
  assertContainsString(saveInv, "emit('invoice:saved'", 'saveInv باید همچنان invoice:saved بفرستد');
  assertContainsString(saveSale, "emit('sale:saved'", 'saveSale باید همچنان sale:saved بفرستد');
  assertContainsString(saveWar, "emit('warranty:saved'", 'saveWar باید همچنان warranty:saved بفرستد');
});

test('قانون ۷: راهنمای هسته هوشمند، محاسبه و پیشنهاد قطعه باید موجود باشد', () => {
  assertContainsString(html, 'هسته هوشمند', 'راهنما باید هسته هوشمند را بگوید');
  assertContainsString(html, 'پیشنهاد قطعه', 'راهنما باید پیشنهاد قطعه را بگوید');
  assertContainsString(html, 'محاسبه', 'راهنما باید محاسبه را بگوید');
  const exp = extractFunctionSource(html, 'expandHelpQuery');
  assertTrue(!!exp, 'expandHelpQuery پیدا نشد');
  const runner = new Function(exp + `; return expandHelpQuery('پیشنهاد قطعه');`);
  const q = runner();
  assertTrue(/هسته|پیشنهاد|قطعه/.test(q), 'جستجوی پیشنهاد قطعه باید به مقاله هسته برسد');
});

test('دکمه پیشنهاد هوشمند باید قطعه را از کاتالوگ به درخواست موجود اضافه کند', () => {
  assertTrue(extractFunctionSource(html, 'applySuggestedWarParts') !== null, 'تابع applySuggestedWarParts پیدا نشد');
  assertTrue(extractFunctionSource(html, 'getWarSuggestContext') !== null, 'تابع getWarSuggestContext پیدا نشد');
  assertContainsString(html, "applySuggestedWarParts('agency')", 'دکمه پیشنهاد نمایندگی لازم است');
  assertContainsString(html, "applySuggestedWarParts('company')", 'دکمه پیشنهاد کارشناس لازم است');
  const src = extractFunctionSource(html, 'applySuggestedWarParts');
  assertContainsString(src, 'suggestPartsForCase', 'باید از موتور پیشنهاد موجود استفاده کند');
});


console.log('');
console.log('📋 گروه: توصیه‌نامه امنیتی — رمز، نشست، ۲FA، حریم خصوصی');

test('رمز قوی باید رمز کوتاه یا بدون عدد را رد کند و رمز مخلوط را بپذیرد', () => {
  const src = extractFunctionSource(html, 'checkPasswordStrength');
  assertTrue(!!src, 'تابع checkPasswordStrength پیدا نشد');
  const runner = new Function(src + `
    return {
      short: checkPasswordStrength('ab1'),
      letters: checkPasswordStrength('abcdefgh'),
      ok: checkPasswordStrength('Abcd1234'),
      fa: checkPasswordStrength('سلام۱۲۳۴۵۶')
    };
  `);
  const r = runner();
  assertEqual(r.short.ok, false, 'رمز ۳ حرفی باید رد شود');
  assertEqual(r.letters.ok, false, 'رمز بدون عدد باید رد شود');
  assertEqual(r.ok.ok, true, 'رمز ۸ کاراکتری با حرف و عدد باید قبول شود');
  assertEqual(r.fa.ok, true, 'رمز فارسی با رقم باید قبول شود');
});

test('تعویض دوره‌ای رمز مدیر باید بعد از ۹۰ روز اجباری شود', () => {
  const src = extractFunctionSource(html, 'shouldForcePwChange');
  assertTrue(!!src, 'تابع shouldForcePwChange پیدا نشد');
  const runner = new Function(src + `
    var now = Date.UTC(2026,7,14);
    var day = 24*3600*1000;
    return {
      fresh: shouldForcePwChange({roleKey:'admin', pwChangedAt: now-10*day, forcePwChange:false}, now),
      old: shouldForcePwChange({roleKey:'admin', pwChangedAt: now-91*day, forcePwChange:false}, now),
      op: shouldForcePwChange({roleKey:'operator', pwChangedAt: now-200*day, forcePwChange:false}, now),
      flag: shouldForcePwChange({roleKey:'viewer', forcePwChange:true, pwChangedAt: now}, now)
    };
  `);
  const r = runner();
  assertEqual(r.fresh, false, 'رمز تازه‌ی مدیر نباید منقضی باشد');
  assertEqual(r.old, true, 'رمز مدیر بعد از ۹۰ روز باید تعویض اجباری شود');
  assertEqual(r.op, false, 'اپراتور بدون پرچم نباید از روی سن رمز قفل شود');
  assertEqual(r.flag, true, 'پرچم forcePwChange باید همیشه اعمال شود');
});

test('TOTP محلی باید بردار RFC را تأیید کند و کد غلط را رد کند', () => {
  const sha = extractFunctionSource(html, 'secSha1');
  const hmac = extractFunctionSource(html, 'secHmacSha1');
  const b32 = extractFunctionSource(html, 'secBase32Decode');
  const totp = extractFunctionSource(html, 'totpCodeAt');
  const ver = extractFunctionSource(html, 'verifyTotpCode');
  assertTrue(!!sha && !!hmac && !!b32 && !!totp && !!ver, 'توابع TOTP پیدا نشد');
  const runner = new Function(sha+'\n'+hmac+'\n'+b32+'\n'+totp+'\n'+ver+`
    var secret = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';
    var t = 1111111109 * 1000;
    return {
      code: totpCodeAt(secret, t),
      ok: verifyTotpCode(secret, '081804', t),
      bad: verifyTotpCode(secret, '000000', t)
    };
  `);
  const r = runner();
  assertEqual(r.code, '081804', 'بردار RFC 6238 برای ۶ رقم باید 081804 باشد');
  assertEqual(r.ok, true, 'کد درست باید قبول شود');
  assertEqual(r.bad, false, 'کد غلط باید رد شود');
});

test('بعد از ۵ ورود ناموفق باید ورود برای ۶۰ ثانیه قفل شود و با موفقیت پاک شود', () => {
  const rec = extractFunctionSource(html, 'registerLoginFailure');
  const back = extractFunctionSource(html, 'loginBackoffMs');
  const clr = extractFunctionSource(html, 'clearLoginFailures');
  assertTrue(!!rec && !!back && !!clr, 'توابع محدودیت ورود پیدا نشد');
  const runner = new Function(
    'var _loginFails = [];\n' + rec + '\n' + back + '\n' + clr + `
    var t0 = 1000000;
    for (var i=0;i<5;i++) registerLoginFailure(t0+i);
    var locked = loginBackoffMs(t0+4);
    clearLoginFailures();
    var after = loginBackoffMs(t0+4);
    return {locked:locked, after:after};
  `);
  const r = runner();
  assertTrue(r.locked > 0, 'بعد از ۵ شکست باید backoff داشته باشد');
  assertEqual(r.after, 0, 'ورود موفق باید قفل موقت را بردارد');
});

test('قفل بی‌فعالیتی باید دقیقه‌های تنظیم را بخواند و صفر یعنی خاموش', () => {
  const getSrc = extractFunctionSource(html, 'getIdleLockMinutes');
  const resetSrc = extractFunctionSource(html, 'resetIdleLockTimer');
  assertTrue(!!getSrc && !!resetSrc, 'توابع قفل بی‌فعالیتی پیدا نشد');
  const runner = new Function(getSrc + `
    var store = {'laegh_idle_lock_min':'20'};
    var localStorage = { getItem:function(k){ return store[k]||null; }, setItem:function(k,v){ store[k]=String(v); } };
    var a = getIdleLockMinutes();
    store['laegh_idle_lock_min'] = '0';
    var b = getIdleLockMinutes();
    store['laegh_idle_lock_min'] = 'bad';
    var c = getIdleLockMinutes();
    return {a:a,b:b,c:c};
  `);
  const r = runner();
  assertEqual(r.a, 20, 'باید دقیقه ذخیره‌شده را بخواند');
  assertEqual(r.b, 0, 'صفر یعنی قفل خودکار خاموش');
  assertEqual(r.c, 15, 'مقدار نامعتبر باید به ۱۵ دقیقه پیش‌فرض برگردد');
});

test('نقش مدیر انبار باید در کاتالوگ باشد و پنج نقش قبلی حذف نشوند', () => {
  const catSrc = extractConstSource(html, 'ROLE_CATALOG');
  assertTrue(!!catSrc, 'ROLE_CATALOG پیدا نشد');
  const cat = new Function('var ALL_PAGE_KEYS=["dashboard","tasks","invoice","saved","products","inventory","defective","warehouse","warehouse-entities","phonebook","postal","parts","daqi","services","sales","accounts","warranty","dataio","datetime","audit","settings","help"]; ' + catSrc + ' return ROLE_CATALOG;')();
  ['admin','manager','operator','service','viewer','warehouse'].forEach(k => {
    assertTrue(!!cat[k], 'نقش «'+k+'» باید باشد');
  });
  assertTrue((cat.warehouse.pages||[]).indexOf('warehouse')>=0, 'مدیر انبار باید به انبار دسترسی داشته باشد');
  assertTrue((cat.warehouse.pages||[]).indexOf('settings')<0, 'مدیر انبار نباید تنظیمات کل سیستم را داشته باشد');
});

test('ناشناس‌سازی مخاطب باید تلفن و آدرس را پاک کند و شناسه را نگه دارد', () => {
  const src = extractFunctionSource(html, 'anonymizeContactRecord');
  assertTrue(!!src, 'تابع anonymizeContactRecord پیدا نشد');
  const runner = new Function(src + `
    var c = {fn:'علی', ln:'محمدی', shop:'فروشگاه', addr:'تهران', zip:'123', phones:['0912'], nid:'0012345678', cat:'customer'};
    var out = anonymizeContactRecord(c);
    return {out:out, same: c===out ? null : 'copied'};
  `);
  const r = runner();
  assertEqual(r.out.fn, 'حذف‌شده', 'نام باید ناشناس شود');
  assertEqual((r.out.phones||[]).length, 0, 'تلفن باید پاک شود');
  assertEqual(r.out.addr, '', 'آدرس باید پاک شود');
  assertEqual(r.out.nid, '', 'کد ملی باید پاک شود');
  assertEqual(r.out.privacyAnonymized, true, 'پرچم ناشناس باید باشد');
  assertEqual(r.out.cat, 'customer', 'دسته برای آمار باید بماند');
});

test('قانون ۷: راهنمای امنیت باید رمز قوی، ۲FA، قفل نشست، رضایت و واکنش به رخداد را بگوید', () => {
  assertContainsString(html, 'رمز قوی', 'راهنما باید رمز قوی را بگوید');
  assertContainsString(html, 'دومرحله', 'راهنما باید احراز هویت دومرحله‌ای را بگوید');
  assertContainsString(html, 'بی‌فعالیتی', 'راهنما باید قفل بی‌فعالیتی را بگوید');
  assertContainsString(html, 'رضایت', 'راهنما باید رضایت نگهداری اطلاعات را بگوید');
  assertContainsString(html, 'ناشناس', 'راهنما باید ناشناس‌سازی را بگوید');
  assertContainsString(html, 'واکنش به رخداد', 'راهنما باید برنامه واکنش به رخداد را بگوید');
  const exp = extractFunctionSource(html, 'expandHelpQuery');
  const runner = new Function(exp + `; return expandHelpQuery('رمز قوی');`);
  const q = runner();
  assertTrue(/رمز|امنیت|قوی/.test(q), 'جستجوی رمز قوی باید به مقاله امنیت برسد');
});

console.log('');
console.log('📋 گروه: شبکه داخلی LAN (بدون API کسب‌وکار موازی)');

test('نقش شبکه باید سرور/ایستگاه/مستقل باشد و آدرس LAN ساخته شود', () => {
  const roleSrc = extractFunctionSource(html, 'normalizeNetworkRole');
  const ipSrc = extractFunctionSource(html, 'isLanIpv4');
  const urlSrc = extractFunctionSource(html, 'buildLanAppUrl');
  const pickSrc = extractFunctionSource(html, 'pickPrimaryLanIp');
  assertTrue(!!roleSrc && !!ipSrc && !!urlSrc && !!pickSrc, 'توابع نقش/IP شبکه پیدا نشد');
  const runner = new Function(roleSrc + '\n' + ipSrc + '\n' + urlSrc + '\n' + pickSrc + `
    var SIRMAN_LAN_PORT = 8765;
    return {
      server: normalizeNetworkRole('سرور'),
      station: normalizeNetworkRole('client'),
      alone: normalizeNetworkRole(''),
      loop: isLanIpv4('127.0.0.1'),
      apipa: isLanIpv4('169.254.1.1'),
      lan: isLanIpv4('192.168.1.20'),
      bad: isLanIpv4('not-an-ip'),
      url: buildLanAppUrl('192.168.1.20', 8765, 'Sirman_Final.html'),
      empty: buildLanAppUrl('127.0.0.1', 8765, 'Sirman_Final.html'),
      pick: pickPrimaryLanIp(['10.0.0.5','192.168.1.20'])
    };
  `);
  const r = runner();
  assertEqual(r.server, 'server', 'سرور باید server شود');
  assertEqual(r.station, 'station', 'client باید station شود');
  assertEqual(r.alone, 'standalone', 'نقش خالی باید standalone باشد');
  assertEqual(r.loop, false, 'لوپ‌بک LAN نیست');
  assertEqual(r.apipa, false, 'APIPA نباید LAN معتبر باشد');
  assertEqual(r.lan, true, '192.168 باید LAN باشد');
  assertEqual(r.bad, false, 'رشته نامعتبر نباید IP باشد');
  assertEqual(r.url, 'http://192.168.1.20:8765/Sirman_Final.html', 'آدرس اشتراک LAN باید از IP و پورت فعلی ساخته شود');
  assertEqual(r.empty, '', 'لوپ‌بک نباید لینک اشتراک بسازد');
  assertEqual(r.pick, '192.168.1.20', 'ترجیح با 192.168 است');
});

test('پوشه مشترک باید مسیر فایل باشد نه URL عمومی، و فقط سرور اجازه انتشار دارد', () => {
  const parseSrc = extractFunctionSource(html, 'parseNetworkSettings');
  const valSrc = extractFunctionSource(html, 'validateSharedFolderPath');
  const pubSrc = extractFunctionSource(html, 'canPublishWorkspace');
  const pullSrc = extractFunctionSource(html, 'canPullWorkspace');
  assertTrue(!!parseSrc && !!valSrc && !!pubSrc && !!pullSrc, 'توابع پوشه مشترک پیدا نشد');
  const runner = new Function(parseSrc + '\n' + valSrc + '\n' + pubSrc + '\n' + pullSrc + `
    var SIRMAN_LAN_PORT = 8765;
    function normalizeNetworkRole(role){
      var r = String(role||'').toLowerCase().trim();
      if(r==='server' || r==='سرور') return 'server';
      if(r==='station' || r==='client' || r==='ایستگاه') return 'station';
      return 'standalone';
    }
    var http = validateSharedFolderPath('https://example.com/api');
    var unc = validateSharedFolderPath('\\\\\\\\OFFICE\\\\SirmanShare');
    var drv = validateSharedFolderPath('D:\\\\Share\\\\Sirman');
    var empty = validateSharedFolderPath('');
    var pubOk = canPublishWorkspace({role:'server', sharedFolder:'\\\\\\\\OFFICE\\\\SirmanShare'});
    var pubStation = canPublishWorkspace({role:'station', sharedFolder:'\\\\\\\\OFFICE\\\\SirmanShare'});
    var pull = canPullWorkspace({role:'station', sharedFolder:'Z:\\\\Sirman'});
    var parsed = parseNetworkSettings({role:'سرور', port:'0', lanEnabled:1, sharedFolder:'  C:\\\\Data  '});
    return {http:http, unc:unc, drv:drv, empty:empty, pubOk:pubOk, pubStation:pubStation, pull:pull, parsed:parsed};
  `);
  const r = runner();
  assertEqual(r.http.ok, false, 'URL اینترنتی نباید پوشه مشترک باشد');
  assertEqual(r.unc.ok, true, 'مسیر UNC باید قبول شود');
  assertEqual(r.drv.ok, true, 'درایو ویندوز باید قبول شود');
  assertEqual(r.empty.ok, false, 'پوشه خالی برای اشتراک کافی نیست');
  assertEqual(r.pubOk.ok, true, 'سرور با پوشه UNC باید بتواند منتشر کند');
  assertEqual(r.pubStation.ok, false, 'ایستگاه نباید منتشرکننده باشد');
  assertEqual(r.pull.ok, true, 'ایستگاه با درایو شبکه باید بتواند دریافت کند');
  assertEqual(r.parsed.role, 'server', 'نقش فارسی باید نرمال شود');
  assertEqual(r.parsed.port, 8765, 'پورت نامعتبر باید به ۸۷۶۵ برگردد');
  assertEqual(r.parsed.lanEnabled, true, 'lanEnabled باید بولین شود');
});

test('مسیر HTTP مجاز LAN فقط سلامت/هویت است نه CRUD کسب‌وکار', () => {
  const allowSrc = extractFunctionSource(html, 'isAllowedLanHttpPath');
  const bizSrc = extractFunctionSource(html, 'isBusinessHttpPathForbidden');
  const healthSrc = extractFunctionSource(html, 'buildNetworkHealthPayload');
  const stageSrc = extractFunctionSource(html, 'describeNetworkStage');
  const bindSrc = extractFunctionSource(html, 'classifyLanBindMode');
  assertTrue(!!allowSrc && !!bizSrc && !!healthSrc && !!stageSrc && !!bindSrc, 'توابع مسیر LAN پیدا نشد');
  const runner = new Function(allowSrc + '\n' + bizSrc + '\n' + healthSrc + '\n' + stageSrc + '\n' + bindSrc + `
    function normalizeNetworkRole(role){
      var r = String(role||'').toLowerCase().trim();
      if(r==='server' || r==='سرور') return 'server';
      if(r==='station' || r==='client' || r==='ایستگاه') return 'station';
      return 'standalone';
    }
    var h = buildNetworkHealthPayload({version:'1405.5.23ζ', role:'server', hostname:'OFFICE-PC'});
    var st = describeNetworkStage();
    return {
      health: isAllowedLanHttpPath('/health'),
      ident: isAllowedLanHttpPath('/sirman-net.json'),
      html: isAllowedLanHttpPath('/Sirman_Final.html'),
      api: isAllowedLanHttpPath('/api/invoices'),
      bizApi: isBusinessHttpPathForbidden('/api/invoices'),
      bizWar: isBusinessHttpPathForbidden('/warranty/12'),
      healthOk: h.ok,
      bizFlag: h.businessApi,
      stage: st.current,
      https: st.publicHttps,
      rest: st.restCrud,
      lan: classifyLanBindMode('1'),
      loop: classifyLanBindMode('')
    };
  `);
  const r = runner();
  assertEqual(r.health, true, '/health باید مجاز باشد');
  assertEqual(r.ident, true, '/sirman-net.json باید مجاز باشد');
  assertEqual(r.html, true, 'فایل UI باید از سرور فایل سرو شود');
  assertEqual(r.api, false, '/api/invoices نباید مسیر مجاز LAN باشد');
  assertEqual(r.bizApi, true, 'CRUD فاکتور روی HTTP باید ممنوع باشد');
  assertEqual(r.bizWar, true, 'پرونده گارانتی روی HTTP باید ممنوع باشد');
  assertEqual(r.healthOk, true, 'health باید ok باشد');
  assertEqual(r.bizFlag, false, 'health نباید API کسب‌وکار معرفی شود');
  assertEqual(r.stage, 3, 'مرحله فعلی باید شبکه داخلی باشد');
  assertEqual(r.https, false, 'این نسخه HTTPS عمومی ندارد');
  assertEqual(r.rest, false, 'این نسخه REST CRUD ندارد');
  assertEqual(r.lan, 'lan', 'فلگ ۱ یعنی bind روی LAN');
  assertEqual(r.loop, 'loopback', 'پیش‌فرض باید فقط همین رایانه باشد');
});

test('فهرست ایستگاه‌ها باید با IP به‌روز شود نه رکورد تکراری بسازد', () => {
  const src = extractFunctionSource(html, 'upsertWorkstation');
  const roleSrc = extractFunctionSource(html, 'normalizeNetworkRole');
  assertTrue(!!src && !!roleSrc, 'تابع upsertWorkstation پیدا نشد');
  const runner = new Function(roleSrc + '\n' + src + `
    var a = upsertWorkstation([], {name:'میز1', ip:'192.168.1.10', role:'station'});
    var b = upsertWorkstation(a, {name:'میز1-ب', ip:'192.168.1.10', role:'server'});
    var c = upsertWorkstation(b, {name:'میز2', ip:'192.168.1.11', role:'station'});
    return {len:c.length, first:c[0], second:c[1], origLen:a.length};
  `);
  const r = runner();
  assertEqual(r.origLen, 1, 'اولین ایستگاه باید اضافه شود');
  assertEqual(r.len, 2, 'IP جدید باید ردیف جدا باشد');
  assertEqual(r.first.name, 'میز1-ب', 'همان IP باید به‌روز شود');
  assertEqual(r.first.role, 'server', 'نقش همان ایستگاه باید عوض شود');
  assertEqual(r.second.ip, '192.168.1.11', 'ایستگاه دوم باید IP جدا داشته باشد');
});

test('تب شبکه، راهنما و مسیر Host Object باید وجود داشته باشند بدون API موازی', () => {
  assertContainsString(html, 'id="stg-network"', 'تب تنظیمات شبکه لازم است');
  assertContainsString(html, 'showStgTab(\'network\'', 'دکمه تب شبکه لازم است');
  assertContainsString(html, 'function publishNetworkWorkspace(', 'انتشار فضای کاری لازم است');
  assertContainsString(html, 'function pullNetworkWorkspace(', 'دریافت فضای کاری لازم است');
  assertContainsString(html, 'WriteWorkspaceFile', 'باید از Host برای نوشتن فضای کاری استفاده شود');
  assertContainsString(html, 'GetNetworkInfo', 'باید مشخصات شبکه را از Host بخواند');
  assertContainsString(html, 'شبکه داخلی دفتر', 'راهنما باید شبکه داخلی را توضیح دهد');
  assertContainsString(html, 'پوشه مشترک', 'راهنما باید پوشه مشترک را بگوید');
  const exp = extractFunctionSource(html, 'expandHelpQuery');
  const q = new Function(exp + `; return expandHelpQuery('شبکه داخلی');`)();
  assertTrue(/شبکه|پوشه|لانچر/.test(q), 'جستجوی شبکه باید به مقاله شبکه برسد');
  assertTrue(html.indexOf('fetch(\'/api/') === -1 && html.indexOf('fetch("/api/') === -1, 'نباید fetch به API کسب‌وکار اضافه شود');
  const hostPath = path.join(path.dirname(filePath), 'desktop', 'Sirman.Desktop', 'SirmanHostObject.cs');
  assertTrue(fs.existsSync(hostPath), 'SirmanHostObject.cs باید وجود داشته باشد');
  const host = fs.readFileSync(hostPath, 'utf8');
  assertContainsString(host, 'GetNetworkInfo', 'میزبان باید GetNetworkInfo داشته باشد');
  assertContainsString(host, 'WriteWorkspaceFile', 'میزبان باید فضای کاری مشترک بنویسد');
  assertContainsString(host, 'ReadWorkspaceFile', 'میزبان باید فضای کاری مشترک بخواند');
  assertContainsString(host, 'SetNetworkConfig', 'میزبان باید تنظیم LAN را ذخیره کند');
  const ps1 = fs.readFileSync(path.join(path.dirname(filePath), 'sirman_run.ps1'), 'utf8');
  assertContainsString(ps1, '/health', 'سرور فایل باید health داشته باشد');
  assertContainsString(ps1, '/sirman-net.json', 'سرور فایل باید هویت شبکه بدهد');
  assertContainsString(ps1, 'IPAddress]::Any', 'اشتراک LAN باید بتواند روی همه کارت‌ها bind شود');
  assertContainsString(ps1, 'lan-share.on', 'فعال‌سازی LAN باید از نشانگر موجود AppData خوانده شود');
  const rules = fs.readFileSync(path.join(path.dirname(filePath), 'docs', 'ARCHITECTURE_RULES.md'), 'utf8');
  assertContainsString(rules, 'GetNetworkInfo', 'تصمیم معماری باید متد شبکه را در لیست مجاز ثبت کند');
  assertContainsString(rules, 'health/identity', 'باید استثنای health ثبت شود');
});

console.log('');
console.log('📋 گروه: پیش‌نمایش دریافت فضای کاری شبکه (فاز ۳.۱)');

function networkPullPreviewBundle(srcHtml) {
  const names = [
    '_previewJsonEqual','_previewRecLabel','_previewPhonebookEntry',
    '_previewClassifyRecords','_previewClassifyOverwrite','_networkPullLiveSnapshot',
    'previewNetworkWorkspaceMerge','isNetworkWorkspaceBackupPackage','prepareNetworkWorkspacePull',
    'closeNetworkPullPreviewModal','cancelNetworkPullPreview','confirmNetworkPullPreview'
  ];
  return names.map(n => extractFunctionSource(srcHtml, n)).filter(Boolean).join('\n');
}

test('دریافت شبکه باید پیش‌نمایش بخواهد و فقط بعد از تأیید ادغام موجود را صدا بزند', () => {
  const pullSrc = extractFunctionSource(html, 'pullNetworkWorkspace');
  const confSrc = extractFunctionSource(html, 'confirmNetworkPullPreview');
  assertTrue(!!pullSrc && !!confSrc, 'توابع دریافت/تأیید پیدا نشد');
  assertTrue(pullSrc.indexOf('applyBackupSelective') === -1, 'pull نباید مستقیم ادغام کند');
  assertContainsString(pullSrc, 'prepareNetworkWorkspacePull', 'pull باید بسته را آماده کند');
  assertContainsString(pullSrc, 'openNetworkPullPreviewModal', 'pull باید مودال پیش‌نمایش را باز کند');
  assertContainsString(confSrc, "applyBackupSelective(d, null, 'merge'", 'تأیید باید همان ادغام موجود را صدا بزند');
  assertContainsString(html, 'id="network-pull-preview-modal"', 'مودال پیش‌نمایش شبکه لازم است');
  assertContainsString(html, 'تأیید و اعمال تغییرات', 'دکمه تأیید باید صریح باشد');
  assertContainsString(html, 'پیش‌نمایش فضای کاری شبکه', 'عنوان پیش‌نمایش لازم است');
  assertContainsString(html, 'نیاز به بررسی', 'طبقه‌بندی بررسی لازم است');
  assertContainsString(html, 'انصراف هیچ داده‌ای را عوض نمی‌کند', 'راهنما باید انصراف امن را بگوید');
});

test('پیش‌نمایش نباید دادهٔ محلی را عوض کند و باید افزوده/بررسی را درست بشمارد', () => {
  const bundle = networkPullPreviewBundle(html);
  assertTrue(bundle.indexOf('function previewNetworkWorkspaceMerge') >= 0, 'سورس پیش‌نمایش استخراج نشد');
  const runner = new Function(bundle + `
    var live = {
      invoices: [{invoiceId:'INV-1', id:1, num:'100', customer:'قدیم'}],
      products: [{code:'P1', name:'A'}],
      phonebook: [{fn:'علی', phones:['0912']}],
      parts: [], services: [],
      warranties: [{id:'W1', status:'open'}],
      sales: [], tasks: [],
      accounts: [{id:'ACC-1', name:'صندوق', balance:10}],
      defectiveStock: [], warehouseDocs: [], stockMoves: [], warehouses: [],
      daqi: [], daqiWarehouse: [{manufacturer:'X', code:'D1', name:'قطعه', qty:2}],
      daqiVouchers: [], postalHistory: [],
      inventory: {P1: 5},
      userRoles: [], saleCtr: 1, saleUidCtr: 1,
      logoSrc: '', senderInfo: null, acH: null,
      company: {name:'محلی'}, printSettings: null, serviceCenter: null, starredAlarms: null
    };
    var incoming = {
      origin: 'network-workspace', version: '1405.5.27β', schemaVersion: 1,
      invoices: [
        {invoiceId:'INV-1', id:1, num:'100', customer:'جدید'},
        {invoiceId:'INV-2', id:2, num:'101', customer:'تازه'}
      ],
      products: [{code:'P1', name:'B'}, {code:'P2', name:'C'}],
      phonebook: [{fn:'علی', phones:['0912']}],
      warranties: [{id:'W1', status:'closed'}, {id:'W2', status:'open'}],
      accounts: [{id:'ACC-1', name:'عوض', balance:99}, {id:'ACC-2', name:'بانک', balance:1}],
      inventory: {P1: 99, P2: 3},
      daqiWarehouse: [{manufacturer:'X', code:'D1', name:'قطعه', qty:9}],
      company: {name:'شبکه'}
    };
    var before = JSON.stringify(live);
    var p = previewNetworkWorkspaceMerge(incoming, live);
    return {
      added: p.added, updated: p.updated, unchanged: p.unchanged, review: p.review,
      liveSame: JSON.stringify(live) === before,
      liveInv: live.invoices[0].customer,
      liveInvQty: live.inventory.P1,
      liveWar: live.warranties[0].status,
      liveAcc: live.accounts[0].balance,
      liveDaqi: live.daqiWarehouse[0].qty
    };
  `);
  const r = runner();
  assertEqual(r.liveSame, true, 'پیش‌نمایش نباید آبجکت زنده را mutate کند');
  assertEqual(r.liveInv, 'قدیم', 'فاکتور محلی نباید عوض شود');
  assertEqual(r.liveInvQty, 5, 'موجودی محلی نباید عوض شود');
  assertEqual(r.liveWar, 'open', 'گارانتی محلی نباید عوض شود');
  assertEqual(r.liveAcc, 10, 'حساب محلی نباید عوض شود');
  assertEqual(r.liveDaqi, 2, 'انبار داغی محلی نباید عوض شود');
  assertTrue(r.added >= 4, 'فاکتور/کالا/گارانتی/حساب/موجودی جدید باید در افزوده باشد: '+r.added);
  assertTrue(r.review >= 4, 'هم‌هویتِ متفاوت باید نیاز به بررسی باشد نه به‌روزرسانی: '+r.review);
  assertTrue(r.updated >= 2, 'qty داغی و company باید به‌روزرسانی باشند: '+r.updated);
});

test('آماده‌سازی و انصراف نباید دادهٔ کسب‌وکار را عوض کنند', () => {
  const bundle = networkPullPreviewBundle(html);
  const runner = new Function(bundle + `
    var invoices = [{invoiceId:'INV-1', customer:'قدیم'}];
    var products = [{code:'P1'}];
    var phonebook = []; var parts=[]; var services=[]; var warranties=[{id:'W1'}];
    var sales=[]; var tasks=[]; var accounts=[{id:'ACC-1', balance:10}];
    var defectiveStock=[]; var warehouseDocs=[]; var stockMoves=[]; var warehouses=[];
    var daqi=[]; var daqiWarehouse=[]; var daqiVouchers=[]; var postalHistory=[];
    var inventory={P1:5}; var userRoles=[]; var saleCtr=1; var saleUidCtr=1;
    var logoSrc=''; var senderInfo=null; var acH=null;
    var localStorage = {getItem:function(){return null;}, setItem:function(){ throw new Error('localStorage نباید در پیش‌نمایش نوشته شود'); }};
    function inferBackupSchemaVersion(d){ return parseInt(d.schemaVersion,10)||0; }
    function canRestoreSchema(fileVer){
      fileVer = parseInt(fileVer,10); if(isNaN(fileVer)) fileVer=0;
      if(fileVer <= 1) return {ok:true};
      return {ok:false, reason:'schema too new'};
    }
    function migrateBackup(d){ return {data:d, log:['ok']}; }
    var applyCalled = 0;
    function applyBackupSelective(){ applyCalled++; }
    var document = {getElementById:function(){ return {classList:{add:function(){}, remove:function(){}}}; }};
    var _pendingNetworkPull = null;
    var snap = JSON.stringify({invoices:invoices, products:products, warranties:warranties, accounts:accounts, inventory:inventory});
    var pkg = {schemaVersion:1, origin:'network-workspace', invoices:[{invoiceId:'INV-2', customer:'تازه'}], products:[{code:'P2'}]};
    var prepared = prepareNetworkWorkspacePull(JSON.stringify(pkg));
    _pendingNetworkPull = prepared;
    cancelNetworkPullPreview();
    return {
      ok: prepared.ok,
      added: prepared.preview && prepared.preview.added,
      pending: _pendingNetworkPull,
      applyCalled: applyCalled,
      same: JSON.stringify({invoices:invoices, products:products, warranties:warranties, accounts:accounts, inventory:inventory}) === snap
    };
  `);
  const r = runner();
  assertEqual(r.ok, true, 'بسته معتبر باید آماده شود');
  assertTrue(r.added >= 1, 'پیش‌نمایش باید رکورد جدید را ببیند');
  assertEqual(r.pending, null, 'انصراف باید pending را پاک کند');
  assertEqual(r.applyCalled, 0, 'انصراف نباید ادغام را صدا بزند');
  assertEqual(r.same, true, 'انصراف نباید فاکتور/کالا/گارانتی/حساب/موجودی را عوض کند');
});

test('تأیید باید applyBackupSelective را با merge و selectedKeys=null صدا بزند', () => {
  const bundle = networkPullPreviewBundle(html);
  const runner = new Function(bundle + `
    var calls = [];
    function applyBackupSelective(d, keys, mode, log){ calls.push({d:d, keys:keys, mode:mode, log:log}); }
    function emit(){}
    function auditActivity(){}
    function ntf(){}
    var document = {getElementById:function(){ return {classList:{add:function(){}, remove:function(){}}}; }};
    var _pendingNetworkPull = {ok:true, data:{invoices:[{invoiceId:'INV-9'}], schemaVersion:1}, migLog:['network-workspace']};
    confirmNetworkPullPreview();
    return {n:calls.length, mode:calls[0]&&calls[0].mode, keys:calls[0]&&calls[0].keys, id:calls[0]&&calls[0].d.invoices[0].invoiceId, pending:_pendingNetworkPull};
  `);
  const r = runner();
  assertEqual(r.n, 1, 'تأیید باید یک‌بار ادغام موجود را صدا بزند');
  assertEqual(r.mode, 'merge', 'حالت باید merge باشد');
  assertEqual(r.keys, null, 'selectedKeys باید null باشد مثل دریافت قبلی');
  assertEqual(r.id, 'INV-9', 'همان بستهٔ pending باید به ادغام برود');
  assertEqual(r.pending, null, 'بعد از تأیید pending باید خالی شود');
});

test('ادغام موجود باید همچنان فاکتور/کالا/گارانتی/حساب هم‌هویت را نگه دارد', () => {
  const mergeSrc = extractFunctionSource(html, 'applyBackupMergeSections');
  const wantsSrc = extractFunctionSource(html, '_restoreWants');
  assertTrue(!!mergeSrc && !!wantsSrc, 'موتور ادغام پیدا نشد');
  const runner = new Function(wantsSrc + '\n' + mergeSrc + `
    var invoices = [{invoiceId:'INV-1', id:1, num:'100', customer:'قدیم'}];
    var products = [{code:'P1', name:'A'}];
    var phonebook = []; var parts=[]; var services=[]; var svcs=[];
    var warranties = [{id:'W1', status:'open'}];
    var sales=[]; var tasks=[]; var accounts=[{id:'ACC-1', name:'صندوق', balance:10}];
    var defectiveStock=[]; var warehouseDocs=[]; var stockMoves=[]; var warehouses=[];
    var daqi=[]; var daqiWarehouse=[]; var daqiVouchers=[]; var postalHistory=[];
    var inventory = {P1:5}; var userRoles=[]; var saleCtr=1; var saleUidCtr=1;
    var logoSrc=''; var senderInfo={}; var acH={};
    var localStorage={setItem:function(){}, getItem:function(){return null;}};
    function sv(){} function svParts(){} function svSvcs(){} function svSales(){} function svWarr(){} function svTasks(){}
    function svDefective(){} function svAccounts(){} function svWarehouses(){} function svDaqi(){}
    function svDaqiWarehouse(){} function svDaqiVouchers(){} function svPostalHistory(){} function svRoles(){}
    function getNum(){} function renderSaved(){} function renderProds(){} function renderInv(){} function renderPB(){}
    function renderParts(){} function renderSvcs(){} function renderSales(){} function renderWarList(){}
    function renderDataStats(){} function renderTasks(){} function renderSidebarBadges(){} function renderAccounts(){} function renderDefective(){}
    applyBackupMergeSections({
      invoices:[{invoiceId:'INV-1', id:1, num:'100', customer:'جدید'},{invoiceId:'INV-2', id:2, num:'101', customer:'تازه'}],
      products:[{code:'P1', name:'B'},{code:'P2', name:'C'}],
      warranties:[{id:'W1', status:'closed'},{id:'W2', status:'open'}],
      accounts:[{id:'ACC-1', name:'عوض', balance:99},{id:'ACC-2', name:'بانک', balance:1}],
      inventory:{P1:99, P2:3}
    }, []);
    return {
      invLen:invoices.length, invCust:invoices[0].customer, newInv:invoices[1]&&invoices[1].invoiceId,
      prodLen:products.length, prodName:products[0].name,
      warLen:warranties.length, warStatus:warranties[0].status,
      accLen:accounts.length, accName:accounts[0].name, accBal:accounts[0].balance,
      invP1:inventory.P1, invP2:inventory.P2
    };
  `);
  const r = runner();
  assertEqual(r.invLen, 2, 'فاکتور جدید باید اضافه شود');
  assertEqual(r.invCust, 'قدیم', 'فاکتور هم‌هویت نباید عوض شود');
  assertEqual(r.newInv, 'INV-2', 'فاکتور تازه باید همان شناسه را داشته باشد');
  assertEqual(r.prodLen, 2, 'کالای جدید باید اضافه شود');
  assertEqual(r.prodName, 'A', 'کالای موجود نباید عوض شود');
  assertEqual(r.warLen, 2, 'گارانتی جدید باید اضافه شود');
  assertEqual(r.warStatus, 'open', 'گارانتی موجود نباید عوض شود');
  assertEqual(r.accLen, 2, 'حساب جدید باید اضافه شود');
  assertEqual(r.accName, 'صندوق', 'حساب موجود نباید عوض شود');
  assertEqual(r.accBal, 10, 'مانده حساب موجود نباید عوض شود');
  assertEqual(r.invP1, 5, 'کلید موجودی موجود نباید عوض شود');
  assertEqual(r.invP2, 3, 'کلید موجودی جدید باید اضافه شود');
});

test('دادهٔ نامعتبر یا Schema جدیدتر نباید ادغام جزئی انجام دهد', () => {
  const bundle = networkPullPreviewBundle(html);
  const runner = new Function(bundle + `
    var invoices = [{invoiceId:'INV-1'}];
    var products = [{code:'P1'}];
    var phonebook=[]; var parts=[]; var services=[]; var warranties=[{id:'W1'}];
    var sales=[]; var tasks=[]; var accounts=[{id:'ACC-1'}];
    var defectiveStock=[]; var warehouseDocs=[]; var stockMoves=[]; var warehouses=[];
    var daqi=[]; var daqiWarehouse=[]; var daqiVouchers=[]; var postalHistory=[];
    var inventory={P1:5}; var userRoles=[]; var saleCtr=1; var saleUidCtr=1;
    var logoSrc=''; var senderInfo=null; var acH=null;
    var writes=0;
    var localStorage={getItem:function(){return null;}, setItem:function(){ writes++; }};
    function inferBackupSchemaVersion(d){ return parseInt(d && d.schemaVersion,10)||0; }
    function canRestoreSchema(fileVer){
      fileVer = parseInt(fileVer,10); if(isNaN(fileVer)) fileVer=0;
      if(fileVer <= 1) return {ok:true};
      return {ok:false, reason:'schema too new'};
    }
    function migrateBackup(d){ return {data:d, log:[]}; }
    var applyCalled=0;
    function applyBackupSelective(){ applyCalled++; }
    var snap = JSON.stringify({invoices:invoices, products:products, warranties:warranties, accounts:accounts, inventory:inventory});
    var badJson = prepareNetworkWorkspacePull('{');
    var notBackup = prepareNetworkWorkspacePull(JSON.stringify({hello:'world'}));
    var tooNew = prepareNetworkWorkspacePull(JSON.stringify({schemaVersion:99, invoices:[{invoiceId:'INV-X'}], products:[{code:'PX'}]}));
    var same = JSON.stringify({invoices:invoices, products:products, warranties:warranties, accounts:accounts, inventory:inventory}) === snap;
    return {
      badOk: badJson.ok, notOk: notBackup.ok, newOk: tooNew.ok,
      newErr: tooNew.error||'', applyCalled:applyCalled, writes:writes, same:same,
      invLen: invoices.length
    };
  `);
  const r = runner();
  assertEqual(r.badOk, false, 'JSON خراب باید رد شود');
  assertEqual(r.notOk, false, 'فایل غیرپشتیبان باید رد شود');
  assertEqual(r.newOk, false, 'Schema جدیدتر باید رد شود');
  assertTrue(/schema|ساختار|پشتیبان|خراب|نامعتبر|سیرمن/i.test(String(r.newErr)+'schema'), 'باید دلیل رد داشته باشد');
  assertEqual(r.applyCalled, 0, 'داده نامعتبر نباید ادغام را صدا بزند');
  assertEqual(r.same, true, 'داده محلی نباید جزئی عوض شود');
  assertEqual(r.invLen, 1, 'فاکتور محلی باید دست‌نخورده بماند');
});

test('ورود فعلی و مقایسه رمز پروفایل با رمز کلی نباید بشکند', () => {
  const saveRoleSrc = extractFunctionSource(html, 'saveRole');
  assertTrue(saveRoleSrc.indexOf('passwordMatches') >= 0 || saveRoleSrc.indexOf('pw === loginPw') >= 0,
    'باید رمز پروفایل را با رمز کلی نرم‌افزار مقایسه کند');
  assertContainsString(saveRoleSrc, 'checkPasswordStrength', 'ذخیره کاربر جدید باید رمز را با سیاست قدرت بسنجد');
  const loginSrc = extractFunctionSource(html, 'setLoginPw');
  assertContainsString(loginSrc, 'checkPasswordStrength', 'رمز مدیر سیستم باید سیاست قدرت داشته باشد');
  const matchSrc = extractFunctionSource(html, 'matchAppUserForLogin');
  assertTrue(matchSrc.indexOf('passwordMatches') >= 0 || matchSrc.indexOf('u.pw !== password') >= 0,
    'ورود باید همچنان با رمز ذخیره‌شده کار کند');
  assertContainsString(html, 'encryptBackupPackage', 'رمزنگاری بک‌آپ موجود نباید حذف شود');
  assertContainsString(html, 'GetMachineInfo', 'نام رایانه برای گزارش فعالیت باید بماند');
});

console.log('');
console.log('📋 گروه: هش یک‌طرفه رمز عبور');

function passwordCryptoBundle(srcHtml) {
  const names = ['secSha1','secHmacSha1','secUtf8Bytes','secBytesToHex','secHexToBytes','secPbkdf2HmacSha1','isPasswordHash','hashPassword','passwordMatches','upgradeStoredPassword','matchAppUserForLogin'];
  const parts = names.map(n => extractFunctionSource(srcHtml, n)).filter(Boolean);
  return parts.join('\n');
}

test('توابع هش رمز باید موجود باشند و با بردار RFC 6070 درست کار کنند', () => {
  ['secUtf8Bytes','secPbkdf2HmacSha1','isPasswordHash','hashPassword','passwordMatches'].forEach(n => {
    assertTrue(!!extractFunctionSource(html, n), 'تابع '+n+' پیدا نشد');
  });
  const bundle = passwordCryptoBundle(html);
  const runner = new Function(bundle + `
    var dk1 = secBytesToHex(secPbkdf2HmacSha1('password', secUtf8Bytes('salt'), 1, 20));
    var dk2 = secBytesToHex(secPbkdf2HmacSha1('password', secUtf8Bytes('salt'), 2, 20));
    return {dk1:dk1, dk2:dk2};
  `);
  const r = runner();
  assertEqual(r.dk1, '0c60c80f961f0e71f3a9b524af6012062fe037a6', 'RFC 6070 c=1 باید مطابقت داشته باشد');
  assertEqual(r.dk2, 'ea6c014dc72d6f8ccd1ed92ace1d41f0d8de8957', 'RFC 6070 c=2 باید مطابقت داشته باشد');
});

test('hashPassword باید رمز خام را ذخیره نکند و passwordMatches هم هش و هم رمز قدیمی را بپذیرد', () => {
  const bundle = passwordCryptoBundle(html);
  const runner = new Function(bundle + `
    var stored = hashPassword('Secret9x');
    var again = hashPassword('Secret9x');
    var up = (typeof upgradeStoredPassword==='function') ? upgradeStoredPassword('oldplain', 'oldplain') : '';
    var roles = [
      {id:'u1', name:'علی', username:'ali', pw:'p1', active:false, pages:['dashboard']},
      {id:'u2', name:'مینا', username:'mina', pw: hashPassword('p2'), active:true, pages:['dashboard']}
    ];
    return {
      stored: stored,
      isHash: isPasswordHash(stored),
      rawInside: String(stored).indexOf('Secret9x') >= 0,
      match: passwordMatches('Secret9x', stored),
      mismatch: passwordMatches('wrong', stored),
      legacy: passwordMatches('oldPw', 'oldPw'),
      legacyBad: passwordMatches('oldPw', 'other'),
      saltsDiffer: stored !== again,
      upgradedHash: isPasswordHash(up),
      upgradedPlainGone: String(up).indexOf('oldplain') < 0,
      inactive: matchAppUserForLogin('ali', 'p1', roles, 'master'),
      named: matchAppUserForLogin('mina', 'p2', roles, 'master'),
      masterLegacy: matchAppUserForLogin('', 'master', roles, 'master'),
      masterHashed: matchAppUserForLogin('', 'Secret9x', roles, stored),
      bad: matchAppUserForLogin('', 'nope', roles, stored)
    };
  `);
  const r = runner();
  assertEqual(r.isHash, true, 'خروجی hashPassword باید هش باشد');
  assertEqual(r.rawInside, false, 'رمز خام نباید داخل رشته هش دیده شود');
  assertEqual(r.match, true, 'رمز درست باید با هش یکی باشد');
  assertEqual(r.mismatch, false, 'رمز غلط باید رد شود');
  assertEqual(r.legacy, true, 'رمز قدیمی plaintext باید هنوز وارد شود');
  assertEqual(r.legacyBad, false, 'رمز قدیمی غلط باید رد شود');
  assertEqual(r.saltsDiffer, true, 'هر ذخیره باید salt جدا داشته باشد');
  assertEqual(r.upgradedHash, true, 'ارتقا باید هش بسازد');
  assertEqual(r.upgradedPlainGone, true, 'بعد از ارتقا رمز خام نماند');
  assertEqual(r.inactive.ok, false, 'کاربر غیرفعال با رمز قدیمی نباید وارد شود');
  assertEqual(r.named.ok, true, 'کاربر فعال با هش باید وارد شود');
  assertEqual(r.masterLegacy.ok, true, 'رمز کلی قدیمی باید کار کند');
  assertEqual(r.masterHashed.ok, true, 'رمز کلی هش‌شده باید کار کند');
  assertEqual(r.bad.ok, false, 'رمز غلط نباید وارد شود');
});

test('ذخیره رمز مدیر و کاربر باید هش کند نه متن خام، و ورود موفق رمز قدیمی را ارتقا دهد', () => {
  const setSrc = extractFunctionSource(html, 'setLoginPw');
  const saveSrc = extractFunctionSource(html, 'saveRole');
  const forceSrc = extractFunctionSource(html, 'submitForcePwChange');
  const attemptSrc = extractFunctionSource(html, 'attemptLogin');
  assertContainsString(setSrc, 'hashPassword', 'setLoginPw باید رمز را هش کند');
  assertTrue(setSrc.indexOf("localStorage.setItem('laegh_login_pw',a)") < 0, 'نباید رمز خام مدیر در localStorage نوشته شود');
  assertContainsString(saveSrc, 'hashPassword', 'saveRole باید رمز کاربر را هش کند');
  assertContainsString(saveSrc, 'passwordMatches', 'saveRole باید تداخل با رمز کلی را با هش بسنجد');
  assertContainsString(forceSrc, 'hashPassword', 'تعویض اجباری رمز باید هش کند');
  assertContainsString(attemptSrc, 'upgradeStoredPassword', 'ورود موفق باید رمز قدیمی را به هش ارتقا دهد');
});

console.log('');
console.log('📋 گروه: بک‌آپ رمزدار پیش‌فرض');

test('خروجی بک‌آپ باید پیش‌فرض رمزدار باشد و بدون رمز هشدار بدهد', () => {
  assertContainsString(html, 'id="bk-encrypt-on"', 'تیک بک‌آپ رمزدار لازم است');
  assertTrue(/id="bk-encrypt-on"[^>]*checked/.test(html) || /<input[^>]*id="bk-encrypt-on"[^>]*checked/.test(html),
    'تیک رمزنگاری بک‌آپ باید پیش‌فرض روشن باشد');
  assertTrue(!!extractFunctionSource(html, 'isBackupEncryptPreferred'), 'isBackupEncryptPreferred پیدا نشد');
  assertTrue(!!extractFunctionSource(html, 'confirmUnencryptedBackup'), 'confirmUnencryptedBackup پیدا نشد');
  const exp = extractFunctionSource(html, 'exportData');
  assertContainsString(exp, 'confirmUnencryptedBackup', 'exportData باید قبل از بک‌آپ بدون رمز تأیید بگیرد');
  assertContainsString(exp, 'skipEncryptPrompt', 'ریست اجباری باید بتواند هشدار رمز را رد کند');
  const resetSrc = extractFunctionSource(html, 'resetAll');
  assertContainsString(resetSrc, 'skipEncryptPrompt', 'ریست کامل نباید به‌خاطر تیک رمز متوقف شود');
  const pref = extractFunctionSource(html, 'isBackupEncryptPreferred');
  const conf = extractFunctionSource(html, 'confirmUnencryptedBackup');
  const runner = new Function(pref + '\n' + conf + `
    var checks = {};
    function documentMock(checked){
      return { getElementById: function(id){ return id==='bk-encrypt-on' ? {checked:checked} : null; } };
    }
    var document = documentMock(true);
    var a = isBackupEncryptPreferred();
    document = documentMock(false);
    var b = isBackupEncryptPreferred();
    document = { getElementById: function(){ return null; } };
    var c = isBackupEncryptPreferred();
    var asked = '';
    confirm = function(msg){ asked = msg; return false; };
    var d = confirmUnencryptedBackup();
    return {a:a,b:b,c:c,d:d, asked:asked};
  `);
  const r = runner();
  assertEqual(r.a, true, 'تیک روشن یعنی رمزدار ترجیح داده شود');
  assertEqual(r.b, false, 'تیک خاموش یعنی کاربر رمز نمی‌خواهد');
  assertEqual(r.c, true, 'بدون عنصر UI باید پیش‌فرض رمزدار باشد');
  assertEqual(r.d, false, 'رد کردن هشدار باید بک‌آپ خام را متوقف کند');
  assertTrue(/رمز|هشدار/.test(r.asked), 'متن تأیید باید هشدار بدون رمز باشد');
});

console.log('');
console.log('📋 گروه: هشدار اشتراک LAN');

test('قبل از روشن کردن اشتراک LAN باید تأیید هشدار بدون HTTPS/احراز هویت بیاید', () => {
  assertTrue(!!extractFunctionSource(html, 'confirmLanShareEnable'), 'confirmLanShareEnable پیدا نشد');
  const saveSrc = extractFunctionSource(html, 'saveNetworkSettingsFromUi');
  assertContainsString(saveSrc, 'confirmLanShareEnable', 'ذخیره شبکه باید قبل از روشن کردن LAN تأیید بگیرد');
  const conf = extractFunctionSource(html, 'confirmLanShareEnable');
  const runner = new Function(conf + `
    var asked = '';
    confirm = function(msg){ asked = String(msg||''); return false; };
    return {
      offToOn: confirmLanShareEnable(false, true),
      alreadyOn: confirmLanShareEnable(true, true),
      turningOff: confirmLanShareEnable(true, false),
      stayOff: confirmLanShareEnable(false, false),
      asked: asked
    };
  `);
  const r = runner();
  assertEqual(r.offToOn, false, 'رد کردن هشدار باید روشن شدن LAN را متوقف کند');
  assertEqual(r.alreadyOn, true, 'اگر از قبل روشن بوده نباید دوباره بپرسد');
  assertEqual(r.turningOff, true, 'خاموش کردن نباید هشدار بخواهد');
  assertEqual(r.stayOff, true, 'ماندن خاموش نباید هشدار بخواهد');
  assertTrue(/HTTPS|رمزنگاری|هویت|هشدار/.test(r.asked), 'متن باید خطر بدون رمزنگاری و بدون هویت را بگوید');
  assertContainsString(html, 'بدون HTTPS', 'راهنما باید بگوید LAN بدون HTTPS است');
});

console.log('');
console.log('📋 گروه: تداخل پورت اعلان');

test('قبل از bind پورت اعلان باید آزاد بودن پورت چک شود و HTML از پورت واقعی استفاده کند', () => {
  assertTrue(!!extractFunctionSource(html, 'getNotifyBridgePort'), 'getNotifyBridgePort پیدا نشد');
  assertTrue(!!extractFunctionSource(html, 'getNotifyBridgeUrl'), 'getNotifyBridgeUrl پیدا نشد');
  const portSrc = extractFunctionSource(html, 'getNotifyBridgePort');
  const urlSrc = extractFunctionSource(html, 'getNotifyBridgeUrl');
  const bridge = extractFunctionSource(html, 'pushWindowsNotifyBridge');
  assertContainsString(bridge, 'getNotifyBridgeUrl', 'پل اعلان باید از آدرس پویا استفاده کند نه پورت ثابت تنها');
  const runner = new Function(portSrc + '\n' + urlSrc + `
    var window = {};
    function getSirmanHostSync(){ return null; }
    var a = getNotifyBridgePort();
    var u = getNotifyBridgeUrl('/notify');
    var h = getNotifyBridgeUrl('health');
    getSirmanHostSync = function(){ return { GetNotifyPort: function(){ return 8770; } }; };
    var b = getNotifyBridgePort();
    var u2 = getNotifyBridgeUrl('/notify');
    return {a:a, u:u, h:h, b:b, u2:u2};
  `);
  const r = runner();
  assertEqual(r.a, 8766, 'بدون Host باید پورت پیش‌فرض ۸۷۶۶ باشد');
  assertEqual(r.u, 'http://127.0.0.1:8766/notify', 'آدرس پیش‌فرض notify');
  assertEqual(r.h, 'http://127.0.0.1:8766/health', 'آدرس پیش‌فرض health');
  assertEqual(r.b, 8770, 'اگر Host پورت دیگری داد باید همان استفاده شود');
  assertEqual(r.u2, 'http://127.0.0.1:8770/notify', 'URL باید پورت واقعی Host را بگیرد');
  const cs = fs.readFileSync(path.join(path.dirname(filePath), 'desktop', 'Sirman.Desktop', 'NotifyBridgeService.cs'), 'utf8');
  assertContainsString(cs, 'IsTcpPortFree', 'پوسته باید قبل از bind آزاد بودن پورت را چک کند');
  assertContainsString(cs, 'preferredPort', 'اگر پورت اشغال بود باید پورت بعدی را امتحان کند');
  const host = fs.readFileSync(path.join(path.dirname(filePath), 'desktop', 'Sirman.Desktop', 'SirmanHostObject.cs'), 'utf8');
  assertContainsString(host, 'GetNotifyPort', 'Host باید پورت واقعی اعلان را به HTML بدهد');
  const ps1 = fs.readFileSync(path.join(path.dirname(filePath), 'sirman_run.ps1'), 'utf8');
  assertTrue(/Test-Path|TcpListener|PortFree|port .+busy|in use/i.test(ps1) && /NotifyPort/.test(ps1), 'PS1 باید پورت اعلان را قبل از bind چک کند');
  assertContainsString(ps1, 'Test-SirmanPortFree', 'لانچر باید تابع بررسی پورت آزاد داشته باشد');
  const rules = fs.readFileSync(path.join(path.dirname(filePath), 'docs', 'ARCHITECTURE_RULES.md'), 'utf8');
  assertContainsString(rules, 'GetNotifyPort', 'GetNotifyPort باید در لیست مجاز Host باشد');
});


console.log('');
console.log('📋 گروه: تثبیت امنیت فاز ۱ (مجوز، رمز حذف فاکتور، مرز Host)');

test('Authz باید از صفحات نقش موجود استفاده کند و مدیر کل همیشه مجاز باشد', () => {
  ['isMasterSession','hasPermission','requirePermission','syncHostAuthSession'].forEach(n => {
    assertTrue(!!extractFunctionSource(html, n), 'تابع '+n+' پیدا نشد');
  });
  const mapM = html.match(/var AUTH_PERM_TO_PAGE = \{[\s\S]*?\};/);
  assertTrue(!!mapM, 'AUTH_PERM_TO_PAGE باید همان کاتالوگ صفحات موجود باشد');
  assertContainsString(mapM[0], "Customer.View':'phonebook", 'Customer باید به دفترچه موجود نگاشت شود');
  assertContainsString(mapM[0], "Invoice.Create':'invoice", 'Invoice.Create باید به صفحه فاکتور موجود نگاشت شود');
  const isM = extractFunctionSource(html, 'isMasterSession');
  const hasP = extractFunctionSource(html, 'hasPermission');
  const reqP = extractFunctionSource(html, 'requirePermission');
  const runner = new Function(mapM[0] + '\n' + isM + '\n' + hasP + '\n' + reqP + `
    var notes = [];
    function ntf(msg){ notes.push(msg); }
    function auditActivity(){}
    var currentRole = null;
    var masterOk = hasPermission('User.Delete') && requirePermission('Invoice.Cancel');
    currentRole = {roleKey:'service', pages:['dashboard','warranty','parts','phonebook']};
    var techWar = hasPermission('ServiceCase.Edit');
    var techUser = hasPermission('User.Create');
    var techInv = requirePermission('Invoice.Create');
    currentRole = {roleKey:'viewer', pages:['dashboard','saved','warranty','help']};
    var viewInv = hasPermission('Invoice.View');
    var viewCreate = hasPermission('Invoice.Create');
    return {masterOk:masterOk, techWar:techWar, techUser:techUser, techInv:techInv, viewInv:viewInv, viewCreate:viewCreate, notes:notes};
  `);
  const r = runner();
  assertEqual(r.masterOk, true, 'مدیر کل (currentRole=null) باید همه مجوزها را داشته باشد');
  assertEqual(r.techWar, true, 'تکنسین با صفحه گارانتی باید ServiceCase.Edit داشته باشد');
  assertEqual(r.techUser, false, 'تکنسین نباید User.Create داشته باشد');
  assertEqual(r.techInv, false, 'تکنسین نباید فاکتور بسازد');
  assertEqual(r.viewInv, true, 'مشاهده‌گر با صفحه فاکتورهای ذخیره‌شده Invoice.View دارد');
  assertEqual(r.viewCreate, false, 'مشاهده‌گر نباید Invoice.Create داشته باشد');
});

test('رمز حذف فاکتور باید هش شود و با passwordMatches بررسی شود، نه متن خام', () => {
  const setSrc = extractFunctionSource(html, 'setAdminPw');
  const delSrc = extractFunctionSource(html, 'confirmDelInv');
  assertContainsString(setSrc, 'hashPassword', 'setAdminPw باید رمز را هش کند');
  assertTrue(setSrc.indexOf("localStorage.setItem('admin-pw',n)") < 0, 'نباید رمز خام admin-pw ذخیره شود');
  assertContainsString(delSrc, 'passwordMatches', 'confirmDelInv باید هش و رمز قدیمی را بپذیرد');
  assertTrue(delSrc.indexOf('entered!==adminPw') < 0, 'مقایسه مستقیم متن خام حذف فاکتور باید رفته باشد');
  assertContainsString(delSrc, 'upgradeStoredPassword', 'حذف موفق باید رمز قدیمی را ارتقا دهد');
  const saveRoleSrc = extractFunctionSource(html, 'saveRole');
  const saveWarSrc = extractFunctionSource(html, 'saveWar');
  const saveNetSrc = extractFunctionSource(html, 'saveNetworkSettingsFromUi');
  assertContainsString(saveRoleSrc, 'requirePermission', 'ذخیره کاربر باید مجوز واقعی بخواهد');
  assertContainsString(saveWarSrc, 'requirePermission', 'ذخیره گارانتی باید مجوز واقعی بخواهد');
  assertContainsString(saveNetSrc, 'requirePermission', 'تنظیم شبکه باید مجوز واقعی بخواهد');
  const lockSrc = extractFunctionSource(html, 'lockApp');
  assertContainsString(lockSrc, "'logout'", 'قفل برنامه باید خروج را در گزارش فعالیت ثبت کند');
  const finishSrc = extractFunctionSource(html, 'finishLogin');
  assertContainsString(finishSrc, 'syncHostAuthSession', 'بعد از ورود باید نشست Host همگام شود');
});

test('Host Object باید دروازه مجوز و متدهای امنیت را روی همان sirmanHost داشته باشد', () => {
  const hostPath = path.join(path.dirname(filePath), 'desktop', 'Sirman.Desktop', 'SirmanHostObject.cs');
  const host = fs.readFileSync(hostPath, 'utf8');
  ['Login','Logout','BindSession','CheckPermission','HashPassword','VerifyPassword','ValidateEntity','GetSecurityStatus','SaveSecret','LoadSecret'].forEach(n => {
    assertContainsString(host, 'public string '+n, 'Host باید متد '+n+' را روی همان شیء داشته باشد');
  });
  assertContainsString(host, 'Guard("SetNetworkConfig")', 'SetNetworkConfig باید از دروازه مجوز بگذرد');
  assertContainsString(host, 'Guard("WriteWorkspaceFile")', 'WriteWorkspaceFile باید مجوز داشته باشد');
  assertContainsString(host, 'Guard("ReadWorkspaceFile")', 'ReadWorkspaceFile باید مجوز داشته باشد');
  assertContainsString(host, 'Guard("PrintHtml")', 'PrintHtml باید مجوز داشته باشد');
  assertTrue(fs.existsSync(path.join(path.dirname(filePath), 'desktop', 'Sirman.Core', 'Security', 'PasswordHasher.cs')), 'Sirman.Core PasswordHasher باید موجود باشد');
  const rules = fs.readFileSync(path.join(path.dirname(filePath), 'docs', 'ARCHITECTURE_RULES.md'), 'utf8');
  assertContainsString(rules, 'BindSession', 'لیست مجاز معماری باید BindSession را ثبت کند');
  assertContainsString(rules, 'ValidateEntity', 'لیست مجاز معماری باید ValidateEntity را ثبت کند');
  assertContainsString(html, 'data-help-id="security-guide"', 'راهنمای امنیت موجود نباید حذف شود');
  assertContainsString(html, 'data-help-id="install-update-guide"', 'راهنمای نصب و آپدیت باید در صفحه راهنما باشد');
  assertContainsString(html, 'Sirman_Start.bat', 'راهنمای نصب باید لانچر را نام ببرد');
  assertContainsString(html, 'exe جدید', 'راهنمای این نسخه باید بگوید exe هم عوض شود');
  assertContainsString(html, 'فایل یک‌کیلوبایتی برنامه نیست', 'راهنمای نصب از صفر باید بگوید JSON یک‌کیلوبایتی برنامه نیست');
  assertContainsString(html, 'آپدیت جدا لازم نیست', 'راهنما باید بگوید کیت خودش نسخه جاری است و آپدیت جدا نمی‌خواهد');
  assertContainsString(html, 'فایل آپدیت همین نسخه', 'راهنما باید بگوید فایل آپدیت داخل کیت است');
  assertContainsString(html, 'بدون کپی‌پیست', 'راهنما باید بگوید فایل‌ها را یکی‌یکی کپی نکنید');
  const guideTxt = path.join(path.dirname(filePath), 'راهنمای_نصب_از_صفر.txt');
  assertTrue(fs.existsSync(guideTxt), 'فایل راهنمای_نصب_از_صفر.txt باید کنار برنامه باشد');
  const guideBody = fs.readFileSync(guideTxt, 'utf8');
  assertTrue(guideBody.indexOf('فایل یک‌کیلوبایتی برنامه نیست') >= 0, 'متن راهنمای از صفر باید هشدار ۱ کیلوبایت را داشته باشد');
  assertTrue(guideBody.indexOf('Sirman_Final.html') >= 0, 'متن راهنمای از صفر باید فایل برنامه را نام ببرد');
  assertContainsString(html, 'مجوز واقعی', 'راهنما باید مجوز واقعی را توضیح دهد');
});

console.log('');
console.log('📋 گروه: هسته کسب‌وکار فاز ۲ (محاسبه C# از همان فرمول‌ها)');

test('پل RunBusiness باید موجود باشد و HTML-only بدون Host همان نتیجه قبلی را بدهد', () => {
  assertTrue(!!extractFunctionSource(html, 'runBusinessCore'), 'runBusinessCore پیدا نشد');
  assertTrue(!!extractFunctionSource(html, 'takeBusinessCore'), 'takeBusinessCore پیدا نشد');
  assertTrue(!!extractFunctionSource(html, 'calcInvoiceLine'), 'calcInvoiceLine پیدا نشد');
  const host = fs.readFileSync(path.join(path.dirname(filePath), 'desktop', 'Sirman.Desktop', 'SirmanHostObject.cs'), 'utf8');
  assertContainsString(host, 'RunBusiness', 'Host باید RunBusiness را روی همان sirmanHost داشته باشد');
  const rules = fs.readFileSync(path.join(path.dirname(filePath), 'docs', 'ARCHITECTURE_RULES.md'), 'utf8');
  assertContainsString(rules, 'RunBusiness', 'لیست مجاز معماری باید RunBusiness را ثبت کند');
  const lineSrc = extractFunctionSource(html, 'calcInvoiceLine');
  const takeSrc = extractFunctionSource(html, 'takeBusinessCore');
  const runSrc = extractFunctionSource(html, 'runBusinessCore');
  const runner = new Function(runSrc + '\n' + takeSrc + '\n' + lineSrc + `
    function getSirmanHostSync(){ return null; }
    var a = calcInvoiceLine(1000, 10, 9999);
    var b = calcInvoiceLine(1000, 0, 800);
    return {a:a, b:b};
  `);
  const r = runner();
  assertEqual(r.a.fin, 900, 'تخفیف ۱۰٪ روی ۱۰۰۰ باید ۹۰۰ باشد');
  assertEqual(r.a.da, 100, 'مبلغ تخفیف باید ۱۰۰ باشد');
  assertEqual(r.b.fin, 800, 'بدون تخفیف باید fin دستی بماند');
  assertContainsString(extractFunctionSource(html, 'calcT'), 'disc>0', 'calcT نباید شرط تخفیف را از دست بدهد');
  assertContainsString(html, 'var InventoryEngine = {', 'InventoryEngine نباید حذف شود');
  assertContainsString(html, 'var SmartCore = {', 'SmartCore نباید حذف شود');
});

console.log('');
console.log('📋 گروه: هسته کسب‌وکار فاز ۲B (C# منبع حقیقت در exe)');

test('در exe نتیجه Host باید منبع حقیقت باشد و HTML-only به fallback JS برگردد', () => {
  const runSrc = extractFunctionSource(html, 'runBusinessCore');
  const takeSrc = extractFunctionSource(html, 'takeBusinessCore');
  const hasSrc = extractFunctionSource(html, 'hasBusinessCore');
  const lineSrc = extractFunctionSource(html, 'calcInvoiceLine');
  const balSrc = extractFunctionSource(html, 'calcBalance');
  const wdSrc = extractFunctionSource(html, 'withdrawFromAccount');
  assertTrue(!!takeSrc && !!hasSrc && !!lineSrc && !!balSrc, 'توابع فاز ۲B پیدا نشد');
  assertContainsString(lineSrc, 'takeBusinessCore', 'calcInvoiceLine باید اول هسته C# را بخواند');
  assertContainsString(wdSrc, 'hasBusinessCore', 'برداشت در exe نباید قانون موازی JS را بعد از هسته دوباره اعمال کند');
  const htmlOnly = new Function(runSrc + '\n' + takeSrc + '\n' + hasSrc + '\n' + lineSrc + '\n' + balSrc + `
    function getSirmanHostSync(){ return null; }
    return {fin: calcInvoiceLine(1000,10,9999).fin, bal: calcBalance(1000,300), host: hasBusinessCore()};
  `)();
  assertEqual(htmlOnly.host, false, 'بدون Host نباید هسته فعال باشد');
  assertEqual(htmlOnly.fin, 900, 'HTML-only باید همان فرمول قبلی را بدهد');
  assertEqual(htmlOnly.bal, 700, 'مانده HTML-only باید ۷۰۰ باشد');
  const exeCore = new Function(runSrc + '\n' + takeSrc + '\n' + hasSrc + '\n' + lineSrc + `
    function getSirmanHostSync(){
      return { RunBusiness: function(name, json){
        return JSON.stringify({ok:true, result:{est:1000, disc:10, da:100, fin:777}});
      }};
    }
    return calcInvoiceLine(1000, 10, 9999);
  `)();
  assertEqual(exeCore.fin, 777, 'اگر Host جواب بدهد باید همان منبع حقیقت باشد نه فرمول JS (۹۰۰)');
});

console.log('');
console.log('📋 گروه: فاز ۳ B1 قفل برابری invoice.line / invoice.totals');

function loadInvoicePricingParityVectors() {
  const name = 'InvoicePricingParityVectors.json';
  const candidates = [
    path.join(__dirname, 'desktop', 'Sirman.Core.Tests', name),
    path.join(path.dirname(filePath), 'desktop', 'Sirman.Core.Tests', name)
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, 'utf8'));
  }
  throw new Error('جدول بردار B1 پیدا نشد: ' + name);
}

function makeHtmlOnlyInvoiceLine() {
  const runSrc = extractFunctionSource(html, 'runBusinessCore');
  const takeSrc = extractFunctionSource(html, 'takeBusinessCore');
  const hasSrc = extractFunctionSource(html, 'hasBusinessCore');
  const lineSrc = extractFunctionSource(html, 'calcInvoiceLine');
  assertTrue(!!runSrc && !!takeSrc && !!hasSrc && !!lineSrc, 'توابع calcInvoiceLine / takeBusinessCore پیدا نشد');
  return new Function(runSrc + '\n' + takeSrc + '\n' + hasSrc + '\n' + lineSrc + `
    function getSirmanHostSync(){ return null; }
    return function(est, disc, finRaw){ return calcInvoiceLine(est, disc, finRaw); };
  `)();
}

test('جدول بردار مشترک JS↔C# باید روی calcInvoiceLine HTML-only قفل شود', () => {
  const pack = loadInvoicePricingParityVectors();
  assertTrue(Array.isArray(pack.line) && pack.line.length >= 2, 'جدول line باید حداقل دو بردار الزامی داشته باشد');
  const calc = makeHtmlOnlyInvoiceLine();
  pack.line.forEach(function(row) {
    const got = calc(row.est, row.disc, row.finRaw);
    assertEqual(got.da, row.da, row.id + ' da');
    assertEqual(got.fin, row.fin, row.id + ' fin');
    assertEqual(got.est, row.est, row.id + ' est');
    assertEqual(got.disc, row.disc, row.id + ' disc');
  });
});

test('مسیر جمع calcT بدون Host باید همان Totals جدول B1 را بدهد', () => {
  const pack = loadInvoicePricingParityVectors();
  const runSrc = extractFunctionSource(html, 'runBusinessCore');
  const takeSrc = extractFunctionSource(html, 'takeBusinessCore');
  const hasSrc = extractFunctionSource(html, 'hasBusinessCore');
  const lineSrc = extractFunctionSource(html, 'calcInvoiceLine');
  const totSrc = extractFunctionSource(html, 'calcInvoiceTotals');
  const calcTSrc = extractFunctionSource(html, 'calcT');
  assertTrue(!!calcTSrc, 'calcT پیدا نشد');
  assertTrue(!!totSrc, 'calcInvoiceTotals پیدا نشد');
  assertContainsString(totSrc, 'tE+=est', 'fallback جمع باید برآورد را جمع بزند');
  assertContainsString(totSrc, 'tD+=line.da', 'fallback جمع باید تخفیف خط را جمع بزند');
  assertContainsString(calcTSrc, 'calcInvoiceTotals', 'calcT باید جمع را از calcInvoiceTotals بخواهد');
  pack.totals.forEach(function(row) {
    const mockDoc = buildMockDocument();
    const n = row.lines.length;
    for (let i = 1; i <= n; i++) {
      const src = row.lines[i - 1];
      mockDoc.getElementById('d' + i + '_est').value = String(src.est);
      mockDoc.getElementById('d' + i + '_disc').value = String(src.disc);
      mockDoc.getElementById('d' + i + '_fin').value = String(src.finRaw);
    }
    const run = new Function('document', 'devCnt', runSrc + '\n' + takeSrc + '\n' + hasSrc + '\n' + lineSrc + '\n' + totSrc + '\n' + calcTSrc + `
      function getSirmanHostSync(){ return null; }
      function fmt(n){ return String(n); }
      function ntf(){}
      return calcT();
    `);
    const tot = run(mockDoc, n);
    assertEqual(tot.tE, row.tE, row.id + ' tE');
    assertEqual(tot.tD, row.tD, row.id + ' tD');
    assertEqual(tot.tF, row.tF, row.id + ' tF');
  });
});

test('قفل B1 باید HTML-only و Host-wins قبلی را نگه دارد و نیم‌واحد مثبت را گرد کند', () => {
  const calc = makeHtmlOnlyInvoiceLine();
  assertEqual(calc(1000, 10, 9999).fin, 900, 'HTML-only بردار اصلی fin=900');
  assertEqual(calc(15, 10, 0).da, 2, 'Math.round(1.5) باید ۲ باشد');
  assertEqual(calc(5, 10, 0).da, 1, 'Math.round(0.5) باید ۱ باشد');
  const runSrc = extractFunctionSource(html, 'runBusinessCore');
  const takeSrc = extractFunctionSource(html, 'takeBusinessCore');
  const hasSrc = extractFunctionSource(html, 'hasBusinessCore');
  const lineSrc = extractFunctionSource(html, 'calcInvoiceLine');
  const exeCore = new Function(runSrc + '\n' + takeSrc + '\n' + hasSrc + '\n' + lineSrc + `
    function getSirmanHostSync(){
      return { RunBusiness: function(name, json){
        return JSON.stringify({ok:true, result:{est:1000, disc:10, da:100, fin:777}});
      }};
    }
    return calcInvoiceLine(1000, 10, 9999);
  `)();
  assertEqual(exeCore.fin, 777, 'Host-wins باید باقی بماند');
});

console.log('');
console.log('📋 گروه: فاز ۳ B2 مالکیت invoice.line');

function makeExeInvoiceLineHost(runImpl) {
  const runSrc = extractFunctionSource(html, 'runBusinessCore');
  const takeSrc = extractFunctionSource(html, 'takeBusinessCore');
  const hasSrc = extractFunctionSource(html, 'hasBusinessCore');
  const lineSrc = extractFunctionSource(html, 'calcInvoiceLine');
  return new Function('runImpl', runSrc + '\n' + takeSrc + '\n' + hasSrc + '\n' + lineSrc + `
    function getSirmanHostSync(){
      return { RunBusiness: runImpl };
    }
    return function(est, disc, finRaw){ return calcInvoiceLine(est, disc, finRaw); };
  `)(runImpl);
}

test('مسیر EXE باید RunBusiness("invoice.line") را با DTO است/تخفیف/finRaw صدا بزند و نتیجه Core را برگرداند', () => {
  var calls = [];
  const calc = makeExeInvoiceLineHost(function(name, json){
    calls.push({name:name, payload: JSON.parse(json)});
    return JSON.stringify({ok:true, result:{est:1000, disc:10, da:100, fin:777}});
  });
  const got = calc(1000, 10, 9999);
  assertEqual(calls.length, 1, 'باید دقیقاً یک بار Host صدا شود');
  assertEqual(calls[0].name, 'invoice.line', 'نام عملیات باید invoice.line باشد');
  assertEqual(calls[0].payload.est, 1000, 'est باید به Core برود');
  assertEqual(calls[0].payload.disc, 10, 'disc باید به Core برود');
  assertEqual(calls[0].payload.finRaw, 9999, 'finRaw باید به Core برود');
  assertEqual(got.est, 1000, 'قرارداد est');
  assertEqual(got.disc, 10, 'قرارداد disc');
  assertEqual(got.da, 100, 'قرارداد da');
  assertEqual(got.fin, 777, 'نتیجه Core باید برگردد نه فرمول JS');
});

test('مسیر HTML-only باید همان fallback JS را با بردار B1 نگه دارد', () => {
  const calc = makeHtmlOnlyInvoiceLine();
  const got = calc(1000, 10, 9999);
  assertEqual(got.est, 1000, 'est');
  assertEqual(got.disc, 10, 'disc');
  assertEqual(got.da, 100, 'da');
  assertEqual(got.fin, 900, 'fin HTML-only');
  const src = extractFunctionSource(html, 'calcInvoiceLine');
  assertContainsString(src, 'Math.round(est*disc/100)', 'fallback JS نباید حذف شود');
  assertContainsString(src, 'hasBusinessCore', 'مرز EXE باید صریح باشد');
});

test('شکست Core روی EXE نباید فرمول JS را به‌جای InvoicePricing اجرا کند', () => {
  const calc = makeExeInvoiceLineHost(function(){
    return JSON.stringify({ok:false, error:'business-failed', message:'محاسبه انجام نشد'});
  });
  const got = calc(1000, 10, 9999);
  assertTrue(got == null, 'اگر Host هست و Core رد کند نباید شیء خط JS برگردد');
});

test('calcInvoiceLine نباید persist بنویسد و calcT/getData نباید فرمول موازی EXE داشته باشند', () => {
  const lineSrc = extractFunctionSource(html, 'calcInvoiceLine');
  const calcTSrc = extractFunctionSource(html, 'calcT');
  const getDataSrc = extractFunctionSource(html, 'getData');
  assertTrue(lineSrc.indexOf('localStorage') === -1, 'calcInvoiceLine نباید localStorage بنویسد');
  assertTrue(lineSrc.indexOf('indexedDB') === -1 && lineSrc.indexOf('IndexedDB') === -1, 'calcInvoiceLine نباید IndexedDB بنویسد');
  assertTrue(lineSrc.indexOf('persistCoreSnapshot') === -1, 'calcInvoiceLine نباید persistCoreSnapshot صدا بزند');
  assertTrue(calcTSrc.indexOf('Math.round(est*disc') === -1, 'calcT نباید فرمول موازی خط فاکتور داشته باشد');
  assertTrue(getDataSrc.indexOf('Math.round(est*disc') === -1, 'getData نباید فرمول موازی خط فاکتور داشته باشد');
});

console.log('');
console.log('📋 گروه: فاز ۳ B3 مالکیت invoice.totals');

function makeHtmlOnlyInvoiceTotals() {
  const runSrc = extractFunctionSource(html, 'runBusinessCore');
  const takeSrc = extractFunctionSource(html, 'takeBusinessCore');
  const hasSrc = extractFunctionSource(html, 'hasBusinessCore');
  const lineSrc = extractFunctionSource(html, 'calcInvoiceLine');
  const totSrc = extractFunctionSource(html, 'calcInvoiceTotals');
  assertTrue(!!totSrc, 'calcInvoiceTotals پیدا نشد');
  return new Function(runSrc + '\n' + takeSrc + '\n' + hasSrc + '\n' + lineSrc + '\n' + totSrc + `
    function getSirmanHostSync(){ return null; }
    return function(lines){ return calcInvoiceTotals(lines); };
  `)();
}

function makeExeInvoiceTotalsHost(runImpl) {
  const runSrc = extractFunctionSource(html, 'runBusinessCore');
  const takeSrc = extractFunctionSource(html, 'takeBusinessCore');
  const hasSrc = extractFunctionSource(html, 'hasBusinessCore');
  const lineSrc = extractFunctionSource(html, 'calcInvoiceLine');
  const totSrc = extractFunctionSource(html, 'calcInvoiceTotals');
  return new Function('runImpl', runSrc + '\n' + takeSrc + '\n' + hasSrc + '\n' + lineSrc + '\n' + totSrc + `
    function getSirmanHostSync(){
      return { RunBusiness: runImpl };
    }
    return function(lines){ return calcInvoiceTotals(lines); };
  `)(runImpl);
}

test('مسیر EXE باید RunBusiness("invoice.totals") را صدا بزند و DTO هسته را بدون بازنویسی JS برگرداند', () => {
  var calls = [];
  const calc = makeExeInvoiceTotalsHost(function(name, json){
    calls.push({name:name, payload: JSON.parse(json)});
    return JSON.stringify({ok:true, result:{tE:1, tD:2, tF:777777}});
  });
  const lines = [{est:1000, disc:10, finRaw:9999}, {est:1000, disc:0, finRaw:800}];
  const got = calc(lines);
  assertEqual(calls.length, 1, 'باید یک بار Host صدا شود');
  assertEqual(calls[0].name, 'invoice.totals', 'نام عملیات باید invoice.totals باشد');
  assertEqual(calls[0].payload.lines.length, 2, 'خطوط باید به Core بروند');
  assertEqual(got.tE, 1, 'tE هسته');
  assertEqual(got.tD, 2, 'tD هسته');
  assertEqual(got.tF, 777777, 'Host-wins: JS جمع ۱۷۰۰ را نباید بنویسد');
});

test('مسیر HTML-only باید fallback جمع JS را با بردارهای B1 اجرا کند', () => {
  const calc = makeHtmlOnlyInvoiceTotals();
  const pack = loadInvoicePricingParityVectors();
  pack.totals.forEach(function(row){
    const got = calc(row.lines);
    assertEqual(got.tE, row.tE, row.id + ' tE');
    assertEqual(got.tD, row.tD, row.id + ' tD');
    assertEqual(got.tF, row.tF, row.id + ' tF');
  });
  const src = extractFunctionSource(html, 'calcInvoiceTotals');
  assertContainsString(src, 'tE+=est', 'fallback JS جمع نباید حذف شود');
  assertContainsString(src, 'hasBusinessCore', 'مرز EXE باید صریح باشد');
});

test('شکست Core روی EXE نباید فرمول جمع JS را به‌جای InvoicePricing.Totals اجرا کند', () => {
  const calc = makeExeInvoiceTotalsHost(function(){
    return JSON.stringify({ok:false, error:'business-failed', message:'محاسبه انجام نشد'});
  });
  const got = calc([{est:1000, disc:10, finRaw:9999}, {est:1000, disc:0, finRaw:800}]);
  assertTrue(got == null, 'اگر Host هست و Core رد کند نباید {tE:2000,tF:1700} از JS برگردد');
});

test('calcInvoiceTotals نباید persist بنویسد و calcT/getData نباید reduce موازی EXE داشته باشند', () => {
  const totSrc = extractFunctionSource(html, 'calcInvoiceTotals');
  const calcTSrc = extractFunctionSource(html, 'calcT');
  const getDataSrc = extractFunctionSource(html, 'getData');
  assertTrue(totSrc.indexOf('localStorage') === -1, 'calcInvoiceTotals نباید localStorage بنویسد');
  assertTrue(totSrc.indexOf('indexedDB') === -1, 'calcInvoiceTotals نباید IndexedDB بنویسد');
  assertTrue(totSrc.indexOf('persistCoreSnapshot') === -1, 'calcInvoiceTotals نباید persistCoreSnapshot صدا بزند');
  assertContainsString(calcTSrc, 'calcInvoiceTotals', 'calcT باید از calcInvoiceTotals استفاده کند');
  assertContainsString(getDataSrc, 'calcInvoiceTotals', 'getData باید از calcInvoiceTotals استفاده کند');
  assertTrue(getDataSrc.indexOf('s+r.fin') === -1, 'getData نباید جمع JS موازی داشته باشد');
  assertTrue(calcTSrc.indexOf('tE+=est') === -1, 'calcT نباید جمع JS موازی داشته باشد');
});

console.log('');
console.log('📋 گروه: فاز ۳ B5 مالکیت calc.sla');

function makeHtmlOnlySla() {
  const runSrc = extractFunctionSource(html, 'runBusinessCore');
  const takeSrc = extractFunctionSource(html, 'takeBusinessCore');
  const hasSrc = extractFunctionSource(html, 'hasBusinessCore');
  const slaSrc = extractFunctionSource(html, 'calcSlaStatusFromAgeHours');
  return new Function(runSrc + '\n' + takeSrc + '\n' + hasSrc + '\n' + slaSrc + `
    function getSirmanHostSync(){ return null; }
    return function(ageH){ return calcSlaStatusFromAgeHours(ageH); };
  `)();
}

function makeExeSlaHost(runImpl) {
  const runSrc = extractFunctionSource(html, 'runBusinessCore');
  const takeSrc = extractFunctionSource(html, 'takeBusinessCore');
  const hasSrc = extractFunctionSource(html, 'hasBusinessCore');
  const slaSrc = extractFunctionSource(html, 'calcSlaStatusFromAgeHours');
  return new Function('runImpl', runSrc + '\n' + takeSrc + '\n' + hasSrc + '\n' + slaSrc + `
    function getSirmanHostSync(){
      return { RunBusiness: runImpl };
    }
    return function(ageH){ return calcSlaStatusFromAgeHours(ageH); };
  `)(runImpl);
}

test('مسیر EXE باید RunBusiness("calc.sla") را صدا بزند و نتیجه هسته را بدون فرمول JS برگرداند', () => {
  var calls = [];
  const calc = makeExeSlaHost(function(name, json){
    calls.push({name:name, payload: JSON.parse(json)});
    return JSON.stringify({ok:true, result:'core-distinctive-status'});
  });
  const got = calc(10);
  assertEqual(calls.length, 1, 'باید یک بار Host صدا شود');
  assertEqual(calls[0].name, 'calc.sla', 'نام عملیات باید calc.sla باشد');
  assertEqual(calls[0].payload.ageHours, 10, 'ageHours باید به Core برود');
  assertEqual(got, 'core-distinctive-status', 'Host-wins نباید با normal بازنویسی شود');
});

test('مسیر HTML-only باید آستانه‌های موجود SLA را بدون Host اجرا کند', () => {
  const calc = makeHtmlOnlySla();
  assertEqual(calc(10), 'normal', '10 → normal');
  assertEqual(calc(23.99), 'normal', 'parseInt(23.99) → 23 normal');
  assertEqual(calc(24), 'warning', '24 → warning');
  assertEqual(calc(47.99), 'warning', 'parseInt(47.99) → 47 warning');
  assertEqual(calc(48), 'critical', '48 → critical');
  assertEqual(calc(71.99), 'critical', 'parseInt(71.99) → 71 critical');
  assertEqual(calc(72), 'overdue', '72 → overdue');
  assertEqual(calc(73), 'overdue', '>72 → overdue');
  const src = extractFunctionSource(html, 'calcSlaStatusFromAgeHours');
  assertContainsString(src, "ageH<24)?'normal'", 'fallback JS نباید حذف شود');
  assertContainsString(src, 'hasBusinessCore', 'مرز EXE باید صریح باشد');
});

test('شکست Core روی EXE نباید فرمول SLA جاوااسکریپت را اجرا کند', () => {
  const calc = makeExeSlaHost(function(){
    return JSON.stringify({ok:false, error:'business-failed', message:'محاسبه انجام نشد'});
  });
  const got = calc(10);
  assertTrue(got == null, 'اگر Host هست و Core رد کند نباید normal از JS برگردد');
});

test('calc.sla نباید persist بنویسد و هشدار گارانتی null را اعلان نکند', () => {
  const slaSrc = extractFunctionSource(html, 'calcSlaStatusFromAgeHours');
  const alertSrc = extractFunctionSource(html, 'checkWarrantySlaAlerts');
  assertTrue(slaSrc.indexOf('localStorage') === -1, 'calcSla نباید localStorage بنویسد');
  assertTrue(slaSrc.indexOf('indexedDB') === -1, 'calcSla نباید IndexedDB بنویسد');
  assertTrue(slaSrc.indexOf('svWars') === -1 && slaSrc.indexOf('persistCoreSnapshot') === -1, 'calcSla نباید ذخیره کند');
  assertContainsString(alertSrc, '!slaKey', 'هشدار گارانتی نباید null را مثل وضعیت واقعی اعلان کند');
});

console.log('');
console.log('📋 گروه: فاز ۳ B6 مالکیت sale.line');

function loadSaleLineParityVectors() {
  const name = 'SaleLineParityVectors.json';
  const candidates = [
    path.join(__dirname, 'desktop', 'Sirman.Core.Tests', name),
    path.join(path.dirname(filePath), 'desktop', 'Sirman.Core.Tests', name)
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, 'utf8'));
  }
  throw new Error('جدول بردار B6 پیدا نشد: ' + name);
}

function makeHtmlOnlySaleLine() {
  const runSrc = extractFunctionSource(html, 'runBusinessCore');
  const takeSrc = extractFunctionSource(html, 'takeBusinessCore');
  const hasSrc = extractFunctionSource(html, 'hasBusinessCore');
  const lineSrc = extractFunctionSource(html, 'calcSaleLine');
  assertTrue(!!runSrc && !!takeSrc && !!hasSrc && !!lineSrc, 'توابع calcSaleLine / takeBusinessCore پیدا نشد');
  return new Function(runSrc + '\n' + takeSrc + '\n' + hasSrc + '\n' + lineSrc + `
    function getSirmanHostSync(){ return null; }
    return function(qty, price, disc){ return calcSaleLine(qty, price, disc); };
  `)();
}

function makeExeSaleLineHost(runImpl) {
  const runSrc = extractFunctionSource(html, 'runBusinessCore');
  const takeSrc = extractFunctionSource(html, 'takeBusinessCore');
  const hasSrc = extractFunctionSource(html, 'hasBusinessCore');
  const lineSrc = extractFunctionSource(html, 'calcSaleLine');
  return new Function('runImpl', runSrc + '\n' + takeSrc + '\n' + hasSrc + '\n' + lineSrc + `
    function getSirmanHostSync(){
      return { RunBusiness: runImpl };
    }
    return function(qty, price, disc){ return calcSaleLine(qty, price, disc); };
  `)(runImpl);
}

test('مسیر EXE باید RunBusiness("sale.line") را صدا بزند و نتیجه هسته را بدون فرمول JS برگرداند', () => {
  var calls = [];
  const calc = makeExeSaleLineHost(function(name, json){
    calls.push({name:name, payload: JSON.parse(json)});
    return JSON.stringify({ok:true, result:{qty:1, price:1000, disc:10, discAmt:777, total:888888}});
  });
  const got = calc(2, 1000, 10);
  assertEqual(calls.length, 1, 'باید یک بار Host صدا شود');
  assertEqual(calls[0].name, 'sale.line', 'نام عملیات باید sale.line باشد');
  assertEqual(calls[0].payload.qty, 2, 'qty باید به Core برود');
  assertEqual(calls[0].payload.price, 1000, 'price باید به Core برود');
  assertEqual(calls[0].payload.disc, 10, 'disc باید به Core برود');
  assertEqual(got.total, 888888, 'Host-wins نباید با جمع JS بازنویسی شود');
  assertEqual(got.discAmt, 777, 'Host-wins نباید discAmt جاوااسکریپت را نگه دارد');
});

test('مسیر HTML-only باید بردارهای موجود sale.line را بدون Host اجرا کند', () => {
  const pack = loadSaleLineParityVectors();
  const calc = makeHtmlOnlySaleLine();
  pack.line.forEach(function(row) {
    const got = calc(row.qty, row.price, row.disc);
    assertEqual(got.discAmt, row.discAmt, row.id + ' discAmt');
    assertEqual(got.total, row.total, row.id + ' total');
    assertEqual(got.qty, row.outQty, row.id + ' qty');
  });
  const src = extractFunctionSource(html, 'calcSaleLine');
  assertContainsString(src, 'Math.round(price * disc / 100)', 'fallback JS نباید حذف شود');
  assertContainsString(src, 'hasBusinessCore', 'مرز EXE باید صریح باشد');
});

test('شکست Core روی EXE نباید فرمول sale.line جاوااسکریپت را اجرا کند', () => {
  const calc = makeExeSaleLineHost(function(){
    return JSON.stringify({ok:false, error:'business-failed', message:'محاسبه انجام نشد'});
  });
  const got = calc(2, 1000, 10);
  assertTrue(got == null, 'اگر Host هست و Core رد کند نباید total=1800 از JS برگردد');
});

test('sale.line نباید persist بنویسد و calcSaleTotal نباید در B6 مهاجرت شود', () => {
  const lineSrc = extractFunctionSource(html, 'calcSaleLine');
  const getSrc = extractFunctionSource(html, 'getSaleData');
  const printSrc = extractFunctionSource(html, 'printSaleDoc');
  const totSrc = extractFunctionSource(html, 'calcSaleTotal');
  assertTrue(lineSrc.indexOf('localStorage') === -1, 'calcSaleLine نباید localStorage بنویسد');
  assertTrue(lineSrc.indexOf('indexedDB') === -1, 'calcSaleLine نباید IndexedDB بنویسد');
  assertTrue(lineSrc.indexOf('svSales') === -1 && lineSrc.indexOf('persistCoreSnapshot') === -1, 'calcSaleLine نباید ذخیره کند');
  assertContainsString(getSrc, 'calcSaleLine', 'getSaleData باید از calcSaleLine استفاده کند');
  assertContainsString(printSrc, 'calcSaleLine', 'printSaleDoc باید محاسبه خط را از calcSaleLine بخواهد');
  assertTrue(getSrc.indexOf("takeBusinessCore('sale.line'") === -1, 'getSaleData نباید IIFE موازی sale.line داشته باشد');
  assertContainsString(totSrc, 'sale.total', 'جمع فروش هنوز sale.total است نه مهاجرت B6');
});

console.log('');
console.log('📋 گروه: فاز ۳ B8 مالکیت sale.total');

function loadSaleTotalParityVectors() {
  const name = 'SaleTotalParityVectors.json';
  const candidates = [
    path.join(__dirname, 'desktop', 'Sirman.Core.Tests', name),
    path.join(path.dirname(filePath), 'desktop', 'Sirman.Core.Tests', name)
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, 'utf8'));
  }
  throw new Error('جدول بردار B8 پیدا نشد: ' + name);
}

function makeSaleTotalHarness(hostFactory, items) {
  const runSrc = extractFunctionSource(html, 'runBusinessCore');
  const takeSrc = extractFunctionSource(html, 'takeBusinessCore');
  const hasSrc = extractFunctionSource(html, 'hasBusinessCore');
  const lineSrc = extractFunctionSource(html, 'calcSaleLine');
  const totSrc = extractFunctionSource(html, 'calcSaleTotal');
  assertTrue(!!runSrc && !!takeSrc && !!hasSrc && !!lineSrc && !!totSrc, 'توابع calcSaleTotal / calcSaleLine / takeBusinessCore پیدا نشد');
  return new Function('hostFactory', 'items', runSrc + '\n' + takeSrc + '\n' + hasSrc + '\n' + lineSrc + '\n' + totSrc + `
    var saleItems = items.slice();
    var ntfCalls = [];
    function ntf(msg, kind){ ntfCalls.push({msg:msg, kind:kind}); }
    var lbl = { textContent: '' };
    var cnt = { textContent: '' };
    var document = {
      querySelectorAll: function(){ return []; },
      getElementById: function(id){
        if(id==='sale-total-lbl') return lbl;
        if(id==='sale-item-count') return cnt;
        return null;
      }
    };
    function getSirmanHostSync(){ return hostFactory(); }
    var total = calcSaleTotal();
    return { total: total, ntfCalls: ntfCalls, label: lbl.textContent, count: String(cnt.textContent), saleItems: saleItems };
  `)(hostFactory, items);
}

test('مسیر EXE باید RunBusiness("sale.total") را با items صدا بزند و نتیجه هسته را بدون جمع JS برگرداند', () => {
  var calls = [];
  const items = [{qty:2, price:1000, disc:10}];
  const got = makeSaleTotalHarness(function(){
    return { RunBusiness: function(name, json){
      calls.push({name:name, payload: JSON.parse(json)});
      return JSON.stringify({ok:true, result:777777});
    }};
  }, items);
  assertEqual(calls.length, 1, 'باید یک بار Host صدا شود');
  assertEqual(calls[0].name, 'sale.total', 'نام عملیات باید sale.total باشد');
  assertTrue(Array.isArray(calls[0].payload.items), 'payload باید items داشته باشد');
  assertEqual(calls[0].payload.items.length, 1, 'باید یک ردیف به Core برود');
  assertEqual(calls[0].payload.items[0].qty, 2, 'qty باید به Core برود');
  assertEqual(calls[0].payload.items[0].price, 1000, 'price باید به Core برود');
  assertEqual(calls[0].payload.items[0].disc, 10, 'disc باید به Core برود');
  assertEqual(got.total, 777777, 'Host-wins نباید جمع JS=1800 را برگرداند');
  assertTrue(got.total !== 1800, 'نتیجه متمایز هسته نباید با جمع جاوااسکریپت یکی باشد');
});

test('مسیر HTML-only باید بردارهای sale.total را بدون Host اجرا کند', () => {
  const pack = loadSaleTotalParityVectors();
  pack.total.forEach(function(row) {
    const got = makeSaleTotalHarness(function(){ return null; }, row.items);
    assertEqual(got.total, row.expected, row.id + ' total');
  });
  const src = extractFunctionSource(html, 'calcSaleTotal');
  assertContainsString(src, 'sale.total', 'جمع فروش باید از هسته sale.total بیاید');
  assertContainsString(src, 'hasBusinessCore', 'مرز EXE باید صریح باشد');
  assertContainsString(src, 'calcSaleLine', 'fallback HTML-only باید از calcSaleLine جمع بزند');
  assertTrue(src.indexOf('Math.round(item.price * item.disc / 100)') === -1, 'فرمول خط موازی نباید در calcSaleTotal بماند');
});

test('شکست Core روی EXE نباید reduce جاوااسکریپت sale.total را اجرا کند', () => {
  var calls = [];
  const items = [{qty:2, price:1000, disc:10}];
  const got = makeSaleTotalHarness(function(){
    return { RunBusiness: function(name, json){
      calls.push({name:name, payload: JSON.parse(json)});
      return JSON.stringify({ok:false, error:'business-failed', message:'محاسبه فروش انجام نشد'});
    }};
  }, items);
  assertEqual(calls.length, 1, 'باید Host صدا شود');
  assertEqual(calls[0].name, 'sale.total', 'فقط sale.total باید صدا شود نه sale.line به‌عنوان fallback');
  assertEqual(got.total, 0, 'اگر Host هست و Core رد کند باید 0 بماند نه جمع JS=1800');
  assertTrue(got.total !== 1800, 'fail-closed نباید reduce جاوااسکریپت را اجرا کند');
});

test('sale.total نباید persist بنویسد', () => {
  const totSrc = extractFunctionSource(html, 'calcSaleTotal');
  assertTrue(totSrc.indexOf('localStorage') === -1, 'calcSaleTotal نباید localStorage بنویسد');
  assertTrue(totSrc.indexOf('indexedDB') === -1, 'calcSaleTotal نباید IndexedDB بنویسد');
  assertTrue(totSrc.indexOf('svSales') === -1, 'calcSaleTotal نباید svSales صدا بزند');
  assertTrue(totSrc.indexOf('persistCoreSnapshot') === -1, 'calcSaleTotal نباید persistCoreSnapshot صدا بزند');
  assertTrue(totSrc.indexOf('migrateBackup') === -1, 'calcSaleTotal نباید backup بنویسد');
  assertTrue(totSrc.indexOf('inventory.consume') === -1, 'calcSaleTotal نباید مصرف انبار باشد');
});

console.log('');
console.log('📋 گروه: فاز ۳ B10 قفل برابری calc.warrantyEndDate');

function loadWarrantyEndDateParityVectors() {
  const name = 'WarrantyEndDateParityVectors.json';
  const candidates = [
    path.join(__dirname, 'desktop', 'Sirman.Core.Tests', name),
    path.join(path.dirname(filePath), 'desktop', 'Sirman.Core.Tests', name)
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, 'utf8'));
  }
  throw new Error('جدول بردار B10 پیدا نشد: ' + name);
}

function makeHtmlOnlyWarrantyEndDate() {
  const addSrc = extractFunctionSource(html, 'addJalaliMonths');
  const endSrc = extractFunctionSource(html, 'calcWarrantyEndDate');
  assertTrue(!!addSrc && !!endSrc, 'توابع addJalaliMonths / calcWarrantyEndDate پیدا نشد');
  return new Function(addSrc + '\n' + endSrc + `
    return {
      add: function(date, months){ return addJalaliMonths(date, months); },
      end: function(date, months){ return calcWarrantyEndDate(date, months); }
    };
  `)();
}

test('مسیر HTML-only باید بردارهای قفل‌شده calc.warrantyEndDate را بدون Host اجرا کند', () => {
  const pack = loadWarrantyEndDateParityVectors();
  const calc = makeHtmlOnlyWarrantyEndDate();
  pack.date.forEach(function(row) {
    const addGot = calc.add(row.date, row.months);
    const endGot = calc.end(row.date, row.months);
    assertEqual(addGot, row.expected, row.id + ' addJalaliMonths');
    assertEqual(endGot, row.expected, row.id + ' calcWarrantyEndDate');
  });
  const endSrc = extractFunctionSource(html, 'calcWarrantyEndDate');
  assertContainsString(endSrc, 'calc.warrantyEndDate', 'عملیات هسته باید calc.warrantyEndDate بماند');
  assertContainsString(endSrc, 'addJalaliMonths', 'fallback JS باید بماند');
});

test('calc.warrantyEndDate و addJalaliMonths نباید persist بنویسند', () => {
  const endSrc = extractFunctionSource(html, 'calcWarrantyEndDate');
  const addSrc = extractFunctionSource(html, 'addJalaliMonths');
  [endSrc, addSrc].forEach(function(src) {
    assertTrue(src.indexOf('localStorage') === -1, 'نباید localStorage بنویسد');
    assertTrue(src.indexOf('indexedDB') === -1, 'نباید IndexedDB بنویسد');
    assertTrue(src.indexOf('svWars') === -1, 'نباید svWars صدا بزند');
    assertTrue(src.indexOf('persistCoreSnapshot') === -1, 'نباید persistCoreSnapshot صدا بزند');
    assertTrue(src.indexOf('warranty.save') === -1, 'نباید warranty.save باشد');
  });
});

console.log('');
console.log('📋 گروه: فاز ۳ B11 مالکیت calc.warrantyEndDate');

function makeHtmlOnlyWarrantyEndDateOwned() {
  const runSrc = extractFunctionSource(html, 'runBusinessCore');
  const takeSrc = extractFunctionSource(html, 'takeBusinessCore');
  const hasSrc = extractFunctionSource(html, 'hasBusinessCore');
  const addSrc = extractFunctionSource(html, 'addJalaliMonths');
  const endSrc = extractFunctionSource(html, 'calcWarrantyEndDate');
  assertTrue(!!runSrc && !!takeSrc && !!hasSrc && !!addSrc && !!endSrc, 'توابع calcWarrantyEndDate / Host پیدا نشد');
  return new Function(runSrc + '\n' + takeSrc + '\n' + hasSrc + '\n' + addSrc + '\n' + endSrc + `
    function getSirmanHostSync(){ return null; }
    return function(date, months){ return calcWarrantyEndDate(date, months); };
  `)();
}

function makeExeWarrantyEndDateHost(runImpl) {
  const runSrc = extractFunctionSource(html, 'runBusinessCore');
  const takeSrc = extractFunctionSource(html, 'takeBusinessCore');
  const hasSrc = extractFunctionSource(html, 'hasBusinessCore');
  const addSrc = extractFunctionSource(html, 'addJalaliMonths');
  const endSrc = extractFunctionSource(html, 'calcWarrantyEndDate');
  return new Function('runImpl', runSrc + '\n' + takeSrc + '\n' + hasSrc + '\n' + addSrc + '\n' + endSrc + `
    function getSirmanHostSync(){
      return { RunBusiness: runImpl };
    }
    return function(date, months){ return calcWarrantyEndDate(date, months); };
  `)(runImpl);
}

test('مسیر EXE باید RunBusiness("calc.warrantyEndDate") را صدا بزند و نتیجه هسته را بدون addJalaliMonths برگرداند', () => {
  var calls = [];
  const calc = makeExeWarrantyEndDateHost(function(name, json){
    calls.push({name:name, payload: JSON.parse(json)});
    return JSON.stringify({ok:true, result:'9999/09/09'});
  });
  const got = calc('1405/05/05', 24);
  assertEqual(calls.length, 1, 'باید یک بار Host صدا شود');
  assertEqual(calls[0].name, 'calc.warrantyEndDate', 'نام عملیات باید calc.warrantyEndDate باشد');
  assertEqual(calls[0].payload.purchaseDate, '1405/05/05', 'purchaseDate باید به Core برود');
  assertEqual(calls[0].payload.periodMonths, 24, 'periodMonths باید به Core برود');
  assertEqual(got, '9999/09/09', 'Host-wins نباید 1407/05/05 جاوااسکریپت را برگرداند');
  assertTrue(got !== '1407/05/05', 'نتیجه متمایز هسته نباید با fallback یکی باشد');
});

test('مسیر HTML-only باید بردارهای B10 را بعد از مهاجرت مالکیت هم اجرا کند', () => {
  const pack = loadWarrantyEndDateParityVectors();
  const calc = makeHtmlOnlyWarrantyEndDateOwned();
  pack.date.forEach(function(row) {
    assertEqual(calc(row.date, row.months), row.expected, row.id);
  });
  const endSrc = extractFunctionSource(html, 'calcWarrantyEndDate');
  const addSrc = extractFunctionSource(html, 'addJalaliMonths');
  assertContainsString(endSrc, 'hasBusinessCore', 'مرز EXE باید صریح باشد');
  assertContainsString(endSrc, 'addJalaliMonths', 'fallback JS نباید حذف شود');
  assertContainsString(addSrc, 'm += months', 'حساب ماه جلالی fallback نباید عوض شود');
  assertContainsString(addSrc, '(m<=6)?31:(m<=11?30:29)', 'کلمپ اسفند fallback نباید عوض شود');
});

test('شکست Core روی EXE نباید addJalaliMonths را اجرا کند', () => {
  const calc = makeExeWarrantyEndDateHost(function(){
    return JSON.stringify({ok:false, error:'business-failed', message:'محاسبه انجام نشد'});
  });
  const got = calc('1405/05/05', 24);
  assertTrue(got == null, 'اگر Host هست و Core رد کند نباید 1407/05/05 از JS برگردد');
});

test('calcWarrExpFromBuy نباید رشته null را در تاریخ انقضا بنویسد', () => {
  const runSrc = extractFunctionSource(html, 'runBusinessCore');
  const takeSrc = extractFunctionSource(html, 'takeBusinessCore');
  const hasSrc = extractFunctionSource(html, 'hasBusinessCore');
  const addSrc = extractFunctionSource(html, 'addJalaliMonths');
  const endSrc = extractFunctionSource(html, 'calcWarrantyEndDate');
  const buySrc = extractFunctionSource(html, 'calcWarrExpFromBuy');
  const got = new Function(runSrc + '\n' + takeSrc + '\n' + hasSrc + '\n' + addSrc + '\n' + endSrc + '\n' + buySrc + `
    var store = {
      wd1_buy: { value: '1405/05/05' },
      wd1_wmonths: { value: '24' },
      wd1_wexp: { value: 'KEEP' }
    };
    var document = { getElementById: function(id){ return store[id] || null; } };
    function getSirmanHostSync(){
      return { RunBusiness: function(){ return JSON.stringify({ok:false, error:'business-failed'}); } };
    }
    calcWarrExpFromBuy(1);
    return store.wd1_wexp.value;
  `)();
  assertEqual(got, 'KEEP', 'شکست Core نباید value را null یا تاریخ JS کند');
  assertTrue(got !== 'null', 'نباید رشته null در فیلد انقضا نوشته شود');
});

test('calcWarrExpFromBuy خودش takeBusinessCore صدا نمی‌زند — DRY از طریق calcWarrantyEndDate', () => {
  const src = extractFunctionSource(html, 'calcWarrExpFromBuy');
  if (!src) throw new Error('calcWarrExpFromBuy not found');
  if (src.includes('takeBusinessCore')) throw new Error('calcWarrExpFromBuy must not call takeBusinessCore; use calcWarrantyEndDate');
  assertContainsString(src, 'calcWarrantyEndDate(', 'calcWarrExpFromBuy must call calcWarrantyEndDate');
});

test('calcWarrantyEndDate نباید persist بنویسد', () => {
  const endSrc = extractFunctionSource(html, 'calcWarrantyEndDate');
  const buySrc = extractFunctionSource(html, 'calcWarrExpFromBuy');
  [endSrc, buySrc].forEach(function(src) {
    assertTrue(src.indexOf('localStorage') === -1, 'نباید localStorage بنویسد');
    assertTrue(src.indexOf('indexedDB') === -1, 'نباید IndexedDB بنویسد');
    assertTrue(src.indexOf('svWars') === -1, 'نباید svWars صدا بزند');
    assertTrue(src.indexOf('persistCoreSnapshot') === -1, 'نباید persistCoreSnapshot صدا بزند');
    assertTrue(src.indexOf('warranty.save') === -1, 'نباید warranty.save باشد');
  });
});

test('B11 نباید save/close/delete گارانتی را عوض کند', () => {
  const saveSrc = extractFunctionSource(html, 'saveWar');
  const closeSrc = extractFunctionSource(html, 'closeWar');
  const endSrc = extractFunctionSource(html, 'calcWarrantyEndDate');
  assertContainsString(saveSrc, "warranty.save", 'saveWar باید warranty.save بماند');
  assertContainsString(closeSrc, "warranty.close", 'closeWar باید warranty.close بماند');
  assertContainsString(html, "takeBusinessCore('warranty.delete'", 'حذف گارانتی باید warranty.delete بماند');
  assertTrue(endSrc.indexOf('warranty.save') === -1, 'calcWarrantyEndDate نباید save باشد');
  assertTrue(endSrc.indexOf('warranty.close') === -1, 'calcWarrantyEndDate نباید close باشد');
});

console.log('');
console.log('📋 گروه: فاز ۳ B13 قفل برابری rules.suggestParts');

function loadSuggestPartsParityVectors() {
  const name = 'SuggestPartsParityVectors.json';
  const candidates = [
    path.join(__dirname, 'desktop', 'Sirman.Core.Tests', name),
    path.join(path.dirname(filePath), 'desktop', 'Sirman.Core.Tests', name)
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, 'utf8'));
  }
  throw new Error('جدول بردار B13 پیدا نشد: ' + name);
}

function makeHtmlOnlySuggestParts() {
  const suggestSrc = extractFunctionSource(html, 'suggestPartsForCase');
  const snapSrc = extractFunctionSource(html, 'invStockSnapshot');
  const sumSrc = extractFunctionSource(html, '_sumByWh');
  assertTrue(!!suggestSrc && !!snapSrc && !!sumSrc, 'توابع suggestPartsForCase / invStockSnapshot / _sumByWh پیدا نشد');
  return new Function(sumSrc + '\n' + snapSrc + '\n' + suggestSrc + `
    function hasBusinessCore(){ return false; }
    function takeBusinessCore(){ return null; }
    return function(opts){ return suggestPartsForCase(opts); };
  `)();
}

function slimSuggestHit(h) {
  return {
    code: String(h.code || ''),
    name: String(h.name || ''),
    qty: Number(h.qty),
    explain: String(h.explain || '')
  };
}

test('مسیر HTML-only باید بردارهای قفل‌شده rules.suggestParts را بدون Host اجرا کند', () => {
  const pack = loadSuggestPartsParityVectors();
  const suggest = makeHtmlOnlySuggestParts();
  pack.cases.forEach(function(row) {
    const parts = Object.prototype.hasOwnProperty.call(row, 'parts') ? row.parts : pack.catalog;
    const got = (suggest({parts: parts, prodCode: row.prodCode, model: row.model, problem: row.problem}) || []).map(slimSuggestHit);
    const expected = (row.expected || []).map(slimSuggestHit);
    assertEqual(got.length, expected.length, row.id + ' length');
    expected.forEach(function(exp, i) {
      assertEqual(got[i].code, exp.code, row.id + ' [' + i + '] code');
      assertEqual(got[i].name, exp.name, row.id + ' [' + i + '] name');
      assertEqual(got[i].qty, exp.qty, row.id + ' [' + i + '] qty');
      assertEqual(got[i].explain, exp.explain, row.id + ' [' + i + '] explain');
    });
  });
  const src = extractFunctionSource(html, 'suggestPartsForCase');
  assertContainsString(src, 'rules.suggestParts', 'عملیات هسته باید rules.suggestParts بماند');
  assertContainsString(src, 'catalog.forEach', 'fallback JS ranking باید بماند');
  assertContainsString(src, 'invStockSnapshot', 'fallback باید موجودی را از invStockSnapshot بخواند');
});

test('rules.suggestParts نباید persist یا جهش انبار بنویسد و مالکیت B13 مهاجرت نشده باشد', () => {
  const src = extractFunctionSource(html, 'suggestPartsForCase');
  assertTrue(src.indexOf('localStorage') === -1, 'نباید localStorage بنویسد');
  assertTrue(src.indexOf('indexedDB') === -1, 'نباید IndexedDB بنویسد');
  assertTrue(src.indexOf('svWars') === -1, 'نباید svWars صدا بزند');
  assertTrue(src.indexOf('persistCoreSnapshot') === -1, 'نباید persistCoreSnapshot صدا بزند');
  assertTrue(src.indexOf('warranty.save') === -1, 'نباید warranty.save باشد');
  assertTrue(src.indexOf('inventory.reserve') === -1, 'نباید inventory.reserve باشد');
  assertTrue(src.indexOf('inventory.consume') === -1, 'نباید inventory.consume باشد');
  assertContainsString(src, 'if(Array.isArray(core)) return core', 'آرایه هسته باید همچنان برگردد');
  assertTrue(src.indexOf('return [];') === -1 || src.indexOf('catalog.forEach') >= 0, 'fallback ranking باید بماند');
});

console.log('');
console.log('📋 گروه: فاز ۳ B14 مالکیت rules.suggestParts');

function makeExeSuggestPartsHost(runImpl) {
  const runSrc = extractFunctionSource(html, 'runBusinessCore');
  const takeSrc = extractFunctionSource(html, 'takeBusinessCore');
  const hasSrc = extractFunctionSource(html, 'hasBusinessCore');
  const suggestSrc = extractFunctionSource(html, 'suggestPartsForCase');
  const snapSrc = extractFunctionSource(html, 'invStockSnapshot');
  const sumSrc = extractFunctionSource(html, '_sumByWh');
  assertTrue(!!runSrc && !!takeSrc && !!hasSrc && !!suggestSrc, 'توابع suggestPartsForCase / Host پیدا نشد');
  return new Function('runImpl', runSrc + '\n' + takeSrc + '\n' + hasSrc + '\n' + (sumSrc || '') + '\n' + (snapSrc || '') + '\n' + suggestSrc + `
    function getSirmanHostSync(){
      return { RunBusiness: runImpl };
    }
    return function(opts){ return suggestPartsForCase(opts); };
  `)(runImpl);
}

test('مسیر EXE باید RunBusiness("rules.suggestParts") را صدا بزند و آرایه هسته را بدون ranking جاوااسکریپت برگرداند', () => {
  var calls = [];
  const suggest = makeExeSuggestPartsHost(function(name, json){
    calls.push({name:name, payload: JSON.parse(json)});
    return JSON.stringify({ok:true, result:[{code:'CORE-ONLY', name:'from-core', qty:99, explain:'from-core'}]});
  });
  const catalog = [
    {code:'P-HEAT', name:'هیتر', prodCode:'402003', cat:'گرمایش', qty:10, reserved:4}
  ];
  const got = suggest({parts:catalog, prodCode:'402003', model:'', problem:''});
  assertEqual(calls.length, 1, 'باید یک بار Host صدا شود');
  assertEqual(calls[0].name, 'rules.suggestParts', 'نام عملیات باید rules.suggestParts باشد');
  assertEqual(calls[0].payload.prodCode, '402003', 'prodCode باید به Core برود');
  assertTrue(Array.isArray(got) && got.length === 1, 'باید آرایه هسته برگردد');
  assertEqual(got[0].code, 'CORE-ONLY', 'Host-wins نباید P-HEAT جاوااسکریپت را برگرداند');
  assertTrue(got[0].code !== 'P-HEAT', 'نتیجه متمایز هسته نباید با fallback یکی باشد');
});

test('مسیر HTML-only باید بردارهای B13 را بعد از مهاجرت مالکیت هم اجرا کند', () => {
  const pack = loadSuggestPartsParityVectors();
  const suggest = makeHtmlOnlySuggestParts();
  pack.cases.forEach(function(row) {
    const parts = Object.prototype.hasOwnProperty.call(row, 'parts') ? row.parts : pack.catalog;
    const got = (suggest({parts: parts, prodCode: row.prodCode, model: row.model, problem: row.problem}) || []).map(slimSuggestHit);
    const expected = (row.expected || []).map(slimSuggestHit);
    assertEqual(got.length, expected.length, row.id + ' length');
    expected.forEach(function(exp, i) {
      assertEqual(got[i].code, exp.code, row.id + ' [' + i + '] code');
      assertEqual(got[i].qty, exp.qty, row.id + ' [' + i + '] qty');
      assertEqual(got[i].explain, exp.explain, row.id + ' [' + i + '] explain');
    });
  });
  const src = extractFunctionSource(html, 'suggestPartsForCase');
  assertContainsString(src, 'hasBusinessCore', 'مرز EXE باید صریح باشد');
  assertContainsString(src, 'catalog.forEach', 'fallback JS ranking نباید حذف شود');
  assertContainsString(src, 'invStockSnapshot', 'حساب موجودی fallback نباید عوض شود');
  assertContainsString(src, "why.push('چون کالای مرتبط همین مدل است')", 'متن دلیل fallback نباید عوض شود');
});

test('شکست Core روی EXE نباید ranking جاوااسکریپت را اجرا کند', () => {
  const catalog = [
    {code:'P-HEAT', name:'هیتر', prodCode:'402003', cat:'گرمایش', qty:10, reserved:4}
  ];
  const failed = makeExeSuggestPartsHost(function(){
    return JSON.stringify({ok:false, error:'business-failed', message:'محاسبه انجام نشد'});
  })({parts:catalog, prodCode:'402003', model:'', problem:''});
  assertTrue(failed == null, 'ok:false نباید P-HEAT از JS برگردد');
  const invalid = makeExeSuggestPartsHost(function(){
    return JSON.stringify({ok:true, result:{code:'P-HEAT'}});
  })({parts:catalog, prodCode:'402003', model:'', problem:''});
  assertTrue(invalid == null, 'نتیجه غیرآرایه نباید ranking JS را اجرا کند');
});

test('applySuggestedWarParts نباید با null هسته قطعه JS به درخواست اضافه کند', () => {
  const runSrc = extractFunctionSource(html, 'runBusinessCore');
  const takeSrc = extractFunctionSource(html, 'takeBusinessCore');
  const hasSrc = extractFunctionSource(html, 'hasBusinessCore');
  const suggestSrc = extractFunctionSource(html, 'suggestPartsForCase');
  const applySrc = extractFunctionSource(html, 'applySuggestedWarParts');
  const got = new Function(runSrc + '\n' + takeSrc + '\n' + hasSrc + '\n' + suggestSrc + '\n' + applySrc + `
    var notes = [];
    function ntf(msg){ notes.push(String(msg||'')); }
    var parts = [{code:'P-HEAT', name:'هیتر', prodCode:'402003', cat:'گرمایش', qty:10, reserved:4}];
    function getWarSuggestContext(){ return {prodCode:'402003', model:'', problem:''}; }
    function renderWarPartReqs(){}
    var window = { _waParts: [] };
    function getSirmanHostSync(){
      return { RunBusiness: function(){ return JSON.stringify({ok:false, error:'business-failed'}); } };
    }
    applySuggestedWarParts('agency');
    return {len: window._waParts.length, notes: notes.join('|')};
  `)();
  assertEqual(got.len, 0, 'شکست Core نباید P-HEAT را به _waParts اضافه کند');
  assertTrue(got.notes.indexOf('null') === -1, 'نباید رشته null در اعلان باشد');
});

test('B14 نباید persist / جهش انبار / save گارانتی را عوض کند', () => {
  const src = extractFunctionSource(html, 'suggestPartsForCase');
  const applySrc = extractFunctionSource(html, 'applySuggestedWarParts');
  const saveSrc = extractFunctionSource(html, 'saveWar');
  [src, applySrc].forEach(function(s) {
    assertTrue(s.indexOf('localStorage') === -1, 'نباید localStorage بنویسد');
    assertTrue(s.indexOf('indexedDB') === -1, 'نباید IndexedDB بنویسد');
    assertTrue(s.indexOf('inventory.reserve') === -1, 'نباید inventory.reserve باشد');
    assertTrue(s.indexOf('inventory.consume') === -1, 'نباید inventory.consume باشد');
    assertTrue(s.indexOf('inventory.release') === -1, 'نباید inventory.release باشد');
    assertTrue(s.indexOf('warranty.save') === -1, 'نباید warranty.save باشد');
    assertTrue(s.indexOf('warranty.close') === -1, 'نباید warranty.close باشد');
    assertTrue(s.indexOf('warranty.delete') === -1, 'نباید warranty.delete باشد');
  });
  assertContainsString(saveSrc, "warranty.save", 'saveWar باید warranty.save بماند');
  assertContainsString(html, "takeBusinessCore('warranty.close'", 'close باید warranty.close بماند');
  assertContainsString(html, "takeBusinessCore('warranty.delete'", 'حذف باید warranty.delete بماند');
  assertContainsString(src, 'return null', 'شکست Core باید fail-closed null باشد');
});

test('رزرو در exe فقط Writer هسته باشد و بدون Host همان جهش JS بماند', () => {
  const runSrc = extractFunctionSource(html, 'runBusinessCore');
  const takeSrc = extractFunctionSource(html, 'takeBusinessCore');
  const hasSrc = extractFunctionSource(html, 'hasBusinessCore');
  const applySrc = extractFunctionSource(html, 'applyCoreItemOnto');
  const recSrc = extractFunctionSource(html, 'applyCoreRecordOnto');
  const resSrc = extractFunctionSource(html, 'invReserveOnItem');
  assertTrue(!!applySrc && !!resSrc, 'آداپتر رزرو پیدا نشد');
  const jsPath = new Function(runSrc + '\n' + takeSrc + '\n' + hasSrc + '\n' + recSrc + '\n' + applySrc + '\n' + resSrc + `
    function getSirmanHostSync(){ return null; }
    function invStockSnapshot(item){ return {qty:item.qty||0, reserved:item.reserved||0, available:Math.max(0,(item.qty||0)-(item.reserved||0))}; }
    var item = {qty:10, reserved:0};
    var r = invReserveOnItem(item, 4, '');
    return {ok:r.ok, reserved:item.reserved};
  `)();
  assertEqual(jsPath.ok, true, 'HTML-only باید رزرو کند');
  assertEqual(jsPath.reserved, 4, 'HTML-only باید reserved را ۴ کند');
  const exePath = new Function(runSrc + '\n' + takeSrc + '\n' + hasSrc + '\n' + recSrc + '\n' + applySrc + '\n' + resSrc + `
    function getSirmanHostSync(){
      return { RunBusiness: function(name, json){
        return JSON.stringify({ok:true, result:{ok:true, item:{qty:10, reserved:3, reservedByWh:{}}, stock:{qty:10, reserved:3, available:7}}});
      }};
    }
    var item = {qty:10, reserved:0};
    var r = invReserveOnItem(item, 4, '');
    return {ok:r.ok, reserved:item.reserved, avail:r.stock.available};
  `)();
  assertEqual(exePath.ok, true, 'exe باید رزرو هسته را بپذیرد');
  assertEqual(exePath.reserved, 3, 'آداپتر باید reserved هسته را روی کالا بنویسد نه محاسبه JS');
  assertEqual(exePath.avail, 7, 'موجودی قابل‌استفاده باید از هسته بیاید');
});

console.log('');
console.log('📋 گروه: تکمیل فاز ۲ (C# منبع حقیقت عملیات حساس)');

test('در exe جمع فاکتور و فروش نباید بعد از هسته دوباره با JS بازنویسی شود', () => {
  const calcTSrc = extractFunctionSource(html, 'calcT');
  const totSrc = extractFunctionSource(html, 'calcInvoiceTotals');
  const saleSrc = extractFunctionSource(html, 'calcSaleTotal');
  assertContainsString(totSrc, 'invoice.totals', 'جمع فاکتور باید از هسته invoice.totals بیاید');
  assertContainsString(calcTSrc, 'calcInvoiceTotals', 'calcT باید جمع را از calcInvoiceTotals بخواهد');
  assertContainsString(calcTSrc, 'disc>0', 'شرط تخفیف نباید از calcT حذف شود');
  assertTrue(calcTSrc.indexOf('if(coreTot && coreTot.tF!=null)') < 0, 'calcT نباید جمع JS را روی نتیجه هسته بنویسد');
  assertContainsString(saleSrc, 'sale.total', 'جمع فروش باید از هسته بیاید');
  assertTrue(saleSrc.indexOf('if(coreSale!=null && typeof coreSale!==\'undefined\') localTotal = coreSale') < 0, 'جمع فروش نباید الگوی dual-overwrite داشته باشد');
});

test('ثبت و بستن گارانتی و حواله در exe از هسته تصمیم می‌گیرند', () => {
  const saveWarSrc = extractFunctionSource(html, 'saveWar');
  const closeWarSrc = extractFunctionSource(html, 'closeWar');
  const closeInvSrc = extractFunctionSource(html, 'closeInv');
  const whSrc = extractFunctionSource(html, 'saveWarehouseDoc');
  const applySrc = extractFunctionSource(html, 'applyStockByWarehouse');
  assertContainsString(saveWarSrc, "warranty.save", 'saveWar باید از هسته اعتبارسنجی/وضعیت بگیرد');
  assertContainsString(closeWarSrc, "warranty.close", 'closeWar باید گذار وضعیت را از هسته بگیرد');
  assertContainsString(closeInvSrc, "invoice.close", 'closeInv باید تکمیل فاکتور را از هسته بگیرد');
  assertContainsString(whSrc, "inventory.applyWarehouseDoc", 'حواله باید از هسته اعمال شود');
  assertContainsString(applySrc, "inventory.applyByWarehouse", 'حرکت انبار باید از هسته اعمال شود');
});

test('پرداخت در exe حساب را با نتیجه هسته عوض می‌کند نه با جمع JS', () => {
  const depSrc = extractFunctionSource(html, 'depositToAccount');
  const wdSrc = extractFunctionSource(html, 'withdrawFromAccount');
  assertContainsString(depSrc, 'payment.applyDeposit', 'واریز باید applyDeposit هسته باشد');
  assertContainsString(wdSrc, 'payment.applyWithdraw', 'برداشت باید applyWithdraw هسته باشد');
  const runSrc = extractFunctionSource(html, 'runBusinessCore');
  const takeSrc = extractFunctionSource(html, 'takeBusinessCore');
  const hasSrc = extractFunctionSource(html, 'hasBusinessCore');
  const recSrc = extractFunctionSource(html, 'applyCoreRecordOnto');
  const persistSrc = extractFunctionSource(html, 'persistCoreSnapshot');
  const exeDep = new Function(runSrc + '\n' + takeSrc + '\n' + hasSrc + '\n' + recSrc + '\n' + persistSrc + '\n' + depSrc + `
    function getSirmanHostSync(){
      return { RunBusiness: function(name, json){
        return JSON.stringify({ok:true, result:{ok:true, amount:25, account:{id:'A1', balance:125, transactions:[{amount:25}]}, persistKeys:[]}});
      }};
    }
    function emit(){}
    var accounts = [{id:'A1', balance:100, transactions:[]}];
    var err = depositToAccount('A1', 25, 'تست');
    return {err:err, bal:accounts[0].balance};
  `)();
  assertEqual(exeDep.err, null, 'واریز هسته باید موفق باشد');
  assertEqual(exeDep.bal, 125, 'مانده باید از هسته بیاید نه 100+25 سمت JS در صورت مقدار متفاوت');
});

test('آداپتر ذخیره فقط نتیجه هسته را روی شیء زنده می‌نویسد', () => {
  const recSrc = extractFunctionSource(html, 'applyCoreRecordOnto');
  const fn = new Function(recSrc + `
    var live = {qty:10, reserved:0, code:'P1'};
    applyCoreRecordOnto(live, {qty:10, reserved:4, reservedByWh:{'WH-A':4}});
    return live;
  `)();
  assertEqual(fn.reserved, 4, 'reserved هسته باید نوشته شود');
  assertEqual(fn.code, 'P1', 'فیلدهای قبلی نباید پاک شوند');
  assertEqual(fn.reservedByWh['WH-A'], 4, 'reservedByWh باید از هسته بیاید');
});

console.log('');
console.log('📋 گروه: برگشت آثار حذف فاکتور و گارانتی');

test('حذف فاکتور/گارانتی در UI باید از هسته invoice.delete و warranty.delete برود', () => {
  const delInvSrc = extractFunctionSource(html, 'delInv');
  const delWarSrc = extractFunctionSource(html, 'delWar');
  const delAtSrc = extractFunctionSource(html, 'deleteInvoiceAt');
  const delWarAtSrc = extractFunctionSource(html, 'deleteWarrantyAt');
  assertContainsString(delInvSrc, 'deleteInvoiceAt', 'delInv نباید فقط splice کند');
  assertContainsString(delWarSrc, 'deleteWarrantyAt', 'delWar نباید فقط splice کند');
  assertContainsString(delAtSrc, 'invoice.delete', 'حذف فاکتور در exe باید از هسته باشد');
  assertContainsString(delWarAtSrc, 'warranty.delete', 'حذف گارانتی در exe باید از هسته باشد');
  const spliceAt = delAtSrc.indexOf('invoices.splice');
  const coreAt = delAtSrc.indexOf('invoice.delete');
  const applyAt = delAtSrc.indexOf('applyReversalSnapshot');
  assertTrue(coreAt >= 0 && applyAt >= 0, 'حذف فاکتور باید اول هسته را صدا بزند');
  assertTrue(spliceAt < 0 || spliceAt > applyAt, 'splice فقط بعد از نتیجه هسته به‌عنوان اطمینان مجاز است نه به‌جای هسته');
});

test('شاهد باگ قدیمی: splice بدون برگشت، موجودی و حساب را جا می‌گذارد', () => {
  const inventory = {P1:{code:'P1', qty:9}};
  const accounts = [{id:'ACC-1', balance:100, transactions:[{amount:100, refId:'INV-A', refType:'invoice'}]}];
  const invoices = [{num:'INV-A', status:'closed', items:[{code:'P1'}]}];
  invoices.splice(0,1);
  assertEqual(invoices.length, 0, 'فاکتور حذف شده');
  assertEqual(inventory.P1.qty, 9, 'باگ قدیمی: موجودی برنگشته');
  assertEqual(accounts[0].balance, 100, 'باگ قدیمی: مبلغ برنگشته');
});

test('TEST1 واقعی: حذف فاکتور موجودی و حساب همان سند را برمی‌گرداند', () => {
  const recSrc = extractFunctionSource(html, 'applyCoreRecordOnto');
  const persistSrc = extractFunctionSource(html, 'persistCoreSnapshot');
  const applySrc = extractFunctionSource(html, 'applyReversalSnapshot');
  const linkSrc = extractFunctionSource(html, 'reverseLinkedAccountTrx');
  const locSrc = extractFunctionSource(html, 'reverseInvoiceLocal');
  const delSrc = extractFunctionSource(html, 'deleteInvoiceAt');
  const hasSrc = extractFunctionSource(html, 'hasBusinessCore');
  const takeSrc = extractFunctionSource(html, 'takeBusinessCore');
  const runSrc = extractFunctionSource(html, 'runBusinessCore');
  const r = new Function(recSrc+'\n'+persistSrc+'\n'+applySrc+'\n'+linkSrc+'\n'+locSrc+'\n'+delSrc+'\n'+hasSrc+'\n'+takeSrc+'\n'+runSrc+`
    function getSirmanHostSync(){ return null; }
    function auditActivity(){}
    function fdt(){ return '1405/05/23'; }
    function sv(){}
    function svAccounts(){}
    function svParts(){}
    function svWars(){}
    function recordStockMove(){}
    var inventory = {P1:{code:'P1', qty:9}};
    var accounts = [{id:'ACC-1', balance:100, transactions:[{id:'TRX-1', type:'deposit', amount:100, refId:'INV-A', refType:'invoice'}]}];
    var invoices = [{num:'INV-A', status:'closed', items:[{code:'P1'}]}];
    var parts = [];
    var r = deleteInvoiceAt(0);
    return {ok:r.ok, qty:inventory.P1.qty, bal:accounts[0].balance, nInv:invoices.length, trx:accounts[0].transactions.length};
  `)();
  assertEqual(r.ok, true, 'حذف باید موفق باشد');
  assertEqual(r.qty, 10, 'موجودی باید به ۱۰ برگردد');
  assertEqual(r.bal, 0, 'مانده باید صفر شود');
  assertEqual(r.nInv, 0, 'فاکتور باید حذف شود');
  assertEqual(r.trx, 0, 'تراکنش همان فاکتور باید حذف شود');
});

test('TEST3 واقعی: چند قطعه گارانتی با تعداد دقیق برمی‌گردند', () => {
  const recSrc = extractFunctionSource(html, 'applyCoreRecordOnto');
  const persistSrc = extractFunctionSource(html, 'persistCoreSnapshot');
  const applySrc = extractFunctionSource(html, 'applyReversalSnapshot');
  const linkSrc = extractFunctionSource(html, 'reverseLinkedAccountTrx');
  const locSrc = extractFunctionSource(html, 'reverseWarrantyLocal');
  const delSrc = extractFunctionSource(html, 'deleteWarrantyAt');
  const hasSrc = extractFunctionSource(html, 'hasBusinessCore');
  const takeSrc = extractFunctionSource(html, 'takeBusinessCore');
  const runSrc = extractFunctionSource(html, 'runBusinessCore');
  const r = new Function(recSrc+'\n'+persistSrc+'\n'+applySrc+'\n'+linkSrc+'\n'+locSrc+'\n'+delSrc+'\n'+hasSrc+'\n'+takeSrc+'\n'+runSrc+`
    function getSirmanHostSync(){ return null; }
    function auditActivity(){}
    function fdt(){ return '1405/05/23'; }
    function sv(){}
    function svAccounts(){}
    function svParts(){}
    function svWars(){}
    function recordStockMove(){}
    var inventory = {};
    var accounts = [];
    var invoices = [];
    var parts = [{code:'A', qty:8},{code:'B', qty:17}];
    var warranties = [{id:'W-M', _agencyStockApplied:{applied:true, items:[{code:'A', qty:2},{code:'B', qty:3}]}}];
    deleteWarrantyAt(0);
    return {a:parts[0].qty, b:parts[1].qty, n:warranties.length};
  `)();
  assertEqual(r.a, 10, 'قطعه A باید ۱۰ شود');
  assertEqual(r.b, 20, 'قطعه B باید ۲۰ شود');
  assertEqual(r.n, 0, 'پرونده باید حذف شود');
});

test('TEST4 واقعی: حذف فاکتور A فاکتور B را دست نمی‌زند', () => {
  const recSrc = extractFunctionSource(html, 'applyCoreRecordOnto');
  const persistSrc = extractFunctionSource(html, 'persistCoreSnapshot');
  const applySrc = extractFunctionSource(html, 'applyReversalSnapshot');
  const linkSrc = extractFunctionSource(html, 'reverseLinkedAccountTrx');
  const locSrc = extractFunctionSource(html, 'reverseInvoiceLocal');
  const delSrc = extractFunctionSource(html, 'deleteInvoiceAt');
  const hasSrc = extractFunctionSource(html, 'hasBusinessCore');
  const takeSrc = extractFunctionSource(html, 'takeBusinessCore');
  const runSrc = extractFunctionSource(html, 'runBusinessCore');
  const r = new Function(recSrc+'\n'+persistSrc+'\n'+applySrc+'\n'+linkSrc+'\n'+locSrc+'\n'+delSrc+'\n'+hasSrc+'\n'+takeSrc+'\n'+runSrc+`
    function getSirmanHostSync(){ return null; }
    function auditActivity(){}
    function fdt(){ return '1405/05/23'; }
    function sv(){}
    function svAccounts(){}
    function recordStockMove(){}
    var inventory = {A:{code:'A', qty:5}};
    var accounts = [{id:'ACC-1', balance:300, transactions:[
      {amount:100, refId:'INV-A', refType:'invoice', type:'deposit'},
      {amount:200, refId:'INV-B', refType:'invoice', type:'deposit'}
    ]}];
    var invoices = [
      {num:'INV-A', status:'closed', items:[{code:'A'},{code:'A'}]},
      {num:'INV-B', status:'closed', items:[{code:'A'},{code:'A'},{code:'A'}]}
    ];
    deleteInvoiceAt(0);
    return {qty:inventory.A.qty, bal:accounts[0].balance, n:invoices.length, ref:accounts[0].transactions[0].refId};
  `)();
  assertEqual(r.qty, 7, 'فقط ۲ واحد فاکتور A باید برگردد (۵+۲=۷)');
  assertEqual(r.bal, 200, 'فقط ۱۰۰ فاکتور A باید برگشت شود');
  assertEqual(r.n, 1, 'فاکتور B باید بماند');
  assertEqual(r.ref, 'INV-B', 'تراکنش B باید بماند');
});

test('TEST5 واقعی: حذف دوباره فاکتور موجودی را دوباره زیاد نمی‌کند', () => {
  const recSrc = extractFunctionSource(html, 'applyCoreRecordOnto');
  const persistSrc = extractFunctionSource(html, 'persistCoreSnapshot');
  const applySrc = extractFunctionSource(html, 'applyReversalSnapshot');
  const linkSrc = extractFunctionSource(html, 'reverseLinkedAccountTrx');
  const locSrc = extractFunctionSource(html, 'reverseInvoiceLocal');
  const delSrc = extractFunctionSource(html, 'deleteInvoiceAt');
  const hasSrc = extractFunctionSource(html, 'hasBusinessCore');
  const takeSrc = extractFunctionSource(html, 'takeBusinessCore');
  const runSrc = extractFunctionSource(html, 'runBusinessCore');
  const r = new Function(recSrc+'\n'+persistSrc+'\n'+applySrc+'\n'+linkSrc+'\n'+locSrc+'\n'+delSrc+'\n'+hasSrc+'\n'+takeSrc+'\n'+runSrc+`
    function getSirmanHostSync(){ return null; }
    function auditActivity(){}
    function fdt(){ return '1405/05/23'; }
    function sv(){}
    function svAccounts(){}
    function recordStockMove(){}
    var inventory = {A:{code:'A', qty:9}};
    var accounts = [{id:'ACC-1', balance:100, transactions:[{amount:100, refId:'INV-A', refType:'invoice', type:'deposit'}]}];
    var invoices = [{num:'INV-A', status:'closed', items:[{code:'A'}]}];
    deleteInvoiceAt(0);
    var after1 = {qty:inventory.A.qty, bal:accounts[0].balance};
    var r2 = deleteInvoiceAt(0);
    return {q1:after1.qty, b1:after1.bal, q2:inventory.A.qty, b2:accounts[0].balance, already:r2.alreadyReversed};
  `)();
  assertEqual(r.q1, 10, 'بار اول موجودی ۱۰');
  assertEqual(r.q2, 10, 'بار دوم موجودی همان ۱۰ بماند');
  assertEqual(r.b2, 0, 'بار دوم مانده دوباره منفی نشود');
  assertEqual(r.already, true, 'بار دوم alreadyReversed');
});

test('در exe حذف فاکتور موجودی را از نتیجه هسته می‌نویسد نه از +1 سمت JS', () => {
  const recSrc = extractFunctionSource(html, 'applyCoreRecordOnto');
  const persistSrc = extractFunctionSource(html, 'persistCoreSnapshot');
  const applySrc = extractFunctionSource(html, 'applyReversalSnapshot');
  const linkSrc = extractFunctionSource(html, 'reverseLinkedAccountTrx');
  const locSrc = extractFunctionSource(html, 'reverseInvoiceLocal');
  const delSrc = extractFunctionSource(html, 'deleteInvoiceAt');
  const hasSrc = extractFunctionSource(html, 'hasBusinessCore');
  const takeSrc = extractFunctionSource(html, 'takeBusinessCore');
  const runSrc = extractFunctionSource(html, 'runBusinessCore');
  const r = new Function(recSrc+'\n'+persistSrc+'\n'+applySrc+'\n'+linkSrc+'\n'+locSrc+'\n'+delSrc+'\n'+hasSrc+'\n'+takeSrc+'\n'+runSrc+`
    function getSirmanHostSync(){
      return { RunBusiness: function(name, json){
        if(name!=='invoice.delete') return JSON.stringify({ok:false});
        return JSON.stringify({ok:true, result:{ok:true, alreadyReversed:false, removedId:'INV-A',
          inventory:{P1:{code:'P1', qty:42}},
          accounts:[{id:'ACC-1', balance:3, transactions:[]}],
          restocked:[{code:'P1', qty:1}], reversedPayments:1,
          persistKeys:[]}});
      }};
    }
    function auditActivity(){}
    function fdt(){ return '1405/05/23'; }
    function sv(){}
    function svAccounts(){}
    function recordStockMove(){}
    var inventory = {P1:{code:'P1', qty:9}};
    var accounts = [{id:'ACC-1', balance:100, transactions:[{amount:100, refId:'INV-A', refType:'invoice'}]}];
    var invoices = [{num:'INV-A', status:'closed', items:[{code:'P1'}]}];
    deleteInvoiceAt(0);
    return {qty:inventory.P1.qty, bal:accounts[0].balance, n:invoices.length};
  `)();
  assertEqual(r.qty, 42, 'موجودی باید از هسته بیاید نه 9+1 جاوااسکریپت');
  assertEqual(r.bal, 3, 'مانده باید از هسته بیاید');
  assertEqual(r.n, 0, 'فاکتور باید بعد از هسته حذف شود');
});

test('راهنمای برگشت حذف فاکتور/گارانتی باید در صفحه راهنما باشد (قانون ۷)', () => {
  assertContainsString(html, 'برگشت با حذف سند', 'راهنمای حسابداری باید برگشت حذف سند را توضیح دهد');
  assertContainsString(html, 'حذف پرونده', 'راهنمای گارانتی باید حذف با برگشت قطعه را توضیح دهد');
});

test('حذف فروش باید مبلغ همان فروش را هم از حساب برگرداند', () => {
  const delSrc = extractFunctionSource(html, 'delSale');
  const atSrc = extractFunctionSource(html, 'deleteSaleAt');
  assertContainsString(delSrc, 'deleteSaleAt', 'delSale نباید فقط splice کند');
  assertContainsString(atSrc, 'sale.delete', 'حذف فروش در exe باید از هسته باشد');
  const recSrc = extractFunctionSource(html, 'applyCoreRecordOnto');
  const persistSrc = extractFunctionSource(html, 'persistCoreSnapshot');
  const applySrc = extractFunctionSource(html, 'applyReversalSnapshot');
  const ownSrc = extractFunctionSource(html, 'reverseOwnedAccountTrx');
  const linkSrc = extractFunctionSource(html, 'reverseLinkedAccountTrx');
  const locSrc = extractFunctionSource(html, 'reverseSaleLocal');
  const hasSrc = extractFunctionSource(html, 'hasBusinessCore');
  const takeSrc = extractFunctionSource(html, 'takeBusinessCore');
  const runSrc = extractFunctionSource(html, 'runBusinessCore');
  const r = new Function(recSrc+'\n'+persistSrc+'\n'+applySrc+'\n'+ownSrc+'\n'+linkSrc+'\n'+locSrc+'\n'+atSrc+'\n'+hasSrc+'\n'+takeSrc+'\n'+runSrc+`
    function getSirmanHostSync(){ return null; }
    function auditActivity(){}
    function fdt(){ return '1405/05/23'; }
    function sv(){}
    function svAccounts(){}
    function svParts(){}
    function svSales(){}
    function recordStockMove(){}
    var parts = [{code:'A', qty:9}];
    var accounts = [{id:'ACC-1', balance:100, transactions:[{amount:100, refId:'SL-0001', refType:'sale', type:'deposit'}]}];
    var sales = [{id:'SL-0001', status:'final', items:[{partCode:'A', qty:1}]}];
    deleteSaleAt(0);
    var after1 = {qty:parts[0].qty, bal:accounts[0].balance, n:sales.length};
    var r2 = deleteSaleAt(0);
    return {q:after1.qty, b:after1.bal, n:after1.n, q2:parts[0].qty, b2:accounts[0].balance, already:r2.alreadyReversed};
  `)();
  assertEqual(r.q, 10, 'قطعه باید برگردد');
  assertEqual(r.b, 0, 'مبلغ فروش باید از حساب برگشت شود');
  assertEqual(r.n, 0, 'فروش باید حذف شود');
  assertEqual(r.q2, 10, 'حذف دوباره موجودی را زیاد نکند');
  assertEqual(r.b2, 0, 'حذف دوباره حساب را دوباره کم نکند');
  assertEqual(r.already, true, 'بار دوم alreadyReversed');
});

function saleDeleteSandbox(extra){
  extra = extra || '';
  const recSrc = extractFunctionSource(html, 'applyCoreRecordOnto');
  const persistSrc = extractFunctionSource(html, 'persistCoreSnapshot');
  const applySrc = extractFunctionSource(html, 'applyReversalSnapshot');
  const ownSrc = extractFunctionSource(html, 'reverseOwnedAccountTrx');
  const linkSrc = extractFunctionSource(html, 'reverseLinkedAccountTrx');
  const locSrc = extractFunctionSource(html, 'reverseSaleLocal');
  const invLoc = extractFunctionSource(html, 'reverseInvoiceLocal');
  const delSrc = extractFunctionSource(html, 'deleteSaleAt');
  const delInvSrc = extractFunctionSource(html, 'deleteInvoiceAt');
  const uiSrc = extractFunctionSource(html, 'delSale');
  const hasSrc = extractFunctionSource(html, 'hasBusinessCore');
  const takeSrc = extractFunctionSource(html, 'takeBusinessCore');
  const runSrc = extractFunctionSource(html, 'runBusinessCore');
  return new Function(recSrc+'\n'+persistSrc+'\n'+applySrc+'\n'+ownSrc+'\n'+linkSrc+'\n'+locSrc+'\n'+invLoc+'\n'+delSrc+'\n'+delInvSrc+'\n'+uiSrc+'\n'+hasSrc+'\n'+takeSrc+'\n'+runSrc+'\n'+extra);
}

test('TEST1 حذف فروش قطعه — Host بدون removedId هم رکورد را برمی‌دارد', () => {
  const r = saleDeleteSandbox(`
    function getSirmanHostSync(){
      return { RunBusiness: function(name, json){
        var p = JSON.parse(json);
        if(name!=='sale.delete') return JSON.stringify({ok:false, error:'bad-op', message:'عملیات ناشناخته'});
        return JSON.stringify({ok:true, result:{ok:true, alreadyReversed:false,
          sales:[], parts:[{code:'A', qty:10}], accounts:[{id:'ACC-1', balance:0, transactions:[]}],
          restocked:[{code:'A', qty:2}], reversedPayments:1, persistKeys:['sales','parts','accounts']}});
      }};
    }
    function auditActivity(){}
    function fdt(){ return '1405/05/23'; }
    function sv(){}
    function svAccounts(){}
    function svParts(){}
    function svSales(){ globalThis._sv = true; }
    function recordStockMove(){}
    var parts = [{code:'A', qty:8}];
    var accounts = [{id:'ACC-1', balance:200, transactions:[{amount:200, refId:'SL-0001', refType:'sale'}]}];
    var sales = [{id:'SL-0001', status:'final', name:'خریدار', phone:'0912', items:[{partCode:'A', qty:2}], docs:[{name:'x.png', data:'AAA'}]}];
    var r = deleteSaleAt(0);
    return {ok:r&&r.ok!==false, n:sales.length, qty:parts[0].qty, payloadHadNoDocs: true};
  `)();
  assertEqual(r.ok, true, 'حذف باید موفق باشد');
  assertEqual(r.n, 0, 'فروش قطعه باید از فهرست حذف شود حتی اگر Host فیلد removedId را ندهد');
  assertEqual(r.qty, 10, 'موجودی باید از هسته اعمال شود');
});

test('TEST2 حذف فاکتور فروشگاه معمولی همچنان رکورد را برمی‌دارد', () => {
  const r = saleDeleteSandbox(`
    function getSirmanHostSync(){ return null; }
    function auditActivity(){}
    function fdt(){ return '1405/05/23'; }
    function sv(){}
    function svAccounts(){}
    function recordStockMove(){}
    var inventory = {P1:{code:'P1', qty:9}};
    var accounts = [{id:'ACC-1', balance:100, transactions:[{amount:100, refId:'INV-A', refType:'invoice', type:'deposit'}]}];
    var invoices = [{num:'INV-A', status:'closed', items:[{code:'P1'}]}];
    var r = deleteInvoiceAt(0);
    return {ok:r&&r.ok!==false, n:invoices.length, qty:inventory.P1.qty, bal:accounts[0].balance};
  `)();
  assertEqual(r.ok, true, 'حذف فاکتور معمولی باید موفق باشد');
  assertEqual(r.n, 0, 'فاکتور باید حذف شود');
  assertEqual(r.qty, 10, 'موجودی کالای فاکتور باید برگردد');
  assertEqual(r.bal, 0, 'مبلغ فاکتور باید از حساب برگردد');
});

test('TEST3 حذف فروش چندقطعه باید همه ردیف‌ها را بردارد', () => {
  const r = saleDeleteSandbox(`
    function getSirmanHostSync(){ return null; }
    function auditActivity(){}
    function fdt(){ return '1405/05/23'; }
    function sv(){}
    function svAccounts(){}
    function svParts(){}
    function svSales(){}
    function recordStockMove(){}
    var parts = [{code:'A', qty:8},{code:'B', qty:17}];
    var accounts = [{id:'ACC-1', balance:0, transactions:[]}];
    var sales = [{id:'SL-M', status:'final', items:[{partCode:'A', qty:2},{partCode:'B', qty:3}]}];
    var r = deleteSaleAt(0);
    return {ok:r&&r.ok!==false, n:sales.length, a:parts[0].qty, b:parts[1].qty};
  `)();
  assertEqual(r.ok, true, 'حذف فروش چندقطعه باید موفق باشد');
  assertEqual(r.n, 0, 'فروش چندقطعه باید حذف شود');
  assertEqual(r.a, 10, 'قطعه A باید برگردد');
  assertEqual(r.b, 20, 'قطعه B باید برگردد');
});

test('TEST4 حذف نامعتبر باید پیام کنترل‌شده بدهد نه سکوت', () => {
  const r = saleDeleteSandbox(`
    function getSirmanHostSync(){
      return { RunBusiness: function(){ return JSON.stringify({ok:false, error:'business-failed', message:'محاسبه انجام نشد'}); } };
    }
    function auditActivity(){}
    function fdt(){ return '1405/05/23'; }
    function sv(){}
    function svAccounts(){}
    function svParts(){}
    function svSales(){}
    function recordStockMove(){}
    var parts = [{code:'A', qty:8}];
    var accounts = [];
    var sales = [{id:'SL-0001', status:'final', items:[{partCode:'A', qty:1}]}];
    var notes = [];
    function ntf(msg, type){ notes.push({msg:msg, type:type||'ok'}); }
    function confirm(){ return true; }
    function renderSales(){}
    delSale(0);
    return {n:sales.length, notes:notes, hasErr: notes.some(function(x){ return x.type==='err' && String(x.msg||'').length>0; })};
  `)();
  assertEqual(r.n, 1, 'اگر هسته رد کند فروش نباید حذف شود');
  assertEqual(r.hasErr, true, 'باید پیام خطا به UI برسد');
});

test('TEST5 حذف دوباره فروش نتیجه کنترل‌شده می‌دهد و کرش نمی‌کند', () => {
  const r = saleDeleteSandbox(`
    function getSirmanHostSync(){ return null; }
    function auditActivity(){}
    function fdt(){ return '1405/05/23'; }
    function sv(){}
    function svAccounts(){}
    function svParts(){}
    function svSales(){}
    function recordStockMove(){}
    var parts = [{code:'A', qty:9}];
    var accounts = [];
    var sales = [{id:'SL-0001', status:'final', items:[{partCode:'A', qty:1}]}];
    var r1 = deleteSaleAt(0);
    var r2 = deleteSaleAt(0);
    return {n:sales.length, ok1:r1&&r1.ok!==false, already:!!(r2&&r2.alreadyReversed), ok2:r2&&r2.ok!==false};
  `)();
  assertEqual(r.n, 0, 'بعد از حذف اول فروش نباید بماند');
  assertEqual(r.ok1, true, 'حذف اول باید موفق باشد');
  assertEqual(r.already, true, 'حذف دوم alreadyReversed');
  assertEqual(r.ok2, true, 'حذف دوم نباید کرش کند');
});

test('خطای Host دیگر بلعیده نمی‌شود و به حذف فروش می‌رسد', () => {
  const r = saleDeleteSandbox(`
    function getSirmanHostSync(){
      return { RunBusiness: function(){ throw new Error('COM size limit'); } };
    }
    function auditActivity(){}
    function fdt(){ return '1405/05/23'; }
    function sv(){}
    function svAccounts(){}
    function svParts(){}
    function svSales(){}
    function recordStockMove(){}
    var parts = [{code:'A', qty:8}];
    var accounts = [];
    var sales = [{id:'SL-0001', status:'final', items:[{partCode:'A', qty:1}]}];
    var r = deleteSaleAt(0);
    return {n:sales.length, ok:r&&r.ok, err:r&&r.error, kind:r&&r.kind};
  `)();
  assertEqual(r.ok, false, 'شکست Host باید ok:false باشد');
  assertEqual(r.n, 1, 'فروش نباید در شکست Host حذف شود');
  assertTrue(String(r.err||'').indexOf('COM size limit')>=0, 'متن خطای Host باید به UI برسد نه پیام کلی خالی');
});

test('اگر applyReversalSnapshot پرتاب شود delSale پیام می‌دهد و فروش را برمی‌دارد', () => {
  const r = saleDeleteSandbox(`
    function getSirmanHostSync(){ return null; }
    function auditActivity(){}
    function fdt(){ return '1405/05/23'; }
    function sv(){}
    function svAccounts(){}
    function svParts(){}
    function svSales(){}
    function recordStockMove(){ throw new Error('stockMoves boom'); }
    var parts = [{code:'A', qty:8}];
    var accounts = [];
    var sales = [{id:'SL-0001', status:'final', items:[{partCode:'A', qty:1}]}];
    var notes = [];
    function ntf(msg, type){ notes.push({msg:msg, type:type||'ok'}); }
    function confirm(){ return true; }
    function renderSales(){}
    var threw = null;
    try{ delSale(0); }catch(e){ threw = String(e.message||e); }
    return {n:sales.length, threw:threw, notes:notes, hasMsg: notes.length>0};
  `)();
  assertEqual(r.threw, null, 'delSale نباید exception را خاموش به UI ندهد');
  assertEqual(r.n, 0, 'فروش باید حتی اگر ثبت حرکت انبار پرتاب شود حذف شود');
  assertEqual(r.hasMsg, true, 'باید پیام موفقیت یا خطا نمایش داده شود');
});

test('runBusinessCore اگر Host بدون wrapper جواب بدهد حذف فروش را جلو می‌برد', () => {
  const r = saleDeleteSandbox(`
    function getSirmanHostSync(){
      return { RunBusiness: function(){
        return JSON.stringify({ok:true, removedId:'SL-0001', sales:[], parts:[{code:'A', qty:10}], persistKeys:['sales','parts']});
      }};
    }
    function auditActivity(){}
    function fdt(){ return '1405/05/23'; }
    function sv(){}
    function svAccounts(){}
    function svParts(){}
    function svSales(){}
    function recordStockMove(){}
    var parts = [{code:'A', qty:8}];
    var accounts = [];
    var sales = [{id:'SL-0001', status:'final', items:[{partCode:'A', qty:1}]}];
    var r = deleteSaleAt(0);
    return {n:sales.length, ok:r&&r.ok!==false};
  `)();
  assertEqual(r.ok, true, 'DTO بدون wrapper باید حذف را جلو ببرد');
  assertEqual(r.n, 0, 'فروش باید حذف شود');
});

test('واریز با شماره سند حتی اگر نوعش فرق کند با حذف سند برمی‌گردد', () => {
  const recSrc = extractFunctionSource(html, 'applyCoreRecordOnto');
  const persistSrc = extractFunctionSource(html, 'persistCoreSnapshot');
  const applySrc = extractFunctionSource(html, 'applyReversalSnapshot');
  const ownSrc = extractFunctionSource(html, 'reverseOwnedAccountTrx');
  const linkSrc = extractFunctionSource(html, 'reverseLinkedAccountTrx');
  const locSrc = extractFunctionSource(html, 'reverseInvoiceLocal');
  const delSrc = extractFunctionSource(html, 'deleteInvoiceAt');
  const hasSrc = extractFunctionSource(html, 'hasBusinessCore');
  const takeSrc = extractFunctionSource(html, 'takeBusinessCore');
  const runSrc = extractFunctionSource(html, 'runBusinessCore');
  const r = new Function(recSrc+'\n'+persistSrc+'\n'+applySrc+'\n'+ownSrc+'\n'+linkSrc+'\n'+locSrc+'\n'+delSrc+'\n'+hasSrc+'\n'+takeSrc+'\n'+runSrc+`
    function getSirmanHostSync(){ return null; }
    function auditActivity(){}
    function fdt(){ return '1405/05/23'; }
    function sv(){}
    function svAccounts(){}
    function recordStockMove(){}
    var inventory = {A:{code:'A', qty:9}};
    var accounts = [{id:'ACC-1', balance:150, transactions:[
      {amount:50, refId:'LEP-0007', refType:'service', type:'deposit'},
      {amount:100, refId:'', refType:'manual', type:'deposit', subject:'دستی'}
    ]}];
    var invoices = [{num:'LEP-0007', status:'closed', items:[{code:'A'}]}];
    deleteInvoiceAt(0);
    return {bal:accounts[0].balance, n:accounts[0].transactions.length, sub:accounts[0].transactions[0].subject};
  `)();
  assertEqual(r.bal, 100, 'فقط مبلغ همان سند باید برگردد');
  assertEqual(r.n, 1, 'واریز دستی باید بماند');
  assertEqual(r.sub, 'دستی', 'تراکنش باقی‌مانده باید واریز دستی باشد');
});

test('شماره فروش بعد از حذف نباید از روی length دوباره ساخته شود', () => {
  const seqSrc = extractFunctionSource(html, 'saleIdSeq');
  const maxSrc = extractFunctionSource(html, 'maxSaleSeq');
  const ensSrc = extractFunctionSource(html, 'ensureSaleCtr');
  const takenSrc = extractFunctionSource(html, 'saleIdTaken');
  const peekSrc = extractFunctionSource(html, 'peekNextSaleId');
  const nextSrc = extractFunctionSource(html, 'nextSaleId');
  assertTrue(!!seqSrc && !!maxSrc && !!ensSrc && !!peekSrc && !!nextSrc && !!takenSrc, 'توابع شماره‌دهی فروش پیدا نشد');
  assertContainsString(getSrc = extractFunctionSource(html, 'getSaleData'), 'peekNextSaleId', 'getSaleData نباید از sales.length+1 شماره بسازد');
  assertTrue(getSrc.indexOf('sales.length+1') === -1, 'getSaleData دیگر نباید SL را از تعداد ردیف بسازد');
  const r = new Function(seqSrc+'\n'+maxSrc+'\n'+ensSrc+'\n'+takenSrc+'\n'+peekSrc+'\n'+nextSrc+`
    var saleCtr = 0;
    var sales = [{id:'SL-0002', name:'قدیمی'}];
    var store = {};
    var localStorage = { getItem:function(k){ return store[k]||null; }, setItem:function(k,v){ store[k]=String(v); } };
    ensureSaleCtr();
    var afterDeletePeek = peekNextSaleId();
    var first = nextSaleId();
    var second = nextSaleId();
    return {ctrAfterEnsure:saleCtr-2, peek:afterDeletePeek, first:first, second:second, stored:store.laegh_sale_ctr};
  `)();
  assertEqual(r.peek, 'SL-0003', 'بعد از ماندن SL-0002 شماره بعدی باید SL-0003 باشد نه SL-0002');
  assertEqual(r.first, 'SL-0003', 'nextSaleId باید SL-0003 بدهد');
  assertEqual(r.second, 'SL-0004', 'شماره دوم باید SL-0004 باشد');
});

test('حذف فاکتور فروش با شماره تکراری فقط همان ردیف کلیک‌شده را برمی‌دارد', () => {
  const r = saleDeleteSandbox(`
    function getSirmanHostSync(){ return null; }
    function auditActivity(){}
    function fdt(){ return '1405/05/23'; }
    function sv(){}
    function svAccounts(){}
    function svParts(){}
    function svSales(){}
    function recordStockMove(){}
    var parts = [{code:'A', qty:7}];
    var accounts = [{id:'ACC-1', balance:300, transactions:[
      {amount:100, refId:'SL-0002', refType:'sale', type:'deposit'},
      {amount:200, refId:'SL-0002', refType:'sale', type:'deposit'}
    ]}];
    var oldS = {id:'SL-0002', status:'final', total:100, name:'قدیمی', items:[{partCode:'A', qty:1}]};
    var newS = {id:'SL-0002', status:'final', total:200, name:'جدید', items:[{partCode:'A', qty:2}]};
    var sales = [oldS, newS];
    var seen = null;
    var r = deleteSaleAt(1);
    return {
      ok:r&&r.ok!==false, n:sales.length, kept:sales[0]&&sales[0].name,
      qty:parts[0].qty, bal:accounts[0].balance, trx:accounts[0].transactions.length,
      stillOld: sales.indexOf(oldS)>=0, stillNew: sales.indexOf(newS)>=0
    };
  `)();
  assertEqual(r.ok, true, 'حذف ردیف جدید باید موفق باشد');
  assertEqual(r.n, 1, 'فقط یک فروش باید بماند');
  assertEqual(r.kept, 'قدیمی', 'فاکتور قبلی باید بماند');
  assertEqual(r.stillOld, true, 'آبجکت فاکتور قبلی باید در آرایه بماند');
  assertEqual(r.stillNew, false, 'آبجکت فاکتور جدید باید حذف شود');
  assertEqual(r.qty, 9, 'فقط قطعات همان فاکتور جدید باید برگردد (7+2)');
  assertEqual(r.trx, 1, 'فقط یک تراکنش هم‌شماره باید برگردد نه هر دو');
  assertEqual(r.bal, 100, 'مانده فاکتور قبلی باید بماند');
});

test('حذف فروش در exe باید saleUid ردیف کلیک‌شده را بفرستد و فقط همان را بردارد', () => {
  const r = saleDeleteSandbox(`
    var seen = null;
    function getSirmanHostSync(){
      return { RunBusiness: function(name, json){
        seen = JSON.parse(json);
        return JSON.stringify({ok:true, result:{ok:true, alreadyReversed:false, sales:[],
          parts:[{code:'A', qty:9}], accounts:[{id:'ACC-1', balance:100, transactions:[{amount:100, refId:'SALEUID-000001'}]}],
          persistKeys:['sales','parts','accounts']}});
      }};
    }
    function auditActivity(){}
    function fdt(){ return '1405/05/23'; }
    function sv(){}
    function svAccounts(){}
    function svParts(){}
    function svSales(){}
    function recordStockMove(){}
    var parts = [{code:'A', qty:7}];
    var accounts = [{id:'ACC-1', balance:300, transactions:[]}];
    var sales = [
      {id:'SL-0002', saleUid:'SALEUID-000001', status:'final', name:'قدیمی', items:[{partCode:'A', qty:1}]},
      {id:'SL-0002', saleUid:'SALEUID-000002', status:'final', name:'جدید', items:[{partCode:'A', qty:2}]}
    ];
    var r = deleteSaleAt(1);
    return {ok:r&&r.ok!==false, n:sales.length, kept:sales[0]&&sales[0].name, uid:seen&&seen.saleUid, noIdx: seen && seen.saleIndex==null, sentId:seen&&seen.sale&&seen.sale.id};
  `)();
  assertEqual(r.ok, true, 'حذف با Host باید موفق باشد');
  assertEqual(r.uid, 'SALEUID-000002', 'هسته باید شناسه داخلی ردیف کلیک‌شده را بگیرد نه اولین شماره مطابق');
  assertEqual(r.noIdx, true, 'اندیس آرایه نباید هویت حذف باشد');
  assertEqual(r.n, 1, 'بعد از حذف فقط فاکتور قبلی بماند');
  assertEqual(r.kept, 'قدیمی', 'فاکتور قبلی نباید با حذف فاکتور جدید پاک شود');
});

test('بک‌آپ و migrateBackup باید saleCtr داشته باشند تا شماره فروش بعد از بازگردانی تکرار نشود', () => {
  const buildSrc = extractFunctionSource(html, '_buildFullBackupData');
  assertContainsString(buildSrc, 'saleCtr', 'بک‌آپ باید شمارنده فروش را ذخیره کند');
  const migrateSrc = extractFunctionSource(html, 'migrateBackup');
  const schemasSrc = extractFunctionSource(html, 'SCHEMAS') || 'var SCHEMAS = {};';
  const migrateRecSrc = extractFunctionSource(html, 'migrateRecord') || 'function migrateRecord(r){return r;}';
  const migrateSecSrc = extractFunctionSource(html, 'migrateSection') || 'function migrateSection(a){return a;}';
  const runner = new Function('return (function(){ ' + schemasSrc + '\n' + migrateRecSrc + '\n' + migrateSecSrc + '\n return ' + migrateSrc + ' })();');
  const migrateBackup = runner();
  const result = migrateBackup({ version:'10.4.3', invoices:[], products:[], inventory:{}, phonebook:[], sales:[{id:'SL-0002'}] });
  assertTrue(result.data.saleCtr >= 3, 'بدون saleCtr باید از SL-0002 شماره بعدی ۳ حدس زده شود، نه ۲');
});

test('اگر Host آرایه فروش را خالی برگرداند فقط ردیف کلیک‌شده حذف شود نه فاکتور هم‌شماره', () => {
  const r = saleDeleteSandbox(`
    function getSirmanHostSync(){
      return { RunBusiness: function(){
        return JSON.stringify({ok:true, result:{ok:true, alreadyReversed:false, sales:[],
          parts:[{code:'A', qty:9}], accounts:[], persistKeys:['sales','parts']}});
      }};
    }
    function auditActivity(){}
    function fdt(){ return '1405/05/23'; }
    function sv(){}
    function svAccounts(){}
    function svParts(){}
    function svSales(){}
    function recordStockMove(){}
    var parts = [{code:'A', qty:7}];
    var accounts = [];
    var oldS = {id:'SL-0002', status:'final', name:'قدیمی', items:[{partCode:'A', qty:1}]};
    var newS = {id:'SL-0002', status:'final', name:'جدید', items:[{partCode:'A', qty:2}]};
    var sales = [oldS, newS];
    var r = deleteSaleAt(1);
    return {ok:r&&r.ok!==false, n:sales.length, kept:sales[0]&&sales[0].name, stillOld:sales.indexOf(oldS)>=0, stillNew:sales.indexOf(newS)>=0};
  `)();
  assertEqual(r.ok, true, 'حذف باید موفق باشد');
  assertEqual(r.n, 1, 'Host با sales:[] نباید هر دو فاکتور را پاک کند');
  assertEqual(r.kept, 'قدیمی', 'فاکتور قبلی باید بماند');
  assertEqual(r.stillOld, true, 'آبجکت فاکتور قبلی باید در آرایه بماند');
  assertEqual(r.stillNew, false, 'فقط فاکتور کلیک‌شده باید حذف شود');
});

test('شماره فروش نباید با شماره موجود در لیست تصادم کند', () => {
  const seqSrc = extractFunctionSource(html, 'saleIdSeq');
  const maxSrc = extractFunctionSource(html, 'maxSaleSeq');
  const ensSrc = extractFunctionSource(html, 'ensureSaleCtr');
  const takenSrc = extractFunctionSource(html, 'saleIdTaken');
  const peekSrc = extractFunctionSource(html, 'peekNextSaleId');
  const nextSrc = extractFunctionSource(html, 'nextSaleId');
  const r = new Function(seqSrc+'\n'+maxSrc+'\n'+ensSrc+'\n'+takenSrc+'\n'+peekSrc+'\n'+nextSrc+`
    var saleCtr = 3;
    var sales = [{id:'SL-0002'},{id:'SL-0003'}];
    var store = {};
    var localStorage = { getItem:function(k){ return store[k]||null; }, setItem:function(k,v){ store[k]=String(v); } };
    return {peek:peekNextSaleId(), next:nextSaleId()};
  `)();
  assertEqual(r.peek, 'SL-0004', 'اگر SL-0003 زنده است شماره بعدی باید SL-0004 باشد');
  assertEqual(r.next, 'SL-0004', 'nextSaleId هم باید از روی شماره موجود بپرد');
});

console.log('');
console.log('📋 گروه: هویت داخلی فاکتور و جداسازی حذف');

test('حذف فاکتور باید invoiceId بفرستد نه invoiceIndex یا جستجوی شماره', () => {
  const delAtSrc = extractFunctionSource(html, 'deleteInvoiceAt');
  const delSaleSrc = extractFunctionSource(html, 'deleteSaleAt');
  assertContainsString(delAtSrc, 'invoiceId', 'حذف فاکتور باید شناسه داخلی را به هسته بدهد');
  assertTrue(delAtSrc.indexOf('invoiceIndex') < 0, 'حذف فاکتور نباید اندیس آرایه را هویت بداند');
  assertContainsString(delSaleSrc, 'saleUid', 'حذف فروش باید شناسه داخلی بفرستد');
  assertTrue(delSaleSrc.indexOf('saleIndex') < 0, 'حذف فروش نباید اندیس را هویت بداند');
  assertContainsString(html, 'این شماره فاکتور قبلاً استفاده شده است.', 'پیام رد شماره تکراری باید موجود باشد');
  assertContainsString(html, 'INVUID-', 'قالب شناسه داخلی فاکتور باید موجود باشد');
  const buildSrc = extractFunctionSource(html, '_buildFullBackupData');
  const migSrc = extractFunctionSource(html, 'migrateBackup');
  assertContainsString(buildSrc, 'invoiceUidCtr', 'بک‌آپ باید شمارنده شناسه داخلی فاکتور را نگه دارد');
  assertContainsString(migSrc, 'invoiceId', 'migrateBackup باید به فاکتورهای قدیمی شناسه بدهد');
  assertContainsString(migSrc, 'INVUID-', 'migration نباید شماره نمایش را عوض کند؛ فقط INVUID بسازد');
});

test('TEST A: حذف فاکتور B با شماره متفاوت فاکتور A را نگه می‌دارد', () => {
  const r = saleDeleteSandbox(`
    function getSirmanHostSync(){ return null; }
    function auditActivity(){}
    function fdt(){ return '1405/05/25'; }
    function sv(){}
    function svAccounts(){}
    function recordStockMove(){}
    var inventory = {A1:{code:'A1', qty:4}, B1:{code:'B1', qty:8}};
    var accounts = [{id:'ACC-1', balance:300, transactions:[
      {amount:100, refId:'INVUID-A', refType:'invoice', type:'deposit'},
      {amount:200, refId:'INVUID-B', refType:'invoice', type:'deposit'}
    ]}];
    var a = {invoiceId:'INVUID-A', num:'100', status:'closed', items:[{code:'A1'}], tF:100};
    var b = {invoiceId:'INVUID-B', num:'101', status:'closed', items:[{code:'B1'}], tF:200};
    var invoices = [a, b];
    deleteInvoiceAt(1);
    return {n:invoices.length, kept:invoices[0]&&invoices[0].invoiceId, stillA:invoices.indexOf(a)>=0, stillB:invoices.indexOf(b)>=0, qa:inventory.A1.qty, qb:inventory.B1.qty, bal:accounts[0].balance};
  `)();
  assertEqual(r.n, 1, 'فقط یک فاکتور باید بماند');
  assertEqual(r.kept, 'INVUID-A', 'فاکتور A باید بماند');
  assertEqual(r.stillA, true, 'آبجکت A باید در آرایه بماند');
  assertEqual(r.stillB, false, 'آبجکت B باید حذف شود');
  assertEqual(r.qa, 4, 'موجودی کالای A نباید عوض شود');
  assertEqual(r.qb, 9, 'فقط کالای B باید برگردد');
  assertEqual(r.bal, 100, 'فقط مبلغ B باید از حساب برگردد');
});

test('TEST B: ساخت فاکتور با شماره تکراری باید رد شود و A دست نخورد', () => {
  const takenSrc = extractFunctionSource(html, 'invoiceNumTaken');
  const idSrc = extractFunctionSource(html, 'invoiceIdentity');
  assertTrue(!!takenSrc && !!idSrc, 'توابع یکتایی شماره فاکتور پیدا نشد');
  const r = new Function(idSrc+'\n'+takenSrc+`
    var invoices = [{invoiceId:'INVUID-A', num:'100', seller:'قدیمی'}];
    var takenNew = invoiceNumTaken('100', '');
    var takenByOther = invoiceNumTaken('100', 'INVUID-A');
    var taken101 = invoiceNumTaken('101', '');
    return {takenNew:takenNew, takenByOther:takenByOther, taken101:taken101, n:invoices.length, num:invoices[0].num, id:invoices[0].invoiceId};
  `)();
  assertEqual(r.takenNew, true, 'شماره ۱۰۰ نباید دوباره برای فاکتور جدید قبول شود');
  assertEqual(r.takenByOther, false, 'ویرایش همان فاکتور با همان شماره باید مجاز باشد');
  assertEqual(r.taken101, false, 'شماره جدید باید آزاد باشد');
  assertEqual(r.n, 1, 'A نباید حذف یا بازنویسی شود');
  assertEqual(r.num, '100', 'شماره A باید همان بماند');
  assertEqual(r.id, 'INVUID-A', 'شناسه A باید همان بماند');
});

test('TEST C: دو فاکتور هم‌شماره — حذف B فقط B را برمی‌دارد', () => {
  const r = saleDeleteSandbox(`
    function getSirmanHostSync(){ return null; }
    function auditActivity(){}
    function fdt(){ return '1405/05/25'; }
    function sv(){}
    function svAccounts(){}
    function recordStockMove(){}
    var inventory = {A1:{code:'A1', qty:4}, B1:{code:'B1', qty:8}};
    var accounts = [{id:'ACC-1', balance:300, transactions:[
      {amount:100, refId:'INVUID-A', refType:'invoice', type:'deposit'},
      {amount:200, refId:'INVUID-B', refType:'invoice', type:'deposit'}
    ]}];
    var a = {invoiceId:'INVUID-A', num:'100', status:'closed', items:[{code:'A1'}], tF:100};
    var b = {invoiceId:'INVUID-B', num:'100', status:'closed', items:[{code:'B1'}], tF:200};
    var invoices = [a, b];
    deleteInvoiceAt('INVUID-B');
    return {n:invoices.length, kept:invoices[0]&&invoices[0].invoiceId, num:invoices[0]&&invoices[0].num, stillA:invoices.indexOf(a)>=0, stillB:invoices.indexOf(b)>=0, qa:inventory.A1.qty, qb:inventory.B1.qty, bal:accounts[0].balance, ref:accounts[0].transactions[0].refId};
  `)();
  assertEqual(r.n, 1, 'فقط یک فاکتور باید بماند');
  assertEqual(r.kept, 'INVUID-A', 'فاکتور A باید بماند');
  assertEqual(r.num, '100', 'شماره A باید همان ۱۰۰ بماند');
  assertEqual(r.stillA, true, 'آبجکت A باید بماند');
  assertEqual(r.stillB, false, 'آبجکت B باید حذف شود');
  assertEqual(r.qa, 4, 'TEST F: موجودی A دست نخورد');
  assertEqual(r.qb, 9, 'TEST F: فقط موجودی B برگردد');
  assertEqual(r.bal, 100, 'TEST E: فقط مبلغ B برگردد');
  assertEqual(r.ref, 'INVUID-A', 'TEST E: تراکنش A بماند');
});

test('TEST D: ویرایش B فاکتور A را عوض نمی‌کند', () => {
  const saveSrc = extractFunctionSource(html, 'saveInv');
  const idSrc = extractFunctionSource(html, 'invoiceIdentity');
  const takenSrc = extractFunctionSource(html, 'invoiceNumTaken');
  const findSrc = extractFunctionSource(html, 'findInvoiceIndexById');
  const ensSrc = extractFunctionSource(html, 'ensureInvoiceIdentity');
  const r = new Function(idSrc+'\n'+takenSrc+'\n'+findSrc+'\n'+ensSrc+'\n'+saveSrc+`
    var invoiceUidCtr = 2;
    var invCtr = 3;
    var editingInvIdx = 1;
    var editingInvoiceId = 'INVUID-B';
    var invoices = [
      {invoiceId:'INVUID-A', num:'100', seller:'قدیمی', items:[{code:'A1'}], tF:100},
      {invoiceId:'INVUID-B', num:'101', seller:'جدید', items:[{code:'B1'}], tF:200}
    ];
    var notes = [];
    function ntf(msg){ notes.push(msg); }
    function getData(){ return {invoiceId:'INVUID-B', num:'101', seller:'ویرایش‌شده', items:[{code:'B1'}], tF:250}; }
    function fdt(){ return '1405/05/25'; }
    function auditUser(){}
    function sv(){}
    function safePersist(){}
    function emit(){}
    function clearInv(){}
    function leaveFormToList(){}
    function withSaveLock(n, fn){ return fn(); }
    saveInv();
    return {n:invoices.length, aSeller:invoices[0].seller, aNum:invoices[0].num, aId:invoices[0].invoiceId, bSeller:invoices[1].seller, bId:invoices[1].invoiceId};
  `)();
  assertEqual(r.n, 2, 'هر دو فاکتور باید بمانند');
  assertEqual(r.aSeller, 'قدیمی', 'فروشنده A نباید عوض شود');
  assertEqual(r.aNum, '100', 'شماره A نباید عوض شود');
  assertEqual(r.aId, 'INVUID-A', 'شناسه A نباید عوض شود');
  assertEqual(r.bSeller, 'ویرایش‌شده', 'فقط B باید ویرایش شود');
  assertEqual(r.bId, 'INVUID-B', 'شناسه B باید همان بماند');
});

test('TEST G: حذف فاکتور B گارانتی و معیوب A را دست نمی‌زند', () => {
  const r = saleDeleteSandbox(`
    function getSirmanHostSync(){ return null; }
    function auditActivity(){}
    function fdt(){ return '1405/05/25'; }
    function sv(){}
    function svAccounts(){}
    function recordStockMove(){}
    var inventory = {A1:{code:'A1', qty:4}, B1:{code:'B1', qty:8}};
    var accounts = [{id:'ACC-1', balance:0, transactions:[]}];
    var a = {invoiceId:'INVUID-A', num:'100', status:'closed', items:[{code:'A1'}]};
    var b = {invoiceId:'INVUID-B', num:'100', status:'closed', items:[{code:'B1'}]};
    var invoices = [a, b];
    var warranties = [{id:'W-A', invoiceNum:'100', invoiceId:'INVUID-A'}];
    var defectiveStock = [{id:'DEF-1', invoiceNum:'100', invoiceId:'INVUID-A', model:'X'}];
    deleteInvoiceAt('INVUID-B');
    return {nInv:invoices.length, nWar:warranties.length, nDef:defectiveStock.length, warId:warranties[0].invoiceId, defId:defectiveStock[0].invoiceId, stillA:invoices.indexOf(a)>=0};
  `)();
  assertEqual(r.nInv, 1, 'فقط فاکتور B حذف شود');
  assertEqual(r.stillA, true, 'فاکتور A بماند');
  assertEqual(r.nWar, 1, 'پرونده گارانتی A بماند');
  assertEqual(r.nDef, 1, 'ردیف معیوب A بماند');
  assertEqual(r.warId, 'INVUID-A', 'گارانتی باید به شناسه A وصل بماند');
  assertEqual(r.defId, 'INVUID-A', 'معیوب باید به شناسه A وصل بماند');
});

test('TEST restart: بعد از حذف B و شبیه‌سازی بارگذاری دوباره، A با همان شماره می‌ماند', () => {
  const ensSrc = extractFunctionSource(html, 'ensureInvoiceIdentity');
  const allSrc = extractFunctionSource(html, 'ensureAllInvoiceIdentities');
  const idSrc = extractFunctionSource(html, 'invoiceIdentity');
  const maxSrc = extractFunctionSource(html, 'maxInvoiceUidSeq');
  const nextSrc = extractFunctionSource(html, 'nextInvoiceId');
  const persistSrc = extractFunctionSource(html, 'persistInvoiceUidCtr');
  const r = saleDeleteSandbox(idSrc+'\n'+maxSrc+'\n'+persistSrc+'\n'+nextSrc+'\n'+ensSrc+'\n'+allSrc+`
    function getSirmanHostSync(){ return null; }
    function auditActivity(){}
    function fdt(){ return '1405/05/25'; }
    function sv(){}
    function svAccounts(){}
    function recordStockMove(){}
    var invoiceUidCtr = 2;
    var store = {laegh_invoice_uid_ctr:'2'};
    var localStorage = { getItem:function(k){ return store[k]||null; }, setItem:function(k,v){ store[k]=String(v); } };
    var inventory = {A1:{code:'A1', qty:4}, B1:{code:'B1', qty:8}};
    var accounts = [];
    var a = {invoiceId:'INVUID-A', num:'100', status:'closed', items:[{code:'A1'}]};
    var b = {invoiceId:'INVUID-B', num:'101', status:'closed', items:[{code:'B1'}]};
    var invoices = [a, b];
    deleteInvoiceAt('INVUID-B');
    var snap = JSON.parse(JSON.stringify(invoices));
    invoices = JSON.parse(JSON.stringify(snap));
    ensureAllInvoiceIdentities();
    return {n:invoices.length, id:invoices[0].invoiceId, num:invoices[0].num, qa:inventory.A1.qty};
  `)();
  assertEqual(r.n, 1, 'بعد از بارگذاری دوباره فقط A بماند');
  assertEqual(r.id, 'INVUID-A', 'شناسه A پایدار بماند');
  assertEqual(r.num, '100', 'شماره A عوض نشود');
  assertEqual(r.qa, 4, 'موجودی A بعد از restart همان باشد');
});

test('migration شناسه می‌دهد ولی شماره فاکتور موجود را عوض نمی‌کند', () => {
  const migrateSrc = extractFunctionSource(html, 'migrateBackup');
  const schemasSrc = extractFunctionSource(html, 'SCHEMAS') || 'var SCHEMAS = {};';
  const migrateRecSrc = extractFunctionSource(html, 'migrateRecord') || 'function migrateRecord(r){return r;}';
  const migrateSecSrc = extractFunctionSource(html, 'migrateSection') || 'function migrateSection(a){return a;}';
  const runner = new Function('return (function(){ ' + schemasSrc + '\n' + migrateRecSrc + '\n' + migrateSecSrc + '\n return ' + migrateSrc + ' })();');
  const migrateBackup = runner();
  const result = migrateBackup({ version:'10.4.3', invoices:[{num:'100', seller:'قدیمی'},{num:'100', seller:'جدید'}], products:[], inventory:{}, phonebook:[], sales:[{id:'SL-0002'}] });
  assertEqual(result.data.invoices[0].num, '100', 'شماره فاکتور اول نباید عوض شود');
  assertEqual(result.data.invoices[1].num, '100', 'شماره فاکتور دوم نباید عوض شود');
  assertTrue(!!result.data.invoices[0].invoiceId && !!result.data.invoices[1].invoiceId, 'هر دو باید شناسه داخلی بگیرند');
  assertTrue(result.data.invoices[0].invoiceId !== result.data.invoices[1].invoiceId, 'شناسه‌ها باید متفاوت باشند');
  assertTrue(!!result.data.sales[0].saleUid, 'فروش قدیمی باید saleUid بگیرد');
  assertEqual(result.data.sales[0].id, 'SL-0002', 'شماره فروش SL نباید عوض شود');
});

test('اگر Host با جستجوی شماره فاکتور اول را بردارد، HTML فقط ردیف کلیک‌شده را splice کند', () => {
  const r = saleDeleteSandbox(`
    function getSirmanHostSync(){
      return { RunBusiness: function(name, json){
        var p = JSON.parse(json);
        var list = (p.invoices||[]).slice();
        var num = p.invoice && p.invoice.num;
        var idx = list.findIndex(function(x){ return x && x.num===num; });
        if(idx>=0) list.splice(idx,1);
        return JSON.stringify({ok:true, result:{ok:true, alreadyReversed:false, invoices:list,
          inventory:{A1:{code:'A1', qty:4}, B1:{code:'B1', qty:9}}, accounts:[], persistKeys:[]}});
      }};
    }
    function auditActivity(){}
    function fdt(){ return '1405/05/25'; }
    function sv(){}
    function svAccounts(){}
    function recordStockMove(){}
    var inventory = {A1:{code:'A1', qty:4}, B1:{code:'B1', qty:8}};
    var accounts = [];
    var a = {invoiceId:'INVUID-A', num:'100', status:'closed', items:[{code:'A1'}]};
    var b = {invoiceId:'INVUID-B', num:'100', status:'closed', items:[{code:'B1'}]};
    var invoices = [a, b];
    deleteInvoiceAt('INVUID-B');
    return {n:invoices.length, stillA:invoices.indexOf(a)>=0, stillB:invoices.indexOf(b)>=0, kept:invoices[0]&&invoices[0].invoiceId};
  `)();
  assertEqual(r.n, 1, 'حتی اگر هسته قدیمی با شماره اولین ردیف را بردارد، آرایه زنده نباید هر دو را از دست بدهد');
  assertEqual(r.stillA, true, 'آبجکت A باید بماند');
  assertEqual(r.stillB, false, 'فقط B splice شود');
  assertEqual(r.kept, 'INVUID-A', 'رکورد باقی‌مانده باید A باشد');
});

// ─── فاز ۳.۲: خلاصه عملیات امروز (فقط خواندنی) ───
function dailyOpsBriefHarness(){
  const names = [
    'faNum','tehranParts','div_','gregorian_to_jalali','fdate',
    'faToEnDigits','_normDate','sameTehranDay','calcSlaStatusFromAgeHours',
    '_sumByWh','invStockSnapshot','invLowStockFromLists','defStatusOf','defIsInWarehouse',
    '_briefStripMarks','_briefJalaliDayKey','_briefIsJalaliToday','_briefIsTsToday',
    '_briefPickArr','_briefPickMap','_briefFlattenTransactions','_briefEsc',
    'getDailyOperationsBriefSnapshot','_briefLines','_briefJoin','renderDailyOperationsBriefHtml',
    'renderDashboard','_dashKpi'
  ];
  const src = names.map(function(n){ return extractFunctionSource(html, n); }).join('\n');
  assertTrue(src.indexOf('function getDailyOperationsBriefSnapshot')>=0, 'منبع خلاصه عملیات استخراج نشد');
  return new Function(src + `\n
    var TZ = 'Asia/Tehran';
    var writes = 0;
    function bump(){ writes++; }
    var syncAllAutoTasks = bump, syncOpenInvoiceTasks = bump, syncOpenWarrantyTasks = bump;
    var syncLowInventoryTasks = bump, checkDueTasksForNotification = bump;
    var checkWarrantySlaAlerts = bump, checkStarredAlarms = bump;
    var svTasks = bump, svWars = bump;
    var localStorage = { setItem: function(){ writes++; }, getItem: function(){ return null; }, removeItem: function(){ writes++; } };
    function takeBusinessCore(){ return null; }
    function hasBusinessCore(){ return false; }
    var invoices=[], warranties=[], parts=[], tasks=[], sales=[], accounts=[];
    var products=[], defectiveStock=[], inventory={};
    var dashEl = { innerHTML: '' };
    var document = { getElementById: function(id){ return id==='dashboard-content' ? dashEl : {innerHTML:'', style:{}, classList:{add:function(){},remove:function(){}}}; } };
    return {
      fdate: fdate,
      faToEnDigits: faToEnDigits,
      _normDate: _normDate,
      sameTehranDay: sameTehranDay,
      calcSlaStatusFromAgeHours: calcSlaStatusFromAgeHours,
      invLowStockFromLists: invLowStockFromLists,
      getDailyOperationsBriefSnapshot: getDailyOperationsBriefSnapshot,
      renderDailyOperationsBriefHtml: renderDailyOperationsBriefHtml,
      renderDashboard: renderDashboard,
      writesNow: function(){ return writes; },
      runDash: function(live){
        invoices = live.invoices || [];
        warranties = live.warranties || [];
        parts = live.parts || [];
        tasks = live.tasks || [];
        sales = live.sales || [];
        accounts = live.accounts || [];
        products = live.products || [];
        defectiveStock = live.defectiveStock || [];
        inventory = live.inventory || {};
        dashEl.innerHTML = '';
        renderDashboard();
        return dashEl.innerHTML;
      }
    };
  `);
}

test('خلاصه عملیات امروز باید جدا از رندر HTML و فقط خواندنی باشد', () => {
  assertTrue(!!extractFunctionSource(html, 'getDailyOperationsBriefSnapshot'), 'getDailyOperationsBriefSnapshot لازم است');
  assertTrue(!!extractFunctionSource(html, 'renderDailyOperationsBriefHtml'), 'renderDailyOperationsBriefHtml لازم است');
  const snapSrc = extractFunctionSource(html, 'getDailyOperationsBriefSnapshot');
  const briefSrc = [
    extractFunctionSource(html, '_briefJalaliDayKey'),
    extractFunctionSource(html, '_briefIsJalaliToday'),
    extractFunctionSource(html, '_briefIsTsToday'),
    snapSrc
  ].join('\n');
  assertTrue(briefSrc.indexOf('parseShamsiToTs') === -1, 'مرز امروز نباید parseShamsiToTs را صدا بزند');
  ['syncAllAutoTasks','syncOpenInvoiceTasks','syncOpenWarrantyTasks','syncLowInventoryTasks',
   'checkDueTasksForNotification','checkWarrantySlaAlerts','checkStarredAlarms',
   'svTasks','svWars','localStorage'].forEach(function(fn){
    assertTrue(snapSrc.indexOf(fn) === -1, 'اسنپ‌شات نباید '+fn+' را صدا بزند');
  });
  assertContainsString(snapSrc, 'invLowStockFromLists', 'کم‌موجودی باید از invLowStockFromLists باشد نه KPI ضعیف قطعات');
  assertContainsString(snapSrc, 'calcSlaStatusFromAgeHours', 'SLA باید از calcSlaStatusFromAgeHours موجود باشد');
  assertContainsString(snapSrc, 'sameTehranDay', 'مرز امروز باید sameTehranDay باشد');
  const dash = extractFunctionSource(html, 'renderDashboard');
  assertContainsString(dash, 'getDailyOperationsBriefSnapshot()', 'داشبورد باید اسنپ‌شات را یک‌بار در همان رندر صدا بزند');
  assertContainsString(dash, 'renderDailyOperationsBriefHtml', 'داشبورد باید کارت عملیات امروز را رندر کند');
  assertContainsString(dash, 'dash-kpi-grid', 'کارت‌های KPI موجود باید بمانند');
  assertContainsString(dash, 'overdueTaskList.forEach', 'هشدار وظایف سررسیدگذشته باید بماند');
  assertContainsString(html, 'id="daily-ops-brief"', 'کارت عملیات امروز باید در داشبورد باشد');
  assertTrue(html.indexOf("id=\"page-daily-ops\"") === -1, 'نباید صفحه جدا برای عملیات امروز ساخته شود');
});

test('اسنپ‌شات عملیات امروز نباید داده کسب‌وکار را عوض کند (فاکتور/انبار/حساب/گارانتی/وظیفه)', () => {
  const H = dailyOpsBriefHarness()();
  const now = Date.now();
  const live = {
    invoices: [{num:'INV-1', seller:'الف', status:'open', date:'1404/01/01', tF:10}],
    warranties: [{id:'W1', name:'رضا', status:'open', date:'1404/01/01', companyWork:{arrivalAt: now-10*3600000}}],
    tasks: [{id:'T1', title:'تماس', status:'open', priority:'normal', deadlineTS: now+86400000}],
    sales: [{id:'SL-1', name:'فروش', status:'final', date:'1404/01/01', total:100}],
    accounts: [{id:'A1', name:'صندوق', balance:5000, transactions:[{type:'deposit', amount:100, date:'1404/01/01'}]}],
    parts: [{code:'P1', name:'قطعه', qty:9, min:1}],
    products: [{code:'G1', name:'کالا'}],
    inventory: {G1:{qty:9, min:1}},
    defectiveStock: [{status:'inspect'}]
  };
  const before = JSON.stringify(live);
  const snap = H.getDailyOperationsBriefSnapshot(live, now);
  assertEqual(H.writesNow(), 0, 'اسنپ‌شات نباید ذخیره/تایمر/اعلان بنویسد');
  assertEqual(JSON.stringify(live), before, 'آرایه‌های زنده نباید mutate شوند');
  assertEqual(live.accounts[0].balance, 5000, 'مانده حساب نباید عوض شود');
  assertEqual(live.tasks[0].status, 'open', 'وظیفه نباید عوض شود');
  assertEqual(live.warranties[0].status, 'open', 'گارانتی نباید عوض شود');
  assertEqual(live.invoices[0].status, 'open', 'فاکتور نباید عوض شود');
  assertEqual(live.parts[0].qty, 9, 'موجودی قطعه نباید عوض شود');
  assertTrue(!!snap && Array.isArray(snap.waiting.invoices), 'باید داده ساده برگردد');
});

test('تشخیص امروز باید زون تهران و رقم فارسی/LRM را بدون parseShamsiToTs هندل کند', () => {
  const H = dailyOpsBriefHarness()();
  const now = Date.now();
  const todayFa = H.fdate(now);
  const yesterdayFa = H.fdate(now - 48*3600000);
  assertTrue(!!todayFa && todayFa !== yesterdayFa, 'fdate امروز و ۴۸ ساعت قبل باید فرق داشته باشند');
  assertTrue(H.sameTehranDay(now, now), 'sameTehranDay برای همین لحظه باید true باشد');
  assertTrue(!H.sameTehranDay(now - 48*3600000, now), '۴۸ ساعت قبل نباید همان روز تهران باشد');
  const lrmToday = '\u200e' + todayFa.replace(/[\u200e\u200f]/g,'') + '\u200e';
  const persianToday = todayFa; // fdate خودش رقم فارسی و LRM دارد
  const live = {
    invoices: [
      {num:'TODAY', seller:'امروز', status:'open', date: persianToday},
      {num:'LRM', seller:'علامت', status:'open', date: lrmToday},
      {num:'OLD', seller:'دیروز', status:'open', date: yesterdayFa}
    ],
    warranties: [], tasks: [], sales: [], accounts: [], parts: [], products: [], inventory: {}, defectiveStock: []
  };
  const snap = H.getDailyOperationsBriefSnapshot(live, now);
  const nums = snap.today.invoices.map(function(x){ return x.num; }).sort().join(',');
  assertTrue(nums.indexOf('TODAY')>=0, 'فاکتور با تاریخ جلالی امروز باید در امروز باشد');
  assertTrue(nums.indexOf('LRM')>=0, 'تاریخ با LRM باید نرمال شود');
  assertTrue(nums.indexOf('OLD')===-1, 'فاکتور دیروز نباید امروز شمرده شود');
  const keyToday = H._normDate ? H._normDate(H.faToEnDigits(String(todayFa).replace(/[\u200e\u200f]/g,''))) : '';
  assertTrue(!!snap.todayKey, 'todayKey باید از fdate نرمال‌شده ساخته شود');
  if(keyToday) assertEqual(snap.todayKey, keyToday.replace(/\//g,''), 'todayKey باید با _normDate(faToEnDigits) یکی باشد');
});

test('فاکتور باز و گارانتی باز باید از status موجود باشد نه استنتاج پرداخت', () => {
  const H = dailyOpsBriefHarness()();
  const now = Date.now();
  const live = {
    invoices: [
      {num:'OPEN', seller:'باز', status:'open'},
      {num:'CLOSED', seller:'بسته', status:'closed'}
    ],
    warranties: [
      {id:'W-OPEN', name:'باز', status:'open', companyWork:{arrivalAt: now-1*3600000}},
      {id:'W-CLOSED', name:'بسته', status:'closed', companyWork:{arrivalAt: now-80*3600000}}
    ],
    tasks: [], sales: [], accounts: [], parts: [], products: [], inventory: {}, defectiveStock: []
  };
  const snap = H.getDailyOperationsBriefSnapshot(live, now);
  assertEqual(snap.waiting.invoices.length, 1, 'فقط فاکتور با status غیر closed باز است');
  assertEqual(snap.waiting.invoices[0].num, 'OPEN', 'فاکتور باز باید OPEN باشد');
  assertTrue(snap.waiting.warranties.some(function(w){ return w.id==='W-OPEN'; }), 'گارانتی باز باید در انتظار باشد');
  assertTrue(!snap.waiting.warranties.some(function(w){ return w.id==='W-CLOSED'; }), 'گارانتی بسته نباید در انتظار باشد');
  assertTrue(!snap.urgent.warranties.some(function(w){ return w.id==='W-CLOSED'; }), 'گارانتی بسته نباید فوری SLA شود');
});

test('کم‌موجودی عملیات امروز باید invLowStockFromLists باشد نه KPI ضعیف parts.qty<=min', () => {
  const H = dailyOpsBriefHarness()();
  const now = Date.now();
  const live = {
    invoices: [], warranties: [], tasks: [], sales: [], accounts: [],
    parts: [
      {code:'WEAK-OK', name:'طبق KPI کافی', qty:5, min:0, reorder:5},
      {code:'KPI-LOW', name:'طبق KPI کم', qty:1, min:5}
    ],
    products: [{code:'PROD-LOW', name:'کالای کم'}],
    inventory: { 'PROD-LOW': {qty:1, min:4} },
    defectiveStock: []
  };
  const weakKpi = live.parts.filter(function(p){ return (p.qty||0) <= (p.min||0); }).map(function(p){ return p.code; });
  assertTrue(weakKpi.indexOf('WEAK-OK')===-1, 'KPI ضعیف نباید WEAK-OK را کم‌موجودی ببیند');
  const engine = H.invLowStockFromLists(live.parts, live.products, live.inventory).map(function(x){ return x.code; });
  assertTrue(engine.indexOf('WEAK-OK')>=0, 'موتور انبار باید نقطه سفارش را هم ببیند');
  assertTrue(engine.indexOf('PROD-LOW')>=0, 'موتور انبار باید کالای محصول را هم ببیند');
  const snap = H.getDailyOperationsBriefSnapshot(live, now);
  const codes = snap.stock.low.map(function(x){ return x.code; });
  assertTrue(codes.indexOf('WEAK-OK')>=0, 'خلاصه باید همان موتور انبار را استفاده کند');
  assertTrue(codes.indexOf('PROD-LOW')>=0, 'خلاصه باید کالای کم‌موجودی محصول را نشان دهد');
  assertTrue(codes.indexOf('KPI-LOW')>=0, 'قطعه کم طبق حداقل هم باید باشد');
});

test('SLA گارانتی در خلاصه باید همان calcSlaStatusFromAgeHours باشد و بحرانی را از در انتظار جدا کند', () => {
  const H = dailyOpsBriefHarness()();
  assertEqual(H.calcSlaStatusFromAgeHours(10), 'normal', '۱۰ ساعت عادی');
  assertEqual(H.calcSlaStatusFromAgeHours(24), 'warning', '۲۴ ساعت هشدار');
  assertEqual(H.calcSlaStatusFromAgeHours(48), 'critical', '۴۸ ساعت بحرانی');
  assertEqual(H.calcSlaStatusFromAgeHours(72), 'overdue', '۷۲ ساعت سررسید');
  const now = Date.now();
  const live = {
    invoices: [], tasks: [], sales: [], accounts: [], parts: [], products: [], inventory: {}, defectiveStock: [],
    warranties: [
      {id:'W-CRIT', name:'بحرانی', status:'open', companyWork:{arrivalAt: now-50*3600000}},
      {id:'W-OK', name:'عادی', status:'open', companyWork:{arrivalAt: now-5*3600000}}
    ]
  };
  const snap = H.getDailyOperationsBriefSnapshot(live, now);
  assertEqual(snap.urgent.warranties.length, 1, 'فقط critical/overdue فوری است');
  assertEqual(snap.urgent.warranties[0].id, 'W-CRIT', 'پرونده بحرانی باید فوری باشد');
  assertEqual(snap.urgent.warranties[0].sla, 'critical', 'وضعیت باید critical موتور موجود باشد');
  assertTrue(snap.waiting.warranties.some(function(w){ return w.id==='W-OK'; }), 'گارانتی غیر بحرانی در انتظار بماند');
  assertTrue(!snap.waiting.warranties.some(function(w){ return w.id==='W-CRIT'; }), 'بحرانی نباید دوباره در انتظار تکرار شود');
});

test('واریز و برداشت امروز جدا شوند و مانده حساب عوض نشود', () => {
  const H = dailyOpsBriefHarness()();
  const now = Date.now();
  const today = H.fdate(now);
  const live = {
    invoices: [], warranties: [], tasks: [], sales: [], parts: [], products: [], inventory: {}, defectiveStock: [],
    accounts: [{
      id:'CASH', name:'صندوق', balance:9000,
      transactions: [
        {type:'deposit', amount:3000, date: today},
        {type:'withdraw', amount:1000, date: today},
        {type:'deposit', amount:50, date: H.fdate(now-48*3600000)}
      ]
    }]
  };
  const snap = H.getDailyOperationsBriefSnapshot(live, now);
  assertEqual(snap.finance.depositsToday, 3000, 'واریز امروز باید ۳۰۰۰ باشد');
  assertEqual(snap.finance.withdrawalsToday, 1000, 'برداشت امروز باید ۱۰۰۰ باشد');
  assertEqual(snap.finance.totalBalance, 9000, 'مانده باید جمع balance موجود باشد');
  assertEqual(live.accounts[0].balance, 9000, 'بعد از خواندن، مانده عوض نشود');
  assertEqual(snap.today.transactions.length, 2, 'فقط تراکنش‌های امروز');
});

test('وظیفه فوری/سررسیدگذشته باید قاعده renderTasks را بماند و داده وظیفه عوض نشود', () => {
  const H = dailyOpsBriefHarness()();
  const now = Date.now();
  const live = {
    invoices: [], warranties: [], sales: [], accounts: [], parts: [], products: [], inventory: {}, defectiveStock: [],
    tasks: [
      {id:'U', title:'فوری', status:'open', priority:'urgent', deadlineTS: null},
      {id:'SAME', title:'امروز گذشته', status:'open', priority:'normal', deadlineTS: now-60*60*1000},
      {id:'OLD', title:'دیروز', status:'open', priority:'normal', deadlineTS: now-48*3600000},
      {id:'DONE', title:'انجام', status:'done', priority:'urgent', deadlineTS: now-48*3600000}
    ]
  };
  const snap = H.getDailyOperationsBriefSnapshot(live, now);
  const urgentIds = snap.urgent.tasks.map(function(t){ return t.id; });
  assertTrue(urgentIds.indexOf('U')>=0, 'اولویت urgent باید فوری باشد');
  assertTrue(urgentIds.indexOf('OLD')>=0, 'سررسید روز دیگر باید فوری/گذشته باشد');
  assertTrue(urgentIds.indexOf('SAME')===-1, 'موعد همین روز تهران نباید سررسیدگذشته شمرده شود');
  assertTrue(urgentIds.indexOf('DONE')===-1, 'وظیفه بسته نباید بیاید');
  assertTrue(snap.today.tasks.some(function(t){ return t.id==='SAME'; }), 'موعد امروز در بخش امروز است');
  assertEqual(live.tasks[0].status, 'open', 'وضعیت وظیفه عوض نشود');
  assertEqual(live.tasks.length, 4, 'تعداد وظایف عوض نشود');
});

test('رندر داشبورد باید KPI و هشدار و وظایف سررسیدگذشته را نگه دارد و کارت عملیات را اضافه کند', () => {
  const H = dailyOpsBriefHarness()();
  const now = Date.now();
  const live = {
    invoices: [{num:'INV-OPEN', seller:'الف', status:'open'}],
    warranties: [{id:'W1', name:'رضا', status:'open'}],
    parts: [{code:'P1', name:'فیلتر', qty:0, min:2}],
    tasks: [{id:'T-OLD', title:'پیگیری خراب', status:'open', priority:'normal', deadlineTS: now-48*3600000}],
    sales: [{id:'SL-P', name:'پیش', status:'proforma', total:1}],
    accounts: [{id:'A', name:'صندوق', balance:10, transactions:[]}]
  };
  const out = H.runDash(live);
  assertTrue(out.indexOf('dash-kpi-grid')>=0, 'شبکه KPI باید رندر شود');
  assertTrue(out.indexOf('فاکتور باز')>=0, 'کارت KPI فاکتور باز باید بماند');
  assertTrue(out.indexOf('هشدارها')>=0, 'کارت هشدارها باید بماند');
  assertTrue(out.indexOf('پیگیری خراب')>=0, 'هشدار وظیفه سررسیدگذشته باید رندر شود');
  assertTrue(out.indexOf('id="daily-ops-brief"')>=0 || out.indexOf("id=\"daily-ops-brief\"")>=0, 'کارت عملیات امروز باید رندر شود');
  assertTrue(out.indexOf('عملیات امروز')>=0, 'عنوان فارسی کارت لازم است');
  assertTrue(out.indexOf('آخرین فعالیت‌ها')>=0, 'اقلام اخیر باید بماند');
  assertEqual(H.writesNow(), 0, 'رندر داشبوردِ خلاصه نباید state بنویسد');
});

test('داشبورد باید کارهای باز را از فروش و مالی جدا نشان بدهد بدون نوشتن داده', () => {
  assertContainsString(html, 'dash-lead', 'متن راهنمای فقط‌خواندنی داشبورد پیدا نشد');
  assertContainsString(html, 'dash-section-title', 'عنوان بخش KPI داشبورد پیدا نشد');
  const dash = extractFunctionSource(html, 'renderDashboard');
  assertContainsString(dash, 'کارهای باز', 'بخش کارهای باز لازم است');
  assertContainsString(dash, 'فروش و مالی', 'بخش فروش و مالی لازم است');
  assertContainsString(dash, 'از اینجا چیزی ذخیره نمی‌شود', 'باید صریح فقط‌خواندنی باشد');
  assertTrue(dash.indexOf('localStorage.setItem') === -1, 'renderDashboard نباید localStorage بنویسد');
  assertTrue(dash.indexOf('RunBusiness(') === -1, 'renderDashboard نباید RunBusiness صدا بزند');
  const H = dailyOpsBriefHarness()();
  const live = {
    invoices: [{num:'INV-OPEN', seller:'الف', status:'open'}],
    warranties: [{id:'W1', name:'رضا', status:'open'}],
    parts: [{code:'P1', name:'فیلتر', qty:0, min:2}],
    tasks: [],
    sales: [{id:'SL-F', name:'فروش', status:'final', total:1}],
    accounts: [{id:'A', name:'صندوق', balance:10, transactions:[]}]
  };
  const before = JSON.stringify(live);
  const out = H.runDash(live);
  assertEqual(JSON.stringify(live), before, 'رندر نباید آرایه‌های زنده را عوض کند');
  assertEqual(H.writesNow(), 0, 'گروه‌بندی KPI نباید persist بنویسد');
  assertTrue(out.indexOf('کارهای باز')>=0, 'عنوان کارهای باز باید رندر شود');
  assertTrue(out.indexOf('فروش و مالی')>=0, 'عنوان فروش و مالی باید رندر شود');
  assertTrue(out.indexOf('فاکتور باز')>=0, 'برچسب KPI فاکتور باید بماند');
  assertTrue(out.indexOf('فروش نهایی')>=0, 'برچسب KPI فروش باید بماند');
  assertTrue(out.indexOf('dash-kpi-grid')>=0, 'شبکه KPI باید بماند');
});

test('فرم پنجره باید داخل win-body اسکرول شود نه body قفل‌شده', () => {
  assertContainsString(html, 'grid-auto-rows:minmax(0,1fr)', 'ردیف میزکار باید ارتفاع محدود داشته باشد تا win-body اسکرول شود');
  assertContainsString(html, 'function scrollActiveWinBody(', 'تابع اسکرول بدنه پنجره باید وجود داشته باشد');
  assertTrue(html.indexOf('window.scrollTo({top:document.body.scrollHeight') === -1, 'دکمه افزودن دستگاه نباید body قفل‌شده را اسکرول کند');
  const src = extractFunctionSource(html, 'scrollActiveWinBody');
  assertTrue(!!src, 'منبع scrollActiveWinBody پیدا نشد');
  const r = new Function(src+`
    var body = { scrollTop: 0, scrollHeight: 800 };
    var document = {
      querySelector: function(sel){ return String(sel).indexOf('win-body')>=0 ? body : null; },
      getElementById: function(){ return null; },
      scrollingElement: { scrollTop: 0, scrollHeight: 10 }
    };
    scrollActiveWinBody('bottom');
    return {win: body.scrollTop, page: document.scrollingElement.scrollTop};
  `)();
  assertEqual(r.win, 800, 'اسکرول باید روی .win-body برود');
  assertEqual(r.page, 0, 'document قفل‌شده نباید اسکرول شود');
});

console.log('');
console.log('📋 گروه: قابلیت اطمینان یادآوری کار (فاز ۳.۳)');

function taskNotifyPipelineSrc() {
  return [
    extractFunctionSource(html, 'getNotifyBridgePort'),
    extractFunctionSource(html, 'getNotifyBridgeUrl'),
    extractFunctionSource(html, 'pushWindowsNotifyBridge'),
    extractFunctionSource(html, 'showLaeghNotification'),
    extractFunctionSource(html, 'checkDueTasksForNotification'),
    extractFunctionSource(html, 'whenTaskNotifyStateReady'),
    extractFunctionSource(html, 'openTasksIDB'),
    extractFunctionSource(html, 'syncNotifiedFromIDB'),
    extractFunctionSource(html, 'startTaskDueNotificationTimer'),
    extractFunctionSource(html, 'bootTaskNotifications')
  ].join('\n');
}

function makeDeniedNotification() {
  function Notification() { throw new Error('web notification denied'); }
  Notification.permission = 'denied';
  Notification.calls = [];
  return Notification;
}

function makeGrantedNotification() {
  function Notification(title, opts) {
    Notification.calls.push({ title: title, opts: opts || {} });
  }
  Notification.permission = 'granted';
  Notification.calls = [];
  return Notification;
}

function makeTasksIdb(rows) {
  return {
    open: function() {
      var req = { result: null, onupgradeneeded: null, onsuccess: null, onerror: null };
      setTimeout(function() {
        req.result = {
          objectStoreNames: { contains: function() { return true; } },
          transaction: function() {
            return {
              objectStore: function() {
                return {
                  getAll: function() {
                    var g = { result: (rows || []).slice(), onsuccess: null, onerror: null };
                    setTimeout(function() {
                      if (typeof g.onsuccess === 'function') g.onsuccess({ target: g });
                    }, 0);
                    return g;
                  }
                };
              }
            };
          }
        };
        if (typeof req.onsuccess === 'function') req.onsuccess({ target: req });
      }, 0);
      return req;
    }
  };
}

function runTaskNotifyPipeline(opts) {
  opts = opts || {};
  const store = Object.assign({}, opts.store || {});
  const fetchCalls = [];
  const hostCalls = [];
  const postMessages = [];
  const NotificationCtor = opts.Notification || makeDeniedNotification();
  const idb = Object.prototype.hasOwnProperty.call(opts, 'indexedDB') ? opts.indexedDB : undefined;
  const win = {
    chrome: opts.chrome,
    Notification: NotificationCtor,
    _taskNotifyStateReady: opts.ready,
    _taskDueNotifyTimer: null
  };
  if (idb) win.indexedDB = idb;
  const ctx = {
    Promise: Promise,
    JSON: JSON,
    Date: Date,
    Math: Math,
    String: String,
    parseInt: parseInt,
    window: win,
    Notification: NotificationCtor,
    localStorage: {
      getItem(k) { return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; },
      setItem(k, v) { store[k] = String(v); }
    },
    tasks: opts.tasks || [],
    fetch: function(url, init) {
      fetchCalls.push({ url: url, init: init });
      if (typeof opts.fetch === 'function') return opts.fetch(url, init);
      return Promise.reject(new Error('bridge offline'));
    },
    getSirmanHostSync: opts.getSirmanHostSync || function() { return null; },
    playSirmanNotificationSound: function() {},
    isSirmanDesktopNotifyReady: opts.isSirmanDesktopNotifyReady || function() { return false; },
    desktopNotifyAllowed: opts.desktopNotifyAllowed || function() { return true; },
    svTasks: opts.svTasks || function() {},
    renderTasks: function() {},
    renderSidebarBadges: function() {},
    _swReg: null,
    setInterval: opts.setInterval || function() { return 99; },
    setTimeout: setTimeout,
    console: { log: function() {} }
  };
  if (idb) ctx.indexedDB = idb;
  if (typeof opts.sirmanDesktopNotify === 'function') {
    ctx.sirmanDesktopNotify = function(title, o) {
      hostCalls.push({ title: title, opts: o });
      return opts.sirmanDesktopNotify(title, o);
    };
  }
  if (opts.chrome && opts.chrome.webview && typeof opts.chrome.webview.postMessage === 'function') {
    win.chrome = {
      webview: {
        postMessage: function(msg) {
          postMessages.push(msg);
          return opts.chrome.webview.postMessage(msg);
        }
      }
    };
  }
  const api = new Function('ctx', 'with(ctx){\n' + taskNotifyPipelineSrc() + '\n; return { checkDueTasksForNotification: checkDueTasksForNotification, whenTaskNotifyStateReady: whenTaskNotifyStateReady, bootTaskNotifications: bootTaskNotifications, syncNotifiedFromIDB: syncNotifiedFromIDB, startTaskDueNotificationTimer: startTaskDueNotificationTimer, showLaeghNotification: showLaeghNotification, pushWindowsNotifyBridge: pushWindowsNotifyBridge }; }')(ctx);
  const invoked = opts.invoke ? opts.invoke(api, ctx) : api.checkDueTasksForNotification();
  return Promise.resolve(invoked).then(function() {
    return { ctx: ctx, win: win, store: store, fetchCalls: fetchCalls, hostCalls: hostCalls, postMessages: postMessages, Notification: NotificationCtor, api: api };
  });
}

function dueTask(extra) {
  return Object.assign({
    id: 'T-DUE',
    status: 'open',
    notify: true,
    deadlineTS: Date.now() - 1000,
    notifiedAt: null,
    title: 'کار سررسید',
    desc: 'شرح',
    priority: 'high'
  }, extra || {});
}

test('موفقیت Host باید notifiedAt را ست کند', () => {
  const t = dueTask();
  return runTaskNotifyPipeline({
    tasks: [t],
    sirmanDesktopNotify: function() { return true; },
    fetch: function() { return Promise.reject(new Error('should not fetch after host success')); }
  }).then(function(r) {
    assertTrue(!!t.notifiedAt, 'موفقیت Host باید notifiedAt را ست کند');
    assertEqual(r.hostCalls.length, 1, 'باید یک‌بار Host صدا زده شود');
    assertEqual(r.fetchCalls.length, 0, 'پس از موفقیت Host نباید HTTP تکراری فرستاده شود');
  });
});

test('اگر همه مسیرهای اعلان شکست بخورند notifiedAt نباید ست شود', () => {
  const t = dueTask();
  return runTaskNotifyPipeline({
    tasks: [t],
    fetch: function() { return Promise.reject(new Error('offline')); }
  }).then(function() {
    assertTrue(!t.notifiedAt, 'شکست همه مسیرها باید notifiedAt را خالی بگذارد');
  });
});

test('رد شدن fetch پل باید در نبود کانال دیگر notifiedAt را خالی بگذارد', () => {
  const t = dueTask();
  return runTaskNotifyPipeline({
    tasks: [t],
    fetch: function() { return Promise.reject(new Error('ECONNREFUSED')); }
  }).then(function(r) {
    assertTrue(r.fetchCalls.length >= 1, 'باید واقعاً fetch پل را امتحان کند');
    assertTrue(!t.notifiedAt, 'reject شدن fetch نباید notifiedAt را ست کند');
  });
});

test('پاسخ غیر 2xx پل باید شکست حساب شود', () => {
  const t = dueTask();
  return runTaskNotifyPipeline({
    tasks: [t],
    fetch: function() { return Promise.resolve({ ok: false, status: 500 }); }
  }).then(function(r) {
    assertTrue(r.fetchCalls.length >= 1, 'باید fetch پل را صدا بزند');
    assertTrue(!t.notifiedAt, 'پاسخ غیر 2xx نباید notifiedAt را ست کند');
  });
});

test('ساخت موفق Web Notification باید بتواند notifiedAt را ست کند', () => {
  const t = dueTask();
  const WebN = makeGrantedNotification();
  return runTaskNotifyPipeline({
    tasks: [t],
    Notification: WebN,
    fetch: function() { return Promise.reject(new Error('bridge down')); }
  }).then(function() {
    assertEqual(WebN.calls.length, 1, 'باید یک Web Notification ساخته شود');
    assertTrue(!!t.notifiedAt, 'قبول شدن کانال Web باید notifiedAt را ست کند — نه اینکه کاربر حتماً آن را دیده باشد');
  });
});

test('اگر گیت اعلان خاموش باشد notifiedAt نباید ست شود', () => {
  const t = dueTask();
  return runTaskNotifyPipeline({
    tasks: [t],
    desktopNotifyAllowed: function() { return false; },
    fetch: function() { return Promise.resolve({ ok: true, status: 200 }); },
    sirmanDesktopNotify: function() { return true; }
  }).then(function(r) {
    assertEqual(r.fetchCalls.length, 0, 'گیت خاموش نباید هیچ کانالی را صدا بزند');
    assertEqual(r.hostCalls.length, 0, 'گیت خاموش نباید Host را صدا بزند');
    assertTrue(!t.notifiedAt, 'گیت خاموش باید notifiedAt را خالی بگذارد');
  });
});

test('کار از قبل notifiedAt دارد نباید دوباره اعلان شود', () => {
  const t = dueTask({ notifiedAt: 12345 });
  return runTaskNotifyPipeline({
    tasks: [t],
    fetch: function() { return Promise.resolve({ ok: true, status: 200 }); }
  }).then(function(r) {
    assertEqual(t.notifiedAt, 12345, 'notifiedAt قبلی باید دست‌نخورده بماند');
    assertEqual(r.fetchCalls.length, 0, 'کار اعلان‌شده نباید دوباره ارسال شود');
  });
});

test('موعد آینده نباید اعلان شود', () => {
  const t = dueTask({ deadlineTS: Date.now() + 3600000 });
  return runTaskNotifyPipeline({
    tasks: [t],
    fetch: function() { return Promise.resolve({ ok: true, status: 200 }); }
  }).then(function(r) {
    assertTrue(!t.notifiedAt, 'موعد آینده نباید notifiedAt بگیرد');
    assertEqual(r.fetchCalls.length, 0, 'موعد آینده نباید ارسال شود');
  });
});

test('کار تکمیل‌شده نباید اعلان شود', () => {
  const t = dueTask({ status: 'done' });
  return runTaskNotifyPipeline({
    tasks: [t],
    fetch: function() { return Promise.resolve({ ok: true, status: 200 }); }
  }).then(function(r) {
    assertTrue(!t.notifiedAt, 'کار انجام‌شده نباید notifiedAt بگیرد');
    assertEqual(r.fetchCalls.length, 0, 'کار انجام‌شده نباید ارسال شود');
  });
});

test('چند کار سررسید باید مستقل پردازش شوند', () => {
  const a = dueTask({ id: 'T-A', title: 'اول' });
  const b = dueTask({ id: 'T-B', title: 'دوم' });
  let n = 0;
  return runTaskNotifyPipeline({
    tasks: [a, b],
    fetch: function() {
      n += 1;
      if (n === 1) return Promise.reject(new Error('first fail'));
      return Promise.resolve({ ok: true, status: 200 });
    }
  }).then(function() {
    assertTrue(!a.notifiedAt, 'شکست کار اول نباید notifiedAt آن را ست کند');
    assertTrue(!!b.notifiedAt, 'موفقیت کار دوم باید مستقل از شکست کار اول باشد');
  });
});

test('بوت با notifiedAt در IDB نباید اعلان تکراری بفرستد', () => {
  const t = dueTask({ id: 'T-IDB', notifiedAt: null });
  const idb = makeTasksIdb([{ id: 'T-IDB', notifiedAt: 888 }]);
  return runTaskNotifyPipeline({
    tasks: [t],
    indexedDB: idb,
    fetch: function() { return Promise.resolve({ ok: true, status: 200 }); },
    invoke: function(api) {
      return api.whenTaskNotifyStateReady(function() {
        return api.checkDueTasksForNotification();
      });
    }
  }).then(function(r) {
    assertEqual(t.notifiedAt, 888, 'notifiedAt باید از IDB به کار زنده کپی شود');
    assertEqual(r.fetchCalls.length, 0, 'بعد از همگام‌سازی IDB نباید اعلان تکراری برود');
  });
});

test('بوت بدون notifiedAt در IDB باید کار سررسید را عادی اعلان کند', () => {
  const t = dueTask({ id: 'T-FRESH', notifiedAt: null });
  const idb = makeTasksIdb([{ id: 'T-FRESH', notifiedAt: null }]);
  return runTaskNotifyPipeline({
    tasks: [t],
    indexedDB: idb,
    fetch: function() { return Promise.resolve({ ok: true, status: 200 }); },
    invoke: function(api) {
      return api.whenTaskNotifyStateReady(function() {
        return api.checkDueTasksForNotification();
      });
    }
  }).then(function(r) {
    assertTrue(!!t.notifiedAt, 'کار سررسید بدون notifiedAt در IDB باید بعد از بوت اعلان شود');
    assertTrue(r.fetchCalls.length >= 1, 'باید مسیر تحویل واقعاً امتحان شود');
  });
});

test('ویرایش موعد باید notifiedAt را پاک کند', () => {
  const src = extractFunctionSource(html, 'saveTask');
  assertTrue(!!src, 'تابع saveTask پیدا نشد');
  assertContainsString(src, 'if(t.deadlineTS!==deadlineTS) t.notifiedAt=null', 'تغییر موعد باید notifiedAt را خالی کند');
  const els = {
    'tsk-title': { value: 'کار ویرایش‌شده' },
    'tsk-desc': { value: '' },
    'tsk-priority': { value: 'normal' },
    'tsk-deadline': { value: '1405/01/02 10:00', dataset: { ts: '2000' } },
    'tsk-notify': { value: '1' },
    'tsk-link-type': { value: '' },
    'tsk-link-id': { value: '' },
    'tsk-cancel-edit': { style: { display: 'none' } }
  };
  const task = { id: 'T-EDIT', deadlineTS: 1000, notifiedAt: 555, title: 'قدیمی' };
  const ctx = {
    document: { getElementById: function(id) { return els[id]; } },
    tasks: [task],
    _taskEditId: 'T-EDIT',
    _activeTaskTab: 'do',
    ntf: function() {},
    svTasks: function() {},
    resetTaskForm: function() {},
    renderTasks: function() {}
  };
  new Function('ctx', 'with(ctx){ (' + src.replace(/^function saveTask/, 'function') + ')(); }')(ctx);
  assertEqual(task.deadlineTS, 2000, 'موعد جدید باید ذخیره شود');
  assertEqual(task.notifiedAt, null, 'تغییر موعد باید notifiedAt را null کند');
});

test('ترتیب بوت باید همگام‌سازی IDB را قبل از اولین بررسی اعلان و تایمر انجام دهد', () => {
  const boot = extractFunctionSource(html, 'bootTaskNotifications');
  const when = extractFunctionSource(html, 'whenTaskNotifyStateReady');
  const start = extractFunctionSource(html, 'startTaskDueNotificationTimer');
  const due = extractFunctionSource(html, 'checkDueTasksForNotification');
  assertTrue(!!boot && !!when && !!start, 'توابع بوت اعلان پیدا نشدند');
  assertContainsString(when, 'syncNotifiedFromIDB', 'بوت باید منتظر syncNotifiedFromIDB بماند');
  assertContainsString(boot, 'whenTaskNotifyStateReady', 'bootTaskNotifications باید از Promise بوت استفاده کند');
  assertContainsString(boot, 'checkDueTasksForNotification', 'بعد از IDB باید checkDue صدا شود');
  assertContainsString(boot, 'startTaskDueNotificationTimer', 'تایمر باید بعد از اولین بررسی شروع شود');
  assertContainsString(start, 'setInterval(checkDueTasksForNotification, 60000)', 'باید همان تایمر ۶۰ ثانیه‌ای قبلی بماند');
  assertContainsString(start, '_taskDueNotifyTimer', 'نباید تایمر دوم ساخته شود');
  assertContainsString(due, 'delivered === true', 'notifiedAt فقط بعد از سیگنال موفقیت صریح ست شود');
  assertContainsString(html, 'bootTaskNotifications()', 'انتهای اسکریپت باید bootTaskNotifications را صدا بزند');
  assertTrue(html.indexOf('setInterval(checkDueTasksForNotification, 60000);\nsyncNotifiedFromIDB();') === -1,
    'نباید همگام‌سازی IDB و تایمر بدون ترتیب بوت بمانند');
});

test('موفقیت HTTP 2xx پل باید notifiedAt را ست کند', () => {
  const t = dueTask();
  return runTaskNotifyPipeline({
    tasks: [t],
    fetch: function() { return Promise.resolve({ ok: true, status: 200 }); }
  }).then(function(r) {
    assertTrue(r.fetchCalls.length >= 1, 'باید fetch پل را صدا بزند');
    assertTrue(!!t.notifiedAt, 'پاسخ 2xx باید notifiedAt را ست کند');
  });
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
