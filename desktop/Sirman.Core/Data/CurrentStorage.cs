using System.Text.Json.Nodes;

namespace Sirman.Core.Data;

/// <summary>
/// منبع دادهٔ فعلی هنوز localStorage/IndexedDB داخل HTML است.
/// این فاز Database نمی‌سازد؛ Core از آداپتر JSON استفاده می‌کند.
/// </summary>
public static class CurrentStorage
{
    public const string Kind = "html-localStorage-indexeddb";
    public const string Owner = "Sirman_Final.html";
    public const string Phase3 = "فقط پیاده‌سازی همین قرارداد عوض می‌شود؛ Domain دست نمی‌خورد.";
}

/// <summary>
/// قرارداد قدیمی MergeItem/MergeMap برای موجودی — فضای نام <c>Sirman.Core.Data</c>.
/// همنام <c>Sirman.Core.Data.Repositories.IInventoryRepository</c> (کیسه JSON) نیست.
/// امضا عوض نمی‌شود؛ این فاز فقط توضیح است.
/// </summary>
public interface IInventoryRepository
{
    JsonObject MergeItem(JsonObject? live, JsonObject? coreItem);
    JsonObject MergeMap(JsonObject? liveMap, JsonObject? coreMap);
}

/// <summary>
/// قرارداد قدیمی MergeItem برای فاکتور — فضای نام <c>Sirman.Core.Data</c>.
/// همنام <c>Sirman.Core.Data.Repositories.IInvoiceRepository</c> (کیسه JSON) نیست.
/// </summary>
public interface IInvoiceRepository
{
    JsonObject MergeItem(JsonObject? live, JsonObject? coreItem);
}

/// <summary>
/// قرارداد قدیمی MergeItem برای مشتری — فضای نام <c>Sirman.Core.Data</c>.
/// همتای Repositories در فاز ۱ ساخته نشد (مشتری پایدار جدا در Core persist نیست).
/// </summary>
public interface ICustomerRepository
{
    JsonObject MergeItem(JsonObject? live, JsonObject? coreItem);
}

/// <summary>
/// قرارداد قدیمی MergeItem برای گارانتی — فضای نام <c>Sirman.Core.Data</c>.
/// همنام <c>Sirman.Core.Data.Repositories.IWarrantyRepository</c> (کیسه JSON) نیست.
/// </summary>
public interface IWarrantyRepository
{
    JsonObject MergeItem(JsonObject? live, JsonObject? coreItem);
}

/// <summary>
/// قرارداد قدیمی MergeItem برای حساب — فضای نام <c>Sirman.Core.Data</c>.
/// همنام <c>Sirman.Core.Data.Repositories.IPaymentRepository</c> (کیسه JSON) نیست.
/// </summary>
public interface IPaymentRepository
{
    JsonObject MergeItem(JsonObject? live, JsonObject? coreItem);
}
