using System.Text.Json;
using Sirman.Core.Infrastructure;
using Sirman.Core.Security;
using Sirman.Core.Validation;

namespace Sirman.Core.Application;

/// <summary>
/// نمای واحد برای Host Object — منطق کسب‌وکار انبار/گارانتی اینجا نیست.
/// </summary>
public sealed class SecurityFacade
{
    private readonly object _gate = new();
    private readonly AuthenticationService _authn = new();
    private readonly AuthorizationService _authz = new();
    private readonly HostSecurityGate _hostGate = new();
    private readonly EntityValidator _validator = new();
    private readonly SecretStore _secrets = new();
    private AuthSession _session = AuthSession.Anonymous();

    public AuthSession Session
    {
        get { lock (_gate) return _session; }
    }

    public string Login(string json)
    {
        try
        {
            var req = _authn.Parse(json);
            if (req is null) return SafeError.Json("invalid-json", "درخواست ورود نامعتبر است");
            var result = _authn.Login(req);
            if (!result.Ok)
            {
                lock (_gate) _session = AuthSession.Unauthenticated(true);
                return JsonSerializer.Serialize(new
                {
                    ok = false,
                    error = result.Reason,
                    message = result.Reason == "inactive" ? "این حساب غیرفعال است" : "نام کاربری یا رمز نادرست است",
                    kind = result.Kind
                });
            }

            AuthSession next;
            if (result.Kind == "master" || result.Kind == "open")
            {
                next = new AuthSession
                {
                    Authenticated = true,
                    IsMaster = true,
                    PasswordConfigured = result.Kind != "open",
                    UserId = "admin",
                    Username = "مدیر سیستم",
                    RoleKey = "admin",
                    Pages = Array.Empty<string>()
                };
            }
            else
            {
                var u = result.User!;
                next = new AuthSession
                {
                    Authenticated = true,
                    IsMaster = false,
                    PasswordConfigured = true,
                    UserId = u.Id,
                    Username = string.IsNullOrWhiteSpace(u.Username) ? u.Name : u.Username,
                    RoleKey = u.RoleKey,
                    Pages = u.Pages.ToArray()
                };
            }
            lock (_gate) _session = next;
            return JsonSerializer.Serialize(new
            {
                ok = true,
                kind = result.Kind,
                userId = next.UserId,
                username = next.Username,
                roleKey = next.RoleKey,
                upgradedMasterHash = result.UpgradedMasterHash,
                upgradedUserHash = result.UpgradedUserHash
            });
        }
        catch (Exception ex)
        {
            return SafeError.Json("login-failed", "ورود انجام نشد", ex);
        }
    }

    public string Logout()
    {
        lock (_gate)
        {
            var hadPw = _session.PasswordConfigured || _session.Authenticated;
            _session = AuthSession.Unauthenticated(hadPw);
        }
        return "{\"ok\":true}";
    }

    public string BindSession(string json)
    {
        try
        {
            using var doc = JsonDocument.Parse(string.IsNullOrWhiteSpace(json) ? "{}" : json);
            var root = doc.RootElement;
            var pages = new List<string>();
            if (root.TryGetProperty("pages", out var p) && p.ValueKind == JsonValueKind.Array)
            {
                foreach (var x in p.EnumerateArray())
                    if (x.ValueKind == JsonValueKind.String) pages.Add(x.GetString() ?? "");
            }
            var next = new AuthSession
            {
                Authenticated = ReadBool(root, "authenticated", true),
                IsMaster = ReadBool(root, "isMaster", false),
                PasswordConfigured = ReadBool(root, "passwordConfigured", true),
                UserId = ReadStr(root, "userId"),
                Username = ReadStr(root, "username"),
                RoleKey = ReadStr(root, "roleKey"),
                Pages = pages
            };
            lock (_gate) _session = next;
            return "{\"ok\":true}";
        }
        catch (Exception ex)
        {
            return SafeError.Json("bind-failed", "نشست ثبت نشد", ex);
        }
    }

    public string CheckPermission(string permission)
    {
        var ok = _authz.Allows(Session, permission);
        return JsonSerializer.Serialize(new
        {
            ok,
            permission,
            message = ok ? "مجاز" : "این نقش اجازه این کار را ندارد"
        });
    }

    public string AuthorizeHostMethod(string method) => _hostGate.Authorize(Session, method).ToJson();

    public bool IsHostMethodAllowed(string method) => _hostGate.Authorize(Session, method).Ok;

    public string HashPassword(string plain)
    {
        try { return PasswordHasher.Hash(plain ?? ""); }
        catch (Exception ex) { return SafeError.Json("hash-failed", "هش ساخته نشد", ex); }
    }

    public bool VerifyPassword(string plain, string stored) => PasswordHasher.Verify(plain, stored);

    public string ValidateEntity(string entity, string json) => _validator.Validate(entity, json).ToJson();

    public string GetSecurityStatus()
    {
        var s = Session;
        return JsonSerializer.Serialize(new
        {
            ok = true,
            authenticated = s.Authenticated,
            isMaster = s.IsMaster,
            passwordConfigured = s.PasswordConfigured,
            userId = s.UserId,
            username = s.Username,
            roleKey = s.RoleKey,
            pages = s.Pages,
            core = "Sirman.Core"
        });
    }

    private static bool ReadBool(JsonElement root, string name, bool fallback)
    {
        if (!root.TryGetProperty(name, out var v)) return fallback;
        return v.ValueKind == JsonValueKind.True
            || (v.ValueKind == JsonValueKind.String && (v.GetString() == "1" || string.Equals(v.GetString(), "true", StringComparison.OrdinalIgnoreCase)));
    }

    private static string ReadStr(JsonElement root, string name) =>
        root.TryGetProperty(name, out var v) && v.ValueKind == JsonValueKind.String ? (v.GetString() ?? "") : "";

    public string SaveSecret(string name, string value) => _secrets.Save(name, value);
    public string LoadSecret(string name) => _secrets.Load(name);
}
