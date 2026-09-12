using System.Text.Json;

namespace Sirman.Core.Updates;

/// <summary>
/// Fail-closed validator for a native-only package directory
/// (<c>manifest.json</c> + <c>files/</c>). Does not apply files. Does not read HTML.
/// </summary>
public static class NativeUpdateValidator
{
    public const string ManifestFileName = "manifest.json";
    public const string FilesDirectoryName = "files";

    public static NativeUpdateValidationResult ValidatePackage(
        string packageDirectory,
        NativeUpdateValidationOptions? options = null)
    {
        if (string.IsNullOrWhiteSpace(packageDirectory) || !Directory.Exists(packageDirectory))
            return NativeUpdateValidationResult.Fail("native-package-missing", "پوشه بسته آپدیت بومی پیدا نشد.");

        var manifestPath = Path.Combine(packageDirectory, ManifestFileName);
        if (!File.Exists(manifestPath))
            return NativeUpdateValidationResult.Fail("native-manifest-missing", "manifest.json در بسته بومی نیست.");

        NativeUpdateManifest? manifest;
        try
        {
            var json = File.ReadAllText(manifestPath);
            manifest = JsonSerializer.Deserialize<NativeUpdateManifest>(json, NativeUpdateJson.Options);
        }
        catch (Exception)
        {
            return NativeUpdateValidationResult.Fail("native-manifest-invalid", "manifest.json نامعتبر است.");
        }

        if (manifest is null)
            return NativeUpdateValidationResult.Fail("native-manifest-invalid", "manifest.json خالی است.");

        return ValidateManifestAndFiles(manifest, Path.Combine(packageDirectory, FilesDirectoryName), options);
    }

    public static NativeUpdateValidationResult ValidateManifestAndFiles(
        NativeUpdateManifest manifest,
        string filesDirectory,
        NativeUpdateValidationOptions? options = null)
    {
        if (!string.Equals(manifest.Magic, NativeUpdateMagic.Native, StringComparison.Ordinal))
        {
            if (string.Equals(manifest.Magic, NativeUpdateMagic.Html, StringComparison.Ordinal))
                return NativeUpdateValidationResult.Fail("native-magic", "این بسته SIRMAN_UPDATE HTML است، نه آپدیت بومی.");
            return NativeUpdateValidationResult.Fail("native-magic", "magic بسته بومی نادرست است.");
        }

        if (manifest.Format != NativeUpdateMagic.Format)
            return NativeUpdateValidationResult.Fail("native-format", "فرمت بسته بومی پشتیبانی نمی‌شود.");

        if (string.IsNullOrWhiteSpace(manifest.Id) ||
            string.IsNullOrWhiteSpace(manifest.Version) ||
            string.IsNullOrWhiteSpace(manifest.Assembly))
            return NativeUpdateValidationResult.Fail("native-identity", "شناسه/نسخه/اسمبلی بسته بومی ناقص است.");

        if (!string.Equals(manifest.PayloadKind, NativeUpdateMagic.PayloadKind, StringComparison.Ordinal))
            return NativeUpdateValidationResult.Fail("native-payload-kind", "payloadKind باید native-only باشد.");

        if (manifest.ReplacesHtml)
            return NativeUpdateValidationResult.Fail("native-replaces-html", "بسته بومی نباید HTML را جایگزین کند.");

        if (manifest.Files is null || manifest.Files.Count == 0)
            return NativeUpdateValidationResult.Fail("native-empty", "فهرست فایل بومی خالی است.");

        var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach (var entry in manifest.Files)
        {
            if (entry is null)
                return NativeUpdateValidationResult.Fail("native-manifest-invalid", "آیتم فایل پوچ است.");
            var rel = NativeUpdateAllowList.NormalizeRelative(entry.Path);
            if (NativeUpdateAllowList.IsIllegalPath(entry.Path) || NativeUpdateAllowList.IsIllegalPath(rel))
                return NativeUpdateValidationResult.Fail("native-path-illegal", "مسیر فایل غیرمجاز است.");
            if (NativeUpdateAllowList.IsForbiddenHtml(rel))
                return NativeUpdateValidationResult.Fail("native-html-forbidden", "بسته بومی نباید HTML یا test_laegh.js داشته باشد.");
            if (!NativeUpdateAllowList.IsAllowedNative(rel))
                return NativeUpdateValidationResult.Fail("native-file-unsupported", "فایل خارج از فهرست مجاز بومی است: " + rel);
            if (!seen.Add(rel))
                return NativeUpdateValidationResult.Fail("native-path-illegal", "مسیر تکراری در manifest.");
            if (!NativeUpdateAllowList.IsSha256Hex(entry.Sha256))
                return NativeUpdateValidationResult.Fail("native-hash-mismatch", "SHA-256 نامعتبر است.");
            if (entry.Bytes < 1)
                return NativeUpdateValidationResult.Fail("native-size-mismatch", "اندازه فایل نامعتبر است.");
        }

        var compat = CheckAssemblyCompatibility(manifest, options);
        if (!compat.Ok) return compat;

        if (!Directory.Exists(filesDirectory))
            return NativeUpdateValidationResult.Fail("native-file-missing", "پوشه files بسته بومی نیست.");

        foreach (var extra in EnumeratePackageFiles(filesDirectory))
        {
            if (!seen.Contains(extra))
                return NativeUpdateValidationResult.Fail("native-file-unexpected", "فایل اضافه در بسته: " + extra);
        }

        foreach (var entry in manifest.Files)
        {
            var rel = NativeUpdateAllowList.NormalizeRelative(entry.Path);
            var full = Path.GetFullPath(Path.Combine(filesDirectory, rel.Replace('/', Path.DirectorySeparatorChar)));
            var root = Path.GetFullPath(filesDirectory);
            if (!full.StartsWith(root + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase) &&
                !string.Equals(full, root, StringComparison.OrdinalIgnoreCase))
                return NativeUpdateValidationResult.Fail("native-path-illegal", "مسیر از پوشه بسته خارج شد.");
            if (!File.Exists(full))
                return NativeUpdateValidationResult.Fail("native-file-missing", "فایل در بسته نیست: " + rel);
            var info = new FileInfo(full);
            if (info.Length != entry.Bytes)
                return NativeUpdateValidationResult.Fail("native-size-mismatch", "اندازه با manifest یکی نیست: " + rel);
            var actual = NativeUpdateHasher.Sha256File(full);
            if (!string.Equals(actual, entry.Sha256, StringComparison.Ordinal))
                return NativeUpdateValidationResult.Fail("native-hash-mismatch", "SHA-256 فایل با manifest یکی نیست: " + rel);
        }

        var runtime = NativeUpdateRuntimeIndependence.Check(filesDirectory);
        if (!runtime.Ok) return runtime;

        return NativeUpdateValidationResult.Pass(manifest);
    }

    static NativeUpdateValidationResult CheckAssemblyCompatibility(
        NativeUpdateManifest manifest,
        NativeUpdateValidationOptions? options)
    {
        var current = options?.CurrentAssembly;
        if (string.IsNullOrWhiteSpace(current))
            return NativeUpdateValidationResult.Pass(manifest);

        if (!TryCompareAssembly(current, manifest.Assembly, out var vsTarget))
            return NativeUpdateValidationResult.Fail("native-version", "شماره اسمبلی قابل مقایسه نیست.");

        if (vsTarget > 0 && options?.AllowDowngrade != true)
            return NativeUpdateValidationResult.Fail("native-version", "این بسته نسخه بومی را پایین می‌آورد.");

        if (!string.IsNullOrWhiteSpace(manifest.MinAssembly) &&
            TryCompareAssembly(current, manifest.MinAssembly, out var vsMin) && vsMin < 0)
            return NativeUpdateValidationResult.Fail("native-version", "اسمبلی نصب‌شده از حداقل بسته کمتر است.");

        if (!string.IsNullOrWhiteSpace(manifest.MaxAssembly) &&
            TryCompareAssembly(current, manifest.MaxAssembly, out var vsMax) && vsMax > 0)
            return NativeUpdateValidationResult.Fail("native-version", "اسمبلی نصب‌شده از حداکثر بسته بیشتر است.");

        return NativeUpdateValidationResult.Pass(manifest);
    }

    public static bool TryCompareAssembly(string left, string right, out int result)
    {
        result = 0;
        if (!TryParseAssembly(left, out var a) || !TryParseAssembly(right, out var b))
            return false;
        var n = Math.Max(a.Count, b.Count);
        for (var i = 0; i < n; i++)
        {
            var x = i < a.Count ? a[i] : 0;
            var y = i < b.Count ? b[i] : 0;
            if (x == y) continue;
            result = x < y ? -1 : 1;
            return true;
        }
        result = 0;
        return true;
    }

    static bool TryParseAssembly(string value, out List<int> parts)
    {
        parts = new List<int>();
        if (string.IsNullOrWhiteSpace(value)) return false;
        foreach (var bit in value.Trim().Split('.'))
        {
            if (!int.TryParse(bit, out var n) || n < 0)
                return false;
            parts.Add(n);
        }
        return parts.Count > 0;
    }

    static List<string> EnumeratePackageFiles(string filesDirectory)
    {
        var root = Path.GetFullPath(filesDirectory);
        var list = new List<string>();
        foreach (var full in Directory.EnumerateFiles(root, "*", SearchOption.AllDirectories))
        {
            var rel = Path.GetRelativePath(root, full).Replace('\\', '/');
            list.Add(NativeUpdateAllowList.NormalizeRelative(rel));
        }
        return list;
    }
}
