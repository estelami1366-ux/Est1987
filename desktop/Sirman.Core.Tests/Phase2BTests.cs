using System.Text.Json;
using System.Text.Json.Nodes;
using Sirman.Core.Application;
using Sirman.Core.Business;
using Sirman.Core.Data;
using Xunit;

namespace Sirman.Core.Tests;

public class Phase2BEdgeCaseTests
{
    private readonly BusinessFacade _f = new();

    [Fact]
    public void InvoiceLine_ZeroDiscKeepsZeroFinRawAsEstMinusDa()
    {
        var l = InvoicePricing.Line(1000, 0, 0);
        Assert.Equal(0, l.Da);
        Assert.Equal(1000, l.Fin);
    }

    [Fact]
    public void InvoiceLine_NegativeAndMissingTreatAsZero()
    {
        var l = InvoicePricing.Line(double.NaN, double.NaN, double.NaN);
        Assert.Equal(0, l.Est);
        Assert.Equal(0, l.Fin);
    }

    [Fact]
    public void InvoiceTotals_SumsLines()
    {
        var json = _f.Run("invoice.totals", """{"lines":[{"est":1000,"disc":10,"finRaw":0},{"est":200,"disc":0,"finRaw":150}]}""");
        var t = JsonDocument.Parse(json).RootElement.GetProperty("result");
        Assert.Equal(1200, t.GetProperty("tE").GetDouble());
        Assert.Equal(100, t.GetProperty("tD").GetDouble());
        Assert.Equal(1050, t.GetProperty("tF").GetDouble());
    }

    [Fact]
    public void SaleLine_ZeroQtyBecomesOne()
    {
        var s = InvoicePricing.SaleLine(0, 500, 0);
        Assert.Equal(1, s.Qty);
        Assert.Equal(500, s.Total);
    }

    [Fact]
    public void Payment_DepositRejectsZero_WithdrawExactBalance()
    {
        Assert.False(PaymentRules.Deposit(0).Ok);
        Assert.False(PaymentRules.Deposit(-5).Ok);
        var w = PaymentRules.Withdraw(40, 40);
        Assert.True(w.Ok);
        Assert.Equal(0, w.NewBalance);
        var dep = JsonDocument.Parse(_f.Run("payment.deposit", """{"amount":"25"}""")).RootElement;
        Assert.True(dep.GetProperty("ok").GetBoolean());
        Assert.True(dep.GetProperty("result").GetProperty("ok").GetBoolean());
    }

    [Fact]
    public void Remaining_OverpayIsNegativeLikeJs()
    {
        Assert.Equal(-50, PaymentRules.Remaining(100, 150));
    }

    [Fact]
    public void Sla_Boundaries()
    {
        Assert.Equal("normal", CalculationEngine.SlaStatusFromAgeHours(0));
        Assert.Equal("normal", CalculationEngine.SlaStatusFromAgeHours(23));
        Assert.Equal("warning", CalculationEngine.SlaStatusFromAgeHours(24));
        Assert.Equal("warning", CalculationEngine.SlaStatusFromAgeHours(47));
        Assert.Equal("critical", CalculationEngine.SlaStatusFromAgeHours(48));
        Assert.Equal("critical", CalculationEngine.SlaStatusFromAgeHours(71));
        Assert.Equal("overdue", CalculationEngine.SlaStatusFromAgeHours(72));
    }

    [Fact]
    public void AvailableStock_ZeroAndMissing()
    {
        Assert.Equal(0, CalculationEngine.AvailableStock(0, 0));
        Assert.Equal(0, CalculationEngine.AvailableStock("", null));
        Assert.Equal(0, CalculationEngine.Balance(0, 0));
        Assert.Equal(0, CalculationEngine.FinalAmount(null, null, null, null));
    }

    [Fact]
    public void Jalali_MonthOverflowAndZeroMonths()
    {
        Assert.Equal("1405/12/29", CalculationEngine.AddJalaliMonths("1405/11/30", 1));
        Assert.Equal("1405/01/01", CalculationEngine.AddJalaliMonths("1405/01/01", 0));
    }

    [Fact]
    public void Inventory_InsufficientReserve_DoesNotMutateOriginal()
    {
        var item = JsonNode.Parse("""{"qty":2,"reserved":0}""")!.AsObject();
        var r = InventoryCore.Reserve(item, 5, null);
        Assert.False(r.Ok);
        Assert.Equal(2, InventoryCore.Stock(item, null).Qty);
        Assert.Equal(0, InventoryCore.Stock(item, null).Reserved);
    }

    [Fact]
    public void Inventory_AddStockRejectsZero()
    {
        var item = JsonNode.Parse("""{"qty":3}""")!.AsObject();
        Assert.False(InventoryCore.AddStock(item, 0).Ok);
        Assert.False(InventoryCore.AddStock(item, -1).Ok);
    }

    [Fact]
    public void CurrentJsonStore_MergesCoreItemOntoLive()
    {
        IInventoryRepository store = new CurrentJsonStore();
        var live = JsonNode.Parse("""{"qty":10,"reserved":0,"code":"P1"}""")!.AsObject();
        var core = JsonNode.Parse("""{"qty":10,"reserved":4,"reservedByWh":{"WH-A":4}}""")!.AsObject();
        store.MergeItem(live, core);
        Assert.Equal(4, live["reserved"]!.GetValue<int>());
        Assert.Equal("P1", live["code"]!.GetValue<string>());
        Assert.Equal(4, live["reservedByWh"]!["WH-A"]!.GetValue<int>());
    }

    [Fact]
    public void Facade_WithdrawInvalid_ControlledFailure()
    {
        var json = _f.Run("payment.withdraw", """{"balance":"10","amount":"0"}""");
        var root = JsonDocument.Parse(json).RootElement;
        Assert.True(root.GetProperty("ok").GetBoolean());
        Assert.False(root.GetProperty("result").GetProperty("ok").GetBoolean());
        Assert.False(json.Contains("InvalidOperation", StringComparison.Ordinal));
    }
}
