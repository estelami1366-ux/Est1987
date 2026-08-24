namespace Sirman.Core.Data.Persistence;

/// <summary>
/// فروشگاه candidate خدمات. پیاده‌سازی SQLite در اسمبلی جدا است؛ Core نوع SQLite ندارد.
/// به Host / HTML وصل نیست.
/// </summary>
public interface IServiceCandidateStore
{
    IReadOnlyList<ServiceCatalogRecord> ListAll();
    void ReplaceAll(IReadOnlyList<ServiceCatalogRecord> rows);
    int Count();
}
