using System.Globalization;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using Sirman.Core.Backup;

namespace Sirman.Core.Tests;

/// <summary>
/// ARCH-22 TEST-ONLY Phonebook forensic helpers.
/// Must not be called from production Backup, Restore, or savePBContact.
/// Does not write storage or mutate source arrays in place.
/// </summary>
internal static class PhonebookForensic
{
    public const string ClassA = "A";
    public const string ClassB = "B";
    public const string ClassC = "C";
    public const string ClassD = "D";
    public const string ClassE = "E";
    public const string ClassF = "F";

    public static string ContactFingerprint(JsonNode? rec) => BackupJsJson.Stringify(rec);

    /// <summary>
    /// Analysis-only phone normalization. Never written back to records.
    /// Rules: map Persian/Arabic digits to ASCII; trim; empty => no identity.
    /// No country-prefix transform (no evidence in save/merge).
    /// </summary>
    public static string NormalizePhoneForAnalysis(string? phone)
    {
        if (phone is null) return "";
        var sb = new StringBuilder(phone.Length);
        foreach (var ch in phone)
        {
            if (ch is '۰' or '٠') sb.Append('0');
            else if (ch is '۱' or '١') sb.Append('1');
            else if (ch is '۲' or '٢') sb.Append('2');
            else if (ch is '۳' or '٣') sb.Append('3');
            else if (ch is '۴' or '٤') sb.Append('4');
            else if (ch is '۵' or '٥') sb.Append('5');
            else if (ch is '۶' or '٦') sb.Append('6');
            else if (ch is '۷' or '٧') sb.Append('7');
            else if (ch is '۸' or '٨') sb.Append('8');
            else if (ch is '۹' or '٩') sb.Append('9');
            else sb.Append(ch);
        }
        return sb.ToString().Trim();
    }

    public static string FirstRawPhone(JsonNode? rec)
    {
        if (rec is not JsonObject obj) return "";
        if (obj["phones"] is JsonArray phones && phones.Count > 0)
            return RawPhoneString(phones[0]);
        if (obj.ContainsKey("phone"))
            return RawPhoneString(obj["phone"]);
        return "";
    }

    public static IReadOnlyList<string> RawPhones(JsonNode? rec)
    {
        var list = new List<string>();
        if (rec is not JsonObject obj) return list;
        if (obj["phones"] is JsonArray phones)
        {
            foreach (var p in phones)
            {
                var s = RawPhoneString(p);
                if (s.Length > 0) list.Add(s);
            }
        }
        var legacy = RawPhoneString(obj["phone"]);
        if (legacy.Length > 0) list.Add(legacy);
        return list;
    }

    public static bool HasPhoneIdentity(JsonNode? rec) => RawPhones(rec).Count > 0;

    public static string DisplayName(JsonNode? rec)
    {
        if (rec is not JsonObject obj) return "";
        var fn = BackupJsonUtil.Str(obj["fn"]);
        var ln = BackupJsonUtil.Str(obj["ln"]);
        return (fn + " " + ln).Trim();
    }

    public static IReadOnlyList<string> ClassesOf(JsonArray book, int index)
    {
        var rec = book[index];
        var found = new List<string>();
        var fp = ContactFingerprint(rec);
        for (var i = 0; i < book.Count; i++)
        {
            if (i == index) continue;
            if (ContactFingerprint(book[i]) == fp)
            {
                found.Add(ClassA);
                break;
            }
        }
        if (!HasPhoneIdentity(rec)) found.Add(ClassD);
        var raw = RawPhones(rec);
        if (raw.Count > 0)
        {
            for (var i = 0; i < book.Count; i++)
            {
                if (i == index) continue;
                var otherRaw = RawPhones(book[i]);
                if (raw.Any(p => otherRaw.Contains(p, StringComparer.Ordinal)))
                {
                    found.Add(ClassC);
                    break;
                }
            }
            var norm = raw.Select(NormalizePhoneForAnalysis).Where(s => s.Length > 0).ToList();
            if (norm.Count > 0 && !found.Contains(ClassC))
            {
                for (var i = 0; i < book.Count; i++)
                {
                    if (i == index) continue;
                    var otherNorm = RawPhones(book[i]).Select(NormalizePhoneForAnalysis).Where(s => s.Length > 0).ToList();
                    if (norm.Any(p => otherNorm.Contains(p, StringComparer.Ordinal)))
                    {
                        found.Add(ClassB);
                        break;
                    }
                }
            }
        }
        var name = DisplayName(rec);
        if (name.Length > 0)
        {
            for (var i = 0; i < book.Count; i++)
            {
                if (i == index) continue;
                if (DisplayName(book[i]) != name) continue;
                var a = FirstRawPhone(rec);
                var b = FirstRawPhone(book[i]);
                if (a != b)
                {
                    found.Add(ClassE);
                    break;
                }
            }
        }
        if (found.Count == 0) found.Add(ClassF);
        return found;
    }

    public static string PrimaryClass(JsonArray book, int index)
    {
        var all = ClassesOf(book, index);
        foreach (var c in new[] { ClassA, ClassD, ClassC, ClassB, ClassE, ClassF })
        {
            if (all.Contains(c)) return c;
        }
        return ClassF;
    }

    /// <summary>
    /// Exact replica of applyBackupMergeSections phonebook matching.
    /// entryPhone = (entry.phones &amp;&amp; entry.phones[0]) || ''
    /// exists = entryPhone &amp;&amp; live.phones.indexOf(entryPhone) !== -1
    /// Empty first phone always inserts. Does not mutate arguments; returns a new array.
    /// </summary>
    public static JsonArray MergeReplica(JsonArray state, JsonArray payload)
    {
        var next = (JsonArray)BackupJsonUtil.CloneExact(state)!;
        foreach (var raw in payload)
        {
            var entry = ConvertLegacyIfNeeded(raw);
            var entryPhone = FirstRawPhone(entry);
            var exists = false;
            if (entryPhone.Length > 0)
            {
                foreach (var live in next)
                {
                    if (RawPhones(live).Contains(entryPhone, StringComparer.Ordinal))
                    {
                        exists = true;
                        break;
                    }
                }
            }
            if (!exists) next.Add(BackupJsonUtil.CloneExact(entry));
        }
        return next;
    }

    public static string IdempotencyOf(JsonArray payload)
    {
        var once = MergeReplica(new JsonArray(), payload);
        var twice = MergeReplica(once, payload);
        if (BackupJsJson.Stringify(once) == BackupJsJson.Stringify(twice))
            return "idempotent";
        if (once.Count > 0 && twice.Count > once.Count)
            return "non-idempotent";
        return "ambiguous";
    }

    private static JsonNode ConvertLegacyIfNeeded(JsonNode? x)
    {
        var clone = BackupJsonUtil.CloneExact(x);
        if (clone is not JsonObject obj) return clone ?? new JsonObject();
        if (obj.ContainsKey("fn") || obj.ContainsKey("phones")) return obj;
        var name = BackupJsonUtil.Str(obj["name"]);
        var parts = name.Split(' ');
        var fn = parts.Length > 0 ? parts[0] : "";
        var ln = parts.Length > 1 ? string.Join(" ", parts.Skip(1)) : "";
        var phones = new JsonArray();
        var phone = BackupJsonUtil.Str(obj["phone"]);
        if (phone.Length > 0) phones.Add(phone);
        return new JsonObject
        {
            ["fn"] = fn,
            ["ln"] = ln,
            ["shop"] = BackupJsonUtil.Str(obj["shop"]),
            ["addr"] = obj.ContainsKey("address") ? BackupJsonUtil.Str(obj["address"]) : BackupJsonUtil.Str(obj["addr"]),
            ["zip"] = BackupJsonUtil.Str(obj["zip"]),
            ["phones"] = phones,
            ["ita"] = BackupJsonUtil.Str(obj["ita"]),
            ["tg"] = BackupJsonUtil.Str(obj["tg"]),
            ["wa"] = BackupJsonUtil.Str(obj["wa"]),
            ["ig"] = BackupJsonUtil.Str(obj["ig"]),
            ["note"] = BackupJsonUtil.Str(obj["note"]),
            ["cat"] = obj.ContainsKey("cat") ? BackupJsonUtil.Str(obj["cat"]) : "other"
        };
    }

    private static string RawPhoneString(JsonNode? n)
    {
        if (n is null || n.GetValueKind() == JsonValueKind.Null) return "";
        if (n is JsonValue jv)
        {
            if (jv.TryGetValue<string>(out var s)) return s;
            if (jv.TryGetValue<double>(out var d))
                return d.ToString("G", CultureInfo.InvariantCulture);
        }
        return "";
    }
}
