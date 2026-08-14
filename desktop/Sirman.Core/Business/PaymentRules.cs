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

    public static PaymentAccountResult ApplyWithdraw(JsonObject? account, double amount, string? subject, string? date) =>
        ApplyWithdraw(account, amount, subject, date, "", "manual");

    public static PaymentAccountResult ApplyWithdraw(JsonObject? account, double amount, string? subject, string? date, string? refId, string? refType)
    {
        if (account is null) return AccountFail("validation", "حساب پیدا نشد");
        var balance = CalculationEngine.ToNum(account["balance"]?.ToString());
        var chk = Withdraw(balance, amount);
        if (!chk.Ok) return AccountFail(chk.Error == "موجودی کافی نیست" ? "business-rule" : "validation", chk.Error);
        account = Clone(account)!;
        amount = chk.Amount;
        var type = string.IsNullOrWhiteSpace(refType) ? "manual" : refType;
        var trx = NewTrx(account, "withdraw", -amount, subject ?? "برداشت", refId ?? "", type, date);
        EnsureTrx(account).Add(trx);
        account["balance"] = chk.NewBalance;
        return new PaymentAccountResult { Ok = true, Account = account, Amount = amount, NewBalance = chk.NewBalance, Transaction = trx };
    }

    /// <summary>حذف همه تراکنش‌های همین منبع (refId+refType) و برگشت مانده از روی مبلغ همان تراکنش‌ها.</summary>
    public static PaymentAccountResult ReverseLinked(JsonObject? account, string? refId, string? refType)
    {
        account = Clone(account);
        if (account is null) return AccountFail("validation", "حساب پیدا نشد");
        if (string.IsNullOrWhiteSpace(refId) || string.IsNullOrWhiteSpace(refType))
            return new PaymentAccountResult { Ok = true, Account = account, RemovedCount = 0, NewBalance = CalculationEngine.ToNum(account["balance"]?.ToString()) };
        var arr = EnsureTrx(account);
        var removed = 0;
        for (var i = arr.Count - 1; i >= 0; i--)
        {
            if (arr[i] is not JsonObject t) continue;
            if (JsonVal.Str(t, "refId") != refId) continue;
            if (JsonVal.Str(t, "refType") != refType) continue;
            var oldAmt = CalculationEngine.ToNum(t["amount"]?.ToString());
            account["balance"] = CalculationEngine.ToNum(account["balance"]?.ToString()) - oldAmt;
            arr.RemoveAt(i);
            removed++;
        }
        return new PaymentAccountResult
        {
            Ok = true,
            Account = account,
            RemovedCount = removed,
            NewBalance = CalculationEngine.ToNum(account["balance"]?.ToString())
        };
    }

    /// <summary>قانون ساده: هر تراکنش مالی که مال همین سند است (refId) با حذف سند برمی‌گردد. نوع واریز/برداشت مهم نیست.</summary>
    public static PaymentAccountResult ReverseOwned(JsonObject? account, string? documentId) =>
        ReverseOwnedMax(account, documentId, int.MaxValue, null);

    /// <summary>
    /// برگشت تراکنش‌های همین شماره سند، حداکثر maxCount تا.
    /// اگر دو سند زنده شماره یکسان داشته باشند، فقط یک تراکنش (ترجیحاً با همان مبلغ) برمی‌گردد.
    /// </summary>
    public static PaymentAccountResult ReverseOwnedMax(JsonObject? account, string? documentId, int maxCount, double? amountHint)
    {
        account = Clone(account);
        if (account is null) return AccountFail("validation", "حساب پیدا نشد");
        if (string.IsNullOrWhiteSpace(documentId) || maxCount <= 0)
            return new PaymentAccountResult { Ok = true, Account = account, RemovedCount = 0, NewBalance = CalculationEngine.ToNum(account["balance"]?.ToString()) };
        var arr = EnsureTrx(account);
        var removed = 0;
        var limited = maxCount < int.MaxValue;
        var hint = amountHint is double h && h > 0 ? h : 0d;
        if (limited && hint > 0)
        {
            for (var i = arr.Count - 1; i >= 0 && removed < maxCount; i--)
            {
                if (arr[i] is not JsonObject t) continue;
                if (!OwnsDocument(t, documentId)) continue;
                var oldAmt = CalculationEngine.ToNum(t["amount"]?.ToString());
                if (Math.Abs(Math.Abs(oldAmt) - hint) > 0.0001) continue;
                account["balance"] = CalculationEngine.ToNum(account["balance"]?.ToString()) - oldAmt;
                arr.RemoveAt(i);
                removed++;
            }
            if (removed > 0)
            {
                return new PaymentAccountResult
                {
                    Ok = true,
                    Account = account,
                    RemovedCount = removed,
                    NewBalance = CalculationEngine.ToNum(account["balance"]?.ToString())
                };
            }
        }
        for (var i = arr.Count - 1; i >= 0 && removed < maxCount; i--)
        {
            if (arr[i] is not JsonObject t) continue;
            if (!OwnsDocument(t, documentId)) continue;
            var oldAmt = CalculationEngine.ToNum(t["amount"]?.ToString());
            account["balance"] = CalculationEngine.ToNum(account["balance"]?.ToString()) - oldAmt;
            arr.RemoveAt(i);
            removed++;
        }
        return new PaymentAccountResult
        {
            Ok = true,
            Account = account,
            RemovedCount = removed,
            NewBalance = CalculationEngine.ToNum(account["balance"]?.ToString())
        };
    }

    private static bool OwnsDocument(JsonObject t, string documentId)
    {
        if (JsonVal.Str(t, "refId") == documentId) return true;
        if (JsonVal.Str(t, "refId").Length > 0) return false;
        var subject = JsonVal.Str(t, "subject");
        return documentId.Length >= 3 && subject.Contains(documentId, StringComparison.Ordinal);
    }

    /// <summary>برگشت یک برداشت قدیمی بدون refId — فقط اگر مبلغ و موضوع به همان منبع بخورد.</summary>
    public static PaymentAccountResult ReverseMatchingWithdraw(JsonObject? account, double amount, string? subjectContains)
    {
        account = Clone(account);
        if (account is null) return AccountFail("validation", "حساب پیدا نشد");
        if (amount <= 0) return new PaymentAccountResult { Ok = true, Account = account, RemovedCount = 0 };
        var arr = EnsureTrx(account);
        var needle = subjectContains ?? "";
        for (var i = arr.Count - 1; i >= 0; i--)
        {
            if (arr[i] is not JsonObject t) continue;
            var type = JsonVal.Str(t, "type");
            var oldAmt = CalculationEngine.ToNum(t["amount"]?.ToString());
            var isWithdraw = type == "withdraw" || oldAmt < 0;
            if (!isWithdraw) continue;
            if (Math.Abs(Math.Abs(oldAmt) - amount) > 0.0001) continue;
            if (needle.Length > 0 && !JsonVal.Str(t, "subject").Contains(needle, StringComparison.Ordinal)) continue;
            account["balance"] = CalculationEngine.ToNum(account["balance"]?.ToString()) - oldAmt;
            arr.RemoveAt(i);
            return new PaymentAccountResult
            {
                Ok = true,
                Account = account,
                RemovedCount = 1,
                NewBalance = CalculationEngine.ToNum(account["balance"]?.ToString())
            };
        }
        return new PaymentAccountResult
        {
            Ok = true,
            Account = account,
            RemovedCount = 0,
            NewBalance = CalculationEngine.ToNum(account["balance"]?.ToString())
        };
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
    public int RemovedCount { get; init; }
}

public sealed class PaymentCheck
{
    public bool Ok { get; init; }
    public string Error { get; init; } = "";
    public double Amount { get; init; }
    public double NewBalance { get; init; }
}
