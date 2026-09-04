# SIRMAN — ARCH-6 Controlled Backup Finalize Cutover

**Date:** 2026-09-04  
**Packet:** Controlled cutover of backup **finalization only**. Not data assembly. Not Restore.  
**Product version left unchanged:** `1405.6.3α`  
**Branch:** `cursor/arch-6-backup-finalize-cutover-fa01`  
**Base:** `cursor/arch-5-core-backup-serializer-fa01`

---

## Phase 3 Change Gate

```text
CHANGE: ARCH-6 gated cutover of finalizeBackupPackage → Core BackupFinalizer
CLASS: Host-bridge wiring of an already-extracted Core engine (ARCH-5)
Q1: CAPABILITY — exe backup finalize uses Core; HTML still assembles
Q2: RunBusiness: NO. New Host method FinalizeBackup on existing sirmanHost
Q3: Persistence: FinalizeBackup does not write. WriteBackupText unchanged
Q4: Printing: NO
Q5: HTML-only: PRESERVED — no Host ⇒ HTML finalizeBackupPackage
Q6: New transport/DB/ACL: NO. Method added to the existing Host allow-list
RESULT: PASS
AUTHORITY: explicit user packet ARCH-6 2026-09-04
```

ARCH-7 and P1C-8 were not started. `_buildFullBackupData` was not extracted. Restore / Merge / Replace / Phonebook / SQLite / resetAll were not changed.

---

## 1. Previous runtime path

```text
_buildFullBackupData()                 HTML RAM assembly
    → finalizeBackupPackage()          HTML (mutates)
    → attachChecksum()                 HTML WebCrypto
    → JSON.stringify(data, null, 2)
    → WriteBackupText / Blob download  existing write
```

Call sites: `exportData`, `buildBackupObject`/`doAutoSave`, `exportArchiveBackup`.

---

## 2. New runtime path

```text
_buildFullBackupData()                 HTML RAM assembly  (UNCHANGED)
    → applyBackupFinalizer()           single gate
         ├─ exe + host.FinalizeBackup  → Core BackupFinalizer   AUTHORITATIVE
         └─ HTML-only / mode=html      → HTML finalizeBackupPackage
    → attachChecksumUnlessCore()       skipped when Core already attached SHA-256
    → JSON.stringify(data, null, 2)    pretty disk (not hashed)
    → WriteBackupText / Blob download  UNCHANGED infrastructure
```

One active finalizer per run. Not both.

---

## 3. Exact Host boundary

Existing `sirmanHost` (`chrome.webview.hostObjects.sync.sirmanHost`).

New method on `SirmanHostObject` (not a second object, not REST):

```text
FinalizeBackup(string json) → string json
```

Thin wrapper: `BackupFinalizeBridge.Execute(json)`. No `File.WriteAllText`. Always-allowed like `WriteBackupText` (backup preservation without login).

Registered in `docs/ARCHITECTURE_RULES.md` Host allow-list and `PermissionCatalog.AlwaysAllowedHostMethods`.

---

## 4. Exact contract

**Request** (serialized DTO only):

```json
{
  "data": { "...assembled snapshot from HTML..." },
  "origin": "manual|autosave|archive",
  "kind": "full|partial|archive",
  "checksumMode": "sha256|none|leave",
  "nowMs": 1700000000000,
  "stampExportedAt": false
}
```

Rejected: missing `data`; non-object root; keys `localStorage`, `indexedDB`, `webview`, `document`, `chrome`.

**Response (ok):**

```json
{
  "ok": true,
  "engine": "core",
  "wrote": false,
  "data": { "...finalized package..." },
  "canonicalString": "...",
  "sha256Hex": "...",
  "checksum": "...",
  "checksumAlgo": "SHA-256",
  "exportedAt": "...",
  "sectionChecksums": {},
  "manifest": {}
}
```

`data` is compact JSON matching HTML `JSON.stringify` (BackupJsJson). Pretty-print happens later in HTML for disk.

**Response (fail):** `{ "ok": false, "error": "...", "message": "..." }` — no `data`.

Default `checksumMode` on the bridge is `sha256` (exe always has SHA-256).

---

## 5. Cutover switch / default

`backupFinalizerMode()`:

| Condition | Mode | Engine |
|---|---|---|
| `window.SIRMAN_BACKUP_FINALIZER_MODE === 'html'` | `html` | HTML `finalizeBackupPackage` (explicit rollback) |
| `window.SIRMAN_BACKUP_FINALIZER_MODE === 'core'` and Host missing | throw | fail-closed |
| Host has `FinalizeBackup` (new exe) | `core` | Core only |
| No Host (HTML-only / old exe without method) | `html` | HTML only (capability, not hidden fallback) |

Default follows existing architecture: **exe with Host method → Core is source of truth** (same pattern as `RunBusiness`). HTML-only keeps working because Core is not there.

Rollback is explicit and observable: set `SIRMAN_BACKUP_FINALIZER_MODE='html'`. ARCH-6 G3 locks this.

---

## 6. Failure semantics

If Core is selected and `FinalizeBackup` returns `ok !== true` or throws:

- `applyBackupFinalizer` throws
- HTML `finalizeBackupPackage` is **not** called (G2: `htmlCalls === 0`)
- `exportData` / `exportArchiveBackup` return after error toast + `logBackupAudit(..., 'fail', ...)`
- no success toast, no `logBackupAudit('ok')`, no Blob/`WriteBackupText` of a partial package

---

## 7. No-fallback proof

`applyBackupFinalizer`: `if (mode === 'core') { applyCore...; return; }` then only else HTML.

G2 spies `finalizeBackupPackage` during a failing Host call: **0 HTML calls**, input has no `magic`.

There is no `catch { finalizeBackupPackage(...) }`.

---

## 8. HTML/Core output comparison

ARCH-5 golden remains the HTML baseline. ARCH-6 `BackupFinalizeBridge.Execute` is compared to that golden for T1–T10:

| Packet T | Golden id | Result |
|---|---|---|
| T1 normal | T1-valid-ordinary | compact / canonical / SHA-256 match |
| T2 empty | T2-empty-collections | match |
| T3 Persian | T3-persian-text | match |
| T4 nested | T4-nested-object | match |
| T5 attachmentsIndex | T12-attachmentsIndex | match |
| T6 itemCounts | T13-itemCounts | match |
| T7 SHA-256 | T9-sha256 | stored checksum = sha256Hex |
| T8 none | T8-checksumAlgo-none | stored empty, algo none |
| T9 exportedAt | T6-exportedAt-variation | top-level mutate does not change SHA-256 |
| T10 sectionChecksums | T11-sectionChecksums | rebuilt map matches |

Pretty-print (`JSON.stringify(data,null,2)`) remains the disk representation and is **not** the hash input.

---

## 9. Disk write boundary

`FinalizeBackup` / `BackupFinalizeBridge` do not write files (`wrote: false`).

After success, HTML still:

- pretty-stringifies the finalized object
- downloads a Blob (manual) and/or
- `WriteBackupText('sirman_autosave.txt', text)` (autosave / exe stable folder)

No new storage mechanism. `JsonBackupRepository` remains `"html-backup-engine"`.

---

## 10. Runtime synthetic tests

No live Restore. No shop localStorage. Tests use:

- HTML `new Function` mocks of `getSirmanHostSync().FinalizeBackup` (routing, fail-closed, explicit html switch)
- Core `BackupFinalizeBridge.Execute` on ARCH-5 golden snapshots (equivalence)

`_buildFullBackupData` is not invoked against live RAM in ARCH-6 tests; fixtures are the same shape that function emits.

---

## 11. Full test counts

| Suite | Result |
|---|---|
| HTML `node test_laegh.js Sirman_Final.html` | **792/792** (787 previous + 5 ARCH-6 G1–G5) |
| Core `dotnet test desktop/Sirman.Core.Tests -c Release` | **457/457** (437 previous + 20 ARCH-6 bridge) |

ARCH-2..ARCH-5 HTML G-tests still PASS. Core validator/migrator/dry-run/finalizer tests still PASS.

---

## 12. Regression results

P1C-1..P1C-7 HTML groups PASS inside 792.  
ARCH-2/3/4/5 Core engines PASS inside 457 (`Arch2_3_4_5_Regression_StillPassThroughExistingEngines`).

---

## 13. Confirmation (unchanged)

| Surface | Status |
|---|---|
| Restore (`importData`) | unchanged; G4 forbids `FinalizeBackup` |
| Merge | unchanged |
| Replace | unchanged |
| Phonebook (`savePBContact`) | unchanged |
| SQLite | not in this commit |
| resetAll | unchanged |
| `_buildFullBackupData` | still HTML assembly |
| `WriteBackupText` | still the disk write |

`Laegh_Final.html` is byte-identical to `Sirman_Final.html`.

---

## 14. Does production backup generation now use Core?

**YES, on new exe** (Host exposes `FinalizeBackup`): `applyBackupFinalizer` selects `core` and does not run HTML finalize.

**NO, on HTML-only / old exe without the method:** HTML `finalizeBackupPackage` remains the only engine (capability detection).

---

## 15. Is HTML finalize still present?

**YES.** `function finalizeBackupPackage` and `function attachChecksum` remain for HTML-only and for explicit `SIRMAN_BACKUP_FINALIZER_MODE='html'`. They are not deleted. They are not used when Core is selected.

---

## 16. Conditions required before deleting HTML finalize

Do **not** delete yet. Required first:

1. Shop exe actually ships this Host method (same version as HTML).
2. HTML-only file:// path is either retired or given an explicit unsupported message.
3. Explicit product decision that HTML-only backup finalize is no longer required.
4. Evidence that `SIRMAN_BACKUP_FINALIZER_MODE='html'` rollback is unused.

---

## 17. Next safest extraction

Do **not** extract `_buildFullBackupData` (live RAM).  
Do **not** cut over Restore / Merge / Replace.

Stop here. ARCH-7 was not started.

---

## Q1–Q16

**Q1. Is Core now the authoritative finalizer?**  
YES on exe with `FinalizeBackup`. Evidence: `backupFinalizerMode()` → `core`; G1 `htmlFinalize===0`.

**Q2. Is there only one active finalization path?**  
YES. Gate returns after Core; HTML path is the `else`. G2 proves no dual run on failure.

**Q3. Does HTML still assemble backup data?**  
YES. `_buildFullBackupData` still feeds the snapshot. G2 ARCH-5.

**Q4. Does Host pass only serialized/data input?**  
YES. JSON `{data,origin,kind,checksumMode}`. Live keys rejected. G1 `hasLive===false`.

**Q5. Does Core produce the same canonical checksum?**  
YES. Bridge T1–T10 `sha256Hex` / `canonicalString` match ARCH-5 HTML golden.

**Q6. Does Core failure fail closed?**  
YES. Throw + audit `fail` + no write. G2.

**Q7. Does the old HTML finalizer silently run as fallback?**  
NO. No catch-fallback. Explicit `mode='html'` is the only rollback (G3).

**Q8. Did Restore change?**  
NO. `importData` has no `FinalizeBackup` / `applyBackupFinalizer`.

**Q9. Did Merge/Replace change?**  
NO.

**Q10. Did live data change?**  
NO. Tests are synthetic. No shop SoT writes in this packet.

**Q11. Did Phonebook change?**  
NO.

**Q12. Did SQLite change?**  
NO. `JsonBackupRepository.TbdMarker` still `html-backup-engine`.

**Q13. What remains in HTML?**  
Assembly (`_buildFullBackupData`), download/pretty-print, encrypt prompt, IDB mirror, HTML-only finalize+attachChecksum, Restore/Merge/Replace.

**Q14. What is the next safest extraction?**  
Do not extract `_buildFullBackupData`. Do not start Restore cutover in this packet. Stop after ARCH-6.

---

## STOP

ARCH-7 not started. P1C-8 not started. `_buildFullBackupData` not extracted. Restore / Phonebook / SQLite not touched.
