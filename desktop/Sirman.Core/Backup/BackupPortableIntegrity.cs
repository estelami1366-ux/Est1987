using System.Text.Json.Nodes;

namespace Sirman.Core.Backup;

/// <summary>
/// Extraction of HTML <c>classifyBackupChecksumClaim</c>, <c>validateBackupSectionChecksums</c>,
/// and <c>validateBackupPortableIntegrity</c>. Unknown claimed algorithm is INVALID.
/// Missing checksum / algo none remain compatible. Does not mutate input.
/// Stored SHA-256 hex vs canonical digest is <see cref="BackupStoredChecksum"/>,
/// applied by <see cref="BackupValidator"/> (HTML portable slice does not compare the digest).
/// </summary>
public static class BackupPortableIntegrity
{
    public readonly record struct ChecksumClaim(bool Claimed, string Algo, bool Skipped);

    public static ChecksumClaim ClassifyClaim(JsonNode? data)
    {
        // HTML: if(!d || typeof d !== 'object') → algo ''. Arrays are typeof object.
        if (BackupJsonUtil.IsNullish(data))
            return new ChecksumClaim(false, "", true);
        if (data is not JsonObject && data is not JsonArray)
            return new ChecksumClaim(false, "", true);
        var algo = data is JsonObject obj ? BackupJsonUtil.Str(obj["checksumAlgo"]) : "";
        var sum = data is JsonObject obj2 ? BackupJsonUtil.Str(obj2["checksum"]) : "";
        if (sum.Length == 0 || algo.Length == 0 || algo == "none")
            return new ChecksumClaim(false, algo.Length == 0 ? "none" : algo, true);
        return new ChecksumClaim(true, algo, false);
    }

    public static BackupValidationResult ValidateSectionChecksums(JsonNode? data)
    {
        var errors = new List<string>();
        var mismatches = new List<string>();
        if (!BackupJsonUtil.IsPackageObject(data))
            return OkSections(mismatches);
        var obj = (JsonObject)data!;
        if (!obj.ContainsKey("sectionChecksums"))
            return OkSections(mismatches);

        var sc = obj["sectionChecksums"];
        if (sc is null || sc is JsonArray || sc is not JsonObject scObj)
        {
            errors.Add("sectionChecksums باید شیء باشد، نه " + BackupJsonUtil.JsTypeName(sc));
            return new BackupValidationResult
            {
                Ok = false,
                Status = BackupValidationStatus.INVALID,
                Errors = errors,
                SectionChecksumMismatches = mismatches
            };
        }

        foreach (var kv in scObj)
        {
            if (!obj.ContainsKey(kv.Key)) continue;
            var expected = BackupJsonUtil.Str(kv.Value);
            var actual = BackupCanonicalChecksum.SectionHash(obj[kv.Key]);
            if (actual != expected)
            {
                mismatches.Add(kv.Key);
                errors.Add("هش بخش " + kv.Key + " مطابقت ندارد");
            }
        }

        return new BackupValidationResult
        {
            Ok = errors.Count == 0,
            Status = BackupJsonUtil.StatusOf(errors.Count == 0, Array.Empty<string>()),
            Errors = errors,
            SectionChecksumMismatches = mismatches
        };
    }

    public static BackupValidationResult Validate(JsonNode? data)
    {
        var sections = ValidateSectionChecksums(data);
        var claim = ClassifyClaim(data);
        var errors = sections.Errors.ToList();
        var warnings = sections.Warnings.ToList();
        if (claim.Claimed && claim.Algo != "SHA-256")
            errors.Add("الگوریتم checksum پشتیبانی نمی‌شود: " + claim.Algo);

        var hasBackupId = false;
        if (data is JsonObject obj)
        {
            var id = BackupJsonUtil.Str(obj["backupId"]);
            var manId = obj["manifest"] is JsonObject man ? BackupJsonUtil.Str(man["backupId"]) : "";
            hasBackupId = id.Length > 0 || manId.Length > 0;
        }

        return new BackupValidationResult
        {
            Ok = errors.Count == 0,
            Status = BackupJsonUtil.StatusOf(errors.Count == 0, warnings),
            Errors = errors,
            Warnings = warnings,
            SectionChecksumMismatches = sections.SectionChecksumMismatches,
            ChecksumClaimed = claim.Claimed,
            ChecksumAlgo = claim.Algo,
            ChecksumSkipped = claim.Skipped,
            HasBackupId = hasBackupId
        };
    }

    private static BackupValidationResult OkSections(List<string> mismatches) =>
        new()
        {
            Ok = true,
            Status = BackupValidationStatus.VALID,
            SectionChecksumMismatches = mismatches
        };
}
