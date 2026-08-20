using System.Text.Json.Nodes;

namespace Sirman.Core.Data.Repositories;

/// <summary>کیسه JSON + MergeItem موجود. به BusinessFacade وصل نیست.</summary>
public sealed class JsonInvoiceRepository : IInvoiceRepository
{
    private readonly CurrentJsonStore _store;
    private readonly Dictionary<string, JsonObject> _byId = new(StringComparer.Ordinal);

    public JsonInvoiceRepository(CurrentJsonStore store) =>
        _store = store ?? throw new ArgumentNullException(nameof(store));

    public JsonObject? GetById(string invoiceId)
    {
        if (string.IsNullOrWhiteSpace(invoiceId)) return null;
        return _byId.TryGetValue(invoiceId.Trim(), out var o) ? RepositoryJson.Clone(o) : null;
    }

    public IReadOnlyList<JsonObject> GetAll() =>
        _byId.Values.Select(RepositoryJson.Clone).ToList();

    public IReadOnlyList<JsonObject> GetByDateRange(string fromDate, string toDate)
    {
        fromDate ??= "";
        toDate ??= "";
        return _byId.Values
            .Where(o =>
            {
                var d = RepositoryJson.InvoiceDate(o);
                if (d.Length == 0) return false;
                if (fromDate.Length > 0 && string.CompareOrdinal(d, fromDate) < 0) return false;
                if (toDate.Length > 0 && string.CompareOrdinal(d, toDate) > 0) return false;
                return true;
            })
            .Select(RepositoryJson.Clone)
            .ToList();
    }

    public void Save(JsonObject invoice)
    {
        invoice ??= new JsonObject();
        var id = RepositoryJson.InvoiceId(invoice);
        if (id.Length == 0) return;
        var live = _byId.TryGetValue(id, out var existing) ? existing : new JsonObject();
        _byId[id] = RepositoryJson.Clone(_store.MergeItem(live, invoice));
    }

    public bool Delete(string invoiceId)
    {
        if (string.IsNullOrWhiteSpace(invoiceId)) return false;
        return _byId.Remove(invoiceId.Trim());
    }
}
