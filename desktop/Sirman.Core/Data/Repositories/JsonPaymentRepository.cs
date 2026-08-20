using System.Text.Json.Nodes;

namespace Sirman.Core.Data.Repositories;

/// <summary>لیست حساب JSON + MergeItem. برگشت تراکنش روی این کلاس نیست؛ PaymentRules دست‌نخورده می‌ماند.</summary>
public sealed class JsonPaymentRepository : IPaymentRepository
{
    private readonly CurrentJsonStore _store;
    private readonly Dictionary<string, JsonObject> _byId = new(StringComparer.Ordinal);

    public JsonPaymentRepository(CurrentJsonStore store) =>
        _store = store ?? throw new ArgumentNullException(nameof(store));

    public IReadOnlyList<JsonObject> GetByInvoiceId(string invoiceId)
    {
        var want = (invoiceId ?? "").Trim();
        if (want.Length == 0) return Array.Empty<JsonObject>();
        var found = new List<JsonObject>();
        foreach (var acc in _byId.Values)
        {
            if (acc["trx"] is not JsonArray arr) continue;
            foreach (var n in arr)
            {
                if (n is not JsonObject t) continue;
                if (!TrxMatches(t, want)) continue;
                found.Add(RepositoryJson.Clone(t));
            }
        }
        return found;
    }

    public void Save(JsonObject account)
    {
        account ??= new JsonObject();
        var id = RepositoryJson.AccountId(account);
        if (id.Length == 0) return;
        var live = _byId.TryGetValue(id, out var existing) ? existing : new JsonObject();
        _byId[id] = RepositoryJson.Clone(_store.MergeItem(live, account));
    }

    private static bool TrxMatches(JsonObject t, string invoiceId)
    {
        var refId = RepositoryJson.Str(t, "refId", "invoiceId", "documentId");
        return refId == invoiceId;
    }
}
