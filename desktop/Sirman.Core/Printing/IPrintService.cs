namespace Sirman.Core.Printing;

/// <summary>
/// قرارداد چاپ برای ماژول‌های کسب‌وکار.
/// پیاده‌سازی ویندوز (اسپولر، درایور، پورت، WebView2.PrintAsync) پشت این مرز می‌ماند.
/// چاپ داده کسب‌وکار را تغییر نمی‌دهد — فقط READ → FORMAT → PRINT.
/// شناسه کار چاپ <c>printJobId</c> است، نه InvoiceNumber.
/// </summary>
public interface IPrintService
{
    /// <summary>فهرست چاپگرهای نصب‌شده. چاپگر جعلی ساخته نمی‌شود.</summary>
    string ListPrintersJson();

    /// <summary>
    /// ارسال HTML برای چاپ کاغذ (<paramref name="purpose"/>=print) یا خروجی فایل (<paramref name="purpose"/>=pdf).
    /// این دو مسیر یکی نیستند. موفقیت PDF موفقیت چاپ فیزیکی نیست.
    /// </summary>
    string Enqueue(
        string html,
        string printerName,
        string paper,
        string orientation,
        int copies,
        string documentId,
        string documentType,
        string user,
        string purpose);

    /// <summary>وضعیت یک کار چاپ با شناسه مستقل printJobId.</summary>
    string GetJobJson(string printJobId);
}
