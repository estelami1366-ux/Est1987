using System.Text.Json.Nodes;

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

    public static PaymentAccountResult ApplyDeposit(JsonObject? account, double amount, string? subject, string? refId, string? refType, string? date)
    {
        var chk = Deposit(amount);
        if (!chk.Ok) return AccountFail("validation", chk.Error);
        account = Clone(account);
        if (account is null) return AccountFail("validation", "حساب پیدا نشد");
        amount = chk.Amount;
        var trx = NewTrx(account, "deposit", amount, subject ?? "واریز", refId, refType ?? "manual", date);
        EnsureTrx(account).Add(trx);
        account["balance"] = CalculationEngine.ToNum(account["balance"]?.ToString()) + amount;
        return new PaymentAccountResult { Ok = true, Account = account, Amount = amount, Transaction = trx };
    }

    public static PaymentAccountResult ApplyWithdraw(JsonObject? account, double amount, string? subject, string? date)
    {
        if (account is null) return AccountFail("validation", "حساب پیدا نشد");
        var balance = CalculationEngine.ToNum(account["balance"]?.ToString());
        var chk = Withdraw(balance, amount);
        if (!chk.Ok) return AccountFail(chk.Error == "موجودی کافی نیست" ? "business-rule" : "validation", chk.Error);
        account = Clone(account)!;
        amount = chk.Amount;
        var trx = NewTrx(account, "withdraw", -amount, subject ?? "برداشت", "", "manual", date);
        EnsureTrx(account).Add(trx);
        account["balance"] = chk.NewBalance;
        return new PaymentAccountResult { Ok = true, Account = account, Amount = amount, NewBalance = chk.NewBalance, Transaction = trx };
    }

    public static PaymentAccountResult EditTransaction(JsonObject? account, int trxIndex, double newAmount, string? date, string? subject, string? category, string? refNo)
    {
        account = Clone(account);
        if (account is null) return AccountFail("validation", "حساب پیدا نشد");
        var arr = EnsureTrx(account);
        if (trxIndex < 0 || trxIndex >= arr.Count || arr[trxIndex] is not JsonObject t)
            return AccountFail("validation", "تراکنش پیدا نشد");
        var chk = Deposit(newAmount);
        if (!chk.Ok) return AccountFail("validation", chk.Error);
        var oldAmt = CalculationEngine.ToNum(t["amount"]?.ToString());
        var type = JsonVal.Str(t, "type");
        var balance = CalculationEngine.ToNum(account["balance"]?.ToString()) - oldAmt;
        if (type == "deposit")
        {
            t["amount"] = chk.Amount;
            balance += chk.Amount;
        }
        else
        {
            if (chk.Amount > balance) return AccountFail("business-rule", "موجودی کافی نیست");
            t["amount"] = -chk.Amount;
            balance -= chk.Amount;
        }
        if (!string.IsNullOrEmpty(date)) t["date"] = date;
        if (subject != null) t["subject"] = subject;
        if (category != null) t["category"] = category;
        if (refNo != null) t["refNo"] = refNo;
        account["balance"] = balance;
        return new PaymentAccountResult { Ok = true, Account = account, Amount = chk.Amount, NewBalance = balance, Transaction = t };
    }

    public static PaymentAccountResult DeleteTransaction(JsonObject? account, int trxIndex)
    {
        account = Clone(account);
        if (account is null) return AccountFail("validation", "حساب پیدا نشد");
        var arr = EnsureTrx(account);
        if (trxIndex < 0 || trxIndex >= arr.Count || arr[trxIndex] is not JsonObject t)
            return AccountFail("validation", "تراکنش پیدا نشد");
        var oldAmt = CalculationEngine.ToNum(t["amount"]?.ToString());
        account["balance"] = CalculationEngine.ToNum(account["balance"]?.ToString()) - oldAmt;
        arr.RemoveAt(trxIndex);
        return new PaymentAccountResult { Ok = true, Account = account, NewBalance = CalculationEngine.ToNum(account["balance"]?.ToString()) };
    }

    private static JsonObject NewTrx(JsonObject account, string type, double amount, string subject, string? refId, string refType, string? date)
    {
        var n = EnsureTrx(account).Count + 1;
        return new JsonObject
        {
            ["id"] = "TRX-" + n.ToString("0000"),
            ["type"] = type,
            ["amount"] = amount,
            ["subject"] = subject,
            ["refId"] = refId ?? "",
            ["refType"] = refType,
            ["date"] = date ?? "",
            ["note"] = ""
        };
    }

    private static JsonArray EnsureTrx(JsonObject account)
    {
        if (account["transactions"] is not JsonArray arr)
        {
            arr = new JsonArray();
            account["transactions"] = arr;
        }
        return arr;
    }

    private static JsonObject? Clone(JsonObject? item) =>
        item is null ? null : System.Text.Json.Nodes.JsonNode.Parse(item.ToJsonString()) as JsonObject;

    private static PaymentAccountResult AccountFail(string kind, string err) =>
        new() { Ok = false, Kind = kind, Error = err };

    private static PaymentCheck Fail(string err) => new() { Ok = false, Error = err };
}

public sealed class PaymentAccountResult
{
    public bool Ok { get; init; }
    public string Kind { get; init; } = "";
    public string Error { get; init; } = "";
    public JsonObject Account { get; init; } = new();
    public JsonObject? Transaction { get; init; }
    public double Amount { get; init; }
    public double NewBalance { get; init; }
}

public sealed class PaymentCheck
{
    public bool Ok { get; init; }
    public string Error { get; init; } = "";
    public double Amount { get; init; }
    public double NewBalance { get; init; }
}
