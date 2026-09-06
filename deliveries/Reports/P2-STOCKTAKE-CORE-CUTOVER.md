# SIRMAN — P2 Stocktake Core Cutover

**Date:** 2026-09-06  
**Product version:** `1405.6.3α` (unchanged)  
**Kind:** LIVE CORE CUTOVER — stocktake quantity only  
**Base:** exact post-P1 / P2-triage `a2b6386` (`cursor/p2-inventory-remaining-bypass-triage-fa01`)  
**Branch:** `cursor/p2-stocktake-core-cutover-fa01`  
**Final status:** **COMPLETED**

Authority: live `applyStocktakeAdjustments` in `Sirman_Final.html`. Backup / Recovery, Phonebook, Print, Restore, SQLite, Invoices, Sales, Warranty, Accounts, Services, `importParts`, Daqi, `delWarehouseEntity`, and `applyStockByWarehouse` were not modified. No new Core module.

---

## 1. Before path

UI: warehouse page → `openStocktakeModal()` → `#st-confirm` + `#st-reason` → `applyStocktakeAdjustments()`.

```text
_stCounts[code] (physical count)
  → sysQty = parts[i].qty OR inventory[code].qty   // live HTML field, not inventory.stock
  → (defective DEF- had no sysQty lookup; treated as 0)
  → diff = counted - sysQty
  → if diff==0: skip
  → _applyStockMovement(in|out, code, abs(diff), source='stocktake')
       EXE: applyStockByWarehouse → inventory.applyByWarehouse
            return {ok:false} IGNORED
       HTML-only: parts.qty / inventory.qty / DEF- mutate
  → patch last stockMoves reason/user   // even after a failed Core row
  → count++                             // even after a failed Core row
  → ntf(count+' آیتم تعدیل شد ✅')
```

Shop EXE already hit Core for the *write*, but the *read* for system qty was HTML `.qty`, and Core failure still incremented success count.

---

## 2. After path

```text
reason + manager confirm (unchanged)
  ├─ EXE (hasBusinessCore):
  │     invFindStockItem(code)
  │       else DEF- lookup in defectiveStock by id/code
  │     invStockSnapshot(item, '') → inventory.stock
  │       snapshot unavailable → fail row; no HTML fallback
  │     if counted === snap.qty → skip (not a success, not a failure)
  │     invAdjustOnItem(item, counted, '')
  │       → inventory.adjust → InventoryCore.AdjustStock
  │     success → persist by kind + recordStockMove + patch reason/user
  │     Core/Host fail → failCount++; row unchanged; no _applyStockMovement
  └─ HTML-only:
        original sysQty from HTML .qty + _applyStockMovement
→ toast: all-ok / mixed ok+fail / all-fail
→ auditUser with okCount only as the adjustment count
```

---

## 3. Authoritative current-qty source

| Mode | Source of current qty |
|---|---|
| EXE | `invStockSnapshot(item, '')` → `inventory.stock` (Core). HTML `.qty` is not used for the mutation decision. |
| HTML-only | Unchanged: `parts[i].qty` or `inventory[code].qty` (legacy offline). |

`renderStocktake` still *displays* HTML `.qty` as a preview. The apply path on EXE no longer treats that field as authority. A synthetic fixture with stale HTML `qty:99` and Core stock `10` adjusts from Core 10, not from 99.

---

## 4. Absolute target semantics

Physical count is an **absolute target**, same P0 contract:

`invAdjustOnItem(item, countedQty, '')` → `inventory.adjust` `{item, qty: counted, whId:''}` → `InventoryCore.AdjustStock`.

Core computes `diff = target - Stock(item, null).Qty` and then `ApplyByWarehouse(in|out, abs(diff))`. HTML does not send a delta.

Equal counted == Core qty: no Core write (skip). Zero counted: valid target 0 when unreserved. Negative: Core `مقدار نامعتبر`, row fail-closed. `parseInt` NaN: row fail-closed before Core (does not coerce to 0 on this path).

---

## 5. Product handling

- Identity: `products[].code` in the UI; live qty lives on `inventory[code]`.
- Resolve: `invFindStockItem` → `{kind:'product', item: inventory[code]}`.
- Mutate: `inventory.adjust` onto that object.
- Persist: `sv()` → `lv`.
- Not forced into `parts[]` or `defectiveStock`.

---

## 6. Parts handling

- Identity: `parts[].code`.
- Resolve: `invFindStockItem` checks `parts` first, then `inventory`.
- Mutate: same `inventory.adjust` on the part object (existing Core item contract; no new op).
- Persist: `svParts()` → `lp2`. Core `persistKeys` for `inventory.adjust` is always `["inventory"]`; stocktake **does not** blindly call `persistCoreSnapshot` for a part (that would write `lv` instead of `lp2`). Kind-based persist is the existing split.

---

## 7. Defective handling

- Identity: `defectiveStock[].id` (`DEF-…`). `invFindStockItem` does **not** find these; EXE looks up `defectiveStock` by `id`/`code`.
- Core: `IsDefective` if `id` or `code` starts with `DEF-`. `AdjustStock` → `ApplyByWarehouse` → `ApplyDefective`.
  - **in:** `status=in_stock`, `qty += diff` (absolute increase works).
  - **out:** `status=returned`, `qty=0` (any out zeros the row).
- That out behavior already matched HTML-only `_applyStockMovement` defective out and previous EXE `applyByWarehouse`. No new Core contract.
- A mid-reduction (e.g. 3 → 1) still zeros via `ApplyDefective` out — established Core, not invented.
- Persist: `svDefective()` → `laegh_defective`.

HTML-only still does **not** read defective `sysQty` (pre-existing; offline semantics preserved).

---

## 8. Warehouse semantics

Stocktake modal has **no warehouse selector**. Displayed system qty is general `.qty`.

P0/P1 absolute adjust uses **empty `whId`** so `Stock(item, null)` is general qty.

Previous EXE `_applyStockMovement` injected `getDefaultWhId()` for *relative* movement. Using that for absolute adjust would snapshot `byWh[default]` (often 0 when stock is only on `qty`) and disagree with the UI.

EXE stocktake therefore calls `invAdjustOnItem(item, counted, '')` — general-stock empty `whId`, same established adjust contract. Not a warehouse redesign. HTML-only still calls `_applyStockMovement` without `whId`.

---

## 9. Batch failure behavior

No whole-file transaction existed; none was added.

| Row outcome | Qty | Persist | stockMoves | Counted as |
|---|---|---|---|---|
| Core success | Core item applied | kind persist | recorded + reason/user | `okCount++` |
| counted == Core qty | unchanged | none | none | skipped |
| Core `ok:false` | unchanged | none | none | `failCount++` |
| Host / snapshot fail | unchanged | none | none | `failCount++` |

Successful rows may commit while failed rows stay unchanged. Toast:

- all success: `N آیتم تعدیل شد ✅` (previous copy)
- mixed: `N آیتم تعدیل شد — M ناموفق` with `err`
- all fail: `تعدیل انبارگردانی ناموفق (M ردیف)` with `err`

No false full-success toast. No HTML fallback after Core/Host failure.

---

## 10. Reason / audit behavior

Preserved: `#st-reason` required, `#st-confirm` required, `stockMoves` reason/user patch, `auditUser('انبارگردانی', …)`.

EXE writes `recordStockMove(..., 'stocktake', 'انبارگردانی', '', {reason, user})` **only after Core success**, then patches the last row. A failed Core row does not get a movement and is not in `okCount`. `auditUser` uses `okCount`.

---

## 11. Persistence

Existing keys only:

| Kind | Function | Storage |
|---|---|---|
| product | `sv()` | `lv` |
| part | `svParts()` | `lp2` |
| defective | `svDefective()` | `laegh_defective` |
| movements | `svStockMoves()` | existing stockMoves key |

No SQLite, no repository, no new sync. Tests parse `ls.lv` / `ls.lp2` / `ls.laegh_defective` after apply (reload of the serialized snapshot).

---

## 12. Exact files changed

| File | Change |
|---|---|
| `Sirman_Final.html` | EXE branch of `applyStocktakeAdjustments` only |
| `Laegh_Final.html` | byte-identical sync |
| `test_laegh.js` | focused P2 stocktake harness + tests |
| `desktop/Sirman.Core.Tests/InventoryStocktakeAdjustTests.cs` | Facade `inventory.adjust` empty-`whId` + DEF- lock |
| `deliveries/Reports/P2-STOCKTAKE-CORE-CUTOVER.md` | this report |

Not changed: `InventoryCore.cs`, `BusinessFacade.cs`, `applyStockByWarehouse`, Backup/Print/Phonebook/SQLite, version files.

---

## 13. Test totals

| Suite | Command | Result |
|---|---|---|
| HTML | `node test_laegh.js Sirman_Final.html` | **1118 / 1118** (was 1110; +8 P2) |
| Core | `dotnet test desktop/Sirman.Core.Tests` | **859 / 859** (was 855; +4 P2) |

Focused HTML coverage: product / parts / defective; count > / < / = Core qty; zero; negative; invalid; Core rejection; Host failure; duplicate object key; multi-row mixed batch; reason on successful move only; persist reload; failed row unchanged; HTML-only `_applyStockMovement`; stale HTML `.qty` is not EXE authority.

---

## 14. Remaining Inventory bypasses / EXE quantity paths

This packet closes the last planned Inventory implementation window (`applyStocktakeAdjustments`). It does **not** claim every inventory quantity path in the product is Core-owned.

### CORE-OWNED (live EXE qty write goes through Core)

| Path | Core op |
|---|---|
| `saveInvItem` | `inventory.adjust` via `invAdjustOnItem` (P0) |
| `importProducts` new `inventory[code]` | `inventory.adjust` via `invAdjustOnItem` (P1) |
| `applyStocktakeAdjustments` | `inventory.adjust` via `invAdjustOnItem` (P2) |
| `closeInv` EXE | `invoice.close` |
| `applyStockByWarehouse` EXE | `inventory.applyByWarehouse` |
| `saveWarehouseDoc` EXE | `inventory.applyWarehouseDoc` |
| `_deductStock` EXE | `inventory.consume` |
| `_restockFromSale` EXE | `inventory.addStock` |
| warranty part consume EXE | `inventory.consume` |
| warehouse transfer EXE | `applyStockByWarehouse` → `inventory.applyByWarehouse` |
| `invRemoveStockOnItem` EXE | `inventory.removeStock` |

### HTML-ONLY FALLBACK (Host off; EXE does not use these writes)

| Path | Note |
|---|---|
| `saveInvItem` Object.assign | P0 fallback |
| `importProducts` direct `{qty}` | P1 fallback |
| `applyStocktakeAdjustments` `_applyStockMovement` | this packet; preserved |
| `closeInv` `inventory[code].qty -= 1` | parked (P2 triage) |
| `reverseInvoiceLocal` restock | parked |
| `applyStockByWarehouse` HTML engine | parked / already covered on EXE |
| `_deductStock` / `_restockFromSale` HTML | sale/warranty offline |
| warranty HTML `parts[idx].qty=…` | offline |

### PARKED (EXE-capable, not in this window)

| Path | Why parked |
|---|---|
| `importParts` | `parts[]` catalog plant, not `inventory[code]` |
| `deductFromGeneralStock` (Daqi) | direct `inventory[code].qty -=` / `parts.qty -=` on EXE |
| `delWarehouseEntity` | `byWh` rewrite + `qty = _sumByWh` |

### UNKNOWN

None among the live qty writers traced for this packet. Display-only reads (`renderStocktake` HTML `.qty` preview, alerts, search) are not mutation paths.

Inventory daily EXE product qty UI (manual, Excel new, stocktake, invoice close, warehouse docs/transfers, apply-by-warehouse) is Core-owned. Daqi general-stock deduct and warehouse-entity delete remain EXE-direct. `importParts` remains a parts-catalog packet.

---

## 15. Final verdict

**COMPLETED**

EXE stocktake now uses Core `inventory.stock` as current qty and `inventory.adjust` as the absolute physical count. Core/Host failure is fail-closed per row. HTML-only `_applyStockMovement` is preserved. Version stays `1405.6.3α`. Frozen subsystems were not touched.

Not claimed: “Inventory universally complete.” Remaining EXE-direct qty paths: `deductFromGeneralStock`, `delWarehouseEntity`, `importParts` (parts domain).
