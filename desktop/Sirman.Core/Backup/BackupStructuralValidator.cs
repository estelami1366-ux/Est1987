using System.Text.Json.Nodes;

namespace Sirman.Core.Backup;

/// <summary>
/// Extraction of HTML P1C-6 structural checks: itemCounts, attachmentsIndex, duplicate identities.
/// Duplicate identity is WARNING only. Phonebook is not scanned. Input is not mutated.
/// </summary>
public static class BackupStructuralValidator
{
    public static BackupValidationResult ValidateItemCounts(JsonNode? data)
    {
        var errors = new List<string>();
        var mismatches = new List<string>();
        if (!BackupJsonUtil.IsPackageObject(data))
        {
            return EmptyOk(countMismatches: mismatches);
        }
        var obj = (JsonObject)data!;
        if (!obj.ContainsKey("itemCounts"))
            return EmptyOk(countMismatches: mismatches);

        var ic = obj["itemCounts"];
        if (ic is null || ic is JsonArray || ic is not JsonObject icObj)
        {
            errors.Add("itemCounts باید شیء شمارش باشد، نه " + BackupJsonUtil.JsTypeName(ic));
            return new BackupValidationResult
            {
                Ok = false,
                Status = BackupValidationStatus.INVALID,
                Errors = errors,
                CountMismatches = mismatches
            };
        }

        foreach (var kv in icObj)
        {
            var declaredNode = kv.Value;
            if (!BackupJsonUtil.TryGetFiniteNumber(declaredNode, out var declared))
            {
                errors.Add("itemCounts." + kv.Key + " نوع نامعتبر است");
                mismatches.Add(kv.Key);
                continue;
            }
            if (!obj.ContainsKey(kv.Key) || obj[kv.Key] is not JsonArray arr)
            {
                errors.Add("شمارش " + kv.Key + " ناهماهنگ است: اعلام " + FormatDeclared(declared) + " ولی مجموعه آرایه نیست");
                mismatches.Add(kv.Key);
                continue;
            }
            if (arr.Count != declared)
            {
                errors.Add("شمارش " + kv.Key + " ناهماهنگ است: اعلام " + FormatDeclared(declared) + " ولی واقعیت " + arr.Count);
                mismatches.Add(kv.Key);
            }
        }

        return new BackupValidationResult
        {
            Ok = errors.Count == 0,
            Status = BackupJsonUtil.StatusOf(errors.Count == 0, Array.Empty<string>()),
            Errors = errors,
            CountMismatches = mismatches
        };
    }

    public static BackupValidationResult ValidateAttachmentIndex(JsonNode? data)
    {
        var errors = new List<string>();
        var broken = new List<BrokenAttachmentRef>();
        if (!BackupJsonUtil.IsPackageObject(data))
            return EmptyOk();
        var obj = (JsonObject)data!;
        if (!obj.ContainsKey("attachmentsIndex"))
            return EmptyOk();

        var idx = obj["attachmentsIndex"];
        if (idx is not JsonArray arr)
        {
            errors.Add("attachmentsIndex باید آرایه باشد، نه " + BackupJsonUtil.JsTypeName(idx));
            return new BackupValidationResult
            {
                Ok = false,
                Status = BackupValidationStatus.INVALID,
                Errors = errors,
                BrokenAttachmentRefs = broken
            };
        }

        var kindToSection = new Dictionary<string, string>
        {
            ["warranty"] = "warranties",
            ["sale"] = "sales",
            ["invoice"] = "invoices"
        };

        for (var i = 0; i < arr.Count; i++)
        {
            var entry = arr[i];
            if (entry is not JsonObject rec) continue;
            var kind = BackupJsonUtil.Str(rec["kind"]);
            if (!kindToSection.TryGetValue(kind, out var section)) continue;
            var pid = BackupJsonUtil.Str(rec["parentId"]).Trim();
            if (pid.Length == 0) continue;
            if (obj[section] is not JsonArray sectionArr)
            {
                broken.Add(new BrokenAttachmentRef { Index = i, Kind = kind, ParentId = pid });
                errors.Add("پیوست به والد ناموجود: " + kind + " " + pid);
                continue;
            }
            var found = false;
            foreach (var row in sectionArr)
            {
                if (row is JsonObject recObj && BackupJsonUtil.Str(recObj["id"]) == pid)
                {
                    found = true;
                    break;
                }
            }
            if (!found)
            {
                broken.Add(new BrokenAttachmentRef { Index = i, Kind = kind, ParentId = pid });
                errors.Add("پیوست به والد ناموجود: " + kind + " " + pid);
            }
        }

        return new BackupValidationResult
        {
            Ok = errors.Count == 0,
            Status = BackupJsonUtil.StatusOf(errors.Count == 0, Array.Empty<string>()),
            Errors = errors,
            BrokenAttachmentRefs = broken
        };
    }

    public static BackupValidationResult DetectDuplicateIdentities(JsonNode? data)
    {
        var warnings = new List<string>();
        var dups = new List<DuplicateIdentity>();
        if (data is JsonObject obj)
        {
            Scan(obj["invoices"] as JsonArray, r => FirstNonEmpty(r, "invoiceId", "InvoiceId"), "invoices", "invoiceId", dups);
            Scan(obj["sales"] as JsonArray, r => FirstNonEmpty(r, "saleUid", "SaleUid"), "sales", "saleUid", dups);
            Scan(obj["warranties"] as JsonArray, r => FirstNonEmpty(r, "id"), "warranties", "id", dups);
            Scan(obj["accounts"] as JsonArray, r => FirstNonEmpty(r, "id"), "accounts", "id", dups);
            Scan(obj["parts"] as JsonArray, r => FirstNonEmpty(r, "id"), "parts", "id", dups);
        }
        if (dups.Count > 0)
            warnings.Add("شناسه تکراری اعلام‌شده: " + dups.Count + " مورد (بدون تغییر داده)");
        return new BackupValidationResult
        {
            Ok = true,
            Status = BackupJsonUtil.StatusOf(true, warnings),
            Warnings = warnings,
            DuplicateIdentities = dups
        };
    }

    public static BackupValidationResult Validate(JsonNode? data)
    {
        var req = BackupRequiredCollections.Validate(data);
        var counts = ValidateItemCounts(data);
        var atts = ValidateAttachmentIndex(data);
        var dups = DetectDuplicateIdentities(data);
        var errors = req.Errors.Concat(counts.Errors).Concat(atts.Errors).Concat(dups.Errors).ToList();
        var warnings = req.Warnings.Concat(counts.Warnings).Concat(atts.Warnings).Concat(dups.Warnings).ToList();
        return new BackupValidationResult
        {
            Ok = errors.Count == 0,
            Status = BackupJsonUtil.StatusOf(errors.Count == 0, warnings),
            Errors = errors,
            Warnings = warnings,
            MissingRequiredCollections = req.MissingRequiredCollections,
            InvalidCollections = req.InvalidCollections,
            CountMismatches = counts.CountMismatches,
            BrokenAttachmentRefs = atts.BrokenAttachmentRefs,
            DuplicateIdentities = dups.DuplicateIdentities,
            SchemaVersion = req.SchemaVersion,
            RequiredKeys = req.RequiredKeys
        };
    }

    private static void Scan(
        JsonArray? arr,
        Func<JsonObject, string> keyFn,
        string collection,
        string field,
        List<DuplicateIdentity> dups)
    {
        if (arr is null) return;
        var seen = new HashSet<string>(StringComparer.Ordinal);
        for (var i = 0; i < arr.Count; i++)
        {
            if (arr[i] is not JsonObject rec) continue;
            var id = keyFn(rec);
            if (id.Length == 0) continue;
            if (!seen.Add(id))
                dups.Add(new DuplicateIdentity { Collection = collection, Field = field, Value = id, Index = i });
        }
    }

    private static string FirstNonEmpty(JsonObject rec, params string[] keys)
    {
        foreach (var k in keys)
        {
            var s = BackupJsonUtil.Str(rec[k]).Trim();
            if (s.Length > 0) return s;
        }
        return "";
    }

    private static string FormatDeclared(double declared)
    {
        if (declared == Math.Truncate(declared) && Math.Abs(declared) <= long.MaxValue)
            return ((long)declared).ToString();
        return BackupJsJson.Stringify(JsonValue.Create(declared)).Trim('"');
    }

    private static BackupValidationResult EmptyOk(List<string>? countMismatches = null) =>
        new()
        {
            Ok = true,
            Status = BackupValidationStatus.VALID,
            CountMismatches = countMismatches ?? new List<string>()
        };
}
