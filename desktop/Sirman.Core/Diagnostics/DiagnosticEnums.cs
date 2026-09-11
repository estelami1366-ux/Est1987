namespace Sirman.Core.Diagnostics;

public enum DiagnosticSeverity
{
    Info = 0,
    Warning = 1,
    Error = 2,
    Critical = 3,
    Audit = 4
}

public enum DiagnosticModule
{
    Unknown = 0,
    Inventory = 1,
    Sales = 2,
    Warranty = 3,
    Print = 4,
    Data = 5,
    System = 6,
    Accounts = 7,
    Security = 8,
    Backup = 9,
    Host = 10
}

public enum IncidentStatus
{
    Open = 0,
    Acknowledged = 1,
    Resolved = 2,
    Closed = 3
}

public enum OperationOutcome
{
    Unknown = 0,
    Succeeded = 1,
    Failed = 2,
    Partial = 3,
    Cancelled = 4
}

public enum DataImpact
{
    Unknown = 0,
    Unchanged = 1,
    MaybeChanged = 2,
    Changed = 3
}

public enum MetadataClass
{
    Forbidden = 0,
    Redacted = 1,
    Safe = 2
}

public enum DiagnosticSource
{
    Core = 0,
    Desktop = 1,
    Host = 2,
    UiForwarded = 3
}

/// <summary>Reserved code prefixes. Final numeric business codes are not assigned in P0.</summary>
public static class DiagnosticCodeNamespaces
{
    public const string Inventory = "INV";
    public const string Sales = "SAL";
    public const string Warranty = "WAR";
    public const string Print = "PRN";
    public const string Data = "DAT";
    public const string System = "SYS";
}
