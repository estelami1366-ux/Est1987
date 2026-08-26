namespace Sirman.Core.Printing;

/// <summary>
/// Document-owned paper specification. Unset is not A4.
/// Print Center/profile values apply only when marked explicit.
/// P0.1 ISO form selection is reused, not rewritten.
/// </summary>
public readonly record struct DocumentPrintSpec(
    string Kind,
    string? Paper,
    string? Orientation,
    string? Margin,
    int Copies,
    float Scale,
    float WidthMm,
    float HeightMm,
    bool PaperExplicit,
    bool PrintCenterExplicit);

/// <summary>
/// Only paper object consumed by ApplyPaperSize / PrintDocument.DefaultPageSettings.
/// </summary>
public readonly record struct ResolvedPaperSpec(
    string Name,
    bool Landscape,
    int WidthHundredthsInch,
    int HeightHundredthsInch,
    float MarginMm,
    int Copies,
    float Scale,
    float WidthMm,
    float HeightMm,
    string Source,
    int PaperKind,
    int RawKind,
    int InstalledFormIndex)
{
    public NativePrintLayout.PaperSpec Layout =>
        new(Name, Landscape, WidthHundredthsInch, HeightHundredthsInch, MarginMm);
}

public static class NativePrintPaper
{
    public const string SourceUserDocument = "user-document";
    public const string SourcePrintCenter = "print-center";
    public const string SourceDocumentDefault = "document-default";
    public const string SourceInstalledForm = "installed-form";
    public const string SourceCustomFallback = "custom-fallback";

    public static string DocumentDefaultPaper(string? kind)
    {
        if (string.Equals(kind, NativePrintRequest.KindPostalLabel, StringComparison.Ordinal))
            return "A5";
        if (string.Equals(kind, NativePrintRequest.KindInvoice, StringComparison.Ordinal))
            return "A4 landscape";
        return "A4";
    }

    public static float DocumentDefaultMarginMm(string? kind) =>
        string.Equals(kind, NativePrintRequest.KindPostalLabel, StringComparison.Ordinal) ? 10f : 8f;

    public static DocumentPrintSpec FromRequest(NativePrintRequest request)
    {
        var paper = request.Paper ?? "";
        var margin = request.Kind == NativePrintRequest.KindPostalLabel
            ? request.PostalLabel?.Margin
            : request.Invoice?.Margin;
        return new DocumentPrintSpec(
            Kind: request.Kind,
            Paper: paper,
            Orientation: request.Orientation,
            Margin: margin,
            Copies: request.Copies,
            Scale: 100f,
            WidthMm: request.WidthMm,
            HeightMm: request.HeightMm,
            PaperExplicit: request.PaperExplicit,
            PrintCenterExplicit: request.PrintCenterExplicit);
    }

    /// <summary>
    /// 1. Explicit user document override
    /// 2. Explicit Print Center user selection
    /// 3. Document default paper specification
    /// Unset paper does not become implicit A4.
    /// A non-explicit paper token (profile leak) is ignored.
    /// </summary>
    public static string ChoosePaperToken(DocumentPrintSpec spec)
    {
        var paper = (spec.Paper ?? "").Trim();
        if (spec.PaperExplicit && paper.Length > 0)
            return paper;
        if (spec.PrintCenterExplicit && paper.Length > 0)
            return paper;
        return DocumentDefaultPaper(spec.Kind);
    }

    public static string SourceOfChoice(DocumentPrintSpec spec)
    {
        var paper = (spec.Paper ?? "").Trim();
        if (spec.PaperExplicit && paper.Length > 0)
            return SourceUserDocument;
        if (spec.PrintCenterExplicit && paper.Length > 0)
            return SourcePrintCenter;
        return SourceDocumentDefault;
    }

    public static ResolvedPaperSpec Resolve(
        DocumentPrintSpec spec,
        IReadOnlyList<NativePrintLayout.PaperFormCandidate>? installed = null)
    {
        var token = ChoosePaperToken(spec);
        var source = SourceOfChoice(spec);
        var parsed = NativePrintLayout.ParsePaper(token, spec.Orientation);
        if (spec.WidthMm > 0 && spec.HeightMm > 0)
            parsed = NativePrintLayout.WithExplicitMillimeters(parsed, spec.WidthMm, spec.HeightMm);

        var marginMm = NativePrintLayout.ParseMarginMm(spec.Margin, DocumentDefaultMarginMm(spec.Kind));
        var copies = NativePrintLayout.ClampCopies(spec.Copies);
        var scale = spec.Scale > 0 ? spec.Scale : 100f;
        var paperKind = NativePrintLayout.IsoPaperKind(parsed.Name);
        var rawKind = paperKind;
        var installedIndex = -1;

        if (NativePrintLayout.IsIsoA4OrA5(parsed.Name))
        {
            if (installed is { Count: > 0 }
                && NativePrintLayout.TrySelectInstalledIsoForm(parsed.Name, installed, out var idx))
            {
                installedIndex = idx;
                paperKind = installed[idx].Kind;
                rawKind = installed[idx].RawKind;
                source = SourceInstalledForm;
            }
        }
        else if (NativePrintLayout.RequiresCustomPaperForm(parsed.Name))
        {
            source = SourceCustomFallback;
        }

        return new ResolvedPaperSpec(
            parsed.Name,
            parsed.Landscape,
            parsed.WidthHundredthsInch,
            parsed.HeightHundredthsInch,
            marginMm,
            copies,
            scale,
            spec.WidthMm,
            spec.HeightMm,
            source,
            paperKind,
            rawKind,
            installedIndex);
    }
}
