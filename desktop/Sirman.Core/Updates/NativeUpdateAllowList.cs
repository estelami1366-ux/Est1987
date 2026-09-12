using System.Security.Cryptography;
using System.Text;

namespace Sirman.Core.Updates;

public static class NativeUpdateHasher
{
    public static string Sha256File(string fullPath)
    {
        using var fs = File.OpenRead(fullPath);
        var hash = SHA256.HashData(fs);
        return Convert.ToHexString(hash).ToLowerInvariant();
    }

    public static string Sha256Bytes(ReadOnlySpan<byte> data) =>
        Convert.ToHexString(SHA256.HashData(data.ToArray())).ToLowerInvariant();
}

/// <summary>
/// Allow-list and path rules for native-only payloads. HTML always loses.
/// </summary>
public static class NativeUpdateAllowList
{
    public static readonly IReadOnlyList<string> DefaultPayloadFiles = new[]
    {
        "Sirman.exe",
        "Sirman.dll",
        "Sirman.Core.dll",
        "Sirman.deps.json",
        "Sirman.runtimeconfig.json",
        "SIRMAN_VERSION.json",
        "WebView2Loader.dll"
    };

    static readonly HashSet<string> ExactAllowed = new(StringComparer.OrdinalIgnoreCase)
    {
        "Sirman.exe",
        "Sirman.dll",
        "Sirman.Core.dll",
        "Sirman.deps.json",
        "Sirman.runtimeconfig.json",
        "SIRMAN_VERSION.json",
        "WebView2Loader.dll",
        "Sirman.Persistence.Sqlite.dll",
        "createdump.exe",
        "coreclr.dll",
        "clrjit.dll",
        "clrgc.dll",
        "clretwrc.dll",
        "hostfxr.dll",
        "hostpolicy.dll",
        "mscorlib.dll",
        "netstandard.dll"
    };

    static readonly string[] AllowedPrefixes =
    {
        "System.",
        "Microsoft.",
        "Presentation",
        "WindowsBase",
        "WindowsForms",
        "Accessibility",
        "DirectWrite",
        "wpfgfx",
        "D3DCompiler",
        "PenImc",
        "ReachFramework",
        "UIAutomation",
        "vcruntime",
        "msvcp",
        "msquic"
    };

    public static string NormalizeRelative(string path)
    {
        return (path ?? "").Replace('\\', '/').Trim().TrimStart('/');
    }

    public static bool IsForbiddenHtml(string relativePath)
    {
        var p = NormalizeRelative(relativePath);
        if (p.Length == 0) return false;
        var name = Path.GetFileName(p);
        var ext = Path.GetExtension(p);
        if (ext.Equals(".html", StringComparison.OrdinalIgnoreCase) ||
            ext.Equals(".htm", StringComparison.OrdinalIgnoreCase))
            return true;
        if (name.Equals("test_laegh.js", StringComparison.OrdinalIgnoreCase))
            return true;
        if (name.StartsWith("Sirman_Final", StringComparison.OrdinalIgnoreCase))
            return true;
        if (name.StartsWith("Laegh_Final", StringComparison.OrdinalIgnoreCase))
            return true;
        return false;
    }

    public static bool IsIllegalPath(string relativePath)
    {
        var raw = relativePath ?? "";
        if (raw.IndexOf('\0') >= 0) return true;
        if (Path.IsPathRooted(raw)) return true;
        if (raw.Contains(':')) return true;
        var p = NormalizeRelative(raw);
        if (p.Length == 0) return true;
        if (p.Contains("..", StringComparison.Ordinal)) return true;
        var parts = p.Split('/', StringSplitOptions.RemoveEmptyEntries);
        foreach (var part in parts)
        {
            if (part is "." or "..") return true;
        }
        return false;
    }

    public static bool IsAllowedNative(string relativePath)
    {
        if (IsIllegalPath(relativePath) || IsForbiddenHtml(relativePath))
            return false;
        var p = NormalizeRelative(relativePath);
        var name = Path.GetFileName(p);
        if (name.EndsWith(".sqlite", StringComparison.OrdinalIgnoreCase) ||
            name.EndsWith(".db", StringComparison.OrdinalIgnoreCase))
            return false;
        if (name.Equals("Sirman_Pending_Update.json", StringComparison.OrdinalIgnoreCase))
            return false;
        if (name.StartsWith("Sirman_Update_", StringComparison.OrdinalIgnoreCase))
            return false;
        if (ExactAllowed.Contains(name))
            return true;
        if (p.StartsWith("runtimes/", StringComparison.OrdinalIgnoreCase))
            return !IsForbiddenHtml(p);
        foreach (var prefix in AllowedPrefixes)
        {
            if (name.StartsWith(prefix, StringComparison.OrdinalIgnoreCase))
                return true;
        }
        return false;
    }

    /// <summary>Debug/dump artifacts that a self-contained publish may emit but are not required to launch.</summary>
    public static bool IsPackagingExcluded(string relativePath)
    {
        var name = Path.GetFileName(NormalizeRelative(relativePath));
        var ext = Path.GetExtension(name);
        if (ext.Equals(".pdb", StringComparison.OrdinalIgnoreCase) ||
            ext.Equals(".xml", StringComparison.OrdinalIgnoreCase))
            return true;
        if (name.Equals("createdump.exe", StringComparison.OrdinalIgnoreCase) ||
            name.Equals("createdump", StringComparison.OrdinalIgnoreCase))
            return true;
        if (name.StartsWith("mscordaccore", StringComparison.OrdinalIgnoreCase) ||
            name.Equals("mscordbi.dll", StringComparison.OrdinalIgnoreCase) ||
            name.Equals("mscorrc.dll", StringComparison.OrdinalIgnoreCase))
            return true;
        return false;
    }

    public static bool IsSha256Hex(string? value)
    {
        if (string.IsNullOrWhiteSpace(value) || value.Length != 64) return false;
        foreach (var c in value)
        {
            var ok = (c >= '0' && c <= '9') || (c >= 'a' && c <= 'f');
            if (!ok) return false;
        }
        return true;
    }
}
