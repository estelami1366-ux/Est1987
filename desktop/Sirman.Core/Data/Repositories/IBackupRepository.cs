using System.Text.Json.Nodes;

namespace Sirman.Core.Data.Repositories;

/// <summary>
/// TBD — قرارداد ناقص عمدی.
/// schema / migrate / merge / replace واقعی در HTML BackupEngine است
/// (<c>exportData</c>, <c>migrateBackup</c>, <c>applyBackupSelective</c>).
/// CurrentJsonStore فقط MergeItem/MergeMap روی JSON است و بسته بک‌آپ را نمی‌شناسد.
/// این اینترفیس برای فاز بعد است؛ پیاده‌سازی JSON اینجا موتور بک‌آپ را کپی نمی‌کند.
/// همتای MergeItem در <c>Sirman.Core.Data</c> برای بک‌آپ وجود ندارد.
/// این اینترفیس هنوز به BusinessFacade / HTML وصل نشده است.
/// </summary>
public interface IBackupRepository
{
    /// <summary>خروجی بسته — در JSON wrapper فقط نشان TBD است، نه BackupEngine.</summary>
    JsonObject Export();

    /// <summary>ورود بسته — در JSON wrapper ذخیره نشان است، نه migrateBackup.</summary>
    JsonObject Import(JsonObject package);

    /// <summary>ادغام سطحی کلید — نه applyBackupSelective HTML.</summary>
    JsonObject Merge(JsonObject live, JsonObject incoming);
}
