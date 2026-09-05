using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;
using Xunit;

namespace Sirman.Core.Tests;

/// <summary>
/// ARCH-23 TEST-ONLY Phonebook restore safety forensics.
/// Does not edit production Merge/Replace/savePBContact/assembler.
/// </summary>
public class PhonebookRestoreSafetyTests
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
    public void ProductionLocks_ShaUnchanged()
    {
        var html = File.ReadAllText(HtmlPath());
        Assert.Equal(PhonebookRestoreSafety.AssemblerSha, ShaUtf8(ExtractFunction(html, "_buildFullBackupData")));
        Assert.Equal(PhonebookRestoreSafety.CollectPhonebookSnapshotSha, ShaUtf8(ExtractFunction(html, "collectPhonebookSnapshot")));
        Assert.Equal(PhonebookRestoreSafety.SavePbContactSha, ShaUtf8(ExtractFunction(html, "savePBContact")));
        Assert.Equal(PhonebookRestoreSafety.MergeSha, PhonebookRestoreContract.MergeShaPreArch25);
        Assert.Equal(PhonebookRestoreSafety.ReplaceSha, PhonebookRestoreContract.ReplaceShaPreArch25);
        Assert.Equal(PhonebookRestoreContract.MergeSha, ShaUtf8(ExtractFunction(html, "applyBackupMergeSections")));
        Assert.Equal(PhonebookRestoreContract.ReplaceSha, ShaUtf8(ExtractFunction(html, "applyBackupReplaceSections")));
        var build = ExtractFunction(html, "_buildFullBackupData");
        Assert.DoesNotContain("collectPhonebookSnapshot()", build);
        Assert.Contains("phonebook: _safeArr(phonebook)", build);
        Assert.Contains("1405.6.3α", build);
        Assert.DoesNotContain("id:'PB-", ExtractFunction(html, "savePBContact"));
        Assert.Contains("_phonebookCanonicalFingerprint(entry)", ExtractFunction(html, "applyBackupMergeSections"));
        Assert.Contains("دفترچه زنده حفظ شد", ExtractFunction(html, "applyBackupReplaceSections"));
    }

    [Fact]
    public void NoStablePersistentIdentity_InCurrentSource()
    {
        var html = File.ReadAllText(HtmlPath());
        var save = ExtractFunction(html, "savePBContact");
        Assert.DoesNotContain("id:'PB-", save);
        Assert.Contains("if(idx===-1)phonebook.push(c);else phonebook[idx]=c;", save);
        var live = Live(C("علی", Phones("09120000001")));
        Assert.False(PhonebookRestoreSafety.AnyLiveHasStableId(live));
    }

    [Fact]
    public void Phase1_1_IncomingPhonebookMissing_MergeDoesNotInsertOrClear()
    {
        var live = Live(C("موجود", Phones("09121111111")));
        var backup = new JsonObject();
        var result = PhonebookRestoreSafety.MergeProduction(live, backup);
        Assert.Equal(1, result.State.Count);
        Assert.Equal(0, result.Added);
        Assert.Equal("موجود", result.State[0]["fn"]!.GetValue<string>());
    }

    [Fact]
    public void Phase1_2_IncomingPhonebookEmptyArray_MergeDoesNotInsertOrClear()
    {
        var live = Live(C("موجود", Phones("09121111111")));
        var backup = new JsonObject { ["phonebook"] = new JsonArray() };
        var result = PhonebookRestoreSafety.MergeProduction(live, backup);
        Assert.Equal(1, result.State.Count);
        Assert.Equal(0, result.Added);
    }

    [Fact]
    public void Phase1_3_IncomingNormalPhone_InsertsWhenAbsent()
    {
        var incoming = C("علی", Phones("09120000001"));
        var result = PhonebookRestoreSafety.MergeProduction(Live(), BackupPhonebook(incoming));
        Assert.Equal(1, result.Added);
        Assert.Equal("علی", result.State[0]["fn"]!.GetValue<string>());
        Assert.Equal("09120000001", PhonebookRestoreSafety.EntryPhone(result.State[0]));
    }

    [Fact]
    public void Phase1_4_IncomingEmptyPhone_AlwaysInserts()
    {
        var incoming = C("بی‌تلفن", Phones(), ln: "1");
        var live = Live(C("بی‌تلفن", Phones(), ln: "0"));
        var result = PhonebookRestoreSafety.MergeProduction(live, BackupPhonebook(incoming));
        Assert.Equal(2, result.State.Count);
        Assert.Equal(1, result.Added);
    }

    [Fact]
    public void Phase1_5_IncomingExactCloneWithPhone_Skips()
    {
        var row = C("علی", Phones("09120000001"), note: "same");
        var result = PhonebookRestoreSafety.MergeProduction(Live(row), BackupPhonebook(PhonebookRestoreSafety.CloneContact(row)));
        Assert.Equal(1, result.State.Count);
        Assert.Equal(0, result.Added);
        Assert.Equal(1, result.Skipped);
    }

    [Fact]
    public void Phase1_6_SameNameDifferentPhone_Inserts()
    {
        var live = Live(C("مریم", Phones("09126666661")));
        var incoming = C("مریم", Phones("09126666662"));
        var result = PhonebookRestoreSafety.MergeProduction(live, BackupPhonebook(incoming));
        Assert.Equal(2, result.State.Count);
        Assert.Equal(1, result.Added);
    }

    [Fact]
    public void Phase1_7_MultiplePhones_MatchUsesOnlyIncomingPhones0()
    {
        var live = Live(C("نماینده", Phones("111", "222")));
        var overlapOnSecond = C("دیگر", Phones("222", "333"));
        var skip = PhonebookRestoreSafety.MergeProduction(live, BackupPhonebook(overlapOnSecond));
        Assert.Equal(1, skip.State.Count);
        Assert.Equal(1, skip.Skipped);

        var newFirst = C("دیگر", Phones("333", "222"));
        var add = PhonebookRestoreSafety.MergeProduction(live, BackupPhonebook(newFirst));
        Assert.Equal(2, add.State.Count);
        Assert.Equal(1, add.Added);
    }

    [Fact]
    public void Phase1_8_MissingPhonesField_Inserts()
    {
        var incoming = new JsonObject { ["fn"] = "بدون‌فیلد" };
        var result = PhonebookRestoreSafety.MergeProduction(Live(), BackupPhonebook(incoming));
        Assert.Equal(1, result.Added);
        Assert.False(result.State[0].ContainsKey("phones"));
    }

    [Fact]
    public void Phase1_9_NullPhones_Inserts()
    {
        var incoming = JsonNode.Parse("{\"fn\":\"نال\",\"phones\":null}")!.AsObject();
        Assert.True(incoming.ContainsKey("phones"));
        var result = PhonebookRestoreSafety.MergeProduction(Live(), BackupPhonebook(incoming));
        Assert.Equal(1, result.Added);
        Assert.True(result.State[0].ContainsKey("phones"));
        Assert.True(result.State[0]["phones"] is null || result.State[0]["phones"]!.GetValueKind() == JsonValueKind.Null);
    }

    [Fact]
    public void Phase1_10_ExtraUnknownFields_PreservedOnInsert()
    {
        var incoming = C("extra", Phones("09129999999"));
        incoming["xyz"] = 7;
        incoming["nested"] = new JsonObject { ["k"] = "v" };
        var result = PhonebookRestoreSafety.MergeProduction(Live(), BackupPhonebook(incoming));
        Assert.Equal(1, result.Added);
        Assert.Equal(7, result.State[0]["xyz"]!.GetValue<int>());
        Assert.Equal("v", result.State[0]["nested"]!["k"]!.GetValue<string>());
    }

    [Fact]
    public void Phase1_EmptyPhonebookFallsThroughToPbAlias()
    {
        var live = Live();
        var backup = new JsonObject
        {
            ["phonebook"] = new JsonArray(),
            ["pb"] = new JsonArray { C("از-alias", Phones("09120000009")) }
        };
        var result = PhonebookRestoreSafety.MergeProduction(live, backup);
        Assert.Equal(1, result.Added);
        Assert.Equal("از-alias", result.State[0]["fn"]!.GetValue<string>());
    }

    [Fact]
    public void Phase1_NullFirstPhoneWithSecondPhone_StillInserts()
    {
        var phones = new JsonArray { null, "09120000002" };
        var incoming = C("نال‌اول", phones);
        var live = Live(C("موجود", Phones("09120000002")));
        var result = PhonebookRestoreSafety.MergeProduction(live, BackupPhonebook(incoming));
        Assert.Equal(2, result.State.Count);
        Assert.Equal(1, result.Added);
    }

    [Fact]
    public void Production_SamePhoneDifferentName_SkipsNoUpdate()
    {
        var live = Live(C("قدیمی", Phones("09120000001"), note: "keep"));
        var incoming = C("جدید", Phones("09120000001"), note: "drop");
        var result = PhonebookRestoreSafety.MergeProduction(live, BackupPhonebook(incoming));
        Assert.Equal(1, result.State.Count);
        Assert.Equal(0, result.Added);
        Assert.Equal("قدیمی", result.State[0]["fn"]!.GetValue<string>());
        Assert.Equal("keep", result.State[0]["note"]!.GetValue<string>());
    }

    [Fact]
    public void Replace_ValidArray_ReplacesFullOrderDuplicatesEmpty()
    {
        var live = Live(C("A", Phones("1")), C("B", Phones("2")));
        var empty = C("خالی", Phones());
        var dup = C("تکرار", Phones("9"));
        var incoming = BackupPhonebook(C("X", Phones("a")), empty, PhonebookRestoreSafety.CloneContact(dup), dup);
        var next = PhonebookRestoreSafety.ReplaceProduction(live, incoming);
        Assert.Equal(4, next.Count);
        Assert.Equal("X", next[0]["fn"]!.GetValue<string>());
        Assert.Equal("خالی", next[1]["fn"]!.GetValue<string>());
        Assert.Equal(0, (next[1]["phones"] as JsonArray)!.Count);
        Assert.Equal("تکرار", next[2]["fn"]!.GetValue<string>());
        Assert.Equal("تکرار", next[3]["fn"]!.GetValue<string>());
        Assert.Equal("A", live[0]["fn"]!.GetValue<string>());
    }

    [Fact]
    public void Replace_MissingNullWrongTypeEmpty_ClearsToEmptyArray()
    {
        var live = Live(C("A", Phones("1")));
        Assert.Empty(PhonebookRestoreSafety.ReplaceProduction(live, new JsonObject()));
        Assert.Empty(PhonebookRestoreSafety.ReplaceProduction(live, new JsonObject { ["phonebook"] = null }));
        Assert.Empty(PhonebookRestoreSafety.ReplaceProduction(live, new JsonObject { ["phonebook"] = new JsonObject() }));
        Assert.Empty(PhonebookRestoreSafety.ReplaceProduction(live, new JsonObject { ["phonebook"] = new JsonArray() }));
        Assert.Empty(PhonebookRestoreSafety.ReplaceProduction(live, new JsonObject { ["phonebook"] = "nope" }));
    }

    [Fact]
    public void Replace_PbAliasUsedOnlyWhenPhonebookEmpty()
    {
        var live = Live(C("keep", Phones("1")));
        var legacy = new JsonObject
        {
            ["name"] = "نام خانوادگی",
            ["phone"] = "09120000008"
        };
        var alias = new JsonObject { ["pb"] = new JsonArray { legacy } };
        var next = PhonebookRestoreSafety.ReplaceProduction(live, alias);
        Assert.Single(next);
        Assert.Equal("نام", next[0]["fn"]!.GetValue<string>());
        Assert.Equal("خانوادگی", next[0]["ln"]!.GetValue<string>());
        Assert.Equal("09120000008", PhonebookRestoreSafety.EntryPhone(next[0]));
    }

    [Fact]
    public void Candidate_ExactDuplicateIdempotency_EightCases()
    {
        AssertIdempotentExact("normal-phone", C("علی", Phones("09120000001")));
        AssertIdempotentExact("empty-phone", C("بی‌تلفن", Phones(), ln: "0"));
        var nullPhone = JsonNode.Parse("{\"fn\":\"نال\",\"phones\":null}")!.AsObject();
        AssertIdempotentExact("null-phone", nullPhone);
        var missing = new JsonObject { ["fn"] = "بدون‌فیلد" };
        AssertIdempotentExact("missing-phone", missing);

        var liveName = Live(C("مریم", Phones("09126666661")));
        var otherPhone = C("مریم", Phones("09126666662"));
        var nameDiff = PhonebookRestoreSafety.MergeCandidate(liveName, new[] { otherPhone });
        Assert.Equal(PhonebookRestoreSafety.OutcomeAdd, nameDiff.Rows[0].Outcome);
        var nameDiff2 = PhonebookRestoreSafety.MergeCandidate(nameDiff.State, new[] { otherPhone });
        Assert.Equal(PhonebookRestoreSafety.OutcomeSkipExactDuplicate, nameDiff2.Rows[0].Outcome);
        Assert.Equal(nameDiff.State.Count, nameDiff2.State.Count);

        var livePhone = Live(C("قدیمی", Phones("09120000001")));
        var otherName = C("جدید", Phones("09120000001"));
        var phoneDiff = PhonebookRestoreSafety.MergeCandidate(livePhone, new[] { otherName });
        Assert.Equal(PhonebookRestoreSafety.OutcomeSkipPhoneMatch, phoneDiff.Rows[0].Outcome);
        Assert.Equal(1, phoneDiff.State.Count);

        var liveMeta = Live(C("علی", Phones("09120000001"), note: "a"));
        var meta = C("علی", Phones("09120000001"), note: "b");
        var metaRow = PhonebookRestoreSafety.MergeCandidate(liveMeta, new[] { meta });
        Assert.Equal(PhonebookRestoreSafety.OutcomeSkipPhoneMatch, metaRow.Rows[0].Outcome);
        Assert.Equal("a", liveMeta[0]["note"]!.GetValue<string>());

        var liveMulti = Live(C("نماینده", Phones("111", "222")));
        var overlap = C("دیگر", Phones("222", "333"));
        var overlapRow = PhonebookRestoreSafety.MergeCandidate(liveMulti, new[] { overlap });
        Assert.Equal(PhonebookRestoreSafety.OutcomeSkipPhoneMatch, overlapRow.Rows[0].Outcome);
    }

    [Fact]
    public void Candidate_EmptyPhoneDifferentRow_ConflictNotAdd()
    {
        var live = Live(C("بی‌تلفن", Phones(), ln: "0"));
        var other = C("بی‌تلفن", Phones(), ln: "1");
        var row = PhonebookRestoreSafety.MergeCandidate(live, new[] { other });
        Assert.Equal(PhonebookRestoreSafety.OutcomeConflictEmptyPhone, row.Rows[0].Outcome);
        Assert.Equal(1, row.State.Count);
    }

    [Fact]
    public void Candidate_EmptyPhoneExactClone_Skip()
    {
        var row = C("بی‌تلفن", Phones(), ln: "0");
        var live = Live(row);
        var result = PhonebookRestoreSafety.MergeCandidate(live, new[] { PhonebookRestoreSafety.CloneContact(row) });
        Assert.Equal(PhonebookRestoreSafety.OutcomeSkipExactDuplicate, result.Rows[0].Outcome);
        Assert.Equal(1, result.State.Count);
    }

    [Fact]
    public void Candidate_UniqueEmptyPhoneIntoEmptyState_ConflictNotInsert()
    {
        var incoming = C("بی‌تلفن", Phones(), ln: "0");
        var result = PhonebookRestoreSafety.MergeCandidate(Live(), new[] { incoming });
        Assert.Equal(PhonebookRestoreSafety.OutcomeConflictEmptyPhone, result.Rows[0].Outcome);
        Assert.Empty(result.State);
    }

    [Fact]
    public void Candidate_AmbiguousPhone_ConflictIdentity()
    {
        var live = Live(C("A", Phones("0912")), C("B", Phones("0912")));
        var incoming = C("C", Phones("0912"));
        var result = PhonebookRestoreSafety.MergeCandidate(live, new[] { incoming });
        Assert.Equal(PhonebookRestoreSafety.OutcomeConflictIdentityAmbiguous, result.Rows[0].Outcome);
        Assert.Equal(2, result.State.Count);
    }

    [Fact]
    public void Candidate_InvalidInput()
    {
        Assert.Equal(PhonebookRestoreSafety.OutcomeInvalidInput, PhonebookRestoreSafety.ClassifyCandidate(Live(), JsonValue.Create("x")));
        Assert.Equal(PhonebookRestoreSafety.OutcomeInvalidInput, PhonebookRestoreSafety.ClassifyCandidate(Live(), new JsonArray()));
        Assert.Equal(PhonebookRestoreSafety.OutcomeInvalidInput, PhonebookRestoreSafety.ClassifyCandidate(Live(), null));
        var result = PhonebookRestoreSafety.MergeCandidate(Live(C("A", Phones("1"))), new JsonNode?[] { JsonValue.Create(1) });
        Assert.Equal(PhonebookRestoreSafety.OutcomeInvalidInput, result.Rows[0].Outcome);
        Assert.Single(result.State);
    }

    [Fact]
    public void Candidate_NeverDeletesOrMutatesIncoming_NoUpdate()
    {
        var incoming = C("علی", Phones("09120000001"), note: "orig");
        incoming["xyz"] = 1;
        var before = incoming.ToJsonString();
        var live = Live(C("قدیمی", Phones("09120000001"), note: "keep"));
        var result = PhonebookRestoreSafety.MergeCandidate(live, new[] { incoming });
        Assert.Equal(before, incoming.ToJsonString());
        Assert.Equal("قدیمی", result.State[0]["fn"]!.GetValue<string>());
        Assert.Equal(1, result.State.Count);
        Assert.Equal(PhonebookRestoreSafety.OutcomeSkipPhoneMatch, result.Rows[0].Outcome);
        Assert.All(result.Rows, r => Assert.NotEqual("UPDATE", r.Outcome));
    }

    [Fact]
    public void Candidate_CanonicalFingerprint_IgnoresKeyOrder()
    {
        var a = JsonNode.Parse("{\"fn\":\"x\",\"phones\":[\"1\"],\"note\":\"n\"}")!.AsObject();
        var b = JsonNode.Parse("{\"note\":\"n\",\"phones\":[\"1\"],\"fn\":\"x\"}")!.AsObject();
        Assert.Equal(PhonebookRestoreSafety.CanonicalFingerprint(a), PhonebookRestoreSafety.CanonicalFingerprint(b));
        Assert.NotEqual(
            PhonebookRestoreSafety.CanonicalFingerprint(C("x", Phones())),
            PhonebookRestoreSafety.CanonicalFingerprint(new JsonObject { ["fn"] = "x" }));
    }

    [Fact]
    public void ProductionVsCandidate_EmptyPhoneGrowth()
    {
        var payload = C("بی‌تلفن", Phones(), ln: "0");
        var backup = BackupPhonebook(payload);
        var prod = PhonebookRestoreSafety.ProductionIdempotencyGrowth(Live(), backup);
        Assert.Equal(1, prod.First);
        Assert.Equal(1, prod.Second);

        var cand = PhonebookRestoreSafety.IdempotencyGrowth(Live(), new List<JsonObject> { payload });
        Assert.Equal(0, cand.First);
        Assert.Equal(0, cand.Second);

        var liveWith = Live(payload);
        var candPresent = PhonebookRestoreSafety.IdempotencyGrowth(liveWith, new List<JsonObject> { PhonebookRestoreSafety.CloneContact(payload) });
        Assert.Equal(0, candPresent.First);
        Assert.Equal(0, candPresent.Second);
    }

    [Fact]
    public void Production_NormalPhone_SecondMergeDoesNotGrow()
    {
        var payload = C("علی", Phones("09120000001"));
        var growth = PhonebookRestoreSafety.ProductionIdempotencyGrowth(Live(), BackupPhonebook(payload));
        Assert.Equal(1, growth.First);
        Assert.Equal(0, growth.Second);
    }

    [Fact]
    public void DaqiIndex_DeleteShiftsLogicalContact()
    {
        var book = Live(C("A", Phones("1")), C("B", Phones("2")), C("C", Phones("3")));
        Assert.Equal("B", PhonebookRestoreSafety.DaqiContactAt(book, 1)!["fn"]!.GetValue<string>());
        var after = Live(C("A", Phones("1")), C("C", Phones("3")));
        Assert.Equal("C", PhonebookRestoreSafety.DaqiContactAt(after, 1)!["fn"]!.GetValue<string>());
        Assert.NotEqual(
            PhonebookRestoreSafety.ContactLabel(book[1]),
            PhonebookRestoreSafety.ContactLabel(after[1]));
        Assert.Null(PhonebookRestoreSafety.DaqiContactAt(after, 2));
    }

    [Fact]
    public void NameAloneMustNeverBeIdentity_CandidateAddsSameNameDifferentPhone()
    {
        var live = Live(C("یک‌نام", Phones("111")));
        var incoming = C("یک‌نام", Phones("222"));
        var result = PhonebookRestoreSafety.MergeCandidate(live, new[] { incoming });
        Assert.Equal(PhonebookRestoreSafety.OutcomeAdd, result.Rows[0].Outcome);
        Assert.Equal(2, result.State.Count);
    }

    [Fact]
    public void BackupFixtures_ReadOnly_PhonebookKeyAndEmptyRows()
    {
        var path = Path.Combine(AppContext.BaseDirectory, "PhonebookFixtures.json");
        Assert.True(File.Exists(path));
        var before = File.ReadAllText(path);
        var root = JsonDocument.Parse(before).RootElement;
        Assert.Equal("phonebook", root.GetProperty("backupKey").GetString());
        Assert.Equal("lb", root.GetProperty("storageKey").GetString());
        JsonElement t4 = default, t5 = default, t8 = default;
        foreach (var c in root.GetProperty("cases").EnumerateArray())
        {
            if (c.GetProperty("id").GetString() == "T4") t4 = c;
            if (c.GetProperty("id").GetString() == "T5") t5 = c;
            if (c.GetProperty("id").GetString() == "T8") t8 = c;
        }
        Assert.Equal(2, t4.GetProperty("expected").GetProperty("phonebook").GetArrayLength());
        Assert.Equal(8, t5.GetProperty("expected").GetProperty("phonebook").GetArrayLength());
        Assert.Equal(4, t8.GetProperty("expected").GetProperty("phonebook").GetArrayLength());
        Assert.Equal(before, File.ReadAllText(path));
    }

    [Fact]
    public void RealHistoricalShopBackups_UnavailableOnThisVm()
    {
        var repoRoot = Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", ".."));
        var sirmanBackups = Directory.GetFiles(repoRoot, "*.sirman", SearchOption.AllDirectories);
        Assert.Empty(sirmanBackups);
    }

    [Fact]
    public void ProductionChangeDecision_NotSafeYet()
    {
        Assert.Equal("B. NOT SAFE YET", "B. NOT SAFE YET");
        var empty = C("بی‌تلفن", Phones(), ln: "unique");
        var prodAdds = PhonebookRestoreSafety.MergeProduction(Live(), BackupPhonebook(empty)).Added;
        var candAdds = PhonebookRestoreSafety.MergeCandidate(Live(), new[] { empty }).State.Count;
        Assert.Equal(1, prodAdds);
        Assert.Equal(0, candAdds);
    }

    [Fact]
    public void CandidateModel_LivesOnlyInTestsAssembly()
    {
        Assert.Equal("Sirman.Core.Tests", typeof(PhonebookRestoreSafety).Namespace);
        var coreBackupDir = Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", "Sirman.Core", "Backup"));
        foreach (var file in Directory.GetFiles(coreBackupDir, "*.cs"))
        {
            var src = File.ReadAllText(file);
            Assert.DoesNotContain("MergeCandidate", src);
            Assert.DoesNotContain("CONFLICT_EMPTY_PHONE", src);
        }
    }

    static void AssertIdempotentExact(string label, JsonObject payload)
    {
        var live = Live(payload);
        var clone = PhonebookRestoreSafety.CloneContact(payload);
        var first = PhonebookRestoreSafety.MergeCandidate(live, new[] { clone });
        Assert.True(first.State.Count == live.Count, label + " first must not grow exact clone already present");
        Assert.Equal(PhonebookRestoreSafety.OutcomeSkipExactDuplicate, first.Rows[0].Outcome);
        var second = PhonebookRestoreSafety.MergeCandidate(first.State, new[] { PhonebookRestoreSafety.CloneContact(payload) });
        Assert.Equal(first.State.Count, second.State.Count);
        Assert.Equal(PhonebookRestoreSafety.OutcomeSkipExactDuplicate, second.Rows[0].Outcome);
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
