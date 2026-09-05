#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');

const htmlPath = path.join(__dirname, '..', '..', 'Sirman_Final.html');
const html = fs.readFileSync(htmlPath, 'utf8');

function extractFunctionSource(src, fnName) {
  const startMatch = src.match(new RegExp('(?:async\\s+)?function\\s+' + fnName + '\\s*\\([^)]*\\)\\s*\\{'));
  if (!startMatch) throw new Error('missing ' + fnName);
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

const helpers = ['_safeArr', 'isDiskRef', 'collectAttachmentIndex', 'validateBackupAttachmentIndex']
  .map(function(n){ return extractFunctionSource(html, n); })
  .join('\n');

function runCollector(bag) {
  const ctx = Object.assign({
    window: { DISK_REF_PREFIX: 'disk://' }
  }, bag || {});
  return new Function('ctx', 'with(ctx){ ' + helpers + '\nreturn collectAttachmentIndex(ctx); }')(ctx);
}

function runValidator(d) {
  const ctx = { window: { DISK_REF_PREFIX: 'disk://' }, d: d };
  return new Function('ctx', 'with(ctx){ ' + helpers + '\nreturn validateBackupAttachmentIndex(d); }')(ctx);
}

const cases = [
  {
    id: 'T1',
    note: 'empty attachmentsIndex',
    bag: { warranties: [], sales: [], invoices: [] }
  },
  {
    id: 'T2',
    note: 'populated warranty attachment',
    bag: {
      warranties: [{
        id: 'W-1',
        docs: [{ id: 'WD-1', name: 'رسید.pdf', data: 'disk://sirman_media/docs/wdoc_1_a.pdf', mime: 'application/pdf' }]
      }],
      sales: [],
      invoices: []
    }
  },
  {
    id: 'T3',
    note: 'populated invoice attachment (rec.id present)',
    bag: {
      warranties: [],
      sales: [],
      invoices: [{
        id: 'mig_inv_0_1',
        invoiceId: 'INVUID-000012',
        num: '12',
        docs: [{ name: 'فاکتور.jpg', data: 'data:image/jpeg;base64,AAA' }]
      }]
    }
  },
  {
    id: 'T4',
    note: 'populated sales attachment (rec.id is SL display, not saleUid)',
    bag: {
      warranties: [],
      sales: [{
        id: 'SL-0001',
        saleUid: 'SALEUID-000007',
        docs: [{ name: 'حواله.png', data: 'disk://sirman_media/docs/sale_1_b.png' }]
      }],
      invoices: []
    }
  },
  {
    id: 'T5',
    note: 'multiple attachment records, walk order warranties→sales→invoices',
    bag: {
      warranties: [
        { id: 'W-A', docs: [{ name: 'a1' }, { name: 'a2' }] },
        { id: 'W-B', docs: [{ name: 'b1' }] }
      ],
      sales: [{ id: 'SL-0002', docs: [{ name: 's1' }] }],
      invoices: [{ id: 'INV-X', docs: [{ name: 'i1' }] }]
    }
  },
  {
    id: 'T6',
    note: 'orphan reference: index parentId not in warranties',
    bag: {
      warranties: [{ id: 'W-LIVE', docs: [{ name: 'live.pdf', data: 'disk://sirman_media/docs/live.pdf' }] }],
      sales: [],
      invoices: []
    },
    validatorOverride: {
      warranties: [],
      sales: [],
      invoices: [],
      attachmentsIndex: [
        { id: 'orphan-1', kind: 'warranty', parentId: 'W-MISSING', name: 'gone.pdf', ref: '', inline: false }
      ]
    }
  },
  {
    id: 'T7',
    note: 'unsupported kind and non-parent collections are not indexed',
    bag: {
      warranties: [],
      sales: [],
      invoices: [],
      phonebook: [{ fn: 'علی', docs: [{ name: 'should-not-index.pdf', data: 'disk://x' }] }],
      products: [{ code: 'P-1', img: 'data:image/png;base64,BBB' }],
      tasks: [{ id: 'TSK-1', docs: [{ name: 'task.pdf' }] }]
    },
    validatorOverride: {
      warranties: [],
      sales: [],
      invoices: [],
      attachmentsIndex: [
        { id: 'x', kind: 'task', parentId: 'TSK-1', name: 'task.pdf' },
        { id: 'y', kind: 'phonebook', parentId: '0', name: 'pb.pdf' }
      ]
    }
  },
  {
    id: 'T8',
    note: 'malformed/missing parentId: invoice has invoiceId but no rec.id',
    bag: {
      warranties: [],
      sales: [],
      invoices: [{
        invoiceId: 'INVUID-000099',
        num: '99',
        docs: [{ name: 'بدون-id.pdf', data: 'disk://sirman_media/docs/inv.pdf' }]
      }]
    }
  },
  {
    id: 'T9',
    note: 'duplicate attachment identity preserved',
    bag: {
      warranties: [{
        id: 'W-DUP',
        docs: [
          { id: 'SAME', name: 'one.pdf' },
          { id: 'SAME', name: 'two.pdf' }
        ]
      }],
      sales: [],
      invoices: []
    }
  },
  {
    id: 'T10',
    note: 'external-store disk:// and idb: references; inline dataURL',
    bag: {
      warranties: [{
        id: 'W-EXT',
        docs: [
          { name: 'disk.pdf', data: 'disk://sirman_media/docs/a.pdf' },
          { name: 'legacy-idb.bin', data: 'idb:blob-1' },
          { name: 'inline.png', data: 'data:image/png;base64,CCC' },
          { name: 'empty', data: '' }
        ]
      }],
      sales: [],
      invoices: []
    }
  },
  {
    id: 'T11',
    note: 'Phonebook docs are not attachment parents',
    bag: {
      warranties: [],
      sales: [],
      invoices: [],
      phonebook: [{ fn: 'مریم', ln: 'کاظمی', phones: ['0912'], docs: [{ name: 'کارت.pdf', data: 'disk://x' }] }]
    }
  },
  {
    id: 'T12',
    note: 'Persian Unicode metadata',
    bag: {
      warranties: [{
        id: 'W-فا',
        docs: [{ id: 'د-۱', name: 'رسید «پره» لایق الکترونیک پارسیان.pdf', data: 'disk://sirman_media/docs/پر.pdf' }]
      }],
      sales: [],
      invoices: []
    }
  },
  {
    id: 'T13',
    note: 'nested rec.docs object map is walked; agencyWork.docs is not',
    bag: {
      warranties: [{
        id: 'W-NEST',
        docs: {
          ship: [{ name: 'بارنامه.pdf', data: 'disk://sirman_media/docs/ship.pdf' }],
          cond: [{ name: 'وضعیت.jpg', src: 'disk://sirman_media/docs/cond.jpg' }]
        },
        agencyWork: { docs: { ship: [{ name: 'NOT-INDEXED.pdf', data: 'disk://hidden.pdf' }] } },
        devices: [{ model: 'پره', docs: [{ name: 'device.jpg', data: 'disk://dev.jpg' }] }]
      }],
      sales: [],
      invoices: []
    }
  },
  {
    id: 'T14',
    note: 'exact ordering preservation',
    bag: {
      warranties: Array.from({ length: 8 }, function(_, i) {
        return { id: 'W-ORD-' + String(i).padStart(2, '0'), docs: [{ name: 'w' + i }] };
      }),
      sales: Array.from({ length: 3 }, function(_, i) {
        return { id: 'SL-ORD-' + String(i).padStart(4, '0'), docs: [{ name: 's' + i }] };
      }),
      invoices: Array.from({ length: 3 }, function(_, i) {
        return { id: 'INV-ORD-' + i, docs: [{ name: 'i' + i }] };
      })
    }
  }
];

const out = {
  generatedAt: 'ARCH-19',
  indexFields: ['id', 'name', 'ref', 'inline', 'kind', 'parentId'],
  walkOrder: ['warranty', 'sale', 'invoice'],
  parentIdentityField: 'id',
  cases: cases.map(function(c) {
    const expectedIndex = runCollector(c.bag);
    const validatorInput = c.validatorOverride || {
      warranties: c.bag.warranties || [],
      sales: c.bag.sales || [],
      invoices: c.bag.invoices || [],
      attachmentsIndex: expectedIndex
    };
    const validation = runValidator(validatorInput);
    return {
      id: c.id,
      note: c.note,
      bag: c.bag,
      expectedIndex: expectedIndex,
      validatorInput: validatorInput,
      validation: {
        ok: validation.ok,
        errors: validation.errors,
        brokenAttachmentRefs: validation.brokenAttachmentRefs
      }
    };
  })
};

const dest = path.join(__dirname, 'AttachmentReferenceFixtures.json');
fs.writeFileSync(dest, JSON.stringify(out, null, 2) + '\n');
console.log('wrote', dest, 'cases', out.cases.length);
out.cases.forEach(function(c){
  console.log(c.id, 'n=' + c.expectedIndex.length,
    'kinds=' + c.expectedIndex.map(function(x){ return x.kind; }).join('|'),
    'parentIds=' + JSON.stringify(c.expectedIndex.map(function(x){ return x.parentId; })),
    'valid=' + c.validation.ok);
});
