# SIRMAN — P1C-4 Fail-Closed Backup/Restore Validator (`parts`, Decision B)

**Date:** 2026-09-04  
**Packet:** CODE-ONLY. One new schema-aware required collection. No live shop data, Phonebook, SQLite, reset, or backup rewrites.  
**Product version left unchanged:** `1405.6.3α`  
**Branch:** `cursor/p1c4-parts-schema1-fail-closed-fa01`  
**Base:** `cursor/p1c3-sales-schema1-fail-closed-fa01`  
**Decision:** **B** — `parts` is mandatory only from `schemaVersion >= 1`. Schema 0 may omit it.

---

## Phase 3 Change Gate

```text
CHANGE: P1C-4 add schema-aware parts fail-closed (schema >= 1 only)
CLASS: Safety bugfix of existing BackupEngine
Q1: CAPABILITY — restore integrity gate only
Q2: RunBusiness / Host / Core: NO
Q3: Persistence: YES — validation + schema-0 compatibility fill for parts only
    Live SoT not mutated by this patch
Q4: Printing: NO
Q5: HTML-only: PRESERVED
Q6: New transport/DB/ACL: NO
RESULT: PASS
AUTHORITY: explicit user packet P1C-4 2026-09-04
```

---

## 1. Candidate ranking

Inspected only source/tests/fixtures. All three candidates are emitted by `_buildFullBackupData` (`parts`, `tasks`, `accounts` via `_safeArr`) and listed in `getBackupSectionDefs()` / `SCHEMAS`.

| Rank | Collection | A emit | B currently required | C MISSING allowed | D coerce | E Merge if missing | F Replace if missing | G silent loss | H historical omit | I mandatory from | J legacy rule |
|---|---|---|---|---|---|---|---|---|---|---|---|
| **1** | **`parts`** | YES | NO (before this packet) | YES | `[]` + «نسخه قدیمی» | YES `(d.parts\|\|[])` | YES `Array.isArray ? x : []` (wipe live stock) | YES | v2.0 comment `parts/warranties/sales اصلاً ندارد`; `10.3.29` oldPkg | schema ≥ 1 | «نسخه قدیمی» fill; **no** dedicated missing→[] test |
| 2 | `accounts` | YES | NO | YES | `[]` + «نسخه قدیمی» | Skip unless `Array.isArray` (restore still succeeds) | YES wipe live balances | YES (financial) | v2.0 fixture | would be schema ≥ 1 | **Explicit test requires** v2.0 missing → `accounts=[]` |
| 3 | `tasks` | YES | NO | YES | `[]` + «نسخه قدیمی» | YES `(d.tasks\|\|[])` | YES wipe reminders | YES (lower impact) | v2.0 fixture | would be schema ≥ 1 | **Explicit test requires** v2.0 missing → `tasks=[]` |

Priorities applied:

1. All three always emitted on current full backup.  
2. Destructive restore: accounts (money) ≥ parts (stock) > tasks.  
3. All three still coerce.  
4. **Fewest compatibility complications: `parts`** — accounts/tasks have tests that *must* keep schema-0 fill.  
5. Fixtures: v2.0 explicitly documents missing `parts`; same 10.3.29 package used for sales Decision B.

**Not selected:** `accounts` / `tasks` — evidence for schema-0 optionality is *stronger* (dedicated fill tests), so they are not the next cheapest fail-closed collection.

---

## 2. Selected collection

**`parts`**

---

## 3. Evidence

1. Full exporter always writes `parts: _safeArr(parts)` and `itemCounts.parts`.  
2. Current schema includes `SCHEMAS.parts` and section `{key:'parts'}`.  
3. `migrateBackup` did `if (!d.parts) { d.parts = []; log.push('🔩 قطعات: خالی (نسخه قدیمی)'); }` then unguarded `d.parts.forEach`.  
4. Replace: `parts = Array.isArray(d.parts) ? d.parts : []` can replace live inventory with `[]` while restore reports success.  
5. Merge: `(d.parts||[]).forEach` no-op looks like a successful merge.  
6. Referential: sales consume part qty; warranty/sale reversal restocks `parts`.  
7. Schema 1 current packages are not in the «feature did not exist» class; omitting `parts` there is truncation, not قانون ۴.

---

## 4. Historical compatibility

| Fixture | Omits parts? | Intended semantics |
|---|---|---|
| `version:'2.0'` (test comment: parts/warranties/sales absent) | YES | Feature/collection not in that era → fill `[]` |
| `version:'7.0'` userRoles fixture | YES | Same schema-0 class |
| `version:'10.3.29'` BackupEngine `oldPkg` | YES | Schema 0; invoices/phonebook/warranties only |

Unlike accounts/tasks, **no test asserts** that missing `parts` must become `[]` as the success criterion of a named case — but migrate still did that fill, and T11 preserves it for schema 0.

---

## 5. Version / schema rule

| Version / Schema | parts required? | Missing allowed? | Reason |
|---|---|---|---|
| Schema 0 / no `schemaVersion` | NO | YES | «نسخه قدیمی»; v2.0 / 10.3.29 omit the key |
| Schema ≥ 1 | YES | NO | Current full `SIRMAN_BACKUP` always emits `parts` |
| Schema 0 `parts=[]` or records | n/a | n/a | Valid when present |

Always-required (unchanged): `warranties`, `invoices`.  
Schema ≥ 1 map: `sales`, **`parts`**.

Schema 0 missing `parts` still becomes `[]` in isolated `migrateBackup` and in SCHEMA 0→1 only. Files that already declare `schemaVersion >= 1` never enter 0→1, so they cannot get manufactured `[]`.

---

## 6. Before / after behavior

**Before:** any version, missing/null/falsy `parts` → `[]`; merge continues; replace can wipe.

**After (schema ≥ 1):**

| Input | Result |
|---|---|
| key absent | FAIL |
| `null` | FAIL |
| non-array | FAIL |
| `[]` | PASS |
| records | PASS |

Validation still runs before migrate, preview, snapshot, merge, replace, mutation.

**After (schema 0):** missing `parts` remains compatible; fill `[]` documented as legacy conversion only.

Warranties / invoices / sales rules unchanged.

---

## 7. Exact files / functions changed

| File | Change |
|---|---|
| `Sirman_Final.html` | Schema map + 0→1 parts fill + migrate/merge |
| `Laegh_Final.html` | Byte-sync |
| `test_laegh.js` | P1C-4 T1–T15; schema-1 PASS fixtures also carry `parts:[]` |
| `deliveries/Reports/BACKUP_FAIL_CLOSED_VALIDATOR_P1C4_2026-09-04.md` | This report |

| Function | Change |
|---|---|
| `REQUIRED_BACKUP_COLLECTIONS` | Unchanged `['warranties','invoices']` |
| `REQUIRED_BACKUP_COLLECTIONS_FROM_SCHEMA` | `{ 1: ['sales', 'parts'] }` |
| `SCHEMA_MIGRATIONS` 0→1 | Schema-0-only `parts=[]` |
| `migrateBackup` | Schema ≥ 1 fail-closed; schema 0 keeps `!d.parts → []`; `Array.isArray` before id walk |
| `applyBackupMergeSections` | Iterate parts only if `Array.isArray` |
| `applyBackupReplaceSections` | Unchanged `Array.isArray ? assign : []` after assert |

Not changed: Phonebook, `resetAll`, SQLite, warranties/invoices/sales coerce branches (sales still schema-aware as P1C-3).

---

## 8. Tests

| Test | Result |
|---|---|
| T1 schema 1 missing → FAIL | PASS |
| T2 `null` → FAIL | PASS |
| T3 wrong type → FAIL | PASS |
| T4 `[]` → PASS | PASS |
| T5 valid records → PASS | PASS |
| T6 schema 0 missing → PASS | PASS |
| T7 Merge blocked | PASS |
| T8 Replace blocked | PASS |
| T9 zero mutation | PASS |
| T10 migrate cannot coerce schema ≥ 1 missing → `[]` | PASS |
| T11 `10.3.29` without parts remains compatible | PASS |
| T12 warranties missing still FAIL | PASS |
| T13 invoices missing still FAIL | PASS |
| T14 schema 0 missing sales still PASS | PASS |
| T15 schema 1 missing sales still FAIL | PASS |

---

## 9. Full-suite result

`node test_laegh.js Sirman_Final.html`

```text
کل تست‌ها: 724
موفق: 724
ناموفق: 0
```

Previous P1C-3 baseline: 709/709. This packet added 15 tests.

---

## 10. Regression

- **warranties:** P1C T1–T10 PASS; T12 P1C-4 FAIL on missing warranties.  
- **invoices:** P1C-2 T1–T10 PASS; T13 P1C-4 FAIL on missing invoices.  
- **sales:** P1C-3 T1–T15 PASS; T14 schema 0 omit still allowed; T15 schema ≥ 1 omit still FAIL.

---

## 11. Live data unchanged

**YES.** No shop JSON/localStorage of a live installation was read or written.

---

## 12. Phonebook unchanged

**YES.** `savePBContact` and phonebook merge/replace blocks were not edited.

---

## 13. SQLite unchanged

**YES.** No SQLite files were committed.

---

## 14. Next safest step

Investigate **`accounts`** with the same Decision A/B/C gate. It has a **named test** that v2.0 missing must become `[]`, so it is almost certainly Decision B (schema ≥ 1 only) if selected — not Decision A. Do **not** start P1C-5 in this packet. Do not bulk-update the registry. Do not start Phonebook recovery or SQLite.

---

## Evidence

- `node test_laegh.js Sirman_Final.html` → **724/724 PASS** (2026-09-04)
- Diff confined to BackupEngine version-aware `parts` + tests + this report
