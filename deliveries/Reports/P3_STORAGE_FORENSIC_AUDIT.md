# SIRMAN — P3 STORAGE FORENSIC AUDIT

## Storage / Persistence / Backup / Restore Architecture Discovery

**Mode:** READ-ONLY — no product code, no database, no backup/restore patch  
**Jalali:** 1405/06/02  
**Gregorian:** 24 August 2026  
**Exact time:** 14:50 Asia/Tehran  
**Timezone:** Asia/Tehran (+03:30)  
**Live version (unchanged):** `1405.5.27γ` / assembly `1405.5.27.3`

```text
Product code modified = NO
Architecture modified = NO
Database added = NO
Backup modified = NO
Restore modified = NO
```

---

## 1. Git gate (recorded before analysis)

Taken on the then-current approved product branch. No switch / reset / rebase / merge of product history was performed during analysis.

```text
Branch:   cursor/p0-2s-windows-runtime-print-diagnostic-fa01
HEAD:     da229b83f98556bda05bf9a9027344e04d9bb5bf
          (short: da229b8)
Worktree: product-clean
Untracked (not part of this audit):
  deliveries/Sirman_Setup_1405.5.27γ_NATIVE_PRINT.zip
  deliveries/Sirman_Setup_1405.5.27γ_NATIVE_PRINT.sha256
  scripts/__pycache__/
Version:  1405.5.27γ / 1405.5.27.3
Date:     2026-08-24 / 1405/06/02
Time:     ~14:40 Asia/Tehran (gate) ; report 14:50
Timezone: Asia/Tehran (+03:30)
```

This report is delivered on a **docs-only** branch cut from that HEAD. Product files are byte-identical to `da229b8`.

---

## 2. Governance documents read

| Document | Storage-relevant fact used |
|---|---|
| `docs/PHASE_3_CHANGE_GATE.md` | HTML owns persistence and backup schema. There is no SQL persistence layer. localStorage/IndexedDB model is frozen for Phase 3 B-steps. |
| `docs/ARCHITECTURE_RULES.md` | Target is data access → database. Today persist is HTML `localStorage` / IndexedDB. Core must not depend on localStorage details. HTML-only must keep working. |
| `docs/DEVELOPMENT_GOVERNANCE.md` | Stable code is protected. Analyze before modify. |
| `docs/REGRESSION_SUITE.md` | Read for test/governance context; not a storage implementation. |
| `.agents/skills/laegh-software-workflow/SKILL.md` | Backup must export all sections. Restore is merge vs replace. Restore must hydrate the same variables the UI reads. Data loss has happened before. |
| `deliveries/Reports/PHASE_3_MIGRATION_TRACKER.md` | Persist/backup remain HTML. B20: remaining persist/backup is a **separate program**, not a B-step. |
| `deliveries/Reports/PHASE_3_ARCHITECTURE_MIGRATION_STEP_B20_NEXT_SEAM_AND_COMPLETION_GATE.md` | Moving persist/backup requires a new architecture decision. |
| `desktop/Sirman.Core/Data/CurrentStorage.cs` | `Kind = "html-localStorage-indexeddb"`, `Owner = "Sirman_Final.html"`. This phase does not build a Database. |
| `desktop/Sirman.Core/Data/Repositories/JsonBackupRepository.cs` | Stub: `tbd`, `engine = "html-backup-engine"`. Not the live exporter. |
| `desktop/Sirman.Core/Data/Repositories/IBackupRepository.cs` | Explicit: real schema/migrate/merge/replace live in HTML BackupEngine. |
| Prior SQLite design reports | Phase 2 SQLite was designed as a **parallel adapter**, not as live SoT. No SQLite/EF/LiteDB exists under `desktop/` today. |

---

## 3. Actual storage inventory

### 3.1 Canonical operational store (today)

**Canonical SoT = in-memory JavaScript globals, hydrated from `localStorage` on boot, written back to `localStorage` on save.**

Evidence:

- Boot: `Sirman_Final.html` ~7497–7511 and ~15334–15357 load `invoices`, `products`, `inventory`, `phonebook`, `warranties`, `tasks`, `sales`, warehouse docs, stock moves, etc. from `localStorage`.
- `CurrentStorage.Kind = "html-localStorage-indexeddb"` and `Owner = "Sirman_Final.html"`.
- `docs/PHASE_3_CHANGE_GATE.md`: “HTML owns application persistence.”
- Core `JsonBackupRepository` is a TBD stub. It does not export live warranties/invoices.
- `grep` of `desktop/` for Sqlite / EntityFramework / LiteDB: **no matches**.

IndexedDB is **not** the live warranty/invoice table. It holds:

- full HTML app blob
- update packages
- backup snapshots / File System Access handles / safety copies
- a **tasks mirror** for the Service Worker

Native disk is **not** the live entity store. `SirmanHostObject.WriteBackupText` writes UTF-8 JSON files under `%AppData%\Sirman\backup`. Media is intended on disk (`sirman_media` / `disk://` refs) to avoid quota.

`sessionStorage` is used only as a one-shot flag (`sirman_fullapp_applied`) after applying a full-app blob. It is not an entity store.

### 3.2 IndexedDB databases (source)

| Database | Version | Stores | Role vs operational SoT |
|---|---:|---|---|
| `laegh-fullapp-db` | 1 | `app` | Full HTML replacement blob. Not business rows. |
| `laegh-updates-db` | 1 | update packages | Update payloads. Not warranties/invoices. |
| `laegh-backup-db` | 4 | `snapshots`, `fsHandles`, `layers`, `safety`, `backupAudit`, `prefs` | Backup copies, FS handles, pre-restore safety. Comment in source: third copy after localStorage + downloaded file. |
| `laegh-tasks-db` | 1 | `tasks` | Mirror so Service Worker can notify. `svTasks` writes LS first, then `mirrorTasksToIDB`. `syncNotifiedFromIDB` can copy `notifiedAt` back to LS. |

### 3.3 Native disk (Host)

| Path / API | What it stores | Canonical for business entities? |
|---|---|---|
| `%AppData%\Sirman\backup` via `GetBackupDir` / `WriteBackupText` | Manual/autosave JSON text files | NO |
| `%AppData%\Sirman\prefs.json` via `SaveAppPref` / `LoadAppPref` | Desktop UI prefs | NO |
| `%AppData%\Sirman\network.json` | LAN/network config | NO |
| Backup-folder `sirman_media/` via File System Access | Images/attachments; JSON keeps `disk://` refs | NO (bytes on disk; refs in LS/RAM) |

---

## 4. Storage matrix

Legend: YES / NO / PARTIAL / UNKNOWN. “Canonical” = what the UI list reads after a normal boot.

| Entity | Canonical Store | localStorage | IndexedDB | Memory/Cache | Native Disk | Backup JSON | Restore | Risk |
|---|---|---:|---:|---:|---:|---:|---:|---|
| invoices | LS → RAM (`li`) | YES | NO (only inside backup snapshots) | YES | NO | YES (from RAM) | YES | HIGH — `sv()` has no quota catch |
| products | LS → RAM (`lp`) | YES | NO* | YES | NO | YES | YES | HIGH — same `sv()` |
| inventory | LS → RAM (`lv`) | YES | NO* | YES | NO | YES | YES | HIGH — same `sv()`; selective-export UI has no inventory checkbox |
| phonebook | LS → RAM (`lb`) | YES | NO* | YES | NO | YES | YES | MEDIUM — `pb` alias mitigated |
| accounting history `acH` | LS → RAM (`la`) | YES | NO* | YES | NO | YES | YES | MEDIUM |
| invoice counter | LS (`lc`) | YES | NO | YES | NO | YES | YES | MEDIUM |
| invoice uid ctr | LS (`laegh_invoice_uid_ctr`) | YES | NO | YES | NO | YES | YES | LOW |
| parts | LS → RAM (`lp2`) | YES | NO* | YES | NO | YES | YES | HIGH — `svParts()` uncaught `setItem` |
| services | LS → RAM (`ls2`) | YES | NO* | YES | NO | YES | YES | HIGH — `svSvcs()` uncaught |
| warranties | LS → RAM (`lw2`) | YES | NO* | YES | NO | YES (from RAM) | YES | **CRITICAL** — quota-safe persist can return false; missing key restore → `[]` |
| sales | LS → RAM (`laegh_sales`) | YES | NO* | YES | NO | YES | YES | HIGH — `_persistJsonSafe` |
| sale counters | LS (`laegh_sale_ctr` / uid) | YES | NO | YES | NO | YES | YES | LOW |
| tasks | LS → RAM (`laegh_tasks`) | YES | YES (mirror) | YES | NO | YES (from RAM) | YES | HIGH — split-brain LS/IDB |
| defectiveStock | LS (`laegh_defective`) | YES | NO* | YES | NO | YES | YES | MEDIUM — uncaught persist |
| accounts | LS (`laegh_accounts`) | YES | NO* | YES | NO | YES | YES | MEDIUM — uncaught persist |
| warehouses | LS (`laegh_warehouses`) | YES | NO* | YES | NO | YES | YES | MEDIUM |
| warehouse docs | LS (`laegh_warehouse`) | YES | NO* | YES | NO | YES | YES | HIGH — omitted from selective-export checkbox UI |
| stock moves | LS (`laegh_stockmoves`) | YES | NO* | YES | NO | YES | YES | HIGH — omitted from selective-export checkbox UI |
| daqi / daqiWarehouse / daqiVouchers | LS | YES | NO* | YES | NO | YES | YES | MEDIUM |
| postalHistory | LS | YES | NO* | YES | NO | YES | YES | MEDIUM |
| print settings | LS (`laegh_printSettings`) | YES | NO* | PARTIAL | NO | YES (from LS, not RAM) | YES | MEDIUM |
| company / service center | LS | YES | NO* | PARTIAL | NO | YES (from LS) | YES | LOW |
| appearance / sms / tz / network / AI keys / prefs | LS (`laegh_*`) | YES | PARTIAL (`prefs` in backup IDB) | PARTIAL | PARTIAL (`prefs.json`) | YES | YES | LOW–MEDIUM |
| logo / senderInfo | LS (`ll` / `ls`) | YES | NO | YES | PARTIAL (`disk://` media) | YES | YES | MEDIUM — dataURL vs disk ref |
| userRoles / loginPw | LS | YES | NO | YES | NO | YES | YES | HIGH (secrets in JSON) |
| audit logs | LS | YES | PARTIAL (`backupAudit`) | YES | NO | YES | YES | LOW |
| appliedUpdates / updatePackages | LS + IDB | YES | YES | PARTIAL | NO | PARTIAL | PARTIAL | MEDIUM |
| attachments / photos | disk refs in JSON | PARTIAL (refs only) | PARTIAL (`idb:` refs) | YES | YES (`sirman_media`) | PARTIAL (index + refs) | PARTIAL | HIGH — restore without folder ≠ lost rows, broken media |
| HTML app blob | IndexedDB | NO | YES | NO | NO | NO (not a business section) | NO | LOW for row loss |
| backup snapshots / safety | IndexedDB | NO | YES | NO | YES (downloaded JSON) | N/A | N/A | MEDIUM — not auto-canonical |
| Core `RunBusiness` snapshots | RAM / Host round-trip | PARTIAL (`persistCoreSnapshot` → HTML sv*) | NO | YES | NO | NO as Core DB | NO | MEDIUM — Core is not durable SoT |
| shop backup file `Laegh_backup__۱۴۰۵-۰۶-۰۲_.json` | file (not on this VM) | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN counts |

`*` “NO” for IndexedDB means: no dedicated live object store for that entity. The same bytes may appear inside `laegh-backup-db` snapshots if a backup was mirrored.

---

## 5. Entity inventory (write / read / backup / restore)

### 5.1 Core business arrays (pattern)

For invoices, products, inventory, phonebook:

| Field | Value |
|---|---|
| Canonical | `localStorage` keys `li` / `lp` / `lv` / `lb` → RAM |
| Write | `sv()` raw `setItem` (no try/catch) |
| Read | boot `JSON.parse(localStorage.getItem(...))` |
| Backup | `_buildFullBackupData()` copies RAM via `_safeArr` / `_safeObj` |
| Restore | `applyBackupReplaceSections` / `applyBackupMergeSections` then `try{ sv(); }catch(_e){}` |
| Runtime cache | YES — UI binds RAM |

For warranties:

| Field | Value |
|---|---|
| Canonical | `lw2` → RAM `warranties` |
| Write | `svWars()` / `svWarr()` → `_persistJsonSafe('lw2', ...)` |
| Read | `JSON.parse(localStorage.getItem('lw2')\|\|'[]')` ~15336 |
| Backup | `warranties: _safeArr(warranties)` from RAM, not a second LS pass |
| Restore replace | `warranties = Array.isArray(d.warranties) ? d.warranties : []` |
| Restore merge | push if `id` not found; existing id skipped (not updated) |
| Runtime cache | YES |

For tasks:

| Field | Value |
|---|---|
| Canonical after boot | `laegh_tasks` → RAM |
| Secondary | IndexedDB `laegh-tasks-db` / store `tasks` |
| Write | `svTasks()` LS then `mirrorTasksToIDB()` |
| Sync back | `syncNotifiedFromIDB` may write `notifiedAt` into RAM/LS |
| Backup | RAM `tasks` |
| Restore | replace/merge by `id`, then `svTasks()` |

### 5.2 Backup builder source of truth

`_buildFullBackupData()` (~7945) is the single builder. `exportData()` and `buildBackupObject()` (autosave) both call it.

Exported from **RAM** (not a fresh LS dump) for: invoices, products, inventory, phonebook, parts, services/svcs, warranties, sales, tasks, accounts, defectiveStock, warehouseDocs, stockMoves, warehouses, daqi*, postalHistory, userAuditLog, bgAuditLog, userRoles, loginPw, senderInfo, logoSrc, acH, counters.

Exported from **localStorage getItem** (not necessarily the RAM variable) for: printSettings, company, serviceCenter, appearance keys, sms, tz, plus `collectPrefsBundle` / `loadNetworkSettings` / AI keys scan.

`itemCounts` is computed from the same RAM arrays at export time. It is a self-check of the JSON, not a proof of pre-export shop counts.

`sections[]` (~8055) lists major keys but omits `warehouseDocs`, `stockMoves`, `appliedUpdates`, `updatePackages`, `printCenter`, `attachmentsIndex`, `prefs`, `invoiceUidCtr`, `saleCtr`. Those keys can still be present on the object. Selective export deletes keys not in the user-selected list (`exportData` loop ~13719–13725).

Selective-export **checkbox UI** (~3602) is narrower than restore `getBackupSectionDefs()` (~14048). Inventory, warehouse docs, stock moves, daqi, postal, roles, login, appearance, sms, tz, AI keys are not on the export checkbox grid. A user “select all checkboxes” backup can still omit those keys (`data.partial = true`).

---

## 6. Split-brain / duplication findings

### 6.1 RAM vs localStorage (all quota-backed entities)

| Question | Answer from source |
|---|---|
| Authoritative during a session after failed persist | RAM (UI still shows unsaved rows). `svWars` returns false but `markDirty()` still runs. |
| Authoritative after reboot | localStorage. Unpersisted RAM is gone. |
| Sync | Save functions write LS. There is no retry loop. |
| Newer copy | YES — RAM can be newer than LS after QuotaExceeded. |

This is a **proven mechanism**. It is **not proven** as the cause of this shop’s missing warranties (no runtime quota log / pre-export count on this VM).

### 6.2 Tasks: localStorage vs IndexedDB

| Question | Answer |
|---|---|
| Authoritative for UI after boot | LS → RAM |
| Why IDB exists | Service Worker cannot read localStorage (`mirrorTasksToIDB` comment ~14793) |
| Sync | Write path: LS then IDB. Reverse: `notifiedAt` IDB → RAM → LS |
| Failure | IDB mirror errors are swallowed. LS can succeed while IDB is stale, or IDB notify flags can rewrite LS. |

### 6.3 Backup IDB snapshots vs live LS

`laegh-backup-db` `snapshots` / `layers` / `safety` hold copies. They are **not** auto-hydrated as SoT. Safety is used if `applyBackupSelective` throws (`applyBackupReplaceSections(safety, null)`). A successful partial restore does not roll back sibling sections.

### 6.4 Attachments: JSON refs vs disk / IDB blobs

UI copy tells users to keep photos on `sirman_media`. JSON may store `disk://` or `idb:` refs instead of dataURLs (`_safeSetItem` / migrate-to-disk). Restore of JSON without the folder does not delete warranty **rows**; media URLs break. That is not the same as “warranties disappeared,” but it is split-brain for attachments.

### 6.5 Core snapshots vs HTML persist

`persistCoreSnapshot(keys)` (~8243) maps Core persist keys onto HTML `sv*` functions. Core does not own a durable database. If Host returns a snapshot and persist fails, RAM/Core and LS can diverge.

### 6.6 Phonebook `pb` vs `phonebook`

Mitigated: `pb` is an alias; backup writes `phonebook`; restore prefers `phonebook` then `pb`. Not the warranty path.

### 6.7 Print settings dual keys

Backup reads `laegh_printSettings`. Some print-center code also touches `laegh_printSettings` (same key in current tree). Not treated as a second SoT without a proven dual-write bug in this audit.

---

## 7. Quota handling

### 7.1 Proven code paths

| Location | Behavior |
|---|---|
| `_persistJsonSafe` ~16409 | Warn if JSON length > 2_500_000 chars. `setItem` in try/catch. On failure: toast «حافظه مرورگر پر است…», **return false**. Does **not** delete old LS. Does **not** retry. |
| `svWars` / `svWarr` / `svSales` | Use `_persistJsonSafe`. On failure RAM stays; LS unchanged; `markDirty()` still called. |
| `sv()` ~7591 | **Uncaught** `setItem` for invoices/products/inventory/phonebook/acH/counter. QuotaExceeded can throw. Restore wraps `sv()` in empty catch. |
| `svParts` / `svSvcs` / `svDefective` / `svAccounts` / `svWarehouse` | Raw `setItem`, no quota catch. |
| Catalog `E004` / `WRN-QUOTA-01` | Maps `QuotaExceeded`. User message: browser storage full; use backup folder; do not keep photos in LS. |
| Storage health ~27800 | Estimates LS size vs **5 MB** heuristic; >80% raises `WRN-QUOTA-01` unless backup folder is ready. |
| `_safeSetItem` | Blocks heavy dataURLs (related quota defense). |

### 7.2 What quota can and cannot prove

| Claim | Status |
|---|---|
| QuotaExceeded can prevent persist of warranties | **PROVEN** (code) |
| UI can keep showing RAM rows after failed persist | **PROVEN** |
| After refresh, those rows are gone from SoT | **PROVEN** (boot reads LS) |
| User is told | **PROVEN** (toast + catalog) if `_persistJsonSafe` path is used |
| `sv()` path: failure may be an uncaught exception | **PROVEN** |
| Restore persist failure is swallowed; success alert still runs | **PROVEN** (`try{ svWarr(); }catch(_e){}` then later alert in `applyBackupSelective`) |
| This shop hit quota before the ۱۴۰۵-۰۶-۰۲ backup | **UNKNOWN** — no shop WebView2 logs on this VM |
| Quota is why warranties are missing in the uploaded file | **UNKNOWN** — file not present here |

Quota is a **proven loss mechanism**. It is **not** proven as the shop incident’s sole cause.

---

## 8. Backup pipeline

```text
User clicks Backup
  → exportData(selectedKeys?)
  → data = _buildFullBackupData()          // RAM (+ some LS getItem)
  → if selectedKeys: delete other entity keys; data.partial = true
  → finalizeBackupPackage (magic, schemaVersion 1, sectionChecksums djb2-style, manifest)
  → optional encrypt
  → attachChecksum SHA-256 (skipped / "none" when crypto.subtle missing, e.g. some file://)
  → download Blob (Laegh_backup_<jalali-date>.json)
  → optional Host.WriteBackupText to %AppData%\Sirman\backup
  → mirrorBackupToIDB / recordBackupLayer (best-effort, errors swallowed)
```

| Entity | Exported? | Full or partial? | Source store | Transform | Checksum |
|---|---|---|---|---|---|
| warranties | YES if RAM has them and key not deleted by selective export | Full array copy | RAM `warranties` | `_safeArr`; missing → `[]` | section hash if key listed in `sections`; global SHA-256 if crypto available |
| invoices | YES (same rules) | Full array | RAM | `_safeArr` | same |
| products | YES | Full array | RAM | `_safeArr` | same |
| inventory | YES in full builder; **easy to omit** in checkbox selective UI | object | RAM | `_safeObj` | same |
| stockMoves | YES in builder; **not** on export checkbox grid | array | RAM | `_safeArr` | may not be in `sections[]` |
| customers / phonebook | YES | array | RAM | `_safeArr`; `pb` alias | same |

Backup does **not** re-read IndexedDB entity tables (there are none for warranties). If persist already failed, backup exports whatever is still in RAM. If the user backed up after a refresh that rehydrated incomplete LS, backup omits the lost rows.

The packet states a real shop file contains a `warranties` array. That file is **not on this VM**. This audit cannot count its rows.

---

## 9. Restore pipeline

```text
User selects JSON
  → FileReader text
  → parse / unwrap / decrypt
  → canRestoreSchema: fileVer > appVer → REJECT entire file
                    fileVer ≤ appVer → accept (older upgraded)
  → checksum mismatch → confirm(), not hard fail
     missing checksum → treated OK
  → applySchemaMigrations + migrateBackup
  → itemCounts mismatch → debug warn only
  → validateBackupPackage errors → confirm(), not hard fail
  → preview modal (section checkboxes; default mode merge if radio missing)
  → applyBackupSelective(d, keys, mode)
       safety = _buildFullBackupData(); saveSafetySnapshot(IDB)
       replace | merge
       persist sv* in try/catch empty
       render* in try/catch empty
       success ntf + alert
```

`SIRMAN_SCHEMA_VERSION = 1`. Newer schema is a hard reject. Older is migrated.

### 9.1 Missing `warranties` (critical)

`migrateBackup` ~13906:

```text
if (!d.warranties) { d.warranties = []; log.push('🛡 گارانتی: خالی (نسخه قدیمی)'); }
```

Then replace ~14277:

```text
if (_restoreWants(selectedKeys,'warranties'))
  warranties = Array.isArray(d.warranties) ? d.warranties : [];
```

`_restoreWants(null/empty)` is **true for every key** (full restore / safety rollback).

| If `warranties` is missing or not an array | Restore does |
|---|---|
| Reject entire backup? | **NO** (A ruled out) |
| Restore five records? | Only if the array has five (B only when array present) |
| Restore zero? | **YES** in replace — assigns `[]` (C) |
| Preserve existing live records? | **YES** in merge if incoming is `[]` (forEach adds nothing) — **NO** in replace (D vs wipe) |
| Silently continue? | **YES** — logs “خالی (نسخه قدیمی)” and continues (E) |

So: **replace + missing section = wipe that section.** Merge + missing section = keep live (for warranties). After a factory reset, live is already `[]`, so both modes show empty if the file had no warranties.

Merge identity is **`id` only**. Existing id is skipped (not updated). Missing/changed ids → duplicates or “missing” in UI.

### 9.2 Partial restore

One section can apply while another is skipped (unchecked keys) or persist-fails independently (`try/catch` per `sv*`).  
**PARTIAL RESTORE RISK = HIGH** (proven in source).

---

## 10. Atomicity

| Question | Answer |
|---|---|
| Backup atomic? | NO — in-memory snapshot, then download/IDB/Host best-effort. Selective delete is not transactional with the shop SoT. |
| Restore atomic? | NO — `prepareAtomicRestore` only clones objects. Not a multi-objectStore transaction. |
| Restore transactional? | NO native DB transaction. IDB `safety` write is best-effort. |
| Section-by-section? | **YES** |
| If warranties persist fails halfway? | RAM may already be replaced; LS may still hold old or partial keys. Other sections may have persisted. |
| If inventory succeeds and warranties fail? | UI still gets a success toast from `applyBackupSelective`. Persist errors swallowed. |
| If a single IDB transaction aborts? | Backup IDB helpers `resolve()` on error. Restore continues. |
| Can Restore report success while some sections were not written to LS? | **YES** |

Rollback on throw: `applyBackupReplaceSections(safety, null)` — full replace from RAM snapshot taken **before** apply. If persist of safety also fails, UNKNOWN durable state.

---

## 11. Real backup-file verification

Requested artifact:

```text
Laegh_backup__۱۴۰۵-۰۶-۰۲_.json
```

Search of `/workspace`, `/home/ubuntu`, `/tmp`, `/opt/cursor` for `*Laegh_backup*` / `*۱۴۰۵*`: **no file**.

| Field | Value from file |
|---|---|
| schemaVersion | UNKNOWN |
| version | UNKNOWN |
| exportedAt | UNKNOWN |
| section presence | UNKNOWN (packet asserts a `warranties` array exists in a real backup; not verifiable here) |
| sectionChecksums | UNKNOWN |
| global checksum | UNKNOWN |
| warranties count | UNKNOWN |
| invoice count | UNKNOWN |

The file, if it existed, would show **what was exported**, not what existed in the app immediately before export. This audit does **not** conclude “backup lost N warranties.”

---

## 12. Restore vs backup consistency

| Topic | Finding |
|---|---|
| Backup schemaVersion | integer `1` (`SIRMAN_SCHEMA_VERSION`) plus `applicationVersion` string `1405.5.27γ` |
| Restore accepted | fileVer ≤ appVer; newer rejected |
| Migration | `migrateBackup` fills missing arrays with `[]`, aliases `svcs`/`services`, `pb`/`phonebook`, sale `status`, warranty `accRef`, missing ids (`mig_war_*`) |
| Unknown fields | kept on the object; not stripped globally |
| Missing section | filled with `[]` then eligible for replace wipe |
| Checksum | advisory confirm |
| itemCounts | advisory warn |

---

## 13. Data-loss scenario reconstruction

Reported shape:

```text
Normal use → Backup → Application reset → Restore → Some warranty records disappear
```

| Cause | Status | Evidence |
|---|---|---|
| A. Never in canonical store | POSSIBLE | User could have seen RAM-only rows after failed `svWars`; UI still listed them. |
| B. Lived only in RAM / other store | POSSIBLE | Quota fail; IDB backup copy not used as SoT; disk media refs are not rows. |
| C. Backup omitted it | POSSIBLE | Selective export deletes unselected keys; RAM already incomplete; checkbox UI can omit sibling entities (not warranties by default — warranties **are** on the export grid). |
| D. Backup contained it; Restore omitted / wiped | **PROVEN as code path** | Missing/non-array `warranties` → `[]` then replace wipes. Merge skips existing ids. Unchecked restore checkbox omits section. After reset, merge of `[]` leaves empty. |
| E. Restore wrote it; UI loaded another source | POSSIBLE | LS vs RAM vs IDB (tasks). Warranty UI reads RAM hydrated from `lw2`. Persist swallow could leave RAM restored and LS empty → refresh loses rows. Phonebook `pb` already mitigated. |
| F. Quota prevented persist before Backup | POSSIBLE (code); not shop-proven | `_persistJsonSafe` / 5 MB heuristic / E004. |
| G. Quota prevented Restore persist | POSSIBLE (code) | `svWarr` false + success alert. |
| H. Older copy overwrote newer | POSSIBLE | Replace from old file; merge skips existing ids so newer live fields not updated; safety/IDB not auto-canonical. |

**Ruled out:** “Core SQLite/EF silently dropped warranties” — no such database exists.  
**Ruled out:** “JsonBackupRepository is the live exporter” — stub `tbd`.  
**Not ruled out:** any combination of C+D+F+G for the shop incident.

---

## 14. Proven vs possible vs unknown

**Proven (architecture / code):**

- Live SoT is HTML `localStorage` + RAM, quota-limited.
- Core persist/backup is TBD; no SQL engine in `desktop/`.
- Backup serializes RAM; restore replace can wipe a section that is missing or non-array.
- Restore is section-by-section best-effort; success UI is not a durable commit.
- Quota failure can drop persist while UI continues.
- Tasks are duplicated across LS and IDB.

**Possible (shop incident):** A, B, C, E, F, G, H.

**Unknown:** shop file counts, shop quota logs, pre-export RAM/LS counts, whether the restore used merge or replace, which checkboxes were selected.

---

## 15. Database requirements (do not implement)

| Requirement | Minimum for SIRMAN |
|---|---|
| Users | Single-user desktop first. Multi-user / concurrent writers later. |
| Placement | Local file next to or under `%AppData%\Sirman`, portable with backup folder. |
| Transactions | Required for restore and multi-entity writes (invoice + inventory + stock move). |
| Backup / restore | Full parity with today’s JSON sections, plus attach-on-disk — not a second incomplete exporter. |
| Attachments | Files on disk; DB stores paths/ids, not unbounded base64 blobs. |
| Search / indexes | Later; not a first-cut blocker. |
| Corruption recovery | File-level backup + integrity check before cutover. |
| HTML-only | Must keep working until native persist has proven parity. |
| Migration | Legacy LS/IDB preserved as rollback until human-verified counts/checksums. |

Entities needing extra migration planning (unstable / blob / HTML / loose refs):

- warranties, invoices, sales: array-of-object blobs, dynamic fields, `accRef` / identity schemes (`id` vs `saleUid` vs `invoiceId`)
- logo / attachments: dataURL vs `disk://` vs `idb:`
- appearance: many independent LS keys
- update packages / full-app HTML blob: not business SoT; keep out of operational DB or store as files
- loginPw / AI keys: secrets — must not remain plaintext JSON in Downloads

---

## 16. Database family (not a final engine pick)

```text
Recommended database family:
  Embedded local file database (relational or document-in-file)
  with real transactions, one file (or one file + media folder),
  single-writer desktop first.

Reason:
  Operational data is already structured entities with cross-refs.
  The failure mode to kill is browser quota + non-atomic section restore.
  A local file DB is the smallest native SoT that matches the Host/AppData model.

Alternatives:
  - SQLite (prior Phase 2 design exists as a parallel adapter — not live SoT)
  - LiteDB / other embedded document file
  - SQL Server / LocalDB — too heavy for current single-shop desktop; not ruled out later

Open decisions:
  - Exact engine (SQLite vs LiteDB vs other) — NOT finalized in this audit
  - Normalized tables vs JSON-column-per-row (Phase 2 SQLite design used JSON columns)
  - Whether HTML keeps a cache after cutover
  - Encryption at rest
```

Do not pick SQLite as final solely because a design doc exists. Do not pick SQL Server because “enterprise.” Family: **embedded local file DB**. Engine: open.

---

## 17. Target architecture (no implementation)

```text
SIRMAN UI (HTML / WebView2)
   ↓  sirmanHost / RunBusiness (existing boundary)
Application / Domain contracts (Sirman.Core)
   ↓
Persistence boundary (new; not JsonBackupRepository stub)
   ↓
Native database file + media folder on disk
```

Distinguish:

| Kind | Target home |
|---|---|
| Operational business data | Native DB (canonical) |
| Backup data | Versioned export files (JSON or DB dump) **derived from** canonical DB — not the SoT |
| Browser localStorage / IndexedDB | Cache / rollback until parity, then archive |
| Temporary files / print artifacts | OS temp / print spooler — not SoT |
| Attachments | Disk folder (`sirman_media` or AppData media), referenced by id |

Goal:

```text
Operational business data  ≠  Browser cache/storage
```

This matches `ARCHITECTURE_RULES.md` (UI ↛ Database directly; Core owns data access) and B20 (persist/backup is a separate program).

---

## 18. Migration strategy (constraints only)

```text
old storage preserved
        ↓
read-only verification (counts per entity, checksums)
        ↓
export legacy data (existing BackupEngine, plus LS dump)
        ↓
import to database (offline, not live dual-write on day one)
        ↓
record counts
        ↓
checksums
        ↓
entity-by-entity parity (warranties/invoices/inventory must match)
        ↓
human verification on shop Windows
        ↓
switch canonical store (feature flag / Host)
        ↓
rollback remains possible (leave LS as source)
```

No destructive cutover. No deleting browser storage in the same change that first enables the DB.

---

## 19. Rollback strategy

Until parity is verified:

```text
legacy localStorage / IndexedDB = rollback source
database = candidate canonical source
```

After full parity and human sign-off:

```text
database = canonical
legacy browser storage = retired/archive (not deleted in the switch commit)
```

Rollback of a future persist program = Host flag back to HTML persist; do not invent a B-step for this.

---

## 20. Risks

| ID | Risk | Severity |
|---|---|---|
| R1 | Browser quota drops persist; UI still looks saved | CRITICAL |
| R2 | Replace restore wipes missing sections to `[]` | CRITICAL |
| R3 | Restore success toast despite persist catch | HIGH |
| R4 | Selective backup / incomplete checkbox UI omits entities | HIGH |
| R5 | Tasks LS/IDB split-brain | HIGH |
| R6 | RAM backup after failed persist exports incomplete SoT | HIGH |
| R7 | Attachments on disk not in JSON — restore looks “fine,” media gone | MEDIUM |
| R8 | Secrets (loginPw, AI keys) in downloaded JSON | HIGH (security) |
| R9 | Dual-write HTML+DB if a future phase wires both without a single SoT | CRITICAL (future) |
| R10 | Shop file / runtime counts not on this VM — incident root cause not unique | MEDIUM (investigation) |

---

## 21. Recommended next architecture decision

**OPTION A — STORAGE ARCHITECTURE MIGRATION REQUIRED**

Not because “a database is nicer.” Because:

1. The live operational store is quota-limited browser storage (`CurrentStorage` says so).
2. Core backup/persist is an explicit TBD stub.
3. Restore is non-atomic and can wipe sections; quota can make persist lie.
4. Phase 3 B20 already classified persist/backup as a **separate program**.

Backup/restore defects (Option B material) are **additional**. Fixing only restore would still leave SoT on `localStorage`.

Option C would apply only if this audit refused to call browser-SoT unreliable. Source is sufficient for A. Shop-file absence does not weaken A; it only leaves **which** incident path fired as UNKNOWN.

**Do not implement the database in the next print/B-step packet.** Open a dedicated persist program with Change Gate Q3 = yes.

---

## 22. Files changed

| File | Role |
|---|---|
| `deliveries/Reports/P3_STORAGE_FORENSIC_AUDIT.md` | This audit |
| `deliveries/Reports/PHASE_3_MIGRATION_TRACKER.md` | Pointer only — B20 status unchanged |

Product / HTML / Core / Host: **not modified**.

---

## 23. Product code changed

```text
NO
```

---

## 24. Final status

```text
COMPLETED
```

Audit is bounded and evidence-based. Shop JSON and shop quota logs are UNKNOWN. No product change. STOP — WAIT FOR REVIEW.

---

## Appendix A — localStorage keys (operational)

| Key | Entity |
|---|---|
| `li` | invoices |
| `lp` | products |
| `lv` | inventory |
| `lb` | phonebook |
| `la` | acH |
| `lc` | invoice counter |
| `ll` | logo |
| `ls` | senderInfo |
| `lp2` | parts |
| `ls2` | services |
| `lw2` | warranties |
| `laegh_invoice_uid_ctr` | invoice uid |
| `laegh_sales` / `laegh_sale_ctr` | sales |
| `laegh_tasks` | tasks |
| `laegh_defective` | defective stock |
| `laegh_accounts` | accounts |
| `laegh_warehouses` | named warehouses |
| `laegh_warehouse` | warehouse documents |
| `laegh_stockmoves` | stock moves |
| `laegh_printSettings` | print settings |
| `laegh_company` / `laegh_service_center` | brand / service center |
| `laegh_sms` / `laegh_tz` / `laegh_network` | sms / tz / network |
| `laegh_ai_key_*` | AI keys |
| plus appearance `laegh_skin`, `laegh_theme`, … | UI prefs |

## Appendix B — Why Option A over B

Option B would be correct if localStorage were an acceptable short-term SoT and only the exporter/importer were wrong. Here the SoT itself cannot guarantee durability (quota, uncaught `sv()`, swallowed restore persist, no transactions). Repairing restore without moving SoT leaves the same class of loss available on the next save. Therefore A.

Option B work (restore: do not coerce missing sections to `[]` in replace; fail persist loudly; make selective export match restore defs) remains valid **inside** a persist program, not instead of it.
