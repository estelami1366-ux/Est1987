using Microsoft.Data.Sqlite;
using Sirman.Core.Data.Persistence;

namespace Sirman.Persistence.Sqlite;

public static class SqliteCandidateDatabase
{
    public const int SchemaVersion = 1;
    public const string ApplicationVersion = "1405.5.27γ";

    public static SqliteConnection OpenInitialized(string dbPath)
    {
        if (string.IsNullOrWhiteSpace(dbPath))
            throw new InvalidOperationException("STOP — BLOCKED: empty candidate DB path");
        var dir = Path.GetDirectoryName(dbPath);
        if (!string.IsNullOrEmpty(dir))
            Directory.CreateDirectory(dir);

        var cs = new SqliteConnectionStringBuilder { DataSource = dbPath, Mode = SqliteOpenMode.ReadWriteCreate }.ToString();
        var conn = new SqliteConnection(cs);
        conn.Open();
        try
        {
            Exec(conn, "PRAGMA journal_mode=WAL;");
            Exec(conn, "PRAGMA foreign_keys=ON;");
            Exec(conn, "PRAGMA busy_timeout=5000;");
            var integrity = Scalar(conn, "PRAGMA integrity_check;");
            if (!string.Equals(integrity, "ok", StringComparison.OrdinalIgnoreCase))
                throw new InvalidOperationException("STOP — BLOCKED: integrity_check failed: " + integrity);
            EnsureSchema(conn);
            return conn;
        }
        catch
        {
            conn.Dispose();
            throw;
        }
    }

    public static string JournalMode(SqliteConnection conn) => Scalar(conn, "PRAGMA journal_mode;");

    public static string IntegrityCheck(SqliteConnection conn) => Scalar(conn, "PRAGMA integrity_check;");

    public static bool ForeignKeys(SqliteConnection conn) => Scalar(conn, "PRAGMA foreign_keys;") == "1";

    public static int ReadSchemaVersion(SqliteConnection conn)
    {
        using var cmd = conn.CreateCommand();
        cmd.CommandText = "SELECT schema_version FROM schema_info WHERE id = 1";
        var v = cmd.ExecuteScalar();
        return Convert.ToInt32(v);
    }

    private static void EnsureSchema(SqliteConnection conn)
    {
        Exec(conn, """
            CREATE TABLE IF NOT EXISTS schema_info (
              id INTEGER PRIMARY KEY CHECK (id = 1),
              schema_version INTEGER NOT NULL,
              application_version TEXT NOT NULL,
              migration_version INTEGER NOT NULL,
              created_at TEXT NOT NULL,
              updated_at TEXT NOT NULL
            );
            """);
        Exec(conn, """
            CREATE TABLE IF NOT EXISTS services (
              service_id TEXT PRIMARY KEY,
              code TEXT UNIQUE,
              name TEXT,
              cat TEXT,
              price INTEGER,
              warr TEXT,
              json_extra TEXT NOT NULL DEFAULT '{}',
              migrated_at TEXT,
              row_hash TEXT NOT NULL,
              id_source TEXT NOT NULL
            );
            """);

        using var check = conn.CreateCommand();
        check.CommandText = "SELECT COUNT(*) FROM schema_info WHERE id = 1";
        var n = Convert.ToInt32(check.ExecuteScalar());
        var now = DateTimeOffset.UtcNow.ToString("o");
        if (n == 0)
        {
            using var ins = conn.CreateCommand();
            ins.CommandText = """
                INSERT INTO schema_info (id, schema_version, application_version, migration_version, created_at, updated_at)
                VALUES (1, $sv, $app, $mv, $ts, $ts);
                """;
            ins.Parameters.AddWithValue("$sv", SchemaVersion);
            ins.Parameters.AddWithValue("$app", ApplicationVersion);
            ins.Parameters.AddWithValue("$mv", SchemaVersion);
            ins.Parameters.AddWithValue("$ts", now);
            ins.ExecuteNonQuery();
            return;
        }

        var existing = ReadSchemaVersion(conn);
        if (existing > SchemaVersion)
            throw new InvalidOperationException("STOP — BLOCKED: schema newer than app (" + existing + " > " + SchemaVersion + ")");
        if (existing < SchemaVersion)
            throw new InvalidOperationException("STOP — BLOCKED: older schema requires a migration path (" + existing + ")");
    }

    private static void Exec(SqliteConnection conn, string sql)
    {
        using var cmd = conn.CreateCommand();
        cmd.CommandText = sql;
        cmd.ExecuteNonQuery();
    }

    private static string Scalar(SqliteConnection conn, string sql)
    {
        using var cmd = conn.CreateCommand();
        cmd.CommandText = sql;
        return Convert.ToString(cmd.ExecuteScalar()) ?? "";
    }
}
