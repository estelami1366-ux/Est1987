# SIRMAN — ARCH-17 Required Business Snapshot Adapter

**Date:** 2026-09-05  
**Packet:** Pure transport DTO + HTML adapter for REQUIRED business backup collections. **No production cutover.**  
**Product version:** `1405.6.3α` (unchanged)  
**Branch:** `cursor/arch-17-required-business-snapshot-adapter-fa01`  
**Base:** `cursor/arch-16-business-snapshot-audit-fa01`  
**Final status:** **COMPLETED — ADAPTER ONLY, NO PRODUCTION CUTOVER**

This packet does **not** claim shop verification. ARCH-18 was **not** started.

---

## 1. Change Gate

```text
CHANGE: ARCH-17 collectRequiredBusinessSnapshot HTML adapter
        + Core Sirman.Core.Backup.BusinessDataSnapshot DTO
CLASS: Extraction-only transport. Not a live assembler cutover.
Q1: CAPABILITY — REQUIRED business slice snapshot (invoices, sales,
    warranties, parts, accounts, counters). Not Restore. Not Phonebook.
Q2: RunBusiness / Host: NO. No new Host method.
Q3: Persistence: NO. Adapter reads RAM only; clone-on-return; no LS/IDB write.
Q4: Printing: NO.
Q5: HTML-only: PRESERVED. exportData / buildBackupObject still call
    _buildFullBackupData only. Assembler does not call the new adapter.
Q6: New transport/DB/ACL: JSON DTO only. No SQLite. No P1C-8.
RESULT: PASS
AUTHORITY: explicit user packet ARCH-17 2026-09-05
```

Source authority for every REQUIRED collection is a single named RAM global (ARCH-16). No STOP/BLOCKED condition was hit. Assembler SHA unchanged.

---

## 2. Exact source authority map

Verified against `_buildFullBackupData` (`Sirman_Final.html` 8473–8553) and hydrate sites. Not guessed.

| DTO key | RAM global | Assembler expression (copied) | Hydrate LS key | Hydrate site |
|---|---|---|---|---|
| `invoices` | `invoices` | `_safeArr(invoices)` | `li` | 7520 |
| `sales` | `sales` | `_safeArr(sales)` | `laegh_sales` | 22118 |
| `warranties` | `warranties` | `_safeArr(warranties)` | `lw2` | 16076 |
| `parts` | `parts` | `_safeArr(parts)` | `lp2` | 16074 |
| `accounts` | `accounts` | `_safeArr(accounts)` | `laegh_accounts` | 16093 + IIFE 23667–23670 |
| `counters.invCtr` | `invCtr` | `invCtr\|\|1` | `lc` | 7519 |
| `counters.invoiceUidCtr` | `invoiceUidCtr` | `typeof invoiceUidCtr!=='undefined' && invoiceUidCtr>0 ? invoiceUidCtr : 0` | `laegh_invoice_uid_ctr` | 7533 |
| `counters.saleCtr` | `saleCtr` | `typeof saleCtr!=='undefined' && saleCtr>0 ? saleCtr : 1` | `laegh_sale_ctr` | 22119 |
| `counters.saleUidCtr` | `saleUidCtr` | `typeof saleUidCtr!=='undefined' && saleUidCtr>0 ? saleUidCtr : 0` | `laegh_sale_uid_ctr` | 22120 |

Authority is **not** ambiguous. No invented fallback.

`attachmentsIndex` is **not** included: ARCH-16 proved it is derived metadata (`collectAttachmentIndex`), not a stored field of these collections.

---

## 3. Required collection schema

Payload key order (catalog / adapter / DTO):

```text
invoices, sales, warranties, parts, accounts, counters
```

`counters` is a nested object (transport grouping). Assembler still stores the four primitives at **top level**. Equivalence pick wraps them:

```js
counters: {
  invCtr: full.invCtr,
  invoiceUidCtr: full.invoiceUidCtr,
  saleCtr: full.saleCtr,
  saleUidCtr: full.saleUidCtr
}
```

Values use the assembler defaulting expressions unchanged. Records are copied as JSON; no schema projection, no `migrateRecord`.

---

## 4. Identity map

Documented in `BusinessDataSnapshotCatalog.IdentityFields`. **Parse does not write these fields.**

| Collection | Identity in live source | Notes |
|---|---|---|
| invoices | `invoiceId` / `InvoiceId` | `invoiceIdentity()`; display `num`. Create via `getData()` often has no `id`. |
| sales | `saleUid` / `SaleUid` | `saleIdentity()`; display `id` like `SL-…`. |
| warranties | `id` | `nextWarCaseId` / merge-by-id. |
| parts | duplicate-scan `id` | Create path (`savePart`) uses `code` and may omit `id`. Not repaired. |
| accounts | `id` | `ACC-` + length. |
| counters | **none** | Four integers. No identity semantics. |

T9 proves missing/nonstandard identity bytes are preserved (`InvoiceId` kept, `invoiceId` not invented).

---

## 5. Adapter design

`collectRequiredBusinessSnapshot()` in `Sirman_Final.html` / `Laegh_Final.html` (immediately after `collectBackupSettingsSnapshot`).

```text
read RAM via _safeArr (collections) + assembler counter expressions
  → object literal in catalog order
  → JSON.parse(JSON.stringify(data))
```

- No `localStorage` / IndexedDB / Host.
- No phonebook / tasks / services / warehouse / settings / `attachmentsIndex`.
- No ID generation, dedup, merge, normalize.
- **Not** called from `_buildFullBackupData`, `exportData`, or `buildBackupObject`.

---

## 6. Core DTO design

`Sirman.Core.Backup.BusinessDataSnapshot`

- `Parse` / `FromCanonicalJson` clone input, copy only `AllRequiredKeys`, strip forbidden keys (including `phonebook`, `attachmentsIndex`, top-level `invCtr` leftover from a full backup).
- `ToJson()` clone; `ToCanonicalJson()` = `BackupJsJson.Stringify` (catalog insertion order).
- No browser / WebView2 / WinForms / storage / domain persist.
- No `DateTime` / `Guid` / `Random`.
- Identity map is catalog documentation only.

---

## 7. Golden fixtures

`desktop/Sirman.Core.Tests/BusinessDataFixtures.json` (generated from the HTML adapter; regenerator `generate_arch17_fixtures.js`).

| Id | Coverage |
|---|---|
| T1 | all REQUIRED populated (nested + docs pointers); phonebook in RAM ignored |
| T2 | empty arrays; counter defaults (`0\|\|1` → invCtr/saleCtr = 1) |
| T3 | missing optional identity / transactions |
| T4 | nested objects |
| T5 | Persian Unicode |
| T6 | number vs string (`0` vs `"0"`, `1.5`) |
| T7 | counters populated; no identity |
| T8 | duplicate identities preserved as separate rows |
| T9 | missing/nonstandard identity preserved exactly |
| T10 | 40-row order preservation |

For every fixture:

```text
JSON.stringify(collectRequiredBusinessSnapshot())
  === JSON.stringify(fixture.expected)
  === JSON.stringify(pickRequired(_buildFullBackupData()))
```

---

## 8. HTML / Core equivalence

For every golden: `BusinessDataSnapshot.Parse(expected).ToCanonicalJson()` equals `BackupJsJson.Stringify(expected)`. Re-parse is idempotent. Input node is not mutated.

---

## 9. Immutability proof

HTML probe: mutate adapter `invoices` / nested invoice items / sales / warranties / parts / accounts / counters. Source array **length**, **order**, and nested values unchanged. `localStorage.setItem` = 0. `indexedDB.open` = 0. Host not invoked.

Core: mutate `Parse` result; original expected JSON unchanged. `ToJson()` is a separate clone.

---

## 10. Production-path firewall

| Check | Result |
|---|---|
| `_buildFullBackupData` calls `collectRequiredBusinessSnapshot` | **NO** |
| `exportData` / `buildBackupObject` call it | **NO** |
| Assembler SHA | **`17f08840ecb3e6ecc9d72082d27eeeb6736daa97a1f06819df4f4f04a998cfa6`** (identical) |
| Phonebook in adapter source / payload | **NO** |
| `savePBContact` | unchanged (still no `PB-` id) |
| Settings adapter still the only extra call in assembler | `collectBackupSettingsSnapshot` ×1 |

---

## 11. Regression results

Untouched: Restore merge/replace, `importData`, `resetAll`, Phonebook, Print helpers, `WindowsPrintHost`, Host diagnostic, `JsonBackupRepository.TbdMarker` = `html-backup-engine`, SQLite project, checksum helpers, version `1405.6.3α`.

`Sirman_Final.html` and `Laegh_Final.html` remain byte-identical.

---

## 12. Exact test counts

| Suite | Command | Result |
|---|---|---|
| HTML | `node test_laegh.js Sirman_Final.html` | **932 / 932 PASS** (ARCH-16 was 906; **+26** ARCH-17 tests) |
| Core | `dotnet test desktop/Sirman.Core.Tests` | **687 / 687 PASS** (ARCH-16 was 661; **+26** DTO tests) |

No unrelated baseline failures. No repair of unrelated code.

---

## 13. Files changed

| File | Why |
|---|---|
| `Sirman_Final.html` | Add unused `collectRequiredBusinessSnapshot()`. Assembler body unchanged. |
| `Laegh_Final.html` | Byte-sync. |
| `desktop/Sirman.Core/Backup/BusinessDataSnapshot.cs` | Pure DTO. |
| `desktop/Sirman.Core/Backup/BusinessDataSnapshotCatalog.cs` | Frozen catalog + identity docs. |
| `desktop/Sirman.Core.Tests/BusinessDataSnapshotTests.cs` | Core goldens / isolation / firewall. |
| `desktop/Sirman.Core.Tests/BusinessDataFixtures.json` | T1–T10 goldens. |
| `desktop/Sirman.Core.Tests/generate_arch17_fixtures.js` | Regenerator. |
| `desktop/Sirman.Core.Tests/Sirman.Core.Tests.csproj` | Copy fixtures to output. |
| `test_laegh.js` | HTML goldens, assembler≡adapter, immutability, SHA/production firewall. |
| `deliveries/Reports/ARCH-17_REQUIRED_BUSINESS_SNAPSHOT_ADAPTER_REPORT.md` | This report. |

**Not changed:** assembler implementation, `exportData`, `buildBackupObject`, Restore, Phonebook, Print, Host contracts, checksum, SQLite engine, `SIRMAN_VERSION.json`.

---

## 14. Data-impact statement

**Zero live-data impact.** Adapter is unused by production backup. It does not write localStorage, IndexedDB, backup files, or SQLite. It does not restore, merge, or touch phonebook. Clone-on-return prevents RAM mutation via the DTO.

---

## 15. Rollback

Revert this branch. Production path remains ARCH-15/16 assembler. No runtime rollback of shop data is required.

---

## 16. Recommended ARCH-18

**Do not cut over REQUIRED collections in ARCH-18.**

Safest next packet: optional operational adapter only (`products`, `inventory`, `services`+`svcs`, `warehouseDocs`, `stockMoves`, `warehouses`, `defectiveStock`, `tasks`, `daqi*`), goldens, **no production call**, **no phonebook**. Keep assembler SHA locked until a later equivalence-gated required-slice cutover (ARCH-20 in the ARCH-16 plan).

---

## Status

**COMPLETED — ADAPTER ONLY, NO PRODUCTION CUTOVER**
