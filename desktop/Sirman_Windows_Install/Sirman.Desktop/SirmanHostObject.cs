using System.Runtime.InteropServices;

namespace Sirman.Desktop;

/// <summary>
/// شیء قابل‌فراخوانی از JavaScript داخل WebView2.
/// مطمئن‌تر از postMessage برای بستن پنجره.
/// </summary>
[ComVisible(true)]
[ClassInterface(ClassInterfaceType.AutoDual)]
public class SirmanHostObject
{
    private readonly MainForm _form;

    public SirmanHostObject(MainForm form) => _form = form;

    /// <summary>بستن فوری پنجرهٔ exe (بعد از بک‌آپ/خروج HTML).</summary>
    public void CloseApp() => _form.RequestForceClose();

    public void Notify(string title, string body) => _form.RequestNotify(title, body);

    public string Ping() => "sirman-host-ok";
}
