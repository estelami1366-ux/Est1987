using System.Text.Json.Nodes;
using Sirman.Core.Printing;
using Xunit;

namespace Sirman.Core.Tests;

public class NativePrintTests
{
    [Theory]
    [InlineData("HP LaserJet Pro", true)]
    [InlineData("Microsoft Print to PDF", false)]
    [InlineData("Microsoft XPS Document Writer", false)]
    public void PrinterEnumeration_MapsPhysicalVsVirtual(string name, bool physical)
    {
        Assert.Equal(physical, PrintHardwareFacts.TreatAsPhysicalPrint(name));
        Assert.Equal(physical ? PrintHardwareFacts.Physical : PrintHardwareFacts.Virtual, PrintHardwareFacts.DisplayClass(name));
    }

    [Theory]
    [InlineData("A4 landscape", "", "A4", true, 827, 1169)]
    [InlineData("A4", "landscape", "A4", true, 827, 1169)]
    [InlineData("A4", "portrait", "A4", false, 827, 1169)]
    [InlineData("A5 landscape", "", "A5", true, 583, 827)]
    [InlineData("A5", "", "A5", false, 583, 827)]
    [InlineData("80mm", "", "80mm", false, 315, 787)]
    [InlineData("label", "", "label", false, 394, 591)]
    public void PaperOrientation_MapsFromUiValues(string paper, string orientation, string name, bool landscape, int w, int h)
    {
        var spec = NativePrintLayout.ParsePaper(paper, orientation);
        Assert.Equal(name, spec.Name);
        Assert.Equal(landscape, spec.Landscape);
        Assert.Equal(w, spec.WidthHundredthsInch);
        Assert.Equal(h, spec.HeightHundredthsInch);
    }

    [Fact]
    public void Copies_ClampAndValidate()
    {
        Assert.Equal(1, NativePrintLayout.ClampCopies(0));
        Assert.Equal(20, NativePrintLayout.ClampCopies(99));
        Assert.Equal(3, NativePrintLayout.ClampCopies(3));
        Assert.True(NativePrintLayout.TryParseCopies("2", out var n, out _));
        Assert.Equal(2, n);
        Assert.False(NativePrintLayout.TryParseCopies("0", out _, out var err0));
        Assert.Contains("کپی", err0);
        Assert.False(NativePrintLayout.TryParseCopies("21", out _, out _));
    }

    [Fact]
    public void Pagination_PageCountFromLines()
    {
        Assert.Equal(12, NativePrintLayout.LinesPerPageForPaper("A4", landscape: true));
        Assert.Equal(18, NativePrintLayout.LinesPerPageForPaper("A4", landscape: false));
        Assert.Equal(12, NativePrintLayout.LinesPerPageForPaper("80mm", landscape: false));
        var per = NativePrintLayout.LinesPerPageForPaper("80mm", false);
        Assert.Equal(9, NativePrintLayout.PageCount(100, per));
        Assert.Equal(1, NativePrintLayout.PageCount(0, per));
        Assert.Equal(1, NativePrintLayout.PageCount(5, per));
        Assert.Equal(2, NativePrintLayout.PageCount(13, per));
    }

    [Fact]
    public void JobIdentity_WellFormedPjPrefix()
    {
        for (var i = 0; i < 20; i++)
            Assert.True(PrintJobIdentity.IsWellFormed(PrintJobIdentity.Create()));
        Assert.False(PrintJobIdentity.IsWellFormed(""));
        Assert.False(PrintJobIdentity.IsWellFormed("INV-1"));
        Assert.False(PrintJobIdentity.IsWellFormed("PJ-SHORT"));
        Assert.False(PrintJobIdentity.IsWellFormed("PJ-zzzzzzzzzzzz"));
        Assert.True(PrintJobIdentity.IsWellFormed("PJ-0123456789ab"));
    }

    [Fact]
    public void TestPage_ParseSucceeds()
    {
        var json = """{"kind":"testPage","engine":"native","printerName":"HP Laser","paper":"A4","copies":1}""";
        Assert.True(NativePrintRequest.TryParse(json, out var req, out var err), err);
        Assert.Equal(NativePrintRequest.KindTestPage, req.Kind);
        Assert.NotNull(req.TestPage);
        Assert.Equal("SIRMAN NATIVE PRINT TEST", req.TestPage!.Title);
        Assert.Equal("آزمایش چاپ سیرمان", req.TestPage.TitleFa);
        Assert.Equal("۱۲۳۴۵۶789", req.TestPage.MixedSample);
        Assert.Equal(1, req.Copies);
        Assert.True(req.IsNativePaper);
    }

    [Fact]
    public void Invoice_ParseFromGetDataShape()
    {
        var json = """
        {
          "kind":"invoice","engine":"native","paper":"A4 landscape","landscape":true,"copies":2,
          "num":"1001","seller":"علی","phone":"0912","date":"1405/05/31","status":"closed",
          "notes":"یادداشت","brandFa":"سیرمان","logoSrc":"data:image/png;base64,AAA",
          "tE":1000,"tD":100,"tF":900,
          "items":[
            {"num":1,"code":"TV1","model":"سامسونگ","date":"1405/01/01","color":"مشکی","carton":"سالم",
             "body":"سالم","dmg":"خط","acc":["ریموت","کابل"],"miss":"پایه","perf":"تعویض شد",
             "swapped":true,"newSerial":"NS-9","warranty":"بله","svc":"تعمیر","pd":"توضیح","est":1000,"disc":10,"fin":900}
          ]
        }
        """;
        Assert.True(NativePrintRequest.TryParse(json, out var req, out var err), err);
        Assert.Equal(NativePrintRequest.KindInvoice, req.Kind);
        Assert.Equal(2, req.Copies);
        var spec = NativePrintLayout.ParsePaper(req.Paper, req.Orientation);
        Assert.True(spec.Landscape);
        Assert.Equal("A4", spec.Name);
        var inv = req.Invoice!;
        Assert.Equal("1001", inv.Number);
        Assert.Equal("علی", inv.Seller);
        Assert.Equal(1000, inv.TotalEst);
        Assert.Equal(100, inv.TotalDisc);
        Assert.Equal(900, inv.TotalFin);
        Assert.Equal("data:image/png;base64,AAA", inv.LogoDataUrl);
        Assert.Single(inv.Lines);
        var line = inv.Lines[0];
        Assert.True(line.Swapped);
        Assert.Equal("تعویض", line.PerfCell);
        Assert.Contains("سالم", line.BodyCell);
        Assert.Contains("خط", line.BodyCell);
        Assert.Contains("ریموت", line.Acc);
        Assert.Equal("NS-9", line.NewSerial);
        Assert.Contains("نو: NS-9", line.NoteCell);
    }

    [Fact]
    public void Invoice_RejectsMissingSellerAndLines()
    {
        Assert.False(NativePrintRequest.TryParse("""{"kind":"invoice","items":[{"code":"A"}]}""", out _, out var sellerErr));
        Assert.Equal("نام فروشنده الزامی است", sellerErr);
        Assert.False(NativePrintRequest.TryParse("""{"kind":"invoice","seller":"علی","items":[]}""", out _, out var lineErr));
        Assert.Equal("دستگاهی ثبت نشده", lineErr);
    }

    [Fact]
    public void CopiesOutOfRange_FailsValidation()
    {
        Assert.False(NativePrintRequest.TryParse("""{"kind":"testPage","copies":0}""", out _, out var err0));
        Assert.Contains("کپی", err0);
        Assert.False(NativePrintRequest.TryParse("""{"kind":"testPage","copies":21}""", out _, out _));
    }

    [Fact]
    public void LooksNative_RequiresStructuredPaperNotPdf()
    {
        Assert.True(NativePrintRequest.LooksNative(JsonNode.Parse("""{"engine":"native","kind":"invoice"}""")!.AsObject()));
        Assert.True(NativePrintRequest.LooksNative(JsonNode.Parse("""{"kind":"testPage"}""")!.AsObject()));
        Assert.True(NativePrintRequest.LooksNative(JsonNode.Parse("""{"kind":"invoice"}""")!.AsObject()));
        Assert.False(NativePrintRequest.LooksNative(JsonNode.Parse("""{"engine":"native","purpose":"pdf","kind":"invoice"}""")!.AsObject()));
        Assert.False(NativePrintRequest.LooksNative(JsonNode.Parse("""{"kind":"invoice","html":"<div/>"}""")!.AsObject()));
        Assert.False(NativePrintRequest.LooksNative(JsonNode.Parse("""{"kind":"warranty"}""")!.AsObject()));
    }

    [Fact]
    public void EmptyJson_Fails()
    {
        Assert.False(NativePrintRequest.TryParse("", out _, out var err));
        Assert.Equal("سندی برای چاپ نیست", err);
        Assert.False(NativePrintRequest.TryParse("""{"kind":"warranty"}""", out _, out var kindErr));
        Assert.Equal("نوع سند بومی پشتیبانی نمی‌شود", kindErr);
    }
}
