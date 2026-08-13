using System.Threading;

namespace Sirman.Desktop;

static class Program
{
    private static Mutex? _mutex;

    [STAThread]
    static void Main(string[] args)
    {
        // فقط یک نمونه از برنامه باز بماند
        const string mutexName = "Global\\SirmanDesktopSingleInstance_v1";
        _mutex = new Mutex(true, mutexName, out bool createdNew);
        if (!createdNew)
        {
            MessageBox.Show(
                "سیرمان از قبل باز است.",
                "سیرمان",
                MessageBoxButtons.OK,
                MessageBoxIcon.Information);
            return;
        }

        ApplicationConfiguration.Initialize();
        Application.EnableVisualStyles();
        Application.SetCompatibleTextRenderingDefault(false);

        try
        {
            Application.Run(new MainForm(args));
        }
        finally
        {
            try { _mutex?.ReleaseMutex(); } catch { /* ignore */ }
            _mutex?.Dispose();
        }
    }
}
