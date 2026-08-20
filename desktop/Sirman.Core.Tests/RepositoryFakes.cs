using System.Text.Json.Nodes;
using Sirman.Core.Business;
using Sirman.Core.Data.Repositories;
using Sirman.Core.Security;

namespace Sirman.Core.Tests;

internal sealed class FakeInvoiceRepository : IInvoiceRepository
{
    private readonly Dictionary<string, JsonObject> _byId = new(StringComparer.Ordinal);

    public JsonObject? GetById(string invoiceId) =>
        string.IsNullOrWhiteSpace(invoiceId) ? null :
        _byId.TryGetValue(invoiceId.Trim(), out var o) ? Clone(o) : null;

    public IReadOnlyList<JsonObject> GetAll() => _byId.Values.Select(Clone).ToList();

    public IReadOnlyList<JsonObject> GetByDateRange(string fromDate, string toDate) =>
        GetAll().Where(o =>
        {
            var d = o["date"]?.ToString() ?? "";
            if (d.Length == 0) return false;
            if (!string.IsNullOrEmpty(fromDate) && string.CompareOrdinal(d, fromDate) < 0) return false;
            if (!string.IsNullOrEmpty(toDate) && string.CompareOrdinal(d, toDate) > 0) return false;
            return true;
        }).ToList();

    public void Save(JsonObject invoice)
    {
        var id = invoice["invoiceId"]?.ToString() ?? "";
        if (id.Length == 0) return;
        _byId[id] = Clone(invoice);
    }

    public bool Delete(string invoiceId) =>
        !string.IsNullOrWhiteSpace(invoiceId) && _byId.Remove(invoiceId.Trim());

    private static JsonObject Clone(JsonObject o) =>
        JsonNode.Parse(o.ToJsonString()) as JsonObject ?? new JsonObject();
}

internal sealed class FakeInventoryRepository : IInventoryRepository
{
    private readonly Dictionary<string, JsonObject> _byId = new(StringComparer.Ordinal);

    public JsonObject? GetById(string itemId) =>
        string.IsNullOrWhiteSpace(itemId) ? null :
        _byId.TryGetValue(itemId.Trim(), out var o) ? Clone(o) : null;

    public IReadOnlyList<JsonObject> GetAll() => _byId.Values.Select(Clone).ToList();

    public void Save(JsonObject item)
    {
        var id = item["code"]?.ToString() ?? "";
        if (id.Length == 0) return;
        _byId[id] = Clone(item);
    }

    public InventoryMutateResult Reserve(string itemId, int qty, string? whId)
    {
        _ = whId;
        var item = GetById(itemId);
        if (item is null) return new InventoryMutateResult { Ok = false, Error = "missing" };
        var qtyNow = item["qty"]?.GetValue<int>() ?? 0;
        var reserved = item["reserved"]?.GetValue<int>() ?? 0;
        if (qtyNow - reserved < qty) return new InventoryMutateResult { Ok = false, Error = "stock" };
        item["reserved"] = reserved + qty;
        Save(item);
        return new InventoryMutateResult { Ok = true, Item = item };
    }

    public InventoryMutateResult Consume(string itemId, int qty)
    {
        var item = GetById(itemId);
        if (item is null) return new InventoryMutateResult { Ok = false, Error = "missing" };
        var qtyNow = item["qty"]?.GetValue<int>() ?? 0;
        if (qtyNow < qty) return new InventoryMutateResult { Ok = false, Error = "stock" };
        item["qty"] = qtyNow - qty;
        Save(item);
        return new InventoryMutateResult { Ok = true, Item = item };
    }

    private static JsonObject Clone(JsonObject o) =>
        JsonNode.Parse(o.ToJsonString()) as JsonObject ?? new JsonObject();
}

internal sealed class FakePaymentRepository : IPaymentRepository
{
    private readonly Dictionary<string, JsonObject> _byId = new(StringComparer.Ordinal);

    public IReadOnlyList<JsonObject> GetByInvoiceId(string invoiceId)
    {
        var want = (invoiceId ?? "").Trim();
        var found = new List<JsonObject>();
        foreach (var acc in _byId.Values)
        {
            if (acc["trx"] is not JsonArray arr) continue;
            foreach (var n in arr)
            {
                if (n is JsonObject t && (t["refId"]?.ToString() == want || t["invoiceId"]?.ToString() == want))
                    found.Add(JsonNode.Parse(t.ToJsonString()) as JsonObject ?? new JsonObject());
            }
        }
        return found;
    }

    public void Save(JsonObject account)
    {
        var id = account["id"]?.ToString() ?? "";
        if (id.Length == 0) return;
        _byId[id] = JsonNode.Parse(account.ToJsonString()) as JsonObject ?? new JsonObject();
    }

    public IReadOnlyList<JsonObject> Reverse(string invoiceId)
    {
        var want = (invoiceId ?? "").Trim();
        foreach (var acc in _byId.Values)
        {
            if (acc["trx"] is not JsonArray arr) continue;
            for (var i = arr.Count - 1; i >= 0; i--)
            {
                if (arr[i] is JsonObject t && (t["refId"]?.ToString() == want || t["invoiceId"]?.ToString() == want))
                    arr.RemoveAt(i);
            }
        }
        return _byId.Values.Select(a => JsonNode.Parse(a.ToJsonString()) as JsonObject ?? new JsonObject()).ToList();
    }
}

internal sealed class FakeWarrantyRepository : IWarrantyRepository
{
    private readonly Dictionary<string, JsonObject> _byId = new(StringComparer.Ordinal);

    public JsonObject? GetById(string warrantyId) =>
        string.IsNullOrWhiteSpace(warrantyId) ? null :
        _byId.TryGetValue(warrantyId.Trim(), out var o)
            ? JsonNode.Parse(o.ToJsonString()) as JsonObject
            : null;

    public IReadOnlyList<JsonObject> GetActiveByCustomer(string customerId)
    {
        var want = (customerId ?? "").Trim();
        return _byId.Values
            .Where(o => (o["status"]?.ToString() ?? "") != "closed"
                        && ((o["phone"]?.ToString() ?? "") == want || (o["name"]?.ToString() ?? "") == want))
            .Select(o => JsonNode.Parse(o.ToJsonString()) as JsonObject ?? new JsonObject())
            .ToList();
    }

    public void Save(JsonObject record)
    {
        var id = record["id"]?.ToString() ?? "";
        if (id.Length == 0) return;
        _byId[id] = JsonNode.Parse(record.ToJsonString()) as JsonObject ?? new JsonObject();
    }
}

internal sealed class FakeUserRepository : IUserRepository
{
    private readonly Dictionary<string, LoginUser> _byUsername = new(StringComparer.Ordinal);

    public LoginUser? GetByUsername(string username)
    {
        var key = (username ?? "").Trim();
        return _byUsername.TryGetValue(key, out var u) ? Copy(u) : null;
    }

    public IReadOnlyList<LoginUser> GetAll() => _byUsername.Values.Select(Copy).ToList();

    public void Save(LoginUser user)
    {
        var key = (user.Username ?? "").Trim();
        if (key.Length == 0) return;
        _byUsername[key] = Copy(user);
    }

    private static LoginUser Copy(LoginUser u) => new()
    {
        Id = u.Id,
        Name = u.Name,
        Username = u.Username,
        Pw = u.Pw,
        Active = u.Active,
        RoleKey = u.RoleKey,
        Pages = new List<string>(u.Pages ?? new List<string>())
    };
}

internal sealed class FakeBackupRepository : IBackupRepository
{
    private JsonObject _pkg = new() { ["tbd"] = true };

    public JsonObject Export() => JsonNode.Parse(_pkg.ToJsonString()) as JsonObject ?? new JsonObject();

    public JsonObject Import(JsonObject package)
    {
        _pkg = JsonNode.Parse((package ?? new JsonObject()).ToJsonString()) as JsonObject ?? new JsonObject();
        return Export();
    }

    public JsonObject Merge(JsonObject live, JsonObject incoming)
    {
        live ??= new JsonObject();
        incoming ??= new JsonObject();
        foreach (var kv in incoming)
            live[kv.Key] = kv.Value is null ? null : JsonNode.Parse(kv.Value.ToJsonString());
        return live;
    }
}
