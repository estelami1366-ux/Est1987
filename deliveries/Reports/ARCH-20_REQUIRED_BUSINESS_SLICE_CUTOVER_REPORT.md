# SIRMAN — ARCH-20 Required Business Slice Cutover

**Date:** 2026-09-05  
**Packet:** Wire ARCH-17 `collectRequiredBusinessSnapshot()` into `_buildFullBackupData()` for the six REQUIRED fields only. Equivalence-gated.  
**Product version:** `1405.6.3α` (unchanged)  
**Branch:** `cursor/arch-20-required-business-slice-cutover-fa01`  
**Base:** `cursor/arch-19-attachment-reference-boundary-fa01`  
**Final status:** **COMPLETED — REQUIRED BUSINESS SLICE CUTOVER**

This packet is **code/test verification only**. It does **not** claim real-shop verification. No shop data was used. ARCH-21 was **not** started.

---

## 1. Change Gate

```text
CHANGE: ARCH-20 required-slice opt-in cutover inside _buildFullBackupData
CLASS: Opt-in wiring of an existing adapter. Not an assembler extraction.
Q1: CAPABILITY — invoices/sales/warranties/parts/accounts plus four
    top-level counters now come from collectRequiredBusinessSnapshot().
    Not Restore. Not Phonebook. Not optional collections.
Q2: RunBusiness / Host: NO. No new Host method.
Q3: Persistence: NO. Assembly still reads RAM; no LS/IDB write.
Q4: Printing: NO.
Q5: HTML-only: PRESERVED. exportData/buildBackupObject still call
    _buildFullBackupData only.
Q6: New transport/DB/ACL: NO. Core BusinessDataSnapshot DTO unchanged.
RESULT: PASS
AUTHORITY: explicit user packet ARCH-20 2026-09-05
```

Gate stayed PASS through implementation. T1–T10 matched goldens with exact `JSON.stringify`. No stop condition was hit.

Not started: ARCH-21, optional-slice cutover, Restore/Merge/Replace, Phonebook, SQLite, Print rewrite.

---

## 2. Pre-cutover source expressions

Inspected `_buildFullBackupData()` in `Sirman_Final.html` on the ARCH-19 baseline **before** any ARCH-20 edit. Expressions were not inferred from ARCH-17 alone.

| Backup output key | Exact pre-cutover source |
|---|---|
| `invoices` | `_safeArr(invoices)` |
| `sales` | `_safeArr(sales)` |
| `warranties` | `_safeArr(warranties)` |
| `parts` | `_safeArr(parts)` |
| `accounts` | `_safeArr(accounts)` |
| `invCtr` | `invCtr\|\|1` |
| `invoiceUidCtr` | `(typeof invoiceUidCtr!=='undefined' && invoiceUidCtr>0) ? invoiceUidCtr : 0` |
| `saleCtr` | `(typeof saleCtr!=='undefined' && saleCtr>0) ? saleCtr : 1` |
| `saleUidCtr` | `(typeof saleUidCtr!=='undefined' && saleUidCtr>0) ? saleUidCtr : 0` |

Those six collections plus four counters are the REQUIRED slice. The assembler stored the four counters as **top-level** keys. ARCH-17 nested the same four expressions under `counters`. This packet maps `b.counters.*` back onto the existing top-level names. It does **not** add a nested `counters` key to the backup object.

---

## 3. Post-cutover source mapping

```js
var s = collectBackupSettingsSnapshot();
var b = collectRequiredBusinessSnapshot(); // exactly once
```

| Backup output key | Post-cutover source |
|---|---|
| `invoices` | `b.invoices` |
| `products` | `_safeArr(products)` (optional, unchanged) |
| `inventory` | `_safeObj(inventory)` (optional, unchanged) |
| `invCtr` | `b.counters.invCtr` |
| `invoiceUidCtr` | `b.counters.invoiceUidCtr` |
| `saleCtr` | `b.counters.saleCtr` |
| `saleUidCtr` | `b.counters.saleUidCtr` |
| `phonebook` | `_safeArr(phonebook)` (firewall) |
| `parts` | `b.parts` |
| `services` / `svcs` | `_safeArr(services)` (optional, unchanged) |
| `warranties` | `b.warranties` |
| `sales` | `b.sales` |
| `tasks` | `_safeArr(tasks)` (optional, unchanged) |
| `accounts` | `b.accounts` |
| settings keys | `s.*` (ARCH-15, unchanged) |
| `itemCounts.invoices` etc. | live `_safeArr(...).length` (derived, unchanged) |
| `attachmentsIndex` | `collectAttachmentIndex(data)` (ARCH-19, unchanged) |

Call graph after cutover:

```text
exportData / buildBackupObject / applyBackupSelective
    → _buildFullBackupData()
        → collectBackupSettingsSnapshot()     // ARCH-15, once
        → collectRequiredBusinessSnapshot()   // ARCH-20, once
        → RAM optional + phonebook (unchanged)
        → collectAttachmentIndex(data)        // unchanged
        → JSON.parse(JSON.stringify(data))    // ARCH-9D clone
```

`exportData` and `buildBackupObject` do **not** call the required adapter.

---

## 4. Exact six-field cutover

One authoritative assignment per REQUIRED field in the assembler object literal. No duplicate keys.

- `invoices`, `sales`, `warranties`, `parts`, `accounts` read only from `b`.
- Counters read only from `b.counters` and are written to the same four top-level names.
- Adapter is not called more than once.
- Individual fields are not re-cloned; the adapter already JSON-clones, then the assembler clones the full object.
- Optional collections, phonebook, settings, envelope, `itemCounts`, and `attachmentsIndex` were not moved.

---

## 5. ARCH-17 equivalence results

Frozen goldens: `desktop/Sirman.Core.Tests/BusinessDataFixtures.json` (T1–T10).

For every fixture:

```text
JSON.stringify(oldRequiredBusinessSlice)
  === JSON.stringify(newRequiredBusinessSlice)
  === JSON.stringify(fixture.expected)
```

`oldRequiredBusinessSlice` is the recorded pre-cutover expressions (test-only). `newRequiredBusinessSlice` is `pickRequired(_buildFullBackupData())`.

| Fixture | Result |
|---|---|
| T1–T10 | **10/10 exact** |

ARCH-17 adapter-vs-golden tests also remain **10/10**.

Representative complete backup object (settings + required + optional + `attachmentsIndex` + envelope):

| Slice | Result |
|---|---|
| required vs old expressions | exact |
| settings vs ARCH-15 adapter | exact |
| optional vs ARCH-18 adapter | exact |
| phonebook vs RAM | exact |
| `attachmentsIndex` vs `collectAttachmentIndex` | exact |
| envelope `magic` / `schemaVersion` / `version` | unchanged `SIRMAN_BACKUP` / `1` / `1405.6.3α` |

The only source-code difference is provenance of the six REQUIRED values. Resulting JSON for those values is identical.

---

## 6. Edge-case results

| # | Case | Evidence | Result |
|---|---|---|---|
| 1 | empty arrays | T2 | PASS |
| 2 | empty / default counters (`0\|\|1` → 1) | T2 | PASS |
| 3 | nested records | T4 | PASS |
| 4 | duplicate records remain duplicates | T8 | PASS |
| 5 | record order unchanged | T10 | PASS |
| 6 | `null` preserved; `undefined` dropped by JSON clone | dedicated probe | PASS |
| 7 | Persian Unicode | T5 | PASS |
| 8 | missing/nonstandard identity unchanged | T3 / T9 | PASS |
| 9 | no generated IDs | assembler has no `nextInvoiceId` / `ensureInvoiceIdentity` | PASS |
| 10 | no normalization (`0` vs `"0"`, `1.5`) | T6 | PASS |
| 11 | no deduplication | T8 | PASS |
| 12 | no repair | T9 | PASS |

---

## 7. Immutability results

Adapter output is already a JSON clone. Assigning `data.invoices = b.invoices` therefore does not alias live RAM.

Probe (test-only, no runtime mutation guards added):

- Mutate `data` **before** the assembler’s final clone: push a forged invoice, change nested invoice/sale/warranty/part/account fields, smash counters.
- Source collection **lengths** unchanged.
- Source **order** unchanged.
- Nested source objects unchanged (`nested.v`, item codes, account transactions).
- Source counter primitives unchanged.
- Mutating the **returned** backup object also does not mutate RAM.
- `localStorage.setItem` = 0. `indexedDB.open` = 0. Host not invoked.

---

## 8. Optional / attachments / Phonebook firewall

| Surface | Status |
|---|---|
| ARCH-15 settings (`s.*` + optional `printCenter`) | unchanged |
| ARCH-18 `collectOptionalBusinessSnapshot` | body SHA locked; **not** called from assembler |
| Optional assembler expressions (`products`, `inventory`, `services`/`svcs`, `tasks`, warehouse/daqi/postal) | unchanged |
| Phonebook | still `_safeArr(phonebook)` |
| `savePBContact` | unchanged; still does not mint `PB-` ids |
| `attachmentsIndex` | still `collectAttachmentIndex(data)` after the object literal |
| ARCH-19 walker SHA | identical |
| Restore merge / replace | SHA identical; not edited |

---

## 9. Old assembler SHA

```text
17f08840ecb3e6ecc9d72082d27eeeb6736daa97a1f06819df4f4f04a998cfa6
```

Recorded as `ARCH9D_BUILD_SHA256_PRE_ARCH20` / `ARCH20_OLD_ASSEMBLER_SHA256`. This is the ARCH-15 assembler lock from ARCH-16/17/18/19.

---

## 10. New assembler SHA

Computed from the actual changed `_buildFullBackupData` after the patch (`crypto.createHash('sha256').update(fn, 'utf8')`, same helper as `arch9cSha256`). **Not predicted.**

```text
7d0b1651e535aa28ef4d558279d8d2424978619fd80073ae0bbe27b009a4b143
```

The SHA changed because this is a real cutover. Adapter SHAs that must not move:

| Function | SHA |
|---|---|
| `collectRequiredBusinessSnapshot` | `92dd552685fce56b5cff75a41c4a767d658233affc6d3870d015dc379199c631` |
| `collectOptionalBusinessSnapshot` | `d885fa4c4c5f128f36db7799a5732adc3765025b9bebe204779a77c01a79b508` |
| `collectAttachmentIndex` | `ed781c62b8a0da9e80b458339cf3bf36bbabd38183ee5f5c1b81b9e686877d8f` |
| `exportData` | `aa8f62ed31807362c3ca80e6c58f73bff68f5354d49b76bbfd9c9a76b82bb498` |
| `buildBackupObject` | `f66b0a89313603ae5e70c581e523719056f1a484e8a323423f63e3e69f0150a5` |
| `applyBackupMergeSections` | `d01ee56106db3d5389ac3e7dc9ecec3c242965fb7aee7e2ba7e04835951d6b9d` |
| `applyBackupReplaceSections` | `8391119460561bc591b346c17bead9bdd75317828dd14a1b3636421e5cedc81b` |

---

## 11. Regression locks

| Lock | Result |
|---|---|
| Restore merge SHA | identical |
| Restore replace SHA | identical |
| `importData` present | unchanged |
| `resetAll` present | unchanged |
| `savePBContact` present; no `PB-` mint | unchanged |
| Phonebook assembler path | `_safeArr(phonebook)` |
| Print helpers / `WindowsPrintHost` / `PrintHardwareDiagnostic` | present, not edited |
| ARCH-18 adapter SHA | identical |
| `collectAttachmentIndex` SHA | identical |
| checksum helpers | not edited |
| `JsonBackupRepository.TbdMarker` | `html-backup-engine` |
| SQLite candidate project | present, not edited |
| product version | `1405.6.3α` in assembler |

Unrelated production code did not need to change.

---

## 12. HTML / Core test counts

| Suite | Count |
|---|---|
| HTML `node test_laegh.js Sirman_Final.html` | **1003/1003** (was 985/985; +18 ARCH-20 tests; no decrease) |
| Core `dotnet test desktop/Sirman.Core.Tests` | **746/746** (same total; ARCH-17 lock flipped to cutover) |
| ARCH-17 goldens | **10/10** |
| ARCH-20 equivalence T1–T10 | **10/10** |
| ARCH-20 group | **18/18** (G1, G2, T1–T10, complete object, edges, immutability, firewall, no LS/IDB, HTML byte-sync) |

Logs: `/opt/cursor/artifacts/arch-20-html-tests.log`, `/opt/cursor/artifacts/arch-20-core-tests.log`.

---

## 13. Files changed

| File | Why |
|---|---|
| `Sirman_Final.html` | One adapter call + six REQUIRED assignments. Adapter comment updated. Adapter **body** unchanged. |
| `Laegh_Final.html` | Byte-sync of `Sirman_Final.html`. |
| `test_laegh.js` | Assembler runtime inject, SHA lock, ARCH-16/17/18/19 G1 updates, ARCH-20 harness. |
| `desktop/Sirman.Core.Tests/BusinessDataSnapshotTests.cs` | Assembler must call the required adapter once. |
| `deliveries/Reports/ARCH-20_REQUIRED_BUSINESS_SLICE_CUTOVER_REPORT.md` | This report. |

**Not changed:** `desktop/Sirman.Core/**` production, `desktop/Sirman.Desktop/**`, `desktop/Sirman.Persistence.Sqlite/**`, Host contracts, Print pipeline, Restore, Phonebook, checksum helpers, `SIRMAN_VERSION.json`, ARCH-18 adapter body, `collectAttachmentIndex`.

---

## 14. Data-impact statement

- Live RAM is not written.
- `localStorage` / IndexedDB are not written by the assembler.
- Backup JSON for the six REQUIRED fields is byte-identical to the pre-cutover assembler for every ARCH-17 golden.
- Restore merge/replace are unmodified, so existing backups hydrate the same way.
- Optional collections, phonebook, attachments index, and settings payloads are unmodified.
- Product version is unchanged.

No shop data was read or written.

---

## 15. Rollback procedure

1. Revert `_buildFullBackupData` to the pre-cutover expressions in section 2 (remove `var b = collectRequiredBusinessSnapshot();` and restore `_safeArr(...)` / counter ternaries).
2. Restore the ARCH-17 comment to “NOT called from `_buildFullBackupData`”.
3. Restore `ARCH9D_BUILD_SHA256` to `17f08840ecb3e6ecc9d72082d27eeeb6736daa97a1f06819df4f4f04a998cfa6`.
4. Byte-sync `Laegh_Final.html`.
5. Re-run `node test_laegh.js Sirman_Final.html` and `dotnet test desktop/Sirman.Core.Tests`.

Git equivalent: revert the ARCH-20 commits on this branch.

---

## 16. Known limitations

- Code/test verification only. Not shop-verified.
- `itemCounts` still reads live RAM with `_safeArr(...).length`, not `b.*.length`. That is derived metadata, not one of the six cutover fields.
- Optional collections still assemble from live RAM. ARCH-18 remains unused by production.
- Phonebook remains outside the required adapter.
- `attachmentsIndex` remains a generated index after assembly, still keyed by `rec.id`.
- Restore still hydrates from the backup object, not from `BusinessDataSnapshot`.
- Double JSON clone (adapter then assembler) is redundant but JSON-identical; no extra per-field stringify was added.

---

## 17. Recommendation for ARCH-21

Do **not** start ARCH-21 from this packet.

Next equivalence-gated candidate, if explicitly authorized: wire **only** ARCH-18 `collectOptionalBusinessSnapshot()` into `_buildFullBackupData()` the same way (one call, existing optional keys, no Phonebook, no Restore, no `attachmentsIndex` behavior change). Require T1–T10 optional goldens with exact `JSON.stringify`, a complete-object check, and a new assembler SHA computed after the patch.

Keep Phonebook as its own later packet. Do not combine optional cutover with Restore or attachment-index changes.
