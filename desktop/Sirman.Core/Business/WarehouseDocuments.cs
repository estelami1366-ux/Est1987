using System.Text.Json.Nodes;

namespace Sirman.Core.Business;

/// <summary>همان saveWarehouseDoc — اعتبار و اعمال موجودی در Core؛ persist در آداپتر.</summary>
public static class WarehouseDocuments
{
    public static WarehouseDocResult ValidateAndApply(
        JsonObject? doc,
        JsonArray? items,
        JsonObject? stockByCode,
        string? now)
    {
        doc ??= new JsonObject();
        var type = JsonVal.Str(doc, "type");
        if (string.IsNullOrWhiteSpace(JsonVal.Str(doc, "party")))
            return Fail("validation", "نام طرف مقابل الزامی است");
        if ((type is "return" or "adjust" or "reserve") && string.IsNullOrWhiteSpace(JsonVal.Str(doc, "reason")))
            return Fail("validation", "علت این سند الزامی است");

        var valid = new JsonArray();
        foreach (var n in items ?? [])
        {
            if (n is not JsonObject it) continue;
            var qty = CalculationEngine.ToInt(JsonVal.Str(it, "qtyPhy").Length > 0 ? JsonVal.Str(it, "qtyPhy") : JsonVal.Str(it, "qty"));
            if ((JsonVal.Str(it, "code").Length > 0 || JsonVal.Str(it, "name").Length > 0 || JsonVal.Str(it, "model").Length > 0) && qty > 0)
            {
                it = JsonNode.Parse(it.ToJsonString())!.AsObject();
                it["qty"] = qty;
                valid.Add(it);
            }
        }
        if (valid.Count == 0) return Fail("validation", "حداقل یک قلم اضافه کنید");

        var mutated = new JsonObject();
        var fromWh = JsonVal.Str(doc, "fromWh");
        var toWh = JsonVal.Str(doc, "toWh");
        for (var i = 0; i < valid.Count; i++)
        {
            var it = (JsonObject)valid[i]!;
            var code = JsonVal.Str(it, "code");
            var qty = CalculationEngine.ToInt(JsonVal.Str(it, "qty"));
            var whId = (type is "out" or "reserve") ? fromWh : toWh;
            JsonObject? live = null;
            if (stockByCode is not null && stockByCode[code] is JsonObject found)
                live = found;
            if (type == "reserve")
            {
                if (live is null) return Fail("business-rule", "قلم «" + (JsonVal.Str(it, "name").Length > 0 ? JsonVal.Str(it, "name") : code) + "» پیدا نشد");
                var r = InventoryCore.Reserve(live, qty, whId);
                if (!r.Ok) return Fail("business-rule", r.Error);
                mutated[code] = r.Item;
                continue;
            }
            if (live is null)
            {
                live = new JsonObject { ["code"] = code, ["qty"] = 0, ["name"] = JsonVal.Str(it, "name") };
            }
            InventoryMutateResult applied;
            if (type == "adjust")
            {
                applied = InventoryCore.AdjustStock(live, qty, whId);
            }
            else
            {
                var mv = type == "out" ? "out" : "in";
                applied = InventoryCore.ApplyByWarehouse(live, mv, qty, whId);
            }
            if (!applied.Ok) return Fail("business-rule", applied.Error);
            mutated[code] = applied.Item;
        }

        var next = JsonNode.Parse(doc.ToJsonString())!.AsObject();
        next["items"] = valid;
        next["status"] = "confirmed";
        if (string.IsNullOrEmpty(JsonVal.Str(next, "createdAt"))) next["createdAt"] = now ?? "";
        return new WarehouseDocResult
        {
            Ok = true,
            Doc = next,
            Mutated = mutated,
            Audit = new CoreAudit("saveWarehouseDoc", "warehouse", JsonVal.Str(next, "id"), true)
        };
    }

    private static WarehouseDocResult Fail(string kind, string err) =>
        new() { Ok = false, Kind = kind, Error = err };
}

public sealed class WarehouseDocResult
{
    public bool Ok { get; init; }
    public string Kind { get; init; } = "";
    public string Error { get; init; } = "";
    public JsonObject Doc { get; init; } = new();
    public JsonObject Mutated { get; init; } = new();
    public CoreAudit? Audit { get; init; }
}
