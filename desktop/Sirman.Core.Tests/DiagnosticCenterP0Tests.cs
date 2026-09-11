using System.Text;
using System.Text.Json;
using Sirman.Core.Diagnostics;
using Sirman.Core.Infrastructure;
using Sirman.Core.Security;
using Xunit;

namespace Sirman.Core.Tests;

public class DiagnosticCenterP0Tests
{
    static string DesktopDir => Path.GetFullPath(Path.Combine(
        AppContext.BaseDirectory, "..", "..", "..", "..", "Sirman.Desktop"));

    static string RepoRoot => Path.GetFullPath(Path.Combine(
        AppContext.BaseDirectory, "..", "..", "..", "..", ".."));

    [Fact]
    public void DiagnosticEvent_RoundtripsJson()
    {
        var evt = SampleEvent("C-" + new string('a', 32), "SYS-HOST-UNSCOPED");
        var json = JsonSerializer.Serialize(evt, DiagnosticJson.Options);
        var back = JsonSerializer.Deserialize<DiagnosticEvent>(json, DiagnosticJson.Options);
        Assert.NotNull(back);
        Assert.Equal(evt.EventId, back!.EventId);
        Assert.Equal(evt.CorrelationId, back.CorrelationId);
        Assert.Equal(evt.Code, back.Code);
        Assert.Equal(DiagnosticModule.Host, back.Module);
        Assert.Equal(DiagnosticSeverity.Error, back.Severity);
        Assert.DoesNotContain("password", json, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void Incident_RoundtripsJson()
    {
        var incident = new Incident
        {
            CorrelationId = CorrelationId.New().Value,
            Status = IncidentStatus.Open,
            OpenedAtUtc = "2026-09-11T00:00:00.0000000Z",
            UpdatedAtUtc = "2026-09-11T00:00:01.0000000Z",
            PrimaryCode = "SYS-DESK-UNSCOPED",
            Severity = DiagnosticSeverity.Critical,
            Module = DiagnosticModule.System,
            Operation = "Desktop.Unhandled",
            DataImpact = DataImpact.Unknown,
            EventCount = 2,
            LastEventId = Guid.NewGuid().ToString("N")
        };
        var json = JsonSerializer.Serialize(incident, DiagnosticJson.Options);
        var back = JsonSerializer.Deserialize<Incident>(json, DiagnosticJson.Options);
        Assert.NotNull(back);
        Assert.Equal(incident.CorrelationId, back!.CorrelationId);
        Assert.Equal(IncidentStatus.Open, back.Status);
        Assert.Equal(2, back.EventCount);
        Assert.Equal("SYS-DESK-UNSCOPED", back.PrimaryCode);
    }

    [Fact]
    public void CorrelationId_IsUniqueSerializableAndWellFormed()
    {
        var seen = new HashSet<string>(StringComparer.Ordinal);
        for (var i = 0; i < 64; i++)
        {
            var id = CorrelationId.New();
            Assert.True(CorrelationId.IsWellFormed(id.Value));
            Assert.StartsWith("C-", id.Value, StringComparison.Ordinal);
            Assert.Equal(34, id.Value.Length);
            Assert.False(id.Value.Contains("PJ-", StringComparison.Ordinal));
            Assert.DoesNotContain("TR-", id.Value, StringComparison.Ordinal);
            Assert.True(seen.Add(id.Value), "correlation id must not collide");
            Assert.True(CorrelationId.TryParse(id.Value, out var parsed));
            Assert.Equal(id.Value, parsed.Value);
            Assert.Equal(id.Value, JsonSerializer.Deserialize<string>(JsonSerializer.Serialize(id.Value)));
        }
        Assert.False(CorrelationId.IsWellFormed("D-" + new string('a', 32)));
        Assert.False(CorrelationId.IsWellFormed("C-" + new string('z', 32)));
        Assert.False(CorrelationId.TryParse("", out _));
    }

    [Fact]
    public void SafeMetadata_UnknownAndSecretKeysDropped()
    {
        var raw = new Dictionary<string, string?>
        {
            ["operation"] = "Host.Ping",
            ["password"] = "hunter2",
            ["apiKey"] = "sk-live",
            ["token"] = "abc",
            ["phonebook"] = "[{name:x}]",
            ["invoices"] = "[{}]",
            ["customerRecord"] = "full",
            ["mystery"] = "nope",
            ["correlationId"] = "C-" + new string('b', 32),
            ["code"] = "SYS-HOST-UNSCOPED"
        };
        var clean = SafeMetadataPolicy.Sanitize(raw);
        Assert.True(clean.ContainsKey("operation"));
        Assert.True(clean.ContainsKey("correlationId"));
        Assert.True(clean.ContainsKey("code"));
        Assert.False(clean.ContainsKey("password"));
        Assert.False(clean.ContainsKey("apiKey"));
        Assert.False(clean.ContainsKey("token"));
        Assert.False(clean.ContainsKey("phonebook"));
        Assert.False(clean.ContainsKey("invoices"));
        Assert.False(clean.ContainsKey("customerRecord"));
        Assert.False(clean.ContainsKey("mystery"));
        Assert.Equal(MetadataClass.Forbidden, SafeMetadataPolicy.ClassifyKey("loginPw"));
        Assert.Equal(MetadataClass.Forbidden, SafeMetadataPolicy.ClassifyKey("lb"));
        Assert.Equal(MetadataClass.Safe, SafeMetadataPolicy.ClassifyKey("correlationId"));
    }

    [Fact]
    public void SafeMetadata_RedactsSecretAssignments()
    {
        var text = SafeMetadataPolicy.Redact("failed password=hunter2 token=abc Bearer abcdef.ghij secret=zz");
        Assert.DoesNotContain("hunter2", text, StringComparison.Ordinal);
        Assert.DoesNotContain("abcdef", text, StringComparison.Ordinal);
        Assert.Contains("password=***", text, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("Bearer ***", text, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task Jsonl_AppendsOneUtf8ObjectPerLine()
    {
        using var tmp = new TempDiag();
        var store = tmp.Store();
        store.Append(SampleEvent(tmp.CorrA, "SYS-HOST-UNSCOPED"));
        store.Append(SampleEvent(tmp.CorrB, "SYS-DESK-UNSCOPED"));
        var bytes = await File.ReadAllBytesAsync(tmp.EventsPath);
        Assert.NotEqual(0xEF, bytes[0]);
        Assert.Equal((byte)'{', bytes[0]);
        var lines = File.ReadAllLines(tmp.EventsPath, new UTF8Encoding(false));
        Assert.Equal(2, lines.Length);
        Assert.StartsWith("{", lines[0], StringComparison.Ordinal);
        Assert.StartsWith("{", lines[1], StringComparison.Ordinal);
        Assert.DoesNotContain('\n', lines[0]);
        Assert.False(File.Exists(tmp.PrintHistoryPath));
        Assert.DoesNotContain("sirman.sqlite", tmp.EventsPath, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void Jsonl_SkipsMalformedHistoricalLines()
    {
        using var tmp = new TempDiag();
        var store = tmp.Store();
        store.Append(SampleEvent(tmp.CorrA, "SYS-HOST-UNSCOPED", "good-1"));
        File.AppendAllText(tmp.EventsPath, "NOT-JSON\n", new UTF8Encoding(false));
        store.Append(SampleEvent(tmp.CorrA, "SYS-HOST-UNSCOPED", "good-2"));
        var read = store.ReadChronological();
        Assert.Equal(2, read.Count);
        Assert.Equal("good-1", read[0].Operation);
        Assert.Equal("good-2", read[1].Operation);
        Assert.True(File.Exists(tmp.EventsPath + FileDiagnosticStore.CorruptCopySuffix));
        var preserved = File.ReadAllText(tmp.EventsPath + FileDiagnosticStore.CorruptCopySuffix);
        Assert.Contains("NOT-JSON", preserved, StringComparison.Ordinal);
    }

    [Fact]
    public void Jsonl_RotatesByLineCap_WithoutTouchingPrintHistory()
    {
        using var tmp = new TempDiag();
        var store = new FileDiagnosticStore(tmp.Dir, rotateMaxLines: 3, rotateBytes: 8L * 1024 * 1024);
        for (var i = 0; i < 4; i++)
            store.Append(SampleEvent(tmp.CorrA, "SYS-HOST-UNSCOPED", "rot-" + i));
        Assert.True(File.Exists(tmp.EventsPath + ".1"));
        Assert.True(File.Exists(tmp.EventsPath));
        var currentLines = File.ReadAllLines(tmp.EventsPath).Count(l => !string.IsNullOrWhiteSpace(l));
        Assert.Equal(1, currentLines);
        var rotated = File.ReadAllLines(tmp.EventsPath + ".1").Count(l => !string.IsNullOrWhiteSpace(l));
        Assert.Equal(3, rotated);
        Assert.Equal(4, store.ReadChronological().Count);
        Assert.False(File.Exists(tmp.PrintHistoryPath));
        File.WriteAllText(tmp.PrintHistoryPath, "{\"print\":\"must-stay\"}\n");
        store.Append(SampleEvent(tmp.CorrB, "SYS-HOST-UNSCOPED", "after-print-marker"));
        Assert.Equal("{\"print\":\"must-stay\"}\n", File.ReadAllText(tmp.PrintHistoryPath));
    }

    [Fact]
    public async Task QueryRecent_ReturnsNewestFirstWithLimit()
    {
        using var tmp = new TempDiag();
        var store = tmp.Store();
        store.Append(SampleEvent(tmp.CorrA, "SYS-HOST-UNSCOPED", "first"));
        store.Append(SampleEvent(tmp.CorrB, "SYS-DESK-UNSCOPED", "second"));
        store.Append(SampleEvent(tmp.CorrA, "SYS-HOST-UNSCOPED", "third"));
        var recent = await store.QueryRecentAsync(new DiagnosticQuery { Limit = 2 });
        Assert.Equal(2, recent.Count);
        Assert.Equal("third", recent[0].Operation);
        Assert.Equal("second", recent[1].Operation);
        var hostOnly = await store.QueryRecentAsync(new DiagnosticQuery { Module = DiagnosticModule.Host, Limit = 50 });
        Assert.All(hostOnly, e => Assert.Equal(DiagnosticModule.Host, e.Module));
    }

    [Fact]
    public async Task GetByCorrelationId_ReturnsChronologicalMatch()
    {
        using var tmp = new TempDiag();
        var store = tmp.Store();
        store.Append(SampleEvent(tmp.CorrA, "SYS-HOST-UNSCOPED", "a1"));
        store.Append(SampleEvent(tmp.CorrB, "SYS-DESK-UNSCOPED", "b1"));
        store.Append(SampleEvent(tmp.CorrA, "SYS-HOST-UNSCOPED", "a2"));
        var matched = await store.GetByCorrelationIdAsync(tmp.CorrA);
        Assert.Equal(2, matched.Count);
        Assert.Equal("a1", matched[0].Operation);
        Assert.Equal("a2", matched[1].Operation);
        Assert.Empty(await store.GetByCorrelationIdAsync("C-" + new string('f', 32)));
    }

    [Fact]
    public void ExceptionCapture_SanitizesDataAndAssignsCorrelation()
    {
        using var tmp = new TempDiag();
        var service = new DiagnosticService(tmp.Store(), "1405.6.16α", "1405.6.16.1");
        var ex = new InvalidOperationException("boom password=secret123");
        ex.Data["password"] = "hunter2";
        ex.Data["apiKey"] = "sk-live";
        ex.Data["operation"] = "Desktop.UiThread";
        ex.Data["phonebook"] = "[{\"name\":\"shop-customer\"}]";
        var ctx = new DiagnosticContext
        {
            Operation = "Desktop.UiThread",
            Source = DiagnosticSource.Desktop,
            Module = DiagnosticModule.System
        };
        Assert.True(service.TryRecordException(ex, ctx, out var evt, out var error));
        Assert.Null(error);
        Assert.NotNull(evt);
        Assert.True(CorrelationId.IsWellFormed(evt!.CorrelationId));
        Assert.Equal(ErrorCatalog.SysDeskUnscoped, evt.Code);
        Assert.Equal("System.InvalidOperationException", evt.ExceptionType);
        Assert.DoesNotContain("hunter2", evt.TechnicalMessage ?? "", StringComparison.Ordinal);
        Assert.DoesNotContain("secret123", evt.TechnicalMessage ?? "", StringComparison.Ordinal);
        Assert.False(evt.Metadata.ContainsKey("password"));
        Assert.False(evt.Metadata.ContainsKey("apiKey"));
        Assert.False(evt.Metadata.ContainsKey("phonebook"));
        Assert.Equal("Desktop.UiThread", evt.Metadata["operation"]);
        var disk = File.ReadAllText(tmp.EventsPath);
        Assert.DoesNotContain("hunter2", disk, StringComparison.Ordinal);
        Assert.DoesNotContain("shop-customer", disk, StringComparison.Ordinal);
        Assert.DoesNotContain("sk-live", disk, StringComparison.Ordinal);
    }

    [Fact]
    public void HostDiagnosticMethods_JsonContracts_AndPermissions()
    {
        using var tmp = new TempDiag();
        var store = tmp.Store();
        var service = new DiagnosticService(store, "1405.6.16α", "1405.6.16.1");
        var facade = new DiagnosticFacade(service, store, tmp.SupportDir);
        store.Append(SampleEvent(tmp.CorrA, "SYS-HOST-UNSCOPED", "host-op"));

        using var minted = JsonDocument.Parse(facade.NewCorrelationId());
        Assert.True(minted.RootElement.GetProperty("ok").GetBoolean());
        Assert.True(CorrelationId.IsWellFormed(minted.RootElement.GetProperty("correlationId").GetString()));

        using var recent = JsonDocument.Parse(facade.GetRecentDiagnostics("{\"limit\":10}"));
        Assert.True(recent.RootElement.GetProperty("ok").GetBoolean());
        Assert.True(recent.RootElement.GetProperty("count").GetInt32() >= 1);

        using var incident = JsonDocument.Parse(facade.GetDiagnosticIncident(tmp.CorrA));
        Assert.True(incident.RootElement.GetProperty("ok").GetBoolean());
        Assert.Equal(tmp.CorrA, incident.RootElement.GetProperty("incident").GetProperty("correlationId").GetString());
        Assert.Equal("SYS-HOST-UNSCOPED", incident.RootElement.GetProperty("result").GetProperty("code").GetString());
        Assert.False(string.IsNullOrWhiteSpace(incident.RootElement.GetProperty("result").GetProperty("whatHappened").GetString()));

        using var missing = JsonDocument.Parse(facade.GetDiagnosticIncident("C-" + new string('c', 32)));
        Assert.False(missing.RootElement.GetProperty("ok").GetBoolean());
        Assert.Equal("not-found", missing.RootElement.GetProperty("error").GetString());

        Assert.Contains("NewDiagnosticCorrelationId", PermissionCatalog.AlwaysAllowedHostMethods);
        Assert.Equal("Audit.View", PermissionCatalog.PermissionForHostMethod("GetRecentDiagnostics"));
        Assert.Equal("Audit.View", PermissionCatalog.PermissionForHostMethod("GetDiagnosticIncident"));
        Assert.Equal("Audit.View", PermissionCatalog.PermissionForHostMethod("ExportDiagnosticReport"));

        var gate = new HostSecurityGate();
        var tech = new AuthSession
        {
            Authenticated = true,
            PasswordConfigured = true,
            RoleKey = "service",
            Pages = new[] { "warranty" }
        };
        Assert.True(gate.Authorize(tech, "NewDiagnosticCorrelationId").Ok);
        Assert.False(gate.Authorize(tech, "GetRecentDiagnostics").Ok);
        var auditor = new AuthSession
        {
            Authenticated = true,
            PasswordConfigured = true,
            RoleKey = "service",
            Pages = new[] { "audit" }
        };
        Assert.True(gate.Authorize(auditor, "GetRecentDiagnostics").Ok);
        Assert.True(gate.Authorize(auditor, "ExportDiagnosticReport").Ok);
    }

    [Fact]
    public async Task Export_WritesPackWithoutFilesystemPathOrBusinessDump()
    {
        using var tmp = new TempDiag();
        var store = tmp.Store();
        var service = new DiagnosticService(store);
        var facade = new DiagnosticFacade(service, store, tmp.SupportDir);
        store.Append(SampleEvent(tmp.CorrA, "SYS-HOST-UNSCOPED", "export-me"));
        using var doc = JsonDocument.Parse(facade.ExportDiagnosticReport(tmp.CorrA));
        Assert.True(doc.RootElement.GetProperty("ok").GetBoolean());
        Assert.Equal("diagnostics/support", doc.RootElement.GetProperty("folder").GetString());
        var fileName = doc.RootElement.GetProperty("fileName").GetString();
        Assert.False(string.IsNullOrWhiteSpace(fileName));
        Assert.DoesNotContain(":", fileName, StringComparison.Ordinal);
        Assert.DoesNotContain("/", fileName, StringComparison.Ordinal);
        Assert.DoesNotContain("\\", fileName, StringComparison.Ordinal);
        Assert.False(doc.RootElement.TryGetProperty("path", out _));
        var json = doc.RootElement.GetRawText();
        Assert.DoesNotContain(tmp.Dir, json, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain(tmp.SupportDir, json, StringComparison.OrdinalIgnoreCase);

        var exported = await store.ExportIncidentAsync(tmp.CorrA, tmp.SupportDir);
        Assert.True(exported.Ok);
        var packPath = Path.Combine(tmp.SupportDir, exported.FileName!);
        var pack = await File.ReadAllTextAsync(packPath);
        Assert.Contains("SIRMAN_DIAGNOSTIC_PACK", pack, StringComparison.Ordinal);
        Assert.DoesNotContain("\"phonebook\":", pack, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("\"invoices\":", pack, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("\"password\":", pack, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("sirman.sqlite", pack, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void Store_RejectsBusinessDumpPayload()
    {
        using var tmp = new TempDiag();
        var store = tmp.Store();
        var evt = SampleEvent(tmp.CorrA, "SYS-HOST-UNSCOPED", "leak");
        evt.TechnicalMessage = "{\"invoices\":[{\"total\":1}],\"phonebook\":[]}";
        var ok = store.TryAppend(evt, out var error);
        Assert.False(ok);
        Assert.False(string.IsNullOrWhiteSpace(error));
        Assert.False(File.Exists(tmp.EventsPath));
    }

    [Fact]
    public void SalesModuleEvent_IsNotTreatedAsBusinessDump()
    {
        using var tmp = new TempDiag();
        var store = tmp.Store();
        var evt = SampleEvent(tmp.CorrA, "SYS-HOST-UNSCOPED", "future-p1");
        evt.Module = DiagnosticModule.Sales;
        store.Append(evt);
        var read = store.ReadChronological();
        Assert.Single(read);
        Assert.Equal(DiagnosticModule.Sales, read[0].Module);
    }

    [Fact]
    public void SafeError_EnvelopeUnchanged()
    {
        var json = SafeError.Json("business-failed", "محاسبه انجام نشد", new InvalidOperationException("inner"));
        using var doc = JsonDocument.Parse(json);
        Assert.False(doc.RootElement.GetProperty("ok").GetBoolean());
        Assert.Equal("business-failed", doc.RootElement.GetProperty("error").GetString());
        Assert.Equal("محاسبه انجام نشد", doc.RootElement.GetProperty("message").GetString());
        Assert.Equal(3, doc.RootElement.EnumerateObject().Count());
        Assert.False(doc.RootElement.TryGetProperty("exception", out _));
        Assert.False(doc.RootElement.TryGetProperty("stack", out _));
    }

    [Fact]
    public void Catalog_ReservesNamespaces_WithoutBusinessNumericCodes()
    {
        Assert.Equal("INV", DiagnosticCodeNamespaces.Inventory);
        Assert.Equal("SAL", DiagnosticCodeNamespaces.Sales);
        Assert.Equal("WAR", DiagnosticCodeNamespaces.Warranty);
        Assert.Equal("PRN", DiagnosticCodeNamespaces.Print);
        Assert.Equal("DAT", DiagnosticCodeNamespaces.Data);
        Assert.Equal("SYS", DiagnosticCodeNamespaces.System);
        var codes = ErrorCatalog.All.Select(r => r.Code).ToArray();
        Assert.Contains(ErrorCatalog.SysDeskUnscoped, codes);
        Assert.Contains(ErrorCatalog.SysHostUnscoped, codes);
        Assert.Contains(ErrorCatalog.SysWebViewUnscoped, codes);
        Assert.Contains(ErrorCatalog.SysUiUnscoped, codes);
        Assert.All(codes, c => Assert.StartsWith("SYS-", c, StringComparison.Ordinal));
        Assert.DoesNotContain(codes, c => c.StartsWith("INV-", StringComparison.Ordinal));
        Assert.DoesNotContain(codes, c => c.StartsWith("SAL-", StringComparison.Ordinal));
        Assert.Equal(ErrorCatalog.SysHostUnscoped, ErrorCatalog.Require("business-failed").Code);
        Assert.Equal(ErrorCatalog.SysWebViewUnscoped, ErrorCatalog.Require("webview2-failed").Code);
    }

    [Fact]
    public void GuidanceEngine_IsDeterministic()
    {
        var events = new[] { SampleEvent("C-" + new string('d', 32), "SYS-HOST-UNSCOPED", "op") };
        var incident = IncidentProjector.FromEvents(events);
        var a = GuidanceEngine.ToResult(incident, events);
        var b = GuidanceEngine.ToResult(incident, events);
        Assert.Equal(a.Code, b.Code);
        Assert.Equal(a.WhatHappened, b.WhatHappened);
        Assert.Equal(a.UserAction, b.UserAction);
        Assert.Equal(a.SupportReference, b.SupportReference);
        Assert.False(a.Succeeded);
    }

    [Fact]
    public void DesktopHooks_AreInstalledAndDoNotSwallow()
    {
        var runtime = File.ReadAllText(Path.Combine(DesktopDir, "DiagnosticRuntime.cs"));
        Assert.Contains("Application.ThreadException", runtime, StringComparison.Ordinal);
        Assert.Contains("UnhandledException", runtime, StringComparison.Ordinal);
        Assert.Contains("UnobservedTaskException", runtime, StringComparison.Ordinal);
        Assert.Contains("ProcessFailed", runtime, StringComparison.Ordinal);
        Assert.DoesNotContain("SetObserved(", runtime, StringComparison.Ordinal);
        Assert.DoesNotContain("SetUnhandledExceptionMode", runtime, StringComparison.Ordinal);
        var program = File.ReadAllText(Path.Combine(DesktopDir, "Program.cs"));
        Assert.Contains("DiagnosticRuntime.InstallProcessHooks()", program, StringComparison.Ordinal);
        var main = File.ReadAllText(Path.Combine(DesktopDir, "MainForm.cs"));
        Assert.Contains("AttachWebView2", main, StringComparison.Ordinal);
        Assert.Contains("PublishNavigationFailure", main, StringComparison.Ordinal);
        var host = File.ReadAllText(Path.Combine(DesktopDir, "SirmanHostObject.cs"));
        Assert.Contains("GetRecentDiagnostics", host, StringComparison.Ordinal);
        Assert.Contains("GetDiagnosticIncident", host, StringComparison.Ordinal);
        Assert.Contains("ExportDiagnosticReport", host, StringComparison.Ordinal);
        Assert.Contains("NewDiagnosticCorrelationId", host, StringComparison.Ordinal);
        Assert.Contains("HostFail", host, StringComparison.Ordinal);
        Assert.Contains("SafeError.Json", host, StringComparison.Ordinal);
    }

    [Fact]
    public void Html_WasNotGivenDiagnosticLogic()
    {
        var htmlPath = Path.Combine(RepoRoot, "Sirman_Final.html");
        Assert.True(File.Exists(htmlPath), htmlPath);
        var html = File.ReadAllText(htmlPath);
        Assert.DoesNotContain("IDiagnosticStore", html, StringComparison.Ordinal);
        Assert.DoesNotContain("FileDiagnosticStore", html, StringComparison.Ordinal);
        Assert.DoesNotContain("events.jsonl", html, StringComparison.Ordinal);
        Assert.DoesNotContain("SYS-DESK-UNSCOPED", html, StringComparison.Ordinal);
        Assert.DoesNotContain("GetRecentDiagnostics", html, StringComparison.Ordinal);
        Assert.DoesNotContain("ExportDiagnosticReport", html, StringComparison.Ordinal);
    }

    static DiagnosticEvent SampleEvent(string correlationId, string code, string operation = "op")
    {
        var def = ErrorCatalog.Require(code);
        return new DiagnosticEvent
        {
            EventId = Guid.NewGuid().ToString("N"),
            CorrelationId = correlationId,
            Severity = def.Severity,
            Code = def.Code,
            Module = def.Module,
            Operation = operation,
            Outcome = OperationOutcome.Failed,
            Success = false,
            DataImpact = def.DataImpact,
            Source = DiagnosticSource.Host,
            AppVersion = "1405.6.16α",
            AssemblyVersion = "1405.6.16.1",
            ExceptionType = "System.InvalidOperationException",
            TechnicalMessage = "synthetic-test"
        };
    }

    sealed class TempDiag : IDisposable
    {
        public string Dir { get; }
        public string EventsPath { get; }
        public string PrintHistoryPath { get; }
        public string SupportDir { get; }
        public string CorrA { get; } = CorrelationId.New().Value;
        public string CorrB { get; } = CorrelationId.New().Value;

        public TempDiag()
        {
            Dir = Path.Combine(Path.GetTempPath(), "sirman-diag-p0-" + Guid.NewGuid().ToString("N"));
            Directory.CreateDirectory(Dir);
            EventsPath = FileDiagnosticStore.DefaultFilePath(Dir);
            PrintHistoryPath = Path.Combine(Dir, FileDiagnosticStore.RelativeDirectory, FileDiagnosticStore.PrintHistoryFileName);
            SupportDir = Path.Combine(Dir, FileDiagnosticStore.RelativeDirectory, "support");
        }

        public FileDiagnosticStore Store() => new(Dir);

        public void Dispose()
        {
            try { Directory.Delete(Dir, recursive: true); } catch { /* test temp */ }
        }
    }
}
