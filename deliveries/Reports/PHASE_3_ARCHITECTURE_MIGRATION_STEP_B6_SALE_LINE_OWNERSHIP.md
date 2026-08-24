# SIRMAN — PHASE 3 ARCHITECTURE MIGRATION
## STEP B6 — `sale.line` OWNERSHIP MIGRATION

**Date:** 1405/05/29 (20 August 2026)  
**Branch:** `cursor/phase-3-architecture-migration-3733`  
**B5 HEAD (rollback target):** `51ece544cd5837569dee498888b8a24e44e184b6` (`feat: migrate calc.sla ownership to core`)  
**Live version:** `1405.5.27γ` (unchanged)

```text
PHASE 3 CHANGE GATE

Requested change:
Move EXE ownership of sale.line so JS line math is not a second EXE implementation.

Classification:
C

Capability:
sale.line

Files expected to change:
Sirman_Final.html
Laegh_Final.html
test_laegh.js
desktop/Sirman.Core.Tests/SaleLineParityTests.cs
desktop/Sirman.Core.Tests/SaleLineParityVectors.json
desktop/Sirman.Core.Tests/Sirman.Core.Tests.csproj

UI Owner:
Sirman_Final.html calcSaleLine / getSaleData / printSaleDoc (calculation only)

Business Owner:
InvoicePricing.SaleLine via existing RunBusiness("sale.line")

Persistence Owner:
HTML — not this op

Host:
sirmanHost.RunBusiness — signature UNCHANGED

Source-of-truth class:
DUAL (EXE = Core, HTML-only = JS)

RunBusiness touched:
NO (call site already existed)

Persistence touched:
NO

Backup schema touched:
NO

Print touched:
NO (printSaleDoc now calls calcSaleLine; print engine / IPrintService untouched)

Security touched:
NO

LOCKED area touched:
NO (not sale save/stock consume)

FROZEN area touched:
NO

HTML-only preserved:
YES

New architecture introduced:
NO

Gate:
PASS

Reason:
Existing dual-path calculation. Same B2/B3/B5 ownership gate. No Core algorithm change.
```

```text
Architecture migration = YES
Ownership migrated = sale.line
sale.total migrated = NO
Persistence changed = NO
Print changed = NO
Backup changed = NO
Locked workflow changed = NO
HTML-only preserved = YES
```

---

# 1. Change Gate

| Check | Result |
|---|---|
| Branch | `cursor/phase-3-architecture-migration-3733` |
| HEAD before | `51ece54` |
| Worktree before | CLEAN |
| B5 | COMPLETED — recommended next seam `sale.line` |
| Version | `1405.5.27γ` |

Gate: **PASS**. Classification C. Not BLOCKED.

---

# 2. Pre-Check

| Check | Result |
|---|---|
| Change Gate / governance / architecture / print baseline / workflow skill | READ |
| A1–A6, B1–B5 reports | READ |
| `sale.line` Host op | already `"sale.line"` in `BusinessFacade` |
| C# engine | `InvoicePricing.SaleLine` — not rewritten |
| Production call sites | `getSaleData` (two IIFEs), `printSaleDoc` (recalc if stored totals missing) |
| `sale.total` | `calcSaleTotal` — left dual-path; **not** this seam |
| Tax | none on `sale.line` |

Defect (same as pre-B2): Host present + Core miss still ran `Math.round` JS.

---

# 3. Before Architecture

```text
getSaleData / printSaleDoc
  if Host: takeBusinessCore("sale.line", {qty, price, disc})
           → RunBusiness → InvoicePricing.SaleLine
           if Core null: JS Math.round   ← DEFECT
  if !Host: JS Math.round(price*disc/100) and Math.round(qty*(price-discAmt))
```

Two IIFEs in `getSaleData` plus a third copy in `printSaleDoc`.

---

# 4. Target Architecture

```text
EXE / Host present:
  calcSaleLine
    → takeBusinessCore("sale.line")
    → BusinessFacade
    → InvoicePricing.SaleLine
    → {qty, price, disc, discAmt, total}  OR  null (fail-closed)
    NEVER JS Math.round

HTML-only / Host absent:
  calcSaleLine
    → existing JS Math.round formula (unchanged)
```

`sale.total` / `calcSaleTotal` unchanged.

---

# 5. Current sale.line Semantics

Preserved from source (not invented):

| Input | Rule |
|---|---|
| qty | `qty \|\| 1` in JS; C# non-finite or `0` → `1` |
| price | `price \|\| 0`; C# non-finite → `0` |
| disc | `disc \|\| 0`; C# non-finite → `0` |
| discAmt | `Math.round(price * disc / 100)` / `JsRound` |
| total | `Math.round(qty * (price - discAmt))` / `JsRound` |
| tax | not part of this op |

DTO in: `{ qty, price, disc }`  
DTO out: `{ qty, price, disc, discAmt, total }`

---

# 6. Parity Vectors

Shared file: `desktop/Sirman.Core.Tests/SaleLineParityVectors.json`  
Id: `SIRMAN_PHASE_3_B6_SALE_LINE_PARITY`

Expected values taken from current JS `Math.round` and confirmed against `InvoicePricing.SaleLine`.

| id | qty | price | disc | outQty | discAmt | total |
|---|---|---|---|---|---|---|
| qty1-price1000-disc0 | 1 | 1000 | 0 | 1 | 0 | 1000 |
| qty2-price1000-disc10 | 2 | 1000 | 10 | 2 | 100 | 1800 |
| qty0-becomes-1 | 0 | 500 | 0 | 1 | 0 | 500 |
| zero-price | 1 | 0 | 10 | 1 | 0 | 0 |
| decimal-qty | 2.5 | 100 | 0 | 2.5 | 0 | 250 |
| decimal-price | 3 | 100.5 | 0 | 3 | 0 | 302 |
| round-half-1.5 | 1 | 15 | 10 | 1 | 2 | 13 |
| round-half-qty2 | 2 | 15 | 10 | 2 | 2 | 26 |
| round-half-0.5 | 1 | 5 | 10 | 1 | 1 | 4 |
| below-half | 1 | 7 | 7 | 1 | 0 | 7 |
| disc-100 | 1 | 1000 | 100 | 1 | 1000 | 0 |
| decimal-price-disc | 1 | 1000.5 | 10 | 1 | 100 | 901 |

Missing qty on Facade (`{"price":1000,"disc":0}`) → qty 1, total 1000.

Negatives not frozen.

---

# 7. Files Changed

| File | Change |
|---|---|
| `Sirman_Final.html` | add `calcSaleLine`; `getSaleData` / `printSaleDoc` call it |
| `Laegh_Final.html` | byte-sync |
| `test_laegh.js` | B6 EXE / HTML-only / fail-closed / no-persist tests |
| `desktop/Sirman.Core.Tests/SaleLineParityVectors.json` | created |
| `desktop/Sirman.Core.Tests/SaleLineParityTests.cs` | created |
| `desktop/Sirman.Core.Tests/Sirman.Core.Tests.csproj` | copy vectors |
| Report | this file |

Not changed: `InvoicePricing.cs`, `BusinessFacade.cs`, Host, `calcSaleTotal` / `sale.total`, print engine, backup, version.

---

# 8. Ownership Change

| Mode | Owner | Evidence |
|---|---|---|
| EXE | C# `InvoicePricing.SaleLine` via `RunBusiness("sale.line")` | `calcSaleLine` Host-only then `return null` |
| HTML-only | JS `Math.round` in `calcSaleLine` | fallback body kept |

No third `SaleLine`. No new Host method.

---

# 9. Host-Wins Result

Mock `RunBusiness` returns `{discAmt:777, total:888888}` for qty 2 / price 1000 / disc 10 (JS would be discAmt 100, total 1800). Caller keeps **888888** / **777**. One call, name `sale.line`.

---

# 10. Fail-Closed Result

Host present + Core `{ok:false}` → `calcSaleLine(2,1000,10)` returns **`null`**. JS 1800 does not run.

`getSaleData` on null: `ntf('محاسبه فروش انجام نشد')`; `discAmt`/`total` stored as null.  
`printSaleDoc` on null without stored totals: shows `—`, not JS Math.round.

---

# 11. HTML-Only Result

`getSirmanHostSync(){ return null }`. All B6 vector rows match. Fallback source still contains `Math.round(price * disc / 100)`. Not deleted.

---

# 12. Core Tests

`SaleLineParityTests`:

- `SaleLine_MatchesFrozenVectors`
- `Facade_SaleLine_UsesSameFieldNamesAndVectors` (`qty`,`price`,`disc`,`discAmt`,`total`)
- `Facade_SaleLine_MissingQtyBecomesOne`

Existing `SaleLine_MatchesCalcSaleTotal` and `SaleLine_ZeroQtyBecomesOne` kept.

```text
Core: 142 PASS / 0 FAIL   (floor 139)
```

`InvoicePricing.SaleLine` not rewritten.

---

# 13. HTML Tests

Group `فاز ۳ B6 مالکیت sale.line`: Host-wins, HTML-only vectors, fail-closed, no persist + `sale.total` not migrated.

```text
HTML: 596 PASS / 0 FAIL   (floor 592)
```

---

# 14. Regression

```text
HTML: 596 PASS / 0 FAIL
Core: 142 PASS / 0 FAIL
REGRESSION: PASS
HTML-ONLY: PASS
PRINT: UNTOUCHED (engine)
PERSISTENCE: UNCHANGED
LOCKED BUSINESS: UNCHANGED
sale.total: NOT MIGRATED
```

`docs/REGRESSION_SUITE.md` sales groups are inside the full HTML run.

---

# 15. Protected Area Verification

Git diff vs `51ece54`: HTML UI files + tests + this report. No Desktop Host, no Core business/application/print, no version files.

| Area | Changed? |
|---|---|
| Print engine / WindowsPrintHost / IPrintService / PrintServiceAdapter | NO |
| Backup schema | NO |
| Persistence format | NO |
| Invoice locked workflows | NO |
| Inventory mutation | NO |
| Accounting | NO |
| Warranty mutation | NO |
| Authentication / Authorization | NO |
| REST / SQL | NO |
| Host contract/signature | NO |
| Version scheme | NO |
| `sale.total` ownership | NO |

---

# 16. Persistence Safety

```text
ZERO new persistence writes
ZERO new persistence reads
```

`calcSaleLine` does not call `localStorage`, IndexedDB, backup, `svSales`, or `persistCoreSnapshot`.

---

# 17. Risks

| ID | Level | Note |
|---|---|---|
| R1 | MEDIUM | Live WebView2 Host not run in this Linux environment |
| R2 | LOW | `calcSaleTotal` / `sale.total` still has the pre-B2 EXE/JS defect |
| R3 | LOW | `printSaleDoc` still prefers stored `it.total` when present |
| R4 | LOW | Negative midpoint JS↔C# divergence not in the lock |

Do not treat B6 as inventory consume, sale save, or `sale.total` migration.

---

# 18. Human Verification

```text
NEEDS HUMAN VERIFICATION
```

Requires `Sirman.exe` + WebView2 + real Windows. Linux HTML/Core tests do not prove live `RunBusiness("sale.line")`.

Previously outstanding B2/B3/B5 human verification remains outstanding. No printer test required.

---

# 19. Rollback

B5 commit: **`51ece544cd5837569dee498888b8a24e44e184b6`**

```text
git revert <B6-commit>
```

or reset this branch to `51ece54`. No compensating patches.

---

# 20. Final Status

```text
B6 IMPLEMENTATION = COMPLETED
LIVE EXE PATH = NEEDS HUMAN VERIFICATION

Architecture migration = YES
Ownership migrated = sale.line
sale.total migrated = NO
Persistence changed = NO
Print engine changed = NO
Backup changed = NO
Locked business workflows changed = NO
HTML-only preserved = YES
```

STOP. Do not start `sale.total` / inventory / accounting / warranty mutation / persist / backup / print in this step.
