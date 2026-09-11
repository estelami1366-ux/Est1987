namespace Sirman.Core.Diagnostics;

/// <summary>Deterministic offline guidance. P0 is catalog-only (no LLM, no HTML rules).</summary>
public static class GuidanceEngine
{
    public static DiagnosticResult ToResult(Incident incident, IReadOnlyList<DiagnosticEvent> events)
    {
        var def = ErrorCatalog.Require(incident.PrimaryCode);
        var corr = incident.CorrelationId ?? "";
        var impact = incident.DataImpact switch
        {
            DataImpact.Unchanged => "داده فروشگاه تغییر نکرد.",
            DataImpact.Changed => "ممکن است داده تغییر کرده باشد — نتیجه همان بخش را بررسی کنید.",
            DataImpact.MaybeChanged => "مشخص نیست داده تغییر کرده یا نه.",
            _ => "اثر روی داده نامشخص است."
        };
        return new DiagnosticResult
        {
            Succeeded = false,
            Code = def.Code,
            Title = def.Title,
            Severity = incident.Severity == default ? def.Severity : incident.Severity,
            WhatHappened = def.UserExplanation,
            ProbableCause = def.ProbableCause,
            UserAction = def.RecommendedAction,
            DataImpact = impact,
            SupportReference = corr + " / " + def.Code,
            CorrelationId = corr
        };
    }
}
