# SIRMAN — PHASE 3 MIGRATION TRACKER

**Tracker mode:** ACTIVE  
**Last updated:** 1405/05/29 19:09:01 (Asia/Tehran)  
**Branch:** `cursor/phase-3-architecture-migration-3733`  
**Current known HEAD:** `f3b4202`  
**B6 commit:** `66e78be` (`feat: migrate sale.line ownership to core`)  
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
| B7 | Next ownership seam | ⬜ NOT STARTED | — | — | فقط پس از دستور صریح B7 |
| B8 | Next ownership seam | ⬜ NOT STARTED | — | — | تعیین پس از B7 |
| B9 | Next ownership seam | ⬜ NOT STARTED | — | — | تعیین پس از B8 |
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

## Rules for Updating This Tracker

1. هر مرحله فقط با گزارش MD همان مرحله ثبت می‌شود.
2. بدون تست و گزارش، مرحله تیک نمی‌خورد.
3. `NEEDS HUMAN VERIFICATION` به معنی `COMPLETED` خودکار نیست؛ هر دو وضعیت جدا ثبت می‌شوند.
4. تغییرات Print، Persistence، Backup، Invoice locked workflow، Inventory mutation، Accounting، Warranty mutation و Security باید با Change Gate کنترل شوند.
5. `sale.total` در B6 عمداً تغییر نکرده است.
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
B7     = NOT STARTED

B6 LIVE EXE = NEEDS HUMAN VERIFICATION
PRINT       = FROZEN
PERSISTENCE = UNCHANGED
BACKUP      = UNCHANGED
```

**NEXT ACTION:** تعیین و اجرای B7 فقط پس از دستور صریح.
