using System.Text.Json.Nodes;

namespace Sirman.Core.Backup;

/// <summary>
/// Integrity slice for ARCH-4 dry-run. Overall dry-run status stays
/// <see cref="BackupValidationStatus"/> (VALID / VALID_WITH_WARNINGS / INVALID).
/// <see cref="NotVerifiable"/> is the P1C-7 skipped checksum compatibility name
/// for this slice only — it is not a fourth overall status.
/// </summary>
public enum BackupIntegrityStatus
{
    VALID,
    INVALID,
    NOT_VERIFIABLE
}

public enum BackupMigrationRunStatus
{
    NotAttempted,
    Performed,
    Failed
}

public sealed class BackupDryRunRequest
{
    public JsonNode? Data { get; init; }
    /// <summary>Unix ms injected into ARCH-3 migrator. Null uses migrator default.</summary>
    public long? NowMs { get; init; }
}

public sealed class BackupDryRunResult
{
    public bool Ok { get; init; }
    public bool Applied { get; init; }
    public BackupValidationStatus Status { get; init; }
    public string StatusName => Status.ToString();

    public int SourceSchema { get; init; }
    public int TargetSchema { get; init; }
    public bool MigrationRequired { get; init; }
    public bool MigrationPerformed { get; init; }
    public BackupMigrationRunStatus MigrationStatus { get; init; }

    public BackupValidationResult Validation { get; init; } = new();
    public BackupIntegrityStatus IntegrityStatus { get; init; }
    public BackupValidationResult Integrity { get; init; } = new();
    public bool DigestCompared { get; init; }
    public bool DigestMatched { get; init; }

    public SchemaMigrationResult? Migration { get; init; }
    public BackupValidationResult? PostMigration { get; init; }

    public IReadOnlyList<string> Errors { get; init; } = Array.Empty<string>();
    public IReadOnlyList<string> Warnings { get; init; } = Array.Empty<string>();
    public IReadOnlyList<string> Log { get; init; } = Array.Empty<string>();

    /// <summary>Migrated clone when gates passed and migration succeeded. Never live state.</summary>
    public JsonNode? Data { get; init; }
}
