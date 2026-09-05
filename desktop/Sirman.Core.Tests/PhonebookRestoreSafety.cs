using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;

namespace Sirman.Core.Tests;

/// <summary>
/// ARCH-23 TEST-ONLY Phonebook restore safety model.
/// Mirrors production Merge/Replace Phonebook branches without editing them.
/// Candidate outcomes are design-only; never wired into production.
/// </summary>
public static class PhonebookRestoreSafety
{
    public const string OutcomeAdd = "ADD";
    public const string OutcomeSkipExactDuplicate = "SKIP_EXACT_DUPLICATE";
    public const string OutcomeSkipPhoneMatch = "SKIP_PHONE_MATCH";
    public const string OutcomeConflictEmptyPhone = "CONFLICT_EMPTY_PHONE";
    public const string OutcomeConflictIdentityAmbiguous = "CONFLICT_IDENTITY_AMBIGUOUS";
    public const string OutcomeInvalidInput = "INVALID_INPUT";

    public const string AssemblerSha = "f354ba9875b25c3160581b6f06a62e991c11fb7a6181f9172db0db93c78cbd41";
    public const string CollectPhonebookSnapshotSha = "7595af4ed999d5c3213af78fe8ef5f74e1da4252d53961df466c998cc5e7a79c";
    public const string SavePbContactSha = "1883f9d3dd575719ae6d653a30318faa38fed4dd9e046ead32a7070730e4cf81";
    public const string MergeSha = "d01ee56106db3d5389ac3e7dc9ecec3c242965fb7aee7e2ba7e04835951d6b9d";
    public const string ReplaceSha = "8391119460561bc591b346c17bead9bdd75317828dd14a1b3636421e5cedc81b";

    public sealed record ProductionMergeRowResult(JsonObject Incoming, bool Added, string Reason);

    public sealed record ProductionMergeResult(
        List<JsonObject> State,
        int Added,
        int Skipped,
        IReadOnlyList<ProductionMergeRowResult> Rows);

    public sealed record CandidateRowResult(JsonObject? Incoming, string Outcome, string Detail);

    public sealed record CandidateMergeResult(
        List<JsonObject> State,
        IReadOnlyList<CandidateRowResult> Rows);

    public static JsonObject CloneContact(JsonObject src)
    {
        return JsonNode.Parse(src.ToJsonString())!.AsObject();
    }

    public static string CanonicalFingerprint(JsonNode? node)
    {
        var sb = new StringBuilder();
        WriteCanonical(node, sb);
        return sb.ToString();
    }

    public static string CanonicalFingerprint(JsonObject contact) => CanonicalFingerprint((JsonNode)contact);

    static void WriteCanonical(JsonNode? node, StringBuilder sb)
    {
        if (node is null)
        {
            sb.Append("null");
            return;
        }

        switch (node)
        {
            case JsonObject obj:
                sb.Append('{');
                var first = true;
                foreach (var kv in obj.OrderBy(p => p.Key, StringComparer.Ordinal))
                {
                    if (!first) sb.Append(',');
                    first = false;
                    sb.Append(JsonSerializer.Serialize(kv.Key));
                    sb.Append(':');
                    WriteCanonical(kv.Value, sb);
                }
                sb.Append('}');
                break;
            case JsonArray arr:
                sb.Append('[');
                for (var i = 0; i < arr.Count; i++)
                {
                    if (i > 0) sb.Append(',');
                    WriteCanonical(arr[i], sb);
                }
                sb.Append(']');
                break;
            default:
                sb.Append(node.ToJsonString());
                break;
        }
    }

    public static string EntryPhone(JsonObject? entry)
    {
        if (entry is null) return "";
        if (!entry.TryGetPropertyValue("phones", out var phonesNode) || phonesNode is not JsonArray phones || phones.Count == 0)
            return "";
        var first = phones[0];
        if (first is null || first.GetValueKind() == JsonValueKind.Null) return "";
        if (first.GetValueKind() == JsonValueKind.String) return first.GetValue<string>() ?? "";
        return first.ToJsonString();
    }

    static string StrField(JsonObject x, string key)
    {
        if (!x.TryGetPropertyValue(key, out var n) || n is null || n.GetValueKind() != JsonValueKind.String)
            return "";
        return n.GetValue<string>() ?? "";
    }

    /// <summary>
    /// Mirrors applyBackupMergeSections legacy convert:
    /// if (x.fn === undefined &amp;&amp; x.phones === undefined) map name/phone → fn/ln/phones.
    /// </summary>
    static JsonObject ApplyLegacyConvert(JsonObject x)
    {
        var hasFn = x.TryGetPropertyValue("fn", out _);
        var hasPhones = x.TryGetPropertyValue("phones", out _);
        if (hasFn || hasPhones) return CloneContact(x);

        var name = StrField(x, "name");
        var parts = name.Split(' ');
        var fn = parts.Length > 0 ? parts[0] : "";
        var ln = parts.Length > 1 ? string.Join(" ", parts.Skip(1)) : "";
        var phone = StrField(x, "phone");
        var addr = x.TryGetPropertyValue("address", out _) ? StrField(x, "address") : StrField(x, "addr");
        var phones = new JsonArray();
        if (phone.Length > 0) phones.Add(phone);
        return new JsonObject
        {
            ["fn"] = fn,
            ["ln"] = ln,
            ["shop"] = StrField(x, "shop"),
            ["addr"] = addr,
            ["zip"] = StrField(x, "zip"),
            ["phones"] = phones,
            ["ita"] = StrField(x, "ita"),
            ["tg"] = StrField(x, "tg"),
            ["wa"] = StrField(x, "wa"),
            ["ig"] = StrField(x, "ig"),
            ["note"] = StrField(x, "note"),
            ["cat"] = x.TryGetPropertyValue("cat", out _) && StrField(x, "cat").Length > 0 ? StrField(x, "cat") : "other"
        };
    }

    /// <summary>
    /// Exact replica of applyBackupMergeSections Phonebook branch (Sirman_Final.html).
    /// </summary>
    public static ProductionMergeResult MergeProduction(IEnumerable<JsonObject> live, JsonObject backup)
    {
        var state = live.Select(CloneContact).ToList();
        var rows = new List<ProductionMergeRowResult>();
        var added = 0;
        var skipped = 0;

        JsonArray pbSource;
        if (backup.TryGetPropertyValue("phonebook", out var pbNode) && pbNode is JsonArray pbArr && pbArr.Count > 0)
            pbSource = pbArr;
        else if (backup.TryGetPropertyValue("pb", out var aliasNode) && aliasNode is JsonArray aliasArr)
            pbSource = aliasArr;
        else
            pbSource = new JsonArray();

        foreach (var item in pbSource)
        {
            if (item is not JsonObject x)
            {
                rows.Add(new ProductionMergeRowResult(new JsonObject(), false, "non-object-skipped-by-forensic-note"));
                continue;
            }

            var entry = ApplyLegacyConvert(x);
            var entryPhone = EntryPhone(entry);
            var exists = state.Find(p =>
            {
                if (string.IsNullOrEmpty(entryPhone)) return false;
                if (!p.TryGetPropertyValue("phones", out var livePhones) || livePhones is not JsonArray liveArr)
                    return false;
                return liveArr.Any(n => n is not null && (n.GetValueKind() == JsonValueKind.String
                    ? n.GetValue<string>() == entryPhone
                    : n.ToJsonString() == JsonSerializer.Serialize(entryPhone)));
            }) != null;

            if (!exists)
            {
                state.Add(CloneContact(entry));
                added++;
                rows.Add(new ProductionMergeRowResult(entry, true, "insert-because-no-phones0-match"));
            }
            else
            {
                skipped++;
                rows.Add(new ProductionMergeRowResult(entry, false, "skip-phones0-found-in-live"));
            }
        }

        return new ProductionMergeResult(state, added, skipped, rows);
    }

    /// <summary>
    /// Exact replica of applyBackupReplaceSections Phonebook branch.
    /// Missing / empty / null / wrong-type → [].
    /// </summary>
    public static List<JsonObject> ReplaceProduction(IEnumerable<JsonObject> live, JsonObject backup)
    {
        _ = live;
        if (backup.TryGetPropertyValue("phonebook", out var pbNode) && pbNode is JsonArray pbArr && pbArr.Count > 0)
            return pbArr.OfType<JsonObject>().Select(CloneContact).ToList();

        if (backup.TryGetPropertyValue("pb", out var aliasNode) && aliasNode is JsonArray aliasArr && aliasArr.Count > 0)
            return aliasArr.OfType<JsonObject>().Select(x => CloneContact(ApplyLegacyConvert(x))).ToList();

        return new List<JsonObject>();
    }

    public static bool HasStablePersistentId(JsonObject contact)
    {
        if (!contact.TryGetPropertyValue("id", out var idNode) || idNode is null)
            return false;
        if (idNode.GetValueKind() == JsonValueKind.String)
            return !string.IsNullOrWhiteSpace(idNode.GetValue<string>());
        if (idNode.GetValueKind() == JsonValueKind.Number)
            return true;
        return false;
    }

    public static bool AnyLiveHasStableId(IEnumerable<JsonObject> live) => live.Any(HasStablePersistentId);

    static int CountPhoneMatches(IEnumerable<JsonObject> live, string entryPhone)
    {
        if (string.IsNullOrEmpty(entryPhone)) return 0;
        var count = 0;
        foreach (var p in live)
        {
            if (!p.TryGetPropertyValue("phones", out var phonesNode) || phonesNode is not JsonArray phones)
                continue;
            if (phones.Any(n => n is not null && n.GetValueKind() == JsonValueKind.String && n.GetValue<string>() == entryPhone))
                count++;
        }
        return count;
    }

    public static string ClassifyCandidate(IEnumerable<JsonObject> live, JsonNode? incoming)
    {
        if (incoming is not JsonObject obj)
            return OutcomeInvalidInput;

        var entry = ApplyLegacyConvert(obj);
        var fp = CanonicalFingerprint(entry);
        var liveList = live.ToList();
        if (liveList.Any(p => CanonicalFingerprint(p) == fp))
            return OutcomeSkipExactDuplicate;

        var phone = EntryPhone(entry);
        if (!string.IsNullOrEmpty(phone))
        {
            var matches = CountPhoneMatches(liveList, phone);
            if (matches == 1) return OutcomeSkipPhoneMatch;
            if (matches > 1) return OutcomeConflictIdentityAmbiguous;
            return OutcomeAdd;
        }

        return OutcomeConflictEmptyPhone;
    }

    /// <summary>
    /// TEST-ONLY candidate. Never deletes. Never mutates incoming. No UPDATE.
    /// Exact empty-phone clones SKIP; different empty-phone rows CONFLICT (not auto-added).
    /// Non-empty phones keep raw phones[0] matching.
    /// </summary>
    public static CandidateMergeResult MergeCandidate(IEnumerable<JsonObject> live, IEnumerable<JsonNode?> incoming)
    {
        var state = live.Select(CloneContact).ToList();
        var rows = new List<CandidateRowResult>();
        foreach (var item in incoming)
        {
            var outcome = ClassifyCandidate(state, item);
            JsonObject? cloned = item is JsonObject o ? CloneContact(ApplyLegacyConvert(o)) : null;
            if (outcome == OutcomeAdd && cloned is not null)
                state.Add(CloneContact(cloned));
            rows.Add(new CandidateRowResult(cloned, outcome, outcome));
        }
        return new CandidateMergeResult(state, rows);
    }

    public static (int First, int Second) IdempotencyGrowth(List<JsonObject> live, IEnumerable<JsonObject> payload)
    {
        var first = MergeCandidate(live, payload);
        var afterFirst = first.State.Count - live.Count;
        var second = MergeCandidate(first.State, payload);
        var afterSecond = second.State.Count - first.State.Count;
        return (afterFirst, afterSecond);
    }

    public static (int First, int Second) ProductionIdempotencyGrowth(List<JsonObject> live, JsonObject backup)
    {
        var first = MergeProduction(live, backup);
        var afterFirst = first.State.Count - live.Count;
        var second = MergeProduction(first.State, backup);
        var afterSecond = second.State.Count - first.State.Count;
        return (afterFirst, afterSecond);
    }

    public static JsonObject? DaqiContactAt(IReadOnlyList<JsonObject> phonebook, int idx)
    {
        if (idx < 0 || idx >= phonebook.Count) return null;
        return phonebook[idx];
    }

    public static string ContactLabel(JsonObject c)
    {
        var fn = c.TryGetPropertyValue("fn", out var fnNode) && fnNode is not null && fnNode.GetValueKind() == JsonValueKind.String
            ? fnNode.GetValue<string>()
            : "";
        return fn + "|" + EntryPhone(c) + "|" + CanonicalFingerprint(c);
    }
}
