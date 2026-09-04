using Sirman.Core.Printing;
using Xunit;

namespace Sirman.Core.Tests;

public class PrintHardwareFactsTests
{
    [Theory]
    [InlineData("HP LaserJet Pro", "physical")]
    [InlineData("Microsoft Print to PDF", "pdf")]
    [InlineData("Microsoft XPS Document Writer", "xps")]
    [InlineData("Fax", "fax")]
    [InlineData("OneNote (Desktop)", "onenote")]
    public void ClassifyKind_KnownNames(string name, string kind)
    {
        Assert.Equal(kind, PrintHardwareFacts.ClassifyKind(name));
    }

    [Fact]
    public void Pdf_IsNeverPhysicalPrint()
    {
        Assert.False(PrintHardwareFacts.TreatAsPhysicalPrint("Microsoft Print to PDF"));
        Assert.Equal(PrintHardwareFacts.Virtual, PrintHardwareFacts.DisplayClass("Microsoft Print to PDF"));
        Assert.True(PrintHardwareFacts.TreatAsPhysicalPrint("HP LaserJet"));
    }

    [Theory]
    [InlineData("USB001", "USB")]
    [InlineData("IP_192.168.1.20", "TCP/IP")]
    [InlineData("WSD-abc", "WSD")]
    [InlineData(@"\\office\hp", "Network")]
    [InlineData("FILE:", "FILE")]
    [InlineData("", "NOT_AVAILABLE")]
    public void ClassifyPort_DoesNotInvent(string port, string expected)
    {
        Assert.Equal(expected, PrintHardwareFacts.ClassifyPort(port));
    }

    [Fact]
    public void Failure_PdfOnlyWhenNoPhysical()
    {
        var code = PrintHardwareFacts.ClassifyFailure(
            windowsOk: true, spoolerOk: true, physicalCount: 0, printerCount: 1,
            resolved: false, selectedVirtual: true, directResult: "", queueState: "",
            webviewResult: "", paperVerified: false);
        Assert.Equal("PDF_ONLY_PATH", code);
    }

    [Fact]
    public void Failure_SubmittedIsNotPhysicalVerified()
    {
        var code = PrintHardwareFacts.ClassifyFailure(
            windowsOk: true, spoolerOk: true, physicalCount: 1, printerCount: 2,
            resolved: true, selectedVirtual: false, directResult: "PRINT_SUBMITTED",
            queueState: "QUEUED", webviewResult: "", paperVerified: false);
        Assert.Equal("PHYSICAL_PRINT_NOT_VERIFIED", code);
        Assert.NotEqual("PRINT SUCCESS", code);
    }

    [Fact]
    public void Failure_DirectVsWebViewIsolated()
    {
        var code = PrintHardwareFacts.ClassifyFailure(
            windowsOk: true, spoolerOk: true, physicalCount: 1, printerCount: 1,
            resolved: true, selectedVirtual: false, directResult: "PRINT_SUBMITTED",
            queueState: "PRINTING", webviewResult: "WEBVIEW2_PRINT_FAILED", paperVerified: false);
        Assert.Equal("WEBVIEW2_PRINT_FAILED", code);
    }

    [Fact]
    public void AlwaysAllowed_IncludesDiagnosticHostMethod()
    {
        Assert.Contains("RunPrintHardwareDiagnostic", Sirman.Core.Security.PermissionCatalog.AlwaysAllowedHostMethods);
        Assert.Contains("FinalizeBackup", Sirman.Core.Security.PermissionCatalog.AlwaysAllowedHostMethods);
        Assert.False(Sirman.Core.Security.PermissionCatalog.HostMethodPermission.ContainsKey("RunPrintHardwareDiagnostic"));
    }
}
