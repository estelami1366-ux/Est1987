namespace Sirman.Core.Printing;

/// <summary>
/// قرارداد چاپ برای ماژول‌های کسب‌وکار.
/// پیاده‌سازی ویندوز (اسپولر، درایور، PrintDocument بومی) پشت این مرز می‌ماند.
/// چاپ داده کسب‌وکار را تغییر نمی‌دهد — فقط READ → FORMAT → PRINT.
/// شناسه کار چاپ <c>printJobId</c> است، نه InvoiceNumber.
/// </summary>
public interface IPrintService
{
    /// <summary>فهرست چاپگرهای نصب‌شده. چاپگر جعلی ساخته نمی‌شود.</summary>
    string ListPrintersJson();

    /// <summary>
    /// ارسال HTML برای خروجی فایل (<paramref name="purpose"/>=pdf) یا اسناد کاغذ هنوز مهاجرت‌نشده.
    /// مسیر کاغذ تولیدی فاکتور/صفحه آزمایشی از <see cref="EnqueueNative"/> می‌گذرد.
    /// موفقیت PDF موفقیت چاپ فیزیکی نیست.
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

    /// <summary>
    /// چاپ کاغذ بومی: JSON ساخت‌یافته (نه HTML) برای صفحه آزمایشی و فاکتور.
    /// رندر پشت مرز Desktop با PrintDocument انجام می‌شود.
    /// </summary>
    string EnqueueNative(
        string documentJson,
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
