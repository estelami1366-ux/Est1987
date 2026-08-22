# SIRMAN — PARALLEL ARCHITECTURE AUDIT
## INVENTORY READ PROJECTIONS
### Read-Only / No Product Code Change

**Mode:** ANALYSIS / READ-ONLY  
**Live version:** `1405.5.27γ` (unchanged)  
**Last verified product checkpoint:** `1fcf054` (B19R-FINAL-GOOD)  
**This HEAD:** `5f4cdd2` (descendant of `1fcf054`; packaging only after B19R)

```text
PRODUCT CODE CHANGED = NO
HTML OWNERSHIP CHANGED = NO
HOST / RUNBUSINESS OPS ADDED = NO
CORE ALGORITHMS CHANGED = NO
INVENTORY MUTATIONS CHANGED = NO
PERSISTENCE / BACKUP / PRINT / AUTH CHANGED = NO
SQL / REST / SECOND HOST = NO
B-STEP INVENTED = NO
FIXES APPLIED = NO
```

B20 already classified these seven as **INELIGIBLE** for an auto-selected next seam (Facade exists, HTML never calls Host). This audit re-traces live source and does not reopen B18/B19R or invent B21.

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
18:45:08
```

## 4. Timezone

```text
Asia/Tehran (+03:30)
```

## 5. Branch

```text
cursor/inventory-read-projections-audit-fa01
created from cursor/phase-3-architecture-migration-3733 @ 5f4cdd2
```

Analysis used that product tree. No print-branch HTML. No reset/rebase/merge/cherry-pick of product commits.

## 6. HEAD

```text
5f4cdd2  pack: add 1405.5.27γ FINAL shop setup kit from B19R
5f4cdd2a04acd4da717ac037d9493844f696e697
descendant of 1fcf054 = YES
```

## 7. Worktree

```text
clean at analysis start
report-only dirty after this file
```

`git status --short` was empty on `cursor/phase-3-architecture-migration-3733` before the docs branch.

## 8. Governance documents read

- `docs/PHASE_3_CHANGE_GATE.md`
- `docs/DEVELOPMENT_GOVERNANCE.md`
- `docs/ARCHITECTURE_RULES.md`
- `docs/PRINT_MODULE_BASELINE.md`
- `docs/REGRESSION_SUITE.md`
- `.agents/skills/laegh-software-workflow/SKILL.md`
- `deliveries/Reports/PHASE_3_MIGRATION_TRACKER.md`
- `deliveries/Reports/PHASE_3_ARCHITECTURE_MIGRATION_STEP_B20_NEXT_SEAM_AND_COMPLETION_GATE.md`
- `deliveries/Reports/PHASE_3_ARCHITECTURE_MIGRATION_STEP_B19R_INVENTORY_MUTATION_RISK_CLOSURE.md`

Source code is the authority. B20 leftover map was used as a prior claim and then re-verified with grep/read of live `Sirman_Final.html` and `InventoryCore.cs` / `BusinessFacade.cs`.

---

## 9. Seven-capability inventory

Shared facts for all seven:

- Persistence is HTML `localStorage` / backup schema. Core receives JSON snapshots; it does not read `lp` / `lv` / `lp2` itself.
- Host method for business is the existing `RunBusiness` (`SirmanHostObject` → `DesktopSecurity.Business.Run` → `BusinessFacade.Run`).
- No HTML production caller uses `takeBusinessCore('inventory.lowStock'|value|deadStock|consumed|search|kardex|normalizeWarehouse)`.
- `InventoryEngine.*` aliases exist (`Sirman_Final.html` ~18601) but have **zero** `InventoryEngine.lowStock` (etc.) call sites. Wrapper-only.
- None of the seven call `reserve` / `release` / `consume` / `addStock` / `applyByWarehouse` / `applyWarehouseDoc`.
- Print engine / `IPrintService` / native print are not in these functions. Kardex/search have a **UI print window** caller (`printKardex` → `openFreshPrintWindow`). Warehouse report print uses `_wrFiltered` moves, not these seven functions.

### 9.1 `inventory.lowStock`

| # | Fact | Evidence |
|---|---|---|
| 1 JS | `invLowStockFromLists` | `Sirman_Final.html` ~18529 |
| 2 name | `invLowStockFromLists` | |
| 3 location | HTML ~18529–18543 | |
| 4 live callers | `getDailyOperationsBriefSnapshot` ~10456; `renderWarehouseReport` ~17990 | Not definition-only. Dashboard brief is rendered live (`renderDailyOperationsBriefHtml(getDailyOperationsBriefSnapshot())` ~10641). Warehouse report is a settings/warehouse tab. |
| 5 inputs | `parts[]`, `products[]`, `inventory{}` | Dashboard via `_briefPickArr` / `_briefPickMap`. Warehouse uses globals. |
| 6 output | array of `{code,name,kind,stock}` | `stock` is snapshot `{qty,reserved,available,min,reorder,price}` or skipped |
| 7 C# | `InventoryCore.LowStock` | `desktop/Sirman.Core/Business/InventoryCore.cs` ~233 |
| 8 method | `LowStock(parts, products, inventory)` | uses `InventoryCore.Stock` per row |
| 9 Facade | `inventory.lowStock` | payload `parts`, `products`, `inventory` |
| 10 Host route | YES via `RunBusiness` | not a new Host method |
| 11 HTML uses Host for this op | **NO** | |
| 12 EXE | JS function still runs; **each row** calls `invStockSnapshot` → `inventory.stock` Host | |
| 13 HTML-only | JS `invStockSnapshot` fallback | |
| 14 persistence | reads `lp2` (parts), `lp` (products), `lv` (inventory) | does not write |
| 15 stock dep | **YES — `invStockSnapshot`** | B18 coupling |
| 16 mutation | NO | |
| 17 print | warehouse panel display only; `printWarehouseReport` does not call this | |
| 18 parity | PARTIAL (threshold analog) + EXE skip-vs-include difference | |
| 19 failure | EXE: Host stock miss → skip SKU (`stockDataAvailable` false). Core LowStock never returns UNAVAILABLE. UI omits row. | |
| 20 risk | HIGH inventory coupling; inventing `takeBusinessCore('inventory.lowStock')` is a new dual-path | |

### 9.2 `inventory.value`

| # | Fact | Evidence |
|---|---|---|
| 1–3 | `invStockValueFromLists` ~18556 | |
| 4 live callers | `renderWarehouseReport` ~17998 only | |
| 5 inputs | `parts.qty/price`, `products.price`, `inventory[code].qty` | **raw qty, not `invStockSnapshot`** |
| 6 output | number (rial total) | empty lists → `0` |
| 7–9 | `InventoryCore.Value` / `inventory.value` | same raw `qty * price` |
| 10–11 | RunBusiness exists; HTML unused | CURRENTLY UNWIRED |
| 12–13 | JS on EXE and HTML-only | |
| 14 | `lp2`, `lp`, `lv` read | |
| 15 stock | **NO `invStockSnapshot`**. Ignores `byWh` / reserved / available | if `qty` and `byWh` diverge, value ≠ B18 stock |
| 16–17 | NO mutation; no print | |
| 18 | PARTIAL — JS/C# algorithms analog; no C# parity vectors | |
| 19 | invalid/missing → `0` contribution; no `{ok:false}` | |
| 20 | MEDIUM: silent qty-vs-byWh split vs B18 | |

### 9.3 `inventory.deadStock`

| # | Fact | Evidence |
|---|---|---|
| 1–3 | `invDeadStockFromMoves` ~18566 | |
| 4 live callers | `renderWarehouseReport` ~18002 | caller builds `items` from parts+products qty, `days=90`, `stockMoves` |
| 5 | `items[{code,name,qty}]`, `stockMoves[].itemCode/date`, days, optional `nowMs` | |
| 6 | array of original item objects with `qty>0` and last move older than cutoff | empty → `[]` |
| 7–9 | `InventoryCore.DeadStock` / `inventory.deadStock` | `days` default 90; `nowMs<=0` → UTC now |
| 10–11 | UNWIRED | |
| 12–13 | JS | |
| 14 | `lp2`/`lp`/`lv` for qty; `laegh_stockmoves` for dates | does not read `laegh_warehouse` docs |
| 15 | independent qty; reads `stockMoves`; not Stock/reserved/available | |
| 16–17 | NO | |
| 18 | PARTIAL | JS `Date.parse` and Core `DateTimeOffset.TryParse` **agree** on `1405/05/01` as Gregorian year 1405 (unix `-17819308800000`). Jalali shop dates therefore look ancient; items with only Jalali moves classify as dead. Shared hazard, not JS/C# split. |
| 19 | `days<=0` → 90; missing date → `0` ms | |
| 20 | HIGH data/date risk if later owned by Core without a Jalali contract | |

### 9.4 `inventory.consumed`

| # | Fact | Evidence |
|---|---|---|
| 1–3 | `invConsumedInService` ~18582 | |
| 4 live callers | `renderWarehouseReport` ~18003 | UI shows row **count**, not the list |
| 5 | `warranties[]` from `lw2` | nested `partsUsed`, `usedParts`, `partRows`, `waParts`, `agencyWork.partReqs`, `companyWork.partReqs` |
| 6 | array `{warId,code,name,qty}` | empty → `[]`; qty missing → `1` |
| 7–9 | `InventoryCore.Consumed` / `inventory.consumed` | same nested keys |
| 10–11 | UNWIRED | |
| 14 | `lw2` only | not inventory maps |
| 15 | NO stock / moves / warehouse docs | |
| 16–17 | NO | |
| 18 | PARTIAL — analog; HTML execution test covers JS `partReqs` only | |
| 19 | skip null part; no throw | |
| 20 | LOW inventory coupling; MEDIUM warranty-shape coupling | |

### 9.5 `inventory.search`

| # | Fact | Evidence |
|---|---|---|
| 1–3 | `invSearchCatalog` ~18544 | |
| 4 live callers | `renderKardexPreview` ~18635; `printKardex` ~18655 | kardex modal is live warehouse UI |
| 5 | query string; `parts`+`products` fields code/name/barcode/brand/cat/model/batch | |
| 6 | array `{kind,code,name,barcode,qty}` | empty q → `[]`; qty is **catalog `p.qty`**, not `inventory[code]` |
| 7–9 | `InventoryCore.Search` / `inventory.search` payload `q`,`parts`,`products` | |
| 10–11 | UNWIRED | |
| 14 | `lp2`, `lp` | not `lv` |
| 15 | NO Stock | |
| 16 | NO | |
| 17 | **YES UI print**: `printKardex` uses search then `openFreshPrintWindow` | print module frozen; this is document HTML, not PrintAsync |
| 18 | PARTIAL | `toLowerCase` vs `ToLowerInvariant` (culture); analog match |
| 19 | empty q → `[]` | |
| 20 | LOW data; MEDIUM UI/print | |

### 9.6 `inventory.kardex`

| # | Fact | Evidence |
|---|---|---|
| 1–3 | `invKardexFromMoves` ~18520 | |
| 4 live callers | `renderKardexPreview` ~18645; `printKardex` ~18657 | |
| 5 | `stockMoves`, item `code`, optional `whId` | |
| 6 | filtered/sorted move objects (same references) | empty → `[]` |
| 7–9 | `InventoryCore.Kardex` / `inventory.kardex` payload `moves`,`code`,`whId` | |
| 10–11 | UNWIRED | |
| 12–13 | JS; preview **summary** uses `invStockSnapshot` (B18) separately from kardex rows | |
| 14 | `laegh_stockmoves`; warehouse filter uses `warehouses` (`laegh_warehouses`) via `moveMatchesWarehouse` | |
| 15 | rows: stockMoves only. Preview qty: **yes Stock**. | |
| 16 | NO | |
| 17 | `printKardex` | |
| 18 | **MISMATCH** vs Core when `whId` set: JS prefers `moveMatchesWarehouse` (type aliases, `WH-1`, parts-catalog heuristic). Core only `m.whId==whId \|\| m.warehouse==whId`. HTML tests JS without `moveMatchesWarehouse` extracted, so they pass the simple-id path. | |
| 19 | missing moves → `[]`; unknown warehouse → JS heuristic / Core strict miss | |
| 20 | HIGH parity complexity; print adjacent | |

### 9.7 `inventory.normalizeWarehouse`

| # | Fact | Evidence |
|---|---|---|
| 1–3 | `invNormalizeWarehouse` ~18417 | |
| 4 live callers | `openWarehouseEntityModal` ~18694 (edit path only) | fills form defaults |
| 5 | warehouse object from `warehouses[]` | |
| 6 | **same object mutated**: default `status=active`, `manager=''`, `code=id`, `type=other` | |
| 7–9 | `InventoryCore.NormalizeWarehouse` / `inventory.normalizeWarehouse` payload `warehouse` or root object | |
| 10–11 | UNWIRED | |
| 12–13 | JS in-place mutate of `warehouses[_whEditIdx]` | Host roundtrip would **not** mutate live object unless caller applies `result` |
| 14 | `laegh_warehouses` (in-memory until `svWarehouses`) | |
| 15–17 | NO stock/mutation-ops/print | |
| 18 | PARTIAL defaults analog; Host would change identity/mutation semantics | |
| 19 | `w\|\|{}` | |
| 20 | Not a stock projection; in-place write is a hidden side effect | **not** `reserve`/`consume` but **not purely read-only** |

---

## 10. Caller matrix

Do not infer callers from definitions. Live production vs test vs wrapper:

| Symbol | Definition | Test-only | HTML-only live | EXE live | Host live (`takeBusinessCore` this op) |
|---|---|---|---|---|---|
| `invLowStockFromLists` | ~18529 | `test_laegh.js` engine sim + daily-ops snapshot test | dashboard brief; warehouse report | **same JS** (+ B18 stock per row on EXE) | NO |
| `invStockValueFromLists` | ~18556 | engine sim | warehouse report | same JS | NO |
| `invDeadStockFromMoves` | ~18566 | engine sim (ISO dates) | warehouse report | same JS | NO |
| `invConsumedInService` | ~18582 | engine sim (`agencyWork.partReqs`) | warehouse report | same JS | NO |
| `invSearchCatalog` | ~18544 | engine sim | kardex preview + printKardex | same JS | NO |
| `invKardexFromMoves` | ~18520 | engine sim + extra kardex test ~7104 | kardex preview + printKardex | same JS | NO |
| `invNormalizeWarehouse` | ~18417 | engine sim | warehouse entity edit modal | same JS | NO |
| `InventoryEngine.*` | ~18601 | none as method calls | none | none | NO |

`takeBusinessCore` / `runBusinessCore` / `hasBusinessCore` / `getSirmanHostSync` exist and are used for **other** ops (`inventory.stock`, mutations, invoice, sale, warranty, payment, calc.*, `rules.suggestParts`). **None** of those call sites pass the seven projection names.

---

## 11. Core / Facade map

`BusinessFacade.Run` wraps every success as `{ ok: true, op, result }`. HTML `runBusinessCore` unwraps `.result`. Unknown name → exception → `{ ok:false }` business-failed. Invalid JSON → SafeError.

| Dispatch key | Core | Payload | `result` shape | Validation | Error |
|---|---|---|---|---|---|
| `inventory.lowStock` | `InventoryCore.LowStock` | `parts[]`, `products[]`, `inventory{}` | `List<JsonObject>` hits | none; null arrays → empty | no SKU-level UNAVAILABLE |
| `inventory.value` | `Value` | same | `double` | none | `0` |
| `inventory.deadStock` | `DeadStock` | `items[]`, `moves[]`, `days`, `nowMs` | `List<JsonObject>` (item clones as parsed JSON) | days≤0 → 90; nowMs≤0 → UTC now | empty list |
| `inventory.consumed` | `Consumed` | `warranties[]` | `List<JsonObject>` | qty `Max(1, ToInt)` | empty list |
| `inventory.search` | `Search` | `q`, `parts[]`, `products[]` | `List<JsonObject>` | empty q → empty | empty list |
| `inventory.kardex` | `Kardex` | `moves[]`, `code`, `whId` | `List<JsonObject>` (move objects) | null moves → empty | empty list |
| `inventory.normalizeWarehouse` | `NormalizeWarehouse` | `warehouse` or root | `JsonObject` (mutated/created) | missing → new object | none |

Facade does **not** persist. `CurrentJsonStore` is unused by these seven arms.

---

## 12. Host readiness

| Target | Host method exists? | RunBusiness route exists? | HTML production uses it? |
|---|---|---|---|
| lowStock | `RunBusiness` only | YES `inventory.lowStock` | NO — **CURRENTLY UNWIRED** |
| value | same | YES `inventory.value` | NO — UNWIRED |
| deadStock | same | YES `inventory.deadStock` | NO — UNWIRED |
| consumed | same | YES `inventory.consumed` | NO — UNWIRED |
| search | same | YES `inventory.search` | NO — UNWIRED |
| kardex | same | YES `inventory.kardex` | NO — UNWIRED |
| normalizeWarehouse | same | YES `inventory.normalizeWarehouse` | NO — UNWIRED |

```text
Facade exists != live Host seam
```

Dormant routes are not a migration recommendation.

Indirect Host: `lowStock` and kardex **preview summary** already call `inventory.stock` (B18). That is not ownership of the projection.

---

## 13. Data dependency map

| Projection | Arrays / maps | Fields | Derived | Warehouse identity | Dates | Filters / order |
|---|---|---|---|---|---|---|
| lowStock | `parts`, `products`, `inventory` | qty/min/reorder/price, byWh/reserved via Stock | Stock snapshot | Stock `whId` unused (always total) | none | parts then products; no sort |
| value | same | `qty`,`price` only | sum | none | none | none |
| deadStock | caller-built items; `stockMoves` | `itemCode`,`date`,`qty`,`code` | last-move map; cutoff `now-days` | none | `Date.parse` / `TryParse` | qty>0 and last<cutoff |
| consumed | `warranties` | nested part lists | flatten | none | none | encounter order |
| search | `parts`,`products` | code/name/barcode/brand/cat/model/batch | lowercase blob | none | none | encounter order |
| kardex | `stockMoves`; JS also `warehouses`/`parts` via matcher | `itemCode`,`whId`,`warehouse`,`date` | filter+sort | JS matcher vs Core equality | string `localeCompare` / ordinal | date ascending |
| normalizeWarehouse | `warehouses[_whEditIdx]` | status, manager, code, type, id | defaults | `code←id` | none | n/a |

Keys actually used (not assumed):

- `lp` products, `lv` inventory, `lp2` parts, `lw2` warranties
- `laegh_stockmoves` stockMoves
- `laegh_warehouses` warehouses (kardex filter + normalize)
- `laegh_warehouse` warehouse **docs** — **not** read by these seven
- `laegh_accounts` / `ls2` — **not** read

---

## 14. inventory.stock (B18) dependency

| Target | `invStockSnapshot`? | Independent qty? | `stockMoves`? | warehouse docs? | reserved / available? |
|---|---|---|---|---|---|
| lowStock | **YES (every row)** | no (uses Stock) | no | no | threshold uses **qty**, not available |
| value | NO | YES raw qty | no | no | no |
| deadStock | NO | YES raw qty | **YES** | no | no |
| consumed | NO | n/a | no | no | no |
| search | NO | catalog `p.qty` | no | no | no |
| kardex | rows NO; preview summary YES | n/a | **YES** | no (uses warehouses entity list) | preview only |
| normalizeWarehouse | NO | n/a | no | no | no |

```text
A projection that depends on the new B18 contract has a higher migration coupling risk.
```

That is **lowStock** (direct) and **kardex UI** (summary only).

---

## 15. Mutation dependency

None of the seven call `reserve`, `release`, `consume`, `addStock`, `applyByWarehouse`, or `applyWarehouseDoc`.

`invNormalizeWarehouse` **mutates the warehouse object in place**. That is not the inventory mutation API, but it is not a pure read. Flag: **shape mutation / not stock mutation**. Still eligible for the “no stock-mutation” checklist; **not** a clean read projection.

---

## 16. Output contracts

Observed from source (not by changing code):

| Target | Type | Empty | Zero | Missing item | Unknown warehouse | Invalid input | Large dataset |
|---|---|---|---|---|---|---|---|
| lowStock | array | `[]` | qty 0 can be a hit if min≥0 | skip / Core still emits if threshold | n/a | null lists → [] | O(parts+products) Host stock calls on EXE |
| value | number | `0` | `0` | product without inventory → qty 0 | n/a | NaN coerced via parse | full scan |
| deadStock | array | `[]` | qty≤0 excluded | no last move → t=0 → likely dead | n/a | days→90 | scan all moves then items |
| consumed | array | `[]` | qty coerced ≥1 | skip null p | n/a | non-array nest skip | flatten all warranties |
| search | array | `[]` if !q | qty 0 shown | no hit `[]` | n/a | q trimmed | linear scan |
| kardex | array | `[]` | qty 0 rows kept | no moves `[]` | JS may include extras; Core may drop | null moves `[]` | filter all moves |
| normalizeWarehouse | object | new `{}` with defaults | n/a | n/a | n/a | null → `{}` | n/a |

No `{ok,...}` envelope from the JS functions themselves. Facade adds `{ok:true, result}` only if Host were used.

---

## 17. Parity classification

No new product tests. Existing HTML engine test proves JS numbers for a small fixture. No `Sirman.Core.Tests` vectors for these seven (unlike `inventory.stock`).

| Target | Parity | Why |
|---|---|---|
| lowStock | PARTIAL | Threshold `qty<=min \|\| (reorder && qty<=reorder)` analog. EXE JS **skips** Host-fail rows; Core LowStock **cannot** skip. |
| value | PARTIAL | Same raw `qty*price`. Neither uses Stock/byWh. Unlocked. |
| deadStock | PARTIAL | Same cutoff math. Jalali `1405/05/01` parses as Gregorian 1405 on **both** JS and Core (same unix ms). Business-wrong, JS/C# aligned. |
| consumed | PARTIAL | Same nested keys; JS fixture only. |
| search | PARTIAL | Same blob fields; culture of lowercasing not locked. |
| kardex | **MISMATCH** | `moveMatchesWarehouse` vs Core field equality when `whId` set. |
| normalizeWarehouse | PARTIAL | Same defaults; Host would drop in-place mutation. |

None are `CONFIRMED`. None are N/A.

---

## 18. Failure-contract analysis

| Target | JS failure | Core failure | UI now | EXE fail-closed would need |
|---|---|---|---|---|
| lowStock | skip SKU if stock unavailable | always computes Stock | omit from dashboard/warehouse; empty copy «کالای کم‌موجودی نیست» | decide omit vs block whole panel; do **not** implement here |
| value | `0` | `0` | shows 0 rial | distinguish empty vs error |
| deadStock | `[]` or over-flag Jalali as dead | same | «—» if empty | Jalali contract first |
| consumed | `[]` | `[]` | «—» | n/a |
| search | `[]` | `[]` | empty kardex pick | n/a |
| kardex | `[]` | `[]` | «گردشی ثبت نشده» | warehouse-match contract |
| normalizeWarehouse | defaults on `{}` | defaults | form fields | apply result onto live object |

Do not implement fail-closed.

---

## 19. Coupling analysis

Qualitative scores: LOW / MEDIUM / HIGH / CRITICAL.

| Dimension | lowStock | value | deadStock | consumed | search | kardex | normalizeWarehouse |
|---|---|---|---|---|---|---|---|
| data | HIGH | MEDIUM | HIGH | MEDIUM | MEDIUM | HIGH | LOW |
| inventory | HIGH (B18) | MEDIUM | MEDIUM | LOW | LOW | MEDIUM | LOW |
| UI | HIGH (dashboard+WH) | MEDIUM | MEDIUM | LOW (count only) | MEDIUM | HIGH | MEDIUM |
| mutation | LOW | LOW | LOW | LOW | LOW | LOW | MEDIUM (in-place) |
| backup | LOW (read keys only) | LOW | LOW | LOW | LOW | LOW | LOW |
| print | LOW | LOW | LOW | LOW | MEDIUM | MEDIUM | LOW |
| Host | MEDIUM indirect | LOW dormant | LOW dormant | LOW dormant | LOW dormant | MEDIUM indirect summary | LOW dormant |
| parity complexity | HIGH | MEDIUM | HIGH (dates) | MEDIUM | MEDIUM | HIGH | MEDIUM |
| failure-risk | HIGH | MEDIUM | HIGH | LOW | LOW | HIGH | MEDIUM |

No CRITICAL stock-mutation coupling.

---

## 20. Future readiness

A capability is not READY merely because Core+Facade exist. It needs a live EXE ownership opportunity. Wiring `takeBusinessCore` into these JS functions would **invent** a dual-path (B20 condition 4 fail).

| Target | Readiness | Reason |
|---|---|---|
| lowStock | PARITY LOCK REQUIRED then ARCHITECTURE DECISION REQUIRED | B18 per-row already; skip-vs-fail-closed; dashboard coupling |
| value | INELIGIBLE as auto-seam; future program | UNWIRED; qty vs byWh decision |
| deadStock | ARCHITECTURE DECISION REQUIRED | Jalali date contract before any lock |
| consumed | INELIGIBLE as auto-seam; future program | UNWIRED; warranty nested shape |
| search | INELIGIBLE as auto-seam; future program (lowest complexity) | UNWIRED; kardex UI |
| kardex | ARCHITECTURE DECISION REQUIRED | warehouse matcher mismatch |
| normalizeWarehouse | ARCHITECTURE DECISION REQUIRED | not a projection; in-place mutate |

None: READY FOR PARITY LOCK (no C# vectors, no authorized live Host caller). None: PROTECTED in the print/auth sense.

---

## 21. Recommendation

Do **not** invent a B-step. Do **not** start parity lock or ownership. B20 OPTION C still holds for the dual-path program.

| Target | Class |
|---|---|
| lowStock | Future program — **not** immediate; needs parity/fail-closed decision because of B18 |
| value | Future program |
| deadStock | Needs separate architecture decision (Jalali dates) |
| consumed | Future program |
| search | Future program (simplest **if** a later decision authorizes a read-projection program) |
| kardex | Needs separate architecture decision (`moveMatchesWarehouse`) |
| normalizeWarehouse | Needs separate architecture decision (not a read projection) |

```text
Immediate next candidate: NONE
```

If a later architecture decision opens a **read-projection program** (separate from B2–B11 EXE dual-path auto-select), start with **search** (no Stock, small UI), not lowStock.

Discrepancies reported, not fixed:

1. Kardex warehouse filter JS ≠ Core.
2. lowStock EXE omits SKUs when `inventory.stock` is unavailable; Core LowStock does not.
3. value/deadStock use raw `qty`, not B18 Stock/byWh.
4. Jalali move dates parse as Gregorian year 1405 in both JS and Core, so dead-stock over-flags.

---

## 22. Files changed

```text
deliveries/Reports/PHASE_3_PARALLEL_AUDIT_INVENTORY_READ_PROJECTIONS.md
```

No `Sirman_Final.html`, no Core, no Desktop, no tests, no print, no backup.

## 23. Product code changed

```text
NO
```

## 24. Final status

```text
COMPLETED
Immediate next candidate: NONE
Physical paper / shop: n/a (print not in this audit)
```

STOP. One audit, one report. Do not start migration.
