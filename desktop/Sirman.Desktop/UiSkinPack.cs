namespace Sirman.Desktop;

/// <summary>
/// رنگ نوار عنوان ویندوز برای پوسته‌های رابط کاربری HTML.
/// </summary>
public static class UiSkinPack
{
    public readonly record struct Chrome(int CaptionArgb, int BorderArgb, int TextArgb, bool DarkTitle, bool PreferMica);

    public static Chrome For(string? key)
    {
        // ARGB literals above Int32.MaxValue must be unchecked to stay int.
        return unchecked((key ?? "").Trim().ToLowerInvariant() switch
        {
            "fluent" or "windows" => new((int)0xFF0078D4, (int)0xFF005A9E, (int)0xFFFFFFFF, false, true),
            "mica" => new((int)0xFFF3F3F3, (int)0xFFD0D0D0, (int)0xFF1A1A1A, false, true),
            "material" => new((int)0xFF1B6EF3, (int)0xFF1557C0, (int)0xFFFFFFFF, false, false),
            "darkmodern" => new((int)0xFF0B0F14, (int)0xFF22D3EE, (int)0xFFE5E7EB, true, false),
            "glass" => new((int)0xFF1A3A5C, (int)0xFF7DD3FC, (int)0xFFFFFFFF, false, true),
            "neuro" => new((int)0xFFE6E9EF, (int)0xFFC5C9D1, (int)0xFF2D3340, false, false),
            "minimal" => new((int)0xFFFAFAFA, (int)0xFFE5E5E5, (int)0xFF111111, false, false),
            "graphite" => new((int)0xFF1E293B, (int)0xFF334155, (int)0xFFFFFFFF, true, false),
            "ember" => new((int)0xFF7C2D12, (int)0xFFEA580C, (int)0xFFFFFFFF, true, false),
            "ocean" => new((int)0xFF0F766E, (int)0xFF14B8A6, (int)0xFFFFFFFF, false, false),
            _ => new((int)0xFF125C80, (int)0xFF1F80A7, (int)0xFFFFFFFF, false, true)
        });
    }
}
