#!/usr/bin/env node
'use strict';
/**
 * ARCH-3: capture currently verified HTML schema + field migration behavior.
 * One source of truth: Sirman_Final.html functions. This script does not change them.
 *
 * Usage: node desktop/Sirman.Core.Tests/generate-backup-migration-golden.js [path/to/Sirman_Final.html]
 */
const fs = require('fs');
const path = require('path');

const FROZEN_NOW_MS = 1700000000000;
const htmlPath = path.resolve(process.argv[2] || path.join(__dirname, '..', '..', 'Sirman_Final.html'));
const outPath = path.join(__dirname, 'BackupMigrationGolden.json');
const html = fs.readFileSync(htmlPath, 'utf8');

function extractFunctionSource(src, fnName) {
  const startMatch = src.match(new RegExp('(?:async\\s+)?function\\s+' + fnName + '\\s*\\([^)]*\\)\\s*\\{'));
  if (!startMatch) return null;
  let start = startMatch.index;
  let braceCount = 0;
  let i = start;
  let started = false;
  for (; i < src.length; i++) {
    if (src[i] === '{') { braceCount++; started = true; }
    else if (src[i] === '}') { braceCount--; if (started && braceCount === 0) { i++; break; } }
  }
  return src.substring(start, i);
}

function extractBinding(src, name) {
  const re = new RegExp('var\\s+' + name + '\\s*=');
  const m = re.exec(src);
  if (!m) return null;
  let i = m.index + m[0].length;
  while (i < src.length && /\s/.test(src[i])) i++;
  const start = m.index;
  const open = src[i];
  if (open !== '{' && open !== '[') {
    const semi = src.indexOf(';', i);
    return src.substring(start, semi + 1);
  }
  let braces = 0;
  let brackets = 0;
  let inStr = false;
  let strQ = '';
  let esc = false;
  for (; i < src.length; i++) {
    const ch = src[i];
    if (inStr) {
      if (esc) { esc = false; continue; }
      if (ch === '\\') { esc = true; continue; }
      if (ch === strQ) inStr = false;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') { inStr = true; strQ = ch; continue; }
    if (ch === '{') braces++;
    else if (ch === '}') braces--;
    else if (ch === '[') brackets++;
    else if (ch === ']') brackets--;
    if (braces < 0 || brackets < 0) return null;
    if (braces === 0 && brackets === 0) {
      i++;
      while (i < src.length && /\s/.test(src[i])) i++;
      if (src[i] === ';') i++;
      return src.substring(start, i);
    }
  }
  return null;
}

function p1cValidatorSrc(htmlSrc) {
  const reg = htmlSrc.match(/var REQUIRED_BACKUP_COLLECTIONS = \[[^\]]*\];/);
  const fromSchema = htmlSrc.match(/var REQUIRED_BACKUP_COLLECTIONS_FROM_SCHEMA = \{[^}]*\};/);
  return [
    extractFunctionSource(htmlSrc, 'inferBackupSchemaVersion'),
    reg ? reg[0] : null,
    fromSchema ? fromSchema[0] : null,
    extractFunctionSource(htmlSrc, 'backupHasOwnCollection'),
    extractFunctionSource(htmlSrc, 'inferRequiredBackupSchemaVersion'),
    extractFunctionSource(htmlSrc, 'requiredBackupCollectionsFor'),
    extractFunctionSource(htmlSrc, 'validateRequiredBackupCollections')
  ].filter(Boolean).join('\n');
}

const migrationSrc = [
  'var SIRMAN_SCHEMA_VERSION = 1;',
  'var SIRMAN_BACKUP_MAGIC = "SIRMAN_BACKUP";',
  'function isDiskRef(s){ return typeof s === "string" && s.indexOf("disk://") === 0; }',
  extractFunctionSource(html, 'inferBackupSchemaVersion'),
  extractFunctionSource(html, 'canRestoreSchema'),
  extractFunctionSource(html, 'buildBackupManifest'),
  extractFunctionSource(html, 'collectAttachmentIndex'),
  extractFunctionSource(html, 'cloneBackupData'),
  extractFunctionSource(html, 'inferRequiredBackupSchemaVersion'),
  extractBinding(html, 'SCHEMA_MIGRATIONS'),
  extractFunctionSource(html, 'applySchemaMigrations'),
  extractBinding(html, 'SCHEMAS'),
  extractFunctionSource(html, 'migrateRecord'),
  extractFunctionSource(html, 'migrateSection'),
  extractFunctionSource(html, 'migrateBackup')
].join('\n');

if (!extractFunctionSource(html, 'migrateBackup') || !extractBinding(html, 'SCHEMA_MIGRATIONS')) {
  throw new Error('failed to extract HTML migration graph');
}

const prevNow = Date.now;
Date.now = function () { return FROZEN_NOW_MS; };
let oracle;
let validator;
try {
  oracle = new Function(migrationSrc + '\nreturn {applySchemaMigrations:applySchemaMigrations,migrateBackup:migrateBackup,inferBackupSchemaVersion:inferBackupSchemaVersion,cloneBackupData:cloneBackupData};')();
  validator = new Function(p1cValidatorSrc(html) + '\nreturn {validateRequiredBackupCollections:validateRequiredBackupCollections,inferBackupSchemaVersion:inferBackupSchemaVersion};')();
} finally {
  Date.now = prevNow;
}

function withFrozenNow(fn) {
  const prev = Date.now;
  Date.now = function () { return FROZEN_NOW_MS; };
  try { return fn(); }
  finally { Date.now = prev; }
}

function deepClone(v) {
  return v === undefined ? undefined : JSON.parse(JSON.stringify(v));
}

function canonical(v) {
  if (v === undefined) return 'undefined';
  return JSON.stringify(v);
}

function snapshotValidator(d) {
  try {
    const r = validator.validateRequiredBackupCollections(d);
    return {
      ok: !!r.ok,
      errors: r.errors || [],
      missingRequiredCollections: r.missingRequiredCollections || [],
      invalidCollections: r.invalidCollections || [],
      schemaVersion: validator.inferBackupSchemaVersion(d)
    };
  } catch (e) {
    return { threw: true, errorName: e.name, errorMessage: String(e.message || e) };
  }
}

function runSchema(input, targetVer) {
  return withFrozenNow(function () {
    const before = canonical(input);
    const result = targetVer === undefined
      ? oracle.applySchemaMigrations(deepClone(input))
      : oracle.applySchemaMigrations(deepClone(input), targetVer);
    return {
      threw: false,
      ok: !!result.ok,
      tooNew: !!result.tooNew,
      from: result.from,
      to: result.to,
      reason: result.reason || '',
      log: result.log || [],
      data: result.data,
      dataCanonical: canonical(result.data),
      callerUnchanged: canonical(input) === before
    };
  });
}

function runField(input) {
  return withFrozenNow(function () {
    const originalCanonical = canonical(input);
    const working = deepClone(input);
    try {
      const result = oracle.migrateBackup(working);
      return {
        threw: false,
        ok: true,
        tooNew: false,
        log: result.log || [],
        data: result.data,
        dataCanonical: canonical(result.data),
        htmlMutatesWorkingCopy: canonical(working) !== originalCanonical || canonical(result.data) !== originalCanonical,
        callerCloneUnchanged: originalCanonical === canonical(input)
      };
    } catch (e) {
      return {
        threw: true,
        ok: false,
        errorName: e.name,
        errorMessage: String(e.message || e),
        log: [],
        data: null,
        dataCanonical: null
      };
    }
  });
}

function runPackage(input) {
  return withFrozenNow(function () {
    try {
      const schema = oracle.applySchemaMigrations(deepClone(input));
      if (!schema.ok) {
        return {
          threw: false,
          ok: false,
          tooNew: !!schema.tooNew,
          from: schema.from,
          to: schema.to,
          reason: schema.reason || '',
          log: schema.log || [],
          data: schema.data,
          dataCanonical: canonical(schema.data)
        };
      }
      const field = oracle.migrateBackup(schema.data);
      const log = (schema.log || []).concat(field.log || []);
      return {
        threw: false,
        ok: true,
        tooNew: false,
        from: schema.from,
        to: field.data && field.data.schemaVersion != null ? field.data.schemaVersion : schema.to,
        reason: '',
        log: log,
        data: field.data,
        dataCanonical: canonical(field.data)
      };
    } catch (e) {
      return {
        threw: true,
        ok: false,
        errorName: e.name,
        errorMessage: String(e.message || e),
        log: [],
        data: null,
        dataCanonical: null
      };
    }
  });
}

function runTwice(stage, input) {
  const first = stage === 'field' ? runField(input) : (stage === 'schema' ? runSchema(input) : runPackage(input));
  if (first.threw || !first.ok) {
    return { first: first, second: null, identical: false };
  }
  const second = stage === 'field' ? runField(first.data) : (stage === 'schema' ? runSchema(first.data) : runPackage(first.data));
  return {
    first: first,
    second: second,
    identical: !second.threw && first.dataCanonical === second.dataCanonical,
    logIdentical: !second.threw && JSON.stringify(first.log) === JSON.stringify(second.log)
  };
}

const fixtures = [];
function add(id, stage, input, notes, extra) {
  extra = extra || {};
  const tags = extra.tags || [];
  let htmlRun;
  if (stage === 'schema') htmlRun = runSchema(input, extra.targetVer);
  else if (stage === 'field') htmlRun = runField(input);
  else if (stage === 'schema-twice' || stage === 'field-twice' || stage === 'package-twice') {
    const base = stage.replace('-twice', '');
    const twice = runTwice(base, input);
    htmlRun = {
      threw: twice.first.threw,
      ok: twice.first.ok,
      tooNew: twice.first.tooNew,
      from: twice.first.from,
      to: twice.first.to,
      reason: twice.first.reason || '',
      log: twice.first.log,
      data: twice.first.data,
      dataCanonical: twice.first.dataCanonical,
      idempotentData: twice.identical,
      idempotentLog: twice.logIdentical,
      second: twice.second ? {
        threw: twice.second.threw,
        ok: twice.second.ok,
        log: twice.second.log,
        dataCanonical: twice.second.dataCanonical,
        errorName: twice.second.errorName,
        errorMessage: twice.second.errorMessage
      } : null
    };
    stage = base + '-twice';
  } else htmlRun = runPackage(input);

  const row = {
    id: id,
    notes: notes || '',
    tags: tags,
    stage: stage,
    frozenNowMs: FROZEN_NOW_MS,
    input: input,
    inputCanonical: canonical(input),
    validatorBefore: snapshotValidator(input),
    html: htmlRun
  };
  if (htmlRun && htmlRun.data != null && !htmlRun.threw) {
    row.validatorAfter = snapshotValidator(htmlRun.data);
  }
  fixtures.push(row);
}

function schema0Base() {
  return { warranties: [], invoices: [] };
}
function schema1Base() {
  return { schemaVersion: 1, magic: 'SIRMAN_BACKUP', warranties: [], invoices: [], sales: [], parts: [], accounts: [] };
}

// T1 schema 0→1
add('schema-0-to-1-empty', 'schema', schema0Base(), 'schema 0 empty required collections', { tags: ['T1', 'T2'] });
add('schema-0-missing-sales-parts-accounts', 'schema', { warranties: [], invoices: [] }, 'MISSING sales/parts/accounts → [] only on 0→1', { tags: ['T1', 'T2', 'T4'] });
add('schema-0-v2-missing-accounts', 'schema', { version: '2.0', warranties: [], invoices: [], phonebook: [] }, 'v2.0 omit accounts', { tags: ['T1', 'T2'] });
add('schema-0-null-sales', 'schema', { warranties: [], invoices: [], sales: null, parts: [], accounts: [] }, 'null sales is JS-falsy → [] on 0→1', { tags: ['T1', 'T5'] });
add('schema-0-sales-zero-falsy', 'schema', { warranties: [], invoices: [], sales: 0, parts: [], accounts: [] }, 'sales:0 is falsy → []', { tags: ['T1', 'T6'] });
add('schema-0-empty-sales-array-kept', 'schema', { warranties: [], invoices: [], sales: [], parts: [], accounts: [] }, 'empty array is truthy and stays', { tags: ['T1', 'T5'] });
add('schema-1-already-current-schema-only', 'schema', schema1Base(), 'schema ≥1 does not enter 0→1', { tags: ['T1', 'T7'] });
add('schema-1-missing-sales-schema-only', 'schema', { schemaVersion: 1, warranties: [], invoices: [], parts: [], accounts: [] }, 'schema ≥1 missing sales NOT filled by SCHEMA_MIGRATIONS', { tags: ['T1', 'T3'] });
add('schema-1-null-parts-schema-only', 'schema', { schemaVersion: 1, warranties: [], invoices: [], sales: [], parts: null, accounts: [] }, 'schema ≥1 null parts stays null', { tags: ['T1', 'T3', 'T5'] });
add('schema-too-new-2', 'schema', { schemaVersion: 2, warranties: [], invoices: [], sales: [], parts: [], accounts: [] }, 'fileVer > appVer fail-closed no reverse migrate', { tags: ['T1'] });
add('schema-0-existing-attachmentsIndex', 'schema', { warranties: [], invoices: [], attachmentsIndex: [{ id: 'keep-me' }] }, 'truthy attachmentsIndex is not rebuilt', { tags: ['T1', 'T12'] });
add('schema-0-origin-unknown-manifest', 'schema', { warranties: [], invoices: [], origin: 'usb', partial: true }, 'manifest origin/kind from args', { tags: ['T1'] });
add('schema-from-manifest-only', 'schema', { manifest: { schemaVersion: 1 }, warranties: [], invoices: [], sales: [], parts: [], accounts: [] }, 'infer from manifest.schemaVersion', { tags: ['T1', 'T7'] });
add('schema-0-disk-attachments', 'schema', {
  warranties: [{ id: 'W1', docs: [{ id: 'd1', name: 'a.jpg', data: 'disk://files/a.jpg' }] }],
  invoices: [],
  sales: [{ id: 'SL-1', attachments: [{ name: 'b.png', src: 'idb:blob1' }] }]
}, 'collectAttachmentIndex disk:/idb: refs', { tags: ['T1', 'T12'] });
add('schema-twice-already-1', 'schema-twice', schema1Base(), 'repeated applySchemaMigrations on current schema', { tags: ['T8'] });
add('schema-twice-from-0', 'schema-twice', schema0Base(), 'repeated 0→1 then current', { tags: ['T8', 'T2'] });

// T3/T5/T6 field-only (production inferRequiredBackupSchemaVersion)
add('field-schema1-missing-sales', 'field', { schemaVersion: 1, warranties: [], invoices: [], parts: [], accounts: [] }, 'field migrate must NOT invent sales=[]', { tags: ['T3'] });
add('field-schema1-missing-parts', 'field', { schemaVersion: 1, warranties: [], invoices: [], sales: [], accounts: [] }, 'field migrate must NOT invent parts=[]', { tags: ['T3'] });
add('field-schema1-missing-accounts', 'field', { schemaVersion: 1, warranties: [], invoices: [], sales: [], parts: [] }, 'field migrate must NOT invent accounts=[]', { tags: ['T3'] });
add('field-schema1-null-sales', 'field', { schemaVersion: 1, warranties: [], invoices: [], sales: null, parts: [], accounts: [] }, 'schema≥1 null sales not coerced', { tags: ['T3', 'T5'] });
add('field-schema1-wrongtype-sales-string', 'field', { schemaVersion: 1, warranties: [], invoices: [], sales: 'nope', parts: [], accounts: [] }, 'schema≥1 wrong-type sales not coerced', { tags: ['T3', 'T6'] });
add('field-schema0-missing-sales-fills', 'field', { warranties: [], invoices: [] }, 'schema 0 field migrate fills sales/parts/accounts []', { tags: ['T2', 'T4'] });
add('field-schema0-v2-missing-accounts', 'field', { version: '2.0', warranties: [], invoices: [], phonebook: [] }, 'v2.0 field migrate accounts=[]', { tags: ['T2'] });
add('field-tasks-missing', 'field', schema1Base(), 'tasks always MISSING → [] any schema', { tags: ['T4'] });
add('field-tasks-null', 'field', Object.assign(schema1Base(), { tasks: null }), 'null tasks is falsy → []', { tags: ['T4', 'T5'] });
add('field-tasks-wrongtype-object-throws', 'field', Object.assign(schema1Base(), { tasks: { id: 'x' } }), 'truthy non-array tasks → forEach throw', { tags: ['T6'] });
add('field-warranties-missing', 'field', { schemaVersion: 1, invoices: [], sales: [], parts: [], accounts: [] }, 'warranties never filled', { tags: ['T3', 'T5'] });
add('field-invoices-missing', 'field', { schemaVersion: 1, warranties: [], sales: [], parts: [], accounts: [] }, 'invoices never filled', { tags: ['T3'] });
add('field-invoices-null', 'field', { schemaVersion: 1, warranties: [], invoices: null, sales: [], parts: [], accounts: [] }, 'null invoices not filled', { tags: ['T5'] });
add('field-pb-to-phonebook', 'field', {
  schemaVersion: 0,
  warranties: [], invoices: [],
  pb: [{ name: 'علی رضایی', phone: '09120000000', shop: 'فروشگاه', address: 'تهران' }]
}, 'legacy pb {name,phone} → phonebook fn/ln/phones', { tags: ['T2', 'T11'] });
add('field-svcs-alias', 'field', Object.assign(schema1Base(), { svcs: [{ code: 'S1', name: 'نصب' }] }), 'svcs → services alias', { tags: ['T4'] });
add('field-already-current', 'field', Object.assign(schema1Base(), {
  tasks: [], services: [], svcs: [], products: [], inventory: {},
  defectiveStock: [], daqi: [], daqiWarehouse: [], daqiVouchers: [], postalHistory: [],
  userAuditLog: [], bgAuditLog: [],
  saleCtr: 1, invoiceUidCtr: 0, saleUidCtr: 0, magic: 'SIRMAN_BACKUP', schemaVersion: 1
}), 'already-current field migrate', { tags: ['T7'] });
add('field-missing-ids-frozen-now', 'field', Object.assign(schema1Base(), {
  invoices: [{ num: 7 }],
  parts: [{ code: 'P1' }],
  warranties: [{ name: 'w' }],
  sales: [{ total: 1 }],
  tasks: [{ title: 'کار' }]
}), 'missing ids use Date.now frozen', { tags: ['T1', 'T10', 'T11'] });
add('field-sale-status-final', 'field', Object.assign(schema1Base(), {
  sales: [{ id: 'SL-3', total: 10 }],
  saleCtr: 1
}), 'missing sale status → final; saleCtr bump', { tags: ['T1'] });
add('field-persian-unicode', 'field', Object.assign(schema1Base(), {
  warranties: [{ id: 'W-فا', name: 'گارانتی نمونه', problem: 'صفحهٔ نمایش' }],
  phonebook: [{ fn: 'مهدی', ln: 'استعلامی', phones: ['۰۹۱۲'] }]
}), 'Persian text preserved', { tags: ['T11'] });
add('field-nested-docs', 'field', Object.assign(schema1Base(), {
  warranties: [{ id: 'W2', docs: [{ name: 'a', data: 'disk://x' }], devices: [{ model: 'X' }] }],
  sales: [{ id: 'SL-2', docs: [{ name: 'b', src: 'inline' }] }],
  invoices: [{ id: 'I1', num: 1, items: [{ name: 'قلم', qty: 2 }] }]
}), 'nested docs/items kept', { tags: ['T12'] });
add('field-wrongtype-parts-schema1', 'field', Object.assign(schema1Base(), { parts: { code: 'x' } }), 'schema≥1 object parts not replaced', { tags: ['T6'] });
add('field-wrongtype-parts-schema0-object', 'field', { warranties: [], invoices: [], parts: { code: 'x' } }, 'schema 0 object parts is truthy — not replaced with []', { tags: ['T6', 'T2'] });
add('field-invctr-guess', 'field', Object.assign(schema1Base(), { invoices: [{ num: 12 }, { num: 4 }] }), 'invCtr guessed from max num', { tags: ['T1'] });
add('field-invoice-sale-uid', 'field', Object.assign(schema1Base(), {
  invoices: [{ id: 'keep', num: 1 }],
  sales: [{ id: 'SL-1' }]
}), 'INVUID/SALEUID assigned', { tags: ['T1'] });
add('field-optional-daqi-postal', 'field', schema1Base(), 'optional legacy collections filled if missing', { tags: ['T4'] });
add('field-warranty-accref-undefined', 'field', Object.assign(schema1Base(), {
  warranties: [{ id: 'W3', name: 'n' }]
}), 'missing accRef → empty string before schema project', { tags: ['T1'] });
add('field-services-wrongtype-object', 'field', Object.assign(schema1Base(), { services: { code: 'x' } }), 'truthy non-array services: log uses .length', { tags: ['T6'] });
add('field-phonebook-empty-no-pb', 'field', schema1Base(), 'empty/missing phonebook → [] and pb alias', { tags: ['T4'] });
add('field-invoices-wrongtype', 'field', Object.assign(schema1Base(), { invoices: { num: 1 } }), 'non-array invoices fail-closed', { tags: ['T6'] });
add('field-twice-already-current', 'field-twice', Object.assign(schema1Base(), {
  tasks: [], services: [], products: [], inventory: {},
  defectiveStock: [], daqi: [], daqiWarehouse: [], daqiVouchers: [], postalHistory: [],
  saleCtr: 1, invoiceUidCtr: 0, saleUidCtr: 0
}), 'repeated field migrate idempotence probe', { tags: ['T8'] });
add('field-twice-missing-ids', 'field-twice', Object.assign(schema1Base(), {
  invoices: [{ num: 1 }],
  tasks: [{ title: 't' }]
}), 'second pass after ids assigned', { tags: ['T8', 'T10'] });

// combined package (importData/testRestoreBackup order)
add('package-schema0-legacy', 'package', { version: '2.0', warranties: [], invoices: [] }, '0→1 then field; sales filled by schema step first', { tags: ['T1', 'T2', 'T13'] });
add('package-schema1-missing-sales-no-repair', 'package', { schemaVersion: 1, warranties: [], invoices: [], parts: [], accounts: [] }, 'combined still does not invent sales=[]', { tags: ['T3', 'T13'] });
add('package-already-current', 'package', Object.assign(schema1Base(), {
  tasks: [], services: [], products: [], inventory: {},
  defectiveStock: [], daqi: [], daqiWarehouse: [], daqiVouchers: [], postalHistory: [],
  saleCtr: 1, invoiceUidCtr: 0, saleUidCtr: 0
}), 'already-current package', { tags: ['T7'] });
add('package-v2', 'package', { version: '2.0', warranties: [{ name: 'گارانتی' }], invoices: [{ num: 3 }], phonebook: [{ fn: 'A', ln: 'B', phones: ['1'] }] }, 'v2.0 full package path', { tags: ['T2', 'T11'] });
add('package-nested-persian', 'package', {
  schemaVersion: 0,
  warranties: [{ id: 'W9', name: 'نمونه', docs: { other: [{ name: 'فایل', data: 'x' }] } }],
  invoices: [{ num: 2, items: [{ name: 'قطعهٔ فارسی' }] }],
  sales: [{ id: 'SL-9', note: 'فروش' }]
}, 'nested + unicode through both stages', { tags: ['T11', 'T12'] });
add('package-twice-schema1-full', 'package-twice', Object.assign(schema1Base(), {
  tasks: [{ id: 'T1', kind: 'do', priority: 'normal', status: 'open', title: 'x' }],
  services: [], products: [], inventory: {},
  defectiveStock: [], daqi: [], daqiWarehouse: [], daqiVouchers: [], postalHistory: [],
  saleCtr: 1, invoiceUidCtr: 0, saleUidCtr: 0, phonebook: []
}), 'idempotence of combined migrate', { tags: ['T8'] });
add('package-twice-schema0', 'package-twice', { warranties: [], invoices: [] }, 'schema0 combined twice', { tags: ['T8', 'T2'] });
add('package-malformed-tasks', 'package', Object.assign(schema1Base(), { tasks: { bad: true } }), 'combined throws like field', { tags: ['T6'] });

// T13 validator compatibility captured as validatorBefore/After on rows above.

const pack = {
  generatedAt: '2026-09-04',
  packet: 'ARCH-3',
  htmlFile: 'Sirman_Final.html',
  frozenNowMs: FROZEN_NOW_MS,
  notes: [
    'HTML applySchemaMigrations clones via JSON.parse(JSON.stringify).',
    'HTML migrateBackup mutates its argument. Core API must clone first.',
    'Oracle includes inferRequiredBackupSchemaVersion (production path, not the incomplete test_laegh loadMigrateBackupFn harness).',
    'Date.now frozen to frozenNowMs for missing-id assignment.',
    'Do not assume idempotence; see *-twice fixtures.'
  ],
  fixtures: fixtures
};

fs.writeFileSync(outPath, JSON.stringify(pack, null, 2), 'utf8');
console.log('wrote', outPath, 'fixtures', fixtures.length);
const threw = fixtures.filter(function (f) { return f.html && f.html.threw; }).map(function (f) { return f.id; });
const nonIdem = fixtures.filter(function (f) { return f.stage.indexOf('twice') >= 0 && f.html && f.html.idempotentData === false; }).map(function (f) { return f.id; });
console.log('threw', threw);
console.log('non-idempotent data', nonIdem);
