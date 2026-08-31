using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace Sirman.Core.Printing;

/// <summary>
/// شناسه جلسه تشخیص — جدا از <see cref="PrintJobIdentity"/> (PJ-).
/// </summary>
public static class DiagnosticHistoryIds
{
    public const string SessionPrefix = "D-";

    public static string NewSessionId() => SessionPrefix + Guid.NewGuid().ToString("N");

    public static string NewEventId() => Guid.NewGuid().ToString("N");

    public static bool IsWellFormedSessionId(string? sessionId)
    {
        if (string.IsNullOrWhiteSpace(sessionId)) return false;
        if (!sessionId.StartsWith(SessionPrefix, StringComparison.Ordinal)) return false;
        var hex = sessionId[SessionPrefix.Length..];
        if (hex.Length != 32) return false;
        foreach (var c in hex)
        {
            var ok = (c >= '0' && c <= '9') || (c >= 'a' && c <= 'f') || (c >= 'A' && c <= 'F');
            if (!ok) return false;
        }
        return true;
    }
}

/// <summary>نوع رویداد JSONL — رکورد قبلی بازنویسی نمی‌شود.</summary>
public static class DiagnosticHistoryEventTypes
{
    public const string Submitted = "SUBMITTED";
    public const string PhysicalVerified = "PHYSICAL_VERIFIED";
    public const string PhysicalFailed = "PHYSICAL_FAILED";
    public const string Error = "ERROR";
}

/// <summary>وضعیت‌های تشخیص. PRINT_SUBMITTED هرگز به‌تنهایی PHYSICAL_VERIFIED نیست.</summary>
public static class DiagnosticHistoryStates
{
    public const string NotRun = "NOT_RUN";
    public const string Submitted = "SUBMITTED";
    public const string QueueAccepted = "QUEUE_ACCEPTED";
    public const string PhysicalVerified = "PHYSICAL_VERIFIED";
    public const string PhysicalFailed = "PHYSICAL_FAILED";
    public const string VisualVerified = "VISUAL_VERIFIED";
    public const string VisualFailed = "VISUAL_FAILED";
    public const string Error = "ERROR";
    public const string Unknown = "UNKNOWN";
}

/// <summary>
/// یک رویداد تشخیصی غیرقابل‌تغییر. فیلد خالی/نامعلوم null می‌ماند.
/// مسیر کسب‌وکار (فاکتور/نام/آدرس) اینجا ذخیره نمی‌شود.
/// </summary>
public sealed class DiagnosticHistoryEvent
{
    public string EventId { get; set; } = "";
    public string SessionId { get; set; } = "";
    public string EventType { get; set; } = "";
    public string TimestampUtc { get; set; } = "";
    public string TimestampLocal { get; set; } = "";
    public string? AppVersion { get; set; }
    public string? AssemblyVersion { get; set; }
    public string? BuildCommit { get; set; }
    public string? TestType { get; set; }
    public string? DocumentKind { get; set; }
    public string? Engine { get; set; }
    public string? PrinterName { get; set; }
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
    public string? SubmissionStatus { get; set; }
    public string? QueueJobId { get; set; }
    public string? PhysicalVerification { get; set; }
    public string? VisualVerification { get; set; }
    public string? ErrorCode { get; set; }
    public string? ErrorDetail { get; set; }
    public string? LogoSourceKind { get; set; }
    public bool? LogoResolved { get; set; }
    public bool? LogoLoadSuccess { get; set; }
    public string? LogoFailureReason { get; set; }
    public string? PrintJobId { get; set; }
    public string? Notes { get; set; }
}

/// <summary>
/// ذخیره append-only تاریخچه تشخیص: JSONL جدا از sqlite و کلیدهای کسب‌وکار.
/// مسیر پیش‌فرض: {appDataRoot}/diagnostics/history.jsonl
/// </summary>
public sealed class DiagnosticHistoryStore
{
    public const string RelativeDirectory = "diagnostics";
    public const string FileName = "history.jsonl";
    public const string CorruptCopySuffix = ".corrupt-preserved";

    private static readonly JsonSerializerOptions Options = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        PropertyNameCaseInsensitive = true,
        DefaultIgnoreCondition = JsonIgnoreCondition.Never,
        WriteIndented = false
    };

    private readonly string _path;
    private readonly TimeProvider _time;
    private readonly object _gate = new();
    private bool _corruptPreserved;

    public DiagnosticHistoryStore(string filePath, TimeProvider? time = null)
    {
        _path = filePath ?? throw new ArgumentNullException(nameof(filePath));
        _time = time ?? TimeProvider.System;
    }

    public string FilePath => _path;

    public static string DefaultFilePath(string? appDataRoot)
    {
        var root = string.IsNullOrWhiteSpace(appDataRoot) ? "" : appDataRoot.Trim();
        return Path.Combine(root, RelativeDirectory, FileName);
    }

    public void Append(DiagnosticHistoryEvent evt)
    {
        if (evt is null) throw new ArgumentNullException(nameof(evt));
        Stamp(evt);
        if (string.IsNullOrWhiteSpace(evt.SessionId))
            evt.SessionId = DiagnosticHistoryIds.NewSessionId();
        if (string.IsNullOrWhiteSpace(evt.EventId))
            evt.EventId = DiagnosticHistoryIds.NewEventId();
        if (string.IsNullOrWhiteSpace(evt.EventType))
            evt.EventType = DiagnosticHistoryEventTypes.Submitted;

        var json = JsonSerializer.Serialize(evt, Options);
        lock (_gate)
        {
            var dir = Path.GetDirectoryName(_path);
            if (!string.IsNullOrEmpty(dir))
                Directory.CreateDirectory(dir);
            File.AppendAllText(_path, json + "\n", Encoding.UTF8);
        }
    }

    public bool TryAppend(DiagnosticHistoryEvent evt, out string? error)
    {
        try
        {
            Append(evt);
            error = null;
            return true;
        }
        catch (Exception ex)
        {
            error = ex.Message;
            return false;
        }
    }

    public DiagnosticHistoryEvent AppendVerification(string sessionId, bool came, string? notes = null)
    {
        if (string.IsNullOrWhiteSpace(sessionId))
            throw new ArgumentException("sessionId is required", nameof(sessionId));
        var evt = new DiagnosticHistoryEvent
        {
            EventId = DiagnosticHistoryIds.NewEventId(),
            SessionId = sessionId.Trim(),
            EventType = came
                ? DiagnosticHistoryEventTypes.PhysicalVerified
                : DiagnosticHistoryEventTypes.PhysicalFailed,
            PhysicalVerification = came
                ? DiagnosticHistoryStates.PhysicalVerified
                : DiagnosticHistoryStates.PhysicalFailed,
            Notes = notes
        };
        Append(evt);
        return evt;
    }

    public bool TryAppendVerification(string sessionId, bool came, string? notes, out DiagnosticHistoryEvent? evt, out string? error)
    {
        try
        {
            evt = AppendVerification(sessionId, came, notes);
            error = null;
            return true;
        }
        catch (Exception ex)
        {
            evt = null;
            error = ex.Message;
            return false;
        }
    }

    public IReadOnlyList<DiagnosticHistoryEvent> ReadChronological()
    {
        string[] lines;
        lock (_gate)
        {
            if (!File.Exists(_path))
                return Array.Empty<DiagnosticHistoryEvent>();
            try
            {
                lines = File.ReadAllLines(_path, Encoding.UTF8);
            }
            catch
            {
                PreserveCorruptCopy();
                return Array.Empty<DiagnosticHistoryEvent>();
            }
        }

        var list = new List<DiagnosticHistoryEvent>();
        foreach (var line in lines)
        {
            if (string.IsNullOrWhiteSpace(line)) continue;
            try
            {
                var evt = JsonSerializer.Deserialize<DiagnosticHistoryEvent>(line, Options);
                if (evt is null || string.IsNullOrWhiteSpace(evt.SessionId))
                {
                    PreserveCorruptCopy();
                    continue;
                }
                list.Add(evt);
            }
            catch
            {
                PreserveCorruptCopy();
            }
        }
        return list;
    }

    public IReadOnlyList<DiagnosticHistoryEvent> ReadAllNewestFirst()
    {
        var list = ReadChronological().ToList();
        list.Reverse();
        return list;
    }

    private void Stamp(DiagnosticHistoryEvent evt)
    {
        if (!string.IsNullOrWhiteSpace(evt.TimestampUtc) && !string.IsNullOrWhiteSpace(evt.TimestampLocal))
            return;
        var now = _time.GetUtcNow();
        if (string.IsNullOrWhiteSpace(evt.TimestampUtc))
            evt.TimestampUtc = now.UtcDateTime.ToString("o");
        if (string.IsNullOrWhiteSpace(evt.TimestampLocal))
            evt.TimestampLocal = now.ToLocalTime().ToString("o");
    }

    private void PreserveCorruptCopy()
    {
        if (_corruptPreserved) return;
        _corruptPreserved = true;
        try
        {
            if (!File.Exists(_path)) return;
            var dest = _path + CorruptCopySuffix;
            if (!File.Exists(dest))
                File.Copy(_path, dest);
        }
        catch
        {
            /* preserve is best-effort; never rewrite the original */
        }
    }
}
