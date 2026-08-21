using System.Text.Json;
using System.Text.Json.Nodes;
using Sirman.Core.Application;
using Sirman.Core.Business;
using Xunit;

namespace Sirman.Core.Tests;

/// <summary>
/// Phase 3 B13 — frozen JS↔C# vectors for rules.suggestParts.
/// Shared table: SuggestPartsParityVectors.json (also read by test_laegh.js).
/// Does not migrate ownership. Does not change ranking or inventory semantics.
/// </summary>
public class SuggestPartsParityTests
{
    private static readonly JsonElement Root = LoadRoot();
    private readonly BusinessFacade _facade = new();

    private static JsonElement LoadRoot()
    {
        var path = FindVectorsPath();
        var json = File.ReadAllText(path);
        return JsonDocument.Parse(json).RootElement;
    }

    private static string FindVectorsPath()
    {
        var name = "SuggestPartsParityVectors.json";
        var candidates = new[]
        {
            Path.Combine(AppContext.BaseDirectory, name),
            Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "..", "..", "..", name))
        };
        foreach (var p in candidates)
        {
            if (File.Exists(p)) return p;
        }
        throw new FileNotFoundException("B13 parity vector file not found: " + name);
    }

    private static JsonArray CatalogOf(JsonElement row)
    {
        if (row.TryGetProperty("parts", out var parts) && parts.ValueKind == JsonValueKind.Array)
            return JsonNode.Parse(parts.GetRawText())!.AsArray();
        return JsonNode.Parse(Root.GetProperty("catalog").GetRawText())!.AsArray();
    }

    private static List<(string code, string name, double qty, string explain)> Slim(IEnumerable<JsonObject> hits)
    {
        var list = new List<(string, string, double, string)>();
        foreach (var h in hits)
        {
            list.Add((
                JsonValQty.Str(h, "code"),
                JsonValQty.Str(h, "name"),
                JsonValQty.Num(h, "qty"),
                JsonValQty.Str(h, "explain")));
        }
        return list;
    }

    private static List<(string code, string name, double qty, string explain)> SlimExpected(JsonElement row)
    {
        var list = new List<(string, string, double, string)>();
        foreach (var h in row.GetProperty("expected").EnumerateArray())
        {
            list.Add((
                h.GetProperty("code").GetString() ?? "",
                h.GetProperty("name").GetString() ?? "",
                h.GetProperty("qty").GetDouble(),
                h.GetProperty("explain").GetString() ?? ""));
        }
        return list;
    }

    private static string Dump(List<(string code, string name, double qty, string explain)> rows)
    {
        return string.Join(" | ", rows.Select(r => r.code + " qty=" + r.qty + " " + r.explain));
    }

    [Fact]
    public void Suggest_MatchesFrozenVectors()
    {
        foreach (var row in Root.GetProperty("cases").EnumerateArray())
        {
            var id = row.GetProperty("id").GetString();
            var catalog = CatalogOf(row);
            var prodCode = row.GetProperty("prodCode").GetString();
            var model = row.GetProperty("model").GetString();
            var problem = row.GetProperty("problem").GetString();
            var got = Slim(PartsAdvisor.Suggest(catalog, prodCode, model, problem));
            var expected = SlimExpected(row);
            Assert.True(expected.Count == got.Count && expected.SequenceEqual(got),
                id + ": expected [" + Dump(expected) + "] got [" + Dump(got) + "]");
        }
    }

    [Fact]
    public void Facade_SuggestParts_UsesPartsProdCodeModelProblem()
    {
        foreach (var row in Root.GetProperty("cases").EnumerateArray())
        {
            var id = row.GetProperty("id").GetString();
            var catalog = CatalogOf(row);
            var payload = new JsonObject
            {
                ["parts"] = catalog,
                ["prodCode"] = row.GetProperty("prodCode").GetString(),
                ["model"] = row.GetProperty("model").GetString(),
                ["problem"] = row.GetProperty("problem").GetString()
            };
            var root = JsonDocument.Parse(_facade.Run("rules.suggestParts", payload.ToJsonString())).RootElement;
            Assert.True(root.GetProperty("ok").GetBoolean(), id + " facade ok");
            var got = new List<(string, string, double, string)>();
            foreach (var h in root.GetProperty("result").EnumerateArray())
            {
                got.Add((
                    h.GetProperty("code").GetString() ?? "",
                    h.GetProperty("name").GetString() ?? "",
                    h.GetProperty("qty").GetDouble(),
                    h.GetProperty("explain").GetString() ?? ""));
            }
            var expected = SlimExpected(row);
            Assert.True(expected.Count == got.Count && expected.SequenceEqual(got),
                id + " facade: expected [" + Dump(expected) + "] got [" + Dump(got) + "]");
        }
    }
}

internal static class JsonValQty
{
    public static string Str(JsonObject o, string k)
    {
        var n = o[k];
        return n?.ToString() ?? "";
    }

    public static double Num(JsonObject o, string k)
    {
        if (o[k] is not JsonValue v) return 0;
        if (v.TryGetValue<int>(out var i)) return i;
        if (v.TryGetValue<double>(out var d)) return d;
        return 0;
    }
}
