namespace Sirman.Core.Printing;

/// <summary>
/// نگاشت کاغذ/جهت/کپی/حاشیه — بدون GDI و بدون قانون کسب‌وکار فاکتور.
/// </summary>
public static class NativePrintLayout
{
    public const int MinCopies = 1;
    public const int MaxCopies = 20;

    public readonly record struct PaperSpec(string Name, bool Landscape, int WidthHundredthsInch, int HeightHundredthsInch, float MarginMm);

    public static int ClampCopies(int copies)
    {
        if (copies < MinCopies) return MinCopies;
        if (copies > MaxCopies) return MaxCopies;
        return copies;
    }

    public static bool TryParseCopies(string? raw, out int copies, out string error)
    {
        copies = 1;
        error = "";
        if (string.IsNullOrWhiteSpace(raw))
        {
            copies = 1;
            return true;
        }
        if (!int.TryParse(raw.Trim(), out var n) || n < MinCopies || n > MaxCopies)
        {
            error = "تعداد کپی نامعتبر است.";
            return false;
        }
        copies = n;
        return true;
    }

    /// <summary>
    /// ورودی‌های واقعی UI: «A4 landscape»، «A4»، «A5»، «A5 landscape»، «80mm»، «label».
    /// </summary>
    public static PaperSpec ParsePaper(string? paper, string? orientation)
    {
        var raw = (paper ?? "A4").Trim();
        var ori = (orientation ?? "").Trim().ToLowerInvariant();
        var landscape = ori is "landscape" or "horizontal" or "افقی";
        if (raw.EndsWith(" landscape", StringComparison.OrdinalIgnoreCase))
        {
            landscape = true;
            raw = raw[..^" landscape".Length].Trim();
        }
        else if (raw.EndsWith(" portrait", StringComparison.OrdinalIgnoreCase))
        {
            landscape = false;
            raw = raw[..^" portrait".Length].Trim();
        }

        var name = raw.Length == 0 ? "A4" : raw;
        int w, h;
        switch (name.ToLowerInvariant())
        {
            case "a5":
                w = 583; h = 827; break;
            case "80mm":
                w = 315; h = 787; break;
            case "label":
                w = 394; h = 591; break;
            default:
                name = name.Equals("A4", StringComparison.OrdinalIgnoreCase) ? "A4" : name;
                w = 827; h = 1169; break;
        }
        return new PaperSpec(name, landscape, w, h, 8f);
    }

    public static float ParseMarginMm(string? margin, float fallback = 8f)
    {
        var s = (margin ?? "").Trim().ToLowerInvariant().Replace("mm", "", StringComparison.Ordinal);
        if (float.TryParse(s, System.Globalization.NumberStyles.Float, System.Globalization.CultureInfo.InvariantCulture, out var mm)
            && mm >= 0 && mm <= 40)
            return mm;
        return fallback;
    }

    public static float ParseFontPoints(string? fontsize, float fallback = 9f)
    {
        var s = (fontsize ?? "").Trim().ToLowerInvariant().Replace("px", "", StringComparison.Ordinal);
        if (float.TryParse(s, System.Globalization.NumberStyles.Float, System.Globalization.CultureInfo.InvariantCulture, out var px)
            && px >= 6 && px <= 24)
            return Math.Max(7f, px * 0.75f);
        return fallback;
    }

    public static int PageCount(int lineCount, int linesPerPage)
    {
        if (linesPerPage < 1) linesPerPage = 1;
        if (lineCount <= 0) return 1;
        return (lineCount + linesPerPage - 1) / linesPerPage;
    }

    public static int LinesPerPageForPaper(string paperName, bool landscape)
    {
        var n = (paperName ?? "A4").Trim().ToLowerInvariant();
        if (n is "80mm" or "label") return 12;
        if (n == "a5") return landscape ? 10 : 14;
        return landscape ? 12 : 18;
    }
}
