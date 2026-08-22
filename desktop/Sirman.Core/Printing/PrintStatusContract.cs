using System.Text.Json;
using System.Text.Json.Nodes;

namespace Sirman.Core.Printing;

/// <summary>
/// قرارداد وضعیت چاپ برای مصرف‌کننده‌های کسب‌وکار.
/// وضعیت میراث مرکز پرینت (PRINT_SUBMITTED و غیره) عوض نمی‌شود؛
/// این لایه فقط فیلدهای قرارداد را اضافه می‌کند.
/// موفقیت PDF هرگز چاپ کاغذ نیست.
/// </summary>
public static class PrintStatusContract
{
    public const string NotStarted = "NOT_STARTED";
    public const string PrinterNotFound = "PRINTER_NOT_FOUND";
    public const string PrinterResolutionFailed = "PRINTER_RESOLUTION_FAILED";
    public const string SpoolerUnavailable = "SPOOLER_UNAVAILABLE";
    public const string Submitted = "SUBMITTED";
    public const string Queued = "QUEUED";
    public const string Printing = "PRINTING";
    public const string Completed = "COMPLETED";
    public const string Failed = "FAILED";
    public const string PhysicalPrintNotVerified = "PHYSICAL_PRINT_NOT_VERIFIED";
    public const string PhysicalPrintVerified = "PHYSICAL_PRINT_VERIFIED";
    public const string PdfExported = "PDF_EXPORTED";

    /// <summary>
    /// نگاشت وضعیت/کد میراث موتور چاپ به وضعیت قرارداد.
    /// true/false خام برنمی‌گرداند.
    /// </summary>
    public static string Normalize(string? status, string? errorCode, string? purpose = null)
    {
        var code = (errorCode ?? "").Trim();
        var st = (status ?? "").Trim();
        var pdf = string.Equals(purpose, "pdf", StringComparison.OrdinalIgnoreCase)
            || string.Equals(st, "PDF_EXPORTED", StringComparison.OrdinalIgnoreCase);

        if (code is "NO_PRINTER" or "PRINTER_NOT_FOUND" or "HARDWARE_NOT_DETECTED")
            return PrinterNotFound;
        if (code is "NO_DEFAULT_PRINTER" or "PRINTER_UNAVAILABLE" or "PDF_NOT_PRINT" or "PRINTER_NOT_RESOLVED")
            return PrinterResolutionFailed;
        if (code is "PRINT_SPOOLER_FAILED" or "SPOOLER_UNAVAILABLE" or "SPOOLER_REJECTED_JOB")
            return SpoolerUnavailable;
        if (code is "NATIVE_PRINT_FAILED")
            return Failed;
        if (st is "PRINT_FAILED" or "FAILED")
            return Failed;
        if (st is "PRINTING")
            return Printing;
        if (st is "QUEUED")
            return Queued;
        if (st is "PRINT_SUBMITTED" or "SUBMITTED")
            return Submitted;
        if (st is "PRINT_COMPLETED" or "COMPLETED")
            return pdf ? PdfExported : Completed;
        if (st is "PDF_EXPORTED")
            return PdfExported;
        if (st is "PRINT_REQUESTED" or "CREATED" or "")
            return string.IsNullOrEmpty(code) ? NotStarted : Failed;
        if (!string.IsNullOrEmpty(code))
            return Failed;
        return NotStarted;
    }

    /// <summary>
    /// تأیید کاغذ فقط با شاهد انسانی. ارسال به صف = هنوز تأیید نشده.
    /// مسیر PDF هرگز PHYSICAL_PRINT_VERIFIED نمی‌شود.
    /// </summary>
    public static string PhysicalStatus(string contractStatus, string? purpose, bool paperVerified)
    {
        if (string.Equals(purpose, "pdf", StringComparison.OrdinalIgnoreCase)
            || contractStatus == PdfExported)
            return PhysicalPrintNotVerified;
        if (paperVerified && contractStatus is Submitted or Queued or Printing or Completed)
            return PhysicalPrintVerified;
        return PhysicalPrintNotVerified;
    }

    /// <summary>
    /// فیلدهای قرارداد را روی JSON موجود می‌گذارد؛ status میراث را حذف نمی‌کند.
    /// اگر JSON خراب باشد همان متن برمی‌گردد — استثنا به لایه کسب‌وکار پرتاب نمی‌شود.
    /// </summary>
    public static string Annotate(string json, bool paperVerified = false)
    {
        if (string.IsNullOrWhiteSpace(json))
            return json;
        try
        {
            var node = JsonNode.Parse(json) as JsonObject;
            if (node is null) return json;
            var status = node["status"]?.GetValue<string>();
            var errorCode = node["errorCode"]?.GetValue<string>() ?? node["error"]?.GetValue<string>();
            var purpose = node["purpose"]?.GetValue<string>();
            var contract = Normalize(status, errorCode, purpose);
            node["contractStatus"] = contract;
            node["physicalPrintStatus"] = PhysicalStatus(contract, purpose, paperVerified);
            if (node["printJobId"] is JsonValue jobId)
                node["printJobIdentity"] = jobId.GetValue<string>();
            return node.ToJsonString();
        }
        catch
        {
            return json;
        }
    }
}
