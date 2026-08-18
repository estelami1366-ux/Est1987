using Sirman.Core.Infrastructure;
using Sirman.Core.Printing;

namespace Sirman.Desktop;

/// <summary>
/// پوشش نازک روی <see cref="WindowsPrintHost"/> — بازنویسی مرکز پرینت نیست.
/// خطا اینجا می‌ماند و به فاکتور/انبار/حساب پرتاب نمی‌شود.
/// تشخیص سخت‌افزار از این قرارداد جداست.
/// </summary>
internal sealed class PrintServiceAdapter : IPrintService
{
    private readonly WindowsPrintHost _inner;

    public PrintServiceAdapter(WindowsPrintHost inner) =>
        _inner = inner ?? throw new ArgumentNullException(nameof(inner));

    public string ListPrintersJson()
    {
        try
        {
            return _inner.ListPrinters();
        }
        catch (Exception ex)
        {
            return SafeError.Json("printer-list", "خواندن فهرست چاپگر انجام نشد", ex);
        }
    }

    public string Enqueue(
        string html,
        string printerName,
        string paper,
        string orientation,
        int copies,
        string documentId,
        string documentType,
        string user,
        string purpose)
    {
        try
        {
            return PrintStatusContract.Annotate(
                _inner.Enqueue(html, printerName, paper, orientation, copies, documentId, documentType, user, purpose));
        }
        catch (Exception ex)
        {
            return PrintStatusContract.Annotate(
                SafeError.Json("PRINT_ASYNC_FAILED", "چاپ انجام نشد: " + ex.Message, ex));
        }
    }

    public string GetJobJson(string printJobId)
    {
        try
        {
            return PrintStatusContract.Annotate(_inner.GetJob(printJobId));
        }
        catch (Exception ex)
        {
            return PrintStatusContract.Annotate(
                SafeError.Json("PRINT_ASYNC_FAILED", "وضعیت چاپ خوانده نشد: " + ex.Message, ex));
        }
    }
}
