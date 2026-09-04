# SIRMAN — ARCH-12 Strict Stored Checksum Verification

**Date:** 2026-09-04  
**Packet:** Compare stored SHA-256 hex to the existing canonical digest.  
**Product version left unchanged:** `1405.6.3α`  
**Branch:** `cursor/arch-12-strict-checksum-fa01`  
**Base:** `cursor/arch-11-backup-disk-roundtrip-fa01` @ `ea5874c`

This does **not** change the SHA-256 input. Pretty disk bytes are still not hashed. Restore is not cut over.

---

## Phase 3 Change Gate

```text
CHANGE: ARCH-12 strict stored SHA-256 vs canonical digest
CLASS: Core validation helper + façade. No format change. No Restore apply.
Q1: CAPABILITY — tampered stored checksum must fail Core validation
Q2: RunBusiness / Host: NO new methods
Q3: Persistence: NO writes
Q4: Printing: NO
Q5: HTML-only: PRESERVED — live importData already calls verifyChecksum
Q6: New transport/DB/ACL: NO
RESULT: PASS
AUTHORITY: explicit user packet ARCH-12 2026-09-04
```

---

## 1. Existing checksum behavior (before this packet)

| Layer | What it did |
|---|---|
| Canonical digest | SHA-256 of compact JSON of all keys except `exportedAt`, `checksum`, `checksumAlgo` |
| HTML `validateBackupPortableIntegrity` | Unknown algo → INVALID. Missing / `none` → skip. **Does not compare stored hex to digest.** |
| HTML `verifyChecksum` | If claimed `SHA-256`, `computed === stored` (exact). Used by live `importData` before migrate. |
| Core `BackupPortableIntegrity` | HTML portable parity (algo + `sectionChecksums` only) |
| Core `BackupValidator` | Structural + portable. **Did not compare digest.** ARCH-11 T10 could PASS with a zeroed checksum. |
| Core `BackupDryRunService` | Already compared `stored == Sha256Hex` and blocked migration |

---

## 2. Exact defect / gap

ARCH-11: changing the stored `checksum` hex did not change the hashed payload, and **BackupValidator still returned VALID**.

DryRun / RestorePlan already failed. Snapshot consume used Validator, so it inherited the gap.

---

## 3. New comparison rule

When `classifyBackupChecksumClaim` says the package **claims** a checksum and `checksumAlgo == "SHA-256"` (existing recognized name; not a new `"sha256"` token):

```text
expectedDigest = BackupCanonicalChecksum.Sha256Hex(data)   // lowercase x2
stored         = String(checksum) as already read by BackupJsonUtil.Str
matched        = stored == expectedDigest                  // exact, no trim, no case-fold
```

If unmatched → INVALID with HTML `verifyChecksum` message:

`checksum مطابقت ندارد — فایل ممکن است خراب باشد!`

---

## 4. Exact comparison implementation

Single helper: `desktop/Sirman.Core/Backup/BackupStoredChecksum.cs`

- `BackupValidator.Validate` calls `BackupStoredChecksum.Compare` after required+structural+portable.
- `BackupDryRunService.EvaluateIntegrity` uses the same helper (no second `stored == hex` copy).
- `BackupSnapshotConsumer` uses `BackupValidator` → covered.
- `BackupRestorePlanBuilder` uses DryRun → covered.
- Host `TestRestoreBackup` / `ConsumeBackupSnapshot` remain thin transport.

`BackupPortableIntegrity` stays HTML-portable (no digest compare) so ARCH-2 portable goldens remain HTML-identical. Combined Core façade is **stricter** than HTML portable; goldens document that overlay.

---

## 5. Canonical input definition unchanged

Still:

```text
UTF-8 bytes of compact JSON.stringify(payload)
payload = all own keys except exportedAt, checksum, checksumAlgo
insertion order, not sorted
pretty-print is NOT hashed
```

`BackupCanonicalChecksum.Compute` / `Sha256Hex` / `IsExcludedKey` were not modified.

---

## 6. Case / format behavior

| Stored value | Result |
|---|---|
| Exact lowercase 64-hex matching digest | VALID |
| One digit flipped | INVALID |
| Uppercase of the same hex | **INVALID** (`==` is case-sensitive; HTML `computed === stored` is the same) |
| Short / long / non-hex | INVALID (string inequality) |
| No trim of spaces | a padded hex is inequality → INVALID |

No `ToLowerInvariant` / `OrdinalIgnoreCase` / `Trim` was added.

---

## 7. Missing / none semantics

Unchanged `ClassifyClaim`:

- empty `checksum` **or** empty algo **or** `checksumAlgo === "none"` → skipped, compatible, `NOT_VERIFIABLE` on DryRun
- Deleting the checksum field while leaving `checksumAlgo: "SHA-256"` is the empty-sum case → skip (checksum is not required when the claim is absent)

---

## 8. Unknown algorithm behavior

`claim.Algo != "SHA-256"` remains fail-closed in portable integrity (`MD5`, `sha256`, etc.). Helper does **not** compare digest for unknown algo (`Compared = false`). Existing error text kept.

---

## 9. Disk tamper test

Synthetic temp file only (not `%AppData%/Sirman/backup`):

1. Finalize Sha256 → pretty-print → UTF-8 no BOM → `ReadAllBytes` → parse → **PASS**
2. Rewrite stored checksum on disk → reopen bytes → **INVALID**
3. DryRun `MigrationPerformed = false`, `Data = null`, `Applied = false`
4. RestorePlan `Ok = false`, no sections
5. Consume `ok=false`, `applied=false`, `wrote=false`

ARCH-11 T10 updated: zeroed checksum **MUST FAIL**. T14b top-level key order now fails via stored digest (canonical string changes; stored hex does not).

---

## 10. Core entry points protected

| Entry | How |
|---|---|
| `BackupValidator` | helper after structural+portable |
| `BackupDryRunService` | helper; migration gated on `validation.Ok` |
| `BackupSnapshotConsumer` | Validator |
| `BackupRestorePlanBuilder` | DryRun first |
| Host dry-run / consume | unchanged transport |

No second digest rule. No `JsonBackupRepository` activation.

---

## 11. HTML parity findings

**Live HTML Restore already compared digest** via `verifyChecksum` (`computed === stored`) **before** `applySchemaMigrations` / `migrateBackup`.

HTML `validateBackupPortableIntegrity` still does **not** compare digest. This packet did **not** change production HTML (packet: do not silently redesign HTML portable).

Difference:

| Check | HTML portable | HTML `verifyChecksum` (importData) | Core `BackupValidator` after ARCH-12 |
|---|---|---|---|
| Unknown algo | INVALID | INVALID | INVALID |
| Missing / none | skip | skip | skip |
| Stored hex vs digest | **not compared** | **exact ===** | **exact ==** |

Core is the strict façade for exe DryRun / consume / plan. HTML-only restore still relies on `verifyChecksum`, not portable.

Regression locks in `test_laegh.js` freeze `computed === stored` and canonical exclusions.

---

## 12. Full test counts

| Suite | This packet | Total |
|---|---|---|
| HTML | +2 locks | **839/839 PASS** |
| Core | +19 stored-checksum tests; ARCH-11 T10/T14b expectations updated | **625/625 PASS** (606 previous + 19) |

No tests deleted.

---

## 13. Regression results

| Suite | Result |
|---|---|
| Full HTML | 839/839 |
| Full Core | 625/625 |
| ARCH-11 disk round-trip class | PASS (T10 now MUST FAIL) |
| ARCH-10 consumer class | PASS |
| ARCH-8 RestorePlan class | PASS |
| ARCH-4 DryRun class | PASS |
| ARCH-2 Validator goldens | portable HTML-identical; combined Core-strict overlay for dummy SHA-256 fixtures |

Logs: `/opt/cursor/artifacts/arch12-html-tests.log`, `/opt/cursor/artifacts/arch12-core-tests.log`

---

## 14. Live-data safety

Synthetic fixtures only. No `WriteBackupText`. No shop backup dir. No Phonebook / SQLite / `resetAll` edits. Invalid checksum does not migrate, does not apply Restore, does not write storage.

---

## 15. Remaining integrity gaps

1. **Pretty-print / CRLF / BOM** still outside the hashed payload (intentional canonical contract).
2. **Exact disk-byte hashing** not implemented.
3. HTML **portable** slice still does not compare digest (live Restore uses `verifyChecksum` instead).
4. Consume-on-export still off.
5. Restore apply still HTML Merge/Replace.
6. No `backupId` / `.sirmanbak` / sidecar.

---

## 16. Next safest step

Exact-byte integrity remains a **later** packet (do not redefine today’s SHA-256 input as pretty bytes).

Safer HTML follow-up (not this packet): optionally make `validateBackupPortableIntegrity` call the same digest compare as `verifyChecksum` so HTML portable matches Core Validator. Do not start P1C-8 or Core Merge/Replace.

---

## Files

| File | Role |
|---|---|
| `desktop/Sirman.Core/Backup/BackupStoredChecksum.cs` | single exact compare |
| `desktop/Sirman.Core/Backup/BackupValidator.cs` | calls helper |
| `desktop/Sirman.Core/Backup/BackupDryRunService.cs` | reuses helper |
| `desktop/Sirman.Core.Tests/BackupStoredChecksumTests.cs` | T1–T14 + disk |
| `test_laegh.js` | HTML verifyChecksum locks |
| this report | |

Production HTML / Phonebook / SQLite / Restore apply were not modified.

---

## Packet questions

**Q1. Is stored SHA-256 now compared to calculated digest?**  
YES. `BackupStoredChecksum.Compare` + `BackupValidator`.

**Q2. Does a one-digit checksum mutation fail?**  
YES. T2.

**Q3. Does data mutation fail?**  
YES. T14 + section hashes; stored digest also mismatches.

**Q4. Does exportedAt mutation remain compatible?**  
YES. Excluded from payload; stored hex still matches. T12.

**Q5. Does whitespace mutation remain compatible?**  
YES. T13.

**Q6. Is the canonical SHA input unchanged?**  
YES. `BackupCanonicalChecksum` not modified.

**Q7. Are missing/none compatibility rules preserved?**  
YES. T9 / T10.

**Q8. Are unknown algorithms still fail-closed?**  
YES. T11 `MD5`.

**Q9. Is verification centralized?**  
YES. One helper; Validator + DryRun call it; Consumer/RestorePlan go through those.

**Q10. Can invalid checksum reach migration?**  
NO. DryRun `MigrationPerformed = false`.

**Q11. Can invalid checksum reach Restore?**  
NO. Plan `Ok = false`; Consumer `applied=false`. Live HTML `importData` already blocked via `verifyChecksum` (unchanged).

**Q12. Can invalid checksum write storage?**  
NO. No File/localStorage/IDB writes on these paths.

**Q13. Did live data change?**  
NO.

**Q14. Did Phonebook change?**  
NO.

**Q15. Did SQLite change?**  
NO.

**Q16. What exact integrity gap remains after ARCH-12?**  
Pretty/CRLF/BOM disk bytes are still not hashed; exact-byte integrity is not implemented; HTML portable still omits digest compare.
