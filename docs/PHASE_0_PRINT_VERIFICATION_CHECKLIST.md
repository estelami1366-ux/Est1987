# PHASE 0 — چک‌لیست تأیید چاپ فیزیکی

**نسخه محصول مورد انتظار:** `1405.5.27γ` (یا همان نسخه‌ای که روی PC فروشگاه نصب است)  
**وضعیت فعلی (قبل از تست انسانی):** `PHYSICAL_PRINT_NOT_VERIFIED`  
**این فایل تست دستی است. پاس شدن تست کد ≠ برگه کاغذ.**

چاپ منجمد است. این چک‌لیست رفتار چاپ را عوض نمی‌کند؛ فقط می‌گوید کجا نگاه کنید.

---

## چه چیزی را تست می‌کنیم

مسیر تولیدی کاغذ:

```text
مرکز پرینت / چاپ سریع
  → printEnginePrintHtml
  → sirmanHost.PrintDocument | PrintHtml
  → MainForm.EnqueueHtmlPrint     ← لاگ فاز ۰ (ENQUEUE_*)
  → IPrintService.Enqueue
  → WindowsPrintHost.Enqueue      ← print-jobs.jsonl (PRINT_REQUESTED …)
  → CoreWebView2.PrintAsync       ← print-jobs.jsonl (PRINT_ASYNC_STARTED / COMPLETED)
  → اسپولر ویندوز
  → چاپگر فیزیکی
```

`PRINT_SUBMITTED` یعنی صف ویندوز سند را قبول کرد — **نه** اینکه برگه آمده است.

مسیر **تشخیص چاپگر** (`PRINT_DIAGNOSTIC.log`) مسیر تولیدی مرکز پرینت نیست. برای فاز ۰ از دکمهٔ «🖨 چاپ» مرکز پرینت استفاده کنید، نه چاپ آزمایشی تشخیص.

---

## پیش‌نیاز

- [ ] برنامه را با **`Sirman.exe`** باز کنید (نه دوبارکلیک HTML، نه `Sirman_Start.bat` / مرورگر).
- [ ] نسخه را در پایین سایدبار ببینید.
- [ ] چاپگر واقعی ویندوز روشن و پیش‌فرضِ غیر-PDF باشد. Microsoft Print to PDF چاپ کاغذ نیست.
- [ ] کاغذ در سینی باشد.
- [ ] اگر صفحه ورود آمد، وارد شوید (چاپ Host ممکن است به نشست نیاز داشته باشد).

---

## مراحل چاپ واقعی

1. یک فاکتور ذخیره‌شده باز کنید (یا سند دیگری که دکمه چاپ/مرکز پرینت دارد).
2. **تنظیمات → تب مرکز پرینت**.
3. چاپگر فیزیکی را انتخاب کنید (نه PDF).
4. پیش‌نمایش را ببینید — پیش‌نمایش چاپ نیست.
5. دکمه **🖨 چاپ** را بزنید (`pcDoPrint`).
6. پیام روی صفحه را یادداشت کنید (ارسال به صف / خطا / `NO_HOST`).
7. اگر `NO_HOST` آمد: این exe نیست یا پوسته قدیمی است — تست را متوقف کنید.
8. به چاپگر بروید و صبر کنید تا برگه بیاید یا نیاید.
9. پوشه لاگ را باز کنید: منوی **چاپ → باز کردن پوشه لاگ چاپ**.

---

## کجا لاگ را بخوانید

پوشه:

```text
%LOCALAPPDATA%\Sirman\print\
```

معمولاً:

```text
C:\Users\<نام‌کاربر>\AppData\Local\Sirman\print\
```

| فایل | چه چیزی را نشان می‌دهد | نقطهٔ مسیر |
|---|---|---|
| `PHASE_0_OBSERVE.log` | `ENQUEUE_CALL` سپس `ENQUEUE_RETURN` (JSON کار چاپ، از جمله `printJobId`) | ورود Desktop بعد از Host — **بدون تغییر موتور منجمد** |
| `print-jobs.jsonl` | هر وضعیت کار: `PRINT_REQUESTED`, `PRINT_ASYNC_STARTED`, `PRINT_ASYNC_COMPLETED`, `PRINT_SUBMITTED` یا `PRINT_FAILED` / `PRINT_ASYNC_FAILED` | میانه + خروج `PrintAsync` — **از قبل در `WindowsPrintHost` موجود بود؛ دست نخورده** |
| `PRINT_DIAGNOSTIC.log` | فقط هارنس تشخیص | **استفاده نکنید** برای حکم فاز ۰ روی مسیر تولیدی |

در `PHASE_0_OBSERVE.log` یک خط `ENQUEUE_RETURN` باید `printJobId` شبیه `PJ-` داشته باشد. همان شناسه را در آخرین خط‌های `print-jobs.jsonl` پیدا کنید.

رویدادهای مهم در `print-jobs.jsonl` / فیلد `events`:

- `PRINT_ASYNC_STARTED` — `PrintAsync` صدا زده شد
- `PRINT_ASYNC_COMPLETED` — مقدار برگشتی (`Succeeded` / `PrinterUnavailable` / …)
- `PRINT_SUBMITTED` — صف قبول کرد (هنوز کاغذ تأیید انسانی می‌خواهد)
- `PDF_EXPORTED` — این تست کاغذ نیست؛ فاز ۰ را با PDF نبندید

---

## نتیجه (حتماً پر شود)

فقط یکی را علامت بزنید. تاریخ و نام چاپگر را خالی نگذارید.

```text
OUTCOME = [ PHYSICAL_PRINT_VERIFIED | PHYSICAL_PRINT_FAILED | NOT_RUN ]

DATE = ____ / ____ / ________
TESTER = ________________
MACHINE = ________________
SIRMAN_EXE_VERSION = ________________
PRINTER_NAME = ________________
PRINT_JOB_ID = PJ-________________
PAPER_CAME_OUT = [ YES | NO ]
NOTES = ________________
```

### PHYSICAL_PRINT_VERIFIED فقط اگر همهٔ این‌ها درست باشد

- [ ] از `Sirman.exe` چاپ شد
- [ ] دکمه چاپ مرکز پرینت بود (نه تشخیص، نه PDF)
- [ ] در لاگ `PRINT_ASYNC_COMPLETED` با `Succeeded` دیده شد **یا** صف ویندوز کار را نشان داد
- [ ] **برگهٔ کاغذ از همان چاپگر بیرون آمد** و محتوای سند سیرمان بود

`ENQUEUE_RETURN` یا `PRINT_SUBMITTED` به‌تنهایی VERIFIED نیست.

### PHYSICAL_PRINT_FAILED اگر

- برگه نیامد، یا
- `PRINT_ASYNC_FAILED` / `PrinterUnavailable` / `NO_PRINTER` / `PDF_NOT_PRINT` / `NO_HOST`، یا
- برگه از چاپگر دیگری آمد / صفحه خالی / دیالوگ PDF

---

## بعد از ثبت نتیجه

این نتیجه را به عامل برگردانید. تا وقتی `OUTCOME = PHYSICAL_PRINT_VERIFIED` یا `PHYSICAL_PRINT_FAILED` پر نشده، فاز ۰ بسته نیست.

بازنویسی چاپ، فاز ۱ اینترفیس مخزن، SQL، یا REST را از روی این چک‌لیست شروع نکنید.
