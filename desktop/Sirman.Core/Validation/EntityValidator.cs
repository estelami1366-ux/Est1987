using System.Text.Json;
using System.Text.Json.Nodes;

namespace Sirman.Core.Validation;

public sealed class ValidationResult
{
    public bool Ok { get; init; }
    public string Error { get; init; } = "";
    public string Message { get; init; } = "";
    public string Entity { get; init; } = "";

    public string ToJson() => JsonSerializer.Serialize(new
    {
        ok = Ok,
        error = string.IsNullOrEmpty(Error) ? null : Error,
        message = Message,
        entity = Entity
    });
}

/// <summary>
/// اعتبارسنجی سبک هم‌تراز با قوانین فعلی HTML — سخت‌گیرانه‌تر از UI نیست تا ذخیره موجود نشکند.
/// </summary>
public sealed class EntityValidator
{
    public ValidationResult Validate(string entity, string json)
    {
        entity = (entity ?? "").Trim();
        JsonObject obj;
        try
        {
            obj = string.IsNullOrWhiteSpace(json)
                ? new JsonObject()
                : JsonNode.Parse(json) as JsonObject ?? new JsonObject();
        }
        catch
        {
            return Fail(entity, "invalid-json", "داده نامعتبر است");
        }

        return entity.ToLowerInvariant() switch
        {
            "customer" or "phonebook" => Require(entity, obj, ("name", "نام الزامی است")),
            "product" => Require(entity, obj, ("code", "کد کالا الزامی است"), ("name", "نام کالا الزامی است")),
            "part" => Require(entity, obj, ("code", "کد قطعه الزامی است"), ("name", "نام قطعه الزامی است")),
            "warranty" or "servicecase" => Require(entity, obj, ("name", "نام مشتری الزامی است"), ("phone", "تلفن الزامی است")),
            "invoice" => Require(entity, obj, ("name", "نام مشتری روی فاکتور الزامی است")),
            "payment" => Amount(entity, obj),
            "inventory" => Require(entity, obj, ("code", "کد موجودی الزامی است")),
            "user" => Require(entity, obj, ("name", "نام کاربر الزامی است")),
            "role" => Pages(entity, obj),
            "permission" => Permission(entity, obj),
            _ => new ValidationResult { Ok = true, Entity = entity, Message = "نوع ناشناخته — رد نشد" }
        };
    }

    private static ValidationResult Amount(string entity, JsonObject obj)
    {
        var raw = Str(obj, "amount");
        if (string.IsNullOrWhiteSpace(raw)) return Fail(entity, "required", "مبلغ الزامی است");
        if (!double.TryParse(raw, System.Globalization.NumberStyles.Any, System.Globalization.CultureInfo.InvariantCulture, out var n) || n <= 0)
            return Fail(entity, "amount", "مبلغ باید بزرگ‌تر از صفر باشد");
        return Ok(entity);
    }

    private static ValidationResult Pages(string entity, JsonObject obj)
    {
        if (obj["pages"] is JsonArray arr && arr.Count == 0)
            return Fail(entity, "pages", "حداقل یک بخش لازم است");
        return Ok(entity);
    }

    private static ValidationResult Permission(string entity, JsonObject obj)
    {
        var p = Str(obj, "permission");
        if (string.IsNullOrWhiteSpace(p)) return Fail(entity, "required", "مجوز الزامی است");
        if (!Security.PermissionCatalog.PermissionToPage.ContainsKey(p))
            return Fail(entity, "unknown", "این مجوز در کاتالوگ صفحات موجود نیست");
        return Ok(entity);
    }

    private static ValidationResult Require(string entity, JsonObject obj, params (string key, string msg)[] fields)
    {
        foreach (var (key, msg) in fields)
        {
            if (string.IsNullOrWhiteSpace(Str(obj, key)))
                return Fail(entity, "required", msg);
        }
        return Ok(entity);
    }

    private static string Str(JsonObject obj, string key)
    {
        if (!obj.TryGetPropertyValue(key, out var n) || n is null) return "";
        return n.ToString().Trim();
    }

    private static ValidationResult Ok(string entity) => new() { Ok = true, Entity = entity, Message = "معتبر" };
    private static ValidationResult Fail(string entity, string error, string message) =>
        new() { Ok = false, Entity = entity, Error = error, Message = message };
}
