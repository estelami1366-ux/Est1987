# SIRMAN — P0 Inventory Manual Adjust Cutover

**Date:** 2026-09-06  
**Product version:** `1405.6.3α` (unchanged)  
**Kind:** LIVE CORE CUTOVER — no new inventory architecture  
**Base:** exact ARCH-27 audited state `0ab4071613a1e0f98cfefbf44404c60a214f1ab1`  
**Branch:** `cursor/p0-inventory-manual-adjust-cutover-fa01`  
**Final status:** **COMPLETED**

Authority: live source (`Sirman_Final.html`, `desktop/Sirman.Core`). Existing contracts only. Backup / Recovery, Phonebook, Print, Restore, and SQLite were not modified.

---

## 1. Before path

Manual inventory edit in the product modal (`openInvModal` → `saveInvItem`):

1. Read `#im-code`, `#im-qty`, `#im-min`, `#im-reorder`, `#im-note`.
2. Parse qty with `parseInt(...)||0` (NaN → 0; negatives kept because they are truthy).
3. Write `inventory[code] = Object.assign({}, prev, {qty, min, reorder, note})` **directly**.
4. If `byWh` is missing, set `{}`.
5. Persist with `sv()` → `localStorage` key `lv`.
6. Close modal, `renderInv()`, `renderProds()`, `ntf('موجودی ذخیره شد')`.

EXE and HTML-only used the same write. Core ops `inventory.adjust` / `inventory.removeStock` already existed on `BusinessFacade` and `InventoryCore.AdjustStock` / `InventoryCore.RemoveStock`, but **no live UI caller** used them for this modal.

Hidden semantics that Core does not own: `min`, `reorder`, `note` are form metadata. `saveInvItem` writes the product `inventory` map only (not `parts[]`). No warehouse field in the modal.

---

## 2. After path

```text
openInvModal → saveInvItem
  ├─ EXE (hasBusinessCore):
  │     clone {code, ...prev}
  │     invAdjustOnItem(item, qty, '')
  │       → invStockSnapshot (inventory.stock) fail-closed
  │       → takeBusinessCore('inventory.adjust', {item, qty, whId:''})
  │       → BusinessFacade → InventoryCore.AdjustStock
  │     on fail: ntf(err,'err'); return; live inventory unchanged
  │     on success: overlay min/reorder/note; init empty byWh;
  │                 inventory[code] = item
  │                 persistCoreSnapshot(persistKeys||['inventory']) → sv() → lv
  │
  └─ HTML-only:
        same Object.assign + sv() as before
```

`invRemoveStockOnItem` wires `inventory.removeStock` with the same EXE / HTML-only split as `invReserveOnItem`. `saveInvItem` uses **adjust** (absolute target qty), not a delta split.

---

## 3. Exact files changed

| File | Change |
|---|---|
| `Sirman_Final.html` | EXE branch in `saveInvItem`; add `invAdjustOnItem` / `invRemoveStockOnItem` |
| `Laegh_Final.html` | byte-identical copy of `Sirman_Final.html` |
| `test_laegh.js` | focused P0 execution tests (9) |
| `desktop/Sirman.Core.Tests/InventoryManualAdjustTests.cs` | Facade contract tests (8) |
| `deliveries/Reports/P0-INVENTORY-MANUAL-ADJUST-CUTOVER.md` | this report |

Not changed: `InventoryCore` semantics, `BusinessFacade` op names/shapes, Backup/Recovery, Phonebook, Print, Restore, SQLite, version (`1405.6.3α`).

---

## 4. Core operation used

| UI / helper | Host op | Core method | Payload (existing names) | Success result |
|---|---|---|---|---|
| `saveInvItem` / `invAdjustOnItem` | `inventory.adjust` | `InventoryCore.AdjustStock` | `{item, qty, whId}` | `{ok, err, error, kind, item, stock, wouldGoNegative, persistKeys}` |
| `invRemoveStockOnItem` | `inventory.removeStock` | `InventoryCore.RemoveStock` | `{item, qty, whId}` | same `MutateDto` shape |

`whId` is `''` from the modal (same pattern as `inventory.stock` when no warehouse is selected).

Existing Core rules stay authoritative on EXE:

- `targetQty < 0` → `مقدار نامعتبر`
- `diff == 0` → success clone, no qty change
- negative delta uses `ApplyByWarehouse("out")` and rejects when `available < abs(diff)`
- `RemoveStock` with `qty <= 0` → `مقدار نامعتبر`

---

## 5. Persistence path

No new persistence system.

Successful EXE mutation:

`persistCoreSnapshot(['inventory'])` → existing `sv()` → `localStorage.setItem('lv', JSON.stringify(inventory))`

HTML-only still calls `sv()` directly.

Reload reads the same live `lv` key. Tests parse the written `lv` after save and confirm qty/metadata survive.

---

## 6. Fail-closed behavior

When Host exists (`hasBusinessCore`):

1. If `inventory.stock` snapshot is unavailable → `{ok:false, err:'محاسبه انجام نشد'}`; **do not** call `inventory.adjust` / `inventory.removeStock`; **do not** write `inventory[code].qty`.
2. If Host envelope `ok:false` or throw → `runBusinessCore` returns `null` → same fail-closed error; no HTML mutation fallback.
3. If Core business result `ok:false` (invalid qty, insufficient stock) → `ntf(err,'err')` and return; live map unchanged; no `sv()`.

Missing `invAdjustOnItem` on EXE is treated as failure, not as a silent Object.assign fallback.

---

## 7. HTML fallback behavior

If there is no Host, `saveInvItem` keeps the previous path:

- `Object.assign({}, prev, {qty, min, reorder, note})`
- empty `byWh` init
- `sv()` / close / render / success toast

HTML-only can still set qty below reserved (legacy permissive write). That is intentional: Core rules are EXE-only unless the helper is called without Host, in which case `invAdjustOnItem` / `invRemoveStockOnItem` follow the existing Core-shaped JS rules (same pattern as `invReserveOnItem`).

---

## 8. Test results

Official suites (this packet):

| Suite | Command | Result |
|---|---|---|
| HTML | `node test_laegh.js Sirman_Final.html` | **1103 / 1103** (was 1094; +9 P0) |
| Core | `dotnet test desktop/Sirman.Core.Tests` | **852 / 852** (was 844; +8 P0) |

P0 HTML coverage:

1. Manual adjustment through Core (`inventory.adjust`)
2. Manual removal through Core (`inventory.removeStock`)
3. EXE Host failure fail-closed (no qty write, no persist)
4. EXE business-rule rejection fail-closed
5. HTML-only Object.assign fallback (no Host call; may write below reserved)
6. Persistence after reload (`lv`)
7. Invalid / negative quantity
8. Insufficient stock (reserved)
9. Zero qty, up/down adjust, nonexistent code, duplicate same-qty save, remove more than available

P0 Core coverage (`InventoryManualAdjustTests`): adjust persistKeys, zero qty, negative qty, reserved insufficient, malformed qty → ToInt 0, removeStock success/insufficient/invalid.

---

## 9. Remaining limitation

Out of scope for this packet (do not treat as regressions of the modal cutover):

- Other live qty writes still bypass this helper: Excel import, HTML-only invoice close/restock, HTML-only `applyStockByWarehouse`, stocktake (`applyStocktakeAdjustments`).
- `saveInvItem` still does not migrate `parts[]`; it remains the product `inventory` map.
- Manual modal still does not record `stockMoves` (same as before).
- Empty `whId` adjust updates `item.qty`; if `byWh` exists, Core still uses sum-of-`byWh` as current and may leave per-warehouse buckets unchanged — existing `AdjustStock` contract, not changed.
- Restore `svWarehouse` persist gap remains parked (restore-owned).
- Backup / Recovery, Phonebook, Print unchanged.

---

## 10. Final verdict

**COMPLETED**

EXE manual quantity edit from the inventory modal no longer writes `inventory[code].qty` directly. The existing Core operations `inventory.adjust` and `inventory.removeStock` are wired through `takeBusinessCore` / `BusinessFacade` / `InventoryCore`. Persistence uses the existing `lv` path. HTML-only fallback is preserved. Fail-closed on EXE Core failure. Version `1405.6.3α` unchanged.
