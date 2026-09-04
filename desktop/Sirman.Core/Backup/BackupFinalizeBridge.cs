using System.Text.Json;
using System.Text.Json.Nodes;
using Sirman.Core.Infrastructure;

namespace Sirman.Core.Backup;

/// <summary>
/// ARCH-6 Host-facing contract for backup finalization.
/// Accepts serialized JSON only. Does not read live app state or disk.
/// Does not write files — callers still use the existing Host disk-write method.
/// </summary>
public static class BackupFinalizeBridge
{
    public const string EngineName = "core";

    /// <summary>
    /// Request JSON: { data, origin?, kind?, checksumMode?, nowMs?, stampExportedAt? }.
    /// checksumMode: sha256 (default) | none | leave.
    /// </summary>
    public static string Execute(string? json)
    {
        JsonNode? root;
        try
        {
            if (string.IsNullOrWhiteSpace(json))
                return Fail("invalid-json", "داده نامعتبر است");
            root = JsonNode.Parse(json);
        }
        catch
        {
            return Fail("invalid-json", "داده نامعتبر است");
        }

        if (root is not JsonObject obj)
            return Fail("invalid-json", "قرارداد نهایی‌سازی باید شیء JSON باشد");

        if (obj.ContainsKey("localStorage") || obj.ContainsKey("indexedDB") || obj.ContainsKey("webview")
            || obj.ContainsKey("document") || obj.ContainsKey("chrome"))
            return Fail("invalid-input", "ورودی نهایی‌سازی باید داده سریال باشد نه وضعیت زنده");

        if (!obj.ContainsKey("data"))
            return Fail("invalid-input", "فیلد data لازم است");

        var mode = ParseMode(Str(obj, "checksumMode"));
        long? nowMs = null;
        if (obj["nowMs"] is JsonValue nv && nv.TryGetValue<long>(out var ms))
            nowMs = ms;
        else if (obj["nowMs"] is JsonValue nv2 && nv2.TryGetValue<double>(out var md) && md >= long.MinValue && md <= long.MaxValue)
            nowMs = (long)md;

        var request = new BackupFinalizeRequest
        {
            Data = obj["data"],
            Origin = EmptyToNull(Str(obj, "origin")),
            Kind = EmptyToNull(Str(obj, "kind")),
            ChecksumMode = mode,
            NowMs = nowMs,
            StampExportedAt = IsTruthy(obj["stampExportedAt"])
        };

        var result = BackupFinalizer.Finalize(request);
        if (!result.Ok)
        {
            return Fail(
                string.IsNullOrEmpty(result.ErrorName) ? "backup-finalize" : result.ErrorName,
                string.IsNullOrEmpty(result.ErrorMessage) ? "نهایی‌سازی پشتیبان انجام نشد" : result.ErrorMessage);
        }

        var dataJson = BackupJsJson.Stringify(result.Data);
        var sectionJson = result.SectionChecksums is null ? "null" : BackupJsJson.Stringify(result.SectionChecksums);
        var manifestJson = result.Manifest is null ? "null" : BackupJsJson.Stringify(result.Manifest);
        return "{\"ok\":true,\"engine\":" + Q(EngineName)
            + ",\"wrote\":false"
            + ",\"data\":" + dataJson
            + ",\"canonicalString\":" + Q(result.CanonicalString)
            + ",\"sha256Hex\":" + Q(result.Sha256Hex)
            + ",\"checksum\":" + Q(result.Checksum)
            + ",\"checksumAlgo\":" + Q(result.ChecksumAlgo)
            + ",\"exportedAt\":" + Q(result.ExportedAt)
            + ",\"sectionChecksums\":" + sectionJson
            + ",\"manifest\":" + manifestJson
            + "}";
    }

    private static BackupChecksumMode ParseMode(string raw) =>
        raw.Trim().ToLowerInvariant() switch
        {
            "none" => BackupChecksumMode.None,
            "leave" => BackupChecksumMode.LeaveUnchanged,
            _ => BackupChecksumMode.Sha256
        };

    private static string Str(JsonObject obj, string key)
    {
        if (!obj.ContainsKey(key) || obj[key] is null) return "";
        if (obj[key] is JsonValue jv && jv.TryGetValue<string>(out var s)) return s ?? "";
        return obj[key]?.ToString() ?? "";
    }

    private static string? EmptyToNull(string s) => string.IsNullOrEmpty(s) ? null : s;

    private static bool IsTruthy(JsonNode? n)
    {
        if (n is null) return false;
        if (n is JsonValue jv)
        {
            if (jv.TryGetValue<bool>(out var b)) return b;
            if (jv.TryGetValue<string>(out var s))
                return s == "1" || string.Equals(s, "true", StringComparison.OrdinalIgnoreCase);
        }
        return false;
    }

    private static string Q(string? s) => JsonSerializer.Serialize(s ?? "");

    private static string Fail(string error, string message) => SafeError.Json(error, message);
}
