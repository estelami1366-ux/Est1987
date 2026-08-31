using Sirman.Core.Printing;
using Xunit;

namespace Sirman.Core.Tests;

public class DiagnosticHistoryTests
{
    [Fact]
    public void SessionId_IsUniqueCollisionResistant()
    {
        var seen = new HashSet<string>(StringComparer.Ordinal);
        for (var i = 0; i < 64; i++)
        {
            var id = DiagnosticHistoryIds.NewSessionId();
            Assert.True(DiagnosticHistoryIds.IsWellFormedSessionId(id));
            Assert.StartsWith("D-", id, StringComparison.Ordinal);
            Assert.DoesNotContain("PJ-", id, StringComparison.Ordinal);
            Assert.True(seen.Add(id), "session id must not collide");
        }
        Assert.NotEqual(DiagnosticHistoryIds.NewEventId(), DiagnosticHistoryIds.NewEventId());
    }

    [Fact]
    public void TwoRuns_CreateTwoRecords()
    {
        using var tmp = new TempHistory();
        var store = tmp.Store();
        store.Append(Submitted("A4", "alpha"));
        store.Append(Submitted("A5", "beta"));
        var all = store.ReadChronological();
        Assert.Equal(2, all.Count);
        Assert.Equal("alpha", all[0].PrinterName);
        Assert.Equal("beta", all[1].PrinterName);
        Assert.NotEqual(all[0].SessionId, all[1].SessionId);
    }

    [Fact]
    public void SecondRun_DoesNotOverwriteFirst()
    {
        using var tmp = new TempHistory();
        var store = tmp.Store();
        var first = Submitted("A4", "keep-me");
        first.SessionId = DiagnosticHistoryIds.NewSessionId();
        store.Append(first);
        var before = File.ReadAllText(tmp.FilePath);
        store.Append(Submitted("A5", "second"));
        var after = File.ReadAllText(tmp.FilePath);
        Assert.StartsWith(before.TrimEnd(), after, StringComparison.Ordinal);
        var lines = File.ReadAllLines(tmp.FilePath);
        Assert.Equal(2, lines.Length);
        Assert.Contains("keep-me", lines[0], StringComparison.Ordinal);
        Assert.DoesNotContain("keep-me", lines[1], StringComparison.Ordinal);
    }

    [Fact]
    public void History_SurvivesRestart_NewStoreSameFile()
    {
        using var tmp = new TempHistory();
        var first = tmp.Store();
        first.Append(Submitted("A4", "before-restart"));
        first.Append(Submitted("A5", "still-there"));
        var restarted = new DiagnosticHistoryStore(tmp.FilePath);
        var newest = restarted.ReadAllNewestFirst();
        Assert.Equal(2, newest.Count);
        Assert.Equal("still-there", newest[0].PrinterName);
        Assert.Equal("before-restart", newest[1].PrinterName);
    }

    [Fact]
    public void HistoryWriteFailure_DoesNotThrow_AndPreservesPrior()
    {
        using var tmp = new TempHistory();
        var good = tmp.Store();
        good.Append(Submitted("A4", "prior"));
        var blocked = Path.Combine(tmp.Dir, "blocked-history.jsonl");
        Directory.CreateDirectory(blocked);
        var bad = new DiagnosticHistoryStore(blocked);
        var ok = bad.TryAppend(Submitted("A5", "must-fail"), out var error);
        Assert.False(ok);
        Assert.False(string.IsNullOrWhiteSpace(error));
        var again = new DiagnosticHistoryStore(tmp.FilePath);
        var kept = again.ReadChronological();
        Assert.Single(kept);
        Assert.Equal("prior", kept[0].PrinterName);
    }

    [Fact]
    public void PrintSubmitted_DoesNotBecomePhysicalVerified()
    {
        using var tmp = new TempHistory();
        var store = tmp.Store();
        var evt = Submitted("A5", "postal-printer");
        evt.SubmissionStatus = "PRINT_SUBMITTED";
        evt.PhysicalVerification = DiagnosticHistoryStates.NotRun;
        store.Append(evt);
        var read = store.ReadChronological()[0];
        Assert.Equal(DiagnosticHistoryEventTypes.Submitted, read.EventType);
        Assert.Equal("PRINT_SUBMITTED", read.SubmissionStatus);
        Assert.Equal(DiagnosticHistoryStates.NotRun, read.PhysicalVerification);
        Assert.NotEqual(DiagnosticHistoryStates.PhysicalVerified, read.PhysicalVerification);
        Assert.NotEqual("PHYSICAL_PRINT_VERIFIED", read.PhysicalVerification);
        var contract = PrintStatusContract.Normalize(read.SubmissionStatus, null, "print");
        Assert.Equal(PrintStatusContract.Submitted, contract);
        Assert.Equal(
            PrintStatusContract.PhysicalPrintNotVerified,
            PrintStatusContract.PhysicalStatus(contract, "print", paperVerified: false));
    }

    [Fact]
    public void PhysicalVerification_IsSeparateImmutableEvent()
    {
        using var tmp = new TempHistory();
        var store = tmp.Store();
        var session = DiagnosticHistoryIds.NewSessionId();
        var submit = Submitted("A5", "shop");
        submit.SessionId = session;
        submit.DocumentKind = NativePrintRequest.KindPostalLabel;
        store.Append(submit);
        var firstLine = File.ReadAllLines(tmp.FilePath)[0];
        var verify = store.AppendVerification(session, came: true, notes: "human paper");
        var lines = File.ReadAllLines(tmp.FilePath);
        Assert.Equal(2, lines.Length);
        Assert.Equal(firstLine, lines[0], StringComparer.Ordinal);
        Assert.Equal(session, verify.SessionId);
        Assert.Equal(DiagnosticHistoryEventTypes.PhysicalVerified, verify.EventType);
        Assert.Equal(DiagnosticHistoryStates.PhysicalVerified, verify.PhysicalVerification);
        var chrono = store.ReadChronological();
        Assert.Equal(DiagnosticHistoryEventTypes.Submitted, chrono[0].EventType);
        Assert.Equal(DiagnosticHistoryStates.NotRun, chrono[0].PhysicalVerification);
        Assert.Equal(DiagnosticHistoryEventTypes.PhysicalVerified, chrono[1].EventType);
        Assert.Equal(session, chrono[0].SessionId);
        Assert.Equal(session, chrono[1].SessionId);
        Assert.NotEqual(chrono[0].EventId, chrono[1].EventId);
    }

    [Fact]
    public void UnknownRuntimeValues_RemainNull()
    {
        using var tmp = new TempHistory();
        var store = tmp.Store();
        var session = DiagnosticHistoryIds.NewSessionId();
        store.Append(new DiagnosticHistoryEvent
        {
            SessionId = session,
            EventType = DiagnosticHistoryEventTypes.Submitted,
            PhysicalVerification = DiagnosticHistoryStates.NotRun
        });
        var read = store.ReadChronological()[0];
        Assert.Equal(session, read.SessionId);
        Assert.Null(read.PrinterName);
        Assert.Null(read.RequestedPaper);
        Assert.Null(read.ResolvedPaper);
        Assert.Null(read.PaperKind);
        Assert.Null(read.PageBounds);
        Assert.Null(read.DpiX);
        Assert.Null(read.LogoSourceKind);
        Assert.Null(read.LogoResolved);
        Assert.Null(read.LogoLoadSuccess);
        Assert.Null(read.QueueJobId);
        Assert.Null(read.ErrorCode);
        Assert.Null(read.VisualVerification);
        Assert.Null(read.RequestedLandscape);
        Assert.Null(read.Copies);
        Assert.False(string.IsNullOrWhiteSpace(read.TimestampUtc));
        Assert.False(string.IsNullOrWhiteSpace(read.EventId));
    }

    [Fact]
    public void CorruptLine_DoesNotEraseValidPriorRecords()
    {
        using var tmp = new TempHistory();
        var store = tmp.Store();
        store.Append(Submitted("A4", "good-1"));
        File.AppendAllText(tmp.FilePath, "NOT-JSON {{{corrupt\n");
        store.Append(Submitted("A5", "good-2"));
        var original = File.ReadAllText(tmp.FilePath);
        Assert.Contains("NOT-JSON", original, StringComparison.Ordinal);
        var read = store.ReadChronological();
        Assert.Equal(2, read.Count);
        Assert.Equal("good-1", read[0].PrinterName);
        Assert.Equal("good-2", read[1].PrinterName);
        var afterRead = File.ReadAllText(tmp.FilePath);
        Assert.Equal(original, afterRead);
        Assert.True(File.Exists(tmp.FilePath + DiagnosticHistoryStore.CorruptCopySuffix));
        var preserved = File.ReadAllText(tmp.FilePath + DiagnosticHistoryStore.CorruptCopySuffix);
        Assert.Contains("NOT-JSON", preserved, StringComparison.Ordinal);
        Assert.Contains("good-1", preserved, StringComparison.Ordinal);
    }

    [Fact]
    public void DefaultPath_IsIsolatedJsonl_NotBusinessSqlite()
    {
        var path = DiagnosticHistoryStore.DefaultFilePath(Path.Combine("LocalAppData", "Sirman"));
        Assert.Contains("diagnostics", path, StringComparison.Ordinal);
        Assert.EndsWith("history.jsonl", path, StringComparison.Ordinal);
        Assert.DoesNotContain("sirman.sqlite", path, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("print-jobs.jsonl", path, StringComparison.OrdinalIgnoreCase);
        var srcPath = Path.GetFullPath(Path.Combine(
            AppContext.BaseDirectory, "..", "..", "..", "..", "Sirman.Core", "Printing", "DiagnosticHistory.cs"));
        Assert.True(File.Exists(srcPath), srcPath);
        var src = File.ReadAllText(srcPath);
        Assert.DoesNotContain("sirman.sqlite", src, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("localStorage", src, StringComparison.Ordinal);
        Assert.DoesNotContain("invoices", src, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("accounts", src, StringComparison.OrdinalIgnoreCase);
    }

    private static DiagnosticHistoryEvent Submitted(string paper, string printer) => new()
    {
        SessionId = DiagnosticHistoryIds.NewSessionId(),
        EventType = DiagnosticHistoryEventTypes.Submitted,
        TestType = "native-test",
        DocumentKind = NativePrintRequest.KindTestPage,
        Engine = NativePrintRequest.EngineNative,
        PrinterName = printer,
        RequestedPaper = paper,
        SubmissionStatus = "PRINT_SUBMITTED",
        PhysicalVerification = DiagnosticHistoryStates.NotRun
    };

    private sealed class TempHistory : IDisposable
    {
        public string Dir { get; }
        public string FilePath { get; }

        public TempHistory()
        {
            Dir = System.IO.Path.Combine(System.IO.Path.GetTempPath(), "sirman-p05r7-" + Guid.NewGuid().ToString("N"));
            FilePath = System.IO.Path.Combine(Dir, "history.jsonl");
            Directory.CreateDirectory(Dir);
        }

        public DiagnosticHistoryStore Store() => new(FilePath);

        public void Dispose()
        {
            try { Directory.Delete(Dir, recursive: true); } catch { /* test temp */ }
        }
    }
}
