using System.Collections.Concurrent;
using System.Drawing.Printing;
using System.Runtime.InteropServices;
using System.Text;
using System.Text.Json;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;
using Sirman.Core.Infrastructure;
using Sirman.Core.Printing;

namespace Sirman.Desktop;

/// <summary>
/// کاغذ تولیدی فاکتور/صفحه آزمایشی/برچسب پستی: NativeWindowsPrintService / PrintDocument.
/// PDF و اسناد مهاجرت‌نشده: WebView2.PrintAsync (موفقیت PDF چاپ کاغذ نیست).
/// Microsoft Print to PDF و XPS چاپ نیستند و در مسیر PRINT انتخاب نمی‌شوند.
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
            var listed = ReadPrinters();
            var items = listed.Select(p => new Dictionary<string, object?>
            {
                ["name"] = p.Name,
                ["isDefault"] = p.IsDefault,
                ["isValid"] = p.IsValid,
                ["isPhysical"] = p.IsPhysical,
                ["isPdf"] = p.Kind == "pdf",
                ["kind"] = p.Kind,
                ["status"] = p.IsValid ? (p.IsPhysical ? "available" : "file") : "unavailable"
            }).ToList();
            var defPhys = listed.FirstOrDefault(p => p.IsDefault && p.IsPhysical && p.IsValid);
            if (string.IsNullOrEmpty(defPhys.Name))
                defPhys = listed.FirstOrDefault(p => p.IsPhysical && p.IsValid);
            return JsonSerializer.Serialize(new Dictionary<string, object?>
            {
                ["ok"] = true,
                ["printers"] = items,
                ["defaultPrinter"] = listed.FirstOrDefault(p => p.IsDefault).Name ?? "",
                ["defaultPhysicalPrinter"] = defPhys.Name ?? "",
                ["physicalCount"] = listed.Count(p => p.IsPhysical),
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

    public string EnqueueNative(string documentJson, string printerName, string paper, string orientation, int copies, string documentId, string documentType, string user, string purpose)
    {
        var printPurpose = string.Equals(purpose, "pdf", StringComparison.OrdinalIgnoreCase) ? "pdf" : "print";
        if (printPurpose == "pdf")
            return "{\"ok\":false,\"status\":\"PRINT_FAILED\",\"errorCode\":\"PDF_NOT_PRINT\",\"message\":\"چاپ بومی مسیر PDF نیست.\"}";
        if (!NativePrintRequest.TryParse(documentJson, out var request, out var parseError))
        {
            var fail = PrintJobState.New(printerName, documentId, documentType, user, printPurpose);
            _jobs[fail.PrintJobId] = fail;
            fail.Fail("NO_DOCUMENT", string.IsNullOrWhiteSpace(parseError) ? "سندی برای چاپ نیست" : parseError);
            AppendLog(fail);
            return fail.ToJson();
        }
        if (!string.IsNullOrWhiteSpace(printerName))
            request = request with { PrinterName = printerName };
        if (!string.IsNullOrWhiteSpace(paper))
            request = request with { Paper = paper };
        if (!string.IsNullOrWhiteSpace(orientation))
            request = request with { Orientation = orientation };
        request = request with
        {
            Copies = copies > 0 ? copies : request.Copies,
            DocumentId = string.IsNullOrWhiteSpace(documentId) ? request.DocumentId : documentId,
            DocumentType = string.IsNullOrWhiteSpace(documentType) ? request.DocumentType : documentType,
            User = string.IsNullOrWhiteSpace(user) ? request.User : user,
            Purpose = printPurpose
        };

        var job = PrintJobState.New(request.PrinterName, request.DocumentId, request.DocumentType, request.User, printPurpose);
        _jobs[job.PrintJobId] = job;
        job.Log("PRINT_REQUESTED", "کار چاپ بومی ثبت شد", request.PrinterName);
        AppendLog(job);
        if (!_ui.IsHandleCreated)
        {
            job.Fail("NO_UI", "پنجره برنامه برای چاپ آماده نیست");
            AppendLog(job);
            return job.ToJson();
        }
        _ = Task.Run(() => RunNative(job, request));
        return job.ToJson();
    }

    private void RunNative(PrintJobState job, NativePrintRequest request)
    {
        try
        {
            job.Set("PRINTING", null, "در حال آماده‌سازی سند بومی برای چاپ");
            job.Log("PRINTING", "شروع چاپ بومی PrintDocument", request.PrinterName);
            AppendLog(job);

            var listed = ReadPrinters();
            var physical = listed.Where(p => p.IsPhysical).ToList();
            if (physical.Count == 0)
            {
                job.Fail("NO_PRINTER", "چاپگر واقعی نصب نیست. Microsoft Print to PDF چاپ نیست.");
                job.Log("PRINT_FAILED", job.ErrorMessage ?? "", request.PrinterName);
                AppendLog(job);
                return;
            }

            var chosen = ResolvePrinter(request.PrinterName, listed, "print", out var resolveError, out var resolveCode);
            if (string.IsNullOrEmpty(chosen))
            {
                job.Fail(resolveCode, resolveError);
                job.Log("PRINT_FAILED", resolveError, request.PrinterName);
                AppendLog(job);
                return;
            }

            job.Printer = chosen;
            job.Log("PRINTER_RESOLVED", "چاپگر انتخاب شد", chosen);
            AppendLog(job);

            var ps = new PrinterSettings { PrinterName = chosen };
            if (!ps.IsValid)
            {
                job.Fail("PRINTER_UNAVAILABLE", "Printer is unavailable.");
                job.Log("PRINT_FAILED", "PrinterSettings.IsValid=false", chosen);
                AppendLog(job);
                return;
            }

            if (!Winspool.TryOpen(chosen, out var openErr))
            {
                job.Fail("PRINT_SPOOLER_FAILED", string.IsNullOrEmpty(openErr) ? "صف چاپ ویندوز این چاپگر را باز نکرد." : openErr);
                job.Log("PRINT_SPOOLER_FAILED", openErr, chosen);
                AppendLog(job);
                return;
            }

            if (Winspool.IsOffline(chosen))
            {
                job.Fail("PRINTER_UNAVAILABLE", "Printer is unavailable.");
                job.Log("PRINT_FAILED", "چاپگر آفلاین است", chosen);
                AppendLog(job);
                return;
            }

            var resolved = NativePrintPaper.Resolve(NativePrintPaper.FromRequest(request));
            job.SettingsSummary = "engine=native; PrinterName=" + chosen + "; paper=" + resolved.Name
                + "; orientation=" + (resolved.Landscape ? "landscape" : "portrait")
                + "; copies=" + resolved.Copies
                + "; paperSource=" + resolved.Source;
            job.Log("PRINT_SETTINGS_CREATED", job.SettingsSummary, chosen);
            AppendLog(job);

            NativeWindowsPrintService.Submit(job, request with { PrinterName = chosen });
            AppendLog(job);
        }
        catch (Exception ex)
        {
            job.Fail("NATIVE_PRINT_FAILED", "چاپ بومی انجام نشد: " + ex.Message);
            job.ErrorDetail = ex.GetType().Name + ": " + ex.Message;
            job.Log("PRINT_FAILED", ex.Message, request.PrinterName);
            AppendLog(job);
        }
    }

    public string Enqueue(string html, string printerName, string paper, string orientation, int copies, string documentId, string documentType, string user, string purpose)
    {
        var printPurpose = string.Equals(purpose, "pdf", StringComparison.OrdinalIgnoreCase) ? "pdf" : "print";
        var job = PrintJobState.New(printerName, documentId, documentType, user, printPurpose);
        _jobs[job.PrintJobId] = job;
        job.Log("PRINT_REQUESTED", "کار چاپ ثبت شد", printerName);
        AppendLog(job);
        if (!_ui.IsHandleCreated)
        {
            job.Fail("NO_UI", "پنجره برنامه برای چاپ آماده نیست");
            AppendLog(job);
            return job.ToJson();
        }
        _ui.BeginInvoke(new Action(() => _ = RunAsync(job, html ?? "", printerName ?? "", paper ?? "", orientation ?? "", Math.Max(1, copies), printPurpose)));
        return job.ToJson();
    }

    private async Task RunAsync(PrintJobState job, string html, string printerName, string paper, string orientation, int copies, string purpose)
    {
        try
        {
            job.Set("PRINTING", null, "در حال آماده‌سازی سند برای چاپ");
            job.Log("PRINTING", "شروع آماده‌سازی", printerName);
            AppendLog(job);

            var listed = ReadPrinters();
            var physical = listed.Where(p => p.IsPhysical).ToList();
            if (purpose != "pdf" && physical.Count == 0)
            {
                job.Fail("NO_PRINTER", "چاپگر واقعی نصب نیست. Microsoft Print to PDF چاپ نیست.");
                job.Log("PRINT_FAILED", job.ErrorMessage ?? "", printerName);
                AppendLog(job);
                return;
            }

            var chosen = ResolvePrinter(printerName, listed, purpose, out var resolveError, out var resolveCode);
            if (string.IsNullOrEmpty(chosen))
            {
                job.Fail(resolveCode, resolveError);
                job.Log("PRINT_FAILED", resolveError, printerName);
                AppendLog(job);
                return;
            }

            job.Printer = chosen;
            job.Log("PRINTER_RESOLVED", "چاپگر انتخاب شد", chosen);
            AppendLog(job);

            var ps = new PrinterSettings { PrinterName = chosen };
            if (!ps.IsValid)
            {
                job.Fail("PRINTER_UNAVAILABLE", "Printer is unavailable.");
                job.Log("PRINT_FAILED", "PrinterSettings.IsValid=false", chosen);
                AppendLog(job);
                return;
            }

            if (!Winspool.TryOpen(chosen, out var openErr))
            {
                job.Fail("PRINT_SPOOLER_FAILED", string.IsNullOrEmpty(openErr) ? "صف چاپ ویندوز این چاپگر را باز نکرد." : openErr);
                job.Log("PRINT_SPOOLER_FAILED", openErr, chosen);
                AppendLog(job);
                return;
            }

            if (Winspool.IsOffline(chosen))
            {
                job.Fail("PRINTER_UNAVAILABLE", "Printer is unavailable.");
                job.Log("PRINT_FAILED", "چاپگر آفلاین است", chosen);
                AppendLog(job);
                return;
            }

            await EnsureViewAsync();
            if (_view?.CoreWebView2 is null)
            {
                job.Fail("PRINT_WEBVIEW_FAILED", "موتور چاپ WebView2 آماده نشد");
                job.Log("PRINT_WEBVIEW_FAILED", job.ErrorMessage ?? "", chosen);
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
                job.Fail("PRINT_WEBVIEW_FAILED", "سند چاپ بارگذاری نشد");
                job.Log("PRINT_WEBVIEW_FAILED", "Navigate failed", chosen);
                AppendLog(job);
                return;
            }

            try
            {
                await _view.CoreWebView2.ExecuteScriptAsync("document.readyState");
            }
            catch (Exception ex)
            {
                job.Log("PRINT_WEBVIEW_FAILED", "readyState: " + ex.Message, chosen);
            }
            await Task.Delay(250);

            CoreWebView2PrintSettings settings;
            try
            {
                settings = _view.CoreWebView2.Environment.CreatePrintSettings();
                settings.PrinterName = chosen;
                settings.Copies = copies;
                settings.Orientation = string.Equals(orientation, "landscape", StringComparison.OrdinalIgnoreCase)
                    ? CoreWebView2PrintOrientation.Landscape
                    : CoreWebView2PrintOrientation.Portrait;
                ApplyPaper(settings, paper, orientation);
                ApplyMargins(settings, paper);
                job.SettingsSummary = "PrinterName=" + chosen + "; paper=" + paper + "; orientation=" + orientation + "; copies=" + copies;
                job.Log("PRINT_SETTINGS_CREATED", job.SettingsSummary, chosen);
                AppendLog(job);
            }
            catch (Exception ex)
            {
                job.Fail("PRINT_WEBVIEW_FAILED", "تنظیمات چاپ ساخته نشد: " + ex.Message);
                job.ErrorDetail = ex.GetType().Name + ": " + ex.Message;
                job.Log("PRINT_WEBVIEW_FAILED", ex.Message, chosen);
                AppendLog(job);
                return;
            }

            if (string.IsNullOrWhiteSpace(settings.PrinterName))
            {
                job.Fail("PRINT_ASYNC_FAILED", "PrinterName به PrintAsync نرسید.");
                job.Log("PRINT_ASYNC_FAILED", "PrinterName empty after settings", chosen);
                AppendLog(job);
                return;
            }

            job.Set("PRINTING", null, "در حال ارسال به صف چاپ ویندوز");
            job.Log("PRINT_ASYNC_STARTED", "PrintAsync " + settings.PrinterName, chosen);
            AppendLog(job);

            CoreWebView2PrintStatus status;
            try
            {
                status = await _view.CoreWebView2.PrintAsync(settings);
            }
            catch (Exception ex)
            {
                job.Fail("PRINT_ASYNC_FAILED", "PrintAsync خطا داد: " + ex.Message);
                job.ErrorDetail = ex.GetType().Name + ": " + ex.Message;
                job.Log("PRINT_ASYNC_FAILED", ex.Message, chosen);
                AppendLog(job);
                return;
            }

            job.Log("PRINT_ASYNC_COMPLETED", status.ToString(), chosen);
            AppendLog(job);

            if (status == CoreWebView2PrintStatus.Succeeded)
            {
                if (purpose == "pdf")
                {
                    job.Set("PDF_EXPORTED", null, "خروجی فایل PDF ساخته شد — این چاپ کاغذ نیست");
                    job.Ok = true;
                    job.Log("PDF_EXPORTED", "PDF export only", chosen);
                }
                else
                {
                    job.Set("PRINT_SUBMITTED", null, "سند به صف چاپ ویندوز ارسال شد — " + chosen);
                    job.Ok = true;
                    job.Log("PRINT_SUBMITTED", "spooler accepted", chosen);
                }
            }
            else if (status == CoreWebView2PrintStatus.PrinterUnavailable)
            {
                job.Fail("PRINTER_UNAVAILABLE", "Printer is unavailable.");
                job.Log("PRINT_FAILED", "PrintAsync PrinterUnavailable", chosen);
            }
            else
            {
                job.Fail("PRINT_ASYNC_FAILED", "PrintAsync وضعیت " + status + " برگرداند");
                job.Log("PRINT_FAILED", status.ToString(), chosen);
            }
            AppendLog(job);
        }
        catch (Exception ex)
        {
            job.Fail("PRINT_ASYNC_FAILED", "چاپ انجام نشد: " + ex.Message);
            job.ErrorDetail = ex.GetType().Name + ": " + ex.Message;
            job.Log("PRINT_FAILED", ex.Message, printerName);
            AppendLog(job);
        }
    }

    internal static bool IsVirtualPrinter(string name)
    {
        var n = (name ?? "").Trim().ToLowerInvariant();
        if (n.Length == 0) return false;
        if (n == "pdf" || n == "browser" || n == "مرورگر / پنجره چاپ") return true;
        if (n.Contains("pdf", StringComparison.Ordinal)) return true;
        if (n.Contains("xps", StringComparison.Ordinal)) return true;
        if (n.Contains("onenote", StringComparison.Ordinal)) return true;
        if (n.Contains("fax", StringComparison.Ordinal)) return true;
        if (n.Contains("send to", StringComparison.Ordinal)) return true;
        return false;
    }

    internal static string PrinterKind(string name)
    {
        var n = (name ?? "").ToLowerInvariant();
        if (n.Contains("pdf")) return "pdf";
        if (n.Contains("xps")) return "xps";
        if (n.Contains("fax")) return "fax";
        if (n.Contains("onenote")) return "virtual";
        if (IsVirtualPrinter(name)) return "virtual";
        return "physical";
    }

    private static List<PrinterRow> ReadPrinters()
    {
        var list = new List<PrinterRow>();
        var defName = "";
        try { defName = new PrinterSettings().PrinterName ?? ""; } catch { /* none */ }
        foreach (string name in PrinterSettings.InstalledPrinters)
        {
            if (string.IsNullOrWhiteSpace(name)) continue;
            var clean = name.Trim().Trim('\u200e', '\u200f');
            var ps = new PrinterSettings { PrinterName = clean };
            var kind = PrinterKind(clean);
            list.Add(new PrinterRow(clean, defName.Length > 0 && string.Equals(clean, defName, StringComparison.OrdinalIgnoreCase), ps.IsValid, kind == "physical", kind));
        }
        return list;
    }

    internal static string ResolvePrinter(string requested, List<PrinterRow> listed, string purpose, out string error, out string code)
    {
        error = "";
        code = "";
        var want = (requested ?? "").Trim().Trim('\u200e', '\u200f');
        var pdfMode = string.Equals(purpose, "pdf", StringComparison.OrdinalIgnoreCase);

        if (pdfMode)
        {
            if (want.Length > 0 && !string.Equals(want, "PDF", StringComparison.OrdinalIgnoreCase))
            {
                var named = listed.FirstOrDefault(p => string.Equals(p.Name, want, StringComparison.OrdinalIgnoreCase));
                if (!string.IsNullOrEmpty(named.Name) && named.Kind == "pdf") return named.Name;
            }
            var pdf = listed.FirstOrDefault(p => p.Kind == "pdf" && p.IsValid);
            if (!string.IsNullOrEmpty(pdf.Name)) return pdf.Name;
            code = "NO_PDF_PRINTER";
            error = "چاپگر PDF ویندوز پیدا نشد.";
            return "";
        }

        if (IsVirtualPrinter(want) || string.Equals(want, "PDF", StringComparison.OrdinalIgnoreCase))
        {
            code = "PDF_NOT_PRINT";
            error = "این چاپگر فایل/PDF است. چاپ کاغذ فقط با چاپگر واقعی انجام می‌شود.";
            return "";
        }

        if (want.Length == 0
            || string.Equals(want, "browser", StringComparison.OrdinalIgnoreCase)
            || want == "مرورگر / پنجره چاپ")
        {
            var def = listed.FirstOrDefault(p => p.IsDefault && p.IsPhysical && p.IsValid);
            if (!string.IsNullOrEmpty(def.Name)) return def.Name;
            var any = listed.FirstOrDefault(p => p.IsPhysical && p.IsValid);
            if (!string.IsNullOrEmpty(any.Name)) return any.Name;
            if (listed.Any(p => !p.IsPhysical))
            {
                code = "PDF_NOT_PRINT";
                error = "چاپگر واقعی نصب نیست. Microsoft Print to PDF چاپ نیست.";
                return "";
            }
            code = "NO_DEFAULT_PRINTER";
            error = "چاپگر پیش‌فرض واقعی تنظیم نشده است.";
            return "";
        }

        var hit = listed.FirstOrDefault(p => string.Equals(p.Name, want, StringComparison.OrdinalIgnoreCase));
        if (string.IsNullOrEmpty(hit.Name))
        {
            code = "PRINTER_NOT_FOUND";
            error = "چاپگر انتخاب‌شده پیدا نشد.";
            return "";
        }
        if (!hit.IsPhysical)
        {
            code = "PDF_NOT_PRINT";
            error = "چاپگر انتخاب‌شده فایل/PDF است. چاپ کاغذ انجام نشد.";
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
        var spec = NativePrintLayout.ParsePaper(paper, orientation);
        if (NativePrintLayout.IsIsoA4OrA5(spec.Name))
            return;
        double w = spec.WidthHundredthsInch / 100.0;
        double h = spec.HeightHundredthsInch / 100.0;
        settings.PageWidth = spec.Landscape ? h : w;
        settings.PageHeight = spec.Landscape ? w : h;
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
            Width = 794,
            Height = 1123,
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

internal readonly record struct PrinterRow(string Name, bool IsDefault, bool IsValid, bool IsPhysical, string Kind);

internal static class Winspool
{
    [DllImport("winspool.drv", CharSet = CharSet.Unicode, SetLastError = true)]
    private static extern bool OpenPrinter(string pPrinterName, out IntPtr phPrinter, IntPtr pDefault);

    [DllImport("winspool.drv", SetLastError = true)]
    private static extern bool ClosePrinter(IntPtr hPrinter);

    public static bool TryOpen(string printerName, out string error)
    {
        error = "";
        try
        {
            if (!OpenPrinter(printerName, out var handle, IntPtr.Zero))
            {
                error = "OpenPrinter failed " + Marshal.GetLastWin32Error();
                return false;
            }
            ClosePrinter(handle);
            return true;
        }
        catch (Exception ex)
        {
            error = ex.Message;
            return false;
        }
    }

    public static bool IsOffline(string printerName)
    {
        try
        {
            var ps = new PrinterSettings { PrinterName = printerName };
            return !ps.IsValid;
        }
        catch
        {
            return true;
        }
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
    public string Purpose { get; init; } = "print";
    public string RequestedAt { get; init; } = "";
    public string UpdatedAt { get; set; } = "";
    public string SettingsSummary { get; set; } = "";
    public List<string> Events { get; } = new();

    public static PrintJobState New(string printer, string documentId, string documentType, string user, string purpose)
    {
        var now = DateTimeOffset.Now.ToString("o");
        return new PrintJobState
        {
            PrintJobId = PrintJobIdentity.Create(),
            Status = "PRINT_REQUESTED",
            Printer = printer ?? "",
            DocumentId = documentId ?? "",
            DocumentType = documentType ?? "",
            User = user ?? "",
            Purpose = purpose ?? "print",
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

    public void Log(string phase, string detail, string printer)
    {
        var line = DateTimeOffset.Now.ToString("o") + " " + phase + " printer=" + printer + " " + detail;
        Events.Add(line);
        if (Events.Count > 20) Events.RemoveAt(0);
        UpdatedAt = DateTimeOffset.Now.ToString("o");
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
        ["errorDetail"] = ErrorDetail,
        ["printer"] = Printer,
        ["documentId"] = DocumentId,
        ["documentType"] = DocumentType,
        ["user"] = User,
        ["purpose"] = Purpose,
        ["settings"] = SettingsSummary,
        ["events"] = Events,
        ["requestedAt"] = RequestedAt,
        ["timestamp"] = UpdatedAt
    });
}
