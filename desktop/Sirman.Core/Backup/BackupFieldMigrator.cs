using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;

namespace Sirman.Core.Backup;

/// <summary>
/// Extraction of HTML <c>migrateBackup</c> / <c>migrateRecord</c> / <c>SCHEMAS</c>.
/// Clones the caller object first (HTML mutates in place). Optional <paramref name="nowMs"/>
/// freezes HTML <c>Date.now()</c> used for missing ids.
/// </summary>
internal static class BackupFieldMigrator
{
    private static readonly string[] SchemaSectionOrder =
    {
        "products", "phonebook", "parts", "services", "tasks", "defectiveStock",
        "accounts", "warranties", "sales", "warehouses", "daqi", "daqiWarehouse",
        "daqiVouchers", "postalHistory"
    };

    private static readonly JsonObject SchemaDefaults = JsonNode.Parse("""
        {
          "products": {"code":"","name":"","cat":"","brand":"","supplier":"","colors":"","desc":"","price":0,"img":""},
          "phonebook": {"fn":"","ln":"","shop":"","addr":"","zip":"","phones":[],"ita":"","tg":"","wa":"","ig":"","socials":[],"note":"","cat":"other"},
          "parts": {"code":"","name":"","cat":"","prodCode":"","qty":0,"min":0,"price":0,"location":"","id":""},
          "services": {"code":"","name":"","cat":"","price":0,"warr":"no","desc":"","id":""},
          "tasks": {"id":"","kind":"do","title":"","desc":"","priority":"normal","deadlineTS":null,"hasTime":false,"link":null,"status":"open","notify":false,"notifiedAt":null,"createdAt":"","doneAt":null},
          "defectiveStock": {"id":"","model":"","productCode":"","serial":"","source":"customer","defectLevel":"medium","qty":1,"customerName":"","customerPhone":"","warrantyId":"","invoiceNum":"","note":"","status":"in_stock","enteredAt":"","returnedAt":null},
          "accounts": {"id":"","number":"","name":"","desc":"","balance":0,"transactions":[],"createdAt":""},
          "warranties": {"id":"","name":"","phone":"","date":"","addr":"","socialContacts":[],"devices":[],"initialService":"","model":"","color":"","buydate":"","serial":"","warrStatus":"no","warrExp":"","condition":"سالم","problem":"","expert":"","refTo":"pending","refName":"","refDate":"","refNote":"","docs":[],"companyReport":null,"accRef":"","status":"open","savedAt":"","createdAt":""},
          "sales": {"id":"","items":[],"total":0,"date":"","note":"","name":"","phone":"","msg":"","addr":"","zip":"","ship":"post","shipLabel":"سایر","accRef":"","accountSel":"","docs":[],"status":"final","savedAt":""},
          "warehouses": {"id":"","name":"","type":"other","isDefault":false,"color":"#2563eb","note":"","createdAt":""},
          "daqi": {"id":"","refType":"manual","refId":"","agencyName":"","agencyPhonebookIdx":null,"agencyPhone":"","manufacturer":"","items":[],"sentDate":"","dueDate":"","receivedDate":"","receivedBy":"","note":"","status":"pending","createdAt":"","updatedAt":""},
          "daqiWarehouse": {"id":"","manufacturer":"","code":"","name":"","qty":0,"note":"","updatedAt":""},
          "daqiVouchers": {"id":"","at":"","date":"","manufacturer":"","agencyName":"","items":[],"note":"","type":"out"},
          "postalHistory": {"id":"","at":"","date":"","receiverName":"","receiverPhone":"","receiverAddr":"","receiverZip":"","senderName":""}
        }
        """)!.AsObject();

    public static SchemaMigrationResult Migrate(JsonNode? data, long? nowMs = null)
    {
        try
        {
            if (data is null || data.GetValueKind() == JsonValueKind.Null)
                throw new BackupMigrationException("Cannot read properties of null (reading 'version')");

            var clone = BackupJsonUtil.CloneExact(data);
            if (clone is not JsonObject obj)
                throw new BackupMigrationException("migrateBackup expects a package object");

            var now = nowMs ?? DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
            var log = new List<string>();
            RunInPlace(obj, log, now);
            var to = obj.ContainsKey("schemaVersion") && !BackupJsonUtil.IsJsFalsy(obj["schemaVersion"])
                ? BackupRequiredCollections.InferSchemaVersion(obj)
                : 0;
            return new SchemaMigrationResult
            {
                Ok = true,
                Data = obj,
                Log = log,
                From = BackupRequiredCollections.InferSchemaVersion(data),
                To = to
            };
        }
        catch (BackupMigrationException ex)
        {
            return new SchemaMigrationResult
            {
                Ok = false,
                Threw = true,
                ErrorName = "TypeError",
                ErrorMessage = ex.Message,
                Data = null,
                Log = Array.Empty<string>()
            };
        }
    }

    internal static void RunInPlace(JsonObject d, List<string> log, long nowMs)
    {
        log.Add("📦 نسخه بک‌اپ: " + (BackupJsonUtil.IsJsFalsy(d.ContainsKey("version") ? d["version"] : null)
            ? "قدیمی"
            : BackupJsonUtil.Str(d["version"])));

        MigratePhonebook(d, log);
        MigrateServicesAlias(d, log);
        MigratePartsGate(d, log);
        MigrateWarrantiesGate(d, log);
        MigrateSalesGate(d, log);
        MigrateSalesRecordDefaults(d, log);
        MigrateTasksFill(d, log);
        MigrateAccountsGate(d, log);
        FillOptionalArray(d, "defectiveStock", "⚠️ انبار معیوب: خالی (نسخه قدیمی)", "⚠️ انبار معیوب: {0} مورد", log);
        FillOptionalArray(d, "daqi", "📋 داغی: خالی (نسخه قدیمی)", "📋 داغی: {0} مورد", log);
        FillOptionalArray(d, "daqiWarehouse", "🏭 انبار داغی: خالی (نسخه قدیمی)", "🏭 انبار داغی: {0} قلم", log);
        if (BackupJsonUtil.IsJsFalsy(d.ContainsKey("daqiVouchers") ? d["daqiVouchers"] : null))
            d["daqiVouchers"] = new JsonArray();
        else
            log.Add("📤 حواله داغی: " + BackupJsonUtil.JsLengthLog(d["daqiVouchers"]) + " مورد");
        if (BackupJsonUtil.IsJsFalsy(d.ContainsKey("postalHistory") ? d["postalHistory"] : null))
            d["postalHistory"] = new JsonArray();
        else
            log.Add("📮 تاریخچه پستی: " + BackupJsonUtil.JsLengthLog(d["postalHistory"]) + " مورد");

        if (BackupJsonUtil.IsJsFalsy(d.ContainsKey("userAuditLog") ? d["userAuditLog"] : null))
            d["userAuditLog"] = new JsonArray();
        if (BackupJsonUtil.IsJsFalsy(d.ContainsKey("bgAuditLog") ? d["bgAuditLog"] : null))
            d["bgAuditLog"] = new JsonArray();
        if (BackupJsonUtil.IsJsFalsy(d.ContainsKey("inventory") ? d["inventory"] : null))
            d["inventory"] = new JsonObject();
        if (BackupJsonUtil.IsJsFalsy(d.ContainsKey("products") ? d["products"] : null))
            d["products"] = new JsonArray();

        MigrateInvoicesGate(d, log);
        MigrateSaleCtr(d, log);
        FixMissingIds(d, log, nowMs);
        AssignInvoiceUids(d, log);
        AssignSaleUids(d, log);

        if (!BackupJsonUtil.IsJsFalsy(d.ContainsKey("company") ? d["company"] : null))
            log.Add("🏢 اطلاعات شرکت: موجود");
        if (!BackupJsonUtil.IsJsFalsy(d.ContainsKey("logoSrc") ? d["logoSrc"] : null))
            log.Add("🖼 لوگو: موجود");

        var migratedFields = 0;
        foreach (var section in SchemaSectionOrder)
        {
            if (d.ContainsKey(section) && d[section] is JsonArray arr)
            {
                var before = arr.Count;
                d[section] = MigrateSection(arr, SchemaDefaults[section]!.AsObject());
                if (d[section] is JsonArray after && after.Count != before) migratedFields++;
            }
        }
        if (migratedFields > 0)
            log.Add("🔧 " + migratedFields + " بخش با migration فیلدی نرمال‌سازی شد");

        if (!d.ContainsKey("schemaVersion") ||
            d["schemaVersion"] is null ||
            d["schemaVersion"]!.GetValueKind() is JsonValueKind.Null or JsonValueKind.Undefined ||
            (d["schemaVersion"] is JsonValue empty && empty.TryGetValue<string>(out var sv) && sv == ""))
        {
            d["schemaVersion"] = 1;
        }
        if (BackupJsonUtil.IsJsFalsy(d.ContainsKey("magic") ? d["magic"] : null))
            d["magic"] = BackupSchemaMigrations.Magic;

        log.Add("✅ آماده برای بارگذاری");
    }

    private static void MigratePhonebook(JsonObject d, List<string> log)
    {
        var pbNode = d.ContainsKey("phonebook") ? d["phonebook"] : null;
        if (pbNode is not JsonArray pbArr || pbArr.Count == 0)
        {
            var pbSrc = d.ContainsKey("pb") && d["pb"] is JsonArray src ? src : new JsonArray();
            if (pbSrc.Count > 0)
            {
                var converted = new JsonArray();
                foreach (var c in pbSrc)
                    converted.Add(ConvertPbContact(c));
                d["phonebook"] = converted;
                log.Add("👥 مخاطبین: " + converted.Count + " نفر (تبدیل از فرمت قدیمی pb)");
            }
            else if (pbNode is JsonArray)
            {
                // ARCH-25: explicit phonebook: [] stays []. No log (same as ARCH-24).
            }
            else
            {
                // ARCH-25: missing/null/wrong-type must remain distinguishable from [].
            }
        }
        else
        {
            log.Add("👥 مخاطبین: " + pbArr.Count + " نفر");
        }
        if (d["phonebook"] is JsonArray livePb)
            d["pb"] = BackupJsonUtil.CloneExact(livePb);
    }

    private static JsonNode ConvertPbContact(JsonNode? c)
    {
        if (c is not JsonObject obj)
            return BackupJsonUtil.CloneExact(c) ?? new JsonObject();
        if (!BackupJsonUtil.IsUndefinedProperty(obj, "fn") || !BackupJsonUtil.IsUndefinedProperty(obj, "ln"))
            return BackupJsonUtil.CloneExact(obj)!;

        var name = BackupJsonUtil.IsJsFalsy(obj.ContainsKey("name") ? obj["name"] : null)
            ? ""
            : BackupJsonUtil.Str(obj["name"]).Trim();
        var parts = Regex.Split(name, @"\s+");
        var fn = parts.Length > 0 && !BackupJsonUtil.IsJsFalsy(JsonValue.Create(parts[0])) ? parts[0] : "";
        if (parts.Length > 0 && parts[0] != "") fn = parts[0];
        else fn = "";
        var ln = parts.Length > 1 ? string.Join(" ", parts.Skip(1)) : "";

        JsonNode phones;
        if (!BackupJsonUtil.IsJsFalsy(obj.ContainsKey("phone") ? obj["phone"] : null))
        {
            phones = new JsonArray { BackupJsonUtil.CloneExact(obj["phone"]) };
        }
        else if (obj.ContainsKey("phones") && !BackupJsonUtil.IsJsFalsy(obj["phones"]))
        {
            phones = BackupJsonUtil.CloneExact(obj["phones"])!;
        }
        else
        {
            phones = new JsonArray();
        }

        var addr = !BackupJsonUtil.IsJsFalsy(obj.ContainsKey("address") ? obj["address"] : null)
            ? BackupJsonUtil.Str(obj["address"])
            : (!BackupJsonUtil.IsJsFalsy(obj.ContainsKey("addr") ? obj["addr"] : null) ? BackupJsonUtil.Str(obj["addr"]) : "");

        return new JsonObject
        {
            ["fn"] = fn,
            ["ln"] = ln,
            ["shop"] = OrEmpty(obj, "shop"),
            ["addr"] = addr,
            ["zip"] = OrEmpty(obj, "zip"),
            ["phones"] = phones,
            ["ita"] = OrEmpty(obj, "ita"),
            ["tg"] = OrEmpty(obj, "tg"),
            ["wa"] = OrEmpty(obj, "wa"),
            ["ig"] = OrEmpty(obj, "ig"),
            ["note"] = OrEmpty(obj, "note"),
            ["cat"] = BackupJsonUtil.IsJsFalsy(obj.ContainsKey("cat") ? obj["cat"] : null) ? "other" : BackupJsonUtil.Str(obj["cat"])
        };
    }

    private static string OrEmpty(JsonObject obj, string key) =>
        BackupJsonUtil.IsJsFalsy(obj.ContainsKey(key) ? obj[key] : null) ? "" : BackupJsonUtil.Str(obj[key]);

    private static void MigrateServicesAlias(JsonObject d, List<string> log)
    {
        var services = d.ContainsKey("services") ? d["services"] : null;
        var svcs = d.ContainsKey("svcs") ? d["svcs"] : null;
        if (BackupJsonUtil.IsJsFalsy(services) && !BackupJsonUtil.IsJsFalsy(svcs))
            d["services"] = BackupJsonUtil.CloneExact(svcs);
        services = d.ContainsKey("services") ? d["services"] : null;
        svcs = d.ContainsKey("svcs") ? d["svcs"] : null;
        if (BackupJsonUtil.IsJsFalsy(svcs) && !BackupJsonUtil.IsJsFalsy(services))
            d["svcs"] = BackupJsonUtil.CloneExact(services);
        if (BackupJsonUtil.IsJsFalsy(d.ContainsKey("services") ? d["services"] : null))
        {
            d["services"] = new JsonArray();
            d["svcs"] = new JsonArray();
        }
        log.Add("🔧 خدمات: " + BackupJsonUtil.JsLengthLog(d["services"]) + " مورد");
    }

    private static int SchemaVer(JsonObject d) => BackupRequiredCollections.InferSchemaVersion(d);

    private static void MigratePartsGate(JsonObject d, List<string> log)
    {
        if (SchemaVer(d) >= 1)
        {
            if (!d.ContainsKey("parts"))
                log.Add("🔩 قطعات: غایب — بدون جایگزینی [] (fail-closed, Schema ≥۱)");
            else if (d["parts"] is null || d["parts"]!.GetValueKind() == JsonValueKind.Null)
                log.Add("🔩 قطعات: null — بدون جایگزینی [] (fail-closed, Schema ≥۱)");
            else if (d["parts"] is not JsonArray)
                log.Add("🔩 قطعات: نوع نامعتبر (" + BackupJsonUtil.JsTypeof(d["parts"]) + ") — بدون جایگزینی [] (fail-closed, Schema ≥۱)");
            else
                log.Add("🔩 قطعات: " + d["parts"]!.AsArray().Count + " مورد");
        }
        else
        {
            if (BackupJsonUtil.IsJsFalsy(d.ContainsKey("parts") ? d["parts"] : null))
            {
                d["parts"] = new JsonArray();
                log.Add("🔩 قطعات: خالی (نسخه قدیمی)");
            }
            else log.Add("🔩 قطعات: " + BackupJsonUtil.JsLengthLog(d["parts"]) + " مورد");
        }
    }

    private static void MigrateWarrantiesGate(JsonObject d, List<string> log)
    {
        if (!d.ContainsKey("warranties"))
            log.Add("🛡 گارانتی: غایب — بدون جایگزینی [] (fail-closed)");
        else if (d["warranties"] is null || d["warranties"]!.GetValueKind() == JsonValueKind.Null)
            log.Add("🛡 گارانتی: null — بدون جایگزینی [] (fail-closed)");
        else if (d["warranties"] is not JsonArray)
            log.Add("🛡 گارانتی: نوع نامعتبر (" + BackupJsonUtil.JsTypeof(d["warranties"]) + ") — بدون جایگزینی [] (fail-closed)");
        else
        {
            var arr = d["warranties"]!.AsArray();
            log.Add("🛡 گارانتی: " + arr.Count + " مورد");
            foreach (var w in arr)
            {
                if (w is JsonObject wo && BackupJsonUtil.IsUndefinedProperty(wo, "accRef"))
                    wo["accRef"] = "";
            }
        }
    }

    private static void MigrateSalesGate(JsonObject d, List<string> log)
    {
        if (SchemaVer(d) >= 1)
        {
            if (!d.ContainsKey("sales"))
                log.Add("🛒 فروش: غایب — بدون جایگزینی [] (fail-closed, Schema ≥۱)");
            else if (d["sales"] is null || d["sales"]!.GetValueKind() == JsonValueKind.Null)
                log.Add("🛒 فروش: null — بدون جایگزینی [] (fail-closed, Schema ≥۱)");
            else if (d["sales"] is not JsonArray)
                log.Add("🛒 فروش: نوع نامعتبر (" + BackupJsonUtil.JsTypeof(d["sales"]) + ") — بدون جایگزینی [] (fail-closed, Schema ≥۱)");
            else
                log.Add("🛒 فروش: " + d["sales"]!.AsArray().Count + " مورد");
        }
        else
        {
            if (BackupJsonUtil.IsJsFalsy(d.ContainsKey("sales") ? d["sales"] : null))
            {
                d["sales"] = new JsonArray();
                log.Add("🛒 فروش: خالی (نسخه قدیمی)");
            }
            else log.Add("🛒 فروش: " + BackupJsonUtil.JsLengthLog(d["sales"]) + " مورد");
        }
    }

    private static void MigrateSalesRecordDefaults(JsonObject d, List<string> log)
    {
        var migratedSales = 0;
        if (d.ContainsKey("sales") && d["sales"] is JsonArray arr)
        {
            foreach (var item in arr)
            {
                if (item is not JsonObject s) continue;
                if (BackupJsonUtil.IsJsFalsy(s.ContainsKey("status") ? s["status"] : null))
                {
                    s["status"] = "final";
                    migratedSales++;
                }
                if (BackupJsonUtil.IsUndefinedProperty(s, "accRef")) s["accRef"] = "";
                if (BackupJsonUtil.IsUndefinedProperty(s, "accountSel")) s["accountSel"] = "";
            }
        }
        if (migratedSales > 0)
            log.Add("🛒 " + migratedSales + " فروش قدیمی بدون وضعیت → به «نهایی» تبدیل شد");
    }

    private static void MigrateTasksFill(JsonObject d, List<string> log)
    {
        if (BackupJsonUtil.IsJsFalsy(d.ContainsKey("tasks") ? d["tasks"] : null))
        {
            d["tasks"] = new JsonArray();
            log.Add("🗓 وظایف: خالی (نسخه قدیمی)");
        }
        else log.Add("🗓 وظایف: " + BackupJsonUtil.JsLengthLog(d["tasks"]) + " مورد");
    }

    private static void MigrateAccountsGate(JsonObject d, List<string> log)
    {
        if (SchemaVer(d) >= 1)
        {
            if (!d.ContainsKey("accounts"))
                log.Add("💰 حساب‌ها: غایب — بدون جایگزینی [] (fail-closed, Schema ≥۱)");
            else if (d["accounts"] is null || d["accounts"]!.GetValueKind() == JsonValueKind.Null)
                log.Add("💰 حساب‌ها: null — بدون جایگزینی [] (fail-closed, Schema ≥۱)");
            else if (d["accounts"] is not JsonArray)
                log.Add("💰 حساب‌ها: نوع نامعتبر (" + BackupJsonUtil.JsTypeof(d["accounts"]) + ") — بدون جایگزینی [] (fail-closed, Schema ≥۱)");
            else
                log.Add("💰 حساب‌ها: " + d["accounts"]!.AsArray().Count + " مورد");
        }
        else
        {
            if (BackupJsonUtil.IsJsFalsy(d.ContainsKey("accounts") ? d["accounts"] : null))
            {
                d["accounts"] = new JsonArray();
                log.Add("💰 حساب‌ها: خالی (نسخه قدیمی)");
            }
            else log.Add("💰 حساب‌ها: " + BackupJsonUtil.JsLengthLog(d["accounts"]) + " مورد");
        }
    }

    private static void FillOptionalArray(JsonObject d, string key, string emptyLog, string presentFmt, List<string> log)
    {
        if (BackupJsonUtil.IsJsFalsy(d.ContainsKey(key) ? d[key] : null))
        {
            d[key] = new JsonArray();
            log.Add(emptyLog);
        }
        else log.Add(string.Format(presentFmt, BackupJsonUtil.JsLengthLog(d[key])));
    }

    private static void MigrateInvoicesGate(JsonObject d, List<string> log)
    {
        if (!d.ContainsKey("invoices"))
            log.Add("📋 فاکتورها: غایب — بدون جایگزینی [] (fail-closed)");
        else if (d["invoices"] is null || d["invoices"]!.GetValueKind() == JsonValueKind.Null)
            log.Add("📋 فاکتورها: null — بدون جایگزینی [] (fail-closed)");
        else if (d["invoices"] is not JsonArray)
            log.Add("📋 فاکتورها: نوع نامعتبر (" + BackupJsonUtil.JsTypeof(d["invoices"]) + ") — بدون جایگزینی [] (fail-closed)");
        else if (BackupJsonUtil.IsJsFalsy(d.ContainsKey("invCtr") ? d["invCtr"] : null) && d["invoices"]!.AsArray().Count > 0)
        {
            var maxNum = 0;
            foreach (var inv in d["invoices"]!.AsArray())
            {
                var n = 0;
                if (inv is JsonObject io && io.ContainsKey("num"))
                    BackupJsonUtil.TryParseInt10(io["num"], out n);
                if (n > maxNum) maxNum = n;
            }
            d["invCtr"] = maxNum + 1;
            log.Add("📋 شماره فاکتور بعدی: " + d["invCtr"] + " (حدس زده شد)");
        }
    }

    private static void ForEachTruthyOrArray(JsonNode? n, Action<JsonNode?> fn, string expr)
    {
        if (BackupJsonUtil.IsJsFalsy(n)) return;
        if (n is JsonArray arr)
        {
            foreach (var x in arr) fn(x);
            return;
        }
        throw new BackupMigrationException(expr + " is not a function");
    }

    private static void MigrateSaleCtr(JsonObject d, List<string> log)
    {
        var maxSaleNum = 0;
        ForEachTruthyOrArray(d.ContainsKey("sales") ? d["sales"] : null, s =>
        {
            var id = s is JsonObject so ? BackupJsonUtil.Str(so.ContainsKey("id") ? so["id"] : null) : "";
            var m = Regex.Match(id, @"^SL-(\d+)$", RegexOptions.IgnoreCase);
            if (m.Success && BackupJsonUtil.TryParseInt10(m.Groups[1].Value, out var n) && n > maxSaleNum)
                maxSaleNum = n;
        }, "(d.sales||[]).forEach");

        var saleCtr = d.ContainsKey("saleCtr") ? d["saleCtr"] : null;
        if (BackupJsonUtil.IsJsFalsy(saleCtr) || BackupJsonUtil.JsLessThan(saleCtr, 1))
        {
            d["saleCtr"] = maxSaleNum + 1;
            log.Add("🛒 شماره فروش بعدی: " + d["saleCtr"] + " (حدس زده شد)");
        }
        else if (BackupJsonUtil.JsLessOrEqual(saleCtr, maxSaleNum))
        {
            d["saleCtr"] = maxSaleNum + 1;
            log.Add("🛒 شماره فروش بعدی اصلاح شد: " + d["saleCtr"]);
        }
    }

    private static void FixMissingIds(JsonObject d, List<string> log, long nowMs)
    {
        var fixedIds = 0;
        if (d.ContainsKey("invoices") && d["invoices"] is JsonArray invoices)
        {
            for (var i = 0; i < invoices.Count; i++)
            {
                if (invoices[i] is JsonObject inv && BackupJsonUtil.IsJsFalsy(inv.ContainsKey("id") ? inv["id"] : null))
                {
                    inv["id"] = "mig_inv_" + i + "_" + nowMs;
                    fixedIds++;
                }
            }
        }
        if (d.ContainsKey("parts") && d["parts"] is JsonArray parts)
        {
            for (var i = 0; i < parts.Count; i++)
            {
                if (parts[i] is JsonObject p && BackupJsonUtil.IsJsFalsy(p.ContainsKey("id") ? p["id"] : null))
                {
                    p["id"] = "mig_part_" + i + "_" + nowMs;
                    fixedIds++;
                }
            }
        }
        if (d.ContainsKey("warranties") && d["warranties"] is JsonArray wars)
        {
            for (var i = 0; i < wars.Count; i++)
            {
                if (wars[i] is JsonObject w && BackupJsonUtil.IsJsFalsy(w.ContainsKey("id") ? w["id"] : null))
                {
                    w["id"] = "mig_war_" + i + "_" + nowMs;
                    fixedIds++;
                }
            }
        }
        if (d.ContainsKey("sales") && d["sales"] is JsonArray sales)
        {
            for (var i = 0; i < sales.Count; i++)
            {
                if (sales[i] is JsonObject s && BackupJsonUtil.IsJsFalsy(s.ContainsKey("id") ? s["id"] : null))
                {
                    s["id"] = "mig_sale_" + i + "_" + nowMs;
                    fixedIds++;
                }
            }
        }

        var tasksNode = d.ContainsKey("tasks") ? d["tasks"] : null;
        if (tasksNode is not JsonArray tasks)
            throw new BackupMigrationException("d.tasks.forEach is not a function");
        for (var i = 0; i < tasks.Count; i++)
        {
            if (tasks[i] is not JsonObject t) continue;
            if (BackupJsonUtil.IsJsFalsy(t.ContainsKey("id") ? t["id"] : null))
            {
                t["id"] = "mig_task_" + i + "_" + nowMs;
                fixedIds++;
            }
            if (BackupJsonUtil.IsJsFalsy(t.ContainsKey("kind") ? t["kind"] : null)) t["kind"] = "do";
            if (BackupJsonUtil.IsJsFalsy(t.ContainsKey("priority") ? t["priority"] : null)) t["priority"] = "normal";
            if (BackupJsonUtil.IsJsFalsy(t.ContainsKey("status") ? t["status"] : null)) t["status"] = "open";
        }
        if (fixedIds > 0)
            log.Add("🔧 " + fixedIds + " آیتم بدون ID اصلاح شد");
    }

    private static void AssignInvoiceUids(JsonObject d, List<string> log)
    {
        var invUidMax = 0;
        if (d.ContainsKey("invoiceUidCtr"))
            BackupJsonUtil.TryParseInt10(d["invoiceUidCtr"], out invUidMax);
        ForEachTruthyOrArray(d.ContainsKey("invoices") ? d["invoices"] : null, inv =>
        {
            if (inv is not JsonObject io) return;
            var raw = io.ContainsKey("invoiceId") ? io["invoiceId"] : (io.ContainsKey("InvoiceId") ? io["InvoiceId"] : null);
            var m = Regex.Match(BackupJsonUtil.Str(raw), @"^INVUID-(\d+)$", RegexOptions.IgnoreCase);
            if (m.Success && BackupJsonUtil.TryParseInt10(m.Groups[1].Value, out var n) && n > invUidMax)
                invUidMax = n;
        }, "(d.invoices||[]).forEach");

        var invUidAssigned = 0;
        ForEachTruthyOrArray(d.ContainsKey("invoices") ? d["invoices"] : null, inv =>
        {
            if (inv is not JsonObject io) return;
            var raw = io.ContainsKey("invoiceId") ? io["invoiceId"] : (io.ContainsKey("InvoiceId") ? io["InvoiceId"] : null);
            var id = BackupJsonUtil.Str(raw).Trim();
            if (id == "")
            {
                invUidMax++;
                io["invoiceId"] = "INVUID-" + BackupJsonUtil.PadStart(invUidMax.ToString(), 6, '0');
                invUidAssigned++;
            }
        }, "(d.invoices||[]).forEach");
        d["invoiceUidCtr"] = invUidMax;
        if (invUidAssigned > 0)
            log.Add("📋 " + invUidAssigned + " فاکتور شناسه داخلی یکتا گرفت (شماره فاکتور عوض نشد)");
    }

    private static void AssignSaleUids(JsonObject d, List<string> log)
    {
        var saleUidMax = 0;
        if (d.ContainsKey("saleUidCtr"))
            BackupJsonUtil.TryParseInt10(d["saleUidCtr"], out saleUidMax);
        ForEachTruthyOrArray(d.ContainsKey("sales") ? d["sales"] : null, s =>
        {
            if (s is not JsonObject so) return;
            var raw = so.ContainsKey("saleUid") ? so["saleUid"] : (so.ContainsKey("SaleUid") ? so["SaleUid"] : null);
            var m = Regex.Match(BackupJsonUtil.Str(raw), @"^SALEUID-(\d+)$", RegexOptions.IgnoreCase);
            if (m.Success && BackupJsonUtil.TryParseInt10(m.Groups[1].Value, out var n) && n > saleUidMax)
                saleUidMax = n;
        }, "(d.sales||[]).forEach");

        var saleUidAssigned = 0;
        ForEachTruthyOrArray(d.ContainsKey("sales") ? d["sales"] : null, s =>
        {
            if (s is not JsonObject so) return;
            var raw = so.ContainsKey("saleUid") ? so["saleUid"] : (so.ContainsKey("SaleUid") ? so["SaleUid"] : null);
            var id = BackupJsonUtil.Str(raw).Trim();
            if (id == "")
            {
                saleUidMax++;
                so["saleUid"] = "SALEUID-" + BackupJsonUtil.PadStart(saleUidMax.ToString(), 6, '0');
                saleUidAssigned++;
            }
        }, "(d.sales||[]).forEach");
        d["saleUidCtr"] = saleUidMax;
        if (saleUidAssigned > 0)
            log.Add("🛒 " + saleUidAssigned + " فروش شناسه داخلی یکتا گرفت (شماره SL عوض نشد)");
    }

    internal static JsonObject MigrateRecord(JsonNode? rec, JsonObject defaults)
    {
        if (rec is null || rec.GetValueKind() is JsonValueKind.Null or JsonValueKind.Undefined
            or JsonValueKind.String or JsonValueKind.Number or JsonValueKind.True or JsonValueKind.False)
        {
            return BackupJsonUtil.CloneExact(defaults)!.AsObject();
        }

        var recObj = rec as JsonObject;
        var recArr = rec as JsonArray;
        var outObj = new JsonObject();
        foreach (var kv in defaults)
        {
            var def = kv.Value;
            if (def is JsonArray || (def is JsonObject && !BackupJsonUtil.IsJsFalsy(def)))
                outObj[kv.Key] = BackupJsonUtil.CloneExact(def);
            else
                outObj[kv.Key] = BackupJsonUtil.CloneExact(def);
        }

        if (recObj != null)
        {
            foreach (var kv in recObj)
                outObj[kv.Key] = BackupJsonUtil.CloneExact(kv.Value);
        }
        else if (recArr != null)
        {
            for (var i = 0; i < recArr.Count; i++)
                outObj[i.ToString()] = BackupJsonUtil.CloneExact(recArr[i]);
        }
        return outObj;
    }

    internal static JsonArray MigrateSection(JsonArray arr, JsonObject defaults)
    {
        var outArr = new JsonArray();
        foreach (var r in arr)
            outArr.Add(MigrateRecord(r, defaults));
        return outArr;
    }
}
