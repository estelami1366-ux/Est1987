using System.Text.Json;
using System.Text.Json.Nodes;

namespace Sirman.Core.Backup;

/// <summary>
/// ARCH-17 transport document for the REQUIRED business backup collections.
/// JSON only. No browser APIs, no WebView2, no WinForms, no storage, no domain persist.
/// Does not generate IDs, normalize, deduplicate, or repair records.
/// </summary>
public sealed class BusinessDataSnapshot
{
    private BusinessDataSnapshot(JsonObject data, BusinessDataSnapshotReport report)
    {
        Data = data;
        Report = report;
    }

    public JsonObject Data { get; }
    public BusinessDataSnapshotReport Report { get; }

    public JsonNode? Field(string name) =>
        Data.ContainsKey(name) ? Data[name] : null;

    public JsonArray? Invoices => Field("invoices") as JsonArray;
    public JsonArray? Sales => Field("sales") as JsonArray;
    public JsonArray? Warranties => Field("warranties") as JsonArray;
    public JsonArray? Parts => Field("parts") as JsonArray;
    public JsonArray? Accounts => Field("accounts") as JsonArray;
    public JsonObject? Counters => Field(BusinessDataSnapshotCatalog.CountersObjectKey) as JsonObject;

    public static BusinessDataSnapshot Parse(JsonNode? node)
    {
        var clone = BackupJsonUtil.CloneExact(node);
        if (clone is not JsonObject obj)
            return FromEmpty();

        var stripped = new List<string>();
        foreach (var key in BusinessDataSnapshotCatalog.ForbiddenKeys)
        {
            if (obj.ContainsKey(key))
                stripped.Add(key);
        }

        var runtime = BusinessDataSnapshotCatalog.ForbiddenRuntimeKeys
            .Where(obj.ContainsKey)
            .ToList();

        var data = new JsonObject();
        foreach (var key in BusinessDataSnapshotCatalog.AllRequiredKeys)
        {
            if (!obj.ContainsKey(key)) continue;
            data[key] = BackupJsonUtil.CloneExact(obj[key]);
        }

        var present = data.Select(kv => kv.Key).ToList();
        var missing = BusinessDataSnapshotCatalog.AllRequiredKeys
            .Where(k => !data.ContainsKey(k))
            .ToList();

        var report = new BusinessDataSnapshotReport
        {
            IsObject = true,
            PresentKeys = present,
            MissingRequiredKeys = missing,
            HasAllRequiredKeys = missing.Count == 0,
            HasPhonebook = obj.ContainsKey("phonebook") || obj.ContainsKey("pb"),
            HasAttachmentsIndex = obj.ContainsKey("attachmentsIndex"),
            HasRuntimeHandles = runtime.Count > 0,
            RuntimeHandleKeys = runtime,
            StrippedForbiddenKeys = stripped
        };
        return new BusinessDataSnapshot(data, report);
    }

    public static BusinessDataSnapshot FromCanonicalJson(string? json)
    {
        JsonNode? node = null;
        if (!string.IsNullOrEmpty(json))
        {
            try { node = JsonNode.Parse(json); }
            catch (JsonException) { node = null; }
        }
        return Parse(node);
    }

    public JsonObject ToJson() => (JsonObject)BackupJsonUtil.CloneExact(Data)!;

    public string ToCanonicalJson() => BackupJsJson.Stringify(Data);

    private static BusinessDataSnapshot FromEmpty()
    {
        return new BusinessDataSnapshot(new JsonObject(), new BusinessDataSnapshotReport
        {
            IsObject = false,
            PresentKeys = Array.Empty<string>(),
            MissingRequiredKeys = BusinessDataSnapshotCatalog.AllRequiredKeys.ToList(),
            HasAllRequiredKeys = false,
            HasPhonebook = false,
            HasAttachmentsIndex = false,
            HasRuntimeHandles = false,
            RuntimeHandleKeys = Array.Empty<string>(),
            StrippedForbiddenKeys = Array.Empty<string>()
        });
    }
}

/// <summary>Observed shape of a REQUIRED business snapshot. Does not assemble or persist.</summary>
public sealed class BusinessDataSnapshotReport
{
    public bool IsObject { get; init; }
    public IReadOnlyList<string> PresentKeys { get; init; } = Array.Empty<string>();
    public IReadOnlyList<string> MissingRequiredKeys { get; init; } = Array.Empty<string>();
    public bool HasAllRequiredKeys { get; init; }
    public bool HasPhonebook { get; init; }
    public bool HasAttachmentsIndex { get; init; }
    public bool HasRuntimeHandles { get; init; }
    public IReadOnlyList<string> RuntimeHandleKeys { get; init; } = Array.Empty<string>();
    public IReadOnlyList<string> StrippedForbiddenKeys { get; init; } = Array.Empty<string>();
}
