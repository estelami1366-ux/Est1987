using System.Text.Json;
using System.Text.Json.Nodes;
using Sirman.Core.Application;
using Sirman.Core.Business;
using Xunit;

namespace Sirman.Core.Tests;

/// <summary>
/// Phase 3 B17 — safe fail-closed contract for inventory.stock.
/// Does not change InventoryCore.Stock, Facade, or ownership.
/// Distinguishes real zero stock from INVENTORY_UNAVAILABLE.
/// </summary>
public class InventoryStockFailClosedTests
{
    private static readonly JsonElement Contract = Load("InventoryStockFailClosedContract.json");
    private static readonly JsonElement Parity = Load("InventoryStockParityVectors.json");
    private readonly BusinessFacade _facade = new();

    private static JsonElement Load(string name)
    {
        var candidates = new[]
        {
            Path.Combine(AppContext.BaseDirectory, name),
            Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "..", "..", "..", name))
        };
        foreach (var p in candidates)
        {
            if (File.Exists(p)) return JsonDocument.Parse(File.ReadAllText(p)).RootElement.Clone();
        }
        throw new FileNotFoundException("B17 contract/parity file not found: " + name);
    }

    private static bool StockDataAvailable(JsonElement snap)
    {
        if (snap.ValueKind != JsonValueKind.Object) return false;
        if (snap.TryGetProperty("ok", out var ok) && ok.ValueKind == JsonValueKind.False) return false;
        if (!snap.TryGetProperty("qty", out var qty)) return false;
        if (qty.ValueKind == JsonValueKind.Number && qty.TryGetDouble(out var n) && double.IsFinite(n)) return true;
        return false;
    }

    [Fact]
    public void Contract_FailureIsNotFakeZeroStock()
    {
        var failure = JsonSerializer.SerializeToElement(new
        {
            ok = false,
            reason = Contract.GetProperty("failure").GetProperty("reason").GetString()
        });
        Assert.Equal("INVENTORY_UNAVAILABLE", failure.GetProperty("reason").GetString());
        Assert.False(failure.GetProperty("ok").GetBoolean());
        Assert.False(StockDataAvailable(failure));
        Assert.False(failure.TryGetProperty("qty", out _));
        Assert.False(failure.TryGetProperty("reserved", out _));
        Assert.False(failure.TryGetProperty("available", out _));
    }

    [Fact]
    public void Contract_RealZeroStockFromCoreIsDataNotFailure()
    {
        var empty = InventoryCore.Stock(new JsonObject(), "");
        var json = JsonDocument.Parse(empty.ToJson().ToJsonString()).RootElement;
        Assert.Equal(0, json.GetProperty("qty").GetInt32());
        Assert.Equal(0, json.GetProperty("available").GetInt32());
        Assert.True(StockDataAvailable(json));
        Assert.True(json.TryGetProperty("qty", out _));
        Assert.False(json.TryGetProperty("ok", out var ok) && ok.ValueKind == JsonValueKind.False);
    }

    [Fact]
    public void B16_ParityVectors_RemainSuccessShaped()
    {
        foreach (var row in Parity.GetProperty("cases").EnumerateArray())
        {
            var id = row.GetProperty("id").GetString();
            var expected = row.GetProperty("expected");
            Assert.True(StockDataAvailable(expected), id + " expected must remain real stock data");
            var item = row.TryGetProperty("item", out var itemEl) && itemEl.ValueKind == JsonValueKind.Object
                ? JsonNode.Parse(itemEl.GetRawText())!.AsObject()
                : null;
            var got = InventoryCore.Stock(item, row.GetProperty("whId").GetString() ?? "");
            var gotJson = JsonDocument.Parse(got.ToJson().ToJsonString()).RootElement;
            Assert.True(StockDataAvailable(gotJson), id + " Core Stock must remain success-shaped");
        }
    }

    [Fact]
    public void Facade_InventoryStock_StillReturnsSnapshotNotFailure()
    {
        var root = JsonDocument.Parse(_facade.Run("inventory.stock", """{"item":{"qty":10,"reserved":4},"whId":""}""")).RootElement;
        Assert.True(root.GetProperty("ok").GetBoolean());
        var result = root.GetProperty("result");
        Assert.True(StockDataAvailable(result));
        Assert.Equal(10, result.GetProperty("qty").GetInt32());
        Assert.False(result.TryGetProperty("reason", out _));
    }

    [Fact]
    public void Contract_CallersAreDocumented()
    {
        var callers = Contract.GetProperty("callers");
        Assert.True(callers.GetArrayLength() >= 11, "B17 must inventory live invStockSnapshot callers");
    }
}
