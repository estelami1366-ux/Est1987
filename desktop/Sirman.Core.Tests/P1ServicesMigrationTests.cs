using System.Text.Json.Nodes;
using Sirman.Core.Data.Persistence;
using Sirman.Persistence.Sqlite;
using Xunit;

namespace Sirman.Core.Tests;

public class P1ServicesMigrationTests
{
    private static string RepoRoot()
    {
        var dir = new DirectoryInfo(AppContext.BaseDirectory);
        while (dir != null)
        {
            if (File.Exists(Path.Combine(dir.FullName, "Sirman_Final.html")))
                return dir.FullName;
            dir = dir.Parent;
        }
        throw new DirectoryNotFoundException("repo root with Sirman_Final.html not found");
    }

    private static string HtmlPath() => Path.Combine(RepoRoot(), "Sirman_Final.html");

    [Fact]
    public void SchemaInfo_wal_foreignKeys_integrity_ok()
    {
        var db = Path.Combine(Path.GetTempPath(), "sirman-p1-" + Guid.NewGuid().ToString("n") + ".sqlite");
        using var conn = SqliteCandidateDatabase.OpenInitialized(db);
        Assert.Equal("wal", SqliteCandidateDatabase.JournalMode(conn), ignoreCase: true);
        Assert.True(SqliteCandidateDatabase.ForeignKeys(conn));
        Assert.Equal("ok", SqliteCandidateDatabase.IntegrityCheck(conn), ignoreCase: true);
        Assert.Equal(1, SqliteCandidateDatabase.ReadSchemaVersion(conn));
    }

    [Fact]
    public void IntegrityCheck_corruptFile_throws_noLegacyFallback()
    {
        var db = Path.Combine(Path.GetTempPath(), "sirman-p1-bad-" + Guid.NewGuid().ToString("n") + ".sqlite");
        File.WriteAllText(db, "this is not a sqlite database");
        var ex = Assert.ThrowsAny<Exception>(() => SqliteCandidateDatabase.OpenInitialized(db));
        var text = ex.ToString();
        Assert.True(
            text.Contains("STOP", StringComparison.Ordinal)
            || text.Contains("not a database", StringComparison.OrdinalIgnoreCase)
            || text.Contains("integrity", StringComparison.OrdinalIgnoreCase)
            || text.Contains("Sqlite", StringComparison.OrdinalIgnoreCase));
    }

    [Fact]
    public void Extractor_readsDefaultLs2FromHtml()
    {
        var ext = LegacyServiceCatalogExtractor.FromHtmlFile(HtmlPath());
        Assert.Equal(4, ext.SourceCount);
        Assert.Equal("S001", ext.Records[0]["code"]!.ToString());
    }

    [Fact]
    public void Mapper_preservesUnknownFields_andUsesCodeAsId()
    {
        var json = """[{"code":"SX","name":"X","cat":"عمومی","price":1,"warr":"no","note":"extra-ü","flag":true}]""";
        var ext = LegacyServiceCatalogExtractor.FromJsonArray(json, "fixture");
        var mapped = ServiceCanonicalMapper.MapAll(ext.Records, DateTimeOffset.Parse("2026-08-24T19:00:00+03:30"));
        Assert.Single(mapped);
        Assert.Equal("SX", mapped[0].ServiceId);
        Assert.Equal("existing-code", mapped[0].IdSource);
        Assert.Contains("note", mapped[0].JsonExtra, StringComparison.Ordinal);
        Assert.Contains("flag", mapped[0].JsonExtra, StringComparison.Ordinal);
    }

    [Fact]
    public void Mapper_existingId_preferredOverCode()
    {
        var json = """[{"id":"keep-me","code":"SX","name":"X"}]""";
        var mapped = ServiceCanonicalMapper.MapAll(
            LegacyServiceCatalogExtractor.FromJsonArray(json, "fixture").Records,
            DateTimeOffset.UtcNow);
        Assert.Equal("keep-me", mapped[0].ServiceId);
        Assert.Equal("existing-id", mapped[0].IdSource);
    }

    [Fact]
    public void Mapper_generatedHash_whenNoIdOrCode_isReported()
    {
        var json = """[{"name":"orphan","cat":"عمومی"}]""";
        var mapped = ServiceCanonicalMapper.MapAll(
            LegacyServiceCatalogExtractor.FromJsonArray(json, "fixture").Records,
            DateTimeOffset.UtcNow);
        Assert.StartsWith("mig_svc_", mapped[0].ServiceId, StringComparison.Ordinal);
        Assert.Equal("generated-hash", mapped[0].IdSource);
        Assert.Equal(24, mapped[0].ServiceId.Length);
    }

    [Fact]
    public void Import_unknownFields_roundtripThroughSqlite()
    {
        var db = Path.Combine(Path.GetTempPath(), "sirman-p1-extra-" + Guid.NewGuid().ToString("n") + ".sqlite");
        var json = """[{"code":"SX","name":"X","note":"keep","flag":true}]""";
        var r = ServicesCandidateMigrator.RunFromJson(json, "fixture", db, DateTimeOffset.UtcNow);
        Assert.True(r.Parity.Ok);
        using var conn = SqliteCandidateDatabase.OpenInitialized(db);
        var row = new SqliteServiceCandidateStore(conn).ListAll()[0];
        Assert.Contains("note", row.JsonExtra, StringComparison.Ordinal);
        Assert.Contains("flag", row.JsonExtra, StringComparison.Ordinal);
        Assert.Equal(r.Mapped[0].RowHash, row.RowHash);
    }

    [Fact]
    public void SchemaInfo_newerThanApp_refuses()
    {
        var db = Path.Combine(Path.GetTempPath(), "sirman-p1-schema-" + Guid.NewGuid().ToString("n") + ".sqlite");
        using (var conn = SqliteCandidateDatabase.OpenInitialized(db))
        {
            using var cmd = conn.CreateCommand();
            cmd.CommandText = "UPDATE schema_info SET schema_version = 99 WHERE id = 1";
            Assert.Equal(1, cmd.ExecuteNonQuery());
        }
        var ex = Assert.Throws<InvalidOperationException>(() => SqliteCandidateDatabase.OpenInitialized(db));
        Assert.Contains("STOP", ex.Message, StringComparison.Ordinal);
        Assert.Contains("newer", ex.Message, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void CurrentStorage_kind_unchanged_htmlLocalStorage()
    {
        Assert.Equal("html-localStorage-indexeddb", Sirman.Core.Data.CurrentStorage.Kind);
        Assert.Equal("Sirman_Final.html", Sirman.Core.Data.CurrentStorage.Owner);
    }

    [Fact]
    public void DesktopHost_csproj_doesNotReferencePersistenceSqlite()
    {
        var csproj = Path.Combine(RepoRoot(), "desktop", "Sirman.Desktop", "Sirman.Desktop.csproj");
        var text = File.ReadAllText(csproj);
        Assert.DoesNotContain("Sirman.Persistence.Sqlite", text, StringComparison.Ordinal);
        Assert.DoesNotContain("Microsoft.Data.Sqlite", text, StringComparison.Ordinal);
    }

    [Fact]
    public void Import_htmlSeed_parity()
    {
        var db = Path.Combine(Path.GetTempPath(), "sirman-p1-mig-" + Guid.NewGuid().ToString("n") + ".sqlite");
        var r = ServicesCandidateMigrator.RunFromHtml(HtmlPath(), db, DateTimeOffset.UtcNow);
        Assert.True(r.Ok);
        Assert.True(r.Parity.Ok);
        Assert.Equal(4, r.Parity.SourceCount);
        Assert.Equal(4, r.Parity.DbCount);
        Assert.True(r.Parity.IdParity);
        Assert.True(r.Parity.CodeParity);
        Assert.True(r.Parity.FieldParity);
        Assert.True(r.Parity.HashParity);
        Assert.Empty(r.GeneratedIds);
    }

    [Fact]
    public void ReplaceAll_duplicateId_rollsBack()
    {
        var db = Path.Combine(Path.GetTempPath(), "sirman-p1-rb-" + Guid.NewGuid().ToString("n") + ".sqlite");
        var first = ServicesCandidateMigrator.RunFromHtml(HtmlPath(), db, DateTimeOffset.UtcNow);
        Assert.Equal(4, first.Parity.DbCount);

        var dup = new JsonArray
        {
            new JsonObject { ["code"] = "DUP", ["name"] = "a" },
            new JsonObject { ["code"] = "DUP", ["name"] = "b" }
        }.ToJsonString();
        Assert.ThrowsAny<Exception>(() =>
            ServicesCandidateMigrator.RunFromJson(dup, "dup", db, DateTimeOffset.UtcNow));

        using var conn = SqliteCandidateDatabase.OpenInitialized(db);
        var store = new SqliteServiceCandidateStore(conn);
        Assert.Equal(4, store.Count());
        Assert.Equal("S001", store.ListAll()[0].ServiceId);
    }

    [Fact]
    public void Candidate_snapshot_and_stagingRestore_matchHash()
    {
        var dir = Path.Combine(Path.GetTempPath(), "sirman-p1-bak-" + Guid.NewGuid().ToString("n"));
        Directory.CreateDirectory(dir);
        var db = Path.Combine(dir, "sirman.sqlite");
        var r = ServicesCandidateMigrator.RunFromHtml(HtmlPath(), db, DateTimeOffset.UtcNow);
        var snap = SqliteCandidateBackup.Snapshot(db, Path.Combine(dir, "services.candidate.sqlite"));
        Assert.Equal("ok", snap.Integrity, ignoreCase: true);
        Assert.Equal(4, snap.RowCount);
        Assert.Equal(r.Parity.AggregateHashSource, snap.AggregateHash);
        var staging = SqliteCandidateBackup.RestoreToStaging(snap.SnapshotPath, Path.Combine(dir, "staging.sqlite"));
        Assert.Equal(snap.RowCount, staging.RowCount);
        Assert.Equal(snap.AggregateHash, staging.AggregateHash);
        Assert.Equal("ok", staging.Integrity, ignoreCase: true);
    }

    [Fact]
    public void WriteArtifacts_repoMigrationFolder()
    {
        var artifact = Path.Combine(RepoRoot(), "deliveries", "migration", "P1-services");
        Directory.CreateDirectory(artifact);
        var db = Path.Combine(artifact, "services.candidate.sqlite");
        if (File.Exists(db)) File.Delete(db);
        var extracted = LegacyServiceCatalogExtractor.FromHtmlFile(HtmlPath());
        var mig = ServicesCandidateMigrator.Run(extracted, db, DateTimeOffset.UtcNow);
        var snap = SqliteCandidateBackup.Inspect(db);
        ServicesCandidateMigrator.WriteArtifacts(artifact, extracted, mig, snap);
        Assert.True(File.Exists(Path.Combine(artifact, "services.source.json")));
        Assert.True(File.Exists(Path.Combine(artifact, "services.parity.json")));
        Assert.True(File.Exists(Path.Combine(artifact, "services.sha256")));
        Assert.True(File.Exists(db));
    }
}
