using System.Globalization;
using System.Text.Json.Nodes;

namespace Sirman.Core.Business;

/// <summary>
/// همان InventoryEngine موجود — سیستم انبار جدید نیست.
/// داده با JSON می‌آید؛ localStorage را نمی‌شناسد.
/// </summary>
public static class InventoryCore
{
    public static JsonObject NormalizeWarehouse(JsonObject? w)
    {
        w ??= new JsonObject();
        if (string.IsNullOrEmpty(JsonVal.Str(w, "status"))) w["status"] = "active";
        if (w["manager"] is null) w["manager"] = "";
        if (string.IsNullOrEmpty(JsonVal.Str(w, "code"))) w["code"] = JsonVal.Str(w, "id");
        if (string.IsNullOrEmpty(JsonVal.Str(w, "type"))) w["type"] = "other";
        return w;
    }

    public static StockSnapshot Stock(JsonObject? item, string? whId)
    {
        item ??= new JsonObject();
        int qty, reserved;
        if (!string.IsNullOrEmpty(whId))
        {
            qty = IntFromMap(item["byWh"] as JsonObject, whId);
            reserved = IntFromMap(item["reservedByWh"] as JsonObject, whId);
        }
        else
        {
            if (item["byWh"] is JsonObject by) qty = SumByWh(by);
            else qty = ToInt(item["qty"]);
            if (item["reservedByWh"] is JsonObject rb) reserved = SumByWh(rb);
            else reserved = ToInt(item["reserved"]);
        }
        var min = ToInt(item["min"]);
        var reorderNode = item["reorder"];
        var reorder = reorderNode is null || string.IsNullOrEmpty(reorderNode.ToString()) ? min : ToInt(reorderNode);
        return new StockSnapshot
        {
            Qty = qty,
            Reserved = reserved,
            Available = Math.Max(0, qty - reserved),
            Min = min,
            Reorder = reorder,
            Price = CalculationEngine.ToNum(item["price"]?.ToString())
        };
    }

    public static InventoryMutateResult Reserve(JsonObject? item, int qty, string? whId)
    {
        item = Clone(item);
        if (item is null || qty <= 0) return new InventoryMutateResult { Ok = false, Error = "مقدار نامعتبر" };
        var snap = Stock(item, whId);
        if (snap.Available < qty)
            return new InventoryMutateResult { Ok = false, Error = "موجودی قابل‌استفاده کافی نیست (قابل استفاده: " + snap.Available + ")" };
        EnsureMap(item, "reservedByWh");
        var map = (JsonObject)item["reservedByWh"]!;
        if (!string.IsNullOrEmpty(whId))
        {
            map[whId] = IntFromMap(map, whId) + qty;
            item["reserved"] = SumByWh(map);
        }
        else
        {
            item["reserved"] = ToInt(item["reserved"]) + qty;
        }
        return new InventoryMutateResult { Ok = true, Item = item, Stock = Stock(item, whId) };
    }

    public static InventoryMutateResult Release(JsonObject? item, int qty, string? whId)
    {
        item = Clone(item);
        if (item is null || qty <= 0) return new InventoryMutateResult { Ok = false, Error = "مقدار نامعتبر" };
        EnsureMap(item, "reservedByWh");
        var map = (JsonObject)item["reservedByWh"]!;
        if (!string.IsNullOrEmpty(whId))
        {
            map[whId] = Math.Max(0, IntFromMap(map, whId) - qty);
            item["reserved"] = SumByWh(map);
        }
        else
        {
            item["reserved"] = Math.Max(0, ToInt(item["reserved"]) - qty);
        }
        return new InventoryMutateResult { Ok = true, Item = item, Stock = Stock(item, whId) };
    }

    /// <summary>همان Math.max(0, qty-n) در کسر فروش/فاکتور — confirm مربوط به UI است.</summary>
    public static InventoryMutateResult Consume(JsonObject? item, int qty)
    {
        item = Clone(item);
        if (item is null) return new InventoryMutateResult { Ok = false, Error = "مقدار نامعتبر" };
        var available = ToInt(item["qty"]);
        var next = Math.Max(0, available - Math.Max(0, qty));
        item["qty"] = next;
        return new InventoryMutateResult
        {
            Ok = true,
            Item = item,
            Stock = Stock(item, null),
            WouldGoNegative = available < qty
        };
    }

    public static InventoryMutateResult AddStock(JsonObject? item, int qty)
    {
        return AddStock(item, qty, null);
    }

    public static InventoryMutateResult AddStock(JsonObject? item, int qty, string? whId)
    {
        if (qty <= 0) return new InventoryMutateResult { Ok = false, Error = "مقدار نامعتبر" };
        if (!string.IsNullOrEmpty(whId))
            return ApplyByWarehouse(item, "in", qty, whId);
        item = Clone(item);
        if (item is null) return new InventoryMutateResult { Ok = false, Error = "مقدار نامعتبر" };
        item["qty"] = ToInt(item["qty"]) + qty;
        return new InventoryMutateResult { Ok = true, Item = item, Stock = Stock(item, null) };
    }

    public static InventoryMutateResult RemoveStock(JsonObject? item, int qty, string? whId)
    {
        if (qty <= 0) return new InventoryMutateResult { Ok = false, Error = "مقدار نامعتبر" };
        if (!string.IsNullOrEmpty(whId))
            return ApplyByWarehouse(item, "out", qty, whId);
        item = Clone(item);
        if (item is null) return new InventoryMutateResult { Ok = false, Error = "مقدار نامعتبر" };
        var snap = Stock(item, null);
        if (snap.Available < qty)
            return new InventoryMutateResult { Ok = false, Error = "موجودی قابل‌استفاده کافی نیست (قابل استفاده: " + snap.Available + ")" };
        item["qty"] = Math.Max(0, ToInt(item["qty"]) - qty);
        return new InventoryMutateResult { Ok = true, Item = item, Stock = Stock(item, null) };
    }

    /// <summary>همان applyStockByWarehouse در HTML — byWh و qty با هم به‌روز می‌شوند.</summary>
    public static InventoryMutateResult ApplyByWarehouse(JsonObject? item, string? type, int qty, string? whId)
    {
        type = (type ?? "").Trim().ToLowerInvariant();
        if (type is not ("in" or "out"))
            return new InventoryMutateResult { Ok = false, Error = "نوع حرکت نامعتبر است" };
        if (qty == 0) return new InventoryMutateResult { Ok = true, Item = Clone(item) ?? new JsonObject(), Stock = Stock(item, whId) };
        if (qty < 0) return new InventoryMutateResult { Ok = false, Error = "مقدار نامعتبر" };
        item = Clone(item);
        if (item is null) return new InventoryMutateResult { Ok = false, Error = "مقدار نامعتبر" };

        if (IsDefective(item))
            return ApplyDefective(item, type, qty, whId);

        if (type == "out")
        {
            var avail = Stock(item, string.IsNullOrEmpty(whId) ? null : whId).Available;
            if (avail < qty)
                return new InventoryMutateResult
                {
                    Ok = false,
                    Error = "موجودی قابل‌استفاده کافی نیست (قابل استفاده: " + avail + "، درخواست: " + qty + ")"
                };
        }

        var delta = type == "in" ? qty : -qty;
        if (!string.IsNullOrEmpty(whId))
        {
            EnsureMap(item, "byWh");
            var by = (JsonObject)item["byWh"]!;
            by[whId] = Math.Max(0, IntFromMap(by, whId) + delta);
            item["qty"] = SumByWh(by);
        }
        else
        {
            item["qty"] = Math.Max(0, ToInt(item["qty"]) + delta);
        }
        return new InventoryMutateResult { Ok = true, Item = item, Stock = Stock(item, string.IsNullOrEmpty(whId) ? null : whId) };
    }

    public static InventoryMutateResult AdjustStock(JsonObject? item, int targetQty, string? whId)
    {
        if (targetQty < 0) return new InventoryMutateResult { Ok = false, Error = "مقدار نامعتبر" };
        var current = Stock(item, string.IsNullOrEmpty(whId) ? null : whId).Qty;
        var diff = targetQty - current;
        if (diff == 0)
            return new InventoryMutateResult { Ok = true, Item = Clone(item) ?? new JsonObject(), Stock = Stock(item, whId) };
        return ApplyByWarehouse(item, diff > 0 ? "in" : "out", Math.Abs(diff), whId);
    }

    private static bool IsDefective(JsonObject item)
    {
        var code = JsonVal.Str(item, "id");
        if (code.Length == 0) code = JsonVal.Str(item, "code");
        return code.StartsWith("DEF-", StringComparison.OrdinalIgnoreCase);
    }

    private static InventoryMutateResult ApplyDefective(JsonObject item, string type, int qty, string? whId)
    {
        if (type == "out")
        {
            item["status"] = "returned";
            item["returnedAt"] = JsonVal.Str(item, "returnedAt");
            item["qty"] = 0;
        }
        else
        {
            item["status"] = "in_stock";
            item["returnedAt"] = null;
            item["qty"] = ToInt(item["qty"]) + qty;
        }
        if (!string.IsNullOrEmpty(whId)) item["warehouseId"] = whId;
        return new InventoryMutateResult { Ok = true, Item = item, Stock = Stock(item, whId) };
    }

    public static List<JsonObject> Kardex(JsonArray? moves, string? code, string? whId)
    {
        var list = new List<JsonObject>();
        if (moves is null) return list;
        foreach (var n in moves)
        {
            if (n is not JsonObject m) continue;
            if (JsonVal.Str(m, "itemCode") != (code ?? "")) continue;
            if (!string.IsNullOrEmpty(whId))
            {
                var id = JsonVal.Str(m, "whId");
                var wh = JsonVal.Str(m, "warehouse");
                if (id != whId && wh != whId) continue;
            }
            list.Add(m);
        }
        list.Sort((a, b) => string.CompareOrdinal(JsonVal.Str(a, "date"), JsonVal.Str(b, "date")));
        return list;
    }

    public static List<JsonObject> LowStock(JsonArray? parts, JsonArray? products, JsonObject? inventory)
    {
        var outList = new List<JsonObject>();
        foreach (var n in parts ?? [])
        {
            if (n is not JsonObject p) continue;
            var s = Stock(p, null);
            if (s.Qty <= s.Min || (s.Reorder != 0 && s.Qty <= s.Reorder))
                outList.Add(Hit(p, "part", s));
        }
        foreach (var n in products ?? [])
        {
            if (n is not JsonObject p) continue;
            var code = JsonVal.Str(p, "code");
            JsonObject inv = new() { ["qty"] = 0, ["min"] = 0 };
            if (inventory is not null && inventory[code] is JsonObject found) inv = found;
            var s = Stock(inv, null);
            if (s.Qty <= s.Min || (s.Reorder != 0 && s.Qty <= s.Reorder))
                outList.Add(Hit(p, "product", s));
        }
        return outList;
    }

    public static List<JsonObject> Search(string? q, JsonArray? parts, JsonArray? products)
    {
        q = (q ?? "").ToLowerInvariant().Trim();
        var hits = new List<JsonObject>();
        if (string.IsNullOrEmpty(q)) return hits;
        void Match(JsonObject p, string kind)
        {
            var blob = ((JsonVal.Str(p, "code") + " " + JsonVal.Str(p, "name") + " " + JsonVal.Str(p, "barcode") + " " + JsonVal.Str(p, "brand") + " " + JsonVal.Str(p, "cat") + " " + JsonVal.Str(p, "model") + " " + JsonVal.Str(p, "batch"))).ToLowerInvariant();
            if (blob.Contains(q, StringComparison.Ordinal))
            {
                hits.Add(new JsonObject
                {
                    ["kind"] = kind,
                    ["code"] = JsonVal.Str(p, "code"),
                    ["name"] = JsonVal.Str(p, "name"),
                    ["barcode"] = JsonVal.Str(p, "barcode"),
                    ["qty"] = ToInt(p["qty"])
                });
            }
        }
        foreach (var n in parts ?? []) if (n is JsonObject p) Match(p, "part");
        foreach (var n in products ?? []) if (n is JsonObject p) Match(p, "product");
        return hits;
    }

    public static double Value(JsonArray? parts, JsonArray? products, JsonObject? inventory)
    {
        double total = 0;
        foreach (var n in parts ?? [])
        {
            if (n is not JsonObject p) continue;
            total += ToInt(p["qty"]) * CalculationEngine.ToNum(p["price"]?.ToString());
        }
        foreach (var n in products ?? [])
        {
            if (n is not JsonObject p) continue;
            var code = JsonVal.Str(p, "code");
            var qty = 0;
            if (inventory is not null && inventory[code] is JsonObject inv) qty = ToInt(inv["qty"]);
            total += qty * CalculationEngine.ToNum(p["price"]?.ToString());
        }
        return total;
    }

    public static List<JsonObject> DeadStock(JsonArray? items, JsonArray? moves, int days, long nowMs)
    {
        if (days <= 0) days = 90;
        if (nowMs <= 0) nowMs = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        var cutoff = nowMs - days * 24L * 60 * 60 * 1000;
        var last = new Dictionary<string, long>(StringComparer.Ordinal);
        foreach (var n in moves ?? [])
        {
            if (n is not JsonObject m) continue;
            var c = JsonVal.Str(m, "itemCode");
            if (c.Length == 0) continue;
            var t = DateParseMs(JsonVal.Str(m, "date"));
            if (!last.TryGetValue(c, out var prev) || t > prev) last[c] = t;
        }
        var outList = new List<JsonObject>();
        foreach (var n in items ?? [])
        {
            if (n is not JsonObject it) continue;
            if (ToInt(it["qty"]) <= 0) continue;
            var code = JsonVal.Str(it, "code");
            last.TryGetValue(code, out var t);
            if (t < cutoff) outList.Add(it);
        }
        return outList;
    }

    public static List<JsonObject> Consumed(JsonArray? warranties)
    {
        var rows = new List<JsonObject>();
        void PushList(JsonObject w, JsonNode? partsUsed)
        {
            if (partsUsed is not JsonArray arr) return;
            foreach (var n in arr)
            {
                if (n is not JsonObject p) continue;
                rows.Add(new JsonObject
                {
                    ["warId"] = JsonVal.Str(w, "id"),
                    ["code"] = First(p, "code", "partCode"),
                    ["name"] = First(p, "name", "partName"),
                    ["qty"] = Math.Max(1, ToInt(p["qty"] ?? p["q"] ?? 1))
                });
            }
        }
        foreach (var n in warranties ?? [])
        {
            if (n is not JsonObject w) continue;
            PushList(w, w["partsUsed"]);
            PushList(w, w["usedParts"]);
            PushList(w, w["partRows"]);
            PushList(w, w["waParts"]);
            if (w["agencyWork"] is JsonObject aw) PushList(w, aw["partReqs"]);
            if (w["companyWork"] is JsonObject cw) PushList(w, cw["partReqs"]);
        }
        return rows;
    }

    public static int SumByWh(JsonObject? byWh)
    {
        if (byWh is null) return 0;
        var s = 0;
        foreach (var kv in byWh) s += ToInt(kv.Value);
        return s;
    }

    private static JsonObject Hit(JsonObject p, string kind, StockSnapshot s) => new()
    {
        ["code"] = JsonVal.Str(p, "code"),
        ["name"] = JsonVal.Str(p, "name"),
        ["kind"] = kind,
        ["stock"] = s.ToJson()
    };

    private static void EnsureMap(JsonObject item, string key)
    {
        if (item[key] is not JsonObject)
            item[key] = new JsonObject();
    }

    private static JsonObject? Clone(JsonObject? item) =>
        item is null ? null : JsonNode.Parse(item.ToJsonString()) as JsonObject;

    private static int IntFromMap(JsonObject? map, string key)
    {
        if (map is null || !map.TryGetPropertyValue(key, out var n) || n is null) return 0;
        return ToInt(n);
    }

    private static int ToInt(JsonNode? n)
    {
        if (n is null) return 0;
        if (n is JsonValue v)
        {
            if (v.TryGetValue<int>(out var i)) return i;
            if (v.TryGetValue<double>(out var d) && double.IsFinite(d)) return (int)d;
            if (v.TryGetValue<string>(out var s)) return CalculationEngine.ToInt(s);
        }
        return CalculationEngine.ToInt(n.ToString());
    }

    private static string First(JsonObject o, params string[] keys)
    {
        foreach (var k in keys)
        {
            var s = JsonVal.Str(o, k);
            if (s.Length > 0) return s;
        }
        return "";
    }

    private static long DateParseMs(string date)
    {
        if (string.IsNullOrWhiteSpace(date)) return 0;
        if (DateTimeOffset.TryParse(date, CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal, out var dt))
            return dt.ToUnixTimeMilliseconds();
        return 0;
    }
}

public sealed class StockSnapshot
{
    public int Qty { get; init; }
    public int Reserved { get; init; }
    public int Available { get; init; }
    public int Min { get; init; }
    public int Reorder { get; init; }
    public double Price { get; init; }

    public JsonObject ToJson() => new()
    {
        ["qty"] = Qty,
        ["reserved"] = Reserved,
        ["available"] = Available,
        ["min"] = Min,
        ["reorder"] = Reorder,
        ["price"] = Price
    };
}

public sealed class InventoryMutateResult
{
    public bool Ok { get; init; }
    public string Error { get; init; } = "";
    public JsonObject? Item { get; init; }
    public StockSnapshot? Stock { get; init; }
    public bool WouldGoNegative { get; init; }
}
