using System.Text.Json;
using System.Text.Json.Nodes;
using Sirman.Core.Backup;
using Sirman.Core.Data.Repositories;
using Xunit;

namespace Sirman.Core.Tests;

/// <summary>
/// ARCH-17 — BusinessDataSnapshot is a pure REQUIRED-collections transport DTO.
/// HTML adapter is the RAM reader. ARCH-20 wires it into _buildFullBackupData.
/// </summary>
public class BusinessDataSnapshotTests
{
    [Theory]
    [InlineData("T1")]
    [InlineData("T2")]
    [InlineData("T3")]
    [InlineData("T4")]
    [InlineData("T5")]
    [InlineData("T6")]
    [InlineData("T7")]
    [InlineData("T8")]
    [InlineData("T9")]
    [InlineData("T10")]
    public void GoldenFixture_HtmlExpected_MatchesCoreDto(string id)
    {
        var expected = Case(id).GetProperty("expected");
        var node = JsonNode.Parse(expected.GetRawText())!.AsObject();
        var before = BackupJsJson.Stringify(node);
        var snap = BusinessDataSnapshot.Parse(node);
        Assert.Equal(before, BackupJsJson.Stringify(node));
        Assert.True(snap.Report.HasAllRequiredKeys, id);
        Assert.Equal(before, snap.ToCanonicalJson());
        var again = BusinessDataSnapshot.FromCanonicalJson(snap.ToCanonicalJson());
        Assert.Equal(snap.ToCanonicalJson(), again.ToCanonicalJson());
        foreach (var key in BusinessDataSnapshotCatalog.ForbiddenKeys)
            Assert.False(snap.Data.ContainsKey(key), id + " " + key);
        foreach (var rt in BusinessDataSnapshotCatalog.ForbiddenRuntimeKeys)
            Assert.False(snap.Data.ContainsKey(rt), id + " runtime " + rt);
        Assert.False(snap.Data.ContainsKey("phonebook"), id);
        Assert.False(snap.Data.ContainsKey("attachmentsIndex"), id);
    }

    [Fact]
    public void T1_AllRequiredPopulated()
    {
        var snap = Snap("T1");
        Assert.Equal("INVUID-000007", BackupJsonUtil.Str(snap.Invoices![0]!["invoiceId"]));
        Assert.Equal("SALEUID-000003", BackupJsonUtil.Str(snap.Sales![0]!["saleUid"]));
        Assert.Equal("W25-20101-0001", BackupJsonUtil.Str(snap.Warranties![0]!["id"]));
        Assert.Equal("PT-1", BackupJsonUtil.Str(snap.Parts![0]!["id"]));
        Assert.Equal("ACC-0001", BackupJsonUtil.Str(snap.Accounts![0]!["id"]));
        Assert.Equal(8, snap.Counters!["invCtr"]!.GetValue<int>());
        Assert.Equal(7, snap.Counters["invoiceUidCtr"]!.GetValue<int>());
        Assert.Equal(4, snap.Counters["saleCtr"]!.GetValue<int>());
        Assert.Equal(3, snap.Counters["saleUidCtr"]!.GetValue<int>());
        Assert.Equal("keep", BackupJsonUtil.Str(snap.Invoices[0]!["nested"]!["tag"]));
        Assert.False(snap.Data.ContainsKey("phonebook"));
        Assert.False(snap.Data.ContainsKey("tasks"));
        Assert.False(snap.Data.ContainsKey("services"));
    }

    [Fact]
    public void T2_EmptyCollections_CounterDefaults()
    {
        var snap = Snap("T2");
        Assert.Empty(snap.Invoices!);
        Assert.Empty(snap.Sales!);
        Assert.Empty(snap.Warranties!);
        Assert.Empty(snap.Parts!);
        Assert.Empty(snap.Accounts!);
        Assert.Equal(1, snap.Counters!["invCtr"]!.GetValue<int>());
        Assert.Equal(0, snap.Counters["invoiceUidCtr"]!.GetValue<int>());
        Assert.Equal(1, snap.Counters["saleCtr"]!.GetValue<int>());
        Assert.Equal(0, snap.Counters["saleUidCtr"]!.GetValue<int>());
    }

    [Fact]
    public void T3_MissingOptionalIdentity_Preserved()
    {
        var snap = Snap("T3");
        Assert.False(snap.Invoices![0]!.AsObject().ContainsKey("invoiceId"));
        Assert.Equal("9", BackupJsonUtil.Str(snap.Invoices[0]!["num"]));
        Assert.False(snap.Parts![0]!.AsObject().ContainsKey("id"));
        Assert.Equal("NX-1", BackupJsonUtil.Str(snap.Parts[0]!["code"]));
        Assert.False(snap.Accounts![0]!.AsObject().ContainsKey("transactions"));
    }

    [Fact]
    public void T4_NestedRecords_Preserved()
    {
        var snap = Snap("T4");
        Assert.Equal("deep", BackupJsonUtil.Str(snap.Invoices![0]!["bag"]!["a"]!["b"]!["c"]));
        Assert.Equal(3, snap.Parts![0]!["byWh"]!["WH-PARTS"]!["qty"]!.GetValue<int>());
        Assert.Equal("SALEUID-000001", BackupJsonUtil.Str(snap.Accounts![0]!["transactions"]![0]!["saleUid"]));
    }

    [Fact]
    public void T5_PersianUnicode_RoundTrip()
    {
        var json = Snap("T5").ToCanonicalJson();
        Assert.Contains("سلام علی", json, StringComparison.Ordinal);
        Assert.Contains("لایق الکترونیک پارسیان", json, StringComparison.Ordinal);
        Assert.Contains("یاتاقان جلو", json, StringComparison.Ordinal);
        Assert.Equal(json, BusinessDataSnapshot.FromCanonicalJson(json).ToCanonicalJson());
    }

    [Fact]
    public void T6_NumericAndStringPreservation()
    {
        var inv = Snap("T6").Invoices![0]!;
        Assert.Equal(0, inv["tF"]!.GetValue<int>());
        Assert.Equal("0", BackupJsonUtil.Str(inv["flag"]));
        Assert.Equal(150000, inv["items"]![0]!["fin"]!.GetValue<int>());
        Assert.Equal(1.5, Snap("T6").Parts![0]!["price"]!.GetValue<double>());
        Assert.Equal("0", BackupJsonUtil.Str(Snap("T6").Accounts![0]!["number"]));
    }

    [Fact]
    public void T7_Counters_HaveNoIdentitySemantics()
    {
        var c = Snap("T7").Counters!;
        Assert.Equal(12, c["invCtr"]!.GetValue<int>());
        Assert.Equal(12, c["invoiceUidCtr"]!.GetValue<int>());
        Assert.Equal(8, c["saleCtr"]!.GetValue<int>());
        Assert.Equal(8, c["saleUidCtr"]!.GetValue<int>());
        Assert.False(BusinessDataSnapshotCatalog.IdentityFields.ContainsKey("counters"));
        Assert.Equal(4, BusinessDataSnapshotCatalog.CounterKeys.Count);
    }

    [Fact]
    public void T8_DuplicatesPreservedExactly()
    {
        Assert.Equal(2, Snap("T8").Invoices!.Count);
        Assert.Equal("a", BackupJsonUtil.Str(Snap("T8").Invoices![0]!["twin"]));
        Assert.Equal("b", BackupJsonUtil.Str(Snap("T8").Invoices![1]!["twin"]));
        Assert.Equal("one", BackupJsonUtil.Str(Snap("T8").Accounts![0]!["name"]));
        Assert.Equal("two", BackupJsonUtil.Str(Snap("T8").Accounts![1]!["name"]));
    }

    [Fact]
    public void T9_ParseDoesNotInventIdentity()
    {
        var snap = Snap("T9");
        Assert.Equal("INVUID-000099", BackupJsonUtil.Str(snap.Invoices![0]!["InvoiceId"]));
        Assert.False(snap.Invoices[0]!.AsObject().ContainsKey("invoiceId"));
        Assert.False(snap.Invoices[1]!.AsObject().ContainsKey("invoiceId"));
        Assert.False(snap.Warranties![0]!.AsObject().ContainsKey("id"));
        Assert.Equal("", BackupJsonUtil.Str(snap.Warranties[1]!["id"]));
        Assert.False(snap.Parts![0]!.AsObject().ContainsKey("id"));
        Assert.False(snap.Accounts![0]!.AsObject().ContainsKey("id"));
        Assert.Equal("invoiceId", BusinessDataSnapshotCatalog.IdentityFields["invoices"]);
        Assert.Equal("saleUid", BusinessDataSnapshotCatalog.IdentityFields["sales"]);
        Assert.Equal("id", BusinessDataSnapshotCatalog.IdentityFields["warranties"]);
        Assert.Equal("id", BusinessDataSnapshotCatalog.IdentityFields["parts"]);
        Assert.Equal("id", BusinessDataSnapshotCatalog.IdentityFields["accounts"]);
    }

    [Fact]
    public void T10_LargeArrayOrderPreserved()
    {
        var snap = Snap("T10");
        Assert.Equal(40, snap.Invoices!.Count);
        Assert.Equal(0, snap.Invoices[0]!["order"]!.GetValue<int>());
        Assert.Equal(39, snap.Invoices[39]!["order"]!.GetValue<int>());
        Assert.Equal("W-ORD-000", BackupJsonUtil.Str(snap.Warranties![0]!["id"]));
        Assert.Equal("W-ORD-039", BackupJsonUtil.Str(snap.Warranties[39]!["id"]));
        Assert.Equal("P-ORD-0", BackupJsonUtil.Str(snap.Parts![0]!["id"]));
        Assert.Equal("P-ORD-39", BackupJsonUtil.Str(snap.Parts[39]!["id"]));
    }

    [Fact]
    public void NestedObjectIsolation_DoesNotMutateInput()
    {
        var raw = JsonNode.Parse(Case("T1").GetProperty("expected").GetRawText())!.AsObject();
        var before = BackupJsJson.Stringify(raw);
        var snap = BusinessDataSnapshot.Parse(raw);
        snap.Invoices![0]!["seller"] = "mutated";
        snap.Invoices[0]!["nested"]!["tag"] = "mutated";
        snap.Sales![0]!["name"] = "mutated";
        snap.Warranties![0]!["name"] = "mutated";
        snap.Parts![0]!["qty"] = 99;
        snap.Accounts![0]!["balance"] = 1;
        snap.Counters!["invCtr"] = 0;
        Assert.Equal(before, BackupJsJson.Stringify(raw));
        var copy = snap.ToJson();
        copy["invoices"]![0]!["seller"] = "again";
        Assert.Equal("mutated", BackupJsonUtil.Str(snap.Invoices[0]!["seller"]));
        Assert.False(ReferenceEquals(snap.Data, copy));
        Assert.False(ReferenceEquals(snap.Invoices, raw["invoices"]));
    }

    [Fact]
    public void DeterministicSerialization_NoClockOrRandom()
    {
        var a = Snap("T1").ToCanonicalJson();
        var b = Snap("T1").ToCanonicalJson();
        Assert.Equal(a, b);
        var src = File.ReadAllText(DtoPath());
        Assert.DoesNotContain("DateTime.UtcNow", src);
        Assert.DoesNotContain("DateTime.Now", src);
        Assert.DoesNotContain("Guid.NewGuid", src);
        Assert.DoesNotContain("Random", src);
        var cat = File.ReadAllText(CatalogPath());
        Assert.DoesNotContain("DateTime", cat);
        Assert.DoesNotContain("Guid", cat);
    }

    [Fact]
    public void MalformedSourceHandling()
    {
        var empty = BusinessDataSnapshot.FromCanonicalJson("{");
        Assert.False(empty.Report.IsObject);
        Assert.False(empty.Report.HasAllRequiredKeys);
        Assert.Equal("{}", empty.ToCanonicalJson());
        Assert.Equal("{}", BusinessDataSnapshot.FromCanonicalJson(null).ToCanonicalJson());
        Assert.Equal("{}", BusinessDataSnapshot.FromCanonicalJson("not-json").ToCanonicalJson());
        Assert.Equal("{}", BusinessDataSnapshot.Parse(null).ToCanonicalJson());
    }

    [Fact]
    public void NoBrowserReferencesInCore()
    {
        foreach (var path in new[] { DtoPath(), CatalogPath() })
        {
            var src = File.ReadAllText(path);
            Assert.DoesNotContain("getItem(", src);
            Assert.DoesNotContain("setItem(", src);
            Assert.DoesNotContain("indexedDB", src);
            Assert.DoesNotContain("IndexedDB", src);
            Assert.DoesNotContain("Microsoft.Web.WebView2", src);
            Assert.DoesNotContain("System.Windows.Forms", src);
            Assert.DoesNotContain("sirmanHost", src);
            Assert.DoesNotContain("Microsoft.Web", src);
        }
        foreach (var t in new[] { typeof(BusinessDataSnapshot), typeof(BusinessDataSnapshotCatalog) })
        {
            Assert.Equal("Sirman.Core.Backup", t.Namespace);
            foreach (var p in t.GetMethods().SelectMany(m => m.GetParameters()))
            {
                var n = p.ParameterType.FullName ?? "";
                Assert.DoesNotContain("System.Windows", n);
                Assert.DoesNotContain("WebView2", n);
                Assert.DoesNotContain("Microsoft.Web", n);
            }
        }
    }

    [Fact]
    public void StripsForbiddenKeys_IncludingPhonebookAndAttachments()
    {
        var mixed = JsonNode.Parse(Case("T1").GetProperty("expected").GetRawText())!.AsObject();
        mixed["phonebook"] = new JsonArray { new JsonObject { ["fn"] = "x" } };
        mixed["pb"] = new JsonArray();
        mixed["tasks"] = new JsonArray();
        mixed["services"] = new JsonArray();
        mixed["svcs"] = new JsonArray();
        mixed["attachmentsIndex"] = new JsonArray { new JsonObject { ["id"] = "x" } };
        mixed["printSettings"] = new JsonObject();
        mixed["loginPw"] = "secret";
        mixed["invCtr"] = 99;
        mixed["localStorage"] = new JsonObject();
        var snap = BusinessDataSnapshot.Parse(mixed);
        Assert.Contains("phonebook", snap.Report.StrippedForbiddenKeys);
        Assert.Contains("attachmentsIndex", snap.Report.StrippedForbiddenKeys);
        Assert.Contains("invCtr", snap.Report.StrippedForbiddenKeys);
        Assert.True(snap.Report.HasPhonebook);
        Assert.True(snap.Report.HasAttachmentsIndex);
        Assert.True(snap.Report.HasRuntimeHandles);
        Assert.Contains("localStorage", snap.Report.RuntimeHandleKeys);
        foreach (var key in BusinessDataSnapshotCatalog.ForbiddenKeys)
            Assert.False(snap.Data.ContainsKey(key), key);
        Assert.False(snap.Data.ContainsKey("localStorage"));
        Assert.Equal("INVUID-000007", BackupJsonUtil.Str(snap.Invoices![0]!["invoiceId"]));
        Assert.Equal(8, snap.Counters!["invCtr"]!.GetValue<int>());
    }

    [Fact]
    public void RegressionLocks_RequiredSliceCutover()
    {
        Assert.Equal("html-backup-engine", JsonBackupRepository.TbdMarker);
        Assert.Equal(5, BusinessDataSnapshotCatalog.CollectionKeys.Count);
        Assert.Equal(6, BusinessDataSnapshotCatalog.AllRequiredKeys.Count);
        Assert.DoesNotContain("phonebook", BusinessDataSnapshotCatalog.AllRequiredKeys);
        Assert.Contains("phonebook", BusinessDataSnapshotCatalog.ForbiddenKeys);
        Assert.DoesNotContain("tasks", BusinessDataSnapshotCatalog.AllRequiredKeys);
        Assert.DoesNotContain("attachmentsIndex", BusinessDataSnapshotCatalog.AllRequiredKeys);
        Assert.Contains("counters", BusinessDataSnapshotCatalog.AllRequiredKeys);
        var printHost = File.ReadAllText(Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", "Sirman.Desktop", "WindowsPrintHost.cs")));
        Assert.Contains("internal sealed class WindowsPrintHost", printHost);
        var sqlite = File.ReadAllText(Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", "Sirman.Persistence.Sqlite", "Sirman.Persistence.Sqlite.csproj")));
        Assert.Contains("Sirman.Persistence.Sqlite", sqlite);
        var html = File.ReadAllText(Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", "..", "Sirman_Final.html")));
        var build = ExtractFunction(html, "_buildFullBackupData");
        Assert.Contains("var b = collectRequiredBusinessSnapshot();", build);
        Assert.Single(System.Text.RegularExpressions.Regex.Matches(build, @"collectRequiredBusinessSnapshot\s*\(\s*\)"));
        Assert.Contains("invoices: b.invoices", build);
        Assert.Contains("sales: b.sales", build);
        Assert.Contains("warranties: b.warranties", build);
        Assert.Contains("parts: b.parts", build);
        Assert.Contains("accounts: b.accounts", build);
        Assert.Contains("invCtr: b.counters.invCtr", build);
        Assert.Contains("invoiceUidCtr: b.counters.invoiceUidCtr", build);
        Assert.Contains("saleCtr: b.counters.saleCtr", build);
        Assert.Contains("saleUidCtr: b.counters.saleUidCtr", build);
        Assert.DoesNotContain("counters:", build);
        Assert.Contains("phonebook: _safeArr(phonebook)", build);
        Assert.Contains("collectAttachmentIndex(data)", build);
        Assert.Contains("return JSON.parse(JSON.stringify(data));", build);
        Assert.DoesNotContain("collectRequiredBusinessSnapshot()", ExtractFunction(html, "exportData"));
        Assert.DoesNotContain("collectRequiredBusinessSnapshot()", ExtractFunction(html, "buildBackupObject"));
        Assert.Contains("var o = collectOptionalBusinessSnapshot();", build);
        Assert.Single(System.Text.RegularExpressions.Regex.Matches(build, @"collectOptionalBusinessSnapshot\s*\(\s*\)"));
        Assert.DoesNotContain("collectOptionalBusinessSnapshot()", ExtractFunction(html, "exportData"));
        Assert.DoesNotContain("collectOptionalBusinessSnapshot()", ExtractFunction(html, "buildBackupObject"));
        Assert.Contains("1405.6.3α", build);
    }

    private static string ExtractFunction(string html, string fnName)
    {
        var match = System.Text.RegularExpressions.Regex.Match(html, "(?:async\\s+)?function\\s+" + fnName + "\\s*\\([^)]*\\)\\s*\\{");
        Assert.True(match.Success, fnName);
        var start = match.Index;
        var depth = 0;
        var started = false;
        var i = start;
        for (; i < html.Length; i++)
        {
            if (html[i] == '{') { depth++; started = true; }
            else if (html[i] == '}')
            {
                depth--;
                if (started && depth == 0) { i++; break; }
            }
        }
        return html.Substring(start, i - start);
    }

    private static BusinessDataSnapshot Snap(string id) =>
        BusinessDataSnapshot.Parse(JsonNode.Parse(Case(id).GetProperty("expected").GetRawText()));

    private static JsonElement Case(string id)
    {
        foreach (var c in FixtureRoot().GetProperty("cases").EnumerateArray())
        {
            if (c.GetProperty("id").GetString() == id) return c;
        }
        throw new InvalidOperationException("missing fixture " + id);
    }

    private static JsonElement FixtureRoot()
    {
        var path = Path.Combine(AppContext.BaseDirectory, "BusinessDataFixtures.json");
        Assert.True(File.Exists(path), path);
        return JsonDocument.Parse(File.ReadAllText(path)).RootElement;
    }

    private static string DtoPath() =>
        Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", "Sirman.Core", "Backup", "BusinessDataSnapshot.cs"));

    private static string CatalogPath() =>
        Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", "Sirman.Core", "Backup", "BusinessDataSnapshotCatalog.cs"));
}
