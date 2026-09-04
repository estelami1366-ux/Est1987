using System.Text.Json.Nodes;

namespace Sirman.Core.Backup;

/// <summary>
/// Extraction of HTML <c>inferBackupSchemaVersion</c> / <c>requiredBackupCollectionsFor</c> /
/// <c>validateRequiredBackupCollections</c>. Does not mutate input. Does not coerce missing keys to [].
/// </summary>
public static class BackupRequiredCollections
{
    public static int InferSchemaVersion(JsonNode? data)
    {
        if (!BackupJsonUtil.IsPackageObject(data)) return 0;
        var obj = (JsonObject)data!;
        if (obj.ContainsKey("schemaVersion"))
        {
            var sv = obj["schemaVersion"];
            if (!BackupJsonUtil.IsNullish(sv) && !(sv is JsonValue empty && empty.TryGetValue<string>(out var s) && s == ""))
            {
                if (BackupJsonUtil.TryParseInt10(sv, out var n)) return n;
            }
        }
        if (obj["manifest"] is JsonObject man && man.ContainsKey("schemaVersion"))
        {
            if (BackupJsonUtil.TryParseInt10(man["schemaVersion"], out var m)) return m;
        }
        return 0;
    }

    public static IReadOnlyList<string> RequiredFor(JsonNode? data)
    {
        var keys = new List<string>(RequiredCollectionsRegistry.Always);
        var ver = InferSchemaVersion(data);
        foreach (var kv in RequiredCollectionsRegistry.FromSchema)
        {
            if (ver >= kv.Key)
            {
                foreach (var k in kv.Value)
                {
                    if (!keys.Contains(k)) keys.Add(k);
                }
            }
        }
        return keys;
    }

    public static BackupValidationResult Validate(JsonNode? data)
    {
        var errors = new List<string>();
        var missing = new List<string>();
        var invalid = new List<string>();
        if (!BackupJsonUtil.IsPackageObject(data))
        {
            errors.Add("بستهٔ پشتیبان نامعتبر است");
            return new BackupValidationResult
            {
                Ok = false,
                Status = BackupValidationStatus.INVALID,
                Errors = errors,
                MissingRequiredCollections = missing,
                InvalidCollections = invalid,
                SchemaVersion = InferSchemaVersion(data),
                RequiredKeys = RequiredFor(data)
            };
        }

        var obj = (JsonObject)data!;
        var required = RequiredFor(data);
        foreach (var key in required)
        {
            if (!obj.ContainsKey(key))
            {
                missing.Add(key);
                errors.Add("مجموعهٔ الزامی «" + key + "» در فایل پشتیبان وجود ندارد (MISSING ≠ EMPTY)");
                continue;
            }
            var val = obj[key];
            if (BackupJsonUtil.IsNullish(val))
            {
                invalid.Add(key);
                errors.Add("مجموعهٔ الزامی «" + key + "» مقدار null دارد و قابل بازگردانی نیست");
                continue;
            }
            if (val is not JsonArray arr)
            {
                invalid.Add(key);
                errors.Add("مجموعهٔ الزامی «" + key + "» باید آرایه باشد، نه " + BackupJsonUtil.JsTypeof(val));
                continue;
            }
            for (var j = 0; j < arr.Count; j++)
            {
                var rec = arr[j];
                if (rec is null || rec is JsonArray || rec is not JsonObject)
                {
                    invalid.Add(key);
                    errors.Add("مجموعهٔ الزامی «" + key + "» در اندیس " + j + " رکورد ساختاری نامعتبر دارد");
                    break;
                }
            }
        }

        return new BackupValidationResult
        {
            Ok = errors.Count == 0,
            Status = BackupJsonUtil.StatusOf(errors.Count == 0, Array.Empty<string>()),
            Errors = errors,
            MissingRequiredCollections = missing,
            InvalidCollections = invalid,
            SchemaVersion = InferSchemaVersion(data),
            RequiredKeys = required
        };
    }
}
