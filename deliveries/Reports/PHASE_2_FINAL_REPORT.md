# PHASE 2 FINAL REPORT — سیرمان

تاریخ: ۱۴۰۵/۰۵/۲۷ (۱۸ اوت ۲۰۲۶)  
نسخه محصول: **1405.5.27α**  
شاخه: `cursor/print-module-isolation-3733`

## وضعیت نهایی

```
PHASE 2 = COMPLETE
PRINT = ISOLATED
PHYSICAL PRINT = NOT VERIFIED
PHASE 3 = READY
```

چاپ فیزیکی **ثابت نشده** است. چاپگر **تعمیر نشده** است.
عدم تأیید کاغذ مانع ورود فاز ۳ نیست.

---

## 1. Phase 2 Scope

فاز ۲: تثبیت معماری Host/Core، کنترل داده (هویت فاکتور، برگشت انبار/حساب)، گزارش، Backup، آماده‌سازی مرکز چاپ، و تشخیص سخت‌افزار چاپ.

خروج فاز ۲ در این کار: **انزوای ماژول چاپ** بدون بازنویسی مرکز پرینت و بدون دست زدن به ماژول‌های قفل‌شده.

خارج از محدوده این کار:

- Fix حدسی چاپ
- بازنویسی Print Center / `WindowsPrintHost.cs`
- Feature جدید چاپ
- تغییر فاکتور، مشتری، انبار، حساب، گارانتی، Backup/Restore، Reports، شماره‌گذاری، هویت داده

---

## 2. Completed Items

| مورد | وضعیت |
|------|--------|
| Print Module شناسایی شد | COMPLETED |
| Print Boundary مشخص شد | COMPLETED |
| Hardware Diagnostic جداست | COMPLETED |
| PDF و Physical Print جدا هستند | COMPLETED |
| Business Modules به جزئیات Printer وابسته نیستند | COMPLETED (نام چاپگر از قرارداد؛ درایور/پورت/اسپولر فقط در تشخیص) |
| Print Errorها Isolated هستند | COMPLETED (try/catch در Host + Adapter؛ استثنا به BusinessFacade نمی‌رود) |
| Business Data تحت تأثیر Print نیست | COMPLETED (تست موجود: چاپ فاکتور/موجودی/حساب را عوض نمی‌کند) |
| Regression موجود موفق است | COMPLETED (HTML ۵۴۳ / C# ۱۲۵) |
| Documentation به‌روز است | COMPLETED |
| Physical Printer Test به‌عنوان NOT VERIFIED ثبت شد | COMPLETED |

معیار خروج فاز ۲ برای توسعه نرم‌افزار برقرار است. تأیید کاغذ فروشگاه الزامیِ COMPLETE بودن توسعه فاز ۲ نبود.

---

## 3. Print Module Boundary

```
Invoice / Warranty / Inventory / Accounting / Reports
        ↓  (فقط READ سند برای قالب)
printEngine*  (UI contract — Sirman_Final.html)
        ↓
sirmanHost.GetPrinters | PrintHtml | PrintDocument | GetPrintJob
        ↓
IPrintService  (desktop/Sirman.Core/Printing)
        ↓
PrintServiceAdapter  (wrap)
        ↓
WindowsPrintHost  (WebView2 PrintAsync / enumeration)
        ↓
Windows Spooler / Driver / Port / Printer
```

مسیر جدا (هرگز با مسیر بالا مخلوط نشود):

```
Settings → تشخیص چاپگر  /  منو چاپ → تشخیص سخت‌افزار
        ↓
sirmanHost.RunPrintHardwareDiagnostic
        ↓
PrintHardwareDiagnostic + PrintHardwareFacts
```

فایل‌های داخل مرز چاپ:

- `desktop/Sirman.Core/Printing/IPrintService.cs`
- `desktop/Sirman.Core/Printing/PrintStatusContract.cs`
- `desktop/Sirman.Core/Printing/PrintHardwareFacts.cs`
- `desktop/Sirman.Desktop/PrintServiceAdapter.cs`
- `desktop/Sirman.Desktop/WindowsPrintHost.cs` (**بازنویسی نشد**)
- `desktop/Sirman.Desktop/PrintHardwareDiagnostic.cs`
- Host methods بالا در `SirmanHostObject.cs`
- UI: توابع `printEngine*` / `pcDoPrint` / `pcDoPdf` / تب `print-diag`

بیرون مرز: `BusinessFacade` / `InvoiceService` / Inventory Core / Payment / Warranty — هیچ‌کدام PrintAsync یا اسپولر را صدا نمی‌زنند.

---

## 4. Print Architecture

WRAP نه REWRITE:

- `WindowsPrintHost` همان موتور تولیدی است.
- `PrintServiceAdapter` همان متدها را صدا می‌زند و JSON را با `contractStatus` / `physicalPrintStatus` / `printJobIdentity` غنی می‌کند.
- فیلد میراث `status` (مثلاً `PRINT_SUBMITTED`) حفظ شد تا UI موجود نشکند.
- `purpose=print` و `purpose=pdf` جدا می‌مانند. PDF هرگز PHYSICAL_PRINT_VERIFIED نمی‌شود.

شناسه کار چاپ موجود است: `printJobId` = `PJ-` + Guid کوتاه. InvoiceNumber هویت کار چاپ نیست.

---

## 5. Print Dependencies

| ماژول | وابستگی به چاپ | جهت |
|--------|----------------|------|
| Invoice / Sale / Warranty / Reports | باز کردن مرکز پرینت / قالب HTML | Print ← می‌خواند (READ) |
| Print | نام چاپگر، کاغذ، کپی | به Windows |
| Hardware Diagnostic | هیچ داده کسب‌وکار | فقط Windows |
| Inventory / Accounting / Backup | ندارد | Unaffected |

Affected این isolation: Printing (قرارداد + Adapter + اسناد).  
Potentially affected: پاسخ JSON Host (فیلد اضافه؛ UI فیلد ناشناخته را نادیده می‌گیرد).  
Unaffected: Invoice, Customer, Inventory, Accounting, Warranty, Backup, Restore, Reports, Invoice Numbering, Data Identity.

---

## 6. Hardware Diagnostic Status

**READY FOR REAL WINDOWS HARDWARE TEST** (از کار قبلی روی کیت 1405.5.27α).

در این isolation دست نخورد. همچنان مستقل از Invoice/Accounting/Inventory/Warranty است.

---

## 7. Physical Printing Status

**PHYSICAL_PRINT_NOT_VERIFIED**

محیط فعلی Linux Cloud است؛ چاپگر واقعی ویندوز اینجا اجرا نمی‌شود.
ارسال به صف (`PRINT_SUBMITTED` / قرارداد `SUBMITTED`) چاپ کاغذ نیست.
موفقیت PDF چاپ کاغذ نیست.

---

## 8. Locked Modules

در این کار **عوض نشدند**:

- Invoice (هویت `InvoiceId`)
- Customer
- Inventory (برگشت آثار)
- Accounting (برگشت مبلغ)
- Warranty
- Backup / Restore
- Reports
- Invoice Numbering
- Data Identity

`WindowsPrintHost.cs` نیز برای جلوگیری از بازنویسی موتور تولیدی دست نخورد.

---

## 9. Regression Results

دستور:

```
node test_laegh.js Sirman_Final.html
dotnet test desktop/Sirman.Core.Tests/Sirman.Core.Tests.csproj
```

| مجموعه | نتیجه |
|--------|--------|
| HTML کل | ۵۴۳ موفق / ۰ ناموفق |
| C# Core | ۱۲۵ موفق / ۰ ناموفق |
| Invoice (گروه ۲۹، ۳۴، هویت حذف) | PASS |
| Invoice Delete isolation | PASS |
| Inventory (گروه ۲۷ و موتور انبار) | PASS |
| Accounting / برگشت | PASS (داخل مجموعه HTML + C# reversal) |
| Warranty | PASS (گروه‌های موجود) |
| Backup / Restore (BackupEngine + گروه ۲/۵/۱۱/۲۲/۲۳) | PASS |
| Reports | PASS (گروه‌های موجود چاپ/گزارش داخلی) |
| Print Center + PDF≠print | PASS |
| Print isolation contract | PASS |
| PrintHardwareFacts + PrintStatusContract | PASS |

تست جعلی ساخته نشد.

### مرز تست چاپ (بند ۱۳)

| # | موضوع | تست کد | محیط واقعی |
|---|--------|---------|------------|
| 1 | Printer Enumeration | PASS (mock HTML + ListPrinters) | NOT TESTABLE HERE |
| 2 | Printer Classification | PASS (`PrintHardwareFactsTests`) | — |
| 3 | Default Printer | PASS (parse JSON host) | NOT TESTABLE HERE |
| 4 | Driver | MISSING TEST (زنده ویندوز) | NOT TESTABLE HERE |
| 5 | Port | PASS واحد (`ClassifyPort`)؛ زنده MISSING | NOT TESTABLE HERE |
| 6 | Spooler | PASS واحد (`SPOOLER_UNAVAILABLE`)؛ SCM زنده MISSING | NOT TESTABLE HERE |
| 7 | Direct Windows Print | کد هست؛ اجرای زنده MISSING | NOT TESTABLE HERE |
| 8 | Queue | PASS واحد (`MapJobStatus`)؛ EnumJobs زنده MISSING | NOT TESTABLE HERE |
| 9 | WebView2 Print | کد هست؛ اجرای زنده MISSING | NOT TESTABLE HERE |
| 10 | PDF Export | PASS (`printEngineSavePdf`) | — |
| 11 | Physical Print Verification | **NOT VERIFIED** | نیاز به PC فروشگاه |

نبود تست زندهٔ ۴/۷/۹/۱۱ مانع COMPLETE توسعه فاز ۲ و ورود فاز ۳ نیست.

---

## 10. Known Limitations

- EXE روی این لینوکس بالا نمی‌آید (`Microsoft.WindowsDesktop.App` برای linux-x64 نیست).
- لاگ تشخیص در `%LOCALAPPDATA%\Sirman\print\PRINT_DIAGNOSTIC.log` است نه Roaming `%AppData%`.
- UI هنوز با نام چاپگر PDF را حدس می‌زند (`printEngineIsPdfPrinter`)؛ طبقه‌بندی کانونی Core است. این isolation آن را جابه‌جا نکرد.
- کیت نصب 1405.5.27α همان EXE قبلی است؛ Adapter در سورس است و در بیلد بعدی EXE می‌آید. رفتار چاپ تولیدی `WindowsPrintHost` عوض نشد.
- `GetPrintJob` / `PrintDocument` از قبل در Host بودند و در لیست معماری ثبت شدند (متد جدید ساخته نشد).

---

## 11. Known Risks

- فیلدهای JSON اضافه ممکن است کلاینت خیلی سخت‌گیر را گیج کند؛ UI فعلی `JSON.parse` و فیلد `status` میراث را می‌خواند.
- فاز ۳ اگر دوباره داخل `WindowsPrintHost` یا `pcDoPrint` دست ببرد، isolation می‌شکند — سند حاکمیت چاپ را FROZEN کرده.
- تا تست کاغذ فروشگاه، هر «چاپ درست شد» ادعای نادرست است.

Rollback: برگشت به `cursor/print-hardware-diag-3733` @ `8c80430` / کیت `Sirman_Setup_1405.5.27α.zip`.

---

## 12. Phase 3 Entry Status

**PHASE 3 = READY**

قواعد ورود:

- Feature جدید روی شاخه جدا: Implementation → Tests → Regression → Review → Merge
- Print = FROZEN / ISOLATED
- PRINT MUST NOT BLOCK PHASE 3
- PHASE 3 MUST NOT BREAK PRINT
- NO SPECULATIVE PRINT FIX
- NO PRINT REWRITE
- NO UNRELATED REFACTOR روی ماژول‌های قفل‌شده

گزارش کار حاکمیت (۱۵ بند):

1. Task: انزوای ماژول چاپ و خروج فاز ۲  
2. Branch: `cursor/print-module-isolation-3733`  
3. Baseline Version: 1405.5.27α  
4. Files: قرارداد Core، Adapter، MainForm wrap، اسناد، یک تست isolation  
5. Modules Changed: Printing (قرارداد) + Docs  
6. Dependencies: Print ← UI سند را می‌خواند؛ Business را نمی‌نویسد  
7. Root Cause: نیاز به مرز فاز ۳ بدون بلوکه شدن پشت کاغذ  
8. Fix: WRAP با `IPrintService`؛ بدون بازنویسی موتور  
9. Tests: HTML ۵۴۳ PASS / C# ۱۲۵ PASS  
10. Regression: Invoice/Delete/Inventory/Accounting/Warranty/Backup/Reports PASS  
11. Data Impact: هیچ  
12. Real Environment Test: چاپ کاغذ NOT VERIFIED  
13. Risks: بالا  
14. Rollback: شاخه تشخیص / کیت 27α  
15. Final Status: **COMPLETED** برای isolation توسعه؛ چاپ کاغذ **NEEDS HUMAN VERIFICATION**

---

## فایل‌ها

- `/workspace/docs/PHASE_2_FINAL_REPORT.md`
- `/workspace/docs/PRINT_MODULE_BASELINE.md`
- `/workspace/Sirman_Final.html`
- `/workspace/Sirman_Setup_1405.5.27α.zip`
- `/workspace/PRINT_HARDWARE_DIAGNOSTIC_REPORT.md`
- `/workspace/PRINT_HARDWARE_WINDOWS_READINESS.md`
