# SIRMAN — P0 NATIVE PRINT SHOP PACKAGE REPORT
## Packaging only from P0 checkpoint `5d79f20`

**Mode:** PACKAGING ONLY  
**Date:** 1405/05/31 19:27:35 (Asia/Tehran, +03:30)  
**Gregorian:** 22 August 2026  
**Branch:** `cursor/p0-native-print-shop-package-fa01`  
**HEAD at packaging:** `31ebe26` (`docs: record P0 native print architecture migration`)  
**Packaging commit:** `f511203` (`pack: add 1405.5.27γ NATIVE_PRINT shop setup kit from P0 5d79f20`)  
**P0 product checkpoint:** `PRINT-NATIVE-TEST-PAGE-GOOD` / `PRINT-NATIVE-INVOICE-GOOD` = `5d79f20`  
**Live version:** `1405.5.27γ` / assembly `1405.5.27.3`

```text
PRODUCT CODE CHANGED DURING PACKAGING = NO
ARCHITECTURE CHANGED DURING PACKAGING = NO
VERSION CHANGED = NO
OLD γ KITS OVERWRITTEN = NO
PUSH TO MAIN = NO
PHYSICAL_PRINT_VERIFIED CLAIMED FROM PACKAGE = NO
```

Official packer: `scripts/pack_sirman_setup.py` + `scripts/setup-kit/*` (imported; **not edited**).  
Output names were overridden so the default `Sirman_Setup_1405.5.27γ` directory/zip were **not** deleted.

```text
KIT_NAME = Sirman_Setup_1405.5.27γ_NATIVE_PRINT
OUT_DIR  = deliveries/Sirman_Setup_1405.5.27γ_NATIVE_PRINT/
ZIP_PATH = deliveries/Sirman_Setup_1405.5.27γ_NATIVE_PRINT.zip
```

`scripts/pack_sirman_setup.py` on disk is unchanged.

---

# 1. Jalali date

```text
1405/05/31
```

---

# 2. Gregorian date

```text
22 August 2026
```

---

# 3. Exact time

```text
19:27:35
```

---

# 4. Timezone

```text
Asia/Tehran (+03:30)
```

---

# 5. Branch

```text
cursor/p0-native-print-shop-package-fa01
base lineage: cursor/p0-native-print-fa01
```

Worktree was clean before packaging. No reset / rebase / merge / cherry-pick. Product files were not modified.

---

# 6. HEAD

```text
source HEAD     31ebe26  docs: record P0 native print architecture migration
                31ebe26c25f7a3e1c6b78ef0372c6b6906231367
packaging commit f511203  pack: add 1405.5.27γ NATIVE_PRINT shop setup kit from P0 5d79f20
                f5112032bef2108284f54351de7e445a8f770043
ancestor of 5d79f20 = YES
ancestor of 1fcf054 = YES
```

Source HEAD is the P0 docs commit on top of the native-print product commit. This report records the packaging commit SHA after the kit was added. Allowed: packaging-only, no product-code change.

---

# 7. P0 checkpoint

```text
PRINT-NATIVE-TEST-PAGE-GOOD = 5d79f20
PRINT-NATIVE-INVOICE-GOOD   = 5d79f20
feat: migrate invoice and test-page paper to native PrintDocument
```

Warranty / sale / reports remain on HTML `Enqueue` + PrintAsync. Not migrated in this package.

---

# 8. Product version / assembly

Authoritative `SIRMAN_VERSION.json` (not edited):

```text
app        = 1405.5.27γ
assembly   = 1405.5.27.3
```

`desktop/Directory.Build.props`: `<Version>1405.5.27.3</Version>` / `<InformationalVersion>1405.5.27γ</InformationalVersion>`.  
Published `Sirman.dll` and `Sirman.Core.dll` contain UTF-16 `1405.5.27γ` and `1405.5.27.3`.

```text
Version gate = PASS
```

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

# 10. HTML tests

```text
node test_laegh.js Sirman_Final.html
  645 PASS / 0 FAIL

node test_laegh.js Laegh_Final.html
  645 PASS / 0 FAIL
```

P0 last-known floor was 645. Meets floor.

```text
HTML tests = PASS
```

---

# 11. Core tests

```text
dotnet test desktop/Sirman.Core.Tests
  Passed: 179  Failed: 0
```

P0 last-known floor was 179. Meets floor.

```text
Core tests = PASS
```

---

# 12. Regression

HTML + Core suites are the regression floor. Both green. No product diff during packaging.

```text
Regression = PASS
```

---

# 13. HTML synchronization

Deterministic byte compare of live sources and kit copies:

```text
live Sirman_Final.html  1822485  SHA-256 a770d02301c4ee8df5cab177af9be14b15c29b00ebcd0d99ec3ebe62dec00c62
live Laegh_Final.html   1822485  SHA-256 a770d02301c4ee8df5cab177af9be14b15c29b00ebcd0d99ec3ebe62dec00c62
kit  Sirman_Final.html  1822485  same SHA
kit  Laegh_Final.html   1822485  same SHA
identical               YES
```

```text
HTML sync = PASS
```

---

# 14. Package directory

```text
deliveries/Sirman_Setup_1405.5.27γ_NATIVE_PRINT/
```

Duplicate-safe name. Existing kits were **not** overwritten:

```text
deliveries/Sirman_Setup_1405.5.27γ_FINAL/     intact
deliveries/Sirman_Setup_1405.5.27γ_FINAL.zip  intact
Sirman_Setup_1405.5.27γ.zip (repo root)       intact
```

---

# 15. ZIP path

```text
deliveries/Sirman_Setup_1405.5.27γ_NATIVE_PRINT.zip
```

Checksum sidecar:

```text
deliveries/Sirman_Setup_1405.5.27γ_NATIVE_PRINT.sha256
```

Shop installers inside the extracted folder:

```text
نصب.bat
SETUP.bat
install-setup.ps1
NATIVE_PRINT_SHOP.txt
```

---

# 16. Package size

```text
archive           = 3395284 bytes
App/Sirman.exe    = 152064
App/Sirman.dll    = 172032
App/Sirman.Core.dll = 168960
App/Sirman_Final.html = 1822485
App/Laegh_Final.html  = 1822485
```

---

# 17. SHA-256

```text
filename: Sirman_Setup_1405.5.27γ_NATIVE_PRINT.zip
size:     3395284
SHA-256:  7aad368c0ac5f4e9cbffdc289cdd4e0a0549e0c03a479cf8bcccc4aa54d3890d

filename: App/Sirman.exe
size:     152064
SHA-256:  9091aaf093b6b2828c4fbfff70ee5df790c1246ee735692f4e4ea3acd701e0a5

filename: App/Sirman_Final.html
size:     1822485
SHA-256:  a770d02301c4ee8df5cab177af9be14b15c29b00ebcd0d99ec3ebe62dec00c62

filename: App/Laegh_Final.html
size:     1822485
SHA-256:  a770d02301c4ee8df5cab177af9be14b15c29b00ebcd0d99ec3ebe62dec00c62
```

---

# 18. Native print components present

P0 verification on this checkout (source, not modified):

```text
IPrintService.EnqueueNative              YES
WindowsPrintHost.EnqueueNative           YES
NativeWindowsPrintService                YES (Desktop)
NativePrintModels (InvoicePrintModel / TestPagePrintModel / NativePrintRequest) YES
NativePrintLayout                        YES
printEnginePrintNative                   YES
printEngineBuildInvoiceModel             YES
printEngineBuildTestPageModel            YES
pcDoNativeTestPage                       YES
printInv() → native invoice              YES
```

Renderer (Desktop `NativeWindowsPrintService`): `System.Drawing.Printing.PrintDocument`, `PrintPage`, `Graphics`, `PrinterSettings`. Invoice/test-page payload uses `engine:'native'` and does not send HTML.

Binary sanity inside the kit:

```text
App/Sirman.dll        NativeWindowsPrintService = YES
App/Sirman.dll        EnqueueNative / NativePrintLayout / InvoicePrintModel / TestPagePrintModel / NativePrintRequest = YES
App/Sirman.Core.dll   EnqueueNative / NativePrintLayout / InvoicePrintModel / TestPagePrintModel / NativePrintRequest = YES
App/Sirman_Final.html printEnginePrintNative / BuildInvoiceModel / BuildTestPageModel / pcDoNativeTestPage = YES
```

`NativeWindowsPrintService` lives in Desktop, not Core — expected.

Kit-local `App/Sirman_Pending_Update.json` and `updates/Sirman_Update_1405.5.27γ.json` were **refreshed from live HTML** so applying Pending cannot roll native print back. Repository copies of those JSON files were **not** modified (still lack `printEnginePrintNative`).

Official packer copies `Sirman_Final.html` only; `Laegh_Final.html` was copied into `App/` as a post-pack kit-local step (not a product-source change).

```text
Native print code present = YES
```

---

# 19. Rollback package

```text
NEW PACKAGE
  deliveries/Sirman_Setup_1405.5.27γ_NATIVE_PRINT/
  deliveries/Sirman_Setup_1405.5.27γ_NATIVE_PRINT.zip
  SHA-256 7aad368c0ac5f4e9cbffdc289cdd4e0a0549e0c03a479cf8bcccc4aa54d3890d

PREVIOUS KNOWN-GOOD (B19R FINAL, HTML-print engine)
  deliveries/Sirman_Setup_1405.5.27γ_FINAL.zip
  size     3369746
  SHA-256  fca06d019585bd186c73a4786e4bf0797f6c584796cf6afb1d84b103848e14ab
  HTML     1812638

OLDER γ KIT (pre-B19R HTML, do not delete)
  Sirman_Setup_1405.5.27γ.zip  (repo root)
  size     2896318
  SHA-256  96462fb717998e0c54dd774faa95d448ce7626d858ffccc03388dd75d55e3f6b
```

If native-print shop install fails, extract `Sirman_Setup_1405.5.27γ_FINAL.zip` and run `نصب.bat` from that folder. Do not delete either older kit.

---

# 20. What was not verified

- Live shop PC install
- Real Windows desktop launch of `Sirman.exe` (this environment is Linux; WebView2 host cannot be exercised here)
- Physical paper from a real Windows printer
- Human workflow: invoice / inventory / warranty / backup on shop data
- Applying this kit over a dirty existing `Documents\Sirman` with live data
- Remaining documents (warranty / sale / reports) — still HTML PrintAsync by design

Do not treat packaging tests or spool `PRINT_SUBMITTED` as physical paper.

---

# 21. Physical-print status

```text
PHYSICAL PRINT = NEEDS HUMAN VERIFICATION
```

Do not claim `PHYSICAL_PRINT_VERIFIED` from this package build.

---

# 22. Shop-test requirement

Install order (also in `NATIVE_PRINT_SHOP.txt` and `00_اینجا_شروع_کنید.txt`):

```text
1. Back up shop data («ورود/خروج داده»).
2. Extract the ZIP (Extract All).
3. Run نصب.bat or SETUP.bat.
4. Launch Sirman.
5. Verify version 1405.5.27γ / ۱۴۰۵.۵.۲۷γ.
6. Run native test page FIRST (تنظیمات ← مرکز پرینت).
7. Run native invoice SECOND.
```

If the test page fails: STOP. Do not try the invoice.  
If the invoice fails: STOP. Do not print warranty / sale / reports with the new engine.  
PDF is separate from paper.

The package is not fully verified until the Windows shop test is performed.

---

# 23. Final status

```text
Package build/tests = PASS
Native print binaries in kit = YES
Product code changed during packaging = NO
Shop install / real Windows / physical paper = NOT PERFORMED
Final status = NEEDS HUMAN VERIFICATION
```

```text
STOP — NATIVE PRINT SHOP PACKAGE READY.
```
