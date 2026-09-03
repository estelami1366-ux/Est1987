using System.Reflection;
using System.Text;

namespace Sirman.Desktop;

/// <summary>
/// نصب پکیج سیرمان: مسیر را از کاربر می‌پرسد، در همان‌جا کپی می‌کند،
/// میانبر Start/دسکتاپ و Uninstall می‌سازد.
/// </summary>
static class InstallService
{
    public static string InstallLocationFile =>
        Path.Combine(AppPaths.AppDataRoot, "install-location.txt");

    /// <summary>مسیر نصب ذخیره‌شده؛ اگر نبود پیش‌فرض AppData.</summary>
    public static string InstallDir
    {
        get
        {
            try
            {
                if (File.Exists(InstallLocationFile))
                {
                    var p = File.ReadAllText(InstallLocationFile).Trim();
                    if (!string.IsNullOrWhiteSpace(p))
                        return Path.GetFullPath(p);
                }
            }
            catch { /* ignore */ }

            var s = AppPaths.LoadSettings();
            if (!string.IsNullOrWhiteSpace(s.InstallFolder))
                return Path.GetFullPath(s.InstallFolder!);
            return AppPaths.DefaultInstallDir;
        }
    }

    public const string CanonicalStartMenuFolderName = "Sirman";
    public const string CanonicalLaunchShortcutName = "SIRMAN.lnk";
    public const string CanonicalUninstallShortcutName = "Uninstall SIRMAN.lnk";
    public const string CanonicalFullCleanupShortcutName = "SIRMAN Full Cleanup.lnk";
    public const string CanonicalDesktopShortcutName = "Sirman.lnk";

    public static string StartMenuFolder
    {
        get
        {
            var programs = Environment.GetFolderPath(Environment.SpecialFolder.Programs);
            var folder = Path.Combine(programs, CanonicalStartMenuFolderName);
            Directory.CreateDirectory(folder);
            return folder;
        }
    }

    public static string StartMenuShortcutPath =>
        Path.Combine(StartMenuFolder, CanonicalLaunchShortcutName);

    public static string StartMenuUninstallShortcutPath =>
        Path.Combine(StartMenuFolder, CanonicalUninstallShortcutName);

    public static string StartMenuFullCleanupShortcutPath =>
        Path.Combine(StartMenuFolder, CanonicalFullCleanupShortcutName);

    public static string DesktopShortcutPath =>
        Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory), CanonicalDesktopShortcutName);

    public static string UninstallBatName => "Uninstall-Sirman.bat";
    public static string FullCleanupBatName => "Sirman-Full-Cleanup.bat";
    public static string UninstallPs1Name => "Uninstall-Sirman.ps1";
    public static string LifecyclePs1Name => "Sirman-InstallLifecycle.ps1";
    public static string ContractJsonName => "sirman-install-contract.json";
    public static string ManifestJsonName => "sirman-install-manifest.json";

    public sealed class InstallResult
    {
        public bool Ok { get; init; }
        public string Message { get; init; } = "";
        public string? ExePath { get; init; }
        public string? InstallPath { get; init; }
    }

    /// <summary>
    /// نصب پکیج: اگر targetDir خالی باشد، FolderBrowser از کاربر می‌پرسد.
    /// </summary>
    public static InstallResult InstallCurrentBuild(bool createDesktopShortcut = false, string? targetDir = null, IWin32Window? owner = null)
    {
        try
        {
            var srcDir = AppPaths.ExeDir;
            if (string.IsNullOrWhiteSpace(targetDir))
            {
                targetDir = PromptInstallFolder(owner);
                if (string.IsNullOrWhiteSpace(targetDir))
                    return new InstallResult { Ok = false, Message = "نصب لغو شد — مسیری انتخاب نشد." };
            }

            var dstDir = Path.GetFullPath(targetDir.Trim());
            // اگر کاربر ریشه درایو داد، زیرپوشه Sirman بساز
            if (IsDriveRoot(dstDir))
                dstDir = Path.Combine(dstDir, "Sirman");

            Directory.CreateDirectory(dstDir);

            var sameDir = string.Equals(
                Path.GetFullPath(srcDir).TrimEnd('\\', '/'),
                dstDir.TrimEnd('\\', '/'),
                StringComparison.OrdinalIgnoreCase);

            if (!sameDir)
            {
                foreach (var file in Directory.GetFiles(srcDir, "*", SearchOption.TopDirectoryOnly))
                {
                    var name = Path.GetFileName(file);
                    if (name.EndsWith(".pdb", StringComparison.OrdinalIgnoreCase)) continue;
                    File.Copy(file, Path.Combine(dstDir, name), overwrite: true);
                }

                var updSrc = Path.Combine(srcDir, "updates");
                if (Directory.Exists(updSrc))
                {
                    var updDst = Path.Combine(dstDir, "updates");
                    Directory.CreateDirectory(updDst);
                    foreach (var f in Directory.GetFiles(updSrc, "*.json"))
                        File.Copy(f, Path.Combine(updDst, Path.GetFileName(f)), overwrite: true);
                }
            }

            EnsureHtmlInDir(srcDir, dstDir);
            CopyLifecycleFiles(srcDir, dstDir);
            WriteInstallManifest(srcDir, dstDir);
            PruneStaleOwnedFiles(dstDir, srcDir);
            RemoveLegacyShortcuts();

            var exe = Path.Combine(dstDir, "Sirman.exe");
            if (!File.Exists(exe))
                return new InstallResult
                {
                    Ok = false,
                    Message = "بعد از کپی، Sirman.exe در مسیر انتخابی پیدا نشد.\nابتدا build-win.bat را اجرا کنید یا از پوشه publish نصب کنید."
                };

            RememberInstallFolder(dstDir);
            WriteUninstallArtifacts(dstDir);

            CreateShortcut(StartMenuShortcutPath, exe, dstDir, "سیرمان — خدمات پس از فروش");
            CreateUninstallShortcut(dstDir);
            CreateFullCleanupShortcut(dstDir);
            if (createDesktopShortcut)
                CreateShortcut(DesktopShortcutPath, exe, dstDir, "سیرمان — خدمات پس از فروش");

            var unBat = Path.Combine(dstDir, UninstallBatName);
            var msg =
                "✅ نصب پکیج سیرمان تمام شد.\n\n" +
                "مسیر نصب:\n" + dstDir + "\n\n" +
                "اجرا:\n" + exe + "\n\n" +
                "میانبر Start:\n" + StartMenuShortcutPath + "\n" +
                "حذف سالم:\n" + unBat + "\n" +
                "میانبر حذف:\n" + StartMenuUninstallShortcutPath;
            if (createDesktopShortcut)
                msg += "\n\nمیانبر دسکتاپ:\n" + DesktopShortcutPath;

            return new InstallResult { Ok = true, ExePath = exe, InstallPath = dstDir, Message = msg };
        }
        catch (Exception ex)
        {
            return new InstallResult { Ok = false, Message = "نصب ناموفق:\n" + ex.Message };
        }
    }

    public static string? PromptInstallFolder(IWin32Window? owner = null)
    {
        using var dlg = new FolderBrowserDialog
        {
            Description = "پوشه نصب سیرمان را انتخاب کنید (مثلاً D:\\Sirman یا Documents\\Sirman)",
            UseDescriptionForTitle = true,
            ShowNewFolderButton = true
        };

        var suggested = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.MyDocuments),
            "Sirman");
        try
        {
            var cur = InstallDir;
            if (Directory.Exists(cur)) dlg.SelectedPath = cur;
            else if (Directory.Exists(Path.GetDirectoryName(suggested)!))
            {
                Directory.CreateDirectory(suggested);
                dlg.SelectedPath = suggested;
            }
        }
        catch { /* ignore */ }

        var r = owner != null ? dlg.ShowDialog(owner) : dlg.ShowDialog();
        if (r != DialogResult.OK) return null;
        return string.IsNullOrWhiteSpace(dlg.SelectedPath) ? null : dlg.SelectedPath;
    }

    public static void RememberInstallFolder(string folder)
    {
        folder = Path.GetFullPath(folder);
        Directory.CreateDirectory(AppPaths.AppDataRoot);
        File.WriteAllText(InstallLocationFile, folder, Encoding.UTF8);
        var s = AppPaths.LoadSettings();
        s.InstallFolder = folder;
        AppPaths.SaveSettings(s);
    }

    private static bool IsDriveRoot(string path)
    {
        try
        {
            var full = Path.GetFullPath(path).TrimEnd('\\', '/');
            var root = Path.GetPathRoot(full)?.TrimEnd('\\', '/');
            return !string.IsNullOrEmpty(root) &&
                   string.Equals(full, root, StringComparison.OrdinalIgnoreCase);
        }
        catch { return false; }
    }

    public static InstallResult CreateShortcutsOnly(bool desktop)
    {
        try
        {
            var exe = Path.Combine(AppPaths.ExeDir, "Sirman.exe");
            if (!File.Exists(exe))
                exe = Path.Combine(InstallDir, "Sirman.exe");
            if (!File.Exists(exe))
                return new InstallResult { Ok = false, Message = "Sirman.exe پیدا نشد." };

            var work = Path.GetDirectoryName(exe)!;
            RememberInstallFolder(work);
            WriteUninstallArtifacts(work);
            RemoveLegacyShortcuts();
            CreateShortcut(StartMenuShortcutPath, exe, work, "سیرمان — خدمات پس از فروش");
            CreateUninstallShortcut(work);
            CreateFullCleanupShortcut(work);
            if (desktop)
                CreateShortcut(DesktopShortcutPath, exe, work, "سیرمان — خدمات پس از فروش");

            return new InstallResult
            {
                Ok = true,
                ExePath = exe,
                InstallPath = work,
                Message = "میانبر ساخته شد.\nStart: " + StartMenuShortcutPath +
                          "\nحذف: " + StartMenuUninstallShortcutPath +
                          (desktop ? ("\nدسکتاپ: " + DesktopShortcutPath) : "")
            };
        }
        catch (Exception ex)
        {
            return new InstallResult { Ok = false, Message = ex.Message };
        }
    }

    public static void WriteUninstallArtifacts(string targetDir)
    {
        Directory.CreateDirectory(targetDir);
        CopyLifecycleFiles(AppPaths.ExeDir, targetDir);
        File.WriteAllText(Path.Combine(targetDir, UninstallBatName), BuildUninstallBatContent(), new UTF8Encoding(encoderShouldEmitUTF8Identifier: true));
        File.WriteAllText(Path.Combine(targetDir, FullCleanupBatName), BuildFullCleanupBatContent(), new UTF8Encoding(encoderShouldEmitUTF8Identifier: true));
        if (!File.Exists(Path.Combine(targetDir, UninstallPs1Name)))
            File.WriteAllText(Path.Combine(targetDir, UninstallPs1Name), BuildUninstallPs1Fallback(), new UTF8Encoding(encoderShouldEmitUTF8Identifier: true));
        RemoveLegacyShortcuts();
        CreateUninstallShortcut(targetDir);
        CreateFullCleanupShortcut(targetDir);
    }

    public static void CreateUninstallShortcut(string uninstallBatDir)
    {
        var bat = Path.Combine(uninstallBatDir, UninstallBatName);
        if (!File.Exists(bat))
            File.WriteAllText(bat, BuildUninstallBatContent(), new UTF8Encoding(encoderShouldEmitUTF8Identifier: true));

        CreateShortcut(
            StartMenuUninstallShortcutPath,
            bat,
            uninstallBatDir,
            "حذف سالم سیرمان (سطح ۱ — برنامه، نه داده کسب‌وکار)");
    }

    public static void CreateFullCleanupShortcut(string dir)
    {
        var bat = Path.Combine(dir, FullCleanupBatName);
        if (!File.Exists(bat))
            File.WriteAllText(bat, BuildFullCleanupBatContent(), new UTF8Encoding(encoderShouldEmitUTF8Identifier: true));
        CreateShortcut(
            StartMenuFullCleanupShortcutPath,
            bat,
            dir,
            "پاک‌سازی کامل داده سیرمان (سطح ۲ — type CONFIRM)");
    }

    public static InstallResult LaunchUninstall() => LaunchBat(UninstallBatName);

    public static InstallResult LaunchFullCleanup() => LaunchBat(FullCleanupBatName);

    private static InstallResult LaunchBat(string fileName)
    {
        try
        {
            var candidates = new[]
            {
                Path.Combine(AppPaths.ExeDir, fileName),
                Path.Combine(InstallDir, fileName),
            };
            string? bat = candidates.FirstOrDefault(File.Exists);
            if (bat == null)
            {
                WriteUninstallArtifacts(AppPaths.ExeDir);
                bat = Path.Combine(AppPaths.ExeDir, fileName);
            }

            System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo
            {
                FileName = bat,
                WorkingDirectory = Path.GetDirectoryName(bat)!,
                UseShellExecute = true
            });
            return new InstallResult { Ok = true, Message = "پنجره باز شد:\n" + bat };
        }
        catch (Exception ex)
        {
            return new InstallResult { Ok = false, Message = "باز کردن ناموفق:\n" + ex.Message };
        }
    }

    public static void RemoveLegacyShortcuts()
    {
        var programs = Environment.GetFolderPath(Environment.SpecialFolder.Programs);
        var canon = Path.Combine(programs, CanonicalStartMenuFolderName);
        var persianFolder = Path.Combine(programs, "سیرمان");
        if (!string.Equals(persianFolder, canon, StringComparison.OrdinalIgnoreCase) && Directory.Exists(persianFolder))
        {
            foreach (var name in new[] { "سیرمان.lnk", "حذف سیرمان.lnk", CanonicalLaunchShortcutName, CanonicalUninstallShortcutName, CanonicalFullCleanupShortcutName, "Uninstall Sirman.lnk" })
                TryDeleteFile(Path.Combine(persianFolder, name));
            TryDeleteEmptyDir(persianFolder);
        }

        if (Directory.Exists(canon))
        {
            TryDeleteFile(Path.Combine(canon, "سیرمان.lnk"));
            TryDeleteFile(Path.Combine(canon, "حذف سیرمان.lnk"));
        }

        foreach (var desk in DesktopCandidateDirs())
        {
            TryDeleteFile(Path.Combine(desk, "سیرمان.lnk"));
        }
    }

    private static IEnumerable<string> DesktopCandidateDirs()
    {
        var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        void add(string? p)
        {
            if (string.IsNullOrWhiteSpace(p)) return;
            seen.Add(p);
        }
        add(Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory));
        add(Environment.GetFolderPath(Environment.SpecialFolder.Desktop));
        add(Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.UserProfile), "Desktop"));
        add(Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.UserProfile), "OneDrive", "Desktop"));
        return seen;
    }

    private static void TryDeleteFile(string path)
    {
        try { if (File.Exists(path)) File.Delete(path); } catch { /* ignore */ }
    }

    private static void TryDeleteEmptyDir(string path)
    {
        try
        {
            if (Directory.Exists(path) && Directory.GetFileSystemEntries(path).Length == 0)
                Directory.Delete(path);
        }
        catch { /* ignore */ }
    }

    private static void CopyLifecycleFiles(string srcDir, string dstDir)
    {
        Directory.CreateDirectory(dstDir);
        var names = new[] { UninstallPs1Name, LifecyclePs1Name, ContractJsonName, UninstallBatName, FullCleanupBatName };
        var search = new[] { srcDir, AppPaths.ExeDir, AppContext.BaseDirectory };
        foreach (var name in names)
        {
            var dest = Path.Combine(dstDir, name);
            foreach (var root in search)
            {
                var src = Path.Combine(root, name);
                if (!File.Exists(src)) continue;
                if (string.Equals(Path.GetFullPath(src), Path.GetFullPath(dest), StringComparison.OrdinalIgnoreCase))
                    break;
                File.Copy(src, dest, overwrite: true);
                break;
            }
        }
    }

    private static readonly string[] OwnedExactFiles =
    {
        "Sirman.exe", "Sirman.dll", "Sirman.deps.json", "Sirman.runtimeconfig.json",
        "Sirman.Core.dll", "createdump.exe", "Sirman_Final.html",
        "Uninstall-Sirman.bat", "Uninstall-Sirman.ps1", "Sirman-Full-Cleanup.bat",
        "Sirman-InstallLifecycle.ps1", "sirman-install-contract.json", "sirman-install-manifest.json",
        "Sirman_Start.bat", "OPEN_SIRMAN.bat", "sirman_run.ps1", "apply_sirman_update.ps1",
        "Sirman_Pending_Update.json", "SIRMAN_VERSION.json", "Sirman_Install_Shortcuts.ps1",
        "نصب_میانبر_سیرمان.bat", "WebView2Loader.dll", "Laegh_Final.html",
        "coreclr.dll", "clrjit.dll", "clrgc.dll", "clretwrc.dll",
        "hostfxr.dll", "hostpolicy.dll", "PresentationCore.dll", "PresentationUI.dll",
        "PresentationNative_cor3.dll", "Accessibility.dll", "PenImc_cor3.dll",
        "DirectWriteForwarder.dll", "D3DCompiler_47_cor3.dll", "wpfgfx_cor3.dll",
        "WindowsBase.dll", "WindowsFormsIntegration.dll", "ReachFramework.dll",
        "mscorlib.dll", "mscordaccore.dll", "mscordbi.dll", "mscorrc.dll",
        "msquic.dll", "netstandard.dll", "vcruntime140_cor3.dll",
        "راهنمای_نصب_از_صفر.txt", "راهنمای_نصب_و_آپدیت.docx"
    };

    private static readonly string[] OwnedPrefixes =
    {
        "Sirman_Final_", "Laegh_Final_", "Sirman_Update_", "System.", "Microsoft.", "runtime",
        "coreclr", "clrjit", "clrgc", "clretw", "hostfxr", "hostpolicy",
        "Presentation", "Accessibility", "PenImc", "DirectWrite",
        "WindowsBase", "WindowsForms", "UIAutomation", "ReachFramework",
        "wpfgfx", "D3DCompiler", "mscor", "netstandard", "msquic", "vcruntime", "msvcp"
    };

    private static readonly string[] OwnedSuffixes =
    {
        ".pdb", ".resources.dll"
    };

    private static bool IsPreserveDir(string fullPath)
    {
        var parts = fullPath.Split(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar);
        return parts.Any(p => p.Equals("sirman_media", StringComparison.OrdinalIgnoreCase));
    }

    private static bool IsOwnedName(string name)
    {
        if (OwnedExactFiles.Any(x => x.Equals(name, StringComparison.OrdinalIgnoreCase))) return true;
        if (OwnedPrefixes.Any(p => name.StartsWith(p, StringComparison.OrdinalIgnoreCase))) return true;
        if (OwnedSuffixes.Any(s => name.EndsWith(s, StringComparison.OrdinalIgnoreCase))) return true;
        return false;
    }

    private static string RelPath(string root, string full)
    {
        var r = Path.GetFullPath(root).TrimEnd('\\', '/') + Path.DirectorySeparatorChar;
        var f = Path.GetFullPath(full);
        if (f.StartsWith(r, StringComparison.OrdinalIgnoreCase))
            return f.Substring(r.Length).Replace('\\', '/');
        return Path.GetFileName(full);
    }

    private static void WriteInstallManifest(string sourceDir, string destDir)
    {
        try
        {
            var files = Directory.Exists(sourceDir)
                ? Directory.GetFiles(sourceDir, "*", SearchOption.AllDirectories)
                    .Select(f => RelPath(sourceDir, f))
                    .ToArray()
                : Array.Empty<string>();
            var json = System.Text.Json.JsonSerializer.Serialize(new
            {
                schemaVersion = 1,
                writtenAtUtc = DateTime.UtcNow.ToString("o"),
                sourceDir = Path.GetFullPath(sourceDir),
                destDir = Path.GetFullPath(destDir),
                files
            });
            File.WriteAllText(Path.Combine(destDir, ManifestJsonName), json, Encoding.UTF8);
        }
        catch { /* install continues */ }
    }

    private static void PruneStaleOwnedFiles(string destDir, string sourceDir)
    {
        if (!Directory.Exists(destDir)) return;
        var sourceRel = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        if (Directory.Exists(sourceDir))
        {
            foreach (var f in Directory.GetFiles(sourceDir, "*", SearchOption.AllDirectories))
                sourceRel.Add(RelPath(sourceDir, f));
        }

        foreach (var file in Directory.GetFiles(destDir, "*", SearchOption.AllDirectories))
        {
            if (IsPreserveDir(file)) continue;
            var rel = RelPath(destDir, file);
            var name = Path.GetFileName(file);
            var owned = IsOwnedName(name)
                || rel.StartsWith("runtimes/", StringComparison.OrdinalIgnoreCase)
                || rel.StartsWith("updates/Sirman_Update_", StringComparison.OrdinalIgnoreCase);
            if (!owned) continue;
            if (sourceRel.Contains(rel)) continue;
            TryDeleteFile(file);
        }
    }

    private static string BuildUninstallBatContent() => """
@echo off
chcp 65001 >nul
setlocal EnableExtensions
cd /d "%~dp0"
title SIRMAN Uninstall (Level 1)
echo.
echo SIRMAN Level 1 uninstall
echo Removes THIS program copy and installer shortcuts.
echo Does NOT delete WebView2 business data or backups.
echo.
set "PS1=%~dp0Uninstall-Sirman.ps1"
if not exist "%PS1%" (
  echo [ERROR] Uninstall-Sirman.ps1 missing.
  echo Level 1 will not guess another install folder.
  pause
  exit /b 1
)
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%PS1%" -Mode Level1
endlocal
""";

    private static string BuildFullCleanupBatContent() => """
@echo off
chcp 65001 >nul
setlocal EnableExtensions
cd /d "%~dp0"
title SIRMAN Full Cleanup (Level 2)
echo.
echo SIRMAN Full Cleanup is NOT normal uninstall.
echo Business data will be listed. Deletion requires typing: CONFIRM
echo.
set "PS1=%~dp0Uninstall-Sirman.ps1"
if not exist "%PS1%" (
  echo [ERROR] Uninstall-Sirman.ps1 missing.
  echo Full Cleanup will not run.
  pause
  exit /b 1
)
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%PS1%" -Mode Level2
endlocal
""";

    private static string BuildUninstallPs1Fallback() => """
param([ValidateSet('Level1','Level2')][string]$Mode='Level1',[string]$Confirmation='',[switch]$NonInteractive)
$ErrorActionPreference='Stop'
Write-Host '[ERROR] Sirman-InstallLifecycle.ps1 was not shipped with this copy.'
Write-Host 'Refusing to delete files without the lifecycle engine.'
if (-not $NonInteractive) { Read-Host 'Enter' }
exit 1
""";

    private static void EnsureHtmlInDir(string srcDir, string dstDir)
    {
        var htmlSrc = Path.Combine(srcDir, "Sirman_Final.html");
        if (!File.Exists(htmlSrc))
        {
            var alt = Directory.GetFiles(srcDir, "Sirman_Final_*.html").OrderByDescending(f => f).FirstOrDefault();
            if (alt != null) htmlSrc = alt;
        }
        if (File.Exists(htmlSrc))
            File.Copy(htmlSrc, Path.Combine(dstDir, "Sirman_Final.html"), overwrite: true);
    }

    public static void CreateShortcut(string lnkPath, string targetExe, string workingDir, string description)
    {
        Directory.CreateDirectory(Path.GetDirectoryName(lnkPath)!);
        var shellType = Type.GetTypeFromProgID("WScript.Shell")
            ?? throw new InvalidOperationException("WScript.Shell در دسترس نیست (COM).");

        object shell = Activator.CreateInstance(shellType)
            ?? throw new InvalidOperationException("ساخت WScript.Shell ناموفق.");

        object sc = shellType.InvokeMember(
            "CreateShortcut",
            BindingFlags.InvokeMethod,
            null,
            shell,
            new object[] { lnkPath })
            ?? throw new InvalidOperationException("CreateShortcut ناموفق.");

        void Set(string prop, object value) =>
            sc.GetType().InvokeMember(prop, BindingFlags.SetProperty, null, sc, new[] { value });

        Set("TargetPath", targetExe);
        Set("WorkingDirectory", workingDir);
        Set("WindowStyle", 1);
        Set("Description", description);
        try { Set("IconLocation", targetExe + ",0"); } catch { /* optional */ }
        sc.GetType().InvokeMember("Save", BindingFlags.InvokeMethod, null, sc, null);
    }

    public static void OpenStartMenuFolder()
    {
        var dir = StartMenuFolder;
        Directory.CreateDirectory(dir);
        System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo
        {
            FileName = dir,
            UseShellExecute = true
        });
    }
}
