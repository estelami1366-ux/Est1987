# SIRMAN — گزارش کار: طراحی فاز ۲ (آداپتر موازی SQLite)

**Date:** 1405/05/29 (20 August 2026)  
**PR:** https://github.com/estelami1366-ux/Est1987/pull/53  
**Design:** `deliveries/Reports/PHASE_2_SQLITE_PARALLEL_ADAPTER_DESIGN.md`  

---

## حکم

```text
DESIGN = APPROVED
IMPLEMENTATION = NOT STARTED
EXECUTABLE PROMPT = NOT WRITTEN
PHASE 0 PRINT = NOT_RUN  →  execution stays BLOCKED
RUNTIME CHANGED = NO
VERSION BUMPED = NO
SQL IN REPO = ABSENT
```

صاحب پروژه در ۱۴۰۵/۰۵/۲۹ مرزهای طراحی را تأیید کرد. پرامپت اجرایی و کد SQLite بعد از ثبت `OUTCOME` فاز ۰ ساخته می‌شوند.

---

## تصمیم‌های تأییدشده (خلاصه)

1. SQLite پیاده‌سازی دوم قراردادهای `Sirman.Core.Data.Repositories` است، نه منبع حقیقت.
2. منبع حقیقت می‌ماند: HTML `localStorage` / IndexedDB.
3. مدل: یک ردیف، ستون `json` + کلید؛ نه جدول نرمال، نه EF.
4. `Save` = `CurrentJsonStore.MergeItem` موجود.
5. اسمبلی جدا `Sirman.Core.Sqlite`؛ `Sirman.Desktop` در فاز ۲ Reference نمی‌دهد.
6. `IBackupRepository` پیاده نمی‌شود؛ BackupEngine HTML کپی نمی‌شود.
7. `Reserve` / `Consume` / `Reverse` روی ریپو برنمی‌گردند.
8. پوشش فقط فاکتور / موجودی / حساب / گارانتی / کاربر. بقیهٔ بک‌آپ بیرون است.
9. بند معماری ۴.۱ بعد از فاز ۰ ثبت می‌شود، نه در این گزارش.

---

## گزارش کار (۱۵ بند)

1. **Task:** طراحی آداپتر موازی SQLite و ثبت تأیید انسانی؛ بدون کد و بدون پرامپت اجرایی
2. **Branch:** `cursor/phase-2-sqlite-design-3733`
3. **Baseline Version:** `1405.5.27γ` — bump نشد
4. **Files Changed:**
   - `deliveries/Reports/PHASE_2_SQLITE_PARALLEL_ADAPTER_DESIGN.md`
   - `deliveries/Reports/PHASE_2_SQLITE_DESIGN_REPORT.md`
5. **Modules Changed:** هیچ ماژول اجرایی (چاپ / فاکتور / انبار / حساب / گارانتی / HTML / Host دست‌نخورده)
6. **Dependencies:** Phase 1 PR #51، Phase 1b PR #52؛ اجرا وابسته به فاز ۰
7. **Root Cause:** قرارداد Get/Save بدون آداپتر دیسک؛ منبع حقیقت هنوز HTML است
8. **Fix:** طراحی سند-در-SQLite، اسمبلی جدا، بدون سیم‌کشی؛ تأیید ثبت شد
9. **Tests:** کد محصول عوض نشد. کف باقی‌ماندهٔ فاز ۱b: Core **134** / HTML **574** (این برش طراحی است، سوئیت دوباره اجرا نشد)
10. **Regression:** بدون تغییر runtime — رگرسیون محصول لازم نبود
11. **Data Impact:** صفر — هیچ schema زنده، هیچ فایل `.sqlite`
12. **Real Environment Test:** لازم نیست برای سند. چاپ فیزیکی: `OUTCOME = NOT_RUN`
13. **Risks:** Dual-write زودهنگام؛ شروع کد قبل از فاز ۰؛ توهم جایگزینی کامل localStorage
14. **Rollback:** revert همین دو فایل گزارش؛ محصول تغییر نکرده
15. **Final Status:** **BLOCKED** (اجرا پشت فاز ۰). طراحی: **APPROVED**

---

## بعد از این گزارش

- فاز ۰: چک‌لیست چاپ فیزیکی پر شود (`PHYSICAL_PRINT_VERIFIED` یا `PHYSICAL_PRINT_FAILED`).
- بعد از آن: پرامپت اجرایی از روی سند طراحی، سپس کد آداپتر بدون سیم‌کشی.
- تا آن وقت: SQLite، Host جدید، dual-write، و bump نسخه ممنوع است.
