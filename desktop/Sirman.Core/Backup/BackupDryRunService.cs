using System.Text.Json.Nodes;

namespace Sirman.Core.Backup;

/// <summary>
/// ARCH-4 read-only dry-run façade. Composes ARCH-2 <see cref="BackupValidator"/>,
/// P1C-7 digest compare via <see cref="BackupCanonicalChecksum"/>, and ARCH-3
/// <see cref="BackupMigrator"/>. Does not persist, restore, merge, replace, or call Host.
/// Host <c>TestRestoreBackup</c> may call this for preview only.
/// Not wired to live HTML <c>importData</c> apply / merge / replace.
/// </summary>
public static class BackupDryRunService
{
    public static int TargetSchemaVersion => BackupSchemaMigrations.AppSchemaVersion;

    public static BackupDryRunResult Run(BackupDryRunRequest? request) =>
        Run(request?.Data, request?.NowMs);

    public static BackupDryRunResult Run(JsonNode? data, long? nowMs = null)
    {
        var sourceSchema = BackupRequiredCollections.InferSchemaVersion(data);
        var targetSchema = TargetSchemaVersion;

        var validationClone = BackupJsonUtil.CloneExact(data);
        var validation = BackupValidator.Validate(validationClone);

        var integrityEval = EvaluateIntegrity(validationClone);
        var warnings = validation.Warnings.ToList();
        var errors = validation.Errors.ToList();
        if (integrityEval.DigestError is { Length: > 0 } && !errors.Contains(integrityEval.DigestError))
            errors.Add(integrityEval.DigestError);

        var gatesOk = validation.Ok && integrityEval.DigestOk;
        if (!gatesOk)
        {
            return new BackupDryRunResult
            {
                Ok = false,
                Applied = false,
                Status = BackupValidationStatus.INVALID,
                SourceSchema = sourceSchema,
                TargetSchema = targetSchema,
                MigrationRequired = sourceSchema < targetSchema,
                MigrationPerformed = false,
                MigrationStatus = BackupMigrationRunStatus.NotAttempted,
                Validation = validation,
                IntegrityStatus = integrityEval.Status,
                Integrity = integrityEval.Portable,
                DigestCompared = integrityEval.DigestCompared,
                DigestMatched = integrityEval.DigestMatched,
                Errors = errors,
                Warnings = warnings,
                Log = Array.Empty<string>(),
                Data = null
            };
        }

        var migrateClone = BackupJsonUtil.CloneExact(data);
        var migration = BackupMigrator.MigratePackage(migrateClone, nowMs);
        if (!migration.Ok || migration.Threw || migration.TooNew)
        {
            var migErrors = errors.ToList();
            if (migration.TooNew && !string.IsNullOrEmpty(migration.Reason))
                migErrors.Add(migration.Reason);
            if (migration.Threw && !string.IsNullOrEmpty(migration.ErrorMessage))
                migErrors.Add(migration.ErrorMessage);
            return new BackupDryRunResult
            {
                Ok = false,
                Applied = false,
                Status = BackupValidationStatus.INVALID,
                SourceSchema = sourceSchema,
                TargetSchema = targetSchema,
                MigrationRequired = sourceSchema < targetSchema || migration.TooNew,
                MigrationPerformed = false,
                MigrationStatus = BackupMigrationRunStatus.Failed,
                Validation = validation,
                IntegrityStatus = integrityEval.Status,
                Integrity = integrityEval.Portable,
                DigestCompared = integrityEval.DigestCompared,
                DigestMatched = integrityEval.DigestMatched,
                Migration = migration,
                Errors = migErrors,
                Warnings = warnings,
                Log = migration.Log,
                Data = null
            };
        }

        var postReq = BackupRequiredCollections.Validate(migration.Data);
        var postCounts = BackupStructuralValidator.ValidateItemCounts(migration.Data);
        var postErrors = postReq.Errors.Concat(postCounts.Errors).ToList();
        var postWarnings = postReq.Warnings.Concat(postCounts.Warnings).ToList();
        var postOk = postReq.Ok && postCounts.Ok;
        var post = new BackupValidationResult
        {
            Ok = postOk,
            Status = BackupJsonUtil.StatusOf(postOk, postWarnings),
            Errors = postErrors,
            Warnings = postWarnings,
            MissingRequiredCollections = postReq.MissingRequiredCollections,
            InvalidCollections = postReq.InvalidCollections,
            CountMismatches = postCounts.CountMismatches,
            SchemaVersion = postReq.SchemaVersion,
            RequiredKeys = postReq.RequiredKeys
        };

        var allWarnings = warnings.Concat(postWarnings).ToList();
        var allErrors = errors.Concat(postErrors).ToList();
        var ok = postOk;
        var status = ok
            ? BackupJsonUtil.StatusOf(true, allWarnings)
            : BackupValidationStatus.INVALID;

        return new BackupDryRunResult
        {
            Ok = ok,
            Applied = false,
            Status = status,
            SourceSchema = sourceSchema,
            TargetSchema = targetSchema,
            MigrationRequired = sourceSchema < targetSchema,
            MigrationPerformed = true,
            MigrationStatus = BackupMigrationRunStatus.Performed,
            Validation = validation,
            IntegrityStatus = integrityEval.Status,
            Integrity = integrityEval.Portable,
            DigestCompared = integrityEval.DigestCompared,
            DigestMatched = integrityEval.DigestMatched,
            Migration = migration,
            PostMigration = post,
            Errors = allErrors,
            Warnings = allWarnings,
            Log = migration.Log,
            Data = ok ? migration.Data : null
        };
    }

    private readonly record struct IntegrityEval(
        BackupIntegrityStatus Status,
        BackupValidationResult Portable,
        bool DigestOk,
        bool DigestCompared,
        bool DigestMatched,
        string? DigestError);

    private static IntegrityEval EvaluateIntegrity(JsonNode? data)
    {
        var portable = BackupPortableIntegrity.Validate(data);
        var claim = BackupPortableIntegrity.ClassifyClaim(data);

        if (!portable.Ok)
        {
            return new IntegrityEval(
                BackupIntegrityStatus.INVALID,
                portable,
                DigestOk: true,
                DigestCompared: false,
                DigestMatched: false,
                DigestError: null);
        }

        if (!claim.Claimed)
        {
            return new IntegrityEval(
                BackupIntegrityStatus.NOT_VERIFIABLE,
                portable,
                DigestOk: true,
                DigestCompared: false,
                DigestMatched: false,
                DigestError: null);
        }

        if (claim.Algo != BackupStoredChecksum.RecognizedSha256Algo)
        {
            return new IntegrityEval(
                BackupIntegrityStatus.INVALID,
                portable,
                DigestOk: true,
                DigestCompared: false,
                DigestMatched: false,
                DigestError: null);
        }

        var stored = BackupStoredChecksum.Compare(data);
        return new IntegrityEval(
            stored.Matched ? BackupIntegrityStatus.VALID : BackupIntegrityStatus.INVALID,
            portable,
            DigestOk: stored.Matched,
            DigestCompared: stored.Compared,
            DigestMatched: stored.Matched,
            DigestError: stored.Error);
    }
}
