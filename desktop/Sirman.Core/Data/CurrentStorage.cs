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

/// <summary>قرارداد خواندن/نوشتن موجودی — پیاده‌سازی واقعی در فاز ۳. الان داده با JSON از UI می‌آید.</summary>
public interface IInventoryRepository { }

/// <summary>قرارداد فاکتور — فاز ۳.</summary>
public interface IInvoiceRepository { }

/// <summary>قرارداد مشتری — فاز ۳.</summary>
public interface ICustomerRepository { }
