# SIRMAN — PHASE 3 FINAL DELIVERY PACKAGE REPORT
## Shop installation candidate from the live migration branch

**Mode:** PACKAGING / RELEASE CANDIDATE ONLY  
**Date:** 1405/05/30 13:36:46 (Asia/Tehran)  
**Gregorian:** 21 August 2026  
**Branch:** `cursor/phase-3-architecture-migration-3733`  
**HEAD at packaging:** `7da4f52` (`docs: record B20 report commit hash on tracker`)  
**Product checkpoint:** `B19R-FINAL-GOOD` = `1fcf054`  
**Live version:** `1405.5.27γ` / assembly `1405.5.27.3`  
**B20:** analysis-only, no product-code change

```text
PRODUCT CODE CHANGED DURING PACKAGING = NO
ARCHITECTURE CHANGED DURING PACKAGING = NO
VERSION CHANGED = NO
OLD γ KIT OVERWRITTEN = NO
PUSH TO MAIN = NO
```

Official packer: `scripts/pack_sirman_setup.py` + `scripts/setup-kit/*`.  
This run used that same mechanism with a **duplicate-safe** output name so the previous `Sirman_Setup_1405.5.27γ` kit was not deleted.

---

# 1. Jalali date

```text
1405/05/30
```

---

# 2. Gregorian date

```text
21 August 2026
```

---

# 3. Exact local time

```text
13:36:46
```

---

# 4. Timezone

```text
Asia/Tehran
```

---

# 5. Branch

```text
cursor/phase-3-architecture-migration-3733
```

Worktree was clean before packaging. Did not switch branches. Did not merge to `main`.

---

# 6. HEAD

```text
7da4f52  docs: record B20 report commit hash on tracker
7da4f52c… (full: 7da4f52)
descendant of 1fcf054 = YES
```

HEAD is a docs-only descendant after the last product commit. Allowed by the delivery gate.

---

# 7. Product checkpoint

```text
B19R-FINAL-GOOD = 1fcf054
fix: close remaining inventory mutation boundary risks
```

Previous product: `e414025`. B20 did not change product code.

---

# 8. Product version

Authoritative `SIRMAN_VERSION.json`:

```text
app        = 1405.5.27γ
appFa      = ۱۴۰۵.۵.۲۷γ
assembly   = 1405.5.27.3
date       = 1405/05/27
letter     = γ
```

`desktop/Directory.Build.props`: `<Version>1405.5.27.3</Version>` / `<InformationalVersion>1405.5.27γ</InformationalVersion>`.  
HTML `APP_VERSION` / `<meta name="app-version">` = `1405.5.27γ`.  
Published `Sirman.dll` contains both `1405.5.27γ` (UTF-16) and `1405.5.27.3`.  
Version was **not** changed.

---

# 9. Build result

```text
dotnet build desktop/Sirman.Core/Sirman.Core.csproj -c Release
  → PASS (0 error)

dotnet build desktop/Sirman.Desktop/Sirman.Desktop.csproj -c Release -p:EnableWindowsTargeting=true
  → PASS (0 error; pre-existing MSB3277 WindowsBase / CS8604 warnings, not introduced here)

dotnet publish desktop/Sirman.Desktop/Sirman.Desktop.csproj
  -c Release -r win-x64 --self-contained false
  -p:EnableWindowsTargeting=true -p:DebugType=none -p:DebugSymbols=false
  -o /tmp/sirman-fd-publish
  → PASS
```

```text
Sirman.exe = PE32+ GUI x86-64 (Release, no PDB)
Sirman.dll InformationalVersion = 1405.5.27γ
Sirman.dll FileVersion/assembly = 1405.5.27.3
```

```text
Build = PASS
```

---

# 10. HTML test result

```text
node test_laegh.js Sirman_Final.html
  کل تست‌ها: 644  موفق: 644  ناموفق: 0

node test_laegh.js Laegh_Final.html
  کل تست‌ها: 644  موفق: 644  ناموفق: 0
```

```text
HTML tests = PASS
```

---

# 11. Core test result

```text
dotnet test desktop/Sirman.Core.Tests/Sirman.Core.Tests.csproj
  Passed: 159  Failed: 0  Skipped: 0
```

```text
Core tests = PASS
```

---

# 12. Regression result

HTML + Core suites are the regression floor from `docs/REGRESSION_SUITE.md`. Both green. No product diff.

```text
Regression = PASS
```

---

# 13. HTML synchronization result

Deterministic byte compare:

```text
Sirman_Final.html  1812638  SHA-256 85328e7df438ef5348cf88c5f0fc72f802b6fd82760ffbf9f006882b55ea6955
Laegh_Final.html   1812638  SHA-256 85328e7df438ef5348cf88c5f0fc72f802b6fd82760ffbf9f006882b55ea6955
identical          YES
```

Kit copies of both files match live source.

```text
HTML sync = PASS
```

---

# 14. Package directory

```text
deliveries/Sirman_Setup_1405.5.27γ_FINAL/
```

Duplicate-safe name: `deliveries/Sirman_Setup_1405.5.27γ/` already existed (previous γ packaging, **older HTML** 1798922 bytes). It was **not** overwritten.

---

# 15. Final archive / installer path

```text
deliveries/Sirman_Setup_1405.5.27γ_FINAL.zip
```

Checksum sidecar:

```text
deliveries/Sirman_Setup_1405.5.27γ_FINAL.sha256
```

Shop installers inside the extracted folder:

```text
نصب.bat
SETUP.bat
install-setup.ps1
```

Root `Sirman_Setup_1405.5.27γ.zip` (previous kit) was **not** overwritten.

---

# 16. Package file list

```text
00_اینجا_شروع_کنید.txt
SETUP.bat
install-setup.ps1
نصب.bat
راهنمای_نصب_از_صفر.txt
راهنمای_نصب_و_آپدیت.docx
updates/Sirman_Update_1405.5.27γ.json
App/Sirman.exe
App/Sirman.dll
App/Sirman.Core.dll
App/Sirman.deps.json
App/Sirman.runtimeconfig.json
App/Sirman_Final.html
App/Sirman_Final_1405.5.27γ.html
App/Laegh_Final.html
App/SIRMAN_VERSION.json
App/Sirman_Start.bat
App/OPEN_SIRMAN.bat
App/sirman_run.ps1
App/apply_sirman_update.ps1
App/Sirman_Pending_Update.json
App/Sirman_Install_Shortcuts.ps1
App/Uninstall-Sirman.bat
App/نصب_میانبر_سیرمان.bat
App/updates/Sirman_Update_1405.5.27γ.json
App/Microsoft.Web.WebView2.Core.dll
App/Microsoft.Web.WebView2.WinForms.dll
App/Microsoft.Web.WebView2.Wpf.dll
App/WebView2Loader.dll
App/runtimes/win-x64/native/WebView2Loader.dll
App/راهنمای_نصب_از_صفر.txt
App/راهنمای_نصب_و_آپدیت.docx
```

No reports, no test logs, no `.pdb`, no source snapshots, no `Sirman_Install_Kit` / `Sirman_Windows_Install` stale trees.

Kit-local `Sirman_Pending_Update.json` / `Sirman_Update_1405.5.27γ.json` were generated from **live** `Sirman_Final.html` so first-run apply cannot roll the shop HTML back to the older γ payload. Repository copies of those JSON files were **not** modified (product/update sources left as-is).

---

# 17. Package size

```text
directory (sum of files) ≈ extracted kit
archive                 = 3369746 bytes  (3 369 746)
Sirman.exe              = 152064
Sirman_Final.html       = 1812638
Laegh_Final.html        = 1812638
```

---

# 18. SHA-256

```text
filename: Sirman_Setup_1405.5.27γ_FINAL.zip
size:     3369746
SHA-256:  fca06d019585bd186c73a4786e4bf0797f6c584796cf6afb1d84b103848e14ab

filename: App/Sirman.exe
size:     152064
SHA-256:  d50e4cba463f270f2c5756f827ea5aa38f57bb1a3da7c6cd4d589ab9de8b0ba6

filename: App/Sirman_Final.html
size:     1812638
SHA-256:  85328e7df438ef5348cf88c5f0fc72f802b6fd82760ffbf9f006882b55ea6955

filename: App/Laegh_Final.html
size:     1812638
SHA-256:  85328e7df438ef5348cf88c5f0fc72f802b6fd82760ffbf9f006882b55ea6955
```

Previous rollback zip (untouched):

```text
filename: Sirman_Setup_1405.5.27γ.zip  (repo root)
SHA-256:  96462fb717998e0c54dd774faa95d448ce7626d858ffccc03388dd75d55e3f6b
```

---

# 19. Previous rollback package

```text
NEW PACKAGE
  deliveries/Sirman_Setup_1405.5.27γ_FINAL/
  deliveries/Sirman_Setup_1405.5.27γ_FINAL.zip

PREVIOUS ROLLBACK PACKAGE
  deliveries/Sirman_Setup_1405.5.27γ/
  Sirman_Setup_1405.5.27γ.zip
  version label: 1405.5.27γ
  HTML size: 1798922  (older than B19R live 1812638)
```

Same version **number**, older product HTML (pre-B19R). Do not delete it. If shop install of FINAL fails, extract the previous zip and run `نصب.bat` from that folder.

---

# 20. Installation method

Existing supported path (unchanged):

1. Copy `Sirman_Setup_1405.5.27γ_FINAL.zip` to the shop Windows PC.
2. Extract All.
3. Double-click `نصب.bat` or `SETUP.bat` (runs `install-setup.ps1`).
4. Choose install folder (default suggestion: `Documents\Sirman`).
5. Confirm desktop shortcut.
6. Open **Sirman** from Start Menu / desktop.

Requires **.NET 8 Desktop Runtime x64** and WebView2. If `Sirman.exe` will not start, use `App\Sirman_Start.bat` or install the runtime from Microsoft.

Data is **not** inside the exe. Backup via «ورود/خروج داده» before replacing an existing install folder.

---

# 21. Package sanity checks

```text
[x] Sirman.exe exists
[x] executable is Release PE32+ GUI win-x64
[x] version is 1405.5.27γ / 1405.5.27.3
[x] Sirman_Final.html exists and matches live source
[x] Laegh_Final.html exists and matches live source
[x] HTML files match each other
[x] required runtime files exist (Sirman.Core.dll, WebView2, runtimes/win-x64)
[x] required launcher/install files exist (نصب.bat, SETUP.bat, install-setup.ps1, Sirman_Start.bat)
[x] no secrets included (no private keys/credentials; HTML contains JS parameter name apiKey only)
[x] package has no stale alpha/beta core files
[x] package timestamp reflects this build (exe mtime 1405/05/30 13:35:33 Asia/Tehran)
[x] previous γ kit / zip left intact
```

```text
Package sanity = PASS
```

---

# 22. What was NOT verified

- Live shop PC install
- Real Windows desktop launch of `Sirman.exe` (this environment is Linux; WebView2 host cannot be exercised here)
- Physical print
- Human workflow: invoice / inventory / warranty / backup on shop data
- Applying this kit over a dirty existing `Documents\Sirman` with live data

Do not treat packaging tests as shop verification.

---

# 23. Human shop verification requirement

```text
LIVE EXE / SHOP INSTALL = NEEDS HUMAN VERIFICATION
```

The user must install this FINAL zip on the shop Windows machine and confirm:

- version shown in UI is `۱۴۰۵.۵.۲۷γ`
- existing data still loads after backup
- stock display and inventory documents still work (B18/B19/B19R)
- print unchanged
- HTML-only file still opens if exe is not used

---

# 24. Final status

```text
Package build/tests = PASS
Shop install / real Windows = NOT PERFORMED
Final status = NEEDS HUMAN VERIFICATION
```

```text
STOP — FINAL PACKAGE READY FOR SHOP HUMAN VERIFICATION.
```
