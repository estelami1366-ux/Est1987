# SIRMAN — PHASE 3 ARCHITECTURE MIGRATION
## STEP B8 — `sale.total` OWNERSHIP MIGRATION

**Date:** 1405/05/29 19:26:00 (Asia/Tehran)  
**Gregorian:** 20 August 2026  
**Live version:** `1405.5.27γ` (unchanged)

---

# 1. Date / time and timezone

```text
1405/05/29 19:26:00 Asia/Tehran
```

---

# 2. Branch

```text
cursor/phase-3-architecture-migration-3733
```

---

# 3. HEAD before

```text
44dc56f  docs: record B7 next ownership seam analysis
44dc56fc68241e9af79b8c0cc787e9db7dd26905
```

Worktree at gate: clean. Descendant of B7 `44dc56f` / tracker `f3b4202`.

---

# 4. HEAD after

Recorded after the B8 implementation commit (see §20). Product commit message:

```text
feat: migrate sale.total ownership to core
```

---

# 5. Worktree state

Gate (before edits): **clean**  
After B8 files: HTML `calcSaleTotal` + tests + vectors + report/tracker only.

No stash / reset / rebase / merge / cherry-pick.

---

# 6. Change Gate result

```text
PHASE 3 CHANGE GATE

Requested change:
Move EXE numeric ownership of sale.total so JS reduce is not a second EXE implementation.
HTML-only fallback reuses calcSaleLine (B6-locked line math).

Classification:
C (existing dual-path calculation / ownership)

Capability:
sale.total

Files expected to change:
Sirman_Final.html
Laegh_Final.html
test_laegh.js
desktop/Sirman.Core.Tests/SaleTotalParityTests.cs
desktop/Sirman.Core.Tests/SaleTotalParityVectors.json
desktop/Sirman.Core.Tests/Sirman.Core.Tests.csproj
deliveries/Reports/PHASE_3_ARCHITECTURE_MIGRATION_STEP_B8_SALE_TOTAL.md
deliveries/Reports/PHASE_3_MIGRATION_TRACKER.md

UI Owner:
Sirman_Final.html calcSaleTotal (numeric total only)

Business Owner:
InvoicePricing.SaleTotal via existing RunBusiness("sale.total")

Persistence Owner:
HTML — not this op

Host:
sirmanHost.RunBusiness — signature UNCHANGED

Source-of-truth class:
DUAL (EXE = Core, HTML-only = JS via calcSaleLine)

RunBusiness touched:
NO (call site already existed)

Persistence touched:
NO

Backup schema touched:
NO

Print touched:
NO

Security touched:
NO

LOCKED area touched:
NO (not sale save / inventory.consume)

FROZEN area touched:
NO

HTML-only preserved:
YES

New architecture introduced:
NO

Core formula changed:
NO

Version changed:
NO

Gate:
PASS

Reason:
B7 selected sale.total as READY. Test-first vectors lock sum-of-SaleLine. Smallest HTML ownership/DRY change. Fail-closed 0 sentinel kept.
```

---

# 7. Files changed

| File | Why |
|---|---|
| `Sirman_Final.html` | `calcSaleTotal` ownership comment + HTML-only `sum(calcSaleLine.total)` |
| `Laegh_Final.html` | same `calcSaleTotal` (byte-identical function) |
| `test_laegh.js` | B8 Host-wins / HTML-only vectors / fail-closed / no-persist |
| `desktop/Sirman.Core.Tests/SaleTotalParityVectors.json` | frozen totals table |
| `desktop/Sirman.Core.Tests/SaleTotalParityTests.cs` | Core + Facade vector tests |
| `desktop/Sirman.Core.Tests/Sirman.Core.Tests.csproj` | copy vectors to output |
| `deliveries/Reports/PHASE_3_ARCHITECTURE_MIGRATION_STEP_B8_SALE_TOTAL.md` | this report |
| `deliveries/Reports/PHASE_3_MIGRATION_TRACKER.md` | B8 result |

Not changed: `InvoicePricing.cs`, `BusinessFacade.cs`, Host, print, persist, backup, version.

---

# 8. Why `sale.total` was selected

B7 source inventory (not a redesign): only remaining **live** pure pricing calc with Core + Facade + Host, no persist, no locked mutation, no print engine. Natural totals half of B6 `sale.line` (same sequence as B2 → B3).

---

# 9. Existing Core implementation

Unchanged:

```text
InvoicePricing.SaleLine  → B6-locked Math.round / JsRound line total
InvoicePricing.SaleTotal → sum of SaleLine.Total
BusinessFacade.SaleTotalFrom → items[] through SaleLine (qty 0 → 1) then SaleTotal
```

Empty `items` → `0`. No new totals formula.

---

# 10. Existing Host route

Unchanged:

```text
calcSaleTotal
  → hasBusinessCore / takeBusinessCore("sale.total", {items:[{qty,price,disc}]})
    → runBusinessCore
      → sirmanHost.RunBusiness
        → BusinessFacade.Dispatch("sale.total")
```

---

# 11. HTML-only fallback behavior

Host absent:

```text
sum(calcSaleLine(qty||1, price||0, disc||0).total)
```

`calcSaleLine` still owns the JS line formula (`Math.round`). Behavioral compatibility: B8 vectors match the previous inlined reduce (same B6 numbers). DRY applied because it did **not** change those totals.

Host present + Core null: `localTotal = 0` + toast. JS reduce / `calcSaleLine` **not** used. Sentinel `0` kept (not changed to `null`).

---

# 12. Parity vectors

File: `desktop/Sirman.Core.Tests/SaleTotalParityVectors.json`

| id | items | expected |
|---|---|---:|
| empty | `[]` | 0 |
| one-b6-normal | `2×1000 disc10` | 1800 |
| one-b6-no-disc | `1×1000 disc0` | 1000 |
| qty0-becomes-1 | `0×500` → qty 1 | 500 |
| round-half-b6 | `1×15 disc10` | 13 |
| disc-100 | `1×1000 disc100` | 0 |
| multi-two-b6-lines | 1800 + 1000 | 2800 |
| multi-three-with-qty0 | 500 + 13 + 901 | 1414 |

Totals are sums of B6 `SaleLine.Total` values. Formula not invented.

---

# 13. Tests added

HTML (`test_laegh.js` group فاز ۳ B8):

- Host route `sale.total` + `{items:[...]}` shape; distinctive Core `777777` (JS would be 1800)
- HTML-only vectors; fallback uses `calcSaleLine`; no parallel `Math.round(item.price * item.disc / 100)`
- Fail-closed: Core `ok:false` → `0`, not 1800; only `sale.total` called
- No `localStorage` / IndexedDB / `svSales` / `persistCoreSnapshot` / `migrateBackup` / `inventory.consume`

Core:

- `SaleTotal_MatchesFrozenVectors`
- `SaleTotal_IsSumOfSaleLineTotals`
- `SaleTotal_EmptyList_IsZero`
- `Facade_SaleTotal_UsesItemsShapeAndVectors`

B6 `sale.line` tests remain in the suite.

Test-first: HTML 600 / Core 146 passed **before** the `calcSaleTotal` DRY edit (vectors matched the old inline reduce). After DRY: same floors.

---

# 14. Test commands and exact results

```text
node test_laegh.js Sirman_Final.html
  کل تست‌ها: 600
  موفق: 600
  ناموفق: 0

node test_laegh.js Laegh_Final.html
  کل تست‌ها: 600
  موفق: 600
  ناموفق: 0

dotnet test desktop/Sirman.Core.Tests
  Passed: 146  Failed: 0  Skipped: 0
```

B6 floor was HTML 596 / Core 142. B8 added 4 HTML tests and 4 Core facts.

```text
HTML = PASS
Core = PASS
B6 regression = PASS
```

---

# 15. Fail-closed result

| Host | Core | Result |
|---|---|---|
| absent | n/a | JS via `calcSaleLine` sum |
| present | number | Core number |
| present | null/failure | `0`; no JS reduce |

```text
FAIL-CLOSED = COMPLETED (automated)
Keep numeric 0 sentinel = YES
```

---

# 16. Protected-area audit

`git diff --name-only` (product + tests):

```text
Laegh_Final.html
Sirman_Final.html
desktop/Sirman.Core.Tests/Sirman.Core.Tests.csproj
desktop/Sirman.Core.Tests/SaleTotalParityTests.cs
desktop/Sirman.Core.Tests/SaleTotalParityVectors.json
test_laegh.js
```

`git diff --check`: no whitespace errors.

| Question | Answer |
|---|---|
| Print changed? | NO |
| Persistence changed? | NO |
| Backup changed? | NO |
| Sale save/close/delete changed? | NO |
| Inventory mutation changed? | NO |
| Accounting changed? | NO |
| Warranty mutation changed? | NO |
| Host contract changed? | NO |
| REST introduced? | NO |
| SQL introduced? | NO |
| Second Host introduced? | NO |

HTML diffs are confined to `calcSaleTotal`.

---

# 17. HTML synchronization result

`calcSaleTotal` in `Sirman_Final.html` and `Laegh_Final.html`: **identical** (1553 characters). Unrelated HTML sync was not performed.

---

# 18. Version result

```text
1405.5.27γ UNCHANGED
SIRMAN_VERSION.json UNTOUCHED
```

B8 is a migration step, not a product release.

---

# 19. Human verification status

```text
Live EXE / WebView2 = NEEDS HUMAN VERIFICATION
Physical print = not in scope (FROZEN; B8 is not a print change)
```

Automated HTML + Core tests are not a shop EXE verification.

---

# 20. Final status

```text
B8 = COMPLETED
HTML TESTS = PASS (600 / 0)
CORE TESTS = PASS (146 / 0)
B6 REGRESSION = PASS
FAIL-CLOSED = COMPLETED (0 sentinel)
HTML-ONLY = PASS
PROTECTED AREAS = UNCHANGED
VERSION = 1405.5.27γ UNCHANGED
LIVE EXE = NEEDS HUMAN VERIFICATION
B9 = NOT STARTED
```

```text
STOP
```

Do not start B9. Do not migrate `calc.warrantyEndDate` / `rules.suggestParts` / service / print / persist in this step.
