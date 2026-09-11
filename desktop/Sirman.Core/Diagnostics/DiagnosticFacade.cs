using System.Text.Json;

namespace Sirman.Core.Diagnostics;

/// <summary>JSON Host surface for diagnostics. No filesystem paths in successful responses.</summary>
public sealed class DiagnosticFacade
{
    readonly DiagnosticService _service;
    readonly IDiagnosticStore _store;
    readonly string _exportDirectory;

    public DiagnosticFacade(DiagnosticService service, IDiagnosticStore store, string exportDirectory)
    {
        _service = service ?? throw new ArgumentNullException(nameof(service));
        _store = store ?? throw new ArgumentNullException(nameof(store));
        _exportDirectory = exportDirectory ?? throw new ArgumentNullException(nameof(exportDirectory));
    }

    public string NewCorrelationId()
    {
        var id = _service.NewCorrelationId().Value;
        return JsonSerializer.Serialize(new { ok = true, correlationId = id }, DiagnosticJson.Options);
    }

    public string GetRecentDiagnostics(string json)
    {
        var query = ParseQuery(json);
        var events = _store.QueryRecentAsync(query).GetAwaiter().GetResult();
        return JsonSerializer.Serialize(new { ok = true, count = events.Count, events }, DiagnosticJson.Options);
    }

    public string GetDiagnosticIncident(string correlationId)
    {
        var events = _store.GetByCorrelationIdAsync(correlationId ?? "").GetAwaiter().GetResult();
        if (events.Count == 0)
            return JsonSerializer.Serialize(new { ok = false, error = "not-found", message = "حادثه‌ای با این شناسه نیست" }, DiagnosticJson.Options);
        var incident = _service.BuildIncident(events);
        var result = GuidanceEngine.ToResult(incident, events);
        return JsonSerializer.Serialize(new { ok = true, incident, result, events }, DiagnosticJson.Options);
    }

    public string ExportDiagnosticReport(string correlationId)
    {
        Directory.CreateDirectory(_exportDirectory);
        var exported = _store.ExportIncidentAsync(correlationId ?? "", _exportDirectory).GetAwaiter().GetResult();
        if (!exported.Ok)
        {
            return JsonSerializer.Serialize(new
            {
                ok = false,
                error = exported.Error,
                message = exported.Message,
                correlationId = exported.CorrelationId
            }, DiagnosticJson.Options);
        }
        return JsonSerializer.Serialize(new
        {
            ok = true,
            fileName = exported.FileName,
            bytes = exported.Bytes,
            correlationId = exported.CorrelationId,
            folder = "diagnostics/support"
        }, DiagnosticJson.Options);
    }

    static DiagnosticQuery ParseQuery(string json)
    {
        var q = new DiagnosticQuery();
        if (string.IsNullOrWhiteSpace(json) || json == "{}") return q;
        try
        {
            using var doc = JsonDocument.Parse(json);
            var root = doc.RootElement;
            if (root.TryGetProperty("limit", out var lim) && lim.TryGetInt32(out var n)) q.Limit = n;
            if (root.TryGetProperty("offset", out var off) && off.TryGetInt32(out var o)) q.Offset = o;
            if (root.TryGetProperty("correlationId", out var cid) && cid.ValueKind == JsonValueKind.String)
                q.CorrelationId = cid.GetString();
            if (root.TryGetProperty("codeContains", out var cc) && cc.ValueKind == JsonValueKind.String)
                q.CodeContains = cc.GetString();
            if (root.TryGetProperty("module", out var mod) && mod.ValueKind == JsonValueKind.String
                && Enum.TryParse<DiagnosticModule>(mod.GetString(), true, out var module))
                q.Module = module;
            if (root.TryGetProperty("minSeverity", out var sev) && sev.ValueKind == JsonValueKind.String
                && Enum.TryParse<DiagnosticSeverity>(sev.GetString(), true, out var severity))
                q.MinSeverity = severity;
        }
        catch
        {
            /* empty query — caller still gets recent events */
        }
        return q;
    }
}
