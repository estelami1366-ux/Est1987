using System.Text.Json;
using Sirman.Core.Application;
using Sirman.Core.Diagnostics;
using Sirman.Core.Security;
using Xunit;

namespace Sirman.Core.Tests;

public class DiagnosticCenterP2Tests
{
    static string DesktopDir => Path.GetFullPath(Path.Combine(
        AppContext.BaseDirectory, "..", "..", "..", "..", "Sirman.Desktop"));

    static string RepoRoot => Path.GetFullPath(Path.Combine(
        AppContext.BaseDirectory, "..", "..", "..", "..", ".."));

    [Fact]
    public void GuidanceCatalog_SysHostUnscoped_IsCompleteAndShowsCorrelation()
    {
        var id = CorrelationId.New().Value;
        var g = GuidanceCatalog.For(ErrorCatalog.SysHostUnscoped, id, DataImpact.Unchanged);
        Assert.Equal(ErrorCatalog.SysHostUnscoped, g.Code);
        Assert.False(string.IsNullOrWhiteSpace(g.Title));
        Assert.False(string.IsNullOrWhiteSpace(g.UserMessage));
        Assert.False(string.IsNullOrWhiteSpace(g.Why));
        Assert.False(string.IsNullOrWhiteSpace(g.Impact));
        Assert.False(string.IsNullOrWhiteSpace(g.NextAction));
        Assert.False(string.IsNullOrWhiteSpace(g.SupportAction));
        Assert.Equal(id, g.CorrelationId);
        Assert.Contains(id, g.SupportAction, StringComparison.Ordinal);
        Assert.Equal("داده فروشگاه تغییر نکرد.", g.Impact);
        var again = GuidanceCatalog.For(ErrorCatalog.SysHostUnscoped, id, DataImpact.Unchanged);
        Assert.Equal(g.UserMessage, again.UserMessage);
        Assert.Equal(g.Why, again.Why);
        Assert.Equal(g.NextAction, again.NextAction);
        Assert.DoesNotContain("password", g.UserMessage + g.Why + g.NextAction + g.SupportAction, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("phonebook", g.SupportAction, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void Guidance_AliasBusinessFailed_MapsToSysHost()
    {
        var id = CorrelationId.New().Value;
        var g = GuidanceCatalog.For("business-failed", id);
        Assert.Equal(ErrorCatalog.SysHostUnscoped, g.Code);
        Assert.Equal(id, g.CorrelationId);
    }

    [Fact]
    public async Task QueryRecent_MinSeverity_FiltersErrors()
    {
        using var tmp = new TempDiag();
        tmp.Store.Append(Event(tmp.CorrA, ErrorCatalog.SysHostUnscoped, DiagnosticSeverity.Error, DiagnosticModule.Host));
        tmp.Store.Append(Event(tmp.CorrB, ErrorCatalog.SysDeskUnscoped, DiagnosticSeverity.Critical, DiagnosticModule.System));
        var errors = await tmp.Store.QueryRecentAsync(new DiagnosticQuery { MinSeverity = DiagnosticSeverity.Error, Limit = 50 });
        Assert.Equal(2, errors.Count);
        var critical = await tmp.Store.QueryRecentAsync(new DiagnosticQuery { MinSeverity = DiagnosticSeverity.Critical, Limit = 50 });
        Assert.Single(critical);
        Assert.Equal(DiagnosticSeverity.Critical, critical[0].Severity);
        var listed = tmp.Facade.ListRecent(new DiagnosticQuery { MinSeverity = DiagnosticSeverity.Critical, Limit = 50 });
        Assert.Single(listed);
    }

    [Fact]
    public void LoadIncident_ReturnsP1ResultAndP2Guidance()
    {
        using var tmp = new TempDiag();
        tmp.Store.Append(Event(tmp.CorrA, ErrorCatalog.SysHostUnscoped, DiagnosticSeverity.Error, DiagnosticModule.Host, "inventory.adjust"));
        var view = tmp.Facade.LoadIncident(tmp.CorrA);
        Assert.NotNull(view);
        Assert.Equal(tmp.CorrA, view!.Result.CorrelationId);
        Assert.Equal(ErrorCatalog.SysHostUnscoped, view.Result.Code);
        Assert.False(string.IsNullOrWhiteSpace(view.Result.WhatHappened));
        Assert.Equal(tmp.CorrA, view.Guidance.CorrelationId);
        Assert.Equal(ErrorCatalog.SysHostUnscoped, view.Guidance.Code);
        Assert.Contains(tmp.CorrA, view.Guidance.SupportAction, StringComparison.Ordinal);
        Assert.False(string.IsNullOrWhiteSpace(view.Guidance.UserMessage));
        Assert.False(string.IsNullOrWhiteSpace(view.Guidance.NextAction));
    }

    [Fact]
    public void GetDiagnosticIncidentJson_AddsGuidanceWithoutDroppingResult()
    {
        using var tmp = new TempDiag();
        tmp.Store.Append(Event(tmp.CorrA, ErrorCatalog.SysHostUnscoped, DiagnosticSeverity.Error, DiagnosticModule.Host));
        using var doc = JsonDocument.Parse(tmp.Facade.GetDiagnosticIncident(tmp.CorrA));
        Assert.True(doc.RootElement.GetProperty("ok").GetBoolean());
        Assert.Equal(ErrorCatalog.SysHostUnscoped, doc.RootElement.GetProperty("result").GetProperty("code").GetString());
        Assert.False(string.IsNullOrWhiteSpace(doc.RootElement.GetProperty("result").GetProperty("whatHappened").GetString()));
        var g = doc.RootElement.GetProperty("guidance");
        Assert.Equal(tmp.CorrA, g.GetProperty("correlationId").GetString());
        Assert.False(string.IsNullOrWhiteSpace(g.GetProperty("userMessage").GetString()));
        Assert.False(string.IsNullOrWhiteSpace(g.GetProperty("why").GetString()));
        Assert.False(string.IsNullOrWhiteSpace(g.GetProperty("impact").GetString()));
        Assert.False(string.IsNullOrWhiteSpace(g.GetProperty("nextAction").GetString()));
        Assert.False(string.IsNullOrWhiteSpace(g.GetProperty("supportAction").GetString()));
        Assert.False(string.IsNullOrWhiteSpace(g.GetProperty("title").GetString()));
        Assert.DoesNotContain("password", g.GetRawText(), StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void Export_StillSafe_AfterGuidance()
    {
        using var tmp = new TempDiag();
        tmp.Store.Append(Event(tmp.CorrA, ErrorCatalog.SysHostUnscoped, DiagnosticSeverity.Error, DiagnosticModule.Host));
        var exported = tmp.Facade.ExportIncident(tmp.CorrA);
        Assert.True(exported.Ok);
        Assert.False(string.IsNullOrWhiteSpace(exported.FileName));
        Assert.DoesNotContain("/", exported.FileName, StringComparison.Ordinal);
        using var json = JsonDocument.Parse(tmp.Facade.ExportDiagnosticReport(tmp.CorrA));
        Assert.True(json.RootElement.GetProperty("ok").GetBoolean());
        Assert.Equal("diagnostics/support", json.RootElement.GetProperty("folder").GetString());
        Assert.False(json.RootElement.TryGetProperty("path", out _));
    }

    [Fact]
    public void P1RunBusinessDiagnosticWire_UnchangedShape()
    {
        using var tmp = new TempDiag();
        var facade = new BusinessFacade(new DiagnosticService(tmp.Store, "1405.6.16α", "1405.6.16.1"));
        using var doc = JsonDocument.Parse(facade.Run("no.such", "{}"));
        var d = doc.RootElement.GetProperty("diagnostic");
        var names = d.EnumerateObject().Select(p => p.Name).OrderBy(x => x, StringComparer.Ordinal).ToArray();
        Assert.Equal(new[]
        {
            "code", "correlationId", "dataImpact", "probableCause", "severity",
            "succeeded", "title", "userAction", "whatHappened"
        }, names);
    }

    [Fact]
    public void NativeCenter_IsDesktopForm_NotHtmlLogic()
    {
        var form = File.ReadAllText(Path.Combine(DesktopDir, "DiagnosticCenterForm.cs"));
        Assert.Contains("DiagnosticRuntime.Facade.ListRecent", form, StringComparison.Ordinal);
        Assert.Contains("LoadIncident", form, StringComparison.Ordinal);
        Assert.Contains("ExportIncident", form, StringComparison.Ordinal);
        Assert.DoesNotContain("ErrorCatalog", form, StringComparison.Ordinal);
        Assert.DoesNotContain("ClassifyKey", form, StringComparison.Ordinal);
        var host = File.ReadAllText(Path.Combine(DesktopDir, "SirmanHostObject.cs"));
        Assert.Contains("OpenDiagnosticCenter", host, StringComparison.Ordinal);
        Assert.Contains("OpenDiagnosticCenter", PermissionCatalog.AlwaysAllowedHostMethods);
        var html = File.ReadAllText(Path.Combine(RepoRoot, "Sirman_Final.html"));
        Assert.DoesNotContain("OpenDiagnosticCenter", html, StringComparison.Ordinal);
        Assert.DoesNotContain("GuidanceCatalog", html, StringComparison.Ordinal);
    }

    static DiagnosticEvent Event(string corr, string code, DiagnosticSeverity sev, DiagnosticModule mod, string op = "op") => new()
    {
        EventId = Guid.NewGuid().ToString("N"),
        CorrelationId = corr,
        Severity = sev,
        Code = code,
        Module = mod,
        Operation = op,
        Outcome = OperationOutcome.Failed,
        Success = false,
        Source = DiagnosticSource.Core,
        AppVersion = "1405.6.16α",
        TechnicalMessage = "synthetic-p2"
    };

    sealed class TempDiag : IDisposable
    {
        public string Dir { get; }
        public FileDiagnosticStore Store { get; }
        public DiagnosticFacade Facade { get; }
        public string CorrA { get; } = CorrelationId.New().Value;
        public string CorrB { get; } = CorrelationId.New().Value;

        public TempDiag()
        {
            Dir = Path.Combine(Path.GetTempPath(), "sirman-diag-p2-" + Guid.NewGuid().ToString("N"));
            Directory.CreateDirectory(Dir);
            Store = new FileDiagnosticStore(Dir);
            var svc = new DiagnosticService(Store, "1405.6.16α", "1405.6.16.1");
            Facade = new DiagnosticFacade(svc, Store, Path.Combine(Dir, "diagnostics", "support"));
        }

        public void Dispose()
        {
            try { Directory.Delete(Dir, recursive: true); } catch { /* test temp */ }
        }
    }
}
