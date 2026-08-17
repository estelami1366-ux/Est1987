# STABLE BASELINE — سیرمان

ثبت‌شده: ۱۴۰۵/۰۵/۲۶ (۱۷ اوت ۲۰۲۶).

این فایل وضعیت پایدار *فعلی* است. قبل از Feature جدید آن را بخوان. بعد از انتشار تأییدشده به‌روز کن.

## محصول

- نسخه: `1405.5.26α` / اسمبلی `1405.5.26.1`
- منبع نسخه: `SIRMAN_VERSION.json`
- UI: `Sirman_Final.html` (تک‌فایل) + همگام `Laegh_Final.html`
- پوسته: .NET 8 WebView2 — `desktop/Sirman.Desktop` + `desktop/Sirman.Core`
- کیت جاری کد: `Sirman_Setup_1405.5.26α.zip`

## Git

- Commit ثبت این baseline: `865420f` (`fix: reject PDF printers on the real print path`)
- شاخه پایدار هدف: `main`
- کار جاری چاپ کاغذ: هنوز به `main` نرفته؛ چاپ فیزیکی VERIFIED نیست

## Build / Test (آخرین اجرای عامل)

- HTML: `node test_laegh.js Sirman_Final.html` — ۵۳۸ موفق / ۰ ناموفق
- C#: `dotnet test desktop/Sirman.Core.Tests` — ۹۲ موفق / ۰ ناموفق
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

- چاپ کاغذ: مسیر کد به اسپولر ویندوز است؛ **BLOCKED — PRINTER ENVIRONMENT ISSUE**. خروجی PDF چاپ نیست.
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
