# SIRMAN — MASTER PROJECT STATUS AUDIT

**Mode:** READ-ONLY — no source / print / storage / backup / version / build / package  
**Gregorian:** 31 August 2026  
**Timezone:** UTC  
**Agent:** Linux cloud VM (not the shop Windows PC)  
**Live product (source):** `1405.6.3α` / assembly `1405.6.3.1`

```text
Product code changed: NO
Print changed:        NO
Storage changed:      NO
Backup/Restore:       NO
Version changed:      NO
Build / package:      NO
Merge/rebase/reset/cherry-pick: NO
```

This document is the current-status map. It does not authorize implementation. `PRINT_SUBMITTED` is not physical PASS. Shop values not on this VM are **NOT OBSERVED**, not guessed.

---

## PHASE 3 CHANGE GATE (this packet)

```text
Requested change: documentation-only master status audit
Classification: A (governance report)
Gate: PASS
Reason: report file only; no runtime, print, persist, Host, or Core edits
```

---

## 1. CURRENT GIT STATE

Recorded on this checkout. Branch was **not** switched for inspection. The report branch was created **after** this snapshot from the same HEAD.

```text
Branch:     cursor/p0-5r8-shop-logo-file-location-fa01
            (this report later: cursor/master-project-status-audit-fa01)
HEAD:       a0693d5
            a0693d56adab49cb213a3021af633f30be46a9ed
            docs: P0.5R8 shop logo file location forensic blocked (no shop Windows)
Worktree:   M deliveries/migration/P1-services/services.candidate.sqlite
            M deliveries/migration/P1-services/services.sha256
```

Those two dirty files are **candidate SQLite evidence**, not live SoT. OFFSITE 03 already recorded that Core tests rewrite them. They were **not** committed in this audit.

### Latest 30 commits (this lineage, newest first)

| SHA | Kind | Message |
|---|---|---|
| `a0693d5` | docs | P0.5R8 shop logo file location forensic blocked |
| `21b88d5` | docs | company logo upload/save/display lifecycle |
| `205956b` | docs | P0.5R7 runtime identity check |
| `d50184c` | docs | stamp P0.5R7 diagnostic shop kit |
| `0930917` | pack | P0.5R7 diagnostic shop ZIP from `2c490da` |
| `2c490da` | docs | P0.5R7 diagnostic history report |
| `b57c465` | **product** | append-only diagnostic history JSONL |
| `e054b99` | pack | P0.5R6 diagnostic shop ZIP |
| `4de1a7b` | **product** | postal native `disk://` logo via shared media roots |
| `dc39542` | docs | P0.5R5 postal logo/orientation forensic |
| `81fd8d4` | pack | P0.5R4 diagnostic shop ZIP |
| `0dc6aad` | docs | stamp P0.5R4 kit |
| `a09eaab` | pack | P0.5R4 Sirman.exe kit + probe report |
| `8ebeb22` | **product** | P0.5R4 native PrintDocument runtime probe |
| `3ae7ba7` | docs | P0.5R3 postal orientation forensic |
| `dd61c7c` | docs | OFFSITE 03 storage next-step readiness |
| `e1c5768` | docs | stamp P0.5R2 desktop-build |
| `2d4a9dd` | pack | Sirman.exe shop kit P0.5R2 2026-08-29 |
| `b2ae2b0` | docs | stamp P0.5R2 update-build |
| `3701097` | pack | dated shop update JSON P0.5R2 |
| `2aa5e2e` | docs | OFFSITE 02 H1/H3/H4 forensic |
| `cc7461a` | docs | P0.5R2 postal-label layout fix report |
| `21169b5` | **product** | wrap native postal-label text without ellipsis |
| `2355f5e` | docs | P0.5R postal-label truncation forensic |
| `3a56336` | docs | stamp OFFSITE 01 update-build |
| `9071ce0` | pack | dated shop update JSON 2026-08-27 |
| `225a92a` | docs | stamp P0.5R paper-contract |
| `deaae6a` | **product** | document-owned native paper spec; postal default A5 |
| `fcc7a5f` | docs | P0.6 native test-page forensic |
| `4c86b51` | docs | stamp 2026-08-26 final-build |

### Identified roles

| Item | Value |
|---|---|
| Current branch (at snapshot) | `cursor/p0-5r8-shop-logo-file-location-fa01` |
| Current HEAD | `a0693d5` (docs) |
| Latest product commit on this lineage | `b57c465` `feat(diag): append-only diagnostic history JSONL` |
| Latest print **renderer** product | `4de1a7b` (logo resolve); layout `21169b5`; paper `deaae6a` |
| Latest documentation-only | `a0693d5`, `21b88d5`, `205956b` |
| Dirty product artifacts | P1 `services.candidate.sqlite` + `.sha256` (unrelated test rewrite) |
| Active lineage | Print/diagnostic chain on top of P0.5R2 desktop pack `2d4a9dd`, itself on the Phase 3 → native-print workstream. **Not** `main`. Preferred stable branch remains `main` (`docs/STABLE_BASELINE.md`) but this checkout is a long unmerged packet chain. |

Phase 3 B19R product checkpoint (separate older commit, still the named Core-ownership freeze): `1fcf054`. Later print/diag/storage commits are **other programs**, not new B-steps.

---

## 2. PHASE 1 / 2 / 3 — official definitions

| Phase | Official definition | Authority |
|---|---|---|
| **Phase 1** | Core persist **contracts** (`Sirman.Core.Data.Repositories`) on existing JSON types. **Not** wired into app runtime. `IBackupRepository = TBD`. SQL not started. | `deliveries/Reports/PHASE_1_REPOSITORY_INTERFACES.md` — `PHASE 1 = CONTRACTS CREATED` |
| **Phase 1B** | Repository cleanup (documented separately) | `deliveries/Reports/PHASE_1B_REPOSITORY_CLEANUP.md` |
| **Phase 2** | Host/Core architecture, invoice identity / reversal, reports, backup, Print Center **isolation** (`IPrintService` / `WindowsPrintHost`). Print frozen. Physical paper **not** required to exit Phase 2. | `docs/PHASE_2_FINAL_REPORT.md` — `PHASE 2 = COMPLETE`; `docs/ARCHITECTURE_RULES.md` §4.1.10–11 |
| **Phase 3** | Controlled evolution under `docs/PHASE_3_CHANGE_GATE.md`. Preserve HTML persist, HTML-only, JS fallbacks, `sirmanHost`, frozen print. **Not** a rewrite. Two documented sub-programs: (1) §16 UI A/B/C steps 0–4; (2) Core ownership B1–B20. Persistence/SQLite is **not** a B-step (B20 Option C). | Change Gate; `PHASE_3_MIGRATION_TRACKER.md`; `PHASE_3_STEP_4_NEXT_WORK_GATE.md`; B20 report |

### Authoritative table (documented steps only)

| Phase/Step | Description | Status | Product Commit | Evidence |
|---|---|---|---|---|
| Phase 1 | Repository interfaces, unwired | COMPLETED (contracts only) | unused Core files; runtime unchanged | `PHASE_1_REPOSITORY_INTERFACES.md` |
| Phase 1B | Repository cleanup | COMPLETED (per that report) | see report | `PHASE_1B_REPOSITORY_CLEANUP.md` |
| Phase 2 | Print isolation / Host-Core exit | COMPLETED (dev); paper NOT VERIFIED | isolation branch `5af08eb` tag `phase-2-closed-1405.5.27-alpha` | `docs/PHASE_2_FINAL_REPORT.md`, `docs/STABLE_BASELINE.md` |
| Phase 3 Step 0 | Baseline check | COMPLETED | none (docs) | `PHASE_3_STEP_0_BASELINE_CHECK.md` |
| Phase 3 Step 1 | Help Center presentation | COMPLETED | `55528bb` | `PHASE_3_STEP_1_HELP_CENTER.md` |
| Phase 3 Step 2 | Dashboard read-only grouping | COMPLETED | `27810dd` | `PHASE_3_STEP_2_DASHBOARD.md` |
| Phase 3 Step 3 | DateTime/Calendar chrome | COMPLETED | `e07b41f` | `PHASE_3_STEP_3_DATETIME.md` |
| Phase 3 Step 4 | Next-work gate (no 4th UI task) | COMPLETED (analysis) | none | `PHASE_3_STEP_4_NEXT_WORK_GATE.md` |
| A1–A6 | Architecture prep | COMPLETED | none (analysis) | `PHASE_3_ARCHITECTURE_MIGRATION_STEP_A1_A6.md` |
| B1 | Invoice parity lock | COMPLETED | tests/docs | tracker + B1 report |
| B2 | `invoice.line` ownership | COMPLETED | see B2 report | tracker |
| B3 | `invoice.totals` ownership | COMPLETED | see B3 report | tracker |
| B4 | Select next seam (`calc.sla`) | COMPLETED (analysis) | none | B4 report |
| B5 | `calc.sla` ownership | COMPLETED | see B5 report | tracker |
| B6 | `sale.line` ownership | COMPLETED; live EXE HV open | `66e78be` | tracker |
| B7 | Next seam (`sale.total`) | ANALYSIS ONLY | none | B7 report |
| B8 | `sale.total` ownership | COMPLETED; live EXE HV open | `9582215` | tracker |
| B9 | Next seam (`warrantyEndDate`) | ANALYSIS ONLY | none | B9 report |
| B10 | `warrantyEndDate` parity lock | COMPLETED (parity; ownership later B11) | `da78c6a` tests | tracker |
| B11 | `warrantyEndDate` ownership | COMPLETED; live EXE HV open | `405bcb1` | tracker |
| B12 | Next seam (`suggestParts`) | ANALYSIS ONLY | none | B12 report |
| B13 | `suggestParts` parity lock | COMPLETED (parity) | `8446619` tests | tracker |
| B14 | `suggestParts` ownership | COMPLETED; live EXE HV open | `dae7cde` | tracker |
| B15 | Next seam | ANALYSIS ONLY / BLOCKED (no seam) | none | B15 report |
| B16 | `inventory.stock` parity + decision | COMPLETED (parity lock) | `23a4776` tests | tracker |
| B17 | Fail-closed inventory contract | COMPLETED (contract/tests) | `935377a` tests | tracker |
| B18 | `inventory.stock` ownership | COMPLETED; live EXE HV open | `76c92e6` | tracker |
| B19 | Inventory mutation boundary | COMPLETED; live EXE HV open | `e414025` | tracker |
| B19R | Remaining mutation risks | COMPLETED; live EXE HV open | `1fcf054` | tracker |
| B20 | Completion gate | ANALYSIS ONLY / OPTION C | none (`b11ac50` docs) | B20 report — **no B21** |
| B21+ | — | **not documented** | — | Tracker: `B21: DO NOT INVENT`. Not listed as UNKNOWN step. |

Human-verification boxes on B8–B19R remain ⬜ in the tracker. That is **HUMAN VERIFICATION REQUIRED**, separate from COMPLETED implementation.

---

## 3. PHASE 3 COMPLETION

**Is Phase 3 complete?**

```text
NO
```

Authorized **B-step ownership migration** is complete (B20 Option C: no next seam; do not invent B21). That is **not** the same as closing Phase 3 as an operating phase.

Evidence-backed gates that remain before a *Phase 3 complete* declaration exists in source/docs:

1. **Live EXE human verification** of B8, B11, B14, B18, B19, B19R (tracker ⬜). Tracker treats HV as distinct from COMPLETED.
2. **Change Gate still in force** (`docs/PHASE_3_CHANGE_GATE.md`: “mandatory … during Phase 3”). No documented “Phase 3 closed” stamp after B20.
3. **Full architectural migration explicitly not claimed** (B20 / tracker: projections / persist / print / auth remain future programs).
4. **Print physical remaining work is a separate authorized-exception program**, not a missing B-step — but Change Gate still freezes production print except packet-authorized patches.

There is **no** document that lists a single exit checklist titled “Phase 3 complete when …”. Missing closure criteria are **not invented**.

---

## 4. PRINT STATUS

Distinguish: SOURCE PASS = code/contract exists; AUTOMATED TEST PASS = Linux/CI suite; PHYSICAL WINDOWS PASS = human paper on shop PC.

| Item | Status | Evidence |
|---|---|---|
| Native Test Page | PHYSICAL WINDOWS PASS (A4 upright, A5 upright) | Shop fact in `P0.5R5_POSTAL_LOGO_ORIENTATION_FORENSIC.md`, restated P0.5R6/R7. Source: `DrawTestPage`. |
| Native Invoice | PHYSICAL WINDOWS FAIL (last human); **not re-sampled** on `1405.6.3α` postal/diag kits | `P0.2_NATIVE_INVOICE_FORENSIC.md`; P0.2R/P0.2S BLOCKED for runtime row. P0.5R2 desktop report: Native Invoice NOT VERIFIED. |
| Native Postal A5 | PHYSICAL WINDOWS PASS (paper comes out A5) | P0.5R5 shop fact. Source: native `PrintDocument` postal path (`b7499da` migrate + later layout/paper). |
| Postal logo | PHYSICAL: missing. Diagnostic: `disk` / `disk-missing`. UI tab اطلاعات شرکت does not bind logo. Shop file path NOT OBSERVED | P0.5R5–R8 reports; `4de1a7b` resolver SOURCE PASS; AUTOMATED tests in `NativeLogoSourceTests`. |
| Postal orientation | NOT PROVEN / still incorrect per shop | P0.5R3/R5. A5 Test PASS ruled out generic A5 driver inversion. `RotateTransform` **not** added. |
| A4 paper | PHYSICAL WINDOWS PASS on Native Test Page | P0.5R5. P0.1 driver forms Kind 9/11 SOURCE PASS (`56832e5`). |
| A5 paper | PHYSICAL WINDOWS PASS on Test Page and Postal | P0.5R5. |
| P0.1 paper forms | SOURCE PASS; physical via later Test Page PASS | `P0.1_PRINT_PAPER_FORM_FIX_REPORT.md` |
| P0.5R paper contract | SOURCE PASS; postal default A5 | `deaae6a`; `P0.5R_DOCUMENT_PAPER_CONTRACT_REPORT.md`. Physical: postal A5 PASS (shop). |
| P0.5R2 text layout | SOURCE PASS + AUTOMATED TEST PASS (plan tests). Physical wrap/ellipsis **NOT TESTED** as a dedicated shop row | `21169b5`; P0.5R2 layout report. Later shop postal “prints” does not equal wrap QA. |
| P0.5R4 runtime diagnostics | SOURCE PASS. Shop capture sheet in-repo: NOT RUN. Probe log on shop: NOT OBSERVED this audit | `8ebeb22`; `P0.5R4_SHOP_RUNTIME_RESULTS_2026-08-31.md` |
| P0.5R6 logo resolver | SOURCE PASS + AUTOMATED TEST PASS. Physical logo still missing (`disk-missing`) | `4de1a7b`; shop history fields |
| P0.5R7 diagnostic history | SOURCE PASS. Shop running-exe identity NOT OBSERVED; history UI not confirmed on shop | `b57c465`; `P0.5R7_RUNTIME_IDENTITY_CHECK.md` |

Do not use PASS for Native Invoice, postal logo, or postal orientation.

---

## 5. STORAGE STATUS

| Topic | Current evidence |
|---|---|
| Canonical storage | HTML `localStorage` → RAM globals. `CurrentStorage.Kind = html-localStorage-indexeddb` | P3 forensic; ADR; OFFSITE 03 |
| localStorage role | **Live SoT** for business rows (`sv()`, keys including `ll`, `ls2`, invoices, …) |
| IndexedDB role | Not live warranty/invoice tables. App blob, updates, backup copies, tasks mirror, **File System Access handles** |
| SQLite candidate role | `desktop/Sirman.Persistence.Sqlite` + `deliveries/migration/P1-services/services.candidate.sqlite`. Host **does not** reference it. Path target `%AppData%\Sirman\data\sirman.sqlite` **not live** |
| P1 Services | Candidate import of **HTML seed 4 rows**. Parity PASS on seed. Cutover flag off. Dual-write **NO**. Shop live `ls2` UNKNOWN. HV **NOT DONE** | `P1_SERVICES_MIGRATION_REPORT.md`; product `bd8726e` |
| Human verification | P1 shop UI vs candidate: NOT VERIFIED |
| Backup/Restore | HTML JSON BackupEngine. **Not declared safe.** H2 HIGH (replace + missing section → `[]`; persist `catch`; quota) | P3 forensic; OFFSITE 03 |
| H2 | OPEN / HIGH. Not closed by P1 |
| Cutover | **NO** |
| Dual-write | **NO** (ADR forbids as first step) |

ADR (`STORAGE_ARCHITECTURE_DECISION_RECORD.md`) is `APPROVED FOR IMPLEMENTATION` of the **persist program design** (SQLite, first entity services). P1 **executed the candidate slice only**.

**Is any further Storage migration currently authorized?**

```text
NO
```

Authority: `OFFSITE_STORAGE_NEXT_STEP_READINESS_2026-08-27.md` — “Whether a second migration is authorized now: NO.” Prerequisites: P1 shop HV, then an explicit persist packet + Change Gate Q3. This audit does not authorize code.

---

## 6. HUMAN BUG STATUS

Source: `deliveries/OFFSITE_HUMAN_BUG_FORENSIC_2026-08-27.md` (H1/H3/H4). H2 is storage (section 5).

### H1 — refresh warning after Store invoice completion

| Field | Record |
|---|---|
| Proven behavior | `closeInv` does **not** `location.reload`. Success toast then `safePersist`. If no backup folder: error-styled reminder «برای امنیت داده، از تنظیمات → انتخاب فایل ذخیره را بزنید». `beforeunload` is **always armed** (not gated on `isDirty`); Chrome may show a generic leave/reload dialog only if the document unloads. |
| Intended behavior | Complete persists, leaves form to list. Help text claims leave-warning only if unsaved — **mismatches** always-on `beforeunload`. |
| Unresolved | Exact shop dialog (Persian toast vs Chrome Reload vs deposit modal). Whether WebView2 fires `beforeunload` on SPA window close. |
| Severity | Medium (trust / UX). Not a proven data-loss path. |
| Implementation authorized | **NO** |
| Minimum next action | Shop notes the **exact** dialog text after complete. No patch. |

### H3 — closed Store invoice editability

| Field | Record |
|---|---|
| Proven behavior | After complete: form cleared, second complete rejected (HTML + Core). Saved list «ویرایش» **loads** closed invoices. `saveInv` has **no** closed guard — can overwrite a closed record without `invoice.close` / stock reversal. No in-place reopen. |
| Intended behavior | (1) cannot keep filling the completed form — **intended**. (2) cannot complete twice — **intended**. Full immutability — **not implemented**. |
| Unresolved | Whether shop meant empty form, missing list button, or expected lock on `saveInv`. |
| Severity | Medium if corrections required; Low if lock is policy. Residual integrity gap if `saveInv` on closed is unintended. |
| Implementation authorized | **NO** (needs product policy) |
| Minimum next action | Confirm operator clicks. Then a **policy packet**, not a silent lock. |

### H4 — RTL hyphenated postal code visual reversal

| Field | Record |
|---|---|
| Proven behavior | Stored value **not** reversed (`2000-35155`). HTML zip/tel inherit `direction:rtl` without `dir=ltr` → UBA visual swap **expected**. Native postal wraps zip/tel LTR + `AsLeftToRight`. GDI shop pixels UNKNOWN. |
| Intended behavior | Store real order; display LTR for zip/tel. Native source already isolates; HTML fields do not. |
| Unresolved | Shop paper after P0.5R2 wrap; HTML field pixels not captured. |
| Severity | Low–Medium (display). Data not mutated. |
| Implementation authorized | **NO** |
| Minimum next action | Shop photo of HTML zip field + native postal zip line. No global RTL rewrite. |

---

## 7. DIAGNOSTIC SYSTEM STATUS

| Piece | Status |
|---|---|
| P0.5R4 runtime probe | Implemented. Log: `%LocalAppData%\Sirman\print\P0.5R4_NATIVE_RUNTIME.log`. `stage=LOGO` includes `logoSrc`, `resolvedPath`, `fileExists`, `failureReason`. Shop file **NOT OBSERVED** here. |
| P0.5R7 history | JSONL `{AppDataRoot}/diagnostics/history.jsonl`. Isolated from business Storage. |
| history.jsonl architecture | Append-only sessions; physical confirm is a **separate** event. Logo fields: kind / resolved / load / failureReason — **not** `ll`, **not** path. |
| View History UI | Settings → تشخیص چاپگر → `phdHistory()` / `#phd-history`. **Not** Print Center. HTML-only → `NO_HOST`. Shop visibility NOT OBSERVED (`P0.5R7_RUNTIME_IDENTITY_CHECK.md`). |
| SUBMITTED vs PHYSICAL_VERIFIED | Distinguished in history (`PRINT SUBMITTED` ≠ paper confirm / «برگه آمد»). |

**Usable for reliable forensic work?**

```text
PARTIAL
```

On **shop Windows**, the P0.5R4 LOGO line is the strongest existing artifact for native path. History is reliable for **session chronology and kind/reason**, not for `localStorage.ll` or file size. This Linux agent cannot substitute for those files. Do not treat history UI absence as proof the kit is wrong without PE ProductVersion / SHA.

---

## 8. CURRENT PRODUCT VERSION

```text
Product:                      1405.6.3α
Assembly / FileVersion:       1405.6.3.1
Source:                       SIRMAN_VERSION.json (unchanged by later diag packets)
Latest Desktop diagnostic/build:
  ZIP P0.5R7: deliveries/Sirman_Setup_1405.6.3α_P0.5R7_DIAG_2026-08-31.zip
  Pack commit: 0930917 from HEAD 2c490da
  PE ProductVersion: 1405.6.3α+2c490da4135875736617e7aedc3473f3c151b00e
  Shop running exe: NOT OBSERVED
Latest product commit (this lineage):     b57c465  diagnostic history
Latest Print diagnostic commit:           b57c465  (history); resolver 4de1a7b; probe 8ebeb22
Latest Print renderer commit:             4de1a7b  (logo); 21169b5 (wrap); deaae6a (paper)
Latest Storage-related commit:            bd8726e  P1 candidate SQLite (no cutover)
                                          later: dd61c7c OFFSITE 03 docs only
Phase 3 last ownership product:           1fcf054  B19R
```

`FileVersion` `1405.6.3.1` is **shared** across R6/R7 kits — distinguish by ProductVersion suffix + ZIP SHA.

---

## 9. REMAINING WORK (evidence only)

### P0 — blocks usable product

1. **Native Invoice physical** — last human FAIL; not retested on current `1405.6.3α` kit. Invoices are daily shop work.
2. **Postal logo missing** — paper prints; logo `disk-missing`. File location on shop NOT OBSERVED (P0.5R8 blocked).
3. **Backup/Restore H2 HIGH** — not declared safe; warranties at risk on replace/missing section. Not a print bug.
4. **Shop kit identity** — running exe vs P0.5R7 pack NOT OBSERVED; FileVersion cannot distinguish kits.

### P1 — important, not blocking daily open/save of most HTML data

1. Postal **orientation** still incorrect / not proven — do not guess Landscape/`RotateTransform`.
2. P0.5R2 wrap/ellipsis **shop visual** not separately signed.
3. Phase 3 live EXE HV for B8–B19R.
4. P1 Services shop HV (seed ≠ live `ls2`).
5. H1 toast vs leave-dialog confirmation; H3 policy; H4 HTML zip `dir`.
6. Company-info tab does not show brand logo (lifecycle forensic **E**) — UX; native print still needs the file.

### P2 — later

1. Remaining services candidate after P1 HV (still no cutover) — **not authorized now**.
2. Full architectural migration (projections, persist SoT, auth) — B20 future programs.
3. Help/dashboard extra chrome — needs a **new** Change Gate (Step 4).
4. Inventing B21.

Speculative items (SQL cutover, invoice DrawImage patch without shop row, orientation guess) are **omitted**.

---

## 10. EIGHT-DAY STRATEGY (no deadlines, no new features)

Remaining Cursor budget is a constraint, not a schedule. Shortest **safe** path from **repository evidence only**:

### A) Print enough for production use

```text
Shop: confirm running exe ProductVersion contains 2c490da
  → if mismatch, install P0.5R7 kit (already packed; do not rebuild in Cursor)
Shop: one Native Invoice on the same printer as A4 Test PASS
  → if still FAIL, that stays P0; do not patch DrawInvoicePage without that row
Shop: paste localStorage.ll + last stage=LOGO probe line
  → only then a bounded logo packet (existing roots / existing ref) may be gated
Postal orientation: observe after logo path is known; no RotateTransform
Print closure: Test+Postal+Invoice physical rows in history.jsonl with PHYSICAL confirm
```

Do not spend remaining days on a second print engine or paper-size guess.

### B) Finish current Phase 3 scope

```text
Authorized B-migration: already complete (B20 Option C)
Do not invent B21
Optional: shop smoke of invoice.line / sale.total / stock fail-closed (HV boxes)
Phase 3 operating mode stays until an explicit close decision is written
```

### C) Stabilize Storage/Backup enough to continue safely

```text
P1 human verification (UI still LS; count vs candidate)
  → remaining-services candidate import (still no cutover)  [NOT authorized until HV + new packet]
Do not migrate invoices/warranties/inventory
Do not declare Backup/Restore safe (H2)
Rollback SoT remains localStorage / IndexedDB
```

Dependencies:

```text
Print physical verification (invoice retry + logo ll/LOGO line)
  → bounded print packet only if evidence names the break
  → Print closure
  → does not close Phase 3 B-steps (already closed)

Storage P1 human verification
  → next persist packet (Change Gate Q3)
  → remaining services candidate only
  → cutover still later and separate
```

---

## 11. SINGLE NEXT ACTION

**On the shop Windows PC, copy two existing strings and send them in the next message — no code, no rebuild:**

1. `localStorage.ll` from the running WebView2 (DevTools Application → Local Storage), and  
2. the last `stage=LOGO` line from `%LocalAppData%\Sirman\print\P0.5R4_NATIVE_RUNTIME.log` (`logoSrc=`, `resolvedPath=`, `fileExists=`, `failureReason=`).

If Diagnostic History / probe log is missing, also copy Help → About / PE ProductVersion of `Sirman.exe` (must contain `2c490da` for the P0.5R7 kit).

This is the highest-value, lowest-risk step: it finishes P0.5R8, does not spend Cursor on a guessed patch, and decides whether the next **authorized** print packet is logo path vs kit mismatch vs invoice-only retry.

---

## 12. CURRENT MASTER STATUS

```text
Product version:     1405.6.3α
Assembly:            1405.6.3.1

Phase 1:             COMPLETED (contracts; not wired)
Phase 2:             COMPLETED (isolation); paper was not the exit gate
Phase 3:             NO (operating gate still on). Authorized B-migration COMPLETE (B20 C). Live EXE HV open. No B21.

Print:               Test A4/A5 PHYSICAL PASS. Postal A5 PHYSICAL PASS. Logo missing (disk-missing). Orientation NOT PROVEN. Invoice last PHYSICAL FAIL / not retested on current kit.
Storage:             Canonical = localStorage. P1 candidate SQLite only. Cutover NO. Dual-write NO.
Backup/Restore:      NOT declared safe. H2 HIGH open.
H1:                  POSSIBLE (safePersist toast / always-on beforeunload). closeInv does not reload. No patch.
H3:                  INTENDED leave-form + no second complete; saveInv on closed still allowed. Policy needed. No patch.
H4:                  PROVEN HTML visual UBA; storage not reversed; native isolated in source. No patch.
Diagnostic History:  SOURCE implemented; shop usability PARTIAL / running exe NOT OBSERVED.

P0 blockers:         Native Invoice physical unknown-on-current-kit (last FAIL); postal logo disk-missing + file path unknown; H2 backup/restore; shop kit identity.
P1 priorities:       Postal orientation evidence; P0.5R2 wrap shop check; Phase 3 HV; P1 Services HV; H1/H3/H4 confirmations.
P2 priorities:       Remaining services after HV; no second entity; no B21; extra UI chrome needs new gate.

NEXT SINGLE ACTION:
Shop Windows: send localStorage.ll and the last native stage=LOGO probe line (and ProductVersion if history/log missing). No implementation.
```

```text
Product code changed: NO
Print changed:        NO
Storage architecture changed: NO
Backup changed:       NO
Version changed:      NO
STOP — WAIT FOR REVIEW.
```
