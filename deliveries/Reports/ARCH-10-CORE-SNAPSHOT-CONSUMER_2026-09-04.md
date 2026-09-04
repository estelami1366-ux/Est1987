# SIRMAN — ARCH-10 Core Consumer of Isolated Backup Snapshot

**Date:** 2026-09-04  
**Packet:** Read-only Core consumer of the already-cloned `_buildFullBackupData` snapshot.  
**Product version left unchanged:** `1405.6.3α`  
**Branch:** `cursor/arch-10-core-snapshot-consumer-fa01`  
**Base:** `cursor/arch-9d-production-clone-on-assemble-fa01` @ `5bc52b6`

---

## Phase 3 Change Gate

```text
CHANGE: ARCH-10 read-only Core consumer of isolated BackupSnapshot JSON
CLASS: Transport adapter + Parse/Validate. No assembly extraction. No Restore.
Q1: CAPABILITY — Core can inspect a serialized snapshot without applying it
Q2: RunBusiness / Host: YES — one new always-allowed method ConsumeBackupSnapshot (transport only)
Q3: Persistence: NO writes
Q4: Printing: NO
Q5: HTML-only: PRESERVED — helper fail-closed when Host is absent
Q6: New transport/DB/ACL: NO — same sirmanHost; listed in ARCHITECTURE_RULES.md
RESULT: PASS
AUTHORITY: explicit user packet ARCH-10 2026-09-04
```

Live backup assembly remains HTML. Live Restore remains HTML. `JsonBackupRepository` remains `html-backup-engine`. P1C-8 not started.

Verified suites:

| Suite | Result |
|---|---|
| HTML | **833/833 PASS** (828 previous + 5 ARCH-10) |
| Core | **580/580 PASS** (556 previous + 24 ARCH-10) |

---

## 1. Previous architecture

```text
_buildFullBackupData()          HTML, now returns JSON clone (ARCH-9D)
    ↓
applyBackupFinalizer
    ↓  (exe) Host.FinalizeBackup  → BackupFinalizeBridge → BackupFinalizer
WriteBackupText                 disk only

Restore apply                   HTML Merge/Replace
TestRestoreBackup               Core dry-run preview (applied=false)
```

Core could finalize and dry-run a serialized package. It had `BackupSnapshot` (ARCH-9B) but no dedicated **inspect/consume** Host method that Parse+Validate without finalizing or preview-migrating.

---

## 2. New architecture

```text
_buildFullBackupData()          unchanged isolated JSON snapshot
    ↓
optional consumeBackupSnapshot(snapshot)     NOT on export/autosave
    ↓  (exe) Host.ConsumeBackupSnapshot(json)
    ↓
BackupSnapshotConsumer.Execute
    ↓
BackupSnapshot.Parse            clone again (contract)
    ↓
BackupValidator.Validate        existing engine
    ↓
BackupCanonicalChecksum.Compute fingerprint (existing)
    ↓
read-only JSON result           applied=false wrote=false

Live export path UNCHANGED:
    _buildFullBackupData → applyBackupFinalizer → FinalizeBackup → WriteBackupText
```

No second assembly. No second Finalizer. Consumer does **not** call `BackupFinalizer.Finalize`.

---

## 3. Host contract

`SirmanHostObject.ConsumeBackupSnapshot(string json)`

- Thin try/catch → `BackupSnapshotConsumer.Execute`
- No disk, no Merge/Replace, no RAM
- Always-allowed (same class as `FinalizeBackup` / `TestRestoreBackup`)
- Listed in `docs/ARCHITECTURE_RULES.md` and `PermissionCatalog.AlwaysAllowedHostMethods`

Envelope (same family as ARCH-6/7): `{ "data": <snapshot> }` or a raw snapshot object.

---

## 4. Core consumer

`desktop/Sirman.Core/Backup/BackupSnapshotConsumer.cs`

Result fields reuse existing validation vocabulary (`ok`, `status` = `VALID` / `VALID_WITH_WARNINGS` / `INVALID`):

- `schemaVersion`, `version`, `applicationVersion`
- `keyCount`, `sectionsCount`, `itemCounts`
- `integrityStatus`, `checksumClaimed` / `checksumAlgo` / `checksumSkipped`
- `fingerprint` = existing canonical SHA-256 hex
- `errors` / `warnings`
- `applied: false`, `wrote: false`, `engine: "core"`

Does not echo collection payloads (inspection, not a mutate-back channel).

---

## 5. Input boundary

Rejected (`invalid-input` / `invalid-json`):

- non-object / unparseable JSON
- `BackupSnapshotCatalog.ForbiddenRuntimeKeys` on envelope or payload (`localStorage`, `indexedDB`, `document`, `window`, `chrome`, `webview`, `sirmanHost`, …)
- envelope that mixes `data` **and** live collection siblings (`invoices`, `phonebook`, …)

Accepted: serialized snapshot JSON only. Functions / DOM / WinForms cannot appear in JSON.

---

## 6. Validator / Finalizer reuse

| Engine | Used by consumer? |
|---|---|
| `BackupSnapshot.Parse` | YES |
| `BackupValidator.Validate` | YES |
| `BackupCanonicalChecksum.Compute` | YES (fingerprint) |
| `BackupFinalizer` | **NO** — live export still uses existing `FinalizeBackup` |
| `BackupDryRunService` | **NO** — Restore preview stays `TestRestoreBackup` |

No duplicated validation or finalize logic.

---

## 7. No-restore proof

Consumer and Host method source contain none of: `importData`, `applyBackupSelective`, `applyBackupMergeSections`, `applyBackupReplaceSections`, `sv()`, `svWarr()`, `render*`, `resetAll`.

`applied` is always JSON `false`. HTML helper forces `applied=false` / `wrote=false`. HTML-only (no Host) returns `engine: html-unavailable` without touching Restore.

`exportData` / `buildBackupObject` do not call `consumeBackupSnapshot`.

---

## 8. No-storage-write proof

Consumer: no `File.Write`, `localStorage`, `indexedDB`, SQLite.

HTML helper: no `setItem` / `indexedDB`. Sandbox `setItem` count remains 0 around consume. Host method does not call `WriteBackupText`.

---

## 9. Runtime tests

Core `BackupSnapshotConsumerTests`: T1–T20 plus Host thinness, engine reuse, invalid JSON, csproj purity.

HTML: G1 assembly SHA-256 lock (`f65d8f39…` ARCH-9D), T17 RAM isolation, T18/T19 writes, T20 no Restore, HTML-only fail-closed.

---

## 10. Full HTML tests

```text
node test_laegh.js Sirman_Final.html
کل تست‌ها: 833
✅ موفق: 833
❌ ناموفق: 0
```

---

## 11. Full Core tests

```text
dotnet test desktop/Sirman.Core.Tests
Passed!  Failed: 0, Passed: 580, Skipped: 0, Total: 580
```

---

## 12. Existing regression

ARCH-2..ARCH-9D tests kept. `BackupDryRunBridgeTests` Host slice now ends at `ConsumeBackupSnapshot` (new neighbor method). Print always-allowed list includes the new method. `JsonBackupRepository.TbdMarker` still `html-backup-engine`.

---

## 13. Exact files changed

| File | Role |
|---|---|
| `desktop/Sirman.Core/Backup/BackupSnapshotConsumer.cs` | consumer |
| `desktop/Sirman.Desktop/SirmanHostObject.cs` | thin Host method |
| `desktop/Sirman.Core/Security/PermissionCatalog.cs` | always-allowed |
| `docs/ARCHITECTURE_RULES.md` | Host allow-list |
| `Sirman_Final.html` / `Laegh_Final.html` | optional `consumeBackupSnapshot` helper (not on export) |
| `desktop/Sirman.Core.Tests/BackupSnapshotConsumerTests.cs` | T1–T20 |
| `desktop/Sirman.Core.Tests/BackupDryRunBridgeTests.cs` | Host slice |
| `desktop/Sirman.Core.Tests/PrintHardwareFactsTests.cs` | allow-list |
| `test_laegh.js` | HTML locks + T17–T20 |
| this report | |

`_buildFullBackupData`, `_safeArr`, `_safeObj`, Restore, Phonebook, SQLite, `resetAll` not modified (assembly SHA-256 lock).

---

## 14. Confirmation

| Surface | Changed? |
|---|---|
| `_buildFullBackupData` | **NO** (ARCH-9D SHA-256) |
| Restore / Merge / Replace | **NO** |
| Phonebook | **NO** |
| SQLite | **NO** |
| `resetAll` | **NO** |
| live export/autosave | **NO** — still Finalizer path |

---

## 15. Remaining gaps

1. Consumer is **opt-in**. Live export does not automatically consume for inspection.
2. HTML-only has no Core inspect (`html-unavailable`).
3. Assembly still happens in HTML (by design).
4. Restore apply still HTML.
5. `JsonBackupRepository` still TBD.
6. Portable integrity still does not compare claimed SHA-256 digest vs canonical hex (pre-existing P1C-7 rule); unknown algo / section mismatches fail closed.

---

## 16. Next safest architectural step

Wire **inspection-only** consume on the export path *after* clone and *beside* (not instead of) existing Finalizer — still no Restore cutover, no Merge/Replace, no P1C-8, no Phonebook/SQLite. Do not extract `_buildFullBackupData`.

---

## Q1–Q16

**Q1. Does Core now consume the isolated snapshot?**  
YES. `BackupSnapshotConsumer.Execute` → Parse + Validate.

**Q2. Does it consume only serialized snapshot data?**  
YES. JSON object / `{data:…}` only; live handles and envelope mix rejected.

**Q3. Does Core access live RAM?**  
NO. String in, clone via `BackupSnapshot.Parse`.

**Q4. Does Core access localStorage/IndexedDB?**  
NO. Rejected as keys; not read.

**Q5. Does Core access DOM/WebView2?**  
NO. Core csproj has no WebView2/WinForms. Host method is string in/out.

**Q6. Is Validator reused?**  
YES. `BackupValidator.Validate`.

**Q7. Is Finalizer reused?**  
YES as the **existing** live `FinalizeBackup` path. Consumer does **not** call Finalizer (no second engine).

**Q8. Is there a second Backup engine?**  
NO. Parse/Validate/inspect only. Repository TBD unchanged.

**Q9. Can this path invoke Restore?**  
NO. Source lock + `applied:false`.

**Q10. Can it write storage?**  
NO. `wrote:false`; no disk/LS/IDB.

**Q11. Is `_buildFullBackupData` unchanged?**  
YES. SHA-256 `f65d8f393d91de7e984540060ceec6deb14976d9dce4bd7b82261d2e69c5df5f`.

**Q12. Did live Backup semantics change?**  
NO. export/autosave still Finalizer; consume is not on that path.

**Q13. Did Restore change?**  
NO.

**Q14. Did Phonebook change?**  
NO.

**Q15. Did SQLite change?**  
NO.

**Q16. What is the next safest extraction?**  
Optional inspect-on-export using this consumer beside Finalizer. Not Restore. Not assembly extraction.

---

## STOP

`_buildFullBackupData` not extracted. Restore cutover not started. Merge/Replace not implemented in Core. P1C-8 not started. Phonebook and SQLite untouched.
