using System.Text.Json.Nodes;

namespace Sirman.Core.Backup;

/// <summary>
/// ARCH-5 checksum insertion modes matching HTML <c>attachChecksum</c>.
/// Does not invent sidecar / disk-byte / ZIP / encryption semantics.
/// </summary>
public enum BackupChecksumMode
{
    /// <summary>HTML <c>finalizeBackupPackage</c> only — do not touch checksum fields.</summary>
    LeaveUnchanged = 0,

    /// <summary>HTML <c>attachChecksum</c> when <c>crypto.subtle</c> exists (exe / secure context).</summary>
    Sha256 = 1,

    /// <summary>HTML <c>attachChecksum</c> when subtle is missing (file://) — empty checksum, algo none.</summary>
    None = 2
}

public sealed class BackupFinalizeRequest
{
    public JsonNode? Data { get; init; }
    public string? Origin { get; init; }
    public string? Kind { get; init; }

    /// <summary>
    /// Injected Unix ms. Core never calls Date.now / UtcNow.
    /// Used only when <see cref="StampExportedAt"/> is true.
    /// </summary>
    public long? NowMs { get; init; }

    /// <summary>
    /// HTML finalize does not stamp exportedAt (that is <c>_buildFullBackupData</c>).
    /// When true and <see cref="NowMs"/> is set, Core writes ISO-8601 exportedAt on the clone only.
    /// </summary>
    public bool StampExportedAt { get; init; }

    public BackupChecksumMode ChecksumMode { get; init; } = BackupChecksumMode.LeaveUnchanged;

    /// <summary>
    /// When true, skip <c>finalizeBackupPackage</c> and only apply checksum insertion
    /// (HTML <c>attachChecksum</c> as a separate step).
    /// </summary>
    public bool SkipPackageFinalize { get; init; }
}

/// <summary>
/// Immutable result of pure backup finalization / serialization.
/// <see cref="Data"/> is a clone; the caller's input is never mutated.
/// </summary>
public sealed class BackupFinalizeResult
{
    public bool Ok { get; init; }
    public bool Threw { get; init; }
    public string ErrorName { get; init; } = "";
    public string ErrorMessage { get; init; } = "";

    public JsonNode? Data { get; init; }

    /// <summary>
    /// Compact JSON.stringify of the checksum payload (excludes top-level
    /// exportedAt / checksum / checksumAlgo). This is the SHA-256 input, not pretty disk JSON.
    /// </summary>
    public string CanonicalString { get; init; } = "{}";

    /// <summary>SHA-256 hex of UTF-8 bytes of <see cref="CanonicalString"/> (computed, even if not stored).</summary>
    public string Sha256Hex { get; init; } = "";

    public string Checksum { get; init; } = "";
    public string ChecksumAlgo { get; init; } = "";
    public string ExportedAt { get; init; } = "";
    public JsonObject? SectionChecksums { get; init; }
    public JsonObject? Manifest { get; init; }
    public JsonArray? AttachmentsIndex { get; init; }
    public IReadOnlyList<string> Log { get; init; } = Array.Empty<string>();
    public IReadOnlyList<string> CanonicalExclusions { get; init; } =
        new[] { "exportedAt", "checksum", "checksumAlgo" };
}
