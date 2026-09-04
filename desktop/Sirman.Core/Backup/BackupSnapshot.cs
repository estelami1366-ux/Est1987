using System.Text.Json;
using System.Text.Json.Nodes;

namespace Sirman.Core.Backup;

/// <summary>
/// ARCH-9B transport document for an assembled (or finalized) backup JSON object.
/// Clones input. Does not read browser storage, Host, or live RAM.
/// Business collections stay as JSON arrays/objects — no per-record domain types.
/// </summary>
public sealed class BackupSnapshot
{
    private BackupSnapshot(JsonObject data)
    {
        Data = data;
        Metadata = ReadMetadata(data);
        ItemCounts = ReadItemCounts(data);
        Appearance = ReadAppearance(data);
        Shape = Inspect(data);
    }

    public JsonObject Data { get; }
    public BackupSnapshotMetadata Metadata { get; }
    public BackupSnapshotItemCounts ItemCounts { get; }
    public BackupSnapshotAppearance Appearance { get; }
    public BackupSnapshotShapeReport Shape { get; }

    public JsonNode? Collection(string name) =>
        Data.ContainsKey(name) ? Data[name] : null;

    public JsonArray? ArrayCollection(string name) => Collection(name) as JsonArray;

    public static BackupSnapshot Parse(JsonNode? node)
    {
        var clone = BackupJsonUtil.CloneExact(node);
        if (clone is JsonObject obj)
            return new BackupSnapshot(obj);
        return new BackupSnapshot(new JsonObject());
    }

    /// <summary>Deep clone of the document. Caller mutation does not affect this snapshot.</summary>
    public JsonObject ToJson() => (JsonObject)BackupJsonUtil.CloneExact(Data)!;

    /// <summary>HTML-canonical compact JSON. Key order is preserved, not sorted.</summary>
    public string ToCanonicalJson() => BackupJsJson.Stringify(Data);

    public static BackupSnapshot FromCanonicalJson(string json)
    {
        JsonNode? node = null;
        if (!string.IsNullOrEmpty(json))
        {
            try { node = JsonNode.Parse(json); }
            catch (JsonException) { node = null; }
        }
        return Parse(node);
    }

    public static BackupSnapshotShapeReport Inspect(JsonObject data)
    {
        var present = data.Select(kv => kv.Key).ToList();
        var missing = BackupSnapshotCatalog.BasePayloadKeys.Where(k => !data.ContainsKey(k)).ToList();
        var runtime = BackupSnapshotCatalog.ForbiddenRuntimeKeys.Where(data.ContainsKey).ToList();
        var sections = ReadStringList(data, "sections");
        var catalog = BackupSnapshotCatalog.SectionsCatalog;
        var sectionsMatch = sections.Count == catalog.Count
            && sections.Zip(catalog, (a, b) => a == b).All(x => x);
        var hasPc = data.ContainsKey("printCenter");
        var hasAtt = data.ContainsKey("attachmentsIndex");
        var phonebook = data.ContainsKey(BackupSnapshotCatalog.PhonebookSection);
        return new BackupSnapshotShapeReport
        {
            IsObject = true,
            PresentKeyCount = present.Count,
            HasAllBasePayloadKeys = missing.Count == 0,
            MissingBaseKeys = missing,
            HasPrintCenter = hasPc,
            HasAttachmentsIndex = hasAtt,
            IsTypical51KeySnapshot = missing.Count == 0 && hasPc && hasAtt && present.Count >= 51,
            PhonebookPresent = phonebook,
            PhonebookIsArray = data[BackupSnapshotCatalog.PhonebookSection] is JsonArray,
            HasRuntimeHandles = runtime.Count > 0,
            RuntimeHandleKeys = runtime,
            Sections = sections,
            SectionsMatchCatalog = sectionsMatch
        };
    }

    private static BackupSnapshotMetadata ReadMetadata(JsonObject data)
    {
        var schemaPresent = data.ContainsKey("schemaVersion");
        var schema = 0;
        if (schemaPresent)
            BackupJsonUtil.TryParseInt10(data["schemaVersion"], out schema);
        var checksum = BackupJsonUtil.Str(data.ContainsKey("checksum") ? data["checksum"] : null);
        var algo = BackupJsonUtil.Str(data.ContainsKey("checksumAlgo") ? data["checksumAlgo"] : null);
        return new BackupSnapshotMetadata
        {
            Magic = BackupJsonUtil.Str(data.ContainsKey("magic") ? data["magic"] : null),
            SchemaVersion = schema,
            SchemaVersionPresent = schemaPresent,
            Version = BackupJsonUtil.Str(data.ContainsKey("version") ? data["version"] : null),
            ApplicationVersion = BackupJsonUtil.Str(data.ContainsKey("applicationVersion") ? data["applicationVersion"] : null),
            ExportedAt = BackupJsonUtil.Str(data.ContainsKey("exportedAt") ? data["exportedAt"] : null),
            Origin = BackupJsonUtil.Str(data.ContainsKey("origin") ? data["origin"] : null),
            OriginPresent = data.ContainsKey("origin"),
            HasChecksum = data.ContainsKey("checksum") && checksum.Length > 0,
            ChecksumAlgo = algo,
            HasManifest = data["manifest"] is JsonObject,
            HasSectionChecksums = data["sectionChecksums"] is JsonObject
        };
    }

    private static BackupSnapshotItemCounts ReadItemCounts(JsonObject data)
    {
        if (data["itemCounts"] is not JsonObject ic)
        {
            return new BackupSnapshotItemCounts { Present = data.ContainsKey("itemCounts") };
        }
        var clone = (JsonObject)BackupJsonUtil.CloneExact(ic)!;
        return new BackupSnapshotItemCounts
        {
            Data = clone,
            DeclaredKeys = clone.Select(kv => kv.Key).ToList(),
            Present = true
        };
    }

    private static BackupSnapshotAppearance ReadAppearance(JsonObject data)
    {
        if (data["appearance"] is not JsonObject ap)
            return new BackupSnapshotAppearance { Present = data.ContainsKey("appearance") };
        return new BackupSnapshotAppearance
        {
            Data = (JsonObject)BackupJsonUtil.CloneExact(ap)!,
            Present = true
        };
    }

    private static IReadOnlyList<string> ReadStringList(JsonObject data, string key)
    {
        if (data[key] is not JsonArray arr)
            return Array.Empty<string>();
        return arr.Select(BackupJsonUtil.Str).ToList();
    }
}
