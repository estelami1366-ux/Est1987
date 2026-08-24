# SIRMAN — PHASE 3 ARCHITECTURE MIGRATION
## STEP B10 — PARITY LOCK `calc.warrantyEndDate`

**Mode:** TEST / PARITY LOCK ONLY  
**Date:** 1405/05/30  
**Time:** 10:40:28  
**Timezone:** Asia/Tehran  
**Gregorian:** 21 August 2026  
**Branch:** `cursor/phase-3-architecture-migration-3733`  
**HEAD at gate:** `cf9099f` (`docs: record B9 next ownership seam analysis`)  
**Live version:** `1405.5.27γ` (unchanged)

```text
CODE MODIFIED = YES (tests and vector file only)
PRODUCT CODE MODIFIED = NO
B10 IMPLEMENTATION = NOT STARTED
Architecture change = NO
Ownership migrated = NO
```

---

# 1. Date

```text
1405/05/30
```

---

# 2. Exact time

```text
10:40:28
```

---

# 3. Timezone

```text
Asia/Tehran
```

---

# 4. Branch

```text
cursor/phase-3-architecture-migration-3733
```

---

# 5. HEAD

Gate (before B10 files):

```text
cf9099f
```

After the B10 test/docs commit:

```text
da78c6a  test: lock calc.warrantyEndDate JS/C# parity vectors
```

---

# 6. Worktree status

Before edits: **clean**.  
After B10: tests + vectors + report + tracker only.

```text
git status --short
git branch --show-current
git rev-parse --short HEAD
```

No branch switch, reset, stash, rebase, merge, or cherry-pick. No product HTML/Core/Host edits.

---

# 7. Governance documents read

| Document | Status |
|---|---|
| `docs/PHASE_3_CHANGE_GATE.md` | READ |
| `docs/DEVELOPMENT_GOVERNANCE.md` | READ |
| `docs/ARCHITECTURE_RULES.md` | READ |
| `docs/PRINT_MODULE_BASELINE.md` | READ |
| `.agents/skills/laegh-software-workflow/SKILL.md` | READ |
| B9 next-seam report | READ |
| Phase 3 tracker | READ |
| B1–B8 precedent (shared JSON vectors) | consulted |

Source code is the authority. `addJalaliMonths` / `calcWarrantyEndDate` / `CalculationEngine.AddJalaliMonths` / `WarrantyEndDate` were **not** edited.

---

# 8. B9 decision

```text
NEXT SEAM = calc.warrantyEndDate
READINESS = PARITY LOCK REQUIRED
PARITY = PARTIAL
```

B10 is the parity lock. Ownership migration is **FORBIDDEN** in this step.

---

# 9. Shared vector table

File: `desktop/Sirman.Core.Tests/WarrantyEndDateParityVectors.json`

Frozen slash-separated Jalali cases (extracted from live JS and C#, not guessed):

| id | Date | Months | Expected |
|---|---|---:|---|
| empty | `""` | 12 | `""` |
| zero-months | `1405/05/05` | 0 | `1405/05/05` |
| normal-24 | `1405/05/05` | 24 | `1407/05/05` |
| esfand-clamp | `1405/11/30` | 1 | `1405/12/29` |
| day-31 | `1405/01/31` | 1 | `1405/02/31` |
| year-wrap | `1405/11/15` | 2 | `1406/01/15` |
| short-2part | `1405/05` | 12 | `1405/05` |
| garbage | `x` | 12 | `x` |

Excluded from the lock (same class as B1 excluding negatives): dash-separated dates and 3-part non-numeric dates. Live JS and C# **diverge** there. B10 does not correct the calendar. See §12 and §17.

---

# 10. JavaScript results

Probed `addJalaliMonths` and HTML-only `calcWarrantyEndDate` (`takeBusinessCore` absent → fallback). Both functions returned the same string for every frozen row.

| Vector | JS `addJalaliMonths` | JS `calcWarrantyEndDate` |
|---|---|---|
| empty | `""` | `""` |
| zero-months | `1405/05/05` | `1405/05/05` |
| normal-24 | `1407/05/05` | `1407/05/05` |
| esfand-clamp | `1405/12/29` | `1405/12/29` |
| day-31 | `1405/02/31` | `1405/02/31` |
| year-wrap | `1406/01/15` | `1406/01/15` |
| short-2part | `1405/05` | `1405/05` |
| garbage | `x` | `x` |

---

# 11. C# results

Probed `CalculationEngine.AddJalaliMonths` and `WarrantyEndDate`.

| Vector | C# `AddJalaliMonths` | C# `WarrantyEndDate` |
|---|---|---|
| empty | `""` | `""` |
| zero-months | `1405/05/05` | `1405/05/05` |
| normal-24 | `1407/05/05` | `1407/05/05` |
| esfand-clamp | `1405/12/29` | `1405/12/29` |
| day-31 | `1405/02/31` | `1405/02/31` |
| year-wrap | `1406/01/15` | `1406/01/15` |
| short-2part | `1405/05` | `1405/05` |
| garbage | `x` | `x` |

---

# 12. Parity result

Locked vectors:

| Vector | JS | C# | Expected | Result |
|---|---|---|---|---|
| empty | `""` | `""` | `""` | MATCH |
| zero-months | `1405/05/05` | `1405/05/05` | `1405/05/05` | MATCH |
| normal-24 | `1407/05/05` | `1407/05/05` | `1407/05/05` | MATCH |
| esfand-clamp | `1405/12/29` | `1405/12/29` | `1405/12/29` | MATCH |
| day-31 | `1405/02/31` | `1405/02/31` | `1405/02/31` | MATCH |
| year-wrap | `1406/01/15` | `1406/01/15` | `1406/01/15` | MATCH |
| short-2part | `1405/05` | `1405/05` | `1405/05` | MATCH |
| garbage | `x` | `x` | `x` | MATCH |

```text
PARITY = CONFIRMED
```

for the frozen slash-date table.

Observed **not frozen** (extracted; not corrected):

| Input | Months | JS | C# | Result |
|---|---:|---|---|---|
| `1405-05-05` | 24 | `1407/05/05` | `1405-05-05` | MISMATCH (C# `Split('/', '-', options)` binds count=`'-'`=45, splits only `/`) |
| `1405/05/xx` | 12 | `1406/05/NaN` | `1405/05/xx` | MISMATCH |
| `1405/aa/01` | 12 | `1405/NaN/01` | `1405/aa/01` | MISMATCH |

Warranty form date picker uses slash `YYYY/MM/DD`. Those mismatching shapes are excluded from the lock, not “fixed.”

---

# 13. Tests executed

```text
node test_laegh.js Sirman_Final.html
  کل تست‌ها: 602
  موفق: 602
  ناموفق: 0

dotnet test desktop/Sirman.Core.Tests
  Passed: 149  Failed: 0  Skipped: 0
```

B8 floor was HTML 600 / Core 146. B10 added 2 HTML tests and 3 Core facts.

HTML group `فاز ۳ B10 قفل برابری calc.warrantyEndDate`:

- HTML-only frozen vectors for `addJalaliMonths` and `calcWarrantyEndDate`
- no persist / `warranty.save`
- asserts B10 did **not** add `hasBusinessCore` or drop `addJalaliMonths`

Core:

- `WarrantyEndDate_MatchesFrozenVectors`
- `AddJalaliMonths_MatchesSameVectors`
- `Facade_WarrantyEndDate_UsesPurchaseDateAndPeriodMonths`

---

# 14. Regression result

Inspected groups in the HTML run: هسته هوشمند, B5 `calc.sla`, B6 `sale.line`, B8 `sale.total`, B10 warranty date, warranty save/close tests in Phase 2.

```text
HTML = PASS (602 / 0)
Core = PASS (149 / 0)
B5 / B6 / B8 regression = PASS
```

---

# 15. Protected-area audit

```text
Print / WebView2 print engine     UNCHANGED
Persistence                       UNCHANGED
Backup                            UNCHANGED
Invoice locked workflows          UNCHANGED
Inventory mutations               UNCHANGED
Accounting                        UNCHANGED
Warranty mutations                UNCHANGED
Authentication / authorization    UNCHANGED
Host contract                     UNCHANGED
SQL / REST                        UNCHANGED
Product version                   1405.5.27γ UNCHANGED
hasBusinessCore gate              NOT ADDED
JS fallback                       NOT DELETED
Calendar arithmetic               NOT CORRECTED
```

`git diff --name-only` (product vs tests): no `Sirman_Final.html`, `Laegh_Final.html`, `InvoicePricing.cs`, `CalculationEngine.cs`, Host, or print files.

---

# 16. Files changed

| File | Why |
|---|---|
| `desktop/Sirman.Core.Tests/WarrantyEndDateParityVectors.json` | shared frozen vectors |
| `desktop/Sirman.Core.Tests/WarrantyEndDateParityTests.cs` | Core + Facade data-driven lock |
| `desktop/Sirman.Core.Tests/Sirman.Core.Tests.csproj` | copy JSON to test output |
| `test_laegh.js` | HTML-only vector + no-persist tests |
| `deliveries/Reports/PHASE_3_ARCHITECTURE_MIGRATION_STEP_B10_PARITY_LOCK.md` | this report |
| `deliveries/Reports/PHASE_3_MIGRATION_TRACKER.md` | B10 analysis/test result |

---

# 17. Risks / blockers

| ID | Level | Note |
|---|---|---|
| R1 | LOW | Dash dates mismatch if a caller stores `YYYY-MM-DD`. Form picker uses `/`. Do not “fix” Split in B11 unless a dedicated calendar gate |
| R2 | LOW | Non-numeric 3-part dates produce JS `NaN` vs C# original string — not a live picker value |
| R3 | MEDIUM | B11 must not change month arithmetic while adding fail-closed `hasBusinessCore` |
| R4 | MEDIUM | Live EXE still `NEEDS HUMAN VERIFICATION` from B2–B8 |

No blocker for a later **ownership** gate of slash-format `calc.warrantyEndDate`.

---

# 18. Final status

```text
B10 = COMPLETED
PARITY = CONFIRMED (frozen slash-date table)
HTML TESTS = PASS (602 / 0)
CORE TESTS = PASS (149 / 0)
PROTECTED AREAS = UNCHANGED
CODE MODIFIED = YES (tests/vectors/report only)
PRODUCT CODE MODIFIED = NO
B10 IMPLEMENTATION = NOT STARTED
B11 = NOT STARTED
LIVE EXE = NEEDS HUMAN VERIFICATION (unchanged; B10 is not an EXE migration)
```

```text
STOP — wait for B11 implementation instruction.
```
