namespace Sirman.Desktop;

/// <summary>
/// رنگ نوار عنوان ویندوز برای پوسته‌های رابط کاربری HTML.
/// </summary>
public static class UiSkinPack
{
    public readonly record struct Chrome(int CaptionArgb, int BorderArgb, int TextArgb, bool DarkTitle, bool PreferMica);

    public static Chrome For(string? key) => (key ?? "").Trim().ToLowerInvariant() switch
    {
        "fluent" or "windows" => new(0xFF0078D4, 0xFF005A9E, 0xFFFFFFFF, false, true),
        "mica" => new(0xFFF3F3F3, 0xFFD0D0D0, 0xFF1A1A1A, false, true),
        "material" => new(0xFF1B6EF3, 0xFF1557C0, 0xFFFFFFFF, false, false),
        "darkmodern" => new(0xFF0B0F14, 0xFF22D3EE, 0xFFE5E7EB, true, false),
        "glass" => new(0xFF1A3A5C, 0xFF7DD3FC, 0xFFFFFFFF, false, true),
        "neuro" => new(0xFFE6E9EF, 0xFFC5C9D1, 0xFF2D3340, false, false),
        "minimal" => new(0xFFFAFAFA, 0xFFE5E5E5, 0xFF111111, false, false),
        "graphite" => new(0xFF1E293B, 0xFF334155, 0xFFFFFFFF, true, false),
        "ember" => new(0xFF7C2D12, 0xFFEA580C, 0xFFFFFFFF, true, false),
        "ocean" => new(0xFF0F766E, 0xFF14B8A6, 0xFFFFFFFF, false, false),
        _ => new(0xFF125C80, 0xFF1F80A7, 0xFFFFFFFF, false, true)
    };
}
