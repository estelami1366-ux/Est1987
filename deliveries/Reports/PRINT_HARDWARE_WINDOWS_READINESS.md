# PRINT HARDWARE DIAGNOSTIC — WINDOWS READINESS

**Status: READY FOR REAL WINDOWS HARDWARE TEST**

This document is a **read-only verification** of the existing diagnostic harness
in Sirman **1405.5.27α**. No production print, invoice, accounting, inventory,
or warranty code was changed in this phase.

Physical printing is **not** claimed to work.

---

## Verdict

| Question | Answer |
|----------|--------|
| Can this Linux Cloud environment launch Sirman.exe? | **No** — WinExe + `Microsoft.WindowsDesktop.App` 8.0.0 is not installed for linux-x64. That is an **environment limit**, not a Windows diagnostic defect. |
| Does the shipped 1405.5.27α kit contain the diagnostic? | **Yes** (binary + HTML evidence below). |
| Can an operator run the diagnostic on a real Windows shop PC? | **Yes**, using this kit. |
| Is physical print proven? | **No. Not tested. Do not claim FIXED.** |

**STATUS: READY FOR REAL WINDOWS HARDWARE TEST**

---

## 1. Sirman.exe 1405.5.27α launch

| Check | Result | Evidence |
|-------|--------|----------|
| Kit binary exists | PASS | `deliveries/Sirman_Setup_1405.5.27α/App/Sirman.exe` — PE32+ GUI x86-64, 149504 bytes |
| Informational version | PASS | `Sirman.dll` UTF-16 string `1405.5.27α` |
| Runtime | PASS | `Sirman.runtimeconfig.json` → `Microsoft.WindowsDesktop.App` **8.0.0** (WinExe) |
| Launch on this Linux Cloud VM | NOT TESTABLE HERE | `dotnet Sirman.dll` → framework `Microsoft.WindowsDesktop.App` 8.0.0 missing for linux-x64. Expected. |
| Launch on Windows shop PC | NOT TESTABLE HERE | Operator must double-click `Sirman.exe` from the 1405.5.27α App folder after WebView2 Runtime is installed. |

This is **not** a blocker for Windows. It is a blocker for Cloud-only verification of process start.

---

## 2. `RunPrintHardwareDiagnostic` accessible

| Check | Result | Evidence |
|-------|--------|----------|
| Host method in shipped `Sirman.dll` | PASS | UTF-8 metadata contains `RunPrintHardwareDiagnostic` and `PrintHardwareDiagnostic` |
| HTML calls the host | PASS | Kit `Sirman_Final.html` contains `RunPrintHardwareDiagnostic` and `phdCall` |
| Permission gate | PASS (code review) | Catalog `AlwaysAllowed` — login does not hide hardware facts |
| Live host on this VM | NOT TESTABLE HERE | No WinForms/WebView2 process |

On Windows, Settings → تشخیص چاپگر → «تازه‌سازی / شمارش چاپگرها» exercises the host. If the message shows `NO_HOST`, the operator is running HTML without this EXE.

---

## 3. Settings → Printer Diagnostics

| Check | Result | Evidence |
|-------|--------|----------|
| Tab id | PASS | `showStgTab('print-diag')` in kit HTML |
| Panel | PASS | `#stg-print-diag`, `#print-hardware-diagnostic` |
| Title | PASS | «تشخیص سخت‌افزار چاپ» |

---

## 4. Print → Hardware Diagnostics

| Check | Result | Evidence |
|-------|--------|----------|
| WinForms menu string in `Sirman.dll` | PASS | UTF-16 «چاپ → تشخیص سخت‌افزار چاپ» (`تشخیص سخت‌افزار چاپ`) |
| Handler | PASS (code review) | `OnPrintHardwareDiagnostic` → settings + `print-diag` tab |

---

## 5. Diagnostic log path

**Exact code path (this build):**

`Environment.SpecialFolder.LocalApplicationData` + `\Sirman\print\PRINT_DIAGNOSTIC.log`

**Windows expansion:**

`%LOCALAPPDATA%\Sirman\print\PRINT_DIAGNOSTIC.log`

typically `C:\Users\<user>\AppData\Local\Sirman\print\PRINT_DIAGNOSTIC.log`

| Check | Result | Evidence |
|-------|--------|----------|
| Filename `PRINT_DIAGNOSTIC.log` in `Sirman.dll` | PASS | UTF-16 at offset 114403 |
| Written on probe | PASS (code review) | `phdRefresh` / `probe` calls `Log("PROBE", …)` before returning JSON |
| Menu «باز کردن پوشه لاگ چاپ» | PASS (code review) | Opens `AppPaths.AppDataRoot\print` (same Local folder) |

**Naming note (not a run blocker):** Windows `%AppData%` is **Roaming**. This harness writes to **Local** (`%LOCALAPPDATA%`). Look in Local, not Roaming. Backup JSON lives under Roaming `\Sirman\backup`; print diagnostic log does not.

---

## 6. Diagnostic UI — required facts

Present in kit HTML (`#phd-matrix` keys after host `matrix`, plus always-visible probe rows / action buttons):

| Required display | In 1405.5.27α kit HTML | How the operator sees it |
|------------------|------------------------|---------------------------|
| Windows printer enumeration | YES | «چاپگرهای ویندوز» + matrix «Windows Printer Enumeration» |
| Physical / Virtual classification | YES | PHYSICAL / VIRTUAL / PDF / XPS / FAX labels + «طبقه‌بندی» |
| Default printer | YES | «پیش‌فرض ویندوز» / «پیش‌فرض این فرآیند» |
| Driver | YES | «درایور» |
| Port | YES | «پورت» |
| Spooler | YES | «Spooler» |
| Direct Windows Print | YES | Button «Direct Windows Print» + matrix «Direct Print Submission» |
| Print Queue | YES | Button «VIEW STATUS» + matrix «Print Queue» |
| WebView2 Print | YES | Button «WebView2 Print» + matrix «WebView2 PrintAsync» |
| Physical Paper Verification | YES | Buttons «برگه آمد» / «برگه نیامد» + matrix «Physical Paper» |

---

## Shop PC procedure (operator)

1. Unzip `Sirman_Setup_1405.5.27α.zip`. Use **this** `App\Sirman.exe` with **this** `Sirman_Final.html`. Do not mix an older EXE.
2. Confirm WebView2 Runtime is installed (same requirement as the rest of Sirman).
3. Run `Sirman.exe`. Title / about should show **1405.5.27α**.
4. Open **تنظیمات → تشخیص چاپگر** or menu **چاپ → تشخیص سخت‌افزار چاپ…**
5. Click **تازه‌سازی / شمارش چاپگرها**. Confirm printers, PHYSICAL/VIRTUAL, default, driver, port, spooler.
6. Click **Direct Windows Print**, then **VIEW STATUS**.
7. Click **WebView2 Print**, then **VIEW STATUS**.
8. At the printer, click **برگه آمد** or **برگه نیامد**.
9. Copy `%LOCALAPPDATA%\Sirman\print\PRINT_DIAGNOSTIC.log` (or use **چاپ → باز کردن پوشه لاگ چاپ**).

Until step 8 is done on real paper, status of physical print remains **PHYSICAL_PRINT_NOT_VERIFIED**.

---

## What this phase did not do

- Did not modify production Print Center
- Did not modify `WindowsPrintHost.cs`
- Did not modify Invoice, Accounting, Inventory, or Warranty
- Did not attempt another speculative print fix
- Did not claim the printer is fixed

---

## Kit paths

- `/workspace/Sirman_Setup_1405.5.27α.zip`
- `/workspace/deliveries/Sirman_Setup_1405.5.27α/`
- Report: `/workspace/PRINT_HARDWARE_DIAGNOSTIC_REPORT.md`
- This readiness note: `/workspace/PRINT_HARDWARE_WINDOWS_READINESS.md`
