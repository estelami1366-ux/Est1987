namespace Sirman.Core.Infrastructure;

public static class SafeError
{
    public static string Json(string error, string userMessage, Exception? ex = null)
    {
        try { System.Diagnostics.Debug.WriteLine($"[sirman] {error}: {ex}"); } catch { /* ignore */ }
        var safe = string.IsNullOrWhiteSpace(userMessage) ? "عملیات انجام نشد" : userMessage;
        return "{\"ok\":false,\"error\":" + System.Text.Json.JsonSerializer.Serialize(error)
            + ",\"message\":" + System.Text.Json.JsonSerializer.Serialize(safe) + "}";
    }
}
