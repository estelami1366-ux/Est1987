using System.Text.Json.Nodes;

namespace Sirman.Core.Backup;

/// <summary>
/// Result of pure schema/field backup migration extracted from HTML
/// <c>applySchemaMigrations</c> / <c>migrateBackup</c>. Does not persist or restore.
/// </summary>
public sealed class SchemaMigrationResult
{
    public bool Ok { get; init; }
    public bool TooNew { get; init; }
    public int From { get; init; }
    public int To { get; init; }
    public JsonNode? Data { get; init; }
    public IReadOnlyList<string> Log { get; init; } = Array.Empty<string>();
    public string Reason { get; init; } = "";
    public bool Threw { get; init; }
    public string ErrorName { get; init; } = "";
    public string ErrorMessage { get; init; } = "";
}

public sealed class BackupMigrationRequest
{
    public JsonNode? Data { get; init; }
    public int? TargetSchemaVersion { get; init; }
    /// <summary>Unix ms. When set, replaces HTML <c>Date.now()</c> for missing-id assignment.</summary>
    public long? NowMs { get; init; }
}

public sealed class BackupMigrationException : Exception
{
    public BackupMigrationException(string message) : base(message) { }
}
