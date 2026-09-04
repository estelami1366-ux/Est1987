# SIRMAN — ARCH-3 Core Backup Schema Migration Extraction

**Date:** 2026-09-04  
**Packet:** Extract ONLY the pure HTML schema/field migration graph into `Sirman.Core`. Equivalence only. No live restore cutover.  
**Product version left unchanged:** `1405.6.3α`  
**Branch:** `cursor/arch-3-core-backup-migration-fa01`  
**Base:** `cursor/arch-2-core-backup-validator-fa01`  
**HTML engine file:** `Sirman_Final.html` **not modified**

---

## Phase 3 Change Gate

```text
CHANGE: ARCH-3 extract pure backup schema migration to Sirman.Core
CLASS: Extraction of existing verified BackupEngine schema/field migration
Q1: CAPABILITY — Core can migrate a backup DTO with the same 0→1 + field rules
Q2: RunBusiness / Host: NO (not wired). New types live in Sirman.Core/Backup only
Q3: Persistence: NO live SoT. Tests use synthetic JSON fixtures
Q4: Printing: NO
Q5: HTML-only: PRESERVED — HTML migrateBackup / applySchemaMigrations remain the restore engine
Q6: New transport/DB/ACL: NO
RESULT: PASS
AUTHORITY: explicit user packet ARCH-3 2026-09-04
```

ARCH-4 and P1C-8 were not started. Live cutover was not performed.

---

## 1. Complete migration graph

Live HTML `importData` / `testRestoreBackup` order (unchanged in this packet):

```text
parse JSON
  → unwrap/decrypt envelope
  → validateRequiredBackupCollections          (source-version rules)
  → validateBackupStructuralIntegrity
  → validateBackupPortableIntegrity
  → canRestoreSchema (too-new fails; no reverse migrate)
  → verifyChecksum
  → applySchemaMigrations                      (clone; SCHEMA_MIGRATIONS)
  → migrateBackup                              (field/compat; mutates its argument)
  → post-migrate itemCounts / preview / apply*
```

ARCH-3 extracts only the two boxed stages. Validators stay ARCH-2. Apply/merge/replace/reset/Phonebook live paths are not extracted.

```text
JsonNode input
  → CloneBackupData / CloneExact   (Core never mutates caller)
  → ApplySchemaMigrations          (0→1 only in this app)
  → MigrateBackup                  (field + compatibility)
  → SchemaMigrationResult { Ok, TooNew, From, To, Data, Log, Reason, Threw }
```

`BackupMigrator.MigratePackage` concatenates the two stages in the same order as `testRestoreBackup` / `importData` stage 3. It is **not** called from HTML.

### Schema step (only one)

| id | FROM | TO | When it runs |
|---|---|---|---|
| `add-package-manifest` | 0 | 1 | `inferBackupSchemaVersion(d) === 0` and target is `SIRMAN_SCHEMA_VERSION` (1) |

Schema ≥ 1 never enters this step. Schema 2 against app 1 returns `{ok:false, tooNew:true}` with reason:

`این بک‌آپ با Schema جدیدتر از این نسخه ساخته شده و بدون Migration معکوس باز نمی‌شود`

### Field stage (`migrateBackup`)

Runs after schema migration in the live pipeline. Core also exposes it alone so T3 can prove schema ≥ 1 missing required keys are **not** manufactured by field migrate.

Helpers used only by this graph (extracted):

| HTML | Role |
|---|---|
| `cloneBackupData` | `JSON.parse(JSON.stringify(d \|\| {}))` |
| `inferBackupSchemaVersion` | `schemaVersion` else `manifest.schemaVersion` else 0 |
| `inferRequiredBackupSchemaVersion` | production path = `inferBackupSchemaVersion` |
| `canRestoreSchema` | fileVer > appVer → fail |
| `collectAttachmentIndex` | warranties/sales/invoices `docs`/`attachments` |
| `buildBackupManifest` | package manifest object |
| `SCHEMA_MIGRATIONS` | 0→1 runner |
| `applySchemaMigrations` | loop + `Math.max(from, infer)` |
| `SCHEMAS` + `migrateRecord` + `migrateSection` | project arrays onto defaults; extra rec keys kept |
| `migrateBackup` | aliases, fail-closed gates, counters, ids, SCHEMAS |

`finalizeBackupPackage` / `attachSectionChecksums` / `attachChecksum` are **not** extracted (export-side, not import migration).

---

## 2. Schema/version matrix

App constant: `SIRMAN_SCHEMA_VERSION = 1`. `applicationVersion` / `d.version` (e.g. `2.0`, `1405.6.3α`) is **not** a schema number.

| Input | infer | Schema graph | Field graph |
|---|---|---|---|
| no `schemaVersion`, no manifest | 0 | 0→1 | sees schema 1 after combined; field-only uses 0 |
| `schemaVersion: 0` | 0 | 0→1 | field-only **keeps 0** (`null`/`''` → 1, but `0` is kept) |
| `manifest.schemaVersion: 1` only | 1 | no 0→1; writes root `schemaVersion: 1` | fail-closed for sales/parts/accounts |
| `schemaVersion: 1` | 1 | no 0→1 | fail-closed for sales/parts/accounts |
| `schemaVersion: 2` | 2 | too-new, no mutation beyond clone | not run in `MigratePackage` |

v2.0 files without `schemaVersion` are schema 0.

---

## 3. Every MISSING → [] compatibility case

Do not change these semantics. Core reproduces them.

| Collection | Schema 0 / legacy | Schema ≥ 1 | Where |
|---|---|---|---|
| `sales` | `if (!d.sales) d.sales = []` (JS falsy: missing/null/0/`false`/`""`; **empty array stays**) | log only; **no assign** | 0→1 **and** field-only if still schema 0 |
| `parts` | same | log only; no assign | same |
| `accounts` | same (v2.0 omit is the documented case) | log only; no assign | same |
| `tasks` | `if (!d.tasks) d.tasks = []` | **always** the same falsy fill | field only |
| `warranties` | **never** | **never** | field logs fail-closed |
| `invoices` | **never** | **never** | field logs fail-closed |
| `services`/`svcs` | if both falsy → `[]`/`[]`; alias the other if one exists | same | field |
| `phonebook` | empty/missing → `[]`, or convert `pb` | same | field (existing migrate behavior, not live `savePBContact`) |
| `defectiveStock`, `daqi`, `daqiWarehouse` | falsy → `[]` + log | same | field |
| `daqiVouchers`, `postalHistory` | falsy → `[]` (no log if filling) | same | field |
| `userAuditLog`, `bgAuditLog` | falsy → `[]` silent | same | field |
| `products` | falsy → `[]` | same | field |
| `inventory` | falsy → `{}` | same | field |
| `attachmentsIndex` | falsy → `collectAttachmentIndex(d)` | 0→1 only | schema 0→1 |
| `manifest` | falsy → `buildBackupManifest(...)` | 0→1 only | schema 0→1 |
| `magic` | falsy → `SIRMAN_BACKUP` | field also sets if still falsy | both |

JS falsy (not “missing only”): `null`, `0`, `false`, `""` are filled where `if (!d.x)` is used. `[]` and `{}` are truthy and are **not** replaced.

Because **importData runs 0→1 first**, a schema-0 file that omitted `sales` becomes schema 1 with `sales=[]` **before** field migrate. Combined `MigratePackage` keeps that order. Live restore still runs **validator on the source version first**, so a schema ≥ 1 file that omitted `sales` never reaches migration.

---

## 4. Exact functions/files extracted

Captured from `Sirman_Final.html` (unchanged). Mapping:

| HTML function / symbol | Line (approx.) | Core type |
|---|---|---|
| `SIRMAN_SCHEMA_VERSION` / `SIRMAN_BACKUP_MAGIC` | 7648–7649 | `BackupSchemaMigrations.AppSchemaVersion` / `Magic` |
| `inferBackupSchemaVersion` | 7653 | `BackupRequiredCollections.InferSchemaVersion` (ARCH-2, reused) |
| `canRestoreSchema` | 7665 | `BackupSchemaMigrations.CanRestoreSchema` |
| `buildBackupManifest` | 7673 | `BackupSchemaMigrations.BuildBackupManifest` |
| `collectAttachmentIndex` | 7709 | `BackupSchemaMigrations.CollectAttachmentIndex` |
| `cloneBackupData` | 7751 | `BackupJsonUtil.CloneBackupData` |
| `SCHEMA_MIGRATIONS` `add-package-manifest` | 8104 | `BackupSchemaMigrations.RunZeroToOne` |
| `applySchemaMigrations` | 8132 | `BackupSchemaMigrations.Apply` / `BackupMigrator.ApplySchemaMigrations` |
| `SCHEMAS` | 14016 | `BackupFieldMigrator` schema defaults |
| `migrateRecord` / `migrateSection` | 14034 / 14050 | `BackupFieldMigrator.MigrateRecord` / `MigrateSection` |
| `migrateBackup` | 14323 | `BackupFieldMigrator.RunInPlace` / `BackupMigrator.MigrateBackup` |
| combined order | 15094–15101, 8279–8283 | `BackupMigrator.MigratePackage` |

**Not extracted / not wired:** `_buildFullBackupData`, `applyBackupReplaceSections`, `applyBackupMergeSections`, `importData`, `resetAll`, Phonebook uniqueness / `savePBContact`, Host I/O, SQLite, `JsonBackupRepository` (still `TbdMarker = "html-backup-engine"`), `finalizeBackupPackage`.

HTML `migrateBackup` still mutates its argument. Core clones first (packet rule 5).

---

## 5. Core API

```csharp
SchemaMigrationResult BackupMigrator.ApplySchemaMigrations(JsonNode? data, int? targetVer = null)
SchemaMigrationResult BackupMigrator.MigrateBackup(JsonNode? data, long? nowMs = null)
SchemaMigrationResult BackupMigrator.MigratePackage(JsonNode? data, long? nowMs = null)
```

`SchemaMigrationResult`: `Ok`, `TooNew`, `From`, `To`, `Data` (clone), `Log`, `Reason`, `Threw`, `ErrorName`, `ErrorMessage`.

- Does not mutate the caller’s `JsonNode`
- No DOM / localStorage / IndexedDB / WebView2 / filesystem / Host
- `nowMs` freezes HTML `Date.now()` used for `mig_inv_*` / `mig_part_*` / `mig_war_*` / `mig_sale_*` / `mig_task_*`

---

## 6. Golden fixture count

**55** machine-readable rows in `desktop/Sirman.Core.Tests/BackupMigrationGolden.json`.

Generated from HTML functions via `generate-backup-migration-golden.js` with `Date.now` frozen at `1700000000000`.

Coverage:

- schema 0 → 1 (empty, missing sales/parts/accounts, v2.0, null/0/[] sales, attachments, origin/partial, disk/idb refs)
- schema ≥ 1 already-current, missing sales, null parts, manifest-only
- schema too-new (2)
- field-only fail-closed (T3) and schema-0 fills (T2)
- tasks always `[]`; tasks `{}` throws
- warranties/invoices never filled
- pb → phonebook; svcs → services (alias then SCHEMAS re-project — `pb`/`svcs` keep pre-projection objects)
- missing ids, sale `status:'final'`, invCtr / saleCtr / INVUID / SALEUID
- Persian / nested docs object map
- wrong-type throws: `sales` string, `invoices` object, `tasks` object
- combined package + twice (idempotence probe)
- validatorBefore / validatorAfter on each row (T13)

---

## 7. HTML/Core equivalence

**55/55** fixtures: `dataCanonical` (HTML `JSON.stringify`) equals Core `BackupJsJson.Stringify`. Logs match exactly, including Persian text and emoji.

No HTML was changed to make Core pass.

Insertion order is preserved (0→1 appends `magic`/`schemaVersion`/`sales`/`parts`/`accounts`/`attachmentsIndex`/`manifest` when missing). `migrateRecord` emits SCHEMAS key order then extra rec keys.

---

## 8. Input immutability evidence

Core T9: every golden input is stringified before and after `ApplySchemaMigrations` / `MigrateBackup` / `MigratePackage`. All equal.

HTML `applySchemaMigrations` already clones. HTML `migrateBackup` **does** mutate its argument; Core does not. Golden generator documents that difference.

---

## 9. Idempotence result

Do not assume idempotence. Measured with frozen `Date.now`:

| Fixture | Data second pass | Log second pass |
|---|---|---|
| `schema-twice-already-1` | identical | identical (empty) |
| `schema-twice-from-0` | identical | **not** identical (second pass has no 0→1 logs) |
| `field-twice-already-current` | identical | identical |
| `field-twice-missing-ids` | identical | **not** identical (ids already present; no “fixed N ids” log) |
| `package-twice-schema1-full` | identical | identical |
| `package-twice-schema0` | identical | **not** identical (0→1 logs only on first pass) |

Data idempotence holds for these fixtures when the clock is frozen. Log idempotence does **not** hold for first-time 0→1 or first-time missing-id assignment.

Without a frozen clock, missing-id strings would change every millisecond and data would not be idempotent.

---

## 10. Test counts

| Suite | Result |
|---|---|
| HTML `node test_laegh.js Sirman_Final.html` | **781/781 PASS** (778 previous + 3 ARCH-3 G1/G2/G3) |
| Core `dotnet test desktop/Sirman.Core.Tests -c Release` | **366/366 PASS** (301 previous + 65 ARCH-3) |
| ARCH-3 Core theory fixtures | 55/55 |
| ARCH-3 Core facts (T2, T3, T5, T8, T9, T10, T13, tasks/warranties, TBD repo, no UI types) | 10/10 |

T1–T14:

- T1 each known schema migration — golden schema-* + package-*
- T2 schema 0 legacy — `schema-0-*`, `field-schema0-*`, `package-schema0-legacy` / `package-v2`
- T3 schema ≥ 1 missing required not repaired — `field-schema1-missing-*`, `package-schema1-missing-sales-no-repair`
- T4 optional legacy collections — tasks/daqi/postal/phonebook empty
- T5 null handling — `schema-0-null-sales`, `field-schema1-null-sales`, `field-tasks-null`, `field-invoices-null`
- T6 wrong-type — throws on `(d.sales\|\|[]).forEach`, `d.tasks.forEach`, `(d.invoices\|\|[]).forEach`; object `parts` schema 0 logs `undefined مورد` and is not replaced
- T7 already-current
- T8 repeated migration
- T9 input immutability
- T10 deterministic output with `nowMs=1700000000000`
- T11 Persian / Unicode
- T12 nested structures / attachment index
- T13 migration + validator: schema ≥ 1 missing still INVALID after migrate; schema 0 omit VALID then filled
- T14 ARCH-2 validator golden still in the 366 Core tests

---

## 11. Regression counts

- ARCH-2 validator golden lock (HTML G1) still PASS
- Core `BackupValidatorTests` still PASS (included in 366)
- `JsonBackupRepository.TbdMarker` still `html-backup-engine`
- `Sirman_Final.html` diff: empty
- Phonebook live functions still present (`savePBContact`)
- `applyBackupMergeSections` / `applyBackupReplaceSections` / `_buildFullBackupData` / `resetAll` still present

---

## 12. No live cutover

`importData` still calls HTML `applySchemaMigrations` then HTML `migrateBackup`. It does not reference `BackupMigrator` / `MigratePackage`. HTML ARCH-3 G2 asserts this.

---

## 13. No live data change

No restore was executed. No shop data, localStorage, or backup files were rewritten. Tests use synthetic JSON only.

---

## 14. Phonebook unchanged

Live Phonebook uniqueness / `savePBContact` / merge were not edited. `migrateBackup`’s existing `pb` → `phonebook` conversion was **copied** into Core because it is part of the HTML migration function. After field migrate, `d.pb` remains the **pre-SCHEMAS** array; `d.phonebook` is the projected array (`socials:[]` etc.). That HTML quirk is preserved.

---

## 15. SQLite unchanged

`desktop/Sirman.Persistence.Sqlite` was not modified. `JsonBackupRepository` remains the TBD stub.

---

## 16. Known migration risks

1. **Production `Date.now()`** in missing-id assignment is non-deterministic. Core accepts `nowMs` for tests; live HTML still uses wall clock.
2. **`pb` / `svcs` alias then SCHEMAS reassignment** — JSON of `pb` ≠ JSON of `phonebook` after migrate (defaults added only on the projected copy). Same for `svcs` vs `services`.
3. **Truthy non-array `sales` / `invoices`** throw at `(d.sales\|\|[]).forEach` / `(d.invoices\|\|[]).forEach` even after the fail-closed log. Not silently repaired.
4. **Truthy non-array `tasks`** throw at `d.tasks.forEach`.
5. **Field-only on schemaVersion `0`** keeps `0`; combined path sets `1` via 0→1 first.
6. **Live safety depends on validator-before-migrate.** If a future caller ran `MigratePackage` without ARCH-2 validation, schema ≥ 1 missing `sales` would still not be filled — but schema 0 missing `sales` would be filled. That is current HTML combined behavior.
7. **Comment on `migrateRecord` is stale** (says extra keys are deleted; code copies all rec keys). Core follows the code, not the comment.
8. Isolated `test_laegh.js` helper `loadMigrateBackupFn` still omits `inferRequiredBackupSchemaVersion`. Golden/Core use the **production** function. Do not use that harness as the oracle.

---

## 17. Next safest extraction

Stop here. Do not start ARCH-4 / P1C-8 / live cutover.

Safest *next* extraction (not done): pure **export finalize** (`finalizeBackupPackage` + `attachSectionChecksums` + canonical SHA-256 attach) still without wiring restore — or a dry-run `testRestoreBackup` façade that composes ARCH-2 validate + ARCH-3 migrate and still does not call merge/replace.

---

## Final questions

**Q1. Is Core migration pure?**  
Yes. `Sirman.Core.Backup` only. No DOM, localStorage, IndexedDB, WebView2, filesystem, or Host.

**Q2. Does it mutate the input?**  
No. Core clones first. HTML `migrateBackup` still mutates; HTML `applySchemaMigrations` already cloned.

**Q3. Does it depend on browser/runtime state?**  
No. Optional `nowMs` replaces `Date.now()`.

**Q4. Does HTML output exactly match Core?**  
Yes. 55/55 golden `dataCanonical` + `log` match. Discrepancy protocol was not triggered.

**Q5. Which schema/version migrations exist?**  
Only **0→1** (`add-package-manifest`). Schema 2 is too-new (no reverse migrate). `d.version` is not a schema id.

**Q6. Where is MISSING → [] intentionally preserved?**  
Schema 0 / v2.0: `sales`, `parts`, `accounts` in 0→1 and in field-only while infer=0. Any schema: `tasks` and the optional collections listed in §3. Never: `warranties`, `invoices`. Schema ≥ 1: `sales`/`parts`/`accounts` are not filled.

**Q7. Can schema ≥ 1 missing required data bypass validation through migration?**  
Not in the live pipeline: `validateRequiredBackupCollections` runs **before** migrate (`importData` ~15039). Field migrate and 0→1 both refuse to invent `sales`/`parts`/`accounts` for schema ≥ 1. T3 golden: key still missing after field and after `MigratePackage`.

**Q8. Is migration idempotent?**  
Data: yes for the twice fixtures with frozen clock. Logs: not always (see §9). Do not claim general idempotence if ids are generated with wall-clock `Date.now()`.

**Q9. Was live Restore changed?**  
No.

**Q10. Did live data change?**  
No.

**Q11. Did Phonebook change?**  
Live Phonebook no. Migration copy of existing `pb` coerce only.

**Q12. Did SQLite change?**  
No (this packet). Unrelated sqlite sidecars in the working tree were not staged.

**Q13. What is the next safest extraction?**  
Export finalize / dry-run `testRestoreBackup` composition. Not merge/replace, not Host, not live cutover. Do not start ARCH-4 in this packet.
