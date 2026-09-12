# SIRMAN — FULL SELF-CONTAINED INSTALLER FINAL `1405.6.16α`

**Date:** 1405/06/21 (2026-09-12)
**Packet:** FULL-SELF-CONTAINED-INSTALLER-1405.6.16α-FINAL
**Mode:** PACKAGING ONLY (rebuild)
**Product code modified:** NO
**HTML source modified:** NO
**Installer executed:** NO
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

Read: uploaded FINAL packet, `docs/ARCHITECTURE_RULES.md`, `docs/DEVELOPMENT_GOVERNANCE.md`, Native Update P0/P1/P1.1 reports, previous FULL installer report, `SIRMAN_VERSION.json`.

```text
Branch:              cursor/diagnostic-center-p3-ui-fault-fa01
HEAD at pack:        c83a0ce0c5e52ec8c558d30320a6d641e16ea8c2
HEAD message:        pack: add full self-contained Windows installer 1405.6.16α
Product-code HEAD:   799a442 (Native Update P1.1)
Branch switch:       NO
reset/rebase/merge:  NO
Version bump:        NO
pack_sirman_setup.py: NOT executed (would rmtree deliveries/Sirman_Setup_1405.6.16α)
write_full_update_json.py: NOT run on repo files
7-file .snu used:    NO
```

Unrelated dirty leftovers (not packed, not staged):

```text
 M deliveries/migration/P1-services/services.candidate.sqlite
 M deliveries/migration/P1-services/services.sha256
?? deliveries/Sirman_Setup_1405.6.16α_DIAGNOSTIC-P3_VERIFY/
?? deliveries/Sirman_Setup_1405.6.16α_FULL/
```

Those do not affect the installer. Packaging continued (not BLOCKED).

Protected packages **untouched** (re-hashed after pack):

| File | SHA-256 |
|---|---|
| `deliveries/Sirman_Setup_1405.6.16α.zip` | `0f66467a5f891facbb2c58f02e145fa6c5bfaf7de01e5d9b13812b0a8908f937` |
| `deliveries/Sirman_Setup_1405.6.16α_DIAGNOSTIC-P3_VERIFY.zip` | `42f06f5335086cca8102b6a62d9838fcf0000eef90a3a43f76e24150d2530856` |
| `deliveries/Sirman_Setup_1405.6.16α_FULL.zip` (previous packet) | `9a2e6889beae3a6ed30b6a5cac89c503530d268ac5a6ef39c6dab6e368fab66f` |

---

# 2. SOURCE CHECKPOINT

HEAD `c83a0ce` is packaging-only on top of product-code `799a442`.

| Commit | Packet |
|---|---|
| `6fd23e8` | Diagnostic P0 |
| `7f79098` | Diagnostic P1 |
| `607843d` | Diagnostic P2 |
| `f5e3eba` | Diagnostic P3 |
| `a86684f` | Native update P0 |
| `43e390b` | Native update P1 (`SirmanUpdater`) |
| `799a442` | Native update P1.1 (self-contained payload) |
| `c83a0ce` | Previous FULL zip (packaging only) |

Latest product-code checkpoint: **`799a442`**.

Packer: one-off `/tmp/pack_sirman_full_final.py` — same copy list and `scripts/setup-kit` templates as `scripts/pack_sirman_setup.py`, output name `_FINAL`, plus `SirmanUpdater.exe`. Not committed. Repo packer was not run.

---

# 3. VERSION / ASSEMBLY

Unchanged. Authoritative source: `SIRMAN_VERSION.json`.

| Location | Value |
|---|---|
| `SIRMAN_VERSION.json` app | `1405.6.16α` |
| assembly | `1405.6.16.1` |
| `desktop/Directory.Build.props` | `1405.6.16.1` / `1405.6.16α` |
| HTML `APP_VERSION` | `1405.6.16α` |
| Kit `App/SIRMAN_VERSION.json` | same |

---

# 4. PUBLISH MODEL

```text
dotnet publish desktop/Sirman.Desktop -c Release -r win-x64 --self-contained true
  -p:EnableWindowsTargeting=true -p:DebugType=none -p:DebugSymbols=false
  -o /tmp/sirman-fd-publish-final

dotnet publish desktop/Sirman.Updater -c Release -r win-x64 --self-contained true
  -p:PublishSingleFile=true -p:DebugType=none -p:DebugSymbols=false
  -o /tmp/sirman-updater-win-final
```

`Sirman.Desktop.csproj`: `SelfContained=true` when RID is `win-x64`.

`App/Sirman.runtimeconfig.json` uses `includedFrameworks` (`Microsoft.NETCore.App` + `Microsoft.WindowsDesktop.App` **8.0.31**), not shared `framework` / `frameworks`.

`Sirman.exe` and `SirmanUpdater.exe` are PE MZ. `hostfxr.dll` / `hostpolicy.dll` / `coreclr.dll` present.

---

# 5. INSTALLER FILE

**Primary package (take this ZIP home):**

```text
deliveries/Sirman_Setup_1405.6.16α_FINAL.zip
```

| Item | Value |
|---|---|
| Size | **102 396 369** bytes |
| SHA-256 | `6da711e3050d289a46a987d97e23b72fb50f6aba0d15df765378e91ced5b48cc` |
| Sidecar | `deliveries/Sirman_Setup_1405.6.16α_FINAL.sha256` |
| ZIP entries | 496 |
| Kit `App\` files | 487 |
| Mechanism | established `نصب.bat` / `SETUP.bat` / `install-setup.ps1` |

Unpacked tree (not the delivery file; not committed): `deliveries/Sirman_Setup_1405.6.16α_FINAL/`.

Installer itself was **not** executed.

---

# 6. INSTALLER CONTENTS

Inside the zip (`Sirman_Setup_1405.6.16α_FINAL/`):

- `نصب.bat` / `SETUP.bat` / `install-setup.ps1` — established one-click setup
- `00_اینجا_شروع_کنید.txt` — Persian start instructions
- `App/Sirman.exe` + full self-contained .NET 8 Desktop runtime
- `App/Sirman.Core.dll` / `App/Sirman.dll` — Diagnostic P0–P3 + native update P0/P1
- `App/Sirman_Final.html` (+ dated copy) — **required current UI**
- `App/SirmanUpdater.exe` — native updater (self-contained single-file)
- `App/Uninstall-Sirman.bat` / `.ps1` / `Sirman-Full-Cleanup.bat`
- lifecycle contract + HTML-channel `apply_sirman_update.ps1`
- kit-only `Sirman_Pending_Update.json` / `updates/Sirman_Update_1405.6.16α.json` generated from **current** HTML (`ReportUiFault` present). Repo pending JSON was **not** rewritten.

No sqlite / shop / user business data. No `.snu`. No test artifacts.

---

# 7. .NET RUNTIME INDEPENDENCE

**Separately installed .NET Desktop Runtime: NO.**

Proof: `includedFrameworks` 8.0.31 + `hostfxr.dll` + `hostpolicy.dll` + `coreclr.dll` + `System.Windows.Forms.dll` + `WindowsBase.dll` in `App\`.

| File | Bytes | SHA-256 |
|---|---|---|
| `Sirman.exe` | 152064 | `c21aa702a3f87019b9686a6b488cb7fb6494fbfd1a4574550c54a2b7d78fd215` |
| `hostfxr.dll` | 366376 | `4f5a0500cd2a2439b0d5edbf242950233aec4539ec9a5e7ba9b8a9b0079f63af` |
| `coreclr.dll` | 4995880 | `bbbcaedb369617695280caaa60cda1aba4fa3c5b557532a89d9f4a9174a5b692` |
| `SirmanUpdater.exe` | 67943391 | `e648a9e156f6c1a2a08ede30962a4fc1256ecf714210a094e78aca649b371a3f` |

---

# 8. CURRENT APP HTML DEPENDENCY

**CURRENT APPLICATION REQUIRES HTML — FULL INSTALLER MUST INCLUDE IT.**

`Sirman.exe` hosts `Sirman_Final.html` in WebView2 (`MainForm`). Setup refuses HTML &lt; 500 000 bytes. HTML was **not** removed and independence was **not** faked.

| Item | Value |
|---|---|
| Kit HTML SHA-256 | `cd21964ad11213b9844429ec862eee51473c3ae217f67e809fa396fdd9ff53cf` |
| Bytes | 1 885 137 |
| Matches source `Sirman_Final.html` | YES |
| `ReportUiFault` in HTML | YES |
| Dated copy `Sirman_Final_1405.6.16α.html` | YES (same bytes) |

---

# 9. NATIVE UPDATE INDEPENDENCE

Assembler `scripts/assemble_sirman_native_update.py` against this kit `App\` (HTML present beside native files):

```text
skippedHtml: 2
files: 465
.html in native package: NONE
hostfxr / coreclr in native package: YES
```

`SirmanUpdater.exe` is in `App\` (self-contained). Apply copies allow-listed native files only; HTML is forbidden. Magic `SIRMAN_NATIVE_UPDATE` is in Core (UTF-16 metadata). `SIRMAN_UPDATE` / `apply_sirman_update.ps1` remain the HTML channel and were not redesigned.

HTML is **not** required by the native update mechanism.

---

# 10. DIAGNOSTIC P0-P3 PRESENCE

Product source at `799a442` includes P0–P3. Kit binaries:

| Packet | Evidence in kit |
|---|---|
| P0 | `GetRecentDiagnostics` / `GetDiagnosticIncident` / `ExportDiagnosticReport` in `Sirman.Core.dll` + `Sirman.dll` |
| P1 | `NewDiagnosticCorrelationId` in `Sirman.dll` (Host) and Core catalog (UTF-16) |
| P2 | `OpenDiagnosticCenter` in `Sirman.dll` (Host/WinForms). Intentionally **not** in HTML. |
| P3 | `ReportUiFault` in HTML + `Sirman.Core.dll` + Host |

---

# 11. VALIDATION / TESTS

| Check | Result |
|---|---|
| HTML ≥ 500 000 and version string | YES |
| Self-contained runtime in App | YES |
| `ValidatePackage` path (assembler from App) | 465 files, no HTML |
| Shop/user data in kit | NONE |
| 7-file `.snu` as installer basis | NO |
| SHA-256 of zip | `6da711e3050d289a46a987d97e23b72fb50f6aba0d15df765378e91ced5b48cc` |
| `node test_laegh.js Sirman_Final.html` | **1120 / 1120** |
| `dotnet test desktop/Sirman.Core.Tests` | **938 / 938** |
| `node test_installer_lifecycle.js` | **21 / 21** |
| Real Windows / shop install | NOT executed |

---

# 12. SHA-256

| Artifact | SHA-256 |
|---|---|
| **FINAL zip** | `6da711e3050d289a46a987d97e23b72fb50f6aba0d15df765378e91ced5b48cc` |
| Source / kit `Sirman_Final.html` | `cd21964ad11213b9844429ec862eee51473c3ae217f67e809fa396fdd9ff53cf` |
| Known-good Setup zip (untouched) | `0f66467a5f891facbb2c58f02e145fa6c5bfaf7de01e5d9b13812b0a8908f937` |
| VERIFY zip (untouched) | `42f06f5335086cca8102b6a62d9838fcf0000eef90a3a43f76e24150d2530856` |

---

# 13. INSTALL PATH

**Exact default install path:** `Documents\Sirman` (user folder picker in `install-setup.ps1`).

Recorded location: `%LocalAppData%\Sirman\install-location.txt`.

Setup copies `App\*` into the chosen folder. It does **not** wipe `%LocalAppData%\Sirman\WebView2` or backup folders. Level-1 uninstall is the established `Uninstall-Sirman.bat` (program files, not business data). Level-2 full cleanup still requires typing `CONFIRM`.

Native updater default `--install` is `%LocalAppData%\Sirman\App`. If you install to **Documents\Sirman**, pass that folder to `--install`.

**Clean Windows procedure:**

1. Confirm WebView2 Evergreen is installed (or install it from Microsoft).
2. Copy `Sirman_Setup_1405.6.16α_FINAL.zip` to the PC.
3. Extract All.
4. Double-click `نصب.bat` (or `SETUP.bat`).
5. Pick a folder (default **Documents\Sirman**).
6. Optional desktop shortcut.
7. Start Menu: `Programs\Sirman\SIRMAN.lnk`.
8. No separate .NET Desktop Runtime install.

---

# 14. WEBVIEW2 PREREQUISITE

**WebView2: YES — external prerequisite.**

The current application UI is HTML hosted in WebView2. A missing runtime shows a blank window. Install Evergreen from:

`https://developer.microsoft.com/microsoft-edge/webview2/`

This is **not** .NET Desktop Runtime.

---

# 15. KNOWN LIMITATIONS

- UI is still HTML/WebView2.
- WebView2 Evergreen is external.
- Default setup folder is Documents\Sirman, not `%LocalAppData%\Sirman\App`.
- `SirmanUpdater.exe` is in App; install-contract owned-name list does not list it (Level 1 may leave it; not a data wipe).
- Do **not** use the 7-file `.snu` (P1). Native updates use the P1.1 SC package.
- Repo `Sirman_Pending_Update.json` still lacks `ReportUiFault`; the kit-only pending JSON was generated from current HTML and was not written back to the repo.

---

# 16. HUMAN WINDOWS VERIFICATION

Linux cannot launch WinForms/WebView2. The installer zip was packed and inspected, not run.

```text
Home install + first launch:     NEEDS HUMAN VERIFICATION
No Desktop Runtime dialog:       NEEDS HUMAN VERIFICATION
WebView2 present on the PC:      user must have it (or install Evergreen)
```

---

# 17. FINAL STATUS

| Item | Value |
|---|---|
| Installer | `deliveries/Sirman_Setup_1405.6.16α_FINAL.zip` |
| Size | 102396369 bytes |
| SHA-256 | `6da711e3050d289a46a987d97e23b72fb50f6aba0d15df765378e91ced5b48cc` |
| Install path | user-chosen; default `Documents\Sirman` |
| Version | `1405.6.16α` |
| Assembly | `1405.6.16.1` |
| .NET Desktop Runtime extra install | **NO** |
| WebView2 | **YES**, external |
| HTML in FULL installer | **YES** — current app cannot run without it |
| HTML required by native update | **NO** |
| Installer executed | **NO** |

**READY FOR HOME INSTALL.**

**NEEDS HUMAN VERIFICATION** on Windows (first launch / WebView2).

**STOP.** Nothing installed. No further packet started.
