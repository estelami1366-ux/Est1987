namespace Sirman.Core.Data.Persistence;

public static class ServiceParityChecker
{
    public static ServiceParityResult Compare(
        IReadOnlyList<ServiceCatalogRecord> source,
        IReadOnlyList<ServiceCatalogRecord> db)
    {
        var srcIds = source.Select(s => s.ServiceId).OrderBy(x => x, StringComparer.Ordinal).ToList();
        var dbIds = db.Select(s => s.ServiceId).OrderBy(x => x, StringComparer.Ordinal).ToList();
        var srcCodes = source.Select(s => s.Code ?? "").OrderBy(x => x, StringComparer.Ordinal).ToList();
        var dbCodes = db.Select(s => s.Code ?? "").OrderBy(x => x, StringComparer.Ordinal).ToList();
        var srcById = source.ToDictionary(s => s.ServiceId, StringComparer.Ordinal);
        var dbById = db.ToDictionary(s => s.ServiceId, StringComparer.Ordinal);

        var idParity = srcIds.SequenceEqual(dbIds, StringComparer.Ordinal);
        var codeParity = srcCodes.SequenceEqual(dbCodes, StringComparer.Ordinal);
        var fieldOk = idParity;
        var hashOk = true;
        if (fieldOk)
        {
            foreach (var id in srcIds)
            {
                var a = srcById[id];
                var b = dbById[id];
                if (!string.Equals(a.Code, b.Code, StringComparison.Ordinal)
                    || !string.Equals(a.Name, b.Name, StringComparison.Ordinal)
                    || !string.Equals(a.Cat, b.Cat, StringComparison.Ordinal)
                    || a.Price != b.Price
                    || !string.Equals(a.Warr, b.Warr, StringComparison.Ordinal)
                    || !string.Equals(a.JsonExtra, b.JsonExtra, StringComparison.Ordinal)
                    || !string.Equals(a.RowHash, b.RowHash, StringComparison.Ordinal))
                {
                    fieldOk = false;
                    hashOk = false;
                    break;
                }
            }
        }
        else hashOk = false;

        var aggSrc = ServiceRowHash.Aggregate(source.Select(s => s.RowHash));
        var aggDb = ServiceRowHash.Aggregate(db.Select(s => s.RowHash));
        hashOk = hashOk && string.Equals(aggSrc, aggDb, StringComparison.Ordinal);

        var ok = source.Count == db.Count && idParity && codeParity && fieldOk && hashOk;
        return new ServiceParityResult
        {
            Ok = ok,
            SourceCount = source.Count,
            DbCount = db.Count,
            IdParity = idParity,
            CodeParity = codeParity,
            FieldParity = fieldOk,
            HashParity = hashOk,
            AggregateHashSource = aggSrc,
            AggregateHashDb = aggDb,
            Detail = ok ? "parity-ok" : "PARITY FAILED"
        };
    }
}
