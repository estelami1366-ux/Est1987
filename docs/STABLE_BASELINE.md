# STABLE BASELINE — سیرمان

ثبت‌شده: ۱۴۰۵/۰۶/۰۳ (۲۵ اوت ۲۰۲۶).

این فایل وضعیت پایدار *فعلی* است. قبل از Feature جدید آن را بخوان. بعد از انتشار تأییدشده به‌روز کن.

## محصول

- نسخه: `1405.6.3α` / اسمبلی `1405.6.3.1`
- منبع نسخه: `SIRMAN_VERSION.json`
- UI: `Sirman_Final.html` (تک‌فایل) + همگام `Laegh_Final.html`
- پوسته: .NET 8 WebView2 — `desktop/Sirman.Desktop` + `desktop/Sirman.Core`
- کیت جاری کد: `Sirman_Setup_1405.6.3α.zip` (خودکفا)
- قفل فاز ۲ (چاپ منجمد): تگ `phase-2-closed-1405.5.27-alpha` @ `5af08eb`

## Git

- Commit محصول چاپ قبلی: `865420f` (`fix: reject PDF printers on the real print path`)
- کار جاری: چاپ ایزوله و منجمد برای ورود فاز ۳؛ چاپ فیزیکی VERIFIED نیست
- شاخه پایدار هدف: `main`

## Build / Test (آخرین اجرای عامل)

- HTML: `node test_laegh.js Sirman_Final.html` — ۶۴۷ موفق / ۰ ناموفق
- C#: `dotnet test desktop/Sirman.Core.Tests` — ۲۰۲ موفق / ۰ ناموفق
- این اعداد Linux/CI هستند، نه تأیید چاپگر فروشگاه

## قابلیت‌های پایدار (Locked مگر باگ ثابت یا Requirement جدید)

- هویت فاکتور (`InvoiceId`) و حذف جداسازی‌شده
- ممنوعیت شماره فاکتور تکراری در فاکتور جدید
- برگشت آثار حذف فاکتور / گارانتی / فروش (انبار + حساب همان سند)
- `saleUid` برای حذف فروش
- بک‌آپ Schema + Manifest + Checksum + ادغام/جایگزینی
- مسیر Host Object `sirmanHost` (بدون REST/SQL موازی)
- نقش‌ها و صفحات موجود HTML (سیستم نقش موازی نساز)

## باز / تأییدنشده در محیط واقعی

- چاپ کاغذ: مسیر کد به اسپولر ویندوز است؛ **PHYSICAL_PRINT_NOT_VERIFIED**. خروجی PDF چاپ نیست.
- ماژول چاپ **ISOLATED / FROZEN** است (`IPrintService` روی `WindowsPrintHost`). فاز ۳ چاپ را بازنویسی نمی‌کند.
- هارنس تشخیص چاپگر جداست؛ نتیجه لایه شکست فقط روی PC ویندوز فروشگاه قابل اثبات است.
- شبکه LAN فایل‌اشتراکی: مرحله محدود؛ API کسب‌وکار روی HTTP ساخته نشده

## باگ‌های شناخته‌شده

- چاپ فیزیکی روی PC فروشگاه هنوز تأیید نشده
- EXE قدیمی + HTML جدید برای چاپ کافی نیست؛ پوسته همین نسخه لازم است
- پیش‌فرض ویندوز اگر Microsoft Print to PDF باشد، دکمه چاپ باید خطا بدهد نه فایل

## پیکربندی کاری

- ارتباط UI↔Core: `chrome.webview.hostObjects.sync.sirmanHost`
- داده HTML-only: localStorage / فایل بک‌آپ
- در exe: Core منبع حقیقت محاسبات حساس است؛ HTML-only fallback JS دارد
- Database جدا وجود ندارد

## ماژول‌های موجود (خلاصه)

Core, Customers, Invoices, Sales, Inventory, Accounting, Warranty, Printing, Reports, Backup, Settings/Security/LAN, Help, Multi-window UI.

وابستگی چاپ: Printing می‌خواند از Invoice/Sale/Warranty؛ نباید آن‌ها را بنویسد.
