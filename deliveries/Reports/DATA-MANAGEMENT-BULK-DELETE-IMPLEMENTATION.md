# SIRMAN — Data Management & Bulk Delete Implementation

**Date:** 1405/06/17 (2026-09-08)  
**Branch:** `cursor/data-management-bulk-delete-fa01`  
**Base:** `cursor/release-1405-6-16-alpha-fa01`  
**Product version:** `1405.6.16α` (unchanged; Backup assembler SHA locks not churned)  
**Final verdict:** **COMPLETED — DATA MANAGEMENT + PHONEBOOK BULK DELETE**

Backup / Recovery, Phonebook Merge, Restore, Print, SQLite, Inventory Core, and business calculations were not modified. No new Core operations were added. Synthetic fixtures only.

---

## 1. Implemented reset domains

**Class A (two confirms):** tasks, services catalog, defective stock, postal history, daqi list.

**Class B (warning + typed `تایید` / `تأیید`, same normalize as `resetAll`):** phonebook (label: پاک کردن کل دفترچه مخاطبان), invoices, sales, warranties, accounts, parts, inventory object, products, warehouse documents, stock movements, warehouses, daqi warehouse, daqi vouchers.

Each A/B reset: warning of exact deletes + what is not reversed → confirm → persist that domain only → refresh RAM/alias/UI → report deleted count.

## 2. Blocked domains

**Class C:** invoice journal `acH` / key `la`.

No reset button. UI text:

«برای حفظ یکپارچگی اطلاعات، پاک‌سازی مستقل این بخش در حال حاضر مجاز نیست.»

## 3. Exact persistence paths

| Domain | RAM | Persist |
|---|---|---|
| Phonebook | `phonebook` in-place; `pb = phonebook` | `lb` only — never `sv()` |
| Invoices | `invoices`, `invCtr=1`, `invoiceUidCtr=0` | `li`, `lc`, `laegh_invoice_uid_ctr` |
| Sales | `sales`, `saleCtr=1`, `saleUidCtr=0` | `laegh_sales` (+ counters) |
| Warranties | `warranties` | `lw2` via `_persistJsonSafe` |
| Accounts | `accounts` | `laegh_accounts` |
| Parts | `parts` | `lp2` |
| Inventory | `inventory` emptied in-place | `lv` |
| Products | `products` | `lp` |
| Warehouse docs | `warehouseDocs` | `laegh_warehouse` |
| Stock moves | `stockMoves` | `laegh_stockmoves` |
| Warehouses | `warehouses` | `laegh_warehouses` |
| Daqi warehouse | `daqiWarehouse` | `laegh_daqi_warehouse` |
| Daqi vouchers | `daqiVouchers` | `laegh_daqi_vouchers` |
| Tasks | `tasks` | `svTasks` → `laegh_tasks` + IDB mirror |
| Services | `services`; `svcs=services` | `ls2` = `[]` (not `removeItem`) |
| Defective | `defectiveStock` | `laegh_defective` |
| Postal | `postalHistory` | `laegh_postal_history` |
| Daqi list | `daqi` | `laegh_daqi` |
| acH | unchanged | `la` never written by this packet |

No restock / account reverse is invented.

## 4. Phonebook bulk-delete algorithm

1. Indexes from `.pb-rchk[data-i]` (original `phonebook` index).  
2. `normalizePBDeleteIndexes`: integer, in-range, unique, sort descending.  
3. Snapshot `phonebook.slice()`.  
4. `splice` descending.  
5. `localStorage.setItem('lb', JSON.stringify(phonebook))`.  
6. Keep `pb === phonebook` (in-place; no new array object).

Search remains `pbFilteredRows()` over `fn ln shop phones addr note` + `pbCatFilter`. No 2650 special case.

## 5. Confirmation flow

- Bulk delete: «تعداد N مورد انتخاب شده است.» + daqi positional warning. If N≥100, second strong confirm.  
- Class A reset: warning confirm then second confirm.  
- Class B reset: warning confirm then prompt `تایید` (accepts `تأیید`).  
- Cancel leaves RAM and disk unchanged.

## 6. Daqi positional behavior

`daqi.agencyPhonebookIdx` is never remapped or rewritten during bulk delete or full phonebook reset.

Warning shown:

«حذف مخاطبان ممکن است بر ارجاع‌های موقعیتی دفترچه در بخش داغی اثر بگذارد.»

## 7. Failure rollback behavior

On persist throw/false: restore snapshot **in place** (`splice(0)` + `push`). Do not replace the array object. Report error. Do not report success. RAM and `lb` stay consistent.

## 8. UI changes

- Settings → `🗂 داده‌ها` → card مدیریت داده‌ها (`#data-mgmt-list`).  
- Phonebook toolbar: result count, انتخاب همه نتایج, لغو انتخاب همه, selected count, حذف انتخاب‌شده‌ها.  
- Help: دفترچه bullets + `🗂 مدیریت داده‌ها`.  
- Existing `exportData()` offered on the card; no second backup engine. `resetAll` unchanged.

## 9. Exact files changed

- `Sirman_Final.html`  
- `Laegh_Final.html` (byte-identical)  
- `test_laegh.js`  
- `CHANGELOG.md`  
- `deliveries/Reports/DATA-MANAGEMENT-BULK-DELETE-AUDIT.md`  
- `deliveries/Reports/DATA-MANAGEMENT-BULK-DELETE-IMPLEMENTATION.md`

## 10. Test totals

Recorded after the commands in this packet (see following run). Focused DATA RESET 1–23 and PHONEBOOK 24–39 are execution-based in `test_laegh.js`.

## 11. Known limitations

- Daqi indexes may dangle after phonebook splice; not remapped.  
- Section reset does not reverse inventory or journals.  
- Independent warehouse/docs/moves reset can leave those collections inconsistent; warned.  
- HTML-only persist; no new Core ops.  
- Version stays `1405.6.16α`.

## 12. Final verdict

**COMPLETED — DATA MANAGEMENT + PHONEBOOK BULK DELETE**
