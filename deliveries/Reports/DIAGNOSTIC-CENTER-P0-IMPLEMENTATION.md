# SIRMAN — Diagnostic Center P0 Implementation

**Date:** 1405/06/20 (2026-09-11)  
**Product:** SIRMAN `1405.6.16α` / assembly `1405.6.16.1` (unchanged)  
**Branch:** `cursor/diagnostic-center-p0-fa01`  
**Base:** `cursor/diagnostic-reporting-center-architecture-fa01` @ `0ab867e`  
**Mode:** P0 infrastructure only — no diagnostic UI, no business wiring  
**Verdict:** **COMPLETED — DIAGNOSTIC CENTER P0**

HTML (`Sirman_Final.html`, `Laegh_Final.html`) was **not modified**. Print, Backup/Recovery, Inventory, Sales, Invoice, Warranty, Phonebook, and Restore algorithms were not modified. Version was not bumped. No SQLite, no shop data, no localStorage/IndexedDB changes.

---

## 1. Contracts created

Core namespace `Sirman.Core.Diagnostics`:

| Contract | Role |
|---|---|
| `DiagnosticEvent` | One append-only JSONL record with stable `code` |
| `Incident` | Projection from events that share a `correlationId` |
| `DiagnosticContext` | Capture-time context (module, operation, versions, OS) |
| `ErrorDefinition` | Compiled catalog row |
| `GuidanceRule` / `DiagnosticResult` | Catalog-only five-block guidance |
| `DiagnosticQuery` / `DiagnosticExportResult` | Query + export DTOs |
| `IDiagnosticStore` | `TryAppend` / `AppendAsync` / `QueryRecentAsync` / `GetByCorrelationIdAsync` / `ExportIncidentAsync` |
| `CorrelationId` | `C-` + 32 hex |
| Enums | `DiagnosticSeverity`, `DiagnosticModule`, `IncidentStatus`, `OperationOutcome`, `DataImpact`, `MetadataClass`, `DiagnosticSource` |
| `DiagnosticCodeNamespaces` | Reserved `INV` `SAL` `WAR` `PRN` `DAT` `SYS` |

No extra layers (no repository, no message bus, no HTTP).

P0 catalog codes (unscoped only; **no** final INV/SAL/WAR numeric codes):

- `SYS-DESK-UNSCOPED`
- `SYS-HOST-UNSCOPED`
- `SYS-WEBVIEW-UNSCOPED`
- `SYS-UI-UNSCOPED` (reserved for P2 UI faults)

Legacy aliases (`business-failed`, `webview2-failed`, …) map to those rows. They do not replace `SafeError` slugs on the wire.

---

## 2. Core design

```text
HTML (unchanged)  →  sirmanHost  →  DiagnosticRuntime / DiagnosticFacade
                                      →  DiagnosticService
                                      →  FileDiagnosticStore (JSONL)
                                      →  ErrorCatalog + GuidanceEngine
```

- Classification, catalog, guidance, sanitization, correlation, query, and export **content** live in Core.
- Desktop owns process/WebView2 hooks, AppData paths, and calling Core `TryRecordException`.
- Host passes JSON only. The COM object has no catalog.
- Diagnostics never throw into business/UI (`TryAppend`, `DiagnosticRuntime.Publish` swallows store failures).
- `SafeError.Json` remains `{ok, error, message}` only. Host catches still return that envelope **and** append a diagnostic event.

`FileDiagnosticStore` lives in Core (same pattern as print `DiagnosticHistoryStore`) so `Sirman.Core.Tests` can cover JSONL without WinForms.

---

## 3. Desktop store

Root: `%LocalAppData%\Sirman` (`AppPaths.AppDataRoot`).

| Path | Owner |
|---|---|
| `diagnostics/history.jsonl` | Print only — **not opened, not rotated** |
| `diagnostics/events.jsonl` | P0 general diagnostic log |
| `diagnostics/events.jsonl.1` … `.3` | Rotated copies |
| `diagnostics/support/SIRMAN-C-….json` | Export packs (not source of truth) |

`DiagnosticRuntime` constructs the store once per process. Write failure does not change Host/UI behavior.

---

## 4. JSONL format

- UTF-8 **without BOM**, one JSON object per line, append-only.
- CamelCase properties + camelCase string enums.
- Required identity: `eventId`, `correlationId`, `timestampUtc`, `code`.
- Malformed historical lines are skipped. The first corrupt read copies `events.jsonl.corrupt-preserved` once (print-store pattern) and does not rewrite the live file.
- Restart-safe: a new `FileDiagnosticStore` on the same AppData root reads current + rotated files.

Incident reconstruction: `GetByCorrelationId` returns chronological events; `IncidentProjector` derives status/code/severity/module/`eventCount`/`lastEventId`. Events are not duplicated into a second incident file. Full business objects are not stored.

---

## 5. Rotation policy

Rotate **current** `events.jsonl` when:

- size ≥ 8 MiB, **or**
- non-empty line count ≥ 20_000

Keep `.1` `.2` `.3` (rename, bodies not rewritten). Oldest `.3` is deleted. Print `history.jsonl` is never rotated by this code.

Tests inject smaller caps via constructor (`rotateMaxLines` / `rotateBytes`) so rotation is proven without writing 8 MiB.

---

## 6. Safe metadata policy

Allow-list (`SafeKeys`): version, OS/runtime, module, operation, timestamps, correlationId, severity, exception type, code, technical message, outcome, source, eventId, roleName, sessionAuthenticated, stackHash, webViewReason/Status, hostMethod.

Unknown keys are **FORBIDDEN** (fail closed).

Forbidden needles include passwords, tokens, secrets, API keys, `loginPw`, phonebook/invoice/warranty dumps, and short HTML storage keys (`lb`, `la`, …) **by exact match** so `correlationId` is not false-positive.

`Exception.Data` is never copied blindly; it passes the same allow-list.

`Redact` strips `password=` / `Bearer` assignments and truncates values to 400 characters.

Append also rejects payloads whose technical message or metadata contains dump signatures (`"invoices":`, `"phonebook":`, `"password":`, …). Enum values such as `module: "sales"` are **not** treated as dumps.

Export JSON never includes `userName`, LAN IPs, sqlite, SecretStore, or `prefs.json`.

---

## 7. Exception capture points

| Site | Behavior after P0 |
|---|---|
| `Application.ThreadException` | Publish `SYS-DESK-UNSCOPED`, then existing WinForms behavior |
| `AppDomain.UnhandledException` | Publish, do not swallow |
| `TaskScheduler.UnobservedTaskException` | Publish; **does not** call `SetObserved()` |
| `CoreWebView2.ProcessFailed` | Publish `SYS-WEBVIEW-UNSCOPED` |
| `NavigationCompleted` `!IsSuccess` | Publish, then skip inject (same as before) |
| `MainForm` WebView2 init `catch` | Publish, then existing MessageBox |
| `AddHostObjectToScript` `catch` | Publish (still does not rethrow) |
| `SirmanHostObject` method `catch` | `HostFail` → publish + **same** `SafeError.Json` |

Not in P0 (P1/P2): `RunBusiness` wrapping, inner `result.ok==false`, `ReportUiFault`, Print/Backup algorithm publishers beyond existing Host catches, HTML `window.onerror`.

Unhandled-exception mode was **not** switched to catch-and-ignore.

---

## 8. Host API

Same `sirmanHost` object. JSON only. No raw filesystem paths on success.

| Method | Permission | Result |
|---|---|---|
| `NewDiagnosticCorrelationId` | AlwaysAllowed | `{ok, correlationId}` |
| `GetRecentDiagnostics(json)` | `Audit.View` | `{ok, count, events}` newest first |
| `GetDiagnosticIncident(correlationId)` | `Audit.View` | `{ok, incident, result, events}` |
| `ExportDiagnosticReport(correlationId)` | `Audit.View` | `{ok, fileName, bytes, correlationId, folder:"diagnostics/support"}` |

Architecture packet used placeholder names (`QueryDiagnostics`, `ExportSupportPackage`, `BeginOperation`). This P0 uses the names required by the implementation request. `BeginOperation` / `RunBusiness` correlation wrapping is deferred to P1.

`PermissionCatalog` and `docs/ARCHITECTURE_RULES.md` §4.1 item 3 were updated.

---

## 9. Security

- Query/export require existing page key `audit` (`Audit.View`). No new role system.
- Minting a correlation id is allowed before login (startup faults).
- Store is local JSONL, not sqlite, not REST, not NotifyBridge.
- Secrets and business dumps cannot be written; append fails closed.
- Support pack has `fileName` + relative `folder` only (no absolute path).
- HTML-only shops still cannot read the disk store (no Host) — unchanged by design.

---

## 10. Tests

New file: `desktop/Sirman.Core.Tests/DiagnosticCenterP0Tests.cs` (isolated temp directories, no shop data).

| # | Coverage |
|---|---|
| 1 | `DiagnosticEvent` JSON round-trip |
| 2 | `Incident` JSON round-trip |
| 3 | `CorrelationId` uniqueness / `C-` form / not `D-` `PJ-` `TR-` |
| 4 | Safe metadata filtering (unknown + dump keys dropped) |
| 5 | Secret redaction (`password=` / Bearer) |
| 6 | JSONL append, UTF-8 no BOM, one object per line |
| 7 | Malformed historical line skipped + `.corrupt-preserved` |
| 8 | Line-cap rotation; print `history.jsonl` untouched |
| 9 | `QueryRecent` newest-first + limit |
| 10 | `GetByCorrelationId` chronological |
| 11 | Exception capture: correlation, code, `Exception.Data` secrets dropped |
| 12 | Host facade JSON + `PermissionCatalog` / `HostSecurityGate` |
| 13 | Export without absolute path |
| 14 | Dump payload rejected; `module=sales` is not a dump |

Also: `SafeError` envelope still has exactly `ok`/`error`/`message`; catalog has only `SYS-*` codes; Desktop hook source scan; HTML source does not contain Core diagnostic types or Host query names.

Official suites (this packet):

- `dotnet test desktop/Sirman.Core.Tests` — **879 passed / 0 failed** (20 new P0 tests; previous architecture baseline was 859)
- `node test_laegh.js Sirman_Final.html` — **1118 passed / 0 failed** (HTML file not edited; suite unchanged)
- `dotnet build desktop/Sirman.Desktop` — succeeded (WinForms targeting pack; existing WindowsBase warning only)

---

## 11. Exact files changed

**Added**

- `desktop/Sirman.Core/Diagnostics/DiagnosticEnums.cs`
- `desktop/Sirman.Core/Diagnostics/DiagnosticModels.cs`
- `desktop/Sirman.Core/Diagnostics/CorrelationId.cs`
- `desktop/Sirman.Core/Diagnostics/SafeMetadataPolicy.cs`
- `desktop/Sirman.Core/Diagnostics/ErrorCatalog.cs`
- `desktop/Sirman.Core/Diagnostics/GuidanceEngine.cs`
- `desktop/Sirman.Core/Diagnostics/FileDiagnosticStore.cs`
- `desktop/Sirman.Core/Diagnostics/DiagnosticService.cs`
- `desktop/Sirman.Core/Diagnostics/DiagnosticFacade.cs`
- `desktop/Sirman.Desktop/DiagnosticRuntime.cs`
- `desktop/Sirman.Core.Tests/DiagnosticCenterP0Tests.cs`
- `deliveries/Reports/DIAGNOSTIC-CENTER-P0-IMPLEMENTATION.md`

**Modified**

- `desktop/Sirman.Desktop/Program.cs` — install process hooks
- `desktop/Sirman.Desktop/MainForm.cs` — WebView2 capture points
- `desktop/Sirman.Desktop/SirmanHostObject.cs` — Host methods + `HostFail`
- `desktop/Sirman.Core/Security/PermissionCatalog.cs`
- `docs/ARCHITECTURE_RULES.md` — allowed Host method list

**Not modified**

- `Sirman_Final.html`, `Laegh_Final.html`, `test_laegh.js`
- `SIRMAN_VERSION.json`, `desktop/Directory.Build.props`
- `desktop/Sirman.Core/Printing/DiagnosticHistory.cs` and print adapters
- Inventory / Sales / Invoice / Warranty / Backup Core / Phonebook / Restore
- installer kit copies of `SirmanHostObject`

---

## 12. HTML was not modified

`Sirman_Final.html` and `Laegh_Final.html` have **zero** edits in this packet.

HTML still owns the legacy in-page `ERROR_CATALOG` / `ERR_DICT` / `dbgLog` until P1/P2. P0 does not add catalog, severity, guidance, incident state, persistence, correlation, query, or recovery logic to HTML. HTML tests are expected unchanged because the file is unchanged.

---

## 13. Remaining P1 / P2 work

**P1**

- Wrap `RunBusiness` / Host results with `correlationId` + `DiagnosticResult` without changing business math
- HTML **renderer only**: if `diagnostic` is present, show the five blocks; otherwise keep current `ntf`
- Freeze HTML `registerError` / stop growing `ERROR_CATALOG`
- Assign first real INV/SAL/WAR/PRN/DAT codes after an audit of live sources (not invented in P0)

**P2**

- `ReportUiFault`; HTML `window.onerror` forwards raw text only
- Incident acknowledge/close
- Complete query filters
- Optional CRITICAL toast (catalog title only)
- Optional Print/Backup **publish-only** adapters (still not algorithm changes)
- Reporting-center UI page (not in P0)

---

## 14. Known limitations

- No UI: operators cannot yet browse incidents inside the app (Host methods exist for later HTML).
- Business operations do not yet publish diagnostic events (Inventory/Sales/Invoice/Warranty/Backup/Print/Phonebook/Restore unwired by design).
- Unscoped `SYS-*-UNSCOPED` codes are coarse; navigation vs process-fail both map to WebView unscoped.
- JSONL query is a full scan of current + 3 rotated files (limit 500). No index.
- Unobserved-task capture still depends on the runtime finalizing the task (existing .NET behavior).
- HTML-only (no exe) has no disk diagnostic store.
- Two AppData roots already exist (Local vs Roaming); diagnostics follow print and use **Local** `AppPaths.AppDataRoot`.
- Full exception stacks are not stored (type + SHA-256 hash only).
- `BeginOperation` from the architecture sketch is not implemented; minting is `NewDiagnosticCorrelationId` only.

---

**COMPLETED — DIAGNOSTIC CENTER P0**
