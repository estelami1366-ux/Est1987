using System.Text.Json;
using Sirman.Core.Application;
using Sirman.Core.Diagnostics;
using Sirman.Core.Infrastructure;
using Xunit;

namespace Sirman.Core.Tests;

public class DiagnosticCenterP1Tests
{
    static string DesktopHostPath => Path.GetFullPath(Path.Combine(
        AppContext.BaseDirectory, "..", "..", "..", "..", "Sirman.Desktop", "SirmanHostObject.cs"));

    [Fact]
    public void RunBusiness_MintsCorrelationIdWhenMissing()
    {
        using var tmp = new TempDiag();
        var facade = tmp.Facade();
        using var doc = JsonDocument.Parse(facade.Run("calc.balance", """{"total":"1000","paid":"300"}"""));
        Assert.True(doc.RootElement.GetProperty("ok").GetBoolean());
        Assert.Equal(700, doc.RootElement.GetProperty("result").GetDouble());
        var corr = doc.RootElement.GetProperty("correlationId").GetString();
        Assert.True(CorrelationId.IsWellFormed(corr));
        Assert.False(doc.RootElement.TryGetProperty("diagnostic", out _));
        Assert.False(File.Exists(tmp.EventsPath));
    }

    [Fact]
    public void RunBusiness_PreservesSuppliedCorrelationId()
    {
        using var tmp = new TempDiag();
        var facade = tmp.Facade();
        var id = CorrelationId.New().Value;
        var json = facade.Run("calc.balance", $$"""{"total":"5","paid":"1","correlationId":"{{id}}"}""");
        using var doc = JsonDocument.Parse(json);
        Assert.Equal(id, doc.RootElement.GetProperty("correlationId").GetString());
        Assert.Equal(4, doc.RootElement.GetProperty("result").GetDouble());
    }

    [Fact]
    public async Task ExplicitBusinessFailure_CreatesEventAndSafeDiagnostic()
    {
        using var tmp = new TempDiag();
        var facade = tmp.Facade();
        var id = CorrelationId.New().Value;
        var json = facade.Run("inventory.adjust",
            $$"""{"item":{"code":"P1","qty":10,"reserved":0},"qty":-3,"whId":"","correlationId":"{{id}}"}""");
        using var doc = JsonDocument.Parse(json);
        Assert.True(doc.RootElement.GetProperty("ok").GetBoolean());
        Assert.False(doc.RootElement.GetProperty("result").GetProperty("ok").GetBoolean());
        Assert.Equal("مقدار نامعتبر", doc.RootElement.GetProperty("result").GetProperty("err").GetString());
        Assert.Equal(id, doc.RootElement.GetProperty("correlationId").GetString());
        var diagnostic = doc.RootElement.GetProperty("diagnostic");
        AssertSafeDiagnostic(diagnostic, id);
        var events = await tmp.Store.GetByCorrelationIdAsync(id);
        Assert.Single(events);
        Assert.Equal(ErrorCatalog.SysHostUnscoped, events[0].Code);
        Assert.Equal("inventory.adjust", events[0].Operation);
        Assert.Equal(DiagnosticModule.Inventory, events[0].Module);
        Assert.DoesNotContain("\"item\":", File.ReadAllText(tmp.EventsPath), StringComparison.Ordinal);
    }

    [Fact]
    public async Task InvalidOperation_CreatesDiagnostic_KeepsSafeErrorShape()
    {
        using var tmp = new TempDiag();
        var facade = tmp.Facade();
        using var doc = JsonDocument.Parse(facade.Run("no.such", "{}"));
        Assert.False(doc.RootElement.GetProperty("ok").GetBoolean());
        Assert.Equal("business-failed", doc.RootElement.GetProperty("error").GetString());
        Assert.Equal("محاسبه انجام نشد", doc.RootElement.GetProperty("message").GetString());
        Assert.True(CorrelationId.IsWellFormed(doc.RootElement.GetProperty("correlationId").GetString()));
        AssertSafeDiagnostic(doc.RootElement.GetProperty("diagnostic"), doc.RootElement.GetProperty("correlationId").GetString()!);
        Assert.False(doc.RootElement.GetRawText().Contains("InvalidOperation", StringComparison.Ordinal));
        var events = await tmp.Store.QueryRecentAsync(new DiagnosticQuery { Limit = 10 });
        Assert.Single(events);
        Assert.Equal("no.such", events[0].Operation);
    }

    [Fact]
    public async Task MalformedRequest_CreatesInvalidJsonDiagnostic()
    {
        using var tmp = new TempDiag();
        var facade = tmp.Facade();
        using var doc = JsonDocument.Parse(facade.Run("calc.balance", "{not-json"));
        Assert.False(doc.RootElement.GetProperty("ok").GetBoolean());
        Assert.Equal("invalid-json", doc.RootElement.GetProperty("error").GetString());
        Assert.Equal("داده نامعتبر است", doc.RootElement.GetProperty("message").GetString());
        var corr = doc.RootElement.GetProperty("correlationId").GetString();
        Assert.True(CorrelationId.IsWellFormed(corr));
        AssertSafeDiagnostic(doc.RootElement.GetProperty("diagnostic"), corr!);
        var events = await tmp.Store.GetByCorrelationIdAsync(corr!);
        Assert.Single(events);
        Assert.Equal(ErrorCatalog.SysHostUnscoped, events[0].Code);
    }

    [Fact]
    public async Task CoreException_CreatesDiagnosticWithoutLeakingSecrets()
    {
        using var tmp = new TempDiag();
        var facade = tmp.Facade();
        var boom = new InvalidOperationException("core blew up password=hunter2");
        boom.Data["password"] = "hunter2";
        boom.Data["apiKey"] = "sk-live";
        facade.TestForceException = boom;
        var id = CorrelationId.New().Value;
        using var doc = JsonDocument.Parse(facade.Run("calc.balance", $$"""{"total":"1","paid":"0","correlationId":"{{id}}"}"""));
        Assert.False(doc.RootElement.GetProperty("ok").GetBoolean());
        Assert.Equal("business-failed", doc.RootElement.GetProperty("error").GetString());
        Assert.Equal("محاسبه انجام نشد", doc.RootElement.GetProperty("message").GetString());
        Assert.Equal(id, doc.RootElement.GetProperty("correlationId").GetString());
        AssertSafeDiagnostic(doc.RootElement.GetProperty("diagnostic"), id);
        var raw = doc.RootElement.GetRawText();
        Assert.DoesNotContain("hunter2", raw, StringComparison.Ordinal);
        Assert.DoesNotContain("sk-live", raw, StringComparison.Ordinal);
        var disk = File.ReadAllText(tmp.EventsPath);
        Assert.DoesNotContain("hunter2", disk, StringComparison.Ordinal);
        Assert.DoesNotContain("sk-live", disk, StringComparison.Ordinal);
        var events = await tmp.Store.GetByCorrelationIdAsync(id);
        Assert.Single(events);
        Assert.Equal("System.InvalidOperationException", events[0].ExceptionType);
        Assert.DoesNotContain("hunter2", events[0].TechnicalMessage ?? "", StringComparison.Ordinal);
    }

    [Fact]
    public void HostError_ProducesSafeResult_CompatibleWithSafeError()
    {
        var id = CorrelationId.New().Value;
        var diagnostic = GuidanceEngine.ForFailure("business-failed", id, DataImpact.Unknown);
        var json = DiagnosticEnvelope.SafeErrorWithDiagnostic(
            "business-failed",
            "محاسبه انجام نشد",
            id,
            diagnostic,
            new InvalidOperationException("bridge password=secret123"));
        using var doc = JsonDocument.Parse(json);
        Assert.False(doc.RootElement.GetProperty("ok").GetBoolean());
        Assert.Equal("business-failed", doc.RootElement.GetProperty("error").GetString());
        Assert.Equal("محاسبه انجام نشد", doc.RootElement.GetProperty("message").GetString());
        Assert.Equal(id, doc.RootElement.GetProperty("correlationId").GetString());
        AssertSafeDiagnostic(doc.RootElement.GetProperty("diagnostic"), id);
        Assert.DoesNotContain("secret123", json, StringComparison.Ordinal);
        Assert.False(doc.RootElement.GetProperty("diagnostic").TryGetProperty("exception", out _));
        Assert.False(doc.RootElement.GetProperty("diagnostic").TryGetProperty("stack", out _));

        var host = File.ReadAllText(DesktopHostPath);
        Assert.Contains("return DesktopSecurity.Business.Run(name, json);", host, StringComparison.Ordinal);
        Assert.Contains("PublishHostFailure(\"RunBusiness\"", host, StringComparison.Ordinal);
        Assert.Contains("SafeErrorWithDiagnostic", host, StringComparison.Ordinal);
    }

    [Fact]
    public void SafeError_JsonStillThreeFields()
    {
        var json = SafeError.Json("business-failed", "محاسبه انجام نشد", new InvalidOperationException("inner"));
        using var doc = JsonDocument.Parse(json);
        Assert.False(doc.RootElement.GetProperty("ok").GetBoolean());
        Assert.Equal("business-failed", doc.RootElement.GetProperty("error").GetString());
        Assert.Equal("محاسبه انجام نشد", doc.RootElement.GetProperty("message").GetString());
        Assert.Equal(3, doc.RootElement.EnumerateObject().Count());
    }

    [Fact]
    public async Task SameCorrelationId_SharedAcrossRelatedFailures()
    {
        using var tmp = new TempDiag();
        var facade = tmp.Facade();
        var id = CorrelationId.New().Value;
        var payload = $$"""{"correlationId":"{{id}}"}""";
        facade.Run("no.such", payload);
        facade.Run("also.missing", payload);
        var events = await tmp.Store.GetByCorrelationIdAsync(id);
        Assert.Equal(2, events.Count);
        Assert.All(events, e => Assert.Equal(id, e.CorrelationId));
        Assert.Equal("no.such", events[0].Operation);
        Assert.Equal("also.missing", events[1].Operation);
    }

    [Fact]
    public void NestedScope_ReusesCurrentCorrelationWhenJsonOmitsId()
    {
        using var tmp = new TempDiag();
        var facade = tmp.Facade();
        var id = CorrelationId.New().Value;
        using (CorrelationScope.Enter(id))
        {
            using var doc = JsonDocument.Parse(facade.Run("no.such", "{}"));
            Assert.Equal(id, doc.RootElement.GetProperty("correlationId").GetString());
        }
        using var next = JsonDocument.Parse(facade.Run("no.such", "{}"));
        Assert.NotEqual(id, next.RootElement.GetProperty("correlationId").GetString());
    }

    [Fact]
    public async Task Persistence_ReceivesExpectedFailureEvent()
    {
        using var tmp = new TempDiag();
        var facade = tmp.Facade();
        var id = CorrelationId.New().Value;
        facade.Run("inventory.removeStock",
            $$"""{"item":{"code":"P1","qty":10,"reserved":0},"qty":99,"whId":"","correlationId":"{{id}}"}""");
        Assert.True(File.Exists(tmp.EventsPath));
        Assert.False(File.Exists(tmp.PrintHistoryPath));
        var events = await tmp.Store.GetByCorrelationIdAsync(id);
        Assert.Single(events);
        Assert.Contains("موجودی قابل‌استفاده کافی نیست", events[0].TechnicalMessage, StringComparison.Ordinal);
        var lines = File.ReadAllLines(tmp.EventsPath);
        Assert.Single(lines);
        Assert.StartsWith("{", lines[0], StringComparison.Ordinal);
    }

    [Fact]
    public void DiagnosticResult_ReturnedToCaller_IsSafeSubset()
    {
        using var tmp = new TempDiag();
        var facade = tmp.Facade();
        using var doc = JsonDocument.Parse(facade.Run("no.such", "{}"));
        var d = doc.RootElement.GetProperty("diagnostic");
        var names = d.EnumerateObject().Select(p => p.Name).OrderBy(x => x, StringComparer.Ordinal).ToArray();
        Assert.Equal(new[]
        {
            "code", "correlationId", "dataImpact", "probableCause", "severity",
            "succeeded", "title", "userAction", "whatHappened"
        }, names);
        Assert.False(d.GetProperty("succeeded").GetBoolean());
        Assert.Equal(ErrorCatalog.SysHostUnscoped, d.GetProperty("code").GetString());
        Assert.False(string.IsNullOrWhiteSpace(d.GetProperty("whatHappened").GetString()));
        Assert.False(string.IsNullOrWhiteSpace(d.GetProperty("userAction").GetString()));
    }

    [Fact]
    public void P0HostMethods_RemainOnSameSurface()
    {
        var host = File.ReadAllText(DesktopHostPath);
        Assert.Contains("NewDiagnosticCorrelationId", host, StringComparison.Ordinal);
        Assert.Contains("GetRecentDiagnostics", host, StringComparison.Ordinal);
        Assert.Contains("GetDiagnosticIncident", host, StringComparison.Ordinal);
        Assert.Contains("ExportDiagnosticReport", host, StringComparison.Ordinal);
        Assert.Contains("public string RunBusiness(string name, string json)", host, StringComparison.Ordinal);
    }

    static void AssertSafeDiagnostic(JsonElement diagnostic, string correlationId)
    {
        Assert.False(diagnostic.GetProperty("succeeded").GetBoolean());
        Assert.Equal(ErrorCatalog.SysHostUnscoped, diagnostic.GetProperty("code").GetString());
        Assert.Equal(correlationId, diagnostic.GetProperty("correlationId").GetString());
        Assert.False(string.IsNullOrWhiteSpace(diagnostic.GetProperty("title").GetString()));
        Assert.False(string.IsNullOrWhiteSpace(diagnostic.GetProperty("whatHappened").GetString()));
        Assert.False(diagnostic.TryGetProperty("exceptionType", out _));
        Assert.False(diagnostic.TryGetProperty("technicalMessage", out _));
        Assert.False(diagnostic.TryGetProperty("stackHash", out _));
        Assert.DoesNotContain("password", diagnostic.GetRawText(), StringComparison.OrdinalIgnoreCase);
    }

    sealed class TempDiag : IDisposable
    {
        public string Dir { get; }
        public string EventsPath { get; }
        public string PrintHistoryPath { get; }
        public FileDiagnosticStore Store { get; }

        public TempDiag()
        {
            Dir = Path.Combine(Path.GetTempPath(), "sirman-diag-p1-" + Guid.NewGuid().ToString("N"));
            Directory.CreateDirectory(Dir);
            Store = new FileDiagnosticStore(Dir);
            EventsPath = Store.FilePath;
            PrintHistoryPath = Path.Combine(Dir, FileDiagnosticStore.RelativeDirectory, FileDiagnosticStore.PrintHistoryFileName);
        }

        public BusinessFacade Facade() => new(new DiagnosticService(Store, "1405.6.16α", "1405.6.16.1"));

        public void Dispose()
        {
            try { Directory.Delete(Dir, recursive: true); } catch { /* test temp */ }
        }
    }
}
