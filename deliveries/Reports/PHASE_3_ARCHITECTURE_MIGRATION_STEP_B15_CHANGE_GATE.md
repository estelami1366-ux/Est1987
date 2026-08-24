# SIRMAN — PHASE 3 ARCHITECTURE MIGRATION
## STEP B15 — CHANGE GATE / NEXT OWNERSHIP SEAM

**Mode:** ANALYSIS / READ-ONLY  
**Date:** 1405/05/30 11:47:25 (Asia/Tehran)  
**Gregorian:** 21 August 2026  
**Branch:** `cursor/phase-3-architecture-migration-3733`  
**HEAD at analysis:** `79a9104` (`docs: record B14 ownership report commit hash on tracker`)  
**B14 product commit:** `dae7cde` — this HEAD is a descendant  
**Live version:** `1405.5.27γ` (unchanged)

```text
CODE MODIFIED = NO
PRODUCT CODE MODIFIED = NO
B15 IMPLEMENTATION = NOT STARTED
B15 SELECTION = BLOCKED
Persistence changed = NO
Print changed = NO
Backup changed = NO
Locked workflows changed = NO
```

Tracker did not name a next seam (`Recommended next seam = wait for B15 instruction`). Per B15 §4 this step started **read-only**. Source inventory after B14 finds **no remaining seam that satisfies all ten §5 rules**. B15 §6 forbids automatically choosing `inventory.stock` / warranty save-close-delete / backup / persist / auth / print. Therefore B15 **does not select a seam**, **does not lock parity**, and **does not migrate ownership**.

```text
STOP — B15 blocked. No product code change.
```

---

# 1. Jalali date

```text
1405/05/30
```

---

# 2. Gregorian date

```text
21 August 2026
```

---

# 3. Exact local time

```text
11:47:25
```

---

# 4. Timezone

```text
Asia/Tehran
```

---

# 5. Branch

```text
cursor/phase-3-architecture-migration-3733
```

Did not switch branches. Preferred PR base remains `cursor/phase-3-change-gate-3733`. Never on `main`.

---

# 6. HEAD before

```text
79a9104  docs: record B14 ownership report commit hash on tracker
79a910486196ef367e8924fb9e6cfc2445ef35c9
descendant of dae7cde = YES
```

---

# 7. HEAD after

Same as before for product code. Docs-only commit(s) may follow this report. Rollback for B15 analysis: delete this report and tracker analysis lines. No product rollback.

---

# 8. Worktree before/after

Commands:

```text
git branch --show-current
git rev-parse --short HEAD
git status --short
```

| Check | Result |
|---|---|
| Branch | `cursor/phase-3-architecture-migration-3733` |
| Worktree at gate | clean |
| B14 | COMPLETED (`dae7cde`, HTML 616 / Core 151) |
| STOP — product change | YES (selection blocked; analysis allowed) |

No stash, reset, rebase, merge, cherry-pick, or product edits.

---

# 9. Governance documents read

| Document | Status |
|---|---|
| `docs/PHASE_3_CHANGE_GATE.md` | READ |
| `docs/DEVELOPMENT_GOVERNANCE.md` | READ |
| `docs/ARCHITECTURE_RULES.md` | READ |
| `docs/PRINT_MODULE_BASELINE.md` | READ |
| `.agents/skills/laegh-software-workflow/SKILL.md` | READ |
| `docs/REGRESSION_SUITE.md` | READ |
| B14 report + tracker | READ |
| B13 parity-lock report | READ |
| B4 / B7 / B9 / B12 selection precedent | consulted |

Source inspected (authority):

```text
Sirman_Final.html          takeBusinessCore / hasBusinessCore call sites
BusinessFacade.Dispatch    existing ops
CalculationEngine          unused calc.* wrappers
PartsAdvisor.Suggest       rules.suggestParts (OWNED B14)
InventoryCore.Stock        inventory.stock
WarrantyWorkflow.CanTransition
PaymentRules.Deposit       payment.deposit (unused HTML-only result)
```

```text
PHASE 3 CHANGE GATE — B15 ANALYSIS ONLY

Requested change:
None. Identify the next ownership seam after B14. Implement only if fully authorized.

Classification:
Analysis / selection gate (same class as B4 / B7 / B9 / B12)

Capability:
NONE — no remaining seam is fully authorized

Files expected this step:
deliveries/Reports/PHASE_3_ARCHITECTURE_MIGRATION_STEP_B15_CHANGE_GATE.md
deliveries/Reports/PHASE_3_MIGRATION_TRACKER.md (analysis timestamp only)

UI / Business / Persistence / Host / Print / Security / LOCKED / FROZEN:
UNTOUCHED

HTML-only preserved:
YES (no product edit)

New architecture introduced:
NO

Gate:
PASS for analysis
FAIL for implementation (no §5-complete candidate; §6 protected leftovers)

Reason:
B14 exhausted the last live dual-path that B12 could authorize (`rules.suggestParts`).
Remaining dual-paths fail §5 and/or §6. B15 §15: if selection is blocked, STOP. No product code change.
```

---

# 10. B14 precondition

| Check | Evidence |
|---|---|
| B14 status | COMPLETED |
| Product commit | `dae7cde` `feat: migrate rules.suggestParts ownership to core` |
| Capability | `rules.suggestParts` EXE ownership = Core |
| HTML-only | JS ranking preserved when Host absent |
| Fail-closed | Host present + Core miss/non-array → `null` (no JS ranking) |
| HTML tests | 616 PASS / 0 FAIL |
| Core tests | 151 PASS / 0 FAIL |
| Regression | PASS |
| Tracker | B15 = NOT STARTED; Recommended next seam = wait for B15 instruction |
| Preselected seam | **none** |

B14 live EXE remains `NEEDS HUMAN VERIFICATION`. That does not authorize a B15 product change.

---

# 11. Candidate selection analysis

## 11.1 Completed B-series seams (do not reopen)

Already fail-closed on EXE (`hasBusinessCore` gate present):

```text
invoice.line
invoice.totals
invoice.close / invoice.delete
sale.line
sale.total
sale.delete
calc.sla
calc.warrantyEndDate
rules.suggestParts
warranty.save / warranty.close / warranty.delete / warranty.applyTransition
inventory.reserve / release / consume / addStock / apply*
payment.applyDeposit / applyWithdraw / edit / delete
```

Locked mutations remain **forbidden** as B15 winners (B15 §6 / §10).

Tracker had **no** recorded next seam and **no** unused parity lock waiting for ownership.

## 11.2 Candidate inventory (source after B14)

Grep of `Sirman_Final.html` `takeBusinessCore(` plus Facade `Dispatch`.

### Remaining dual-path / incomplete fail-closed (HTML `takeBusinessCore` without Host-absent-only ranking)

| Candidate | JS owner | Core owner | Host route | Parity | Persist | Print | Mutation risk | HTML-only | Decision |
|---|---|---|---|---|---|---|---|---|---|
| `inventory.stock` | `invStockSnapshot` ~18395 | `InventoryCore.Stock` | `inventory.stock` | UNKNOWN | NO (read) | NO | locked inventory **family**; used by mutation HTML-only paths and live shop tables | JS snapshot exists | **REJECTED** — §6 do-not-auto-choose; B4/B9/B12 NOT READY; parity not locked |
| `warranty.canTransition` | `canWarrantyTransition` ~26718 | `WarrantyWorkflow.CanTransition` | `warranty.canTransition` | UNKNOWN | NO | NO | adjacent locked `warranty.applyTransition` | JS boolean exists | **REJECTED** — no EXE live caller; locked-apply adjacency |
| `calc.balance` | `calcBalance` ~26645 | `CalculationEngine.Balance` | `calc.balance` | Core unit tests exist | NO | NO | none | JS formula exists | **REJECTED** — no live shop caller besides wrapper + `SmartCore.calc` |
| `calc.finalAmount` | `calcFinalAmount` ~26652 | `CalculationEngine.FinalAmount` | `calc.finalAmount` | Core unit tests exist | NO | NO | none | JS formula exists | **REJECTED** — same unused-wrapper rule |
| `calc.availableStock` | `calcAvailableStock` ~26661 | `CalculationEngine.AvailableStock` | `calc.availableStock` | Core unit tests exist | NO | NO | none | JS formula exists | **REJECTED** — same unused-wrapper rule |
| `calc.reorderPoint` | `calcReorderPoint` ~26668 | `CalculationEngine.ReorderPoint` | `calc.reorderPoint` | Core unit tests exist | NO | NO | none | JS formula exists | **REJECTED** — same unused-wrapper rule |
| `payment.deposit` | unused `dchk` ~23069 | `PaymentRules.Deposit` | `payment.deposit` | n/a | NO | NO | EXE already `payment.applyDeposit` fail-closed | called only on HTML-only branch; result unused | **REJECTED** — dead call |

### Facade-only / would invent a new dual-path (INELIGIBLE)

| Candidate | Why INELIGIBLE |
|---|---|
| `calc.addJalaliMonths` | Facade only; no HTML `takeBusinessCore` |
| `invoice.validate` | Facade only; no HTML Host call |
| `payment.remaining` | Facade only; no HTML Host call |
| `inventory.kardex` / `lowStock` / `search` / `value` / `deadStock` / `consumed` | Core/Facade exist; HTML helpers do **not** call Host. Wiring them would invent a dual-path |
| `service.save` / `close` / `addPart` | Facade only; zero HTML `service.*` — FORBIDDEN |

### Rejected (protected / mutation / frozen)

| Candidate | Why REJECTED FOR B15 |
|---|---|
| `invoice.close` / `delete` / `sale.delete` | locked mutation |
| `inventory.*` mutations | locked; B15 §10 |
| `payment.apply*` / edit / delete / reverse | accounting mutation |
| `warranty.save` / `close` / `delete` / `applyTransition` | B15 §6 / warranty mutation |
| Print engine / Print Center | FROZEN |
| Backup / `migrateBackup` / persist schema | FROZEN/locked |
| Auth / REST / SQL / second Host | forbidden |

## 11.3 Ten-point §5 gate (ALL must be true)

### `inventory.stock` — the only remaining **live EXE** dual-path

| # | Rule | Result |
|---|---|---|
| 1 | Existing real JS caller | YES — inventory table ~13029, warehouse docs ~17650/17692, HTML-only reserve ~18432, B14 JS ranking fallback ~26712 |
| 2 | Existing C# / authorized Core op | YES — `InventoryCore.Stock` |
| 3 | Existing Host/RunBusiness route | YES — `takeBusinessCore('inventory.stock', {item, whId})` |
| 4 | HTML-only fallback exists | YES — JS snapshot when Core object with `qty` is missing |
| 5 | Behavior can be parity-tested | YES technically; **PARITY UNKNOWN** (no frozen shared snapshot table). B4/B9 classified family NOT READY |
| 6 | No SQL/REST | YES |
| 7 | No print rewrite | YES |
| 8 | No persistence migration | YES (read) |
| 9 | No locked mutation must be redesigned | **FAIL** — locked inventory **family** (B4/B9/B12). Snapshot feeds HTML-only `inventory.reserve`/`release`. Fail-closed Core miss would blank live shop qty/reserved/available cells |
| 10 | Scope isolated to one capability | **FAIL** — coupled to warehouse docs, inventory table, mutation HTML-only paths, and `suggestPartsForCase` JS fallback |

B15 §6: **Do NOT automatically choose `inventory.stock`.** Tracker did not name it. Choosing it only because it is the last leftover live dual-path is the forbidden auto-choice.

Not selected. Not authorized for parity preparation in this step.

### Unused `calc.balance` / `calc.finalAmount` / `calc.availableStock` / `calc.reorderPoint`

| # | Rule | Result |
|---|---|---|
| 1 | Existing real JS caller | **FAIL** — wrappers + `SmartCore.calc` API only; no production form caller (B9/B12/B15: do not promote unused wrappers) |
| 2–8 | Core/Facade/Host/fallback/tests/no SQL/print/persist | YES (structurally look like `calc.sla`) |
| 9 | No locked mutation redesign | YES |
| 10 | Isolated | YES |

Disqualified on rule 1. High structural score is irrelevant.

### `warranty.canTransition`

| # | Rule | Result |
|---|---|---|
| 1 | Existing real JS caller | **FAIL for EXE** — `applyWarrantyTransition` Host branch uses `warranty.applyTransition` and does **not** call this. Only the HTML-only branch calls `canWarrantyTransition` (where Host is absent, so Core is never used) |
| 2–8 | Core/Facade/Host/boolean fallback/no SQL/print/persist | YES |
| 9 | No locked mutation redesign | **FAIL** — adjacent locked `warranty.applyTransition` / save / close / delete (B4/B9/B12 NOT READY; B15 §6) |
| 10 | Isolated | NO — gate for warranty close |

Not selected.

### `payment.deposit`

Rule 1 **FAIL**: `dchk` is unused. EXE deposit is already `payment.applyDeposit` fail-closed.

## 11.4 Ranking

No candidate qualifies. Ranking among qualifiers is not applicable.

```text
TOP CANDIDATE     = NONE
SELECTED SEAM     = NONE
READINESS         = NO AUTHORIZED SEAM
B15 STEP TYPE     = CHANGE_GATE (analysis only)
```

Not selected:

- Unused `calc.*` — no production form path.
- `inventory.stock` — locked inventory family; §6 do-not-auto-choose; parity UNKNOWN; fail-closed would blank shop stock displays.
- `warranty.canTransition` — no EXE live caller; locked-apply adjacency.
- `payment.deposit` — unused result.
- `service.*` — unused + locked delegates.
- Inventory report helpers without HTML Host calls — would invent a new dual-path.

---

# 12. Selected capability

```text
NONE
```

Reason: after B14, the live pure-calc sequence (B2–B11) and the last authorized live dual-path (`rules.suggestParts`) are exhausted. No leftover candidate satisfies **all** of B15 §5, and the only remaining live EXE dual-path is explicitly protected by B15 §6.

---

# 13. Ownership before

Unchanged this step. Leftover fail-open dual-paths remain as found:

`invStockSnapshot` ~18395:

```text
takeBusinessCore("inventory.stock")
  if Core object with qty: return Core
  else JS snapshot (qty/reserved/available/min/reorder/price)
```

No `hasBusinessCore` gate. EXE Core miss still runs JS snapshot.

`calcBalance` / `calcFinalAmount` / `calcAvailableStock` / `calcReorderPoint` ~26645–26674:

```text
takeBusinessCore("calc.*") then JS formula
```

No `hasBusinessCore` gate. **No live shop caller.**

`canWarrantyTransition` ~26718:

```text
takeBusinessCore("warranty.canTransition") then JS open→closed
```

No `hasBusinessCore` gate. EXE close path does not call it.

---

# 14. Ownership after

**Not applied in B15.** No ownership path changed.

---

# 15. Parity state

```text
PARITY = N/A (no selected seam)
```

Leftover notes (not a lock):

| Seam | Parity |
|---|---|
| `inventory.stock` | UNKNOWN — JS snapshot ≈ `InventoryCore.Stock` by inspection; no frozen shared table; family NOT READY |
| unused `calc.*` | Core `Balance_Final_Stock_Reorder_MatchHtml` exists; still INELIGIBLE (no live caller) |
| `warranty.canTransition` | UNKNOWN — open→closed boolean; not locked |
| `rules.suggestParts` | CONFIRMED (B13) / OWNED (B14) — do not reopen |

B15 §7 (parity preparation) applies only **after** a seam is selected. No seam was selected, so no vectors/tests were added.

---

# 16. Fail-closed state

```text
FAIL-CLOSED = NOT APPLIED
```

No ownership migration. Existing leftover fail-open dual-paths remain fail-open.

---

# 17. HTML-only state

```text
HTML-ONLY SAFE (unchanged; no product edit)
```

Host absent → current JS fallbacks stay. Do not delete JS. Do not require WebView2.

---

# 18. HTML test result

Not re-run. B15 changed no product code.

Last known B14 floor:

```text
node test_laegh.js Sirman_Final.html
  کل تست‌ها: 616  موفق: 616  ناموفق: 0
```

```text
HTML tests = NOT RUN (read-only; last known PASS)
```

---

# 19. Core test result

Not re-run.

Last known B14 floor:

```text
dotnet test desktop/Sirman.Core.Tests
  Passed: 151  Failed: 0
```

```text
Core tests = NOT RUN (read-only; last known PASS)
```

---

# 20. Regression result

```text
Regression = NOT RUN (no product diff)
```

Previous floors preserved by non-edit: B5 `calc.sla`, B6 `sale.line`, B8 `sale.total`, B10 warranty date, B11 `warrantyEndDate`, B13 suggestParts parity, B14 suggestParts ownership.

---

# 21. Protected-area audit

This analysis:

| Area | Status |
|---|---|
| Print / WebView2 print engine | UNCHANGED |
| Persistence | UNCHANGED |
| Backup | UNCHANGED |
| Invoice locked workflows | UNCHANGED |
| Inventory mutations | UNCHANGED |
| `inventory.stock` | UNCHANGED (not selected) |
| Accounting | UNCHANGED |
| Warranty save/close/delete | UNCHANGED |
| Authentication / authorization | UNCHANGED |
| Host contract | SAME HOST |
| SQL / REST / second Host | NONE |
| HTML-only fallback architecture | PRESERVED |
| Product version | UNCHANGED (`1405.5.27γ`) |

---

# 22. Changed files

At analysis gate (before docs commit):

```text
(empty — clean worktree)
```

After this report is committed, expected:

```text
deliveries/Reports/PHASE_3_ARCHITECTURE_MIGRATION_STEP_B15_CHANGE_GATE.md
deliveries/Reports/PHASE_3_MIGRATION_TRACKER.md
```

No `Sirman_Final.html`, `Laegh_Final.html`, Core, Host, tests, or version files.

---

# 23. Git diff summary

Docs-only. No product hunks.

---

# 24. Risks/blockers

| ID | Level | Note |
|---|---|---|
| R1 | HIGH | Live pure-calc + `rules.suggestParts` sequence is exhausted. Do not invent a new dual-path (`service.*`, inventory report helpers) to keep migrating |
| R2 | HIGH | Do not auto-choose `inventory.stock` just because it is the last live EXE dual-path |
| R3 | MEDIUM | Fail-closed `inventory.stock` would blank EXE shop qty/reserved/available on Core miss — requires an explicit later gate plus a parity lock |
| R4 | MEDIUM | `warranty.canTransition` is dead on EXE; do not migrate it as a fake calc seam |
| R5 | LOW | Unused `calc.*` wrappers still look score-high; they remain not live seams |
| R6 | MEDIUM | B2–B14 live EXE still unverified; does not authorize B15 product work |
| R7 | LOW | `payment.deposit` result is unused; do not treat it as a calc seam |

```text
B15 IMPLEMENTATION BLOCKER = no §5-complete candidate after B14
NO PRODUCT CODE CHANGE
```

This **is** `B15 SELECTION = BLOCKED`. Analysis completed. Implementation is **not authorized**.

A later instruction may explicitly authorize:

1. `inventory.stock` **parity lock** (shared snapshot table) after lifting the locked-family rule in writing, or
2. a different seam that does not exist in source today.

Until then: do not guess.

---

# 25. Human verification requirement

```text
LIVE EXE = NEEDS HUMAN VERIFICATION
```

Unchanged from B2–B14. This step performed no Windows/`Sirman.exe` test. Do not claim physical print verification.

---

# 26. Final status

```text
B15 REPORT

Branch:
cursor/phase-3-architecture-migration-3733

HEAD before:
79a9104

HEAD after:
79a9104 (product); docs commit follows

Worktree:
clean at gate; docs-only after report

Selected capability:
NONE

Step type:
CHANGE_GATE

PARITY:
N/A (no selected seam)

Ownership BEFORE:
unchanged leftover fail-open dual-paths (inventory.stock, unused calc.*, warranty.canTransition)
Ownership AFTER:
not changed this step

HTML-only:
PRESERVED (untouched)

Fail-closed:
NOT APPLIED

HTML tests:
NOT RUN (last known PASS 616 / 0)

Core tests:
NOT RUN (last known PASS 151 / 0)

Regression:
NOT RUN (no product diff)

Protected areas:
UNCHANGED

Product code modified:
NO

Changed files:
deliveries/Reports/PHASE_3_ARCHITECTURE_MIGRATION_STEP_B15_CHANGE_GATE.md
deliveries/Reports/PHASE_3_MIGRATION_TRACKER.md

Implementation:
NOT STARTED

Final status:
BLOCKED
LIVE EXE:
NEEDS HUMAN VERIFICATION
```

```text
B15 = ANALYSIS COMPLETED
B15 IMPLEMENTATION = NOT STARTED
B15 SELECTION = BLOCKED
CODE MODIFIED = NO

Candidate count: remaining dual-paths scored; none passed all ten §5 rules
Top candidate: NONE
Readiness: NO AUTHORIZED SEAM
Parity: N/A
Fail-closed: NOT APPLIED
HTML-only: HTML-ONLY SAFE
Persistence impact: NO
Print impact: NO
Backup impact: NO
Locked-core impact: NO (nothing implemented)
```

```text
B16 = NOT STARTED
IMPLEMENTATION = NOT AUTHORIZED BY THIS REPORT
```

```text
STOP — B15 blocked. No product code change.
```
