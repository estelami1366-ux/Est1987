# SIRMAN — PHASE 3 ARCHITECTURE MIGRATION
## STEP B11 — OWNERSHIP MIGRATION: `calc.warrantyEndDate`

**MODE:** IMPLEMENTATION  
**SCOPE:** ONLY `calc.warrantyEndDate`  
**Date:** 1405/05/30  
**Time:** 10:58:48  
**Timezone:** Asia/Tehran  
**Gregorian:** 21 August 2026  
**Branch:** `cursor/phase-3-architecture-migration-3733`  
**HEAD before:** `29cfd14` (`docs: record B10 warranty-date parity commit hash`)  
**Product commit:** `405bcb1` (`feat: migrate calc.warrantyEndDate ownership to core`)  
**Live version:** `1405.5.27γ` (unchanged)

```text
PRODUCT CODE MODIFIED = YES
B11 IMPLEMENTATION = COMPLETED
PARITY = CONFIRMED
HTML-ONLY FALLBACK = PRESERVED
FAIL-CLOSED = CONFIRMED
LIVE EXE = NEEDS HUMAN VERIFICATION
```

```text
PHASE 3 CHANGE GATE

Requested change:
Move EXE ownership of calc.warrantyEndDate so addJalaliMonths is not a second EXE implementation.
HTML-only fallback remains the existing addJalaliMonths. Calendar arithmetic is not rewritten.

Classification:
C (existing dual-path calculation / ownership)

Capability:
calc.warrantyEndDate

Persistence touched: NO
Print touched: NO
Backup touched: NO
Host signature: UNCHANGED
Locked workflow: NO (warranty.save / close / delete untouched)
HTML-only preserved: YES
Calendar arithmetic changed: NO
Gate: PASS
```

---

# 1. Date

```text
1405/05/30
```

---

# 2. Exact time

```text
10:58:48
```

Regression completed at this Tehran clock time. Product commit `405bcb1` preceded the run.

---

# 3. Timezone

```text
Asia/Tehran
```

Gregorian: 21 August 2026.

---

# 4. Branch

```text
cursor/phase-3-architecture-migration-3733
```

Did not switch branches. Preferred PR base remains `cursor/phase-3-change-gate-3733`.

---

# 5. HEAD before

```text
29cfd14  docs: record B10 warranty-date parity commit hash
29cfd14801f1d385f8ef2fec3d1c19681b5525c5
```

Worktree at gate: B10 complete. Product HTML still used Host-optional `takeBusinessCore` then always `addJalaliMonths`.

---

# 6. HEAD after

```text
405bcb1  feat: migrate calc.warrantyEndDate ownership to core
405bcb1ea2ac8869e19c1a505ffe46eca7c4c3aa
```

B11 rollback target (HEAD before): `29cfd14`.

---

# 7. Worktree before/after

Gate (before edits): **clean** on `29cfd14`.

After product commit `405bcb1`:

```text
Sirman_Final.html
Laegh_Final.html
test_laegh.js
```

No stash / reset / rebase / merge / cherry-pick.

---

# 8. Governance documents read

```text
docs/PHASE_3_CHANGE_GATE.md
docs/DEVELOPMENT_GOVERNANCE.md
docs/ARCHITECTURE_RULES.md
docs/PRINT_MODULE_BASELINE.md
.agents/skills/laegh-software-workflow/SKILL.md
deliveries/Reports/PHASE_3_ARCHITECTURE_MIGRATION_STEP_B10_PARITY_LOCK.md
deliveries/Reports/PHASE_3_MIGRATION_TRACKER.md
```

Source inspected:

```text
calcWarrantyEndDate          Sirman_Final.html
calcWarrExpFromBuy           Sirman_Final.html (only live DOM caller)
addJalaliMonths              Sirman_Final.html (HTML-only arithmetic; UNCHANGED)
hasBusinessCore / takeBusinessCore / runBusinessCore
BusinessFacade               "calc.warrantyEndDate" already dispatched
CalculationEngine.WarrantyEndDate / AddJalaliMonths  UNCHANGED
WarrantyEndDateParityTests   B10 facade + engine vectors  UNCHANGED
```

SOURCE CODE IS THE AUTHORITY.

---

# 9. B10 precondition

```text
PARITY = CONFIRMED
HTML = 602 PASS / 0 FAIL
CORE = 149 PASS / 0 FAIL
```

Frozen slash-date vectors (unchanged in B11):

| id | date | months | expected |
|---|---|---:|---|
| empty | `""` | 12 | `""` |
| zero-months | `1405/05/05` | 0 | `1405/05/05` |
| normal-24 | `1405/05/05` | 24 | `1407/05/05` |
| esfand-clamp | `1405/11/30` | 1 | `1405/12/29` |
| day-31 | `1405/01/31` | 1 | `1405/02/31` |
| year-wrap | `1405/11/15` | 2 | `1406/01/15` |
| short-2part | `1405/05` | 12 | `1405/05` |
| garbage | `x` | 12 | `x` |

Live date-picker contract remains `YYYY/MM/DD`. Dash-separated / invalid-date residuals from B10 were **not** corrected.

---

# 10. Files changed

| File | Why |
|---|---|
| `Sirman_Final.html` | `calcWarrantyEndDate` EXE fail-closed ownership; `calcWarrExpFromBuy` skips null so `#wdN_wexp` is not overwritten with `"null"` |
| `Laegh_Final.html` | same two functions (byte-identical) |
| `test_laegh.js` | B11 Host-wins / HTML-only B10 vectors / fail-closed / DOM skip-null / DRY / no-persist / save-close-delete freeze |
| `deliveries/Reports/PHASE_3_ARCHITECTURE_MIGRATION_STEP_B11_WARRANTY_ENDDATE_OWNERSHIP.md` | this report |
| `deliveries/Reports/PHASE_3_MIGRATION_TRACKER.md` | B11 result |

Not changed: `CalculationEngine.cs`, `BusinessFacade.cs`, Host, print, persist, backup, `SIRMAN_VERSION.json`, warranty save/close/delete, `AddJalaliMonths` arithmetic.

```text
PRODUCT CODE MODIFIED = YES
```

---

# 11. Exact ownership path before

```text
UI (calcWarrExpFromBuy / date fields)
  → calcWarrantyEndDate(purchaseDate, periodMonths)
    → takeBusinessCore("calc.warrantyEndDate", {purchaseDate, periodMonths})
      → if Core result: return it
      → ALWAYS then: addJalaliMonths   ← EXE Core miss silently ran JS (dual ownership)
```

`BusinessFacade` and `CalculationEngine.WarrantyEndDate` already existed. Defect: same as pre-B2/B3/B5 — Host present + Core miss still ran JS.

---

# 12. Exact ownership path after

EXE + Host:

```text
calcWarrantyEndDate
  → hasBusinessCore()
  → takeBusinessCore("calc.warrantyEndDate", {purchaseDate, periodMonths})
    → runBusinessCore
      → sirmanHost.RunBusiness
        → BusinessFacade.Dispatch("calc.warrantyEndDate")
          → CalculationEngine.WarrantyEndDate
            → C# result  OR  null (fail-closed)
  NEVER addJalaliMonths while Host is present
```

HTML-only / Host absent:

```text
calcWarrantyEndDate
  → existing addJalaliMonths(purchaseDate, periodMonths)
```

Live DOM caller:

```text
calcWarrExpFromBuy
  → calcWarrantyEndDate
  → write #wdN_wexp only when result is non-null
```

No third calendar. No new Host / REST / SQL.

---

# 13. JavaScript fallback status

```text
HTML-ONLY FALLBACK = PRESERVED
```

`addJalaliMonths` body is unchanged (`m += months`, Esfand clamp `(m<=6)?31:(m<=11?30:29)`).

`calcWarrantyEndDate` still contains the `addJalaliMonths` call; it runs only when `hasBusinessCore()` is false.

Sirman / Laegh functions `calcWarrantyEndDate`, `calcWarrExpFromBuy`, `addJalaliMonths` are byte-identical.

---

# 14. Fail-closed behavior

| Host | Core | `calcWarrantyEndDate` | `#wdN_wexp` via `calcWarrExpFromBuy` |
|---|---|---|---|
| absent | n/a | JS `addJalaliMonths` | writes JS date |
| present | string | Core string | writes Core date |
| present | null / `ok:false` | `null` (no JS months) | keeps previous field value |

```text
FAIL-CLOSED = CONFIRMED
```

Host present + Core miss does **not** execute `addJalaliMonths`. Distinctive Host-wins vector `9999/09/09` proves Core result is used instead of `1407/05/05`.

---

# 15. Core implementation

Unchanged:

```text
CalculationEngine.WarrantyEndDate(purchaseDate, periodMonths)
  → AddJalaliMonths(purchaseDate, ToInt(periodMonths))

BusinessFacade
  "calc.warrantyEndDate"
    → WarrantyEndDate(JsonVal.Str(purchaseDate), JsonVal.Str(periodMonths))
```

No new DTO. No calendar rewrite. B10 `WarrantyEndDateParityTests` still lock engine + facade against the same JSON table.

---

# 16. Host/Facade path

Unchanged Host contract:

```text
sirmanHost.RunBusiness(name, json) → {ok, result} | {ok:false}
```

Operation name already on the facade: `calc.warrantyEndDate`.

Payload (existing function parameters, not invented):

```text
{ purchaseDate, periodMonths }
```

`RunBusiness` C# signature was not touched. Same Host as B2–B8.

---

# 17. Test vectors

File: `desktop/Sirman.Core.Tests/WarrantyEndDateParityVectors.json` (B10 freeze; B11 did not edit it).

HTML B11 group (`test_laegh.js`):

- Host route `calc.warrantyEndDate` + `{purchaseDate, periodMonths}`; distinctive Core `9999/09/09` (JS would be `1407/05/05`)
- HTML-only B10 table after ownership change; fallback still `addJalaliMonths`
- Fail-closed: Core `ok:false` → `null`, not `1407/05/05`
- `calcWarrExpFromBuy` keeps previous `KEEP` on Core fail (does not write the string `"null"`)
- DRY: `calcWarrExpFromBuy` does not call `takeBusinessCore`
- No `localStorage` / IndexedDB / `svWars` / `persistCoreSnapshot` / `warranty.save`
- `saveWar` / `closeWar` / `warranty.delete` strings unchanged

Core (B10 tests, still green):

- `WarrantyEndDate_MatchesFrozenVectors`
- `AddJalaliMonths_MatchesSameVectors`
- `Facade_WarrantyEndDate_UsesPurchaseDateAndPeriodMonths`

---

# 18. HTML test result

```text
node test_laegh.js Sirman_Final.html
  کل تست‌ها: 609
  موفق: 609
  ناموفق: 0

node test_laegh.js Laegh_Final.html
  کل تست‌ها: 609
  موفق: 609
  ناموفق: 0
```

B10 floor was HTML 602. B11 added 7 focused HTML tests (609).

```text
HTML = PASS
```

---

# 19. Core test result

```text
dotnet test desktop/Sirman.Core.Tests
  Passed: 149  Failed: 0  Skipped: 0
```

Same Core floor as B10 (no C# formula/test file change).

```text
Core = PASS
PARITY = CONFIRMED
```

---

# 20. Regression groups

| Group | Result |
|---|---|
| فاز ۳ B5 مالکیت `calc.sla` | 4 PASS / 0 FAIL |
| فاز ۳ B6 مالکیت `sale.line` | 4 PASS / 0 FAIL |
| فاز ۳ B8 مالکیت `sale.total` | 4 PASS / 0 FAIL |
| فاز ۳ B10 قفل برابری `calc.warrantyEndDate` | 2 PASS / 0 FAIL |
| فاز ۳ B11 مالکیت `calc.warrantyEndDate` | 7 new PASS / 0 FAIL |
| هسته هوشمند — محاسبه / گردش‌کار / پیشنهاد | 7 PASS / 0 FAIL |
| برگشت آثار حذف فاکتور و گارانتی | 24 PASS / 0 FAIL |
| `saveWar` / `closeWar` / `warranty.delete` strings | PASS (B11 freeze test) |

```text
Regression = PASS
```

---

# 21. Protected-area audit

`git diff --name-only 29cfd14 405bcb1` (product + tests):

```text
Laegh_Final.html
Sirman_Final.html
test_laegh.js
```

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
| SQL / REST | NONE |
| Second Host | NONE |
| Second PrintService | NONE |
| HTML-only fallback | PRESERVED |
| Calendar arithmetic (`AddJalaliMonths` / `addJalaliMonths`) | UNCHANGED |
| Product version | UNCHANGED (`1405.5.27γ`) |

```text
Protected areas = UNCHANGED
```

---

# 22. Git diff summary

`calcWarrantyEndDate`: wrap Core call in `hasBusinessCore()`; `return null` on Core miss.

`calcWarrExpFromBuy`: assign `#wdN_wexp` only when `exp != null`. This is a display-safety adapter for fail-closed `null`, not a warranty mutation and not a second calendar.

`addJalaliMonths`: no diff.

Core / Host / print / persist / version: no diff.

---

# 23. Risks/blockers

None for this seam.

Residual B10 calendar mismatches (dash dates, non-numeric day/month) remain **out of lock** and were not “fixed.” Live picker is slash `YYYY/MM/DD`.

B12 is **not** authorized.

Automated tests do not replace a live WebView2 shop check of the warranty date field.

---

# 24. Human verification requirement

```text
LIVE EXE = NEEDS HUMAN VERIFICATION
```

No Windows shop / WebView2 run was performed in this environment. Do not claim physical print verification. Automated calculation + ownership tests cover the migration; live EXE is a separate checkbox.

Suggested later shop check (not done here): open a warranty device card in `Sirman.exe`, set purchase date `1405/05/05` and 24 months, confirm expiry `1407/05/05` from Core; HTML-only browser should still fill the same date from JS.

---

# 25. Final status

```text
B11 OWNERSHIP MIGRATION REPORT

Branch:
cursor/phase-3-architecture-migration-3733

HEAD before:
29cfd14

HEAD after:
405bcb1

Worktree:
clean after product commit (report/tracker follow)

Operation:
calc.warrantyEndDate

Ownership:
BEFORE:
  takeBusinessCore then always addJalaliMonths
AFTER:
  EXE: Core via RunBusiness("calc.warrantyEndDate"); miss → null
  HTML-only: existing addJalaliMonths

Parity:
CONFIRMED

HTML-only fallback:
PRESERVED

Fail-closed:
CONFIRMED

HTML tests:
PASS (609 / 0)

Core tests:
PASS (149 / 0)

Regression:
PASS

Protected areas:
UNCHANGED

Product code modified:
YES

Implementation:
COMPLETED

Report:
deliveries/Reports/PHASE_3_ARCHITECTURE_MIGRATION_STEP_B11_WARRANTY_ENDDATE_OWNERSHIP.md

Final status:
COMPLETED
LIVE EXE = NEEDS HUMAN VERIFICATION
```

```text
PRODUCT CODE MODIFIED = YES
B11 IMPLEMENTATION = COMPLETED
PARITY = CONFIRMED
HTML-ONLY FALLBACK = PRESERVED
FAIL-CLOSED = CONFIRMED
```

**NEXT GATE:** not started. Wait for explicit B12 instruction.

```text
STOP — B11 complete. Wait for B12 instruction.
```
