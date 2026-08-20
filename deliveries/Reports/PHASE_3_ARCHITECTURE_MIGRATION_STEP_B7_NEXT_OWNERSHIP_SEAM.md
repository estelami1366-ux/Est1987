# SIRMAN — PHASE 3 ARCHITECTURE MIGRATION
## STEP B7 — NEXT OWNERSHIP SEAM

**Mode:** ANALYSIS / READ-ONLY  
**Date:** 1405/05/29 19:15:37 (Asia/Tehran)  
**Gregorian:** 20 August 2026  
**Branch:** `cursor/phase-3-architecture-migration-3733`  
**HEAD at analysis:** `0aec497` (`docs: record tracker commit hash on Phase 3 tracker`)  
**Known tracker HEAD:** `f3b4202` — this HEAD is a descendant  
**B6 commit:** `66e78be` (`feat: migrate sale.line ownership to core`)  
**Live version:** `1405.5.27γ` (unchanged)

```text
CODE MODIFIED = NO
B7 IMPLEMENTATION = NOT STARTED
Product code modified = NO
Persistence changed = NO
Print changed = NO
Backup changed = NO
Locked workflows changed = NO
```

---

# 1. Change Gate

Read before scoring:

| Document | Status |
|---|---|
| `docs/PHASE_3_CHANGE_GATE.md` | READ |
| `docs/DEVELOPMENT_GOVERNANCE.md` | READ |
| `docs/ARCHITECTURE_RULES.md` | READ |
| `docs/PRINT_MODULE_BASELINE.md` | READ |
| `.agents/skills/laegh-software-workflow/SKILL.md` | READ |
| A1–A6, B1–B6 reports | READ |
| `deliveries/Reports/PHASE_3_MIGRATION_TRACKER.md` | READ |

```text
PHASE 3 CHANGE GATE — B7 ANALYSIS ONLY

Requested change:
None. Identify the next ownership seam after B6. Do not implement it.

Classification:
Analysis / selection gate (same class as B4)

Capability:
not yet authorized

Files expected to change this step:
deliveries/Reports/PHASE_3_ARCHITECTURE_MIGRATION_STEP_B7_NEXT_OWNERSHIP_SEAM.md
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
B7 is read-only. Source inventory and scoring do not authorize B8.
```

---

# 2. Branch / HEAD / Worktree

Commands run:

```text
git branch --show-current
git rev-parse --short HEAD
git status --short
```

| Check | Result |
|---|---|
| Branch | `cursor/phase-3-architecture-migration-3733` |
| HEAD short | `0aec497` |
| HEAD full | `0aec497e0f4ba2a6e022c12478064589406e3cfc` |
| Descendant of `f3b4202` | YES |
| Worktree at gate | clean |
| STOP — BLOCKED | NO |

No stash, reset, clean, rebase, merge, or cherry-pick. No HTML/Core/Host/print/persist edits.

---

# 3. Governance Read

Standing rules applied:

- Reports live as Markdown under `deliveries/Reports/`.
- Print module remains FROZEN (`docs/PRINT_MODULE_BASELINE.md`).
- EXE ownership uses fail-closed: Host present + Core null → no JS fallback.
- HTML-only JS fallbacks must stay.
- Locked: invoice/inventory/accounting/warranty **mutation**, auth, REST, SQL, second Host, backup schema, persist format.
- `service.*` remains FORBIDDEN until a live HTML `takeBusinessCore('service.*')` exists (B4 finding, re-verified).
- Tracker is checklist authority. B7 analysis is not product COMPLETED.

---

# 4. B1–B6 History

| Step | Seam | Status | Meaning for B7 |
|---|---|---|---|
| B1 | invoice parity lock | COMPLETED | Frozen invoice line/totals vectors |
| B2 | `invoice.line` | COMPLETED | Fail-closed ownership pattern established |
| B3 | `invoice.totals` | COMPLETED | Totals followed line in the same family |
| B4 | next-seam analysis | COMPLETED | Ranked `calc.sla` first; `sale.line` then `sale.total` as pricing follow-on |
| B5 | `calc.sla` | COMPLETED | Fail-closed display calc |
| B6 | `sale.line` | COMPLETED | `calcSaleLine` → `InvoicePricing.SaleLine`; HTML 596 / Core 142; **`sale.total` explicitly NOT migrated** |

Already fail-closed on EXE:

```text
invoice.line
invoice.totals
calc.sla
sale.line
```

B6 leftover (tracker + B6 report): `sale.total` / `calcSaleTotal` still dual-path. That leftover is evidence, not a preselected winner. B7 re-scored remaining live seams from source.

B6 live EXE: still `NEEDS HUMAN VERIFICATION`. That does not block analysis.

---

# 5. Candidate Inventory

Grep of `Sirman_Final.html` `takeBusinessCore(` plus Facade `Dispatch` and Core tests.

`Laegh_Final.html` matches `Sirman_Final.html` at the live sale/calc call sites inspected (`calcSaleTotal` ~21643, `calcSaleLine` ~21674).

## 5.1 Already migrated (out of B7)

| Capability | JS | Core | Status |
|---|---|---|---|
| `invoice.line` | `calcInvoiceLine` | `InvoicePricing.Line` | OWNED |
| `invoice.totals` | `calcInvoiceTotals` | `InvoicePricing.Totals` | OWNED |
| `calc.sla` | `calcSlaStatusFromAgeHours` | `CalculationEngine.SlaStatusFromAgeHours` | OWNED |
| `sale.line` | `calcSaleLine` | `InvoicePricing.SaleLine` | OWNED (B6) |

## 5.2 Remaining live or wrapper calc seams

### `sale.total`

| Field | Evidence |
|---|---|
| Capability | `sale.total` |
| JS function / call site | `calcSaleTotal` `Sirman_Final.html` ~21643; sale form `oninput` ~21483–21485; `getSaleData` grandTotal ~21688 |
| Core class / method | `InvoicePricing.SaleTotal` — sum of `SaleLine.Total` (`InvoicePricing.cs` ~39–44) |
| BusinessFacade operation | `"sale.total" => SaleTotalFrom(o)` ~55; `SaleTotalFrom` maps `items[]` through `SaleLine` then `SaleTotal` ~141–154 |
| Host route | `hasBusinessCore` → `takeBusinessCore('sale.total', {items:[{qty,price,disc}]})` → `sirmanHost.RunBusiness` |
| HTML-only fallback | `reduce` + `Math.round(price*disc/100)` + `Math.round((qty\|\|1)*(price-discAmt))` — **inlined**, does not call `calcSaleLine` |
| Existing tests | HTML: string asserts `calcSaleTotal` contains `sale.total` (`test_laegh.js` ~9448, ~9497). Core: `SaleLine_MatchesCalcSaleTotal` one row `2×1000 disc10 → 1800`. No frozen **totals** vector table |
| Parity status | PARITY PARTIAL (formula = sum of B6-locked `sale.line`; totals table absent) |
| Persistence impact | NO — label/count DOM only; save/consume is later `inventory.consume` |
| Protected-area impact | NO print engine, NO backup, NO locked mutation |
| Risk | LOW–MEDIUM (sales form + `getSaleData` number; EXE fail currently returns `0` not `null`) |
| Recommendation | **TOP CANDIDATE** |

### `calc.warrantyEndDate`

| Field | Evidence |
|---|---|
| JS | `calcWarrantyEndDate` ~26631; live warranty form `calcWarrExpFromBuy` ~19648 |
| Core | `CalculationEngine.WarrantyEndDate` |
| Facade / Host | `calc.warrantyEndDate` |
| Fallback | `addJalaliMonths` if Core null — **including Host present + Core miss** (pre-B2 defect) |
| Tests | `WarrantyEndDate_Plus24Months` |
| Persist | DOM until later `warranty.save` |
| Risk | MEDIUM — Jalali / Step 3 caution (B4) |
| Recommendation | RUNNER-UP, not next |

### `rules.suggestParts`

| Field | Evidence |
|---|---|
| JS | `suggestPartsForCase` ~26678; live ~19531 |
| Core | `PartsAdvisor.Suggest` |
| Host | `rules.suggestParts` |
| Fallback | JS ranking; calls `invStockSnapshot` (inventory **read** family) |
| Fail-closed | NO — if Core is not an array, JS still runs on EXE |
| Tests | `SuggestParts_OnlyFromCatalog`, `SuggestParts_UsesAvailableNotRawQty` |
| Recommendation | NOT NEXT (inventory coupling + not fail-closed) |

### Unused `calc.*` wrappers

`calc.balance`, `calc.finalAmount`, `calc.availableStock`, `calc.reorderPoint` — SmartCore wrappers ~26636–26665 and API object ~26731. Production form callers besides the wrapper/API: **none** (grep). Core tests exist (`Balance`, `FinalAmount`, `AvailableStock`, `ReorderPoint`).

Section 4 rule: do not treat an unused Core method as a valid migration seam. **NOT NEXT.**

### `warranty.canTransition`

`canWarrantyTransition` ~26707. Core `WarrantyWorkflow.CanTransition`. Live wrapper, but adjacent to `warranty.applyTransition` (LOCKED mutation). Pre-B2 fallback. **NOT READY.**

## 5.3 Rejected (protected / unused / mutation)

| Candidate | Why REJECT |
|---|---|
| `invoice.close` / `invoice.delete` / `sale.delete` | locked mutation |
| `inventory.*` mutations + `inventory.stock` | inventory family / locked |
| `payment.apply*` / edit / delete / reverse | accounting mutation |
| `warranty.save` / `close` / `delete` / `applyTransition` | warranty mutation |
| `service.save` / `close` / `addPart` | Facade exists; **zero** HTML `takeBusinessCore('service.*')` — FORBIDDEN |
| `invoice.validate` / `calc.addJalaliMonths` / `payment.remaining` | Facade only; no live HTML seam |
| Print engine / `IPrintService` / `printSaleDoc` rewrite | FROZEN print |
| Backup / `migrateBackup` / persist schema | FROZEN/locked |

Candidate count scored below: **8** remaining calc/rule wrappers. Mutation/print/backup are listed as rejects, not scored as next-seam winners.

---

# 6. Candidate Scoring

B7 weights (max +25 before penalties). Scores are from source, not from B4’s leftover note.

| Criterion | Weight |
|---|---:|
| Existing Core implementation | +3 |
| Existing BusinessFacade operation | +3 |
| Existing Host route | +2 |
| Existing JS/Core parity tests | +2 |
| Simple pure calculation / deterministic rule | +2 |
| HTML-only fallback easy to preserve | +2 |
| No persistence writes | +2 |
| No locked mutation | +3 |
| No print dependency | +2 |
| No backup dependency | +2 |
| Low coupling | +2 |
| Requires new architecture / persist / locked mutation / print / second bridge / HTML framework | −5 each |

### `sale.total` — **25**

| Criterion | Pts | Evidence |
|---|---:|---|
| Core | +3 | `InvoicePricing.SaleTotal` |
| Facade | +3 | `sale.total` / `SaleTotalFrom` |
| Host | +2 | live `takeBusinessCore('sale.total')` |
| Tests | +2 | Core one-row `SaleTotal`; HTML Host-path string tests. **Not** a frozen totals table (see §12) |
| Pure calc | +2 | sum of B6-locked line totals |
| HTML-only fallback | +2 | existing `reduce`+`Math.round`; keep it |
| No persist | +2 | no `localStorage` / `svSales` in `calcSaleTotal` |
| No locked mutation | +3 | not sale save / stock consume |
| No print | +2 | does not call print engine; `printSaleDoc` already uses `calcSaleLine` (B6) |
| No backup | +2 | no backup keys |
| Low coupling | +2 | same sale form; inputs already sent as `{qty,price,disc}` |
| Penalties | 0 | no new Host, REST, SQL, schema, print rewrite |

### `calc.warrantyEndDate` — **23**

Same +3/+3/+2 Core/Facade/Host; +2 Core date test; +2 deterministic Jalali add; +2 `addJalaliMonths` fallback; +2/+3/+2/+2 persist/mutation/print/backup. **No +2 low coupling** (warranty form + Jalali calendar / Step 3). Fail-closed still missing on EXE.

### `rules.suggestParts` — **19**

+3/+3/+2 Core/Facade/Host; +2 Core suggest tests; **no +2 pure calc** (heuristic + catalog); +2 JS fallback; +2 no persist; +3 no mutation (read-only); +2/+2 print/backup. **No +2 low coupling** (`invStockSnapshot`). Fail-closed would change EXE suggestion behavior.

### Unused `calc.balance` / `finalAmount` / `availableStock` / `reorderPoint` — **23 each (disqualified)**

Weight table is high (Core+Facade+wrapper Host+tests+pure calc). Disqualified by §4: **no live shop caller**. Cannot be the next ownership seam.

### `warranty.canTransition` — **15**

Core/Facade/Host/tests/fallback/no persist, then **−5** adjacent locked `warranty.applyTransition`. Not low coupling.

No score was raised to force `sale.total`. It wins because it is the only remaining **live** pure pricing calc with Core+Facade+Host, no Jalali, no inventory snapshot, and it is the totals half of the family B6 just locked (same sequence as B2 line → B3 totals).

---

# 7. Top Candidate

```text
TOP CANDIDATE = sale.total
JS owner        = calcSaleTotal
Core owner      = InvoicePricing.SaleTotal
Facade          = sale.total → SaleTotalFrom
Host            = sirmanHost.RunBusiness("sale.total", json)
HTML-only       = existing reduce + Math.round (must remain)
```

Why this seam, from source:

1. Live UI: sale item `oninput` and `getSaleData().` grand total.
2. Core already implements the total as **sum of `SaleLine`**, and B6 already owns `SaleLine`.
3. Host route already exists; no new Host method.
4. HTML-only fallback already exists.
5. No persist, backup, print engine, or locked mutation.
6. Remaining EXE gap vs B6: HTML-only still **inlines** line math instead of calling `calcSaleLine`; there is no frozen **totals** vector table; EXE Core miss sets `localTotal = 0` (formula fail-closed, numeric sentinel `0`).

Not selected despite live UI:

- `calc.warrantyEndDate` — Jalali + still falls through to JS on EXE Core miss.
- `rules.suggestParts` — inventory snapshot in fallback; not fail-closed.

---

# 8. JS Ownership

`calcSaleTotal` (`Sirman_Final.html` / `Laegh_Final.html` ~21643):

1. Syncs DOM qty/price/disc into `saleItems` (`parseFloat` / `qty\|\|1`).
2. If `hasBusinessCore()`: `takeBusinessCore('sale.total', {items: mapped qty/price/disc})`.
3. If Core null/undefined: `ntf('محاسبه فروش انجام نشد')` and `localTotal = 0`. **Does not run the JS reduce on EXE.**
4. If no Host: `reduce` with the same `Math.round` line formula B6 locked in `calcSaleLine`.
5. Writes `#sale-total-lbl` and `#sale-item-count`; returns `localTotal`.

Callers: sale form inputs, `renderSaleItems` / open-form paths, `getSaleData` (`grandTotal`).

`getSaleData` item `total`/`discAmt` already go through `calcSaleLine`. Grand total is a **second** path (`sale.total`). On HTML-only those two paths can drift if one formula is edited later. B8 should make the fallback call `calcSaleLine` rather than keep a third copy.

---

# 9. Core Ownership

`InvoicePricing.SaleLine` (B6): `qty` non-finite or `0` → `1`; `JsRound(price * disc / 100)`; `JsRound(qty * (price - discAmt))`.

`InvoicePricing.SaleTotal`: foreach line, `sum += l.Total`.

`BusinessFacade.SaleTotalFrom`: each `items[]` row → `SaleLine(qty==0?1:qty, price, disc)` then `SaleTotal`. Empty/missing `items` → `0`.

No Core algorithm change is required for a later ownership gate. Do not invent a new totals formula.

---

# 10. Host Route

```text
HTML calcSaleTotal
  → hasBusinessCore / takeBusinessCore("sale.total", {items:[...]})
    → runBusinessCore
      → getSirmanHostSync().RunBusiness(name, json)
        → DesktopSecurity.Business.Run
          → BusinessFacade.Dispatch("sale.total")
            → SaleTotalFrom → InvoicePricing.SaleTotal
```

`SirmanHostObject.RunBusiness` signature unchanged. No second Host. No REST. No SQL.

---

# 11. HTML-only Fallback

```text
HTML-ONLY SAFE
```

Host absent → current `reduce`+`Math.round` must stay. Do not delete JS. Do not require WebView2.

Future B8 (not this step): prefer `sum of calcSaleLine(...).total` in that fallback so line and total cannot diverge. That is a fallback cleanup, not a third formula.

---

# 12. Parity Analysis

| Axis | JS HTML-only | Core / Facade | Match? |
|---|---|---|---|
| Inputs | `saleItems` qty/price/disc after DOM parse | `items[]` qty/price/disc | YES |
| Output | number (sum of line totals) | `double` sum | YES |
| qty default | `item.qty\|\|1` in reduce; map uses `it.qty\|\|1` | `qty == 0 ? 1` plus `SaleLine` non-finite → 1 | YES for 0 / missing |
| price/disc default | `\|\|0` | non-finite → 0 | YES |
| Rounding | `Math.round` per line, then add | `JsRound` per line, then add | YES (B6 vectors) |
| Empty items | `reduce` → 0 | empty list → 0 | YES |
| Dates | none | none | YES |
| Side effects | DOM label/count (JS either path) | none in Core | ownership is the **number** only |
| EXE Core miss | `localTotal = 0` + toast | n/a | formula not JS; sentinel `0` ≠ B6 `null` object |
| HTML-only vs `calcSaleLine` | inlined copy of line math | `SaleTotal(SaleLine…)` | formula same; **call graph not DRY** |

Classification:

```text
PARITY PARTIAL
```

Not `PARITY MISMATCH` (no contradictory formula found).  
Not `PARITY UNKNOWN` (line math is B6-locked; total is the sum).  
Not `PARITY CONFIRMED` (no frozen multi-row `sale.total` vector table in HTML+Core).

`PARITY MISMATCH` would block authorization. Partial does not.

B8 must add a totals vector table **before** changing ownership comments / HTML-only DRY. Derive rows from `SaleLineParityVectors.json` (sum of one or more B6 `total` fields), plus at least one multi-item row (e.g. two B6 lines).

---

# 13. Fail-Closed Analysis

Can follow B2/B3/B5/B6 without new architecture:

| Host | Core | Required behavior |
|---|---|---|
| absent | n/a | JS fallback |
| present | number | use Core |
| present | null/failure | **no JS reduce** |

Current EXE path **already skips JS reduce** on Core null. Difference vs `calcSaleLine`: it substitutes `0` so `#sale-total-lbl`.toLocaleString and `getSaleData` still get a number.

B8 should **keep the `0` sentinel** unless a later gate proves `null` is safe for `toLocaleString` / persist of `grandTotal`. Changing `0` → `null` is a contract change, not required for ownership.

Fail-closed for the **formula**: already possible. Fail-closed tests: missing (B8).

```text
FAIL-CLOSED = SAFE TO APPLY (keep numeric 0 on EXE Core miss)
```

---

# 14. Persistence Impact

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

`calcSaleTotal` does not write `localStorage`, IndexedDB, `svSales`, or backup. Sale save / `inventory.consume` stay out of scope.

---

# 15. Protected Area Impact

Recommended candidate answers **NO** for every protected category in §14.

`printSaleDoc` already uses `calcSaleLine` (B6). B8 must not touch `WindowsPrintHost`, `IPrintService`, `PrintServiceAdapter`, PrintAsync, or Print Center.

Version scheme `1405.5.27γ` stays unless a later product gate says otherwise.

---

# 16. Test Readiness

Do **not** write these tests in B7.

### Existing

| Layer | What exists |
|---|---|
| HTML | `calcSaleTotal` must contain `sale.total`; B6 test that B6 did **not** migrate `calcSaleTotal`; Phase 2 “no dual-overwrite” string test |
| Core | `SaleLine_MatchesCalcSaleTotal` (single 1800); B6 `SaleLineParityTests` / `SaleLineParityVectors.json` (line only) |
| Frozen totals table | **ABSENT** |

### Missing (minimum for a future B8)

1. Shared JSON totals vectors (HTML + Core), including empty list → 0, one B6 line, multi-item sum, qty 0 → 1.
2. HTML-only: Host absent, fallback matches vectors; fallback source still has `Math.round` (or `calcSaleLine` after DRY).
3. EXE Host-wins: distinctive Core number (not the JS sum).
4. EXE fail-closed: Core null → no JS sum (assert `0` if sentinel kept; assert not `1800` for the 2×1000 disc10 case).
5. No persist: `calcSaleTotal` still has no `localStorage` / `svSales`.
6. Regression: `sale.line` B6 tests still pass; print engine tests untouched.

Estimate: one vector file (or a `total` array beside B6 JSON), a few HTML tests, a few Core facts. Same shape as B6, smaller because line math is already locked.

---

# 17. Risk Analysis

| ID | Level | Note |
|---|---|---|
| R1 | LOW | Agent may skip vectors and edit `calcSaleTotal` first — B8 must test-first |
| R2 | LOW | HTML-only inlined line math vs `calcSaleLine` — DRY in B8 fallback only |
| R3 | LOW | EXE `0` sentinel vs B6 `null` — keep `0` unless proven |
| R4 | MEDIUM | B6 live EXE still unverified; B8 EXE will also be `NEEDS HUMAN VERIFICATION` |
| R5 | HIGH | Do not fold `inventory.consume` / sale save into a totals calc gate |
| R6 | HIGH | Do not open `service.*`, warranty mutation, or print engine |
| R7 | MEDIUM | `calc.warrantyEndDate` still has the pre-B2 EXE/JS defect; it is next-after-totals, not this seam |

Rollback for B7: delete this report (and tracker analysis lines) only. No product commit exists for B7.

---

# 18. Recommendation

### Option A

```text
NEXT SEAM = sale.total
READINESS = READY FOR FUTURE IMPLEMENTATION
```

Parity is PARTIAL (table missing) but **not** UNKNOWN/MISMATCH. Formula is the sum of B6-locked `sale.line`. Fallback exists. Protected areas are NO. Change Gate would be able to PASS a later B8 that:

1. Adds totals parity vectors first.
2. Keeps HTML-only JS (optionally via `calcSaleLine`).
3. Keeps EXE Core-or-`0`, never JS reduce when Host is present.
4. Does not change Core `SaleTotal` math, Host signature, persist, backup, print, or sale save.

Option B (dedicated parity-lock-only step) is unnecessary: B1 existed because invoice math was unlocked; here line math is already frozen.

Option C is false: a safe seam exists.

```text
B8 IMPLEMENTATION = NOT STARTED
B8 = NOT AUTHORIZED BY THIS REPORT
```

---

# 19. Implementation Authorization

```text
B7 IMPLEMENTATION = NOT STARTED
CODE MODIFIED = NO
```

This report does **not** authorize editing:

```text
Sirman_Final.html
Laegh_Final.html
desktop/Sirman.Core/**
desktop/Sirman.Desktop/**
print / persist / backup
test_laegh.js (product tests)
```

Do not start B8 until a separate B8 prompt authorizes `sale.total`.

---

# 20. Final Status

```text
B7 = ANALYSIS COMPLETED
B7 IMPLEMENTATION = NOT STARTED

Candidate count: 8 scored remaining calc/rule wrappers
Top candidate: sale.total
Readiness: READY FOR FUTURE IMPLEMENTATION
Parity: PARITY PARTIAL
Fail-closed: SAFE (keep 0 sentinel)
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

No B8. No implementation. No scope expansion.
