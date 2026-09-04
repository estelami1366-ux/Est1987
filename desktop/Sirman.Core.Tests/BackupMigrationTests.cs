using System.Text.Json;
using System.Text.Json.Nodes;
using Sirman.Core.Backup;
using Sirman.Core.Data.Repositories;
using Xunit;

namespace Sirman.Core.Tests;

/// <summary>
/// ARCH-3 — HTML golden fixtures vs Sirman.Core.Backup migration. HTML is the baseline.
/// If a fixture differs, stop; do not change HTML to make Core pass.
/// </summary>
public class BackupMigrationTests
{
    private static readonly JsonElement Root = LoadRoot();

    private static JsonElement LoadRoot()
    {
        var path = FindGoldenPath();
        return JsonDocument.Parse(File.ReadAllText(path)).RootElement;
    }

    private static string FindGoldenPath()
    {
        const string name = "BackupMigrationGolden.json";
        var candidates = new[]
        {
            Path.Combine(AppContext.BaseDirectory, name),
            Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "..", "..", "..", name))
        };
        foreach (var p in candidates)
        {
            if (File.Exists(p)) return p;
        }
        throw new FileNotFoundException("ARCH-3 golden file not found: " + name);
    }

    public static IEnumerable<object[]> FixtureIds()
    {
        foreach (var row in Root.GetProperty("fixtures").EnumerateArray())
            yield return new object[] { row.GetProperty("id").GetString()! };
    }

    private static long FrozenNow => Root.GetProperty("frozenNowMs").GetInt64();

    [Theory]
    [MemberData(nameof(FixtureIds))]
    public void HtmlGolden_MatchesCore_ForEveryFixture(string id)
    {
        var row = FindFixture(id);
        var input = ParseInput(row);
        var stage = row.GetProperty("stage").GetString()!;
        var html = row.GetProperty("html");
        var htmlThrew = html.TryGetProperty("threw", out var th) && th.GetBoolean();

        var before = input is null ? "null" : BackupJsJson.Stringify(input);
        var core = RunStage(stage, input);
        var after = input is null ? "null" : BackupJsJson.Stringify(input);
        Assert.True(before == after, id + " T9 input mutated by Core");

        Assert.Equal(htmlThrew, core.Threw);
        if (htmlThrew)
        {
            Assert.False(core.Ok);
            return;
        }

        if (html.TryGetProperty("ok", out var okEl))
            Assert.True(okEl.GetBoolean() == core.Ok, id + " ok html=" + okEl.GetBoolean() + " core=" + core.Ok);
        if (html.TryGetProperty("tooNew", out var tn) && tn.ValueKind is JsonValueKind.True or JsonValueKind.False)
            Assert.Equal(tn.GetBoolean(), core.TooNew);
        if (html.TryGetProperty("from", out var fromEl) && fromEl.ValueKind == JsonValueKind.Number)
            Assert.Equal(fromEl.GetInt32(), core.From);
        if (html.TryGetProperty("to", out var toEl) && toEl.ValueKind == JsonValueKind.Number)
            Assert.Equal(toEl.GetInt32(), core.To);
        if (html.TryGetProperty("reason", out var reasonEl) && reasonEl.ValueKind == JsonValueKind.String)
            Assert.Equal(reasonEl.GetString() ?? "", core.Reason);

        var htmlLog = StrList(html, "log");
        Assert.True(htmlLog.SequenceEqual(core.Log),
            id + " log\nHTML=" + JsonSerializer.Serialize(htmlLog) + "\nCore=" + JsonSerializer.Serialize(core.Log));

        var htmlCanon = html.TryGetProperty("dataCanonical", out var dc) && dc.ValueKind == JsonValueKind.String
            ? dc.GetString()
            : null;
        var coreCanon = core.Data is null ? null : BackupJsJson.Stringify(core.Data);
        Assert.True(htmlCanon == coreCanon, id + " data\nHTML=" + htmlCanon + "\nCore=" + coreCanon);

        if (stage.EndsWith("-twice", StringComparison.Ordinal) &&
            html.TryGetProperty("idempotentData", out var idemp) &&
            idemp.ValueKind is JsonValueKind.True or JsonValueKind.False)
        {
            var second = RunStage(stage, core.Data);
            Assert.Equal(idemp.GetBoolean(), !second.Threw && coreCanon == BackupJsJson.Stringify(second.Data));
        }
    }

    [Fact]
    public void T3_Schema1MissingSales_IsNotRepairedByFieldOrPackage()
    {
        var field = RunNamed("field-schema1-missing-sales");
        Assert.False(field.Threw);
        Assert.False(HasOwn(field.Data, "sales"));
        var pkg = RunNamed("package-schema1-missing-sales-no-repair");
        Assert.False(HasOwn(pkg.Data, "sales"));
        var schema = RunNamed("schema-1-missing-sales-schema-only");
        Assert.False(HasOwn(schema.Data, "sales"));
        var val = BackupRequiredCollections.Validate(ParseInput(FindFixture("field-schema1-missing-sales")));
        Assert.False(val.Ok);
        Assert.Contains("sales", val.MissingRequiredCollections);
    }

    [Fact]
    public void T2_Schema0MissingSales_IsFilledByZeroToOneAndByField()
    {
        var schema = RunNamed("schema-0-missing-sales-parts-accounts");
        Assert.True(HasOwn(schema.Data, "sales"));
        Assert.True(schema.Data!["sales"] is JsonArray { Count: 0 });
        var field = RunNamed("field-schema0-missing-sales-fills");
        Assert.True(field.Data!["sales"] is JsonArray { Count: 0 });
        var pkg = RunNamed("package-schema0-legacy");
        Assert.True(pkg.Data!["sales"] is JsonArray { Count: 0 });
        Assert.True(pkg.Data!["accounts"] is JsonArray { Count: 0 });
    }

    [Fact]
    public void T8_Idempotence_IsMeasuredNotAssumed()
    {
        foreach (var id in new[] { "schema-twice-from-0", "schema-twice-already-1", "field-twice-already-current", "field-twice-missing-ids", "package-twice-schema1-full", "package-twice-schema0" })
        {
            var row = FindFixture(id);
            var html = row.GetProperty("html");
            Assert.True(html.GetProperty("idempotentData").GetBoolean(), id + " HTML data should be idempotent with frozen Date.now");
            var first = RunStage(row.GetProperty("stage").GetString()!, ParseInput(row));
            var second = RunStage(row.GetProperty("stage").GetString()!, first.Data);
            Assert.Equal(BackupJsJson.Stringify(first.Data), BackupJsJson.Stringify(second.Data));
            Assert.Equal(html.GetProperty("idempotentLog").GetBoolean(), first.Log.SequenceEqual(second.Log));
        }
    }

    [Fact]
    public void T9_InputImmutability_AllFixtures()
    {
        foreach (var row in Root.GetProperty("fixtures").EnumerateArray())
        {
            var id = row.GetProperty("id").GetString()!;
            var input = ParseInput(row);
            var before = input is null ? "null" : BackupJsJson.Stringify(input);
            _ = RunStage(row.GetProperty("stage").GetString()!, input);
            var after = input is null ? "null" : BackupJsJson.Stringify(input);
            Assert.True(before == after, id + " mutated");
        }
    }

    [Fact]
    public void T10_DeterministicOutput_SameNowMs()
    {
        var row = FindFixture("field-missing-ids-frozen-now");
        var a = BackupMigrator.MigrateBackup(ParseInput(row), FrozenNow);
        var b = BackupMigrator.MigrateBackup(ParseInput(row), FrozenNow);
        Assert.Equal(BackupJsJson.Stringify(a.Data), BackupJsJson.Stringify(b.Data));
        Assert.Equal(string.Join('\n', a.Log), string.Join('\n', b.Log));
        Assert.Contains("mig_inv_0_1700000000000", BackupJsJson.Stringify(a.Data));
    }

    [Fact]
    public void T13_ValidatorThenMigration_PreservesFailClosed()
    {
        var missing = ParseInput(FindFixture("package-schema1-missing-sales-no-repair"));
        Assert.False(BackupRequiredCollections.Validate(missing).Ok);
        var migrated = BackupMigrator.MigratePackage(missing, FrozenNow);
        Assert.False(BackupRequiredCollections.Validate(migrated.Data).Ok);

        var legacy = ParseInput(FindFixture("package-schema0-legacy"));
        Assert.True(BackupRequiredCollections.Validate(legacy).Ok);
        var legacyOut = BackupMigrator.MigratePackage(legacy, FrozenNow);
        Assert.True(BackupRequiredCollections.Validate(legacyOut.Data).Ok);
        Assert.True(legacyOut.Data!["sales"] is JsonArray);
    }

    [Fact]
    public void T5_NullHandling_MatchesHtml()
    {
        Assert.True(RunNamed("schema-0-null-sales").Data!["sales"] is JsonArray);
        Assert.True(RunNamed("schema-1-null-parts-schema-only").Data!["parts"] is null
                    || RunNamed("schema-1-null-parts-schema-only").Data!["parts"]!.GetValueKind() == JsonValueKind.Null);
        var fieldNull = RunNamed("field-schema1-null-sales");
        Assert.True(fieldNull.Data!["sales"] is null || fieldNull.Data!["sales"]!.GetValueKind() == JsonValueKind.Null);
        Assert.True(RunNamed("field-tasks-null").Data!["tasks"] is JsonArray { Count: 0 });
    }

    [Fact]
    public void JsonBackupRepository_RemainsTbdStub()
    {
        var repo = new JsonBackupRepository(new Sirman.Core.Data.CurrentJsonStore());
        Assert.Equal("html-backup-engine", JsonBackupRepository.TbdMarker);
    }

    [Fact]
    public void BackupMigrator_DoesNotReferenceUiOrBrowserTypes()
    {
        var t = typeof(BackupMigrator);
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
    public void TasksAlwaysFilled_WarrantiesInvoicesNeverFilled()
    {
        var t = RunNamed("field-tasks-missing");
        Assert.True(t.Data!["tasks"] is JsonArray);
        var w = RunNamed("field-warranties-missing");
        Assert.False(HasOwn(w.Data, "warranties"));
        var inv = RunNamed("field-invoices-missing");
        Assert.False(HasOwn(inv.Data, "invoices"));
    }

    private static SchemaMigrationResult RunNamed(string id)
    {
        var row = FindFixture(id);
        return RunStage(row.GetProperty("stage").GetString()!, ParseInput(row));
    }

    private static SchemaMigrationResult RunStage(string stage, JsonNode? input)
    {
        var baseStage = stage.EndsWith("-twice", StringComparison.Ordinal) ? stage[..^6] : stage;
        return baseStage switch
        {
            "schema" => BackupMigrator.ApplySchemaMigrations(input),
            "field" => BackupMigrator.MigrateBackup(input, FrozenNow),
            _ => BackupMigrator.MigratePackage(input, FrozenNow)
        };
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
