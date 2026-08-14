using System.Text.Json;
using System.Text.Json.Nodes;
using Sirman.Core.Application;
using Sirman.Core.Business;
using Xunit;

namespace Sirman.Core.Tests;

public class TransactionReversalTests
{
    private readonly BusinessFacade _f = new();

    [Fact]
    public void Test1_BasicInvoiceReversal_RestoresStockAndAccount()
    {
        var closed = Res("invoice.close", """
        {"invoice":{"num":"INV-A","seller":"فروشگاه","status":"open","items":[{"code":"P1","est":100,"disc":0,"finRaw":100}]},
         "inventory":{"P1":{"code":"P1","qty":10}},"now":"1405/05/23"}
        """);
        Assert.Equal(9, closed.GetProperty("inventory").GetProperty("P1").GetProperty("qty").GetInt32());

        var paid = Res("payment.applyDeposit", """
        {"account":{"id":"ACC-1","balance":0,"transactions":[]},"amount":100,"subject":"فاکتور INV-A","refId":"INV-A","refType":"invoice","date":"1405/05/23"}
        """);
        Assert.Equal(100, paid.GetProperty("account").GetProperty("balance").GetDouble());

        var paidAcc = paid.GetProperty("account").GetRawText();
        var del = Res("invoice.delete",
            "{\"invoice\":{\"num\":\"INV-A\",\"status\":\"closed\",\"items\":[{\"code\":\"P1\"}]}," +
            "\"invoices\":[{\"num\":\"INV-A\",\"status\":\"closed\",\"items\":[{\"code\":\"P1\"}]}]," +
            "\"inventory\":{\"P1\":{\"code\":\"P1\",\"qty\":9}}," +
            "\"accounts\":[" + paidAcc + "]," +
            "\"now\":\"1405/05/23\",\"user\":\"tester\"}");
        Assert.True(del.GetProperty("ok").GetBoolean());
        Assert.False(del.GetProperty("alreadyReversed").GetBoolean());
        Assert.Equal(10, del.GetProperty("inventory").GetProperty("P1").GetProperty("qty").GetInt32());
        Assert.Equal(0, del.GetProperty("accounts")[0].GetProperty("balance").GetDouble());
        Assert.Equal(0, del.GetProperty("accounts")[0].GetProperty("transactions").GetArrayLength());
        Assert.Equal(0, del.GetProperty("invoices").GetArrayLength());
        Assert.Equal("INV-A", del.GetProperty("removedId").GetString());
        Assert.True(del.GetProperty("audit").GetProperty("Reversal").GetBoolean());
    }

    [Fact]
    public void Test2_WarrantyAndInvoice_BothSideEffectsReverse()
    {
        var invDel = Res("invoice.delete", """
        {"invoice":{"num":"INV-W","status":"closed","items":[{"code":"G1"}]},
         "invoices":[{"num":"INV-W","status":"closed","items":[{"code":"G1"}]}],
         "inventory":{"G1":{"code":"G1","qty":4}},
         "accounts":[{"id":"ACC-1","balance":100,"transactions":[{"id":"TRX-1","type":"deposit","amount":100,"refId":"INV-W","refType":"invoice"}]}],
         "now":"1405/05/23"}
        """);
        Assert.Equal(5, invDel.GetProperty("inventory").GetProperty("G1").GetProperty("qty").GetInt32());
        Assert.Equal(0, invDel.GetProperty("accounts")[0].GetProperty("balance").GetDouble());

        var warDel = Res("warranty.delete", """
        {"record":{"id":"W-1","_companyStockApplied":{"applied":true,"items":[{"code":"A","qty":1}]},
          "_companyBillApplied":{"applied":true,"amount":80,"accountId":"ACC-1"}},
         "warranties":[{"id":"W-1"}],
         "parts":[{"code":"A","qty":9}],
         "accounts":[{"id":"ACC-1","balance":80,"transactions":[{"id":"TRX-2","type":"deposit","amount":80,"refId":"W-1","refType":"service"}]}],
         "now":"1405/05/23"}
        """);
        Assert.Equal(10, Qty(warDel.GetProperty("parts")[0]));
        Assert.Equal(0, warDel.GetProperty("accounts")[0].GetProperty("balance").GetDouble());
        Assert.Equal(0, warDel.GetProperty("warranties").GetArrayLength());
    }

    [Fact]
    public void Test3_MultipleParts_RestoreExactQuantities()
    {
        var del = Res("warranty.delete", """
        {"record":{"id":"W-M","_agencyStockApplied":{"applied":true,"items":[{"code":"A","qty":2},{"code":"B","qty":3}]}},
         "warranties":[{"id":"W-M"}],
         "parts":[{"code":"A","qty":8},{"code":"B","qty":17}],
         "accounts":[],
         "now":"1405/05/23"}
        """);
        Assert.Equal(10, Qty(Part(del, "A")));
        Assert.Equal(20, Qty(Part(del, "B")));
    }

    [Fact]
    public void Test4_TwoTransactions_DeleteALeavesB()
    {
        var del = Res("invoice.delete", """
        {"invoice":{"num":"INV-A","status":"closed","items":[{"code":"A"},{"code":"A"}]},
         "invoices":[
           {"num":"INV-A","status":"closed","items":[{"code":"A"},{"code":"A"}]},
           {"num":"INV-B","status":"closed","items":[{"code":"A"},{"code":"A"},{"code":"A"}]}
         ],
         "inventory":{"A":{"code":"A","qty":5}},
         "accounts":[{"id":"ACC-1","balance":300,"transactions":[
           {"id":"TRX-A","type":"deposit","amount":100,"refId":"INV-A","refType":"invoice"},
           {"id":"TRX-B","type":"deposit","amount":200,"refId":"INV-B","refType":"invoice"}
         ]}],
         "now":"1405/05/23"}
        """);
        Assert.Equal(7, del.GetProperty("inventory").GetProperty("A").GetProperty("qty").GetInt32());
        Assert.Equal(200, del.GetProperty("accounts")[0].GetProperty("balance").GetDouble());
        Assert.Equal(1, del.GetProperty("accounts")[0].GetProperty("transactions").GetArrayLength());
        Assert.Equal("INV-B", del.GetProperty("accounts")[0].GetProperty("transactions")[0].GetProperty("refId").GetString());
        Assert.Equal(1, del.GetProperty("invoices").GetArrayLength());
        Assert.Equal("INV-B", del.GetProperty("invoices")[0].GetProperty("num").GetString());
    }

    [Fact]
    public void Test5_DoubleDelete_IsIdempotent()
    {
        const string firstJson = """
        {"invoice":{"num":"INV-A","status":"closed","items":[{"code":"A"}]},
         "invoices":[{"num":"INV-A","status":"closed","items":[{"code":"A"}]}],
         "inventory":{"A":{"code":"A","qty":9}},
         "accounts":[{"id":"ACC-1","balance":100,"transactions":[{"id":"TRX-1","type":"deposit","amount":100,"refId":"INV-A","refType":"invoice"}]}],
         "now":"1405/05/23"}
        """;
        var first = Res("invoice.delete", firstJson);
        Assert.Equal(10, first.GetProperty("inventory").GetProperty("A").GetProperty("qty").GetInt32());
        Assert.Equal(0, first.GetProperty("accounts")[0].GetProperty("balance").GetDouble());

        var second = Res("invoice.delete",
            "{\"invoice\":{\"num\":\"INV-A\",\"status\":\"closed\",\"items\":[{\"code\":\"A\"}]}," +
            "\"invoices\":[]," +
            "\"inventory\":{\"A\":{\"code\":\"A\",\"qty\":10}}," +
            "\"accounts\":[" + first.GetProperty("accounts")[0].GetRawText() + "]," +
            "\"now\":\"1405/05/23\"}");
        Assert.True(second.GetProperty("alreadyReversed").GetBoolean());
        Assert.Equal(10, second.GetProperty("inventory").GetProperty("A").GetProperty("qty").GetInt32());
        Assert.Equal(0, second.GetProperty("accounts")[0].GetProperty("balance").GetDouble());
        Assert.Equal(0, second.GetProperty("accounts")[0].GetProperty("transactions").GetArrayLength());
    }

    [Fact]
    public void SaleDelete_DuplicateId_UsesSaleIndex_RemovesOnlyClicked()
    {
        var del = Res("sale.delete", """
        {"sale":{"id":"SL-0002","status":"final","name":"جدید","total":200,"items":[{"partCode":"A","qty":2}]},
         "saleIndex":1,
         "sales":[
           {"id":"SL-0002","status":"final","name":"قدیمی","total":100,"items":[{"partCode":"A","qty":1}]},
           {"id":"SL-0002","status":"final","name":"جدید","total":200,"items":[{"partCode":"A","qty":2}]}
         ],
         "parts":[{"code":"A","qty":7}],
         "accounts":[{"id":"ACC-1","balance":300,"transactions":[
           {"amount":100,"refId":"SL-0002","refType":"sale","type":"deposit"},
           {"amount":200,"refId":"SL-0002","refType":"sale","type":"deposit"}
         ]}],
         "now":"1405/05/23"}
        """);
        Assert.True(del.GetProperty("ok").GetBoolean());
        Assert.Equal(1, del.GetProperty("sales").GetArrayLength());
        Assert.Equal("قدیمی", del.GetProperty("sales")[0].GetProperty("name").GetString());
        Assert.Equal(9, Qty(del.GetProperty("parts")[0]));
        Assert.Equal(100, del.GetProperty("accounts")[0].GetProperty("balance").GetDouble());
        Assert.Equal(1, del.GetProperty("accounts")[0].GetProperty("transactions").GetArrayLength());
        Assert.Equal(100, del.GetProperty("accounts")[0].GetProperty("transactions")[0].GetProperty("amount").GetDouble());
    }

    [Fact]
    public void Test6_RestartSnapshot_KeepsReversedState()
    {
        var del = Res("invoice.delete", """
        {"invoice":{"num":"INV-R","status":"closed","items":[{"code":"A"}]},
         "invoices":[{"num":"INV-R","status":"closed","items":[{"code":"A"}]}],
         "inventory":{"A":{"code":"A","qty":9}},
         "accounts":[{"id":"ACC-1","balance":100,"transactions":[{"amount":100,"refId":"INV-R","refType":"invoice","type":"deposit"}]}],
         "now":"1405/05/23"}
        """);
        var snap = new JsonObject
        {
            ["inventory"] = JsonNode.Parse(del.GetProperty("inventory").GetRawText()),
            ["accounts"] = JsonNode.Parse(del.GetProperty("accounts").GetRawText()),
            ["invoices"] = JsonNode.Parse(del.GetProperty("invoices").GetRawText())
        };
        var round = JsonNode.Parse(snap.ToJsonString())!.AsObject();
        Assert.Equal(10, round["inventory"]!["A"]!["qty"]!.GetValue<int>());
        Assert.Equal(0, round["accounts"]![0]!["balance"]!.GetValue<double>());
        Assert.Equal(0, round["invoices"]!.AsArray().Count);
    }

    [Fact]
    public void Test7_ExistingUnrelatedData_Unchanged()
    {
        var del = Res("invoice.delete", """
        {"invoice":{"num":"INV-A","status":"closed","items":[{"code":"A"}]},
         "invoices":[
           {"num":"INV-A","status":"closed","items":[{"code":"A"}]},
           {"num":"INV-KEEP","status":"closed","seller":"دیگر","items":[{"code":"B"}]}
         ],
         "inventory":{"A":{"code":"A","qty":9},"B":{"code":"B","qty":20}},
         "accounts":[{"id":"ACC-1","balance":150,"transactions":[
           {"amount":50,"refId":"INV-A","refType":"invoice","type":"deposit"},
           {"amount":100,"refId":"MAN-1","refType":"manual","type":"deposit"}
         ]}],
         "now":"1405/05/23"}
        """);
        Assert.Equal(10, del.GetProperty("inventory").GetProperty("A").GetProperty("qty").GetInt32());
        Assert.Equal(20, del.GetProperty("inventory").GetProperty("B").GetProperty("qty").GetInt32());
        Assert.Equal(100, del.GetProperty("accounts")[0].GetProperty("balance").GetDouble());
        Assert.Equal("MAN-1", del.GetProperty("accounts")[0].GetProperty("transactions")[0].GetProperty("refId").GetString());
        Assert.Equal("INV-KEEP", del.GetProperty("invoices")[0].GetProperty("num").GetString());
    }

    [Fact]
    public void OpenInvoice_DoesNotRestock()
    {
        var del = Res("invoice.delete", """
        {"invoice":{"num":"INV-OPEN","status":"open","items":[{"code":"A"}]},
         "invoices":[{"num":"INV-OPEN","status":"open","items":[{"code":"A"}]}],
         "inventory":{"A":{"code":"A","qty":10}},
         "accounts":[{"id":"ACC-1","balance":0,"transactions":[]}],
         "now":"1405/05/23"}
        """);
        Assert.Equal(10, del.GetProperty("inventory").GetProperty("A").GetProperty("qty").GetInt32());
        Assert.Equal(0, del.GetProperty("invoices").GetArrayLength());
    }

    [Fact]
    public void AgencyPayWithoutRefId_ReversesByAmountAndSubject()
    {
        var del = Res("warranty.delete", """
        {"record":{"id":"W-PAY","_agencyPayApplied":{"applied":true,"amount":40,"accountId":"ACC-1"}},
         "warranties":[{"id":"W-PAY"}],
         "parts":[],
         "accounts":[{"id":"ACC-1","balance":60,"transactions":[
           {"id":"TRX-1","type":"withdraw","amount":-40,"subject":"هزینه نمایندگی گارانتی W-PAY","refId":"","refType":"manual"}
         ]}],
         "now":"1405/05/23"}
        """);
        Assert.Equal(100, del.GetProperty("accounts")[0].GetProperty("balance").GetDouble());
        Assert.Equal(0, del.GetProperty("accounts")[0].GetProperty("transactions").GetArrayLength());
    }

    [Fact]
    public void DoesNotTouchUnrelatedManualDeposit()
    {
        var acc = PaymentRules.ApplyDeposit(new JsonObject { ["id"] = "ACC-1", ["balance"] = 0, ["transactions"] = new JsonArray() }, 70, "دستی", "", "manual", "1405/05/23");
        var r = PaymentRules.ReverseOwned(acc.Account, "INV-X");
        Assert.True(r.Ok);
        Assert.Equal(0, r.RemovedCount);
        Assert.Equal(70, r.NewBalance);
    }

    [Fact]
    public void FinancialReversal_UsesRefIdEvenIfRefTypeDiffers()
    {
        var del = Res("invoice.delete", """
        {"invoice":{"num":"LEP-0007","status":"closed","items":[{"code":"A"}]},
         "invoices":[{"num":"LEP-0007","status":"closed","items":[{"code":"A"}]}],
         "inventory":{"A":{"code":"A","qty":9}},
         "accounts":[{"id":"ACC-1","balance":150,"transactions":[
           {"amount":50,"refId":"LEP-0007","refType":"service","type":"deposit"},
           {"amount":100,"refId":"","refType":"manual","type":"deposit","subject":"دستی"}
         ]}],
         "now":"1405/05/23"}
        """);
        Assert.Equal(100, del.GetProperty("accounts")[0].GetProperty("balance").GetDouble());
        Assert.Equal(1, del.GetProperty("accounts")[0].GetProperty("transactions").GetArrayLength());
        Assert.Equal("دستی", del.GetProperty("accounts")[0].GetProperty("transactions")[0].GetProperty("subject").GetString());
    }

    [Fact]
    public void SaleDelete_RestoresPartsAndReversesPayment()
    {
        var del = Res("sale.delete", """
        {"sale":{"id":"SL-0001","status":"final","items":[{"partCode":"A","qty":1}]},
         "sales":[{"id":"SL-0001","status":"final","items":[{"partCode":"A","qty":1}]}],
         "parts":[{"code":"A","qty":9}],
         "accounts":[{"id":"ACC-1","balance":100,"transactions":[{"amount":100,"refId":"SL-0001","refType":"sale","type":"deposit"}]}],
         "now":"1405/05/23"}
        """);
        Assert.True(del.GetProperty("ok").GetBoolean());
        Assert.Equal(10, Qty(del.GetProperty("parts")[0]));
        Assert.Equal(0, del.GetProperty("accounts")[0].GetProperty("balance").GetDouble());
        Assert.Equal(0, del.GetProperty("accounts")[0].GetProperty("transactions").GetArrayLength());
        Assert.Equal(0, del.GetProperty("sales").GetArrayLength());
        Assert.Equal("SL-0001", del.GetProperty("removedId").GetString());
    }

    [Fact]
    public void SaleDelete_LeavesOtherSaleUntouched()
    {
        var del = Res("sale.delete", """
        {"sale":{"id":"SL-A","status":"final","items":[{"partCode":"A","qty":2}]},
         "sales":[
           {"id":"SL-A","status":"final","items":[{"partCode":"A","qty":2}]},
           {"id":"SL-B","status":"final","items":[{"partCode":"A","qty":3}]}
         ],
         "parts":[{"code":"A","qty":5}],
         "accounts":[{"id":"ACC-1","balance":300,"transactions":[
           {"amount":100,"refId":"SL-A","refType":"sale","type":"deposit"},
           {"amount":200,"refId":"SL-B","refType":"sale","type":"deposit"}
         ]}],
         "now":"1405/05/23"}
        """);
        Assert.Equal(7, Qty(del.GetProperty("parts")[0]));
        Assert.Equal(200, del.GetProperty("accounts")[0].GetProperty("balance").GetDouble());
        Assert.Equal("SL-B", del.GetProperty("accounts")[0].GetProperty("transactions")[0].GetProperty("refId").GetString());
        Assert.Equal("SL-B", del.GetProperty("sales")[0].GetProperty("id").GetString());
    }

    [Fact]
    public void SaleProforma_DoesNotRestockOrReverseMoney()
    {
        var del = Res("sale.delete", """
        {"sale":{"id":"SL-P","status":"proforma","items":[{"partCode":"A","qty":2}]},
         "sales":[{"id":"SL-P","status":"proforma","items":[{"partCode":"A","qty":2}]}],
         "parts":[{"code":"A","qty":10}],
         "accounts":[{"id":"ACC-1","balance":0,"transactions":[]}],
         "now":"1405/05/23"}
        """);
        Assert.Equal(10, Qty(del.GetProperty("parts")[0]));
        Assert.Equal(0, del.GetProperty("accounts")[0].GetProperty("balance").GetDouble());
        Assert.Equal("SL-P", del.GetProperty("removedId").GetString());
        Assert.Equal(0, del.GetProperty("sales").GetArrayLength());
    }

    [Fact]
    public void SaleDelete_SaveSaleShapedPayload_RemovesRecord()
    {
        var del = Res("sale.delete", """
        {"sale":{"id":"SL-0001","status":"final","name":"خریدار","phone":"0912",
          "items":[{"partCode":"A","partName":"قطعه آ","qty":2,"price":100,"disc":0,"discAmt":0,"total":200}],
          "total":200,"docs":[{"name":"x.png","data":"data:image/png;base64,AAA","mime":"image/png"}],
          "accountSel":"ACC-1","date":"1405/05/23"},
         "sales":[{"id":"SL-0001","status":"final","name":"خریدار","phone":"0912",
          "items":[{"partCode":"A","partName":"قطعه آ","qty":2,"price":100,"disc":0,"total":200}],
          "total":200,"docs":[{"name":"x.png","data":"data:image/png;base64,AAA"}],
          "accountSel":"ACC-1"}],
         "parts":[{"code":"A","qty":8}],
         "accounts":[{"id":"ACC-1","balance":200,"transactions":[{"amount":200,"refId":"SL-0001","refType":"sale","type":"deposit"}]}],
         "now":"1405/05/23","user":"tester"}
        """);
        Assert.True(del.GetProperty("ok").GetBoolean());
        Assert.False(del.GetProperty("alreadyReversed").GetBoolean());
        Assert.Equal("SL-0001", del.GetProperty("removedId").GetString());
        Assert.Equal(0, del.GetProperty("sales").GetArrayLength());
        Assert.Equal(10, Qty(del.GetProperty("parts")[0]));
        Assert.Equal(0, del.GetProperty("accounts")[0].GetProperty("balance").GetDouble());
    }

    [Fact]
    public void SaleDelete_MultipleParts_RemovesSale()
    {
        var del = Res("sale.delete", """
        {"sale":{"id":"SL-M","status":"final","items":[{"partCode":"A","qty":2},{"partCode":"B","qty":3}]},
         "sales":[{"id":"SL-M","status":"final","items":[{"partCode":"A","qty":2},{"partCode":"B","qty":3}]}],
         "parts":[{"code":"A","qty":8},{"code":"B","qty":17}],
         "accounts":[],
         "now":"1405/05/23"}
        """);
        Assert.True(del.GetProperty("ok").GetBoolean());
        Assert.Equal(0, del.GetProperty("sales").GetArrayLength());
        Assert.Equal("SL-M", del.GetProperty("removedId").GetString());
        Assert.Equal(10, Qty(Part(del, "A")));
        Assert.Equal(20, Qty(Part(del, "B")));
    }

    [Fact]
    public void SaleDelete_MissingRecord_IsAlreadyReversed()
    {
        var del = Res("sale.delete", """
        {"sale":{"id":"SL-GONE","status":"final","items":[{"partCode":"A","qty":1}]},
         "sales":[],
         "parts":[{"code":"A","qty":10}],
         "accounts":[],
         "now":"1405/05/23"}
        """);
        Assert.True(del.GetProperty("ok").GetBoolean());
        Assert.True(del.GetProperty("alreadyReversed").GetBoolean());
        Assert.Equal(0, del.GetProperty("sales").GetArrayLength());
    }

    [Fact]
    public void SaleDelete_DoubleDelete_IsIdempotent()
    {
        const string firstJson = """
        {"sale":{"id":"SL-D","status":"final","items":[{"partCode":"A","qty":1}]},
         "sales":[{"id":"SL-D","status":"final","items":[{"partCode":"A","qty":1}]}],
         "parts":[{"code":"A","qty":9}],
         "accounts":[{"id":"ACC-1","balance":100,"transactions":[{"amount":100,"refId":"SL-D","refType":"sale","type":"deposit"}]}],
         "now":"1405/05/23"}
        """;
        var first = Res("sale.delete", firstJson);
        Assert.Equal(0, first.GetProperty("sales").GetArrayLength());
        Assert.Equal(10, Qty(first.GetProperty("parts")[0]));

        var second = Res("sale.delete",
            "{\"sale\":{\"id\":\"SL-D\",\"status\":\"final\",\"items\":[{\"partCode\":\"A\",\"qty\":1}]}," +
            "\"sales\":[]," +
            "\"parts\":[{\"code\":\"A\",\"qty\":10}]," +
            "\"accounts\":[" + first.GetProperty("accounts")[0].GetRawText() + "]," +
            "\"now\":\"1405/05/23\"}");
        Assert.True(second.GetProperty("alreadyReversed").GetBoolean());
        Assert.Equal(10, Qty(second.GetProperty("parts")[0]));
        Assert.Equal(0, second.GetProperty("accounts")[0].GetProperty("balance").GetDouble());
    }

    private JsonElement Res(string op, string json)
    {
        var raw = _f.Run(op, json);
        var root = JsonDocument.Parse(raw).RootElement;
        Assert.True(root.GetProperty("ok").GetBoolean(), raw);
        return root.GetProperty("result");
    }

    private static int Qty(JsonElement item) => item.GetProperty("qty").GetInt32();

    private static JsonElement Part(JsonElement del, string code)
    {
        foreach (var p in del.GetProperty("parts").EnumerateArray())
            if (p.GetProperty("code").GetString() == code) return p;
        throw new Xunit.Sdk.XunitException("part not found: " + code);
    }
}
