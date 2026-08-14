using System.Text.Json.Nodes;

namespace Sirman.Core.Business;

/// <summary>
/// پرونده خدمات/تعمیر در این محصول همان پرونده گارانتی است — سیستم موازی ساخته نمی‌شود.
/// </summary>
public static class ServiceRepairWorkflow
{
    public static WarrantySaveResult CreateOrUpdate(JsonObject? record, bool isNew, string now) =>
        WarrantyWorkflow.Save(record, isNew, now);

    public static WarrantyCloseResult Complete(JsonObject? record, int deviceCount, string problem, string closedAt) =>
        WarrantyWorkflow.Close(record, deviceCount, problem, closedAt);

    public static InventoryMutateResult AddPart(JsonObject? part, int qty) =>
        InventoryCore.Consume(part, qty);
}
