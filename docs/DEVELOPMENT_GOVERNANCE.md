# حاکمیت توسعه و حفاظت پروژه سیرمان

این سند دستورالعمل دائمی است. از این به بعد هر Feature، Bugfix و Hotfix باید مطابق آن باشد.

باطل‌کنندهٔ قوانین موجود نیست. همراه این‌ها خوانده و اجرا شود:

- `.agents/skills/laegh-software-workflow/SKILL.md` (نسخه شمسی، تست، فایل تک‌تکه، لانچر)
- `docs/ARCHITECTURE_RULES.md` (لایه‌ها، Host Object، ممنوعیت REST/SQL موازی)
- `docs/STABLE_BASELINE.md` (وضعیت پایدار فعلی)
- `docs/REGRESSION_SUITE.md` (نقشه تست رگرسیون)
- `CHANGELOG.md`

قانون مادر:

**STABLE CODE IS PROTECTED.**

قبل از هر تغییر:

`ANALYZE → ISOLATE → MODIFY → TEST → REGRESSION → VERIFY → APPROVE`

ممنوع: `MODIFY → HOPE IT WORKS`

قانون طلایی:

- یک قابلیت را با خراب کردن قابلیت دیگر درست نکن.
- کد پایدار را بدون شواهد دست نزن.
- بدون راستی‌آزمایی، موفقیت اعلام نکن.

---

## گردش‌کار اجباری

```
REQUEST
 → ANALYZE
 → CHECK ARCHITECTURE
 → CHECK DEPENDENCIES
 → CREATE ISOLATED BRANCH / SNAPSHOT
 → IMPLEMENT MINIMAL CHANGE
 → BUILD
 → UNIT / INTEGRATION / REGRESSION / DATA INTEGRITY
 → REAL ENVIRONMENT TEST (اگر به محیط واقعی وابسته است)
 → HUMAN VERIFICATION (در صورت نیاز)
 → MERGE
 → TAG / VERSION / CHANGELOG
 → STABLE
```

اگر هر مرحله Fail شد: **STOP.** اول مشکل را حل کن.

AI حق ندارد Feature را مستقیم روی `main` بنویسد.

---

## نسخه و Git در این پروژه

این پروژه **Semantic Versioning به‌شکل v1.4.0 ندارد.** شماره محصول شمسی است:

`{Major}.{ماه}.{روز}{حرف یونانی}`

منبع واحد: `SIRMAN_VERSION.json`

- اصلاح همان روز = حرف یونانی بعدی (α→β→γ…)
- روز جدید = تاریخ شمسی جدید + α
- اسمبلی ویندوز: `Major.Month.Day.{letterIndex}`

تغییر طرح نسخه‌گذاری بدون تصمیم صریح ممنوع است.

شاخه پایدار محصول: `main`. فقط نسخهٔ تست‌شده باید به `main` برود.

شاخه کار:

| نوع | نام پیشنهادی انسانی | عامل ابری این محیط |
|---|---|---|
| Feature | `feature/<name>` | `cursor/<name>-3733` |
| Bugfix | `bugfix/<name>` | `cursor/<name>-3733` |
| Hotfix | `hotfix/<name>` | `cursor/<name>-3733` |

ممنوع: `final`, `final2`, `final-new`, `final-last-real`.

قبل از کار پرریسک: baseline در `docs/STABLE_BASELINE.md` را بخوان و در صورت تغییر وضعیت به‌روز کن.

---

## مرز ماژول

ماژول‌های واقعی این نرم‌افزار (نه نمونهٔ کلی):

| ماژول | محل اصلی امروز | وضعیت |
|---|---|---|
| Core / Host | `desktop/Sirman.Core`, `SirmanHostObject.cs` | انتقال تدریجی |
| Customers | HTML دفترچه + Host در exe | پایدار |
| Invoices | HTML + `RunBusiness` در exe | **LOCKED** هویت داخلی |
| Sales | HTML فروش قطعات | پایدار؛ حذف با saleUid |
| Inventory | HTML Inventory Engine + Core در exe | **LOCKED** برگشت آثار |
| Accounting | HTML حساب‌ها + Core پرداخت | **LOCKED** برگشت مبلغ سند |
| Warranty | HTML + Core ثبت/بستن | **LOCKED** مگر باگ ثابت |
| Printing | HTML Print Center + `IPrintService` روی `WindowsPrintHost` | **FROZEN / ISOLATED**؛ کاغذ NOT VERIFIED |
| Reports | HTML | پایدار |
| Backup | HTML BackupEngine + Host فایل | پایدار؛ Schema را نشکن |
| Settings / Security / LAN | HTML + Host | پایدار؛ REST موازی نساز |

LOW COUPLING / HIGH COHESION. بدون دلیل به جزئیات داخلی ماژول دیگر دست نزن.

از خروج فاز ۲: PRINT MUST NOT BLOCK PHASE 3 و PHASE 3 MUST NOT BREAK PRINT. تغییر چاپ بدون شاهد سخت‌افزار ممنوع است.

اگر ماژول LOCKED باید عوض شود، قبل از کد بنویس:

`WHY THIS LOCKED MODULE MUST CHANGE`

و تغییر را حداقل نگه دار.

---

## تغییر حداقلی

اگر باگ در Printing است، فقط Printing را عوض کن.

ممنوع بدون ضرورت: Refactor سراسری، Rename بی‌ربط، عوض کردن تکنولوژی، حذف کد سالم، Microservice، دیتابیس جدید، REST API جدید.

اول: **MINIMAL SAFE FIX.**

---

## نقشه وابستگی قبل از تغییر

قبل از کد مشخص کن:

- این ماژول به چه چیز وابسته است؟
- چه ماژول‌هایی به آن وابسته‌اند؟

گزارش کن:

- Affected Modules
- Potentially Affected Modules
- Unaffected Modules

نمونه چاپ:

`Printing → Invoice (خواندن سند) → Customer (نمایش)`

چاپ باید Read-Only باشد. فاکتور/انبار/حساب را تغییر ندهد.

---

## قراردادها (Contracts)

مسیر مجاز UI↔Core: `chrome.webview.hostObjects.sync.sirmanHost`

بدون ضرورت Contract را عوض نکن. اگر Breaking Change لازم است صریح بنویس: **BREAKING CHANGE**.

هویت موجودیت‌ها (نه شماره نمایشی به‌عنوان کلید حذف):

- Invoice → `InvoiceId`
- Sale → `saleUid`
- Print Job → `printJobId`
- Customer / Warranty / Payment / Inventory Transaction: همان شناسه پایدار موجود

حذف باید فقط همان رکورد هدف را بردارد.

---

## داده

داده واقعی از کد مهم‌تر است.

قبل از تغییر مدل: Backup + Migration + Rollback + سازگاری بک‌آپ قدیمی.

ممنوع: پاک کردن داده برای سبز کردن تست، Reset پروداکشن، Schema بدون Migration.

Database جدا و REST برای منطق کسب‌وکار تا اطلاع ثانوی ساخته نمی‌شود (`docs/ARCHITECTURE_RULES.md`).

---

## تست

قبل از Fix: Reproduce با Expected / Actual / Steps. بعد Root Cause. Blind Fix ممنوع.

بعد از Fix:

1. تست همان باگ
2. `node test_laegh.js Sirman_Final.html`
3. `dotnet test desktop/Sirman.Core.Tests/Sirman.Core.Tests.csproj`
4. رگرسیون ماژول‌های مرتبط (`docs/REGRESSION_SUITE.md`)
5. تست محیط واقعی اگر Feature به آن وابسته است

**NO TEST = NO MERGE**

PASS شدن تست به‌تنهایی یعنی Feature سالم نیست؛ تست باید رفتار واقعی را پوشش دهد. تست جدید بعد از هر باگ مهم در `test_laegh.js` / تست C# **باقی می‌ماند**.

چاپ:

`Code Test ≠ Real Printer Test`

بک‌آپ:

`Code Test ≠ Real Restore Test`

EXE:

`Linux Test ≠ Windows EXE Test`

---

## موفقیت جعلی ممنوع

اعلام نکن: FIXED / VERIFIED / COMPLETE مگر شواهد واقعی باشد.

اگر تست لازم در دسترس نیست: **BLOCKED**.

وضعیت نهایی فقط یکی از این‌ها:

| وضعیت | معنی |
|---|---|
| COMPLETED | کد و تست‌های قابل اجرا تمام شده |
| VERIFIED | کد + تست مناسب + محیط واقعی در صورت نیاز |
| BLOCKED | تست یا وابستگی لازم در دسترس نیست |
| FAILED | پیاده‌سازی یا تست شکست خورده |
| NEEDS HUMAN VERIFICATION | فقط کاربر در محیط واقعی می‌تواند تأیید کند |

چاپ کاغذ تا وقتی برگه واقعی بیرون نیاید VERIFIED نیست.

---

## دروازه تکمیل Feature

هیچ Featureای COMPLETE نیست مگر:

- [ ] Root Cause / Requirement مشخص است
- [ ] Scope مشخص است
- [ ] Dependencies بررسی شده
- [ ] تغییر Isolated است
- [ ] Build موفق است
- [ ] تست HTML / C# مرتبط موفق است
- [ ] رگرسیون موفق است
- [ ] یکپارچگی داده تأیید شده
- [ ] تست محیط واقعی در صورت نیاز انجام شده
- [ ] ماژول LOCKED بی‌دلیل عوض نشده
- [ ] راهنما (اگر UI جدید است) به‌روز است
- [ ] Rollback ممکن است (شاخه / نسخه قبلی / بک‌آپ)
- [ ] CHANGELOG و گزارش کار به‌روز است

---

## دروازه فاز ۳

Feature جدید فاز ۳ روی شاخه جدا: Implementation → Tests → Regression → Review → Merge.

چاپ **FROZEN / ISOLATED** است. بدون دلیل مشخص (شکست اثبات‌شده روی چاپگر واقعی) به ماژول چاپ دست نزن.

**PHASE 3 CHANGE GATE = MANDATORY.** منبع کامل: `docs/PHASE_3_CHANGE_GATE.md`.

قبل از نوشتن، ویرایش، حذف، جابه‌جایی یا بازنام‌گذاری هر فایل منبع:

`STOP → CLASSIFY → TRACE → CHECK BOUNDARIES → PRODUCE GATE RESULT → ONLY THEN IMPLEMENT`

بدون `Gate: PASS` پیاده‌سازی ممنوع است. `BLOCK` یعنی هیچ فایلی عوض نشود. شواهد ناکافی = `INSUFFICIENT EVIDENCE`، نه `PASS`.

در فاز ۳: seam معماری امن وجود ندارد؛ استخراج معماری، SQL/SQLite به‌عنوان منبع حقیقت، REST کسب‌وکار، Host دوم، ACL دوم، و بازنویسی چاپ ممنوع است مگر تصمیم معماری بعدی همان تغییر را صریح مجاز کند.

## Rollback و انتشار

اولویت بعد از Regression بحرانی: **ROLLBACK**، نه وصله تصادفی.

هر انتشار در `CHANGELOG.md`: Version, Date, Added, Changed, Fixed, Known Issues.

---

## قبل از تغییر بزرگ

اگر چند ماژول، Data Model، Core، Contract یا Architecture عوض می‌شود، قبل از اجرا بنویس:

WHY / WHAT / AFFECTED MODULES / RISK / ROLLBACK PLAN

---

## گزارش کار الزامی (بعد از هر Feature/Bugfix)

1. Task
2. Branch
3. Baseline Version
4. Files Changed
5. Modules Changed
6. Dependencies
7. Root Cause
8. Fix
9. Tests (Passed / Failed / Skipped)
10. Regression
11. Data Impact
12. Real Environment Test
13. Risks
14. Rollback
15. Final Status (یکی از پنج وضعیت بالا)
