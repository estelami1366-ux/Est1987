using System.Drawing.Drawing2D;
using System.Drawing.Printing;
using System.Globalization;
using System.Reflection;
using System.Text;
using Sirman.Core.Printing;

namespace Sirman.Desktop;

/// <summary>
/// P0.5R4 read-only native PrintDocument probe. Records HDC/page mapping.
/// Does not set Landscape, PaperSize, margins, transforms, fonts, or RTL.
/// </summary>
internal static class NativePrintRuntimeProbe
{
    public const string Id = "P0.5R4";
    public const string FileName = "P0.5R4_NATIVE_RUNTIME.log";

    public static string LogPath() =>
        Path.Combine(AppPaths.AppDataRoot, "print", FileName);

    public static void WriteDocument(PrintJobState job, NativePrintRequest request, ResolvedPaperSpec resolved, PrintDocument doc, NativePrintRuntimeSnapshot? snapshot = null)
    {
        try
        {
            var ps = doc.DefaultPageSettings;
            var paper = ps.PaperSize;
            var margins = ps.Margins;
            var requestLandscape = IsLandscapeToken(request.Orientation);
            var profile = request.PrintCenterExplicit
                ? "print-center-explicit"
                : (request.PaperExplicit ? "user-document" : "document-default");
            var paperKind = ((int)paper.Kind).ToString(CultureInfo.InvariantCulture);
            var paperRawKind = paper.RawKind.ToString(CultureInfo.InvariantCulture);
            var paperWidth = paper.Width.ToString(CultureInfo.InvariantCulture);
            var paperHeight = paper.Height.ToString(CultureInfo.InvariantCulture);
            var copies = (int)doc.PrinterSettings.Copies;
            var line = Join(
                "stage=DOCUMENT",
                "jobId=" + job.PrintJobId,
                "kind=" + request.Kind,
                "documentId=" + request.DocumentId,
                "engine=" + request.Engine,
                "printer=" + job.Printer,
                "profile=" + profile,
                "purpose=" + job.Purpose,
                "request.Paper=" + request.Paper,
                "request.Orientation=" + request.Orientation,
                "request.Landscape=" + requestLandscape.ToString(CultureInfo.InvariantCulture),
                "request.PaperExplicit=" + request.PaperExplicit.ToString(CultureInfo.InvariantCulture),
                "request.PrintCenterExplicit=" + request.PrintCenterExplicit.ToString(CultureInfo.InvariantCulture),
                "resolved.Name=" + resolved.Name,
                "resolved.Source=" + resolved.Source,
                "resolved.WidthMm=" + F(resolved.WidthMm),
                "resolved.HeightMm=" + F(resolved.HeightMm),
                "resolved.WidthHundredthsInch=" + resolved.WidthHundredthsInch.ToString(CultureInfo.InvariantCulture),
                "resolved.HeightHundredthsInch=" + resolved.HeightHundredthsInch.ToString(CultureInfo.InvariantCulture),
                "resolved.Landscape=" + resolved.Landscape.ToString(CultureInfo.InvariantCulture),
                "resolved.MarginMm=" + F(resolved.MarginMm),
                "resolved.Copies=" + resolved.Copies.ToString(CultureInfo.InvariantCulture),
                "resolved.PaperKind=" + resolved.PaperKind.ToString(CultureInfo.InvariantCulture),
                "resolved.RawKind=" + resolved.RawKind.ToString(CultureInfo.InvariantCulture),
                "resolved.InstalledFormIndex=" + resolved.InstalledFormIndex.ToString(CultureInfo.InvariantCulture),
                "PrinterSettings.PrinterName=" + doc.PrinterSettings.PrinterName,
                "PrinterSettings.Copies=" + copies.ToString(CultureInfo.InvariantCulture),
                "DefaultPageSettings.PaperSize.PaperName=" + paper.PaperName,
                "DefaultPageSettings.PaperSize.Kind=" + paperKind,
                "DefaultPageSettings.PaperSize.RawKind=" + paperRawKind,
                "DefaultPageSettings.PaperSize.Width=" + paperWidth,
                "DefaultPageSettings.PaperSize.Height=" + paperHeight,
                "DefaultPageSettings.Landscape=" + ps.Landscape.ToString(CultureInfo.InvariantCulture),
                "DefaultPageSettings.Margins.Left=" + margins.Left.ToString(CultureInfo.InvariantCulture),
                "DefaultPageSettings.Margins.Right=" + margins.Right.ToString(CultureInfo.InvariantCulture),
                "DefaultPageSettings.Margins.Top=" + margins.Top.ToString(CultureInfo.InvariantCulture),
                "DefaultPageSettings.Margins.Bottom=" + margins.Bottom.ToString(CultureInfo.InvariantCulture));
            Append(line);
            job.Log("P05R4_DOCUMENT", Id + " " + FileName + " landscape=" + ps.Landscape + " paper=" + paper.PaperName, job.Printer);
            if (snapshot != null)
            {
                snapshot.HasDocument = true;
                snapshot.Profile = profile;
                snapshot.RequestedPaper = request.Paper;
                snapshot.RequestedOrientation = request.Orientation;
                snapshot.RequestedLandscape = requestLandscape;
                snapshot.ResolvedPaper = resolved.Name;
                snapshot.ResolvedWidthMm = F(resolved.WidthMm);
                snapshot.ResolvedHeightMm = F(resolved.HeightMm);
                snapshot.ResolvedLandscape = resolved.Landscape;
                snapshot.ResolvedMarginMm = F(resolved.MarginMm);
                snapshot.Copies = copies;
                snapshot.PaperKind = paperKind;
                snapshot.PaperRawKind = paperRawKind;
                snapshot.PaperWidth = paperWidth;
                snapshot.PaperHeight = paperHeight;
            }
        }
        catch
        {
            /* probe must not break print */
        }
    }

    /// <summary>
    /// P0.5R6: postal logo load only. Does not set Landscape, PaperSize, or transforms.
    /// Does not log data-URL payloads or unrelated user fields.
    /// </summary>
    public static void WriteLogo(PrintJobState job, NativePrintRequest request, NativeLogoResolveResult? diag, bool imageLoadSucceeded, NativePrintRuntimeSnapshot? snapshot = null)
    {
        try
        {
            diag ??= new NativeLogoResolveResult { SourceKind = "empty", FailureReason = "empty" };
            var logoNull = !imageLoadSucceeded;
            var line = Join(
                "stage=LOGO",
                "jobId=" + job.PrintJobId,
                "kind=" + request.Kind,
                "logoSrc=" + (diag.LogoSrcPreview ?? ""),
                "logoSourceKind=" + (diag.SourceKind ?? ""),
                "resolvedPath=" + (diag.ResolvedPath ?? ""),
                "fileExists=" + diag.FileExists.ToString(CultureInfo.InvariantCulture),
                "imageLoadSucceeded=" + imageLoadSucceeded.ToString(CultureInfo.InvariantCulture),
                "logoNull=" + logoNull.ToString(CultureInfo.InvariantCulture),
                "recognizedImageHeader=" + diag.RecognizedImageHeader.ToString(CultureInfo.InvariantCulture),
                "failureReason=" + (diag.FailureReason ?? ""));
            Append(line);
            job.Log("P05R6_LOGO", Id + " " + FileName + " kind=" + diag.SourceKind + " null=" + logoNull + " reason=" + (diag.FailureReason ?? ""), job.Printer);
            if (snapshot != null)
            {
                snapshot.HasLogo = true;
                snapshot.LogoSourceKind = diag.SourceKind;
                snapshot.LogoResolved = !logoNull;
                snapshot.LogoLoadSuccess = imageLoadSucceeded;
                snapshot.LogoFailureReason = diag.FailureReason;
            }
        }
        catch
        {
            /* probe must not break print */
        }
    }

    public static void WritePage(PrintJobState job, NativePrintRequest request, PrintPageEventArgs e, Graphics g, NativePrintRuntimeSnapshot? snapshot = null)
    {
        try
        {
            var page = e.PageSettings;
            var paper = page.PaperSize;
            var margins = page.Margins;
            var pb = e.PageBounds;
            var mb = e.MarginBounds;
            var paperKind = ((int)paper.Kind).ToString(CultureInfo.InvariantCulture);
            var paperRawKind = paper.RawKind.ToString(CultureInfo.InvariantCulture);
            var paperWidth = paper.Width.ToString(CultureInfo.InvariantCulture);
            var paperHeight = paper.Height.ToString(CultureInfo.InvariantCulture);
            var graphics = ReadGraphics(g, snapshot);
            var line = Join(
                "stage=PRINTPAGE",
                "jobId=" + job.PrintJobId,
                "kind=" + request.Kind,
                "documentId=" + request.DocumentId,
                "engine=" + request.Engine,
                "printer=" + job.Printer,
                "purpose=" + job.Purpose,
                "e.PageSettings.PaperSize.PaperName=" + paper.PaperName,
                "e.PageSettings.PaperSize.Kind=" + paperKind,
                "e.PageSettings.PaperSize.RawKind=" + paperRawKind,
                "e.PageSettings.PaperSize.Width=" + paperWidth,
                "e.PageSettings.PaperSize.Height=" + paperHeight,
                "e.PageSettings.Landscape=" + page.Landscape.ToString(CultureInfo.InvariantCulture),
                "e.PageSettings.Margins.Left=" + margins.Left.ToString(CultureInfo.InvariantCulture),
                "e.PageSettings.Margins.Right=" + margins.Right.ToString(CultureInfo.InvariantCulture),
                "e.PageSettings.Margins.Top=" + margins.Top.ToString(CultureInfo.InvariantCulture),
                "e.PageSettings.Margins.Bottom=" + margins.Bottom.ToString(CultureInfo.InvariantCulture),
                "e.PageBounds.X=" + pb.X.ToString(CultureInfo.InvariantCulture),
                "e.PageBounds.Y=" + pb.Y.ToString(CultureInfo.InvariantCulture),
                "e.PageBounds.Width=" + pb.Width.ToString(CultureInfo.InvariantCulture),
                "e.PageBounds.Height=" + pb.Height.ToString(CultureInfo.InvariantCulture),
                "e.MarginBounds.X=" + mb.X.ToString(CultureInfo.InvariantCulture),
                "e.MarginBounds.Y=" + mb.Y.ToString(CultureInfo.InvariantCulture),
                "e.MarginBounds.Width=" + mb.Width.ToString(CultureInfo.InvariantCulture),
                "e.MarginBounds.Height=" + mb.Height.ToString(CultureInfo.InvariantCulture),
                graphics);
            Append(line);
            job.Log("P05R4_PRINTPAGE", Id + " " + FileName + " PageBounds=" + Rect(pb) + " MarginBounds=" + Rect(mb) + " Landscape=" + page.Landscape, job.Printer);
            if (snapshot != null)
            {
                snapshot.HasPage = true;
                snapshot.PaperKind = paperKind;
                snapshot.PaperRawKind = paperRawKind;
                snapshot.PaperWidth = paperWidth;
                snapshot.PaperHeight = paperHeight;
                snapshot.PageBounds = Rect(pb);
                snapshot.MarginBounds = Rect(mb);
            }
        }
        catch
        {
            /* probe must not break print */
        }
    }

    private static string ReadGraphics(Graphics g, NativePrintRuntimeSnapshot? snapshot)
    {
        var transform = "g.Transform.Elements=UNAVAILABLE";
        try
        {
            using var matrix = g.Transform;
            var el = matrix.Elements;
            transform = "g.Transform.Elements=" + string.Join(",", el.Select(F));
        }
        catch
        {
            /* some HDCs refuse Transform get */
        }

        var pageUnit = g.PageUnit.ToString();
        var pageScale = F(g.PageScale);
        var visible = RectF(g.VisibleClipBounds);
        var clip = RectF(g.ClipBounds);
        var dpiX = F(g.DpiX);
        var dpiY = F(g.DpiY);
        if (snapshot != null)
        {
            snapshot.GraphicsPageUnit = pageUnit;
            snapshot.GraphicsPageScale = pageScale;
            snapshot.GraphicsTransform = transform.StartsWith("g.Transform.Elements=", StringComparison.Ordinal)
                ? transform["g.Transform.Elements=".Length..]
                : transform;
            snapshot.VisibleClipBounds = visible;
            snapshot.ClipBounds = clip;
            snapshot.DpiX = dpiX;
            snapshot.DpiY = dpiY;
        }

        return Join(
            "g.PageUnit=" + g.PageUnit,
            "g.PageScale=" + pageScale,
            transform,
            "g.VisibleClipBounds=" + visible,
            "g.ClipBounds=" + clip,
            "g.DpiX=" + dpiX,
            "g.DpiY=" + dpiY);
    }

    private static bool IsLandscapeToken(string? orientation)
    {
        var ori = (orientation ?? "").Trim().ToLowerInvariant();
        return ori is "landscape" or "horizontal" or "افقی";
    }

    private static string Rect(Rectangle r) =>
        r.X.ToString(CultureInfo.InvariantCulture) + "," +
        r.Y.ToString(CultureInfo.InvariantCulture) + "," +
        r.Width.ToString(CultureInfo.InvariantCulture) + "," +
        r.Height.ToString(CultureInfo.InvariantCulture);

    private static string RectF(RectangleF r) =>
        F(r.X) + "," + F(r.Y) + "," + F(r.Width) + "," + F(r.Height);

    private static string F(float v) => v.ToString("0.###", CultureInfo.InvariantCulture);

    private static string Join(params string[] parts) => string.Join("; ", parts);

    private static void Append(string body)
    {
        var dir = Path.Combine(AppPaths.AppDataRoot, "print");
        Directory.CreateDirectory(dir);
        var line = string.Join('\t',
            DateTimeOffset.Now.ToString("o"),
            Environment.MachineName,
            AppVersion(),
            Id,
            Sanitize(body));
        File.AppendAllText(LogPath(), line + Environment.NewLine, Encoding.UTF8);
    }

    private static string AppVersion()
    {
        try
        {
            var asm = typeof(NativePrintRuntimeProbe).Assembly;
            var info = asm.GetCustomAttributes(typeof(AssemblyInformationalVersionAttribute), false)
                .OfType<AssemblyInformationalVersionAttribute>().FirstOrDefault();
            return info?.InformationalVersion ?? asm.GetName().Version?.ToString() ?? "";
        }
        catch
        {
            return "";
        }
    }

    private static string Sanitize(string? detail)
    {
        if (string.IsNullOrEmpty(detail)) return "";
        return detail.Replace('\n', ' ').Replace('\r', ' ').Replace('\t', ' ');
    }
}
