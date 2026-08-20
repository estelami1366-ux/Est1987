namespace Sirman.Core.Security;

public sealed class AuthorizationService
{
    public bool Allows(AuthSession session, string permission)
    {
        if (string.IsNullOrWhiteSpace(permission)) return false;
        if (session.IsMaster) return true;
        if (!session.Authenticated)
            return !session.PasswordConfigured;
        if (string.Equals(session.RoleKey, "admin", StringComparison.OrdinalIgnoreCase)
            || string.Equals(session.RoleKey, "manager", StringComparison.OrdinalIgnoreCase))
            return true;
        var page = PermissionCatalog.PageFor(permission);
        if (page is null) return false;
        return session.Pages.Any(p => string.Equals(p, page, StringComparison.OrdinalIgnoreCase));
    }

    public bool AllowsHostMethod(AuthSession session, string method)
    {
        if (PermissionCatalog.AlwaysAllowedHostMethods.Contains(method)) return true;
        var perm = PermissionCatalog.PermissionForHostMethod(method);
        if (perm is null) return session.Authenticated || !session.PasswordConfigured;
        return Allows(session, perm);
    }
}
