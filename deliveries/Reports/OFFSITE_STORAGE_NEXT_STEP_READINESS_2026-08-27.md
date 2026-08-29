# SIRMAN — OFFSITE 03 — STORAGE NEXT-STEP READINESS
## Prepare the next persistence slice — do NOT implement it

**Mode:** READ-ONLY audit  
**Packet filename date:** 2026-08-27  
**Agent clock:** Saturday 29 August 2026, ~15:38 UTC  
**Live product (unchanged):** `1405.6.3α` / assembly `1405.6.3.1`

```text
Product code changed: NO
Database changed:     NO
Storage changed:      NO
Backup/Restore:       NOT declared safe
Print:                not touched
Second entity migrated: NO
Canonical cutover:    NO
Dual-write:           NO
```

---

## Git

```text
Branch:   cursor/offsite-03-storage-readiness-fa01
HEAD:     e1c5768
          (cut from cursor/p0-5r2-desktop-build-fa01; no merge/rebase/reset)

Worktree (unrelated, not part of this report):
 M deliveries/migration/P1-services/services.candidate.sqlite
 M deliveries/migration/P1-services/services.sha256
```

Those two files are dirty because Core tests during the P0.5R2 desktop publish rewrote the candidate artifact (same 4 seed rows; SHA `5a2bdc08…` committed → `71cad1b6…` worktree). This packet does **not** commit them.

Read (not re-litigated): `P3_STORAGE_FORENSIC_AUDIT.md`, `STORAGE_ARCHITECTURE_DECISION_RECORD.md`, `P1_SERVICES_MIGRATION_REPORT.md`, `PHASE_3_CHANGE_GATE.md`, `ARCHITECTURE_RULES.md`, `DEVELOPMENT_GOVERNANCE.md`, `STABLE_BASELINE.md`, `PHASE_3_MIGRATION_TRACKER.md`.

---

## Current canonical store

```text
Canonical SoT:     HTML localStorage → RAM globals
CurrentStorage.Kind: html-localStorage-indexeddb
Owner:             Sirman_Final.html
JsonBackupRepository: still stub engine html-backup-engine
Desktop Host:      does NOT reference Sirman.Persistence.Sqlite
HTML services:     ls2 via svSvcs()  (Sirman_Final.html L15379, L16452)
SQLite canonical:  NO
```

`docs/PHASE_3_CHANGE_GATE.md` still says “There is no SQL persistence layer.” That sentence is **stale relative to the candidate assembly** (`desktop/Sirman.Persistence.Sqlite`). It does **not** mean live SoT moved. Live SoT is still browser storage. This is documentation lag, not a reason to change the ADR engine choice.

---

## P1 Services state

| Item | Finding |
|---|---|
| Candidate DB location | `deliveries/migration/P1-services/services.candidate.sqlite` (evidence). Windows target path in code: `%AppData%\Sirman\data\sirman.sqlite` via `CandidateStoragePaths` — **not** live on this Linux agent / not wired in Host |
| Engine | SQLite, Microsoft.Data.Sqlite, WAL, schema_version 1 |
| Source services count | **4** (HTML default `ls2` seed in `Sirman_Final.html`) |
| Candidate count | **4** (read-only inspect this worktree file) |
| Parity result | PASS on seed: id/code/field/hash; aggregate `97c5c95643338d81fa5303b5c600c306ed766ed96bb30241c57a1746fbad1306` (`services.parity.json`) |
| Candidate restore | P1 report: snapshot + staging restore PASS. Production Backup/Restore **not** used |
| Product runtime changes | **NO** — HTML/Host still LS; cutover flag was never turned on |
| Dual-write | **NO** |
| Shop live `ls2` count | **UNKNOWN** (not the HTML seed; shop session not on this VM) |
| Committed evidence SHA-256 | `5a2bdc0812a764f6e71ceac9047f2cebb7e171d31601522655203b1f848fe846` |
| Worktree file SHA-256 | `71cad1b698f7f658cf294a7bf63fc9c4b0e5000e57afacdc5c6bf7db2334e523` (test rewrite; 4 rows still; `application_version` in dirty file is `1405.6.3α`) |

Rows in the candidate file (read-only): S001–S004; `id_source=existing-code`; no generated ids.

P1 human verification status: **NOT DONE.** P1 final status remains `NEEDS HUMAN VERIFICATION`.

---

## P1 human verification status

```text
Shop Windows UI vs candidate DB:  NOT VERIFIED
Manual sample (first/middle/last / warr / price / extra fields): BLOCKED on this agent
UI still legacy:                  YES
SQLite canonical:                 NO
Host reads services from SQLite:  NO
localStorage ls2 removed:         NO
```

Do not treat HTML-seed 4-row parity as shop-live parity.

---

## Data integrity — H2

H2 (backup/restore, especially warranties) remains **HIGH**.

Forensic (`P3_STORAGE_FORENSIC_AUDIT.md`): replace + missing section → `[]`; persist `catch` empty; quota can drop `svWars`; success toast is not a durable commit.

```text
Backup/Restore declared safe: NO
H2 closed:                    NO
This P1 slice did not patch restore.
```

`svSvcs()` is still uncaught `setItem` (quota class R1 for services themselves). That is a reason to keep services on LS until HV, not a reason to migrate warranties next.

---

## Second-entity readiness

Packet forbids recommending invoices, warranties, inventory, or sales as the next slice without explicit evidence. None of those is recommended here.

| Candidate | Ready as next slice? | Why |
|---|---|---|
| **Remaining services slice** | **YES — after P1 HV, still candidate-only** | P1 imported HTML **seed** only. Shop live `ls2` is unknown. Host still unread. Cutover still off. Completing P1 is not a second entity. |
| **products** | **NO** | `saveProd` creates `inventory[code]` on insert and `delProd` deletes it (`Sirman_Final.html` L12996–L13002). A products table without inventory is a new split-brain. Inventory is out of scope unless a later packet justifies it. |
| **phonebook** | **NO** | No stable `contact_id`. Merge-by-phone. ADR deferred PK shape. Bad second PK exercise, same as it was a bad first. |
| **accounts** | **NO** | Legacy `id` exists, but money trx are written from invoice close / warranty / sale. Header-only migrate is incomplete; full migrate pulls those forbidden ledgers. |

**Candidate next entity (after P1 HV):** remaining **services** (live shop extract → same candidate DB → parity → still no cutover).  
**Not** products, phonebook, accounts, invoices, warranties, inventory, or sales.

---

## Prerequisite gates (before any further persist *implementation*)

1. Shop human verification of P1: UI services count and samples vs candidate dump; still reading LS.  
2. Explicit persist packet + Phase 3 Change Gate **Q3 = yes** (this OFFSITE report does **not** authorize code).  
3. No dual-write. Flag exclusive. `CurrentStorage.Kind` stays HTML until a later cutover packet.  
4. Do not delete `ls2`. Rollback = leave LS as SoT; keep candidate file.  
5. Do not declare HTML Backup/Restore the SQLite backup path (H2). Candidate snapshot API stays candidate-only.  
6. Print frozen; no print coupling.  
7. Desktop Host still must not silently start reading SQLite.  
8. Live shop extract must `STOP — BLOCKED` if `ls2` cannot be read (existing P1 extractor rule) — do not guess.

---

## Rollback prerequisite

```text
legacy localStorage / IndexedDB = rollback source
sirman.sqlite / services.candidate.sqlite = candidate only
```

If a future remaining-services import fails: keep LS; do not wipe candidate without an evidence copy. Checkpoint cited in P1: `daadcd1` (pre-P1 code). Do not delete browser storage in the same change that first enables a DB flag.

---

## Required tests (future packet — not this one)

Already required by ADR / P1, still required before any cutover:

- Repository get/save/delete + transaction rollback on SQLite  
- Staging restore abort leaves live candidate bytes unchanged  
- HTML suite green (no `ls2` key rename)  
- `CurrentStorage.Kind` still `html-localStorage-indexeddb` until cutover packet  
- Desktop csproj still without Persistence.Sqlite reference until Host wiring is explicitly authorized  
- Print suite untouched  
- Parity: count / id / code / field / hash on **shop-extracted** rows, not only HTML seed

Do not encode unproven shop row counts into tests in this packet (none added).

---

## What must be verified on shop Windows

```text
1. Open Sirman.exe (current version). Services page still works from localStorage.
2. Count services in UI. Compare to candidate dump (4 seed rows may NOT match shop).
3. Spot-check first / middle / last row: code, name, cat, price, warr.
4. Confirm a newly saved service still survives refresh via ls2 (not SQLite).
5. Confirm Backup/Restore of warranties is still treated as HIGH-risk (H2) — do not sign off restore as safe.
6. Confirm print is unrelated and remains shop-unverified physically.
```

Until (1)–(4) pass, remaining services import from live shop is not human-ready, and no second entity starts.

---

## Whether a second migration is authorized now

```text
NO
```

P1 has no shop HV. This packet is read-only. Do not migrate a second entity. Do not enable SQLite as canonical. Do not add dual-write.

---

## Final decision

```text
A = READY AFTER P1 HUMAN VERIFICATION
```

Meaning: storage **design** (ADR) and P1 **candidate infrastructure** are enough to plan the **next persistence work** after humans verify P1. That next work is the **remaining services slice** (live shop → candidate, still no cutover). It is **not** a products/phonebook/accounts/invoice/warranty/inventory/sales migrate.

Not B: forensic OPTION A + ADR + P1 seed parity already exist; missing shop counts are exactly the HV gate, not a new forensic program.

Not C: SQLite-as-candidate, WAL, Host-not-wired, LS-as-SoT still match the ADR. Gate-doc lag (“no SQL layer”) is stale wording, not a design reversal.

This file does **not** authorize implementation.

```text
Product code changed: NO
Database changed: NO
Storage changed: NO
Final status: COMPLETED
STOP — WAIT FOR REVIEW.
```
