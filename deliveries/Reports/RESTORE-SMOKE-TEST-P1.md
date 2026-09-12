# SIRMAN — RESTORE SMOKE TEST P1

**Date:** 1405/06/21 (2026-09-12)
**Mode:** STOP / PREFLIGHT
**Packet:** Restore smoke test P1 — read-only backup delivery + non-destructive test
**Stop reason:** Named backup copy was not delivered to this agent. Restore not started.

```text
RESTORE SMOKE TEST = PREFLIGHT ONLY
ENVIRONMENT = CLOUD_LINUX / BACKUP_ABSENT
BACKUP VERIFIED = NO
VALID BACKUP ACCEPTED = NOT EXECUTED
FALSE MISMATCH = NOT EXECUTED
CORRUPTED BACKUP REJECTED = NOT EXECUTED
REAL COMPANY DATA TOUCHED = NO
ORIGINAL BACKUP MODIFIED = NO
BACKUP COMMITTED TO GIT = NO
RESULT = NEEDS HUMAN VERIFICATION
```

---

## 1. Preconditions

| Check | Result |
|---|---|
| `SIRMAN_AGENT_RULES` | Read. Linux/cloud is not shop/Windows. No restore without the named file. |
| `docs/ARCHITECTURE_RULES.md` | Read. No architecture change in this packet. |
| `deliveries/Reports/RESTORE-VALIDATION-FIX-P0.md` | Read. |
| `deliveries/Reports/RESTORE-SMOKE-TEST-P0.md` | Read. P0 already stopped for the same missing file. |
| HEAD contains `b346e4a9078797cdd5ba948203cb3ad4d05101ad` | **YES** (`git merge-base --is-ancestor`). Current branch started at `f1dc8fad2fd8b1fec870f5eadc4b7a8545eb7e45`. |
| App version `1405.6.16α` | **YES** in `SIRMAN_VERSION.json` / HTML meta at that commit. |
| Isolated empty environment | Cloud VM has no shop profile. That is isolated, but the **input file is missing**. |
| Backup outside Git | Named file not present. In-repo `Laegh_AutoSave.json` was **not** used. |

Packet rule: if isolated restore of the supplied copy cannot be performed, **STOP**.

---

## 2. Step 1 — Verify backup — FAILED

Required name:

`Laegh_backup__۱۴۰۵-۰۶-۲۱_.json`

This turn’s uploads contain only `RESTORE-SMOKE-TEST-P1_8027.md`. No JSON backup.

Search needles `Laegh_backup`, `۱۴۰۵-۰۶-۲۱`, `1405-06-21` under `/workspace`, `/tmp`, `/opt/cursor`, `/home/ubuntu`, uploads:

**NAME_HITS = 0.**

| Field | Value |
|---|---|
| file path | **NOT FOUND** |
| file size | UNKNOWN |
| SHA-256 | UNKNOWN |
| applicationVersion | UNKNOWN |
| schemaVersion | UNKNOWN |
| exportedAt | UNKNOWN |
| magic | UNKNOWN |

Log: `/opt/cursor/artifacts/restore-smoke-test-p1-search.log`

`Laegh_AutoSave.json` exists inside the git tree. It is **not** the named file, must not be git-delivered as the company backup, and was not opened for restore.

---

## 3. Steps 2–5 and negative test — NOT RUN

| Step | Status |
|---|---|
| Create test copy | NOT RUN — no source file |
| Restore in TEST/ISOLATED | **NO** |
| False `مطابقت ندارد` check | NOT EXECUTED |
| Load invoices / products / inventory / phonebook / parts / services / warranties / sales / tasks / warehouses | **NO** |
| parse → structure → original sectionChecksums → migrateBackup → restore | NOT EXECUTED |
| Tamper-copy reject | NOT EXECUTED |

No SIRMAN GUI session. No `importData` / merge / replace against any store.

---

## 4. Required evidence

| Field | Value |
|---|---|
| App version | `1405.6.16α` (source; shop GUI not launched) |
| Git HEAD (start of this packet) | `f1dc8fad2fd8b1fec870f5eadc4b7a8545eb7e45` (contains fix `b346e4a`) |
| Backup SHA-256 | UNKNOWN |
| Backup version | UNKNOWN |
| Backup schema | UNKNOWN (packet expected `1`) |
| Test environment | CLOUD_LINUX — no shop data; restore not started |
| Restore started | **NO** |
| Restore completed | **NO** |
| False mismatch | NOT EXECUTED |
| Corrupted backup | NOT EXECUTED |
| Sections loaded | none |
| Exceptions | none from restore |
| Mutation outside TEST | **NO** |

---

## 5. How to complete P1

Attach the file as a **binary upload** to the agent, **outside git**, named `Laegh_backup__۱۴۰۵-۰۶-۲۱_.json` (or the exact copy path). Then a follow-up can hash it, copy to `/tmp`, restore into empty in-memory SIRMAN functions, tamper only the `/tmp` copy, and prove the original hash is unchanged.

Do not paste the backup into chat as the only delivery if the agent file picker does not persist JSON.

---

## 6. Files changed

| File | Change |
|---|---|
| `deliveries/Reports/RESTORE-SMOKE-TEST-P1.md` | This report |

No HTML/Core/backup-format change. The user backup was not added to Git.

---

## 7. Checkpoint

**YELLOW** — fix commit is in the tree; named backup copy still absent; restore correctly refused.
