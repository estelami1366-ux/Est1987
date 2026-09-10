# SIRMAN — Diagnostic & Reporting Center
## Architecture Design / Audit Only — NON-HTML

**Date:** 1405/06/19 (2026-09-10)  
**Product:** SIRMAN `1405.6.16α` / assembly `1405.6.16.1`  
**Branch:** `cursor/diagnostic-reporting-center-architecture-fa01`  
**Base:** `cursor/release-1405-6-16-alpha-fa01` @ `b5f532c`  
**Mode:** ARCHITECTURE DESIGN ONLY — no implementation in this packet  
**Verdict:** **COMPLETED — ARCHITECTURE DESIGN ONLY**

Print, Backup/Recovery, Inventory Core, SQLite, and both HTML files were not modified. No ARCH-28/29 numbering. Implementation, when approved, is exactly **P0 / P1 / P2**.

---

## 0. One-page decision

```text
HTML UI  →  sirmanHost  →  Desktop facade  →  Sirman.Core Diagnostics
                                              →  Desktop file I/O
                                              →  %LocalAppData%\Sirman\diagnostics\
```

- Diagnostic **business logic lives only in `Sirman.Core`**.
- Desktop captures exceptions, writes/rotates files, supplies OS/runtime snapshot.
- Host is the only UI transport (no REST, no localhost diagnostic API).
- HTML may **invoke** Host methods and **render** `DiagnosticResult`. HTML must not classify, persist, guide, correlate, or query.
- Reuse the existing **append-only JSONL** pattern from print `DiagnosticHistoryStore`. Do **not** write into `diagnostics/history.jsonl` (print-owned). Do **not** invent a second logging product.

---

## 1. Current Error/Reporting Architecture Audit

Source of truth for this section is the `1405.6.16α` tree (`b5f532c` / `307c5dd`).

### 1.1 Core

| Piece | Path | What it actually does |
|---|---|---|
| `SafeError` | `desktop/Sirman.Core/Infrastructure/SafeError.cs` | Returns `{"ok":false,"error":"...","message":"..."}`. Exception goes only to `Debug.WriteLine`. No catalog, no correlation, no persistence, no impact flag. |
| `BusinessFacade.Run` | `desktop/Sirman.Core/Application/BusinessFacade.cs` | Catch-all → `invalid-json` / `business-failed`. Successful ops return `{ok:true, op, result}` even when **inner** `result.ok` is false (validation / business-rule). |
| Inner business errors | `InvoiceService`, `InventoryCore`, `PaymentRules`, `WarrantyWorkflow`, … | Free-text Persian `Error` + `Kind` (`validation` / `business-rule`). Not stable codes. |
| `EntityValidator` | `desktop/Sirman.Core/Validation/EntityValidator.cs` | `error` slug (`invalid-json`, field names) + Persian `message`. Not catalogued. |
| `SecurityFacade` | `desktop/Sirman.Core/Application/SecurityFacade.cs` | Login/bind/hash failures via `SafeError` slugs (`login-failed`, `verify-failed`, …). |
| `SecretStore` | `desktop/Sirman.Core/Infrastructure/SecretStore.cs` | AppData secrets files. **Must never be read by diagnostics.** |
| `BusinessEvent` | `desktop/Sirman.Core/Domain/BusinessEvent.cs` | Tiny record `{Name, Entity, EntityId, Ok}`. Not a log. |
| `SmartCoreContract` | `desktop/Sirman.Core/Domain/SmartCoreContract.cs` | States JS EventBus is not replaced. |
| Print diagnostic store | `desktop/Sirman.Core/Printing/DiagnosticHistory.cs` | Append-only JSONL, `%LocalAppData%\Sirman\diagnostics\history.jsonl`, print-only schema, no rotation. Print **FROZEN**. |

### 1.2 Desktop

| Piece | Path | What it actually does |
|---|---|---|
| `Program.Main` | `desktop/Sirman.Desktop/Program.cs` | Mutex + `Application.Run`. **No** `ThreadException`, **no** `UnhandledException`, **no** `UnobservedTaskException`. |
| `MainForm` WebView2 | `desktop/Sirman.Desktop/MainForm.cs` | Startup catch → `MessageBox` only. **No** `CoreWebView2.ProcessFailed`. `NavigationCompleted` ignores `!IsSuccess` beyond skipping inject. |
| `SirmanHostObject` | `desktop/Sirman.Desktop/SirmanHostObject.cs` | Per-method `try/catch` → `SafeError.Json`. No incident. |
| `PrintServiceAdapter` / `WindowsPrintHost` | Desktop print | Catch → `SafeError` codes such as `PRINT_ASYNC_FAILED`, `NATIVE_PRINT_FAILED`. Must not be rewritten in this program. |
| `PrintHardwareDiagnostic` | Desktop | Separate harness. Writes print JSONL via `DiagnosticHistoryBridge`. |
| `NotifyBridgeService` | Desktop | Loopback toast `/notify`. Not a log. Failures swallowed. |
| `AppPaths` | `desktop/Sirman.Desktop/AppPaths.cs` | `%LocalAppData%\Sirman` for desktop settings + print diagnostic root. Roaming `ApplicationData\Sirman` is used by Host backup dir / `SecretStore` default — **two AppData roots already exist**. |

### 1.3 Host API (current)

`sirmanHost` is the only allowed UI↔Core bridge (`docs/ARCHITECTURE_RULES.md` §4.1). Sensitive methods go through `HostSecurityGate` + `PermissionCatalog`. `RunBusiness` is always-allowed (session-independent). There is **no** diagnostic query/export method.

### 1.4 HTML (legacy — must not grow)

`Sirman_Final.html` currently **owns** a diagnostic mini-product:

- `ERROR_CATALOG` — 9 codes (`ERR-AUTH-001` … `ERR-SYS-000`)
- `ERR_DICT` — substring classifier (`Cannot read prop` → Persian cause)
- `createAppError` / `toAppError` / `presentAppError` / `ErrorEngine`
- `newCorrelationId()` prefix `TR-` (in-memory only)
- `dbgLog` RAM array; `addDbgEntry`; Settings debug pane
- `window.error` + `unhandledrejection` → HTML classifier
- `redactSensitive` (passwords/tokens/emails) — good instinct, wrong layer
- `exportDbgLog` copies RAM text to clipboard; does not survive restart
- Page `audit` + `laegh_audit_user` / `laegh_audit_bg` in **localStorage** — business activity audit, not diagnostic SoT

This HTML engine is the primary user-problem source: toast/`ntf` + a short catalog, no data-impact, no support package, no disk, no Core correlation with `RunBusiness`.

### 1.5 What already exists that we will reuse

1. **JSONL append store** pattern (`DiagnosticHistoryStore`) — copy the *idea*, new files/types.
2. **`SafeError` JSON envelope** — keep as Host wire compatibility; wrap, do not delete.
3. **`GetMachineInfo`** — machine/user/IP snapshot (trim for support pack).
4. **`PermissionCatalog` / `HostSecurityGate`** — every new Host method is added here, not a parallel ACL.
5. **Print session ids** `D-` and print job ids `PJ-` — do not collide; general correlation uses a new prefix `C-`.
6. **Persian user strings already live in C#** (`SafeError`, facades). Catalog belongs in Core, not a new localization framework.

### 1.6 What we will not duplicate

- Do not write a second print history.
- Do not use NotifyBridge as a log sink (optional CRITICAL toast later, Desktop-owned).
- Do not store diagnostics in `localStorage`, IndexedDB, `laegh_audit_*`, backup JSON, or `sirman.sqlite`.
- Do not create a localhost diagnostic HTTP API (architecture rule: no business REST; diagnostics are not an excuse).

---

## 2. Current Problems

1. **User sees a warning without a decision.** `ntf(msg,'err')` does not say what happened, why, whether data changed, or the next action.
2. **Codes are unstable.** Host uses kebab slugs (`business-failed`); HTML uses `ERR-*`; Core inner ops use Persian sentences. Support cannot search one code.
3. **Exceptions evaporate.** `SafeError` drops stack to Debug. Desktop has no process-wide handlers. WebView2 process crashes are unlogged.
4. **`RunBusiness` success envelope hides inner failure.** UI can treat HTTP-like `{ok:true}` as success while `result.ok===false`.
5. **No correlation across steps.** Invoice close → inventory.consume → payment is three silent calls.
6. **dbgLog dies on refresh.** Shop cannot send a file.
7. **HTML owns classification.** `ERR_DICT` matches English exception text. That is guidance logic in the UI layer, forbidden for the target architecture.
8. **Quota / backup / print failures** are presented without a `dataChanged` flag, so the operator cannot know if save happened.
9. **Support gets the whole business DB if asked to “send a backup.”** There is no safe diagnostic package.
10. **Two AppData roots** (Local vs Roaming) already confuse paths; a third ad-hoc folder would make it worse.

---

## 3. Target Architecture

```text
┌──────────────────────────────────────────────────────────┐
│ HTML (presentation only)                                 │
│  • call sirmanHost.BeginOperation / ReportUiFault /      │
│    GetDiagnostic / QueryDiagnostics / ExportSupportPack  │
│  • render DiagnosticResult fields in Persian             │
│  • FORBIDDEN: catalog, ERR_DICT, persistence, queries    │
└───────────────────────────┬──────────────────────────────┘
                            │ sirmanHost (same object)
                            ▼
┌──────────────────────────────────────────────────────────┐
│ Desktop facade                                           │
│  • exception hooks (UI / finalizer / tasks / WebView2)   │
│  • wrap Host + RunBusiness with CorrelationId            │
│  • file I/O + rotation                                   │
│  • OS/runtime snapshot                                   │
│  • never classifies codes itself                         │
└───────────────────────────┬──────────────────────────────┘
                            ▼
┌──────────────────────────────────────────────────────────┐
│ Sirman.Core / Diagnostics                                │
│  • ErrorCatalog                                          │
│  • GuidanceEngine (deterministic, offline)               │
│  • Incident + Event model                                │
│  • SafeMetadataPolicy                                    │
│  • Query / support-pack builder                          │
└───────────────────────────┬──────────────────────────────┘
                            ▼
┌──────────────────────────────────────────────────────────┐
│ %LocalAppData%\Sirman\diagnostics\                       │
│  history.jsonl     (EXISTING, print-only, do not touch)  │
│  events.jsonl      (NEW general diagnostic log)          │
│  events.jsonl.1..N (rotation)                            │
│  support\*.zip/json (exported packs, not SoT)            │
└──────────────────────────────────────────────────────────┘
```

HTML-only (no exe): diagnostic center is **unavailable**. UI may show one canned sentence: «مرکز عیب‌یابی فقط در نسخه رومیزی سیرمان فعال است.» That sentence is presentation, not a guidance engine. Existing in-memory `dbgLog` stays as legacy until P2 freeze; **no new HTML codes**.

---

## 4. Core Contracts

Proposed namespace: `Sirman.Core.Diagnostics` (new folder under Core). No extra NuGet.

### 4.1 Enums

```text
DiagnosticSeverity  = Info | Warning | Error | Critical | Audit
DiagnosticModule    = Inventory | Sales | Warranty | Print | Data | System
                      | Accounts | Security | Backup | Host | Unknown
IncidentStatus      = Open | Acknowledged | Resolved | Closed
OperationOutcome    = Succeeded | Failed | Partial | Cancelled | Unknown
MetadataClass       = Safe | Redacted | Forbidden
DataImpact          = Unchanged | MaybeChanged | Changed | Unknown
```

`DiagnosticModule.Print` and `Backup` exist so those subsystems can *publish* later. This packet does not change their code.

### 4.2 Records (conceptual)

**ErrorDefinition** — catalog row (see §7).  
**GuidanceRule** — deterministic mapping (see §10).  
**DiagnosticContext** — operation + module + correlation + session role name (not password) + app version.  
**DiagnosticEvent** — immutable fact (see §8).  
**Incident** — projection over events sharing one `CorrelationId` (see §9).  
**DiagnosticResult** — Host→UI DTO (see User Guidance below).  
**SupportPackage** — export DTO (see §17).

### 4.3 IDs (collision-safe with existing)

| Kind | Prefix | Owner |
|---|---|---|
| Print diagnostic session | `D-` + 32 hex | existing `DiagnosticHistoryIds` — **leave** |
| Print job | `PJ-` | existing print identity — **leave** |
| HTML legacy correlation | `TR-` | HTML `newCorrelationId` — freeze; do not emit from Core |
| General correlation | `C-` + 32 hex | **new** Core `CorrelationId` |
| Event | 32 hex / GUID | new store |
| Incident | same as `CorrelationId` (1:1) | projection |

### 4.4 Compatibility with `SafeError`

Keep returning `{ ok, error, message }` from existing Host methods.

Add optional sibling fields only when a method is migrated:

```json
{
  "ok": false,
  "error": "business-failed",
  "message": "محاسبه انجام نشد",
  "diagnostic": { /* DiagnosticResult */ }
}
```

Existing HTML that only reads `ok`/`message` keeps working. New UI reads `diagnostic`.

---

## 5. Desktop Infrastructure

Desktop does **not** own the catalog.

Responsibilities:

1. Register process hooks (`Application.ThreadException`, `AppDomain.UnhandledException`, `TaskScheduler.UnobservedTaskException`).
2. Register `CoreWebView2.ProcessFailed` + failed navigation.
3. On each Host entry: ensure `CorrelationId` (accept from HTML or mint `C-`).
4. Call Core `IDiagnosticService.Publish(...)`.
5. Implement `IDiagnosticStore` as JSONL files under `AppPaths.AppDataRoot/diagnostics/` — same root as print history.
6. Build OS snapshot: `Environment.OSVersion`, `RuntimeInformation.FrameworkDescription`, assembly informational version from `SIRMAN_VERSION` / `InformationalVersion`, machine name (already in `GetMachineInfo`).
7. Write support packs to `diagnostics/support\`.
8. Failures of the diagnostic store **must not** fail the business operation (same rule as `DiagnosticHistoryBridge.TryAppend`).

Desktop must not open `SecretStore` files, backup JSON, or sqlite.

---

## 6. Host API

All new methods go on the **existing** `sirmanHost`. No parallel bridge. Implementation later must update `PermissionCatalog` and `docs/ARCHITECTURE_RULES.md` §4.1 item 3 (the allowed-method list). Until then this is design only.

### 6.1 Methods (UI would call later — no HTML UI in this packet)

| Method | Purpose | Gate |
|---|---|---|
| `BeginOperation(json)` | Mint/return `correlationId` for a user gesture (`module`, `operation`). | AlwaysAllowed (needed before login failures too) |
| `ReportUiFault(json)` | Forward **raw** `{message, source, line}` from WebView. Core classifies. HTML must not send a chosen catalog code as authority. | AlwaysAllowed |
| `GetDiagnostic(correlationId)` | Latest `DiagnosticResult` for that id. | `Audit.View` once session exists; AlwaysAllowed for the id the UI just received in the same call stack is acceptable in P0 to show errors before login. |
| `QueryDiagnostics(filterJson)` | Reporting queries (§14). | `Audit.View` |
| `ExportSupportPackage(correlationId)` | Writes safe pack; returns path + ok. | `Audit.View` |
| `AcknowledgeIncident(correlationId)` | Status transition → Audit event. | `Audit.View` |

`RunBusiness` is **not** replaced. Desktop/Core wrapper around the existing method attaches correlation and publishes events. Signature stays `RunBusiness(name, json)`.

### 6.2 JSON in / JSON out

`BeginOperation` input (safe fields only):

```json
{ "module": "Inventory", "operation": "invoice.close", "correlationId": "" }
```

Empty `correlationId` → Core mints `C-...`.

`ReportUiFault` input is **untrusted**. Core redacts, then classifies. A client-supplied `code` is ignored until the catalog lookup of the raw message says otherwise (prevents HTML from inventing codes).

---

## 7. Error Code System

### 7.1 Rule

**Do not invent final numeric codes in this packet.** First implementation step after P0 skeleton is an **audit of live sources**, then assignment.

### 7.2 Namespace (reserved, not populated)

```text
INV-xxxx   inventory / stock / warehouse docs
SAL-xxxx   sales
WAR-xxxx   warranty / service
PRN-xxxx   print (publisher later; do not implement printer diagnostics here)
DAT-xxxx   backup / restore / persistence / quota  (record failure only; do not change backup)
SYS-xxxx   host, WebView2, unhandled, unknown
SEC-xxxx   auth / permission (optional; today login uses slugs)
ACC-xxxx   accounts / payment (optional)
```

Format after audit: `{PREFIX}-{AREA}-{nnnn}` e.g. `INV-STK-0001`. Until then Core may keep **legacy aliases** that point at existing slugs:

```text
legacy "business-failed"  →  SYS-HOST-UNSCOPED (temporary)
legacy "invalid-json"     →  SYS-HOST-UNSCOPED
legacy "ERR-JS-001"       →  SYS-UI-UNSCOPED   (HTML freeze alias)
legacy "PRINT_ASYNC_FAILED" → PRN-HOST-UNSCOPED (alias only)
```

`UNSCOPED` means “not yet audited.” P1 forbids adding more HTML `ERR-*` codes.

### 7.3 Catalog storage — chosen pattern

**Compiled C# in Core**, same as `PermissionCatalog`.

Why not JSON-in-HTML: forbidden (HTML would own guidance).  
Why not loose JSON on disk: shop could edit it out of band; two SoTs.  
Why not a new resource DLL: extra moving part.  
C# records with Persian `UserExplanation` / `UserAction` match current Core style (`SafeError` already ships Persian).

Optional later: embed a JSON resource **inside Core** if the catalog grows; still loaded only by Core.

### 7.4 ErrorDefinition fields

```text
Code
Title                 (Persian, short)
Severity
Module
UserExplanation       (what happened)
ProbableCause
RecommendedAction     (what to do now)
DeveloperDetail       (what support inspects — no secrets)
RecoveryGuidance      (safe next technical step)
DataImpact            (Unchanged | MaybeChanged | Changed | Unknown)
LegacyAliases[]       (old slugs / HTML codes)
```

---

## 8. Diagnostic Event Model

Immutable JSONL line. Never update in place (same rule as print history).

```text
eventId
timestampUtc / timestampLocal
severity                  (Info Warning Error Critical Audit)
code                      (catalog code or UNSCOPED alias)
module
operation                 (e.g. invoice.close, RunBusiness:inventory.consume, WebView2.ProcessFailed)
correlationId             (C-…)
outcome                   (Succeeded Failed Partial …)
dataChanged               (bool?  null = unknown)
success                   (bool)
userName                  (Windows / role name — not password)
sessionAuthenticated      (bool)
metadata                  (dictionary already passed through SafeMetadataPolicy)
exceptionType             (optional)
exceptionMessageRedacted  (optional)
stackHash                 (optional; full stack only in support pack if classified Safe)
appVersion / assemblyVersion
source                    (Core | Desktop | Host | UiForwarded)
```

**Never** store: passwords, tokens, API keys, `loginPw`, SecretStore values, phonebook arrays, invoice line items, backup payloads, full localStorage.

---

## 9. Incident Model

One incident per `CorrelationId`.

```text
correlationId
status                (Open / Acknowledged / Resolved / Closed)
openedAt / updatedAt
primaryCode           (highest severity event code)
severity              (max of child events)
module / operation
dataImpact            (worst child)
eventCount
lastEventId
```

Status changes **append** an `Audit` event; they do not rewrite history. Query builds the incident from events (+ optional small `incidents.index.json` cache that can be rebuilt).

---

## 10. Guidance Engine

**Offline, deterministic, no LLM.**

Input: `Incident` + child events + `ErrorDefinition`.  
Output: the five user/support blocks on `DiagnosticResult`.

Rules (priority order):

1. If catalog has a definition for `primaryCode` → use its strings.
2. Else if inner `Kind==validation` → generic validation template (data unchanged).
3. Else if inner `Kind==business-rule` → generic rule template (`dataChanged=false` unless the op documents otherwise).
4. Else if source is `UiForwarded` and message matches a **Core-side** exception family table (moved from HTML `ERR_DICT`) → SYS-UI-* after audit.
5. Else SYS-HOST-UNSCOPED / SYS-UI-UNSCOPED.

Guidance **must** fill:

1. What happened  
2. Why (probable cause)  
3. Impact (`dataImpact` + one Persian sentence)  
4. What to do now  
5. What support should inspect (`supportReference` = correlationId + code + log path)

HTML only displays these strings. HTML must not concatenate its own solutions.

---

## 11. Correlation Model

```text
BeginOperation("invoice.close") → C-abc…
  RunBusiness("invoice.close")           event  (same C-)
    RunBusiness("inventory.consume")     event  (same C- if UI/Core passes it)
    RunBusiness("payment.applyWithdraw") event
  outcome Failed/Succeeded               incident primary
```

Rules:

- HTML (P1) receives `correlationId` from `BeginOperation` and **passes it through** as a JSON field `correlationId` on subsequent Host calls. HTML does not mint authority IDs (legacy `TR-` ignored by Core).
- Desktop wrapper: if inbound JSON has no `correlationId`, mint one for that Host call only (single-call incidents).
- Nested `RunBusiness` without an id stays a **new** incident until callers thread the id — do not magically glob unrelated ops.
- Print `D-` sessions remain print-only; a future PRN publisher may *also* write a `C-` event without merging files.

---

## 12. Persistence Model

| File | Role |
|---|---|
| `%LocalAppData%\Sirman\diagnostics\history.jsonl` | **Existing print history. Out of scope. Do not rotate/rewrite.** |
| `%LocalAppData%\Sirman\diagnostics\events.jsonl` | New general event SoT (append-only UTF-8 JSONL). |
| `%LocalAppData%\Sirman\diagnostics\events.jsonl.1` … `.3` | Rotated older events. |
| `%LocalAppData%\Sirman\diagnostics\support\` | Exported packs. Not the log. Deletable. |

Constraints:

- Offline, survives restart (proven pattern: `DiagnosticHistoryTests.History_SurvivesRestart_NewStoreSameFile`).
- Not business SoT.
- Not localStorage / IndexedDB / sqlite.
- Write failure is swallowed (`TryAppend`) so diagnostics never block invoice save.
- Corrupt lines: copy `*.corrupt-preserved` once (print store already does this) and skip the line.

---

## 13. Retention / Rotation

Print `history.jsonl` has **no** rotation today. **Do not add rotation to it in this program.**

For `events.jsonl`:

```text
Rotate when file > 8 MiB OR line count > 20_000
Keep current + 3 backups  (≈ 32 MiB cap)
Oldest deleted
Rotation is rename, not rewrite of event bodies
Support packs in support\: delete files older than 14 days OR folder > 50 MiB
```

No cloud upload. No shop-data vacuum into the log.

---

## 14. Reporting API

These are **Host JSON contracts**, not REST.

`QueryDiagnostics` filter:

```json
{
  "severity": ["Error", "Critical"],
  "module": "Inventory",
  "fromUtc": "2026-09-01T00:00:00Z",
  "toUtc": "2026-09-10T23:59:59Z",
  "correlationId": "C-…",
  "codeContains": "INV-",
  "text": "انبار",
  "limit": 100,
  "offset": 0
}
```

Responses:

- `recentEvents` — newest first  
- `recentErrors` — severity ≥ Error  
- `incident` — projection + child event ids  
- `search` — code / redacted message / operation (never raw invoice bodies)

`ExportSupportPackage` returns `{ ok, path, correlationId, bytes }` after writing a file. UI later offers “open folder”; HTML does not build the pack.

---

## 15. Safe Metadata Policy

Every dictionary entering the store passes `SafeMetadataPolicy.Classify(key, value)`.

| Class | Examples | Action |
|---|---|---|
| **SAFE** | `appVersion`, `assemblyVersion`, `operation`, `module`, `code`, `printerName`, `os`, `correlationId`, `outcome`, `dataChanged`, `roleName`, `wouldGoNegative` (bool) | Store as-is |
| **REDACTED** | exception message, file paths with profile names, `computerName`/`userName` in **exported packs** (keep locally; strip or hash in shareable pack), email-like strings | Store `***` / hash |
| **FORBIDDEN** | `password`, `pwd`, `token`, `secret`, `apiKey`, `loginPw`, `laegh_login_pw`, `laegh_adminpw`, Bearer tokens, `phonebook`, `invoices`, `sales`, `warranties`, `accounts`, `lb`/`li`/`lp`/`lv`/`la`/`lc`, backup snapshot JSON, SecretStore payloads | Drop key; never store |

Default: **unknown keys are FORBIDDEN** (fail closed). Allow-list SAFE keys in Core. HTML `redactSensitive` is not the policy; Core is.

Shareable support pack uses a stricter subset: no `userName`, no LAN IPs unless the operator ticks an explicit “include machine identity” later (default off). P0 default: no IPs in export.

---

## 16. Exception Capture Points

Design only — do not implement in this packet.

| # | Site | Layer | Publish as |
|---|---|---|---|
| 1 | `Application.ThreadException` | Desktop | SYS, Critical, `Desktop.UiThread` |
| 2 | `AppDomain.CurrentDomain.UnhandledException` | Desktop | SYS, Critical, `Desktop.Unhandled` |
| 3 | `TaskScheduler.UnobservedTaskException` | Desktop | SYS, Error, `Desktop.Task` |
| 4 | `CoreWebView2.ProcessFailed` | Desktop | SYS, Critical, `WebView2.ProcessFailed` |
| 5 | `NavigationCompleted` `!IsSuccess` | Desktop | SYS, Error, `WebView2.Navigation` |
| 6 | `MainForm` WebView2 init `catch` (today MessageBox only) | Desktop | SYS, Critical, `WebView2.Init` |
| 7 | `SirmanHostObject` method `catch` (already SafeError) | Desktop→Core | keep SafeError; also Publish |
| 8 | `BusinessFacade.Run` outer catch | Core | SYS / inner kind, `RunBusiness` |
| 9 | `BusinessFacade` inner `result.ok==false` | Core | module from op prefix, validation vs rule |
| 10 | `SecurityFacade` login/bind failures | Core | SEC alias |
| 11 | HTML `window.onerror` / `unhandledrejection` | **forward raw** via `ReportUiFault` | Core classifies (HTML classifier frozen) |
| 12 | Print adapter catch | **future publisher only** | PRN-xxxx — do not edit print now |
| 13 | Backup Host catch (`backup-write`, …) | **future publisher only** | DAT-xxxx — do not edit backup now |

Hooks 1–6 are Desktop-only and do not touch Print/Backup/Inventory algorithms.

---

## 17. Support Report Model

`ExportSupportPackage(correlationId)` writes e.g. `diagnostics/support/SIRMAN-C-….json` (zip optional later; JSON is enough and needs no extra library).

Include:

- incident projection  
- related events (already redacted)  
- timestamps  
- `appVersion` / `assemblyVersion` / informational version  
- OS + .NET runtime  
- module / operation  
- `correlationId`  
- exception type + redacted message  
- stack **only** if policy says Safe (typically type + hash; full stack in local pack, stripped in copy-to-USB default)

Never include: passwords, tokens, API keys, sqlite, phonebook dump, invoice contents, backup files, SecretStore, full `prefs.json` if it might contain paths the shop considers private (P0: omit prefs).

---

## 18. Security / Privacy

- Diagnostics are **not** an audit-of-customers feature. Page `audit` / `laegh_audit_*` stay separate.
- `QueryDiagnostics` requires `Audit.View` after login (maps to existing HTML page key `audit` — no new role system).
- `BeginOperation` / `ReportUiFault` must work pre-login so startup/login errors exist.
- Support pack is local file; no network.
- NotifyBridge must not receive exception text (toast = catalog `Title` only, Desktop-owned, P2 optional).
- HTML-only mode cannot read the disk store (no Host) — by design.

---

## 19. Migration Strategy

1. **Freeze HTML catalog.** No new `ERROR_CATALOG` / `ERR_DICT` entries. Existing `presentAppError` remains until P1 renderer switch.
2. **P0** ships Core+Desktop store + hooks; Host query methods exist; HTML unchanged.
3. **P1** wraps `RunBusiness` + Host catches; HTML renderer consumes `diagnostic` if present, else falls back to current `ntf`.
4. **P2** HTML `window.onerror` calls `ReportUiFault` only (no `toAppError` classification). `dbgLog` becomes a view of Host query, or is deleted from the diagnostic path. Print/Backup **publishers** may be added as extra `Publish` calls in existing `catch` without algorithm changes — separate gated work, still not a print rewrite.
5. Legacy HTML `TR-*` ids are displayed if present but not stored as Core correlation.
6. Do not migrate `laegh_audit_*` into events.jsonl.

HTML-only shops keep today’s toasts. They do not get the center until they use the exe (architecture rule 6: HTML-only must not crash; feature disabled with a clear sentence).

---

## 20. Testing Strategy

No tests were changed in this packet. Future implementation tests live in `desktop/Sirman.Core.Tests` (and Desktop tests if added), **not** by growing HTML `ERR_DICT`.

Required later (do not weaken existing suites):

- Catalog lookup + alias mapping  
- GuidanceEngine determinism (same incident → same five blocks)  
- SafeMetadataPolicy: forbidden keys dropped; password-like values never appear in serialized JSONL  
- JSONL append + restart read (mirror `DiagnosticHistoryTests`)  
- Rotation cap  
- `RunBusiness` wrapper: inner `result.ok==false` publishes Failed without changing DTO used by current HTML  
- Host `ReportUiFault` ignores client-supplied `code`  
- Support pack fixture contains no `lb` / invoice arrays  
- Print `history.jsonl` file identity unchanged by general rotator  
- Existing: `node test_laegh.js`, `dotnet test desktop/Sirman.Core.Tests`, `node test_installer_lifecycle.js`

This architecture packet made **no production code changes**, so those suites were not re-run as a gate.

---

## 21. Implementation Order

Only three levels. No ARCH-N sprawl.

### P0 — Foundation (exe, invisible UI)

- `Sirman.Core.Diagnostics` types, empty catalog + UNSCOPED aliases, `SafeMetadataPolicy`, `GuidanceEngine` stub (catalog-only).
- `events.jsonl` store + rotation.
- Desktop exception hooks 1–6.
- Host methods `BeginOperation`, `GetDiagnostic`, `QueryDiagnostics`, `ExportSupportPackage` (minimal).
- Do **not** change HTML, Print, Backup, Inventory algorithms.
- Update `PermissionCatalog` + architecture allowed-method list when methods are added.

### P1 — Business correlation + user-visible result

- Wrap `BusinessFacade.Run` / Host `SafeError` paths with correlation + `DiagnosticResult`.
- Thread `correlationId` through `RunBusiness` JSON (additive field; ignored by current dispatch).
- HTML **renderer only**: if `diagnostic` present, show the five blocks (still no catalog in HTML).
- Freeze HTML `registerError`.

### P2 — UI fault forwarding + reporting center backend completeness

- `ReportUiFault`; HTML `window.onerror` forwards raw text only.
- Incident status + Acknowledge.
- Query filters complete.
- Optional CRITICAL toast via existing Notify (title from catalog, no stack).
- Optional Print/Backup **publish-only** adapters (catch → `Publish`) behind the existing change gate; **not** printer diagnostics, **not** backup logic changes.

---

## 22. Explicit NON-HTML Boundary

### WHAT BELONGS IN CORE

- Error catalog and aliases  
- Guidance engine  
- Event/incident model and correlation minting  
- Classification of severity, module, data impact  
- Safe metadata policy  
- Query projections  
- Support-pack **content** builder (redacted DTO)  
- Wrapping `RunBusiness` results into diagnostics **without** changing calc/inventory/warranty math  

### WHAT BELONGS IN DESKTOP

- File paths, append, rotation, corrupt preserve  
- OS/runtime snapshot  
- Process and WebView2 capture points  
- Calling Core publish on Host entry/catch  
- Writing support files to disk  
- Never opening SecretStore / sqlite / backup payloads  

### WHAT BELONGS IN HOST

- The six methods in §6 on the **same** `sirmanHost`  
- Permission mapping via existing `PermissionCatalog` / `HostSecurityGate`  
- Passing JSON through; no catalog in the COM object  

### WHAT HTML IS ALLOWED TO DO

- Call Host methods  
- Pass through `correlationId` received from Host  
- Render `DiagnosticResult` Persian fields  
- Show canned “desktop only” when Host is missing  
- Keep legacy `ntf` / existing modals until P1/P2 replace the **display** path  

### WHAT HTML IS FORBIDDEN TO DO

HTML MUST NOT OWN:

- diagnostics  
- error classification (`ERR_DICT`, `translateError` as authority)  
- persistence (`dbgLog` as SoT, localStorage diagnostic keys)  
- logging  
- guidance rules  
- correlation authority (`newCorrelationId` as Core id)  
- incident state  
- reporting queries  
- business recovery logic  

**Do not implement this subsystem in `Sirman_Final.html` or `Laegh_Final.html`.**

---

## 23. Risks

1. **HTML-only shops** will not get the center. Mitigate with one honest sentence, not a second HTML engine.  
2. **`RunBusiness` envelope** `{ok:true, result:{ok:false}}` — wrapper must publish Failed without breaking current UI parsers.  
3. **Accidental PII** in exception messages (customer names). Policy: unknown keys forbidden; messages redacted.  
4. **Colliding with print JSONL** — different file name; rotator must ignore `history.jsonl`.  
5. **Host method list** is an architecture lock; forgetting `PermissionCatalog` would fail tests (`PrintHardwareFactsTests` style).  
6. **Performance** — JSONL scan for Query on large files. P0 `limit` + newest-first read from tail; P2 can add a tiny index if measured.  
7. **Double toasts** if HTML `presentAppError` and Host diagnostic both fire — P1 must choose one presenter.  
8. **Scope creep into Print/Backup** — publishers only, separate gate, no algorithm edits.  
9. **Two AppData roots** (Local vs Roaming) — diagnostics stay on `AppPaths.AppDataRoot` (Local), same as print history.  
10. **Treating dbgLog export as a support pack** — forbid; only Core export is valid.

---

## 24. Definition of Done

This **architecture packet** is done when:

- [x] Audit of Core / Desktop / Host / SafeError / SecretStore / NotifyBridge / existing print diagnostic JSONL / HTML ErrorEngine recorded  
- [x] Target layers and NON-HTML boundary explicit  
- [x] Contracts, catalog strategy, guidance, correlation, persistence, rotation, Host API, safe metadata, capture points, support pack, security, migration, tests, P0/P1/P2 written  
- [x] No production code, HTML, Print, Backup, Inventory, or test changes  
- [x] No ARCH-28+ numbering  

A **future implementation** is done when:

- Unhandled Desktop/WebView2 failures produce a `C-` incident on disk  
- `RunBusiness` inner failures produce `DiagnosticResult` with what/why/impact/action/support  
- HTML displays that object without a local catalog  
- Support pack exports without business dumps or secrets  
- Print `history.jsonl` and business localStorage are untouched  
- Existing HTML / Core / installer tests still pass  

---

## Appendix A — Current HTML catalog (freeze list)

Do not extend. Treat as legacy aliases only:

`ERR-AUTH-001`, `ERR-NET-002`, `ERR-DB-010`, `WRN-QUOTA-01`, `ERR-STORE-001`, `ERR-BACKUP-001`, `ERR-PERM-001`, `ERR-PRINT-001`, `ERR-JS-001`, `ERR-SYS-000`.

## Appendix B — Current Host/Core slugs (audit inputs, not final codes)

`invalid-json`, `business-failed`, `unknown-op`, `login-failed`, `bind-failed`, `hash-failed`, `verify-failed`, `backup-write`, `backup-finalize`, `backup-dry-run`, `backup-snapshot-consume`, `network-config`, `workspace-write`, `workspace-read`, `printer-list`, `PRINT_ASYNC_FAILED`, `NATIVE_PRINT_FAILED`, `UNKNOWN_PRINT_FAILURE`, `forbidden`, plus inner `Kind` values `validation` / `business-rule`.

## Appendix C — Explicit non-goals of this packet

- No HTML UI for the reporting center  
- No physical printer diagnostics  
- No backup/restore behavior change  
- No inventory math change  
- No SQLite diagnostic database  
- No AI/LLM  
- No new installer / version bump  
