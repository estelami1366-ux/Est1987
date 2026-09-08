# SIRMAN — Data Management & Bulk Delete Audit

**Date:** 1405/06/17 (2026-09-08)  
**Branch:** `cursor/data-management-bulk-delete-fa01`  
**Product version (unchanged):** `1405.6.16α`  
**Status:** COMPLETED

This audit is source-backed. No domain was reset until its collection, persist key, and cross-domain references were traced.

---

## 1. Domain reset matrix

| Domain | RAM | Persist key(s) | Class | Independent reset |
|---|---|---|---|---|
| Phonebook | `phonebook` (`pb` alias) | `lb` | B | Yes, with daqi-index warning |
| Invoices | `invoices`, `invCtr`, `invoiceUidCtr` | `li`, `lc`, `laegh_invoice_uid_ctr` | B | Yes; does not reverse stock/accounts |
| Sales | `sales`, `saleCtr`, `saleUidCtr` | `laegh_sales`, `laegh_sale_ctr`, `laegh_sale_uid_ctr` | B | Yes; does not reverse stock/accounts |
| Warranties | `warranties` | `lw2` | B | Yes; does not reverse stock/accounts |
| Accounts | `accounts` | `laegh_accounts` | B | Yes; `acH` untouched |
| Parts | `parts` | `lp2` | B | Yes |
| Inventory object | `inventory` | `lv` | B | Yes; HTML `lv` only, no Inventory Core zeroing |
| Products | `products` | `lp` | B | Yes; does not clear `lv` |
| Warehouse documents | `warehouseDocs` | `laegh_warehouse` | B | Yes; does not restock |
| Stock movements | `stockMoves` | `laegh_stockmoves` | B | Yes |
| Warehouses | `warehouses` | `laegh_warehouses` | B | Yes |
| Daqi warehouse | `daqiWarehouse` | `laegh_daqi_warehouse` | B | Yes |
| Daqi vouchers | `daqiVouchers` | `laegh_daqi_vouchers` | B | Yes |
| Tasks | `tasks` | `laegh_tasks` + IDB `laegh-tasks-db` via `svTasks` | A | Yes |
| Services catalog | `services` / `svcs` | `ls2` (persist `[]`, do not `removeItem`) | A | Yes |
| Defective stock | `defectiveStock` | `laegh_defective` | A | Yes |
| Postal history | `postalHistory` | `laegh_postal_history` | A | Yes |
| Daqi list | `daqi` | `laegh_daqi` | A | Yes (`daqi[]` only) |
| Invoice journal | `acH` | `la` | C | **Blocked** |

---

## 2. Safe / unsafe classifications

- **A — independent reset:** two confirms. No known positional FK into other live collections.
- **B — reset with warnings:** typed `تایید` / `تأیید` (same normalize as `resetAll`). Exact delete set and non-delete set are shown. Inventory/accounts are **not** reversed (no invented restock).
- **C — unsafe independent reset:** `acH`. UI shows: «برای حفظ یکپارچگی اطلاعات، پاک‌سازی مستقل این بخش در حال حاضر مجاز نیست.»
- **D — not applicable / infrastructure (not listed as resettable):** Backup/Recovery, Print, roles, company, logo, appearance, SQLite candidate, installer.

Phonebook full reset is **B, not C**. Packet allows an explicit warning instead of disabling. Daqi is left untouched; indexes may dangle.

---

## 3. Exact persistence keys

| Key | Owner |
|---|---|
| `lb` | Phonebook |
| `li` `lc` `laegh_invoice_uid_ctr` | Invoices + counters |
| `lp` | Products |
| `lv` | Inventory object |
| `la` | `acH` (blocked) |
| `laegh_sales` `laegh_sale_ctr` `laegh_sale_uid_ctr` | Sales |
| `lw2` | Warranties (`_persistJsonSafe`) |
| `lp2` | Parts |
| `ls2` | Services. Empty array is stored; seed seed-data only if key missing |
| `laegh_tasks` | Tasks (+ IndexedDB mirror) |
| `laegh_accounts` | Accounts |
| `laegh_defective` | Defective stock |
| `laegh_warehouse` | Warehouse docs |
| `laegh_stockmoves` | Stock moves |
| `laegh_warehouses` | Warehouse entities |
| `laegh_daqi` | Daqi list |
| `laegh_daqi_warehouse` | Daqi warehouse |
| `laegh_daqi_vouchers` | Daqi vouchers |
| `laegh_postal_history` | Postal history |

Related caches/UI: `renderPB` / `renderSaved` / `renderSales` / `renderWar` / `renderAccounts` / `renderParts` / `renderInv` / `renderProds` / `renderSvcs` / `renderTasks` / `renderDefective` / `renderWarehouseDocs` / `renderWarehouseEntities` / `renderDaqi` / `renderDaqiWarehouse` / `renderPostalHistory` / `renderSidebarBadges` / `renderDataStats`.

---

## 4. Dependency map

| From | To | Kind | On independent reset |
|---|---|---|---|
| `daqi.agencyPhonebookIdx` | `phonebook[i]` | **positional index** | Not remapped. Warned. |
| Invoice / sale / warranty / postal | Phonebook | Copied text, not index | Unchanged |
| Sales final | Inventory / accounts | Side effects at sale time | Section reset does **not** reverse |
| Invoice delete path | Inventory / `acH` | Existing delete helpers | Not invoked on section reset |
| Tasks | IDB mirror | Same collection | Cleared via existing `svTasks` |
| `pb` | `phonebook` | Alias | Re-aliased after in-place empty |

No other persisted positional phonebook FK was found.

---

## 5. Phonebook delete algorithm (pre-implementation)

Existing `delSelPB` already sorted descending then `splice`. Gaps:

- no unique-index filter
- persist via full `sv()` (also wrote invoices/products/inventory/`acH`)
- weak confirm text
- no fail-closed restore
- `togAllPB` unwired in toolbar
- gallery view has no row checkboxes until search/list

Safest existing mechanism: descending splice on original array indexes (`data-i`).

---

## 6. Positional reference handling

- Collect indexes from `.pb-rchk[data-i]` (original `phonebook` index).
- `normalizePBDeleteIndexes`: in-range, unique, descending.
- Splice in that order.
- On persist failure, restore the snapshot **in place** (`splice(0)+push`) so `pb` alias stays valid.
- Daqi is never rewritten.

---

## 7. UI behavior (audit of existing surfaces)

- Settings already had tab `🗂 داده‌ها` (`#stg-data`). Data Management is added **inside** that tab.
- Phonebook search is `pbFilteredRows()`: lowercase `indexOf` over `fn ln shop phones addr note` plus `pbCatFilter`.
- When `#pb-q` is non-empty, `renderPB` shows the list (checkboxes present).

---

## 8. Confirmation flow (required)

Reset: click → warning of exact deletes + dependencies + backup recommendation → confirm → second confirm (A) or typed `تایید` (B) → persist domain only → report count.

Bulk delete: search → select → count → confirm «تعداد N مخاطب برای حذف انتخاب شده‌اند.» → extra confirm if N≥100 → persist `lb` only.

No second backup engine. Existing `exportData()` is offered as a button. `resetAll` is unchanged (still forced backup).

---

## 9. Test results

See implementation report.

---

## 10. Known limitations

- Daqi indexes can dangle after any phonebook splice; they are not remapped (no safe existing contract).
- Section reset does not reverse inventory or account postings.
- Clearing warehouse docs / stock moves / warehouses independently can leave those three collections inconsistent with each other; that is disclosed in the B warning.
- HTML-only persist; no new Core `RunBusiness` operations.
- Product version not cut to `1405.6.17α` because Backup assembler SHA locks must not churn in this packet.
