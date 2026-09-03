# P0 FULL CLEANUP CONFIRMATION LANGUAGE
**Date:** 2026-09-03  
**Packet:** SMALL PATCH ONLY — Level 2 typed confirmation token  
**No build / no package.**

```text
Product code changed: YES — Full Cleanup confirmation text/test only
Print changed:        NO
Storage changed:      NO
Backup changed:       NO
Version changed:      NO
Installer behavior changed: ONLY confirmation token
Build/package:        NO
Level 1 uninstall:    NO CHANGE
Cleanup categories:   NO CHANGE
Deleted paths:        NO CHANGE
Start Menu names:     NO CHANGE
```

---

## Git

```text
Branch:         cursor/p0-full-cleanup-confirm-en-fa01
Created from:   cursor/p0-uninstall-fix-build-fa01 @ 0e83464
HEAD before:    0e83464
No reset/rebase/merge/cherry-pick
```

HEAD after: `3b27299`

---

## Comparison rule (inspected before the change)

Level 2 already used **exact** comparison. No case folding.

PowerShell `Test-SirmanLevel2Confirmation`:

```text
[string]::Equals(($Typed + '').Trim(), $Contract.canonical.level2ConfirmationWord, [StringComparison]::Ordinal)
```

Node test helper:

```text
String(typed || '').trim() === contract.canonical.level2ConfirmationWord
```

| Input | Before | After |
|---|---|---|
| `تایید` | accept | **abort** |
| `CONFIRM` | abort | **accept** |
| `confirm` | abort | abort |
| `Confirm` | abort | abort |
| `yes` | abort | abort |
| empty | abort | abort |

Whitespace: leading/trailing spaces are still `.Trim()`’d. That is **not** case normalization. ` CONFIRM ` still matches; `confirm` does not.

In-app HTML `resetAll` still uses Persian `تایید` / `تأیید`. That is a different prompt and was **not** changed.

---

## What changed

Token: `تایید` → exact English `CONFIRM`

- `scripts/setup-kit/sirman-install-contract.json` — `level2ConfirmationWord`
- `desktop/Sirman-Full-Cleanup.bat` — prompt line
- `desktop/Sirman.Desktop/InstallService.cs` — generated bat + shortcut description
- `scripts/setup-kit/install-setup.ps1`, `Sirman_Install_Shortcuts.ps1`, `desktop/install-package.ps1` — shortcut description text only
- `desktop/Sirman.Desktop/MainForm.cs` — Full Cleanup operator wording
- `Sirman_Final.html` / `Laegh_Final.html` — Level 2 help text only (not `resetAll`)

Unchanged: Level 1 engine, owned-file list, Level 2 path categories, Print, Storage, Backup, version `1405.6.3α` / `1405.6.3.1`.

---

## Tests

```text
node test_laegh.js Sirman_Final.html     672 passed / 0 failed
node test_laegh.js Laegh_Final.html      672 passed / 0 failed
dotnet test desktop/Sirman.Core.Tests -c Release
                                         242 passed / 0 failed
node test_installer_lifecycle.js         21 passed / 0 failed
```

| # | Case | Result |
|---|---|---|
| 1 | exact `CONFIRM` succeeds | PASS |
| 2 | `confirm` fails | PASS |
| 3 | `Confirm` fails | PASS |
| 4 | `yes` fails | PASS |
| 5 | `تایید` fails | PASS |
| 6 | empty fails | PASS |
| 7 | failed confirmation deletes nothing | PASS |

---

## FINAL

```text
Product code changed: YES — Full Cleanup confirmation text/test only
Print changed: NO
Storage changed: NO
Backup changed: NO
Version changed: NO
Installer behavior changed: ONLY confirmation token
Build/package: NO
```

**STOP — WAIT FOR REVIEW.**
