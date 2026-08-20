using System.Text.Json.Nodes;

namespace Sirman.Core.Data.Repositories;

/// <summary>
/// شناسه‌ها و کلون JSON مطابق فیلدهای واقعی HTML/Core — کلاس دامنه Invoice/User persist وجود ندارد.
/// </summary>
internal static class RepositoryJson
{
    public static JsonObject Clone(JsonObject? src) =>
        src is null
            ? new JsonObject()
            : JsonNode.Parse(src.ToJsonString()) as JsonObject ?? new JsonObject();

    public static string Str(JsonObject? o, params string[] keys)
    {
        if (o is null) return "";
        foreach (var key in keys)
        {
            if (string.IsNullOrEmpty(key) || !o.ContainsKey(key)) continue;
            var v = o[key]?.ToString()?.Trim() ?? "";
            if (v.Length > 0) return v;
        }
        return "";
    }

    public static string InvoiceId(JsonObject? o) => Str(o, "invoiceId", "InvoiceId");

    public static string InventoryId(JsonObject? o) => Str(o, "code", "id");

    public static string AccountId(JsonObject? o) => Str(o, "id", "code", "name");

    public static string WarrantyId(JsonObject? o) => Str(o, "id", "warrantyId");

    public static string InvoiceDate(JsonObject? o) => Str(o, "date", "savedAt");

    public static string WarrantyCustomerKey(JsonObject? o) => Str(o, "customerId", "phone", "name");
}
