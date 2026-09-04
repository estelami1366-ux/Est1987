# SIRMAN — ARCH-14 Backup Settings Snapshot Adapter

**Date:** 2026-09-04  
**Packet:** Extract LS-based backup settings into a pure Core DTO + HTML adapter. Equivalence only. **No live cutover.**  
**Product version:** `1405.6.3α` (unchanged)  
**Branch:** `cursor/arch-14-backup-settings-adapter-fa01`  
**Base:** `cursor/arch-13-backup-snapshot-consistency-fa01`  
**Assembler lock:** SHA-256 of `_buildFullBackupData` remains `f65d8f393d91de7e984540060ceec6deb14976d9dce4bd7b82261d2e69c5df5f` (ARCH-9D).

---

## Phase 3 Change Gate

```text
CHANGE: ARCH-14 BackupSettingsSnapshot DTO + HTML LS adapter
CLASS: Extraction / transport contract. No live backup cutover.
Q1: CAPABILITY — settings-slice transport + HTML reader. Not Restore. Not full assembler.
Q2: RunBusiness / Host: NO new Host method. ConsumeBackupSnapshot unused by this adapter.
Q3: Persistence: NO. Adapter reads LS; does not write. Core DTO has no storage.
Q4: Printing: NO code change to Print pipeline / diagnostic / host. printSettings/printCenter copied as current JSON payload only.
Q5: HTML-only: PRESERVED. New helper is unused by export/autosave. HTML-only backup path identical.
Q6: New transport/DB/ACL: NO. JSON DTO inside existing Sirman.Core.Backup namespace.
RESULT: PASS
AUTHORITY: explicit user packet ARCH-14 2026-09-04
```

Not started: wiring into `_buildFullBackupData`, extracting the assembler, Restore cutover, Merge/Replace in Core, P1C-8, Phonebook, SQLite.

---

## Governance work report (15)

1. **Task:** LS settings snapshot adapter + Core DTO + golden equivalence tests.  
2. **Branch:** `cursor/arch-14-backup-settings-adapter-fa01`  
3. **Baseline Version:** `1405.6.3α`  
4. **Files Changed:** `Sirman_Final.html`, `Laegh_Final.html` (byte-sync), `desktop/Sirman.Core/Backup/BackupSettingsSnapshot.cs`, `BackupSettingsSnapshotCatalog.cs`, `desktop/Sirman.Core.Tests/BackupSettingsSnapshotTests.cs`, `BackupSettingsFixtures.json`, `Sirman.Core.Tests.csproj`, `test_laegh.js`, this report.  
5. **Modules Changed:** Backup transport (new). Print / Restore / Phonebook / SQLite / Host **not** changed.  
6. **Dependencies:** Existing HTML helpers (`getStarredAlarms`, `loadNetworkSettings`, `collectPrefsBundle`, `getPrintCenterState`, update meta). Core `BackupJsJson` / `BackupJsonUtil`.  
7. **Root Cause:** ARCH-13 split-brain — settings live in LS; assembler mixed them with RAM. Need a settings-only boundary before any cutover.  
8. **Fix:** HTML `collectBackupSettingsSnapshot()` clones the LS settings slice; Core `BackupSettingsSnapshot` clones JSON only. Live assembler untouched.  
9. **Tests:** HTML **870/870**. Core **661/661**. ARCH-14 Core **36/36**.  
10. **Regression:** ARCH-9D assembler SHA lock; exportData / buildBackupObject SHA locks; Restore/Phonebook/Print/SQLite presence locks.  
11. **Data Impact:** None. No live data, no Restore apply, no LS writes on the adapter path.  
12. **Real Environment Test:** Not required (no live backup/print/restore path change). Linux HTML+Core suites only.  
13. **Risks:** Future cutover must keep malformed-`printSettings` throw; printCenter remains frozen payload.  
14. **Rollback:** Revert this branch. Assembler never called the adapter.  
15. **Final Status:** **COMPLETED** (code + automated tests). Not shop-restore VERIFIED (path unchanged).

---

## 1. Exact LS keys

Read by `collectBackupSettingsSnapshot` (same names as `_buildFullBackupData` settings slice):

| Key / pattern | How |
|---|---|
| `laegh_applied_updates` | `getAppliedUpdatesMeta` |
| `laegh_upd_pkg_<id>` | `collectUpdatePackagesForBackup` (ids from meta) |
| `laegh_printSettings` | direct `JSON.parse` |
| `laegh_company` | direct `JSON.parse` |
| `laegh_service_center` | direct `JSON.parse` |
| `laegh_starred_alarms` | `getStarredAlarms` |
| 24 appearance keys (`laegh_skin` … `laegh_dash_hide_widgets`) | direct `getItem` |
| `laegh_sms` | direct `JSON.parse` |
| `laegh_tz` | direct `getItem` |
| `laegh_network` | `loadNetworkSettings` |
| `PREF_KEYS` (23 names) | `collectPrefsBundle` (non-null only) |
| `laegh_ai_key_*` + `laegh_ai_custom_url` / `_custom_model` / `_model` / `_purpose` | full-key scan |
| `laegh_printCenter` | `getPrintCenterState` (`PC_KEY`; fallback `printSettings._center`; else defaults) |

Catalog: `BackupSettingsSnapshotCatalog.LocalStorageKeys` + prefixes `AiKeyPrefix` / `UpdatePackagePrefix`.

Not read: business persist keys (`li`/`lb`/`lp2`/…), `laegh_login_pw`, `laegh_prefs_bundle`, IndexedDB.

---

## 2. Classification A–F

All listed LS inputs are included in the DTO (they are backup settings payload today). None were dropped.

| Field | Class | Why |
|---|---|---|
| `company` | **A** pure settings | LS only; no RAM global |
| `serviceCenter` | **A** | LS only |
| `appearance` | **A** + empty-string default | LS strings |
| `sms` | **A** | LS object |
| `tz` | **A** + default | LS; missing → `Asia/Tehran` in **adapter** |
| `prefs` | **A** | LS subset (`PREF_KEYS`) |
| `printSettings` | **A** + **F** | LS print payload; frozen print module; **not** rewritten |
| `starredAlarms` | **B** derived | catalog merge in existing helper |
| `networkSettings` | **B** derived | `parseNetworkSettings` coerce |
| `printCenter` | **B** + **F** | defaults/profile merge; frozen print data as JSON |
| `aiKeys` | **C** secret material | plaintext payload; not stripped |
| `appliedUpdates` | **E** operational metadata | update center |
| `updatePackages` | **E** operational metadata | `laegh_upd_pkg_*` |
| UI-only (**D**) | **none in this DTO** | appearance is persisted backup settings, not a DOM handle |

`loginPw` stays RAM (ARCH-13). Not in this settings DTO.

---

## 3. DTO schema

`Sirman.Core.Backup.BackupSettingsSnapshot`

```text
BackupSettingsSnapshot
  Data: JsonObject          // catalog keys only, cloned
  Report: shape flags
  Field / Appearance / AiKeys / PrintSettings / PrintCenter / Company / Prefs / NetworkSettings / StarredAlarms / Tz

Parse(JsonNode) / FromCanonicalJson(string)
ToJson() / ToCanonicalJson()   // BackupJsJson, insertion order = catalog
```

Base keys (12, always emitted by the HTML adapter):

`appliedUpdates`, `updatePackages`, `printSettings`, `company`, `serviceCenter`, `starredAlarms`, `appearance`, `sms`, `tz`, `networkSettings`, `prefs`, `aiKeys`

Optional: `printCenter`

Forbidden business keys are stripped if present (`invoices`, `phonebook`, `loginPw`, `exportedAt`, …). Runtime handle names (`localStorage`, `sirmanHost`, …) are reported and dropped.

No browser types. No WinForms. No DateTime. No domain entities.

---

## 4. HTML adapter

`collectBackupSettingsSnapshot()` in `Sirman_Final.html` / `Laegh_Final.html` (immediately after `buildBackupObject`).

- Allowed: `localStorage` + existing helpers listed above + `_safeArr` / `_safeObj`.  
- Forbidden: invoices / sales / warranties / phonebook / parts / accounts and other business RAM.  
- Clones with `JSON.parse(JSON.stringify(data))`.  
- **Not** called from `_buildFullBackupData`, `exportData`, or `buildBackupObject`.

---

## 5. Derived / default semantics (preserved, not redesigned)

| Rule | Where | Result |
|---|---|---|
| missing `tz` | adapter `getItem \|\| 'Asia/Tehran'` | `Asia/Tehran` |
| missing appearance key | adapter `\|\| ''` | `''` (key present) |
| missing objects | `JSON.parse(...\|\|'{}')` + `_safeObj` | `{}` |
| starred alarms | `normalizeStarredAlarms` + catalog | titles/hints/defaults merged |
| network | `parseNetworkSettings` | role/port/flags coerced; bad port → 8765 |
| printCenter | `getPrintCenterState` | PC_KEY → `_center` → `printCenterDefaultState` + profile fill |
| AI scan | same IIFE as assembler | prefix + four named keys |
| prefs | `collectPrefsBundle` | omit null keys |
| appliedUpdates / packages | existing helpers | `[]` / listed packages |
| malformed `printSettings` / `company` / `serviceCenter` / `sms` | same as assembler | **throws** (not fixed) |

Core does **not** re-apply these defaults. The adapter supplies them.

---

## 6. Secret fields

`aiKeys` is a **sensitive payload field** (`BackupSettingsSnapshotCatalog.SensitivePayloadKeys`).

This packet does **not** strip, encrypt, hash, redact, or vault it. Restore still depends on the current backup contract. Security redesign is later.

`loginPw` is not in this DTO.

---

## 7. Golden fixtures

`desktop/Sirman.Core.Tests/BackupSettingsFixtures.json` — T1–T18 LS maps + HTML adapter `expected` objects.

| Id | Case |
|---|---|
| T1 | all settings populated |
| T2 | missing tz |
| T3 | missing appearance keys |
| T4 | empty `{}` objects |
| T5 | company |
| T6 | serviceCenter |
| T7 | printSettings |
| T8 | printCenter |
| T9 | starred alarms |
| T10 | networkSettings coerce |
| T11 | prefs subset |
| T12 | aiKeys |
| T13 | appliedUpdates |
| T14 | updatePackages |
| T15 | SMS |
| T16 | Persian Unicode |
| T17 | malformed JSON on catch-path keys |
| T18 | missing optional / empty LS |

---

## 8. HTML / Core equivalence

For every fixture: `JSON.stringify(collectBackupSettingsSnapshot())` equals the golden `expected`, and Core `BackupSettingsSnapshot.Parse(expected).ToCanonicalJson()` equals `BackupJsJson.Stringify(expected)`.

T1 also: adapter output equals the settings-key slice of `_buildFullBackupData()` on the same LS (business RAM stubbed empty).

---

## 9. Immutability

- HTML: return value is a JSON clone; mutating it does not `setItem` LS (T19).  
- Core: `Parse` clones; mutating `snap.Company` / nested printCenter / aiKeys does not change the input node (T19). `ToJson()` is a further clone.

---

## 10. Determinism

Same LS → identical adapter JSON (T20). Core `ToCanonicalJson` twice equal. No `Date.now` / `Math.random` in the adapter. No `DateTime` / `Guid` / `Random` in the DTO sources. Print-center defaults come from frozen `PRINT_PROFILE_DEFAULTS`.

---

## 11. Test counts

| Suite | ARCH-13 | ARCH-14 | Delta |
|---|---|---|---|
| HTML `node test_laegh.js Sirman_Final.html` | 839 | **870** | +31 |
| Core `dotnet test desktop/Sirman.Core.Tests` | 625 | **661** | +36 |
| Failures | 0 | **0** | |

Core ARCH-14 class: 36 passed (T1–T18 theory + named T1–T24 facts).

---

## 12. Full regression

- `_buildFullBackupData` SHA-256 lock: **pass**  
- `exportData` / `buildBackupObject` ARCH-9C SHA locks: **pass**  
- Restore merge/replace / `importData` / `resetAll` present: **pass**  
- Phonebook `savePBContact` present: **pass**  
- Print helpers `getPrintCenterState` / `getPrintSettings` source not rewritten as a module: **pass**  
- `WindowsPrintHost` / `PrintHardwareDiagnostic` files unread except T24 existence lock: **not modified**  
- `JsonBackupRepository.TbdMarker` = `html-backup-engine`: **pass**  
- SQLite project file present: **pass**  
- `Sirman_Final.html` ≡ `Laegh_Final.html`

---

## 13. Confirmation

| Item | Result |
|---|---|
| `_buildFullBackupData` unchanged | **YES** (SHA-256 lock) |
| live Backup (`exportData` / `buildBackupObject`) unchanged | **YES** (SHA + no adapter call) |
| Restore unchanged | **YES** |
| Phonebook unchanged | **YES** |
| SQLite unchanged | **YES** |
| Print pipeline unchanged | **YES** |
| Version `1405.6.3α` | **unchanged** |
| Adapter wired into assembler | **NO** |

---

## 14. Next safest extraction

Do **not** extract `_buildFullBackupData`. Do **not** start Restore/P1C-8.

Next safest production packet: **opt-in cutover** of the assembler **settings fields only** so they assign from `collectBackupSettingsSnapshot()`, gated by the same T1–T18 goldens plus the assembler SHA becoming a new lock. Still no RAM-collection move, no Restore, no Print rewrite.

---

## Q1–Q14

**Q1. Is BackupSettingsSnapshot pure?**  
YES. JSON clone of catalog keys. No LS/RAM/Host/UI types. No DateTime.

**Q2. Does it depend on localStorage?**  
NO. Core never calls storage APIs. It accepts already-assembled JSON.

**Q3. Does the HTML adapter depend on localStorage?**  
YES. That is its job. Plus existing settings helpers.

**Q4. Does the DTO contain business RAM data?**  
NO. Forbidden keys stripped. Adapter never reads invoices/phonebook/….

**Q5. Are existing defaults preserved?**  
YES. tz, appearance `''`, `{}` objects, catalog merge, network coerce, printCenter defaults — in the adapter, matching the assembler.

**Q6. Are AI keys preserved as current payload data?**  
YES. Plaintext `aiKeys`; not hashed/redacted.

**Q7. Is Print unchanged?**  
YES. No edits to PrintHardwareDiagnostic / PrintService / WindowsPrintHost / printEngine path. Payload copy only.

**Q8. Is `_buildFullBackupData` unchanged?**  
YES. SHA-256 `f65d8f393d91de7e984540060ceec6deb14976d9dce4bd7b82261d2e69c5df5f`.

**Q9. Is live Backup unchanged?**  
YES. export/autosave still call `_buildFullBackupData` only.

**Q10. Is Restore unchanged?**  
YES.

**Q11. Did live data change?**  
NO.

**Q12. Did Phonebook change?**  
NO.

**Q13. Did SQLite change?**  
NO.

**Q14. What is the next safest extraction?**  
Do not extract the assembler. Next: optional settings-slice cutover inside `_buildFullBackupData` using this adapter, equivalence-gated.

---

## Stop line

ARCH-14 ends here. Adapter is not wired. Restore / Merge / Replace / P1C-8 / Phonebook / SQLite were not started.
