# SIRMAN — P1 SERVICES MIGRATION REPORT

## Candidate SQLite only — NO CANONICAL CUTOVER

**Mode:** Persistence infrastructure + services candidate import  
**Jalali:** 1405/06/02  
**Gregorian:** 24 August 2026  
**Exact time:** 20:16 Asia/Tehran  
**Timezone:** Asia/Tehran (+03:30)  
**Live version (unchanged):** `1405.5.27γ` / assembly `1405.5.27.3`  
**Authoritative ADR:** `deliveries/Reports/STORAGE_ARCHITECTURE_DECISION_RECORD.md` (`APPROVED FOR IMPLEMENTATION`)  
**Packet:** `SIRMAN_PERSISTENCE_P1_SERVICES_MIGRATION_220a.md`

```text
Product runtime behavior changed: NO
Canonical cutover: NO
Dual-write: NO
Database added: YES — CANDIDATE ONLY
HTML persistence: UNCHANGED
Host service reads: UNCHANGED
CurrentStorage.Kind: html-localStorage-indexeddb (UNCHANGED)
```

---

## Git

No reset / rebase / merge / cherry-pick. No branch switch.

```text
Branch:     cursor/p3-storage-forensic-audit-fa01
HEAD before:
            daadcd1c675b09ad5ace2b74b5e325913750faff
            (short: daadcd1)
            docs: storage architecture decision record (design only)
Checkpoint: P1-SERVICES-PRE-MIGRATION-GOOD = daadcd1
Worktree before edit: product-clean except untracked zip / pycache (not this slice)
Version:    1405.5.27γ / 1405.5.27.3
Date:       2026-08-24 / 1405/06/02
Time:       20:16 Asia/Tehran
Timezone:   Asia/Tehran (+03:30)
```

This slice adds a **candidate** SQLite assembly and read-only extraction/import tooling. Live UI authority remains HTML `localStorage` / RAM.

---

## Database

```text
Engine:           SQLite via Microsoft.Data.Sqlite 8.0.8
Database path (Windows target):
                  %AppData%\Sirman\data\sirman.sqlite
                  (CandidateStoragePaths.DefaultDatabasePath)
This Linux agent: no shop AppData / WebView2 session.
Evidence file:    deliveries/migration/P1-services/services.candidate.sqlite
Schema version:   1
Application:      1405.5.27γ
Migration version:1
WAL:              wal
Foreign keys:     ON
Busy timeout:     5000 ms
Integrity check:  ok
SHA-256:          5a2bdc0812a764f6e71ceac9047f2cebb7e171d31601522655203b1f848fe846
Size:             20480 bytes
```

`schema_info` singleton (`id = 1`):

| Field | Value |
|---|---|
| schema_version | 1 |
| application_version | 1405.5.27γ |
| migration_version | 1 |

Newer schema than `SqliteCandidateDatabase.SchemaVersion` → `STOP — BLOCKED`.  
Older schema → `STOP — BLOCKED` (no silent upgrade in this slice).  
Equal → continue.

Integrity failure on open → `STOP — BLOCKED`. No legacy fallback.

---

## Services

Live HTML default seed (`ls2` in `Sirman_Final.html` ~15335), four rows, **no `id`**, field `warr`:

| code | name | cat | price | warr |
|---|---|---|---|---|
| S001 | تعویض پره | مکانیکی | 150000 | no |
| S002 | تعمیر موتور | برقی | 300000 | no |
| S003 | تعویض گارانتی | گارانتی | 0 | yes |
| S004 | سرویس و نظافت | عمومی | 80000 | no |

Candidate DB after import (immutable read of the evidence file):

| service_id | code | name | cat | price | warr | json_extra | id_source |
|---|---|---|---|---|---|---|---|
| S001 | S001 | تعویض پره | مکانیکی | 150000 | no | `{}` | existing-code |
| S002 | S002 | تعمیر موتور | برقی | 300000 | no | `{}` | existing-code |
| S003 | S003 | تعویض گارانتی | گارانتی | 0 | yes | `{}` | existing-code |
| S004 | S004 | سرویس و نظافت | عمومی | 80000 | no | `{}` | existing-code |

```text
Legacy source count:     4
Candidate DB count:      4
ID parity:               YES
Code parity:             YES
Field parity:            YES
Hash parity:             YES
Aggregate hash source:   97c5c95643338d81fa5303b5c600c306ed766ed96bb30241c57a1746fbad1306
Aggregate hash DB:       97c5c95643338d81fa5303b5c600c306ed766ed96bb30241c57a1746fbad1306
Unknown-field preservation: YES (json_extra; proven by mapper + SQLite round-trip tests)
Generated IDs:           none on HTML seed (all existing-code)
```

`service_id` rule (implemented, not invented business logic):

```text
existing service.id  → use it          (id_source = existing-id)
else existing code   → use it          (id_source = existing-code)
else deterministic   → mig_svc_ + sha16 (id_source = generated-hash; reported)
```

`row_hash` / `id_source` are **migration metadata** columns (not catalog business fields). ADR business columns remain as specified.

---

## Migration

```text
Extraction:       read-only regex of HTML default ls2 JSON, or a JSON array fixture.
                  Does not write localStorage. Does not guess if ls2 is missing (STOP — BLOCKED).
Canonicalization: id/code/name/cat/price/warr mapped; unknown keys → json_extra.
                  Per-row SHA-256 over canonical JSON (sorted keys).
Import:           IServiceCandidateStore.ReplaceAll inside one SQLite transaction.
                  Live HTML store is not written.
Transaction:      BEGIN; DELETE services; INSERT rows; COMMIT.
Rollback:         any insert/constraint error → ROLLBACK; previous candidate rows remain.
                  Duplicate code/id fixture left the original 4 HTML-seed rows intact.
```

Core has **no** `Microsoft.Data.Sqlite` types. SQLite lives only in `Sirman.Persistence.Sqlite`.

Desktop Host (`Sirman.Desktop.csproj`) does **not** reference the persistence project and does **not** read services from SQLite.

---

## Candidate restore

Production Backup/Restore was **not** modified.

Candidate-only snapshot uses `SqliteConnection.BackupDatabase` (SQLite-safe), then staging file copy:

```text
Snapshot:         PASS (WAL checkpoint TRUNCATE, then SHA-256 of main file)
Staging restore:  PASS (file copy → open → integrity_check ok)
Integrity:        ok
Parity:           row count 4 and aggregate hash match snapshot
Production restore: NOT RUN / NOT TOUCHED
```

---

## Regression

```text
HTML tests:
  node test_laegh.js Sirman_Final.html
    645 / 645 PASS  (exit 0)
  node test_laegh.js Laegh_Final.html
    645 / 645 PASS  (exit 0)

Core tests:
  dotnet test desktop/Sirman.Core.Tests
    198 / 198 PASS  (includes 14 P1-focused tests)

Focused P1 tests:
  schema_info / WAL / FK / integrity
  corrupt file refuses (STOP / not a database)
  HTML ls2 extraction (4 seed rows)
  unknown-field json_extra preservation
  existing-id preferred over code
  generated-hash id reported when no id/code
  HTML-seed import parity (count / id / code / field / hash)
  unknown-field SQLite round-trip
  duplicate id/code transaction rollback
  schema newer than app refuses
  candidate snapshot + staging restore hash match
  CurrentStorage.Kind unchanged
  Desktop Host csproj does not reference Persistence.Sqlite
  WriteArtifacts → deliveries/migration/P1-services/
```

Existing tests were not weakened.

---

## Human verification

Shop Windows exe / WebView2 session is **not** available on this Linux agent. Comparison of live UI Services count vs candidate DB cannot be performed here.

```text
UI still legacy:     YES
SQLite canonical:    NO
Manual sample:       BLOCKED
  first / middle / last / warranty flag / price / unusual characters / extra fields
  → automated HTML-seed + extra-field fixture PASS
  → live shop UI sample BLOCKED
```

Human H2 (backup/restore warranty loss) remains **HIGH** and is **not** closed by this slice.

---

## Protected areas

```text
Print:                     UNCHANGED
Backup/Restore production: UNCHANGED
Inventory:                 UNCHANGED
Accounting:                UNCHANGED
Warranty:                  UNCHANGED
Persistence runtime:       UNCHANGED (still HTML localStorage / RAM)
Invoices / sales / products migration: NOT DONE
```

---

## Files changed

Product runtime HTML / Host: **none**.

Infrastructure (candidate only):

| Path | Role |
|---|---|
| `desktop/Sirman.Core/Data/Persistence/ServiceCatalogRecord.cs` | Record, extraction DTO, parity DTO, `CandidateStoragePaths` |
| `desktop/Sirman.Core/Data/Persistence/IServiceCandidateStore.cs` | Store contract (no SQLite types) |
| `desktop/Sirman.Core/Data/Persistence/ServiceRowHash.cs` | Canonical JSON + SHA-256 |
| `desktop/Sirman.Core/Data/Persistence/ServiceCanonicalMapper.cs` | id/code mapping + json_extra |
| `desktop/Sirman.Core/Data/Persistence/LegacyServiceCatalogExtractor.cs` | Read-only HTML/JSON extract |
| `desktop/Sirman.Core/Data/Persistence/ServiceParityChecker.cs` | Count / id / code / field / hash |
| `desktop/Sirman.Persistence.Sqlite/Sirman.Persistence.Sqlite.csproj` | New assembly; refs Core only |
| `desktop/Sirman.Persistence.Sqlite/SqliteCandidateDatabase.cs` | WAL / FK / busy / integrity / schema_info / services |
| `desktop/Sirman.Persistence.Sqlite/SqliteServiceCandidateStore.cs` | Transactional `ReplaceAll` |
| `desktop/Sirman.Persistence.Sqlite/SqliteCandidateBackup.cs` | Snapshot / staging restore / inspect |
| `desktop/Sirman.Persistence.Sqlite/ServicesCandidateMigrator.cs` | Extract → map → import TX → parity → artifacts |
| `desktop/Sirman.Core.Tests/P1ServicesMigrationTests.cs` | Focused P1 tests |
| `desktop/Sirman.Core.Tests/Sirman.Core.Tests.csproj` | ProjectReference to Persistence.Sqlite |
| `deliveries/migration/P1-services/services.source.json` | Extracted seed JSON |
| `deliveries/migration/P1-services/services.candidate.sqlite` | Candidate DB snapshot |
| `deliveries/migration/P1-services/services.parity.json` | Parity evidence |
| `deliveries/migration/P1-services/services.sha256` | SHA-256 of candidate DB |
| `deliveries/Reports/P1_SERVICES_MIGRATION_REPORT.md` | This report |

Not modified: `Sirman_Final.html`, `Laegh_Final.html`, `desktop/Sirman.Desktop/*`, `CurrentStorage.Kind`, print, production backup/restore.

Untracked and **not** part of this slice: `deliveries/Sirman_Setup_1405.5.27γ_NATIVE_PRINT.zip` (+ `.sha256`), `scripts/__pycache__/`.

---

## Rollback

```text
Live application remains on legacy storage.
Candidate SQLite file remains separate.
If candidate migration fails: keep/delete the artifact as evidence.
DO NOT TOUCH LEGACY DATA.
Checkpoint to restore this worktree to pre-P1 code: daadcd1
  (P1-SERVICES-PRE-MIGRATION-GOOD)
```

---

## Final

```text
Product runtime behavior changed: NO
Canonical cutover: NO
Dual-write: NO
Database added: YES — CANDIDATE ONLY
HTML services still read localStorage ls2: YES
Host reads services from SQLite: NO
localStorage services removed: NO

Final status: NEEDS HUMAN VERIFICATION
```

Automated HTML-seed parity is PASS. Live shop UI count/sample remains BLOCKED on this Linux VM.

STOP — WAIT FOR REVIEW.
