using System.Diagnostics;
using System.Text.Json;

namespace Sirman.Core.Updates;

public static class NativeUpdatePaths
{
    public const string JournalFileName = "native-update-journal.json";
    public const string StagingFolderName = "native-staging";
    public const string BackupFolderName = "native-backup";

    public static string DefaultDataRoot =>
        Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Sirman");

    public static string DefaultInstallDirectory => Path.Combine(DefaultDataRoot, "App");

    public static string JournalPath(string dataRoot) =>
        Path.Combine(dataRoot, JournalFileName);

    public static string SafeId(string id)
    {
        if (string.IsNullOrWhiteSpace(id)) return "unknown";
        var chars = id.Trim().Select(c => char.IsLetterOrDigit(c) || c is '.' or '-' ? c : '_').ToArray();
        return new string(chars);
    }
}

/// <summary>
/// Applies a validated SIRMAN_NATIVE_UPDATE package onto an install directory.
/// Does not read or write HTML. Does not apply SIRMAN_UPDATE JSON.
/// </summary>
public static class NativeUpdateApplier
{
    public static NativeUpdateApplyResult Apply(NativeUpdateApplyRequest request)
    {
        if (request is null)
            return NativeUpdateApplyResult.Fail("native-request", "درخواست آپدیت بومی خالی است.");
        if (string.IsNullOrWhiteSpace(request.PackageDirectory) || !Directory.Exists(request.PackageDirectory))
            return NativeUpdateApplyResult.Fail("native-package-missing", "پوشه بسته بومی پیدا نشد.");
        if (string.IsNullOrWhiteSpace(request.InstallDirectory) || !Directory.Exists(request.InstallDirectory))
            return NativeUpdateApplyResult.Fail("native-install-missing", "پوشه نصب پیدا نشد.");
        var dataRoot = string.IsNullOrWhiteSpace(request.DataRoot) ? NativeUpdatePaths.DefaultDataRoot : request.DataRoot;
        Directory.CreateDirectory(dataRoot);
        var journalPath = NativeUpdatePaths.JournalPath(dataRoot);

        var recovered = RecoverIfNeeded(dataRoot, request.InstallDirectory, journalPath);
        if (recovered.Ok == false &&
            recovered.State is NativeUpdateJournalState.Applying
                or NativeUpdateJournalState.RollingBack
                or NativeUpdateJournalState.Failed)
            return recovered;

        var currentAssembly = ReadInstallAssembly(request.InstallDirectory);
        var validated = NativeUpdateValidator.ValidatePackage(request.PackageDirectory, new NativeUpdateValidationOptions
        {
            CurrentAssembly = currentAssembly,
            AllowDowngrade = request.AllowDowngrade
        });
        if (!validated.Ok || validated.Manifest is null)
            return NativeUpdateApplyResult.Fail(validated.Error, validated.Message);

        var manifest = validated.Manifest;
        if (InstallMatches(manifest, request.InstallDirectory))
        {
            var journal = NewJournal(manifest, request, dataRoot, NativeUpdateJournalState.Verified);
            WriteJournal(journalPath, journal);
            return NativeUpdateApplyResult.Pass(NativeUpdateJournalState.Verified, "نسخه بومی از قبل اعمال شده است.", journal, journalPath, manifest, false, false, 0);
        }

        var staged = StagePackage(request.PackageDirectory, dataRoot, manifest);
        if (!staged.Ok)
            return NativeUpdateApplyResult.Fail(staged.Error, staged.Message);

        var stagedValidate = NativeUpdateValidator.ValidatePackage(staged.StagingDirectory!, new NativeUpdateValidationOptions
        {
            CurrentAssembly = currentAssembly,
            AllowDowngrade = request.AllowDowngrade
        });
        if (!stagedValidate.Ok)
            return NativeUpdateApplyResult.Fail(stagedValidate.Error, stagedValidate.Message);

        var journalLive = NewJournal(manifest, request, dataRoot, NativeUpdateJournalState.Prepared);
        journalLive.StagingDirectory = staged.StagingDirectory!;
        journalLive.PackageDirectory = Path.GetFullPath(request.PackageDirectory);
        journalLive.InstallDirectory = Path.GetFullPath(request.InstallDirectory);
        WriteJournal(journalPath, journalLive);

        var processes = request.Processes ?? new DefaultNativeProcessCoordinator();
        var stopped = false;
        if (processes.IsSirmanRunning())
        {
            var stop = processes.StopSirman();
            stopped = true;
            if (!stop.Ok)
            {
                FailJournal(journalPath, journalLive, stop.Error, stop.Message);
                return NativeUpdateApplyResult.Fail(stop.Error, stop.Message, journalLive, journalPath);
            }
        }

        journalLive.State = NativeUpdateJournalState.Applying;
        Touch(journalLive);
        WriteJournal(journalPath, journalLive);

        try
        {
            BackupCurrent(journalLive, manifest);
            WriteJournal(journalPath, journalLive);

            var copies = ReplaceFromStaging(journalLive, manifest, request.TryCopy);
            if (!copies.Ok)
            {
                Rollback(journalLive, journalPath);
                return NativeUpdateApplyResult.Fail(copies.Error, copies.Message, ReadJournal(journalPath), journalPath);
            }

            var verify = VerifyInstall(manifest, journalLive.InstallDirectory);
            if (!verify.Ok)
            {
                Rollback(journalLive, journalPath);
                return NativeUpdateApplyResult.Fail(verify.Error, verify.Message, ReadJournal(journalPath), journalPath);
            }

            journalLive.State = NativeUpdateJournalState.Applied;
            Touch(journalLive);
            WriteJournal(journalPath, journalLive);

            var launched = false;
            if (request.LaunchAfter && request.Launcher is not null)
            {
                var launch = request.Launcher.Launch(journalLive.InstallDirectory);
                launched = launch.Ok;
                if (!launch.Ok)
                {
                    journalLive.Error = launch.Error;
                    journalLive.Message = launch.Message;
                    Touch(journalLive);
                    WriteJournal(journalPath, journalLive);
                }
            }

            var health = VerifyInstall(manifest, journalLive.InstallDirectory);
            if (!health.Ok)
            {
                Rollback(journalLive, journalPath);
                return NativeUpdateApplyResult.Fail(health.Error, health.Message, ReadJournal(journalPath), journalPath);
            }

            journalLive.State = NativeUpdateJournalState.Verified;
            journalLive.Error = null;
            journalLive.Message = "آپدیت بومی اعمال و تأیید شد.";
            Touch(journalLive);
            WriteJournal(journalPath, journalLive);
            RetireBackup(journalLive.BackupDirectory);

            return NativeUpdateApplyResult.Pass(
                NativeUpdateJournalState.Verified,
                journalLive.Message ?? "",
                journalLive,
                journalPath,
                manifest,
                stopped,
                launched,
                copies.CopyAttempts);
        }
        catch (Exception ex)
        {
            try { Rollback(journalLive, journalPath); } catch { /* keep original error */ }
            FailJournal(journalPath, journalLive, "native-apply", ex.Message);
            return NativeUpdateApplyResult.Fail("native-apply", "اعمال آپدیت بومی شکست خورد.", ReadJournal(journalPath), journalPath);
        }
    }

    public static NativeUpdateApplyResult Recover(string dataRoot, string? installDirectory = null)
    {
        if (string.IsNullOrWhiteSpace(dataRoot))
            return NativeUpdateApplyResult.Fail("native-journal-missing", "مسیر journal بومی خالی است.");
        var journalPath = NativeUpdatePaths.JournalPath(dataRoot);
        return RecoverIfNeeded(dataRoot, installDirectory ?? "", journalPath);
    }

    static NativeUpdateApplyResult RecoverIfNeeded(string dataRoot, string installDirectory, string journalPath)
    {
        NativeUpdateJournal? journal = null;
        if (File.Exists(journalPath))
        {
            journal = ReadJournal(journalPath);
            if (journal is null)
                return NativeUpdateApplyResult.Fail("native-journal-invalid", "journal بومی خوانده نشد.");
        }
        if (journal is null) return NativeUpdateApplyResult.Pass(NativeUpdateJournalState.Verified, "journal خالی است.", new NativeUpdateJournal { State = "" }, journalPath, null, false, false, 0);

        if (journal.State is NativeUpdateJournalState.Verified or NativeUpdateJournalState.RolledBack or NativeUpdateJournalState.Prepared or "")
            return NativeUpdateApplyResult.Pass(journal.State, "journal پایدار است.", journal, journalPath, null, false, false, 0);

        if (journal.State is NativeUpdateJournalState.Applied)
        {
            var install = string.IsNullOrWhiteSpace(installDirectory) ? journal.InstallDirectory : installDirectory;
            if (string.IsNullOrWhiteSpace(journal.StagingDirectory) || !Directory.Exists(journal.StagingDirectory))
                return Rollback(journal, journalPath);
            var staged = NativeUpdateValidator.ValidatePackage(journal.StagingDirectory);
            if (!staged.Ok || staged.Manifest is null)
                return Rollback(journal, journalPath);
            var health = VerifyInstall(staged.Manifest, install);
            if (health.Ok)
            {
                journal.State = NativeUpdateJournalState.Verified;
                journal.Error = null;
                journal.Message = "تأیید پس از وقفه انجام شد.";
                Touch(journal);
                WriteJournal(journalPath, journal);
                RetireBackup(journal.BackupDirectory);
                return NativeUpdateApplyResult.Pass(journal.State, journal.Message, journal, journalPath, staged.Manifest, false, false, 0);
            }
            return Rollback(journal, journalPath);
        }

        if (journal.State is NativeUpdateJournalState.Applying or NativeUpdateJournalState.RollingBack)
            return Rollback(journal, journalPath);
        if (journal.State is NativeUpdateJournalState.Failed)
        {
            if (Directory.Exists(journal.BackupDirectory) && journal.BackupFiles.Count > 0)
                return Rollback(journal, journalPath);
            return NativeUpdateApplyResult.Pass(journal.State, journal.Message ?? "شکست قبلی بدون تغییر نصب.", journal, journalPath, null, false, false, 0);
        }

        return NativeUpdateApplyResult.Pass(journal.State, "journal بدون بازیابی.", journal, journalPath, null, false, false, 0);
    }

    static NativeUpdateApplyResult Rollback(NativeUpdateJournal journal, string journalPath)
    {
        journal.State = NativeUpdateJournalState.RollingBack;
        Touch(journal);
        WriteJournal(journalPath, journal);
        try
        {
            if (!Directory.Exists(journal.BackupDirectory) || journal.BackupFiles.Count == 0)
            {
                journal.State = NativeUpdateJournalState.RolledBack;
                journal.Message = "نصب دست نخورده ماند (پشتیبان بومی ساخته نشده بود).";
                Touch(journal);
                WriteJournal(journalPath, journal);
                return NativeUpdateApplyResult.Fail(journal.Error ?? "native-rollback", journal.Message, journal, journalPath);
            }
            Directory.CreateDirectory(journal.InstallDirectory);
            var backed = new HashSet<string>(journal.BackupFiles.Select(f => NativeUpdateAllowList.NormalizeRelative(f.Path)), StringComparer.OrdinalIgnoreCase);
            foreach (var rel in journal.Files)
            {
                var name = NativeUpdateAllowList.NormalizeRelative(rel);
                if (NativeUpdateAllowList.IsForbiddenHtml(name)) continue;
                var dest = Path.Combine(journal.InstallDirectory, name.Replace('/', Path.DirectorySeparatorChar));
                var bak = Path.Combine(journal.BackupDirectory, name.Replace('/', Path.DirectorySeparatorChar));
                if (File.Exists(bak))
                {
                    Directory.CreateDirectory(Path.GetDirectoryName(dest)!);
                    File.Copy(bak, dest, overwrite: true);
                }
                else if (!backed.Contains(name) && File.Exists(dest))
                {
                    File.Delete(dest);
                }
            }

            foreach (var entry in journal.BackupFiles)
            {
                var rel = NativeUpdateAllowList.NormalizeRelative(entry.Path);
                var dest = Path.Combine(journal.InstallDirectory, rel.Replace('/', Path.DirectorySeparatorChar));
                if (!File.Exists(dest))
                    return FailJournal(journalPath, journal, "native-rollback", "فایل پشتیبان پس از بازیابی نیست: " + rel);
                if (!string.Equals(NativeUpdateHasher.Sha256File(dest), entry.Sha256, StringComparison.Ordinal))
                    return FailJournal(journalPath, journal, "native-rollback", "هش پشتیبان پس از بازیابی یکی نیست: " + rel);
            }

            journal.State = NativeUpdateJournalState.RolledBack;
            journal.Error = journal.Error ?? "native-rollback";
            journal.Message = "نسخه بومی قبلی بازگردانده شد.";
            Touch(journal);
            WriteJournal(journalPath, journal);
            return NativeUpdateApplyResult.Fail(journal.Error ?? "native-rollback", journal.Message, journal, journalPath);
        }
        catch (Exception ex)
        {
            return FailJournal(journalPath, journal, "native-rollback", ex.Message);
        }
    }

    static (bool Ok, string Error, string Message, int CopyAttempts) ReplaceFromStaging(
        NativeUpdateJournal journal,
        NativeUpdateManifest manifest,
        Func<string, string, int, bool>? tryCopy)
    {
        var copies = 0;
        var filesRoot = Path.Combine(journal.StagingDirectory, NativeUpdateValidator.FilesDirectoryName);
        var index = 0;
        foreach (var entry in manifest.Files)
        {
            var rel = NativeUpdateAllowList.NormalizeRelative(entry.Path);
            if (NativeUpdateAllowList.IsForbiddenHtml(rel) || NativeUpdateAllowList.IsIllegalPath(rel))
                return (false, "native-html-forbidden", "اعمال HTML در مسیر بومی ممنوع است.", copies);
            var src = Path.Combine(filesRoot, rel.Replace('/', Path.DirectorySeparatorChar));
            var dest = Path.Combine(journal.InstallDirectory, rel.Replace('/', Path.DirectorySeparatorChar));
            Directory.CreateDirectory(Path.GetDirectoryName(dest)!);
            var ok = tryCopy is null ? DefaultCopy(src, dest) : tryCopy(src, dest, index);
            copies++;
            if (!ok)
                return (false, "native-copy", "کپی فایل بومی شکست خورد: " + rel, copies);
            index++;
        }
        return (true, "", "", copies);
    }

    static bool DefaultCopy(string src, string dest)
    {
        var tmp = dest + ".sirman-new";
        File.Copy(src, tmp, overwrite: true);
        File.Copy(tmp, dest, overwrite: true);
        try { File.Delete(tmp); } catch { /* leftover temp is harmless */ }
        return true;
    }

    static void BackupCurrent(NativeUpdateJournal journal, NativeUpdateManifest manifest)
    {
        Directory.CreateDirectory(journal.BackupDirectory);
        journal.BackupFiles = new List<NativeUpdateFileEntry>();
        journal.Files = manifest.Files.Select(f => NativeUpdateAllowList.NormalizeRelative(f.Path)).ToList();
        foreach (var entry in manifest.Files)
        {
            var rel = NativeUpdateAllowList.NormalizeRelative(entry.Path);
            var src = Path.Combine(journal.InstallDirectory, rel.Replace('/', Path.DirectorySeparatorChar));
            if (!File.Exists(src)) continue;
            var dest = Path.Combine(journal.BackupDirectory, rel.Replace('/', Path.DirectorySeparatorChar));
            Directory.CreateDirectory(Path.GetDirectoryName(dest)!);
            File.Copy(src, dest, overwrite: true);
            journal.BackupFiles.Add(new NativeUpdateFileEntry
            {
                Path = rel,
                Sha256 = NativeUpdateHasher.Sha256File(dest),
                Bytes = new FileInfo(dest).Length
            });
        }
        Touch(journal);
    }

    static NativeUpdateValidationResult VerifyInstall(NativeUpdateManifest manifest, string installDirectory)
    {
        foreach (var entry in manifest.Files)
        {
            var rel = NativeUpdateAllowList.NormalizeRelative(entry.Path);
            if (NativeUpdateAllowList.IsForbiddenHtml(rel))
                return NativeUpdateValidationResult.Fail("native-html-forbidden", "HTML در نصب بررسی نمی‌شود.");
            var full = Path.Combine(installDirectory, rel.Replace('/', Path.DirectorySeparatorChar));
            if (!File.Exists(full))
                return NativeUpdateValidationResult.Fail("native-file-missing", "پس از اعمال فایل نیست: " + rel);
            if (new FileInfo(full).Length != entry.Bytes)
                return NativeUpdateValidationResult.Fail("native-size-mismatch", "اندازه پس از اعمال یکی نیست: " + rel);
            if (!string.Equals(NativeUpdateHasher.Sha256File(full), entry.Sha256, StringComparison.Ordinal))
                return NativeUpdateValidationResult.Fail("native-hash-mismatch", "هش پس از اعمال یکی نیست: " + rel);
        }
        return NativeUpdateValidationResult.Pass(manifest);
    }

    static bool InstallMatches(NativeUpdateManifest manifest, string installDirectory)
    {
        foreach (var entry in manifest.Files)
        {
            var rel = NativeUpdateAllowList.NormalizeRelative(entry.Path);
            var full = Path.Combine(installDirectory, rel.Replace('/', Path.DirectorySeparatorChar));
            if (!File.Exists(full)) return false;
            if (new FileInfo(full).Length != entry.Bytes) return false;
            if (!string.Equals(NativeUpdateHasher.Sha256File(full), entry.Sha256, StringComparison.Ordinal))
                return false;
        }
        return true;
    }

    static (bool Ok, string Error, string Message, string? StagingDirectory) StagePackage(string packageDirectory, string dataRoot, NativeUpdateManifest manifest)
    {
        var staging = Path.Combine(dataRoot, NativeUpdatePaths.StagingFolderName, NativeUpdatePaths.SafeId(manifest.Id));
        try
        {
            if (Directory.Exists(staging))
                Directory.Delete(staging, true);
            var destFiles = Path.Combine(staging, NativeUpdateValidator.FilesDirectoryName);
            Directory.CreateDirectory(destFiles);
            File.Copy(
                Path.Combine(packageDirectory, NativeUpdateValidator.ManifestFileName),
                Path.Combine(staging, NativeUpdateValidator.ManifestFileName),
                overwrite: true);
            var srcFiles = Path.Combine(packageDirectory, NativeUpdateValidator.FilesDirectoryName);
            foreach (var entry in manifest.Files)
            {
                var rel = NativeUpdateAllowList.NormalizeRelative(entry.Path);
                if (NativeUpdateAllowList.IsForbiddenHtml(rel))
                    return (false, "native-html-forbidden", "مرحله‌بندی HTML ممنوع است.", null);
                var src = Path.Combine(srcFiles, rel.Replace('/', Path.DirectorySeparatorChar));
                var dest = Path.Combine(destFiles, rel.Replace('/', Path.DirectorySeparatorChar));
                Directory.CreateDirectory(Path.GetDirectoryName(dest)!);
                File.Copy(src, dest, overwrite: true);
            }
            return (true, "", "", staging);
        }
        catch (Exception ex)
        {
            return (false, "native-stage", ex.Message, null);
        }
    }

    static NativeUpdateJournal NewJournal(NativeUpdateManifest manifest, NativeUpdateApplyRequest request, string dataRoot, string state)
    {
        var id = NativeUpdatePaths.SafeId(manifest.Id);
        return new NativeUpdateJournal
        {
            Schema = 1,
            State = state,
            PackageId = manifest.Id,
            Version = manifest.Version,
            Assembly = manifest.Assembly,
            PackageDirectory = Path.GetFullPath(request.PackageDirectory),
            InstallDirectory = Path.GetFullPath(request.InstallDirectory),
            BackupDirectory = Path.Combine(dataRoot, NativeUpdatePaths.BackupFolderName, id),
            Files = manifest.Files.Select(f => NativeUpdateAllowList.NormalizeRelative(f.Path)).ToList(),
            UpdatedAtUtc = DateTime.UtcNow.ToString("o")
        };
    }

    static NativeUpdateJournal? ReadJournal(string path)
    {
        if (!File.Exists(path)) return null;
        try
        {
            return JsonSerializer.Deserialize<NativeUpdateJournal>(File.ReadAllText(path), NativeUpdateJson.Options);
        }
        catch
        {
            return null;
        }
    }

    static void WriteJournal(string path, NativeUpdateJournal journal)
    {
        Directory.CreateDirectory(Path.GetDirectoryName(path)!);
        var tmp = path + ".tmp";
        File.WriteAllText(tmp, JsonSerializer.Serialize(journal, NativeUpdateJson.Options));
        File.Copy(tmp, path, overwrite: true);
        try { File.Delete(tmp); } catch { /* ignore */ }
    }

    static NativeUpdateApplyResult FailJournal(string path, NativeUpdateJournal journal, string error, string message)
    {
        journal.State = NativeUpdateJournalState.Failed;
        journal.Error = error;
        journal.Message = message;
        Touch(journal);
        WriteJournal(path, journal);
        return NativeUpdateApplyResult.Fail(error, message, journal, path);
    }

    static void Touch(NativeUpdateJournal journal) =>
        journal.UpdatedAtUtc = DateTime.UtcNow.ToString("o");

    static void RetireBackup(string? backupDirectory)
    {
        if (string.IsNullOrWhiteSpace(backupDirectory) || !Directory.Exists(backupDirectory))
            return;
        try { Directory.Delete(backupDirectory, true); } catch { /* keep backup if locked */ }
    }

    public static string? ReadInstallAssembly(string installDirectory)
    {
        var path = Path.Combine(installDirectory, "SIRMAN_VERSION.json");
        if (!File.Exists(path)) return null;
        try
        {
            using var doc = JsonDocument.Parse(File.ReadAllText(path));
            return doc.RootElement.TryGetProperty("assembly", out var a) ? a.GetString() : null;
        }
        catch
        {
            return null;
        }
    }
}

public sealed class DefaultNativeProcessCoordinator : INativeProcessCoordinator
{
    public bool IsSirmanRunning()
    {
        try
        {
            foreach (var proc in Process.GetProcessesByName("Sirman"))
            {
                using (proc)
                {
                    if (!IsUpdater(proc)) return true;
                }
            }
        }
        catch { /* process query may fail in sandbox */ }
        return false;
    }

    public NativeUpdateValidationResult StopSirman()
    {
        try
        {
            foreach (var proc in Process.GetProcessesByName("Sirman"))
            {
                using (proc)
                {
                    if (IsUpdater(proc)) continue;
                    try { proc.CloseMainWindow(); } catch { /* ignore */ }
                    if (!proc.WaitForExit(8000))
                    {
                        try { proc.Kill(entireProcessTree: true); } catch { /* ignore */ }
                        if (!proc.WaitForExit(4000))
                            return NativeUpdateValidationResult.Fail("native-process", "فرآیند سیرمان بسته نشد.");
                    }
                }
            }
            return NativeUpdateValidationResult.Pass(new NativeUpdateManifest { Id = "process" });
        }
        catch (Exception ex)
        {
            return NativeUpdateValidationResult.Fail("native-process", ex.Message);
        }
    }

    static bool IsUpdater(Process proc)
    {
        try
        {
            var name = proc.ProcessName ?? "";
            if (name.Contains("Updater", StringComparison.OrdinalIgnoreCase)) return true;
            var module = proc.MainModule?.FileName ?? "";
            return module.Contains("SirmanUpdater", StringComparison.OrdinalIgnoreCase);
        }
        catch
        {
            return false;
        }
    }
}

public sealed class DefaultNativeAppLauncher : INativeAppLauncher
{
    public NativeUpdateValidationResult Launch(string installDirectory)
    {
        var exe = Path.Combine(installDirectory, "Sirman.exe");
        if (!File.Exists(exe))
            return NativeUpdateValidationResult.Fail("native-launch", "Sirman.exe پس از آپدیت پیدا نشد.");
        try
        {
            Process.Start(new ProcessStartInfo
            {
                FileName = exe,
                WorkingDirectory = installDirectory,
                UseShellExecute = true
            });
            return NativeUpdateValidationResult.Pass(new NativeUpdateManifest { Id = "launch" });
        }
        catch (Exception ex)
        {
            return NativeUpdateValidationResult.Fail("native-launch", ex.Message);
        }
    }
}
