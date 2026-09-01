# SIRMAN — INSTALLER / UNINSTALLER / VERSION / ICON MASTER AUDIT
## 2026-09-01 — READ-ONLY; no implementation

**Mode:** AUDIT ONLY. Do not uninstall, delete, patch, bump version, build, or create icon assets.  
**Git inspected:**

```text
branch: cursor/h1-h3-h4-final-review-fa01  (parent of this docs branch)
HEAD:   47201c7
status: M deliveries/migration/P1-services/services.candidate.sqlite
        M deliveries/migration/P1-services/services.sha256
        (unrelated candidate SQLite — not part of this audit; not committed)
```

**Live product (unchanged):** `1405.6.3α` / assembly `1405.6.3.1`  
**Calendar today:** Gregorian `2026-09-01` = Jalali **`1405/06/10`**  
**Product date in source:** `1405/06/03` (Gregorian 2026-08-25)

```text
Product source changed: NO
Installer changed:      NO
Uninstaller changed:    NO
Print changed:          NO
Storage changed:        NO
Backup/Restore changed: NO
Version changed:        NO
Icon assets changed:    NO
Build/package:          NO
```

This audit used **source of the live kit path**, not a shop Windows uninstall run. Linux cannot execute Start Menu / registry / WebView2 user-data deletion.

---

## 1. Current Installer Technology

**Not** Inno Setup, NSIS, MSI, or WiX. **No** `Uninstall` registry key. Search of `*.cs` / `*.ps1` / `*.bat` found **zero** `HKCU`/`HKLM` uninstall entries.

Shop-facing installer is a **self-contained zip kit** unpacked by the user, then a **BAT → PowerShell 5.1 copy + shortcut** script.

| Layer | Path | Role |
|---|---|---|
| Packer | `scripts/pack_sirman_setup.py` | Publishes `Sirman.exe` (win-x64 self-contained), copies HTML + launchers + uninstall bat into `deliveries/Sirman_Setup_{app}/` |
| Kit templates | `scripts/setup-kit/نصب.bat`, `SETUP.bat`, `install-setup.ps1` | Copied to the zip **root**. This is the one-click shop installer. |
| Live kit | `deliveries/Sirman_Setup_1405.6.3α/` | Current packed tree |
| Uninstall bat shipped | `desktop/Uninstall-Sirman.bat` → kit `App/Uninstall-Sirman.bat` | Copied by the packer |
| In-app installer | `desktop/Sirman.Desktop/InstallService.cs` + menu `نصب` in `MainForm.cs` | Second, still-live path: copy current exe dir + Persian Start Menu names |
| Shortcut helper | `Sirman_Install_Shortcuts.ps1` + `نصب_میانبر_سیرمان.bat` | Third path: Start/Desktop shortcuts to `Sirman_Start.bat`; **no uninstall link** |
| Older desktop pack | `desktop/install-sirman.bat` + `desktop/install-package.ps1` | Requires `publish\Sirman.exe`; English Start Menu like `install-setup.ps1` |

**Authoritative shop mechanism for current kits:** `نصب.bat` / `SETUP.bat` → `install-setup.ps1`.

There is **no** single installer technology. Three shortcut/uninstall naming schemes coexist. That is the root lifecycle defect.

---

## 2. Current Installation Paths

### 2.1 Program destination (installer-owned)

`install-setup.ps1` (`scripts/setup-kit/install-setup.ps1` L46–L78):

- Default pick: `%USERPROFILE%\Documents\Sirman`
- Remembers previous destination from `%LOCALAPPDATA%\Sirman\install-location.txt`
- Drive-root selection is rewritten to `<drive>\Sirman`
- Copies **all of `App\*`** into the chosen folder (`Copy-Item -Recurse -Force`)

Copied program files (typical kit `App\`):

- `Sirman.exe` + .NET 8 self-contained runtime tree
- `Sirman_Final.html`, `Sirman_Final_{version}.html`
- `Sirman_Start.bat`, `OPEN_SIRMAN.bat`, `sirman_run.ps1`, `apply_sirman_update.ps1`
- `Uninstall-Sirman.bat`
- `Sirman_Pending_Update.json`, `updates\Sirman_Update_{version}.json`
- `SIRMAN_VERSION.json`
- optional `Sirman_Install_Shortcuts.ps1`, `نصب_میانبر_سیرمان.bat`, guides

Also writes `%LOCALAPPDATA%\Sirman\install-location.txt` = destination.

### 2.2 Shortcuts created by the **zip installer**

`install-setup.ps1` L134–L159:

| Shortcut | Path |
|---|---|
| Start folder | `%APPDATA%\Microsoft\Windows\Start Menu\Programs\Sirman` (**English**) |
| Launch | `Sirman.lnk` → `Sirman.exe` if present, else `Sirman_Start.bat` / HTML |
| Uninstall | `Uninstall Sirman.lnk` → `Uninstall-Sirman.bat` |
| Desktop (optional) | `%USERPROFILE%\Desktop\Sirman.lnk` (**English name**) |

`IconLocation` is **not** set on these shortcuts.

### 2.3 Shortcuts created by **in-app InstallService**

`InstallService.cs` L38–L56, L127–L130:

| Shortcut | Path |
|---|---|
| Start folder | `%APPDATA%\Microsoft\Windows\Start Menu\Programs\سیرمان` (**Persian**) |
| Launch | `سیرمان.lnk` |
| Uninstall | `حذف سیرمان.lnk` |
| Desktop (optional) | `سیرمان.lnk` |

Sets `IconLocation = exe,0`.

### 2.4 Shortcuts created by **Sirman_Install_Shortcuts.ps1**

Folder English `Programs\Sirman`, link names **Persian** `سیرمان.lnk`. Target = `Sirman_Start.bat`. Writes `%LOCALAPPDATA%\Sirman\install_path.txt` (different filename). **No uninstall shortcut.**

### 2.5 Runtime / data paths (from source)

**LocalAppData (`%LOCALAPPDATA%\Sirman`) — `AppPaths.AppDataRoot`:**

| Subpath | Owner | Contents |
|---|---|---|
| `install-location.txt` | installer | last zip/in-app dest |
| `install_path.txt` | shortcut helper | last shortcut-helper dest |
| `desktop-settings.json` | Desktop shell | backup folder, install folder, last update, notify flags |
| `App\` | default install dir if none chosen (`AppPaths.DefaultInstallDir`) | program copy |
| `WebView2\` | MainForm L520 | **live HTML localStorage / IndexedDB** for the exe |
| `WebView2-print\` | `WindowsPrintHost` | print WebView cache |
| `WebView2-print-diag\` | diagnostic harness | diag WebView cache |
| `diagnostics\history.jsonl` | `DiagnosticHistoryStore` | print diagnostic history |
| `print\` | MainForm “پوشه لاگ چاپ” | print logs |
| `Backups\` | `AppPaths.ResolveBackupFolder` default | **JSON backups if user did not pick another folder** |

**Roaming (`%APPDATA%\Sirman`) — `SirmanHostObject.SirmanAppDir`:**

| Subpath | Owner | Contents |
|---|---|---|
| `backup\` | `GetBackupDir` / `WriteBackupText` | **autosave / Host backup files**; `sirman_media\` may live here |
| `prefs.json` | `SaveAppPref` / `LoadAppPref` | UI preferences |
| `secrets\` | `SecretStore` | Host secrets |
| `data\sirman.sqlite` | `CandidateStoragePaths` | Phase-3 **candidate** SQLite, not live SoT |
| `lan-share.on` | LAN marker | program/network state |
| `network.json` | `SetNetworkConfig` | shared workspace path |
| `sirman-workspace.json` | under backup or shared UNC | workspace file |

**HTML-only (no exe):** business data is **browser localStorage / IndexedDB**, not these folders.

**User-chosen backup folder:** stored in `desktop-settings.json` (`BackupFolder`). Media files `sirman_media\` resolve against that folder, `LocalAppData\Sirman\Backups`, and `AppData\Sirman\backup` (`NativeWindowsPrintService.ExistingBackupMediaRoots`).

**No registry uninstall key.** No Program Files default (unless the user picks it).

---

## 3. Current Uninstall Behavior

Shipped script: `desktop/Uninstall-Sirman.bat` (same bytes in the live kit).

Flow:

1. `INSTALL_DIR = %~dp0` (folder of the bat).
2. If `%LOCALAPPDATA%\Sirman\install-location.txt` exists **and** that path contains `Sirman.exe`, **overwrite** `INSTALL_DIR` with the saved path.
3. Confirm Y/N.
4. `taskkill /F /IM Sirman.exe`
5. Delete Start folder `%APPDATA%\Microsoft\Windows\Start Menu\Programs\سیرمان` (**Persian only**)
6. Delete `%USERPROFILE%\Desktop\سیرمان.lnk` and OneDrive Persian desktop link
7. Delete `install-location.txt` only (not `install_path.txt`, not `desktop-settings.json`)
8. `rd /s /q` the entire `INSTALL_DIR`
9. Optional Y/N: `rd /s /q %LOCALAPPDATA%\Sirman` wholesale

**Does not remove:**

- English Start Menu `Programs\Sirman` (what the zip installer actually creates)
- English `Desktop\Sirman.lnk`
- Entire `%APPDATA%\Sirman` (Roaming backups, prefs, secrets, media, candidate db)
- User-chosen backup folders outside LocalAppData
- `install_path.txt`
- Windows Apps & Features entry (none exists)

**In-app Uninstall** (`InstallService.LaunchUninstall`) runs the same bat family. `InstallService.BuildUninstallBatContent` is a **longer** variant with a clearer LocalAppData warning, but **the packer does not ship that text** — it copies `desktop/Uninstall-Sirman.bat`.

There is **no** separate “Full Cleanup” action. The optional LocalAppData wipe is a blunt Level-2 that also destroys live WebView2 data.

---

## 4. Why Cleanup Currently Fails

Proven from source (not shop pixels):

1. **Start Menu name mismatch (highest confidence).** Zip installer writes `Programs\Sirman`. Uninstall deletes `Programs\سیرمان`. After “successful” uninstall the English Start folder and `Sirman.lnk` remain. Clicking them launches a missing exe. This matches “uninstall does not work.”

2. **Desktop name mismatch.** Installer: `Sirman.lnk`. Uninstall: `سیرمان.lnk`. English desktop icon stays.

3. **Three installers, two location files.** `install-location.txt` vs `install_path.txt`. Uninstall only reads the first and only if `Sirman.exe` exists there. A HTML/`Sirman_Start.bat` install can leave the wrong `INSTALL_DIR`.

4. **Uninstall can delete a different folder than the bat you clicked.** If `install-location.txt` points at Documents\Sirman, running Uninstall from another extracted copy still deletes Documents\Sirman.

5. **Copy-upgrade does not prune.** `Copy-Item -Force` overwrites same names; leftover DLLs/HTML/JSON from older kits remain in the dest folder.

6. **No Apps & Features registration.** Users looking in Windows Uninstall UI find nothing.

7. **Optional “delete LocalAppData” is unsafe and incomplete.** It can wipe live business data inside `WebView2\` while **leaving** Roaming `%APPDATA%\Sirman\backup`. Operators who say “full cleanup did nothing” may have been looking at Roaming or Start Menu leftovers. Operators who say “it deleted my invoices” may have confirmed the LocalAppData prompt.

8. **In-app Install menu still creates the Persian Start folder.** A PC that used both zip setup and the exe «نصب» menu can have **two** Start folders. Uninstall removes only the Persian one.

---

## 5. Program vs User Data Separation

**Do not delete `%LOCALAPPDATA%\Sirman` or `%APPDATA%\Sirman` wholesale.**

### PROGRAM STATE (safe to remove on Level 1)

| Path | Why |
|---|---|
| Chosen install folder (`Documents\Sirman` or recorded dest) **except** any user backup/media the user stored *inside* that folder | binaries, HTML, runtime, update JSON, uninstall bat |
| `%APPDATA%\Microsoft\Windows\Start Menu\Programs\Sirman` | zip-installer shortcuts |
| `%APPDATA%\Microsoft\Windows\Start Menu\Programs\سیرمان` | in-app installer shortcuts |
| Desktop `Sirman.lnk` and `سیرمان.lnk` | shortcuts |
| `%LOCALAPPDATA%\Sirman\install-location.txt` | installer bookmark |
| `%LOCALAPPDATA%\Sirman\install_path.txt` | shortcut-helper bookmark |
| `%LOCALAPPDATA%\Sirman\App\` | default program copy |
| `%LOCALAPPDATA%\Sirman\WebView2-print\` | print engine cache |
| `%LOCALAPPDATA%\Sirman\WebView2-print-diag\` | diag engine cache |
| `%LOCALAPPDATA%\Sirman\print\` | print logs (program diagnostics, not invoices) |
| `%APPDATA%\Sirman\lan-share.on` | LAN program flag |
| `%APPDATA%\Sirman\network.json` | network program config (shared folder *path* is config; the shared folder contents are data) |

### USER / BUSINESS DATA (preserve on Level 1; Level 2 only with typed confirmation)

| Path | Why |
|---|---|
| `%LOCALAPPDATA%\Sirman\WebView2\` | **live invoices/warranty/stock in WebView2 localStorage** |
| Browser localStorage (HTML-only) | same data without exe |
| `%APPDATA%\Sirman\backup\` | Host autosave + possible `sirman_media` |
| `%LOCALAPPDATA%\Sirman\Backups\` | default Desktop backup folder |
| `desktop-settings.json` → `BackupFolder` | user-chosen backup root |
| `sirman_media\` under any backup root | logos/photos |
| `%APPDATA%\Sirman\prefs.json` | appearance/prefs (treat as user config; optional Level 2) |
| `%APPDATA%\Sirman\secrets\` | secrets |
| User-picked File System Access / autosave file (HTML) | not under Sirman AppData |

### DIAGNOSTIC HISTORY (separate)

| Path | Policy recommendation |
|---|---|
| `%LOCALAPPDATA%\Sirman\diagnostics\history.jsonl` | Preserve on Level 1 (useful after reinstall). Offer explicit “delete diagnostics” on Level 2. |
| `history.jsonl.corrupt-preserved` | same |

### CANDIDATE STORAGE (not live SoT)

| Path | Policy |
|---|---|
| `%APPDATA%\Sirman\data\sirman.sqlite` | Not live invoices. Still do not silent-delete; list it on Level 2. |

### CONFIG / UPDATE STATE

| Path | Level 1 | Level 2 |
|---|---|---|
| `%LOCALAPPDATA%\Sirman\desktop-settings.json` | keep (remembers backup folder) | delete after listing BackupFolder to the user |
| Install-dir `Sirman_Pending_Update.json`, `updates\` | remove with program files | n/a |
| `LastAppliedUpdate*` inside settings | program state | wipe with settings |

**Safety rule:** Level 1 must never `rd` `%LOCALAPPDATA%\Sirman` or `%APPDATA%\Sirman`. Level 2 must list each category and require typing a confirmation word (same spirit as `resetAll` / «تایید»).

---

## 6. Start Menu Behavior

**Required (this packet, not implemented):** folder contains `SIRMAN` and `Uninstall SIRMAN`. Full Cleanup, if present, must be a third, clearly named item.

**Today:**

| Creator | Folder | Launch link | Uninstall link | Full Cleanup |
|---|---|---|---|---|
| `install-setup.ps1` (shop zip) | `Programs\Sirman` | `Sirman.lnk` | `Uninstall Sirman.lnk` | none |
| `InstallService` (exe menu) | `Programs\سیرمان` | `سیرمان.lnk` | `حذف سیرمان.lnk` | none |
| `Sirman_Install_Shortcuts.ps1` | `Programs\Sirman` | `سیرمان.lnk` | **none** | none |

The zip installer **does** create an uninstall entry — but under the English folder, with English names. The uninstall script then fails to remove that folder.

**Mechanism:** `WScript.Shell.CreateShortcut`. Per-user Start Menu only (`%APPDATA%`), not all-users Programs.

Recommended later target (do not implement now):

- One folder: `Programs\Sirman`
- `SIRMAN.lnk` → `Sirman.exe`
- `Uninstall SIRMAN.lnk` → Level 1 script
- Optional third: `SIRMAN Full Cleanup.lnk` → Level 2 only, different icon/description, never the default uninstall

Keep Persian display names only as `Description`, or add a matching Persian folder **and** delete both on uninstall — never create one and delete the other.

---

## 7. Contamination Risks

Repeated shop installs **can** mix generations. Ranked:

| Risk | Mechanism | Severity |
|---|---|---|
| Stale Start Menu / desktop links | uninstall misses English names; new install adds another set | **High** — what operators see |
| Old HTML + new EXE or reverse | dest folder overwrite is name-based; extra `Sirman_Final_*.html` remain; `Sirman_Start.bat` may pick `Sirman_Final.html` vs versioned file | **High** for print/runtime identity |
| Old DLLs / runtime files | `Copy-Item -Force` does not delete files absent from the new kit | **High** for native print |
| Old `Sirman_Pending_Update.json` (1KB) | installer tries to replace/remove small pending files (L80–L89) but other leftover JSON can remain | Medium — already a known trap |
| Two install directories | Documents\Sirman + unzip-in-place + `LocalAppData\Sirman\App` + desktop kit folders `SHOP_P0.5R*` | **High** |
| Mixed LocalAppData | new exe reuses same `WebView2\` profile (business data) **and** same diagnostics | Expected for data; confusing for “clean test” |
| Roaming backup mix | new install keeps old `AppData\Sirman\backup` | Expected preserve; contaminates “fresh” tests |
| Registry | none found | None |
| Icon / shortcut target | leftover `.lnk` pointing at deleted path | High UX |

**Safe clean-install procedure for future shop testing is in §11. This audit did not execute it.**

---

## 8. Versioning Audit

### Sources today

| Source | Value now | Role |
|---|---|---|
| `SIRMAN_VERSION.json` | `app=1405.6.3α`, `assembly=1405.6.3.1`, `date=1405/06/03`, `letter=α`, `letterIndex=1` | **Authoritative product version** (ARCHITECTURE_RULES §4.1.8; `test_laegh.js` L4005–L4023) |
| `desktop/Directory.Build.props` | `Version`/`FileVersion`=`1405.6.3.1`, `InformationalVersion`=`1405.6.3α` | EXE ProductVersion / FileVersion / informational |
| HTML `APP_VERSION`, `<meta name="app-version">` | `1405.6.3α` | UI |
| `Sirman_Start.bat` `SIRMAN_VERSION=` | `1405.6.3α` | launcher banner |
| `updates/Sirman_Update_1405.6.3α.json` `version` | `1405.6.3α` | update payload |
| Kit folder / zip name | `Sirman_Setup_1405.6.3α` | package name = product version |
| Dated shop zips | e.g. `Sirman_Setup_1405.6.3α_P0.5R7_DIAG_2026-08-31` | **kit identity**, same product version |
| Start Menu | no version in the link name | — |

**A. Authoritative product version:** `SIRMAN_VERSION.json`.

**B. Must stay synchronized with `app` / `assembly` / `date`:** HTML meta + `APP_VERSION` + `APP_VERSION_FA`; `Directory.Build.props`; `Sirman_Start.bat` / `OPEN_SIRMAN.bat`; update JSON `version`; kit `App/SIRMAN_VERSION.json`; backup `version` field; `test_laegh.js` asserts (currently **hardcoded** to `1405.6.3α`).

**C. Does current product version reflect 2026-09-01?** **No.** `1405.6.3α` is 1405/06/03 = 2026-08-25. Today is **1405/06/10**. Do **not** bump in this audit. A later **release** on 2026-09-01 should become `1405.6.10α` / `1405.6.10.1`, not reuse `1405.6.3α`.

**D/E.** Recorded above.

### Proposed ONE versioning rule (future; not applied now)

1. **Product version** = Shamsi `{year}.{month}.{day}` + Greek letter for the **Nth product release that calendar day** (α=1 … as already mapped). Source of truth: `SIRMAN_VERSION.json`. Assembly fourth number = `letterIndex`.
2. **Do not reuse** a product version for a later calendar day. A new shop build on a new day is a new `app` value.
3. **Kit/build identity is not the product version.** Zip/folder names may add `_YYYY-MM-DD_{git-short}` or `_P0.5R7` **after** the product version. Operators must not treat the kit suffix as `APP_VERSION`.
4. Same product version + different git SHA is allowed only for **bit-identical rebuilds**. If binaries/HTML change, either bump the Greek letter (same day) or the day (new day).
5. Installer, EXE `InformationalVersion`, HTML, and Start Menu “about” must all show `app`. FileVersion shows `assembly`.
6. Dated diagnostic kits keep the same `app` only when they are the same product drop plus probes; the kit filename carries the packet id.

This prevents: silent reuse of `1405.6.3α` across August/September; EXE vs HTML mismatch; operators reading `2026-08-31` in a zip name as the Shamsi product version.

---

## 9. Icon / Branding Audit

**A. Default .NET icon?** **Yes, for the EXE.** `desktop/Sirman.Desktop/Sirman.Desktop.csproj` L10: `<ApplicationIcon />` empty. No `.ico` in the repository (glob `*.ico` = 0). Zip-installer shortcuts do not set `IconLocation`, so they inherit the target file’s icon (default .NET if target is `Sirman.exe`; generic BAT if target is `Sirman_Start.bat`).

**B. Existing logo available?** Yes, as **embedded UI logo**, not as an icon resource:

- Default `logoSrc` in `Sirman_Final.html` (~L7583) is a JPEG data URL (company/Laegh mark).
- Operator-uploaded logo is `localStorage.ll` and/or `disk://sirman_media/...` (see logo forensics). That is **shop branding data**, not the app icon.

**C. Reuse approved SIRMAN/Laegh logo?** **Yes, recommended:** derive a simplified square mark from the default embedded logo (or a later manager-approved still of that mark). Do **not** use a shop-uploaded `ll` logo as the EXE icon (that is tenant data).

**D. Files/projects for a later .ico (do not create now):**

- New `desktop/Sirman.Desktop/Assets/sirman.ico`
- `Sirman.Desktop.csproj` `ApplicationIcon`
- `install-setup.ps1` / `InstallService.CreateShortcut` / `Sirman_Install_Shortcuts.ps1` set `IconLocation` to `Sirman.exe,0`
- Packer already publishes the exe; no extra installer icon until/unless a real Setup.exe exists

**E. Windows sizes (minimum in one .ico):** 16, 20, 24, 32, 40, 48, 64, 256 (256 PNG-compressed). Small sizes need a simplified mark, not the full letterhead.

**F. Embed and inherit?** Yes. Set `ApplicationIcon` on the WinExe project; shortcuts with `IconLocation = Sirman.exe,0` inherit it. Start Menu uses the same. Do not ship a separate icon-only shortcut target.

No PNG/SVG asset folder exists in-repo; extraction from the HTML data URL is a later asset task.

---

## 10. P0 / P1 / P2 Priorities

### P0 — installer/uninstaller correctness, clean install, Start Menu uninstall, data protection

1. Unify Start Menu to one folder and matching uninstall deletions (English `Programs\Sirman` **or** both names).
2. Unify desktop link names the same way.
3. Level 1 uninstall: binaries + shortcuts + installer bookmarks only. **Never** `rd` whole LocalAppData or Roaming.
4. Level 2 full cleanup: separate checklist + typed confirmation; never silent.
5. Stop `INSTALL_DIR` hijack: uninstall the directory the bat lives in, and also remove **both** Start folders.
6. Upgrade copy: prune known leftover HTML/JSON/DLL names, or install into a versioned subfolder then retarget shortcuts.
7. Document (and later automate) the §11 clean-install for shop tests.

### P1 — version sync, diagnostic boundaries, icon

1. Version bump packet **when releasing**, to Shamsi date of that release (`1405.6.10α` if released 2026-09-01) — not this audit.
2. Split diagnostics vs WebView2 vs backups in Level 2.
3. Branded `.ico` from approved logo; embed in EXE; set shortcut `IconLocation`.

### P2 — visual installer polish

1. Optional later: real Setup.exe / Apps & Features registration.
2. Persian display names as descriptions, not as a second folder.
3. Wizard UI. Not required to stop contamination.

Print, Storage schema, and Backup/Restore engines stay out of this track.

---

## 11. Safe Clean Install Procedure

**Do not run this in the audit environment. Shop/Windows only, on a disposable profile when testing wipe.**

### Goal

One program folder, one Start Menu folder, one desktop link, previous program files gone, **business data preserved unless the test explicitly uses Level 2.**

### A. Preserve data first (always)

1. In running SIRMAN: ورود/خروج داده → export JSON backup to a folder **outside** Documents\Sirman (e.g. `D:\SirmanBackups-keep\`).
2. Note paths: `%LOCALAPPDATA%\Sirman` and `%APPDATA%\Sirman`. Copy `backup\` and `WebView2\` only if the test must restore live state.
3. Do **not** delete those trees yet.

### B. Stop the app

1. Close SIRMAN. Confirm Task Manager: no `Sirman.exe`.

### C. Remove program + shortcuts (Level 1, manual until the script is fixed)

Delete if present:

- `%APPDATA%\Microsoft\Windows\Start Menu\Programs\Sirman`
- `%APPDATA%\Microsoft\Windows\Start Menu\Programs\سیرمان`
- Desktop `Sirman.lnk` and `سیرمان.lnk` (and OneDrive Desktop copies)
- The recorded install dir from `install-location.txt` **and** any extra unzipped `SHOP_*` / `Sirman_Setup_*` copies used as “the app”
- `%LOCALAPPDATA%\Sirman\install-location.txt`
- `%LOCALAPPDATA%\Sirman\install_path.txt`
- `%LOCALAPPDATA%\Sirman\App` if it contains an extra exe tree

Do **not** delete `%LOCALAPPDATA%\Sirman\WebView2` or `%APPDATA%\Sirman\backup` for a normal reinstall test.

### D. Optional disposable-profile full wipe (Level 2 — test machine only)

Only on a test Windows user created for this purpose. After a backup copy is confirmed:

- Typed confirm.
- Then, and only then, remove listed Level 2 categories one by one (WebView2, backups, media, prefs, secrets, diagnostics, candidate sqlite).

Never do this on the live shop profile.

### E. Install once

1. Extract the **one** chosen zip to a staging folder.
2. Run only `نصب.bat` (not also in-app «نصب پکیج» and not `نصب_میانبر_سیرمان.bat` on the same day).
3. Choose **one** dest, preferably `%USERPROFILE%\Documents\Sirman` after it is empty of old binaries.
4. Confirm Start Menu: `Sirman` folder with launch + uninstall (after P0 fix: names `SIRMAN` / `Uninstall SIRMAN`).
5. Open SIRMAN once; check HTML version and EXE informational version match `SIRMAN_VERSION.json`.

### F. Do not

- Unzip a second `SHOP_P0.5R*` kit and run that exe “because it is newer looking.”
- Run in-app Install after zip install (creates the Persian second folder).
- Delete `%LOCALAPPDATA%\Sirman` to “make print work.”

---

## 12. Implementation Order

Do not implement in this packet.

1. **P0a.** Single Start Menu + desktop naming matrix in `install-setup.ps1`, `Uninstall-Sirman.bat`, `InstallService.cs`, `Sirman_Install_Shortcuts.ps1`. Uninstall deletes **all** known names.
2. **P0b.** Level 1 vs Level 2 scripts. Level 1 never touches WebView2 / Roaming backup / user BackupFolder. Level 2 lists paths and requires typed «تایید».
3. **P0c.** Uninstall `INSTALL_DIR` = bat directory; still delete recorded location **shortcuts** only, not a surprise second program tree without listing it.
4. **P0d.** Upgrade prune list (old HTML names, tiny pending JSON, orphaned runtime files) inside dest.
5. **P0e.** Shop clean-install dry run on a disposable Windows user (after 1–4).
6. **P1a.** Version packet on the actual release day (if 2026-09-01 → `1405.6.10α`) — separate from installer logic if needed, but ship together for a shop build.
7. **P1b.** Diagnostic-only delete option.
8. **P1c.** `.ico` + `ApplicationIcon` + shortcut `IconLocation`.
9. **P2.** Apps & Features / visual setup — after P0 is proven.

Dependency: P0a before any shop “uninstall works” claim. Icon can wait. Version bump is independent but a shop build should not keep 1405.6.3α if the release date is 1405/06/10.

---

## 13. Test Matrix

All destructive tests use a **disposable Windows user** and a throwaway invoice set. Never the live shop profile.

| # | Test | Pass criteria |
|---|---|---|
| 1 | Fresh install | `نصب.bat` copies exe+HTML; Start Menu folder has launch + uninstall; dest recorded in `install-location.txt` |
| 2 | Upgrade install | same dest; `Sirman.exe` and `Sirman_Final.html` hashes = kit; no extra `Sirman_Final_1405.5.*`; pending JSON not 1KB |
| 3 | Uninstall (Level 1) | dest program files gone; **both** Start folders gone; both desktop names gone; WebView2 and Roaming backup **still present** |
| 4 | Uninstall + reinstall | Level 1 then install; invoices from WebView2 still there |
| 5 | Full cleanup | typed confirm; listed categories removed; log shows each path |
| 6 | Full cleanup + reinstall | empty WebView2; app behaves as first run; no leftover Start links |
| 7 | Data preserved after normal uninstall | sample invoice still in WebView2 after Level 1 |
| 8 | Data deleted only after explicit full cleanup | Level 1 leaves data; Level 2 without confirm aborts; Level 2 with confirm removes WebView2 |
| 9 | Start Menu contains uninstall | `Uninstall SIRMAN` (or agreed names) present after install; click launches Level 1 |
| 10 | Shortcut icon matches SIRMAN | after P1c |
| 11 | EXE icon matches SIRMAN | after P1c; not default .NET |
| 12 | Installed version matches product | HTML `APP_VERSION` = EXE informational = `SIRMAN_VERSION.json` = about box |

Until P0 ships, tests 3/9 are **expected FAIL** on current source (English vs Persian mismatch).

---

## 14. Exact Files Expected to Change Later

Not modified in this audit.

**P0 (installer/uninstall):**

- `scripts/setup-kit/install-setup.ps1`
- `scripts/setup-kit/نصب.bat` / `SETUP.bat` (messages only if needed)
- `desktop/Uninstall-Sirman.bat`
- `desktop/Sirman.Desktop/InstallService.cs` (`StartMenuFolder`, `BuildUninstallBatContent`, shortcut names)
- `desktop/install-package.ps1` (same naming)
- `Sirman_Install_Shortcuts.ps1`
- `نصب_میانبر_سیرمان.bat`
- `scripts/pack_sirman_setup.py` (must keep shipping the **same** uninstall bat the installer names)
- `test_laegh.js` (new execution/text tests for matching Start Menu strings)

**P1 version (separate packet, actual release day):**

- `SIRMAN_VERSION.json`
- `desktop/Directory.Build.props`
- `Sirman_Final.html` / `Laegh_Final.html` (`APP_VERSION`, meta, date)
- `Sirman_Start.bat`, `OPEN_SIRMAN.bat`
- `updates/Sirman_Update_*.json`, `Sirman_Pending_Update.json`
- `test_laegh.js` hardcoded version asserts
- `docs/STABLE_BASELINE.md` after a verified release

**P1 icon:**

- new `desktop/Sirman.Desktop/Assets/sirman.ico`
- `desktop/Sirman.Desktop/Sirman.Desktop.csproj` (`ApplicationIcon`)
- shortcut scripts (`IconLocation`)

**Do not change for this work:** Print renderer, Native Postal, PaperSize, Storage/Backup engines, invoice business rules.

---

## 15. Safety Rules

1. Business data is not install state. `WebView2\` and `AppData\Sirman\backup` are live data.
2. Never silent-delete `%LOCALAPPDATA%\Sirman` or `%APPDATA%\Sirman`.
3. Never recommend wholesale folder deletes in shop runbooks.
4. Level 2 requires an explicit typed word, category list, and a backup reminder.
5. Uninstall must not kill a second install directory without showing its path.
6. Do not register MSI/Inno in P0 unless it is the single remaining installer; adding a fourth technology increases contamination.
7. Print frozen: installer work must not retouch print code.
8. Version is not bumped until a real release packet; kit dates are not product versions.
9. Icon work must not overwrite operator `logoSrc` / `ll`.
10. All destructive verification on a disposable Windows profile.

---

## Packet verdict

Current shop zip **does** create a Start Menu uninstall shortcut, but uninstall **cannot see it** because of English vs Persian path/name split. Full cleanup as a safe, explicit, categorized action **does not exist**. Optional LocalAppData wipe is both too broad (destroys live WebView2 data) and too narrow (leaves Roaming backups and English shortcuts). EXE uses the default .NET icon. Product version `1405.6.3α` is **not** the 2026-09-01 Shamsi date.

Next work after review: P0 naming + two-level uninstall, then a dated version packet, then icon.

```text
Product source changed: NO
Installer changed:      NO
Uninstaller changed:    NO
Print changed:          NO
Storage changed:        NO
Backup changed:         NO
Version changed:        NO
Icon assets changed:    NO
Build/package:          NO
STATUS: AUDIT COMPLETE — WAIT FOR REVIEW
STOP.
```
