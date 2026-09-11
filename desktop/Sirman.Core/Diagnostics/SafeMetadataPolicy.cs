using System.Collections;
using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;

namespace Sirman.Core.Diagnostics;

/// <summary>
/// Fail-closed metadata filter. Unknown keys are forbidden. Exception.Data is never copied blindly.
/// </summary>
public static class SafeMetadataPolicy
{
    public static readonly HashSet<string> SafeKeys = new(StringComparer.OrdinalIgnoreCase)
    {
        "appVersion", "assemblyVersion", "os", "runtime", "module", "operation",
        "timestamp", "correlationId", "severity", "exceptionType", "code",
        "technicalMessage", "outcome", "dataChanged", "source", "eventId",
        "success", "roleName", "sessionAuthenticated", "stackHash", "webViewReason",
        "webViewStatus", "hostMethod"
    };

    static readonly string[] ForbiddenNeedles =
    {
        "password", "passwd", "pwd", "token", "secret", "apikey", "api_key", "api-key",
        "loginpw", "laegh_login_pw", "laegh_adminpw", "bearer", "phonebook", "invoice",
        "invoices", "sales", "warranty", "warranties", "accounts", "customer",
        "phonebookdump", "lb", "li", "lp", "lv", "la", "lc", "fullhtml", "sqlite"
    };

    static readonly Regex SecretAssign = new(
        @"(password|pass|pwd|token|secret|api[_-]?key|loginPw|laegh_login_pw|laegh_adminpw)\s*[:=]\s*\S+",
        RegexOptions.IgnoreCase | RegexOptions.Compiled);

    static readonly Regex Bearer = new(@"Bearer\s+[A-Za-z0-9._\-]+", RegexOptions.IgnoreCase | RegexOptions.Compiled);

    public static MetadataClass ClassifyKey(string? key)
    {
        var k = (key ?? "").Trim();
        if (k.Length == 0) return MetadataClass.Forbidden;
        foreach (var needle in ForbiddenNeedles)
        {
            if (needle.Length <= 3)
            {
                if (string.Equals(k, needle, StringComparison.OrdinalIgnoreCase))
                    return MetadataClass.Forbidden;
                continue;
            }
            if (k.IndexOf(needle, StringComparison.OrdinalIgnoreCase) >= 0)
                return MetadataClass.Forbidden;
        }
        if (SafeKeys.Contains(k)) return MetadataClass.Safe;
        return MetadataClass.Forbidden;
    }

    public static string Redact(string? value)
    {
        var s = value ?? "";
        s = SecretAssign.Replace(s, "$1=***");
        s = Bearer.Replace(s, "Bearer ***");
        if (s.Length > 400) s = s[..400] + "…";
        return s;
    }

    public static Dictionary<string, string> Sanitize(IDictionary? source)
    {
        var dest = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        if (source is null) return dest;
        foreach (DictionaryEntry entry in source)
        {
            var key = Convert.ToString(entry.Key, CultureInfo.InvariantCulture);
            if (ClassifyKey(key) != MetadataClass.Safe) continue;
            var raw = Convert.ToString(entry.Value, CultureInfo.InvariantCulture) ?? "";
            dest[key!] = Redact(raw);
        }
        return dest;
    }

    public static string? StackHash(string? stackTrace)
    {
        if (string.IsNullOrWhiteSpace(stackTrace)) return null;
        var bytes = Encoding.UTF8.GetBytes(stackTrace);
        var hash = SHA256.HashData(bytes);
        var sb = new StringBuilder(hash.Length * 2);
        foreach (var b in hash) sb.Append(b.ToString("x2", CultureInfo.InvariantCulture));
        return sb.ToString();
    }

    public static bool ContainsForbiddenPayload(string? json)
    {
        if (string.IsNullOrEmpty(json)) return false;
        // Dump signatures only (key + colon). Enum values such as module:"sales" must not trip this.
        foreach (var needle in new[]
                 {
                     "\"phonebook\":", "\"invoices\":", "\"warranties\":", "\"accounts\":[",
                     "\"password\":", "\"apiKey\":", "\"api_key\":", "\"loginPw\":",
                     "\"laegh_login_pw\":", "\"laegh_adminpw\":"
                 })
        {
            if (json.IndexOf(needle, StringComparison.OrdinalIgnoreCase) >= 0) return true;
        }
        return false;
    }
}
