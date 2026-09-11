namespace Sirman.Core.Diagnostics;

/// <summary>
/// Minimal deterministic guidance catalog. Keys are catalog codes, not HTML rules.
/// </summary>
public static class GuidanceCatalog
{
    public static GuidanceView For(string? codeOrAlias, string correlationId, DataImpact impact = DataImpact.Unknown, string? timestamp = null, DiagnosticModule? module = null)
    {
        var def = ErrorCatalog.Require(codeOrAlias);
        var corr = correlationId ?? "";
        var impactText = impact switch
        {
            DataImpact.Unchanged => "داده فروشگاه تغییر نکرد.",
            DataImpact.Changed => "ممکن است داده تغییر کرده باشد — نتیجه همان بخش را بررسی کنید.",
            DataImpact.MaybeChanged => "مشخص نیست داده تغییر کرده یا نه.",
            _ => "اثر روی داده نامشخص است."
        };
        return new GuidanceView
        {
            Title = def.Title,
            UserMessage = def.UserExplanation,
            Why = def.ProbableCause,
            Impact = impactText,
            NextAction = def.RecommendedAction,
            SupportAction = string.IsNullOrWhiteSpace(corr)
                ? def.RecoveryGuidance
                : def.RecoveryGuidance + " کد پیگیری: " + corr,
            Code = def.Code,
            CorrelationId = corr,
            Severity = def.Severity,
            Module = (module ?? def.Module).ToString(),
            Timestamp = timestamp ?? ""
        };
    }
}
