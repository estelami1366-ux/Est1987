# SIRMAN — PHASE 3 ARCHITECTURE MIGRATION
## STEP B13 — PARITY LOCK: `rules.suggestParts`

**Mode:** TEST / PARITY LOCK ONLY  
**Date:** 1405/05/30  
**Time:** 11:25:13  
**Timezone:** Asia/Tehran  
**Gregorian:** 21 August 2026  
**Branch:** `cursor/phase-3-architecture-migration-3733`  
**HEAD at gate:** `eb72310` (`docs: record B12 change-gate report commit hash on tracker`)  
**Test commit:** `8446619` (`test: lock rules.suggestParts JS/C# parity vectors`)  
**Live version:** `1405.5.27γ` (unchanged)

```text
PRODUCT CODE MODIFIED = NO
B13 IMPLEMENTATION = NOT COMPLETED
PARITY = CONFIRMED
HTML-ONLY FALLBACK = PRESERVED
INVENTORY MUTATION = NONE
PRINT CHANGED = NO
```

```text
CODE MODIFIED = YES (tests and vector file only)
Ownership migrated = NO
Fail-closed completed = NO
```

---

# 1. Date

```text
1405/05/30
```

---

# 2. Exact time

```text
11:25:13
```

Regression completed at this Tehran clock time. Test commit `8446619` preceded the run.

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

---

# 6. HEAD before

```text
eb72310  docs: record B12 change-gate report commit hash on tracker
eb72310e89ffb1872c2629e31b93e5133acc294b
```

Worktree at gate: clean. B12 analysis completed. Product HTML/Core unchanged since B11.

---

# 7. HEAD after

```text
8446619  test: lock rules.suggestParts JS/C# parity vectors
```

B13 rollback target (HEAD before): `eb72310`.

---

# 8. Worktree before/after

Gate (before edits): **clean**.  
After B13 tests: vectors + Core tests + HTML tests only. Report/tracker follow.

No branch switch, reset, stash, rebase, merge, or cherry-pick. No product HTML/Core/Host edits.

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
| B11 ownership report | READ |
| Phase 3 tracker | READ |
| B10 vector-lock precedent | consulted |

Source inspected and **not edited**: `suggestPartsForCase`, `invStockSnapshot`, `_sumByWh`, `PartsAdvisor.Suggest`, `InventoryCore.Stock`, `BusinessFacade` `"rules.suggestParts"`.

---

# 10. B12 precondition

```text
NEXT SEAM = rules.suggestParts
READINESS = PARITY LOCK REQUIRED
PARITY = PARTIAL
B12 IMPLEMENTATION = NOT STARTED
```

B13 is the parity lock. Ownership migration is **FORBIDDEN** in this step.

---

# 11. Exact JS implementation inspected

`suggestPartsForCase` ~26687:

1. `hasBusinessCore()` then `takeBusinessCore('rules.suggestParts', {parts, prodCode, model, problem})`.
2. If Core is an array, return it.
3. Else (Host absent **or** Core not an array): `catalog.forEach` ranking.
4. Match: `prodCode` vs `p.prodCode`; else `model` vs `p.prodCode` or `p.name.indexOf(model)`; then problem vs lowercased `name+cat+note`.
5. Skip empty `p.code`.
6. `qty` from `invStockSnapshot(p).available` when that helper exists.
7. `explain` = `why.join('؛ ')`.

Live caller: `applySuggestedWarParts` ~19528. Not edited.

HTML-only harness for this lock: `hasBusinessCore → false`, `takeBusinessCore → null`, plus production `_sumByWh` + `invStockSnapshot` (no Host stock).

---

# 12. Exact Core implementation inspected

`PartsAdvisor.Suggest` (`desktop/Sirman.Core/Business/PartsAdvisor.cs`):

- Trim `prodCode` / `model`; `problem` = trim + `ToLowerInvariant`.
- Same match order and the same two Persian why-strings.
- Skip empty code.
- `qty` = `InventoryCore.Stock(p, null).Available` (`Math.Max(0, qty-reserved)`; if `byWh` present, sum the map).
- Catalog iteration order is result order.

`InventoryCore.Stock` was not changed. No reserve/consume/release in B13.

---

# 13. Exact Host/Facade path inspected

Unchanged:

```text
"rules.suggestParts" => PartsAdvisor.Suggest(
    o["parts"] as JsonArray,
    JsonVal.Str(prodCode), JsonVal.Str(model), JsonVal.Str(problem))
```

Payload shape: `{parts, prodCode, model, problem}`. Same Host `RunBusiness`. No second Host.

Current EXE defect (Host present + non-array Core → JS ranking) is **still present**. B13 did not close it.

---

# 14. Parity vector inventory

File: `desktop/Sirman.Core.Tests/SuggestPartsParityVectors.json`

Shared catalog (production-like part rows, not a live shop dump): `P-HEAT` (qty 10 reserved 4 → available **6**), `P-OTHER` (2), `P-SEAL` (qty 0), `P-MODEL` (name contains `چای‌ساز`), `P-CASE` (`Heater Coil` / cat `Heat`), empty-code row (skipped), `P-NOMATCH`, `P-WH` (`byWh WH-A` 7 reserved 2 → available **5**).

| id | Axis | prodCode | model | problem | expected codes (order) | qty notes |
|---|---|---|---|---|---|---|
| empty-catalog | catalog-only | 402003 | چای‌ساز | هیتر | (empty parts) `[]` | — |
| unknown-product-nonsense-problem | catalog-only | NO-SUCH | | xyz | `[]` | no invented code |
| unknown-model-only | catalog-only | | NO-SUCH-MODEL | | `[]` | |
| nonsense-problem-only | catalog-only | | | abcdefgh | `[]` | |
| no-invented-on-empty-inputs | integrity | | | | `[]` | empty inputs do not dump catalog |
| exact-prodcode | prodcode + order + availability | 402003 | | | P-HEAT, P-SEAL, P-WH | 6, **0**, 5 |
| prodcode-plus-model-name | prodcode + model | 402003 | چای‌ساز | | P-HEAT, P-SEAL, P-MODEL, P-WH | model adds P-MODEL after prodCode hits |
| model-in-name | model | | چای‌ساز | | P-MODEL | 5 |
| model-equals-part-prodcode | model | | 888 | | P-MODEL | `pc===model` |
| problem-exact-persian | problem | | | هیتر | P-HEAT, P-WH | why = شرح مشکل |
| problem-mixed-case-latin | problem | | | Heater | P-CASE | JS `toLowerCase` / C# `ToLowerInvariant` |
| problem-multiple-washer | order | | | واشر | P-OTHER, P-SEAL | catalog order |
| prodcode-and-problem | why-text | 402003 | | هیتر | P-HEAT, P-SEAL, P-WH | combined `؛ ` on P-HEAT / P-WH |

13 cases. Empty-code catalog row never appears.

Excluded from the lock (documented, not corrected):

- JS-only `opts.fault` alias (C# payload is `problem` only).
- Culture-specific `i`/`I` folding beyond this Latin `Heater` vector.

---

# 15. JS outputs

Probed HTML-only `suggestPartsForCase` (Host stubs off; `_sumByWh` + `invStockSnapshot` present). Every frozen row matched the `expected` column in §14. Examples:

| Vector | JS codes | JS qty | JS why (first hit) |
|---|---|---|---|
| empty-catalog | — | — | — |
| exact-prodcode | P-HEAT, P-SEAL, P-WH | 6, 0, 5 | کالای مرتبط |
| problem-multiple-washer | P-OTHER, P-SEAL | 2, 0 | شرح مشکل |
| prodcode-and-problem | P-HEAT, P-SEAL, P-WH | 6, 0, 5 | کالای مرتبط؛ شرح مشکل |
| problem-mixed-case-latin | P-CASE | 3 | شرح مشکل |

---

# 16. Core outputs

Probed `PartsAdvisor.Suggest` and Facade `rules.suggestParts`. Same length, order, code, availability, and why-text as JS for every frozen row, including `P-WH` available **5** from `byWh` (not the leftover `qty:1`).

---

# 17. Equality rules

Compared, not set membership:

1. result length
2. order (catalog iteration)
3. `code`
4. `name`
5. `qty` / availability as a number (`10-4=6`, `0`, `7-2=5`)
6. `explain` exact Persian string including `؛ ` join

Normalization already in source (not invented): `prodCode`/`model` trim; `problem` lowercased; `Math.max(0, qty-reserved)`; skip empty code; prodCode match suppresses the model-why on **that item** (`if (!why.length && model …)`).

---

# 18. HTML test result

```text
node test_laegh.js Sirman_Final.html
  کل تست‌ها: 611
  موفق: 611
  ناموفق: 0

node test_laegh.js Laegh_Final.html
  کل تست‌ها: 611
  موفق: 611
  ناموفق: 0
```

B11 floor was HTML 609. B13 added 2 HTML tests.

```text
HTML = PASS
```

---

# 19. Core test result

```text
dotnet test desktop/Sirman.Core.Tests
  Passed: 151  Failed: 0  Skipped: 0
```

B11 floor was Core 149. B13 added 2 facts (`Suggest_MatchesFrozenVectors`, `Facade_SuggestParts_UsesPartsProdCodeModelProblem`).

```text
Core = PASS
```

---

# 20. Focused parity result

HTML group `فاز ۳ B13 قفل برابری rules.suggestParts`:

- HTML-only frozen vectors (length, order, code, qty, explain)
- no persist / no `warranty.save` / no `inventory.reserve`/`consume`; still `if(Array.isArray(core)) return core` + `catalog.forEach`

Core:

- `Suggest_MatchesFrozenVectors`
- `Facade_SuggestParts_UsesPartsProdCodeModelProblem`

```text
Focused parity = PASS
PARITY = CONFIRMED
```

for the frozen catalog table.

---

# 21. Regression result

| Group | Result |
|---|---|
| هسته هوشمند / پیشنهاد قطعه | PASS (existing catalog-only test still green) |
| فاز ۳ B5 `calc.sla` | PASS |
| فاز ۳ B6 `sale.line` | PASS |
| فاز ۳ B8 `sale.total` | PASS |
| فاز ۳ B10 warranty date | PASS |
| فاز ۳ B11 `calc.warrantyEndDate` | PASS |
| فاز ۳ B13 `rules.suggestParts` | PASS (new) |

Print groups were not edited and remained in the green 611 suite.

```text
Regression = PASS
```

---

# 22. Protected-area audit

```text
Print / WebView2 PrintAsync       UNCHANGED
Persistence                       UNCHANGED
Backup                            UNCHANGED
Invoice locked workflows          UNCHANGED
Inventory mutations               UNCHANGED
Accounting                        UNCHANGED
Warranty save/close/delete        UNCHANGED
Authentication                    UNCHANGED
Authorization                     UNCHANGED
Host contract                     UNCHANGED
SQL / REST                        NONE
Second Host                       NONE
HTML-only business fallback       PRESERVED
Product version                   1405.5.27γ UNCHANGED
hasBusinessCore fail-closed       NOT COMPLETED (still JS after non-array Core)
inventory.stock                   NOT MIGRATED
```

---

# 23. Changed files

| File | Why |
|---|---|
| `desktop/Sirman.Core.Tests/SuggestPartsParityVectors.json` | shared frozen catalog + 13 cases |
| `desktop/Sirman.Core.Tests/SuggestPartsParityTests.cs` | Core + Facade data-driven lock |
| `desktop/Sirman.Core.Tests/Sirman.Core.Tests.csproj` | copy JSON to test output |
| `test_laegh.js` | HTML-only vector + no-persist / ownership-not-migrated |
| `deliveries/Reports/PHASE_3_ARCHITECTURE_MIGRATION_STEP_B13_RULES_SUGGESTPARTS_PARITY_LOCK.md` | this report |
| `deliveries/Reports/PHASE_3_MIGRATION_TRACKER.md` | B13 result |

Not changed: `Sirman_Final.html`, `Laegh_Final.html`, `PartsAdvisor.cs`, `InventoryCore.cs`, `BusinessFacade.cs`, Host, print, persist, version.

---

# 24. Git diff summary

`git diff --name-only eb72310 8446619`:

```text
desktop/Sirman.Core.Tests/Sirman.Core.Tests.csproj
desktop/Sirman.Core.Tests/SuggestPartsParityTests.cs
desktop/Sirman.Core.Tests/SuggestPartsParityVectors.json
test_laegh.js
```

Test-only. Ranking arithmetic, stock semantics, and ownership selector are byte-identical to B12.

---

# 25. Risks/blockers

| ID | Level | Note |
|---|---|---|
| R1 | MEDIUM | Later ownership must complete fail-closed without deleting JS ranking |
| R2 | MEDIUM | JS fallback still calls `invStockSnapshot` → do not fold `inventory.stock` into B14 |
| R3 | LOW | `opts.fault` is JS-only; keep using `problem` on the Host payload |
| R4 | LOW | Isolated tests that omit `_sumByWh` would read `qty` instead of `byWh` for `P-WH`; production HTML has `_sumByWh` |
| R5 | MEDIUM | Live EXE still `NEEDS HUMAN VERIFICATION` from B2–B11 |

No blocker for a later **ownership** gate of this frozen table.

---

# 26. Human verification requirement

```text
LIVE EXE = NEEDS HUMAN VERIFICATION
```

B13 is not an EXE migration. No Windows shop run. Do not claim print verification.

---

# 27. Final parity decision

```text
B13 PARITY LOCK REPORT

Branch:
cursor/phase-3-architecture-migration-3733

HEAD before:
eb72310

HEAD after:
8446619

Worktree:
clean after test commit (report/tracker follow)

Operation:
rules.suggestParts

Production ownership changed:
NO

Parity vectors:
COUNT: 13

Focused parity:
PASS

HTML tests:
PASS (611 / 0)

Core tests:
PASS (151 / 0)

Regression:
PASS

Parity:
CONFIRMED

HTML-only fallback:
PRESERVED

Inventory mutation:
NONE

Print:
UNCHANGED

Product code modified:
NO

Implementation:
NOT COMPLETED

Report:
deliveries/Reports/PHASE_3_ARCHITECTURE_MIGRATION_STEP_B13_RULES_SUGGESTPARTS_PARITY_LOCK.md

Final status:
COMPLETED
LIVE EXE = NEEDS HUMAN VERIFICATION
```

```text
PRODUCT CODE MODIFIED = NO
B13 IMPLEMENTATION = NOT COMPLETED
PARITY = CONFIRMED
HTML-ONLY FALLBACK = PRESERVED
INVENTORY MUTATION = NONE
PRINT CHANGED = NO
```

```text
STOP — B13 parity lock complete. Wait for B14 instruction.
```
