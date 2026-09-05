using System.Text.Json;
using System.Text.Json.Nodes;

namespace Sirman.Core.Backup;

/// <summary>
/// ARCH-19 transport document for attachmentsIndex metadata only.
/// JSON only. No browser APIs, no WebView2, no WinForms, no storage, no domain persist.
/// Does not walk parent collections, copy binary payloads, generate IDs, normalize, or repair.
/// </summary>
public sealed class AttachmentReferenceSnapshot
{
    private AttachmentReferenceSnapshot(JsonObject data, AttachmentReferenceSnapshotReport report)
    {
        Data = data;
        Report = report;
    }

    public JsonObject Data { get; }
    public AttachmentReferenceSnapshotReport Report { get; }

    public JsonArray Items =>
        Data[AttachmentReferenceSnapshotCatalog.IndexKey] as JsonArray ?? new JsonArray();

    public static AttachmentReferenceSnapshot Parse(JsonNode? node)
    {
        var clone = BackupJsonUtil.CloneExact(node);
        JsonArray? index = null;
        JsonObject? obj = clone as JsonObject;
        if (clone is JsonArray arr)
        {
            index = (JsonArray)BackupJsonUtil.CloneExact(arr)!;
            obj = new JsonObject();
        }
        else if (obj is not null && obj.ContainsKey(AttachmentReferenceSnapshotCatalog.IndexKey))
        {
            var raw = obj[AttachmentReferenceSnapshotCatalog.IndexKey];
            if (raw is JsonArray ia)
                index = (JsonArray)BackupJsonUtil.CloneExact(ia)!;
        }

        if (obj is null)
            return FromEmpty();

        var stripped = new List<string>();
        foreach (var key in AttachmentReferenceSnapshotCatalog.ForbiddenKeys)
        {
            if (obj.ContainsKey(key))
                stripped.Add(key);
        }

        var runtime = AttachmentReferenceSnapshotCatalog.ForbiddenRuntimeKeys
            .Where(obj.ContainsKey)
            .ToList();

        var data = new JsonObject();
        data[AttachmentReferenceSnapshotCatalog.IndexKey] = index ?? new JsonArray();

        var report = new AttachmentReferenceSnapshotReport
        {
            IsObject = clone is JsonObject,
            EntryCount = (data[AttachmentReferenceSnapshotCatalog.IndexKey] as JsonArray)?.Count ?? 0,
            HasPhonebook = obj.ContainsKey("phonebook") || obj.ContainsKey("pb"),
            HasRuntimeHandles = runtime.Count > 0,
            RuntimeHandleKeys = runtime,
            StrippedForbiddenKeys = stripped,
            BinaryPayloadExcluded = true
        };
        return new AttachmentReferenceSnapshot(data, report);
    }

    public static AttachmentReferenceSnapshot FromCanonicalJson(string? json)
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

    private static AttachmentReferenceSnapshot FromEmpty()
    {
        var data = new JsonObject
        {
            [AttachmentReferenceSnapshotCatalog.IndexKey] = new JsonArray()
        };
        return new AttachmentReferenceSnapshot(data, new AttachmentReferenceSnapshotReport
        {
            IsObject = false,
            EntryCount = 0,
            HasPhonebook = false,
            HasRuntimeHandles = false,
            RuntimeHandleKeys = Array.Empty<string>(),
            StrippedForbiddenKeys = Array.Empty<string>(),
            BinaryPayloadExcluded = true
        });
    }
}

/// <summary>Observed shape of an attachment-reference snapshot. Does not assemble or persist.</summary>
public sealed class AttachmentReferenceSnapshotReport
{
    public bool IsObject { get; init; }
    public int EntryCount { get; init; }
    public bool HasPhonebook { get; init; }
    public bool HasRuntimeHandles { get; init; }
    public IReadOnlyList<string> RuntimeHandleKeys { get; init; } = Array.Empty<string>();
    public IReadOnlyList<string> StrippedForbiddenKeys { get; init; } = Array.Empty<string>();
    public bool BinaryPayloadExcluded { get; init; }
}
