namespace Sirman.Core.Diagnostics;

/// <summary>
/// Nested RunBusiness reuse of the current correlation. Cleared when the outer call returns
/// so unrelated UI-thread calls do not share an id.
/// </summary>
public sealed class CorrelationScope : IDisposable
{
    static readonly AsyncLocal<string?> Held = new();
    readonly string? _previous;

    public string Value { get; }

    CorrelationScope(string value, string? previous)
    {
        Value = value;
        _previous = previous;
        Held.Value = value;
    }

    public static string? Current => Held.Value;

    public static CorrelationScope Enter(string? requested = null)
    {
        string id;
        if (CorrelationId.IsWellFormed(requested)) id = requested!.Trim();
        else if (CorrelationId.IsWellFormed(Held.Value)) id = Held.Value!;
        else id = CorrelationId.New().Value;
        return new CorrelationScope(id, Held.Value);
    }

    public static string? TryReadFromJson(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return null;
        try
        {
            using var doc = System.Text.Json.JsonDocument.Parse(json);
            var root = doc.RootElement;
            if (root.ValueKind != System.Text.Json.JsonValueKind.Object) return null;
            if (root.TryGetProperty("correlationId", out var a) && a.ValueKind == System.Text.Json.JsonValueKind.String)
                return a.GetString();
            if (root.TryGetProperty("CorrelationId", out var b) && b.ValueKind == System.Text.Json.JsonValueKind.String)
                return b.GetString();
        }
        catch
        {
            /* malformed JSON is handled by the business parse path */
        }
        return null;
    }

    public static string ResolveFromJsonOrNew(string? json)
    {
        var requested = TryReadFromJson(json);
        if (CorrelationId.IsWellFormed(requested)) return requested!.Trim();
        if (CorrelationId.IsWellFormed(Held.Value)) return Held.Value!;
        return CorrelationId.New().Value;
    }

    public void Dispose() => Held.Value = _previous;
}
