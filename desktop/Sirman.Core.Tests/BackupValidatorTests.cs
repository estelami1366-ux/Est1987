using System.Text.Json;
using System.Text.Json.Nodes;
using Sirman.Core.Backup;
using Sirman.Core.Data.Repositories;
using Xunit;

namespace Sirman.Core.Tests;

/// <summary>
/// ARCH-2 — HTML golden fixtures vs Sirman.Core.Backup. HTML is the baseline.
/// If a fixture differs, stop; do not change HTML to make Core pass.
/// </summary>
public class BackupValidatorTests
{
    private static readonly JsonElement Root = LoadRoot();

    private static JsonElement LoadRoot()
    {
        var path = FindGoldenPath();
        return JsonDocument.Parse(File.ReadAllText(path)).RootElement;
    }

    private static string FindGoldenPath()
    {
        const string name = "BackupValidatorGolden.json";
        var candidates = new[]
        {
            Path.Combine(AppContext.BaseDirectory, name),
            Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "..", "..", "..", name))
        };
        foreach (var p in candidates)
        {
            if (File.Exists(p)) return p;
        }
        throw new FileNotFoundException("ARCH-2 golden file not found: " + name);
    }

    public static IEnumerable<object[]> FixtureIds()
    {
        foreach (var row in Root.GetProperty("fixtures").EnumerateArray())
            yield return new object[] { row.GetProperty("id").GetString()! };
    }

    [Theory]
    [MemberData(nameof(FixtureIds))]
    public void HtmlGolden_MatchesCore_ForEveryFixture(string id)
    {
        var row = FindFixture(id);
        var input = ParseInput(row);
        var html = row.GetProperty("html");

        var before = BackupCanonicalChecksum.SectionHash(input);
        var required = BackupRequiredCollections.Validate(input);
        var structural = BackupStructuralValidator.Validate(input);
        var portable = BackupPortableIntegrity.Validate(input);
        var combined = BackupValidator.Validate(input);
        var integrity = BackupCanonicalChecksum.Compute(input);
        Assert.Equal(before, BackupCanonicalChecksum.SectionHash(input));

        AssertSlice("required", id, html.GetProperty("required"), required, requiredOnly: true);
        AssertSlice("structural", id, html.GetProperty("structural"), structural, structural: true);
        AssertSlice("portable", id, html.GetProperty("portable"), portable, portable: true);
        AssertCombined(id, html.GetProperty("combined"), combined, input);

        var htmlInt = html.GetProperty("integrity");
        Assert.True(htmlInt.GetProperty("canonicalString").GetString() == integrity.CanonicalString,
            id + " canonicalString HTML=" + htmlInt.GetProperty("canonicalString").GetString() + " Core=" + integrity.CanonicalString);
        Assert.True(htmlInt.GetProperty("sha256Hex").GetString() == integrity.Sha256Hex,
            id + " sha256Hex HTML=" + htmlInt.GetProperty("sha256Hex").GetString() + " Core=" + integrity.Sha256Hex);
        Assert.Equal(htmlInt.GetProperty("checksumClaimed").GetBoolean(), integrity.ChecksumClaimed);
        Assert.Equal(htmlInt.GetProperty("checksumAlgo").GetString(), integrity.ChecksumAlgo);
        Assert.Equal(htmlInt.GetProperty("checksumSkipped").GetBoolean(), integrity.ChecksumSkipped);

        var htmlKeys = html.GetProperty("requiredKeys").EnumerateArray().Select(x => x.GetString()).ToArray();
        Assert.Equal(htmlKeys, BackupRequiredCollections.RequiredFor(input).ToArray());
        Assert.Equal(html.GetProperty("schemaVersion").GetInt32(), BackupRequiredCollections.InferSchemaVersion(input));
    }

    [Fact]
    public void CanonicalExclusions_ExportedAtChecksumAlgo_DoNotChangeHash()
    {
        var a = FindFixture("canonical-excludes-exportedAt-checksum");
        var b = FindFixture("exportedAt-changed-same-canonical");
        var c = FindFixture("checksum-field-changed-same-canonical");
        var ha = BackupCanonicalChecksum.Compute(ParseInput(a));
        var hb = BackupCanonicalChecksum.Compute(ParseInput(b));
        var hc = BackupCanonicalChecksum.Compute(ParseInput(c));
        Assert.Equal(ha.CanonicalString, hb.CanonicalString);
        Assert.Equal(ha.Sha256Hex, hb.Sha256Hex);
        Assert.Equal(ha.CanonicalString, hc.CanonicalString);
        Assert.Equal(ha.Sha256Hex, hc.Sha256Hex);
        Assert.Equal(64, ha.Sha256Hex.Length);
        Assert.Matches("^[0-9a-f]{64}$", ha.Sha256Hex);
    }

    [Fact]
    public void KeyOrder_IsInsertionOrder_NotSorted()
    {
        var a = BackupCanonicalChecksum.CanonicalString(ParseInput(FindFixture("key-order-schema-first")));
        var b = BackupCanonicalChecksum.CanonicalString(ParseInput(FindFixture("key-order-accounts-first")));
        Assert.NotEqual(a, b);
        Assert.StartsWith("{\"schemaVersion\":1,", a);
        Assert.StartsWith("{\"accounts\":[],", b);
    }

    [Fact]
    public void Phonebook_IsNotScanned()
    {
        var r = BackupStructuralValidator.DetectDuplicateIdentities(ParseInput(FindFixture("phonebook-not-scanned")));
        Assert.True(r.Ok);
        Assert.Empty(r.DuplicateIdentities);
        Assert.Empty(r.Warnings);
    }

    [Fact]
    public void Tasks_AreNotRequired()
    {
        Assert.DoesNotContain("tasks", RequiredCollectionsRegistry.Always);
        foreach (var kv in RequiredCollectionsRegistry.FromSchema)
            Assert.DoesNotContain("tasks", kv.Value);
        var r = BackupRequiredCollections.Validate(ParseInput(FindFixture("schema1-complete-empty")));
        Assert.True(r.Ok);
        Assert.DoesNotContain("tasks", r.RequiredKeys);
    }

    [Fact]
    public void Schema0_OmitsSalesPartsAccounts_Compatible()
    {
        var r = BackupRequiredCollections.Validate(ParseInput(FindFixture("schema0-missing-sales-parts-accounts")));
        Assert.True(r.Ok);
        Assert.Equal(new[] { "warranties", "invoices" }, r.RequiredKeys.ToArray());
    }

    [Fact]
    public void Schema1_MissingSalesPartsAccounts_Invalid()
    {
        Assert.False(BackupRequiredCollections.Validate(ParseInput(FindFixture("schema1-missing-sales"))).Ok);
        Assert.False(BackupRequiredCollections.Validate(ParseInput(FindFixture("schema1-missing-parts"))).Ok);
        Assert.False(BackupRequiredCollections.Validate(ParseInput(FindFixture("schema1-missing-accounts"))).Ok);
    }

    [Fact]
    public void JsonBackupRepository_RemainsTbdStub()
    {
        var repo = new JsonBackupRepository(new Sirman.Core.Data.CurrentJsonStore());
        Assert.Equal("html-backup-engine", JsonBackupRepository.TbdMarker);
        var exported = repo.Export();
        Assert.Equal(true, exported["tbd"]?.GetValue<bool>());
        Assert.Equal("html-backup-engine", exported["engine"]?.ToString());
    }

    [Fact]
    public void BackupValidator_DoesNotReferenceUiOrBrowserTypes()
    {
        var asm = typeof(BackupValidator).Assembly;
        var backupTypes = asm.GetTypes().Where(t => t.Namespace == "Sirman.Core.Backup").ToArray();
        Assert.True(backupTypes.Length >= 3);
        foreach (var t in backupTypes)
        {
            Assert.DoesNotContain("Windows", t.FullName);
            Assert.DoesNotContain("WebView", t.FullName);
            foreach (var m in t.GetMethods())
            {
                foreach (var p in m.GetParameters())
                {
                    var n = p.ParameterType.FullName ?? "";
                    Assert.DoesNotContain("System.Windows", n);
                    Assert.DoesNotContain("WebView2", n);
                    Assert.DoesNotContain("WinForms", n);
                }
            }
        }
    }

    private static JsonElement FindFixture(string id)
    {
        foreach (var row in Root.GetProperty("fixtures").EnumerateArray())
        {
            if (row.GetProperty("id").GetString() == id) return row;
        }
        throw new InvalidOperationException("fixture not found: " + id);
    }

    private static JsonNode? ParseInput(JsonElement row)
    {
        if (!row.TryGetProperty("input", out var inp) || inp.ValueKind == JsonValueKind.Undefined)
            return null;
        if (inp.ValueKind == JsonValueKind.Null) return null;
        return JsonNode.Parse(inp.GetRawText());
    }

    private static void AssertSlice(
        string label,
        string id,
        JsonElement html,
        BackupValidationResult core,
        bool requiredOnly = false,
        bool structural = false,
        bool portable = false)
    {
        Assert.True(html.GetProperty("ok").GetBoolean() == core.Ok, id + " " + label + ".ok");
        if (html.TryGetProperty("status", out var st))
            Assert.True(st.GetString() == core.StatusName, id + " " + label + ".status html=" + st.GetString() + " core=" + core.StatusName);
        Assert.Equal(StrList(html, "errors"), core.Errors.ToList());
        Assert.Equal(StrList(html, "warnings"), core.Warnings.ToList());
        if (requiredOnly || structural)
        {
            Assert.Equal(StrList(html, "missingRequiredCollections"), core.MissingRequiredCollections.ToList());
            Assert.Equal(StrList(html, "invalidCollections"), core.InvalidCollections.ToList());
        }
        if (structural)
        {
            Assert.Equal(StrList(html, "countMismatches"), core.CountMismatches.ToList());
            Assert.Equal(html.GetProperty("brokenAttachmentRefs").GetArrayLength(), core.BrokenAttachmentRefs.Count);
            Assert.Equal(html.GetProperty("duplicateIdentities").GetArrayLength(), core.DuplicateIdentities.Count);
            var i = 0;
            foreach (var d in html.GetProperty("duplicateIdentities").EnumerateArray())
            {
                var c = core.DuplicateIdentities[i++];
                Assert.Equal(d.GetProperty("collection").GetString(), c.Collection);
                Assert.Equal(d.GetProperty("field").GetString(), c.Field);
                Assert.Equal(d.GetProperty("value").GetString(), c.Value);
                Assert.Equal(d.GetProperty("index").GetInt32(), c.Index);
            }
        }
        if (portable)
        {
            Assert.Equal(StrList(html, "sectionChecksumMismatches"), core.SectionChecksumMismatches.ToList());
            Assert.Equal(html.GetProperty("checksumClaimed").GetBoolean(), core.ChecksumClaimed);
            Assert.Equal(html.GetProperty("checksumAlgo").GetString(), core.ChecksumAlgo);
            Assert.Equal(html.GetProperty("checksumSkipped").GetBoolean(), core.ChecksumSkipped);
            Assert.Equal(html.GetProperty("hasBackupId").GetBoolean(), core.HasBackupId);
        }
    }

    private static void AssertCombined(string id, JsonElement html, BackupValidationResult core, JsonNode? input)
    {
        var stored = BackupStoredChecksum.Compare(input);
        if (stored.Compared && !stored.Matched)
        {
            Assert.False(core.Ok, id + " ARCH-12 Core-strict stored checksum must be INVALID");
            Assert.Equal(BackupValidationStatus.INVALID, core.Status);
            Assert.Contains(BackupStoredChecksum.MismatchMessage, core.Errors);
            Assert.True(html.GetProperty("ok").GetBoolean(), id + " HTML combined remains portable-only (verifyChecksum is separate)");
            return;
        }

        Assert.True(html.GetProperty("ok").GetBoolean() == core.Ok, id + " combined.ok");
        Assert.True(html.GetProperty("status").GetString() == core.StatusName, id + " combined.status");
        Assert.Equal(StrList(html, "errors"), core.Errors.ToList());
        Assert.Equal(StrList(html, "warnings"), core.Warnings.ToList());
    }

    private static List<string> StrList(JsonElement obj, string name)
    {
        var list = new List<string>();
        if (!obj.TryGetProperty(name, out var arr) || arr.ValueKind != JsonValueKind.Array)
            return list;
        foreach (var x in arr.EnumerateArray())
            list.Add(x.GetString() ?? "");
        return list;
    }
}
