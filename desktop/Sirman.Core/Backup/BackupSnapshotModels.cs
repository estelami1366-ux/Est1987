using System.Text.Json.Nodes;

namespace Sirman.Core.Backup;

/// <summary>
/// Transport metadata from a backup snapshot JSON document.
/// Business records remain JSON-shaped; this is not a domain entity.
/// </summary>
public sealed class BackupSnapshotMetadata
{
    public string Magic { get; init; } = "";
    public int SchemaVersion { get; init; }
    public bool SchemaVersionPresent { get; init; }
    public string Version { get; init; } = "";
    public string ApplicationVersion { get; init; } = "";
    public string ExportedAt { get; init; } = "";
    public string Origin { get; init; } = "";
    public bool OriginPresent { get; init; }
    public bool HasChecksum { get; init; }
    public string ChecksumAlgo { get; init; } = "";
    public bool HasManifest { get; init; }
    public bool HasSectionChecksums { get; init; }

    /// <summary>True when Finalizer/checksum fields are present. Raw assembly typically has none.</summary>
    public bool IsFinalizedPackage => HasChecksum || HasManifest || HasSectionChecksums;
}

/// <summary>
/// Declared <c>itemCounts</c> only — not the <c>sections</c> catalog and not the full payload key set.
/// </summary>
public sealed class BackupSnapshotItemCounts
{
    public JsonObject Data { get; init; } = new();
    public IReadOnlyList<string> DeclaredKeys { get; init; } = Array.Empty<string>();
    public bool Present { get; init; }
}

/// <summary>Appearance map as JSON. Keys documented in <see cref="BackupSnapshotCatalog.AppearanceKeys"/>.</summary>
public sealed class BackupSnapshotAppearance
{
    public JsonObject Data { get; init; } = new();
    public bool Present { get; init; }
}

/// <summary>Observed key-set classification. Does not mutate or assemble live data.</summary>
public sealed class BackupSnapshotShapeReport
{
    public bool IsObject { get; init; }
    public int PresentKeyCount { get; init; }
    public bool HasAllBasePayloadKeys { get; init; }
    public IReadOnlyList<string> MissingBaseKeys { get; init; } = Array.Empty<string>();
    public bool HasPrintCenter { get; init; }
    public bool HasAttachmentsIndex { get; init; }
    public bool IsTypical51KeySnapshot { get; init; }
    public bool PhonebookPresent { get; init; }
    public bool PhonebookIsArray { get; init; }
    public bool HasRuntimeHandles { get; init; }
    public IReadOnlyList<string> RuntimeHandleKeys { get; init; } = Array.Empty<string>();
    public IReadOnlyList<string> Sections { get; init; } = Array.Empty<string>();
    public bool SectionsMatchCatalog { get; init; }
}
