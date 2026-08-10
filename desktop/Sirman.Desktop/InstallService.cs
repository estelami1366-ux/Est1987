namespace Sirman.Desktop;

/// <summary>
/// نصب محلی در LocalAppData + میانبر منوی Start.
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

            // کپی همه فایل‌های خروجی publish/اجرا
            foreach (var file in Directory.GetFiles(srcDir, "*", SearchOption.TopDirectoryOnly))
            {
                var name = Path.GetFileName(file);
                if (name.EndsWith(".pdb", StringComparison.OrdinalIgnoreCase)) continue;
                File.Copy(file, Path.Combine(dstDir, name), overwrite: true);
            }

            // HTML اگر در ریشه ریپو/کنار بود
            var htmlSrc = Path.Combine(srcDir, "Sirman_Final.html");
            if (!File.Exists(htmlSrc))
            {
                var alt = Directory.GetFiles(srcDir, "Sirman_Final_*.html").OrderByDescending(f => f).FirstOrDefault();
                if (alt != null) htmlSrc = alt;
            }
            if (File.Exists(htmlSrc))
                File.Copy(htmlSrc, Path.Combine(dstDir, "Sirman_Final.html"), overwrite: true);

            var exe = Path.Combine(dstDir, "Sirman.exe");
            if (!File.Exists(exe))
                return new InstallResult { Ok = false, Message = "بعد از کپی، Sirman.exe پیدا نشد." };

            CreateShortcut(StartMenuShortcutPath, exe, dstDir, "سیرمان — خدمات پس از فروش");
            if (createDesktopShortcut)
                CreateShortcut(DesktopShortcutPath, exe, dstDir, "سیرمان — خدمات پس از فروش");

            return new InstallResult
            {
                Ok = true,
                ExePath = exe,
                Message = "نصب شد:\n" + dstDir + "\n\nمیانبر منوی Start ساخته شد."
            };
        }
        catch (Exception ex)
        {
            return new InstallResult { Ok = false, Message = ex.Message };
        }
    }

    public static void CreateShortcut(string lnkPath, string targetExe, string workingDir, string description)
    {
        // WScript.Shell COM — بدون پکیج اضافه
        var shellType = Type.GetTypeFromProgID("WScript.Shell")
            ?? throw new InvalidOperationException("WScript.Shell در دسترس نیست.");
        dynamic shell = Activator.CreateInstance(shellType)!;
        dynamic sc = shell.CreateShortcut(lnkPath);
        sc.TargetPath = targetExe;
        sc.WorkingDirectory = workingDir;
        sc.WindowStyle = 1;
        sc.Description = description;
        sc.IconLocation = targetExe + ",0";
        sc.Save();
    }

    public static void OpenStartMenuFolder()
    {
        var dir = Path.GetDirectoryName(StartMenuShortcutPath)!;
        System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo
        {
            FileName = dir,
            UseShellExecute = true
        });
    }
}
