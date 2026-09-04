#!/usr/bin/env node
'use strict';
/**
 * ARCH-2: capture currently verified HTML backup-validator behavior.
 * One source of truth: Sirman_Final.html functions. This script does not change them.
 *
 * Usage: node desktop/Sirman.Core.Tests/generate-backup-validator-golden.js [path/to/Sirman_Final.html]
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const htmlPath = path.resolve(process.argv[2] || path.join(__dirname, '..', '..', 'Sirman_Final.html'));
const outPath = path.join(__dirname, 'BackupValidatorGolden.json');
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
    extractFunctionSource(htmlSrc, 'assertRequiredBackupCollections'),
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
  'requiredBackupCollectionsFor:requiredBackupCollectionsFor,' +
  'validateRequiredBackupCollections:validateRequiredBackupCollections,' +
  'backupValidationStatus:backupValidationStatus,' +
  'validateBackupItemCounts:validateBackupItemCounts,' +
  'validateBackupAttachmentIndex:validateBackupAttachmentIndex,' +
  'detectBackupDuplicateIdentities:detectBackupDuplicateIdentities,' +
  'validateBackupStructuralIntegrity:validateBackupStructuralIntegrity,' +
  'backupSectionHash:backupSectionHash,' +
  'backupChecksumCanonicalString:backupChecksumCanonicalString,' +
  'classifyBackupChecksumClaim:classifyBackupChecksumClaim,' +
  'validateBackupSectionChecksums:validateBackupSectionChecksums,' +
  'validateBackupPortableIntegrity:validateBackupPortableIntegrity' +
'};')();

function schema0Base() {
  return { warranties: [], invoices: [] };
}
function schema1Base() {
  return { schemaVersion: 1, warranties: [], invoices: [], sales: [], parts: [], accounts: [] };
}
function sha256utf8(s) {
  return crypto.createHash('sha256').update(s, 'utf8').digest('hex');
}
function snapshot(d) {
  const required = v.validateRequiredBackupCollections(d);
  const structural = v.validateBackupStructuralIntegrity(d);
  const portable = v.validateBackupPortableIntegrity(d);
  const canonicalString = v.backupChecksumCanonicalString(d);
  const sha256Hex = sha256utf8(canonicalString);
  const claim = v.classifyBackupChecksumClaim(d);
  const combinedErrors = [].concat(structural.errors || [], portable.errors || []);
  const combinedWarnings = [].concat(structural.warnings || [], portable.warnings || []);
  const combinedOk = combinedErrors.length === 0;
  const combinedStatus = v.backupValidationStatus({ ok: combinedOk, warnings: combinedWarnings });
  return {
    required: {
      ok: !!required.ok,
      errors: required.errors || [],
      warnings: required.warnings || [],
      missingRequiredCollections: required.missingRequiredCollections || [],
      invalidCollections: required.invalidCollections || []
    },
    structural: {
      ok: !!structural.ok,
      status: structural.status,
      errors: structural.errors || [],
      warnings: structural.warnings || [],
      missingRequiredCollections: structural.missingRequiredCollections || [],
      invalidCollections: structural.invalidCollections || [],
      countMismatches: structural.countMismatches || [],
      brokenAttachmentRefs: structural.brokenAttachmentRefs || [],
      duplicateIdentities: structural.duplicateIdentities || []
    },
    portable: {
      ok: !!portable.ok,
      status: portable.status,
      errors: portable.errors || [],
      warnings: portable.warnings || [],
      sectionChecksumMismatches: portable.sectionChecksumMismatches || [],
      checksumClaimed: !!portable.checksumClaimed,
      checksumAlgo: portable.checksumAlgo || '',
      checksumSkipped: !!portable.checksumSkipped,
      hasBackupId: !!portable.hasBackupId
    },
    combined: {
      ok: combinedOk,
      status: combinedStatus,
      errors: combinedErrors,
      warnings: combinedWarnings
    },
    integrity: {
      canonicalString: canonicalString,
      sha256Hex: sha256Hex,
      checksumClaimed: !!claim.claimed,
      checksumAlgo: claim.algo || '',
      checksumSkipped: !!claim.skipped
    },
    requiredKeys: v.requiredBackupCollectionsFor(d),
    schemaVersion: v.inferBackupSchemaVersion(d)
  };
}

const fixtures = [];
function add(id, input, notes) {
  fixtures.push({ id: id, notes: notes || '', input: input, html: snapshot(input) });
}

add('invalid-null-package', null, 'non-object');
add('invalid-array-package', [], 'array is not a package');
add('schema0-empty-required', schema0Base(), 'schema 0 empty arrays VALID');
add('schema0-missing-sales-parts-accounts', { warranties: [], invoices: [] }, 'schema 0 omit sales/parts/accounts compatible');
add('schema0-missing-warranties', { invoices: [] }, 'warranties always required');
add('schema0-missing-invoices', { warranties: [] }, 'invoices always required');
add('schema0-warranties-null', { warranties: null, invoices: [] }, 'null warranties INVALID');
add('schema0-invoices-wrong-type', { warranties: [], invoices: 'invalid' }, 'non-array invoices INVALID');
add('schema0-bad-record', { warranties: [null], invoices: [] }, 'null record INVALID');
add('schema0-tasks-omitted', { warranties: [], invoices: [] }, 'tasks not required');
add('schema0-tasks-empty', { warranties: [], invoices: [], tasks: [] }, 'tasks empty compatible');
add('schema1-complete-empty', schema1Base(), 'schema >=1 empty required arrays VALID');
add('schema1-missing-sales', { schemaVersion: 1, warranties: [], invoices: [], parts: [], accounts: [] }, 'schema>=1 sales missing INVALID');
add('schema1-missing-parts', { schemaVersion: 1, warranties: [], invoices: [], sales: [], accounts: [] }, 'schema>=1 parts missing INVALID');
add('schema1-missing-accounts', { schemaVersion: 1, warranties: [], invoices: [], sales: [], parts: [] }, 'schema>=1 accounts missing INVALID');
add('schema1-sales-null', { schemaVersion: 1, warranties: [], invoices: [], sales: null, parts: [], accounts: [] }, 'schema>=1 sales null INVALID');
add('schema1-parts-wrong-type', { schemaVersion: 1, warranties: [], invoices: [], sales: [], parts: 'invalid', accounts: [] }, 'schema>=1 parts type INVALID');
add('schema1-accounts-null', { schemaVersion: 1, warranties: [], invoices: [], sales: [], parts: [], accounts: null }, 'schema>=1 accounts null INVALID');
add('schema1-manifest-schema', { manifest: { schemaVersion: 1 }, warranties: [], invoices: [], sales: [], parts: [], accounts: [] }, 'schema from manifest');
add('v2-legacy-no-schema-no-accounts', { version: '2.0', warranties: [], invoices: [] }, 'v2.0 without schemaVersion is schema 0; accounts omitted compatible');
add('itemcounts-absent', schema1Base(), 'absent itemCounts compatible');
add('itemcounts-match', Object.assign(schema1Base(), { itemCounts: { warranties: 0, invoices: 0, sales: 0, parts: 0, accounts: 0 } }), 'matching counts VALID');
add('itemcounts-mismatch', Object.assign(schema1Base(), { warranties: [{ id: 'W1' }], itemCounts: { warranties: 2 } }), 'declared !== length INVALID');
add('itemcounts-not-object', Object.assign(schema1Base(), { itemCounts: [1] }), 'itemCounts array INVALID');
add('itemcounts-non-finite', Object.assign(schema1Base(), { itemCounts: { invoices: '2' } }), 'non-number declared INVALID');
add('attachments-absent', schema1Base(), 'absent attachmentsIndex compatible');
add('attachments-ok', Object.assign(schema1Base(), {
  warranties: [{ id: 'W1', docs: [{ id: 'd1', name: 'a.pdf' }] }],
  attachmentsIndex: [{ id: 'd1', kind: 'warranty', parentId: 'W1', name: 'a.pdf', ref: '', inline: false }]
}), 'supported parent exists');
add('attachments-broken', Object.assign(schema1Base(), {
  warranties: [{ id: 'W1' }],
  attachmentsIndex: [{ id: 'd1', kind: 'warranty', parentId: 'MISSING', name: 'a.pdf' }]
}), 'broken supported reference INVALID');
add('attachments-not-array', Object.assign(schema1Base(), { attachmentsIndex: {} }), 'attachmentsIndex object INVALID');
add('dup-invoiceId-warn', Object.assign(schema1Base(), {
  invoices: [{ id: 'a', invoiceId: 'INVUID-1' }, { id: 'b', invoiceId: 'INVUID-1' }]
}), 'duplicate invoiceId WARNING only');
add('dup-saleUid-warn', Object.assign(schema1Base(), {
  sales: [{ id: 's1', saleUid: 'SALEUID-1' }, { id: 's2', saleUid: 'SALEUID-1' }]
}), 'duplicate saleUid WARNING only');
add('dup-warranty-id-warn', Object.assign(schema1Base(), {
  warranties: [{ id: 'W1' }, { id: 'W1' }]
}), 'duplicate warranty id WARNING only');
add('dup-parts-accounts-warn', Object.assign(schema1Base(), {
  parts: [{ id: 'P1' }, { id: 'P1' }],
  accounts: [{ id: 'A1' }, { id: 'A1' }]
}), 'duplicate parts.id and accounts.id WARNING only');
add('phonebook-not-scanned', Object.assign(schema1Base(), {
  phonebook: [{ fn: 'Ali', phones: ['0912'] }, { fn: 'Ali2', phones: ['0912'] }]
}), 'Phonebook uniqueness is not part of this extraction');
add('checksum-none', Object.assign(schema1Base(), { checksum: '', checksumAlgo: 'none' }), 'none compatible');
add('checksum-absent', schema1Base(), 'absent checksum compatible');
add('checksum-unknown-algo', Object.assign(schema1Base(), { checksum: 'abcd', checksumAlgo: 'MD5' }), 'unknown algo + checksum INVALID');
add('section-checksums-match', (function () {
  const d = Object.assign(schema1Base(), { warranties: [{ id: 'W1' }] });
  d.sectionChecksums = { warranties: v.backupSectionHash(d.warranties), invoices: v.backupSectionHash(d.invoices) };
  return d;
})(), 'matching sectionChecksums VALID');
add('section-checksums-mismatch', Object.assign(schema1Base(), {
  warranties: [{ id: 'W1' }, { id: 'W2' }],
  sectionChecksums: { warranties: v.backupSectionHash([{ id: 'W1' }]) }
}), 'mismatched sectionChecksums INVALID');
add('section-checksums-absent', schema1Base(), 'absent sectionChecksums compatible');
add('section-checksums-not-object', Object.assign(schema1Base(), { sectionChecksums: [] }), 'sectionChecksums array INVALID');

const persian = Object.assign(schema1Base(), {
  company: { name: 'لایق الکترونیک پارسیان', city: 'تهران' },
  warranties: [{ id: 'W-۱', name: 'علی', note: 'گارانتی ۱۲۳' }],
  invoices: [{ id: 'I1', num: '۱', buyer: 'فروشگاه نمونه' }]
});
add('persian-text-and-digits', persian, 'Persian text + Persian digits in canonical JSON');

const nested = Object.assign(schema1Base(), {
  inventory: { P1: { qty: 2, loc: { shelf: 'A', bin: 3 } } },
  invoices: [{ id: 'I1', items: [{ code: 'X', qty: 1.5, nested: { a: [null, { b: true }] } }] }]
});
add('nested-objects-nulls-numbers', nested, 'nested objects, null, 1.5');

const multi = Object.assign(schema1Base(), {
  products: [],
  phonebook: [],
  tasks: [],
  appearance: { theme: 'dark' }
});
add('multiple-sections', multi, 'extra optional sections');

add('empty-arrays-only', schema1Base(), 'empty arrays');

const keyOrderA = { schemaVersion: 1, warranties: [], invoices: [], sales: [], parts: [], accounts: [] };
const keyOrderB = { accounts: [], parts: [], sales: [], invoices: [], warranties: [], schemaVersion: 1 };
add('key-order-schema-first', keyOrderA, 'insertion order A — HTML does not sort keys');
add('key-order-accounts-first', keyOrderB, 'insertion order B — must differ from A');

const hashBase = Object.assign(schema1Base(), {
  exportedAt: '2026-09-04T00:00:00.000Z',
  checksum: 'SHOULD_BE_EXCLUDED',
  checksumAlgo: 'SHA-256',
  invoices: [{ id: 'I1', num: '1' }]
});
add('canonical-excludes-exportedAt-checksum', hashBase, 'canonical payload drops 3 keys');

const exportedAtMut = JSON.parse(JSON.stringify(hashBase));
exportedAtMut.exportedAt = '2099-12-31T00:00:00.000Z';
add('exportedAt-changed-same-canonical', exportedAtMut, 'exportedAt mutation must not change canonical string vs hashBase payload');

const checksumMut = JSON.parse(JSON.stringify(hashBase));
checksumMut.checksum = 'DEADBEEF';
add('checksum-field-changed-same-canonical', checksumMut, 'checksum mutation excluded');

const algoMut = JSON.parse(JSON.stringify(hashBase));
algoMut.checksumAlgo = 'none';
add('checksumAlgo-changed-same-canonical-payload', algoMut, 'checksumAlgo mutation excluded from canonical; claim classification changes');

const pack = {
  id: 'SIRMAN_ARCH2_BACKUP_VALIDATOR_GOLDEN',
  capturedFrom: 'Sirman_Final.html HTML BackupEngine validators (P1C-1..P1C-7)',
  note: 'HTML is the production baseline. Core must match these results. Do not change HTML to make Core pass. Phonebook uniqueness is not scanned. backupId is not invented. SHA-256 is of compact JSON.stringify(payload) UTF-8, not pretty disk bytes. Key order is insertion order (not sorted).',
  spec: {
    requiredAlways: ['warranties', 'invoices'],
    requiredFromSchema: { '1': ['sales', 'parts', 'accounts'] },
    tasks: 'legacy-compatible-not-required',
    itemCounts: { absent: 'compatible', present: 'declared-finite-number-must-equal-array-length-no-repair' },
    attachmentsIndex: { absent: 'compatible', present: 'kind+parentId must match rec.id in warranties|sales|invoices' },
    duplicateIdentities: {
      keys: ['invoices.invoiceId', 'sales.saleUid', 'warranties.id', 'parts.id', 'accounts.id'],
      semantics: 'WARNING-only',
      phonebook: 'not-scanned'
    },
    canonicalExclusions: ['exportedAt', 'checksum', 'checksumAlgo'],
    canonicalSerialization: 'JSON.stringify compact, key insertion order, UTF-8 then SHA-256 when computing digest',
    checksumAlgo: {
      absentOrNone: 'compatible-skipped',
      claimedUnknown: 'INVALID',
      claimedSha256: 'portable does not compare digest; digest is a separate pure function'
    },
    notDiskByteHash: true,
    backupId: 'not-in-format'
  },
  fixtures: fixtures
};

const canonA = pack.fixtures.find(function (f) { return f.id === 'canonical-excludes-exportedAt-checksum'; }).html.integrity;
const canonExp = pack.fixtures.find(function (f) { return f.id === 'exportedAt-changed-same-canonical'; }).html.integrity;
const canonSum = pack.fixtures.find(function (f) { return f.id === 'checksum-field-changed-same-canonical'; }).html.integrity;
if (canonA.canonicalString !== canonExp.canonicalString || canonA.sha256Hex !== canonExp.sha256Hex) {
  throw new Error('golden invariant failed: exportedAt must not affect canonical SHA-256');
}
if (canonA.canonicalString !== canonSum.canonicalString || canonA.sha256Hex !== canonSum.sha256Hex) {
  throw new Error('golden invariant failed: checksum field must not affect canonical SHA-256');
}
const orderA = pack.fixtures.find(function (f) { return f.id === 'key-order-schema-first'; }).html.integrity.canonicalString;
const orderB = pack.fixtures.find(function (f) { return f.id === 'key-order-accounts-first'; }).html.integrity.canonicalString;
if (orderA === orderB) {
  throw new Error('golden invariant failed: HTML JSON.stringify is insertion-order sensitive');
}

fs.writeFileSync(outPath, JSON.stringify(pack, null, 2) + '\n');
process.stdout.write('Wrote ' + fixtures.length + ' fixtures to ' + outPath + '\n');
