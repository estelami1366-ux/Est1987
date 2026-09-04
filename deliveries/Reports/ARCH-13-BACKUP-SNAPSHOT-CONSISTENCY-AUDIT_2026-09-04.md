# SIRMAN — ARCH-13 Backup Snapshot Consistency Audit

**Date:** 2026-09-04  
**Packet:** Read-only forensic audit of `_buildFullBackupData` temporal / semantic consistency.  
**Product version:** `1405.6.3α` (unchanged)  
**Branch:** `cursor/arch-13-backup-snapshot-consistency-fa01`  
**Base:** `cursor/arch-12-strict-checksum-fa01`  
**Authority:** `Sirman_Final.html` lines cited below. Do not infer timing beyond source order.  
**Assembler lock:** SHA-256 of `_buildFullBackupData` remains `f65d8f393d91de7e984540060ceec6deb14976d9dce4bd7b82261d2e69c5df5f` (ARCH-9D).

---

## Phase 3 Change Gate

```text
CHANGE: ARCH-13 read-only snapshot consistency audit
CLASS: Documentation only. No implementation.
Q1: CAPABILITY — none. Report only.
Q2: RunBusiness / Host: NO
Q3: Persistence: NO
Q4: Printing: NO
Q5: HTML-only: PRESERVED — HTML not modified
Q6: New transport/DB/ACL: NO
RESULT: PASS (audit). Extraction of _buildFullBackupData is BLOCK.
AUTHORITY: explicit user packet ARCH-13 2026-09-04
```

This packet does **not** extract `_buildFullBackupData`, start ARCH-14, cut over Restore, implement Merge/Replace in Core, touch Phonebook / SQLite / `resetAll`, or start P1C-8.

Incoming verified baseline (ARCH-12, not re-run as a production change): HTML 839/839, Core 625/625.

---

## Verdict (one paragraph)

`_buildFullBackupData` is a **fully synchronous** assembler. JavaScript cannot yield to another mutation **inside** this call: there is no `await`, Promise, timer, FileReader, Host call, or DOM write on this path. That is **not** OS-level or cross-tab atomicity, and it is **not** a single storage authority. The function mixes live RAM collections with live localStorage settings, re-reads several RAM arrays for `itemCounts`, generates `exportedAt` from the clock, and applies helper defaults/normalization (starred alarms catalog, network port/role, print-center profiles, counter fallbacks). After those reads it deep-clones with `JSON.parse(JSON.stringify(data))`. Classification: **best-effort synchronous assembly**, not a proven single logical point-in-time snapshot.

---

## 1. Exact read order

Source: `Sirman_Final.html` `function _buildFullBackupData()` **8473–8589**.

Helpers used here (`_safeArr` / `_safeObj` / `_safeStr` 7639–7641) return the **live** value or a fresh empty `[]` / `{}` / `''`. They do not clone.

Times T1… are **source-evaluation order** of the object literal plus the three statements after it. They are not wall-clock samples.

| Step | Kind | What is read / produced |
|---|---|---|
| T1 | constant | `magic` ← `SIRMAN_BACKUP_MAGIC` or `'SIRMAN_BACKUP'` (7649) |
| T2 | constant | `schemaVersion` ← `SIRMAN_SCHEMA_VERSION` or `1` (7648) |
| T3 | literal | `version` / `applicationVersion` ← `'1405.6.3α'` (not `APP_VERSION`) |
| T4 | clock | `exportedAt` ← `new Date().toISOString()` |
| T5 | RAM | `invoices` ← `_safeArr(invoices)` |
| T6 | RAM | `products` ← `_safeArr(products)` |
| T7 | RAM | `inventory` ← `_safeObj(inventory)` |
| T8 | RAM + default | `invCtr` ← `invCtr\|\|1` |
| T9 | RAM + default | `invoiceUidCtr` ← `>0 ? invoiceUidCtr : 0` |
| T10 | RAM + default | `saleCtr` ← `>0 ? saleCtr : 1` |
| T11 | RAM + default | `saleUidCtr` ← `>0 ? saleUidCtr : 0` |
| T12 | RAM | `phonebook` ← `_safeArr(phonebook)` |
| T13 | RAM | `parts` ← `_safeArr(parts)` |
| T14 | RAM | `services` ← `_safeArr(services)` |
| T15 | RAM alias | `svcs` ← `_safeArr(services)` — **same live array as T14** |
| T16 | RAM | `warranties` ← `_safeArr(warranties)` |
| T17 | RAM | `sales` ← `_safeArr(sales)` |
| T18 | RAM | `tasks` ← `_safeArr(tasks)` |
| T19 | RAM | `accounts` ← `_safeArr(accounts)` |
| T20 | RAM | `defectiveStock` ← `_safeArr(defectiveStock)` |
| T21 | RAM | `warehouseDocs` ← `_safeArr(warehouseDocs)` |
| T22 | RAM | `stockMoves` ← `_safeArr(stockMoves)` |
| T23 | RAM | `warehouses` ← `_safeArr(warehouses or [])` |
| T24 | RAM | `daqi` ← `_safeArr(daqi or [])` |
| T25 | RAM | `daqiWarehouse` ← raw `daqiWarehouse or []` — **no `_safeArr`** |
| T26 | RAM | `daqiVouchers` ← raw `daqiVouchers or []` — **no `_safeArr`** |
| T27 | RAM | `postalHistory` ← raw `postalHistory or []` — **no `_safeArr`** |
| T28 | LS helper | `appliedUpdates` ← `getAppliedUpdatesMeta()` → `laegh_applied_updates` (6809–6815) |
| T29 | LS helper | `updatePackages` ← `collectUpdatePackagesForBackup()` → re-reads meta, then `laegh_upd_pkg_<id>` (6819–6828) |
| T30 | RAM | `userAuditLog` ← `_safeArr(userAuditLog)` |
| T31 | RAM | `bgAuditLog` ← `_safeArr(bgAuditLog)` |
| T32 | RAM | `userRoles` ← `_safeArr(userRoles)` |
| T33 | RAM | `loginPw` ← `_safeStr(loginPw)` |
| T34 | LS direct | `printSettings` ← `JSON.parse(localStorage.getItem('laegh_printSettings')\|\|'{}')` |
| T35 | LS direct | `company` ← `laegh_company` |
| T36 | LS direct | `serviceCenter` ← `laegh_service_center` |
| T37 | LS helper + derived | `starredAlarms` ← `getStarredAlarms()` → `laegh_starred_alarms` then `normalizeStarredAlarms` + `starredAlarmCatalog()` (26008–26012, 25987–26007) |
| T38 | RAM | `senderInfo` ← `_safeObj(senderInfo)` |
| T39 | RAM | `logoSrc` ← `_safeStr(logoSrc)` |
| T40 | RAM | `acH` ← `_safeObj(acH)` |
| T41 | LS direct + default `''` | `appearance.skin` ← `laegh_skin` |
| T42 | LS + `''` | `appearance.depth3d` ← `laegh_depth3d` |
| T43 | LS + `''` | `appearance.colorTheme` ← `laegh_color_theme` |
| T44 | LS + `''` | `appearance.theme` ← `laegh_theme` |
| T45 | LS + `''` | `appearance.appFont` ← `laegh_app_font` |
| T46 | LS + `''` | `appearance.textSize` ← `laegh_text_size` |
| T47 | LS + `''` | `appearance.textColor` ← `laegh_text_color` |
| T48 | LS + `''` | `appearance.headingColor` ← `laegh_heading_color` |
| T49 | LS + `''` | `appearance.sbHeadingSize` ← `laegh_sb_heading_size` |
| T50 | LS + `''` | `appearance.dashTint` ← `laegh_dash_tint` |
| T51 | LS + `''` | `appearance.lastPage` ← `laegh_last_page` |
| T52 | LS + `''` | `appearance.density` ← `laegh_density` |
| T53 | LS + `''` | `appearance.radius` ← `laegh_radius` |
| T54 | LS + `''` | `appearance.appBg` ← `laegh_app_bg` |
| T55 | LS + `''` | `appearance.appBgOverlay` ← `laegh_app_bg_overlay` |
| T56 | LS + `''` | `appearance.sbMode` ← `laegh_sb_mode` |
| T57 | LS + `''` | `appearance.sbCollapsed` ← `laegh_sb_collapsed` |
| T58 | LS + `''` | `appearance.navShape` ← `laegh_nav_shape` |
| T59 | LS + `''` | `appearance.sbBg` ← `laegh_sb_bg` |
| T60 | LS + `''` | `appearance.mainBg` ← `laegh_main_bg` |
| T61 | LS + `''` | `appearance.dashBg` ← `laegh_dash_bg` |
| T62 | LS + `''` | `appearance.dashBgOverlay` ← `laegh_dash_bg_overlay` |
| T63 | LS + `''` | `appearance.dashShortcuts` ← `laegh_dash_shortcuts` |
| T64 | LS + `''` | `appearance.dashHideWidgets` ← `laegh_dash_hide_widgets` |
| T65 | LS direct | `sms` ← `laegh_sms` |
| T66 | LS + default | `tz` ← `laegh_tz` or `'Asia/Tehran'` |
| T67 | LS helper + derived | `networkSettings` ← `loadNetworkSettings()` → `laegh_network` → `parseNetworkSettings` (28055–28057, 27969–27982) |
| T68 | LS helper | `prefs` ← `collectPrefsBundle()` → `PREF_KEYS` (9146–9152) |
| T69 | LS scan | `aiKeys` IIFE: iterate `localStorage.length` / `key(i)`; copy keys matching `laegh_ai_key_*` plus `laegh_ai_custom_url`, `laegh_ai_custom_model`, `laegh_ai_model`, `laegh_ai_purpose` |
| T70 | RAM second pass | `itemCounts.invoices` ← `_safeArr(invoices).length` |
| T71 | RAM second pass | `itemCounts.products` |
| T72 | RAM second pass | `itemCounts.phonebook` |
| T73 | RAM second pass | `itemCounts.parts` |
| T74 | RAM second pass | `itemCounts.services` |
| T75 | RAM second pass | `itemCounts.warranties` |
| T76 | RAM second pass | `itemCounts.sales` |
| T77 | RAM second pass | `itemCounts.tasks` |
| T78 | RAM second pass | `itemCounts.accounts` |
| T79 | RAM second pass | `itemCounts.defectiveStock` |
| T80 | RAM second pass | `itemCounts.warehouses` |
| T81 | RAM second pass | `itemCounts.daqi` |
| T82 | RAM second pass | `itemCounts.daqiWarehouse` — here **does** use `_safeArr` (unlike T25) |
| T83 | RAM second pass | `itemCounts.daqiVouchers` — `_safeArr` (unlike T26) |
| T84 | RAM second pass | `itemCounts.postalHistory` — `_safeArr` (unlike T27) |
| T85 | literal | `sections` ← 32-name catalog (omits `warehouseDocs`, `stockMoves`, `svcs`, `prefs`, `printCenter`, `attachmentsIndex`, counters, `itemCounts`, `updatePackages`) |
| T86 | LS helper + defaults | `data.printCenter` ← `getPrintCenterState()` (24708–24726): `laegh_printCenter`, else `getPrintSettings()._center`, else `printCenterDefaultState()` + profile merge. **Read-only.** `savePrintCenterState` (24727) is not called. |
| T87 | derived | if `printCenter` present, push `'printCenter'` onto `sections` |
| T88 | derived from `data` | `attachmentsIndex` ← `collectAttachmentIndex(data)` (7709–7740) |
| T89 | clone | `return JSON.parse(JSON.stringify(data))` |

No Host, IndexedDB, File System Access, or DOM write occurs inside this function.

---

## 2. RAM inventory

All of these are page-global `let` bindings. UI, persist helpers (`sv`, `svParts`, …), and Restore write the same objects. Another operation **cannot mutate them during this function** (single-threaded, no yield). They **can** diverge from their LS mirrors **before** the call if RAM was mutated without the matching `sv*`.

| Global | Collection | Boot / init | Persist helper / LS mirror | Shared elsewhere |
|---|---|---|---|---|
| `invoices` | array | 7519–7520 `li` | `sv()` → `li` | invoice UI, Restore, `ensureAllInvoiceIdentities` |
| `products` | array | 7521 `lp` | `sv()` → `lp` | product UI |
| `inventory` | object | 7522 `lv` | `sv()` → `lv` | stock engine `_ensureByWh` |
| `invCtr` | number | 7519 `lc` | `sv()` → `lc` | new invoice numbers |
| `invoiceUidCtr` | number | 7533 `laegh_invoice_uid_ctr` | `persistInvoiceUidCtr` | `nextInvoiceId` |
| `phonebook` | array | 7523 `lb` | `sv()` → `lb` | phonebook UI; `pb` is alias (16056) |
| `acH` | object | 7524 `la` | `sv()` → `la` | accounting history |
| `senderInfo` | object | 7525 `ls` | postal UI / Restore → `ls` | postal form |
| `logoSrc` | string | 7526 `ll` | Restore → `ll` | sidebar logo |
| `parts` | array | 16050 `lp2` | `svParts()` 17123 | parts UI |
| `services` | array | 16051 `ls2` (JSON default catalog if empty) | `svSvcs()` 17124 | services UI; `svcs` alias 16065 |
| `warranties` | array | 16052 `lw2` | `svWarr()` | warranty UI |
| `tasks` | array | 16057 `laegh_tasks` | `svTasks()` 15494 (+ IDB mirror **after** LS; not read here) | tasks UI |
| `defectiveStock` | array | 16058 `laegh_defective` | `svDefective()` 17889 | defective UI |
| `userAuditLog` | array | 16059 `laegh_audit_user` | `saveAudit()` 17608 | audit UI |
| `bgAuditLog` | array | 16060 `laegh_audit_bg` | 17650 | background audit |
| `accounts` | array | declared `[]` at 16069; IIFE load `laegh_accounts` 23643–23646 | `svAccounts()` 23637 | accounts UI |
| `warehouseDocs` | array | 16072 `laegh_warehouse` | warehouse persist | warehouse docs |
| `stockMoves` | array | 16073 `laegh_stockmoves` | stock persist | stock moves |
| `userRoles` | array | 16150 `laegh_roles` via `normalizeAppUsers` | `svRoles()` 16168 | login / ACL |
| `loginPw` | string | 16152 `laegh_login_pw` | login setters 16835 / Restore 14983 | login overlay |
| `sales` | array | 22094 `laegh_sales` | `svSales()` 22185 | sales UI |
| `saleCtr` | number | 22095 `laegh_sale_ctr` (default **0**) | `svSales` | sale numbers |
| `saleUidCtr` | number | 22096 `laegh_sale_uid_ctr` | `persistSaleUidCtr` | `nextSaleUid` |
| `postalHistory` | array | 14056–14057 `laegh_postal_history` | `svPostalHistory` | postal history |
| `warehouses` | array | `initWarehouses` 18897–18919 `laegh_warehouses`; **boot-writes six defaults** if empty | `svWarehouses` 18921 | warehouse entities |
| `daqiWarehouse` | array | 23011–23013 `laegh_daqi_warehouse` | `svDaqiWarehouse` | daqi warehouse |
| `daqiVouchers` | array | 23012–23014 `laegh_daqi_vouchers` | `svDaqiVouchers` | daqi vouchers |
| `daqi` | array | `initDaqi` 23153–23158 `laegh_daqi` | `svDaqi` | daqi tracking |
| `TZ` | string | 10493 `laegh_tz` or `'Asia/Tehran'` | `setTimeZone` writes both | **not read by assembler** |

`svcs` is not a separate RAM store. At T15 it is the same `services` array.

`itemCounts` (T70–T84) re-reads the **same RAM globals**, not `data.invoices.length`. In this synchronous function those lengths match T5–T24 unless a getter on a live object mutates arrays (none in this path).

---

## 3. localStorage inventory

Reads during assembly only (not boot, not Restore).

| Exact key | How | Default if missing | RAM equivalent? | Can LS ≠ RAM? |
|---|---|---|---|---|
| `laegh_applied_updates` | `getAppliedUpdatesMeta` | `[]` | no dedicated RAM | n/a (LS-only) |
| `laegh_upd_pkg_<id>` | `collectUpdatePackagesForBackup` | skip if absent | no | n/a |
| `laegh_printSettings` | direct `getItem` + parse; **also** fallback inside `getPrintCenterState` via `getPrintSettings` | `{}` / `PS_DEFAULTS` only in `getPrintSettings`, **not** in T34 | no RAM SoT; print UI reads LS | T34 empty `{}` vs later `_center` fallback |
| `laegh_company` | direct | `{}` | **no** — `getCompanyData()` is also LS (7492) | n/a |
| `laegh_service_center` | direct | `{}` | no RAM SoT | n/a |
| `laegh_starred_alarms` | `getStarredAlarms` | `[]` then catalog merge | no | n/a |
| `laegh_skin` … `laegh_dash_hide_widgets` | direct appearance | `''` | no RAM SoT (DOM/CSS applied from LS) | n/a |
| `laegh_sms` | direct | `{}` | no | n/a |
| `laegh_tz` | direct | `'Asia/Tehran'` | **yes: `TZ`** (10493). Assembler reads **LS**, not `TZ`. | only if `TZ` assigned without `setTimeZone` — source only assigns TZ in `setTimeZone`, which also writes LS |
| `laegh_network` | `loadNetworkSettings` | parse empty → port/role defaults | no | n/a |
| `PREF_KEYS` (9146) | `collectPrefsBundle` — only keys with non-null values | omit key | overlaps appearance / tz | same LS; second read of same keys |
| `laegh_ai_key_*` + four named AI keys | full-key scan | omit | no | n/a |
| `laegh_printCenter` (`PC_KEY`) | `getPrintCenterState` | `printSettings._center` then `printCenterDefaultState()` | no | n/a |

`collectPrefsBundle` does **not** read `laegh_prefs_bundle`. That bundle is a persist cache for `persistPrefsBundle` (async / IDB / Host) and is **outside** this assembler.

Boot-time LS keys for RAM (`li`, `lp`, `lv`, `lb`, `la`, `lc`, `ls`, `ll`, `lp2`, `ls2`, `lw2`, `laegh_tasks`, …) are **not** re-read during assembly.

---

## 4. Split-brain matrix

Class: **A** RAM-only (assembly) · **B** LS-only · **C** same logical setting in RAM and LS · **D** derived · **E** default overlay.

| Field | Class | Notes |
|---|---|---|
| `magic`, `schemaVersion` | E (constant) | compile-time globals |
| `version`, `applicationVersion` | E (literal) | hardcoded `'1405.6.3α'` |
| `exportedAt` | D | clock now |
| `invoices` `products` `inventory` `phonebook` `parts` `services` `warranties` `sales` `tasks` `accounts` `defectiveStock` `warehouseDocs` `stockMoves` `warehouses` `daqi` `userAuditLog` `bgAuditLog` `userRoles` `senderInfo` `logoSrc` `acH` | **C** | assembly reads **RAM**; LS is persist mirror (`sv` / dedicated `sv*`) |
| `svcs` | A alias / D duplicate | same RAM as `services`; after clone, independent copy of same content |
| `daqiWarehouse` `daqiVouchers` `postalHistory` | **C** | RAM; persist via `svDaqi*` / `svPostalHistory`; T25–T27 skip `_safeArr` |
| `invCtr` `invoiceUidCtr` `saleCtr` `saleUidCtr` | **C** + **E** | RAM counters; assembly may coerce `invCtr\|\|1`, `saleCtr` default **1** even if RAM boot is 0 |
| `appliedUpdates` `updatePackages` | B | LS |
| `loginPw` | **C** | assembly reads **RAM**; LS `laegh_login_pw` is persist (login/Restore write both) |
| `printSettings` | B | LS `laegh_printSettings` |
| `company` | B | LS `laegh_company` — no RAM global |
| `serviceCenter` | B | LS |
| `starredAlarms` | B + **D** | LS raw + catalog merge |
| `appearance.*` | B + **E** | LS strings or `''` |
| `sms` | B | LS |
| `tz` | **C** + **E** | assembly **LS** (`laegh_tz`); RAM `TZ` exists; default `'Asia/Tehran'` |
| `networkSettings` | B + **D** | LS + `parseNetworkSettings` |
| `prefs` | B | LS `PREF_KEYS`; **duplicates** many appearance keys + `laegh_tz` |
| `aiKeys` | B | LS scan |
| `itemCounts` | D | second RAM length pass |
| `sections` | E (literal) + D (`printCenter` push) | catalog, not a live inventory of object keys |
| `printCenter` | B + **E**/**D** | LS `laegh_printCenter` or nested `_center` or profile defaults |
| `attachmentsIndex` | D | walk of `data` arrays |

### 4.1 Class C — who is authoritative **today** (do not invent a new authority)

| Logical setting | Authority used by `_buildFullBackupData` today | Persist / other reader |
|---|---|---|
| invoices, products, inventory, phonebook, acH, invCtr, invoice uid | **RAM** | LS via `sv()` / `persistInvoiceUidCtr`. If RAM dirty and `sv` not yet called, backup follows RAM. If another tab wrote LS, this tab’s backup still follows **this tab’s RAM**. |
| parts / services / warranties / sales / tasks / defective / warehouse docs / stock moves / daqi* / postal / warehouses / accounts / roles / loginPw / senderInfo / logoSrc | **RAM** | matching `sv*` / Restore dual-write |
| `tz` field | **localStorage `laegh_tz`** | RAM `TZ` is the live clock authority for `fdate`/`fdt`, but assembler does not read `TZ` |
| company, printSettings, appearance, sms, network, prefs, aiKeys, starredAlarms, printCenter, appliedUpdates | **localStorage** (plus HTML normalize/defaults on read) | no RAM SoT |

`prefs` vs `appearance` vs `tz`: three payload fields, **one LS store**. Not RAM vs LS. Sequential `getItem` of the same keys. No helper in this path writes those keys, so they match in one call.

`printSettings` vs `printCenter`: two LS keys (`laegh_printSettings`, `laegh_printCenter`). `savePrintCenterState` copies center into `printSettings._center`. Assembler may therefore embed print-center state **twice** (full `printSettings` object possibly containing `_center`, plus top-level `printCenter`). Authority for the `printCenter` **field** is `getPrintCenterState` (PC_KEY first). Authority for the `printSettings` **field** is the T34 parse of `laegh_printSettings` (no `PS_DEFAULTS` fill).

---

## 5. Authority findings

1. Business documents: **RAM is the backup source**. LS is a persist mirror. This is the ARCH-9A split-brain: a crash between RAM mutation and `sv()` yields a backup that is **newer** than LS; a backup from a stale tab after another tab wrote LS yields **older** RAM than disk LS.
2. Settings (company, print, appearance, SMS, network, prefs, AI keys, starred alarms, print center, applied updates): **LS is the backup source**. There is no parallel RAM object for company.
3. Timezone is split: live clock uses RAM `TZ`; backup `tz` uses LS. Today `setTimeZone` writes both; assembler still does not read `TZ`.
4. `itemCounts` is not an independent store; it is a derived checksum-like metadata field from RAM lengths.
5. `sections` is a **catalog**, not an enumeration of keys actually present (`warehouseDocs` / `stockMoves` / `prefs` / `svcs` are stored but omitted from the initial catalog).
6. Do not promote Core, Host, or IndexedDB as a new authority. Tasks IDB is a mirror written by `svTasks` and is **not** read here.

---

## 6. Async / concurrency analysis

### 6.1 Is `_buildFullBackupData` synchronous?

**YES.** Evidence:

- Declaration is `function _buildFullBackupData()` — not `async` (8473).
- Body contains no `await`, `Promise`, `then`, `setTimeout`, `setInterval`, `queueMicrotask`, `requestAnimationFrame`, `FileReader`, `indexedDB`, `fetch`, Host (`getSirmanHostSync` / `sirmanHost`), or DOM mutation.
- Callees on this path are ordinary functions:
  - `_safeArr` / `_safeObj` / `_safeStr`
  - `getAppliedUpdatesMeta`, `collectUpdatePackagesForBackup`
  - `getStarredAlarms` → `normalizeStarredAlarms` → `starredAlarmCatalog`
  - `loadNetworkSettings` → `parseNetworkSettings`
  - `collectPrefsBundle`
  - `getPrintCenterState` → maybe `getPrintSettings` / `printCenterDefaultState`
  - `collectAttachmentIndex` → `isDiskRef` (9322, string prefix check)
  - `JSON.parse` / `JSON.stringify`
- Nearby **async** functions (`exportData` 14302, `attachChecksum`, `persistPrefsBundle` 9160, `openUpdatesIDB` 6831) are **not** called from the assembler. `exportData` awaits **after** `_buildFullBackupData()` returns.

### 6.2 Can another async operation interleave **during** assembly?

**NO, on this thread.** One JS call stack runs to completion. Event-loop tasks (input handlers, autosave timer, StorageEvent from another tab, IDB callbacks) wait until this function returns.

Caveats that do **not** create an in-function yield, but limit the word “atomic”:

- **Other tabs / windows** can write the same origin `localStorage` concurrently at the OS/browser level. This thread will not see a StorageEvent until later. T34–T69 are sequential `getItem`s; a theoretical external writer between T34 and T69 could make `printSettings` and `appearance` reflect different instants. Source cannot prove that cannot happen. It also cannot prove it happens.
- **`JSON.stringify` `toJSON`**: if a live object defined `toJSON` that mutated state, stringify could observe a moving target. Product collections in this file do not attach `toJSON`.
- **Getters** on live arrays: none identified on `invoices` / `warranties` / etc.
- After return, `exportData` is async (checksum, Host finalize, disk). Mutations **after** the clone do not change the returned snapshot (ARCH-9D).

`getPrintCenterState` does **not** write LS. `savePrintCenterState` writes `laegh_printCenter` and `laegh_printSettings`; it is not on this path.

---

## 7. Default / derived analysis

Do not change these. Classification of **what assembly produces**, not what boot persisted.

| Topic | What happens | Kind |
|---|---|---|
| warehouses boot defaults | `initWarehouses` (18897–18919): if LS empty, **writes** six named warehouses to RAM **and** `laegh_warehouses` at boot | **persisted at boot**, then RAM-read at assembly. Not derived inside `_buildFullBackupData`. |
| starredAlarms catalog merge | `normalizeStarredAlarms` overlays `starredAlarmCatalog()` titles/hints/defaults onto LS rows | **derived at assembly** every backup. Catalog `defaultOn` / `defaultDays` fill missing fields. |
| networkSettings | `parseNetworkSettings`: invalid port → `SIRMAN_LAN_PORT` or **8765**; role normalized; flags coerced | **derived at assembly** from LS |
| printCenter | missing key → `_center` from printSettings → else `printCenterDefaultState()` + `PRINT_PROFILE_DEFAULTS` merge | **runtime defaults at read**; not persisted unless some other code saved |
| `tz` | missing LS → `'Asia/Tehran'` | **assembly default** (same string as boot `TZ`) |
| counters | `invCtr\|\|1`; `saleCtr` if not `>0` → **1** (boot LS default is **0**); uid ctrs → 0 | **assembly default overlay** on RAM |
| appearance | each key `\|\|''` | **assembly default** empty string (distinct from omitting the key) |
| `prefs` | omit null keys | persisted-only subset, no fill |
| `itemCounts` | `.length` of RAM arrays | **derived** |
| `sections` | literal 32 names + optional `printCenter` | **catalog / derived** |
| `exportedAt` | `toISOString()` | **generated now** |
| `attachmentsIndex` | walk docs | **derived** |
| services boot JSON | four default service rows if `ls2` empty (16051) | **persisted at first boot**, then RAM |

---

## 8. Attachment consistency

`collectAttachmentIndex(d)` **7709–7740**:

- Walks **only** `d.warranties`, `d.sales`, `d.invoices`.
- Does **not** name live globals (`warranties`, `sales`, `invoices`).
- Does **not** read localStorage / IDB / disk.
- `isDiskRef` inspects the string prefix `disk://` (and `idb:` / `disk:` in `pushDoc`).
- Does not mutate `d` or the arrays.

Call site T88 passes the in-progress `data` object **before** the clone. At that moment `data.invoices` still **aliases** live RAM (`_safeArr` returned the live array). Walking therefore observes the same arrays assigned at T5/T16/T17.

Because the function is synchronous and `collectAttachmentIndex` does not mutate, the index matches those three arrays as they exist at T88. T89 then clones **both** the arrays and the index together.

Inconsistencies that **remain possible** (not caused by a second RAM fetch):

1. Attachments on `parts`, `tasks`, `warehouseDocs`, etc. are **not indexed**.
2. T25–T27 non-array values would not be walked here anyway (wrong collections).
3. If a document’s `docs` changes **after** return, the cloned snapshot is already isolated (ARCH-9D).
4. Index stores `ref` only for disk/idb strings; inline payloads set `inline: true` and empty `ref`. That is by design in this helper, not a second source.

---

## 9. Secret fields

Do not remove. Do not redesign security in this packet.

| Field | Source | Restore | Contract vs incidental |
|---|---|---|---|
| `loginPw` | RAM `loginPw` (from `laegh_login_pw` at boot; login writes both) | Restore writes RAM + LS (14983) if section selected | **Intentional Backup contract.** Listed in backup section catalog (14733). Needed for HTML-only login after Replace. |
| `aiKeys` | LS scan of API keys, custom URL/model, purpose | Restore `setItem` per key (15029–15030) | **Intentional Backup contract.** Catalog 14745. Payload so AI settings survive Restore. |

`userRoles[].pw` / `twoFactorSecret` ride inside the `userRoles` array (RAM). Same intentional-payload pattern; not stripped by the assembler.

The JSON backup is **not** encrypted by `_buildFullBackupData`. Encryption, if any, is a later `exportData` option (`isBackupEncryptPreferred` 14292). Secrets are plaintext in the snapshot object at return.

---

## 10. Snapshot consistency classification

**Best-effort synchronous assembly.**

Not proven:

- OS-atomic snapshot
- Cross-tab atomic snapshot
- Single-store snapshot (RAM and LS mixed)
- Logical freeze of all keys at `exportedAt`

Proven:

- No async yield inside the function
- Return value is a deep JSON clone (ARCH-9D), so later RAM/LS mutation does not alias into the object
- `itemCounts` and `attachmentsIndex` are computed in the same turn as the array reads they describe

`exportedAt` is the clock at T4, **before** LS settings reads. It labels the start of assembly, not a commit timestamp after clone.

---

## 11. Proposed DTO boundary (do not implement)

```text
HTML Source Reader          ← KEEP in HTML / WebView adapter
      ↓  one synchronous turn
immutable Snapshot DTO      ← JSON clone already returned at T89
      ↓
Sirman.Core                 ← Validator / Migrator / Finalizer / DryRun / Consume
```

### What must be read in HTML

Everything that exists only in the page:

- live RAM collections and counters listed in §2
- `localStorage` keys listed in §3
- clock for `exportedAt` (or pass it in; do not let Core invent a second `exportedAt`)
- today’s HTML normalizers if the DTO must match current files: starred-alarm catalog merge, `parseNetworkSettings`, print-center profile fill

Host cannot see RAM. Core cannot see `localStorage`. Splitting RAM vs LS into two Host round-trips would **insert an await** and **worsen** consistency. The reader must stay one synchronous HTML turn.

### What should be passed as immutable data

The post-clone object already returned:

- collections, counters, settings, `exportedAt`, `itemCounts`, `sections`, optional `printCenter`, `attachmentsIndex`
- no functions, no live aliases, no `window`, no Host handles

### What Core can safely derive

Already derived in Core Finalizer today: manifest, `sectionChecksums`, canonical SHA-256 (excluding `exportedAt` / `checksum` / `checksumAlgo`). Core may recompute `attachmentsIndex` from the DTO arrays (HTML Finalizer path already does). Core must **not** re-read HTML RAM/LS.

### What must remain runtime / adapter-owned

- `localStorage` / IndexedDB / File System Access / WebView2 disk paths
- live globals, DOM, Print Center UI (frozen print)
- Restore Merge/Replace apply
- Phonebook engine
- SQLite sidecars (not on this path)

---

## 12. Extraction risks

1. **Extracting `_buildFullBackupData` into Core** requires Host to serialize RAM+LS first — that **is** the reader. Moving the function without moving the reads is impossible. Moving the reads across an async Host boundary **creates** the interleaving this audit shows is currently absent.
2. **Two-phase read** (Core asks HTML for invoices, then later for appearance) would be a consistency regression.
3. **Re-reading LS for `itemCounts`** or switching `itemCounts` to `data.*` is a production behavior change; out of scope.
4. **`daqiWarehouse` / `daqiVouchers` / `postalHistory` without `_safeArr`** vs `itemCounts` with `_safeArr`: if a non-array ever sat in RAM, payload and counts would disagree. Boot always assigns arrays.
5. **`printCenter` is assembled but `applyBackupReplaceSections` does not write `d.printCenter` to `laegh_printCenter`.** Catalog lists it (14734). Restore still applies `printSettings`. Do **not** fix Restore in this packet; flag as a later Restore-contract risk.
6. **`prefs` Restore** applies `d.prefs` without `_restoreWants` (15026–15028). Appearance keys can be written twice (from `appearance` and `prefs`). Out of scope.
7. **Starred-alarm catalog merge** means backups are not raw LS; restoring a file into a future catalog can reshape rows. Keep merge in the HTML reader until a packet freezes the on-disk shape.
8. **Secrets** in plaintext JSON. Extraction must not “clean” them; Restore depends on them.
9. **`JSON.stringify` clone** drops `undefined`, fails on circular refs / BigInt. Fail-closed (export throws) rather than partial snapshot — keep that property.
10. Phonebook / SQLite / `resetAll` are unrelated; touching them to “help” backup is forbidden.

---

## 13. Exact first production extraction candidate

**Do not extract `_buildFullBackupData`.**

Safest **first** production extraction after this audit (still a later packet, not ARCH-13 / not ARCH-14 unless explicitly ordered):

> **Core Snapshot DTO contract** = the JSON object already returned at T89 (field list + types), consumed by existing Finalizer / Validator / Consumer. No new HTML reads. No Restore cutover.

If a later packet must extract **HTML** code (not Core): the first **slice** that does not alias live business arrays is the **LS-only settings bundle** (T34–T69 + T86): `printSettings`, `company`, `serviceCenter`, `starredAlarms`, `appearance`, `sms`, `tz`, `networkSettings`, `prefs`, `aiKeys`, `printCenter`. Keep invoices/phonebook/parts/… in the HTML assembler so business RAM stays one turn.

**Not** a candidate: Restore Merge/Replace, Phonebook, SQLite, checksum redesign, removing secrets, P1C-8.

---

## 14. Confirmation

| Item | Result |
|---|---|
| `_buildFullBackupData` / `_safeArr` / `_safeObj` / `exportData` / `buildBackupObject` / Finalizer / Restore / Merge / Replace | **not modified** |
| Phonebook | **not modified** |
| SQLite | **not modified** |
| Host | **not modified** |
| Live shop data | **not touched** |
| Version `1405.6.3α` | **unchanged** |
| ARCH-14 / Restore cutover / P1C-8 | **not started** |

Only this report file is added.

---

## Q1–Q14

**Q1. Is `_buildFullBackupData` fully synchronous?**  
**YES.** Not `async`; no `await`/Promise/timer/FileReader/IDB/Host/DOM on the path. Callees listed in §6 are sync.

**Q2. Are RAM reads and LS reads mixed?**  
**YES.** T5–T27 and T30–T33 and T38–T40 are RAM; T28–T29 and T34–T37 and T41–T69 and T86 are localStorage (plus helpers). Same object literal.

**Q3. Are there duplicate logical settings in RAM and LS?**  
**YES.** Business collections: RAM vs persist keys (`li`/`lb`/…). Timezone: RAM `TZ` vs LS `laegh_tz`. Appearance keys also appear in `prefs`. Print center may also sit in `printSettings._center`. `svcs` duplicates `services`.

**Q4. Which source is authoritative for each duplicate?**  
**Business collections / loginPw / logo / sender / acH: RAM.**  
**tz backup field / company / printSettings / appearance / prefs / sms / network / aiKeys / starredAlarms / printCenter / appliedUpdates: localStorage** (with HTML normalize/defaults on some reads).  
**Live clock: RAM `TZ`** — not used by the assembler.

**Q5. Can another async operation interleave with assembly?**  
**NO** on this JS thread. Other tabs can write LS at the browser level without this function yielding; that is not an in-function async boundary.

**Q6. Are defaults derived during assembly?**  
**YES.** Clock `exportedAt`; counter fallbacks; appearance `''`; tz `'Asia/Tehran'`; starred-alarm catalog; network port/role; print-center profiles; `itemCounts`; `sections`; `attachmentsIndex`. Warehouses six-row set is **boot persist**, not assembly.

**Q7. Does `collectAttachmentIndex` use only snapshot data?**  
**YES** as a reader of `d.*`. At call time `d` still aliases live RAM arrays. It does not fetch a second global or LS. After T89 both index and arrays are cloned together.

**Q8. Is the current snapshot truly point-in-time atomic?**  
**NO.** Best-effort synchronous assembly. Mixed RAM+LS; `exportedAt` at T4; second RAM pass for counts; clone at T89. No OS/cross-tab atomicity proof.

**Q9. What minimum immutable Snapshot DTO is needed?**  
The T89 JSON clone: magic, schemaVersion, version, applicationVersion, exportedAt, all collections currently assigned, counters, settings fields in §4, itemCounts, sections, optional printCenter, attachmentsIndex. No live refs.

**Q10. What is the safest first production extraction?**  
**Do not extract `_buildFullBackupData`.** First candidate: Core DTO/contract for that clone (Finalizer already consumes it). First HTML slice if required later: LS-only settings (T34–T69+T86).

**Q11. Did any code change?**  
**NO.** Report only. Assembler SHA-256 remains `f65d8f393d91de7e984540060ceec6deb14976d9dce4bd7b82261d2e69c5df5f`.

**Q12. Did live data change?**  
**NO.** No shop DB, no `localStorage` writes, no Restore apply.

**Q13. Did Phonebook change?**  
**NO.**

**Q14. Did SQLite change?**  
**NO.**

---

## Stop line

ARCH-13 ends here. Do not extract the assembler. Do not start ARCH-14. Do not cut over Restore. Do not start P1C-8.
