namespace Sirman.Core.Printing;

/// <summary>
/// طبقه‌بندی قابل‌تست چاپگر/پورت/شکست — بدون Win32 و بدون داده کسب‌وکار.
/// مسیر تشخیص سخت‌افزار از این حقایق استفاده می‌کند؛ مرکز پرینت را عوض نمی‌کند.
/// </summary>
public static class PrintHardwareFacts
{
    public const string Physical = "PHYSICAL";
    public const string Virtual = "VIRTUAL";

    public static string ClassifyKind(string? printerName)
    {
        var n = (printerName ?? "").Trim().ToLowerInvariant();
        if (n.Length == 0) return "unknown";
        if (n.Contains("pdf", StringComparison.Ordinal)) return "pdf";
        if (n.Contains("xps", StringComparison.Ordinal)) return "xps";
        if (n.Contains("fax", StringComparison.Ordinal)) return "fax";
        if (n.Contains("onenote", StringComparison.Ordinal)) return "onenote";
        if (n.Contains("send to", StringComparison.Ordinal)) return "virtual";
        return "physical";
    }

    public static bool IsVirtualPrinter(string? printerName)
    {
        var kind = ClassifyKind(printerName);
        return kind is not "physical" and not "unknown";
    }

    public static string DisplayClass(string? printerName) =>
        IsVirtualPrinter(printerName) ? Virtual : Physical;

    public static bool TreatAsPhysicalPrint(string? printerName) =>
        ClassifyKind(printerName) == "physical";

    public static string ClassifyPort(string? portName)
    {
        var p = (portName ?? "").Trim();
        if (p.Length == 0) return "NOT_AVAILABLE";
        var u = p.ToUpperInvariant();
        if (u.StartsWith("FILE", StringComparison.Ordinal) || u.Contains("PORTPROMPT") || u.Contains("XPS"))
            return "FILE";
        if (u.Contains("USB") || u.Contains("DOT4")) return "USB";
        if (u.Contains("WSD")) return "WSD";
        if (u.StartsWith("IP_") || u.Contains("TCP") || u.Contains("WSDPORT") || LooksIpv4(p))
            return "TCP/IP";
        if (u.StartsWith(@"\\") || u.Contains("SMB") || u.StartsWith("NE")) return "Network";
        return "Other";
    }

    public static string MapJobStatus(uint winStatus, string? pStatus)
    {
        const uint JOB_STATUS_PAUSED = 0x00000001;
        const uint JOB_STATUS_ERROR = 0x00000002;
        const uint JOB_STATUS_DELETING = 0x00000004;
        const uint JOB_STATUS_SPOOLING = 0x00000008;
        const uint JOB_STATUS_PRINTING = 0x00000010;
        const uint JOB_STATUS_OFFLINE = 0x00000020;
        const uint JOB_STATUS_PAPEROUT = 0x00000040;
        const uint JOB_STATUS_PRINTED = 0x00000080;
        const uint JOB_STATUS_DELETED = 0x00000100;
        const uint JOB_STATUS_BLOCKED = 0x00000200;
        const uint JOB_STATUS_USER_INTERVENTION = 0x00000400;
        if ((winStatus & JOB_STATUS_DELETED) != 0 || (winStatus & JOB_STATUS_DELETING) != 0)
            return "DELETED";
        if ((winStatus & JOB_STATUS_ERROR) != 0 || (winStatus & JOB_STATUS_OFFLINE) != 0
            || (winStatus & JOB_STATUS_PAPEROUT) != 0 || (winStatus & JOB_STATUS_BLOCKED) != 0
            || (winStatus & JOB_STATUS_USER_INTERVENTION) != 0)
            return "FAILED";
        if ((winStatus & JOB_STATUS_PRINTED) != 0) return "COMPLETED";
        if ((winStatus & JOB_STATUS_PRINTING) != 0) return "PRINTING";
        if ((winStatus & JOB_STATUS_SPOOLING) != 0 || (winStatus & JOB_STATUS_PAUSED) != 0)
            return "QUEUED";
        if (!string.IsNullOrWhiteSpace(pStatus)) return "UNKNOWN";
        return "CREATED";
    }

    public static string ClassifyFailure(
        bool windowsOk,
        bool spoolerOk,
        int physicalCount,
        int printerCount,
        bool resolved,
        bool selectedVirtual,
        string? directResult,
        string? queueState,
        string? webviewResult,
        bool paperVerified)
    {
        if (!windowsOk) return "UNKNOWN_PRINT_FAILURE";
        if (!spoolerOk) return "SPOOLER_UNAVAILABLE";
        if (printerCount <= 0) return "HARDWARE_NOT_DETECTED";
        if (physicalCount <= 0) return "PDF_ONLY_PATH";
        if (selectedVirtual) return "PDF_ONLY_PATH";
        if (!resolved) return "PRINTER_NOT_RESOLVED";
        if (string.Equals(directResult, "SPOOLER_REJECTED_JOB", StringComparison.OrdinalIgnoreCase))
            return "SPOOLER_REJECTED_JOB";
        if (string.Equals(directResult, "FAIL", StringComparison.OrdinalIgnoreCase)
            || string.Equals(directResult, "DIRECT_PRINT_FAILED", StringComparison.OrdinalIgnoreCase))
            return "DIRECT_PRINT_FAILED";
        if (string.Equals(webviewResult, "FAIL", StringComparison.OrdinalIgnoreCase)
            || string.Equals(webviewResult, "WEBVIEW2_PRINT_FAILED", StringComparison.OrdinalIgnoreCase))
            return "WEBVIEW2_PRINT_FAILED";
        if (string.Equals(queueState, "FAILED", StringComparison.OrdinalIgnoreCase)
            || string.Equals(queueState, "DELETED", StringComparison.OrdinalIgnoreCase))
            return "PRINTER_QUEUE_FAILED";
        if (string.Equals(directResult, "PRINT_SUBMITTED", StringComparison.OrdinalIgnoreCase) && !paperVerified)
            return "PHYSICAL_PRINT_NOT_VERIFIED";
        if (string.Equals(directResult, "PRINT_SUBMITTED", StringComparison.OrdinalIgnoreCase) && paperVerified)
            return "PHYSICAL_PRINT_VERIFIED";
        return "UNKNOWN_PRINT_FAILURE";
    }

    private static bool LooksIpv4(string p)
    {
        var parts = p.Split('.', StringSplitOptions.RemoveEmptyEntries);
        if (parts.Length < 4) return false;
        return int.TryParse(parts[0], out var a) && a is >= 0 and <= 255;
    }
}
