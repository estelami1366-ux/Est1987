# SIRMAN — ARCH-15 Settings-Slice Opt-In Cutover

**Date:** 2026-09-04  
**Packet:** Wire `collectBackupSettingsSnapshot()` into `_buildFullBackupData` for settings fields only. Equivalence-gated.  
**Product version:** `1405.6.3α` (unchanged)  
**Branch:** `cursor/arch-15-settings-slice-cutover-fa01`  
**Base:** `cursor/arch-14-backup-settings-adapter-fa01`  
**Final status:** **COMPLETED** (code/test equivalence only — not shop VERIFIED)

---

## 1. Change Gate result

```text
CHANGE: ARCH-15 settings-slice opt-in cutover inside _buildFullBackupData
CLASS: Opt-in wiring of an existing adapter. Not an assembler extraction.
Q1: CAPABILITY — settings fields of the live assembler now come from
    collectBackupSettingsSnapshot(). Not Restore. Not RAM collections.
Q2: RunBusiness / Host: NO. No new Host method. ConsumeBackupSnapshot unused.
Q3: Persistence: NO. Assembly still reads LS via the adapter; no LS/IDB write.
Q4: Printing: NO functional change. printSettings/printCenter remain payload copy.
Q5: HTML-only: PRESERVED. exportData/buildBackupObject still call _buildFullBackupData.
Q6: New transport/DB/ACL: NO. Core BackupSettingsSnapshot DTO unchanged.
RESULT: PASS
AUTHORITY: explicit user packet ARCH-15 2026-09-04
```

Gate stayed PASS through implementation. Equivalence T1–T18 matched goldens. Malformed settings still throw. No stop condition was hit.

Not started: ARCH-16, assembler extraction, Restore/Merge/Replace, P1C-8, Phonebook, SQLite, Print rewrite.

---

## 2. Exact files changed

| File | Why |
|---|---|
| `Sirman_Final.html` | Smallest assembler patch: one adapter call + settings assignments. Adapter comment updated. |
| `Laegh_Final.html` | Byte-sync of `Sirman_Final.html`. |
| `test_laegh.js` | New SHA lock, sandbox adapter inject, ARCH-15 equivalence/negatives, ARCH-14 G1 export-path lock. |
| `deliveries/Reports/ARCH-15_SETTINGS_SLICE_CUTOVER_REPORT.md` | This report. |

**Not changed:** `desktop/Sirman.Core/**`, `desktop/Sirman.Desktop/**`, `desktop/Sirman.Persistence.Sqlite/**`, Host contracts, Print pipeline, Restore, Phonebook, checksum helpers, `SIRMAN_VERSION.json`.

---

## 3. Before/after settings mapping

Assembler still owns the top-level backup object and RAM collections. Settings values now come from one adapter snapshot `s`.

| Output key | Before (inline in assembler) | After (ARCH-15) |
|---|---|---|
| `appliedUpdates` | `getAppliedUpdatesMeta()` / `[]` | `s.appliedUpdates` |
| `updatePackages` | `collectUpdatePackagesForBackup()` / `[]` | `s.updatePackages` |
| `printSettings` | `JSON.parse(localStorage.getItem('laegh_printSettings')\|\|'{}')` | `s.printSettings` |
| `company` | `JSON.parse(localStorage.getItem('laegh_company')\|\|'{}')` | `s.company` |
| `serviceCenter` | `JSON.parse(localStorage.getItem('laegh_service_center')\|\|'{}')` | `s.serviceCenter` |
| `starredAlarms` | `getStarredAlarms()` / LS fallback | `s.starredAlarms` |
| `appearance` | 24 inline `localStorage.getItem` keys | `s.appearance` |
| `sms` | `JSON.parse(localStorage.getItem('laegh_sms')\|\|'{}')` | `s.sms` |
| `tz` | `localStorage.getItem('laegh_tz')\|\|'Asia/Tehran'` | `s.tz` |
| `networkSettings` | `loadNetworkSettings()` / LS fallback | `s.networkSettings` |
| `prefs` | `collectPrefsBundle()` / `{}` | `s.prefs` |
| `aiKeys` | inline prefix scan IIFE | `s.aiKeys` |
| `printCenter` (optional) | `try { getPrintCenterState() }` | `if (s.printCenter) data.printCenter = s.printCenter` |

Unchanged assembler fields include all business RAM collections, `senderInfo`, `logoSrc`, `loginPw`, `acH`, `itemCounts`, `sections`, attachment index, and:

```js
return JSON.parse(JSON.stringify(data));
```

Call graph after cutover:

```text
exportData / buildBackupObject / applyBackupSelective
    → _buildFullBackupData()          // still the only live assembler
        → collectBackupSettingsSnapshot()   // exactly once
        → RAM collections (unchanged)
        → JSON.parse(JSON.stringify(data))  // ARCH-9D clone
```

`exportData` and `buildBackupObject` do **not** call the adapter.

Exactly one authoritative assignment per cut-over settings key. No duplicate settings keys in the assembler object.

---

## 4. Equivalence proof

Frozen goldens: `desktop/Sirman.Core.Tests/BackupSettingsFixtures.json` (ARCH-14 T1–T18).

For every fixture:

```text
JSON.stringify(arch14PickSettings(_buildFullBackupData()))
  === JSON.stringify(fixture.expected)
  === JSON.stringify(collectBackupSettingsSnapshot())
```

| Fixture | Result |
|---|---|
| T1–T18 | **18/18 PASS** |

Negatives (assembler path, not silently repaired):

| Check | Result |
|---|---|
| N1 malformed `printSettings` throws | PASS |
| N2 malformed `company` throws | PASS |
| N3 malformed `serviceCenter` throws | PASS |
| N4 malformed `sms` throws | PASS |
| N5 missing `tz` → `Asia/Tehran` | PASS (T2 golden) |
| N6 missing appearance keys → `""` | PASS (T3 golden, 24 keys) |
| N7 missing optional `printCenter` semantically unchanged | PASS (T18 golden default/profile) |

ARCH-14 adapter tests remain and all passed.

---

## 5. Test counts

| Suite | Command | Passed | Failed | Total |
|---|---|---|---|---|
| HTML | `node test_laegh.js Sirman_Final.html` | **899** | **0** | **899** |
| Core | `dotnet test desktop/Sirman.Core.Tests` | **661** | **0** | **661** |

Previous HTML count after ARCH-14 was 870. ARCH-15 added 29 tests (G1 + 18 equivalence + 7 negatives + 3 integrity). 870 + 29 = 899.

ARCH-14 fixture count: **18**. ARCH-14 fixture pass count: **18**.  
ARCH-15 fixture count: **18**. ARCH-15 fixture pass count: **18**.

Core DTO tests unchanged (no Core source edit).

---

## 6. Old/New assembler SHA

Extract method: `extractFunctionSource(html, '_buildFullBackupData')` then SHA-256 of UTF-8 source (same as `arch9cSha256` in `test_laegh.js`).

| Lock | SHA-256 |
|---|---|
| OLD (ARCH-9D through ARCH-14) | `f65d8f393d91de7e984540060ceec6deb14976d9dce4bd7b82261d2e69c5df5f` |
| NEW (ARCH-15, computed) | `17f08840ecb3e6ecc9d72082d27eeeb6736daa97a1f06819df4f4f04a998cfa6` |

The hash was computed after the patch, not predicted. `ARCH9D_BUILD_SHA256` in `test_laegh.js` now stores the NEW lock. `ARCH9D_BUILD_SHA256_PRE_ARCH15` records the old value so accidental reversion or a second silent assembler edit is detected.

Clone-on-return remains exactly one statement:

```js
return JSON.parse(JSON.stringify(data));
```

---

## 7. Regression results

| Lock | Result |
|---|---|
| ARCH-9D clone-on-assemble + no LS/IDB write during assembly | PASS |
| ARCH-10 ConsumeBackupSnapshot unused by export/autosave | PASS |
| ARCH-11 pretty JSON / autosave Host path | PASS |
| ARCH-12 checksum verify-before-migrate | PASS |
| `exportData` SHA | unchanged (`aa8f62ed…`) |
| `buildBackupObject` SHA | unchanged (`f66b0a89…`) |
| `_safeArr` / `_safeObj` SHA | unchanged |
| Restore `applyBackupMergeSections` / `applyBackupReplaceSections` / `importData` | present, not functionally edited |
| `resetAll` | present, not functionally edited |
| Phonebook `savePBContact` | present, not functionally edited |
| Print helpers `getPrintCenterState` / `getPrintSettings` | present, not functionally edited |
| `JsonBackupRepository` TBD `html-backup-engine` | present |
| SQLite candidate project | present, not edited |
| `Sirman_Final.html` ≡ `Laegh_Final.html` | **byte-identical** |

---

## 8. Data-impact statement

No live shop data was read or written.

- Assembly still only **reads** localStorage through the adapter.
- Tests used synthetic fixtures T1–T18, not real shop backups.
- No `localStorage.setItem` / `indexedDB.open` during assembly (execution proof).
- No Restore apply, no Merge/Replace, no Phonebook persist, no SQLite write.
- Product version remains `1405.6.3α`.

---

## 9. Rollback procedure

1. Revert this branch onto `cursor/arch-14-backup-settings-adapter-fa01` (or revert the ARCH-15 commits).
2. Assembler SHA returns to `f65d8f393d91de7e984540060ceec6deb14976d9dce4bd7b82261d2e69c5df5f`.
3. Settings fields are again inlined inside `_buildFullBackupData`.
4. `collectBackupSettingsSnapshot()` remains as the unused ARCH-14 adapter.
5. No data migration is required; this packet did not change stored documents.

---

## 10. Explicit confirmation of what was NOT changed

- `_buildFullBackupData` was **not extracted**.
- Business RAM collections were **not moved**.
- invoices / sales / warranties / parts / accounts / tasks / phonebook collection code: **unchanged**.
- Restore, Merge, Replace, `importData`: **no functional edits**.
- P1C-8: **not started**.
- SQLite: **not edited**.
- Print pipeline / PrintHardwareDiagnostic / WindowsPrintHost: **not edited**.
- Host contracts: **not edited**.
- `ConsumeBackupSnapshot`: **not edited**.
- Backup checksum semantics: **not edited**.
- Product version: **not changed**.
- New persistence: **none**.
- Core `BackupSettingsSnapshot` DTO: **not edited**.
- Adapter is wired **only** inside `_buildFullBackupData`.

---

## 11. ARCH-16 recommendation

Do **not** extract `_buildFullBackupData`. Do **not** start Restore / Merge / Replace / P1C-8.

Settings are now produced by one adapter and assigned once. Remaining assembler work is still RAM collections plus identity fields (`senderInfo`, `logoSrc`, `loginPw`, `acH`). Those are a different risk class than LS settings.

Safest next packet, if any: a **read-only Core consumer** of the already-assembled settings slice (parse `BackupSettingsSnapshot` from backup JSON, no apply). Not a second settings reader, and not a live Restore cutover.

This packet stops here.

---

## Assembler integrity checklist

| Check | Result |
|---|---|
| `exportData` still calls `_buildFullBackupData` | YES |
| autosave `buildBackupObject` still calls `_buildFullBackupData` | YES |
| final JSON clone remains | YES |
| no localStorage write during assembly | YES |
| no IndexedDB write during assembly | YES |
| adapter called exactly once from assembler | YES |
| adapter **not** called from `exportData` / `buildBackupObject` | YES |

---

## Final status

**COMPLETED**

Code/test equivalence only. Not VERIFIED against the real shop environment.
