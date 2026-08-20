using System.Text.Json;

namespace Sirman.Core.Security;

public sealed class HostAuthorizeResult
{
    public bool Ok { get; init; }
    public string Error { get; init; } = "";
    public string Message { get; init; } = "";
    public string Method { get; init; } = "";

    public string ToJson() => JsonSerializer.Serialize(new
    {
        ok = Ok,
        error = string.IsNullOrEmpty(Error) ? null : Error,
        message = Message,
        method = Method
    });
}

public sealed class HostSecurityGate
{
    private readonly AuthorizationService _authz;

    public HostSecurityGate(AuthorizationService? authz = null)
    {
        _authz = authz ?? new AuthorizationService();
    }

    public HostAuthorizeResult Authorize(AuthSession session, string method)
    {
        method ??= "";
        session ??= AuthSession.Anonymous();
        if (_authz.AllowsHostMethod(session, method))
            return new HostAuthorizeResult { Ok = true, Method = method, Message = "مجاز" };

        var msg = session.PasswordConfigured && !session.Authenticated
            ? "برای این کار باید وارد شوید"
            : "این نقش اجازه این کار را ندارد";
        return new HostAuthorizeResult
        {
            Ok = false,
            Error = "forbidden",
            Message = msg,
            Method = method
        };
    }
}
