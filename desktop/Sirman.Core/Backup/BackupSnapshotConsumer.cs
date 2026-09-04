using System.Globalization;
using System.Text.Json;
using System.Text.Json.Nodes;
using Sirman.Core.Infrastructure;

namespace Sirman.Core.Backup;

/// <summary>
/// ARCH-10 read-only consumer of an already-isolated BackupSnapshot JSON document.
/// Parses and validates. Does not assemble live RAM, persist, merge, replace, or finalize.
/// Live finalization remains <see cref="BackupFinalizeBridge"/>.
/// </summary>
public static class BackupSnapshotConsumer
{
    public const string EngineName = "core";

    private static readonly string[] EnvelopeLiveMixKeys =
    {
        "invoices", "products", "inventory", "phonebook", "pb", "parts", "services", "svcs",
        "warranties", "sales", "tasks", "accounts"
    };

    /// <summary>
    /// Accepts either <c>{ "data": snapshot }</c> or a raw snapshot object.
    /// Serialized JSON only. No Apply.
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
            return Fail("invalid-json", "ورودی مصرف snapshot باید شیء JSON باشد");

        if (HasForbiddenRuntimeKey(obj))
            return Fail("invalid-input", "ورودی باید داده سریال باشد نه وضعیت زنده");

        JsonNode? payload = obj;
        if (obj.ContainsKey("data"))
        {
            foreach (var key in EnvelopeLiveMixKeys)
            {
                if (obj.ContainsKey(key))
                    return Fail("invalid-input", "ورودی باید داده سریال باشد نه آرایه زنده");
            }
            payload = obj["data"];
        }

        if (payload is not JsonObject snapObj)
            return Fail("invalid-input", "فیلد snapshot باید شیء JSON باشد");

        if (HasForbiddenRuntimeKey(snapObj))
            return Fail("invalid-input", "ورودی باید داده سریال باشد نه وضعیت زنده");

        var before = BackupJsJson.Stringify(snapObj);
        var snap = BackupSnapshot.Parse(snapObj);
        var validation = BackupValidator.Validate(snap.Data);
        var integrity = BackupCanonicalChecksum.Compute(snap.Data);
        var after = BackupJsJson.Stringify(snapObj);
        if (before != after)
            return Fail("invalid-input", "مصرف snapshot نباید ورودی را جهش دهد");

        var countsJson = snap.ItemCounts.Present
            ? BackupJsJson.Stringify(snap.ItemCounts.Data)
            : "{}";

        var ok = validation.Ok;
        return "{\"ok\":" + (ok ? "true" : "false")
            + ",\"engine\":" + Q(EngineName)
            + ",\"applied\":false"
            + ",\"wrote\":false"
            + ",\"status\":" + Q(validation.StatusName)
            + ",\"schemaVersion\":" + snap.Metadata.SchemaVersion.ToString(CultureInfo.InvariantCulture)
            + ",\"version\":" + Q(snap.Metadata.Version)
            + ",\"applicationVersion\":" + Q(snap.Metadata.ApplicationVersion)
            + ",\"keyCount\":" + snap.Shape.PresentKeyCount.ToString(CultureInfo.InvariantCulture)
            + ",\"sectionsCount\":" + snap.Shape.Sections.Count.ToString(CultureInfo.InvariantCulture)
            + ",\"itemCounts\":" + countsJson
            + ",\"integrityStatus\":" + Q(validation.StatusName)
            + ",\"checksumClaimed\":" + (validation.ChecksumClaimed ? "true" : "false")
            + ",\"checksumAlgo\":" + Q(validation.ChecksumAlgo)
            + ",\"checksumSkipped\":" + (validation.ChecksumSkipped ? "true" : "false")
            + ",\"fingerprint\":" + Q(integrity.Sha256Hex)
            + ",\"finalized\":" + (snap.Metadata.IsFinalizedPackage ? "true" : "false")
            + ",\"hasPrintCenter\":" + (snap.Shape.HasPrintCenter ? "true" : "false")
            + ",\"hasAttachmentsIndex\":" + (snap.Shape.HasAttachmentsIndex ? "true" : "false")
            + ",\"errors\":" + JsonSerializer.Serialize(validation.Errors)
            + ",\"warnings\":" + JsonSerializer.Serialize(validation.Warnings)
            + ",\"missingRequiredCollections\":" + JsonSerializer.Serialize(validation.MissingRequiredCollections)
            + ",\"countMismatches\":" + JsonSerializer.Serialize(validation.CountMismatches)
            + ",\"brokenAttachmentRefs\":" + JsonSerializer.Serialize(validation.BrokenAttachmentRefs.Select(r => r.ParentId).ToList())
            + ",\"duplicateIdentities\":" + validation.DuplicateIdentities.Count.ToString(CultureInfo.InvariantCulture)
            + "}";
    }

    private static bool HasForbiddenRuntimeKey(JsonObject obj)
    {
        foreach (var key in BackupSnapshotCatalog.ForbiddenRuntimeKeys)
        {
            if (obj.ContainsKey(key)) return true;
        }
        return false;
    }

    private static string Q(string? s) => JsonSerializer.Serialize(s ?? "");

    private static string Fail(string error, string message) => SafeError.Json(error, message);
}
