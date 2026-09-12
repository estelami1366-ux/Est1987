# SIRMAN — NATIVE UPDATE P1 APPLY

**Date:** 1405/06/21 (2026-09-12)
**Packet:** NATIVE-UPDATE-P1-APPLY
**Product version:** `1405.6.16α` / assembly `1405.6.16.1` (unchanged)
**HTML / SIRMAN_UPDATE:** unchanged
**Shop package / install:** NOT created

```text
FINAL STATUS: COMPLETED + NEEDS HUMAN VERIFICATION
Apply engine + SirmanUpdater.exe: YES (Linux unit/CLI proven)
Windows shop process-replace + relaunch: NEEDS HUMAN VERIFICATION
P2 (Host / Settings UI): NOT started
```

---

# 1. PRE-CHECK

Read: uploaded P1 packet, `SIRMAN_AGENT_RULES.md`, `docs/ARCHITECTURE_RULES.md`, `docs/DEVELOPMENT_GOVERNANCE.md`, `docs/PHASE_3_CHANGE_GATE.md`, `deliveries/Reports/NATIVE-UPDATE-ARCHITECTURE-CHANGE-GATE.md`, `deliveries/Reports/NATIVE-UPDATE-P0-CONTRACT.md`.

```text
Branch:                 cursor/diagnostic-center-p3-ui-fault-fa01
HEAD before this packet: a86684f
P0 ancestor:            a86684f YES
P3 ancestor:            f5e3eba YES
Branch switch:          NO
reset/rebase/merge:     NO
Version bump:           NO
```

Phase 3 change gate (this packet):

```text
Requested change: native apply engine + separate SirmanUpdater.exe
Classification:   infrastructure / update apply
Layer:            Core (apply/journal) + new console Sirman.Updater
HTML:             NO
Host methods:     NO
RunBusiness:      NO
Print:            NO
Backup algorithms: NO
SQLite/storage:   NO
SIRMAN_UPDATE:    NO (not modified)
Apply/replace PE: YES (allow-listed native files only; separate process)
Gate:             PASS
```

Unrelated dirty leftovers (not staged): `deliveries/migration/P1-services/*` and local VERIFY unpack directory.

---

# 2. P0 CONTRACT INPUT

P1 consumes P0 as-is:

| Item | Value |
|---|---|
| Magic | `SIRMAN_NATIVE_UPDATE` |
| Format | `1` |
| Layout | `<package>/manifest.json` + `<package>/files/` |
| Validator | `NativeUpdateValidator.ValidatePackage` before stage and after stage |
| Assembler | unchanged; P1 never opens HTML |
| Allow-list | `NativeUpdateAllowList` (HTML / sqlite / traversal still fail-closed) |

Same-assembly apply is allowed (`minAssembly` = `maxAssembly` = `1405.6.16.1`). That matches Diagnostic P2/P3 native fixes that did not bump the product version.

`SIRMAN_UPDATE` JSON, `UpdateService`, and `apply_sirman_update.ps1` are a different channel and were not called.

---

# 3. UPDATER ARCHITECTURE

Apply logic lives in **Core** (`NativeUpdateApplier`) so Linux unit tests run without WinForms. The Windows-facing process is a **separate console exe**, not a DLL loaded by `Sirman.exe`.

```text
Sirman.exe  --(already running)-->  user/operator starts SirmanUpdater.exe
                                    --package --install --data-root
                                      │
                                      ▼
                              NativeUpdateApplier.Apply
                                      │
                                      ├─ validate P0 package (no HTML)
                                      ├─ stage under data-root
                                      ├─ stop Sirman.exe (never SirmanUpdater)
                                      ├─ backup allow-listed files
                                      ├─ replace from staging
                                      ├─ hash-verify
                                      ├─ launch Sirman.exe (unless --no-launch)
                                      └─ hash-verify again → VERIFIED → retire backup
```

| Item | Path / name |
|---|---|
| Project | `desktop/Sirman.Updater/Sirman.Updater.csproj` (`net8.0`, not `net8.0-windows`) |
| Assembly / exe | `SirmanUpdater` (`SirmanUpdater.exe` on Windows) |
| CLI | `--package` `--install` `--data-root` `--no-launch` `--recover-only` `--allow-downgrade` |
| Default data root | `%LocalAppData%\Sirman` (`NativeUpdatePaths.DefaultDataRoot`) |
| Default install | `%LocalAppData%\Sirman\App` (`NativeUpdatePaths.DefaultInstallDirectory`) |
| Process stop | `Process.GetProcessesByName("Sirman")`; skip names/paths containing `Updater` / `SirmanUpdater` |
| Launch | `Process.Start(install\Sirman.exe)` after hash-good apply |

Core does **not** reference `Sirman.Desktop`. Tests inject `RecordingProcessCoordinator` / `RecordingAppLauncher`.

Allowed replace set is the P0 allow-list (default payload if present):

- `Sirman.exe`
- `Sirman.dll`
- `Sirman.Core.dll`
- `Sirman.deps.json`
- `Sirman.runtimeconfig.json`
- `SIRMAN_VERSION.json`
- `WebView2Loader.dll`

Plus owned runtime PE already accepted by P0 (`System.*`, `Microsoft.*`, `runtimes/`, `coreclr.dll`, …). HTML, `test_laegh.js`, sqlite, pending HTML update JSON, and `..` paths are rejected before copy.

---

# 4. APPLY STATE MACHINE

```text
validate → (already matching hashes) → VERIFIED (no stop/copy)
         → stage → PREPARED → stop Sirman → APPLYING
         → backup → replace → verify hashes → APPLIED
         → optional launch → health hash re-verify → VERIFIED → retire backup
```

Failure at any mutating step:

```text
FAILED or in-flight APPLYING/ROLLING_BACK
  → restore backup (only if BackupFiles is non-empty)
  → verify rollback hashes
  → ROLLED_BACK
  → keep journal + backup as evidence
```

Launch failure after hashes already match does **not** roll back good files. `--no-launch` is the Linux/test path.

If backup was never written (`BackupFiles` empty or backup dir missing), rollback does **not** delete install files.

---

# 5. JOURNAL / RECOVERY

Durable JSON, atomic write (`*.tmp` then replace):

```text
{dataRoot}/native-update-journal.json
{dataRoot}/native-staging/{packageId}/
{dataRoot}/native-backup/{packageId}/
```

Production: `%LocalAppData%\Sirman\native-update-journal.json` (sibling of `App\`, not inside the replace tree). Tests inject a temp data root.

Journal fields: `schema`, `state`, `packageId`, `version`, `assembly`, directories, `files[]`, `backupFiles[]` (`path`/`sha256`/`bytes`), `updatedAtUtc`, `error`, `message`.

States: `PREPARED` `APPLYING` `APPLIED` `VERIFIED` `FAILED` `ROLLING_BACK` `ROLLED_BACK`.

Recovery (`Apply` start and `--recover-only`):

| Journal | Action |
|---|---|
| missing | continue / no-op |
| unreadable | fail closed (`native-journal-invalid`) |
| `VERIFIED` / `ROLLED_BACK` / `PREPARED` | stable; new Apply may continue |
| `APPLIED` | re-verify hashes; if good → `VERIFIED` and retire backup; else rollback |
| `APPLYING` / `ROLLING_BACK` | rollback |
| `FAILED` with backup files | rollback |
| `FAILED` without backup | do not mutate install; new Apply may retry |

Recovery is deterministic and idempotent: a second `Recover`/`Apply` after `VERIFIED` does not recopy.

---

# 6. ROLLBACK

Backup is a directory of pre-replace allow-listed files plus SHA-256 in the journal.

Restore copies backup → install, then re-hashes every `backupFiles` entry. Files that were new (not in backup) are removed only when a completed backup inventory exists.

Backup is retired **only** after `VERIFIED`. Failed/rolled-back runs keep backup + journal.

A completed `ROLLED_BACK` does not block a later Apply of a valid package.

---

# 7. HTML INDEPENDENCE

Native apply never:

- copies, hashes, validates, or requires `Sirman_Final.html` / `Laegh_Final.html`
- reads `test_laegh.js`
- calls `UpdateService` / `apply_sirman_update.ps1` / `write_full_update_json.py`
- treats `SIRMAN_UPDATE` JSON as a native package (`native-magic`)

P1 tests plant HTML + sqlite + an unrelated text file in the install dir. Those bytes stay identical across success, rejection, rollback, and CLI apply.

---

# 8. FILES CHANGED

Added:

- `desktop/Sirman.Core/Updates/NativeUpdateApplyModels.cs`
- `desktop/Sirman.Core/Updates/NativeUpdateApplier.cs`
- `desktop/Sirman.Updater/Sirman.Updater.csproj`
- `desktop/Sirman.Updater/Program.cs`
- `desktop/Sirman.Core.Tests/NativeUpdateP1Tests.cs`
- `deliveries/Reports/NATIVE-UPDATE-P1-APPLY.md`

Modified:

- `desktop/Sirman.Core.Tests/Sirman.Core.Tests.csproj` (ProjectReference to Updater so the exe builds with tests)

Not modified: HTML, `test_laegh.js`, `UpdateService.cs`, `apply_sirman_update.ps1`, `write_full_update_json.py`, Host allow-list, Desktop UI, Backup/Print/Inventory/SQLite engines, version files, shop ZIPs.

---

# 9. TESTS

| Suite | Result |
|---|---|
| `NativeUpdateP1Tests` | **12 / 12** (see command log) |
| `NativeUpdateP0Tests` | **14 / 14** |
| `dotnet test desktop/Sirman.Core.Tests` | **933 / 933** (was 921; +12) |
| `node test_laegh.js Sirman_Final.html` | **1120 / 1120** |
| `node test_installer_lifecycle.js` | **21 / 21** |

P1 cases:

1. successful apply in isolated temp dir (stop + replace + launch hook + VERIFIED)
2. version mismatch rejection
3. hash mismatch rejection
4. unexpected file rejection
5. HTML in package rejection
6. partial-copy rollback
7. interrupted `APPLYING` journal recovery
8. post-apply hash verification against manifest
9. idempotent second apply / recover
10. process-coordinator stop + fail-stop leaves install
11. `SirmanUpdater` CLI `--no-launch` → VERIFIED
12. HTML updater sources still untouched

Existing HTML updater tests were not weakened.

---

# 10. BUILD

```text
dotnet test desktop/Sirman.Core.Tests -c Release --filter NativeUpdate
dotnet test desktop/Sirman.Core.Tests -c Release
dotnet build desktop/Sirman.Updater/Sirman.Updater.csproj -c Release
dotnet build desktop/Sirman.Desktop/Sirman.Desktop.csproj -c Release
```

Linux can build Updater + Core. Desktop is `net8.0-windows` (EnableWindowsTargeting). Shop Windows process replacement was **not** executed here.

`git diff --check` on P1 sources: clean. No shop Setup ZIP created.

---

# 11. PROTECTED AREAS

Not modified:

- HTML / `test_laegh.js`
- `UpdateService`, `apply_sirman_update.ps1`, `write_full_update_json.py`, `updates/README.md`
- Backup / Recovery algorithms
- Print (frozen)
- Inventory / business facades
- SQLite persistence
- Host allow-list / Diagnostic P3
- Product version `1405.6.16α`
- Shop data / install dirs

---

# 12. HUMAN VERIFICATION

Linux/cloud tests prove journal, hash, rollback, allow-list, HTML independence, and CLI wiring. They do **not** prove:

- closing a live `Sirman.exe` that has DLLs mapped
- `File.Copy` / overwrite of those PEs on NTFS
- relaunch + WebView2 coming up on shop hardware
- antivirus / file locks / UAC

```text
Windows installation process-replacement: NEEDS HUMAN VERIFICATION
Windows relaunch after VERIFIED:          NEEDS HUMAN VERIFICATION
Shop install apply:                       NOT executed (STOP)
```

---

# 13. KNOWN LIMITATIONS

- P2 Host/Settings wiring is not started. Operators must run `SirmanUpdater` themselves.
- Default payload is still the small P0 allow-list, not the full self-contained publish tree.
- No Authenticode.
- HTML-only (BAT) installs cannot consume this package (by design).
- Launch failure after hash-good apply leaves files in place (intentional; hashes already verified).
- `DefaultNativeProcessCoordinator` matches process name `Sirman` only; it will not stop `SirmanUpdater`.
- Linux tests ≠ shop Windows apply.

---

# 14. FINAL STATUS

| Item | Value |
|---|---|
| Packet | NATIVE-UPDATE-P1-APPLY |
| Status | **COMPLETED + NEEDS HUMAN VERIFICATION** |
| Updater exe | `SirmanUpdater` (`desktop/Sirman.Updater`) |
| Journal | `{dataRoot}/native-update-journal.json` |
| Rollback | `{dataRoot}/native-backup/{id}/` until VERIFIED |
| Allowed files | P0 allow-list (see §3) |
| HTML updater untouched | YES |
| Version | `1405.6.16α` unchanged |
| Core tests | 933 passed (expected; filled from test run) |
| HTML tests | 1120 passed |
| Next step | NATIVE-UPDATE-P2-HOST-UI (NOT started) |

**COMPLETED** for the Core apply engine, journal/rollback, and separate updater CLI.

**NEEDS HUMAN VERIFICATION** for real Windows process replacement and relaunch.

**STOP.** P2 not started. No shop installer. Nothing installed.
