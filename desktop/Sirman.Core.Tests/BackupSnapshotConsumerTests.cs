using System.Text.Json;
using System.Text.Json.Nodes;
using Sirman.Core.Backup;
using Sirman.Core.Data.Repositories;
using Sirman.Core.Security;
using Xunit;

namespace Sirman.Core.Tests;

/// <summary>
/// ARCH-10 — read-only Core consumer of an isolated BackupSnapshot.
/// No Restore. No live assembly. No second Finalizer.
/// </summary>
public class BackupSnapshotConsumerTests
{
    [Fact]
    public void T1_ValidIsolatedSnapshot()
    {
        var node = ValidSchema1();
        using var doc = Parse(Execute(node));
        var root = doc.RootElement;
        Assert.True(root.GetProperty("ok").GetBoolean());
        Assert.False(root.GetProperty("applied").GetBoolean());
        Assert.False(root.GetProperty("wrote").GetBoolean());
        Assert.Equal("core", root.GetProperty("engine").GetString());
        Assert.Equal("VALID", root.GetProperty("status").GetString());
        Assert.Equal(1, root.GetProperty("schemaVersion").GetInt32());
        Assert.Equal("1405.6.3α", root.GetProperty("version").GetString());
        Assert.True(root.GetProperty("keyCount").GetInt32() >= 49);
        Assert.True(root.GetProperty("sectionsCount").GetInt32() >= 32);
        Assert.Equal(0, root.GetProperty("itemCounts").GetProperty("invoices").GetInt32());
        Assert.False(string.IsNullOrEmpty(root.GetProperty("fingerprint").GetString()));
        Assert.Equal(64, root.GetProperty("fingerprint").GetString()!.Length);
    }

    [Fact]
    public void T2_MissingWarranties()
    {
        var node = ValidSchema1();
        node.Remove("warranties");
        using var doc = Parse(Execute(node));
        Assert.False(doc.RootElement.GetProperty("ok").GetBoolean());
        Assert.Contains("warranties", doc.RootElement.GetProperty("missingRequiredCollections").EnumerateArray().Select(x => x.GetString()));
    }

    [Fact]
    public void T3_MissingInvoices()
    {
        var node = ValidSchema1();
        node.Remove("invoices");
        using var doc = Parse(Execute(node));
        Assert.False(doc.RootElement.GetProperty("ok").GetBoolean());
        Assert.Contains("invoices", doc.RootElement.GetProperty("missingRequiredCollections").EnumerateArray().Select(x => x.GetString()));
    }

    [Fact]
    public void T4_Schema1_MissingSales()
    {
        AssertMissingSchema1("sales");
    }

    [Fact]
    public void T5_Schema1_MissingParts()
    {
        AssertMissingSchema1("parts");
    }

    [Fact]
    public void T6_Schema1_MissingAccounts()
    {
        AssertMissingSchema1("accounts");
    }

    [Fact]
    public void T7_ItemCountsMismatch()
    {
        var node = ValidSchema1();
        node["invoices"] = new JsonArray { new JsonObject { ["invoiceId"] = "INVUID-000001" } };
        using var doc = Parse(Execute(node));
        Assert.False(doc.RootElement.GetProperty("ok").GetBoolean());
        Assert.Contains("invoices", doc.RootElement.GetProperty("countMismatches").EnumerateArray().Select(x => x.GetString()));
    }

    [Fact]
    public void T8_BrokenAttachmentReference()
    {
        var node = ValidSchema1();
        node["attachmentsIndex"] = new JsonArray
        {
            new JsonObject { ["kind"] = "invoice", ["parentId"] = "MISSING-PARENT" }
        };
        using var doc = Parse(Execute(node));
        Assert.False(doc.RootElement.GetProperty("ok").GetBoolean());
        Assert.Contains("MISSING-PARENT", doc.RootElement.GetProperty("brokenAttachmentRefs").EnumerateArray().Select(x => x.GetString()));
    }

    [Fact]
    public void T9_DuplicateIdentityWarning()
    {
        var node = ValidSchema1();
        node["invoices"] = new JsonArray
        {
            new JsonObject { ["invoiceId"] = "INVUID-000001" },
            new JsonObject { ["invoiceId"] = "INVUID-000001" }
        };
        node["itemCounts"]!.AsObject()["invoices"] = 2;
        using var doc = Parse(Execute(node));
        Assert.True(doc.RootElement.GetProperty("ok").GetBoolean());
        Assert.Equal("VALID_WITH_WARNINGS", doc.RootElement.GetProperty("status").GetString());
        Assert.True(doc.RootElement.GetProperty("duplicateIdentities").GetInt32() >= 1);
        Assert.NotEmpty(doc.RootElement.GetProperty("warnings").EnumerateArray());
    }

    [Fact]
    public void T10_ValidChecksum()
    {
        var fin = BackupFinalizer.Finalize(new BackupFinalizeRequest
        {
            Data = ValidSchema1(),
            Origin = "manual",
            Kind = "full",
            ChecksumMode = BackupChecksumMode.Sha256
        });
        Assert.True(fin.Ok);
        using var doc = Parse(Execute(fin.Data!));
        Assert.True(doc.RootElement.GetProperty("ok").GetBoolean(), doc.RootElement.GetRawText());
        Assert.True(doc.RootElement.GetProperty("checksumClaimed").GetBoolean());
        Assert.Equal("SHA-256", doc.RootElement.GetProperty("checksumAlgo").GetString());
        Assert.False(doc.RootElement.GetProperty("checksumSkipped").GetBoolean());
        Assert.True(doc.RootElement.GetProperty("finalized").GetBoolean());
    }

    [Fact]
    public void T11_InvalidChecksum()
    {
        var node = ValidSchema1();
        node["checksum"] = "deadbeef";
        node["checksumAlgo"] = "md5";
        using var doc = Parse(Execute(node));
        Assert.False(doc.RootElement.GetProperty("ok").GetBoolean());
        Assert.Equal("INVALID", doc.RootElement.GetProperty("status").GetString());
    }

    [Fact]
    public void T12_ChecksumAbsentOrNone()
    {
        using var absent = Parse(Execute(ValidSchema1()));
        Assert.True(absent.RootElement.GetProperty("ok").GetBoolean());
        Assert.True(absent.RootElement.GetProperty("checksumSkipped").GetBoolean());

        var none = ValidSchema1();
        none["checksum"] = "";
        none["checksumAlgo"] = "none";
        using var doc = Parse(Execute(none));
        Assert.True(doc.RootElement.GetProperty("ok").GetBoolean());
        Assert.True(doc.RootElement.GetProperty("checksumSkipped").GetBoolean());
    }

    [Fact]
    public void T13_Schema0LegacySnapshot()
    {
        var node = new JsonObject
        {
            ["schemaVersion"] = 0,
            ["warranties"] = new JsonArray(),
            ["invoices"] = new JsonArray()
        };
        using var doc = Parse(Execute(node));
        Assert.True(doc.RootElement.GetProperty("ok").GetBoolean());
        Assert.Equal(0, doc.RootElement.GetProperty("schemaVersion").GetInt32());
        Assert.Empty(doc.RootElement.GetProperty("missingRequiredCollections").EnumerateArray());
    }

    [Fact]
    public void T14_PersianUnicode()
    {
        var node = ValidSchema1();
        node["phonebook"] = new JsonArray
        {
            new JsonObject { ["fn"] = "علی", ["shop"] = "فروشگاه سیرمان" }
        };
        node["itemCounts"]!.AsObject()["phonebook"] = 1;
        var json = Envelope(node);
        Assert.Contains("علی", json, StringComparison.Ordinal);
        using var doc = Parse(BackupSnapshotConsumer.Execute(json));
        Assert.True(doc.RootElement.GetProperty("ok").GetBoolean());
        Assert.Equal(1, doc.RootElement.GetProperty("itemCounts").GetProperty("phonebook").GetInt32());
    }

    [Fact]
    public void T15_OptionalPrintCenter()
    {
        var node = ValidSchema1();
        node["printCenter"] = new JsonObject { ["enabled"] = true };
        using var doc = Parse(Execute(node));
        Assert.True(doc.RootElement.GetProperty("ok").GetBoolean());
        Assert.True(doc.RootElement.GetProperty("hasPrintCenter").GetBoolean());
    }

    [Fact]
    public void T16_OptionalAttachmentsIndex()
    {
        var node = ValidSchema1();
        node["attachmentsIndex"] = new JsonArray();
        using var doc = Parse(Execute(node));
        Assert.True(doc.RootElement.GetProperty("ok").GetBoolean());
        Assert.True(doc.RootElement.GetProperty("hasAttachmentsIndex").GetBoolean());
    }

    [Fact]
    public void T17_InputNotMutated_AndDoesNotHoldLiveArrays()
    {
        var node = ValidSchema1();
        node["invoices"] = new JsonArray { new JsonObject { ["invoiceId"] = "INVUID-000001" } };
        node["itemCounts"]!.AsObject()["invoices"] = 1;
        var before = BackupJsJson.Stringify(node);
        using var doc = Parse(Execute(node));
        Assert.True(doc.RootElement.GetProperty("ok").GetBoolean());
        Assert.Equal(before, BackupJsJson.Stringify(node));
        node["invoices"]!.AsArray().Add(new JsonObject { ["invoiceId"] = "INVUID-PUSHED" });
        Assert.Equal(2, node["invoices"]!.AsArray().Count);
        Assert.Single(JsonNode.Parse(before)!["invoices"]!.AsArray());
    }

    [Fact]
    public void T18_NoLocalStorageAndRejectsLiveHandles()
    {
        using var live = Parse(BackupSnapshotConsumer.Execute("{\"data\":{\"warranties\":[],\"invoices\":[]},\"localStorage\":true}"));
        Assert.False(live.RootElement.GetProperty("ok").GetBoolean());
        Assert.Equal("invalid-input", live.RootElement.GetProperty("error").GetString());

        using var mix = Parse(BackupSnapshotConsumer.Execute("{\"data\":{\"warranties\":[],\"invoices\":[]},\"invoices\":[]}"));
        Assert.False(mix.RootElement.GetProperty("ok").GetBoolean());

        var src = File.ReadAllText(ConsumerPath());
        Assert.DoesNotContain("localStorage", src);
        Assert.DoesNotContain("IndexedDB", src);
    }

    [Fact]
    public void T19_NoIndexedDbOrFilesystem()
    {
        var src = File.ReadAllText(ConsumerPath());
        Assert.DoesNotContain("File.Write", src);
        Assert.DoesNotContain("WriteAllText", src);
        Assert.DoesNotContain("SqliteConnection", src);
        Assert.DoesNotContain("indexedDB", src, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("Microsoft.Web.WebView2", src);
        Assert.DoesNotContain("System.Windows.Forms", src);
    }

    [Fact]
    public void T20_DoesNotCallRestore()
    {
        var src = File.ReadAllText(ConsumerPath());
        Assert.DoesNotContain("importData", src);
        Assert.DoesNotContain("applyBackupSelective", src);
        Assert.DoesNotContain("applyBackupMergeSections", src);
        Assert.DoesNotContain("applyBackupReplaceSections", src);
        Assert.DoesNotContain("resetAll", src);
        Assert.DoesNotContain("svWarr", src);
        Assert.DoesNotContain("BackupDryRunService", src);
        Assert.Contains("BackupSnapshot.Parse", src);
        Assert.Contains("BackupValidator.Validate", src);
        Assert.DoesNotContain("BackupFinalizer.Finalize", src);
    }

    [Fact]
    public void Host_IsThinTransport_NoBusinessRules()
    {
        var host = File.ReadAllText(HostPath());
        Assert.Contains("public string ConsumeBackupSnapshot(string json)", host);
        var method = Slice(host, "public string ConsumeBackupSnapshot", "public string GetWarrantyBrowseCatalog");
        Assert.Contains("BackupSnapshotConsumer.Execute", method);
        Assert.DoesNotContain("File.WriteAllText", method);
        Assert.DoesNotContain("importData", method);
        Assert.DoesNotContain("applyBackupMergeSections", method);
        Assert.DoesNotContain("localStorage", method);
        Assert.Contains("ConsumeBackupSnapshot", PermissionCatalog.AlwaysAllowedHostMethods);
        var gate = new HostSecurityGate();
        Assert.True(gate.Authorize(AuthSession.Unauthenticated(true), "ConsumeBackupSnapshot").Ok);
    }

    [Fact]
    public void ReusesExistingEngines_NoSecondBackupEngine()
    {
        Assert.Equal("html-backup-engine", JsonBackupRepository.TbdMarker);
        var schema0 = JsonNode.Parse("{\"warranties\":[],\"invoices\":[]}")!;
        Assert.True(BackupValidator.Validate(schema0).Ok);
        var fin = BackupFinalizer.FinalizePackage(schema0, "manual", "full");
        Assert.True(fin.Ok);
        using var consume = Parse(Execute(ValidSchema1()));
        Assert.True(consume.RootElement.GetProperty("ok").GetBoolean());
        Assert.False(consume.RootElement.GetProperty("applied").GetBoolean());
    }

    [Fact]
    public void InvalidJson_FailsClosed()
    {
        using var doc = Parse(BackupSnapshotConsumer.Execute("not-json"));
        Assert.False(doc.RootElement.GetProperty("ok").GetBoolean());
        Assert.False(doc.RootElement.TryGetProperty("fingerprint", out _));
    }

    [Fact]
    public void CoreBackupFolder_HasNoUiOrStorageDependencies()
    {
        var src = File.ReadAllText(ConsumerPath());
        Assert.DoesNotContain("System.Windows", src);
        Assert.DoesNotContain("Microsoft.Web.WebView2", src);
        Assert.DoesNotContain("localStorage", src);
        Assert.DoesNotContain("File.Write", src);
        var csproj = File.ReadAllText(Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", "Sirman.Core", "Sirman.Core.csproj")));
        Assert.DoesNotContain("Microsoft.Web.WebView2", csproj);
        Assert.DoesNotContain("System.Windows", csproj);
    }

    private static void AssertMissingSchema1(string key)
    {
        var node = ValidSchema1();
        node.Remove(key);
        using var doc = Parse(Execute(node));
        Assert.False(doc.RootElement.GetProperty("ok").GetBoolean());
        Assert.Contains(key, doc.RootElement.GetProperty("missingRequiredCollections").EnumerateArray().Select(x => x.GetString()));
    }

    private static string Execute(JsonNode node) => BackupSnapshotConsumer.Execute(Envelope(node));

    private static string Envelope(JsonNode node) => "{\"data\":" + BackupJsJson.Stringify(node) + "}";

    private static JsonDocument Parse(string json) => JsonDocument.Parse(json);

    private static JsonObject ValidSchema1()
    {
        var counts = new JsonObject();
        foreach (var k in BackupSnapshotCatalog.ItemCountKeys)
            counts[k] = 0;
        var sections = new JsonArray();
        foreach (var s in BackupSnapshotCatalog.SectionsCatalog)
            sections.Add(s);
        return new JsonObject
        {
            ["magic"] = BackupSnapshotCatalog.Magic,
            ["schemaVersion"] = BackupSnapshotCatalog.AppSchemaVersion,
            ["version"] = "1405.6.3α",
            ["applicationVersion"] = "1405.6.3α",
            ["exportedAt"] = "2023-11-14T22:13:20.000Z",
            ["invoices"] = new JsonArray(),
            ["products"] = new JsonArray(),
            ["inventory"] = new JsonObject(),
            ["invCtr"] = 1,
            ["invoiceUidCtr"] = 0,
            ["saleCtr"] = 1,
            ["saleUidCtr"] = 0,
            ["phonebook"] = new JsonArray(),
            ["parts"] = new JsonArray(),
            ["services"] = new JsonArray(),
            ["svcs"] = new JsonArray(),
            ["warranties"] = new JsonArray(),
            ["sales"] = new JsonArray(),
            ["tasks"] = new JsonArray(),
            ["accounts"] = new JsonArray(),
            ["defectiveStock"] = new JsonArray(),
            ["warehouseDocs"] = new JsonArray(),
            ["stockMoves"] = new JsonArray(),
            ["warehouses"] = new JsonArray(),
            ["daqi"] = new JsonArray(),
            ["daqiWarehouse"] = new JsonArray(),
            ["daqiVouchers"] = new JsonArray(),
            ["postalHistory"] = new JsonArray(),
            ["appliedUpdates"] = new JsonArray(),
            ["updatePackages"] = new JsonArray(),
            ["userAuditLog"] = new JsonArray(),
            ["bgAuditLog"] = new JsonArray(),
            ["userRoles"] = new JsonArray(),
            ["loginPw"] = "",
            ["printSettings"] = new JsonObject(),
            ["company"] = new JsonObject(),
            ["serviceCenter"] = new JsonObject(),
            ["starredAlarms"] = new JsonArray(),
            ["senderInfo"] = new JsonObject(),
            ["logoSrc"] = "",
            ["acH"] = new JsonObject(),
            ["appearance"] = new JsonObject(),
            ["sms"] = new JsonObject(),
            ["tz"] = "Asia/Tehran",
            ["networkSettings"] = new JsonObject(),
            ["prefs"] = new JsonObject(),
            ["aiKeys"] = new JsonObject(),
            ["itemCounts"] = counts,
            ["sections"] = sections
        };
    }

    private static string ConsumerPath() =>
        Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", "Sirman.Core", "Backup", "BackupSnapshotConsumer.cs"));

    private static string HostPath() =>
        Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", "Sirman.Desktop", "SirmanHostObject.cs"));

    private static string Slice(string src, string start, string end)
    {
        var i = src.IndexOf(start, StringComparison.Ordinal);
        var j = src.IndexOf(end, StringComparison.Ordinal);
        Assert.True(i >= 0 && j > i, start + " .. " + end);
        return src.Substring(i, j - i);
    }
}
