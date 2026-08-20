using System.Text.Json.Nodes;

namespace Sirman.Core.Data.Repositories;

/// <summary>
/// مرز persist حساب/تراکنش. سند واقعی <see cref="JsonObject"/> حساب با آرایه trx است.
/// GetByInvoiceId روی refId / invoiceId / documentId تراکنش می‌گردد.
/// Reverse قانون کسب‌وکار است و در <c>Sirman.Core.Business.PaymentRules</c> می‌ماند — روی این اینترفیس نیست.
/// همنام <c>Sirman.Core.Data.IPaymentRepository</c> (MergeItem) نیست؛ آن قرارداد قدیمی جدا می‌ماند.
/// این اینترفیس هنوز به BusinessFacade / HTML وصل نشده است.
/// </summary>
public interface IPaymentRepository
{
    /// <summary>تراکنش‌های مرتبط با شناسه فاکتور (refId / invoiceId / documentId).</summary>
    IReadOnlyList<JsonObject> GetByInvoiceId(string invoiceId);

    /// <summary>ذخیره/ادغام سند حساب. برگشت تراکنش اینجا نیست.</summary>
    void Save(JsonObject account);
}
