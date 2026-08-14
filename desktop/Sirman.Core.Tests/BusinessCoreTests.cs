using System.Text.Json;
using System.Text.Json.Nodes;
using Sirman.Core.Application;
using Sirman.Core.Business;
using Xunit;

namespace Sirman.Core.Tests;

public class CalculationEngineTests
{
    [Fact]
    public void WarrantyEndDate_Plus24Months()
    {
        Assert.Equal("1407/05/05", CalculationEngine.WarrantyEndDate("1405/05/05", 24));
        Assert.Equal("1405/05/05", CalculationEngine.WarrantyEndDate("1405/05/05", 0));
    }

    [Fact]
    public void Balance_Final_Stock_Reorder_MatchHtml()
    {
        Assert.Equal(700, CalculationEngine.Balance(1000, 300));
        Assert.Equal(160, CalculationEngine.FinalAmount(100, 50, 20, 10));
        Assert.Equal(7, CalculationEngine.AvailableStock(10, 3));
        Assert.Equal(0, CalculationEngine.AvailableStock(2, 5));
        Assert.Equal(30, CalculationEngine.ReorderPoint(5, 4, 10));
    }

    [Fact]
    public void Sla_Thresholds_MatchHtml()
    {
        Assert.Equal("normal", CalculationEngine.SlaStatusFromAgeHours(10));
        Assert.Equal("warning", CalculationEngine.SlaStatusFromAgeHours(24));
        Assert.Equal("critical", CalculationEngine.SlaStatusFromAgeHours(48));
        Assert.Equal("overdue", CalculationEngine.SlaStatusFromAgeHours(72));
    }
}

public class InvoicePricingTests
{
    [Fact]
    public void Line_UsesDiscountWhenDiscPositive()
    {
        var l = InvoicePricing.Line(1000, 10, 9999);
        Assert.Equal(100, l.Da);
        Assert.Equal(900, l.Fin);
    }

    [Fact]
    public void Line_KeepsManualFinWhenDiscZero()
    {
        var l = InvoicePricing.Line(1000, 0, 800);
        Assert.Equal(0, l.Da);
        Assert.Equal(800, l.Fin);
    }

    [Fact]
    public void SaleLine_MatchesCalcSaleTotal()
    {
        var a = InvoicePricing.SaleLine(2, 1000, 10);
        Assert.Equal(100, a.DiscAmt);
        Assert.Equal(1800, a.Total);
        Assert.Equal(1800, InvoicePricing.SaleTotal(new[] { a }));
    }
}

public class PaymentRulesTests
{
    [Fact]
    public void Withdraw_RejectsInvalidAndOverdraw()
    {
        Assert.False(PaymentRules.Withdraw(100, 0).Ok);
        Assert.False(PaymentRules.Withdraw(100, 150).Ok);
        var ok = PaymentRules.Withdraw(100, 40);
        Assert.True(ok.Ok);
        Assert.Equal(60, ok.NewBalance);
    }

    [Fact]
    public void Remaining_IsBalance()
    {
        Assert.Equal(250, PaymentRules.Remaining(1000, 750));
    }
}

public class WarrantyWorkflowTests
{
    [Fact]
    public void OnlyOpenToClosed()
    {
        Assert.True(WarrantyWorkflow.CanTransition("open", "closed"));
        Assert.False(WarrantyWorkflow.CanTransition("closed", "open"));
        var rec = new JsonObject { ["id"] = "W-1", ["status"] = "open", ["name"] = "علی" };
        var ok = WarrantyWorkflow.Apply(rec, "closed", "1405/05/23");
        Assert.True(ok.Ok);
        Assert.Equal("open", rec["status"]?.ToString());
        Assert.Equal("closed", ok.Record["status"]?.ToString());
        Assert.False(WarrantyWorkflow.Apply(new JsonObject { ["status"] = "closed" }, "open", "").Ok);
    }
}

public class InventoryCoreTests
{
    [Fact]
    public void StockReserveRelease_MatchHtmlEngine()
    {
        var item = JsonNode.Parse("""{"qty":10,"min":2,"reorder":3,"reserved":0,"byWh":{"WH-A":10},"reservedByWh":{},"price":1000}""")!.AsObject();
        var s0 = InventoryCore.Stock(item, "WH-A");
        Assert.Equal(10, s0.Qty);
        Assert.Equal(10, s0.Available);
        var r1 = InventoryCore.Reserve(item, 4, "WH-A");
        Assert.True(r1.Ok);
        Assert.Equal(6, r1.Stock!.Available);
        Assert.Equal(0, InventoryCore.Stock(item, "WH-A").Reserved);
        var over = InventoryCore.Reserve(r1.Item, 20, "WH-A");
        Assert.False(over.Ok);
        var rel = InventoryCore.Release(r1.Item, 1, "WH-A");
        Assert.True(rel.Ok);
        Assert.Equal(3, rel.Stock!.Reserved);
    }

    [Fact]
    public void Consume_UsesMaxZero_LikeSaleDeduct()
    {
        var item = JsonNode.Parse("""{"qty":2,"code":"P1"}""")!.AsObject();
        var r = InventoryCore.Consume(item, 5);
        Assert.True(r.Ok);
        Assert.True(r.WouldGoNegative);
        Assert.Equal(0, r.Stock!.Qty);
        Assert.Equal(2, InventoryCore.Stock(item, null).Qty);
    }
}

public class BusinessFacadeDualRunTests
{
    private readonly BusinessFacade _f = new();

    [Fact]
    public void Facade_MatchesHtmlCalculationVectors()
    {
        Assert.Equal("1407/05/05", ResultStr(_f.Run("calc.warrantyEndDate", """{"purchaseDate":"1405/05/05","periodMonths":"24"}""")));
        Assert.Equal(700, ResultNum(_f.Run("calc.balance", """{"total":"1000","paid":"300"}""")));
        Assert.Equal(160, ResultNum(_f.Run("calc.finalAmount", """{"parts":"100","labor":"50","other":"20","discount":"10"}""")));
        Assert.Equal(7, ResultNum(_f.Run("calc.availableStock", """{"current":"10","reserved":"3"}""")));
        Assert.Equal(0, ResultNum(_f.Run("calc.availableStock", """{"current":"2","reserved":"5"}""")));
        Assert.Equal(30, ResultNum(_f.Run("calc.reorderPoint", """{"usage":"5","lead":"4","safety":"10"}""")));
        Assert.Equal("warning", ResultStr(_f.Run("calc.sla", """{"ageHours":"24"}""")));
    }

    [Fact]
    public void Facade_UnknownOp_DoesNotThrowRaw()
    {
        var j = JsonDocument.Parse(_f.Run("no.such", "{}")).RootElement;
        Assert.False(j.GetProperty("ok").GetBoolean());
        Assert.False(j.ToString().Contains("InvalidOperation", StringComparison.Ordinal));
    }

    [Fact]
    public void SuggestParts_OnlyFromCatalog()
    {
        var json = """{"prodCode":"402003","model":"چای‌ساز","problem":"هیتر","parts":[{"code":"P-HEAT","name":"هیتر","prodCode":"402003","cat":"گرمایش","qty":4},{"code":"P-OTHER","name":"واشر","prodCode":"999","cat":"متفرقه","qty":2}]}""";
        var root = JsonDocument.Parse(_f.Run("rules.suggestParts", json)).RootElement;
        Assert.True(root.GetProperty("ok").GetBoolean());
        var hits = root.GetProperty("result");
        Assert.True(hits.GetArrayLength() >= 1);
        Assert.Equal("P-HEAT", hits[0].GetProperty("code").GetString());
    }

    private static string ResultStr(string json) =>
        JsonDocument.Parse(json).RootElement.GetProperty("result").GetString() ?? "";

    private static double ResultNum(string json) =>
        JsonDocument.Parse(json).RootElement.GetProperty("result").GetDouble();
}
