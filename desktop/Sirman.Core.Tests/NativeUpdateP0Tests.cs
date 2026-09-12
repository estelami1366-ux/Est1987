using System.Diagnostics;
using System.Text;
using System.Text.Json;
using Sirman.Core.Updates;
using Xunit;

namespace Sirman.Core.Tests;

public class NativeUpdateP0Tests
{
    static NativeUpdateIdentity Id => new()
    {
        Id = "sirman-native-test-p0",
        Version = "1405.6.16α",
        Assembly = "1405.6.16.1",
        MinAssembly = "1405.6.16.1",
        MaxAssembly = "1405.6.16.1"
    };

    static string RepoRoot()
    {
        var dir = new DirectoryInfo(AppContext.BaseDirectory);
        while (dir != null)
        {
            if (File.Exists(Path.Combine(dir.FullName, "SIRMAN_VERSION.json")) &&
                File.Exists(Path.Combine(dir.FullName, "scripts", "assemble_sirman_native_update.py")))
                return dir.FullName;
            dir = dir.Parent;
        }
        throw new DirectoryNotFoundException("repo root not found");
    }

    [Fact]
    public void Parse_RoundtripsManifest()
    {
        var json = JsonSerializer.Serialize(new NativeUpdateManifest
        {
            Id = "x",
            Version = "1405.6.16α",
            Assembly = "1405.6.16.1",
            Files = { new NativeUpdateFileEntry { Path = "Sirman.dll", Sha256 = new string('a', 64), Bytes = 12 } }
        }, NativeUpdateJson.Options);
        var back = JsonSerializer.Deserialize<NativeUpdateManifest>(json, NativeUpdateJson.Options);
        Assert.NotNull(back);
        Assert.Equal(NativeUpdateMagic.Native, back!.Magic);
        Assert.Equal(1, back.Format);
        Assert.False(back.ReplacesHtml);
        Assert.Equal("native-only", back.PayloadKind);
    }

    [Fact]
    public void AssembleAndValidate_SucceedsWithoutHtml()
    {
        using var tmp = new TempPkg();
        PlantNative(tmp.Source);
        File.WriteAllText(Path.Combine(tmp.Source, "Sirman_Final.html"), "<!DOCTYPE html>UNIQUE-HTML-MARKER-P0");
        File.WriteAllText(Path.Combine(tmp.Source, "Laegh_Final.html"), "<!DOCTYPE html>LAEGH-MARKER");
        File.WriteAllText(Path.Combine(tmp.Source, "test_laegh.js"), "UNIQUE-JS-TEST-MARKER");

        var assembled = NativeUpdateAssembler.Create(tmp.Source, tmp.Output, Id);
        Assert.True(assembled.Ok, assembled.Message);
        Assert.Contains(assembled.SkippedHtml, s => s.Contains("Sirman_Final.html", StringComparison.OrdinalIgnoreCase));
        Assert.Contains(assembled.SkippedHtml, s => s.Contains("test_laegh.js", StringComparison.OrdinalIgnoreCase));

        var validated = NativeUpdateValidator.ValidatePackage(tmp.Output);
        Assert.True(validated.Ok, validated.Message);
        Assert.NotNull(validated.Manifest);
        Assert.All(validated.Manifest!.Files, f => Assert.False(NativeUpdateAllowList.IsForbiddenHtml(f.Path)));
        Assert.Contains(validated.Manifest.Files, f => f.Path == "Sirman.dll");
        Assert.Contains(validated.Manifest.Files, f => f.Path == "Sirman.Core.dll");
        Assert.Contains(validated.Manifest.Files, f => f.Path == "Sirman.exe");

        var tree = Directory.GetFiles(tmp.Output, "*", SearchOption.AllDirectories);
        Assert.DoesNotContain(tree, p => p.EndsWith(".html", StringComparison.OrdinalIgnoreCase));
        foreach (var file in tree)
        {
            var text = File.ReadAllText(file, Encoding.UTF8);
            Assert.DoesNotContain("UNIQUE-HTML-MARKER-P0", text, StringComparison.Ordinal);
            Assert.DoesNotContain("LAEGH-MARKER", text, StringComparison.Ordinal);
            Assert.DoesNotContain("UNIQUE-JS-TEST-MARKER", text, StringComparison.Ordinal);
        }
    }

    [Fact]
    public void Validate_HashMismatch_FailsClosed()
    {
        using var tmp = new TempPkg();
        PlantNative(tmp.Source);
        Assert.True(NativeUpdateAssembler.Create(tmp.Source, tmp.Output, Id).Ok);
        var victim = Path.Combine(tmp.Output, "files", "Sirman.dll");
        var original = File.ReadAllBytes(victim);
        original[0] ^= 0xFF;
        File.WriteAllBytes(victim, original);
        var result = NativeUpdateValidator.ValidatePackage(tmp.Output);
        Assert.False(result.Ok);
        Assert.Equal("native-hash-mismatch", result.Error);
    }

    [Fact]
    public void Validate_MissingFile_FailsClosed()
    {
        using var tmp = new TempPkg();
        PlantNative(tmp.Source);
        Assert.True(NativeUpdateAssembler.Create(tmp.Source, tmp.Output, Id).Ok);
        File.Delete(Path.Combine(tmp.Output, "files", "Sirman.exe"));
        var result = NativeUpdateValidator.ValidatePackage(tmp.Output);
        Assert.False(result.Ok);
        Assert.Equal("native-file-missing", result.Error);
    }

    [Fact]
    public void Validate_UnexpectedFile_FailsClosed()
    {
        using var tmp = new TempPkg();
        PlantNative(tmp.Source);
        Assert.True(NativeUpdateAssembler.Create(tmp.Source, tmp.Output, Id).Ok);
        File.WriteAllText(Path.Combine(tmp.Output, "files", "extra-unexpected.dll"), "nope");
        var result = NativeUpdateValidator.ValidatePackage(tmp.Output);
        Assert.False(result.Ok);
        Assert.Equal("native-file-unexpected", result.Error);
    }

    [Fact]
    public void Validate_HtmlInManifest_FailsClosed()
    {
        using var tmp = new TempPkg();
        PlantNative(tmp.Source);
        Assert.True(NativeUpdateAssembler.Create(tmp.Source, tmp.Output, Id).Ok);
        File.WriteAllText(Path.Combine(tmp.Output, "files", "Sirman_Final.html"), "<!DOCTYPE html>");
        var manifest = JsonSerializer.Deserialize<NativeUpdateManifest>(
            File.ReadAllText(Path.Combine(tmp.Output, "manifest.json")), NativeUpdateJson.Options)!;
        manifest.Files.Add(new NativeUpdateFileEntry
        {
            Path = "Sirman_Final.html",
            Sha256 = NativeUpdateHasher.Sha256File(Path.Combine(tmp.Output, "files", "Sirman_Final.html")),
            Bytes = new FileInfo(Path.Combine(tmp.Output, "files", "Sirman_Final.html")).Length
        });
        File.WriteAllText(Path.Combine(tmp.Output, "manifest.json"),
            JsonSerializer.Serialize(manifest, NativeUpdateJson.Options));
        var result = NativeUpdateValidator.ValidatePackage(tmp.Output);
        Assert.False(result.Ok);
        Assert.Equal("native-html-forbidden", result.Error);
    }

    [Fact]
    public void Validate_PathTraversalAndAbsolute_FailClosed()
    {
        var files = Path.Combine(Path.GetTempPath(), "sirman-native-empty-" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(files);
        try
        {
            var traversal = new NativeUpdateManifest
            {
                Id = "x",
                Version = "1405.6.16α",
                Assembly = "1405.6.16.1",
                Files = { new NativeUpdateFileEntry { Path = "../Sirman.dll", Sha256 = new string('a', 64), Bytes = 10 } }
            };
            var t = NativeUpdateValidator.ValidateManifestAndFiles(traversal, files);
            Assert.False(t.Ok);
            Assert.Equal("native-path-illegal", t.Error);

            var abs = new NativeUpdateManifest
            {
                Id = "x",
                Version = "1405.6.16α",
                Assembly = "1405.6.16.1",
                Files = { new NativeUpdateFileEntry { Path = "/tmp/Sirman.dll", Sha256 = new string('a', 64), Bytes = 10 } }
            };
            var a = NativeUpdateValidator.ValidateManifestAndFiles(abs, files);
            Assert.False(a.Ok);
            Assert.Equal("native-path-illegal", a.Error);
        }
        finally
        {
            Directory.Delete(files, true);
        }
    }

    [Fact]
    public void Validate_UnsupportedPayloadAndHtmlMagic_FailClosed()
    {
        using var tmp = new TempPkg();
        PlantNative(tmp.Source);
        Assert.True(NativeUpdateAssembler.Create(tmp.Source, tmp.Output, Id).Ok);
        var manifest = JsonSerializer.Deserialize<NativeUpdateManifest>(
            File.ReadAllText(Path.Combine(tmp.Output, "manifest.json")), NativeUpdateJson.Options)!;
        manifest.Files.Add(new NativeUpdateFileEntry
        {
            Path = "notes.txt",
            Sha256 = new string('b', 64),
            Bytes = 4
        });
        File.WriteAllText(Path.Combine(tmp.Output, "files", "notes.txt"), "note");
        File.WriteAllText(Path.Combine(tmp.Output, "manifest.json"),
            JsonSerializer.Serialize(manifest, NativeUpdateJson.Options));
        var unsupported = NativeUpdateValidator.ValidatePackage(tmp.Output);
        Assert.False(unsupported.Ok);
        Assert.Equal("native-file-unsupported", unsupported.Error);

        manifest.Files.RemoveAll(f => f.Path == "notes.txt");
        File.Delete(Path.Combine(tmp.Output, "files", "notes.txt"));
        manifest.Magic = NativeUpdateMagic.Html;
        File.WriteAllText(Path.Combine(tmp.Output, "manifest.json"),
            JsonSerializer.Serialize(manifest, NativeUpdateJson.Options));
        var htmlMagic = NativeUpdateValidator.ValidatePackage(tmp.Output);
        Assert.False(htmlMagic.Ok);
        Assert.Equal("native-magic", htmlMagic.Error);
    }

    [Fact]
    public void Validate_VersionMismatch_FailsClosed()
    {
        using var tmp = new TempPkg();
        PlantNative(tmp.Source);
        Assert.True(NativeUpdateAssembler.Create(tmp.Source, tmp.Output, Id).Ok);
        var ok = NativeUpdateValidator.ValidatePackage(tmp.Output, new NativeUpdateValidationOptions
        {
            CurrentAssembly = "1405.6.16.1"
        });
        Assert.True(ok.Ok, ok.Message);
        var mismatch = NativeUpdateValidator.ValidatePackage(tmp.Output, new NativeUpdateValidationOptions
        {
            CurrentAssembly = "1405.6.3.1"
        });
        Assert.False(mismatch.Ok);
        Assert.Equal("native-version", mismatch.Error);
        var newer = NativeUpdateValidator.ValidatePackage(tmp.Output, new NativeUpdateValidationOptions
        {
            CurrentAssembly = "1405.6.17.1"
        });
        Assert.False(newer.Ok);
        Assert.Equal("native-version", newer.Error);
    }

    [Fact]
    public void Validate_MalformedManifest_FailsClosed()
    {
        using var tmp = new TempPkg();
        Directory.CreateDirectory(tmp.Output);
        File.WriteAllText(Path.Combine(tmp.Output, "manifest.json"), "{not-json");
        var result = NativeUpdateValidator.ValidatePackage(tmp.Output);
        Assert.False(result.Ok);
        Assert.Equal("native-manifest-invalid", result.Error);
    }

    [Fact]
    public void Validate_ReplacesHtmlTrue_FailsClosed()
    {
        using var tmp = new TempPkg();
        PlantNative(tmp.Source);
        Assert.True(NativeUpdateAssembler.Create(tmp.Source, tmp.Output, Id).Ok);
        var manifest = JsonSerializer.Deserialize<NativeUpdateManifest>(
            File.ReadAllText(Path.Combine(tmp.Output, "manifest.json")), NativeUpdateJson.Options)!;
        manifest.ReplacesHtml = true;
        File.WriteAllText(Path.Combine(tmp.Output, "manifest.json"),
            JsonSerializer.Serialize(manifest, NativeUpdateJson.Options));
        var result = NativeUpdateValidator.ValidatePackage(tmp.Output);
        Assert.False(result.Ok);
        Assert.Equal("native-replaces-html", result.Error);
    }

    [Fact]
    public void Assembler_DoesNotRequireHtmlFiles()
    {
        using var tmp = new TempPkg();
        PlantNative(tmp.Source);
        Assert.False(File.Exists(Path.Combine(tmp.Source, "Sirman_Final.html")));
        Assert.False(File.Exists(Path.Combine(tmp.Source, "Laegh_Final.html")));
        Assert.False(File.Exists(Path.Combine(tmp.Source, "test_laegh.js")));
        var assembled = NativeUpdateAssembler.Create(tmp.Source, tmp.Output, Id);
        Assert.True(assembled.Ok, assembled.Message);
        Assert.True(NativeUpdateValidator.ValidatePackage(tmp.Output).Ok);
    }

    [Fact]
    public void PythonAssembler_SkipsHtmlAndValidates()
    {
        using var tmp = new TempPkg();
        PlantNative(tmp.Source);
        File.WriteAllText(Path.Combine(tmp.Source, "Sirman_Final.html"), "<!DOCTYPE html>PY-HTML-MARKER");
        var script = Path.Combine(RepoRoot(), "scripts", "assemble_sirman_native_update.py");
        var psi = new ProcessStartInfo
        {
            FileName = "python3",
            ArgumentList = { script, "--source", tmp.Source, "--out", tmp.Output },
            RedirectStandardOutput = true,
            RedirectStandardError = true
        };
        using var proc = Process.Start(psi);
        Assert.NotNull(proc);
        proc!.WaitForExit(30000);
        Assert.Equal(0, proc.ExitCode);
        var validated = NativeUpdateValidator.ValidatePackage(tmp.Output);
        Assert.True(validated.Ok, validated.Message);
        foreach (var file in Directory.GetFiles(tmp.Output, "*", SearchOption.AllDirectories))
            Assert.DoesNotContain("PY-HTML-MARKER", File.ReadAllText(file));
    }

    [Fact]
    public void HtmlUpdaterSources_UntouchedByThisPacket()
    {
        var root = RepoRoot();
        var apply = File.ReadAllText(Path.Combine(root, "apply_sirman_update.ps1"));
        Assert.Contains("replaceAppFile", apply, StringComparison.Ordinal);
        var writer = File.ReadAllText(Path.Combine(root, "scripts", "write_full_update_json.py"));
        Assert.Contains("Sirman_Final.html", writer, StringComparison.Ordinal);
        var native = File.ReadAllText(Path.Combine(root, "scripts", "assemble_sirman_native_update.py"));
        Assert.DoesNotContain("replaceAppFile", native, StringComparison.Ordinal);
        Assert.DoesNotContain("write_full_update_json", native, StringComparison.Ordinal);
    }

    static void PlantNative(string source)
    {
        Directory.CreateDirectory(source);
        File.WriteAllBytes(Path.Combine(source, "Sirman.exe"), Encoding.UTF8.GetBytes("fake-exe-payload-p0"));
        File.WriteAllBytes(Path.Combine(source, "Sirman.dll"), Encoding.UTF8.GetBytes("fake-desktop-dll-p0"));
        File.WriteAllBytes(Path.Combine(source, "Sirman.Core.dll"), Encoding.UTF8.GetBytes("fake-core-dll-p0"));
        File.WriteAllText(Path.Combine(source, "SIRMAN_VERSION.json"), """
            {"app":"1405.6.16α","assembly":"1405.6.16.1"}
            """);
    }

    sealed class TempPkg : IDisposable
    {
        public string Root { get; } = Path.Combine(Path.GetTempPath(), "sirman-native-p0-" + Guid.NewGuid().ToString("N"));
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
