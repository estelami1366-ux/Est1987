# SIRMAN — ARCH-5 Core Backup Finalize / Serializer Extraction

**Date:** 2026-09-04  
**Packet:** Extract ONLY pure backup finalization / serialization. Not live export. Not `_buildFullBackupData`.  
**Product version left unchanged:** `1405.6.3α`  
**Branch:** `cursor/arch-5-core-backup-serializer-fa01`  
**Base:** `cursor/arch-4-core-backup-dry-run-fa01`  
**HTML engine file:** `Sirman_Final.html` **not modified**

---

## Phase 3 Change Gate

```text
CHANGE: ARCH-5 Core backup finalize/serializer extraction
CLASS: Pure extraction of HTML finalizeBackupPackage + attachChecksum + canonical SHA-256
Q1: CAPABILITY — Core can finalize a JSON snapshot without browser RAM or disk
Q2: RunBusiness / Host: NO (not wired)
Q3: Persistence: NO live SoT. Synthetic JSON only
Q4: Printing: NO
Q5: HTML-only: PRESERVED — exportData / attachChecksum remain HTML
Q6: New transport/DB/ACL: NO
RESULT: PASS
AUTHORITY: explicit user packet ARCH-5 2026-09-04
```

Live Backup, live Restore, Merge, Replace, Host bridge, Phonebook, resetAll, SQLite, and `JsonBackupRepository` were not started. ARCH-6 and P1C-8 were not started.

---

## 1. Exact HTML functions extracted

Forensic source: `Sirman_Final.html` (live engine).

| HTML function | Role | Extracted? |
|---|---|---|
| `finalizeBackupPackage` | magic, schemaVersion, applicationVersion, attachmentsIndex, sectionChecksums, manifest | YES → `BackupFinalizer.ApplyFinalizePackage` |
| `attachSectionChecksums` | djb2 map; skip metadata keys; `sections` or `Object.keys` | YES → `BackupFinalizer.AttachSectionChecksums` |
| `backupSectionHash` | djb2 of `JSON.stringify` over UTF-16 code units | reuse ARCH-2 `BackupCanonicalChecksum.SectionHash` |
| `collectAttachmentIndex` | walk warranties/sales/invoices docs | reuse ARCH-3 `BackupSchemaMigrations.CollectAttachmentIndex` (always rebuild) |
| `buildBackupManifest` | portable metadata object | reuse ARCH-3 `BackupSchemaMigrations.BuildBackupManifest` |
| `backupChecksumPayload` | drop top-level `exportedAt` / `checksum` / `checksumAlgo` | reuse `BackupCanonicalChecksum.Payload` |
| `backupChecksumCanonicalString` | compact `JSON.stringify(payload)` | reuse `BackupCanonicalChecksum.CanonicalString` |
| `attachChecksum` | SHA-256 of canonical UTF-8, or `none` if no subtle | YES → `BackupChecksumMode.Sha256` / `None` |
| `_buildFullBackupData` | reads live browser RAM/state; sets `exportedAt` | **NO** |
| `exportData` / `buildBackupObject` | live assembly + mutate + download | **NO** |
| `importData` / merge / replace | live restore | **NO** |

### Live export order (unchanged)

```text
data = _buildFullBackupData()          // RAM; NOT extracted
data.origin = 'manual'
finalizeBackupPackage(data, origin, kind)   // mutates data
attachChecksum(data)                        // mutates; WebCrypto
JSON.stringify(data, null, 2)               // pretty DISK bytes — NOT the hash
```

`finalizeBackupPackage` does **not** call `attachChecksum`. They are sequential. `exportedAt` is **not** assigned inside finalize.

### HTML mutation / globals (frozen, not copied into Core as mutation)

- HTML **mutates** the caller object (`data.magic = …`, `data.sectionChecksums = map`, `data.checksum = hex`).
- Core **clones first** (`CloneBackupData` = `data || {}` then compact stringify/parse). Caller is unchanged.
- HTML finalize does **not** call `Date.now()`. `exportedAt` comes from `_buildFullBackupData`.
- HTML `attachChecksum` uses `crypto.subtle` / `TextEncoder`. Core uses `SHA256.HashData` on the same UTF-8 bytes. `None` emulates file:// (`checksum=""`, `checksumAlgo="none"`).
- Property order: existing keys keep position; new keys append. Assigning an existing key (e.g. stale `attachmentsIndex`) updates in place.
- `attachSectionChecksums` skip set: `version, exportedAt, origin, checksum, checksumAlgo, manifest, magic, schemaVersion, sectionChecksums, applicationVersion, attachmentsIndex`.
- Keys source: `data.sections && data.sections.length ? data.sections : Object.keys(data)`. Empty `sections` (`length===0`) falls back to `Object.keys`.
- Finalize **always** rebuilds `attachmentsIndex` (unlike schema 0→1, which fills only if falsy).
- `attachChecksum` **always overwrites** an existing checksum when SHA-256 mode runs. Unknown algo is left untouched only in `LeaveUnchanged` (verify-time concern, not attach).

---

## 2. Exact Core classes/files created

```text
desktop/Sirman.Core/Backup/
  BackupFinalizeModels.cs     BackupChecksumMode, BackupFinalizeRequest, BackupFinalizeResult
  BackupFinalizer.cs          FinalizePackage / AttachChecksum / Finalize

desktop/Sirman.Core.Tests/
  BackupFinalizeGolden.json
  generate-backup-finalize-golden.js
  BackupFinalizeTests.cs

test_laegh.js                 ARCH-5 G1/G2/G3 lock tests only
```

Touched existing serializer (Unicode only; see §4): `BackupJsJson.cs` — U+2028/U+2029 are **not** escaped, matching current HTML `JSON.stringify` (ES2019 / Node 22 / Chromium). ARCH-2/3/4 goldens contain no LS/PS, so their SHA-256 values did not change.

Not created: backupId, sidecar checksum, disk-byte checksum, ZIP, encryption, compression.

---

## 3. Input/output contract

**Input:** `JsonNode` snapshot + optional `origin`, `kind`, `nowMs`, `stampExportedAt`, `checksumMode`. No filesystem. No browser APIs. No live application state.

**Output:** `BackupFinalizeResult` — clone `Data`, `CanonicalString`, `Sha256Hex` (computed), stored `Checksum` / `ChecksumAlgo`, `SectionChecksums`, `Manifest`, `AttachmentsIndex`, `ExportedAt`, diagnostics `Log`.

```text
HTML data assembly (_buildFullBackupData)     [still HTML]
        ↓  JSON snapshot
Core finalization/serialization (this packet)
        ↓  BackupFinalizeResult
NOT wired to live Backup / Restore
```

`null` / JS-falsy package → `{}` then finalize (HTML `data || {}`).

---

## 4. Canonicalization contract

P1C-7 is preserved **exactly**:

SHA-256 input = UTF-8 bytes of compact `JSON.stringify`-equivalent of the backup object after excluding **only** top-level:

- `exportedAt`
- `checksum`
- `checksumAlgo`

Not excluded (therefore inside the hash domain):

- `manifest` (including `manifest.exportedAt`)
- `sectionChecksums`
- `attachmentsIndex`
- `magic` / `schemaVersion` / `applicationVersion`
- collections and all other keys

Rules frozen:

- Key order = insertion order (not sorted)
- Whitespace = compact (no pretty spaces/newlines)
- Unicode = HTML `JSON.stringify` (UTF-8; U+2028/U+2029 passed through)
- Numbers = JSON number tokens as produced by `JSON.stringify`

**The pretty-printed disk representation is NOT the hashed payload.**  
Live export writes `JSON.stringify(data, null, 2)`. Hashing those disk bytes would **not** match `verifyChecksum`. Core test `PrettyDiskJson_IsNotTheHashedPayload` asserts compact canonical ≠ indented disk JSON and the SHA-256 values differ.

---

## 5. SHA-256 contract

| Mode | Stored `checksum` | `checksumAlgo` | When |
|---|---|---|---|
| `Sha256` | 64-char lowercase hex of canonical UTF-8 | `SHA-256` | HTML path with `crypto.subtle` (exe / secure context) |
| `None` | `""` | `none` | HTML path without subtle (file://) |
| `LeaveUnchanged` | whatever was on the clone | unchanged | `finalizeBackupPackage` only |

`BackupFinalizeResult.Sha256Hex` is **always computed** from the canonical string, even when not stored (`none` / `leave`). That is diagnostics, not a new on-disk claim.

Existing checksum: SHA-256 attach **overwrites** (HTML `attachChecksum`). Leave mode preserves MD5/`deadbeef` (T10). No algorithm upgrade in ARCH-5.

---

## 6. sectionChecksums behavior

Always rebuilt by finalize (overwrite).

- Hash: djb2 of `JSON.stringify(section)` over UTF-16 code units (`backupSectionHash`).
- Skip metadata keys listed in §1.
- Iterate `data.sections` when non-empty; else `Object.keys(data)` at the moment after magic/schemaVersion/applicationVersion/attachmentsIndex have been written.
- `undefined` keys skipped; JSON `null` **is** hashed (`"null"`).
- Pre-existing wrong map is discarded (T11). Key **position** of an already-present `sectionChecksums` field is preserved.

---

## 7. exportedAt behavior

HTML finalize does **not** stamp `exportedAt`. Core default matches that.

Optional `StampExportedAt` + injected `nowMs` writes `new Date(nowMs).toISOString()` equivalent (`yyyy-MM-ddTHH:mm:ss.fffZ`) on the **clone only**. Core never calls `DateTime.Now` / `DateTimeOffset.UtcNow`.

P1C-7: mutating **top-level** `exportedAt` after a package exists does **not** change SHA-256 (T6).  

`manifest.exportedAt` **is** hashed. Re-running finalize after changing `exportedAt` rebuilds the manifest and **does** change SHA-256. That is current HTML behavior, not a bug introduced here.

---

## 8. Input immutability

HTML mutates. Core clones.

Tested: stringify(input) before == after; `ReferenceEquals` false; writing `probe` on `result.Data` does not leak into caller (T15). Throw path (non-array `warranties`) also leaves caller JSON identical.

---

## 9. Determinism

Identical input + identical request (`nowMs`, mode, origin, kind) → identical compact JSON and SHA-256 (T16, T17).

Finalize of an already-finalized clone is idempotent for SHA-256 mode (T17 second pass).

---

## 10. HTML/Core golden equivalence

19 fixtures generated by `generate-backup-finalize-golden.js` executing the **live HTML functions** (not a rewritten rule sheet). Core must match:

- canonical payload string
- SHA-256 hex
- sectionChecksums
- attachmentsIndex
- manifest
- compact JSON of finalized package
- stored checksum / checksumAlgo / exportedAt / magic / applicationVersion

HTML G1 re-runs every fixture against current `Sirman_Final.html` and requires byte-identical compact JSON + canonical + SHA-256 of canonical.

**No HTML edits were made to pass.** One Core serializer correction (U+2028/U+2029 no longer escaped) was required so Core matches modern HTML `JSON.stringify`. ARCH-2/3/4 goldens have no LS/PS characters; their hashes are unchanged (195/195 backup tests including ARCH-2/3/4 still PASS).

---

## 11. Test counts

| Suite | Count |
|---|---|
| ARCH-5 golden fixtures (T1–T19) | 19 |
| ARCH-5 Core `BackupFinalizeTests` | 40 (19 theory + 21 facts including T20–T22) |
| HTML ARCH-5 G1/G2/G3 | 3 |
| Full HTML | **787/787** (784 previous + 3 ARCH-5) |
| Full Core | **437/437** (397 previous + 40 ARCH-5) |

T1 ordinary · T2 empty collections · T3 Persian · T4 nested · T5 null field · T6 exportedAt mutate · T7 existing checksum overwrite · T8 algo none · T9 SHA-256 stored=computed · T10 unknown MD5 left · T11 sectionChecksums rebuilt · T12 attachmentsIndex rebuilt · T13 itemCounts copied into manifest · T14 insertion order · T15 immutability · T16 injected nowMs · T17 repeated finalize · T18 Unicode/UTF-8 · T19 null → empty package · T20 ARCH-2 validator on finalized T1 · T21 ARCH-3 migrator schema0 · T22 ARCH-4 dry-run schema0.

---

## 12. Full-suite results

```text
node test_laegh.js Sirman_Final.html
  کل تست‌ها: 787
  ✅ موفق: 787
  ❌ ناموفق: 0

dotnet test desktop/Sirman.Core.Tests -c Release
  Passed: 437  Failed: 0  Skipped: 0
```

Logs: `/opt/cursor/artifacts/arch5-html-tests.log`, `/opt/cursor/artifacts/arch5-core-tests.log`.

---

## 13. Existing P1C regression

P1C-1..P1C-7 HTML groups still PASS inside the 787 run (required collections, structural, portable, SHA-256 vs pretty-print).  
ARCH-2 validator, ARCH-3 migrator, ARCH-4 dry-run Core tests PASS (included in 437).  
`JsonBackupRepository.TbdMarker` remains `"html-backup-engine"`.

---

## 14. Confirmation (unchanged live surfaces)

| Surface | Status |
|---|---|
| `Sirman_Final.html` | **unchanged** (git diff empty) |
| Live Backup (`exportData` / `buildBackupObject`) | still HTML `finalizeBackupPackage` + `attachChecksum` |
| Live Restore (`importData`) | still HTML validators + migrate + merge/replace |
| Live data / SoT | not touched |
| Phonebook (`savePBContact`) | not touched |
| SQLite / P1 services sqlite | not in this commit |
| Host (`SirmanHostObject`) | not touched |
| `JsonBackupRepository` | still TBD stub |
| `resetAll` / Merge / Replace | not touched |
| `_buildFullBackupData` | still HTML-only |

HTML G2/G3 assert no `BackupFinalizer` reference in `exportData` / `importData`.

---

## 15. Known gaps

- `_buildFullBackupData` still HTML (intentional). It is the live RAM assembly layer.
- Core API is not connected to live Backup or Restore.
- HTML `attachChecksum` catch path (`checksumAlgo='error'`) is not a Core mode; Core SHA-256 uses `SHA256.HashData` and does not invent an error algo.
- Array-root packages: HTML can hang named fields on an array; `JSON.stringify` drops them. Live export never produces this. Core treats non-objects as non-package snapshots.
- Throw diagnostics for `warranties:{}` use `BackupMigrationException` (same helper as ARCH-3), not HTML `TypeError` message. Not in the matching golden.
- `backupId`, sidecar checksum, exact disk-byte checksum, ZIP, encryption, compression: not in this format / not this packet.
- `nowMs` is ignored unless `StampExportedAt` is true (HTML finalize is clock-free).

---

## 16. Next safest extraction

**Do not extract `_buildFullBackupData` next** — it reads live browser RAM (`warranties`, `invoices`, IndexedDB docs, `new Date().toISOString()`, etc.).

Safest next step (not done): **ARCH-6 optional cutover of the finalize step only** — HTML still assembles the snapshot; Core `BackupFinalizer` writes checksum/manifest on a clone; live Restore stays HTML. That uses the boundary this packet established.

Do **not** start merge/replace, Host backup, Phonebook, or SQLite in that step.

---

## Q1–Q16

**Q1. Is Core finalization pure?**  
YES. `BackupFinalizer` takes `JsonNode` + request flags; no filesystem, Host, DOM, or live collections.

**Q2. Does it mutate the input?**  
NO. Clone first. T15: caller stringify identical; result is a different node.

**Q3. Does it use browser/runtime state?**  
NO. No `crypto.subtle`, no `window`, no `DateTime.Now` / `UtcNow`. Time only via injected `nowMs` when stamping.

**Q4. Does canonical SHA-256 exactly match HTML?**  
YES. 19/19 golden `sha256Hex` + `canonicalString` equal; HTML G1 re-hashes canonical with Node SHA-256.

**Q5. Does exportedAt remain outside the checksum domain?**  
YES at **top level** (P1C-7 exclusions). T6 mutate-after: same SHA-256. `manifest.exportedAt` remains inside the hash (current HTML).

**Q6. Is property ordering preserved?**  
YES. T14 compact JSON starts with `"zebra":1`; existing keys keep position; new finalize keys append.

**Q7. Are checksumAlgo/none semantics preserved?**  
YES. T8 stores `none`+empty; T9 stores SHA-256; T10 leave keeps `MD5`/`deadbeef`; T7 attach overwrites.

**Q8. Is sectionChecksums behavior identical?**  
YES. Same skip set, same djb2, always rebuilt. T11/T12 goldens match compact JSON.

**Q9. Is finalize deterministic with injected time?**  
YES. T16 same `nowMs` twice → same ISO `2023-11-14T22:13:20.000Z` and same SHA-256. No system clock in Core finalize.

**Q10. Was `_buildFullBackupData` extracted?**  
NO. Still HTML. G2 requires `exportData` to call it.

**Q11. Was live Backup changed?**  
NO. `exportData` still HTML finalize + attachChecksum. No `BackupFinalizer` in HTML.

**Q12. Was live Restore changed?**  
NO. `importData` unchanged; G3 forbids `BackupFinalizer` there.

**Q13. Did live data change?**  
NO. No SoT / localStorage / shop files in this commit.

**Q14. Did Phonebook change?**  
NO. `savePBContact` still present; not edited.

**Q15. Did SQLite change?**  
NO. Not in the ARCH-5 commit. `JsonBackupRepository` remains `"html-backup-engine"`.

**Q16. What is the next safest extraction?**  
Optional ARCH-6: HTML assembly snapshot → Core `BackupFinalizer` only. Do not extract `_buildFullBackupData`. Do not wire Restore. Do not start P1C-8.

---

## STOP

ARCH-6 was not started. P1C-8 was not started. Core is not connected to live Backup or live Restore.
