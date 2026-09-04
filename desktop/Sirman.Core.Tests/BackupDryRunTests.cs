using System.Text.Json;
using System.Text.Json.Nodes;
using Sirman.Core.Backup;
using Sirman.Core.Data.Repositories;
using Xunit;

namespace Sirman.Core.Tests;

/// <summary>
/// ARCH-4 — HTML dry-run golden vs BackupDryRunService. Composes ARCH-2 + ARCH-3.
/// If a fixture differs, stop; do not change HTML to make Core pass.
/// </summary>
public class BackupDryRunTests
{
    private static readonly JsonElement Root = LoadRoot();

    private static JsonElement LoadRoot()
    {
        var path = FindGoldenPath();
        return JsonDocument.Parse(File.ReadAllText(path)).RootElement;
    }

    private static string FindGoldenPath()
    {
        const string name = "BackupDryRunGolden.json";
        var candidates = new[]
        {
            Path.Combine(AppContext.BaseDirectory, name),
            Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "..", "..", "..", name))
        };
        foreach (var p in candidates)
        {
            if (File.Exists(p)) return p;
        }
        throw new FileNotFoundException("ARCH-4 golden file not found: " + name);
    }

    private static long FrozenNow => Root.GetProperty("frozenNowMs").GetInt64();

    public static IEnumerable<object[]> FixtureIds()
    {
        foreach (var row in Root.GetProperty("fixtures").EnumerateArray())
            yield return new object[] { row.GetProperty("id").GetString()! };
    }

    [Theory]
    [MemberData(nameof(FixtureIds))]
    public void HtmlGolden_MatchesCore_ForEveryFixture(string id)
    {
        var row = FindFixture(id);
        var input = ParseInput(row);
        var html = row.GetProperty("html");
        var before = input is null ? "null" : BackupJsJson.Stringify(input);

        var core = BackupDryRunService.Run(input, FrozenNow);

        var after = input is null ? "null" : BackupJsJson.Stringify(input);
        Assert.True(before == after, id + " T9-style input mutated");

        Assert.Equal(html.GetProperty("ok").GetBoolean(), core.Ok);
        Assert.False(core.Applied);
        Assert.Equal(html.GetProperty("status").GetString(), core.StatusName);
        Assert.Equal(html.GetProperty("sourceSchema").GetInt32(), core.SourceSchema);
        Assert.Equal(html.GetProperty("targetSchema").GetInt32(), core.TargetSchema);
        Assert.Equal(html.GetProperty("migrationRequired").GetBoolean(), core.MigrationRequired);
        Assert.Equal(html.GetProperty("migrationPerformed").GetBoolean(), core.MigrationPerformed);
        Assert.Equal(html.GetProperty("migrationStatus").GetString(), core.MigrationStatus.ToString());
        Assert.Equal(html.GetProperty("integrityStatus").GetString(), core.IntegrityStatus.ToString());
        Assert.Equal(html.GetProperty("digestCompared").GetBoolean(), core.DigestCompared);
        Assert.Equal(html.GetProperty("digestMatched").GetBoolean(), core.DigestMatched);
        Assert.Equal(StrList(html, "errors"), core.Errors.ToList());
        Assert.Equal(StrList(html, "warnings"), core.Warnings.ToList());
        Assert.Equal(StrList(html, "log"), core.Log.ToList());

        var htmlCanon = html.TryGetProperty("dataCanonical", out var dc) && dc.ValueKind == JsonValueKind.String
            ? dc.GetString()
            : null;
        var coreCanon = core.Data is null ? null : BackupJsJson.Stringify(core.Data);
        Assert.True(htmlCanon == coreCanon, id + " data\nHTML=" + htmlCanon + "\nCore=" + coreCanon);

        var htmlHasSales = html.GetProperty("hasSales").GetBoolean();
        Assert.Equal(htmlHasSales, HasOwn(core.Data, "sales") || (!core.MigrationPerformed && HasOwn(input, "sales")));
    }

    [Fact]
    public void T3_Schema0MissingSales_MigratesOnlyAfterValidationPass()
    {
        var row = FindFixture("T3-schema0-missing-sales-parts-accounts");
        var input = ParseInput(row)!;
        Assert.False(HasOwn(input, "sales"));
        Assert.True(BackupRequiredCollections.Validate(input).Ok);
        var r = BackupDryRunService.Run(input, FrozenNow);
        Assert.True(r.Ok);
        Assert.True(r.MigrationPerformed);
        Assert.True(HasOwn(r.Data, "sales"));
        Assert.False(HasOwn(input, "sales"));
    }

    [Fact]
    public void T4_Schema1MissingSales_DoesNotReachSuccessfulMigration()
    {
        var r = RunNamed("T4-schema1-missing-sales");
        Assert.False(r.Ok);
        Assert.False(r.MigrationPerformed);
        Assert.Equal(BackupMigrationRunStatus.NotAttempted, r.MigrationStatus);
        Assert.Null(r.Data);
        Assert.Contains("sales", r.Validation.MissingRequiredCollections);
    }

    [Fact]
    public void T13_InvalidChecksum_IsFailClosed_NoMigrate()
    {
        var r = RunNamed("T13-invalid-checksum");
        Assert.False(r.Ok);
        Assert.Equal(BackupIntegrityStatus.INVALID, r.IntegrityStatus);
        Assert.False(r.MigrationPerformed);
        Assert.Contains(r.Errors, e => e.Contains("checksum", StringComparison.Ordinal));
    }

    [Fact]
    public void T14_AbsentChecksum_IsNotVerifiable_ButCompatible()
    {
        var r = RunNamed("T14-checksum-absent");
        Assert.True(r.Ok);
        Assert.Equal(BackupIntegrityStatus.NOT_VERIFIABLE, r.IntegrityStatus);
        Assert.True(r.Validation.ChecksumSkipped || r.Integrity.ChecksumSkipped);
        Assert.True(r.MigrationPerformed);
    }

    [Fact]
    public void T11_Warnings_StillMigrate()
    {
        var r = RunNamed("T11-duplicate-identity-warning");
        Assert.True(r.Ok);
        Assert.Equal(BackupValidationStatus.VALID_WITH_WARNINGS, r.Status);
        Assert.True(r.MigrationPerformed);
        Assert.NotEmpty(r.Warnings);
    }

    [Fact]
    public void Immutability_And_NoSharedMutableState()
    {
        var row = FindFixture("T1-schema1-current-valid");
        var input = ParseInput(row)!;
        var before = BackupJsJson.Stringify(input);
        var r = BackupDryRunService.Run(input, FrozenNow);
        Assert.Equal(before, BackupJsJson.Stringify(input));
        Assert.NotNull(r.Data);
        Assert.False(ReferenceEquals(input, r.Data));
        if (r.Data is JsonObject migrated && input is JsonObject orig)
        {
            migrated["probe"] = "dry-run-must-not-leak";
            Assert.False(orig.ContainsKey("probe"));
        }
        Assert.Equal(before, BackupJsJson.Stringify(input));
    }

    [Fact]
    public void JsonBackupRepository_RemainsTbdStub()
    {
        var repo = new JsonBackupRepository(new Sirman.Core.Data.CurrentJsonStore());
        Assert.Equal("html-backup-engine", JsonBackupRepository.TbdMarker);
    }

    [Fact]
    public void DryRun_DoesNotReferenceUiOrBrowserTypes()
    {
        var t = typeof(BackupDryRunService);
        Assert.Equal("Sirman.Core.Backup", t.Namespace);
        foreach (var m in t.GetMethods())
        {
            foreach (var p in m.GetParameters())
            {
                var n = p.ParameterType.FullName ?? "";
                Assert.DoesNotContain("System.Windows", n);
                Assert.DoesNotContain("WebView2", n);
                Assert.DoesNotContain("WinForms", n);
            }
        }
    }

    [Fact]
    public void ComposesExistingEngines_NoSecondCopy()
    {
        var src = File.ReadAllText(
            Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", "Sirman.Core", "Backup", "BackupDryRunService.cs")));
        Assert.Contains("BackupValidator.Validate", src);
        Assert.Contains("BackupMigrator.MigratePackage", src);
        Assert.Contains("BackupCanonicalChecksum", src);
        Assert.DoesNotContain("SCHEMA_MIGRATIONS", src);
        Assert.DoesNotContain("REQUIRED_BACKUP_COLLECTIONS", src);
    }

    private static BackupDryRunResult RunNamed(string id)
    {
        var row = FindFixture(id);
        return BackupDryRunService.Run(ParseInput(row), FrozenNow);
    }

    private static bool HasOwn(JsonNode? n, string key) =>
        n is JsonObject o && o.ContainsKey(key);

    private static JsonElement FindFixture(string id)
    {
        foreach (var row in Root.GetProperty("fixtures").EnumerateArray())
        {
            if (row.GetProperty("id").GetString() == id) return row;
        }
        throw new InvalidOperationException("fixture not found: " + id);
    }

    private static JsonNode? ParseInput(JsonElement row)
    {
        if (!row.TryGetProperty("input", out var inp) || inp.ValueKind == JsonValueKind.Undefined)
            return null;
        if (inp.ValueKind == JsonValueKind.Null) return null;
        return JsonNode.Parse(inp.GetRawText());
    }

    private static List<string> StrList(JsonElement obj, string name)
    {
        var list = new List<string>();
        if (!obj.TryGetProperty(name, out var arr) || arr.ValueKind != JsonValueKind.Array)
            return list;
        foreach (var x in arr.EnumerateArray())
            list.Add(x.GetString() ?? "");
        return list;
    }
}
