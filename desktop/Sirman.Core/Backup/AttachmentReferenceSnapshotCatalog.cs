namespace Sirman.Core.Backup;

/// <summary>
/// ARCH-19 frozen catalog of the attachment-reference backup slice.
/// Documents collectAttachmentIndex output. Does not walk RAM, Host, Print, or blob stores.
/// Parent matching uses rec.id only. invoiceId and saleUid are not parent keys.
/// </summary>
public static class AttachmentReferenceSnapshotCatalog
{
    public const string IndexKey = "attachmentsIndex";

    /// <summary>Fields emitted by HTML collectAttachmentIndex, in that insertion order.</summary>
    public static readonly IReadOnlyList<string> IndexFields = new[]
    {
        "id", "name", "ref", "inline", "kind", "parentId"
    };

    /// <summary>Walker order inside collectAttachmentIndex.</summary>
    public static readonly IReadOnlyList<string> WalkKinds = new[]
    {
        "warranty", "sale", "invoice"
    };

    public static readonly IReadOnlyDictionary<string, string> KindToSection =
        new Dictionary<string, string>(StringComparer.Ordinal)
        {
            ["warranty"] = "warranties",
            ["sale"] = "sales",
            ["invoice"] = "invoices"
        };

    /// <summary>
    /// Parent matching expression in the walker and P1C-6 validator:
    /// String(rec.id || '') === parentId. Not invoiceId. Not saleUid. Not num.
    /// </summary>
    public const string ParentIdentityField = "id";

    /// <summary>Index row identity: doc.id or synthesized kind-parentId-i. Parse does not enforce uniqueness.</summary>
    public const string AttachmentIdentityField = "id";

    /// <summary>Collections the walker does not read (including Phonebook).</summary>
    public static readonly IReadOnlyList<string> UnwalkedCollections = new[]
    {
        "phonebook", "pb", "products", "parts", "tasks", "accounts",
        "defectiveStock", "warehouseDocs", "stockMoves", "warehouses",
        "daqi", "daqiWarehouse", "daqiVouchers", "postalHistory"
    };

    /// <summary>
    /// Nested warranty bags that hold docs but are not walked:
    /// agencyWork.docs, companyWork.docs, devices[].docs, phoneResolution.docs.
    /// Only top-level rec.docs / rec.attachments (array or object-of-arrays) is walked.
    /// </summary>
    public static readonly IReadOnlyList<string> UnwalkedNestedDocPaths = new[]
    {
        "agencyWork.docs", "companyWork.docs", "devices[].docs", "phoneResolution.docs"
    };

    /// <summary>Independent reference systems — not attachmentsIndex.</summary>
    public static readonly IReadOnlyList<string> IndependentReferenceSystems = new[]
    {
        "stockMoves.refDoc", "daqi.agencyPhonebookIdx"
    };

    public static readonly IReadOnlyList<string> ForbiddenKeys = new[]
    {
        "phonebook", "pb",
        "invoices", "sales", "warranties", "parts", "accounts",
        "products", "inventory", "services", "svcs",
        "invCtr", "invoiceUidCtr", "saleCtr", "saleUidCtr", "counters",
        "userAuditLog", "bgAuditLog", "userRoles", "loginPw",
        "senderInfo", "logoSrc", "acH",
        "itemCounts", "sections",
        "appliedUpdates", "updatePackages",
        "printSettings", "company", "serviceCenter", "starredAlarms",
        "appearance", "sms", "tz", "networkSettings", "prefs", "aiKeys", "printCenter",
        "magic", "schemaVersion", "version", "applicationVersion", "exportedAt",
        "origin", "checksum", "checksumAlgo", "manifest", "sectionChecksums"
    };

    public static IReadOnlyList<string> ForbiddenRuntimeKeys => BackupSnapshotCatalog.ForbiddenRuntimeKeys;
}
