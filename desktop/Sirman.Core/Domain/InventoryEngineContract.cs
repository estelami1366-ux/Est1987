namespace Sirman.Core.Domain;

/// <summary>InventoryEngine در C# همان InventoryCore است — سیستم انبار موازی نیست.</summary>
public static class InventoryEngineContract
{
    public const string Location = "desktop/Sirman.Core/Business/InventoryCore.cs";
    public const string ObjectName = "InventoryCore";
    public const string Functions = "Stock, Reserve, Release, Consume, AddStock, RemoveStock, ApplyByWarehouse, AdjustStock, Kardex, LowStock, Search, Value, DeadStock, Consumed";
    public const string Phase2Path = "InventoryCore منبع حقیقت exe است. persist از CurrentJsonStore به localStorage. سیستم انبار جدید ساخته نشد.";
}
