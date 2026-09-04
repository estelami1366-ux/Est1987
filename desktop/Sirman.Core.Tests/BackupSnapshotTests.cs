using System.Text.Json;
using System.Text.Json.Nodes;
using Sirman.Core.Backup;
using Sirman.Core.Data.Repositories;
using Xunit;

namespace Sirman.Core.Tests;

/// <summary>
/// ARCH-9B — BackupSnapshot is a transport contract. No live adapter. HTML assembly unchanged.
/// </summary>
public class BackupSnapshotTests
{
    private const string FrozenIso = "2023-11-14T22:13:20.000Z";

    [Fact]
    public void T1_MinimalValidSchema1FullSnapshot()
    {
        var snap = BackupSnapshot.Parse(FullBase());
        Assert.True(snap.Shape.HasAllBasePayloadKeys);
        Assert.Equal(49, BackupSnapshotCatalog.BasePayloadKeys.Count);
        Assert.Equal(49, snap.Shape.PresentKeyCount);
        Assert.False(snap.Shape.HasPrintCenter);
        Assert.False(snap.Metadata.IsFinalizedPackage);
        Assert.True(BackupValidator.Validate(snap.Data).Ok);
        foreach (var key in BackupSnapshotCatalog.Schema1RequiredCollections)
            Assert.True(snap.ArrayCollection(key) is JsonArray);
    }

    [Fact]
    public void T2_EmptyRequiredArrays_AreValid()
    {
        var snap = BackupSnapshot.Parse(FullBase());
        foreach (var key in BackupSnapshotCatalog.Schema1RequiredCollections)
        {
            var arr = snap.ArrayCollection(key);
            Assert.NotNull(arr);
            Assert.Empty(arr!);
        }
        Assert.True(BackupRequiredCollections.Validate(snap.Data).Ok);
    }

    [Fact]
    public void T3_PopulatedRequiredArrays_AreValid()
    {
        var node = FullBase();
        node["invoices"] = A(Obj("invoiceId", "INVUID-000001"));
        node["warranties"] = A(Obj("id", "W1"));
        node["sales"] = A(Obj("saleUid", "SALEUID-000001"));
        node["parts"] = A(Obj("id", "P1"));
        node["accounts"] = A(Obj("id", "A1"));
        Recount(node);
        var snap = BackupSnapshot.Parse(node);
        Assert.Single(snap.ArrayCollection("invoices")!);
        Assert.True(BackupValidator.Validate(snap.Data).Ok);
        Assert.True(BackupStructuralValidator.ValidateItemCounts(snap.Data).Ok);
    }

    [Fact]
    public void T4_MissingWarranties_IsInvalid()
    {
        AssertMissingRequired("warranties");
    }

    [Fact]
    public void T5_MissingInvoices_IsInvalid()
    {
        AssertMissingRequired("invoices");
    }

    [Fact]
    public void T6_MissingSales_Schema1_IsInvalid()
    {
        AssertMissingRequired("sales");
    }

    [Fact]
    public void T7_MissingParts_Schema1_IsInvalid()
    {
        AssertMissingRequired("parts");
    }

    [Fact]
    public void T8_MissingAccounts_Schema1_IsInvalid()
    {
        AssertMissingRequired("accounts");
    }

    [Fact]
    public void T9_Schema0_WarrantiesAndInvoicesOnly()
    {
        var node = JsonNode.Parse("{\"warranties\":[],\"invoices\":[]}")!.AsObject();
        var snap = BackupSnapshot.Parse(node);
        Assert.False(snap.Metadata.SchemaVersionPresent);
        Assert.Equal(0, BackupRequiredCollections.InferSchemaVersion(snap.Data));
        var req = BackupRequiredCollections.Validate(snap.Data);
        Assert.True(req.Ok);
        Assert.DoesNotContain("sales", req.RequiredKeys);
    }

    [Fact]
    public void T10_ValidItemCounts()
    {
        var snap = BackupSnapshot.Parse(FullBase());
        Assert.True(snap.ItemCounts.Present);
        Assert.Equal(BackupSnapshotCatalog.ItemCountKeys, snap.ItemCounts.DeclaredKeys);
        Assert.True(BackupStructuralValidator.ValidateItemCounts(snap.Data).Ok);
    }

    [Fact]
    public void T11_ItemCountsMismatch_IsInvalid()
    {
        var node = FullBase();
        node["itemCounts"]!.AsObject()["invoices"] = 9;
        var result = BackupStructuralValidator.ValidateItemCounts(node);
        Assert.False(result.Ok);
        Assert.Contains(result.CountMismatches, k => k == "invoices");
    }

    [Fact]
    public void T12_ValidSectionsCatalog()
    {
        var snap = BackupSnapshot.Parse(FullBase());
        Assert.True(snap.Shape.SectionsMatchCatalog);
        Assert.Equal(32, BackupSnapshotCatalog.SectionsCatalog.Count);
        Assert.Equal(BackupSnapshotCatalog.SectionsCatalog, snap.Shape.Sections);
        Assert.DoesNotContain("warehouseDocs", BackupSnapshotCatalog.SectionsCatalog);
        Assert.DoesNotContain("prefs", BackupSnapshotCatalog.SectionsCatalog);
    }

    [Fact]
    public void T13_OptionalPrintCenterAbsent()
    {
        var snap = BackupSnapshot.Parse(FullBase());
        Assert.False(snap.Shape.HasPrintCenter);
        Assert.Null(snap.Collection("printCenter"));
        Assert.True(BackupValidator.Validate(snap.Data).Ok);
    }

    [Fact]
    public void T14_OptionalAttachmentsIndexAbsent()
    {
        var snap = BackupSnapshot.Parse(FullBase());
        Assert.False(snap.Shape.HasAttachmentsIndex);
        Assert.Null(snap.Collection("attachmentsIndex"));
        Assert.True(BackupStructuralValidator.ValidateAttachmentIndex(snap.Data).Ok);
    }

    [Fact]
    public void T15_All49BaseKeysRepresented()
    {
        Assert.Equal(49, BackupSnapshotCatalog.BasePayloadKeys.Count);
        var snap = BackupSnapshot.Parse(FullBase());
        Assert.True(snap.Shape.HasAllBasePayloadKeys);
        Assert.Empty(snap.Shape.MissingBaseKeys);
        foreach (var key in BackupSnapshotCatalog.BasePayloadKeys)
            Assert.True(snap.Data.ContainsKey(key), key);
        Assert.False(snap.Data.ContainsKey("origin"));
        Assert.False(snap.Data.ContainsKey("backupId"));
    }

    [Fact]
    public void T16_Typical51KeySnapshot()
    {
        var node = FullBase();
        node["printCenter"] = new JsonObject();
        node["attachmentsIndex"] = new JsonArray();
        var snap = BackupSnapshot.Parse(node);
        Assert.True(snap.Shape.HasAllBasePayloadKeys);
        Assert.True(snap.Shape.HasPrintCenter);
        Assert.True(snap.Shape.HasAttachmentsIndex);
        Assert.Equal(51, snap.Shape.PresentKeyCount);
        Assert.True(snap.Shape.IsTypical51KeySnapshot);
        Assert.True(BackupValidator.Validate(snap.Data).Ok);
    }

    [Fact]
    public void T17_PersianUnicode_RoundTrip()
    {
        var node = FullBase();
        node["phonebook"] = A(new JsonObject { ["fn"] = "علی", ["ln"] = "رضایی", ["shop"] = "فروشگاه سیرمان" });
        node["invoices"] = A(new JsonObject { ["invoiceId"] = "INVUID-000001", ["num"] = "۱۲" });
        Recount(node);
        var snap = BackupSnapshot.Parse(node);
        var json = snap.ToCanonicalJson();
        Assert.Contains("علی", json, StringComparison.Ordinal);
        var again = BackupSnapshot.FromCanonicalJson(json);
        Assert.Equal(json, again.ToCanonicalJson());
        Assert.Equal("علی", BackupJsonUtil.Str(again.ArrayCollection("phonebook")![0]!.AsObject()["fn"]));
    }

    [Fact]
    public void T18_Phonebook_IsPayloadOnly()
    {
        Assert.True(BackupSnapshotCatalog.IsPhonebookIdentityExcluded);
        Assert.Equal("", BackupRestorePlanBuilder.IdentityKey("phonebook"));
        var node = FullBase();
        node["phonebook"] = A(Obj("phones", "0912"));
        Recount(node);
        var snap = BackupSnapshot.Parse(node);
        Assert.True(snap.Shape.PhonebookPresent);
        Assert.True(snap.Shape.PhonebookIsArray);
        var plan = BackupRestorePlanBuilder.Build(snap.Data, FullBase(), RestorePlanMode.Merge, new[] { "phonebook" }, 1700000000000);
        var pb = plan.Sections.Single(s => s.Name == "phonebook");
        Assert.True(pb.Excluded);
        Assert.Equal(RestorePlanAction.NoAction, pb.Action);
    }

    [Fact]
    public void RoundTrip_SemanticEquivalence()
    {
        var original = FullBase();
        original["origin"] = "manual";
        var before = BackupJsJson.Stringify(original);
        var snap = BackupSnapshot.Parse(original);
        Assert.Equal(before, BackupJsJson.Stringify(original));
        var json = snap.ToCanonicalJson();
        var again = BackupSnapshot.FromCanonicalJson(json);
        Assert.Equal(json, again.ToCanonicalJson());
        Assert.Equal("manual", again.Metadata.Origin);
        Assert.True(again.Metadata.OriginPresent);
    }

    [Fact]
    public void InputImmutability_And_NoLiveHandles()
    {
        var node = FullBase();
        var before = BackupJsJson.Stringify(node);
        var snap = BackupSnapshot.Parse(node);
        snap.Data["invoices"]!.AsArray().Add(Obj("invoiceId", "X"));
        Assert.Equal(before, BackupJsJson.Stringify(node));
        Assert.False(snap.Shape.HasRuntimeHandles);
        var src = File.ReadAllText(SnapshotPath());
        Assert.DoesNotContain("localStorage", src);
        Assert.DoesNotContain("IndexedDB", src);
        Assert.DoesNotContain("sirmanHost", src);
        Assert.DoesNotContain("_buildFullBackupData", src);
    }

    [Fact]
    public void FinalizedMetadata_IsDistinctFromAssembly()
    {
        foreach (var k in BackupSnapshotCatalog.FinalizedMetadataKeys)
            Assert.DoesNotContain(k, BackupSnapshotCatalog.BasePayloadKeys);
        var raw = BackupSnapshot.Parse(FullBase());
        Assert.False(raw.Metadata.IsFinalizedPackage);
        var finalized = BackupFinalizer.FinalizePackage(FullBase(), "manual", "full");
        Assert.True(finalized.Ok);
        var snap = BackupSnapshot.Parse(finalized.Data);
        Assert.True(snap.Metadata.HasManifest);
        Assert.True(snap.Metadata.HasSectionChecksums);
        Assert.True(snap.Metadata.IsFinalizedPackage);
        Assert.False(snap.Metadata.HasChecksum);
    }

    [Fact]
    public void GoldenContract_MatchesCatalog()
    {
        var path = Path.Combine(AppContext.BaseDirectory, "BackupSnapshotGolden.json");
        Assert.True(File.Exists(path));
        using var doc = JsonDocument.Parse(File.ReadAllText(path));
        var root = doc.RootElement;
        Assert.Equal(49, root.GetProperty("counts").GetProperty("basePayloadKeys").GetInt32());
        Assert.Equal(51, root.GetProperty("counts").GetProperty("typicalSnapshotKeys").GetInt32());
        Assert.Equal(32, root.GetProperty("counts").GetProperty("sectionsCatalog").GetInt32());
        Assert.Equal(15, root.GetProperty("counts").GetProperty("itemCountKeys").GetInt32());
        AssertEqualList(root.GetProperty("basePayloadKeys"), BackupSnapshotCatalog.BasePayloadKeys);
        AssertEqualList(root.GetProperty("sectionsCatalog"), BackupSnapshotCatalog.SectionsCatalog);
        AssertEqualList(root.GetProperty("itemCountKeys"), BackupSnapshotCatalog.ItemCountKeys);
        Assert.True(root.GetProperty("phonebookPayloadOnly").GetBoolean());
    }

    [Fact]
    public void Catalog_DoesNotExpandSectionsOrItemCounts()
    {
        Assert.Equal(32, BackupSnapshotCatalog.SectionsCatalog.Count);
        Assert.Equal(15, BackupSnapshotCatalog.ItemCountKeys.Count);
        Assert.Contains("warehouseDocs", BackupSnapshotCatalog.BasePayloadKeys);
        Assert.DoesNotContain("warehouseDocs", BackupSnapshotCatalog.SectionsCatalog);
        Assert.DoesNotContain("warehouseDocs", BackupSnapshotCatalog.ItemCountKeys);
        Assert.Contains("svcs", BackupSnapshotCatalog.BasePayloadKeys);
        Assert.DoesNotContain("svcs", BackupSnapshotCatalog.SectionsCatalog);
        Assert.Equal("html-backup-engine", JsonBackupRepository.TbdMarker);
    }

    [Fact]
    public void Types_DoNotReferenceBrowserApis()
    {
        foreach (var t in new[] { typeof(BackupSnapshot), typeof(BackupSnapshotCatalog) })
        {
            Assert.Equal("Sirman.Core.Backup", t.Namespace);
            foreach (var p in t.GetMethods().SelectMany(m => m.GetParameters()))
            {
                var n = p.ParameterType.FullName ?? "";
                Assert.DoesNotContain("System.Windows", n);
                Assert.DoesNotContain("WebView2", n);
            }
        }
    }

    private static void AssertMissingRequired(string key)
    {
        var node = FullBase();
        node.Remove(key);
        var req = BackupRequiredCollections.Validate(node);
        Assert.False(req.Ok);
        Assert.Contains(key, req.MissingRequiredCollections);
        Assert.Contains(req.Errors, e => e.Contains("MISSING", StringComparison.Ordinal));
    }

    private static void AssertEqualList(JsonElement arr, IReadOnlyList<string> expected)
    {
        var got = arr.EnumerateArray().Select(x => x.GetString()!).ToList();
        Assert.Equal(expected, got);
    }

    private static JsonObject FullBase()
    {
        var counts = new JsonObject();
        foreach (var k in BackupSnapshotCatalog.ItemCountKeys)
            counts[k] = 0;
        var sections = new JsonArray();
        foreach (var s in BackupSnapshotCatalog.SectionsCatalog)
            sections.Add(s);
        var o = new JsonObject
        {
            ["magic"] = BackupSnapshotCatalog.Magic,
            ["schemaVersion"] = BackupSnapshotCatalog.AppSchemaVersion,
            ["version"] = "1405.6.3α",
            ["applicationVersion"] = "1405.6.3α",
            ["exportedAt"] = FrozenIso,
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
        return o;
    }

    private static void Recount(JsonObject node)
    {
        var ic = node["itemCounts"]!.AsObject();
        foreach (var k in BackupSnapshotCatalog.ItemCountKeys)
        {
            if (node[k] is JsonArray arr)
                ic[k] = arr.Count;
        }
    }

    private static JsonObject Obj(string key, string value) => new() { [key] = value };

    private static JsonArray A(params JsonObject[] items)
    {
        var a = new JsonArray();
        foreach (var item in items)
            a.Add(item.DeepClone());
        return a;
    }

    private static string SnapshotPath() =>
        Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", "Sirman.Core", "Backup", "BackupSnapshot.cs"));
}
