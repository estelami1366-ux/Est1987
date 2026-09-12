using System.Text;
using System.Text.Json;
using Sirman.Core.Updates;
using Xunit;

namespace Sirman.Core.Tests;

public class NativeUpdateP11Tests
{
    static NativeUpdateIdentity Id => new()
    {
        Id = "sirman-native-test-p11",
        Version = "1405.6.16α",
        Assembly = "1405.6.16.1",
        MinAssembly = "1405.6.16.1",
        MaxAssembly = "1405.6.16.1"
    };

    const string HtmlMarker = "UNIQUE-HTML-MARKER-P11-RUNTIME";

    static string SelfContainedRuntimeConfig => """
        {
          "runtimeOptions": {
            "tfm": "net8.0",
            "includedFrameworks": [
              { "name": "Microsoft.NETCore.App", "version": "8.0.31" },
              { "name": "Microsoft.WindowsDesktop.App", "version": "8.0.31" }
            ]
          }
        }
        """;

    static string FrameworkDependentRuntimeConfig => """
        {
          "runtimeOptions": {
            "tfm": "net8.0",
            "frameworks": [
              { "name": "Microsoft.NETCore.App", "version": "8.0.31" },
              { "name": "Microsoft.WindowsDesktop.App", "version": "8.0.31" }
            ]
          }
        }
        """;

    [Fact]
    public void Assemble_SelfContainedPublish_IncludesRuntimeAndSkipsHtml()
    {
        using var tmp = new TempPkg();
        PlantApp(tmp.Source, selfContained: true, includeRuntime: true);
        File.WriteAllText(Path.Combine(tmp.Source, "Sirman_Final.html"), "<!DOCTYPE html>" + HtmlMarker);

        var assembled = NativeUpdateAssembler.Create(tmp.Source, tmp.Output, Id);
        Assert.True(assembled.Ok, assembled.Message);
        Assert.Contains(assembled.SkippedHtml, s => s.Contains("Sirman_Final.html", StringComparison.OrdinalIgnoreCase));
        Assert.Contains(assembled.Manifest!.Files, f => f.Path == "hostfxr.dll");
        Assert.Contains(assembled.Manifest.Files, f => f.Path == "coreclr.dll");
        Assert.Contains(assembled.Manifest.Files, f => f.Path == "System.Windows.Forms.dll");
        Assert.Contains(assembled.Manifest.Files, f => f.Path == "WindowsBase.dll");
        Assert.DoesNotContain(assembled.Manifest.Files, f => NativeUpdateAllowList.IsForbiddenHtml(f.Path));
        Assert.False(File.Exists(Path.Combine(tmp.Output, "files", "Sirman_Final.html")));

        var validated = NativeUpdateValidator.ValidatePackage(tmp.Output);
        Assert.True(validated.Ok, validated.Message);
    }

    [Fact]
    public void Assemble_SelfContainedConfigWithoutHostfxr_FailsClosed()
    {
        using var tmp = new TempPkg();
        PlantApp(tmp.Source, selfContained: true, includeRuntime: false);
        var assembled = NativeUpdateAssembler.Create(tmp.Source, tmp.Output, Id);
        Assert.False(assembled.Ok);
        Assert.Equal("native-runtime-incomplete", assembled.Error);
    }

    [Fact]
    public void Validate_FrameworkDependentRuntimeConfig_FailsClosed()
    {
        using var tmp = new TempPkg();
        PlantApp(tmp.Source, selfContained: false, includeRuntime: true);
        File.WriteAllText(Path.Combine(tmp.Source, "Sirman.runtimeconfig.json"), FrameworkDependentRuntimeConfig);
        var assembled = NativeUpdateAssembler.Create(tmp.Source, tmp.Output, Id);
        Assert.False(assembled.Ok);
        Assert.Equal("native-runtime-framework-dependent", assembled.Error);

        var fdd = Path.Combine(tmp.Root, "fdd-pkg");
        Directory.CreateDirectory(Path.Combine(fdd, "files"));
        File.WriteAllBytes(Path.Combine(fdd, "files", "Sirman.exe"), Encoding.UTF8.GetBytes("exe"));
        File.WriteAllText(Path.Combine(fdd, "files", "Sirman.runtimeconfig.json"), FrameworkDependentRuntimeConfig);
        var manifest = new NativeUpdateManifest
        {
            Id = "x",
            Version = "1405.6.16α",
            Assembly = "1405.6.16.1",
            Files =
            {
                Entry(fdd, "Sirman.exe"),
                Entry(fdd, "Sirman.runtimeconfig.json")
            }
        };
        File.WriteAllText(Path.Combine(fdd, "manifest.json"),
            JsonSerializer.Serialize(manifest, NativeUpdateJson.Options));
        var validated = NativeUpdateValidator.ValidatePackage(fdd);
        Assert.False(validated.Ok);
        Assert.Equal("native-runtime-framework-dependent", validated.Error);
    }

    [Fact]
    public void Apply_SelfContainedPayload_CopiesRuntimeAndLeavesHtml()
    {
        using var tmp = new TempPkg();
        var install = Path.Combine(tmp.Root, "install");
        var data = Path.Combine(tmp.Root, "data");
        Directory.CreateDirectory(install);
        Directory.CreateDirectory(data);
        File.WriteAllBytes(Path.Combine(install, "Sirman.exe"), Encoding.UTF8.GetBytes("old-exe"));
        File.WriteAllText(Path.Combine(install, "Sirman_Final.html"), "<!DOCTYPE html>" + HtmlMarker);
        File.WriteAllText(Path.Combine(install, "shop.sqlite"), "sqlite-stay");

        PlantApp(tmp.Source, selfContained: true, includeRuntime: true);
        Assert.True(NativeUpdateAssembler.Create(tmp.Source, tmp.Output, Id).Ok);

        var result = NativeUpdateApplier.Apply(new NativeUpdateApplyRequest
        {
            PackageDirectory = tmp.Output,
            InstallDirectory = install,
            DataRoot = data,
            Processes = new RecordingProcessCoordinator()
        });
        Assert.True(result.Ok, result.Message);
        Assert.Equal(NativeUpdateJournalState.Verified, result.State);
        Assert.True(File.Exists(Path.Combine(install, "hostfxr.dll")));
        Assert.True(File.Exists(Path.Combine(install, "coreclr.dll")));
        Assert.True(File.Exists(Path.Combine(install, "System.Windows.Forms.dll")));
        Assert.Equal("<!DOCTYPE html>" + HtmlMarker, File.ReadAllText(Path.Combine(install, "Sirman_Final.html")));
        Assert.Equal("sqlite-stay", File.ReadAllText(Path.Combine(install, "shop.sqlite")));
    }

    [Fact]
    public void AccessibilityDll_IsAllowListed()
    {
        Assert.True(NativeUpdateAllowList.IsAllowedNative("Accessibility.dll"));
        Assert.True(NativeUpdateAllowList.IsAllowedNative("hostfxr.dll"));
        Assert.True(NativeUpdateAllowList.IsPackagingExcluded("createdump.exe"));
        Assert.False(NativeUpdateAllowList.IsAllowedNative("Sirman_Final.html"));
    }

    static NativeUpdateFileEntry Entry(string package, string name)
    {
        var full = Path.Combine(package, "files", name);
        return new NativeUpdateFileEntry
        {
            Path = name,
            Sha256 = NativeUpdateHasher.Sha256File(full),
            Bytes = new FileInfo(full).Length
        };
    }

    static void PlantApp(string source, bool selfContained, bool includeRuntime)
    {
        Directory.CreateDirectory(source);
        File.WriteAllBytes(Path.Combine(source, "Sirman.exe"), Encoding.UTF8.GetBytes("sc-exe-p11"));
        File.WriteAllBytes(Path.Combine(source, "Sirman.dll"), Encoding.UTF8.GetBytes("sc-dll-p11"));
        File.WriteAllBytes(Path.Combine(source, "Sirman.Core.dll"), Encoding.UTF8.GetBytes("sc-core-p11"));
        File.WriteAllText(Path.Combine(source, "SIRMAN_VERSION.json"), """{"app":"1405.6.16α","assembly":"1405.6.16.1"}""");
        File.WriteAllText(Path.Combine(source, "Sirman.runtimeconfig.json"),
            selfContained ? SelfContainedRuntimeConfig : FrameworkDependentRuntimeConfig);
        if (!includeRuntime) return;
        foreach (var name in NativeUpdateRuntimeIndependence.RequiredSelfContainedFiles)
            File.WriteAllBytes(Path.Combine(source, name), Encoding.UTF8.GetBytes("stub-" + name));
    }

    sealed class TempPkg : IDisposable
    {
        public string Root { get; } = Path.Combine(Path.GetTempPath(), "sirman-native-p11-" + Guid.NewGuid().ToString("N"));
        public string Source => Path.Combine(Root, "src");
        public string Output => Path.Combine(Root, "out");

        public TempPkg()
        {
            Directory.CreateDirectory(Source);
            Directory.CreateDirectory(Output);
        }

        public void Dispose()
        {
            try { Directory.Delete(Root, true); } catch { /* ignore */ }
        }
    }
}
