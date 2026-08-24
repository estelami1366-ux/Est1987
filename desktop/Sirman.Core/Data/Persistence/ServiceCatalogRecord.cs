using System.Text.Json.Nodes;

namespace Sirman.Core.Data.Persistence;

/// <summary>
/// ردیف کاتالوگ خدمات برای مهاجرت candidate. منطق قیمت/گارانتی کسب‌وکار اینجا نیست.
/// </summary>
public sealed class ServiceCatalogRecord
{
    public required string ServiceId { get; init; }
    public string? Code { get; init; }
    public string? Name { get; init; }
    public string? Cat { get; init; }
    public int? Price { get; init; }
    public string? Warr { get; init; }
    public required string JsonExtra { get; init; }
    public required string RowHash { get; init; }
    public required string IdSource { get; init; }
    public required string MigratedAt { get; init; }
}

public sealed class LegacyServiceExtraction
{
    public required IReadOnlyList<JsonObject> Records { get; init; }
    public required int SourceCount { get; init; }
    public required string Source { get; init; }
}

public sealed class ServiceParityResult
{
    public bool Ok { get; init; }
    public int SourceCount { get; init; }
    public int DbCount { get; init; }
    public bool IdParity { get; init; }
    public bool CodeParity { get; init; }
    public bool FieldParity { get; init; }
    public bool HashParity { get; init; }
    public string AggregateHashSource { get; init; } = "";
    public string AggregateHashDb { get; init; } = "";
    public string Detail { get; init; } = "";
}

public static class CandidateStoragePaths
{
    /// <summary>مسیر candidate — نه SoT زنده. جدا از پوشه بک‌آپ تولیدی.</summary>
    public static string DefaultDatabasePath()
    {
        var root = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData),
            "Sirman",
            "data");
        return Path.Combine(root, "sirman.sqlite");
    }
}
