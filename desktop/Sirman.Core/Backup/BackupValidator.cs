using System.Text.Json.Nodes;

namespace Sirman.Core.Backup;

/// <summary>
/// Pure backup validation façade extracted from HTML BackupEngine validators (P1C-1..P1C-7)
/// plus ARCH-12 stored SHA-256 vs canonical digest (HTML <c>verifyChecksum</c>).
/// Receives JSON DTOs and returns result objects. Does not persist, restore, or call Host/UI.
/// Order: required+structural → portable (algo/sections) → stored checksum. Then callers may migrate.
/// Not wired to live restore. HTML validator remains the production gate until a later cutover packet.
/// </summary>
public static class BackupValidator
{
    public static BackupValidationResult Validate(BackupValidationRequest request) =>
        Validate(request?.Data);

    public static BackupValidationResult Validate(JsonNode? data)
    {
        var structural = BackupStructuralValidator.Validate(data);
        var portable = BackupPortableIntegrity.Validate(data);
        var stored = BackupStoredChecksum.Compare(data);
        var errors = structural.Errors.Concat(portable.Errors).ToList();
        if (stored.Error is { Length: > 0 })
            errors.Add(stored.Error);
        var warnings = structural.Warnings.Concat(portable.Warnings).ToList();
        return new BackupValidationResult
        {
            Ok = errors.Count == 0,
            Status = BackupJsonUtil.StatusOf(errors.Count == 0, warnings),
            Errors = errors,
            Warnings = warnings,
            MissingRequiredCollections = structural.MissingRequiredCollections,
            InvalidCollections = structural.InvalidCollections,
            CountMismatches = structural.CountMismatches,
            BrokenAttachmentRefs = structural.BrokenAttachmentRefs,
            DuplicateIdentities = structural.DuplicateIdentities,
            SectionChecksumMismatches = portable.SectionChecksumMismatches,
            ChecksumClaimed = portable.ChecksumClaimed,
            ChecksumAlgo = portable.ChecksumAlgo,
            ChecksumSkipped = portable.ChecksumSkipped,
            HasBackupId = portable.HasBackupId,
            SchemaVersion = structural.SchemaVersion,
            RequiredKeys = structural.RequiredKeys
        };
    }
}
