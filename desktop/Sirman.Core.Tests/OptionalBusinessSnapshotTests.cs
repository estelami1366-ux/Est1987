using System.Text.Json;
using System.Text.Json.Nodes;
using Sirman.Core.Backup;
using Sirman.Core.Data.Repositories;
using Xunit;

namespace Sirman.Core.Tests;

/// <summary>
/// ARCH-18 — OptionalBusinessSnapshot is a pure OPTIONAL-collections transport DTO.
/// HTML adapter is the RAM reader. No live backup cutover.
/// </summary>
public class OptionalBusinessSnapshotTests
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
        var snap = OptionalBusinessSnapshot.Parse(node);
        Assert.Equal(before, BackupJsJson.Stringify(node));
        Assert.True(snap.Report.HasAllOptionalKeys, id);
        Assert.Equal(before, snap.ToCanonicalJson());
        var again = OptionalBusinessSnapshot.FromCanonicalJson(snap.ToCanonicalJson());
        Assert.Equal(snap.ToCanonicalJson(), again.ToCanonicalJson());
        foreach (var key in OptionalBusinessSnapshotCatalog.ForbiddenKeys)
            Assert.False(snap.Data.ContainsKey(key), id + " " + key);
        Assert.False(snap.Data.ContainsKey("phonebook"), id);
        Assert.False(snap.Data.ContainsKey("attachmentsIndex"), id);
    }

    [Fact]
    public void T1_AllOptionalPopulated()
    {
        var snap = Snap("T1");
        Assert.Equal("P-1", BackupJsonUtil.Str(snap.Products![0]!["code"]));
        Assert.Equal(4, snap.Inventory!["P-1"]!["qty"]!.GetValue<int>());
        Assert.Equal("S001", BackupJsonUtil.Str(snap.Services![0]!["code"]));
        Assert.Equal("S001", BackupJsonUtil.Str(snap.Svcs![0]!["code"]));
        Assert.Equal("TSK-1", BackupJsonUtil.Str(snap.Tasks![0]!["id"]));
        Assert.Equal("W-1", BackupJsonUtil.Str(snap.DefectiveStock![0]!["warrantyId"]));
        Assert.Equal("WH-IN-0001", BackupJsonUtil.Str(snap.WarehouseDocs![0]!["id"]));
        Assert.Equal("SM-0001", BackupJsonUtil.Str(snap.StockMoves![0]!["id"]));
        Assert.Equal("WH-PARTS", BackupJsonUtil.Str(snap.Warehouses![0]!["id"]));
        Assert.Equal(3, snap.Daqi![0]!["agencyPhonebookIdx"]!.GetValue<int>());
        Assert.False(snap.Data.ContainsKey("phonebook"));
        Assert.False(snap.Data.ContainsKey("invoices"));
    }

    [Fact]
    public void T2_EmptyCollections()
    {
        var snap = Snap("T2");
        Assert.Empty(snap.Products!);
        Assert.Equal("{}", BackupJsJson.Stringify(snap.Inventory));
        Assert.Empty(snap.Services!);
        Assert.Empty(snap.Svcs!);
        Assert.Empty(snap.Tasks!);
        Assert.Empty(snap.PostalHistory!);
    }

    [Fact]
    public void T3_NestedRecords_Preserved()
    {
        Assert.Equal("deep", BackupJsonUtil.Str(Snap("T3").Products![0]!["bag"]!["a"]!["b"]!["c"]));
        Assert.Equal("B1", BackupJsonUtil.Str(Snap("T3").Inventory!["N1"]!["byWh"]!["WH-PARTS"]!["nested"]!["loc"]));
    }

    [Fact]
    public void T4_PersianUnicode_RoundTrip()
    {
        var json = Snap("T4").ToCanonicalJson();
        Assert.Contains("سلام علی", json, StringComparison.Ordinal);
        Assert.Contains("لایق الکترونیک پارسیان", json, StringComparison.Ordinal);
        Assert.Contains("یاتاقان جلو", json, StringComparison.Ordinal);
        Assert.Equal(json, OptionalBusinessSnapshot.FromCanonicalJson(json).ToCanonicalJson());
    }

    [Fact]
    public void T5_ExactOrdering()
    {
        var snap = Snap("T5");
        Assert.Equal(24, snap.Products!.Count);
        Assert.Equal("C0", BackupJsonUtil.Str(snap.Products[0]!["code"]));
        Assert.Equal("C23", BackupJsonUtil.Str(snap.Products[23]!["code"]));
        Assert.Equal("TSK-ORD-000", BackupJsonUtil.Str(snap.Tasks![0]!["id"]));
        Assert.Equal("TSK-ORD-023", BackupJsonUtil.Str(snap.Tasks[23]!["id"]));
    }

    [Fact]
    public void T6_DuplicatesPreservedExactly()
    {
        Assert.Equal("a", BackupJsonUtil.Str(Snap("T6").Products![0]!["twin"]));
        Assert.Equal("b", BackupJsonUtil.Str(Snap("T6").Products![1]!["twin"]));
        Assert.Equal("one", BackupJsonUtil.Str(Snap("T6").Services![0]!["name"]));
        Assert.Equal("two", BackupJsonUtil.Str(Snap("T6").Services![1]!["name"]));
        Assert.Equal(2, Snap("T6").Tasks!.Count);
    }

    [Fact]
    public void T7_MissingOptionalFields_NotInvented()
    {
        var snap = Snap("T7");
        Assert.False(snap.Products![0]!.AsObject().ContainsKey("code"));
        Assert.False(snap.Services![0]!.AsObject().ContainsKey("id"));
        Assert.False(snap.Services[0]!.AsObject().ContainsKey("code"));
        Assert.False(snap.Tasks![0]!.AsObject().ContainsKey("id"));
        Assert.Equal("code", OptionalBusinessSnapshotCatalog.IdentityFields["products"]);
        Assert.Equal("id|code", OptionalBusinessSnapshotCatalog.IdentityFields["services"]);
        Assert.False(OptionalBusinessSnapshotCatalog.IdentityFields.ContainsKey("inventory"));
    }

    [Fact]
    public void T8_NullAndPrimitiveValues()
    {
        var snap = Snap("T8");
        Assert.Equal(0, snap.Inventory!["0"]!["qty"]!.GetValue<int>());
        // JSON null is a C# null JsonNode inside JsonObject (not JsonValue.Null).
        Assert.True(snap.Data.ContainsKey("daqiWarehouse"));
        Assert.Null(snap.Field("daqiWarehouse"));
        Assert.True(snap.Data.ContainsKey("daqiVouchers"));
        Assert.Null(snap.Field("daqiVouchers"));
        Assert.True(snap.Data.ContainsKey("postalHistory"));
        Assert.Null(snap.Field("postalHistory"));
        Assert.True(snap.Tasks![0]!.AsObject().ContainsKey("deadlineTS"));
        Assert.Null(snap.Tasks[0]!["deadlineTS"]);
        Assert.True(snap.Daqi![0]!.AsObject().ContainsKey("agencyPhonebookIdx"));
        Assert.Null(snap.Daqi[0]!["agencyPhonebookIdx"]);
        Assert.Equal("0", BackupJsonUtil.Str(snap.Products![0]!["flag"]));
    }

    [Fact]
    public void T9_CrossReferencesPreservedAsOpaqueJson()
    {
        var snap = Snap("T9");
        Assert.Equal("12", BackupJsonUtil.Str(snap.Tasks![0]!["link"]!["id"]));
        Assert.Equal("invoice", BackupJsonUtil.Str(snap.Tasks[0]!["link"]!["type"]));
        Assert.Equal("W-1", BackupJsonUtil.Str(snap.Tasks[1]!["link"]!["id"]));
        Assert.Equal("SL-0001", BackupJsonUtil.Str(snap.Tasks[2]!["link"]!["id"]));
        Assert.Equal("W-1", BackupJsonUtil.Str(snap.DefectiveStock![0]!["warrantyId"]));
        Assert.Equal("INVUID-000012", BackupJsonUtil.Str(snap.DefectiveStock[0]!["invoiceId"]));
        Assert.Equal("WH-OUT-0003", BackupJsonUtil.Str(snap.StockMoves![0]!["refDoc"]));
        Assert.Equal("12", BackupJsonUtil.Str(snap.StockMoves[1]!["refDoc"]));
        Assert.Equal("W-1", BackupJsonUtil.Str(snap.StockMoves[2]!["refDoc"]));
        Assert.Equal(7, snap.Daqi![0]!["agencyPhonebookIdx"]!.GetValue<int>());
        Assert.Equal("sale", BackupJsonUtil.Str(snap.Daqi[0]!["refType"]));
    }

    [Fact]
    public void T10_ServicesAndSvcsSameSource()
    {
        var snap = Snap("T10");
        Assert.Equal("LIVE", BackupJsonUtil.Str(snap.Services![0]!["code"]));
        Assert.Equal("LIVE", BackupJsonUtil.Str(snap.Svcs![0]!["code"]));
        Assert.NotEqual("STALE", BackupJsonUtil.Str(snap.Svcs[0]!["code"]));
        snap.Svcs[0]!["code"] = "MUT";
        Assert.Equal("LIVE", BackupJsonUtil.Str(snap.Services[0]!["code"]));
    }

    [Fact]
    public void NestedObjectIsolation_DoesNotMutateInput()
    {
        var raw = JsonNode.Parse(Case("T1").GetProperty("expected").GetRawText())!.AsObject();
        var before = BackupJsJson.Stringify(raw);
        var snap = OptionalBusinessSnapshot.Parse(raw);
        snap.Products![0]!["name"] = "mutated";
        snap.Inventory!["P-1"]!["qty"] = 99;
        snap.Services![0]!["name"] = "mutated";
        snap.Tasks![0]!["title"] = "mutated";
        snap.DefectiveStock![0]!["model"] = "mutated";
        snap.WarehouseDocs![0]!["id"] = "mutated";
        snap.StockMoves![0]!["itemCode"] = "mutated";
        Assert.Equal(before, BackupJsJson.Stringify(raw));
        var copy = snap.ToJson();
        copy["products"]![0]!["name"] = "again";
        Assert.Equal("mutated", BackupJsonUtil.Str(snap.Products[0]!["name"]));
        Assert.False(ReferenceEquals(snap.Data, copy));
    }

    [Fact]
    public void DeterministicSerialization_NoClockOrRandom()
    {
        Assert.Equal(Snap("T1").ToCanonicalJson(), Snap("T1").ToCanonicalJson());
        foreach (var path in new[] { DtoPath(), CatalogPath() })
        {
            var src = File.ReadAllText(path);
            Assert.DoesNotContain("DateTime.UtcNow", src);
            Assert.DoesNotContain("DateTime.Now", src);
            Assert.DoesNotContain("Guid.NewGuid", src);
            Assert.DoesNotContain("Random", src);
        }
    }

    [Fact]
    public void MalformedSourceHandling()
    {
        Assert.False(OptionalBusinessSnapshot.FromCanonicalJson("{").Report.IsObject);
        Assert.Equal("{}", OptionalBusinessSnapshot.FromCanonicalJson("{").ToCanonicalJson());
        Assert.Equal("{}", OptionalBusinessSnapshot.FromCanonicalJson(null).ToCanonicalJson());
        Assert.Equal("{}", OptionalBusinessSnapshot.FromCanonicalJson("not-json").ToCanonicalJson());
        Assert.Equal("{}", OptionalBusinessSnapshot.Parse(null).ToCanonicalJson());
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
        foreach (var t in new[] { typeof(OptionalBusinessSnapshot), typeof(OptionalBusinessSnapshotCatalog) })
        {
            Assert.Equal("Sirman.Core.Backup", t.Namespace);
        }
    }

    [Fact]
    public void StripsForbiddenKeys_IncludingPhonebookAndAttachments()
    {
        var mixed = JsonNode.Parse(Case("T1").GetProperty("expected").GetRawText())!.AsObject();
        mixed["phonebook"] = new JsonArray { new JsonObject { ["fn"] = "x" } };
        mixed["invoices"] = new JsonArray();
        mixed["attachmentsIndex"] = new JsonArray { new JsonObject { ["id"] = "x" } };
        mixed["printSettings"] = new JsonObject();
        mixed["localStorage"] = new JsonObject();
        var snap = OptionalBusinessSnapshot.Parse(mixed);
        Assert.Contains("phonebook", snap.Report.StrippedForbiddenKeys);
        Assert.Contains("attachmentsIndex", snap.Report.StrippedForbiddenKeys);
        Assert.Contains("invoices", snap.Report.StrippedForbiddenKeys);
        Assert.True(snap.Report.HasPhonebook);
        Assert.True(snap.Report.HasAttachmentsIndex);
        foreach (var key in OptionalBusinessSnapshotCatalog.ForbiddenKeys)
            Assert.False(snap.Data.ContainsKey(key), key);
        Assert.Equal("P-1", BackupJsonUtil.Str(snap.Products![0]!["code"]));
    }

    [Fact]
    public void RegressionLocks_OptionalSliceCutover()
    {
        Assert.Equal("html-backup-engine", JsonBackupRepository.TbdMarker);
        Assert.Equal(13, OptionalBusinessSnapshotCatalog.AllOptionalKeys.Count);
        Assert.Contains("phonebook", OptionalBusinessSnapshotCatalog.ForbiddenKeys);
        Assert.Contains("attachmentsIndex", OptionalBusinessSnapshotCatalog.ForbiddenKeys);
        Assert.DoesNotContain("phonebook", OptionalBusinessSnapshotCatalog.AllOptionalKeys);
        Assert.Contains("svcs", OptionalBusinessSnapshotCatalog.AllOptionalKeys);
        Assert.DoesNotContain("svcs", OptionalBusinessSnapshotCatalog.SourceGlobals);
        var html = File.ReadAllText(Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", "..", "Sirman_Final.html")));
        var build = ExtractFunction(html, "_buildFullBackupData");
        Assert.Contains("var o = collectOptionalBusinessSnapshot();", build);
        Assert.Single(System.Text.RegularExpressions.Regex.Matches(build, @"collectOptionalBusinessSnapshot\s*\(\s*\)"));
        Assert.Contains("var s = collectBackupSettingsSnapshot();", build);
        Assert.Contains("var b = collectRequiredBusinessSnapshot();", build);
        Assert.Contains("products: o.products", build);
        Assert.Contains("svcs: o.svcs", build);
        Assert.Contains("daqiWarehouse: o.daqiWarehouse", build);
        Assert.Contains("phonebook: _safeArr(phonebook)", build);
        Assert.Contains("collectAttachmentIndex(data)", build);
        Assert.Contains("return JSON.parse(JSON.stringify(data));", build);
        Assert.DoesNotContain("collectOptionalBusinessSnapshot()", ExtractFunction(html, "exportData"));
        Assert.DoesNotContain("collectOptionalBusinessSnapshot()", ExtractFunction(html, "buildBackupObject"));
        Assert.DoesNotContain("collectOptionalBusinessSnapshot()", ExtractFunction(html, "collectRequiredBusinessSnapshot"));
        Assert.Contains("1405.6.3α", build);
        var printHost = File.ReadAllText(Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", "Sirman.Desktop", "WindowsPrintHost.cs")));
        Assert.Contains("internal sealed class WindowsPrintHost", printHost);
        var sqlite = File.ReadAllText(Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", "Sirman.Persistence.Sqlite", "Sirman.Persistence.Sqlite.csproj")));
        Assert.Contains("Sirman.Persistence.Sqlite", sqlite);
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

    private static OptionalBusinessSnapshot Snap(string id) =>
        OptionalBusinessSnapshot.Parse(JsonNode.Parse(Case(id).GetProperty("expected").GetRawText()));

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
        var path = Path.Combine(AppContext.BaseDirectory, "OptionalBusinessFixtures.json");
        Assert.True(File.Exists(path), path);
        return JsonDocument.Parse(File.ReadAllText(path)).RootElement;
    }

    private static string DtoPath() =>
        Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", "Sirman.Core", "Backup", "OptionalBusinessSnapshot.cs"));

    private static string CatalogPath() =>
        Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", "Sirman.Core", "Backup", "OptionalBusinessSnapshotCatalog.cs"));
}
