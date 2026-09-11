# SIRMAN — Diagnostic P3 / UI-Fault Observation

**Date:** 1405/06/20 (2026-09-11)  
**Product:** SIRMAN `1405.6.16α` / assembly `1405.6.16.1` (unchanged)  
**Branch:** `cursor/diagnostic-center-p3-ui-fault-fa01`  
**Base:** `cursor/diagnostic-center-p2-mvp-fa01`  
**Mode:** UI fault observation — Core persist + thin HTML/Host adapter  
**Verdict:** **COMPLETED — DIAGNOSTIC P3 UI-FAULT OBSERVATION**

`SIRMAN_WORKING_RULES.md` is not in the repository. This packet followed `docs/ARCHITECTURE_RULES.md`, `docs/DEVELOPMENT_GOVERNANCE.md`, and `.agents/skills/laegh-software-workflow/SKILL.md`.

---

# 1. PRE-CHECK

Read before edits:

- `docs/ARCHITECTURE_RULES.md` §4.1 — Host Object `sirmanHost` is the only UI↔Core path. `ReportUiFault` was specified in the diagnostic architecture and missing from the allow-list until this packet.
- `docs/DEVELOPMENT_GOVERNANCE.md` — isolate, do not touch LOCKED Print/Inventory/Backup; HTML-only must not crash.
- Diagnostic P0/P1/P2: JSONL `diagnostics/events.jsonl`, `ErrorCatalog.SYS-UI-UNSCOPED` reserved, `GuidanceCatalog` / `GetDiagnosticIncident` guidance, Host query/export APIs.
- WebView2: `DiagnosticRuntime.AttachWebView2` already publishes `ProcessFailed`; `MainForm` already publishes navigation failure; `InjectDesktopHostBridgeAsync` is the existing post-navigation JS inject. HTML already had `window` `error` / `unhandledrejection` listeners gated by `dbgAutoEnabled` and routed through `toAppError` (`ERR-JS-001`) — in-page dbg only, not Core.

Seam exists. No architecture change required. Not BLOCKED.

---

# 2. CURRENT UI ERROR PATH

Before P3:

```text
window error / unhandledrejection
  → if !dbgAutoEnabled: return (nothing persisted)
  → toAppError(..., 'ERR-JS-001') + presentAppError   (HTML catalog / dbg panel)

WebView2.ProcessFailed / NavigationCompleted !IsSuccess
  → DiagnosticRuntime.Publish → SYS-WEBVIEW-UNSCOPED / SYS-DESK-UNSCOPED
```

No `ReportUiFault`. JS exceptions did not reach `events.jsonl`.

---

# 3. TARGET PATH

```text
window.onerror / unhandledrejection
  → reportUiFaultToHost({ message, source, line, column, stack, kind })
       or InjectDesktopHostBridge (same payload; skipped if HTML already hooked)
  → sirmanHost.ReportUiFault(json)
  → DiagnosticFacade.ReportUiFault
       ignore client `code`
       preserve well-formed C- correlationId else mint
       SafeMetadataPolicy.Redact / dump rejection
       UiFaultDeduper (15s fingerprint)
       DiagnosticService.TryRecordUiFault → SYS-UI-UNSCOPED
       GuidanceCatalog.For (P2)
  → { ok, recorded, suppressed, correlationId, code, guidance }

Existing dbgAutoEnabled → presentAppError path is unchanged.
```

---

# 4. EXACT CHANGES

**Added**

- `desktop/Sirman.Core/Diagnostics/UiFaultDeduper.cs`
- `desktop/Sirman.Core/Diagnostics/UiFaultRecorder.cs`
- `desktop/Sirman.Core.Tests/DiagnosticCenterP3Tests.cs`
- `deliveries/Reports/DIAGNOSTIC-P3-UI-FAULT-OBSERVATION.md`

**Modified**

- `desktop/Sirman.Core/Diagnostics/DiagnosticFacade.cs` — `ReportUiFault` / `RecordUiFault`
- `desktop/Sirman.Core/Diagnostics/DiagnosticService.cs` — `TryRecordUiFault`; `GuessAlias` for `UiForwarded`
- `desktop/Sirman.Core/Diagnostics/DiagnosticModels.cs` — `UiFaultReport`
- `desktop/Sirman.Core/Diagnostics/ErrorCatalog.cs` — SYS-UI operator copy + aliases (`ui-fault`, `ERR-JS-001`, …)
- `desktop/Sirman.Core/Security/PermissionCatalog.cs` — AlwaysAllowed `ReportUiFault`
- `desktop/Sirman.Desktop/SirmanHostObject.cs` — `ReportUiFault(string json)`
- `desktop/Sirman.Desktop/MainForm.cs` — thin inject in existing `InjectDesktopHostBridgeAsync`
- `Sirman_Final.html` / `Laegh_Final.html` — `reportUiFaultToHost` + host forward on existing listeners (`Laegh_Final.html` kept byte-identical)
- `test_laegh.js` — two adapter tests
- `docs/ARCHITECTURE_RULES.md` — Host allow-list

---

# 5. HTML RESPONSIBILITY

HTML only:

- capture `error` and `unhandledrejection`
- send raw `{ message, source, line, column, stack, kind }` to `sirmanHost.ReportUiFault`
- no-op when Host is missing (HTML-only must not throw)
- set `__SIRMAN_UI_FAULT_HOOK` so the Desktop inject does not double-register

HTML does **not** classify, build guidance, persist events, or own a diagnostic catalog on this path. Legacy `toAppError` / `ERROR_CATALOG` still run only when `dbgAutoEnabled` (pre-P3 dbg panel).

---

# 6. CORE/DESKTOP RESPONSIBILITY

- Parse untrusted JSON fail-safe
- Ignore client-supplied `code` (always `SYS-UI-UNSCOPED`)
- Correlation: keep well-formed `C-` + 32 hex; otherwise mint
- Redact secrets; reject dump signatures; store stack as `stackHash` only
- Dedup / cooldown
- Persist via existing JSONL store
- Attach P2 `GuidanceView`
- Host method AlwaysAllowed (startup/login faults)
- Desktop inject is a fallback for pages that lack the HTML adapter

---

# 7. DEDUPLICATION

`UiFaultDeduper` in Core (not HTML):

- Window: **15 seconds**
- Fingerprint: SHA-256 of `SYS-UI-UNSCOPED` + redacted technical text + line + column
- Same fingerprint inside the window → `suppressed: true`, **no second JSONL line**
- After the window → record again
- TimeProvider-injectable; covered by Core tests

---

# 8. TESTS

`desktop/Sirman.Core.Tests/DiagnosticCenterP3Tests.cs` (7 facts):

1. `ReportUiFault` records `SYS-UI-UNSCOPED` (`UiForwarded`, `window.onerror`)
2. Well-formed correlationId preserved; `TR-` / missing minted
3. `password=` redacted; `phonebook` dump not stored; client `INV-9999` ignored
4. Duplicate suppressed inside 15s; admitted after +16s
5. P2 guidance attached (JSON + `LoadIncident`)
6. Malformed / empty / array / `null` JSON fail-safe (`ok`, well-formed id, no `path`)
7. Host/HTML adapters are thin (no catalog/guidance/persistence in HTML adapter)

HTML (`test_laegh.js`):

- Adapter sends raw JSON and does not classify
- Missing Host does not throw; existing listeners remain

Official suites:

- `dotnet test desktop/Sirman.Core.Tests/Sirman.Core.Tests.csproj` — **907 passed / 0 failed** (P2 baseline 900; +7 P3)
- `node test_laegh.js Sirman_Final.html` — **1120 passed / 0 failed** (P2 baseline 1118; +2)
- `dotnet build desktop/Sirman.Desktop` — succeeded (existing WindowsBase / nullable warnings only)

`git diff --check` — clean (exit 0)

---

# 9. BUILD

```text
dotnet build desktop/Sirman.Desktop/Sirman.Desktop.csproj
Build succeeded.  0 Error(s).  Existing warnings only (WindowsBase MSB3277, pre-existing CS8604).
```

No package / installer / version bump.

---

# 10. PROTECTED AREAS

Not modified:

- Backup / Recovery / Restore algorithms
- Print (`IPrintService`, print JSONL `history.jsonl`)
- Inventory / Invoice / Sales / Warranty / Accounts / Phonebook
- SQLite / business persistence
- `SafeError.Json` three-field shape
- P1 RunBusiness `diagnostic` nine-field wire
- P0 JSONL store contract; P2 `GetDiagnosticIncident` still returns `result` + `guidance`
- Product version `1405.6.16α`

---

# 11. HUMAN VERIFICATION

Not done on a shop Windows + WebView2 box:

- Trigger a real `window.onerror` in the exe
- Confirm one JSONL line and the native Diagnostic Center detail
- Confirm flood of the same error does not fill the log

Linux agent: Core/HTML automated only.

---

# 12. LIMITATIONS

- Codes remain unscoped `SYS-UI-UNSCOPED` (no INV/SAL numeric codes)
- Listeners are registered late in HTML (and Desktop inject runs after successful navigation); parse-time errors before that can still be missed
- HTML-only (no exe) still has no disk diagnostic store
- Full stack is hashed, not stored
- Dedup is process-local (reset on restart)
- Desktop inject and HTML share a flag; Core dedup is the safety net if both fire
- Real WebView2 GUI path not verified on Windows

---

# 13. FINAL STATUS

| Item | Value |
|---|---|
| Packet | Diagnostic P3 UI-Fault Observation |
| Implementation | COMPLETED |
| Core tests | 907 passed / 0 failed |
| HTML tests | 1120 passed / 0 failed |
| Desktop build | succeeded |
| `git diff --check` | clean |
| Checkpoint | **YELLOW** |

**YELLOW** because Core/HTML are green and the seam was real, but `window.onerror` → JSONL was not GUI-verified on shop Windows.

**STOP.** No P4 / next diagnostic packet started.

---

### Phase 3 change-gate (this packet)

```text
Requested change: ReportUiFault observation of UI/WebView JS errors into Diagnostic Core
Classification: diagnostics P3 / observation
RunBusiness touched: NO
Persistence touched: YES (existing diagnostics/events.jsonl only)
Backup schema / Print / business algorithms: NO
HTML-only preserved: YES (Host missing → no-op; dbg path unchanged)
New transport / new DB / new Host object: NO (one method on existing sirmanHost)
Result: PASS — explicit P3 request after completed P0+P1+P2
```

**COMPLETED — DIAGNOSTIC P3 UI-FAULT OBSERVATION**
