# SIRMAN — FULL SELF-CONTAINED INSTALLER `1405.6.16α`

**Date:** 1405/06/21 (2026-09-12)
**Packet:** FULL-SELF-CONTAINED-INSTALLER-1405.6.16α
**Mode:** PACKAGING ONLY
**Product code modified:** NO
**HTML source modified:** NO
**Installed on a machine:** NO

```text
FINAL STATUS: READY FOR HOME INSTALL + NEEDS HUMAN VERIFICATION
CURRENT APPLICATION REQUIRES HTML — FULL INSTALLER MUST INCLUDE IT
.NET Desktop Runtime separately installed: NO
WebView2: YES (external prerequisite)
Native update path HTML-independent: YES
```

---

# 1. PRE-CHECK

Read: uploaded installer packet, architecture/governance docs, Diagnostic P0–P3 and Native Update P0/P1/P1.1 reports, `SIRMAN_VERSION.json`.

```text
Branch:              cursor/diagnostic-center-p3-ui-fault-fa01
HEAD:                799a4420260b062aba22a0e4e88033af002e1187
HEAD message:        fix: ship self-contained runtime in native update packages
Branch switch:       NO
reset/rebase/merge:  NO
Version bump:        NO
pack_sirman_setup.py: NOT run (would overwrite known-good Sirman_Setup_1405.6.16α)
write_full_update_json.py: NOT run on repo files
```

Unrelated dirty leftovers (not packed, not staged):

```text
 M deliveries/migration/P1-services/services.candidate.sqlite
 M deliveries/migration/P1-services/services.sha256
?? deliveries/Sirman_Setup_1405.6.16α_DIAGNOSTIC-P3_VERIFY/
```

Those do not affect the installer. Packaging continued (not BLOCKED).

Known-good and VERIFY zips **untouched**:

| File | SHA-256 |
|---|---|
| `deliveries/Sirman_Setup_1405.6.16α.zip` | `0f66467a5f891facbb2c58f02e145fa6c5bfaf7de01e5d9b13812b0a8908f937` |
| `deliveries/Sirman_Setup_1405.6.16α_DIAGNOSTIC-P3_VERIFY.zip` | `42f06f5335086cca8102b6a62d9838fcf0000eef90a3a43f76e24150d2530856` |

---

# 2. SOURCE CHECKPOINT

HEAD `799a442` includes:

| Commit | Packet |
|---|---|
| `6fd23e8` | Diagnostic P0 |
| `7f79098` | Diagnostic P1 |
| `607843d` | Diagnostic P2 |
| `f5e3eba` | Diagnostic P3 |
| `a86684f` | Native update P0 |
| `43e390b` | Native update P1 |
| `799a442` | Native update P1.1 (self-contained payload) |

Latest product-code checkpoint for this kit: **`799a442`**.

Packer: one-off `/tmp/pack_sirman_full_kit.py` (not in repo). Output name `_FULL` so the known-good tree is not deleted.

---

# 3. VERSION

Unchanged.

| Location | Value |
|---|---|
| `SIRMAN_VERSION.json` app | `1405.6.16α` |
| assembly | `1405.6.16.1` |
| HTML `APP_VERSION` | `1405.6.16α` |
| Kit `App/SIRMAN_VERSION.json` | same |
| Kit pending JSON version | `1405.6.16α` |

---

# 4. PUBLISH MODEL

```text
dotnet publish desktop/Sirman.Desktop -c Release -r win-x64 --self-contained true
dotnet publish desktop/Sirman.Updater -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true
```

`Sirman.runtimeconfig.json` uses `includedFrameworks` (`Microsoft.NETCore.App` + `Microsoft.WindowsDesktop.App` **8.0.31**), not shared `frameworks`.

`Sirman.exe`: PE32+ GUI win-x64. `hostfxr.dll` / `coreclr.dll` present.

---

# 5. INSTALLER CONTENTS

**Primary package (take this ZIP home):**

```text
deliveries/Sirman_Setup_1405.6.16α_FULL.zip
```

| Item | Value |
|---|---|
| Size | **102 865 517** bytes |
| SHA-256 | `9a2e6889beae3a6ed30b6a5cac89c503530d268ac5a6ef39c6dab6e368fab66f` |
| Sidecar | `deliveries/Sirman_Setup_1405.6.16α_FULL.sha256` |
| ZIP entries | 497 |
| App files | 488 |

Inside the zip (`Sirman_Setup_1405.6.16α_FULL/`):

- `نصب.bat` / `SETUP.bat` / `install-setup.ps1` — established one-click setup
- `App/Sirman.exe` + full self-contained runtime (`hostfxr.dll`, `coreclr.dll`, WinForms, WPF, …)
- `App/Sirman_Final.html` (+ dated copy + `Laegh_Final.html`) — **required UI**
- `App/SirmanUpdater.exe` — native updater (self-contained)
- `App/Uninstall-Sirman.bat` / `.ps1` / `Sirman-Full-Cleanup.bat`
- lifecycle contract + `00_اینجا_شروع_کنید.txt`
- kit-only `Sirman_Pending_Update.json` generated from **current** HTML (`ReportUiFault` present). Repo pending JSON was **not** rewritten.

No sqlite / shop data files.

---

# 6. .NET RUNTIME INDEPENDENCE

**Separately installed .NET Desktop Runtime: NO.**

Proof: `includedFrameworks` + `hostfxr.dll` + `coreclr.dll` + `System.Windows.Forms.dll` + `WindowsBase.dll` in `App\`.

| File | Bytes | SHA-256 |
|---|---|---|
| `Sirman.exe` | 152064 | `ba3f60ee8422f3b23b7cc6ddaf973ea0752cbbcc04b393296ff9a842a2c455f8` |
| `hostfxr.dll` | 366376 | `4f5a0500cd2a2439b0d5edbf242950233aec4539ec9a5e7ba9b8a9b0079f63af` |
| `coreclr.dll` | 4995880 | `bbbcaedb369617695280caaa60cda1aba4fa3c5b557532a89d9f4a9174a5b692` |
| `SirmanUpdater.exe` | 67943391 | `988152623e413bdf367c1d92549871be3f43af0599fdc2522070568cd1ef3170` |

---

# 7. CURRENT APP HTML DEPENDENCY

**CURRENT APPLICATION REQUIRES HTML — FULL INSTALLER MUST INCLUDE IT.**

`Sirman.exe` hosts `Sirman_Final.html` in WebView2 (`MainForm`). Setup refuses HTML &lt; 500 000 bytes. HTML was **not** removed and independence was **not** faked.

| Item | Value |
|---|---|
| Kit HTML SHA-256 | `cd21964ad11213b9844429ec862eee51473c3ae217f67e809fa396fdd9ff53cf` |
| Bytes | 1 885 137 |
| `ReportUiFault` | YES |
| Same as `Laegh_Final.html` | YES |

---

# 8. NATIVE UPDATE INDEPENDENCE

Assembler run against this kit `App\` (HTML present):

```text
skippedHtml: 3
files: 465
.html in native package: NONE
hostfxr in native package: YES
```

`SirmanUpdater.exe` is in `App\` and does not copy HTML. `SIRMAN_UPDATE` / `apply_sirman_update.ps1` remain the HTML channel and were not redesigned.

---

# 9. INSTALL / UNINSTALL

**Install (Windows):**

1. Extract the ZIP.
2. Double-click `نصب.bat` (or `SETUP.bat`).
3. Pick a folder (default **Documents\Sirman**).
4. Optional desktop shortcut.
5. Start Menu: `Programs\Sirman\SIRMAN.lnk`.

Recorded location: `%LocalAppData%\Sirman\install-location.txt`.

Setup copies `App\*` into the chosen folder. It does **not** wipe `%LocalAppData%\Sirman\WebView2` or backup folders. Level-1 uninstall is the established `Uninstall-Sirman.bat` (program files, not business data). Level-2 full cleanup still requires typing `CONFIRM`.

Native updater default `--install` is `%LocalAppData%\Sirman\App`. If you install to **Documents\Sirman**, pass that folder to `--install`.

---

# 10. VALIDATION

| Check | Result |
|---|---|
| HTML ≥ 500 000 and version string | YES |
| Self-contained runtime in App | YES |
| `ValidatePackage` path (assembler from App) | 465 files, no HTML |
| SHA-256 of zip | `9a2e6889beae3a6ed30b6a5cac89c503530d268ac5a6ef39c6dab6e368fab66f` |
| `node test_laegh.js Sirman_Final.html` | **1120 / 1120** |
| `dotnet test desktop/Sirman.Core.Tests` | **938 / 938** |
| `node test_installer_lifecycle.js` | **21 / 21** |
| Real Windows install | NOT executed |

---

# 11. HASHES

| Artifact | SHA-256 |
|---|---|
| **FULL zip** | `9a2e6889beae3a6ed30b6a5cac89c503530d268ac5a6ef39c6dab6e368fab66f` |
| Known-good Setup zip (untouched) | `0f66467a5f891facbb2c58f02e145fa6c5bfaf7de01e5d9b13812b0a8908f937` |
| VERIFY zip (untouched) | `42f06f5335086cca8102b6a62d9838fcf0000eef90a3a43f76e24150d2530856` |
| Source / kit `Sirman_Final.html` | `cd21964ad11213b9844429ec862eee51473c3ae217f67e809fa396fdd9ff53cf` |

---

# 12. PROTECTED AREAS

Not modified: HTML source, Core/Desktop/Host product code, Backup/Print/Inventory/SQLite, native-updater architecture, `pack_sirman_setup.py`, repo pending JSON, shop data, known-good Setup ZIP.

---

# 13. HUMAN WINDOWS VERIFICATION

Linux cannot launch WinForms/WebView2.

```text
Home install + first launch:     NEEDS HUMAN VERIFICATION
No Desktop Runtime dialog:       NEEDS HUMAN VERIFICATION
WebView2 present on the PC:      user must have it (or install Evergreen)
```

---

# 14. KNOWN LIMITATIONS

- UI is still HTML/WebView2.
- WebView2 Evergreen is external.
- Default setup folder is Documents\Sirman, not `%LocalAppData%\Sirman\App`.
- `SirmanUpdater.exe` is in App; install-contract owned-name list does not list it (Level 1 may leave it; not a data wipe).
- Do **not** use the 7-file `.snu` (P1.1). This installer already contains the current SC binaries.

---

# 15. FINAL STATUS

| Item | Value |
|---|---|
| Installer | `deliveries/Sirman_Setup_1405.6.16α_FULL.zip` |
| Size | 102865517 bytes |
| SHA-256 | `9a2e6889beae3a6ed30b6a5cac89c503530d268ac5a6ef39c6dab6e368fab66f` |
| Install path | user-chosen; default `Documents\Sirman` |
| Version | `1405.6.16α` / `1405.6.16.1` |
| .NET Desktop Runtime extra install | **NO** |
| WebView2 | **YES**, external |
| HTML in installer | **YES** — current app cannot run without it |
| Native update depends on HTML | **NO** |

**READY FOR HOME INSTALL.**

**NEEDS HUMAN VERIFICATION** on Windows (first launch / WebView2).

**STOP.** Nothing installed. No further packet started.
