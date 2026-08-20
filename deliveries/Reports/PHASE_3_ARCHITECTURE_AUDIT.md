# SIRMAN — PHASE 3 ARCHITECTURE AUDIT

**Date:** 1405/05/29 (20 August 2026)  
**Scope:** Audit only. Source code is the authority.  
**Code modified:** NO  
**Phase 3 implementation:** NOT STARTED  

---

## 1. EXECUTIVE SUMMARY

SIRMAN is a **WinForms + WebView2 shell** around a **~28k-line single HTML application**. Phase 2 extracted a **net8.0 class library** (`Sirman.Core`) for security, some business calculations, and a print **contract**. Persistence is still **browser `localStorage` / IndexedDB**. There is **no SQL database, no REST business API, no `.sln`**.

Production paper print is **not** `window.print()` on the main path. It is: HTML document → Host `PrintHtml`/`PrintDocument` → `IPrintService` → `WindowsPrintHost` → **WebView2 `PrintAsync`** to a Windows printer. That still **depends on HTML rendering and WebView2/Edge runtime**. A separate diagnostic path uses GDI (`StandardPrintController`). Physical paper is **not verified** in this repo.

The long-term target of “logic independent of Chrome/HTML” is **not** the current runtime. Starting a rewrite now would violate frozen print and locked invoice/inventory/warranty/backup cores.

---

## 2. PROJECT STRUCTURE

No solution file (`.sln`). Live projects:

| Project | Type | TFM | Role |
|---|---|---|---|
| `desktop/Sirman.Desktop/Sirman.Desktop.csproj` | WinExe | `net8.0-windows` | `Sirman.exe` — WebView2, Host Object, print host, notify, update |
| `desktop/Sirman.Core/Sirman.Core.csproj` | Class lib | `net8.0` | Security, Business, Domain contracts, print **interfaces**, JSON merge adapter |
| `desktop/Sirman.Core.Tests/Sirman.Core.Tests.csproj` | xUnit | `net8.0` | Tests Core only (not Desktop/WebView) |

Copies (not the live graph): `Sirman_Install_Kit`, `Sirman_Windows_Install`, `deliveries/...`.

UI “project”: **`Sirman_Final.html`** (synced `Laegh_Final.html`). Not a csproj.

NuGet: Desktop → `Microsoft.Web.WebView2` 1.0.2903.40. Core: **no packages**. Tests: xUnit.

Print: **no separate print project**. Contract in Core; engine in Desktop.

Dependency map:

```text
Sirman.Desktop     -->  Sirman.Core
Sirman.Core.Tests  -->  Sirman.Core
Sirman.Core        -->  (none)
```

---

## 3. DEPENDENCY GRAPH

Circular project refs: **none**.

| Edge | Mark | Why |
|---|---|---|
| Desktop → Core | SAFE | One-way; Core is net8.0, no WinForms |
| Tests → Core | SAFE | No Desktop reference |
| HTML JS → `sirmanHost` | QUESTIONABLE | Presentation calling Application/Infrastructure through COM Host |
| HTML JS → `localStorage` | ARCHITECTURALLY WRONG vs target | UI owns the database |
| HTML JS → `printEngine*` then Host print | QUESTIONABLE | UI formats HTML; engine is WebView2 |
| Core Business → UI | SAFE (compile) | No UI refs; persist is JSON merge only |
| Core `IPrintService` → WebView | SAFE at compile | Interface only; impl in Desktop |
| Desktop `WindowsPrintHost` → WebView2 | QUESTIONABLE vs target | Print engine cannot run without Chromium runtime |
| HTML-only path (no EXE) | ARCHITECTURALLY WRONG vs target | Same UI runs without Core; JS fallbacks |

---

## 4. UI / HTML / WEBVIEW AUDIT

| FILE | LOCATION | PURPOSE | DEPS | RISK |
|---|---|---|---|---|
| `Sirman_Final.html` | entire file | All screens, forms, backup, most business | localStorage, IndexedDB, JS | CRITICAL: app is the HTML |
| `desktop/Sirman.Desktop/MainForm.cs` ~20, 505–581 | `WebView2`, `EnsureCoreWebView2Async`, `Navigate(html)` | Hosts UI | Edge WebView2 Runtime | CRITICAL: EXE is a browser chrome |
| `MainForm.cs` ~518 | `AddHostObjectToScript("sirmanHost")` | JS → .NET | COM `[ComVisible]` | HIGH: all Core entry |
| `MainForm.cs` ~521, ~859+ | `WebMessageReceived` / `postMessage` | .NET ↔ JS (notify, close) | WebView2 | MEDIUM |
| `SirmanHostObject.cs` | `[ComVisible(true)]` | Bridge | COM | HIGH |
| `Sirman_Final.html` `getSirmanHostSync` ~8171 | JS Host lookup | Optional Core | chrome.webview | HIGH if missing → HTML-only |
| `printEnginePrintHtml` ~24153 | Print from UI | Host PrintDocument/PrintHtml | WebView2 on C# side | HIGH |
| `previewPrintSettings` ~23712–23750 | Preview popup | **`window.print()`** | Browser print dialog | HIGH: PDF dialog |
| `_printTable` ~11877–11880 | List print fallback | `w.print()` if engine missing | Browser | MEDIUM |
| `printEngineOpenWindow` ~24060 | Legacy popup print | `w.print()` | Browser | MEDIUM (not main `pcDoPrint`) |
| `#pc-preview-frame` iframe | Print Center preview | HTML preview | iframe | LOW |
| Print CSS `@page` / templates | Layout | HTML/CSS | MEDIUM for print fidelity |
| `runBusinessCore` (~39 call sites) | JS → `RunBusiness` | Core if EXE | PARTIAL; JS still has fallbacks |
| `sw.js` | PWA/SW task notify | Browser SW | LOW for desktop EXE |

No Blazor, no WPF XAML UI, no WinUI screens. Chromium is **WebView2 (Edge runtime)**, not a Chrome process you launch.

---

## 5. PRINT ARCHITECTURE

**Actual pipeline (paper, EXE):**

```text
User: Print Center / printEnginePrintHtml / openFreshPrintWindow
  → JS wraps HTML, rejects PDF printer names
  → sirmanHost.PrintHtml / PrintDocument  (SirmanHostObject.cs ~332, ~348)
  → MainForm.EnqueueHtmlPrint
  → IPrintService.Enqueue  (PrintServiceAdapter)
  → WindowsPrintHost.Enqueue
  → write temp .html → hidden WebView2 Navigate
  → CoreWebView2.PrintAsync(PrinterName, paper, copies)
  → Windows spooler
  → physical printer  (UNVERIFIED)
```

Answers:

1. Start: HTML (`pcDoPrint`, `printEnginePrintHtml`, invoice/warranty print buttons).
2. Receiver: `SirmanHostObject.PrintHtml` / `PrintDocument`.
3. Interface: `Sirman.Core.Printing.IPrintService`.
4. Implementation: `WindowsPrintHost` via `PrintServiceAdapter`.
5. Depends on HTML? **Yes** — payload is an HTML document.
6. Depends on WebView2? **Yes** for production (`PrintAsync`). Diagnostic also has GDI.
7. Chrome/Edge? **Edge WebView2 Runtime**, not Chrome UI.
8. JavaScript? **Yes** to start and format; C# after Host. Without Host → `NO_HOST` (main path does **not** silently `window.print()`).
9. Windows APIs? **Yes**: `PrinterSettings`, `winspool.drv` OpenPrinter, and WebView2 print. Diagnostic: `StandardPrintController` + more spooler P/Invoke.
10. Without UI form? **No** — `WindowsPrintHost` needs a WinForms `Control` for `BeginInvoke`.
11. Without a browser engine? Production paper path **no**. Diagnostic Direct Print **yes** (GDI test page, not invoices).
12. Independent tests? **Contract/facts in Core.Tests**. `WindowsPrintHost` / WebView2 **not** unit-tested here (Linux CI cannot print).

Printer-specific: `WindowsPrintHost.IsVirtualPrinter` / `PrinterKind`; HTML `printEngineIsPdfPrinter`; `PrintHardwareFacts`; `PrintHardwareDiagnostic`.

PDF is a **separate** `purpose=pdf` → status `PDF_EXPORTED`, not paper.

---

## 6. DATABASE / DATA ACCESS

- Technology: **none**. No SQLite, EF, SQL Client, Mongo.
- Store: `localStorage` keys (`li`, `lp`, `lv`, `lb`, `laegh_tasks`, …) + IndexedDB (`laegh-tasks-db`, full-app cache).
- Core adapter: `CurrentJsonStore` — merge JSON objects; **does not persist**.
- `CurrentStorage.Kind = "html-localStorage-indexeddb"`.
- ORM / SQL / transactions: **absent**.
- UI coupled to “database”: **yes** — the UI **is** the store.
- Backup: JSON export/import **inside HTML**; Host only `WriteBackupText` / AppData folder, not a Backup Engine DB.

---

## 7. BUSINESS LOGIC

| Area | Where it actually lives |
|---|---|
| Invoice close/validate, pricing (partial) | Core `InvoiceService`, `InvoicePricing` **and** large JS invoice module |
| Inventory reserve/consume | Core `InventoryCore` **if** `runBusinessCore`; else JS |
| Payments / reversal | Core `PaymentRules`, `TransactionReversal` + JS accounts |
| Warranty / SLA / repair | Core `WarrantyWorkflow`, `ServiceRepairWorkflow` + large JS warranty wizard |
| Users / login / pages | HTML `ROLE_CATALOG` + Core `AuthenticationService` / `AuthorizationService` on EXE bind |
| Tasks / notify | HTML only |
| Dashboard daily brief | HTML only |
| Backup merge/replace | HTML only |
| Print templates | HTML |

Pattern: **EXE prefers C# via `RunBusiness`; HTML-only uses JS.** Dual implementation is the real architecture, not Clean Domain.

---

## 8. WINDOWS / SYSTEM INTEGRATION

| Integration | Owner |
|---|---|
| WebView2 / Edge runtime | Desktop `MainForm` |
| Host Object COM | `SirmanHostObject` |
| Printing / spooler / winspool | `WindowsPrintHost`, `PrintHardwareDiagnostic` |
| DWM Mica / caption | `MainForm` `dwmapi.dll` |
| NotifyIcon + HttpListener toasts | `NotifyBridgeService` |
| Mutex single-instance | `Program.cs` |
| AppData `Sirman\` prefs, backup, print logs | Desktop |
| File workspace UNC | Host `ReadWorkspaceFile` / `WriteWorkspaceFile` |
| Update HTML patches | `UpdateService` |
| Install/shortcuts | `InstallService` |
| Registry (service probe) | `PrintHardwareDiagnostic` advapi32 |
| Tray in BAT launcher | `sirman_run.ps1` NotifyIcon |
| No Windows Service project | — |

---

## 9. NETWORK / IPC

| PORT | PROTOCOL | OWNER | PURPOSE | CLIENT | SERVER | LIFETIME |
|---|---|---|---|---|---|---|
| 8766 (+ scan +20) | HTTP loopback | `NotifyBridgeService` in EXE | `/notify`, `/health` toasts | HTML `fetch` | EXE | While EXE runs |
| 8765 | HTTP file server | `sirman_run.ps1` TcpListener | Serve HTML + `/health` + `/sirman-net.json` | Browser | BAT launcher | While BAT runs |
| 8765 LAN `0.0.0.0` | HTTP | same PS1 if `SIRMAN_LAN=1` | Share UI file, not CRUD | Other PCs | launcher | Session |
| WebView2 Host Object | COM in-proc | EXE | Business/print/auth | JS | `sirmanHost` | EXE |
| `postMessage` | WebView2 | EXE | notify/close | JS | MainForm | EXE |

**No** REST CRUD, WebSocket business API, named pipes, or ASP.NET. `businessApi:false` in network info.

---

## 10. ARCHITECTURAL VIOLATIONS

Relative to the desired UI → Application → Domain / Infrastructure:

- **UI → Database:** HTML writes `localStorage` directly.
- **UI → Business rules:** Most workflows still in JS; Core is partial.
- **UI → Printer API:** Indirect via Host (better), but UI still builds HTML and chooses printer. Preview still `window.print()`.
- **Application → HTML rendering:** Print engine navigates HTML in WebView2.
- **Core functionality requiring WebView:** Entire product UI + production print.
- **Domain → UI:** Not at compile time; runtime truth often still JS.
- **Documented exception:** Architecture rules **forbid** REST/SQL this phase and **freeze print**. Those are intentional, not accidents.

---

## 11. ACTUAL ARCHITECTURE DIAGRAM

```text
                    [Shop user]
                         |
          +--------------+------------------+
          |                                 |
   [Sirman.exe WinForms]            [Chrome/BAT :8765]
          |                                 |
          v                                 v
   [WebView2 / Edge]                 [Same Sirman_Final.html]
          |                                 |
          +-------- Sirman_Final.html ------+
                    |     |     |
                    |     |     +--> localStorage / IndexedDB   (data)
                    |     +--------> JS business (fallback)
                    +--------------> printEngine* (format HTML)
                         |
            chrome.webview.hostObjects.sync.sirmanHost
                         |
                         v
              [SirmanHostObject] ---- RunBusiness ----> [Sirman.Core]
                         |                                 |
                         |                                 + Business/*
                         |                                 + Security/*
                         |                                 + CurrentJsonStore (no DB)
                         |
           +-------------+--------------+
           |                            |
    [IPrintService]              [NotifyBridge :8766]
           |                     [AppData files]
    [WindowsPrintHost]
           |
           +--> temp HTML --> hidden WebView2.PrintAsync --> spooler
           |
    [PrintHardwareDiagnostic] --> GDI StandardPrintController (test page only)
```

---

## 12. TARGET GAP ANALYSIS

Desired target:

```text
Presentation
     |
     v
Application
     |
     v
Domain
     ^
     |
Infrastructure
     |
     +---- Database
     +---- Windows
     +---- Printing
     +---- Network
```

**Already satisfies (partial):**

- Core library without Windows.
- `IPrintService` boundary; PDF ≠ paper in contract.
- Host Object as the only allowed JS→.NET business path.
- No SQL/REST (matches current SIRMAN rules, not a future DB).
- Security services in Core.

**Partial:**

- Dual JS/C# business.
- Print isolated as a **module**, not independent of WebView/HTML.

**Must change for the audit target (not for shop Phase 3 features):**

- Move persistence out of HTML.
- Stop depending on WebView2 for paper (or accept WebView as presentation-only and keep frozen print).
- Remove JS as source of truth.

**Must NOT change now:**

- Frozen print (`WindowsPrintHost`, `IPrintService`, Host print methods).
- Locked invoice / inventory / accounting / warranty / backup.
- Split of `Sirman_Final.html` into a SPA framework.
- New parallel PrintService / REST / SQL.

**Dangerous now:**

- “Migrate off HTML” rewrite.
- Replacing `PrintAsync` with `PrintToPdfAsync`/`ShowPrintUI`.
- Touching print while physical print is unverified.

---

## 13. PRINT ISOLATION VERIFICATION

**Verdict: PARTIAL** (not PASS, not FAIL)

Evidence for isolation:

- `IPrintService` in Core; adapter wraps existing host.
- Invoice/inventory/accounting code does not call spooler.
- `RunPrintHardwareDiagnostic` is a separate class; `WindowsPrintHost` has no diagnostic method.
- PDF purpose ≠ paper status.
- Main `pcDoPrint` refuses PDF printer names.

Evidence against full isolation / “no browser”:

- Production print **is** HTML + **WebView2.PrintAsync**.
- Host still named `PrintHtml`.
- UI still owns templates and printer combo.
- Preview/`window.print` remains.
- Engine needs a Form + WebView2.

**PHYSICAL PRINT = NOT VERIFIED**

Only compile/unit tests and a human “برگه آمد” flag in the diagnostic harness. This Linux environment never saw paper. Code defaults `PHYSICAL_PRINT_NOT_VERIFIED`.

---

## 14. RISK REGISTER

| ID | Level | Finding |
|---|---|---|
| R1 | CRITICAL | Product logic and data live in HTML/JS + localStorage |
| R2 | CRITICAL | EXE cannot run the product without WebView2/HTML |
| R3 | HIGH | Production print depends on WebView2 HTML rendering |
| R4 | HIGH | Dual JS/C# business → drift |
| R5 | HIGH | HTML-only / BAT/browser path: no Host → no physical print (`NO_HOST`) |
| R6 | HIGH | Remaining `window.print()` preview → “only PDF” reports |
| R7 | MEDIUM | Notify HTTP 8766 is a second channel beside Host.Notify |
| R8 | MEDIUM | No Desktop/WebView automated tests |
| R9 | MEDIUM | Duplicate csproj copies in kits can diverge |
| R10 | LOW | No .sln (tooling inconvenience) |
| R11 | LOW | LAN file server is not encrypted |

No circular csproj dependencies.

---

## 15. PHASE 3 RECOMMENDATION

**Do not start** an architecture migration that removes HTML/WebView or rewrites print.

If “Phase 3” means **shop features** (as in prior SIRMAN phases): continue **outside** locked cores and frozen print; confirm print on the Windows PC with EXE vs browser tests.

If “Phase 3” means **this audit’s target architecture**: treat it as a **later, explicitly authorized program**, after:

1. Physical print verification on shop hardware.
2. A persistence design that does not break HTML-only open.
3. One source of truth for invoice/inventory (not a second system).

Immediate safe work: none of print/C# freeze; diagnostics stay observational.

---

## 16. FILES THAT MUST BE INSPECTED BEFORE ANY CODE CHANGE

- `docs/ARCHITECTURE_RULES.md`
- `docs/DEVELOPMENT_GOVERNANCE.md`
- `docs/PRINT_MODULE_BASELINE.md`
- `docs/STABLE_BASELINE.md`
- `Sirman_Final.html` (printEngine*, localStorage, `runBusinessCore`)
- `desktop/Sirman.Desktop/MainForm.cs`
- `desktop/Sirman.Desktop/SirmanHostObject.cs`
- `desktop/Sirman.Desktop/WindowsPrintHost.cs`
- `desktop/Sirman.Desktop/PrintServiceAdapter.cs`
- `desktop/Sirman.Desktop/PrintHardwareDiagnostic.cs`
- `desktop/Sirman.Core/Printing/IPrintService.cs`
- `desktop/Sirman.Core/Application/BusinessFacade.cs`
- `desktop/Sirman.Core/Data/CurrentStorage.cs`
- `desktop/Sirman.Core/Business/*`
- `test_laegh.js`
- `sirman_run.ps1` / `NotifyBridgeService.cs`

---

## VERDICT

```text
ARCHITECTURE AUDIT = COMPLETE

CODE MODIFIED = NO

PHASE 3 IMPLEMENTATION = NOT STARTED

PRINT ISOLATION = PARTIAL

PHYSICAL PRINT = NOT VERIFIED

ARCHITECTURAL MIGRATION = NOT READY
```
