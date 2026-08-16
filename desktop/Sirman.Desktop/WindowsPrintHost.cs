using System.Collections.Concurrent;
using System.Drawing.Printing;
using System.Text;
using System.Text.Json;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;
using Sirman.Core.Infrastructure;

namespace Sirman.Desktop;

/// <summary>
/// چاپ واقعی از طریق WebView2 به صف چاپ ویندوز.
/// فعل شل چاپ سیستم‌عامل استفاده نمی‌شود چون موفقیت جعلی می‌داد.
/// </summary>
internal sealed class WindowsPrintHost
{
    private readonly Control _ui;
    private readonly ConcurrentDictionary<string, PrintJobState> _jobs = new(StringComparer.OrdinalIgnoreCase);
    private WebView2? _view;
    private Task? _ensureView;
    private readonly object _viewGate = new();

    public WindowsPrintHost(Control ui) => _ui = ui;

    public string ListPrinters()
    {
        try
        {
            var items = new List<Dictionary<string, object?>>();
            var defName = "";
            try { defName = new PrinterSettings().PrinterName ?? ""; }
            catch { defName = ""; }
            foreach (string name in PrinterSettings.InstalledPrinters)
            {
                if (string.IsNullOrWhiteSpace(name)) continue;
                var ps = new PrinterSettings { PrinterName = name };
                items.Add(new Dictionary<string, object?>
                {
                    ["name"] = name,
                    ["isDefault"] = defName.Length > 0 && string.Equals(name, defName, StringComparison.OrdinalIgnoreCase),
                    ["isValid"] = ps.IsValid,
                    ["status"] = ps.IsValid ? "available" : "unavailable"
                });
            }
            return JsonSerializer.Serialize(new Dictionary<string, object?>
            {
                ["ok"] = true,
                ["printers"] = items,
                ["defaultPrinter"] = defName,
                ["count"] = items.Count
            });
        }
        catch (Exception ex)
        {
            return SafeError.Json("printer-list", "خواندن فهرست چاپگر انجام نشد", ex);
        }
    }

    public string GetJob(string printJobId)
    {
        if (string.IsNullOrWhiteSpace(printJobId) || !_jobs.TryGetValue(printJobId.Trim(), out var job))
            return "{\"ok\":false,\"error\":\"missing-job\",\"errorCode\":\"MISSING_JOB\",\"message\":\"این کار چاپ پیدا نشد\",\"status\":\"PRINT_FAILED\"}";
        return job.ToJson();
    }

    public string Enqueue(string html, string printerName, string paper, string orientation, int copies, string documentId, string documentType, string user)
    {
        var job = PrintJobState.New(printerName, documentId, documentType, user);
        _jobs[job.PrintJobId] = job;
        AppendLog(job);
        if (!_ui.IsHandleCreated)
        {
            job.Fail("NO_UI", "پنجره برنامه برای چاپ آماده نیست");
            AppendLog(job);
            return job.ToJson();
        }
        _ui.BeginInvoke(new Action(() => _ = RunAsync(job, html ?? "", printerName ?? "", paper ?? "", orientation ?? "", Math.Max(1, copies))));
        return job.ToJson();
    }

    private async Task RunAsync(PrintJobState job, string html, string printerName, string paper, string orientation, int copies)
    {
        try
        {
            job.Set("PRINTING", null, "در حال آماده‌سازی سند برای چاپ");
            AppendLog(job);

            var listed = ReadPrinters();
            if (listed.Count == 0)
            {
                job.Fail("NO_PRINTER", "چاپگری نصب نیست.");
                AppendLog(job);
                return;
            }

            var chosen = ResolvePrinter(printerName, listed, out var resolveError, out var resolveCode);
            if (string.IsNullOrEmpty(chosen))
            {
                job.Fail(resolveCode, resolveError);
                AppendLog(job);
                return;
            }

            var ps = new PrinterSettings { PrinterName = chosen };
            if (!ps.IsValid)
            {
                job.Fail("PRINTER_UNAVAILABLE", "Printer is unavailable.");
                job.Printer = chosen;
                AppendLog(job);
                return;
            }

            job.Printer = chosen;
            await EnsureViewAsync();
            if (_view?.CoreWebView2 is null)
            {
                job.Fail("WEBVIEW", "موتور چاپ WebView2 آماده نشد");
                AppendLog(job);
                return;
            }

            var dir = Path.Combine(Path.GetTempPath(), "sirman-print");
            Directory.CreateDirectory(dir);
            var path = Path.Combine(dir, job.PrintJobId + ".html");
            File.WriteAllText(path, html ?? "", new UTF8Encoding(encoderShouldEmitUTF8Identifier: true));
            var uri = new Uri(path).AbsoluteUri;

            var navOk = await NavigateAsync(_view, uri);
            if (!navOk)
            {
                job.Fail("NAVIGATION", "سند چاپ بارگذاری نشد");
                AppendLog(job);
                return;
            }

            var settings = _view.CoreWebView2.Environment.CreatePrintSettings();
            settings.PrinterName = chosen;
            settings.Copies = copies;
            settings.Orientation = string.Equals(orientation, "landscape", StringComparison.OrdinalIgnoreCase)
                ? CoreWebView2PrintOrientation.Landscape
                : CoreWebView2PrintOrientation.Portrait;
            ApplyPaper(settings, paper, orientation);
            ApplyMargins(settings, paper);

            job.Set("PRINTING", null, "در حال ارسال به صف چاپ ویندوز");
            AppendLog(job);
            var status = await _view.CoreWebView2.PrintAsync(settings);
            if (status == CoreWebView2PrintStatus.Succeeded)
            {
                job.Set("PRINT_SUBMITTED", null, "سند به صف چاپ ویندوز ارسال شد");
                job.Ok = true;
            }
            else if (status == CoreWebView2PrintStatus.PrinterUnavailable)
                job.Fail("PRINTER_UNAVAILABLE", "Printer is unavailable.");
            else
                job.Fail("PRINT_FAILED", "چاپ انجام نشد");
            AppendLog(job);
        }
        catch (Exception ex)
        {
            job.Fail("PRINT_FAILED", "چاپ انجام نشد");
            job.ErrorDetail = ex.GetType().Name;
            AppendLog(job);
        }
    }

    private static List<(string Name, bool IsDefault, bool IsValid)> ReadPrinters()
    {
        var list = new List<(string, bool, bool)>();
        var defName = "";
        try { defName = new PrinterSettings().PrinterName ?? ""; } catch { /* none */ }
        foreach (string name in PrinterSettings.InstalledPrinters)
        {
            if (string.IsNullOrWhiteSpace(name)) continue;
            var ps = new PrinterSettings { PrinterName = name };
            list.Add((name, defName.Length > 0 && string.Equals(name, defName, StringComparison.OrdinalIgnoreCase), ps.IsValid));
        }
        return list;
    }

    private static string ResolvePrinter(string requested, List<(string Name, bool IsDefault, bool IsValid)> listed, out string error, out string code)
    {
        error = "";
        code = "";
        var want = (requested ?? "").Trim();
        if (want.Length == 0
            || string.Equals(want, "browser", StringComparison.OrdinalIgnoreCase)
            || string.Equals(want, "PDF", StringComparison.OrdinalIgnoreCase)
            || want == "مرورگر / پنجره چاپ")
        {
            var def = listed.FirstOrDefault(p => p.IsDefault && p.IsValid);
            if (!string.IsNullOrEmpty(def.Name)) return def.Name;
            var any = listed.FirstOrDefault(p => p.IsValid);
            if (!string.IsNullOrEmpty(any.Name)) return any.Name;
            code = "NO_DEFAULT_PRINTER";
            error = "چاپگر پیش‌فرض ویندوز تنظیم نشده است.";
            return "";
        }

        var hit = listed.FirstOrDefault(p => string.Equals(p.Name, want, StringComparison.OrdinalIgnoreCase));
        if (string.IsNullOrEmpty(hit.Name))
        {
            code = "PRINTER_NOT_FOUND";
            error = "چاپگر انتخاب‌شده پیدا نشد.";
            return "";
        }
        if (!hit.IsValid)
        {
            code = "PRINTER_UNAVAILABLE";
            error = "Printer is unavailable.";
            return "";
        }
        return hit.Name;
    }

    private static void ApplyPaper(CoreWebView2PrintSettings settings, string paper, string orientation)
    {
        var landscape = string.Equals(orientation, "landscape", StringComparison.OrdinalIgnoreCase);
        double w, h;
        switch ((paper ?? "A4").Trim())
        {
            case "A5":
                w = 5.83; h = 8.27; break;
            case "80mm":
                w = 3.15; h = 7.87; break;
            case "label":
                w = 3.94; h = 5.91; break;
            default:
                w = 8.27; h = 11.69; break;
        }
        settings.PageWidth = landscape ? h : w;
        settings.PageHeight = landscape ? w : h;
    }

    private static void ApplyMargins(CoreWebView2PrintSettings settings, string paper)
    {
        double mm = 8;
        if (string.Equals(paper, "80mm", StringComparison.OrdinalIgnoreCase) || string.Equals(paper, "label", StringComparison.OrdinalIgnoreCase))
            mm = 2;
        var inches = mm / 25.4;
        settings.MarginTop = inches;
        settings.MarginBottom = inches;
        settings.MarginLeft = inches;
        settings.MarginRight = inches;
    }

    private Task EnsureViewAsync()
    {
        lock (_viewGate)
        {
            if (_view?.CoreWebView2 != null) return Task.CompletedTask;
            _ensureView ??= CreateViewAsync();
            return _ensureView;
        }
    }

    private async Task CreateViewAsync()
    {
        _view = new WebView2
        {
            Width = 8,
            Height = 8,
            Visible = false,
            TabStop = false
        };
        _ui.Controls.Add(_view);
        var userData = Path.Combine(AppPaths.AppDataRoot, "WebView2-print");
        Directory.CreateDirectory(userData);
        var env = await CoreWebView2Environment.CreateAsync(userDataFolder: userData);
        await _view.EnsureCoreWebView2Async(env);
        _view.CoreWebView2.Settings.AreDefaultContextMenusEnabled = false;
        _view.CoreWebView2.Settings.AreDevToolsEnabled = false;
        _view.CoreWebView2.Settings.IsStatusBarEnabled = false;
    }

    private static Task<bool> NavigateAsync(WebView2 view, string uri)
    {
        var tcs = new TaskCompletionSource<bool>(TaskCreationOptions.RunContinuationsAsynchronously);
        void Handler(object? sender, CoreWebView2NavigationCompletedEventArgs e)
        {
            view.CoreWebView2.NavigationCompleted -= Handler;
            tcs.TrySetResult(e.IsSuccess);
        }
        view.CoreWebView2.NavigationCompleted += Handler;
        view.CoreWebView2.Navigate(uri);
        return tcs.Task;
    }

    private static void AppendLog(PrintJobState job)
    {
        try
        {
            var dir = Path.Combine(AppPaths.AppDataRoot, "print");
            Directory.CreateDirectory(dir);
            var line = job.ToJson() + Environment.NewLine;
            File.AppendAllText(Path.Combine(dir, "print-jobs.jsonl"), line, Encoding.UTF8);
        }
        catch { /* logging must not break print */ }
    }
}

internal sealed class PrintJobState
{
    public string PrintJobId { get; init; } = "";
    public string Status { get; set; } = "PRINT_REQUESTED";
    public bool Ok { get; set; }
    public string? ErrorCode { get; set; }
    public string? ErrorMessage { get; set; }
    public string? ErrorDetail { get; set; }
    public string Printer { get; set; } = "";
    public string DocumentId { get; init; } = "";
    public string DocumentType { get; init; } = "";
    public string User { get; init; } = "";
    public string RequestedAt { get; init; } = "";
    public string UpdatedAt { get; set; } = "";

    public static PrintJobState New(string printer, string documentId, string documentType, string user)
    {
        var now = DateTimeOffset.Now.ToString("o");
        return new PrintJobState
        {
            PrintJobId = "PJ-" + Guid.NewGuid().ToString("N")[..12],
            Status = "PRINT_REQUESTED",
            Printer = printer ?? "",
            DocumentId = documentId ?? "",
            DocumentType = documentType ?? "",
            User = user ?? "",
            RequestedAt = now,
            UpdatedAt = now
        };
    }

    public void Set(string status, string? code, string message)
    {
        Status = status;
        ErrorCode = code;
        ErrorMessage = message;
        UpdatedAt = DateTimeOffset.Now.ToString("o");
    }

    public void Fail(string code, string message)
    {
        Ok = false;
        Set("PRINT_FAILED", code, message);
    }

    public string ToJson() => JsonSerializer.Serialize(new Dictionary<string, object?>
    {
        ["ok"] = Ok,
        ["printJobId"] = PrintJobId,
        ["status"] = Status,
        ["errorCode"] = ErrorCode,
        ["error"] = ErrorCode,
        ["message"] = ErrorMessage,
        ["errorMessage"] = ErrorMessage,
        ["printer"] = Printer,
        ["documentId"] = DocumentId,
        ["documentType"] = DocumentType,
        ["user"] = User,
        ["requestedAt"] = RequestedAt,
        ["timestamp"] = UpdatedAt
    });
}
