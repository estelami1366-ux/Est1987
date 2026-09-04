namespace Sirman.Core.Backup;

/// <summary>
/// ARCH-14 frozen catalog of LS-based backup settings fields.
/// Documents the LS-based settings slice of the HTML backup assembler.
/// Does not read localStorage, RAM collections, Host, or Print pipeline.
/// </summary>
public static class BackupSettingsSnapshotCatalog
{
    /// <summary>
    /// Always-assigned settings keys in HTML adapter / assembler settings slice (12).
    /// Does not include optional <c>printCenter</c>.
    /// </summary>
    public static readonly IReadOnlyList<string> BaseSettingsKeys = new[]
    {
        "appliedUpdates", "updatePackages",
        "printSettings", "company", "serviceCenter", "starredAlarms",
        "appearance", "sms", "tz", "networkSettings", "prefs", "aiKeys"
    };

    /// <summary>Optional settings key. HTML adapter adds it when <c>getPrintCenterState</c> succeeds.</summary>
    public static readonly IReadOnlyList<string> OptionalSettingsKeys = new[]
    {
        "printCenter"
    };

    /// <summary>Full settings payload key order (base then optional).</summary>
    public static readonly IReadOnlyList<string> AllSettingsKeys =
        BaseSettingsKeys.Concat(OptionalSettingsKeys).ToArray();

    /// <summary>Same 24 appearance keys as <see cref="BackupSnapshotCatalog.AppearanceKeys"/>.</summary>
    public static IReadOnlyList<string> AppearanceKeys => BackupSnapshotCatalog.AppearanceKeys;

    /// <summary>HTML <c>PREF_KEYS</c> (ARCH-13). Adapter copies only keys with non-null LS values.</summary>
    public static readonly IReadOnlyList<string> PrefKeys = new[]
    {
        "laegh_desktop_notify_on", "laegh_autosave_enabled", "laegh_autosave_mode",
        "laegh_autosave_interval", "laegh_autosave_ok_name", "laegh_autosave_file_name",
        "laegh_autosave_dir_name", "laegh_theme", "laegh_skin", "laegh_depth3d",
        "laegh_color_theme", "laegh_sb_mode", "laegh_sb_collapsed", "laegh_nav_shape",
        "laegh_text_color", "laegh_heading_color", "laegh_sb_heading_size", "laegh_app_font",
        "laegh_text_size", "laegh_tz", "laegh_last_page", "laegh_ai_float_x", "laegh_ai_float_y"
    };

    /// <summary>localStorage keys the HTML adapter reads (exact names, plus prefix scans).</summary>
    public static readonly IReadOnlyList<string> LocalStorageKeys = new[]
    {
        "laegh_applied_updates",
        "laegh_printSettings",
        "laegh_company",
        "laegh_service_center",
        "laegh_starred_alarms",
        "laegh_skin", "laegh_depth3d", "laegh_color_theme", "laegh_theme",
        "laegh_app_font", "laegh_text_size", "laegh_text_color", "laegh_heading_color",
        "laegh_sb_heading_size", "laegh_dash_tint", "laegh_last_page", "laegh_density",
        "laegh_radius", "laegh_app_bg", "laegh_app_bg_overlay", "laegh_sb_mode",
        "laegh_sb_collapsed", "laegh_nav_shape", "laegh_sb_bg", "laegh_main_bg",
        "laegh_dash_bg", "laegh_dash_bg_overlay", "laegh_dash_shortcuts", "laegh_dash_hide_widgets",
        "laegh_sms",
        "laegh_tz",
        "laegh_network",
        "laegh_printCenter",
        "laegh_ai_custom_url", "laegh_ai_custom_model", "laegh_ai_model", "laegh_ai_purpose"
    };

    /// <summary>Prefix scan for AI API keys. Exact remaining AI keys are in <see cref="LocalStorageKeys"/>.</summary>
    public const string AiKeyPrefix = "laegh_ai_key_";

    /// <summary>Prefix scan for stored update packages. Ids come from <c>laegh_applied_updates</c>.</summary>
    public const string UpdatePackagePrefix = "laegh_upd_pkg_";

    /// <summary>Plaintext sensitive payload fields. Do not strip / hash / vault in this packet.</summary>
    public static readonly IReadOnlyList<string> SensitivePayloadKeys = new[]
    {
        "aiKeys"
    };

    /// <summary>Business RAM / assembler fields that must not appear on a settings DTO.</summary>
    public static readonly IReadOnlyList<string> ForbiddenBusinessKeys = new[]
    {
        "invoices", "products", "inventory", "invCtr", "invoiceUidCtr", "saleCtr", "saleUidCtr",
        "phonebook", "pb", "parts", "services", "svcs", "warranties", "sales", "tasks", "accounts",
        "defectiveStock", "warehouseDocs", "stockMoves", "warehouses",
        "daqi", "daqiWarehouse", "daqiVouchers", "postalHistory",
        "userAuditLog", "bgAuditLog", "userRoles", "loginPw",
        "senderInfo", "logoSrc", "acH",
        "itemCounts", "sections", "attachmentsIndex",
        "magic", "schemaVersion", "version", "applicationVersion", "exportedAt",
        "origin", "checksum", "checksumAlgo", "manifest", "sectionChecksums"
    };

    public static IReadOnlyList<string> ForbiddenRuntimeKeys => BackupSnapshotCatalog.ForbiddenRuntimeKeys;

    public const string DefaultTz = "Asia/Tehran";
}
