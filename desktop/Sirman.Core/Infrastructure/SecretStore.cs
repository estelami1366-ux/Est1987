using System.Text;

namespace Sirman.Core.Infrastructure;

/// <summary>
/// ذخیرهٔ راز روی فایل محلی AppData — نه در سورس. HTML-only همچنان localStorage دارد.
/// ProtectedData/DPAPI در PHASE 2 وقتی فقط ویندوز هدف است اضافه می‌شود.
/// </summary>
public sealed class SecretStore
{
    private readonly string _dir;

    public SecretStore(string? directory = null)
    {
        _dir = directory ?? Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData),
            "Sirman", "secrets");
    }

    public string Save(string name, string value)
    {
        Directory.CreateDirectory(_dir);
        var safe = SafeName(name);
        if (safe is null) return "{\"ok\":false,\"error\":\"name\",\"message\":\"نام راز نامعتبر است\"}";
        var path = Path.Combine(_dir, safe + ".bin");
        var bytes = Encoding.UTF8.GetBytes(value ?? "");
        File.WriteAllBytes(path, bytes);
        return "{\"ok\":true}";
    }

    public string Load(string name)
    {
        var safe = SafeName(name);
        if (safe is null) return "{\"ok\":false,\"error\":\"name\",\"message\":\"نام راز نامعتبر است\"}";
        var path = Path.Combine(_dir, safe + ".bin");
        if (!File.Exists(path)) return "{\"ok\":true,\"value\":\"\"}";
        var text = Encoding.UTF8.GetString(File.ReadAllBytes(path));
        return "{\"ok\":true,\"value\":" + System.Text.Json.JsonSerializer.Serialize(text) + "}";
    }

    private static string? SafeName(string name)
    {
        name = (name ?? "").Trim();
        if (name.Length == 0 || name.Length > 80) return null;
        if (name.IndexOfAny(Path.GetInvalidFileNameChars()) >= 0) return null;
        if (name.Contains("..", StringComparison.Ordinal)) return null;
        return name;
    }
}
