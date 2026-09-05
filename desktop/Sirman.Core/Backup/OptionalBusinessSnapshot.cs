using System.Text.Json;
using System.Text.Json.Nodes;

namespace Sirman.Core.Backup;

/// <summary>
/// ARCH-18 transport document for OPTIONAL business backup collections.
/// JSON only. No browser APIs, no WebView2, no WinForms, no storage, no domain persist.
/// Does not generate IDs, normalize, deduplicate, or repair records.
/// </summary>
public sealed class OptionalBusinessSnapshot
{
    private OptionalBusinessSnapshot(JsonObject data, OptionalBusinessSnapshotReport report)
    {
        Data = data;
        Report = report;
    }

    public JsonObject Data { get; }
    public OptionalBusinessSnapshotReport Report { get; }

    public JsonNode? Field(string name) =>
        Data.ContainsKey(name) ? Data[name] : null;

    public JsonArray? Products => Field("products") as JsonArray;
    public JsonObject? Inventory => Field("inventory") as JsonObject;
    public JsonArray? Services => Field("services") as JsonArray;
    public JsonArray? Svcs => Field("svcs") as JsonArray;
    public JsonArray? Tasks => Field("tasks") as JsonArray;
    public JsonArray? DefectiveStock => Field("defectiveStock") as JsonArray;
    public JsonArray? WarehouseDocs => Field("warehouseDocs") as JsonArray;
    public JsonArray? StockMoves => Field("stockMoves") as JsonArray;
    public JsonArray? Warehouses => Field("warehouses") as JsonArray;
    public JsonArray? Daqi => Field("daqi") as JsonArray;
    public JsonArray? DaqiWarehouse => Field("daqiWarehouse") as JsonArray;
    public JsonArray? DaqiVouchers => Field("daqiVouchers") as JsonArray;
    public JsonArray? PostalHistory => Field("postalHistory") as JsonArray;

    public static OptionalBusinessSnapshot Parse(JsonNode? node)
    {
        var clone = BackupJsonUtil.CloneExact(node);
        if (clone is not JsonObject obj)
            return FromEmpty();

        var stripped = new List<string>();
        foreach (var key in OptionalBusinessSnapshotCatalog.ForbiddenKeys)
        {
            if (obj.ContainsKey(key))
                stripped.Add(key);
        }

        var runtime = OptionalBusinessSnapshotCatalog.ForbiddenRuntimeKeys
            .Where(obj.ContainsKey)
            .ToList();

        var data = new JsonObject();
        foreach (var key in OptionalBusinessSnapshotCatalog.AllOptionalKeys)
        {
            if (!obj.ContainsKey(key)) continue;
            data[key] = BackupJsonUtil.CloneExact(obj[key]);
        }

        var present = data.Select(kv => kv.Key).ToList();
        var missing = OptionalBusinessSnapshotCatalog.AllOptionalKeys
            .Where(k => !data.ContainsKey(k))
            .ToList();

        var report = new OptionalBusinessSnapshotReport
        {
            IsObject = true,
            PresentKeys = present,
            MissingOptionalKeys = missing,
            HasAllOptionalKeys = missing.Count == 0,
            HasPhonebook = obj.ContainsKey("phonebook") || obj.ContainsKey("pb"),
            HasAttachmentsIndex = obj.ContainsKey("attachmentsIndex"),
            HasRuntimeHandles = runtime.Count > 0,
            RuntimeHandleKeys = runtime,
            StrippedForbiddenKeys = stripped
        };
        return new OptionalBusinessSnapshot(data, report);
    }

    public static OptionalBusinessSnapshot FromCanonicalJson(string? json)
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

    private static OptionalBusinessSnapshot FromEmpty()
    {
        return new OptionalBusinessSnapshot(new JsonObject(), new OptionalBusinessSnapshotReport
        {
            IsObject = false,
            PresentKeys = Array.Empty<string>(),
            MissingOptionalKeys = OptionalBusinessSnapshotCatalog.AllOptionalKeys.ToList(),
            HasAllOptionalKeys = false,
            HasPhonebook = false,
            HasAttachmentsIndex = false,
            HasRuntimeHandles = false,
            RuntimeHandleKeys = Array.Empty<string>(),
            StrippedForbiddenKeys = Array.Empty<string>()
        });
    }
}

/// <summary>Observed shape of an OPTIONAL business snapshot. Does not assemble or persist.</summary>
public sealed class OptionalBusinessSnapshotReport
{
    public bool IsObject { get; init; }
    public IReadOnlyList<string> PresentKeys { get; init; } = Array.Empty<string>();
    public IReadOnlyList<string> MissingOptionalKeys { get; init; } = Array.Empty<string>();
    public bool HasAllOptionalKeys { get; init; }
    public bool HasPhonebook { get; init; }
    public bool HasAttachmentsIndex { get; init; }
    public bool HasRuntimeHandles { get; init; }
    public IReadOnlyList<string> RuntimeHandleKeys { get; init; } = Array.Empty<string>();
    public IReadOnlyList<string> StrippedForbiddenKeys { get; init; } = Array.Empty<string>();
}
