using System.Text.Json;

namespace Sirman.Core.Updates;

/// <summary>
/// Shop SIRMAN is a self-contained win-x64 Desktop publish.
/// A native package that ships only the app host + config without hostfxr/coreclr
/// will prompt Windows for an external .NET Desktop Runtime.
/// </summary>
public static class NativeUpdateRuntimeIndependence
{
    public static readonly string[] RequiredSelfContainedFiles =
    {
        "hostfxr.dll",
        "hostpolicy.dll",
        "coreclr.dll",
        "clrjit.dll",
        "System.Private.CoreLib.dll",
        "System.Windows.Forms.dll",
        "WindowsBase.dll"
    };

    public static NativeUpdateValidationResult Check(string filesDirectory)
    {
        var rcPath = Path.Combine(filesDirectory, "Sirman.runtimeconfig.json");
        if (!File.Exists(rcPath))
            return NativeUpdateValidationResult.Pass(new NativeUpdateManifest { Id = "runtime-skip" });

        JsonDocument doc;
        try
        {
            doc = JsonDocument.Parse(File.ReadAllText(rcPath));
        }
        catch
        {
            return NativeUpdateValidationResult.Fail("native-runtimeconfig", "Sirman.runtimeconfig.json نامعتبر است.");
        }

        using (doc)
        {
            if (!doc.RootElement.TryGetProperty("runtimeOptions", out var opts))
                return NativeUpdateValidationResult.Fail("native-runtimeconfig", "runtimeOptions در پیکربندی زمان‌اجرا نیست.");

            var included = HasIncludedFrameworks(opts);
            var shared = HasSharedFramework(opts);
            if (shared && !included)
                return NativeUpdateValidationResult.Fail(
                    "native-runtime-framework-dependent",
                    "بسته بومی نباید به .NET Desktop Runtime نصب‌شده وابسته باشد.");

            if (!included)
                return NativeUpdateValidationResult.Pass(new NativeUpdateManifest { Id = "runtime-skip" });

            foreach (var name in RequiredSelfContainedFiles)
            {
                var full = Path.Combine(filesDirectory, name);
                if (!File.Exists(full) || new FileInfo(full).Length < 1)
                    return NativeUpdateValidationResult.Fail(
                        "native-runtime-incomplete",
                        "فایل زمان‌اجرای خودکفا در بسته نیست: " + name);
            }
        }

        return NativeUpdateValidationResult.Pass(new NativeUpdateManifest { Id = "runtime-sc" });
    }

    static bool HasIncludedFrameworks(JsonElement opts) =>
        opts.TryGetProperty("includedFrameworks", out var inc) &&
        inc.ValueKind == JsonValueKind.Array &&
        inc.GetArrayLength() > 0;

    static bool HasSharedFramework(JsonElement opts)
    {
        if (opts.TryGetProperty("framework", out var one) && IsRuntimeFramework(one))
            return true;
        if (opts.TryGetProperty("frameworks", out var many) && many.ValueKind == JsonValueKind.Array)
        {
            foreach (var item in many.EnumerateArray())
            {
                if (IsRuntimeFramework(item)) return true;
            }
        }
        return false;
    }

    static bool IsRuntimeFramework(JsonElement item)
    {
        if (item.ValueKind != JsonValueKind.Object) return false;
        if (!item.TryGetProperty("name", out var name)) return false;
        var n = name.GetString() ?? "";
        return n.Equals("Microsoft.NETCore.App", StringComparison.OrdinalIgnoreCase) ||
               n.Equals("Microsoft.WindowsDesktop.App", StringComparison.OrdinalIgnoreCase);
    }
}
