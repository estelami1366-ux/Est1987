using System.Text.Json;
using Sirman.Core.Application;
using Xunit;

namespace Sirman.Core.Tests;

/// <summary>
/// P1 — Excel product import uses inventory.adjust as an absolute target
/// on a newly created item (qty starts at 0). Locks the Facade contract
/// the HTML importer calls; does not change InventoryCore semantics.
/// </summary>
public class InventoryExcelImportTests
{
    private readonly BusinessFacade _facade = new();

    private static JsonElement Result(string json)
    {
        var root = JsonDocument.Parse(json).RootElement;
        Assert.True(root.GetProperty("ok").GetBoolean());
        return root.GetProperty("result");
    }

    [Fact]
    public void Adjust_NewItemFromZero_SetsAbsoluteExcelQty()
    {
        var res = Result(_facade.Run("inventory.adjust", """{"item":{"code":"P-100","qty":0,"min":3,"note":""},"qty":10,"whId":""}"""));
        Assert.True(res.GetProperty("ok").GetBoolean());
        Assert.Equal(10, res.GetProperty("item").GetProperty("qty").GetInt32());
        Assert.Equal(3, res.GetProperty("item").GetProperty("min").GetInt32());
        Assert.Equal("inventory", res.GetProperty("persistKeys")[0].GetString());
    }

    [Fact]
    public void Adjust_NewItemZeroQty_IsAllowed()
    {
        var res = Result(_facade.Run("inventory.adjust", """{"item":{"code":"P-0","qty":0},"qty":0,"whId":""}"""));
        Assert.True(res.GetProperty("ok").GetBoolean());
        Assert.Equal(0, res.GetProperty("item").GetProperty("qty").GetInt32());
    }

    [Fact]
    public void Adjust_NewItemNegativeExcelQty_Rejected()
    {
        var res = Result(_facade.Run("inventory.adjust", """{"item":{"code":"P-N","qty":0},"qty":-3,"whId":""}"""));
        Assert.False(res.GetProperty("ok").GetBoolean());
        Assert.Equal("مقدار نامعتبر", res.GetProperty("err").GetString());
        Assert.Equal(0, res.GetProperty("persistKeys").GetArrayLength());
    }
}
