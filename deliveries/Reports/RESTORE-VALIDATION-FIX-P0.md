# SIRMAN — RESTORE VALIDATION FIX P0

**Date:** 1405/06/21 (2026-09-12)
**Mode:** IMPLEMENTATION
**Packet:** Restore validation fix P0
**Branch:** `cursor/restore-validation-fix-p0-fa01`
**Base:** `cursor/diagnostic-center-p3-ui-fault-fa01`
**Implementation commit:** `850f7a7137a6f5ba4cc833122b8d367db9d4c2c6`

```text
RESTORE VALIDATION FIX = COMPLETE
BACKUP FORMAT = UNCHANGED
REAL DATA TOUCHED = NO
RESTORE EXECUTED = NO
```

---

## 1. Root cause

`sectionChecksums` are djb2 of `JSON.stringify(section)` written at export.

The live restore gate re-validated those hashes **after** `migrateBackup` / `migrateRecord` had already:

- reordered object keys to schema-default order
- filled missing schema fields with defaults
- injected missing ids (`invoiceId`, `saleUid`, `accRef`, …)

The serialized in-memory section then differed from the original backup section even when the file itself was valid. The user-facing error `هش بخش <key> مطابقت ندارد` was a **validation bug**, not a corrupt backup and not a comparison against live shop data.

This matches `deliveries/Reports/RESTORE-VALIDATION-AUDIT-1405.6.16α.md`.

The apply-time path was the blocker:

`importData` portable check (original) → `migrateBackup` → confirm → `assertRequiredBackupCollections` → `validateBackupPortableIntegrity` on the **mutated** object → throw.

---

## 2. Files changed

| File | Change |
|---|---|
| `Sirman_Final.html` | Consume original `sectionChecksums` after a successful pre-migrate check; skip post-migrate re-check of those same hashes |
| `Laegh_Final.html` | Byte-identical copy of `Sirman_Final.html` |
| `test_laegh.js` | P0 A–E execution tests; keep all P1C-7 checksum/restore tests |
| `desktop/Sirman.Core.Tests/BackupDryRunTests.cs` | Lock: original hashes pass; post-migrate stringify differs; Core dry-run does not re-check original hashes |
| `deliveries/Reports/RESTORE-VALIDATION-FIX-P0.md` | This report |

Not changed: backup schema, backup finalize/export format, Inventory, Print, Diagnostic, Native Update, shop/user backups, SQLite, dual-write.

---

## 3. Exact validation-flow change

Required flow (now):

1. Parse the backup package.
2. Validate package structure (required collections + structural integrity).
3. Validate `sectionChecksums` against the **original parsed, unmodified** sections (`validateBackupPortableIntegrity` / `validateBackupSectionChecksums`).
4. On success, `consumeBackupSectionChecksums(d)` sets in-memory flag `_sirmanSectionChecksumsConsumed`.
5. Only then run `applySchemaMigrations` / `migrateBackup`.
6. Do **not** re-validate the original `sectionChecksums` after migration.

Call sites that consume after a successful original check, before field migrate:

- `importData`
- `testRestoreBackup`
- network-workspace prepare

`assertRequiredBackupCollections` still runs portable integrity. That keeps P1C-7 T11 fail-closed for **unconsumed** tampered packages (merge/replace called directly). After a successful import-time check, the same object is consumed, so apply no longer false-fails a valid full backup.

The consume flag is **not** a backup-format field:

- skipped by `attachSectionChecksums`
- excluded from SHA-256 payload so in-memory consume cannot break `verifyChecksum`
- not written by `_buildFullBackupData`
- Core `BackupCanonicalChecksum.IsExcludedKey` unchanged (on-disk exclusions remain `exportedAt` / `checksum` / `checksumAlgo` only)

Original `sectionChecksums` still describe the exported package. They are not treated as hashes of post-migration objects. No new post-migration hash concept was added.

---

## 4. Tests added/updated

Existing tests kept (not deleted):

- P1C-7 T8 valid `sectionChecksums`
- P1C-7 T9 mismatch fail-closed
- P1C-7 T10 missing `sectionChecksums` compatible
- P1C-7 T11 merge/replace throw on tamper; zero live mutation
- P1C-7 T12 legacy without checksums
- P1C-7 T3/T4/T6 SHA-256
- ARCH-12 `exportedAt` / `checksum` / `checksumAlgo` exclusions; `verifyChecksum` before `applySchemaMigrations`

Added HTML execution tests:

| Id | Proof |
|---|---|
| P0 A | Valid original section checksum passes **before** `migrateBackup` |
| P0 B | `migrateBackup` changes `JSON.stringify` (key order / defaults). Without consume, apply throws `هش بخش`. With consume, apply accepts and stored hashes stay the export values |
| P0 C | Tampering the original section before migrate fails portable check; merge/replace still throw |
| P0 D | Multi-section full backup (invoices, products, services, warranties, sales, parts, accounts, tasks, defectiveStock, warehouses) produces no `مطابقت ندارد` after consume + migrate |
| P0 E | P1C-7 T8–T12 source still present; `importData` / `testRestoreBackup` order is portable → consume → migrate |

Added Core:

- `BackupDryRunTests.ValidOriginalSectionChecksums_AreNotReCheckedAfterMigrate`

---

## 5. Test results

| Suite | Result |
|---|---|
| `node test_laegh.js Sirman_Final.html` | **1125 / 1125 PASS** (0 failed). Includes P0 A–E and all P1C-7 checksum/restore tests |
| `dotnet test desktop/Sirman.Core.Tests --filter FullyQualifiedName~Backup` | **433 / 433 PASS** |
| `dotnet test desktop/Sirman.Core.Tests -c Release` | **939 / 939 PASS** (previous 938; +1 Core lock) |

Logs:

- `/opt/cursor/artifacts/restore-validation-p0-html-tests.log`
- `/opt/cursor/artifacts/restore-validation-p0-core-backup-tests.log`
- `/opt/cursor/artifacts/restore-validation-p0-core-tests.log`

No real restore was executed. No company backup file was opened, copied, or modified.

---

## 6. Build result

`dotnet build desktop/Sirman.Desktop/Sirman.Desktop.csproj -c Release`

**Build succeeded.** 0 error(s). Pre-existing warnings only (WindowsBase MSB3277, nullable CS8604 in Print host). Desktop sources were not edited.

Log: `/opt/cursor/artifacts/restore-validation-p0-desktop-build.log`

---

## 7. `git diff --check` result

```text
git diff --check
git diff --check 368c7ea HEAD
→ PASS (no whitespace errors)
```

---

## 8. Confirmation that backup format is unchanged

- No change to `magic`, `schemaVersion`, `manifest`, `itemCounts`, `sectionChecksums` write algorithm, or SHA-256 canonical exclusions on disk.
- `attachSectionChecksums` still hashes the same business keys with the same djb2 primitive.
- `_buildFullBackupData` is unchanged (ARCH-9D SHA lock still holds).
- `_sirmanSectionChecksumsConsumed` is restore-session memory only; it is never assembled into an exported package.

---

## 9. Confirmation that real data was not touched

- No restore / merge / replace against shop data.
- No read or write of the company backup file.
- No localStorage / user data mutation.
- Known-good installer zips were not rebuilt or overwritten.

---

## 10. Commit hash

Implementation (HTML + tests + Core lock):

`850f7a7137a6f5ba4cc833122b8d367db9d4c2c6`

This report is committed separately on the same branch; tip is recorded in the delivery status block after that commit.
