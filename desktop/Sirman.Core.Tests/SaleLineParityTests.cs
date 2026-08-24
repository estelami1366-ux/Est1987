using System.Globalization;
using System.Text.Json;
using Sirman.Core.Application;
using Sirman.Core.Business;
using Xunit;

namespace Sirman.Core.Tests;

/// <summary>
/// Phase 3 B6 — frozen JS↔C# vectors for sale.line.
/// Shared table: SaleLineParityVectors.json (also read by test_laegh.js).
/// </summary>
public class SaleLineParityTests
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
        var name = "SaleLineParityVectors.json";
        var candidates = new[]
        {
            Path.Combine(AppContext.BaseDirectory, name),
            Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "..", "..", "..", name))
        };
        foreach (var p in candidates)
        {
            if (File.Exists(p)) return p;
        }
        throw new FileNotFoundException("B6 parity vector file not found: " + name);
    }

    [Fact]
    public void SaleLine_MatchesFrozenVectors()
    {
        foreach (var row in Root.GetProperty("line").EnumerateArray())
        {
            var id = row.GetProperty("id").GetString();
            var qty = row.GetProperty("qty").GetDouble();
            var price = row.GetProperty("price").GetDouble();
            var disc = row.GetProperty("disc").GetDouble();
            var outQty = row.GetProperty("outQty").GetDouble();
            var discAmt = row.GetProperty("discAmt").GetDouble();
            var total = row.GetProperty("total").GetDouble();
            var line = InvoicePricing.SaleLine(qty, price, disc);
            Assert.True(outQty == line.Qty, id + " qty: expected " + outQty + " got " + line.Qty);
            Assert.True(discAmt == line.DiscAmt, id + " discAmt: expected " + discAmt + " got " + line.DiscAmt);
            Assert.True(total == line.Total, id + " total: expected " + total + " got " + line.Total);
            Assert.Equal(price, line.Price);
            Assert.Equal(disc, line.Disc);
        }
    }

    [Fact]
    public void Facade_SaleLine_UsesSameFieldNamesAndVectors()
    {
        foreach (var row in Root.GetProperty("line").EnumerateArray())
        {
            var id = row.GetProperty("id").GetString();
            var payload = JsonSerializer.Serialize(new
            {
                qty = row.GetProperty("qty").GetDouble().ToString(CultureInfo.InvariantCulture),
                price = row.GetProperty("price").GetDouble().ToString(CultureInfo.InvariantCulture),
                disc = row.GetProperty("disc").GetDouble().ToString(CultureInfo.InvariantCulture)
            });
            var root = JsonDocument.Parse(_facade.Run("sale.line", payload)).RootElement;
            Assert.True(root.GetProperty("ok").GetBoolean(), id + " facade ok");
            var result = root.GetProperty("result");
            Assert.True(result.TryGetProperty("qty", out _));
            Assert.True(result.TryGetProperty("price", out _));
            Assert.True(result.TryGetProperty("disc", out _));
            Assert.True(result.TryGetProperty("discAmt", out _));
            Assert.True(result.TryGetProperty("total", out _));
            Assert.True(row.GetProperty("outQty").GetDouble() == result.GetProperty("qty").GetDouble(), id + " facade qty");
            Assert.True(row.GetProperty("discAmt").GetDouble() == result.GetProperty("discAmt").GetDouble(), id + " facade discAmt");
            Assert.True(row.GetProperty("total").GetDouble() == result.GetProperty("total").GetDouble(), id + " facade total");
        }
    }

    [Fact]
    public void Facade_SaleLine_MissingQtyBecomesOne()
    {
        var root = JsonDocument.Parse(_facade.Run("sale.line", """{"price":1000,"disc":0}""")).RootElement;
        Assert.True(root.GetProperty("ok").GetBoolean());
        var result = root.GetProperty("result");
        Assert.Equal(1, result.GetProperty("qty").GetDouble());
        Assert.Equal(1000, result.GetProperty("total").GetDouble());
        Assert.Equal(0, result.GetProperty("discAmt").GetDouble());
    }
}
