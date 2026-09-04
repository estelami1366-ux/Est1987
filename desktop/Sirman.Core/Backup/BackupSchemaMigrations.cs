using System.Text.Json;
using System.Text.Json.Nodes;

namespace Sirman.Core.Backup;

/// <summary>
/// Extraction of HTML <c>SCHEMA_MIGRATIONS</c> / <c>applySchemaMigrations</c> /
/// <c>collectAttachmentIndex</c> / <c>buildBackupManifest</c>. Clones input first.
/// The only schema step in this app version is 0→1 (<c>add-package-manifest</c>).
/// </summary>
internal static class BackupSchemaMigrations
{
    public const int AppSchemaVersion = 1;
    public const string Magic = "SIRMAN_BACKUP";
    public const string TooNewReason =
        "این بک‌آپ با Schema جدیدتر از این نسخه ساخته شده و بدون Migration معکوس باز نمی‌شود";
    public const string DocumentedFormat =
        "JSON مستقل از نسخه برنامه: داده + تنظیمات + پیوست‌ها + Manifest + Checksum. Schema Version عدد صحیح جدا از applicationVersion است.";

    public static SchemaMigrationResult Apply(JsonNode? data, int? targetVer = null)
    {
        var d = BackupJsonUtil.CloneBackupData(data);
        var target = targetVer ?? AppSchemaVersion;
        if (targetVer is int tv)
        {
            // parseInt(NaN) fallback: HTML uses parseInt then isNaN → SIRMAN_SCHEMA_VERSION
            target = tv;
        }

        var from = BackupRequiredCollections.InferSchemaVersion(d);
        var startFrom = from;
        var log = new List<string>();
        var gate = CanRestoreSchema(from, target);
        if (!gate.ok)
        {
            return new SchemaMigrationResult
            {
                Ok = false,
                TooNew = true,
                From = from,
                To = target,
                Data = d,
                Log = log,
                Reason = gate.reason
            };
        }

        if (d is not JsonObject obj)
        {
            return new SchemaMigrationResult
            {
                Ok = true,
                From = startFrom,
                To = from,
                Data = d,
                Log = log
            };
        }

        var guard = 0;
        while (from < target && guard < 50)
        {
            guard++;
            if (from != 0)
            {
                log.Add("Migration از Schema " + from + " پیدا نشد");
                break;
            }

            RunZeroToOne(obj, log);
            from = 1;
            obj["schemaVersion"] = 1;
        }

        var inferred = BackupRequiredCollections.InferSchemaVersion(obj);
        var finalVer = Math.Max(from, inferred);
        obj["schemaVersion"] = finalVer;
        return new SchemaMigrationResult
        {
            Ok = true,
            TooNew = false,
            From = startFrom,
            To = finalVer,
            Data = obj,
            Log = log
        };
    }

    public static (bool ok, string direction, string reason) CanRestoreSchema(int fileVer, int appVer)
    {
        if (fileVer <= appVer)
            return (true, fileVer < appVer ? "upgrade" : "same", "");
        return (false, "downgrade", TooNewReason);
    }

    internal static void RunZeroToOne(JsonObject d, List<string> log)
    {
        if (BackupJsonUtil.IsJsFalsy(d.ContainsKey("magic") ? d["magic"] : null))
            d["magic"] = Magic;
        d["schemaVersion"] = 1;

        if (BackupJsonUtil.IsJsFalsy(d.ContainsKey("sales") ? d["sales"] : null))
        {
            d["sales"] = new JsonArray();
            log.Add("Schema ۰→۱: فروش غایب → [] (سازگاری نسخه قدیمی؛ Schema ≥۱ این تبدیل را ندارد)");
        }
        if (BackupJsonUtil.IsJsFalsy(d.ContainsKey("parts") ? d["parts"] : null))
        {
            d["parts"] = new JsonArray();
            log.Add("Schema ۰→۱: قطعات غایب → [] (سازگاری نسخه قدیمی؛ Schema ≥۱ این تبدیل را ندارد)");
        }
        if (BackupJsonUtil.IsJsFalsy(d.ContainsKey("accounts") ? d["accounts"] : null))
        {
            d["accounts"] = new JsonArray();
            log.Add("Schema ۰→۱: حساب‌ها غایب → [] (سازگاری نسخه قدیمی؛ Schema ≥۱ این تبدیل را ندارد)");
        }
        if (BackupJsonUtil.IsJsFalsy(d.ContainsKey("attachmentsIndex") ? d["attachmentsIndex"] : null))
            d["attachmentsIndex"] = CollectAttachmentIndex(d);
        if (BackupJsonUtil.IsJsFalsy(d.ContainsKey("manifest") ? d["manifest"] : null))
        {
            var originArg = OrString(d.ContainsKey("origin") ? d["origin"] : null, "unknown");
            var kind = !BackupJsonUtil.IsJsFalsy(d.ContainsKey("partial") ? d["partial"] : null) ? "partial" : "full";
            d["manifest"] = BuildBackupManifest(d, originArg, kind);
        }
        log.Add("Schema ۰→۱: Manifest و فهرست پیوست اضافه شد");
    }

    internal static JsonArray CollectAttachmentIndex(JsonNode? d)
    {
        var refs = new JsonArray();
        Walk(d is JsonObject o ? o["warranties"] : null, "warranty", refs);
        Walk(d is JsonObject o2 ? o2["sales"] : null, "sale", refs);
        Walk(d is JsonObject o3 ? o3["invoices"] : null, "invoice", refs);
        return refs;
    }

    private static void Walk(JsonNode? arr, string kind, JsonArray refs)
    {
        if (BackupJsonUtil.IsJsFalsy(arr))
        {
            return;
        }
        if (arr is not JsonArray list)
            throw new BackupMigrationException("(arr||[]).forEach is not a function");
        for (var r = 0; r < list.Count; r++)
        {
            var rec = list[r];
            var docs = rec is JsonObject ro ? (ro["docs"] ?? ro["attachments"]) : null;
            if (docs is not JsonArray && rec is JsonObject recObj && recObj["docs"] is JsonObject docMap)
            {
                foreach (var kv in docMap)
                {
                    var inner = kv.Value;
                    if (BackupJsonUtil.IsJsFalsy(inner)) inner = new JsonArray();
                    if (inner is not JsonArray innerArr)
                        throw new BackupMigrationException("(rec.docs[k]||[]).forEach is not a function");
                    for (var i = 0; i < innerArr.Count; i++)
                        PushDoc(kind, recObj["id"], innerArr[i], i, refs);
                }
                continue;
            }
            var listDocs = BackupJsonUtil.IsJsFalsy(docs) ? new JsonArray() : docs;
            if (listDocs is not JsonArray da)
                throw new BackupMigrationException("(docs||[]).forEach is not a function");
            for (var i = 0; i < da.Count; i++)
                PushDoc(kind, rec is JsonObject recO ? recO["id"] : null, da[i], i, refs);
        }
    }

    private static void PushDoc(string kind, JsonNode? parentIdNode, JsonNode? doc, int i, JsonArray refs)
    {
        if (BackupJsonUtil.IsJsFalsy(doc)) return;
        if (doc is not JsonObject dobj) return;
        var data = FirstTruthy(dobj["data"], dobj["src"], dobj["ref"]);
        var dataStr = data is not null && data.GetValueKind() == JsonValueKind.String
            ? (data.GetValue<string>() ?? "")
            : "";
        var isDisk = data is not null && data.GetValueKind() == JsonValueKind.String &&
                     (dataStr.StartsWith("disk:", StringComparison.Ordinal) ||
                      dataStr.StartsWith("idb:", StringComparison.Ordinal));
        var idNode = dobj.ContainsKey("id") ? dobj["id"] : null;
        string id;
        if (!BackupJsonUtil.IsJsFalsy(idNode))
        {
            id = BackupJsonUtil.Str(idNode);
        }
        else
        {
            var parentStr = BackupJsonUtil.IsJsFalsy(parentIdNode) ? "" : BackupJsonUtil.Str(parentIdNode);
            id = kind + "-" + parentStr + "-" + i;
        }

        var item = new JsonObject
        {
            ["id"] = id,
            ["name"] = BackupJsonUtil.IsJsFalsy(dobj.ContainsKey("name") ? dobj["name"] : null) ? "" : BackupJsonUtil.Str(dobj["name"]),
            ["ref"] = isDisk ? dataStr : "",
            ["inline"] = !isDisk && !BackupJsonUtil.IsJsFalsy(data),
            ["kind"] = kind,
            ["parentId"] = BackupJsonUtil.IsJsFalsy(parentIdNode) ? "" : BackupJsonUtil.Str(parentIdNode)
        };
        refs.Add(item);
    }

    internal static JsonObject BuildBackupManifest(JsonObject data, string origin, string kind)
    {
        var applicationVersion = FirstTruthyString(data.ContainsKey("version") ? data["version"] : null,
            data.ContainsKey("applicationVersion") ? data["applicationVersion"] : null);
        var exportedAt = !BackupJsonUtil.IsJsFalsy(data.ContainsKey("exportedAt") ? data["exportedAt"] : null)
            ? BackupJsonUtil.Str(data["exportedAt"])
            : "";
        var originOut = !string.IsNullOrEmpty(origin)
            ? origin
            : (!BackupJsonUtil.IsJsFalsy(data.ContainsKey("origin") ? data["origin"] : null)
                ? BackupJsonUtil.Str(data["origin"])
                : "manual");
        JsonNode itemCounts = data.ContainsKey("itemCounts") && !BackupJsonUtil.IsJsFalsy(data["itemCounts"])
            ? BackupJsonUtil.CloneExact(data["itemCounts"])!
            : new JsonObject();
        JsonNode sections = data.ContainsKey("sections") && !BackupJsonUtil.IsJsFalsy(data["sections"])
            ? BackupJsonUtil.CloneExact(data["sections"])!
            : new JsonArray();

        return new JsonObject
        {
            ["magic"] = Magic,
            ["format"] = 1,
            ["schemaVersion"] = AppSchemaVersion,
            ["applicationVersion"] = applicationVersion,
            ["exportedAt"] = exportedAt,
            ["origin"] = originOut,
            ["kind"] = kind,
            ["itemCounts"] = itemCounts,
            ["sections"] = sections,
            ["encrypted"] = !BackupJsonUtil.IsJsFalsy(data.ContainsKey("encrypted") ? data["encrypted"] : null),
            ["immutable"] = !BackupJsonUtil.IsJsFalsy(data.ContainsKey("immutable") ? data["immutable"] : null),
            ["documentedFormat"] = DocumentedFormat
        };
    }

    private static string OrString(JsonNode? n, string fallback) =>
        BackupJsonUtil.IsJsFalsy(n) ? fallback : BackupJsonUtil.Str(n);

    private static string FirstTruthyString(JsonNode? a, JsonNode? b)
    {
        if (!BackupJsonUtil.IsJsFalsy(a)) return BackupJsonUtil.Str(a);
        if (!BackupJsonUtil.IsJsFalsy(b)) return BackupJsonUtil.Str(b);
        return "";
    }

    private static JsonNode? FirstTruthy(params JsonNode?[] nodes)
    {
        foreach (var n in nodes)
        {
            if (!BackupJsonUtil.IsJsFalsy(n)) return n;
        }
        return null;
    }
}
