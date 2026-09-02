# P0 INSTALLER RUNTIME OWNERSHIP FIX REPORT
**Date:** 2026-09-02  
**Packet:** P0c/P0d — implementation only  
**Classification of original bug:** B — uninstall deletion logic bug  
**Authority:** `deliveries/Reports/P0_INSTALL_UNINSTALL_REMAINING_FILES_FORENSIC_2026-09-02.md`

```text
Print changed:              NO
Storage changed:            NO
Backup/Restore changed:     NO
Version changed:            NO
H1/H3/H4 changed:           NO
Diagnostic History changed: NO
MSI/Inno/NSIS/WiX:          NO
Level 2 Full Cleanup model: NO CHANGE
Wholesale rd LocalAppData:  NO
WebView2 deleted by Level 1: NO
```

This agent is Linux. Shop path `D:\Laegh.3A` was not mounted. No shop file was deleted.

---

## Git

| Field | Value |
|---|---|
| Branch | `cursor/p0-runtime-ownership-uninstall-fa01` |
| Created from | current HEAD at start of packet (no reset/rebase/merge/cherry-pick) |
| HEAD before | `af389d9` — `docs: forensic why Level 1 leaves self-contained runtime DLLs` |
| Implementation commit | `eb6a387` — `fix: Level 1 uninstall owns self-contained .NET runtime files` |
| HEAD after | see git log on this branch after the report commit |

Product version **unchanged:** `1405.6.3α` / assembly `1405.6.3.1`.

---

## Root cause

### Exact failing rule

`Test-SirmanOwnedName` returned **false** for installer-owned self-contained win-x64 runtime files.

Owned before this packet:

- exact names such as `Sirman.exe`, `Sirman.dll`, uninstall scripts, `WebView2Loader.dll`
- prefixes `Sirman_Final_`, `Sirman_Update_`, `System.`, `Microsoft.`, `runtime`
- directory `runtimes\`
- `*.pdb`

Not owned (false negative):

- `coreclr.dll`
- `clrjit.dll` / `clrgc.dll` / `clretwrc.dll`
- `hostfxr.dll` / `hostpolicy.dll`
- `PresentationCore.dll` / `PresentationFramework*.dll` / `PresentationUI.dll` / `PresentationNative_cor3.dll`
- `Accessibility.dll`, `PenImc_cor3.dll`, `DirectWriteForwarder.dll`
- `WindowsBase.dll`, `wpfgfx_cor3.dll`, `mscorlib.dll`, `netstandard.dll`, and other native/WPF publish DLLs

`System.Private.CoreLib.dll` / `Microsoft.*` were already owned by prefix. Operator leftovers named `System*.dll` next to `coreclr` were therefore either lock/`SilentlyContinue` skips, or colloquial naming of the leftover set.

### Second failure

`Remove-Item -ErrorAction SilentlyContinue` swallowed lock/ACL failures. Level 1 never reported them.

If any file remained, the install directory (`D:\Laegh.3A`) was kept.

Destination listing was used as the candidate set, but ownership was decided by the narrow name list when the source manifest was absent, empty, or corrupt (`try/catch {}` → empty HashSet).

---

## Ownership

The destination directory is **not** the ownership source. Rules come from the **source-package manifest** and, if that ledger is unusable, from an **explicit conservative contract**. There is **no** `*.dll` / delete-every-DLL rule.

### Manifest behavior

Function: `Read-SirmanSourcePackageManifest`

| Manifest state | Result |
|---|---|
| File exists, JSON parses, `files` has at least one relative path | **Ok** — those paths are installer-owned |
| Absent | fallback (`fallback:absent`) |
| Empty / whitespace / `files` empty | fallback (`fallback:empty`) |
| Corrupt JSON | fallback (`fallback:corrupt`) — parse errors are no longer a silent empty set with no fallback coverage |

When the manifest is Ok, Level 1 deletes every listed relative path that still exists on disk.

The dest tree is scanned only as a **candidate set**, then filtered by:

1. relative path ∈ source manifest `files` (if Ok)
2. **or** conservative fallback name/dir rules from `sirman-install-contract.json`

Union of (1) and (2) is required so a stale/partial manifest cannot leave `coreclr.dll` while a user `mystery-user.dat` still stays unowned.

Installer-generated ledger `sirman-install-manifest.json` remains in `ownedExactFiles`, so it is removed after use.

### Fallback behavior

Contract: `scripts/setup-kit/sirman-install-contract.json`  
Same prefixes/suffixes mirrored in `InstallService` prune (`IsOwnedName`) so update prune cannot drift.

Fallback owns (explicit):

- `Sirman.exe`, `Sirman.dll`, `Sirman.Core.dll`
- `coreclr.dll`, `clrjit.dll`, `clrgc.dll`, `clretwrc.dll`
- `hostfxr.dll`, `hostpolicy.dll`
- `Presentation*` (prefix `Presentation`, plus exact WPF natives)
- `System.` / `Microsoft.`
- `Accessibility`, `PenImc`, `DirectWrite`, `WindowsBase`, `WindowsForms`, `UIAutomation`, `ReachFramework`, `wpfgfx`, `D3DCompiler`, `mscor*`, `netstandard`, `msquic`, `vcruntime`, `msvcp`
- `runtimes\` (`ownedExactDirs`)
- `.resources.dll` satellites and runtime language folders’ resource DLLs (not wholesale-delete of a user file named `notes.txt` inside `cs\`)
- installer HTML (`Sirman_Final.html`, `Sirman_Final_*`, `Laegh_Final.html`, `Laegh_Final_*`)
- launcher BAT/PS1 listed in `ownedExactFiles`
- installer-owned update JSON / `SIRMAN_VERSION.json`
- shipped guides `راهنمای_نصب_از_صفر.txt`, `راهنمای_نصب_و_آپدیت.docx`

Not owned merely because they live under the install directory:

- `user-notes.txt`
- user-created backup JSON
- arbitrary user JSON / media
- user-created subfolders
- `sirman_media\`
- WebView2 / AppData backup (never in the install-dir owned pass)

If user files remain: they are left, counted, listed by **path only** (no contents), and the parent directory stays.

---

## Deletion

### Runtime deletion

Level 1 still does **not** `rd /s /q` the install directory.

`Remove-SirmanInstallerOwnedInDir` deletes owned files with `Remove-SirmanPathWithRetry` (`ErrorAction Stop`). Empty owned dirs (`runtimes\`, empty language dirs, empty dest) are removed only when empty.

### User-file preservation

Preserve dir `sirman_media` unchanged. Unknown names are not installer-owned. Remaining files are `Preserved user files`.

Failed owned paths are **not** counted as preserved.

### Process shutdown

Before deletion:

1. `Set-Location` to `%TEMP%` so the uninstall script is not locking files by cwd in the install dir
2. `Stop-SirmanKnownProcesses`:
   - stop process name `Sirman`
   - stop identifiable child `powershell`/`pwsh` whose command line contains `Sirman-Server-` or `sirman_run.ps1`
   - stop window title `Sirman-Server-*` if present
   - wait up to `processStop.waitExitSeconds` (8) for `Sirman` exit
3. do **not** kill unrelated Windows processes (`msedgewebview2` wholesale, random `powershell`, etc.)

If Sirman is still running after the wait, Level 1 prints a warning; locked files then follow the retry/report path instead of silent skip.

### Error reporting

Locked/ACL failures are retried `level1RemovalRetries` times (5) with `level1RetryDelayMs` (400).

Each failure records:

- path
- error
- retry count

End of Level 1:

```text
Removed:
N

Could not remove:
N
  path | error | retries=K

Preserved user files:
N
  relative-path
```

No file contents are printed.

### Start Menu / Desktop

Unchanged canonical names:

- `%APPDATA%\Microsoft\Windows\Start Menu\Programs\Sirman`
- `SIRMAN.lnk`
- `Uninstall SIRMAN.lnk`
- `SIRMAN Full Cleanup.lnk`

Legacy exact Persian Sirman links still removed. Unrelated shortcuts untouched.

### Install record

`%LOCALAPPDATA%\Sirman\install-location.txt` is removed only if it points at **this** uninstall target. A second installation is not silently deleted.

### Full Cleanup

Level 2 remains a separate engine (`Sirman-Full-Cleanup.bat` → `-Mode Level2`), categorized, typed confirmation `تایید`, business-data destructive, not part of normal uninstall. Level 1 bat still cannot invoke Level 2.

---

## Tests

Linux / throwaway temp dirs only. No uninstall against shop disk or real AppData.

| Suite | Result |
|---|---|
| `node test_laegh.js Sirman_Final.html` | **672 / 672** pass |
| `node test_laegh.js Laegh_Final.html` | **672 / 672** pass |
| `dotnet test desktop/Sirman.Core.Tests -c Release` | **242 / 242** pass |
| `node test_installer_lifecycle.js` | **21 / 21** pass |

Installer lifecycle coverage added (not weakened):

| # | Case | Result |
|---|---|---|
| 1 | `coreclr.dll` removed (fallback) | PASS |
| 2 | `hostfxr.dll` removed | PASS |
| 3 | `PresentationFramework*.dll` removed | PASS |
| 4 | `System*.dll` removed (`System.Private.CoreLib.dll`) | PASS |
| 5 | `Microsoft*.dll` removed (`Microsoft.CSharp.dll`) | PASS |
| 6 | `runtimes\` removed | PASS |
| 7 | installer-owned HTML removed | PASS |
| 8 | installer-owned BAT/PS1 removed | PASS |
| 9 | `user-notes.txt` remains | PASS |
| 10 | user-created backup JSON remains | PASS |
| 11 | user-created subfolder remains | PASS |
| 12 | WebView2 remains (Level 1) | PASS (existing + kept) |
| 13 | AppData backup remains (Level 1) | PASS (existing + kept) |
| 14 | Level 2 still requires `تایید` | PASS |
| 15 | failed file removal reported, not swallowed | PASS |
| 16 | second installation not silently deleted | PASS |

Corrupt-manifest path uses fallback; unknown `mystery-user.dat` is not treated as installer-owned.

Core tests now assert runtime names in the contract and retry/report helpers in the lifecycle engine.

---

## Unchanged

| Area | Status |
|---|---|
| Print | **NO CHANGE** |
| Storage | **NO CHANGE** |
| Backup | **NO CHANGE** |
| Version | **NO CHANGE** (`1405.6.3α`) |
| Full Cleanup model | **NO CHANGE** |

---

## Files changed (this packet)

- `scripts/setup-kit/sirman-install-contract.json`
- `scripts/setup-kit/Sirman-InstallLifecycle.ps1`
- `desktop/Sirman.Desktop/InstallService.cs` (prune ownership stay-in-sync only)
- `test_installer_lifecycle.js`
- `desktop/Sirman.Core.Tests/InstallLifecycleContractTests.cs`
- this report

Packer dirt under `deliveries/Sirman_Setup_1405.6.3α/` and `services.candidate.sqlite` were **not** committed.

---

## FINAL

P0 INSTALLER RUNTIME OWNERSHIP FIX IMPLEMENTED  
NEEDS WINDOWS DISPOSABLE-PROFILE VERIFICATION

STOP — WAIT FOR REVIEW.
