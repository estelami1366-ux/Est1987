using System.Text.Json.Nodes;

namespace Sirman.Core.Business;

/// <summary>
/// برگشت اثر جانبی حذف فاکتور/گارانتی — موجودی و حساب فقط از روی تراکنش منبع.
/// عدد دستی موجودی/مانده پذیرفته نیست.
/// </summary>
public static class TransactionReversal
{
    public static ReversalResult DeleteInvoice(JsonObject? payload)
    {
        payload ??= new JsonObject();
        var invoices = CloneArr(payload["invoices"] as JsonArray);
        var inventory = CloneObj(payload["inventory"] as JsonObject) ?? new JsonObject();
        var accounts = CloneArr(payload["accounts"] as JsonArray);
        var parts = CloneArr(payload["parts"] as JsonArray);
        var now = JsonVal.Str(payload, "now");
        var user = JsonVal.Str(payload, "user");

        var invoice = CloneObj(payload["invoice"] as JsonObject);
        var id = FirstNonEmpty(JsonVal.Str(payload, "invoiceId"), JsonVal.Str(invoice, "num"), JsonVal.Str(invoice, "id"));
        int idx = ResolveClickedIndex(invoices, payload, "invoiceIndex", id, "num", "id");
        if (invoice is null && idx >= 0)
            invoice = CloneObj(invoices[idx] as JsonObject);
        if (string.IsNullOrEmpty(id))
            id = FirstNonEmpty(JsonVal.Str(invoice, "num"), JsonVal.Str(invoice, "id"));
        if (idx < 0 && !string.IsNullOrEmpty(id))
            idx = IndexOf(invoices, id, "num", "id");

        if (idx < 0 && payload.ContainsKey("invoices"))
            return Already(id, "invoice.delete", "invoice", user, now, inventory, accounts, parts, invoices);

        if (invoice is null || string.IsNullOrEmpty(id))
            return Already(id, "invoice.delete", "invoice", user, now, inventory, accounts, parts, invoices);

        if (Flag(invoice, "_reversed") || idx < 0 && Flag(payload, "alreadyGone"))
        {
            if (idx >= 0) invoices.RemoveAt(idx);
            return Already(id, "invoice.delete", "invoice", user, now, inventory, accounts, parts, invoices);
        }

        var restocked = new JsonArray();
        var payCount = 0;
        var closed = IsClosedInvoice(invoice);
        var stockDone = Flag(invoice, "_stockReversed");
        var finDone = Flag(invoice, "_financeReversed");

        if (closed && !stockDone)
        {
            if (invoice["items"] is JsonArray items)
            {
                foreach (var n in items)
                {
                    if (n is not JsonObject it) continue;
                    var code = JsonVal.Str(it, "code");
                    if (code.Length == 0) continue;
                    // همان مصرف closeInv: هر ردیف دستگاه با کد، یک واحد
                    var qty = 1;
                    var live = inventory[code] as JsonObject;
                    if (live is null)
                    {
                        live = new JsonObject { ["code"] = code, ["qty"] = 0 };
                        inventory[code] = live;
                    }
                    var add = InventoryCore.AddStock(live, qty);
                    if (!add.Ok || add.Item is null)
                        return Fail("business-rule", add.Error, inventory, accounts, parts, invoices);
                    inventory[code] = add.Item;
                    restocked.Add(Line(code, JsonVal.Str(it, "model"), qty, "product"));
                }
            }
        }

        if (!finDone)
        {
            payCount += ReverseOwnedForClicked(accounts, invoices, idx, id, invoice, "num", "id");
        }

        if (idx >= 0) invoices.RemoveAt(idx);
        else
        {
            var found = IndexOf(invoices, id, "num", "id");
            if (found >= 0) invoices.RemoveAt(found);
        }

        return OkResult("invoice.delete", "invoice", id, user, now, inventory, accounts, parts, invoices, restocked, payCount);
    }

    public static ReversalResult DeleteWarranty(JsonObject? payload)
    {
        payload ??= new JsonObject();
        var warranties = CloneArr(payload["warranties"] as JsonArray);
        var inventory = CloneObj(payload["inventory"] as JsonObject) ?? new JsonObject();
        var accounts = CloneArr(payload["accounts"] as JsonArray);
        var parts = CloneArr(payload["parts"] as JsonArray);
        var now = JsonVal.Str(payload, "now");
        var user = JsonVal.Str(payload, "user");

        var record = CloneObj(payload["record"] as JsonObject) ?? CloneObj(payload["warranty"] as JsonObject);
        var id = FirstNonEmpty(JsonVal.Str(payload, "warrantyId"), JsonVal.Str(record, "id"));
        int idx = ResolveClickedIndex(warranties, payload, "warrantyIndex", id, "id");
        if (record is null && idx >= 0)
            record = CloneObj(warranties[idx] as JsonObject);
        if (string.IsNullOrEmpty(id))
            id = JsonVal.Str(record, "id");
        if (idx < 0 && !string.IsNullOrEmpty(id))
            idx = IndexOf(warranties, id, "id");

        if (idx < 0 && payload.ContainsKey("warranties"))
            return Already(id, "warranty.delete", "warranty", user, now, inventory, accounts, parts, warranties);

        if (record is null || string.IsNullOrEmpty(id))
            return Already(id, "warranty.delete", "warranty", user, now, inventory, accounts, parts, warranties);

        if (Flag(record, "_reversed"))
        {
            if (idx >= 0) warranties.RemoveAt(idx);
            return Already(id, "warranty.delete", "warranty", user, now, inventory, accounts, parts, warranties);
        }

        var restocked = new JsonArray();
        var payCount = 0;
        var stockDone = Flag(record, "_stockReversed");
        var finDone = Flag(record, "_financeReversed");

        if (!stockDone)
        {
            foreach (var flagKey in new[] { "_agencyStockApplied", "_companyStockApplied" })
            {
                if (record[flagKey] is not JsonObject flag) continue;
                if (!Flag(flag, "applied")) continue;
                if (flag["items"] is not JsonArray items) continue;
                foreach (var n in items)
                {
                    if (n is not JsonObject it) continue;
                    var code = FirstNonEmpty(JsonVal.Str(it, "code"), JsonVal.Str(it, "partCode"));
                    if (code.Length == 0) continue;
                    var qty = Math.Max(1, CalculationEngine.ToInt(it["qty"]?.ToString()));
                    var part = FindPart(parts, code);
                    if (part is null)
                    {
                        part = new JsonObject { ["code"] = code, ["name"] = JsonVal.Str(it, "name"), ["qty"] = 0 };
                        parts.Add(part);
                    }
                    var add = InventoryCore.AddStock(part, qty);
                    if (!add.Ok || add.Item is null)
                        return Fail("business-rule", add.Error, inventory, accounts, parts, warranties);
                    ReplacePart(parts, code, add.Item);
                    restocked.Add(Line(code, FirstNonEmpty(JsonVal.Str(it, "name"), JsonVal.Str(it, "partName")), qty, "part"));
                }
            }
        }

        if (!finDone)
        {
            payCount += ReverseOwnedForClicked(accounts, warranties, idx, id, record, "id");
            if (record["_agencyPayApplied"] is JsonObject pay && Flag(pay, "applied"))
            {
                var accId = JsonVal.Str(pay, "accountId");
                var amt = CalculationEngine.ToNum(pay["amount"]?.ToString());
                payCount += ReverseMatchingWithdraw(accounts, accId, amt, id);
            }
        }

        if (idx >= 0) warranties.RemoveAt(idx);
        else
        {
            var found = IndexOf(warranties, id, "id");
            if (found >= 0) warranties.RemoveAt(found);
        }

        return OkResult("warranty.delete", "warranty", id, user, now, inventory, accounts, parts, warranties, restocked, payCount);
    }

    public static ReversalResult DeleteSale(JsonObject? payload)
    {
        payload ??= new JsonObject();
        var sales = CloneArr(payload["sales"] as JsonArray);
        var inventory = CloneObj(payload["inventory"] as JsonObject) ?? new JsonObject();
        var accounts = CloneArr(payload["accounts"] as JsonArray);
        var parts = CloneArr(payload["parts"] as JsonArray);
        var now = JsonVal.Str(payload, "now");
        var user = JsonVal.Str(payload, "user");

        var sale = CloneObj(payload["sale"] as JsonObject) ?? CloneObj(payload["record"] as JsonObject);
        var id = FirstNonEmpty(JsonVal.Str(payload, "saleId"), JsonVal.Str(sale, "id"));
        int idx = ResolveClickedIndex(sales, payload, "saleIndex", id, "id");
        if (sale is null && idx >= 0)
            sale = CloneObj(sales[idx] as JsonObject);
        if (string.IsNullOrEmpty(id))
            id = JsonVal.Str(sale, "id");
        if (idx < 0 && !string.IsNullOrEmpty(id))
            idx = IndexOf(sales, id, "id");

        if (idx < 0 && payload.ContainsKey("sales"))
            return Already(id, "sale.delete", "sale", user, now, inventory, accounts, parts, sales);

        if (sale is null || string.IsNullOrEmpty(id))
            return Already(id, "sale.delete", "sale", user, now, inventory, accounts, parts, sales);

        if (Flag(sale, "_reversed"))
        {
            if (idx >= 0) sales.RemoveAt(idx);
            return Already(id, "sale.delete", "sale", user, now, inventory, accounts, parts, sales);
        }

        var restocked = new JsonArray();
        var payCount = 0;
        var isProforma = JsonVal.Str(sale, "status") == "proforma";
        var stockDone = Flag(sale, "_stockReversed");
        var finDone = Flag(sale, "_financeReversed");

        if (!isProforma && !stockDone)
        {
            JsonArray? items = sale["items"] as JsonArray;
            if (items is null && JsonVal.Str(sale, "partCode").Length > 0)
            {
                items = new JsonArray
                {
                    new JsonObject
                    {
                        ["partCode"] = JsonVal.Str(sale, "partCode"),
                        ["partName"] = JsonVal.Str(sale, "partName"),
                        ["qty"] = Math.Max(1, CalculationEngine.ToInt(sale["qty"]?.ToString()))
                    }
                };
            }
            if (items is not null)
            {
                foreach (var n in items)
                {
                    if (n is not JsonObject it) continue;
                    var code = FirstNonEmpty(JsonVal.Str(it, "partCode"), JsonVal.Str(it, "code"));
                    if (code.Length == 0) continue;
                    var qty = Math.Max(1, CalculationEngine.ToInt(it["qty"]?.ToString()));
                    var part = FindPart(parts, code);
                    if (part is null)
                    {
                        part = new JsonObject { ["code"] = code, ["name"] = JsonVal.Str(it, "partName"), ["qty"] = 0 };
                        parts.Add(part);
                    }
                    var add = InventoryCore.AddStock(part, qty);
                    if (!add.Ok || add.Item is null)
                        return Fail("business-rule", add.Error, inventory, accounts, parts, sales);
                    ReplacePart(parts, code, add.Item);
                    restocked.Add(Line(code, JsonVal.Str(it, "partName"), qty, "part"));
                }
            }
        }

        if (!isProforma && !finDone)
            payCount += ReverseOwnedForClicked(accounts, sales, idx, id, sale, "id");

        if (idx >= 0) sales.RemoveAt(idx);
        else
        {
            var found = IndexOf(sales, id, "id");
            if (found >= 0) sales.RemoveAt(found);
        }

        return OkResult("sale.delete", "sale", id, user, now, inventory, accounts, parts, sales, restocked, payCount);
    }

    private static int ReverseAllOwned(JsonArray accounts, string docId) =>
        ReverseOwnedAcross(accounts, docId, int.MaxValue, null);

    private static int ReverseOwnedForClicked(JsonArray accounts, JsonArray records, int idx, string id, JsonObject? record, params string[] idKeys)
    {
        var others = CountSameId(records, id, idx, idKeys);
        if (others > 0)
        {
            var hint = record is null ? 0d : CalculationEngine.ToNum(record["total"]?.ToString());
            return ReverseOwnedAcross(accounts, id, 1, hint > 0 ? hint : null);
        }
        return ReverseAllOwned(accounts, id);
    }

    private static int ReverseOwnedAcross(JsonArray accounts, string docId, int maxCount, double? amountHint)
    {
        var n = 0;
        var left = maxCount;
        for (var i = 0; i < accounts.Count; i++)
        {
            if (left <= 0) break;
            if (accounts[i] is not JsonObject acc) continue;
            var r = PaymentRules.ReverseOwnedMax(acc, docId, left, amountHint);
            if (r.Account is not null) accounts[i] = r.Account;
            n += r.RemovedCount;
            left -= r.RemovedCount;
        }
        return n;
    }

    private static int ReverseMatchingWithdraw(JsonArray accounts, string accId, double amount, string subjectContains)
    {
        if (string.IsNullOrEmpty(accId) || amount <= 0) return 0;
        for (var i = 0; i < accounts.Count; i++)
        {
            if (accounts[i] is not JsonObject acc) continue;
            if (JsonVal.Str(acc, "id") != accId) continue;
            var r = PaymentRules.ReverseMatchingWithdraw(acc, amount, subjectContains);
            if (r.Account is not null) accounts[i] = r.Account;
            return r.RemovedCount;
        }
        return 0;
    }

    private static bool IsClosedInvoice(JsonObject invoice)
    {
        var st = JsonVal.Str(invoice, "status");
        if (st == "closed") return true;
        if (Flag(invoice, "_closed")) return true;
        return !string.IsNullOrEmpty(JsonVal.Str(invoice, "closedAt"));
    }

    private static ReversalResult Already(string id, string action, string entity, string user, string now,
        JsonObject inventory, JsonArray accounts, JsonArray parts, JsonArray records) =>
        new()
        {
            Ok = true,
            AlreadyReversed = true,
            Inventory = inventory,
            Accounts = accounts,
            Parts = parts,
            Records = records,
            RemovedId = id,
            Restocked = new JsonArray(),
            ReversedPayments = 0,
            Audit = new ReversalAudit(user, action, entity, id, true, now, "already-reversed")
        };

    private static ReversalResult OkResult(string action, string entity, string id, string user, string now,
        JsonObject inventory, JsonArray accounts, JsonArray parts, JsonArray records, JsonArray restocked, int payCount) =>
        new()
        {
            Ok = true,
            AlreadyReversed = false,
            Inventory = inventory,
            Accounts = accounts,
            Parts = parts,
            Records = records,
            RemovedId = id,
            Restocked = restocked,
            ReversedPayments = payCount,
            Audit = new ReversalAudit(user, action, entity, id, true, now, "ok")
        };

    private static ReversalResult Fail(string kind, string err, JsonObject inventory, JsonArray accounts, JsonArray parts, JsonArray records) =>
        new() { Ok = false, Kind = kind, Error = err, Inventory = inventory, Accounts = accounts, Parts = parts, Records = records };

    private static JsonObject Line(string code, string name, int qty, string kind) =>
        new() { ["code"] = code, ["name"] = name, ["qty"] = qty, ["kind"] = kind };

    private static JsonObject? FindPart(JsonArray parts, string code)
    {
        foreach (var n in parts)
            if (n is JsonObject p && JsonVal.Str(p, "code") == code)
                return p;
        return null;
    }

    private static void ReplacePart(JsonArray parts, string code, JsonObject item)
    {
        for (var i = 0; i < parts.Count; i++)
        {
            if (parts[i] is JsonObject p && JsonVal.Str(p, "code") == code)
            {
                parts[i] = item;
                return;
            }
        }
        parts.Add(item);
    }

    private static int IndexOf(JsonArray arr, string id, params string[] keys)
    {
        if (string.IsNullOrEmpty(id)) return -1;
        for (var i = 0; i < arr.Count; i++)
        {
            if (arr[i] is not JsonObject o) continue;
            foreach (var k in keys)
                if (JsonVal.Str(o, k) == id) return i;
        }
        return -1;
    }

    private static int IndexFrom(JsonObject payload, string key, int count)
    {
        foreach (var k in IndexKeys(key))
        {
            if (payload[k] is null) continue;
            var idx = CalculationEngine.ToInt(JsonVal.Str(payload, k));
            if (idx < 0 || idx >= count) continue;
            return idx;
        }
        return -1;
    }

    private static IEnumerable<string> IndexKeys(string key)
    {
        if (string.IsNullOrEmpty(key)) yield break;
        yield return key;
        var pascal = char.ToUpperInvariant(key[0]) + key.Substring(1);
        if (pascal != key) yield return pascal;
    }

    private static string RecordId(JsonNode? n, params string[] keys)
    {
        if (n is not JsonObject o) return "";
        foreach (var k in keys)
        {
            var s = JsonVal.Str(o, k);
            if (!string.IsNullOrEmpty(s)) return s;
        }
        return "";
    }

    /// <summary>اول ردیفی که کاربر روی حذفش زده؛ اگر اندیس نبود، اولین شماره مطابق.</summary>
    private static int ResolveClickedIndex(JsonArray list, JsonObject payload, string indexKey, string id, params string[] idKeys)
    {
        var fromIdx = IndexFrom(payload, indexKey, list.Count);
        if (fromIdx >= 0) return fromIdx;
        return IndexOf(list, id, idKeys);
    }

    private static int CountSameId(JsonArray list, string id, int exceptIdx, params string[] keys)
    {
        if (string.IsNullOrEmpty(id)) return 0;
        var n = 0;
        for (var i = 0; i < list.Count; i++)
        {
            if (i == exceptIdx) continue;
            if (RecordId(list[i], keys) == id) n++;
        }
        return n;
    }

    private static bool Flag(JsonObject? o, string k)
    {
        var s = JsonVal.Str(o, k).ToLowerInvariant();
        if (s is "1" or "true" or "yes") return true;
        if (o is not null && o[k] is JsonValue v && v.TryGetValue<bool>(out var b)) return b;
        return false;
    }

    private static string FirstNonEmpty(params string[] xs)
    {
        foreach (var x in xs)
            if (!string.IsNullOrEmpty(x)) return x;
        return "";
    }

    private static JsonObject? CloneObj(JsonObject? src) =>
        src is null ? null : JsonNode.Parse(src.ToJsonString()) as JsonObject;

    private static JsonArray CloneArr(JsonArray? src) =>
        src is null ? new JsonArray() : JsonNode.Parse(src.ToJsonString()) as JsonArray ?? new JsonArray();
}

public sealed class ReversalResult
{
    public bool Ok { get; init; }
    public bool AlreadyReversed { get; init; }
    public string Kind { get; init; } = "";
    public string Error { get; init; } = "";
    public JsonObject Inventory { get; init; } = new();
    public JsonArray Accounts { get; init; } = new();
    public JsonArray Parts { get; init; } = new();
    public JsonArray Records { get; init; } = new();
    public string RemovedId { get; init; } = "";
    public JsonArray Restocked { get; init; } = new();
    public int ReversedPayments { get; init; }
    public ReversalAudit? Audit { get; init; }
}

public sealed record ReversalAudit(string User, string Action, string Entity, string EntityId, bool Reversal, string Timestamp, string Result);
