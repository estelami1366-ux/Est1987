using System.Text.Json.Nodes;

namespace Sirman.Core.Data.Repositories;

/// <summary>
/// مرز persist گارانتی. رکورد واقعی <see cref="JsonObject"/> است؛ شناسه <c>id</c>.
/// مشتری پایدار جدا (customerId) در Core persist نیست — کلید name/phone.
/// همنام <c>Sirman.Core.Data.IWarrantyRepository</c> (MergeItem) نیست؛ آن قرارداد قدیمی جدا می‌ماند.
/// این اینترفیس هنوز به BusinessFacade / HTML وصل نشده است.
/// </summary>
public interface IWarrantyRepository
{
    /// <summary>خواندن رکورد گارانتی با id.</summary>
    JsonObject? GetById(string warrantyId);

    /// <summary>رکوردهای باز مشتری؛ فیلتر با name یا phone برابر customerId.</summary>
    IReadOnlyList<JsonObject> GetActiveByCustomer(string customerId);

    /// <summary>ذخیره/ادغام رکورد گارانتی. گردش کار گارانتی اینجا نیست.</summary>
    void Save(JsonObject record);
}
