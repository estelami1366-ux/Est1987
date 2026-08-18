using Sirman.Core.Printing;
using Xunit;

namespace Sirman.Core.Tests;

public class PrintStatusContractTests
{
    [Theory]
    [InlineData("PRINT_REQUESTED", null, null, PrintStatusContract.NotStarted)]
    [InlineData("", "NO_PRINTER", "print", PrintStatusContract.PrinterNotFound)]
    [InlineData("PRINT_FAILED", "PRINTER_NOT_FOUND", "print", PrintStatusContract.PrinterNotFound)]
    [InlineData("PRINT_FAILED", "PRINTER_UNAVAILABLE", "print", PrintStatusContract.PrinterResolutionFailed)]
    [InlineData("PRINT_FAILED", "PDF_NOT_PRINT", "print", PrintStatusContract.PrinterResolutionFailed)]
    [InlineData("PRINT_FAILED", "PRINT_SPOOLER_FAILED", "print", PrintStatusContract.SpoolerUnavailable)]
    [InlineData("PRINT_SUBMITTED", null, "print", PrintStatusContract.Submitted)]
    [InlineData("QUEUED", null, "print", PrintStatusContract.Queued)]
    [InlineData("PRINTING", null, "print", PrintStatusContract.Printing)]
    [InlineData("PRINT_COMPLETED", null, "print", PrintStatusContract.Completed)]
    [InlineData("PRINT_FAILED", "PRINT_ASYNC_FAILED", "print", PrintStatusContract.Failed)]
    [InlineData("PDF_EXPORTED", null, "pdf", PrintStatusContract.PdfExported)]
    public void Normalize_MapsLegacyWithoutBoolean(string status, string? code, string? purpose, string expected)
    {
        Assert.Equal(expected, PrintStatusContract.Normalize(status, code, purpose));
    }

    [Fact]
    public void Submitted_IsNeverPhysicalVerifiedWithoutHumanPaper()
    {
        var contract = PrintStatusContract.Normalize("PRINT_SUBMITTED", null, "print");
        Assert.Equal(PrintStatusContract.Submitted, contract);
        Assert.Equal(
            PrintStatusContract.PhysicalPrintNotVerified,
            PrintStatusContract.PhysicalStatus(contract, "print", paperVerified: false));
        Assert.NotEqual("PRINT SUCCESS", contract);
    }

    [Fact]
    public void PdfExport_IsNeverPhysicalVerified()
    {
        var contract = PrintStatusContract.Normalize("PDF_EXPORTED", null, "pdf");
        Assert.Equal(PrintStatusContract.PdfExported, contract);
        Assert.Equal(
            PrintStatusContract.PhysicalPrintNotVerified,
            PrintStatusContract.PhysicalStatus(contract, "pdf", paperVerified: true));
    }

    [Fact]
    public void Annotate_KeepsLegacyStatus_AddsContractFields()
    {
        var raw = "{\"ok\":true,\"status\":\"PRINT_SUBMITTED\",\"printJobId\":\"PJ-abc\",\"purpose\":\"print\"}";
        var annotated = PrintStatusContract.Annotate(raw);
        Assert.Contains("\"status\":\"PRINT_SUBMITTED\"", annotated);
        Assert.Contains("\"contractStatus\":\"SUBMITTED\"", annotated);
        Assert.Contains("\"physicalPrintStatus\":\"PHYSICAL_PRINT_NOT_VERIFIED\"", annotated);
        Assert.Contains("\"printJobIdentity\":\"PJ-abc\"", annotated);
    }

    [Fact]
    public void Annotate_DoesNotThrowOnGarbage()
    {
        Assert.Equal("not-json", PrintStatusContract.Annotate("not-json"));
        Assert.Equal("", PrintStatusContract.Annotate(""));
    }

    [Fact]
    public void HumanPaper_CanMarkVerified_OnlyOnPhysicalPath()
    {
        var verified = PrintStatusContract.PhysicalStatus(PrintStatusContract.Submitted, "print", paperVerified: true);
        Assert.Equal(PrintStatusContract.PhysicalPrintVerified, verified);
        var pdf = PrintStatusContract.PhysicalStatus(PrintStatusContract.Submitted, "pdf", paperVerified: true);
        Assert.Equal(PrintStatusContract.PhysicalPrintNotVerified, pdf);
    }
}
