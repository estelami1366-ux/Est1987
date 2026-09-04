using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using Sirman.Core.Backup;
using Sirman.Core.Data.Repositories;
using Xunit;

namespace Sirman.Core.Tests;

/// <summary>
/// ARCH-12 — stored SHA-256 hex must equal BackupCanonicalChecksum digest.
/// Canonical payload definition is unchanged. Synthetic fixtures only.
/// </summary>
public class BackupStoredChecksumTests : IDisposable
{
    private static readonly UTF8Encoding Utf8NoBom = new(encoderShouldEmitUTF8Identifier: false, throwOnInvalidBytes: true);
    private readonly string _tempDir;

    public BackupStoredChecksumTests()
    {
        _tempDir = Path.Combine(Path.GetTempPath(), "sirman-arch12-" + Guid.NewGuid().ToString("n"));
        Directory.CreateDirectory(_tempDir);
    }

    public void Dispose()
    {
        try
        {
            if (Directory.Exists(_tempDir))
                Directory.Delete(_tempDir, recursive: true);
        }
        catch { /* temp leftovers must not fail the suite */ }
    }

    [Fact]
    public void T1_ValidChecksum_Pass()
    {
        var node = FinalizeSha256();
        var before = BackupJsJson.Stringify(node);
        var cmp = BackupStoredChecksum.Compare(node);
        Assert.True(cmp.Compared);
        Assert.True(cmp.Matched);
        Assert.Null(cmp.Error);
        Assert.Equal(BackupCanonicalChecksum.Sha256Hex(node), cmp.ExpectedDigest);
        Assert.Equal(cmp.ExpectedDigest, cmp.Stored);
        Assert.True(BackupValidator.Validate(node).Ok);
        Assert.Equal(before, BackupJsJson.Stringify(node));
    }

    [Fact]
    public void T2_OneHexDigitChanged_Invalid()
    {
        var node = FinalizeSha256();
        var hex = BackupJsonUtil.Str(node["checksum"]);
        var flipped = (hex[0] == '0' ? '1' : '0') + hex[1..];
        node["checksum"] = flipped;
        AssertInvalidStored(node);
        Assert.Equal(BackupCanonicalChecksum.Sha256Hex(FinalizeSha256()), BackupCanonicalChecksum.Sha256Hex(node));
    }

    [Fact]
    public void T3_AllZeroChecksum_Invalid()
    {
        var node = FinalizeSha256();
        node["checksum"] = new string('0', 64);
        AssertInvalidStored(node);
    }

    [Fact]
    public void T4_Random64Hex_Invalid()
    {
        var node = FinalizeSha256();
        node["checksum"] = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
        AssertInvalidStored(node);
    }

    [Fact]
    public void T5_ShortChecksum_Invalid()
    {
        var node = FinalizeSha256();
        node["checksum"] = "abc";
        AssertInvalidStored(node);
    }

    [Fact]
    public void T6_LongChecksum_Invalid()
    {
        var node = FinalizeSha256();
        node["checksum"] = BackupJsonUtil.Str(node["checksum"]) + "ff";
        AssertInvalidStored(node);
    }

    [Fact]
    public void T7_InvalidCharacters_Invalid()
    {
        var node = FinalizeSha256();
        node["checksum"] = "zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz";
        AssertInvalidStored(node);
    }

    [Fact]
    public void T8_UppercaseHex_FailsExactComparison()
    {
        var node = FinalizeSha256();
        var lower = BackupJsonUtil.Str(node["checksum"]);
        Assert.Contains(lower, c => c is >= 'a' and <= 'f');
        node["checksum"] = lower.ToUpperInvariant();
        Assert.NotEqual(lower, BackupJsonUtil.Str(node["checksum"]));
        AssertInvalidStored(node);
        Assert.Equal(lower, BackupCanonicalChecksum.Sha256Hex(node));
    }

    [Fact]
    public void T9_ChecksumMissing_PreservesCompatibleSkip()
    {
        var node = FinalizeSha256();
        node.Remove("checksum");
        var cmp = BackupStoredChecksum.Compare(node);
        Assert.True(cmp.Skipped);
        Assert.False(cmp.Compared);
        Assert.True(BackupValidator.Validate(node).Ok);
        var dry = BackupDryRunService.Run(node);
        Assert.True(dry.Ok);
        Assert.Equal(BackupIntegrityStatus.NOT_VERIFIABLE, dry.IntegrityStatus);
        Assert.False(dry.DigestCompared);
    }

    [Fact]
    public void T10_ChecksumAlgoNone_PreservesCompatibleSkip()
    {
        var node = Schema1();
        node["checksum"] = "";
        node["checksumAlgo"] = "none";
        var cmp = BackupStoredChecksum.Compare(node);
        Assert.True(cmp.Skipped);
        Assert.False(cmp.Compared);
        var noneValidation = BackupValidator.Validate(node);
        Assert.True(noneValidation.Ok, string.Join("; ", noneValidation.Errors));
        var dry = BackupDryRunService.Run(node);
        Assert.True(dry.Ok);
        Assert.Equal(BackupIntegrityStatus.NOT_VERIFIABLE, dry.IntegrityStatus);
        Assert.True(dry.MigrationPerformed);
        Assert.False(dry.Applied);
    }

    [Fact]
    public void T11_UnknownAlgorithm_FailClosed()
    {
        var node = Schema1();
        node["checksum"] = "deadbeef";
        node["checksumAlgo"] = "MD5";
        var cmp = BackupStoredChecksum.Compare(node);
        Assert.True(cmp.Claimed);
        Assert.False(cmp.Compared);
        Assert.Null(cmp.Error);
        var v = BackupValidator.Validate(node);
        Assert.False(v.Ok);
        Assert.Contains(v.Errors, e => e.Contains("الگوریتم", StringComparison.Ordinal));
        var dry = BackupDryRunService.Run(node);
        Assert.False(dry.Ok);
        Assert.False(dry.MigrationPerformed);
        Assert.Null(dry.Data);
        Assert.False(dry.Applied);
    }

    [Fact]
    public void T12_ExportedAtChanged_RemainsCompatible()
    {
        var node = FinalizeSha256();
        var digest = BackupCanonicalChecksum.Sha256Hex(node);
        var canonical = BackupCanonicalChecksum.CanonicalString(node);
        node["exportedAt"] = "2099-12-31T00:00:00.000Z";
        Assert.Equal(digest, BackupCanonicalChecksum.Sha256Hex(node));
        Assert.Equal(canonical, BackupCanonicalChecksum.CanonicalString(node));
        Assert.True(BackupStoredChecksum.Compare(node).Matched);
        Assert.True(BackupValidator.Validate(node).Ok);
    }

    [Fact]
    public void T13_WhitespaceChanged_RemainsCompatible()
    {
        var node = FinalizeSha256();
        var pretty = HtmlPrettyJson.Stringify(node);
        var padded = pretty.Replace("\": ", "\":  ", StringComparison.Ordinal);
        var parsed = JsonNode.Parse(padded);
        Assert.True(BackupValidator.Validate(parsed).Ok);
        Assert.True(BackupStoredChecksum.Compare(parsed).Matched);
        Assert.Equal(BackupCanonicalChecksum.CanonicalString(node), BackupCanonicalChecksum.CanonicalString(parsed));
    }

    [Fact]
    public void T14_DataFieldChanged_MustFail()
    {
        var node = FinalizeSha256();
        node["invoices"]!.AsArray().Add(new JsonObject { ["invoiceId"] = "INVUID-TAMPER" });
        node["itemCounts"]!.AsObject()["invoices"] = 1;
        var v = BackupValidator.Validate(node);
        Assert.False(v.Ok);
        Assert.Contains(BackupStoredChecksum.MismatchMessage, v.Errors);
        Assert.NotEqual(BackupJsonUtil.Str(node["checksum"]), BackupCanonicalChecksum.Sha256Hex(node));
        var dry = BackupDryRunService.Run(node);
        Assert.False(dry.Ok);
        Assert.False(dry.MigrationPerformed);
        Assert.Null(dry.Data);
        Assert.False(dry.Applied);
    }

    [Fact]
    public void DiskRoundTrip_ValidStoredChecksum_Pass()
    {
        var node = FinalizeSha256();
        var path = WritePretty(node, "valid.json");
        var reopened = Reopen(path);
        Assert.True(BackupValidator.Validate(reopened).Ok);
        var cmp = BackupStoredChecksum.Compare(reopened);
        Assert.True(cmp.Compared && cmp.Matched);
        Assert.False(HasBom(File.ReadAllBytes(path)));
    }

    [Fact]
    public void DiskRoundTrip_TamperedStoredChecksum_Invalid()
    {
        var node = FinalizeSha256();
        var path = WritePretty(node, "valid-then-tamper.json");
        var reopened = (JsonObject)Reopen(path);
        reopened["checksum"] = "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";
        var tamperedPath = WritePretty(reopened, "tampered.json");
        var bytes = File.ReadAllBytes(tamperedPath);
        var text = Utf8NoBom.GetString(bytes);
        var parsed = JsonNode.Parse(text);
        var v = BackupValidator.Validate(parsed);
        Assert.False(v.Ok);
        Assert.Contains(BackupStoredChecksum.MismatchMessage, v.Errors);
        var dry = BackupDryRunService.Run(parsed);
        Assert.False(dry.Ok);
        Assert.False(dry.MigrationPerformed);
        Assert.Null(dry.Data);
        Assert.False(dry.Applied);
        var plan = BackupRestorePlanBuilder.Build(parsed, Schema1(), RestorePlanMode.Merge, null, 1);
        Assert.False(plan.Ok);
        Assert.False(plan.Applied);
        Assert.Empty(plan.Sections);
        var consume = BackupSnapshotConsumer.Execute("{\"data\":" + text + "}");
        using var doc = JsonDocument.Parse(consume);
        Assert.False(doc.RootElement.GetProperty("ok").GetBoolean());
        Assert.False(doc.RootElement.GetProperty("applied").GetBoolean());
        Assert.False(doc.RootElement.GetProperty("wrote").GetBoolean());
    }

    [Fact]
    public void CanonicalDefinitionUnchanged_ByStoredCompare()
    {
        var node = FinalizeSha256();
        var a = BackupCanonicalChecksum.Compute(node);
        _ = BackupStoredChecksum.Compare(node);
        var b = BackupCanonicalChecksum.Compute(node);
        Assert.Equal(a.CanonicalString, b.CanonicalString);
        Assert.Equal(a.Sha256Hex, b.Sha256Hex);
        var payload = BackupCanonicalChecksum.Payload(node);
        Assert.False(payload.ContainsKey("exportedAt"));
        Assert.False(payload.ContainsKey("checksum"));
        Assert.False(payload.ContainsKey("checksumAlgo"));
        Assert.True(payload.ContainsKey("sectionChecksums"));
        Assert.True(BackupCanonicalChecksum.IsExcludedKey("exportedAt"));
        Assert.True(BackupCanonicalChecksum.IsExcludedKey("checksum"));
        Assert.True(BackupCanonicalChecksum.IsExcludedKey("checksumAlgo"));
        Assert.False(BackupCanonicalChecksum.IsExcludedKey("sectionChecksums"));
        Assert.DoesNotContain('\n', a.CanonicalString);
        Assert.Contains("علی", BackupJsJson.Stringify(node), StringComparison.Ordinal);
    }

    [Fact]
    public void ComparisonIsCentralized_NoSecondDigestRule()
    {
        var validator = File.ReadAllText(CorePath("BackupValidator.cs"));
        var dry = File.ReadAllText(CorePath("BackupDryRunService.cs"));
        var helper = File.ReadAllText(CorePath("BackupStoredChecksum.cs"));
        Assert.Contains("BackupStoredChecksum.Compare", validator);
        Assert.Contains("BackupStoredChecksum.Compare", dry);
        Assert.Contains("stored == expected", helper);
        Assert.DoesNotContain("ToLowerInvariant", helper);
        Assert.DoesNotContain("OrdinalIgnoreCase", helper);
        Assert.DoesNotContain("Trim()", helper);
        Assert.Equal("html-backup-engine", JsonBackupRepository.TbdMarker);
        Assert.DoesNotContain("BackupMigrator.MigratePackage", File.ReadAllText(CorePath("BackupValidator.cs")));
        Assert.DoesNotContain("BackupMigrator.MigratePackage", File.ReadAllText(CorePath("BackupSnapshotConsumer.cs")));
    }

    [Fact]
    public void InvalidChecksum_DoesNotWriteOrRestore()
    {
        var node = FinalizeSha256();
        node["checksum"] = new string('0', 64);
        var dry = BackupDryRunService.Run(node);
        Assert.False(dry.Applied);
        Assert.Null(dry.Data);
        Assert.False(dry.MigrationPerformed);
        var consumerSrc = File.ReadAllText(CorePath("BackupSnapshotConsumer.cs"));
        Assert.DoesNotContain("localStorage", consumerSrc);
        Assert.DoesNotContain("File.Write", consumerSrc);
        Assert.DoesNotContain("importData", consumerSrc);
        Assert.Contains("applied\\\":false", consumerSrc);
        Assert.Contains("wrote\\\":false", consumerSrc);
        Assert.DoesNotContain("Sirman/backup", _tempDir, StringComparison.OrdinalIgnoreCase);
    }

    private static void AssertInvalidStored(JsonObject node)
    {
        var cmp = BackupStoredChecksum.Compare(node);
        Assert.True(cmp.Compared);
        Assert.False(cmp.Matched);
        Assert.Equal(BackupStoredChecksum.MismatchMessage, cmp.Error);
        var v = BackupValidator.Validate(node);
        Assert.False(v.Ok);
        Assert.Contains(BackupStoredChecksum.MismatchMessage, v.Errors);
    }

    private static JsonObject FinalizeSha256()
    {
        var fin = BackupFinalizer.Finalize(new BackupFinalizeRequest
        {
            Data = Schema1(),
            Origin = "manual",
            Kind = "full",
            ChecksumMode = BackupChecksumMode.Sha256
        });
        Assert.True(fin.Ok);
        Assert.Equal("SHA-256", fin.ChecksumAlgo);
        return (JsonObject)BackupJsonUtil.CloneExact(fin.Data)!;
    }

    private static JsonObject Schema1()
    {
        var counts = new JsonObject();
        foreach (var k in BackupSnapshotCatalog.ItemCountKeys)
            counts[k] = 0;
        counts["phonebook"] = 1;
        var sections = new JsonArray();
        foreach (var s in BackupSnapshotCatalog.SectionsCatalog)
            sections.Add(s);
        var built = new JsonObject
        {
            ["magic"] = BackupSnapshotCatalog.Magic,
            ["schemaVersion"] = BackupSnapshotCatalog.AppSchemaVersion,
            ["version"] = "1405.6.3α",
            ["applicationVersion"] = "1405.6.3α",
            ["exportedAt"] = "2023-11-14T22:13:20.000Z",
            ["invoices"] = new JsonArray(),
            ["products"] = new JsonArray(),
            ["inventory"] = new JsonObject(),
            ["invCtr"] = 1,
            ["invoiceUidCtr"] = 0,
            ["saleCtr"] = 1,
            ["saleUidCtr"] = 0,
            ["phonebook"] = new JsonArray
            {
                new JsonObject { ["fn"] = "علی", ["ln"] = "رضایی", ["shop"] = "فروشگاه سیرمان" }
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
            ["sections"] = sections
        };
        return (JsonObject)JsonNode.Parse(BackupJsJson.Stringify(built))!;
    }

    private string WritePretty(JsonNode node, string name)
    {
        var path = Path.Combine(_tempDir, name);
        File.WriteAllText(path, HtmlPrettyJson.Stringify(node), Utf8NoBom);
        return path;
    }

    private static JsonNode Reopen(string path)
    {
        var bytes = File.ReadAllBytes(path);
        var text = Utf8NoBom.GetString(bytes);
        var parsed = JsonNode.Parse(text);
        Assert.NotNull(parsed);
        return parsed!;
    }

    private static bool HasBom(byte[] bytes) =>
        bytes.Length >= 3 && bytes[0] == 0xEF && bytes[1] == 0xBB && bytes[2] == 0xBF;

    private static string CorePath(string file) =>
        Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", "Sirman.Core", "Backup", file));
}
