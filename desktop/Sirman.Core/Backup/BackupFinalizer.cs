using System.Globalization;
using System.Text.Json.Nodes;

namespace Sirman.Core.Backup;

/// <summary>
/// ARCH-5 pure extraction of HTML <c>finalizeBackupPackage</c> + <c>attachChecksum</c>
/// + canonical compact JSON + SHA-256.
/// Does not extract HTML live data-assembly, filesystem, Host, or live restore.
/// Does not mutate the caller's node. Does not read the system clock.
/// </summary>
public static class BackupFinalizer
{
    public static BackupFinalizeResult FinalizePackage(JsonNode? data, string? origin = null, string? kind = null) =>
        Finalize(new BackupFinalizeRequest
        {
            Data = data,
            Origin = origin,
            Kind = kind,
            ChecksumMode = BackupChecksumMode.LeaveUnchanged
        });

    public static BackupFinalizeResult AttachChecksum(JsonNode? data, BackupChecksumMode mode = BackupChecksumMode.Sha256) =>
        Finalize(new BackupFinalizeRequest
        {
            Data = data,
            ChecksumMode = mode,
            SkipPackageFinalize = true
        });

    public static BackupFinalizeResult Finalize(BackupFinalizeRequest? request)
    {
        request ??= new BackupFinalizeRequest();
        var log = new List<string>();
        try
        {
            var work = BackupJsonUtil.CloneBackupData(request.Data);
            if (work is not JsonObject obj)
            {
                return ResultFromNonObject(work, request, log);
            }

            if (request.StampExportedAt && request.NowMs is long ms)
            {
                obj["exportedAt"] = IsoFromUnixMs(ms);
                log.Add("stampExportedAt");
            }
            else if (request.StampExportedAt)
            {
                log.Add("stampExportedAt skipped: nowMs not injected (Core does not read the system clock)");
            }

            if (!request.SkipPackageFinalize)
            {
                ApplyFinalizePackage(obj, request.Origin, request.Kind, log);
            }

            ApplyChecksum(obj, request.ChecksumMode, log);
            return Success(obj, log);
        }
        catch (BackupMigrationException ex)
        {
            return Fail(ex.GetType().Name, ex.Message, log);
        }
        catch (Exception ex)
        {
            return Fail(ex.GetType().Name, ex.Message, log);
        }
    }

    internal static string IsoFromUnixMs(long ms) =>
        DateTimeOffset.FromUnixTimeMilliseconds(ms)
            .UtcDateTime
            .ToString("yyyy-MM-ddTHH:mm:ss.fffZ", CultureInfo.InvariantCulture);

    internal static void ApplyFinalizePackage(JsonObject data, string? origin, string? kind, List<string> log)
    {
        data["magic"] = BackupSchemaMigrations.Magic;
        data["schemaVersion"] = BackupSchemaMigrations.AppSchemaVersion;
        data["applicationVersion"] = FirstTruthyString(
            data.ContainsKey("version") ? data["version"] : null,
            data.ContainsKey("applicationVersion") ? data["applicationVersion"] : null);
        data["attachmentsIndex"] = BackupSchemaMigrations.CollectAttachmentIndex(data);
        AttachSectionChecksums(data);
        var resolvedOrigin = ResolveOrigin(data, origin);
        var resolvedKind = ResolveKind(data, kind);
        data["manifest"] = BackupSchemaMigrations.BuildBackupManifest(data, resolvedOrigin, resolvedKind);
        log.Add("finalizeBackupPackage");
    }

    internal static JsonObject AttachSectionChecksums(JsonObject data)
    {
        var skip = new HashSet<string>(StringComparer.Ordinal)
        {
            "version", "exportedAt", "origin", "checksum", "checksumAlgo", "manifest",
            "magic", "schemaVersion", "sectionChecksums", "applicationVersion", "attachmentsIndex"
        };
        var map = new JsonObject();
        foreach (var k in SectionKeys(data))
        {
            if (skip.Contains(k)) continue;
            if (!data.ContainsKey(k)) continue;
            map[k] = BackupCanonicalChecksum.SectionHash(data[k]);
        }
        data["sectionChecksums"] = map;
        return map;
    }

    private static IEnumerable<string> SectionKeys(JsonObject data)
    {
        if (data["sections"] is JsonArray sections && sections.Count > 0)
        {
            foreach (var item in sections)
                yield return BackupJsonUtil.Str(item);
            yield break;
        }

        foreach (var kv in data)
            yield return kv.Key;
    }

    private static void ApplyChecksum(JsonObject data, BackupChecksumMode mode, List<string> log)
    {
        switch (mode)
        {
            case BackupChecksumMode.None:
                data["checksum"] = "";
                data["checksumAlgo"] = "none";
                log.Add("attachChecksum none");
                break;
            case BackupChecksumMode.Sha256:
                var hex = BackupCanonicalChecksum.Sha256Hex(data);
                data["checksum"] = hex;
                data["checksumAlgo"] = "SHA-256";
                log.Add("attachChecksum SHA-256");
                break;
            default:
                log.Add("checksum left unchanged");
                break;
        }
    }

    private static BackupFinalizeResult ResultFromNonObject(JsonNode work, BackupFinalizeRequest request, List<string> log)
    {
        log.Add("non-object: JSON.stringify drops named finalize fields (HTML sloppy-assign equivalent)");
        if (work is JsonObject)
            return Success(work, log);

        var canonical = BackupCanonicalChecksum.CanonicalString(work);
        var sha = BackupCanonicalChecksum.Sha256Hex(work);
        var checksum = "";
        var algo = "";
        if (request.ChecksumMode == BackupChecksumMode.Sha256)
        {
            checksum = sha;
            algo = "SHA-256";
        }
        else if (request.ChecksumMode == BackupChecksumMode.None)
        {
            checksum = "";
            algo = "none";
        }

        return new BackupFinalizeResult
        {
            Ok = true,
            Data = work,
            CanonicalString = canonical,
            Sha256Hex = sha,
            Checksum = checksum,
            ChecksumAlgo = algo,
            Log = log
        };
    }

    private static BackupFinalizeResult Success(JsonNode data, List<string> log)
    {
        var obj = data as JsonObject;
        JsonObject? sections = null;
        if (obj is not null && obj["sectionChecksums"] is JsonObject sc)
            sections = (JsonObject)BackupJsonUtil.CloneExact(sc)!;
        JsonObject? manifest = null;
        if (obj is not null && obj["manifest"] is JsonObject man)
            manifest = (JsonObject)BackupJsonUtil.CloneExact(man)!;
        JsonArray? attachments = null;
        if (obj is not null && obj["attachmentsIndex"] is JsonArray idx)
            attachments = (JsonArray)BackupJsonUtil.CloneExact(idx)!;

        return new BackupFinalizeResult
        {
            Ok = true,
            Data = data,
            CanonicalString = BackupCanonicalChecksum.CanonicalString(data),
            Sha256Hex = BackupCanonicalChecksum.Sha256Hex(data),
            Checksum = obj is not null && obj.ContainsKey("checksum") ? BackupJsonUtil.Str(obj["checksum"]) : "",
            ChecksumAlgo = obj is not null && obj.ContainsKey("checksumAlgo") ? BackupJsonUtil.Str(obj["checksumAlgo"]) : "",
            ExportedAt = obj is not null && obj.ContainsKey("exportedAt") ? BackupJsonUtil.Str(obj["exportedAt"]) : "",
            SectionChecksums = sections,
            Manifest = manifest,
            AttachmentsIndex = attachments,
            Log = log
        };
    }

    private static BackupFinalizeResult Fail(string name, string message, List<string> log) =>
        new()
        {
            Ok = false,
            Threw = true,
            ErrorName = name,
            ErrorMessage = message,
            Log = log
        };

    private static string ResolveOrigin(JsonObject data, string? origin)
    {
        if (!string.IsNullOrEmpty(origin)) return origin;
        if (!BackupJsonUtil.IsJsFalsy(data.ContainsKey("origin") ? data["origin"] : null))
            return BackupJsonUtil.Str(data["origin"]);
        return "manual";
    }

    private static string ResolveKind(JsonObject data, string? kind)
    {
        if (!string.IsNullOrEmpty(kind)) return kind;
        return !BackupJsonUtil.IsJsFalsy(data.ContainsKey("partial") ? data["partial"] : null)
            ? "partial"
            : "full";
    }

    private static string FirstTruthyString(JsonNode? a, JsonNode? b)
    {
        if (!BackupJsonUtil.IsJsFalsy(a)) return BackupJsonUtil.Str(a);
        if (!BackupJsonUtil.IsJsFalsy(b)) return BackupJsonUtil.Str(b);
        return "";
    }
}
