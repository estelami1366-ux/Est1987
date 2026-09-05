# SIRMAN — ARCH-18 Optional Business Snapshot Adapter

**Date:** 2026-09-05  
**Packet:** Pure transport DTO + HTML adapter for OPTIONAL business backup collections. **No production cutover.**  
**Product version:** `1405.6.3α` (unchanged)  
**Branch:** `cursor/arch-18-optional-business-snapshot-adapter-fa01`  
**Base:** `cursor/arch-17-required-business-snapshot-adapter-fa01`  
**Final status:** **COMPLETED — OPTIONAL ADAPTER ONLY, NO PRODUCTION CUTOVER**

This packet does **not** claim shop verification. ARCH-19 was **not** started.

Source of truth: ARCH-16 audit (`deliveries/Reports/ARCH-16_BUSINESS_SNAPSHOT_AUDIT_REPORT.md`) plus current `Sirman_Final.html` assembler (`_buildFullBackupData` 8473–8553). Collection names were not guessed.

---

## 1. Change Gate

```text
CHANGE: ARCH-18 collectOptionalBusinessSnapshot HTML adapter
        + Core Sirman.Core.Backup.OptionalBusinessSnapshot DTO
CLASS: Extraction-only transport. Not a live assembler cutover.
Q1: CAPABILITY — OPTIONAL business slice snapshot (products, inventory,
    services+svcs, tasks, defectiveStock, warehouseDocs, stockMoves,
    warehouses, daqi, daqiWarehouse, daqiVouchers, postalHistory).
    Not Restore. Not Phonebook. Not attachmentsIndex.
Q2: RunBusiness / Host: NO. No new Host method.
Q3: Persistence: NO. Adapter reads RAM only; clone-on-return; no LS/IDB write.
Q4: Printing: NO.
Q5: HTML-only: PRESERVED. exportData / buildBackupObject still call
    _buildFullBackupData only. Assembler does not call the new adapter.
Q6: New transport/DB/ACL: JSON DTO only. No SQLite. No P1C-8.
RESULT: PASS
AUTHORITY: explicit user packet ARCH-18 2026-09-05
```

Source authority for every included collection is a single named RAM global (or the documented `services` alias for `svcs`). No STOP/BLOCKED condition was hit. Assembler SHA unchanged. ARCH-17 adapter SHA unchanged.

---

## 2. Complete candidate inventory

Every remaining assembler key after ARCH-15 settings + ARCH-17 REQUIRED, classified from `_buildFullBackupData` and ARCH-16 §2.2 / §2.3. Classes:

- **A** true OPTIONAL business collection
- **B** operational / security metadata
- **C** derived data
- **D** UI / settings (already ARCH-15)
- **E** attachment / reference metadata
- **F** counter / state (ARCH-17 counters)

| Assembler key | Class | Decision |
|---|---|---|
| `products` | A | INCLUDE |
| `inventory` | A | INCLUDE |
| `services` | A | INCLUDE |
| `svcs` | A (alias of services) | INCLUDE — same RAM source, not a second collection |
| `tasks` | A | INCLUDE |
| `defectiveStock` | A | INCLUDE |
| `warehouseDocs` | A | INCLUDE (includes transfer docs `WH-TR-…`) |
| `stockMoves` | A | INCLUDE |
| `warehouses` | A | INCLUDE |
| `daqi` | A | INCLUDE (`agencyPhonebookIdx` copied as opaque JSON) |
| `daqiWarehouse` | A | INCLUDE (raw ternary, no `_safeArr`) |
| `daqiVouchers` | A | INCLUDE (raw ternary, no `_safeArr`) |
| `postalHistory` | A | INCLUDE (raw ternary, no `_safeArr`) |
| `phonebook` | A special | EXCLUDE — dedicated corruption/recovery packet |
| `attachmentsIndex` | E | EXCLUDE — derived; ARCH-19 |
| `invoices` `sales` `warranties` `parts` `accounts` | A required | EXCLUDE — ARCH-17 |
| `invCtr` `invoiceUidCtr` `saleCtr` `saleUidCtr` | F | EXCLUDE — ARCH-17 `counters` |
| `itemCounts` | C | EXCLUDE — derived lengths |
| `sections` | C | EXCLUDE — generated key list |
| `userAuditLog` `bgAuditLog` `userRoles` `loginPw` | B | EXCLUDE — ops/security |
| `senderInfo` `logoSrc` `acH` | B | EXCLUDE — postal/print/accounting helpers |
| `printSettings` `company` `serviceCenter` `starredAlarms` `appearance` `sms` `tz` `networkSettings` `prefs` `aiKeys` `printCenter` `appliedUpdates` `updatePackages` | D | EXCLUDE — ARCH-15 |
| `magic` `schemaVersion` `version` `applicationVersion` `exportedAt` `checksum*` `manifest` | envelope | EXCLUDE |

No other business collection is assigned by the assembler. RAM `svcs` (live alias at 16135) is **not** an assembler source.

---

## 3. Included OPTIONAL collections

Payload key order (catalog / adapter / DTO), matching assembler order of this slice:

```text
products, inventory,
services, svcs,
tasks, defectiveStock,
warehouseDocs, stockMoves, warehouses,
daqi, daqiWarehouse, daqiVouchers,
postalHistory
```

13 keys. 12 RAM sources (`svcs` is not a separate source).

`daqiWarehouse` / `daqiVouchers` / `postalHistory` copy the **raw ternary** (`typeof x!=='undefined'?x:[]`) with **no** `_safeArr`. If RAM is `null`, the snapshot key is JSON `null` (T8). That is the live assembler semantic.

---

## 4. Excluded candidates + reason

| Candidate | Reason |
|---|---|
| `phonebook` / `pb` | Dedicated identity/dedup/recovery risk. Adapter does not read, clone, or name a Phonebook field. |
| `attachmentsIndex` | Derived from `collectAttachmentIndex(data)` after the object literal. Production behavior unchanged. ARCH-19. |
| ARCH-17 REQUIRED keys | Already extracted; ARCH-17 body locked. |
| Settings slice | ARCH-15. |
| Envelope / checksum / manifest | Assembler / P1C-7. |
| Ops/security (`userAuditLog`, `bgAuditLog`, `userRoles`, `loginPw`, `senderInfo`, `logoSrc`, `acH`) | Not OPTIONAL **business** collections. |
| `itemCounts` / `sections` | Derived / generated. |
| Live RAM `svcs` global | Assembler ignores it; both backup keys read `services`. Including it as a second source would desync. |

---

## 5. Source authority map

Verified against `_buildFullBackupData` (`Sirman_Final.html` 8473–8553) and hydrate sites. Not guessed.

| DTO key | RAM global | Assembler expression (copied) | Hydrate LS key | Hydrate site |
|---|---|---|---|---|
| `products` | `products` | `_safeArr(products)` | `lp` | 7521 |
| `inventory` | `inventory` | `_safeObj(inventory)` | `lv` | 7522 |
| `services` | `services` | `_safeArr(services)` | `ls2` | 16121 |
| `svcs` | **`services`** (not `svcs`) | `_safeArr(services)` | same `ls2` | assembler 8492; live alias `svcs=services` 16135 is unused by backup |
| `tasks` | `tasks` | `_safeArr(tasks)` | `laegh_tasks` | 16127 |
| `defectiveStock` | `defectiveStock` | `_safeArr(defectiveStock)` | `laegh_defective` | 16128 |
| `warehouseDocs` | `warehouseDocs` | `_safeArr(warehouseDocs)` | `laegh_warehouse` | 16142 |
| `stockMoves` | `stockMoves` | `_safeArr(stockMoves)` | `laegh_stockmoves` | 16143 |
| `warehouses` | `warehouses` | `_safeArr(typeof warehouses!=='undefined'?warehouses:[])` | `laegh_warehouses` | 18967–18970 |
| `daqi` | `daqi` | `_safeArr(typeof daqi!=='undefined'?daqi:[])` | `laegh_daqi` | 23223–23228 |
| `daqiWarehouse` | `daqiWarehouse` | `(typeof daqiWarehouse!=='undefined'?daqiWarehouse:[])` | `laegh_daqi_warehouse` | 23081–23083 |
| `daqiVouchers` | `daqiVouchers` | `(typeof daqiVouchers!=='undefined'?daqiVouchers:[])` | `laegh_daqi_vouchers` | 23082–23084 |
| `postalHistory` | `postalHistory` | `(typeof postalHistory!=='undefined'?postalHistory:[])` | `laegh_postal_history` | 14126–14128 |

Authority is **not** ambiguous. No invented fallback. Adapter does not write those LS keys.

---

## 6. Identity map

Documented in `OptionalBusinessSnapshotCatalog.IdentityFields`. **Parse does not write these fields. Uniqueness is not enforced.**

| Collection | Identity in live source | Stable? | Unique? | Evidence |
|---|---|---|---|---|
| `products` | `code` | operational uniqueness via `_isCodeTaken` | intended unique; duplicates possible in RAM | DIFF_KEYS 14254; merge 15135 `p.code===x.code`; SCHEMA has no `id` |
| `inventory` | **object key** = product `code` | same as products code | object keys unique by JS; not a record field | hydrate object 7522; **omitted from IdentityFields** (not a field) |
| `services` / `svcs` | `id` **or** `code` | create often has **no** `id` | code checked on save; dual key | merge 15150 `p.id===x.id\|\|p.code===x.code`; `saveSvc` 17496–17504 builds `{code,name,…}` without `id` |
| `tasks` | `id` | create uses Date.now+random (`TSK-…`) | merge-by-id; not scanned by duplicate detector | `saveTask` 15648; merge 15159 |
| `defectiveStock` | `id` | length-based `DEF-`+pad | collision-prone after deletes | create 17990 / 18050 / 18084; merge 15160 |
| `warehouseDocs` | `id` | length-based `WH-IN/OUT/RET/ADJ/RSV-`+pad; transfers `WH-TR-` | collision-prone after deletes | 18431–18434; transfer 19697; merge 15165 |
| `stockMoves` | `id` | length-based `SM-`+pad | **collision-prone after deletes** | `recordStockMove` 18140; merge 15168 |
| `warehouses` | `id` | seeded `WH-PARTS` etc. | seed ids stable | init 18975–18980 |
| `daqi` | `id` | length-based `DQ-`+pad | collision-prone after deletes | `addDaqi` 23263 |
| `daqiWarehouse` | `id` | `DW-`+Date.now+random | match also manufacturer+code+name | 23099 |
| `daqiVouchers` | `id` | `DV-`+Date.now | not uniqueness-enforced | 23151 |
| `postalHistory` | `id` | `PH-`+Date.now | not uniqueness-enforced | 14134 |

`detectBackupDuplicateIdentities` still scans **only** invoices, sales, warranties, accounts, parts. It does not scan this optional slice. T6/T7 prove duplicates and missing identity bytes are preserved.

---

## 7. Cross-reference map

Only relationships with a source read/write site. This packet does **not** validate or repair references. Values are opaque JSON.

| From | Field | To (REQUIRED / other) | Source site | Notes |
|---|---|---|---|---|
| `tasks.link` | `{type, id}` | invoice **`num`**; sale display **`id`**; warranty **`id`**; inventory **`code`** | 15758, 15800, 15827 | HIGH |
| `defectiveStock` | `warrantyId` | `warranties.id` | 18054, filter 18042 | HIGH |
| `defectiveStock` | `invoiceNum` / `invoiceId` | invoices `num` / `invoiceId` | `addDefectiveFromInvoice` 18088 | HIGH / MEDIUM |
| `warehouseDocs.items[]` | `code`, `fromWh`, `toWh` | parts/inventory code; `warehouses.id` | `saveWarehouseDoc` 18433–18438 | HIGH |
| `stockMoves` | `itemCode` | parts.code / inventory[code] / defective id on warranty path | `recordStockMove` 18133 | HIGH |
| `stockMoves` | `refDoc` | warehouseDocs.id **or** invoice `num` **or** warranty `id` | comment 18128; warranty 18064; warehouse 18488 | HIGH, heterogeneous |
| `stockMoves` | `whId` | `warehouses.id` | 18142 / 19130 | HIGH |
| `daqi` | `refType` + `refId` | invoice/sale **display number**, not validated | `addDaqi` 23255–23267 | MEDIUM |
| `daqi` | `agencyPhonebookIdx` | **array index** into `phonebook` | `_daqiAgencyName` 23247 | HIGH fragile; copied **opaque**; adapter does **not** read phonebook |
| invoice line `svc` | name string | `services.name` via `selSvc` | ARCH-16 / 17485 path | HIGH that it is **not** an id FK |
| `postalHistory` | — | none to business ids found | 14129–14141 | no FK |

T9 preserves task links, defective warranty/invoice ids, stockMoves.refDoc, and daqi.agencyPhonebookIdx without resolving them.

---

## 8. Services / svcs finding

Inspected assembler 8491–8492, hydrate 16121 + alias 16135, restore 14574–14577 / 15016–15017 / 15150.

| Fact | Evidence |
|---|---|
| Backup key `services` | `_safeArr(services)` |
| Backup key `svcs` | **also** `_safeArr(services)` — comment: alias for old files |
| Live RAM `svcs` | `let svcs=services` (16135). Assembler does **not** read this variable. |
| After JSON clone | `data.services` and `data.svcs` are **independent copies of the same snapshot** |
| Adapter | `services: _safeArr(services)`, `svcs: _safeArr(services)` — identical to assembler |
| T10 | RAM `services=[{code:'LIVE'}]`, RAM `svcs=[{code:'STALE'}]` → both output keys are `LIVE` |

No duplication of the collection as two sources. Catalog `SourceGlobals` omits `svcs`.

---

## 9. Phonebook firewall confirmation

| Check | Result |
|---|---|
| Phonebook field on DTO | **NO** |
| Adapter source contains `phonebook` / `savePBContact` | **NO** |
| Adapter reads `phonebook` RAM | **NO** |
| Identity invented for Phonebook | **NO** |
| `daqi.agencyPhonebookIdx` | copied as number/null JSON only |
| `savePBContact` | unchanged (still no `id:'PB-'`) |
| Assembler still exports `phonebook` | **YES** — live path untouched |

Reason it stays out: ARCH-16 §12 — no stable create id, merge-by-first-phone, daqi array-index coupling. Dedicated safety packet required later.

---

## 10. attachmentsIndex firewall confirmation

| Check | Result |
|---|---|
| Field on OPTIONAL DTO | **NO** |
| Adapter calls `collectAttachmentIndex` | **NO** |
| Assembler still assigns `attachmentsIndex` | **YES** (8551) — production unchanged |
| ForbiddenKeys includes `attachmentsIndex` | **YES** — Parse strips it |

`attachmentsIndex` remains derived metadata (ARCH-16 §6). ARCH-19 is the documented next extraction. Not started here.

---

## 11. DTO schema

`Sirman.Core.Backup.OptionalBusinessSnapshot`

- JSON-only `JsonObject` bag.
- `Parse(JsonNode)` clones input; copies only `AllOptionalKeys` (13) in catalog order; strips `ForbiddenKeys`.
- `ToJson()` returns a clone; `ToCanonicalJson()` = `BackupJsJson.Stringify` (insertion order).
- No browser types, WebView2, WinForms, localStorage, IndexedDB, Host.
- No `DateTime` / `Guid` / `Random`.
- No dedup, normalize, repair, or generated IDs.
- Typed accessors (`Products`, `Inventory`, …) are views over `Data`. JSON `null` is a C# null `JsonNode` (T8).

`OptionalBusinessSnapshotCatalog` holds frozen key order, source globals, identity docs, forbidden keys.

---

## 12. HTML adapter

`collectOptionalBusinessSnapshot()` in `Sirman_Final.html` / `Laegh_Final.html` immediately after `collectRequiredBusinessSnapshot`.

```text
read RAM via assembler expressions (including raw ternary for daqiWarehouse/daqiVouchers/postalHistory)
  → object literal in catalog order
  → JSON.parse(JSON.stringify(data))
```

- No `localStorage` / IndexedDB / Host write.
- No phonebook / attachmentsIndex / REQUIRED / settings.
- No ID generation, dedup, merge, normalize, reorder.
- **Not** called from `_buildFullBackupData`, `exportData`, `buildBackupObject`, or `collectRequiredBusinessSnapshot`.

Function SHA (lock for later packets):  
`d885fa4c4c5f128f36db7799a5732adc3765025b9bebe204779a77c01a79b508`

---

## 13. Golden fixtures

`desktop/Sirman.Core.Tests/OptionalBusinessFixtures.json` (regenerator `generate_arch18_fixtures.js` runs the HTML adapter).

| Id | Coverage |
|---|---|
| T1 | all OPTIONAL populated (nested); phonebook + invoices + attachmentsIndex in RAM ignored |
| T2 | all empty arrays / empty inventory object |
| T3 | nested objects |
| T4 | Persian Unicode |
| T5 | 24-row exact ordering |
| T6 | duplicate records preserved as separate rows |
| T7 | missing optional identity fields not invented |
| T8 | null/primitive: `daqiWarehouse`/`daqiVouchers`/`postalHistory` = `null`; nested nulls |
| T9 | cross-reference values preserved opaque |
| T10 | services/svcs both from RAM `services` (`LIVE`, not `STALE`) |

---

## 14. Exact equivalence results

For every fixture:

```text
JSON.stringify(collectOptionalBusinessSnapshot())
  === JSON.stringify(fixture.expected)
  === JSON.stringify(pickOptional(_buildFullBackupData()))
```

`pickOptional` copies the 13 assembler keys in catalog order. Exact `JSON.stringify` equality — not semantic closeness.

Core: `OptionalBusinessSnapshot.Parse(expected).ToCanonicalJson()` equals `BackupJsJson.Stringify(expected)`. Re-parse is idempotent. Input node is not mutated.

---

## 15. Immutability proof

HTML probe: mutate adapter products / inventory / services / svcs / tasks / defectiveStock / warehouseDocs / stockMoves / warehouses / daqi (including nested objects). Source array **length**, **order**, and nested values unchanged. `localStorage.setItem` = 0. `indexedDB.open` = 0. Host not invoked.

Core: mutate `Parse` result; original expected JSON unchanged. `ToJson()` is a separate clone.

T10: mutating cloned `svcs[0].code` does not change `services[0].code` or RAM `svcs`.

---

## 16. Production firewall

| Check | Result |
|---|---|
| `_buildFullBackupData` calls `collectOptionalBusinessSnapshot` | **NO** |
| `exportData` / `buildBackupObject` call it | **NO** |
| `collectRequiredBusinessSnapshot` calls it | **NO** |
| Assembler SHA | **`17f08840ecb3e6ecc9d72082d27eeeb6736daa97a1f06819df4f4f04a998cfa6`** (identical to ARCH-15/17) |
| ARCH-17 adapter SHA | **`92dd552685fce56b5cff75a41c4a767d658233affc6d3870d015dc379199c631`** (identical) |
| `exportData` SHA | unchanged (`ARCH9C_FN_SHA256.exportData`) |
| `buildBackupObject` SHA | unchanged (`ARCH9C_FN_SHA256.buildBackupObject`) |
| Phonebook in adapter source / payload | **NO** |
| `attachmentsIndex` in adapter source / payload | **NO** |
| Settings adapter still the only extra call in assembler | `collectBackupSettingsSnapshot` ×1 |

If assembler SHA had changed, this packet would have been **BLOCKED**. It did not change.

---

## 17. Regression tests

Untouched: Restore merge/replace, `importData`, `resetAll`, Phonebook, Print helpers, `WindowsPrintHost`, Host diagnostic, `JsonBackupRepository.TbdMarker` = `html-backup-engine`, SQLite project, checksum helpers, version `1405.6.3α`, ARCH-17 adapter body.

`Sirman_Final.html` and `Laegh_Final.html` remain byte-identical.

No unrelated failures. No repair of unrelated code.

---

## 18. Exact HTML/Core test counts

| Suite | Command | Result |
|---|---|---|
| HTML | `node test_laegh.js Sirman_Final.html` | **959 / 959 PASS** (ARCH-17 was 932; **+27** ARCH-18 tests) |
| Core | `dotnet test desktop/Sirman.Core.Tests` | **713 / 713 PASS** (ARCH-17 was 687; **+26** DTO tests) |

HTML ARCH-18 group: G1 SHA locks, G2 source/svcs semantics, T1–T10 goldens, T1 extra assembler pick, T1–T10 assembler≡adapter, T10 extra LIVE/STALE, immutability, Phonebook/attachmentsIndex/Restore/Print/SQLite firewall, byte-identical HTML files.

Core: 10 golden theory cases + T1–T10 facts + isolation + deterministic + malformed + no-browser + strip-forbidden + regression locks = 26.

---

## 19. Files changed

| File | Why |
|---|---|
| `Sirman_Final.html` | Add unused `collectOptionalBusinessSnapshot()`. Assembler body unchanged. |
| `Laegh_Final.html` | Byte-sync. |
| `desktop/Sirman.Core/Backup/OptionalBusinessSnapshot.cs` | Pure DTO. |
| `desktop/Sirman.Core/Backup/OptionalBusinessSnapshotCatalog.cs` | Frozen catalog + identity docs. |
| `desktop/Sirman.Core.Tests/OptionalBusinessSnapshotTests.cs` | Core goldens / isolation / firewall. |
| `desktop/Sirman.Core.Tests/OptionalBusinessFixtures.json` | T1–T10 goldens. |
| `desktop/Sirman.Core.Tests/generate_arch18_fixtures.js` | Regenerator. |
| `desktop/Sirman.Core.Tests/Sirman.Core.Tests.csproj` | Copy fixtures to output. |
| `test_laegh.js` | HTML goldens, assembler≡adapter, immutability, SHA/production firewall. |
| `deliveries/Reports/ARCH-18_OPTIONAL_BUSINESS_SNAPSHOT_ADAPTER_REPORT.md` | This report. |

**Not changed:** assembler implementation, `exportData`, `buildBackupObject`, Restore, Phonebook, Print, Host contracts, checksum, SQLite engine, `SIRMAN_VERSION.json`, ARCH-17 adapter.

---

## 20. Data-impact statement

**Zero live-data impact.** Adapter is unused by production backup. It does not write localStorage, IndexedDB, backup files, or SQLite. It does not restore, merge, or touch phonebook. Clone-on-return prevents RAM mutation via the DTO. `daqi.agencyPhonebookIdx` is copied as opaque JSON only.

---

## 21. Rollback procedure

Revert this branch. Production path remains the ARCH-15/16/17 assembler. No runtime rollback of shop data is required. Assembler SHA is identical to pre-ARCH-18, so reverting the unused adapter cannot change live backup bytes.

---

## 22. Recommended next extraction

**Do not cut over OPTIONAL collections in ARCH-19.**

Safest next packet (ARCH-16 plan): **ARCH-19 attachment/reference boundary** — document `attachmentsIndex` parentId vs `invoiceId`/`saleUid`, disk/idb/inline docs, heterogeneous `stockMoves.refDoc`. Still **no production assembler call**. Keep assembler SHA locked.

Do **not** start Phonebook here. Do **not** start a live optional-slice cutover until a later equivalence-gated packet.

---

## Status

**COMPLETED — OPTIONAL ADAPTER ONLY, NO PRODUCTION CUTOVER**
