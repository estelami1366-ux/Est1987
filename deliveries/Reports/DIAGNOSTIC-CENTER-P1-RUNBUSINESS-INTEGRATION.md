# SIRMAN — Diagnostic Center P1
## RunBusiness Correlation + DiagnosticResult Wiring

**Date:** 1405/06/20 (2026-09-11)  
**Product:** SIRMAN `1405.6.16α` / assembly `1405.6.16.1` (unchanged)  
**Branch:** `cursor/diagnostic-center-p1-runbusiness-fa01`  
**Base:** `cursor/diagnostic-center-p0-fa01` (P0 complete)  
**Mode:** Integration packet — RunBusiness / Host boundary only  
**Verdict:** **COMPLETED — DIAGNOSTIC P1 RUNBUSINESS INTEGRATION**

HTML was **not** modified. Inventory / Invoice / Sales / Warranty / Accounts / Services / Backup / Phonebook / Restore / Print algorithms were **not** modified. `SafeError.Json` still returns exactly `{ok, error, message}`. No SQLite, no shop data, no new persistence.

---

## 1. Current RunBusiness path

```text
HTML runBusinessCore(name, payload)
  → sirmanHost.RunBusiness(name, json)
    → DesktopSecurity.Business.Run(name, json)
      → BusinessFacade.Run
           parse JSON
           Dispatch(name, object)     ← unchanged op table
           serialize { ok, op, result }
        catch → SafeError business-failed / invalid-json
```

P1 wraps **only** `BusinessFacade.Run` and the Host `RunBusiness` catch. `Dispatch` cases and business DTOs are untouched.

Safest interception point: `BusinessFacade.Run` after JSON parse and after `Dispatch` returns, plus the existing outer `catch`. That is the single place that already owns malformed JSON, unknown ops, Core exceptions, and the `{ok:true, result}` envelope (including inner `result.ok===false`).

---

## 2. Correlation propagation

Uses the P0 `CorrelationId` type (`C-` + 32 hex). No second generator.

| Input | Behavior |
|---|---|
| Valid `correlationId` / `CorrelationId` in JSON | preserved |
| Missing / malformed | mint new |
| Nested `Run` while a scope is active and JSON omits id | reuse `CorrelationScope` current |
| Outer call returns | scope restored (UI thread does not leak ids to the next unrelated call) |

Every response includes `correlationId` (success and failure). Success does **not** write a diagnostic event.

---

## 3. Failure interception

| Failure | Existing wire | Diagnostic |
|---|---|---|
| Inner `result.ok===false` | still `{ok:true, op, result}` | event + top-level `diagnostic` |
| Unknown operation | still `SafeError` `business-failed` / `محاسبه انجام نشد` | event (`unknown-op` alias → `SYS-HOST-UNSCOPED`) |
| Malformed JSON | still `invalid-json` / `داده نامعتبر است` | event |
| Core exception | still `business-failed` / `محاسبه انجام نشد` | event; exception type + redacted message |
| Host/bridge throw | same `business-failed` envelope + `diagnostic` | `PublishHostFailure` with the request correlation |

No success INFO events in P1 (volume bound).

Uncatalogued failures stay on P0 unscoped codes (`SYS-HOST-UNSCOPED`). No INV/SAL/WAR numeric codes.

---

## 4. DiagnosticResult contract usage

Additive JSON object `diagnostic` (camelCase), catalog-only fields:

- `succeeded`, `code`, `title`, `severity`
- `whatHappened`, `probableCause`, `userAction`, `dataImpact`
- `correlationId`

Not returned to HTML: exception type, stack, technical message, business objects.

HTML `runBusinessCore` still reads `ok` / `result` only. Extra fields are ignored. Zero HTML edits.

---

## 5. SafeError compatibility

`SafeError.Json` is unchanged (three properties). Failures still start from that string; `DiagnosticEnvelope.Augment` adds `correlationId` and `diagnostic`.

Existing callers that check `ok`, `error`, `message`, or inner `result` keep working. Business math and persistKeys are unchanged.

---

## 6. Host boundary

Same `sirmanHost`. No new Host method.

P0 methods remain: `NewDiagnosticCorrelationId`, `GetRecentDiagnostics`, `GetDiagnosticIncident`, `ExportDiagnosticReport`.

`RunBusiness` still `RunBusiness(name, json)`. Desktop injects `DiagnosticRuntime.Service` into `BusinessFacade`. Host catch is belt-and-suspenders (Facade already swallows exceptions) and returns the same SafeError slug plus diagnostic.

---

## 7. HTML boundary

**HTML was not modified.** No catalog, severity, guidance, persistence, or correlation implementation in HTML. Display of `diagnostic` is P2.

---

## 8. Exact files changed

**Added**

- `desktop/Sirman.Core/Diagnostics/CorrelationScope.cs`
- `desktop/Sirman.Core/Diagnostics/DiagnosticEnvelope.cs`
- `desktop/Sirman.Core.Tests/DiagnosticCenterP1Tests.cs`
- `deliveries/Reports/DIAGNOSTIC-CENTER-P1-RUNBUSINESS-INTEGRATION.md`

**Modified**

- `desktop/Sirman.Core/Application/BusinessFacade.cs` — wrap `Run` only
- `desktop/Sirman.Core/Diagnostics/DiagnosticService.cs` — `TryRecordFailure` / `ToSafeResult`
- `desktop/Sirman.Core/Diagnostics/GuidanceEngine.cs` — `ForFailure`
- `desktop/Sirman.Core/Diagnostics/ErrorCatalog.cs` — aliases `unknown-op`, `business-rule`, `validation`
- `desktop/Sirman.Core/Diagnostics/DiagnosticEnums.cs` — `DiagnosticOperation.ModuleFor`
- `desktop/Sirman.Core/Diagnostics/DiagnosticModels.cs` — `DiagnosticContext.DataImpact`
- `desktop/Sirman.Desktop/DesktopSecurity.cs` — lazy `BusinessFacade` + P0 store
- `desktop/Sirman.Desktop/SirmanHostObject.cs` — `RunBusiness` catch
- `desktop/Sirman.Desktop/DiagnosticRuntime.cs` — optional correlation on publish
- `docs/ARCHITECTURE_RULES.md` — §4.1 item 10 note

**Not modified**

- `Sirman_Final.html`, `Laegh_Final.html`, `test_laegh.js`
- `SIRMAN_VERSION.json`
- Inventory / Invoice / Sales / Warranty / Payment / Print / Backup / Phonebook sources
- `SafeError.cs`

---

## 9. Tests

`desktop/Sirman.Core.Tests/DiagnosticCenterP1Tests.cs` (isolated temp JSONL, no shop data):

1. Mints CorrelationId when missing (success does not persist)
2. Supplied id preserved
3. Explicit inner business failure → event + diagnostic
4. Invalid operation → event; SafeError slug unchanged
5. Malformed JSON → `invalid-json` + event
6. Core exception → event; secrets redacted
7. Host-shaped SafeError+diagnostic is safe; Host source has try/catch
8. Sensitive exception data not leaked
9. `SafeError.Json` still three fields
10. Same correlationId across related records
11. Persistence is `events.jsonl` only (not print `history.jsonl`)
12. Returned `diagnostic` is the safe field subset

Official suites recorded in this packet:

- `dotnet test desktop/Sirman.Core.Tests` — **892 passed / 0 failed** (13 new P1 tests; P0 baseline was 879)
- `node test_laegh.js Sirman_Final.html` — **1118 passed / 0 failed** (HTML unchanged)
- `dotnet build desktop/Sirman.Desktop` — succeeded

---

## 10. Security / redaction

- `Exception.Data` still allow-listed; passwords / API keys dropped
- Technical messages pass `SafeMetadataPolicy.Redact`
- Inner business DTOs (`item`, invoices, accounts) are **not** copied into events
- Dump signatures still rejected by the P0 store
- Returned `diagnostic` has no stack / exception / technical payload

---

## 11. Remaining P2 work

Do not implement in this packet.

**P2 (single next step):** UI raw-error forwarding (`ReportUiFault` / HTML `window.onerror` forwards raw text only) + diagnostic query/reporting experience (render Host `diagnostic` / `GetRecentDiagnostics`) + optional publish hooks on existing Print/Backup catches. No extra phases.

---

## 12. Known limitations

- HTML still shows current `ntf` / `_sirmanLastBusinessError`; it does not render the five diagnostic blocks yet
- Outer `{ok:true, result:{ok:false}}` is preserved on purpose so existing EXE parsers do not break
- Codes remain unscoped `SYS-HOST-UNSCOPED` until a live-source code audit
- Nested correlation reuse requires an active `CorrelationScope` or an explicit JSON id (HTML does not thread ids yet)
- Host catch is rarely hit because `BusinessFacade.Run` already catches
- `TestForceException` is a Core-tests seam only; it is not a business operation

---

### Phase 3 change-gate (this packet)

```text
Requested change: Wire CorrelationId + DiagnosticResult at RunBusiness boundary
Classification: integration / diagnostics P1
RunBusiness touched: YES (wrapper only; Dispatch unchanged)
Persistence touched: YES (existing diagnostics/events.jsonl only)
Backup schema / Print / business algorithms: NO
HTML-only preserved: YES (file unchanged; extra JSON ignored)
New transport / new DB / new Host object: NO
Result: PASS — explicit P1 request after completed P0
```

**COMPLETED — DIAGNOSTIC P1 RUNBUSINESS INTEGRATION**
