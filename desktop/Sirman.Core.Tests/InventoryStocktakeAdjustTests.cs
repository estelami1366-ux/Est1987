using System.Text.Json;
using Sirman.Core.Application;
using Xunit;

namespace Sirman.Core.Tests;

/// <summary>
/// P2 — stocktake uses the existing inventory.adjust absolute contract
/// (empty whId = general stock). Locks Facade/Core behavior the HTML
/// stocktake path calls; does not add a new Core operation.
/// </summary>
public class InventoryStocktakeAdjustTests
{
    private readonly BusinessFacade _facade = new();

    private static JsonElement Result(string json)
    {
        var root = JsonDocument.Parse(json).RootElement;
        Assert.True(root.GetProperty("ok").GetBoolean());
        return root.GetProperty("result");
    }

    [Fact]
    public void Adjust_EmptyWhId_SetsAbsoluteGeneralQty()
    {
        var res = Result(_facade.Run("inventory.adjust", """{"item":{"code":"G-1","qty":10,"reserved":0},"qty":15,"whId":""}"""));
        Assert.True(res.GetProperty("ok").GetBoolean());
        Assert.Equal(15, res.GetProperty("item").GetProperty("qty").GetInt32());
        Assert.Equal("inventory", res.GetProperty("persistKeys")[0].GetString());
    }

    [Fact]
    public void Adjust_LowerAndZero_AllowedWhenUnreserved()
    {
        var down = Result(_facade.Run("inventory.adjust", """{"item":{"code":"G-1","qty":10,"reserved":0},"qty":4,"whId":""}"""));
        Assert.True(down.GetProperty("ok").GetBoolean());
        Assert.Equal(4, down.GetProperty("item").GetProperty("qty").GetInt32());
        var zero = Result(_facade.Run("inventory.adjust", """{"item":{"code":"G-1","qty":10,"reserved":0},"qty":0,"whId":""}"""));
        Assert.True(zero.GetProperty("ok").GetBoolean());
        Assert.Equal(0, zero.GetProperty("item").GetProperty("qty").GetInt32());
    }

    [Fact]
    public void Adjust_DefectiveIn_IncrementsQty()
    {
        var res = Result(_facade.Run("inventory.adjust", """{"item":{"id":"DEF-0001","qty":1,"status":"in_stock"},"qty":2,"whId":""}"""));
        Assert.True(res.GetProperty("ok").GetBoolean());
        Assert.Equal(2, res.GetProperty("item").GetProperty("qty").GetInt32());
        Assert.Equal("in_stock", res.GetProperty("item").GetProperty("status").GetString());
    }

    [Fact]
    public void Adjust_DefectiveOut_ZerosAndMarksReturned()
    {
        var res = Result(_facade.Run("inventory.adjust", """{"item":{"id":"DEF-0002","qty":1,"status":"in_stock"},"qty":0,"whId":""}"""));
        Assert.True(res.GetProperty("ok").GetBoolean());
        Assert.Equal(0, res.GetProperty("item").GetProperty("qty").GetInt32());
        Assert.Equal("returned", res.GetProperty("item").GetProperty("status").GetString());
    }
}
