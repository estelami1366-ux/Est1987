namespace Sirman.Core.Diagnostics;

/// <summary>
/// Lightweight correlation id. Distinct from print session <c>D-</c> and print job <c>PJ-</c>.
/// </summary>
public readonly struct CorrelationId : IEquatable<CorrelationId>
{
    public const string Prefix = "C-";

    public string Value { get; }

    public CorrelationId(string value)
    {
        Value = value ?? "";
    }

    public static CorrelationId New() =>
        new(Prefix + Guid.NewGuid().ToString("N"));

    public static bool IsWellFormed(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return false;
        if (!value.StartsWith(Prefix, StringComparison.Ordinal)) return false;
        var hex = value[Prefix.Length..];
        if (hex.Length != 32) return false;
        foreach (var c in hex)
        {
            var ok = (c >= '0' && c <= '9') || (c >= 'a' && c <= 'f') || (c >= 'A' && c <= 'F');
            if (!ok) return false;
        }
        return true;
    }

    public static bool TryParse(string? value, out CorrelationId id)
    {
        if (!IsWellFormed(value))
        {
            id = default;
            return false;
        }
        id = new CorrelationId(value!);
        return true;
    }

    public bool Equals(CorrelationId other) =>
        string.Equals(Value, other.Value, StringComparison.Ordinal);

    public override bool Equals(object? obj) => obj is CorrelationId other && Equals(other);

    public override int GetHashCode() => StringComparer.Ordinal.GetHashCode(Value ?? "");

    public override string ToString() => Value ?? "";
}
