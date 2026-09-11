using System.Collections;
using System.Runtime.InteropServices;

namespace Sirman.Core.Diagnostics;

public sealed class DiagnosticService
{
    readonly IDiagnosticStore _store;
    readonly string? _appVersion;
    readonly string? _assemblyVersion;

    public DiagnosticService(IDiagnosticStore store, string? appVersion = null, string? assemblyVersion = null)
    {
        _store = store ?? throw new ArgumentNullException(nameof(store));
        _appVersion = appVersion;
        _assemblyVersion = assemblyVersion;
    }

    public IDiagnosticStore Store => _store;

    public CorrelationId NewCorrelationId() => CorrelationId.New();

    public bool TryRecordException(Exception ex, DiagnosticContext? context, out DiagnosticEvent? evt, out string? error)
    {
        evt = FromException(ex, context);
        if (!_store.TryAppend(evt, out error))
        {
            evt = null;
            return false;
        }
        return true;
    }

    public DiagnosticEvent FromException(Exception ex, DiagnosticContext? context)
    {
        ArgumentNullException.ThrowIfNull(ex);
        var ctx = context ?? new DiagnosticContext();
        var corr = string.IsNullOrWhiteSpace(ctx.CorrelationId)
            ? CorrelationId.New().Value
            : ctx.CorrelationId.Trim();
        var alias = GuessAlias(ctx);
        var def = ErrorCatalog.Require(alias);
        var evt = new DiagnosticEvent
        {
            CorrelationId = corr,
            Severity = def.Severity,
            Code = def.Code,
            Module = ctx.Module == DiagnosticModule.Unknown ? def.Module : ctx.Module,
            Operation = string.IsNullOrWhiteSpace(ctx.Operation) ? "exception" : ctx.Operation,
            Outcome = OperationOutcome.Failed,
            Success = false,
            DataImpact = def.DataImpact,
            DataChanged = def.DataImpact == DataImpact.Unchanged ? false : null,
            Source = ctx.Source,
            AppVersion = ctx.AppVersion ?? _appVersion,
            AssemblyVersion = ctx.AssemblyVersion ?? _assemblyVersion,
            Os = ctx.Os ?? RuntimeInformation.OSDescription,
            Runtime = ctx.Runtime ?? RuntimeInformation.FrameworkDescription,
            ExceptionType = ex.GetType().FullName,
            TechnicalMessage = SafeMetadataPolicy.Redact(ex.Message),
            StackHash = SafeMetadataPolicy.StackHash(ex.StackTrace)
        };
        var extra = new Dictionary<string, string?>(StringComparer.OrdinalIgnoreCase)
        {
            ["hostMethod"] = ctx.Operation,
            ["exceptionType"] = evt.ExceptionType,
            ["code"] = evt.Code,
            ["correlationId"] = corr,
            ["technicalMessage"] = evt.TechnicalMessage
        };
        evt.Metadata = SafeMetadataPolicy.Sanitize(extra);
        // Exception.Data is scanned through the same allow-list; secrets never copy.
        var fromData = SafeMetadataPolicy.Sanitize(ex.Data as IDictionary);
        foreach (var kv in fromData)
            evt.Metadata[kv.Key] = kv.Value;
        return evt;
    }

    public Incident BuildIncident(IReadOnlyList<DiagnosticEvent> events) =>
        IncidentProjector.FromEvents(events);

    static string GuessAlias(DiagnosticContext ctx)
    {
        var op = (ctx.Operation ?? "").ToLowerInvariant();
        if (op.Contains("webview", StringComparison.Ordinal)) return ErrorCatalog.SysWebViewUnscoped;
        if (ctx.Source == DiagnosticSource.Host) return ErrorCatalog.SysHostUnscoped;
        if (ctx.Source == DiagnosticSource.Desktop) return ErrorCatalog.SysDeskUnscoped;
        return ErrorCatalog.SysHostUnscoped;
    }
}
