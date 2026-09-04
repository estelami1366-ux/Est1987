using System.Globalization;
using System.Text.Json;
using System.Text.Json.Nodes;

namespace Sirman.Core.Backup;

internal static class BackupJsonUtil
{
    public static bool IsNullish(JsonNode? n) =>
        n is null || n.GetValueKind() == JsonValueKind.Null;

    public static bool IsPackageObject(JsonNode? n) =>
        n is JsonObject;

    public static bool HasOwn(JsonObject obj, string key) => obj.ContainsKey(key);

    public static string JsTypeof(JsonNode? n)
    {
        if (n is null) return "undefined";
        return n.GetValueKind() switch
        {
            JsonValueKind.Undefined => "undefined",
            JsonValueKind.Object => "object",
            JsonValueKind.Array => "object",
            JsonValueKind.String => "string",
            JsonValueKind.Number => "number",
            JsonValueKind.True => "boolean",
            JsonValueKind.False => "boolean",
            JsonValueKind.Null => "object",
            _ => "undefined"
        };
    }

    public static string JsTypeName(JsonNode? n)
    {
        if (n is null) return "undefined";
        if (n is JsonArray) return "array";
        if (n.GetValueKind() == JsonValueKind.Null) return "null";
        return JsTypeof(n);
    }

    public static bool TryParseInt10(JsonNode? n, out int value)
    {
        value = 0;
        if (IsNullish(n)) return false;
        if (n is not JsonValue jv) return false;
        if (jv.TryGetValue<string>(out var s))
            return TryParseInt10(s, out value);
        if (jv.GetValueKind() == JsonValueKind.Number)
        {
            if (jv.TryGetValue(out JsonElement el) && el.ValueKind == JsonValueKind.Number)
                return TryParseInt10(el.GetRawText(), out value);
            if (jv.TryGetValue<double>(out var d))
                return TryParseInt10(d.ToString("G17", CultureInfo.InvariantCulture), out value);
        }
        if (jv.GetValueKind() is JsonValueKind.True or JsonValueKind.False)
            return false;
        return TryParseInt10(jv.ToString(), out value);
    }

    public static bool TryParseInt10(string? s, out int value)
    {
        value = 0;
        if (s is null) return false;
        var i = 0;
        while (i < s.Length && char.IsWhiteSpace(s[i])) i++;
        if (i >= s.Length) return false;
        var sign = 1;
        if (s[i] == '+' || s[i] == '-')
        {
            if (s[i] == '-') sign = -1;
            i++;
        }
        if (i >= s.Length || s[i] < '0' || s[i] > '9') return false;
        long acc = 0;
        while (i < s.Length && s[i] >= '0' && s[i] <= '9')
        {
            acc = acc * 10 + (s[i] - '0');
            i++;
        }
        var n = sign * acc;
        if (n > int.MaxValue || n < int.MinValue) value = n > 0 ? int.MaxValue : int.MinValue;
        else value = (int)n;
        return true;
    }

    public static bool TryGetFiniteNumber(JsonNode? n, out double value)
    {
        value = 0;
        if (n is not JsonValue jv || jv.GetValueKind() != JsonValueKind.Number)
            return false;
        if (jv.TryGetValue<double>(out var d))
        {
            if (double.IsNaN(d) || double.IsInfinity(d)) return false;
            value = d;
            return true;
        }
        return false;
    }

    public static string Str(JsonNode? n)
    {
        if (IsNullish(n)) return "";
        if (n is JsonValue jv && jv.TryGetValue<string>(out var s)) return s;
        if (n is JsonValue nv && nv.GetValueKind() is JsonValueKind.Number or JsonValueKind.True or JsonValueKind.False)
            return BackupJsJson.Stringify(n).Trim('"');
        return n?.ToString() ?? "";
    }

    public static BackupValidationStatus StatusOf(bool ok, IReadOnlyList<string> warnings)
    {
        if (!ok) return BackupValidationStatus.INVALID;
        if (warnings.Count > 0) return BackupValidationStatus.VALID_WITH_WARNINGS;
        return BackupValidationStatus.VALID;
    }
}
