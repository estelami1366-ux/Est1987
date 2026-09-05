using System.Text.Json;
using System.Text.Json.Nodes;

namespace Sirman.Core.Backup;

/// <summary>
/// ARCH-22 transport document for the CURRENT Phonebook backup payload.
/// JSON only. No browser APIs, no WebView2, no WinForms, no storage, no domain persist.
/// Does not generate IDs, normalize phones, deduplicate, delete, or repair contacts.
/// </summary>
public sealed class PhonebookSnapshot
{
    private PhonebookSnapshot(JsonObject data, PhonebookSnapshotReport report)
    {
        Data = data;
        Report = report;
    }

    public JsonObject Data { get; }
    public PhonebookSnapshotReport Report { get; }
    public JsonArray Contacts => (Data["phonebook"] as JsonArray) ?? new JsonArray();

    public static PhonebookSnapshot Parse(JsonNode? node)
    {
        var clone = BackupJsonUtil.CloneExact(node);
        JsonArray? arr = null;
        JsonObject? obj = clone as JsonObject;
        var stripped = new List<string>();
        var runtime = new List<string>();

        if (clone is JsonArray direct)
        {
            arr = (JsonArray)BackupJsonUtil.CloneExact(direct)!;
        }
        else if (obj is not null)
        {
            foreach (var key in PhonebookSnapshotCatalog.ForbiddenKeys)
            {
                if (obj.ContainsKey(key)) stripped.Add(key);
            }
            runtime = PhonebookSnapshotCatalog.ForbiddenRuntimeKeys
                .Where(obj.ContainsKey)
                .ToList();
            if (obj.ContainsKey("phonebook") && obj["phonebook"] is JsonArray pb)
                arr = (JsonArray)BackupJsonUtil.CloneExact(pb)!;
            else if (obj.ContainsKey("pb") && obj["pb"] is JsonArray legacy &&
                     (!obj.ContainsKey("phonebook") || obj["phonebook"] is null ||
                      (obj["phonebook"] is JsonArray empty && empty.Count == 0)))
                arr = (JsonArray)BackupJsonUtil.CloneExact(legacy)!;
        }

        if (arr is null)
        {
            return FromEmpty(obj is not null, stripped, runtime);
        }

        var data = new JsonObject
        {
            ["phonebook"] = arr
        };

        var emptyPhone = 0;
        foreach (var rec in arr)
        {
            if (!HasRawPhoneIdentity(rec)) emptyPhone++;
        }

        var report = new PhonebookSnapshotReport
        {
            IsObject = true,
            Count = arr.Count,
            EmptyPhoneCount = emptyPhone,
            HasLegacyPb = obj is not null && obj.ContainsKey("pb"),
            HasRuntimeHandles = runtime.Count > 0,
            RuntimeHandleKeys = runtime,
            StrippedForbiddenKeys = stripped
        };
        return new PhonebookSnapshot(data, report);
    }

    public static PhonebookSnapshot FromCanonicalJson(string? json)
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

    public static bool HasRawPhoneIdentity(JsonNode? rec)
    {
        if (rec is not JsonObject obj) return false;
        if (obj["phones"] is JsonArray phones)
        {
            foreach (var p in phones)
            {
                if (p is null || p.GetValueKind() == JsonValueKind.Null) continue;
                if (p is JsonValue jv && jv.TryGetValue<string>(out var s) && s.Length > 0)
                    return true;
                if (p is JsonValue n && n.TryGetValue<double>(out _))
                    return true;
            }
        }
        if (obj["phone"] is JsonValue ph && ph.TryGetValue<string>(out var one) && one.Length > 0)
            return true;
        return false;
    }

    private static PhonebookSnapshot FromEmpty(bool isObject, List<string> stripped, List<string> runtime)
    {
        var data = new JsonObject { ["phonebook"] = new JsonArray() };
        return new PhonebookSnapshot(data, new PhonebookSnapshotReport
        {
            IsObject = isObject,
            Count = 0,
            EmptyPhoneCount = 0,
            HasLegacyPb = false,
            HasRuntimeHandles = runtime.Count > 0,
            RuntimeHandleKeys = runtime,
            StrippedForbiddenKeys = stripped
        });
    }
}

/// <summary>Observed shape of a Phonebook snapshot. Does not assemble, merge, or persist.</summary>
public sealed class PhonebookSnapshotReport
{
    public bool IsObject { get; init; }
    public int Count { get; init; }
    public int EmptyPhoneCount { get; init; }
    public bool HasLegacyPb { get; init; }
    public bool HasRuntimeHandles { get; init; }
    public IReadOnlyList<string> RuntimeHandleKeys { get; init; } = Array.Empty<string>();
    public IReadOnlyList<string> StrippedForbiddenKeys { get; init; } = Array.Empty<string>();
}
