# SIRMAN — PHASE 3 ARCHITECTURE MIGRATION
## STEP B9 — NEXT OWNERSHIP SEAM

**Mode:** ANALYSIS / READ-ONLY  
**Date:** 1405/05/30 10:20:55 (Asia/Tehran)  
**Gregorian:** 21 August 2026  
**Branch:** `cursor/phase-3-architecture-migration-3733`  
**HEAD at analysis:** `79784f6` (`docs: record B8 sale.total commit hash on tracker`)  
**B8 product commit:** `9582215` — this HEAD is a descendant  
**Live version:** `1405.5.27γ` (unchanged)

```text
CODE MODIFIED = NO
B9 IMPLEMENTATION = NOT STARTED
Product code modified = NO
Persistence changed = NO
Print changed = NO
Backup changed = NO
Locked workflows changed = NO
```

---

# 1. Date / time / timezone

```text
1405/05/30 10:20:55 Asia/Tehran
```

---

# 2. Branch

```text
cursor/phase-3-architecture-migration-3733
```

---

# 3. HEAD

```text
79784f6
79784f61606ae3a73ca7516ed8b99a0ab7805317
descendant of 9582215 = YES
```

---

# 4. Worktree

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
| STOP — BLOCKED | NO |

No stash, reset, rebase, merge, cherry-pick, or product edits.

---

# 5. Change Gate

Read before scoring:

| Document | Status |
|---|---|
| `docs/PHASE_3_CHANGE_GATE.md` | READ |
| `docs/DEVELOPMENT_GOVERNANCE.md` | READ |
| `docs/ARCHITECTURE_RULES.md` | READ |
| `docs/PRINT_MODULE_BASELINE.md` | READ |
| `.agents/skills/laegh-software-workflow/SKILL.md` | READ |
| B7, B8 reports + tracker | READ |
| B1–B6 precedent | consulted |

```text
PHASE 3 CHANGE GATE — B9 ANALYSIS ONLY

Requested change:
None. Identify the next ownership seam after B8. Do not implement it.

Classification:
Analysis / selection gate (same class as B4 / B7)

Capability:
not yet authorized

Files expected this step:
deliveries/Reports/PHASE_3_ARCHITECTURE_MIGRATION_STEP_B9_NEXT_OWNERSHIP_SEAM.md
deliveries/Reports/PHASE_3_MIGRATION_TRACKER.md (analysis timestamp only)

UI / Business / Persistence / Host / Print / Security / LOCKED / FROZEN:
UNTOUCHED

HTML-only preserved:
YES (no product edit)

New architecture introduced:
NO

Gate:
PASS for analysis
FAIL for implementation (not requested)

Reason:
B9 is read-only. Scoring does not authorize an implementation step.
```

---

# 6. Governance read

Standing rules applied:

- Reports are Markdown under `deliveries/Reports/`.
- Print remains FROZEN.
- EXE ownership uses fail-closed: Host present + Core null → no JS fallback.
- HTML-only JS fallbacks must stay.
- Locked: invoice/inventory/accounting/warranty **mutation**, auth, REST, SQL, second Host, backup schema, persist format.
- `service.*` remains FORBIDDEN (zero HTML `takeBusinessCore('service.*')`).
- Tracker is checklist authority. B9 analysis is not product COMPLETED.
- Do not start B10 (migration checkpoint) from this analysis.

---

# 7. B1–B8 history

| Step | Seam | Status | Meaning for B9 |
|---|---|---|---|
| B1 | invoice parity lock | COMPLETED | Frozen invoice vectors |
| B2 | `invoice.line` | COMPLETED | Fail-closed pattern |
| B3 | `invoice.totals` | COMPLETED | Totals followed line |
| B4 | seam analysis | COMPLETED | Chose `calc.sla`; runner-up sale pricing then warranty date |
| B5 | `calc.sla` | COMPLETED | Fail-closed display calc |
| B6 | `sale.line` | COMPLETED | Line pricing owned |
| B7 | seam analysis | ANALYSIS COMPLETED | Chose `sale.total` |
| B8 | `sale.total` | COMPLETED | Totals owned; HTML 600 / Core 146; live EXE still unverified |

Already fail-closed on EXE:

```text
invoice.line
invoice.totals
calc.sla
sale.line
sale.total
```

B7 leftover after B8: `calc.warrantyEndDate` was runner-up (Jalali, live form). That leftover is evidence, not a preselected winner. B9 re-scored remaining live seams from source after B8.

B8 live EXE: `NEEDS HUMAN VERIFICATION`. That does not block analysis.

---

# 8. Candidate inventory

Grep of `Sirman_Final.html` `takeBusinessCore(` plus Facade `Dispatch` after B8.

## 8.1 Already migrated (out of B9)

| Capability | Status |
|---|---|
| `invoice.line` | OWNED |
| `invoice.totals` | OWNED |
| `calc.sla` | OWNED |
| `sale.line` | OWNED |
| `sale.total` | OWNED (B8) |

## 8.2 Remaining live or wrapper calc/rule seams

### `calc.warrantyEndDate`

| Field | Evidence |
|---|---|
| JS owner | `calcWarrantyEndDate` ~26632; live warranty form `calcWarrExpFromBuy` ~19648 |
| Core owner | `CalculationEngine.WarrantyEndDate` → `AddJalaliMonths` (`CalculationEngine.cs` ~10–29) |
| Facade | `"calc.warrantyEndDate"` ~42 |
| Host route | `takeBusinessCore('calc.warrantyEndDate', {purchaseDate, periodMonths})` — **no** `hasBusinessCore` gate |
| Fallback | `addJalaliMonths` ~19633, including Host present + Core miss (pre-B2 defect) |
| Persistence | DOM `#wdN_wexp` until later `warranty.save` (out of scope) |
| Protected risk | Jalali calendar (Esfand always 29 in both JS and C#); warranty **form** adjacent, not mutation |
| Parity | PARTIAL — algorithms match by inspection; no shared frozen vector table |
| Readiness | structurally READY after a parity lock |

### `rules.suggestParts`

| Field | Evidence |
|---|---|
| JS | `suggestPartsForCase` ~26679; live ~19531 |
| Core | `PartsAdvisor.Suggest` |
| Host | `rules.suggestParts` |
| Fallback | JS ranking; `invStockSnapshot` (inventory **read**) |
| Fail-closed | NO — if Core is not an array, JS still runs on EXE |
| Tests | `SuggestParts_OnlyFromCatalog`, `SuggestParts_UsesAvailableNotRawQty` |
| Readiness | NOT NEXT (inventory coupling; heuristic; fail-closed would change EXE suggestions) |

### Unused `calc.balance` / `calc.finalAmount` / `calc.availableStock` / `calc.reorderPoint`

SmartCore wrappers ~26637–26666 and API object ~26731. Production form callers besides wrapper/API: **none**. Core tests exist. Section 5: unused Core/wrapper is not a valid next seam. **INELIGIBLE as B9 winner.**

### `warranty.canTransition`

`canWarrantyTransition` ~26708. Core `WarrantyWorkflow.CanTransition` (open→closed only). Pre-B2 fallback. Adjacent to locked `warranty.applyTransition`. **NOT READY.**

### Unused Facade-only

`calc.addJalaliMonths` — Core/Facade exist; **no** HTML `takeBusinessCore('calc.addJalaliMonths')`. Live path is `calc.warrantyEndDate`, which already delegates to `AddJalaliMonths` in Core. **Not a separate live seam.**

`invoice.validate`, `payment.remaining` — no live HTML `takeBusinessCore`. **INELIGIBLE.**

## 8.3 Rejected (protected / mutation / unused)

| Candidate | Why REJECTED FOR B9 |
|---|---|
| `invoice.close` / `delete` / `sale.delete` | locked mutation |
| `inventory.*` mutations + `inventory.stock` | inventory family / locked |
| `payment.apply*` / edit / delete / reverse | accounting mutation |
| `payment.deposit` / `payment.withdraw` | HTML-only still mutates accounts; EXE uses apply* |
| `warranty.save` / `close` / `delete` / `applyTransition` | warranty mutation |
| `service.save` / `close` / `addPart` | Facade only; zero HTML `service.*` — FORBIDDEN |
| Print engine / Print Center | FROZEN |
| Backup / `migrateBackup` / persist schema | FROZEN/locked |

Candidate count scored below: **7** remaining calc/rule wrappers (not already migrated). Mutations/print/backup are rejects, not scored as winners.

---

# 9. Candidate scoring

B9 weights (max +25 before penalties). Scores from source after B8, not from B7 leftover.

### `calc.warrantyEndDate` — **23**

| Criterion | Pts | Evidence |
|---|---:|---|
| Core | +3 | `WarrantyEndDate` / `AddJalaliMonths` |
| Facade | +3 | `calc.warrantyEndDate` |
| Host | +2 | live `takeBusinessCore` |
| Tests | +2 | Core `WarrantyEndDate_Plus24Months`, `Jalali_MonthOverflowAndZeroMonths`; HTML `addJalaliMonths` + `calcWarrantyEndDate('1405/05/05',24)` |
| Pure calc | +2 | deterministic month add (Esfand clamped to 29 in **both** trees) |
| HTML-only fallback | +2 | existing `addJalaliMonths` |
| No persist | +2 | calc writes DOM only |
| No locked mutation | +3 | does not call `warranty.save` |
| No print | +2 | no print engine |
| No backup | +2 | no backup keys |
| Low coupling | 0 | warranty form + Jalali calendar |
| Penalties | 0 | no new Host / REST / schema / print rewrite |

### `rules.suggestParts` — **19**

+3/+3/+2 Core/Facade/Host; +2 Core suggest tests; **no +2 pure calc** (heuristic + `InventoryCore.Stock`); +2 JS fallback; +2 no persist; +3 no mutation; +2/+2 print/backup. **No +2 low coupling.** Fail-closed would empty EXE suggestions on Core miss.

### Unused `calc.balance` / `finalAmount` / `availableStock` / `reorderPoint` — **23 each (disqualified)**

Weight table is high. Disqualified: **no live shop caller**. Cannot win B9.

### `warranty.canTransition` — **15**

Core/Facade/Host/tests/boolean fallback/no persist, then **−5** adjacent locked `warranty.applyTransition`. Not low coupling.

No score was raised to force `calc.warrantyEndDate`. It wins among **live** remaining calcs: Core+Facade+Host, no inventory snapshot, no mutation, live warranty form, algorithms already intended to match `addJalaliMonths`.

---

# 10. Top candidate

```text
TOP CANDIDATE = calc.warrantyEndDate
JS owner        = calcWarrantyEndDate
Core owner      = CalculationEngine.WarrantyEndDate
Facade          = calc.warrantyEndDate
Host            = sirmanHost.RunBusiness("calc.warrantyEndDate", json)
HTML-only       = addJalaliMonths (must remain)
```

Not selected:

- `rules.suggestParts` — inventory read in both JS fallback and Core `InventoryCore.Stock`.
- Unused `calc.*` — no production form path.
- `warranty.canTransition` — locked-apply adjacency.
- `service.*` — unused + locked delegates.

---

# 11. JS ownership

`calcWarrantyEndDate(purchaseDate, periodMonths)` ~26632:

1. Always calls `takeBusinessCore('calc.warrantyEndDate', {purchaseDate, periodMonths})` if `takeBusinessCore` exists (does **not** check `hasBusinessCore()` first).
2. If Core is non-null, return Core string.
3. Else `addJalaliMonths(purchaseDate, periodMonths)` or `purchaseDate||''`.

Live caller: `calcWarrExpFromBuy` writes `#wdN_wexp` when buy date and months are both set. Persist happens only later in `warranty.save` — out of B9/B-next scope.

`addJalaliMonths` ~19633: `parseInt(months)||0`; empty/zero months return original date; split on `/` or `-`; month wrap; day clamp `maxD = (m<=6)?31:(m<=11?30:29)`.

---

# 12. Core ownership

`CalculationEngine.WarrantyEndDate` = `AddJalaliMonths(purchaseDate, ToInt(periodMonths))`.

`AddJalaliMonths`: empty date or `months==0` → original; parse y/m/d; same wrap and Esfand=29 clamp; `Pad` to `YYYY/MM/DD`.

No new calendar algorithm is required. Do not “fix” leap Esfand in a later ownership gate unless a dedicated Jalali gate says so — JS and C# currently share the 29-day Esfand rule.

---

# 13. BusinessFacade route

```text
"calc.warrantyEndDate" => CalculationEngine.WarrantyEndDate(
    JsonVal.Str(o, "purchaseDate"),
    JsonVal.Str(o, "periodMonths"))
```

Existing. No DTO rename required. Unused sibling `"calc.addJalaliMonths"` must not be introduced as a second HTML Host call in the same step.

---

# 14. Host route

```text
HTML calcWarrantyEndDate
  → takeBusinessCore("calc.warrantyEndDate", {purchaseDate, periodMonths})
    → runBusinessCore
      → getSirmanHostSync().RunBusiness
        → BusinessFacade.Dispatch("calc.warrantyEndDate")
```

`RunBusiness` signature unchanged. No second Host. No REST. No SQL.

A later implementation should add the B2/B5 `hasBusinessCore()` gate so EXE Core miss does not fall through to `addJalaliMonths`.

---

# 15. HTML-only fallback

```text
HTML-ONLY SAFE
```

Host absent → current `addJalaliMonths` must stay. Do not delete JS. Do not require WebView2.

`calcWarrExpFromBuy` already falls back to `addJalaliMonths` if `calcWarrantyEndDate` is missing.

---

# 16. Parity analysis

| Axis | JS `addJalaliMonths` | Core `AddJalaliMonths` | Match? |
|---|---|---|---|
| Inputs | date string, months | `purchaseDate`, `ToInt(periodMonths)` | YES |
| Output | `YYYY/MM/DD` or original | same | YES |
| months 0 / empty | `parseInt\|\|0` then `!months` → original | `months == 0` → original | YES |
| Missing date | `jdate\|\|''` | `jdate ?? ""` | YES |
| Split | `/` or `-` | `/` or `-` | YES |
| Month wrap | while >12 / <1 | same | YES |
| Day clamp | 31/31/30/29 | same | YES |
| Esfand | always 29 | always 29 | YES (shared simplification) |
| Side effects | none in calc | none | YES |
| EXE Core miss today | **JS still runs** | n/a | ownership defect, not formula mismatch |

Known overlapping tests:

- `1405/05/05` + 24 → `1407/05/05` (HTML + Core)
- `1405/05/05` + 0 → `1405/05/05` (Core)
- `1405/11/30` + 1 → `1405/12/29` (Core only)
- `1405/01/31` + 1 → `1405/02/31` (HTML only)
- `1405/11/15` + 2 → `1406/01/15` (HTML only)

Classification:

```text
PARITY PARTIAL
```

Not `PARITY MISMATCH` (no contradictory formula found).  
Not `PARITY UNKNOWN` (both implementations are in-repo and line-equivalent).  
Not `PARITY CONFIRMED` (no shared frozen JSON covering overflow, year wrap, empty, invalid, 12/13 months, negative months).

Missing vectors for a later lock (do **not** add them in B9):

1. empty date → `''`
2. zero months → original date
3. `1405/05/05` + 24 → `1407/05/05`
4. `1405/11/30` + 1 → `1405/12/29` (Esfand clamp)
5. `1405/01/31` + 1 → `1405/02/31`
6. `1405/11/15` + 2 → `1406/01/15` (year wrap)
7. invalid / too-short date → original string

```text
PARITY MISMATCH → no
PARITY UNKNOWN → no
PARITY PARTIAL → lock the table above before implementation
```

---

# 17. Fail-closed analysis

Can follow B2/B5/B8 without new architecture:

| Host | Core | Required |
|---|---|---|
| absent | n/a | `addJalaliMonths` |
| present | date string | Core result |
| present | null/failure | **no** `addJalaliMonths` |

Today EXE Core miss still runs JS. Fail-closed is **SAFE to apply**.

Return-type caution: `calcWarrExpFromBuy` assigns `expEl.value = calcWarrantyEndDate(...)`. A `null` return would stringify to `"null"`. A later implementation must keep a **string** sentinel (`''` or original purchase date) rather than `null`, unless that one caller is updated in the same seam. Do not change `warranty.save`.

```text
FAIL-CLOSED = SAFE
```

---

# 18. Persistence / side-effect analysis

| Question | `calc.warrantyEndDate` |
|---|---|
| Reads persistence? | NO |
| Writes persistence? | NO |
| Changes backup? | NO |
| Changes schema? | NO |
| Changes inventory? | NO |
| Changes accounts? | NO |
| Changes warranty state? | NO (DOM expiry field only; save is separate) |
| Changes invoice state? | NO |

```text
Writes persistence = NO
Changes backup = NO
Changes schema = NO
```

---

# 19. Protected-area audit

Recommended candidate:

```text
Print changed?                      NO
Persistence changed?                NO
Backup changed?                     NO
Invoice locked workflow changed?    NO
Inventory mutation changed?         NO
Accounting changed?                 NO
Warranty mutation changed?          NO
Security changed?                   NO
Host contract changed?              NO
New API required?                   NO
```

If a later gate also edits `warranty.save`, that would be YES and must be rejected. B9 does not authorize that.

---

# 20. Test readiness

Do **not** add tests in B9.

| Layer | Existing | Missing |
|---|---|---|
| HTML | `addJalaliMonths("1405/05/05",24)`; `1405/01/31+1`; `1405/11/15+2`; `calcWarrantyEndDate` string contains `addJalaliMonths` and Host-less `1407/05/05` | Host-wins distinctive date; fail-closed (not JS add); no persist; shared JSON |
| Core | `WarrantyEndDate_Plus24Months`; `Jalali_MonthOverflowAndZeroMonths` | Facade `calc.warrantyEndDate` against the same JSON; 01/31 and 11/15 cases in Core |
| Shared vectors | **ABSENT** | table in §16 |
| Regression | warranty form tests; B5 SLA; B6/B8 sale pricing | must stay green |

Minimum for a later implementation (not this step): shared JSON + HTML Host-wins/fail-closed/HTML-only/no-persist + Core/Facade vectors. Same shape as B8, date strings instead of money.

---

# 21. Risk analysis

| ID | Level | Note |
|---|---|---|
| R1 | MEDIUM | Agent may “fix” Jalali leap Esfand during ownership — **forbidden** unless a dedicated calendar gate |
| R2 | LOW | `null` vs `''` sentinel in `calcWarrExpFromBuy` |
| R3 | MEDIUM | Warranty form adjacency; do not fold `warranty.save` |
| R4 | MEDIUM | B2–B8 live EXE still unverified; this seam would also be `NEEDS HUMAN VERIFICATION` |
| R5 | HIGH | Do not open `service.*` or `rules.suggestParts` as a shortcut |
| R6 | LOW | Unused `calc.*` wrappers look score-high; they are not live seams |

Rollback for B9: delete this report (and tracker analysis lines) only. No product commit.

---

# 22. Recommendation

### Option B — PARITY LOCK REQUIRED

```text
NEXT SEAM = calc.warrantyEndDate
READINESS = PARITY LOCK REQUIRED
```

Structurally safe: Core + Facade + Host exist, HTML-only fallback exists, persist/print/locked mutation are NO, fail-closed is SAFE.

Option A is **not** used: B9 Option A requires `PARITY = CONFIRMED`. Current status is `PARITY PARTIAL`.

Option C is false: a safe seam exists.

A later implementation gate must:

1. Freeze the shared date vectors in §16 **before** changing `calcWarrantyEndDate`.
2. Add `hasBusinessCore()` fail-closed (no `addJalaliMonths` on EXE Core miss).
3. Keep HTML-only `addJalaliMonths`.
4. Keep string output (avoid `"null"` in the expiry field).
5. Not change Core month arithmetic, Host signature, `warranty.save`, persist, backup, or print.

```text
B10 = NOT STARTED
IMPLEMENTATION = NOT AUTHORIZED BY THIS REPORT
```

B10 in the tracker is a **migration checkpoint**, not this seam’s implementation. Do not start B10 from B9.

---

# 23. Implementation authorization

```text
B9 IMPLEMENTATION = NOT STARTED
CODE MODIFIED = NO
```

This report does **not** authorize editing:

```text
Sirman_Final.html
Laegh_Final.html
desktop/Sirman.Core/**
desktop/Sirman.Desktop/**
print / persist / backup
test_laegh.js
```

Do not implement `calc.warrantyEndDate` until a separate implementation prompt authorizes it.

---

# 24. Final status

```text
B9 = ANALYSIS COMPLETED
B9 IMPLEMENTATION = NOT STARTED

Candidate count: 7 scored remaining calc/rule wrappers
Top candidate: calc.warrantyEndDate
Readiness: PARITY LOCK REQUIRED
Parity: PARITY PARTIAL
Fail-closed: SAFE
HTML-only: HTML-ONLY SAFE
Persistence impact: NO
Print impact: NO
Backup impact: NO
Locked-core impact: NO

CODE MODIFIED = NO
```

```text
STOP
```

No B10. No implementation. No architecture redesign.
