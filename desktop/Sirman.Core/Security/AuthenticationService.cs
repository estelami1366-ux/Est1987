using System.Text.Json;

namespace Sirman.Core.Security;

public sealed class LoginRequest
{
    public string Username { get; set; } = "";
    public string Password { get; set; } = "";
    public string? MasterHash { get; set; }
    public List<LoginUser> Users { get; set; } = new();
}

public sealed class LoginUser
{
    public string Id { get; set; } = "";
    public string Name { get; set; } = "";
    public string Username { get; set; } = "";
    public string Pw { get; set; } = "";
    public bool Active { get; set; } = true;
    public string RoleKey { get; set; } = "";
    public List<string> Pages { get; set; } = new();
}

public sealed class LoginResult
{
    public bool Ok { get; init; }
    public string Reason { get; init; } = "";
    public string Kind { get; init; } = "";
    public LoginUser? User { get; init; }
    public string? UpgradedMasterHash { get; init; }
    public string? UpgradedUserHash { get; init; }
}

public sealed class AuthenticationService
{
    public LoginResult Login(LoginRequest req)
    {
        req ??= new LoginRequest();
        var username = (req.Username ?? "").Trim();
        var password = req.Password ?? "";
        var users = req.Users ?? new List<LoginUser>();

        if (!string.IsNullOrEmpty(username))
        {
            var u = users.FirstOrDefault(r =>
                string.Equals((r.Username ?? r.Name ?? "").Trim(), username, StringComparison.Ordinal));
            if (u is null || !PasswordHasher.Verify(password, u.Pw))
                return Fail("bad_credentials");
            if (!u.Active) return Fail("inactive", u);
            return OkNamed(u, password);
        }

        var inactive = users.FirstOrDefault(r => PasswordHasher.Verify(password, r.Pw) && !r.Active);
        if (inactive is not null) return Fail("inactive", inactive);

        var matched = users.FirstOrDefault(r => PasswordHasher.Verify(password, r.Pw) && r.Active);
        if (matched is not null) return OkNamed(matched, password);

        if (!string.IsNullOrEmpty(req.MasterHash) && PasswordHasher.Verify(password, req.MasterHash))
        {
            var upgraded = PasswordHasher.IsHash(req.MasterHash) ? null : PasswordHasher.UpgradeIfPlain(password, req.MasterHash);
            return new LoginResult { Ok = true, Kind = "master", UpgradedMasterHash = upgraded };
        }

        if (string.IsNullOrEmpty(req.MasterHash) && users.Count == 0)
            return new LoginResult { Ok = true, Kind = "open" };

        return Fail("bad_credentials");
    }

    public LoginRequest? Parse(string json)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(json)) return new LoginRequest();
            return JsonSerializer.Deserialize<LoginRequest>(json, JsonOpts());
        }
        catch
        {
            return null;
        }
    }

    private static LoginResult Fail(string reason, LoginUser? user = null) =>
        new() { Ok = false, Reason = reason, User = user };

    private static LoginResult OkNamed(LoginUser u, string password)
    {
        var upgraded = PasswordHasher.IsHash(u.Pw) ? null : PasswordHasher.UpgradeIfPlain(password, u.Pw);
        return new LoginResult { Ok = true, Kind = "named", User = u, UpgradedUserHash = upgraded };
    }

    internal static JsonSerializerOptions JsonOpts() => new()
    {
        PropertyNameCaseInsensitive = true
    };
}
