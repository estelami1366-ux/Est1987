using System.Drawing.Printing;
using System.Net.NetworkInformation;
using System.Net.Sockets;
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

    /// <summary>پورت واقعی پل اعلان (اگر ۸۷۶۶ اشغال بود پورت بعدی).</summary>
    public int GetNotifyPort() => _form.GetNotifyBridgePort();

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
            var ips = CollectLanIpv4();
            return JsonSerializer.Serialize(new Dictionary<string, object?>
            {
                ["computerName"] = Environment.MachineName,
                ["userName"] = Environment.UserName,
                ["ipAddress"] = ips.Count > 0 ? ips[0] : ""
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

    /// <summary>هویت LAN: IPها، پورت ۸۷۶۵، پوشه مشترک. API کسب‌وکار نیست.</summary>
    public string GetNetworkInfo()
    {
        try
        {
            var ips = CollectLanIpv4();
            return JsonSerializer.Serialize(new Dictionary<string, object?>
            {
                ["computerName"] = Environment.MachineName,
                ["userName"] = Environment.UserName,
                ["ipAddress"] = ips.Count > 0 ? ips[0] : "",
                ["ipv4"] = ips,
                ["lanEnabled"] = File.Exists(LanMarkerPath()),
                ["lanPort"] = 8765,
                ["backupDir"] = GetBackupDir(),
                ["sharedWorkspaceDir"] = ReadNetworkSharedDir(),
                ["workspaceFile"] = "sirman-workspace.json",
                ["businessApi"] = false
            });
        }
        catch (Exception ex)
        {
            return JsonSerializer.Serialize(new Dictionary<string, object?>
            {
                ["computerName"] = Environment.MachineName,
                ["ipAddress"] = "",
                ["ipv4"] = Array.Empty<string>(),
                ["lanEnabled"] = false,
                ["lanPort"] = 8765,
                ["businessApi"] = false,
                ["error"] = ex.Message
            });
        }
    }

    /// <summary>فعال‌سازی اشتراک LAN و مسیر پوشه مشترک (فایل AppData، نه دیتابیس جدا).</summary>
    public string SetNetworkConfig(string json)
    {
        try
        {
            using var incoming = JsonDocument.Parse(string.IsNullOrWhiteSpace(json) ? "{}" : json);
            var lan = false;
            var shared = "";
            if (incoming.RootElement.TryGetProperty("lanEnabled", out var le))
            {
                lan = le.ValueKind == JsonValueKind.True
                    || (le.ValueKind == JsonValueKind.String && (le.GetString() == "1" || string.Equals(le.GetString(), "true", StringComparison.OrdinalIgnoreCase)))
                    || (le.ValueKind == JsonValueKind.Number && le.GetInt32() != 0);
            }
            if (incoming.RootElement.TryGetProperty("sharedWorkspaceDir", out var sd) && sd.ValueKind == JsonValueKind.String)
                shared = (sd.GetString() ?? "").Trim();
            if (!IsSafeSharedDir(shared))
                return "{\"ok\":false,\"error\":\"shared-folder\"}";
            Directory.CreateDirectory(SirmanAppDir());
            if (lan) File.WriteAllText(LanMarkerPath(), "1");
            else if (File.Exists(LanMarkerPath())) File.Delete(LanMarkerPath());
            var cfg = new Dictionary<string, object?>
            {
                ["lanEnabled"] = lan,
                ["sharedWorkspaceDir"] = shared
            };
            File.WriteAllText(NetworkConfigPath(), JsonSerializer.Serialize(cfg), new UTF8Encoding(encoderShouldEmitUTF8Identifier: false));
            return "{\"ok\":true,\"lanEnabled\":" + (lan ? "true" : "false") + "}";
        }
        catch (Exception ex)
        {
            return "{\"ok\":false,\"error\":" + JsonSerializer.Serialize(ex.Message) + "}";
        }
    }

    /// <summary>نوشتن بسته بک‌آپ موجود روی پوشه مشترک. CRUD جدا نیست.</summary>
    public string WriteWorkspaceFile(string content)
    {
        try
        {
            var dir = ResolveWorkspaceDir();
            Directory.CreateDirectory(dir);
            var path = Path.Combine(dir, "sirman-workspace.json");
            File.WriteAllText(path, content ?? "", new UTF8Encoding(encoderShouldEmitUTF8Identifier: false));
            return "{\"ok\":true,\"path\":" + JsonSerializer.Serialize(path) + "}";
        }
        catch (Exception ex)
        {
            return "{\"ok\":false,\"error\":" + JsonSerializer.Serialize(ex.Message) + "}";
        }
    }

    /// <summary>خواندن فضای کاری مشترک برای ادغام با import موجود.</summary>
    public string ReadWorkspaceFile()
    {
        try
        {
            var path = Path.Combine(ResolveWorkspaceDir(), "sirman-workspace.json");
            if (!File.Exists(path))
                return "{\"ok\":false,\"error\":\"missing\"}";
            var text = File.ReadAllText(path);
            return JsonSerializer.Serialize(new Dictionary<string, object?>
            {
                ["ok"] = true,
                ["path"] = path,
                ["content"] = text
            });
        }
        catch (Exception ex)
        {
            return "{\"ok\":false,\"error\":" + JsonSerializer.Serialize(ex.Message) + "}";
        }
    }

    private static string SirmanAppDir() =>
        Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "Sirman");

    private static string LanMarkerPath() => Path.Combine(SirmanAppDir(), "lan-share.on");

    private static string NetworkConfigPath() => Path.Combine(SirmanAppDir(), "network.json");

    private static List<string> CollectLanIpv4()
    {
        var ips = new List<string>();
        try
        {
            foreach (var ni in NetworkInterface.GetAllNetworkInterfaces())
            {
                if (ni.OperationalStatus != OperationalStatus.Up) continue;
                if (ni.NetworkInterfaceType == NetworkInterfaceType.Loopback) continue;
                foreach (var ua in ni.GetIPProperties().UnicastAddresses)
                {
                    if (ua.Address.AddressFamily != AddressFamily.InterNetwork) continue;
                    var ip = ua.Address.ToString();
                    if (ip.StartsWith("127.", StringComparison.Ordinal) || ip.StartsWith("169.254.", StringComparison.Ordinal)) continue;
                    if (!ips.Contains(ip)) ips.Add(ip);
                }
            }
        }
        catch { /* HTML-only / restricted */ }
        return ips;
    }

    private static bool IsSafeSharedDir(string path)
    {
        if (string.IsNullOrWhiteSpace(path)) return true;
        path = path.Trim();
        if (path.StartsWith("http://", StringComparison.OrdinalIgnoreCase)
            || path.StartsWith("https://", StringComparison.OrdinalIgnoreCase))
            return false;
        if (path.Contains("..", StringComparison.Ordinal)) return false;
        return path.StartsWith("\\\\", StringComparison.Ordinal) || Path.IsPathRooted(path);
    }

    private string ReadNetworkSharedDir()
    {
        try
        {
            var path = NetworkConfigPath();
            if (!File.Exists(path)) return "";
            using var doc = JsonDocument.Parse(File.ReadAllText(path));
            if (doc.RootElement.TryGetProperty("sharedWorkspaceDir", out var sd) && sd.ValueKind == JsonValueKind.String)
                return (sd.GetString() ?? "").Trim();
        }
        catch { }
        return "";
    }

    private string ResolveWorkspaceDir()
    {
        var shared = ReadNetworkSharedDir();
        if (!string.IsNullOrWhiteSpace(shared) && IsSafeSharedDir(shared)) return shared;
        return GetBackupDir();
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
