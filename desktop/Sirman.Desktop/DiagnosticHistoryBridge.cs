using System.Globalization;
using System.Reflection;
using Sirman.Core.Printing;

namespace Sirman.Desktop;

/// <summary>
/// Runtime fields copied from P0.5R4/P0.5R6 probe measurements. Probe still owns measurement.
/// </summary>
internal sealed class NativePrintRuntimeSnapshot
{
    public bool HasDocument { get; set; }
    public bool HasPage { get; set; }
    public bool HasLogo { get; set; }
    public string? Profile { get; set; }
    public string? RequestedPaper { get; set; }
    public string? RequestedOrientation { get; set; }
    public bool? RequestedLandscape { get; set; }
    public string? ResolvedPaper { get; set; }
    public string? ResolvedWidthMm { get; set; }
    public string? ResolvedHeightMm { get; set; }
    public bool? ResolvedLandscape { get; set; }
    public string? ResolvedMarginMm { get; set; }
    public int? Copies { get; set; }
    public string? PaperKind { get; set; }
    public string? PaperRawKind { get; set; }
    public string? PaperWidth { get; set; }
    public string? PaperHeight { get; set; }
    public string? PageBounds { get; set; }
    public string? MarginBounds { get; set; }
    public string? GraphicsPageUnit { get; set; }
    public string? GraphicsPageScale { get; set; }
    public string? GraphicsTransform { get; set; }
    public string? VisibleClipBounds { get; set; }
    public string? ClipBounds { get; set; }
    public string? DpiX { get; set; }
    public string? DpiY { get; set; }
    public string? LogoSourceKind { get; set; }
    public bool? LogoResolved { get; set; }
    public bool? LogoLoadSuccess { get; set; }
    public string? LogoFailureReason { get; set; }
}

/// <summary>
/// پل Desktop → JSONL تشخیص. شکست نوشتن چاپ را متوقف نمی‌کند.
/// </summary>
internal static class DiagnosticHistoryBridge
{
    public static string FilePath =>
        DiagnosticHistoryStore.DefaultFilePath(AppPaths.AppDataRoot);

    public static string? LastWriteError { get; private set; }

    public static bool LastWriteFailed => !string.IsNullOrEmpty(LastWriteError);

    public static DiagnosticHistoryStore CreateStore() => new(FilePath);

    public static bool TryAppend(DiagnosticHistoryEvent evt, out string? error)
    {
        try
        {
            Stamp(evt);
            var ok = CreateStore().TryAppend(evt, out error);
            LastWriteError = ok ? null : error;
            return ok;
        }
        catch (Exception ex)
        {
            error = ex.Message;
            LastWriteError = ex.Message;
            return false;
        }
    }

    public static bool TryAppendVerification(string sessionId, bool came, string? notes, out string? error)
    {
        if (string.IsNullOrWhiteSpace(sessionId))
        {
            error = "sessionId is required";
            LastWriteError = error;
            return false;
        }
        try
        {
            var evt = new DiagnosticHistoryEvent
            {
                EventId = DiagnosticHistoryIds.NewEventId(),
                SessionId = (sessionId ?? "").Trim(),
                EventType = came
                    ? DiagnosticHistoryEventTypes.PhysicalVerified
                    : DiagnosticHistoryEventTypes.PhysicalFailed,
                PhysicalVerification = came
                    ? DiagnosticHistoryStates.PhysicalVerified
                    : DiagnosticHistoryStates.PhysicalFailed,
                Notes = notes
            };
            Stamp(evt);
            var ok = CreateStore().TryAppend(evt, out error);
            LastWriteError = ok ? null : error;
            return ok;
        }
        catch (Exception ex)
        {
            error = ex.Message;
            LastWriteError = ex.Message;
            return false;
        }
    }

    public static DiagnosticHistoryEvent NativeSubmitted(
        string sessionId,
        PrintJobState job,
        NativePrintRequest request,
        ResolvedPaperSpec resolved,
        NativePrintRuntimeSnapshot? snap,
        string? queueJobId)
    {
        var evt = new DiagnosticHistoryEvent
        {
            EventId = DiagnosticHistoryIds.NewEventId(),
            SessionId = sessionId,
            EventType = DiagnosticHistoryEventTypes.Submitted,
            TestType = request.Kind == NativePrintRequest.KindPostalLabel ? "postal-label" : "test-page",
            DocumentKind = request.Kind,
            Engine = string.IsNullOrWhiteSpace(request.Engine) ? NativePrintRequest.EngineNative : request.Engine,
            PrinterName = string.IsNullOrWhiteSpace(job.Printer) ? null : job.Printer,
            PrintJobId = string.IsNullOrWhiteSpace(job.PrintJobId) ? null : job.PrintJobId,
            RequestedPaper = NullIfEmpty(request.Paper),
            RequestedOrientation = NullIfEmpty(request.Orientation),
            ResolvedPaper = NullIfEmpty(resolved.Name),
            ResolvedWidthMm = resolved.WidthMm.ToString("0.###", CultureInfo.InvariantCulture),
            ResolvedHeightMm = resolved.HeightMm.ToString("0.###", CultureInfo.InvariantCulture),
            ResolvedLandscape = resolved.Landscape,
            ResolvedMarginMm = resolved.MarginMm.ToString("0.###", CultureInfo.InvariantCulture),
            Copies = resolved.Copies,
            SubmissionStatus = "PRINT_SUBMITTED",
            PhysicalVerification = DiagnosticHistoryStates.NotRun,
            QueueJobId = NullIfEmpty(queueJobId)
        };
        ApplySnapshot(evt, snap);
        return evt;
    }

    public static DiagnosticHistoryEvent HardwareSubmitted(string sessionId, string printer, string engine, string path, string? printJobId, string? queueJobId, string? errorCode, string? errorDetail)
    {
        var submitted = string.IsNullOrEmpty(errorCode);
        return new DiagnosticHistoryEvent
        {
            EventId = DiagnosticHistoryIds.NewEventId(),
            SessionId = sessionId,
            EventType = submitted ? DiagnosticHistoryEventTypes.Submitted : DiagnosticHistoryEventTypes.Error,
            TestType = "hardware-diagnostic",
            DocumentKind = NativePrintRequest.KindTestPage,
            Engine = engine,
            PrinterName = NullIfEmpty(printer),
            PrintJobId = NullIfEmpty(printJobId),
            Profile = path,
            SubmissionStatus = submitted ? "PRINT_SUBMITTED" : null,
            PhysicalVerification = submitted ? DiagnosticHistoryStates.NotRun : null,
            QueueJobId = NullIfEmpty(queueJobId),
            ErrorCode = NullIfEmpty(errorCode),
            ErrorDetail = NullIfEmpty(errorDetail)
        };
    }

    public static void ApplySnapshot(DiagnosticHistoryEvent evt, NativePrintRuntimeSnapshot? snap)
    {
        if (snap is null) return;
        if (snap.HasDocument)
        {
            evt.Profile = snap.Profile ?? evt.Profile;
            evt.RequestedPaper = snap.RequestedPaper ?? evt.RequestedPaper;
            evt.RequestedOrientation = snap.RequestedOrientation ?? evt.RequestedOrientation;
            evt.RequestedLandscape = snap.RequestedLandscape ?? evt.RequestedLandscape;
            evt.ResolvedPaper = snap.ResolvedPaper ?? evt.ResolvedPaper;
            evt.ResolvedWidthMm = snap.ResolvedWidthMm ?? evt.ResolvedWidthMm;
            evt.ResolvedHeightMm = snap.ResolvedHeightMm ?? evt.ResolvedHeightMm;
            evt.ResolvedLandscape = snap.ResolvedLandscape ?? evt.ResolvedLandscape;
            evt.ResolvedMarginMm = snap.ResolvedMarginMm ?? evt.ResolvedMarginMm;
            evt.Copies = snap.Copies ?? evt.Copies;
            evt.PaperKind = snap.PaperKind;
            evt.PaperRawKind = snap.PaperRawKind;
            evt.PaperWidth = snap.PaperWidth;
            evt.PaperHeight = snap.PaperHeight;
        }
        if (snap.HasPage)
        {
            evt.PageBounds = snap.PageBounds;
            evt.MarginBounds = snap.MarginBounds;
            evt.GraphicsPageUnit = snap.GraphicsPageUnit;
            evt.GraphicsPageScale = snap.GraphicsPageScale;
            evt.GraphicsTransform = snap.GraphicsTransform;
            evt.VisibleClipBounds = snap.VisibleClipBounds;
            evt.ClipBounds = snap.ClipBounds;
            evt.DpiX = snap.DpiX;
            evt.DpiY = snap.DpiY;
            evt.PaperKind = snap.PaperKind ?? evt.PaperKind;
            evt.PaperRawKind = snap.PaperRawKind ?? evt.PaperRawKind;
            evt.PaperWidth = snap.PaperWidth ?? evt.PaperWidth;
            evt.PaperHeight = snap.PaperHeight ?? evt.PaperHeight;
        }
        if (snap.HasLogo)
        {
            evt.LogoSourceKind = snap.LogoSourceKind;
            evt.LogoResolved = snap.LogoResolved;
            evt.LogoLoadSuccess = snap.LogoLoadSuccess;
            evt.LogoFailureReason = snap.LogoFailureReason;
        }
    }

    public static void Stamp(DiagnosticHistoryEvent evt)
    {
        try
        {
            var asm = typeof(DiagnosticHistoryBridge).Assembly;
            if (string.IsNullOrWhiteSpace(evt.AssemblyVersion))
                evt.AssemblyVersion = asm.GetName().Version?.ToString();
            if (string.IsNullOrWhiteSpace(evt.AppVersion))
            {
                var info = asm.GetCustomAttributes(typeof(AssemblyInformationalVersionAttribute), false)
                    .OfType<AssemblyInformationalVersionAttribute>().FirstOrDefault();
                evt.AppVersion = info?.InformationalVersion ?? evt.AssemblyVersion;
            }
            if (string.IsNullOrWhiteSpace(evt.BuildCommit) && !string.IsNullOrWhiteSpace(evt.AppVersion))
            {
                var plus = evt.AppVersion.IndexOf('+');
                if (plus >= 0 && plus < evt.AppVersion.Length - 1)
                    evt.BuildCommit = evt.AppVersion[(plus + 1)..];
            }
        }
        catch
        {
            /* leave version fields null if unavailable */
        }
    }

    private static string? NullIfEmpty(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value;
}
