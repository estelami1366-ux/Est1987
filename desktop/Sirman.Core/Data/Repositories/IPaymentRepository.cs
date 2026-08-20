using System.Text.Json.Nodes;

namespace Sirman.Core.Data.Repositories;

/// <summary>
/// مرز persist حساب/تراکنش. سند واقعی <see cref="JsonObject"/> حساب با آرایه trx است.
/// GetByInvoiceId روی refId / invoiceId / documentId تراکنش می‌گردد.
/// Reverse همان مفهوم PaymentRules.ReverseOwned است — اینجا فقط قرارداد است.
/// همنام <c>Sirman.Core.Data.IPaymentRepository</c> (MergeItem) نیست.
/// </summary>
public interface IPaymentRepository
{
    IReadOnlyList<JsonObject> GetByInvoiceId(string invoiceId);
    void Save(JsonObject account);
    IReadOnlyList<JsonObject> Reverse(string invoiceId);
}
