using Sirman.Core.Application;

namespace Sirman.Desktop;

/// <summary>نشست امنیتی همان پروسهٔ exe — یک نمونه، بدون سرویس موازی.</summary>
public static class DesktopSecurity
{
    public static SecurityFacade Current { get; } = new();
    public static BusinessFacade Business { get; } = new();
}
