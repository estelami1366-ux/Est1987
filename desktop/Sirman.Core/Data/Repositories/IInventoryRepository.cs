using System.Text.Json.Nodes;

namespace Sirman.Core.Data.Repositories;

/// <summary>
/// مرز persist موجودی. آیتم واقعی <see cref="JsonObject"/> است؛ کلید <c>code</c>.
/// Reserve/Consume قانون کسب‌وکار است و در <c>Sirman.Core.Business.InventoryCore</c> می‌ماند — روی این اینترفیس نیست.
/// همنام <c>Sirman.Core.Data.IInventoryRepository</c> (MergeItem/MergeMap) نیست؛ آن قرارداد قدیمی جدا می‌ماند.
/// این اینترفیس هنوز به BusinessFacade / HTML وصل نشده است.
/// </summary>
public interface IInventoryRepository
{
    /// <summary>خواندن کالا با کد.</summary>
    JsonObject? GetById(string itemId);

    /// <summary>همهٔ کالاهای کیسهٔ persist.</summary>
    IReadOnlyList<JsonObject> GetAll();

    /// <summary>ذخیره/ادغام سند کالا. رزرو و مصرف موجودی اینجا نیست.</summary>
    void Save(JsonObject item);
}
