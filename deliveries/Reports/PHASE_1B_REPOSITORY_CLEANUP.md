# SIRMAN — PHASE 1B REPORT: Repository Cleanup

**Date:** 1405/05/29 (20 August 2026)  
**Branch:** `cursor/phase-1b-repository-cleanup-3733`  
**PR:** https://github.com/estelami1366-ux/Est1987/pull/52  
**Base:** `cursor/phase-1-repository-interfaces-3733` (PR #51)  
**Code modified in app runtime:** NO  
**HTML / print / BusinessFacade wired:** NO  
**SQL / REST / SQLite:** NO  
**Version bumped:** NO  

---

## هدف

رفع دو مسئلهٔ گزارش فاز ۱ قبل از مجوز فاز ۲:

1. همنامی اینترفیس‌های Merge قدیمی و قراردادهای Get/Save جدید
2. متدهای قانون کسب‌وکار روی مرز persist (Reserve / Consume / Reverse)

این فاز به SQLite نمی‌رود و هیچ repository را به سرویس وصل نمی‌کند.

---

## Issue 1 — کامنت XML

کامنت روی هر شش اینترفیس جدید و همتاهای قدیمی (جایی که همنام وجود دارد). امضای قراردادهای قدیمی عوض نشد.

### اینترفیس‌های جدید (`Sirman.Core.Data.Repositories`)

| فایل | همتای قدیمی |
|---|---|
| `desktop/Sirman.Core/Data/Repositories/IInvoiceRepository.cs` | `Sirman.Core.Data.IInvoiceRepository` |
| `desktop/Sirman.Core/Data/Repositories/IInventoryRepository.cs` | `Sirman.Core.Data.IInventoryRepository` |
| `desktop/Sirman.Core/Data/Repositories/IPaymentRepository.cs` | `Sirman.Core.Data.IPaymentRepository` |
| `desktop/Sirman.Core/Data/Repositories/IWarrantyRepository.cs` | `Sirman.Core.Data.IWarrantyRepository` |
| `desktop/Sirman.Core/Data/Repositories/IUserRepository.cs` | ندارد |
| `desktop/Sirman.Core/Data/Repositories/IBackupRepository.cs` | ندارد |

### قراردادهای قدیمی (`Sirman.Core.Data`)

فقط XML روی همین فایل؛ MergeItem/MergeMap جابه‌جا یا حذف نشد:

- `desktop/Sirman.Core/Data/CurrentStorage.cs`
  - `IInventoryRepository`
  - `IInvoiceRepository`
  - `ICustomerRepository` (همتای Repositories ندارد؛ توضیح داده شد)
  - `IWarrantyRepository`
  - `IPaymentRepository`

---

## Issue 2 — متدهای حذف‌شده

از اینترفیس‌های **جدید و بدون سیم‌کشی** و از JSON wrapper / Fake مربوطه حذف شد. منطق به جای جدید منتقل نشد.

### `IInventoryRepository` / `JsonInventoryRepository` / `FakeInventoryRepository`

```csharp
InventoryMutateResult Reserve(string itemId, int qty, string? whId);
InventoryMutateResult Consume(string itemId, int qty);
```

باقی‌مانده:

```csharp
JsonObject? GetById(string itemId);
IReadOnlyList<JsonObject> GetAll();
void Save(JsonObject item);
```

### `IPaymentRepository` / `JsonPaymentRepository` / `FakePaymentRepository`

```csharp
IReadOnlyList<JsonObject> Reverse(string invoiceId);
```

باقی‌مانده:

```csharp
IReadOnlyList<JsonObject> GetByInvoiceId(string invoiceId);
void Save(JsonObject account);
```

تست‌های قرارداد هم‌تراز شد (۹ تست ماند؛ سه تا از Save/Get به‌جای Reserve/Consume/Reverse استفاده می‌کنند).

---

## InventoryCore / PaymentRules

**دست‌نخورده.** `Reserve` / `Consume` در `InventoryCore` و `ReverseOwned` در `PaymentRules` همان‌جا می‌مانند. `BusinessFacade` هنوز همان مسیر را صدا می‌زند.

---

## تست

| سوئیت | نتیجه |
|---|---|
| `dotnet test desktop/Sirman.Core.Tests` | **134 passed** / 0 failed (کف فاز ۱: 134) |
| `node test_laegh.js Sirman_Final.html` | **574 passed** / 0 failed (کف فاز ۱: 574) |

رگرسیون نبود. منطق کسب‌وکار برای سبز کردن تست دست نخورد.

---

## فایل‌های ممنوع — دست‌نخورده

- `desktop/Sirman.Desktop/WindowsPrintHost.cs`
- `desktop/Sirman.Desktop/PrintServiceAdapter.cs`
- `desktop/Sirman.Core/Printing/IPrintService.cs`
- `PrintHtml` / `PrintDocument` در Host
- `Sirman_Final.html` / `Laegh_Final.html`
- `InvoiceService`, `InvoicePricing`, `InventoryCore`, `PaymentRules`, `TransactionReversal`, `WarrantyWorkflow`, `ServiceRepairWorkflow`, `AuthenticationService`, `AuthorizationService`
- `Sirman.Core.Application.BusinessFacade`

تنها تغییر در `CurrentStorage.cs`: کامنت XML روی اینترفیس‌های Merge قدیمی. امضا، نام، و مکان همان است (لازم برای Issue 1؛ قراردادهای قدیمی rename/move نشدند).

---

## سیم‌کشی و فاز ۲

- هیچ repository به سرویس موجود وصل نشد.
- آداپتر SQLite ساخته نشد.
- نسخه محصول عوض نشد.

فاز ۲ (SQLite موازی) هنوز شروع نشده و تا بررسی این گزارش مجاز نیست.
