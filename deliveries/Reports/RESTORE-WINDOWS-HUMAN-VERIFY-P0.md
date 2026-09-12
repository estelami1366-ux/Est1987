# SIRMAN — RESTORE WINDOWS HUMAN VERIFY P0

**Date:** 1405/06/21 (2026-09-12)
**Mode:** STOP — no isolated Windows profile on this agent
**Packet:** HUMAN VERIFICATION ONLY
**Code changed:** NO

```text
RESTORE WINDOWS VERIFY = STOPPED
ENVIRONMENT = CLOUD_LINUX (Ubuntu 24.04; no Windows SIRMAN session)
VALID BACKUP RESTORED = NO
FALSE MISMATCH = NOT EXECUTED
DATA LOSS = NO
PRODUCTION DATA TOUCHED = NO
ORIGINAL BACKUP MODIFIED = NO
RESULT = NEEDS HUMAN VERIFICATION ON WINDOWS
```

---

## 1. Why restore was not run

Packet rule: if there is no empty test installation **and** no environment that can restore without overwriting operational data, **STOP**.

This agent:

| Fact | Value |
|---|---|
| OS | Linux 6.12 / Ubuntu 24.04.4 x86_64 |
| `Sirman.exe` / WinForms / WebView2 shop session | **NOT AVAILABLE** |
| Connected self-hosted Windows workers | **0** |
| Isolated empty Windows profile | **NO** |

Agent contract: Linux/cloud tests must not be claimed as shop/Windows verification.

Therefore Windows restore was **not started**. Isolated HTML restore from P1 remains the last executed evidence; it is **not** this packet.

---

## 2. What was already proven (not this packet)

From `deliveries/Reports/RESTORE-SMOKE-TEST-P1.md` (cloud, empty RAM):

- Fix commit `b346e4a9078797cdd5ba948203cb3ad4d05101ad` is in the tree
- App `1405.6.16α`
- Copy of today’s backup accepted; no false `مطابقت ندارد`
- Tampered copy rejected
- Original SHA-256 unchanged:

`05d5c332c94c93898b497f562b7c8a0c1d27a97290d7fb76e325f4d3016dbb0f`

Re-checked this turn: **same hash**. File not written. Not added to git.

---

## 3. Required Windows evidence (not collected)

| Field | Value |
|---|---|
| Windows version | **UNKNOWN** — SIRMAN GUI not launched |
| App version on Windows | not observed (source expects `1405.6.16α` / assembly `1405.6.16.1`) |
| Assembly version | not observed |
| Architecture | this VM is x86_64 Linux, not a Windows install |
| Restore UI availability | not observed |
| Test environment | **missing empty Windows profile** |
| Backup copy used | none (restore not started) |
| Restore result | **NOT RUN** |
| Section visibility | invoices / products / inventory / phonebook / parts / services / warranties / sales / tasks / warehouses — **NOT VERIFIED IN UI** |
| Error messages | none from Windows restore |
| Production data touched | **NO** |
| Original backup modified | **NO** |
| Final verdict | **STOP / NEEDS HUMAN** |

Log: `/opt/cursor/artifacts/restore-windows-human-verify-p0-stop.log`

---

## 4. Human checklist (empty Windows profile only)

Do **not** restore into the live shop profile.

1. Install or open SIRMAN `1405.6.16α` that contains commit `b346e4a` (or later with the restore-validation fix).
2. Use a **new empty** Windows user / empty `%AppData%\Sirman` test profile, or a machine with no operational data.
3. Copy `Laegh_backup__۱۴۰۵-۰۶-۲۱_.json` (do not overwrite the original). Confirm SHA-256 still `05d5c332c94c93898b497f562b7c8a0c1d27a97290d7fb76e325f4d3016dbb0f`.
4. Restore that **copy** only. Wait until finished.
5. Confirm no `مطابقت ندارد` on valid sections.
6. Open invoices, products, inventory, phonebook, parts, services, warranties, sales, tasks, warehouses — data present.
7. Confirm original backup hash unchanged and live shop data was not the restore target.

Then fill this same report’s evidence table from that session.

---

## 5. Files changed

| File | Change |
|---|---|
| `deliveries/Reports/RESTORE-WINDOWS-HUMAN-VERIFY-P0.md` | This STOP report |

No HTML, Core, checksum, migration, SQLite, or backup-format edits. Backup JSON not committed.

---

## 6. Checkpoint

**YELLOW** — Windows human verify correctly refused on Linux. Isolated HTML smoke remains PASS. Shop GUI restore still unverified.
