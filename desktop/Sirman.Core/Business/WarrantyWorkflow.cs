using System.Text.Json.Nodes;

namespace Sirman.Core.Business;

/// <summary>همان canWarrantyTransition / applyWarrantyTransition — گردش‌کار جدید اختراع نمی‌شود.</summary>
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
        return missing;
    }

    private static JsonObject Clone(JsonObject src)
    {
        return JsonNode.Parse(src.ToJsonString()) as JsonObject ?? new JsonObject();
    }
}

public sealed class WarrantyTransitionResult
{
    public bool Ok { get; init; }
    public string Error { get; init; } = "";
    public JsonObject Record { get; init; } = new();
    public string From { get; init; } = "";
    public string To { get; init; } = "";
}
