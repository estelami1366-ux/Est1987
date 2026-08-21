# SIRMAN — PHASE 3 ARCHITECTURE MIGRATION
## STEP B17 — SAFE FAIL-CLOSED CONTRACT FOR `inventory.stock`

**Mode:** ARCHITECTURE SAFETY / TEST-FIRST  
**Date:** 1405/05/30 12:12:09 (Asia/Tehran)  
**Gregorian:** 21 August 2026  
**Branch:** `cursor/phase-3-architecture-migration-3733`  
**HEAD before:** `b296edb` (`docs: record B16 report commit hash on tracker`)  
**Test commit:** `935377a` (`test: lock inventory.stock safe fail-closed contract`)  
**Live version:** `1405.5.27γ` (unchanged)

```text
PRODUCT CODE MODIFIED = NO
CURRENT RUNTIME CHANGED = NO
OWNERSHIP MIGRATED = NO
INVENTORY MUTATION = NONE
B16 PARITY = PASS
B17 SAFETY TESTS = PASS
```

B17 defines the **safe fail-closed contract** for a future EXE ownership step. It does **not** add `hasBusinessCore()` to `invStockSnapshot` and does **not** migrate ownership.

```text
STOP — B17 safe-fail-closed contract complete. Wait for B18 instruction.
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

# 3. Exact time

```text
12:12:09
```

Regression completed at this Tehran clock time. Test commit `935377a` preceded the run.

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

# 6. HEAD before

```text
b296edb  docs: record B16 report commit hash on tracker
worktree = clean
product checkpoint = B14-GOOD dae7cde
inventory parity checkpoint = B16-PARITY 23a4776
```

---

# 7. HEAD after

Product HTML/Core/Host: still `dae7cde`.  
B17 test commit: `935377a`. Docs commit(s) follow this report.

---

# 8. B14-GOOD checkpoint

```text
B14-GOOD
SHA: dae7cde
dae7cde7c3397282ff9946cdac359e7510495220
HTML: 616 PASS / 0 FAIL
Core: 151 PASS / 0 FAIL
product version: 1405.5.27γ
```

---

# 9. B16-PARITY checkpoint

```text
B16-PARITY
SHA: 23a4776
23a47763d4c3b2400cccddad7948541e865b9e33
HTML: 619 PASS / 0 FAIL
Core: 154 PASS / 0 FAIL
PARITY: CONFIRMED (18 frozen vectors, not rewritten)
```

---

# 10. Live caller inventory

Every production `invStockSnapshot(...)` site in `Sirman_Final.html` (same bytes as `Laegh_Final.html`). The only `takeBusinessCore("inventory.stock")` site is inside `invStockSnapshot` itself (~18396).

| caller | line | fields accessed | null handling | current fallback | UI if missing | mutation |
|---|---|---|---|---|---|---|
| `renderInv` | 13029 | qty, reserved, available, min | none | JS snapshot | interpolates `undefined`; `qty<=min` is false → **in-stock** badge | none |
| `openInvModal` | 13042 | reserved | none | JS snapshot | input value `undefined` | none |
| `saveWarehouseDoc` EXE adjust log | 17650 | qty | none (`cur ? snap : {qty:0}`) | JS snapshot | `qty - undefined` = NaN → bogus move log | applyWarehouseDoc already ran |
| `saveWarehouseDoc` HTML-only adjust | 17692 | qty | none | JS snapshot | NaN diff can reach `applyStockByWarehouse` | HTML-only yes |
| `applyStockByWarehouse` HTML-only out | 18296 / 18300 | available | none | JS snapshot | `undefined < qty` is **false** → **allows OUT** | HTML-only yes; EXE uses `inventory.applyByWarehouse` |
| `invReserveOnItem` HTML-only | 18432 | available | none | JS snapshot | `undefined < qty` is **false** → **allows reserve** | HTML-only yes; EXE uses `inventory.reserve` |
| `invReserveOnItem` EXE display | 18429 | stock object | `core.stock \|\| snapshot` | JS snapshot | failure object returned as `stock` | reserve already decided by Core |
| `invReleaseReserveOnItem` HTML-only | 18461 | full snapshot | none | JS snapshot | returns failure as `stock` | release already applied |
| `invLowStockFromLists` | 18475 / 18480 | qty, min, reorder | none | JS snapshot | `undefined<=undefined` false → may skip low-stock | none |
| `renderKardexPreview` | 18578 | qty, reserved, available, min | missing item uses `{qty:0,...}` | JS snapshot | summary shows `undefined` | none |
| `suggestPartsForCase` HTML fallback | 26712 | available | try/catch; keeps `p.qty` on throw | JS snapshot | `qty` becomes `undefined`, **not** 0; EXE ranking uses `PartsAdvisor` | none |
| `InventoryEngine.stock` | 18545 | alias | n/a | same function | same as snapshot | none |

Callers were **not** modified.

---

# 11. Fields accessed by each caller

Authoritative numeric fields used by live UI:

```text
qty
reserved
available
min
reorder
price
```

`price` is returned by the snapshot and locked in B16; no live caller in the table reads `snap.price` today. The contract still forbids faking `qty` / `reserved` / `available`.

---

# 12. Proposed safe-failure contract

Existing project convention is `{ok:false, reason:...}` (login, backup, Host errors). The smallest contract that answers B17 §7:

**Predicate** (`stockDataAvailable`):

```text
snap && typeof snap === 'object'
 && snap.ok !== false
 && typeof snap.qty === 'number'
 && isFinite(snap.qty)
```

**Host absent** → existing JS snapshot (unchanged).  
**Host present + Core success** → existing Core projection (`qty` is a finite number). Real **zero** stock (`qty:0`) is **data**.  
**Host present + Core failure** → safe failure object:

```text
{ ok: false, reason: "INVENTORY_UNAVAILABLE" }
```

No `qty` / `reserved` / `available` numbers.

Shared file: `desktop/Sirman.Core.Tests/InventoryStockFailClosedContract.json`.

B18, if authorized, must:

1. Add `hasBusinessCore()` and return this failure object on Core miss (no JS snapshot on EXE).
2. Check `stockDataAvailable(snap)` **before** any numeric use at the callers in §10.

B17 does **not** implement those product changes.

---

# 13. Why zero is not safe

Zero stock is a real shop state (B16 `zero-stock` vector: `qty:0`, `available:0`, `stockDataAvailable:true`).

Using `{qty:0, reserved:0, available:0}` as Core-miss would:

- `renderInv`: show 0 and «⚠ کم» (false out of stock)
- HTML-only out/reserve: `available < qty` rejects as insufficient (false block **or**, for qty 0 requests, other lies)
- `suggestPartsForCase`: rank parts as qty 0, which B13 treats as real availability (`P-SEAL` qty 0 ≠ missing data)
- `invLowStockFromLists`: classify as low stock

Therefore failure **must not** include numeric `qty`/`reserved`/`available`.

Returning `null` is also unsafe: `invStockSnapshot(inv).reserved` and `snap.qty` throw. The failure **object** avoids throws; callers still must not treat missing fields as numbers.

---

# 14. UI safety behavior

Accessing `fail.qty` / `fail.reserved` / `fail.available` / `fail.min` does **not** throw.

Without the predicate:

- templates stringify `undefined` (not a blank crash, but not a usable display)
- `qty<=min` is false → false **in-stock** badge
- `undefined < qty` is false → false **allow mutation** on HTML-only paths
- `n - undefined` is `NaN`

B18 must render an unavailable state when `stockDataAvailable` is false, not interpolate raw fields.

---

# 15. Parts-suggestion safety behavior

HTML-only `suggestPartsForCase` reads `invStockSnapshot(p).available` inside try/catch. EXE ranking uses `PartsAdvisor` / `InventoryCore.Stock` and does not call this JS path.

Contract:

```text
unavailable → {kind:'unavailable', qty:null}
real zero   → {kind:'available', qty:0}
```

`unavailable ≠ zero available`. B17 did not change `rules.suggestParts`.

---

# 16. Mutation isolation

EXE mutations already use `hasBusinessCore` + `inventory.reserve` / `release` / `consume` / `addStock` / `applyWarehouseDoc`. They do not decide the mutation from `inventory.stock`.

HTML-only reserve/out **do** read `snap.available`. Unguarded failure would **allow** those mutations (`undefined < qty === false`). Guarded contract returns `{ok:false, reason:'INVENTORY_UNAVAILABLE'}` and does **not** call reserve/release/consume/addStock/applyWarehouseDoc.

Proved in HTML tests. Product mutation functions were not edited.

---

# 17. B16 vector results

B16 table `InventoryStockParityVectors.json` was **not** rewritten. All 18 cases remain success-shaped (`stockDataAvailable === true`). HTML B16 group still green. Core `Stock_MatchesFrozenVectors` / `Facade_InventoryStock_MatchesFrozenVectors` still green.

```text
B16 parity = PASS
```

---

# 18. B17 safety tests

HTML group `فاز ۳ B17 قرارداد fail-closed امن inventory.stock`:

```text
قرارداد موفقیت باید داده موجودی واقعی باشد از جمله موجودی صفر
قرارداد شکست نباید موجودی صفر جعلی بسازد
خواندن فیلدهای UI از شیء شکست نباید استثنا بدهد و نباید عدد تفسیر شود
پیشنهاد قطعه: موجودی ناموجود با موجودی صفر یکی نیست
گارد قرارداد نباید جهش reserve/release/consume را از روی شکست راه بدهد
runtime فعلی inventory.stock هنوز fail-open است و مالکیت مهاجرت نشده
```

Core: `InventoryStockFailClosedTests` (5 facts) — failure ≠ Core empty-item zeros; B16 vectors success-shaped; Facade still returns a snapshot, not `INVENTORY_UNAVAILABLE`.

```text
B17 safety tests = PASS
```

---

# 19. HTML tests

```text
node test_laegh.js Sirman_Final.html
  کل تست‌ها: 625  موفق: 625  ناموفق: 0
```

```text
node test_laegh.js Laegh_Final.html
  کل تست‌ها: 625  موفق: 625  ناموفق: 0
```

Floor: B16 619 → B17 **625** (+6). B5/B6/B8/B10/B11/B13/B14/B16 groups green. Print and inventory engine groups green.

---

# 20. Core tests

```text
dotnet test desktop/Sirman.Core.Tests
  Passed: 159  Failed: 0
```

Floor: B16 154 → B17 **159** (+5).

---

# 21. Regression

```text
Regression = PASS
```

---

# 22. Protected-area audit

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
| Host contract | UNCHANGED |
| SQL / REST / second Host | NONE |
| Version | UNCHANGED (`1405.5.27γ`) |
| Current inventory runtime | UNCHANGED (still fail-open) |

---

# 23. Changed files

```text
desktop/Sirman.Core.Tests/InventoryStockFailClosedContract.json
desktop/Sirman.Core.Tests/InventoryStockFailClosedTests.cs
desktop/Sirman.Core.Tests/Sirman.Core.Tests.csproj
test_laegh.js
deliveries/Reports/PHASE_3_ARCHITECTURE_MIGRATION_STEP_B17_SAFE_FAIL_CLOSED_INVENTORY.md
deliveries/Reports/PHASE_3_MIGRATION_TRACKER.md
```

No `Sirman_Final.html`, `Laegh_Final.html`, Core business, Host, or version files.

---

# 24. Rollback protocol

```text
DEFINED
```

If this step had failed: preserve the report, revert to **B16-PARITY** `23a4776` (`git revert`, not `reset --hard`). Do not roll past B14 unless B16 itself must be abandoned.

B17 tests passed; no rollback executed.

---

# 25. New checkpoint

```text
CHECKPOINT:
B17-SAFE-FAIL-CLOSED

SHA (tests):
935377a
935377a3654a950a978c62d5d567077d62dbc023

Date:
1405/05/30

Time:
12:12:09

Timezone:
Asia/Tehran

Branch:
cursor/phase-3-architecture-migration-3733

Product version:
1405.5.27γ

HTML tests:
625 PASS / 0 FAIL

Core tests:
159 PASS / 0 FAIL

Regression:
PASS

Human verification:
NEEDS HUMAN VERIFICATION
```

This is a **test-contract checkpoint**, not a product ownership checkpoint. Product SHA remains `dae7cde`.

---

# 26. Human verification requirement

```text
LIVE EXE = NEEDS HUMAN VERIFICATION
```

B17 is not a live EXE migration. No shop-machine inventory verification was performed.

---

# 27. Final decision

```text
B17 REPORT

Branch:
cursor/phase-3-architecture-migration-3733

HEAD before:
b296edb

HEAD after:
935377a (tests); docs commit follows; product still dae7cde

Worktree:
clean at gate; tests committed; docs-only after report

B14-GOOD:
dae7cde

B16-PARITY:
23a4776

Decision:
SAFE FAIL-CLOSED CONTRACT

Contract:
success = finite numeric qty (zero is data)
failure = { ok: false, reason: "INVENTORY_UNAVAILABLE" }
predicate = snap.ok!==false && typeof snap.qty==='number' && isFinite(snap.qty)

Current runtime changed:
NO

Inventory mutation:
NONE

B16 parity:
PASS

B17 safety tests:
PASS

HTML tests:
625 PASS / 0 FAIL

Core tests:
159 PASS / 0 FAIL

Regression:
PASS

Protected areas:
UNCHANGED

Product code modified:
NO

Checkpoint:
B17-SAFE-FAIL-CLOSED 935377a

Rollback:
DEFINED

Final status:
COMPLETED
LIVE EXE:
NEEDS HUMAN VERIFICATION
```

```text
B17 = COMPLETED (contract + tests)
B17 OWNERSHIP = NOT STARTED
PRODUCT CODE MODIFIED = NO
```

```text
B18 = NOT STARTED
OWNERSHIP = NOT AUTHORIZED BY THIS REPORT
```

```text
STOP — B17 safe-fail-closed contract complete. Wait for B18 instruction.
```
