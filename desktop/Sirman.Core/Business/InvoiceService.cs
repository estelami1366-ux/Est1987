using System.Text.Json.Nodes;

namespace Sirman.Core.Business;

/// <summary>اعتبارسنجی و بستن فاکتور — موجودی را Core کم می‌کند؛ UI فقط نتیجه را ذخیره می‌کند.</summary>
public static class InvoiceService
{
    public static InvoiceValidateResult Validate(JsonObject? invoice)
    {
        invoice ??= new JsonObject();
        if (string.IsNullOrWhiteSpace(JsonVal.Str(invoice, "seller")))
            return Fail("validation", "نام فروشنده را وارد کنید");
        var items = invoice["items"] as JsonArray;
        if (items is null || items.Count == 0)
            return Fail("validation", "حداقل یک دستگاه اضافه کنید");
        var status = JsonVal.Str(invoice, "status");
        if (status == "closed")
            return Fail("business-rule", "این فاکتور قبلاً تکمیل شده");
        return new InvoiceValidateResult { Ok = true, Invoice = invoice };
    }

    public static InvoiceCloseResult Close(JsonObject? invoice, JsonObject? inventoryMap, string closedAt)
    {
        var v = Validate(invoice);
        if (!v.Ok) return new InvoiceCloseResult { Ok = false, Kind = v.Kind, Error = v.Error };

        var next = Clone(invoice!);
        next["status"] = "closed";
        if (string.IsNullOrEmpty(JsonVal.Str(next, "closedAt")))
            next["closedAt"] = closedAt ?? "";
        if (string.IsNullOrEmpty(JsonVal.Str(next, "savedAt")))
            next["savedAt"] = closedAt ?? "";

        var mutated = new JsonObject();
        if (next["items"] is JsonArray items)
        {
            foreach (var n in items)
            {
                if (n is not JsonObject it) continue;
                var code = JsonVal.Str(it, "code");
                if (code.Length == 0 || inventoryMap is null) continue;
                if (inventoryMap[code] is not JsonObject live) continue;
                var r = InventoryCore.Consume(live, 1);
                if (!r.Ok || r.Item is null)
                    return new InvoiceCloseResult { Ok = false, Kind = "business-rule", Error = r.Error };
                mutated[code] = r.Item;
            }
        }

        var totals = TotalsFromInvoice(next);
        next["tE"] = totals.TE;
        next["tD"] = totals.TD;
        next["tF"] = totals.TF;
        return new InvoiceCloseResult
        {
            Ok = true,
            Invoice = next,
            Inventory = mutated,
            Totals = totals,
            Audit = new CoreAudit("closeInv", "invoice", JsonVal.Str(next, "num"), true)
        };
    }

    public static InvoiceTotals TotalsFromInvoice(JsonObject invoice)
    {
        var lines = new List<InvoiceLine>();
        if (invoice["items"] is JsonArray arr)
        {
            foreach (var n in arr)
            {
                if (n is not JsonObject x) continue;
                lines.Add(InvoicePricing.Line(
                    CalculationEngine.ToNum(JsonVal.Str(x, "est")),
                    CalculationEngine.ToNum(JsonVal.Str(x, "disc")),
                    CalculationEngine.ToNum(JsonVal.Str(x, "finRaw").Length > 0 ? JsonVal.Str(x, "finRaw") : JsonVal.Str(x, "fin"))));
            }
        }
        return InvoicePricing.Totals(lines);
    }

    private static InvoiceValidateResult Fail(string kind, string err) =>
        new() { Ok = false, Kind = kind, Error = err };

    private static JsonObject Clone(JsonObject src) =>
        JsonNode.Parse(src.ToJsonString()) as JsonObject ?? new JsonObject();
}

public sealed class InvoiceValidateResult
{
    public bool Ok { get; init; }
    public string Kind { get; init; } = "";
    public string Error { get; init; } = "";
    public JsonObject Invoice { get; init; } = new();
}

public sealed class InvoiceCloseResult
{
    public bool Ok { get; init; }
    public string Kind { get; init; } = "";
    public string Error { get; init; } = "";
    public JsonObject Invoice { get; init; } = new();
    public JsonObject Inventory { get; init; } = new();
    public InvoiceTotals? Totals { get; init; }
    public CoreAudit? Audit { get; init; }
}

public sealed record CoreAudit(string Action, string Entity, string EntityId, bool Ok);
