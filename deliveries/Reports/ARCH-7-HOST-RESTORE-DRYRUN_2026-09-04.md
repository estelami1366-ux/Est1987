# SIRMAN — ARCH-7 Host-Gated Read-Only Restore DryRun

**Date:** 2026-09-04  
**Packet:** Expose existing Core `BackupDryRunService` through Host for **preview / analysis only**. Not Restore apply.  
**Product version left unchanged:** `1405.6.3α`  
**Branch:** `cursor/arch-7-host-restore-dryrun-fa01`  
**Base:** `cursor/architecture-baseline-after-arch6-fa01`

---

## Phase 3 Change Gate

```text
CHANGE: ARCH-7 Host-gated read-only DryRun preview
CLASS: Host-bridge wiring of an already-extracted Core engine (ARCH-4)
Q1: CAPABILITY — exe can analyze a serialized backup without applying it
Q2: RunBusiness: NO. New Host method TestRestoreBackup on existing sirmanHost
Q3: Persistence: TestRestoreBackup does not write. Applied=false always
Q4: Printing: NO
Q5: HTML-only: PRESERVED — no Host ⇒ existing HTML testRestoreBackup
Q6: New transport/DB/ACL: NO. Method added to existing Host allow-list
RESULT: PASS
AUTHORITY: explicit user packet ARCH-7 2026-09-04
```

Restore cutover, Merge-in-Core, Replace-in-Core, `_buildFullBackupData`, Phonebook, SQLite, `JsonBackupRepository` activation, and P1C-8 were not started.

---

## 1. Existing Restore path (unchanged)

```text
importData(file)
    → parse / decrypt
    → HTML validateRequiredBackupCollections
    → HTML validateBackupStructuralIntegrity
    → HTML validateBackupPortableIntegrity
    → HTML verifyChecksum
    → HTML applySchemaMigrations + migrateBackup
    → preview modal
    → confirmRestorePreview
         → applyBackupSelective
              → applyBackupMergeSections  OR  applyBackupReplaceSections
```

`importData` does **not** call `TestRestoreBackup`. Merge/Replace remain HTML.

---

## 2. New Host dry-run path

```text
runPendingTestRestore()                  existing "تست بازگردانی (بدون اعمال)"
    → testRestoreBackup(data)            single gate
         ├─ exe + host.TestRestoreBackup → BackupDryRunBridge → BackupDryRunService
         └─ HTML-only / mode=html        → existing HTML clone/validate/migrate preview
    → alert / audit                      DRY_RUN_ONLY, applied=false
    → NEVER applyBackupMergeSections
    → NEVER applyBackupReplaceSections
```

One active preview engine per call. Core INVALID does not fall back to HTML.

---

## 3. Contract

**Request** (serialized DTO only):

```json
{
  "data": { "...backup snapshot..." },
  "nowMs": 1700000000000
}
```

Rejected at request root (not inside `data`): `localStorage`, `indexedDB`, `webview`, `document`, `chrome`, `window`, `invoices`, `phonebook`, `warranties`, `products`, `sales`, `parts`, `accounts`, `pb`.

Missing `data` or invalid JSON → `{ "ok": false, "error": "invalid-json"|"invalid-input" }`.

No existing Host JSON size-limit policy was found; none was invented.

**Response (analysis, including INVALID):**

```json
{
  "ok": true,
  "engine": "core",
  "mode": "DRY_RUN_ONLY",
  "applied": false,
  "wrote": false,
  "status": "VALID|VALID_WITH_WARNINGS|INVALID",
  "sourceSchema": 1,
  "targetSchema": 1,
  "migrationRequired": false,
  "migrationPerformed": true,
  "migrationStatus": "NotAttempted|Performed|Failed",
  "integrityStatus": "VALID|INVALID|NOT_VERIFIABLE",
  "errors": [],
  "warnings": [],
  "log": [],
  "validation": {},
  "integrity": {},
  "migration": {},
  "data": { "...migrated clone when gates passed..." }
}
```

`ok` is false whenever `status === INVALID`. INVALID is not remapped to WARNING or PASS. Absent/none checksum stays `integrityStatus: NOT_VERIFIABLE` (P1C-7).

No wording equivalent to "restore successful". Preview UI says «تحلیل فقط‌خواندنی» / `DRY_RUN_ONLY`.

---

## 4. Core service used

`Sirman.Core.Backup.BackupDryRunService.Run` (ARCH-4). Composes:

- `BackupValidator` (ARCH-2)
- SHA-256 digest compare (`BackupCanonicalChecksum`, P1C-7)
- `BackupMigrator.MigratePackage` (ARCH-3)

No new business rules. `Applied` is already always false in the service; the bridge also hard-codes `"applied":false`.

---

## 5. Host adapter

`desktop/Sirman.Desktop/SirmanHostObject.cs`:

```csharp
public string TestRestoreBackup(string json)
    => BackupDryRunBridge.Execute(json ?? "");
```

Thin wrap only. No validation, migration, checksum, or disk write in Host.

`BackupDryRunBridge` lives in Core (`net8.0`). Always-allowed like `FinalizeBackup` (preview without login). Listed in `PermissionCatalog.AlwaysAllowedHostMethods` and `docs/ARCHITECTURE_RULES.md`.

---

## 6. Preview integration

Wired **only** into the existing explicit preview hook:

- Button: `🧪 تست بازگردانی (بدون اعمال)` → `runPendingTestRestore`
- `testRestoreBackup` gate: Host present → Core; else HTML
- Explicit rollback: `window.SIRMAN_RESTORE_DRYRUN_MODE = 'html'`

**Not** wired into `importData`, `confirmRestorePreview`, or `applyBackupSelective`.

---

## 7. Proof of Applied=false

- Core `BackupDryRunResult.Applied` is always assigned `false`.
- Bridge JSON always emits `"applied":false` (not copied from a caller flag).
- HTML `mapCoreDryRunToPreview` sets `applied: false`.
- `runPendingTestRestore` forces `r.applied = false` before audit/alert.
- Tests: Core `T17_AppliedAlwaysFalse_OnEveryGolden`; HTML G1/G2/G3/G5.

---

## 8. Proof of zero storage mutation

Bridge/Host source contains no `File.Write` / `WriteAllText` / Sqlite APIs. DryRun clones input; golden immutability still holds.

HTML G2/G5 spies during Core preview: `sv`, `svWarr`, `localStorage.setItem`, `indexedDB.open`, `applyBackupMergeSections`, `applyBackupReplaceSections`, `render`/`renderPB`, `resetAll` → **0 calls**.

`importData` still owns live writes. This packet does not execute it.

---

## 9. Negative test results

| Forbidden | Result |
|---|---|
| `sv` / `svWarr` | 0 (G2, G5) |
| `localStorage.setItem` | 0 |
| IndexedDB write/open | 0 |
| `applyBackupMergeSections` | 0 |
| `applyBackupReplaceSections` | 0 |
| `render*` | 0 |
| `resetAll` | 0 |
| Host method disk write | source slice clean (T19) |
| SQLite in bridge/Host method | none (T18/T20) |
| Phonebook APIs in Host method | none (T19) |

---

## 10. Full HTML suite

`node test_laegh.js Sirman_Final.html`

**797/797 PASS** (previous 792 + 5 ARCH-7 G1–G5)

Log: `/opt/cursor/artifacts/arch7-html-tests.log`

`Laegh_Final.html` is byte-identical to `Sirman_Final.html`.

---

## 11. Full Core suite

`dotnet test desktop/Sirman.Core.Tests -c Release`

**484/484 PASS** (previous 457 + 27 ARCH-7 bridge)

Log: `/opt/cursor/artifacts/arch7-core-tests.log`

ARCH-2..ARCH-6 engines still pass (`Arch2_3_4_5_6_Regression_StillPass`).

---

## 12. Bridge/runtime tests

Mapped to ARCH-4 golden:

| Packet | Golden id | Result |
|---|---|---|
| T1 valid schema≥1 | T1-schema1-current-valid | VALID, applied false |
| T2 schema0 legacy | T2-schema0-legacy | VALID + migrate |
| T3 missing warranties | T7-missing-warranties | INVALID |
| T4 missing invoices | T8-missing-invoices | INVALID |
| T5 schema≥1 missing sales | T4-schema1-missing-sales | INVALID, NotAttempted |
| T6 missing parts | T5-schema1-missing-parts | INVALID |
| T7 missing accounts | T6-schema1-missing-accounts | INVALID |
| T8 count mismatch | T9-itemcounts-mismatch | INVALID |
| T9 broken attachment | T10-attachment-broken | INVALID |
| T10 duplicate identity | T11-duplicate-identity-warning | VALID_WITH_WARNINGS |
| T11 valid SHA-256 | T12-valid-checksum | integrity VALID |
| T12 invalid SHA-256 | T13-invalid-checksum | INVALID, not PASS |
| T13 absent/none | T14 / T14b | NOT_VERIFIABLE, compatible |
| T14 malformed JSON | raw `{not-json` | invalid-json |
| T15 Persian | T18-persian-unicode | match |
| T16 schema0 migrate | T3-schema0-missing-sales-parts-accounts | migrate after gates |
| T17 applied always false | all goldens | false |
| T18 no storage writes | source + HTML spies | PASS |
| T19 no Phonebook mutation | Host slice + spies | PASS |
| T20 no SQLite | source | PASS |

HTML G1–G5 cover routing, fail-closed, explicit html switch, live Restore unchanged, negative spies.

---

## 13. Confirmation (unchanged)

| Surface | Status |
|---|---|
| Live Restore (`importData`) | unchanged; no `TestRestoreBackup` |
| Merge | unchanged |
| Replace | unchanged |
| Phonebook | unchanged |
| SQLite | not in this commit |
| resetAll | unchanged |
| `_buildFullBackupData` | still HTML assembly |
| `JsonBackupRepository` | still `html-backup-engine` |

---

## 14. Known gaps

1. HTML `testRestoreBackup` implementation remains for HTML-only / explicit rollback. Two preview implementations; one active per call.
2. Restore **apply** is still HTML (validator → migrate → merge/replace).
3. Restore preview **modal** (section checkboxes) still uses HTML-parsed `_pendingRestore.data`, not Core DryRun, except the explicit test button.
4. Shop EXE must ship `TestRestoreBackup` before Core preview is available on the machine.
5. No JSON size limit was added (none existed on Host).

---

## 15. Next safest extraction

Do **not** cut over Restore apply. Do **not** extract `_buildFullBackupData`. Do **not** implement Merge/Replace in Core. Do **not** start P1C-8.

After ARCH-7, the next smallest Host-shaped step is still **not** live apply: optionally show DryRun `status`/`errors` on the existing preview modal as **display-only**. The first Restore-adjacent engine cutover (Validator fail-closed gate inside `importData`) is a separate packet with live-data risk.

---

## Governance work report (قانون ۱۳)

1. **کار:** ARCH-7 Host DryRun فقط‌خواندنی  
2. **شاخه:** `cursor/arch-7-host-restore-dryrun-fa01`  
3. **تغییر:** پل Host + دروازه preview؛ بدون apply  
4. **نسخه:** `1405.6.3α`  
5. **HTML:** 797/797  
6. **Core:** 484/484  
7. **رگرسیون ARCH-2..6:** PASS  
8. **داده زنده:** بدون Restore اجرا / Phonebook / SQLite / resetAll  
9. **چاپ:** دست‌نخورده  
10. **HTML-only:** حفظ شده  
11. **Rollback:** `SIRMAN_RESTORE_DRYRUN_MODE='html'`  
12. **Restore cutover:** شروع نشد  
13. **وضعیت:** COMPLETED (کد+تست لینوکس). EXE فروشگاه NEEDS HUMAN VERIFICATION  
14. **راهنما:** دکمه تست از قبل در راهنما بود؛ پیام DRY_RUN_ONLY  
15. **گزارش:** همین فایل  

---

## Q1–Q14

**Q1. Does Host expose TestRestoreBackup?**  
YES. `SirmanHostObject.TestRestoreBackup` → `BackupDryRunBridge.Execute`.

**Q2. Does it call only Core DryRun?**  
YES. Host has no other backup calls in that method. Bridge calls only `BackupDryRunService.Run`.

**Q3. Does Host contain no business validation/migration logic?**  
YES. Try/catch + `SafeError` only.

**Q4. Is Applied always false?**  
YES. Service, bridge JSON, HTML mapper, T17.

**Q5. Can the dry-run write localStorage?**  
NO. G2/G5 `setItem===0`. Bridge has no browser APIs.

**Q6. Can it write IndexedDB?**  
NO. G2/G5 `idb===0`.

**Q7. Can it invoke Merge?**  
NO. Preview path does not call `applyBackupMergeSections`. G2/G5/G4.

**Q8. Can it invoke Replace?**  
NO. Same for `applyBackupReplaceSections`.

**Q9. Can invalid integrity be returned as PASS?**  
NO. T12 invalid SHA-256 → `ok:false`, `status:INVALID`. Bridge clamps INVALID.

**Q10. Is current live Restore unchanged?**  
YES. `importData` still HTML validate → migrate → merge/replace. G4.

**Q11. Did live data change?**  
NO. Tests synthetic. No shop SoT writes in this packet.

**Q12. Did Phonebook change?**  
NO.

**Q13. Did SQLite change?**  
NO. `JsonBackupRepository` remains `html-backup-engine`.

**Q14. What is the safest next extraction?**  
Do not cut over Restore apply or `_buildFullBackupData`. Optional display-only DryRun fields on the preview modal; Validator-in-`importData` is a later, riskier packet.

---

## STOP

Restore cutover not started. Merge/Replace not implemented in Core. `_buildFullBackupData` not extracted. Phonebook / SQLite / `JsonBackupRepository` not activated.
