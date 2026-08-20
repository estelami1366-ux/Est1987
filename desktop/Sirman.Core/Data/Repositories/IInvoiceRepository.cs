using System.Text.Json.Nodes;

namespace Sirman.Core.Data.Repositories;

/// <summary>
/// مرز persist فاکتور. نوع واقعی سند <see cref="JsonObject"/> است (کلاس Invoice در Core نیست).
/// شناسه پایدار: invoiceId / InvoiceId — نه num.
/// GetByDateRange روی رشتهٔ date شمسی/متنی HTML است، نه DateTime میلادی.
/// همنام <c>Sirman.Core.Data.IInvoiceRepository</c> (MergeItem) نیست.
/// </summary>
public interface IInvoiceRepository
{
    JsonObject? GetById(string invoiceId);
    IReadOnlyList<JsonObject> GetAll();
    IReadOnlyList<JsonObject> GetByDateRange(string fromDate, string toDate);
    void Save(JsonObject invoice);
    bool Delete(string invoiceId);
}
