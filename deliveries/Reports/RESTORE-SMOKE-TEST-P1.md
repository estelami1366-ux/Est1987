# SIRMAN — RESTORE SMOKE TEST P1

**Date:** 1405/06/21 (2026-09-12)
**Mode:** NON-DESTRUCTIVE / TEST-ISOLATED
**Packet:** Restore smoke test P1 — read-only backup delivery + isolated restore
**Fix commit present:** `b346e4a9078797cdd5ba948203cb3ad4d05101ad`
**This report commit:** recorded at branch tip after docs commit

```text
RESTORE SMOKE TEST = COMPLETE
ENVIRONMENT = TEST/ISOLATED (cloud Linux, empty in-memory HTML restore; NOT shop Windows)
BACKUP VERIFIED = YES
VALID BACKUP ACCEPTED = YES
FALSE MISMATCH = NO
CORRUPTED BACKUP REJECTED = YES
REAL COMPANY DATA TOUCHED = NO
ORIGINAL BACKUP MODIFIED = NO
BACKUP COMMITTED TO GIT = NO
RESULT = PASS (isolated HTML restore; shop GUI not run)
```

---

## 1. Preconditions

| Check | Result |
|---|---|
| Agent / architecture rules | Read. No production restore. Linux is not claimed as shop Windows. |
| Fix commit `b346e4a` | Ancestor of HEAD. HTML `consumeBackupSectionChecksums` present. |
| App version | `1405.6.16α` |
| Isolated empty store | **YES** — Node process, empty arrays, in-memory `localStorage` mock only. No shop profile. |
| Backup outside Git | **YES** — uploads path outside `/workspace`. Never `git add`. |
| Original backup written | **NO** — SHA-256 identical before and after. |

Production / live company merge-replace: **not used**. Apply ran only into empty mock RAM.

---

## 2. Backup verification (original, read-only)

User upload (filename mangled by the uploader; content is the named `Laegh_backup__۱۴۰۵-۰۶-۲۱_.json`):

| Field | Value |
|---|---|
| Stored path | `/home/ubuntu/.cursor/projects/workspace/uploads/Laegh_backup______-__-____4c8c.json` (outside repo) |
| Size | 4 124 708 bytes |
| SHA-256 | `05d5c332c94c93898b497f562b7c8a0c1d27a97290d7fb76e325f4d3016dbb0f` |
| magic | `SIRMAN_BACKUP` |
| schemaVersion | `1` |
| version / applicationVersion | `1405.6.16α` |
| exportedAt | `2026-09-12T10:40:14.485Z` |
| checksumAlgo | `SHA-256` (64-char hex present) |
| origin | `manual` |

Section counts in the file (no record payloads copied into this report):

| Section | Count |
|---|---|
| invoices | 4 |
| products | 53 |
| inventory | 51 keys |
| phonebook | 2730 |
| parts | 269 |
| services | 4 |
| warranties | 6 |
| sales | 17 |
| tasks | 17 |
| warehouses | 9 |

`sectionChecksums` present for 33 keys including all sections above.

Working copies: `/tmp/sirman-restore-smoke-p1/test-copy.json` (valid restore, hash unchanged) and `tamper-copy.json` (negative test only).

---

## 3. Valid restore (test copy, empty store)

Engine: live functions from `Sirman_Final.html` at the fix commit (`validateRequiredBackupCollections`, `validateBackupStructuralIntegrity`, `validateBackupPortableIntegrity`, `verifyChecksum`, `consumeBackupSectionChecksums`, `applySchemaMigrations`, `migrateBackup`, `validateBackupPackage`, `applyBackupReplaceSections`).

Observed order:

1. parse JSON  
2. required collections **OK**  
3. structural **OK**  
4. original `sectionChecksums` **OK** (0 mismatches)  
5. schema gate 1→1 **OK**  
6. package SHA-256 **OK** (`checksum ✓ تأیید شد`)  
7. consume original section hashes (in-memory flag)  
8. `migrateBackup` (17 log lines)  
9. portable re-query after consume: **OK**, 0 mismatches  
10. `validateBackupPackage`: **OK**, **zero** `مطابقت ندارد` warnings  
11. `applyBackupReplaceSections` on empty RAM: **no throw**

Loaded into empty mock (counts match file):

| Section | Loaded |
|---|---|
| invoices | 4 |
| products | 53 |
| inventory | 51 |
| phonebook | 2730 |
| parts | 269 |
| services | 4 |
| warranties | 6 |
| sales | 17 |
| tasks | 17 |
| warehouses | 9 |

False checksum mismatch: **NO**.

Proof the old bug would have fired: products djb2 before migrate `ef373f25`, after `migrateBackup` `f83747c5` (changed). After consume, those original hashes were **not** used to reject the restore.

---

## 4. Negative test (second copy only)

One product `name` character changed; package SHA-256 re-attached so the fail is the **section** hash, not the package digest.

Result: restore **stopped at `portable_before_migrate`**.

Error: `هش بخش products مطابقت ندارد`

No apply. Original upload hash still `05d5c332…`.

---

## 5. Required evidence

| Field | Value |
|---|---|
| App version | `1405.6.16α` |
| Git HEAD (before this docs commit) | `0f6286ae2f87bde6e7219da615e9c9cbb2bc7da8` (contains `b346e4a`) |
| Backup SHA-256 | `05d5c332c94c93898b497f562b7c8a0c1d27a97290d7fb76e325f4d3016dbb0f` |
| Backup version | `1405.6.16α` |
| Backup schema | `1` |
| Test environment | Empty in-memory SIRMAN HTML restore on cloud Linux |
| Restore started | **YES** (isolated) |
| Restore completed | **YES** (isolated apply into empty RAM) |
| False mismatch | **ABSENT** |
| Corrupted copy | **REJECTED** |
| Sections loaded | all ten requested; counts match file |
| Exceptions | none on valid path; tamper threw portable fail as designed |
| Mutation outside TEST | **NO** |
| Shop Windows GUI | **NOT RUN** |

Sanitized machine log: `/opt/cursor/artifacts/restore-smoke-test-p1-result.json`  
Harness output: `/opt/cursor/artifacts/restore-smoke-test-p1-run.log`

---

## 6. Files changed in git

| File | Change |
|---|---|
| `deliveries/Reports/RESTORE-SMOKE-TEST-P1.md` | This report (replaces P1 preflight) |

Backup JSON is **not** in git. HTML/Core were **not** edited in this packet.

---

## 7. Checkpoint

**GREEN** for isolated restore of the delivered copy against the P0 validation fix.  
**Not** shop/Windows live verification.
