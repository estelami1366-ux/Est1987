namespace Sirman.Core.Domain;

/// <summary>
/// قرارداد مهاجرت SmartCore — پیاده‌سازی فعلی در Sirman_Final.html است.
/// این فاز منطق را کپی نمی‌کند؛ فقط مرز را ثبت می‌کند.
/// </summary>
public static class SmartCoreContract
{
    public const string Location = "Sirman_Final.html";
    public const string ObjectName = "SmartCore";
    public const string CalculationEngine = "CalculationEngine / calcWarrantyEndDate, calcBalance, calcFinalAmount, calcAvailableStock, calcReorderPoint, calcSlaStatusFromAgeHours";
    public const string WorkflowEngine = "WorkflowEngine / canWarrantyTransition, applyWarrantyTransition";
    public const string RulesEngine = "RulesEngine / suggestPartsForCase";
    public const string Events = "موجود Event Bus (on/off/emit) — EventBus جدید ساخته نمی‌شود";
    public const string Phase2Path = "Host Object متدهای محاسبه قطعی را از همین قرارداد صدا بزند؛ UI فقط نمایش دهد.";
}
