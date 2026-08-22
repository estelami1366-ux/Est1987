# SIRMAN — P0 NATIVE WINDOWS PRINT ARCHITECTURE MIGRATION REPORT

**Mode:** CONTROLLED HIGH-PRIORITY IMPLEMENTATION  
**Trigger:** Windows printer works from Windows/browser; SIRMAN production paper print failed  
**Live version:** `1405.5.27γ` (unchanged)  
**Assembly:** `1405.5.27.3` (unchanged)

```text
PRODUCT CODE CHANGED = YES (print paper path only)
INVOICE/INVENTORY/ACCOUNTING/WARRANTY BUSINESS RULES = UNCHANGED
HOST METHOD LIST = UNCHANGED
VERSION CHANGED = NO
PHYSICAL_PRINT_VERIFIED CLAIMED FROM SPOOL = NO
REMAINING DOCUMENTS AUTO-MIGRATED = NO
```

---

## 1. Jalali date

```text
1405/05/31
```

## 2. Gregorian date

```text
22 August 2026
```

## 3. Exact time

```text
18:23:50
```

## 4. Timezone

```text
Asia/Tehran (+03:30)
```

## 5. Branch

```text
cursor/p0-native-print-fa01
base: cursor/phase-3-architecture-migration-3733
```

## 6. SHA before / after

| Checkpoint | SHA | Note |
|---|---|---|
| PRINT-PRE-MIGRATION-GOOD (product) | `1fcf054` | B19R-FINAL-GOOD |
| Packaging HEAD before this work | `5f4cdd2` | shop kit pack; no product-code change |
| HEAD before this commit | `5f4cdd2` | branch start |
| PRINT-NATIVE-TEST-PAGE-GOOD | `5d79f20` | same milestone commit |
| PRINT-NATIVE-INVOICE-GOOD | `5d79f20` | same engine as test page |
| HEAD after product commit | `5d79f20` | `feat: migrate invoice and test-page paper to native PrintDocument` |

Rollback is to the immediately previous verified print checkpoint (`1fcf054` / branch `5f4cdd2`). No `git reset --hard`.

## 7. Old print architecture

```text
SIRMAN UI
  → printInv / pcDoPrint
  → HTML document (buildPH / printEnginePrintHtml)
  → sirmanHost.PrintDocument({ html })
  → IPrintService.Enqueue
  → WindowsPrintHost
  → hidden WebView2 + CoreWebView2.PrintAsync
  → Windows spooler
```

Production paper depended on HTML payload, temp HTML, WebView2, and PrintAsync.

Printer list was already native (`PrinterSettings.InstalledPrinters`). Diagnostic GDI print (`PrintHardwareDiagnostic`) stayed isolated and is not the production engine.

## 8. New print architecture

```text
SIRMAN UI
  → structured JSON (testPage | invoice)
  → sirmanHost.PrintDocument (same Host method)
  → IPrintService.EnqueueNative
  → WindowsPrintHost.EnqueueNative (Task.Run, UI not blocked)
  → NativeWindowsPrintService
  → System.Drawing.Printing.PrintDocument / PrintPage
  → Windows printer driver / spooler
  → physical printer (human-verified)
```

PDF and unmigrated documents (warranty, sale, reports) still use `Enqueue` + WebView2 PrintAsync. Success of PDF is not paper success.

## 9. Files changed

**Core**

- `desktop/Sirman.Core/Printing/IPrintService.cs` — add `EnqueueNative` (existing `Enqueue` kept)
- `desktop/Sirman.Core/Printing/NativePrintLayout.cs` — paper / orientation / copies / pagination
- `desktop/Sirman.Core/Printing/NativePrintModels.cs` — `InvoicePrintModel`, `TestPagePrintModel`, `NativePrintRequest.TryParse`
- `desktop/Sirman.Core/Printing/PrintJobIdentity.cs` — preserve `PJ-` + 12 hex
- `desktop/Sirman.Core/Printing/PrintStatusContract.cs` — map `NATIVE_PRINT_FAILED`

**Desktop**

- `desktop/Sirman.Desktop/NativeWindowsPrintService.cs` — GDI renderer
- `desktop/Sirman.Desktop/WindowsPrintHost.cs` — native enqueue on worker thread; HTML path kept for PDF/legacy
- `desktop/Sirman.Desktop/PrintServiceAdapter.cs` — wrap `EnqueueNative`
- `desktop/Sirman.Desktop/MainForm.cs` — `EnqueueNativePrint`
- `desktop/Sirman.Desktop/SirmanHostObject.cs` — `PrintDocument` routes native JSON without new Host methods

**UI**

- `Sirman_Final.html` / `Laegh_Final.html` (byte-identical)
  - `printEnginePrintNative`, `printEngineBuildInvoiceModel`, `printEngineBuildTestPageModel`, `pcDoNativeTestPage`
  - `printInv()` → native invoice
  - `expPDF()` → `printEngineSavePdf` (HTML PDF, not paper)
  - Print Center invoice paper → native model

**Tests**

- `desktop/Sirman.Core.Tests/NativePrintTests.cs`
- `desktop/Sirman.Core.Tests/PrintStatusContractTests.cs`
- `test_laegh.js`

## 10. Document types

| Document | Paper engine | Status |
|---|---|---|
| Native test page | `NativeWindowsPrintService` | Implemented; physical paper needs human |
| Invoice | `NativeWindowsPrintService` | Implemented; physical paper needs human |
| Invoice PDF | HTML `printEngineSavePdf` / PrintAsync | Separate from paper |
| Warranty | HTML / WebView2 | Deferred |
| Sale / other reports | HTML / WebView2 | Deferred |
| Diagnostic harness | `PrintHardwareDiagnostic` GDI | Unchanged; not production |

## 11. Native renderer

`NativeWindowsPrintService` uses `PrintDocument`, `PrintPage`, `Graphics`, `Font`, `Brush`, `Pen`, `RectangleF`, `StringFormat` (RTL Tahoma), `Image` for logo.

Supports: Persian/RTL, mixed Persian+Latin, invoice table, wrapping/ellipsis, pagination, logo, header/totals/signatures, paper size, landscape/portrait, copies (`PrinterSettings.Copies`), margins.

No HTML/CSS/DOM/WebView2 on this path. `StandardPrintController` (no print-preview dialog).

Test page text:

```text
SIRMAN NATIVE PRINT TEST
Printer:
Date/time:
Paper:
Orientation:

آزمایش چاپ سیرمان
SIRMAN NATIVE PRINT TEST
۱۲۳۴۵۶789
```

## 12. Printer enumeration

Unchanged native path: `PrinterSettings.InstalledPrinters` in `WindowsPrintHost.ReadPrinters`, classified with `PrintHardwareFacts` (PDF/XPS/Fax/OneNote = virtual, not paper). Selected name maps to `PrinterSettings.PrinterName`. No browser/WebView2 printer list.

## 13. Job tracking

`printJobId` remains `PJ-` + 12 hex (`PrintJobIdentity.Create()`). Invoice number is not the job id.

Spool accept status remains `PRINT_SUBMITTED`. `physicalPrintStatus` stays `PHYSICAL_PRINT_NOT_VERIFIED` unless a human confirms paper. This report does not claim `PHYSICAL_PRINT_VERIFIED`.

## 14. Automated tests

```text
node test_laegh.js Sirman_Final.html
  645 / 645 PASS, 0 FAIL

node test_laegh.js Laegh_Final.html
  645 / 645 PASS, 0 FAIL

dotnet test desktop/Sirman.Core.Tests
  179 / 179 PASS, 0 FAIL
```

Native coverage: printer physical/virtual mapping, paper/orientation, copies, invoice model parse (including swapped/logo/totals), pagination, `PJ-` job identity, validation failures (no seller, no lines, copies out of range), native payload has `engine:'native'` and no `html`.

## 15. Windows tests

```text
BLOCKED on this agent (Linux; no shop printer)
dotnet build Sirman.Desktop -p:EnableWindowsTargeting=true → 0 errors
```

Required Windows shop order (human):

1. Native test page
2. Native invoice
3. Multi-copy invoice

If step 1 fails: STOP. If invoice fails: STOP. Do not migrate remaining documents.

## 16. Physical paper result

```text
NEEDS HUMAN VERIFICATION
```

Spool `PRINT_SUBMITTED` is not paper. Shop must print the native test page, then one invoice, on the real Windows printer.

## 17. Protected-area audit

| Area | Result |
|---|---|
| Invoice business rules / calc | UNCHANGED |
| Inventory mutation | UNCHANGED |
| Accounting | UNCHANGED |
| Warranty lifecycle | UNCHANGED |
| Backup / persistence schema | UNCHANGED |
| Auth / roles | UNCHANGED |
| Host method names | UNCHANGED (`GetPrinters`, `PrintHtml`, `PrintDocument`, `GetPrintJob`) |
| Version label | UNCHANGED `1405.5.27γ` |

Renderer consumes invoice fields already produced by `getData()` / `buildPH`. It does not recompute totals or stock.

Phase 3 Change Gate historically froze the print engine; this P0 instruction is the explicit exception after shop print failure. Implementation replaces the paper engine behind the existing Host/`IPrintService` contract; it does not add a second Host or second print service.

## 18. Rollback checkpoints

```text
PRINT-PRE-MIGRATION-GOOD = 1fcf054 (product) / 5f4cdd2 (pack HEAD)
PRINT-NATIVE-TEST-PAGE-GOOD = 5d79f20
PRINT-NATIVE-INVOICE-GOOD = 5d79f20
PRINT-NATIVE-DOCUMENTS-GOOD = not reached (remaining docs deferred)
```

Rollback only to the immediately previous good print checkpoint. Never blind `git reset --hard`.

## 19. Failures / blockers

- Physical paper cannot be verified in this Linux cloud agent.
- Windows runtime print (spooler, driver, RTL on real paper) is blocked here.

No automated test failure after the PrintAsync comment false-positive in `NativeWindowsPrintService` was removed.

## 20. Deferred items

- Warranty paper
- Sale / reception / delivery / repair sheet
- Inventory / kardex / accounting reports
- Native preview
- Remaining HTML `printEnginePrintHtml` paper paths
- Multi-copy invoice shop proof (after single-copy invoice is verified)

Do not start these until native test page and native invoice are proven on Windows paper.

## 21. Final status

```text
COMPLETED (code + automated tests)
PHYSICAL PAPER: NEEDS HUMAN VERIFICATION
WINDOWS SHOP TESTS: BLOCKED / NEEDS HUMAN VERIFICATION
```

STOP. Do not auto-start remaining document types.
