using System.Text.Json.Nodes;
using Sirman.Core.Business;

namespace Sirman.Core.Data;

/// <summary>
/// آداپتر ذخیرهٔ فعلی: JSON از UI می‌آید و JSON برمی‌گردد.
/// Database / SQL / REST ساخته نمی‌شود. persist هنوز HTML/localStorage است.
/// Business Core فقط از همین قرارداد Merge استفاده می‌کند.
/// </summary>
public sealed class CurrentJsonStore : IInventoryRepository, IInvoiceRepository, ICustomerRepository, IWarrantyRepository, IPaymentRepository
{
    public JsonObject MergeItem(JsonObject? live, JsonObject? coreItem)
    {
        live ??= new JsonObject();
        if (coreItem is null) return live;
        foreach (var kv in coreItem)
            live[kv.Key] = kv.Value is null ? null : JsonNode.Parse(kv.Value.ToJsonString());
        return live;
    }

    public JsonObject MergeMap(JsonObject? liveMap, JsonObject? coreMap)
    {
        liveMap ??= new JsonObject();
        if (coreMap is null) return liveMap;
        foreach (var kv in coreMap)
        {
            if (kv.Value is JsonObject coreItem)
            {
                var liveItem = liveMap[kv.Key] as JsonObject ?? new JsonObject();
                liveMap[kv.Key] = MergeItem(liveItem, coreItem);
            }
            else
            {
                liveMap[kv.Key] = kv.Value is null ? null : JsonNode.Parse(kv.Value.ToJsonString());
            }
        }
        return liveMap;
    }
}
