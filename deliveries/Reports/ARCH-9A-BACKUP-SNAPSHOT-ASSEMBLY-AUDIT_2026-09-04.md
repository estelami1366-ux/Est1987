# SIRMAN — ARCH-9A Backup Snapshot Assembly Boundary Audit

**Date:** 2026-09-04  
**Packet:** Read-only architecture audit of `_buildFullBackupData`. **No extraction. No code change.**  
**Product version:** `1405.6.3α` (unchanged)  
**Branch:** `cursor/arch-9a-backup-snapshot-assembly-audit-fa01`  
**Base:** `cursor/arch-8-core-restore-plan-fa01`  
**Authority:** `Sirman_Final.html` lines cited below. Do not infer.

---

## Phase 3 Change Gate

```text
CHANGE: ARCH-9A read-only assembly-boundary audit
CLASS: Documentation only. No implementation.
Q1: CAPABILITY — none. Report only.
Q2: RunBusiness / Host: NO
Q3: Persistence: NO
Q4: Printing: NO
Q5: HTML-only: PRESERVED — HTML not modified
Q6: New transport/DB/ACL: NO
RESULT: PASS (audit). Implementation of extraction is BLOCK until a later packet.
AUTHORITY: explicit user packet ARCH-9A 2026-09-04
```

This packet does **not** extract `_buildFullBackupData`, start Restore cutover, implement Merge/Replace, or touch Phonebook / SQLite / `resetAll`.

Verified incoming baseline (ARCH-8, not re-run here because no product code changed): HTML 799/799, Core 514/514.

---

## 1. Full `_buildFullBackupData` call graph

### 1.1 Definition

`Sirman_Final.html` `function _buildFullBackupData()` at **8457–8573**.

Helpers in the same file:

| Helper | Lines | Role |
|---|---|---|
| `_safeArr` | 7639 | `Array.isArray(a)?a:[]` — **returns the live array, not a clone** |
| `_safeObj` | 7640 | `(o && typeof o==='object')?o:{}` — **live object, not a clone** |
| `_safeStr` | 7641 | nullish → `''` |
| `getAppliedUpdatesMeta` | 6809–6815 | `localStorage['laegh_applied_updates']` |
| `collectUpdatePackagesForBackup` | 6819–6828 | LS `laegh_upd_pkg_` + meta ids |
| `getStarredAlarms` | 25992–25996 | LS + `normalizeStarredAlarms` |
| `normalizeStarredAlarms` | 25976–25990 | catalog merge (`starredAlarmCatalog`) |
| `loadNetworkSettings` | 28039–28041 | LS `laegh_network` → `parseNetworkSettings` |
| `parseNetworkSettings` | 27953–27966 | coerce role/port/folder |
| `collectPrefsBundle` | 9131–9136 | `PREF_KEYS` localStorage |
| `getPrintCenterState` | 24692–24709 | LS `laegh_printCenter` (`PC_KEY`), fallback `getPrintSettings()._center` |
| `getPrintSettings` | 24482–24484 | LS `laegh_printSettings` (`PS_KEY`) |
| `printCenterDefaultState` | 24680–24690 | `PRINT_PROFILE_DEFAULTS` |
| `collectAttachmentIndex` | 7709–7740 | walk `warranties` / `sales` / `invoices` docs |

Constants read: `SIRMAN_BACKUP_MAGIC` (7649), `SIRMAN_SCHEMA_VERSION` (7648). Version strings at 8461–8462 are **literals** `'1405.6.3α'`, not `APP_VERSION`.

### 1.2 Callers (complete from source)

```text
safePersist (7447)
    → doAutoSave(true)                 [separate path: buildBackupObject]
    → mirrorBackupToIDB(_buildFullBackupData())     7452–7453

buildBackupObject (8576)
    → _buildFullBackupData()
    → d.autoSave=true; d.origin='autosave'
    → applyBackupFinalizer / finalizeBackupPackage     NOT assembly

exportData (14286)
    → _buildFullBackupData()
    → origin='manual'
    → optional selective delete of non-selected keys
    → applyBackupFinalizer                             NOT assembly

exportArchiveBackup (14385)
    → _buildFullBackupData()
    → origin='archive'; immutable=true
    → applyBackupFinalizer                             NOT assembly

applyBackupSelective (14878)
    → safety = _buildFullBackupData()                  pre-restore snapshot
    → saveSafetySnapshot(safety)

publishNetworkWorkspace (28155)
    → _buildFullBackupData()
    → origin='network-workspace'
    → host.WriteWorkspaceFile(JSON.stringify(data))    no Finalizer in this path
```

`importData` does **not** call `_buildFullBackupData`. Restore apply remains HTML Merge/Replace.

### 1.3 What assembly does **not** call

Exact source of `_buildFullBackupData` contains **no**:

- `indexedDB` / `openBackupIDB` / `openUpdatesIDB`
- `document` / DOM
- `sirmanHost` / WebView2
- `Date.now()` (uses `new Date().toISOString()` instead)
- `Math.random` / `backupId`
- `sv()` / `svWarr()` / `render*`
- `applyBackupMergeSections` / `applyBackupReplaceSections`
- `finalizeBackupPackage` / checksum / manifest (those are **after** assembly)

IndexedDB may already have been copied **into RAM records** (`docs` with `idb:` / `disk:` refs). Assembly only indexes those strings via `collectAttachmentIndex`. It does not open IDB.

---

## 2. Complete input inventory

Classification:

- **A** — pure data already available (constants / literals)
- **B** — browser storage read (`localStorage.getItem` during assembly)
- **C** — live RAM / global state
- **D** — derived business calculation
- **E** — UI / runtime state
- **F** — unknown (none found in this function)

| Input | Source | Current type | Read method | Class | Browser dep. | Business meaning | Candidate DTO field | Risk |
|---|---|---|---|---|---|---|---|---|
| `SIRMAN_BACKUP_MAGIC` | const 7649 | string | global const | A | no | package magic | `magic` | LOW |
| `SIRMAN_SCHEMA_VERSION` | const 7648 | number `1` | global const | A | no | schema | `schemaVersion` | LOW |
| `version` / `applicationVersion` | string literal 8461–8462 | string | hardcoded, **not** `APP_VERSION` | A/E | no | app version | `version` | MEDIUM — can drift from `APP_VERSION` |
| `exportedAt` | `new Date().toISOString()` 8463 | string ISO | clock | E | Date | export stamp | `exportedAt` | HIGH — non-deterministic |
| `invoices` | RAM; boot `localStorage['li']` 7520 | array | `_safeArr(invoices)` | C | boot LS | invoices | `invoices` | HIGH — live ref |
| `products` | RAM `lp` 7521 | array | `_safeArr` | C | boot LS | products | `products` | HIGH |
| `inventory` | RAM `lv` 7522 | object | `_safeObj` | C | boot LS | stock map | `inventory` | HIGH |
| `invCtr` | RAM `lc` 7519 | number | `invCtr\|\|1` | C | boot LS | next invoice num | `invCtr` | MEDIUM — `0` coerced to `1` |
| `invoiceUidCtr` | RAM 7533 | number | `>0 ? x : 0` | C | boot LS | INVUID counter | `invoiceUidCtr` | LOW |
| `saleCtr` | RAM 22079 | number | `>0 ? x : 1` | C | boot LS | next sale num | `saleCtr` | MEDIUM — missing → `1` |
| `saleUidCtr` | RAM 22080 | number | `>0 ? x : 0` | C | boot LS | SALEUID counter | `saleUidCtr` | LOW |
| `phonebook` | RAM `lb` 7523 | array | `_safeArr(phonebook)` | C | boot LS | contacts | `phonebook` | HIGH — `pb` **not** read |
| `parts` | RAM `lp2` 16034 | array | `_safeArr` | C | boot LS | parts | `parts` | HIGH |
| `services` | RAM `ls2` 16035 | array | `_safeArr(services)` | C | boot LS | services | `services` | HIGH |
| `svcs` | alias `svcs=services` 16049 | array | `_safeArr(services)` same RAM | C | boot LS | legacy alias | `svcs` | MEDIUM — duplicate pointer |
| `warranties` | RAM `lw2` 16036 | array | `_safeArr` | C | boot LS | warranties | `warranties` | HIGH |
| `sales` | RAM `laegh_sales` 22078 | array | `_safeArr` | C | boot LS | sales | `sales` | HIGH |
| `tasks` | RAM `laegh_tasks` 16041 | array | `_safeArr` | C | boot LS | tasks | `tasks` | HIGH |
| `accounts` | RAM; boot `laegh_accounts` 23628 | array | `_safeArr` | C | boot LS | accounts | `accounts` | HIGH |
| `defectiveStock` | RAM `laegh_defective` 16042 | array | `_safeArr` | C | boot LS | defective | `defectiveStock` | HIGH |
| `warehouseDocs` | RAM `laegh_warehouse` 16056 | array | `_safeArr` | C | boot LS | warehouse docs | `warehouseDocs` | HIGH — **not in `sections`** |
| `stockMoves` | RAM `laegh_stockmoves` 16057 | array | `_safeArr` | C | boot LS | stock moves | `stockMoves` | HIGH — **not in `sections`** |
| `warehouses` | RAM `laegh_warehouses` 18884 | array | `_safeArr(typeof warehouses!=='undefined'?warehouses:[])` | C | boot LS | named warehouses | `warehouses` | HIGH — boot may seed defaults **before** assembly |
| `daqi` | RAM `laegh_daqi` 23138 | array | `_safeArr(typeof daqi!=='undefined'?daqi:[])` | C | boot LS | daqi receipts | `daqi` | HIGH |
| `daqiWarehouse` | RAM `laegh_daqi_warehouse` 22997 | array | **raw** `typeof!=='undefined'?x:[]` — **not** `_safeArr` | C | boot LS | daqi stock | `daqiWarehouse` | HIGH — non-array not coerced |
| `daqiVouchers` | RAM `laegh_daqi_vouchers` 22998 | array | raw, not `_safeArr` | C | boot LS | daqi vouchers | `daqiVouchers` | HIGH |
| `postalHistory` | RAM `laegh_postal_history` 14041 | array | raw, not `_safeArr` | C | boot LS | postal history | `postalHistory` | HIGH |
| `appliedUpdates` | `getAppliedUpdatesMeta()` | array | LS parse | B | LS | update history | `appliedUpdates` | MEDIUM — **not in `sections`** |
| `updatePackages` | `collectUpdatePackagesForBackup()` | array | LS per id | B | LS | slim update pkgs | `updatePackages` | MEDIUM — **not in `sections`**; HTML bodies may be slimmed at **store** time, not here |
| `userAuditLog` | RAM `laegh_audit_user` 16043 | array | `_safeArr` | C | boot LS | user audit | `userAuditLog` | MEDIUM |
| `bgAuditLog` | RAM `laegh_audit_bg` 16044 | array | `_safeArr` | C | boot LS | bg audit | `bgAuditLog` | MEDIUM |
| `userRoles` | RAM `laegh_roles` 16134 | array | `_safeArr` | C | boot LS | users/roles | `userRoles` | HIGH |
| `loginPw` | RAM `laegh_login_pw` 16136 | string | `_safeStr` | C | boot LS | login password | `loginPw` | HIGH — secret in snapshot |
| `printSettings` | LS `laegh_printSettings` **during assembly** 8496 | object | `JSON.parse(getItem\|\|'{}')` then `_safeObj` | B | LS | print settings | `printSettings` | HIGH — not RAM `ps` |
| `company` | LS `laegh_company` 8497 | object | same | B | LS | shop brand | `company` | HIGH |
| `serviceCenter` | LS `laegh_service_center` 8498 | object | same | B | LS | service center | `serviceCenter` | HIGH |
| `starredAlarms` | `getStarredAlarms()` | array | LS + catalog normalize | B+D | LS | starred alarms | `starredAlarms` | MEDIUM — catalog fills missing ids |
| `senderInfo` | RAM `ls` 7525 | object | `_safeObj` | C | boot LS | postal sender | `senderInfo` | HIGH |
| `logoSrc` | RAM `ll` 7526 | string | `_safeStr` | C | boot LS | shop logo data URL | `logoSrc` | HIGH — large |
| `acH` | RAM `la` 7524 | object | `_safeObj` | C | boot LS | accounting history | `acH` | HIGH |
| `appearance.*` | 24 LS keys 8504–8528 | strings | `getItem\|\|''` | B | LS | UI chrome | `appearance` | MEDIUM — empty string ≠ missing |
| `sms` | LS `laegh_sms` 8531 | object | parse + `_safeObj` | B | LS | SMS panel | `sms` | MEDIUM |
| `tz` | LS `laegh_tz` 8532 | string | `getItem\|\|'Asia/Tehran'` | B | LS | timezone | `tz` | MEDIUM — default if missing |
| `networkSettings` | `loadNetworkSettings()` | object | LS + parse/normalize | B+D | LS | LAN settings | `networkSettings` | MEDIUM |
| `prefs` | `collectPrefsBundle()` | object | subset of LS keys if present | B | LS | prefs overlay | `prefs` | MEDIUM — **not in `sections`**; overlaps appearance |
| `aiKeys` | IIFE 8536–8548 | object | scan `localStorage.key(i)` | B | LS | AI secrets | `aiKeys` | HIGH — secrets; scan can throw (caught → `{}`) |
| `itemCounts.*` | derived 8550–8566 | numbers | `_safeArr(...).length` | D | via C | declared counts | `itemCounts` | HIGH — must match arrays |
| `sections` | literal 8567 + optional `printCenter` | string[] | hardcoded | A/D | no | checksum key list | `sections` | HIGH — incomplete vs emitted keys |
| `printCenter` | `getPrintCenterState()` 8569 | object | LS + defaults | B+D+E | LS | print center (frozen print module) | `printCenter` | MEDIUM — try/catch omit |
| `attachmentsIndex` | `collectAttachmentIndex(data)` 8571 | array | derived from RAM docs | D | no extra API | attachment catalog | `attachmentsIndex` | HIGH — rebuilt again in Finalizer |

**IndexedDB during assembly:** none.

**DOM / Host during assembly:** none.

---

## 3. Complete section inventory

### 3.1 How many things are “sections”?

Three different counts exist in source. Do not collapse them.

| Count | What | Number |
|---|---|---|
| Payload keys always assigned in the object literal | 8458–8568 | **49** |
| Plus production helpers (`getPrintCenterState`, `collectAttachmentIndex` both exist) | 8569–8571 | **51** keys on a typical exe/HTML run |
| `data.sections` catalog (literal) | 8567 | **32** names |
| `data.sections` after printCenter push | 8570 | **33** if printCenter set |
| `itemCounts` keys | 8550–8565 | **15** |

Q2 answer: **32 names in the `sections` array** (33 with printCenter). **49–51 keys** on the snapshot object.

### 3.2 Per-section table

Legend — Core understands:

- **Req** = `BackupRequiredCollections` (schema≥1: warranties, invoices, sales, parts, accounts)
- **Plan** = RestorePlan identity (same five)
- **Mig** = field/schema migrator knows the key
- **Att** = `CollectAttachmentIndex` walks it
- **Fin** = Finalizer hashes it **only if listed in `sections`**
- **JSON** = treated as opaque JSON only

| key | source | type | required/optional | legacy fallback | schema | attachment | identity | Core today |
|---|---|---|---|---|---|---|---|---|
| invoices | RAM `_safeArr` | array | required schema≥0 | missing RAM → `[]` | always emitted | yes (`invoice`) | `invoiceId` (Plan) | Req+Plan+Mig+Att+Fin |
| warranties | RAM | array | required schema≥0 | `[]` | always | yes (`warranty`) | `id` | Req+Plan+Mig+Att+Fin |
| sales | RAM | array | required schema≥1 | `[]` | always (current app is schema 1) | yes (`sale`) | `saleUid` | Req+Plan+Mig+Att+Fin |
| parts | RAM | array | required schema≥1 | `[]` | always | no | `id` | Req+Plan+Mig+Fin |
| accounts | RAM | array | required schema≥1 | `[]` | always | no | `id` | Req+Plan+Mig+Fin |
| phonebook | RAM **only `phonebook`** | array | optional for validator | `[]`; **`pb` not read** | always | no | **not in RestorePlan** | Mig (pb↔phonebook on restore) + Fin; **no Plan** |
| products | RAM | array | optional | `[]` | always | no | `code` in HTML merge only | Fin+JSON |
| inventory | RAM | object | optional | `{}` | always | no | object keys | Fin+JSON |
| services | RAM | array | optional | `[]` | always | no | HTML merge `id\|\|code` | Fin+JSON |
| svcs | same as services | array | optional alias | same pointer | always emitted, **not in `sections`** | no | — | JSON (checksum payload yes, sectionChecksums **no**) |
| tasks | RAM | array | optional | `[]` | always | no | HTML `id` | Mig+Fin |
| defectiveStock | RAM | array | optional | `[]` | always | no | HTML `id` | Fin |
| warehouseDocs | RAM | array | optional | `[]` | always, **not in `sections`** | no | HTML `id` | JSON only |
| stockMoves | RAM | array | optional | `[]` | always, **not in `sections`** | no | HTML `id` | JSON only |
| warehouses | RAM | array | optional | `[]` if undefined | always | no | HTML `id` | Mig empty-fill schema0 + Fin |
| daqi | RAM | array | optional | `[]` if undefined | always | no | HTML `id` | Mig+Fin |
| daqiWarehouse | RAM raw | array* | optional | `[]` if undefined **only** | always | no | HTML manufacturer+code+name | Mig+Fin |
| daqiVouchers | RAM raw | array* | optional | same | always | no | HTML `id` | Mig+Fin |
| postalHistory | RAM raw | array* | optional | same | always | no | HTML `id` | Fin |
| userAuditLog | RAM | array | optional | `[]` | always | no | — | Fin |
| bgAuditLog | RAM | array | optional | `[]` | always | no | — | Fin |
| userRoles | RAM | array | optional | `[]` | always | no | — | Fin |
| loginPw | RAM | string | optional | `''` | always | no | — | Fin |
| printSettings | LS live | object | optional | `{}` | always | no | — | Fin |
| company | LS live | object | optional | `{}` | always | no | — | Fin |
| serviceCenter | LS live | object | optional | `{}` | always | no | — | Fin |
| starredAlarms | LS+catalog | array | optional | catalog defaults | always | no | catalog `id` | Fin |
| senderInfo | RAM | object | optional | `{}` | always | no | — | Fin |
| logoSrc | RAM | string | optional | `''` | always | no | — | Fin |
| acH | RAM | object | optional | `{}` | always | no | — | Fin |
| appearance | LS×24 | object | optional | `''` per key | always | no | — | Fin |
| sms | LS | object | optional | `{}` | always | no | — | Fin |
| tz | LS | string | optional | `'Asia/Tehran'` | always | no | — | Fin |
| networkSettings | LS+parse | object | optional | parsed empty | always | no | — | Fin |
| aiKeys | LS scan | object | optional | `{}` | always | no | — | Fin |
| prefs | LS PREF_KEYS | object | optional | `{}` if helper missing | always emitted, **not in `sections`** | no | — | JSON only |
| appliedUpdates | LS | array | optional | `[]` | always, **not in `sections`** | no | — | JSON only |
| updatePackages | LS | array | optional | `[]` | always, **not in `sections`** | no | — | JSON only |
| printCenter | LS+defaults | object | conditional | omitted on throw | pushed into `sections` if set | no | — | Fin if present |
| invCtr | RAM | number | always | `\|\|1` | not in `sections` | no | — | Mig uses it |
| invoiceUidCtr | RAM | number | always | `0` | not in `sections` | no | — | Mig |
| saleCtr | RAM | number | always | `1` if missing | not in `sections` | no | — | Mig |
| saleUidCtr | RAM | number | always | `0` | not in `sections` | no | — | Mig |
| magic | const | string | always | `'SIRMAN_BACKUP'` | metadata | — | — | Finalizer overwrites |
| schemaVersion | const | number | always | `1` | metadata | — | — | Finalizer overwrites |
| version | literal | string | always | `'1405.6.3α'` | metadata | — | — | Finalizer copies to applicationVersion |
| applicationVersion | literal | string | always | same | metadata | — | — | Finalizer |
| exportedAt | clock | string | always | ISO now | metadata | — | — | Finalizer does **not** stamp unless asked |
| itemCounts | derived | object | always | 15 keys | metadata | — | — | Structural validator |
| sections | literal | array | always | 32 names | metadata | — | — | Finalizer hash key list |
| attachmentsIndex | derived | array | if helper exists | [] walk | metadata | derived | parent `rec.id` | Finalizer **rebuilds** |

Phonebook planning rules were **not** added. Identity for phonebook is documented only as “HTML merge uses first phone; Core RestorePlan excludes it.”

---

## 4. Storage dependencies

### 4.1 During `_buildFullBackupData` (exact)

**RAM globals read:**  
`invoices`, `products`, `inventory`, `invCtr`, `invoiceUidCtr`, `saleCtr`, `saleUidCtr`, `phonebook`, `parts`, `services`, `warranties`, `sales`, `tasks`, `accounts`, `defectiveStock`, `warehouseDocs`, `stockMoves`, `warehouses`, `daqi`, `daqiWarehouse`, `daqiVouchers`, `postalHistory`, `userAuditLog`, `bgAuditLog`, `userRoles`, `loginPw`, `senderInfo`, `logoSrc`, `acH`.

**localStorage keys read during assembly:**

| Key | Via |
|---|---|
| `laegh_printSettings` | direct + `getPrintSettings` fallback for printCenter |
| `laegh_company` | direct |
| `laegh_service_center` | direct |
| `laegh_starred_alarms` | `getStarredAlarms` |
| `laegh_skin` … `laegh_dash_hide_widgets` (24 appearance keys) | direct |
| `laegh_sms` | direct |
| `laegh_tz` | direct; default `Asia/Tehran` |
| `laegh_network` | `loadNetworkSettings` |
| `PREF_KEYS` (9130) | `collectPrefsBundle` |
| `laegh_ai_key_*`, `laegh_ai_custom_url`, `laegh_ai_custom_model`, `laegh_ai_model`, `laegh_ai_purpose` | aiKeys scan |
| `laegh_applied_updates` | `getAppliedUpdatesMeta` |
| `laegh_upd_pkg_<id>` | `collectUpdatePackagesForBackup` |
| `laegh_printCenter` (`PC_KEY`) | `getPrintCenterState` |

**IndexedDB:** **none** in this function.

**Boot-time LS (not re-read by assembly):** `li`, `lp`, `lv`, `lb`, `la`, `ls`, `ll`, `lc`, `lp2`, `ls2`, `lw2`, `laegh_tasks`, `laegh_defective`, `laegh_audit_*`, `laegh_warehouse`, `laegh_stockmoves`, `laegh_roles`, `laegh_login_pw`, `laegh_sales`, `laegh_sale_ctr`, `laegh_sale_uid_ctr`, `laegh_invoice_uid_ctr`, `laegh_accounts`, `laegh_warehouses`, `laegh_daqi`, `laegh_daqi_warehouse`, `laegh_daqi_vouchers`, `laegh_postal_history`. Assembly trusts RAM.

### 4.2 Split-brain risk

`printSettings` / `company` / `serviceCenter` / appearance are read from **localStorage at export time**, while invoices are read from **RAM**. If RAM was mutated and not `sv()`’d, backup can mix stale LS settings with fresh RAM documents.

---

## 5. Generated values

| Value | How | Class | Stay where |
|---|---|---|---|
| `exportedAt` | `new Date().toISOString()` | runtime-generated | Assembly/runtime. Core Finalizer already supports injected `NowMs` + `StampExportedAt` (off by default, matching HTML finalize). |
| `magic` / `schemaVersion` | constants | deterministic | May be overwritten by Finalizer (already). |
| `version` / `applicationVersion` | hardcoded literals | deterministic **if** someone remembers to edit both + `APP_VERSION` | Assembly until a single version DTO is passed in. Do not invent a Core clock. |
| `itemCounts` | array lengths | deterministic given snapshot | Can move to Core **after** arrays are on the DTO (Finalizer/manifest already copies them). |
| `sections` | hardcoded list + printCenter | deterministic | Contract. Core must not invent extra names. |
| `attachmentsIndex` | walk docs | deterministic given records | **Already in Core Finalizer** (`CollectAttachmentIndex`). Assembly also sets it; Finalizer rebuilds. |
| `manifest` / `sectionChecksums` / `checksum` | **not in assembly** | — | Already Core (ARCH-5/6). |
| `starredAlarms` catalog fill | `normalizeStarredAlarms` | derived | HTML adapter (catalog is UI). |
| `networkSettings` coerce | `parseNetworkSettings` | derived | HTML adapter. |
| `printCenter` profile merge | `PRINT_PROFILE_DEFAULTS` | derived / UI | HTML adapter. **Print frozen.** |
| `invCtr\|\|1`, `saleCtr` default 1 | coerce | derived | HTML adapter — do not change. |
| `tz` default | `'Asia/Tehran'` | derived | HTML adapter. |
| IDs on records | **not generated here** | — | Already on RAM. Migrator assigns on restore, not on assemble. |
| `backupId` | **not created** | — | Keep unused (ARCH-5 lock). |
| Random | **none** | — | — |

Do **not** change generation behavior in this packet.

---

## 6. Legacy compatibility behavior (observed, not changed)

- `svcs` is a duplicate of `services` for old restore paths (`applyBackupReplaceSections` can read `d.svcs`).
- `phonebook` only; comment at 8472: `pb` removed as a separate source. `exportData/_buildFullBackupData نباید pb را به‌عنوان منبع جدا بنویسد` is locked by HTML tests.
- Warehouses: if LS empty **at boot**, HTML **writes** six default warehouses (`initWarehouses` 18882–18897). Assembly then sees a non-empty RAM array. That is boot, not assembly.
- Schema 0→1 `MISSING → []` for sales/parts/accounts lives in **migrator**, not in `_buildFullBackupData`. Current assembly always emits those keys.
- Selective `exportData(selectedKeys)` **deletes** unselected keys after assembly (14292–14302) and rebuilds `itemCounts` / `sections`. That is **export**, not `_buildFullBackupData`. Partial packages can omit required collections → Restore INVALID. Existing fail-closed.

---

## 7. Missing vs empty rules **inside assembly**

`_buildFullBackupData` always assigns the 49 literal keys. It does **not** omit required collections.

Intentional `MISSING → []` (RAM not an array / undefined):

| Mechanism | Keys | Rule |
|---|---|---|
| `_safeArr` | invoices, products, phonebook, parts, services, svcs, warranties, sales, tasks, accounts, defectiveStock, warehouseDocs, stockMoves, userAuditLog, bgAuditLog, userRoles, warehouses (via ternary), daqi (via ternary) | non-array → `[]` |
| `_safeObj` | inventory, senderInfo, acH, parsed LS objects | falsy/non-object → `{}` |
| `_safeStr` | loginPw, logoSrc | nullish → `''` |
| `typeof x!=='undefined'?x:[]` without `_safeArr` | daqiWarehouse, daqiVouchers, postalHistory | **undefined → []**; if defined but not array, **emits non-array** |
| `invCtr\|\|1` | invCtr | 0/falsy → 1 |
| saleCtr `>0?x:1` | saleCtr | missing/0 → 1 |
| uid counters `>0?x:0` | invoiceUidCtr, saleUidCtr | missing → 0 |
| `getItem\|\|'{}'` / `\|\|'[]'` | LS settings | missing LS → empty object/array **string then parse** |
| `tz` `\|\|'Asia/Tehran'` | tz | missing → default string |
| appearance `getItem\|\|''` | 24 keys | missing → empty string (key still present) |
| printCenter try/catch | printCenter | throw → **key omitted** (not `[]`) |
| collectAttachmentIndex missing | attachmentsIndex | **key omitted** |

**Always emitted:** the 49 object-literal keys (including empty arrays/objects).

**Conditionally emitted:** `printCenter`, `attachmentsIndex`.

**Intentionally omitted from `sections` (but still on the object):** `svcs`, `warehouseDocs`, `stockMoves`, `prefs`, `appliedUpdates`, `updatePackages`, counters, metadata.

**Not an assembly rule:** schema≥1 restore `MISSING required ≠ []`. That is validator/restore. A full current-app snapshot from `_buildFullBackupData` includes required arrays, so a **full** export is valid. A **partial** export can omit them.

---

## 8. Proposed `BackupSnapshot` contract (NOT implemented)

Serializable JSON only. No DOM, Host, LS handles, IDB handles, functions, or live object references.

```text
BackupSnapshot {
  magic: string                      // "SIRMAN_BACKUP"
  schemaVersion: number              // 1
  version: string                    // applicationVersion source
  applicationVersion: string
  exportedAt: string                 // ISO-8601; stamped by adapter with injected now
  origin?: string                    // set by caller after assemble (manual/autosave/archive/…)

  invoices: InvoiceRecord[]          // always array, never missing on a full snapshot
  warranties: WarrantyRecord[]
  sales: SaleRecord[]
  parts: PartRecord[]
  accounts: AccountRecord[]
  phonebook: PhonebookRecord[]       // included as data; no Core identity rules
  products: ProductRecord[]
  inventory: object                  // map, not array
  services: ServiceRecord[]
  svcs: ServiceRecord[]              // duplicate of services for legacy
  tasks: TaskRecord[]
  defectiveStock: Record[]
  warehouseDocs: Record[]
  stockMoves: Record[]
  warehouses: Record[]
  daqi: Record[]
  daqiWarehouse: Record[]            // must be array on a valid snapshot
  daqiVouchers: Record[]
  postalHistory: Record[]
  userAuditLog: Record[]
  bgAuditLog: Record[]
  userRoles: Record[]
  loginPw: string
  printSettings: object
  company: object
  serviceCenter: object
  starredAlarms: Record[]
  senderInfo: object
  logoSrc: string
  acH: object
  appearance: { [k: string]: string }
  sms: object
  tz: string
  networkSettings: object
  prefs: object
  aiKeys: { [k: string]: string }
  appliedUpdates: Record[]
  updatePackages: Record[]
  printCenter?: object

  invCtr: number
  invoiceUidCtr: number
  saleCtr: number
  saleUidCtr: number

  itemCounts: { [collection: string]: number }
  sections: string[]
  attachmentsIndex?: AttachmentRef[]   // optional; Finalizer rebuilds
}
```

**Invariants for a full snapshot (current HTML behavior):**

1. Required collections present as arrays (`warranties`, `invoices`, `sales`, `parts`, `accounts`), possibly empty.
2. `itemCounts[k] === snapshot[k].length` for every key HTML currently counts.
3. `sections` is the HTML catalog (32 names, + `printCenter` if present). Core must not silently add/remove names.
4. Snapshot is a **deep clone**. HTML `_safeArr` today shares live RAM — the DTO must not.
5. No `localStorage` / `indexedDB` / `window` fields.
6. `exportedAt` is data, not `Date.now` inside Core.
7. Phonebook is payload only. No first-phone merge in Core.

This is exactly the JSON `BackupFinalizer.Finalize` already consumes. The missing piece is a **named, cloned, complete** snapshot — not a new finalize engine.

---

## 9. HTML / Core responsibility boundary

```text
HTML / Host
  ├── RAM SoT + localStorage + IndexedDB adapters
  ├── DOM / UI / print frozen surfaces
  ├── _buildFullBackupData          KEEP (reader) until a later packet
  ├── selective export / encrypt / download / IDB mirror
  ├── Restore apply / Merge / Replace
  └── Phonebook live engine

        ▼  BackupSnapshot (cloned JSON)

Sirman.Core  (already)
  ├── Validator
  ├── Migrator
  ├── DryRun
  ├── RestorePlan          (decision only)
  └── Finalizer            (manifest, sectionChecksums, SHA-256)

Not yet
  ├── Snapshot reader in Core          DO NOT
  ├── Live snapshot adapter            DO NOT this packet
  ├── Restore apply                    DO NOT
  └── Merge/Replace engines            DO NOT
```

**KEEP in HTML/Host:** every LS/IDB/RAM read listed in §4.

**MOVE later (pure only):** the snapshot **shape** (this contract), completeness checks against `sections`/`itemCounts`, clone-before-finalize (Core Finalizer already clones).

---

## 10. Extraction sequence (do not start)

Evidence-based order. Adjusted from the packet example because Finalizer **already** accepts this JSON.

1. **This audit** — freeze the key list, `sections` vs payload gap, clone requirement. *(this packet)*
2. **`BackupSnapshot` DTO / schema notes in Core** — types + comments only; no reader; no HTML change.
3. **Golden assembled fixtures** — synthetic full snapshot matching the 49+ keys; assert Finalizer + Validator + DryRun + RestorePlan still pass. Reuse/extend `BackupFinalizeGolden.json`, do not rewrite HTML.
4. **HTML clone adapter (tests only)** — `JSON.parse(JSON.stringify(_buildFullBackupData()))` in a sandbox; prove live `invoices.push` does not mutate the clone. **Do not replace `_buildFullBackupData`.**
5. **Parity: cloned snapshot → Core Finalizer** vs current `applyBackupFinalizer` (ARCH-6 already close; add completeness of `warehouseDocs`/`prefs` in SHA-256).
6. **Controlled dual-run at export** — assemble HTML, clone, finalize Core (already the exe path). Log key-count diffs. No cutover of the reader.
7. **Only later** change `_buildFullBackupData` internals (clone, `_safeArr` on daqiWarehouse, include omitted keys in `sections` **only** with an explicit compatibility packet).
8. **Never as the next step:** Restore apply, Merge/Replace, Phonebook identity, `_buildFullBackupData` move into Core, P1C-8, SQLite.

---

## 11. Risk ranking

| Rank | Risk | Level | Evidence |
|---|---|---|---|
| 1 | Mutable shared objects (`_safeArr` / `_safeObj` return live RAM) | **HIGH** | 7639–7640; Finalizer/safety snapshot alias live `invoices` |
| 2 | `sections` catalog incomplete vs emitted keys (`warehouseDocs`, `stockMoves`, `prefs`, `appliedUpdates`, `updatePackages`, `svcs`, counters) | **HIGH** | 8567 vs 8481–8489, 8534 |
| 3 | Split-brain RAM vs live LS (`printSettings`/`company` vs unsaved RAM) | **HIGH** | 8465 vs 8496 |
| 4 | `exportedAt` clock → checksum excludes it, but safety/diff/UI use it | **HIGH** | 8463; Finalizer comment |
| 5 | Attachment refs (`idb:`/`disk:`) indexed but blobs not copied from IDB | **HIGH** | 7709–7738; no IDB read |
| 6 | Phonebook: `pb` not assembled; restore still has HTML first-phone merge | **HIGH** (data) / out of scope for Plan | 8472; ARCH-8 exclusion |
| 7 | `daqiWarehouse` / `daqiVouchers` / `postalHistory` skip `_safeArr` | **MEDIUM** | 8485–8487 vs 8563–8565 |
| 8 | Secrets in snapshot (`loginPw`, `aiKeys`) | **MEDIUM** | 8494, 8536 |
| 9 | `version` literal vs `APP_VERSION` drift | **MEDIUM** | 8461 vs 6786 |
| 10 | Warehouses boot seeds defaults into LS | **MEDIUM** | 18882–18897 |
| 11 | `starredAlarms` / `networkSettings` / `printCenter` derived defaults | **MEDIUM** | catalog/parse/PRINT_PROFILE_DEFAULTS |
| 12 | `invCtr\|\|1` / `saleCtr` default 1 | **MEDIUM** | 8468, 8470 |
| 13 | Partial export omits required collections | **MEDIUM** | 14292–14302; fail-closed on restore |
| 14 | `svcs` duplicate pointer | **MEDIUM** | 8475, 16049 |
| 15 | `itemCounts` omits warehouseDocs/stockMoves | **MEDIUM** | 8550–8565 |
| 16 | printCenter omitted on throw | **LOW** | 8569 |
| 17 | Appearance empty string vs missing | **LOW** | 8505 |
| 18 | No `Math.random` / `backupId` | **LOW** (good) | 8457–8573 |

---

## 12. Exact first extraction candidate

**Name:** Core `BackupSnapshot` contract (types + golden shape), **not** `_buildFullBackupData`.

**Why this is safest:**

- Core Finalizer already requires this JSON. A named DTO documents completeness (`sections` vs extra keys) without touching live RAM.
- It does not move LS/IDB into Core.
- It does not cut over Restore or Merge.
- The first *behavioral* follow-up (still a later packet) is **clone-on-assemble** in HTML tests, because shared references are the highest loss/corruption risk.

**Not the first extraction:** rewriting `_buildFullBackupData` in C#, Host snapshot adapter, Phonebook, P1C-8.

---

## 13. Confirmation of zero code/data mutation

| Surface | This packet |
|---|---|
| `Sirman_Final.html` | not modified |
| `Laegh_Final.html` | not modified |
| `Sirman.Core` | not modified |
| Host | not modified |
| tests | not modified |
| live Restore / Merge / Replace | not modified |
| Phonebook | not modified |
| SQLite / `JsonBackupRepository` | not modified |
| `resetAll` | not modified |
| live shop data | not written |

Git commit contains **only** this report.

---

## Governance work report (قانون ۱۳)

1. **کار:** ممیزی مرز اسمبل بک‌آپ (فقط خواندنی)  
2. **شاخه:** `cursor/arch-9a-backup-snapshot-assembly-audit-fa01`  
3. **تغییر:** فقط گزارش  
4. **نسخه:** `1405.6.3α`  
5. **HTML:** بدون تغییر (پایه 799/799)  
6. **Core:** بدون تغییر (پایه 514/514)  
7. **استخراج:** شروع نشد  
8. **داده زنده:** بدون نوشتن  
9. **چاپ:** دست‌نخورده  
10. **وضعیت:** COMPLETED (audit)

---

## Q1–Q14

**Q1. What exact data sources feed `_buildFullBackupData`?**  
RAM globals listed in §4.1 + `localStorage` keys listed in §4.1 + constants `SIRMAN_BACKUP_MAGIC` / `SIRMAN_SCHEMA_VERSION` + clock `new Date().toISOString()`. **Not** IndexedDB, DOM, or Host.

**Q2. How many sections does it emit?**  
`data.sections`: **32** names (33 if `printCenter` is added). Snapshot object: **49** always-assigned keys, **51** on a typical run with printCenter + attachmentsIndex.

**Q3. Which sections are always present?**  
The 49 object-literal keys, including empty arrays/objects for business collections.

**Q4. Which sections can be missing?**  
`printCenter` (throw). `attachmentsIndex` (helper missing — not in production HTML). After **selective export**, any unselected business key can be deleted (not inside `_buildFullBackupData`).

**Q5. Where does MISSING → [] still occur intentionally?**  
`_safeArr` for listed RAM arrays; `typeof x!=='undefined'?x:[]` for warehouses/daqi and for daqiWarehouse/vouchers/postalHistory when **undefined**. LS `||'[]'` / `||'{}'` for settings. Schema 0→1 sales/parts/accounts `[]` is **migrator**, not assembly.

**Q6. Which fields are runtime-generated?**  
`exportedAt` (clock). Derived: `itemCounts`, `sections` (+printCenter), `attachmentsIndex`, starredAlarms catalog fill, network parse, printCenter defaults. No random IDs.

**Q7. Which dependencies are RAM globals?**  
All business arrays/objects in §4.1 RAM list (`invoices` … `acH`).

**Q8. Which dependencies are localStorage/IndexedDB?**  
localStorage: §4.1 table. **IndexedDB: none in this function.**

**Q9. What is the minimal Snapshot DTO?**  
Cloned JSON of the 49 always-keys + optional `printCenter`/`attachmentsIndex`, with required collections as arrays, `itemCounts`/`sections` matching HTML, `exportedAt` injected. See §8.

**Q10. What is the safest first extraction?**  
Core `BackupSnapshot` types + golden shape checks. Do **not** extract the live reader. Next behavioral step (later): clone-on-assemble.

**Q11. Was any code changed?**  
**NO.** Report only.

**Q12. Was live data changed?**  
**NO.**

**Q13. Was Phonebook changed?**  
**NO.**

**Q14. Was SQLite changed?**  
**NO.**

---

## STOP

ARCH-9A implementation not started. `_buildFullBackupData` not extracted. ARCH-10 not started. P1C-8 not started. Restore / Merge / Replace / Phonebook / SQLite untouched.
