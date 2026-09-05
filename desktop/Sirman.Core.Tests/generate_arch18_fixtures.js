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

const helpers = ['_safeArr', '_safeObj', '_safeStr', 'collectOptionalBusinessSnapshot']
  .map(function(n){ return extractFunctionSource(html, n); })
  .join('\n');

function runAdapter(ram) {
  const ctx = Object.assign({
    products: [], inventory: {}, services: [], tasks: [],
    defectiveStock: [], warehouseDocs: [], stockMoves: [], warehouses: [],
    daqi: [], daqiWarehouse: [], daqiVouchers: [], postalHistory: []
  }, ram || {});
  return new Function('ctx', 'with(ctx){ ' + helpers + '\nreturn collectOptionalBusinessSnapshot(); }')(ctx);
}

const orderRows = [];
for (let i = 0; i < 24; i++) {
  orderRows.push({ code: 'C' + i, name: 'n' + i, order: i });
}

const cases = [
  {
    id: 'T1',
    note: 'all OPTIONAL collections populated',
    ram: {
      products: [{ code: 'P-1', name: 'پره', nested: { sku: 'S1' } }],
      inventory: { 'P-1': { code: 'P-1', qty: 4, nested: { bin: 'A' } } },
      services: [{ code: 'S001', name: 'تعویض پره', price: 150000, warr: 'no' }],
      svcs: [{ code: 'IGNORED' }],
      tasks: [{ id: 'TSK-1', title: 'پیگیری', link: { type: 'warranty', id: 'W-1' } }],
      defectiveStock: [{ id: 'DF-1', warrantyId: 'W-1', invoiceNum: '۱۲', invoiceId: 'INVUID-000001', model: 'پره' }],
      warehouseDocs: [{ id: 'WH-IN-0001', type: 'in', fromWh: '', toWh: 'WH-PARTS', items: [{ code: 'PT-9', qty: 2 }] }],
      stockMoves: [{ id: 'SM-0001', itemCode: 'PT-9', refDoc: 'WH-IN-0001', whId: 'WH-PARTS', qty: 2 }],
      warehouses: [{ id: 'WH-PARTS', code: 'PRT', name: 'انبار قطعات' }],
      daqi: [{ id: 'DQ-0001', refType: 'invoice', refId: '۱۲', agencyPhonebookIdx: 3, items: [{ code: 'PT-9', qty: 1 }] }],
      daqiWarehouse: [{ id: 'DW-1', manufacturer: 'سیرمان', code: 'PT-9', name: 'یاتاقان', qty: 5 }],
      daqiVouchers: [{ id: 'DV-1', type: 'out', items: [{ code: 'PT-9', qty: 1 }] }],
      postalHistory: [{ id: 'PH-1', receiverName: 'علی', receiverAddr: 'تهران' }],
      phonebook: [{ fn: 'نباید', ln: 'بیاید' }],
      invoices: [{ invoiceId: 'INVUID-000001' }],
      attachmentsIndex: [{ forged: true }]
    }
  },
  {
    id: 'T2',
    note: 'all empty',
    ram: {
      products: [], inventory: {}, services: [], tasks: [],
      defectiveStock: [], warehouseDocs: [], stockMoves: [], warehouses: [],
      daqi: [], daqiWarehouse: [], daqiVouchers: [], postalHistory: [],
      phonebook: [{ fn: 'x' }]
    }
  },
  {
    id: 'T3',
    note: 'nested objects',
    ram: {
      products: [{ code: 'N1', bag: { a: { b: { c: 'deep' } } } }],
      inventory: { N1: { qty: 1, byWh: { 'WH-PARTS': { qty: 1, nested: { loc: 'B1' } } } } },
      services: [{ code: 'S', extra: { tags: ['a', 'b'] } }],
      tasks: [{ id: 'TSK-N', link: { type: 'invoice', id: '9', nested: { k: 1 } } }],
      defectiveStock: [{ id: 'DF-N', meta: { serials: ['A'] } }],
      warehouseDocs: [{ id: 'WH-OUT-0001', items: [{ code: 'Z', nested: { q: 2 } }] }],
      stockMoves: [{ id: 'SM-N', meta: { batch: 'B' } }],
      warehouses: [{ id: 'WH-GOODS', nested: { color: '#4caf50' } }],
      daqi: [{ id: 'DQ-N', items: [{ code: 'Z', nested: { q: 1 } }] }],
      daqiWarehouse: [{ id: 'DW-N', nested: { note: 'n' } }],
      daqiVouchers: [{ id: 'DV-N', items: [{ nested: { x: true } }] }],
      postalHistory: [{ id: 'PH-N', nested: { zip: '123' } }]
    }
  },
  {
    id: 'T4',
    note: 'Persian Unicode',
    ram: {
      products: [{ code: 'کد-۱', name: 'سلام علی' }],
      inventory: { 'کد-۱': { qty: 2, name: 'یاتاقان جلو' } },
      services: [{ code: 'S-فا', name: 'تعویض گارانتی «پره»' }],
      tasks: [{ id: 'TSK-فا', title: 'پیگیری مریم کاظمی' }],
      defectiveStock: [{ id: 'DF-فا', model: 'پره سفید' }],
      warehouseDocs: [{ id: 'WH-IN-0002', party: 'لایق الکترونیک پارسیان' }],
      stockMoves: [{ id: 'SM-فا', itemName: 'پره' }],
      warehouses: [{ id: 'WH-DEF', name: 'انبار محصولات معیوب' }],
      daqi: [{ id: 'DQ-فا', agencyName: 'نمایندگی یاس' }],
      daqiWarehouse: [{ id: 'DW-فا', manufacturer: 'سیرمان', name: 'پره' }],
      daqiVouchers: [{ id: 'DV-فا', agencyName: 'نمایندگی' }],
      postalHistory: [{ id: 'PH-فا', receiverName: 'علی رضایی' }]
    }
  },
  {
    id: 'T5',
    note: 'exact ordering',
    ram: {
      products: orderRows,
      inventory: orderRows.reduce(function(o, r){ o[r.code] = { qty: r.order }; return o; }, {}),
      services: orderRows.map(function(r){ return { code: 'S' + r.order, name: r.name }; }),
      tasks: orderRows.map(function(r){ return { id: 'TSK-ORD-' + String(r.order).padStart(3, '0') }; }),
      defectiveStock: orderRows.map(function(r){ return { id: 'DF-ORD-' + r.order }; }),
      warehouseDocs: orderRows.map(function(r){ return { id: 'WH-ORD-' + r.order }; }),
      stockMoves: orderRows.map(function(r){ return { id: 'SM-ORD-' + r.order }; }),
      warehouses: orderRows.map(function(r){ return { id: 'WH-E-' + r.order }; }),
      daqi: orderRows.map(function(r){ return { id: 'DQ-ORD-' + r.order }; }),
      daqiWarehouse: orderRows.map(function(r){ return { id: 'DW-ORD-' + r.order }; }),
      daqiVouchers: orderRows.map(function(r){ return { id: 'DV-ORD-' + r.order }; }),
      postalHistory: orderRows.map(function(r){ return { id: 'PH-ORD-' + r.order }; })
    }
  },
  {
    id: 'T6',
    note: 'duplicate records preserved',
    ram: {
      products: [{ code: 'P1', twin: 'a' }, { code: 'P1', twin: 'b' }],
      inventory: { P1: { qty: 1 } },
      services: [{ code: 'S1', name: 'one' }, { code: 'S1', name: 'two' }],
      tasks: [{ id: 'TSK-1', title: 'a' }, { id: 'TSK-1', title: 'b' }],
      defectiveStock: [{ id: 'DF-1', x: 1 }, { id: 'DF-1', x: 2 }],
      warehouseDocs: [{ id: 'WH-IN-0001' }, { id: 'WH-IN-0001' }],
      stockMoves: [{ id: 'SM-0001' }, { id: 'SM-0001' }],
      warehouses: [{ id: 'WH-PARTS', n: 1 }, { id: 'WH-PARTS', n: 2 }],
      daqi: [{ id: 'DQ-0001' }, { id: 'DQ-0001' }],
      daqiWarehouse: [{ id: 'DW-1' }, { id: 'DW-1' }],
      daqiVouchers: [{ id: 'DV-1' }, { id: 'DV-1' }],
      postalHistory: [{ id: 'PH-1' }, { id: 'PH-1' }]
    }
  },
  {
    id: 'T7',
    note: 'missing optional fields',
    ram: {
      products: [{ name: 'بدون کد' }],
      inventory: {},
      services: [{ name: 'بدون کد و id' }],
      tasks: [{ title: 'بدون id' }],
      defectiveStock: [{ model: 'بدون id' }],
      warehouseDocs: [{ type: 'in' }],
      stockMoves: [{ itemCode: 'X' }],
      warehouses: [{ name: 'بدون id' }],
      daqi: [{ refType: 'manual' }],
      daqiWarehouse: [{ manufacturer: 'M', name: 'n' }],
      daqiVouchers: [{ type: 'out' }],
      postalHistory: [{ receiverName: 'x' }]
    }
  },
  {
    id: 'T8',
    note: 'null/primitive values currently allowed',
    ram: {
      products: [{ code: '0', name: '', price: 0, flag: '0' }],
      inventory: { '0': { qty: 0 } },
      services: [{ code: '', name: 'x', price: 0 }],
      tasks: [{ id: 'TSK-0', deadlineTS: null, link: null, notify: false }],
      defectiveStock: [{ id: 'DF-0', qty: 0, returnedAt: null }],
      warehouseDocs: [{ id: 'WH-ADJ-0001', price: 0 }],
      stockMoves: [{ id: 'SM-0', qty: 0, refDoc: '' }],
      warehouses: [{ id: 'WH-X', isDefault: false }],
      daqi: [{ id: 'DQ-0', agencyPhonebookIdx: null, items: [] }],
      daqiWarehouse: null,
      daqiVouchers: null,
      postalHistory: null
    }
  },
  {
    id: 'T9',
    note: 'cross-reference values preserved',
    ram: {
      products: [{ code: 'INV-SKU' }],
      inventory: { 'INV-SKU': { qty: 2 } },
      services: [{ code: 'S001', name: 'تعویض پره' }],
      tasks: [
        { id: 'TSK-AUTO-12', link: { type: 'invoice', id: '12' }, autoInvoice: true },
        { id: 'TSK-AUTO-WAR-W-1', link: { type: 'warranty', id: 'W-1' }, autoWarranty: true },
        { id: 'TSK-S', link: { type: 'sale', id: 'SL-0001' } }
      ],
      defectiveStock: [{ id: 'DF-R', warrantyId: 'W-1', invoiceNum: '12', invoiceId: 'INVUID-000012' }],
      warehouseDocs: [{ id: 'WH-OUT-0003', fromWh: 'WH-PARTS', toWh: '', items: [{ code: 'PT-9' }] }],
      stockMoves: [
        { id: 'SM-R1', itemCode: 'PT-9', refDoc: 'WH-OUT-0003', whId: 'WH-PARTS' },
        { id: 'SM-R2', itemCode: 'INV-SKU', refDoc: '12', source: 'invoice' },
        { id: 'SM-R3', itemCode: 'PT-9', refDoc: 'W-1', source: 'warranty' }
      ],
      warehouses: [{ id: 'WH-PARTS' }],
      daqi: [{ id: 'DQ-R', refType: 'sale', refId: 'SL-0001', agencyPhonebookIdx: 7 }],
      daqiWarehouse: [{ id: 'DW-R', code: 'PT-9' }],
      daqiVouchers: [{ id: 'DV-R', items: [{ code: 'PT-9' }] }],
      postalHistory: [{ id: 'PH-R' }]
    }
  },
  {
    id: 'T10',
    note: 'services/svcs same-source semantics',
    ram: {
      products: [],
      inventory: {},
      services: [{ code: 'LIVE', name: 'منبع خدمات', price: 1 }],
      svcs: [{ code: 'STALE', name: 'آرایه جدا که اسمبل آن را نمی‌خواند' }],
      tasks: [],
      defectiveStock: [],
      warehouseDocs: [],
      stockMoves: [],
      warehouses: [],
      daqi: [],
      daqiWarehouse: [],
      daqiVouchers: [],
      postalHistory: []
    }
  }
];

const out = {
  generatedAt: 'ARCH-18',
  cases: cases.map(function(c) {
    return {
      id: c.id,
      note: c.note,
      ram: c.ram,
      expected: runAdapter(c.ram)
    };
  })
};

const dest = path.join(__dirname, 'OptionalBusinessFixtures.json');
fs.writeFileSync(dest, JSON.stringify(out, null, 2) + '\n');
console.log('wrote', dest, 'cases', out.cases.length);
out.cases.forEach(function(c){
  const e = c.expected;
  console.log(c.id, 'keys', Object.keys(e).join(','),
    'svc', (e.services[0] && e.services[0].code) || '-',
    'svcs', (e.svcs[0] && e.svcs[0].code) || '-',
    'daqiWh', JSON.stringify(e.daqiWarehouse).slice(0, 40),
    'phonebook' in e, 'attachmentsIndex' in e);
});
