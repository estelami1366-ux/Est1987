# SIRMAN — ARCH-21 Optional Business Slice Cutover

**Date:** 2026-09-05  
**Packet:** Wire ARCH-18 `collectOptionalBusinessSnapshot()` into `_buildFullBackupData()` for the 13 OPTIONAL keys only. Equivalence-gated.  
**Product version:** `1405.6.3α` (unchanged)  
**Branch:** `cursor/arch-21-optional-business-slice-cutover-fa01`  
**Base:** `cursor/arch-20-required-business-slice-cutover-fa01`  
**Final status:** **COMPLETED — OPTIONAL BUSINESS SLICE CUTOVER**

This packet is **code/test verification only**. It does **not** claim real-shop verification. No shop data was used. ARCH-22 was **not** started.

---

## 1. Change Gate

```text
CHANGE: ARCH-21 optional-slice opt-in cutover inside _buildFullBackupData
CLASS: Opt-in wiring of an existing adapter. Not an assembler extraction.
Q1: CAPABILITY — products/inventory/services/svcs/tasks/defectiveStock/
    warehouseDocs/stockMoves/warehouses/daqi/daqiWarehouse/daqiVouchers/
    postalHistory now come from collectOptionalBusinessSnapshot().
    Not Restore. Not Phonebook. Not attachmentsIndex. Not required slice.
Q2: RunBusiness / Host: NO. No new Host method.
Q3: Persistence: NO. Assembly still reads RAM; no LS/IDB write.
Q4: Printing: NO.
Q5: HTML-only: PRESERVED. exportData/buildBackupObject still call
    _buildFullBackupData only.
Q6: New transport/DB/ACL: NO. Core OptionalBusinessSnapshot DTO unchanged.
RESULT: PASS
AUTHORITY: explicit user packet ARCH-21 2026-09-05
```

Gate stayed PASS through implementation. T1–T10 matched goldens with exact `JSON.stringify`. No stop condition was hit.

Not started: ARCH-22, Phonebook cutover, Restore/Merge/Replace, SQLite, Print rewrite.

---

## 2. Pre-cutover source expressions

Inspected `_buildFullBackupData()` in `Sirman_Final.html` on the ARCH-20 baseline **before** any ARCH-21 edit. Expressions were not inferred from the ARCH-18 report alone.

| Backup output key | Exact pre-cutover source |
|---|---|
| `products` | `_safeArr(products)` |
| `inventory` | `_safeObj(inventory)` |
| `services` | `_safeArr(services)` |
| `svcs` | `_safeArr(services)` — **not** live `svcs` |
| `tasks` | `_safeArr(tasks)` |
| `defectiveStock` | `_safeArr(defectiveStock)` |
| `warehouseDocs` | `_safeArr(warehouseDocs)` |
| `stockMoves` | `_safeArr(stockMoves)` |
| `warehouses` | `_safeArr(typeof warehouses!=='undefined'?warehouses:[])` |
| `daqi` | `_safeArr(typeof daqi!=='undefined'?daqi:[])` |
| `daqiWarehouse` | `(typeof daqiWarehouse!=='undefined'?daqiWarehouse:[])` — raw ternary, not `_safeArr` |
| `daqiVouchers` | `(typeof daqiVouchers!=='undefined'?daqiVouchers:[])` — raw ternary, not `_safeArr` |
| `postalHistory` | `(typeof postalHistory!=='undefined'?postalHistory:[])` — raw ternary, not `_safeArr` |

Those 13 keys are the OPTIONAL slice. `phonebook` and `attachmentsIndex` were already out of scope and stayed out.

---

## 3. Post-cutover source map

```js
var s = collectBackupSettingsSnapshot();
var b = collectRequiredBusinessSnapshot();
var o = collectOptionalBusinessSnapshot(); // exactly once
```

The packet said `const o`. The assembler already uses `var s` / `var b`, so this packet uses `var o` for the same declaration style. Tests lock `var o = collectOptionalBusinessSnapshot();`.

| Backup output key | Post-cutover source |
|---|---|
| `invoices` | `b.invoices` (ARCH-20, unchanged) |
| `products` | `o.products` |
| `inventory` | `o.inventory` |
| `invCtr` | `b.counters.invCtr` (ARCH-20, unchanged) |
| `invoiceUidCtr` | `b.counters.invoiceUidCtr` (ARCH-20) |
| `saleCtr` | `b.counters.saleCtr` (ARCH-20) |
| `saleUidCtr` | `b.counters.saleUidCtr` (ARCH-20) |
| `phonebook` | `_safeArr(phonebook)` (firewall) |
| `parts` | `b.parts` (ARCH-20) |
| `services` | `o.services` |
| `svcs` | `o.svcs` |
| `warranties` | `b.warranties` (ARCH-20) |
| `sales` | `b.sales` (ARCH-20) |
| `tasks` | `o.tasks` |
| `accounts` | `b.accounts` (ARCH-20) |
| `defectiveStock` | `o.defectiveStock` |
| `warehouseDocs` | `o.warehouseDocs` |
| `stockMoves` | `o.stockMoves` |
| `warehouses` | `o.warehouses` |
| `daqi` | `o.daqi` |
| `daqiWarehouse` | `o.daqiWarehouse` |
| `daqiVouchers` | `o.daqiVouchers` |
| `postalHistory` | `o.postalHistory` |
| settings keys | `s.*` (ARCH-15, unchanged) |
| `itemCounts.*` | live `_safeArr(...).length` (derived, unchanged) |
| `attachmentsIndex` | `collectAttachmentIndex(data)` (ARCH-19, unchanged) |

Call graph after cutover:

```text
exportData / buildBackupObject
    ↓
_buildFullBackupData()
    ↓
collectBackupSettingsSnapshot()       ×1
    ↓
collectRequiredBusinessSnapshot()     ×1
    ↓
collectOptionalBusinessSnapshot()     ×1
    ↓
phonebook from existing RAM path
    ↓
collectAttachmentIndex(data)
    ↓
JSON.parse(JSON.stringify(data))
```

`exportData` and `buildBackupObject` do **not** call the optional adapter. Attachments and phonebook were **not** moved.

---

## 4. Exact 13-key cutover

One authoritative assignment per OPTIONAL field in the assembler object literal. No duplicate keys. No per-field re-clone.

- `products`, `inventory`, `services`, `svcs`, `tasks`, `defectiveStock`, `warehouseDocs`, `stockMoves`, `warehouses`, `daqi`, `daqiWarehouse`, `daqiVouchers`, `postalHistory` read only from `o`.
- Adapter is called exactly once.
- Existing object-key order is unchanged.
- ARCH-15 `s.*` and ARCH-20 `b.*` stay as they were.
- Phonebook stays `_safeArr(phonebook)`.
- `attachmentsIndex` stays `collectAttachmentIndex(data)`.
- Final `return JSON.parse(JSON.stringify(data));` stays.

---

## 5. services / svcs proof

Pre-cutover assembler:

```js
services: _safeArr(services),
svcs: _safeArr(services),
```

ARCH-18 adapter (body unchanged):

```js
services: _safeArr(services),
svcs: _safeArr(services),
```

Post-cutover assembler:

```js
services: o.services,
svcs: o.svcs,
```

The live RAM variable `svcs` is **not** the source. Fixture T10 has RAM `services = [{ code:'LIVE' }]` and live `svcs = [{ code:'STALE' }]`. After assembly:

- `backup.services[0].code === 'LIVE'`
- `backup.svcs[0].code === 'LIVE'`
- `backup.services !== backup.svcs` (two separate JSON arrays after clone)
- live `svcs[0].code` remains `'STALE'`

The two backup keys are not merged, not collapsed, and not reduced to one key.

---

## 6. Raw-ternary proof

Pre-cutover assembler used raw ternary (not `_safeArr`) for:

- `daqiWarehouse`
- `daqiVouchers`
- `postalHistory`

If the source is `null`, JSON clone preserves JSON `null`. `_safeArr(null)` would have become `[]`. That conversion must not happen for these three backup keys.

Fixture T8: RAM sets those three to `null`. Post-cutover backup values:

| Key | Backup value |
|---|---|
| `daqiWarehouse` | `null` |
| `daqiVouchers` | `null` |
| `postalHistory` | `null` |

`itemCounts.daqiWarehouse` / `daqiVouchers` / `postalHistory` still wrap with `_safeArr(...).length` for **count metadata only**. That is not one of the 13 cutover keys and was left unchanged.

---

## 7. ARCH-18 equivalence results

Frozen goldens: `desktop/Sirman.Core.Tests/OptionalBusinessFixtures.json` (T1–T10).

For every fixture:

```text
JSON.stringify(oldOptionalBusinessSlice)
  === JSON.stringify(newOptionalBusinessSlice)
  === JSON.stringify(fixture.expected)
```

`oldOptionalBusinessSlice` is the recorded pre-cutover expressions (test-only). `newOptionalBusinessSlice` is `pickOptional(_buildFullBackupData())`.

| Fixture | Result |
|---|---|
| T1–T10 | **10/10 exact** |

ARCH-18 adapter-vs-golden tests also remain **10/10**. Assembler-slice ≡ adapter remains **10/10**.

---

## 8. Complete backup equivalence

Representative complete backup object (T1 required + T1 optional + phonebook + settings LS + attachments):

| Slice | Result |
|---|---|
| optional vs old expressions | **exact** |
| optional vs ARCH-18 golden | **exact** |
| settings vs ARCH-15 adapter | **unchanged / exact** |
| required vs old ARCH-20 expressions | **unchanged / exact** |
| phonebook vs RAM `_safeArr(phonebook)` | **unchanged / exact** |
| `attachmentsIndex` vs `collectAttachmentIndex` | **unchanged / exact** |
| envelope `magic` / `schemaVersion` / `version` | unchanged `SIRMAN_BACKUP` / `1` / `1405.6.3α` |

The only intended source-code difference is provenance of the 13 optional keys. Resulting JSON for those values is identical.

Complete backup comparison: **PASS / exact**.

---

## 9. Edge cases

| # | Case | Evidence | Result |
|---|---|---|---|
| 1 | empty products/inventory | T2 | PASS |
| 2 | nested inventory | T3 | PASS |
| 3 | services/svcs duplicate snapshot semantics | T10; two arrays, same data | PASS |
| 4 | services != live `svcs` variable | T10 STALE vs LIVE | PASS |
| 5 | duplicate records | T6 | PASS |
| 6 | exact ordering | T5 | PASS |
| 7 | null `daqiWarehouse` | T8 → JSON `null` | PASS |
| 8 | null `daqiVouchers` | T8 → JSON `null` | PASS |
| 9 | null `postalHistory` | T8 → JSON `null` | PASS |
| 10 | missing optional identity fields | T7; not invented | PASS |
| 11 | Persian Unicode | T4 | PASS |
| 12 | opaque cross-reference preservation | T9 | PASS |
| 13 | no deduplication | T6 length unchanged | PASS |
| 14 | no normalization | T7 old ≡ new | PASS |
| 15 | no repair | T7 old ≡ new | PASS |
| 16 | no generated IDs | assembler has no `nextInvoiceId` / `ensureInvoiceIdentity` | PASS |

---

## 10. Immutability

ARCH-18 adapter already returns a JSON clone. Assigning `data.products = o.products` therefore does not alias live RAM.

Probe (test-only, **no** production mutation guard added):

- Mutate adapter output: push a forged product, change nested product/inventory/services, smash `svcs[0].code`, replace `daqiWarehouse` with `[]`.
- Source collection **lengths** unchanged.
- Source **order** unchanged.
- Nested source values unchanged.
- RAM `services` unchanged.
- Live `svcs` alias/variable remains `'STALE'`.
- Null raw-ternary RAM values remain `null`.
- Mutating the **returned** backup object also does not mutate RAM.
- `localStorage.setItem` = **0**.
- `indexedDB.open` = **0**.
- Host not invoked.

---

## 11. Phonebook firewall

Assembler still contains exactly:

```js
phonebook: _safeArr(phonebook),
```

It is **not** `o.phonebook`. OptionalBusinessSnapshot catalog still lists `phonebook` as forbidden. `savePBContact` was not edited and still does not mint `PB-` ids.

Complete-object test: phonebook JSON equals the RAM array passed in, independent of the optional adapter.

---

## 12. attachmentsIndex firewall

Assembler still contains exactly:

```js
if(typeof collectAttachmentIndex==='function') data.attachmentsIndex = collectAttachmentIndex(data);
```

`collectAttachmentIndex` body SHA is unchanged. The optional adapter does not emit `attachmentsIndex`. Complete-object test: `full.attachmentsIndex` equals a direct walker run on the same parent records.

---

## 13. ARCH-15 integrity

`collectBackupSettingsSnapshot()` is still called **exactly once** from `_buildFullBackupData()`:

```js
var s = collectBackupSettingsSnapshot();
```

Settings keys still assign from `s.*`. Complete-object test: settings slice equals the ARCH-15 adapter output. `exportData` / `buildBackupObject` still do not call the settings adapter.

---

## 14. ARCH-20 integrity

`collectRequiredBusinessSnapshot()` is still called **exactly once** from `_buildFullBackupData()`:

```js
var b = collectRequiredBusinessSnapshot();
```

Required keys still assign from `b.invoices` / `b.sales` / `b.warranties` / `b.parts` / `b.accounts` and `b.counters.*`. Complete-object test: required slice equals the recorded pre-ARCH-20 expressions. Adapter body SHA is unchanged. `exportData` / `buildBackupObject` still do not call the required adapter.

---

## 15. Old assembler SHA

ARCH-20 assembler SHA before this packet (locked, not predicted):

```text
7d0b1651e535aa28ef4d558279d8d2424978619fd80073ae0bbe27b009a4b143
```

Recorded as `ARCH9D_BUILD_SHA256_PRE_ARCH21` / `ARCH21_OLD_ASSEMBLER_SHA256`.

---

## 16. New assembler SHA

Computed from the actual changed `_buildFullBackupData` after the patch (`crypto.createHash('sha256').update(fn, 'utf8')`, same helper as `arch9cSha256`). **Not predicted.**

```text
f354ba9875b25c3160581b6f06a62e991c11fb7a6181f9172db0db93c78cbd41
```

The SHA changed because this is a real cutover. Adapter SHAs that must not move:

| Function | SHA | Result |
|---|---|---|
| `collectRequiredBusinessSnapshot` (ARCH-17) | `92dd552685fce56b5cff75a41c4a767d658233affc6d3870d015dc379199c631` | unchanged |
| `collectOptionalBusinessSnapshot` (ARCH-18) | `d885fa4c4c5f128f36db7799a5732adc3765025b9bebe204779a77c01a79b508` | unchanged |
| `collectAttachmentIndex` (ARCH-19) | `ed781c62b8a0da9e80b458339cf3bf36bbabd38183ee5f5c1b81b9e686877d8f` | unchanged |
| `exportData` | `aa8f62ed31807362c3ca80e6c58f73bff68f5354d49b76bbfd9c9a76b82bb498` | unchanged |
| `buildBackupObject` | `f66b0a89313603ae5e70c581e523719056f1a484e8a323423f63e3e69f0150a5` | unchanged |
| `applyBackupMergeSections` | `d01ee56106db3d5389ac3e7dc9ecec3c242965fb7aee7e2ba7e04835951d6b9d` | unchanged |
| `applyBackupReplaceSections` | `8391119460561bc591b346c17bead9bdd75317828dd14a1b3636421e5cedc81b` | unchanged |

---

## 17. Regression locks

| Lock | Result |
|---|---|
| Restore merge SHA | identical |
| Restore replace SHA | identical |
| `importData` present | unchanged |
| `resetAll` present | unchanged |
| `savePBContact` present; no `PB-` mint | unchanged |
| Phonebook assembler path | `_safeArr(phonebook)` |
| Print helpers / `WindowsPrintHost` / `PrintHardwareDiagnostic` | present, not edited |
| checksum helpers | not edited |
| `JsonBackupRepository.TbdMarker` | `html-backup-engine` |
| SQLite candidate project | present, not edited |
| product version | `1405.6.3α` in assembler |
| ARCH-17 adapter body | SHA identical |
| ARCH-18 adapter body | SHA identical |
| `collectAttachmentIndex` body | SHA identical |

Unrelated **production** code did not need to change.

Test-only lock update: ARCH-20 Core `RegressionLocks_RequiredSliceCutover` previously forbade `collectOptionalBusinessSnapshot()` inside the assembler. That lock was flipped to require exactly one assembler call and to keep the adapter out of `exportData` / `buildBackupObject`. HTML ARCH-18 G1 was already flipped the same way. No production semantics were repaired to force tests to pass.

---

## 18. HTML / Core test counts

| Suite | Count |
|---|---|
| HTML `node test_laegh.js Sirman_Final.html` | **1021/1021** (was 1003/1003; +18 ARCH-21 tests; no decrease) |
| Core `dotnet test desktop/Sirman.Core.Tests` | **746/746** (same total; ARCH-18 lock flipped to cutover; ARCH-20 lock updated) |
| ARCH-18 goldens | **10/10** |
| ARCH-21 equivalence T1–T10 | **10/10** |
| Complete backup equivalence | **PASS / exact** |
| ARCH-21 group | **18/18** (G1, G2, T1–T10, complete object, 16 edges, immutability, firewall, no LS/IDB, HTML byte-sync) |

Logs: `/opt/cursor/artifacts/arch21-html-tests.log`, `/opt/cursor/artifacts/arch21-core-tests.log`.

---

## 19. Files changed

| File | Why |
|---|---|
| `Sirman_Final.html` | One adapter call + 13 OPTIONAL assignments. Adapter comment updated. Adapter **body** unchanged. |
| `Laegh_Final.html` | Byte-sync of `Sirman_Final.html`. |
| `test_laegh.js` | Assembler runtime inject, SHA lock, ARCH-16/17/18/19/20 G1 updates, ARCH-21 harness. |
| `desktop/Sirman.Core.Tests/OptionalBusinessSnapshotTests.cs` | Assembler must call the optional adapter once. |
| `desktop/Sirman.Core.Tests/BusinessDataSnapshotTests.cs` | ARCH-20 lock now allows the ARCH-21 optional call (still ×1; still not from export). |
| `deliveries/Reports/ARCH-21_OPTIONAL_BUSINESS_SLICE_CUTOVER_REPORT.md` | This report. |

**Not changed:** `desktop/Sirman.Core/**` production, `desktop/Sirman.Desktop/**`, `desktop/Sirman.Persistence.Sqlite/**`, Host contracts, Print pipeline, Restore, Phonebook, checksum helpers, `SIRMAN_VERSION.json`, ARCH-17 adapter body, ARCH-18 adapter body, `collectAttachmentIndex` body.

`Sirman_Final.html` and `Laegh_Final.html` are byte-identical.

---

## 20. Data-impact statement

- Live RAM is not written.
- `localStorage` / IndexedDB are not written by the assembler.
- Backup JSON for the 13 OPTIONAL fields is byte-identical to the pre-cutover assembler for every ARCH-18 golden.
- Restore merge/replace are unmodified, so existing backups hydrate the same way.
- Settings, required collections, phonebook, attachments index, and envelope are unmodified.
- Product version is unchanged.

No shop data was read or written.

---

## 21. Rollback

1. Revert `_buildFullBackupData` to the pre-cutover expressions in section 2 (remove `var o = collectOptionalBusinessSnapshot();` and restore the 13 `_safeArr` / `_safeObj` / raw-ternary expressions).
2. Restore the ARCH-18 comment to “NOT called from `_buildFullBackupData`”.
3. Restore `ARCH9D_BUILD_SHA256` to `7d0b1651e535aa28ef4d558279d8d2424978619fd80073ae0bbe27b009a4b143`.
4. Byte-sync `Laegh_Final.html`.
5. Re-run `node test_laegh.js Sirman_Final.html` and `dotnet test desktop/Sirman.Core.Tests`.

Git equivalent: revert the ARCH-21 commits on this branch.

---

## 22. Known limitations

- Code/test verification only. Not shop-verified.
- `itemCounts` still reads live RAM with `_safeArr(...).length`, not `o.*.length`. That is derived metadata, not one of the 13 cutover keys. For null `daqiWarehouse` / `daqiVouchers` / `postalHistory`, the **count** still becomes `0` via `_safeArr`, while the **backup field** stays JSON `null`.
- Phonebook remains outside the optional adapter.
- `attachmentsIndex` remains a generated index after assembly, still keyed by `rec.id`.
- Restore still hydrates from the backup object, not from `OptionalBusinessSnapshot`.
- Remaining assembler RAM paths (`userAuditLog`, `bgAuditLog`, `userRoles`, `loginPw`, `senderInfo`, `logoSrc`, `acH`) are not in this adapter.
- Double JSON clone (adapter then assembler) is redundant but JSON-identical; no extra per-field stringify was added.
- Assembler uses `var o` rather than packet `const o`, matching `var s` / `var b`.

---

## 23. ARCH-22 recommendation

Do **not** start ARCH-22 from this packet.

Next equivalence-gated candidate, if explicitly authorized: **Phonebook** as its own packet — keep `_safeArr(phonebook)` until a dedicated adapter exists, then wire it the same way (one call, existing key name, no Restore, no `attachmentsIndex` behavior change). Do **not** fold Phonebook into OptionalBusinessSnapshot.

Do **not** combine Phonebook cutover with Restore/Merge/Replace, attachment-index changes, remaining audit/login/appearance RAM keys, or SQLite.

`attachmentsIndex` should stay a generated walker after assembly until a later dedicated packet, if ever.

---

**Status: COMPLETED — OPTIONAL BUSINESS SLICE CUTOVER**
