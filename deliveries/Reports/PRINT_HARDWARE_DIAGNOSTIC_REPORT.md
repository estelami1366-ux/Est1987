# PRINT HARDWARE DIAGNOSTIC REPORT

نسخه برنامه: `1405.5.27α` / اسمبلی `1405.5.27.1`  
تاریخ سند: ۱۴۰۵/۰۵/۲۷ (۱۸ اوت ۲۰۲۶)

این گزارش نتیجهٔ ساخت هارنس تشخیص است، نه ادعای تعمیر مرکز پرینت.

وضعیت نهایی: **BLOCKED — REAL WINDOWS PRINTER REQUIRED**

---

## 1. Environment

| موضوع | مقدار | نوع ادعا |
|---|---|---|
| محل ساخت/تست عامل | Linux Cloud Agent | PROVEN FACT |
| محصول هدف | Windows `Sirman.exe` + Windows Print Spooler | PROVEN FACT (طراحی) |
| چاپگر فیزیکی در این محیط | وجود ندارد | PROVEN FACT |
| PDF-only / mock printer | برای نتیجهٔ کاغذ پذیرفته نشد | PROVEN FACT |

## 2. Windows Version

NOT TESTABLE IN CURRENT ENVIRONMENT

عامل ابری لینوکس است. نسخه ویندوز فروشگاه فقط وقتی ثبت می‌شود که هارنس روی همان PC اجرا شود (`PRINT_DIAGNOSTIC.log` فیلد OS را می‌نویسد).

## 3. Sirman Version

PROVEN FACT

- `SIRMAN_VERSION.json`: `1405.5.27α`
- پوسته: `1405.5.27.1`
- EXE جدید این نسخه برای Host متد `RunPrintHardwareDiagnostic` لازم است. EXE قدیمی این متد را ندارد.

## 4. Printer Discovery

کد: `PrinterSettings.InstalledPrinters` + `GetDefaultPrinter` + `PRINTER_INFO_2`.

در این محیط اجرا نشد.

NOT TESTABLE IN CURRENT ENVIRONMENT (نیاز به Sirman.exe روی ویندوز)

## 5. Physical Printer Detection

کد طبقه‌بندی (قابل تست واحد، بدون ویندوز):

- `Microsoft Print to PDF` → VIRTUAL / pdf
- XPS / Fax / OneNote → VIRTUAL
- نام بدون این نشانه‌ها → PHYSICAL

PROVEN FACT (منطق کد + تست C#)

وجود چاپگر PHYSICAL روی فروشگاه: NOT TESTABLE IN CURRENT ENVIRONMENT

## 6. Default Printer

هارنس Windows Default را با `GetDefaultPrinter` و دید همین فرآیند (`PrinterSettings.PrinterName`) مقایسه می‌کند.

اگر یکی نباشند: `PRINTER_ENUMERATION_MISMATCH`

نتیجه واقعی فروشگاه: NOT TESTABLE IN CURRENT ENVIRONMENT

## 7. Driver

از `PRINTER_INFO_2.pDriverName`. اگر API ندهد: `NOT_AVAILABLE`. جعل نمی‌شود.

NOT TESTABLE IN CURRENT ENVIRONMENT

## 8. Port

از `PRINTER_INFO_2.pPortName` سپس طبقه‌بندی USB / TCP/IP / WSD / Network / FILE / Other / NOT_AVAILABLE.

PROVEN FACT: طبقه‌بندی پورت در تست واحد (مثلاً `USB001` → USB، رشته خالی → NOT_AVAILABLE)

پورت واقعی فروشگاه: NOT TESTABLE IN CURRENT ENVIRONMENT

## 9. Spooler

پرس‌وجوی سرویس `Spooler` با `OpenSCManager` / `OpenService` / `QueryServiceStatus`.

نتیجه: `SPOOLER_AVAILABLE` یا `SPOOLER_UNAVAILABLE`

NOT TESTABLE IN CURRENT ENVIRONMENT

## 10. Direct Windows Print

مسیر جدا: `System.Drawing.Printing.PrintDocument` + `StandardPrintController` (بدون دیالوگ مرورگر، بدون PDF، بدون فاکتور).

متن سند فقط:

```
SIRMAN
PRINT HARDWARE TEST
Timestamp / Printer / Machine
```

موفقیت این مسیر در کد حداکثر `PRINT_SUBMITTED` است نه PRINT SUCCESS.

NOT TESTABLE IN CURRENT ENVIRONMENT

## 11. Print Queue

بعد از ارسال، `EnumJobs` روی همان چاپگر. Job ID اگر نباشد: `JOB_ID_NOT_AVAILABLE`.

وضعیت‌های قابل ثبت: CREATED / QUEUED / PRINTING / COMPLETED / FAILED / DELETED / UNKNOWN

NOT TESTABLE IN CURRENT ENVIRONMENT

## 12. WebView2 Print

فقط بعد از مسیر مستقیم، مسیر جداگانه `CoreWebView2.PrintAsync` با همان سند آزمایشی — نه `WindowsPrintHost` مرکز پرینت.

NOT TESTABLE IN CURRENT ENVIRONMENT

## 13. Physical Print Verification

نرم‌افزار هرگز PRINT SUCCESS به‌خاطر PrintAsync نمی‌دهد.

تأیید کاغذ فقط دکمهٔ انسانی «برگه آمد» است → `PHYSICAL PRINT VERIFIED`

در غیر این صورت: `PHYSICAL_PRINT_NOT_VERIFIED`

PROVEN FACT (طراحی کد + تست واحد)

برگه واقعی: NOT TESTABLE IN CURRENT ENVIRONMENT

## 14. Exact Failure Layer

در این محیط لایهٔ شکست سخت‌افزار فروشگاه **قابل اثبات نیست**.

ماتریس اینجا:

| لایه | RESULT |
|---|---|
| Windows Printer Enumeration | NOT TESTABLE IN CURRENT ENVIRONMENT |
| Windows Default Printer | NOT TESTABLE IN CURRENT ENVIRONMENT |
| Printer Resolution | NOT TESTABLE IN CURRENT ENVIRONMENT |
| Driver Detection | NOT TESTABLE IN CURRENT ENVIRONMENT |
| Port Detection | NOT TESTABLE IN CURRENT ENVIRONMENT |
| Spooler Availability | NOT TESTABLE IN CURRENT ENVIRONMENT |
| Direct Print Submission | NOT TESTABLE IN CURRENT ENVIRONMENT |
| Print Queue Job | NOT TESTABLE IN CURRENT ENVIRONMENT |
| WebView2 PrintAsync | NOT TESTABLE IN CURRENT ENVIRONMENT |
| Physical Paper | FAIL (محیط کاغذ ندارد) |

PROVEN FACT: محیط عامل نمی‌تواند سؤال‌های ۱–۷ تکلیف را برای چاپگر فروشگاه جواب بدهد.

## 15. Root Cause Candidate

ASSUMPTION نیست؛ صریح:

**ROOT CAUSE CANDIDATE: NOT IDENTIFIED ON SHOP HARDWARE**

شواهد قبلی کاربر (PDF می‌آید، کاغذ نمی‌آید) با این سازگار است که:

- یا پیش‌فرض/انتخاب PDF بوده (مرکز پرینت قبلی این را رد می‌کند)
- یا اسپولر/درایور/پورت کاغذ نمی‌دهد
- یا WebView2 PrintAsync به چاپگر فیزیکی نمی‌رسد در حالی که GDI می‌رسد

بدون اجرای هارنس روی همان PC نمی‌توان یکی را انتخاب کرد.

## 16. Evidence

PROVEN FACT

- مرکز پرینت تولیدی (`WindowsPrintHost.cs` / `pcDoPrint`) در این کار تغییر داده نشد.
- هارنس جدا: `desktop/Sirman.Desktop/PrintHardwareDiagnostic.cs`
- Host: `RunPrintHardwareDiagnostic`
- UI: تنظیمات → تشخیص چاپگر؛ منوی exe: چاپ → تشخیص سخت‌افزار چاپ
- لاگ هدف: `%AppData%\Sirman\print\PRINT_DIAGNOSTIC.log`
- تست واحد طبقه‌بندی PDF/پورت/عدم تبدیل SUBMITTED به موفقیت کاغذ: موجود است
- این عامل لینوکس است و اسپولر ویندوز ندارد

## 17. Recommended Fix

تا نتیجهٔ هارنس روی PC فروشگاه نیاید **مرکز پرینت را عوض نکنید**.

روی ویندوز فروشگاه:

1. Sirman.exe همین نسخه `1405.5.27α` را باز کنید (HTML alone کافی نیست).
2. تنظیمات → تشخیص چاپگر.
3. فهرست را بخوانید: آیا PHYSICAL هست؟
4. Direct Windows Print بزنید.
5. WebView2 Print بزنید.
6. VIEW STATUS و اگر برگه آمد «برگه آمد».
7. فایل لاگ و ماتریس را برگردانید.

بعد از ماتریس:

- اگر Enumeration/Direct شکست: مرکز پرینت ریشه نیست.
- اگر Direct موفق و WebView2 شکست: مسیر PrintAsync برنامه ریشه است.
- اگر صف کامل شود و کاغذ نیاید: درایور/پورت/سخت‌افزار.

## 18. Files Modified

(لیست نهایی پس از commit همین شاخه؛ منطق کسب‌وکار قفل‌شده دست نخورده است.)

- `desktop/Sirman.Core/Printing/PrintHardwareFacts.cs` (جدید)
- `desktop/Sirman.Desktop/PrintHardwareDiagnostic.cs` (جدید)
- `desktop/Sirman.Desktop/SirmanHostObject.cs` (متد جدید)
- `desktop/Sirman.Desktop/MainForm.cs` (سیم‌کشی + منو)
- `desktop/Sirman.Core/Security/PermissionCatalog.cs` (مجوز Host)
- `Sirman_Final.html` / `Laegh_Final.html` (تب و توابع تشخیص؛ مرکز پرینت تولیدی دست نخورده)
- تست‌ها، نسخه، کیت، این گزارش

---

## Completion questions

1. Can Windows see the physical printer? **UNANSWERED — need shop PC**  
2. Can Sirman resolve it? **UNANSWERED — need shop PC**  
3. Is Spooler available? **UNANSWERED — need shop PC**  
4. Can Sirman submit a real job? **UNANSWERED — need shop PC**  
5. Does the job appear in the queue? **UNANSWERED — need shop PC**  
6. Does WebView2 path work? **UNANSWERED — need shop PC**  
7. Where does the pipeline fail? **UNANSWERED — need shop PC**

اگر این سؤال‌ها جواب داده نشوند: STATUS = BLOCKED

**STATUS = BLOCKED — REAL WINDOWS PRINTER REQUIRED**
