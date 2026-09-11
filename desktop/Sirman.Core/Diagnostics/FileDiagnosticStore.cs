using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace Sirman.Core.Diagnostics;

public static class DiagnosticJson
{
    public static readonly JsonSerializerOptions Options = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        PropertyNameCaseInsensitive = true,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
        WriteIndented = false,
        Converters = { new JsonStringEnumConverter(JsonNamingPolicy.CamelCase) }
    };

    public static readonly JsonSerializerOptions Pretty = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        PropertyNameCaseInsensitive = true,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
        WriteIndented = true,
        Converters = { new JsonStringEnumConverter(JsonNamingPolicy.CamelCase) }
    };
}

/// <summary>
/// Append-only UTF-8 JSONL store at <c>{appDataRoot}/diagnostics/events.jsonl</c>.
/// Does not write print <c>history.jsonl</c>.
/// </summary>
public sealed class FileDiagnosticStore : IDiagnosticStore
{
    public const string RelativeDirectory = "diagnostics";
    public const string FileName = "events.jsonl";
    public const string PrintHistoryFileName = "history.jsonl";
    public const string CorruptCopySuffix = ".corrupt-preserved";
    public const long RotateBytes = 8L * 1024 * 1024;
    public const int RotateMaxLines = 20_000;
    public const int RotatedCopies = 3;

    static readonly Encoding Utf8NoBom = new UTF8Encoding(encoderShouldEmitUTF8Identifier: false);

    readonly string _path;
    readonly TimeProvider _time;
    readonly long _rotateBytes;
    readonly int _rotateMaxLines;
    readonly object _gate = new();
    bool _corruptPreserved;
    int _lineCount = -1;

    public FileDiagnosticStore(string appDataRoot, TimeProvider? time = null, long? rotateBytes = null, int? rotateMaxLines = null)
    {
        if (string.IsNullOrWhiteSpace(appDataRoot))
            throw new ArgumentException("appDataRoot is required", nameof(appDataRoot));
        _path = Path.Combine(appDataRoot.Trim(), RelativeDirectory, FileName);
        _time = time ?? TimeProvider.System;
        _rotateBytes = rotateBytes is > 0 ? rotateBytes.Value : RotateBytes;
        _rotateMaxLines = rotateMaxLines is > 0 ? rotateMaxLines.Value : RotateMaxLines;
    }

    public string FilePath => _path;
    public string DirectoryPath => Path.GetDirectoryName(_path) ?? "";

    public static string DefaultFilePath(string appDataRoot) =>
        Path.Combine(appDataRoot, RelativeDirectory, FileName);

    public bool TryAppend(DiagnosticEvent evt, out string? error)
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

    public void Append(DiagnosticEvent evt)
    {
        ArgumentNullException.ThrowIfNull(evt);
        Stamp(evt);
        if (SafeMetadataPolicy.ContainsForbiddenPayload(evt.TechnicalMessage)
            || SafeMetadataPolicy.ContainsForbiddenPayload(evt.ExceptionType)
            || evt.Metadata.Values.Any(SafeMetadataPolicy.ContainsForbiddenPayload))
            throw new InvalidOperationException("diagnostic payload rejected: forbidden business/secret keys");
        var json = JsonSerializer.Serialize(evt, DiagnosticJson.Options);
        if (SafeMetadataPolicy.ContainsForbiddenPayload(json))
            throw new InvalidOperationException("diagnostic payload rejected: forbidden business/secret keys");
        lock (_gate)
        {
            var dir = Path.GetDirectoryName(_path);
            if (!string.IsNullOrEmpty(dir))
                Directory.CreateDirectory(dir);
            EnsureLineCountUnlocked();
            File.AppendAllText(_path, json + "\n", Utf8NoBom);
            _lineCount++;
            RotateIfNeededUnlocked();
        }
    }

    public Task AppendAsync(DiagnosticEvent evt, CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();
        Append(evt);
        return Task.CompletedTask;
    }

    public Task<IReadOnlyList<DiagnosticEvent>> QueryRecentAsync(DiagnosticQuery query, CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();
        query ??= new DiagnosticQuery();
        var all = ReadNewestFirst();
        IEnumerable<DiagnosticEvent> q = all;
        if (!string.IsNullOrWhiteSpace(query.CorrelationId))
            q = q.Where(e => string.Equals(e.CorrelationId, query.CorrelationId, StringComparison.Ordinal));
        if (query.Module is { } mod)
            q = q.Where(e => e.Module == mod);
        if (query.MinSeverity is { } sev)
            q = q.Where(e => SeverityRank(e.Severity) >= SeverityRank(sev) || e.Severity == DiagnosticSeverity.Audit);
        if (!string.IsNullOrWhiteSpace(query.CodeContains))
            q = q.Where(e => (e.Code ?? "").IndexOf(query.CodeContains, StringComparison.OrdinalIgnoreCase) >= 0);
        if (query.FromUtc is { } from)
            q = q.Where(e => DateTimeOffset.TryParse(e.TimestampUtc, out var t) && t >= from);
        if (query.ToUtc is { } to)
            q = q.Where(e => DateTimeOffset.TryParse(e.TimestampUtc, out var t) && t <= to);
        var limit = query.Limit <= 0 ? 100 : Math.Min(query.Limit, 500);
        var offset = Math.Max(0, query.Offset);
        var list = q.Skip(offset).Take(limit).ToList();
        return Task.FromResult<IReadOnlyList<DiagnosticEvent>>(list);
    }

    public Task<IReadOnlyList<DiagnosticEvent>> GetByCorrelationIdAsync(string correlationId, CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();
        var id = (correlationId ?? "").Trim();
        if (id.Length == 0)
            return Task.FromResult<IReadOnlyList<DiagnosticEvent>>(Array.Empty<DiagnosticEvent>());
        var chrono = ReadChronological().Where(e => string.Equals(e.CorrelationId, id, StringComparison.Ordinal)).ToList();
        return Task.FromResult<IReadOnlyList<DiagnosticEvent>>(chrono);
    }

    public async Task<DiagnosticExportResult> ExportIncidentAsync(string correlationId, string destinationDirectory, CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();
        var id = (correlationId ?? "").Trim();
        if (id.Length == 0)
            return new DiagnosticExportResult { Ok = false, Error = "correlation", Message = "شناسه پیگیری خالی است" };
        var events = await GetByCorrelationIdAsync(id, cancellationToken).ConfigureAwait(false);
        if (events.Count == 0)
            return new DiagnosticExportResult { Ok = false, CorrelationId = id, Error = "not-found", Message = "حادثه‌ای با این شناسه نیست" };
        var incident = IncidentProjector.FromEvents(events);
        var result = GuidanceEngine.ToResult(incident, events);
        Directory.CreateDirectory(destinationDirectory);
        var safeId = string.Join("_", id.Split(Path.GetInvalidFileNameChars(), StringSplitOptions.RemoveEmptyEntries));
        var fileName = "SIRMAN-" + safeId + ".json";
        var path = Path.Combine(destinationDirectory, fileName);
        var pack = new
        {
            kind = "SIRMAN_DIAGNOSTIC_PACK",
            format = 1,
            correlationId = id,
            exportedAtUtc = _time.GetUtcNow().UtcDateTime.ToString("o"),
            incident,
            result,
            events
        };
        var json = JsonSerializer.Serialize(pack, DiagnosticJson.Pretty);
        if (SafeMetadataPolicy.ContainsForbiddenPayload(json))
            return new DiagnosticExportResult { Ok = false, CorrelationId = id, Error = "forbidden", Message = "بسته شامل داده ممنوع بود و نوشته نشد" };
        await File.WriteAllTextAsync(path, json, Utf8NoBom, cancellationToken).ConfigureAwait(false);
        return new DiagnosticExportResult
        {
            Ok = true,
            FileName = fileName,
            Bytes = Encoding.UTF8.GetByteCount(json),
            CorrelationId = id
        };
    }

    public IReadOnlyList<DiagnosticEvent> ReadChronological()
    {
        var files = EnumerateLogFilesOldestFirst();
        var list = new List<DiagnosticEvent>();
        foreach (var file in files)
            list.AddRange(ReadFile(file));
        return list;
    }

    public IReadOnlyList<DiagnosticEvent> ReadNewestFirst()
    {
        var list = ReadChronological().ToList();
        list.Reverse();
        return list;
    }

    void Stamp(DiagnosticEvent evt)
    {
        if (string.IsNullOrWhiteSpace(evt.EventId))
            evt.EventId = Guid.NewGuid().ToString("N");
        if (string.IsNullOrWhiteSpace(evt.CorrelationId))
            evt.CorrelationId = CorrelationId.New().Value;
        evt.Metadata = SafeMetadataPolicy.Sanitize(evt.Metadata);
        var now = _time.GetUtcNow();
        if (string.IsNullOrWhiteSpace(evt.TimestampUtc))
            evt.TimestampUtc = now.UtcDateTime.ToString("o");
        if (string.IsNullOrWhiteSpace(evt.TimestampLocal))
            evt.TimestampLocal = now.ToLocalTime().ToString("o");
    }

    IEnumerable<string> EnumerateLogFilesOldestFirst()
    {
        var files = new List<(int rank, string path)>();
        for (var i = RotatedCopies; i >= 1; i--)
        {
            var p = _path + "." + i;
            if (File.Exists(p)) files.Add((i, p));
        }
        if (File.Exists(_path)) files.Add((0, _path));
        return files.OrderByDescending(x => x.rank).Select(x => x.path);
    }

    List<DiagnosticEvent> ReadFile(string path)
    {
        string[] lines;
        lock (_gate)
        {
            try { lines = File.ReadAllLines(path, Utf8NoBom); }
            catch
            {
                PreserveCorruptCopy(path);
                return new List<DiagnosticEvent>();
            }
        }
        var list = new List<DiagnosticEvent>();
        foreach (var line in lines)
        {
            if (string.IsNullOrWhiteSpace(line)) continue;
            try
            {
                var evt = JsonSerializer.Deserialize<DiagnosticEvent>(line, DiagnosticJson.Options);
                if (evt is null || string.IsNullOrWhiteSpace(evt.CorrelationId))
                {
                    PreserveCorruptCopy(path);
                    continue;
                }
                evt.Metadata = SafeMetadataPolicy.Sanitize(evt.Metadata);
                list.Add(evt);
            }
            catch
            {
                PreserveCorruptCopy(path);
            }
        }
        return list;
    }

    void EnsureLineCountUnlocked()
    {
        if (_lineCount >= 0) return;
        if (!File.Exists(_path))
        {
            _lineCount = 0;
            return;
        }
        _lineCount = File.ReadAllLines(_path, Utf8NoBom).Count(l => !string.IsNullOrWhiteSpace(l));
    }

    void RotateIfNeededUnlocked()
    {
        if (!File.Exists(_path)) return;
        var len = new FileInfo(_path).Length;
        if (len < _rotateBytes && _lineCount < _rotateMaxLines) return;
        var oldest = _path + "." + RotatedCopies;
        if (File.Exists(oldest))
            File.Delete(oldest);
        for (var i = RotatedCopies - 1; i >= 1; i--)
        {
            var src = _path + "." + i;
            var dest = _path + "." + (i + 1);
            if (File.Exists(src))
                File.Move(src, dest);
        }
        File.Move(_path, _path + ".1");
        _lineCount = 0;
    }

    void PreserveCorruptCopy(string path)
    {
        if (_corruptPreserved) return;
        _corruptPreserved = true;
        try
        {
            if (!File.Exists(path)) return;
            var dest = path + CorruptCopySuffix;
            if (!File.Exists(dest))
                File.Copy(path, dest);
        }
        catch { /* best-effort */ }
    }

    static int SeverityRank(DiagnosticSeverity s) => s switch
    {
        DiagnosticSeverity.Info => 0,
        DiagnosticSeverity.Warning => 1,
        DiagnosticSeverity.Error => 2,
        DiagnosticSeverity.Critical => 3,
        DiagnosticSeverity.Audit => 1,
        _ => 0
    };
}

public static class IncidentProjector
{
    public static Incident FromEvents(IReadOnlyList<DiagnosticEvent> events)
    {
        if (events is null || events.Count == 0)
            return new Incident();
        var ordered = events.OrderBy(e => e.TimestampUtc, StringComparer.Ordinal).ToList();
        var last = ordered[^1];
        var worst = ordered.OrderByDescending(e => Rank(e.Severity)).First();
        return new Incident
        {
            CorrelationId = ordered[0].CorrelationId,
            Status = IncidentStatus.Open,
            OpenedAtUtc = ordered[0].TimestampUtc,
            UpdatedAtUtc = last.TimestampUtc,
            PrimaryCode = worst.Code,
            Severity = worst.Severity,
            Module = worst.Module,
            Operation = worst.Operation,
            DataImpact = ordered.Max(e => e.DataImpact),
            EventCount = ordered.Count,
            LastEventId = last.EventId
        };
    }

    static int Rank(DiagnosticSeverity s) => s switch
    {
        DiagnosticSeverity.Critical => 4,
        DiagnosticSeverity.Error => 3,
        DiagnosticSeverity.Warning => 2,
        DiagnosticSeverity.Audit => 1,
        _ => 0
    };
}
