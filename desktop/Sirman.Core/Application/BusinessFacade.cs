using System.Text.Json;
using System.Text.Json.Nodes;
using Sirman.Core.Business;
using Sirman.Core.Infrastructure;

namespace Sirman.Core.Application;

/// <summary>
/// Use-caseهای محاسباتی و قوانین — UI فقط JSON می‌فرستد و نتیجه می‌گیرد.
/// ذخیره هنوز در HTML است.
/// </summary>
public sealed class BusinessFacade
{
    public string Run(string name, string json)
    {
        try
        {
            name = (name ?? "").Trim();
            JsonObject obj;
            try { obj = JsonVal.Obj(json); }
            catch { return SafeError.Json("invalid-json", "داده نامعتبر است"); }

            var result = Dispatch(name, obj);
            return JsonSerializer.Serialize(new { ok = true, op = name, result });
        }
        catch (Exception ex)
        {
            return SafeError.Json("business-failed", "محاسبه انجام نشد", ex);
        }
    }

    private static object? Dispatch(string name, JsonObject o) => name switch
    {
        "calc.warrantyEndDate" => CalculationEngine.WarrantyEndDate(JsonVal.Str(o, "purchaseDate"), JsonVal.Str(o, "periodMonths")),
        "calc.balance" => CalculationEngine.Balance(JsonVal.Str(o, "total"), JsonVal.Str(o, "paid")),
        "calc.finalAmount" => CalculationEngine.FinalAmount(JsonVal.Str(o, "parts"), JsonVal.Str(o, "labor"), JsonVal.Str(o, "other"), JsonVal.Str(o, "discount")),
        "calc.availableStock" => CalculationEngine.AvailableStock(JsonVal.Str(o, "current"), JsonVal.Str(o, "reserved")),
        "calc.reorderPoint" => CalculationEngine.ReorderPoint(JsonVal.Str(o, "usage"), JsonVal.Str(o, "lead"), JsonVal.Str(o, "safety")),
        "calc.sla" => CalculationEngine.SlaStatusFromAgeHours(JsonVal.Str(o, "ageHours")),
        "calc.addJalaliMonths" => CalculationEngine.AddJalaliMonths(JsonVal.Str(o, "date"), CalculationEngine.ToInt(JsonVal.Str(o, "months"))),
        "invoice.line" => InvoiceLineDto(InvoicePricing.Line(Num(o, "est"), Num(o, "disc"), Num(o, "finRaw"))),
        "invoice.totals" => InvoiceTotalsFrom(o),
        "sale.line" => SaleLineDto(InvoicePricing.SaleLine(Num(o, "qty") == 0 ? 1 : Num(o, "qty"), Num(o, "price"), Num(o, "disc"))),
        "sale.total" => SaleTotalFrom(o),
        "payment.withdraw" => PaymentDto(PaymentRules.Withdraw(Num(o, "balance"), Num(o, "amount"))),
        "payment.deposit" => PaymentDto(PaymentRules.Deposit(Num(o, "amount"))),
        "payment.remaining" => PaymentRules.Remaining(Num(o, "total"), Num(o, "paid")),
        "inventory.stock" => InventoryCore.Stock(o["item"] as JsonObject ?? o, JsonVal.Str(o, "whId")).ToJson(),
        "inventory.reserve" => MutateDto(InventoryCore.Reserve(o["item"] as JsonObject, CalculationEngine.ToInt(JsonVal.Str(o, "qty")), JsonVal.Str(o, "whId"))),
        "inventory.release" => MutateDto(InventoryCore.Release(o["item"] as JsonObject, CalculationEngine.ToInt(JsonVal.Str(o, "qty")), JsonVal.Str(o, "whId"))),
        "inventory.consume" => MutateDto(InventoryCore.Consume(o["item"] as JsonObject, CalculationEngine.ToInt(JsonVal.Str(o, "qty")))),
        "inventory.addStock" => MutateDto(InventoryCore.AddStock(o["item"] as JsonObject, CalculationEngine.ToInt(JsonVal.Str(o, "qty")))),
        "inventory.normalizeWarehouse" => InventoryCore.NormalizeWarehouse(o["warehouse"] as JsonObject ?? o),
        "inventory.kardex" => InventoryCore.Kardex(o["moves"] as JsonArray, JsonVal.Str(o, "code"), JsonVal.Str(o, "whId")),
        "inventory.lowStock" => InventoryCore.LowStock(o["parts"] as JsonArray, o["products"] as JsonArray, o["inventory"] as JsonObject),
        "inventory.search" => InventoryCore.Search(JsonVal.Str(o, "q"), o["parts"] as JsonArray, o["products"] as JsonArray),
        "inventory.value" => InventoryCore.Value(o["parts"] as JsonArray, o["products"] as JsonArray, o["inventory"] as JsonObject),
        "inventory.deadStock" => InventoryCore.DeadStock(o["items"] as JsonArray, o["moves"] as JsonArray, CalculationEngine.ToInt(JsonVal.Str(o, "days")), (long)Num(o, "nowMs")),
        "inventory.consumed" => InventoryCore.Consumed(o["warranties"] as JsonArray),
        "warranty.canTransition" => WarrantyWorkflow.CanTransition(JsonVal.Str(o, "from"), JsonVal.Str(o, "to")),
        "warranty.applyTransition" => WarrantyApplyDto(o),
        "warranty.closeMissing" => WarrantyWorkflow.CloseMissingFields(o["record"] as JsonObject ?? o, CalculationEngine.ToInt(JsonVal.Str(o, "deviceCount")), JsonVal.Str(o, "problem")),
        "rules.suggestParts" => PartsAdvisor.Suggest(o["parts"] as JsonArray, JsonVal.Str(o, "prodCode"), JsonVal.Str(o, "model"), JsonVal.Str(o, "problem")),
        _ => throw new InvalidOperationException("unknown-op")
    };

    private static double Num(JsonObject o, string k) => CalculationEngine.ToNum(JsonVal.Str(o, k));

    private static object InvoiceLineDto(InvoiceLine l) => new { est = l.Est, disc = l.Disc, da = l.Da, fin = l.Fin };
    private static object SaleLineDto(SaleLine l) => new { qty = l.Qty, price = l.Price, disc = l.Disc, discAmt = l.DiscAmt, total = l.Total };
    private static object PaymentDto(PaymentCheck c) => new { ok = c.Ok, error = c.Error, amount = c.Amount, newBalance = c.NewBalance };

    private static object InvoiceTotalsFrom(JsonObject o)
    {
        var lines = new List<InvoiceLine>();
        if (o["lines"] is JsonArray arr)
        {
            foreach (var n in arr)
            {
                if (n is not JsonObject x) continue;
                lines.Add(InvoicePricing.Line(Num(x, "est"), Num(x, "disc"), Num(x, "finRaw")));
            }
        }
        var t = InvoicePricing.Totals(lines);
        return new { tE = t.TE, tD = t.TD, tF = t.TF };
    }

    private static object SaleTotalFrom(JsonObject o)
    {
        var lines = new List<SaleLine>();
        if (o["items"] is JsonArray arr)
        {
            foreach (var n in arr)
            {
                if (n is not JsonObject x) continue;
                var qty = Num(x, "qty");
                lines.Add(InvoicePricing.SaleLine(qty == 0 ? 1 : qty, Num(x, "price"), Num(x, "disc")));
            }
        }
        return InvoicePricing.SaleTotal(lines);
    }

    private static object MutateDto(InventoryMutateResult r) => new
    {
        ok = r.Ok,
        err = r.Error,
        error = r.Error,
        item = r.Item,
        stock = r.Stock?.ToJson(),
        wouldGoNegative = r.WouldGoNegative
    };

    private static object WarrantyApplyDto(JsonObject o)
    {
        var rec = o["record"] as JsonObject ?? new JsonObject();
        var r = WarrantyWorkflow.Apply(rec, JsonVal.Str(o, "to"), JsonVal.Str(o, "closedAt"));
        return new { ok = r.Ok, err = r.Error, record = r.Record, from = r.From, to = r.To };
    }
}
