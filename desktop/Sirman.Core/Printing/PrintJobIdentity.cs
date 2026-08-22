namespace Sirman.Core.Printing;

/// <summary>
/// هویت کار چاپ موجود: <c>PJ-</c> + ۱۲ رقم هگز. هویت فاکتور نیست.
/// </summary>
public static class PrintJobIdentity
{
    public const string Prefix = "PJ-";
    public const int HexLength = 12;

    public static string Create() =>
        Prefix + Guid.NewGuid().ToString("N")[..HexLength];

    public static bool IsWellFormed(string? printJobId)
    {
        if (string.IsNullOrWhiteSpace(printJobId)) return false;
        if (!printJobId.StartsWith(Prefix, StringComparison.Ordinal)) return false;
        var hex = printJobId[Prefix.Length..];
        if (hex.Length != HexLength) return false;
        foreach (var c in hex)
        {
            var ok = (c >= '0' && c <= '9') || (c >= 'a' && c <= 'f') || (c >= 'A' && c <= 'F');
            if (!ok) return false;
        }
        return true;
    }
}
