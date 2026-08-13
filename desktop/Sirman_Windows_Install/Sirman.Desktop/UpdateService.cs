using System.Text;
using System.Text.Json;

namespace Sirman.Desktop;

/// <summary>
/// اعمال بسته SIRMAN_UPDATE روی فایل HTML کنار برنامه (فاز ۲).
/// </summary>
static class UpdateService
{
    public sealed class ApplyResult
    {
        public bool Applied { get; init; }
        public string? Message { get; init; }
        public string? Version { get; init; }
        public string? UpdateId { get; init; }
        public string? HtmlPath { get; init; }
        public string? PackagePath { get; init; }
    }

    public static string? FindPendingPackage(string searchDir)
    {
        var pending = Path.Combine(searchDir, "Sirman_Pending_Update.json");
        if (File.Exists(pending)) return pending;

        var updDir = Path.Combine(searchDir, "updates");
        if (!Directory.Exists(updDir)) return null;

        foreach (var f in Directory.GetFiles(updDir, "Sirman_Update_*.json")
                     .OrderByDescending(File.GetLastWriteTimeUtc))
        {
            try
            {
                // فقط پکیج‌های بزرگ را خودکار پیدا کن (بدون خواندن کل فایل)
                using var fs = File.OpenRead(f);
                var buf = new byte[Math.Min(65536, (int)fs.Length)];
                var n = fs.Read(buf, 0, buf.Length);
                var head = Encoding.UTF8.GetString(buf, 0, n);
                if (head.Contains("replaceAppFile", StringComparison.Ordinal) ||
                    head.Contains("\"fullHtml\"", StringComparison.Ordinal))
                    return f;
            }
            catch { /* ignore */ }
        }
        return null;
    }

    public static ApplyResult ApplyPackageFile(string packagePath, string targetHtmlPath, string? backupFolder = null)
    {
        if (!File.Exists(packagePath))
            return new ApplyResult { Applied = false, Message = "فایل آپدیت پیدا نشد." };

        using var doc = JsonDocument.Parse(File.ReadAllText(packagePath));
        var root = doc.RootElement;
        if (!root.TryGetProperty("magic", out var magic) || magic.GetString() != "SIRMAN_UPDATE")
            return new ApplyResult { Applied = false, Message = "فایل آپدیت سیرمان نیست (magic نادرست)." };

        var version = root.TryGetProperty("version", out var verEl) ? verEl.GetString() : null;
        var id = root.TryGetProperty("id", out var idEl) ? idEl.GetString() : null;

        string? html = null;
        var fileName = Path.GetFileName(targetHtmlPath);
        if (string.IsNullOrWhiteSpace(fileName)) fileName = "Sirman_Final.html";

        if (root.TryGetProperty("fullHtml", out var full) && full.ValueKind == JsonValueKind.String)
            html = full.GetString();

        if (root.TryGetProperty("patches", out var patches) && patches.ValueKind == JsonValueKind.Array)
        {
            foreach (var p in patches.EnumerateArray())
            {
                var op = p.TryGetProperty("op", out var opEl) ? opEl.GetString() : null;
                if (op != "replaceAppFile" && op != "fullHtml") continue;
                if (p.TryGetProperty("content", out var c) && c.ValueKind == JsonValueKind.String)
                    html = c.GetString();
                else if (p.TryGetProperty("html", out var h) && h.ValueKind == JsonValueKind.String)
                    html = h.GetString();
                if (p.TryGetProperty("fileName", out var fn) && fn.ValueKind == JsonValueKind.String && !string.IsNullOrWhiteSpace(fn.GetString()))
                    fileName = fn.GetString()!;
                else if (p.TryGetProperty("filename", out var fn2) && fn2.ValueKind == JsonValueKind.String && !string.IsNullOrWhiteSpace(fn2.GetString()))
                    fileName = fn2.GetString()!;
            }
        }

        if (string.IsNullOrEmpty(html))
            return new ApplyResult { Applied = false, Message = "این آپدیت HTML کامل ندارد (فقط پچ کوچک)." };

        var dir = Path.GetDirectoryName(targetHtmlPath) ?? AppPaths.ExeDir;
        Directory.CreateDirectory(dir);
        var outPath = Path.Combine(dir, fileName);

        // بک‌آپ نسخه قبلی
        try
        {
            if (File.Exists(outPath) && !string.IsNullOrWhiteSpace(backupFolder))
            {
                Directory.CreateDirectory(backupFolder);
                var stamp = DateTime.Now.ToString("yyyyMMdd_HHmmss");
                var bakName = $"Sirman_Final_before_{version ?? "update"}_{stamp}.html";
                File.Copy(outPath, Path.Combine(backupFolder, bakName), overwrite: true);
            }
        }
        catch { /* بک‌آپ اختیاری */ }

        File.WriteAllText(outPath, html, new UTF8Encoding(encoderShouldEmitUTF8Identifier: false));

        if (!string.IsNullOrWhiteSpace(version))
        {
            try
            {
                var verPath = Path.Combine(dir, $"Sirman_Final_{version}.html");
                File.WriteAllText(verPath, html, new UTF8Encoding(false));
            }
            catch { /* optional */ }
        }

        // اگر Pending بود، تغییر نام بده تا دوباره اعمال نشود
        try
        {
            if (string.Equals(Path.GetFileName(packagePath), "Sirman_Pending_Update.json", StringComparison.OrdinalIgnoreCase))
            {
                var safeVer = string.Join("_", (version ?? "ok").Split(Path.GetInvalidFileNameChars()));
                var done = Path.Combine(Path.GetDirectoryName(packagePath)!, $"Sirman_Pending_Update.applied.{safeVer}.json");
                if (File.Exists(done)) File.Delete(done);
                File.Move(packagePath, done);
            }
        }
        catch { /* ignore */ }

        var settings = AppPaths.LoadSettings();
        settings.LastAppliedUpdateId = id;
        settings.LastAppliedUpdateVersion = version;
        AppPaths.SaveSettings(settings);

        return new ApplyResult
        {
            Applied = true,
            Message = $"آپدیت {(version ?? "")} اعمال شد.",
            Version = version,
            UpdateId = id,
            HtmlPath = outPath,
            PackagePath = packagePath
        };
    }

    /// <summary>جستجو کنار exe و اعمال در صورت وجود.</summary>
    public static ApplyResult TryApplyPendingOnStartup(string htmlTargetPath)
    {
        var pkg = FindPendingPackage(AppPaths.ExeDir);
        if (pkg == null)
            return new ApplyResult { Applied = false, Message = null };

        var backup = AppPaths.ResolveBackupFolder();
        return ApplyPackageFile(pkg, htmlTargetPath, backup);
    }
}
