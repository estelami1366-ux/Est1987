namespace Sirman.Core.Data;

/// <summary>
/// منبع دادهٔ فعلی هنوز localStorage/IndexedDB داخل HTML است.
/// این فاز Database نمی‌سازد؛ فقط مرز را جدا می‌کند تا فاز ۳ آداپتر عوض کند.
/// </summary>
public static class CurrentStorage
{
    public const string Kind = "html-localStorage-indexeddb";
    public const string Owner = "Sirman_Final.html";
    public const string Phase3 = "فقط پیاده‌سازی همین قرارداد عوض می‌شود؛ Domain دست نمی‌خورد.";
}

/// <summary>قرارداد موجودی — persist هنوز HTML است؛ Core فقط snapshot JSON را ادغام می‌کند.</summary>
public interface IInventoryRepository
{
    System.Text.Json.Nodes.JsonObject MergeItem(System.Text.Json.Nodes.JsonObject? live, System.Text.Json.Nodes.JsonObject? coreItem);
}

/// <summary>قرارداد فاکتور — فاز ۳.</summary>
public interface IInvoiceRepository { }

/// <summary>قرارداد مشتری — فاز ۳.</summary>
public interface ICustomerRepository { }
