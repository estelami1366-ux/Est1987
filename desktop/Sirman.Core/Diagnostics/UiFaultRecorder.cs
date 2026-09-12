using System.Globalization;
using System.Text.Json;

namespace Sirman.Core.Diagnostics;

/// <summary>
/// Records forwarded UI faults. Ignores client-supplied catalog codes.
/// </summary>
public sealed class UiFaultRecorder
{
    public const string DefaultOperation = "ReportUiFault";

    readonly DiagnosticService _service;
    readonly UiFaultDeduper _deduper;

    public UiFaultRecorder(DiagnosticService service, UiFaultDeduper? deduper = null)
    {
        _service = service ?? throw new ArgumentNullException(nameof(service));
        _deduper = deduper ?? new UiFaultDeduper();
    }

    public UiFaultReport Record(string? json)
    {
        try
        {
            var parsed = Parse(json);
            var corr = CorrelationId.IsWellFormed(parsed.CorrelationId)
                ? parsed.CorrelationId!.Trim()
                : CorrelationScope.ResolveFromJsonOrNew(null);
            if (!CorrelationId.IsWellFormed(corr))
                corr = CorrelationId.New().Value;

            var message = SafeMetadataPolicy.Redact(parsed.Message);
            var source = SafeMetadataPolicy.Redact(parsed.Source);
            var technical = BuildTechnical(message, source, parsed.Line, parsed.Column);
            if (SafeMetadataPolicy.ContainsForbiddenPayload(technical))
                technical = "ui-fault";

            var fingerprint = SafeMetadataPolicy.StackHash(
                string.Join('\n', ErrorCatalog.SysUiUnscoped, technical, parsed.Line.ToString(CultureInfo.InvariantCulture), parsed.Column.ToString(CultureInfo.InvariantCulture)))
                ?? "ui";

            var guidance = GuidanceCatalog.For(ErrorCatalog.SysUiUnscoped, corr, DataImpact.Unchanged, module: DiagnosticModule.System);
            if (!_deduper.TryAdmit(fingerprint))
            {
                return new UiFaultReport
                {
                    Ok = true,
                    Recorded = false,
                    Suppressed = true,
                    CorrelationId = corr,
                    Code = ErrorCatalog.SysUiUnscoped,
                    Guidance = guidance
                };
            }

            var recorded = _service.TryRecordUiFault(corr, technical, parsed.Stack, parsed.Operation, out _, out _);
            if (!recorded)
                _service.TryRecordUiFault(corr, "ui-fault", null, parsed.Operation, out _, out _);

            return new UiFaultReport
            {
                Ok = true,
                Recorded = recorded,
                Suppressed = false,
                CorrelationId = corr,
                Code = ErrorCatalog.SysUiUnscoped,
                Guidance = guidance
            };
        }
        catch
        {
            var corr = CorrelationId.New().Value;
            return new UiFaultReport
            {
                Ok = true,
                Recorded = false,
                Suppressed = false,
                CorrelationId = corr,
                Code = ErrorCatalog.SysUiUnscoped,
                Guidance = GuidanceCatalog.For(ErrorCatalog.SysUiUnscoped, corr, DataImpact.Unchanged, module: DiagnosticModule.System)
            };
        }
    }

    static ParsedUiFault Parse(string? json)
    {
        var parsed = new ParsedUiFault();
        if (string.IsNullOrWhiteSpace(json))
            return parsed;
        try
        {
            using var doc = JsonDocument.Parse(json);
            var root = doc.RootElement;
            if (root.ValueKind == JsonValueKind.String)
            {
                parsed.Message = root.GetString() ?? "";
                return parsed;
            }
            if (root.ValueKind != JsonValueKind.Object)
            {
                parsed.Message = SafeMetadataPolicy.Redact(root.GetRawText());
                return parsed;
            }
            parsed.Message = ReadString(root, "message") ?? "";
            parsed.Source = ReadString(root, "source") ?? ReadString(root, "filename") ?? "";
            parsed.Line = ReadInt(root, "line") ?? ReadInt(root, "lineno") ?? 0;
            parsed.Column = ReadInt(root, "column") ?? ReadInt(root, "colno") ?? 0;
            parsed.Stack = ReadString(root, "stack");
            parsed.CorrelationId = ReadString(root, "correlationId") ?? ReadString(root, "CorrelationId");
            parsed.Operation = MapOperation(ReadString(root, "kind"));
            return parsed;
        }
        catch (JsonException)
        {
            parsed.Message = SafeMetadataPolicy.Redact(json);
            return parsed;
        }
    }

    static string MapOperation(string? kind)
    {
        var k = (kind ?? "").Trim();
        if (k.Equals("window.onerror", StringComparison.OrdinalIgnoreCase)
            || k.Equals("onerror", StringComparison.OrdinalIgnoreCase))
            return "window.onerror";
        if (k.Equals("unhandledrejection", StringComparison.OrdinalIgnoreCase))
            return "unhandledrejection";
        return DefaultOperation;
    }

    static string BuildTechnical(string message, string source, int line, int column)
    {
        if (string.IsNullOrWhiteSpace(source) && line <= 0)
            return message;
        return message + " @" + source + ":" + line.ToString(CultureInfo.InvariantCulture) + ":" + column.ToString(CultureInfo.InvariantCulture);
    }

    static string? ReadString(JsonElement root, string name)
    {
        if (!root.TryGetProperty(name, out var el)) return null;
        return el.ValueKind switch
        {
            JsonValueKind.String => el.GetString(),
            JsonValueKind.Number => el.GetRawText(),
            JsonValueKind.True => "true",
            JsonValueKind.False => "false",
            JsonValueKind.Null => "",
            _ => null
        };
    }

    static int? ReadInt(JsonElement root, string name)
    {
        if (!root.TryGetProperty(name, out var el)) return null;
        if (el.ValueKind == JsonValueKind.Number && el.TryGetInt32(out var n)) return n;
        if (el.ValueKind == JsonValueKind.String && int.TryParse(el.GetString(), NumberStyles.Integer, CultureInfo.InvariantCulture, out var p))
            return p;
        return null;
    }

    sealed class ParsedUiFault
    {
        public string Message { get; set; } = "";
        public string Source { get; set; } = "";
        public int Line { get; set; }
        public int Column { get; set; }
        public string? Stack { get; set; }
        public string? CorrelationId { get; set; }
        public string Operation { get; set; } = DefaultOperation;
    }
}
