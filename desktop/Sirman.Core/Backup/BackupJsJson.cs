using System.Globalization;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;

namespace Sirman.Core.Backup;

/// <summary>
/// Compact JSON matching HTML <c>JSON.stringify</c> for JSON-compatible values.
/// Insertion order is preserved. Keys are not sorted. Non-ASCII including U+2028/U+2029
/// is not escaped (modern JSON.stringify / ES2019). This is the HTML canonical serializer, not STJ defaults.
/// </summary>
internal static class BackupJsJson
{
    public static string Stringify(JsonNode? node)
    {
        var sb = new StringBuilder();
        Write(sb, node);
        return sb.ToString();
    }

    private static void Write(StringBuilder sb, JsonNode? node)
    {
        if (node is null)
        {
            sb.Append("null");
            return;
        }

        switch (node)
        {
            case JsonObject obj:
                sb.Append('{');
                var firstObj = true;
                foreach (var kv in obj)
                {
                    if (!firstObj) sb.Append(',');
                    firstObj = false;
                    WriteString(sb, kv.Key);
                    sb.Append(':');
                    Write(sb, kv.Value);
                }
                sb.Append('}');
                return;
            case JsonArray arr:
                sb.Append('[');
                var firstArr = true;
                foreach (var item in arr)
                {
                    if (!firstArr) sb.Append(',');
                    firstArr = false;
                    Write(sb, item);
                }
                sb.Append(']');
                return;
            case JsonValue val:
                WriteValue(sb, val);
                return;
            default:
                sb.Append("null");
                return;
        }
    }

    private static void WriteValue(StringBuilder sb, JsonValue val)
    {
        var kind = val.GetValueKind();
        switch (kind)
        {
            case JsonValueKind.Null:
            case JsonValueKind.Undefined:
                sb.Append("null");
                return;
            case JsonValueKind.True:
                sb.Append("true");
                return;
            case JsonValueKind.False:
                sb.Append("false");
                return;
            case JsonValueKind.String:
                WriteString(sb, val.GetValue<string>() ?? "");
                return;
            case JsonValueKind.Number:
                sb.Append(FormatNumber(val));
                return;
            default:
                if (val.TryGetValue<string>(out var s))
                {
                    WriteString(sb, s);
                    return;
                }
                sb.Append("null");
                return;
        }
    }

    private static string FormatNumber(JsonValue val)
    {
        if (val.TryGetValue(out JsonElement el) && el.ValueKind == JsonValueKind.Number)
            return el.GetRawText();

        if (val.TryGetValue<long>(out var l))
            return l.ToString(CultureInfo.InvariantCulture);
        if (val.TryGetValue<ulong>(out var ul))
            return ul.ToString(CultureInfo.InvariantCulture);
        if (val.TryGetValue<int>(out var i))
            return i.ToString(CultureInfo.InvariantCulture);
        if (val.TryGetValue<double>(out var d))
            return FormatJsDouble(d);
        if (val.TryGetValue<decimal>(out var dec))
            return FormatJsDouble((double)dec);
        return val.ToJsonString();
    }

    /// <summary>ECMA number-to-string used by JSON.stringify for finite numbers.</summary>
    private static string FormatJsDouble(double d)
    {
        if (double.IsNaN(d) || double.IsInfinity(d)) return "null";
        if (d == 0) return double.IsNegative(d) ? "-0" : "0";
        return d.ToString("G17", CultureInfo.InvariantCulture).Replace("E+", "e+").Replace("E-", "e-");
    }

    private static void WriteString(StringBuilder sb, string s)
    {
        sb.Append('"');
        foreach (var ch in s)
        {
            switch (ch)
            {
                case '"': sb.Append("\\\""); break;
                case '\\': sb.Append("\\\\"); break;
                case '\b': sb.Append("\\b"); break;
                case '\f': sb.Append("\\f"); break;
                case '\n': sb.Append("\\n"); break;
                case '\r': sb.Append("\\r"); break;
                case '\t': sb.Append("\\t"); break;
                default:
                    if (ch < 0x20)
                        sb.Append("\\u").Append(((int)ch).ToString("x4", CultureInfo.InvariantCulture));
                    else
                        sb.Append(ch);
                    break;
            }
        }
        sb.Append('"');
    }
}
