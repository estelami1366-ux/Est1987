# P0 PRINT CENTER OUTPUT FORENSIC

**Mode:** SOURCE + HUMAN-EVIDENCE FORENSIC ONLY  
**Product code changed:** NO  
**Fix implemented:** NO  
**NativeWindowsPrintService rewritten:** NO  
**WebView2 print path rewritten:** NO  
**IPrintService contract changed:** NO  
**Print Center changed:** NO  
**Workaround / refactor / new engine / retry loop:** NO  

**Jalali:** 1405/06/01  
**Gregorian:** 23 August 2026  
**Time:** 17:44:06  
**Timezone:** Asia/Tehran (+03:30)  

**Branch:** `cursor/p0-print-center-forensic-fa01`  
**Source HEAD at audit start:** `9afb7f7` (`9afb7f716c5d887c3d98de673733e28ea85cdcdc`)  
**P0 native-print product checkpoint:** `5d79f20`  

**Runtime on shop Windows:** NOT RUN IN THIS ENVIRONMENT (Linux cloud agent; no shop spooler, no InstalledPrinters, no physical queues).

---

## PRINT CENTER FORENSIC RESULT

```text
Branch: cursor/p0-print-center-forensic-fa01
HEAD:   9afb7f7  (source tree audited; this report commit follows)

Working printer:  Printer A = Print Center "Label Printer" (human SUCCESS)
Failing printer:  Printer B = Print Center "Main Printer" (human FAILURE)

Direct Windows Diagnostic:  SUCCESS (human) — on the printer that fails from Print Center
WebView2 Diagnostic:        SUCCESS (human)
Print Center Native:        FAILURE on Main Printer (human)
Print Center Label Printer: SUCCESS (human)

COMMON PATH:
  Print Center UI
  → pcDoPrint() / pcDoNativeTestPage()
  → printEnginePrintNative() OR printEnginePrintHtml()
  → chrome.webview.hostObjects.sync.sirmanHost.PrintDocument(JSON)
  → SirmanHostObject.PrintDocument
  → MainForm.EnqueueNativePrint OR EnqueueHtmlPrint
  → PrintServiceAdapter : IPrintService
  → WindowsPrintHost.EnqueueNative OR Enqueue
  → ResolvePrinter (InstalledPrinters, OrdinalIgnoreCase, Trim + bidi marks)
  → PrinterSettings.IsValid / Winspool.TryOpen / IsOffline
  → NativeWindowsPrintService.Submit  OR  CoreWebView2.PrintAsync
  → GDI PrintDocument.Print() / WebView2 PrintAsync
  → Windows spooler
  → job.Set(PRINT_SUBMITTED)   ← this is the Output Layer event

Working path:
  Same COMMON PATH, PrinterName = Label queue, paper token typically 80mm|label.
  Human: paper comes out.

Failing path:
  Same COMMON PATH, PrinterName = Main queue, paper token typically A4 / A4 landscape.
  Human: no usable paper. Software still reaches PRINT_SUBMITTED.

Exact divergence point:
  NOT a second print engine and NOT a Label-vs-Main C# branch.
  First proven settings split vs Windows Diagnostic Direct:
    Print Center native ALWAYS assigns
      doc.DefaultPageSettings.PaperSize = new PaperSize("SIRMAN-" + spec.Name, w, h)
      (PaperKind.Custom / RawKind 0)
    Windows Diagnostic Direct NEVER assigns PaperSize; PrintDocument keeps the
    driver's default form (usually Kind=A4 RawKind=9 on a laser).
  First printer-dependent effect after a shared identity resolve:
    Label driver accepts the constructed custom size (typical for thermal/Zebra).
    Main laser/inkjet often spool-accepts Print() then fails at driver/form/tray
    (blank, error in queue, or no paper) — which still yields PRINT_SUBMITTED.

Printer identity comparison:
  Source uses the same InstalledPrinters string on Diagnostic and Print Center.
  Exact shop strings were NOT captured in this environment.
  "Looks the same in the UI" is NOT proof of equal UTF-16 queue identity.

PrinterSettings comparison:
  Both paths set PrinterSettings.PrinterName = resolved InstalledPrinters name.
  Diagnostic Direct: no custom PaperSize / Landscape override.
  Print Center native: custom PaperSize + Landscape from paper token + Margins.

Paper settings comparison:
  UI tokens: A4 | A5 | 80mm | label | custom.
  Native parser: A5 / 80mm / label; anything else → A4 geometry (827×1169 hundredths).
  Invoice Print Center default: jobUi.paper || 'A4 landscape'.
  Diagnostic Direct: printer default paper. Diagnostic WebView2: no PageWidth/Height override.

PrintDocument result:
  PRINT_SUBMITTED is set iff Print() returns without exception.
  That implies PrintPage was invoked during Print() (GDI).
  It does NOT imply the driver finished or paper left the printer.

WebView2 result:
  Diagnostic WebView2: PrintAsync Succeeded → PRINT_SUBMITTED (human SUCCESS on paper).
  Print Center HTML path: PrintAsync Succeeded → PRINT_SUBMITTED; also forces PageWidth/Height.
  Invoice + native test page do NOT use WebView2.

Spooler/job result:
  Print Center native does NOT EnumJobs / record Win32 Job ID.
  Diagnostic Direct DOES EnumJobs after Print().
  Shop Job ID / spooler state for the failing Main job: NOT OBSERVED HERE.

Output Layer result:
  Human: PRINT_SUBMITTED on the failing Print Center Main attempt.
  Matches code: Output Layer treats host status PRINT_SUBMITTED as ok.

Meaning of PRINT_SUBMITTED:
  A) PrintDocument.Print() returned without throw  OR  WebView2 PrintAsync == Succeeded
  B) Immediate OpenPrinter/IsValid/offline checks already passed — NOT a later EnumJobs accept
  C) NOT "driver printed"
  D) NOT "job completed"
  E) NOT "physical paper printed"
  Closest: A (submit returned). Weakly not-immediately-rejected. Never E.

Root cause:
  EVIDENCE ONLY — see § Root cause (evidence only) below.
  Not proven: WebView2 engine, NativeWindowsPrintService renderer, PrintDocument class,
  or physical Main printer hardware (Diagnostic Direct SUCCESS on that printer).

Likely component requiring change:
  DO NOT IMPLEMENT
  NativeWindowsPrintService paper application (select a driver PaperSize from
  PrinterSettings.PaperSizes with matching Kind/RawKind, e.g. A4=9, instead of
  constructing "SIRMAN-*" Custom). Optionally Print Center paper-token → form mapping.
  Do not rewrite IPrintService, Host method list, or a second engine.

Product code changed: NO
Fix implemented: NO
Final status: COMPLETED (forensic; physical Job ID / exact queue strings still shop-side)

STOP — WAIT FOR REVIEW.
```

---

## 1. Human evidence (as given — not re-tested here)

| ID | Path | Result |
|---|---|---|
| A | Windows Diagnostic → Direct Windows Print | SUCCESS |
| B | Windows Diagnostic → WebView2 Print | SUCCESS |
| C | SIRMAN Print Center → Label Printer | SUCCESS |
| D | SIRMAN Print Center → Main Printer | FAILURE |
| E | SIRMAN Print Center → Native Print → Main Printer | FAILURE |
| Output Layer on failure | `PRINT_SUBMITTED` | reported |

The human conclusion is accepted as the observation set: the Main printer is not proven dead, and neither print engine is proven globally broken, because Direct Windows Print succeeds on that printer.

This agent did not reprint on the shop PC. Fields that need live `PrinterSettings` / `EnumJobs` on that PC are marked **NOT OBSERVED**.

---

## 2. Exact printers A and B (22 fields)

Shop evidence did **not** include the Windows queue strings. This table is what the **code will do** for any two physical names chosen in Print Center, plus what this environment could not read.

| # | Field | Printer A (Label, human SUCCESS) | Printer B (Main, human FAILURE) |
|---|---|---|---|
| 1 | Exact printer name | NOT OBSERVED (UI label "Label Printer" ≠ proof of queue string) | NOT OBSERVED (UI label "Main Printer" ≠ proof of queue string) |
| 2 | Windows queue name | Same as InstalledPrinters entry after Trim + U+200E/U+200F strip | Same rule |
| 3 | PrinterSettings.PrinterName | Set to resolved name (`job.Printer` / Diagnostic `printer`) | Same |
| 4 | PrinterSettings.IsValid | Must be true or host fails `PRINTER_UNAVAILABLE` before Print() | Same. Human PRINT_SUBMITTED ⇒ IsValid was true for B |
| 5 | InstalledPrinters match | OrdinalIgnoreCase after Trim/bidi | Same. No NFKC, no space collapse, no alias table |
| 6 | Default printer status | Used only if Print Center sends empty / `browser` | Same fallback |
| 7 | Driver name/version | Diagnostic can read PRINTER_INFO_2; Print Center native does not log it | NOT OBSERVED |
| 8 | Port name | Diagnostic only | NOT OBSERVED |
| 9 | PaperName assigned | Native: `"SIRMAN-" + spec.Name` (e.g. SIRMAN-label / SIRMAN-80mm) | Native: `"SIRMAN-A4"` (typical invoice) |
| 10 | PaperSize / Kind | `new PaperSize(...)` → PaperKind.Custom, RawKind 0 | Same constructor, A4 geometry |
| 11 | PaperWidth | label 394, 80mm 315 (hundredths inch) | A4 827 |
| 12 | PaperHeight | label 591, 80mm 787 | A4 1169 |
| 13 | PaperSource | **never set** (printer default tray) | **never set** |
| 14 | Orientation | From paper token / `orientation` / `landscape` | Invoice often `A4 landscape` |
| 15 | Copies | `PrinterSettings.Copies` clamped 1–20 | Same |
| 16 | Margins | Native: max(20, mm→hundredths), invoice uses model margin | Same formula |
| 17 | PrintDocument.PrinterSettings | PrinterName + Copies; PaperSize on DefaultPageSettings | Same object model |
| 18 | PrintPage executes | If PRINT_SUBMITTED after `Print()`, GDI called PrintPage during `Print()` | Same |
| 19 | Exception/error | None if PRINT_SUBMITTED | None if PRINT_SUBMITTED (failure is not a thrown GDI error) |
| 20 | Job ID | Host `printJobId` (`PJ-` + hex). Win32 job id **not** stored on this path | Same |
| 21 | Spooler status | OpenPrinter succeeded (else PRINT_SPOOLER_FAILED). EnumJobs: Diagnostic only | NOT OBSERVED for the failing job |
| 22 | Output-layer status | Human SUCCESS (paper). Layer still only knows PRINT_SUBMITTED | Human FAILURE (no paper) + PRINT_SUBMITTED |

---

## 3. Does Print Center send the same printer identity as Windows Diagnostic?

**Source answer:** it **can**, if the operator selects the same `InstalledPrinters` string.

Enumeration (Print Center and Diagnostic):

- `PrinterSettings.InstalledPrinters`
- `name.Trim().Trim('\u200e','\u200f')`
- JSON field `name` becomes `<option value="...">` in `#pc-printer`

Resolution (both):

- Trim + strip bidi marks
- `string.Equals(..., OrdinalIgnoreCase)`
- Virtual/PDF names rejected for paper print
- Empty name → default **physical** printer

**Not done on either path:**

- Unicode normalization (NFC/NFKC)
- Collapsing internal spaces
- Stripping `(redirected N)` / driver suffixes
- Mapping aliases / share names / `\\server\queue` vs local name

**Therefore:** UI caption equality is not identity. A redirected queue (`Foo (redirected 2)`), a UNC name, a trailing invisible mark that survived only on one call, or a stored `localStorage` printer that no longer equals InstalledPrinters would send a **different** `PrinterName` than Diagnostic.

**This environment did not capture the two live strings, so mismatch is NOT PROVEN and NOT DISPROVEN.**

Human pattern (Label works, Main fails, Diagnostic Direct works on Main) is **poorly explained by a global name bug** (that would fail Diagnostic too unless Diagnostic was aimed at a different queue). It is **well explained by the paper-settings split** in §4.

---

## 4. Common path vs first divergence

### 4.1 Shared UI → Host (both printers)

```text
#pc-printer  (value = InstalledPrinters name)
#pc-paper    A4 | A5 | 80mm | label | custom
#pc-orientation  portrait | landscape
pcDoPrint() / pcDoNativeTestPage()
```

`pcDoPrint()` (`Sirman_Final.html`):

- Invoice (or live invoice doc) → `printEnginePrintNative(...)` with `engine:'native'`, `delete payload.html`
- Else → `printEnginePrintHtml(...)` (WebView2 path)

`pcDoNativeTestPage()` always native (`kind:'testPage'`).

Human E isolates **native + Main**. Human C does **not** state document type. Two evidence-ranked readings:

1. **Same button, same engine, different printer** (invoice or native test on both). Then Label vs Main never take different C# classes — only `PrinterName` + paper token.
2. **Different documents:** Label job could be postal/label HTML (WebView2); Main job invoice/native. Then they split at `SirmanHostObject.PrintDocument` (`nativePaper` vs HTML).

There is **no** printer-type / capability / “label vs laser” branch in Host or `IPrintService`. Routing is document `engine`/`kind`/`html`, not queue class.

### 4.2 Host → IPrintService

`SirmanHostObject.PrintDocument` → `MainForm.EnqueueNativePrint` / `EnqueueHtmlPrint` → `PrintServiceAdapter` (`IPrintService`) → `WindowsPrintHost`.

Same adapter, same host, same resolve, same IsValid / OpenPrinter / offline gates for A and B.

### 4.3 First proven settings split (native vs Diagnostic Direct)

**Windows Diagnostic Direct** (`PrintHardwareDiagnostic.SubmitDirect`):

```text
PrintDocument
PrinterSettings.PrinterName = printer
PrintController = StandardPrintController
PrintPage = fixed SIRMAN hardware test text
PaperSize NOT assigned
Landscape NOT assigned
Margins NOT assigned
PaperSource NOT assigned
doc.Print()
job.Set(PRINT_SUBMITTED)
EnumJobs afterwards
```

**Print Center native** (`NativeWindowsPrintService.Submit`):

```text
PrintDocument
PrinterSettings.PrinterName = job.Printer
PrinterSettings.Copies = copies
DefaultPageSettings.Landscape = spec.Landscape
DefaultPageSettings.PaperSize = new PaperSize("SIRMAN-" + spec.Name, w, h)
DefaultPageSettings.Margins = constructed
PrintController = StandardPrintController
PrintPage = invoice GDI or native test page
doc.Print()
job.Set(PRINT_SUBMITTED)
NO EnumJobs
```

**Print Center / Diagnostic WebView2:**

- Diagnostic: `CreatePrintSettings()`, `PrinterName`, `Copies=1`, `Orientation=Portrait`, **no** PageWidth/Height.
- Print Center HTML: `ApplyPaper` sets PageWidth/Height (A4 8.27×11.69 in, 80mm 3.15×7.87, label 3.94×5.91) plus margins.

Human B (Diagnostic WebView2 SUCCESS on the Main printer) vs D/E (Print Center Main FAILURE) therefore also matches “Diagnostic does not force a custom form; Print Center native does.”

### 4.4 Why Label can succeed on the same native function

Thermal/Zebra drivers commonly **expect** custom `PaperSize`. Laser/PCL/PS drivers commonly require a **named form** in `PrinterSettings.PaperSizes` (A4 RawKind 9). `Print()` still returns (spooler took the EMF) → PRINT_SUBMITTED → Output Layer “ok” → no paper / error in queue.

That is a **driver reaction to settings**, not a second engine, and not proof that `PrintPage` drawing is wrong (Diagnostic Direct uses the same `PrintDocument` type successfully on Main).

---

## 5. Meaning of PRINT_SUBMITTED (mandatory)

Set in exactly these native/HTML success tails:

- `NativeWindowsPrintService`: after `doc.Print()` without exception. Message: «سند به صف چاپ ویندوز ارسال شد».
- `WindowsPrintHost` HTML: after `PrintAsync` status `Succeeded`. Message: «سند به صف چاپ ویندوز ارسال شد».
- Diagnostic Direct/WebView2: same status name; Diagnostic text says paper is **not** confirmed.

`PrintStatusContract.Normalize("PRINT_SUBMITTED")` → `SUBMITTED`.  
`PhysicalStatus` without human confirm → `PHYSICAL_PRINT_NOT_VERIFIED`.

Print Center JS (`printEngineApplyResult`): `ok = (status === 'PRINT_SUBMITTED')`. UI: «ارسال به صف چاپ انجام شد».

| Claim | PRINT_SUBMITTED means this? |
|---|---|
| A. PrintDocument submitted / PrintAsync Succeeded | **YES** — this is the event |
| B. Spooler accepted a tracked Win32 job | **NOT PROVEN** on Print Center path (no EnumJobs). OpenPrinter already succeeded earlier |
| C. Driver printed | **NO** |
| D. Job completed | **NO** (`PRINT_COMPLETED` is a different status, unused as paper proof) |
| E. Physical paper | **NO** |

**Do not interpret PRINT_SUBMITTED as physical success.** Human D+E + PRINT_SUBMITTED is consistent with GDI submit + later driver/form failure.

---

## 6. Did Label vs Main enter different branches?

| Hypothesis | Verdict |
|---|---|
| Different IPrintService implementation | NO. One `PrintServiceAdapter`. |
| Different Host | NO. One `WindowsPrintHost`. |
| Printer-type detection | NO such branch. |
| Capability detection | NO. |
| Paper configuration | YES as **data** (tokens A4 vs 80mm/label; custom vs default form). Same functions. |
| Printer-name matching rules | Same function; different `want` string. |
| Queue validation | Same IsValid/OpenPrinter/offline. Both passed if PRINT_SUBMITTED. |
| Native vs HTML dispatch | By **document** (`engine`/`kind`/`html`), not by printer. E is native. C unknown document. |
| Output-layer validation | Same: PRINT_SUBMITTED ⇒ UI success. |

---

## 7. Root cause (evidence only)

**Proven by source + human matrix:**

1. Main printer hardware and the `PrintDocument` type can produce paper (A: Diagnostic Direct SUCCESS).
2. WebView2 can produce paper on that PC (B: Diagnostic WebView2 SUCCESS).
3. Print Center can produce paper on **some** physical queue (C: Label SUCCESS).
4. Print Center native on Main does not produce paper (D/E) while still reporting PRINT_SUBMITTED.
5. Print Center native **forces a custom `PaperSize("SIRMAN-…")`**; Diagnostic Direct **does not**.
6. PRINT_SUBMITTED is “Print() / PrintAsync returned success”, not paper.

**Best-supported failure point (not a rewrite of either engine):**

```text
NativeWindowsPrintService.Submit
  after PrinterName is resolved and IsValid/OpenPrinter passed
  at DefaultPageSettings.PaperSize = new PaperSize("SIRMAN-" + spec.Name, w, h)
  then doc.Print() → PRINT_SUBMITTED
  then Windows driver/form/tray for Printer B does not emit paper
```

**Not proven (must not be claimed as fact):**

- Exact UTF-16 names of A and B
- That Print Center sent a different queue than Diagnostic for B
- Win32 Job ID / JOB_STATUS_* for the failing job
- Which `#pc-paper` token was selected on the failing click
- That PrintPage drawing of the invoice is the reason Diagnostic text works and invoice does not (E is native **test page** too — same Submit() paper logic, simpler drawing)

**Rejected as sole cause by human A/B:** “WebView2 is broken”, “NativeWindowsPrintService cannot print”, “PrintDocument cannot print”, “Main printer is dead”.

---

## 8. Likely component requiring change (DO NOT IMPLEMENT)

1. **`NativeWindowsPrintService` paper application only** — pick `PaperSize` from `doc.PrinterSettings.PaperSizes` (match Kind/RawKind/name) instead of always constructing Custom `SIRMAN-*`. Fall back to printer default when A4 exists, as Diagnostic Direct already does by omission.
2. **Print Center paper token → Windows form mapping** — ensure invoice A4 uses the driver A4 form; keep custom sizes for 80mm/label where those drivers need them.
3. **Do not** add a second Host, second IPrintService, retry loop, or WebView2 rewrite. Diagnostic already shows both engines can print on the Main printer when paper is left default.

No patch in this task.

---

## 9. What this forensic did not run

- Shop `Sirman.exe`
- `PrinterSettings.InstalledPrinters` dump
- Byte-level compare of Diagnostic vs Print Center `PrinterName`
- `EnumJobs` on the failing queue
- Driver/port from `PRINTER_INFO_2` for A and B
- Physical paper (this VM)

Those remain shop-side if a reviewer wants the last identity proof. They are not required to justify **stopping without a code change**.

---

## 10. Final status

```text
Forensic source trace: COMPLETED
Shop runtime capture:  NOT OBSERVED (Linux agent)
Product code changed:  NO
Fix implemented:       NO
Final status:          COMPLETED
```

```text
STOP — WAIT FOR REVIEW.
```
