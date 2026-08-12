using System.Text.Json;

namespace Sirman.Desktop;

/// <summary>
/// مسیرهای نصب، بک‌آپ و تنظیمات محلی پوسته دسکتاپ.
/// </summary>
static class AppPaths
{
    public static string AppDataRoot =>
        Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Sirman");

    public static string SettingsPath => Path.Combine(AppDataRoot, "desktop-settings.json");

    public static string DefaultInstallDir => Path.Combine(AppDataRoot, "App");

    public static string ExeDir => AppContext.BaseDirectory.TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar);

    public static DesktopSettings LoadSettings()
    {
        try
        {
            Directory.CreateDirectory(AppDataRoot);
            if (!File.Exists(SettingsPath)) return new DesktopSettings();
            var json = File.ReadAllText(SettingsPath);
            return JsonSerializer.Deserialize<DesktopSettings>(json) ?? new DesktopSettings();
        }
        catch
        {
            return new DesktopSettings();
        }
    }

    public static void SaveSettings(DesktopSettings s)
    {
        Directory.CreateDirectory(AppDataRoot);
        var json = JsonSerializer.Serialize(s, new JsonSerializerOptions { WriteIndented = true });
        File.WriteAllText(SettingsPath, json);
    }

    public static string ResolveBackupFolder(DesktopSettings? s = null)
    {
        s ??= LoadSettings();
        if (!string.IsNullOrWhiteSpace(s.BackupFolder) && Directory.Exists(s.BackupFolder))
            return s.BackupFolder!;
        var def = Path.Combine(AppDataRoot, "Backups");
        Directory.CreateDirectory(def);
        return def;
    }
}

sealed class DesktopSettings
{
    public string? BackupFolder { get; set; }
    public string? PreferredHtmlPath { get; set; }
    public string? LastAppliedUpdateId { get; set; }
    public string? LastAppliedUpdateVersion { get; set; }
    public bool NotifyEnabled { get; set; } = true;
    public bool AskBackupOnClose { get; set; } = true;
}
