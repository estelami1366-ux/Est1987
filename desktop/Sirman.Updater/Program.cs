using Sirman.Core.Updates;

namespace Sirman.Updater;

static class Program
{
    static int Main(string[] args)
    {
        try
        {
            return Run(args);
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine(ex.Message);
            return 1;
        }
    }

    static int Run(string[] args)
    {
        var map = Parse(args);
        if (map.ContainsKey("help") || map.ContainsKey("h"))
        {
            PrintUsage();
            return 0;
        }

        var dataRoot = Get(map, "data-root") ?? NativeUpdatePaths.DefaultDataRoot;
        var install = Get(map, "install") ?? NativeUpdatePaths.DefaultInstallDirectory;

        if (map.ContainsKey("recover-only"))
        {
            var recovered = NativeUpdateApplier.Recover(dataRoot, install);
            PrintResult(recovered);
            return recovered.Ok ? 0 : 1;
        }

        var package = Get(map, "package");
        if (string.IsNullOrWhiteSpace(package))
        {
            Console.Error.WriteLine("آرگومان --package لازم است.");
            PrintUsage();
            return 1;
        }

        var result = NativeUpdateApplier.Apply(new NativeUpdateApplyRequest
        {
            PackageDirectory = package,
            InstallDirectory = install,
            DataRoot = dataRoot,
            LaunchAfter = !map.ContainsKey("no-launch"),
            AllowDowngrade = map.ContainsKey("allow-downgrade"),
            Processes = new DefaultNativeProcessCoordinator(),
            Launcher = new DefaultNativeAppLauncher()
        });
        PrintResult(result);
        return result.Ok ? 0 : 1;
    }

    static Dictionary<string, string> Parse(string[] args)
    {
        var map = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        for (var i = 0; i < args.Length; i++)
        {
            var raw = args[i];
            if (!raw.StartsWith("--", StringComparison.Ordinal) && !raw.StartsWith("-", StringComparison.Ordinal))
                continue;
            var token = raw.TrimStart('-');
            if (token.Contains('='))
            {
                var parts = token.Split('=', 2);
                map[parts[0]] = parts[1];
                continue;
            }
            if (i + 1 < args.Length && !args[i + 1].StartsWith("-", StringComparison.Ordinal))
            {
                map[token] = args[++i];
                continue;
            }
            map[token] = "true";
        }
        return map;
    }

    static string? Get(Dictionary<string, string> map, string key) =>
        map.TryGetValue(key, out var value) ? value : null;

    static void PrintResult(NativeUpdateApplyResult result)
    {
        Console.WriteLine("ok=" + (result.Ok ? "true" : "false"));
        Console.WriteLine("state=" + result.State);
        if (!string.IsNullOrWhiteSpace(result.Error))
            Console.WriteLine("error=" + result.Error);
        if (!string.IsNullOrWhiteSpace(result.Message))
            Console.WriteLine("message=" + result.Message);
        if (!string.IsNullOrWhiteSpace(result.JournalPath))
            Console.WriteLine("journal=" + result.JournalPath);
        if (!string.IsNullOrWhiteSpace(result.BackupDirectory))
            Console.WriteLine("backup=" + result.BackupDirectory);
    }

    static void PrintUsage()
    {
        Console.WriteLine("SirmanUpdater — native-only apply (no HTML)");
        Console.WriteLine("  --package <dir>         SIRMAN_NATIVE_UPDATE package directory");
        Console.WriteLine("  --install <dir>         install/App directory (default %LocalAppData%\\Sirman\\App)");
        Console.WriteLine("  --data-root <dir>       journal/staging/backup root (default %LocalAppData%\\Sirman)");
        Console.WriteLine("  --no-launch             do not start Sirman.exe after VERIFIED");
        Console.WriteLine("  --recover-only          restore from journal without applying a package");
        Console.WriteLine("  --allow-downgrade       allow a lower assembly than the install");
    }
}
