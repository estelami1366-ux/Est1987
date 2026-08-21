# SIRMAN — PHASE 3 MIGRATION TRACKER

**Tracker mode:** ACTIVE  
**Last updated:** 1405/05/30 10:20:55 (Asia/Tehran)  
**Branch:** `cursor/phase-3-architecture-migration-3733`  
**Current known HEAD:** `79784f6`  
**B6 commit:** `66e78be` (`feat: migrate sale.line ownership to core`)  
**B8 commit:** `9582215` (`feat: migrate sale.total ownership to core`)  
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
| B10 | Migration checkpoint | ⬜ NOT STARTED | — | — | فقط طبق Change Gate |

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
- **Parity:** PARITY PARTIAL (JS `addJalaliMonths` ≈ Core `AddJalaliMonths`; no shared frozen date table)
- **B10:** NOT STARTED (checkpoint; not authorized by B9)

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
B9 IMPLEMENTATION = NOT STARTED
B10    = NOT STARTED

Recommended next seam = calc.warrantyEndDate
READINESS = PARITY LOCK REQUIRED
PRINT       = FROZEN
PERSISTENCE = UNCHANGED
BACKUP      = UNCHANGED
```

**NEXT ACTION:** پیاده‌سازی `calc.warrantyEndDate` فقط پس از دستور صریح جداگانه. B10 (checkpoint) شروع نشده است.
