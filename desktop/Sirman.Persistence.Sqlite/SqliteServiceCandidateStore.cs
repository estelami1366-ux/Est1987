using Microsoft.Data.Sqlite;
using Sirman.Core.Data.Persistence;

namespace Sirman.Persistence.Sqlite;

public sealed class SqliteServiceCandidateStore : IServiceCandidateStore
{
    private readonly SqliteConnection _conn;

    public SqliteServiceCandidateStore(SqliteConnection conn) =>
        _conn = conn ?? throw new ArgumentNullException(nameof(conn));

    public IReadOnlyList<ServiceCatalogRecord> ListAll()
    {
        using var cmd = _conn.CreateCommand();
        cmd.CommandText = """
            SELECT service_id, code, name, cat, price, warr, json_extra, row_hash, id_source, migrated_at
            FROM services ORDER BY service_id;
            """;
        var list = new List<ServiceCatalogRecord>();
        using var r = cmd.ExecuteReader();
        while (r.Read())
        {
            list.Add(new ServiceCatalogRecord
            {
                ServiceId = r.GetString(0),
                Code = r.IsDBNull(1) ? null : r.GetString(1),
                Name = r.IsDBNull(2) ? null : r.GetString(2),
                Cat = r.IsDBNull(3) ? null : r.GetString(3),
                Price = r.IsDBNull(4) ? null : r.GetInt32(4),
                Warr = r.IsDBNull(5) ? null : r.GetString(5),
                JsonExtra = r.GetString(6),
                RowHash = r.GetString(7),
                IdSource = r.GetString(8),
                MigratedAt = r.IsDBNull(9) ? "" : r.GetString(9)
            });
        }
        return list;
    }

    public void ReplaceAll(IReadOnlyList<ServiceCatalogRecord> rows)
    {
        using var tx = _conn.BeginTransaction();
        try
        {
            using (var del = _conn.CreateCommand())
            {
                del.Transaction = tx;
                del.CommandText = "DELETE FROM services;";
                del.ExecuteNonQuery();
            }
            foreach (var row in rows)
            {
                using var ins = _conn.CreateCommand();
                ins.Transaction = tx;
                ins.CommandText = """
                    INSERT INTO services (service_id, code, name, cat, price, warr, json_extra, migrated_at, row_hash, id_source)
                    VALUES ($id, $code, $name, $cat, $price, $warr, $extra, $mig, $hash, $src);
                    """;
                ins.Parameters.AddWithValue("$id", row.ServiceId);
                ins.Parameters.AddWithValue("$code", (object?)row.Code ?? DBNull.Value);
                ins.Parameters.AddWithValue("$name", (object?)row.Name ?? DBNull.Value);
                ins.Parameters.AddWithValue("$cat", (object?)row.Cat ?? DBNull.Value);
                ins.Parameters.AddWithValue("$price", (object?)row.Price ?? DBNull.Value);
                ins.Parameters.AddWithValue("$warr", (object?)row.Warr ?? DBNull.Value);
                ins.Parameters.AddWithValue("$extra", row.JsonExtra);
                ins.Parameters.AddWithValue("$mig", row.MigratedAt);
                ins.Parameters.AddWithValue("$hash", row.RowHash);
                ins.Parameters.AddWithValue("$src", row.IdSource);
                ins.ExecuteNonQuery();
            }
            tx.Commit();
        }
        catch
        {
            tx.Rollback();
            throw;
        }
    }

    public int Count()
    {
        using var cmd = _conn.CreateCommand();
        cmd.CommandText = "SELECT COUNT(*) FROM services;";
        return Convert.ToInt32(cmd.ExecuteScalar());
    }
}
