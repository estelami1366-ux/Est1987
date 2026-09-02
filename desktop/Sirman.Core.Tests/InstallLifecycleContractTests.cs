using System.Text.Json;
using Xunit;

namespace Sirman.Core.Tests;

public class InstallLifecycleContractTests
{
    private static string RepoRoot()
    {
        var dir = new DirectoryInfo(AppContext.BaseDirectory);
        while (dir != null)
        {
            if (File.Exists(Path.Combine(dir.FullName, "Sirman_Final.html")))
                return dir.FullName;
            dir = dir.Parent;
        }
        throw new DirectoryNotFoundException("repo root with Sirman_Final.html not found");
    }

    private static string Read(params string[] parts) =>
        File.ReadAllText(Path.Combine(new[] { RepoRoot() }.Concat(parts).ToArray()));

    private static JsonElement Contract()
    {
        var json = Read("scripts", "setup-kit", "sirman-install-contract.json");
        return JsonDocument.Parse(json).RootElement;
    }

    [Fact]
    public void Contract_CanonicalStartMenuAndShortcuts()
    {
        var c = Contract().GetProperty("canonical");
        Assert.Equal("Sirman", c.GetProperty("startMenuFolderName").GetString());
        Assert.Equal("SIRMAN.lnk", c.GetProperty("startMenuLaunchShortcut").GetString());
        Assert.Equal("Uninstall SIRMAN.lnk", c.GetProperty("startMenuUninstallShortcut").GetString());
        Assert.Equal("SIRMAN Full Cleanup.lnk", c.GetProperty("startMenuFullCleanupShortcut").GetString());
        Assert.Equal("Sirman.lnk", c.GetProperty("desktopShortcut").GetString());
        Assert.Equal("install-location.txt", c.GetProperty("installLocationFileName").GetString());
        Assert.Equal("تایید", c.GetProperty("level2ConfirmationWord").GetString());
    }

    [Fact]
    public void UninstallBat_IsLevel1Only_DoesNotWipeAppData()
    {
        var bat = Read("desktop", "Uninstall-Sirman.bat");
        Assert.Contains("-Mode Level1", bat, StringComparison.Ordinal);
        Assert.DoesNotContain("-Mode Level2", bat, StringComparison.Ordinal);
        Assert.DoesNotContain("rd /s /q \"%APP_ROOT%\"", bat, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("rd /s /q \"%LOCALAPPDATA%\\Sirman\"", bat, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("rd /s /q \"%APPDATA%\\Sirman\"", bat, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("set \"INSTALL_DIR=%SAVED%\"", bat, StringComparison.Ordinal);
        Assert.Contains("Uninstall-Sirman.ps1", bat, StringComparison.Ordinal);
    }

    [Fact]
    public void FullCleanupBat_RequiresSeparateLevel2Engine()
    {
        var bat = Read("desktop", "Sirman-Full-Cleanup.bat");
        Assert.Contains("-Mode Level2", bat, StringComparison.Ordinal);
        Assert.Contains("تایید", bat, StringComparison.Ordinal);
        Assert.Contains("NOT normal uninstall", bat, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void Lifecycle_DoesNotSilentlyRetargetInstallDir()
    {
        var life = Read("scripts", "setup-kit", "Sirman-InstallLifecycle.ps1");
        Assert.Contains("Resolve-SirmanLevel1Target", life, StringComparison.Ordinal);
        Assert.Contains("OtherDetectedDir", life, StringComparison.Ordinal);
        Assert.Contains("SilentRedirect = $false", life, StringComparison.Ordinal);
        Assert.Contains("Aborted. Nothing deleted.", life, StringComparison.Ordinal);
        Assert.Contains("Test-SirmanLevel2Confirmation", life, StringComparison.Ordinal);
        Assert.Contains("WebView2", life, StringComparison.Ordinal);
        Assert.DoesNotContain("rd /s /q", life, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void InstallService_UsesCanonicalEnglishStartMenu()
    {
        var cs = Read("desktop", "Sirman.Desktop", "InstallService.cs");
        Assert.Contains("CanonicalStartMenuFolderName = \"Sirman\"", cs, StringComparison.Ordinal);
        Assert.Contains("CanonicalLaunchShortcutName = \"SIRMAN.lnk\"", cs, StringComparison.Ordinal);
        Assert.Contains("CanonicalUninstallShortcutName = \"Uninstall SIRMAN.lnk\"", cs, StringComparison.Ordinal);
        Assert.DoesNotContain("var folder = Path.Combine(programs, \"سیرمان\")", cs, StringComparison.Ordinal);
        Assert.Contains("RemoveLegacyShortcuts", cs, StringComparison.Ordinal);
        Assert.Contains("PruneStaleOwnedFiles", cs, StringComparison.Ordinal);
        Assert.DoesNotContain("rd /s /q \"%APP_ROOT%\"", cs, StringComparison.Ordinal);
    }

    [Fact]
    public void ActiveShortcutCreators_ShareCanonicalNames()
    {
        var files = new[]
        {
            Read("scripts", "setup-kit", "install-setup.ps1"),
            Read("Sirman_Install_Shortcuts.ps1"),
            Read("desktop", "install-package.ps1"),
            Read("desktop", "Sirman.Desktop", "InstallService.cs")
        };
        foreach (var src in files)
        {
            Assert.Contains("SIRMAN.lnk", src, StringComparison.Ordinal);
            Assert.Contains("Uninstall SIRMAN.lnk", src, StringComparison.Ordinal);
        }
    }
}
