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
/// هارنس تشخیص سخت‌افزار چاپ — جدا از مرکز پرینت و داده کسب‌وکار.
/// چاپ آزمایشی فقط متن ثابت است؛ فاکتور/انبار/حساب را لمس نمی‌کند.
/// </summary>
internal sealed class PrintHardwareDiagnostic
{
    public const string DocumentName = "SIRMAN PRINT HARDWARE TEST";
    private readonly Control _ui;
    private readonly object _gate = new();
    private readonly Dictionary<string, DiagJob> _jobs = new(StringComparer.OrdinalIgnoreCase);
    private WebView2? _view;
    private Task? _ensureView;
    private ProbeSnapshot? _lastProbe;
    private string _selectedPrinter = "";
    private bool _paperVerified;
    private string _paperNote = "";
    private static readonly JsonSerializerOptions HistoryJsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase
    };

    public PrintHardwareDiagnostic(Control ui) => _ui = ui;

    public string Run(string json)
    {
        try
        {
            using var doc = JsonDocument.Parse(string.IsNullOrWhiteSpace(json) ? "{\"action\":\"probe\"}" : json);
            var root = doc.RootElement;
            var action = Str(root, "action");
            if (action.Length == 0) action = "probe";
            var printer = Str(root, "printerName");
            if (printer.Length == 0) printer = Str(root, "printer");
            return action.ToLowerInvariant() switch
            {
                "probe" or "enumerate" or "refresh" => Probe(printer),
                "resolve" => ResolveOnly(printer),
                "directprint" or "direct" => StartDirect(printer),
                "webviewprint" or "webview" or "webview2" => StartWebView(printer),
                "queue" or "status" => QueueStatus(printer, Str(root, "jobId")),
                "confirmpaper" or "paper" => ConfirmPaper(root),
                "matrix" => MatrixJson(),
                "history" => HistoryJson(),
                "historyevent" or "verify" => HistoryEvent(root),
                _ => Fail("UNKNOWN_PRINT_FAILURE", "عمل تشخیص ناشناخته است: " + action)
            };
        }
        catch (Exception ex)
        {
            Log("EXCEPTION", "", ex.GetType().Name + ": " + ex.Message);
            return SafeError.Json("UNKNOWN_PRINT_FAILURE", "تشخیص چاپ انجام نشد", ex);
        }
    }

    private string Probe(string requested)
    {
        var windowsOk = OperatingSystem.IsWindows();
        var os = DescribeOs();
        var app = AppVersion();
        var machine = Environment.MachineName;
        var spooler = ReadSpooler();
        var printers = ReadPrinters();
        var winDefault = ReadWindowsDefaultPrinter();
        var processDefault = "";
        try { processDefault = new PrinterSettings().PrinterName ?? ""; } catch { processDefault = ""; }
        var defaultMatch = string.Equals(winDefault, processDefault, StringComparison.OrdinalIgnoreCase)
            || (winDefault.Length == 0 && processDefault.Length == 0);
        var physical = printers.Where(p => p.IsPhysical).ToList();
        var want = (requested ?? "").Trim();
        if (want.Length == 0)
            want = physical.FirstOrDefault(p => p.IsDefault).Name
                ?? physical.FirstOrDefault().Name
                ?? "";
        var resolution = ResolvePhysical(want, printers, out var resolveCode, out var resolveMsg);
        if (!string.IsNullOrEmpty(resolution)) _selectedPrinter = resolution;
        else if (want.Length > 0) _selectedPrinter = want;

        var selected = printers.FirstOrDefault(p => string.Equals(p.Name, _selectedPrinter, StringComparison.OrdinalIgnoreCase));
        var snapshot = new ProbeSnapshot
        {
            WindowsOk = windowsOk,
            Os = os,
            AppVersion = app,
            Machine = machine,
            SpoolerAvailable = spooler.Available,
            SpoolerDetail = spooler.Detail,
            WindowsDefault = winDefault,
            ProcessDefault = processDefault,
            DefaultMatch = defaultMatch,
            Printers = printers,
            Selected = _selectedPrinter,
            Resolved = !string.IsNullOrEmpty(resolution),
            ResolveCode = string.IsNullOrEmpty(resolution) ? resolveCode : "PRINTER_RESOLVED",
            ResolveMessage = string.IsNullOrEmpty(resolution) ? resolveMsg : "PRINTER_RESOLVED",
            Driver = selected.Driver,
            Port = selected.Port,
            Connection = selected.Connection,
            PrinterStatus = selected.PrinterStatus
        };
        _lastProbe = snapshot;
        Log("PROBE", _selectedPrinter,
            "windows=" + windowsOk + " spooler=" + spooler.Available + " printers=" + printers.Count
            + " physical=" + physical.Count + " default=" + winDefault + " resolved=" + snapshot.Resolved);

        return JsonSerializer.Serialize(BuildProbeDict(snapshot));
    }

    private string ResolveOnly(string requested)
    {
        var printers = ReadPrinters();
        var name = ResolvePhysical(requested, printers, out var code, out var msg);
        if (string.IsNullOrEmpty(name))
        {
            Log("PRINTER_NOT_RESOLVED", requested, msg);
            return Fail(code, msg);
        }
        _selectedPrinter = name;
        var row = printers.FirstOrDefault(p => string.Equals(p.Name, name, StringComparison.OrdinalIgnoreCase));
        Log("PRINTER_RESOLVED", name, "driver=" + row.Driver + " port=" + row.Port);
        return JsonSerializer.Serialize(new Dictionary<string, object?>
        {
            ["ok"] = true,
            ["status"] = "PRINTER_RESOLVED",
            ["printerName"] = name,
            ["driver"] = row.Driver,
            ["port"] = row.Port,
            ["connectionType"] = row.Connection,
            ["isPhysical"] = true,
            ["class"] = PrintHardwareFacts.Physical
        });
    }

    private string StartDirect(string requested)
    {
        var printers = ReadPrinters();
        var name = ResolvePhysical(requested.Length > 0 ? requested : _selectedPrinter, printers, out var code, out var msg);
        if (string.IsNullOrEmpty(name))
            return Fail(code, msg);
        if (PrintHardwareFacts.IsVirtualPrinter(name))
            return Fail("PDF_ONLY_PATH", "چاپگر فایل/PDF برای تست کاغذ مجاز نیست.");
        var job = DiagJob.New(name, "direct");
        lock (_gate) _jobs[job.Id] = job;
        job.Set("PRINTING", "در حال ارسال چاپ مستقیم ویندوز");
        Log("DIRECT_PRINT_START", name, job.Id);

        void Work()
        {
            try
            {
                SubmitDirect(job, name);
            }
            catch (Exception ex)
            {
                job.Fail("DIRECT_PRINT_FAILED", ex.Message);
                Log("DIRECT_PRINT_FAILED", name, ex.Message);
            }
        }

        if (_ui.InvokeRequired) _ui.Invoke(Work);
        else Work();
        InspectQueue(job, name);
        TryRecordJobHistory(job, job.Path == "direct" ? "GDI" : "WebView2");
        return job.ToJson();
    }

    private void SubmitDirect(DiagJob job, string printer)
    {
        var ps = new PrinterSettings { PrinterName = printer };
        if (!ps.IsValid)
        {
            job.Fail("PRINTER_NOT_RESOLVED", "PrinterSettings.IsValid=false");
            Log("PRINTER_NOT_RESOLVED", printer, "IsValid=false");
            return;
        }
        if (!Native.TryOpenPrinter(printer, out var openErr))
        {
            job.Fail("SPOOLER_REJECTED_JOB", string.IsNullOrEmpty(openErr) ? "OpenPrinter failed" : openErr);
            Log("SPOOLER_REJECTED_JOB", printer, openErr);
            return;
        }

        using var doc = new PrintDocument();
        doc.PrinterSettings.PrinterName = printer;
        doc.DocumentName = DocumentName;
        doc.PrintController = new StandardPrintController();
        var stamp = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss");
        doc.PrintPage += (_, e) =>
        {
            var g = e.Graphics;
            if (g is null) return;
            using var font = new Font("Tahoma", 16, FontStyle.Bold);
            using var small = new Font("Tahoma", 11, FontStyle.Regular);
            using var brush = new SolidBrush(Color.Black);
            float y = 40;
            g.DrawString("SIRMAN", font, brush, 40, y); y += 36;
            g.DrawString("PRINT HARDWARE TEST", font, brush, 40, y); y += 40;
            g.DrawString("Timestamp: " + stamp, small, brush, 40, y); y += 22;
            g.DrawString("Printer: " + printer, small, brush, 40, y); y += 22;
            g.DrawString("Machine: " + Environment.MachineName, small, brush, 40, y);
            e.HasMorePages = false;
        };
        doc.EndPrint += (_, _) => { /* spooler accepted the GDI job */ };
        doc.Print();
        job.Set("PRINT_SUBMITTED", "ویندوز کار چاپ مستقیم را پذیرفت — خروجی کاغذ هنوز تأیید نشده");
        job.Submitted = true;
        Log("DIRECT_PRINT_SUBMITTED", printer, job.Id);
    }

    private string StartWebView(string requested)
    {
        var printers = ReadPrinters();
        var name = ResolvePhysical(requested.Length > 0 ? requested : _selectedPrinter, printers, out var code, out var msg);
        if (string.IsNullOrEmpty(name))
            return Fail(code, msg);
        if (PrintHardwareFacts.IsVirtualPrinter(name))
            return Fail("PDF_ONLY_PATH", "چاپگر فایل/PDF برای تست کاغذ مجاز نیست.");
        var job = DiagJob.New(name, "webview2");
        lock (_gate) _jobs[job.Id] = job;
        job.Set("PRINTING", "در حال PrintAsync تشخیصی");
        Log("WEBVIEW_PRINT_START", name, job.Id);
        if (!_ui.IsHandleCreated)
        {
            job.Fail("WEBVIEW2_PRINT_FAILED", "پنجره برنامه برای WebView2 آماده نیست");
            TryRecordJobHistory(job, "WebView2");
            return job.ToJson();
        }
        _ui.BeginInvoke(new Action(() => _ = RunWebViewAsync(job, name)));
        return job.ToJson();
    }

    private async Task RunWebViewAsync(DiagJob job, string printer)
    {
        try
        {
            await EnsureViewAsync();
            if (_view?.CoreWebView2 is null)
            {
                job.Fail("WEBVIEW2_PRINT_FAILED", "WebView2 تشخیصی آماده نشد");
                Log("WEBVIEW2_PRINT_FAILED", printer, "no CoreWebView2");
                return;
            }
            var html = DiagnosticHtml(printer);
            var dir = Path.Combine(Path.GetTempPath(), "sirman-print-diag");
            Directory.CreateDirectory(dir);
            var path = Path.Combine(dir, job.Id + ".html");
            File.WriteAllText(path, html, new UTF8Encoding(encoderShouldEmitUTF8Identifier: true));
            var tcs = new TaskCompletionSource<bool>(TaskCreationOptions.RunContinuationsAsynchronously);
            void Handler(object? sender, CoreWebView2NavigationCompletedEventArgs e)
            {
                _view.CoreWebView2.NavigationCompleted -= Handler;
                tcs.TrySetResult(e.IsSuccess);
            }
            _view.CoreWebView2.NavigationCompleted += Handler;
            _view.CoreWebView2.Navigate(new Uri(path).AbsoluteUri);
            var nav = await tcs.Task;
            if (!nav)
            {
                job.Fail("WEBVIEW2_PRINT_FAILED", "بارگذاری سند تشخیصی شکست خورد");
                return;
            }
            await Task.Delay(200);
            var settings = _view.CoreWebView2.Environment.CreatePrintSettings();
            settings.PrinterName = printer;
            settings.Copies = 1;
            settings.Orientation = CoreWebView2PrintOrientation.Portrait;
            CoreWebView2PrintStatus status;
            try
            {
                status = await _view.CoreWebView2.PrintAsync(settings);
            }
            catch (Exception ex)
            {
                job.Fail("WEBVIEW2_PRINT_FAILED", ex.Message);
                Log("WEBVIEW2_PRINT_FAILED", printer, ex.Message);
                return;
            }
            if (status == CoreWebView2PrintStatus.Succeeded)
            {
                job.Set("PRINT_SUBMITTED", "WebView2 PrintAsync وضعیت Succeeded داد — خروجی کاغذ تأیید نشده");
                job.Submitted = true;
                Log("WEBVIEW_PRINT_SUBMITTED", printer, status.ToString());
            }
            else if (status == CoreWebView2PrintStatus.PrinterUnavailable)
            {
                job.Fail("PRINTER_NOT_RESOLVED", "PrintAsync: PrinterUnavailable");
                Log("WEBVIEW2_PRINT_FAILED", printer, "PrinterUnavailable");
            }
            else
            {
                job.Fail("WEBVIEW2_PRINT_FAILED", "PrintAsync=" + status);
                Log("WEBVIEW2_PRINT_FAILED", printer, status.ToString());
            }
            InspectQueue(job, printer);
        }
        catch (Exception ex)
        {
            job.Fail("WEBVIEW2_PRINT_FAILED", ex.Message);
            Log("WEBVIEW2_PRINT_FAILED", printer, ex.Message);
        }
        TryRecordJobHistory(job, "WebView2");
    }

    private string QueueStatus(string requested, string jobId)
    {
        DiagJob? job = null;
        lock (_gate)
        {
            if (!string.IsNullOrWhiteSpace(jobId) && _jobs.TryGetValue(jobId, out var found))
                job = found;
            else
                job = _jobs.Values.OrderByDescending(j => j.CreatedUtc).FirstOrDefault();
        }
        var printer = requested.Length > 0 ? requested : job?.Printer ?? _selectedPrinter;
        if (job != null && !string.IsNullOrEmpty(printer))
            InspectQueue(job, printer);
        if (job is null)
            return Fail("JOB_ID_NOT_AVAILABLE", "کار تشخیصی پیدا نشد");
        return job.ToJson();
    }

    private void InspectQueue(DiagJob job, string printer)
    {
        try
        {
            var jobs = Native.EnumJobs(printer);
            job.QueueObserved = jobs.Count > 0 || job.Submitted;
            var match = jobs.FirstOrDefault(j =>
                string.Equals(j.Document, DocumentName, StringComparison.OrdinalIgnoreCase)
                || (job.WinJobId > 0 && j.JobId == job.WinJobId));
            if (match.JobId == 0 && jobs.Count > 0)
                match = jobs[0];
            if (match.JobId == 0)
            {
                if (job.Submitted && string.IsNullOrEmpty(job.QueueState))
                    job.QueueState = "UNKNOWN";
                if (job.WinJobId == 0)
                    job.WinJobIdNote = "JOB_ID_NOT_AVAILABLE";
                return;
            }
            job.WinJobId = match.JobId;
            job.WinJobIdNote = match.JobId.ToString();
            job.QueueState = PrintHardwareFacts.MapJobStatus(match.Status, match.StatusText);
            job.QueueDocument = match.Document;
            Log("QUEUE", printer, "jobId=" + match.JobId + " state=" + job.QueueState);
        }
        catch (Exception ex)
        {
            job.QueueState = "UNKNOWN";
            job.WinJobIdNote = "JOB_ID_NOT_AVAILABLE";
            Log("QUEUE", printer, "enum failed: " + ex.Message);
        }
    }

    private string ConfirmPaper(JsonElement root)
    {
        var came = false;
        if (root.TryGetProperty("paperCameOut", out var el))
        {
            came = el.ValueKind == JsonValueKind.True
                || (el.ValueKind == JsonValueKind.String && (el.GetString() == "1" || string.Equals(el.GetString(), "true", StringComparison.OrdinalIgnoreCase)));
        }
        else if (root.TryGetProperty("verified", out var v))
        {
            came = v.ValueKind == JsonValueKind.True;
        }
        _paperVerified = came;
        _paperNote = came ? "PHYSICAL PRINT VERIFIED" : "PHYSICAL_PRINT_NOT_VERIFIED";
        Log("PAPER_CONFIRM", _selectedPrinter, _paperNote);
        DiagJob? last;
        lock (_gate)
            last = _jobs.Values.OrderByDescending(j => j.CreatedUtc).FirstOrDefault();
        var sessionId = Str(root, "sessionId");
        if (string.IsNullOrWhiteSpace(sessionId))
            sessionId = last?.SessionId ?? "";
        if (!string.IsNullOrWhiteSpace(sessionId))
        {
            if (!DiagnosticHistoryBridge.TryAppendVerification(sessionId, came, _paperNote, out var histErr)
                && !string.IsNullOrEmpty(histErr))
                Log("DIAG_HISTORY_WRITE_FAILED", _selectedPrinter, histErr);
        }
        return MatrixJson();
    }

    private void TryRecordJobHistory(DiagJob job, string engine)
    {
        try
        {
            if (!job.Submitted && string.IsNullOrEmpty(job.ErrorCode))
                return;
            var queueId = job.WinJobId > 0 ? job.WinJobId.ToString() : null;
            var evt = DiagnosticHistoryBridge.HardwareSubmitted(
                job.SessionId,
                job.Printer,
                engine,
                job.Path,
                job.Id,
                queueId,
                string.IsNullOrEmpty(job.ErrorCode) ? null : job.ErrorCode,
                string.IsNullOrEmpty(job.Message) ? null : job.Message);
            if (!DiagnosticHistoryBridge.TryAppend(evt, out var err) && !string.IsNullOrEmpty(err))
                Log("DIAG_HISTORY_WRITE_FAILED", job.Printer, err);
        }
        catch (Exception ex)
        {
            Log("DIAG_HISTORY_WRITE_FAILED", job.Printer, ex.Message);
        }
    }

    private string HistoryEvent(JsonElement root)
    {
        var sessionId = Str(root, "sessionId");
        var came = false;
        if (root.TryGetProperty("physicalCameOutCorrectly", out var el))
        {
            came = el.ValueKind == JsonValueKind.True
                || (el.ValueKind == JsonValueKind.String && (el.GetString() == "1" || string.Equals(el.GetString(), "true", StringComparison.OrdinalIgnoreCase)));
        }
        else if (root.TryGetProperty("paperCameOut", out var p))
        {
            came = p.ValueKind == JsonValueKind.True;
        }
        if (string.IsNullOrWhiteSpace(sessionId))
            return Fail("UNKNOWN_PRINT_FAILURE", "شناسه جلسه تشخیص نیست");
        if (!DiagnosticHistoryBridge.TryAppendVerification(sessionId, came, came ? "PHYSICAL PRINT VERIFIED" : "PHYSICAL_PRINT_NOT_VERIFIED", out var err)
            && !string.IsNullOrEmpty(err))
            Log("DIAG_HISTORY_WRITE_FAILED", _selectedPrinter, err);
        return HistoryJson();
    }

    private string HistoryJson()
    {
        try
        {
            var events = DiagnosticHistoryBridge.CreateStore().ReadAllNewestFirst();
            return JsonSerializer.Serialize(new Dictionary<string, object?>
            {
                ["ok"] = true,
                ["action"] = "history",
                ["path"] = DiagnosticHistoryBridge.FilePath,
                ["count"] = events.Count,
                ["events"] = events,
                ["historyWriteFailed"] = DiagnosticHistoryBridge.LastWriteFailed,
                ["historyWriteError"] = DiagnosticHistoryBridge.LastWriteError,
                ["historyReadFailed"] = false,
                ["paperVerified"] = _paperVerified,
                ["paperNote"] = string.IsNullOrEmpty(_paperNote) ? "PHYSICAL_PRINT_NOT_VERIFIED" : _paperNote
            }, HistoryJsonOptions);
        }
        catch (Exception ex)
        {
            Log("DIAG_HISTORY_READ_FAILED", "", ex.Message);
            return JsonSerializer.Serialize(new Dictionary<string, object?>
            {
                ["ok"] = true,
                ["action"] = "history",
                ["path"] = DiagnosticHistoryBridge.FilePath,
                ["count"] = 0,
                ["events"] = Array.Empty<object>(),
                ["historyReadFailed"] = true,
                ["historyWriteError"] = ex.Message,
                ["paperVerified"] = _paperVerified
            }, HistoryJsonOptions);
        }
    }

    private string MatrixJson()
    {
        var probe = _lastProbe ?? JsonToProbe(Probe(_selectedPrinter));
        DiagJob? direct = null;
        DiagJob? web = null;
        lock (_gate)
        {
            direct = _jobs.Values.Where(j => j.Path == "direct").OrderByDescending(j => j.CreatedUtc).FirstOrDefault();
            web = _jobs.Values.Where(j => j.Path == "webview2").OrderByDescending(j => j.CreatedUtc).FirstOrDefault();
        }
        var physicalCount = probe.Printers.Count(p => p.IsPhysical);
        var directResult = JobLayer(direct);
        var webResult = JobLayer(web);
        var queueState = direct?.QueueState ?? web?.QueueState ?? "";
        var selectedVirtual = PrintHardwareFacts.IsVirtualPrinter(probe.Selected);
        var failure = PrintHardwareFacts.ClassifyFailure(
            probe.WindowsOk,
            probe.SpoolerAvailable,
            physicalCount,
            probe.Printers.Count,
            probe.Resolved,
            selectedVirtual,
            directResult,
            queueState,
            webResult,
            _paperVerified);
        var dict = BuildProbeDict(probe);
        dict["ok"] = true;
        dict["directPrint"] = direct?.ToDict();
        dict["webviewPrint"] = web?.ToDict();
        dict["paperVerified"] = _paperVerified;
        dict["paperNote"] = string.IsNullOrEmpty(_paperNote) ? "PHYSICAL_PRINT_NOT_VERIFIED" : _paperNote;
        dict["failureCode"] = failure;
        dict["neverPrintSuccess"] = true;
        dict["matrix"] = new Dictionary<string, object?>
        {
            ["Windows Printer Enumeration"] = probe.Printers.Count > 0 ? "PASS" : "FAIL",
            ["Windows Default Printer"] = probe.WindowsDefault.Length > 0 ? "PASS" : "FAIL",
            ["Printer Resolution"] = probe.Resolved ? "PASS" : "FAIL",
            ["Driver Detection"] = NotAvailOrPass(probe.Driver),
            ["Port Detection"] = NotAvailOrPass(probe.Port),
            ["Spooler Availability"] = probe.SpoolerAvailable ? "PASS" : "FAIL",
            ["Direct Print Submission"] = LayerPass(directResult),
            ["Print Queue Job"] = QueuePass(queueState),
            ["WebView2 PrintAsync"] = LayerPass(webResult),
            ["Physical Paper"] = _paperVerified ? "PASS" : "FAIL"
        };
        dict["status"] = _paperVerified && directResult == "PRINT_SUBMITTED"
            ? "PHYSICAL PRINT VERIFIED"
            : failure;
        dict["logPath"] = LogPath();
        dict["historyPath"] = DiagnosticHistoryBridge.FilePath;
        dict["historyWriteFailed"] = DiagnosticHistoryBridge.LastWriteFailed;
        dict["historyWriteError"] = DiagnosticHistoryBridge.LastWriteError;
        dict["sessionId"] = direct?.SessionId ?? web?.SessionId;
        return JsonSerializer.Serialize(dict);
    }

    private ProbeSnapshot JsonToProbe(string json)
    {
        _ = json;
        return _lastProbe ?? new ProbeSnapshot();
    }

    private static string LayerPass(string result) =>
        result == "PRINT_SUBMITTED" ? "PASS" : (string.IsNullOrEmpty(result) ? "NOT_RUN" : "FAIL");

    private static string QueuePass(string state) =>
        string.IsNullOrEmpty(state) ? "NOT_RUN" :
        (state is "FAILED" or "DELETED" ? "FAIL" : "PASS");

    private static string NotAvailOrPass(string value) =>
        string.IsNullOrEmpty(value) || value == "NOT_AVAILABLE" ? "NOT_AVAILABLE" : "PASS";

    private static string JobLayer(DiagJob? job)
    {
        if (job is null) return "";
        if (!string.IsNullOrEmpty(job.ErrorCode)) return job.ErrorCode;
        if (job.Submitted) return "PRINT_SUBMITTED";
        return job.Status;
    }

    private Dictionary<string, object?> BuildProbeDict(ProbeSnapshot s)
    {
        var items = s.Printers.Select(p => (object)new Dictionary<string, object?>
        {
            ["name"] = p.Name,
            ["isDefault"] = p.IsDefault,
            ["installed"] = true,
            ["isValid"] = p.IsValid,
            ["isPhysical"] = p.IsPhysical,
            ["class"] = p.IsPhysical ? PrintHardwareFacts.Physical : PrintHardwareFacts.Virtual,
            ["kind"] = p.Kind,
            ["driver"] = p.Driver,
            ["port"] = p.Port,
            ["connectionType"] = p.Connection,
            ["status"] = p.PrinterStatus
        }).ToList();
        return new Dictionary<string, object?>
        {
            ["ok"] = true,
            ["windows"] = s.WindowsOk ? "PASS" : "FAIL",
            ["windowsOk"] = s.WindowsOk,
            ["os"] = s.Os,
            ["appVersion"] = s.AppVersion,
            ["machine"] = s.Machine,
            ["spooler"] = s.SpoolerAvailable ? "SPOOLER_AVAILABLE" : "SPOOLER_UNAVAILABLE",
            ["spoolerAvailable"] = s.SpoolerAvailable,
            ["spoolerDetail"] = s.SpoolerDetail,
            ["windowsDefaultPrinter"] = s.WindowsDefault,
            ["processDefaultPrinter"] = s.ProcessDefault,
            ["defaultMatch"] = s.DefaultMatch,
            ["defaultMismatchCode"] = s.DefaultMatch ? "" : "PRINTER_ENUMERATION_MISMATCH",
            ["printers"] = items,
            ["physicalCount"] = s.Printers.Count(p => p.IsPhysical),
            ["count"] = s.Printers.Count,
            ["selectedPrinter"] = s.Selected,
            ["printerResolution"] = s.Resolved ? "PRINTER_RESOLVED" : "PRINTER_NOT_RESOLVED",
            ["resolveCode"] = s.ResolveCode,
            ["resolveMessage"] = s.ResolveMessage,
            ["driver"] = string.IsNullOrEmpty(s.Driver) ? "NOT_AVAILABLE" : s.Driver,
            ["port"] = string.IsNullOrEmpty(s.Port) ? "NOT_AVAILABLE" : s.Port,
            ["connectionType"] = string.IsNullOrEmpty(s.Connection) ? "NOT_AVAILABLE" : s.Connection,
            ["printerStatus"] = string.IsNullOrEmpty(s.PrinterStatus) ? "NOT_AVAILABLE" : s.PrinterStatus,
            ["logPath"] = LogPath()
        };
    }

    private static string ResolvePhysical(string requested, List<DiagPrinter> listed, out string code, out string msg)
    {
        code = "";
        msg = "";
        var want = (requested ?? "").Trim();
        if (PrintHardwareFacts.IsVirtualPrinter(want))
        {
            code = "PDF_ONLY_PATH";
            msg = "چاپگر انتخاب‌شده فایل/PDF است.";
            return "";
        }
        if (listed.Count == 0)
        {
            code = "HARDWARE_NOT_DETECTED";
            msg = "هیچ چاپگری برای این فرآیند دیده نشد.";
            return "";
        }
        if (!listed.Any(p => p.IsPhysical))
        {
            code = "PDF_ONLY_PATH";
            msg = "فقط چاپگر مجازی/PDF دیده شد.";
            return "";
        }
        if (want.Length == 0)
        {
            var def = listed.FirstOrDefault(p => p.IsDefault && p.IsPhysical && p.IsValid);
            if (!string.IsNullOrEmpty(def.Name)) return def.Name;
            var any = listed.FirstOrDefault(p => p.IsPhysical && p.IsValid);
            if (!string.IsNullOrEmpty(any.Name)) return any.Name;
            code = "PRINTER_NOT_RESOLVED";
            msg = "چاپگر فیزیکی معتبر پیدا نشد.";
            return "";
        }
        var hit = listed.FirstOrDefault(p => string.Equals(p.Name, want, StringComparison.OrdinalIgnoreCase));
        if (string.IsNullOrEmpty(hit.Name))
        {
            code = "PRINTER_NOT_INSTALLED";
            msg = "چاپگر انتخاب‌شده در فهرست ویندوز نیست.";
            return "";
        }
        if (!hit.IsPhysical)
        {
            code = "PDF_ONLY_PATH";
            msg = "چاپگر انتخاب‌شده فیزیکی نیست.";
            return "";
        }
        if (!hit.IsValid)
        {
            code = "PRINTER_NOT_RESOLVED";
            msg = "PrinterSettings.IsValid=false";
            return "";
        }
        return hit.Name;
    }

    private static List<DiagPrinter> ReadPrinters()
    {
        var list = new List<DiagPrinter>();
        var defName = "";
        try { defName = new PrinterSettings().PrinterName ?? ""; } catch { /* none */ }
        foreach (string name in PrinterSettings.InstalledPrinters)
        {
            if (string.IsNullOrWhiteSpace(name)) continue;
            var clean = name.Trim().Trim('\u200e', '\u200f');
            var ps = new PrinterSettings { PrinterName = clean };
            var kind = PrintHardwareFacts.ClassifyKind(clean);
            var info = Native.ReadPrinterInfo(clean);
            list.Add(new DiagPrinter(
                clean,
                defName.Length > 0 && string.Equals(clean, defName, StringComparison.OrdinalIgnoreCase),
                ps.IsValid,
                kind == "physical",
                kind,
                info.Driver,
                info.Port,
                PrintHardwareFacts.ClassifyPort(info.Port),
                info.Status));
        }
        return list;
    }

    private static string ReadWindowsDefaultPrinter()
    {
        try
        {
            if (Native.TryGetDefaultPrinter(out var name) && !string.IsNullOrWhiteSpace(name))
                return name.Trim();
        }
        catch { /* fall back */ }
        try { return new PrinterSettings().PrinterName ?? ""; }
        catch { return ""; }
    }

    private static (bool Available, string Detail) ReadSpooler()
    {
        try
        {
            if (Native.TryQuerySpooler(out var running, out var detail))
                return (running, running ? "SPOOLER_AVAILABLE" : "SPOOLER_UNAVAILABLE:" + detail);
        }
        catch (Exception ex)
        {
            if (Native.CanTalkToSpooler()) return (true, "SPOOLER_AVAILABLE");
            return (false, "SPOOLER_UNAVAILABLE:" + ex.Message);
        }
        if (Native.CanTalkToSpooler()) return (true, "SPOOLER_AVAILABLE");
        return (false, "SPOOLER_UNAVAILABLE");
    }

    private Task EnsureViewAsync()
    {
        lock (_gate)
        {
            if (_view?.CoreWebView2 != null) return Task.CompletedTask;
            _ensureView ??= CreateViewAsync();
            return _ensureView;
        }
    }

    private async Task CreateViewAsync()
    {
        _view = new WebView2 { Width = 794, Height = 1123, Visible = false, TabStop = false };
        _ui.Controls.Add(_view);
        var userData = Path.Combine(AppPaths.AppDataRoot, "WebView2-print-diag");
        Directory.CreateDirectory(userData);
        var env = await CoreWebView2Environment.CreateAsync(userDataFolder: userData);
        await _view.EnsureCoreWebView2Async(env);
        _view.CoreWebView2.Settings.AreDefaultContextMenusEnabled = false;
        _view.CoreWebView2.Settings.AreDevToolsEnabled = false;
    }

    private static string DiagnosticHtml(string printer) =>
        "<!DOCTYPE html><html><head><meta charset=\"utf-8\"><title>" + DocumentName + "</title></head><body style=\"font-family:Tahoma,sans-serif;padding:24px\">"
        + "<h1>SIRMAN</h1><h2>PRINT HARDWARE TEST</h2>"
        + "<p>Timestamp: " + DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss") + "</p>"
        + "<p>Printer: " + System.Net.WebUtility.HtmlEncode(printer) + "</p>"
        + "<p>Machine: " + System.Net.WebUtility.HtmlEncode(Environment.MachineName) + "</p>"
        + "</body></html>";

    private static string DescribeOs()
    {
        try
        {
            return Environment.OSVersion.VersionString + " " + RuntimeInformation.OSDescription;
        }
        catch
        {
            return RuntimeInformation.OSDescription;
        }
    }

    private static string AppVersion()
    {
        try
        {
            var asm = typeof(PrintHardwareDiagnostic).Assembly;
            var info = asm.GetCustomAttributes(typeof(System.Reflection.AssemblyInformationalVersionAttribute), false)
                .OfType<System.Reflection.AssemblyInformationalVersionAttribute>().FirstOrDefault();
            return info?.InformationalVersion ?? asm.GetName().Version?.ToString() ?? "";
        }
        catch { return ""; }
    }

    private static string LogPath() =>
        Path.Combine(AppPaths.AppDataRoot, "print", "PRINT_DIAGNOSTIC.log");

    private static void Log(string phase, string printer, string detail)
    {
        try
        {
            var dir = Path.Combine(AppPaths.AppDataRoot, "print");
            Directory.CreateDirectory(dir);
            var line = string.Join('\t',
                DateTime.Now.ToString("o"),
                Environment.MachineName,
                AppVersion(),
                phase,
                printer ?? "",
                (detail ?? "").Replace('\n', ' ').Replace('\r', ' '));
            File.AppendAllText(LogPath(), line + Environment.NewLine, Encoding.UTF8);
        }
        catch { /* logging must not break diagnostic */ }
    }

    private static string Fail(string code, string message) =>
        JsonSerializer.Serialize(new Dictionary<string, object?>
        {
            ["ok"] = false,
            ["status"] = code,
            ["errorCode"] = code,
            ["message"] = message
        });

    private static string Str(JsonElement root, string name)
    {
        if (!root.TryGetProperty(name, out var el)) return "";
        return el.ValueKind == JsonValueKind.String ? (el.GetString() ?? "") : el.ToString();
    }

    private sealed class ProbeSnapshot
    {
        public bool WindowsOk { get; set; }
        public string Os { get; set; } = "";
        public string AppVersion { get; set; } = "";
        public string Machine { get; set; } = "";
        public bool SpoolerAvailable { get; set; }
        public string SpoolerDetail { get; set; } = "";
        public string WindowsDefault { get; set; } = "";
        public string ProcessDefault { get; set; } = "";
        public bool DefaultMatch { get; set; }
        public List<DiagPrinter> Printers { get; set; } = new();
        public string Selected { get; set; } = "";
        public bool Resolved { get; set; }
        public string ResolveCode { get; set; } = "";
        public string ResolveMessage { get; set; } = "";
        public string Driver { get; set; } = "";
        public string Port { get; set; } = "";
        public string Connection { get; set; } = "";
        public string PrinterStatus { get; set; } = "";
    }

    private sealed class DiagJob
    {
        public string Id { get; init; } = "";
        public string SessionId { get; init; } = "";
        public string Path { get; init; } = "";
        public string Printer { get; init; } = "";
        public DateTime CreatedUtc { get; init; }
        public string Status { get; set; } = "PRINTING";
        public string Message { get; set; } = "";
        public string ErrorCode { get; set; } = "";
        public bool Submitted { get; set; }
        public uint WinJobId { get; set; }
        public string WinJobIdNote { get; set; } = "JOB_ID_NOT_AVAILABLE";
        public string QueueState { get; set; } = "";
        public string QueueDocument { get; set; } = "";
        public bool QueueObserved { get; set; }

        public static DiagJob New(string printer, string path) => new()
        {
            Id = "PD-" + Guid.NewGuid().ToString("N")[..12],
            SessionId = DiagnosticHistoryIds.NewSessionId(),
            Path = path,
            Printer = printer,
            CreatedUtc = DateTime.UtcNow
        };

        public void Set(string status, string message)
        {
            Status = status;
            Message = message;
        }

        public void Fail(string code, string message)
        {
            ErrorCode = code;
            Status = code;
            Message = message;
            Submitted = false;
        }

        public Dictionary<string, object?> ToDict() => new()
        {
            ["ok"] = string.IsNullOrEmpty(ErrorCode),
            ["printJobId"] = Id,
            ["sessionId"] = SessionId,
            ["windowsJobId"] = WinJobId > 0 ? WinJobId.ToString() : "JOB_ID_NOT_AVAILABLE",
            ["jobIdNote"] = WinJobIdNote,
            ["printerName"] = Printer,
            ["documentName"] = DocumentName,
            ["path"] = Path,
            ["status"] = Status,
            ["message"] = Message,
            ["errorCode"] = ErrorCode,
            ["submitted"] = Submitted,
            ["queueState"] = string.IsNullOrEmpty(QueueState) ? "UNKNOWN" : QueueState,
            ["queueDocument"] = QueueDocument,
            ["submissionTime"] = CreatedUtc.ToString("o"),
            ["physicalPrintVerified"] = false
        };

        public string ToJson() => JsonSerializer.Serialize(ToDict());
    }
}

internal readonly record struct DiagPrinter(
    string Name,
    bool IsDefault,
    bool IsValid,
    bool IsPhysical,
    string Kind,
    string Driver,
    string Port,
    string Connection,
    string PrinterStatus);

internal static class Native
{
    [DllImport("winspool.drv", CharSet = CharSet.Unicode, SetLastError = true)]
    private static extern bool OpenPrinter(string pPrinterName, out IntPtr phPrinter, IntPtr pDefault);

    [DllImport("winspool.drv", SetLastError = true)]
    private static extern bool ClosePrinter(IntPtr hPrinter);

    [DllImport("winspool.drv", CharSet = CharSet.Unicode, SetLastError = true)]
    private static extern bool GetDefaultPrinter(StringBuilder pszBuffer, ref int pcchBuffer);

    [DllImport("winspool.drv", CharSet = CharSet.Unicode, SetLastError = true)]
    private static extern bool GetPrinter(IntPtr hPrinter, uint Level, IntPtr pPrinter, uint cbBuf, out uint pcbNeeded);

    [DllImport("winspool.drv", CharSet = CharSet.Unicode, SetLastError = true)]
    private static extern bool EnumJobs(IntPtr hPrinter, uint FirstJob, uint NoJobs, uint Level, IntPtr pJob, uint cbBuf, out uint pcbNeeded, out uint pcReturned);

    [DllImport("advapi32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    private static extern IntPtr OpenSCManager(string? lpMachineName, string? lpDatabaseName, uint dwDesiredAccess);

    [DllImport("advapi32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    private static extern IntPtr OpenService(IntPtr hSCManager, string lpServiceName, uint dwDesiredAccess);

    [DllImport("advapi32.dll", SetLastError = true)]
    private static extern bool QueryServiceStatus(IntPtr hService, out SERVICE_STATUS lpServiceStatus);

    [DllImport("advapi32.dll", SetLastError = true)]
    private static extern bool CloseServiceHandle(IntPtr hSCObject);

    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    private struct PRINTER_INFO_2
    {
        public IntPtr pServerName;
        public IntPtr pPrinterName;
        public IntPtr pShareName;
        public IntPtr pPortName;
        public IntPtr pDriverName;
        public IntPtr pComment;
        public IntPtr pLocation;
        public IntPtr pDevMode;
        public IntPtr pSepFile;
        public IntPtr pPrintProcessor;
        public IntPtr pDatatype;
        public IntPtr pParameters;
        public IntPtr pSecurityDescriptor;
        public uint Attributes;
        public uint Priority;
        public uint DefaultPriority;
        public uint StartTime;
        public uint UntilTime;
        public uint Status;
        public uint cJobs;
        public uint AveragePPM;
    }

    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    private struct JOB_INFO_1
    {
        public uint JobId;
        public IntPtr pPrinterName;
        public IntPtr pMachineName;
        public IntPtr pUserName;
        public IntPtr pDocument;
        public IntPtr pDatatype;
        public IntPtr pStatus;
        public uint Status;
        public uint Priority;
        public uint Position;
        public uint TotalPages;
        public uint PagesPrinted;
        public SYSTEMTIME Submitted;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct SERVICE_STATUS
    {
        public uint dwServiceType;
        public uint dwCurrentState;
        public uint dwControlsAccepted;
        public uint dwWin32ExitCode;
        public uint dwServiceSpecificExitCode;
        public uint dwCheckPoint;
        public uint dwWaitHint;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct SYSTEMTIME
    {
        public ushort wYear, wMonth, wDayOfWeek, wDay, wHour, wMinute, wSecond, wMilliseconds;
    }

    public static bool TryOpenPrinter(string printerName, out string error)
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

    public static bool CanTalkToSpooler()
    {
        try
        {
            _ = PrinterSettings.InstalledPrinters.Count;
            return true;
        }
        catch { return false; }
    }

    public static bool TryGetDefaultPrinter(out string name)
    {
        name = "";
        var size = 256;
        var sb = new StringBuilder(size);
        if (!GetDefaultPrinter(sb, ref size))
        {
            if (Marshal.GetLastWin32Error() != 122) return false;
            sb = new StringBuilder(size);
            if (!GetDefaultPrinter(sb, ref size)) return false;
        }
        name = sb.ToString();
        return name.Length > 0;
    }

    public static (string Driver, string Port, string Status) ReadPrinterInfo(string printerName)
    {
        IntPtr handle = IntPtr.Zero;
        IntPtr buf = IntPtr.Zero;
        try
        {
            if (!OpenPrinter(printerName, out handle, IntPtr.Zero))
                return ("NOT_AVAILABLE", "NOT_AVAILABLE", "NOT_AVAILABLE");
            GetPrinter(handle, 2, IntPtr.Zero, 0, out var needed);
            if (needed == 0) return ("NOT_AVAILABLE", "NOT_AVAILABLE", "NOT_AVAILABLE");
            buf = Marshal.AllocHGlobal((int)needed);
            if (!GetPrinter(handle, 2, buf, needed, out _))
                return ("NOT_AVAILABLE", "NOT_AVAILABLE", "NOT_AVAILABLE");
            var info = Marshal.PtrToStructure<PRINTER_INFO_2>(buf);
            var driver = PtrText(info.pDriverName);
            var port = PtrText(info.pPortName);
            var status = PrinterStatusText(info.Status);
            return (driver, port, status);
        }
        catch
        {
            return ("NOT_AVAILABLE", "NOT_AVAILABLE", "NOT_AVAILABLE");
        }
        finally
        {
            if (buf != IntPtr.Zero) Marshal.FreeHGlobal(buf);
            if (handle != IntPtr.Zero) ClosePrinter(handle);
        }
    }

    public readonly record struct SpoolJob(uint JobId, string Document, uint Status, string StatusText);

    public static List<SpoolJob> EnumJobs(string printerName)
    {
        var result = new List<SpoolJob>();
        IntPtr handle = IntPtr.Zero;
        IntPtr buf = IntPtr.Zero;
        try
        {
            if (!OpenPrinter(printerName, out handle, IntPtr.Zero)) return result;
            EnumJobs(handle, 0, 32, 1, IntPtr.Zero, 0, out var needed, out _);
            if (needed == 0) return result;
            buf = Marshal.AllocHGlobal((int)needed);
            if (!EnumJobs(handle, 0, 32, 1, buf, needed, out _, out var returned) || returned == 0)
                return result;
            var stride = Marshal.SizeOf<JOB_INFO_1>();
            for (var i = 0; i < returned; i++)
            {
                var ptr = IntPtr.Add(buf, i * stride);
                var job = Marshal.PtrToStructure<JOB_INFO_1>(ptr);
                result.Add(new SpoolJob(job.JobId, PtrText(job.pDocument), job.Status, PtrText(job.pStatus)));
            }
        }
        catch { /* queue read is best-effort */ }
        finally
        {
            if (buf != IntPtr.Zero) Marshal.FreeHGlobal(buf);
            if (handle != IntPtr.Zero) ClosePrinter(handle);
        }
        return result;
    }

    public static bool TryQuerySpooler(out bool running, out string detail)
    {
        running = false;
        detail = "";
        const uint SC_MANAGER_CONNECT = 0x0001;
        const uint SERVICE_QUERY_STATUS = 0x0004;
        const uint SERVICE_RUNNING = 0x00000004;
        var scm = OpenSCManager(null, null, SC_MANAGER_CONNECT);
        if (scm == IntPtr.Zero)
        {
            detail = "OpenSCManager " + Marshal.GetLastWin32Error();
            return false;
        }
        var svc = OpenService(scm, "Spooler", SERVICE_QUERY_STATUS);
        if (svc == IntPtr.Zero)
        {
            detail = "OpenService " + Marshal.GetLastWin32Error();
            CloseServiceHandle(scm);
            return false;
        }
        if (!QueryServiceStatus(svc, out var st))
        {
            detail = "QueryServiceStatus " + Marshal.GetLastWin32Error();
            CloseServiceHandle(svc);
            CloseServiceHandle(scm);
            return false;
        }
        running = st.dwCurrentState == SERVICE_RUNNING;
        detail = "state=" + st.dwCurrentState;
        CloseServiceHandle(svc);
        CloseServiceHandle(scm);
        return true;
    }

    private static string PtrText(IntPtr p)
    {
        if (p == IntPtr.Zero) return "NOT_AVAILABLE";
        var s = Marshal.PtrToStringUni(p);
        return string.IsNullOrWhiteSpace(s) ? "NOT_AVAILABLE" : s;
    }

    private static string PrinterStatusText(uint status)
    {
        if (status == 0) return "Ready";
        var parts = new List<string>();
        if ((status & 0x00000001) != 0) parts.Add("Paused");
        if ((status & 0x00000002) != 0) parts.Add("Error");
        if ((status & 0x00000004) != 0) parts.Add("Pending deletion");
        if ((status & 0x00000008) != 0) parts.Add("Paper jam");
        if ((status & 0x00000010) != 0) parts.Add("Paper out");
        if ((status & 0x00000080) != 0) parts.Add("Offline");
        return parts.Count == 0 ? "NOT_AVAILABLE" : string.Join(", ", parts);
    }
}
