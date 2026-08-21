# SIRMAN — PHASE 3 MIGRATION TRACKER

**Tracker mode:** ACTIVE  
**Last updated:** 1405/05/30 13:00:55 (Asia/Tehran)  
**Branch:** `cursor/phase-3-architecture-migration-3733`  
**Current known HEAD:** `16330de`  
**B6 commit:** `66e78be` (`feat: migrate sale.line ownership to core`)  
**B8 commit:** `9582215` (`feat: migrate sale.total ownership to core`)  
**B10 commit:** `da78c6a` (`test: lock calc.warrantyEndDate JS/C# parity vectors`)  
**B11 commit:** `405bcb1` (`feat: migrate calc.warrantyEndDate ownership to core`)  
**B11 report commit:** `da5353d` (`docs: record B11 calc.warrantyEndDate ownership migration`)  
**B12 report commit:** `4986bc5` (`docs: B12 change gate selects rules.suggestParts`)  
**B13 commit:** `8446619` (`test: lock rules.suggestParts JS/C# parity vectors`)  
**B13 report commit:** `82ce509` (`docs: record B13 rules.suggestParts parity lock`)  
**B14 commit:** `dae7cde` (`feat: migrate rules.suggestParts ownership to core`)  
**B14 report commit:** `3fa389f` (`docs: record B14 rules.suggestParts ownership migration`)  
**B15 report commit:** `bd75162` (`docs: B15 change gate finds no authorized seam`)  
**B16 commit:** `23a4776` (`test: lock inventory.stock JS/C# parity vectors`)  
**B16 report commit:** `380c7f2` (`docs: record B16 inventory.stock parity lock and rollback protocol`)  
**B17 commit:** `935377a` (`test: lock inventory.stock safe fail-closed contract`)  
**B17 report commit:** `229973f` (`docs: record B17 inventory.stock fail-closed contract`)  
**B18 commit:** `76c92e6` (`feat: migrate inventory.stock ownership to core`)  
**B18 report commit:** `5742e4f` (`docs: record B18 inventory.stock ownership migration`)  
**B19 commit:** `e414025` (`fix: keep Core stock when availability predicate is absent`; gates `fb4a8fe`)  
**B19 report commit:** `16330de` (`docs: record B19 inventory mutation boundary safety`)  
**Live version:** `1405.5.27γ`

> این فایل Tracker مرکزی است. هر مرحله فقط پس از دریافت گزارش MD و بررسی نتیجه، تیک می‌خورد.
> وضعیت Human Verification جداگانه ثبت می‌شود و با تست خودکار اشتباه نمی‌شود.

---

## Migration Checklist

| Step | Task | Status | Date | Time | Evidence / Notes |
|---|---|---|---|---|---|
| A1 | Baseline / architecture preparation | ✅ COMPLETED | 1405/05/29 | ثبت قبلی | `deliveries/Reports/PHASE_3_ARCHITECTURE_MIGRATION_STEP_A1_A6.md` |
| A2 | Architecture / ownership analysis | ✅ COMPLETED | 1405/05/29 | ثبت قبلی | همان گزارش A1–A6 |
| A3 | Dependency / capability analysis | ✅ COMPLETED | 1405/05/29 | ثبت قبلی | همان گزارش A1–A6 |
| A4 | Migration preparation | ✅ COMPLETED | 1405/05/29 | ثبت قبلی | همان گزارش A1–A6 |
| A5 | Migration gate preparation | ✅ COMPLETED | 1405/05/29 | ثبت قبلی | همان گزارش A1–A6 |
| A6 | Final migration readiness audit | ✅ COMPLETED | 1405/05/29 | ثبت قبلی | همان گزارش A1–A6 |
| B1 | Invoice parity lock | ✅ COMPLETED | 1405/05/29 | ثبت قبلی | `PHASE_3_ARCHITECTURE_MIGRATION_STEP_B1_PARITY_LOCK.md` |
| B2 | `invoice.line` ownership | ✅ COMPLETED | 1405/05/29 | ثبت قبلی | `PHASE_3_ARCHITECTURE_MIGRATION_STEP_B2_FIRST_OWNERSHIP_MIGRATION.md` |
| B3 | `invoice.totals` ownership | ✅ COMPLETED | 1405/05/29 | ثبت قبلی | `PHASE_3_ARCHITECTURE_MIGRATION_STEP_B3_INVOICE_TOTALS_OWNERSHIP.md` |
| B4 | Select next seam | ✅ COMPLETED | 1405/05/29 | ثبت قبلی | `PHASE_3_ARCHITECTURE_MIGRATION_STEP_B4_NEXT_OWNERSHIP_SEAM.md` — انتخاب `calc.sla` |
| B5 | `calc.sla` ownership | ✅ COMPLETED | 1405/05/29 | ثبت قبلی | `PHASE_3_ARCHITECTURE_MIGRATION_STEP_B5_CALC_SLA_OWNERSHIP.md` — HTML 592 / Core 139 |
| B6 | `sale.line` ownership | ✅ COMPLETED | 1405/05/29 | 19:09:01 | `PHASE_3_ARCHITECTURE_MIGRATION_STEP_B6_SALE_LINE_OWNERSHIP.md` — commit `66e78be` — HTML 596 / Core 142 PASS |
| B7 | Next ownership seam (analysis) | ANALYSIS COMPLETED | 1405/05/29 | 19:15:37 | `PHASE_3_ARCHITECTURE_MIGRATION_STEP_B7_NEXT_OWNERSHIP_SEAM.md` — انتخاب `sale.total` |
| B8 | `sale.total` ownership | ✅ COMPLETED | 1405/05/29 | 19:26:00 | `PHASE_3_ARCHITECTURE_MIGRATION_STEP_B8_SALE_TOTAL.md` — commit `9582215` — HTML 600 / Core 146 PASS — live EXE NEEDS HUMAN VERIFICATION |
| B9 | Next ownership seam (analysis) | ANALYSIS COMPLETED | 1405/05/30 | 10:20:55 | `PHASE_3_ARCHITECTURE_MIGRATION_STEP_B9_NEXT_OWNERSHIP_SEAM.md` — انتخاب `calc.warrantyEndDate` — PARITY LOCK REQUIRED — implementation NOT STARTED |
| B10 | `calc.warrantyEndDate` parity lock | ✅ COMPLETED | 1405/05/30 | 10:40:28 | `PHASE_3_ARCHITECTURE_MIGRATION_STEP_B10_PARITY_LOCK.md` — PARITY CONFIRMED — HTML 602 / Core 149 PASS — ownership NOT migrated |
| B11 | `calc.warrantyEndDate` ownership | ✅ COMPLETED | 1405/05/30 | 10:58:48 | `PHASE_3_ARCHITECTURE_MIGRATION_STEP_B11_WARRANTY_ENDDATE_OWNERSHIP.md` — commit `405bcb1` — HTML 609 / Core 149 PASS — live EXE NEEDS HUMAN VERIFICATION |
| B12 | Next ownership seam (change gate) | ANALYSIS COMPLETED | 1405/05/30 | 11:10:07 | `PHASE_3_ARCHITECTURE_MIGRATION_STEP_B12_CHANGE_GATE.md` — انتخاب `rules.suggestParts` — PARITY LOCK REQUIRED — implementation NOT STARTED |
| B13 | `rules.suggestParts` parity lock | ✅ COMPLETED | 1405/05/30 | 11:25:13 | `PHASE_3_ARCHITECTURE_MIGRATION_STEP_B13_RULES_SUGGESTPARTS_PARITY_LOCK.md` — PARITY CONFIRMED — HTML 611 / Core 151 PASS — ownership NOT migrated |
| B14 | `rules.suggestParts` ownership | ✅ COMPLETED | 1405/05/30 | 11:34:57 | `PHASE_3_ARCHITECTURE_MIGRATION_STEP_B14_RULES_SUGGESTPARTS_OWNERSHIP.md` — commit `dae7cde` — HTML 616 / Core 151 PASS — live EXE NEEDS HUMAN VERIFICATION |
| B15 | Next ownership seam (change gate) | ANALYSIS COMPLETED / SELECTION BLOCKED | 1405/05/30 | 11:47:25 | `PHASE_3_ARCHITECTURE_MIGRATION_STEP_B15_CHANGE_GATE.md` — هیچ seam مجاز نماند — implementation NOT STARTED — محصول تغییر نکرد |
| B16 | Architecture decision + `inventory.stock` parity | ✅ COMPLETED (parity lock) | 1405/05/30 | 12:02:36 | `PHASE_3_ARCHITECTURE_MIGRATION_STEP_B16_ARCHITECTURE_DECISION_AND_ROLLBACK_GATE.md` — PARITY CONFIRMED — HTML 619 / Core 154 PASS — ownership NOT migrated — checkpoint B14-GOOD=`dae7cde` / B16-PARITY=`23a4776` |
| B17 | Safe fail-closed contract for `inventory.stock` | ✅ COMPLETED (contract + tests) | 1405/05/30 | 12:12:09 | `PHASE_3_ARCHITECTURE_MIGRATION_STEP_B17_SAFE_FAIL_CLOSED_INVENTORY.md` — `{ok:false, reason:"INVENTORY_UNAVAILABLE"}` — HTML 625 / Core 159 PASS — runtime UNCHANGED — ownership NOT migrated — checkpoint B17-SAFE-FAIL-CLOSED=`935377a` |
| B18 | `inventory.stock` ownership | ✅ COMPLETED | 1405/05/30 | 12:29:33 | `PHASE_3_ARCHITECTURE_MIGRATION_STEP_B18_INVENTORY_STOCK_OWNERSHIP.md` — commit `76c92e6` — HTML 631 / Core 159 PASS — EXE fail-closed — HTML-only JS preserved — mutations NONE — live EXE NEEDS HUMAN VERIFICATION |
| B19 | Inventory mutation boundary safety | ✅ COMPLETED | 1405/05/30 | 13:00:55 | `PHASE_3_ARCHITECTURE_MIGRATION_STEP_B19_INVENTORY_MUTATION_BOUNDARY_SAFETY.md` — product `e414025` (gates `fb4a8fe`) — HTML 639 / Core 159 PASS — reserve/release/consume/OUT gated on `stockDataAvailable` — no `core.stock \|\| snapshot` — live EXE NEEDS HUMAN VERIFICATION |

---

## B6 Verification Record

- **B6:** `sale.line`
- **Commit:** `66e78be`
- **Report:** `deliveries/Reports/PHASE_3_ARCHITECTURE_MIGRATION_STEP_B6_SALE_LINE_OWNERSHIP.md`
- **Implementation:** COMPLETED
- **HTML tests:** `596 PASS / 0 FAIL`
- **Core tests:** `142 PASS / 0 FAIL`
- **Regression:** PASS
- **HTML-only:** PASS
- **Persistence:** UNCHANGED
- **Backup:** UNCHANGED
- **Print engine:** UNTOUCHED
- **Locked business workflows:** UNCHANGED
- **`sale.total`:** NOT MIGRATED
- **Live EXE:** NEEDS HUMAN VERIFICATION

### B6 Human Verification

⬜ NOT YET VERIFIED

این مورد عمداً جدا از تست‌های خودکار است و بعداً در چک‌لیست تست انسانی محل کار ثبت خواهد شد.

---

## B7 Analysis Record

- **B7:** next ownership seam analysis (not a product migration)
- **Report:** `deliveries/Reports/PHASE_3_ARCHITECTURE_MIGRATION_STEP_B7_NEXT_OWNERSHIP_SEAM.md`
- **Analysis:** ANALYSIS COMPLETED
- **Implementation:** NOT STARTED
- **CODE MODIFIED:** NO
- **Recommended next seam:** `sale.total` (`calcSaleTotal` → `InvoicePricing.SaleTotal`)
- **Readiness:** READY FOR FUTURE IMPLEMENTATION
- **Parity:** PARITY PARTIAL at B7 time (formula = sum of B6 `sale.line`; frozen totals table was missing)
- **Follow-up:** B8 gate authorized and completed `sale.total` ownership

---

## B8 Verification Record

- **B8:** `sale.total`
- **Commit:** `9582215`
- **Report:** `deliveries/Reports/PHASE_3_ARCHITECTURE_MIGRATION_STEP_B8_SALE_TOTAL.md`
- **Implementation:** COMPLETED
- **HTML tests:** `600 PASS / 0 FAIL`
- **Core tests:** `146 PASS / 0 FAIL`
- **B6 regression:** PASS
- **Fail-closed:** `0` sentinel kept; JS reduce not used on EXE Core miss
- **HTML-only:** PASS (`sum(calcSaleLine.total)`)
- **Persistence:** UNCHANGED
- **Backup:** UNCHANGED
- **Print engine:** UNTOUCHED
- **Locked business workflows:** UNCHANGED
- **Core formula:** UNCHANGED (`SaleTotal` = sum of `SaleLine`)
- **Live EXE:** NEEDS HUMAN VERIFICATION

### B8 Human Verification

⬜ NOT YET VERIFIED

---

## B9 Analysis Record

- **B9:** next ownership seam analysis (not a product migration)
- **Report:** `deliveries/Reports/PHASE_3_ARCHITECTURE_MIGRATION_STEP_B9_NEXT_OWNERSHIP_SEAM.md`
- **Analysis:** ANALYSIS COMPLETED
- **Implementation:** NOT STARTED
- **CODE MODIFIED:** NO
- **Recommended next seam:** `calc.warrantyEndDate` (`calcWarrantyEndDate` → `CalculationEngine.WarrantyEndDate`)
- **Readiness:** PARITY LOCK REQUIRED
- **Parity:** PARITY PARTIAL at B9 time (JS `addJalaliMonths` ≈ Core `AddJalaliMonths`; no shared frozen date table)
- **Follow-up:** B10 locked slash-date vectors; ownership still NOT STARTED

---

## B10 Parity Lock Record

- **B10:** `calc.warrantyEndDate` parity lock (not ownership migration)
- **Commit:** `da78c6a`
- **Report:** `deliveries/Reports/PHASE_3_ARCHITECTURE_MIGRATION_STEP_B10_PARITY_LOCK.md`
- **Parity:** CONFIRMED (frozen slash-date table)
- **Implementation:** NOT STARTED
- **PRODUCT CODE MODIFIED:** NO
- **HTML tests:** `602 PASS / 0 FAIL`
- **Core tests:** `149 PASS / 0 FAIL`
- **B5 / B6 / B8 regression:** PASS
- **Persistence:** UNCHANGED
- **Backup:** UNCHANGED
- **Print engine:** UNTOUCHED
- **Locked business workflows:** UNCHANGED
- **B11:** COMPLETED (see B11 Verification Record)

---

## B11 Verification Record

- **B11:** `calc.warrantyEndDate`
- **Commit:** `405bcb1`
- **Report:** `deliveries/Reports/PHASE_3_ARCHITECTURE_MIGRATION_STEP_B11_WARRANTY_ENDDATE_OWNERSHIP.md`
- **Implementation:** COMPLETED
- **PRODUCT CODE MODIFIED:** YES
- **HTML tests:** `609 PASS / 0 FAIL`
- **Core tests:** `149 PASS / 0 FAIL`
- **Parity:** CONFIRMED (B10 slash-date table still green)
- **Fail-closed:** `null` on Host present + Core miss; JS `addJalaliMonths` not used
- **HTML-only:** PASS (`addJalaliMonths` unchanged)
- **Persistence:** UNCHANGED
- **Backup:** UNCHANGED
- **Print engine:** UNTOUCHED
- **Locked business workflows:** UNCHANGED (`warranty.save` / `warranty.close` / `warranty.delete`)
- **Calendar arithmetic:** UNCHANGED
- **B12:** ANALYSIS COMPLETED (see B12 Analysis Record)
- **Live EXE:** NEEDS HUMAN VERIFICATION

---

### B11 Human Verification

⬜ NOT YET VERIFIED

---

## B12 Analysis Record

- **B12:** change gate / next ownership seam analysis (not a product migration)
- **Report:** `deliveries/Reports/PHASE_3_ARCHITECTURE_MIGRATION_STEP_B12_CHANGE_GATE.md`
- **Analysis:** ANALYSIS COMPLETED
- **Implementation:** NOT STARTED
- **CODE MODIFIED:** NO
- **Recommended next seam:** `rules.suggestParts` (`suggestPartsForCase` → `PartsAdvisor.Suggest`)
- **Readiness:** PARITY LOCK REQUIRED
- **Parity:** PARITY PARTIAL (JS ranking ≈ Core `PartsAdvisor.Suggest`; no shared frozen suggestion table)
- **Not selected:** unused `calc.*` (no live caller); `inventory.stock` (locked family); `warranty.canTransition` (locked-apply adjacency); `service.*` (FORBIDDEN)
- **Follow-up:** B13 locked suggestion vectors; ownership still NOT STARTED

---

## B13 Parity Lock Record

- **B13:** `rules.suggestParts` parity lock (not ownership migration)
- **Commit:** `8446619`
- **Report:** `deliveries/Reports/PHASE_3_ARCHITECTURE_MIGRATION_STEP_B13_RULES_SUGGESTPARTS_PARITY_LOCK.md`
- **Parity:** CONFIRMED (frozen catalog table, 13 cases)
- **Implementation:** NOT STARTED
- **PRODUCT CODE MODIFIED:** NO
- **HTML tests:** `611 PASS / 0 FAIL`
- **Core tests:** `151 PASS / 0 FAIL`
- **B5 / B6 / B8 / B11 regression:** PASS
- **Inventory mutation:** NONE
- **Persistence:** UNCHANGED
- **Backup:** UNCHANGED
- **Print engine:** UNTOUCHED
- **Locked business workflows:** UNCHANGED
- **B14:** COMPLETED (see B14 Verification Record)

---

## B14 Verification Record

- **B14:** `rules.suggestParts`
- **Commit:** `dae7cde`
- **Report:** `deliveries/Reports/PHASE_3_ARCHITECTURE_MIGRATION_STEP_B14_RULES_SUGGESTPARTS_OWNERSHIP.md`
- **Implementation:** COMPLETED
- **PRODUCT CODE MODIFIED:** YES
- **HTML tests:** `616 PASS / 0 FAIL`
- **Core tests:** `151 PASS / 0 FAIL`
- **Parity:** CONFIRMED (B13 catalog table still green)
- **Fail-closed:** `null` on Host present + Core miss/non-array; JS ranking not used
- **HTML-only:** PASS (B13 vectors)
- **Inventory mutation:** NONE
- **Persistence:** UNCHANGED
- **Backup:** UNCHANGED
- **Print engine:** UNTOUCHED
- **Locked business workflows:** UNCHANGED (`warranty.save` / `warranty.close` / `warranty.delete`)
- **PartsAdvisor algorithm:** UNCHANGED
- **B15:** ANALYSIS COMPLETED / SELECTION BLOCKED (see B15 Analysis Record)
- **Live EXE:** NEEDS HUMAN VERIFICATION

### B14 Human Verification

⬜ NOT YET VERIFIED

---

## B15 Analysis Record

- **B15:** change gate / next ownership seam analysis (not a product migration)
- **Report:** `deliveries/Reports/PHASE_3_ARCHITECTURE_MIGRATION_STEP_B15_CHANGE_GATE.md`
- **Analysis:** ANALYSIS COMPLETED
- **Selection:** BLOCKED
- **Implementation:** NOT STARTED
- **CODE MODIFIED:** NO
- **Recommended next seam:** NONE (no remaining seam satisfies all ten B15 §5 rules)
- **Readiness:** NO AUTHORIZED SEAM
- **Parity:** N/A (no selected seam; no parity lock added)
- **Not selected:** unused `calc.*` (no live caller); `inventory.stock` (locked family + §6 do-not-auto-choose); `warranty.canTransition` (no EXE live caller + locked-apply adjacency); `payment.deposit` (unused result); `service.*` (FORBIDDEN)
- **Follow-up:** wait for B16 instruction. Do not start B16 from this report.

---

## B16 Verification Record

- **B16:** architecture decision + `inventory.stock` parity preparation
- **Report:** `deliveries/Reports/PHASE_3_ARCHITECTURE_MIGRATION_STEP_B16_ARCHITECTURE_DECISION_AND_ROLLBACK_GATE.md`
- **Decision:** `inventory.stock` AUTHORIZED for parity only; OWNERSHIP NOT AUTHORIZED
- **Parity:** CONFIRMED (18 frozen snapshot vectors)
- **Implementation (ownership):** NOT STARTED
- **CODE MODIFIED:** tests/docs only
- **PRODUCT CODE MODIFIED:** NO
- **HTML tests:** `619 PASS / 0 FAIL`
- **Core tests:** `154 PASS / 0 FAIL`
- **Regression:** PASS
- **Inventory mutation:** NONE
- **Persistence:** UNCHANGED
- **Backup:** UNCHANGED
- **Print engine:** UNTOUCHED
- **Rollback protocol:** DEFINED (`B14-GOOD` = `dae7cde`; revert not `reset --hard`)
- **Checkpoint protocol:** DEFINED (`B16-PARITY` = `23a4776`)
- **Fail-closed:** NOT DESIGNED (current `invStockSnapshot` remains fail-open)
- **B17:** COMPLETED (see B17 Verification Record)
- **Live EXE:** NEEDS HUMAN VERIFICATION

### B16 Human Verification

⬜ NOT YET VERIFIED

---

## B17 Verification Record

- **B17:** safe fail-closed contract for `inventory.stock`
- **Report:** `deliveries/Reports/PHASE_3_ARCHITECTURE_MIGRATION_STEP_B17_SAFE_FAIL_CLOSED_INVENTORY.md`
- **Contract:** success = finite numeric `qty` (zero is data); failure = `{ok:false, reason:"INVENTORY_UNAVAILABLE"}`
- **Current runtime changed:** NO
- **Ownership:** NOT MIGRATED
- **PRODUCT CODE MODIFIED:** NO
- **HTML tests:** `625 PASS / 0 FAIL`
- **Core tests:** `159 PASS / 0 FAIL`
- **B16 parity:** PASS (18 vectors unchanged)
- **B17 safety tests:** PASS
- **Inventory mutation:** NONE
- **Persistence:** UNCHANGED
- **Backup:** UNCHANGED
- **Print engine:** UNTOUCHED
- **Checkpoint:** `B17-SAFE-FAIL-CLOSED` = `935377a`
- **B18:** COMPLETED (see B18 Verification Record)
- **Live EXE:** NEEDS HUMAN VERIFICATION

### B17 Human Verification

⬜ NOT YET VERIFIED

---

## B18 Verification Record

- **B18:** `inventory.stock` EXE ownership
- **Commit:** `76c92e6`
- **Report:** `deliveries/Reports/PHASE_3_ARCHITECTURE_MIGRATION_STEP_B18_INVENTORY_STOCK_OWNERSHIP.md`
- **Implementation:** COMPLETED
- **PRODUCT CODE MODIFIED:** YES
- **HTML tests:** `631 PASS / 0 FAIL`
- **Core tests:** `159 PASS / 0 FAIL`
- **Parity:** CONFIRMED (B16 18 vectors still green)
- **Fail-closed:** `{ok:false, reason:"INVENTORY_UNAVAILABLE"}` on Host present + Core miss; JS snapshot not used
- **HTML-only:** PASS (B16 vectors)
- **Inventory mutation:** NONE
- **Persistence:** UNCHANGED
- **Backup:** UNCHANGED
- **Print engine:** UNTOUCHED
- **Locked business workflows:** UNCHANGED
- **InventoryCore.Stock / PartsAdvisor:** UNCHANGED
- **Checkpoint:** `B18-FINAL-GOOD` = `76c92e6`
- **B19:** COMPLETED (see B19 Verification Record)
- **Live EXE:** NEEDS HUMAN VERIFICATION

### B18 Human Verification

⬜ NOT YET VERIFIED

---

## B19 Verification Record

- **B19:** inventory mutation boundary safety (not a new ownership seam)
- **Commits:** `fb4a8fe` (gates) / `e414025` (return sanitize) — FINAL-GOOD `e414025`
- **Report:** `deliveries/Reports/PHASE_3_ARCHITECTURE_MIGRATION_STEP_B19_INVENTORY_MUTATION_BOUNDARY_SAFETY.md`
- **Implementation:** COMPLETED
- **PRODUCT CODE MODIFIED:** YES (HTML mutation **boundary** only)
- **HTML tests:** `639 PASS / 0 FAIL`
- **Core tests:** `159 PASS / 0 FAIL`
- **B16 parity:** PASS (18 vectors unchanged)
- **B17 contract:** PASS
- **B18 ownership:** PRESERVED
- **Fail-closed:** Core stock unavailable → reserve/release/consume/applyByWarehouse OUT **not** called; no fake zero; no JS snapshot on EXE return
- **HTML-only:** PASS (existing success path; unavailable stub does not mutate)
- **Inventory algorithms:** UNCHANGED
- **Persistence:** UNCHANGED
- **Backup:** UNCHANGED
- **Print engine:** UNTOUCHED
- **Locked business workflows:** UNCHANGED
- **Deferred:** `saveWarehouseDoc` EXE reorder (TRANSACTION ORDERING BLOCKER); `_restockFromSale` move-on-miss
- **Checkpoint:** `B19-FINAL-GOOD` = `e414025`
- **B20:** NOT STARTED
- **Live EXE:** NEEDS HUMAN VERIFICATION

### B19 Human Verification

⬜ NOT YET VERIFIED

---

## Rules for Updating This Tracker

1. هر مرحله فقط با گزارش MD همان مرحله ثبت می‌شود.
2. بدون تست و گزارش، مرحله تیک نمی‌خورد.
3. `NEEDS HUMAN VERIFICATION` به معنی `COMPLETED` خودکار نیست؛ هر دو وضعیت جدا ثبت می‌شوند.
4. تغییرات Print، Persistence، Backup، Invoice locked workflow، Inventory mutation، Accounting، Warranty mutation و Security باید با Change Gate کنترل شوند.
5. `sale.total` در B6 عمداً تغییر نکرد. B7 آن را انتخاب کرد. B8 مالکیت عددی `sale.total` را مهاجرت داد.
6. هیچ مرحله‌ای بدون دستور مرحله بعد شروع نمی‌شود.
7. هر مرحله جدید باید تاریخ و ساعت اجرای واقعی خودش را ثبت کند.
8. فایل‌های Cursor و گزارش‌های Cursor باید Markdown (`.md`) باشند.
9. قبل از شروع هر مرحله، Branch و Worktree باید بررسی شوند.
10. پس از پایان هر مرحله: TEST → REGRESSION → REPORT → STOP.

---

## Current Position

```text
A1–A6 = COMPLETED
B1–B6 = COMPLETED
B7     = ANALYSIS COMPLETED
B8     = COMPLETED
B8 LIVE EXE = NEEDS HUMAN VERIFICATION
B9     = ANALYSIS COMPLETED
B10    = COMPLETED (parity lock)
B11    = COMPLETED
B11 IMPLEMENTATION = COMPLETED
B11 LIVE EXE = NEEDS HUMAN VERIFICATION
B12    = ANALYSIS COMPLETED
B12 IMPLEMENTATION = NOT STARTED
B13    = COMPLETED (parity lock)
B14    = COMPLETED
B14 IMPLEMENTATION = COMPLETED
B14 LIVE EXE = NEEDS HUMAN VERIFICATION
B15    = ANALYSIS COMPLETED
B15 IMPLEMENTATION = NOT STARTED
B15 SELECTION = BLOCKED
B16    = COMPLETED (parity lock)
B16 OWNERSHIP = NOT STARTED
B16 LIVE EXE = NEEDS HUMAN VERIFICATION
B17    = COMPLETED (contract + tests)
B17 OWNERSHIP = NOT STARTED
B17 LIVE EXE = NEEDS HUMAN VERIFICATION
B18    = COMPLETED
B18 IMPLEMENTATION = COMPLETED
B18 LIVE EXE = NEEDS HUMAN VERIFICATION
B19    = COMPLETED
B19 IMPLEMENTATION = COMPLETED
B19 LIVE EXE = NEEDS HUMAN VERIFICATION

Last known good product checkpoint = B19-FINAL-GOOD e414025
B18-FINAL-GOOD = 76c92e6
B16 parity checkpoint = B16-PARITY 23a4776
B17 contract checkpoint = B17-SAFE-FAIL-CLOSED 935377a
Recommended next seam = wait for B20 instruction
PRINT       = FROZEN
PERSISTENCE = UNCHANGED
BACKUP      = UNCHANGED
```

**NEXT ACTION:** هیچ مرحلهٔ بعد شروع نشود تا دستور صریح B20 برسد.
