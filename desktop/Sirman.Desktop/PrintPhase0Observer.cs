using System.Text;

namespace Sirman.Desktop;

/// <summary>
/// مشاهده‌گر فاز ۰ — فقط ثبت فایل، بدون تغییر رفتار چاپ.
/// به موتور منجمد (<c>WindowsPrintHost</c> / آداپتر / Host.PrintHtml) وصل نمی‌شود.
/// نقطهٔ اتصال: <see cref="MainForm.EnqueueHtmlPrint"/> از بیرون مسیر منجمد.
/// نتیجهٔ موتور کاغذ از قبل در <c>print-jobs.jsonl</c> همان پوشه ثبت می‌شود.
/// </summary>
internal static class PrintPhase0Observer
{
    public const string FileName = "PHASE_0_OBSERVE.log";

    public static string LogPath() =>
        Path.Combine(AppPaths.AppDataRoot, "print", FileName);

    public static void Observe(string stage, string detail)
    {
        try
        {
            var dir = Path.Combine(AppPaths.AppDataRoot, "print");
            Directory.CreateDirectory(dir);
            var line = string.Join('\t',
                DateTimeOffset.Now.ToString("o"),
                Environment.MachineName,
                stage ?? "",
                Sanitize(detail));
            File.AppendAllText(LogPath(), line + Environment.NewLine, Encoding.UTF8);
        }
        catch
        {
            /* logging must not break print */
        }
    }

    internal static string Sanitize(string? detail)
    {
        if (string.IsNullOrEmpty(detail)) return "";
        var s = detail.Replace('\n', ' ').Replace('\r', ' ').Replace('\t', ' ');
        return s.Length <= 800 ? s : s[..800] + "…";
    }
}
