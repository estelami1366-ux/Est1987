# SIRMAN — PHASE 3 ARCHITECTURE MIGRATION
## STEP B18 — `inventory.stock` OWNERSHIP MIGRATION

**Mode:** CONTROLLED IMPLEMENTATION  
**Date:** 1405/05/30 12:29:33 (Asia/Tehran)  
**Gregorian:** 21 August 2026  
**Branch:** `cursor/phase-3-architecture-migration-3733`  
**HEAD before:** `da12123` (`test: drop unused zero placeholder in B17 HTML contract test`)  
**Product commit:** `76c92e6` (`feat: migrate inventory.stock ownership to core`)  
**Live version:** `1405.5.27γ` (unchanged)

```text
PRODUCT CODE MODIFIED = YES
OWNERSHIP MIGRATED = inventory.stock (EXE)
HTML-ONLY FALLBACK = PRESERVED
FAIL-CLOSED = CONFIRMED
INVENTORY MUTATION = NONE
INVENTORYCORE.STOCK = UNCHANGED
PARTSADVISOR = UNCHANGED
PRINT / PERSISTENCE / BACKUP = UNCHANGED
```

Slices A–D shipped in **one product commit**. A fail-closed central gate without consumer guards would leave EXE tables interpolating `undefined` and claiming in-stock. That is not a shippable intermediate.

```text
STOP — B18 complete. Wait for B19 instruction.
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
12:29:33
```

Regression completed at this Tehran clock time. Product commit `76c92e6` preceded the run.

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

Did not switch branches. Preferred PR base remains `cursor/phase-3-change-gate-3733`. Never on `main`.

---

# 6. Product checkpoint SHA before

```text
B14-GOOD dae7cde  (last product ownership before this step)
HEAD before B18 product: da12123 (B17 docs/tests only)
```

---

# 7. B17-SAFE-FAIL-CLOSED checkpoint

```text
935377a
935377a3654a950a978c62d5d567077d62dbc023
HTML 625 / Core 159 (B17 floor)
```

---

# 8. Per-slice checkpoint SHAs

```text
B18-A-GOOD = 76c92e6  central gate + stockDataAvailable
B18-B-GOOD = 76c92e6  renderInv + openInvModal
B18-C-GOOD = 76c92e6  warehouse read / lowStock / kardex
B18-D-GOOD = 76c92e6  HTML-only suggestParts available guard
B18-FINAL-GOOD = 76c92e6
```

One SHA because A without B/C is not a safe EXE checkpoint.

---

# 9. Final HEAD

```text
76c92e6  feat: migrate inventory.stock ownership to core
76c92e630256c0249e5c5273a9847a21350869ea
```

Docs commits may follow this report.

---

# 10. Worktree before/after

At gate: clean, branch correct, B17 complete. After product commit: tests/docs may follow. No stash/reset/rebase/merge.

---

# 11. Baseline test results

From B17 (product HTML/Core unchanged until `76c92e6`):

```text
HTML: 625 PASS / 0 FAIL
Core: 159 PASS / 0 FAIL
B16 18 vectors: PASS
B17 safety: PASS
```

---

# 12. Central gate change

`invStockSnapshot` now:

```text
Host absent
  → existing JS snapshot (qty/reserved/available/min/reorder/price)

Host present + stockDataAvailable(Core)
  → Core projection

Host present + Core miss / non-numeric qty
  → { ok:false, reason:"INVENTORY_UNAVAILABLE" }
  → JS snapshot is NOT run
```

New helper (B17 predicate, now in product):

```text
function stockDataAvailable(snap){
  return !!(snap && typeof snap==='object' && snap.ok !== false
    && typeof snap.qty === 'number' && isFinite(snap.qty));
}
```

Same Host: `takeBusinessCore("inventory.stock", {item, whId})`. `InventoryCore.Stock` and Facade were not edited.

---

# 13. Each consumer changed

| Slice | Consumer | Change |
|---|---|---|
| A | `invStockSnapshot` / `stockDataAvailable` | EXE fail-closed gate |
| B | `renderInv` | unavailable → `—` cells + badge `محاسبه انجام نشد` (not low, not in-stock) |
| B | `openInvModal` | reserved input `''` if unavailable (not `0`) |
| C | `saveWarehouseDoc` EXE adjust log | skip NaN `recordStockMove` if snapshot unavailable (applyWarehouseDoc already ran) |
| C | `saveWarehouseDoc` HTML-only adjust | `ntf('محاسبه انجام نشد')` + abort if unavailable; success path unchanged |
| C | `applyStockByWarehouse` HTML-only out | unavailable → `{ok:false, err:'محاسبه انجام نشد'}` before `available < qty`; EXE still `inventory.applyByWarehouse` |
| C | `invReserveOnItem` HTML-only | same unavailable return; EXE still `inventory.reserve` |
| C | `invLowStockFromLists` | skip unavailable (neither low nor normal) |
| C | warehouse report lows | skip rows whose `stock` is unavailable |
| C | `renderKardexPreview` | `کد … — محاسبه انجام نشد` |
| C | `InventoryEngine` | alias `stockDataAvailable` |
| D | `suggestPartsForCase` HTML-only | use `available` only if `stockDataAvailable`; EXE ranking still B14 Core |

---

# 14. Failure-state UI behavior

```text
stockDataAvailable = false
  → no throw
  → no undefined arithmetic in migrated reads
  → no fake zero
  → no «⚠ کم»
  → no «✓ موجود»
  → badge / summary: محاسبه انجام نشد
  → no mutation Host calls from the snapshot function
```

---

# 15. HTML-only behavior

Host absent → previous JS snapshot. B16 18 vectors still PASS. B13/B14 suggestion vectors still PASS on the HTML-only ranking path.

---

# 16. EXE / Core behavior

Core success (including `qty:0`) → Core object, `stockDataAvailable=true`.  
Core failure → `INVENTORY_UNAVAILABLE`, no JS qty.

---

# 17. Fail-closed proof

HTML tests:

```text
مسیر EXE باید موجودی هسته را برگرداند و موجودی صفر را داده بداند
شکست Core روی EXE باید INVENTORY_UNAVAILABLE بدهد نه snapshot جاوااسکریپت
```

Item `{qty:10, reserved:4}` on Core miss does **not** return available 6.

---

# 18. Inventory mutation isolation

Not changed: `inventory.reserve` / `release` / `consume` / `addStock` / `applyWarehouseDoc` / `applyByWarehouse`. EXE mutation paths still `hasBusinessCore`. Snapshot function contains none of those op names.

---

# 19. B16 parity preservation

`InventoryStockParityVectors.json` not rewritten. HTML B16 group green. Core `Stock_MatchesFrozenVectors` green.

---

# 20. B17 safety preservation

Failure object still `{ok:false, reason:"INVENTORY_UNAVAILABLE"}` without numeric qty/reserved/available. Zero stock still data. B17 contract tests green (runtime assertion updated from fail-open to fail-closed).

---

# 21. HTML tests

```text
node test_laegh.js Sirman_Final.html
  کل تست‌ها: 631  موفق: 631  ناموفق: 0
```

```text
node test_laegh.js Laegh_Final.html
  کل تست‌ها: 631  موفق: 631  ناموفق: 0
```

Files remain byte-identical. Floor B17 625 → B18 **631** (+6). B5/B6/B8/B10/B11/B13/B14/B16/B17, inventory engine, print, backup groups green.

---

# 22. Core tests

```text
dotnet test desktop/Sirman.Core.Tests
  Passed: 159  Failed: 0
```

No new Core facts (Core algorithm unchanged). Floor unchanged from B17.

---

# 23. Regression

```text
Regression = PASS
```

---

# 24. Protected-area audit

| Area | Status |
|---|---|
| Print | UNCHANGED |
| Persistence | UNCHANGED |
| Backup | UNCHANGED |
| Invoice mutations | UNCHANGED |
| Inventory mutations | UNCHANGED |
| Accounting | UNCHANGED |
| Warranty mutations | UNCHANGED |
| Authentication / authorization | UNCHANGED |
| Host contract | SAME HOST |
| SQL / REST / second Host | NONE |
| `InventoryCore.Stock` | UNCHANGED |
| `PartsAdvisor` | UNCHANGED |
| Product version | UNCHANGED (`1405.5.27γ`) |

---

# 25. Changed files

```text
Sirman_Final.html
Laegh_Final.html
test_laegh.js
deliveries/Reports/PHASE_3_ARCHITECTURE_MIGRATION_STEP_B18_INVENTORY_STOCK_OWNERSHIP.md
deliveries/Reports/PHASE_3_MIGRATION_TRACKER.md
```

---

# 26. Rollback points

```text
B17-SAFE-FAIL-CLOSED  935377a   if B18 product must be abandoned
B14-GOOD              dae7cde   last prior product ownership
B18-FINAL-GOOD        76c92e6   this step
```

Uncommitted failure: `git restore --source=935377a`. Committed failure: `git revert` (not `reset --hard`).

---

# 27. Deferred consumers

None for **reads**. Mutation **operations** remain deferred (B18 must not migrate them). HTML-only reserve/out still use JS snapshot when Host is absent; they now refuse unavailable snapshots without changing the success path.

---

# 28. Risks/blockers

| ID | Level | Note |
|---|---|---|
| R1 | MEDIUM | EXE Core miss shows `محاسبه انجام نشد` instead of JS numbers — intended ownership |
| R2 | LOW | Warehouse report empty-low message can still say «کالای کم‌موجودی نیست» if every snapshot is unavailable |
| R3 | MEDIUM | Live EXE still unverified |
| R4 | LOW | `invReserveOnItem` EXE `core.stock \|\| snapshot` may return the failure object as `stock` if mutation result omits stock |

No blocker. No rollback executed.

---

# 29. Human verification requirement

```text
LIVE EXE = NEEDS HUMAN VERIFICATION
```

Shop machine should later check: inventory table, warehouse stock, reserved/available, low-stock, kardex, parts suggestion, normal stock, zero stock, Core failure state. Not performed here.

---

# 30. Final status

```text
B18 INVENTORY.STOCK OWNERSHIP REPORT

Branch:
cursor/phase-3-architecture-migration-3733

Final HEAD:
76c92e6 (product); docs follow

Worktree:
clean at gate; product committed

Baseline:
HTML 625 / Core 159

B14-GOOD:
dae7cde

B16-PARITY:
23a4776

B17-SAFE-FAIL-CLOSED:
935377a

Slice A:
status: COMPLETED
checkpoint: 76c92e6

Slice B:
status: COMPLETED
checkpoint: 76c92e6

Slice C:
status: COMPLETED
checkpoint: 76c92e6

Slice D:
status: COMPLETED
checkpoint: 76c92e6

Ownership BEFORE:
takeBusinessCore then JS snapshot (fail-open)

Ownership AFTER:
EXE Core or INVENTORY_UNAVAILABLE; HTML-only JS snapshot

EXE:
Core success: Core projection (zero is data)
Core failure: {ok:false, reason:"INVENTORY_UNAVAILABLE"}
JS snapshot on Core failure: NO

HTML-only:
PRESERVED

Inventory mutations:
NONE
Print:
UNCHANGED
Persistence:
UNCHANGED
Backup:
UNCHANGED
Host:
SAME HOST
PartsAdvisor:
UNCHANGED

HTML tests:
631 PASS / 0 FAIL

Core tests:
159 PASS / 0 FAIL

Regression:
PASS

Rollback points:
935377a / dae7cde / 76c92e6

Protected areas:
UNCHANGED

Product code modified:
YES

Changed files:
Sirman_Final.html Laegh_Final.html test_laegh.js + reports

Final status:
COMPLETED
LIVE EXE:
NEEDS HUMAN VERIFICATION
```

```text
B18 = COMPLETED
B19 = NOT STARTED
```

```text
STOP — B18 complete. Wait for B19 instruction.
```
