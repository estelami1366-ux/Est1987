# SIRMAN — ARCH-11 Backup Disk Round-Trip Verification

**Date:** 2026-09-04  
**Packet:** Read-only / synthetic disk round-trip of Core Finalizer output through the production write representation.  
**Product version left unchanged:** `1405.6.3α`  
**Branch:** `cursor/arch-11-backup-disk-roundtrip-fa01`  
**Base:** `cursor/arch-10-core-snapshot-consumer-fa01` @ `ca083cb`

This is **not** a checksum-format redesign. This is **not** Restore. `ConsumeBackupSnapshot` remains opt-in and is **not** on export.

---

## Phase 3 Change Gate

```text
CHANGE: ARCH-11 synthetic disk round-trip tests + evidence report
CLASS: Test-only. No production format/checksum/Restore change.
Q1: CAPABILITY — prove Finalizer → disk representation → reopen → Validator
Q2: RunBusiness / Host: NO new methods
Q3: Persistence: synthetic temp files only; Host.WriteBackupText not invoked
Q4: Printing: NO
Q5: HTML-only: PRESERVED
Q6: New transport/DB/ACL: NO
RESULT: PASS
AUTHORITY: explicit user packet ARCH-11 2026-09-04
```

---

## 1. Exact production disk write path

Traced from source (not guessed):

```text
_buildFullBackupData()                         HTML isolated JSON clone (ARCH-9D)
        ↓
applyBackupFinalizer(data, origin, kind)
        ↓  exe:  Host.FinalizeBackup → BackupFinalizeBridge → BackupFinalizer
        ↓  HTML-only: finalizeBackupPackage + attachChecksum
        ↓  Core returns a compact JSON object; HTML replaces the in-memory object
        ↓  FinalizeBackup does NOT write disk
JSON.stringify(data, null, 2)                  HTML pretty-print (2 spaces, LF)
        ↓
WriteBackupText(fileName, json)                Host persist (autosave)
   or Blob([pretty]) download                  manual export (browser, not Host)
        ↓
File.WriteAllText(path, content, UTF-8 no BOM)
        ↓
disk
```

Evidence:

| Step | Source |
|---|---|
| Assembly | `Sirman_Final.html` `_buildFullBackupData` — SHA-256 lock `f65d8f393d91de7e984540060ceec6deb14976d9dce4bd7b82261d2e69c5df5f` |
| Core finalize (exe) | `applyCoreBackupFinalizer` → `h.FinalizeBackup(payload)` |
| Host finalize | `SirmanHostObject.FinalizeBackup` → `BackupFinalizeBridge.Execute` — comment: “Does not write disk” |
| Core compact JSON | `BackupFinalizer` + `BackupJsJson.Stringify` (canonical / compact) |
| Pretty-print | `doAutoSave`: `JSON.stringify(data, null, 2)` ; `exportData` / archive: `JSON.stringify(data,null,2)` |
| Host write | `writeAutoSaveTarget` → `WriteBackupText('sirman_autosave.txt', text)` |
| Write implementation | `SirmanHostObject.WriteBackupText` |

`WriteBackupText` writes `content ?? ""` as-is. No envelope, no wrapper, no checksum sidecar, no post-write mutation.

ARCH-11 tests **do not call** `Host.WriteBackupText` because that path uses `GetBackupDir()` → `%AppData%/Sirman/backup` (live shop). Tests replica the same `File.WriteAllText(..., new UTF8Encoding(false))` against a synthetic temp path.

---

## 2. Encoding / newline / BOM / extension

| Property | Production value | Evidence |
|---|---|---|
| Encoding | UTF-8 | `new UTF8Encoding(encoderShouldEmitUTF8Identifier: false)` |
| BOM | **none** | `encoderShouldEmitUTF8Identifier: false`; round-trip bytes do not start `EF BB BF` |
| Pretty-print indent | 2 spaces | HTML `JSON.stringify(data, null, 2)` |
| Newline in pretty JSON | LF (`\n`) | ECMA `JSON.stringify`; `File.WriteAllText` does not convert newlines |
| Trailing newline | none (stringify default) | Node `JSON.stringify` golden match in Core tests |
| Envelope | none | content written as-is |
| `WriteBackupText` mutates content? | **NO** | `File.WriteAllText(path, content ?? "", ...)` |
| Host filename (autosave) | `sirman_autosave.txt` | `writeAutoSaveTarget` |
| Manual download name | `Laegh_backup_<date>.json` | `exportData` Blob `a.download` |
| Archive download name | `Laegh_archive_<date>.json` | `exportArchiveBackup` |
| Encrypted download | `Laegh_backup_<date>_enc.json` | out of scope (encryption not this packet) |
| Directory (Host) | `%AppData%/Sirman/backup` | `GetBackupDir()` creates the directory |

Pretty JSON is **not** the SHA-256 input. Canonical compact JSON is.

---

## 3. Round-trip method

Synthetic only:

1. Build a valid Schema-1 `BackupSnapshot` input (Persian phonebook, one invoice, `printCenter`).
2. Run `BackupFinalizer.Finalize` with `ChecksumMode.Sha256` (live exe mode).
3. Pretty-print with a test-only replica of HTML `JSON.stringify(_, null, 2)` (`HtmlPrettyJson`), proven equal to Node `JSON.stringify(d,null,2)`.
4. Write with the production encoding: `File.WriteAllText(temp, pretty, UTF8Encoding(false))`.
5. Close by disposing the write.
6. Reopen **actual bytes**: `File.ReadAllBytes`.
7. Decode with `UTF8Encoding(false, throwOnInvalidBytes: true)`.
8. `JsonNode.Parse` → `BackupSnapshot.Parse` → `BackupValidator.Validate` on the **reopened** object.

Temp directory: `Path.GetTempPath()/sirman-arch11-<guid>/`. Not `%AppData%/Sirman/backup`. Deleted after the test class.

---

## 4. Pre-write vs post-read comparison

Compared compact `BackupJsJson.Stringify` of:

- A = finalized in-memory object (pre-write)
- B = object parsed from actual disk bytes (post-read)

**Result: semantically identical.** Compact strings match. Checked:

- every payload key
- collection lengths (`phonebook` = 2, `invoices` = 1, empty arrays stay empty)
- `itemCounts`
- `sections`
- `manifest`
- `sectionChecksums`
- `checksum` / `checksumAlgo`
- `exportedAt`
- Persian text (`علی`, `فروشگاه سیرمان`) unescaped on disk
- `attachmentsIndex` (rebuilt by Finalizer)
- optional `printCenter`

Raw pretty bytes are **not** required to match a second pretty-print after parse+stringify unless the writer is the same helper; the production contract is semantic JSON, not frozen pretty bytes. The first write **did** match Node pretty-print byte-for-byte (LF, 2-space, no BOM).

Validation in T3 runs on the **reopened** snapshot, not only the pre-write object.

---

## 5. Tamper matrix

All tampers start from a valid synthetic file, then copy / mutate **disk bytes or the parsed file** and re-validate the reopened object.

| ID | Change | Validator on reopen | Classification |
|---|---|---|---|
| T4 | scalar `phonebook[0].fn` | INVALID (`sectionChecksums.phonebook`) | **MUST FAIL** |
| T5 | replace one phonebook record | INVALID (`sectionChecksums.phonebook`) | **MUST FAIL** |
| T6 | delete one phonebook record | INVALID (counts + section hash) | **MUST FAIL** |
| T7 | add one invoice record | INVALID (counts + section hash) | **MUST FAIL** |
| T8 | `itemCounts.invoices = 99` | INVALID (`countMismatches`) | **MUST FAIL** |
| T9 | `sectionChecksums.phonebook = deadbeef` | INVALID | **MUST FAIL** |
| T10 | stored `checksum` hex → zeros | VALID | **MAY REMAIN VALID BY CURRENT CHECKSUM CONTRACT** |
| T11 | `exportedAt` → `2099-12-31…` | VALID; canonical SHA-256 unchanged | **MAY REMAIN VALID BY CURRENT CHECKSUM CONTRACT** |
| T12 | extra whitespace after `": "` | VALID; compact stringify unchanged | **MAY REMAIN VALID BY CURRENT CHECKSUM CONTRACT** |
| T13 | LF → CRLF | VALID; compact stringify unchanged | **MAY REMAIN VALID BY CURRENT CHECKSUM CONTRACT** |
| T14 | nested key order in a record | INVALID (`sectionChecksums.phonebook`) | **MUST FAIL** |
| T14b | top-level key order only | VALID; canonical SHA-256 **does** change | **MAY REMAIN VALID BY CURRENT CHECKSUM CONTRACT** |

T10 is expected: `BackupPortableIntegrity` treats claimed `SHA-256` as a recognized algorithm. It does **not** compare the stored hex to `BackupCanonicalChecksum.Sha256Hex`. Changing the stored field does not change the hashed payload. **Checksum definition was not changed to make T10 fail.**

---

## 6. Current checksum semantics (unchanged)

SHA-256 input =

```text
UTF-8 bytes of compact JSON.stringify(payload)
payload = all own keys except:
  - exportedAt
  - checksum
  - checksumAlgo
insertion order, not sorted
pretty-print is NOT hashed
```

Demonstrated:

- change `exportedAt` → canonical SHA-256 unchanged; validator remains VALID
- change whitespace / newlines → parse-normalize; canonical SHA-256 unchanged; validator remains VALID
- change hashed data (`phonebook[0].fn`) → canonical SHA-256 **changes**; validator **FAILS** via `sectionChecksums` (djb2 per section)

Stored SHA-256 hex is written by Finalizer (`checksum` == computed hex at finalize time) but **not re-checked** on validate.

---

## 7. Which changes are detectable

Detectable today (fail-closed):

- collection scalar / record mutate, add, delete (section djb2 + usually `itemCounts`)
- `itemCounts` lying about array length
- `sectionChecksums` value tamper
- nested property reorder inside a hashed section
- unknown `checksumAlgo` (pre-existing P1C-7; not re-tested as a new contract)

---

## 8. Which changes are intentionally not detectable

Under the **current** contract (not bugs invented for this packet):

- pretty-print whitespace
- LF vs CRLF
- `exportedAt`
- stored `checksum` hex vs computed digest (field is excluded from hash **and** not compared)
- top-level key order (canonical digest would change, but digest is not compared; section hashes are per collection)
- adding a UTF-8 BOM (JSON parsers often skip it; current validator never inspects raw bytes)
- Host filename / extension (`.txt` vs `.json`) — not part of the package

`itemCounts` itself is **not** in `data.sections`, so its section hash is not stored; lying counts still fail `BackupStructuralValidator`.

Optional `printCenter` is not in the 32-name `sections` catalog, so mutating it is outside section-hash coverage.

---

## 9. Portability result

**YES.** `BackupSnapshot.Parse` + `BackupValidator.Validate` operate on the re-read JSON object alone.

Not required:

- localStorage
- IndexedDB
- live shop RAM
- WebView2
- original HTML
- original installation

Core Backup project / `Sirman.Core.csproj` have no WebView2 / Windows Forms dependency.

If Host `WriteBackupText` were used, the **path** would depend on the machine (`GetBackupDir`). The **bytes** would not. This packet never wrote that live path.

---

## 10. Test counts

| Suite | This packet | Total after ARCH-11 |
|---|---|---|
| HTML `test_laegh.js Sirman_Final.html` | +4 locks | **837/837 PASS** |
| Core `Sirman.Core.Tests` | +26 (T1–T20 + write-semantics / Node pretty / contract / consume-off / Phonebook-SQLite lock) | **606/606 PASS** |

HTML locks:

- `_buildFullBackupData` SHA-256 unchanged (ARCH-9D)
- `exportData` / `doAutoSave` still pretty-print; no `consumeBackupSnapshot`
- `WriteBackupText` still UTF-8 no BOM; `GetBackupDir` still `Sirman/backup`
- `FinalizeBackup` still does not write disk
- Restore / Phonebook / `resetAll` / SQLite project still present
- no `.sirmanbak`

Core tests use Node `JSON.stringify` as the HTML pretty-print golden.

---

## 11. Existing suite results

| Suite | Result |
|---|---|
| HTML | **837/837 PASS** (833 previous + 4 ARCH-11) |
| Core | **606/606 PASS** (580 previous + 26 ARCH-11) |

Logs:

- `/opt/cursor/artifacts/arch11-html-tests.log`
- `/opt/cursor/artifacts/arch11-core-tests.log`

---

## 12. No live-data confirmation

- Synthetic fixture only (`علی` / `مریم` / `INVUID-000001`).
- Temp files under `sirman-arch11-<guid>` in OS temp.
- `Host.WriteBackupText` / `GetBackupDir()` not invoked.
- No shop backup files read or written.

---

## 13. No Restore confirmation

- Tests call `BackupFinalizer` + `BackupSnapshot.Parse` + `BackupValidator.Validate` only.
- HTML `importData` / `applyBackupMergeSections` / `applyBackupReplaceSections` / `resetAll` still present and unused by this packet.
- Core `BackupDryRunService` still `Applied = false`.
- `JsonBackupRepository.TbdMarker` remains `html-backup-engine`.
- `ConsumeBackupSnapshot` not added to export/autosave.

---

## 14. No Phonebook / SQLite confirmation

- `savePBContact` / `renderPB` unchanged (HTML lock).
- `Sirman.Persistence.Sqlite` project untouched.
- No `*.db` / `*.sqlite` written in the synthetic temp directory.

---

## 15. Remaining integrity gaps

1. **Stored SHA-256 is not verified** against the canonical digest (T10).
2. **Pretty-print / CRLF / BOM** are outside the hashed payload (T12, T13).
3. **Top-level key order** can change canonical SHA-256 without failing the validator (T14b).
4. **`printCenter` and other non-section keys** are not in `sectionChecksums`.
5. **Exact disk bytes** are not a first-class integrity object.
6. **Host write path still targets the live shop backup directory** — production persist is not what this synthetic test executed.
7. Restore apply remains HTML. Consume-on-export remains off.
8. No `backupId`, no `.sirmanbak`, no sidecar — by design for this packet.

---

## 16. Recommendation for exact-byte integrity

Do **not** redefine today’s SHA-256 input as pretty disk bytes without an explicit later packet. Pretty-print is currently a display/write representation, not the digest.

A future exact-byte design should hash, as a **new** field (not a silent replacement):

```text
SHA-256(UTF-8 disk bytes as written)
  encoding = UTF-8 no BOM
  pretty = JSON.stringify(_, null, 2)  // LF, 2-space
```

…or freeze a binary container. Until then, keep the canonical compact digest as the semantic checksum.

Smaller step than exact-byte: **compare the already-stored `checksum` hex to `BackupCanonicalChecksum.Sha256Hex`** when `checksumAlgo === "SHA-256"`. That closes T10/T14b detection for hashed payload without changing the hash definition, without `.sirmanbak`, and without Restore.

---

## 17. Next safest architectural step

**Close the stored-digest check** in Core `BackupPortableIntegrity` / HTML P1C-7 (claimed `SHA-256` must equal canonical hex), still:

- no Restore cutover
- no checksum *input* change
- no `backupId` / `.sirmanbak` / sidecar
- no consume-on-export
- no P1C-8

Do not extract `_buildFullBackupData`. Do not implement Merge/Replace in Core.

---

## Files

| File | Role |
|---|---|
| `desktop/Sirman.Core.Tests/BackupDiskRoundTripTests.cs` | T1–T20 + write semantics |
| `desktop/Sirman.Core.Tests/HtmlPrettyJson.cs` | test-only HTML pretty-print replica |
| `test_laegh.js` | production path locks |
| this report | evidence |

Production HTML / Host / Core Backup engines were **not** modified.

---

## Packet questions

**Q1. Can a finalized Backup be written and re-read from actual disk bytes?**  
YES. Synthetic temp file, `ReadAllBytes` → UTF-8 decode → parse. T1.

**Q2. Is the reparsed object semantically identical?**  
YES. Compact `BackupJsJson.Stringify` of pre-write and post-read match. T2.

**Q3. Does validation work on the reopened file alone?**  
YES. `BackupValidator.Validate(snapshot.Data)` after `BackupSnapshot.Parse` of disk JSON. T3 / T20.

**Q4. Does scalar/data tampering fail?**  
YES. `phonebook[0].fn` → INVALID via `sectionChecksums`. T4.

**Q5. Does record deletion fail?**  
YES. Counts + section hash. T6.

**Q6. Does record addition fail?**  
YES. Counts + section hash. T7.

**Q7. Does itemCounts tampering fail?**  
YES. `countMismatches`. T8.

**Q8. Does sectionChecksums tampering fail?**  
YES. T9.

**Q9. Does checksum tampering fail?**  
NO. Stored hex is excluded from the hashed payload and is not compared to the digest. T10 MAY REMAIN VALID under the current contract.

**Q10. Can exportedAt change without checksum failure under current contract?**  
YES. Canonical SHA-256 unchanged; validator VALID. T11.

**Q11. Can whitespace change without checksum failure?**  
YES. T12.

**Q12. Can newline change without checksum failure?**  
YES. LF→CRLF still VALID. T13.

**Q13. What exact file-byte changes are currently outside integrity coverage?**  
Pretty whitespace, CRLF vs LF, optional BOM, stored `checksum` field, top-level key order, non-section keys such as `printCenter`, filename/extension.

**Q14. Can the backup be validated without live app state?**  
YES. Core Parse + Validate on JSON alone. T20.

**Q15. Did live data change?**  
NO. Synthetic temp only.

**Q16. Did Restore change?**  
NO. HTML Merge/Replace untouched; DryRun still `Applied = false`.

**Q17. Did Phonebook change?**  
NO.

**Q18. Did SQLite change?**  
NO.

**Q19. What is the next safest architecture/integrity step?**  
Verify claimed SHA-256 against the existing canonical digest (close T10/T14b) without changing hash input, format, Restore, or export inspection.
