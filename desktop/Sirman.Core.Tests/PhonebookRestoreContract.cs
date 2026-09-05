using System.Text.Json;
using System.Text.Json.Nodes;

namespace Sirman.Core.Tests;

/// <summary>
/// ARCH-25 TEST replica of the production Phonebook Restore Contract.
/// Mirrors applyBackupMergeSections / applyBackupReplaceSections Phonebook branches
/// after ARCH-25. Historical pre-ARCH-25 behavior stays in PhonebookRestoreSafety.
/// </summary>
public static class PhonebookRestoreContract
{
    public const string OutcomeAdd = "ADD";
    public const string OutcomeSkipExactDuplicate = "SKIP_EXACT_DUPLICATE";
    public const string OutcomeSkipPhoneMatch = "SKIP_PHONE_MATCH";
    public const string ReplaceReplace = "REPLACE";
    public const string ReplaceClear = "CLEAR";
    public const string ReplaceLegacyPb = "LEGACY_PB";
    public const string ReplaceKeepLive = "KEEP_LIVE";

    public const string AssemblerSha = "f354ba9875b25c3160581b6f06a62e991c11fb7a6181f9172db0db93c78cbd41";
    public const string SavePbContactSha = "1883f9d3dd575719ae6d653a30318faa38fed4dd9e046ead32a7070730e4cf81";
    public const string CollectPhonebookSnapshotSha = "7595af4ed999d5c3213af78fe8ef5f74e1da4252d53961df466c998cc5e7a79c";
    public const string CollectAttachmentIndexSha = "ed781c62b8a0da9e80b458339cf3bf36bbabd38183ee5f5c1b81b9e686877d8f";
    public const string RequiredAdapterSha = "92dd552685fce56b5cff75a41c4a767d658233affc6d3870d015dc379199c631";
    public const string OptionalAdapterSha = "d885fa4c4c5f128f36db7799a5732adc3765025b9bebe204779a77c01a79b508";
    public const string MergeShaPreArch25 = "d01ee56106db3d5389ac3e7dc9ecec3c242965fb7aee7e2ba7e04835951d6b9d";
    public const string ReplaceShaPreArch25 = "8391119460561bc591b346c17bead9bdd75317828dd14a1b3636421e5cedc81b";
    public const string MergeSha = "0505b31f8f46e96dd097294e37c17549c79810b422073f2cc33111cdab90dc49";
    public const string ReplaceSha = "b067f92b2e1bbf60c9d6edcc77dba68b5e839b44c8d0d61ab95967e47426b7af";
    public const string FingerprintSha = "32eb8b515ee874e7e4eb89568e1293cbd54196e56667e863383f62add453dc15";

    public sealed record MergeRowResult(JsonObject Incoming, bool Added, string Outcome);

    public sealed record MergeResult(
        List<JsonObject> State,
        int Added,
        int Skipped,
        IReadOnlyList<MergeRowResult> Rows);

    public sealed record ReplaceResult(List<JsonObject> State, string Outcome, bool LivePreserved);

    static JsonObject Clone(JsonObject src) => PhonebookRestoreSafety.CloneContact(src);

    static string Fp(JsonNode? node) => PhonebookRestoreSafety.CanonicalFingerprint(node);

    static string EntryPhone(JsonObject? entry) => PhonebookRestoreSafety.EntryPhone(entry);

    static string StrField(JsonObject x, string key)
    {
        if (!x.TryGetPropertyValue(key, out var n) || n is null || n.GetValueKind() != JsonValueKind.String)
            return "";
        return n.GetValue<string>() ?? "";
    }

    static JsonObject ApplyLegacyConvert(JsonObject x)
    {
        var hasFn = x.TryGetPropertyValue("fn", out _);
        var hasPhones = x.TryGetPropertyValue("phones", out _);
        if (hasFn || hasPhones) return Clone(x);

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

    static bool LiveHasRawPhone(IEnumerable<JsonObject> live, string entryPhone)
    {
        if (string.IsNullOrEmpty(entryPhone)) return false;
        foreach (var p in live)
        {
            if (!p.TryGetPropertyValue("phones", out var phonesNode) || phonesNode is not JsonArray phones)
                continue;
            foreach (var n in phones)
            {
                if (n is null) continue;
                if (n.GetValueKind() == JsonValueKind.String && n.GetValue<string>() == entryPhone)
                    return true;
            }
        }
        return false;
    }

    /// <summary>
    /// Replica of ARCH-25 applyBackupMergeSections Phonebook branch (Policy B).
    /// </summary>
    public static MergeResult Merge(IEnumerable<JsonObject> live, JsonObject backup)
    {
        var state = live.Select(Clone).ToList();
        var rows = new List<MergeRowResult>();
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
                continue;
            var entry = ApplyLegacyConvert(x);
            var entryPhone = EntryPhone(entry);
            var fp = Fp(entry);
            var exact = state.Any(p => Fp(p) == fp);
            if (exact)
            {
                skipped++;
                rows.Add(new MergeRowResult(entry, false, OutcomeSkipExactDuplicate));
                continue;
            }
            if (!string.IsNullOrEmpty(entryPhone) && LiveHasRawPhone(state, entryPhone))
            {
                skipped++;
                rows.Add(new MergeRowResult(entry, false, OutcomeSkipPhoneMatch));
                continue;
            }
            state.Add(Clone(entry));
            added++;
            rows.Add(new MergeRowResult(entry, true, OutcomeAdd));
        }

        return new MergeResult(state, added, skipped, rows);
    }

    /// <summary>
    /// Replica of ARCH-25 applyBackupReplaceSections Phonebook branch.
    /// Missing / null / wrong-type → KEEP_LIVE. Explicit [] → CLEAR.
    /// </summary>
    public static ReplaceResult Replace(IEnumerable<JsonObject> live, JsonObject backup)
    {
        var liveList = live.Select(Clone).ToList();
        if (backup.TryGetPropertyValue("phonebook", out var pbNode) && pbNode is JsonArray pbArr && pbArr.Count > 0)
            return new ReplaceResult(pbArr.OfType<JsonObject>().Select(Clone).ToList(), ReplaceReplace, false);

        if (backup.TryGetPropertyValue("pb", out var aliasNode) && aliasNode is JsonArray aliasArr && aliasArr.Count > 0)
            return new ReplaceResult(aliasArr.OfType<JsonObject>().Select(x => Clone(ApplyLegacyConvert(x))).ToList(), ReplaceLegacyPb, false);

        if (backup.TryGetPropertyValue("phonebook", out var emptyNode) && emptyNode is JsonArray emptyArr && emptyArr.Count == 0)
            return new ReplaceResult(new List<JsonObject>(), ReplaceClear, false);

        return new ReplaceResult(liveList, ReplaceKeepLive, true);
    }
}
