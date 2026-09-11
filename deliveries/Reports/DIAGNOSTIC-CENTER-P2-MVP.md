# SIRMAN — Diagnostic Center P2
## Native Diagnostic Center MVP (Guidance + WinForms)

**Date:** 1405/06/20 (2026-09-11)  
**Product:** SIRMAN `1405.6.16α` / assembly `1405.6.16.1` (unchanged)  
**Branch:** `cursor/diagnostic-center-p2-mvp-fa01`  
**Base:** `cursor/diagnostic-center-p1-runbusiness-fa01` (P1 complete)  
**Mode:** Limited operational MVP — Core guidance + native WinForms center  
**Verdict:** **COMPLETED — DIAGNOSTIC P2 MVP**

`SIRMAN_WORKING_RULES.md` is not in the repository. This packet followed `docs/ARCHITECTURE_RULES.md`, `docs/DEVELOPMENT_GOVERNANCE.md`, and `.agents/skills/laegh-software-workflow/SKILL.md`.

HTML was **not** modified. Inventory / Invoice / Sales / Warranty / Accounts / Services / Backup / Phonebook / Restore / Print algorithms were **not** modified. `SafeError.Json` still returns exactly `{ok, error, message}`. P1 `diagnostic` wire still has the same nine fields. No SQLite, no shop data, no new persistence.

---

## 1. Existing path used (no new architecture)

```text
Help menu / Host OpenDiagnosticCenter()
  → MainForm.RequestOpenDiagnosticCenter()
  → DiagnosticCenterForm (WinForms, display only)
       ListRecent(query)          → IDiagnosticStore.QueryRecentAsync
       LoadIncident(correlationId) → GetByCorrelation + GuidanceEngine
       ExportIncident(correlationId) → existing JSONL export
```

Native UI exists on Desktop (`MainForm` MenuStrip), same pattern as print hardware diagnostic. No HTML page, no Blazor, no second Host object.

---

## 2. Core guidance

`GuidanceCatalog.For(code, correlationId, impact, timestamp, module)` projects `ErrorCatalog` into `GuidanceView`:

- `title`, `userMessage`, `why`, `impact`, `nextAction`, `supportAction`
- plus `code`, `correlationId`, `severity`, `module`, `timestamp`

`SYS-HOST-UNSCOPED` has complete Persian operator copy. `correlationId` is visible on the view and appended to `supportAction`. `DeveloperDetail` is not copied into `GuidanceView`. Aliases (`business-failed`, …) still resolve to the same code.

`GetDiagnosticIncident` JSON adds additive `guidance` and **keeps** `incident` / `result` / `events`. Typed helpers `ListRecent` / `LoadIncident` / `ExportIncident` are Desktop-only consumers of the same store.

---

## 3. Native Diagnostic Center

`DiagnosticCenterForm`:

1. List of recent events (limit 100)
2. Minimum severity filter (`DiagnosticQuery.MinSeverity`)
3. Selected detail: time, severity, module, code, correlationId, userMessage, why, impact, nextAction, supportAction
4. Export Diagnostic Report (existing `ExportIncident`; folder shown as `diagnostics/support`, no absolute path)

The Form calls `DiagnosticRuntime.Facade` only. No `ErrorCatalog`, no classification, no JSONL writes.

Host `OpenDiagnosticCenter()` is a void opener. HTML does not call it.

---

## 4. Exact files changed

**Added**

- `desktop/Sirman.Core/Diagnostics/GuidanceCatalog.cs`
- `desktop/Sirman.Desktop/DiagnosticCenterForm.cs`
- `desktop/Sirman.Core.Tests/DiagnosticCenterP2Tests.cs`
- `deliveries/Reports/DIAGNOSTIC-CENTER-P2-MVP.md`

**Modified**

- `desktop/Sirman.Core/Diagnostics/DiagnosticFacade.cs` — additive `guidance` JSON + typed helpers
- `desktop/Sirman.Core/Diagnostics/DiagnosticModels.cs` — `GuidanceView` / `DiagnosticIncidentView`
- `desktop/Sirman.Core/Diagnostics/ErrorCatalog.cs` — SYS-HOST-UNSCOPED operator copy
- `desktop/Sirman.Core/Diagnostics/GuidanceEngine.cs` — `ToGuidance`
- `desktop/Sirman.Core/Security/PermissionCatalog.cs` — AlwaysAllowed `OpenDiagnosticCenter`
- `desktop/Sirman.Desktop/MainForm.cs` — Help menu + `RequestOpenDiagnosticCenter`
- `desktop/Sirman.Desktop/SirmanHostObject.cs` — `OpenDiagnosticCenter()`
- `docs/ARCHITECTURE_RULES.md` — §4.1 Host allow-list

**Not modified**

- `Sirman_Final.html`, `Laegh_Final.html`, `test_laegh.js`
- `SIRMAN_VERSION.json`
- Inventory / Invoice / Sales / Warranty / Payment / Print / Backup / Phonebook sources
- `SafeError.cs`, `BusinessFacade.cs`, `DiagnosticEnvelope.cs`
- P0 JSONL store contract / P1 RunBusiness wire

---

## 5. Tests

`desktop/Sirman.Core.Tests/DiagnosticCenterP2Tests.cs`:

1. SYS-HOST-UNSCOPED guidance complete + correlationId + deterministic + no secrets
2. Alias `business-failed` maps to SYS-HOST-UNSCOPED
3. `minSeverity` query filters
4. `LoadIncident` returns P1 `result` and P2 `guidance`
5. JSON `guidance` additive; `result` kept
6. Export still has `folder`, no `path`
7. P1 RunBusiness `diagnostic` nine-field shape unchanged
8. Form uses Facade not catalog; HTML has no OpenDiagnosticCenter / GuidanceCatalog

Official suites:

- `dotnet test desktop/Sirman.Core.Tests` — **900 passed / 0 failed** (8 new P2; P1 baseline was 892)
- `node test_laegh.js Sirman_Final.html` — **1118 passed / 0 failed** (HTML unchanged)
- `dotnet build desktop/Sirman.Desktop` — succeeded

---

## 6. Known limitations

- HTML still does not render diagnostic blocks and does not open the native center
- Codes remain unscoped `SYS-*` (no INV/SAL/WAR numeric codes)
- List is recent events, not a separate incident index
- Export MessageBox shows `fileName` + `diagnostics/support`, not an absolute path
- Native form compiled on this Linux agent; not GUI-tested on a shop Windows box
- Help-menu opener is AlwaysAllowed; JSON query/export Host methods still require `Audit.View`
- `ReportUiFault` / `window.onerror` forwarding was **not** done in this packet (P1 leftover, out of P2 native-center scope)

---

### Phase 3 change-gate (this packet)

```text
Requested change: Diagnostic P2 MVP — Core guidance + native WinForms center
Classification: diagnostics P2 / MVP
RunBusiness touched: NO
Persistence touched: NO (reads existing diagnostics/events.jsonl; export folder unchanged)
Backup schema / Print / business algorithms: NO
HTML-only preserved: YES (file unchanged)
New transport / new DB / new Host object: NO (one method on existing sirmanHost)
Result: PASS — explicit P2 request after completed P0+P1
```

**COMPLETED — DIAGNOSTIC P2 MVP**
