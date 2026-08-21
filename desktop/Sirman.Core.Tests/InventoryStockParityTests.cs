using System.Text.Json;
using System.Text.Json.Nodes;
using Sirman.Core.Application;
using Sirman.Core.Business;
using Xunit;

namespace Sirman.Core.Tests;

/// <summary>
/// Phase 3 B16 — frozen JS↔C# vectors for inventory.stock.
/// Shared table: InventoryStockParityVectors.json (also read by test_laegh.js).
/// Read-only snapshots only. Does not migrate ownership. Does not mutate inventory.
/// </summary>
public class InventoryStockParityTests
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
        var name = "InventoryStockParityVectors.json";
        var candidates = new[]
        {
            Path.Combine(AppContext.BaseDirectory, name),
            Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "..", "..", "..", name))
        };
        foreach (var p in candidates)
        {
            if (File.Exists(p)) return p;
        }
        throw new FileNotFoundException("B16 parity vector file not found: " + name);
    }

    private static JsonObject? ItemOf(JsonElement row)
    {
        if (!row.TryGetProperty("item", out var item) || item.ValueKind is JsonValueKind.Null or JsonValueKind.Undefined)
            return null;
        return JsonNode.Parse(item.GetRawText())!.AsObject();
    }

    private static string WhOf(JsonElement row) => row.GetProperty("whId").GetString() ?? "";

    private static (int qty, int reserved, int available, int min, int reorder, double price) ExpectedOf(JsonElement row)
    {
        var e = row.GetProperty("expected");
        return (
            e.GetProperty("qty").GetInt32(),
            e.GetProperty("reserved").GetInt32(),
            e.GetProperty("available").GetInt32(),
            e.GetProperty("min").GetInt32(),
            e.GetProperty("reorder").GetInt32(),
            e.GetProperty("price").GetDouble());
    }

    private static (int qty, int reserved, int available, int min, int reorder, double price) FromSnap(StockSnapshot s) =>
        (s.Qty, s.Reserved, s.Available, s.Min, s.Reorder, s.Price);

    private static (int qty, int reserved, int available, int min, int reorder, double price) FromJson(JsonElement s) =>
        (
            s.GetProperty("qty").GetInt32(),
            s.GetProperty("reserved").GetInt32(),
            s.GetProperty("available").GetInt32(),
            s.GetProperty("min").GetInt32(),
            s.GetProperty("reorder").GetInt32(),
            s.GetProperty("price").GetDouble());

    private static string Dump((int qty, int reserved, int available, int min, int reorder, double price) s) =>
        $"qty={s.qty} reserved={s.reserved} available={s.available} min={s.min} reorder={s.reorder} price={s.price}";

    [Fact]
    public void Stock_MatchesFrozenVectors()
    {
        foreach (var row in Root.GetProperty("cases").EnumerateArray())
        {
            var id = row.GetProperty("id").GetString();
            var got = FromSnap(InventoryCore.Stock(ItemOf(row), WhOf(row)));
            var expected = ExpectedOf(row);
            Assert.True(got == expected, id + ": expected [" + Dump(expected) + "] got [" + Dump(got) + "]");
        }
    }

    [Fact]
    public void Facade_InventoryStock_MatchesFrozenVectors()
    {
        foreach (var row in Root.GetProperty("cases").EnumerateArray())
        {
            var id = row.GetProperty("id").GetString();
            var payload = new JsonObject
            {
                ["item"] = ItemOf(row) is { } item ? item : null,
                ["whId"] = WhOf(row)
            };
            var root = JsonDocument.Parse(_facade.Run("inventory.stock", payload.ToJsonString())).RootElement;
            Assert.True(root.GetProperty("ok").GetBoolean(), id + " facade ok");
            var got = FromJson(root.GetProperty("result"));
            var expected = ExpectedOf(row);
            Assert.True(got == expected, id + " facade: expected [" + Dump(expected) + "] got [" + Dump(got) + "]");
        }
    }

    [Fact]
    public void Stock_DoesNotMutateItem()
    {
        foreach (var row in Root.GetProperty("cases").EnumerateArray())
        {
            var id = row.GetProperty("id").GetString();
            var item = ItemOf(row);
            if (item is null) continue;
            var before = item.ToJsonString();
            _ = InventoryCore.Stock(item, WhOf(row));
            Assert.True(before == item.ToJsonString(), id + " mutated the input item");
        }
    }
}
