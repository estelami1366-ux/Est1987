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

    [Fact]
    public void A4_SelectsInstalledKindForm()
    {
        var installed = new[]
        {
            new NativePrintLayout.PaperFormCandidate("Letter", 1, 1),
            new NativePrintLayout.PaperFormCandidate("A4", NativePrintLayout.IsoA4Kind, NativePrintLayout.IsoA4Kind),
            new NativePrintLayout.PaperFormCandidate("A4", 0, 0)
        };
        Assert.True(NativePrintLayout.TrySelectInstalledIsoForm("A4", installed, out var i));
        Assert.Equal(1, i);
        Assert.Equal(NativePrintLayout.IsoA4Kind, installed[i].Kind);
        Assert.True(NativePrintLayout.IsIsoA4OrA5("A4 landscape"));
    }

    [Fact]
    public void A5_SelectsInstalledKindForm()
    {
        var installed = new[]
        {
            new NativePrintLayout.PaperFormCandidate("A5", NativePrintLayout.IsoA5Kind, NativePrintLayout.IsoA5Kind)
        };
        Assert.True(NativePrintLayout.TrySelectInstalledIsoForm("A5", installed, out var i));
        Assert.Equal(0, i);
        Assert.Equal(NativePrintLayout.IsoA5Kind, installed[i].Kind);
        Assert.True(NativePrintLayout.IsIsoA4OrA5("A5"));
    }

    [Fact]
    public void A4_FallsBackToRawKindThenName()
    {
        var rawOnly = new[]
        {
            new NativePrintLayout.PaperFormCandidate("ISO A4", 0, NativePrintLayout.IsoA4Kind)
        };
        Assert.True(NativePrintLayout.TrySelectInstalledIsoForm("A4", rawOnly, out var iRaw));
        Assert.Equal(0, iRaw);

        var nameOnly = new[]
        {
            new NativePrintLayout.PaperFormCandidate("A4", 0, 0)
        };
        Assert.True(NativePrintLayout.TrySelectInstalledIsoForm("A4", nameOnly, out var iName));
        Assert.Equal(0, iName);
        Assert.True(NativePrintLayout.IsoNameMatches("A4 (210 x 297 mm)", "A4"));
    }

    [Fact]
    public void LabelAnd80mm_KeepCustomPath()
    {
        var a4 = new[] { new NativePrintLayout.PaperFormCandidate("A4", NativePrintLayout.IsoA4Kind, NativePrintLayout.IsoA4Kind) };
        Assert.True(NativePrintLayout.RequiresCustomPaperForm("label"));
        Assert.True(NativePrintLayout.RequiresCustomPaperForm("80mm"));
        Assert.True(NativePrintLayout.RequiresCustomPaperForm("custom"));
        Assert.False(NativePrintLayout.IsIsoA4OrA5("label"));
        Assert.False(NativePrintLayout.IsIsoA4OrA5("80mm"));
        Assert.False(NativePrintLayout.TrySelectInstalledIsoForm("label", a4, out var iLabel));
        Assert.Equal(-1, iLabel);
        Assert.False(NativePrintLayout.TrySelectInstalledIsoForm("80mm", a4, out _));
        Assert.Equal("label", NativePrintLayout.ParsePaper("label", "").Name);
        Assert.Equal("80mm", NativePrintLayout.ParsePaper("80mm", "").Name);
        Assert.Equal(394, NativePrintLayout.ParsePaper("label", "").WidthHundredthsInch);
        Assert.Equal(315, NativePrintLayout.ParsePaper("80mm", "").WidthHundredthsInch);
    }

    [Fact]
    public void StandardFormMissing_SignalsCustomFallback()
    {
        Assert.False(NativePrintLayout.TrySelectInstalledIsoForm("A4", Array.Empty<NativePrintLayout.PaperFormCandidate>(), out var i));
        Assert.Equal(-1, i);
        Assert.True(NativePrintLayout.IsIsoA4OrA5("A4"));
        Assert.False(NativePrintLayout.RequiresCustomPaperForm("A4"));
    }

    [Fact]
    public void PostalLabel_ParseSucceedsWithEmptyOptionals()
    {
        var json = """{"kind":"postalLabel","engine":"native","paper":"A5","copies":1}""";
        Assert.True(NativePrintRequest.TryParse(json, out var req, out var err), err);
        Assert.Equal(NativePrintRequest.KindPostalLabel, req.Kind);
        Assert.NotEqual(NativePrintRequest.KindInvoice, req.Kind);
        Assert.NotEqual(NativePrintRequest.KindTestPage, req.Kind);
        Assert.NotNull(req.PostalLabel);
        Assert.Null(req.Invoice);
        Assert.Null(req.TestPage);
        Assert.Equal("", req.PostalLabel!.Sender.Addr);
        Assert.Equal("", req.PostalLabel.Recipient.Name);
        Assert.True(req.PostalLabel.Border);
        Assert.True(req.PostalLabel.Fragile);
        Assert.Equal("10mm", req.PostalLabel.Margin);
        Assert.Equal(1, req.Copies);
        Assert.True(req.IsNativePaper);
    }

    [Fact]
    public void PostalLabel_ParseKeepsPersianAddressAndLtrPostalCode()
    {
        var json = """
        {
          "kind":"postalLabel","engine":"native","paper":"A5","copies":3,
          "sender":{"addr":"تهران، خیابان انقلاب","zip":"2000-35155","tel":"021111","person":"مسئول"},
          "recipient":{"name":"علی رضایی","addr":"اصفهان، خیابان چهارباغ، پلاک ۱۲","zip":"81400-11111","tel":"031222","note":"شکستنی"}
        }
        """;
        Assert.True(NativePrintRequest.TryParse(json, out var req, out var err), err);
        Assert.Equal(NativePrintRequest.KindPostalLabel, req.Kind);
        Assert.Equal(3, req.Copies);
        var postal = req.PostalLabel!;
        Assert.Equal("2000-35155", postal.Sender.Zip);
        Assert.Equal("تهران، خیابان انقلاب", postal.Sender.Addr);
        Assert.Equal("اصفهان، خیابان چهارباغ، پلاک ۱۲", postal.Recipient.Addr);
        Assert.Equal("علی رضایی", postal.Recipient.Name);
        Assert.Equal("شکستنی", postal.Recipient.Note);
        var presented = NativePrintBidi.AsLeftToRight(postal.Sender.Zip);
        Assert.Equal("2000-35155", NativePrintBidi.Unwrap(presented));
        Assert.Contains("2000-35155", presented, StringComparison.Ordinal);
        Assert.DoesNotContain("35155-2000", presented, StringComparison.Ordinal);
        Assert.StartsWith("\u202A", presented);
        Assert.EndsWith("\u202C", presented);
        Assert.Equal("35155-2000", NativePrintBidi.ReverseHyphenated("2000-35155"));
        Assert.Equal("اصفهان، خیابان چهارباغ، پلاک ۱۲", postal.Recipient.Addr);
    }

    [Fact]
    public void PostalLabel_InvalidKindStillRejectedAndPdfIsNotNative()
    {
        Assert.False(NativePrintRequest.TryParse("""{"kind":"warranty"}""", out _, out var kindErr));
        Assert.Equal("نوع سند بومی پشتیبانی نمی‌شود", kindErr);
        Assert.False(NativePrintRequest.TryParse("""{"kind":"postalLabel","copies":0}""", out _, out var copyErr));
        Assert.Contains("کپی", copyErr);
        Assert.True(NativePrintRequest.LooksNative(JsonNode.Parse("""{"kind":"postalLabel"}""")!.AsObject()));
        Assert.True(NativePrintRequest.LooksNative(JsonNode.Parse("""{"engine":"native","kind":"postalLabel"}""")!.AsObject()));
        Assert.False(NativePrintRequest.LooksNative(JsonNode.Parse("""{"kind":"postalLabel","html":"<div/>"}""")!.AsObject()));
        Assert.False(NativePrintRequest.LooksNative(JsonNode.Parse("""{"engine":"native","purpose":"pdf","kind":"postalLabel"}""")!.AsObject()));
        var parsed = JsonNode.Parse("""{"engine":"native","kind":"postalLabel","purpose":"pdf"}""")!.AsObject();
        Assert.True(NativePrintRequest.TryParse(parsed.ToJsonString(), out var req, out _));
        Assert.False(req.IsNativePaper);
    }

    [Fact]
    public void PostalLabel_CustomLabelDimensionsDoNotOverrideA4A5()
    {
        Assert.True(NativePrintRequest.TryParse(
            """{"kind":"postalLabel","paper":"label","copies":2,"widthMm":50,"heightMm":30}""",
            out var labelReq, out var err), err);
        Assert.Equal(2, labelReq.Copies);
        Assert.Equal(50, labelReq.WidthMm);
        Assert.Equal(30, labelReq.HeightMm);
        var labelSpec = NativePrintLayout.WithExplicitMillimeters(
            NativePrintLayout.ParsePaper(labelReq.Paper, labelReq.Orientation),
            labelReq.WidthMm, labelReq.HeightMm);
        Assert.Equal("label", labelSpec.Name);
        Assert.Equal(NativePrintLayout.MillimetersToHundredthsInch(50), labelSpec.WidthHundredthsInch);
        Assert.Equal(NativePrintLayout.MillimetersToHundredthsInch(30), labelSpec.HeightHundredthsInch);

        Assert.True(NativePrintRequest.TryParse(
            """{"kind":"postalLabel","paper":"A5","widthMm":50,"heightMm":30}""",
            out var a5Req, out var a5Err), a5Err);
        var a5 = NativePrintLayout.ParsePaper(a5Req.Paper, a5Req.Orientation);
        var a5Kept = NativePrintLayout.WithExplicitMillimeters(a5, a5Req.WidthMm, a5Req.HeightMm);
        Assert.Equal("A5", a5Kept.Name);
        Assert.Equal(a5.WidthHundredthsInch, a5Kept.WidthHundredthsInch);
        Assert.Equal(a5.HeightHundredthsInch, a5Kept.HeightHundredthsInch);
        Assert.True(NativePrintLayout.IsIsoA4OrA5("A5"));
        Assert.False(NativePrintLayout.RequiresCustomPaperForm("A5"));
    }

    [Fact]
    public void PaperResolver_PostalDefaultIsA5_UnsetIsNotImplicitA4()
    {
        var spec = new DocumentPrintSpec(
            Kind: NativePrintRequest.KindPostalLabel,
            Paper: null,
            Orientation: null,
            Margin: null,
            Copies: 1,
            Scale: 100,
            WidthMm: 0,
            HeightMm: 0,
            PaperExplicit: false,
            PrintCenterExplicit: false);
        var resolved = NativePrintPaper.Resolve(spec);
        Assert.Equal("A5", resolved.Name);
        Assert.False(resolved.Landscape);
        Assert.Equal(10f, resolved.MarginMm);
        Assert.Equal(1, resolved.Copies);
        Assert.Equal(NativePrintPaper.SourceDocumentDefault, resolved.Source);
        Assert.Equal(NativePrintLayout.IsoA5Kind, resolved.PaperKind);

        Assert.True(NativePrintRequest.TryParse("""{"kind":"postalLabel","engine":"native","copies":1}""", out var req, out var err), err);
        Assert.Equal("", req.Paper);
        Assert.False(req.PaperExplicit);
        var fromReq = NativePrintPaper.Resolve(NativePrintPaper.FromRequest(req));
        Assert.Equal("A5", fromReq.Name);
        Assert.NotEqual("A4", fromReq.Name);
    }

    [Fact]
    public void PaperResolver_PostalExplicitA4_AndProfileA4WithoutExplicitStaysA5()
    {
        var explicitA4 = new DocumentPrintSpec(
            NativePrintRequest.KindPostalLabel, "A4", "portrait", "10mm", 2, 100, 0, 0,
            PaperExplicit: true, PrintCenterExplicit: false);
        var got = NativePrintPaper.Resolve(explicitA4);
        Assert.Equal("A4", got.Name);
        Assert.False(got.Landscape);
        Assert.Equal(2, got.Copies);
        Assert.Equal(10f, got.MarginMm);
        Assert.Equal(NativePrintPaper.SourceUserDocument, got.Source);

        var profileLeak = new DocumentPrintSpec(
            NativePrintRequest.KindPostalLabel, "A4", "portrait", null, 1, 100, 0, 0,
            PaperExplicit: false, PrintCenterExplicit: false);
        var leaked = NativePrintPaper.Resolve(profileLeak);
        Assert.Equal("A5", leaked.Name);
        Assert.Equal(NativePrintPaper.SourceDocumentDefault, leaked.Source);

        Assert.True(NativePrintRequest.TryParse(
            """{"kind":"postalLabel","engine":"native","paper":"A4","paperExplicit":false,"copies":1}""",
            out var leakReq, out var err), err);
        Assert.False(leakReq.PaperExplicit);
        Assert.Equal("A5", NativePrintPaper.Resolve(NativePrintPaper.FromRequest(leakReq)).Name);
    }

    [Fact]
    public void PaperResolver_InvoiceAndTestPageDefaultsUnchanged()
    {
        var invoice = NativePrintPaper.Resolve(new DocumentPrintSpec(
            NativePrintRequest.KindInvoice, null, null, "8mm", 1, 100, 0, 0, false, false));
        Assert.Equal("A4", invoice.Name);
        Assert.True(invoice.Landscape);
        Assert.Equal(8f, invoice.MarginMm);
        Assert.Equal(NativePrintPaper.SourceDocumentDefault, invoice.Source);

        var test = NativePrintPaper.Resolve(new DocumentPrintSpec(
            NativePrintRequest.KindTestPage, null, null, null, 1, 100, 0, 0, false, false));
        Assert.Equal("A4", test.Name);
        Assert.False(test.Landscape);
        Assert.Equal(8f, test.MarginMm);

        Assert.True(NativePrintRequest.TryParse(
            """{"kind":"testPage","engine":"native","paper":"A4","copies":1}""",
            out var testReq, out _), "test page with paper stays A4");
        Assert.True(testReq.PaperExplicit);
        Assert.Equal("A4", NativePrintPaper.Resolve(NativePrintPaper.FromRequest(testReq)).Name);
    }

    [Fact]
    public void PaperResolver_InstalledIsoFormsAndCustomMmAndOrientation()
    {
        var installed = new NativePrintLayout.PaperFormCandidate[]
        {
            new("Letter", 1, 1),
            new("A4", NativePrintLayout.IsoA4Kind, NativePrintLayout.IsoA4Kind),
            new("A5", NativePrintLayout.IsoA5Kind, NativePrintLayout.IsoA5Kind)
        };
        var a4 = NativePrintPaper.Resolve(new DocumentPrintSpec(
            NativePrintRequest.KindTestPage, "A4", "portrait", "8mm", 3, 100, 0, 0, true, false), installed);
        Assert.Equal("A4", a4.Name);
        Assert.Equal(1, a4.InstalledFormIndex);
        Assert.Equal(NativePrintLayout.IsoA4Kind, a4.PaperKind);
        Assert.Equal(NativePrintLayout.IsoA4Kind, a4.RawKind);
        Assert.Equal(NativePrintPaper.SourceInstalledForm, a4.Source);
        Assert.Equal(3, a4.Copies);
        Assert.False(a4.Landscape);

        var a5 = NativePrintPaper.Resolve(new DocumentPrintSpec(
            NativePrintRequest.KindPostalLabel, "A5", "landscape", "10mm", 1, 100, 0, 0, true, false), installed);
        Assert.Equal("A5", a5.Name);
        Assert.True(a5.Landscape);
        Assert.Equal(2, a5.InstalledFormIndex);
        Assert.Equal(NativePrintLayout.IsoA5Kind, a5.PaperKind);
        Assert.Equal(NativePrintPaper.SourceInstalledForm, a5.Source);
        Assert.Equal(10f, a5.MarginMm);

        var custom = NativePrintPaper.Resolve(new DocumentPrintSpec(
            NativePrintRequest.KindPostalLabel, "label", "", "10mm", 1, 100, 50, 30, true, false));
        Assert.Equal("label", custom.Name);
        Assert.Equal(NativePrintPaper.SourceCustomFallback, custom.Source);
        Assert.Equal(NativePrintLayout.MillimetersToHundredthsInch(50), custom.WidthHundredthsInch);
        Assert.Equal(NativePrintLayout.MillimetersToHundredthsInch(30), custom.HeightHundredthsInch);
        Assert.Equal(-1, custom.InstalledFormIndex);
    }
}
