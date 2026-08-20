using System.Text.Json.Nodes;
using Sirman.Core.Business;

namespace Sirman.Core.Data.Repositories;

/// <summary>لیست حساب JSON + MergeItem. Reverse به PaymentRules.ReverseOwned موجود تفویض می‌شود.</summary>
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

    public IReadOnlyList<JsonObject> Reverse(string invoiceId)
    {
        var want = (invoiceId ?? "").Trim();
        var updated = new List<JsonObject>();
        if (want.Length == 0) return updated;
        foreach (var id in _byId.Keys.ToList())
        {
            var r = PaymentRules.ReverseOwned(_byId[id], want);
            if (!r.Ok || r.Account is null) continue;
            Save(r.Account);
            updated.Add(RepositoryJson.Clone(_byId[id]));
        }
        return updated;
    }

    private static bool TrxMatches(JsonObject t, string invoiceId)
    {
        var refId = RepositoryJson.Str(t, "refId", "invoiceId", "documentId");
        return refId == invoiceId;
    }
}
