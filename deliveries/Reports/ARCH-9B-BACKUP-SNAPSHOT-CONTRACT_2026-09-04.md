# SIRMAN — ARCH-9B Backup Snapshot Contract

**Date:** 2026-09-04  
**Packet:** Formal Core `BackupSnapshot` transport contract + golden shape tests. **No live extraction.**  
**Product version left unchanged:** `1405.6.3α`  
**Branch:** `cursor/arch-9b-backup-snapshot-contract-fa01`  
**Base:** `cursor/arch-9a-backup-snapshot-assembly-audit-fa01`

---

## Phase 3 Change Gate

```text
CHANGE: ARCH-9B Core BackupSnapshot contract + golden shape
CLASS: Typed document model for JSON Core already consumes. No Host. No assembly cutover.
Q1: CAPABILITY — Core can name and inspect the assembled snapshot shape
Q2: RunBusiness / Host: NO
Q3: Persistence: NO live SoT. Synthetic JSON only
Q4: Printing: NO
Q5: HTML-only: PRESERVED — _buildFullBackupData unchanged
Q6: New transport/DB/ACL: NO
RESULT: PASS
AUTHORITY: explicit user packet ARCH-9B 2026-09-04
```

`_buildFullBackupData` was not modified. No live snapshot adapter. Restore / Merge / Replace / Phonebook / SQLite / P1C-8 / ARCH-10 were not started.

---

## 1. Snapshot contract

Transport/document model. Business records stay JSON arrays/objects. No per-invoice domain types.

| Type | File | Role |
|---|---|---|
| `BackupSnapshotCatalog` | `desktop/Sirman.Core/Backup/BackupSnapshotCatalog.cs` | Frozen key lists from ARCH-9A |
| `BackupSnapshot` | `desktop/Sirman.Core/Backup/BackupSnapshot.cs` | Parse / clone / canonical stringify / shape inspect |
| `BackupSnapshotMetadata` | `BackupSnapshotModels.cs` | magic, schema, versions, exportedAt, origin, finalized flags |
| `BackupSnapshotItemCounts` | same | declared `itemCounts` object only |
| `BackupSnapshotAppearance` | same | appearance JSON map |
| `BackupSnapshotShapeReport` | same | 49/51/sections/runtime-handle classification |

```text
JsonNode
    → BackupSnapshot.Parse     (CloneExact; no live RAM)
    → BackupSnapshot { Data, Metadata, ItemCounts, Appearance, Shape }
    → ToCanonicalJson          (BackupJsJson; insertion order preserved)
    → FromCanonicalJson
```

Required-collection validity is **not reimplemented**. Tests call existing `BackupRequiredCollections` / `BackupValidator` / `BackupStructuralValidator`.

Phonebook: payload array only. `BackupRestorePlanBuilder.IdentityKey("phonebook")` remains `""`.

---

## 2. Complete key inventory

### A. Base payload keys (49)

Always assigned by HTML `_buildFullBackupData` object literal:

`magic`, `schemaVersion`, `version`, `applicationVersion`, `exportedAt`, `invoices`, `products`, `inventory`, `invCtr`, `invoiceUidCtr`, `saleCtr`, `saleUidCtr`, `phonebook`, `parts`, `services`, `svcs`, `warranties`, `sales`, `tasks`, `accounts`, `defectiveStock`, `warehouseDocs`, `stockMoves`, `warehouses`, `daqi`, `daqiWarehouse`, `daqiVouchers`, `postalHistory`, `appliedUpdates`, `updatePackages`, `userAuditLog`, `bgAuditLog`, `userRoles`, `loginPw`, `printSettings`, `company`, `serviceCenter`, `starredAlarms`, `senderInfo`, `logoSrc`, `acH`, `appearance`, `sms`, `tz`, `networkSettings`, `prefs`, `aiKeys`, `itemCounts`, `sections`

`origin` is **not** one of the 49. It is a **caller stamp** (`exportData` / autosave / archive) listed in `CallerStampKeys`.

`backupId` is **not** in the contract.

### B. `sections` catalog (32)

See `BackupSnapshotCatalog.SectionsCatalog`. Core does not add `warehouseDocs`, `stockMoves`, `prefs`, `svcs`, counters, or `appliedUpdates` to this list.

If `printCenter` is present, HTML may push it as a 33rd name. That is optional, not a catalog expansion.

### C. `itemCounts` keys (15)

`invoices`, `products`, `phonebook`, `parts`, `services`, `warranties`, `sales`, `tasks`, `accounts`, `defectiveStock`, `warehouses`, `daqi`, `daqiWarehouse`, `daqiVouchers`, `postalHistory`

Not expanded to `warehouseDocs` / `stockMoves`.

### D. Finalized metadata (not raw assembly)

`checksum`, `checksumAlgo`, `manifest`, `sectionChecksums`

`BackupSnapshotMetadata.IsFinalizedPackage` is true when any of checksum/manifest/sectionChecksums is present.

### E. Optional assembly keys

`printCenter`, `attachmentsIndex`  
Typical run: **51** = 49 + these two.

---

## 3. sections vs payload

These lists are separate types on the catalog. Tests fail if they are collapsed:

- Payload includes `svcs`, `warehouseDocs`, `stockMoves`, `prefs`, `appliedUpdates`, `updatePackages`, counters, `itemCounts`, `sections`, metadata.
- `sections` names 32 business/settings keys used for **sectionChecksums** by Finalizer.
- SHA-256 payload still includes keys omitted from `sections` (existing ARCH-5 behavior). This packet does not change that.

---

## 4. itemCounts distinction

`BackupSnapshotItemCounts.DeclaredKeys` is the object's own keys, not `sections` and not the 49. T10 asserts the 15-key catalog. T11 mismatch uses existing P1C-6 fail-closed validator.

---

## 5. Required collection invariants

Unchanged P1C registry:

| Schema | Required |
|---|---|
| always | `warranties`, `invoices` |
| ≥1 | + `sales`, `parts`, `accounts` |

T2: `[]` is valid. T4–T8: missing key is INVALID with `MISSING ≠ EMPTY`. T9: schema 0 does not require sales/parts/accounts.

---

## 6. Optional field rules

| Key | Absent | Present |
|---|---|---|
| `printCenter` | valid (T13) | typical 51-key snapshot (T16) |
| `attachmentsIndex` | valid (T14); Finalizer may rebuild later | array |
| `origin` | valid on raw assembly | caller stamp; round-trip preserves it |
| finalized checksum/manifest | raw snapshot | after Core Finalizer |

---

## 7. Metadata ownership

| Field | Owner |
|---|---|
| `magic` / `schemaVersion` / `version` / `applicationVersion` / `exportedAt` | HTML assembly (Finalizer may overwrite magic/schema/applicationVersion) |
| `origin` | caller after assembly |
| `itemCounts` / `sections` | HTML assembly; Finalizer copies into manifest |
| `attachmentsIndex` | assembly if helper exists; Finalizer rebuilds |
| `checksum` / `checksumAlgo` | `attachChecksum` / Core checksum mode |
| `manifest` / `sectionChecksums` | Finalizer (ARCH-5/6) |

Version literals in fixtures remain `1405.6.3α`. Not bumped.

---

## 8. Serialization round-trip

`BackupSnapshot.Parse` → `ToCanonicalJson` (`BackupJsJson`, insertion order preserved) → `FromCanonicalJson`.

Result: canonical strings equal. Input node unchanged (clone). Persian `علی` survives (T17).

---

## 9. Golden fixtures

`desktop/Sirman.Core.Tests/BackupSnapshotGolden.json` locks counts and T1–T18 ids.

| Id | Result |
|---|---|
| T1 minimal schema≥1 full | PASS — 49 keys, required arrays present |
| T2 empty required | PASS |
| T3 populated required | PASS |
| T4 missing warranties | PASS INVALID |
| T5 missing invoices | PASS INVALID |
| T6 missing sales schema≥1 | PASS INVALID |
| T7 missing parts schema≥1 | PASS INVALID |
| T8 missing accounts schema≥1 | PASS INVALID |
| T9 schema0 warranties+invoices | PASS (sales not required) |
| T10 valid itemCounts | PASS |
| T11 itemCounts mismatch | PASS INVALID |
| T12 valid sections | PASS 32-name catalog |
| T13 printCenter absent | PASS |
| T14 attachmentsIndex absent | PASS |
| T15 all 49 base keys | PASS; no `backupId` |
| T16 typical 51 | PASS |
| T17 Persian unicode | PASS round-trip |
| T18 phonebook payload only | PASS excluded from RestorePlan identity |

Additional locks: round-trip, immutability, finalized-metadata distinct, golden catalog match, no browser types.

---

## 10. Test counts

| Suite | Result |
|---|---|
| `BackupSnapshotTests` | 24/24 |
| Core full | **538/538** (was 514) |
| HTML `test_laegh.js Sirman_Final.html` | **801/801** (was 799; ARCH-9B G1/G2) |

ARCH-2..ARCH-8 remain in the Core suite.

---

## 11. Compatibility notes

- HTML `svcs` alias and incomplete `sections`/`itemCounts` lists are **documented, not “fixed.”**
- Secrets (`loginPw`, `aiKeys`) remain in the payload shape; not stripped.
- No encryption, no disk-byte hash, no SHA-256 change.
- Schema 0→1 `MISSING → []` remains migrator behavior, not this contract.
- `BackupSnapshot.Parse` of a non-object yields an empty object document (transport parse), distinct from validator INVALID.

---

## 12. Confirmation

| Surface | Status |
|---|---|
| `_buildFullBackupData` | unchanged (G1) |
| live Backup `exportData` | still HTML assemble → Core Finalizer |
| Restore / Merge / Replace | unchanged (G2) |
| Phonebook | unchanged; payload-only in contract |
| SQLite / `JsonBackupRepository` | `html-backup-engine` |
| Host | no new method |
| Version | `1405.6.3α` |

---

## 13. Next safest extraction

Do **not** start ARCH-10 in this packet.

Next: HTML **clone-on-assemble tests** (prove live `invoices.push` does not mutate a cloned snapshot) **without** replacing `_buildFullBackupData`. Then dual-run completeness diffs. Live reader / Restore apply remain later and riskier.

---

## Governance work report (قانون ۱۳)

1. **کار:** قرارداد BackupSnapshot در Core  
2. **شاخه:** `cursor/arch-9b-backup-snapshot-contract-fa01`  
3. **تغییر:** مدل + کاتالوگ + تست طلایی؛ بدون اسمبل زنده  
4. **نسخه:** `1405.6.3α`  
5. **HTML:** 801/801  
6. **Core:** 538/538  
7. **ARCH-2..8:** PASS  
8. **داده زنده:** بدون نوشتن  
9. **استخراج اسمبل:** شروع نشد  
10. **وضعیت:** COMPLETED

---

## Q1–Q16

**Q1. Does a formal BackupSnapshot contract now exist?**  
YES. `BackupSnapshot` + `BackupSnapshotCatalog`.

**Q2. Does it represent the complete observed snapshot shape?**  
YES. 49 base keys, optional 2, caller `origin`, finalized 4. T15/T16.

**Q3. Are sections and payload keys explicitly separated?**  
YES. `SectionsCatalog` vs `BasePayloadKeys`. T12.

**Q4. Are itemCounts explicitly separated?**  
YES. `ItemCountKeys` (15). T10/T11.

**Q5. Are required collections represented?**  
YES. Five schema≥1 arrays. T1–T3.

**Q6. Is schema≥1 MISSING still invalid?**  
YES. T4–T8 via `BackupRequiredCollections`.

**Q7. Is `[]` still valid?**  
YES. T2.

**Q8. Is Phonebook still payload-only?**  
YES. T18; no identity key.

**Q9. Does the DTO depend on browser/runtime APIs?**  
NO. JSON only. Forbidden runtime keys listed, not used.

**Q10. Was `_buildFullBackupData` changed?**  
NO. G1.

**Q11. Was live Backup changed?**  
NO. `exportData` still calls HTML assemble.

**Q12. Was Restore changed?**  
NO. G2.

**Q13. Did live data change?**  
NO. Synthetic fixtures.

**Q14. Did Phonebook change?**  
NO.

**Q15. Did SQLite change?**  
NO.

**Q16. What is the next safest extraction?**  
Clone-on-assemble tests only. Do not extract the live reader. Do not cut over Restore. Do not start P1C-8 / ARCH-10.

---

## STOP

ARCH-10 not started. `_buildFullBackupData` not modified. No live snapshot adapter. Restore cutover not started. P1C-8 not started.
