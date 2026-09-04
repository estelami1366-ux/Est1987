using System.Text.Json.Nodes;

namespace Sirman.Core.Backup;

/// <summary>
/// ARCH-12 single comparison of stored checksum vs canonical digest.
/// Matches HTML <c>verifyChecksum</c>: exact string equality of stored hex
/// against <see cref="BackupCanonicalChecksum.Sha256Hex"/> (lowercase <c>x2</c>).
/// Does not trim, case-fold, or hash pretty-printed disk bytes.
/// Does not mutate input. Canonical payload definition is unchanged.
/// </summary>
public static class BackupStoredChecksum
{
    /// <summary>Existing recognized algorithm name written by HTML/Core Finalizer.</summary>
    public const string RecognizedSha256Algo = "SHA-256";

    /// <summary>HTML <c>verifyChecksum</c> mismatch text.</summary>
    public const string MismatchMessage = "checksum مطابقت ندارد — فایل ممکن است خراب باشد!";

    public readonly record struct Result(
        bool Claimed,
        bool Skipped,
        string Algo,
        string Stored,
        string ExpectedDigest,
        bool Compared,
        bool Matched,
        string? Error);

    public static Result Compare(JsonNode? data)
    {
        var claim = BackupPortableIntegrity.ClassifyClaim(data);
        var expected = BackupCanonicalChecksum.Sha256Hex(data);
        var stored = data is JsonObject obj ? BackupJsonUtil.Str(obj["checksum"]) : "";

        if (!claim.Claimed)
        {
            return new Result(
                Claimed: false,
                Skipped: true,
                Algo: claim.Algo,
                Stored: stored,
                ExpectedDigest: expected,
                Compared: false,
                Matched: false,
                Error: null);
        }

        if (claim.Algo != RecognizedSha256Algo)
        {
            return new Result(
                Claimed: true,
                Skipped: false,
                Algo: claim.Algo,
                Stored: stored,
                ExpectedDigest: expected,
                Compared: false,
                Matched: false,
                Error: null);
        }

        var matched = stored == expected;
        return new Result(
            Claimed: true,
            Skipped: false,
            Algo: claim.Algo,
            Stored: stored,
            ExpectedDigest: expected,
            Compared: true,
            Matched: matched,
            Error: matched ? null : MismatchMessage);
    }
}
