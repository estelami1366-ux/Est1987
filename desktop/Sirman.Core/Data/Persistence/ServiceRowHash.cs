using System.Security.Cryptography;
using System.Text;
using System.Text.Json.Nodes;

namespace Sirman.Core.Data.Persistence;

public static class ServiceRowHash
{
    public static string CanonicalJson(JsonObject obj)
    {
        var ordered = OrderNode(obj);
        return ordered.ToJsonString(new System.Text.Json.JsonSerializerOptions { WriteIndented = false });
    }

    public static string Sha256Utf8(string text)
    {
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(text ?? ""));
        return Convert.ToHexString(bytes).ToLowerInvariant();
    }

    public static string Aggregate(IEnumerable<string> rowHashes)
    {
        var joined = string.Join("\n", rowHashes.OrderBy(x => x, StringComparer.Ordinal));
        return Sha256Utf8(joined);
    }

    private static JsonNode? OrderNode(JsonNode? node)
    {
        if (node is JsonObject o)
        {
            var n = new JsonObject();
            foreach (var kv in o.OrderBy(k => k.Key, StringComparer.Ordinal))
                n[kv.Key] = kv.Value is null ? null : OrderNode(kv.Value.DeepClone());
            return n;
        }
        if (node is JsonArray a)
        {
            var n = new JsonArray();
            foreach (var item in a)
                n.Add(item is null ? null : OrderNode(item.DeepClone()));
            return n;
        }
        return node?.DeepClone();
    }
}
