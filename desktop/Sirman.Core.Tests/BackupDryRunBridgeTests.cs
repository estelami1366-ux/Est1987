using System.Text.Json;
using System.Text.Json.Nodes;
using Sirman.Core.Backup;
using Sirman.Core.Data.Repositories;
using Sirman.Core.Security;
using Xunit;

namespace Sirman.Core.Tests;

/// <summary>
/// ARCH-7 — Host contract BackupDryRunBridge vs ARCH-4 HTML golden.
/// Read-only preview. Applied is always false. Does not restore.
/// </summary>
public class BackupDryRunBridgeTests
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
            if (File.Exists(p)) return p;
        throw new FileNotFoundException("ARCH-4 golden file not found: " + name);
    }

    private static long FrozenNow => Root.GetProperty("frozenNowMs").GetInt64();

    public static IEnumerable<object[]> PacketCases()
    {
        yield return new object[] { "T1", "T1-schema1-current-valid" };
        yield return new object[] { "T2", "T2-schema0-legacy" };
        yield return new object[] { "T3", "T7-missing-warranties" };
        yield return new object[] { "T4", "T8-missing-invoices" };
        yield return new object[] { "T5", "T4-schema1-missing-sales" };
        yield return new object[] { "T6", "T5-schema1-missing-parts" };
        yield return new object[] { "T7", "T6-schema1-missing-accounts" };
        yield return new object[] { "T8", "T9-itemcounts-mismatch" };
        yield return new object[] { "T9", "T10-attachment-broken" };
        yield return new object[] { "T10", "T11-duplicate-identity-warning" };
        yield return new object[] { "T11", "T12-valid-checksum" };
        yield return new object[] { "T12", "T13-invalid-checksum" };
        yield return new object[] { "T13", "T14-checksum-absent" };
        yield return new object[] { "T15", "T18-persian-unicode" };
        yield return new object[] { "T16", "T3-schema0-missing-sales-parts-accounts" };
    }

    [Theory]
    [MemberData(nameof(PacketCases))]
    public void T1_to_T16_BridgeMatchesHtmlGolden(string packetId, string goldenId)
    {
        var row = FindFixture(goldenId);
        var html = row.GetProperty("html");
        var input = ParseInput(row);
        var before = input is null ? "null" : BackupJsJson.Stringify(input);

        var raw = BackupDryRunBridge.Execute(RequestJson(row));
        using var doc = JsonDocument.Parse(raw);
        var root = doc.RootElement;

        var after = input is null ? "null" : BackupJsJson.Stringify(input);
        Assert.True(before == after, packetId + " input mutated");

        Assert.False(root.GetProperty("applied").GetBoolean(), packetId + " applied");
        Assert.False(root.GetProperty("wrote").GetBoolean(), packetId + " wrote");
        Assert.Equal("DRY_RUN_ONLY", root.GetProperty("mode").GetString());
        Assert.Equal("core", root.GetProperty("engine").GetString());
        Assert.Equal(html.GetProperty("ok").GetBoolean(), root.GetProperty("ok").GetBoolean());
        Assert.Equal(html.GetProperty("status").GetString(), root.GetProperty("status").GetString());
        Assert.Equal(html.GetProperty("sourceSchema").GetInt32(), root.GetProperty("sourceSchema").GetInt32());
        Assert.Equal(html.GetProperty("targetSchema").GetInt32(), root.GetProperty("targetSchema").GetInt32());
        Assert.Equal(html.GetProperty("migrationStatus").GetString(), root.GetProperty("migrationStatus").GetString());
        Assert.Equal(html.GetProperty("integrityStatus").GetString(), root.GetProperty("integrityStatus").GetString());
        Assert.Equal(StrList(html, "errors"), StrList(root, "errors"));
        Assert.Equal(StrList(html, "warnings"), StrList(root, "warnings"));

        if (html.GetProperty("status").GetString() == "INVALID")
            Assert.False(root.GetProperty("ok").GetBoolean(), packetId + " INVALID must not be PASS");
    }

    [Fact]
    public void T13b_ChecksumNone_IsNotVerifiable()
    {
        var raw = BackupDryRunBridge.Execute(RequestJson(FindFixture("T14b-checksum-none")));
        using var doc = JsonDocument.Parse(raw);
        Assert.True(doc.RootElement.GetProperty("ok").GetBoolean());
        Assert.Equal("NOT_VERIFIABLE", doc.RootElement.GetProperty("integrityStatus").GetString());
        Assert.False(doc.RootElement.GetProperty("applied").GetBoolean());
    }

    [Fact]
    public void T14_MalformedJson_FailsClosed()
    {
        using var doc = JsonDocument.Parse(BackupDryRunBridge.Execute("{not-json"));
        Assert.False(doc.RootElement.GetProperty("ok").GetBoolean());
        Assert.Equal("invalid-json", doc.RootElement.GetProperty("error").GetString());
        Assert.False(doc.RootElement.TryGetProperty("applied", out var applied) && applied.GetBoolean());
        Assert.False(doc.RootElement.TryGetProperty("status", out var st) && st.GetString() == "VALID");
    }

    [Fact]
    public void T14_MissingData_FailsClosed()
    {
        using var doc = JsonDocument.Parse(BackupDryRunBridge.Execute("{\"nowMs\":1}"));
        Assert.False(doc.RootElement.GetProperty("ok").GetBoolean());
        Assert.Equal("invalid-input", doc.RootElement.GetProperty("error").GetString());
    }

    [Fact]
    public void T17_AppliedAlwaysFalse_OnEveryGolden()
    {
        foreach (var row in Root.GetProperty("fixtures").EnumerateArray())
        {
            var raw = BackupDryRunBridge.Execute(RequestJson(row));
            using var doc = JsonDocument.Parse(raw);
            if (doc.RootElement.TryGetProperty("applied", out var applied))
                Assert.False(applied.GetBoolean(), row.GetProperty("id").GetString() + " applied");
            if (doc.RootElement.TryGetProperty("mode", out var mode))
                Assert.Equal("DRY_RUN_ONLY", mode.GetString());
            Assert.False(doc.RootElement.TryGetProperty("wrote", out var wrote) && wrote.GetBoolean());
        }
    }

    [Fact]
    public void T12_InvalidChecksum_IsNotPass()
    {
        using var doc = JsonDocument.Parse(BackupDryRunBridge.Execute(RequestJson(FindFixture("T13-invalid-checksum"))));
        Assert.False(doc.RootElement.GetProperty("ok").GetBoolean());
        Assert.Equal("INVALID", doc.RootElement.GetProperty("status").GetString());
        Assert.Equal("INVALID", doc.RootElement.GetProperty("integrityStatus").GetString());
        Assert.Equal("NotAttempted", doc.RootElement.GetProperty("migrationStatus").GetString());
        Assert.Equal(JsonValueKind.Null, doc.RootElement.GetProperty("data").ValueKind);
    }

    [Fact]
    public void LiveStateKeys_Rejected()
    {
        foreach (var key in new[] { "localStorage", "indexedDB", "webview", "document", "chrome", "window", "invoices", "phonebook", "warranties" })
        {
            var json = "{\"" + key + "\":true,\"data\":{}}";
            using var doc = JsonDocument.Parse(BackupDryRunBridge.Execute(json));
            Assert.False(doc.RootElement.GetProperty("ok").GetBoolean(), key);
            Assert.Equal("invalid-input", doc.RootElement.GetProperty("error").GetString());
        }
    }

    [Fact]
    public void T18_BridgeSource_DoesNotPersist()
    {
        var src = File.ReadAllText(BridgeSourcePath());
        Assert.DoesNotContain("File.Write", src);
        Assert.DoesNotContain("WriteAllText", src);
        Assert.DoesNotContain("SqliteConnection", src);
        Assert.DoesNotContain("Microsoft.Data.Sqlite", src);
        Assert.Contains("BackupDryRunService.Run", src);
        Assert.Contains("DRY_RUN_ONLY", src);
        Assert.Contains("applied", src);
    }

    [Fact]
    public void T19_T20_Host_IsThinPreview_NoPhonebookOrSqlite()
    {
        var host = File.ReadAllText(HostSourcePath());
        Assert.Contains("public string TestRestoreBackup(string json)", host);
        Assert.Contains("BackupDryRunBridge.Execute", host);
        var method = Slice(host, "public string TestRestoreBackup", "public string ConsumeBackupSnapshot");
        Assert.DoesNotContain("File.WriteAllText", method);
        Assert.DoesNotContain("WriteBackupText", method);
        Assert.DoesNotContain("savePBContact", method);
        Assert.DoesNotContain("Sqlite", method);
        Assert.DoesNotContain("applyBackupMergeSections", method);
        Assert.DoesNotContain("applyBackupReplaceSections", method);
        Assert.DoesNotContain("resetAll", method);
        Assert.DoesNotContain("importData", method);
    }

    [Fact]
    public void JsonBackupRepository_RemainsTbdStub()
    {
        Assert.Equal("html-backup-engine", JsonBackupRepository.TbdMarker);
    }

    [Fact]
    public void TestRestoreBackup_IsAlwaysAllowedHostMethod()
    {
        Assert.Contains("TestRestoreBackup", PermissionCatalog.AlwaysAllowedHostMethods);
        var gate = new HostSecurityGate();
        Assert.True(gate.Authorize(AuthSession.Unauthenticated(true), "TestRestoreBackup").Ok);
    }

    [Fact]
    public void Arch2_3_4_5_6_Regression_StillPass()
    {
        var schema0 = JsonNode.Parse("{\"warranties\":[],\"invoices\":[]}")!;
        Assert.True(BackupValidator.Validate(schema0).Ok);
        Assert.True(BackupMigrator.MigratePackage(schema0, FrozenNow).Ok);
        var dry = BackupDryRunService.Run(schema0, FrozenNow);
        Assert.True(dry.Ok);
        Assert.False(dry.Applied);
        var fin = BackupFinalizer.FinalizePackage(schema0, "manual", "full");
        Assert.True(fin.Ok);
        using var bridged = JsonDocument.Parse(BackupFinalizeBridge.Execute("{\"data\":{\"warranties\":[],\"invoices\":[]},\"checksumMode\":\"none\"}"));
        Assert.True(bridged.RootElement.GetProperty("ok").GetBoolean());
    }

    [Fact]
    public void InputClone_IsNotMutated()
    {
        var row = FindFixture("T1-schema1-current-valid");
        var input = ParseInput(row)!;
        var before = BackupJsJson.Stringify(input);
        BackupDryRunBridge.Execute(RequestJson(row));
        Assert.Equal(before, BackupJsJson.Stringify(input));
    }

    private static string RequestJson(JsonElement row)
    {
        var data = ParseInput(row);
        var dataJson = data is null ? "null" : BackupJsJson.Stringify(data);
        var now = FrozenNow.ToString(System.Globalization.CultureInfo.InvariantCulture);
        if (row.TryGetProperty("frozenNowMs", out var n) && n.ValueKind == JsonValueKind.Number)
            now = n.GetRawText();
        return "{\"data\":" + dataJson + ",\"nowMs\":" + now + "}";
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

    private static List<string> StrList(JsonElement obj, string name)
    {
        var list = new List<string>();
        if (!obj.TryGetProperty(name, out var arr) || arr.ValueKind != JsonValueKind.Array) return list;
        foreach (var x in arr.EnumerateArray())
            if (x.ValueKind == JsonValueKind.String) list.Add(x.GetString() ?? "");
        return list;
    }

    private static string BridgeSourcePath() =>
        Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", "Sirman.Core", "Backup", "BackupDryRunBridge.cs"));

    private static string HostSourcePath() =>
        Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", "Sirman.Desktop", "SirmanHostObject.cs"));

    private static string Slice(string src, string start, string end)
    {
        var i = src.IndexOf(start, StringComparison.Ordinal);
        var j = src.IndexOf(end, StringComparison.Ordinal);
        Assert.True(i >= 0 && j > i, "could not slice Host TestRestoreBackup");
        return src.Substring(i, j - i);
    }
}
