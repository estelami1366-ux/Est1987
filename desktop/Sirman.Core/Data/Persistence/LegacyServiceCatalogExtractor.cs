using System.Text.Json.Nodes;
using System.Text.RegularExpressions;

namespace Sirman.Core.Data.Persistence;

/// <summary>
/// استخراج فقط‌خواندنی خدمات از آرایهٔ JSON یا بذر پیش‌فرض HTML. localStorage فروشگاه را تغییر نمی‌دهد.
/// </summary>
public static class LegacyServiceCatalogExtractor
{
    public static LegacyServiceExtraction FromJsonArray(string json, string source)
    {
        if (string.IsNullOrWhiteSpace(json))
            throw new InvalidOperationException("STOP — BLOCKED: empty services JSON");
        var node = JsonNode.Parse(json);
        if (node is not JsonArray arr)
            throw new InvalidOperationException("STOP — BLOCKED: services JSON is not an array");
        var records = new List<JsonObject>();
        foreach (var item in arr)
        {
            if (item is not JsonObject o)
                throw new InvalidOperationException("STOP — BLOCKED: service row is not an object");
            records.Add((JsonObject)o.DeepClone());
        }
        return new LegacyServiceExtraction
        {
            Records = records,
            SourceCount = records.Count,
            Source = source
        };
    }

    public static LegacyServiceExtraction FromHtmlFile(string htmlPath)
    {
        if (!File.Exists(htmlPath))
            throw new InvalidOperationException("STOP — BLOCKED: HTML not found: " + htmlPath);
        var html = File.ReadAllText(htmlPath);
        var m = Regex.Match(
            html,
            @"localStorage\.getItem\('ls2'\)\s*\|\|\s*'(\[.*?\])'",
            RegexOptions.CultureInvariant);
        if (!m.Success)
            throw new InvalidOperationException("STOP — BLOCKED: ls2 default services array not found in HTML");
        return FromJsonArray(m.Groups[1].Value, htmlPath);
    }
}
