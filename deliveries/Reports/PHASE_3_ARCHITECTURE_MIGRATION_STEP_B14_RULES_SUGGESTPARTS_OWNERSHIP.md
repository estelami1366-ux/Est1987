# SIRMAN — PHASE 3 ARCHITECTURE MIGRATION
## STEP B14 — OWNERSHIP MIGRATION: `rules.suggestParts`

**MODE:** IMPLEMENTATION  
**SCOPE:** ONLY `rules.suggestParts` EXE ownership  
**Date:** 1405/05/30  
**Time:** 11:34:57  
**Timezone:** Asia/Tehran  
**Gregorian:** 21 August 2026  
**Branch:** `cursor/phase-3-architecture-migration-3733`  
**HEAD before:** `2370088` (`docs: record B13 parity-lock report commit hash on tracker`)  
**B13 test commit:** `8446619` (ancestor; instruction expected this product lock)  
**Product commit:** `dae7cde` (`feat: migrate rules.suggestParts ownership to core`)  
**Live version:** `1405.5.27γ` (unchanged)

```text
PRODUCT CODE MODIFIED = YES
B14 IMPLEMENTATION = COMPLETED
PARITY = CONFIRMED
HTML-ONLY FALLBACK = PRESERVED
FAIL-CLOSED = CONFIRMED
INVENTORY MUTATION = NONE
PRINT CHANGED = NO
LIVE EXE = NEEDS HUMAN VERIFICATION
```

```text
PHASE 3 CHANGE GATE

Requested change:
Move EXE ownership of rules.suggestParts so JS ranking is not a second EXE implementation.
HTML-only fallback remains the existing catalog ranking. Ranking algorithm is not rewritten.

Classification:
C (existing dual-path calculation / ownership)

Capability:
rules.suggestParts

Persistence touched: NO
Print touched: NO
Backup touched: NO
Host signature: UNCHANGED
Locked workflow: NO (warranty.save / close / delete untouched)
Inventory mutation: NO
HTML-only preserved: YES
PartsAdvisor algorithm changed: NO
Gate: PASS
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
11:34:57
```

Regression completed at this Tehran clock time. Product commit `dae7cde` preceded the run.

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

Did not switch branches. Preferred PR base remains `cursor/phase-3-change-gate-3733`.

---

# 6. HEAD before

```text
2370088  docs: record B13 parity-lock report commit hash on tracker
2370088ae65c20fe4535212ee7b974bab885aa4e
descendant of 8446619 = YES
```

Worktree at gate: **clean**. B13 parity CONFIRMED (HTML 611 / Core 151).

---

# 7. HEAD after

```text
dae7cde  feat: migrate rules.suggestParts ownership to core
dae7cde
```

B14 rollback target (HEAD before): `2370088`.

---

# 8. Worktree before/after

Gate: clean on `2370088`.

After product commit `dae7cde`:

```text
Sirman_Final.html
Laegh_Final.html
test_laegh.js
```

No stash / reset / rebase / merge / cherry-pick. Core/Host/print/persist/version untouched.

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
| B12 change-gate report | READ |
| B13 parity-lock report | READ |
| Phase 3 tracker | READ |

Source inspected: `suggestPartsForCase`, `applySuggestedWarParts`, `PartsAdvisor.Suggest`, Facade `"rules.suggestParts"`. Core files **not** edited.

---

# 10. B13 precondition

```text
PARITY = CONFIRMED
HTML = 611 PASS / 0 FAIL
CORE = 151 PASS / 0 FAIL
Vectors = 13 frozen catalog cases
Ownership = NOT migrated
```

Established from tracker + B13 report + commit `8446619`. Current HEAD `2370088` is docs-only on top of that lock.

---

# 11. Exact production change

`suggestPartsForCase`: EXE branch now `return null` when Host is present and Core is missing or not an array. Ranking `catalog.forEach` runs only when Host is absent.

`applySuggestedWarParts`: `if(!hits || !hits.length)` so EXE Core miss does not throw on `hits.length` and does not push JS catalog rows. Display-safety adapter only; not `warranty.save`.

Ranking match / order / why-text / `invStockSnapshot` body: **unchanged**.

Sirman / Laegh functions byte-identical.

---

# 12. Ownership BEFORE

```text
applySuggestedWarParts
  → suggestPartsForCase
    → if hasBusinessCore():
         takeBusinessCore("rules.suggestParts", {parts, prodCode, model, problem})
         if Array.isArray(core): return core
    → ALWAYS then: JS catalog.forEach ranking   ← EXE Core miss ran JS
```

---

# 13. Ownership AFTER

EXE + Host:

```text
suggestPartsForCase
  → hasBusinessCore()
  → takeBusinessCore("rules.suggestParts", {parts, prodCode, model, problem})
    → runBusinessCore → sirmanHost.RunBusiness
      → BusinessFacade → PartsAdvisor.Suggest
        → C# array  OR  null (fail-closed)
  NEVER catalog.forEach while Host is present
```

HTML-only / Host absent:

```text
existing JS ranking + invStockSnapshot
```

---

# 14. EXE behavior matrix

| Core result | Behavior |
|---|---|
| valid array | return Core array (Host-wins distinctive `CORE-ONLY`) |
| null / `ok:false` | return `null` |
| non-array object | return `null` |
| exception → takeBusinessCore null | return `null` |

```text
JS ranking after Core failure = NOT EXECUTED
```

---

# 15. HTML-only behavior

Host absent: B13 frozen vectors still pass (length, order, code, qty, explain). `catalog.forEach`, `invStockSnapshot`, and why-strings remain in the function body.

```text
B13 vectors = PASS
HTML-ONLY FALLBACK = PRESERVED
```

---

# 16. Fail-closed proof

HTML test: Core `ok:false` → `null`, not `P-HEAT`. Core `{code:'P-HEAT'}` (non-array) → `null`.

```text
FAIL-CLOSED = CONFIRMED
```

---

# 17. JS-ranking-not-executed proof

HTML test: Host returns `[{code:'CORE-ONLY',...}]` for catalog that would rank `P-HEAT`. Result is `CORE-ONLY`, not `P-HEAT`. Single `RunBusiness("rules.suggestParts")` call with `prodCode`.

Live caller: `applySuggestedWarParts` on Core fail keeps `_waParts.length === 0` (does not insert `P-HEAT`).

---

# 18. Parity vectors result

B13 table `SuggestPartsParityVectors.json` **not edited**. HTML-only B14 test replays all 13 cases. Core `SuggestPartsParityTests` still 2 facts / green.

```text
PARITY = CONFIRMED
```

---

# 19. HTML tests

```text
node test_laegh.js Sirman_Final.html
  کل تست‌ها: 616
  موفق: 616
  ناموفق: 0

node test_laegh.js Laegh_Final.html
  کل تست‌ها: 616
  موفق: 616
  ناموفق: 0
```

B13 floor was 611. B14 added 5 focused HTML tests.

```text
HTML = PASS
```

---

# 20. Core tests

```text
dotnet test desktop/Sirman.Core.Tests
  Passed: 151  Failed: 0  Skipped: 0
```

Same Core floor as B13 (no C# formula change).

```text
Core = PASS
```

---

# 21. Regression tests

| Group | Result |
|---|---|
| هسته هوشمند / پیشنهاد قطعه | PASS |
| فاز ۳ B5 `calc.sla` | PASS |
| فاز ۳ B6 `sale.line` | PASS |
| فاز ۳ B8 `sale.total` | PASS |
| فاز ۳ B10 warranty date | PASS |
| فاز ۳ B11 `calc.warrantyEndDate` | PASS |
| فاز ۳ B13 `rules.suggestParts` parity | PASS |
| فاز ۳ B14 ownership | 5 new PASS |

```text
Regression = PASS
```

---

# 22. Protected-area audit

| Area | Status |
|---|---|
| Print / WebView2 PrintAsync | UNCHANGED |
| Persistence | UNCHANGED |
| Backup | UNCHANGED |
| Invoice locked workflows | UNCHANGED |
| Inventory mutations | UNCHANGED |
| Accounting | UNCHANGED |
| Warranty save/close/delete | UNCHANGED |
| Authentication / authorization | UNCHANGED |
| Host contract | SAME HOST |
| SQL / REST / second Host | NONE |
| PartsAdvisor algorithm | UNCHANGED |
| Inventory stock semantics | UNCHANGED |
| HTML-only fallback | PRESERVED |
| Product version | UNCHANGED (`1405.5.27γ`) |

---

# 23. Inventory mutation audit

`suggestPartsForCase` / `applySuggestedWarParts` contain no `inventory.reserve` / `consume` / `release`, no `warranty.save`, no `localStorage` / IndexedDB.

`invStockSnapshot` / `_sumByWh` / `InventoryCore.Stock` **not edited**.

```text
Inventory mutation = NONE
```

---

# 24. Changed files

| File | Why |
|---|---|
| `Sirman_Final.html` | fail-closed selector + null-safe `applySuggestedWarParts` |
| `Laegh_Final.html` | same two functions (byte-identical) |
| `test_laegh.js` | B14 Host-wins / HTML-only B13 vectors / fail-closed / caller skip-null / no-persist |
| `deliveries/Reports/PHASE_3_ARCHITECTURE_MIGRATION_STEP_B14_RULES_SUGGESTPARTS_OWNERSHIP.md` | this report |
| `deliveries/Reports/PHASE_3_MIGRATION_TRACKER.md` | B14 result |

Not changed: `PartsAdvisor.cs`, `InventoryCore.cs`, `BusinessFacade.cs`, Host, print, persist, `SIRMAN_VERSION.json`.

---

# 25. Git diff summary

`git diff --name-only 2370088 dae7cde`:

```text
Laegh_Final.html
Sirman_Final.html
test_laegh.js
```

Selector + one caller null-guard. Ranking loop body is unchanged.

---

# 26. Risks/blockers

| ID | Level | Note |
|---|---|---|
| R1 | LOW | Empty Core array `[]` is a valid success (no JS ranking); toast “پیشنهادی پیدا نشد” is existing empty-list UX |
| R2 | MEDIUM | Do not fold `inventory.stock` into a later gate with this seam |
| R3 | MEDIUM | Live EXE still unverified for B2–B14 |

No blocker.

---

# 27. Human verification requirement

```text
LIVE EXE = NEEDS HUMAN VERIFICATION
```

No Windows/`Sirman.exe` run. Do not claim print verification. Suggested later shop check: warranty form “پیشنهاد هوشمند” under Host vs HTML-only browser.

---

# 28. Final status

```text
B14 OWNERSHIP MIGRATION REPORT

Branch:
cursor/phase-3-architecture-migration-3733

HEAD before:
2370088

HEAD after:
dae7cde

Worktree:
clean after product commit (report/tracker follow)

Operation:
rules.suggestParts

Ownership BEFORE:
  hasBusinessCore + takeBusinessCore; non-array Core still ran JS ranking
Ownership AFTER:
  EXE: Core array via RunBusiness("rules.suggestParts"); miss/non-array → null
  HTML-only: existing JS ranking

EXE:
Core valid: Core array (CORE-ONLY Host-wins)
Core null: null
Core invalid: null
JS ranking after Core failure: NOT EXECUTED

HTML-only:
B13 vectors: PASS

HTML tests:
PASS (616 / 0)

Core tests:
PASS (151 / 0)

Regression:
PASS

Inventory mutation:
NONE

Print:
UNCHANGED

Persistence:
UNCHANGED

Backup:
UNCHANGED

Host contract:
UNCHANGED

Product code modified:
YES

Changed files:
Sirman_Final.html, Laegh_Final.html, test_laegh.js, B14 report, tracker

Implementation:
COMPLETED

Parity:
CONFIRMED

Final status:
COMPLETED

LIVE EXE:
NEEDS HUMAN VERIFICATION
```

```text
STOP — B14 complete. Wait for B15 instruction.
```
