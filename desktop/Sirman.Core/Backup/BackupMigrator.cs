using System.Text.Json.Nodes;

namespace Sirman.Core.Backup;

/// <summary>
/// Pure backup schema/field migration façade extracted from HTML
/// <c>applySchemaMigrations</c> + <c>migrateBackup</c>.
/// Does not persist, restore, touch DOM/localStorage/Host, or replace live HTML engines.
/// </summary>
public static class BackupMigrator
{
    public static SchemaMigrationResult ApplySchemaMigrations(BackupMigrationRequest request) =>
        ApplySchemaMigrations(request?.Data, request?.TargetSchemaVersion);

    public static SchemaMigrationResult ApplySchemaMigrations(JsonNode? data, int? targetVer = null) =>
        BackupSchemaMigrations.Apply(data, targetVer);

    public static SchemaMigrationResult MigrateBackup(BackupMigrationRequest request) =>
        MigrateBackup(request?.Data, request?.NowMs);

    public static SchemaMigrationResult MigrateBackup(JsonNode? data, long? nowMs = null) =>
        BackupFieldMigrator.Migrate(data, nowMs);

    /// <summary>
    /// HTML <c>importData</c> / <c>testRestoreBackup</c> order: schema graph then field migrate.
    /// Not wired to live restore.
    /// </summary>
    public static SchemaMigrationResult MigratePackage(JsonNode? data, long? nowMs = null)
    {
        var schema = ApplySchemaMigrations(data);
        if (!schema.Ok)
            return schema;
        try
        {
            var field = MigrateBackup(schema.Data, nowMs);
            if (field.Threw)
                return field;
            var log = schema.Log.Concat(field.Log).ToList();
            return new SchemaMigrationResult
            {
                Ok = true,
                TooNew = false,
                From = schema.From,
                To = field.Data is JsonObject
                    ? BackupRequiredCollections.InferSchemaVersion(field.Data)
                    : schema.To,
                Data = field.Data,
                Log = log
            };
        }
        catch (Exception ex)
        {
            return new SchemaMigrationResult
            {
                Ok = false,
                Threw = true,
                ErrorName = ex.GetType().Name,
                ErrorMessage = ex.Message,
                Log = Array.Empty<string>()
            };
        }
    }
}
