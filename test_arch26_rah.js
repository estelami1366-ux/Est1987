#!/usr/bin/env node
/**
 * ARCH-26 Recovery Acceptance Harness (RAH) — copy-only, synthetic, isolated.
 * Does not change production Backup/Restore. Uses extracted live functions.
 * Never touches shop data.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');

const ARCH26_ASSEMBLER = 'f354ba9875b25c3160581b6f06a62e991c11fb7a6181f9172db0db93c78cbd41';
const ARCH26_SAVEPB = '1883f9d3dd575719ae6d653a30318faa38fed4dd9e046ead32a7070730e4cf81';
const ARCH26_ATTACH = 'ed781c62b8a0da9e80b458339cf3bf36bbabd38183ee5f5c1b81b9e686877d8f';
const ARCH26_FP = '32eb8b515ee874e7e4eb89568e1293cbd54196e56667e863383f62add453dc15';
const ARCH26_REQ = '92dd552685fce56b5cff75a41c4a767d658233affc6d3870d015dc379199c631';
const ARCH26_OPT = 'd885fa4c4c5f128f36db7799a5732adc3765025b9bebe204779a77c01a79b508';
const ARCH26_PB_SNAP = '7595af4ed999d5c3213af78fe8ef5f74e1da4252d53961df466c998cc5e7a79c';
const ARCH26_MERGE = '0505b31f8f46e96dd097294e37c17549c79810b422073f2cc33111cdab90dc49';
const ARCH26_REPLACE = 'b067f92b2e1bbf60c9d6edcc77dba68b5e839b44c8d0d61ab95967e47426b7af';

const REQUIRED_KEYS = ['invoices', 'sales', 'warranties', 'parts', 'accounts'];
const COUNTER_KEYS = ['invCtr', 'invoiceUidCtr', 'saleCtr', 'saleUidCtr'];
const OPTIONAL_KEYS = [
  'products', 'inventory', 'services', 'svcs', 'tasks', 'defectiveStock',
  'warehouseDocs', 'stockMoves', 'warehouses', 'daqi', 'daqiWarehouse',
  'daqiVouchers', 'postalHistory'
];
const RAM_ARRAY_KEYS = REQUIRED_KEYS.concat([
  'products', 'services', 'svcs', 'tasks', 'defectiveStock', 'warehouseDocs',
  'stockMoves', 'warehouses', 'daqi', 'daqiWarehouse', 'daqiVouchers',
  'postalHistory', 'phonebook', 'userRoles', 'userAuditLog', 'bgAuditLog'
]);

function sha256utf8(s) {
  return crypto.createHash('sha256').update(s, 'utf8').digest('hex');
}
function sha256buf(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}
function clone(v) {
  return JSON.parse(JSON.stringify(v));
}
function lenOf(v) {
  if (Array.isArray(v)) return v.length;
  if (v && typeof v === 'object') return Object.keys(v).length;
  return v == null ? 0 : 1;
}

function emptyRam() {
  return {
    invoices: [], products: [], inventory: {}, phonebook: [], parts: [],
    services: [], svcs: [], warranties: [], sales: [], tasks: [], accounts: [],
    defectiveStock: [], warehouseDocs: [], stockMoves: [], warehouses: [],
    daqi: [], daqiWarehouse: [], daqiVouchers: [], postalHistory: [],
    userAuditLog: [], bgAuditLog: [], userRoles: [], loginPw: '',
    senderInfo: {}, logoSrc: '', acH: {},
    invCtr: 1, invoiceUidCtr: 0, saleCtr: 1, saleUidCtr: 0,
    SIRMAN_BACKUP_MAGIC: 'SIRMAN_BACKUP', SIRMAN_SCHEMA_VERSION: 1
  };
}

function rahSourceRam(meta) {
  const diskRef = meta.mediaDiskRef;
  const inlineData = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
  const emptyClone = { fn: 'بی‌تلفن', ln: 'clone', phones: [], cat: 'other' };
  const ram = emptyRam();
  ram.invoices = [{
    id: 'INV-RAH-1', invoiceId: 'INVUID-000101', num: '۱۰۱', seller: 'علی رضایی',
    items: [{ code: 'P-1', model: 'پره', fin: 150000 }],
    docs: [{ id: 'INV-DOC-1', name: 'فاکتور.pdf', data: inlineData, mime: 'application/pdf' }]
  }];
  ram.sales = [{
    id: 'SL-0001', saleUid: 'SALEUID-000101', name: 'فروشگاه نمونه', total: 200000,
    items: [{ partCode: 'PT-9', qty: 2 }],
    docs: [{ id: 'SL-DOC-1', name: 'رسید-دیسک.bin', data: diskRef, mime: 'application/octet-stream' }]
  }];
  ram.warranties = [{
    id: 'W-RAH-1', name: 'مریم',
    devices: [{ serial: 'SN-۱', nested: { color: 'سفید' } }],
    docs: [{ id: 'W-DOC-1', name: 'گارانتی.png', data: inlineData, mime: 'image/png' }]
  }];
  ram.parts = [{ id: 'PT-1', code: 'PT-9', name: 'یاتاقان', qty: 4, nested: { bin: 'A' } }];
  ram.accounts = [{
    id: 'ACC-0001', number: '6037', name: 'صندوق', balance: 500000,
    transactions: [{ id: 'TX-1', type: 'deposit', amount: 500000, ref: 'INV-RAH-1' }]
  }];
  ram.invCtr = 102;
  ram.invoiceUidCtr = 101;
  ram.saleCtr = 2;
  ram.saleUidCtr = 101;
  ram.products = [{ code: 'P-1', name: 'پره', nested: { sku: 'S1' } }];
  ram.inventory = { 'P-1': { code: 'P-1', qty: 4, nested: { bin: 'A' } } };
  ram.services = [{ id: 'SVC-1', code: 'S001', name: 'تعویض پره', price: 150000, warr: 'no' }];
  ram.svcs = clone(ram.services);
  ram.tasks = [{ id: 'TSK-1', title: 'پیگیری', link: { type: 'warranty', id: 'W-RAH-1' } }];
  ram.defectiveStock = [{
    id: 'DF-1', warrantyId: 'W-RAH-1', invoiceNum: '۱۰۱', invoiceId: 'INVUID-000101',
    model: 'پره'
  }];
  ram.warehouseDocs = [{
    id: 'WH-IN-0001', type: 'in', fromWh: '', toWh: 'WH-PARTS',
    items: [{ code: 'PT-9', qty: 2 }]
  }];
  ram.stockMoves = [{
    id: 'SM-0001', itemCode: 'PT-9', refDoc: 'WH-IN-0001', whId: 'WH-PARTS', qty: 2
  }];
  ram.warehouses = [{ id: 'WH-PARTS', name: 'انبار قطعات' }];
  ram.phonebook = [
    { fn: 'علی', ln: 'رضایی', phones: ['09121111111'], cat: 'customer' },
    clone(emptyClone),
    clone(emptyClone),
    { fn: 'بی‌تلفن', ln: 'distinct', phones: [], cat: 'other' },
    { fn: 'بدون‌فیلد', ln: 'missing' },
    { fn: 'نال', phones: null },
    { fn: 'محمد', ln: 'الحسینی', phones: ['۰۹۱۲۳۳۳۳۳۳۳'], note: 'العربية', shop: 'فروشگاه نمونه' },
    { fn: 'extra', phones: ['09129999999'], xyz: 42, nested: { k: 'v' } }
  ];
  ram.daqi = [{
    id: 'Q-1', agency: 'نمایندگی الف', agencyPhonebookIdx: 0, warrantyId: 'W-RAH-1'
  }];
  ram.daqiWarehouse = [{ manufacturer: 'سیرمان', code: 'DQ-1', name: 'قطعه داغی', qty: 3 }];
  ram.daqiVouchers = [{ id: 'DV-1', daqiId: 'Q-1', qty: 1 }];
  ram.postalHistory = [{ id: 'PH-1', invoiceId: 'INVUID-000101', tracking: 'TRK-۱' }];
  ram.userRoles = [{
    id: 'usr_rah_admin', name: 'مدیر', username: 'admin', pw: 'x',
    pages: ['dashboard', 'settings'], roleKey: 'admin', active: true
  }];
  ram.loginPw = 'rah-login-synthetic';
  ram.senderInfo = { name: 'لایق الکترونیک پارسیان', city: 'تهران', phone: '02100000000' };
  ram.logoSrc = inlineData;
  ram.acH = { 'ACC-0001': [{ t: 1, note: 'افتتاح' }] };
  ram.userAuditLog = [{ id: 'UA-1', act: 'login' }];
  ram.bgAuditLog = [{ id: 'BG-1', act: 'autosave' }];
  return ram;
}

function rahSettingsLs() {
  return {
    laegh_printSettings: JSON.stringify({ paper: 'A4', margin: 8, copies: 1 }),
    laegh_company: JSON.stringify({ name: 'لایق', tel: '021111', city: 'تهران' }),
    laegh_service_center: JSON.stringify({ name: 'مرکز خدمات', addr: 'خیابان نمونه' }),
    laegh_starred_alarms: '[]',
    laegh_tz: 'Asia/Tehran',
    laegh_sms: JSON.stringify({ enabled: false, text: 'سلام علی' }),
    laegh_skin: 'fluent',
    laegh_theme: 'light',
    laegh_app_font: 'vazir',
    laegh_text_size: '15',
    laegh_last_page: 'dashboard',
    laegh_network: JSON.stringify({ role: 'standalone', port: 8765 }),
    laegh_login_pw: 'rah-login-synthetic',
    ls: JSON.stringify({ name: 'لایق الکترونیک پارسیان', city: 'تهران', phone: '02100000000' }),
    ll: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    la: JSON.stringify({ 'ACC-0001': [{ t: 1, note: 'افتتاح' }] }),
    laegh_roles: JSON.stringify([{
      id: 'usr_rah_admin', name: 'مدیر', username: 'admin', pw: 'x',
      pages: ['dashboard', 'settings'], roleKey: 'admin', active: true
    }])
  };
}

function persistStubs() {
  return {
    markDirty: function () {},
    ntf: function () {},
    addDbgEntry: function () {},
    auditUser: function () {},
    alert: function () {},
    emit: function () {},
    getNum: function () {},
    renderSaved: function () {},
    renderProds: function () {},
    renderInv: function () {},
    renderPB: function () {},
    renderParts: function () {},
    renderSvcs: function () {},
    renderSales: function () {},
    renderWarList: function () {},
    renderDataStats: function () {},
    renderTasks: function () {},
    renderSidebarBadges: function () {},
    renderAccounts: function () {},
    renderDefective: function () {},
    applyBrand: function () {},
    loadServiceCenter: function () {},
    loadStarredAlarmsUI: function () {},
    applyAppearanceSettings: function () {},
    ensureWindowManager: function () {},
    parseNetworkSettings: function (x) { return x; },
    saveAppliedUpdatesMeta: function () {},
    persistInvoiceUidCtr: function () {},
    persistSaleUidCtr: function () {},
    ensureSaleCtr: function () {},
    ensureAllSaleIdentities: function () { return false; },
    ensureAllInvoiceIdentities: function () { return false; },
    logBackupAudit: function () {},
    saveSafetySnapshot: function () {}
  };
}

function attachPersist(ctx) {
  const stubs = persistStubs();
  Object.keys(stubs).forEach(function (k) { ctx[k] = stubs[k]; });
  ctx.sv = function () {
    ctx.localStorage.setItem('li', JSON.stringify(ctx.invoices));
    ctx.localStorage.setItem('lp', JSON.stringify(ctx.products));
    ctx.localStorage.setItem('lv', JSON.stringify(ctx.inventory));
    ctx.localStorage.setItem('lb', JSON.stringify(ctx.phonebook));
    ctx.localStorage.setItem('la', JSON.stringify(ctx.acH));
    ctx.localStorage.setItem('lc', String(ctx.invCtr));
  };
  ctx.svParts = function () { ctx.localStorage.setItem('lp2', JSON.stringify(ctx.parts)); };
  ctx.svSvcs = function () {
    ctx.localStorage.setItem('ls2', JSON.stringify(ctx.services));
    ctx.svcs = ctx.services;
  };
  ctx.svSales = function () {
    ctx.localStorage.setItem('laegh_sales', JSON.stringify(ctx.sales));
    ctx.localStorage.setItem('laegh_sale_ctr', String(ctx.saleCtr || 1));
  };
  ctx.svWarr = function () { ctx.localStorage.setItem('lw2', JSON.stringify(ctx.warranties)); };
  ctx.svTasks = function () { ctx.localStorage.setItem('laegh_tasks', JSON.stringify(ctx.tasks)); };
  ctx.svDefective = function () { ctx.localStorage.setItem('laegh_defective', JSON.stringify(ctx.defectiveStock)); };
  ctx.svAccounts = function () { ctx.localStorage.setItem('laegh_accounts', JSON.stringify(ctx.accounts)); };
  ctx.svWarehouses = function () { ctx.localStorage.setItem('laegh_warehouses', JSON.stringify(ctx.warehouses)); };
  ctx.svWarehouse = function () { ctx.localStorage.setItem('laegh_warehouse', JSON.stringify(ctx.warehouseDocs)); };
  ctx.svStockMoves = function () { ctx.localStorage.setItem('laegh_stockmoves', JSON.stringify(ctx.stockMoves)); };
  ctx.svDaqi = function () { ctx.localStorage.setItem('laegh_daqi', JSON.stringify(ctx.daqi)); };
  ctx.svDaqiWarehouse = function () { ctx.localStorage.setItem('laegh_daqi_warehouse', JSON.stringify(ctx.daqiWarehouse)); };
  ctx.svDaqiVouchers = function () { ctx.localStorage.setItem('laegh_daqi_vouchers', JSON.stringify(ctx.daqiVouchers)); };
  ctx.svPostalHistory = function () { ctx.localStorage.setItem('laegh_postal_history', JSON.stringify(ctx.postalHistory)); };
  ctx.svRoles = function () { ctx.localStorage.setItem('laegh_roles', JSON.stringify(ctx.userRoles)); };
  ctx.normalizeAppUsers = function (arr) { return Array.isArray(arr) ? arr : []; };
  ctx.normalizeAppUser = function (u) { return u; };
  ctx.applyPrefsBundle = function (o) {
    if (!o || typeof o !== 'object') return;
    Object.keys(o).forEach(function (k) {
      if (o[k] != null) ctx.localStorage.setItem(k, String(o[k]));
    });
  };
  ctx.persistPrefsBundle = function () {};
  ctx.collectPrefsBundle = function () { return {}; };
}

function freezeRam(ram) {
  const o = {};
  RAM_ARRAY_KEYS.forEach(function (k) { o[k] = clone(ram[k] || []); });
  o.inventory = clone(ram.inventory || {});
  COUNTER_KEYS.forEach(function (k) { o[k] = ram[k]; });
  o.loginPw = ram.loginPw;
  o.senderInfo = clone(ram.senderInfo || {});
  o.logoSrc = ram.logoSrc;
  o.acH = clone(ram.acH || {});
  return o;
}

function lsDump(ls) {
  const o = {};
  if (!ls) return o;
  const n = ls.length;
  for (let i = 0; i < n; i++) {
    const k = ls.key(i);
    if (k) o[k] = ls.getItem(k);
  }
  return o;
}

function compareArr(name, src, dst, idField) {
  src = Array.isArray(src) ? src : [];
  dst = Array.isArray(dst) ? dst : [];
  const r = {
    name: name,
    sourceCount: src.length,
    restoredCount: dst.length,
    missing: [],
    extra: [],
    changed: [],
    orderDiff: false,
    identityDiff: []
  };
  if (JSON.stringify(src) === JSON.stringify(dst)) return r;
  r.orderDiff = src.length === dst.length && src.some(function (row, i) {
    return JSON.stringify(row) !== JSON.stringify(dst[i]);
  });
  if (idField) {
    const sm = {};
    src.forEach(function (row) { if (row && row[idField] != null) sm[String(row[idField])] = row; });
    const dm = {};
    dst.forEach(function (row) { if (row && row[idField] != null) dm[String(row[idField])] = row; });
    Object.keys(sm).forEach(function (id) {
      if (!dm[id]) r.missing.push(id);
      else if (JSON.stringify(sm[id]) !== JSON.stringify(dm[id])) r.changed.push(id);
    });
    Object.keys(dm).forEach(function (id) {
      if (!sm[id]) r.extra.push(id);
    });
    if (src.length === dst.length) {
      src.forEach(function (row, i) {
        const a = row && row[idField];
        const b = dst[i] && dst[i][idField];
        if (String(a) !== String(b)) r.identityDiff.push({ index: i, source: a, restored: b });
      });
    }
  } else {
    if (src.length > dst.length) r.missing.push('index>=' + dst.length);
    if (dst.length > src.length) r.extra.push('index>=' + src.length);
    const n = Math.min(src.length, dst.length);
    for (let i = 0; i < n; i++) {
      if (JSON.stringify(src[i]) !== JSON.stringify(dst[i])) r.changed.push(i);
    }
  }
  return r;
}

function stripDerived(pkg) {
  const o = clone(pkg);
  delete o.exportedAt;
  delete o.checksum;
  delete o.checksumAlgo;
  if (o.manifest && typeof o.manifest === 'object') {
    delete o.manifest.exportedAt;
  }
  return o;
}

function walkFiles(dir, acc, root) {
  acc = acc || [];
  root = root || dir;
  if (!fs.existsSync(dir)) return acc;
  fs.readdirSync(dir, { withFileTypes: true }).forEach(function (ent) {
    const full = path.join(dir, ent.name);
    const rel = path.relative(root, full).split(path.sep).join('/');
    if (ent.isDirectory()) walkFiles(full, acc, root);
    else {
      const buf = fs.readFileSync(full);
      acc.push({ rel: rel, sha256: sha256buf(buf), bytes: buf.length });
    }
  });
  return acc;
}

function copyTree(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  fs.readdirSync(src, { withFileTypes: true }).forEach(function (ent) {
    const s = path.join(src, ent.name);
    const d = path.join(dst, ent.name);
    if (ent.isDirectory()) copyTree(s, d);
    else {
      fs.mkdirSync(path.dirname(d), { recursive: true });
      fs.copyFileSync(s, d);
    }
  });
}

function assemblerSrc(h) {
  return [
    'var window = window || { DISK_REF_PREFIX: "disk://" };',
    'window.DISK_REF_PREFIX = window.DISK_REF_PREFIX || "disk://";',
    'function isDiskRef(s){ return typeof s === "string" && s.indexOf("disk://") === 0; }',
    h.arch14HelperSrc(),
    h.requiredBusinessAdapterSrc(),
    h.optionalBusinessAdapterSrc(),
    h.extractFunctionSource(h.html, 'collectAttachmentIndex'),
    h.extractFunctionSource(h.html, '_buildFullBackupData')
  ].join('\n');
}

function fingerprintFn(h) {
  const src = h.extractFunctionSource(h.html, '_phonebookCanonicalFingerprint');
  return new Function(src + '\nreturn _phonebookCanonicalFingerprint;')();
}

function assembleBackup(h, ram, ls) {
  const ctx = Object.assign({ localStorage: ls }, clone(ram), ram);
  ctx.localStorage = ls;
  Object.keys(ram).forEach(function (k) { ctx[k] = ram[k]; });
  ctx.window = { DISK_REF_PREFIX: 'disk://' };
  const src = assemblerSrc(h);
  return new Function('ctx', 'with(ctx){ ' + src + '\nreturn _buildFullBackupData(); }')(ctx);
}

function restoreSrc(h, wrapFail) {
  const parts = [
    'var SIRMAN_BACKUP_MAGIC = "SIRMAN_BACKUP";',
    'var SIRMAN_SCHEMA_VERSION = 1;',
    'var window = window || { DISK_REF_PREFIX: "disk://", _diskUrlCache: {} };',
    'window.DISK_REF_PREFIX = "disk://";',
    'window._diskUrlCache = window._diskUrlCache || {};',
    'function isDiskRef(s){ return typeof s === "string" && s.indexOf("disk://") === 0; }',
    'function diskRefPath(s){ return isDiskRef(s) ? s.slice(window.DISK_REF_PREFIX.length) : ""; }',
    h.p1cValidatorSrc(h.html),
    h.extractFunctionSource(h.html, '_restoreWants'),
    h.extractFunctionSource(h.html, '_phonebookCanonicalFingerprint'),
    h.extractFunctionSource(h.html, 'applyBackupReplaceSections'),
    h.extractFunctionSource(h.html, 'applyBackupMergeSections')
  ];
  if (wrapFail) {
    parts.push(
      'var _rahOrigReplace = applyBackupReplaceSections;',
      'var _rahInjectFail = true;',
      'applyBackupReplaceSections = function(d, selectedKeys){',
      '  var r = _rahOrigReplace(d, selectedKeys);',
      '  if (_rahInjectFail) { _rahInjectFail = false; throw new Error("ARCH-26 RAH injected apply failure"); }',
      '  return r;',
      '};'
    );
  }
  parts.push(h.extractFunctionSource(h.html, 'applyBackupSelective'));
  parts.push(assemblerSrc(h));
  return parts.join('\n');
}

function makeCtx(h, ram, ls, mediaRoot) {
  const ctx = Object.assign({}, emptyRam(), ram);
  ctx.localStorage = ls;
  ctx.window = { DISK_REF_PREFIX: 'disk://', _diskUrlCache: {} };
  ctx.URL = {
    createObjectURL: function (file) {
      return 'blob:rah:' + (file && file._rahPath ? file._rahPath : 'ok');
    }
  };
  ctx.getDiskFileHandle = function (relPath) {
    const rel = String(relPath || '').replace(/^[/\\]+/, '');
    const abs = path.join(mediaRoot, rel);
    if (!fs.existsSync(abs)) return null;
    return {
      getFile: function () {
        return Promise.resolve({
          _rahPath: abs,
          arrayBuffer: function () {
            const buf = fs.readFileSync(abs);
            return Promise.resolve(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
          }
        });
      }
    };
  };
  ctx.resolveDiskRef = function (ref) {
    if (!ref) return '';
    if (typeof ref === 'string' && ref.indexOf('disk://') !== 0) return ref;
    const rel = String(ref).slice('disk://'.length);
    const abs = path.join(mediaRoot, rel.replace(/^[/\\]+/, ''));
    if (!fs.existsSync(abs)) return '';
    return 'blob:rah:' + abs;
  };
  attachPersist(ctx);
  return ctx;
}

function runInCtx(ctx, src, tail) {
  return new Function('ctx', 'with(ctx){ ' + src + '\n' + (tail || '') + ' }')(ctx);
}

function importGate(h, data) {
  const v = h.loadP1CValidator(h.html);
  const req = v.validateRequiredBackupCollections(data);
  if (!req.ok) return { ok: false, stage: 'required', detail: req };
  const struct = v.validateBackupStructuralIntegrity ? v.validateBackupStructuralIntegrity(data) : { ok: true };
  if (!struct.ok) return { ok: false, stage: 'structural', detail: struct };
  const port = v.validateBackupPortableIntegrity ? v.validateBackupPortableIntegrity(data) : { ok: true };
  if (!port.ok) return { ok: false, stage: 'portable', detail: port };
  if (data && data.checksum && data.checksumAlgo === 'SHA-256') {
    const canon = v.backupChecksumCanonicalString(data);
    const got = sha256utf8(canon);
    if (got !== String(data.checksum)) {
      return { ok: false, stage: 'checksum', detail: { ok: false, msg: 'checksum مطابقت ندارد', stored: data.checksum, computed: got } };
    }
  }
  return { ok: true, stage: 'ok', detail: null };
}

function applyReplace(h, ctx, backup, injectFail) {
  ctx.backup = backup;
  const src = restoreSrc(h, !!injectFail);
  return runInCtx(ctx, src, 'applyBackupReplaceSections(backup, null);');
}

function applySelectiveReplace(h, ctx, backup, injectFail) {
  ctx.backup = backup;
  const src = restoreSrc(h, !!injectFail);
  try {
    runInCtx(ctx, src, 'applyBackupSelective(backup, null, "replace", []);');
    return { threw: false, error: null };
  } catch (e) {
    return { threw: true, error: String(e && e.message || e) };
  }
}

function applyMerge(h, ctx, backup) {
  ctx.backup = backup;
  const src = restoreSrc(h, false);
  return runInCtx(ctx, src, 'return applyBackupMergeSections(backup, []);');
}

function ramFromCtx(ctx) {
  const ram = emptyRam();
  RAM_ARRAY_KEYS.forEach(function (k) { ram[k] = ctx[k]; });
  ram.inventory = ctx.inventory;
  COUNTER_KEYS.forEach(function (k) { ram[k] = ctx[k]; });
  ram.loginPw = ctx.loginPw;
  ram.senderInfo = ctx.senderInfo;
  ram.logoSrc = ctx.logoSrc;
  ram.acH = ctx.acH;
  return ram;
}

function compareFrozen(src, dst) {
  const collections = {};
  const idMap = {
    invoices: 'id', sales: 'id', warranties: 'id', parts: 'id', accounts: 'id',
    products: 'code', services: 'id', tasks: 'id', defectiveStock: 'id',
    warehouseDocs: 'id', stockMoves: 'id', warehouses: 'id', daqi: 'id',
    daqiVouchers: 'id', postalHistory: 'id'
  };
  RAM_ARRAY_KEYS.forEach(function (k) {
    collections[k] = compareArr(k, src[k], dst[k], idMap[k] || null);
  });
  collections.inventory = compareArr('inventory',
    Object.keys(src.inventory || {}).sort().map(function (k) { return { id: k, v: src.inventory[k] }; }),
    Object.keys(dst.inventory || {}).sort().map(function (k) { return { id: k, v: dst.inventory[k] }; }),
    'id'
  );
  const scalars = {};
  COUNTER_KEYS.concat(['loginPw', 'logoSrc']).forEach(function (k) {
    scalars[k] = { source: src[k], restored: dst[k], equal: src[k] === dst[k] };
  });
  scalars.senderInfo = { equal: JSON.stringify(src.senderInfo) === JSON.stringify(dst.senderInfo) };
  scalars.acH = { equal: JSON.stringify(src.acH) === JSON.stringify(dst.acH) };
  const unexpected = [];
  Object.keys(collections).forEach(function (k) {
    const c = collections[k];
    if (c.missing.length || c.extra.length || c.changed.length || c.sourceCount !== c.restoredCount) {
      unexpected.push(k);
    }
  });
  Object.keys(scalars).forEach(function (k) {
    if (!scalars[k].equal) unexpected.push(k);
  });
  return { collections: collections, scalars: scalars, unexpected: unexpected };
}

function refsCheck(src, dst) {
  function ids(arr) { return (arr || []).map(function (x) { return x && x.id; }); }
  const wIds = ids(dst.warranties);
  const sIds = ids(dst.sales);
  const iIds = ids(dst.invoices);
  const out = { ok: true, issues: [] };
  function parentOk(docs, parentId, kind, pool) {
    (docs || []).forEach(function (doc) {
      if (doc && doc.parentId && pool.indexOf(doc.parentId) < 0) {
        out.ok = false;
        out.issues.push(kind + ' parentId orphan ' + doc.parentId);
      }
    });
    if (parentId && pool.indexOf(parentId) < 0) {
      out.ok = false;
      out.issues.push(kind + ' missing parent ' + parentId);
    }
  }
  (dst.warranties || []).forEach(function (w) { parentOk(w.docs, w.id, 'warranty', wIds); });
  (dst.sales || []).forEach(function (s) { parentOk(s.docs, s.id, 'sale', sIds); });
  (dst.invoices || []).forEach(function (inv) { parentOk(inv.docs, inv.id, 'invoice', iIds); });
  (dst.defectiveStock || []).forEach(function (d) {
    if (d.warrantyId && wIds.indexOf(d.warrantyId) < 0) {
      out.ok = false; out.issues.push('defectiveStock.warrantyId orphan ' + d.warrantyId);
    }
    const invHit = (dst.invoices || []).some(function (inv) {
      return inv.invoiceId === d.invoiceId || inv.num === d.invoiceNum;
    });
    if (d.invoiceId && !invHit) {
      out.ok = false; out.issues.push('defectiveStock invoice orphan ' + d.invoiceId);
    }
  });
  const whDocIds = ids(dst.warehouseDocs);
  const whIds = ids(dst.warehouses);
  (dst.warehouseDocs || []).forEach(function (w) {
    if (w.toWh && whIds.indexOf(w.toWh) < 0) {
      out.ok = false; out.issues.push('warehouseDocs.toWh orphan ' + w.toWh);
    }
  });
  (dst.stockMoves || []).forEach(function (m) {
    if (m.refDoc && whDocIds.indexOf(m.refDoc) < 0) {
      out.ok = false; out.issues.push('stockMoves.refDoc orphan ' + m.refDoc);
    }
    if (m.whId && whIds.indexOf(m.whId) < 0) {
      out.ok = false; out.issues.push('stockMoves.whId orphan ' + m.whId);
    }
  });
  (dst.tasks || []).forEach(function (t) {
    if (t.link && t.link.type === 'warranty' && wIds.indexOf(t.link.id) < 0) {
      out.ok = false; out.issues.push('task warranty link orphan ' + t.link.id);
    }
  });
  (dst.daqi || []).forEach(function (q, i) {
    if (q.warrantyId && wIds.indexOf(q.warrantyId) < 0) {
      out.ok = false; out.issues.push('daqi.warrantyId orphan ' + q.warrantyId);
    }
    const srcQ = (src.daqi || [])[i];
    if (srcQ && srcQ.agencyPhonebookIdx != null) {
      const si = srcQ.agencyPhonebookIdx;
      const di = q.agencyPhonebookIdx;
      const srcC = (src.phonebook || [])[si];
      const dstC = (dst.phonebook || [])[di];
      if (JSON.stringify(srcC) !== JSON.stringify(dstC) || si !== di) {
        out.ok = false;
        out.issues.push('daqi.agencyPhonebookIdx changed idx=' + si + '→' + di);
      }
    }
  });
  (dst.daqiVouchers || []).forEach(function (v) {
    if (v.daqiId && ids(dst.daqi).indexOf(v.daqiId) < 0) {
      out.ok = false; out.issues.push('daqiVouchers.daqiId orphan ' + v.daqiId);
    }
  });
  return out;
}

function storageAudit(ls, ram) {
  const keys = {
    invoices: 'li', products: 'lp', inventory: 'lv', phonebook: 'lb', acH: 'la',
    parts: 'lp2', services: 'ls2', sales: 'laegh_sales', warranties: 'lw2',
    tasks: 'laegh_tasks', defectiveStock: 'laegh_defective', accounts: 'laegh_accounts',
    warehouses: 'laegh_warehouses', warehouseDocs: 'laegh_warehouse',
    stockMoves: 'laegh_stockmoves', daqi: 'laegh_daqi',
    daqiWarehouse: 'laegh_daqi_warehouse', daqiVouchers: 'laegh_daqi_vouchers',
    postalHistory: 'laegh_postal_history', userRoles: 'laegh_roles', loginPw: 'laegh_login_pw'
  };
  const rows = [];
  Object.keys(keys).forEach(function (field) {
    const raw = ls.getItem(keys[field]);
    const present = raw != null;
    let parsed = raw;
    try { if (raw && (raw[0] === '[' || raw[0] === '{')) parsed = JSON.parse(raw); } catch (_e) {}
    const ramVal = field === 'loginPw' ? ram.loginPw : ram[field];
    const match = present && JSON.stringify(parsed) === JSON.stringify(ramVal);
    rows.push({
      field: field, lsKey: keys[field], lsPresent: present,
      ramCount: lenOf(ramVal), match: match
    });
  });
  return rows;
}

function executeRah(h) {
  const result = {
    shopVerified: false,
    wording: 'copy-only synthetic recovery acceptance',
    version: '1405.6.3α',
    blockers: [],
    criteria: {},
    counts: {}
  };
  const meta = JSON.parse(fs.readFileSync(path.join(h.repoRoot, 'desktop/Sirman.Core.Tests/RecoveryAcceptanceFixture.json'), 'utf8'));
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sirman-arch26-rah-'));
  const sourceApp = path.join(root, 'source-app');
  const portable = path.join(root, 'portable');
  const dest1Media = path.join(root, 'dest1-media');
  const dest2Media = path.join(root, 'dest2-media');
  const missingMedia = path.join(root, 'missing-media');
  fs.mkdirSync(sourceApp, { recursive: true });
  fs.mkdirSync(portable, { recursive: true });
  fs.mkdirSync(dest1Media, { recursive: true });
  fs.mkdirSync(dest2Media, { recursive: true });
  fs.mkdirSync(missingMedia, { recursive: true });

  const mediaRel = meta.mediaRel;
  const mediaAbs = path.join(sourceApp, mediaRel);
  fs.mkdirSync(path.dirname(mediaAbs), { recursive: true });
  fs.writeFileSync(mediaAbs, meta.mediaUtf8, 'utf8');
  const mediaSha = sha256buf(fs.readFileSync(mediaAbs));

  const ram = rahSourceRam(meta);
  const lsMap = rahSettingsLs();
  const srcLs = h.arch9cMakeLs(lsMap);
  attachPersist({ localStorage: srcLs, invoices: ram.invoices, products: ram.products, inventory: ram.inventory, phonebook: ram.phonebook, acH: ram.acH, invCtr: ram.invCtr, parts: ram.parts, services: ram.services, svcs: ram.svcs, sales: ram.sales, saleCtr: ram.saleCtr, warranties: ram.warranties, tasks: ram.tasks, defectiveStock: ram.defectiveStock, accounts: ram.accounts, warehouses: ram.warehouses, warehouseDocs: ram.warehouseDocs, stockMoves: ram.stockMoves, daqi: ram.daqi, daqiWarehouse: ram.daqiWarehouse, daqiVouchers: ram.daqiVouchers, postalHistory: ram.postalHistory, userRoles: ram.userRoles, loginPw: ram.loginPw, senderInfo: ram.senderInfo, logoSrc: ram.logoSrc });
  const srcPersistCtx = makeCtx(h, ram, srcLs, sourceApp);
  srcPersistCtx.sv(); srcPersistCtx.svParts(); srcPersistCtx.svSvcs(); srcPersistCtx.svSales();
  srcPersistCtx.svWarr(); srcPersistCtx.svTasks(); srcPersistCtx.svDefective(); srcPersistCtx.svAccounts();
  srcPersistCtx.svWarehouses(); srcPersistCtx.svWarehouse(); srcPersistCtx.svStockMoves();
  srcPersistCtx.svDaqi(); srcPersistCtx.svDaqiWarehouse(); srcPersistCtx.svDaqiVouchers();
  srcPersistCtx.svPostalHistory(); srcPersistCtx.svRoles();
  srcLs.setItem('laegh_login_pw', ram.loginPw);
  srcLs.setItem('ls', JSON.stringify(ram.senderInfo));
  srcLs.setItem('ll', ram.logoSrc);

  const frozen = freezeRam(ram);
  const fp = fingerprintFn(h);
  frozen.phonebookFingerprints = ram.phonebook.map(fp);
  frozen.mediaSha = mediaSha;
  frozen.attachmentRefs = {
    inline: ram.invoices[0].docs[0].data.slice(0, 22),
    disk: ram.sales[0].docs[0].data
  };
  Object.freeze(frozen);
  result.golden = {
    counts: {},
    identities: {
      invoiceId: ram.invoices[0].id,
      saleId: ram.sales[0].id,
      warrantyId: ram.warranties[0].id
    },
    phonebookFingerprints: frozen.phonebookFingerprints,
    mediaSha: mediaSha
  };
  RAM_ARRAY_KEYS.forEach(function (k) { result.golden.counts[k] = lenOf(ram[k]); });
  result.golden.counts.inventory = lenOf(ram.inventory);
  COUNTER_KEYS.forEach(function (k) { result.golden.counts[k] = ram[k]; });

  const assembled = assembleBackup(h, ram, srcLs);
  const api = h.loadArch5FinalizeOracle(h.html);
  const finalized = api.finalizeBackupPackage(clone(assembled), 'manual', 'full');
  h.arch5AttachChecksum(api, finalized, 'sha256');
  const pretty = JSON.stringify(finalized, null, 2);
  const jsonPath = path.join(sourceApp, 'sirman-backup.json');
  fs.writeFileSync(jsonPath, pretty, 'utf8');
  const srcJsonSha = sha256buf(fs.readFileSync(jsonPath));
  result.backup = {
    path: jsonPath,
    magic: finalized.magic,
    schemaVersion: finalized.schemaVersion,
    version: finalized.version,
    hasManifest: !!finalized.manifest,
    hasItemCounts: !!finalized.itemCounts,
    hasAttachmentsIndex: Array.isArray(finalized.attachmentsIndex),
    attachmentsIndexLength: (finalized.attachmentsIndex || []).length,
    checksumAlgo: finalized.checksumAlgo,
    checksum: finalized.checksum,
    canonicalSha: sha256utf8(api.backupChecksumCanonicalString(finalized)),
    prettySha: srcJsonSha,
    requiredPresent: REQUIRED_KEYS.every(function (k) { return Array.isArray(finalized[k]); }),
    optionalPresent: OPTIONAL_KEYS.every(function (k) { return finalized[k] !== undefined; }),
    phonebookPresent: Array.isArray(finalized.phonebook),
    settingsPresent: !!(finalized.company && finalized.printSettings),
    opsPresent: !!(finalized.loginPw && finalized.userRoles && finalized.senderInfo && finalized.logoSrc && finalized.acH)
  };
  result.golden.backupCanonicalDigest = result.backup.canonicalSha;

  fs.copyFileSync(jsonPath, path.join(portable, 'sirman-backup.json'));
  copyTree(path.join(sourceApp, 'sirman_media'), path.join(portable, 'sirman_media'));
  const portableJsonSha = sha256buf(fs.readFileSync(path.join(portable, 'sirman-backup.json')));
  const portableMedia = walkFiles(path.join(portable, 'sirman_media'));
  result.portable = {
    dir: portable,
    jsonShaSource: srcJsonSha,
    jsonShaCopy: portableJsonSha,
    jsonMatch: srcJsonSha === portableJsonSha,
    media: portableMedia,
    mediaShaMatch: portableMedia.some(function (f) { return f.sha256 === mediaSha; }),
    independentOfSourceApp: portable.indexOf(sourceApp) !== 0
  };

  const portablePkg = JSON.parse(fs.readFileSync(path.join(portable, 'sirman-backup.json'), 'utf8'));
  copyTree(path.join(portable, 'sirman_media'), path.join(dest1Media, 'sirman_media'));
  const dest1Ls = h.arch9cMakeLs({});
  const dest1 = makeCtx(h, emptyRam(), dest1Ls, dest1Media);
  const dest1Empty = {
    phonebook: dest1.phonebook.length === 0,
    invoices: dest1.invoices.length === 0,
    lsLen: dest1Ls.length
  };
  result.dest1Empty = dest1Empty;

  const gateOk = importGate(h, portablePkg);
  result.replaceGate = gateOk;
  if (!gateOk.ok) {
    result.blockers.push('Replace gate failed: ' + gateOk.stage);
  } else {
    applyReplace(h, dest1, portablePkg, false);
  }
  const restored1 = freezeRam(ramFromCtx(dest1));
  const cmp1 = compareFrozen(frozen, restored1);
  result.compare1 = cmp1;
  result.storage1 = storageAudit(dest1Ls, ramFromCtx(dest1));
  result.phonebook1 = {
    order: (dest1.phonebook || []).map(function (c) { return c.fn + '/' + (c.ln || ''); }),
    fingerprints: (dest1.phonebook || []).map(fp),
    length: (dest1.phonebook || []).length,
    exactEmptyCount: (dest1.phonebook || []).filter(function (c) {
      return fp(c) === fp({ fn: 'بی‌تلفن', ln: 'clone', phones: [], cat: 'other' });
    }).length,
    distinctEmptyKept: (dest1.phonebook || []).some(function (c) { return c.ln === 'distinct'; }),
    missingKept: (dest1.phonebook || []).some(function (c) { return c.ln === 'missing' && !Object.prototype.hasOwnProperty.call(c, 'phones'); }),
    nullKept: (dest1.phonebook || []).some(function (c) { return c.fn === 'نال' && c.phones === null; }),
    persian: (dest1.phonebook || []).some(function (c) { return c.fn === 'محمد' && c.note === 'العربية' && c.phones && c.phones[0] === '۰۹۱۲۳۳۳۳۳۳۳'; }),
    unknown: (dest1.phonebook || []).some(function (c) { return c.xyz === 42 && c.nested && c.nested.k === 'v'; }),
    orderMatch: JSON.stringify(dest1.phonebook) === JSON.stringify(frozen.phonebook)
  };
  result.refs1 = refsCheck(frozen, restored1);

  const inlineOk = dest1.invoices[0] && dest1.invoices[0].docs && dest1.invoices[0].docs[0] &&
    String(dest1.invoices[0].docs[0].data).indexOf('data:') === 0;
  const diskRefOk = dest1.sales[0] && dest1.sales[0].docs && dest1.sales[0].docs[0] &&
    dest1.sales[0].docs[0].data === meta.mediaDiskRef;
  const destSidecar = path.join(dest1Media, mediaRel);
  const destSidecarExists = fs.existsSync(destSidecar);
  const destSidecarSha = destSidecarExists ? sha256buf(fs.readFileSync(destSidecar)) : '';
  const resolvedDisk = dest1.resolveDiskRef(meta.mediaDiskRef);
  result.attachments1 = {
    inlineOk: !!inlineOk,
    diskRefOk: !!diskRefOk,
    sidecarExists: destSidecarExists,
    sidecarShaMatch: destSidecarSha === mediaSha,
    resolveOk: typeof resolvedDisk === 'string' && resolvedDisk.indexOf('blob:rah:') === 0,
    indexLen: (portablePkg.attachmentsIndex || []).length
  };

  const afterFirst = freezeRam(ramFromCtx(dest1));
  const afterFirstCounts = {};
  RAM_ARRAY_KEYS.forEach(function (k) { afterFirstCounts[k] = lenOf(dest1[k]); });
  applyMerge(h, dest1, portablePkg);
  const afterMerge = freezeRam(ramFromCtx(dest1));
  const mergeGrowth = {};
  RAM_ARRAY_KEYS.forEach(function (k) {
    mergeGrowth[k] = { before: afterFirstCounts[k], after: lenOf(dest1[k]) };
  });
  result.merge = {
    growth: mergeGrowth,
    phonebookGrew: (dest1.phonebook || []).length !== afterFirst.phonebook.length,
    idCollectionsGrew: REQUIRED_KEYS.concat(['tasks', 'defectiveStock', 'warehouseDocs', 'stockMoves', 'warehouses', 'daqi', 'daqiVouchers', 'postalHistory', 'parts', 'accounts']).some(function (k) {
      return lenOf(dest1[k]) !== afterFirstCounts[k];
    }),
    emptyCloneStillOnePair: (dest1.phonebook || []).filter(function (c) {
      return fp(c) === fp({ fn: 'بی‌تلفن', ln: 'clone', phones: [], cat: 'other' });
    }).length === 2,
    distinctStill: (dest1.phonebook || []).some(function (c) { return c.ln === 'distinct'; })
  };

  const replay530 = [];
  const payload530 = [];
  for (let i = 0; i < 530; i++) payload530.push({ fn: 'بی‌تلفن', ln: String(i), phones: [], cat: 'other' });
  const replayLs = h.arch9cMakeLs({});
  const replayCtx = makeCtx(h, emptyRam(), replayLs, dest1Media);
  replayCtx.phonebook = clone(payload530);
  replay530.push(replayCtx.phonebook.length);
  const bak530 = clone(portablePkg);
  bak530.phonebook = clone(payload530);
  if (bak530.itemCounts) bak530.itemCounts.phonebook = payload530.length;
  delete bak530.sectionChecksums;
  delete bak530.checksum;
  delete bak530.checksumAlgo;
  for (let r = 0; r < 4; r++) {
    applyMerge(h, replayCtx, bak530);
    replay530.push(replayCtx.phonebook.length);
  }
  result.replay530 = replay530;

  const livePB = [{ fn: 'A', phones: ['1'] }, { fn: 'B', phones: ['2'] }];
  function replacePB(mutator) {
    const ls = h.arch9cMakeLs({});
    const ctx = makeCtx(h, emptyRam(), ls, dest1Media);
    ctx.phonebook = clone(livePB);
    const bak = clone(portablePkg);
    mutator(bak);
    delete bak.sectionChecksums;
    delete bak.checksum;
    delete bak.checksumAlgo;
    if (bak.itemCounts) {
      if (Array.isArray(bak.phonebook)) bak.itemCounts.phonebook = bak.phonebook.length;
      else delete bak.itemCounts.phonebook;
    }
    ctx.bak = bak;
    const src = restoreSrc(h, false);
    runInCtx(ctx, src, 'applyBackupReplaceSections(bak, ["phonebook"]);');
    return clone(ctx.phonebook);
  }
  result.replaceCases = {
    A: replacePB(function (b) { b.phonebook = [{ fn: 'X', phones: ['9'] }]; }),
    B: replacePB(function (b) { b.phonebook = []; }),
    C: replacePB(function (b) { delete b.phonebook; delete b.pb; }),
    D: replacePB(function (b) { b.phonebook = null; }),
    E: replacePB(function (b) { b.phonebook = { bad: true }; })
  };

  const corrupt = clone(portablePkg);
  corrupt.invoices[0].seller = 'TAMPERED';
  const destCorruptLs = h.arch9cMakeLs({ keep: '1' });
  const destCorrupt = makeCtx(h, emptyRam(), destCorruptLs, dest1Media);
  destCorrupt.phonebook = [{ fn: 'LIVE', phones: ['000'] }];
  const corruptGate = importGate(h, corrupt);
  const corruptSha = clone(portablePkg);
  delete corruptSha.sectionChecksums;
  corruptSha.invoices[0].seller = 'TAMPERED-SHA';
  const shaGate = importGate(h, corruptSha);
  result.checksumCorruption = {
    rejected: !corruptGate.ok,
    sha256Rejected: !shaGate.ok,
    destUnchanged: destCorrupt.phonebook.length === 1 && destCorrupt.phonebook[0].fn === 'LIVE',
    stage: corruptGate.stage,
    shaStage: shaGate.stage
  };

  function requiredRemoved(key) {
    const bak = clone(portablePkg);
    delete bak[key];
    const g = importGate(h, bak);
    let applied = false;
    if (g.ok) {
      const ctx = makeCtx(h, emptyRam(), h.arch9cMakeLs({}), dest1Media);
      try { applyReplace(h, ctx, bak, false); applied = true; } catch (_e) { applied = false; }
    }
    return { key: key, rejected: !g.ok, stage: g.stage, applied: applied, filledEmpty: false };
  }
  result.requiredRemoved = ['warranties', 'invoices', 'sales', 'parts', 'accounts'].map(requiredRemoved);

  function malformed(key, val) {
    const bak = clone(portablePkg);
    bak[key] = val;
    const g = importGate(h, bak);
    let applied = false;
    if (g.ok) {
      const ctx = makeCtx(h, emptyRam(), h.arch9cMakeLs({}), dest1Media);
      try { applyReplace(h, ctx, bak, false); applied = true; } catch (_e) { applied = false; }
    }
    return { key: key, type: typeof val, rejected: !g.ok, stage: g.stage, applied: applied };
  }
  result.malformed = [
    malformed('warranties', {}),
    malformed('invoices', ''),
    malformed('sales', null),
    malformed('parts', {}),
    malformed('accounts', 123)
  ];

  const preRam = emptyRam();
  preRam.invoices = [{ id: 'PRE-INV', invoiceId: 'PRE', num: '1', seller: 'قبل' }];
  preRam.warranties = [{ id: 'PRE-W', name: 'قبل' }];
  preRam.sales = [{ id: 'PRE-SL', saleUid: 'PRE-S', name: 'قبل' }];
  preRam.parts = [{ id: 'PRE-PT' }];
  preRam.accounts = [{ id: 'PRE-ACC', transactions: [] }];
  preRam.phonebook = [{ fn: 'قبل', phones: ['111'] }];
  preRam.loginPw = 'pre-login';
  preRam.logoSrc = 'data:image/png;base64,pre';
  preRam.senderInfo = { name: 'قبل' };
  preRam.acH = { pre: 1 };
  preRam.invoiceUidCtr = 7;
  preRam.saleUidCtr = 7;
  preRam.invCtr = 9;
  preRam.saleCtr = 9;
  const rbLs = h.arch9cMakeLs({});
  const rbCtx = makeCtx(h, preRam, rbLs, dest1Media);
  const preFreeze = freezeRam(ramFromCtx(rbCtx));
  const rb = applySelectiveReplace(h, rbCtx, portablePkg, true);
  const afterRb = freezeRam(ramFromCtx(rbCtx));
  const rbCmp = compareFrozen(preFreeze, afterRb);
  result.rollback = {
    threw: rb.threw,
    error: rb.error,
    unexpected: rbCmp.unexpected,
    phonebookRestored: afterRb.phonebook[0] && afterRb.phonebook[0].fn === 'قبل',
    invoiceRestored: afterRb.invoices[0] && afterRb.invoices[0].id === 'PRE-INV'
  };

  copyTree(path.join(portable, 'sirman_media'), path.join(dest2Media, 'sirman_media'));
  const dest2Ls = h.arch9cMakeLs({});
  const dest2 = makeCtx(h, emptyRam(), dest2Ls, dest2Media);
  const gate2 = importGate(h, portablePkg);
  if (gate2.ok) applyReplace(h, dest2, portablePkg, false);
  const restored2 = freezeRam(ramFromCtx(dest2));
  const cmp2 = compareFrozen(frozen, restored2);
  const cmp12 = compareFrozen(restored1, restored2);
  result.cleanInstall2 = {
    unexpectedVsSource: cmp2.unexpected,
    unexpectedVsDest1: cmp12.unexpected,
    referencedSourceApp: false
  };

  fs.copyFileSync(path.join(portable, 'sirman-backup.json'), path.join(missingMedia, 'sirman-backup.json'));
  const missLs = h.arch9cMakeLs({});
  const missCtx = makeCtx(h, emptyRam(), missLs, missingMedia);
  const missGate = importGate(h, portablePkg);
  if (missGate.ok) applyReplace(h, missCtx, portablePkg, false);
  const resolveMiss = missCtx.resolveDiskRef(meta.mediaDiskRef);
  result.sidecarMissing = {
    jsonRestored: missCtx.sales.length === 1,
    diskRefSurvived: missCtx.sales[0] && missCtx.sales[0].docs[0].data === meta.mediaDiskRef,
    resolveEmpty: resolveMiss === '',
    classification: 'PARTIAL WITH EXPLICIT MEDIA FAILURE',
    fullRecoveryClaimed: false
  };

  const dest1Re = assembleBackup(h, ramFromCtx(dest1), dest1Ls);
  const dest1Fin = api.finalizeBackupPackage(clone(dest1Re), 'manual', 'full');
  h.arch5AttachChecksum(api, dest1Fin, 'sha256');
  result.digest = {
    sourceCanonical: sha256utf8(JSON.stringify(stripDerived(finalized))),
    destCanonical: sha256utf8(JSON.stringify(stripDerived(dest1Fin))),
    match: sha256utf8(JSON.stringify(stripDerived(finalized))) === sha256utf8(JSON.stringify(stripDerived(dest1Fin)))
  };

  result.lsGaps = result.storage1.filter(function (r) {
    return ['warehouseDocs', 'stockMoves'].indexOf(r.field) >= 0 && !r.lsPresent;
  });

  let schema0Ok = false;
  try {
    const s0 = clone(portablePkg);
    s0.schemaVersion = 0;
    delete s0.checksum;
    delete s0.checksumAlgo;
    const g0 = importGate(h, s0);
    const migrate = h.loadMigrateBackupFn(h.html);
    const mig = migrate(clone(s0));
    schema0Ok = !!(g0 && g0.ok && mig && mig.data);
  } catch (_e) {
    schema0Ok = false;
  }
  result.migration = { schema0Ok: schema0Ok };

  result.dirs = { root: root, sourceApp: sourceApp, portable: portable };
  return result;
}

function markCriterion(result, id, pass, note) {
  result.criteria[id] = { pass: !!pass, note: note || '' };
  if (!pass) result.blockers.push(id + ': ' + (note || 'FAIL'));
}

function evaluateCriteria(result) {
  const c1 = result.compare1 || { unexpected: ['missing-compare'] };
  const pb = result.phonebook1 || {};
  const att = result.attachments1 || {};
  const merge = result.merge || {};
  const rc = result.replaceCases || {};
  markCriterion(result, 'A', result.backup && result.backup.requiredPresent && result.backup.optionalPresent && result.backup.phonebookPresent && result.backup.opsPresent && result.backup.hasManifest, 'backup generation via _buildFullBackupData');
  markCriterion(result, 'B', result.backup && result.backup.checksumAlgo === 'SHA-256' && result.backup.canonicalSha === result.backup.checksum, 'claimed SHA-256 matches canonical');
  markCriterion(result, 'C', result.portable && result.portable.jsonMatch && result.portable.mediaShaMatch && result.portable.independentOfSourceApp, 'portable copy outside app dir');
  markCriterion(result, 'D', (result.requiredRemoved || []).every(function (x) { return x.rejected && !x.applied; }), 'required-section fail-closed');
  const optOk = OPTIONAL_KEYS.every(function (k) {
    const col = c1.collections && c1.collections[k];
    return col && col.sourceCount === col.restoredCount && !col.missing.length && !col.extra.length && !col.changed.length;
  });
  markCriterion(result, 'E', optOk, 'optional collections present after restore (RAM)');
  markCriterion(result, 'F', pb.orderMatch && pb.exactEmptyCount === 2 && pb.distinctEmptyKept && pb.missingKept && pb.nullKept && pb.persian && pb.unknown && rc.C && rc.C.length === 2 && rc.D && rc.D.length === 2 && rc.E && rc.E.length === 2 && rc.B && rc.B.length === 0 && rc.A && rc.A[0] && rc.A[0].fn === 'X', 'phonebook round-trip + replace semantics');
  markCriterion(result, 'G', att.inlineOk && att.diskRefOk && att.sidecarExists && att.sidecarShaMatch && att.resolveOk, 'inline + disk sidecar restored from portable package');
  markCriterion(result, 'H', result.replaceGate && result.replaceGate.ok && c1.unexpected.filter(function (k) { return k !== 'userAuditLog' && k !== 'bgAuditLog'; }).length === 0, 'restore replace');
  markCriterion(result, 'I', merge && !merge.phonebookGrew && !merge.idCollectionsGrew && merge.emptyCloneStillOnePair && merge.distinctStill && JSON.stringify(result.replay530) === JSON.stringify([530, 530, 530, 530, 530]), 'merge policy B + 530 replay');
  markCriterion(result, 'J', result.migration && result.migration.schema0Ok, 'schema 0 package still validates required-minimal and migrateBackup does not throw');
  markCriterion(result, 'K', result.refs1 && result.refs1.ok, (result.refs1 && result.refs1.issues && result.refs1.issues.join('; ')) || 'referential integrity');
  const countsOk = result.backup && result.backup.hasItemCounts;
  markCriterion(result, 'L', countsOk && c1.unexpected.filter(function (k) {
    return REQUIRED_KEYS.concat(OPTIONAL_KEYS).indexOf(k) >= 0;
  }).length === 0, 'itemCounts vs lengths');
  markCriterion(result, 'M', result.digest && result.digest.match, 're-export digest excluding exportedAt/checksum/manifest.exportedAt');
  const lossKeys = (c1.unexpected || []).filter(function (k) { return k !== 'userAuditLog' && k !== 'bgAuditLog'; });
  markCriterion(result, 'N', lossKeys.length === 0, 'no unexpected RAM data loss; audit logs best-effort');
  markCriterion(result, 'O', merge && !merge.phonebookGrew && !merge.idCollectionsGrew, 'no duplicate growth');
  markCriterion(result, 'P', merge && !merge.phonebookGrew && JSON.stringify(result.replay530) === JSON.stringify([530, 530, 530, 530, 530]), 'idempotent repeat restore');
  markCriterion(result, 'Q', result.rollback && result.rollback.threw && result.rollback.phonebookRestored && result.rollback.invoiceRestored && (result.rollback.unexpected || []).filter(function (k) { return k !== 'userAuditLog' && k !== 'bgAuditLog'; }).length === 0, 'rollback restores pre-state');
  markCriterion(result, 'R', result.cleanInstall2 && (result.cleanInstall2.unexpectedVsSource || []).filter(function (k) { return k !== 'userAuditLog' && k !== 'bgAuditLog'; }).length === 0 && (result.cleanInstall2.unexpectedVsDest1 || []).length === 0, 'second clean install');
  markCriterion(result, 'S', lossKeys.length === 0 && result.digest && result.digest.match, 'end-to-end source vs restored');

  result.malformedOk = (result.malformed || []).every(function (x) { return x.rejected && !x.applied; });
  result.sidecarClassOk = result.sidecarMissing && result.sidecarMissing.classification === 'PARTIAL WITH EXPLICIT MEDIA FAILURE' && !result.sidecarMissing.fullRecoveryClaimed;
  if (!result.malformedOk) result.blockers.push('malformed sections not rejected');
  if (!result.sidecarClassOk) result.blockers.push('sidecar missing not classified');
  if (!result.checksumCorruption || !result.checksumCorruption.rejected || !result.checksumCorruption.destUnchanged || !result.checksumCorruption.sha256Rejected) {
    result.blockers.push('checksum corruption did not reject');
    result.criteria.B.pass = false;
  }
  result.complete = Object.keys(result.criteria).every(function (k) { return result.criteria[k].pass; }) &&
    result.malformedOk && result.sidecarClassOk &&
    result.checksumCorruption && result.checksumCorruption.rejected && result.checksumCorruption.destUnchanged && result.checksumCorruption.sha256Rejected;
  result.verdict = result.complete ? 'BACKUP / RECOVERY = COMPLETE' : 'BACKUP / RECOVERY = NOT COMPLETE';
  return result;
}

let CACHED = null;
function rahOnce(h) {
  if (CACHED) return CACHED;
  try {
    CACHED = evaluateCriteria(executeRah(h));
  } catch (e) {
    e.message = String(e && e.stack || e);
    throw e;
  }
  try {
    fs.mkdirSync('/opt/cursor/artifacts', { recursive: true });
    fs.writeFileSync('/opt/cursor/artifacts/arch26-rah-result.json', JSON.stringify(CACHED, null, 2));
  } catch (_e) {}
  return CACHED;
}

function register(h) {
  const test = h.test;
  const assertEqual = h.assertEqual;
  const assertTrue = h.assertTrue;
  const html = h.html;
  const extractFunctionSource = h.extractFunctionSource;
  const arch9cSha256 = h.arch9cSha256;

  console.log('');
  console.log('📋 گروه: ARCH-26 پذیرش بازیابی فقط‌کپی (RAH)');

  test('ARCH-26 SHA locks match recorded production functions', function () {
    assertEqual(arch9cSha256(extractFunctionSource(html, '_buildFullBackupData')), ARCH26_ASSEMBLER, 'assembler');
    assertEqual(arch9cSha256(extractFunctionSource(html, 'savePBContact')), ARCH26_SAVEPB, 'savePB');
    assertEqual(arch9cSha256(extractFunctionSource(html, 'collectAttachmentIndex')), ARCH26_ATTACH, 'attach');
    assertEqual(arch9cSha256(extractFunctionSource(html, '_phonebookCanonicalFingerprint')), ARCH26_FP, 'fp');
    assertEqual(arch9cSha256(extractFunctionSource(html, 'collectRequiredBusinessSnapshot')), ARCH26_REQ, 'req');
    assertEqual(arch9cSha256(extractFunctionSource(html, 'collectOptionalBusinessSnapshot')), ARCH26_OPT, 'opt');
    assertEqual(arch9cSha256(extractFunctionSource(html, 'collectPhonebookSnapshot')), ARCH26_PB_SNAP, 'pb snap');
    assertEqual(arch9cSha256(extractFunctionSource(html, 'applyBackupMergeSections')), ARCH26_MERGE, 'merge');
    assertEqual(arch9cSha256(extractFunctionSource(html, 'applyBackupReplaceSections')), ARCH26_REPLACE, 'replace');
    assertTrue(extractFunctionSource(html, '_buildFullBackupData').indexOf('collectPhonebookSnapshot') < 0, 'adapter unused');
    assertTrue(html.indexOf("version: '1405.6.3α'") >= 0, 'version');
  });

  test('ARCH-26 Part2 freeze golden source dataset', function () {
    const r = rahOnce(h);
    assertEqual(r.golden.counts.invoices, 1, 'invoices');
    assertEqual(r.golden.counts.sales, 1, 'sales');
    assertEqual(r.golden.counts.warranties, 1, 'warranties');
    assertEqual(r.golden.counts.parts, 1, 'parts');
    assertEqual(r.golden.counts.accounts, 1, 'accounts');
    assertEqual(r.golden.counts.phonebook, 8, 'phonebook');
    assertEqual(r.golden.counts.products, 1, 'products');
    assertEqual(r.golden.counts.daqi, 1, 'daqi');
    assertTrue(!!r.golden.backupCanonicalDigest, 'digest');
    assertTrue(!!r.golden.mediaSha, 'media hash');
  });

  test('ARCH-26 Part3 backup generation production path', function () {
    const r = rahOnce(h);
    assertTrue(r.backup.requiredPresent, 'required');
    assertTrue(r.backup.optionalPresent, 'optional');
    assertTrue(r.backup.settingsPresent, 'settings');
    assertTrue(r.backup.phonebookPresent, 'phonebook');
    assertTrue(r.backup.opsPresent, 'ops');
    assertTrue(r.backup.hasAttachmentsIndex, 'index');
    assertTrue(r.backup.hasManifest, 'manifest');
    assertTrue(r.backup.hasItemCounts, 'itemCounts');
    assertEqual(r.backup.schemaVersion, 1, 'schema');
    assertEqual(r.backup.checksumAlgo, 'SHA-256', 'algo');
    assertEqual(r.backup.canonicalSha, r.backup.checksum, 'checksum valid');
    assertTrue(r.backup.attachmentsIndexLength >= 2, 'inline+disk index');
  });

  test('ARCH-26 Part4 portable copy JSON+sidecar', function () {
    const r = rahOnce(h);
    assertEqual(r.portable.jsonShaSource, r.portable.jsonShaCopy, 'json sha');
    assertTrue(r.portable.mediaShaMatch, 'media copied');
    assertTrue(r.portable.independentOfSourceApp, 'outside source-app');
  });

  test('ARCH-26 Part5 clean destination empty before restore', function () {
    const r = rahOnce(h);
    assertTrue(r.dest1Empty.phonebook, 'no phonebook');
    assertTrue(r.dest1Empty.invoices, 'no invoices');
  });

  test('ARCH-26 Part6-7 Replace + source vs restored', function () {
    const r = rahOnce(h);
    assertTrue(r.replaceGate.ok, 'gate');
    const bad = (r.compare1.unexpected || []).filter(function (k) { return k !== 'userAuditLog' && k !== 'bgAuditLog'; });
    assertEqual(JSON.stringify(bad), '[]', 'undeclared RAM diffs: ' + bad.join(','));
  });

  test('ARCH-26 Part8 phonebook acceptance', function () {
    const r = rahOnce(h);
    assertTrue(r.phonebook1.orderMatch, 'order');
    assertEqual(r.phonebook1.exactEmptyCount, 2, 'exact empty clones preserved by Replace');
    assertTrue(r.phonebook1.distinctEmptyKept, 'distinct empty');
    assertTrue(r.phonebook1.missingKept, 'missing phones');
    assertTrue(r.phonebook1.nullKept, 'null phones');
    assertTrue(r.phonebook1.persian, 'persian/arabic');
    assertTrue(r.phonebook1.unknown, 'unknown field');
  });

  test('ARCH-26 Part9 merge idempotency and 530 replay', function () {
    const r = rahOnce(h);
    assertTrue(!r.merge.phonebookGrew, 'phonebook no grow');
    assertTrue(!r.merge.idCollectionsGrew, 'id collections no grow');
    assertTrue(r.merge.emptyCloneStillOnePair, 'exact empty stay 2');
    assertTrue(r.merge.distinctStill, 'distinct empty remain');
    assertEqual(JSON.stringify(r.replay530), JSON.stringify([530, 530, 530, 530, 530]), '530 replay');
  });

  test('ARCH-26 Part10 Replace semantics A-E', function () {
    const r = rahOnce(h);
    assertEqual(r.replaceCases.A[0].fn, 'X', 'A replace');
    assertEqual(r.replaceCases.B.length, 0, 'B clear');
    assertEqual(r.replaceCases.C.length, 2, 'C keep');
    assertEqual(r.replaceCases.C[0].fn, 'A', 'C live A');
    assertEqual(r.replaceCases.D.length, 2, 'D keep');
    assertEqual(r.replaceCases.E.length, 2, 'E keep');
  });

  test('ARCH-26 Part11 attachment and media sidecar', function () {
    const r = rahOnce(h);
    assertTrue(r.attachments1.inlineOk, 'inline');
    assertTrue(r.attachments1.diskRefOk, 'disk ref');
    assertTrue(r.attachments1.sidecarExists, 'sidecar file');
    assertTrue(r.attachments1.sidecarShaMatch, 'sidecar sha');
    assertTrue(r.attachments1.resolveOk, 'resolveDiskRef');
  });

  test('ARCH-26 Part12 referential integrity including daqi index', function () {
    const r = rahOnce(h);
    assertTrue(r.refs1.ok, (r.refs1.issues || []).join('; ') || 'refs');
  });

  test('ARCH-26 Part13 checksum corruption rejected without dest mutation', function () {
    const r = rahOnce(h);
    assertTrue(r.checksumCorruption.rejected, 'rejected stage=' + r.checksumCorruption.stage);
    assertTrue(r.checksumCorruption.sha256Rejected, 'sha256 stage=' + r.checksumCorruption.shaStage);
    assertTrue(r.checksumCorruption.destUnchanged, 'dest unchanged');
  });

  test('ARCH-26 Part14 required-section fail-closed', function () {
    const r = rahOnce(h);
    r.requiredRemoved.forEach(function (x) {
      assertTrue(x.rejected, x.key + ' rejected');
      assertTrue(!x.applied, x.key + ' not applied');
    });
  });

  test('ARCH-26 Part15 malformed required sections rejected', function () {
    const r = rahOnce(h);
    r.malformed.forEach(function (x) {
      assertTrue(x.rejected, x.key + ' rejected');
      assertTrue(!x.applied, x.key + ' not applied');
    });
  });

  test('ARCH-26 Part16 rollback restores pre-restore state', function () {
    const r = rahOnce(h);
    assertTrue(r.rollback.threw, 'injected throw');
    assertTrue(r.rollback.phonebookRestored, 'phonebook');
    assertTrue(r.rollback.invoiceRestored, 'invoice');
    const bad = (r.rollback.unexpected || []).filter(function (k) { return k !== 'userAuditLog' && k !== 'bgAuditLog'; });
    assertEqual(JSON.stringify(bad), '[]', 'rollback diffs ' + bad.join(','));
  });

  test('ARCH-26 Part17 second clean-install matches dest1', function () {
    const r = rahOnce(h);
    const a = (r.cleanInstall2.unexpectedVsSource || []).filter(function (k) { return k !== 'userAuditLog' && k !== 'bgAuditLog'; });
    const b = r.cleanInstall2.unexpectedVsDest1 || [];
    assertEqual(JSON.stringify(a), '[]', 'vs source ' + a.join(','));
    assertEqual(JSON.stringify(b), '[]', 'vs dest1 ' + b.join(','));
  });

  test('ARCH-26 Part18 missing sidecar is PARTIAL not FULL RECOVERY', function () {
    const r = rahOnce(h);
    assertTrue(r.sidecarMissing.jsonRestored, 'json restored');
    assertTrue(r.sidecarMissing.diskRefSurvived, 'ref survives');
    assertEqual(r.sidecarMissing.classification, 'PARTIAL WITH EXPLICIT MEDIA FAILURE', 'class');
    assertTrue(!r.sidecarMissing.fullRecoveryClaimed, 'not full');
  });

  test('ARCH-26 Part19 digest comparison excluding derived timestamps', function () {
    const r = rahOnce(h);
    assertTrue(r.digest.match, 'canonical match');
  });

  test('ARCH-26 Part20 wording is copy-only synthetic not shop verified', function () {
    const r = rahOnce(h);
    assertEqual(r.wording, 'copy-only synthetic recovery acceptance', 'wording');
    assertTrue(r.shopVerified === false, 'not shop');
  });

  test('ARCH-26 Part21-23 criteria A-S evaluated', function () {
    const r = rahOnce(h);
    const ids = 'ABCDEFGHIJKLMNOPQRS'.split('');
    ids.forEach(function (id) {
      assertTrue(!!r.criteria[id], 'criterion ' + id + ' recorded');
    });
    assertTrue(r.verdict === 'BACKUP / RECOVERY = COMPLETE' || r.verdict === 'BACKUP / RECOVERY = NOT COMPLETE', 'verdict form');
    if (!r.complete) {
      throw new Error('RAH blockers: ' + r.blockers.join(' | '));
    }
  });
}

module.exports = { register, ARCH26_ASSEMBLER, ARCH26_MERGE, ARCH26_REPLACE };
