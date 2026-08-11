using System.Reflection;

namespace Sirman.Desktop;

/// <summary>
/// نصب محلی در LocalAppData + میانبر منوی Start / دسکتاپ.
/// </summary>
static class InstallService
{
    public static string InstallDir => AppPaths.DefaultInstallDir;

    public static string StartMenuShortcutPath
    {
        get
        {
            var programs = Environment.GetFolderPath(Environment.SpecialFolder.Programs);
            var folder = Path.Combine(programs, "سیرمان");
            Directory.CreateDirectory(folder);
            return Path.Combine(folder, "سیرمان.lnk");
        }
    }

    public static string DesktopShortcutPath =>
        Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory), "سیرمان.lnk");

    public sealed class InstallResult
    {
        public bool Ok { get; init; }
        public string Message { get; init; } = "";
        public string? ExePath { get; init; }
    }

    public static InstallResult InstallCurrentBuild(bool createDesktopShortcut = false)
    {
        try
        {
            var srcDir = AppPaths.ExeDir;
            var dstDir = InstallDir;
            Directory.CreateDirectory(dstDir);

            var sameDir = string.Equals(
                Path.GetFullPath(srcDir).TrimEnd('\\', '/'),
                Path.GetFullPath(dstDir).TrimEnd('\\', '/'),
                StringComparison.OrdinalIgnoreCase);

            if (!sameDir)
            {
                foreach (var file in Directory.GetFiles(srcDir, "*", SearchOption.TopDirectoryOnly))
                {
                    var name = Path.GetFileName(file);
                    if (name.EndsWith(".pdb", StringComparison.OrdinalIgnoreCase)) continue;
                    File.Copy(file, Path.Combine(dstDir, name), overwrite: true);
                }

                // زیرپوشه updates اگر باشد
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

            var exe = Path.Combine(dstDir, "Sirman.exe");
            if (!File.Exists(exe))
                exe = Path.Combine(srcDir, "Sirman.exe");
            if (!File.Exists(exe))
                return new InstallResult { Ok = false, Message = "Sirman.exe پیدا نشد.\nاز پوشه publish یا محل بیلد اجرا کنید." };

            CreateShortcut(StartMenuShortcutPath, exe, Path.GetDirectoryName(exe)!, "سیرمان — خدمات پس از فروش");
            if (createDesktopShortcut)
                CreateShortcut(DesktopShortcutPath, exe, Path.GetDirectoryName(exe)!, "سیرمان — خدمات پس از فروش");

            var msg = "نصب/میانبر آماده شد.\n\nاجرا:\n" + exe +
                      "\n\nمیانبر Start:\n" + StartMenuShortcutPath;
            if (createDesktopShortcut)
                msg += "\n\nمیانبر دسکتاپ:\n" + DesktopShortcutPath;

            return new InstallResult { Ok = true, ExePath = exe, Message = msg };
        }
        catch (Exception ex)
        {
            return new InstallResult { Ok = false, Message = "نصب ناموفق:\n" + ex.Message };
        }
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
            CreateShortcut(StartMenuShortcutPath, exe, work, "سیرمان — خدمات پس از فروش");
            if (desktop)
                CreateShortcut(DesktopShortcutPath, exe, work, "سیرمان — خدمات پس از فروش");

            return new InstallResult
            {
                Ok = true,
                ExePath = exe,
                Message = "میانبر ساخته شد.\nStart: " + StartMenuShortcutPath +
                          (desktop ? ("\nدسکتاپ: " + DesktopShortcutPath) : "")
            };
        }
        catch (Exception ex)
        {
            return new InstallResult { Ok = false, Message = ex.Message };
        }
    }

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
        var dir = Path.GetDirectoryName(StartMenuShortcutPath)!;
        Directory.CreateDirectory(dir);
        System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo
        {
            FileName = dir,
            UseShellExecute = true
        });
    }
}
