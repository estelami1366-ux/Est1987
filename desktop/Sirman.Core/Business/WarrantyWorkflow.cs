using System.Text.Json.Nodes;

namespace Sirman.Core.Business;

/// <summary>همان canWarrantyTransition / saveWar / closeWar — گردش‌کار جدید اختراع نمی‌شود.</summary>
public static class WarrantyWorkflow
{
    public static bool CanTransition(string? from, string? to)
    {
        from = string.IsNullOrEmpty(from) ? "open" : from;
        to ??= "";
        return from == "open" && to == "closed";
    }

    public static WarrantyTransitionResult Apply(JsonObject? record, string? toStatus, string? closedAt)
    {
        record ??= new JsonObject();
        var from = record["status"]?.ToString() ?? "open";
        if (!CanTransition(from, toStatus))
            return new WarrantyTransitionResult { Ok = false, Error = "گذار وضعیت مجاز نیست", Record = Clone(record), From = from };

        var next = Clone(record);
        next["status"] = toStatus;
        if (toStatus == "closed" && string.IsNullOrEmpty(next["closedAt"]?.ToString()))
            next["closedAt"] = closedAt ?? "";
        return new WarrantyTransitionResult { Ok = true, Record = next, From = from, To = toStatus ?? "" };
    }

    public static List<string> CloseMissingFields(JsonObject? w, int deviceCount, string? problem)
    {
        var missing = new List<string>();
        w ??= new JsonObject();
        if (string.IsNullOrWhiteSpace(JsonVal.Str(w, "name"))) missing.Add("نام مشتری");
        if (string.IsNullOrWhiteSpace(JsonVal.Str(w, "phone"))) missing.Add("شماره تماس");
        if (deviceCount <= 0) missing.Add("حداقل یک دستگاه");
        if (string.IsNullOrWhiteSpace(problem ?? JsonVal.Str(w, "problem"))) missing.Add("شرح مشکل");

        var init = JsonVal.Str(w, "initialService");
        if (init == "refer_company")
        {
            var cw = w["companyWork"] as JsonObject ?? new JsonObject();
            var cr = w["companyReport"] as JsonObject ?? new JsonObject();
            var expert = cw["expert"] as JsonObject ?? new JsonObject();
            var outbound = cw["outbound"] as JsonObject ?? new JsonObject();
            if (string.IsNullOrWhiteSpace(JsonVal.Str(cw, "arriveDate"))) missing.Add("تاریخ رسیدن به شرکت");
            if (string.IsNullOrWhiteSpace(JsonVal.Str(expert, "diagnosis"))) missing.Add("تشخیص کارشناس");
            if (string.IsNullOrWhiteSpace(JsonVal.Str(expert, "name"))) missing.Add("نام کارشناس");
            if (string.IsNullOrWhiteSpace(JsonVal.Str(cr, "repairDesc"))) missing.Add("شرح عملیات تعمیر");
            if (string.IsNullOrWhiteSpace(JsonVal.Str(cr, "repairDate"))) missing.Add("تاریخ تعمیر");
            if (string.IsNullOrWhiteSpace(JsonVal.Str(cr, "repairResult"))) missing.Add("نتیجه تعمیر");
            if (string.IsNullOrWhiteSpace(JsonVal.Str(cr, "techName"))) missing.Add("نام کارشناس خدمات");
            if (string.IsNullOrWhiteSpace(JsonVal.Str(cr, "qcName"))) missing.Add("نام کنترل کیفیت");
            if (string.IsNullOrWhiteSpace(JsonVal.Str(cr, "qcResult"))) missing.Add("نتیجه کنترل کیفیت");
            if (string.IsNullOrWhiteSpace(JsonVal.Str(cr, "shipName"))) missing.Add("نام مسئول ارسال");
            var shipMethod = JsonVal.Str(cr, "shipMethod");
            if (shipMethod.Length == 0) shipMethod = JsonVal.Str(outbound, "method");
            if (!IsInPersonShip(shipMethod) && string.IsNullOrWhiteSpace(JsonVal.Str(cr, "shipTracking")))
                missing.Add("کد مرسوله خروجی");
            if (string.IsNullOrWhiteSpace(JsonVal.Str(cr, "shipDate"))) missing.Add("تاریخ ارسال خروجی");
            if (string.IsNullOrWhiteSpace(JsonVal.Str(cr, "mgrName"))) missing.Add("نام مدیر خدمات");
            var mgr = JsonVal.Str(cr, "mgrApprove");
            if (string.IsNullOrWhiteSpace(mgr) || mgr == "pending") missing.Add("تأیید مدیر خدمات");
        }
        if (init == "refer_agency")
        {
            var aw = w["agencyWork"] as JsonObject ?? new JsonObject();
            if (string.IsNullOrWhiteSpace(JsonVal.Str(aw, "name"))) missing.Add("نام نمایندگی");
            if (string.IsNullOrWhiteSpace(JsonVal.Str(aw, "refDate"))) missing.Add("تاریخ ارجاع نمایندگی");
        }
        return missing;
    }

    public static WarrantySaveResult ValidateSave(JsonObject? record)
    {
        record ??= new JsonObject();
        var init = JsonVal.Str(record, "initialService");
        var shortPath = init is "activate" or "phone_fix" or "no_follow";
        if (string.IsNullOrWhiteSpace(JsonVal.Str(record, "name"))
            || string.IsNullOrWhiteSpace(JsonVal.Str(record, "phone"))
            || DeviceCount(record) <= 0)
            return FailSave("validation", "نام، تلفن و حداقل یک دستگاه الزامی است");
        if (!shortPath && string.IsNullOrWhiteSpace(JsonVal.Str(record, "problem")))
            return FailSave("validation", "شرح مشکل الزامی است");
        if (string.IsNullOrWhiteSpace(init))
            return FailSave("validation", "وضعیت اولیه خدمات را انتخاب کنید");
        if (init == "refer_agency")
        {
            var aw = record["agencyWork"] as JsonObject;
            if (string.IsNullOrWhiteSpace(JsonVal.Str(aw, "name")))
                return FailSave("validation", "نام نمایندگی الزامی است");
        }
        if (init == "return_oem")
        {
            var oem = record["oemWork"] as JsonObject;
            if (string.IsNullOrWhiteSpace(JsonVal.Str(oem, "companyName")))
                return FailSave("validation", "نام شرکت تولیدکننده الزامی است");
        }
        if (shortPath)
        {
            var pr = record["phoneResolution"] as JsonObject;
            if (string.IsNullOrWhiteSpace(JsonVal.Str(pr, "note")))
                return FailSave("validation", "توضیح این تصمیم را بنویسید");
        }
        return new WarrantySaveResult { Ok = true, Record = record };
    }

    public static WarrantySaveResult Save(JsonObject? record, bool isNew, string now)
    {
        var v = ValidateSave(record);
        if (!v.Ok) return v;
        var next = Clone(record!);
        var init = JsonVal.Str(next, "initialService");
        if (init is "phone_fix" or "no_follow")
        {
            next["status"] = "closed";
            if (string.IsNullOrEmpty(JsonVal.Str(next, "closedAt"))) next["closedAt"] = now ?? "";
            if (init == "no_follow") next["closeReason"] = "no_follow";
            if (init == "phone_fix") next["closeReason"] = "phone_fix";
        }
        else if (string.IsNullOrEmpty(JsonVal.Str(next, "status")))
        {
            next["status"] = "open";
        }
        if (string.IsNullOrEmpty(JsonVal.Str(next, "savedAt"))) next["savedAt"] = now ?? "";
        if (isNew && string.IsNullOrEmpty(JsonVal.Str(next, "createdAt"))) next["createdAt"] = now ?? "";
        return new WarrantySaveResult
        {
            Ok = true,
            Record = next,
            Audit = new CoreAudit(isNew ? "saveWar" : "editWar", "warranty", JsonVal.Str(next, "id"), true)
        };
    }

    public static WarrantyCloseResult Close(JsonObject? record, int deviceCount, string? problem, string closedAt)
    {
        record ??= new JsonObject();
        var missing = CloseMissingFields(record, deviceCount > 0 ? deviceCount : DeviceCount(record), problem);
        if (missing.Count > 0)
            return new WarrantyCloseResult { Ok = false, Kind = "validation", Error = "برای بستن پرونده، این موارد را تکمیل کنید", Missing = missing, Record = Clone(record) };

        var applied = Apply(record, "closed", closedAt);
        if (!applied.Ok)
            return new WarrantyCloseResult { Ok = false, Kind = "business-rule", Error = applied.Error, Record = applied.Record };

        return new WarrantyCloseResult
        {
            Ok = true,
            Record = applied.Record,
            From = applied.From,
            To = applied.To,
            Audit = new CoreAudit("closeWar", "warranty", JsonVal.Str(applied.Record, "id"), true)
        };
    }

    public static ReversalResult Delete(JsonObject? payload) => TransactionReversal.DeleteWarranty(payload);

    public static bool IsInPersonShip(string? v)
    {
        v = (v ?? "").Trim().ToLowerInvariant();
        if (v.Length == 0) return false;
        return v is "inperson" or "in_person" or "person" or "حضوری" || v.Contains("شخص", StringComparison.Ordinal);
    }

    private static int DeviceCount(JsonObject record)
    {
        if (record["devices"] is JsonArray arr) return arr.Count;
        return CalculationEngine.ToInt(JsonVal.Str(record, "deviceCount"));
    }

    private static WarrantySaveResult FailSave(string kind, string err) =>
        new() { Ok = false, Kind = kind, Error = err };

    private static JsonObject Clone(JsonObject src) =>
        JsonNode.Parse(src.ToJsonString()) as JsonObject ?? new JsonObject();
}

public sealed class WarrantyTransitionResult
{
    public bool Ok { get; init; }
    public string Error { get; init; } = "";
    public JsonObject Record { get; init; } = new();
    public string From { get; init; } = "";
    public string To { get; init; } = "";
}

public sealed class WarrantySaveResult
{
    public bool Ok { get; init; }
    public string Kind { get; init; } = "";
    public string Error { get; init; } = "";
    public JsonObject Record { get; init; } = new();
    public CoreAudit? Audit { get; init; }
}

public sealed class WarrantyCloseResult
{
    public bool Ok { get; init; }
    public string Kind { get; init; } = "";
    public string Error { get; init; } = "";
    public List<string> Missing { get; init; } = new();
    public JsonObject Record { get; init; } = new();
    public string From { get; init; } = "";
    public string To { get; init; } = "";
    public CoreAudit? Audit { get; init; }
}
