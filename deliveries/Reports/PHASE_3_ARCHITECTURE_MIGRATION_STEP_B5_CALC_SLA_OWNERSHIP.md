# SIRMAN — PHASE 3 ARCHITECTURE MIGRATION
## STEP B5 — `calc.sla` OWNERSHIP MIGRATION

**Date:** 1405/05/29 (20 August 2026)  
**Branch:** `cursor/phase-3-architecture-migration-3733`  
**B4 HEAD (rollback target):** `87e30df7168c4c480b92c97c56478203e3c6dd9b` (`docs: Phase 3 B4 next ownership seam is calc.sla`)  
**Live version:** `1405.5.27γ` (unchanged)

```text
PHASE 3 CHANGE GATE

Requested change:
Move EXE ownership of calc.sla so JS SLA bands are not a second EXE implementation.

Classification:
C

Capability:
calc.sla

Persistence touched: NO
Print touched: NO
Backup touched: NO
Host signature: UNCHANGED
Locked workflow: NO
HTML-only preserved: YES
Gate: PASS
```

```text
Architecture migration = YES
Ownership migrated = calc.sla
SLA thresholds changed = NO
Persistence changed = NO
Print changed = NO
Backup changed = NO
Locked business workflows changed = NO
HTML-only preserved = YES
```

---

# 1. PRE-CHECK

| Check | Result |
|---|---|
| Change Gate / governance / architecture / print baseline / workflow skill | READ |
| A1–A6, B1, B2, B3, B4 reports | READ |
| B4 | COMPLETED — recommended seam `calc.sla`, score **39/40** |
| B4 HEAD | `87e30df7168c4c480b92c97c56478203e3c6dd9b` |
| Source inspect | `calcSlaStatusFromAgeHours` ~26652; Facade `"calc.sla"` → `CalculationEngine.SlaStatusFromAgeHours`; Host `RunBusiness` unchanged |
| Call sites | dashboard ~10446, Customer 360 ~10851, `checkWarrantySlaAlerts` ~20443 (display / alert; no invoice/inventory/print) |
| Version | `1405.5.27γ` |
| Branch | `cursor/phase-3-architecture-migration-3733` |

Preconditions verified. Not BLOCKED.

---

# 2. BEFORE ARCHITECTURE

```text
calcSlaStatusFromAgeHours
  parseInt(ageH,10)||0
  takeBusinessCore("calc.sla", {ageHours})
  if Core result: return it
  ALWAYS then: JS bands   ← EXE Core failure silently ran JS (dual ownership)
```

HTML-only and EXE-with-failed-Core both executed:

```text
ageH<24 → normal
ageH<48 → warning
ageH<72 → critical
else    → overdue
```

Core path already existed. Defect: same as pre-B2/B3 — Host present + Core miss still ran JS.

---

# 3. TARGET ARCHITECTURE

```text
EXE / Host present:
  UI → calcSlaStatusFromAgeHours
    → RunBusiness("calc.sla")
    → BusinessFacade
    → CalculationEngine.SlaStatusFromAgeHours
    → C# result  OR  null (fail-closed)
    NEVER JS bands

HTML-only / Host absent:
  UI → calcSlaStatusFromAgeHours
    → existing JS bands (unchanged)
```

No third implementation. `CalculationEngine` / `BusinessFacade` / Host not rewritten (no Core defect).

---

# 4. CURRENT SLA SEMANTICS

Preserved exactly (JS `parseInt` and C# `ToInt` both truncate toward zero):

| ageH | status |
|---|---|
| 10 | normal |
| 23 | normal |
| 23.99 | normal |
| 24 | warning |
| 47 | warning |
| 47.99 | warning |
| 48 | critical |
| 71 | critical |
| 71.99 | critical |
| 72 | overdue |
| 73 | overdue |

Status strings unchanged: `normal` / `warning` / `critical` / `overdue`.

Dashboard urgent filter still `sla==='critical' \|\| sla==='overdue'` (null does not match). Customer 360 still `st && st!=='normal'`.

---

# 5. FILES CHANGED

| File | Change |
|---|---|
| `Sirman_Final.html` | `calcSlaStatusFromAgeHours` Host-wins / fail-closed; `checkWarrantySlaAlerts` skips null |
| `Laegh_Final.html` | byte-sync with `Sirman_Final.html` |
| `test_laegh.js` | B5 EXE / HTML-only / fail-closed / no-persist tests; existing SLA isolation stubs `hasBusinessCore(){return false}` |
| `desktop/Sirman.Core.Tests/BusinessCoreTests.cs` | adjacent boundaries 23/47/71/73 and `23.99` on existing `[Fact]` |
| Report | this file |

Not changed: `CalculationEngine.cs`, `BusinessFacade.cs`, Host, print, backup, `SIRMAN_VERSION.json`, packaging copies.

---

# 6. OWNERSHIP CHANGE

| Mode | Owner | Evidence |
|---|---|---|
| EXE | C# `CalculationEngine.SlaStatusFromAgeHours` via `RunBusiness("calc.sla")` | `calcSlaStatusFromAgeHours` ~26652–26660; `hasBusinessCore()` then Core or `return null` |
| HTML-only | JS bands in the same function | ~26661 |

Call-site safety: `checkWarrantySlaAlerts` now `if(!slaKey \|\| slaKey==='normal') return` so EXE Core failure does not notify or `svWars()`. Dashboard / 360 already null-safe. Function remains calculation/display only.

---

# 7. FAIL-CLOSED RESULT

Host present + Core `{ok:false}` → `calcSlaStatusFromAgeHours(10)` returns **`null`**. JS `normal` does not run.

Red-test (mutated fail-open: Core miss → JS bands): same Host + `ok:false` + ageH=10 returned **`"normal"`**. B5 assertion `got == null` would FAIL on that mutation and PASSes on current source.

---

# 8. HOST-WINS RESULT

Mock `RunBusiness` returns `{ok:true, result:'core-distinctive-status'}` for ageH=10 (JS would be `normal`). Caller receives **`core-distinctive-status`**. One call, name `calc.sla`, payload `ageHours: 10`. Production status strings not changed for the test.

---

# 9. HTML-ONLY RESULT

`getSirmanHostSync(){ return null }`. Vectors:

```text
10 → normal
23.99 → normal   (parseInt truncates)
24 → warning
47.99 → warning
48 → critical
71.99 → critical
72 → overdue
73 → overdue
```

Fallback source still contains `ageH<24)?'normal'`. Not deleted.

---

# 10. CORE TESTS

Existing `Sla_Thresholds_MatchHtml` extended in-place (still one `[Fact]`, Core count **139**):

```text
SlaStatusFromAgeHours(10)  → normal
SlaStatusFromAgeHours(23)  → normal
SlaStatusFromAgeHours(24)  → warning
SlaStatusFromAgeHours(47)  → warning
SlaStatusFromAgeHours(48)  → critical
SlaStatusFromAgeHours(71)  → critical
SlaStatusFromAgeHours(72)  → overdue
SlaStatusFromAgeHours(73)  → overdue
SlaStatusFromAgeHours(23.99) → normal
```

`CalculationEngine` not rewritten.

---

# 11. REGRESSION

Required categories:

| # | Category | Evidence |
|---|---|---|
| 1 | Core boundary values | `Sla_Thresholds_MatchHtml` |
| 2 | EXE / Host-wins | mock distinctive status |
| 3 | EXE / Core-failure fail-closed | `got == null` + red-test |
| 4 | HTML-only fallback | Host null + 8 vectors |
| 5 | Existing SLA callers | dashboard/360 null-safe; alerts skip `!slaKey`; daily-ops brief still uses `calcSlaStatusFromAgeHours` |
| 6 | No persistence side effects | no `localStorage` / `indexedDB` / `svWars` in `calcSlaStatusFromAgeHours` |
| 7 | Full HTML regression | 592 PASS / 0 FAIL |
| 8 | Full Core regression | 139 PASS / 0 FAIL |

```text
HTML: 592 PASS / 0 FAIL   (floor 588)
Core: 139 PASS / 0 FAIL   (floor 139)
REGRESSION: PASS
HTML-ONLY: PASS
PRINT: UNTOUCHED
PERSISTENCE: UNCHANGED
LOCKED BUSINESS: UNCHANGED
```

---

# 12. PERSISTENCE SAFETY

```text
ZERO new persistence writes
ZERO new persistence reads
```

`calcSlaStatusFromAgeHours` does not call `localStorage`, IndexedDB, backup, restore, or `laegh_*` keys.

`checkWarrantySlaAlerts` still may `svWars()` only when a non-null, non-`normal` SLA label is produced (pre-existing alert persist). Null Core failure no longer takes that path.

---

# 13. RISKS

| ID | Level | Note |
|---|---|---|
| R1 | MEDIUM | Live WebView2 Host not run in this Linux environment |
| R2 | LOW | `checkWarrantySlaAlerts` HTML-only ternary (`ageH>=72` …) remains only when `calcSlaStatusFromAgeHours` is missing; live HTML still has the function |
| R3 | LOW | Do not treat B5 as warranty save/close or `sale.line` migration |

B2/B3 live EXE verification remains outstanding.

---

# 14. HUMAN VERIFICATION

```text
NEEDS HUMAN VERIFICATION
```

Requires `Sirman.exe` + WebView2 + real Windows. Linux HTML/Core tests do not prove the live EXE `RunBusiness("calc.sla")` path.

Previously outstanding B2/B3 human verification remains outstanding. No printer test required.

---

# 15. ROLLBACK

B4 commit (from git): **`87e30df7168c4c480b92c97c56478203e3c6dd9b`**

```text
git revert <B5-commit>
```

or reset this branch to `87e30df`. No compensating patches.

---

# 16. FINAL STATUS

```text
B5 IMPLEMENTATION = COMPLETED
LIVE EXE PATH = NEEDS HUMAN VERIFICATION

Architecture migration = YES
Ownership migrated = calc.sla
SLA thresholds changed = NO
Persistence changed = NO
Print changed = NO
Backup changed = NO
Locked business workflows changed = NO
HTML-only preserved = YES

NEXT GATE = sale.line (B4 runner-up) — NOT STARTED
```

STOP. Do not start `sale.line` / `sale.total` / inventory / accounting / warranty mutation / persist / backup / print in this step.
