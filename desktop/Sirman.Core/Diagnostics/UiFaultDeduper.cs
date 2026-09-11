namespace Sirman.Core.Diagnostics;

/// <summary>
/// Process-local flood control for UI faults. HTML must not dedup.
/// </summary>
public sealed class UiFaultDeduper
{
    public static readonly TimeSpan Window = TimeSpan.FromSeconds(15);

    readonly TimeProvider _time;
    readonly TimeSpan _window;
    readonly Dictionary<string, DateTimeOffset> _last = new(StringComparer.Ordinal);
    readonly object _gate = new();

    public UiFaultDeduper(TimeProvider? time = null, TimeSpan? window = null)
    {
        _time = time ?? TimeProvider.System;
        _window = window is { Ticks: > 0 } ? window.Value : Window;
    }

    public bool TryAdmit(string? fingerprint)
    {
        var key = string.IsNullOrWhiteSpace(fingerprint) ? "_" : fingerprint.Trim();
        var now = _time.GetUtcNow();
        lock (_gate)
        {
            if (_last.TryGetValue(key, out var prev) && now - prev < _window)
                return false;
            _last[key] = now;
            return true;
        }
    }
}
