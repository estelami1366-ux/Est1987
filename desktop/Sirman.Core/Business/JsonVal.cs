using System.Text.Json.Nodes;

namespace Sirman.Core.Business;

internal static class JsonVal
{
    public static string Str(JsonNode? n)
    {
        if (n is null) return "";
        if (n is JsonValue v)
        {
            if (v.TryGetValue<string>(out var s)) return s ?? "";
            if (v.TryGetValue<int>(out var i)) return i.ToString();
            if (v.TryGetValue<double>(out var d)) return d.ToString(System.Globalization.CultureInfo.InvariantCulture);
        }
        if (n is JsonObject or JsonArray) return n.ToJsonString();
        return n.ToString() ?? "";
    }

    public static string Str(JsonObject? o, string k) => o is null ? "" : Str(o[k]);

    public static JsonObject Obj(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return new JsonObject();
        return JsonNode.Parse(json) as JsonObject ?? new JsonObject();
    }

    public static JsonArray Arr(JsonNode? n) => n as JsonArray ?? new JsonArray();
}
