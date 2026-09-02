# P0 INSTALLER TEST BUILD REPORT
**Date:** 2026-09-01  
**Packet:** Windows shop test ZIP for already-implemented P0 installer/uninstaller hardening  
**THIS IS BUILD/PACKAGING ONLY.**

```text
Source changed during packaging: NO
Print changed:                   NO
Postal renderer changed:         NO
Storage changed:                 NO
Backup/Restore changed:          NO
H1/H3/H4 changed:                NO
Icon changed:                    NO
Version changed:                 NO
```

---

## Git

```text
Branch:            cursor/p0-install-uninstall-hardening-fa01
HEAD at build:     774e0d352a5b3973cc3ac2f089f1e26f136393a5
Short HEAD:        774e0d3
Packaging commit:  a5fe3cc  pack: P0 installer/uninstaller Windows test ZIP from HEAD 774e0d3
P0 product commit: 24c9133  fix: unify Sirman Start Menu shortcuts and safe Level 1 uninstall
P0 ancestor of HEAD: YES
Worktree dirt left: generic packer kit/zip (deliveries/Sirman_Setup_1405.6.3α/ and root zip);
                    P1 candidate sqlite (not committed)
No merge/rebase/reset/cherry-pick
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

This build’s PE `ProductVersion` (SDK `SourceRevisionId`, not a bump):

```text
1405.6.3α+774e0d352a5b3973cc3ac2f089f1e26f136393a5
```

Wrong-build stop: if shop ProductVersion does not contain `774e0d352a5b3973cc3ac2f089f1e26f136393a5`, STOP — wrong executable.

---

## Tests (recorded this run, before pack)

```text
node test_laegh.js Sirman_Final.html     666 passed / 0 failed
node test_laegh.js Laegh_Final.html      666 passed / 0 failed
dotnet test desktop/Sirman.Core.Tests -c Release
                                         240 passed / 0 failed
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
deliveries/Sirman_Setup_1405.6.3α_P0_INSTALLER_2026-09-01.zip
Size:      72520321 bytes
SHA-256:   809bda51211dae281f5d5d02757b2f9501255b97a08b0e0c02572ff1c01ffc17
Sidecar:   deliveries/Sirman_Setup_1405.6.3α_P0_INSTALLER_2026-09-01.sha256
```

Install on a **disposable Windows profile**: Extract All → `نصب.bat` / `SETUP.bat`. Do not run uninstall against live shop data.

Zip contents checked: 495 files. No sqlite, no `services.candidate.sqlite`, no `.git`, no `__pycache__`, no secrets.

---

## P0 files inside the ZIP (verified)

| Path in zip | Present |
|---|---|
| `Sirman_Setup_1405.6.3α/sirman-install-contract.json` | YES |
| `Sirman_Setup_1405.6.3α/App/sirman-install-contract.json` | YES |
| `Sirman_Setup_1405.6.3α/Sirman-InstallLifecycle.ps1` | YES |
| `Sirman_Setup_1405.6.3α/App/Sirman-InstallLifecycle.ps1` | YES |
| `Sirman_Setup_1405.6.3α/App/Uninstall-Sirman.ps1` | YES |
| `Sirman_Setup_1405.6.3α/App/Uninstall-Sirman.bat` | YES |
| `Sirman_Setup_1405.6.3α/App/Sirman-Full-Cleanup.bat` | YES |
| `Sirman_Setup_1405.6.3α/install-setup.ps1` | YES |
| `Sirman_Setup_1405.6.3α/نصب.bat` | YES |
| `Sirman_Setup_1405.6.3α/SETUP.bat` | YES |

Logic strings verified in those files:

```text
unified Start Menu:     Programs\Sirman + SIRMAN.lnk + Uninstall SIRMAN.lnk
Persian folder create:  ABSENT in install-setup.ps1
Level 1:                Uninstall-Sirman.bat → -Mode Level1
                        no INSTALL_DIR=%SAVED% redirect
                        no rd /s /q %LOCALAPPDATA%\Sirman
Level 2:                Sirman-Full-Cleanup.bat → -Mode Level2
                        confirmation word تایید in contract/lifecycle
Sirman.dll:             CanonicalStartMenuFolderName + SIRMAN.lnk + Full Cleanup
```

---

## Binary hashes (this build)

| File | Size | SHA-256 |
|---|---|---|
| `Sirman.exe` | 152064 | `b0c5f2142ebaea25c3b460628bf90592b7674caae913f2ef25dc4f7ad8d8620c` |
| `Sirman.dll` | 206848 | `9f1d10d4af6c0cdfdfccb06ea57da78969eac22f3ce132f84c2ff1eaf6f86ef1` |
| `Sirman.Core.dll` | 217600 | `072198c0f31575bedd4c94a020514f7f4f96d762e4fccf2ad277c394b36bf612` |

---

## Shop tests (Windows required)

Not executed on this Linux agent.

On a disposable Windows user/profile:

1. Extract zip → `نصب.bat`
2. Confirm Start Menu `Programs\Sirman` has `SIRMAN.lnk` and `Uninstall SIRMAN.lnk`
3. Level 1 uninstall: program/shortcuts gone; `%LOCALAPPDATA%\Sirman\WebView2` and `%APPDATA%\Sirman\backup` remain
4. Full Cleanup: abort without `تایید` deletes nothing; typing `تایید` is Level 2 only

---

## FINAL

```text
Product version: 1405.6.3α
Assembly:        1405.6.3.1
P0 commit:       24c9133
HEAD at build:   774e0d3
Source changed during packaging: NO
Print changed: NO
Storage changed: NO
Backup changed: NO
Version changed: NO
Icon changed: NO
READY FOR WINDOWS INSTALLER TEST
```

**STOP — WAIT FOR REVIEW.**
