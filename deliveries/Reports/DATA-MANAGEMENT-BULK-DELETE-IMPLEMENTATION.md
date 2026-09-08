# SIRMAN — Data Management & Bulk Delete Implementation

**Date:** 1405/06/17 (2026-09-08)  
**Branch:** `cursor/data-management-bulk-delete-fa01`  
**Base:** `cursor/release-1405-6-16-alpha-fa01`  
**Product version:** `1405.6.16α` (not bumped; Backup SHA locks untouched)  
**Final status:** **COMPLETED**

Files: `Sirman_Final.html` = `Laegh_Final.html`, `test_laegh.js`, `CHANGELOG.md`.

Backup/Recovery, ARCH-25 Phonebook Merge, Restore, Print, SQLite, and Inventory Core semantics were not modified.

---

## 1. Domain reset matrix

Implemented in `dataMgmtDomainDefs()` / `dataMgmtExecuteReset()` / `renderDataManagementUI()`.

| id | Class | Button | Persist |
|---|---|---|---|
| phonebook | B | پاک کردن | `lb` only |
| invoices | B | پاک کردن | `li` `lc` `laegh_invoice_uid_ctr` |
| sales | B | پاک کردن | `laegh_sales` + sale counters |
| warranties | B | پاک کردن | `lw2` via `_persistJsonSafe` |
| accounts | B | پاک کردن | `laegh_accounts` |
| parts | B | پاک کردن | `lp2` |
| inventory | B | پاک کردن | `lv` |
| products | B | پاک کردن | `lp` |
| warehouseDocs | B | پاک کردن | `laegh_warehouse` |
| stockMoves | B | پاک کردن | `laegh_stockmoves` |
| warehouses | B | پاک کردن | `laegh_warehouses` |
| daqiWarehouse | B | پاک کردن | `laegh_daqi_warehouse` |
| daqiVouchers | B | پاک کردن | `laegh_daqi_vouchers` |
| tasks | A | پاک کردن | `svTasks` / `laegh_tasks` |
| services | A | پاک کردن | `ls2` = `[]` |
| defectiveStock | A | پاک کردن | `laegh_defective` |
| postalHistory | A | پاک کردن | `laegh_postal_history` |
| daqi | A | پاک کردن | `laegh_daqi` |
| acH | C | none | blocked |

---

## 2. Safe / unsafe classifications

See audit. Only A/B execute. C is documented and blocked, not faked.

---

## 3. Exact persistence keys

Reset never calls full `sv()` (which would also write `li/lp/lv/lb/la/lc`). Phonebook bulk delete writes **only** `lb`.

---

## 4. Dependency map (runtime)

- Phonebook reset: RAM `phonebook` emptied in place; `pb = phonebook`; `daqi` not read or written.
- Invoice reset: does not touch `acH` or `inventory`.
- Sales/warranty reset: no restock, no account reverse.
- Tasks reset: existing `svTasks()` clears localStorage and IDB mirror (`st.clear()` then put empty).

---

## 5. Phonebook delete algorithm

```
normalizePBDeleteIndexes(raw)
  → parseInt, drop NaN/out-of-range, unique, sort descending

applyPhonebookIndexDeletes(indexes)
  → snapshot slice
  → splice each remaining index
  → localStorage.setItem('lb', JSON.stringify(phonebook))
  → pb = phonebook; markDirty()
  → on throw: restore snapshot in place, deleted=0
```

`delSelPB`:

1. `requirePermission('Customer.Delete')` (master session allowed)
2. empty → ntf, no persist
3. confirm with exact N
4. if N≥100, second confirm (daqi warning + backup recommendation)
5. apply; on failure ntf and no partial delete
6. `renderPB` + audit

Search matching is unchanged (`pbFilteredRows`).

Toolbar: نتیجه count, انتخاب همه نتایج, لغو انتخاب همه, انتخاب‌شده count, حذف انتخاب‌شده‌ها.

No 2650 special-case button. Clones are ordinary rows.

---

## 6. Positional reference handling

Daqi `agencyPhonebookIdx` is not remapped. Tests assert the stored index stays `3` after deleting index `1`, and stays `1` after full phonebook reset.

---

## 7. UI behavior

**A — Settings**

Settings → `🗂 داده‌ها` → card **مدیریت داده‌ها**. Each domain shows class + count. C shows the blocked Persian sentence. Backup download uses existing `exportData()`.

**B — Phonebook**

Search «حمید» uses existing `indexOf` over name/company/phone/addr/note. List checkboxes use original indexes. Select-all checks visible `.pb-rchk` only (search/list). Gallery without search has no row checkboxes; user is told to search or open list.

Help: دفترچه تلفن bullets + new `🗂 مدیریت داده‌ها` help-cat-header (قانون ۷).

---

## 8. Confirmation flow

| Action | Step 1 | Step 2 |
|---|---|---|
| Class A reset | warning confirm | second confirm |
| Class B reset | warning confirm | prompt `تایید` / `تأیید` |
| Class C | no button / ntf if called | — |
| Bulk delete | count confirm | extra if N≥100 |
| Cancel | RAM + disk unchanged | — |

Fail-closed: snapshot RAM → apply → persist → on persist false/throw restore RAM. No silent partial delete.

---

## 9. Test results

```
node test_laegh.js Sirman_Final.html
  کل تست‌ها: 1138
  موفق: 1138
  ناموفق: 0

/home/ubuntu/.dotnet/dotnet test desktop/Sirman.Core.Tests
  Passed: 859  Failed: 0  Total: 859
```

Focused DATA-MGMT group covers:

1. select/delete one  
2. multiple  
3. all search results (`حمید`)  
4. delete zero selected  
5. delete all selected  
6. unrelated contacts preserved  
7. duplicate contacts  
8. 2650 synthetic clones  
9. descending unique indexes  
10. daqi index not remapped  
11. persist `lb` after “reload” parse  
12. persist failure restores snapshot  

Section reset: success per implemented domain, cancel, second confirm, typed word, persist, C blocked, phonebook reset does not mutate `daqi` or invoices.

Existing tests were not weakened.

Walkthrough execution (synthetic, same functions):

```
contacts_before=12
search_hamid_hits=10
delete_ok=true deleted=10
contacts_after=علی,سارا
reload_lb=علی,سارا
daqi_idx_unchanged=true
invoices_untouched=true
reset_tasks_ok=true remaining=0
reset_acH_blocked=true acH.keep=true
reset_phonebook_ok=true remaining=0
daqi_after_full_reset_idx=1
invoices_after_pb_reset=1
```

---

## 10. Known limitations

- After phonebook deletes, daqi indexes may point at the wrong contact or be out of range. The product tells the user; it does not invent a remap.
- Section reset does not restock inventory or reverse account journals.
- Independent warehouse/docs/moves reset can leave those collections inconsistent; warned.
- No new Core operations; EXE uses the same HTML persist path.
- No automatic pre-delete backup (none existed for section delete). High-risk copy recommends current backup; `exportData()` is on the card.
- Browser GUI walkthrough was not available in this cloud VM; proof is the HTML/Core suites plus the execution log.

---

## Acceptance

| Item | Result |
|---|---|
| A Settings → Data Management → understand A/B/C | Implemented |
| B Phonebook search «حمید» → select all → count → confirm → delete → reload | Implemented + tested |
| C Never silently delete unrelated domains | Persist is per-key; tests assert invoices/`acH`/daqi stay |

**FINAL STATUS: COMPLETED**
