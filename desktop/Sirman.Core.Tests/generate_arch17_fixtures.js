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

const helpers = ['_safeArr', '_safeObj', '_safeStr', 'collectRequiredBusinessSnapshot']
  .map(function(n){ return extractFunctionSource(html, n); })
  .join('\n');

function runAdapter(ram) {
  const ctx = Object.assign({
    invoices: [], sales: [], warranties: [], parts: [], accounts: [],
    invCtr: 0, invoiceUidCtr: 0, saleCtr: 0, saleUidCtr: 0
  }, ram || {});
  return new Function('ctx', 'with(ctx){ ' + helpers + '\nreturn collectRequiredBusinessSnapshot(); }')(ctx);
}

const t10Invoices = [];
for (let i = 0; i < 40; i++) {
  t10Invoices.push({ invoiceId: 'INVUID-' + String(i + 1).padStart(6, '0'), num: String(100 + i), order: i });
}

const cases = [
  {
    id: 'T1',
    note: 'all REQUIRED collections populated',
    ram: {
      invoices: [{
        invoiceId: 'INVUID-000007',
        num: '۱۲',
        seller: 'علی رضایی',
        items: [{ code: 'P1', model: 'پره', fin: 150000 }],
        docs: [{ id: 'd1', name: 'a.pdf', data: 'disk://sirman_media/a.pdf' }],
        nested: { tag: 'keep' }
      }],
      sales: [{
        saleUid: 'SALEUID-000003',
        id: 'SL-0003',
        items: [{ partCode: 'PT-9', qty: 2 }],
        total: 200000,
        name: 'فروشگاه نمونه'
      }],
      warranties: [{
        id: 'W25-20101-0001',
        name: 'مریم',
        devices: [{ serial: 'SN-۱', nested: { color: 'سفید' } }],
        docs: [{ name: 'w.png', data: 'data:image/png;base64,xx' }]
      }],
      parts: [{ id: 'PT-1', code: 'PT-9', name: 'یاتاقان', qty: 4, nested: { bin: 'A' } }],
      accounts: [{
        id: 'ACC-0001',
        number: '6037',
        name: 'صندوق',
        balance: 5000,
        transactions: [{ refId: 'INVUID-000007', amount: 150000, type: 'deposit' }]
      }],
      invCtr: 8,
      invoiceUidCtr: 7,
      saleCtr: 4,
      saleUidCtr: 3,
      phonebook: [{ fn: 'نباید', ln: 'بیاید', phones: ['0912'] }],
      tasks: [{ id: 'TSK-X' }],
      services: [{ code: 'S001' }],
      attachmentsIndex: [{ forged: true }]
    }
  },
  {
    id: 'T2',
    note: 'empty collections with assembler counter defaults',
    ram: {
      invoices: [], sales: [], warranties: [], parts: [], accounts: [],
      invCtr: 0, invoiceUidCtr: 0, saleCtr: 0, saleUidCtr: 0,
      phonebook: [{ fn: 'x' }]
    }
  },
  {
    id: 'T3',
    note: 'missing optional/legacy fields currently legal',
    ram: {
      invoices: [{ num: '9', seller: 'بدون شناسه' }],
      sales: [{ id: 'SL-0001', total: 0 }],
      warranties: [{ id: 'W25-20101-0002' }],
      parts: [{ code: 'NX-1', name: 'بدون id' }],
      accounts: [{ id: 'ACC-0002', name: 'بدون تراکنش' }],
      invCtr: 9,
      invoiceUidCtr: 0,
      saleCtr: 1,
      saleUidCtr: 0
    }
  },
  {
    id: 'T4',
    note: 'nested records preserved',
    ram: {
      invoices: [{ invoiceId: 'INVUID-000001', items: [{ code: 'A', nested: { qty: 1, flags: { x: true } } }], bag: { a: { b: { c: 'deep' } } } }],
      sales: [{ saleUid: 'SALEUID-000001', items: [{ partCode: 'Z', nested: { loc: 'B1' } }] }],
      warranties: [{ id: 'W-1', devices: [{ serial: 'S', docs: [{ name: 'n', meta: { k: 1 } }] }] }],
      parts: [{ id: 'p1', code: 'Z', byWh: { 'WH-PARTS': { qty: 3 } } }],
      accounts: [{ id: 'ACC-0001', transactions: [{ saleUid: 'SALEUID-000001', nested: { note: 'n' } }] }],
      invCtr: 2, invoiceUidCtr: 1, saleCtr: 2, saleUidCtr: 1
    }
  },
  {
    id: 'T5',
    note: 'Persian Unicode',
    ram: {
      invoices: [{ invoiceId: 'INVUID-000002', seller: 'سلام علی', notes: 'گارانتی «پره» — یاس' }],
      sales: [{ saleUid: 'SALEUID-000002', name: 'لایق الکترونیک پارسیان' }],
      warranties: [{ id: 'W-۲', name: 'مریم کاظمی' }],
      parts: [{ id: 'pt', code: 'کد-۱', name: 'یاتاقان جلو' }],
      accounts: [{ id: 'ACC-0003', name: 'حساب جاری' }],
      invCtr: 3, invoiceUidCtr: 2, saleCtr: 3, saleUidCtr: 2
    }
  },
  {
    id: 'T6',
    note: 'numeric/string preservation',
    ram: {
      invoices: [{ invoiceId: 'INVUID-000004', num: '004', tF: 0, flag: '0', items: [{ fin: 150000, disc: 0 }] }],
      sales: [{ saleUid: 'SALEUID-000004', total: 0, qtyStr: '2', items: [{ qty: 2 }] }],
      warranties: [{ id: 'W-3', accRef: '6037-11' }],
      parts: [{ id: 'p2', code: '00', qty: 0, price: 1.5 }],
      accounts: [{ id: 'ACC-0004', balance: 0, number: '0' }],
      invCtr: 5, invoiceUidCtr: 4, saleCtr: 5, saleUidCtr: 4
    }
  },
  {
    id: 'T7',
    note: 'counters defaulting matches assembler',
    ram: {
      invoices: [], sales: [], warranties: [], parts: [], accounts: [],
      invCtr: 12,
      invoiceUidCtr: 12,
      saleCtr: 8,
      saleUidCtr: 8
    }
  },
  {
    id: 'T8',
    note: 'duplicate records preserved exactly',
    ram: {
      invoices: [
        { invoiceId: 'INVUID-000001', num: '1', twin: 'a' },
        { invoiceId: 'INVUID-000001', num: '1', twin: 'b' }
      ],
      sales: [
        { saleUid: 'SALEUID-000001', id: 'SL-0001' },
        { saleUid: 'SALEUID-000001', id: 'SL-0001-dup' }
      ],
      warranties: [{ id: 'W-1' }, { id: 'W-1' }],
      parts: [{ id: 'p1', code: 'A' }, { id: 'p1', code: 'A-dup' }],
      accounts: [{ id: 'ACC-0001', name: 'one' }, { id: 'ACC-0001', name: 'two' }],
      invCtr: 3, invoiceUidCtr: 1, saleCtr: 3, saleUidCtr: 1
    }
  },
  {
    id: 'T9',
    note: 'missing/nonstandard identity preserved exactly',
    ram: {
      invoices: [{ num: 'x', InvoiceId: 'INVUID-000099' }, { seller: 'no-id-at-all' }],
      sales: [{ id: 'SL-9', SaleUid: 'SALEUID-000099' }, { total: 1 }],
      warranties: [{ name: 'بدون id' }, { id: '' }],
      parts: [{ name: 'only-name' }, { code: 'C9' }],
      accounts: [{ number: '111', name: 'no-acc-id' }, { id: '' }],
      invCtr: 2, invoiceUidCtr: 99, saleCtr: 2, saleUidCtr: 99
    }
  },
  {
    id: 'T10',
    note: 'large-array ordering preservation',
    ram: {
      invoices: t10Invoices,
      sales: t10Invoices.map(function(r, i){ return { saleUid: 'SALEUID-' + String(i + 1).padStart(6, '0'), id: 'SL-' + String(i + 1).padStart(4, '0') }; }),
      warranties: t10Invoices.map(function(r, i){ return { id: 'W-ORD-' + String(i).padStart(3, '0') }; }),
      parts: t10Invoices.map(function(r, i){ return { id: 'P-ORD-' + i, code: 'C' + i }; }),
      accounts: t10Invoices.map(function(r, i){ return { id: 'ACC-ORD-' + i, name: 'n' + i }; }),
      invCtr: 41, invoiceUidCtr: 40, saleCtr: 41, saleUidCtr: 40
    }
  }
];

const out = {
  generatedAt: 'ARCH-17',
  cases: cases.map(function(c) {
    return {
      id: c.id,
      note: c.note,
      ram: c.ram,
      expected: runAdapter(c.ram)
    };
  })
};

const dest = path.join(__dirname, 'BusinessDataFixtures.json');
fs.writeFileSync(dest, JSON.stringify(out, null, 2) + '\n');
console.log('wrote', dest, 'cases', out.cases.length);
out.cases.forEach(function(c){
  console.log(c.id, 'keys', Object.keys(c.expected).join(','),
    'inv', c.expected.invoices.length,
    'counters', JSON.stringify(c.expected.counters),
    'phonebook' in c.expected, 'attachmentsIndex' in c.expected);
});
