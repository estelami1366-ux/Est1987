namespace Sirman.Core.Printing;

/// <summary>
/// Presentation-only bidirectional helpers for native print.
/// Stored business values are never mutated.
/// </summary>
public static class NativePrintBidi
{
    public const char LeftToRightEmbedding = '\u202A';
    public const char PopDirectionalFormatting = '\u202C';

    /// <summary>
    /// Force identifier-like mixed text (postal codes, phones) to render LTR.
    /// </summary>
    public static string AsLeftToRight(string? value)
    {
        if (string.IsNullOrEmpty(value)) return value ?? "";
        if (value[0] == LeftToRightEmbedding && value[^1] == PopDirectionalFormatting)
            return value;
        return string.Concat(LeftToRightEmbedding, value, PopDirectionalFormatting);
    }

    public static string Unwrap(string? presented)
    {
        if (string.IsNullOrEmpty(presented)) return presented ?? "";
        if (presented.Length >= 2
            && presented[0] == LeftToRightEmbedding
            && presented[^1] == PopDirectionalFormatting)
            return presented[1..^1];
        return presented;
    }

    /// <summary>"2000-35155" reversed around hyphens becomes "35155-2000".</summary>
    public static string ReverseHyphenated(string? value)
    {
        if (string.IsNullOrEmpty(value)) return value ?? "";
        var parts = value.Split('-');
        if (parts.Length < 2) return value;
        Array.Reverse(parts);
        return string.Join("-", parts);
    }
}
