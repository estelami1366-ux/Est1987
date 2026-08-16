namespace Sirman.Core.Security;

/// <summary>
/// نگاشت مجوزهای نام‌دار به کلید صفحات موجود HTML — سیستم نقش موازی نیست.
/// </summary>
public static class PermissionCatalog
{
    public static readonly IReadOnlyDictionary<string, string> PermissionToPage =
        new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            ["Customer.View"] = "phonebook",
            ["Customer.Create"] = "phonebook",
            ["Customer.Edit"] = "phonebook",
            ["Customer.Delete"] = "phonebook",
            ["ServiceCase.View"] = "warranty",
            ["ServiceCase.Create"] = "warranty",
            ["ServiceCase.Edit"] = "warranty",
            ["ServiceCase.Close"] = "warranty",
            ["Inventory.View"] = "inventory",
            ["Inventory.Edit"] = "inventory",
            ["Invoice.View"] = "saved",
            ["Invoice.Create"] = "invoice",
            ["Invoice.Cancel"] = "saved",
            ["User.View"] = "settings",
            ["User.Create"] = "settings",
            ["User.Edit"] = "settings",
            ["User.Delete"] = "settings",
            ["Part.View"] = "parts",
            ["Part.Edit"] = "parts",
            ["Payment.View"] = "accounts",
            ["Payment.Create"] = "accounts",
            ["Network.Configure"] = "settings",
            ["Network.Publish"] = "settings",
            ["Network.Pull"] = "settings",
            ["Backup.Write"] = "dataio",
            ["Backup.Restore"] = "dataio",
            ["Print.Use"] = "settings",
            ["Config.Edit"] = "settings",
            ["Audit.View"] = "audit",
            ["Audit.Clear"] = "audit"
        };

    public static readonly IReadOnlyDictionary<string, string> HostMethodPermission =
        new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            ["SetNetworkConfig"] = "Network.Configure",
            ["WriteWorkspaceFile"] = "Network.Publish",
            ["ReadWorkspaceFile"] = "Network.Pull",
            ["PrintHtml"] = "Print.Use",
            ["PrintDocument"] = "Print.Use",
            ["GetPrintJob"] = "Print.Use"
        };

    /// <summary>متدهایی که بدون نشست هم باید کار کنند (خروج، بک‌آپ، سلامت).</summary>
    public static readonly HashSet<string> AlwaysAllowedHostMethods = new(StringComparer.OrdinalIgnoreCase)
    {
        "Ping", "CloseApp", "Notify", "GetNotifyPort", "GetBackupDir", "WriteBackupText",
        "LoadAppPref", "SaveAppPref", "GetWarrantyBrowseCatalog", "GetWarrantyBrowseCss", "ApplyUiSkin",
        "GetPrinters", "GetMachineInfo", "GetNetworkInfo",
        "Login", "Logout", "BindSession", "CheckPermission", "HashPassword", "VerifyPassword",
        "ValidateEntity", "GetSecurityStatus", "SaveSecret", "LoadSecret", "RunBusiness"
    };

    public static string? PageFor(string permission) =>
        PermissionToPage.TryGetValue(permission, out var page) ? page : null;

    public static string? PermissionForHostMethod(string method) =>
        HostMethodPermission.TryGetValue(method, out var perm) ? perm : null;
}
