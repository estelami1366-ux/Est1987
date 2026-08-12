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

    public static string StartMenuFolder
    {
        get
        {
            var programs = Environment.GetFolderPath(Environment.SpecialFolder.Programs);
            var folder = Path.Combine(programs, "سیرمان");
            Directory.CreateDirectory(folder);
            return folder;
        }
    }

    public static string StartMenuShortcutPath =>
        Path.Combine(StartMenuFolder, "سیرمان.lnk");

    public static string StartMenuUninstallShortcutPath =>
        Path.Combine(StartMenuFolder, "حذف سیرمان.lnk");

    public static string DesktopShortcutPath =>
        Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory), "سیرمان.lnk");

    public static string UninstallBatName => "Uninstall-Sirman.bat";

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
            CreateShortcut(StartMenuShortcutPath, exe, work, "سیرمان — خدمات پس از فروش");
            CreateUninstallShortcut(work);
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
        var batPath = Path.Combine(targetDir, UninstallBatName);
        File.WriteAllText(batPath, BuildUninstallBatContent(), new UTF8Encoding(encoderShouldEmitUTF8Identifier: true));
        CreateUninstallShortcut(targetDir);
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
            "حذف سالم سیرمان (Uninstall)");
    }

    public static InstallResult LaunchUninstall()
    {
        try
        {
            var candidates = new[]
            {
                Path.Combine(AppPaths.ExeDir, UninstallBatName),
                Path.Combine(InstallDir, UninstallBatName),
            };
            string? bat = candidates.FirstOrDefault(File.Exists);
            if (bat == null)
            {
                WriteUninstallArtifacts(AppPaths.ExeDir);
                bat = Path.Combine(AppPaths.ExeDir, UninstallBatName);
            }

            System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo
            {
                FileName = bat,
                WorkingDirectory = Path.GetDirectoryName(bat)!,
                UseShellExecute = true
            });
            return new InstallResult { Ok = true, Message = "پنجره حذف باز شد:\n" + bat };
        }
        catch (Exception ex)
        {
            return new InstallResult { Ok = false, Message = "باز کردن حذف ناموفق:\n" + ex.Message };
        }
    }

    private static string BuildUninstallBatContent() => """
@echo off
chcp 65001 >nul
setlocal EnableExtensions
cd /d "%~dp0"

title حذف سیرمان
color 0C

rem مسیر نصب = همین پوشه‌ای که Uninstall از آن اجرا شده (مسیر انتخاب‌شده هنگام نصب)
set "INSTALL_DIR=%~dp0"
if "%INSTALL_DIR:~-1%"=="\" set "INSTALL_DIR=%INSTALL_DIR:~0,-1%"
set "APP_ROOT=%LOCALAPPDATA%\Sirman"
set "LOC_FILE=%APP_ROOT%\install-location.txt"
set "START_DIR=%APPDATA%\Microsoft\Windows\Start Menu\Programs\سیرمان"
set "DESKTOP_LNK=%USERPROFILE%\Desktop\سیرمان.lnk"
set "DESKTOP_LNK2=%USERPROFILE%\OneDrive\Desktop\سیرمان.lnk"

echo.
echo ===============================================
echo   حذف سالم سیرمان (Uninstall)
echo ===============================================
echo.
echo مسیر نصب:
echo   %INSTALL_DIR%
echo.
echo این کار انجام می‌شود:
echo   - بستن Sirman.exe در صورت اجرا
echo   - حذف میانبر Start و دسکتاپ
echo   - حذف پوشه نصب بالا
echo.
echo داده بک‌آپ و تنظیمات AppData در صورت تمایل جداگانه پرسیده می‌شود.
echo.

choice /C YN /M "حذف سیرمان انجام شود؟"
if errorlevel 2 (
  echo انصراف.
  pause
  exit /b 0
)

echo.
echo [1/4] بستن برنامه در صورت اجرا...
taskkill /F /IM Sirman.exe >nul 2>&1
timeout /t 1 /nobreak >nul

echo [2/4] حذف میانبرها...
if exist "%START_DIR%" rd /s /q "%START_DIR%" 2>nul
if exist "%DESKTOP_LNK%" del /f /q "%DESKTOP_LNK%" 2>nul
if exist "%DESKTOP_LNK2%" del /f /q "%DESKTOP_LNK2%" 2>nul

echo [3/4] حذف ثبت مسیر نصب...
if exist "%LOC_FILE%" del /f /q "%LOC_FILE%" 2>nul

echo [4/4] حذف پوشه نصب...
cd /d "%TEMP%"
if exist "%INSTALL_DIR%" (
  rd /s /q "%INSTALL_DIR%" 2>nul
  if exist "%INSTALL_DIR%" (
    echo هشدار: بخشی از پوشه نصب حذف نشد — شاید فایل قفل باشد.
    echo مسیر: %INSTALL_DIR%
  ) else (
    echo پوشه نصب حذف شد.
  )
) else (
  echo پوشه نصب از قبل نبود.
)

echo.
choice /C YN /M "تنظیمات/کش WebView2 در LocalAppData\Sirman هم پاک شود؟ (بک‌آپ‌های پیش‌فرض هم می‌روند)"
if errorlevel 2 goto :skip_data

if exist "%APP_ROOT%" (
  rd /s /q "%APP_ROOT%" 2>nul
  if exist "%APP_ROOT%" (
    echo هشدار: بخشی از داده کاربر حذف نشد.
  ) else (
    echo داده کاربر حذف شد.
  )
) else (
  echo داده کاربر از قبل نبود.
)
goto :done

:skip_data
echo داده کاربر نگه داشته شد.

:done
echo.
echo ===============================================
echo   حذف تمام شد
echo ===============================================
echo.
echo اگر بک‌آپ جداگانه دارید، دست نخورده است.
pause
exit /b 0
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
