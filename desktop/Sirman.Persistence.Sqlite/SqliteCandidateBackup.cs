using System.Security.Cryptography;
using Microsoft.Data.Sqlite;
using Sirman.Core.Data.Persistence;

namespace Sirman.Persistence.Sqlite;

public sealed class CandidateSnapshotResult
{
    public required string SnapshotPath { get; init; }
    public required long Bytes { get; init; }
    public required string Sha256 { get; init; }
    public required int SchemaVersion { get; init; }
    public required int RowCount { get; init; }
    public required string AggregateHash { get; init; }
    public required string Integrity { get; init; }
}

public static class SqliteCandidateBackup
{
    public static CandidateSnapshotResult Snapshot(string livePath, string snapshotPath)
    {
        Directory.CreateDirectory(Path.GetDirectoryName(snapshotPath)!);
        if (File.Exists(snapshotPath)) File.Delete(snapshotPath);
        using (var src = SqliteCandidateDatabase.OpenInitialized(livePath))
        using (var dest = new SqliteConnection(new SqliteConnectionStringBuilder { DataSource = snapshotPath }.ToString()))
        {
            dest.Open();
            src.BackupDatabase(dest);
        }
        return Inspect(snapshotPath);
    }

    public static CandidateSnapshotResult RestoreToStaging(string snapshotPath, string stagingPath)
    {
        Directory.CreateDirectory(Path.GetDirectoryName(stagingPath)!);
        File.Copy(snapshotPath, stagingPath, overwrite: true);
        return Inspect(stagingPath);
    }

    public static CandidateSnapshotResult Inspect(string path)
    {
        int schemaVersion;
        int rowCount;
        string aggregateHash;
        string integrity;
        using (var conn = SqliteCandidateDatabase.OpenInitialized(path))
        {
            integrity = SqliteCandidateDatabase.IntegrityCheck(conn);
            if (!string.Equals(integrity, "ok", StringComparison.OrdinalIgnoreCase))
                throw new InvalidOperationException("STOP — BLOCKED: integrity_check failed");
            var store = new SqliteServiceCandidateStore(conn);
            var rows = store.ListAll();
            schemaVersion = SqliteCandidateDatabase.ReadSchemaVersion(conn);
            rowCount = rows.Count;
            aggregateHash = ServiceRowHash.Aggregate(rows.Select(r => r.RowHash));
            using var checkpoint = conn.CreateCommand();
            checkpoint.CommandText = "PRAGMA wal_checkpoint(TRUNCATE);";
            checkpoint.ExecuteNonQuery();
        }

        var bytes = new FileInfo(path).Length;
        var sha = Convert.ToHexString(SHA256.HashData(File.ReadAllBytes(path))).ToLowerInvariant();
        return new CandidateSnapshotResult
        {
            SnapshotPath = path,
            Bytes = bytes,
            Sha256 = sha,
            SchemaVersion = schemaVersion,
            RowCount = rowCount,
            AggregateHash = aggregateHash,
            Integrity = integrity
        };
    }
}
