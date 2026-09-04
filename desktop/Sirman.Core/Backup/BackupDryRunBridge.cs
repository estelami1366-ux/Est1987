using System.Text.Json;
using System.Text.Json.Nodes;
using Sirman.Core.Infrastructure;

namespace Sirman.Core.Backup;

/// <summary>
/// ARCH-7 Host-facing contract for read-only restore preview / analysis.
/// Accepts serialized JSON only. Does not persist, merge, replace, or touch disk.
/// Always reports applied=false and mode=DRY_RUN_ONLY.
/// </summary>
public static class BackupDryRunBridge
{
    public const string EngineName = "core";
    public const string ModeName = "DRY_RUN_ONLY";

    private static readonly string[] LiveStateKeys =
    {
        "localStorage", "indexedDB", "webview", "document", "chrome", "window",
        "invoices", "phonebook", "warranties", "products", "sales", "parts", "accounts", "pb"
    };

    /// <summary>
    /// Request JSON: { data, nowMs? }.
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
            return Fail("invalid-json", "قرارداد پیش‌نمایش باید شیء JSON باشد");

        foreach (var key in LiveStateKeys)
        {
            if (obj.ContainsKey(key))
                return Fail("invalid-input", "ورودی پیش‌نمایش باید داده سریال باشد نه وضعیت زنده");
        }

        if (!obj.ContainsKey("data"))
            return Fail("invalid-input", "فیلد data لازم است");

        long? nowMs = null;
        if (obj["nowMs"] is JsonValue nv && nv.TryGetValue<long>(out var ms))
            nowMs = ms;
        else if (obj["nowMs"] is JsonValue nv2 && nv2.TryGetValue<double>(out var md)
                 && md >= long.MinValue && md <= long.MaxValue)
            nowMs = (long)md;

        var result = BackupDryRunService.Run(new BackupDryRunRequest
        {
            Data = obj["data"],
            NowMs = nowMs
        });

        var ok = result.Ok && result.Status != BackupValidationStatus.INVALID;
        var dataJson = result.Data is null ? "null" : BackupJsJson.Stringify(result.Data);
        var validationJson = ValidationJson(result.Validation);
        var integrityJson = ValidationJson(result.Integrity);
        var postJson = result.PostMigration is null ? "null" : ValidationJson(result.PostMigration);
        var migrationJson = MigrationJson(result.Migration);

        return "{\"ok\":" + (ok ? "true" : "false")
            + ",\"engine\":" + Q(EngineName)
            + ",\"mode\":" + Q(ModeName)
            + ",\"applied\":false"
            + ",\"wrote\":false"
            + ",\"status\":" + Q(result.StatusName)
            + ",\"sourceSchema\":" + result.SourceSchema.ToString(System.Globalization.CultureInfo.InvariantCulture)
            + ",\"targetSchema\":" + result.TargetSchema.ToString(System.Globalization.CultureInfo.InvariantCulture)
            + ",\"migrationRequired\":" + (result.MigrationRequired ? "true" : "false")
            + ",\"migrationPerformed\":" + (result.MigrationPerformed ? "true" : "false")
            + ",\"migrationStatus\":" + Q(result.MigrationStatus.ToString())
            + ",\"integrityStatus\":" + Q(result.IntegrityStatus.ToString())
            + ",\"digestCompared\":" + (result.DigestCompared ? "true" : "false")
            + ",\"digestMatched\":" + (result.DigestMatched ? "true" : "false")
            + ",\"errors\":" + JsonSerializer.Serialize(result.Errors)
            + ",\"warnings\":" + JsonSerializer.Serialize(result.Warnings)
            + ",\"log\":" + JsonSerializer.Serialize(result.Log)
            + ",\"validation\":" + validationJson
            + ",\"integrity\":" + integrityJson
            + ",\"postMigration\":" + postJson
            + ",\"migration\":" + migrationJson
            + ",\"data\":" + dataJson
            + "}";
    }

    private static string ValidationJson(BackupValidationResult v) =>
        "{\"ok\":" + (v.Ok ? "true" : "false")
        + ",\"status\":" + Q(v.StatusName)
        + ",\"errors\":" + JsonSerializer.Serialize(v.Errors)
        + ",\"warnings\":" + JsonSerializer.Serialize(v.Warnings)
        + ",\"missingRequiredCollections\":" + JsonSerializer.Serialize(v.MissingRequiredCollections)
        + ",\"invalidCollections\":" + JsonSerializer.Serialize(v.InvalidCollections)
        + ",\"countMismatches\":" + JsonSerializer.Serialize(v.CountMismatches)
        + ",\"checksumClaimed\":" + (v.ChecksumClaimed ? "true" : "false")
        + ",\"checksumAlgo\":" + Q(v.ChecksumAlgo)
        + ",\"checksumSkipped\":" + (v.ChecksumSkipped ? "true" : "false")
        + "}";

    private static string MigrationJson(SchemaMigrationResult? m)
    {
        if (m is null) return "null";
        return "{\"ok\":" + (m.Ok ? "true" : "false")
            + ",\"from\":" + m.From.ToString(System.Globalization.CultureInfo.InvariantCulture)
            + ",\"to\":" + m.To.ToString(System.Globalization.CultureInfo.InvariantCulture)
            + ",\"tooNew\":" + (m.TooNew ? "true" : "false")
            + ",\"threw\":" + (m.Threw ? "true" : "false")
            + ",\"reason\":" + Q(m.Reason)
            + ",\"log\":" + JsonSerializer.Serialize(m.Log)
            + "}";
    }

    private static string Q(string? s) => JsonSerializer.Serialize(s ?? "");

    private static string Fail(string error, string message) => SafeError.Json(error, message);
}
