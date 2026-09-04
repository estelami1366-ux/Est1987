# SIRMAN — ARCH-9D Production Clone-On-Assemble Hardening

**Date:** 2026-09-04  
**Packet:** One production data-safety fix — `_buildFullBackupData` returns a JSON deep clone.  
**Product version left unchanged:** `1405.6.3α`  
**Branch:** `cursor/arch-9d-production-clone-on-assemble-fa01`  
**Base:** `cursor/arch-9c-clone-on-assemble-proof-fa01` @ `d3fa890`

---

## Phase 3 Change Gate

```text
CHANGE: ARCH-9D clone assembled backup at _buildFullBackupData return
CLASS: Focused data-safety fix. Not extraction. Not Restore/Core migration.
Q1: CAPABILITY — returned snapshot isolated from live RAM
Q2: RunBusiness / Host: NO
Q3: Persistence: NO writes. Clone only.
Q4: Printing: NO
Q5: HTML-only: PRESERVED
Q6: New transport/DB/ACL: NO
RESULT: PASS
AUTHORITY: explicit user packet ARCH-9D 2026-09-04
```

ARCH-10 / P1C-8 / Restore cutover / Merge-Replace-in-Core / Phonebook / SQLite were not started.

Verified suites after this packet:

| Suite | Result |
|---|---|
| HTML `node test_laegh.js Sirman_Final.html` | **828/828 PASS** (821 previous + 7 ARCH-9D) |
| Core `dotnet test desktop/Sirman.Core.Tests` | **556/556 PASS** (no Core production source change) |

---

## 1. Exact code change

Single return-boundary line in `_buildFullBackupData` (`Sirman_Final.html` / `Laegh_Final.html` line 8572):

```javascript
  if(typeof collectAttachmentIndex==='function') data.attachmentsIndex = collectAttachmentIndex(data);
  return JSON.parse(JSON.stringify(data));
```

Previously: `return data;`

`_safeArr` / `_safeObj` were **not** rewritten. Clone is **not** duplicated on helpers or callers. One clone at the final return.

SHA-256 of `_buildFullBackupData` source after the change:

`f65d8f393d91de7e984540060ceec6deb14976d9dce4bd7b82261d2e69c5df5f`

Callers (`exportData`, `buildBackupObject`, `applyBackupSelective` safety snapshot) still call `_buildFullBackupData()` and therefore receive the isolated object. Their own source is byte-locked (ARCH-9C SHA-256 unchanged).

---

## 2. Before / after alias behavior

| Check | ARCH-9C (before) | ARCH-9D (after) |
|---|---|---|
| `_safeArr(invoices) === invoices` | true | **true** (helper unchanged) |
| `assembly.invoices === invoices` | true | **false** |
| `assembly.invoices[0] === invoices[0]` | true | **false** |
| `assembly.invoices[0].someNested === …` | true | **false** |
| `assembly.inventory === inventory` | true | **false** |
| `assembly.services === services` | true | **false** |
| `assembly.svcs === services` | true | **false** |
| `assembly.services === assembly.svcs` | true (same RAM) | **false** (equal copies) |

Mutating the returned snapshot no longer mutates shop RAM.

---

## 3. Content parity

JSON content of collections after clone equals live RAM **before** any mutation:

- invoices / products / warranties / phonebook / parts / sales / accounts / inventory / services / svcs
- `itemCounts.invoices === 1`, `itemCounts.tasks === 0`
- `sections` length ≥ 32 (printCenter may be 33rd)
- optional `printCenter` / `attachmentsIndex` present
- Persian `علی` / `فاکتور.pdf` / `۱۲` preserved
- 49 base keys still assigned; typical run still 51 with the two optionals
- `exportedAt` still ISO **string** from `new Date().toISOString()` (behavior unchanged)
- version literals `1405.6.3α` unchanged
- `origin` still stamped by callers after return (`manual` / `autosave`), not by assembly

During assembly, RAM JSON of those collections is unchanged (`ramBefore` vs after call).

---

## 4. Nested isolation proof

Production-level regression (not a second test-only clone):

```text
assembly = _buildFullBackupData()
assembly.invoices.push(...)
assembly.invoices[0].someNested.value = 'changed'
assembly.products / warranties / parts / sales / accounts / phonebook push
assembly.inventory qty + new key
assembly.attachmentsIndex.push
assembly.services.push
```

Live RAM: original lengths, `'original-nested'`, qty `4`, attachment name `فاکتور.pdf`. Demo:

```json
{
  "isolated": true,
  "nestedIsolated": true,
  "servicesSplit": true,
  "originalLen": 1,
  "assemblyLenAfterPush": 2,
  "originalNested": "original-nested",
  "lsWrites": 0
}
```

---

## 5. services / svcs alias result

**Expected and observed:** after clone,

- `cloned.services !== live services`
- `cloned.svcs !== live services`
- `cloned.services !== cloned.svcs`
- `JSON.stringify(cloned.services) === JSON.stringify(live services)`

The shared RAM alias is **not** preserved. Equal data, separate arrays.

---

## 6. localStorage / IndexedDB side-effect result

Instrument on the `_buildFullBackupData` call itself (not boot):

| Probe | Result |
|---|---|
| `localStorage.setItem` | **0** |
| `localStorage.removeItem` | **0** |
| `indexedDB.open` | **0** |
| source contains `localStorage.setItem` | no |
| source contains `indexedDB` | no |
| source contains `sv()` / `svWarr` | no |

Reads (`getItem` / `key`) still occur for appearance / printSettings / company / tz / aiKeys — same as before. No new writes.

---

## 7. Snapshot validator result

HTML production validators on the **returned** clone:

- `validateRequiredBackupCollections` → `ok`
- `validateBackupItemCounts` → `ok`
- `validateBackupStructuralIntegrity` → `ok`

Core production validators were not reimplemented. `BackupSnapshotCloneTests` still run `BackupSnapshot.Parse` + `BackupValidator` + `BackupStructuralValidator.ValidateItemCounts` on the same JSON clone semantic (`CloneExact`). Core **production** source (`desktop/Sirman.Core`) is git-clean.

A Core test lock now requires `return JSON.parse(JSON.stringify(data));` exactly once in `_buildFullBackupData`.

---

## 8. Export regression

| Caller | Source change | Behavior |
|---|---|---|
| `exportData` | **none** (SHA256 locked) | still `var data = _buildFullBackupData();` then `origin='manual'` |
| `buildBackupObject` | **none** (SHA256 locked) | still `var d = _buildFullBackupData();` then `origin='autosave'` |

Sandbox `buildBackupObject()` (Finalizer not present): `origin`/`autoSave` stamped; `d.invoices !== live invoices`; collection JSON equals RAM.

Only reference identity of the snapshot changed. Checksum / `sectionChecksums` still belong to Finalizer **after** assembly.

---

## 9. HTML test count

```text
کل تست‌ها: 828
✅ موفق: 828
❌ ناموفق: 0
```

Previous: 821. Added 7 ARCH-9D tests. ARCH-9C tests kept (helper live-alias retargeted; T1–T11 still pass on a second clone of the already-isolated snapshot). No tests deleted.

---

## 10. Core test count

```text
Passed!  Failed: 0, Passed: 556, Skipped: 0, Total: 556
```

Core production assemblies/libraries unchanged. Test lock in `BackupSnapshotCloneTests` updated to require the return clone.

---

## 11. Exact files changed

| File | Role |
|---|---|
| `Sirman_Final.html` | `return JSON.parse(JSON.stringify(data));` |
| `Laegh_Final.html` | same byte-sync |
| `test_laegh.js` | ARCH-9C helper locks + ARCH-9D production isolation tests |
| `desktop/Sirman.Core.Tests/BackupSnapshotCloneTests.cs` | source lock: clone at return |
| `deliveries/Reports/ARCH-9D-PRODUCTION-CLONE-ON-ASSEMBLE_2026-09-04.md` | this report |

Not changed: `desktop/Sirman.Core/**`, Restore functions, Phonebook, SQLite, `resetAll`, `_safeArr`, `_safeObj`, `exportData`, `buildBackupObject`, `applyBackupSelective`.

---

## 12. Confirmation

| Surface | Changed? |
|---|---|
| Restore (`applyBackupSelective`) | **NO** |
| Merge (`applyBackupMergeSections`) | **NO** |
| Replace (`applyBackupReplaceSections`) | **NO** |
| Phonebook (`savePBContact`) | **NO** |
| SQLite | **NO** |
| `resetAll` | **NO** |
| `importData` | **NO** |
| `_safeArr` / `_safeObj` | **NO** |

Those functions are source-locked: they must exist and must **not** repeat the assembly clone.

---

## 13. Rollback method

Revert the single return in `_buildFullBackupData`:

```javascript
  return data;
```

instead of

```javascript
  return JSON.parse(JSON.stringify(data));
```

in both `Sirman_Final.html` and `Laegh_Final.html`. Callers need no rollback. Restore ARCH-9C SHA-256 of `_buildFullBackupData` (`5224e91e…`) if reverting tests.

---

## 14. Remaining assembly risks

1. **Helpers still alias RAM** until the return. A throw between object-literal construction and the clone return is unlikely to leak the local `data` object, but `_safeArr` itself is still a live view if called elsewhere.
2. **`collectAttachmentIndex` still walks live records** (read-only) before the clone.
3. **`exportedAt` is still non-deterministic** (`new Date().toISOString()`).
4. **Assembly still reads `localStorage`** (appearance, printSettings, company, tz, aiKeys, optional printCenter). Isolation is of the **returned** object, not of the read sources.
5. **JSON clone residual:** if a future RAM field stores `Date` / `undefined` / `NaN` / `bigint`, stringify will coerce or throw. Current snapshot is JSON-only (ARCH-9C).
6. **Live path is still HTML assembly → Core Finalizer.** No Core reader. Restore apply is still HTML Merge/Replace.
7. **`svcs`/`services` are now two copies** in the file. Restore/merge must treat them as data, not as one identity (they already were separate keys).

---

## 15. Next safest architectural extraction

Do **not** extract `_buildFullBackupData` itself yet.

Next safest: a **read-only Core consumer** of the already-cloned JSON snapshot (parse + `BackupSnapshot` + existing validators) on the export/finalize path — still no live RAM adapter, no Restore cutover, no Merge/Replace in Core, no P1C-8, no Phonebook/SQLite.

That would be a later packet (not ARCH-10 in this stop).

---

## Q1–Q14

**Q1. Is `_buildFullBackupData` now returning an isolated snapshot?**  
YES. `assembly.invoices !== invoices`; production mutation test; `return JSON.parse(JSON.stringify(data));` once.

**Q2. Is nested mutation isolated?**  
YES. `assembly.invoices[0].someNested.value = 'changed'` leaves RAM `'original-nested'`.

**Q3. Is services/svcs alias split after cloning?**  
YES. Three-way `!==` plus equal JSON content.

**Q4. Is snapshot content unchanged?**  
YES. Collection stringify equals RAM; 49 keys; Persian; optionals present.

**Q5. Are itemCounts unchanged?**  
YES. Same 15 keys; counts match array lengths; validator ok.

**Q6. Are sections unchanged?**  
YES. Catalog 32 names; optional `printCenter` push still happens **before** clone.

**Q7. Are localStorage writes unchanged/zero from assembly?**  
YES. `setItem`/`removeItem` = 0; no `indexedDB.open`.

**Q8. Did Restore change?**  
NO. `applyBackupSelective` SHA256 locked.

**Q9. Did Merge/Replace change?**  
NO. Both functions present and not cloned.

**Q10. Did Phonebook change?**  
NO. `savePBContact` locked.

**Q11. Did SQLite change?**  
NO. `desktop/Sirman.Core` / persistence git-clean. `html-backup-engine` TBD remains.

**Q12. Did resetAll change?**  
NO.

**Q13. What production risk remains in Backup Assembly?**  
HTML still **reads** live RAM + localStorage to *build* the object; only the **return** is isolated. Finalizer/Restore still HTML-owned. See section 14.

**Q14. What is the next safest extraction?**  
Read-only Core consumption of the cloned JSON snapshot. Not live assembly extraction. Not Restore cutover. Not this packet.

---

## STOP

ARCH-10 not started. `_buildFullBackupData` was not moved to Core. Restore cutover not started. Merge/Replace not implemented in Core. P1C-8 not started. Phonebook and SQLite untouched.
