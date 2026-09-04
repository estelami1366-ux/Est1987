using System.Text.Json.Nodes;

namespace Sirman.Core.Backup;

public enum RestorePlanMode
{
    Merge,
    Replace
}

/// <summary>
/// Planning-only actions. HTML merge never updates in place (match → skip, miss → add).
/// UPDATE is reserved and unused; ambiguous cases are CONFLICT.
/// </summary>
public enum RestorePlanAction
{
    Add,
    Update,
    Replace,
    Conflict,
    Skip,
    NoAction
}

/// <summary>
/// Immutable current-application snapshot supplied as data.
/// Missing snapshot is not an empty shop. Core never reads live globals.
/// </summary>
public sealed class CurrentStateSnapshot
{
    public JsonNode? Data { get; init; }

    public static CurrentStateSnapshot From(JsonNode? data) => new() { Data = data };
}

public sealed class RestorePlanRequest
{
    public JsonNode? Data { get; init; }
    public JsonNode? Current { get; init; }
    public CurrentStateSnapshot? CurrentSnapshot { get; init; }
    public RestorePlanMode Mode { get; init; } = RestorePlanMode.Merge;
    public IReadOnlyList<string>? SelectedSections { get; init; }
    public long? NowMs { get; init; }
}

public sealed class RestoreConflict
{
    public string Collection { get; init; } = "";
    public string IdentityKey { get; init; } = "";
    public string Identity { get; init; } = "";
    public string Reason { get; init; } = "";
}

public sealed class RestorePlanRecord
{
    public int Index { get; init; }
    public string? Identity { get; init; }
    public RestorePlanAction Action { get; init; }
}

public sealed class RestorePlanSection
{
    public string Name { get; init; } = "";
    public bool Selected { get; init; }
    public bool Excluded { get; init; }
    public bool CurrentStateAvailable { get; init; }
    public RestorePlanAction Action { get; init; }
    public int? SourceCount { get; init; }
    public int? CurrentCount { get; init; }
    public int? ResultingCount { get; init; }
    public int? ProposedAdditions { get; init; }
    public int? ProposedUpdates { get; init; }
    public int? ProposedRemovals { get; init; }
    public int? Skipped { get; init; }
    public int? Conflicts { get; init; }
    public string IdentityKey { get; init; } = "";
    public IReadOnlyList<RestorePlanRecord> Records { get; init; } = Array.Empty<RestorePlanRecord>();
    public IReadOnlyList<RestoreConflict> ConflictDetails { get; init; } = Array.Empty<RestoreConflict>();
    public IReadOnlyList<string> Warnings { get; init; } = Array.Empty<string>();
}

public sealed class RestorePlanSummary
{
    public int SelectedSections { get; init; }
    public int PlannedSections { get; init; }
    public int ExcludedSections { get; init; }
    public int ConflictSections { get; init; }
}

public sealed class RestorePlan
{
    public bool Ok { get; init; }
    public bool Applied { get; init; }
    public RestorePlanMode Mode { get; init; }
    public string ModeName => Mode.ToString();
    public BackupValidationStatus Status { get; init; }
    public string StatusName => Status.ToString();
    public BackupDryRunResult? DryRun { get; init; }
    public RestorePlanSummary Summary { get; init; } = new();
    public IReadOnlyList<RestorePlanSection> Sections { get; init; } = Array.Empty<RestorePlanSection>();
    public IReadOnlyList<string> Errors { get; init; } = Array.Empty<string>();
    public IReadOnlyList<string> Warnings { get; init; } = Array.Empty<string>();
    public string Fingerprint { get; init; } = "";
    public JsonNode? MigratedData { get; init; }
}
