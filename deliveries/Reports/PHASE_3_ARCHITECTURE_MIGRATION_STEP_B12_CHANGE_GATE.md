# SIRMAN — PHASE 3 ARCHITECTURE MIGRATION
## STEP B12 — CHANGE GATE / NEXT OWNERSHIP SEAM

**Mode:** ANALYSIS / READ-ONLY  
**Date:** 1405/05/30 11:10:07 (Asia/Tehran)  
**Gregorian:** 21 August 2026  
**Branch:** `cursor/phase-3-architecture-migration-3733`  
**HEAD at analysis:** `5347034` (`docs: record B11 ownership report commit hash on tracker`)  
**B11 product commit:** `405bcb1` — this HEAD is a descendant  
**Live version:** `1405.5.27γ` (unchanged)

```text
CODE MODIFIED = NO
PRODUCT CODE MODIFIED = NO
B12 IMPLEMENTATION = NOT STARTED
Persistence changed = NO
Print changed = NO
Backup changed = NO
Locked workflows changed = NO
```

Tracker did not name a next seam (`Recommended next seam = wait for B12 instruction`). Per B12 §4 this step is a **read-only selection analysis** and **STOPS before implementation**.

---

# 1. Date

```text
1405/05/30
```

---

# 2. Exact time

```text
11:10:07
```

---

# 3. Timezone

```text
Asia/Tehran
```

---

# 4. Gregorian date

```text
21 August 2026
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
5347034  docs: record B11 ownership report commit hash on tracker
5347034525583346d420908df47c83400dd410a2
descendant of 405bcb1 = YES
```

---

# 7. HEAD after

Same as before for product code. Docs-only commit(s) may follow this report. Rollback for B12 analysis: delete this report and tracker analysis lines. No product rollback.

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
| B11 | COMPLETED (`405bcb1`, HTML 609 / Core 149) |
| STOP — BLOCKED | NO (analysis allowed) |

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
| B11 report + tracker | READ |
| B4 / B7 / B9 selection precedent | consulted |

Source inspected (authority):

```text
Sirman_Final.html          takeBusinessCore / hasBusinessCore call sites
BusinessFacade.Dispatch    existing ops
CalculationEngine          unused calc.* wrappers
PartsAdvisor.Suggest       rules.suggestParts
InventoryCore.Stock        inventory.stock
WarrantyWorkflow.CanTransition
```

```text
PHASE 3 CHANGE GATE — B12 ANALYSIS ONLY

Requested change:
None. Identify the next ownership seam after B11. Do not implement it.

Classification:
Analysis / selection gate (same class as B4 / B7 / B9)

Capability:
not yet authorized

Files expected this step:
deliveries/Reports/PHASE_3_ARCHITECTURE_MIGRATION_STEP_B12_CHANGE_GATE.md
deliveries/Reports/PHASE_3_MIGRATION_TRACKER.md (analysis timestamp only)

UI / Business / Persistence / Host / Print / Security / LOCKED / FROZEN:
UNTOUCHED

HTML-only preserved:
YES (no product edit)

New architecture introduced:
NO

Gate:
PASS for analysis
FAIL for implementation (tracker had no preselected seam; §4 STOP)

Reason:
B12 §4: if the tracker does not identify a seam, perform READ-ONLY analysis and STOP before implementation.
```

---

# 10. Selected B12 capability and why

## 10.1 B1–B11 history

Already fail-closed on EXE (do not reopen):

```text
invoice.line
invoice.totals
calc.sla
sale.line
sale.total
calc.warrantyEndDate
```

Locked mutations already gated with `hasBusinessCore()` (invoice/sale/warranty save-close-delete, inventory reserve/release/consume/addStock/apply*, payment.apply*). **Forbidden as B12 winners.**

B11 leftover: tracker said wait for B12. B9 runner-up after `calc.warrantyEndDate` was `rules.suggestParts`. That leftover is evidence, not a preselected winner. B12 re-scored remaining **live** dual-paths from source after B11.

## 10.2 Candidate inventory

Grep of `Sirman_Final.html` `takeBusinessCore(` plus Facade `Dispatch` after B11.

### Already migrated / already fail-closed (out of B12)

| Capability | Status |
|---|---|
| `invoice.line` / `invoice.totals` | OWNED |
| `calc.sla` | OWNED |
| `sale.line` / `sale.total` | OWNED |
| `calc.warrantyEndDate` | OWNED (B11) |

Phase 2 **live** pure-calc sequence is **exhausted**. Remaining SmartCore wrappers `calc.balance` / `calc.finalAmount` / `calc.availableStock` / `calc.reorderPoint` have **no production form caller** besides the wrapper + `SmartCore.calc` API object.

### Remaining dual-path (HTML already calls `takeBusinessCore`)

### `rules.suggestParts`

| Field | Evidence |
|---|---|
| JS owner | `suggestPartsForCase` ~26687; live warranty form `applySuggestedWarParts` ~19531 |
| Core owner | `PartsAdvisor.Suggest` (`PartsAdvisor.cs`) |
| Facade | `"rules.suggestParts"` ~92 |
| Host route | `takeBusinessCore('rules.suggestParts', {parts, prodCode, model, problem})` inside `hasBusinessCore()` |
| Fail-closed today | **INCOMPLETE** — Host present + Core not an array still runs JS ranking |
| Fallback | catalog ranking; `invStockSnapshot` (inventory **read**) |
| Persistence | writes in-memory `_waParts` / `_wcParts` until later `warranty.save` (out of scope) |
| Protected risk | inventory.stock coupling; heuristic ranking; warranty **form** adjacent, not mutation |
| Parity | PARTIAL — ranking rules match by inspection; no shared frozen suggestion table |
| Readiness | structurally the next live dual-path; **not** a B5-class pure calc |

### `inventory.stock`

| Field | Evidence |
|---|---|
| JS | `invStockSnapshot` ~18395 — **no** `hasBusinessCore` gate |
| Core | `InventoryCore.Stock` |
| Host | `takeBusinessCore('inventory.stock', {item, whId})` |
| Live | inventory table, warehouse docs, reserve HTML-only, suggestParts fallback |
| Readiness | **NOT READY** — locked inventory family (B4/B9) |

### `warranty.canTransition`

| Field | Evidence |
|---|---|
| JS | `canWarrantyTransition` ~26716 |
| Core | `WarrantyWorkflow.CanTransition` (open→closed only) |
| Host | `warranty.canTransition` — **no** `hasBusinessCore` |
| Live EXE | `applyWarrantyTransition` uses `warranty.applyTransition` and does **not** call this on Host |
| Live HTML-only | `applyWarrantyTransition` → `canWarrantyTransition` |
| Readiness | **NOT READY** — adjacent locked `warranty.applyTransition` |

### Unused `calc.balance` / `finalAmount` / `availableStock` / `reorderPoint`

Wrappers ~26645–26674. Production form callers besides wrapper/API: **none**. Core tests exist (`Balance_Final_Stock_Reorder_MatchHtml`). **INELIGIBLE as B12 winner** (same B9 rule: unused Core/wrapper is not a live shop seam).

### Unused / non-dual HTML

`calc.addJalaliMonths`, `invoice.validate`, `payment.remaining` — Facade only, no HTML `takeBusinessCore`. **INELIGIBLE.**

`inventory.kardex` / `lowStock` / `search` / `value` / `deadStock` / `consumed` — Core/Facade exist; HTML functions (`invKardexFromMoves`, …) do **not** call Host. Wiring them would invent a new HTML Host path, not migrate an existing dual-path. **INELIGIBLE for this gate.**

`payment.deposit` — called on the HTML-only branch of `depositToAccount`; result `dchk` is **unused**. EXE already uses fail-closed `payment.applyDeposit`. **INELIGIBLE.**

### Rejected (protected / mutation)

| Candidate | Why REJECTED FOR B12 |
|---|---|
| `invoice.close` / `delete` / `sale.delete` | locked mutation |
| `inventory.*` mutations | locked |
| `payment.apply*` / edit / delete / reverse | accounting mutation |
| `warranty.save` / `close` / `delete` / `applyTransition` | warranty mutation |
| `service.save` / `close` / `addPart` | Facade only; zero HTML `service.*` — FORBIDDEN |
| Print engine / Print Center | FROZEN |
| Backup / `migrateBackup` / persist schema | FROZEN/locked |

## 10.3 Candidate scoring

B12 weights (max +25 before penalties). Scores from source after B11.

### `rules.suggestParts` — **19**

| Criterion | Pts | Evidence |
|---|---:|---|
| Core | +3 | `PartsAdvisor.Suggest` |
| Facade | +3 | `rules.suggestParts` |
| Host | +2 | live `takeBusinessCore` |
| Tests | +2 | `SuggestParts_OnlyFromCatalog`, `SuggestParts_UsesAvailableNotRawQty`; HTML catalog-only test |
| Pure calc | 0 | heuristic ranking + `InventoryCore.Stock` / `invStockSnapshot` |
| HTML-only fallback | +2 | existing JS ranking |
| No persist | +2 | in-memory part-req rows until `warranty.save` |
| No locked mutation | +3 | does not call `warranty.save` |
| No print | +2 | no print engine |
| No backup | +2 | no backup keys |
| Low coupling | 0 | warranty form + inventory read |
| Penalties | 0 | no new Host / REST / schema / print rewrite |

### Unused `calc.balance` / `finalAmount` / `availableStock` / `reorderPoint` — **23 each (disqualified)**

Weight table is high. Disqualified: **no live shop caller**.

### `warranty.canTransition` — **15**

Core/Facade/Host/tests/boolean fallback/no persist, then **−5** adjacent locked `warranty.applyTransition`. EXE close path already owned by `warranty.applyTransition`.

### `inventory.stock` — not scored as winner

Would look like a read calc. B4/B9: inventory **family** is NOT READY. Used by mutations’ HTML-only path. Fail-closed would blank shop stock displays on Core miss.

No score was raised to force `rules.suggestParts`. It wins among **live** remaining dual-paths that are not locked mutations: Core+Facade+Host, live warranty-form button, HTML-only ranking must remain.

```text
TOP CANDIDATE = rules.suggestParts
JS owner        = suggestPartsForCase
Core owner      = PartsAdvisor.Suggest
Facade          = rules.suggestParts
Host            = sirmanHost.RunBusiness("rules.suggestParts", json)
HTML-only       = existing JS ranking (must remain)
READINESS       = PARITY LOCK REQUIRED
```

Not selected:

- Unused `calc.*` — no production form path.
- `inventory.stock` — locked inventory family.
- `warranty.canTransition` — locked-apply adjacency; EXE already uses `warranty.applyTransition`.
- `service.*` — unused + locked delegates.
- Inventory report helpers without HTML Host calls — would invent a new dual-path.

---

# 11. Exact ownership path BEFORE

`suggestPartsForCase` ~26687:

```text
applySuggestedWarParts
  → suggestPartsForCase({prodCode, model, problem, parts})
    → if hasBusinessCore():
         takeBusinessCore("rules.suggestParts", {parts, prodCode, model, problem})
         if result is array: return it
    → ALWAYS then (Host absent OR Core not an array):
         JS catalog ranking + invStockSnapshot.available
```

EXE Core miss silently runs JS. Same dual-ownership defect B2/B5/B11 removed from pricing/SLA/warranty date.

`inventory.stock` (not selected) still: `takeBusinessCore` then JS snapshot with **no** `hasBusinessCore` gate.

---

# 12. Exact ownership path AFTER

**Not applied in B12.** A later implementation gate, if authorized after a parity lock, would be:

```text
EXE / Host present:
  suggestPartsForCase
    → RunBusiness("rules.suggestParts")
    → PartsAdvisor.Suggest
    → C# array  OR  empty/null (fail-closed)
    NEVER JS ranking while Host is present

HTML-only / Host absent:
  existing JS ranking + invStockSnapshot
```

No third ranking engine. No new Host. Do not fold `warranty.save` or `inventory.stock` into the same step.

---

# 13. JavaScript fallback status

```text
HTML-ONLY SAFE (unchanged; no product edit)
```

Host absent → current ranking must stay. Do not delete JS. Do not require WebView2.

---

# 14. Fail-closed behavior

Can follow B2/B5/B11 **without new architecture**, but EXE shop behavior on Core miss would change (empty suggestions instead of JS ranking):

| Host | Core | Required later |
|---|---|---|
| absent | n/a | JS ranking |
| present | array | Core array |
| present | null / non-array | **no** JS ranking |

```text
FAIL-CLOSED = SAFE TO APPLY LATER (behavior change on Core miss is the point of ownership)
```

Not applied in B12.

---

# 15. Core implementation used

Existing, not rewritten this step:

```text
PartsAdvisor.Suggest(catalog, prodCode, model, problem)
  match prodCode / model / problem blob (same Persian why-strings as JS)
  qty = InventoryCore.Stock(part, null).Available
  never invent a part code outside the catalog
```

JS `indexOf` / C# `Contains` after lowercasing are intended to match. Do not “improve” ranking in an ownership gate.

---

# 16. Host/Facade path

Existing:

```text
"rules.suggestParts" => PartsAdvisor.Suggest(
    o["parts"] as JsonArray,
    JsonVal.Str(prodCode), JsonVal.Str(model), JsonVal.Str(problem))
```

`RunBusiness` signature unchanged. No second Host. No REST. No SQL.

---

# 17. Parity vectors/tests

Do **not** add tests in B12.

| Axis | JS `suggestPartsForCase` | Core `PartsAdvisor.Suggest` | Match? |
|---|---|---|---|
| Catalog-only | skip empty code; no invented parts | same | YES |
| prodCode | `pc===prodCode` | `pc == prodCode` | YES |
| model | `pc===model` or name `indexOf` | `pc == model` or name `Contains` | YES (Ordinal) |
| problem | lowercased blob `indexOf` | lowercased blob `Contains` | YES intended |
| qty | `invStockSnapshot(p).available` | `InventoryCore.Stock(p,null).Available` | YES intended |
| Why strings | same Persian sentences | same | YES |
| EXE Core miss today | **JS still runs** | n/a | ownership defect |

Known overlapping tests:

- Catalog `P-HEAT` / `402003` / problem `هیتر` → first hit `P-HEAT` (HTML + Core facade)
- Reserved 4 of qty 10 → Core qty **6** (available, not raw)
- Unknown prodCode + nonsense problem → no invented parts (HTML)

Classification:

```text
PARITY PARTIAL
```

Not `PARITY CONFIRMED` (no shared frozen JSON covering multi-hit order, model-only match, empty catalog, reserved stock on the JS side).  
Not `PARITY MISMATCH` (no contradictory ranking found in-repo).

A later lock (not this step) needs a shared catalog table before changing `suggestPartsForCase`.

---

# 18. HTML test result

Not re-run. B12 changed no product code.

Last known B11 floor:

```text
node test_laegh.js Sirman_Final.html
  کل تست‌ها: 609  موفق: 609  ناموفق: 0
```

```text
HTML tests = NOT RUN (read-only; last known PASS)
```

---

# 19. Core test result

Not re-run.

Last known B11 floor:

```text
dotnet test desktop/Sirman.Core.Tests
  Passed: 149  Failed: 0
```

```text
Core tests = NOT RUN (read-only; last known PASS)
```

---

# 20. Regression result

```text
Regression = NOT RUN (no product diff)
```

Required later groups if `rules.suggestParts` is implemented: هسته هوشمند / پیشنهاد قطعه, B11 warranty date, warranty wizard, inventory engine (because fallback reads stock). Print group must stay green without print edits.

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
| Accounting | UNCHANGED |
| Warranty save/close/delete | UNCHANGED |
| Authentication / authorization | UNCHANGED |
| Host contract | SAME HOST |
| SQL / REST / second Host | NONE |
| HTML-only fallback architecture | PRESERVED |
| Product version | UNCHANGED (`1405.5.27γ`) |

Recommended later candidate does **not** require touching those areas if scoped to `suggestPartsForCase` ownership only. Folding `inventory.stock` or `warranty.save` into the same step would fail this audit.

---

# 22. `git diff --name-only`

At analysis gate (before docs commit):

```text
(empty — clean worktree)
```

After this report is committed, expected:

```text
deliveries/Reports/PHASE_3_ARCHITECTURE_MIGRATION_STEP_B12_CHANGE_GATE.md
deliveries/Reports/PHASE_3_MIGRATION_TRACKER.md
```

No `Sirman_Final.html`, `Laegh_Final.html`, Core, Host, tests, or version files.

---

# 23. Risks/blockers

| ID | Level | Note |
|---|---|---|
| R1 | HIGH | Do not open `service.*` or inventory **mutations** as a shortcut |
| R2 | MEDIUM | `rules.suggestParts` JS fallback calls `invStockSnapshot` → `inventory.stock`; a later gate must not migrate stock in the same step |
| R3 | MEDIUM | Fail-closed empties EXE suggestions on Core miss — ownership, not a ranking “fix” |
| R4 | MEDIUM | Warranty form adjacency; do not fold `warranty.save` |
| R5 | LOW | Unused `calc.*` wrappers look score-high; they are not live seams |
| R6 | MEDIUM | B2–B11 live EXE still unverified; does not block analysis |
| R7 | LOW | `payment.deposit` result is unused; do not treat it as a calc seam |

```text
B12 IMPLEMENTATION BLOCKER = tracker had no preselected seam + PARITY PARTIAL
NO PRODUCT CODE CHANGE
```

This is **not** `B12 = BLOCKED` as a failed gate. Analysis completed. Implementation is **not authorized** by this report.

---

# 24. Human verification requirement

```text
LIVE EXE = NEEDS HUMAN VERIFICATION
```

Unchanged from B2–B11. This step performed no Windows/`Sirman.exe` test. Do not claim physical print verification.

---

# 25. Final status

```text
B12 OWNERSHIP MIGRATION REPORT

Branch:
cursor/phase-3-architecture-migration-3733

HEAD before:
5347034

HEAD after:
5347034 (product); docs commit follows

Worktree:
clean at gate; docs-only after report

Operation:
rules.suggestParts  (recommended; NOT implemented)

Ownership:
BEFORE:
  hasBusinessCore + takeBusinessCore; Core miss still runs JS ranking
AFTER:
  not changed this step

Parity:
PARITY PARTIAL

HTML-only fallback:
PRESERVED (untouched)

Fail-closed:
NOT APPLIED (SAFE later)

HTML tests:
NOT RUN (last known PASS 609 / 0)

Core tests:
NOT RUN (last known PASS 149 / 0)

Regression:
NOT RUN (no product diff)

Protected areas:
UNCHANGED

Product code modified:
NO

Implementation:
NOT STARTED

Report:
deliveries/Reports/PHASE_3_ARCHITECTURE_MIGRATION_STEP_B12_CHANGE_GATE.md

Final status:
COMPLETED  (analysis / change gate only)
LIVE EXE:
NEEDS HUMAN VERIFICATION
```

```text
B12 = ANALYSIS COMPLETED
B12 IMPLEMENTATION = NOT STARTED
CODE MODIFIED = NO

Candidate count: remaining live dual-paths scored; unused calc.* disqualified
Top candidate: rules.suggestParts
Readiness: PARITY LOCK REQUIRED
Parity: PARITY PARTIAL
Fail-closed: SAFE later (not applied)
HTML-only: HTML-ONLY SAFE
Persistence impact: NO
Print impact: NO
Backup impact: NO
Locked-core impact: NO if scoped to suggestParts only
```

A later implementation gate must:

1. Freeze a shared suggestion-vector table **before** changing `suggestPartsForCase`.
2. Complete fail-closed (no JS ranking on EXE Core miss).
3. Keep HTML-only JS ranking.
4. Not change `PartsAdvisor` ranking, `inventory.stock`, `warranty.save`, persist, backup, or print.
5. Not invent `service.*` HTML Host calls.

```text
B13 = NOT STARTED
IMPLEMENTATION = NOT AUTHORIZED BY THIS REPORT
```

```text
STOP — B12 change gate complete. Wait for B13 instruction.
```
