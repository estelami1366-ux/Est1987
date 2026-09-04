namespace Sirman.Core.Backup;

/// <summary>
/// ARCH-17 frozen catalog of the REQUIRED business backup slice.
/// Documents HTML RAM globals used by <c>collectRequiredBusinessSnapshot</c>.
/// Does not read RAM collections, browser storage, Host, or Print.
/// Identity field names are documentation only and must not mutate records.
/// </summary>
public static class BusinessDataSnapshotCatalog
{
    /// <summary>Always-assigned collection keys (adapter / DTO payload order).</summary>
    public static readonly IReadOnlyList<string> CollectionKeys = new[]
    {
        "invoices", "sales", "warranties", "parts", "accounts"
    };

    /// <summary>
    /// Assembler top-level counter primitives. Grouped as payload key <c>counters</c>.
    /// No identity semantics.
    /// </summary>
    public static readonly IReadOnlyList<string> CounterKeys = new[]
    {
        "invCtr", "invoiceUidCtr", "saleCtr", "saleUidCtr"
    };

    /// <summary>Nested object holding <see cref="CounterKeys"/>.</summary>
    public const string CountersObjectKey = "counters";

    /// <summary>Full REQUIRED payload key order.</summary>
    public static readonly IReadOnlyList<string> AllRequiredKeys = new[]
    {
        "invoices", "sales", "warranties", "parts", "accounts", CountersObjectKey
    };

    /// <summary>
    /// Duplicate-scan / merge identity fields from live HTML source (ARCH-16).
    /// Not applied by Parse. parts also has operational <c>code</c>; create may omit <c>id</c>.
    /// </summary>
    public static readonly IReadOnlyDictionary<string, string> IdentityFields =
        new Dictionary<string, string>(StringComparer.Ordinal)
        {
            ["invoices"] = "invoiceId",
            ["sales"] = "saleUid",
            ["warranties"] = "id",
            ["parts"] = "id",
            ["accounts"] = "id"
        };

    /// <summary>HTML RAM globals the adapter reads. Counters stay top-level in RAM, nested in the DTO.</summary>
    public static readonly IReadOnlyList<string> SourceGlobals = new[]
    {
        "invoices", "sales", "warranties", "parts", "accounts",
        "invCtr", "invoiceUidCtr", "saleCtr", "saleUidCtr"
    };

    /// <summary>Keys that must not appear on a REQUIRED business DTO.</summary>
    public static readonly IReadOnlyList<string> ForbiddenKeys = new[]
    {
        "phonebook", "pb", "tasks", "services", "svcs",
        "products", "inventory", "defectiveStock",
        "warehouseDocs", "stockMoves", "warehouses",
        "daqi", "daqiWarehouse", "daqiVouchers", "postalHistory",
        "userAuditLog", "bgAuditLog", "userRoles", "loginPw",
        "senderInfo", "logoSrc", "acH",
        "itemCounts", "sections", "attachmentsIndex",
        "appliedUpdates", "updatePackages",
        "printSettings", "company", "serviceCenter", "starredAlarms",
        "appearance", "sms", "tz", "networkSettings", "prefs", "aiKeys", "printCenter",
        "magic", "schemaVersion", "version", "applicationVersion", "exportedAt",
        "origin", "checksum", "checksumAlgo", "manifest", "sectionChecksums",
        "invCtr", "invoiceUidCtr", "saleCtr", "saleUidCtr"
    };

    public static IReadOnlyList<string> ForbiddenRuntimeKeys => BackupSnapshotCatalog.ForbiddenRuntimeKeys;
}
