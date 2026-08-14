using System.Text.Json;
using System.Text.Json.Nodes;
using Sirman.Core.Application;
using Sirman.Core.Business;
using Sirman.Core.Data;
using Xunit;

namespace Sirman.Core.Tests;

public class Phase2CompleteTests
{
    private readonly BusinessFacade _f = new();

    [Fact]
    public void StorageAdapter_IsUsedByFacade()
    {
        Assert.NotNull(_f.InventoryStore);
        Assert.NotNull(_f.WarrantyStore);
        IInventoryRepository store = _f.InventoryStore;
        var live = JsonNode.Parse("""{"qty":5,"code":"A"}""")!.AsObject();
        var core = JsonNode.Parse("""{"qty":9,"byWh":{"WH-1":9}}""")!.AsObject();
        store.MergeItem(live, core);
        Assert.Equal(9, live["qty"]!.GetValue<int>());
        Assert.Equal("A", live["code"]!.GetValue<string>());
    }

    [Fact]
    public void ApplyByWarehouse_UpdatesByWhAndQty()
    {
        var item = JsonNode.Parse("""{"qty":10,"byWh":{"WH-A":10},"reserved":0}""")!.AsObject();
        var r = InventoryCore.ApplyByWarehouse(item, "in", 4, "WH-A");
        Assert.True(r.Ok);
        Assert.Equal(14, r.Stock!.Qty);
        Assert.Equal(14, r.Item!["byWh"]!["WH-A"]!.GetValue<int>());
        Assert.Equal(10, InventoryCore.Stock(item, "WH-A").Qty);
    }

    [Fact]
    public void ApplyByWarehouse_OutRejectsInsufficient()
    {
        var item = JsonNode.Parse("""{"qty":2,"byWh":{"WH-A":2},"reserved":0}""")!.AsObject();
        var r = InventoryCore.ApplyByWarehouse(item, "out", 5, "WH-A");
        Assert.False(r.Ok);
        Assert.Equal(2, InventoryCore.Stock(item, "WH-A").Qty);
    }

    [Fact]
    public void RemoveAndAdjust_MatchWarehouseRules()
    {
        var item = JsonNode.Parse("""{"qty":10,"byWh":{"WH-A":10},"reserved":0}""")!.AsObject();
        var rm = InventoryCore.RemoveStock(item, 3, "WH-A");
        Assert.True(rm.Ok);
        Assert.Equal(7, rm.Stock!.Qty);
        var adj = InventoryCore.AdjustStock(rm.Item, 12, "WH-A");
        Assert.True(adj.Ok);
        Assert.Equal(12, adj.Stock!.Qty);
    }

    [Fact]
    public void AddStock_WithWarehouse_UsesByWh()
    {
        var item = JsonNode.Parse("""{"qty":1,"byWh":{"WH-A":1}}""")!.AsObject();
        var r = InventoryCore.AddStock(item, 2, "WH-A");
        Assert.True(r.Ok);
        Assert.Equal(3, r.Stock!.Qty);
    }

    [Fact]
    public void WarehouseDoc_In_MutatesStock()
    {
        var json = _f.Run("inventory.applyWarehouseDoc", """
        {"doc":{"type":"in","party":"علی","reason":"","fromWh":"","toWh":"WH-A","id":"WH-IN-0001"},
         "items":[{"code":"P1","name":"قطعه","qty":4}],
         "stockByCode":{"P1":{"code":"P1","qty":1,"byWh":{"WH-A":1},"reserved":0}},
         "now":"1405/05/23"}
        """);
        var root = JsonDocument.Parse(json).RootElement;
        Assert.True(root.GetProperty("ok").GetBoolean());
        var res = root.GetProperty("result");
        Assert.True(res.GetProperty("ok").GetBoolean());
        Assert.Equal(5, res.GetProperty("mutated").GetProperty("P1").GetProperty("qty").GetInt32());
    }

    [Fact]
    public void WarehouseDoc_RejectsEmptyParty()
    {
        var json = _f.Run("inventory.applyWarehouseDoc", """{"doc":{"type":"in","party":""},"items":[{"code":"P1","qty":1}]}""");
        var res = JsonDocument.Parse(json).RootElement.GetProperty("result");
        Assert.False(res.GetProperty("ok").GetBoolean());
        Assert.Equal("validation", res.GetProperty("kind").GetString());
    }

    [Fact]
    public void PaymentApply_DepositAndWithdraw_MutateAccount()
    {
        var acc = """{"id":"A1","balance":100,"transactions":[]}""";
        var dep = JsonDocument.Parse(_f.Run("payment.applyDeposit", "{\"account\":" + acc + ",\"amount\":\"25\",\"subject\":\"تست\",\"date\":\"1405/05/23\"}")).RootElement.GetProperty("result");
        Assert.True(dep.GetProperty("ok").GetBoolean());
        Assert.Equal(125, dep.GetProperty("account").GetProperty("balance").GetDouble());
        var acc2 = dep.GetProperty("account").GetRawText();
        var wd = JsonDocument.Parse(_f.Run("payment.applyWithdraw", "{\"account\":" + acc2 + ",\"amount\":\"40\"}")).RootElement.GetProperty("result");
        Assert.True(wd.GetProperty("ok").GetBoolean());
        Assert.Equal(85, wd.GetProperty("newBalance").GetDouble());
        var over = JsonDocument.Parse(_f.Run("payment.applyWithdraw", "{\"account\":" + acc + ",\"amount\":\"999\"}")).RootElement.GetProperty("result");
        Assert.False(over.GetProperty("ok").GetBoolean());
        Assert.Equal("business-rule", over.GetProperty("kind").GetString());
    }

    [Fact]
    public void WarrantySave_ValidatesAndClosesShortPath()
    {
        var bad = _f.Run("warranty.save", """{"record":{"name":"","phone":"","devices":[],"initialService":"activate"},"isNew":true,"now":"1405/05/23"}""");
        Assert.False(JsonDocument.Parse(bad).RootElement.GetProperty("result").GetProperty("ok").GetBoolean());
        var ok = _f.Run("warranty.save", """{"record":{"id":"W-1","name":"علی","phone":"0912","devices":[{}],"initialService":"phone_fix","phoneResolution":{"note":"رفع شد"},"problem":""},"isNew":true,"now":"1405/05/23"}""");
        var rec = JsonDocument.Parse(ok).RootElement.GetProperty("result").GetProperty("record");
        Assert.Equal("closed", rec.GetProperty("status").GetString());
        Assert.Equal("phone_fix", rec.GetProperty("closeReason").GetString());
    }

    [Fact]
    public void WarrantyClose_RequiresCompanyFields()
    {
        var json = _f.Run("warranty.close", """
        {"record":{"id":"W-2","name":"علی","phone":"0912","status":"open","problem":"خراب","initialService":"refer_company","devices":[{}],"companyWork":{},"companyReport":{}},"deviceCount":1,"problem":"خراب","closedAt":"1405/05/23"}
        """);
        var res = JsonDocument.Parse(json).RootElement.GetProperty("result");
        Assert.False(res.GetProperty("ok").GetBoolean());
        Assert.True(res.GetProperty("missing").GetArrayLength() > 0);
    }

    [Fact]
    public void WarrantyClose_OpenToClosed_IsSingleWriterDecision()
    {
        var json = _f.Run("warranty.close", """
        {"record":{"id":"W-3","name":"علی","phone":"0912","status":"open","problem":"خراب","initialService":"activate","devices":[{}]},"deviceCount":1,"problem":"خراب","closedAt":"1405/05/23 10:00"}
        """);
        var res = JsonDocument.Parse(json).RootElement.GetProperty("result");
        Assert.True(res.GetProperty("ok").GetBoolean());
        Assert.Equal("closed", res.GetProperty("record").GetProperty("status").GetString());
        Assert.Equal("1405/05/23 10:00", res.GetProperty("record").GetProperty("closedAt").GetString());
    }

    [Fact]
    public void InvoiceClose_ConsumesInventoryAndSetsStatus()
    {
        var json = _f.Run("invoice.close", """
        {"invoice":{"num":"INV-1","seller":"حسین","status":"open","items":[{"code":"G1","est":1000,"disc":0,"finRaw":1000}]},"inventory":{"G1":{"code":"G1","qty":4}},"now":"1405/05/23"}
        """);
        var res = JsonDocument.Parse(json).RootElement.GetProperty("result");
        Assert.True(res.GetProperty("ok").GetBoolean());
        Assert.Equal("closed", res.GetProperty("invoice").GetProperty("status").GetString());
        Assert.Equal(3, res.GetProperty("inventory").GetProperty("G1").GetProperty("qty").GetInt32());
    }

    [Fact]
    public void InvoiceClose_RejectsAlreadyClosed()
    {
        var json = _f.Run("invoice.close", """{"invoice":{"seller":"حسین","status":"closed","items":[{}]}}""");
        var res = JsonDocument.Parse(json).RootElement.GetProperty("result");
        Assert.False(res.GetProperty("ok").GetBoolean());
    }

    [Fact]
    public void ServiceSave_UsesWarrantyWorkflow()
    {
        var json = _f.Run("service.save", """{"record":{"id":"S-1","name":"مریم","phone":"0935","devices":[{}],"initialService":"activate","phoneResolution":{"note":"فعالسازی"}},"isNew":true,"now":"1405/05/23"}""");
        var res = JsonDocument.Parse(json).RootElement.GetProperty("result");
        Assert.True(res.GetProperty("ok").GetBoolean());
        Assert.Equal("open", res.GetProperty("record").GetProperty("status").GetString());
    }

    [Fact]
    public void UnknownOp_IsControlledError()
    {
        var j = JsonDocument.Parse(_f.Run("no.such", "{}")).RootElement;
        Assert.False(j.GetProperty("ok").GetBoolean());
        Assert.False(j.GetRawText().Contains("InvalidOperation", StringComparison.Ordinal));
        Assert.False(j.GetRawText().Contains("at Sirman", StringComparison.Ordinal));
    }

    [Fact]
    public void SuggestParts_UsesAvailableNotRawQty()
    {
        var json = _f.Run("rules.suggestParts", """{"prodCode":"402003","model":"چای‌ساز","problem":"هیتر","parts":[{"code":"P-HEAT","name":"هیتر","prodCode":"402003","cat":"گرمایش","qty":10,"reserved":4}]}""");
        var hits = JsonDocument.Parse(json).RootElement.GetProperty("result");
        Assert.Equal(6, hits[0].GetProperty("qty").GetDouble());
    }
}
