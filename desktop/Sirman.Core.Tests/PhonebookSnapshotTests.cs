using System.Text.Json;
using System.Text.Json.Nodes;
using Sirman.Core.Backup;
using Sirman.Core.Data.Repositories;
using Xunit;

namespace Sirman.Core.Tests;

/// <summary>
/// ARCH-22 — PhonebookSnapshot is a pure CURRENT-payload transport DTO.
/// HTML adapter is the RAM reader. No live backup cutover. No Phonebook repair.
/// </summary>
public class PhonebookSnapshotTests
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
    public void GoldenFixture_HtmlExpected_MatchesCoreDto(string id)
    {
        var expected = Case(id).GetProperty("expected");
        var node = JsonNode.Parse(expected.GetRawText())!.AsObject();
        var before = BackupJsJson.Stringify(node);
        var snap = PhonebookSnapshot.Parse(node);
        Assert.Equal(before, BackupJsJson.Stringify(node));
        Assert.Equal(before, snap.ToCanonicalJson());
        var again = PhonebookSnapshot.FromCanonicalJson(snap.ToCanonicalJson());
        Assert.Equal(snap.ToCanonicalJson(), again.ToCanonicalJson());
        foreach (var key in PhonebookSnapshotCatalog.ForbiddenKeys)
            Assert.False(snap.Data.ContainsKey(key), id + " " + key);
        Assert.False(snap.Data.ContainsKey("attachmentsIndex"), id);
        Assert.False(snap.Data.ContainsKey("daqi"), id);
        Assert.True(snap.Data.ContainsKey("phonebook"), id);
    }

    [Fact]
    public void T1_EmptyPhonebook()
    {
        var snap = Snap("T1");
        Assert.Empty(snap.Contacts);
        Assert.Equal(0, snap.Report.Count);
        Assert.Equal("{\"phonebook\":[]}", snap.ToCanonicalJson());
    }

    [Fact]
    public void T2_OneNormalContact()
    {
        Assert.Equal("علی", BackupJsonUtil.Str(Snap("T2").Contacts[0]!["fn"]));
        Assert.Equal("09120000001", BackupJsonUtil.Str(Snap("T2").Contacts[0]!["phones"]![0]));
    }

    [Fact]
    public void T4_ExactClonePreserved()
    {
        var snap = Snap("T4");
        Assert.Equal(2, snap.Contacts.Count);
        Assert.Equal(BackupJsJson.Stringify(snap.Contacts[0]), BackupJsJson.Stringify(snap.Contacts[1]));
        Assert.Equal(PhonebookForensic.ClassA, PhonebookForensic.PrimaryClass(snap.Contacts, 0));
        Assert.Equal(PhonebookForensic.ClassA, PhonebookForensic.PrimaryClass(snap.Contacts, 1));
    }

    [Fact]
    public void T5_EmptyPhoneRowsPreserved_NoDedup()
    {
        var snap = Snap("T5");
        Assert.Equal(8, snap.Contacts.Count);
        Assert.Equal(8, snap.Report.EmptyPhoneCount);
        Assert.Equal("0", BackupJsonUtil.Str(snap.Contacts[0]!["ln"]));
        Assert.Equal("7", BackupJsonUtil.Str(snap.Contacts[7]!["ln"]));
    }

    [Fact]
    public void T6_SameRawPhone_ClassC()
    {
        var book = Snap("T6").Contacts;
        Assert.Contains(PhonebookForensic.ClassC, PhonebookForensic.ClassesOf(book, 0));
        Assert.Equal("مریم", BackupJsonUtil.Str(book[0]!["fn"]));
        Assert.Equal("رضا", BackupJsonUtil.Str(book[1]!["fn"]));
    }

    [Fact]
    public void T7_SameNameDifferentPhone_ClassE_NeverMergeHint()
    {
        var book = Snap("T7").Contacts;
        Assert.Equal(PhonebookForensic.ClassE, PhonebookForensic.PrimaryClass(book, 0));
        Assert.Equal("09126666661", PhonebookForensic.FirstRawPhone(book[0]));
        Assert.Equal("09126666662", PhonebookForensic.FirstRawPhone(book[1]));
    }

    [Fact]
    public void T8_NullMissingEmptyPhone_ClassD()
    {
        var book = Snap("T8").Contacts;
        Assert.Equal(4, book.Count);
        for (var i = 0; i < book.Count; i++)
            Assert.Contains(PhonebookForensic.ClassD, PhonebookForensic.ClassesOf(book, i));
        Assert.True(book[0]!.AsObject().ContainsKey("phones"));
        Assert.True(book[0]!["phones"] is null || book[0]!["phones"]!.GetValueKind() == JsonValueKind.Null);
        Assert.False(book[1]!.AsObject().ContainsKey("phones"));
    }

    [Fact]
    public void T9_PersianUnicode_RoundTrip()
    {
        var json = Snap("T9").ToCanonicalJson();
        Assert.Contains("سلام علی", json, StringComparison.Ordinal);
        Assert.Contains("لایق الکترونیک پارسیان", json, StringComparison.Ordinal);
        Assert.Contains("یاتاقان جلو", json, StringComparison.Ordinal);
        Assert.Equal(json, PhonebookSnapshot.FromCanonicalJson(json).ToCanonicalJson());
    }

    [Fact]
    public void T10_PersianArabicDigits_PreservedRaw_NormalizedOnlyInAnalysis()
    {
        var book = Snap("T10").Contacts;
        Assert.Equal("۰۹۱۲۷۷۷۷۷۷۷", PhonebookForensic.FirstRawPhone(book[0]));
        Assert.Equal("09127777777", PhonebookForensic.NormalizePhoneForAnalysis(PhonebookForensic.FirstRawPhone(book[0])));
        Assert.Equal("۰۹۱۲۷۷۷۷۷۷۷", BackupJsonUtil.Str(book[0]!["phones"]![0]));
        Assert.Contains(PhonebookForensic.ClassB, PhonebookForensic.ClassesOf(book, 0));
        Assert.DoesNotContain(PhonebookForensic.ClassC, PhonebookForensic.ClassesOf(book, 0));
    }

    [Fact]
    public void T11_UnknownFieldsPreserved_IdNotInventedAsStable()
    {
        var rec = Snap("T11").Contacts[0]!.AsObject();
        Assert.Equal("keep-me", BackupJsonUtil.Str(rec["mystery"]));
        Assert.Equal(1, rec["nested"]!["a"]!["b"]!.GetValue<int>());
        Assert.Equal("NOT-A-STABLE-ID", BackupJsonUtil.Str(rec["id"]));
        Assert.Equal("", PhonebookSnapshotCatalog.StableIdentityField);
    }

    [Fact]
    public void T12_ExactOrderPreserved()
    {
        var book = Snap("T12").Contacts;
        Assert.Equal(12, book.Count);
        Assert.Equal("00", BackupJsonUtil.Str(book[0]!["ln"]));
        Assert.Equal("11", BackupJsonUtil.Str(book[11]!["ln"]));
    }

    [Fact]
    public void T13_NestedObjectsPreserved()
    {
        Assert.Equal("keep", BackupJsonUtil.Str(Snap("T13").Contacts[0]!["bag"]!["a"]!["b"]!["c"]));
        Assert.Equal("@x", BackupJsonUtil.Str(Snap("T13").Contacts[0]!["socials"]![0]!["handle"]));
    }

    [Fact]
    public void Fingerprint_ExactCloneWithoutChangingPayload()
    {
        var a = Snap("T4").Contacts[0];
        var b = Snap("T4").Contacts[1];
        Assert.Equal(PhonebookForensic.ContactFingerprint(a), PhonebookForensic.ContactFingerprint(b));
        Assert.Equal(BackupJsJson.Stringify(a), BackupJsJson.Stringify(b));
    }

    [Fact]
    public void Classifier_T2_IsDifferentRecord()
    {
        Assert.Equal(PhonebookForensic.ClassF, PhonebookForensic.PrimaryClass(Snap("T2").Contacts, 0));
    }

    [Fact]
    public void HistoricalCorruptionReplay_EmptyPhone_NonIdempotent()
    {
        var payload = new JsonArray();
        for (var i = 0; i < 530; i++)
        {
            payload.Add(new JsonObject
            {
                ["fn"] = "بی‌تلفن",
                ["ln"] = i.ToString(),
                ["phones"] = new JsonArray(),
                ["cat"] = "other"
            });
        }
        var state = (JsonArray)BackupJsonUtil.CloneExact(payload)!;
        Assert.Equal(530, state.Count);
        var counts = new List<int> { state.Count };
        for (var round = 0; round < 4; round++)
        {
            state = PhonebookForensic.MergeReplica(state, payload);
            counts.Add(state.Count);
        }
        Assert.Equal(new[] { 530, 1060, 1590, 2120, 2650 }, counts);
        Assert.Equal("non-idempotent", PhonebookForensic.IdempotencyOf(payload));
    }

    [Fact]
    public void HistoricalCorruptionReplay_IdenticalNonEmptyPhone_Idempotent()
    {
        var payload = new JsonArray();
        for (var i = 0; i < 40; i++)
        {
            payload.Add(new JsonObject
            {
                ["fn"] = "باشماره",
                ["ln"] = i.ToString(),
                ["phones"] = new JsonArray { "0912" + i.ToString("0000000") },
                ["cat"] = "customer"
            });
        }
        var state = PhonebookForensic.MergeReplica(new JsonArray(), payload);
        Assert.Equal(40, state.Count);
        var again = PhonebookForensic.MergeReplica(state, payload);
        Assert.Equal(40, again.Count);
        Assert.Equal(BackupJsJson.Stringify(state), BackupJsJson.Stringify(again));
        Assert.Equal("idempotent", PhonebookForensic.IdempotencyOf(payload));
    }

    [Fact]
    public void Idempotency_ExactCloneWithPhone_IsIdempotent()
    {
        Assert.Equal("idempotent", PhonebookForensic.IdempotencyOf(Snap("T4").Contacts));
    }

    [Fact]
    public void Idempotency_EmptyPhone_IsNonIdempotent()
    {
        Assert.Equal("non-idempotent", PhonebookForensic.IdempotencyOf(Snap("T5").Contacts));
        Assert.Equal("non-idempotent", PhonebookForensic.IdempotencyOf(Snap("T8").Contacts));
    }

    [Fact]
    public void Idempotency_SameNameDifferentPhone_PayloadIsIdempotentAfterFirstInsert()
    {
        Assert.Equal("idempotent", PhonebookForensic.IdempotencyOf(Snap("T7").Contacts));
    }

    [Fact]
    public void Parse_StripsForbiddenKeys_KeepsContacts()
    {
        var mixed = JsonNode.Parse(Case("T2").GetProperty("expected").GetRawText())!.AsObject();
        mixed["invoices"] = new JsonArray();
        mixed["daqi"] = new JsonArray { new JsonObject { ["agencyPhonebookIdx"] = 0 } };
        mixed["attachmentsIndex"] = new JsonArray();
        mixed["localStorage"] = new JsonObject();
        var snap = PhonebookSnapshot.Parse(mixed);
        Assert.Contains("invoices", snap.Report.StrippedForbiddenKeys);
        Assert.Contains("daqi", snap.Report.StrippedForbiddenKeys);
        Assert.Contains("attachmentsIndex", snap.Report.StrippedForbiddenKeys);
        Assert.True(snap.Report.HasRuntimeHandles);
        Assert.Equal("علی", BackupJsonUtil.Str(snap.Contacts[0]!["fn"]));
        Assert.False(snap.Data.ContainsKey("daqi"));
    }

    [Fact]
    public void MalformedSourceHandling()
    {
        Assert.False(PhonebookSnapshot.FromCanonicalJson("{").Report.IsObject);
        Assert.Equal("{\"phonebook\":[]}", PhonebookSnapshot.FromCanonicalJson("{").ToCanonicalJson());
        Assert.Equal("{\"phonebook\":[]}", PhonebookSnapshot.FromCanonicalJson(null).ToCanonicalJson());
        Assert.Equal("{\"phonebook\":[]}", PhonebookSnapshot.Parse(null).ToCanonicalJson());
    }

    [Fact]
    public void NoBrowserReferencesInCoreDto()
    {
        foreach (var path in new[] { DtoPath(), CatalogPath() })
        {
            var src = File.ReadAllText(path);
            Assert.DoesNotContain("getItem(", src);
            Assert.DoesNotContain("setItem(", src);
            Assert.DoesNotContain("indexedDB", src);
            Assert.DoesNotContain("Microsoft.Web.WebView2", src);
            Assert.DoesNotContain("System.Windows.Forms", src);
            Assert.DoesNotContain("savePBContact", src);
            Assert.DoesNotContain("applyBackupMergeSections", src);
        }
        Assert.Equal("Sirman.Core.Backup", typeof(PhonebookSnapshot).Namespace);
    }

    [Fact]
    public void MutationOfDtoDoesNotChangeSourceNode()
    {
        var node = JsonNode.Parse(Case("T14").GetProperty("expected").GetRawText())!.AsObject();
        var before = BackupJsJson.Stringify(node);
        var snap = PhonebookSnapshot.Parse(node);
        snap.Contacts.Add(new JsonObject { ["fn"] = "FORGED" });
        snap.Contacts[0]!["fn"] = "mut";
        Assert.Equal(before, BackupJsJson.Stringify(node));
        Assert.Equal("ایزوله", BackupJsonUtil.Str(node["phonebook"]![0]!["fn"]));
    }

    [Fact]
    public void RegressionLocks_NoLiveCutover()
    {
        Assert.Equal("html-backup-engine", JsonBackupRepository.TbdMarker);
        Assert.Equal("phonebook", PhonebookSnapshotCatalog.BackupKey);
        Assert.Equal("lb", PhonebookSnapshotCatalog.StorageKey);
        Assert.Equal("phonebook", PhonebookSnapshotCatalog.SourceGlobal);
        Assert.Equal("", PhonebookSnapshotCatalog.StableIdentityField);
        Assert.Contains("phonebook", OptionalBusinessSnapshotCatalog.ForbiddenKeys);
        var html = File.ReadAllText(HtmlPath());
        var build = ExtractFunction(html, "_buildFullBackupData");
        Assert.DoesNotContain("collectPhonebookSnapshot()", build);
        Assert.Contains("phonebook: _safeArr(phonebook)", build);
        Assert.Contains("var o = collectOptionalBusinessSnapshot();", build);
        Assert.Contains("var b = collectRequiredBusinessSnapshot();", build);
        Assert.Contains("var s = collectBackupSettingsSnapshot();", build);
        Assert.Contains("function collectPhonebookSnapshot()", html);
        Assert.Contains("phonebook: _safeArr(phonebook)", ExtractFunction(html, "collectPhonebookSnapshot"));
        Assert.DoesNotContain("collectPhonebookSnapshot()", ExtractFunction(html, "exportData"));
        Assert.DoesNotContain("collectPhonebookSnapshot()", ExtractFunction(html, "buildBackupObject"));
        Assert.DoesNotContain("collectPhonebookSnapshot()", ExtractFunction(html, "savePBContact"));
        Assert.DoesNotContain("collectPhonebookSnapshot()", ExtractFunction(html, "applyBackupMergeSections"));
        Assert.DoesNotContain("collectPhonebookSnapshot()", ExtractFunction(html, "applyBackupReplaceSections"));
        Assert.Contains("1405.6.3α", build);
        Assert.DoesNotContain("id:'PB-", ExtractFunction(html, "savePBContact"));
        var printHost = File.ReadAllText(Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", "Sirman.Desktop", "WindowsPrintHost.cs")));
        Assert.Contains("internal sealed class WindowsPrintHost", printHost);
        var sqlite = File.ReadAllText(Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", "Sirman.Persistence.Sqlite", "Sirman.Persistence.Sqlite.csproj")));
        Assert.Contains("Sirman.Persistence.Sqlite", sqlite);
    }

    [Fact]
    public void DaqiIndexIsPositional_NotRemappedByAdapter()
    {
        Assert.Equal("daqi.agencyPhonebookIdx", PhonebookSnapshotCatalog.PositionalIndexConsumer);
        var html = File.ReadAllText(HtmlPath());
        var adapter = ExtractFunction(html, "collectPhonebookSnapshot");
        Assert.DoesNotContain("agencyPhonebookIdx", adapter);
        Assert.DoesNotContain("daqi", adapter);
        var reader = ExtractFunction(html, "_daqiAgencyName");
        Assert.Contains("phonebook[d.agencyPhonebookIdx]", reader);
        var del = ExtractFunction(html, "delPBContact");
        Assert.Contains("phonebook.splice(idx,1)", del);
    }

    private static PhonebookSnapshot Snap(string id) =>
        PhonebookSnapshot.Parse(JsonNode.Parse(Case(id).GetProperty("expected").GetRawText()));

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
        var path = Path.Combine(AppContext.BaseDirectory, "PhonebookFixtures.json");
        Assert.True(File.Exists(path), path);
        return JsonDocument.Parse(File.ReadAllText(path)).RootElement;
    }

    private static string HtmlPath() =>
        Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", "..", "Sirman_Final.html"));

    private static string DtoPath() =>
        Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", "Sirman.Core", "Backup", "PhonebookSnapshot.cs"));

    private static string CatalogPath() =>
        Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", "Sirman.Core", "Backup", "PhonebookSnapshotCatalog.cs"));

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
}
