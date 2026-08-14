using System.Text.Json.Nodes;

namespace Sirman.Core.Data;

/// <summary>
/// آداپتر ذخیرهٔ فعلی: JSON از UI می‌آید و JSON برمی‌گردد.
/// Database / SQL / REST ساخته نمی‌شود. persist هنوز HTML/localStorage است.
/// </summary>
public sealed class CurrentJsonStore : IInventoryRepository, IInvoiceRepository, ICustomerRepository
{
    public JsonObject MergeItem(JsonObject? live, JsonObject? coreItem)
    {
        live ??= new JsonObject();
        if (coreItem is null) return live;
        foreach (var kv in coreItem)
            live[kv.Key] = kv.Value is null ? null : JsonNode.Parse(kv.Value.ToJsonString());
        return live;
    }
}
