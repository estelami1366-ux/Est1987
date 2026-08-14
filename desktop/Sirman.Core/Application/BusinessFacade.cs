using System.Text.Json;
using System.Text.Json.Nodes;
using Sirman.Core.Business;
using Sirman.Core.Data;
using Sirman.Core.Infrastructure;

namespace Sirman.Core.Application;

/// <summary>
/// Use-caseهای محاسباتی و قوانین — UI فقط JSON می‌فرستد و نتیجه می‌گیرد.
/// Persist از آداپتر JSON است؛ Database ساخته نمی‌شود.
/// </summary>
public sealed class BusinessFacade
{
    private readonly CurrentJsonStore _store = new();

    public IInventoryRepository InventoryStore => _store;
    public IWarrantyRepository WarrantyStore => _store;
    public IInvoiceRepository InvoiceStore => _store;
    public IPaymentRepository PaymentStore => _store;

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

    private object? Dispatch(string name, JsonObject o) => name switch
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
        "invoice.validate" => InvoiceValidateDto(InvoiceService.Validate(o["invoice"] as JsonObject ?? o)),
        "invoice.close" => InvoiceCloseDto(o),
        "sale.line" => SaleLineDto(InvoicePricing.SaleLine(Num(o, "qty") == 0 ? 1 : Num(o, "qty"), Num(o, "price"), Num(o, "disc"))),
        "sale.total" => SaleTotalFrom(o),
        "payment.withdraw" => PaymentDto(PaymentRules.Withdraw(Num(o, "balance"), Num(o, "amount"))),
        "payment.deposit" => PaymentDto(PaymentRules.Deposit(Num(o, "amount"))),
        "payment.remaining" => PaymentRules.Remaining(Num(o, "total"), Num(o, "paid")),
        "payment.applyDeposit" => PaymentAccountDto(PaymentRules.ApplyDeposit(o["account"] as JsonObject, Num(o, "amount"), JsonVal.Str(o, "subject"), JsonVal.Str(o, "refId"), JsonVal.Str(o, "refType"), JsonVal.Str(o, "date"))),
        "payment.applyWithdraw" => PaymentAccountDto(PaymentRules.ApplyWithdraw(o["account"] as JsonObject, Num(o, "amount"), JsonVal.Str(o, "subject"), JsonVal.Str(o, "date"))),
        "payment.editTransaction" => PaymentAccountDto(PaymentRules.EditTransaction(o["account"] as JsonObject, CalculationEngine.ToInt(JsonVal.Str(o, "trxIndex")), Num(o, "amount"), JsonVal.Str(o, "date"), JsonVal.Str(o, "subject"), JsonVal.Str(o, "category"), JsonVal.Str(o, "refNo"))),
        "payment.deleteTransaction" => PaymentAccountDto(PaymentRules.DeleteTransaction(o["account"] as JsonObject, CalculationEngine.ToInt(JsonVal.Str(o, "trxIndex")))),
        "inventory.stock" => InventoryCore.Stock(o["item"] as JsonObject ?? o, JsonVal.Str(o, "whId")).ToJson(),
        "inventory.reserve" => MutateDto(InventoryCore.Reserve(o["item"] as JsonObject, CalculationEngine.ToInt(JsonVal.Str(o, "qty")), JsonVal.Str(o, "whId")), o["item"] as JsonObject),
        "inventory.release" => MutateDto(InventoryCore.Release(o["item"] as JsonObject, CalculationEngine.ToInt(JsonVal.Str(o, "qty")), JsonVal.Str(o, "whId")), o["item"] as JsonObject),
        "inventory.consume" => MutateDto(InventoryCore.Consume(o["item"] as JsonObject, CalculationEngine.ToInt(JsonVal.Str(o, "qty"))), o["item"] as JsonObject),
        "inventory.addStock" => MutateDto(InventoryCore.AddStock(o["item"] as JsonObject, CalculationEngine.ToInt(JsonVal.Str(o, "qty")), JsonVal.Str(o, "whId")), o["item"] as JsonObject),
        "inventory.removeStock" => MutateDto(InventoryCore.RemoveStock(o["item"] as JsonObject, CalculationEngine.ToInt(JsonVal.Str(o, "qty")), JsonVal.Str(o, "whId")), o["item"] as JsonObject),
        "inventory.adjust" => MutateDto(InventoryCore.AdjustStock(o["item"] as JsonObject, CalculationEngine.ToInt(JsonVal.Str(o, "qty")), JsonVal.Str(o, "whId")), o["item"] as JsonObject),
        "inventory.applyByWarehouse" => MutateDto(InventoryCore.ApplyByWarehouse(o["item"] as JsonObject, JsonVal.Str(o, "type"), CalculationEngine.ToInt(JsonVal.Str(o, "qty")), JsonVal.Str(o, "whId")), o["item"] as JsonObject),
        "inventory.applyWarehouseDoc" => WarehouseDocDto(o),
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
        "warranty.validateSave" => WarrantySaveDto(WarrantyWorkflow.ValidateSave(o["record"] as JsonObject ?? o)),
        "warranty.save" => WarrantySaveDto(WarrantyWorkflow.Save(o["record"] as JsonObject ?? o, Bool(o, "isNew"), JsonVal.Str(o, "now"))),
        "warranty.close" => WarrantyCloseDto(o),
        "service.save" => WarrantySaveDto(ServiceRepairWorkflow.CreateOrUpdate(o["record"] as JsonObject ?? o, Bool(o, "isNew"), JsonVal.Str(o, "now"))),
        "service.close" => WarrantyCloseDto(o),
        "service.addPart" => MutateDto(ServiceRepairWorkflow.AddPart(o["item"] as JsonObject, CalculationEngine.ToInt(JsonVal.Str(o, "qty"))), o["item"] as JsonObject),
        "rules.suggestParts" => PartsAdvisor.Suggest(o["parts"] as JsonArray, JsonVal.Str(o, "prodCode"), JsonVal.Str(o, "model"), JsonVal.Str(o, "problem")),
        _ => throw new InvalidOperationException("unknown-op")
    };

    private static double Num(JsonObject o, string k) => CalculationEngine.ToNum(JsonVal.Str(o, k));
    private static bool Bool(JsonObject o, string k)
    {
        var s = JsonVal.Str(o, k).ToLowerInvariant();
        if (s is "1" or "true" or "yes") return true;
        if (o[k] is JsonValue v && v.TryGetValue<bool>(out var b)) return b;
        return false;
    }

    private static object InvoiceLineDto(InvoiceLine l) => new { est = l.Est, disc = l.Disc, da = l.Da, fin = l.Fin };
    private static object SaleLineDto(SaleLine l) => new { qty = l.Qty, price = l.Price, disc = l.Disc, discAmt = l.DiscAmt, total = l.Total };
    private static object PaymentDto(PaymentCheck c) => new { ok = c.Ok, error = c.Error, kind = c.Ok ? "" : "validation", amount = c.Amount, newBalance = c.NewBalance };

    private object PaymentAccountDto(PaymentAccountResult r)
    {
        var acc = r.Ok ? _store.MergeItem(null, r.Account) : r.Account;
        return new
        {
            ok = r.Ok,
            kind = r.Kind,
            error = r.Error,
            err = r.Error,
            account = acc,
            amount = r.Amount,
            newBalance = r.NewBalance,
            transaction = r.Transaction,
            persistKeys = r.Ok ? new[] { "accounts" } : Array.Empty<string>()
        };
    }

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

    private object MutateDto(InventoryMutateResult r, JsonObject? live)
    {
        var item = r.Ok ? _store.MergeItem(live, r.Item) : r.Item;
        return new
        {
            ok = r.Ok,
            err = r.Error,
            error = r.Error,
            kind = r.Ok ? "" : "business-rule",
            item,
            stock = r.Stock?.ToJson(),
            wouldGoNegative = r.WouldGoNegative,
            persistKeys = r.Ok ? new[] { "inventory" } : Array.Empty<string>()
        };
    }

    private static object InvoiceValidateDto(InvoiceValidateResult r) =>
        new { ok = r.Ok, kind = r.Kind, error = r.Error, err = r.Error };

    private object InvoiceCloseDto(JsonObject o)
    {
        var r = InvoiceService.Close(o["invoice"] as JsonObject ?? o, o["inventory"] as JsonObject, JsonVal.Str(o, "now"));
        return new
        {
            ok = r.Ok,
            kind = r.Kind,
            error = r.Error,
            err = r.Error,
            invoice = r.Ok ? _store.MergeItem(o["invoice"] as JsonObject, r.Invoice) : r.Invoice,
            inventory = r.Inventory,
            totals = r.Totals is null ? null : new { tE = r.Totals.TE, tD = r.Totals.TD, tF = r.Totals.TF },
            audit = r.Audit,
            persistKeys = r.Ok ? new[] { "invoices", "inventory" } : Array.Empty<string>()
        };
    }

    private object WarrantyApplyDto(JsonObject o)
    {
        var rec = o["record"] as JsonObject ?? new JsonObject();
        var r = WarrantyWorkflow.Apply(rec, JsonVal.Str(o, "to"), JsonVal.Str(o, "closedAt"));
        return new
        {
            ok = r.Ok,
            err = r.Error,
            error = r.Error,
            record = r.Ok ? _store.MergeItem(rec, r.Record) : r.Record,
            from = r.From,
            to = r.To
        };
    }

    private object WarrantySaveDto(WarrantySaveResult r) => new
    {
        ok = r.Ok,
        kind = r.Kind,
        error = r.Error,
        err = r.Error,
        record = r.Record,
        audit = r.Audit,
        persistKeys = r.Ok ? new[] { "warranties" } : Array.Empty<string>()
    };

    private object WarrantyCloseDto(JsonObject o)
    {
        var rec = o["record"] as JsonObject ?? o;
        var r = WarrantyWorkflow.Close(rec, CalculationEngine.ToInt(JsonVal.Str(o, "deviceCount")), JsonVal.Str(o, "problem"), JsonVal.Str(o, "closedAt"));
        return new
        {
            ok = r.Ok,
            kind = r.Kind,
            error = r.Error,
            err = r.Error,
            missing = r.Missing,
            record = r.Ok ? _store.MergeItem(rec, r.Record) : r.Record,
            from = r.From,
            to = r.To,
            audit = r.Audit,
            persistKeys = r.Ok ? new[] { "warranties" } : Array.Empty<string>()
        };
    }

    private object WarehouseDocDto(JsonObject o)
    {
        var r = WarehouseDocuments.ValidateAndApply(o["doc"] as JsonObject ?? o, o["items"] as JsonArray, o["stockByCode"] as JsonObject, JsonVal.Str(o, "now"));
        return new
        {
            ok = r.Ok,
            kind = r.Kind,
            error = r.Error,
            err = r.Error,
            doc = r.Doc,
            mutated = r.Mutated,
            audit = r.Audit,
            persistKeys = r.Ok ? new[] { "warehouseDocs", "inventory", "parts" } : Array.Empty<string>()
        };
    }
}
