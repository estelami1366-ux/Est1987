# SIRMAN — ARCH-2 Core Backup Validator Extraction

**Date:** 2026-09-04  
**Packet:** Extract the pure HTML backup validation graph into `Sirman.Core`. Equivalence only. No live restore cutover.  
**Product version left unchanged:** `1405.6.3α`  
**Branch:** `cursor/arch-2-core-backup-validator-fa01`  
**Base:** `cursor/arch-1-backup-restore-extraction-audit-fa01`  
**HTML engine file:** `Sirman_Final.html` **not modified**

---

## Phase 3 Change Gate

```text
CHANGE: ARCH-2 extract pure backup validator to Sirman.Core
CLASS: Extraction of existing verified BackupEngine validators (P1C-1..P1C-7)
Q1: CAPABILITY — Core can validate a backup DTO with the same fail-closed rules
Q2: RunBusiness / Host: NO (not wired). New types live in Sirman.Core/Backup only
Q3: Persistence: NO live SoT. Tests use synthetic JSON fixtures
Q4: Printing: NO
Q5: HTML-only: PRESERVED — HTML validator remains the restore gate
Q6: New transport/DB/ACL: NO
RESULT: PASS
AUTHORITY: explicit user packet ARCH-2 2026-09-04
```

ARCH-3 and P1C-8 were not started.

---

## 1. Source HTML functions extracted

Captured from `Sirman_Final.html` (unchanged). Mapping:

| HTML function / symbol | Line (approx.) | Core type |
|---|---|---|
| `REQUIRED_BACKUP_COLLECTIONS` | 7789 | `RequiredCollectionsRegistry.Always` |
| `REQUIRED_BACKUP_COLLECTIONS_FROM_SCHEMA` | 7790 | `RequiredCollectionsRegistry.FromSchema` |
| `inferBackupSchemaVersion` | 7653 | `BackupRequiredCollections.InferSchemaVersion` |
| `requiredBackupCollectionsFor` | 7807 | `BackupRequiredCollections.RequiredFor` |
| `validateRequiredBackupCollections` | 7819 | `BackupRequiredCollections.Validate` |
| `backupValidationStatus` | 7883 | `BackupJsonUtil.StatusOf` |
| `validateBackupItemCounts` | 7889 | `BackupStructuralValidator.ValidateItemCounts` |
| `validateBackupAttachmentIndex` | 7925 | `BackupStructuralValidator.ValidateAttachmentIndex` |
| `detectBackupDuplicateIdentities` | 7960 | `BackupStructuralValidator.DetectDuplicateIdentities` |
| `validateBackupStructuralIntegrity` | 7986 | `BackupStructuralValidator.Validate` |
| `backupChecksumExcludedKey` | 8018 | `BackupCanonicalChecksum.IsExcludedKey` |
| `backupChecksumPayload` | 8021 | `BackupCanonicalChecksum.Payload` |
| `backupChecksumCanonicalString` | 8030 | `BackupCanonicalChecksum.CanonicalString` |
| `backupSectionHash` | 7690 | `BackupCanonicalChecksum.SectionHash` |
| `classifyBackupChecksumClaim` | 8045 | `BackupPortableIntegrity.ClassifyClaim` |
| `validateBackupSectionChecksums` | 8052 | `BackupPortableIntegrity.ValidateSectionChecksums` |
| `validateBackupPortableIntegrity` | 8079 | `BackupPortableIntegrity.Validate` |
| SHA-256 of canonical UTF-8 | `attachChecksum` / Node `crypto` | `BackupCanonicalChecksum.Sha256Hex` (`SHA256.HashData`) |
| `JSON.stringify` compact | used by canonical + djb2 | `BackupJsJson.Stringify` |
| combiner (structural + portable) | `BackupEngine.validate` minus `validateBackupPackage` | `BackupValidator.Validate` |

**Not extracted (intentional):** `_buildFullBackupData`, `applyBackupReplaceSections`, `applyBackupMergeSections`, `migrateBackup`, `applySchemaMigrations`, `resetAll`, Phonebook uniqueness, `importData` / FileReader / DOM, Host I/O, `validateBackupPackage` (post-migrate sectionChecksums-as-warnings + known-keys), `verifyChecksum` as a restore gate (digest compare stays HTML; Core exposes `Sha256Hex` only).

---

## 2. Exact Core classes / files created

```text
desktop/Sirman.Core/Backup/
  BackupValidationModels.cs      BackupValidationRequest/Result, status, DTOs, registry
  BackupJsonUtil.cs              parseInt10, typeof, finite number, status
  BackupJsJson.cs                HTML JSON.stringify compatible compact serializer
  BackupRequiredCollections.cs   schema + required collections
  BackupStructuralValidator.cs   itemCounts, attachments, duplicates, combiner
  BackupCanonicalChecksum.cs     exclusions, canonical string, SHA-256, djb2
  BackupPortableIntegrity.cs     claim + sectionChecksums + portable
  BackupValidator.cs             façade: structural + portable, no persist

desktop/Sirman.Core.Tests/
  BackupValidatorGolden.json     machine-readable HTML golden spec + 51 fixtures
  generate-backup-validator-golden.js
  BackupValidatorTests.cs
  Sirman.Core.Tests.csproj       CopyToOutputDirectory for golden JSON
```

`IBackupRepository` / `JsonBackupRepository` remain the TBD stub (`TbdMarker = "html-backup-engine"`). A comment points at `BackupValidator` and states it is **not** wired. No `.sln` was created.

---

## 3. Contract / API design

```text
BackupValidationRequest { JsonNode? Data }
        │
        ▼
BackupValidator.Validate(data) → BackupValidationResult
        │
        ├── BackupRequiredCollections.Validate
        ├── BackupStructuralValidator.Validate   (includes required)
        └── BackupPortableIntegrity.Validate

BackupCanonicalChecksum.CanonicalString(data) → compact JSON
BackupCanonicalChecksum.Sha256Hex(data)       → 64-char lowercase hex
BackupCanonicalChecksum.SectionHash(value)    → djb2 hex (UTF-16 code units)
```

`BackupValidationResult` fields aligned with HTML: `Ok`, `Status` (`VALID` / `VALID_WITH_WARNINGS` / `INVALID`), `Errors`, `Warnings`, `MissingRequiredCollections`, `InvalidCollections`, `CountMismatches`, `BrokenAttachmentRefs`, `DuplicateIdentities`, `SectionChecksumMismatches`, `ChecksumClaimed`, `ChecksumAlgo`, `ChecksumSkipped`, `HasBackupId`.

Input is not mutated. `Validate()` does **not** fail on SHA-256 digest mismatch (HTML `validateBackupPortableIntegrity` does not either). Digest is a separate pure function for equivalence tests.

---

## 4. Dependency analysis (Core purity)

| Concern | Present in `desktop/Sirman.Core/Backup/`? |
|---|---|
| DOM / `document` / `window` | No |
| WebView2 / `sirmanHost` | No |
| localStorage / IndexedDB | No |
| WinForms | No |
| FileReader / UI dialogs | No |
| `RunBusiness` / Host I/O | No |
| Input: `JsonNode` DTO | Yes |
| Hash: `System.Security.Cryptography.SHA256` | Yes (.NET BCL, not WebCrypto) |

`Sirman.Core.csproj` remains `net8.0` with no Windows TFM. Assembly inspection test `BackupValidator_DoesNotReferenceUiOrBrowserTypes` passed. Desktop project has **zero** references to `BackupValidator`. `importData` still calls HTML `validateRequiredBackupCollections`.

---

## 5. Golden behavior specification

Machine-readable file: `desktop/Sirman.Core.Tests/BackupValidatorGolden.json`  
Captured by `node desktop/Sirman.Core.Tests/generate-backup-validator-golden.js Sirman_Final.html` from the live HTML functions (not a rewritten rule sheet).

Frozen rules in `spec`:

- Always required: `warranties`, `invoices`. Schema ≥1 also: `sales`, `parts`, `accounts`. `tasks` not required.
- Schema 0 may omit sales/parts/accounts. Schema ≥1 missing/null/wrong type → INVALID. MISSING ≠ EMPTY. No repair to `[]`.
- `itemCounts` absent → compatible; present → object of finite numbers; declared === array length; mismatch INVALID.
- `attachmentsIndex` absent → compatible; present non-array INVALID; `kind`+non-empty `parentId` must match `rec.id` in warranties/sales/invoices.
- Duplicate identities WARNING only on `invoices.invoiceId`, `sales.saleUid`, `warranties.id`, `parts.id`, `accounts.id`. Phonebook not scanned.
- Canonical payload: all keys except `exportedAt`, `checksum`, `checksumAlgo`. Compact `JSON.stringify`, insertion order, not sorted. SHA-256 of UTF-8 of that string. **Not** disk bytes.
- `checksumAlgo` absent/`none` compatible; claimed unknown algo INVALID. `backupId` not in format.

---

## 6. HTML vs Core equivalence matrix

51 golden fixtures. Each fixture asserts HTML snapshot vs Core on required / structural / portable / combined / canonical / SHA-256 / requiredKeys / schemaVersion.

| Area | Fixtures (ids) | Result |
|---|---|---|
| Invalid package | `invalid-null-package`, `invalid-array-package` | MATCH |
| Schema 0 required | empty, omit sales/parts/accounts, missing warranties/invoices, null/wrong-type, bad record, tasks omitted/empty | MATCH |
| Schema ≥1 required | complete empty, missing/null/wrong-type sales/parts/accounts, manifest schema, v2.0 without schema | MATCH |
| itemCounts | absent, match, mismatch, not-object, non-finite | MATCH |
| attachmentsIndex | absent, ok, broken, not-array | MATCH |
| duplicates | invoiceId, saleUid, warranty id, parts+accounts | MATCH (WARNING, `ok:true`) |
| Phonebook | `phonebook-not-scanned` | MATCH (zero duplicate hits) |
| portable | none, absent, unknown MD5, section match/mismatch/absent/not-object | MATCH |
| canonical / SHA-256 | Persian, nested/null/1.5, multi-section, empty arrays, key order A/B, exportedAt/checksum/checksumAlgo mutations | MATCH |

C# test: `BackupValidatorTests.HtmlGolden_MatchesCore_ForEveryFixture` — 51/51.  
HTML lock: `ARCH-2 G1` re-runs the current HTML validator against the same golden file — PASS.

One HTML quirk preserved, not “fixed”: `typeof [] === 'object'`, so `classifyBackupChecksumClaim([])` yields `checksumAlgo: "none"` (not `""`). Core matches that.

---

## 7. SHA-256 equivalence evidence

Definition implemented: UTF-8 bytes of compact canonical JSON → `SHA256.HashData` → lowercase hex. Same as Node `crypto.createHash('sha256').update(s,'utf8')` and HTML `crypto.subtle.digest('SHA-256', TextEncoder.encode(canonical))`.

Examples from golden (HTML string = Core string = Core hex):

| Fixture | SHA-256 |
|---|---|
| `{}` (null/array payload) | `44136fa355b3678a1146ad16f7e8649e94fb4fc21fe77e8310c060f61caaff8a` |
| schema1 empty required | `437ab3c37db5447ac06109899f5dca30f5c3132cfa7b1740d89f715e7613621a` |
| `persian-text-and-digits` | `06e4efdc6bf544c610490a83b9e71f14e93811bd470d9565c42b566c91eb9c14` |
| canonical base / exportedAt changed / checksum field changed / checksumAlgo changed | all `0c9d9eda047ee6e8439777b812033cc6599f25e15da7c1324c9e6d97bffebbaf` |

Key order A ≠ key order B (HTML does not sort keys). Core does not sort keys.

---

## 8. Version compatibility evidence

| Case | HTML | Core |
|---|---|---|
| Schema 0, sales/parts/accounts omitted | VALID | VALID |
| Schema ≥1, sales missing | INVALID, `missingRequiredCollections: [sales]` | same |
| Schema ≥1, parts missing | INVALID | same |
| Schema ≥1, accounts missing | INVALID | same |
| warranties missing (any schema) | INVALID | same |
| invoices missing (any schema) | INVALID | same |
| `version:'2.0'` without `schemaVersion` | schema 0, accounts omitted compatible | same |
| `tasks` omitted on schema 1 | VALID | VALID |

HTML P1C-1..P1C-7 regression tests remain in `test_laegh.js` and still pass.

---

## 9. Existing HTML tests

Command:

```bash
node test_laegh.js Sirman_Final.html
```

**778 / 778 PASS** (previous full suite 775, plus 3 ARCH-2 golden-lock tests). Zero failures.

`Sirman_Final.html` was not edited. Restore still uses HTML `validateRequiredBackupCollections` / structural / portable / `verifyChecksum` before preview.

---

## 10. New Core tests

Command:

```bash
dotnet test desktop/Sirman.Core.Tests/Sirman.Core.Tests.csproj -c Release
```

**301 / 301 PASS** including **59** `BackupValidatorTests` (51 theory fixtures + facts: exclusions, key order, Phonebook, tasks, schema 0/1, TBD repository, purity).

No new `.sln`. Existing `Sirman.Core.Tests` csproj was used.

---

## 11. Full test counts

| Suite | Command | Count |
|---|---|---|
| HTML | `node test_laegh.js Sirman_Final.html` | **778/778 PASS** |
| Core | `dotnet test desktop/Sirman.Core.Tests -c Release` | **301/301 PASS** |
| Live shop restore | not run | n/a |
| Phonebook / SQLite mutation | not run | n/a |

---

## 12. Confirmation

| Constraint | Status |
|---|---|
| Live data unchanged | **Confirmed** |
| Phonebook unchanged | **Confirmed** (`Sirman_Final.html` untouched; duplicates not scanned) |
| SQLite unchanged | **Confirmed** (sidecar dirty files were not staged) |
| Restore cutover NOT performed | **Confirmed** — no Host method, no `importData` change |
| HTML validator retained | **Confirmed** — functions still at original lines; ARCH-2 G2 |
| No `_buildFullBackupData` / apply / migrate extraction | **Confirmed** |
| `backupId` not invented | **Confirmed** |
| Canonical SHA-256 contract unchanged | **Confirmed** |

---

## 13. Known gaps

- `validateBackupPackage` (known keys, invoice `items` warning, **sectionChecksums as warnings after migrate**) is not in Core. Portable FAIL-before-migrate remains the extracted contract.
- `verifyChecksum` restore gate (async digest compare, `none` skip, no-subtle skip) stays HTML. Core can compute the hex; it is not called from restore.
- `attachChecksum` / encrypt / autosave I/O stay HTML.
- `migrateBackup` / `SCHEMA_MIGRATIONS` stay HTML.
- Merge/replace / live `sv*` stay HTML.
- `JsonBackupRepository` is still a TBD marker, not this validator.
- `BackupJsJson` is proven on JSON.parse fixtures. Programmatic `JsonValue` doubles use a G17 fallback; production Core path should parse JSON text (same as HTML FileReader → JSON.parse).
- Network pull still skips SHA-256 in HTML; Core restore is not used, so that discrepancy is untouched.

---

## 14. Exact next extraction candidate

**`applySchemaMigrations` + `SCHEMA_MIGRATIONS` (0→1 only), then `migrateBackup` / `SCHEMAS` / `migrateRecord`.**

Why: validators and canonical checksum are now dual-locked. Migration is the next pure-on-package step (mutates a clone/package object, not live RAM). Still do **not** extract `_buildFullBackupData` or apply merge/replace.

Do **not** start ARCH-3 or P1C-8 in this packet.

---

## Q1–Q11

**Q1. Is the Core validator pure?**  
**YES.** `JsonNode` in → `BackupValidationResult` out. No hidden globals. Input is not mutated (section-hash before/after Validate).

**Q2. Does it depend on DOM/WebView2/localStorage/IndexedDB?**  
**NO.** Grep of `desktop/Sirman.Core/Backup` is clean; Core csproj has no Windows TFM; Desktop does not call `BackupValidator`.

**Q3. Does HTML behavior match Core behavior?**  
**YES.** 51/51 golden fixtures match; HTML `ARCH-2 G1` re-locks the golden file against current HTML.

**Q4. Does Core SHA-256 exactly match HTML SHA-256?**  
**YES.** Same lowercase 64-char hex on every golden fixture, including Persian text/digits and exclusion mutations.

**Q5. Are schema/version compatibility rules preserved?**  
**YES.** Schema 0 omit sales/parts/accounts VALID; schema ≥1 missing/null/wrong type INVALID; warranties/invoices always required; tasks not required.

**Q6. Is HTML validator still present?**  
**YES.** `function validateRequiredBackupCollections` still in `Sirman_Final.html`; `importData` still calls it.

**Q7. Was live restore cut over to Core?**  
**NO.** No Host method, no `RunBusiness` backup op, no `importData` change.

**Q8. Did live data change?**  
**NO.**

**Q9. Did Phonebook change?**  
**NO.**

**Q10. Did SQLite change?**  
**NO** (not staged; engine not touched).

**Q11. What is the next safest extraction?**  
**`applySchemaMigrations` / `SCHEMA_MIGRATIONS` then `migrateBackup`**, still with HTML fallback and no restore cutover.

---

*End of ARCH-2. HTML validator remains the production restore gate.*
