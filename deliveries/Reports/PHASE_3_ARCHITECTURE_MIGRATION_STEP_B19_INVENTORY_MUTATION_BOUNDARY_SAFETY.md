# SIRMAN — PHASE 3 ARCHITECTURE MIGRATION
## STEP B19 — INVENTORY MUTATION BOUNDARY SAFETY

**Mode:** CONTROLLED IMPLEMENTATION (B19-H)  
**Date:** 1405/05/30 13:00:55 (Asia/Tehran)  
**Gregorian:** 21 August 2026  
**Branch:** `cursor/phase-3-architecture-migration-3733`  
**HEAD before:** `09f17b9` (`docs: record B18 ownership report commit hash on tracker`)  
**Product commits:** `fb4a8fe` (gates) + `e414025` (return sanitize)  
**B18-FINAL-GOOD:** `76c92e6`  
**Live version:** `1405.5.27γ` (unchanged)

```text
PRODUCT CODE MODIFIED = YES
OWNERSHIP MIGRATED = NONE (no new capability)
BOUNDARY SAFETY = inventory.reserve / inventory.release / inventory.consume / inventory.applyByWarehouse OUT
HTML-ONLY FALLBACK = PRESERVED
FAIL-CLOSED = CONFIRMED
INVENTORY ALGORITHMS = UNCHANGED
INVENTORYCORE.STOCK = UNCHANGED
PARTSADVISOR = UNCHANGED
PRINT / PERSISTENCE / BACKUP = UNCHANGED
```

```text
STOP — B19 complete. Wait for B20 instruction.
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
13:00:55
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

Did not switch branches. Preferred PR base remains `cursor/phase-3-change-gate-3733`. Never on `main`.

---

# 6. B18-FINAL-GOOD SHA

```text
76c92e6  feat: migrate inventory.stock ownership to core
```

Verified present and an ancestor of HEAD. Worktree was clean before B19 edits. No reset / stash / rebase / merge / cherry-pick.

---

# 7. HEAD before

```text
09f17b9  docs: record B18 ownership report commit hash on tracker
```

---

# 8. HEAD after

```text
e414025  fix: keep Core stock when availability predicate is absent
```

Product gates: `fb4a8fe`. Sanitize correction: `e414025`. This report commit follows.

---

# 9. Baseline results

Run exactly once before any B19 edit.

| Suite | Result |
|---|---|
| `node test_laegh.js Sirman_Final.html` | **631 PASS / 0 FAIL** |
| `node test_laegh.js Laegh_Final.html` | **631 PASS / 0 FAIL** |
| `dotnet test desktop/Sirman.Core.Tests` | **159 PASS / 0 FAIL** |

Baseline matched the last-known floor. B19 proceeded.

---

# 10. Complete mutation caller inventory

Source search of `Sirman_Final.html` (authoritative). Read-only consumers are listed only to mark them out of main scope.

| Caller | Can mutate? | Snapshot / stock | Failure handling before B19 | Exact risk | B19 action |
|---|---|---|---|---|---|
| `invReserveOnItem` EXE | YES `inventory.reserve` | `core.stock \|\| invStockSnapshot` **after** mutate | Core miss `{ok:false, err:'محاسبه انجام نشد'}`; no predicate on returned `stock` | B18 R4: truthy `INVENTORY_UNAVAILABLE` could be `r.stock` after a **successful** reserve; JS snapshot fallback on EXE | Pre-check `invStockSnapshot` + `stockDataAvailable` **before** `inventory.reserve`. Return `core.stock` only if predicate accepts; else `{ok:false, reason:'INVENTORY_UNAVAILABLE'}`. No `\|\| snapshot`. |
| `invReserveOnItem` HTML-only | YES JS `reservedByWh` | snapshot **before** mutate (B18) | `{ok:false, err:'محاسبه انجام نشد'}` | Already gated | Unchanged success path. Negative test: stub unavailable snapshot → no reserved mutation. |
| `invReleaseReserveOnItem` EXE | YES `inventory.release` first | same `core.stock \|\| snapshot` after | none on returned stock | Same as reserve EXE | Same pre-check + return sanitize. |
| `invReleaseReserveOnItem` HTML-only | YES JS reserved maps | snapshot **after** mutate | none | On HTML-only `invStockSnapshot` always numeric; still gate before mutate | Added `stockDataAvailable` **before** JS release. Return line unchanged. |
| `applyStockByWarehouse` EXE OUT | YES `inventory.applyByWarehouse` | no snapshot for decision | Core miss `{ok:false, err:'محاسبه انجام نشد'}` | OUT could run with unread/unavailable stock | Pre-check snapshot before `applyByWarehouse` **only for `type==='out'`**. IN unchanged. |
| `applyStockByWarehouse` HTML-only OUT | YES JS qty/`byWh` | snapshot **before** out (B18) | already gated | Already safe | Unchanged. Negative test added. |
| `applyStockByWarehouse` EXE/HTML IN | YES | none | EXE fail-closed on Core miss | IN does not need current qty | No new gate. Success path preserved. |
| `saveWarehouseDoc` EXE | YES `inventory.applyWarehouseDoc` **first** | snapshot after for adjust **move log** | B18 skip if `!stockDataAvailable` | Mutation already ran; NaN move only | **TRANSACTION ORDERING BLOCKER** for pre-mutation reorder. Left order unchanged. NaN skip kept. |
| `saveWarehouseDoc` HTML-only adjust | YES then `applyStockByWarehouse` | snapshot before diff (B18) | `ntf`+return | Already gated | Unchanged. Inherits apply/reserve gates. |
| `saveWarehouseDoc` HTML-only reserve | via `invReserveOnItem` | nested | inherits reserve | Covered by reserve gate | No extra edit. |
| `applyPartReqs` in `saveWar` EXE | YES `inventory.consume` | **no** snapshot | Core miss `ntf`+return; JS qty not used | Consume Host op ran even when stock unread | Pre-check `invStockSnapshot(parts[idx])` before `inventory.consume`. |
| `_deductStock` EXE | YES `inventory.consume` | **no** snapshot | Core miss `ntf`+return | Same | Same pre-check. |
| `_deductStock` / `applyPartReqs` HTML-only | YES JS `qty` | uses `parts[idx].qty` | confirm on insufficient | Does not consume `invStockSnapshot` | Unchanged (HTML-only snapshot cannot be unavailable). |
| `closeWar` defective OUT | via `applyStockByWarehouse` | nested | inherits apply | Covered by OUT gate | No extra edit. |
| transfer `applyStockByWarehouse` out/in | YES | via apply | inherits | OUT now gated | No extra edit. |
| `_restockFromSale` EXE | YES `inventory.addStock` | none | Core miss skips item write but still `recordStockMove` | Bogus move log on addStock miss | **Deferred** — not the B18 R4 object; not in required negative list. |
| Read-only (`renderInv`, kardex, suggestParts, lowStock, modal) | no | B18 | display guards | Out of main B19 scope | Unchanged. |

---

# 11. Each mutation boundary changed

1. `invReserveOnItem` EXE — pre-mutation stock gate + return sanitize.
2. `invReleaseReserveOnItem` EXE — same.
3. `invReleaseReserveOnItem` HTML-only — pre-mutation stock gate only.
4. `applyStockByWarehouse` EXE OUT — pre-mutation stock gate.
5. `saveWar` / `applyPartReqs` EXE consume — pre-mutation stock gate.
6. `_deductStock` EXE consume — pre-mutation stock gate.

---

# 12. Exact guard added

Authoritative predicate remains B17 `stockDataAvailable` (no competing predicate).

EXE reserve / release (pattern):

```text
pre = invStockSnapshot(item, whId)
if !stockDataAvailable(pre) → {ok:false, err:'محاسبه انجام نشد'}  // Host mutation NOT called
core = takeBusinessCore('inventory.reserve'|'inventory.release', ...)
on success:
  stock = core.stock
  if stockDataAvailable exists AND !stockDataAvailable(stock)
    stock = {ok:false, reason:'INVENTORY_UNAVAILABLE'}
  return {ok:true, stock}
```

Removed:

```text
core.stock || invStockSnapshot(...)
```

EXE warehouse OUT:

```text
if type === 'out':
  preOut = invStockSnapshot(item, whId)
  if !stockDataAvailable(preOut) → {ok:false, err:'محاسبه انجام نشد'}
then inventory.applyByWarehouse
```

EXE consume (`applyPartReqs`, `_deductStock`):

```text
snap = invStockSnapshot(parts[idx])
if !stockDataAvailable(snap) → ntf + return (consume NOT called)
then inventory.consume
```

Attempt 2 (return sanitize only): first draft used `typeof stockDataAvailable!=='function' \|\| !stockDataAvailable(stock)` which discarded a valid Core snapshot in the existing Writer harness that does not extract `stockDataAvailable`. New cause from that test: missing predicate ≠ unavailable stock. Second attempt rewrites returned stock **only when the predicate exists and rejects**. Pre-mutation gates were not retried.

---

# 13. Success-path proof

- Existing engine test: HTML-only reserve 4 → available 6, over-reserve rejected, release remainder 3.
- Existing Writer test: EXE reserve writes Core `reserved=3` and `r.stock.available=7` (not JS 6).
- New B19 success test: EXE reserve/release/consume/IN/OUT with valid Core stock; after reserve, `inventory.stock` is called **once** (pre-check only; no JS snapshot fallback).
- Zero stock (`qty=0`, `available=0`) is `stockDataAvailable===true`. EXE still calls `inventory.reserve`; Core business rejection is **not** `INVENTORY_UNAVAILABLE`.

---

# 14. Failure-path proof

- EXE Host `ok:false` on `inventory.stock` → `inventory.reserve` / `inventory.release` / `inventory.consume` / `inventory.applyByWarehouse` **not** in the call list; live qty/reserved unchanged; `stockMoves.length===0`.
- HTML-only with stub `{ok:false, reason:'INVENTORY_UNAVAILABLE'}` → reserve/release/OUT `{ok:false}`; reserved/qty unchanged; no move.
- Unavailable `qty` is `undefined`; `5 - fail.qty` is NaN; OUT gate stops before `applyByWarehouse` / `recordStockMove`.

---

# 15. Negative tests

Added in `test_laegh.js` group `فاز ۳ B19 مرز جهش انبار`:

| Requirement | Test |
|---|---|
| Core failure → reserve NOT called | `شکست Core روی EXE نباید reserve را صدا بزند و موجودی را عوض نکند` |
| Core failure → release NOT called | `شکست Core روی EXE نباید release را صدا بزند` |
| Core failure → consume NOT called | `شکست Core روی EXE نباید consume را صدا بزند و حرکت NaN نسازد` |
| Core failure → applyByWarehouse NOT called (OUT) | `خروج انبار EXE در شکست Core نباید applyByWarehouse را صدا بزند و حرکت جعلی نسازد` |
| Core failure → no NaN / bogus stock move | same consume + OUT tests (`stockMoves.length===0`) |
| qty=0 is valid stock | `موجودی صفر داده معتبر است و نباید جهش را به‌خاطر ناموجود قطع کند` |
| HTML-only success + unavailable halt | `HTML-only باید رزرو/آزادسازی/خروج موفق قبلی را نگه دارد و در ناموجود جهش نکند` |

---

# 16. Positive regression tests

- Existing Inventory engine execution test (reserve/release/kardex/low-stock).
- Existing EXE Writer reserve test.
- New combined EXE success vector: reserve, release, consume, warehouse IN, warehouse OUT.
- B16 HTML-only parity vectors still executed by the suite.
- B17/B18 fail-closed display tests still green.

---

# 17. B16 parity preservation

`desktop/Sirman.Core.Tests/InventoryStockParityVectors.json` **unchanged** vs `76c92e6`. HTML-only `inventory.stock` vector tests PASS. Core Stock tests PASS (159).

---

# 18. B17 contract preservation

Failure object still `{ok:false, reason:"INVENTORY_UNAVAILABLE"}` without numeric qty/reserved/available. Predicate unchanged:

```text
snap && typeof snap==='object' && snap.ok!==false && typeof snap.qty==='number' && isFinite(snap.qty)
```

`InventoryStockFailClosedContract.json` **unchanged**.

---

# 19. B18 ownership preservation

`invStockSnapshot` EXE still: Host + Core success → Core projection; Host + Core miss → `INVENTORY_UNAVAILABLE`; HTML-only JS snapshot. Not rewritten. B18 read-UI guards remain.

---

# 20. Per-group checkpoint list

| Group | Status | Checkpoint |
|---|---|---|
| B19-A `invReserveOnItem` | PASS | `fb4a8fe` / FINAL `e414025` |
| B19-B `invReleaseReserveOnItem` | PASS | `fb4a8fe` / FINAL `e414025` |
| B19-C consume + warehouse OUT | PASS | `fb4a8fe` / FINAL `e414025` |
| B19-FINAL-GOOD | PASS | `e414025` |

One product hypothesis (pre-mutation `stockDataAvailable` + no `core.stock \|\| snapshot`). Sanitize correction did not change the mutation gates.

---

# 21. Rollback points

```text
B19-FINAL-GOOD     = e414025
B19-A gates        = fb4a8fe
B18-FINAL-GOOD     = 76c92e6
B17-SAFE-FAIL-CLOSED = 935377a
B16-PARITY         = 23a4776
B14-GOOD           = dae7cde
```

Rollback: `git revert <BAD_SHA>` if a later commit is bad. Do not `git reset --hard`.

---

# 22. Protected-area audit

| Area | Status |
|---|---|
| Print | UNCHANGED |
| Persistence | UNCHANGED |
| Backup | UNCHANGED |
| Invoice mutations | UNCHANGED |
| Inventory algorithms (`InventoryCore.Stock` / Reserve / Release / Consume / ApplyByWarehouse) | UNCHANGED |
| Accounting | UNCHANGED |
| Warranty mutations (`warranty.save` / close / delete algorithms) | UNCHANGED; consume **boundary** only |
| Authentication / Authorization | UNCHANGED |
| Host contract | UNCHANGED |
| SQL / REST / Second Host | NONE |
| PartsAdvisor | UNCHANGED |
| B16 vectors | UNCHANGED |
| B17 contract file | UNCHANGED |
| B18 ownership | PRESERVED |
| Version `1405.5.27γ` | UNCHANGED |

`git diff --name-only 09f17b9` (product): `Sirman_Final.html`, `Laegh_Final.html`, `test_laegh.js` only, before this report.

---

# 23. Changed files

```text
Sirman_Final.html
Laegh_Final.html          (byte-sync with Sirman_Final.html)
test_laegh.js
deliveries/Reports/PHASE_3_ARCHITECTURE_MIGRATION_STEP_B19_INVENTORY_MUTATION_BOUNDARY_SAFETY.md
deliveries/Reports/PHASE_3_MIGRATION_TRACKER.md
```

Core / Host / vectors / print / persist **not** modified.

---

# 24. Git diff summary

```text
fb4a8fe  Sirman/Laegh +22 mutation-boundary lines; test_laegh.js +280 B19 tests
e414025  4-line sanitize: rewrite returned stock only when stockDataAvailable exists and rejects
```

`git diff --check` clean. `Sirman_Final.html` byte-identical to `Laegh_Final.html`.

---

# 25. Risks / blockers

- `saveWarehouseDoc` EXE is still **mutate `applyWarehouseDoc` then read stock** for adjust move logs. Reordering to stop the document apply on unread stock would change warehouse transaction semantics → reported as **TRANSACTION ORDERING BLOCKER** and deferred.
- `_restockFromSale` on Core miss can still `recordStockMove` without applying `addStock`. Deferred (not B18 R4; not in the required negative list).
- Extra EXE `inventory.stock` Host call before reserve/release/consume/OUT. Success mutation arguments are unchanged.
- After a **successful** Core mutate, if `core.stock` fails the predicate, the return is `{ok:true, stock: INVENTORY_UNAVAILABLE}`. Mutation is not rolled back (hard rule). Callers that only check `r.ok` still proceed; they must not treat `r.stock` as numeric without `stockDataAvailable`.
- LIVE EXE not run in this environment.

---

# 26. Deferred callers

```text
saveWarehouseDoc EXE applyWarehouseDoc pre-check / reorder
_restockFromSale addStock miss + stock move
index.html / install-kit copies (out of B19 file discipline)
```

---

# 27. Human verification

```text
LIVE EXE = NEEDS HUMAN VERIFICATION
```

Shop checklist later:

```text
reserve
release
consume
warehouse IN
warehouse OUT
zero stock
insufficient stock
Core unavailable
no mutation on unavailable stock
```

---

# 28. Final status

```text
COMPLETED
```

HTML **639 PASS / 0 FAIL** (Sirman and Laegh). Core **159 PASS / 0 FAIL**. Regression PASS.

---

# 29. Compact chat block

```text
B19 INVENTORY MUTATION BOUNDARY SAFETY REPORT

Branch:
cursor/phase-3-architecture-migration-3733

HEAD before:
09f17b9

HEAD after:
e414025

Worktree:
clean after product commits; report/tracker follow

Last known good:
B18-FINAL-GOOD = 76c92e6

Caller inventory:
Count: 16 rows audited (see §10)

B19-A:
status: PASS
checkpoint: e414025

B19-B:
status: PASS
checkpoint: e414025

B19-C:
status: PASS
checkpoint: e414025

Mutation safety:
reserve: gated; Core stock fail → inventory.reserve NOT called
release: gated; Core stock fail → inventory.release NOT called
consume: gated; Core stock fail → inventory.consume NOT called
warehouse OUT: gated; Core stock fail → applyByWarehouse NOT called
warehouse IN: success path unchanged (no new gate)
stock move: no NaN / no move on unavailable OUT/consume

Failure behavior:
INVENTORY_UNAVAILABLE / محاسبه انجام نشد; no fake zero; no JS snapshot on EXE

Success behavior:
existing HTML-only and EXE Core mutate paths preserved; qty=0 is data

B16 parity:
PRESERVED (18 vectors file unchanged)

B17 contract:
PRESERVED

B18 ownership:
PRESERVED

HTML tests:
639 PASS / 0 FAIL

Core tests:
159 PASS / 0 FAIL

Regression:
PASS

Protected areas:
UNCHANGED

Inventory algorithms:
UNCHANGED

Changed files:
Sirman_Final.html Laegh_Final.html test_laegh.js + reports

Rollback points:
e414025 / fb4a8fe / 76c92e6 / 935377a

Deferred callers:
saveWarehouseDoc EXE reorder; _restockFromSale move-on-miss

Product code modified:
YES (boundary only)

Final status:
COMPLETED

LIVE EXE:
NEEDS HUMAN VERIFICATION

Report:
deliveries/Reports/PHASE_3_ARCHITECTURE_MIGRATION_STEP_B19_INVENTORY_MUTATION_BOUNDARY_SAFETY.md
```

```text
STOP — B19 complete. Wait for B20 instruction.
```
