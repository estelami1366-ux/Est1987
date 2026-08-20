using System.Text.Json.Nodes;

namespace Sirman.Core.Data.Repositories;

/// <summary>
/// مرز persist فاکتور. نوع واقعی سند <see cref="JsonObject"/> است (کلاس Invoice در Core نیست).
/// شناسه پایدار: invoiceId / InvoiceId — نه num.
/// GetByDateRange روی رشتهٔ date شمسی/متنی HTML است، نه DateTime میلادی.
/// همنام <c>Sirman.Core.Data.IInvoiceRepository</c> (MergeItem) نیست؛ آن قرارداد قدیمی جدا می‌ماند.
/// این اینترفیس هنوز به BusinessFacade / HTML وصل نشده است.
/// </summary>
public interface IInvoiceRepository
{
    /// <summary>خواندن فاکتور با شناسه پایدار invoiceId.</summary>
    JsonObject? GetById(string invoiceId);

    /// <summary>همهٔ فاکتورهای کیسهٔ persist.</summary>
    IReadOnlyList<JsonObject> GetAll();

    /// <summary>فیلتر بازه روی فیلد متنی date (شمسی HTML)، نه DateTime.</summary>
    IReadOnlyList<JsonObject> GetByDateRange(string fromDate, string toDate);

    /// <summary>ذخیره/ادغام سند فاکتور. منطق قیمت در InvoicePricing است نه اینجا.</summary>
    void Save(JsonObject invoice);

    /// <summary>حذف با invoiceId. بازگشت false یعنی پیدا نشد.</summary>
    bool Delete(string invoiceId);
}
