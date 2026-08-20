using System.Globalization;
using System.Text.Json;
using Sirman.Core.Application;
using Sirman.Core.Business;
using Xunit;

namespace Sirman.Core.Tests;

/// <summary>
/// Phase 3 B8 — frozen JS↔C# vectors for sale.total.
/// Shared table: SaleTotalParityVectors.json (also read by test_laegh.js).
/// SaleTotal is the sum of InvoicePricing.SaleLine totals (B6 formula).
/// </summary>
public class SaleTotalParityTests
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
        var name = "SaleTotalParityVectors.json";
        var candidates = new[]
        {
            Path.Combine(AppContext.BaseDirectory, name),
            Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "..", "..", "..", name))
        };
        foreach (var p in candidates)
        {
            if (File.Exists(p)) return p;
        }
        throw new FileNotFoundException("B8 parity vector file not found: " + name);
    }

    private static List<SaleLine> LinesFromRow(JsonElement row)
    {
        var lines = new List<SaleLine>();
        foreach (var item in row.GetProperty("items").EnumerateArray())
        {
            var qty = item.GetProperty("qty").GetDouble();
            var price = item.GetProperty("price").GetDouble();
            var disc = item.GetProperty("disc").GetDouble();
            lines.Add(InvoicePricing.SaleLine(qty, price, disc));
        }
        return lines;
    }

    [Fact]
    public void SaleTotal_MatchesFrozenVectors()
    {
        foreach (var row in Root.GetProperty("total").EnumerateArray())
        {
            var id = row.GetProperty("id").GetString();
            var expected = row.GetProperty("expected").GetDouble();
            var lines = LinesFromRow(row);
            var got = InvoicePricing.SaleTotal(lines);
            Assert.True(expected == got, id + ": expected " + expected + " got " + got);
        }
    }

    [Fact]
    public void SaleTotal_IsSumOfSaleLineTotals()
    {
        foreach (var row in Root.GetProperty("total").EnumerateArray())
        {
            var id = row.GetProperty("id").GetString();
            var lines = LinesFromRow(row);
            double sum = 0;
            foreach (var line in lines) sum += line.Total;
            Assert.True(sum == InvoicePricing.SaleTotal(lines), id + " must equal sum of SaleLine.Total");
        }
    }

    [Fact]
    public void SaleTotal_EmptyList_IsZero()
    {
        Assert.Equal(0, InvoicePricing.SaleTotal(Array.Empty<SaleLine>()));
        Assert.Equal(0, InvoicePricing.SaleTotal(new List<SaleLine>()));
    }

    [Fact]
    public void Facade_SaleTotal_UsesItemsShapeAndVectors()
    {
        foreach (var row in Root.GetProperty("total").EnumerateArray())
        {
            var id = row.GetProperty("id").GetString();
            var items = new List<object>();
            foreach (var item in row.GetProperty("items").EnumerateArray())
            {
                items.Add(new
                {
                    qty = item.GetProperty("qty").GetDouble().ToString(CultureInfo.InvariantCulture),
                    price = item.GetProperty("price").GetDouble().ToString(CultureInfo.InvariantCulture),
                    disc = item.GetProperty("disc").GetDouble().ToString(CultureInfo.InvariantCulture)
                });
            }
            var payload = JsonSerializer.Serialize(new { items });
            var root = JsonDocument.Parse(_facade.Run("sale.total", payload)).RootElement;
            Assert.True(root.GetProperty("ok").GetBoolean(), id + " facade ok");
            Assert.True(row.GetProperty("expected").GetDouble() == root.GetProperty("result").GetDouble(), id + " facade total");
        }
    }
}
