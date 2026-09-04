# SIRMAN — P1C-5 Fail-Closed Backup/Restore Validator (`accounts`, Decision B)

**Date:** 2026-09-04  
**Packet:** CODE-ONLY. One new schema-aware required collection. No live shop data, Phonebook, SQLite, reset, or backup rewrites.  
**Product version left unchanged:** `1405.6.3α`  
**Branch:** `cursor/p1c5-accounts-schema1-fail-closed-fa01`  
**Base:** `cursor/p1c4-parts-schema1-fail-closed-fa01`  
**Decision:** **B** — `accounts` is mandatory only from `schemaVersion >= 1`. Schema 0 / v2.0 may omit it.

---

## Phase 3 Change Gate

```text
CHANGE: P1C-5 add schema-aware accounts fail-closed (schema >= 1 only)
CLASS: Safety bugfix of existing BackupEngine
Q1: CAPABILITY — restore integrity gate only
Q2: RunBusiness / Host / Core: NO
Q3: Persistence: YES — validation + schema-0 compatibility fill for accounts only
    Live SoT not mutated by this patch
Q4: Printing: NO
Q5: HTML-only: PRESERVED
Q6: New transport/DB/ACL: NO
RESULT: PASS
AUTHORITY: explicit user packet P1C-5 2026-09-04
```

---

## 1. Candidates examined

Already required (not modified): `warranties`, `invoices` (all versions); `sales`, `parts` (schema ≥ 1).

Frozen / out of scope: Phonebook.

Remaining array collections from `_buildFullBackupData` / `getBackupSectionDefs`:

| Candidate | Examined |
|---|---|
| `accounts` | YES — selected |
| `tasks` | YES — not selected this packet |
| `products` | YES — not selected |
| `services` / `svcs` | YES — not selected (dual alias) |
| `defectiveStock`, `daqi*`, `warehouses`, logs | YES — later modules; weaker mandatory evidence |
| `inventory` | Object not array — would need a different validator contract |

---

## 2. Evidence for each

| Collection | A Full emit | B structurally required today | C MISSING→[] | D intentional legacy | E Merge if missing | F Replace if missing | G silent/destructive | H mandatory from | I historical omit fixtures |
|---|---|---|---|---|---|---|---|---|---|
| **`accounts`** | YES `_safeArr(accounts)` | NO before this packet | YES + «نسخه قدیمی» | **YES — named test v2.0 must return `accounts=[]`** | Skip unless `Array.isArray` (restore still succeeds) | YES `Array.isArray ? x : []` **wipes live balances** | YES (financial; shop bug «مالی برنمی‌گرده») | schema ≥ 1 | v2.0 fill test; `10.3.29` oldPkg |
| `tasks` | YES | NO | YES + «نسخه قدیمی» | **YES — named test v2.0 must return `tasks=[]`** | YES `(d.tasks\|\|[])` | YES wipe reminders | YES, lower impact | would be schema ≥ 1 | same v2.0 class |
| `products` | YES | NO | YES quiet, **no** «نسخه قدیمی» log | Mixed: v2 fixtures often include `products:[]`; `10.3.29` omits | YES `(d.products\|\|[])` | YES wipe catalog | YES | unclear vs catalog-optional | 10.3.29 omits |
| `services` | YES + `svcs` alias | NO | YES dual-key fill, no «نسخه قدیمی» | Alias `svcs` complicates MISSING | YES `d.services\|\|d.svcs\|\|[]` | YES dual fallback | YES | insufficient (two keys) | old backups may have only `svcs` |

**Decision A rejected for accounts/tasks:** would break the established v2.0 missing→[] tests.

**Decision B for accounts does not override those tests:** they run `migrateBackup` on `version:'2.0'` (schema 0). Schema 0 still fills `[]`. Schema ≥ 1 no longer does.

**Decision C rejected:** current full exporter always emits `accounts`; a schema-1 package omitting it is truncation, not a v2.0 backup. Same evidence class as sales/parts.

---

## 3. Selected collection

**`accounts`** — Decision B.

`tasks` left for a later packet (same schema-0 fill contract, lower destructive rank).

---

## 4. Schema / version rule

| Version / Schema | accounts required? | Missing allowed? | Reason |
|---|---|---|---|
| Schema 0 / `version:'2.0'` | NO | YES | Named test: missing → `[]`; «نسخه قدیمی» |
| Schema ≥ 1 | YES | NO | Full `SIRMAN_BACKUP` always emits `accounts` |
| Schema 0 `accounts=[]` or records | n/a | n/a | Valid when present |

Always-required unchanged: `warranties`, `invoices`.  
Schema ≥ 1 map: `sales`, `parts`, **`accounts`**.

Schema 0 missing `accounts` still becomes `[]` in isolated `migrateBackup` and in SCHEMA 0→1 only.

---

## 5. Previous behavior

Any version: `if (!d.accounts) { d.accounts = []; log «خالی (نسخه قدیمی)» }`.  
Merge: missing → skip (looks successful).  
Replace: missing → live `accounts = []` if section selected.

---

## 6. New behavior

**Schema ≥ 1:** MISSING / null / non-array → FAIL before migrate, preview, snapshot, merge, replace. `[]` and records → PASS. `migrateBackup` does not invent `accounts=[]`.

**Schema 0:** missing still PASS at validator; `migrateBackup` still produces `accounts=[]` (v2.0 test green). SCHEMA 0→1 documents the same fill.

Warranties / invoices / sales / parts unchanged. `tasks` not added.

---

## 7. Exact files / functions changed

| File | Change |
|---|---|
| `Sirman_Final.html` | Schema map + 0→1 accounts fill + migrateBackup branch |
| `Laegh_Final.html` | Byte-sync |
| `test_laegh.js` | P1C-5 T1–T15; schema-1 PASS fixtures also carry `accounts:[]` |
| `deliveries/Reports/BACKUP_FAIL_CLOSED_VALIDATOR_P1C5_2026-09-04.md` | This report |

| Function | Change |
|---|---|
| `REQUIRED_BACKUP_COLLECTIONS` | Unchanged |
| `REQUIRED_BACKUP_COLLECTIONS_FROM_SCHEMA` | `{ 1: ['sales', 'parts', 'accounts'] }` |
| `SCHEMA_MIGRATIONS` 0→1 | Schema-0-only `accounts=[]` |
| `migrateBackup` | Schema ≥ 1 fail-closed; schema 0 keeps `!d.accounts → []` |
| `applyBackupMergeSections` / `applyBackupReplaceSections` | Unchanged (already `Array.isArray` gated after assert) |

Not changed: Phonebook, `resetAll`, SQLite, tasks coerce, warranties/invoices/sales/parts branches.

---

## 8. Test matrix

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
| T11 v2.0 missing still → `accounts=[]`; 0→1 fill; merge schema 0 allowed | PASS |
| T12 warranties missing still FAIL | PASS |
| T13 invoices missing still FAIL | PASS |
| T14 sales/parts schema rules unchanged | PASS |
| T15 `tasks` not required; v2.0 tasks fill intact | PASS |

Existing named test still green: `migrateBackup روی بک‌اپ قدیمی بدون فیلد accounts نباید کرش کند و باید accounts=[] برگرداند`.

---

## 9. Full-suite result

`node test_laegh.js Sirman_Final.html`

```text
کل تست‌ها: 739
موفق: 739
ناموفق: 0
```

Previous P1C-4 baseline: 724/724. This packet added 15 tests.

---

## 10. Regression results

- **warranties:** P1C T1–T10 PASS; T12 P1C-5 FAIL on missing warranties.  
- **invoices:** P1C-2 T1–T10 PASS; T13 P1C-5 FAIL on missing invoices.  
- **sales:** P1C-3 PASS; T14 schema 0 omit still allowed; schema ≥ 1 omit still FAIL.  
- **parts:** P1C-4 PASS; T14 schema ≥ 1 omit still FAIL.  
- **tasks:** not in registry; v2.0 missing→`[]` still holds (T15).

---

## 11. Live data unchanged

**YES.** No shop JSON / live localStorage was read or written.

---

## 12. Phonebook unchanged

**YES.** `savePBContact` and phonebook merge/replace blocks were not edited.

---

## 13. SQLite unchanged

**YES.** No SQLite files were committed.

---

## 14. Known limitations

1. `tasks`, `products`, `services`, `defectiveStock`, `daqi*`, warehouse arrays are still not required.  
2. Schema 0 missing `accounts` still becomes `[]` (required compatibility).  
3. Partial schema ≥ 1 packages that omit `accounts` cannot restore (whole-package gate). Explicit `"accounts": []` is the empty form.  
4. Record check is structural (object items), not full ledger schema.  
5. No live shop restore was run (forbidden).  
6. P1C-6 not started.

---

## 15. Next safest step

Investigate **`tasks`** with Decision B only (schema ≥ 1 fail-closed, keep the named v2.0 missing→`[]` test). Do not use Decision A. Do not bulk-update the registry. Do not start Phonebook recovery or SQLite. **Do not start P1C-6 in this packet.**

---

## Evidence

- `node test_laegh.js Sirman_Final.html` → **739/739 PASS** (2026-09-04)
- Named v2.0 accounts fill test still PASS
- Diff confined to BackupEngine version-aware `accounts` + tests + this report
