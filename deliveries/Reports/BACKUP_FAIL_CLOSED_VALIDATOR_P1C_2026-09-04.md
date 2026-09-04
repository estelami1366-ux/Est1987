# SIRMAN — P1C Fail-Closed Backup/Restore Validator (Warranties First)

**Date:** 2026-09-04  
**Packet:** CODE-ONLY safety barrier. No live data mutation. No Phonebook change. No SQLite. No cutover.  
**Product version left unchanged:** `1405.6.3α` / assembly `1405.6.3.1`  
**Branch:** `cursor/p1c-fail-closed-warranties-validator-fa01`

---

## Phase 3 Change Gate

```text
CHANGE: P1C fail-closed required-collection validator (warranties first)
CLASS: Safety bugfix of existing BackupEngine / restore pipeline
       (adjacent to CLASS E persistence, but NOT a schema/format redesign)
Q1: CAPABILITY / BUSINESS CHANGE — restore integrity gate only
Q2: RunBusiness / Host / Core: NO
Q3: Persistence: YES — backup validation + migrateBackup coercion only
    Live localStorage/IndexedDB/SQLite SoT: NOT mutated by this patch
Q4: Printing: NO (frozen print untouched)
Q5: HTML-only path: PRESERVED (validator runs in the existing HTML BackupEngine)
Q6: New transport/DB/ACL/Host: NO
FROZEN PRINT: not touched
OWNERSHIP: HTML BackupEngine remains owner of backup schema
HTML-ONLY: kept
RESULT: PASS
AUTHORITY: explicit user packet 2026-09-04 (safety barrier, warranties first)
```

Default CLASS E is BLOCK. This packet is an authorized fail-closed bugfix: stop `MISSING → []` for required `warranties`. Official backup JSON format is not widened except that restore now rejects packages that omit the required key.

---

## 1. BEFORE behavior

Restore treated **missing** required collections as **empty**.

Exact coercion in `migrateBackup` (`Sirman_Final.html`):

```javascript
if (!d.warranties) { d.warranties = []; log.push('🛡 گارانتی: خالی (نسخه قدیمی)'); }
```

Call path:

1. `importData` parsed JSON
2. `applySchemaMigrations` then `migrateBackup` **created `warranties: []`**
3. Preview opened; empty section checkbox was disabled
4. `confirmRestorePreview` → `applyBackupSelective`
5. Safety snapshot + `logBackupAudit('pre-restore','ok')` ran **before** merge/replace
6. `applyBackupReplaceSections`: `warranties = Array.isArray(d.warranties) ? d.warranties : []`
7. `applyBackupMergeSections`: `(d.warranties||[]).forEach(...)`
8. Alert `ok merge N بخش` / replace success could appear for a **partial** package

`validateBackupPackage` did **not** fail when `warranties` was absent (`d.invoices||...||d.warranties` treats missing as falsy but other keys still made `ok:true`).

**Semantic bug:** `MISSING == EMPTY`. A backup `{}` or `{invoices:[...]}` without a `warranties` key could restore and look successful.

---

## 2. AFTER behavior

`MISSING ≠ EMPTY` for required collection `warranties`.

| Input | Result |
|---|---|
| key absent | **FAIL** (`missingRequiredCollections`) |
| `warranties: null` | **FAIL** (`invalidCollections`) |
| `warranties: "invalid"` (non-array) | **FAIL** (`invalidCollections`) |
| `warranties: []` | **PASS structurally** — remains explicit empty, not rewritten as missing |
| `warranties: [{...records}]` | **PASS structurally** if items are objects |

Validation runs **before**:

- `applySchemaMigrations` / `migrateBackup` coercion
- restore preview apply
- `saveSafetySnapshot` / IndexedDB
- merge / replace / `sv()` / `svWarr()`
- audit `restore ok` / `pre-restore ok`

On failure: **STOP**. Explicit error. No live mutation. No success audit.

`migrateBackup` no longer assigns `d.warranties = []` when the key is absent/null/non-array. It logs fail-closed and skips warranty field/id walks unless `Array.isArray(d.warranties)`.

---

## 3. Exact files changed

| File | Role |
|---|---|
| `Sirman_Final.html` | Validator + restore gates + migrateBackup |
| `Laegh_Final.html` | Byte-sync of the same UI (قانون ۹) |
| `test_laegh.js` | T1–T10 execution tests + extractor wiring |
| `deliveries/Reports/BACKUP_FAIL_CLOSED_VALIDATOR_P1C_2026-09-04.md` | This report |

Not changed: Phonebook functions, SQLite, `resetAll`, `SIRMAN_VERSION.json`, shop JSON, print engine, Host/Core.

---

## 4. Exact functions changed

| Function | File | Change |
|---|---|---|
| `REQUIRED_BACKUP_COLLECTIONS` | HTML (new) | Registry; currently `['warranties']` |
| `backupHasOwnCollection` | HTML (new) | Own-property check |
| `validateRequiredBackupCollections` | HTML (new) | Result model: `ok`, `errors`, `warnings`, `missingRequiredCollections`, `invalidCollections` |
| `assertRequiredBackupCollections` | HTML (new) | Throws on failure |
| `BackupEngine.validate` | HTML | Composes required-collection check **then** `validateBackupPackage` |
| `testRestoreBackup` | HTML | Required check **before** schema migrate / `migrateBackup` |
| `migrateBackup` | HTML | No `MISSING→[]` for warranties; array-guarded walks |
| `importData` | HTML | Required check after parse/decrypt, **before** schema migrate |
| `applyBackupSelective` | HTML | Assert **before** safety snapshot / audit |
| `applyBackupReplaceSections` | HTML | Assert first; assign `warranties = d.warranties` (no `: []` fallback) |
| `applyBackupMergeSections` | HTML | Assert first; `d.warranties.forEach` (no `\|\|[]`) |
| `prepareNetworkWorkspacePull` | HTML | Required check **before** `migrateBackup` |

Unchanged (traced, not edited): `resetAll`, `openRestorePreviewModal`, `confirmRestorePreview` (already try/catch), `confirmNetworkPullPreview` (already try/catch), `savePBContact`, phonebook merge block inside `applyBackupMergeSections`.

---

## 5. Validation contract

Result object (existing project style: `ok` not `IsValid`):

```text
{
  ok: boolean,
  errors: string[],
  warnings: string[],
  missingRequiredCollections: string[],
  invalidCollections: string[]
}
```

Required registry: `REQUIRED_BACKUP_COLLECTIONS = ['warranties']`.

Rules for each required key:

- **A** Property absent → FAIL, listed in `missingRequiredCollections`
- **B** Property `null` → FAIL, listed in `invalidCollections`
- **C** Property not an array → FAIL, listed in `invalidCollections`
- **D** Property `[]` → PASS structurally; key remains present
- **E** Array of records → PASS if each item is a non-null object (not primitive/array/null)

The validator never rewrites the payload. It does not convert missing to `[]`.

`validateBackupPackage` remains the weaker checksum/itemCount helper. Restore gates use the new required-collection layer first.

---

## 6. Restore call-path gate

Forensic locations **before this patch** (`Sirman_Final.html` current lines after patch):

| Role | Function | Line (after patch) |
|---|---|---|
| migrate / MISSING→[] (removed) | `migrateBackup` | 13988 |
| reset (untouched) | `resetAll` | 14734 |
| restore preview UI | `openRestorePreviewModal` | 14273 |
| user confirm file restore | `confirmRestorePreview` | 14325 |
| mutation orchestrator | `applyBackupSelective` | 14360 |
| replace mutation | `applyBackupReplaceSections` | 14395 |
| merge mutation | `applyBackupMergeSections` | 14521 |
| file load | `importData` | 14615 |
| network confirm | `confirmNetworkPullPreview` | 27904 |
| network prepare | `prepareNetworkWorkspacePull` | 27819 |

**Intended flow now:**

```text
Load backup
  → Parse / unwrap / decrypt
  → Structural object check
  → Required collection validation     ← GATE (new)
  → hasData / schema version / checksum
  → Normalization / migrateBackup      ← cannot invent warranties:[]
  → Restore preview
  → User confirmation
  → applyBackupSelective               ← GATE again before snapshot
      → merge or replace               ← GATE again before writes
```

**Where mutation begins:** first live write is still inside `applyBackupReplaceSections` / `applyBackupMergeSections` (`sv`, `svWarr`, `localStorage`) and the IDB safety snapshot at the start of `applyBackupSelective`.

**Why the gate blocks mutation:** `assertRequiredBackupCollections` is the **first** statement of `applyBackupSelective`, before `_buildFullBackupData` / `saveSafetySnapshot` / `logBackupAudit('pre-restore','ok')`. Merge and replace also assert before any assignment. Failed validation throws; existing `confirmRestorePreview` catch shows the error and logs `restore err`. No `restore ok` audit.

File import additionally stops before preview, so the user cannot confirm a missing-warranties package from `importData`.

---

## 7. migrateBackup behavior before / after

**Before:** `if (!d.warranties) d.warranties = [];` then `d.warranties.forEach(...)` for `accRef` and missing ids.

**After:**

- Absent key: log `غایب — بدون جایگزینی [] (fail-closed)`; do **not** create the key
- `null`: log; do not coerce to `[]`
- Non-array: log; do not coerce
- Array (including `[]`): log count; migrate `accRef` / missing ids only on that array

Other collections (`tasks`, `accounts`, `parts`, `sales`, …) still get the legacy `MISSING→[]` fill. **Only warranties is required in this packet.**

---

## 8. Test matrix and results

Command: `node test_laegh.js Sirman_Final.html`

```text
کل تست‌ها: 683
موفق: 683
ناموفق: 0
```

| Test | Input | Expected | Result |
|---|---|---|---|
| T1 | `{}` | FAIL missing warranties | PASS |
| T2 | `{warranties:null}` | FAIL | PASS |
| T3 | `{warranties:"invalid"}` | FAIL | PASS |
| T4 | `{warranties:[]}` | PASS structurally; not missing | PASS |
| T5 | `{warranties:[{id:'W-TEST',...}]}` | PASS structurally | PASS |
| T6 | other sections, no warranties key | restore blocked | PASS |
| T7 | `warranties=[]` then migrate | still present `[]`; merge may continue | PASS |
| T8 | failed validation | zero `sv` / `svWarr` / snapshot / `auditOk` / `localStorage` | PASS |
| T9 | migrateBackup on missing key | does not create `[]` | PASS |
| T10 | merge + replace + selective both modes | blocked before mutation | PASS |

Also updated:

- Old v2 “restore without warranties” test now asserts **fail-closed**, not empty-array success
- `BackupEngine.validate` / `testRestore` fixtures include `warranties:[]` when they must PASS
- Network pull prepare rejects packages missing `warranties`

`Laegh_Final.html` is byte-identical to `Sirman_Final.html`; suite was run on `Sirman_Final.html`.

---

## 9. Confirmations

| Constraint | Status |
|---|---|
| Live shop data unchanged | **YES** — no shop JSON/localStorage/ls2 was opened or written |
| Phonebook unchanged | **YES** — `savePBContact` and phonebook merge/normalize/`contact_id` not edited |
| SQLite unchanged | **YES** — no sqlite files, dual-write, or SoT change in this commit |
| Git/data migrations not performed | **YES** — no live migration, no backup rewrite, no data repair |
| `resetAll` unchanged | **YES** |
| Official backup format not redesigned | **YES** — only restore validation; export still writes `warranties` via `_safeArr` |

Working tree had unrelated P1 sqlite sidecars and prior forensic reports; they are **not** part of this commit.

---

## 10. Known limitations

1. **Only `warranties` is required.** `parts`, `sales`, `invoices`, `phonebook`, etc. can still be coerced to `[]` by `migrateBackup`.
2. **Legacy v2 backups without a `warranties` key can no longer restore** until the file explicitly contains `"warranties": []` or real records. This overrides قانون ۴ “old backups restore without crash” **for this required key only**, by explicit packet order (fail-closed).
3. Record-level check is structural (object items only). It does not enforce every `SCHEMAS.warranties` field and does not mutate records.
4. `validateBackupPackage` alone is still weak if called in isolation; restore/test/BackupEngine.validate go through the new layer.
5. `verifyLayerPayload` still uses `validateBackupPackage` so incomplete layer fixtures are not blocked here (layer recording ≠ restore apply).
6. No shop Windows disk / G1 backup files were present; no live restore was attempted (forbidden).

---

## 11. Next safe implementation step

Do **not** start Phonebook recovery, G2 classification of shop files, SQLite cutover, or `resetAll` changes.

Next **safe** task after this gate:

1. Extend `REQUIRED_BACKUP_COLLECTIONS` the same way (one collection at a time: e.g. `invoices` / `phonebook` / `sales`) with the same MISSING≠EMPTY tests, **or**
2. Offline G2 backup classifier **only after G1 files are actually present**.

This packet is a **safety barrier**, not a recovery operation. Recovery remains blocked until G1 PASS.

---

## Evidence

- `node test_laegh.js Sirman_Final.html` → 683/683 PASS (2026-09-04)
- HTML diff confined to BackupEngine + restore/migrate gates
- No `savePBContact` / SQLite / `resetAll` edits
