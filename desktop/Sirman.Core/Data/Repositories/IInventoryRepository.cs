using System.Text.Json.Nodes;
using Sirman.Core.Business;

namespace Sirman.Core.Data.Repositories;

/// <summary>
/// مرز persist موجودی. آیتم واقعی <see cref="JsonObject"/> است؛ کلید <c>code</c>.
/// Reserve/Consume در Core امروز در <see cref="InventoryCore"/> است نه در CurrentJsonStore.
/// همنام <c>Sirman.Core.Data.IInventoryRepository</c> (MergeItem/MergeMap) نیست.
/// </summary>
public interface IInventoryRepository
{
    JsonObject? GetById(string itemId);
    IReadOnlyList<JsonObject> GetAll();
    void Save(JsonObject item);
    InventoryMutateResult Reserve(string itemId, int qty, string? whId);
    InventoryMutateResult Consume(string itemId, int qty);
}
