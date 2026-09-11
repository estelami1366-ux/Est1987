using Sirman.Core.Application;
using Sirman.Core.Diagnostics;

namespace Sirman.Desktop;

/// <summary>نشست امنیتی همان پروسهٔ exe — یک نمونه، بدون سرویس موازی.</summary>
public static class DesktopSecurity
{
    static readonly object Gate = new();
    static BusinessFacade? _business;

    public static SecurityFacade Current { get; } = new();

    public static BusinessFacade Business
    {
        get
        {
            if (_business != null) return _business;
            lock (Gate)
            {
                if (_business != null) return _business;
                DiagnosticRuntime.Ensure();
                _business = new BusinessFacade(DiagnosticRuntime.Service);
                return _business;
            }
        }
    }
}
