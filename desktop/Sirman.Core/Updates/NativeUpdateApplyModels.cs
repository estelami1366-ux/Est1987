namespace Sirman.Core.Updates;

public static class NativeUpdateJournalState
{
    public const string Prepared = "PREPARED";
    public const string Applying = "APPLYING";
    public const string Applied = "APPLIED";
    public const string Verified = "VERIFIED";
    public const string Failed = "FAILED";
    public const string RollingBack = "ROLLING_BACK";
    public const string RolledBack = "ROLLED_BACK";
}

public sealed class NativeUpdateJournal
{
    public int Schema { get; set; } = 1;
    public string State { get; set; } = "";
    public string PackageId { get; set; } = "";
    public string Version { get; set; } = "";
    public string Assembly { get; set; } = "";
    public string PackageDirectory { get; set; } = "";
    public string StagingDirectory { get; set; } = "";
    public string InstallDirectory { get; set; } = "";
    public string BackupDirectory { get; set; } = "";
    public List<string> Files { get; set; } = new();
    public List<NativeUpdateFileEntry> BackupFiles { get; set; } = new();
    public string UpdatedAtUtc { get; set; } = "";
    public string? Error { get; set; }
    public string? Message { get; set; }
}

public interface INativeProcessCoordinator
{
    bool IsSirmanRunning();
    NativeUpdateValidationResult StopSirman();
}

public interface INativeAppLauncher
{
    NativeUpdateValidationResult Launch(string installDirectory);
}

public sealed class NativeUpdateApplyRequest
{
    public string PackageDirectory { get; init; } = "";
    public string InstallDirectory { get; init; } = "";
    public string DataRoot { get; init; } = "";
    public bool LaunchAfter { get; init; }
    public bool AllowDowngrade { get; init; }
    public INativeProcessCoordinator? Processes { get; init; }
    public INativeAppLauncher? Launcher { get; init; }
    /// <summary>Test hook. Return false to fail the Nth replace (0-based).</summary>
    public Func<string, string, int, bool>? TryCopy { get; init; }
}

public sealed class NativeUpdateApplyResult
{
    public bool Ok { get; init; }
    public string Error { get; init; } = "";
    public string Message { get; init; } = "";
    public string State { get; init; } = "";
    public string? JournalPath { get; init; }
    public string? BackupDirectory { get; init; }
    public NativeUpdateManifest? Manifest { get; init; }
    public bool ProcessStopRequested { get; init; }
    public bool Launched { get; init; }
    public int CopyAttempts { get; init; }

    public static NativeUpdateApplyResult Fail(string error, string message, NativeUpdateJournal? journal = null, string? journalPath = null) =>
        new()
        {
            Ok = false,
            Error = error,
            Message = message,
            State = journal?.State ?? NativeUpdateJournalState.Failed,
            JournalPath = journalPath,
            BackupDirectory = journal?.BackupDirectory
        };

    public static NativeUpdateApplyResult Pass(string state, string message, NativeUpdateJournal journal, string journalPath, NativeUpdateManifest? manifest, bool stopped, bool launched, int copies) =>
        new()
        {
            Ok = true,
            Message = message,
            State = state,
            JournalPath = journalPath,
            BackupDirectory = journal.BackupDirectory,
            Manifest = manifest,
            ProcessStopRequested = stopped,
            Launched = launched,
            CopyAttempts = copies
        };
}

public sealed class RecordingProcessCoordinator : INativeProcessCoordinator
{
    public bool Running { get; set; }
    public bool FailStop { get; set; }
    public int StopCalls { get; private set; }

    public bool IsSirmanRunning() => Running;

    public NativeUpdateValidationResult StopSirman()
    {
        StopCalls++;
        if (FailStop)
            return NativeUpdateValidationResult.Fail("native-process", "فرآیند سیرمان بسته نشد.");
        Running = false;
        return NativeUpdateValidationResult.Pass(new NativeUpdateManifest { Id = "process" });
    }
}

public sealed class RecordingAppLauncher : INativeAppLauncher
{
    public int LaunchCalls { get; private set; }
    public string? LastInstall { get; private set; }
    public bool Fail { get; set; }

    public NativeUpdateValidationResult Launch(string installDirectory)
    {
        LaunchCalls++;
        LastInstall = installDirectory;
        if (Fail)
            return NativeUpdateValidationResult.Fail("native-launch", "اجرای سیرمان پس از آپدیت انجام نشد.");
        return NativeUpdateValidationResult.Pass(new NativeUpdateManifest { Id = "launch" });
    }
}
