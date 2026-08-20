using System.Text.Json.Nodes;

namespace Sirman.Core.Data.Repositories;

/// <summary>
/// TBD — قرارداد ناقص عمدی.
/// schema / migrate / merge / replace واقعی در HTML BackupEngine است
/// (<c>exportData</c>, <c>migrateBackup</c>, <c>applyBackupSelective</c>).
/// CurrentJsonStore فقط MergeItem/MergeMap روی JSON است و بسته بک‌آپ را نمی‌شناسد.
/// این اینترفیس برای فاز بعد است؛ پیاده‌سازی JSON اینجا موتور بک‌آپ را کپی نمی‌کند.
/// </summary>
public interface IBackupRepository
{
    JsonObject Export();
    JsonObject Import(JsonObject package);
    JsonObject Merge(JsonObject live, JsonObject incoming);
}
