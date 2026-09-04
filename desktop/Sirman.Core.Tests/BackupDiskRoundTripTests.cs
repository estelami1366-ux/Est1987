using System.Diagnostics;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using Sirman.Core.Backup;
using Sirman.Core.Data.Repositories;
using Xunit;

namespace Sirman.Core.Tests;

/// <summary>
/// ARCH-11 — synthetic disk round-trip of Core Finalizer output through the
/// production write representation (HTML pretty-print + UTF-8 no BOM), then
/// re-read of actual file bytes into BackupSnapshot / BackupValidator.
/// Does not call Host.WriteBackupText (that path writes the live shop backup dir).
/// Does not Restore / Merge / Replace. Does not change the checksum contract.
/// </summary>
public class BackupDiskRoundTripTests : IDisposable
{
    private static readonly UTF8Encoding ProductionUtf8NoBom = new(encoderShouldEmitUTF8Identifier: false, throwOnInvalidBytes: true);
    private readonly string _tempDir;
    private readonly List<string> _createdFiles = new();

    public BackupDiskRoundTripTests()
    {
        _tempDir = Path.Combine(Path.GetTempPath(), "sirman-arch11-" + Guid.NewGuid().ToString("n"));
        Directory.CreateDirectory(_tempDir);
    }

    public void Dispose()
    {
        try
        {
            if (Directory.Exists(_tempDir))
                Directory.Delete(_tempDir, recursive: true);
        }
        catch
        {
            // temp leftovers must never block the suite
        }
    }

    [Fact]
    public void T1_ValidFileRoundTrip()
    {
        var session = WriteFinalizedToTemp("t1-valid.json");
        Assert.True(File.Exists(session.Path));
        Assert.True(session.DiskBytes.Length > 0);
        Assert.False(HasUtf8Bom(session.DiskBytes));
        Assert.DoesNotContain('\r', session.DiskText);
        Assert.Contains('\n', session.DiskText);
        Assert.StartsWith("{", session.DiskText, StringComparison.Ordinal);
        Assert.Contains("  \"magic\": \"SIRMAN_BACKUP\"", session.DiskText, StringComparison.Ordinal);
        Assert.True(session.Reopened.Ok);
        Assert.Equal(BackupValidationStatus.VALID, session.Reopened.Status);
    }

    [Fact]
    public void T2_SemanticEquality()
    {
        var session = WriteFinalizedToTemp("t2-semantic.json");
        AssertSemanticEqual(session.PreWrite, session.PostRead);
        Assert.Equal(BackupJsJson.Stringify(session.PreWrite), BackupJsJson.Stringify(session.PostRead));
        Assert.Equal(session.Finalizer.Checksum, BackupJsonUtil.Str(session.PostRead["checksum"]));
        Assert.Equal(session.Finalizer.ChecksumAlgo, BackupJsonUtil.Str(session.PostRead["checksumAlgo"]));
        Assert.Equal(session.Finalizer.ExportedAt, BackupJsonUtil.Str(session.PostRead["exportedAt"]));
        Assert.Equal(
            BackupJsJson.Stringify(session.Finalizer.SectionChecksums),
            BackupJsJson.Stringify(session.PostRead["sectionChecksums"]));
        Assert.Equal(
            BackupJsJson.Stringify(session.Finalizer.Manifest),
            BackupJsJson.Stringify(session.PostRead["manifest"]));
        Assert.Equal(
            BackupJsJson.Stringify(session.Finalizer.AttachmentsIndex),
            BackupJsJson.Stringify(session.PostRead["attachmentsIndex"]));
        Assert.Equal(2, session.PostRead["phonebook"]!.AsArray().Count);
        Assert.Single(session.PostRead["invoices"]!.AsArray());
        Assert.Equal(2, session.Snapshot.ItemCounts.Data!["phonebook"]!.GetValue<int>());
        Assert.Equal(1, session.Snapshot.ItemCounts.Data!["invoices"]!.GetValue<int>());
    }

    [Fact]
    public void T3_ValidatorAfterReopen()
    {
        var session = WriteFinalizedToTemp("t3-reopen.json");
        Assert.True(session.PreWriteValid.Ok, "pre-write must be valid so reopen is the subject");
        Assert.True(session.Reopened.Ok, string.Join("; ", session.Reopened.Errors));
        Assert.Empty(session.Reopened.SectionChecksumMismatches);
        Assert.Empty(session.Reopened.CountMismatches);
        Assert.True(session.Reopened.ChecksumClaimed);
        Assert.Equal("SHA-256", session.Reopened.ChecksumAlgo);
        Assert.False(session.Reopened.ChecksumSkipped);
        Assert.Equal(1, session.Snapshot.Metadata.SchemaVersion);
        Assert.True(session.Snapshot.Shape.PhonebookPresent);
        Assert.True(session.Snapshot.Shape.HasPrintCenter);
        Assert.True(session.Snapshot.Shape.HasAttachmentsIndex);
    }

    [Fact]
    public void T4_ScalarTamper_MustFail()
    {
        var session = WriteFinalizedToTemp("t4-scalar.json");
        var mutated = CloneObj(session.PostRead);
        mutated["phonebook"]![0]!["fn"] = "حسن";
        var result = ValidateDiskCopy("t4-scalar-tamper.json", mutated);
        Assert.False(result.Validation.Ok);
        Assert.Contains("phonebook", result.Validation.SectionChecksumMismatches);
        Assert.NotEqual(session.Finalizer.Sha256Hex, BackupCanonicalChecksum.Sha256Hex(mutated));
    }

    [Fact]
    public void T5_RecordTamper_MustFail()
    {
        var session = WriteFinalizedToTemp("t5-record.json");
        var mutated = CloneObj(session.PostRead);
        mutated["phonebook"]![0] = new JsonObject
        {
            ["fn"] = "tampered",
            ["ln"] = "row",
            ["shop"] = "فروشگاه دیگر"
        };
        var result = ValidateDiskCopy("t5-record-tamper.json", mutated);
        Assert.False(result.Validation.Ok);
        Assert.Contains("phonebook", result.Validation.SectionChecksumMismatches);
    }

    [Fact]
    public void T6_RecordDeletion_MustFail()
    {
        var session = WriteFinalizedToTemp("t6-delete.json");
        var mutated = CloneObj(session.PostRead);
        mutated["phonebook"]!.AsArray().RemoveAt(1);
        var result = ValidateDiskCopy("t6-delete-tamper.json", mutated);
        Assert.False(result.Validation.Ok);
        Assert.Contains("phonebook", result.Validation.CountMismatches);
        Assert.Contains("phonebook", result.Validation.SectionChecksumMismatches);
    }

    [Fact]
    public void T7_RecordAddition_MustFail()
    {
        var session = WriteFinalizedToTemp("t7-add.json");
        var mutated = CloneObj(session.PostRead);
        mutated["invoices"]!.AsArray().Add(new JsonObject { ["invoiceId"] = "INVUID-TAMPER", ["id"] = "INVUID-TAMPER" });
        var result = ValidateDiskCopy("t7-add-tamper.json", mutated);
        Assert.False(result.Validation.Ok);
        Assert.Contains("invoices", result.Validation.CountMismatches);
        Assert.Contains("invoices", result.Validation.SectionChecksumMismatches);
    }

    [Fact]
    public void T8_ItemCountsTamper_MustFail()
    {
        var session = WriteFinalizedToTemp("t8-counts.json");
        var mutated = CloneObj(session.PostRead);
        mutated["itemCounts"]!.AsObject()["invoices"] = 99;
        var result = ValidateDiskCopy("t8-counts-tamper.json", mutated);
        Assert.False(result.Validation.Ok);
        Assert.Contains("invoices", result.Validation.CountMismatches);
    }

    [Fact]
    public void T9_SectionChecksumsTamper_MustFail()
    {
        var session = WriteFinalizedToTemp("t9-sections.json");
        var mutated = CloneObj(session.PostRead);
        mutated["sectionChecksums"]!.AsObject()["phonebook"] = "deadbeef";
        var result = ValidateDiskCopy("t9-sections-tamper.json", mutated);
        Assert.False(result.Validation.Ok);
        Assert.Contains("phonebook", result.Validation.SectionChecksumMismatches);
    }

    [Fact]
    public void T10_ChecksumFieldTamper_MayRemainValidByCurrentContract()
    {
        var session = WriteFinalizedToTemp("t10-checksum.json");
        var mutated = CloneObj(session.PostRead);
        mutated["checksum"] = "0000000000000000000000000000000000000000000000000000000000000000";
        Assert.Equal(session.Finalizer.Sha256Hex, BackupCanonicalChecksum.Sha256Hex(mutated));
        var result = ValidateDiskCopy("t10-checksum-tamper.json", mutated);
        Assert.True(result.Validation.Ok, "stored checksum hex is excluded from the hashed payload and is not compared to the digest");
        Assert.True(result.Validation.ChecksumClaimed);
        Assert.Equal("SHA-256", result.Validation.ChecksumAlgo);
        Assert.Empty(result.Validation.SectionChecksumMismatches);
    }

    [Fact]
    public void T11_ExportedAtTamper_MayRemainValid()
    {
        var session = WriteFinalizedToTemp("t11-exportedAt.json");
        var mutated = CloneObj(session.PostRead);
        mutated["exportedAt"] = "2099-12-31T00:00:00.000Z";
        Assert.Equal(session.Finalizer.Sha256Hex, BackupCanonicalChecksum.Sha256Hex(mutated));
        var result = ValidateDiskCopy("t11-exportedAt-tamper.json", mutated);
        Assert.True(result.Validation.Ok);
        Assert.Equal("2099-12-31T00:00:00.000Z", result.Snapshot.Metadata.ExportedAt);
    }

    [Fact]
    public void T12_WhitespaceTamper_MayRemainValid()
    {
        var session = WriteFinalizedToTemp("t12-ws.json");
        var padded = session.DiskText.Replace("\": ", "\":  ", StringComparison.Ordinal);
        Assert.NotEqual(session.DiskText, padded);
        var result = ValidateRawDiskCopy("t12-ws-tamper.json", padded);
        Assert.True(result.Validation.Ok);
        Assert.Equal(session.Finalizer.Sha256Hex, BackupCanonicalChecksum.Sha256Hex(result.PostRead));
        Assert.Equal(BackupJsJson.Stringify(session.PreWrite), BackupJsJson.Stringify(result.PostRead));
    }

    [Fact]
    public void T13_NewlineTamper_MayRemainValid()
    {
        var session = WriteFinalizedToTemp("t13-nl.json");
        Assert.DoesNotContain('\r', session.DiskText);
        var crlf = session.DiskText.Replace("\n", "\r\n", StringComparison.Ordinal);
        Assert.Contains("\r\n", crlf);
        var result = ValidateRawDiskCopy("t13-nl-tamper.json", crlf);
        Assert.True(result.Validation.Ok);
        Assert.Equal(session.Finalizer.Sha256Hex, BackupCanonicalChecksum.Sha256Hex(result.PostRead));
        Assert.Equal(BackupJsJson.Stringify(session.PreWrite), BackupJsJson.Stringify(result.PostRead));
    }

    [Fact]
    public void T14_NestedKeyOrderTamper_MustFail()
    {
        var session = WriteFinalizedToTemp("t14-order.json");
        var mutated = CloneObj(session.PostRead);
        var row = mutated["phonebook"]![0]!.AsObject();
        mutated["phonebook"]![0] = ReorderObject(row, "shop", "ln", "fn");
        var result = ValidateDiskCopy("t14-order-tamper.json", mutated);
        Assert.False(result.Validation.Ok);
        Assert.Contains("phonebook", result.Validation.SectionChecksumMismatches);
        Assert.NotEqual(session.Finalizer.Sha256Hex, BackupCanonicalChecksum.Sha256Hex(mutated));
    }

    [Fact]
    public void T14b_TopLevelKeyOrder_MayRemainValidByCurrentContract()
    {
        var session = WriteFinalizedToTemp("t14b-toplevel.json");
        var reordered = ReorderObject(CloneObj(session.PostRead), "sections", "itemCounts", "magic");
        var result = ValidateDiskCopy("t14b-toplevel-tamper.json", reordered);
        Assert.True(result.Validation.Ok, "top-level key order is not covered by sectionChecksums; stored SHA-256 is not compared");
        Assert.NotEqual(session.Finalizer.Sha256Hex, BackupCanonicalChecksum.Sha256Hex(reordered));
        Assert.NotEqual(BackupJsJson.Stringify(session.PreWrite), BackupJsJson.Stringify(reordered));
    }

    [Fact]
    public void T15_UnicodePersistsThroughDiskBytes()
    {
        var session = WriteFinalizedToTemp("t15-unicode.json");
        Assert.Contains("علی", session.DiskText, StringComparison.Ordinal);
        Assert.Contains("فروشگاه سیرمان", session.DiskText, StringComparison.Ordinal);
        Assert.DoesNotContain("\\u0639", session.DiskText, StringComparison.Ordinal);
        var fn = session.PostRead["phonebook"]![0]!["fn"]!.GetValue<string>();
        var shop = session.PostRead["phonebook"]![0]!["shop"]!.GetValue<string>();
        Assert.Equal("علی", fn);
        Assert.Equal("فروشگاه سیرمان", shop);
        Assert.True(session.Reopened.Ok);
    }

    [Fact]
    public void T16_OptionalFieldsPreserved()
    {
        var session = WriteFinalizedToTemp("t16-optional.json");
        Assert.True(session.PostRead.ContainsKey("printCenter"));
        Assert.True(session.PostRead["printCenter"]!["enabled"]!.GetValue<bool>());
        Assert.Equal("thermal", session.PostRead["printCenter"]!["printer"]!.GetValue<string>());
        Assert.True(session.PostRead.ContainsKey("attachmentsIndex"));
        Assert.NotNull(session.PostRead["attachmentsIndex"] as JsonArray);
        Assert.True(session.Snapshot.Shape.HasPrintCenter);
        Assert.True(session.Snapshot.Shape.HasAttachmentsIndex);
    }

    [Fact]
    public void T17_NoLiveData()
    {
        var session = WriteFinalizedToTemp("t17-synthetic.json");
        Assert.StartsWith(_tempDir, session.Path, StringComparison.Ordinal);
        Assert.DoesNotContain(Path.Combine("Sirman", "backup"), session.Path, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("localStorage", session.Path, StringComparison.OrdinalIgnoreCase);
        var appDataBackup = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData),
            "Sirman",
            "backup");
        Assert.False(session.Path.StartsWith(appDataBackup, StringComparison.OrdinalIgnoreCase));
        Assert.Equal(_tempDir, Path.GetDirectoryName(session.Path));
    }

    [Fact]
    public void T18_NoRestore()
    {
        var html = File.ReadAllText(HtmlPath());
        Assert.Contains("function importData(", html);
        Assert.Contains("function applyBackupSelective(", html);
        Assert.Contains("function applyBackupMergeSections(", html);
        Assert.Contains("function applyBackupReplaceSections(", html);
        Assert.Contains("function resetAll(", html);
        Assert.Equal("html-backup-engine", JsonBackupRepository.TbdMarker);
        var consumer = File.ReadAllText(CoreBackupDir("BackupSnapshotConsumer.cs"));
        Assert.DoesNotContain("importData", consumer);
        Assert.DoesNotContain("applyBackupMergeSections", consumer);
        Assert.DoesNotContain("resetAll", consumer);
        Assert.Contains("BackupSnapshot.Parse", consumer);
        Assert.Contains("BackupValidator.Validate", consumer);
        var dryRun = File.ReadAllText(CoreBackupDir("BackupDryRunService.cs"));
        Assert.Contains("Applied = false", dryRun);
        Assert.DoesNotContain("Applied = true", dryRun);
    }

    [Fact]
    public void T19_NoStorageSideEffectsBeyondSyntheticTempFile()
    {
        var before = Directory.GetFiles(_tempDir, "*", SearchOption.AllDirectories).Length;
        var session = WriteFinalizedToTemp("t19-temp-only.json");
        var after = Directory.GetFiles(_tempDir, "*", SearchOption.AllDirectories);
        Assert.True(after.Length >= before + 1);
        Assert.All(after, p => Assert.StartsWith(_tempDir, p, StringComparison.Ordinal));
        Assert.False(session.Path.EndsWith(".sirmanbak", StringComparison.OrdinalIgnoreCase));
        Assert.False(File.Exists(session.Path + ".sha256"));
        Assert.False(File.Exists(session.Path + ".sidecard"));
        Assert.Empty(Directory.GetFiles(_tempDir, "*.db", SearchOption.AllDirectories));
        Assert.Empty(Directory.GetFiles(_tempDir, "*.sqlite", SearchOption.AllDirectories));
    }

    [Fact]
    public void T20_PortableWithoutAppOrBrowserState()
    {
        var session = WriteFinalizedToTemp("t20-portable.json");
        var isolated = JsonNode.Parse(session.DiskText);
        var snapshot = BackupSnapshot.Parse(isolated);
        var validation = BackupValidator.Validate(snapshot.Data);
        Assert.True(validation.Ok);
        Assert.Equal(session.Finalizer.Checksum, snapshot.Metadata.HasChecksum ? BackupJsonUtil.Str(snapshot.Data["checksum"]) : "");
        var consumer = File.ReadAllText(CoreBackupDir("BackupSnapshot.cs"));
        Assert.DoesNotContain("localStorage", consumer);
        Assert.DoesNotContain("IndexedDB", consumer);
        Assert.DoesNotContain("Microsoft.Web.WebView2", consumer);
        var validator = File.ReadAllText(CoreBackupDir("BackupValidator.cs"));
        Assert.DoesNotContain("localStorage", validator);
        Assert.DoesNotContain("File.Write", validator);
        var csproj = File.ReadAllText(Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", "Sirman.Core", "Sirman.Core.csproj")));
        Assert.DoesNotContain("Microsoft.Web.WebView2", csproj);
    }

    [Fact]
    public void ProductionWriteSemantics_Utf8NoBomPrettyTwoSpaceLf()
    {
        var host = File.ReadAllText(HostPath());
        var method = Slice(host, "public string WriteBackupText", "public string FinalizeBackup");
        Assert.Contains("new UTF8Encoding(encoderShouldEmitUTF8Identifier: false)", method);
        Assert.Contains("File.WriteAllText(path, content ?? \"\"", method);
        Assert.Contains("GetBackupDir()", method);
        Assert.Contains("sirman_autosave.txt", method);
        Assert.DoesNotContain("encoderShouldEmitUTF8Identifier: true", method);

        var html = File.ReadAllText(HtmlPath());
        Assert.Contains("JSON.stringify(data, null, 2)", html);
        Assert.Contains("JSON.stringify(data,null,2)", html);
        Assert.Contains("WriteBackupText('sirman_autosave.txt', text)", html);

        var session = WriteFinalizedToTemp("semantics.json");
        Assert.False(HasUtf8Bom(session.DiskBytes));
        Assert.Equal(session.PrettyText, session.DiskText);
        Assert.DoesNotContain("\r\n", session.DiskText);
        Assert.Contains("\n  \"", session.DiskText, StringComparison.Ordinal);
        Assert.Equal(session.PrettyText, HtmlPrettyJson.Stringify(session.PreWrite));
        Assert.NotEqual(session.PrettyText, session.Finalizer.CanonicalString);
        Assert.DoesNotContain('\n', session.Finalizer.CanonicalString);
    }

    [Fact]
    public void HtmlPrettyPrint_MatchesNodeJsonStringify()
    {
        var session = WriteFinalizedToTemp("pretty-vs-node.json");
        var nodePretty = NodeJsonStringifyIndent2(BackupJsJson.Stringify(session.PreWrite));
        Assert.Equal(nodePretty, session.PrettyText);
        Assert.Equal(nodePretty, session.DiskText);
    }

    [Fact]
    public void ChecksumContract_DataChangeDetectedByCanonicalDigest_NotByStoredFieldCompare()
    {
        var session = WriteFinalizedToTemp("contract.json");
        var dataChange = CloneObj(session.PostRead);
        dataChange["phonebook"]![0]!["fn"] = "نام دیگر";
        Assert.NotEqual(session.Finalizer.Sha256Hex, BackupCanonicalChecksum.Sha256Hex(dataChange));

        var checksumField = CloneObj(session.PostRead);
        checksumField["checksum"] = new string('a', 64);
        Assert.Equal(session.Finalizer.Sha256Hex, BackupCanonicalChecksum.Sha256Hex(checksumField));

        var exportedAt = CloneObj(session.PostRead);
        exportedAt["exportedAt"] = "1999-01-01T00:00:00.000Z";
        Assert.Equal(session.Finalizer.Sha256Hex, BackupCanonicalChecksum.Sha256Hex(exportedAt));
    }

    [Fact]
    public void ConsumeOnExportRemainsDisabled_AndNoBackupIdOrSirmanbak()
    {
        var html = File.ReadAllText(HtmlPath());
        var export = Slice(html, "async function exportData(", "\nfunction exportSelected(");
        Assert.DoesNotContain("consumeBackupSnapshot", export);
        Assert.DoesNotContain("ConsumeBackupSnapshot", export);
        var autosaveAt = html.IndexOf("async function doAutoSave(", StringComparison.Ordinal);
        Assert.True(autosaveAt >= 0);
        var autosave = html.Substring(autosaveAt, Math.Min(12000, html.Length - autosaveAt));
        Assert.DoesNotContain("consumeBackupSnapshot", autosave);
        Assert.DoesNotContain("ConsumeBackupSnapshot", autosave);
        Assert.Equal("html-backup-engine", JsonBackupRepository.TbdMarker);
    }

    [Fact]
    public void PhonebookAndSqliteProductionSourcesUnchangedByThisPacket()
    {
        var html = File.ReadAllText(HtmlPath());
        Assert.Contains("function savePBContact(", html);
        Assert.Contains("function renderPB(", html);
        Assert.Contains("phonebook", html);
        var sqliteCsproj = File.ReadAllText(Path.GetFullPath(Path.Combine(
            AppContext.BaseDirectory, "..", "..", "..", "..", "Sirman.Persistence.Sqlite", "Sirman.Persistence.Sqlite.csproj")));
        Assert.Contains("Sqlite", sqliteCsproj);
        Assert.Contains("Microsoft.Data.Sqlite", sqliteCsproj);
    }

    private RoundTripSession WriteFinalizedToTemp(string fileName)
    {
        var input = SyntheticBackup();
        var before = BackupJsJson.Stringify(input);
        var fin = BackupFinalizer.Finalize(new BackupFinalizeRequest
        {
            Data = input,
            Origin = "manual",
            Kind = "full",
            ChecksumMode = BackupChecksumMode.Sha256
        });
        Assert.True(fin.Ok, fin.ErrorMessage);
        Assert.NotNull(fin.Data);
        Assert.Equal(before, BackupJsJson.Stringify(input));

        var preWrite = (JsonObject)BackupJsonUtil.CloneExact(fin.Data)!;
        var preWriteValid = BackupValidator.Validate(preWrite);
        var pretty = HtmlPrettyJson.Stringify(preWrite);
        var path = Path.Combine(_tempDir, fileName);
        WriteProductionBytes(path, pretty);
        _createdFiles.Add(path);

        var bytes = File.ReadAllBytes(path);
        var text = ProductionUtf8NoBom.GetString(bytes);
        var parsed = JsonNode.Parse(text);
        Assert.NotNull(parsed);
        var snapshot = BackupSnapshot.Parse(parsed);
        var reopened = BackupValidator.Validate(snapshot.Data);
        return new RoundTripSession
        {
            Path = path,
            Finalizer = fin,
            PreWrite = preWrite,
            PreWriteValid = preWriteValid,
            PrettyText = pretty,
            DiskBytes = bytes,
            DiskText = text,
            PostRead = (JsonObject)BackupJsonUtil.CloneExact(parsed)!,
            Snapshot = snapshot,
            Reopened = reopened
        };
    }

    private DiskValidation ValidateDiskCopy(string fileName, JsonObject mutated)
    {
        var pretty = HtmlPrettyJson.Stringify(mutated);
        return ValidateRawDiskCopy(fileName, pretty);
    }

    private DiskValidation ValidateRawDiskCopy(string fileName, string diskText)
    {
        var path = Path.Combine(_tempDir, fileName);
        WriteProductionBytes(path, diskText);
        _createdFiles.Add(path);
        var bytes = File.ReadAllBytes(path);
        var text = ProductionUtf8NoBom.GetString(bytes);
        var parsed = JsonNode.Parse(text);
        Assert.NotNull(parsed);
        var snapshot = BackupSnapshot.Parse(parsed);
        return new DiskValidation
        {
            Path = path,
            DiskBytes = bytes,
            DiskText = text,
            PostRead = (JsonObject)BackupJsonUtil.CloneExact(parsed)!,
            Snapshot = snapshot,
            Validation = BackupValidator.Validate(snapshot.Data)
        };
    }

    private static void WriteProductionBytes(string path, string content) =>
        File.WriteAllText(path, content ?? "", ProductionUtf8NoBom);

    private static bool HasUtf8Bom(byte[] bytes) =>
        bytes.Length >= 3 && bytes[0] == 0xEF && bytes[1] == 0xBB && bytes[2] == 0xBF;

    private static void AssertSemanticEqual(JsonObject a, JsonObject b)
    {
        foreach (var key in a.Select(kv => kv.Key))
            Assert.True(b.ContainsKey(key), "post-read missing key " + key);
        foreach (var key in b.Select(kv => kv.Key))
            Assert.True(a.ContainsKey(key), "post-read extra key " + key);
        Assert.Equal(a.Count, b.Count);
        Assert.Equal(BackupJsJson.Stringify(a["itemCounts"]), BackupJsJson.Stringify(b["itemCounts"]));
        Assert.Equal(BackupJsJson.Stringify(a["sections"]), BackupJsJson.Stringify(b["sections"]));
        Assert.Equal(BackupJsJson.Stringify(a["manifest"]), BackupJsJson.Stringify(b["manifest"]));
        Assert.Equal(BackupJsJson.Stringify(a["sectionChecksums"]), BackupJsJson.Stringify(b["sectionChecksums"]));
        Assert.Equal(BackupJsJson.Stringify(a["checksum"]), BackupJsJson.Stringify(b["checksum"]));
        Assert.Equal(BackupJsJson.Stringify(a["checksumAlgo"]), BackupJsJson.Stringify(b["checksumAlgo"]));
        Assert.Equal(BackupJsJson.Stringify(a["exportedAt"]), BackupJsJson.Stringify(b["exportedAt"]));
        Assert.Equal(BackupJsJson.Stringify(a["attachmentsIndex"]), BackupJsJson.Stringify(b["attachmentsIndex"]));
        Assert.Equal(BackupJsJson.Stringify(a["printCenter"]), BackupJsJson.Stringify(b["printCenter"]));
        Assert.Equal(BackupJsJson.Stringify(a["phonebook"]), BackupJsJson.Stringify(b["phonebook"]));
        foreach (var section in BackupSnapshotCatalog.SectionsCatalog)
        {
            if (a[section] is JsonArray aa && b[section] is JsonArray ba)
                Assert.Equal(aa.Count, ba.Count);
        }
    }

    private static JsonObject CloneObj(JsonNode node) => (JsonObject)BackupJsonUtil.CloneExact(node)!;

    private static JsonObject ReorderObject(JsonObject src, params string[] firstKeys)
    {
        var next = new JsonObject();
        foreach (var key in firstKeys)
        {
            if (src.ContainsKey(key))
                next[key] = src[key] is null ? null : src[key]!.DeepClone();
        }
        foreach (var kv in src)
        {
            if (next.ContainsKey(kv.Key)) continue;
            next[kv.Key] = kv.Value is null ? null : kv.Value.DeepClone();
        }
        return next;
    }

    private static JsonObject SyntheticBackup()
    {
        var counts = new JsonObject();
        foreach (var k in BackupSnapshotCatalog.ItemCountKeys)
            counts[k] = 0;
        counts["phonebook"] = 2;
        counts["invoices"] = 1;
        var sections = new JsonArray();
        foreach (var s in BackupSnapshotCatalog.SectionsCatalog)
            sections.Add(s);
        return new JsonObject
        {
            ["magic"] = BackupSnapshotCatalog.Magic,
            ["schemaVersion"] = BackupSnapshotCatalog.AppSchemaVersion,
            ["version"] = "1405.6.3α",
            ["applicationVersion"] = "1405.6.3α",
            ["exportedAt"] = "2023-11-14T22:13:20.000Z",
            ["invoices"] = new JsonArray
            {
                new JsonObject { ["invoiceId"] = "INVUID-000001", ["id"] = "INVUID-000001", ["num"] = "1" }
            },
            ["products"] = new JsonArray(),
            ["inventory"] = new JsonObject(),
            ["invCtr"] = 1,
            ["invoiceUidCtr"] = 1,
            ["saleCtr"] = 1,
            ["saleUidCtr"] = 0,
            ["phonebook"] = new JsonArray
            {
                new JsonObject { ["fn"] = "علی", ["ln"] = "رضایی", ["shop"] = "فروشگاه سیرمان" },
                new JsonObject { ["fn"] = "مریم", ["ln"] = "کاظمی", ["shop"] = "خدمات پس از فروش" }
            },
            ["parts"] = new JsonArray(),
            ["services"] = new JsonArray(),
            ["svcs"] = new JsonArray(),
            ["warranties"] = new JsonArray(),
            ["sales"] = new JsonArray(),
            ["tasks"] = new JsonArray(),
            ["accounts"] = new JsonArray(),
            ["defectiveStock"] = new JsonArray(),
            ["warehouseDocs"] = new JsonArray(),
            ["stockMoves"] = new JsonArray(),
            ["warehouses"] = new JsonArray(),
            ["daqi"] = new JsonArray(),
            ["daqiWarehouse"] = new JsonArray(),
            ["daqiVouchers"] = new JsonArray(),
            ["postalHistory"] = new JsonArray(),
            ["appliedUpdates"] = new JsonArray(),
            ["updatePackages"] = new JsonArray(),
            ["userAuditLog"] = new JsonArray(),
            ["bgAuditLog"] = new JsonArray(),
            ["userRoles"] = new JsonArray(),
            ["loginPw"] = "",
            ["printSettings"] = new JsonObject(),
            ["company"] = new JsonObject(),
            ["serviceCenter"] = new JsonObject(),
            ["starredAlarms"] = new JsonArray(),
            ["senderInfo"] = new JsonObject(),
            ["logoSrc"] = "",
            ["acH"] = new JsonObject(),
            ["appearance"] = new JsonObject(),
            ["sms"] = new JsonObject(),
            ["tz"] = "Asia/Tehran",
            ["networkSettings"] = new JsonObject(),
            ["prefs"] = new JsonObject(),
            ["aiKeys"] = new JsonObject(),
            ["itemCounts"] = counts,
            ["sections"] = sections,
            ["printCenter"] = new JsonObject { ["enabled"] = true, ["printer"] = "thermal" }
        };
    }

    private static string NodeJsonStringifyIndent2(string compactJson)
    {
        var inputPath = Path.Combine(Path.GetTempPath(), "sirman-arch11-node-" + Guid.NewGuid().ToString("n") + ".json");
        File.WriteAllText(inputPath, compactJson, ProductionUtf8NoBom);
        try
        {
            var psi = new ProcessStartInfo
            {
                FileName = "node",
                ArgumentList =
                {
                    "-e",
                    "const fs=require('fs'); const d=JSON.parse(fs.readFileSync(process.argv[1],'utf8')); process.stdout.write(JSON.stringify(d,null,2));",
                    inputPath
                },
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                UseShellExecute = false
            };
            using var proc = Process.Start(psi);
            Assert.NotNull(proc);
            var stdout = proc!.StandardOutput.ReadToEnd();
            var stderr = proc.StandardError.ReadToEnd();
            proc.WaitForExit();
            Assert.True(proc.ExitCode == 0, "node JSON.stringify failed: " + stderr);
            return stdout;
        }
        finally
        {
            try { File.Delete(inputPath); } catch { /* ignore */ }
        }
    }

    private static string HostPath() =>
        Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", "Sirman.Desktop", "SirmanHostObject.cs"));

    private static string HtmlPath() =>
        Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", "..", "Sirman_Final.html"));

    private static string CoreBackupDir(string file) =>
        Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", "Sirman.Core", "Backup", file));

    private static string Slice(string src, string start, string end)
    {
        var i = src.IndexOf(start, StringComparison.Ordinal);
        var j = src.IndexOf(end, StringComparison.Ordinal);
        Assert.True(i >= 0 && j > i, start + " .. " + end);
        return src.Substring(i, j - i);
    }

    private sealed class RoundTripSession
    {
        public required string Path { get; init; }
        public required BackupFinalizeResult Finalizer { get; init; }
        public required JsonObject PreWrite { get; init; }
        public required BackupValidationResult PreWriteValid { get; init; }
        public required string PrettyText { get; init; }
        public required byte[] DiskBytes { get; init; }
        public required string DiskText { get; init; }
        public required JsonObject PostRead { get; init; }
        public required BackupSnapshot Snapshot { get; init; }
        public required BackupValidationResult Reopened { get; init; }
    }

    private sealed class DiskValidation
    {
        public required string Path { get; init; }
        public required byte[] DiskBytes { get; init; }
        public required string DiskText { get; init; }
        public required JsonObject PostRead { get; init; }
        public required BackupSnapshot Snapshot { get; init; }
        public required BackupValidationResult Validation { get; init; }
    }
}
