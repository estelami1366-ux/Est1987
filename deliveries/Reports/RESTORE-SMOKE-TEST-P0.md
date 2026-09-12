# SIRMAN — RESTORE SMOKE TEST P0

**Date:** 1405/06/21 (2026-09-12)
**Mode:** NON-DESTRUCTIVE PREFLIGHT
**Packet:** Restore smoke test P0
**Authority:** AUTHORIZED — NON-DESTRUCTIVE VERIFICATION ONLY
**Stop reason:** User backup file is not on this VM; shop Windows SIRMAN is not this environment.

```text
RESTORE SMOKE TEST = PREFLIGHT ONLY
ENVIRONMENT = CLOUD_LINUX / BACKUP_ABSENT
REAL COMPANY DATA TOUCHED = NO
ORIGINAL BACKUP MODIFIED = NO
VALID BACKUP ACCEPTED = NOT EXECUTED
CORRUPTED BACKUP REJECTED = NOT EXECUTED
FALSE MISMATCH = NOT EXECUTED
RESULT = NEEDS HUMAN VERIFICATION
```

---

## 1. Preconditions checked

| Check | Result |
|---|---|
| `SIRMAN_AGENT_RULES` (upload + persistent contract) | Read. No live destructive restore without the file and an isolated store. Linux/cloud must not be claimed as shop/Windows. |
| `docs/ARCHITECTURE_RULES.md` | Read. Restore path remains HTML BackupEngine; no architecture change in this packet. |
| `deliveries/Reports/RESTORE-VALIDATION-FIX-P0.md` | Read. Fix is consume original `sectionChecksums` before `migrateBackup`. |
| Required commit `b346e4a9078797cdd5ba948203cb3ad4d05101ad` | **HEAD is exactly this commit.** `git merge-base --is-ancestor` = yes. Message: `docs: point restore validation P0 report at the code-fix commit`. Parent code fix: `850f7a7137a6f5ba4cc833122b8d367db9d4c2c6`. |
| App in that commit | `1405.6.16α` (`SIRMAN_VERSION.json`, HTML `meta name="app-version"`). |
| `consumeBackupSectionChecksums` in `Sirman_Final.html` | Present (4 call/definition hits). |

Product source was **not** edited for this packet.

---

## 2. Safety gate — restore stopped

Packet safety:

- Production / live company profile / restore onto company data: forbidden.
- Original user backup must not be modified.
- If an empty isolated environment cannot be guaranteed, **stop restore** and write preflight only.

This VM is a Linux cloud agent. It has no shop `localStorage`, no company profile, and no Windows `Sirman.exe` session. That part is isolated.

The required **input** is missing:

`Laegh_backup__۱۴۰۵-۰۶-۲۱_.json`

Search (name needles `Laegh_backup`, `۱۴۰۵-۰۶-۲۱`, `1405-06-21`, `۱۴۰۵_۰۶_۲۱`) over `/workspace`, `/tmp`, `/opt/cursor`, `/home/ubuntu`, `/home/ubuntu/.cursor`:

**NAME_HITS = 0.**

Uploads for this turn contain only `RESTORE-SMOKE-TEST-P0_a37a.md`. No JSON backup was attached.

Therefore restore was **not started**. A synthetic fixture would not be the user’s backup and would not satisfy this packet.

Log: `/opt/cursor/artifacts/restore-smoke-test-p0-search.log`

---

## 3. Required evidence

| Field | Value |
|---|---|
| App version | `1405.6.16α` (source at `b346e4a`; shop GUI not launched) |
| Backup version | **UNKNOWN** — file not present |
| Expected backup schema | `1` (from packet; not verified on disk) |
| Environment | `CLOUD_LINUX` — empty of shop data; **not** a Windows SIRMAN session |
| Restore started | **NO** |
| Restore completed | **NO** |
| False checksum mismatch (`مطابقت ندارد` on valid sections) | **NOT EXECUTED** |
| Corrupted copy rejected | **NOT EXECUTED** (no copy made; original never found) |
| Sections loaded (invoices, products, inventory, phonebook, parts, services, warranties, sales, tasks, warehouses) | **NO** |
| Exception/error | None from restore (restore not invoked) |
| Data mutation outside test environment | **NO** |
| Original backup modified | **NO** (file never opened) |

---

## 4. What was not claimed

- Shop / Windows restore: **not verified**.
- Valid full backup accepted after the P0 fix: **not verified on the named file**.
- Negative tamper test on a copy: **not run**.

Automated HTML/Core tests from the previous packet remain the proof of the **synthetic** false-fail lock. They are not a substitute for this smoke test.

---

## 5. What a human must attach to finish this packet

Place a **read-only copy** of `Laegh_backup__۱۴۰۵-۰۶-۲۱_.json` on the agent (do not commit it to git). Then a follow-up can:

1. SHA-256 the original; copy to `/tmp`; never write the original.
2. Run the HTML restore pipeline in an **empty** in-memory store (not shop localStorage).
3. Record pre-migrate portable PASS, post-migrate apply without `مطابقت ندارد`, section counts.
4. Tamper only the `/tmp` copy and confirm fail-closed reject.
5. Re-hash the original and prove it is unchanged.

Until that file is on the VM, this packet stays preflight.

---

## 6. Files changed

| File | Change |
|---|---|
| `deliveries/Reports/RESTORE-SMOKE-TEST-P0.md` | This report |

No HTML, Core, backup format, Inventory, Print, Diagnostic, or Native Update changes.

---

## 7. Checkpoint

**YELLOW** — fix commit is in the tree; live restore of the named company backup was correctly refused.
