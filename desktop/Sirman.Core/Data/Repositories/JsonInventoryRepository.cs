using System.Text.Json.Nodes;
using Sirman.Core.Business;

namespace Sirman.Core.Data.Repositories;

/// <summary>کیسه JSON + MergeItem. Reserve/Consume همان InventoryCore موجود است؛ سرویس‌ها هنوز این کلاس را صدا نمی‌زنند.</summary>
public sealed class JsonInventoryRepository : IInventoryRepository
{
    private readonly CurrentJsonStore _store;
    private readonly Dictionary<string, JsonObject> _byId = new(StringComparer.Ordinal);

    public JsonInventoryRepository(CurrentJsonStore store) =>
        _store = store ?? throw new ArgumentNullException(nameof(store));

    public JsonObject? GetById(string itemId)
    {
        if (string.IsNullOrWhiteSpace(itemId)) return null;
        return _byId.TryGetValue(itemId.Trim(), out var o) ? RepositoryJson.Clone(o) : null;
    }

    public IReadOnlyList<JsonObject> GetAll() =>
        _byId.Values.Select(RepositoryJson.Clone).ToList();

    public void Save(JsonObject item)
    {
        item ??= new JsonObject();
        var id = RepositoryJson.InventoryId(item);
        if (id.Length == 0) return;
        var live = _byId.TryGetValue(id, out var existing) ? existing : new JsonObject();
        _byId[id] = RepositoryJson.Clone(_store.MergeItem(live, item));
    }

    public InventoryMutateResult Reserve(string itemId, int qty, string? whId)
    {
        var item = GetById(itemId);
        if (item is null)
            return new InventoryMutateResult { Ok = false, Error = "کالا پیدا نشد" };
        var r = InventoryCore.Reserve(item, qty, whId);
        if (r.Ok && r.Item is not null) Save(r.Item);
        return r;
    }

    public InventoryMutateResult Consume(string itemId, int qty)
    {
        var item = GetById(itemId);
        if (item is null)
            return new InventoryMutateResult { Ok = false, Error = "کالا پیدا نشد" };
        var r = InventoryCore.Consume(item, qty);
        if (r.Ok && r.Item is not null) Save(r.Item);
        return r;
    }
}
