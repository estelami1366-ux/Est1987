namespace Sirman.Core.Domain;

/// <summary>
/// ساختار ساده برای رویداد کسب‌وکار — EventBus پیچیده ساخته نمی‌شود.
/// رویدادهای فعلی JS (on/off/emit) حذف نمی‌شوند.
/// </summary>
public readonly record struct BusinessEvent(string Name, string Entity, string EntityId, bool Ok);
