using Sirman.Core.Security;

namespace Sirman.Core.Data.Repositories;

public sealed class JsonUserRepository : IUserRepository
{
    private readonly Dictionary<string, LoginUser> _byUsername = new(StringComparer.Ordinal);

    public JsonUserRepository(CurrentJsonStore store)
    {
        ArgumentNullException.ThrowIfNull(store);
    }

    public LoginUser? GetByUsername(string username)
    {
        var key = (username ?? "").Trim();
        if (key.Length == 0) return null;
        if (_byUsername.TryGetValue(key, out var u)) return Clone(u);
        return _byUsername.Values.FirstOrDefault(r =>
            string.Equals((r.Username ?? r.Name ?? "").Trim(), key, StringComparison.Ordinal)) is { } hit
            ? Clone(hit)
            : null;
    }

    public IReadOnlyList<LoginUser> GetAll() => _byUsername.Values.Select(Clone).ToList();

    public void Save(LoginUser user)
    {
        if (user is null) return;
        var key = (user.Username ?? user.Name ?? "").Trim();
        if (key.Length == 0) return;
        _byUsername[key] = Clone(user);
    }

    private static LoginUser Clone(LoginUser u) => new()
    {
        Id = u.Id,
        Name = u.Name,
        Username = u.Username,
        Pw = u.Pw,
        Active = u.Active,
        RoleKey = u.RoleKey,
        Pages = u.Pages is null ? new List<string>() : new List<string>(u.Pages)
    };
}
