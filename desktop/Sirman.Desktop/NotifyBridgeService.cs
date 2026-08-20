using System.Net;
using System.Net.Sockets;
using System.Text;
using System.Text.Json;

namespace Sirman.Desktop;

/// <summary>
/// پل اعلان ویندوز برای سیرمان:
/// 1) HTTP روی 127.0.0.1:8766 (سازگار با fetch داخل HTML)
/// 2) Toast از طریق NotifyIcon (و در صورت امکان WinRT)
/// </summary>
public sealed class NotifyBridgeService : IDisposable
{
    public const int DefaultPort = 8766;

    private HttpListener? _listener;
    private CancellationTokenSource? _cts;
    private Task? _loop;
    private NotifyIcon? _tray;
    private bool _started;

    public bool IsRunning => _started && _listener is { IsListening: true };
    public int Port { get; private set; } = DefaultPort;

    public static bool IsTcpPortFree(int port)
    {
        TcpListener? probe = null;
        try
        {
            probe = new TcpListener(IPAddress.Loopback, port);
            probe.Start();
            return true;
        }
        catch
        {
            return false;
        }
        finally
        {
            try { probe?.Stop(); } catch { /* ignore */ }
        }
    }

    public bool Start(int preferredPort = DefaultPort)
    {
        if (_started) return IsRunning;
        Port = preferredPort;

        EnsureTray();

        for (int p = preferredPort; p < preferredPort + 20; p++)
        {
            if (!IsTcpPortFree(p)) continue;
            try
            {
                var listener = new HttpListener();
                listener.Prefixes.Add($"http://127.0.0.1:{p}/");
                listener.Prefixes.Add($"http://localhost:{p}/");
                listener.Start();
                _listener = listener;
                Port = p;
                _cts = new CancellationTokenSource();
                _loop = Task.Run(() => ListenLoopAsync(_cts.Token));
                _started = true;
                return true;
            }
            catch
            {
                // پورت در فاصلهٔ چک تا bind اشغال شد — بعدی
            }
        }

        // پورت‌ها اشغال‌اند (مثلاً Sirman_Start.bat) — Toast مستقیم هنوز کار می‌کند
        _started = true;
        return false;
    }

    public void ShowToast(string? title, string? body)
    {
        title = string.IsNullOrWhiteSpace(title) ? "سیرمان" : title.Trim();
        body ??= "";
        PlaySirmanChime();

        if (TryShowWinRtToast(title, body)) return;

        try
        {
            EnsureTray();
            if (_tray == null) return;
            _tray.BalloonTipTitle = Truncate(title, 63);
            _tray.BalloonTipText = Truncate(string.IsNullOrWhiteSpace(body) ? "یادآوری سیرمان" : body, 255);
            _tray.BalloonTipIcon = ToolTipIcon.Info;
            _tray.Visible = true;
            _tray.ShowBalloonTip(6000);
        }
        catch
        {
            // آخرین راه: بی‌صدا نادیده
        }
    }

    /// <summary>دو نت کوتاه مخصوص سیرمان؛ با صدای خطای ویندوز اشتباه نمی‌شود.</summary>
    private static void PlaySirmanChime()
    {
        _ = Task.Run(() =>
        {
            try
            {
                Console.Beep(784, 70);
                Thread.Sleep(35);
                Console.Beep(1047, 105);
            }
            catch
            {
                try { System.Media.SystemSounds.Asterisk.Play(); } catch { /* sound اختیاری */ }
            }
        });
    }

    /// <summary>
    /// قبل از خروج، آیکون tray را مخفی کن تا NotifyIcon پروسه را زنده نگه ندارد.
    /// </summary>
    public void HideTray()
    {
        try
        {
            if (_tray != null)
            {
                _tray.Visible = false;
                _tray.Text = "سیرمان";
            }
        }
        catch { /* ignore */ }
    }

    private async Task ListenLoopAsync(CancellationToken ct)
    {
        var listener = _listener;
        if (listener == null) return;

        while (!ct.IsCancellationRequested && listener.IsListening)
        {
            HttpListenerContext? ctx = null;
            try
            {
                ctx = await listener.GetContextAsync().WaitAsync(ct);
            }
            catch (OperationCanceledException) { break; }
            catch { continue; }

            try { HandleRequest(ctx); }
            catch { try { ctx.Response.Abort(); } catch { /* ignore */ } }
        }
    }

    private void HandleRequest(HttpListenerContext ctx)
    {
        var req = ctx.Request;
        var res = ctx.Response;
        res.Headers.Add("Access-Control-Allow-Origin", "*");
        res.Headers.Add("Access-Control-Allow-Methods", "POST, OPTIONS, GET");
        res.Headers.Add("Access-Control-Allow-Headers", "Content-Type");

        if (req.HttpMethod == "OPTIONS")
        {
            res.StatusCode = 204;
            res.Close();
            return;
        }

        var path = req.Url?.AbsolutePath ?? "";

        if (path.Equals("/health", StringComparison.OrdinalIgnoreCase))
        {
            WriteJson(res, 200, """{"ok":true,"service":"sirman-notify","host":"dotnet"}""");
            return;
        }

        if (req.HttpMethod == "POST" && path.Equals("/notify", StringComparison.OrdinalIgnoreCase))
        {
            string raw;
            using (var reader = new StreamReader(req.InputStream, req.ContentEncoding ?? Encoding.UTF8))
                raw = reader.ReadToEnd();

            var title = "سیرمان";
            var body = "";
            try
            {
                using var doc = JsonDocument.Parse(string.IsNullOrWhiteSpace(raw) ? "{}" : raw);
                if (doc.RootElement.TryGetProperty("title", out var t) && t.ValueKind == JsonValueKind.String)
                    title = t.GetString() ?? title;
                if (doc.RootElement.TryGetProperty("body", out var b) && b.ValueKind == JsonValueKind.String)
                    body = b.GetString() ?? "";
            }
            catch
            {
                body = raw;
            }

            // Toast روی UI thread
            try
            {
                if (Application.OpenForms.Count > 0)
                {
                    var form = Application.OpenForms[0];
                    form?.BeginInvoke(new Action(() => ShowToast(title, body)));
                }
                else ShowToast(title, body);
            }
            catch { ShowToast(title, body); }

            WriteJson(res, 200, """{"ok":true}""");
            return;
        }

        res.StatusCode = 404;
        WriteText(res, "not found");
    }

    private static void WriteJson(HttpListenerResponse res, int code, string json)
    {
        var buf = Encoding.UTF8.GetBytes(json);
        res.StatusCode = code;
        res.ContentType = "application/json; charset=utf-8";
        res.ContentLength64 = buf.Length;
        res.OutputStream.Write(buf, 0, buf.Length);
        res.Close();
    }

    private static void WriteText(HttpListenerResponse res, string text)
    {
        var buf = Encoding.UTF8.GetBytes(text);
        res.ContentType = "text/plain; charset=utf-8";
        res.ContentLength64 = buf.Length;
        res.OutputStream.Write(buf, 0, buf.Length);
        res.Close();
    }

    private void EnsureTray()
    {
        if (_tray != null) return;
        try
        {
            _tray = new NotifyIcon
            {
                Icon = SystemIcons.Application,
                Text = "سیرمان",
                Visible = true
            };
        }
        catch { _tray = null; }
    }

    private static bool TryShowWinRtToast(string title, string body)
    {
        try
        {
            // معادل مسیر PowerShell: Windows.UI.Notifications بدون پکیج اضافه
            var toastMgrType = Type.GetType("Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType=WindowsRuntime");
            var xmlDocType = Type.GetType("Windows.Data.Xml.Dom.XmlDocument, Windows.Data.Xml.Dom.XmlDocument, ContentType=WindowsRuntime");
            var toastType = Type.GetType("Windows.UI.Notifications.ToastNotification, Windows.UI.Notifications, ContentType=WindowsRuntime");
            if (toastMgrType == null || xmlDocType == null || toastType == null) return false;

            var safeTitle = System.Security.SecurityElement.Escape(title) ?? title;
            var safeBody = System.Security.SecurityElement.Escape(body) ?? body;
            var xml = $"""
                <toast>
                  <audio src="ms-winsoundevent:Notification.IM" loop="false"/>
                  <visual>
                    <binding template="ToastGeneric">
                      <text>{safeTitle}</text>
                      <text>{safeBody}</text>
                    </binding>
                  </visual>
                </toast>
                """;

            var doc = Activator.CreateInstance(xmlDocType);
            xmlDocType.GetMethod("LoadXml", new[] { typeof(string) })!.Invoke(doc, new object[] { xml });
            var toast = Activator.CreateInstance(toastType, doc);
            var create = toastMgrType.GetMethod("CreateToastNotifier", new[] { typeof(string) });
            var notifier = create!.Invoke(null, new object[] { "Sirman.AfterSales" });
            notifier!.GetType().GetMethod("Show")!.Invoke(notifier, new[] { toast });
            return true;
        }
        catch
        {
            return false;
        }
    }

    private static string Truncate(string s, int max)
        => s.Length <= max ? s : s[..(max - 1)] + "…";

    public void Dispose()
    {
        try { _cts?.Cancel(); } catch { /* ignore */ }
        try { _listener?.Stop(); } catch { /* ignore */ }
        try { _listener?.Close(); } catch { /* ignore */ }
        try
        {
            if (_tray != null)
            {
                _tray.Visible = false;
                _tray.Dispose();
            }
        }
        catch { /* ignore */ }
        _listener = null;
        _tray = null;
        _started = false;
    }
}
