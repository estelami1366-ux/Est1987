# SIRMAN — PHASE 3 ARCHITECTURE MIGRATION
## STEP B4 — NEXT OWNERSHIP SEAM SELECTION GATE

**Mode:** READ-ONLY  
**Date:** 1405/05/29 (20 August 2026 14:36 UTC)  
**Branch:** `cursor/phase-3-architecture-migration-3733`  
**HEAD:** `e255600` (B3)  
**Live version:** `1405.5.27γ`

```text
B2 = COMPLETED
B3 = COMPLETED
B4 implementation = NOT STARTED
Product code modified = NO
Persistence changed = NO
Print changed = NO
Backup changed = NO
Locked workflows changed = NO
```

---

# 1. PRE-CHECK

| Source | Status |
|---|---|
| Change Gate / governance / architecture / print baseline / workflow skill | READ |
| A1–A6, B1, B2, B3 reports | READ |
| `Sirman_Final.html` / `Laegh_Final.html` | INSPECTED (`takeBusinessCore` call sites) |
| `BusinessFacade.Dispatch` | INSPECTED (~40 ops) |
| `Sirman.Core/Business/*`, Host `RunBusiness`, Core tests | INSPECTED |
| B3 floors | HTML 588 / Core 139 — not re-run (read-only; not contradicted) |
| EXE/WebView2 | still NEEDS HUMAN VERIFICATION (B2/B3) |

Product tree clean except untracked memory files. No product edits this step.

---

# 2. CURRENT ARCHITECTURE AFTER B3

```text
invoice.line    EXE = InvoicePricing.Line via RunBusiness; HTML-only = JS Math.round
invoice.totals  EXE = InvoicePricing.Totals via RunBusiness; HTML-only = calcInvoiceTotals JS sum
```

Other dual-path ops still use **Core-if-present else JS**, including when Host exists and Core returns null (the defect B2/B3 removed from invoice pricing).

---

# 3. CANDIDATE INVENTORY

| Candidate | Existing JS path | Existing C# path | Host seam | Writes data? | Locked dependency | HTML fallback | Risk | Readiness |
|---|---|---|---|---|---|---|---|---|
| `calc.sla` | `calcSlaStatusFromAgeHours` ~26652; dashboard/warranty display ~10444, ~10849, ~20443 | `CalculationEngine.SlaStatusFromAgeHours`; Facade `calc.sla` | `takeBusinessCore('calc.sla')` | NO | NO (display only) | yes (hour bands) | LOW | **READY** |
| `calc.warrantyEndDate` | `calcWarrantyEndDate` ~26616; warranty form `calcWarrExpFromBuy` ~19653 | `CalculationEngine.WarrantyEndDate` | `calc.warrantyEndDate` | NO (DOM only until save) | warranty **form** adjacent; save is separate | `addJalaliMonths` | LOW–MEDIUM | READY |
| `sale.line` | IIFE in `getSaleData` ~21690–21691; `printSaleDoc` ~21924 | `InvoicePricing.SaleLine` | `sale.line` | NO | sales save later consumes stock; **print HTML** uses it | `Math.round` price/disc | MEDIUM | READY |
| `sale.total` | `calcSaleTotal` ~21643 | `InvoicePricing.SaleTotal` / Facade `sale.total` | `sale.total` | NO | same sales module | `reduce`+`Math.round` | MEDIUM | READY (after `sale.line`) |
| `rules.suggestParts` | `suggestPartsForCase` ~26658; ~19531 | `PartsAdvisor.Suggest` | `rules.suggestParts` | NO | reads catalog; JS fallback calls `invStockSnapshot` | yes | MEDIUM | PARTIAL |
| `calc.balance` / `finalAmount` / `availableStock` / `reorderPoint` | SmartCore wrappers ~26621–26650 | `CalculationEngine.*` | `calc.*` | NO | NO | yes | LOW | PARTIAL (few/no live callers besides API) |
| `warranty.canTransition` | `canWarrantyTransition` ~26687 | `WarrantyWorkflow.CanTransition` | `warranty.canTransition` | NO | next to `warranty.applyTransition` (LOCKED) | `open→closed` | HIGH | NOT READY |
| `inventory.stock` | `invStockSnapshot` ~18395 | `InventoryCore.Stock` | `inventory.stock` | NO (read) | LOCKED inventory family | yes | HIGH | NOT READY |
| `service.*` | **no** `takeBusinessCore('service.*')` in HTML | `ServiceRepairWorkflow` → `WarrantyWorkflow` / `InventoryCore.Consume` | Facade only | would write | warranty + inventory | n/a | CRITICAL | **FORBIDDEN** / unused |
| `invoice.validate` / `calc.addJalaliMonths` / `payment.remaining` | no HTML `takeBusinessCore` | Facade yes | unused | — | — | — | HIGH | NOT READY (no live seam) |

---

# 4. CANDIDATE SCORECARD

Scale 0–5 per axis. Max 40.

### `calc.sla` — **39**

| Axis | Score | Why |
|---|---|---|
| A Deterministic | 5 | hour bands → `normal/warning/critical/overdue` |
| B Core exists | 5 | `SlaStatusFromAgeHours` |
| C Host seam | 5 | `calc.sla` live |
| D JS fallback | 5 | same bands in function |
| E No persist | 5 | display |
| F No locked workflow | 5 | does not save warranty |
| G Tests | 4 | Core facade + HTML SLA tests ~8041, ~10462 |
| H Low surface | 5 | one function, read-only call sites |

### `calc.warrantyEndDate` — **37**

A–E 5; F 4 (warranty form; persist only on later save); G 4; H 4 (Jalali / Step 3 caution).

### `sale.line` — **36**

A–E 5; F 4 (sales + `printSaleDoc` HTML); G 4 (`InvoicePricingTests.SaleLine`); H 3 (three call sites, two IIFEs, print template).

### `sale.total` — **35**

A–E 5; F 4; G 3 (string test on `calcSaleTotal`); H 4. Should follow `sale.line` (HTML-only total still inlines line math).

### `rules.suggestParts` — **31**

A 4 B 5 C 5 D 5 E 5 F 3 (stock snapshot in fallback) G 4 H 3 (catalog array).

### Unused `calc.*` (balance, etc.) — **28**

Live UI value low (H 2, G 3). Same pattern, little shop path.

No scores were adjusted to force a winner. Highest **safe** score is `calc.sla`.

---

# 5. SERVICE CORE INVESTIGATION

| # | Question | Evidence |
|---|---|---|
| 1 | HTML `takeBusinessCore("service.*")`? | **NO** — grep of `Sirman_Final.html` found zero |
| 2 | Operation names used from HTML | **none** |
| 3 | Facade exposes them? | **YES** — `service.save`, `service.close`, `service.addPart` (`BusinessFacade.cs` ~89–91) |
| 4 | `ServiceRepairWorkflow` receive HTML calls? | **NO** via Host from UI. Class exists; `CreateOrUpdate` → `WarrantyWorkflow.Save`; `Complete` → `WarrantyWorkflow.Close`; `AddPart` → `InventoryCore.Consume` |
| 5 | JS service vs catalog? | Repair/service in this product **is** the warranty record (`ServiceRepairWorkflow` comment). Not a separate live Host seam |
| 6 | Would migration touch warranty/parts/inventory/accounting? | **YES** — save/close/consume |
| 7 | Violate B4 exclusions? | **YES** — warranty + inventory mutation |

```text
service.* = UNUSED HOST SURFACE + LOCKED DELEGATES → FORBIDDEN for B5
```

---

# 6. EXCLUDED CANDIDATES

Not for B5 (exclusions + source):

invoice close/delete/validate-as-save, `sale.delete`, all `inventory.*` mutations + `inventory.stock` (family), all `payment.apply*` / reverse / edit / delete, `warranty.save/close/delete/applyTransition`, backup/restore, auth, print engine / `printSaleDoc` as a print rewrite, LAN, contacts/tasks persist, SQL/REST/second Host.

`sale.line` is **not** excluded as a calculation, but it is **not** the safest (print template + stock-on-save adjacency).

---

# 7. RECOMMENDED B5 SEAM

```text
RECOMMENDED NEXT SEAM = calc.sla
(JS calcSlaStatusFromAgeHours → takeBusinessCore("calc.sla") → CalculationEngine.SlaStatusFromAgeHours)
```

Same B2 rule: Host present → C# or null; Host absent → existing JS bands. Do not change thresholds.

Runner-up (same pricing family as B2/B3, after SLA or as a later gate): `sale.line`, then `sale.total`.

---

# 8. WHY IT IS SAFE

- Deterministic, no persist, no print engine, no backup, no invoice/inventory/accounting/warranty **mutation**
- Seam already live; Core + HTML tests already lock the four labels
- Smallest regression surface among READY candidates
- Does not require a new Host method or DTO rename
- Fail-closed would only stop silent JS on EXE when Core fails (B2 pattern)

---

# 9. REQUIRED B5 SCOPE

If a later prompt authorizes B5:

1. Gate `calcSlaStatusFromAgeHours` with `hasBusinessCore()` like `calcInvoiceLine`
2. EXE Core fail → do not run JS bands
3. Keep HTML-only `ageH<24`… formula
4. Do not change 24/48/72 cutovers
5. Tests: EXE Host-wins distinctive status; HTML-only vectors 10/24/48/72; fail-closed; no persist
6. Do not edit dashboard KPI math beyond this function’s ownership
7. Do not start `sale.line` in the same gate

---

# 10. RISKS

| ID | Level | Note |
|---|---|---|
| R1 | LOW | Agent may skip SLA as “too small” and jump to `sale.line` without a gate |
| R2 | MEDIUM | `sale.line` still has the B2 EXE/JS defect; it remains the natural **pricing** follow-on |
| R3 | LOW | B2/B3 EXE still unverified on shop hardware; SLA B5 has the same Linux-mock limit |
| R4 | HIGH | Do not use B4 to open `service.*` |

---

# 11. HUMAN VERIFICATION REQUIREMENTS

B4 itself: none (docs only).

Outstanding: B2/B3 `Sirman.exe` + WebView2. B5 SLA would also be **NEEDS HUMAN VERIFICATION** for live Host, not VERIFIED from Linux.

---

# 12. ROLLBACK STRATEGY

B4 has no product commit. Rollback = delete this report commit only.

---

# 13. FINAL STATUS

```text
B4 AUDIT = COMPLETED

RECOMMENDED NEXT SEAM = calc.sla

B5 implementation = NOT STARTED
Product code modified = NO
```
