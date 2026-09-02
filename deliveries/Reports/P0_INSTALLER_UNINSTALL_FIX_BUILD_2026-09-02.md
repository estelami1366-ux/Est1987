# P0 INSTALLER UNINSTALL FIX BUILD
**Date:** 2026-09-02  
**Packet:** PACKAGING ONLY — Windows self-contained win-x64 shop ZIP for P0c/P0d Level 1 runtime-ownership uninstall  
**THIS IS BUILD/PACKAGING ONLY.**

```text
Source changed during packaging: NO
Print changed:                   NO
Storage changed:                 NO
Backup/Restore changed:          NO
H1/H3/H4 changed:                NO
Version changed:                 NO
```

This agent is Linux. Shop Windows disk was not used. No uninstall was run against live data.

---

## Git

```text
Branch:              cursor/p0-uninstall-fix-build-fa01
Created from:        cursor/p0-runtime-ownership-uninstall-fa01 @ 8173949
HEAD at build:       81739495a85727100513dd511278465703a33536
Short HEAD:          8173949
Implementation:      eb6a387  fix: Level 1 uninstall owns self-contained .NET runtime files
eb6a387 ancestor:    YES
No reset/rebase/merge/cherry-pick
Packer:              python3 scripts/pack_sirman_setup.py  (unchanged)
Worktree dirt left:  generic packer extras under deliveries/Sirman_Setup_1405.6.3α/
                     and P1 candidate sqlite (not committed)
```

---

## Version (unchanged)

```text
Product:                 1405.6.3α
Assembly / FileVersion:  1405.6.3.1
SIRMAN_VERSION.json:     unchanged
Directory.Build.props:   unchanged
Version bumped:          NO
```

This build’s PE `InformationalVersion` / ProductVersion (SDK `SourceRevisionId`, not a bump):

```text
1405.6.3α+81739495a85727100513dd511278465703a33536
```

Wrong-build stop: if shop ProductVersion does not contain `81739495a85727100513dd511278465703a33536`, STOP — wrong executable.

---

## Tests (recorded this run, before pack)

```text
node test_laegh.js Sirman_Final.html          672 passed / 0 failed
node test_laegh.js Laegh_Final.html           672 passed / 0 failed
dotnet test desktop/Sirman.Core.Tests -c Release
                                              242 passed / 0 failed
node test_installer_lifecycle.js              21 passed / 0 failed
```

Existing tests not weakened.

---

## Build

Official packer: `python3 scripts/pack_sirman_setup.py`  
Then copied to the dated shop-test name (generic packer zip is not the shop artifact).

```text
TargetFramework:        net8.0-windows
RID:                    win-x64
Configuration:          Release
Self-contained:         true
EnableWindowsTargeting: true
Version:                1405.6.3α / 1405.6.3.1   (not bumped)
```

```text
deliveries/Sirman_Setup_1405.6.3α_P0_UNINSTALL_FIX_2026-09-02.zip
Size:      72525441 bytes
SHA-256:   d05f3b1396819f161034d48d373197c4039542ad81f5521dffd2f6eaf06ee86b
Sidecar:   deliveries/Sirman_Setup_1405.6.3α_P0_UNINSTALL_FIX_2026-09-02.sha256
```

Install on a **disposable Windows profile**: Extract All → `نصب.bat` / `SETUP.bat`. Do not run uninstall against live shop data.

Zip contents checked: **495 files**. No sqlite, no `services.candidate.sqlite`, no `.git`, no `__pycache__`, no secrets.

---

## P0c/P0d files inside the ZIP (verified)

| Path in zip | Present |
|---|---|
| `Sirman_Setup_1405.6.3α/sirman-install-contract.json` | YES |
| `Sirman_Setup_1405.6.3α/App/sirman-install-contract.json` | YES |
| `Sirman_Setup_1405.6.3α/Sirman-InstallLifecycle.ps1` | YES |
| `Sirman_Setup_1405.6.3α/App/Sirman-InstallLifecycle.ps1` | YES |
| `Sirman_Setup_1405.6.3α/App/Uninstall-Sirman.ps1` | YES |
| `Sirman_Setup_1405.6.3α/App/Uninstall-Sirman.bat` | YES |
| `Sirman_Setup_1405.6.3α/App/Sirman-Full-Cleanup.bat` | YES |
| `Sirman_Setup_1405.6.3α/App/coreclr.dll` | YES |
| `Sirman_Setup_1405.6.3α/App/hostfxr.dll` | YES |
| `Sirman_Setup_1405.6.3α/App/PresentationFramework.dll` | YES |
| `Sirman_Setup_1405.6.3α/App/PresentationCore.dll` | YES |

Logic strings verified in those files:

```text
runtime fallback:       coreclr.dll, hostfxr.dll, Presentation* in contract
                        no uncontrolled *.dll delete rule
manifest:               Read-SirmanSourcePackageManifest
retry/report:           Remove-SirmanPathWithRetry
                        Could not remove:
                        Preserved user files:
                        ErrorAction Stop (not SilentlyContinue on owned-file delete)
process stop:           Stop-SirmanKnownProcesses
Level 1:                Uninstall-Sirman.bat → -Mode Level1
                        no rd /s /q
Level 2:                Sirman-Full-Cleanup.bat → -Mode Level2
canonical Start Menu:   Programs\Sirman
                        SIRMAN.lnk
                        Uninstall SIRMAN.lnk
                        SIRMAN Full Cleanup.lnk
```

---

## Binary hashes (this build)

| File | Size | SHA-256 |
|---|---|---|
| `Sirman.exe` | 152064 | `f4469cd10f1813776c54cbdd713740b1273e5cddd6bfc24e1e4aaa62288e5190` |
| `Sirman.dll` | 208896 | `473baf4f631cf7d3f7bb7f158ee60d3c06493b4d22655c5e06e8dcf0bd3ef2ff` |
| `Sirman.Core.dll` | 217600 | `961fbf32f21e37cae89a4c3045de1e4b709755ab4272b5de1fb0185097440523` |
| `coreclr.dll` | 4995880 | `fc2909e16b3f70edfeac96d69d3f1d444705b1e4ad922dc760bb396338a7b1de` |
| `hostfxr.dll` | 366376 | `751ccef66f160ca66ca9ac5bde2e781c360d9706f9aaba0a6f180557f80798c2` |

---

## Shop tests (Windows required)

Not executed on this Linux agent.

On a disposable Windows user/profile:

1. Extract zip → `نصب.bat`
2. Confirm Start Menu `Programs\Sirman` has `SIRMAN.lnk`, `Uninstall SIRMAN.lnk`, `SIRMAN Full Cleanup.lnk`
3. Level 1 uninstall: `coreclr.dll` / `hostfxr.dll` / `PresentationFramework*.dll` / `runtimes\` gone with the program copy
4. User notes / user backup JSON / user subfolder remain if present in the install directory
5. `%LOCALAPPDATA%\Sirman\WebView2` and `%APPDATA%\Sirman\backup` remain
6. Failed locked-file removal is reported (Removed / Could not remove / Preserved user files)
7. Full Cleanup still requires typed `تایید`

---

## FINAL

```text
Product version: 1405.6.3α
Assembly:        1405.6.3.1
Implementation:  eb6a387
HEAD at build:   8173949
Source changed during packaging: NO
Print changed: NO
Storage changed: NO
Backup changed: NO
Version changed: NO
READY FOR WINDOWS DISPOSABLE-PROFILE TEST
Physical/shop verification: NOT VERIFIED
```

**STOP — WAIT FOR REVIEW.**
