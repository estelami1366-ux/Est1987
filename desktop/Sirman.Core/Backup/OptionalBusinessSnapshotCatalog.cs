namespace Sirman.Core.Backup;

/// <summary>
/// ARCH-18 frozen catalog of the OPTIONAL business backup slice.
/// Documents HTML RAM globals used by collectOptionalBusinessSnapshot.
/// Does not read RAM collections, browser storage, Host, or Print.
/// Identity field names are documentation only and must not mutate records.
/// </summary>
public static class OptionalBusinessSnapshotCatalog
{
    /// <summary>
    /// Payload key order matching the HTML assembler optional slice (then JSON clone).
    /// <c>svcs</c> is a compatibility alias of <c>services</c> (same RAM source).
    /// </summary>
    public static readonly IReadOnlyList<string> AllOptionalKeys = new[]
    {
        "products", "inventory",
        "services", "svcs",
        "tasks", "defectiveStock",
        "warehouseDocs", "stockMoves", "warehouses",
        "daqi", "daqiWarehouse", "daqiVouchers",
        "postalHistory"
    };

    /// <summary>HTML RAM globals the adapter reads. Note: <c>svcs</c> is not a separate source; both keys read <c>services</c>.</summary>
    public static readonly IReadOnlyList<string> SourceGlobals = new[]
    {
        "products", "inventory", "services",
        "tasks", "defectiveStock",
        "warehouseDocs", "stockMoves", "warehouses",
        "daqi", "daqiWarehouse", "daqiVouchers",
        "postalHistory"
    };

    /// <summary>
    /// Duplicate-scan / merge identity fields from live HTML (ARCH-16). Not applied by Parse.
    /// inventory identity is the object key (product code), not a record field.
    /// services/svcs merge uses id OR code; create may omit id.
    /// </summary>
    public static readonly IReadOnlyDictionary<string, string> IdentityFields =
        new Dictionary<string, string>(StringComparer.Ordinal)
        {
            ["products"] = "code",
            ["services"] = "id|code",
            ["svcs"] = "id|code",
            ["tasks"] = "id",
            ["defectiveStock"] = "id",
            ["warehouseDocs"] = "id",
            ["stockMoves"] = "id",
            ["warehouses"] = "id",
            ["daqi"] = "id",
            ["daqiWarehouse"] = "id",
            ["daqiVouchers"] = "id",
            ["postalHistory"] = "id"
        };

    /// <summary>Keys that must not appear on an OPTIONAL business DTO.</summary>
    public static readonly IReadOnlyList<string> ForbiddenKeys = new[]
    {
        "phonebook", "pb",
        "invoices", "sales", "warranties", "parts", "accounts",
        "invCtr", "invoiceUidCtr", "saleCtr", "saleUidCtr", "counters",
        "userAuditLog", "bgAuditLog", "userRoles", "loginPw",
        "senderInfo", "logoSrc", "acH",
        "itemCounts", "sections", "attachmentsIndex",
        "appliedUpdates", "updatePackages",
        "printSettings", "company", "serviceCenter", "starredAlarms",
        "appearance", "sms", "tz", "networkSettings", "prefs", "aiKeys", "printCenter",
        "magic", "schemaVersion", "version", "applicationVersion", "exportedAt",
        "origin", "checksum", "checksumAlgo", "manifest", "sectionChecksums"
    };

    public static IReadOnlyList<string> ForbiddenRuntimeKeys => BackupSnapshotCatalog.ForbiddenRuntimeKeys;
}
