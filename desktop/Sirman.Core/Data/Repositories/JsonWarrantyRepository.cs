using System.Text.Json.Nodes;

namespace Sirman.Core.Data.Repositories;

public sealed class JsonWarrantyRepository : IWarrantyRepository
{
    private readonly CurrentJsonStore _store;
    private readonly Dictionary<string, JsonObject> _byId = new(StringComparer.Ordinal);

    public JsonWarrantyRepository(CurrentJsonStore store) =>
        _store = store ?? throw new ArgumentNullException(nameof(store));

    public JsonObject? GetById(string warrantyId)
    {
        if (string.IsNullOrWhiteSpace(warrantyId)) return null;
        return _byId.TryGetValue(warrantyId.Trim(), out var o) ? RepositoryJson.Clone(o) : null;
    }

    public IReadOnlyList<JsonObject> GetActiveByCustomer(string customerId)
    {
        var want = (customerId ?? "").Trim();
        if (want.Length == 0) return Array.Empty<JsonObject>();
        return _byId.Values
            .Where(o =>
            {
                var status = RepositoryJson.Str(o, "status");
                if (status == "closed") return false;
                return string.Equals(RepositoryJson.WarrantyCustomerKey(o), want, StringComparison.Ordinal)
                    || string.Equals(RepositoryJson.Str(o, "phone"), want, StringComparison.Ordinal)
                    || string.Equals(RepositoryJson.Str(o, "name"), want, StringComparison.Ordinal);
            })
            .Select(RepositoryJson.Clone)
            .ToList();
    }

    public void Save(JsonObject record)
    {
        record ??= new JsonObject();
        var id = RepositoryJson.WarrantyId(record);
        if (id.Length == 0) return;
        var live = _byId.TryGetValue(id, out var existing) ? existing : new JsonObject();
        _byId[id] = RepositoryJson.Clone(_store.MergeItem(live, record));
    }
}
