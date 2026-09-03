# P0 CONFIRM BUILD / PACKAGE REPORT
**Date:** 2026-09-03  
**Packet:** BUILD/PACKAGE ONLY from reviewed HEAD `3b27299`  
**No source edits. No shop test.**

```text
Source changed during packaging: NO
Product behavior changed:        NO
Print changed:                   NO
Storage changed:                 NO
Backup changed:                  NO
Uninstall logic changed:         NO
Cleanup categories/paths:        NO
Start Menu names:                NO
Version changed:                 NO
level2ConfirmationWord:          CONFIRM (unchanged from 3b27299)
```

---

## Git

```text
Packaging branch:    cursor/p0-confirm-build-fa01
Created from:        3b27299
HEAD at pack:        3b2729982fc3d207e94b9159eb82162f52ad23a1
Short HEAD:          3b27299
HEAD == 3b27299:     YES
No reset/rebase/merge/cherry-pick
Packer:              python3 scripts/pack_sirman_setup.py  (unchanged)
```

Working tree at pack (expected dirt only; not committed):

```text
 M deliveries/migration/P1-services/services.candidate.sqlite
 M deliveries/migration/P1-services/services.sha256
?? deliveries/Sirman_Setup_1405.6.3α/ leftover packer extras (not the shop ZIP)
```

Product source files were hash-checked before pack and after restoring the generic kit: **identical**.

---

## Version (unchanged)

```text
Product / InformationalVersion: 1405.6.3α
Assembly / FileVersion:         1405.6.3.1
SIRMAN_VERSION.json:            unchanged
Directory.Build.props:          unchanged
```

PE ProductVersion (SDK SourceRevisionId, not a bump):

```text
1405.6.3α+3b2729982fc3d207e94b9159eb82162f52ad23a1
```

Wrong-build stop: if shop ProductVersion does not contain `3b2729982fc3d207e94b9159eb82162f52ad23a1`, STOP — wrong executable.

---

## Confirmation token in this package

```text
canonical.level2ConfirmationWord = "CONFIRM"
App/Sirman-Full-Cleanup.bat prompt: typing: CONFIRM
Persian تایید is not the Level 2 token in this ZIP.
```

---

## Tests (before pack)

```text
node test_laegh.js Sirman_Final.html     672 passed / 0 failed
node test_laegh.js Laegh_Final.html      672 passed / 0 failed
dotnet test desktop/Sirman.Core.Tests -c Release
                                         242 passed / 0 failed
node test_installer_lifecycle.js         21 passed / 0 failed
```

---

## Build

```text
Command:                python3 scripts/pack_sirman_setup.py
dotnet publish:         desktop/Sirman.Desktop -c Release -r win-x64 --self-contained true
EnableWindowsTargeting: true
Result:                 OK
Sirman.exe:             152064 bytes
```

---

## Package

```text
Filename:  Sirman_Setup_1405.6.3α_P0_CONFIRM_2026-09-03.zip
Path:      deliveries/Sirman_Setup_1405.6.3α_P0_CONFIRM_2026-09-03.zip
Size:      72525362 bytes
SHA-256:   e2f6185be12782274b0bf13e61654fe9f8a39ce71969c5ca719d4537f5f4b141
Sidecar:   deliveries/Sirman_Setup_1405.6.3α_P0_CONFIRM_2026-09-03.sha256
Files:     495
sqlite/.git/pycache/secrets: none
```

Present in ZIP:

| Path | Present |
|---|---|
| `Sirman_Setup_1405.6.3α/App/Sirman.exe` | YES |
| `Sirman_Setup_1405.6.3α/App/sirman-install-contract.json` | YES (`CONFIRM`) |
| `Sirman_Setup_1405.6.3α/App/Sirman-InstallLifecycle.ps1` | YES |
| `Sirman_Setup_1405.6.3α/App/Uninstall-Sirman.ps1` | YES |
| `Sirman_Setup_1405.6.3α/App/Uninstall-Sirman.bat` | YES |
| `Sirman_Setup_1405.6.3α/App/Sirman-Full-Cleanup.bat` | YES (`CONFIRM`) |
| `Sirman_Setup_1405.6.3α/نصب.bat` | YES |
| `Sirman_Setup_1405.6.3α/SETUP.bat` | YES |
| `Sirman_Setup_1405.6.3α/install-setup.ps1` | YES |

Binary hashes in this ZIP:

| File | Size | SHA-256 |
|---|---|---|
| `Sirman.exe` | 152064 | `546385b32de53d14dd6d1169e53c20b6aca56216f10ed38bb5b5c65574aeea5b` |
| `Sirman.dll` | 208896 | `ba5a5b48a876851f4ded65b214ea7b4fcb51098f5e9797c94d3ca4f4152ed2e6` |
| `Sirman.Core.dll` | 217600 | `5055ec0d219ee92152e67f1d5d38629249a132d2794bd9e42e02b484ed5f9c4e` |

Generic packer outputs (`deliveries/Sirman_Setup_1405.6.3α/` tracked tree and root zip) were restored to HEAD so they are **not** the shop artifact.

---

## FINAL

```text
HEAD packed:     3b27299
ProductVersion:  1405.6.3α
Assembly:        1405.6.3.1
Token:           CONFIRM
Source changed:  NO
Behavior changed: NO
Shop testing:    NOT PERFORMED
```

**STOP — WAIT FOR REVIEW.**
