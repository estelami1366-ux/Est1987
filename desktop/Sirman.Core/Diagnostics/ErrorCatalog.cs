namespace Sirman.Core.Diagnostics;

/// <summary>
/// P0 catalog: reserved namespaces + unscoped aliases only. No final business numeric codes.
/// </summary>
public static class ErrorCatalog
{
    public const string SysDeskUnscoped = "SYS-DESK-UNSCOPED";
    public const string SysHostUnscoped = "SYS-HOST-UNSCOPED";
    public const string SysUiUnscoped = "SYS-UI-UNSCOPED";
    public const string SysWebViewUnscoped = "SYS-WEBVIEW-UNSCOPED";

    static readonly ErrorDefinition[] Rows =
    {
        Def(SysDeskUnscoped, DiagnosticSeverity.Critical, DiagnosticModule.System,
            "خطای داخلی پوسته رومیزی",
            "یک استثنای مهارنشده در پوسته ویندوز رخ داد.",
            "اشکال پیش‌بینی‌نشده در exe یا WebView2.",
            "کد پیگیری را نگه دارید. برنامه را دوباره باز کنید. داده فروشگاه را پاک نکنید.",
            "Desktop unhandled / UI thread / task exception (P0 unscoped).",
            "برنامه را ببندید و دوباره باز کنید. اگر تکرار شد بسته پشتیبانی را بفرستید.",
            DataImpact.Unknown,
            "desktop-unhandled", "thread-exception", "task-exception"),
        Def(SysHostUnscoped, DiagnosticSeverity.Error, DiagnosticModule.Host,
            "خطای پل Host",
            "اجرای عملیات از طریق هسته با خطا تمام شد.",
            "درخواست نامعتبر بود، نام عملیات ناشناخته بود، یا قانون کسب‌وکار رد شد.",
            "پیام همان بخش را بخوانید. اگر ذخیره بود، نتیجه را همان‌جا بررسی کنید. کار را بی‌دلیل تکرار نکنید.",
            "Host/RunBusiness unscoped failure (P1).",
            "از مرکز تشخیص، گزارش همین کد پیگیری را صادر کنید و برای پشتیبانی بفرستید. داده فروشگاه را پاک نکنید.",
            DataImpact.Unknown,
            "business-failed", "invalid-json", "verify-failed", "login-failed",
            "unknown-op", "business-rule", "validation"),
        Def(SysWebViewUnscoped, DiagnosticSeverity.Critical, DiagnosticModule.System,
            "خطای WebView2",
            "موتور نمایش صفحه با خطا روبه‌رو شد.",
            "Runtime وب‌ویو در دسترس نیست یا ناوبری شکست خورد.",
            "WebView2 Runtime را بررسی کنید. برنامه را دوباره باز کنید.",
            "ProcessFailed / navigation failure / init catch.",
            "نصب WebView2 Runtime را در ویندوز بررسی کنید.",
            DataImpact.Unchanged,
            "webview2-failed", "webview2-init", "webview2-navigation"),
        Def(SysUiUnscoped, DiagnosticSeverity.Error, DiagnosticModule.System,
            "خطای رابط",
            "یک خطای پیش‌بینی‌نشده در صفحه رخ داد.",
            "اشکال در اسکریپت صفحه یا وعده‌ای که رد شد.",
            "صفحه را نوسازی کنید. اگر کاری در حال ذخیره بود، نتیجه را همان‌جا بررسی کنید. داده فروشگاه را پاک نکنید.",
            "UI window.onerror / unhandledrejection forwarded via ReportUiFault (P3).",
            "از مرکز تشخیص، گزارش همین کد پیگیری را صادر کنید و برای پشتیبانی بفرستید.",
            DataImpact.Unchanged,
            "ui-fault", "ERR-JS-001", "window-onerror", "unhandledrejection")
    };

    static readonly Dictionary<string, ErrorDefinition> ByCode =
        Rows.ToDictionary(r => r.Code, StringComparer.OrdinalIgnoreCase);

    static readonly Dictionary<string, ErrorDefinition> ByAlias = BuildAliases();

    public static IReadOnlyList<ErrorDefinition> All => Rows;

    public static ErrorDefinition? Find(string? codeOrAlias)
    {
        var key = (codeOrAlias ?? "").Trim();
        if (key.Length == 0) return null;
        if (ByCode.TryGetValue(key, out var row)) return row;
        if (ByAlias.TryGetValue(key, out row)) return row;
        return null;
    }

    public static ErrorDefinition Require(string? codeOrAlias) =>
        Find(codeOrAlias) ?? ByCode[SysHostUnscoped];

    static Dictionary<string, ErrorDefinition> BuildAliases()
    {
        var map = new Dictionary<string, ErrorDefinition>(StringComparer.OrdinalIgnoreCase);
        foreach (var row in Rows)
        {
            foreach (var alias in row.LegacyAliases)
                map[alias] = row;
        }
        return map;
    }

    static ErrorDefinition Def(
        string code, DiagnosticSeverity sev, DiagnosticModule mod,
        string title, string what, string why, string action, string dev, string recover,
        DataImpact impact, params string[] aliases) => new()
    {
        Code = code,
        Title = title,
        Severity = sev,
        Module = mod,
        UserExplanation = what,
        ProbableCause = why,
        RecommendedAction = action,
        DeveloperDetail = dev,
        RecoveryGuidance = recover,
        DataImpact = impact,
        LegacyAliases = aliases
    };
}
