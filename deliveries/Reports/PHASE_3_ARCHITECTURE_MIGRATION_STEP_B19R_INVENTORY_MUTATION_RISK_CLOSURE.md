# SIRMAN — PHASE 3 ARCHITECTURE MIGRATION
## STEP B19R — INVENTORY MUTATION RISK CLOSURE

**Mode:** HIGH-SAFETY REMEDIATION  
**Date:** 1405/05/30 13:12:57 (Asia/Tehran)  
**Gregorian:** 21 August 2026  
**Branch:** `cursor/phase-3-architecture-migration-3733`  
**HEAD before:** `184ac5c` (`docs: record B19 report commit hash on tracker`)  
**Product commit:** `1fcf054` (`fix: close remaining inventory mutation boundary risks`)  
**Live version:** `1405.5.27γ` (unchanged)

```text
R1 saveWarehouseDoc ordering = RESOLVED (preflight; applyWarehouseDoc order unchanged)
R2 _restockFromSale          = RESOLVED
R3 ok:true + invalid stock   = RESOLVED (truthful mutation; stock not usable)
```

```text
STOP — B19R complete. Wait for B20 instruction.
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
13:12:57
```

Final HTML/Core regression completed at this Tehran clock time.

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

# 6. B18-FINAL-GOOD SHA

```text
76c92e6
```

Verified present and an ancestor of HEAD.

---

# 7. B19-FINAL-GOOD SHA

```text
e414025
```

Also verified: `fb4a8fe` (B19-A gates). Worktree was clean before B19R edits.

---

# 8. HEAD before

```text
184ac5c  docs: record B19 report commit hash on tracker
```

---

# 9. HEAD after

```text
1fcf054  fix: close remaining inventory mutation boundary risks
```

This report commit follows.

---

# 10. Baseline test results

Run exactly once before any B19R edit.

| Suite | Result |
|---|---|
| `node test_laegh.js Sirman_Final.html` | **639 PASS / 0 FAIL** |
| `node test_laegh.js Laegh_Final.html` | **639 PASS / 0 FAIL** |
| `dotnet test desktop/Sirman.Core.Tests` | **159 PASS / 0 FAIL** |

Matched the B19 floor. B19R proceeded.

Final after B19R: HTML **644 PASS / 0 FAIL**, Core **159 PASS / 0 FAIL**.

---

# 11. R1 source analysis

EXE `saveWarehouseDoc` order (source, not inferred):

```text
A  build doc + stockByCode (ensureWhInboundItem for in/return)
B  takeBusinessCore('inventory.applyWarehouseDoc')     ← mutates Core/live via applyCoreRecordOnto
C  type===adjust: invStockSnapshot AFTER mutation      ← read for move log
D  recordStockMove (skipped if !stockDataAvailable)
E  warehouseDocs.push + persistCoreSnapshot
```

- Mutates state: `inventory.applyWarehouseDoc` then `applyCoreRecordOnto` on live items.
- Reads stock for adjust log: **after** mutation (B18 NaN skip already present).
- Writes stock-move log: `recordStockMove` / HTML-only `stockMoves.push`.
- Reversible by existing API: **no** — Core has no compensation in this path. B19R must not invent rollback.
- Caller result: `ntf` success/failure; no `{ok, stock}` object returned from `saveWarehouseDoc`.

**Safety question:** Can availability be established **before** `applyWarehouseDoc` without changing successful apply semantics?

**YES.** `invStockSnapshot` + `stockDataAvailable` is a read-only preflight. On healthy EXE, `inventory.stock` succeeds (qty=0 is data) and the existing `applyWarehouseDoc` call/arguments remain. On unavailable stock, return `ntf('محاسبه انجام نشد')` and **do not** call `applyWarehouseDoc`.

This is **not** a reorder of B→C. C (post-adjust snapshot for the move log) stays after apply. A new preflight was inserted between A and B.

Attempt count: **1**.

---

# 12. R1 result

```text
RESOLVED
```

---

# 13. R1 tests

- `R1: موجودی ناموجود روی EXE نباید applyWarehouseDoc را صدا بزند` — `inventory.stock` called, `inventory.applyWarehouseDoc` absent, no doc, no moves.
- `R1: موجودی معتبر باید applyWarehouseDoc موجود را صدا بزند و حرکت NaN نسازد` — apply runs, doc recorded, finite move qty.
- `R1: HTML-only حواله ورود/خروج موفق و adjust ناموجود باید رفتار قبلی را نگه دارد` — HTML-only OUT/IN success; HTML-only adjust still has `stockDataAvailable`.
- Existing B19 ordering test updated to lock **both** preflight-before-apply **and** adjust snapshot-after-apply (does not drop the post-mutation NaN guard).

---

# 14. R2 source analysis

`_restockFromSale` before B19R:

```text
for each sale line:
  if part found:
    EXE: takeBusinessCore('inventory.addStock')
         if core && core.ok!==false && core.item → applyCoreRecordOnto
         // on miss: live qty unchanged
    HTML-only: parts[idx].qty += qty
  ALWAYS: recordStockMove('in', ...)   ← even if addStock missed or part missing
```

Success: addStock + applyCoreRecordOnto + one `recordStockMove('in', code, name, qty, 'sale', 'برگشت '+id)`.
Failure: no live qty write, **but the move log still ran** — a successful-looking movement without mutation.

Authoritative success is already on the existing Host result (`core && core.ok!==false && core.item`). No Core contract change required.

Attempt count: **1**.

---

# 15. R2 result

```text
RESOLVED
```

Move is recorded only after a successful mutation (EXE addStock with item, or HTML-only qty increment). Missing part → no move. addStock miss → `ntf` + no move.

Success-path `recordStockMove` arguments unchanged.

---

# 16. R2 tests

- `R2: addStock موفق باید دقیقاً یک حرکت معتبر بسازد و شکست صفر حرکت بسازد`
- Existing `واقعی: _restockFromSale باید موجودی را به انبار برگرداند` (HTML-only 3+4=7) still PASS.

---

# 17. R3 source analysis

B19 EXE reserve/release after a **successful** Core mutate may return:

```text
{ ok:true, stock:{ok:false, reason:"INVENTORY_UNAVAILABLE"} }
```

Reporting `{ok:false}` here would **lie** that the mutation failed after `applyCoreItemOnto` already ran. Compensation/rollback is forbidden. Therefore the truthful contract remains:

```text
ok:true  = mutation succeeded
stock    = usable only if stockDataAvailable(stock)
```

Invalid stock is **not** ordinary usable stock (`stockDataAvailable===false`).

Attempt count: **1** (contract lock + caller guard; no mutation-result flip to ok:false).

---

# 18. R3 result

```text
RESOLVED
```

Chosen convention: keep `{ok:true, stock: INVENTORY_UNAVAILABLE}` when mutation already succeeded; callers must not treat `r.ok` as permission to read numeric `r.stock`. Production HTML reserve log uses `it.qty`, not `r.stock.qty`/`available`. A no-op comment/guard sits next to that caller so invalid stock is not interpreted as a number and is not turned into a false mutation failure.

---

# 19. R3 tests

- `R3: جهش موفق با stock نامعتبر نباید عدد تفسیر شود و نباید جهش دوم بسازد` — `ok:true`, reserved applied once, `kind:'mutated-no-stock'`, no second `inventory.reserve`, failure path still `ok:false`.
- Source lock: `saveWarehouseDoc` reserve branch has no `r.stock.available` / `r.stock.qty`; uses `it.qty`.

---

# 20. Caller audit table

| Operation | Caller | Checks `ok` | Checks `stock` | Invalid stock |
|---|---|---|---|---|
| `inventory.reserve` (`invReserveOnItem`) | `saveWarehouseDoc` HTML-only reserve | `if(!r.ok)` | explicit non-numeric guard; log uses `it.qty` | mutation stands; no numeric deref; no false retry |
| `inventory.release` (`invReleaseReserveOnItem`) | `InventoryEngine.release` only (no UI `r.stock` reader) | n/a in UI | n/a | no production numeric deref |
| `inventory.consume` | `applyPartReqs` / `_deductStock` | Core miss `ntf`+return | does not use consume `stock` | B19 pre-check already blocks Host call |
| `inventory.applyByWarehouse` | `applyStockByWarehouse` | `core.ok` | EXE returns `{ok:true}` without stock | OUT pre-check B19 |
| `inventory.applyWarehouseDoc` | `saveWarehouseDoc` EXE | `applied` / `applied.ok` | post-adjust `invStockSnapshot` + `stockDataAvailable` | skip NaN move; preflight now skips apply |
| `inventory.addStock` | `_restockFromSale` | `core && core.ok!==false && core.item` | n/a | no `recordStockMove` |

---

# 21. Positive regression

Reserve / release / consume / warehouse IN / OUT / restock / stock-move logging: existing B19 success tests + new R1 success apply + R2 HTML-only 3+4=7 + R2 EXE addStock one finite move. Inventory engine HTML-only still PASS. Core 159 PASS.

---

# 22. Negative regression

Unavailable stock → no `applyWarehouseDoc`. addStock miss → zero moves. `ok:true`+invalid stock → no numeric deref, no second mutate. B16/B17/B18/B19 groups remain in the 644 HTML suite.

---

# 23. Checkpoints

| Name | SHA | Status |
|---|---|---|
| B19R-R1-GOOD | `1fcf054` | PASS |
| B19R-R2-GOOD | `1fcf054` | PASS |
| B19R-R3-GOOD | `1fcf054` | PASS |
| B19R-FINAL-GOOD | `1fcf054` | PASS |

One product commit: the three closures are independent boundary gates, not a retry loop.

---

# 24. Rollback points

```text
B19R-FINAL-GOOD = 1fcf054
B19-FINAL-GOOD  = e414025
B19-A-GATES     = fb4a8fe
B18-FINAL-GOOD  = 76c92e6
B17-SAFE-FAIL-CLOSED = 935377a
```

Rollback: `git revert <BAD_SHA>`. Do not `git reset --hard`.

---

# 25. Protected-area audit

| Area | Status |
|---|---|
| Print | UNCHANGED |
| Persistence | UNCHANGED |
| Backup | UNCHANGED |
| Invoice mutations | UNCHANGED |
| Inventory algorithms (Core Stock/Reserve/Release/Consume/AddStock/ApplyByWarehouse/AdjustStock) | UNCHANGED |
| Accounting | UNCHANGED |
| Warranty mutations | UNCHANGED |
| Auth | UNCHANGED |
| Host contract | UNCHANGED |
| SQL / REST / Second Host | NONE |
| PartsAdvisor | UNCHANGED |
| B16 vectors | UNCHANGED |
| B17 contract file | UNCHANGED |
| B18 ownership | PRESERVED |
| B19 boundary gates | PRESERVED (preflight added, not removed) |
| Version `1405.5.27γ` | UNCHANGED |

`git diff --name-only 184ac5c` product: `Sirman_Final.html`, `Laegh_Final.html`, `test_laegh.js`.

---

# 26. Changed files

```text
Sirman_Final.html
Laegh_Final.html
test_laegh.js
deliveries/Reports/PHASE_3_ARCHITECTURE_MIGRATION_STEP_B19R_INVENTORY_MUTATION_RISK_CLOSURE.md
deliveries/Reports/PHASE_3_MIGRATION_TRACKER.md
```

---

# 27. Git diff summary

```text
1fcf054  +289 / −16
  saveWarehouseDoc EXE: stockDataAvailable preflight before applyWarehouseDoc
  saveWarehouseDoc HTML reserve: do not numeric-read r.stock
  _restockFromSale: recordStockMove only after successful mutation
  tests: 5 new B19R cases; B19 ordering lock keeps post-apply adjust snapshot
```

`git diff --check` clean. Sirman/Laegh byte-identical.

---

# 28. Deferred risks

```text
index.html / install-kit copies (out of file discipline)
LIVE EXE shop verification
```

No remaining B19-report risks in the three named items.

---

# 29. Human verification

```text
LIVE EXE = NEEDS HUMAN VERIFICATION
```

---

# 30. Final status

```text
COMPLETED
```

HTML **644 PASS / 0 FAIL**. Core **159 PASS / 0 FAIL**. Regression PASS.

---

# 31. Compact chat block

```text
B19R INVENTORY MUTATION RISK CLOSURE REPORT

Branch:
cursor/phase-3-architecture-migration-3733

HEAD before:
184ac5c

HEAD after:
1fcf054

Worktree:
clean after product commit; report/tracker follow

Baseline:
HTML 639 / Core 159 PASS

R1 saveWarehouseDoc ordering:
status: RESOLVED
checkpoint: 1fcf054

R2 _restockFromSale:
status: RESOLVED
checkpoint: 1fcf054

R3 ok:true + invalid stock:
status: RESOLVED
checkpoint: 1fcf054

Mutation safety:
reserve: B19 gate + truthful ok:true if mutate succeeded
release: B19 gate + same stock contract
consume: B19 pre-check preserved
warehouse OUT: applyWarehouseDoc preflight
warehouse IN: preflight then existing apply
addStock: move log only on success
stockMove: no NaN; no move without mutation

Positive regression:
PASS

Negative regression:
PASS

B16 parity: PRESERVED
B17 contract: PRESERVED
B18 ownership: PRESERVED
B19 boundary safety: PRESERVED

Protected areas: UNCHANGED
Changed files: Sirman_Final.html Laegh_Final.html test_laegh.js + reports
Rollback points: 1fcf054 / e414025 / 76c92e6

Deferred risks: install-kit copies; LIVE EXE

Product code modified: YES (boundary only)
Final status: COMPLETED
LIVE EXE: NEEDS HUMAN VERIFICATION
Report: deliveries/Reports/PHASE_3_ARCHITECTURE_MIGRATION_STEP_B19R_INVENTORY_MUTATION_RISK_CLOSURE.md
```
