using System.Globalization;
using System.Text.Json;
using Sirman.Core.Application;
using Sirman.Core.Business;
using Xunit;

namespace Sirman.Core.Tests;

/// <summary>
/// Phase 3 B10 — frozen JS↔C# vectors for calc.warrantyEndDate.
/// Shared table: WarrantyEndDateParityVectors.json (also read by test_laegh.js).
/// Does not migrate ownership. Does not change calendar arithmetic.
/// </summary>
public class WarrantyEndDateParityTests
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
        var name = "WarrantyEndDateParityVectors.json";
        var candidates = new[]
        {
            Path.Combine(AppContext.BaseDirectory, name),
            Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "..", "..", "..", name))
        };
        foreach (var p in candidates)
        {
            if (File.Exists(p)) return p;
        }
        throw new FileNotFoundException("B10 parity vector file not found: " + name);
    }

    [Fact]
    public void WarrantyEndDate_MatchesFrozenVectors()
    {
        foreach (var row in Root.GetProperty("date").EnumerateArray())
        {
            var id = row.GetProperty("id").GetString();
            var date = row.GetProperty("date").GetString() ?? "";
            var months = row.GetProperty("months").GetInt32();
            var expected = row.GetProperty("expected").GetString() ?? "";
            var got = CalculationEngine.WarrantyEndDate(date, months);
            Assert.True(expected == got, id + ": expected " + expected + " got " + got);
        }
    }

    [Fact]
    public void AddJalaliMonths_MatchesSameVectors()
    {
        foreach (var row in Root.GetProperty("date").EnumerateArray())
        {
            var id = row.GetProperty("id").GetString();
            var date = row.GetProperty("date").GetString() ?? "";
            var months = row.GetProperty("months").GetInt32();
            var expected = row.GetProperty("expected").GetString() ?? "";
            var got = CalculationEngine.AddJalaliMonths(date, months);
            Assert.True(expected == got, id + " AddJalaliMonths: expected " + expected + " got " + got);
        }
    }

    [Fact]
    public void Facade_WarrantyEndDate_UsesPurchaseDateAndPeriodMonths()
    {
        foreach (var row in Root.GetProperty("date").EnumerateArray())
        {
            var id = row.GetProperty("id").GetString();
            var date = row.GetProperty("date").GetString() ?? "";
            var months = row.GetProperty("months").GetInt32();
            var expected = row.GetProperty("expected").GetString() ?? "";
            var payload = JsonSerializer.Serialize(new
            {
                purchaseDate = date,
                periodMonths = months.ToString(CultureInfo.InvariantCulture)
            });
            var root = JsonDocument.Parse(_facade.Run("calc.warrantyEndDate", payload)).RootElement;
            Assert.True(root.GetProperty("ok").GetBoolean(), id + " facade ok");
            var got = root.GetProperty("result").GetString() ?? "";
            Assert.True(expected == got, id + " facade: expected " + expected + " got " + got);
        }
    }
}
