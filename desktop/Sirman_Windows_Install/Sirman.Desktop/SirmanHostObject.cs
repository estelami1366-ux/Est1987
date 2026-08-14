using System.Drawing.Printing;
using System.Runtime.InteropServices;
using System.Text;
using System.Text.Json;

namespace Sirman.Desktop;

/// <summary>
/// شیء قابل‌فراخوانی از JavaScript داخل WebView2.
/// مطمئن‌تر از postMessage برای بستن پنجره.
/// </summary>
[ComVisible(true)]
[ClassInterface(ClassInterfaceType.AutoDual)]
public class SirmanHostObject
{
    private readonly MainForm _form;

    public SirmanHostObject(MainForm form) => _form = form;

    /// <summary>بستن فوری پنجرهٔ exe (بعد از بک‌آپ/خروج HTML).</summary>
    public void CloseApp() => _form.RequestForceClose();

    public void Notify(string title, string body) => _form.RequestNotify(title, body);

    public string Ping() => "sirman-host-ok";

    public string GetBackupDir()
    {
        var dir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "Sirman", "backup");
        Directory.CreateDirectory(dir);
        return dir;
    }

    public void SaveAppPref(string json)
    {
        var dir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "Sirman");
        Directory.CreateDirectory(dir);
        File.WriteAllText(Path.Combine(dir, "prefs.json"), json ?? "", new UTF8Encoding(encoderShouldEmitUTF8Identifier: false));
    }

    public string LoadAppPref()
    {
        var path = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "Sirman", "prefs.json");
        return File.Exists(path) ? File.ReadAllText(path) : "";
    }

    public string WriteBackupText(string fileName, string content)
    {
        try
        {
            var safe = Path.GetFileName(string.IsNullOrWhiteSpace(fileName) ? "sirman_autosave.txt" : fileName);
            if (string.IsNullOrWhiteSpace(safe)) safe = "sirman_autosave.txt";
            var path = Path.Combine(GetBackupDir(), safe);
            File.WriteAllText(path, content ?? "", new UTF8Encoding(encoderShouldEmitUTF8Identifier: false));
            return "{\"ok\":true,\"path\":" + JsonSerializer.Serialize(path) + "}";
        }
        catch (Exception ex)
        {
            return "{\"ok\":false,\"error\":" + JsonSerializer.Serialize(ex.Message) + "}";
        }
    }

    /// <summary>کاتالوگ پوستهٔ شیشه‌ای فصل/ماه برای مرور گارانتی.</summary>
    public string GetWarrantyBrowseCatalog() => SeasonalGlassTheme.CatalogJson();

    /// <summary>CSS شیشه‌ای فصل/ماه که از پوستهٔ دات‌نت تزریق می‌شود.</summary>
    public string GetWarrantyBrowseCss() => SeasonalGlassTheme.Css();

    /// <summary>همگام‌سازی نوار عنوان ویندوز با اسکین انتخاب‌شده در HTML.</summary>
    public void ApplyUiSkin(string key) => _form.ApplyUiSkinChrome(key);

    /// <summary>فهرست چاپگرهای نصب‌شده ویندوز برای مرکز پرینت.</summary>
    public string GetPrinters()
    {
        try
        {
            var items = new List<Dictionary<string, object?>>();
            var defName = "";
            try { defName = new PrinterSettings().PrinterName; } catch { /* ignore */ }
            foreach (string name in PrinterSettings.InstalledPrinters)
            {
                items.Add(new Dictionary<string, object?>
                {
                    ["name"] = name,
                    ["isDefault"] = string.Equals(name, defName, StringComparison.OrdinalIgnoreCase)
                });
            }
            if (items.Count == 0)
            {
                items.Add(new Dictionary<string, object?>
                {
                    ["name"] = "Microsoft Print to PDF",
                    ["isDefault"] = true,
                    ["kind"] = "pdf"
                });
            }
            return JsonSerializer.Serialize(items);
        }
        catch (Exception ex)
        {
            return JsonSerializer.Serialize(new[]
            {
                new Dictionary<string, object?>
                {
                    ["name"] = "Microsoft Print to PDF",
                    ["isDefault"] = true,
                    ["kind"] = "pdf",
                    ["error"] = ex.Message
                }
            });
        }
    }

    /// <summary>نام رایانه و کاربر ویندوز برای ثبت فعالیت (HTML-only این را ندارد).</summary>
    public string GetMachineInfo()
    {
        try
        {
            return JsonSerializer.Serialize(new Dictionary<string, object?>
            {
                ["computerName"] = Environment.MachineName,
                ["userName"] = Environment.UserName,
                ["ipAddress"] = ""
            });
        }
        catch (Exception ex)
        {
            return JsonSerializer.Serialize(new Dictionary<string, object?>
            {
                ["computerName"] = "",
                ["ipAddress"] = "",
                ["error"] = ex.Message
            });
        }
    }

    /// <summary>چاپ HTML روی چاپگر نام‌دار یا دستور print پیش‌فرض ویندوز.</summary>
    public string PrintHtml(string html, string printerName, string paper, string orientation, int copies)
    {
        try
        {
            var dir = Path.Combine(Path.GetTempPath(), "sirman-print");
            Directory.CreateDirectory(dir);
            var path = Path.Combine(dir, "job-" + Guid.NewGuid().ToString("N") + ".html");
            File.WriteAllText(path, html ?? "", new UTF8Encoding(encoderShouldEmitUTF8Identifier: true));
            copies = Math.Max(1, copies);
            var named = !string.IsNullOrWhiteSpace(printerName)
                && !string.Equals(printerName, "PDF", StringComparison.OrdinalIgnoreCase)
                && !string.Equals(printerName, "browser", StringComparison.OrdinalIgnoreCase)
                && printerName != "مرورگر / پنجره چاپ";
            for (var i = 0; i < copies; i++)
            {
                var psi = new ProcessStartInfo
                {
                    FileName = path,
                    UseShellExecute = true,
                    Verb = named ? "printto" : "print",
                    Arguments = named ? "\"" + printerName.Replace("\"", "") + "\"" : ""
                };
                _ = paper;
                _ = orientation;
                Process.Start(psi);
            }
            return "{\"ok\":true}";
        }
        catch (Exception ex)
        {
            return "{\"ok\":false,\"error\":" + JsonSerializer.Serialize(ex.Message) + "}";
        }
    }
}
