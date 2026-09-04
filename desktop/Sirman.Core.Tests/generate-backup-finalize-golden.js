#!/usr/bin/env node
'use strict';
/**
 * ARCH-5: capture currently verified HTML backup finalization / serialization.
 * Source of truth: Sirman_Final.html finalizeBackupPackage + attachChecksum +
 * canonical compact JSON SHA-256. Does not extract _buildFullBackupData.
 *
 * Usage: node desktop/Sirman.Core.Tests/generate-backup-finalize-golden.js [path/to/Sirman_Final.html]
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const FROZEN_NOW_MS = 1700000000000;
const htmlPath = path.resolve(process.argv[2] || path.join(__dirname, '..', '..', 'Sirman_Final.html'));
const outPath = path.join(__dirname, 'BackupFinalizeGolden.json');
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

const fnSrc = [
  'var SIRMAN_SCHEMA_VERSION = 1;',
  'var SIRMAN_BACKUP_MAGIC = "SIRMAN_BACKUP";',
  'var window = { DISK_REF_PREFIX: "disk://" };',
  'function isDiskRef(s){ return typeof s === "string" && s.indexOf("disk://") === 0; }',
  extractFunctionSource(html, 'buildBackupManifest'),
  extractFunctionSource(html, 'backupSectionHash'),
  extractFunctionSource(html, 'attachSectionChecksums'),
  extractFunctionSource(html, 'collectAttachmentIndex'),
  extractFunctionSource(html, 'finalizeBackupPackage'),
  extractFunctionSource(html, 'backupChecksumExcludedKey'),
  extractFunctionSource(html, 'backupChecksumPayload'),
  extractFunctionSource(html, 'backupChecksumCanonicalString')
].join('\n');

if (fnSrc.indexOf('function finalizeBackupPackage') < 0) {
  throw new Error('failed to extract finalizeBackupPackage from ' + htmlPath);
}

const api = new Function(fnSrc + '\nreturn {' +
  'finalizeBackupPackage:finalizeBackupPackage,' +
  'attachSectionChecksums:attachSectionChecksums,' +
  'collectAttachmentIndex:collectAttachmentIndex,' +
  'buildBackupManifest:buildBackupManifest,' +
  'backupSectionHash:backupSectionHash,' +
  'backupChecksumCanonicalString:backupChecksumCanonicalString,' +
  'backupChecksumPayload:backupChecksumPayload,' +
  'backupChecksumExcludedKey:backupChecksumExcludedKey' +
'};')();

function clone(d) {
  if (d === undefined) return undefined;
  return JSON.parse(JSON.stringify(d));
}

function sha256utf8(s) {
  return crypto.createHash('sha256').update(s, 'utf8').digest('hex');
}

function attachChecksumHtml(data, mode) {
  if (mode === 'leave') return data;
  if (mode === 'none') {
    data.checksum = '';
    data.checksumAlgo = 'none';
    return data;
  }
  const jsonStr = api.backupChecksumCanonicalString(data);
  data.checksum = sha256utf8(jsonStr);
  data.checksumAlgo = 'SHA-256';
  return data;
}

function schema1Base() {
  return {
    version: '1405.6.3α',
    exportedAt: '2023-11-14T22:13:20.000Z',
    origin: 'manual',
    warranties: [],
    invoices: [],
    sales: [],
    parts: [],
    accounts: [],
    phonebook: [],
    products: [],
    itemCounts: { warranties: 0, invoices: 0, sales: 0, parts: 0, accounts: 0 },
    sections: ['warranties', 'invoices', 'sales', 'parts', 'accounts', 'phonebook', 'products']
  };
}

function runCase(row) {
  const origin = Object.prototype.hasOwnProperty.call(row, 'origin') ? row.origin : undefined;
  const kind = Object.prototype.hasOwnProperty.call(row, 'kind') ? row.kind : undefined;
  const mode = row.checksumMode || 'leave';
  const inputSnapshot = row.input === undefined ? undefined : clone(row.input);
  let data = row.input === undefined ? undefined : clone(row.input);
  if (row.stampExportedAt && row.nowMs != null) {
    if (data == null || typeof data !== 'object' || Array.isArray(data)) data = {};
    data.exportedAt = new Date(row.nowMs).toISOString();
  }
  let threw = false;
  let errorName = '';
  let errorMessage = '';
  let afterFinalize = null;
  try {
    afterFinalize = api.finalizeBackupPackage(data, origin, kind);
  } catch (e) {
    threw = true;
    errorName = e && e.name ? e.name : 'Error';
    errorMessage = e && e.message ? String(e.message) : String(e);
  }
  let afterAttach = afterFinalize;
  if (!threw && afterFinalize && typeof afterFinalize === 'object') {
    afterAttach = attachChecksumHtml(afterFinalize, mode);
  }
  const canonicalString = threw ? '' : api.backupChecksumCanonicalString(afterAttach);
  const sha256Hex = threw ? '' : sha256utf8(canonicalString || 'null');
  let sha256AfterMutateExportedAt = null;
  if (!threw && row.mutateExportedAtAfter) {
    const mutated = clone(afterAttach);
    mutated.exportedAt = row.mutateExportedAtAfter;
    sha256AfterMutateExportedAt = sha256utf8(api.backupChecksumCanonicalString(mutated));
  }
  return {
    id: row.id,
    notes: row.notes || '',
    origin: origin === undefined ? null : origin,
    kind: kind === undefined ? null : kind,
    nowMs: row.nowMs == null ? null : row.nowMs,
    stampExportedAt: !!row.stampExportedAt,
    checksumMode: mode,
    input: inputSnapshot === undefined ? null : inputSnapshot,
    html: {
      threw: threw,
      errorName: errorName,
      errorMessage: errorMessage,
      compactJson: threw ? null : JSON.stringify(afterAttach),
      canonicalString: canonicalString,
      sha256Hex: sha256Hex,
      sha256AfterMutateExportedAt: sha256AfterMutateExportedAt,
      checksum: threw || !afterAttach ? '' : String(afterAttach.checksum || ''),
      checksumAlgo: threw || !afterAttach ? '' : String(afterAttach.checksumAlgo || ''),
      exportedAt: threw || !afterAttach ? '' : String(afterAttach.exportedAt || ''),
      magic: threw || !afterAttach ? '' : String(afterAttach.magic || ''),
      schemaVersion: threw || !afterAttach ? null : afterAttach.schemaVersion,
      applicationVersion: threw || !afterAttach ? '' : String(afterAttach.applicationVersion || ''),
      sectionChecksums: threw || !afterAttach ? null : (afterAttach.sectionChecksums || null),
      attachmentsIndex: threw || !afterAttach ? null : (afterAttach.attachmentsIndex || null),
      manifest: threw || !afterAttach ? null : (afterAttach.manifest || null),
      itemCounts: threw || !afterAttach ? null : (afterAttach.itemCounts || null),
      finalized: threw ? null : afterAttach,
      prettyPrintIsNotHashed: true,
      canonicalExclusions: ['exportedAt', 'checksum', 'checksumAlgo']
    }
  };
}

const cases = [
  {
    id: 'T1-valid-ordinary',
    notes: 'ordinary schema-1 backup; finalize + SHA-256 attach (exe/subtle path)',
    origin: 'manual',
    kind: 'full',
    checksumMode: 'sha256',
    input: Object.assign(schema1Base(), {
      warranties: [{ id: 'w1', customer: 'Ali' }],
      invoices: [{ id: 'i1', total: 1000 }],
      itemCounts: { warranties: 1, invoices: 1, sales: 0, parts: 0, accounts: 0 }
    })
  },
  {
    id: 'T2-empty-collections',
    notes: 'empty arrays still get package metadata and section hashes of []',
    origin: 'manual',
    kind: 'full',
    checksumMode: 'sha256',
    input: schema1Base()
  },
  {
    id: 'T3-persian-text',
    notes: 'Persian customer/product text must keep Unicode in compact JSON and SHA-256',
    origin: 'manual',
    kind: 'full',
    checksumMode: 'sha256',
    input: Object.assign(schema1Base(), {
      warranties: [{ id: 'w-fa', customer: 'علی رضایی', note: 'گارانتی ۱۲ ماه' }],
      invoices: [{ id: 'i-fa', desc: 'فاکتور تعمیر' }],
      company: { name: 'لایق الکترونیک پارسیان', city: 'تهران' },
      itemCounts: { warranties: 1, invoices: 1, sales: 0, parts: 0, accounts: 0 }
    })
  },
  {
    id: 'T4-nested-object',
    notes: 'nested appearance/company objects hashed via JSON.stringify insertion order',
    origin: 'manual',
    kind: 'full',
    checksumMode: 'sha256',
    input: Object.assign(schema1Base(), {
      company: { name: 'Sirman', address: { city: 'Tehran', line: 'Enghelab' } },
      appearance: { theme: 'dark', sizes: { ui: 14, print: 12 } }
    })
  },
  {
    id: 'T5-null-field',
    notes: 'JSON null is hashed (not skipped); undefined cannot appear in JSON fixtures',
    origin: 'manual',
    kind: 'full',
    checksumMode: 'sha256',
    input: Object.assign(schema1Base(), {
      company: { name: null, city: 'تهران' },
      notes: null
    })
  },
  {
    id: 'T6-exportedAt-variation',
    notes: 'P1C-7: mutating top-level exportedAt after finalize must not change SHA-256. manifest.exportedAt stays in hash domain.',
    origin: 'manual',
    kind: 'full',
    checksumMode: 'sha256',
    mutateExportedAtAfter: '2099-12-31T00:00:00.000Z',
    input: Object.assign(schema1Base(), { exportedAt: '2023-11-14T22:13:20.000Z' })
  },
  {
    id: 'T7-existing-checksum',
    notes: 'finalize leaves existing checksum; sha256 attach always overwrites (HTML attachChecksum)',
    origin: 'manual',
    kind: 'full',
    checksumMode: 'sha256',
    input: Object.assign(schema1Base(), {
      checksum: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      checksumAlgo: 'SHA-256'
    })
  },
  {
    id: 'T8-checksumAlgo-none',
    notes: 'file:// / no-subtle path: stored checksum empty, algo none; computed SHA-256 still recorded',
    origin: 'manual',
    kind: 'full',
    checksumMode: 'none',
    input: schema1Base()
  },
  {
    id: 'T9-sha256',
    notes: 'explicit SHA-256 attach; stored checksum equals computed hex of canonical compact JSON',
    origin: 'manual',
    kind: 'full',
    checksumMode: 'sha256',
    input: Object.assign(schema1Base(), { invoices: [{ id: 'I1', num: '1' }], itemCounts: { warranties: 0, invoices: 1, sales: 0, parts: 0, accounts: 0 } })
  },
  {
    id: 'T10-unknown-algorithm',
    notes: 'unknown algo is a verify concern; finalize-only (leave) preserves MD5 fields. ARCH-5 does not strengthen.',
    origin: 'manual',
    kind: 'full',
    checksumMode: 'leave',
    input: Object.assign(schema1Base(), { checksum: 'deadbeef', checksumAlgo: 'MD5' })
  },
  {
    id: 'T11-sectionChecksums',
    notes: 'pre-existing wrong sectionChecksums are always rebuilt by finalize (unlike 0→1 which only fills if falsy)',
    origin: 'manual',
    kind: 'full',
    checksumMode: 'sha256',
    input: Object.assign(schema1Base(), {
      sectionChecksums: { warranties: 'dead', invoices: 'beef' }
    })
  },
  {
    id: 'T12-attachmentsIndex',
    notes: 'finalize always rebuilds attachmentsIndex from warranties/sales/invoices docs',
    origin: 'manual',
    kind: 'full',
    checksumMode: 'sha256',
    input: Object.assign(schema1Base(), {
      warranties: [{
        id: 'w1',
        docs: [
          { id: 'd1', name: 'a.pdf', data: 'data:hello' },
          { name: 'disk-file', data: 'disk://path/x' }
        ]
      }],
      sales: [{ id: 's1', attachments: [{ name: 's.doc', src: 'idb:abc' }] }],
      invoices: [{ id: 'i1', docs: { extra: [{ name: 'n', ref: 'inline-ref' }] } }],
      attachmentsIndex: [{ id: 'stale', name: 'should-be-rebuilt' }],
      itemCounts: { warranties: 1, invoices: 1, sales: 1, parts: 0, accounts: 0 }
    })
  },
  {
    id: 'T13-itemCounts',
    notes: 'itemCounts copied into manifest as-is; not recomputed by finalize',
    origin: 'manual',
    kind: 'full',
    checksumMode: 'sha256',
    input: Object.assign(schema1Base(), {
      warranties: [{ id: 'w1' }, { id: 'w2' }],
      itemCounts: { warranties: 2, invoices: 0, extraDeclared: 9 }
    })
  },
  {
    id: 'T14-property-ordering',
    notes: 'key insertion order is preserved; new finalize keys append only if absent',
    origin: 'manual',
    kind: 'full',
    checksumMode: 'sha256',
    input: {
      zebra: 1,
      accounts: [],
      parts: [],
      sales: [],
      invoices: [],
      warranties: [],
      alpha: true,
      version: '1405.6.3α',
      exportedAt: '2023-11-14T22:13:20.000Z'
    }
  },
  {
    id: 'T15-input-immutability',
    notes: 'golden stores original input; Core must leave caller identical (HTML mutates — Core clones)',
    origin: 'manual',
    kind: 'full',
    checksumMode: 'sha256',
    input: Object.assign(schema1Base(), { probe: 'do-not-mutate-caller' })
  },
  {
    id: 'T16-injected-nowMs',
    notes: 'StampExportedAt + injected nowMs; Core must not call Date.now. ISO matches JS toISOString.',
    origin: 'manual',
    kind: 'full',
    checksumMode: 'sha256',
    stampExportedAt: true,
    nowMs: FROZEN_NOW_MS,
    input: Object.assign(schema1Base(), { exportedAt: '1999-01-01T00:00:00.000Z' })
  },
  {
    id: 'T17-repeated-identical',
    notes: 'same as T2; Core runs finalize twice and requires identical compact JSON',
    origin: 'manual',
    kind: 'full',
    checksumMode: 'sha256',
    input: schema1Base()
  },
  {
    id: 'T18-unicode-utf8',
    notes: 'Persian + emoji + U+2028/U+2029; modern JSON.stringify does not escape LS/PS',
    origin: 'manual',
    kind: 'full',
    checksumMode: 'sha256',
    input: Object.assign(schema1Base(), {
      warranties: [{ id: 'u1', note: 'سلام 😀\u2028خط بعد' }],
      invoices: [{ id: 'u2', note: '\u2029paragraph' }]
    })
  },
  {
    id: 'T19-malformed-null',
    notes: 'HTML data||{} : null becomes empty package then finalized',
    origin: 'manual',
    kind: 'full',
    checksumMode: 'sha256',
    input: null
  }
];

const fixtures = cases.map(runCase);

const pack = {
  id: 'SIRMAN_ARCH5_BACKUP_FINALIZE_GOLDEN',
  packet: 'ARCH-5',
  capturedFrom: 'Sirman_Final.html finalizeBackupPackage + attachChecksum + backupChecksumCanonicalString',
  frozenNowMs: FROZEN_NOW_MS,
  frozenNowIso: new Date(FROZEN_NOW_MS).toISOString(),
  note: 'HTML is the production baseline. Core must match these results. Do not change HTML to make Core pass. SHA-256 input is UTF-8 bytes of compact JSON.stringify(payload) excluding top-level exportedAt/checksum/checksumAlgo. Pretty-printed disk JSON is NOT hashed. _buildFullBackupData is NOT extracted. backupId is not invented.',
  spec: {
    extractedHtmlFunctions: [
      'finalizeBackupPackage',
      'attachSectionChecksums',
      'backupSectionHash',
      'collectAttachmentIndex',
      'buildBackupManifest',
      'backupChecksumPayload',
      'backupChecksumCanonicalString',
      'attachChecksum'
    ],
    notExtracted: ['_buildFullBackupData', 'exportData', 'importData', 'migrateBackup'],
    canonicalExclusions: ['exportedAt', 'checksum', 'checksumAlgo'],
    canonicalSerialization: 'JSON.stringify compact, key insertion order, UTF-8 then SHA-256',
    notDiskByteHash: true,
    prettyPrintIsNotHashed: true,
    checksumAlgo: {
      leave: 'preserve existing fields',
      none: "checksum='', checksumAlgo='none' (file://)",
      sha256: 'always overwrite with SHA-256 of canonical payload'
    },
    sectionChecksums: 'always rebuilt; skip metadata keys; djb2 of JSON.stringify over UTF-16 code units',
    attachmentsIndex: 'always rebuilt by finalize (unlike schema 0→1 which fills only if falsy)',
    exportedAt: 'not set by finalize; optional Core stamp via injected nowMs only',
    inputImmutability: 'HTML mutates; Core clones',
    backupId: 'not-in-format'
  },
  fixtures: fixtures
};

fs.writeFileSync(outPath, JSON.stringify(pack, null, 2) + '\n', 'utf8');
console.log('wrote', outPath, 'fixtures', fixtures.length);
fixtures.forEach(function (f) {
  const h = f.html;
  console.log(f.id, h.threw ? ('THROW ' + h.errorName + ' ' + h.errorMessage) : (h.checksumAlgo || 'no-algo') + ' sha=' + (h.sha256Hex || '').slice(0, 12));
});
