namespace Sirman.Core.Backup;

/// <summary>
/// ARCH-22 frozen catalog of the current Phonebook payload.
/// Documents HTML RAM/storage used by collectPhonebookSnapshot.
/// Does not read RAM, browser storage, Host, or Print.
/// Does not invent a contact identity or repair records.
/// </summary>
public static class PhonebookSnapshotCatalog
{
    public const string BackupKey = "phonebook";
    public const string StorageKey = "lb";
    public const string SourceGlobal = "phonebook";
    public const string AliasGlobal = "pb";

    /// <summary>SCHEMAS.phonebook defaults from HTML. Extra fields on records are preserved by Parse.</summary>
    public static readonly IReadOnlyList<string> SchemaFields = new[]
    {
        "fn", "ln", "shop", "addr", "zip", "phones",
        "ita", "tg", "wa", "ig", "socials", "note", "cat"
    };

    /// <summary>
    /// Fields written by savePBContact in addition to SchemaFields.
    /// None of these are a stable persistent ID.
    /// </summary>
    public static readonly IReadOnlyList<string> SaveTimeFields = new[]
    {
        "nid", "privacyConsent", "privacyConsentAt"
    };

    /// <summary>
    /// Production has no stable contact identity.
    /// Merge uses raw phones[0] when non-empty. UI edit/delete and daqi.agencyPhonebookIdx use array index.
    /// </summary>
    public const string StableIdentityField = "";

    public const string MergeMatchField = "phones[0]";
    public const string PositionalIndexConsumer = "daqi.agencyPhonebookIdx";

    public static readonly IReadOnlyList<string> ForbiddenKeys = new[]
    {
        "invoices", "products", "inventory", "parts", "services", "svcs",
        "warranties", "sales", "tasks", "accounts",
        "defectiveStock", "warehouseDocs", "stockMoves", "warehouses",
        "daqi", "daqiWarehouse", "daqiVouchers", "postalHistory",
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
