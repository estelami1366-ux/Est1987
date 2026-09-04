using System.Text.Json;
using System.Text.Json.Nodes;
using Sirman.Core.Backup;
using Sirman.Core.Data.Repositories;
using Sirman.Core.Security;
using Xunit;

namespace Sirman.Core.Tests;

/// <summary>
/// ARCH-6 — Host contract BackupFinalizeBridge vs ARCH-5 HTML golden.
/// Does not write disk. Does not change Restore.
/// </summary>
public class BackupFinalizeBridgeTests
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
            if (File.Exists(p)) return p;
        throw new FileNotFoundException("ARCH-5 golden file not found: " + name);
    }

    public static IEnumerable<object[]> RuntimeCases()
    {
        foreach (var id in new[]
                 {
                     "T1-valid-ordinary", "T2-empty-collections", "T3-persian-text", "T4-nested-object",
                     "T12-attachmentsIndex", "T13-itemCounts", "T9-sha256", "T8-checksumAlgo-none",
                     "T6-exportedAt-variation", "T11-sectionChecksums"
                 })
            yield return new object[] { id };
    }

    [Theory]
    [MemberData(nameof(RuntimeCases))]
    public void T1_to_T10_BridgeMatchesHtmlGolden(string id)
    {
        var row = FindFixture(id);
        var html = row.GetProperty("html");
        var input = ParseInput(row);
        var before = input is null ? "null" : BackupJsJson.Stringify(input);

        var raw = BackupFinalizeBridge.Execute(RequestJson(row));
        using var doc = JsonDocument.Parse(raw);
        var root = doc.RootElement;

        var after = input is null ? "null" : BackupJsJson.Stringify(input);
        Assert.True(before == after, id + " input mutated");

        Assert.True(root.GetProperty("ok").GetBoolean(), id + " " + raw);
        Assert.False(root.GetProperty("wrote").GetBoolean());
        Assert.Equal("core", root.GetProperty("engine").GetString());
        Assert.Equal(html.GetProperty("canonicalString").GetString(), root.GetProperty("canonicalString").GetString());
        Assert.Equal(html.GetProperty("sha256Hex").GetString(), root.GetProperty("sha256Hex").GetString());
        Assert.Equal(html.GetProperty("checksum").GetString(), root.GetProperty("checksum").GetString());
        Assert.Equal(html.GetProperty("checksumAlgo").GetString(), root.GetProperty("checksumAlgo").GetString());
        Assert.Equal(html.GetProperty("compactJson").GetString(), BackupJsJson.Stringify(JsonNode.Parse(root.GetProperty("data").GetRawText())));
    }

    [Fact]
    public void T6_ExportedAtMutate_SameCanonical()
    {
        var row = FindFixture("T6-exportedAt-variation");
        using var doc = JsonDocument.Parse(BackupFinalizeBridge.Execute(RequestJson(row)));
        var sha = doc.RootElement.GetProperty("sha256Hex").GetString();
        Assert.Equal(row.GetProperty("html").GetProperty("sha256AfterMutateExportedAt").GetString(), sha);
    }

    [Fact]
    public void T8_None_DoesNotStoreSha256()
    {
        using var doc = JsonDocument.Parse(BackupFinalizeBridge.Execute(RequestJson(FindFixture("T8-checksumAlgo-none"))));
        Assert.Equal("none", doc.RootElement.GetProperty("checksumAlgo").GetString());
        Assert.Equal("", doc.RootElement.GetProperty("checksum").GetString());
        Assert.Equal(64, doc.RootElement.GetProperty("sha256Hex").GetString()!.Length);
    }

    [Fact]
    public void InvalidJson_FailsClosed_NoData()
    {
        using var doc = JsonDocument.Parse(BackupFinalizeBridge.Execute("not-json"));
        Assert.False(doc.RootElement.GetProperty("ok").GetBoolean());
        Assert.False(doc.RootElement.TryGetProperty("data", out _));
    }

    [Fact]
    public void MissingDataField_FailsClosed()
    {
        using var doc = JsonDocument.Parse(BackupFinalizeBridge.Execute("{\"origin\":\"manual\"}"));
        Assert.False(doc.RootElement.GetProperty("ok").GetBoolean());
        Assert.Equal("invalid-input", doc.RootElement.GetProperty("error").GetString());
    }

    [Fact]
    public void LiveStateKeys_Rejected()
    {
        using var doc = JsonDocument.Parse(BackupFinalizeBridge.Execute("{\"data\":{},\"localStorage\":true}"));
        Assert.False(doc.RootElement.GetProperty("ok").GetBoolean());
        Assert.Equal("invalid-input", doc.RootElement.GetProperty("error").GetString());
    }

    [Fact]
    public void Bridge_DoesNotWriteDisk_OrUseBrowserTypes()
    {
        var src = File.ReadAllText(BridgeSourcePath());
        Assert.DoesNotContain("File.Write", src);
        Assert.DoesNotContain("WriteAllText", src);
        Assert.Contains("BackupFinalizer.Finalize", src);
        Assert.Contains("wrote", src);
    }

    [Fact]
    public void Host_FinalizeBackup_IsThinAndDoesNotWrite()
    {
        var host = File.ReadAllText(HostSourcePath());
        Assert.Contains("public string FinalizeBackup(string json)", host);
        Assert.Contains("BackupFinalizeBridge.Execute", host);
        var method = Slice(host, "public string FinalizeBackup", "public string TestRestoreBackup");
        Assert.DoesNotContain("File.WriteAllText", method);
        Assert.DoesNotContain("WriteBackupText", method);
        Assert.Contains("public string WriteBackupText", host);
    }

    [Fact]
    public void JsonBackupRepository_RemainsTbdStub()
    {
        Assert.Equal("html-backup-engine", JsonBackupRepository.TbdMarker);
    }

    [Fact]
    public void Arch2_3_4_5_Regression_StillPassThroughExistingEngines()
    {
        var schema0 = JsonNode.Parse("{\"warranties\":[],\"invoices\":[]}")!;
        Assert.True(BackupValidator.Validate(schema0).Ok);
        Assert.True(BackupMigrator.MigratePackage(schema0, 1700000000000).Ok);
        var dry = BackupDryRunService.Run(schema0, 1700000000000);
        Assert.True(dry.Ok);
        Assert.False(dry.Applied);
        var fin = BackupFinalizer.FinalizePackage(schema0, "manual", "full");
        Assert.True(fin.Ok);
    }

    [Fact]
    public void FinalizeBackup_IsAlwaysAllowedHostMethod()
    {
        Assert.Contains("FinalizeBackup", PermissionCatalog.AlwaysAllowedHostMethods);
        var gate = new HostSecurityGate();
        Assert.True(gate.Authorize(AuthSession.Unauthenticated(true), "FinalizeBackup").Ok);
    }

    private static string RequestJson(JsonElement row)
    {
        var origin = row.GetProperty("origin").ValueKind == JsonValueKind.String ? row.GetProperty("origin").GetString() : "manual";
        var kind = row.GetProperty("kind").ValueKind == JsonValueKind.String ? row.GetProperty("kind").GetString() : "full";
        var mode = row.GetProperty("checksumMode").GetString() ?? "leave";
        var data = ParseInput(row);
        var dataJson = data is null ? "null" : BackupJsJson.Stringify(data);
        var stamp = row.GetProperty("stampExportedAt").GetBoolean() ? "true" : "false";
        var now = row.TryGetProperty("nowMs", out var n) && n.ValueKind == JsonValueKind.Number ? n.GetRawText() : "null";
        return "{\"data\":" + dataJson
            + ",\"origin\":" + JsonSerializer.Serialize(origin)
            + ",\"kind\":" + JsonSerializer.Serialize(kind)
            + ",\"checksumMode\":" + JsonSerializer.Serialize(mode)
            + ",\"stampExportedAt\":" + stamp
            + ",\"nowMs\":" + now
            + "}";
    }

    private static JsonElement FindFixture(string id)
    {
        foreach (var row in Root.GetProperty("fixtures").EnumerateArray())
            if (row.GetProperty("id").GetString() == id) return row;
        throw new InvalidOperationException("fixture not found: " + id);
    }

    private static JsonNode? ParseInput(JsonElement row)
    {
        if (!row.TryGetProperty("input", out var inp) || inp.ValueKind is JsonValueKind.Undefined or JsonValueKind.Null)
            return null;
        return JsonNode.Parse(inp.GetRawText());
    }

    private static string BridgeSourcePath() =>
        Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", "Sirman.Core", "Backup", "BackupFinalizeBridge.cs"));

    private static string HostSourcePath() =>
        Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", "Sirman.Desktop", "SirmanHostObject.cs"));

    private static string Slice(string src, string start, string end)
    {
        var i = src.IndexOf(start, StringComparison.Ordinal);
        var j = src.IndexOf(end, StringComparison.Ordinal);
        Assert.True(i >= 0 && j > i, "could not slice Host FinalizeBackup");
        return src.Substring(i, j - i);
    }
}
