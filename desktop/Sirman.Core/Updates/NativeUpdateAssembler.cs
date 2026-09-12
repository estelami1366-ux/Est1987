using System.Text.Json;

namespace Sirman.Core.Updates;

/// <summary>
/// Builds a native-only package from a publish/App directory.
/// Copies every allow-listed native/runtime file (self-contained win-x64), never HTML.
/// Does not apply or replace installed files.
/// </summary>
public static class NativeUpdateAssembler
{
    public static NativeUpdateAssembleResult Create(
        string sourceDirectory,
        string outputDirectory,
        NativeUpdateIdentity identity)
    {
        if (string.IsNullOrWhiteSpace(sourceDirectory) || !Directory.Exists(sourceDirectory))
            return NativeUpdateAssembleResult.Fail("native-source-missing", "پوشه منبع بومی پیدا نشد.");
        if (identity is null ||
            string.IsNullOrWhiteSpace(identity.Id) ||
            string.IsNullOrWhiteSpace(identity.Version) ||
            string.IsNullOrWhiteSpace(identity.Assembly))
            return NativeUpdateAssembleResult.Fail("native-identity", "شناسه بسته بومی ناقص است.");

        var skippedHtml = new List<string>();
        foreach (var html in Directory.EnumerateFiles(sourceDirectory, "*", SearchOption.AllDirectories))
        {
            var rel = Path.GetRelativePath(sourceDirectory, html).Replace('\\', '/');
            if (NativeUpdateAllowList.IsForbiddenHtml(rel))
                skippedHtml.Add(NativeUpdateAllowList.NormalizeRelative(rel));
        }

        var filesDir = Path.Combine(outputDirectory, NativeUpdateValidator.FilesDirectoryName);
        Directory.CreateDirectory(filesDir);

        var entries = new List<NativeUpdateFileEntry>();
        var copied = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        foreach (var name in NativeUpdateAllowList.DefaultPayloadFiles)
        {
            var src = Path.Combine(sourceDirectory, name);
            if (!File.Exists(src)) continue;
            var added = TryAddPayload(sourceDirectory, filesDir, name, entries, copied);
            if (!added.Ok) return NativeUpdateAssembleResult.Fail(added.Error, added.Message);
        }

        foreach (var src in Directory.EnumerateFiles(sourceDirectory, "*", SearchOption.AllDirectories))
        {
            var rel = NativeUpdateAllowList.NormalizeRelative(
                Path.GetRelativePath(sourceDirectory, src).Replace('\\', '/'));
            if (NativeUpdateAllowList.IsForbiddenHtml(rel) || NativeUpdateAllowList.IsPackagingExcluded(rel))
                continue;
            if (!NativeUpdateAllowList.IsAllowedNative(rel))
                continue;
            var added = TryAddPayload(sourceDirectory, filesDir, rel, entries, copied);
            if (!added.Ok) return NativeUpdateAssembleResult.Fail(added.Error, added.Message);
        }

        if (entries.Count == 0)
            return NativeUpdateAssembleResult.Fail("native-empty", "هیچ فایل بومی مجازی در منبع نبود.");

        var runtime = NativeUpdateRuntimeIndependence.Check(filesDir);
        if (!runtime.Ok)
            return NativeUpdateAssembleResult.Fail(runtime.Error, runtime.Message);

        var manifest = new NativeUpdateManifest
        {
            Magic = NativeUpdateMagic.Native,
            Format = NativeUpdateMagic.Format,
            Id = identity.Id.Trim(),
            Version = identity.Version.Trim(),
            Assembly = identity.Assembly.Trim(),
            MinAssembly = string.IsNullOrWhiteSpace(identity.MinAssembly) ? identity.Assembly.Trim() : identity.MinAssembly.Trim(),
            MaxAssembly = string.IsNullOrWhiteSpace(identity.MaxAssembly) ? identity.Assembly.Trim() : identity.MaxAssembly.Trim(),
            PayloadKind = NativeUpdateMagic.PayloadKind,
            ReplacesHtml = false,
            ExpectedHtmlVersion = string.IsNullOrWhiteSpace(identity.ExpectedHtmlVersion) ? null : identity.ExpectedHtmlVersion.Trim(),
            Files = entries
        };

        var manifestPath = Path.Combine(outputDirectory, NativeUpdateValidator.ManifestFileName);
        File.WriteAllText(manifestPath, JsonSerializer.Serialize(manifest, NativeUpdateJson.Options));
        return NativeUpdateAssembleResult.Pass(outputDirectory, manifestPath, manifest, skippedHtml);
    }

    public static NativeUpdateIdentity? TryIdentityFromVersionFile(string sourceDirectory)
    {
        var path = Path.Combine(sourceDirectory, "SIRMAN_VERSION.json");
        if (!File.Exists(path)) return null;
        try
        {
            using var doc = JsonDocument.Parse(File.ReadAllText(path));
            var root = doc.RootElement;
            var version = root.TryGetProperty("app", out var app) ? app.GetString() : null;
            var assembly = root.TryGetProperty("assembly", out var asm) ? asm.GetString() : null;
            if (string.IsNullOrWhiteSpace(version) || string.IsNullOrWhiteSpace(assembly))
                return null;
            return new NativeUpdateIdentity
            {
                Id = "sirman-native-" + version + "-p0",
                Version = version,
                Assembly = assembly,
                MinAssembly = assembly,
                MaxAssembly = assembly
            };
        }
        catch
        {
            return null;
        }
    }

    static (bool Ok, string Error, string Message) TryAddPayload(
        string sourceDirectory,
        string filesDir,
        string relative,
        List<NativeUpdateFileEntry> entries,
        HashSet<string> copied)
    {
        var rel = NativeUpdateAllowList.NormalizeRelative(relative);
        if (!copied.Add(rel))
            return (true, "", "");
        if (NativeUpdateAllowList.IsForbiddenHtml(rel))
            return (false, "native-html-forbidden", "منبع HTML را به‌عنوان بومی نمی‌توان بسته‌بندی کرد.");
        var src = Path.Combine(sourceDirectory, rel.Replace('/', Path.DirectorySeparatorChar));
        if (!File.Exists(src))
            return (false, "native-file-missing", "فایل بومی در منبع نیست: " + rel);
        var dest = Path.Combine(filesDir, rel.Replace('/', Path.DirectorySeparatorChar));
        Directory.CreateDirectory(Path.GetDirectoryName(dest)!);
        File.Copy(src, dest, overwrite: true);
        var info = new FileInfo(dest);
        if (info.Length < 1)
            return (false, "native-size-mismatch", "فایل بومی خالی است: " + rel);
        entries.Add(new NativeUpdateFileEntry
        {
            Path = rel,
            Sha256 = NativeUpdateHasher.Sha256File(dest),
            Bytes = info.Length
        });
        return (true, "", "");
    }
}
