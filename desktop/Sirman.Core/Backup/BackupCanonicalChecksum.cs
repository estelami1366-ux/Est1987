using System.Security.Cryptography;
using System.Text;
using System.Text.Json.Nodes;

namespace Sirman.Core.Backup;

/// <summary>
/// Extraction of HTML P1C-7 canonical checksum definition.
/// Payload = all object keys except exportedAt, checksum, checksumAlgo.
/// Serialization = compact JSON.stringify (insertion order, not sorted).
/// Digest = SHA-256 of UTF-8 bytes of that string — not pretty-printed disk bytes.
/// Does not mutate input. Does not invent backupId.
/// </summary>
public static class BackupCanonicalChecksum
{
    public static bool IsExcludedKey(string? key) =>
        key == "exportedAt" || key == "checksum" || key == "checksumAlgo";

    public static JsonObject Payload(JsonNode? data)
    {
        var payload = new JsonObject();
        if (data is not JsonObject obj) return payload;
        foreach (var kv in obj)
        {
            if (IsExcludedKey(kv.Key)) continue;
            payload[kv.Key] = kv.Value is null ? null : kv.Value.DeepClone();
        }
        return payload;
    }

    public static string CanonicalString(JsonNode? data) =>
        BackupJsJson.Stringify(Payload(data));

    public static string Sha256Hex(JsonNode? data) => Sha256Utf8Hex(CanonicalString(data));

    public static string Sha256Utf8Hex(string canonical)
    {
        var bytes = Encoding.UTF8.GetBytes(canonical ?? "");
        var hash = SHA256.HashData(bytes);
        var sb = new StringBuilder(hash.Length * 2);
        foreach (var b in hash)
            sb.Append(b.ToString("x2"));
        return sb.ToString();
    }

    public static BackupIntegrityResult Compute(JsonNode? data)
    {
        var claim = BackupPortableIntegrity.ClassifyClaim(data);
        var canonical = CanonicalString(data);
        return new BackupIntegrityResult
        {
            CanonicalString = canonical,
            Sha256Hex = Sha256Utf8Hex(canonical),
            ChecksumClaimed = claim.Claimed,
            ChecksumAlgo = claim.Algo,
            ChecksumSkipped = claim.Skipped
        };
    }

    /// <summary>
    /// djb2 of JSON.stringify(section) over UTF-16 code units — HTML <c>backupSectionHash</c>.
    /// </summary>
    public static string SectionHash(JsonNode? value)
    {
        string s;
        try { s = BackupJsJson.Stringify(value); }
        catch { s = value?.ToString() ?? ""; }
        unchecked
        {
            var h = 5381;
            foreach (var c in s)
                h = (h << 5) + h + c;
            return ((uint)h).ToString("x");
        }
    }
}
