using System.Drawing.Printing;
using System.Globalization;
using System.Text;
using Sirman.Core.Printing;

namespace Sirman.Desktop;

/// <summary>
/// موتور چاپ کاغذ بومی: System.Drawing.Printing.PrintDocument.
/// HTML و WebView2 در این مسیر نیستند. رندر GDI است.
/// </summary>
internal static class NativeWindowsPrintService
{
    public static void Submit(PrintJobState job, NativePrintRequest request)
    {
        var spec = NativePrintLayout.ParsePaper(request.Paper, request.Orientation);
        var copies = NativePrintLayout.ClampCopies(request.Copies);
        using var doc = new PrintDocument();
        doc.PrinterSettings.PrinterName = job.Printer;
        doc.PrinterSettings.Copies = (short)copies;
        doc.DefaultPageSettings.Landscape = spec.Landscape;
        ApplyPaperSize(doc, spec);
        var marginMm = request.Invoice is null
            ? spec.MarginMm
            : NativePrintLayout.ParseMarginMm(request.Invoice.Margin, spec.MarginMm);
        var m = Math.Max(20, (int)(marginMm / 25.4f * 100));
        doc.DefaultPageSettings.Margins = new Margins(m, m, m, m);
        doc.PrintController = new StandardPrintController();
        doc.DocumentName = "SIRMAN " + request.Kind + " " + (request.DocumentId ?? "");

        var page = 0;
        var lineIndex = 0;
        Image? logo = TryLogo(request.Invoice?.LogoDataUrl);
        try
        {
            doc.PrintPage += (_, e) =>
            {
                page++;
                var g = e.Graphics;
                if (g is null)
                {
                    e.HasMorePages = false;
                    return;
                }
                g.TextRenderingHint = System.Drawing.Text.TextRenderingHint.AntiAlias;
                var bounds = e.MarginBounds;
                if (request.Kind == NativePrintRequest.KindTestPage)
                    e.HasMorePages = false;
                else
                    e.HasMorePages = DrawInvoicePage(g, bounds, request.Invoice!, spec, page, ref lineIndex, logo);
                if (request.Kind == NativePrintRequest.KindTestPage)
                    DrawTestPage(g, bounds, request.TestPage ?? new TestPagePrintModel(), spec, job.Printer);
            };
            job.Set("PRINTING", null, "در حال ارسال به صف چاپ ویندوز");
            job.Log("NATIVE_PRINT_STARTED", "PrintDocument " + job.Printer, job.Printer);
            doc.Print();
            job.Ok = true;
            job.Set("PRINT_SUBMITTED", null, "سند به صف چاپ ویندوز ارسال شد — " + job.Printer);
            job.Log("PRINT_SUBMITTED", "native spooler accepted", job.Printer);
        }
        finally
        {
            logo?.Dispose();
        }
    }

    /// <summary>
    /// A4/A5: use the driver-installed PaperSize (Kind / RawKind / name).
    /// 80mm, label, custom, or missing ISO form: keep constructed SIRMAN-* size.
    /// </summary>
    private static void ApplyPaperSize(PrintDocument doc, NativePrintLayout.PaperSpec spec)
    {
        if (NativePrintLayout.IsIsoA4OrA5(spec.Name))
        {
            var installed = new List<NativePrintLayout.PaperFormCandidate>();
            var sizes = new List<PaperSize>();
            foreach (PaperSize ps in doc.PrinterSettings.PaperSizes)
            {
                sizes.Add(ps);
                installed.Add(new NativePrintLayout.PaperFormCandidate(ps.PaperName, (int)ps.Kind, ps.RawKind));
            }
            if (NativePrintLayout.TrySelectInstalledIsoForm(spec.Name, installed, out var index)
                && index >= 0 && index < sizes.Count)
            {
                doc.DefaultPageSettings.PaperSize = sizes[index];
                return;
            }
        }

        try
        {
            doc.DefaultPageSettings.PaperSize = new PaperSize("SIRMAN-" + spec.Name, spec.WidthHundredthsInch, spec.HeightHundredthsInch);
        }
        catch
        {
            /* keep printer default paper if custom size is rejected */
        }
    }

    private static void DrawTestPage(Graphics g, Rectangle bounds, TestPagePrintModel model, NativePrintLayout.PaperSpec spec, string printer)
    {
        using var title = SafeFont("Tahoma", 18, FontStyle.Bold);
        using var body = SafeFont("Tahoma", 12, FontStyle.Regular);
        using var brush = new SolidBrush(Color.Black);
        using var rtl = RtlFormat();
        float y = bounds.Top;
        var w = bounds.Width;
        g.DrawString("SIRMAN NATIVE PRINT TEST", title, brush, new RectangleF(bounds.Left, y, w, 32), rtl);
        y += 40;
        var when = string.IsNullOrWhiteSpace(model.PrintedAt)
            ? DateTimeOffset.Now.ToString("yyyy-MM-dd HH:mm:ss", CultureInfo.InvariantCulture)
            : model.PrintedAt;
        string[] lines =
        {
            "Printer: " + (string.IsNullOrWhiteSpace(model.Printer) ? printer : model.Printer),
            "Date/time: " + when,
            "Paper: " + spec.Name,
            "Orientation: " + (spec.Landscape ? "landscape" : "portrait"),
            "",
            string.IsNullOrWhiteSpace(model.TitleFa) ? "آزمایش چاپ سیرمان" : model.TitleFa,
            string.IsNullOrWhiteSpace(model.Title) ? "SIRMAN NATIVE PRINT TEST" : model.Title,
            string.IsNullOrWhiteSpace(model.MixedSample) ? "۱۲۳۴۵۶789" : model.MixedSample
        };
        foreach (var line in lines)
        {
            g.DrawString(line, body, brush, new RectangleF(bounds.Left, y, w, 22), rtl);
            y += 24;
        }
    }

    private static bool DrawInvoicePage(
        Graphics g,
        Rectangle bounds,
        InvoicePrintModel inv,
        NativePrintLayout.PaperSpec spec,
        int page,
        ref int lineIndex,
        Image? logo)
    {
        using var title = SafeFont(inv.Font, 12, FontStyle.Bold);
        using var small = SafeFont(inv.Font, NativePrintLayout.ParseFontPoints(inv.FontSize, 8f), FontStyle.Regular);
        using var tiny = SafeFont(inv.Font, 7, FontStyle.Regular);
        using var brush = new SolidBrush(Color.Black);
        using var gray = new SolidBrush(Color.FromArgb(224, 224, 224));
        using var pen = new Pen(Color.FromArgb(80, 80, 80), 0.6f);
        using var rtl = RtlFormat();
        float y = bounds.Top;
        var w = (float)bounds.Width;

        float logoW = 0;
        if (logo is not null)
        {
            var lw = Math.Min(90f, logo.Width);
            var lh = Math.Min(34f, logo.Height);
            g.DrawImage(logo, bounds.Left, y, lw, lh);
            logoW = lw + 8;
        }
        var brand = string.IsNullOrWhiteSpace(inv.BrandFa) ? "سیرمان" : inv.BrandFa;
        g.DrawString("فاکتور خدمات پس از فروش — " + brand, title, brush, new RectangleF(bounds.Left + logoW, y, Math.Max(40, w - logoW), 20), rtl);
        y += 20;
        var status = inv.Status is "closed" or "تکمیل" ? "تکمیل"
            : string.IsNullOrWhiteSpace(inv.Status) || inv.Status is "open" or "draft" ? "باز"
            : inv.Status;
        var meta = "شماره:" + inv.Number + " | فروشنده:" + inv.Seller + " | تلفن:" + (string.IsNullOrEmpty(inv.Phone) ? "—" : inv.Phone)
            + " | تاریخ:" + (string.IsNullOrEmpty(inv.Date) ? "—" : inv.Date) + " | وضعیت:" + status;
        g.DrawString(meta, small, brush, new RectangleF(bounds.Left, y, w, 18), rtl);
        y += 22;
        g.DrawLine(pen, bounds.Left, y, bounds.Right, y);
        y += 6;

        string[] heads = { "ر", "کد", "مدل", "تاریخ", "رنگ", "کارتن", "بدنه", "لوازم", "کمبود", "عملکرد", "گارانتی", "خدمات", "توضیح", "برآورد", "تخفیف", "نهایی" };
        float[] weights = { 0.04f, 0.07f, 0.12f, 0.07f, 0.06f, 0.05f, 0.07f, 0.06f, 0.06f, 0.07f, 0.06f, 0.06f, 0.08f, 0.07f, 0.04f, 0.08f };
        var cols = Cols(bounds.Left, w, weights);
        var rowH = spec.Landscape ? 16f : 18f;
        DrawRow(g, heads, cols, y, rowH, tiny, brush, gray, pen, rtl, header: true);
        y += rowH;

        var more = false;
        while (lineIndex < inv.Lines.Count)
        {
            if (y + rowH + 48 > bounds.Bottom)
            {
                more = true;
                break;
            }
            var line = inv.Lines[lineIndex];
            var cells = new[]
            {
                line.Num.ToString(CultureInfo.InvariantCulture),
                line.Code,
                line.Model,
                line.Date,
                line.Color,
                line.Carton,
                line.BodyCell,
                line.Acc,
                line.Miss,
                line.PerfCell,
                line.Warranty,
                line.Svc,
                line.NoteCell,
                line.Est.ToString("N0", CultureInfo.GetCultureInfo("fa-IR")),
                line.Disc.ToString(CultureInfo.InvariantCulture) + "%",
                line.Fin.ToString("N0", CultureInfo.GetCultureInfo("fa-IR"))
            };
            DrawRow(g, cells, cols, y, rowH, tiny, brush, lineIndex % 2 == 0 ? null : gray, pen, rtl, header: false);
            y += rowH;
            lineIndex++;
        }

        if (!more)
        {
            y += 8;
            var totals = "برآورد: " + inv.TotalEst.ToString("N0", CultureInfo.GetCultureInfo("fa-IR"))
                + " | تخفیف: " + inv.TotalDisc.ToString("N0", CultureInfo.GetCultureInfo("fa-IR"))
                + " | نهایی: " + inv.TotalFin.ToString("N0", CultureInfo.GetCultureInfo("fa-IR")) + " ریال";
            g.DrawString(totals, small, brush, new RectangleF(bounds.Left, y, w, 18), rtl);
            y += 20;
            if (!string.IsNullOrWhiteSpace(inv.Notes))
            {
                g.DrawString("توضیحات: " + inv.Notes, tiny, brush, new RectangleF(bounds.Left, y, w, 28), rtl);
                y += 30;
            }
            g.DrawLine(pen, bounds.Left, y, bounds.Right, y);
            y += 8;
            var signW = w / 3f;
            g.DrawString("مهر و امضاء شرکت", tiny, brush, new RectangleF(bounds.Left, y, signW, 16), rtl);
            g.DrawString("امضاء مسئول خدمات پس از فروش", tiny, brush, new RectangleF(bounds.Left + signW, y, signW, 16), rtl);
            g.DrawString("امضاء مسئول انبار قطعات", tiny, brush, new RectangleF(bounds.Left + signW * 2, y, signW, 16), rtl);
        }

        if (inv.PageNumbers || spec.Landscape)
        {
            using var center = new StringFormat { Alignment = StringAlignment.Center };
            g.DrawString(page.ToString(CultureInfo.InvariantCulture), tiny, brush, new RectangleF(bounds.Left, bounds.Bottom - 14, w, 14), center);
        }
        return more;
    }

    private static float[] Cols(float left, float width, float[] weights)
    {
        var cols = new float[weights.Length + 1];
        cols[0] = left;
        var x = left;
        for (var i = 0; i < weights.Length; i++)
        {
            x += width * weights[i];
            cols[i + 1] = x;
        }
        cols[^1] = left + width;
        return cols;
    }

    private static void DrawRow(Graphics g, string[] cells, float[] cols, float y, float h, Font font, Brush text, Brush? fill, Pen pen, StringFormat rtl, bool header)
    {
        for (var i = 0; i < cells.Length && i < cols.Length - 1; i++)
        {
            var r = new RectangleF(cols[i], y, Math.Max(4, cols[i + 1] - cols[i]), h);
            if (fill is not null || header)
                g.FillRectangle(fill ?? Brushes.Gainsboro, r);
            g.DrawRectangle(pen, r.X, r.Y, r.Width, r.Height);
            g.DrawString(cells[i] ?? "", font, text, r, rtl);
        }
    }

    private static StringFormat RtlFormat() => new(StringFormatFlags.DirectionRightToLeft | StringFormatFlags.LineLimit)
    {
        Alignment = StringAlignment.Near,
        LineAlignment = StringAlignment.Center,
        Trimming = StringTrimming.EllipsisCharacter
    };

    private static Font SafeFont(string? family, float size, FontStyle style)
    {
        var name = string.IsNullOrWhiteSpace(family) ? "Tahoma" : family.Trim();
        try { return new Font(name, size, style, GraphicsUnit.Point); }
        catch { return new Font(FontFamily.GenericSansSerif, size, style, GraphicsUnit.Point); }
    }

    private static Image? TryLogo(string? dataUrl)
    {
        if (string.IsNullOrWhiteSpace(dataUrl)) return null;
        try
        {
            var s = dataUrl.Trim();
            var comma = s.IndexOf(',');
            var b64 = comma >= 0 ? s[(comma + 1)..] : s;
            var bytes = Convert.FromBase64String(b64);
            using var ms = new MemoryStream(bytes);
            using var tmp = Image.FromStream(ms);
            return new Bitmap(tmp);
        }
        catch
        {
            return null;
        }
    }
}
