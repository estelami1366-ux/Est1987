namespace Sirman.Core.Business;

/// <summary>همان منطق calcT / getData / calcSaleTotal — تخفیف percents با Math.round.</summary>
public static class InvoicePricing
{
    public static InvoiceLine Line(double est, double disc, double finRaw)
    {
        if (!double.IsFinite(est)) est = 0;
        if (!double.IsFinite(disc)) disc = 0;
        if (!double.IsFinite(finRaw)) finRaw = 0;
        var da = CalculationEngine.JsRound(est * disc / 100);
        var fin = disc > 0 ? (est - da) : (finRaw != 0 ? finRaw : (est - da));
        return new InvoiceLine { Est = est, Disc = disc, Da = da, Fin = fin };
    }

    public static InvoiceTotals Totals(IEnumerable<InvoiceLine> lines)
    {
        double tE = 0, tD = 0, tF = 0;
        foreach (var l in lines)
        {
            tE += l.Est;
            tD += l.Da;
            tF += l.Fin;
        }
        return new InvoiceTotals { TE = tE, TD = tD, TF = tF };
    }

    public static SaleLine SaleLine(double qty, double price, double disc)
    {
        if (!double.IsFinite(qty)) qty = 1;
        if (qty == 0) qty = 1;
        if (!double.IsFinite(price)) price = 0;
        if (!double.IsFinite(disc)) disc = 0;
        var discAmt = CalculationEngine.JsRound(price * disc / 100);
        var total = CalculationEngine.JsRound(qty * (price - discAmt));
        return new SaleLine { Qty = qty, Price = price, Disc = disc, DiscAmt = discAmt, Total = total };
    }

    public static double SaleTotal(IEnumerable<SaleLine> lines)
    {
        double sum = 0;
        foreach (var l in lines) sum += l.Total;
        return sum;
    }
}

public sealed class InvoiceLine
{
    public double Est { get; init; }
    public double Disc { get; init; }
    public double Da { get; init; }
    public double Fin { get; init; }
}

public sealed class InvoiceTotals
{
    public double TE { get; init; }
    public double TD { get; init; }
    public double TF { get; init; }
}

public sealed class SaleLine
{
    public double Qty { get; init; }
    public double Price { get; init; }
    public double Disc { get; init; }
    public double DiscAmt { get; init; }
    public double Total { get; init; }
}
