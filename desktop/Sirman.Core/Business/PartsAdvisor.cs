using System.Text.Json.Nodes;

namespace Sirman.Core.Business;

/// <summary>همان suggestPartsForCase — قطعه خارج از کاتالوگ ساخته نمی‌شود.</summary>
public static class PartsAdvisor
{
    public static List<JsonObject> Suggest(JsonArray? catalog, string? prodCode, string? model, string? problem)
    {
        catalog ??= [];
        prodCode = (prodCode ?? "").Trim();
        model = (model ?? "").Trim();
        problem = (problem ?? "").Trim().ToLowerInvariant();
        var outList = new List<JsonObject>();
        foreach (var n in catalog)
        {
            if (n is not JsonObject p) continue;
            var code = JsonVal.Str(p, "code");
            if (code.Length == 0) continue;
            var why = new List<string>();
            var pc = JsonVal.Str(p, "prodCode").Trim();
            if (prodCode.Length > 0 && pc.Length > 0 && pc == prodCode) why.Add("چون کالای مرتبط همین مدل است");
            if (why.Count == 0 && model.Length > 0 && (pc == model || JsonVal.Str(p, "name").Contains(model, StringComparison.Ordinal)))
                why.Add("چون کالای مرتبط همین مدل است");
            var blob = (JsonVal.Str(p, "name") + " " + JsonVal.Str(p, "cat") + " " + JsonVal.Str(p, "note")).ToLowerInvariant();
            if (problem.Length > 0 && blob.Contains(problem, StringComparison.Ordinal))
                why.Add("چون شرح مشکل با نام یا دسته قطعه هم‌خوان است");
            if (why.Count == 0) continue;
            var qty = p["qty"];
            outList.Add(new JsonObject
            {
                ["code"] = code,
                ["name"] = JsonVal.Str(p, "name"),
                ["qty"] = qty is null ? 0 : CalculationEngine.ToNum(JsonVal.Str(qty)),
                ["explain"] = string.Join("؛ ", why)
            });
        }
        return outList;
    }
}
