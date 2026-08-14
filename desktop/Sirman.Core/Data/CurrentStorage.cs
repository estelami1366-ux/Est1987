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

public interface IInventoryRepository
{
    JsonObject MergeItem(JsonObject? live, JsonObject? coreItem);
    JsonObject MergeMap(JsonObject? liveMap, JsonObject? coreMap);
}

public interface IInvoiceRepository
{
    JsonObject MergeItem(JsonObject? live, JsonObject? coreItem);
}

public interface ICustomerRepository
{
    JsonObject MergeItem(JsonObject? live, JsonObject? coreItem);
}

public interface IWarrantyRepository
{
    JsonObject MergeItem(JsonObject? live, JsonObject? coreItem);
}

public interface IPaymentRepository
{
    JsonObject MergeItem(JsonObject? live, JsonObject? coreItem);
}
