# SIRMAN — ARCH-27 Global Architecture Roadmap Audit

**Date:** 2026-09-06  
**Product version:** `1405.6.3α` (unchanged)  
**Kind:** AUDIT / PLANNING ONLY — no production code changes  
**Base:** exact post-ARCH-26 freeze `9fb9f6d3d08e1a7f8c46755d49c115934eb97f83`  
**Branch:** `cursor/arch-27-global-architecture-roadmap-fa01`  
**Final status:** **COMPLETED — ROADMAP AUDIT ONLY**

Do not start ARCH-28. Do not implement the proposed packets in this branch.

Authority: live source (`Sirman_Final.html`, `desktop/Sirman.Core`, `desktop/Sirman.Desktop`) cross-checked against existing reports. Old reports were not copied as truth.

---

## 1. Executive Summary

Backup / Recovery is **COMPLETE** (ARCH-26, copy-only synthetic). The next three days must **not** be more backup architecture packets.

The live product is still an HTML modular monolith. Core already owns the sensitive **EXE** calculations and mutations that Phase 3 B-migration cut over (invoice line/totals/close/delete, sale line/total/delete, warehouse doc apply, stock reserve/release/consume/addStock, warranty save/close, payments). Persistence is still HTML `localStorage`. HTML-only fallback engines remain by design.

The highest-value remaining engineering work is **closing live Core gaps that already have Core implementations but are unused by the UI**, especially **manual inventory quantity writes** that bypass `InventoryCore` on EXE.

**Next packet (P0):** `P0-inventory-manual-adjust-cutover`  
Wire `saveInvItem` (and the unused `inventory.adjust` / `inventory.removeStock` ops) so EXE stock edits go through Core, fail-closed, with HTML-only fallback preserved.

**Do not touch:** Backup/Recovery apply, Phonebook, Print, SQLite SoT, Restore `svWarehouse` persist gap (restore-owned).

---

## 2. Current System Architecture

Verified 2026-09-06 against source.

```text
Sirman_Final.html  (UI + HTML-only fallback + localStorage/IndexedDB SoT)
        │
        │ chrome.webview.hostObjects.sync.sirmanHost
        ▼
Sirman.Desktop / SirmanHostObject.cs
        │  RunBusiness(name, json)
        ▼
Sirman.Core / BusinessFacade.Dispatch
        │
        ├── Business/*     (calculations + mutations, JSON in / JSON out)
        ├── Security/*     (session, ACL mapped to HTML page keys)
        ├── Backup/*       (validate / migrate / finalize / dry-run / RestorePlan)
        ├── Printing/*     (IPrintService contract — FROZEN)
        └── Data/*         (CurrentJsonStore merge adapter; JSON repos unused in live path)
                          SQLite = candidate-only (services catalog), not SoT
```

Facts that still hold (`docs/ARCHITECTURE_RULES.md` §4.1 + live Host object):

- One Host object: `sirmanHost`. No business REST. No Blazor.
- `RunBusiness` is the only business RPC.
- HTML-only mode is supported. EXE must fail-closed when Core is present and fails.
- Live SoT: RAM globals hydrated from `localStorage` keys (`li`, `lv`, `lp`, `lp2`, `lw2`, `lb`, `laegh_*`, …). IndexedDB used for backup handles / media — not a second business DB.
- `CurrentJsonStore` merges Core JSON onto live objects. It does **not** persist. `persistCoreSnapshot()` in HTML writes LS.
- Core `RestorePlan.Applied` remains `false`. Live Restore apply is HTML Merge/Replace.

Measured HTML (freeze file): **1,875,323 bytes**, **29,684 lines**, **1,254 unique `function` declarations**, **96 `localStorage` keys**, **382 `localStorage.` sites**, **23 `page-*` ids**, **32 unique `takeBusinessCore` ops / 33 call sites**.

`BusinessFacade` exposes **51 named ops**. HTML currently wires **32**. The unused 19 are the concrete Core-maturity gap (see §5).

---

## 3. Domain Inventory

Maturity: **HTML-mono** = logic+persist+UI in HTML. **EXE-Core** = Host path uses Core; HTML-only fallback remains. **Infra** = Desktop. **Frozen** = do not schedule.

| Domain | Location | HTML / Core / Desktop | Persistence | Key globals / LS | Logic density | Coupling | Tests | Risk | Maturity |
|---|---|---|---|---|---|---|---|---|---|
| Invoices | HTML `saveInv`/`closeInv`/`calcT`; Core `InvoiceService`/`InvoicePricing` | EXE: line/totals/close/delete Core. **Draft `saveInv` still HTML-only** (no `invoice.validate`) | `sv()` → `li`; counters `invCtr` / `laegh_invoice_uid_ctr` | `invoices` | High (identity, numbering, close→stock) | Inventory, accounts, defective, print | HTML B1–B3, close/delete reversal, P1C-2 | High if draft save drifts from Core validate | EXE-Core for close; HTML-mono for draft save |
| Sales | HTML sales form; Core `InvoicePricing.SaleLine/Total`; `sale.delete` | EXE: line/total/delete + consume/addStock Core | `svSales()` → `laegh_sales` | `sales`, `saleCtr` | Medium-high | Parts stock, accounts, attachments | HTML B6/B8, P1C-3, Sale*Parity | Medium | EXE-Core calcs; HTML persist/UI |
| Warranties / service cases | HTML `saveWar`/`closeWar`; Core `WarrantyWorkflow`; `ServiceRepairWorkflow` is an **alias** of warranty+consume | EXE: save/close/transition Core. `service.*` ops **unwired**. `warranty.validateSave` **unwired** | `svWars` → `lw2` | `warranties` | High | Parts consume, phonebook, daqi, print | HTML warranty groups, B10/B11, P1C | Medium | EXE-Core for save/close; catalog of “services” separate |
| Services catalog | HTML `saveSvc`; SQLite candidate store **not live** | HTML-mono. Core has no catalog CRUD | `svSvcs` → `ls2` | `services`/`svcs` | Low (CRUD + price) | Warranty parts picker | P1 services **migration tests only** | Low live; **high if SQLite cutover forced** | HTML-mono + parked SQLite |
| Customers / Phonebook | HTML `savePBContact`; Core snapshot adapters for backup only | HTML-mono for live CRUD | `lb` | `phonebook`/`pb` (alias) | High (Policy B, no stable id) | Daqi idx, invoices, sales | ARCH-22–25 HTML+Core | High if touched | **Frozen** |
| Accounts | HTML accounts UI; Core `PaymentRules` | EXE: applyDeposit/Withdraw/edit/delete Core. `payment.remaining` / `reverseLinked` / `reverseOwned` / `payment.withdraw` **unwired** | `svAccounts` | `accounts` | Medium | Invoice/sale/warranty reversal | HTML 16/26, TransactionReversalTests | Medium | EXE-Core for live trx; reverse ops unused from HTML |
| Parts | HTML parts UI; stock mutations via InventoryCore on EXE | Mixed: catalog HTML; qty via consume/addStock/applyByWarehouse on EXE | `svParts` → `lp2` | `parts` | Medium | Warehouse byWh, sales, warranty | HTML 18/31, inventory engine tests | Medium | EXE-Core mutations on main paths |
| Warehouse docs | HTML `saveWarehouseDoc`; Core `WarehouseDocuments` | EXE: `inventory.applyWarehouseDoc` | `svWarehouse` → `laegh_warehouse` | `warehouseDocs` | High | Stock, defective, print | HTML 27/28/35 | **Restore LS gap** (frozen). Live EXE apply is Core | EXE-Core apply; HTML assemble/persist |
| Inventory / stock | HTML `invStockSnapshot`/`saveInvItem`; Core `InventoryCore` | EXE: stock/reserve/release/consume/addStock/applyByWarehouse. **`saveInvItem` writes `inventory[code].qty` directly. `inventory.adjust`/`removeStock` unwired** | `sv()` → `lv`; `laegh_stockmoves`; `laegh_warehouses` | `inventory`, `stockMoves`, `warehouses` | High | Invoices, sales, warehouse, defective | B16–B19R, InventoryStock* | **Highest live residual** | EXE-Core for document paths; HTML-mono for manual qty modal |
| Defective / hot | HTML defective + warehouse type `WH-DEF` | HTML + some applyByWarehouse DEF- branch | `laegh_defective` | `defectiveStock` | Medium | Invoice swap, warehouse | HTML 28 | Medium | HTML-mono + EXE apply path |
| Tasks | HTML tasks + notify | HTML-mono; Desktop `Notify` | `laegh_tasks` | `tasks` | Medium | Host Notify | HTML 14 + reminder group | Low-medium | HTML-mono |
| Daqi | HTML daqi module | HTML-mono | `svDaqi*` | `daqi`, `daqiWarehouse`, `daqiVouchers` | Medium | **Phonebook index** | HTML 36 | Medium (idx coupling) | HTML-mono; phonebook-frozen coupling |
| Postal | HTML postal history + native print fields | HTML + Desktop print (frozen) | postal LS / `postalHistory` | `postalHistory` | Medium | Print FROZEN, logo | Postal layout tests | Do not mix with print fixes | HTML-mono; print frozen |
| Reports / Dashboard | HTML aggregations | HTML-mono (read) | none extra | reads all globals | Medium UI | Every domain | HTML 24/25/26 | Low if read-only | HTML-mono |
| Settings / appearance | HTML + Host `SaveAppPref`/`LoadAppPref`/`ApplyUiSkin` | Mixed | many `laegh_*` keys | prefs | Low business | Skin Desktop | HTML appearance groups | Low | Infra + HTML |
| Notifications | HTML due-task + Desktop NotifyBridge | Mixed | IDB notifiedAt / Host | tasks | Medium reliability | Desktop | reminder group | Low-medium | Infra mostly done |
| Users / roles | HTML login; Core `AuthenticationService`/`AuthorizationService`/`PermissionCatalog` | EXE: BindSession/CheckPermission. HTML still owns login SoT | `laegh_roles`, `laegh_login_pw` | `userRoles`, `loginPw` | Medium | every page hide | HTML 8 + security groups, Auth* tests | Medium | EXE gate + HTML SoT |
| Import / Export Excel | HTML parsers | HTML-mono | writes same LS globals | — | Medium | Inventory create-on-import (`inventory[code]=`) | group 18 | Medium (can bypass Core stock) | HTML-mono |
| Backup / Recovery | HTML assemble/apply; Core finalize/validate/migrate/dry-run/plan/snapshots | Dual: Host finalize when exe; apply HTML | backup files + `sirman_media` | assembler collectors | High | All collections | 1094 HTML includes ARCH-2–26; Core 844 heavily backup | **Accepted COMPLETE (synthetic)** | **Frozen** except documented restore persist note |
| Printing | HTML Print Center `printEngine*`; Desktop `IPrintService`/`WindowsPrintHost` | Desktop infra | print settings LS | — | Isolated | Must only **read** docs | print groups + NativePrint* | Physical not fully verified | **Frozen** |

Other domains actually present: Help, Audit log, Multi-window, LAN workspace file share (not REST), Update center, Service-center object, Skin/theme, 2FA admin, AI-assistant **UI stubs** (`laegh_ai_key_` LS prefix — not a Core module).

---

## 4. HTML Debt Analysis

Focus: structural / business-risk debt. Not cosmetic splits of the 1,254 functions.

| Class | Evidence | Risk |
|---|---|---|
| **Business logic still in HTML on EXE** | `saveInv()` duplicates seller/items checks; never calls `invoice.validate`. `saveInvItem()` assigns `inventory[code].qty` with no Core. HTML-only `closeInv` still does `inventory[it.code].qty -= 1` (fallback only; EXE returns early). | Dual-engine drift; silent stock corruption on the **manual inventory modal** even in EXE |
| **Data access / persistence** | 96 LS keys; `persistCoreSnapshot` covers parts/inventory/warranties/invoices/accounts/sales/warehouseDocs/stockMoves. Tasks/daqi/phonebook/roles persist only via dedicated `sv*` | New Core ops that forget persistKeys drop data after reload |
| **Validation** | Core `InvoiceService.Validate` and `EntityValidator` exist. Draft invoice save and many forms still validate in JS only | EXE can save a draft the Core would reject |
| **Calculation** | Cut-over calcs go through `takeBusinessCore`. Unwired: `calc.addJalaliMonths`, inventory kardex/lowStock/value/deadStock/search/consumed | Reports can diverge from Core |
| **UI rendering / event wiring** | Appropriate to stay in HTML (`page-*`, `render*`, `showPage`) | Do not extract |
| **Global state** | `invoices`, `inventory`, `parts`, `phonebook`/`pb`, `services`/`svcs`, `warehouses`, `accounts`, `sales`, `tasks`, … all module-script globals | Any “cleanup” of globals is unacceptable ROI |
| **Cross-module dependencies** | Invoice close → stock + defective + payment prompt. Warehouse doc → parts/inventory/defective. Daqi → phonebook **index**. Warranty save → consume parts | Vertical slices must not retouch frozen neighbors |

Non-debt (leave): single-file HTML product rule; HTML-only fallback; Print Center UI; Backup assembler (ARCH-20/21 already cut snapshots in).

---

## 5. Core Maturity

### 5.1 Module classification

| Module | Class |
|---|---|
| `Business/CalculationEngine`, `InvoicePricing`, `InvoiceService`, `PaymentRules`, `InventoryCore`, `WarehouseDocuments`, `WarrantyWorkflow`, `TransactionReversal`, `PartsAdvisor` | **Pure domain / business logic** |
| `Business/ServiceRepairWorkflow` | **Compatibility layer** (delegates to WarrantyWorkflow + InventoryCore.Consume) |
| `Business/JsonVal` | Infrastructure helper |
| `Application/BusinessFacade`, `SecurityFacade` | **Transport contract** (JSON RPC) |
| `Security/*`, `Validation/EntityValidator` | Domain + Host gate |
| `Data/CurrentJsonStore` + `I*Repository` | **Compatibility / merge adapter** — live persist is still HTML |
| `Data/Repositories/Json*Repository` | Thin wrappers; used in tests (`RepositoryContractTests`), **not** the live Host path |
| `Data/Persistence/IServiceCandidateStore` + `Sirman.Persistence.Sqlite/*` | **Stub / candidate infra** — not SoT |
| `Backup/*` | Domain + Host bridges for backup **pipeline**; RestorePlan is **intentionally non-applying** |
| `Printing/*` | **Infrastructure contract** — FROZEN |
| `Domain/*Contract.cs` | Documentation constants |
| `Infrastructure/SafeError`, `SecretStore` | Infrastructure |
| Core.Tests `PhonebookForensic`, RAH, goldens | **Test-only** |

### 5.2 Highest-value missing Core *capabilities that already exist but are unwired*

HTML `takeBusinessCore` does **not** call:

`invoice.validate`, `warranty.validateSave`, `service.save|close|addPart`, `inventory.adjust|removeStock|normalizeWarehouse|kardex|lowStock|search|value|deadStock|consumed`, `payment.withdraw|remaining|reverseLinked|reverseOwned`, `calc.addJalaliMonths`.

That list is the Core-maturity backlog. **Do not invent new Core modules** until these are consumed or explicitly retired.

Missing *new* Core capabilities (not in 3-day window): persist adapter that owns LS; Restore apply; Phonebook identity; SQLite SoT.

---

## 6. Major Technical Debt

1. **EXE still has HTML stock writes:** `saveInvItem` (line ~13720) overwrites `inventory[code].qty` without `inventory.adjust`. Import Excel can create `inventory[code]` directly.
2. **Draft invoice save ignores Core validate** (`saveInv` vs unused `invoice.validate`).
3. **19 unused BusinessFacade ops** — dead Core surface area that will rot.
4. **HTML-only fallback engines** still mutate qty (`closeInv` fallback ~13181, `_applyStockMovement` HTML branch ~18210). Required for HTML-only; must not run when Host is on (already gated in those two). `saveInvItem` is **not** gated.
5. **Restore:** `warehouseDocs`/`stockMoves` RAM restored without `svWarehouse`/`svStockMoves` (ARCH-26 post-closure). Restore-owned → **not P0**.
6. **Phonebook has no stable id;** daqi stores `agencyPhonebookIdx`. Frozen.
7. **SQLite services candidate** sits next to live LS catalog — cutover temptation. Frozen SoT.
8. **Json* repositories unused in production** — fake “data layer”. Do not activate as a parallel persist.
9. **Backup Core does not apply Restore.** Accepted; do not reopen.
10. **Print physical verification** incomplete historically. Code frozen; shop evidence is not a 3-day Core packet.

---

## 7. Priority Scoring

Score = **Impact + Risk reduction + Architectural value + Business value − Effort**  
(each 1–5; Effort 5 = hardest). Higher is better. Favor high impact / risk / architecture and low–medium effort.

| ID | Candidate | I | R | A | B | E | Score | Window |
|---|---|---|---|---|---|---|---|---|
| V1 | Inventory manual adjust cutover (`saveInvItem` → `inventory.adjust`; wire `removeStock` if UI path) | 5 | 5 | 5 | 5 | 3 | **17** | **P0** |
| V2 | Invoice draft save → `invoice.validate` fail-closed on EXE | 5 | 4 | 5 | 5 | 2 | **17** | P0-day3 / P1 |
| V3 | Inventory read models: kardex / lowStock / value via Core | 3 | 2 | 4 | 3 | 2 | **10** | P1 |
| V4 | Dual-engine leftover: assert Host-on paths never hit qty `+=` (tests only, then tiny guards) | 4 | 4 | 4 | 3 | 2 | **13** | P0 tests / P1 |
| V5 | Restore persist `svWarehouse`/`svStockMoves` | 4 | 5 | 3 | 4 | 2 | **14** | **PARKED (Restore frozen)** |
| V6 | SQLite services SoT cutover | 3 | 2 | 5 | 2 | 5 | **7** | **PARKED** |
| V7 | Phonebook stable id | 4 | 4 | 4 | 4 | 4 | **12** | **PARKED (Phonebook frozen)** |
| V8 | Core RestorePlan apply | 5 | 3 | 5 | 4 | 5 | **12** | **PARKED (Recovery frozen)** |
| V9 | Print physical / postal leftover | 3 | 3 | 1 | 4 | 4 | **7** | **PARKED (Print frozen)** |
| V10 | `payment.reverse*` HTML wiring | 3 | 3 | 3 | 3 | 2 | **10** | P1 if delete gaps found |
| V11 | Tasks / dashboard Core extraction | 2 | 1 | 3 | 2 | 4 | **4** | P2 |
| V12 | Daqi/postal HTML modularization | 2 | 2 | 2 | 3 | 4 | **5** | P2 |
| V13 | Activate Json*Repository as persist | 4 | 2 | 4 | 2 | 5 | **7** | PARKED (parallel persist) |
| V14 | Wire `service.*` aliases | 2 | 2 | 2 | 2 | 2 | **6** | skip (alias of warranty) |
| V15 | Excel import stock create via Core | 3 | 3 | 3 | 3 | 3 | **9** | P1 after V1 |

V1 and V2 tie on score. **V1 wins** because it mutates **live stock on EXE today** without Core; V2 is validation-only (draft invoices do not consume stock until `closeInv`, which already uses Core).

---

## 8. Top 3 Vertical Slices

### Slice A — Warehouse / Stock remaining live mutations (recommended first)

**Why:** Core `InventoryCore.AdjustStock` / `RemoveStock` already exist and are tested at unit level (`Phase2CompleteTests` calls `AdjustStock`). The inventory **modal save** (`saveInvItem`) never calls them. EXE users can set qty in a way that disagrees with `byWh`, reserved, and `inventory.stock`. Warehouse **documents** are already Core (`saveWarehouseDoc` → `inventory.applyWarehouseDoc`). This slice finishes the inventory vertical where money and parts actually move outside documents.

Not a rewrite of `applyStockByWarehouse`. Not SQLite. Not restore persist.

### Slice B — Invoices draft-save Core validate

**Why:** `closeInv` / `invoice.line` / `invoice.totals` / `invoice.delete` are already Core on EXE. `saveInv` is the hole: it reimplements seller/items checks and never calls `invoice.validate`. Small, high architecture value, completes the invoice write path. Does not consume stock (close already does).

### Slice C — Inventory read-models (kardex / lowStock / value)

**Why:** Core already implements them (`InventoryEngineContract.Functions` lists them). HTML reports still compute locally. Lower operational risk than A/B (read-only). Good Day-3-or-P1 follow-on after A, not a replacement for A.

Sales / Accounts / Warranty were considered and ranked lower: their **primary EXE write paths are already cut over**. Services catalog looks attractive only if someone wants SQLite — that is a trap.

---

## 9. 3-Day Plan

Not three days of audits. One vertical slice, then a small second hole or stabilize.

### Day 1 — highest-value vertical slice (start)

- **Objective:** EXE manual inventory save goes through Core `inventory.adjust`.
- **Exact scope:** `saveInvItem` Host-on path: `takeBusinessCore('inventory.adjust', {item, qty, whId})`; apply Core item onto live `inventory[code]` or parts row; `persistCoreSnapshot(['inventory'])` / `svParts` as appropriate; fail-closed if Host present and Core null/ok:false. HTML-only keeps current `Object.assign` write.
- **Files:** `Sirman_Final.html` (`saveInvItem` only + tiny helper if an existing `invAdjustOnItem` pattern is copied from `invReserveOnItem`). `BusinessFacade` / `InventoryCore` **unchanged unless a proven contract bug**. Tests in `test_laegh.js` + existing Core inventory tests.
- **Expected tests:** new execution tests (Host mock) that qty/byWh come from Core; EXE failure does not write; HTML-only still writes. Run full `test_laegh.js` + `dotnet test`.
- **Deliverable:** working cutover + tests, not a report-only day.
- **Risk:** wrong target (parts vs `inventory` map); `byWh` default warehouse. Mitigate by reusing `invFindStockItem` / `applyCoreRecordOnto` like `applyStockByWarehouse`.
- **Stop:** any Backup/Restore/Phonebook/Print/SQLite edit; any `saveWarehouseDoc` rewrite; any persist-key invention.

### Day 2 — complete / test / cutover same slice

- **Objective:** Same slice production-quality: `inventory.removeStock` wired if a real UI control uses decrement; parity tests; no dual-write when Host on.
- **Exact scope:** Finish Day 1; add tests that Host-on `saveInvItem` never assigns `.qty` before Core returns; regression groups 27/31/35/B16–B19R.
- **Files:** same + `desktop/Sirman.Core.Tests/InventoryStockParityTests.cs` only if AdjustStock parity with HTML-only formula is missing.
- **Expected tests:** 1094 HTML still green (count may rise); Core 844+; no version bump unless required by governance after user-visible change (default: **do not bump** unless the packet says so — this is behavior-preserving on HTML-only).
- **Deliverable:** slice **done**, not “almost”.
- **Risk:** importing Excel still bypasses Core (out of scope unless trivial). Document as leftover.
- **Stop:** expanding into kardex/reports or invoice save on the same day if inventory tests are red.

### Day 3 — second slice **or** stabilize

**Default:** if Day 2 is green, start Slice B (`saveInv` → `invoice.validate`) as a **thin** cutover (validate only, no persist-layer change).  
**If Day 2 is not green:** stabilize Slice A only. Do not start B.

- **Objective (B):** EXE `saveInv` refuses Core-invalid drafts; HTML-only unchanged checks.
- **Files:** `saveInv` in `Sirman_Final.html`; tests around seller/items/closed status using Host mock.
- **Stop:** do not merge invoice numbering / identity / closeInv.

Success at end of 3 days: see §16.

---

## 10. Frozen / Do-Not-Touch Areas

| Area | Why frozen now | ROI if touched in 3 days |
|---|---|---|
| **Backup / Recovery** | ARCH-26 COMPLETE (synthetic). Assembler, Merge/Replace, checksum, Host finalize | Poor. Reopens data-loss surface |
| **Restore apply / RestorePlan.Applied** | Explicit non-apply; HTML apply is SoT | Unacceptable without a dedicated recovery packet |
| **`svWarehouse` restore persist gap** | Restore-owned; ARCH-26 optional note | High ROI **later**, not in a stock-adjust packet |
| **Phonebook** | Policy B just accepted; no stable id; daqi idx | High regression, low 3-day completion chance |
| **Print** | Isolated/frozen; physical leftover is shop evidence | Code patches without shop printer = guessed fixes |
| **SQLite SoT / P1 services cutover** | Candidate only; live SoT is LS | Dual-SoT is the worst possible 3-day outcome |
| Print diagnostic harness | Separate from Print Center; still not a business slice | Low |
| LAN REST / second Host / Blazor | Forbidden by architecture decisions | Forbidden |
| Splitting `Sirman_Final.html` into JS files | Skill law 3; twice failed historically | Negative ROI |
| Activating `JsonInvoiceRepository` as live persist | Tests-only wrappers | Parallel persist |
| `ServiceRepairWorkflow` as a new module | Alias of warranty | Noise |
| Version bump / installer | Packaging just shipped `1405.6.3α` | Out of scope unless a real user-visible product change ships |

---

## 11. Medium-Term Architecture

Target (already the written law):

```text
UI (HTML render + events + HTML-only fallback)
  → Host contract (sirmanHost.RunBusiness only)
  → Core business logic (BusinessFacade ops)
  → persistence/infrastructure (eventually Data Access; today HTML sv* via persistKeys)
```

**Already close:** Invoice close/delete/pricing; Sale line/total/delete; Warehouse **document** apply; Stock reserve/release/consume/addStock/applyByWarehouse; Warranty save/close; Payments apply/edit/delete; Backup finalize/validate (Host); Print contract (Desktop); Security session gate.

**Still HTML-monolithic:** Draft invoice save; manual inventory qty; services catalog; phonebook; tasks; daqi; postal; dashboard/reports; Excel import; almost all rendering.

Medium-term does **not** mean “extract `_buildFullBackupData` next.” Recovery is complete enough. Medium-term means **eat the unused Core ops on live EXE paths**, one vertical at a time, without SQLite until a dedicated SoT program exists.

---

## 12. P0 / P1 / P2 / PARKED Roadmap

No ARCH-28/29/30 ladder.

### P0 — Now (3-day window)

1. **`P0-inventory-manual-adjust-cutover`** (Slice A) — exact packet below.
2. If green: start **`P0-invoice-save-validate-cutover`** (Slice B) on Day 3 only.

### P1 — Next (after P0 green)

- Finish invoice validate cutover if Day 3 only started it.
- Inventory read-models (`kardex`/`lowStock`/`value`) Core wiring for the warehouse report page.
- Excel import create-stock via Core (V15).
- Optional: Host-on assertion tests that fallback qty `+=` is unreachable (V4).

### P2 — Later

- Tasks/dashboard as Core read APIs (low score).
- Daqi after phonebook identity exists.
- Real persist adapter replacing `sv*` **without** SQLite-first.
- Shop-VERIFIED recovery (human + real backup) — not a code packet.

### PARKED

- RestorePlan apply; Restore warehouse LS persist; Phonebook stable id; SQLite SoT; Print code; JSON repository activation; HTML file split; new transport.

---

## 13. Exact Next Packet

```text
PACKET NAME:  P0-inventory-manual-adjust-cutover
CLASS:        Opt-in Core cutover of an existing BusinessFacade op
PRODUCT:      1405.6.3α unchanged unless governance later requires a letter
BASE:         post-ARCH-26 freeze (application source)
```

**Change gate (pre-filled; implementer must re-verify):**

```text
Q1 CAPABILITY: saveInvItem on EXE uses inventory.adjust. Not Restore. Not Phonebook.
Q2 RunBusiness: existing op inventory.adjust only. No new Host method.
Q3 Persistence: persistCoreSnapshot / existing sv() / svParts. No new LS keys. No SQLite.
Q4 Printing: NO.
Q5 HTML-only: PRESERVED (current Object.assign path when !hasBusinessCore).
Q6 New transport/DB/ACL: NO.
```

**In scope**

- `saveInvItem` in `Sirman_Final.html`
- Reuse `takeBusinessCore`, `applyCoreRecordOnto`, `invFindStockItem` / `invStockSnapshot` / `stockDataAvailable` patterns from `applyStockByWarehouse`
- Fail-closed: Host on + Core fail → no LS write, Persian error
- Tests: Host mock success/fail; HTML-only still saves; `byWh`/`qty` match Core item

**Out of scope**

- `saveWarehouseDoc`, `applyStockByWarehouse`, Restore Merge/Replace, `svWarehouse` restore gap
- `inventory.kardex` reports
- `saveInv` / invoices
- Version, installer, SQLite, Print, Phonebook

**Stop conditions**

- Any red official suite
- Need to change `InventoryCore.AdjustStock` semantics to “make the modal work”
- Discovery that the modal edits **parts** vs **inventory** ambiguously without `invFindStockItem` — stop and report, do not guess

**Expected suites:** `node test_laegh.js Sirman_Final.html`; `dotnet test desktop/Sirman.Core.Tests`

---

## 14. Test Results

Recorded on the ARCH-26 freeze worktree (this audit branch), 2026-09-06. No tests were modified.

| Suite | Command | Passed | Failed | Total |
|---|---|---|---|---|
| HTML | `node test_laegh.js Sirman_Final.html` | **1094** | 0 | 1094 |
| Core | `dotnet test desktop/Sirman.Core.Tests` | **844** | 0 | 844 |

These match the ARCH-26 freeze totals. Core suite is backup-heavy (ARCH-2–26); business coverage is real but thinner (inventory/invoice/sale/warranty/payment/reversal/auth). That imbalance is why P0 should add **execution** tests on `saveInvItem`, not more backup goldens.

---

## 15. Risks

| Risk | Mitigation |
|---|---|
| Next agent starts ARCH-28 backup anyway | This report: Recovery COMPLETE; P0 is inventory adjust |
| SQLite “while we’re in inventory” | Stop condition; candidate store stays unused |
| Treating HTML-only qty writes as bugs | They are required fallback; only Host-on bypass is the bug |
| Expanding Day 1 to kardex+invoice+import | Plan forbids it |
| Restore warehouse persist looks like inventory work | It is Restore; parked |
| Shop recovery still unverified | True; not a 3-day code goal |
| Dual `phonebook`/`pb` and `services`/`svcs` aliases | Do not “clean up” |

---

## 16. Final Recommendation

### 1. What should we work on NEXT?

**`P0-inventory-manual-adjust-cutover`:** make EXE `saveInvItem` call existing `inventory.adjust`, fail-closed, persist via existing `sv*` / `persistCoreSnapshot`.

### 2. Why?

Backup/Recovery is done. The next lossy bug is not another snapshot adapter. It is **live stock edited on EXE without Core**, while `InventoryCore.AdjustStock` already exists and warehouse **documents** already use Core. Highest combined impact, risk reduction, and architectural value at medium effort. Does not touch frozen subsystems.

### 3. What should we NOT touch?

Backup/Recovery apply, Phonebook, Print, SQLite SoT, RestorePlan, restore `svWarehouse` persist, HTML splits, JsonRepository activation, `service.*` alias module, version/installer.

### 4. What can realistically be completed in 3 days?

- Days 1–2: inventory manual-adjust cutover + tests + official suites green.
- Day 3: either stabilize that slice, **or** if green, a thin `saveInv` → `invoice.validate` cutover (not both if tests are red).

Not realistic in 3 days: SQLite SoT, Restore apply, phonebook ids, print verification, extracting HTML modules.

### 5. What should be considered successful at the end of 3 days?

```text
SUCCESS:
- EXE inventory modal save cannot change qty if Core fails
- EXE inventory modal save applies Core item (qty/byWh) when Core succeeds
- HTML-only save still works
- Official HTML + Core suites green (1094+ / 844+ as tests are added)
- Frozen areas byte-untouched
- No SQLite, no Restore, no Print, no Phonebook, no version bump

NOT SUCCESS:
- Another architecture report
- Partial wiring without fail-closed
- Any recovery/print/sqlite “while here”
```

**Recommendation in one line:** stop the ARCH backup series; spend the next three days cutting over **manual inventory adjust** to Core.

---

```text
COMPLETED — ROADMAP AUDIT ONLY
```
