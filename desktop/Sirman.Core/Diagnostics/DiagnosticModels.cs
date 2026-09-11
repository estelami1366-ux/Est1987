namespace Sirman.Core.Diagnostics;

public sealed class DiagnosticContext
{
    public string CorrelationId { get; set; } = "";
    public DiagnosticModule Module { get; set; } = DiagnosticModule.System;
    public string Operation { get; set; } = "";
    public string? AppVersion { get; set; }
    public string? AssemblyVersion { get; set; }
    public string? Os { get; set; }
    public string? Runtime { get; set; }
    public DiagnosticSource Source { get; set; } = DiagnosticSource.Core;
    public DataImpact DataImpact { get; set; } = DataImpact.Unknown;
    public bool? SessionAuthenticated { get; set; }
    public string? RoleName { get; set; }
}

public sealed class ErrorDefinition
{
    public string Code { get; init; } = "";
    public string Title { get; init; } = "";
    public DiagnosticSeverity Severity { get; init; } = DiagnosticSeverity.Error;
    public DiagnosticModule Module { get; init; } = DiagnosticModule.System;
    public string UserExplanation { get; init; } = "";
    public string ProbableCause { get; init; } = "";
    public string RecommendedAction { get; init; } = "";
    public string DeveloperDetail { get; init; } = "";
    public string RecoveryGuidance { get; init; } = "";
    public DataImpact DataImpact { get; init; } = DataImpact.Unknown;
    public IReadOnlyList<string> LegacyAliases { get; init; } = Array.Empty<string>();
}

public sealed class GuidanceRule
{
    public string Code { get; init; } = "";
    public DiagnosticSeverity? MinSeverity { get; init; }
    public string WhatHappened { get; init; } = "";
    public string Why { get; init; } = "";
    public string Impact { get; init; } = "";
    public string UserAction { get; init; } = "";
    public string SupportInspect { get; init; } = "";
}

public sealed class DiagnosticEvent
{
    public string EventId { get; set; } = "";
    public string CorrelationId { get; set; } = "";
    public string TimestampUtc { get; set; } = "";
    public string TimestampLocal { get; set; } = "";
    public DiagnosticSeverity Severity { get; set; } = DiagnosticSeverity.Error;
    public string Code { get; set; } = "";
    public DiagnosticModule Module { get; set; } = DiagnosticModule.System;
    public string Operation { get; set; } = "";
    public OperationOutcome Outcome { get; set; } = OperationOutcome.Failed;
    public bool Success { get; set; }
    public DataImpact DataImpact { get; set; } = DataImpact.Unknown;
    public bool? DataChanged { get; set; }
    public DiagnosticSource Source { get; set; } = DiagnosticSource.Core;
    public string? AppVersion { get; set; }
    public string? AssemblyVersion { get; set; }
    public string? Os { get; set; }
    public string? Runtime { get; set; }
    public string? ExceptionType { get; set; }
    public string? TechnicalMessage { get; set; }
    public string? StackHash { get; set; }
    public Dictionary<string, string> Metadata { get; set; } = new(StringComparer.OrdinalIgnoreCase);
}

public sealed class Incident
{
    public string CorrelationId { get; set; } = "";
    public IncidentStatus Status { get; set; } = IncidentStatus.Open;
    public string OpenedAtUtc { get; set; } = "";
    public string UpdatedAtUtc { get; set; } = "";
    public string PrimaryCode { get; set; } = "";
    public DiagnosticSeverity Severity { get; set; } = DiagnosticSeverity.Error;
    public DiagnosticModule Module { get; set; } = DiagnosticModule.System;
    public string Operation { get; set; } = "";
    public DataImpact DataImpact { get; set; } = DataImpact.Unknown;
    public int EventCount { get; set; }
    public string? LastEventId { get; set; }
}

public sealed class DiagnosticResult
{
    public bool Succeeded { get; set; }
    public string Code { get; set; } = "";
    public string Title { get; set; } = "";
    public DiagnosticSeverity Severity { get; set; } = DiagnosticSeverity.Error;
    public string WhatHappened { get; set; } = "";
    public string ProbableCause { get; set; } = "";
    public string UserAction { get; set; } = "";
    public string DataImpact { get; set; } = "";
    public string SupportReference { get; set; } = "";
    public string CorrelationId { get; set; } = "";
}

public sealed class DiagnosticQuery
{
    public int Limit { get; set; } = 100;
    public int Offset { get; set; }
    public DiagnosticSeverity? MinSeverity { get; set; }
    public DiagnosticModule? Module { get; set; }
    public string? CorrelationId { get; set; }
    public string? CodeContains { get; set; }
    public DateTimeOffset? FromUtc { get; set; }
    public DateTimeOffset? ToUtc { get; set; }
}

public sealed class DiagnosticExportResult
{
    public bool Ok { get; set; }
    public string? FileName { get; set; }
    public long Bytes { get; set; }
    public string? CorrelationId { get; set; }
    public string? Error { get; set; }
    public string? Message { get; set; }
}

public interface IDiagnosticStore
{
    bool TryAppend(DiagnosticEvent evt, out string? error);
    Task AppendAsync(DiagnosticEvent evt, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<DiagnosticEvent>> QueryRecentAsync(DiagnosticQuery query, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<DiagnosticEvent>> GetByCorrelationIdAsync(string correlationId, CancellationToken cancellationToken = default);
    Task<DiagnosticExportResult> ExportIncidentAsync(string correlationId, string destinationDirectory, CancellationToken cancellationToken = default);
}
