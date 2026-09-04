using System.Text.Json;
using System.Text.Json.Nodes;
using Sirman.Core.Backup;
using Sirman.Core.Data.Repositories;
using Xunit;

namespace Sirman.Core.Tests;

/// <summary>
/// ARCH-9C — TEST-ONLY proof that the proposed JSON clone boundary isolates
/// a synthetic assembled snapshot. Does not replace production assembly.
/// Production clone-on-assemble is NOT implemented here.
/// </summary>
public class BackupSnapshotCloneTests
{
    private const string FrozenIso = "2023-11-14T22:13:20.000Z";
    private const string PersianName = "علی";
    private const string PersianShop = "فروشگاه سیرمان";

    [Fact]
    public void T1_InvoicesPush_DoesNotMutateOriginal()
    {
        var live = PopulatedAssembly();
        var before = BackupJsJson.Stringify(live);
        var originalCount = live["invoices"]!.AsArray().Count;
        var clone = ProposedJsonClone(live);

        clone["invoices"]!.AsArray().Add(new JsonObject { ["invoiceId"] = "INVUID-PUSHED" });

        Assert.Equal(originalCount, live["invoices"]!.AsArray().Count);
        Assert.Equal(before, BackupJsJson.Stringify(live));
        Assert.Equal(originalCount + 1, clone["invoices"]!.AsArray().Count);
        Assert.False(ReferenceEquals(live["invoices"], clone["invoices"]));
    }

    [Fact]
    public void T2_NestedRecordMutation_DoesNotMutateOriginal()
    {
        var live = PopulatedAssembly();
        var originalNested = live["invoices"]![0]!["someNested"]!["value"]!.GetValue<string>();
        Assert.Equal("original-nested", originalNested);

        var clone = ProposedJsonClone(live);
        clone["invoices"]![0]!["someNested"]!["value"] = "changed";

        Assert.Equal("original-nested", live["invoices"]![0]!["someNested"]!["value"]!.GetValue<string>());
        Assert.Equal("changed", clone["invoices"]![0]!["someNested"]!["value"]!.GetValue<string>());
        Assert.False(ReferenceEquals(live["invoices"]![0], clone["invoices"]![0]));
        Assert.False(ReferenceEquals(live["invoices"]![0]!["someNested"], clone["invoices"]![0]!["someNested"]));
    }

    [Fact]
    public void T3_Products_IsolatedAfterClone()
    {
        AssertArrayIsolated("products", "PRD-PUSHED");
    }

    [Fact]
    public void T4_Warranties_IsolatedAfterClone()
    {
        AssertArrayIsolated("warranties", "W-PUSHED");
    }

    [Fact]
    public void T5_Phonebook_IsolatedAfterClone()
    {
        var live = PopulatedAssembly();
        var clone = ProposedJsonClone(live);
        clone["phonebook"]![0]!["fn"] = "changed";
        clone["phonebook"]!.AsArray().Add(new JsonObject { ["fn"] = "جدید" });

        Assert.Equal(PersianName, live["phonebook"]![0]!["fn"]!.GetValue<string>());
        Assert.Single(live["phonebook"]!.AsArray());
        Assert.False(ReferenceEquals(live["phonebook"], clone["phonebook"]));
    }

    [Fact]
    public void T6_Parts_IsolatedAfterClone()
    {
        AssertArrayIsolated("parts", "PT-PUSHED");
    }

    [Fact]
    public void T7_Sales_IsolatedAfterClone()
    {
        AssertArrayIsolated("sales", "SALE-PUSHED");
    }

    [Fact]
    public void T8_Accounts_IsolatedAfterClone()
    {
        AssertArrayIsolated("accounts", "ACC-PUSHED");
    }

    [Fact]
    public void T9_NestedInventoryObject_IsolatedAfterClone()
    {
        var live = PopulatedAssembly();
        var clone = ProposedJsonClone(live);

        Assert.False(ReferenceEquals(live["inventory"], clone["inventory"]));
        Assert.False(ReferenceEquals(live["inventory"]!["SKU-1"], clone["inventory"]!["SKU-1"]));
        Assert.False(ReferenceEquals(live["inventory"]!["SKU-1"]!["nested"], clone["inventory"]!["SKU-1"]!["nested"]));

        clone["inventory"]!["SKU-1"]!["qty"] = 99;
        clone["inventory"]!["SKU-1"]!["nested"]!["bin"] = "CHANGED";
        clone["inventory"]!.AsObject()["SKU-NEW"] = new JsonObject { ["qty"] = 1 };

        Assert.Equal(4, live["inventory"]!["SKU-1"]!["qty"]!.GetValue<int>());
        Assert.Equal("A", live["inventory"]!["SKU-1"]!["nested"]!["bin"]!.GetValue<string>());
        Assert.False(live["inventory"]!.AsObject().ContainsKey("SKU-NEW"));
    }

    [Fact]
    public void T10_AttachmentRelatedData_IsolatedAfterClone()
    {
        var live = PopulatedAssembly();
        var clone = ProposedJsonClone(live);

        Assert.False(ReferenceEquals(live["attachmentsIndex"], clone["attachmentsIndex"]));
        Assert.False(ReferenceEquals(live["invoices"]![0]!["docs"], clone["invoices"]![0]!["docs"]));
        Assert.False(ReferenceEquals(live["invoices"]![0]!["docs"]![0], clone["invoices"]![0]!["docs"]![0]));

        clone["attachmentsIndex"]!.AsArray().Add(new JsonObject { ["id"] = "forged" });
        clone["invoices"]![0]!["docs"]![0]!["name"] = "changed.pdf";
        clone["invoices"]![0]!["docs"]!.AsArray().Add(new JsonObject { ["id"] = "doc-new" });

        Assert.Single(live["attachmentsIndex"]!.AsArray());
        Assert.Equal("فاکتور.pdf", live["invoices"]![0]!["docs"]![0]!["name"]!.GetValue<string>());
        Assert.Single(live["invoices"]![0]!["docs"]!.AsArray());
    }

    [Fact]
    public void T11_MultipleArraysMutatedAfterClone()
    {
        var live = PopulatedAssembly();
        var before = BackupJsJson.Stringify(live);
        var clone = ProposedJsonClone(live);

        foreach (var key in new[] { "invoices", "products", "warranties", "phonebook", "parts", "sales", "accounts" })
            clone[key]!.AsArray().Add(new JsonObject { ["id"] = "MUT-" + key });

        clone["tasks"]!.AsArray().Add(new JsonObject { ["id"] = "T-NEW" });

        Assert.Equal(before, BackupJsJson.Stringify(live));
        Assert.Empty(live["tasks"]!.AsArray());
        Assert.Single(clone["tasks"]!.AsArray());
        foreach (var key in new[] { "invoices", "products", "warranties", "phonebook", "parts", "sales", "accounts" })
            Assert.Single(live[key]!.AsArray());
    }

    [Fact]
    public void ReferenceIsolation_TopLevelArrays_NestedObjects_NestedArrays()
    {
        var live = PopulatedAssembly();
        var clone = ProposedJsonClone(live);

        foreach (var key in BackupSnapshotCatalog.Schema1RequiredCollections.Concat(new[] { "products", "phonebook", "tasks", "attachmentsIndex", "sections" }))
        {
            Assert.False(ReferenceEquals(live[key], clone[key]), key);
            Assert.True(live[key] is JsonArray, key);
        }

        Assert.False(ReferenceEquals(live["inventory"], clone["inventory"]));
        Assert.False(ReferenceEquals(live["printCenter"], clone["printCenter"]));
        Assert.False(ReferenceEquals(live["itemCounts"], clone["itemCounts"]));
        Assert.False(ReferenceEquals(live["appearance"], clone["appearance"]));

        Assert.False(ReferenceEquals(live["invoices"]![0], clone["invoices"]![0]));
        Assert.False(ReferenceEquals(live["invoices"]![0]!["someNested"], clone["invoices"]![0]!["someNested"]));
        Assert.False(ReferenceEquals(live["invoices"]![0]!["docs"], clone["invoices"]![0]!["docs"]));
        Assert.False(ReferenceEquals(live["warranties"]![0]!["docs"], clone["warranties"]![0]!["docs"]));
        Assert.False(ReferenceEquals(live["inventory"]!["SKU-1"]!["nested"], clone["inventory"]!["SKU-1"]!["nested"]));
    }

    [Fact]
    public void JsonClone_DoesNotRelySolelyOnStringifyEquality()
    {
        var live = PopulatedAssembly();
        var clone = ProposedJsonClone(live);
        Assert.Equal(BackupJsJson.Stringify(live), BackupJsJson.Stringify(clone));
        Assert.False(ReferenceEquals(live, clone));
        Assert.False(ReferenceEquals(live["invoices"], clone["invoices"]));
        Assert.False(ReferenceEquals(live["invoices"]![0], clone["invoices"]![0]));
    }

    [Fact]
    public void DataTypeSafety_CurrentSnapshotIsJsonOnly()
    {
        var kinds = new HashSet<JsonValueKind>();
        WalkKinds(PopulatedAssembly(), kinds);
        var allowed = new HashSet<JsonValueKind>
        {
            JsonValueKind.Object, JsonValueKind.Array, JsonValueKind.String,
            JsonValueKind.Number, JsonValueKind.True, JsonValueKind.False, JsonValueKind.Null
        };
        Assert.Subset(allowed, kinds);
        Assert.DoesNotContain(JsonValueKind.Undefined, kinds);

        var live = PopulatedAssembly();
        Assert.Equal(JsonValueKind.String, live["exportedAt"]!.GetValueKind());
        Assert.Equal(FrozenIso, live["exportedAt"]!.GetValue<string>());
        Assert.Contains(PersianName, BackupJsJson.Stringify(live), StringComparison.Ordinal);
    }

    [Fact]
    public void DataTypeSafety_HypotheticalNonJsonValues_AreNotInCurrentSnapshot()
    {
        // JsonNode cannot even serialize NaN/Infinity as JSON (STJ throws).
        // HTML JSON.stringify maps those to null. Neither form is present in the
        // current BackupSnapshot: Parse only accepts JSON text, and the populated
        // assembly walk below contains only finite numbers.
        Assert.Throws<ArgumentException>(() => BackupJsJson.Stringify(JsonValue.Create(double.NaN)));
        Assert.Throws<ArgumentException>(() => BackupJsJson.Stringify(JsonValue.Create(double.PositiveInfinity)));
        Assert.Throws<ArgumentException>(() => BackupJsJson.Stringify(JsonValue.Create(double.NegativeInfinity)));
        Assert.Equal("null", BackupJsJson.Stringify(JsonValue.Create((string?)null)));

        var kinds = new HashSet<JsonValueKind>();
        WalkKinds(PopulatedAssembly(), kinds);
        Assert.DoesNotContain(JsonValueKind.Undefined, kinds);
        foreach (var n in EnumerateNumbers(PopulatedAssembly()))
            Assert.True(double.IsFinite(n), "current snapshot number must be finite");
    }

    [Fact]
    public void ProposedMechanism_IsBackupJsonUtilCloneExact()
    {
        var live = PopulatedAssembly();
        var viaUtil = BackupJsonUtil.CloneExact(live);
        var viaParse = JsonNode.Parse(BackupJsJson.Stringify(live));
        Assert.Equal(BackupJsJson.Stringify(viaUtil), BackupJsJson.Stringify(viaParse));

        var snap = BackupSnapshot.Parse(live);
        Assert.Equal(BackupJsJson.Stringify(live), snap.ToCanonicalJson());
        Assert.False(ReferenceEquals(live, snap.Data));
    }

    [Fact]
    public void ClonedSnapshot_SatisfiesArch9BContract()
    {
        var live = PopulatedAssembly();
        var snap = BackupSnapshot.Parse(live);

        Assert.True(snap.Shape.HasAllBasePayloadKeys);
        Assert.Equal(49, BackupSnapshotCatalog.BasePayloadKeys.Count);
        Assert.True(snap.Shape.HasPrintCenter);
        Assert.True(snap.Shape.HasAttachmentsIndex);
        Assert.True(snap.Shape.IsTypical51KeySnapshot);
        Assert.True(snap.Shape.SectionsMatchCatalog || snap.Shape.Sections.Count == 33);
        Assert.Contains("printCenter", snap.Shape.Sections);
        Assert.False(snap.Shape.HasRuntimeHandles);
        Assert.Empty(snap.Shape.RuntimeHandleKeys);
        Assert.True(snap.Shape.PhonebookPresent);
        Assert.True(snap.Shape.PhonebookIsArray);

        foreach (var key in BackupSnapshotCatalog.Schema1RequiredCollections)
        {
            var arr = snap.ArrayCollection(key);
            Assert.NotNull(arr);
            Assert.NotEmpty(arr!);
        }

        Assert.NotNull(snap.ArrayCollection("tasks"));
        Assert.Empty(snap.ArrayCollection("tasks")!);

        foreach (var key in BackupSnapshotCatalog.ItemCountKeys)
            Assert.True(snap.ItemCounts.Data.ContainsKey(key), key);

        Assert.Equal(1, snap.ItemCounts.Data["invoices"]!.GetValue<int>());
        Assert.Equal(0, snap.ItemCounts.Data["tasks"]!.GetValue<int>());
        Assert.Equal(PersianName, snap.ArrayCollection("phonebook")![0]!["fn"]!.GetValue<string>());
        Assert.Contains(PersianShop, snap.ToCanonicalJson(), StringComparison.Ordinal);

        var validation = BackupValidator.Validate(snap.Data);
        Assert.True(validation.Ok, string.Join("; ", validation.Errors));
        Assert.True(BackupRequiredCollections.Validate(snap.Data).Ok);
        Assert.True(BackupStructuralValidator.ValidateItemCounts(snap.Data).Ok);
        Assert.Equal("html-backup-engine", JsonBackupRepository.TbdMarker);
    }

    [Fact]
    public void ProductionClone_IsAtAssemblyReturnBoundary()
    {
        var src = File.ReadAllText(HtmlPath());
        Assert.Contains("function _buildFullBackupData(){", src);
        Assert.Contains("invoices: _safeArr(invoices)", src);
        Assert.Contains("return JSON.parse(JSON.stringify(data));", src);
        Assert.DoesNotContain("JSON.parse(JSON.stringify(_safeArr", src);
        Assert.DoesNotContain("BackupJsonUtil.CloneExact", src);
        Assert.Contains("function _safeArr(a){ return Array.isArray(a)?a:[]; }", src);
        Assert.Contains("function _safeObj(o){ return (o && typeof o==='object')?o:{}; }", src);
        var build = ExtractBetween(src, "function _buildFullBackupData(){", "\nfunction buildBackupObject(){");
        Assert.Single(System.Text.RegularExpressions.Regex.Matches(build, @"return JSON\.parse\(JSON\.stringify\(data\)\);"));
        Assert.Contains("_buildFullBackupData()", ExtractBetween(src, "async function exportData(", "function exportSelected("));
        Assert.Contains("var d = _buildFullBackupData();", ExtractBetween(src, "function buildBackupObject(){", "async function attachChecksum("));
        Assert.Contains("_buildFullBackupData()", ExtractBetween(src, "function applyBackupSelective(", "function applyBackupMergeSections("));
    }

    private static void AssertArrayIsolated(string key, string pushedId)
    {
        var live = PopulatedAssembly();
        var before = BackupJsJson.Stringify(live[key]);
        var clone = ProposedJsonClone(live);
        clone[key]!.AsArray().Add(new JsonObject { ["id"] = pushedId });
        Assert.Equal(before, BackupJsJson.Stringify(live[key]));
        Assert.False(ReferenceEquals(live[key], clone[key]));
        Assert.Single(live[key]!.AsArray());
        Assert.Equal(2, clone[key]!.AsArray().Count);
    }

    /// <summary>
    /// Proposed semantic boundary from ARCH-9B: JSON-canonical stringify then parse.
    /// Test-only. Not wired into <c>_buildFullBackupData</c>.
    /// </summary>
    private static JsonObject ProposedJsonClone(JsonNode live)
    {
        var cloned = BackupJsonUtil.CloneExact(live);
        Assert.NotNull(cloned);
        Assert.IsType<JsonObject>(cloned);
        return (JsonObject)cloned!;
    }

    private static JsonObject PopulatedAssembly()
    {
        var node = FullBase();
        node["invoices"] = A(new JsonObject
        {
            ["id"] = "INV-1",
            ["invoiceId"] = "INVUID-000001",
            ["num"] = "۱۲",
            ["someNested"] = new JsonObject { ["value"] = "original-nested" },
            ["docs"] = A(new JsonObject
            {
                ["id"] = "doc-inv-1",
                ["name"] = "فاکتور.pdf",
                ["data"] = "idb:att-1"
            })
        });
        node["products"] = A(new JsonObject
        {
            ["id"] = "PRD-1",
            ["name"] = "کالا",
            ["nested"] = new JsonObject { ["sku"] = "S1" }
        });
        node["warranties"] = A(new JsonObject
        {
            ["id"] = "W-1",
            ["title"] = "گارانتی",
            ["nested"] = new JsonObject { ["serial"] = "SN1" },
            ["docs"] = A(new JsonObject { ["id"] = "doc-w-1", ["name"] = "w.pdf", ["data"] = "idb:att-w" })
        });
        node["phonebook"] = A(new JsonObject
        {
            ["id"] = "PB-1",
            ["fn"] = PersianName,
            ["ln"] = "رضایی",
            ["shop"] = PersianShop
        });
        node["parts"] = A(new JsonObject
        {
            ["id"] = "PT-1",
            ["name"] = "قطعه",
            ["nested"] = new JsonObject { ["bin"] = "B1" }
        });
        node["sales"] = A(new JsonObject
        {
            ["id"] = "SALE-1",
            ["saleUid"] = "SALEUID-000001",
            ["nested"] = new JsonObject { ["total"] = 10 },
            ["docs"] = A(new JsonObject { ["id"] = "doc-s-1", ["name"] = "s.pdf", ["data"] = "disk:att-s" })
        });
        node["accounts"] = A(new JsonObject
        {
            ["id"] = "ACC-1",
            ["name"] = "صندوق",
            ["nested"] = new JsonObject { ["bal"] = 100 }
        });
        node["services"] = A(new JsonObject { ["id"] = "SVC-1", ["name"] = "خدمت" });
        node["svcs"] = A(new JsonObject { ["id"] = "SVC-1", ["name"] = "خدمت" });
        node["inventory"] = new JsonObject
        {
            ["SKU-1"] = new JsonObject
            {
                ["qty"] = 4,
                ["nested"] = new JsonObject { ["bin"] = "A" }
            }
        };
        node["printCenter"] = new JsonObject
        {
            ["enabled"] = true,
            ["nested"] = new JsonObject { ["printer"] = "HP" }
        };
        node["attachmentsIndex"] = A(new JsonObject
        {
            ["id"] = "doc-inv-1",
            ["name"] = "فاکتور.pdf",
            ["ref"] = "idb:att-1",
            ["inline"] = false,
            ["kind"] = "invoice",
            ["parentId"] = "INV-1"
        });
        var sections = node["sections"]!.AsArray();
        if (!sections.Any(x => x?.GetValue<string>() == "printCenter"))
            sections.Add("printCenter");
        Recount(node);
        return node;
    }

    private static JsonObject FullBase()
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

    private static JsonArray A(params JsonObject[] items)
    {
        var a = new JsonArray();
        foreach (var item in items)
            a.Add(item.DeepClone());
        return a;
    }

    private static void WalkKinds(JsonNode? n, HashSet<JsonValueKind> kinds)
    {
        if (n is null)
        {
            kinds.Add(JsonValueKind.Null);
            return;
        }
        kinds.Add(n.GetValueKind());
        if (n is JsonObject obj)
        {
            foreach (var kv in obj)
                WalkKinds(kv.Value, kinds);
        }
        else if (n is JsonArray arr)
        {
            foreach (var item in arr)
                WalkKinds(item, kinds);
        }
    }

    private static IEnumerable<double> EnumerateNumbers(JsonNode? n)
    {
        if (n is null) yield break;
        if (n.GetValueKind() == JsonValueKind.Number && n is JsonValue jv && jv.TryGetValue<double>(out var d))
            yield return d;
        if (n is JsonObject obj)
        {
            foreach (var kv in obj)
            {
                foreach (var x in EnumerateNumbers(kv.Value))
                    yield return x;
            }
        }
        else if (n is JsonArray arr)
        {
            foreach (var item in arr)
            {
                foreach (var x in EnumerateNumbers(item))
                    yield return x;
            }
        }
    }

    private static string HtmlPath() =>
        Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", "..", "Sirman_Final.html"));

    private static string ExtractBetween(string src, string startToken, string endToken)
    {
        var start = src.IndexOf(startToken, StringComparison.Ordinal);
        var end = src.IndexOf(endToken, StringComparison.Ordinal);
        Assert.True(start >= 0 && end > start, startToken + " .. " + endToken);
        return src.Substring(start, end - start);
    }
}
