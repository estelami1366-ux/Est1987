# P0 INSTALL / UNINSTALL HARDENING REPORT
**Date:** 2026-09-01  
**Packet:** P0a/P0b installer + uninstaller hardening only  
**Authority:** `deliveries/Reports/INSTALLER_UNINSTALLER_VERSION_ICON_MASTER_AUDIT_2026-09-01.md`

---

## Git

| Item | Value |
|---|---|
| Branch | `cursor/p0-install-uninstall-hardening-fa01` |
| Parent HEAD | `64590e2` (`docs: installer/uninstaller/version/icon master audit`) |
| Implementation HEAD | `24c9133` (`fix: unify Sirman Start Menu shortcuts and safe Level 1 uninstall`) |
| Worktree | `/workspace` |
| Base | current HEAD at packet start (no reset / rebase / merge / cherry-pick) |

Unrelated dirty files **not** in this commit:

- `deliveries/migration/P1-services/services.candidate.sqlite`
- `deliveries/migration/P1-services/services.sha256`

---

## Installer

**Canonical mechanism (unchanged technology):**

`نصب.bat` / `SETUP.bat` → `scripts/setup-kit/install-setup.ps1`

No MSI / Inno / NSIS / WiX / parallel installer.

**Shared engine (not a second installer):**

- `scripts/setup-kit/sirman-install-contract.json`
- `scripts/setup-kit/Sirman-InstallLifecycle.ps1`
- `desktop/Uninstall-Sirman.ps1` (`-Mode Level1|Level2`)
- `desktop/Uninstall-Sirman.bat` (Level 1 launcher only)
- `desktop/Sirman-Full-Cleanup.bat` (Level 2 launcher only)

Packer copies the engine to **kit root** and `App\` so both setup and later uninstall can find it.

**Canonical install destination behavior:**

User picks a folder (default `Documents\Sirman`). Drive root is forced to `\Sirman`. Files copy from `App\`. After copy:

1. Manifest is written from the **source** file list (`sirman-install-manifest.json`).
2. Stale **installer-owned** files in dest are pruned against that source list.
3. One install record is written: `%LOCALAPPDATA%\Sirman\install-location.txt`.
4. Legacy `install_path.txt` is overwritten with the **same** path (compatibility copy only).

Active shortcut creators now share the same names:

- `scripts/setup-kit/install-setup.ps1`
- `desktop/Sirman.Desktop/InstallService.cs`
- `Sirman_Install_Shortcuts.ps1`
- `نصب_میانبر_سیرمان.bat` (unchanged menu; calls the updated PS1)
- `desktop/install-package.ps1`

---

## Start Menu

**Canonical folder:**

`%APPDATA%\Microsoft\Windows\Start Menu\Programs\Sirman`

**Entries after fresh install:**

| File | Role |
|---|---|
| `SIRMAN.lnk` | Launch |
| `Uninstall SIRMAN.lnk` | Level 1 |
| `SIRMAN Full Cleanup.lnk` | Level 2 (optional shipped; created when the bat exists) |

Persian is **Description** metadata only. Folder `Programs\سیرمان` is **not** created.

**Legacy cleanup (exact Sirman names only):**

- Folder `Programs\سیرمان` and its known links (`سیرمان.lnk`, `حذف سیرمان.lnk`)
- `سیرمان.lnk` on Desktop / OneDrive Desktop
- Old English uninstall name `Uninstall Sirman.lnk` when it is a different file from the canonical name (NTFS treats `SIRMAN.lnk` / `Sirman.lnk` as the same file)

After Level 1 uninstall, canonical Start Menu entries are removed. If the folder is empty, it is removed.

---

## Desktop

**Canonical:** `Sirman.lnk` (via `DesktopDirectory`)

Level 1 also deletes exact leftover `سیرمان.lnk` on Desktop and `%USERPROFILE%\OneDrive\Desktop`. Unrelated desktop files are not deleted.

---

## Uninstall Level 1

**Target rule:** the directory of the running uninstall artifact (`Uninstall-Sirman.ps1` / `.bat`).  
`install-location.txt` is **never** used to retarget deletion.

If the recorded path differs, it is printed as **another detected installation** and left untouched. Removing that copy requires running uninstall from **that** folder.

**Removed (installer-owned program state only):**

- Installer-owned files in **this** install directory (manifest + owned-name list)
- Canonical Start Menu links + legacy Sirman links listed above
- Canonical / legacy desktop Sirman links
- `install-location.txt` and `install_path.txt` **only if they point at this same directory**

**Preserved:**

- `%LOCALAPPDATA%\Sirman\WebView2\` (live business localStorage)
- `%APPDATA%\Sirman\backup\`
- user-selected `BackupFolder` from `desktop-settings.json`
- `sirman_media` (any path component)
- prefs (`prefs.json`), secrets, diagnostic history
- candidate SQLite
- print WebView caches (`WebView2-print`, `WebView2-print-diag`) — not proven safe for Level 1
- arbitrary user files inside the install folder (`user-notes.txt`, extra backups, etc.)
- a **different** installation directory

**Forbidden:**

- `rd /s /q %LOCALAPPDATA%\Sirman`
- `rd /s /q %APPDATA%\Sirman`
- silent `INSTALL_DIR` redirect from the location file
- one-click wipe of business data

If user files remain in the install folder after owned-file removal, the folder is kept.

---

## Full Cleanup Level 2

Distinct action: `SIRMAN Full Cleanup` / `Sirman-Full-Cleanup.bat` / `Uninstall-Sirman.ps1 -Mode Level2`.

Normal uninstall **does not** run these deletions.

**Confirmation:** type exact word `تایید`. Any other input (including empty / `yes`) **aborts with no deletion**.

**Categories (exact path families):**

| Id | Category | Paths |
|---|---|---|
| A | WebView2 business data | `%LOCALAPPDATA%\Sirman\WebView2` |
| B | backup data | `%APPDATA%\Sirman\backup`, `%LOCALAPPDATA%\Sirman\Backups`, user `BackupFolder` (read **before** deleting settings) |
| C | media | `sirman_media` under those backup roots |
| D | prefs/config | `%APPDATA%\Sirman\prefs.json`, `%LOCALAPPDATA%\Sirman\desktop-settings.json`, `%APPDATA%\Sirman\secrets` |
| E | diagnostic history | `%LOCALAPPDATA%\Sirman\diagnostics\history.jsonl` |
| F | candidate SQLite | `%APPDATA%\Sirman\data\sirman.sqlite` |
| G | update state/cache | `%LOCALAPPDATA%\Sirman\WebView2-print`, `%LOCALAPPDATA%\Sirman\WebView2-print-diag` |

Level 1 uninstall **removes** the Full Cleanup shortcut; **executing** Full Cleanup still requires typed confirmation.

---

## Install record

**One canonical file:** `%LOCALAPPDATA%\Sirman\install-location.txt`

Legacy `install_path.txt`: written as an explicit same-path copy on install; read only if the canonical file is missing; **never** used as the Level 1 delete target.

---

## Upgrade cleanup (stale installer-owned files)

Not unbounded recursive delete.

**How ownership is decided:**

1. `sirman-install-manifest.json` is written from the **source** copy list (never by listing dest, so user files cannot become “owned”).
2. Known owned exact names / prefixes from the contract (`Sirman.exe`, `Sirman_Final.html`, `Sirman_Final_*`, `createdump.exe`, `*.pdb`, `System.*` / `Microsoft.*` publish DLLs, uninstall scripts, `runtimes\`, `updates\Sirman_Update_*`, …).
3. `sirman_media` is never pruned.
4. Files not owned and not in the new source list stay.

After `Copy-Item -Recurse -Force`, stale owned files that are **not** in the new source (old versioned HTML, tiny pending JSON, createdump, leftover runtime) are removed.

---

## Tests

Added:

- `test_installer_lifecycle.js` (throwaway temp dirs only; hooked from `test_laegh.js`)
- `desktop/Sirman.Core.Tests/InstallLifecycleContractTests.cs`

Covered:

1. Canonical Start Menu folder `Sirman`
2. Canonical launch `SIRMAN.lnk`
3. Canonical uninstall `Uninstall SIRMAN.lnk`
4. Level 1 removes English/Persian legacy link names in source + simulation
5. Level 1 preserves WebView2
6. Level 1 preserves AppData backup
7. Level 1 does not delete user-selected backup
8. Full Cleanup requires typed `تایید`
9. Failed confirmation deletes nothing
10. Uninstall cannot silently target a different installation
11. Stale installer-owned files are pruned
12. Arbitrary user files are preserved

Commands:

```
node test_laegh.js Sirman_Final.html
node test_laegh.js Laegh_Final.html
dotnet test desktop/Sirman.Core.Tests -c Release
```

Existing tests were not weakened. Version asserts stay on `1405.6.3α`.

**Destructive shop-data tests were not run.** Linux agent + protocol: disposable-profile Windows verification is still required.

---

## Safety

- Business data preserved on Level 1
- No wholesale `%LOCALAPPDATA%\Sirman` deletion
- No wholesale `%APPDATA%\Sirman` deletion
- No silent retarget of another install directory
- Level 2 is explicit, listed, and confirmation-gated

---

## Unchanged (this packet)

| Area | Status |
|---|---|
| Version | **UNCHANGED** (`1405.6.3α` / assembly `1405.6.3.1`) |
| Print | **UNCHANGED** |
| Storage | **UNCHANGED** |
| Backup engine | **UNCHANGED** |
| Icon | **UNCHANGED** |
| Apps & Features / MSI | **not implemented** (out of scope) |

---

## FINAL

**P0 INSTALLER/UNINSTALLER HARDENING IMPLEMENTED**

**NEEDS WINDOWS DISPOSABLE-PROFILE VERIFICATION**

**STOP — WAIT FOR REVIEW.**
