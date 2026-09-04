using System.Text.Json.Nodes;

namespace Sirman.Core.Backup;

public enum BackupValidationStatus
{
    VALID,
    VALID_WITH_WARNINGS,
    INVALID
}

public sealed class BackupValidationRequest
{
    public JsonNode? Data { get; init; }
}

public sealed class BackupValidationError
{
    public string Message { get; init; } = "";
}

public sealed class BackupValidationWarning
{
    public string Message { get; init; } = "";
}

public sealed class RequiredCollectionRule
{
    public IReadOnlyList<string> Always { get; init; } = RequiredCollectionsRegistry.Always;
    public IReadOnlyDictionary<int, IReadOnlyList<string>> FromSchema { get; init; } =
        RequiredCollectionsRegistry.FromSchema;
}

public sealed class BrokenAttachmentRef
{
    public int Index { get; init; }
    public string Kind { get; init; } = "";
    public string ParentId { get; init; } = "";
}

public sealed class DuplicateIdentity
{
    public string Collection { get; init; } = "";
    public string Field { get; init; } = "";
    public string Value { get; init; } = "";
    public int Index { get; init; }
}

public sealed class BackupIntegrityResult
{
    public string CanonicalString { get; init; } = "";
    public string Sha256Hex { get; init; } = "";
    public bool ChecksumClaimed { get; init; }
    public string ChecksumAlgo { get; init; } = "";
    public bool ChecksumSkipped { get; init; }
}

public sealed class BackupValidationResult
{
    public bool Ok { get; init; }
    public BackupValidationStatus Status { get; init; }
    public IReadOnlyList<string> Errors { get; init; } = Array.Empty<string>();
    public IReadOnlyList<string> Warnings { get; init; } = Array.Empty<string>();
    public IReadOnlyList<string> MissingRequiredCollections { get; init; } = Array.Empty<string>();
    public IReadOnlyList<string> InvalidCollections { get; init; } = Array.Empty<string>();
    public IReadOnlyList<string> CountMismatches { get; init; } = Array.Empty<string>();
    public IReadOnlyList<BrokenAttachmentRef> BrokenAttachmentRefs { get; init; } = Array.Empty<BrokenAttachmentRef>();
    public IReadOnlyList<DuplicateIdentity> DuplicateIdentities { get; init; } = Array.Empty<DuplicateIdentity>();
    public IReadOnlyList<string> SectionChecksumMismatches { get; init; } = Array.Empty<string>();
    public bool ChecksumClaimed { get; init; }
    public string ChecksumAlgo { get; init; } = "";
    public bool ChecksumSkipped { get; init; }
    public bool HasBackupId { get; init; }
    public int SchemaVersion { get; init; }
    public IReadOnlyList<string> RequiredKeys { get; init; } = Array.Empty<string>();

    public string StatusName => Status.ToString();
}

/// <summary>
/// Frozen P1C-1..5 registry. Tasks are not required.
/// </summary>
public static class RequiredCollectionsRegistry
{
    public static readonly IReadOnlyList<string> Always = new[] { "warranties", "invoices" };

    public static readonly IReadOnlyDictionary<int, IReadOnlyList<string>> FromSchema =
        new Dictionary<int, IReadOnlyList<string>>
        {
            [1] = new[] { "sales", "parts", "accounts" }
        };
}
