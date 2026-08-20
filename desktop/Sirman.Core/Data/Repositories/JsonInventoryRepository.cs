using System.Text.Json.Nodes;

namespace Sirman.Core.Data.Repositories;

/// <summary>کیسه JSON + MergeItem. رزرو/مصرف موجودی روی این کلاس نیست؛ InventoryCore دست‌نخورده می‌ماند.</summary>
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
}
