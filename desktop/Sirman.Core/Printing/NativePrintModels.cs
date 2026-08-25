using System.Text.Json;
using System.Text.Json.Nodes;

namespace Sirman.Core.Printing;

public sealed class InvoicePrintLine
{
    public int Num { get; init; }
    public string Code { get; init; } = "";
    public string Model { get; init; } = "";
    public string Date { get; init; } = "";
    public string Color { get; init; } = "";
    public string Carton { get; init; } = "";
    public string Body { get; init; } = "";
    public string Acc { get; init; } = "";
    public string Miss { get; init; } = "";
    public string Perf { get; init; } = "";
    public bool Swapped { get; init; }
    public string NewSerial { get; init; } = "";
    public string Warranty { get; init; } = "";
    public string Svc { get; init; } = "";
    public string Note { get; init; } = "";
    public double Est { get; init; }
    public double Disc { get; init; }
    public double Fin { get; init; }

    public string BodyCell => Body;
    public string PerfCell => Swapped ? "تعویض" : Perf;
    public string NoteCell
    {
        get
        {
            if (Swapped && !string.IsNullOrWhiteSpace(NewSerial))
                return string.IsNullOrWhiteSpace(Note) ? ("نو: " + NewSerial) : (Note + " | نو: " + NewSerial);
            return Note;
        }
    }
}

public sealed class InvoicePrintModel
{
    public string Kind => NativePrintRequest.KindInvoice;
    public string InvoiceId { get; init; } = "";
    public string Number { get; init; } = "";
    public string Seller { get; init; } = "";
    public string Phone { get; init; } = "";
    public string Date { get; init; } = "";
    public string Status { get; init; } = "";
    public string Notes { get; init; } = "";
    public string BrandFa { get; init; } = "";
    public string LogoDataUrl { get; init; } = "";
    public double TotalEst { get; init; }
    public double TotalDisc { get; init; }
    public double TotalFin { get; init; }
    public string Font { get; init; } = "Tahoma";
    public string FontSize { get; init; } = "11px";
    public string Margin { get; init; } = "8mm";
    public bool Watermark { get; init; }
    public bool PageNumbers { get; init; }
    public IReadOnlyList<InvoicePrintLine> Lines { get; init; } = Array.Empty<InvoicePrintLine>();
}

public sealed class TestPagePrintModel
{
    public string Kind => NativePrintRequest.KindTestPage;
    public string Title { get; init; } = "SIRMAN NATIVE PRINT TEST";
    public string TitleFa { get; init; } = "آزمایش چاپ سیرمان";
    public string Printer { get; init; } = "";
    public string PrintedAt { get; init; } = "";
    public string Paper { get; init; } = "A4";
    public string Orientation { get; init; } = "portrait";
    public string MixedSample { get; init; } = "۱۲۳۴۵۶789";
}

/// <summary>
/// Postal label card fields actually printed by the HTML preview.
/// Sender name is collected in UI but is not printed — it is omitted here.
/// Date, tracking, barcode, and QR are not printed.
/// </summary>
public sealed class PostalParty
{
    public string Addr { get; init; } = "";
    public string Zip { get; init; } = "";
    public string Tel { get; init; } = "";
    public string Person { get; init; } = "";
    public string Name { get; init; } = "";
    public string Note { get; init; } = "";
}

public sealed class PostalLabelPrintModel
{
    public string Kind => NativePrintRequest.KindPostalLabel;
    public PostalParty Sender { get; init; } = new();
    public PostalParty Recipient { get; init; } = new();
    public string LogoSrc { get; init; } = "";
    public string BrandEn { get; init; } = "";
    public bool Border { get; init; } = true;
    public bool Fragile { get; init; } = true;
    public string Margin { get; init; } = "10mm";
}

public sealed record NativePrintRequest
{
    public const string KindTestPage = "testPage";
    public const string KindInvoice = "invoice";
    public const string KindPostalLabel = "postalLabel";
    public const string EngineNative = "native";

    public string Engine { get; init; } = EngineNative;
    public string Kind { get; init; } = "";
    public string PrinterName { get; init; } = "";
    public string Paper { get; init; } = "A4";
    public string Orientation { get; init; } = "portrait";
    public int Copies { get; init; } = 1;
    public string DocumentId { get; init; } = "";
    public string DocumentType { get; init; } = "";
    public string User { get; init; } = "";
    public string Purpose { get; init; } = "print";
    public InvoicePrintModel? Invoice { get; init; }
    public TestPagePrintModel? TestPage { get; init; }
    public PostalLabelPrintModel? PostalLabel { get; init; }
    public float WidthMm { get; init; }
    public float HeightMm { get; init; }

    public bool IsNativePaper =>
        string.Equals(Engine, EngineNative, StringComparison.OrdinalIgnoreCase)
        && (Kind is KindTestPage or KindInvoice or KindPostalLabel)
        && !string.Equals(Purpose, "pdf", StringComparison.OrdinalIgnoreCase);

    public static bool LooksNative(JsonObject o)
    {
        var engine = o["engine"]?.GetValue<string>() ?? "";
        var kind = o["kind"]?.GetValue<string>() ?? o["documentType"]?.GetValue<string>() ?? "";
        var purpose = o["purpose"]?.GetValue<string>() ?? "";
        if (string.Equals(purpose, "pdf", StringComparison.OrdinalIgnoreCase)) return false;
        if (string.Equals(engine, EngineNative, StringComparison.OrdinalIgnoreCase)) return true;
        return kind is KindTestPage or KindInvoice or KindPostalLabel && o["html"] is null;
    }

    public static bool TryParse(string? json, out NativePrintRequest request, out string error)
    {
        request = new NativePrintRequest();
        error = "";
        if (string.IsNullOrWhiteSpace(json))
        {
            error = "سندی برای چاپ نیست";
            return false;
        }
        try
        {
            var node = JsonNode.Parse(json) as JsonObject;
            if (node is null)
            {
                error = "سندی برای چاپ نیست";
                return false;
            }
            var kind = Str(node, "kind");
            if (kind.Length == 0) kind = Str(node, "documentType");
            var purpose = Str(node, "purpose");
            if (purpose.Length == 0) purpose = "print";
            var copies = 1;
            if (node["copies"] is JsonValue cv)
            {
                if (cv.TryGetValue<int>(out var n)) copies = n;
                else if (cv.TryGetValue<string>(out var s) && int.TryParse(s, out var ns)) copies = ns;
            }
            if (copies < NativePrintLayout.MinCopies || copies > NativePrintLayout.MaxCopies)
            {
                error = "تعداد کپی نامعتبر است.";
                return false;
            }

            var paper = Str(node, "paper");
            if (paper.Length == 0) paper = "A4";
            var orientation = Str(node, "orientation");
            if (node["landscape"] is JsonValue lv)
            {
                if (lv.TryGetValue<bool>(out var lb) && lb) orientation = "landscape";
                else if (lv.TryGetValue<string>(out var ls)
                         && (ls is "true" or "1" or "landscape" or "افقی"))
                    orientation = "landscape";
            }
            var printer = Str(node, "printerName");
            if (printer.Length == 0) printer = Str(node, "printer");
            var documentId = Str(node, "documentId");
            if (documentId.Length == 0) documentId = Str(node, "invoiceId");
            var documentType = Str(node, "documentType");
            if (documentType.Length == 0) documentType = kind;
            var user = Str(node, "user");
            var doc = node["document"] as JsonObject ?? node;
            var widthMm = Flt(node, "widthMm");
            if (widthMm <= 0) widthMm = Flt(doc, "widthMm");
            var heightMm = Flt(node, "heightMm");
            if (heightMm <= 0) heightMm = Flt(doc, "heightMm");

            if (kind == KindTestPage)
            {
                var test = ParseTestPage(doc, printer, paper, orientation);
                request = new NativePrintRequest
                {
                    Engine = EngineNative,
                    Kind = KindTestPage,
                    PrinterName = printer,
                    Paper = paper,
                    Orientation = orientation,
                    Copies = copies,
                    DocumentId = documentId.Length > 0 ? documentId : "native-test",
                    DocumentType = KindTestPage,
                    User = user,
                    Purpose = purpose,
                    TestPage = test,
                    WidthMm = widthMm,
                    HeightMm = heightMm
                };
                return true;
            }

            if (kind == KindPostalLabel)
            {
                var postal = ParsePostalLabel(doc);
                request = new NativePrintRequest
                {
                    Engine = EngineNative,
                    Kind = KindPostalLabel,
                    PrinterName = printer,
                    Paper = paper,
                    Orientation = orientation,
                    Copies = copies,
                    DocumentId = documentId.Length > 0 ? documentId : "postal-label",
                    DocumentType = KindPostalLabel,
                    User = user,
                    Purpose = purpose,
                    PostalLabel = postal,
                    WidthMm = widthMm,
                    HeightMm = heightMm
                };
                return true;
            }

            if (kind == KindInvoice)
            {
                if (!TryParseInvoice(doc, out var invoice, out error))
                    return false;
                request = new NativePrintRequest
                {
                    Engine = EngineNative,
                    Kind = KindInvoice,
                    PrinterName = printer,
                    Paper = paper,
                    Orientation = orientation,
                    Copies = copies,
                    DocumentId = documentId.Length > 0 ? documentId : invoice.InvoiceId,
                    DocumentType = KindInvoice,
                    User = user,
                    Purpose = purpose,
                    Invoice = invoice,
                    WidthMm = widthMm,
                    HeightMm = heightMm
                };
                return true;
            }

            error = "نوع سند بومی پشتیبانی نمی‌شود";
            return false;
        }
        catch (Exception ex)
        {
            error = "سندی برای چاپ نیست: " + ex.Message;
            return false;
        }
    }

    private static PostalLabelPrintModel ParsePostalLabel(JsonObject doc)
    {
        var sender = doc["sender"] as JsonObject;
        var recipient = doc["recipient"] as JsonObject;
        var margin = Str(doc, "margin");
        return new PostalLabelPrintModel
        {
            Sender = ParsePostalParty(sender),
            Recipient = ParsePostalParty(recipient),
            LogoSrc = FirstNonEmpty(Str(doc, "logoSrc"), Str(doc, "logoDataUrl"), Str(doc, "logo")),
            BrandEn = Str(doc, "brandEn"),
            Border = doc["border"] is null || Bool(doc, "border"),
            Fragile = doc["fragile"] is null || Bool(doc, "fragile"),
            Margin = margin.Length > 0 ? margin : "10mm"
        };
    }

    private static PostalParty ParsePostalParty(JsonObject? o)
    {
        if (o is null) return new PostalParty();
        return new PostalParty
        {
            Addr = FirstNonEmpty(Str(o, "addr"), Str(o, "address")),
            Zip = FirstNonEmpty(Str(o, "zip"), Str(o, "postalCode")),
            Tel = FirstNonEmpty(Str(o, "tel"), Str(o, "phone")),
            Person = Str(o, "person"),
            Name = Str(o, "name"),
            Note = Str(o, "note")
        };
    }

    private static TestPagePrintModel ParseTestPage(JsonObject doc, string printer, string paper, string orientation) =>
        new()
        {
            Printer = Str(doc, "printer").Length > 0 ? Str(doc, "printer") : printer,
            PrintedAt = Str(doc, "printedAt"),
            Paper = Str(doc, "paper").Length > 0 ? Str(doc, "paper") : paper,
            Orientation = Str(doc, "orientation").Length > 0 ? Str(doc, "orientation") : orientation,
            Title = Str(doc, "title").Length > 0 ? Str(doc, "title") : "SIRMAN NATIVE PRINT TEST",
            TitleFa = Str(doc, "titleFa").Length > 0 ? Str(doc, "titleFa") : "آزمایش چاپ سیرمان",
            MixedSample = Str(doc, "mixedSample").Length > 0 ? Str(doc, "mixedSample") : "۱۲۳۴۵۶789"
        };

    private static bool TryParseInvoice(JsonObject doc, out InvoicePrintModel invoice, out string error)
    {
        error = "";
        invoice = new InvoicePrintModel();
        var number = Str(doc, "number");
        if (number.Length == 0) number = Str(doc, "num");
        var seller = Str(doc, "seller");
        var linesNode = doc["lines"] as JsonArray ?? doc["items"] as JsonArray;
        var lines = new List<InvoicePrintLine>();
        if (linesNode is not null)
        {
            var i = 0;
            foreach (var n in linesNode)
            {
                if (n is not JsonObject o) continue;
                i++;
                var body = Str(o, "body");
                var dmg = Str(o, "dmg");
                if (dmg.Length > 0) body = string.IsNullOrEmpty(body) ? dmg : body + "/" + dmg;
                lines.Add(new InvoicePrintLine
                {
                    Num = Int(o, "num", i),
                    Code = Str(o, "code"),
                    Model = Str(o, "model"),
                    Date = Str(o, "date"),
                    Color = Str(o, "color"),
                    Carton = Str(o, "carton"),
                    Body = body,
                    Acc = Cell(o, "acc"),
                    Miss = Cell(o, "miss"),
                    Perf = Str(o, "perf"),
                    Swapped = Bool(o, "swapped") || Str(o, "perf") is "تعویض شد" or "تعویض",
                    NewSerial = Str(o, "newSerial"),
                    Warranty = Str(o, "warranty"),
                    Svc = Str(o, "svc"),
                    Note = Str(o, "pd").Length > 0 ? Str(o, "pd") : Str(o, "note"),
                    Est = Num(o, "est"),
                    Disc = Num(o, "disc"),
                    Fin = Num(o, "fin")
                });
            }
        }
        if (string.IsNullOrWhiteSpace(seller))
        {
            error = "نام فروشنده الزامی است";
            return false;
        }
        if (lines.Count == 0)
        {
            error = "دستگاهی ثبت نشده";
            return false;
        }
        invoice = new InvoicePrintModel
        {
            InvoiceId = Str(doc, "invoiceId"),
            Number = number,
            Seller = seller,
            Phone = Str(doc, "phone"),
            Date = Str(doc, "date"),
            Status = Str(doc, "status"),
            Notes = Str(doc, "notes"),
            BrandFa = Str(doc, "brandFa"),
            LogoDataUrl = FirstNonEmpty(Str(doc, "logoDataUrl"), Str(doc, "logoSrc"), Str(doc, "logo")),
            TotalEst = Num(doc, "tE"),
            TotalDisc = Num(doc, "tD"),
            TotalFin = Num(doc, "tF"),
            Font = Str(doc, "font").Length > 0 ? Str(doc, "font") : "Tahoma",
            FontSize = Str(doc, "fontsize").Length > 0 ? Str(doc, "fontsize") : "11px",
            Margin = Str(doc, "margin").Length > 0 ? Str(doc, "margin") : "8mm",
            Watermark = Bool(doc, "watermark"),
            PageNumbers = Bool(doc, "pagenum") || Bool(doc, "pageNumbers"),
            Lines = lines
        };
        return true;
    }

    private static string FirstNonEmpty(params string[] values)
    {
        foreach (var v in values)
            if (!string.IsNullOrWhiteSpace(v)) return v;
        return "";
    }

    private static string Cell(JsonObject o, string k)
    {
        if (o[k] is JsonArray arr)
            return string.Join("،", arr.Select(n =>
            {
                if (n is JsonValue v && v.TryGetValue<string>(out var s)) return s ?? "";
                return n?.ToString()?.Trim('"') ?? "";
            }).Where(s => s.Length > 0));
        return Str(o, k);
    }

    private static string Str(JsonObject o, string k)
    {
        if (o[k] is not JsonValue v) return "";
        return v.TryGetValue<string>(out var s) ? (s ?? "") : v.ToJsonString().Trim('"');
    }

    private static int Int(JsonObject o, string k, int fallback)
    {
        if (o[k] is not JsonValue v) return fallback;
        if (v.TryGetValue<int>(out var n)) return n;
        if (v.TryGetValue<string>(out var s) && int.TryParse(s, out var ns)) return ns;
        return fallback;
    }

    private static double Num(JsonObject o, string k)
    {
        if (o[k] is not JsonValue v) return 0;
        if (v.TryGetValue<double>(out var d)) return d;
        if (v.TryGetValue<int>(out var n)) return n;
        if (v.TryGetValue<string>(out var s)
            && double.TryParse(s, System.Globalization.NumberStyles.Float, System.Globalization.CultureInfo.InvariantCulture, out var ds))
            return ds;
        return 0;
    }

    private static float Flt(JsonObject o, string k)
    {
        if (o[k] is not JsonValue v) return 0;
        if (v.TryGetValue<float>(out var f)) return f;
        if (v.TryGetValue<double>(out var d)) return (float)d;
        if (v.TryGetValue<int>(out var n)) return n;
        if (v.TryGetValue<string>(out var s)
            && float.TryParse(s, System.Globalization.NumberStyles.Float, System.Globalization.CultureInfo.InvariantCulture, out var fs))
            return fs;
        return 0;
    }

    private static bool Bool(JsonObject o, string k)
    {
        if (o[k] is not JsonValue v) return false;
        if (v.TryGetValue<bool>(out var b)) return b;
        var s = Str(o, k).ToLowerInvariant();
        return s is "1" or "true" or "yes";
    }
}
