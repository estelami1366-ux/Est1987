namespace Sirman.Core.Security;

public sealed class AuthSession
{
    public bool Authenticated { get; init; }
    public bool IsMaster { get; init; }
    public bool PasswordConfigured { get; init; }
    public string UserId { get; init; } = "";
    public string Username { get; init; } = "";
    public string RoleKey { get; init; } = "";
    public IReadOnlyList<string> Pages { get; init; } = Array.Empty<string>();
    public DateTimeOffset BoundAt { get; init; } = DateTimeOffset.UtcNow;

    public static AuthSession Anonymous() => new()
    {
        Authenticated = false,
        IsMaster = false,
        PasswordConfigured = false
    };

    public static AuthSession Unauthenticated(bool passwordConfigured) => new()
    {
        Authenticated = false,
        PasswordConfigured = passwordConfigured
    };
}
