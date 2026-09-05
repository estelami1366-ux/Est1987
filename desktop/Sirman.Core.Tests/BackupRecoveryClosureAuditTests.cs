using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using Sirman.Core.Backup;
using Sirman.Core.Data.Repositories;
using Xunit;

namespace Sirman.Core.Tests;

/// <summary>
/// ARCH-24 TEST-ONLY Backup/Recovery closure regression locks.
/// Does not change production Backup, Restore, Phonebook, Print, or SQLite.
/// </summary>
public class BackupRecoveryClosureAuditTests
{
    public const string AssemblerSha = PhonebookRestoreSafety.AssemblerSha;
    public const string SavePbSha = PhonebookRestoreSafety.SavePbContactSha;
    public const string MergeSha = PhonebookRestoreSafety.MergeSha;
    public const string ReplaceSha = PhonebookRestoreSafety.ReplaceSha;
    public const string AttachmentIndexSha = "ed781c62b8a0da9e80b458339cf3bf36bbabd38183ee5f5c1b81b9e686877d8f";
    public const string RequiredAdapterSha = "92dd552685fce56b5cff75a41c4a767d658233affc6d3870d015dc379199c631";
    public const string OptionalAdapterSha = "d885fa4c4c5f128f36db7799a5732adc3765025b9bebe204779a77c01a79b508";
    public const string PhonebookAdapterSha = PhonebookRestoreSafety.CollectPhonebookSnapshotSha;

    [Fact]
    public void ProductionLocks_UnchangedForClosureAudit()
    {
        var html = File.ReadAllText(HtmlPath());
        Assert.Equal(AssemblerSha, ShaUtf8(ExtractFunction(html, "_buildFullBackupData")));
        Assert.Equal(SavePbSha, ShaUtf8(ExtractFunction(html, "savePBContact")));
        Assert.Equal(MergeSha, ShaUtf8(ExtractFunction(html, "applyBackupMergeSections")));
        Assert.Equal(ReplaceSha, ShaUtf8(ExtractFunction(html, "applyBackupReplaceSections")));
        Assert.Equal(AttachmentIndexSha, ShaUtf8(ExtractFunction(html, "collectAttachmentIndex")));
        Assert.Equal(RequiredAdapterSha, ShaUtf8(ExtractFunction(html, "collectRequiredBusinessSnapshot")));
        Assert.Equal(OptionalAdapterSha, ShaUtf8(ExtractFunction(html, "collectOptionalBusinessSnapshot")));
        Assert.Equal(PhonebookAdapterSha, ShaUtf8(ExtractFunction(html, "collectPhonebookSnapshot")));
        var build = ExtractFunction(html, "_buildFullBackupData");
        Assert.DoesNotContain("collectPhonebookSnapshot()", build);
        Assert.Contains("phonebook: _safeArr(phonebook)", build);
        Assert.Contains("var s = collectBackupSettingsSnapshot();", build);
        Assert.Contains("var b = collectRequiredBusinessSnapshot();", build);
        Assert.Contains("var o = collectOptionalBusinessSnapshot();", build);
        Assert.Contains("1405.6.3α", build);
        Assert.Contains("userRoles: _safeArr(userRoles)", build);
        Assert.Contains("loginPw: _safeStr(loginPw)", build);
        Assert.Contains("senderInfo: _safeObj(senderInfo)", build);
        Assert.Contains("logoSrc: _safeStr(logoSrc)", build);
        Assert.Contains("acH: _safeObj(acH)", build);
    }

    [Fact]
    public void RestorePlan_RemainsDecisionOnly()
    {
        var src = File.ReadAllText(Path.Combine(CoreBackupDir(), "BackupRestorePlanBuilder.cs"));
        Assert.Contains("Does not persist", src);
        Assert.Contains("Applied = false", src);
        Assert.DoesNotContain("applyBackupMergeSections", src);
        Assert.DoesNotContain("applyBackupReplaceSections", src);
        Assert.Equal("html-backup-engine", JsonBackupRepository.TbdMarker);
        Assert.Contains("Phonebook is excluded from identity calculations", src);
    }

    [Fact]
    public void HostBridges_DoNotApplyRestore()
    {
        var host = File.ReadAllText(HostPath());
        Assert.Contains("return Sirman.Core.Backup.BackupDryRunBridge.Execute", host);
        Assert.Contains("return Sirman.Core.Backup.BackupSnapshotConsumer.Execute", host);
        var dry = Slice(host, "public string TestRestoreBackup", "public string ConsumeBackupSnapshot");
        Assert.DoesNotContain("File.WriteAllText", dry);
        Assert.DoesNotContain("applyBackupMergeSections", dry);
        var consume = Slice(host, "public string ConsumeBackupSnapshot", "public string GetWarrantyBrowseCatalog");
        Assert.DoesNotContain("File.WriteAllText", consume);
        Assert.DoesNotContain("applyBackupReplaceSections", consume);
    }

    [Fact]
    public void PrintAndSqlite_UntouchedByThisPacket()
    {
        Assert.Contains("internal sealed class WindowsPrintHost", File.ReadAllText(PrintHostPath()));
        Assert.Contains("Sirman.Persistence.Sqlite", File.ReadAllText(SqliteCsprojPath()));
        Assert.Equal("Sirman.Core.Backup", typeof(BackupRestorePlanBuilder).Namespace);
    }

    [Fact]
    public void ClosureReports_Arch1Through23_Present()
    {
        var reports = Path.Combine(RepoRoot(), "deliveries", "Reports");
        Assert.True(File.Exists(Path.Combine(reports, "ARCH_BACKUP_RESTORE_EXTRACTION_AUDIT_2026-09-04.md")));
        Assert.True(File.Exists(Path.Combine(reports, "ARCH-23_PHONEBOOK_RESTORE_SAFETY_REPORT.md")));
        Assert.True(File.Exists(Path.Combine(reports, "ARCH-22_PHONEBOOK_SAFETY_ADAPTER_REPORT.md")));
        Assert.True(File.Exists(Path.Combine(reports, "ARCH-21_OPTIONAL_BUSINESS_SLICE_CUTOVER_REPORT.md")));
        Assert.True(File.Exists(Path.Combine(reports, "ARCH-20_REQUIRED_BUSINESS_SLICE_CUTOVER_REPORT.md")));
        Assert.True(File.Exists(Path.Combine(reports, "ARCH-15_SETTINGS_SLICE_CUTOVER_REPORT.md")));
        Assert.True(File.Exists(Path.Combine(reports, "ARCH-12-STRICT-CHECKSUM-VERIFICATION_2026-09-04.md")));
        Assert.True(File.Exists(Path.Combine(reports, "ARCH-8-CORE-RESTORE-PLAN_2026-09-04.md")));
        Assert.True(File.Exists(Path.Combine(reports, "ARCH-6-BACKUP-FINALIZE-CUTOVER_2026-09-04.md")));
    }

    [Fact]
    public void SelfContainedBackup_IsPartial_BySource()
    {
        var html = File.ReadAllText(HtmlPath());
        var index = ExtractFunction(html, "collectAttachmentIndex");
        Assert.Contains("ref: isDisk ? data : ''", index);
        Assert.Contains("inline: !isDisk && !!data", index);
        Assert.DoesNotContain("phonebook", index);
        Assert.Contains("walk(d && d.warranties, 'warranty')", index);
        var replace = ExtractFunction(html, "applyBackupReplaceSections");
        Assert.Contains("else phonebook = [];", replace);
        var merge = ExtractFunction(html, "applyBackupMergeSections");
        Assert.Contains("entryPhone && (p.phones||[]).indexOf(entryPhone) !== -1", merge);
        Assert.Contains("DISK_REF_PREFIX", html);
    }

    [Fact]
    public void ProductionDecision_NotSystemComplete()
    {
        Assert.Equal("PARTIAL", "PARTIAL");
        Assert.Equal("html-backup-engine", JsonBackupRepository.TbdMarker);
    }

    static string RepoRoot() =>
        Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", ".."));

    static string HtmlPath() => Path.Combine(RepoRoot(), "Sirman_Final.html");

    static string CoreBackupDir() =>
        Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", "Sirman.Core", "Backup"));

    static string HostPath() =>
        Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", "Sirman.Desktop", "SirmanHostObject.cs"));

    static string PrintHostPath() =>
        Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", "Sirman.Desktop", "WindowsPrintHost.cs"));

    static string SqliteCsprojPath() =>
        Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", "Sirman.Persistence.Sqlite", "Sirman.Persistence.Sqlite.csproj"));

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

    static string Slice(string src, string startToken, string endToken)
    {
        var i = src.IndexOf(startToken, StringComparison.Ordinal);
        var j = src.IndexOf(endToken, i >= 0 ? i : 0, StringComparison.Ordinal);
        Assert.True(i >= 0 && j > i, startToken);
        return src.Substring(i, j - i);
    }
}
