# SIRMAN — ARCH-4 Core Backup Dry-Run Facade

**Date:** 2026-09-04  
**Packet:** Pure read-only Core façade composing ARCH-2 validation + integrity + ARCH-3 migration. Not a restore engine.  
**Product version left unchanged:** `1405.6.3α`  
**Branch:** `cursor/arch-4-core-backup-dry-run-fa01`  
**Base:** `cursor/arch-3-core-backup-migration-fa01`  
**HTML engine file:** `Sirman_Final.html` **not modified**

---

## Phase 3 Change Gate

```text
CHANGE: ARCH-4 Core backup dry-run façade
CLASS: Composition of existing verified Core BackupValidator + BackupMigrator
Q1: CAPABILITY — Core can dry-run validate+integrity+migrate without applying
Q2: RunBusiness / Host: NO (not wired)
Q3: Persistence: NO live SoT. Synthetic JSON only
Q4: Printing: NO
Q5: HTML-only: PRESERVED — importData / testRestoreBackup remain HTML
Q6: New transport/DB/ACL: NO
RESULT: PASS
AUTHORITY: explicit user packet ARCH-4 2026-09-04
```

Merge, Replace, Host bridge, JsonBackupRepository activation, Phonebook, resetAll, and SQLite were not started.

---

## 1. Architecture before / after

**Before**

```text
HTML importData / testRestoreBackup
  → HTML validators (P1C)
  → HTML verifyChecksum
  → HTML applySchemaMigrations + migrateBackup
  → apply merge/replace  (live)

Sirman.Core.Backup
  → BackupValidator (ARCH-2)     [extracted, not wired]
  → BackupMigrator  (ARCH-3)     [extracted, not wired]
```

**After (this packet)**

```text
Same live HTML path (unchanged)

Sirman.Core.Backup.BackupDryRunService.Run(JsonNode, nowMs?)
  → clone
  → BackupValidator.Validate          (ARCH-2, one implementation)
  → SHA-256 digest via BackupCanonicalChecksum (P1C-7 function, fail-closed if claimed)
  → if gates fail: INVALID, migration NotAttempted
  → BackupMigrator.MigratePackage     (ARCH-3, one implementation)
  → post: required collections + itemCounts only
  → DryRunResult (Applied=false always)
```

No second copy of required-collection rules, schema 0→1, or canonical hash.

---

## 2. API / classes created

```text
desktop/Sirman.Core/Backup/
  BackupDryRunModels.cs     BackupDryRunRequest/Result,
                            BackupIntegrityStatus { VALID, INVALID, NOT_VERIFIABLE },
                            BackupMigrationRunStatus { NotAttempted, Performed, Failed }
  BackupDryRunService.cs    Run(request) / Run(data, nowMs)

desktop/Sirman.Core.Tests/
  BackupDryRunGolden.json
  generate-backup-dryrun-golden.js
  BackupDryRunTests.cs
```

Overall status reuses `BackupValidationStatus`: **VALID**, **VALID_WITH_WARNINGS**, **INVALID**.  
`NOT_VERIFIABLE` is **not** a fourth overall status. It names the P1C-7 skipped-checksum integrity slice (`checksumAlgo` absent/`none`).

`Applied` is always `false`.

---

## 3. Pipeline ordering

Matches live compatibility (`importData` / `testRestoreBackup` gates):

```text
parse (caller)
  → source-version required collections     ⎤
  → structural (itemCounts, attachments, dups)⎥ BackupValidator
  → portable integrity (sectionChecksums, algo)⎥
  → SHA-256 digest compare if claimed         BackupCanonicalChecksum
  → schema too-new gate                       BackupMigrator.ApplySchemaMigrations
  → schema + field migration                  BackupMigrator.MigratePackage
  → post: required + itemCounts               justified by importData itemCounts-after-migrate
```

`validateBackupPackage` is **not** used after migrate. That HTML helper treats section hash mismatch as a **warning**, which would weaken P1C-7. Post-migration portable checksums are also not re-run, because field migrate changes records and would false-fail section hashes.

---

## 4. Validator composition

`BackupDryRunService` calls `BackupValidator.Validate` only. No duplicated `REQUIRED_BACKUP_COLLECTIONS` logic.

---

## 5. Migrator composition

Calls `BackupMigrator.MigratePackage` only (schema graph then field migrate). `nowMs` is injected; no hidden wall-clock in the façade. Migrator still owns `Date.now` default if `nowMs` is omitted.

---

## 6. Integrity composition

- Portable: `BackupPortableIntegrity.Validate` (via `BackupValidator`)
- Digest: `BackupCanonicalChecksum.Sha256Hex` vs stored `checksum` when claim is SHA-256 (HTML `verifyChecksum`)
- Unknown algo: already INVALID from portable
- Absent / `none`: `IntegrityStatus = NOT_VERIFIABLE`, overall can still be VALID (P1C-7 compatible)
- Digest mismatch: `IntegrityStatus = INVALID`, overall INVALID, **migration not attempted**

---

## 7. Pure dependency proof

- Namespace `Sirman.Core.Backup` only
- No DOM, localStorage, IndexedDB, WebView2, WinForms, `sirmanHost`, filesystem, FileReader
- Clock: optional `NowMs` on the request
- Hash: existing `SHA256.HashData` inside `BackupCanonicalChecksum`
- Tests assert the façade source references `BackupValidator.Validate` + `BackupMigrator.MigratePackage` and does not embed `SCHEMA_MIGRATIONS` / `REQUIRED_BACKUP_COLLECTIONS`

---

## 8. Golden fixtures

**22** rows in `BackupDryRunGolden.json` (T1–T18 plus extras T14b, T17b, T17c, too-new).

Captured from HTML validator + HTML migrator + Node SHA-256 of the same canonical string P1C-7 uses.

| Id | Role |
|---|---|
| T1-schema1-current-valid | T1 current schema≥1 |
| T2-schema0-legacy | T2 schema 0 |
| T3-schema0-missing-sales-parts-accounts | T3 schema 0 omit → migrate fills after gate |
| T4/T5/T6 schema1-missing-* | T4–T6 fail-closed, NotAttempted, no `[]` |
| T7/T8 missing warranties/invoices | always required |
| T9 itemCounts mismatch | INVALID, no migrate |
| T10 attachment broken | INVALID, no migrate |
| T11 duplicate identity | VALID_WITH_WARNINGS, migrate still runs |
| T12 valid SHA-256 | Integrity VALID |
| T13 invalid SHA-256 | Integrity INVALID, no migrate |
| T14 / T14b absent / none | NOT_VERIFIABLE compatible |
| T15 v2.0 | migration required, performed |
| T16 already-current | Required=false, field migrate still Performed |
| T17 null / array / MD5 | malformed / unknown algo |
| T18 Persian | Unicode preserved |
| T-schema-too-new | migration Failed, no reverse |

---

## 9. Test matrix

Core `BackupDryRunTests`: 22 golden theory + facts T3/T4/T11/T13/T14, immutability, TBD repo, no UI types, no second engine = **31**.

HTML: ARCH-4 G1/G2/G3 lock golden gate contract and no cutover.

---

## 10. Existing suite regression

| Suite | Result |
|---|---|
| HTML `node test_laegh.js Sirman_Final.html` | **784/784** (781 + 3 ARCH-4) |
| Core `dotnet test desktop/Sirman.Core.Tests -c Release` | **397/397** (366 + 31 ARCH-4) |

ARCH-2 validator and ARCH-3 migration goldens remain in that Core total.

---

## 11. Input immutability

Every golden fixture stringifies input before and after `Run`. Equal. Migrated `Data` is a different object; mutating it does not leak into the caller.

Validator clone and migrator clone are separate `CloneExact` calls.

---

## 12. Failure semantics

- Validation fail → `INVALID`, `MigrationStatus=NotAttempted`, `Data=null`
- Integrity fail (unknown algo, section mismatch, SHA-256 mismatch) → `INVALID`, no successful migration
- Checksum absent/none → integrity `NOT_VERIFIABLE`, overall VALID if structure ok
- Schema too-new → `Failed`, reason from `canRestoreSchema`, `Data=null`
- Schema ≥1 missing sales cannot become PASS via migrate (T4)

---

## 13. Confirmation

| Item | Status |
|---|---|
| HTML unchanged | Yes (`Sirman_Final.html` diff empty) |
| Live restore unchanged | Yes (`importData` still HTML; no `BackupDryRunService`) |
| Live data unchanged | Yes (dry-run only, `Applied=false`) |
| Phonebook unchanged | Yes |
| SQLite unchanged | Yes |
| `JsonBackupRepository` unchanged | Yes (`TbdMarker = html-backup-engine`) |

---

## 14. Known gaps

1. Envelope unwrap / decrypt is not in this façade (caller must pass parsed backup JSON).
2. Post-migrate does not run `validateBackupPackage` (deliberate: would weaken checksums to warnings).
3. SHA-256 digest is compared in the façade; ARCH-2 portable still does not compare digest by itself (one hash implementation, composed here).
4. Not wired to Host or HTML. Shop cannot call it yet.
5. Field migrate still runs on already-current packages (HTML does too); `MigrationRequired` is false when source schema ≥ 1.

---

## 15. Next safest extraction

Stop here. Do not start merge/replace/Host/SQLite.

Safest next: **Host-exposed read-only dry-run** (`sirmanHost` method that calls `BackupDryRunService` and returns diagnostics, still no apply) — or export `finalizeBackupPackage` extraction. Not live cutover.

---

## Final questions

**Q1. Does one Core facade now compose Validator + Integrity + Migration?**  
YES. `BackupDryRunService.Run` calls `BackupValidator.Validate`, `BackupCanonicalChecksum` digest compare, then `BackupMigrator.MigratePackage`.

**Q2. Is the facade pure?**  
YES. No DOM/localStorage/IDB/WebView2/Host/filesystem. Optional `NowMs` only.

**Q3. Does validation still happen before migration?**  
YES. Failed T4/T5/T6/T7/T8/T9/T10/T13 never set `MigrationPerformed`.

**Q4. Can invalid required-collection input reach successful migration?**  
NO. T4 schema≥1 missing `sales`: `NotAttempted`, `hasSales=false`, `Data=null`.

**Q5. Does integrity failure remain FAIL-CLOSED?**  
YES. T13 SHA-256 mismatch and unknown algo and section mismatch are INVALID with no migrate.

**Q6. Are checksum-absent/none compatibility semantics preserved?**  
YES. T14/T14b: integrity `NOT_VERIFIABLE`, overall VALID, migrate allowed.

**Q7. Is input immutable?**  
YES. Golden `inputUnchanged` + Core stringify before/after.

**Q8. Does HTML remain unchanged?**  
YES.

**Q9. Is live Restore still HTML-only?**  
YES. ARCH-4 G2.

**Q10. Did live data change?**  
NO.

**Q11. Did Phonebook change?**  
NO.

**Q12. Did SQLite change?**  
NO.

**Q13. What is the next safest extraction?**  
Read-only Host dry-run or export finalize. Not merge/replace and not live cutover.
