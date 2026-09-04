# SIRMAN — P1C-7 Portable Backup Integrity

**Date:** 2026-09-04  
**Packet:** CODE + SYNTHETIC TESTS ONLY. No live shop data, real restore, Phonebook, SQLite, `resetAll`, SoT, cutover, or rewrite of shop backup files.  
**Product version left unchanged:** `1405.6.3α`  
**Branch:** `cursor/p1c7-portable-backup-integrity-fa01`  
**Base:** `cursor/p1c6-backup-structural-integrity-fa01`

P1C-1..P1C-6 rules **unchanged**.

---

## Phase 3 Change Gate

```text
CHANGE: P1C-7 portable backup integrity (canonical SHA-256 verify + sectionChecksums fail-closed)
CLASS: Safety bugfix of existing BackupEngine
Q1: CAPABILITY — restore integrity of claimed checksums only
Q2: RunBusiness / Host / Core: NO (WriteBackupText still writes the JSON string as-is)
Q3: Persistence: YES — validation + attachChecksum before encrypt; live SoT not mutated
Q4: Printing: NO
Q5: HTML-only: PRESERVED (checksumAlgo none still compatible)
Q6: New transport/DB/ACL: NO
RESULT: PASS
AUTHORITY: explicit user packet P1C-7 2026-09-04
```

---

## 1. Forensic trace (before the patch)

### Create

```text
RAM (_buildFullBackupData)
  → selective filter (optional)
  → finalizeBackupPackage
       magic, schemaVersion, applicationVersion
       attachmentsIndex = collectAttachmentIndex (derived)
       sectionChecksums = djb2(JSON.stringify(section)) for listed keys
       manifest = { magic, format, schemaVersion, applicationVersion,
                    exportedAt, origin, kind, itemCounts, sections, ... }
  → [encrypt path previously skipped attachChecksum]
  → attachChecksum
       IF no crypto.subtle → checksum='' checksumAlgo='none'
       ELSE SHA-256( UTF-8( JSON.stringify(payload) ) )
            payload = Object.keys(data) except exportedAt, checksum, checksumAlgo
  → serialize disk = JSON.stringify(data, null, 2)   // pretty, NOT the hashed bytes
  → write: download Blob / writeAutoSaveTarget / Host WriteBackupText(string)
```

Hashed bytes = compact `JSON.stringify` of a **RAM object** after finalize, **before** pretty-print. Disk bytes are pretty-printed JSON of the object **including** `checksum` / `checksumAlgo`.

### Verify (importData)

```text
read disk (FileReader text)
  → JSON.parse
  → unwrap / decrypt
  → required collections (P1C-1..5)
  → structural (P1C-6)
  → JSON.parse object → rebuild payload (same 3 exclusions)
  → SHA-256(canonical string) compare to stored checksum
  → (was: mismatch → confirm() could continue)
  → schema migrate → migrateBackup → itemCounts → merge/replace
```

No reconstruction of the original pretty-printed file bytes. Hash is over the parsed object, not the file.

`Host WriteBackupText` writes the string; it does not hash. `verifyLayerPayload` only runs `validateBackupPackage` (JSON parse of the stored layer string), not SHA-256.

---

## 2. Field-by-field: presence vs integrity

| Field | Exists? | Integrity implemented? |
|---|---|---|
| `magic` | YES `SIRMAN_BACKUP` | Marker only. Not hashed separately. Included in SHA-256 payload when present. |
| `schemaVersion` | YES | Version gate + required-collection map. Not a hash. |
| `version` / `applicationVersion` | YES | App version string. Included in payload. |
| `exportedAt` | YES | **Excluded from SHA-256.** Mutation does not fail checksum. Not an identity. |
| `manifest` | YES | Metadata copy. Included in payload. Not an independent hash. |
| `checksum` | YES when crypto exists | SHA-256 hex of canonical payload. Empty on `file://`. |
| `checksumAlgo` | YES `SHA-256` / `none` / `error` | Names the algorithm. Exclusion set is **not** stored in the file (hardcoded). |
| `sectionChecksums` | YES after finalize | djb2 of `JSON.stringify(section)`, not SHA-256. Was **warning-only** after migrate. |
| `attachmentsIndex` | YES derived | P1C-6 parent rule. Included in SHA-256 payload. Not a content hash of blobs. |
| `backupId` | **NO** | Layer records in IndexedDB have `LY-…` ids. Backup JSON has no stable identity. |

---

## 3. Answers to the ten investigation questions

**1. What exactly is hashed?**  
Object own-keys of the backup **except** `exportedAt`, `checksum`, `checksumAlgo`. Includes data arrays, `itemCounts`, `sections`, `manifest`, `sectionChecksums`, `attachmentsIndex`, `magic`, versions.

**2. Which bytes are hashed?**  
UTF-8 bytes of compact `JSON.stringify(payload)` (no pretty-print, default key order = `Object.keys` insertion order). **Not** the pretty-printed file bytes.

**3. When is the hash calculated?**  
After `finalizeBackupPackage`, immediately before (unencrypted) serialize/write. Now also before encrypt. Autosave: `buildBackupObject` → `attachChecksum` → pretty write.

**4. Where is the hash stored?**  
JSON fields `checksum` + `checksumAlgo` inside the same file. No sidecar `.sha256`. Host does not store a separate digest.

**5. Can the hash be recomputed from the persisted backup file?**  
YES, after `JSON.parse`: rebuild payload with the same exclusions, compact stringify, SHA-256. Pretty vs compact file whitespace does not matter.

**6. Is verification deterministic?**  
YES for the same parsed key order and values. JS `JSON.stringify` is deterministic for a given object key order. Parse preserves JSON key order from the file.

**7. Does verification happen after reopening the actual disk bytes?**  
YES on `importData` (FileReader → parse → verify). It does **not** hash the raw string; it hashes the re-parsed object. Autosave/Host write is not re-read for verify at write time.

**8. Can any mutation of the backup pass verification incorrectly?**  
Before this packet: YES in several ways — `confirm()` on SHA-256 mismatch; unknown algo → ok; digest catch → ok; strip checksum / set `none`; whitespace-only; `exportedAt` change; `file://` skip.  
After this packet: SHA-256 payload mutation FAIL-closed; unknown algo FAIL; digest error FAIL; `confirm` removed. Still pass: missing/`none` checksum (compatible); `exportedAt`; pretty whitespace; strip checksum entirely; no-crypto skip when SHA-256 claimed.

**9. Does the current format have a stable backup identity?**  
NO. No `backupId`. `exportedAt` is a timestamp and is excluded from the hash. IDB layer `id` is not in the portable JSON file.

**10. Can the backup be validated independently of the installed app?**  
PARTIAL. Self-describing enough to recompute if you know: SHA-256, compact JSON, exclude those three keys. That exclusion set is **not** written in the file. Needs WebCrypto or equivalent. `sectionChecksums` (djb2) can be checked without SHA-256. Cannot validate as “hash of these exact disk bytes” without the app’s canonicalization.

**Verdict before patch:** fields existed; integrity was **not** a real fail-closed portable disk-byte seal.  
**Verdict after patch:** claimed SHA-256 and present `sectionChecksums` are fail-closed and reproducible from parsed file JSON. Still not a raw-file-byte checksum. Still no `backupId`.

---

## 4. Collection / P1C-1..6 rules

Unchanged:

```javascript
var REQUIRED_BACKUP_COLLECTIONS = ['warranties', 'invoices'];
var REQUIRED_BACKUP_COLLECTIONS_FROM_SCHEMA = { 1: ['sales', 'parts', 'accounts'] };
```

`itemCounts` / attachment / duplicate rules from P1C-6 unchanged. `tasks` not required.

---

## 5. New behavior

| Claim | Result |
|---|---|
| No `checksum` / `checksumAlgo:'none'` | Compatible PASS (`skipped`) |
| `checksumAlgo` claimed and not `SHA-256` | FAIL — restore blocked |
| `SHA-256` match after parse | PASS |
| `SHA-256` mismatch | FAIL — **no confirm** |
| Digest exception | FAIL (was ok:true) |
| No WebCrypto but SHA-256 claimed | skip/unifiable warning (`unverifiable`) — HTML-only gap |
| `sectionChecksums` missing | Compatible PASS |
| `sectionChecksums` present, wrong type | FAIL |
| `sectionChecksums` present, mismatch | FAIL **before migrate** |
| `sectionChecksums` after migrate in `validateBackupPackage` | still warnings (migrate mutates records; cannot fail-close post-migrate) |

Order: parse → required → structural (P1C-6) → **portable (sectionChecksums + algo claim)** → schema gate → **verifyChecksum SHA-256** → migrate → itemCounts → preview → snapshot → merge/replace.

---

## 6. Exact files / functions

| File | Change |
|---|---|
| `Sirman_Final.html` | Canonical checksum helpers; fail-closed verify; sectionChecksums before migrate; encrypt hashes plaintext first |
| `Laegh_Final.html` | Byte-sync |
| `test_laegh.js` | P1C-7 T1–T18 |
| `deliveries/Reports/BACKUP_PORTABLE_INTEGRITY_P1C7_2026-09-04.md` | This report |

| Function | Role |
|---|---|
| `backupChecksumExcludedKey` / `backupChecksumPayload` / `backupChecksumCanonicalString` | What is hashed |
| `backupCryptoSubtle` | Resolve WebCrypto |
| `classifyBackupChecksumClaim` | none vs claimed SHA-256 vs other |
| `validateBackupSectionChecksums` | Present section hashes |
| `validateBackupPortableIntegrity` | Sync portable gate |
| `attachChecksum` / `verifyChecksum` | SHA-256 create/verify |
| `assertRequiredBackupCollections` | Throws on portable fail |
| `testRestoreBackup` / `BackupEngine.validate` / `importData` / `prepareNetworkWorkspacePull` | Gate before migrate |
| `exportData` encrypt path | `attachChecksum` before encrypt |

Not changed: Phonebook, SQLite, `resetAll`, required-collection registry, P1C-6 count/attachment/duplicate semantics, Host `WriteBackupText` hashing (none).

---

## 7. Test matrix

| Test | Result |
|---|---|
| T1 missing checksum compatible | PASS |
| T2 `checksumAlgo:none` compatible | PASS |
| T3 SHA-256 pretty disk roundtrip | PASS |
| T4 payload mutation FAIL | PASS |
| T5 `exportedAt` mutation PASS | PASS |
| T6 pretty vs compact whitespace PASS | PASS |
| T7 unknown algo FAIL | PASS |
| T8 sectionChecksums match PASS | PASS |
| T9 sectionChecksums mismatch FAIL | PASS |
| T10 missing sectionChecksums PASS | PASS |
| T11 portable fail → zero live mutation; importData has no checksum confirm | PASS |
| T12 historical fixture compatible | PASS |
| T13 warranties regression | PASS |
| T14 invoices regression | PASS |
| T15 sales regression | PASS |
| T16 parts regression | PASS |
| T17 accounts + P1C-6 counts regression | PASS |
| T18 tasks not required; `backupId` not invented | PASS |

---

## 8. Full-suite result

`node test_laegh.js Sirman_Final.html`

```text
کل تست‌ها: 775
موفق: 775
ناموفق: 0
```

Previous: 757/757. Added 18 P1C-7 tests.

---

## 9. Regression

P1C-1..P1C-6 groups remain green (T13–T17 plus original groups).

---

## 10. Live data / Phonebook / SQLite

- Live data: unchanged (synthetic tests; T11 zero mutation)  
- Phonebook: unchanged  
- SQLite: unchanged (sidecars unstaged)

---

## 11. Rules NOT enforced (insufficient or incompatible)

| Candidate | Why not |
|---|---|
| Hash of raw disk bytes | Would invalidate existing SHA-256 files; write is pretty-print after hash |
| Mandatory checksum for schema ≥ 1 | `file://` legitimately emits `none` |
| Fail when WebCrypto missing but SHA-256 claimed | Would block HTML-only restore of desktop files |
| `backupId` | Field does not exist; not invented |
| Fail `exportedAt` drift | Explicitly excluded from hash |
| Fail-close `sectionChecksums` **after** `migrateBackup` | Migration mutates records; hashes would false-fail |
| Encrypted envelope byte hash | Envelope is a different magic; inner plaintext now hashed before encrypt |
| Attachment blob bytes | Index is derived metadata, not file content |

---

## 12. Remaining integrity gaps

- Not a checksum of the exact UTF-8 file on disk  
- Exclusion set not self-described inside the JSON  
- Stripping `checksum` still compatible  
- No-crypto skip for claimed SHA-256  
- No portable `backupId`  
- Network pull is sync: SHA-256 digest not awaited there (sectionChecksums are)  
- `sectionChecksums` is djb2, not cryptographic  

---

## 13. Next safest step

Stop. Do not start a follow-on packet in this work.

Later investigation only: whether schema ≥ 1 exports in WebView2 (secure context) should refuse `checksumAlgo:'none'`, or whether a documented `checksumCanonical` string should be stored so a third party can verify without this source.

No recovery. No Phonebook. No SQLite. No live mutation.

---

## Final questions (packet)

**Q1. What is hashed?** Canonical object minus `exportedAt`/`checksum`/`checksumAlgo`.  
**Q2. Which bytes?** UTF-8 of compact `JSON.stringify(payload)`, not pretty file bytes.  
**Q3. When calculated?** After finalize, before write (and now before encrypt).  
**Q4. Where stored?** `checksum` + `checksumAlgo` in the JSON.  
**Q5. Recomputable from file?** YES after parse.  
**Q6. Deterministic?** YES for same parsed keys/values.  
**Q7. After reopening disk bytes?** YES parse-then-hash; not raw-byte hash.  
**Q8. Can mutation pass incorrectly?** Payload+SHA-256: NO. Strip checksum / none / no-crypto: YES (compatible). `exportedAt` / whitespace: YES by design.  
**Q9. Stable backup identity?** NO — `backupId` not in format; not added.  
**Q10. Independent of app?** PARTIAL — need the hardcoded exclusion set + SHA-256 or djb2 section hashes.
