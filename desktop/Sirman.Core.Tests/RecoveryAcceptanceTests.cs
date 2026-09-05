using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using Sirman.Core.Backup;
using Sirman.Core.Data.Repositories;
using Xunit;

namespace Sirman.Core.Tests;

/// <summary>
/// ARCH-26 TEST-ONLY Recovery Acceptance locks.
/// No production Restore/Backup/Phonebook/SQLite/Print change.
/// </summary>
public class RecoveryAcceptanceTests
{
    [Fact]
    public void ProductionShaLocks_UnchangedForAcceptance()
    {
        var html = File.ReadAllText(HtmlPath());
        Assert.Equal(PhonebookRestoreContract.AssemblerSha, ShaUtf8(ExtractFunction(html, "_buildFullBackupData")));
        Assert.Equal(PhonebookRestoreContract.SavePbContactSha, ShaUtf8(ExtractFunction(html, "savePBContact")));
        Assert.Equal(PhonebookRestoreContract.CollectAttachmentIndexSha, ShaUtf8(ExtractFunction(html, "collectAttachmentIndex")));
        Assert.Equal(PhonebookRestoreContract.FingerprintSha, ShaUtf8(ExtractFunction(html, "_phonebookCanonicalFingerprint")));
        Assert.Equal(PhonebookRestoreContract.RequiredAdapterSha, ShaUtf8(ExtractFunction(html, "collectRequiredBusinessSnapshot")));
        Assert.Equal(PhonebookRestoreContract.OptionalAdapterSha, ShaUtf8(ExtractFunction(html, "collectOptionalBusinessSnapshot")));
        Assert.Equal(PhonebookRestoreContract.CollectPhonebookSnapshotSha, ShaUtf8(ExtractFunction(html, "collectPhonebookSnapshot")));
        Assert.Equal(PhonebookRestoreContract.MergeSha, ShaUtf8(ExtractFunction(html, "applyBackupMergeSections")));
        Assert.Equal(PhonebookRestoreContract.ReplaceSha, ShaUtf8(ExtractFunction(html, "applyBackupReplaceSections")));
        var build = ExtractFunction(html, "_buildFullBackupData");
        Assert.DoesNotContain("collectPhonebookSnapshot()", build);
        Assert.Contains("phonebook: _safeArr(phonebook)", build);
        Assert.Contains("1405.6.3α", build);
    }

    [Fact]
    public void Fixture_IsSyntheticCopyOnly_NotShopData()
    {
        var json = File.ReadAllText(FixturePath());
        using var doc = JsonDocument.Parse(json);
        var root = doc.RootElement;
        Assert.Equal("ARCH-26", root.GetProperty("packet").GetString());
        Assert.Equal("copy-only-synthetic-recovery-acceptance", root.GetProperty("kind").GetString());
        Assert.False(root.GetProperty("shopVerified").GetBoolean());
        Assert.Equal("1405.6.3α", root.GetProperty("version").GetString());
        Assert.Contains("sirman_media/docs/", root.GetProperty("mediaRel").GetString());
        Assert.StartsWith("disk://", root.GetProperty("mediaDiskRef").GetString());
        Assert.Contains("not-shop-data", root.GetProperty("mediaUtf8").GetString());
        Assert.DoesNotContain("shopVerified\": true", json);
    }

    [Fact]
    public void RestorePlan_StillDoesNotApply()
    {
        var src = File.ReadAllText(Path.Combine(CoreBackupDir(), "BackupRestorePlanBuilder.cs"));
        Assert.Contains("Applied = false", src);
        Assert.DoesNotContain("applyBackupMergeSections", src);
        Assert.DoesNotContain("applyBackupReplaceSections", src);
        Assert.Equal("html-backup-engine", JsonBackupRepository.TbdMarker);
    }

    [Fact]
    public void HostBridges_StillDoNotApplyRestore()
    {
        var host = File.ReadAllText(HostPath());
        Assert.Contains("return Sirman.Core.Backup.BackupDryRunBridge.Execute", host);
        Assert.Contains("return Sirman.Core.Backup.BackupSnapshotConsumer.Execute", host);
        Assert.DoesNotContain("applyBackupReplaceSections", host);
        Assert.DoesNotContain("applyBackupMergeSections", host);
    }

    [Fact]
    public void PrintAndSqlite_Untouched()
    {
        Assert.Contains("internal sealed class WindowsPrintHost", File.ReadAllText(PrintHostPath()));
        Assert.Contains("Sirman.Persistence.Sqlite", File.ReadAllText(SqliteCsprojPath()));
    }

    [Fact]
    public void AcceptanceReport_Exists()
    {
        var report = Path.Combine(RepoRoot(), "deliveries", "Reports", "ARCH-26_RECOVERY_ACCEPTANCE_REPORT.md");
        Assert.True(File.Exists(report), report);
        var text = File.ReadAllText(report);
        Assert.Contains("copy-only synthetic recovery acceptance", text);
        Assert.DoesNotContain("shop verified", text.ToLowerInvariant());
        Assert.Contains("BACKUP / RECOVERY =", text);
        Assert.Contains("Do NOT start ARCH-27", text);
    }

    static string RepoRoot() =>
        Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", ".."));

    static string HtmlPath() => Path.Combine(RepoRoot(), "Sirman_Final.html");

    static string FixturePath() => Path.Combine(RepoRoot(), "desktop", "Sirman.Core.Tests", "RecoveryAcceptanceFixture.json");

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
}
