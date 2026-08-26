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
        using var doc = new PrintDocument();
        doc.PrinterSettings.PrinterName = job.Printer;
        var installed = new List<NativePrintLayout.PaperFormCandidate>();
        var sizes = new List<PaperSize>();
        foreach (PaperSize ps in doc.PrinterSettings.PaperSizes)
        {
            sizes.Add(ps);
            installed.Add(new NativePrintLayout.PaperFormCandidate(ps.PaperName, (int)ps.Kind, ps.RawKind));
        }
        var resolved = NativePrintPaper.Resolve(NativePrintPaper.FromRequest(request), installed);
        var spec = resolved.Layout;
        var copies = resolved.Copies;
        doc.PrinterSettings.Copies = (short)copies;
        doc.DefaultPageSettings.Landscape = resolved.Landscape;
        ApplyPaperSize(doc, resolved, sizes);
        var m = Math.Max(20, (int)(resolved.MarginMm / 25.4f * 100));
        doc.DefaultPageSettings.Margins = new Margins(m, m, m, m);
        doc.PrintController = new StandardPrintController();
        doc.DocumentName = "SIRMAN " + request.Kind + " " + (request.DocumentId ?? "");

        var page = 0;
        var lineIndex = 0;
        Image? logo = request.Kind == NativePrintRequest.KindPostalLabel
            ? TryAnyLogo(request.PostalLabel?.LogoSrc)
            : TryLogo(request.Invoice?.LogoDataUrl);
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
                {
                    e.HasMorePages = false;
                    DrawTestPage(g, bounds, request.TestPage ?? new TestPagePrintModel(), spec, job.Printer);
                }
                else if (request.Kind == NativePrintRequest.KindPostalLabel)
                {
                    e.HasMorePages = false;
                    DrawPostalLabel(g, bounds, request.PostalLabel ?? new PostalLabelPrintModel(), logo);
                }
                else
                {
                    e.HasMorePages = DrawInvoicePage(g, bounds, request.Invoice!, spec, page, ref lineIndex, logo);
                }
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
    /// Applies <see cref="ResolvedPaperSpec"/> only. P0.1 ISO index is chosen by NativePrintPaper.Resolve.
    /// </summary>
    private static void ApplyPaperSize(PrintDocument doc, ResolvedPaperSpec resolved, List<PaperSize> sizes)
    {
        if (resolved.InstalledFormIndex >= 0 && resolved.InstalledFormIndex < sizes.Count)
        {
            doc.DefaultPageSettings.PaperSize = sizes[resolved.InstalledFormIndex];
            return;
        }

        try
        {
            doc.DefaultPageSettings.PaperSize = new PaperSize(
                "SIRMAN-" + resolved.Name,
                resolved.WidthHundredthsInch,
                resolved.HeightHundredthsInch);
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

    /// <summary>
    /// Four cards matching HTML preview: two wraps × (recipient, sender) in RTL flex.
    /// Physical GDI: sender on the left, recipient on the right, duplicated on two rows.
    /// Does not call DrawInvoicePage or DrawTestPage.
    /// </summary>
    private static void DrawPostalLabel(Graphics g, Rectangle bounds, PostalLabelPrintModel model, Image? logo)
    {
        const float gap = 10f;
        var colW = Math.Max(40f, (bounds.Width - gap) / 2f);
        var rowH = Math.Max(40f, (bounds.Height - gap) / 2f);
        DrawPostalSenderCard(g, new RectangleF(bounds.Left, bounds.Top, colW, rowH), model, logo);
        DrawPostalRecipientCard(g, new RectangleF(bounds.Left + colW + gap, bounds.Top, colW, rowH), model);
        DrawPostalSenderCard(g, new RectangleF(bounds.Left, bounds.Top + rowH + gap, colW, rowH), model, logo);
        DrawPostalRecipientCard(g, new RectangleF(bounds.Left + colW + gap, bounds.Top + rowH + gap, colW, rowH), model);
    }

    private static void DrawPostalSenderCard(Graphics g, RectangleF box, PostalLabelPrintModel model, Image? logo)
    {
        using var pen = new Pen(Color.FromArgb(51, 51, 51), model.Border ? 2f : 0.6f);
        using var brush = new SolidBrush(Color.Black);
        using var rtl = RtlFormat();
        rtl.LineAlignment = StringAlignment.Near;
        using var body = SafeFont("Tahoma", 9, FontStyle.Regular);
        using var bold = SafeFont("Tahoma", 9, FontStyle.Bold);
        using var tiny = SafeFont("Tahoma", 6, FontStyle.Regular);
        DrawRoundRect(g, pen, box, 6f);
        var inner = RectangleF.Inflate(box, -8f, -8f);
        float y = inner.Top;
        float textLeft = inner.Left;
        if (logo is not null)
        {
            var logoW = Math.Min(72f, inner.Width * 0.35f);
            var logoH = 28f;
            var logoRect = new RectangleF(inner.Left, inner.Top, logoW, logoH);
            using var logoPen = new Pen(Color.FromArgb(170, 170, 170), 1f);
            DrawRoundRect(g, logoPen, logoRect, 3f);
            try { g.DrawImage(logo, RectangleF.Inflate(logoRect, -2f, -2f)); }
            catch { /* missing/corrupt logo must not abort the label */ }
            if (!string.IsNullOrWhiteSpace(model.BrandEn))
            {
                using var center = new StringFormat { Alignment = StringAlignment.Center, LineAlignment = StringAlignment.Near };
                g.DrawString(model.BrandEn, tiny, Brushes.Gray, new RectangleF(logoRect.X, logoRect.Bottom, logoRect.Width, 10), center);
            }
            textLeft = logoRect.Right + 8f;
            y = inner.Top;
        }
        var sender = model.Sender ?? new PostalParty();
        var firstW = Math.Max(20f, inner.Right - textLeft);
        g.DrawString("فرستنده: " + (sender.Addr ?? ""), bold, brush, new RectangleF(textLeft, y, firstW, 36), rtl);
        y = Math.Max(y + 38f, inner.Top + (logo is null ? 0 : 42f));
        DrawPostalIdLine(g, "کدپستی:", sender.Zip, bold, body, brush, rtl, new RectangleF(inner.Left, y, inner.Width, 16));
        y += 18f;
        var telLine = string.IsNullOrWhiteSpace(sender.Person)
            ? (sender.Tel ?? "")
            : ((sender.Tel ?? "") + " " + sender.Person);
        DrawPostalIdLine(g, "شماره تماس:", telLine, body, body, brush, rtl, new RectangleF(inner.Left, y, inner.Width, 16));
    }

    private static void DrawPostalRecipientCard(Graphics g, RectangleF box, PostalLabelPrintModel model)
    {
        using var pen = new Pen(Color.FromArgb(51, 51, 51), model.Border ? 2f : 0.6f);
        using var brush = new SolidBrush(Color.Black);
        using var rtl = RtlFormat();
        rtl.LineAlignment = StringAlignment.Near;
        using var body = SafeFont("Tahoma", 9, FontStyle.Regular);
        using var bold = SafeFont("Tahoma", 9, FontStyle.Bold);
        using var nameFont = SafeFont("Tahoma", 10, FontStyle.Bold);
        using var fragileFont = SafeFont("Tahoma", 16, FontStyle.Bold);
        DrawRoundRect(g, pen, box, 6f);
        var inner = RectangleF.Inflate(box, -8f, -8f);
        var rcv = model.Recipient ?? new PostalParty();
        float y = inner.Top;
        g.DrawString("آدرس گیرنده: " + (rcv.Addr ?? ""), bold, brush, new RectangleF(inner.Left, y, inner.Width, 36), rtl);
        y += 38f;
        DrawPostalIdLine(g, "کدپستی:", rcv.Zip, bold, body, brush, rtl, new RectangleF(inner.Left, y, inner.Width, 16));
        y += 18f;
        DrawPostalIdLine(g, "شماره تماس:", rcv.Tel, body, body, brush, rtl, new RectangleF(inner.Left, y, inner.Width, 16));
        y += 20f;
        if (!string.IsNullOrWhiteSpace(rcv.Name))
        {
            g.DrawString(rcv.Name, nameFont, brush, new RectangleF(inner.Left, y, inner.Width, 18), rtl);
            y += 22f;
        }
        if (model.Fragile && !string.IsNullOrWhiteSpace(rcv.Note))
        {
            var badge = MeasureBadge(g, rcv.Note, fragileFont, inner.Width);
            var bx = inner.Right - badge.Width;
            var badgeRect = new RectangleF(bx, y, badge.Width, badge.Height);
            using var thick = new Pen(Color.FromArgb(51, 51, 51), 3f);
            DrawRoundRect(g, thick, badgeRect, 4f);
            using var centerRtl = RtlFormat();
            centerRtl.Alignment = StringAlignment.Center;
            centerRtl.LineAlignment = StringAlignment.Center;
            g.DrawString(rcv.Note, fragileFont, brush, badgeRect, centerRtl);
        }
    }

    private static SizeF MeasureBadge(Graphics g, string text, Font font, float maxWidth)
    {
        var size = g.MeasureString(text ?? "", font);
        return new SizeF(Math.Min(maxWidth, Math.Max(36f, size.Width + 16f)), Math.Max(22f, size.Height + 8f));
    }

    private static void DrawPostalIdLine(Graphics g, string label, string? value, Font labelFont, Font valueFont, Brush brush, StringFormat rtl, RectangleF rect)
    {
        var stored = value ?? "";
        var presented = NativePrintBidi.AsLeftToRight(stored);
        using var ltr = LtrFormat();
        ltr.LineAlignment = StringAlignment.Center;
        var labelText = label + " ";
        var labelSize = g.MeasureString(labelText, labelFont);
        var labelWidth = Math.Min(rect.Width * 0.45f, Math.Max(40f, labelSize.Width));
        var labelRect = new RectangleF(rect.Right - labelWidth, rect.Top, labelWidth, rect.Height);
        var valueRect = new RectangleF(rect.Left, rect.Top, Math.Max(8f, rect.Width - labelWidth - 4f), rect.Height);
        g.DrawString(label, labelFont, brush, labelRect, rtl);
        g.DrawString(presented, valueFont, brush, valueRect, ltr);
    }

    private static void DrawRoundRect(Graphics g, Pen pen, RectangleF box, float radius)
    {
        if (box.Width < 2 || box.Height < 2) return;
        var r = Math.Max(1f, Math.Min(radius, Math.Min(box.Width, box.Height) / 4f));
        using var path = new System.Drawing.Drawing2D.GraphicsPath();
        path.AddArc(box.Left, box.Top, r * 2, r * 2, 180, 90);
        path.AddArc(box.Right - r * 2, box.Top, r * 2, r * 2, 270, 90);
        path.AddArc(box.Right - r * 2, box.Bottom - r * 2, r * 2, r * 2, 0, 90);
        path.AddArc(box.Left, box.Bottom - r * 2, r * 2, r * 2, 90, 90);
        path.CloseFigure();
        g.DrawPath(pen, path);
    }

    private static StringFormat RtlFormat() => new(StringFormatFlags.DirectionRightToLeft | StringFormatFlags.LineLimit)
    {
        Alignment = StringAlignment.Near,
        LineAlignment = StringAlignment.Center,
        Trimming = StringTrimming.EllipsisCharacter
    };

    private static StringFormat LtrFormat() => new(StringFormatFlags.NoWrap | StringFormatFlags.LineLimit)
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

    private static Image? TryAnyLogo(string? src)
    {
        if (string.IsNullOrWhiteSpace(src)) return null;
        var s = src.Trim();
        if (s.StartsWith("data:", StringComparison.OrdinalIgnoreCase))
            return TryLogo(s);
        if (s.StartsWith("http:", StringComparison.OrdinalIgnoreCase)
            || s.StartsWith("https:", StringComparison.OrdinalIgnoreCase)
            || s.StartsWith("file:", StringComparison.OrdinalIgnoreCase))
            return null;
        try
        {
            var rel = s.Replace('/', Path.DirectorySeparatorChar);
            var baseDir = AppContext.BaseDirectory;
            var candidates = new[]
            {
                Path.IsPathRooted(rel) ? rel : Path.Combine(baseDir, rel),
                Path.Combine(baseDir, Path.GetFileName(rel))
            };
            foreach (var path in candidates)
            {
                if (string.IsNullOrWhiteSpace(path) || !File.Exists(path)) continue;
                using var tmp = Image.FromFile(path);
                return new Bitmap(tmp);
            }
        }
        catch
        {
            return null;
        }
        return null;
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
