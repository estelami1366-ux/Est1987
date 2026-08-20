# SIRMAN — PHASE 1 REPORT: Repository Interfaces

**Date:** 1405/05/29 (20 August 2026)  
**Branch:** `cursor/phase-1-repository-interfaces-3733`  
**PR:** https://github.com/estelami1366-ux/Est1987/pull/51  
**Code modified in app runtime:** NO (new unused files only)  
**HTML / print / BusinessFacade wired:** NO  
**SQL / REST:** NO  
**Version bumped:** NO  

---

## هدف

قرار دادن مرز persist صریح داخل `Sirman.Core`، با پیاده‌سازی JSON روی `CurrentJsonStore` موجود، **بدون تغییر رفتار برنامه**.

این فاز سرویس‌های کسب‌وکار را به repository وصل نمی‌کند.

---

## Step 1 — نوع واقعی دامنه

کلاس persist به نام `Invoice`، `InventoryItem`، `Payment` یا `Warranty` در Core **وجود ندارد**. سندها `JsonObject` هستند.

| مفهوم | نوع واقعی | محل |
|---|---|---|
| فاکتور | `JsonObject` با `invoiceId` / `InvoiceId`، `num`، `date`، `items` | `desktop/Sirman.Core/Business/InvoiceService.cs` |
| خط / جمع فاکتور | `InvoiceLine`, `InvoiceTotals` — محاسبه، نه persist | `InvoicePricing.cs` |
| موجودی | `JsonObject` با `code`, `qty`, `reserved`, `byWh` | `InventoryCore.cs` |
| نتیجه جهش انبار | `InventoryMutateResult`, `StockSnapshot` | `InventoryCore.cs` |
| حساب / پرداخت | `JsonObject` حساب + آرایه `trx`؛ `PaymentAccountResult` | `PaymentRules.cs` |
| گارانتی | `JsonObject` با `id`, `name`, `phone`, `status` | `WarrantyWorkflow.cs` |
| کاربر | `LoginUser` (لیست از HTML می‌آید) | `Security/AuthenticationService.cs` |
| ذخیره فعلی | `CurrentJsonStore.MergeItem` / `MergeMap` | `Data/CurrentJsonStore.cs` |
| قرارداد Merge قدیمی | `Sirman.Core.Data.IInvoiceRepository` و مشابه | `Data/CurrentStorage.cs` |

`CurrentJsonStore` متد Get/Save/Delete ندارد. فقط فیلدهای JSON را روی شیء زنده ادغام می‌کند. persist واقعی هنوز `localStorage` داخل HTML است.

قراردادهای جدید در namespace جدا هستند:

`Sirman.Core.Data.Repositories`

تا با `Sirman.Core.Data.IInvoiceRepository` (فقط Merge) قاطی نشوند.

---

## Step 2–3 — امضاهای نهایی

اگر با طرح اولیهٔ `DateTime` / کلاس `Invoice` فرق دارد، دلیل در همان بند آمده است.

```csharp
// IInvoiceRepository
JsonObject? GetById(string invoiceId);
IReadOnlyList<JsonObject> GetAll();
IReadOnlyList<JsonObject> GetByDateRange(string fromDate, string toDate);
void Save(JsonObject invoice);
bool Delete(string invoiceId);
```

`GetByDateRange` از `string` استفاده می‌کند نه `DateTime`، چون فیلد `date` در HTML/Core رشتهٔ شمسی/متنی است.

```csharp
// IInventoryRepository
JsonObject? GetById(string itemId);          // همان code
IReadOnlyList<JsonObject> GetAll();
void Save(JsonObject item);
InventoryMutateResult Reserve(string itemId, int qty, string? whId);
InventoryMutateResult Consume(string itemId, int qty);
```

`Reserve` / `Consume` در `CurrentJsonStore` نیستند؛ در JSON wrapper به `InventoryCore` موجود تفویض می‌شوند. هیچ سرویسی این wrapper را صدا نمی‌زند.

```csharp
// IPaymentRepository
IReadOnlyList<JsonObject> GetByInvoiceId(string invoiceId);
void Save(JsonObject account);
IReadOnlyList<JsonObject> Reverse(string invoiceId);
```

`GetByInvoiceId` تراکنش‌هایی را می‌گردد که `refId` / `invoiceId` / `documentId` برابر شناسه سند باشد. `Reverse` در JSON wrapper به `PaymentRules.ReverseOwned` موجود تفویض می‌شود.

```csharp
// IWarrantyRepository
JsonObject? GetById(string warrantyId);
IReadOnlyList<JsonObject> GetActiveByCustomer(string customerId);
void Save(JsonObject record);
```

`customerId` پایدار در Core persist نیست. کلید تطبیق: `customerId` یا `phone` یا `name`. فعال = `status != closed`.

```csharp
// IUserRepository
LoginUser? GetByUsername(string username);
IReadOnlyList<LoginUser> GetAll();
void Save(LoginUser user);
```

نزدیک‌ترین نوع CLR موجود `LoginUser` است. جدول کاربر در Core persist نمی‌شود.

```csharp
// IBackupRepository  — TBD
JsonObject Export();
JsonObject Import(JsonObject package);
JsonObject Merge(JsonObject live, JsonObject incoming);
```

**TBD صریح:** schema / migrate / merge / replace واقعی در HTML است (`exportData`, `migrateBackup`, `applyBackupSelective`). JSON wrapper موتور بک‌آپ را کپی نمی‌کند؛ `Merge` فقط `CurrentJsonStore.MergeMap` است.

پیاده‌سازی JSON: کیسهٔ حافظه + `MergeItem` روی `CurrentJsonStore`. این یک دیتابیس جایگزین نیست.

---

## فایل‌های جدید

### اینترفیس و کمک

- `desktop/Sirman.Core/Data/Repositories/IInvoiceRepository.cs`
- `desktop/Sirman.Core/Data/Repositories/IInventoryRepository.cs`
- `desktop/Sirman.Core/Data/Repositories/IPaymentRepository.cs`
- `desktop/Sirman.Core/Data/Repositories/IWarrantyRepository.cs`
- `desktop/Sirman.Core/Data/Repositories/IUserRepository.cs`
- `desktop/Sirman.Core/Data/Repositories/IBackupRepository.cs`
- `desktop/Sirman.Core/Data/Repositories/RepositoryJson.cs`

### Wrapperهای JSON

- `desktop/Sirman.Core/Data/Repositories/JsonInvoiceRepository.cs`
- `desktop/Sirman.Core/Data/Repositories/JsonInventoryRepository.cs`
- `desktop/Sirman.Core/Data/Repositories/JsonPaymentRepository.cs`
- `desktop/Sirman.Core/Data/Repositories/JsonWarrantyRepository.cs`
- `desktop/Sirman.Core/Data/Repositories/JsonUserRepository.cs`
- `desktop/Sirman.Core/Data/Repositories/JsonBackupRepository.cs`

### Fake و تست

- `desktop/Sirman.Core.Tests/RepositoryFakes.cs`
- `desktop/Sirman.Core.Tests/RepositoryContractTests.cs`

---

## فایل‌های ممنوع (دست نخورده)

- `desktop/Sirman.Desktop/WindowsPrintHost.cs`
- `desktop/Sirman.Desktop/PrintServiceAdapter.cs`
- `desktop/Sirman.Core/Printing/IPrintService.cs`
- `PrintHtml` / `PrintDocument` در `SirmanHostObject.cs`
- `Sirman_Final.html` / `Laegh_Final.html`
- `InvoiceService`, `InvoicePricing`, `InventoryCore`, `PaymentRules`, `TransactionReversal`, `WarrantyWorkflow`, `ServiceRepairWorkflow`
- `AuthenticationService`, `AuthorizationService`
- `Sirman.Core.Application.BusinessFacade` (امضا و بدنه)

هیچ سرویس موجودی repository جدید را مصرف نمی‌کند.

---

## ابهام‌ها (حل نشد)

1. دو `IInvoiceRepository` / `IInventoryRepository` / `IPaymentRepository` / `IWarrantyRepository` در دو namespace: یکی Merge، یکی Get/Save.
2. `InvoiceService.Validate` فیلد `seller` می‌خواهد؛ `EntityValidator` برای invoice فیلد `name`.
3. تاریخ فاکتور رشته است نه `DateTime`.
4. گارانتی `customerId` پایدار ندارد.
5. بک‌آپ merge در HTML است؛ قرارداد Core ناقص/TBD است.
6. کاربر persist در Core نیست؛ `LoginUser` فقط مدل ورود است.
7. JSON wrapper هنوز منبع حقیقت داده نیست؛ localStorage HTML است.
8. `Reserve`/`Consume`/`Reverse` روی repository مرز persist را با قوانین کسب‌وکار مخلوط می‌کند اگر بعداً وصل شوند — عمداً در این فاز سیم‌کشی نشد.

---

## تست

| مجموعه | نتیجه |
|---|---|
| `dotnet test desktop/Sirman.Core.Tests` | **134 موفق / 0 ناموفق** (قبلاً 125؛ ۹ تست قرارداد جدید) |
| `node test_laegh.js Sirman_Final.html` | **574 موفق / 0 ناموفق** |

---

## وضعیت نهایی

```text
PHASE 1 = CONTRACTS CREATED
WIRED INTO APP = NO
RUNTIME BEHAVIOR CHANGED = NO
IBackupRepository = TBD
SQL = NOT STARTED
PHASE 2 SQLITE = NOT AUTHORIZED UNTIL THIS REPORT IS REVIEWED
```
