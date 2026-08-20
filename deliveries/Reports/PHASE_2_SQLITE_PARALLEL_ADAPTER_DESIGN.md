# SIRMAN — طراحی فاز ۲: آداپتر موازی SQLite

**Date:** 1405/05/29 (20 August 2026)  
**Kind:** DESIGN ONLY — کد، NuGet، Host، HTML، و پرامپت اجرایی در این کار نیست  
**Branch:** `cursor/phase-2-sqlite-design-3733`  
**Depends on:** Phase 1 PR #51 + Phase 1b PR #52  
**Blocked for execution:** Phase 0 print checklist (`docs/PHASE_0_PRINT_VERIFICATION_CHECKLIST.md`) still `OUTCOME = NOT_RUN`  
**Version bumped:** NO  

---

## این فاز ۲ کدام است؟

در این پروژه دو «فاز ۲» وجود دارد. قاطی نشوند:

| نام | چیست | وضعیت |
|---|---|---|
| **فاز ۲ محصول** (چاپ / Business Core) | `RunBusiness`، انزوای چاپ، تگ `phase-2-closed-1405.5.27-alpha` | بسته |
| **فاز ۲ مهاجرت persist** | آداپتر SQLite روی قراردادهای `Sirman.Core.Data.Repositories` | **همین سند — فقط طراحی** |

از این به بعد در این مسیر مهاجرت، «فاز ۲» یعنی **آداپتر موازی SQLite**. چاپ منجمد است و به این فاز مربوط نیست.

پرامپت اجرایی Cursor برای پیاده‌سازی **ساخته نشد** و تا بسته شدن فاز ۰ ساخته نمی‌شود.

---

## هدف وقتی اجرا مجاز شود

یک پیاده‌سازی دوم از **همان** اینترفیس‌های Get/Save فاز ۱، روی SQLite، که:

- رفتار برنامه فروشگاه را عوض نکند
- منبع حقیقت داده نماند (منبع حقیقت همچنان `localStorage` / IndexedDB داخل HTML است)
- به `BusinessFacade` / HTML / چاپ / Host وصل نشود
- قانون کسب‌وکار (`InventoryCore`, `PaymentRules`, …) را دوباره پیاده نکند

معیار خروج طراحی (الان): تصمیم‌ها مکتوب و قابل رد/تأیید باشد.  
معیار خروج اجرا (بعداً، بعد از فاز ۰): تست قرارداد JSON و SQLite روی فیکسچر یکسان هم‌ارز باشند؛ exe دست‌نخورده بماند.

---

## «موازی» یعنی چه — و چه چیزی ممنوع است

معماری می‌گوید سیستم موازی برای قابلیت موجود نساز. آداپتر موازی **سیستم کسب‌وکار دوم نیست**.

| مجاز (فاز ۲ persist) | ممنوع |
|---|---|
| دو کلاس پشت یک قرارداد: `JsonInvoiceRepository` و `SqliteInvoiceRepository` | دو منبع حقیقت هم‌زمان (dual-write به localStorage و SQLite) |
| تست پاریتی روی فیکسچر واحد | Host جدید / REST / EF Entity به نام `Invoice` |
| فایل SQLite فقط در تست (`:memory:` یا temp) | `Sirman.exe` فایل `.sqlite` بسازد یا بخواند |
| Schema نسخه ۱ داخل آداپتر | کپی `BackupEngine` HTML داخل SQLite |
| | بازگرداندن `Reserve` / `Consume` / `Reverse` روی ریپو |

```text
UI HTML  ──localStorage──►  منبع حقیقت فعلی (دست‌نخورده)
                │
RunBusiness ──► BusinessFacade ──► CurrentJsonStore.MergeItem   (دست‌نخورده)
                │
                ✕ هیچ فلشی به SQLite در این فاز نیست

تست‌ها فقط:
  IInvoiceRepository ──► Json*     (کیسه حافظه + MergeItem)
  IInvoiceRepository ──► Sqlite*   (جدول سند + همان MergeItem)
```

تا یک تصمیم ثبت‌شدهٔ جدید در `docs/ARCHITECTURE_RULES.md`، بند ۱۰ همان است: persist از آداپتر JSON است؛ Database در مسیر اجرایی برنامه ساخته نمی‌شود. این سند **پیشنهاد** می‌دهد که بعد از فاز ۰، وجود آداپتر SQLiteِ بدون سیم‌کشی به‌عنوان استثناء صریح ثبت شود — خودِ آن ویرایش الان انجام نمی‌شود.

---

## ANALYZE — وضعیت persist امروز

| لایه | واقعیت |
|---|---|
| UI store | `localStorage` (`li` فاکتور، `lp` کالا، `lv` موجودی، `lb` دفترچه، …) + IndexedDB |
| Core merge | `CurrentJsonStore` — Get/Save ندارد؛ فقط MergeItem/MergeMap |
| قرارداد قدیمی | `Sirman.Core.Data.IInvoiceRepository` و خواهرها — فقط Merge |
| قرارداد جدید | `Sirman.Core.Data.Repositories.*` — Get/Save/Delete — **بدون سیم‌کشی** |
| نوع سند | `JsonObject` (کلاس persist به نام Invoice وجود ندارد) |
| SQLite در ریپو | هیچ پکیج و هیچ فایلی نیست |
| `IBackupRepository` | TBD؛ مالک `exportData` / `migrateBackup` در HTML است |
| `BusinessFacade` | هنوز به `CurrentJsonStore` (Merge) وابسته است نه به ریپوهای جدید |

### پوشش قرارداد در برابر دادهٔ زنده

بک‌آپ کامل HTML حدود ۳۰ بخش دارد (`invoices`, `products`, `inventory`, `phonebook`, `parts`, `warranties`, `sales`, `accounts`, `tasks`, `warehouses`, ظاهر، چاپ، نقش‌ها، …).

فاز ۱ فقط پنج مرز Get/Save (+ بک‌آپ TBD) ساخت. بنابراین **SQLite فاز ۲ نمی‌تواند جایگزین localStorage شود** حتی اگر فردا سیم‌کشی شود. این یک محدودیت طراحی است نه باگ اجرا.

| بخش زنده | قرارداد فاز ۱ | در SQLite فاز ۲ |
|---|---|---|
| فاکتور (`li`) | `IInvoiceRepository` | بله — سند JSON |
| موجودی (`lv` / کالا با `code`) | `IInventoryRepository` | بله — سند JSON |
| حساب (`accounts` + `trx`) | `IPaymentRepository` | بله — سند JSON حساب |
| گارانتی | `IWarrantyRepository` | بله — سند JSON |
| کاربر (`LoginUser`) | `IUserRepository` | بله — ردیف کاربر (نه `userRoles` HTML) |
| بک‌آپ / schema / merge | `IBackupRepository` TBD | **نه** — پیاده‌سازی SQLite ندارد |
| دفترچه، فروش، قطعات، خدمات، انبار نام‌دار، وظایف، تنظیمات، چاپ | ندارد | **خارج از محدوده** |

---

## تصمیم‌های قفل‌شده برای اجرای بعدی

این‌ها برای پرامپت اجرایی بعدی قطعی‌اند مگر همین سند با تصمیم صریح عوض شود.

### D1 — مدل ذخیره: سند داخل SQLite، نه جدول نرمال

هر aggregate یک جدول با کلید متنی + ستون `json` (متن کامل `JsonObject`).

دلیل: نوع واقعی دامنه `JsonObject` است؛ فیلدهای HTML زیاد و متغیرند؛ `Save` امروز `MergeItem` است نه UPDATE ستونی. نرمال‌سازی رابطه‌ای در این فاز یعنی اختراع کلاس `Invoice` و شکستن پاریتی با JSON wrapper.

ستون‌های استخراج‌شده فقط برای متدهای موجود قرارداد:

| جدول | PK | ستون کمکی |
|---|---|---|
| `invoices` | `id` (= invoiceId / InvoiceId) | `date` متن شمسی برای `GetByDateRange` |
| `inventory` | `id` (= code) | — |
| `accounts` | `id` | — |
| `warranties` | `id` | `customer_key` برای `GetActiveByCustomer` |
| `users` | `username` | — |
| `meta` | `key` | مقدار (`schema_version`) |

`GetByInvoiceId` مثل JSON wrapper: پیمایش آرایه `trx` داخل JSON حساب‌ها. جدول ایندکس trx در فاز ۲ لازم نیست (حجم فروشگاه کوچک است؛ پاریتی ساده‌تر است).

### D2 — Merge همان `CurrentJsonStore.MergeItem`

`Sqlite*Repository.Save` ردیف موجود را می‌خواند، `MergeItem(live, incoming)` می‌زند، JSON ادغام‌شده را می‌نویسد. منطق ادغام جدید نوشته نمی‌شود.

`Delete` فقط روی فاکتور وجود دارد (`IInvoiceRepository.Delete`). بقیه قراردادها Delete ندارند — SQLite هم اضافه نمی‌کند.

### D3 — اسمبلی جدا، Core بدون NuGet

`Sirman.Core` امروز صفر پکیج دارد. SQLite native را داخل Core نگذار.

پروژه جدید:

```text
desktop/Sirman.Core.Sqlite/Sirman.Core.Sqlite.csproj
  net8.0
  Package: Microsoft.Data.Sqlite (هم‌خانوادهٔ net8، مثلاً 8.0.x)
  ProjectReference: Sirman.Core

desktop/Sirman.Core.Sqlite.Tests/Sirman.Core.Sqlite.Tests.csproj
  xUnit + ProjectReference به Core.Sqlite و در صورت نیاز Core.Tests برای فیکسچر مشترک
```

`Sirman.Desktop` در فاز ۲ به این پروژه **Reference نمی‌دهد**. پس `Sirman.exe` فایل دیتابیس نمی‌سازد.

کلاس‌ها مثلاً:

- `Sirman.Core.Sqlite.SqliteConnectionFactory`
- `Sirman.Core.Sqlite.SqliteSchema`
- `Sirman.Core.Sqlite.SqliteInvoiceRepository` : `IInvoiceRepository`
- همین الگو برای Inventory / Payment / Warranty / User

Namespace پیشنهادی: `Sirman.Core.Sqlite` تا با `Sirman.Core.Data` (Merge) و `Sirman.Core.Data.Repositories` (قرارداد) قاطی نشود.

### D4 — اتصال تست، نه مسیر AppData

- تست: `Data Source=:memory:` (یک اتصال باز برای کل عمر ریپو؛ حافظه با بستن اتصال پاک می‌شود)
- سازندهٔ فایل برای بعد: مسیر تزریقی، پیش‌فرض پیشنهادی **فقط مستند**: `%LOCALAPPDATA%\Sirman\data\sirman.sqlite`
- فاز ۲ Desktop را به آن مسیر وصل نمی‌کند و پوشه را نمی‌سازد

WAL و `foreign_keys=ON` در schema v1 کافی است. چندایستگاه به یک فایل SQLite وصل نمی‌شود (اشتراک LAN طبق معماری همچنان بستهٔ بک‌آپ فایل است، نه Client→DB).

### D5 — نسخه schema داخل آداپتر

جدول `meta`: `schema_version = 1`.  
Migrationهای بعدی حذف نمی‌شوند (قانون معماری ۹). v1 فقط CREATE TABLEهای بالا است.  
این نسخه با `SIRMAN_SCHEMA_VERSION` بک‌آپ HTML (الان `1`) **یکی نیست** و نباید یکی فرض شود.

### D6 — بک‌آپ

`IBackupRepository` در فاز ۲ SQLite پیاده نمی‌شود. `JsonBackupRepository` TBD می‌ماند. موتور HTML تنها موتور بک‌آپ است.

ممنوع: dump SQLite به‌عنوان جایگزین `exportData`.

### D7 — قانون کسب‌وکار روی ریپو برنمی‌گردد

بعد از فاز ۱b این متدها روی قرارداد نیستند و در SQLite هم نیستند:

```csharp
InventoryMutateResult Reserve(string itemId, int qty, string? whId);
InventoryMutateResult Consume(string itemId, int qty);
IReadOnlyList<JsonObject> Reverse(string invoiceId);
```

مالک همان `InventoryCore` / `PaymentRules` است.

### D8 — ORM نه

EF Core / Dapper / sqlite-net انتخاب نمی‌شود. ADO.NET روی `Microsoft.Data.Sqlite` + SQL صریح در `SqliteSchema`. موجودیت CLR جدید برای فاکتور ساخته نمی‌شود.

### D9 — کاربر

`IUserRepository` همان `LoginUser` است. جدول `users` JSON یا ستون‌های معادل همان فیلدها (`Id`, `Name`, `Username`, `Pw`, `Active`, `RoleKey`, `Pages`).  
`userRoles` / `loginPw` HTML جدول جدا نمی‌گیرند.

---

## تست وقتی اجرا شروع شود (کف فعلی را نشکن)

کف امروز (فاز ۱b): Core **134** / HTML **574**.

سوئیت جدید SQLite **اضافه** می‌شود؛ تست HTML نباید کم شود. رگرسیون HTML برای این فاز انتظار صفر تغییر رفتار است چون HTML دست نمی‌خورد.

حداقل تست اجرا:

1. همان ۹ تست قرارداد، یک‌بار روی SQLite (Save/Get/Delete/بازه تاریخ/GetByInvoiceId/GetActiveByCustomer/GetByUsername)
2. تست پاریتی: یک فیکسچر → `JsonInvoiceRepository` و `SqliteInvoiceRepository` → JSON خروجی یکسان (بعد از clone)
3. `Save` دوم فیلد را Merge می‌کند نه جایگزین کامل (مثل JSON wrapper)
4. schema v1 روی `:memory:` بالا می‌آید
5. اگر تست SQLite رد شد: **توقف** — منطق `InventoryCore` / فاکتور را برای سبز کردن عوض نکن

`node test_laegh.js Sirman_Final.html` باید همان ۵۷۴ بماند.

---

## محدودهٔ ممنوع اجرا (بعد از فاز ۰ هم)

- `WindowsPrintHost.cs`, `PrintServiceAdapter.cs`, `IPrintService.cs`, `PrintHtml` / `PrintDocument`
- `Sirman_Final.html` / `Laegh_Final.html`
- `InvoiceService`, `InvoicePricing`, `InventoryCore`, `PaymentRules`, `TransactionReversal`, `WarrantyWorkflow`, `ServiceRepairWorkflow`, `AuthenticationService`, `AuthorizationService`
- امضا و بدنهٔ `BusinessFacade`
- سیم‌کشی ریپو به سرویس موجود
- REST / localhost CRUD
- bump نسخه محصول
- پرامپت اجرایی قبل از ثبت `OUTCOME` فاز ۰

---

## برش‌های اجرا — برای پرامپت بعدی، نه خودِ پرامپت

وقتی فاز ۰ `PHYSICAL_PRINT_VERIFIED` یا `PHYSICAL_PRINT_FAILED` شد (نه `NOT_RUN`)، پرامپت اجرایی از روی **همین سند** ساخته می‌شود. متن پرامپت این‌جا نیست.

ترتیب پیشنهادی بعد از مجوز:

1. پروژه `Sirman.Core.Sqlite` + schema v1 + `SqliteInvoiceRepository` + تست پاریتی فاکتور
2. Inventory / Payment / Warranty / User روی همان الگو
3. توقف. گزارش. بدون Host، بدون Desktop reference، بدون dual-write

سیم‌کشی به برنامه = فاز persist بعدی (۳ persist)، نه فاز ۲.

---

## پیشنهاد ثبت در معماری (الان اعمال نشود)

بعد از پذیرش این طراحی و بسته شدن فاز ۰، یک بند جدید در بخش ۴.۱:

> آداپتر SQLite مجاز است فقط به‌عنوان پیاده‌سازی دوم قراردادهای `Sirman.Core.Data.Repositories`، بدون سیم‌کشی به Host/UI. منبع حقیقت تا اطلاع ثانوی HTML localStorage است. Client مستقیم به فایل SQLite و REST CRUD ممنوع می‌ماند.

تا آن بند ثبت نشود، اجرای کد SQLite با متن فعلی بند ۱۰ (`Database در این فاز ساخته نمی‌شود`) تنش دارد؛ به همین دلیل اجرا به بعد از فاز ۰ **و** مرور این گزارش موکول است.

---

## ریسک

| ریسک | اثر | کاهش |
|---|---|---|
| دو منبع حقیقت اگر کسی Dual-write را زود وصل کند | از دست رفتن / دوگانگی داده فروشگاه | فاز ۲ Desktop را Reference نمی‌دهد |
| نرمال‌سازی زودهنگام | از دست رفتن فیلد HTML | فقط ستون json |
| native SQLite روی لینوکس CI | تست قرمز محیطی | `Microsoft.Data.Sqlite` رسمی؛ `:memory:` |
| پوشش ناقص نسبت به بک‌آپ | توهم «دیتابیس جایگزین» | جدول پوشش بالا صریح است |
| قاطی شدن با فاز ۲ چاپ | دست زدن به چاپ منجمد | چاپ در محدودهٔ ممنوع |

Rollback طراحی: حذف همین فایل و شاخه؛ کد محصول تغییر نکرده.

---

## گزارش کار (۱۵ بند)

1. **Task:** طراحی آداپتر موازی SQLite؛ بدون پرامپت اجرایی و بدون کد  
2. **Branch:** `cursor/phase-2-sqlite-design-3733`  
3. **Baseline Version:** محصول `1405.5.27γ` — bump نشد  
4. **Files Changed:** `deliveries/Reports/PHASE_2_SQLITE_PARALLEL_ADAPTER_DESIGN.md`  
5. **Modules Changed:** هیچ ماژول اجرایی  
6. **Dependencies:** قراردادهای فاز ۱/۱b؛ فاز ۰ هنوز باز است  
7. **Root Cause:** persist هنوز HTML است؛ قرارداد Get/Save بدون پیاده‌سازی دیسک  
8. **Fix:** تصمیم مدل سند-در-SQLite، اسمبلی جدا، بدون سیم‌کشی  
9. **Tests:** این کار کد ندارد؛ کف باقی‌مانده 134 / 574 (اجرا نشده در این برش طراحی)  
10. **Regression:** بدون تغییر runtime  
11. **Data Impact:** صفر  
12. **Real Environment Test:** لازم نیست برای سند طراحی؛ چاپ فیزیکی همچنان NOT_RUN  
13. **Risks:** اجرای زودهنگام قبل از فاز ۰ / Dual-write  
14. **Rollback:** revert همین سند  
15. **Final Status:** **BLOCKED** برای اجرا (فاز ۰ باز است). طراحی: کامل برای مرور.

```text
PHASE 2 SQLITE = DESIGNED, NOT IMPLEMENTED
EXECUTABLE PROMPT = NOT WRITTEN (waiting on Phase 0)
WIRED INTO APP = NO
RUNTIME BEHAVIOR CHANGED = NO
SQL IN REPO = STILL ABSENT
```
