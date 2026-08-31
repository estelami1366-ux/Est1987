using Sirman.Core.Printing;
using Xunit;

namespace Sirman.Core.Tests;

public class NativeLogoSourceTests
{
    // 1×1 PNG
    private const string PngB64 =
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

    [Fact]
    public void DataUrl_ValidPng_YieldsBytesAndRecognizedHeader()
    {
        var src = "data:image/png;base64," + PngB64;
        var r = NativeLogoSource.Resolve(src, mediaRoots: null);
        Assert.Equal("data", r.SourceKind);
        Assert.True(r.HasLoadableBytes);
        Assert.True(r.RecognizedImageHeader);
        Assert.StartsWith("data:image/png;base64,len=", r.LogoSrcPreview, StringComparison.Ordinal);
        Assert.DoesNotContain(PngB64, r.LogoSrcPreview, StringComparison.Ordinal);
        Assert.Null(r.FailureReason);
    }

    [Fact]
    public void DiskRef_ExistingSirmanMediaFile_ResolvesUnderProvidedRoot()
    {
        var root = CreateTempMediaRoot("ok");
        try
        {
            var bytes = Convert.FromBase64String(PngB64);
            var relDir = Path.Combine(root, "sirman_media");
            Directory.CreateDirectory(relDir);
            var path = Path.Combine(relDir, "logo.jpg");
            File.WriteAllBytes(path, bytes);

            var r = NativeLogoSource.Resolve("disk://sirman_media/logo.jpg", new[] { root });
            Assert.Equal("disk", r.SourceKind);
            Assert.True(r.FileExists);
            Assert.True(r.HasLoadableBytes);
            Assert.True(r.RecognizedImageHeader);
            Assert.Equal(Path.GetFullPath(path), r.ResolvedPath);
            Assert.Null(r.FailureReason);
            Assert.Equal("disk://sirman_media/logo.jpg", r.LogoSrcPreview);
        }
        finally { TryDelete(root); }
    }

    [Fact]
    public void DiskRef_MissingFile_FailsGracefully()
    {
        var root = CreateTempMediaRoot("missing");
        try
        {
            Directory.CreateDirectory(Path.Combine(root, "sirman_media"));
            var r = NativeLogoSource.Resolve("disk://sirman_media/logo.jpg", new[] { root });
            Assert.Equal("disk", r.SourceKind);
            Assert.False(r.FileExists);
            Assert.False(r.HasLoadableBytes);
            Assert.Equal("disk-missing", r.FailureReason);
        }
        finally { TryDelete(root); }
    }

    [Fact]
    public void DiskRef_InvalidImageBytes_ReportsUnrecognizedHeader()
    {
        var root = CreateTempMediaRoot("bad");
        try
        {
            var relDir = Path.Combine(root, "sirman_media");
            Directory.CreateDirectory(relDir);
            var path = Path.Combine(relDir, "logo.jpg");
            File.WriteAllText(path, "NOT_AN_IMAGE");

            var r = NativeLogoSource.Resolve("disk://sirman_media/logo.jpg", new[] { root });
            Assert.Equal("disk", r.SourceKind);
            Assert.True(r.FileExists);
            Assert.True(r.HasLoadableBytes);
            Assert.False(r.RecognizedImageHeader);
            Assert.Equal("unrecognized-image-header", r.FailureReason);
        }
        finally { TryDelete(root); }
    }

    [Fact]
    public void DataUrl_InvalidBase64_FailsDecode()
    {
        var r = NativeLogoSource.Resolve("data:image/png;base64,!!!!not-base64!!!!", null);
        Assert.Equal("data", r.SourceKind);
        Assert.False(r.HasLoadableBytes);
        Assert.Equal("data-decode-failed", r.FailureReason);
    }

    [Fact]
    public void DiskRef_PathTraversal_IsRejected()
    {
        var root = CreateTempMediaRoot("trav");
        try
        {
            var r = NativeLogoSource.Resolve("disk://sirman_media/../secret.bin", new[] { root });
            Assert.Equal("disk", r.SourceKind);
            Assert.False(r.FileExists);
            Assert.Equal("disk-invalid-path", r.FailureReason);
        }
        finally { TryDelete(root); }
    }

    [Fact]
    public void HttpAndFileUrls_AreRejected()
    {
        var http = NativeLogoSource.Resolve("https://example.test/logo.png", null);
        Assert.Equal("http", http.SourceKind);
        Assert.Equal("http-rejected", http.FailureReason);
        var file = NativeLogoSource.Resolve("file:///C:/logo.png", null);
        Assert.Equal("file-url", file.SourceKind);
        Assert.Equal("file-url-rejected", file.FailureReason);
    }

    [Fact]
    public void HtmlContract_IsDiskRef_And_DiskRefPath_Match()
    {
        Assert.True(NativeLogoSource.IsDiskRef("disk://sirman_media/logo.jpg"));
        Assert.Equal("sirman_media/logo.jpg", NativeLogoSource.DiskRefPath("disk://sirman_media/logo.jpg"));
        Assert.False(NativeLogoSource.IsDiskRef("data:image/png;base64,AAA"));
        Assert.Equal("", NativeLogoSource.DiskRefPath("sirman_media/logo.jpg"));
    }

    [Fact]
    public void StoredLogoSrcFormat_IsNotRewritten()
    {
        var src = "disk://sirman_media/logo.jpg";
        var r = NativeLogoSource.Resolve(src, Array.Empty<string>());
        Assert.Equal(src, r.LogoSrcPreview);
        Assert.Equal("disk", NativeLogoSource.ClassifyKind(src));
    }

    private static string CreateTempMediaRoot(string tag)
    {
        var dir = Path.Combine(Path.GetTempPath(), "sirman-p05r6-" + tag + "-" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(dir);
        return dir;
    }

    private static void TryDelete(string dir)
    {
        try { Directory.Delete(dir, recursive: true); } catch { /* test temp */ }
    }
}
