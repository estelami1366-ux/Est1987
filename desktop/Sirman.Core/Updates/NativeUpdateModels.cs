using System.Text.Json;
using System.Text.Json.Serialization;

namespace Sirman.Core.Updates;

/// <summary>
/// P0 native-only update contract. Apply/replacement is out of scope.
/// </summary>
public static class NativeUpdateJson
{
    public static readonly JsonSerializerOptions Options = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        PropertyNameCaseInsensitive = true,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
        WriteIndented = true
    };
}

public static class NativeUpdateMagic
{
    public const string Native = "SIRMAN_NATIVE_UPDATE";
    public const string Html = "SIRMAN_UPDATE";
    public const int Format = 1;
    public const string PayloadKind = "native-only";
}

public sealed class NativeUpdateFileEntry
{
    public string Path { get; set; } = "";
    public string Sha256 { get; set; } = "";
    public long Bytes { get; set; }
}

public sealed class NativeUpdateManifest
{
    public string Magic { get; set; } = NativeUpdateMagic.Native;
    public int Format { get; set; } = NativeUpdateMagic.Format;
    public string Id { get; set; } = "";
    public string Version { get; set; } = "";
    public string Assembly { get; set; } = "";
    public string? MinAssembly { get; set; }
    public string? MaxAssembly { get; set; }
    public string PayloadKind { get; set; } = NativeUpdateMagic.PayloadKind;
    public bool ReplacesHtml { get; set; }
    public string? ExpectedHtmlVersion { get; set; }
    public List<NativeUpdateFileEntry> Files { get; set; } = new();
}

public sealed class NativeUpdateIdentity
{
    public string Id { get; init; } = "";
    public string Version { get; init; } = "";
    public string Assembly { get; init; } = "";
    public string? MinAssembly { get; init; }
    public string? MaxAssembly { get; init; }
    public string? ExpectedHtmlVersion { get; init; }
}

public sealed class NativeUpdateValidationOptions
{
    /// <summary>Installed assembly (e.g. 1405.6.16.1). When set, min/max are enforced.</summary>
    public string? CurrentAssembly { get; init; }
    public bool AllowDowngrade { get; init; }
}

public sealed class NativeUpdateValidationResult
{
    public bool Ok { get; init; }
    public string Error { get; init; } = "";
    public string Message { get; init; } = "";
    public NativeUpdateManifest? Manifest { get; init; }

    public static NativeUpdateValidationResult Pass(NativeUpdateManifest manifest) =>
        new() { Ok = true, Manifest = manifest };

    public static NativeUpdateValidationResult Fail(string error, string message) =>
        new() { Ok = false, Error = error, Message = message };
}

public sealed class NativeUpdateAssembleResult
{
    public bool Ok { get; init; }
    public string Error { get; init; } = "";
    public string Message { get; init; } = "";
    public string? PackageDirectory { get; init; }
    public string? ManifestPath { get; init; }
    public NativeUpdateManifest? Manifest { get; init; }
    public IReadOnlyList<string> SkippedHtml { get; init; } = Array.Empty<string>();

    public static NativeUpdateAssembleResult Pass(
        string packageDirectory,
        string manifestPath,
        NativeUpdateManifest manifest,
        IReadOnlyList<string> skippedHtml) =>
        new()
        {
            Ok = true,
            PackageDirectory = packageDirectory,
            ManifestPath = manifestPath,
            Manifest = manifest,
            SkippedHtml = skippedHtml
        };

    public static NativeUpdateAssembleResult Fail(string error, string message) =>
        new() { Ok = false, Error = error, Message = message };
}
