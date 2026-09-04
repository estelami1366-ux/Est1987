using System.Text.Json;
using Sirman.Core.Application;
using Sirman.Core.Security;
using Xunit;

namespace Sirman.Core.Tests;

public class AuthorizationTests
{
    [Fact]
    public void Master_AllowsAll()
    {
        var az = new AuthorizationService();
        var s = new AuthSession { Authenticated = true, IsMaster = true, PasswordConfigured = true, RoleKey = "admin" };
        Assert.True(az.Allows(s, "User.Delete"));
        Assert.True(az.Allows(s, "Invoice.Create"));
    }

    [Fact]
    public void Technician_CanEditServiceCase_NotUsers()
    {
        var az = new AuthorizationService();
        var s = new AuthSession
        {
            Authenticated = true,
            RoleKey = "service",
            PasswordConfigured = true,
            Pages = new[] { "dashboard", "warranty", "parts", "phonebook" }
        };
        Assert.True(az.Allows(s, "ServiceCase.Edit"));
        Assert.True(az.Allows(s, "Customer.View"));
        Assert.False(az.Allows(s, "User.Create"));
        Assert.False(az.Allows(s, "Invoice.Create"));
    }

    [Fact]
    public void Viewer_DeniedInvoiceCreate()
    {
        var az = new AuthorizationService();
        var s = new AuthSession
        {
            Authenticated = true,
            RoleKey = "viewer",
            PasswordConfigured = true,
            Pages = new[] { "dashboard", "saved", "warranty", "help" }
        };
        Assert.True(az.Allows(s, "Invoice.View"));
        Assert.False(az.Allows(s, "Invoice.Create"));
    }

    [Fact]
    public void UnauthenticatedWithPassword_DeniedSensitiveHost()
    {
        var gate = new HostSecurityGate();
        var s = AuthSession.Unauthenticated(true);
        var r = gate.Authorize(s, "SetNetworkConfig");
        Assert.False(r.Ok);
        Assert.Equal("forbidden", r.Error);
    }

    [Fact]
    public void UnauthenticatedWithPassword_AllowsBackupAndClose()
    {
        var gate = new HostSecurityGate();
        var s = AuthSession.Unauthenticated(true);
        Assert.True(gate.Authorize(s, "WriteBackupText").Ok);
        Assert.True(gate.Authorize(s, "FinalizeBackup").Ok);
        Assert.True(gate.Authorize(s, "CloseApp").Ok);
        Assert.True(gate.Authorize(s, "Ping").Ok);
        Assert.True(gate.Authorize(s, "SaveAppPref").Ok);
    }

    [Fact]
    public void UnauthenticatedWithPassword_DeniedPrintHtml()
    {
        var gate = new HostSecurityGate();
        var s = AuthSession.Unauthenticated(true);
        var r = gate.Authorize(s, "PrintHtml");
        Assert.False(r.Ok);
        Assert.Equal("forbidden", r.Error);
    }

    [Fact]
    public void AnonymousNoPassword_AllowsNetworkLikeToday()
    {
        var gate = new HostSecurityGate();
        Assert.True(gate.Authorize(AuthSession.Anonymous(), "SetNetworkConfig").Ok);
    }

    [Fact]
    public void Facade_UnauthorizedHostOperation()
    {
        var f = new SecurityFacade();
        f.BindSession("{\"authenticated\":false,\"passwordConfigured\":true,\"isMaster\":false}");
        var json = JsonDocument.Parse(f.AuthorizeHostMethod("WriteWorkspaceFile")).RootElement;
        Assert.False(json.GetProperty("ok").GetBoolean());
        Assert.Equal("forbidden", json.GetProperty("error").GetString());
    }

    [Fact]
    public void Facade_PermissionAllowedAfterBind()
    {
        var f = new SecurityFacade();
        f.BindSession("{\"authenticated\":true,\"isMaster\":false,\"passwordConfigured\":true,\"roleKey\":\"service\",\"pages\":[\"warranty\"]}");
        var json = JsonDocument.Parse(f.CheckPermission("ServiceCase.Close")).RootElement;
        Assert.True(json.GetProperty("ok").GetBoolean());
        var denied = JsonDocument.Parse(f.CheckPermission("User.Delete")).RootElement;
        Assert.False(denied.GetProperty("ok").GetBoolean());
    }
}
