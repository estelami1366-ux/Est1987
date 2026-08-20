using System.Text.Json.Nodes;
using Sirman.Core.Data.Repositories;
using Sirman.Core.Security;
using Xunit;
using CurrentJsonStore = Sirman.Core.Data.CurrentJsonStore;

namespace Sirman.Core.Tests;

public class RepositoryContractTests
{
    [Fact]
    public void FakeInvoiceRepository_SaveGetDelete_DoesNotNeedJsonStore()
    {
        IInvoiceRepository repo = new FakeInvoiceRepository();
        repo.Save(Obj(("invoiceId", "INVUID-000001"), ("num", "1"), ("date", "1405/05/01"), ("seller", "A")));
        repo.Save(Obj(("invoiceId", "INVUID-000002"), ("num", "2"), ("date", "1405/05/10"), ("seller", "B")));
        Assert.Equal("A", repo.GetById("INVUID-000001")?["seller"]?.ToString());
        Assert.Equal(2, repo.GetAll().Count);
        Assert.Single(repo.GetByDateRange("1405/05/09", "1405/05/11"));
        Assert.True(repo.Delete("INVUID-000002"));
        Assert.Null(repo.GetById("INVUID-000002"));
    }

    [Fact]
    public void FakeInventoryRepository_ReserveAndConsume_AreIsolated()
    {
        IInventoryRepository repo = new FakeInventoryRepository();
        repo.Save(Obj(("code", "P1"), ("qty", 5), ("reserved", 0)));
        Assert.True(repo.Reserve("P1", 2, null).Ok);
        Assert.Equal(2, repo.GetById("P1")?["reserved"]?.GetValue<int>());
        Assert.True(repo.Consume("P1", 1).Ok);
        Assert.Equal(4, repo.GetById("P1")?["qty"]?.GetValue<int>());
    }

    [Fact]
    public void FakePaymentRepository_GetByInvoiceId_And_Reverse()
    {
        IPaymentRepository repo = new FakePaymentRepository();
        var acc = Obj(("id", "acc-1"), ("name", "صندوق"));
        acc["trx"] = new JsonArray
        {
            Obj(("refId", "INVUID-1"), ("amount", -100)),
            Obj(("refId", "OTHER"), ("amount", 50))
        };
        repo.Save(acc);
        Assert.Single(repo.GetByInvoiceId("INVUID-1"));
        repo.Reverse("INVUID-1");
        Assert.Empty(repo.GetByInvoiceId("INVUID-1"));
    }

    [Fact]
    public void FakeWarrantyRepository_ActiveByCustomer_SkipsClosed()
    {
        IWarrantyRepository repo = new FakeWarrantyRepository();
        repo.Save(Obj(("id", "W1"), ("name", "علی"), ("phone", "0912"), ("status", "open")));
        repo.Save(Obj(("id", "W2"), ("name", "علی"), ("phone", "0912"), ("status", "closed")));
        Assert.Single(repo.GetActiveByCustomer("0912"));
        Assert.Equal("W1", repo.GetById("W1")?["id"]?.ToString());
    }

    [Fact]
    public void FakeUserRepository_GetByUsername()
    {
        IUserRepository repo = new FakeUserRepository();
        repo.Save(new LoginUser { Username = "sara", Name = "سارا", Active = true, RoleKey = "staff" });
        Assert.Equal("سارا", repo.GetByUsername("sara")?.Name);
        Assert.Single(repo.GetAll());
    }

    [Fact]
    public void FakeBackupRepository_TbdImportExportMerge()
    {
        IBackupRepository repo = new FakeBackupRepository();
        var imported = repo.Import(Obj(("invoices", 1)));
        Assert.Equal(1, imported["invoices"]?.GetValue<int>());
        Assert.Equal(1, repo.Export()["invoices"]?.GetValue<int>());
        var merged = repo.Merge(Obj(("a", 1)), Obj(("b", 2)));
        Assert.Equal(1, merged["a"]?.GetValue<int>());
        Assert.Equal(2, merged["b"]?.GetValue<int>());
    }

    [Fact]
    public void JsonInvoiceRepository_DelegatesSaveToCurrentJsonStoreMerge()
    {
        var store = new CurrentJsonStore();
        var repo = new JsonInvoiceRepository(store);
        repo.Save(Obj(("invoiceId", "INVUID-9"), ("seller", "X")));
        repo.Save(Obj(("invoiceId", "INVUID-9"), ("num", "12")));
        var got = repo.GetById("INVUID-9");
        Assert.Equal("X", got?["seller"]?.ToString());
        Assert.Equal("12", got?["num"]?.ToString());
    }

    [Fact]
    public void JsonInventoryRepository_Consume_UsesExistingInventoryCore()
    {
        var repo = new JsonInventoryRepository(new CurrentJsonStore());
        repo.Save(Obj(("code", "C1"), ("qty", 3), ("reserved", 0)));
        var r = repo.Consume("C1", 1);
        Assert.True(r.Ok);
        Assert.Equal(2, repo.GetById("C1")?["qty"]?.GetValue<int>());
    }

    [Fact]
    public void JsonBackupRepository_IsExplicitlyTbd()
    {
        var repo = new JsonBackupRepository(new CurrentJsonStore());
        var exported = repo.Export();
        Assert.Equal(JsonBackupRepository.TbdMarker, exported["engine"]?.ToString());
        Assert.Equal("Sirman_Final.html", exported["owner"]?.ToString());
    }

    private static JsonObject Obj(params (string k, object v)[] pairs)
    {
        var o = new JsonObject();
        foreach (var (k, v) in pairs)
        {
            o[k] = v switch
            {
                int i => i,
                string s => s,
                bool b => b,
                JsonNode n => n,
                _ => v.ToString()
            };
        }
        return o;
    }
}
