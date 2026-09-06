# SIRMAN — P1 Inventory Excel Import Core Cutover

**Date:** 2026-09-06  
**Product version:** `1405.6.3α` (unchanged)  
**Kind:** LIVE CORE CUTOVER — Excel product import qty only  
**Base:** exact post-P0 `77d44f7` (`cursor/p0-inventory-manual-adjust-cutover-fa01`)  
**Branch:** `cursor/p1-inventory-excel-import-cutover-fa01`  
**Final status:** **COMPLETED**

Authority: live `importProducts` in `Sirman_Final.html`. Backup / Recovery, Phonebook, Print, Restore, SQLite, and `importParts` were not modified.

---

## 1. Exact old import path

Live UI: `#prod-xlsx-inp` / `#imp-excel` → `importProducts(this)`.

```text
FileReader.readAsBinaryString
  → XLSX.read({type:'binary'})
  → sheet_to_json(header:1).slice(1)
  → for each row:
       skip if !row[0] or !row[1]
       if products already has code → skipped++
       else:
         products.push({code,name,cat,brand,supplier,price,desc,img:''})
         if !inventory[code]:
           inventory[code] = { qty: parseInt(row[7])||0, min: parseInt(row[8])||0, note:'' }
         added++
  → sv(); renderProds(); renderInv(); updateCats();
  → ntf(added + optional skipped duplicates)
```

Column map (locked by `expProductsExcel` / `downloadProductTemplate`):

| Index | Header | Field |
|---|---|---|
| 0 | کد | `code` |
| 1 | نام | `name` |
| 2 | دسته | `cat` |
| 3 | برند | `brand` |
| 4 | تأمین‌کننده | `supplier` |
| 5 | قیمت | `price` |
| 6 | توضیحات | `desc` |
| 7 | موجودی | `inventory.qty` |
| 8 | حداقل | `inventory.min` |

Not imported: `reorder`, `byWh`, `reserved`, `note` (always `''`), `img` (always `''`).

---

## 2. Exact new import path

```text
same parser / row loop
  ├─ EXE + new inventory code:
  │     item = {code, qty:0, min, note:''}
  │     invAdjustOnItem(item, excelQty, '')
  │       → inventory.stock fail-closed
  │       → takeBusinessCore('inventory.adjust', {item, qty, whId:''})
  │     on fail: do not push product; qtyFail++; continue
  │     on success: inventory[code]=item; products.push(...); added++
  ├─ EXE + inventory[code] already exists (orphan):
  │     products.push only; no Core qty call (same as before)
  ├─ product code already in products:
  │     skipped++ (same as before)
  └─ HTML-only:
        original products.push + inventory[code]={qty,min,note:''}
→ sv(); render; ntf (qtyFail uses err)
```

---

## 3. Absolute vs delta determination

**A) ABSOLUTE TARGET** — not a delta.

Evidence from source, not guess:

1. `expProductsExcel` writes `inv.qty` (current stock count) in column 7; import reads the same index.
2. Template example `موجودی=10` is a stock count.
3. Assignment is `qty: parseInt(row[7])||0` on a **new** object — no `+=`.
4. Existing product codes are **skipped**; Excel never adds/subtracts on a live row.
5. Therefore `inventory.removeStock` is not used for this importer.

---

## 4. Files changed

| File | Change |
|---|---|
| `Sirman_Final.html` | EXE branch in `importProducts` |
| `Laegh_Final.html` | byte-identical copy |
| `test_laegh.js` | 7 focused P1 execution tests |
| `desktop/Sirman.Core.Tests/InventoryExcelImportTests.cs` | Facade adjust-from-zero contract (3) |
| `deliveries/Reports/P1-INVENTORY-EXCEL-IMPORT-CORE-CUTOVER.md` | this report |

`InventoryCore` semantics unchanged.

---

## 5. Core operation used

`inventory.adjust` → `InventoryCore.AdjustStock(item, targetQty, whId)`  
Payload: `{ item, qty, whId:'' }` (existing names).  
Success `persistKeys`: `["inventory"]` (end-of-file persist still uses existing `sv()`, which already writes products + inventory).

---

## 6. Handling of new codes

Current contract: a missing `inventory[code]` is **created**, not looked up.

EXE constructs a **new** object `{code, qty:0, min, note:''}` (not a live map row) then adjusts to the Excel absolute qty. This is not treating an existing shop row as zero.

If `inventory[code]` already exists and the product does not (orphan), the product is added and qty is left alone — same as `if(!inventory[code])` before.

---

## 7. Handling of duplicate rows

Unchanged: first row in sheet order that is not already in `products` wins. Later same code → `skipped++` and the toast still says `کد تکراری رد شد`. EXE calls `inventory.adjust` only for the first new inventory create.

Repeated file import of an already-catalogued code still skips (no qty update).

---

## 8. Handling of invalid rows

| Case | Behavior |
|---|---|
| Missing code or name | Silent `return` (not counted) — unchanged |
| Malformed qty (`abc`) | `parseInt\|\|0` → 0; Core accepts 0 |
| Negative qty EXE | Core `مقدار نامعتبر`; row not imported (`qtyFail`) |
| Negative qty HTML-only | Still writes negative — legacy |
| Parser/file error | Existing catch toast |

No whole-file transaction existed; row-level skip is preserved. Core qty rejection does **not** add the product (no partial row).

---

## 9. EXE fail-closed behavior

When Host exists:

- Stock snapshot unavailable → no `inventory.adjust`; no product; no `inventory[code]`
- Host envelope `ok:false` / throw → same
- Core `ok:false` → same; toast includes `موجودی N ردیف اعمال نشد` with `err`
- No silent HTML `{qty:parseInt(row[7])}` fallback on those rows

---

## 10. HTML fallback

`hasBusinessCore` false: original create path, original success toast (no `qtyFail` branch unless Core ran). Duplicates still skipped. Offline HTML mode intact.

---

## 11. Persistence verification

End of import still calls `sv()` → `lv` (inventory) and `lp` is not a separate key — `sv()` writes `li/lp/lv/lb/la/lc` including `lp` products JSON.

P1 test parses `ls.lv` / `ls.lp` after import and confirms qty 6 and product code survive the serialized snapshot.

---

## 12. Test totals

| Suite | Command | Result |
|---|---|---|
| HTML | `node test_laegh.js Sirman_Final.html` | **1110 / 1110** (was 1103; +7 P1) |
| Core | `dotnet test desktop/Sirman.Core.Tests` | **855 / 855** (was 852; +3 P1) |

P1 HTML: absolute adjust through Core (qty from Core 99 ≠ Excel 10), new vs existing vs orphan, duplicate rows, malformed/negative qty, Host failure + business rejection, HTML-only fallback, persist reload.

---

## 13. Remaining Inventory bypasses

Still not this packet:

- `importParts` writes `parts[].qty` (not `inventory[code]`)
- `applyStocktakeAdjustments` (stocktake)
- HTML-only invoice close/restock qty writes
- HTML-only `applyStockByWarehouse`
- `saveProd` creates empty `{qty:0,...}` without Core (catalog create, not Excel)

---

## 14. Final verdict

**COMPLETED**

Excel product import quantity is an absolute target for new `inventory[code]` only. EXE now mutates that qty through existing `inventory.adjust`. Fail-closed on Core failure. HTML-only create path preserved. Version `1405.6.3α` unchanged.
