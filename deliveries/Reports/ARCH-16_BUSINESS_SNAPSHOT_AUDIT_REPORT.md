# SIRMAN — ARCH-16 Business Snapshot Collection Audit + Extraction Plan

**Date:** 2026-09-05  
**Packet:** Audit remaining business/RAM fields of `_buildFullBackupData()` after ARCH-15. Design a future `BusinessDataSnapshot` boundary. **No production cutover.**  
**Product version:** `1405.6.3α` (unchanged)  
**Branch:** `cursor/arch-16-business-snapshot-audit-fa01`  
**Base:** `cursor/arch-15-settings-slice-cutover-fa01`  
**Final status:** **COMPLETED — AUDIT ONLY, NO PRODUCTION CUTOVER**

This packet does **not** claim shop verification.

---

## 1. Change Gate

```text
CHANGE: ARCH-16 audit + extraction-design packet for remaining business/RAM
        fields of _buildFullBackupData after ARCH-15 settings-slice cutover
CLASS: Read-only audit of live assembler + TEST-ONLY probes + report.
       Not a production adapter. Not a cutover.
Q1: CAPABILITY — inventory and classify remaining assembler fields that
    collectBackupSettingsSnapshot() does not supply. Design future
    BusinessDataSnapshot boundary. No live backup path change.
Q2: RunBusiness / Host: NO. No new Host method. ConsumeBackupSnapshot unused.
Q3: Persistence: NO. Assembler still reads RAM; no LS/IDB write added.
Q4: Printing: NO. WindowsPrintHost / PrintHardwareDiagnostic untouched.
Q5: HTML-only: PRESERVED. exportData / buildBackupObject still call
    _buildFullBackupData only. No business adapter in production.
Q6: New transport/DB/ACL: NO. No Core DTO. No SQLite. No P1C-8.
RESULT: PASS
AUTHORITY: explicit user packet ARCH-16 2026-09-05
```

Gate stayed PASS. Production assembler SHA is identical to ARCH-15. No stop condition was hit.

Not started: ARCH-17, any business adapter used by production, Restore/Merge/Replace, Phonebook remediation, P1C-8, SQLite, Print rewrite.

---

## 2. Exact assembler inventory

Authority: `Sirman_Final.html` `_buildFullBackupData` lines 8473–8553.

Live path (unchanged since ARCH-15):

```text
exportData / buildBackupObject / applyBackupSelective
    → _buildFullBackupData()
        → collectBackupSettingsSnapshot()   // settings only; already JSON-cloned
        → RAM collections via _safeArr / _safeObj / raw ternary
        → collectAttachmentIndex(data)      // derived, before clone
        → JSON.parse(JSON.stringify(data))  // ARCH-9D clone-on-return
```

`exportData` (14326) and `buildBackupObject` (8556) still call the assembler only. They do **not** call a business adapter.

### 2.1 Settings keys (out of ARCH-16 inventory)

Already supplied by `s = collectBackupSettingsSnapshot()`:

`appliedUpdates`, `updatePackages`, `printSettings`, `company`, `serviceCenter`, `starredAlarms`, `appearance`, `sms`, `tz`, `networkSettings`, `prefs`, `aiKeys`, optional `printCenter`.

### 2.2 Remaining always-assigned keys (37)

These are assembled **without** `s.*`. Count = 37.

| # | Output key | Source variable / expression | Exact location | Authority | Value shape | Nested mutable | Clone class | Aliases live RAM before final clone | JSON-safe | Independent extract? | Semantics change if extracted now? | Future order |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | `magic` | `SIRMAN_BACKUP_MAGIC` or `'SIRMAN_BACKUP'` | 8476 | generated | primitive | no | D | no | yes | yes (envelope) | no if constant preserved | stay in assembler |
| 2 | `schemaVersion` | `SIRMAN_SCHEMA_VERSION` or `1` | 8477 | generated | primitive | no | D | no | yes | yes (envelope) | no | stay in assembler |
| 3 | `version` | literal `'1405.6.3α'` | 8478 | generated | primitive | no | D | no | yes | no | **yes** if version packet | frozen; do not bump |
| 4 | `applicationVersion` | literal `'1405.6.3α'` | 8479 | generated | primitive | no | D | no | yes | no | **yes** if version packet | frozen; do not bump |
| 5 | `exportedAt` | `new Date().toISOString()` | 8480 | generated | primitive | no | D | no | yes | yes | timestamp differs per call | stay in assembler |
| 6 | `invoices` | `_safeArr(invoices)` | 8482 | RAM (LS `li` at load) | array | yes | A then C | **yes** | yes* | no (needs counters + refs) | clone-on-read changes pre-return aliasing | ARCH-17 |
| 7 | `products` | `_safeArr(products)` | 8483 | RAM (LS `lp`) | array | yes | A then C | **yes** | yes* | yes as optional | same aliasing | ARCH-18 |
| 8 | `inventory` | `_safeObj(inventory)` | 8484 | RAM (LS `lv`) | object | yes | A then C | **yes** | yes* | no (pairs with products/parts qty) | same | ARCH-18 |
| 9 | `invCtr` | `invCtr\|\|1` | 8485 | RAM (LS `lc`) | primitive | no | D (copy of number) | no | yes | no (pairs with invoices) | defaulting `\|\|1` must be copied | ARCH-17 |
| 10 | `invoiceUidCtr` | `invoiceUidCtr` if `>0` else `0` | 8486 | RAM (LS `laegh_invoice_uid_ctr`) | primitive | no | D | no | yes | no (pairs with invoices) | defaulting must be copied | ARCH-17 |
| 11 | `saleCtr` | `saleCtr` if `>0` else `1` | 8487 | RAM (LS `laegh_sale_ctr`) | primitive | no | D | no | yes | no (pairs with sales) | defaulting must be copied | ARCH-17 |
| 12 | `saleUidCtr` | `saleUidCtr` if `>0` else `0` | 8488 | RAM (LS `laegh_sale_uid_ctr`) | primitive | no | D | no | yes | no (pairs with sales) | defaulting must be copied | ARCH-17 |
| 13 | `phonebook` | `_safeArr(phonebook)` | 8489 | RAM (LS `lb`); `pb` is alias | array | yes | A then C | **yes** | yes* | **NO — dedicated packet** | identity/dedup risk | OUT of 17–20 |
| 14 | `parts` | `_safeArr(parts)` | 8490 | RAM (LS `lp2`) | array | yes | A then C | **yes** | yes* | no (stock + warehouse refs) | same aliasing | ARCH-17 |
| 15 | `services` | `_safeArr(services)` | 8491 | RAM (LS `ls2`) | array | yes | A then C | **yes** | yes* | with `svcs` only | `svcs` must stay same source | ARCH-18 |
| 16 | `svcs` | `_safeArr(services)` | 8492 | same live array as `services` | array | yes | A then C | **yes** (same as services) | yes* | no (must alias services) | extracting separately **would** desync | ARCH-18 |
| 17 | `warranties` | `_safeArr(warranties)` | 8493 | RAM (LS `lw2`) | array | yes | A then C | **yes** | yes* | no (tasks/defective/docs) | same | ARCH-17 |
| 18 | `sales` | `_safeArr(sales)` | 8494 | RAM (LS `laegh_sales`) | array | yes | A then C | **yes** | yes* | no (needs sale counters) | same | ARCH-17 |
| 19 | `tasks` | `_safeArr(tasks)` | 8495 | RAM (LS `laegh_tasks`) | array | yes | A then C | **yes** | yes* | optional; links use display ids | same | ARCH-18 |
| 20 | `accounts` | `_safeArr(accounts)` | 8496 | RAM (LS `laegh_accounts`, IIFE) | array | yes (`transactions`) | A then C | **yes** | yes* | no (trx refs invoices/sales) | same | ARCH-17 |
| 21 | `defectiveStock` | `_safeArr(defectiveStock)` | 8497 | RAM (LS `laegh_defective`) | array | yes | A then C | **yes** | yes* | optional | same | ARCH-18 |
| 22 | `warehouseDocs` | `_safeArr(warehouseDocs)` | 8498 | RAM (LS `laegh_warehouse`) | array | yes (`items`) | A then C | **yes** | yes* | with stockMoves | same | ARCH-18 |
| 23 | `stockMoves` | `_safeArr(stockMoves)` | 8499 | RAM (LS `laegh_stockmoves`) | array | yes | A then C | **yes** | yes* | with warehouseDocs/parts | same | ARCH-18 |
| 24 | `warehouses` | `_safeArr(warehouses \|\| [])` | 8500 | RAM (LS `laegh_warehouses`; first-load **writes** LS) | array | yes | A then C | **yes** | yes | optional | first-load seed is load-time, not assembler | ARCH-18 |
| 25 | `daqi` | `_safeArr(daqi \|\| [])` | 8501 | RAM (LS `laegh_daqi`) | array | yes (`items`) | A then C | **yes** | yes* | optional; **index into phonebook** | extracting with phonebook later | ARCH-18 |
| 26 | `daqiWarehouse` | `daqiWarehouse \|\| []` (**no `_safeArr`**) | 8502 | RAM (LS `laegh_daqi_warehouse`) | array (if defined) | yes | A then C | **yes** if array | yes | optional | missing `_safeArr` means non-array leaks until clone | ARCH-18 |
| 27 | `daqiVouchers` | `daqiVouchers \|\| []` (**no `_safeArr`**) | 8503 | RAM (LS `laegh_daqi_vouchers`) | array (if defined) | yes | A then C | **yes** if array | yes | optional | same as daqiWarehouse | ARCH-18 |
| 28 | `postalHistory` | `postalHistory \|\| []` (**no `_safeArr`**) | 8504 | RAM (LS `laegh_postal_history`) | array (if defined) | yes | A then C | **yes** if array | yes | optional | same | ARCH-18 |
| 29 | `userAuditLog` | `_safeArr(userAuditLog)` | 8508 | RAM (LS `laegh_audit_user`) | array | yes | A then C | **yes** | yes | no (ops/security packet) | not business required | later ops packet |
| 30 | `bgAuditLog` | `_safeArr(bgAuditLog)` | 8509 | RAM (LS `laegh_audit_bg`) | array | yes | A then C | **yes** | yes | no | not business required | later ops packet |
| 31 | `userRoles` | `_safeArr(userRoles)` | 8510 | RAM (LS `laegh_roles`) | array | yes | A then C | **yes** | yes | no | security | later ops packet |
| 32 | `loginPw` | `_safeStr(loginPw)` | 8511 | RAM (LS `laegh_login_pw`) | primitive | no | D | no | yes | no | security | later ops packet |
| 33 | `senderInfo` | `_safeObj(senderInfo)` | 8517 | RAM (LS `ls`) | object | yes | A then C | **yes** | yes | no | postal/print helper, not REQUIRED business | later ops packet |
| 34 | `logoSrc` | `_safeStr(logoSrc)` | 8518 | RAM (LS `ll`; may be huge dataURL or `disk://`) | primitive | no | D | no | yes (can be huge) | no | print/branding | later ops packet |
| 35 | `acH` | `_safeObj(acH)` | 8519 | RAM (LS `la`) | object | yes | A then C | **yes** | yes | no | accounting history helper | later ops packet |
| 36 | `itemCounts` | new object of `.length` re-reads | 8530–8546 | derived from live RAM | object of numbers | no | D | no | yes | stay with assembler | must be computed from same bag | stay in assembler |
| 37 | `sections` | literal key list | 8547 | generated | array of strings | no | D | no | yes | stay with assembler | printCenter may be pushed after | stay in assembler |

\*JSON-safe means current records are plain objects/arrays/primitives. `JSON.stringify` drops `undefined`, cannot clone functions/`File`/`Blob`, and throws on cycles. Inline `docs[].data` dataURLs are strings (binaries stay on records, not in `attachmentsIndex`).

### 2.3 Optional remaining keys

| Output key | Source | Location | Notes |
|---|---|---|---|
| `attachmentsIndex` | `collectAttachmentIndex(data)` | 8551, helper 7709–7739 | Assigned only if the helper exists. **Derived metadata.** New array. Then included in final JSON clone. |
| `printCenter` | `s.printCenter` | 8549–8550 | Settings slice (ARCH-15). Not a business collection. |

Helpers:

- `_safeArr` 7639: `Array.isArray(a)?a:[]` — **returns the live array**, not a copy.
- `_safeObj` 7640: returns the live object.
- `_safeStr` 7641: primitive copy.

No other business collection is assigned by this assembler. Search of the function body is the inventory; the list in §2.2 is complete.

---

## 3. Business collection table

Focus: collections a future `BusinessDataSnapshot` might own. Envelope / settings / security-ops are classified in §10.

| Collection | Required class | Identity (see §4) | Cross-refs (see §5) | Attachments | Pre-clone alias | Extract independently? |
|---|---|---|---|---|---|---|
| `invoices` | REQUIRED | `invoiceId` | items.code → inventory; stockMoves.refDoc uses `num`; tasks.link uses `num`; accounts trx | `docs` walked; parentId=`rec.id` (usually absent on create) | live | with counters |
| `sales` | REQUIRED | `saleUid` | items.partCode → parts; tasks.link uses `s.id`; accounts trx | `docs` walked; parentId=`rec.id` (display `id` like `SL-…`) | live | with counters |
| `warranties` | REQUIRED | `id` | defectiveStock.warrantyId; tasks.link uses `w.id`; stockMoves from warranty | `docs` walked; parentId=`rec.id` | live | with related optional later |
| `parts` | REQUIRED | duplicate-scan `id`; create path uses `code` | warehouseDocs.items.code; stockMoves.itemCode; sales items | none in index walker | live | with warehouse optional |
| `accounts` | REQUIRED | `id` | transactions.refId / documentId / invoiceId / saleUid | none | live | with invoices/sales |
| `products` | LEGACY/OPTIONAL | `code` | inventory keyed by code; invoice items.code | none | live | ARCH-18 |
| `inventory` | LEGACY/OPTIONAL | object key = `code` | invoices items; parts qty overlap is operational | none | live | with products |
| `services` / `svcs` | LEGACY/OPTIONAL | merge `id` **or** `code`; create often has **no** `id` | invoice line `svc` is a **name string** (selSvc), not an id FK | none | live; **same array twice** | together only |
| `tasks` | LEGACY/OPTIONAL | `id` (`TSK-…`) | `link:{type,id}` — invoice **num**, sale **id**, warranty **id** | none | live | ARCH-18 |
| `defectiveStock` | LEGACY/OPTIONAL | `id` | `warrantyId`, `invoiceNum`, sometimes `invoiceId` | none | live | ARCH-18 |
| `warehouseDocs` | LEGACY/OPTIONAL | `id` (`WH-IN/OUT/RET/ADJ/RSV-` + length) | items.code → parts/inventory; stockMoves.refDoc=`doc.id` | none | live | with stockMoves |
| `stockMoves` | LEGACY/OPTIONAL | `id` (`SM-` + length; **collision-prone** after deletes) | `itemCode`; `refDoc`; `whId` | none | live | with warehouseDocs |
| `warehouses` | LEGACY/OPTIONAL | `id` (`WH-PARTS` etc.) | stockMoves.whId / warehouseDocs fromWh/toWh | none | live | ARCH-18 |
| `daqi` | LEGACY/OPTIONAL | `id` (`DQ-` + length) | `refType`/`refId`; **`agencyPhonebookIdx` array index** | none | live | after phonebook packet |
| `daqiWarehouse` | LEGACY/OPTIONAL | `id` (`DW-`+Date.now) | code/name vs parts via deductFromGeneralStock | none | live (no `_safeArr`) | ARCH-18 |
| `daqiVouchers` | LEGACY/OPTIONAL | `id` (`DV-`+Date.now) | items copied from daqi warehouse flow | none | live (no `_safeArr`) | ARCH-18 |
| `postalHistory` | LEGACY/OPTIONAL | `id` (`PH-`+Date.now) | none to business ids found | none | live (no `_safeArr`) | ARCH-18 |
| `phonebook` | **SPECIAL — OUT** | **no stable id on create** | daqi.agencyPhonebookIdx; merge uses first phone | none | live | **dedicated safety packet** |
| `userAuditLog` / `bgAuditLog` / `userRoles` / `loginPw` / `senderInfo` / `logoSrc` / `acH` | NOT in BusinessDataSnapshot | n/a | n/a | logoSrc may be disk/dataURL | live objects/strings | separate ops/security packet |

---

## 4. Identity-key table

Do not invent fields. UNKNOWN where create/merge/duplicate-scan disagree or evidence is only SCHEMA.

| Collection | Primary identity used by current source | Evidence | Display / secondary | Notes |
|---|---|---|---|---|
| invoices | `invoiceId` / `InvoiceId` | `invoiceIdentity()` 7534–7536; `detectBackupDuplicateIdentities` 8049; merge also accepts `id` or `num` 15089 | `num` display; `editingInvoiceId` for edit | `getData()` 13040–13050 sets `num` + optional `invoiceId`. **Does not set `id`.** Migration may assign `mig_inv_*` to missing `id` 14661. |
| sales | `saleUid` / `SaleUid` | `saleIdentity()` 22121–22123; duplicate scan 8050 | `id` (e.g. `SL-…`) used by task dropdown 15570 and merge fallback | Merge: `(x.saleUid && p.saleUid===x.saleUid) \|\| p.id===x.id` 15106 |
| warranties | `id` | duplicate scan 8051; merge 15105; `nextWarCaseId` 19843; `saveWar` 20975 | — | Prefix form `Wyy-smmdd-nnnn` |
| parts | duplicate-scan / merge: `id` | 8053, 15103 | operational uniqueness: `code` (`savePart` 17238; `_isCodeTaken`) | **`savePart` does not assign `id`.** Migration may add `mig_part_*` 14662. SCHEMA has both `code` and `id` 14168. |
| accounts | `id` | duplicate scan 8052; merge 15116; `saveAccount` `ACC-`+length 23749 | `number` is account number, not id | Length-based id is collision-prone after deletes |
| tasks | `id` | `saveTask` 15602; merge 15113; auto ids `TSK-AUTO-`+num / `TSK-AUTO-WAR-`+w.id / `TSK-AUTO-INV-`+p.code / `TSK-AUTO-BACKUP` | — | Stable enough for merge-by-id |
| services | merge: `id` **OR** `code` | 15104, 28322 | `saveSvc` 17450 builds `{code,name,…}` — **no `id` on create** | Dual key. Do not collapse to one without a dedicated packet. |
| warehouseDocs | `id` | create 18388 `prefix + '-' + pad(length+1)`; merge 15119 | — | Length-based; collision-prone after deletes |
| stockMoves | `id` | `recordStockMove` 18094 `SM-`+pad(length+1) | — | Length-based; **collision-prone after deletes** |
| warehouses | `id` | seed `WH-PARTS` etc. 18929; merge 15125 | `code` | |
| daqi | `id` | `addDaqi` 23218 `DQ-`+pad(length+1) | — | Length-based |
| daqiWarehouse | `id` | 23053 `DW-`+Date.now+random | match also manufacturer+code+name | |
| daqiVouchers | `id` | 23105 `DV-`+Date.now | — | |
| postalHistory | `id` | 14088 `PH-`+Date.now | — | |
| defectiveStock | `id` | SCHEMA 14171; merge 15114 | — | Create paths set `id` in addDefective* (source-backed) |
| products | `code` | DIFF_KEYS 14208; merge 15089 | SCHEMA has no `id` 14166 | |
| inventory | **object key** = product `code` | hydrate `lv` object 7522; not an array | nested `{qty,…}` | Not in duplicate-identity scanner |
| phonebook | **NONE on create** | `savePBContact` 13744 Object.assign fn/ln/shop/phones; **no `id:'PB-'`** | DIFF_KEYS: first phone OR `fn\|ln` OR `id` 14209 | Merge: first phone string only 15098–15100. Empty phone → always insert. |

`detectBackupDuplicateIdentities` scans **only** invoices, sales, warranties, accounts, parts. It does **not** scan phonebook, tasks, services, warehouseDocs, stockMoves.

---

## 5. Cross-reference table

Only relationships with a source read/write site. Field names alone are not enough.

| From | Field | To | How source uses it | Confidence |
|---|---|---|---|---|
| `accounts.transactions[]` | `refId`, `documentId`, `invoiceId`, `saleUid`; fallback `subject` contains docId | invoices `invoiceId` or `num`; sales `saleUid` | `reverseLinkedAccountTrx` 8884–8885 | HIGH |
| `tasks.link` | `{type, id}` | invoice **`num`** (not invoiceId); sale **`id`** (not saleUid); warranty **`id`** | `syncOpenInvoiceTasks` 15712; warranty auto 15747–15750; dropdown 15570 | HIGH |
| `defectiveStock` | `warrantyId` | warranties.id | SCHEMA 14171; add from warranty 18008; filter 17996 | HIGH |
| `defectiveStock` | `invoiceNum` | invoices.num | SCHEMA; `addDefectiveFromInvoice` 18042 | HIGH |
| `defectiveStock` | `invoiceId` | invoices.invoiceId | set in `addDefectiveFromInvoice` 18042; **not** in SCHEMA defaults | MEDIUM (present on that path) |
| `daqi` | `refType` + `refId` | comment: invoice/sale/manual; `refId` is “شماره فاکتور/فروش” 23210 | `addDaqi` copies opts; **not** validated against invoiceIdentity/saleIdentity | MEDIUM |
| `daqi` | `agencyPhonebookIdx` | **array index** into `phonebook` | `_daqiAgencyName` 23201; save 23437 | HIGH — **fragile** |
| `stockMoves` | `refDoc` | warehouseDocs.id **or** invoice `d.num` **or** warranty `w.id` | `recordStockMove` comment 18082; invoice close 13076 `d.num`; warranty 18018 `w.id`; warehouse 18475 `doc.id` | HIGH (heterogeneous) |
| `stockMoves` | `itemCode` | parts.code / inventory[code] | `recordStockMove` / `applyStockByWarehouse` | HIGH |
| `stockMoves` | `whId` | warehouses.id | stored 18097 | HIGH |
| `warehouseDocs` | `items[].code`, `fromWh`, `toWh` | parts/inventory; warehouses.id | `saveWarehouseDoc` 18387–18391 | HIGH |
| `sales.items[]` | `partCode` or `code` | parts.code | reversal 9078–9080; UI 20322 | HIGH |
| `invoices.items[]` | `code` | inventory[code] | closeInv stockMap 13066; reverseInvoiceLocal 8909 | HIGH |
| `attachmentsIndex` | `parentId` | `rec.id` of warranty/sale/invoice | `collectAttachmentIndex` 7733 | HIGH — **not** invoiceId/saleUid |
| `warranties.accRef` / `sales.accRef` | string | **not** accounts.id | UI label “شماره حساب/کارت گیرنده” 21903, 22792; print text | HIGH that it is **not** an FK |
| invoice line `svc` | name string | services.name via `selSvc(n, s.name, …)` 17485 | not an id | HIGH |

No source evidence of a stable phonebook→invoice customer id FK. Invoice stores `seller`/`phone` strings.

---

## 6. Attachment audit

Helper: `collectAttachmentIndex` 7709–7739. Assembler: 8551.

| Question | Finding |
|---|---|
| Business snapshot or separate metadata? | **Separate derived metadata** built from already-assigned `data.warranties/sales/invoices`. Not a RAM collection. |
| Source | Walk order: warranties → sales → invoices. Reads `rec.docs` or `rec.attachments` (array or object-of-arrays). |
| Identity key | `doc.id` or synthesized `kind + '-' + parentId + '-' + i` 7717 |
| Parent reference | **`parentId = rec.id`** (or `''`). Not `invoiceId`, not `saleUid`. |
| Binary in index? | **No.** Disk/`idb:`/`disk://` → `ref=data`, `inline=false`. Other non-empty data (including dataURL) → `inline=true`, `ref=''`. No `data`/`src` copied onto the index record. |
| Where binaries live | On the parent record (`docs[].data`) as dataURL **or** as `disk://` / `idb:` pointer. Assembler does **not** open IndexedDB (`laegh-fullapp-db`, `laegh-backup-db`, `laegh-tasks-db`, `laegh-updates-db` exist elsewhere). |
| Clone | Index is a **new array** (class D), then included in the final JSON clone (class C). Mutating the index before return does not mutate RAM docs; mutating `data.invoices` before return **does** mutate live invoices. |
| Invoice parentId gap | `getData()` typically has `num` + `invoiceId` and **no `id`**. Therefore invoice rows in `attachmentsIndex` often get `parentId:''` unless migration added `mig_inv_*`. |
| Future extraction | Can preserve referential integrity **only if** parent identity for the index is defined as the same `rec.id` the walker uses today, **or** a later packet remaps to `invoiceId`/`saleUid` with an explicit compatibility rule. **No attachment migration in this packet.** |

`finalizeBackupPackage` 7746 rebuilds `attachmentsIndex` again after assembly (export/autosave finalizer). That is post-assembler and out of ARCH-16 cutover scope; recorded so ARCH-19 does not assume a single builder.

---

## 7. Clone / mutability audit

Clone classes for remaining fields:

| Class | Meaning | Remaining fields |
|---|---|---|
| **A** | Direct live reference enters `data` | All `_safeArr` / `_safeObj` collections; `daqiWarehouse` / `daqiVouchers` / `postalHistory` raw ternary |
| **B** | Shallow clone | **None** in the remaining business path |
| **C** | Deep `JSON.parse(JSON.stringify(data))` at return 8552 | Entire `data` object including A/D fields |
| **D** | Generated object already independent before clone | `magic`, versions, `exportedAt`, counters (primitives), `itemCounts`, `sections`, `attachmentsIndex` array, `_safeStr` results |

### 7.1 Proof: mutation BEFORE the final JSON clone mutates live RAM

TEST-ONLY probe in `test_laegh.js` (ARCH-16 pre-clone): `_safeArr(invoices)` is `===` the live array; `data.invoices.push` and nested assignment change RAM. After `JSON.parse(JSON.stringify(data))`, clone mutations do not.

This matches `_safeArr` 7639: it returns `a`, not `a.slice()`.

### 7.2 Proof: mutation AFTER assembler return does not mutate live RAM

ARCH-9D / ARCH-16 post-clone probe via `arch9cLiveAssembly()`: returned `assembly.invoices` is not `===` RAM; nested mutation of the return value leaves RAM unchanged. `localStorage.setItem` count 0; `indexedDB.open` count 0 during assembly.

### 7.3 `svcs` alias

Before clone, `data.svcs === data.services ===` live `services` (both `_safeArr(services)`). After clone they are **independent copies of the same snapshot**, not live aliases. ARCH-9C/9D already locked that post-clone split.

### 7.4 Settings vs business

`collectBackupSettingsSnapshot` already returns `JSON.parse(JSON.stringify(data))` (8622). Settings entering the assembler are **already isolated**. Business collections are **not** isolated until 8552.

No production guards were added.

---

## 8. RAM / localStorage / IndexedDB authority map

Assembler **reads RAM** for remaining fields. RAM was hydrated from localStorage at page load (or an IIFE). Assembler does **not** `getItem` those business keys itself. Assembler does **not** `setItem`. Assembler does **not** open IndexedDB.

| RAM | LS key at hydrate | Hydrate site | Assembler read |
|---|---|---|---|
| `invoices` | `li` | 7520 | `_safeArr` |
| `products` | `lp` | 7521 | `_safeArr` |
| `inventory` | `lv` | 7522 | `_safeObj` |
| `phonebook` | `lb` | 7523 | `_safeArr` |
| `pb` | **not exported**; alias of `phonebook` 16080. Comment: `laegh_pb` no longer read. | 16077–16080 | not a backup key |
| `acH` | `la` | 7524 | `_safeObj` |
| `senderInfo` | `ls` | 7525 | `_safeObj` |
| `logoSrc` | `ll` | 7526 | `_safeStr` |
| `invCtr` | `lc` | 7519 | number |
| `invoiceUidCtr` | `laegh_invoice_uid_ctr` | 7533 | number |
| `parts` | `lp2` | 16074 | `_safeArr` |
| `services` / `svcs` | `ls2` | 16075 / 16089 | `_safeArr(services)` twice |
| `warranties` | `lw2` | 16076 | `_safeArr` |
| `tasks` | `laegh_tasks` | 16081 | `_safeArr` |
| `defectiveStock` | `laegh_defective` | 16082 | `_safeArr` |
| `accounts` | `laegh_accounts` | `let accounts=[]` 16093 then IIFE 23667–23670 | `_safeArr` |
| `warehouseDocs` | `laegh_warehouse` | 16096 | `_safeArr` |
| `stockMoves` | `laegh_stockmoves` | 16097 | `_safeArr` |
| `sales` | `laegh_sales` | 22118 | `_safeArr` |
| `saleCtr` | `laegh_sale_ctr` | 22119 | number |
| `saleUidCtr` | `laegh_sale_uid_ctr` | 22120 | number |
| `userAuditLog` | `laegh_audit_user` | 16083 | `_safeArr` |
| `bgAuditLog` | `laegh_audit_bg` | 16084 | `_safeArr` |
| `userRoles` | `laegh_roles` | 16174 | `_safeArr` |
| `loginPw` | `laegh_login_pw` | 16176 | `_safeStr` |
| `warehouses` | `laegh_warehouses` | 18922–18936; **empty → seed + `setItem` at load** | `_safeArr` |
| `daqi` | `laegh_daqi` | 23177–23182 | `_safeArr` |
| `daqiWarehouse` | `laegh_daqi_warehouse` | 23037 | raw |
| `daqiVouchers` | `laegh_daqi_vouchers` | 23038 | raw |
| `postalHistory` | `laegh_postal_history` | 14080–14081 | raw |

IndexedDB: used by updates/full-app blob, backup package helper, task notify state — **not** by `_buildFullBackupData`. Attachment `idb:` strings are pointers only.

Settings (ARCH-15) are **LS-authoritative at assemble time**. Business remaining fields are **RAM-authoritative at assemble time**. If RAM is dirty and unsaved, backup contains RAM (intended). If another tab wrote LS, this tab’s backup still contains **this tab’s RAM**, not the other tab’s LS.

---

## 9. Atomicity / consistency findings

| Question | Finding |
|---|---|
| Synchronous? | **Yes.** `_buildFullBackupData` has no `await` / `Promise`. |
| `exportData` async? | **After** assembly (checksum / encrypt). Snapshot is taken synchronously first (14329). |
| Re-entrancy lock? | **None.** |
| localStorage in assembler (business)? | No `getItem`/`setItem` for business keys. Settings adapter **does** read LS (and already clones). |
| IndexedDB in assembler? | **No.** |
| Cross-tab | RAM is per-document. Other tab LS writes are invisible until this tab hydrates. Mixed settings-from-LS vs business-from-RAM is possible. |
| Autosave | `buildBackupObject` → same assembler. `markDirty` / `doAutoSave` can run later on the event loop, not inside the assembler. |
| Event-loop interleaving inside assembler? | **No** (sync). Another script cannot run between object-literal assignment and `JSON.stringify` unless a getter/Proxy fires. Current collections are plain arrays/objects. |
| Point-in-time immutable snapshot today? | **Only at return** (line 8552). Until then, `data.*` aliases live RAM. Settings were cloned earlier. `itemCounts` and `attachmentsIndex` re-read live RAM **after** the object literal, so they can disagree with collection contents if RAM mutated mid-function (only via getter/Proxy; not via await). |
| Mixed-time snapshot | Settings cloned at T0. Business aliases sampled at T1 (property init) and again at T2 (`itemCounts` / attachment walk). Final clone at T3. In practice T0–T3 are one stack without await. True mixed-time risk is **settings LS vs business RAM**, and **cross-tab**, not microtask interleaving. |
| Minimum changes for true atomic snapshot (**do not implement here**) | 1) Clone-on-read all business RAM into a frozen bag at function entry. 2) Compute `itemCounts` + `attachmentsIndex` from that bag. 3) Merge already-cloned settings. 4) Return JSON clone (or skip double-clone if bag is already JSON-cloned). No locking required for single-threaded JS; optional mutex only if a future await is introduced. |

No atomic locking was implemented in this packet.

---

## 10. Proposed `BusinessDataSnapshot` boundary

Conceptual transport bag only. **Not implemented. No Core domain class required.**

```text
BusinessDataSnapshot  (future, JSON-clone internally like settings adapter)
  REQUIRED:
    invoices, sales, warranties, parts, accounts
    invCtr, invoiceUidCtr, saleCtr, saleUidCtr
  LEGACY / OPTIONAL:
    products, inventory
    services, svcs          // svcs MUST be the same source as services
    warehouseDocs, stockMoves, warehouses
    defectiveStock, tasks
    daqi, daqiWarehouse, daqiVouchers
    postalHistory
  EXCLUDED FROM THIS BOUNDARY:
    phonebook               // dedicated safety packet (§12)
    settings slice          // ARCH-15 BackupSettingsSnapshot
    envelope                // magic, schemaVersion, version, exportedAt, sections, itemCounts
    checksum / manifest     // finalizer
    loginPw, userRoles, userAuditLog, bgAuditLog, senderInfo, logoSrc, acH
    attachmentsIndex        // derived; ARCH-19 boundary, not a RAM collection
```

Aligns with fail-closed required collections already in source:

- `REQUIRED_BACKUP_COLLECTIONS = ['warranties','invoices']` 7862
- schema 1 adds `sales`, `parts`, `accounts` 7863

`products` / `inventory` / `services` are historically backed up and restored but are **not** in that fail-closed required list → LEGACY/OPTIONAL.

Do not create extra domain types (`InvoiceAggregate`, etc.) in ARCH-17. One frozen JSON bag + goldens is enough, matching ARCH-14 settings.

---

## 11. Recommended extraction order

Chosen from source risk (identity completeness, cross-refs, prior corruption), not from a preset numbering.

| Packet | Scope | Cutover? |
|---|---|---|
| **ARCH-17** | Required-collections **adapter only**: invoices, sales, warranties, parts, accounts + four counters. Internal JSON clone. Goldens vs current assembler picks. **No production call.** No phonebook. | NO |
| **ARCH-18** | Optional operational adapter: products, inventory, services+svcs, warehouseDocs, stockMoves, warehouses, defectiveStock, tasks, daqi*. Same: tests/goldens, **no cutover**. | NO |
| **ARCH-19** | Attachment/reference boundary: `attachmentsIndex` parentId vs invoiceId/saleUid; disk/idb/inline; no binary migration; document heterogeneous `stockMoves.refDoc`. | NO migration |
| **ARCH-20** | Equivalence-gated **required-slice** cutover inside `_buildFullBackupData` (ARCH-15 pattern). Optional collections stay inline until a later opt-in. | YES, required slice only, gated |
| **Later, separate** | Phonebook identity + merge/Excel dedup safety, **then** phonebook snapshot. | after explicit safety packet |
| **Later, separate** | Ops/security: loginPw, roles, audit, senderInfo, logoSrc, acH. | after required cutover |
| **Not this sequence** | Restore, Merge, Replace, P1C-8, SQLite, Print, Host, checksum, version bump. | forbidden until their own packets |

ARCH-17 must **not** start implementing ARCH-20.

---

## 12. Phonebook separation rationale

Phonebook **must not** join ARCH-17–20 extraction.

Source-backed reasons:

1. **No stable identity on create.** `savePBContact` 13737–13745 assigns fn/ln/shop/phones/… and `push`es. There is no `id:'PB-…'`.
2. **Merge/Excel duplicate rule is first raw phone only.** Empty first phone → `exists` is false → **every** such row is inserted (15098–15100). Repeating merge can multiply copies.
3. **`pb` alias history.** Comment 16077–16080: dual variable / stale `laegh_pb` caused restore-to-wrong-variable bugs (workflow قانون ۴). Backup key is `phonebook` only; `pb` is a live alias, not exported.
4. **daqi stores `agencyPhonebookIdx` as an array index** (23201). Reordering, merge, or dedup **without** a dedicated remap corrupts agency links.
5. Prior forensic report `deliveries/Reports/PHONEBOOK_DUPLICATION_ROOT_CAUSE_2026-09-04.md`: export serializes current RAM; it does not loop-append. Duplicates in a backup JSON were already in RAM. Shop JSON files were not on that VM; N remains UNKNOWN. Mechanism is in source regardless of N.

Therefore: document phonebook in the inventory, keep it on the live `_safeArr(phonebook)` path, and require a dedicated safety packet before any adapter.

---

## 13. Test results

Production behavior was not modified. Existing suites were run after TEST-ONLY additions in `test_laegh.js`.

| Suite | Command | Result |
|---|---|---|
| HTML | `node test_laegh.js Sirman_Final.html` | **906 / 906 PASS** (0 fail). Previous ARCH-15 baseline 899; **+7** ARCH-16 audit tests. |
| Core | `dotnet test desktop/Sirman.Core.Tests` | **661 / 661 PASS** (0 fail). Unchanged (no Core edits). |

ARCH-16 group (all PASS):

- G1 SHA lock + export/autosave still assembler-only + sync + no IDB/LS write in assembler source
- Remaining non-settings key inventory lock
- Pre-clone `_safeArr` live-alias probe
- Post-clone isolation via `arch9cLiveAssembly()`
- `attachmentsIndex` derived / no binary / parentId=`rec.id`
- Identity locks (`invoiceId`, `saleUid`, warranties/accounts/parts `id`; phonebook create has no `PB-` id)
- Restore / Phonebook / Print / SQLite / WindowsPrintHost / `TbdMarker` presence

Assembler SHA (computed from `_buildFullBackupData` source, also asserted in G1):

`17f08840ecb3e6ecc9d72082d27eeeb6736daa97a1f06819df4f4f04a998cfa6`

Logs: `/opt/cursor/artifacts/arch16-html-tests.log`, `/opt/cursor/artifacts/arch16-core-tests.log`.

No unrelated baseline failures. No repair of unrelated code.

---

## 14. Regression locks

| Lock | Result |
|---|---|
| ARCH-15 assembler SHA `17f08840ecb3e6ecc9d72082d27eeeb6736daa97a1f06819df4f4f04a998cfa6` | **IDENTICAL** |
| `_buildFullBackupData` / `exportData` / `buildBackupObject` implementation | **untouched** (HTML byte-identical to ARCH-15 product files) |
| Restore merge/replace (`applyBackupMergeSections`, `applyBackupReplaceSections`) | presence locked; not edited |
| `importData` | presence locked; not edited |
| `resetAll` | presence locked; not edited |
| `savePBContact` | presence locked; not edited |
| Print helpers (`getPrintCenterState`, `getPrintSettings`) | presence locked; not edited |
| `WindowsPrintHost.cs` | exists; not edited |
| `RunPrintHardwareDiagnostic` | still on `SirmanHostObject` |
| `JsonBackupRepository.TbdMarker` = `html-backup-engine` | unchanged |
| SQLite candidate `desktop/Sirman.Persistence.Sqlite/Sirman.Persistence.Sqlite.csproj` | present; not edited |
| Version `1405.6.3α` | unchanged |
| P1C-8 / checksum semantics / Host contracts | not edited |

STOP condition (SHA change) was **not** hit.

---

## 15. Files changed

| File | Why |
|---|---|
| `test_laegh.js` | ARCH-16 TEST-ONLY inventory/SHA/clone/attachment/identity/regression locks. |
| `deliveries/Reports/ARCH-16_BUSINESS_SNAPSHOT_AUDIT_REPORT.md` | This report. |

**Not changed:** `Sirman_Final.html`, `Laegh_Final.html`, `desktop/**`, Host contracts, Print, Restore, Phonebook, checksum helpers, `SIRMAN_VERSION.json`.

No production business adapter. No Core DTO.

---

## 16. Data-impact statement

**Zero live-data impact.** This packet does not write localStorage, IndexedDB, backup files, or SQLite. It does not restore, merge, replace, or migrate phonebook. Shop data on disk is untouched. Tests run in Node/xUnit sandboxes.

---

## 17. Rollback statement

Revert this branch’s two files (`test_laegh.js`, this report). Product HTML and Core remain as ARCH-15. No runtime rollback is required because production paths were not wired.

---

## 18. Final recommendation for ARCH-17

**Proceed with ARCH-17 as an adapter-only packet (no cutover):**

1. Add a HTML helper conceptually equivalent to `collectBusinessRequiredSnapshot()` that JSON-clones **only** `invoices`, `sales`, `warranties`, `parts`, `accounts` and the four counters, applying the same `_safeArr` / defaulting rules as the assembler.
2. Freeze goldens against `_buildFullBackupData()` picks of those keys (ARCH-14/15 pattern).
3. Do **not** call the helper from `_buildFullBackupData`, `exportData`, or `buildBackupObject`.
4. Do **not** include phonebook, attachmentsIndex, settings, or ops/security keys.
5. Copy cross-reference fields as opaque JSON (`tasks` is out of scope; account `transactions` stay inside accounts).
6. Keep assembler SHA locked until a future ARCH-20 cutover packet explicitly updates it.

If ARCH-17 cannot prove byte-level (or JSON-stable) equivalence on goldens, **do not** schedule ARCH-20.

---

## Status

**COMPLETED — AUDIT ONLY, NO PRODUCTION CUTOVER**
