using System.Reflection;
using System.Text;

namespace Sirman.Desktop;

/// <summary>
/// نصب محلی در LocalAppData + میانبر منوی Start / دسکتاپ + اسکریپت حذف سالم.
/// </summary>
static class InstallService
{
    public static string InstallDir => AppPaths.DefaultInstallDir;

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

            var work = Path.GetDirectoryName(exe)!;
            WriteUninstallArtifacts(work);

            CreateShortcut(StartMenuShortcutPath, exe, work, "سیرمان — خدمات پس از فروش");
            CreateUninstallShortcut(work);
            if (createDesktopShortcut)
                CreateShortcut(DesktopShortcutPath, exe, work, "سیرمان — خدمات پس از فروش");

            var unBat = Path.Combine(work, UninstallBatName);
            var msg = "نصب/میانبر آماده شد.\n\nاجرا:\n" + exe +
                      "\n\nمیانبر Start:\n" + StartMenuShortcutPath +
                      "\n\nحذف سالم:\n" + unBat +
                      "\nمیانبر حذف:\n" + StartMenuUninstallShortcutPath;
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
            WriteUninstallArtifacts(work);
            CreateShortcut(StartMenuShortcutPath, exe, work, "سیرمان — خدمات پس از فروش");
            CreateUninstallShortcut(work);
            if (desktop)
                CreateShortcut(DesktopShortcutPath, exe, work, "سیرمان — خدمات پس از فروش");

            return new InstallResult
            {
                Ok = true,
                ExePath = exe,
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

    /// <summary>
    /// همیشه کنار exe فایل Uninstall-Sirman.bat را می‌نویسد و میانبر Start «حذف سیرمان» می‌سازد.
    /// </summary>
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

set "INSTALL_DIR=%LOCALAPPDATA%\Sirman\App"
set "APP_ROOT=%LOCALAPPDATA%\Sirman"
set "START_DIR=%APPDATA%\Microsoft\Windows\Start Menu\Programs\سیرمان"
set "DESKTOP_LNK=%USERPROFILE%\Desktop\سیرمان.lnk"
set "DESKTOP_LNK2=%USERPROFILE%\OneDrive\Desktop\سیرمان.lnk"

echo.
echo ===============================================
echo   حذف سالم سیرمان (Uninstall)
echo ===============================================
echo.
echo این کار انجام می‌شود:
echo   - بستن Sirman.exe در صورت اجرا
echo   - حذف میانبر Start و دسکتاپ
echo   - حذف پوشه نصب: %INSTALL_DIR%
echo.
echo داده بک‌آپ و تنظیمات در صورت تمایل جداگانه پرسیده می‌شود.
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

echo [3/4] حذف پوشه نصب برنامه...
if exist "%INSTALL_DIR%" (
  rd /s /q "%INSTALL_DIR%" 2>nul
  if exist "%INSTALL_DIR%" (
    echo هشدار: بخشی از پوشه نصب حذف نشد — شاید فایل قفل باشد.
  ) else (
    echo پوشه نصب حذف شد.
  )
) else (
  echo پوشه نصب از قبل نبود.
)

echo.
choice /C YN /M "تنظیمات/کش WebView2 و داده LocalAppData\Sirman هم پاک شود؟ (بک‌آپ‌های پیش‌فرض هم می‌روند)"
if errorlevel 2 goto :skip_data

echo [4/4] حذف داده کاربر...
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
echo [4/4] داده کاربر نگه داشته شد.

:done
echo.
echo ===============================================
echo   حذف تمام شد
echo ===============================================
echo.
echo اگر بک‌آپ جداگانه دارید، دست نخورده است.
echo این پنجره را ببندید.
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
