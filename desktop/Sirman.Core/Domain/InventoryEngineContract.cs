namespace Sirman.Core.Domain;

/// <summary>
/// قرارداد مهاجرت InventoryEngine — پیاده‌سازی فعلی در Sirman_Final.html است.
/// سیستم انبار جدید در این فاز ساخته نمی‌شود.
/// </summary>
public static class InventoryEngineContract
{
    public const string Location = "Sirman_Final.html";
    public const string ObjectName = "InventoryEngine";
    public const string Functions = "registerKind, normalizeWarehouse, stock, reserve, release, kardex, lowStock, search, value, deadStock, consumed";
    public const string Phase2Path = "Inventory Core در .NET همان توابع را با دادهٔ مشترک پیاده کند؛ HTML فقط UI بماند.";
}
