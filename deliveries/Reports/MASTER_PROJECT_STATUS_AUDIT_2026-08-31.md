# SIRMAN — MASTER PROJECT STATUS AUDIT + 8-DAY PLAN

**Mode:** READ-ONLY / NO IMPLEMENTATION  
**Gregorian:** 31 August 2026  
**Timezone:** UTC  
**Agent:** Linux cloud VM (not shop Windows)  
**Source version:** `1405.6.3α` / assembly `1405.6.3.1`

```text
Product source changed by audit: NO
Print changed: NO
Storage changed: NO
Backup changed: NO
Version changed: NO
Build/package: NO
Merge/rebase/reset/cherry-pick: NO
```

`PRINT_SUBMITTED` ≠ `QUEUE_ACCEPTED` ≠ `PHYSICAL_VERIFIED` ≠ `VISUAL_VERIFIED`.  
Where sources conflict, both sides are listed. Nothing is silently merged.

---

## PHASE 3 CHANGE GATE (this packet)

```text
Requested change: documentation-only master audit + 8-day plan
Classification: A
Gate: PASS
Reason: only this report file; no runtime/print/persist/Host/Core edits
```

---

## Executive Summary

SIRMAN is mid–Phase 3 as an **operating governance mode**, not an unfinished B-step queue.

- **Phase 1** = unwired Core repository contracts.  
- **Phase 2** = COMPLETE (print isolated). Physical paper was **not** the exit gate.  
- **Phase 3 B-migration** = COMPLETE (B20 Option C; do not invent B21). Live EXE human boxes still open.  
- **Print** = Test Page A4/A5 **PHYSICAL_VERIFIED** (shop). Postal A5 **PHYSICAL_VERIFIED** (paper out). Logo **not printed** (`disk-missing`). Orientation **not proven**. Invoice last **PHYSICAL FAIL**, not retested on current kit. Postal is **not** fully solved.  
- **Storage** = live SoT still browser storage. P1 SQLite is candidate-only. Further migration **not** authorized. H2 Backup/Restore **HIGH**, not declared safe.  
- **Diagnostics** = implemented in source; shop probe/history files **not** on this VM.  
- **8-day Cursor budget** should go to **shop evidence**, not new architecture or guessed print patches.

**Master decision: A — READY TO FINISH WITH TARGETED SHOP VERIFICATION**

---

## Current Git

Snapshot after this audit’s previous docs commit. Inspection did not switch branches.

```text
Branch:  cursor/master-project-status-audit-fa01
         (docs/audit branch — not a product, print-renderer, or shop-build branch)
HEAD:    e531746
         e5317469b65234c20d2cc4482efd5446754a4288
         docs: master project status audit 2026-08-31 (read-only)
Dirty:   M deliveries/migration/P1-services/services.candidate.sqlite
         M deliveries/migration/P1-services/services.sha256
         (candidate evidence rewritten by tests; not live SoT; not committed here)
```

| Role | SHA | Note |
|---|---|---|
| HEAD / latest docs | `e531746` | this audit (first revision) |
| Prior docs | `a0693d5` P0.5R8; `21b88d5` logo lifecycle; `205956b` R7 identity |
| Latest product (this lineage) | `b57c465` | Diagnostic History JSONL |
| Latest Print renderer | `4de1a7b` logo resolve; `21169b5` wrap; `deaae6a` paper |
| Latest Print probe | `8ebeb22` | P0.5R4 runtime probe |
| Latest Print pack | `0930917` | P0.5R7 shop ZIP from `2c490da` |
| Latest Storage product | `bd8726e` | P1 candidate SQLite, no cutover |
| Latest Storage docs | `dd61c7c` | OFFSITE 03 — second migrate NO |
| Phase 3 last ownership product | `1fcf054` | B19R (older; still named freeze) |

Lineage is a long unmerged packet chain. Target stable branch remains `main` (`docs/STABLE_BASELINE.md`). This HEAD is **not** `main`.

`git log -40 --oneline` (newest first): `e531746` … `b1e7494` (Word install guide). Full list captured in the git gate command output of this run.

---

## Phase Map

### Are there 8 separate top-level phases?

```text
Are there 8 separate top-level phases?
NO
```

Documented **product/governance** numbers are Phase 0 (physical print checklist), Phase 1 (repository contracts **and**, in `ARCHITECTURE_RULES` §4.1.9, Host security), Phase 1B (cleanup), Phase 2 (Business Core + print isolation), Phase 3 (Change Gate + UI steps + B-migration).  

A **different** numbering exists for the network architecture document: «مرحله ۳ سند معماری شبکه» and «مرحلهٔ ۶» (REST/HTTPS) in `ARCHITECTURE_RULES.md` §4.1.7. Those are **network stages**, not eight SIRMAN product phases.

Do not add undocumented Phase 4–8.

### Official meanings

| Phase/Step | Meaning | Status | Product Commit | Human Verification | Evidence |
|---|---|---|---|---|---|
| Phase 0 | Physical print checklist (manual) | NOT CLOSED as a checklist; later shop Test/Postal rows exist | n/a | Partial (Test/Postal yes; invoice no) | `docs/PHASE_0_PRINT_VERIFICATION_CHECKLIST.md`; later P0.5R5 shop facts |
| Phase 1 | Core persist contracts, unwired | COMPLETED | unused wrappers | N/A | `PHASE_1_REPOSITORY_INTERFACES.md` |
| Phase 1 (rules §4.1.9) | Host security library, HTML login SoT | COMPLETED as architecture fact | Core Security | N/A | `docs/ARCHITECTURE_RULES.md` |
| Phase 1B | Repository cleanup | COMPLETED | see report | N/A | `PHASE_1B_REPOSITORY_CLEANUP.md` |
| Phase 2 | Host/Core, isolation of print | COMPLETED | tag `phase-2-closed-1405.5.27-alpha` @ `5af08eb` | Paper was NOT the exit gate | `docs/PHASE_2_FINAL_REPORT.md` |
| Phase 3 Step 0–3 | Baseline, Help, Dashboard, DateTime | COMPLETED | `55528bb` / `27810dd` / `e07b41f` | N/A (UI) | Step reports |
| Phase 3 Step 4 | No fourth UI task | ANALYSIS ONLY | none | N/A | `PHASE_3_STEP_4_NEXT_WORK_GATE.md` |
| A1–A6 | Migration prep | COMPLETED | none | N/A | A1–A6 report |
| B1 | Invoice parity lock | COMPLETED | tests | N/A | tracker |
| B2 | `invoice.line` ownership | IMPLEMENTED-NEEDS-HUMAN-VERIFICATION | B2 report | ⬜ tracker family | tracker |
| B3 | `invoice.totals` | IMPLEMENTED-NEEDS-HUMAN-VERIFICATION | B3 report | ⬜ | tracker |
| B4 | Select `calc.sla` | ANALYSIS ONLY | none | N/A | B4 |
| B5 | `calc.sla` ownership | IMPLEMENTED-NEEDS-HUMAN-VERIFICATION | B5 report | ⬜ | tracker |
| B6 | `sale.line` | IMPLEMENTED-NEEDS-HUMAN-VERIFICATION | `66e78be` | ⬜ | tracker |
| B7 | Select `sale.total` | ANALYSIS ONLY | none | N/A | B7 |
| B8 | `sale.total` | IMPLEMENTED-NEEDS-HUMAN-VERIFICATION | `9582215` | ⬜ | tracker |
| B9 | Select warrantyEndDate | ANALYSIS ONLY | none | N/A | B9 |
| B10 | warrantyEndDate parity | COMPLETED (parity only) | `da78c6a` | N/A | tracker |
| B11 | warrantyEndDate ownership | IMPLEMENTED-NEEDS-HUMAN-VERIFICATION | `405bcb1` | ⬜ | tracker |
| B12 | Select suggestParts | ANALYSIS ONLY | none | N/A | B12 |
| B13 | suggestParts parity | COMPLETED (parity only) | `8446619` | N/A | tracker |
| B14 | suggestParts ownership | IMPLEMENTED-NEEDS-HUMAN-VERIFICATION | `dae7cde` | ⬜ | tracker |
| B15 | Next seam | ANALYSIS ONLY / BLOCKED | none | N/A | B15 |
| B16 | inventory.stock parity | COMPLETED (parity) | `23a4776` | ⬜ | tracker |
| B17 | fail-closed contract | COMPLETED (tests) | `935377a` | ⬜ | tracker |
| B18 | inventory.stock ownership | IMPLEMENTED-NEEDS-HUMAN-VERIFICATION | `76c92e6` | ⬜ | tracker |
| B19 | mutation boundary | IMPLEMENTED-NEEDS-HUMAN-VERIFICATION | `e414025` | ⬜ | tracker |
| B19R | remaining mutation risks | IMPLEMENTED-NEEDS-HUMAN-VERIFICATION | `1fcf054` | ⬜ | tracker |
| B20 | completion gate | ANALYSIS ONLY / OPTION C | none (`b11ac50` docs) | NOT APPLICABLE | B20 report |
| B21+ | — | not documented | — | — | Tracker: DO NOT INVENT |

---

## Phase 3 Completion Answer

```text
Is Phase 3 complete?
NO
```

Authorized **B-step migration** is complete (B20: no next seam). Phase 3 as **Change Gate operating mode** is not closed.

Exact remaining gates (evidence-backed only):

1. Live EXE HV boxes B8/B11/B14/B18/B19/B19R still ⬜ (`PHASE_3_MIGRATION_TRACKER.md`).  
2. `docs/PHASE_3_CHANGE_GATE.md` still mandatory “during Phase 3”; no “Phase 3 closed” stamp.  
3. B20: full architectural migration **not** claimed (persist/print/auth remain other programs).  
4. Step 4: no extra §16 UI work without a **new** gate.

Print remaining defects are a **separate program**. Phase 2 rule: `PRINT MUST NOT BLOCK PHASE 3`.

---

## Print Status

Legend: SOURCE = code exists; AUTO = Linux/CI tests; PHYSICAL = shop paper; VISUAL = shop judged layout/logo.

| Print item | Source status | Automated tests | Physical Windows status | Current blocker | Next action |
|---|---|---|---|---|---|
| Native Test Page A4 | Exists `DrawTestPage` | Suite green in later reports | PHYSICAL_VERIFIED upright (shop P0.5R5+) | None for paper-out | Do not reopen |
| Native Test Page A5 | Same path | Same | PHYSICAL_VERIFIED upright (shop) | None for paper-out | Do not reopen; this **rules out** generic A5 driver inversion |
| Native Postal A5 | Native `PrintDocument` postal | Layout plan tests at P0.5R2 | PHYSICAL_VERIFIED paper A5 (shop) | Logo + orientation/layout | Evidence, then bounded packet |
| Postal logo | `NativeLogoSource` `4de1a7b` | `NativeLogoSourceTests` | NOT printed | `disk-missing`; shop file path NOT OBSERVED | Shop `ll` + LOGO probe line |
| Postal orientation | No `RotateTransform`; Landscape not guessed | Probe can log transform | Shop: still incorrect / not proven | Cause unknown after A5 Test PASS | Read shop PAGE transform; do not guess |
| Postal layout/text | Wrap no-ellipsis `21169b5` | Plan tests 648/215 at that report | Dedicated wrap QA NOT TESTED | Truncation forensic closed in source; shop wrap unknown | Shop visual after logo path |
| A4 / A5 paper forms | P0.1 Kind 9/11; P0.5R document contract `deaae6a` | Paper tests in Core | Test+Postal PHYSICAL A4/A5 PASS | Invoice paper path not retested | Invoice retry on current kit |
| Native Invoice | `DrawInvoicePage` | Source tests | Last PHYSICAL FAIL (P0.2); **not retested** on `1405.6.3α` | Unknown if still FAIL | One shop Native Invoice click |
| P0.5R paper contract | SOURCE | yes | Postal A5 PHYSICAL PASS | — | Do not reopen paper resolver |
| P0.5R4 probe | SOURCE `8ebeb22` | yes | Capture sheet in-repo: **NOT RUN / NOT MEASURED** | Shop log not in git | Collect existing log on shop |
| P0.5R6 resolver | SOURCE | yes | Logo still missing | FSA folder vs Desktop roots | Shop path evidence |
| P0.5R7 history | SOURCE | 651/651 HTML, 234/234 Core, 10 history tests | Running shop exe NOT OBSERVED | Kit identity | ProductVersion contains `2c490da` |

**Packet claim vs repo:** “P0.5R4 history recorded A5 portrait and identity Graphics transform.”

```text
IN-REPO CAPTURE SHEET (P0.5R4_SHOP_RUNTIME_RESULTS_2026-08-31.md):
  physical tests NOT RUN; all runtime table cells NOT MEASURED
P0.5R5: treated shop A4/A5 Test PASS and A5 Postal print as fact; probe log NOT supplied
No history.jsonl or P0.5R4_NATIVE_RUNTIME.log from shop is in this repository
```

**CONFLICT / UNVERIFIED:** A5 portrait + identity transform as a **measured shop log line** is **not** in git. Do not treat it as PHYSICAL/VISUAL proof. It remains a **hypothesis the probe was built to test** (P0.5R3/R4 reports).

Postal is **not** fully solved.

---

## Diagnostic Status

| Fact | Evidence |
|---|---|
| Intended path | `%LocalAppData%\Sirman\diagnostics\history.jsonl` (`DiagnosticHistory.cs`; ARCHITECTURE_RULES print section) |
| Probe log | `%LocalAppData%\Sirman\print\P0.5R4_NATIVE_RUNTIME.log` |
| Append-only | Tests: second run does not overwrite first; restart survives; corrupt extra line keeps priors |
| Session IDs | New session per run; physical confirm is separate event on last job session |
| UI | Settings → تشخیص چاپگر → `phdHistory()` — **not** Print Center |
| SUBMITTED vs PHYSICAL | `PRINT_SUBMITTED` does not become `PHYSICAL_VERIFIED`; «برگه آمد» is a later event |
| Logo in JSONL | kind / resolved / load / failureReason — **not** `ll`, **not** filesystem path |
| LOGO path in probe | `stage=LOGO` has `logoSrc=`, `resolvedPath=`, `fileExists=` |

```text
Diagnostic History reliable for future forensic work?
PARTIAL
```

Reliable for chronology and logo **kind/reason** once the P0.5R7 exe is actually running. Not sufficient for `localStorage.ll` or file size. This agent has not opened shop files. P0.5R7 identity check: shop “history not visible” is **NOT OBSERVED** as binary identity.

---

## Logo Status

Proven:

- Brand control = sidebar `#logo-inp` / `changeLogo`, not اطلاعات شرکت.  
- Reference key = `ll` → `logoSrc`.  
- Company tab has no `<img>` / no `logoSrc` bind (`saveCompanyInfo` text only). Classification **E** for that UI.  
- Upload writes `disk://sirman_media/logo{ext}` via File System Access `writeDiskBlob`.  
- Native Postal: `logoSourceKind=disk`, `logoResolved=false`, `logoLoadSuccess=false`, `failureReason=disk-missing`.  
- P0.5R6 resolver searches Desktop backup/media roots, not the FSA handle.  
- P0.5R8: physical path **NOT OBSERVED** (Linux agent ≠ shop PC).

Unknowns:

- Exact `ll` string, extension `.jpg` vs `.png`, FSA folder name, file size, whether bytes exist anywhere on shop disk, whether shop exe is R7.

Next action: **shop evidence**, not source change. This packet does **not** authorize implementation.

---

## H1 / H3 / H4

Source: `deliveries/OFFSITE_HUMAN_BUG_FORENSIC_2026-08-27.md`. No patch.

| | H1 refresh warning after Store complete | H3 closed invoice edit | H4 `2000-35155` visual reverse |
|---|---|---|---|
| Proven | `closeInv` does not reload. `safePersist` no-folder toast after success. `beforeunload` always armed (not `isDirty`). | Leave form + block second complete. List «ویرایش» loads closed. `saveInv` has no closed guard. | Stored value **not** reversed. HTML zip/tel `direction:rtl` → UBA visual swap. Native LTR isolate in source. |
| Intended | Persist, list, success toast. Help vs always-on leave is mismatched. | Cannot stay on completed form; cannot complete twice. Full immutability **not** in HTML. | Store real order; display LTR for zip/tel. |
| Unresolved | Exact shop dialog text. WebView2 `beforeunload` on SPA close. | Operator stayed on empty form vs wanted lock vs missed list button. | Shop HTML pixels; GDI paper after P0.5R2. |
| Severity | Medium UX/trust | Medium if corrections needed | Low–Medium display |
| Production risk | Operator thinks save failed; not proven data-loss | Closed overwrite without stock reversal if they save from list | Misread zip on screen/HTML print |
| Implementation authorized | **NO** | **NO** (needs policy) | **NO** |
| Min verification | Copy exact toast/dialog after complete | Confirm clicks | Photo of zip field + postal zip line |
| Min future fix | Soften no-folder toast on success path; do not hide real backup prompt | Policy then guard `saveInv` **or** document list-edit | `dir=ltr` / isolate on zip/tel only — later packet |

H2 (backup/restore warranties) is Storage, not this trio.

---

## Storage / Backup

Verified against current HEAD (candidate assembly present; Host still unwired).

```text
Canonical runtime store:     HTML localStorage → RAM (CurrentStorage.Kind = html-localStorage-indexeddb)
SQLite canonical:            NO
Dual-write:                  NO
P1 Services candidate:       YES (bd8726e; 4 HTML seed rows; evidence sqlite)
P1 human verification:       NOT DONE
H2 Backup/Restore:           NOT declared safe; HIGH
Cutover:                     NO
Second entity migration authorized: NO
```

| Item | Status | Evidence | Blocking? | Next gate |
|---|---|---|---|---|
| Live SoT | Browser LS/IDB | P3 forensic, ADR, OFFSITE 03 | Daily ops work | Keep as rollback |
| P1 SQLite | Candidate only; Host not referenced | `Sirman.Persistence.Sqlite`; Desktop csproj no ref | No | Shop HV of `ls2` vs candidate |
| ADR | Design APPROVED FOR IMPLEMENTATION | ADR `530` | Conflicts with OFFSITE 03 “NO second migrate now” | Explicit persist packet after HV |
| H2 | OPEN | replace + missing `[]`; persist catch; quota | Data-integrity P0 | Do not reset shop data; no restore sign-off |
| Cutover/dual-write | Off | P1 + OFFSITE 03 | Starting either now would be a **new** SoT risk | Forbidden until HV + gate Q3 |

**CONFLICT:** ADR says `APPROVED FOR IMPLEMENTATION`. OFFSITE 03 (later, `dd61c7c`) says second entity / further persist implementation **NO** until P1 HV. This audit follows the **later** OFFSITE 03 gate for “authorized now”.

**CONFLICT:** Change Gate still says “There is no SQL persistence layer.” Candidate assembly exists. Live SoT did **not** move (OFFSITE 03: documentation lag).

---

## Data-loss risk

| Risk | Assessment |
|---|---|
| Browser quota / `sv()` fail while RAM looks saved | Proven mechanism (P3 R1). Shop incident count UNKNOWN. |
| Restore replace + missing warranties → `[]` | Proven path (H2). |
| SQLite cutover **now** | **Higher** risk than leaving LS: Host unwired, no shop HV, dual-write forbidden, BackupEngine still HTML. |
| Deleting/resetting shop data | **Forbidden.** Never recommended. |
| Safest short-term shop posture | Keep using current EXE; take HTML backups **and** copy `sirman_media` if present; do not “reset to fix logo”; do not enable SQLite; confirm backup folder for `safePersist`. |

---

## Version / Build

```text
Source product:           1405.6.3α
Assembly / FileVersion:   1405.6.3.1  (shared across R6/R7 — do not use as kit ID)
Latest diagnostic build:  Sirman_Setup_1405.6.3α_P0.5R7_DIAG_2026-08-31.zip
                          pack 0930917 / HEAD 2c490da
                          PE ProductVersion 1405.6.3α+2c490da4135875736617e7aedc3473f3c151b00e
Latest product commit:    b57c465 (history)
Latest Print commit:      4de1a7b renderer-logo; b57c465 diag
Latest Storage commit:    bd8726e
```

**Appropriate for next shop visit:** P0.5R7 diagnostic kit above, **if** running ProductVersion does not already contain `2c490da`.

**Must NOT install (for this job):** generic packer overwrite `Sirman_Setup_1405.6.3α.zip` as if it were R7; P0.5R6 kit as if it were R7; any kit that would **replace** shop data; SQLite cutover builds (none are live). Do not rebuild in Cursor this packet.

Shop running exe: **NOT OBSERVED**.

---

## Remaining Work P0 / P1 / P2

**P0**

1. Shop kit identity vs R7 pack.  
2. Postal logo `disk-missing` — need `ll` + LOGO line.  
3. Native Invoice physical — last FAIL, not retested.  
4. H2 Backup/Restore — do not declare safe; do not reset data.

**P1**

1. Postal orientation — evidence only; no `RotateTransform`.  
2. P0.5R2 wrap visual on shop.  
3. Phase 3 live EXE HV.  
4. P1 Services HV.  
5. H1/H3/H4 confirmations.

**P2**

1. Remaining services candidate after HV (still no cutover).  
2. Extra UI chrome (new Change Gate).  
3. B21 — do not invent.

---

## 8-Day Plan

Optimize for **minimum Cursor tokens and minimum rebuilds**. Days are not invented as calendar estimates; order is dependency order.

| # | Objective | Dep | Shop Windows | Cursor | Type | Stop |
|---|---|---|---|---|---|---|
| 1 | Confirm ProductVersion `2c490da` or install existing R7 ZIP | — | YES | LOW | Human | Wrong exe → install kit, **no rebuild** |
| 2 | Paste `localStorage.ll` + last `stage=LOGO` line | 1 | YES | LOW | Human | Missing log → copy ProductVersion; still no code |
| 3 | One Native Invoice on same printer as A4 Test PASS | 1 | YES | LOW | Human | If FAIL, capture UI/error only; **no DrawInvoicePage patch** until row exists |
| 4 | Photo: postal orientation vs A5 Test; zip `2000-35155` | 1–2 | YES | LOW | Human | No Landscape guess |
| 5 | Bounded logo packet **only if** 2 names a missing file vs wrong root | 2 | maybe | MEDIUM | Implementation later | Gate F; no Storage rewrite |
| 6 | P1 `ls2` count vs candidate (still LS) | — | YES | LOW | Human | Do not cut over |
| 7 | Phase 3 HV smoke (optional) | 1 | YES | LOW | Human | Do not invent B21 |
| 8 | H1/H3 text confirmation | — | YES | LOW | Human | No patch this window |

Items 5+ are **not** started in this packet.

---

## Print Strategy

Do **not** reopen proven Test Page A4/A5.

```text
Generic A4/A5:     CLOSED for Test Page (PHYSICAL_VERIFIED). Invoice paper unknown.
Postal paper A5:   CLOSED (PHYSICAL_VERIFIED).
Postal logo:       OPEN — shop ll + probe resolvedPath. Resolver already in 4de1a7b.
Postal orientation: OPEN — needs PAGE transform from shop log; A5 Test PASS forbids A5-driver theory.
Postal wrap/text:  SOURCE closed truncation; shop visual OPEN; after logo/orientation.
Invoice:           OPEN — one retry on current kit before any renderer work.
Test Page:         CLOSED physically; keep as control.
```

Shortest path: shop strings (step 2) → then **at most one** bounded logo packet → orientation still evidence-only.

---

## Phase 3 Relationship

These are **four queues**, not one:

| Queue | Blocks Phase 3 formal B-closure? | Blocks 8-day production print? |
|---|---|---|
| Phase 3 architecture migration | B-steps already complete | No |
| Print stabilization | **No** (`PRINT MUST NOT BLOCK PHASE 3`) | **Yes** (logo, orientation, invoice) |
| Storage migration | Separate program; not a B-step | No (do not start) |
| Human verification | HV boxes open; not a missing B-step | Shop evidence is the bottleneck |

Print remaining work must **not** be used to invent B21 or a persist cutover.

---

## Conflicts (not silently reconciled)

1. `docs/STABLE_BASELINE.md` still `PHYSICAL_PRINT_NOT_VERIFIED` vs shop Test/Postal PHYSICAL PASS in P0.5R5–R7 reports.  
2. Change Gate “no SQL layer” vs P1 `Sirman.Persistence.Sqlite` candidate. Live SoT unchanged.  
3. ADR `APPROVED FOR IMPLEMENTATION` vs OFFSITE 03 `second migration authorized: NO`.  
4. Native Invoice PHYSICAL FAIL (P0.2) vs no invoice result on `1405.6.3α` kits.  
5. Packet text “P0.5R4 history recorded A5 portrait + identity transform” vs in-repo capture sheet **NOT MEASURED**.  
6. FileVersion `1405.6.3.1` identical on R6 and R7.

---

## Master Decision

```text
A — READY TO FINISH WITH TARGETED SHOP VERIFICATION
```

Not B: Phase 3 B-queue is already closed; print remaining is shop-evidence then maybe one packet, not “any major next phase”.  
Not C: H2 is HIGH but the safe move is **not** to migrate Storage this window.  
Not D: reports exist; lineage is long but reconstructable.

---

## Single Next Action

**Shop Windows only — no Cursor implementation:** send (1) `localStorage.ll` and (2) the last `stage=LOGO` line from `%LocalAppData%\Sirman\print\P0.5R4_NATIVE_RUNTIME.log`. If that log or Diagnostic History is missing, send `Sirman.exe` ProductVersion (must contain `2c490da` for R7).

---

## Safety Rules Going Forward

- No random patches. No opportunistic refactor.  
- No Print fix without shop evidence for that exact break. No `RotateTransform` / Landscape guess.  
- No overwriting Diagnostic History JSONL; append-only.  
- No production-data reset, delete, or “fresh install to fix logo”.  
- No Storage cutover, dual-write, or second entity without P1 human verification **and** a new Change Gate Q3 packet.  
- No version bump unless explicitly authorized.  
- No rebuild unless a later packet authorizes packaging.  
- `PRINT_SUBMITTED` is not paper.  
- Do not invent B21.  
- HTML-only path stays supported.  
- Candidate sqlite dirty files are not live shop data.

---

## CURRENT MASTER STATUS

```text
Product version: 1405.6.3α
Assembly:        1405.6.3.1

Phase 3: NO (Change Gate still on). Authorized B-migration COMPLETE (B20 C). HV ⬜. No B21.
Print: Test A4/A5 PHYSICAL PASS. Postal A5 PHYSICAL PASS. Logo disk-missing. Orientation NOT PROVEN. Invoice last FAIL / not retested. Postal NOT fully solved.
Storage: Canonical localStorage. SQLite candidate only. Cutover NO. Dual-write NO. Further migrate NOT authorized.
Backup/Restore: NOT safe. H2 HIGH.
Diagnostic History: SOURCE yes; shop files NOT OBSERVED; PARTIAL forensic use.
H1: POSSIBLE toast/always-on beforeunload; closeInv no reload. No patch.
H3: INTENDED leave-form + no second complete; saveInv on closed still allowed. No patch.
H4: HTML visual UBA proven; storage not reversed. No patch.

OVERALL:
A

NEXT SINGLE ACTION:
Shop: send localStorage.ll and last native stage=LOGO line (and ProductVersion if log/history missing). No implementation.

STOP — WAIT FOR REVIEW.
```

```text
Product source changed by audit: NO
Print changed: NO
Storage changed: NO
Backup changed: NO
Version changed: NO
Build/package: NO
```
