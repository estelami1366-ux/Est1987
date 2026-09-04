# SIRMAN — P1C-3 Fail-Closed Backup/Restore Validator (`sales`, Decision B)

**Date:** 2026-09-04  
**Packet:** CODE-ONLY. Version-aware required collection. No live shop data, Phonebook, SQLite, reset, or backup rewrites.  
**Product version left unchanged:** `1405.6.3α`  
**Branch:** `cursor/p1c3-sales-schema1-fail-closed-fa01`  
**Base:** `cursor/p1c2-invoices-fail-closed-validator-fa01` (P1C-1 warranties + P1C-2 invoices PASS)  
**Decision:** **B** — `sales` is mandatory only from `schemaVersion >= 1`. Schema 0 may omit it.

---

## Phase 3 Change Gate

```text
CHANGE: P1C-3 add schema-aware sales fail-closed (schema >= 1 only)
CLASS: Safety bugfix of existing BackupEngine
Q1: CAPABILITY — restore integrity gate only
Q2: RunBusiness / Host / Core: NO
Q3: Persistence: YES — validation + schema-0 compatibility fill for sales only
    Live SoT not mutated by this patch
Q4: Printing: NO
Q5: HTML-only: PRESERVED
Q6: New transport/DB/ACL: NO
RESULT: PASS
AUTHORITY: explicit user packet P1C-3 IMPLEMENT DECISION B 2026-09-04
```

---

## 1. Decision B evidence

Full exporter `_buildFullBackupData` always emits `sales: _safeArr(sales)` and counts `itemCounts.sales`. `getBackupSectionDefs()` includes `{key:'sales'}`. Current `SIRMAN_SCHEMA_VERSION = 1`. Files without `schemaVersion` / without `manifest.schemaVersion` infer **schema 0**.

Historical fixtures that **intentionally omit** `sales`:

- `version:'2.0'` (tests note parts/warranties/sales may be absent)
- `version:'7.0'`
- `version:'10.3.29'` BackupEngine `oldPkg` (invoices/phonebook/warranties, no sales)

Intended omit semantics on those files: the collection was not part of that backup era → migrate logged `🛒 فروش: خالی (نسخه قدیمی)` and filled `[]`. That is **not** the same as a current schema-1 full package dropping the key.

Before this packet, `migrateBackup` did `if (!d.sales) d.sales = []` for every version. Merge used `(d.sales||[]).forEach` (silent no-op). Replace used `Array.isArray(d.sales) ? d.sales : []` (could wipe live sales). A schema-1 package that omitted `sales` could therefore look like a successful restore while replacing live sales with `[]` or skipping the section.

**Why not Decision A:** schema 0 fixtures and قانون ۴ require old backups without a `sales` key to remain restorable.

**Why not Decision C:** exporter, schema defs, fixtures, and migrate comments are enough to draw a hard line at schema ≥ 1.

---

## 2. Schema / version compatibility table

| Version / Schema | sales required? | Missing allowed? | Reason |
|---|---|---|---|
| Schema 0 / no `schemaVersion` (`v2.0`, `7.0`, `10.3.29`) | NO | YES | Explicit old-version fill; fixtures omit `sales` |
| Schema ≥ 1 (current full `SIRMAN_BACKUP`) | YES | NO | Exporter always emits `sales`; MISSING ≠ EMPTY |
| Partial export omitting `sales` with schema ≥ 1 | YES (whole-package gate) | NO | Same package-level gate as warranties/invoices |
| Schema 0 `sales=[]` or records | n/a (present) | n/a | Valid; no extra requirement |

Warranties (P1C-1) and invoices (P1C-2) remain required for **all** supported versions. This packet does not weaken them.

---

## 3. Exact implementation

Always-required registry is unchanged:

```javascript
var REQUIRED_BACKUP_COLLECTIONS = ['warranties', 'invoices'];
var REQUIRED_BACKUP_COLLECTIONS_FROM_SCHEMA = { 1: ['sales'] };
```

`requiredBackupCollectionsFor(d)` infers schema first (`inferBackupSchemaVersion` / `schemaVersion` / `manifest.schemaVersion`), then appends `sales` when `ver >= 1`.

`validateRequiredBackupCollections` loops that version-aware list:

| Schema | Input | Result |
|---|---|---|
| ≥ 1 | key absent | FAIL (`missingRequiredCollections`) |
| ≥ 1 | `null` | FAIL (`invalidCollections`) |
| ≥ 1 | non-array | FAIL (`invalidCollections`) |
| ≥ 1 | `[]` | PASS |
| ≥ 1 | array of objects | PASS |
| 0 | key absent | PASS for `sales` (warranties/invoices still required) |

**Schema 0 compatibility conversion (cannot affect schema ≥ 1):**

1. Isolated / pre-schema `migrateBackup`: if inferred schema `< 1` and `!d.sales`, assign `d.sales = []` and log `خالی (نسخه قدیمی)`.
2. `SCHEMA_MIGRATIONS` 0→1 only: if `!d.sales`, assign `[]` and log that this conversion is schema-0 compatibility. Files that already declare `schemaVersion >= 1` never enter this step, so a missing schema≥1 key cannot be manufactured into `[]`.

`migrateBackup` for schema ≥ 1: missing/null/non-array → fail-closed log, **no** `d.sales = []`.

---

## 4. Exact files / functions changed

| File | Change |
|---|---|
| `Sirman_Final.html` | Schema-aware registry + 0→1 sales fill + migrate/merge/network |
| `Laegh_Final.html` | Byte-sync of the same HTML |
| `test_laegh.js` | P1C-3 T1–T15 + migrate schema≥1 guard; extractor includes schema map; one schema-1 network fixture gained `sales:[]` |
| `deliveries/Reports/BACKUP_FAIL_CLOSED_VALIDATOR_P1C3_2026-09-04.md` | This report |

| Function | Change |
|---|---|
| `REQUIRED_BACKUP_COLLECTIONS` | Unchanged `['warranties', 'invoices']` |
| `REQUIRED_BACKUP_COLLECTIONS_FROM_SCHEMA` | New `{ 1: ['sales'] }` |
| `inferRequiredBackupSchemaVersion` | New; prefers `inferBackupSchemaVersion` |
| `requiredBackupCollectionsFor` | New; always-required + schema map |
| `validateRequiredBackupCollections` | Uses `requiredBackupCollectionsFor(d)` |
| `SCHEMA_MIGRATIONS` 0→1 | Schema-0-only `sales=[]` compatibility fill |
| `migrateBackup` | Schema ≥ 1 fail-closed; schema 0 keeps `!d.sales → []` |
| `applyBackupMergeSections` | Iterate `sales` only if `Array.isArray` (no `\|\|[]`) |
| `applyBackupReplaceSections` | Still `Array.isArray ? assign : []` after assert (schema ≥ 1 never reaches the else) |
| `prepareNetworkWorkspacePull` | Helper-missing fallback uses `requiredBackupCollectionsFor` when present |
| `assertRequiredBackupCollections` / `importData` / `applyBackupSelective` / `testRestoreBackup` / `BackupEngine.validate` | Same call sites; now version-aware |

Not changed: `savePBContact`, phonebook merge block, `resetAll`, SQLite, print, Host/Core, warranties/invoices coerce paths.

---

## 5. Validation-before-mutation proof

Schema is determined **before** the required-collection loop (`inferRequiredBackupSchemaVersion` inside `requiredBackupCollectionsFor`).

```text
Parse / decrypt
  → infer schemaVersion
  → validateRequiredBackupCollections   ← warranties + invoices; sales if schema ≥ 1
  → applySchemaMigrations               ← 0→1 may fill sales=[] ONLY when from===0
  → migrateBackup                       ← schema ≥ 1 cannot invent sales=[]
  → preview
  → applyBackupSelective assert         ← before safety snapshot / pre-restore audit
      → merge / replace assert          ← before sv() / live assignment
```

On schema ≥ 1 missing `sales`, T8/T9/T10 show: merge throw, replace throw, `sv=0`, `svSales=0`, snapshot=0, auditOk=0, localStorage writes=0.

`importData` still calls `validateRequiredBackupCollections` before `applySchemaMigrations` / `migrateBackup`. `prepareNetworkWorkspacePull` validates before `migrateBackup`.

---

## 6. Test matrix

| Test | Contract | Result |
|---|---|---|
| T1 | schema 1 + missing sales → FAIL | PASS |
| T2 | schema 1 + `sales:null` → FAIL | PASS |
| T3 | schema 1 + wrong type → FAIL | PASS |
| T4 | schema 1 + `sales=[]` → PASS | PASS |
| T5 | schema 1 + valid records → PASS | PASS |
| T6 | schema 0 + missing sales → PASS compatibility | PASS |
| T7 | schema 0 + valid sales → PASS | PASS |
| T8 | schema 1 missing + Merge blocked | PASS |
| T9 | schema 1 missing + Replace blocked | PASS |
| T10 | schema 1 validation failure → zero mutation | PASS |
| T11 | `10.3.29` fixture without sales remains compatible (validator + migrate `[]` + 0→1 fill + merge) | PASS |
| T12 | warranties missing still FAIL | PASS |
| T13 | invoices missing still FAIL | PASS |
| T14 | `warranties=[]` still PASS | PASS |
| T15 | `invoices=[]` still PASS | PASS |
| extra | `migrateBackup` schema ≥ 1 missing sales does not create `[]` | PASS |

---

## 7. Full-suite result

`node test_laegh.js Sirman_Final.html`

```text
کل تست‌ها: 709
موفق: 709
ناموفق: 0
```

Previous P1C-2 baseline was 693/693. This packet added 16 tests (T1–T15 + migrate guard). Log: `/opt/cursor/artifacts/p1c3-test-suite.log`.

---

## 8. Regression results

### Warranties (P1C-1)

P1C T1–T10 all PASS. T12 P1C-3: schema 1 package with `invoices:[]` + `sales:[]` but no warranties still FAIL; replace still blocked.

### Invoices (P1C-2)

P1C-2 T1–T10 all PASS. T13 P1C-3: schema 1 package with `warranties:[]` + `sales:[]` but no invoices still FAIL; merge still blocked.

T14/T15: explicit `[]` for warranties and invoices still PASS on schema 0 and on schema 1 (with `sales=[]`).

---

## 9. Confirmation of zero live-data mutation

**YES.** No shop JSON, no runtime localStorage of a live installation, no restore against real data. Tests use in-memory sandboxes. T10 asserts zero `sv` / snapshot / audit-ok / localStorage on validation failure.

---

## 10. Confirmation Phonebook unchanged

**YES.** `savePBContact` and the phonebook merge/replace blocks were not edited in this packet.

---

## 11. Confirmation SQLite unchanged

**YES.** No SQLite schema, candidate DB, or migration files were committed.

---

## 12. Known limitations

1. `parts`, `accounts`, `tasks`, `products`, `phonebook` are still not required.
2. Schema 0 missing `sales` still becomes `[]` in `migrateBackup` and in SCHEMA 0→1. That is documented compatibility, not fail-closed.
3. Partial schema ≥ 1 packages that omit `sales` cannot restore (whole-package gate). Explicit `"sales": []` is the empty form.
4. Record check is structural (object items), not full sale schema (`status` / `saleUid` completeness is still migrate’s job when the array exists).
5. `(d.sales||[])` remains on sale-number / `saleUid` walks inside `migrateBackup` (read-only; does not assign `d.sales = []`).
6. No live shop restore was run (forbidden).
7. Next collection is not started in this packet.

---

## 13. Next safe collection

Investigate **`parts`** the same way (explicit `🔩 قطعات: خالی (نسخه قدیمی)` fill + historical fixtures). Do **not** add it until a Decision A/B/C is evidenced. Do not bulk-update the registry. Do not start Phonebook recovery or SQLite.

---

## Evidence

- `node test_laegh.js Sirman_Final.html` → **709/709 PASS** (2026-09-04)
- Diff confined to BackupEngine version-aware registry + sales coerce/restore + tests + this report
- Live data / Phonebook / SQLite / reset untouched
