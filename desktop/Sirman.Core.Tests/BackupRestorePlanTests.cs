using System.Text.Json;
using System.Text.Json.Nodes;
using Sirman.Core.Backup;
using Sirman.Core.Data.Repositories;
using Xunit;

namespace Sirman.Core.Tests;

/// <summary>
/// ARCH-8 — RestorePlan is decision-only. Applied is always false. HTML Restore is not cut over.
/// </summary>
public class BackupRestorePlanTests
{
    private const long FrozenNow = 1700000000000;

    [Fact]
    public void T1_ValidReplacePlan()
    {
        var backup = Schema1(invoices: A(Rec("invoiceId", "I-new")));
        var current = Schema1(invoices: A(Rec("invoiceId", "I-old")));
        var plan = BackupRestorePlanBuilder.Build(backup, current, RestorePlanMode.Replace, null, FrozenNow);
        Assert.True(plan.Ok);
        Assert.False(plan.Applied);
        Assert.Equal(RestorePlanMode.Replace, plan.Mode);
        var invoices = Sec(plan, "invoices");
        Assert.True(invoices.Selected);
        Assert.Equal(RestorePlanAction.Replace, invoices.Action);
        Assert.Equal(1, invoices.SourceCount);
        Assert.Equal(1, invoices.CurrentCount);
        Assert.Equal(1, invoices.ResultingCount);
        Assert.Equal(1, invoices.ProposedRemovals);
        Assert.Equal("invoiceId", invoices.IdentityKey);
    }

    [Fact]
    public void T2_ValidMergePlan()
    {
        var backup = Schema1(invoices: A(Rec("invoiceId", "I1"), Rec("invoiceId", "I2")));
        var current = Schema1(invoices: A(Rec("invoiceId", "I1")));
        var plan = BackupRestorePlanBuilder.Build(backup, current, RestorePlanMode.Merge, null, FrozenNow);
        Assert.True(plan.Ok);
        Assert.False(plan.Applied);
        var invoices = Sec(plan, "invoices");
        Assert.Equal(RestorePlanAction.Add, invoices.Action);
        Assert.Equal(1, invoices.ProposedAdditions);
        Assert.Equal(1, invoices.Skipped);
        Assert.Equal(2, invoices.ResultingCount);
        Assert.Equal(RestorePlanAction.Skip, invoices.Records[0].Action);
        Assert.Equal(RestorePlanAction.Add, invoices.Records[1].Action);
        Assert.Equal(0, invoices.ProposedUpdates);
    }

    [Fact]
    public void T3_EmptyRequiredCollection_IsValidZeroPlan()
    {
        var backup = Schema1();
        var current = Schema1();
        var plan = BackupRestorePlanBuilder.Build(backup, current, RestorePlanMode.Merge, null, FrozenNow);
        Assert.True(plan.Ok);
        Assert.False(plan.Applied);
        foreach (var name in BackupRestorePlanBuilder.PlannableCollections)
        {
            var s = Sec(plan, name);
            Assert.Equal(0, s.SourceCount);
            Assert.Equal(RestorePlanAction.NoAction, s.Action);
        }
    }

    [Fact]
    public void T4_MissingRequiredCollection_NoPlan()
    {
        var backup = JsonNode.Parse("{\"schemaVersion\":1,\"invoices\":[],\"sales\":[],\"parts\":[],\"accounts\":[]}")!;
        var plan = BackupRestorePlanBuilder.Build(backup, Schema1(), RestorePlanMode.Replace, null, FrozenNow);
        Assert.False(plan.Ok);
        Assert.False(plan.Applied);
        Assert.Equal(BackupValidationStatus.INVALID, plan.Status);
        Assert.Empty(plan.Sections);
        Assert.Null(plan.MigratedData);
    }

    [Fact]
    public void T5_Schema0Legacy_MigratesThenPlans()
    {
        var backup = JsonNode.Parse("{\"warranties\":[],\"invoices\":[]}")!;
        var current = Schema1();
        var plan = BackupRestorePlanBuilder.Build(backup, current, RestorePlanMode.Replace, null, FrozenNow);
        Assert.True(plan.Ok);
        Assert.True(plan.DryRun!.MigrationPerformed);
        Assert.Equal(0, Sec(plan, "sales").SourceCount);
        Assert.Equal(RestorePlanAction.Replace, Sec(plan, "sales").Action);
    }

    [Fact]
    public void T6_DuplicateIdentity_IsConflict()
    {
        var backup = Schema1(invoices: A(Rec("invoiceId", "I1"), Rec("invoiceId", "I1")));
        var current = Schema1();
        var plan = BackupRestorePlanBuilder.Build(backup, current, RestorePlanMode.Merge, null, FrozenNow);
        Assert.True(plan.Ok);
        var invoices = Sec(plan, "invoices");
        Assert.Equal(RestorePlanAction.Conflict, invoices.Action);
        Assert.True(invoices.Conflicts >= 1);
        Assert.Contains(invoices.ConflictDetails, c => c.Reason.Contains("تکراری", StringComparison.Ordinal));
        Assert.DoesNotContain(invoices.Records, r => r.Action == RestorePlanAction.Update);
    }

    [Fact]
    public void T7_ClearIdentityMatch_IsSkip()
    {
        var backup = Schema1(warranties: A(Rec("id", "W1")));
        var current = Schema1(warranties: A(Rec("id", "W1")));
        var plan = BackupRestorePlanBuilder.Build(backup, current, RestorePlanMode.Merge, new[] { "warranties" }, FrozenNow);
        var w = Sec(plan, "warranties");
        Assert.Equal(RestorePlanAction.Skip, w.Action);
        Assert.Equal(1, w.Skipped);
        Assert.Equal(0, w.ProposedAdditions);
    }

    [Fact]
    public void T8_AmbiguousIdentity_IsConflict()
    {
        var backup = Schema1(invoices: A(Rec("invoiceId", "I1")));
        var current = Schema1(invoices: A(Rec("invoiceId", "I1"), Rec("invoiceId", "I1")));
        var plan = BackupRestorePlanBuilder.Build(backup, current, RestorePlanMode.Merge, new[] { "invoices" }, FrozenNow);
        var invoices = Sec(plan, "invoices");
        Assert.Equal(RestorePlanAction.Conflict, invoices.Action);
        Assert.Equal(RestorePlanAction.Conflict, invoices.Records[0].Action);
        Assert.Contains(invoices.ConflictDetails, c => c.Reason.Contains("مبهم", StringComparison.Ordinal));
    }

    [Fact]
    public void T9_MultipleSections()
    {
        var backup = Schema1(
            invoices: A(Rec("invoiceId", "I1")),
            warranties: A(Rec("id", "W1")),
            sales: A(Rec("saleUid", "S1")),
            parts: A(Rec("id", "P1")),
            accounts: A(Rec("id", "A1")));
        var current = Schema1();
        var plan = BackupRestorePlanBuilder.Build(backup, current, RestorePlanMode.Merge, null, FrozenNow);
        Assert.True(plan.Ok);
        Assert.Equal(1, Sec(plan, "invoices").ProposedAdditions);
        Assert.Equal(1, Sec(plan, "warranties").ProposedAdditions);
        Assert.Equal(1, Sec(plan, "sales").ProposedAdditions);
        Assert.Equal(1, Sec(plan, "parts").ProposedAdditions);
        Assert.Equal(1, Sec(plan, "accounts").ProposedAdditions);
    }

    [Fact]
    public void T10_SelectedSubset()
    {
        var backup = Schema1(invoices: A(Rec("invoiceId", "I1")), warranties: A(Rec("id", "W1")));
        var current = Schema1();
        var plan = BackupRestorePlanBuilder.Build(backup, current, RestorePlanMode.Replace, new[] { "invoices" }, FrozenNow);
        Assert.True(Sec(plan, "invoices").Selected);
        Assert.Equal(RestorePlanAction.Replace, Sec(plan, "invoices").Action);
        Assert.False(Sec(plan, "warranties").Selected);
        Assert.Equal(RestorePlanAction.NoAction, Sec(plan, "warranties").Action);
        Assert.Null(Sec(plan, "warranties").ResultingCount);
    }

    [Fact]
    public void T11_OmittedSection_IsNotEmptyReplace()
    {
        var backup = Schema1(invoices: A(Rec("invoiceId", "I1")));
        var current = Schema1(sales: A(Rec("saleUid", "LIVE")));
        var plan = BackupRestorePlanBuilder.Build(backup, current, RestorePlanMode.Replace, new[] { "invoices" }, FrozenNow);
        var sales = Sec(plan, "sales");
        Assert.False(sales.Selected);
        Assert.Equal(RestorePlanAction.NoAction, sales.Action);
        Assert.Equal(0, sales.SourceCount);
        Assert.Null(sales.ResultingCount);
        Assert.NotEqual(0, sales.ResultingCount ?? -1);
    }

    [Fact]
    public void T12_MalformedInput_NoPlan()
    {
        var plan = BackupRestorePlanBuilder.Build(new JsonArray(), Schema1(), RestorePlanMode.Merge, null, FrozenNow);
        Assert.False(plan.Ok);
        Assert.False(plan.Applied);
        Assert.Empty(plan.Sections);
    }

    [Fact]
    public void T13_InvalidChecksum_NoPlan()
    {
        var backup = Schema1();
        backup["checksumAlgo"] = "SHA-256";
        backup["checksum"] = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
        var before = BackupJsJson.Stringify(backup);
        var plan = BackupRestorePlanBuilder.Build(backup, Schema1(), RestorePlanMode.Merge, null, FrozenNow);
        Assert.False(plan.Ok);
        Assert.Equal("INVALID", plan.DryRun!.IntegrityStatus.ToString());
        Assert.Empty(plan.Sections);
        Assert.Equal(before, BackupJsJson.Stringify(backup));
    }

    [Fact]
    public void T14_MigrationRequired_Schema0MissingSales()
    {
        var backup = JsonNode.Parse("{\"warranties\":[],\"invoices\":[]}")!;
        var current = Schema1();
        var plan = BackupRestorePlanBuilder.Build(backup, current, RestorePlanMode.Merge, null, FrozenNow);
        Assert.True(plan.Ok);
        Assert.True(plan.DryRun!.MigrationRequired);
        Assert.True(plan.DryRun.MigrationPerformed);
        Assert.Equal(0, Sec(plan, "sales").SourceCount);
        Assert.True(HasOwn(plan.MigratedData, "sales"));
        Assert.False(HasOwn(backup, "sales"));
    }

    [Fact]
    public void T15_SameInputs_IdenticalFingerprint()
    {
        var backup = Schema1(invoices: A(Rec("invoiceId", "I1")));
        var current = Schema1(invoices: A(Rec("invoiceId", "I0")));
        var a = BackupRestorePlanBuilder.Build(Clone(backup), Clone(current), RestorePlanMode.Merge, new[] { "invoices" }, FrozenNow);
        var b = BackupRestorePlanBuilder.Build(Clone(backup), Clone(current), RestorePlanMode.Merge, new[] { "invoices" }, FrozenNow);
        Assert.Equal(a.Fingerprint, b.Fingerprint);
        Assert.False(string.IsNullOrEmpty(a.Fingerprint));
    }

    [Fact]
    public void T16_InputImmutability()
    {
        var backup = Schema1(invoices: A(Rec("invoiceId", "I1")));
        var current = Schema1(invoices: A(Rec("invoiceId", "I0")));
        var beforeB = BackupJsJson.Stringify(backup);
        var beforeC = BackupJsJson.Stringify(current);
        var plan = BackupRestorePlanBuilder.Build(backup, current, RestorePlanMode.Merge, null, FrozenNow);
        Assert.True(plan.Ok);
        Assert.Equal(beforeB, BackupJsJson.Stringify(backup));
        Assert.Equal(beforeC, BackupJsJson.Stringify(current));
        Assert.False(ReferenceEquals(backup, plan.MigratedData));
    }

    [Fact]
    public void T17_AppliedAlwaysFalse()
    {
        Assert.False(BackupRestorePlanBuilder.Build(Schema1(), Schema1(), RestorePlanMode.Merge, null, FrozenNow).Applied);
        Assert.False(BackupRestorePlanBuilder.Build(Schema1(), Schema1(), RestorePlanMode.Replace, null, FrozenNow).Applied);
        Assert.False(BackupRestorePlanBuilder.Build(null, null, RestorePlanMode.Merge, null, FrozenNow).Applied);
    }

    [Fact]
    public void T18_WarrantiesRegression()
    {
        Assert.False(BackupRestorePlanBuilder.Build(JsonNode.Parse("{\"schemaVersion\":1,\"invoices\":[],\"sales\":[],\"parts\":[],\"accounts\":[]}")!, Schema1(), RestorePlanMode.Merge, null, FrozenNow).Ok);
        var empty = BackupRestorePlanBuilder.Build(Schema1(), Schema1(), RestorePlanMode.Replace, new[] { "warranties" }, FrozenNow);
        Assert.True(empty.Ok);
        Assert.Equal(0, Sec(empty, "warranties").SourceCount);
    }

    [Fact]
    public void T19_InvoicesRegression()
    {
        Assert.False(BackupRestorePlanBuilder.Build(JsonNode.Parse("{\"schemaVersion\":1,\"warranties\":[],\"sales\":[],\"parts\":[],\"accounts\":[]}")!, Schema1(), RestorePlanMode.Replace, null, FrozenNow).Ok);
        var plan = BackupRestorePlanBuilder.Build(Schema1(invoices: A(Rec("invoiceId", "X"))), Schema1(), RestorePlanMode.Merge, new[] { "invoices" }, FrozenNow);
        Assert.Equal("invoiceId", Sec(plan, "invoices").IdentityKey);
        Assert.Equal(RestorePlanAction.Add, Sec(plan, "invoices").Action);
    }

    [Fact]
    public void T20_SalesRegression()
    {
        Assert.False(BackupRestorePlanBuilder.Build(JsonNode.Parse("{\"schemaVersion\":1,\"warranties\":[],\"invoices\":[],\"parts\":[],\"accounts\":[]}")!, Schema1(), RestorePlanMode.Merge, null, FrozenNow).Ok);
        var plan = BackupRestorePlanBuilder.Build(Schema1(sales: A(Rec("saleUid", "S9"))), Schema1(), RestorePlanMode.Merge, new[] { "sales" }, FrozenNow);
        Assert.Equal("saleUid", Sec(plan, "sales").IdentityKey);
        Assert.Equal(1, Sec(plan, "sales").ProposedAdditions);
    }

    [Fact]
    public void T21_PartsRegression()
    {
        Assert.False(BackupRestorePlanBuilder.Build(JsonNode.Parse("{\"schemaVersion\":1,\"warranties\":[],\"invoices\":[],\"sales\":[],\"accounts\":[]}")!, Schema1(), RestorePlanMode.Merge, null, FrozenNow).Ok);
        var plan = BackupRestorePlanBuilder.Build(Schema1(parts: A(Rec("id", "P9"))), Schema1(), RestorePlanMode.Merge, new[] { "parts" }, FrozenNow);
        Assert.Equal("id", Sec(plan, "parts").IdentityKey);
        Assert.Equal(1, Sec(plan, "parts").ProposedAdditions);
    }

    [Fact]
    public void T22_AccountsRegression()
    {
        Assert.False(BackupRestorePlanBuilder.Build(JsonNode.Parse("{\"schemaVersion\":1,\"warranties\":[],\"invoices\":[],\"sales\":[],\"parts\":[]}")!, Schema1(), RestorePlanMode.Merge, null, FrozenNow).Ok);
        var plan = BackupRestorePlanBuilder.Build(Schema1(accounts: A(Rec("id", "A9"))), Schema1(), RestorePlanMode.Merge, new[] { "accounts" }, FrozenNow);
        Assert.Equal("id", Sec(plan, "accounts").IdentityKey);
        Assert.Equal(1, Sec(plan, "accounts").ProposedAdditions);
    }

    [Fact]
    public void GoldenContract_MatchesBuilderIdentityKeys()
    {
        var path = Path.Combine(AppContext.BaseDirectory, "BackupRestorePlanGolden.json");
        Assert.True(File.Exists(path));
        using var doc = JsonDocument.Parse(File.ReadAllText(path));
        var keys = doc.RootElement.GetProperty("identityKeys");
        foreach (var name in BackupRestorePlanBuilder.PlannableCollections)
            Assert.Equal(keys.GetProperty(name).GetString(), BackupRestorePlanBuilder.IdentityKey(name));
        Assert.Equal("phonebook", BackupRestorePlanBuilder.PhonebookSection);
        Assert.DoesNotContain("phonebook", BackupRestorePlanBuilder.PlannableCollections);
    }

    [Fact]
    public void Phonebook_IsExcluded_FromIdentity()
    {
        var backup = Schema1();
        backup["phonebook"] = new JsonArray { Rec("phones", "0912") };
        var current = Schema1();
        current["phonebook"] = new JsonArray { Rec("phones", "0912") };
        var plan = BackupRestorePlanBuilder.Build(backup, current, RestorePlanMode.Merge, new[] { "invoices", "phonebook" }, FrozenNow);
        Assert.True(plan.Ok);
        var pb = plan.Sections.Single(s => s.Name == "phonebook");
        Assert.True(pb.Excluded);
        Assert.Equal(RestorePlanAction.NoAction, pb.Action);
        var src = File.ReadAllText(BuilderPath());
        Assert.DoesNotContain("entryPhone", src);
        Assert.DoesNotContain("savePBContact", src);
        Assert.DoesNotContain("applyBackupMergeSections", src);
        Assert.DoesNotContain("applyBackupReplaceSections", src);
    }

    [Fact]
    public void CurrentStateSnapshot_IsExplicitDto_NotLiveGlobals()
    {
        var backup = Schema1(invoices: A(Rec("invoiceId", "I1")));
        var viaType = BackupRestorePlanBuilder.Build(new RestorePlanRequest
        {
            Data = Clone(backup),
            CurrentSnapshot = CurrentStateSnapshot.From(Schema1()),
            Mode = RestorePlanMode.Merge,
            SelectedSections = new[] { "invoices" },
            NowMs = FrozenNow
        });
        var viaNode = BackupRestorePlanBuilder.Build(Clone(backup), Schema1(), RestorePlanMode.Merge, new[] { "invoices" }, FrozenNow);
        Assert.True(viaType.Ok);
        Assert.True(viaNode.Ok);
        Assert.Equal(viaType.Fingerprint, viaNode.Fingerprint);
        Assert.True(Sec(viaType, "invoices").CurrentStateAvailable);
        Assert.Equal(0, Sec(viaType, "invoices").CurrentCount);
        Assert.DoesNotContain("localStorage", File.ReadAllText(BuilderPath()));
    }

    [Fact]
    public void MergeWithoutCurrentSnapshot_DoesNotTreatMissingAsZero()
    {
        var backup = Schema1(invoices: A(Rec("invoiceId", "I1")));
        var plan = BackupRestorePlanBuilder.Build(backup, null, RestorePlanMode.Merge, new[] { "invoices" }, FrozenNow);
        Assert.True(plan.Ok);
        var invoices = Sec(plan, "invoices");
        Assert.False(invoices.CurrentStateAvailable);
        Assert.Null(invoices.CurrentCount);
        Assert.Null(invoices.ProposedAdditions);
        Assert.Equal(RestorePlanAction.NoAction, invoices.Action);
        Assert.Contains(invoices.Warnings, w => w.Contains("MISSING current", StringComparison.Ordinal));
    }

    [Fact]
    public void InsufficientIdentity_IsConflict_NotGuessed()
    {
        // invoices without invoiceId receive INVUID during field migration; that is
        // not identity guessing in RestorePlan. Accounts do not get an assigned id.
        var backup = Schema1(accounts: A(new JsonObject { ["name"] = "بی‌شناسه" }));
        var current = Schema1();
        var plan = BackupRestorePlanBuilder.Build(backup, current, RestorePlanMode.Merge, new[] { "accounts" }, FrozenNow);
        var accounts = Sec(plan, "accounts");
        Assert.Equal(RestorePlanAction.Conflict, accounts.Action);
        Assert.Equal(RestorePlanAction.Conflict, accounts.Records[0].Action);
        Assert.Contains(accounts.ConflictDetails, c => c.Reason.Contains("ناکافی", StringComparison.Ordinal));
    }

    [Fact]
    public void InvoiceNumFallback_IsNotCopied_MigratorAssignsInvoiceId()
    {
        var backup = Schema1(invoices: A(new JsonObject { ["num"] = "12" }));
        var current = Schema1();
        var plan = BackupRestorePlanBuilder.Build(backup, current, RestorePlanMode.Merge, new[] { "invoices" }, FrozenNow);
        var invoices = Sec(plan, "invoices");
        Assert.Equal("invoiceId", invoices.IdentityKey);
        Assert.Equal(RestorePlanAction.Add, invoices.Records[0].Action);
        Assert.StartsWith("INVUID-", invoices.Records[0].Identity ?? "");
        Assert.DoesNotContain(invoices.ConflictDetails, c => c.Reason.Contains("ناکافی", StringComparison.Ordinal));
    }

    [Fact]
    public void JsonBackupRepository_RemainsTbdStub()
    {
        Assert.Equal("html-backup-engine", JsonBackupRepository.TbdMarker);
    }

    [Fact]
    public void Builder_DoesNotReferenceUiOrBrowserTypes()
    {
        var t = typeof(BackupRestorePlanBuilder);
        Assert.Equal("Sirman.Core.Backup", t.Namespace);
        foreach (var m in t.GetMethods())
        {
            foreach (var p in m.GetParameters())
            {
                var n = p.ParameterType.FullName ?? "";
                Assert.DoesNotContain("System.Windows", n);
                Assert.DoesNotContain("WebView2", n);
                Assert.DoesNotContain("WinForms", n);
            }
        }
        var src = File.ReadAllText(BuilderPath());
        Assert.DoesNotContain("localStorage", src);
        Assert.DoesNotContain("IndexedDB", src);
        Assert.DoesNotContain("sirmanHost", src);
        Assert.Contains("BackupDryRunService.Run", src);
        Assert.Contains("Applied = false", src);
    }

    private static RestorePlanSection Sec(RestorePlan plan, string name) =>
        plan.Sections.Single(s => s.Name == name);

    private static bool HasOwn(JsonNode? n, string key) =>
        n is JsonObject o && o.ContainsKey(key);

    private static JsonNode Clone(JsonNode n) => BackupJsonUtil.CloneExact(n)!;

    private static JsonObject Rec(string key, string value) => new() { [key] = value };

    private static JsonObject Schema1(
        JsonArray? invoices = null,
        JsonArray? warranties = null,
        JsonArray? sales = null,
        JsonArray? parts = null,
        JsonArray? accounts = null)
    {
        return new JsonObject
        {
            ["schemaVersion"] = 1,
            ["warranties"] = warranties ?? new JsonArray(),
            ["invoices"] = invoices ?? new JsonArray(),
            ["sales"] = sales ?? new JsonArray(),
            ["parts"] = parts ?? new JsonArray(),
            ["accounts"] = accounts ?? new JsonArray()
        };
    }

    private static JsonArray A(params JsonObject[] items)
    {
        var a = new JsonArray();
        foreach (var item in items)
            a.Add(item.DeepClone());
        return a;
    }

    private static string BuilderPath() =>
        Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", "Sirman.Core", "Backup", "BackupRestorePlanBuilder.cs"));
}
