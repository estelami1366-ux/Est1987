# SIRMAN — P1C-2 Fail-Closed Backup/Restore Validator (`invoices`)

**Date:** 2026-09-04  
**Packet:** CODE-ONLY. One new required collection only. No live shop data, Phonebook, SQLite, reset, or backup rewrites.  
**Product version left unchanged:** `1405.6.3α`  
**Branch:** `cursor/p1c2-invoices-fail-closed-validator-fa01`  
**Base:** `cursor/p1c-fail-closed-warranties-validator-fa01` (P1C-1 warranties PASS)

---

## Phase 3 Change Gate

```text
CHANGE: P1C-2 add invoices to required-collection fail-closed registry
CLASS: Safety bugfix of existing BackupEngine (same as P1C-1)
Q1: CAPABILITY — restore integrity gate only
Q2: RunBusiness / Host / Core: NO
Q3: Persistence: YES — validation + migrateBackup coercion for invoices only
    Live SoT not mutated by this patch
Q4: Printing: NO
Q5: HTML-only: PRESERVED
Q6: New transport/DB/ACL: NO
RESULT: PASS
AUTHORITY: explicit user packet P1C-2 2026-09-04
```

---

## 1. Selected collection and exact reason

**Selected: `invoices`**

Ranked internally (not implemented except winner):

| Rank | Collection | Why not / why yes |
|---|---|---|
| done | `warranties` | P1C-1 |
| skip | `phonebook` | Frozen this packet |
| **1** | **`invoices`** | **Winner — see below** |
| 2 | `sales` | Same MISSING→[] but v2 tests omit the key; migrate logs «نسخه قدیمی» — broader قانون ۴ override |
| 3 | `parts` | Same «نسخه قدیمی» optional fill; not present in v2 fixtures |
| 4 | `accounts` | Existing test **requires** missing → `[]` |
| 5 | `products` | Quiet coerce like invoices, but catalog; invoices is first transactional section |
| 6 | `tasks` / `services` | Explicit old-version fill; dual `svcs` alias |

**Why `invoices` is mandatory (evidence, not guess):**

1. **Full backup schema:** `_buildFullBackupData` always emits `invoices: _safeArr(invoices)` as the first data array. `getBackupSectionDefs()` lists it first. `sections` in finalize always includes `invoices`.
2. **Silent loss / wipe:** `migrateBackup` did `if (!d.invoices) { d.invoices = []; }` with **no** «نسخه قدیمی» log (unlike sales/parts/accounts). Replace did `invoices = Array.isArray(d.invoices) ? d.invoices : []`. Merge did `(d.invoices||[]).forEach`. A missing key looked empty and could wipe or skip live invoices while restore reported success.
3. **Referential:** `invoiceId` / `num`, inventory qty, open-invoice tasks, account `accRef` payments depend on the invoices array remaining a real collection, not a coerced empty stand-in.
4. **Not already covered:** P1C-1 registry was `['warranties']` only.
5. **Narrow semantic change:** v2 fixtures in `test_laegh.js` **already include** `invoices`. Supported old backups are not the «field added later» class. `sales`/`parts`/`accounts`/`tasks` still keep legacy MISSING→[] (explicit old-version path + existing tests).

Partial export can still omit keys; P1C-1 already requires `warranties` on any restore package. P1C-2 uses the same whole-package gate for `invoices`. That is the existing fail-closed contract, not a new pipeline.

---

## 2. Previous behavior (`invoices`)

| Step | Behavior |
|---|---|
| Export | `_buildFullBackupData` always writes `invoices` via `_safeArr` (never omits on a full backup). Partial export may `delete` the key if not selected. |
| migrateBackup | `if (!d.invoices) { d.invoices = []; }` then `d.invoices.forEach` for ids / `invCtr` / `invoiceId` |
| MISSING → [] | **Yes** |
| null | Falsy → `[]` |
| Wrong type | `d.invoices.length` / `forEach` could throw or mis-count; replace used `Array.isArray ? x : []` |
| First restore consume | `applyBackupSelective` → replace/merge after snapshot |
| Merge without key | **Yes** — `(d.invoices\|\|[]).forEach` no-op, success message still possible |
| Replace without key | **Yes** — live `invoices = []` if that section is selected |
| References | invoiceId, inventory, tasks, accounts |

Warranties stayed fail-closed from P1C-1.

---

## 3. New behavior

Registry: `REQUIRED_BACKUP_COLLECTIONS = ['warranties', 'invoices']`

For `invoices` (same rules as warranties):

| Input | Result |
|---|---|
| key absent | FAIL (`missingRequiredCollections`) |
| `null` | FAIL (`invalidCollections`) |
| non-array | FAIL (`invalidCollections`) |
| `[]` | PASS structurally; key remains |
| array of objects | PASS structurally |

`migrateBackup` no longer assigns `d.invoices = []` when missing/null/non-array. Walks are `Array.isArray`-guarded.

Warranties rules unchanged.

---

## 4. Exact files / functions changed

| File | Change |
|---|---|
| `Sirman_Final.html` | Registry + migrate + replace/merge invoices + network fallback |
| `Laegh_Final.html` | Byte-sync |
| `test_laegh.js` | P1C-2 T1–T10; P1C warranties PASS fixtures also carry `invoices:[]`; extractor reads registry var |
| `deliveries/Reports/BACKUP_FAIL_CLOSED_VALIDATOR_P1C2_2026-09-04.md` | This report |

| Function | Change |
|---|---|
| `REQUIRED_BACKUP_COLLECTIONS` | `['warranties', 'invoices']` |
| `validateRequiredBackupCollections` | Fallback list includes `invoices`; still loops the registry |
| `migrateBackup` | No MISSING→[] for invoices; fail-closed log |
| `applyBackupReplaceSections` | `invoices = d.invoices` (no `: []`) after existing assert |
| `applyBackupMergeSections` | `d.invoices.forEach` (no `\|\|[]`) after existing assert |
| `prepareNetworkWorkspacePull` | Helper-missing fallback loops the registry |
| `assertRequiredBackupCollections` / `importData` / `applyBackupSelective` / `testRestoreBackup` / `BackupEngine.validate` | Unchanged call sites; they already use the registry |

Not changed: `savePBContact`, phonebook merge block, `resetAll`, SQLite, print, Host/Core.

---

## 5. Validator registry change

```javascript
// BEFORE (P1C-1)
var REQUIRED_BACKUP_COLLECTIONS = ['warranties'];

// AFTER (P1C-2)
var REQUIRED_BACKUP_COLLECTIONS = ['warranties', 'invoices'];
```

One new entry only. No bulk update.

---

## 6. Restore call-path protection

Same gate as P1C-1; it now fails if **either** required key is missing:

```text
Parse/decrypt
  → validateRequiredBackupCollections   ← warranties AND invoices
  → schema migrate / migrateBackup      ← cannot invent invoices:[]
  → preview
  → applyBackupSelective assert         ← before safety snapshot
      → merge / replace assert          ← before sv() / live assignment
```

Mutation still begins only inside replace/merge (`sv`, array assignment) and the IDB snapshot at the start of `applyBackupSelective`. Assert runs first.

---

## 7. Migration behavior

**Before:** `if (!d.invoices) { d.invoices = []; }` then unguarded `d.invoices.forEach` / `.length`.

**After:** absent / null / non-array → log `غایب/null/نوع نامعتبر — بدون جایگزینی [] (fail-closed)`; no key created. Array present (including `[]`) → existing `invCtr` / id / `invoiceId` walks.

`sales`, `parts`, `accounts`, `tasks`, `products` still use legacy MISSING→[] where they did before.

---

## 8. Tests / results

`node test_laegh.js Sirman_Final.html`

```text
کل تست‌ها: 693
موفق: 693
ناموفق: 0
```

| Test | Result |
|---|---|
| T1 missing invoices (`{warranties:[]}`) → FAIL | PASS |
| T2 `invoices:null` → FAIL | PASS |
| T3 `invoices:"invalid"` → FAIL | PASS |
| T4 `invoices:[]` + `warranties:[]` → PASS | PASS |
| T5 synthetic invoice object → PASS | PASS |
| T6 missing + Merge blocked, zero `sv` | PASS |
| T7 missing + Replace blocked | PASS |
| T8 selective failure → zero snapshot/auditOk/localStorage | PASS |
| T9 migrateBackup does not create `invoices:[]` | PASS |
| T10 warranties regression | PASS |

---

## 9. Regression result for warranties

P1C T1–T10 still PASS (T4/T5/T7 fixtures now also include explicit `invoices:[]` so a warranties-only empty array is not a false PASS against the expanded registry).

T10 P1C-2: missing `warranties` still FAIL; migrate still does not coerce missing warranties to `[]`; replace without warranties still blocked.

---

## 10. Confirmations

| Constraint | Status |
|---|---|
| Live shop data unchanged | **YES** — no shop JSON/localStorage written |
| Phonebook unchanged | **YES** — `savePBContact` / phonebook merge not edited |
| SQLite unchanged | **YES** |
| No reset modification | **YES** — `resetAll` not edited |
| Only one new required collection | **YES** — `invoices` only |

---

## 11. Known limitations

1. `sales`, `parts`, `accounts`, `tasks`, `products`, `phonebook` are still not required.
2. Partial backups that omit `invoices` cannot restore (same whole-package rule as warranties after P1C-1). Explicit `"invoices": []` is the empty form.
3. Record check is structural (object items), not full invoice schema.
4. `(d.invoices||[])` remains on invoiceUid walks inside migrate (read-only; does not assign `d.invoices = []`).
5. No live shop restore was run (forbidden).

---

## 12. Next safe step

Add **one** more collection with the same evidence test: next likely `sales` **only after** deciding that قانون ۴ old backups without a `sales` key must fail-closed (they currently have an explicit «نسخه قدیمی» fill). Do not bulk-update the registry. Do not start Phonebook recovery or SQLite.

---

## Evidence

- `node test_laegh.js Sirman_Final.html` → 693/693 PASS (2026-09-04)
- Diff confined to BackupEngine registry + invoices coerce/restore + tests + this report
