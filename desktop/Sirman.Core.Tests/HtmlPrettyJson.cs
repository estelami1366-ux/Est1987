using System.Text;
using System.Text.Json.Nodes;
using Sirman.Core.Backup;

namespace Sirman.Core.Tests;

/// <summary>
/// Test-only replica of HTML <c>JSON.stringify(data, null, 2)</c>.
/// Production pretty-print lives in HTML, not Core. This helper exists so disk round-trip
/// tests can obtain the exact string HTML would pass to <c>WriteBackupText</c>.
/// Compact serialization still uses <see cref="BackupJsJson"/> (canonical checksum input).
/// </summary>
internal static class HtmlPrettyJson
{
    public static string Stringify(JsonNode? node)
    {
        var sb = new StringBuilder();
        Write(sb, node, 0);
        return sb.ToString();
    }

    private static void Write(StringBuilder sb, JsonNode? node, int level)
    {
        switch (node)
        {
            case JsonObject obj:
                WriteObject(sb, obj, level);
                return;
            case JsonArray arr:
                WriteArray(sb, arr, level);
                return;
            default:
                sb.Append(BackupJsJson.Stringify(node));
                return;
        }
    }

    private static void WriteObject(StringBuilder sb, JsonObject obj, int level)
    {
        if (obj.Count == 0)
        {
            sb.Append("{}");
            return;
        }

        sb.Append("{\n");
        var first = true;
        foreach (var kv in obj)
        {
            if (!first) sb.Append(",\n");
            first = false;
            sb.Append(Indent(level + 1));
            sb.Append(BackupJsJson.Stringify(JsonValue.Create(kv.Key)));
            sb.Append(": ");
            Write(sb, kv.Value, level + 1);
        }
        sb.Append('\n').Append(Indent(level)).Append('}');
    }

    private static void WriteArray(StringBuilder sb, JsonArray arr, int level)
    {
        if (arr.Count == 0)
        {
            sb.Append("[]");
            return;
        }

        sb.Append("[\n");
        for (var i = 0; i < arr.Count; i++)
        {
            if (i > 0) sb.Append(",\n");
            sb.Append(Indent(level + 1));
            Write(sb, arr[i], level + 1);
        }
        sb.Append('\n').Append(Indent(level)).Append(']');
    }

    private static string Indent(int level) => new(' ', level * 2);
}
