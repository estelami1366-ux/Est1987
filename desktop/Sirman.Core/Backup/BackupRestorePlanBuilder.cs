using System.Text.Json.Nodes;

namespace Sirman.Core.Backup;

/// <summary>
/// ARCH-8 restore DECISION planner. Describes Merge/Replace without applying.
/// Does not persist, touch Host/DOM/storage, or call live HTML engines.
/// Phonebook is excluded from identity calculations.
/// </summary>
public static class BackupRestorePlanBuilder
{
    public const string PhonebookSection = "phonebook";

    public static readonly IReadOnlyList<string> PlannableCollections = new[]
    {
        "accounts", "invoices", "parts", "sales", "warranties"
    };

    public static RestorePlan Build(RestorePlanRequest? request) =>
        Build(request?.Data, request?.Current, request?.Mode ?? RestorePlanMode.Merge, request?.SelectedSections, request?.NowMs);

    public static RestorePlan Build(
        JsonNode? backup,
        JsonNode? current,
        RestorePlanMode mode = RestorePlanMode.Merge,
        IReadOnlyList<string>? selectedSections = null,
        long? nowMs = null)
    {
        var backupClone = BackupJsonUtil.CloneExact(backup);
        var currentClone = BackupJsonUtil.CloneExact(current);

        var dry = BackupDryRunService.Run(backupClone, nowMs);
        if (!dry.Ok || dry.Status == BackupValidationStatus.INVALID)
        {
            return Finish(new RestorePlan
            {
                Ok = false,
                Applied = false,
                Mode = mode,
                Status = BackupValidationStatus.INVALID,
                DryRun = dry,
                Errors = dry.Errors,
                Warnings = dry.Warnings,
                MigratedData = null
            });
        }

        var migrated = dry.Data;
        var warnings = new List<string>(dry.Warnings);
        var selected = NormalizeSelection(selectedSections, migrated);
        var sections = new List<RestorePlanSection>();

        foreach (var name in PlannableCollections)
        {
            sections.Add(PlanCollection(name, IdentityKey(name), migrated, currentClone, mode, selected.Contains(name)));
        }

        if (selected.Contains(PhonebookSection) || selected.Contains("pb"))
        {
            sections.Add(new RestorePlanSection
            {
                Name = PhonebookSection,
                Selected = true,
                Excluded = true,
                Action = RestorePlanAction.NoAction,
                Warnings = new[] { "دفترچه تلفن از محاسبه هویت RestorePlan خارج است" }
            });
            warnings.Add("دفترچه تلفن از محاسبه هویت RestorePlan خارج است");
        }

        foreach (var extra in selected)
        {
            if (extra == PhonebookSection || extra == "pb") continue;
            if (PlannableCollections.Contains(extra)) continue;
            sections.Add(new RestorePlanSection
            {
                Name = extra,
                Selected = true,
                Excluded = true,
                Action = RestorePlanAction.NoAction,
                Warnings = new[] { "مجموعه «" + extra + "» هویت پشتیبانی‌شده در این استخراج ندارد — REVIEW" }
            });
            warnings.Add("مجموعه «" + extra + "» هویت پشتیبانی‌شده در این استخراج ندارد");
        }

        var conflictSections = sections.Count(s => s.Action == RestorePlanAction.Conflict || (s.Conflicts ?? 0) > 0);
        var status = conflictSections > 0
            ? BackupValidationStatus.VALID_WITH_WARNINGS
            : BackupJsonUtil.StatusOf(true, warnings);

        return Finish(new RestorePlan
        {
            Ok = true,
            Applied = false,
            Mode = mode,
            Status = status,
            DryRun = dry,
            Summary = new RestorePlanSummary
            {
                SelectedSections = sections.Count(s => s.Selected),
                PlannedSections = sections.Count(s => s.Selected && !s.Excluded),
                ExcludedSections = sections.Count(s => s.Excluded),
                ConflictSections = conflictSections
            },
            Sections = sections,
            Errors = Array.Empty<string>(),
            Warnings = warnings,
            MigratedData = migrated
        });
    }

    public static string IdentityKey(string collection) => collection switch
    {
        "invoices" => "invoiceId",
        "sales" => "saleUid",
        "warranties" => "id",
        "parts" => "id",
        "accounts" => "id",
        _ => ""
    };

    private static HashSet<string> NormalizeSelection(IReadOnlyList<string>? selected, JsonNode? migrated)
    {
        if (selected is { Count: > 0 })
            return new HashSet<string>(selected, StringComparer.Ordinal);
        var all = new HashSet<string>(StringComparer.Ordinal);
        foreach (var name in PlannableCollections)
        {
            if (migrated is JsonObject obj && obj.ContainsKey(name) && obj[name] is JsonArray)
                all.Add(name);
        }
        return all;
    }

    private static RestorePlanSection PlanCollection(
        string name,
        string identityKey,
        JsonNode? migrated,
        JsonNode? current,
        RestorePlanMode mode,
        bool selected)
    {
        var sourceArr = ArrayOf(migrated, name);
        int? sourceCount = sourceArr is null ? null : sourceArr.Count;
        var (currentAvailable, currentArr, currentCount) = ReadCurrent(current, name);

        if (!selected)
        {
            return new RestorePlanSection
            {
                Name = name,
                Selected = false,
                CurrentStateAvailable = currentAvailable,
                Action = RestorePlanAction.NoAction,
                SourceCount = sourceCount,
                CurrentCount = currentAvailable ? currentCount : null,
                IdentityKey = identityKey
            };
        }

        if (sourceArr is null)
        {
            return new RestorePlanSection
            {
                Name = name,
                Selected = true,
                CurrentStateAvailable = currentAvailable,
                Action = RestorePlanAction.NoAction,
                SourceCount = null,
                CurrentCount = currentAvailable ? currentCount : null,
                IdentityKey = identityKey,
                Warnings = new[] { "مجموعه در بسته مهاجرت‌شده موجود نیست — omitted ≠ empty" }
            };
        }

        if (mode == RestorePlanMode.Replace)
            return PlanReplace(name, identityKey, sourceArr, currentAvailable, currentCount);

        return PlanMerge(name, identityKey, sourceArr, currentAvailable, currentArr, currentCount);
    }

    private static RestorePlanSection PlanReplace(
        string name,
        string identityKey,
        JsonArray source,
        bool currentAvailable,
        int? currentCount)
    {
        var records = new List<RestorePlanRecord>();
        var conflicts = new List<RestoreConflict>();
        var seen = new Dictionary<string, int>(StringComparer.Ordinal);
        for (var i = 0; i < source.Count; i++)
        {
            var id = IdentityOf(source[i], identityKey);
            var action = RestorePlanAction.Replace;
            if (id is null)
            {
                action = RestorePlanAction.Replace;
            }
            else if (!seen.TryAdd(id, i))
            {
                action = RestorePlanAction.Conflict;
                conflicts.Add(new RestoreConflict
                {
                    Collection = name,
                    IdentityKey = identityKey,
                    Identity = id,
                    Reason = "هویت تکراری در منبع"
                });
            }
            records.Add(new RestorePlanRecord { Index = i, Identity = id, Action = action });
        }

        return new RestorePlanSection
        {
            Name = name,
            Selected = true,
            CurrentStateAvailable = currentAvailable,
            Action = conflicts.Count > 0 ? RestorePlanAction.Conflict : RestorePlanAction.Replace,
            SourceCount = source.Count,
            CurrentCount = currentAvailable ? currentCount : null,
            ResultingCount = source.Count,
            ProposedAdditions = source.Count,
            ProposedUpdates = 0,
            ProposedRemovals = currentAvailable ? currentCount : null,
            Skipped = 0,
            Conflicts = conflicts.Count,
            IdentityKey = identityKey,
            Records = records,
            ConflictDetails = conflicts
        };
    }

    private static RestorePlanSection PlanMerge(
        string name,
        string identityKey,
        JsonArray source,
        bool currentAvailable,
        JsonArray? currentArr,
        int? currentCount)
    {
        var warnings = new List<string>();
        if (!currentAvailable)
        {
            warnings.Add("وضعیت جاری برای ادغام داده نشده — MISSING current ≠ empty");
            var pending = new List<RestorePlanRecord>();
            for (var i = 0; i < source.Count; i++)
            {
                pending.Add(new RestorePlanRecord
                {
                    Index = i,
                    Identity = IdentityOf(source[i], identityKey),
                    Action = RestorePlanAction.NoAction
                });
            }
            return new RestorePlanSection
            {
                Name = name,
                Selected = true,
                CurrentStateAvailable = false,
                Action = RestorePlanAction.NoAction,
                SourceCount = source.Count,
                CurrentCount = null,
                ResultingCount = null,
                ProposedAdditions = null,
                ProposedUpdates = 0,
                ProposedRemovals = 0,
                Skipped = null,
                Conflicts = 0,
                IdentityKey = identityKey,
                Records = pending,
                Warnings = warnings
            };
        }

        var currentIds = new Dictionary<string, int>(StringComparer.Ordinal);
        var currentDup = new HashSet<string>(StringComparer.Ordinal);
        if (currentArr is not null)
        {
            for (var i = 0; i < currentArr.Count; i++)
            {
                var id = IdentityOf(currentArr[i], identityKey);
                if (id is null) continue;
                if (!currentIds.TryAdd(id, i))
                    currentDup.Add(id);
            }
        }

        var sourceSeen = new Dictionary<string, int>(StringComparer.Ordinal);
        var records = new List<RestorePlanRecord>();
        var conflicts = new List<RestoreConflict>();
        var add = 0;
        var skip = 0;
        var conflictN = 0;

        for (var i = 0; i < source.Count; i++)
        {
            var id = IdentityOf(source[i], identityKey);
            RestorePlanAction action;
            if (id is null)
            {
                action = RestorePlanAction.Conflict;
                conflictN++;
                conflicts.Add(new RestoreConflict
                {
                    Collection = name,
                    IdentityKey = identityKey,
                    Identity = "",
                    Reason = "هویت ناکافی — حدس زده نشد"
                });
            }
            else if (!sourceSeen.TryAdd(id, i))
            {
                action = RestorePlanAction.Conflict;
                conflictN++;
                conflicts.Add(new RestoreConflict
                {
                    Collection = name,
                    IdentityKey = identityKey,
                    Identity = id,
                    Reason = "هویت تکراری در منبع"
                });
            }
            else if (currentDup.Contains(id))
            {
                action = RestorePlanAction.Conflict;
                conflictN++;
                conflicts.Add(new RestoreConflict
                {
                    Collection = name,
                    IdentityKey = identityKey,
                    Identity = id,
                    Reason = "هویت مبهم در وضعیت جاری"
                });
            }
            else if (currentIds.ContainsKey(id))
            {
                action = RestorePlanAction.Skip;
                skip++;
            }
            else
            {
                action = RestorePlanAction.Add;
                add++;
            }

            records.Add(new RestorePlanRecord { Index = i, Identity = id, Action = action });
        }

        var sectionAction = conflictN > 0
            ? RestorePlanAction.Conflict
            : add > 0 ? RestorePlanAction.Add : RestorePlanAction.Skip;
        if (source.Count == 0)
            sectionAction = RestorePlanAction.NoAction;

        return new RestorePlanSection
        {
            Name = name,
            Selected = true,
            CurrentStateAvailable = true,
            Action = sectionAction,
            SourceCount = source.Count,
            CurrentCount = currentCount,
            ResultingCount = (currentCount ?? 0) + add,
            ProposedAdditions = add,
            ProposedUpdates = 0,
            ProposedRemovals = 0,
            Skipped = skip,
            Conflicts = conflictN,
            IdentityKey = identityKey,
            Records = records,
            ConflictDetails = conflicts,
            Warnings = warnings
        };
    }

    private static (bool available, JsonArray? arr, int? count) ReadCurrent(JsonNode? current, string name)
    {
        if (current is not JsonObject obj || !obj.ContainsKey(name))
            return (false, null, null);
        var val = obj[name];
        if (val is JsonArray arr)
            return (true, arr, arr.Count);
        return (false, null, null);
    }

    private static JsonArray? ArrayOf(JsonNode? package, string name)
    {
        if (package is not JsonObject obj || !obj.ContainsKey(name))
            return null;
        return obj[name] as JsonArray;
    }

    private static string? IdentityOf(JsonNode? rec, string key)
    {
        if (rec is not JsonObject obj || string.IsNullOrEmpty(key) || !obj.ContainsKey(key))
            return null;
        var raw = BackupJsonUtil.Str(obj[key]).Trim();
        return raw.Length == 0 ? null : raw;
    }

    private static RestorePlan Finish(RestorePlan plan)
    {
        return new RestorePlan
        {
            Ok = plan.Ok,
            Applied = false,
            Mode = plan.Mode,
            Status = plan.Status,
            DryRun = plan.DryRun,
            Summary = plan.Summary,
            Sections = plan.Sections,
            Errors = plan.Errors,
            Warnings = plan.Warnings,
            Fingerprint = Fingerprint(plan),
            MigratedData = plan.MigratedData
        };
    }

    public static string Fingerprint(RestorePlan plan)
    {
        var node = new JsonObject
        {
            ["ok"] = plan.Ok,
            ["applied"] = false,
            ["mode"] = plan.ModeName,
            ["status"] = plan.StatusName
        };
        var secs = new JsonArray();
        foreach (var s in plan.Sections.OrderBy(x => x.Name, StringComparer.Ordinal))
        {
            var o = new JsonObject
            {
                ["name"] = s.Name,
                ["selected"] = s.Selected,
                ["excluded"] = s.Excluded,
                ["currentAvailable"] = s.CurrentStateAvailable,
                ["action"] = s.Action.ToString(),
                ["sourceCount"] = s.SourceCount is int sc ? JsonValue.Create(sc) : null,
                ["currentCount"] = s.CurrentCount is int cc ? JsonValue.Create(cc) : null,
                ["resultingCount"] = s.ResultingCount is int rc ? JsonValue.Create(rc) : null,
                ["add"] = s.ProposedAdditions is int a ? JsonValue.Create(a) : null,
                ["update"] = s.ProposedUpdates is int u ? JsonValue.Create(u) : null,
                ["remove"] = s.ProposedRemovals is int r ? JsonValue.Create(r) : null,
                ["skip"] = s.Skipped is int sk ? JsonValue.Create(sk) : null,
                ["conflicts"] = s.Conflicts is int cf ? JsonValue.Create(cf) : null,
                ["identityKey"] = s.IdentityKey
            };
            var recs = new JsonArray();
            foreach (var rec in s.Records)
            {
                recs.Add(new JsonObject
                {
                    ["i"] = rec.Index,
                    ["id"] = rec.Identity,
                    ["action"] = rec.Action.ToString()
                });
            }
            o["records"] = recs;
            secs.Add(o);
        }
        node["sections"] = secs;
        var errs = new JsonArray();
        foreach (var e in plan.Errors) errs.Add(e);
        node["errors"] = errs;
        return BackupCanonicalChecksum.Sha256Utf8Hex(BackupJsJson.Stringify(node));
    }
}
