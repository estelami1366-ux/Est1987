using Sirman.Core.Security;
using Xunit;

namespace Sirman.Core.Tests;

public class PasswordHasherTests
{
    [Fact]
    public void Rfc6070_C1_Matches()
    {
        var salt = System.Text.Encoding.ASCII.GetBytes("salt");
        var dk = PasswordHasher.Pbkdf2Sha1("password", salt, 1, 20);
        Assert.Equal("0c60c80f961f0e71f3a9b524af6012062fe037a6", PasswordHasher.ToHex(dk));
    }

    [Fact]
    public void Rfc6070_C2_Matches()
    {
        var salt = System.Text.Encoding.ASCII.GetBytes("salt");
        var dk = PasswordHasher.Pbkdf2Sha1("password", salt, 2, 20);
        Assert.Equal("ea6c014dc72d6f8ccd1ed92ace1d41f0d8de8957", PasswordHasher.ToHex(dk));
    }

    [Fact]
    public void Hash_DoesNotStorePlaintext()
    {
        var stored = PasswordHasher.Hash("Secret9x");
        Assert.True(PasswordHasher.IsHash(stored));
        Assert.DoesNotContain("Secret9x", stored);
        Assert.True(PasswordHasher.Verify("Secret9x", stored));
        Assert.False(PasswordHasher.Verify("wrong", stored));
    }

    [Fact]
    public void Verify_AcceptsLegacyPlaintext()
    {
        Assert.True(PasswordHasher.Verify("oldPw", "oldPw"));
        Assert.False(PasswordHasher.Verify("oldPw", "other"));
    }

    [Fact]
    public void UpgradeIfPlain_HashesLegacyOnSuccess()
    {
        var up = PasswordHasher.UpgradeIfPlain("oldplain", "oldplain");
        Assert.True(PasswordHasher.IsHash(up));
        Assert.True(PasswordHasher.Verify("oldplain", up));
        var hashed = PasswordHasher.Hash("keep");
        Assert.Equal(hashed, PasswordHasher.UpgradeIfPlain("keep", hashed));
    }
}
