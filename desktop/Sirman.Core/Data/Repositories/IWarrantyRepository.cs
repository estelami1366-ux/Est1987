using System.Text.Json.Nodes;

namespace Sirman.Core.Data.Repositories;

/// <summary>
/// مرز persist گارانتی. رکورد واقعی <see cref="JsonObject"/> است؛ شناسه <c>id</c>.
/// مشتری پایدار جدا (customerId) در Core persist نیست — کلید name/phone.
/// همنام <c>Sirman.Core.Data.IWarrantyRepository</c> (MergeItem) نیست.
/// </summary>
public interface IWarrantyRepository
{
    JsonObject? GetById(string warrantyId);
    IReadOnlyList<JsonObject> GetActiveByCustomer(string customerId);
    void Save(JsonObject record);
}
