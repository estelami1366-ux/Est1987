using System.Text.Json;
using System.Text.Json.Nodes;

namespace Sirman.Core.Backup;

/// <summary>
/// ARCH-14 transport document for the LS-based backup settings slice.
/// JSON only. No browser-storage APIs, no RAM collections, no UI, no desktop host types,
/// no Date.now, no domain entities. Defaults/normalization happen in the HTML adapter.
/// </summary>
public sealed class BackupSettingsSnapshot
{
    private BackupSettingsSnapshot(JsonObject data, BackupSettingsSnapshotReport report)
    {
        Data = data;
        Report = report;
    }

    public JsonObject Data { get; }
    public BackupSettingsSnapshotReport Report { get; }

    public JsonNode? Field(string name) =>
        Data.ContainsKey(name) ? Data[name] : null;

    public JsonObject? Appearance => Field("appearance") as JsonObject;
    public JsonObject? AiKeys => Field("aiKeys") as JsonObject;
    public JsonObject? PrintSettings => Field("printSettings") as JsonObject;
    public JsonObject? PrintCenter => Field("printCenter") as JsonObject;
    public JsonObject? Company => Field("company") as JsonObject;
    public JsonObject? Prefs => Field("prefs") as JsonObject;
    public JsonObject? NetworkSettings => Field("networkSettings") as JsonObject;
    public JsonArray? StarredAlarms => Field("starredAlarms") as JsonArray;
    public string Tz => BackupJsonUtil.Str(Field("tz"));

    public static BackupSettingsSnapshot Parse(JsonNode? node)
    {
        var clone = BackupJsonUtil.CloneExact(node);
        if (clone is not JsonObject obj)
            return FromEmpty();

        var stripped = new List<string>();
        foreach (var key in BackupSettingsSnapshotCatalog.ForbiddenBusinessKeys)
        {
            if (obj.ContainsKey(key))
                stripped.Add(key);
        }

        var runtime = BackupSettingsSnapshotCatalog.ForbiddenRuntimeKeys
            .Where(obj.ContainsKey)
            .ToList();

        var data = new JsonObject();
        foreach (var key in BackupSettingsSnapshotCatalog.AllSettingsKeys)
        {
            if (!obj.ContainsKey(key)) continue;
            data[key] = BackupJsonUtil.CloneExact(obj[key]);
        }

        var present = data.Select(kv => kv.Key).ToList();
        var missing = BackupSettingsSnapshotCatalog.BaseSettingsKeys
            .Where(k => !data.ContainsKey(k))
            .ToList();

        var report = new BackupSettingsSnapshotReport
        {
            IsObject = true,
            PresentKeys = present,
            MissingBaseKeys = missing,
            HasAllBaseSettingsKeys = missing.Count == 0,
            HasPrintCenter = data.ContainsKey("printCenter"),
            HasAiKeys = data["aiKeys"] is JsonObject,
            HasRuntimeHandles = runtime.Count > 0,
            RuntimeHandleKeys = runtime,
            StrippedBusinessKeys = stripped,
            SensitivePayloadKeysPresent = BackupSettingsSnapshotCatalog.SensitivePayloadKeys
                .Where(data.ContainsKey)
                .ToList()
        };
        return new BackupSettingsSnapshot(data, report);
    }

    public static BackupSettingsSnapshot FromCanonicalJson(string? json)
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

    private static BackupSettingsSnapshot FromEmpty()
    {
        return new BackupSettingsSnapshot(new JsonObject(), new BackupSettingsSnapshotReport
        {
            IsObject = false,
            PresentKeys = Array.Empty<string>(),
            MissingBaseKeys = BackupSettingsSnapshotCatalog.BaseSettingsKeys.ToList(),
            HasAllBaseSettingsKeys = false,
            HasPrintCenter = false,
            HasAiKeys = false,
            HasRuntimeHandles = false,
            RuntimeHandleKeys = Array.Empty<string>(),
            StrippedBusinessKeys = Array.Empty<string>(),
            SensitivePayloadKeysPresent = Array.Empty<string>()
        });
    }
}

/// <summary>Observed shape of a settings snapshot. Does not assemble or persist.</summary>
public sealed class BackupSettingsSnapshotReport
{
    public bool IsObject { get; init; }
    public IReadOnlyList<string> PresentKeys { get; init; } = Array.Empty<string>();
    public IReadOnlyList<string> MissingBaseKeys { get; init; } = Array.Empty<string>();
    public bool HasAllBaseSettingsKeys { get; init; }
    public bool HasPrintCenter { get; init; }
    public bool HasAiKeys { get; init; }
    public bool HasRuntimeHandles { get; init; }
    public IReadOnlyList<string> RuntimeHandleKeys { get; init; } = Array.Empty<string>();
    public IReadOnlyList<string> StrippedBusinessKeys { get; init; } = Array.Empty<string>();
    public IReadOnlyList<string> SensitivePayloadKeysPresent { get; init; } = Array.Empty<string>();
}
