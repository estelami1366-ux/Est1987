# SIRMAN — ARCH-1 Backup/Restore Extraction Audit

**Date:** 2026-09-04  
**Packet:** READ-ONLY architecture extraction map. No refactor, no move, no rename, no delete, no SQLite, no Phonebook change, no live restore, no backup rewrite.  
**Product version left unchanged:** `1405.6.3α`  
**Branch:** `cursor/arch-1-backup-restore-extraction-audit-fa01`  
**Base:** `cursor/p1c7-portable-backup-integrity-fa01`  
**Authority:** source in `Sirman_Final.html`, `desktop/Sirman.Core`, `desktop/Sirman.Desktop`, `test_laegh.js`  
**Standing:** P1C-1..P1C-7 = PASS. Full suite last reported 775/775. This packet does not change tests or HTML.

Checksum fact (P1C-7, still true in source): SHA-256 is UTF-8 of compact `JSON.stringify(payload)` where payload = all object keys except `exportedAt`, `checksum`, `checksumAlgo`. It is **not** a hash of exact disk bytes. `backupId` does not exist in this format and must not be invented.

---

## Phase 3 Change Gate (this packet)

```text
CHANGE: ARCH-1 backup/restore extraction audit (report only)
CLASS: Documentation / architecture map
Q1: CAPABILITY — map existing BackupEngine; do not implement extraction
Q2: RunBusiness / Host / Core: NO code change
Q3: Persistence: NO
Q4: Printing: NO
Q5: HTML-only: UNTOUCHED
Q6: New transport/DB/ACL: NO
RESULT: PASS (report-only; no source edit)
AUTHORITY: explicit user packet ARCH-1 2026-09-04
```

This packet stops after the report. ARCH-1 implementation is **not** started. P1C-8 is **not** started.

---

# 1. Current architecture

## 1.1 Where the engine actually lives

The Backup/Restore subsystem is implemented in **HTML/JS** inside `Sirman_Final.html` (approx. lines 7648–8578 for engine/validators/checksum, 8350–8466 snapshot, 9637–9659 encrypt, 9812–9992 autosave I/O, 14177–15149 export/migrate/restore apply, 28122–28379 network workspace pull).

There is a JS facade object `BackupEngine` (`Sirman_Final.html` ~8306). It does **not** persist. Callers (`exportData`, `importData`, `doAutoSave`, `applyBackupSelective`, `pullNetworkWorkspace`) orchestrate I/O, DOM, live RAM, localStorage, IndexedDB, and Host.

## 1.2 What Core has today (not the engine)

| Artifact | Path | Source fact |
|---|---|---|
| Storage SoT | `desktop/Sirman.Core/Data/CurrentStorage.cs` | `Kind = "html-localStorage-indexeddb"`, `Owner = "Sirman_Final.html"` |
| Backup repository interface | `desktop/Sirman.Core/Data/Repositories/IBackupRepository.cs` | Comments: real schema/migrate/merge/replace are in HTML; **not wired** to BusinessFacade/HTML |
| JSON stub | `desktop/Sirman.Core/Data/Repositories/JsonBackupRepository.cs` | `TbdMarker = "html-backup-engine"`; Export/Import clone a marker object; Merge is `CurrentJsonStore.MergeMap` |
| Business facade | `desktop/Sirman.Core/Application/BusinessFacade.cs` | No backup op in `Dispatch` |
| Folder `desktop/Sirman.Core/Backup/` | — | **Does not exist.** Not created by this packet. |
| Folder `desktop/Sirman.Desktop/Backup/` | — | **Does not exist.** Not created by this packet. |

`IBackupRepository` is a placeholder. It must not be treated as a second engine.

## 1.3 What Desktop/Host does today (string I/O, not hash/validate/migrate)

| Method | File | Source fact |
|---|---|---|
| `GetBackupDir` | `desktop/Sirman.Desktop/SirmanHostObject.cs` ~61 | Returns `%AppData%\Sirman\backup` (creates dir) |
| `WriteBackupText` | same ~82 | Writes UTF-8 no BOM filename under that dir. Returns JSON `{ok,path}`. Does **not** hash, validate, or migrate |
| `WriteWorkspaceFile` / `ReadWorkspaceFile` | same ~230 / ~247 | `sirman-workspace.json` in shared folder; Guard + Host Security Gate |
| `getSirmanHostSync` | `Sirman_Final.html` ~8618 | `chrome.webview.hostObjects.sync.sirmanHost` |
| `writeAutoSaveTarget` | HTML ~9812 | Tries Host `WriteBackupText('sirman_autosave.txt', text)` then File System Access handles |
| Close-path JS inject | `desktop/Sirman.Desktop/MainForm.cs` `TryQuickBackupBeforeClose` ~238 | `ExecuteScriptAsync` calls `_buildFullBackupData()` and writes `localStorage.laegh_autosave_snapshot` |
| Menu “کپی HTML فعلی در بک‌آپ” | `MainForm.cs` `BackupCurrentHtml` | Copies the **HTML file**, not the JSON BackupEngine package |

Two different “backup” concepts exist:

1. **JSON business package** (`SIRMAN_BACKUP`) — this audit’s subject.
2. **Desktop HTML-file copy** into the backup folder — installer/update safety, not BackupEngine.

Architecture rule (`docs/ARCHITECTURE_RULES.md`): UI ↔ Core is only `sirmanHost`. New Host methods must be added to that same object. `fetch`/localhost API for business logic remains forbidden.

## 1.4 Create / verify pipeline (actual)

```text
CREATE
  live RAM + localStorage  (_buildFullBackupData)
    → optional selective key filter (exportData)
    → finalizeBackupPackage
         magic, schemaVersion, applicationVersion
         attachmentsIndex = collectAttachmentIndex
         sectionChecksums = djb2(JSON.stringify(section))
         manifest = buildBackupManifest
    → [encrypt path] attachChecksum THEN encryptBackupPackage
    → [plain path] attachChecksum
         SHA-256(UTF-8(compact JSON.stringify(payload)))
         payload excludes exportedAt, checksum, checksumAlgo
         if no window.crypto → checksumAlgo='none'
    → serialize disk = JSON.stringify(data, null, 2)   // pretty, NOT hashed bytes
    → write: Blob download / File System Access / Host WriteBackupText / localStorage snapshot
    → mirror IndexedDB + recordBackupLayer

VERIFY (importData)
  FileReader UTF-8
    → JSON.parse
    → unwrapBackupEnvelope / decryptBackupPackage
    → validateRequiredBackupCollections          (P1C-1..5, before migrate)
    → validateBackupStructuralIntegrity          (P1C-6)
    → validateBackupPortableIntegrity            (P1C-7 sectionChecksums + unknown algo)
    → canRestoreSchema
    → verifyChecksum (async SHA-256; mismatch FAIL, no confirm)
    → applySchemaMigrations THEN migrateBackup   (mutates package)
    → validateBackupItemCounts again (post-migrate)
    → validateBackupPackage (sectionChecksums here are WARNINGS — records already mutated)
    → openRestorePreviewModal  (no live write yet)
    → confirmRestorePreview → applyBackupSelective
```

Network pull (`prepareNetworkWorkspacePull`) runs required + structural + portable + `migrateBackup`. It does **not** call `verifyChecksum` (no async SHA-256). That is source, not a proposed change.

## 1.5 Constants in HTML (source)

| Symbol | Line | Value |
|---|---|---|
| `SIRMAN_SCHEMA_VERSION` | 7648 | `1` |
| `SIRMAN_BACKUP_MAGIC` | 7649 | `'SIRMAN_BACKUP'` |
| `SIRMAN_BACKUP_ENC_MAGIC` | 7650 | `'SIRMAN_BACKUP_ENC'` |
| `BACKUP_RETENTION` | 7651 | `{ daily:7, weekly:5, monthly:12, archive:9999, safety:3, manual:30 }` |
| `REQUIRED_BACKUP_COLLECTIONS` | 7789 | `['warranties', 'invoices']` |
| `REQUIRED_BACKUP_COLLECTIONS_FROM_SCHEMA` | 7790 | `{ 1: ['sales', 'parts', 'accounts'] }` |

`tasks` is not required. Schema 0 may omit sales/parts/accounts; schema ≥1 may not. `backupId` is not a format field (`validateBackupPortableIntegrity` reports `hasBackupId` if someone already put it there; nothing writes it).

---

# 2. Function inventory

Legend for **Suggested destination** (target after extraction; not implemented here):

- **Core** = `Sirman.Core` (rules, validation, migrate, merge/replace policy)
- **Desktop** = `Sirman.Desktop` (filesystem, WinForms, WebView2 Host)
- **UI** = HTML dialogs / FileReader / render
- **Contract** = Host method + DTO on `sirmanHost`
- **Infra** = hashing/serialization/storage adapters behind Core interfaces

**Pure** means: given the same input object, no live SoT / DOM / Host / localStorage / IndexedDB. Mutating the passed package object still counts as impure vs that object.

All HTML functions are in `Sirman_Final.html` unless noted.

### 2.1 Package finalize / checksum / manifest

| Function | File / line | Current responsibility | Reads | Writes | Globals | localStorage | IndexedDB | DOM/UI | WebView2 | Business-rule | Pure/impure | Suggested destination |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `inferBackupSchemaVersion` | HTML 7653 | Parse `schemaVersion` or `manifest.schemaVersion`; else 0 | `d` | none | none | no | no | no | no | schema number rule | Pure | Core / Validation |
| `canRestoreSchema` | HTML 7665 | Gate: fileVer ≤ appVer; refuse newer schema | args + `SIRMAN_SCHEMA_VERSION` | none | `SIRMAN_SCHEMA_VERSION` | no | no | no | no | no reverse migrate | Pure | Core / Validation |
| `buildBackupManifest` | HTML 7673 | Build manifest object (magic, format, schema, origin, kind, counts, documentedFormat) | `data`, origin, kind, constants | none (returns object) | `SIRMAN_BACKUP_MAGIC`, `SIRMAN_SCHEMA_VERSION` | no | no | no | no | manifest shape | Pure | Core / Contracts |
| `backupSectionHash` | HTML 7690 | djb2 of `JSON.stringify(value)` as unsigned hex | value | none | none | no | no | no | no | section hash algorithm | Pure (hash impl) | Core contract + Infra hashing |
| `attachSectionChecksums` | HTML 7697 | Mutates `data.sectionChecksums` for listed/all keys except skip set | `data` | `data.sectionChecksums` | none | no | no | no | no | skip-key set | Impure vs package | Core / Integrity |
| `collectAttachmentIndex` | HTML 7709 | Walk warranties/sales/invoices `docs`/`attachments`; `parentId = rec.id` | `d` collections | none (returns array) | may call `isDiskRef` | no | no | no | no | kind/parent mapping | Pure if `isDiskRef` treated as helper | Core / Integrity |
| `finalizeBackupPackage` | HTML 7741 | Sets magic, schemaVersion, applicationVersion, attachmentsIndex, sectionChecksums, manifest | `data` | those fields on `data` | magic/schema constants | no | no | no | no | package shape | Impure vs package | Core / Services |
| `cloneBackupData` | HTML 7751 | `JSON.parse(JSON.stringify(d))` | `d` | none | none | no | no | no | no | none | Pure | Core util |
| `backupChecksumExcludedKey` | HTML 8018 | true for exportedAt/checksum/checksumAlgo | key | none | none | no | no | no | no | canonical exclusions | Pure | Core / Integrity |
| `backupChecksumPayload` | HTML 8021 | Copy keys except the three exclusions | `data` | none | none | no | no | no | no | canonical payload | Pure | Core / Integrity |
| `backupChecksumCanonicalString` | HTML 8030 | `JSON.stringify(payload)` compact | `data` | none | none | no | no | no | no | canonical string | Pure | Core / Integrity |
| `backupCryptoSubtle` | HTML 8033 | Locate `crypto.subtle` on crypto/window/globalThis | env | none | `crypto`, `window` | no | no | no | no | none | Impure (env) | Infra (Desktop SHA-256); UI fallback |
| `classifyBackupChecksumClaim` | HTML 8045 | claimed iff checksum and algo present and algo ≠ `none` | `d` | none | none | no | no | no | no | claim vs skip | Pure | Core / Integrity |
| `attachChecksum` | HTML 8480 | SHA-256 of canonical string; missing `window.crypto` → `none`; digest error → `error` | `data`, WebCrypto | `data.checksum`, `data.checksumAlgo` | `window.crypto` | no | no | no | no | SHA-256 definition | Impure (crypto + mutate) | Core policy + Infra hash |
| `verifyChecksum` | HTML 8513 | Compare stored SHA-256; unknown algo FAIL; no subtle → skip ok; digest exception FAIL | `data`, WebCrypto | none | `window.crypto` | no | no | no | no | fail-closed SHA-256 | Impure (crypto) | Core policy + Infra hash |
| `encryptBackupPackage` | HTML 9637 | AES-GCM + PBKDF2 100000; envelope `SIRMAN_BACKUP_ENC` | data, passphrase, WebCrypto | none (returns envelope) | `window.crypto` | no | no | no | no | encryption format | Impure (crypto) | Core policy + Infra crypto |
| `decryptBackupPackage` | HTML 9649 | Inverse of encrypt | envelope, passphrase | none | `window.crypto` | no | no | no | no | encryption format | Impure (crypto) | Core policy + Infra crypto |
| `isEncryptedBackup` | HTML 8303 | `magic === SIRMAN_BACKUP_ENC_MAGIC` | `d` | none | constant | no | no | no | no | envelope detect | Pure | Core / Contracts |
| `unwrapBackupEnvelope` | HTML 8236 | Flatten `{database,settings}` envelope; leave ENC magic alone | rawObj | none (returns merged) | magic constants | no | no | no | no | envelope shape | Pure | Core / Migration |

### 2.2 Validation

| Function | File / line | Current responsibility | Reads | Writes | Globals | localStorage | IndexedDB | DOM/UI | WebView2 | Business-rule | Pure/impure | Suggested destination |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `backupHasOwnCollection` | HTML 7791 | `hasOwnProperty` on package | `d`, key | none | none | no | no | no | no | MISSING ≠ EMPTY | Pure | Core / Validation |
| `inferRequiredBackupSchemaVersion` | HTML 7794 | Delegates to `inferBackupSchemaVersion` or inlined copy | `d` | none | none | no | no | no | no | schema for required map | Pure | Core / Validation |
| `requiredBackupCollectionsFor` | HTML 7807 | Always warranties+invoices; if ver≥1 add sales, parts, accounts | `d`, registries | none | `REQUIRED_BACKUP_COLLECTIONS`, `REQUIRED_BACKUP_COLLECTIONS_FROM_SCHEMA` | no | no | no | no | P1C-1..5 registry | Pure | Core / Validation |
| `validateRequiredBackupCollections` | HTML 7819 | Fail-closed: missing/null/non-array/non-object records | `d` | none | registries via helper | no | no | no | no | MISSING ≠ EMPTY | Pure | Core / Validation **(first extraction)** |
| `validateBackupItemCounts` | HTML 7889 | Absent itemCounts compatible; present must be object of finite numbers matching array lengths; never repair | `d` | none | none | no | no | no | no | P1C-6 counts | Pure | Core / Validation |
| `validateBackupAttachmentIndex` | HTML 7925 | Absent index compatible; present non-array FAIL; kind+parentId must exist as `rec.id` | `d` | none | none | no | no | no | no | P1C-6 attachments | Pure | Core / Validation |
| `detectBackupDuplicateIdentities` | HTML 7960 | WARN only; invoices.invoiceId, sales.saleUid, warranties.id, accounts.id, parts.id; Phonebook not scanned | `d` | none | none | no | no | no | no | duplicate warn, frozen PB | Pure | Core / Validation |
| `validateBackupStructuralIntegrity` | HTML 7986 | Combines required + counts + attachments + duplicates | `d` | none | none | no | no | no | no | P1C-6 combiner | Pure | Core / Validation |
| `validateBackupSectionChecksums` | HTML 8052 | Present map must match djb2; missing compatible; bad type FAIL | `d` | none | `backupSectionHash` | no | no | no | no | P1C-7 sections | Pure | Core / Integrity |
| `validateBackupPortableIntegrity` | HTML 8079 | Section checksums + unknown SHA algo when claimed; reports hasBackupId but does not require it | `d` | none | helpers | no | no | no | no | P1C-7 portable | Pure | Core / Integrity |
| `validateBackupPackage` | HTML 7755 | Known keys; itemCounts/attachments; **sectionChecksums as warnings**; invoice items array warning | `d` | none | helpers | no | no | no | no | post-migrate wrap | Pure | Core / Validation (keep warning semantics) |
| `assertRequiredBackupCollections` | HTML 7858 | Throws on required + counts + attachments + portable | `d` | none | helpers | no | no | no | no | restore/merge/replace gate | Pure (throws) | Core / Validation |
| `backupValidationStatus` | HTML 7883 | INVALID / VALID_WITH_WARNINGS / VALID | result | none | none | no | no | no | no | status enum | Pure | Core / Contracts |
| `verifyLayerPayload` | HTML 8191 | Parse layer string; `validateBackupPackage` only — **not** SHA-256 | payload | none | none | no | no | no | no | layer JSON check | Pure | Core / Validation |
| `testRestoreBackup` | HTML 8257 | Clone → unwrap → required/structural/portable → schema gate → schema migrate + `migrateBackup` → `validateBackupPackage`; `applied:false` | `d` | none (clone) | schema constants, `migrateBackup` | no | no | no | no | dry-run restore | Pure vs live SoT | Core / Services |
| `BackupEngine` | HTML 8306 | Facade over the above; no persist | `d` | none | those functions | no | no | no | no | same | Pure facade | Core façade later; keep HTML alias |

### 2.3 Migration

| Function | File / line | Current responsibility | Reads | Writes | Globals | localStorage | IndexedDB | DOM/UI | WebView2 | Business-rule | Pure/impure | Suggested destination |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `SCHEMA_MIGRATIONS` | HTML 8104 | Only 0→1: magic, schemaVersion=1, fill missing sales/parts/accounts `[]`, attachmentsIndex, manifest. Schema ≥1 never enters | `d` | those fields | magic, `collectAttachmentIndex`, `buildBackupManifest` | no | no | no | no | Decision B 0→1 fill | Impure vs package | Core / Migration |
| `applySchemaMigrations` | HTML 8132 | Clone, `canRestoreSchema`, run steps until target | `d` | clone only | `SCHEMA_MIGRATIONS`, `SIRMAN_SCHEMA_VERSION` | no | no | no | no | versioned steps | Impure vs clone | Core / Migration |
| `SCHEMAS` | HTML 14016 | Canonical field defaults per section | — | — | this object | no | no | no | no | field defaults | Data | Core / Contracts |
| `migrateRecord` | HTML 14034 | Defaults then copy **all** rec keys (extra fields kept) | rec, defaults | none (returns) | none | no | no | no | no | no data drop | Pure | Core / Migration |
| `migrateSection` | HTML 14050 | Map array through `migrateRecord` | arr | none | none | no | no | no | no | section project | Pure | Core / Migration |
| `migrateBackup` | HTML 14323 | In-place: pb→phonebook, services/svcs alias, P1C fail-closed vs schema-0 fill, warranties required + accRef, sales status='final', tasks=[], IDs, invoiceId/saleUid, SCHEMAS | `d` | **mutates `d`** | `SCHEMAS`, `inferRequiredBackupSchemaVersion` | no | no | no | no | large restore policy | Impure vs package | Core / Migration (high risk) |

`migrateBackup` does **not** assign live globals. Callers do.

### 2.4 Snapshot / create / serialize / write

| Function | File / line | Current responsibility | Reads | Writes | Globals | localStorage | IndexedDB | DOM/UI | WebView2 | Business-rule | Pure/impure | Suggested destination |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `_buildFullBackupData` | HTML 8350 | Snapshot live RAM + many localStorage keys into package object | live arrays, counters, appearance keys, company, sms, tz, network, AI keys, print, logo | none (returns object) | `invoices, products, inventory, phonebook, parts, services, warranties, sales, tasks, accounts, defectiveStock, warehouseDocs, stockMoves, warehouses, daqi*, postalHistory, userAuditLog, bgAuditLog, userRoles, loginPw, senderInfo, logoSrc, acH, counters` | **heavy** (`laegh_printSettings`, `laegh_company`, appearance, `laegh_sms`, `laegh_tz`, `laegh_network`, AI keys, …) | no | no | no | which sections belong in a full backup | **Highly impure** | UI/adapter gathers DTO; Core defines schema of snapshot — **do not extract first** |
| `buildBackupObject` | HTML 8469 | `_buildFullBackupData` + `finalizeBackupPackage(..., 'autosave', 'full')` | live via snapshot | finalize mutates package | same | same | no | no | no | autosave origin | Impure | Application orchestration |
| `exportData` | HTML 14177 | Snapshot → selective filter → finalize → optional encrypt (checksum first) → pretty Blob download → IDB mirror → layer | live, DOM pw | download, `laegh_last_backup` | live via snapshot | yes | `mirrorBackupToIDB`, `recordBackupLayer` | `#bk-encrypt-pw`, `<a download>`, `ntf`, `confirmUnencryptedBackup` | no | full vs partial | Impure | UI download + Core finalize; Desktop write later |
| `exportSelected` | HTML 14249 | Reads `.sec-chk` then `exportData` | DOM | none | none | no | no | yes | no | none | Impure | UI |
| `exportArchiveBackup` | HTML 14266 | Same snapshot + `immutable` + checksum + download + layer archive | live | download | live | no | layers | download, `ntf` | no | archive origin | Impure | UI + Core origin flag |
| `doAutoSave` | HTML 9951 | `buildBackupObject` → checksum → pretty JSON → IDB → Host/FS write or `laegh_autosave_snapshot` | dirty flag, handles | disk / LS / IDB | `isDirty`, handles | yes | yes | status UI | **WriteBackupText** | autosave | Impure | Desktop FS + UI fallback |
| `writeAutoSaveTarget` | HTML 9812 | Host first, then file handle, then folder handle | text, handles | disk | `autoSaveFileHandle`, `autoSaveDirHandle` | no | no | no | **WriteBackupText** | none | Impure | Desktop / FileSystem |
| `WriteBackupText` | Host CS 82 | UTF-8 write under backup dir | filename, content | filesystem | — | — | — | — | Host impl | none | Impure | Desktop (already) |
| `serialization` (inline) | `JSON.stringify(data, null, 2)` at export/autosave | Pretty-print package including checksum fields | object | string | none | no | no | Blob | no | pretty ≠ hashed | Impure I/O | Infra serializer (keep pretty vs canonical split) |

### 2.5 Restore preview / apply

| Function | File / line | Current responsibility | Reads | Writes | Globals | localStorage | IndexedDB | DOM/UI | WebView2 | Business-rule | Pure/impure | Suggested destination |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `getBackupSectionDefs` | HTML 14567 | Section labels/kinds for preview grid | none | none | none | no | no | no | no | section catalog | Pure data | Core / Contracts + UI labels |
| `describeBackupValue` / `summarizeBackupInventory` | HTML 14608 / 14633 | Count/text for preview | `d` | none | none | no | no | no | no | display counts | Pure | UI (labels) + Core counts |
| `openRestorePreviewModal` | HTML 14656 | Fill `#restore-preview-modal`; set `_pendingRestore`; compare live lengths for warning | `d`, live arrays | `_pendingRestore` | invoices/products/phonebook/parts/warranties/sales lengths | no | no | **yes** | no | none | Impure | UI |
| `confirmRestorePreview` | HTML 14708 | Read checkboxes + mode; `confirm()` on replace; `applyBackupSelective` | DOM, `_pendingRestore` | live via apply | `_pendingRestore` | via apply | via apply | **yes** + `confirm`/`alert` | no | replace confirm | Impure | UI confirm → Core apply DTO |
| `runPendingTestRestore` | HTML 14730 | `testRestoreBackup` on pending; alert; no apply | `_pendingRestore` | none | same | no | no | alert | no | dry-run | Impure UI | UI + Core testRestore |
| `applyBackupSelective` | HTML 14743 | assert → safety snapshot (`_buildFullBackupData` + IDB) → merge or replace → toast/alert; rollback `applyBackupReplaceSections(safety)` | `d`, live | live + LS + IDB safety | live SoT | via apply | `saveSafetySnapshot` | ntf/alert/emit | no | merge vs replace | **Highly impure** | Core orchestration **on DTO**, UI persist/render adapter |
| `applyBackupReplaceSections` | HTML 14778 | Assign live globals; write many LS keys; `sv*` persist; `render*` | `d`, selectedKeys | **live RAM + localStorage** | invoices, products, inventory, phonebook, parts, services/svcs, warranties, sales, tasks, accounts, warehouses, daqi*, postalHistory, logs, acH, userRoles, loginPw, logoSrc, senderInfo, counters | **many** (`laegh_company`, appearance, `laegh_sms`, `ll`, `ls`, `la`, warehouses, login pw, …) | no directly | render\* | no | replace policy; warranties/invoices assigned without Array.isArray (assert is the gate); phonebook pb coerce | **Highly impure** | Core replace **function of two DTOs**; HTML persist/render |
| `applyBackupMergeSections` | HTML 14907 | Identity merge-skip then persist+render | `d` + live arrays | **mutates live arrays + LS** | same live arrays | company/print/logo/sender/acH/roles | no | render\* | no | identity keys (invoiceId/id/num; phone first phone; parts.id; warranties.id; sales.saleUid/id; accounts.id). Empty phonebook phone **always inserts** (frozen) | **Highly impure** | Core merge policy on DTOs; HTML persist |
| `applyAll` | HTML 14902 | `applyBackupReplaceSections(d, null)` using **implicit global `d`** | global `d` | live | **implicit `d`** | via replace | no | via replace | no | full replace | Impure / hidden global | Do not keep this pattern in Core |
| `importData` | HTML 15001 | FileReader parse → unwrap/decrypt → required → structural → portable → schema → verifyChecksum → migrate → itemCounts → validateBackupPackage → preview | file input | none until confirm | none (local `d`) | audit LS | audit IDB | FileReader, prompt, alert, modal | no | restore gate order | Impure I/O | UI read + Core validate/migrate |
| `prepareAtomicRestore` | HTML 8288 | `{ safety: clone(current), incoming: clone(incoming) }` | two objects | none | none | no | no | no | no | atomic pair | Pure | Core / Services |
| `saveSafetySnapshot` | HTML 9570 | IDB `safety` store current + timestamped; prune | data | IDB | `BACKUP_RETENTION` | no | **yes** | no | no | retention | Impure | Desktop/HTML infra until Core storage |
| `openLastSafetyForRestore` | HTML 9602 | Read IDB current safety → preview modal | IDB | none | none | no | **yes** | ntf + modal | no | none | Impure | UI + infra |

### 2.6 Network workspace (same package, Host read)

| Function | File / line | Current responsibility | Reads | Writes | Globals | localStorage | IndexedDB | DOM/UI | WebView2 | Business-rule | Pure/impure | Suggested destination |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `previewNetworkWorkspaceMerge` | HTML 28122 | Read-only classifier mirroring merge identity rules | incoming + live snapshot | none | live via `_networkPullLiveSnapshot` | no | no | no | no | same identities as merge | Pure if live passed in | Core / Services |
| `prepareNetworkWorkspacePull` | HTML 28237 | Parse → known package → schema gate → required/structural/portable → `migrateBackup` → preview. **No `verifyChecksum`** | raw string/object | none (clone) | validators, `migrateBackup` | no | no | no | no | same P1C gates minus SHA-256 | Pure vs live SoT | Core / Services |
| `openNetworkPullPreviewModal` | HTML 28304 | Render `#network-pull-preview-modal` from `_pendingNetworkPull` | pending | none | `_pendingNetworkPull` | no | no | **yes** | no | none | Impure | UI |
| `confirmNetworkPullPreview` | HTML 28343 | `applyBackupSelective(..., 'merge')` | pending | live via apply | `_pendingNetworkPull` | via apply | via apply | ntf | no | merge-only | Impure | UI → Core apply |
| `pullNetworkWorkspace` | HTML 28360 | Host `ReadWorkspaceFile` → prepare → pending modal | Host JSON | none until confirm | network settings | network LS via `loadNetworkSettings` | no | ntf | **ReadWorkspaceFile**, `SetNetworkConfig` | workspace file is backup package | Impure | Desktop Host + Core prepare |

### 2.7 Browser infra around backup (not Core)

| Function | File / line | Current responsibility | IndexedDB / other | Suggested destination |
|---|---|---|---|---|
| `openBackupIDB` | HTML 8551 | DB `laegh-backup-db` v4: snapshots, fsHandles, layers, safety, backupAudit, prefs | IndexedDB | HTML/Desktop infra |
| `mirrorBackupToIDB` | HTML 9454 | Keep last 10 snapshots | IndexedDB | infra |
| `recordBackupLayer` / `pruneBackupRetention` / `layersDueForPromotion` | HTML 9497 / 8201 / 8166 | Layer 3-2-1 copies | IndexedDB | policy Core later; store infra |
| `logBackupAudit` | HTML 9620 | `laegh_backup_audit` LS + IDB `backupAudit` | both | UI/infra |
| `chooseAutoSaveFile` / `chooseAutoSaveFolder` | HTML 9851+ | File System Access picker | IDB handles | UI |

---

# 3. Domain / Application / Infrastructure / UI / Host

Classification of **responsibilities** (not a claim that they already live in those layers).

### DOMAIN

- Required-collection registry (warranties, invoices always; sales/parts/accounts from schema ≥1).
- MISSING ≠ EMPTY.
- Identity keys for merge (invoiceId/id/num; saleUid/id; warranty id; account id; part id; phonebook first phone — including the frozen empty-phone insert).
- Field defaults in `SCHEMAS`.
- Schema version integer separate from `applicationVersion`.
- Magic strings `SIRMAN_BACKUP` / `SIRMAN_BACKUP_ENC`.
- Canonical checksum exclusions (`exportedAt`, `checksum`, `checksumAlgo`).
- Attachment parent mapping: warranty→warranties, sale→sales, invoice→invoices via `rec.id`.

### APPLICATION

- Backup/restore orchestration: finalize → checksum → serialize; import gate order; merge vs replace; safety snapshot then rollback.
- Validation combiners (`validateBackupStructuralIntegrity`, `validateBackupPortableIntegrity`, `validateBackupPackage`).
- Migration policy: `SCHEMA_MIGRATIONS` 0→1 fill vs schema≥1 fail-closed; `migrateBackup` record upgrades.
- Restore policy: selective keys; network pull is merge-only; `testRestoreBackup` applied=false.
- Retention policy object `BACKUP_RETENTION` (limits), independent of IDB.

### INFRASTRUCTURE

- Filesystem: `WriteBackupText`, File System Access, Blob download, `ReadWorkspaceFile`.
- Serialization: compact canonical stringify vs pretty `JSON.stringify(..., null, 2)`.
- Hashing: WebCrypto SHA-256; djb2 `backupSectionHash`.
- Storage: localStorage SoT via `sv*`; IndexedDB `laegh-backup-db`; Host AppData.
- Attachments: disk: / idb: refs; `collectAttachmentIndex` metadata only (does not copy blobs).
- Crypto envelope AES-GCM/PBKDF2.

### UI

- Restore/network preview modals, checkboxes, confirm/alert/ntf, FileReader picker, encrypt password field, backup manager layer list, autosave status, `applyAppearanceSettings` / `render*` after apply.

### HOST

- `sirmanHost` methods listed in §1.3.
- `getSirmanHostSync` / `runBusinessCore` (backup does **not** call `RunBusiness` today).
- `MainForm` ExecuteScriptAsync close-path snapshot (Host → JS engine, inverted vs target direction).

---

# 4. Dependency map (as implemented)

```text
TODAY (actual)

  Desktop MainForm (close JS inject)
        ↓ ExecuteScriptAsync
  Sirman_Final.html
        ├── live globals (SoT)
        ├── localStorage / IndexedDB
        ├── DOM FileReader / Blob / confirm
        └── getSirmanHostSync()
              ↓
        SirmanHostObject (WriteBackupText / ReadWorkspaceFile)
              ↓
        NTFS  %AppData%\Sirman\backup  / workspace file

  Sirman.Core IBackupRepository / JsonBackupRepository
        └── unused TBD stub  (no arrow from HTML)

TARGET (docs/ARCHITECTURE_RULES.md — not implemented)

  HTML/UI
     ↓  sirmanHost contract
  Sirman.Desktop (Host + filesystem adapters)
     ↓  Core API
  Sirman.Core (validation, integrity, migration, restore policy)
     ↓  infrastructure abstractions
  filesystem / hash / json / future DB
```

**Confirmed target direction**

| Layer | May depend on | Must not depend on |
|---|---|---|
| HTML/UI | Host contract, render, FileReader | Core internals, WinForms |
| Host contract | Desktop implementation | — |
| Sirman.Core | abstractions (IHash, IBackupStore, DTOs) | DOM, WebView2, localStorage, IndexedDB, WinForms |
| Sirman.Desktop | WebView2, WinForms, filesystem, Core | HTML globals |

Core **MUST NOT** depend on DOM, WebView2, localStorage, IndexedDB, or WinForms.

Desktop **may** depend on WebView2, WinForms, and filesystem implementation.

Today Core is **not** on this path for backup. HTML talks to Desktop I/O and keeps the engine.

---

# 5. Browser-state dependencies (extraction risks)

These are the main reasons a naive move will change behavior.

### 5.1 Live arrays as source of truth

`_buildFullBackupData` and both apply functions read/write module-level arrays: `invoices`, `products`, `inventory`, `phonebook`, `parts`, `services`/`svcs`, `warranties`, `sales`, `tasks`, `accounts`, `defectiveStock`, `warehouseDocs`, `stockMoves`, `warehouses`, `daqi`, `daqiWarehouse`, `daqiVouchers`, `postalHistory`, `userAuditLog`, `bgAuditLog`, `userRoles`, plus scalars `loginPw`, `logoSrc`, `senderInfo`, `acH`, counters (`invCtr`, `invoiceUidCtr`, `saleCtr`, `saleUidCtr`).

Core cannot assign those names. Extraction must take a **snapshot DTO in** and return a **resulting DTO out**. HTML (or a Desktop adapter) applies DTO → RAM/`sv*`.

### 5.2 Implicit globals

- `applyAll()` uses global `d` (test/legacy). Core must never require a global package named `d`.
- `_pendingRestore` / `_pendingNetworkPull` hold UI confirmation state.
- `autoSaveFileHandle` / `autoSaveDirHandle` are File System Access handles in RAM + IDB.
- `typeof fn === 'function'` guards everywhere — Core ports must not silently skip validators.

### 5.3 localStorage helpers (not just keys)

Apply does not only `setItem`. It calls `sv`, `svParts`, `svSvcs`, `svSales`, `svWarr`, `svTasks`, `svAccounts`, `svWarehouses`, `svDaqi*`, `svPostalHistory`, `svRoles`, `applyBrand`, `applyAppearanceSettings`, `ensureAllInvoiceIdentities`, `ensureAllSaleIdentities`, `ensureSaleCtr`, `applyPrefsBundle` / `persistPrefsBundle`.

Those helpers are the real persist path. A Core merge that returns JSON without HTML calling `sv*` would look successful and leave screens empty (governance skill law 4 — dual-variable class of bug).

### 5.4 Current application state used by preview

`openRestorePreviewModal` compares live `invoices/products/phonebook/parts/warranties/sales` lengths to the file to warn. That is UI, but it couples preview to RAM.

`previewNetworkWorkspaceMerge` defaults `live` to `_networkPullLiveSnapshot()` if omitted.

### 5.5 DOM callbacks and confirmation state

- `importData` uses FileReader, `prompt` for encrypt password, `alert` on every fail-closed gate.
- Replace mode uses `confirm()`.
- SHA-256 mismatch no longer uses `confirm()` (P1C-7).
- Encrypt preference reads `#bk-encrypt-pw` and `isBackupEncryptPreferred`.
- `openLastSafetyForRestore` calls `ntf` then preview modal.

### 5.6 Dual checksum semantics (easy to “fix” wrongly)

| Mechanism | When FAIL | When warning |
|---|---|---|
| `validateBackupPortableIntegrity` / `validateBackupSectionChecksums` | present `sectionChecksums` mismatch, **before** migrate | missing map = compatible |
| `validateBackupPackage` | itemCounts/attachments errors | **sectionChecksums mismatch = warning** (after migrate mutated records) |
| `verifyChecksum` | SHA-256 mismatch, unknown algo, digest throw | missing / `none` / no subtle |

Pretty disk JSON is not what is hashed. Extracting a “hash the file bytes” implementation would break existing files.

### 5.7 Phonebook (frozen for this map)

- Snapshot writes `phonebook` only (`pb` comment: deleted as live SoT).
- `migrateBackup` may convert `d.pb` → `d.phonebook` and sets `d.pb = d.phonebook`.
- Replace/merge still accept `d.pb` if `phonebook` empty.
- Merge: identity is first phone string; **empty phone always inserts**.
- `detectBackupDuplicateIdentities` does **not** scan Phonebook.

This packet does not change that. Extraction must copy these rules, not “clean” them.

### 5.8 Host inverted dependency

`MainForm.TryQuickBackupBeforeClose` depends on HTML function `_buildFullBackupData`. Target direction is HTML → Host → Core, not Host → HTML engine. Close-path must stay on the HTML engine until snapshot assembly is a Core API with an HTML-only fallback.

### 5.9 Crypto / file:// degradation

`attachChecksum`: `!window.crypto` → `checksumAlgo='none'` (keeps file:// tests).  
`verifyChecksum`: no `subtle` → `{ok:true, skipped, unverifiable}`.  
Unknown algo when checksum claimed → FAIL.

Core hash adapter must preserve `none` skip; must not invent `backupId`.

---

# 6. Proposed Core / Desktop / UI boundaries

Do **not** create these directories in this packet. They are a map onto the **existing** tree.

Existing relevant layout:

```text
desktop/Sirman.Core/
  Application/BusinessFacade.cs     (no backup ops)
  Business/                         (invoice/warranty/inventory rules — not backup)
  Data/CurrentStorage.cs
  Data/Repositories/IBackupRepository.cs   (TBD stub — do not silently replace)
  Validation/EntityValidator.cs
  Printing/                         (parallel module; frozen)
  Infrastructure/

desktop/Sirman.Desktop/
  SirmanHostObject.cs               (WriteBackupText, GetBackupDir, workspace I/O)
  MainForm.cs                       (HTML-file copy + JS inject snapshot)
```

Proposed **future** module (parallel to `Printing/`, matching architecture “Backup” box):

```text
desktop/Sirman.Core/Backup/
  Contracts/
    BackupPackage.cs              // magic, schemaVersion, sections, itemCounts, manifest
    BackupManifest.cs
    RequiredCollectionsRegistry.cs
    RestoreMode.cs                // merge | replace
    BackupValidationResult.cs     // ok, errors, warnings, status, P1C fields
  Validation/
    RequiredCollectionsValidator.cs    // validateRequiredBackupCollections
    ItemCountsValidator.cs
    AttachmentIndexValidator.cs
    DuplicateIdentityDetector.cs
    StructuralIntegrityValidator.cs
    BackupPackageValidator.cs          // validateBackupPackage warning semantics
  Integrity/
    CanonicalChecksum.cs               // exclusions + compact JSON string (no SHA impl)
    SectionChecksums.cs                // djb2 policy
    PortableIntegrityValidator.cs
    IBackupHashService.cs              // SHA-256 abstraction
  Migration/
    SchemaMigration.cs                 // SCHEMA_MIGRATIONS 0→1 only
    RecordFieldMigration.cs            // SCHEMAS / migrateRecord
    BackupMigrator.cs                  // migrateBackup behavior
  Services/
    BackupFinalizer.cs                 // finalizeBackupPackage
    RestoreOrchestrator.cs             // gates + merge/replace on DTOs + safety pair
    NetworkWorkspacePreparer.cs        // prepareNetworkWorkspacePull without Host

desktop/Sirman.Core/Infrastructure/   (or Desktop adapters referenced by Core interfaces)
  JsonBackupSerializer.cs              // pretty vs canonical
  Sha256BackupHash.cs                  // System.Security.Cryptography

desktop/Sirman.Desktop/Backup/
  FileSystem/
    AppDataBackupWriter.cs             // current WriteBackupText behavior
    WorkspaceFileStore.cs              // Read/WriteWorkspaceFile
  WebViewHost/
    // methods stay ON SirmanHostObject (architecture rule: no parallel host object)
    // e.g. ValidateBackupJson / MigrateBackupJson later — not in this packet
```

**Do not** grow `JsonBackupRepository` into a fake engine. Either keep the TBD marker until a real Core engine exists, or replace it in a dedicated packet with tests proving parity. `IBackupRepository.Export/Import/Merge` today is not `exportData`/`migrateBackup`/`applyBackupSelective`.

**Host contract later (not now):** any Core backup op from HTML must be a new method on the same `sirmanHost` (e.g. `RunBackup` or explicit Validate/Migrate). `RunBusiness` is the phase-2 calc bridge; dumping backup into it without a recorded architecture decision would mix concerns. HTML-only must keep the JS functions as fallback (`docs/ARCHITECTURE_RULES.md` item 6).

---

# 7. Target folder / class structure (mapping)

| Current JS | Target type | Notes |
|---|---|---|
| `REQUIRED_BACKUP_COLLECTIONS` + `_FROM_SCHEMA` | `RequiredCollectionsRegistry` | Exact lists; do not add `tasks` |
| `validateRequiredBackupCollections` | `RequiredCollectionsValidator` | First candidate |
| `validateBackupItemCounts` / `AttachmentIndex` / `detectBackupDuplicateIdentities` | sibling validators | P1C-6 |
| `validateBackupStructuralIntegrity` | combiner | |
| `backupChecksumCanonicalString` + exclusions | `CanonicalChecksum` | Not file bytes |
| `validateBackupSectionChecksums` / `PortableIntegrity` | Integrity | |
| `attachChecksum` / `verifyChecksum` | policy in Core + `IBackupHashService` | `none` skip stays |
| `finalizeBackupPackage` / `buildBackupManifest` / `attachSectionChecksums` | `BackupFinalizer` | |
| `SCHEMA_MIGRATIONS` / `applySchemaMigrations` | `SchemaMigration` | 0→1 fill only |
| `migrateBackup` | `BackupMigrator` | Highest behavior-lock risk |
| `applyBackupMergeSections` / `ReplaceSections` **minus** `sv*`/`render*` | `RestoreOrchestrator` on DTOs | |
| `applyBackupSelective` persist/render | HTML adapter | |
| `WriteBackupText` | already Desktop | Keep write-string semantics |
| Preview modals | HTML | |

---

# 8. Migration sequence

Each step: dual-run HTML vs Core on synthetic fixtures; `node test_laegh.js Sirman_Final.html` stays green; HTML-only path still contains the JS implementation until the last step. No live shop restore.

| Step | Extract | Preserve | Exit criterion |
|---|---|---|---|
| **1. Contracts** | DTOs + registry constants + result shape (`ok`, `errors`, `warnings`, P1C field names) | No behavior change in HTML | C# types match JS field names; no Host yet |
| **2. Pure validators** | `validateRequiredBackupCollections` + itemCounts + attachments + duplicates + structural | P1C-1..6 tests | Port `p1cValidatorSrc` cases; HTML functions remain |
| **3. Integrity** | canonical string + sectionChecksums + portable + claim classification | P1C-7; no `backupId`; pretty≠hash | Same FAIL/skip matrix |
| **4. Serializer** | compact canonical stringify + pretty disk stringify as two explicit operations | Existing files still verify | Golden strings from current JS `JSON.stringify` |
| **5. Migration** | `SCHEMA_MIGRATIONS` then `migrateBackup` + `SCHEMAS` | 0→1 fill vs ≥1 fail-closed; tasks=[]; pb coerce | `loadMigrateBackupFn` tests dual-run |
| **6. Restore orchestration** | merge/replace **on DTOs**; safety pair; gate order of `importData` | Identity rules including empty-phone insert; no implicit global `d` | Synthetic merge/replace fixtures; HTML still assigns RAM |
| **7. Filesystem adapter** | wrap existing `WriteBackupText` / workspace read | String-in/string-out; no hash in Host | Autosave still writes `sirman_autosave.txt` |
| **8. Host bridge** | new `sirmanHost` methods; HTML calls Core in exe, JS fallback otherwise | HTML-only works | Architecture list updated when implemented |
| **9. Remove duplicated HTML** | only after exe+HTML-only proven | Do not delete fallback until fallback tests exist | Explicit packet; not this one |

Do **not** start with `_buildFullBackupData` or `applyBackupReplaceSections`. Those are the highest coupling.

Do **not** start P1C-8 in this packet.

---

# 9. Risks

| Risk | Why | Mitigation |
|---|---|---|
| Second engine | `JsonBackupRepository` looks like backup | Leave TBD until parity tests exist |
| Hash-the-file rewrite | Pretty JSON ≠ canonical payload | Keep P1C-7 definition frozen |
| Inventing `backupId` | `hasBackupId` already peeks | Do not write the field |
| sectionChecksums warn vs FAIL | `validateBackupPackage` vs portable | Port both; do not unify without a packet |
| Network pull skips SHA-256 | `prepareNetworkWorkspacePull` has no `verifyChecksum` | Preserve unless a later packet changes it |
| Phonebook merge duplicates | empty phone inserts | Frozen; do not “fix” during extraction |
| `applyAll` global `d` | tests/legacy | Keep HTML shim; Core takes explicit arg |
| Close-path Host→JS | MainForm injects `_buildFullBackupData` | Leave until snapshot API exists |
| `sv*` / `render*` omission | restore “succeeds” with empty UI | Core returns DTO; HTML persist remains until SoT moves |
| Crypto `none` on file:// | tests and HTML-only | Hash adapter must allow skip |
| Encrypt-before-checksum regression | P1C-7 already fixed attach-then-encrypt | Golden path test |
| Post-migrate itemCounts | `importData` re-checks after `migrateBackup` | Keep order |
| Dual `services`/`svcs` | snapshot and migrate alias | Contract includes both |
| HTML-file copy vs JSON package | two user-visible “backups” | Do not merge concepts |
| Growing Host without architecture list | forbidden parallel transport | Same `sirmanHost` object only |

---

# 10. Test strategy

- **Regression SoT:** `node test_laegh.js Sirman_Final.html` (775 tests as of P1C-7). Do not replace this suite.
- **First Core extraction** should port existing P1C execution tests (`p1cValidatorSrc` / `loadP1CValidator` in `test_laegh.js` lines 103–139 extract exactly the pure validators). Add C# tests that assert identical `{ok, errors, missingRequiredCollections, …}` on the same synthetic JSON fixtures.
- Dual-run: feed the same fixture to JS `new Function(p1cValidatorSrc)` and to Core; diff results.
- Keep HTML functions until step 9 so HTML-only and `vm` group-0 still load.
- Do **not** run restore against live shop data, Phonebook repair, SQLite, `resetAll`, or rewrite of real backup files.
- Serializer step needs golden compact strings (key order is insertion order in JS — C# `JsonObject` order must match or canonicalization must be specified in that later packet without changing existing files’ verify behavior).
- After Host exists: exe path vs HTML-only path both green.

This ARCH-1 packet did not re-run the 775 suite against a code change (there is no code change). Suite status is inherited from P1C-7.

---

# 11. Exact first extraction candidate

**`validateRequiredBackupCollections` and its immediate pure graph**, already isolated by tests:

1. `REQUIRED_BACKUP_COLLECTIONS` / `REQUIRED_BACKUP_COLLECTIONS_FROM_SCHEMA`
2. `backupHasOwnCollection`
3. `inferBackupSchemaVersion` / `inferRequiredBackupSchemaVersion`
4. `requiredBackupCollectionsFor`
5. `validateRequiredBackupCollections`
6. Then the rest of `p1cValidatorSrc`: itemCounts, attachments, duplicates, structural, canonical checksum string, sectionChecksums, portable, `classifyBackupChecksumClaim`

**Why this first**

- No live globals, no DOM, no Host, no localStorage, no IndexedDB.
- Fail-closed rules are already locked by P1C-1..P1C-7.
- `test_laegh.js` already extracts these functions by source scrape — a Core port can be proven against that scrape.
- Does not require inventing snapshot assembly or persist.

**Not first**

- `_buildFullBackupData` (live RAM + localStorage).
- `applyBackupReplaceSections` / `applyBackupMergeSections` (assigns globals + `sv*` + `render*`).
- `migrateBackup` (large in-place policy; depends on validators already being stable).
- `WriteBackupText` (already Desktop; expanding it now would mix I/O with rules).

---

# 12. What must remain in HTML

Until SoT leaves the browser (out of scope):

- Preview/confirm dialogs (`openRestorePreviewModal`, `confirmRestorePreview`, network pull modal).
- FileReader / `<input type=file>` / Blob `<a download>` / File System Access pickers.
- `ntf` / `alert` / `confirm` / encrypt `prompt`.
- `render*` and appearance/brand after apply.
- `sv*` persist helpers and live array assignment.
- HTML-only **fallback copies** of validators/migrate (architecture: opening HTML directly must keep working).
- IndexedDB `laegh-backup-db` until a Desktop store replaces 3-2-1 copies.
- Autosave UI (armed dot, interval, folder name).
- `getSirmanHostSync` glue.

These are UI or browser SoT adapters, not an excuse to keep **policy** in HTML forever.

---

# 13. What must never remain in HTML long-term

Per `docs/ARCHITECTURE_RULES.md` (Backup Engine independent of UI):

- Required-collection / count / attachment / checksum **policy**.
- Merge/replace **identity rules**.
- Schema migrate (`SCHEMA_MIGRATIONS` + `migrateBackup` field policy).
- Canonical checksum **definition** (which keys, compact JSON, SHA-256 vs `none`).
- Snapshot **schema** (which sections a full backup must contain) — gathering from localStorage can stay an adapter; the list/shape is Core.
- Restore gate **order** (required → structural → portable → schema → SHA-256 → migrate → counts → package validate → preview → apply).
- Fail-closed vs 0→1 fill distinction.

HTML may **call** these after extraction; it must not be the only copy of the rules.

---

# 14. Confirmation (this packet)

| Constraint | Status |
|---|---|
| No refactor / move / rename / delete of engine code | **Confirmed** — this file only |
| `Sirman_Final.html` unchanged | **Confirmed** |
| `test_laegh.js` unchanged | **Confirmed** |
| No live data access / restore execution | **Confirmed** |
| No Phonebook change | **Confirmed** |
| No SQLite change | **Confirmed** |
| No backup rewriting | **Confirmed** |
| No `desktop/Sirman.Core/Backup/` directories created | **Confirmed** (they do not exist) |
| ARCH-1 implementation not started | **Confirmed** |
| P1C-8 not started | **Confirmed** |
| Existing checksum behavior unchanged | **Confirmed** (not touched) |
| `backupId` not invented | **Confirmed** |

---

# 15. Recommendations (stop here)

1. Treat HTML `BackupEngine` as the real engine. Treat `IBackupRepository` as a labeled stub.
2. First implementation packet after this audit: **pure validators → C#**, dual-tested against `p1cValidatorSrc`, HTML functions left in place.
3. Freeze P1C-1..P1C-7 rules and the canonical SHA-256 definition while extracting.
4. Keep Host as string I/O until Core can accept a JSON string and return a validation/migration result.
5. Do not unify network-pull (no SHA-256) with file-import (has SHA-256) without an explicit later packet.
6. Do not “clean” Phonebook merge or invent `backupId` during extraction.
7. Do not start P1C-8 until this map is accepted and the first validator port has its own packet.

---

*End of ARCH-1 audit. No code changed.*
