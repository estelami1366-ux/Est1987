# PRINT MODULE BASELINE

ثبت: ۱۴۰۵/۰۵/۲۷ (۱۸ اوت ۲۰۲۶)  
نسخه محصول: **1405.5.27α**  
وضعیت ماژول: **ISOLATED / FROZEN**  
چاپ کاغذ: **PHYSICAL_PRINT_NOT_VERIFIED**

این سند نسخهٔ فعلی چاپ را قفل می‌کند تا فاز ۳ روی آن سوار شود.
بازنویسی مرکز پرینت نیست. Fix حدسی چاپ نیست.

---

## Git

- شاخهٔ تشخیص: `cursor/print-hardware-diag-3733`
- شاخهٔ isolation: `cursor/print-module-isolation-3733`
- محصول UI/EXE همین نسخه: `1405.5.27α` (کیت `Sirman_Setup_1405.5.27α.zip`)

## مرز فایل‌ها (نقشه واقعی، نه حدس)

### قرارداد (Core — بدون Win32)

- `desktop/Sirman.Core/Printing/IPrintService.cs`
- `desktop/Sirman.Core/Printing/PrintStatusContract.cs`
- `desktop/Sirman.Core/Printing/PrintHardwareFacts.cs` (طبقه‌بندی قابل‌تست؛ تشخیص نه مرکز پرینت)

### موتور ویندوز (Desktop — wrap می‌شود، بازنویسی نشد)

- `desktop/Sirman.Desktop/WindowsPrintHost.cs` — PrintAsync، کشف چاپگر، صف کار `PJ-…`
- `desktop/Sirman.Desktop/PrintServiceAdapter.cs` — پوشش `IPrintService` روی همان موتور
- `desktop/Sirman.Desktop/PrintHardwareDiagnostic.cs` — هارنس جدا
- `desktop/Sirman.Desktop/SirmanHostObject.cs` — `GetPrinters`, `PrintHtml`, `PrintDocument`, `GetPrintJob`, `RunPrintHardwareDiagnostic`
- `desktop/Sirman.Desktop/MainForm.cs` — اتصال Host به `IPrintService` + تشخیص جدا

### UI چاپ (HTML تک‌فایل — در این isolation دست نخورد)

- `Sirman_Final.html` — `printEngine*`, `pcDoPrint`, `pcDoPdf`, Settings → تشخیص چاپگر
- مسیر کسب‌وکار به چاپ: `printEnginePrintHtml` / `openPrintCenter` / `PrintEngine`

### تست

- `desktop/Sirman.Core.Tests/PrintHardwareFactsTests.cs`
- `desktop/Sirman.Core.Tests/PrintStatusContractTests.cs`
- `test_laegh.js` — گروه مرکز پرینت + تشخیص + انزوا

## قرارداد وضعیت

میراث موتور (`status`) حفظ می‌شود. فیلد قرارداد اضافه‌شده: `contractStatus`, `physicalPrintStatus`, `printJobIdentity`.

| قرارداد | معنی |
|---|---|
| NOT_STARTED | کار ثبت نشده / PRINT_REQUESTED |
| PRINTER_NOT_FOUND | NO_PRINTER / PRINTER_NOT_FOUND |
| PRINTER_RESOLUTION_FAILED | PRINTER_UNAVAILABLE / PDF_NOT_PRINT / NO_DEFAULT_PRINTER |
| SPOOLER_UNAVAILABLE | PRINT_SPOOLER_FAILED |
| SUBMITTED | PRINT_SUBMITTED (ارسال به صف ≠ کاغذ) |
| QUEUED | صف ویندوز |
| PRINTING | در حال ارسال/چاپ |
| COMPLETED | اتمام مسیر فیزیکی در کد (هنوز کاغذ تأیید انسانی می‌خواهد) |
| FAILED | PRINT_FAILED |
| PDF_EXPORTED | خروجی فایل — چاپ کاغذ نیست |
| PHYSICAL_PRINT_NOT_VERIFIED | پیش‌فرض تا شاهد برگه |
| PHYSICAL_PRINT_VERIFIED | فقط تأیید انسانی روی چاپگر واقعی |

## هویت کار چاپ

موجود است و حفظ شد: `printJobId` = `PJ-` + ۱۲ رقم هگز از Guid.

`documentId` / InvoiceId فقط همبستگی سند است، نه هویت کار چاپ.
`InvoiceNumber` هویت کار چاپ نیست.

## قانون فاز ۳

- PRINT MUST NOT BLOCK PHASE 3
- PHASE 3 MUST NOT BREAK PRINT
- NO SPECULATIVE PRINT FIX
- NO PRINT REWRITE
