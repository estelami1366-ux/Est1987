using System.Diagnostics;
using System.Text;
using System.Text.Json;
using Sirman.Core.Updates;
using Xunit;

namespace Sirman.Core.Tests;

public class NativeUpdateP1Tests
{
    static NativeUpdateIdentity Id => new()
    {
        Id = "sirman-native-test-p1",
        Version = "1405.6.16α",
        Assembly = "1405.6.16.1",
        MinAssembly = "1405.6.16.1",
        MaxAssembly = "1405.6.16.1"
    };

    const string HtmlMarker = "UNIQUE-HTML-MARKER-P1-APPLY-DO-NOT-COPY";
    const string SqliteMarker = "UNIQUE-SQLITE-MARKER-P1-APPLY";

    [Fact]
    public void Apply_SucceedsInIsolatedTempDirectory()
    {
        using var fx = new Fixture();
        PlantInstall(fx.Install, oldPayload: true);
        PlantSource(fx.Source, oldPayload: false);
        Assert.True(NativeUpdateAssembler.Create(fx.Source, fx.Package, Id).Ok);

        var processes = new RecordingProcessCoordinator { Running = true };
        var launcher = new RecordingAppLauncher();
        var result = NativeUpdateApplier.Apply(fx.Request(processes, launcher, launchAfter: true));

        Assert.True(result.Ok, result.Message);
        Assert.Equal(NativeUpdateJournalState.Verified, result.State);
        Assert.True(result.ProcessStopRequested);
        Assert.Equal(1, processes.StopCalls);
        Assert.False(processes.Running);
        Assert.Equal(1, launcher.LaunchCalls);
        Assert.True(File.Exists(result.JournalPath));
        AssertInstallPayload(fx.Install, oldPayload: false);
        AssertProtectedFilesUntouched(fx.Install);
        Assert.False(Directory.Exists(Path.Combine(fx.DataRoot, NativeUpdatePaths.BackupFolderName, NativeUpdatePaths.SafeId(Id.Id))),
            "backup must be retired after VERIFIED");
        var journal = JsonSerializer.Deserialize<NativeUpdateJournal>(File.ReadAllText(result.JournalPath!), NativeUpdateJson.Options)!;
        Assert.Equal(NativeUpdateJournalState.Verified, journal.State);
        Assert.Equal(fx.Install, journal.InstallDirectory);
    }

    [Fact]
    public void Apply_VersionMismatch_FailsClosed()
    {
        using var fx = new Fixture();
        PlantInstall(fx.Install, oldPayload: true);
        File.WriteAllText(Path.Combine(fx.Install, "SIRMAN_VERSION.json"), """{"app":"1405.6.3α","assembly":"1405.6.3.1"}""");
        var htmlBefore = File.ReadAllText(Path.Combine(fx.Install, "Sirman_Final.html"));
        var exeBefore = File.ReadAllBytes(Path.Combine(fx.Install, "Sirman.exe"));
        PlantSource(fx.Source, oldPayload: false);
        Assert.True(NativeUpdateAssembler.Create(fx.Source, fx.Package, Id).Ok);

        var result = NativeUpdateApplier.Apply(fx.Request());
        Assert.False(result.Ok);
        Assert.Equal("native-version", result.Error);
        Assert.Equal(exeBefore, File.ReadAllBytes(Path.Combine(fx.Install, "Sirman.exe")));
        Assert.Equal(htmlBefore, File.ReadAllText(Path.Combine(fx.Install, "Sirman_Final.html")));
        AssertProtectedFilesUntouched(fx.Install);
    }

    [Fact]
    public void Apply_HashMismatch_FailsClosed()
    {
        using var fx = new Fixture();
        PlantInstall(fx.Install, oldPayload: true);
        PlantSource(fx.Source, oldPayload: false);
        Assert.True(NativeUpdateAssembler.Create(fx.Source, fx.Package, Id).Ok);
        var victim = Path.Combine(fx.Package, "files", "Sirman.dll");
        var bytes = File.ReadAllBytes(victim);
        bytes[0] ^= 0x5A;
        File.WriteAllBytes(victim, bytes);

        var before = File.ReadAllBytes(Path.Combine(fx.Install, "Sirman.dll"));
        var result = NativeUpdateApplier.Apply(fx.Request());
        Assert.False(result.Ok);
        Assert.Equal("native-hash-mismatch", result.Error);
        Assert.Equal(before, File.ReadAllBytes(Path.Combine(fx.Install, "Sirman.dll")));
        AssertProtectedFilesUntouched(fx.Install);
    }

    [Fact]
    public void Apply_UnexpectedFile_FailsClosed()
    {
        using var fx = new Fixture();
        PlantInstall(fx.Install, oldPayload: true);
        PlantSource(fx.Source, oldPayload: false);
        Assert.True(NativeUpdateAssembler.Create(fx.Source, fx.Package, Id).Ok);
        File.WriteAllText(Path.Combine(fx.Package, "files", "extra-unexpected.dll"), "nope");
        var before = File.ReadAllBytes(Path.Combine(fx.Install, "Sirman.exe"));

        var result = NativeUpdateApplier.Apply(fx.Request());
        Assert.False(result.Ok);
        Assert.Equal("native-file-unexpected", result.Error);
        Assert.Equal(before, File.ReadAllBytes(Path.Combine(fx.Install, "Sirman.exe")));
        AssertProtectedFilesUntouched(fx.Install);
    }

    [Fact]
    public void Apply_HtmlInPackage_FailsClosed()
    {
        using var fx = new Fixture();
        PlantInstall(fx.Install, oldPayload: true);
        PlantSource(fx.Source, oldPayload: false);
        Assert.True(NativeUpdateAssembler.Create(fx.Source, fx.Package, Id).Ok);
        var htmlPath = Path.Combine(fx.Package, "files", "Sirman_Final.html");
        File.WriteAllText(htmlPath, "<!DOCTYPE html>" + HtmlMarker);
        var manifest = JsonSerializer.Deserialize<NativeUpdateManifest>(
            File.ReadAllText(Path.Combine(fx.Package, "manifest.json")), NativeUpdateJson.Options)!;
        manifest.Files.Add(new NativeUpdateFileEntry
        {
            Path = "Sirman_Final.html",
            Sha256 = NativeUpdateHasher.Sha256File(htmlPath),
            Bytes = new FileInfo(htmlPath).Length
        });
        File.WriteAllText(Path.Combine(fx.Package, "manifest.json"),
            JsonSerializer.Serialize(manifest, NativeUpdateJson.Options));

        var htmlBefore = File.ReadAllText(Path.Combine(fx.Install, "Sirman_Final.html"));
        var result = NativeUpdateApplier.Apply(fx.Request());
        Assert.False(result.Ok);
        Assert.Equal("native-html-forbidden", result.Error);
        Assert.Equal(htmlBefore, File.ReadAllText(Path.Combine(fx.Install, "Sirman_Final.html")));
        AssertProtectedFilesUntouched(fx.Install);
    }

    [Fact]
    public void Apply_PartialCopy_RollsBack()
    {
        using var fx = new Fixture();
        PlantInstall(fx.Install, oldPayload: true);
        PlantSource(fx.Source, oldPayload: false);
        Assert.True(NativeUpdateAssembler.Create(fx.Source, fx.Package, Id).Ok);
        var htmlBefore = File.ReadAllBytes(Path.Combine(fx.Install, "Sirman_Final.html"));
        var sqliteBefore = File.ReadAllBytes(Path.Combine(fx.Install, "shop.sqlite"));

        var result = NativeUpdateApplier.Apply(fx.Request(tryCopy: (src, dest, index) =>
        {
            if (index >= 1) return false;
            File.Copy(src, dest, overwrite: true);
            return true;
        }));

        Assert.False(result.Ok);
        Assert.Equal("native-copy", result.Error);
        Assert.Equal(NativeUpdateJournalState.RolledBack, result.State);
        AssertInstallPayload(fx.Install, oldPayload: true);
        Assert.Equal(htmlBefore, File.ReadAllBytes(Path.Combine(fx.Install, "Sirman_Final.html")));
        Assert.Equal(sqliteBefore, File.ReadAllBytes(Path.Combine(fx.Install, "shop.sqlite")));
        Assert.True(Directory.Exists(result.BackupDirectory));
    }

    [Fact]
    public void Recover_InterruptedApplyingJournal_RestoresBackup()
    {
        using var fx = new Fixture();
        PlantInstall(fx.Install, oldPayload: true);
        PlantSource(fx.Source, oldPayload: false);
        var assembled = NativeUpdateAssembler.Create(fx.Source, fx.Package, Id);
        Assert.True(assembled.Ok);
        var manifest = assembled.Manifest!;

        var staging = Path.Combine(fx.DataRoot, NativeUpdatePaths.StagingFolderName, NativeUpdatePaths.SafeId(Id.Id));
        Directory.CreateDirectory(staging);
        CopyTree(fx.Package, staging);
        var backup = Path.Combine(fx.DataRoot, NativeUpdatePaths.BackupFolderName, NativeUpdatePaths.SafeId(Id.Id));
        Directory.CreateDirectory(backup);
        var backupFiles = new List<NativeUpdateFileEntry>();
        foreach (var entry in manifest.Files)
        {
            var rel = NativeUpdateAllowList.NormalizeRelative(entry.Path);
            var src = Path.Combine(fx.Install, rel);
            if (!File.Exists(src)) continue;
            var dest = Path.Combine(backup, rel);
            Directory.CreateDirectory(Path.GetDirectoryName(dest)!);
            File.Copy(src, dest, overwrite: true);
            backupFiles.Add(new NativeUpdateFileEntry
            {
                Path = rel,
                Sha256 = NativeUpdateHasher.Sha256File(dest),
                Bytes = new FileInfo(dest).Length
            });
        }
        File.Copy(Path.Combine(staging, "files", "Sirman.dll"), Path.Combine(fx.Install, "Sirman.dll"), overwrite: true);
        Assert.Equal(Encoding.UTF8.GetBytes("new-dll-p1-payload"), File.ReadAllBytes(Path.Combine(fx.Install, "Sirman.dll")));

        var journal = new NativeUpdateJournal
        {
            Schema = 1,
            State = NativeUpdateJournalState.Applying,
            PackageId = manifest.Id,
            Version = manifest.Version,
            Assembly = manifest.Assembly,
            PackageDirectory = fx.Package,
            StagingDirectory = staging,
            InstallDirectory = fx.Install,
            BackupDirectory = backup,
            Files = manifest.Files.Select(f => NativeUpdateAllowList.NormalizeRelative(f.Path)).ToList(),
            BackupFiles = backupFiles,
            UpdatedAtUtc = DateTime.UtcNow.ToString("o")
        };
        Directory.CreateDirectory(fx.DataRoot);
        File.WriteAllText(NativeUpdatePaths.JournalPath(fx.DataRoot), JsonSerializer.Serialize(journal, NativeUpdateJson.Options));

        var recovered = NativeUpdateApplier.Recover(fx.DataRoot, fx.Install);
        Assert.False(recovered.Ok);
        Assert.Equal(NativeUpdateJournalState.RolledBack, recovered.State);
        AssertInstallPayload(fx.Install, oldPayload: true);
        AssertProtectedFilesUntouched(fx.Install);
    }

    [Fact]
    public void Apply_PostApplyHashesMatchManifest()
    {
        using var fx = new Fixture();
        PlantInstall(fx.Install, oldPayload: true);
        PlantSource(fx.Source, oldPayload: false);
        var assembled = NativeUpdateAssembler.Create(fx.Source, fx.Package, Id);
        Assert.True(assembled.Ok);
        var result = NativeUpdateApplier.Apply(fx.Request());
        Assert.True(result.Ok, result.Message);
        Assert.Equal(NativeUpdateJournalState.Verified, result.State);
        foreach (var entry in assembled.Manifest!.Files)
        {
            var full = Path.Combine(fx.Install, NativeUpdateAllowList.NormalizeRelative(entry.Path));
            Assert.True(File.Exists(full));
            Assert.Equal(entry.Bytes, new FileInfo(full).Length);
            Assert.Equal(entry.Sha256, NativeUpdateHasher.Sha256File(full));
        }
        AssertProtectedFilesUntouched(fx.Install);
    }

    [Fact]
    public void Apply_IdempotentSecondRun_DoesNotRecopy()
    {
        using var fx = new Fixture();
        PlantInstall(fx.Install, oldPayload: true);
        PlantSource(fx.Source, oldPayload: false);
        Assert.True(NativeUpdateAssembler.Create(fx.Source, fx.Package, Id).Ok);
        var first = NativeUpdateApplier.Apply(fx.Request());
        Assert.True(first.Ok, first.Message);
        Assert.True(first.CopyAttempts > 0);

        var recovered = NativeUpdateApplier.Recover(fx.DataRoot, fx.Install);
        Assert.True(recovered.Ok, recovered.Message);
        Assert.Equal(NativeUpdateJournalState.Verified, recovered.State);

        var processes = new RecordingProcessCoordinator { Running = true };
        var second = NativeUpdateApplier.Apply(fx.Request(processes));
        Assert.True(second.Ok, second.Message);
        Assert.Equal(NativeUpdateJournalState.Verified, second.State);
        Assert.Equal(0, second.CopyAttempts);
        Assert.False(second.ProcessStopRequested);
        Assert.Equal(0, processes.StopCalls);
        AssertInstallPayload(fx.Install, oldPayload: false);
        AssertProtectedFilesUntouched(fx.Install);
    }

    [Fact]
    public void Apply_ProcessCoordinator_StopsBeforeReplace_AndFailStopLeavesInstall()
    {
        using var fx = new Fixture();
        PlantInstall(fx.Install, oldPayload: true);
        PlantSource(fx.Source, oldPayload: false);
        Assert.True(NativeUpdateAssembler.Create(fx.Source, fx.Package, Id).Ok);

        var fail = new RecordingProcessCoordinator { Running = true, FailStop = true };
        var failed = NativeUpdateApplier.Apply(fx.Request(fail));
        Assert.False(failed.Ok);
        Assert.Equal("native-process", failed.Error);
        Assert.Equal(1, fail.StopCalls);
        AssertInstallPayload(fx.Install, oldPayload: true);
        AssertProtectedFilesUntouched(fx.Install);

        var ok = new RecordingProcessCoordinator { Running = true };
        var applied = NativeUpdateApplier.Apply(fx.Request(ok, launchAfter: false));
        Assert.True(applied.Ok, applied.Message);
        Assert.True(applied.ProcessStopRequested);
        Assert.Equal(1, ok.StopCalls);
        Assert.False(applied.Launched);
        AssertInstallPayload(fx.Install, oldPayload: false);
    }

    [Fact]
    public void UpdaterCli_ApplyNoLaunch_WritesVerifiedJournal()
    {
        using var fx = new Fixture();
        PlantInstall(fx.Install, oldPayload: true);
        PlantSource(fx.Source, oldPayload: false);
        Assert.True(NativeUpdateAssembler.Create(fx.Source, fx.Package, Id).Ok);
        var dll = Path.Combine(AppContext.BaseDirectory, "SirmanUpdater.dll");
        Assert.True(File.Exists(dll), "SirmanUpdater.dll must copy with Core.Tests");

        var psi = new ProcessStartInfo
        {
            FileName = "dotnet",
            ArgumentList =
            {
                dll,
                "--package", fx.Package,
                "--install", fx.Install,
                "--data-root", fx.DataRoot,
                "--no-launch"
            },
            RedirectStandardOutput = true,
            RedirectStandardError = true
        };
        using var proc = Process.Start(psi);
        Assert.NotNull(proc);
        var stdout = proc!.StandardOutput.ReadToEnd();
        proc.WaitForExit(30000);
        Assert.Equal(0, proc.ExitCode);
        Assert.Contains("ok=true", stdout, StringComparison.Ordinal);
        Assert.Contains("state=VERIFIED", stdout, StringComparison.Ordinal);
        AssertInstallPayload(fx.Install, oldPayload: false);
        AssertProtectedFilesUntouched(fx.Install);
    }

    [Fact]
    public void HtmlUpdaterSources_StillUntouched()
    {
        var root = RepoRoot();
        var apply = File.ReadAllText(Path.Combine(root, "apply_sirman_update.ps1"));
        Assert.Contains("replaceAppFile", apply, StringComparison.Ordinal);
        var updater = File.ReadAllText(Path.Combine(root, "desktop", "Sirman.Updater", "Program.cs"));
        Assert.DoesNotContain("Sirman_Final.html", updater, StringComparison.Ordinal);
        Assert.DoesNotContain("UpdateService", updater, StringComparison.Ordinal);
        var applier = File.ReadAllText(Path.Combine(root, "desktop", "Sirman.Core", "Updates", "NativeUpdateApplier.cs"));
        Assert.DoesNotContain("replaceAppFile", applier, StringComparison.Ordinal);
        Assert.DoesNotContain("UpdateService", applier, StringComparison.Ordinal);
    }

    static void PlantSource(string source, bool oldPayload)
    {
        Directory.CreateDirectory(source);
        File.WriteAllBytes(Path.Combine(source, "Sirman.exe"), Encoding.UTF8.GetBytes(oldPayload ? "old-exe-p1" : "new-exe-p1-payload"));
        File.WriteAllBytes(Path.Combine(source, "Sirman.dll"), Encoding.UTF8.GetBytes(oldPayload ? "old-dll-p1" : "new-dll-p1-payload"));
        File.WriteAllBytes(Path.Combine(source, "Sirman.Core.dll"), Encoding.UTF8.GetBytes(oldPayload ? "old-core-p1" : "new-core-p1-payload"));
        File.WriteAllText(Path.Combine(source, "SIRMAN_VERSION.json"), """
            {"app":"1405.6.16α","assembly":"1405.6.16.1"}
            """);
        File.WriteAllText(Path.Combine(source, "Sirman_Final.html"), "<!DOCTYPE html>SOURCE-HTML-MUST-NOT-SHIP");
    }

    static void PlantInstall(string install, bool oldPayload)
    {
        Directory.CreateDirectory(install);
        File.WriteAllBytes(Path.Combine(install, "Sirman.exe"), Encoding.UTF8.GetBytes(oldPayload ? "old-exe-p1" : "new-exe-p1-payload"));
        File.WriteAllBytes(Path.Combine(install, "Sirman.dll"), Encoding.UTF8.GetBytes(oldPayload ? "old-dll-p1" : "new-dll-p1-payload"));
        File.WriteAllBytes(Path.Combine(install, "Sirman.Core.dll"), Encoding.UTF8.GetBytes(oldPayload ? "old-core-p1" : "new-core-p1-payload"));
        File.WriteAllText(Path.Combine(install, "SIRMAN_VERSION.json"), """
            {"app":"1405.6.16α","assembly":"1405.6.16.1"}
            """);
        File.WriteAllText(Path.Combine(install, "Sirman_Final.html"), "<!DOCTYPE html>" + HtmlMarker);
        File.WriteAllText(Path.Combine(install, "shop.sqlite"), SqliteMarker);
        File.WriteAllText(Path.Combine(install, "local-notes.txt"), "unrelated-must-stay");
    }

    static void AssertInstallPayload(string install, bool oldPayload)
    {
        Assert.Equal(Encoding.UTF8.GetBytes(oldPayload ? "old-exe-p1" : "new-exe-p1-payload"), File.ReadAllBytes(Path.Combine(install, "Sirman.exe")));
        Assert.Equal(Encoding.UTF8.GetBytes(oldPayload ? "old-dll-p1" : "new-dll-p1-payload"), File.ReadAllBytes(Path.Combine(install, "Sirman.dll")));
        Assert.Equal(Encoding.UTF8.GetBytes(oldPayload ? "old-core-p1" : "new-core-p1-payload"), File.ReadAllBytes(Path.Combine(install, "Sirman.Core.dll")));
    }

    static void AssertProtectedFilesUntouched(string install)
    {
        Assert.Equal("<!DOCTYPE html>" + HtmlMarker, File.ReadAllText(Path.Combine(install, "Sirman_Final.html")));
        Assert.Equal(SqliteMarker, File.ReadAllText(Path.Combine(install, "shop.sqlite")));
        Assert.Equal("unrelated-must-stay", File.ReadAllText(Path.Combine(install, "local-notes.txt")));
    }

    static void CopyTree(string source, string dest)
    {
        Directory.CreateDirectory(dest);
        foreach (var dir in Directory.GetDirectories(source, "*", SearchOption.AllDirectories))
        {
            var rel = Path.GetRelativePath(source, dir);
            Directory.CreateDirectory(Path.Combine(dest, rel));
        }
        foreach (var file in Directory.GetFiles(source, "*", SearchOption.AllDirectories))
        {
            var rel = Path.GetRelativePath(source, file);
            var target = Path.Combine(dest, rel);
            Directory.CreateDirectory(Path.GetDirectoryName(target)!);
            File.Copy(file, target, overwrite: true);
        }
    }

    static string RepoRoot()
    {
        var dir = new DirectoryInfo(AppContext.BaseDirectory);
        while (dir != null)
        {
            if (File.Exists(Path.Combine(dir.FullName, "SIRMAN_VERSION.json")) &&
                File.Exists(Path.Combine(dir.FullName, "scripts", "assemble_sirman_native_update.py")))
                return dir.FullName;
            dir = dir.Parent;
        }
        throw new DirectoryNotFoundException("repo root not found");
    }

    sealed class Fixture : IDisposable
    {
        public string Root { get; } = Path.Combine(Path.GetTempPath(), "sirman-native-p1-" + Guid.NewGuid().ToString("N"));
        public string Source => Path.Combine(Root, "src");
        public string Package => Path.Combine(Root, "pkg");
        public string Install => Path.Combine(Root, "install");
        public string DataRoot => Path.Combine(Root, "data");

        public Fixture()
        {
            Directory.CreateDirectory(Source);
            Directory.CreateDirectory(Package);
            Directory.CreateDirectory(Install);
            Directory.CreateDirectory(DataRoot);
        }

        public NativeUpdateApplyRequest Request(
            INativeProcessCoordinator? processes = null,
            INativeAppLauncher? launcher = null,
            Func<string, string, int, bool>? tryCopy = null,
            bool launchAfter = false) =>
            new()
            {
                PackageDirectory = Package,
                InstallDirectory = Install,
                DataRoot = DataRoot,
                LaunchAfter = launchAfter,
                Processes = processes ?? new RecordingProcessCoordinator(),
                Launcher = launcher,
                TryCopy = tryCopy
            };

        public void Dispose()
        {
            try { Directory.Delete(Root, true); } catch { /* ignore */ }
        }
    }
}
