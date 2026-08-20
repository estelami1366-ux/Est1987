using System.Text.Json;
using Sirman.Core.Application;
using Sirman.Core.Business;
using Xunit;

namespace Sirman.Core.Tests;

/// <summary>
/// Phase 3 B1 — frozen JS↔C# vectors for invoice.line / invoice.totals.
/// Shared table: InvoicePricingParityVectors.json (also read by test_laegh.js).
/// </summary>
public class InvoicePricingParityTests
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
        var name = "InvoicePricingParityVectors.json";
        var candidates = new[]
        {
            Path.Combine(AppContext.BaseDirectory, name),
            Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "..", "..", "..", name))
        };
        foreach (var p in candidates)
        {
            if (File.Exists(p)) return p;
        }
        throw new FileNotFoundException("B1 parity vector file not found: " + name);
    }

    [Fact]
    public void Line_MatchesFrozenVectors()
    {
        foreach (var row in Root.GetProperty("line").EnumerateArray())
        {
            var id = row.GetProperty("id").GetString();
            var est = row.GetProperty("est").GetDouble();
            var disc = row.GetProperty("disc").GetDouble();
            var finRaw = row.GetProperty("finRaw").GetDouble();
            var da = row.GetProperty("da").GetDouble();
            var fin = row.GetProperty("fin").GetDouble();
            var line = InvoicePricing.Line(est, disc, finRaw);
            Assert.True(da == line.Da, id + " da: expected " + da + " got " + line.Da);
            Assert.True(fin == line.Fin, id + " fin: expected " + fin + " got " + line.Fin);
            Assert.Equal(est, line.Est);
            Assert.Equal(disc, line.Disc);
        }
    }

    [Fact]
    public void Totals_MatchesFrozenVectors()
    {
        foreach (var row in Root.GetProperty("totals").EnumerateArray())
        {
            var id = row.GetProperty("id").GetString();
            var priced = new List<InvoiceLine>();
            foreach (var l in row.GetProperty("lines").EnumerateArray())
            {
                priced.Add(InvoicePricing.Line(
                    l.GetProperty("est").GetDouble(),
                    l.GetProperty("disc").GetDouble(),
                    l.GetProperty("finRaw").GetDouble()));
            }
            var tot = InvoicePricing.Totals(priced);
            Assert.True(row.GetProperty("tE").GetDouble() == tot.TE, id + " tE");
            Assert.True(row.GetProperty("tD").GetDouble() == tot.TD, id + " tD");
            Assert.True(row.GetProperty("tF").GetDouble() == tot.TF, id + " tF");
        }
    }

    [Fact]
    public void Facade_InvoiceLine_UsesSameFieldNamesAndVectors()
    {
        foreach (var row in Root.GetProperty("line").EnumerateArray())
        {
            var id = row.GetProperty("id").GetString();
            var payload = JsonSerializer.Serialize(new
            {
                est = row.GetProperty("est").GetDouble().ToString(System.Globalization.CultureInfo.InvariantCulture),
                disc = row.GetProperty("disc").GetDouble().ToString(System.Globalization.CultureInfo.InvariantCulture),
                finRaw = row.GetProperty("finRaw").GetDouble().ToString(System.Globalization.CultureInfo.InvariantCulture)
            });
            var root = JsonDocument.Parse(_facade.Run("invoice.line", payload)).RootElement;
            Assert.True(root.GetProperty("ok").GetBoolean(), id + " facade ok");
            var result = root.GetProperty("result");
            Assert.True(result.TryGetProperty("est", out _));
            Assert.True(result.TryGetProperty("disc", out _));
            Assert.True(result.TryGetProperty("da", out _));
            Assert.True(result.TryGetProperty("fin", out _));
            Assert.True(row.GetProperty("da").GetDouble() == result.GetProperty("da").GetDouble(), id + " facade da");
            Assert.True(row.GetProperty("fin").GetDouble() == result.GetProperty("fin").GetDouble(), id + " facade fin");
        }
    }

    [Fact]
    public void Facade_InvoiceTotals_UsesSameFieldNamesAndVectors()
    {
        foreach (var row in Root.GetProperty("totals").EnumerateArray())
        {
            var id = row.GetProperty("id").GetString();
            var lines = new List<object>();
            foreach (var l in row.GetProperty("lines").EnumerateArray())
            {
                lines.Add(new
                {
                    est = l.GetProperty("est").GetDouble(),
                    disc = l.GetProperty("disc").GetDouble(),
                    finRaw = l.GetProperty("finRaw").GetDouble()
                });
            }
            var payload = JsonSerializer.Serialize(new { lines });
            var root = JsonDocument.Parse(_facade.Run("invoice.totals", payload)).RootElement;
            Assert.True(root.GetProperty("ok").GetBoolean(), id + " facade ok");
            var result = root.GetProperty("result");
            Assert.True(result.TryGetProperty("tE", out _));
            Assert.True(result.TryGetProperty("tD", out _));
            Assert.True(result.TryGetProperty("tF", out _));
            Assert.True(row.GetProperty("tE").GetDouble() == result.GetProperty("tE").GetDouble(), id + " facade tE");
            Assert.True(row.GetProperty("tD").GetDouble() == result.GetProperty("tD").GetDouble(), id + " facade tD");
            Assert.True(row.GetProperty("tF").GetDouble() == result.GetProperty("tF").GetDouble(), id + " facade tF");
        }
    }

    [Fact]
    public void JsRound_PositiveMidpoint_MatchesMathRound()
    {
        Assert.Equal(1, CalculationEngine.JsRound(0.5));
        Assert.Equal(2, CalculationEngine.JsRound(1.5));
        Assert.Equal(0, CalculationEngine.JsRound(0.49));
        Assert.Equal(1, CalculationEngine.JsRound(0.5));
    }
}
