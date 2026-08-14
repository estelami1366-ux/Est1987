namespace Sirman.Core.Business;

/// <summary>قوانین فعلی withdrawFromAccount / مانده — ذخیره در UI می‌ماند.</summary>
public static class PaymentRules
{
    public static PaymentCheck Withdraw(double balance, double amount)
    {
        amount = double.IsFinite(amount) ? (int)amount : 0;
        if (amount <= 0) return Fail("مبلغ نامعتبر");
        if (amount > (double.IsFinite(balance) ? balance : 0)) return Fail("موجودی کافی نیست");
        return new PaymentCheck { Ok = true, NewBalance = (double.IsFinite(balance) ? balance : 0) - amount, Amount = amount };
    }

    public static PaymentCheck Deposit(double amount)
    {
        amount = double.IsFinite(amount) ? (int)amount : 0;
        if (amount <= 0) return Fail("مبلغ نامعتبر");
        return new PaymentCheck { Ok = true, Amount = amount };
    }

    public static double Remaining(double total, double paid) => CalculationEngine.Balance(total, paid);

    private static PaymentCheck Fail(string err) => new() { Ok = false, Error = err };
}

public sealed class PaymentCheck
{
    public bool Ok { get; init; }
    public string Error { get; init; } = "";
    public double Amount { get; init; }
    public double NewBalance { get; init; }
}
