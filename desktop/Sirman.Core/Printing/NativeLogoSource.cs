namespace Sirman.Core.Printing;

/// <summary>
/// Same media-ref contract as HTML <c>isDiskRef</c> / <c>diskRefPath</c>:
/// stored value stays <c>disk://sirman_media/...</c>; resolve against existing backup roots.
/// Does not write files, create folders, or change logoSrc format.
/// </summary>
public sealed record NativeLogoResolveResult
{
    public string SourceKind { get; init; } = "empty";
    public string LogoSrcPreview { get; init; } = "";
    public string? ResolvedPath { get; init; }
    public bool FileExists { get; init; }
    public byte[]? DataBytes { get; init; }
    public bool RecognizedImageHeader { get; init; }
    public string? FailureReason { get; init; }

    public bool HasLoadableBytes => DataBytes is { Length: > 0 };
}

public static class NativeLogoSource
{
    public const string DiskPrefix = "disk://";
    public const string MediaFolder = "sirman_media";

    public static bool IsDiskRef(string? src) =>
        !string.IsNullOrWhiteSpace(src)
        && src.TrimStart().StartsWith(DiskPrefix, StringComparison.Ordinal);

    /// <summary>HTML <c>diskRefPath</c>: strip <c>disk://</c>.</summary>
    public static string DiskRefPath(string? src)
    {
        if (!IsDiskRef(src)) return "";
        return src!.Trim()[DiskPrefix.Length..];
    }

    public static string Preview(string? src)
    {
        if (string.IsNullOrWhiteSpace(src)) return "";
        var s = src.Trim();
        if (s.StartsWith("data:", StringComparison.OrdinalIgnoreCase))
        {
            var comma = s.IndexOf(',');
            var header = comma >= 0 ? s[..comma] : "data:";
            var payloadLen = comma >= 0 ? s.Length - comma - 1 : 0;
            return header + ",len=" + payloadLen.ToString(System.Globalization.CultureInfo.InvariantCulture);
        }
        return s.Length <= 120 ? s : s[..120] + "…";
    }

    public static string ClassifyKind(string? src)
    {
        if (string.IsNullOrWhiteSpace(src)) return "empty";
        var s = src.Trim();
        if (s.StartsWith("data:", StringComparison.OrdinalIgnoreCase)) return "data";
        if (IsDiskRef(s)) return "disk";
        if (s.StartsWith("http:", StringComparison.OrdinalIgnoreCase)
            || s.StartsWith("https:", StringComparison.OrdinalIgnoreCase))
            return "http";
        if (s.StartsWith("file:", StringComparison.OrdinalIgnoreCase)) return "file-url";
        return "path";
    }

    public static NativeLogoResolveResult Resolve(string? src, IReadOnlyList<string>? mediaRoots, IReadOnlyList<string>? fileSearchRoots = null)
    {
        var preview = Preview(src);
        if (string.IsNullOrWhiteSpace(src))
            return Fail("empty", preview, "empty");

        var s = src.Trim();
        var kind = ClassifyKind(s);
        switch (kind)
        {
            case "data":
                return ResolveDataUrl(s, preview);
            case "http":
                return Fail("http", preview, "http-rejected");
            case "file-url":
                return Fail("file-url", preview, "file-url-rejected");
            case "disk":
                return ResolveDisk(s, preview, mediaRoots);
            default:
                return ResolveLocalPath(s, preview, fileSearchRoots);
        }
    }

    public static bool IsRecognizedImageHeader(ReadOnlySpan<byte> bytes)
    {
        if (bytes.Length < 4) return false;
        // JPEG
        if (bytes[0] == 0xFF && bytes[1] == 0xD8) return true;
        // PNG
        if (bytes[0] == 0x89 && bytes[1] == 0x50 && bytes[2] == 0x4E && bytes[3] == 0x47) return true;
        // GIF
        if (bytes.Length >= 6 && bytes[0] == (byte)'G' && bytes[1] == (byte)'I' && bytes[2] == (byte)'F') return true;
        // BMP
        if (bytes[0] == (byte)'B' && bytes[1] == (byte)'M') return true;
        // WEBP (RIFF....WEBP)
        if (bytes.Length >= 12
            && bytes[0] == (byte)'R' && bytes[1] == (byte)'I' && bytes[2] == (byte)'F' && bytes[3] == (byte)'F'
            && bytes[8] == (byte)'W' && bytes[9] == (byte)'E' && bytes[10] == (byte)'B' && bytes[11] == (byte)'P')
            return true;
        return false;
    }

    /// <summary>
    /// HTML <c>writeDiskBlob</c> forces first segment <c>sirman_media</c>.
    /// Reject <c>..</c> and rooted paths so disk:// cannot escape the backup root.
    /// </summary>
    public static bool TryNormalizeDiskRelative(string relative, out string normalized, out string? failure)
    {
        normalized = "";
        failure = null;
        var raw = (relative ?? "").Replace('\\', '/').Trim().TrimStart('/');
        if (raw.Length == 0)
        {
            failure = "disk-invalid-path";
            return false;
        }
        var parts = raw.Split('/', StringSplitOptions.RemoveEmptyEntries);
        if (parts.Length == 0 || parts.Any(p => p is "." or ".."))
        {
            failure = "disk-invalid-path";
            return false;
        }
        if (!string.Equals(parts[0], MediaFolder, StringComparison.OrdinalIgnoreCase))
            parts = new[] { MediaFolder }.Concat(parts).ToArray();
        normalized = string.Join('/', parts);
        return true;
    }

    private static NativeLogoResolveResult ResolveDataUrl(string s, string preview)
    {
        try
        {
            var comma = s.IndexOf(',');
            var b64 = comma >= 0 ? s[(comma + 1)..] : s;
            var bytes = Convert.FromBase64String(b64);
            if (bytes.Length == 0)
                return Fail("data", preview, "data-decode-failed");
            return new NativeLogoResolveResult
            {
                SourceKind = "data",
                LogoSrcPreview = preview,
                DataBytes = bytes,
                RecognizedImageHeader = IsRecognizedImageHeader(bytes),
                FailureReason = IsRecognizedImageHeader(bytes) ? null : "unrecognized-image-header"
            };
        }
        catch
        {
            return Fail("data", preview, "data-decode-failed");
        }
    }

    private static NativeLogoResolveResult ResolveDisk(string s, string preview, IReadOnlyList<string>? mediaRoots)
    {
        if (!TryNormalizeDiskRelative(DiskRefPath(s), out var rel, out var invalid))
            return Fail("disk", preview, invalid ?? "disk-invalid-path");

        if (mediaRoots is null || mediaRoots.Count == 0)
            return Fail("disk", preview, "disk-missing", RelToOs(rel));

        foreach (var root in mediaRoots)
        {
            if (string.IsNullOrWhiteSpace(root)) continue;
            string full;
            try { full = Path.GetFullPath(Path.Combine(root, RelToOs(rel))); }
            catch { continue; }
            if (!IsUnderRoot(root, full)) continue;
            if (!File.Exists(full)) continue;
            try
            {
                var bytes = File.ReadAllBytes(full);
                return new NativeLogoResolveResult
                {
                    SourceKind = "disk",
                    LogoSrcPreview = preview,
                    ResolvedPath = full,
                    FileExists = true,
                    DataBytes = bytes,
                    RecognizedImageHeader = IsRecognizedImageHeader(bytes),
                    FailureReason = bytes.Length == 0
                        ? "empty-file"
                        : (IsRecognizedImageHeader(bytes) ? null : "unrecognized-image-header")
                };
            }
            catch (Exception ex)
            {
                return new NativeLogoResolveResult
                {
                    SourceKind = "disk",
                    LogoSrcPreview = preview,
                    ResolvedPath = full,
                    FileExists = true,
                    FailureReason = "file-read-failed:" + ex.GetType().Name
                };
            }
        }

        var attempted = mediaRoots
            .Where(r => !string.IsNullOrWhiteSpace(r))
            .Select(r =>
            {
                try { return Path.GetFullPath(Path.Combine(r, RelToOs(rel))); }
                catch { return r; }
            })
            .FirstOrDefault();
        return new NativeLogoResolveResult
        {
            SourceKind = "disk",
            LogoSrcPreview = preview,
            ResolvedPath = attempted,
            FileExists = false,
            FailureReason = "disk-missing"
        };
    }

    private static NativeLogoResolveResult ResolveLocalPath(string s, string preview, IReadOnlyList<string>? fileSearchRoots)
    {
        var rel = s.Replace('/', Path.DirectorySeparatorChar);
        var candidates = new List<string>();
        if (Path.IsPathRooted(rel))
            candidates.Add(rel);
        if (fileSearchRoots != null)
        {
            foreach (var root in fileSearchRoots)
            {
                if (string.IsNullOrWhiteSpace(root)) continue;
                try
                {
                    if (!Path.IsPathRooted(rel))
                        candidates.Add(Path.Combine(root, rel));
                    candidates.Add(Path.Combine(root, Path.GetFileName(rel)));
                }
                catch { /* skip bad root */ }
            }
        }

        foreach (var path in candidates)
        {
            if (string.IsNullOrWhiteSpace(path) || !File.Exists(path)) continue;
            try
            {
                var full = Path.GetFullPath(path);
                var bytes = File.ReadAllBytes(full);
                return new NativeLogoResolveResult
                {
                    SourceKind = "path",
                    LogoSrcPreview = preview,
                    ResolvedPath = full,
                    FileExists = true,
                    DataBytes = bytes,
                    RecognizedImageHeader = IsRecognizedImageHeader(bytes),
                    FailureReason = bytes.Length == 0
                        ? "empty-file"
                        : (IsRecognizedImageHeader(bytes) ? null : "unrecognized-image-header")
                };
            }
            catch (Exception ex)
            {
                return Fail("path", preview, "file-read-failed:" + ex.GetType().Name);
            }
        }

        return new NativeLogoResolveResult
        {
            SourceKind = "path",
            LogoSrcPreview = preview,
            FileExists = false,
            FailureReason = "file-missing"
        };
    }

    private static NativeLogoResolveResult Fail(string kind, string preview, string reason, string? path = null) =>
        new()
        {
            SourceKind = kind,
            LogoSrcPreview = preview,
            ResolvedPath = path,
            FailureReason = reason
        };

    private static string RelToOs(string rel) => rel.Replace('/', Path.DirectorySeparatorChar);

    private static bool IsUnderRoot(string root, string full)
    {
        try
        {
            var r = Path.GetFullPath(root)
                .TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar)
                + Path.DirectorySeparatorChar;
            var f = Path.GetFullPath(full);
            return f.StartsWith(r, StringComparison.OrdinalIgnoreCase)
                || string.Equals(Path.GetFullPath(root), Path.GetDirectoryName(f), StringComparison.OrdinalIgnoreCase);
        }
        catch
        {
            return false;
        }
    }
}
