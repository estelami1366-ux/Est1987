#!/usr/bin/env node
'use strict';
/**
 * ARCH-4: HTML-baseline dry-run pipeline (validate → integrity digest → migrate).
 * Composes the same HTML functions ARCH-2/ARCH-3 already locked. Does not change HTML.
 *
 * Usage: node desktop/Sirman.Core.Tests/generate-backup-dryrun-golden.js [path/to/Sirman_Final.html]
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const FROZEN_NOW_MS = 1700000000000;
const TARGET_SCHEMA = 1;
const htmlPath = path.resolve(process.argv[2] || path.join(__dirname, '..', '..', 'Sirman_Final.html'));
const outPath = path.join(__dirname, 'BackupDryRunGolden.json');
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
  let braces = 0, brackets = 0, inStr = false, strQ = '', esc = false;
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
    extractFunctionSource(htmlSrc, 'validateRequiredBackupCollections'),
    extractFunctionSource(htmlSrc, 'backupValidationStatus'),
    extractFunctionSource(htmlSrc, 'validateBackupItemCounts'),
    extractFunctionSource(htmlSrc, 'validateBackupAttachmentIndex'),
    extractFunctionSource(htmlSrc, 'detectBackupDuplicateIdentities'),
    extractFunctionSource(htmlSrc, 'validateBackupStructuralIntegrity'),
    extractFunctionSource(htmlSrc, 'backupSectionHash'),
    extractFunctionSource(htmlSrc, 'backupChecksumExcludedKey'),
    extractFunctionSource(htmlSrc, 'backupChecksumPayload'),
    extractFunctionSource(htmlSrc, 'backupChecksumCanonicalString'),
    extractFunctionSource(htmlSrc, 'classifyBackupChecksumClaim'),
    extractFunctionSource(htmlSrc, 'validateBackupSectionChecksums'),
    extractFunctionSource(htmlSrc, 'validateBackupPortableIntegrity')
  ].filter(Boolean).join('\n');
}

const v = new Function(p1cValidatorSrc(html) + '\nreturn {' +
  'inferBackupSchemaVersion:inferBackupSchemaVersion,' +
  'validateRequiredBackupCollections:validateRequiredBackupCollections,' +
  'backupValidationStatus:backupValidationStatus,' +
  'validateBackupItemCounts:validateBackupItemCounts,' +
  'validateBackupStructuralIntegrity:validateBackupStructuralIntegrity,' +
  'backupChecksumCanonicalString:backupChecksumCanonicalString,' +
  'classifyBackupChecksumClaim:classifyBackupChecksumClaim,' +
  'validateBackupPortableIntegrity:validateBackupPortableIntegrity,' +
  'canRestoreSchema:null' +
'};')();

const canRestoreSrc = extractFunctionSource(html, 'canRestoreSchema');
const canRestoreSchema = new Function(
  'var SIRMAN_SCHEMA_VERSION = 1;\n' + canRestoreSrc + '\nreturn canRestoreSchema;'
)();

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
const mig = new Function(migrationSrc + '\nreturn {applySchemaMigrations:applySchemaMigrations,migrateBackup:migrateBackup};')();

function sha256utf8(s) {
  return crypto.createHash('sha256').update(s, 'utf8').digest('hex');
}
function clone(d) {
  return d === undefined ? undefined : JSON.parse(JSON.stringify(d));
}
function canonical(d) {
  return d === undefined ? 'undefined' : JSON.stringify(d);
}

function schema0Base() { return { warranties: [], invoices: [] }; }
function schema1Base() {
  return { schemaVersion: 1, warranties: [], invoices: [], sales: [], parts: [], accounts: [] };
}

function attachSha256(d) {
  const copy = clone(d);
  const canon = v.backupChecksumCanonicalString(copy);
  copy.checksumAlgo = 'SHA-256';
  copy.checksum = sha256utf8(canon);
  return copy;
}

function runDry(input) {
  const prev = Date.now;
  Date.now = function () { return FROZEN_NOW_MS; };
  try {
    const sourceSchema = v.inferBackupSchemaVersion(input);
    const structural = v.validateBackupStructuralIntegrity(input);
    const portable = v.validateBackupPortableIntegrity(input);
    const validationOk = !!structural.ok && !!portable.ok;
    const validationStatus = v.backupValidationStatus({
      ok: validationOk,
      warnings: [].concat(structural.warnings || [], portable.warnings || [])
    });
    const claim = v.classifyBackupChecksumClaim(input);
    let integrityStatus = 'NOT_VERIFIABLE';
    let digestCompared = false;
    let digestMatched = false;
    const errors = [].concat(structural.errors || [], portable.errors || []);
    const warnings = [].concat(structural.warnings || [], portable.warnings || []);

    if (!portable.ok) integrityStatus = 'INVALID';
    else if (!claim.claimed) integrityStatus = 'NOT_VERIFIABLE';
    else if (claim.algo !== 'SHA-256') integrityStatus = 'INVALID';
    else {
      digestCompared = true;
      const computed = sha256utf8(v.backupChecksumCanonicalString(input));
      const stored = String((input && input.checksum) || '');
      digestMatched = stored === computed;
      integrityStatus = digestMatched ? 'VALID' : 'INVALID';
      if (!digestMatched) errors.push('checksum مطابقت ندارد — فایل ممکن است خراب باشد!');
    }

    const gatesOk = validationOk && (integrityStatus !== 'INVALID' || (integrityStatus === 'INVALID' && portable.ok && digestMatched));
    const digestOk = integrityStatus !== 'INVALID' || (!portable.ok);
    // Match Core: gatesOk = validation.Ok && digestOk where digestOk is false only on SHA-256 mismatch.
    const coreGatesOk = validationOk && !(digestCompared && !digestMatched);

    if (!coreGatesOk) {
      return {
        ok: false,
        applied: false,
        status: 'INVALID',
        sourceSchema: sourceSchema,
        targetSchema: TARGET_SCHEMA,
        migrationRequired: sourceSchema < TARGET_SCHEMA,
        migrationPerformed: false,
        migrationStatus: 'NotAttempted',
        validationStatus: validationStatus,
        integrityStatus: integrityStatus,
        digestCompared: digestCompared,
        digestMatched: digestMatched,
        errors: errors,
        warnings: warnings,
        log: [],
        dataCanonical: null,
        hasSales: !!(input && Object.prototype.hasOwnProperty.call(input, 'sales'))
      };
    }

    const gate = canRestoreSchema(sourceSchema, TARGET_SCHEMA);
    if (!gate.ok) {
      return {
        ok: false,
        applied: false,
        status: 'INVALID',
        sourceSchema: sourceSchema,
        targetSchema: TARGET_SCHEMA,
        migrationRequired: true,
        migrationPerformed: false,
        migrationStatus: 'Failed',
        validationStatus: validationStatus,
        integrityStatus: integrityStatus,
        digestCompared: digestCompared,
        digestMatched: digestMatched,
        errors: errors.concat([gate.reason]),
        warnings: warnings,
        log: [],
        dataCanonical: null,
        hasSales: !!(input && Object.prototype.hasOwnProperty.call(input, 'sales'))
      };
    }

    let threw = false;
    let migLog = [];
    let migrated = null;
    try {
      const schema = mig.applySchemaMigrations(clone(input));
      if (!schema.ok) {
        return {
          ok: false,
          applied: false,
          status: 'INVALID',
          sourceSchema: sourceSchema,
          targetSchema: TARGET_SCHEMA,
          migrationRequired: sourceSchema < TARGET_SCHEMA || !!schema.tooNew,
          migrationPerformed: false,
          migrationStatus: 'Failed',
          validationStatus: validationStatus,
          integrityStatus: integrityStatus,
          digestCompared: digestCompared,
          digestMatched: digestMatched,
          errors: errors.concat(schema.reason ? [schema.reason] : []),
          warnings: warnings,
          log: schema.log || [],
          dataCanonical: null,
          hasSales: !!(input && Object.prototype.hasOwnProperty.call(input, 'sales'))
        };
      }
      const field = mig.migrateBackup(schema.data);
      migrated = field.data;
      migLog = (schema.log || []).concat(field.log || []);
    } catch (e) {
      threw = true;
      return {
        ok: false,
        applied: false,
        status: 'INVALID',
        sourceSchema: sourceSchema,
        targetSchema: TARGET_SCHEMA,
        migrationRequired: sourceSchema < TARGET_SCHEMA,
        migrationPerformed: false,
        migrationStatus: 'Failed',
        validationStatus: validationStatus,
        integrityStatus: integrityStatus,
        digestCompared: digestCompared,
        digestMatched: digestMatched,
        errors: errors.concat([String(e.message || e)]),
        warnings: warnings,
        log: [],
        dataCanonical: null,
        hasSales: !!(input && Object.prototype.hasOwnProperty.call(input, 'sales'))
      };
    }

    const postReq = v.validateRequiredBackupCollections(migrated);
    const postCounts = v.validateBackupItemCounts(migrated);
    const postErrors = [].concat(postReq.errors || [], postCounts.errors || []);
    const postWarnings = [].concat(postReq.warnings || [], postCounts.warnings || []);
    const postOk = !!postReq.ok && !!postCounts.ok;
    const allWarnings = warnings.concat(postWarnings);
    const allErrors = errors.concat(postErrors);
    const ok = postOk && !threw;
    const status = ok ? v.backupValidationStatus({ ok: true, warnings: allWarnings }) : 'INVALID';
    return {
      ok: ok,
      applied: false,
      status: status,
      sourceSchema: sourceSchema,
      targetSchema: TARGET_SCHEMA,
      migrationRequired: sourceSchema < TARGET_SCHEMA,
      migrationPerformed: true,
      migrationStatus: 'Performed',
      validationStatus: validationStatus,
      integrityStatus: integrityStatus,
      digestCompared: digestCompared,
      digestMatched: digestMatched,
      errors: allErrors,
      warnings: allWarnings,
      log: migLog,
      dataCanonical: ok ? canonical(migrated) : null,
      hasSales: !!(migrated && Object.prototype.hasOwnProperty.call(migrated, 'sales')),
      postOk: postOk
    };
  } finally {
    Date.now = prev;
  }
}

const fixtures = [];
function add(id, tags, input, notes) {
  const before = canonical(input);
  const htmlRun = runDry(input);
  const after = canonical(input);
  fixtures.push({
    id: id,
    tags: tags,
    notes: notes || '',
    frozenNowMs: FROZEN_NOW_MS,
    input: input,
    inputCanonical: before,
    inputUnchanged: before === after,
    html: htmlRun
  });
}

add('T1-schema1-current-valid', ['T1', 'T16'], schema1Base(), 'current valid schema>=1');
add('T2-schema0-legacy', ['T2', 'T15'], schema0Base(), 'schema0 legacy with required arrays');
add('T3-schema0-missing-sales-parts-accounts', ['T3', 'T15'], { warranties: [], invoices: [] }, 'schema0 omit sales/parts/accounts then 0→1 fills');
add('T4-schema1-missing-sales', ['T4'], { schemaVersion: 1, warranties: [], invoices: [], parts: [], accounts: [] }, 'schema>=1 missing sales must not migrate to []');
add('T5-schema1-missing-parts', ['T5'], { schemaVersion: 1, warranties: [], invoices: [], sales: [], accounts: [] }, 'schema>=1 missing parts');
add('T6-schema1-missing-accounts', ['T6'], { schemaVersion: 1, warranties: [], invoices: [], sales: [], parts: [] }, 'schema>=1 missing accounts');
add('T7-missing-warranties', ['T7'], { invoices: [] }, 'warranties always required');
add('T8-missing-invoices', ['T8'], { warranties: [] }, 'invoices always required');
add('T9-itemcounts-mismatch', ['T9'], Object.assign(schema1Base(), { warranties: [{ id: 'W1' }], itemCounts: { warranties: 2 } }), 'itemCounts mismatch fail-closed');
add('T10-attachment-broken', ['T10'], Object.assign(schema1Base(), {
  warranties: [{ id: 'W1' }],
  attachmentsIndex: [{ id: 'd1', kind: 'warranty', parentId: 'MISSING', name: 'a.pdf' }]
}), 'broken attachment ref');
add('T11-duplicate-identity-warning', ['T11'], Object.assign(schema1Base(), {
  invoices: [{ id: 'a', invoiceId: 'INVUID-1' }, { id: 'b', invoiceId: 'INVUID-1' }]
}), 'duplicate invoiceId warning; migrate still allowed');
add('T12-valid-checksum', ['T12'], attachSha256(schema1Base()), 'claimed SHA-256 matches canonical digest');
add('T13-invalid-checksum', ['T13'], Object.assign(schema1Base(), {
  checksumAlgo: 'SHA-256',
  checksum: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
}), 'claimed SHA-256 mismatch fail-closed');
add('T14-checksum-absent', ['T14'], schema1Base(), 'absent checksum NOT_VERIFIABLE compatible');
add('T14b-checksum-none', ['T14'], Object.assign(schema1Base(), { checksum: '', checksumAlgo: 'none' }), 'algo none compatible skipped');
add('T15-v2-legacy-migration-required', ['T15', 'T2'], { version: '2.0', warranties: [], invoices: [] }, 'v2.0 schema 0 migration required');
add('T16-already-current', ['T16'], Object.assign(schema1Base(), {
  tasks: [], services: [], products: [], inventory: {},
  saleCtr: 1, invoiceUidCtr: 0, saleUidCtr: 0, magic: 'SIRMAN_BACKUP'
}), 'already-current still runs field migrate');
add('T17-malformed-null', ['T17'], null, 'null package');
add('T17b-malformed-array', ['T17'], [], 'array is not a package');
add('T17c-unknown-algo', ['T17'], Object.assign(schema1Base(), { checksum: 'abcd', checksumAlgo: 'MD5' }), 'unknown checksum algo');
add('T18-persian-unicode', ['T18'], Object.assign(schema1Base(), {
  company: { name: 'لایق الکترونیک پارسیان', city: 'تهران' },
  warranties: [{ id: 'W-۱', name: 'علی', problem: 'صفحهٔ نمایش' }],
  invoices: [{ id: 'I1', num: 1, buyer: 'فروشگاه نمونه' }]
}), 'Persian text');
add('T-schema-too-new', ['T17'], {
  schemaVersion: 2, warranties: [], invoices: [], sales: [], parts: [], accounts: []
}, 'schema 2 too-new; no reverse migrate');

const pack = {
  generatedAt: '2026-09-04',
  packet: 'ARCH-4',
  htmlFile: 'Sirman_Final.html',
  frozenNowMs: FROZEN_NOW_MS,
  targetSchema: TARGET_SCHEMA,
  notes: [
    'Pipeline: ARCH-2 structural+portable → SHA-256 digest compare (HTML verifyChecksum) → ARCH-3 migrate → post required+itemCounts.',
    'validateBackupPackage is NOT used post-migrate (it would weaken sectionChecksums to warnings).',
    'Overall status is VALID / VALID_WITH_WARNINGS / INVALID. Integrity slice may be NOT_VERIFIABLE when checksum is skipped.',
    'HTML importData/testRestoreBackup remain the live engines. This golden is the Core dry-run composition baseline.'
  ],
  fixtures: fixtures
};

fs.writeFileSync(outPath, JSON.stringify(pack, null, 2), 'utf8');
console.log('wrote', outPath, 'fixtures', fixtures.length);
fixtures.forEach(function (f) {
  console.log(f.id, 'ok=' + f.html.ok, 'status=' + f.html.status, 'integ=' + f.html.integrityStatus, 'mig=' + f.html.migrationStatus, 'sales=' + f.html.hasSales);
});
