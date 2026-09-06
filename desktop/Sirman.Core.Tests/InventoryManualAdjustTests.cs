using System.Text.Json;
using Sirman.Core.Application;
using Xunit;

namespace Sirman.Core.Tests;

/// <summary>
/// P0 — inventory.adjust / inventory.removeStock through BusinessFacade.
/// Does not change InventoryCore semantics; locks the live cutover contract.
/// </summary>
public class InventoryManualAdjustTests
{
    private readonly BusinessFacade _facade = new();

    private static JsonElement Result(string json)
    {
        var root = JsonDocument.Parse(json).RootElement;
        Assert.True(root.GetProperty("ok").GetBoolean());
        return root.GetProperty("result");
    }

    [Fact]
    public void Adjust_SetsAbsoluteQty_AndPersistKeysInventory()
    {
        var res = Result(_facade.Run("inventory.adjust", """{"item":{"code":"P1","qty":10,"reserved":0},"qty":15,"whId":""}"""));
        Assert.True(res.GetProperty("ok").GetBoolean());
        Assert.Equal(15, res.GetProperty("item").GetProperty("qty").GetInt32());
        Assert.Equal("inventory", res.GetProperty("persistKeys")[0].GetString());
    }

    [Fact]
    public void Adjust_ZeroQty_AllowedWhenUnreserved()
    {
        var res = Result(_facade.Run("inventory.adjust", """{"item":{"code":"P1","qty":10,"reserved":0},"qty":0,"whId":""}"""));
        Assert.True(res.GetProperty("ok").GetBoolean());
        Assert.Equal(0, res.GetProperty("item").GetProperty("qty").GetInt32());
    }

    [Fact]
    public void Adjust_NegativeQty_Rejected()
    {
        var res = Result(_facade.Run("inventory.adjust", """{"item":{"code":"P1","qty":10,"reserved":0},"qty":-3,"whId":""}"""));
        Assert.False(res.GetProperty("ok").GetBoolean());
        Assert.Equal("مقدار نامعتبر", res.GetProperty("err").GetString());
        Assert.Equal(0, res.GetProperty("persistKeys").GetArrayLength());
    }

    [Fact]
    public void Adjust_InsufficientWhenReserved_FailClosed()
    {
        var res = Result(_facade.Run("inventory.adjust", """{"item":{"code":"P1","qty":10,"reserved":8},"qty":1,"whId":""}"""));
        Assert.False(res.GetProperty("ok").GetBoolean());
        Assert.Contains("موجودی قابل‌استفاده کافی نیست", res.GetProperty("err").GetString());
        Assert.Equal(0, res.GetProperty("persistKeys").GetArrayLength());
    }

    [Fact]
    public void Adjust_MalformedQty_TreatedAsZero()
    {
        var res = Result(_facade.Run("inventory.adjust", """{"item":{"code":"P1","qty":10,"reserved":0},"qty":"abc","whId":""}"""));
        Assert.True(res.GetProperty("ok").GetBoolean());
        Assert.Equal(0, res.GetProperty("item").GetProperty("qty").GetInt32());
    }

    [Fact]
    public void RemoveStock_Decrements_AndPersistKeysInventory()
    {
        var res = Result(_facade.Run("inventory.removeStock", """{"item":{"code":"P1","qty":10,"reserved":0},"qty":3,"whId":""}"""));
        Assert.True(res.GetProperty("ok").GetBoolean());
        Assert.Equal(7, res.GetProperty("item").GetProperty("qty").GetInt32());
        Assert.Equal("inventory", res.GetProperty("persistKeys")[0].GetString());
    }

    [Fact]
    public void RemoveStock_MoreThanAvailable_Rejected()
    {
        var res = Result(_facade.Run("inventory.removeStock", """{"item":{"code":"P1","qty":10,"reserved":0},"qty":99,"whId":""}"""));
        Assert.False(res.GetProperty("ok").GetBoolean());
        Assert.Contains("موجودی قابل‌استفاده کافی نیست", res.GetProperty("err").GetString());
        Assert.Equal(0, res.GetProperty("persistKeys").GetArrayLength());
    }

    [Fact]
    public void RemoveStock_InvalidQty_Rejected()
    {
        var res = Result(_facade.Run("inventory.removeStock", """{"item":{"code":"P1","qty":10,"reserved":0},"qty":0,"whId":""}"""));
        Assert.False(res.GetProperty("ok").GetBoolean());
        Assert.Equal("مقدار نامعتبر", res.GetProperty("err").GetString());
        Assert.Equal(0, res.GetProperty("persistKeys").GetArrayLength());
    }
}
