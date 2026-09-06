# SIRMAN — P2 Inventory Remaining Bypass Triage

**Date:** 2026-09-06  
**Product version:** `1405.6.3α` (unchanged)  
**Kind:** AUDIT / TRIAGE ONLY — no production code changes  
**Base:** exact post-P1 `67ff41c` (`cursor/p1-inventory-excel-import-cutover-fa01`)  
**Branch:** `cursor/p2-inventory-remaining-bypass-triage-fa01`  
**Final status:** **COMPLETED — TRIAGE ONLY**

Authority: live `Sirman_Final.html` + `desktop/Sirman.Core`. P0 manual adjust and P1 Excel product import are COMPLETE. This packet does not implement.

Scoring: **1 = lowest, 5 = highest.** Effort 5 = large / high regression.

---

## 0. Already closed (context)

| Packet | EXE path | Core op |
|---|---|---|
| P0 | `saveInvItem` | `inventory.adjust` via `invAdjustOnItem` |
| P1 | `importProducts` new `inventory[code]` | `inventory.adjust` via `invAdjustOnItem` |

HTML-only fallbacks for those two remain by architecture (`docs/ARCHITECTURE_RULES.md` §4.1.6 / §4.1.10).

---

## 1. `applyStocktakeAdjustments`

**Current mutation path**

UI: warehouse page → `openStocktakeModal()` → `#st-confirm` + `#st-reason` → `applyStocktakeAdjustments()`.

```text
_stCounts[code] (physical count)
  → sysQty = parts[i].qty OR inventory[code].qty   // live HTML field, not inventory.stock
  → diff = counted - sysQty
  → _applyStockMovement(in|out, code, abs(diff), source='stocktake')
       EXE: applyStockByWarehouse → takeBusinessCore('inventory.applyByWarehouse')
       HTML-only: inventory[code].qty += delta  OR  parts[i].qty += delta
  → patch last stockMoves row reason/user
  → ntf(count+' آیتم تعدیل شد')   // does not read _applyStockMovement.ok
```

Help text (`page-help`): موجودی کالا از حواله ورود **یا انبارگردانی** می‌آید. Button on warehouse toolbar.

**EXE?** Yes. Shop EXE hits this UI.

**EXE already through Core?** Qty **write** yes, indirectly (`_applyStockMovement` → `inventory.applyByWarehouse`). Qty **read** for `sysQty` is still HTML `.qty`. Return value of Core is **ignored** — a failed Core row can still increment `count` and write a reason onto a previous `stockMoves` entry.

**Direct `inventory` qty mutate?** EXE: no (Core). HTML-only: yes, in `_applyStockMovement`.

**Business risk:** Physical count can add or wipe many SKUs (parts + products + DEF-). Ignored Core failure desyncs toast/log vs stock.

**Frequency (source):** Dedicated modal, required reason + manager checkbox, help-linked. Periodic, not every invoice — but when used it is the official correction tool.

**Core to reuse:** `invAdjustOnItem` / `inventory.adjust` (absolute counted qty, same as P0). Already-indirect `inventory.applyByWarehouse` stays as the movement engine. `invFindStockItem` + `invStockSnapshot` for `sysQty`.

**Effort / regression:** One HTML function + batch fail-closed tests. Must keep reason/confirm, parts vs products vs defective, HTML-only `_applyStockMovement`. Medium.

| Business impact | Data risk | Architecture value | Implementation effort |
|---|---|---|---|
| 4 | 4 | 4 | 3 |

**Recommendation: A) implement next**

---

## 2. HTML-only invoice close / restock

**Current mutation path**

`closeInv()`:

- **EXE:** `takeBusinessCore('invoice.close')` → `InvoiceService.Close` → `InventoryCore.Consume(live, 1)` per coded item → `applyCoreRecordOnto` + `persistCoreSnapshot`. Fail-closed. No `inventory[code].qty -=`.
- **HTML-only else:** `inventory[it.code].qty = Math.max(0, qty-1)` plus `_applyStockMovement('out', …, 1, 'invoice')`.

Delete/restock:

- **EXE:** `invoice.delete` / `TransactionReversal.DeleteInvoice`.
- **HTML-only:** `reverseInvoiceLocal` → `inventory[it.code].qty += 1` (creates `{qty:0}` if missing).

**EXE?** `closeInv` / delete run in EXE, but the **direct qty writes are only in the `!hostOn` branch**.

**EXE already through Core?** Yes.

**Direct inventory qty?** HTML-only only.

**Business risk on EXE:** Low (already Core). HTML-only can ignore reserved (Core `Consume` also uses raw `qty`, not available — semantics already match).

**Frequency:** Close invoice is daily on EXE — already covered. HTML-only close is offline/dev.

**Core to reuse (if ever):** already `invoice.close` / `invoice.delete`. Do not re-cut EXE.

**Effort / regression:** High if HTML-only close is rewritten (identity, swapped defective, deposit, `withSaveLock`, many existing tests).

| Business impact | Data risk | Architecture value | Implementation effort |
|---|---|---|---|
| 2 | 2 | 1 | 4 |

**Recommendation: B) park** — intentional HTML-only fallback; EXE is done.

---

## 3. HTML-only `applyStockByWarehouse`

**Current mutation path**

`applyStockByWarehouse(type, code, name, qty, whId, …)`:

- **EXE:** snapshot fail-closed → `inventory.applyByWarehouse` → `applyCoreRecordOnto` → `sv`/`svParts`. B19 tests lock this.
- **HTML-only:** `byWh[whId] += delta`; `qty = _sumByWh(byWh)` on parts first, else `inventory[code]`.

Callers on EXE already go through this function: warehouse docs (`saveWarehouseDoc` uses `inventory.applyWarehouseDoc` first), transfers, warranty defective out, `_applyStockMovement`.

**EXE?** Yes — and Core is used.

**EXE already through Core?** Yes.

**Direct inventory qty?** HTML-only branch only.

**Business risk on EXE:** Residual is HTML-only by design. Removing it would break offline warehouse.

**Frequency:** High-traffic engine, but EXE cutover already landed.

**Core to reuse:** already `inventory.applyByWarehouse`.

**Effort:** Rewriting or deleting the HTML-only engine is large and forbidden by HTML-only compatibility.

| Business impact | Data risk | Architecture value | Implementation effort |
|---|---|---|---|
| 1 | 1 | 1 | 5 |

**Recommendation: C) already sufficiently covered**

---

## 4. `importParts` — same authority problem?

**No.** Separate `parts[]` domain.

```text
readExcel → skip existing parts.code
  → parts.push({ … qty: parseInt(موجودی)||0, min, … })
  → svParts()   // lp2, not lv
```

Does **not** write `inventory[code]`. Create-only (duplicates skipped), same *shape* as P1 product Excel but different SoT (`parts` / `svParts`).

Shop parts qty on EXE already mutates via `inventory.consume` / `addStock` / `applyByWarehouse` (`_deductStock`, warehouse docs). Excel import of **new** parts still plants `parts[].qty` in both EXE and HTML-only.

| Business impact | Data risk | Architecture value | Implementation effort |
|---|---|---|---|
| 3 | 3 | 2 | 3 |

**Recommendation: B) park** as a **parts-catalog** packet, not product-inventory authority.

---

## 5. Scoreboard

| Path | Biz | Data | Arch | Effort | Sum (B+D+A) | Decision |
|---|---|---|---|---|---|---|
| `applyStocktakeAdjustments` | 4 | 4 | 4 | 3 | **12** | **A — implement next** |
| `importParts` (separate domain) | 3 | 3 | 2 | 3 | 8 | B — park |
| HTML-only `closeInv` / `reverseInvoiceLocal` | 2 | 2 | 1 | 4 | 5 | B — park |
| HTML-only `applyStockByWarehouse` | 1 | 1 | 1 | 5 | 3 | C — covered |

---

## 6. Required final output

### 1. Top priority

**`applyStocktakeAdjustments` (انبارگردانی)** — implement next.

### 2. Why

It is the only remaining **live EXE inventory-qty UI** among the listed paths that:

- still reads system qty from HTML `.qty` instead of `inventory.stock`;
- still **ignores Core failure** at the batch wrapper;
- can mutate **products and parts** in one confirm;
- is documented as a primary way stock enters the system.

`closeInv` and `applyStockByWarehouse` already own EXE via Core. Changing their HTML-only branches would fight the compatibility rule without closing an EXE gap.

### 3. Exact existing Core capability to reuse

- **`inventory.adjust` / `invAdjustOnItem(item, countedQty, whId)`** for the absolute physical count (P0 contract).
- **`invFindStockItem` + `invStockSnapshot` / `inventory.stock`** for current qty.
- Keep **`inventory.applyByWarehouse`** only as the existing movement adapter if a delta path is required; prefer adjust for counted target.
- Do **not** add a new Core module.

### 4. Estimated scope

HTML only: `applyStocktakeAdjustments` (+ tests in `test_laegh.js`). Preserve `st-reason`, `st-confirm`, section filter (parts/products/defective), HTML-only `_applyStockMovement`. Fail-closed per row or abort batch on Core `ok:false` — pick the existing row-loop contract (today continues after a failed move; **must not** toast success for failed Core rows). Persist via existing `sv` / `svParts`. No Backup, Phonebook, Print, Restore, SQLite. Version stays `1405.6.3α`.

### 5. What remains parked

- HTML-only `closeInv` deduct and `reverseInvoiceLocal` restock.
- HTML-only `applyStockByWarehouse` engine (B19 EXE already done).
- `importParts` (`parts[].qty` catalog, not `inventory[code]`).
- Out of this triage list but still EXE-direct if a later audit runs: `deductFromGeneralStock` (daqi fallback `inventory[code].qty -=`) and `delWarehouseEntity` byWh rewrite.

### 6. Stay in Inventory or move domain?

**Stay in Inventory for one more implementation window** (stocktake fail-closed / `inventory.adjust`).

After that packet, **move off product-inventory** unless the owner explicitly queues `importParts` or daqi `deductFromGeneralStock`. Daily EXE invoice/warehouse/manual/excel qty paths will then be Core-owned.

---

## 7. Final verdict

**COMPLETED — TRIAGE ONLY**

No production code changed. No Backup / Recovery, Phonebook, Print, Restore, or SQLite edits.
