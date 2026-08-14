using System.Security.Cryptography;
using System.Text;

namespace Sirman.Core.Security;

/// <summary>
/// همان قالب HTML: pbkdf2$sha1$iters$saltHex$dkHex — سازگار با رمزهای قدیمی plaintext.
/// </summary>
public static class PasswordHasher
{
    public const string Prefix = "pbkdf2$sha1$";
    public const int DefaultIterations = 10000;
    public const int SaltBytes = 8;
    public const int DkBytes = 20;

    public static bool IsHash(string? stored) =>
        !string.IsNullOrEmpty(stored) && stored.StartsWith(Prefix, StringComparison.Ordinal);

    public static string Hash(string plain, int iterations = DefaultIterations)
    {
        plain ??= "";
        var salt = RandomNumberGenerator.GetBytes(SaltBytes);
        var dk = Pbkdf2Sha1(plain, salt, iterations, DkBytes);
        return $"{Prefix}{iterations}${ToHex(salt)}${ToHex(dk)}";
    }

    public static bool Verify(string? plain, string? stored)
    {
        if (plain is null || string.IsNullOrEmpty(stored)) return false;
        if (!IsHash(stored))
            return string.Equals(plain, stored, StringComparison.Ordinal);

        var parts = stored.Split('$');
        if (parts.Length != 5) return false;
        if (!int.TryParse(parts[2], out var iters) || iters <= 0) return false;
        byte[] salt;
        try { salt = FromHex(parts[3]); }
        catch { return false; }
        var expected = parts[4];
        if (string.IsNullOrEmpty(expected) || expected.Length % 2 != 0) return false;
        var dk = Pbkdf2Sha1(plain, salt, iters, expected.Length / 2);
        return FixedEquals(ToHex(dk), expected);
    }

    public static string UpgradeIfPlain(string plain, string? stored)
    {
        if (string.IsNullOrEmpty(plain)) return stored ?? "";
        if (IsHash(stored)) return stored!;
        if (Verify(plain, stored)) return Hash(plain);
        return stored ?? "";
    }

    public static byte[] Pbkdf2Sha1(string password, byte[] salt, int iterations, int dkLen)
    {
        var pwd = Encoding.UTF8.GetBytes(password ?? "");
        return Rfc2898DeriveBytes.Pbkdf2(pwd, salt, iterations, HashAlgorithmName.SHA1, dkLen);
    }

    public static string ToHex(byte[] bytes)
    {
        var sb = new StringBuilder(bytes.Length * 2);
        foreach (var b in bytes) sb.Append(b.ToString("x2"));
        return sb.ToString();
    }

    public static byte[] FromHex(string hex)
    {
        hex ??= "";
        var n = hex.Length / 2;
        var outBytes = new byte[n];
        for (var i = 0; i < n; i++)
            outBytes[i] = Convert.ToByte(hex.Substring(i * 2, 2), 16);
        return outBytes;
    }

    private static bool FixedEquals(string a, string b)
    {
        if (a.Length != b.Length) return false;
        var diff = 0;
        for (var i = 0; i < a.Length; i++) diff |= a[i] ^ b[i];
        return diff == 0;
    }
}
