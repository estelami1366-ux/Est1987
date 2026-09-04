using System.Globalization;
using System.Text.Json;
using System.Text.Json.Nodes;

namespace Sirman.Core.Backup;

internal static class BackupJsonUtil
{
    public static bool IsNullish(JsonNode? n) =>
        n is null || n.GetValueKind() == JsonValueKind.Null;

    /// <summary>JS truthiness used by migration <c>if (!d.sales)</c> etc. Missing/null/false/0/"" are falsy; [] and {} are truthy.</summary>
    public static bool IsJsFalsy(JsonNode? n)
    {
        if (n is null) return true;
        switch (n.GetValueKind())
        {
            case JsonValueKind.Undefined:
            case JsonValueKind.Null:
            case JsonValueKind.False:
                return true;
            case JsonValueKind.True:
                return false;
            case JsonValueKind.Number:
                return TryGetFiniteNumber(n, out var d) && d == 0;
            case JsonValueKind.String:
                return n is JsonValue jv && jv.TryGetValue<string>(out var s) && s == "";
            default:
                return false;
        }
    }

    public static bool IsUndefinedProperty(JsonObject obj, string key)
    {
        if (!obj.ContainsKey(key)) return true;
        var v = obj[key];
        return v is null || v.GetValueKind() == JsonValueKind.Undefined;
    }

    public static JsonNode CloneBackupData(JsonNode? d)
    {
        var src = IsJsFalsy(d) ? new JsonObject() : d!;
        return JsonNode.Parse(BackupJsJson.Stringify(src)) ?? new JsonObject();
    }

    public static JsonNode? CloneExact(JsonNode? d)
    {
        if (d is null) return null;
        if (d.GetValueKind() == JsonValueKind.Null) return JsonValue.Create((object?)null);
        return JsonNode.Parse(BackupJsJson.Stringify(d));
    }

    public static string JsLengthLog(JsonNode? n)
    {
        if (n is JsonArray arr) return arr.Count.ToString(CultureInfo.InvariantCulture);
        if (n is JsonValue jv && jv.TryGetValue<string>(out var s))
            return s.Length.ToString(CultureInfo.InvariantCulture);
        return "undefined";
    }

    public static string JsToString(JsonNode? n)
    {
        if (n is null || n.GetValueKind() is JsonValueKind.Null or JsonValueKind.Undefined)
            return "undefined";
        if (n is JsonValue jv && jv.TryGetValue<string>(out var s)) return s;
        return BackupJsJson.Stringify(n).Trim('"');
    }

    public static double JsToNumber(JsonNode? n)
    {
        if (n is null || n.GetValueKind() is JsonValueKind.Undefined) return double.NaN;
        if (n.GetValueKind() == JsonValueKind.Null) return 0;
        if (n.GetValueKind() == JsonValueKind.True) return 1;
        if (n.GetValueKind() == JsonValueKind.False) return 0;
        if (TryGetFiniteNumber(n, out var d)) return d;
        if (n is JsonValue jv && jv.TryGetValue<string>(out var s))
        {
            if (TryParseInt10(s, out var i)) return i;
            if (double.TryParse(s, NumberStyles.Float, CultureInfo.InvariantCulture, out var x))
                return x;
            return double.NaN;
        }
        return double.NaN;
    }

    public static bool JsLessThan(JsonNode? n, double rhs)
    {
        var lhs = JsToNumber(n);
        if (double.IsNaN(lhs)) return false;
        return lhs < rhs;
    }

    public static bool JsLessOrEqual(JsonNode? n, double rhs)
    {
        var lhs = JsToNumber(n);
        if (double.IsNaN(lhs)) return false;
        return lhs <= rhs;
    }

    public static string PadStart(string s, int len, char c)
    {
        if (s.Length >= len) return s;
        return new string(c, len - s.Length) + s;
    }

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
