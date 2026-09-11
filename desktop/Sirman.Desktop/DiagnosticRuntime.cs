using System.Reflection;
using Microsoft.Web.WebView2.Core;
using Sirman.Core.Diagnostics;

namespace Sirman.Desktop;

/// <summary>
/// Process-wide diagnostic wiring. Store writes never throw into business/UI paths.
/// </summary>
internal static class DiagnosticRuntime
{
    static readonly object Gate = new();
    static DiagnosticService? _service;
    static DiagnosticFacade? _facade;
    static FileDiagnosticStore? _store;
    static bool _hooks;

    public static DiagnosticService Service
    {
        get
        {
            Ensure();
            return _service!;
        }
    }

    public static DiagnosticFacade Facade
    {
        get
        {
            Ensure();
            return _facade!;
        }
    }

    public static void Ensure()
    {
        lock (Gate)
        {
            if (_service != null) return;
            var root = AppPaths.AppDataRoot;
            _store = new FileDiagnosticStore(root);
            var (app, asm) = Versions();
            _service = new DiagnosticService(_store, app, asm);
            var export = Path.Combine(root, FileDiagnosticStore.RelativeDirectory, "support");
            _facade = new DiagnosticFacade(_service, _store, export);
        }
    }

    public static void InstallProcessHooks()
    {
        Ensure();
        if (_hooks) return;
        _hooks = true;
        Application.ThreadException += (_, e) =>
        {
            Publish(e.Exception, "Desktop.UiThread", DiagnosticSource.Desktop, DiagnosticModule.System);
        };
        AppDomain.CurrentDomain.UnhandledException += (_, e) =>
        {
            if (e.ExceptionObject is Exception ex)
                Publish(ex, "Desktop.Unhandled", DiagnosticSource.Desktop, DiagnosticModule.System);
        };
        TaskScheduler.UnobservedTaskException += (_, e) =>
        {
            Publish(e.Exception, "Desktop.Task", DiagnosticSource.Desktop, DiagnosticModule.System);
            // Preserve existing crash-on-unobserved behavior (do not mark the exception observed).
        };
    }

    public static void AttachWebView2(CoreWebView2 webView)
    {
        if (webView == null) return;
        Ensure();
        webView.ProcessFailed += (_, e) =>
        {
            var ex = new InvalidOperationException("WebView2.ProcessFailed:" + e.ProcessFailedKind);
            Publish(ex, "WebView2.ProcessFailed", DiagnosticSource.Desktop, DiagnosticModule.System);
        };
    }

    public static void PublishNavigationFailure(int httpStatus, string? reason)
    {
        var ex = new InvalidOperationException("WebView2.NavigationFailed status=" + httpStatus + " " + (reason ?? ""));
        Publish(ex, "WebView2.Navigation", DiagnosticSource.Desktop, DiagnosticModule.System);
    }

    public static void PublishHostFailure(string method, Exception ex, string? correlationId = null)
    {
        Publish(ex, method, DiagnosticSource.Host, DiagnosticModule.Host, correlationId);
    }

    public static void Publish(Exception ex, string operation, DiagnosticSource source, DiagnosticModule module, string? correlationId = null)
    {
        try
        {
            Ensure();
            var (app, asm) = Versions();
            var ctx = new DiagnosticContext
            {
                CorrelationId = correlationId ?? "",
                Operation = operation,
                Source = source,
                Module = module,
                AppVersion = app,
                AssemblyVersion = asm,
                Os = System.Runtime.InteropServices.RuntimeInformation.OSDescription,
                Runtime = System.Runtime.InteropServices.RuntimeInformation.FrameworkDescription
            };
            _service!.TryRecordException(ex, ctx, out _, out _);
        }
        catch
        {
            /* diagnostics must never throw into the app */
        }
    }

    static (string? app, string? asm) Versions()
    {
        try
        {
            var a = typeof(DiagnosticRuntime).Assembly;
            var asm = a.GetName().Version?.ToString();
            var info = a.GetCustomAttribute<AssemblyInformationalVersionAttribute>()?.InformationalVersion;
            return (info ?? asm, asm);
        }
        catch
        {
            return (null, null);
        }
    }
}
