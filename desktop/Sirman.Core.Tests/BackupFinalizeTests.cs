using System.Text.Json;
using System.Text.Json.Nodes;
using Sirman.Core.Backup;
using Sirman.Core.Data.Repositories;
using Xunit;

namespace Sirman.Core.Tests;

/// <summary>
/// ARCH-5 — HTML finalize/serialize golden vs BackupFinalizer.
/// If a fixture differs, stop; do not change HTML to make Core pass.
/// </summary>
public class BackupFinalizeTests
{
    private static readonly JsonElement Root = LoadRoot();

    private static JsonElement LoadRoot()
    {
        var path = FindGoldenPath();
        return JsonDocument.Parse(File.ReadAllText(path)).RootElement;
    }

    private static string FindGoldenPath()
    {
        const string name = "BackupFinalizeGolden.json";
        var candidates = new[]
        {
            Path.Combine(AppContext.BaseDirectory, name),
            Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "..", "..", "..", name))
        };
        foreach (var p in candidates)
        {
            if (File.Exists(p)) return p;
        }
        throw new FileNotFoundException("ARCH-5 golden file not found: " + name);
    }

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
        var html = row.GetProperty("html");
        var input = ParseInput(row);
        var before = input is null ? "null" : BackupJsJson.Stringify(input);

        var core = RunRow(row);

        var after = input is null ? "null" : BackupJsJson.Stringify(input);
        Assert.True(before == after, id + " T15-style input mutated");

        Assert.Equal(html.GetProperty("threw").GetBoolean(), core.Threw);
        if (html.GetProperty("threw").GetBoolean())
        {
            Assert.False(core.Ok);
            return;
        }

        Assert.True(core.Ok, id + " should succeed");
        Assert.False(core.Threw);
        Assert.Equal(html.GetProperty("canonicalString").GetString(), core.CanonicalString);
        Assert.Equal(html.GetProperty("sha256Hex").GetString(), core.Sha256Hex);
        Assert.Equal(html.GetProperty("checksum").GetString(), core.Checksum);
        Assert.Equal(html.GetProperty("checksumAlgo").GetString(), core.ChecksumAlgo);
        Assert.Equal(html.GetProperty("exportedAt").GetString(), core.ExportedAt);
        Assert.Equal(html.GetProperty("magic").GetString(), core.Data is JsonObject o ? BackupJsonUtil.Str(o["magic"]) : "");
        Assert.Equal(html.GetProperty("applicationVersion").GetString(), core.Data is JsonObject o2 ? BackupJsonUtil.Str(o2["applicationVersion"]) : "");

        var htmlCompact = html.GetProperty("compactJson").GetString();
        var coreCompact = core.Data is null ? null : BackupJsJson.Stringify(core.Data);
        Assert.True(htmlCompact == coreCompact, id + " compactJson\nHTML=" + htmlCompact + "\nCore=" + coreCompact);

        Assert.Equal(
            JsonNode.Parse(html.GetProperty("sectionChecksums").GetRawText()) is { } hsc ? BackupJsJson.Stringify(hsc) : "null",
            core.SectionChecksums is null ? "null" : BackupJsJson.Stringify(core.SectionChecksums));
        Assert.Equal(
            JsonNode.Parse(html.GetProperty("attachmentsIndex").GetRawText()) is { } hai ? BackupJsJson.Stringify(hai) : "null",
            core.AttachmentsIndex is null ? "null" : BackupJsJson.Stringify(core.AttachmentsIndex));
        Assert.Equal(
            JsonNode.Parse(html.GetProperty("manifest").GetRawText()) is { } hm ? BackupJsJson.Stringify(hm) : "null",
            core.Manifest is null ? "null" : BackupJsJson.Stringify(core.Manifest));

        Assert.Contains("exportedAt", core.CanonicalExclusions);
        Assert.Contains("checksum", core.CanonicalExclusions);
        Assert.Contains("checksumAlgo", core.CanonicalExclusions);
        Assert.DoesNotContain("\"exportedAt\":", StripManifestExportedAt(core.CanonicalString));
        Assert.True(html.GetProperty("prettyPrintIsNotHashed").GetBoolean());
        Assert.NotEqual(htmlCompact, core.CanonicalString);
    }

    [Fact]
    public void T6_TopLevelExportedAtMutate_DoesNotChangeSha256()
    {
        var row = FindFixture("T6-exportedAt-variation");
        var html = row.GetProperty("html");
        var core = RunRow(row);
        Assert.Equal(html.GetProperty("sha256Hex").GetString(), core.Sha256Hex);
        Assert.Equal(html.GetProperty("sha256AfterMutateExportedAt").GetString(), core.Sha256Hex);

        Assert.NotNull(core.Data);
        var mutated = BackupJsonUtil.CloneExact(core.Data)!;
        if (mutated is JsonObject obj)
            obj["exportedAt"] = "2099-12-31T00:00:00.000Z";
        Assert.Equal(core.Sha256Hex, BackupCanonicalChecksum.Sha256Hex(mutated));
        Assert.Equal(core.CanonicalString, BackupCanonicalChecksum.CanonicalString(mutated));
    }

    [Fact]
    public void T6_RefinalizeWithDifferentExportedAt_ChangesHashBecauseManifestIsHashed()
    {
        var input = ParseInput(FindFixture("T6-exportedAt-variation"))!;
        var a = BackupFinalizer.Finalize(new BackupFinalizeRequest
        {
            Data = input,
            Origin = "manual",
            Kind = "full",
            ChecksumMode = BackupChecksumMode.Sha256
        });
        var bInput = BackupJsonUtil.CloneExact(input)!;
        ((JsonObject)bInput)["exportedAt"] = "2099-12-31T00:00:00.000Z";
        var b = BackupFinalizer.Finalize(new BackupFinalizeRequest
        {
            Data = bInput,
            Origin = "manual",
            Kind = "full",
            ChecksumMode = BackupChecksumMode.Sha256
        });
        Assert.NotEqual(a.Sha256Hex, b.Sha256Hex);
        Assert.Contains("2099-12-31", b.CanonicalString);
    }

    [Fact]
    public void T7_LeaveUnchanged_PreservesExistingChecksum()
    {
        var input = ParseInput(FindFixture("T7-existing-checksum"))!;
        var left = BackupFinalizer.FinalizePackage(input, "manual", "full");
        Assert.Equal("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", left.Checksum);
        Assert.Equal("SHA-256", left.ChecksumAlgo);
        var attached = BackupFinalizer.AttachChecksum(left.Data, BackupChecksumMode.Sha256);
        Assert.NotEqual(left.Checksum, attached.Checksum);
        Assert.Equal(attached.Sha256Hex, attached.Checksum);
        Assert.Equal("SHA-256", attached.ChecksumAlgo);
        Assert.Equal(BackupJsJson.Stringify(input), BackupJsJson.Stringify(ParseInput(FindFixture("T7-existing-checksum"))!));
    }

    [Fact]
    public void T8_None_DoesNotStoreSha256()
    {
        var r = RunNamed("T8-checksumAlgo-none");
        Assert.Equal("", r.Checksum);
        Assert.Equal("none", r.ChecksumAlgo);
        Assert.Equal(64, r.Sha256Hex.Length);
        Assert.Equal(FindFixture("T8-checksumAlgo-none").GetProperty("html").GetProperty("sha256Hex").GetString(), r.Sha256Hex);
    }

    [Fact]
    public void T9_StoredChecksumEqualsCanonicalSha256()
    {
        var r = RunNamed("T9-sha256");
        Assert.Equal("SHA-256", r.ChecksumAlgo);
        Assert.Equal(r.Sha256Hex, r.Checksum);
        Assert.Matches("^[0-9a-f]{64}$", r.Checksum);
        Assert.DoesNotContain("\n", r.CanonicalString);
    }

    [Fact]
    public void T10_UnknownAlgorithm_PreservedWhenLeaveUnchanged()
    {
        var r = RunNamed("T10-unknown-algorithm");
        Assert.Equal("deadbeef", r.Checksum);
        Assert.Equal("MD5", r.ChecksumAlgo);
        Assert.Equal(FindFixture("T10-unknown-algorithm").GetProperty("html").GetProperty("sha256Hex").GetString(), r.Sha256Hex);
    }

    [Fact]
    public void T11_SectionChecksumsAlwaysRebuilt()
    {
        var input = ParseInput(FindFixture("T11-sectionChecksums"))!;
        Assert.Equal("dead", BackupJsonUtil.Str(((JsonObject)input)["sectionChecksums"]!["warranties"]));
        var r = RunNamed("T11-sectionChecksums");
        Assert.NotEqual("dead", r.SectionChecksums!["warranties"]!.ToString());
        Assert.Equal(BackupCanonicalChecksum.SectionHash(((JsonObject)r.Data!)["warranties"]), BackupJsonUtil.Str(r.SectionChecksums["warranties"]));
    }

    [Fact]
    public void T12_AttachmentsIndexAlwaysRebuilt()
    {
        var r = RunNamed("T12-attachmentsIndex");
        var json = BackupJsJson.Stringify(r.AttachmentsIndex);
        Assert.DoesNotContain("stale", json);
        Assert.Contains("warranty-w1-1", json);
        Assert.Contains("disk://path/x", json);
        Assert.Contains("idb:abc", json);
    }

    [Fact]
    public void T14_PropertyOrder_IsInsertionOrder()
    {
        var compact = RunNamed("T14-property-ordering").Data is { } d ? BackupJsJson.Stringify(d) : "";
        Assert.StartsWith("{\"zebra\":1,", compact);
        Assert.Contains("\"alpha\":true", compact);
        var idxZebra = compact.IndexOf("\"zebra\"", StringComparison.Ordinal);
        var idxAccounts = compact.IndexOf("\"accounts\"", StringComparison.Ordinal);
        var idxMagic = compact.IndexOf("\"magic\"", StringComparison.Ordinal);
        Assert.True(idxZebra < idxAccounts);
        Assert.True(idxAccounts < idxMagic);
    }

    [Fact]
    public void T15_InputImmutability_CloneNotReference()
    {
        var row = FindFixture("T15-input-immutability");
        var input = ParseInput(row)!;
        var before = BackupJsJson.Stringify(input);
        var r = RunRow(row);
        Assert.Equal(before, BackupJsJson.Stringify(input));
        Assert.False(ReferenceEquals(input, r.Data));
        if (r.Data is JsonObject finalized && input is JsonObject orig)
        {
            finalized["probe"] = "finalizer-must-not-leak";
            Assert.Equal("do-not-mutate-caller", BackupJsonUtil.Str(orig["probe"]));
        }
        Assert.Equal(before, BackupJsJson.Stringify(input));
    }

    [Fact]
    public void T16_InjectedNowMs_IsDeterministic_NoDateNow()
    {
        var row = FindFixture("T16-injected-nowMs");
        var a = RunRow(row);
        var b = RunRow(row);
        Assert.Equal(a.CanonicalString, b.CanonicalString);
        Assert.Equal(a.Sha256Hex, b.Sha256Hex);
        Assert.Equal(Root.GetProperty("frozenNowIso").GetString(), a.ExportedAt);
        Assert.Equal(BackupFinalizer.IsoFromUnixMs(Root.GetProperty("frozenNowMs").GetInt64()), a.ExportedAt);

        var src = File.ReadAllText(FinalizerSourcePath());
        Assert.DoesNotContain("DateTime.Now", src);
        Assert.DoesNotContain("DateTimeOffset.UtcNow", src);
    }

    [Fact]
    public void T17_RepeatedIdenticalFinalize_IsStable()
    {
        var row = FindFixture("T17-repeated-identical");
        var first = RunRow(row);
        var second = RunRow(row);
        Assert.Equal(first.CanonicalString, second.CanonicalString);
        Assert.Equal(first.Sha256Hex, second.Sha256Hex);
        Assert.Equal(BackupJsJson.Stringify(first.Data), BackupJsJson.Stringify(second.Data));

        var again = BackupFinalizer.Finalize(new BackupFinalizeRequest
        {
            Data = first.Data,
            Origin = "manual",
            Kind = "full",
            ChecksumMode = BackupChecksumMode.Sha256
        });
        Assert.Equal(first.Sha256Hex, again.Sha256Hex);
        Assert.Equal(BackupJsJson.Stringify(first.Data), BackupJsJson.Stringify(again.Data));
    }

    [Fact]
    public void T18_UnicodeUtf8_PreservedInCanonicalAndHash()
    {
        var r = RunNamed("T18-unicode-utf8");
        Assert.Contains("سلام", r.CanonicalString);
        Assert.Contains("\u2028", r.CanonicalString);
        Assert.Contains("\u2029", r.CanonicalString);
        Assert.DoesNotContain("\\u2028", r.CanonicalString);
        Assert.DoesNotContain("\\u2029", r.CanonicalString);
        Assert.Equal(FindFixture("T18-unicode-utf8").GetProperty("html").GetProperty("sha256Hex").GetString(), r.Sha256Hex);
    }

    [Fact]
    public void T19_NullBecomesEmptyPackage()
    {
        var r = RunNamed("T19-malformed-null");
        Assert.True(r.Ok);
        Assert.Equal("SIRMAN_BACKUP", r.Data is JsonObject o ? BackupJsonUtil.Str(o["magic"]) : "");
        Assert.Equal("{}", BackupJsJson.Stringify(r.SectionChecksums));
    }

    [Fact]
    public void T19_WarrantiesObject_ThrowsWithoutMutatingCaller()
    {
        var input = JsonNode.Parse("{\"warranties\":{},\"invoices\":[]}")!;
        var before = BackupJsJson.Stringify(input);
        var r = BackupFinalizer.FinalizePackage(input, "manual", "full");
        Assert.False(r.Ok);
        Assert.True(r.Threw);
        Assert.Equal(before, BackupJsJson.Stringify(input));
    }

    [Fact]
    public void T20_Arch2_ValidatorRegression_OnFinalizedT1()
    {
        var finalized = RunNamed("T1-valid-ordinary").Data;
        var v = BackupValidator.Validate(finalized);
        Assert.True(v.Ok, string.Join(" | ", v.Errors));
        Assert.True(BackupPortableIntegrity.Validate(finalized).Ok);
        Assert.True(BackupStructuralValidator.Validate(finalized).Ok);
    }

    [Fact]
    public void T21_Arch3_MigratorRegression()
    {
        var schema0 = JsonNode.Parse("{\"warranties\":[],\"invoices\":[]}")!;
        var r = BackupMigrator.MigratePackage(schema0, 1700000000000);
        Assert.True(r.Ok);
        Assert.False(r.Threw);
        Assert.True(schema0 is JsonObject o && !o.ContainsKey("sales"));
        Assert.True(r.Data is JsonObject d && d.ContainsKey("sales"));
    }

    [Fact]
    public void T22_Arch4_DryRunRegression()
    {
        var schema0 = JsonNode.Parse("{\"warranties\":[],\"invoices\":[]}")!;
        var r = BackupDryRunService.Run(schema0, 1700000000000);
        Assert.True(r.Ok);
        Assert.False(r.Applied);
        Assert.True(r.MigrationPerformed);
        Assert.Equal("html-backup-engine", JsonBackupRepository.TbdMarker);
    }

    [Fact]
    public void JsonBackupRepository_RemainsTbdStub()
    {
        var repo = new JsonBackupRepository(new Sirman.Core.Data.CurrentJsonStore());
        Assert.Equal("html-backup-engine", JsonBackupRepository.TbdMarker);
    }

    [Fact]
    public void Finalizer_DoesNotReferenceUiOrBrowserTypes_AndDoesNotExtractBuildFullBackupData()
    {
        var t = typeof(BackupFinalizer);
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
        var src = File.ReadAllText(FinalizerSourcePath());
        Assert.DoesNotContain("_buildFullBackupData(", src);
        Assert.DoesNotContain("crypto.subtle", src);
        Assert.Contains("BackupSchemaMigrations.CollectAttachmentIndex", src);
        Assert.Contains("BackupSchemaMigrations.BuildBackupManifest", src);
        Assert.Contains("BackupCanonicalChecksum", src);
    }

    [Fact]
    public void PrettyDiskJson_IsNotTheHashedPayload()
    {
        var r = RunNamed("T1-valid-ordinary");
        var pretty = r.Data!.ToJsonString(new JsonSerializerOptions { WriteIndented = true });
        Assert.Contains("\n", pretty);
        Assert.DoesNotContain("\n", r.CanonicalString);
        Assert.NotEqual(pretty, r.CanonicalString);
        Assert.NotEqual(BackupCanonicalChecksum.Sha256Utf8Hex(pretty), r.Sha256Hex);
    }

    private static BackupFinalizeResult RunNamed(string id) => RunRow(FindFixture(id));

    private static BackupFinalizeResult RunRow(JsonElement row)
    {
        var mode = ParseMode(row.GetProperty("checksumMode").GetString());
        long? nowMs = null;
        if (row.TryGetProperty("nowMs", out var n) && n.ValueKind == JsonValueKind.Number)
            nowMs = n.GetInt64();
        var originEl = row.GetProperty("origin");
        var kindEl = row.GetProperty("kind");
        return BackupFinalizer.Finalize(new BackupFinalizeRequest
        {
            Data = ParseInput(row),
            Origin = originEl.ValueKind == JsonValueKind.String ? originEl.GetString() : null,
            Kind = kindEl.ValueKind == JsonValueKind.String ? kindEl.GetString() : null,
            NowMs = nowMs,
            StampExportedAt = row.GetProperty("stampExportedAt").GetBoolean(),
            ChecksumMode = mode
        });
    }

    private static BackupChecksumMode ParseMode(string? mode) =>
        mode switch
        {
            "sha256" => BackupChecksumMode.Sha256,
            "none" => BackupChecksumMode.None,
            _ => BackupChecksumMode.LeaveUnchanged
        };

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

    private static string StripManifestExportedAt(string canonical)
    {
        var idx = canonical.IndexOf("\"manifest\":", StringComparison.Ordinal);
        if (idx < 0) return canonical;
        return canonical.Substring(0, idx);
    }

    private static string FinalizerSourcePath() =>
        Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", "Sirman.Core", "Backup", "BackupFinalizer.cs"));
}
