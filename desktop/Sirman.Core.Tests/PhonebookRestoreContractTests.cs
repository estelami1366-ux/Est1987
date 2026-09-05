using System.Security.Cryptography;
using System.Text;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;
using Xunit;

namespace Sirman.Core.Tests;

/// <summary>
/// ARCH-25 production Phonebook Restore Contract tests.
/// ARCH-23 PhonebookRestoreSafety remains the pre-fix replica.
/// </summary>
public class PhonebookRestoreContractTests
{
    static JsonObject C(string fn, JsonNode? phones, string? ln = null, string? note = null, JsonObject? extra = null)
    {
        var o = extra is null ? new JsonObject() : PhonebookRestoreSafety.CloneContact(extra);
        o["fn"] = fn;
        if (ln is not null) o["ln"] = ln;
        if (phones is not null) o["phones"] = phones.DeepClone();
        if (note is not null) o["note"] = note;
        return o;
    }

    static JsonArray Phones(params string[] nums)
    {
        var a = new JsonArray();
        foreach (var n in nums) a.Add(n);
        return a;
    }

    static JsonObject BackupPhonebook(params JsonObject[] rows)
    {
        var arr = new JsonArray();
        foreach (var r in rows) arr.Add(r.DeepClone());
        return new JsonObject { ["phonebook"] = arr };
    }

    static List<JsonObject> Live(params JsonObject[] rows) =>
        rows.Select(PhonebookRestoreSafety.CloneContact).ToList();

    [Fact]
    public void ProductionLocks_AssemblerSaveAdaptersUnchanged_MergeReplaceUpdated()
    {
        var html = File.ReadAllText(HtmlPath());
        Assert.Equal(PhonebookRestoreContract.AssemblerSha, ShaUtf8(ExtractFunction(html, "_buildFullBackupData")));
        Assert.Equal(PhonebookRestoreContract.SavePbContactSha, ShaUtf8(ExtractFunction(html, "savePBContact")));
        Assert.Equal(PhonebookRestoreContract.CollectPhonebookSnapshotSha, ShaUtf8(ExtractFunction(html, "collectPhonebookSnapshot")));
        Assert.Equal(PhonebookRestoreContract.CollectAttachmentIndexSha, ShaUtf8(ExtractFunction(html, "collectAttachmentIndex")));
        Assert.Equal(PhonebookRestoreContract.RequiredAdapterSha, ShaUtf8(ExtractFunction(html, "collectRequiredBusinessSnapshot")));
        Assert.Equal(PhonebookRestoreContract.OptionalAdapterSha, ShaUtf8(ExtractFunction(html, "collectOptionalBusinessSnapshot")));
        Assert.Equal(PhonebookRestoreContract.MergeSha, ShaUtf8(ExtractFunction(html, "applyBackupMergeSections")));
        Assert.Equal(PhonebookRestoreContract.ReplaceSha, ShaUtf8(ExtractFunction(html, "applyBackupReplaceSections")));
        Assert.Equal(PhonebookRestoreContract.FingerprintSha, ShaUtf8(ExtractFunction(html, "_phonebookCanonicalFingerprint")));
        Assert.NotEqual(PhonebookRestoreContract.MergeShaPreArch25, PhonebookRestoreContract.MergeSha);
        Assert.NotEqual(PhonebookRestoreContract.ReplaceShaPreArch25, PhonebookRestoreContract.ReplaceSha);
        var build = ExtractFunction(html, "_buildFullBackupData");
        Assert.DoesNotContain("collectPhonebookSnapshot()", build);
        Assert.Contains("phonebook: _safeArr(phonebook)", build);
        Assert.Contains("1405.6.3α", build);
        var merge = ExtractFunction(html, "applyBackupMergeSections");
        Assert.Contains("_phonebookCanonicalFingerprint(entry)", merge);
        Assert.Contains("if (entryPhone)", merge);
        Assert.DoesNotContain("id:'PB-", ExtractFunction(html, "savePBContact"));
        var replace = ExtractFunction(html, "applyBackupReplaceSections");
        Assert.Contains("دفترچه زنده حفظ شد", replace);
        Assert.Contains("d.phonebook.length === 0", replace);
        Assert.DoesNotContain("else phonebook = [];", replace);
    }

    [Fact]
    public void MergeMatrix_M1_To_M17()
    {
        // M1 unique phone ADD
        var m1 = PhonebookRestoreContract.Merge(Live(), BackupPhonebook(C("علی", Phones("09120000001"))));
        Assert.Equal(1, m1.Added);
        Assert.Equal(PhonebookRestoreContract.OutcomeAdd, m1.Rows[0].Outcome);

        // M2 exact phone clone SKIP_PHONE_MATCH or exact
        var clone = C("علی", Phones("09120000001"), note: "same");
        var m2 = PhonebookRestoreContract.Merge(Live(clone), BackupPhonebook(PhonebookRestoreSafety.CloneContact(clone)));
        Assert.Equal(0, m2.Added);
        Assert.Equal(PhonebookRestoreContract.OutcomeSkipExactDuplicate, m2.Rows[0].Outcome);

        // M3 exact canonical clone empty phone
        var empty = C("بی‌تلفن", Phones(), ln: "0");
        var m3 = PhonebookRestoreContract.Merge(Live(empty), BackupPhonebook(PhonebookRestoreSafety.CloneContact(empty)));
        Assert.Equal(0, m3.Added);
        Assert.Equal(PhonebookRestoreContract.OutcomeSkipExactDuplicate, m3.Rows[0].Outcome);

        // M4 missing phones clone
        var missing = new JsonObject { ["fn"] = "بدون‌فیلد" };
        var m4 = PhonebookRestoreContract.Merge(Live(missing), BackupPhonebook(PhonebookRestoreSafety.CloneContact(missing)));
        Assert.Equal(PhonebookRestoreContract.OutcomeSkipExactDuplicate, m4.Rows[0].Outcome);

        // M5 null phones clone
        var nul = JsonNode.Parse("{\"fn\":\"نال\",\"phones\":null}")!.AsObject();
        var m5 = PhonebookRestoreContract.Merge(Live(nul), BackupPhonebook(PhonebookRestoreSafety.CloneContact(nul)));
        Assert.Equal(PhonebookRestoreContract.OutcomeSkipExactDuplicate, m5.Rows[0].Outcome);

        // M6 different empty-phone ADD
        var m6 = PhonebookRestoreContract.Merge(Live(C("بی‌تلفن", Phones(), ln: "0")), BackupPhonebook(C("بی‌تلفن", Phones(), ln: "1")));
        Assert.Equal(2, m6.State.Count);
        Assert.Equal(PhonebookRestoreContract.OutcomeAdd, m6.Rows[0].Outcome);

        // M7 same name different phone ADD
        var m7 = PhonebookRestoreContract.Merge(Live(C("مریم", Phones("09126666661"))), BackupPhonebook(C("مریم", Phones("09126666662"))));
        Assert.Equal(2, m7.State.Count);

        // M8 same phone different name SKIP_PHONE_MATCH no UPDATE
        var m8 = PhonebookRestoreContract.Merge(Live(C("قدیمی", Phones("09120000001"), note: "keep")), BackupPhonebook(C("جدید", Phones("09120000001"), note: "drop")));
        Assert.Equal(1, m8.State.Count);
        Assert.Equal("قدیمی", m8.State[0]["fn"]!.GetValue<string>());
        Assert.Equal("keep", m8.State[0]["note"]!.GetValue<string>());
        Assert.Equal(PhonebookRestoreContract.OutcomeSkipPhoneMatch, m8.Rows[0].Outcome);

        // M9 same phone different metadata SKIP
        var m9 = PhonebookRestoreContract.Merge(Live(C("علی", Phones("09120000001"), note: "a")), BackupPhonebook(C("علی", Phones("09120000001"), note: "b")));
        Assert.Equal(PhonebookRestoreContract.OutcomeSkipPhoneMatch, m9.Rows[0].Outcome);
        Assert.Equal("a", m9.State[0]["note"]!.GetValue<string>());

        // M10 first slot matches any live slot
        var m10 = PhonebookRestoreContract.Merge(Live(C("نماینده", Phones("111", "222"))), BackupPhonebook(C("دیگر", Phones("222", "333"))));
        Assert.Equal(1, m10.State.Count);
        Assert.Equal(PhonebookRestoreContract.OutcomeSkipPhoneMatch, m10.Rows[0].Outcome);

        // M11 first slot empty, second matches live → ADD (phones[0] identity; same as pre-ARCH-25)
        var phones11 = new JsonArray { "", "09120000002" };
        var m11 = PhonebookRestoreContract.Merge(Live(C("موجود", Phones("09120000002"))), BackupPhonebook(C("نال‌اول", phones11)));
        Assert.Equal(2, m11.State.Count);
        Assert.Equal(PhonebookRestoreContract.OutcomeAdd, m11.Rows[0].Outcome);

        // M12 duplicate exact empty payload twice → no growth
        var e = C("خالی", Phones(), ln: "x");
        var m12 = PhonebookRestoreContract.Merge(Live(), new JsonObject
        {
            ["phonebook"] = new JsonArray { PhonebookRestoreSafety.CloneContact(e), PhonebookRestoreSafety.CloneContact(e) }
        });
        Assert.Equal(1, m12.State.Count);
        Assert.Equal(1, m12.Added);
        Assert.Equal(1, m12.Skipped);

        // M13 different empty payload repeated twice → one insert per distinct contact
        var a = C("خالی", Phones(), ln: "a");
        var b = C("خالی", Phones(), ln: "b");
        var payload13 = new JsonObject
        {
            ["phonebook"] = new JsonArray
            {
                PhonebookRestoreSafety.CloneContact(a),
                PhonebookRestoreSafety.CloneContact(b),
                PhonebookRestoreSafety.CloneContact(a),
                PhonebookRestoreSafety.CloneContact(b)
            }
        };
        var m13 = PhonebookRestoreContract.Merge(Live(), payload13);
        Assert.Equal(2, m13.State.Count);

        // M14 order preserved
        var live14 = Live(C("A", Phones("1")), C("B", Phones("2")));
        var m14 = PhonebookRestoreContract.Merge(live14, BackupPhonebook(C("C", Phones("3")), C("D", Phones("4"))));
        Assert.Equal(new[] { "A", "B", "C", "D" }, m14.State.Select(x => x["fn"]!.GetValue<string>()).ToArray());

        // M15 unknown fields preserved
        var extra = C("extra", Phones("09129999999"));
        extra["xyz"] = 7;
        extra["nested"] = new JsonObject { ["k"] = "v" };
        var m15 = PhonebookRestoreContract.Merge(Live(), BackupPhonebook(extra));
        Assert.Equal(7, m15.State[0]["xyz"]!.GetValue<int>());
        Assert.Equal("v", m15.State[0]["nested"]!["k"]!.GetValue<string>());

        // M16 Persian/Arabic preserved
        var m16 = PhonebookRestoreContract.Merge(Live(), BackupPhonebook(C("علی", Phones("۰۹۱۲۱۱۱۱۱۱۱"), ln: "رضایی", note: "العربية")));
        Assert.Equal("علی", m16.State[0]["fn"]!.GetValue<string>());
        Assert.Equal("۰۹۱۲۱۱۱۱۱۱۱", PhonebookRestoreSafety.EntryPhone(m16.State[0]));
        Assert.Equal("العربية", m16.State[0]["note"]!.GetValue<string>());

        // M17 legacy pb alias
        var m17 = PhonebookRestoreContract.Merge(Live(), new JsonObject
        {
            ["phonebook"] = new JsonArray(),
            ["pb"] = new JsonArray { C("از-alias", Phones("09120000009")) }
        });
        Assert.Equal(1, m17.Added);
        Assert.Equal("از-alias", m17.State[0]["fn"]!.GetValue<string>());
    }

    [Fact]
    public void ReplaceMatrix_R1_To_R13()
    {
        var live = Live(C("A", Phones("1")), C("B", Phones("2")));
        var daqiIdx = 1;

        var r1 = PhonebookRestoreContract.Replace(live, BackupPhonebook(C("X", Phones("a")), C("Y", Phones("b"))));
        Assert.Equal(PhonebookRestoreContract.ReplaceReplace, r1.Outcome);
        Assert.Equal(2, r1.State.Count);
        Assert.Equal("X", r1.State[0]["fn"]!.GetValue<string>());

        var r2 = PhonebookRestoreContract.Replace(live, new JsonObject { ["phonebook"] = new JsonArray() });
        Assert.Equal(PhonebookRestoreContract.ReplaceClear, r2.Outcome);
        Assert.Empty(r2.State);

        var r3 = PhonebookRestoreContract.Replace(live, new JsonObject());
        Assert.Equal(PhonebookRestoreContract.ReplaceKeepLive, r3.Outcome);
        Assert.Equal(2, r3.State.Count);
        Assert.Equal("A", r3.State[0]["fn"]!.GetValue<string>());

        var r4 = PhonebookRestoreContract.Replace(live, new JsonObject { ["phonebook"] = null });
        Assert.Equal(PhonebookRestoreContract.ReplaceKeepLive, r4.Outcome);
        Assert.Equal(2, r4.State.Count);

        var r5 = PhonebookRestoreContract.Replace(live, new JsonObject { ["phonebook"] = new JsonObject() });
        Assert.Equal(PhonebookRestoreContract.ReplaceKeepLive, r5.Outcome);

        var r6 = PhonebookRestoreContract.Replace(live, new JsonObject { ["phonebook"] = "bad" });
        Assert.Equal(PhonebookRestoreContract.ReplaceKeepLive, r6.Outcome);

        var r7 = PhonebookRestoreContract.Replace(live, new JsonObject
        {
            ["pb"] = new JsonArray
            {
                new JsonObject { ["name"] = "نام خانوادگی", ["phone"] = "09120000008" }
            }
        });
        Assert.Equal(PhonebookRestoreContract.ReplaceLegacyPb, r7.Outcome);
        Assert.Equal("نام", r7.State[0]["fn"]!.GetValue<string>());

        var r8a = PhonebookRestoreContract.Replace(live, new JsonObject { ["pb"] = new JsonArray() });
        Assert.Equal(PhonebookRestoreContract.ReplaceKeepLive, r8a.Outcome);
        var r8b = PhonebookRestoreContract.Replace(live, new JsonObject());
        Assert.Equal(PhonebookRestoreContract.ReplaceKeepLive, r8b.Outcome);

        var incoming = new[]
        {
            C("X", Phones("a")),
            C("خالی", Phones()),
            C("تکرار", Phones("9")),
            C("تکرار", Phones("9"))
        };
        incoming[0]["xyz"] = 1;
        var r9 = PhonebookRestoreContract.Replace(live, BackupPhonebook(incoming));
        Assert.Equal(4, r9.State.Count);
        Assert.Equal("X", r9.State[0]["fn"]!.GetValue<string>());
        Assert.Equal("خالی", r9.State[1]["fn"]!.GetValue<string>());
        Assert.Equal("تکرار", r9.State[2]["fn"]!.GetValue<string>());
        Assert.Equal("تکرار", r9.State[3]["fn"]!.GetValue<string>());
        Assert.Equal(1, r9.State[0]["xyz"]!.GetValue<int>());
        Assert.Equal(daqiIdx, 1);
        Assert.Equal("B", live[daqiIdx]["fn"]!.GetValue<string>());
        Assert.Equal("A", live[0]["fn"]!.GetValue<string>());
    }

    [Fact]
    public void Idempotency_ExactDuplicates_DistinctEmpty_Mixed()
    {
        var exact = C("علی", Phones("09120000001"));
        var firstExact = PhonebookRestoreContract.Merge(Live(exact), BackupPhonebook(PhonebookRestoreSafety.CloneContact(exact)));
        var secondExact = PhonebookRestoreContract.Merge(firstExact.State, BackupPhonebook(PhonebookRestoreSafety.CloneContact(exact)));
        Assert.Equal(firstExact.State.Count, secondExact.State.Count);

        var e1 = C("بی‌تلفن", Phones(), ln: "0");
        var e2 = C("بی‌تلفن", Phones(), ln: "1");
        var firstEmpty = PhonebookRestoreContract.Merge(Live(), BackupPhonebook(e1, e2));
        Assert.Equal(2, firstEmpty.State.Count);
        var secondEmpty = PhonebookRestoreContract.Merge(firstEmpty.State, BackupPhonebook(e1, e2));
        Assert.Equal(2, secondEmpty.State.Count);
        Assert.Equal(0, secondEmpty.Added);

        var mixedLive = Live(C("قدیمی", Phones("0912")), C("خالی", Phones(), ln: "z"));
        var mixedPayload = BackupPhonebook(
            C("قدیمی", Phones("0912")),
            C("خالی", Phones(), ln: "z"),
            C("جدید", Phones("0913")),
            C("خالی", Phones(), ln: "new"));
        var mixed1 = PhonebookRestoreContract.Merge(mixedLive, mixedPayload);
        var mixed2 = PhonebookRestoreContract.Merge(mixed1.State, mixedPayload);
        Assert.Equal(mixed1.State.Count, mixed2.State.Count);
    }

    [Fact]
    public void HistoricalReplay_530EmptyRowsStay530()
    {
        var payload = new List<JsonObject>();
        for (var i = 0; i < 530; i++)
            payload.Add(C("بی‌تلفن", Phones(), ln: i.ToString()));
        var backupArr = new JsonArray();
        foreach (var row in payload) backupArr.Add(row.DeepClone());
        var backup = new JsonObject { ["phonebook"] = backupArr };
        var state = payload.Select(PhonebookRestoreSafety.CloneContact).ToList();
        var counts = new List<int> { state.Count };
        for (var r = 0; r < 4; r++)
        {
            state = PhonebookRestoreContract.Merge(state, backup).State;
            counts.Add(state.Count);
        }
        Assert.Equal(new[] { 530, 530, 530, 530, 530 }, counts);
    }

    [Fact]
    public void HistoricalReplay_40UniquePhonesStay40()
    {
        var payload = new List<JsonObject>();
        for (var i = 0; i < 40; i++)
            payload.Add(C("باشماره", Phones("0912" + (1000000 + i)), ln: i.ToString()));
        var backupArr = new JsonArray();
        foreach (var row in payload) backupArr.Add(row.DeepClone());
        var backup = new JsonObject { ["phonebook"] = backupArr };
        var once = PhonebookRestoreContract.Merge(Live(), backup);
        var twice = PhonebookRestoreContract.Merge(once.State, backup);
        Assert.Equal(40, once.State.Count);
        Assert.Equal(40, twice.State.Count);
    }

    [Fact]
    public void NoDataLoss_MergeNeverDeletes_NoUpdate_NoDaqiChange()
    {
        var live = Live(C("A", Phones("1")), C("B", Phones("2")), C("C", Phones("3")));
        var daqi = new JsonObject { ["id"] = "Q1", ["agencyPhonebookIdx"] = 1 };
        var beforeIdx = daqi["agencyPhonebookIdx"]!.GetValue<int>();
        var beforeB = live[1]["fn"]!.GetValue<string>();
        var beforePhones = live[0]["phones"]!.ToJsonString();
        var result = PhonebookRestoreContract.Merge(live, BackupPhonebook(C("D", Phones("4")), C("A", Phones("1"))));
        Assert.Equal(4, result.State.Count);
        Assert.Equal("A", result.State[0]["fn"]!.GetValue<string>());
        Assert.Equal("B", result.State[1]["fn"]!.GetValue<string>());
        Assert.Equal("C", result.State[2]["fn"]!.GetValue<string>());
        Assert.Equal(beforePhones, result.State[0]["phones"]!.ToJsonString());
        Assert.Equal(beforeB, result.State[1]["fn"]!.GetValue<string>());
        Assert.Equal(beforeIdx, daqi["agencyPhonebookIdx"]!.GetValue<int>());
        Assert.Equal("B", live[beforeIdx]["fn"]!.GetValue<string>());
    }

    [Fact]
    public void OnlyExplicitEmptyArrayClears_OnReplace()
    {
        var live = Live(C("keep", Phones("1")));
        Assert.Equal(PhonebookRestoreContract.ReplaceKeepLive, PhonebookRestoreContract.Replace(live, new JsonObject()).Outcome);
        Assert.Equal(PhonebookRestoreContract.ReplaceKeepLive, PhonebookRestoreContract.Replace(live, new JsonObject { ["phonebook"] = null }).Outcome);
        Assert.Equal(PhonebookRestoreContract.ReplaceKeepLive, PhonebookRestoreContract.Replace(live, new JsonObject { ["phonebook"] = "bad" }).Outcome);
        Assert.Equal(PhonebookRestoreContract.ReplaceClear, PhonebookRestoreContract.Replace(live, new JsonObject { ["phonebook"] = new JsonArray() }).Outcome);
    }

    [Fact]
    public void ContractLivesOnlyInTestsAssembly()
    {
        Assert.Equal("Sirman.Core.Tests", typeof(PhonebookRestoreContract).Namespace);
        var coreBackupDir = Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", "Sirman.Core", "Backup"));
        foreach (var file in Directory.GetFiles(coreBackupDir, "*.cs"))
        {
            var src = File.ReadAllText(file);
            Assert.DoesNotContain("PhonebookRestoreContract", src);
            Assert.DoesNotContain("KEEP_LIVE", src);
        }
    }

    static string HtmlPath() =>
        Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", "..", "Sirman_Final.html"));

    static string ShaUtf8(string s)
    {
        var hash = SHA256.HashData(Encoding.UTF8.GetBytes(s));
        return Convert.ToHexString(hash).ToLowerInvariant();
    }

    static string ExtractFunction(string html, string fnName)
    {
        var match = Regex.Match(html, "(?:async\\s+)?function\\s+" + fnName + "\\s*\\([^)]*\\)\\s*\\{");
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
