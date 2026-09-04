namespace Sirman.Core.Backup;

/// <summary>
/// ARCH-9B frozen catalogs from HTML <c>_buildFullBackupData</c> (ARCH-9A audit).
/// These lists document observed shape. They do not assemble live data and do not
/// change HTML sections / itemCounts / required-collection rules.
/// </summary>
public static class BackupSnapshotCatalog
{
    public const string Magic = "SIRMAN_BACKUP";
    public const int AppSchemaVersion = 1;
    public const string PhonebookSection = "phonebook";

    /// <summary>
    /// A. Always-assigned object-literal keys in <c>_buildFullBackupData</c> (49).
    /// Does not include caller stamps (<c>origin</c>) or optional printCenter / attachmentsIndex.
    /// </summary>
    public static readonly IReadOnlyList<string> BasePayloadKeys = new[]
    {
        "magic", "schemaVersion", "version", "applicationVersion", "exportedAt",
        "invoices", "products", "inventory", "invCtr", "invoiceUidCtr", "saleCtr", "saleUidCtr",
        "phonebook", "parts", "services", "svcs", "warranties", "sales", "tasks", "accounts",
        "defectiveStock", "warehouseDocs", "stockMoves", "warehouses",
        "daqi", "daqiWarehouse", "daqiVouchers", "postalHistory",
        "appliedUpdates", "updatePackages",
        "userAuditLog", "bgAuditLog", "userRoles", "loginPw",
        "printSettings", "company", "serviceCenter", "starredAlarms", "senderInfo", "logoSrc", "acH",
        "appearance", "sms", "tz", "networkSettings", "prefs", "aiKeys",
        "itemCounts", "sections"
    };

    /// <summary>
    /// B. <c>data.sections</c> catalog (32 names). Core must not add omitted keys.
    /// </summary>
    public static readonly IReadOnlyList<string> SectionsCatalog = new[]
    {
        "invoices", "products", "inventory", "phonebook", "parts", "services", "warranties", "sales",
        "tasks", "accounts", "defectiveStock", "userAuditLog", "bgAuditLog", "userRoles", "loginPw",
        "printSettings", "company", "serviceCenter", "starredAlarms", "senderInfo", "logoSrc", "acH",
        "appearance", "sms", "tz", "networkSettings", "aiKeys", "warehouses", "daqi", "daqiWarehouse",
        "daqiVouchers", "postalHistory"
    };

    /// <summary>
    /// C. <c>itemCounts</c> keys actually declared by HTML assembly (15). Do not expand.
    /// </summary>
    public static readonly IReadOnlyList<string> ItemCountKeys = new[]
    {
        "invoices", "products", "phonebook", "parts", "services", "warranties", "sales", "tasks",
        "accounts", "defectiveStock", "warehouses", "daqi", "daqiWarehouse", "daqiVouchers", "postalHistory"
    };

    /// <summary>
    /// D. Written by Finalizer / attachChecksum, not by raw assembly.
    /// </summary>
    public static readonly IReadOnlyList<string> FinalizedMetadataKeys = new[]
    {
        "checksum", "checksumAlgo", "manifest", "sectionChecksums"
    };

    /// <summary>
    /// E. Optional on the assembled object. Typical run adds both (51 keys = 49 + 2).
    /// </summary>
    public static readonly IReadOnlyList<string> OptionalAssemblyKeys = new[]
    {
        "printCenter", "attachmentsIndex"
    };

    /// <summary>
    /// Stamped by callers after assembly (<c>exportData</c> / autosave / archive). Not one of the 49.
    /// </summary>
    public static readonly IReadOnlyList<string> CallerStampKeys = new[]
    {
        "origin"
    };

    /// <summary>
    /// Appearance object keys emitted by HTML (24). Empty string ≠ missing key at assemble time.
    /// </summary>
    public static readonly IReadOnlyList<string> AppearanceKeys = new[]
    {
        "skin", "depth3d", "colorTheme", "theme", "appFont", "textSize", "textColor", "headingColor",
        "sbHeadingSize", "dashTint", "lastPage", "density", "radius", "appBg", "appBgOverlay",
        "sbMode", "sbCollapsed", "navShape", "sbBg", "mainBg", "dashBg", "dashBgOverlay",
        "dashShortcuts", "dashHideWidgets"
    };

    /// <summary>Top-level names that would mean a browser/runtime handle leaked into JSON.</summary>
    public static readonly IReadOnlyList<string> ForbiddenRuntimeKeys = new[]
    {
        "localStorage", "indexedDB", "IndexedDB", "document", "window", "chrome", "webview", "sirmanHost"
    };

    public static IReadOnlyList<string> Schema1RequiredCollections =>
        RequiredCollectionsRegistry.Always.Concat(RequiredCollectionsRegistry.FromSchema[1]).ToArray();

    public static bool IsPhonebookIdentityExcluded => true;
}
