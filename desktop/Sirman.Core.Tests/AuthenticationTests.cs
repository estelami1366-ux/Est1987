using System.Text.Json;
using Sirman.Core.Application;
using Sirman.Core.Security;
using Xunit;

namespace Sirman.Core.Tests;

public class AuthenticationTests
{
    private static LoginRequest Sample() => new()
    {
        MasterHash = "master",
        Users =
        {
            new LoginUser { Id = "u1", Name = "علی", Username = "ali", Pw = "p1", Active = false, RoleKey = "operator", Pages = { "dashboard" } },
            new LoginUser { Id = "u2", Name = "مینا", Username = "mina", Pw = PasswordHasher.Hash("p2"), Active = true, RoleKey = "service", Pages = { "warranty" } }
        }
    };

    [Fact]
    public void Login_NamedHashedUser_Succeeds()
    {
        var r = new AuthenticationService().Login(new LoginRequest
        {
            Username = "mina",
            Password = "p2",
            Users = Sample().Users
        });
        Assert.True(r.Ok);
        Assert.Equal("named", r.Kind);
        Assert.Equal("u2", r.User!.Id);
    }

    [Fact]
    public void Login_WrongPassword_Fails()
    {
        var r = new AuthenticationService().Login(new LoginRequest
        {
            Username = "mina",
            Password = "nope",
            Users = Sample().Users,
            MasterHash = "master"
        });
        Assert.False(r.Ok);
        Assert.Equal("bad_credentials", r.Reason);
    }

    [Fact]
    public void Login_Inactive_Fails()
    {
        var r = new AuthenticationService().Login(new LoginRequest
        {
            Username = "ali",
            Password = "p1",
            Users = Sample().Users
        });
        Assert.False(r.Ok);
        Assert.Equal("inactive", r.Reason);
    }

    [Fact]
    public void Login_MasterLegacy_Upgrades()
    {
        var r = new AuthenticationService().Login(new LoginRequest
        {
            Password = "master",
            MasterHash = "master",
            Users = Sample().Users
        });
        Assert.True(r.Ok);
        Assert.Equal("master", r.Kind);
        Assert.True(PasswordHasher.IsHash(r.UpgradedMasterHash));
    }

    [Fact]
    public void Facade_LoginThenWrongPasswordDoesNotKeepSession()
    {
        var f = new SecurityFacade();
        var users = JsonSerializer.Serialize(new
        {
            username = "mina",
            password = "p2",
            users = new[] { new { id = "u2", username = "mina", pw = PasswordHasher.Hash("p2"), active = true, roleKey = "service", pages = new[] { "warranty" } } }
        });
        var ok = JsonDocument.Parse(f.Login(users)).RootElement;
        Assert.True(ok.GetProperty("ok").GetBoolean());
        var bad = JsonDocument.Parse(f.Login("{\"username\":\"mina\",\"password\":\"nope\",\"users\":[]}")).RootElement;
        Assert.False(bad.GetProperty("ok").GetBoolean());
        Assert.False(JsonDocument.Parse(f.GetSecurityStatus()).RootElement.GetProperty("authenticated").GetBoolean());
    }
}
