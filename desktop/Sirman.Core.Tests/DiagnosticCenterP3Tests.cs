using System.Text.Json;
using Sirman.Core.Diagnostics;
using Sirman.Core.Security;
using Xunit;

namespace Sirman.Core.Tests;

public class DiagnosticCenterP3Tests
{
    static string DesktopDir => Path.GetFullPath(Path.Combine(
        AppContext.BaseDirectory, "..", "..", "..", "..", "Sirman.Desktop"));

    static string RepoRoot => Path.GetFullPath(Path.Combine(
        AppContext.BaseDirectory, "..", "..", "..", "..", ".."));

    [Fact]
    public void ReportUiFault_RecordsSysUiUnscoped()
    {
        using var tmp = new TempDiag();
        var report = tmp.Facade.RecordUiFault("""{"message":"boom","source":"app.js","line":12,"column":3,"kind":"window.onerror"}""");
        Assert.True(report.Ok);
        Assert.True(report.Recorded);
        Assert.False(report.Suppressed);
        Assert.Equal(ErrorCatalog.SysUiUnscoped, report.Code);
        Assert.True(CorrelationId.IsWellFormed(report.CorrelationId));
        var listed = tmp.Facade.ListRecent(new DiagnosticQuery { Limit = 10 });
        var evt = Assert.Single(listed);
        Assert.Equal(ErrorCatalog.SysUiUnscoped, evt.Code);
        Assert.Equal(DiagnosticSource.UiForwarded, evt.Source);
        Assert.Equal("window.onerror", evt.Operation);
        Assert.Equal(report.CorrelationId, evt.CorrelationId);
        Assert.Contains("boom", evt.TechnicalMessage, StringComparison.Ordinal);
        Assert.Contains("app.js", evt.TechnicalMessage, StringComparison.Ordinal);
    }

    [Fact]
    public void ReportUiFault_PreservesOrMintsCorrelationId()
    {
        using var tmp = new TempDiag();
        var id = CorrelationId.New().Value;
        var kept = tmp.Facade.RecordUiFault("{\"message\":\"a\",\"correlationId\":\"" + id + "\"}");
        Assert.Equal(id, kept.CorrelationId);
        var minted = tmp.Facade.RecordUiFault("{\"message\":\"b\",\"correlationId\":\"TR-not-core\"}");
        Assert.True(CorrelationId.IsWellFormed(minted.CorrelationId));
        Assert.NotEqual("TR-not-core", minted.CorrelationId);
        var empty = tmp.Facade.RecordUiFault("{\"message\":\"c\"}");
        Assert.True(CorrelationId.IsWellFormed(empty.CorrelationId));
    }

    [Fact]
    public void ReportUiFault_SanitizesSecretsAndIgnoresClientCode()
    {
        using var tmp = new TempDiag();
        var report = tmp.Facade.RecordUiFault("""{"message":"login failed password=hunter2","code":"INV-9999","phonebook":[{"name":"x"}]}""");
        Assert.Equal(ErrorCatalog.SysUiUnscoped, report.Code);
        Assert.DoesNotContain("INV-9999", report.Code, StringComparison.Ordinal);
        var evt = Assert.Single(tmp.Facade.ListRecent(new DiagnosticQuery { Limit = 5 }));
        Assert.Equal(ErrorCatalog.SysUiUnscoped, evt.Code);
        Assert.DoesNotContain("hunter2", evt.TechnicalMessage, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("password=***", evt.TechnicalMessage, StringComparison.OrdinalIgnoreCase);
        var raw = File.ReadAllText(tmp.EventsPath);
        Assert.DoesNotContain("\"phonebook\":", raw, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("hunter2", raw, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("INV-9999", raw, StringComparison.Ordinal);
    }

    [Fact]
    public void ReportUiFault_SuppressesDuplicateWithinWindow()
    {
        var clock = new JumpClock();
        using var tmp = new TempDiag(clock);
        var first = tmp.Facade.RecordUiFault("""{"message":"repeat-me","source":"x.js","line":1}""");
        var second = tmp.Facade.RecordUiFault("""{"message":"repeat-me","source":"x.js","line":1}""");
        Assert.True(first.Recorded);
        Assert.True(second.Suppressed);
        Assert.False(second.Recorded);
        Assert.Single(tmp.Facade.ListRecent(new DiagnosticQuery { Limit = 20 }));
        clock.Utc = clock.Utc.AddSeconds(16);
        var third = tmp.Facade.RecordUiFault("""{"message":"repeat-me","source":"x.js","line":1}""");
        Assert.True(third.Recorded);
        Assert.False(third.Suppressed);
        Assert.Equal(2, tmp.Facade.ListRecent(new DiagnosticQuery { Limit = 20 }).Count);
    }

    [Fact]
    public void ReportUiFault_AttachesP2Guidance()
    {
        using var tmp = new TempDiag();
        var report = tmp.Facade.RecordUiFault("""{"message":"script failed"}""");
        Assert.False(string.IsNullOrWhiteSpace(report.Guidance.Title));
        Assert.False(string.IsNullOrWhiteSpace(report.Guidance.UserMessage));
        Assert.False(string.IsNullOrWhiteSpace(report.Guidance.Why));
        Assert.False(string.IsNullOrWhiteSpace(report.Guidance.Impact));
        Assert.False(string.IsNullOrWhiteSpace(report.Guidance.NextAction));
        Assert.False(string.IsNullOrWhiteSpace(report.Guidance.SupportAction));
        Assert.Equal(report.CorrelationId, report.Guidance.CorrelationId);
        Assert.Contains(report.CorrelationId, report.Guidance.SupportAction, StringComparison.Ordinal);
        using var json = JsonDocument.Parse(tmp.Facade.ReportUiFault("""{"message":"other"}"""));
        Assert.True(json.RootElement.GetProperty("ok").GetBoolean());
        Assert.False(string.IsNullOrWhiteSpace(json.RootElement.GetProperty("guidance").GetProperty("userMessage").GetString()));
        var view = tmp.Facade.LoadIncident(report.CorrelationId);
        Assert.NotNull(view);
        Assert.Equal(ErrorCatalog.SysUiUnscoped, view!.Guidance.Code);
        Assert.Equal(report.CorrelationId, view.Result.CorrelationId);
    }

    [Fact]
    public void ReportUiFault_MalformedInput_IsFailSafe()
    {
        using var tmp = new TempDiag();
        foreach (var raw in new[] { "", "   ", "not-json", "[]", "null", "{", "123" })
        {
            var report = tmp.Facade.RecordUiFault(raw);
            Assert.True(report.Ok);
            Assert.True(CorrelationId.IsWellFormed(report.CorrelationId));
            Assert.Equal(ErrorCatalog.SysUiUnscoped, report.Code);
        }
        var json = tmp.Facade.ReportUiFault("{{{{");
        using var doc = JsonDocument.Parse(json);
        Assert.True(doc.RootElement.GetProperty("ok").GetBoolean());
        Assert.True(CorrelationId.IsWellFormed(doc.RootElement.GetProperty("correlationId").GetString()));
        Assert.False(doc.RootElement.TryGetProperty("path", out _));
    }

    [Fact]
    public void ReportUiFault_HostAndHtmlAreThinAdapters()
    {
        var host = File.ReadAllText(Path.Combine(DesktopDir, "SirmanHostObject.cs"));
        Assert.Contains("ReportUiFault", host, StringComparison.Ordinal);
        Assert.Contains("OpenDiagnosticCenter", PermissionCatalog.AlwaysAllowedHostMethods);
        Assert.Contains("ReportUiFault", PermissionCatalog.AlwaysAllowedHostMethods);
        var main = File.ReadAllText(Path.Combine(DesktopDir, "MainForm.cs"));
        Assert.Contains("ReportUiFault", main, StringComparison.Ordinal);
        Assert.Contains("unhandledrejection", main, StringComparison.Ordinal);
        var html = File.ReadAllText(Path.Combine(RepoRoot, "Sirman_Final.html"));
        Assert.Contains("function reportUiFaultToHost", html, StringComparison.Ordinal);
        Assert.Contains("ReportUiFault", html, StringComparison.Ordinal);
        Assert.DoesNotContain("GuidanceCatalog", html, StringComparison.Ordinal);
        Assert.DoesNotContain("events.jsonl", html, StringComparison.Ordinal);
        Assert.DoesNotContain("UiFaultDeduper", html, StringComparison.Ordinal);
        var adapter = Slice(html, "function reportUiFaultToHost", "window.addEventListener('error'");
        Assert.DoesNotContain("toAppError", adapter, StringComparison.Ordinal);
        Assert.DoesNotContain("ERROR_CATALOG", adapter, StringComparison.Ordinal);
        Assert.DoesNotContain("presentAppError", adapter, StringComparison.Ordinal);
    }

    static string Slice(string src, string start, string end)
    {
        var i = src.IndexOf(start, StringComparison.Ordinal);
        var j = src.IndexOf(end, i < 0 ? 0 : i, StringComparison.Ordinal);
        Assert.True(i >= 0 && j > i, "adapter slice missing");
        return src[i..j];
    }

    sealed class JumpClock : TimeProvider
    {
        public DateTimeOffset Utc { get; set; } = new(2026, 9, 11, 8, 0, 0, TimeSpan.Zero);
        public override DateTimeOffset GetUtcNow() => Utc;
    }

    sealed class TempDiag : IDisposable
    {
        public string Dir { get; }
        public string EventsPath { get; }
        public DiagnosticFacade Facade { get; }

        public TempDiag(TimeProvider? time = null)
        {
            Dir = Path.Combine(Path.GetTempPath(), "sirman-diag-p3-" + Guid.NewGuid().ToString("N"));
            Directory.CreateDirectory(Dir);
            var store = new FileDiagnosticStore(Dir, time);
            EventsPath = store.FilePath;
            var svc = new DiagnosticService(store, "1405.6.16α", "1405.6.16.1");
            var deduper = new UiFaultDeduper(time ?? TimeProvider.System);
            Facade = new DiagnosticFacade(svc, store, Path.Combine(Dir, "diagnostics", "support"), deduper);
        }

        public void Dispose()
        {
            try { Directory.Delete(Dir, recursive: true); } catch { /* test temp */ }
        }
    }
}
