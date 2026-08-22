using System.Net.NetworkInformation;
using System.Net.Sockets;
using System.Runtime.InteropServices;
using System.Text;
using System.Text.Json;
using Sirman.Core.Infrastructure;

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

    private string? Guard(string method)
    {
        if (DesktopSecurity.Current.IsHostMethodAllowed(method)) return null;
        return DesktopSecurity.Current.AuthorizeHostMethod(method);
    }

    public string Login(string json) => DesktopSecurity.Current.Login(json);
    public string Logout() => DesktopSecurity.Current.Logout();
    public string BindSession(string json) => DesktopSecurity.Current.BindSession(json);
    public string CheckPermission(string permission) => DesktopSecurity.Current.CheckPermission(permission);
    public string HashPassword(string plain) => DesktopSecurity.Current.HashPassword(plain);
    public string VerifyPassword(string plain, string stored)
    {
        try
        {
            var ok = DesktopSecurity.Current.VerifyPassword(plain ?? "", stored ?? "");
            return "{\"ok\":" + (ok ? "true" : "false") + "}";
        }
        catch (Exception ex)
        {
            return SafeError.Json("verify-failed", "بررسی رمز انجام نشد", ex);
        }
    }
    public string ValidateEntity(string entity, string json) => DesktopSecurity.Current.ValidateEntity(entity, json);
    public string GetSecurityStatus() => DesktopSecurity.Current.GetSecurityStatus();
    public string SaveSecret(string name, string value) => DesktopSecurity.Current.SaveSecret(name, value);
    public string LoadSecret(string name) => DesktopSecurity.Current.LoadSecret(name);
    public string RunBusiness(string name, string json) => DesktopSecurity.Business.Run(name, json);

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
        if (Guard("SaveAppPref") != null) return;
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
            return SafeError.Json("backup-write", "نوشتن فایل پشتیبان انجام نشد", ex);
        }
    }

    /// <summary>کاتالوگ پوستهٔ شیشه‌ای فصل/ماه برای مرور گارانتی.</summary>
    public string GetWarrantyBrowseCatalog() => SeasonalGlassTheme.CatalogJson();

    /// <summary>CSS شیشه‌ای فصل/ماه که از پوستهٔ دات‌نت تزریق می‌شود.</summary>
    public string GetWarrantyBrowseCss() => SeasonalGlassTheme.Css();

    /// <summary>همگام‌سازی نوار عنوان ویندوز با اسکین انتخاب‌شده در HTML.</summary>
    public void ApplyUiSkin(string key) => _form.ApplyUiSkinChrome(key);

    /// <summary>فهرست چاپگرهای نصب‌شده ویندوز. اگر هیچ چاپگری نباشد آرایه خالی برمی‌گردد — چاپگر جعلی ساخته نمی‌شود.</summary>
    public string GetPrinters() => _form.ListPrintersJson();

    /// <summary>هارنس تشخیص سخت‌افزار چاپ — جدا از PrintHtml/مرکز پرینت. داده کسب‌وکار را لمس نمی‌کند.</summary>
    public string RunPrintHardwareDiagnostic(string json)
    {
        try
        {
            return _form.RunPrintHardwareDiagnostic(json ?? "{}");
        }
        catch (Exception ex)
        {
            return SafeError.Json("UNKNOWN_PRINT_FAILURE", "تشخیص چاپ انجام نشد", ex);
        }
    }

    /// <summary>وضعیت یک کار چاپ که PrintHtml/PrintDocument ساخته است.</summary>
    public string GetPrintJob(string printJobId)
    {
        var denied = Guard("GetPrintJob");
        if (denied != null) return denied;
        return _form.GetPrintJobJson(printJobId);
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
        var denied = Guard("SetNetworkConfig");
        if (denied != null) return denied;
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
            return SafeError.Json("network-config", "تنظیم شبکه ذخیره نشد", ex);
        }
    }

    /// <summary>نوشتن بسته بک‌آپ موجود روی پوشه مشترک. CRUD جدا نیست.</summary>
    public string WriteWorkspaceFile(string content)
    {
        var denied = Guard("WriteWorkspaceFile");
        if (denied != null) return denied;
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
            return SafeError.Json("workspace-write", "نوشتن فضای کاری انجام نشد", ex);
        }
    }

    /// <summary>خواندن فضای کاری مشترک برای ادغام با import موجود.</summary>
    public string ReadWorkspaceFile()
    {
        var denied = Guard("ReadWorkspaceFile");
        if (denied != null) return denied;
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
            return SafeError.Json("workspace-read", "خواندن فضای کاری انجام نشد", ex);
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

    /// <summary>چاپ HTML روی چاپگر ویندوز از مسیر WebView2. موفقیت جعلی برنمی‌گردد.</summary>
    public string PrintHtml(string html, string printerName, string paper, string orientation, int copies)
    {
        var denied = Guard("PrintHtml");
        if (denied != null) return denied;
        try
        {
            ParsePrintMeta(html, out var documentId, out var documentType);
            return _form.EnqueueHtmlPrint(html ?? "", printerName ?? "", paper ?? "", orientation ?? "", copies, documentId, documentType, "", "print");
        }
        catch (Exception ex)
        {
            return SafeError.Json("PRINT_ASYNC_FAILED", "چاپ انجام نشد: " + ex.Message, ex);
        }
    }

    /// <summary>چاپ با شناسه سند، نوع سند و کاربر. مسیر کاغذ بومی JSON است نه HTML.</summary>
    public string PrintDocument(string json)
    {
        var denied = Guard("PrintHtml");
        if (denied != null) return denied;
        try
        {
            using var doc = JsonDocument.Parse(string.IsNullOrWhiteSpace(json) ? "{}" : json);
            var root = doc.RootElement;
            var html = Str(root, "html");
            var printer = Str(root, "printerName");
            if (printer.Length == 0) printer = Str(root, "printer");
            var paper = Str(root, "paper");
            var orientation = Str(root, "orientation");
            var copies = 1;
            if (root.TryGetProperty("copies", out var c))
            {
                if (c.ValueKind == JsonValueKind.Number) copies = c.GetInt32();
                else int.TryParse(c.GetString(), out copies);
            }
            var documentId = Str(root, "documentId");
            if (documentId.Length == 0) documentId = Str(root, "invoiceId");
            var documentType = Str(root, "documentType");
            if (documentType.Length == 0) documentType = Str(root, "docId");
            var user = Str(root, "user");
            var purpose = Str(root, "purpose");
            if (purpose.Length == 0) purpose = Str(root, "mode");
            if (purpose.Length == 0) purpose = "print";
            var engine = Str(root, "engine");
            var kind = Str(root, "kind");
            if (kind.Length == 0) kind = documentType;
            var nativePaper = string.Equals(engine, "native", StringComparison.OrdinalIgnoreCase)
                && !string.Equals(purpose, "pdf", StringComparison.OrdinalIgnoreCase);
            if (!nativePaper && html.Length == 0 && (kind is "testPage" or "invoice") && !string.Equals(purpose, "pdf", StringComparison.OrdinalIgnoreCase))
                nativePaper = true;
            if (nativePaper)
                return _form.EnqueueNativePrint(json ?? "{}", printer, paper, orientation, copies, documentId, documentType, user, purpose);
            if (html.Length == 0)
                return "{\"ok\":false,\"status\":\"PRINT_FAILED\",\"errorCode\":\"NO_DOCUMENT\",\"message\":\"سندی برای چاپ نیست\"}";
            return _form.EnqueueHtmlPrint(html, printer, paper, orientation, copies, documentId, documentType, user, purpose);
        }
        catch (Exception ex)
        {
            return SafeError.Json("PRINT_ASYNC_FAILED", "چاپ انجام نشد: " + ex.Message, ex);
        }
    }

    private static string Str(JsonElement root, string name)
    {
        if (!root.TryGetProperty(name, out var el)) return "";
        return el.ValueKind == JsonValueKind.String ? (el.GetString() ?? "") : el.ToString();
    }

    private static void ParsePrintMeta(string? html, out string documentId, out string documentType)
    {
        documentId = "";
        documentType = "";
        if (string.IsNullOrEmpty(html)) return;
        var mark = "SIRMAN-PRINT-META:";
        var i = html.IndexOf(mark, StringComparison.Ordinal);
        if (i < 0) return;
        var start = i + mark.Length;
        var end = html.IndexOf("-->", start, StringComparison.Ordinal);
        if (end < 0) end = Math.Min(html.Length, start + 400);
        var raw = html.Substring(start, end - start).Trim();
        try
        {
            using var doc = JsonDocument.Parse(raw);
            documentId = Str(doc.RootElement, "documentId");
            if (documentId.Length == 0) documentId = Str(doc.RootElement, "invoiceId");
            documentType = Str(doc.RootElement, "documentType");
        }
        catch { /* meta اختیاری است */ }
    }
}
