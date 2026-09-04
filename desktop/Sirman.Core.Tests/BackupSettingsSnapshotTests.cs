using System.Text.Json;
using System.Text.Json.Nodes;
using Sirman.Core.Backup;
using Sirman.Core.Data.Repositories;
using Xunit;

namespace Sirman.Core.Tests;

/// <summary>
/// ARCH-14 — BackupSettingsSnapshot is a pure settings transport DTO.
/// HTML adapter is the LS reader. No live backup cutover.
/// </summary>
public class BackupSettingsSnapshotTests
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
    [InlineData("T15")]
    [InlineData("T16")]
    [InlineData("T17")]
    [InlineData("T18")]
    public void GoldenFixture_HtmlExpected_MatchesCoreDto(string id)
    {
        var expected = Case(id).GetProperty("expected");
        var node = JsonNode.Parse(expected.GetRawText())!.AsObject();
        var before = BackupJsJson.Stringify(node);
        var snap = BackupSettingsSnapshot.Parse(node);
        Assert.Equal(before, BackupJsJson.Stringify(node));
        Assert.True(snap.Report.HasAllBaseSettingsKeys, id);
        Assert.Equal(before, snap.ToCanonicalJson());
        var again = BackupSettingsSnapshot.FromCanonicalJson(snap.ToCanonicalJson());
        Assert.Equal(snap.ToCanonicalJson(), again.ToCanonicalJson());
        foreach (var biz in BackupSettingsSnapshotCatalog.ForbiddenBusinessKeys)
            Assert.False(snap.Data.ContainsKey(biz), id + " " + biz);
        foreach (var rt in BackupSettingsSnapshotCatalog.ForbiddenRuntimeKeys)
            Assert.False(snap.Data.ContainsKey(rt), id + " runtime " + rt);
    }

    [Fact]
    public void T1_AllSettingsPopulated()
    {
        var snap = Snap("T1");
        Assert.Equal("لایق الکترونیک پارسیان", BackupJsonUtil.Str(snap.Company!["name"]));
        Assert.Equal("Asia/Tehran", snap.Tz);
        Assert.Equal("sk-test-plain", BackupJsonUtil.Str(snap.AiKeys!["laegh_ai_key_openai"]));
        Assert.Equal("postal", BackupJsonUtil.Str(snap.PrintCenter!["lastDocId"]));
        Assert.True(snap.Report.HasPrintCenter);
        Assert.True(snap.Report.HasAiKeys);
        Assert.Contains("aiKeys", snap.Report.SensitivePayloadKeysPresent);
        Assert.Contains("laegh_skin", snap.Prefs!.Select(kv => kv.Key));
    }

    [Fact]
    public void T2_MissingTz_DefaultsInHtmlExpected()
    {
        var snap = Snap("T2");
        Assert.Equal(BackupSettingsSnapshotCatalog.DefaultTz, snap.Tz);
        Assert.False(snap.Prefs!.ContainsKey("laegh_tz"));
    }

    [Fact]
    public void T3_MissingAppearanceKeys_AreEmptyStrings()
    {
        var snap = Snap("T3");
        Assert.Equal(24, BackupSettingsSnapshotCatalog.AppearanceKeys.Count);
        foreach (var key in BackupSettingsSnapshotCatalog.AppearanceKeys)
            Assert.Equal("", BackupJsonUtil.Str(snap.Appearance![key]));
    }

    [Fact]
    public void T4_EmptySettingsObjects()
    {
        var snap = Snap("T4");
        Assert.Equal("{}", BackupJsJson.Stringify(snap.PrintSettings));
        Assert.Equal("{}", BackupJsJson.Stringify(snap.Company));
        Assert.Equal("{}", BackupJsJson.Stringify(snap.Field("sms")));
    }

    [Fact]
    public void T5_Company_And_T6_ServiceCenter()
    {
        Assert.Equal("شرکت نمونه", BackupJsonUtil.Str(Snap("T5").Company!["name"]));
        Assert.Equal("خدمات", BackupJsonUtil.Str(Snap("T6").Field("serviceCenter")!["title"]));
    }

    [Fact]
    public void T7_PrintSettings_T8_PrintCenter_ArePayloadOnly()
    {
        var ps = Snap("T7").PrintSettings!;
        Assert.Equal("A5", BackupJsonUtil.Str(ps["invoice"]!["paper"]));
        var pc = Snap("T8").PrintCenter!;
        Assert.Equal("warranty", BackupJsonUtil.Str(pc["lastDocId"]));
        Assert.True(pc["profiles"] is JsonObject);
    }

    [Fact]
    public void T9_StarredAlarms_CatalogMergePreserved()
    {
        var arr = Snap("T9").StarredAlarms!;
        Assert.Single(arr);
        Assert.Equal("wh_sepidar_phy", BackupJsonUtil.Str(arr[0]!["id"]));
        Assert.Equal(9, arr[0]!["days"]!.GetValue<int>());
        Assert.Equal("اختلاف انبار سپیدار و فیزیکی", BackupJsonUtil.Str(arr[0]!["title"]));
    }

    [Fact]
    public void T10_NetworkSettings_CoercePreserved()
    {
        var ns = Snap("T10").NetworkSettings!;
        Assert.Equal("station", BackupJsonUtil.Str(ns["role"]));
        Assert.Equal(8765, ns["port"]!.GetValue<int>());
        Assert.True(ns["lanEnabled"]!.GetValue<bool>());
    }

    [Fact]
    public void T11_PrefsSubset_T12_AiKeysPlaintext_T13_T14_Updates()
    {
        var prefs = Snap("T11").Prefs!;
        Assert.Equal("1", BackupJsonUtil.Str(prefs["laegh_autosave_enabled"]));
        Assert.Equal("sk-abc", BackupJsonUtil.Str(Snap("T12").AiKeys!["laegh_ai_key_openai"]));
        Assert.Equal(2, Snap("T13").Field("appliedUpdates")!.AsArray().Count);
        var pkgs = Snap("T14").Field("updatePackages")!.AsArray();
        Assert.Single(pkgs);
        Assert.Equal("pkg-9", BackupJsonUtil.Str(pkgs[0]!["id"]));
    }

    [Fact]
    public void T15_Sms_T16_PersianUnicode()
    {
        Assert.Equal("melipayamak", BackupJsonUtil.Str(Snap("T15").Field("sms")!["provider"]));
        var json = Snap("T16").ToCanonicalJson();
        Assert.Contains("لایق", json, StringComparison.Ordinal);
        Assert.Contains("سلام علی", json, StringComparison.Ordinal);
        Assert.Equal(json, BackupSettingsSnapshot.FromCanonicalJson(json).ToCanonicalJson());
    }

    [Fact]
    public void T17_MalformedCaughtKeys_FollowHtmlHelpers()
    {
        var snap = Snap("T17");
        Assert.Empty(snap.Field("appliedUpdates")!.AsArray());
        Assert.Equal(8765, snap.NetworkSettings!["port"]!.GetValue<int>());
        Assert.Equal("standalone", BackupJsonUtil.Str(snap.NetworkSettings!["role"]));
        Assert.Equal("wh_sepidar_phy", BackupJsonUtil.Str(snap.StarredAlarms![0]!["id"]));
    }

    [Fact]
    public void T18_MissingOptional_AdapterStillEmitsDefaults()
    {
        var snap = Snap("T18");
        Assert.True(snap.Report.HasPrintCenter);
        Assert.Equal(BackupSettingsSnapshotCatalog.DefaultTz, snap.Tz);
        Assert.Equal("{}", BackupJsJson.Stringify(snap.Company));
        Assert.Equal("", BackupJsonUtil.Str(snap.Appearance!["skin"]));
    }

    [Fact]
    public void T19_NestedObjectIsolation()
    {
        var raw = JsonNode.Parse(Case("T1").GetProperty("expected").GetRawText())!.AsObject();
        var before = BackupJsJson.Stringify(raw);
        var snap = BackupSettingsSnapshot.Parse(raw);
        snap.Company!["name"] = "mutated";
        snap.Appearance!["skin"] = "mutated";
        snap.AiKeys!["laegh_ai_key_openai"] = "mutated";
        snap.PrintCenter!["lastDocId"] = "mutated";
        Assert.Equal(before, BackupJsJson.Stringify(raw));
        var copy = snap.ToJson();
        copy["company"]!["name"] = "again";
        Assert.Equal("mutated", BackupJsonUtil.Str(snap.Company["name"]));
        Assert.False(ReferenceEquals(snap.Data, copy));
        Assert.False(ReferenceEquals(snap.Company, raw["company"]));
    }

    [Fact]
    public void T20_DeterministicSerialization()
    {
        var a = Snap("T1").ToCanonicalJson();
        var b = Snap("T1").ToCanonicalJson();
        Assert.Equal(a, b);
        var src = File.ReadAllText(SettingsDtoPath());
        Assert.DoesNotContain("DateTime.UtcNow", src);
        Assert.DoesNotContain("DateTime.Now", src);
        Assert.DoesNotContain("Guid.NewGuid", src);
        Assert.DoesNotContain("Random", src);
        var cat = File.ReadAllText(SettingsCatalogPath());
        Assert.DoesNotContain("DateTime", cat);
    }

    [Fact]
    public void T21_MalformedSourceHandling()
    {
        var empty = BackupSettingsSnapshot.FromCanonicalJson("{");
        Assert.False(empty.Report.IsObject);
        Assert.False(empty.Report.HasAllBaseSettingsKeys);
        Assert.Equal("{}", empty.ToCanonicalJson());
        Assert.Empty(BackupSettingsSnapshot.FromCanonicalJson(null).ToCanonicalJson().Trim('{', '}'));
        var also = BackupSettingsSnapshot.FromCanonicalJson("not-json");
        Assert.Equal("{}", also.ToCanonicalJson());
        var nullNode = BackupSettingsSnapshot.Parse(null);
        Assert.Equal("{}", nullNode.ToCanonicalJson());
    }

    [Fact]
    public void T22_NoBrowserReferencesInCore()
    {
        foreach (var path in new[] { SettingsDtoPath(), SettingsCatalogPath() })
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
        foreach (var t in new[] { typeof(BackupSettingsSnapshot), typeof(BackupSettingsSnapshotCatalog) })
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
    public void T23_NoBusinessRamFieldsInSettingsDto()
    {
        var mixed = JsonNode.Parse(Case("T1").GetProperty("expected").GetRawText())!.AsObject();
        mixed["invoices"] = new JsonArray { new JsonObject { ["invoiceId"] = "INVUID-000001" } };
        mixed["phonebook"] = new JsonArray();
        mixed["warranties"] = new JsonArray();
        mixed["sales"] = new JsonArray();
        mixed["parts"] = new JsonArray();
        mixed["accounts"] = new JsonArray();
        mixed["loginPw"] = "secret";
        mixed["exportedAt"] = "2023-11-14T22:13:20.000Z";
        mixed["localStorage"] = new JsonObject();
        var snap = BackupSettingsSnapshot.Parse(mixed);
        Assert.Contains("invoices", snap.Report.StrippedBusinessKeys);
        Assert.Contains("phonebook", snap.Report.StrippedBusinessKeys);
        Assert.Contains("loginPw", snap.Report.StrippedBusinessKeys);
        Assert.True(snap.Report.HasRuntimeHandles);
        Assert.Contains("localStorage", snap.Report.RuntimeHandleKeys);
        foreach (var biz in BackupSettingsSnapshotCatalog.ForbiddenBusinessKeys)
            Assert.False(snap.Data.ContainsKey(biz), biz);
        Assert.False(snap.Data.ContainsKey("localStorage"));
        Assert.Equal("لایق الکترونیک پارسیان", BackupJsonUtil.Str(snap.Company!["name"]));
    }

    [Fact]
    public void T24_RegressionLocks_NoLiveCutover()
    {
        Assert.Equal("html-backup-engine", JsonBackupRepository.TbdMarker);
        Assert.Equal(12, BackupSettingsSnapshotCatalog.BaseSettingsKeys.Count);
        Assert.Equal(24, BackupSettingsSnapshotCatalog.AppearanceKeys.Count);
        Assert.Equal(BackupSnapshotCatalog.AppearanceKeys, BackupSettingsSnapshotCatalog.AppearanceKeys);
        Assert.Contains("aiKeys", BackupSettingsSnapshotCatalog.SensitivePayloadKeys);
        Assert.DoesNotContain("loginPw", BackupSettingsSnapshotCatalog.AllSettingsKeys);
        Assert.DoesNotContain("invoices", BackupSettingsSnapshotCatalog.AllSettingsKeys);
        var printHost = File.ReadAllText(Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", "Sirman.Desktop", "WindowsPrintHost.cs")));
        Assert.Contains("internal sealed class WindowsPrintHost", printHost);
        var diag = File.ReadAllText(Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", "Sirman.Desktop", "PrintHardwareDiagnostic.cs")));
        Assert.Contains("internal sealed class PrintHardwareDiagnostic", diag);
        var sqlite = File.ReadAllText(Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", "Sirman.Persistence.Sqlite", "Sirman.Persistence.Sqlite.csproj")));
        Assert.Contains("Sirman.Persistence.Sqlite", sqlite);
    }

    private static BackupSettingsSnapshot Snap(string id) =>
        BackupSettingsSnapshot.Parse(JsonNode.Parse(Case(id).GetProperty("expected").GetRawText()));

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
        var path = Path.Combine(AppContext.BaseDirectory, "BackupSettingsFixtures.json");
        Assert.True(File.Exists(path), path);
        return JsonDocument.Parse(File.ReadAllText(path)).RootElement;
    }

    private static string SettingsDtoPath() =>
        Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", "Sirman.Core", "Backup", "BackupSettingsSnapshot.cs"));

    private static string SettingsCatalogPath() =>
        Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", "Sirman.Core", "Backup", "BackupSettingsSnapshotCatalog.cs"));
}
