using System.Text.Json;
using System.Text.Json.Nodes;
using Sirman.Core.Backup;
using Sirman.Core.Data.Repositories;
using Xunit;

namespace Sirman.Core.Tests;

/// <summary>
/// ARCH-19 — AttachmentReferenceSnapshot is a forensic transport of attachmentsIndex.
/// HTML collectAttachmentIndex remains the production walker. No live cutover.
/// </summary>
public class AttachmentReferenceSnapshotTests
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
    [InlineData("T11")]
    [InlineData("T12")]
    [InlineData("T13")]
    [InlineData("T14")]
    public void GoldenFixture_HtmlExpected_MatchesCoreDto(string id)
    {
        var expected = Case(id).GetProperty("expectedIndex");
        var node = JsonNode.Parse(expected.GetRawText())!;
        var wrap = new JsonObject { [AttachmentReferenceSnapshotCatalog.IndexKey] = BackupJsonUtil.CloneExact(node) };
        var before = BackupJsJson.Stringify(wrap);
        var snap = AttachmentReferenceSnapshot.Parse(wrap);
        Assert.Equal(before, BackupJsJson.Stringify(wrap));
        Assert.Equal(before, snap.ToCanonicalJson());
        var fromArr = AttachmentReferenceSnapshot.Parse(JsonNode.Parse(expected.GetRawText()));
        Assert.Equal(snap.ToCanonicalJson(), fromArr.ToCanonicalJson());
        foreach (var key in AttachmentReferenceSnapshotCatalog.ForbiddenKeys)
            Assert.False(snap.Data.ContainsKey(key), id + " " + key);
        Assert.False(snap.Data.ContainsKey("phonebook"), id);
    }

    [Fact]
    public void T1_EmptyIndex()
    {
        Assert.Empty(Snap("T1").Items);
    }

    [Fact]
    public void T2_WarrantyParentIsRecId()
    {
        var row = Snap("T2").Items[0]!.AsObject();
        Assert.Equal("warranty", BackupJsonUtil.Str(row["kind"]));
        Assert.Equal("W-1", BackupJsonUtil.Str(row["parentId"]));
        Assert.Equal("WD-1", BackupJsonUtil.Str(row["id"]));
        Assert.Equal("disk://sirman_media/docs/wdoc_1_a.pdf", BackupJsonUtil.Str(row["ref"]));
        Assert.False(row["inline"]!.GetValue<bool>());
    }

    [Fact]
    public void T3_InvoiceParentIsRecId_NotInvoiceId()
    {
        var row = Snap("T3").Items[0]!.AsObject();
        Assert.Equal("invoice", BackupJsonUtil.Str(row["kind"]));
        Assert.Equal("mig_inv_0_1", BackupJsonUtil.Str(row["parentId"]));
        Assert.NotEqual("INVUID-000012", BackupJsonUtil.Str(row["parentId"]));
        Assert.NotEqual("12", BackupJsonUtil.Str(row["parentId"]));
    }

    [Fact]
    public void T4_SaleParentIsDisplayId_NotSaleUid()
    {
        var row = Snap("T4").Items[0]!.AsObject();
        Assert.Equal("sale", BackupJsonUtil.Str(row["kind"]));
        Assert.Equal("SL-0001", BackupJsonUtil.Str(row["parentId"]));
        Assert.NotEqual("SALEUID-000007", BackupJsonUtil.Str(row["parentId"]));
    }

    [Fact]
    public void T5_WalkOrderWarrantiesThenSalesThenInvoices()
    {
        var kinds = Snap("T5").Items.Select(n => BackupJsonUtil.Str(n!["kind"])).ToArray();
        Assert.Equal(new[] { "warranty", "warranty", "warranty", "sale", "invoice" }, kinds);
    }

    [Fact]
    public void T6_OrphanFailsExistingValidator_NoRepair()
    {
        var input = JsonNode.Parse(Case("T6").GetProperty("validatorInput").GetRawText());
        var result = BackupStructuralValidator.ValidateAttachmentIndex(input);
        Assert.False(result.Ok);
        Assert.Contains(result.BrokenAttachmentRefs, b => b.ParentId == "W-MISSING");
        Assert.Equal("W-LIVE", BackupJsonUtil.Str(Snap("T6").Items[0]!["parentId"]));
    }

    [Fact]
    public void T7_UnsupportedKindSkippedByValidator_NotIndexedByWalker()
    {
        Assert.Empty(Snap("T7").Items);
        var input = JsonNode.Parse(Case("T7").GetProperty("validatorInput").GetRawText());
        var result = BackupStructuralValidator.ValidateAttachmentIndex(input);
        Assert.True(result.Ok);
        Assert.Empty(result.BrokenAttachmentRefs);
    }

    [Fact]
    public void T8_MissingRecId_ParentIdEmpty_NotInvoiceId()
    {
        var row = Snap("T8").Items[0]!.AsObject();
        Assert.Equal("", BackupJsonUtil.Str(row["parentId"]));
        var input = JsonNode.Parse(Case("T8").GetProperty("validatorInput").GetRawText());
        Assert.True(BackupStructuralValidator.ValidateAttachmentIndex(input).Ok);
    }

    [Fact]
    public void T9_DuplicateAttachmentIdsPreserved()
    {
        Assert.Equal("SAME", BackupJsonUtil.Str(Snap("T9").Items[0]!["id"]));
        Assert.Equal("SAME", BackupJsonUtil.Str(Snap("T9").Items[1]!["id"]));
        Assert.Equal("one.pdf", BackupJsonUtil.Str(Snap("T9").Items[0]!["name"]));
        Assert.Equal("two.pdf", BackupJsonUtil.Str(Snap("T9").Items[1]!["name"]));
    }

    [Fact]
    public void T10_ExternalStoreRefs_NoBinaryCopied()
    {
        var snap = Snap("T10");
        Assert.Equal("disk://sirman_media/docs/a.pdf", BackupJsonUtil.Str(snap.Items[0]!["ref"]));
        Assert.Equal("idb:blob-1", BackupJsonUtil.Str(snap.Items[1]!["ref"]));
        Assert.Equal("", BackupJsonUtil.Str(snap.Items[2]!["ref"]));
        Assert.True(snap.Items[2]!["inline"]!.GetValue<bool>());
        Assert.False(snap.Items[3]!["inline"]!.GetValue<bool>());
        var json = snap.ToCanonicalJson();
        Assert.DoesNotContain("data:image/png;base64,CCC", json, StringComparison.Ordinal);
        Assert.True(snap.Report.BinaryPayloadExcluded);
    }

    [Fact]
    public void T11_PhonebookNeverAppears()
    {
        Assert.Empty(Snap("T11").Items);
        Assert.False(Snap("T11").Data.ContainsKey("phonebook"));
    }

    [Fact]
    public void T12_PersianUnicode_RoundTrip()
    {
        var json = Snap("T12").ToCanonicalJson();
        Assert.Contains("رسید «پره» لایق الکترونیک پارسیان.pdf", json, StringComparison.Ordinal);
        Assert.Equal(json, AttachmentReferenceSnapshot.FromCanonicalJson(json).ToCanonicalJson());
    }

    [Fact]
    public void T13_NestedDocsObjectWalked_NestedAgencyNotIndexed()
    {
        var snap = Snap("T13");
        Assert.Equal(2, snap.Items.Count);
        Assert.Equal("بارنامه.pdf", BackupJsonUtil.Str(snap.Items[0]!["name"]));
        Assert.Equal("وضعیت.jpg", BackupJsonUtil.Str(snap.Items[1]!["name"]));
        var json = snap.ToCanonicalJson();
        Assert.DoesNotContain("NOT-INDEXED.pdf", json, StringComparison.Ordinal);
        Assert.DoesNotContain("device.jpg", json, StringComparison.Ordinal);
    }

    [Fact]
    public void T14_ExactOrdering()
    {
        var snap = Snap("T14");
        Assert.Equal(14, snap.Items.Count);
        Assert.Equal("W-ORD-00", BackupJsonUtil.Str(snap.Items[0]!["parentId"]));
        Assert.Equal("W-ORD-07", BackupJsonUtil.Str(snap.Items[7]!["parentId"]));
        Assert.Equal("SL-ORD-0000", BackupJsonUtil.Str(snap.Items[8]!["parentId"]));
        Assert.Equal("INV-ORD-2", BackupJsonUtil.Str(snap.Items[13]!["parentId"]));
    }

    [Fact]
    public void CoreWalker_MatchesHtmlExpectedIndex()
    {
        foreach (var id in new[] { "T1", "T2", "T3", "T4", "T5", "T8", "T9", "T10", "T12", "T13", "T14" })
        {
            var bag = JsonNode.Parse(Case(id).GetProperty("bag").GetRawText());
            var core = BackupSchemaMigrations.CollectAttachmentIndex(bag);
            var html = Case(id).GetProperty("expectedIndex").GetRawText();
            var htmlExpected = BackupJsJson.Stringify(JsonNode.Parse(html));
            var coreJson = BackupJsJson.Stringify(core);
            Assert.True(htmlExpected == coreJson, id);
        }
    }

    [Fact]
    public void NestedObjectIsolation_DoesNotMutateInput()
    {
        var wrap = JsonNode.Parse(Case("T2").GetProperty("expectedIndex").GetRawText())!.AsArray();
        var obj = new JsonObject { ["attachmentsIndex"] = BackupJsonUtil.CloneExact(wrap) };
        var before = BackupJsJson.Stringify(obj);
        var snap = AttachmentReferenceSnapshot.Parse(obj);
        snap.Items[0]!["name"] = "mutated";
        Assert.Equal(before, BackupJsJson.Stringify(obj));
        var copy = snap.ToJson();
        copy["attachmentsIndex"]![0]!["name"] = "again";
        Assert.Equal("mutated", BackupJsonUtil.Str(snap.Items[0]!["name"]));
    }

    [Fact]
    public void StripsForbiddenKeys_IncludingPhonebook()
    {
        var mixed = new JsonObject
        {
            ["attachmentsIndex"] = BackupJsonUtil.CloneExact(JsonNode.Parse(Case("T2").GetProperty("expectedIndex").GetRawText())),
            ["phonebook"] = new JsonArray { new JsonObject { ["fn"] = "x" } },
            ["invoices"] = new JsonArray()
        };
        var snap = AttachmentReferenceSnapshot.Parse(mixed);
        Assert.Contains("phonebook", snap.Report.StrippedForbiddenKeys);
        Assert.True(snap.Report.HasPhonebook);
        Assert.False(snap.Data.ContainsKey("phonebook"));
        Assert.Equal("W-1", BackupJsonUtil.Str(snap.Items[0]!["parentId"]));
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
            Assert.DoesNotContain("DateTime.UtcNow", src);
            Assert.DoesNotContain("Guid.NewGuid", src);
        }
    }

    [Fact]
    public void RegressionLocks_NoLiveCutover()
    {
        Assert.Equal("html-backup-engine", JsonBackupRepository.TbdMarker);
        Assert.Equal("id", AttachmentReferenceSnapshotCatalog.ParentIdentityField);
        Assert.Equal(new[] { "warranty", "sale", "invoice" }, AttachmentReferenceSnapshotCatalog.WalkKinds);
        Assert.Contains("phonebook", AttachmentReferenceSnapshotCatalog.UnwalkedCollections);
        Assert.Contains("stockMoves.refDoc", AttachmentReferenceSnapshotCatalog.IndependentReferenceSystems);
        Assert.Contains("daqi.agencyPhonebookIdx", AttachmentReferenceSnapshotCatalog.IndependentReferenceSystems);
        var html = File.ReadAllText(Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", "..", "Sirman_Final.html")));
        Assert.DoesNotContain("AttachmentReferenceSnapshot", ExtractFunction(html, "_buildFullBackupData"));
        Assert.DoesNotContain("collectAttachmentReferenceSnapshot", html);
        Assert.Contains("1405.6.3α", ExtractFunction(html, "_buildFullBackupData"));
        Assert.Contains("parentId: parentId || ''", ExtractFunction(html, "collectAttachmentIndex"));
        Assert.Contains("walk(d && d.warranties, 'warranty')", ExtractFunction(html, "collectAttachmentIndex"));
        Assert.DoesNotContain("invoiceId", ExtractFunction(html, "collectAttachmentIndex"));
        Assert.DoesNotContain("saleUid", ExtractFunction(html, "collectAttachmentIndex"));
        Assert.DoesNotContain("phonebook", ExtractFunction(html, "collectAttachmentIndex"));
        Assert.DoesNotContain("d.attachmentsIndex", ExtractFunction(html, "applyBackupReplaceSections"));
        Assert.DoesNotContain("d.attachmentsIndex", ExtractFunction(html, "applyBackupMergeSections"));
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

    private static AttachmentReferenceSnapshot Snap(string id) =>
        AttachmentReferenceSnapshot.Parse(JsonNode.Parse(Case(id).GetProperty("expectedIndex").GetRawText()));

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
        var path = Path.Combine(AppContext.BaseDirectory, "AttachmentReferenceFixtures.json");
        Assert.True(File.Exists(path), path);
        return JsonDocument.Parse(File.ReadAllText(path)).RootElement;
    }

    private static string DtoPath() =>
        Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", "Sirman.Core", "Backup", "AttachmentReferenceSnapshot.cs"));

    private static string CatalogPath() =>
        Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", "Sirman.Core", "Backup", "AttachmentReferenceSnapshotCatalog.cs"));
}
