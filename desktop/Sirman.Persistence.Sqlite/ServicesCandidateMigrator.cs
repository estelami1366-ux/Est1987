using System.Text.Json;
using System.Text.Json.Nodes;
using Sirman.Core.Data.Persistence;

namespace Sirman.Persistence.Sqlite;

public sealed class ServicesMigrationResult
{
    public required bool Ok { get; init; }
    public required string DatabasePath { get; init; }
    public required string JournalMode { get; init; }
    public required bool ForeignKeys { get; init; }
    public required string Integrity { get; init; }
    public required int SchemaVersion { get; init; }
    public required ServiceParityResult Parity { get; init; }
    public required IReadOnlyList<ServiceCatalogRecord> Mapped { get; init; }
    public required string ExtractionSource { get; init; }
    public required IReadOnlyList<string> GeneratedIds { get; init; }
}

public static class ServicesCandidateMigrator
{
    public static ServicesMigrationResult RunFromHtml(string htmlPath, string dbPath, DateTimeOffset now)
    {
        var extracted = LegacyServiceCatalogExtractor.FromHtmlFile(htmlPath);
        return Run(extracted, dbPath, now);
    }

    public static ServicesMigrationResult RunFromJson(string json, string source, string dbPath, DateTimeOffset now)
    {
        var extracted = LegacyServiceCatalogExtractor.FromJsonArray(json, source);
        return Run(extracted, dbPath, now);
    }

    public static ServicesMigrationResult Run(LegacyServiceExtraction extracted, string dbPath, DateTimeOffset now)
    {
        var mapped = ServiceCanonicalMapper.MapAll(extracted.Records, now);
        using var conn = SqliteCandidateDatabase.OpenInitialized(dbPath);
        var journal = SqliteCandidateDatabase.JournalMode(conn);
        var fk = SqliteCandidateDatabase.ForeignKeys(conn);
        var integrity = SqliteCandidateDatabase.IntegrityCheck(conn);
        var store = new SqliteServiceCandidateStore(conn);
        store.ReplaceAll(mapped);
        var dbRows = store.ListAll();
        var parity = ServiceParityChecker.Compare(mapped, dbRows);
        if (!parity.Ok)
            throw new InvalidOperationException("PARITY FAILED: " + parity.Detail);
        return new ServicesMigrationResult
        {
            Ok = true,
            DatabasePath = dbPath,
            JournalMode = journal,
            ForeignKeys = fk,
            Integrity = integrity,
            SchemaVersion = SqliteCandidateDatabase.ReadSchemaVersion(conn),
            Parity = parity,
            Mapped = mapped,
            ExtractionSource = extracted.Source,
            GeneratedIds = mapped.Where(m => m.IdSource == "generated-hash").Select(m => m.ServiceId).ToList()
        };
    }

    public static void WriteArtifacts(string artifactDir, LegacyServiceExtraction extracted, ServicesMigrationResult mig, CandidateSnapshotResult snap)
    {
        Directory.CreateDirectory(artifactDir);
        var arr = new JsonArray();
        foreach (var o in extracted.Records)
            arr.Add(o.DeepClone());
        File.WriteAllText(Path.Combine(artifactDir, "services.source.json"), arr.ToJsonString(new JsonSerializerOptions { WriteIndented = true }));
        var destDb = Path.Combine(artifactDir, "services.candidate.sqlite");
        if (!string.Equals(Path.GetFullPath(mig.DatabasePath), Path.GetFullPath(destDb), StringComparison.OrdinalIgnoreCase))
            SqliteCandidateBackup.Snapshot(mig.DatabasePath, destDb);
        var parity = new
        {
            mig.Parity.Ok,
            mig.Parity.SourceCount,
            mig.Parity.DbCount,
            mig.Parity.IdParity,
            mig.Parity.CodeParity,
            mig.Parity.FieldParity,
            mig.Parity.HashParity,
            mig.Parity.AggregateHashSource,
            mig.Parity.AggregateHashDb,
            mig.JournalMode,
            mig.ForeignKeys,
            mig.Integrity,
            mig.SchemaVersion,
            generatedIds = mig.GeneratedIds,
            extractionSource = mig.ExtractionSource
        };
        File.WriteAllText(Path.Combine(artifactDir, "services.parity.json"), JsonSerializer.Serialize(parity, new JsonSerializerOptions { WriteIndented = true }));
        File.WriteAllText(Path.Combine(artifactDir, "services.sha256"), snap.Sha256 + "  services.candidate.sqlite\n");
    }
}
