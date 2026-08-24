using System.Globalization;
using System.Text.Json.Nodes;

namespace Sirman.Core.Data.Persistence;

public static class ServiceCanonicalMapper
{
    private static readonly HashSet<string> MappedKeys = new(StringComparer.Ordinal)
    {
        "id", "code", "name", "cat", "price", "warr"
    };

    public static ServiceCatalogRecord FromLegacy(JsonObject raw, DateTimeOffset now)
    {
        ArgumentNullException.ThrowIfNull(raw);
        var extra = new JsonObject();
        foreach (var kv in raw)
        {
            if (MappedKeys.Contains(kv.Key)) continue;
            extra[kv.Key] = kv.Value is null ? null : kv.Value.DeepClone();
        }

        var idRaw = Str(raw, "id");
        var code = Str(raw, "code");
        var name = Str(raw, "name");
        var cat = Str(raw, "cat");
        var warr = Str(raw, "warr");

        int? price = TryPrice(raw["price"]);
        if (raw["price"] is not null && price is null)
            extra["price"] = raw["price"]!.DeepClone();

        string serviceId;
        string idSource;
        if (!string.IsNullOrWhiteSpace(idRaw))
        {
            serviceId = idRaw.Trim();
            idSource = "existing-id";
        }
        else if (!string.IsNullOrWhiteSpace(code))
        {
            serviceId = code.Trim();
            idSource = "existing-code";
        }
        else
        {
            var basis = ServiceRowHash.CanonicalJson(raw);
            serviceId = "mig_svc_" + ServiceRowHash.Sha256Utf8(basis)[..16];
            idSource = "generated-hash";
        }

        var extraJson = extra.ToJsonString(new System.Text.Json.JsonSerializerOptions { WriteIndented = false });
        var hashObj = new JsonObject
        {
            ["service_id"] = serviceId,
            ["code"] = code,
            ["name"] = name,
            ["cat"] = cat,
            ["price"] = price.HasValue ? JsonValue.Create(price.Value) : null,
            ["warr"] = warr,
            ["json_extra"] = extraJson
        };
        var rowHash = ServiceRowHash.Sha256Utf8(ServiceRowHash.CanonicalJson(hashObj));

        return new ServiceCatalogRecord
        {
            ServiceId = serviceId,
            Code = code,
            Name = name,
            Cat = cat,
            Price = price,
            Warr = warr,
            JsonExtra = extraJson,
            RowHash = rowHash,
            IdSource = idSource,
            MigratedAt = now.ToString("o", CultureInfo.InvariantCulture)
        };
    }

    public static IReadOnlyList<ServiceCatalogRecord> MapAll(IEnumerable<JsonObject> rows, DateTimeOffset now)
        => rows.Select(r => FromLegacy(r, now)).ToList();

    private static string? Str(JsonObject o, string key)
    {
        if (!o.TryGetPropertyValue(key, out var n) || n is null) return null;
        if (n is JsonValue v && v.TryGetValue<string>(out var s)) return s;
        return n.ToString();
    }

    private static int? TryPrice(JsonNode? n)
    {
        if (n is null) return null;
        if (n is JsonValue v)
        {
            if (v.TryGetValue<int>(out var i)) return i;
            if (v.TryGetValue<long>(out var l) && l is >= int.MinValue and <= int.MaxValue) return (int)l;
            if (v.TryGetValue<double>(out var d) && d == Math.Truncate(d) && d is >= int.MinValue and <= int.MaxValue)
                return (int)d;
        }
        return int.TryParse(n.ToString(), NumberStyles.Integer, CultureInfo.InvariantCulture, out var p) ? p : null;
    }
}
