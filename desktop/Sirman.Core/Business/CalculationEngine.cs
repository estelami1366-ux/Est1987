using System.Globalization;

namespace Sirman.Core.Business;

/// <summary>
/// همان فرمول‌های SmartCore در Sirman_Final.html — مرجع نهایی در exe.
/// </summary>
public static class CalculationEngine
{
    public static string WarrantyEndDate(string? purchaseDate, object? periodMonths)
    {
        var months = ToInt(periodMonths);
        return AddJalaliMonths(purchaseDate, months);
    }

    public static string AddJalaliMonths(string? jdate, int months)
    {
        if (string.IsNullOrEmpty(jdate) || months == 0) return jdate ?? "";
        var p = jdate.Split('/', '-', StringSplitOptions.None);
        if (p.Length < 3 || !int.TryParse(p[0], NumberStyles.Integer, CultureInfo.InvariantCulture, out var y) || y == 0)
            return jdate;
        if (!int.TryParse(p[1], NumberStyles.Integer, CultureInfo.InvariantCulture, out var m)) return jdate;
        if (!int.TryParse(p[2], NumberStyles.Integer, CultureInfo.InvariantCulture, out var d)) return jdate;
        m += months;
        while (m > 12) { m -= 12; y++; }
        while (m < 1) { m += 12; y--; }
        var maxD = m <= 6 ? 31 : (m <= 11 ? 30 : 29);
        if (d > maxD) d = maxD;
        return y + "/" + Pad(m) + "/" + Pad(d);
    }

    public static double Balance(object? totalAmount, object? paidAmount) =>
        ToNum(totalAmount) - ToNum(paidAmount);

    public static double FinalAmount(object? partsCost, object? laborCost, object? otherCosts, object? discount) =>
        ToNum(partsCost) + ToNum(laborCost) + ToNum(otherCosts) - ToNum(discount);

    public static double AvailableStock(object? currentStock, object? reservedStock) =>
        Math.Max(0, ToNum(currentStock) - ToNum(reservedStock));

    public static double ReorderPoint(object? averageUsage, object? leadTime, object? safetyStock) =>
        (ToNum(averageUsage) * ToNum(leadTime)) + ToNum(safetyStock);

    public static string SlaStatusFromAgeHours(object? ageH)
    {
        var n = ToInt(ageH);
        if (n < 24) return "normal";
        if (n < 48) return "warning";
        if (n < 72) return "critical";
        return "overdue";
    }

    public static double ToNum(object? v)
    {
        if (v is null) return 0;
        if (v is double d) return double.IsFinite(d) ? d : 0;
        if (v is float f) return double.IsFinite(f) ? f : 0;
        if (v is int i) return i;
        if (v is long l) return l;
        if (v is decimal m) return (double)m;
        var s = Convert.ToString(v, CultureInfo.InvariantCulture);
        if (string.IsNullOrWhiteSpace(s)) return 0;
        if (!double.TryParse(s, NumberStyles.Any, CultureInfo.InvariantCulture, out var n) || !double.IsFinite(n)) return 0;
        return n;
    }

    public static int ToInt(object? v)
    {
        var n = ToNum(v);
        if (!double.IsFinite(n)) return 0;
        return (int)n;
    }

    public static int JsRound(double n) => (int)Math.Round(n, MidpointRounding.AwayFromZero);

    private static string Pad(int n) => n < 10 ? "0" + n : n.ToString(CultureInfo.InvariantCulture);
}
