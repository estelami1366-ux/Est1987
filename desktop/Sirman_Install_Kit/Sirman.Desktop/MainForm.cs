using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

namespace Sirman.Desktop;

public sealed class MainForm : Form
{
    private readonly WebView2 _webView = new();
    private readonly StatusStrip _status = new();
    private readonly ToolStripStatusLabel _statusLabel = new();
    private readonly string[] _args;
    private string? _htmlPath;
    private DesktopSettings _settings;

    public MainForm(string[] args)
    {
        _args = args ?? Array.Empty<string>();
        _settings = AppPaths.LoadSettings();

        Text = "سیرمان — خدمات پس از فروش";
        Width = 1280;
        Height = 800;
        MinimumSize = new Size(960, 600);
        StartPosition = FormStartPosition.CenterScreen;
        RightToLeft = RightToLeft.Yes;
        RightToLeftLayout = true;
        WindowState = FormWindowState.Maximized;

        _webView.Dock = DockStyle.Fill;
        Controls.Add(_webView);

        _statusLabel.Spring = true;
        _statusLabel.TextAlign = ContentAlignment.MiddleRight;
        _status.RightToLeft = RightToLeft.Yes;
        _status.Items.Add(_statusLabel);
        Controls.Add(_status);

        var menu = BuildMenu();
        MainMenuStrip = menu;
        Controls.Add(menu);

        Load += async (_, _) => await InitWebViewAsync();
    }

    private MenuStrip BuildMenu()
    {
        var menu = new MenuStrip { RightToLeft = RightToLeft.Yes };

        var file = new ToolStripMenuItem("پرونده");
        file.DropDownItems.Add(new ToolStripMenuItem("باز کردن مجدد سیرمان", null, async (_, _) => await ReloadHtmlAsync()));
        file.DropDownItems.Add(new ToolStripMenuItem("انتخاب فایل HTML…", null, async (_, _) => await PickHtmlAsync()));
        file.DropDownItems.Add(new ToolStripSeparator());
        file.DropDownItems.Add(new ToolStripMenuItem("باز کردن پوشه برنامه", null, (_, _) => OpenFolder(AppPaths.ExeDir)));
        file.DropDownItems.Add(new ToolStripMenuItem("باز کردن پوشه داده (AppData)", null, (_, _) => OpenFolder(AppPaths.AppDataRoot)));
        file.DropDownItems.Add(new ToolStripSeparator());
        file.DropDownItems.Add(new ToolStripMenuItem("خروج", null, (_, _) => Close()));

        var update = new ToolStripMenuItem("آپدیت");
        update.DropDownItems.Add(new ToolStripMenuItem("اعمال آپدیت در انتظار…", null, async (_, _) => await ApplyPendingUpdateAsync(interactive: true)));
        update.DropDownItems.Add(new ToolStripMenuItem("انتخاب فایل آپدیت (.json)…", null, async (_, _) => await PickAndApplyUpdateAsync()));
        update.DropDownItems.Add(new ToolStripSeparator());
        update.DropDownItems.Add(new ToolStripMenuItem("باز کردن پوشه آپدیت‌ها", null, (_, _) =>
        {
            var d = Path.Combine(AppPaths.ExeDir, "updates");
            Directory.CreateDirectory(d);
            OpenFolder(d);
        }));

        var backup = new ToolStripMenuItem("بک‌آپ");
        backup.DropDownItems.Add(new ToolStripMenuItem("انتخاب پوشه بک‌آپ…", null, (_, _) => ChooseBackupFolder()));
        backup.DropDownItems.Add(new ToolStripMenuItem("باز کردن پوشه بک‌آپ", null, (_, _) => OpenFolder(AppPaths.ResolveBackupFolder(_settings))));
        backup.DropDownItems.Add(new ToolStripSeparator());
        backup.DropDownItems.Add(new ToolStripMenuItem("کپی HTML فعلی در بک‌آپ", null, (_, _) => BackupCurrentHtml()));

        var install = new ToolStripMenuItem("نصب");
        install.DropDownItems.Add(new ToolStripMenuItem("نصب در این کاربر + میانبر Start", null, (_, _) => DoInstall(false)));
        install.DropDownItems.Add(new ToolStripMenuItem("نصب + میانبر Start و دسکتاپ", null, (_, _) => DoInstall(true)));
        install.DropDownItems.Add(new ToolStripMenuItem("باز کردن پوشه نصب", null, (_, _) =>
        {
            Directory.CreateDirectory(InstallService.InstallDir);
            OpenFolder(InstallService.InstallDir);
        }));
        install.DropDownItems.Add(new ToolStripMenuItem("پوشه میانبر Start", null, (_, _) => InstallService.OpenStartMenuFolder()));

        var view = new ToolStripMenuItem("نمایش");
        view.DropDownItems.Add(new ToolStripMenuItem("تازه‌سازی (F5)", null, async (_, _) =>
        {
            if (_webView.CoreWebView2 != null) _webView.CoreWebView2.Reload();
            else await ReloadHtmlAsync();
        }));
        view.DropDownItems.Add(new ToolStripMenuItem("ابزار توسعه‌دهنده", null, (_, _) =>
        {
            _webView.CoreWebView2?.OpenDevToolsWindow();
        }));

        var help = new ToolStripMenuItem("راهنما");
        help.DropDownItems.Add(new ToolStripMenuItem("درباره فاز ۲…", null, (_, _) =>
        {
            MessageBox.Show(
                "سیرمان دسکتاپ — فاز ۲\n\n" +
                "• پوسته WebView2 برای HTML سیرمان\n" +
                "• آپدیت خودکار از Sirman_Pending_Update.json\n" +
                "• پوشه بک‌آپ قابل انتخاب\n" +
                "• نصب محلی + میانبر منوی Start\n\n" +
                "HTML:\n" + (_htmlPath ?? "—") + "\n\n" +
                "بک‌آپ:\n" + AppPaths.ResolveBackupFolder(_settings) + "\n\n" +
                "آخرین آپدیت:\n" + (_settings.LastAppliedUpdateVersion ?? "—"),
                "درباره",
                MessageBoxButtons.OK,
                MessageBoxIcon.Information);
        }));

        menu.Items.Add(file);
        menu.Items.Add(update);
        menu.Items.Add(backup);
        menu.Items.Add(install);
        menu.Items.Add(view);
        menu.Items.Add(help);
        return menu;
    }

    protected override bool ProcessCmdKey(ref Message msg, Keys keyData)
    {
        if (keyData == Keys.F5)
        {
            _webView.CoreWebView2?.Reload();
            return true;
        }
        return base.ProcessCmdKey(ref msg, keyData);
    }

    private async Task InitWebViewAsync()
    {
        SetStatus("در حال راه‌اندازی…");
        try
        {
            // آپدیت در انتظار قبل از بارگذاری صفحه
            var htmlTarget = ResolveHtmlPath() ?? Path.Combine(AppPaths.ExeDir, "Sirman_Final.html");
            var upd = UpdateService.TryApplyPendingOnStartup(htmlTarget);
            if (upd.Applied)
            {
                SetStatus(upd.Message ?? "آپدیت اعمال شد");
                if (!string.IsNullOrWhiteSpace(upd.HtmlPath))
                    RememberHtmlPath(upd.HtmlPath);
                MessageBox.Show(upd.Message + "\n\nصفحه با نسخه جدید باز می‌شود.", "آپدیت", MessageBoxButtons.OK, MessageBoxIcon.Information);
            }

            var userData = Path.Combine(AppPaths.AppDataRoot, "WebView2");
            Directory.CreateDirectory(userData);

            var env = await CoreWebView2Environment.CreateAsync(userDataFolder: userData);
            await _webView.EnsureCoreWebView2Async(env);

            _webView.CoreWebView2!.Settings.AreDefaultContextMenusEnabled = true;
            _webView.CoreWebView2.Settings.AreDevToolsEnabled = true;
            _webView.CoreWebView2.Settings.IsStatusBarEnabled = true;
            _webView.CoreWebView2.DocumentTitleChanged += (_, _) =>
            {
                var t = _webView.CoreWebView2?.DocumentTitle;
                Text = string.IsNullOrWhiteSpace(t) ? "سیرمان" : ("سیرمان — " + t);
            };

            await ReloadHtmlAsync();
            SetStatus("آماده" + (_htmlPath != null ? " — " + Path.GetFileName(_htmlPath) : ""));
        }
        catch (Exception ex)
        {
            SetStatus("خطا در راه‌اندازی");
            MessageBox.Show(
                "راه‌اندازی WebView2 ناموفق بود.\n\n" +
                "روی ویندوز باید WebView2 Runtime نصب باشد (معمولاً با Edge می‌آید).\n\n" +
                ex.Message,
                "سیرمان",
                MessageBoxButtons.OK,
                MessageBoxIcon.Error);
        }
    }

    private async Task ReloadHtmlAsync()
    {
        _htmlPath = ResolveHtmlPath();
        if (_htmlPath == null)
        {
            SetStatus("HTML پیدا نشد");
            MessageBox.Show(
                "فایل Sirman_Final.html پیدا نشد.\n\n" +
                "آن را کنار Sirman.exe بگذارید، یا از منو «انتخاب فایل HTML» را بزنید.\n" +
                "برای آپدیت: Sirman_Pending_Update.json را کنار exe بگذارید.",
                "سیرمان",
                MessageBoxButtons.OK,
                MessageBoxIcon.Warning);
            return;
        }

        if (_webView.CoreWebView2 == null) return;
        // cache-bust سبک برای دیدن آپدیت تازه
        var uri = new Uri(_htmlPath).AbsoluteUri + "?t=" + DateTimeOffset.Now.ToUnixTimeSeconds();
        _webView.CoreWebView2.Navigate(uri);
        SetStatus(Path.GetFileName(_htmlPath));
        await Task.CompletedTask;
    }

    private async Task PickHtmlAsync()
    {
        using var dlg = new OpenFileDialog
        {
            Title = "انتخاب فایل سیرمان",
            Filter = "HTML|*.html;*.htm|همه فایل‌ها|*.*",
            CheckFileExists = true
        };
        if (dlg.ShowDialog(this) != DialogResult.OK) return;
        RememberHtmlPath(dlg.FileName);
        _htmlPath = dlg.FileName;
        if (_webView.CoreWebView2 != null)
            _webView.CoreWebView2.Navigate(new Uri(_htmlPath).AbsoluteUri);
        SetStatus(Path.GetFileName(_htmlPath));
        await Task.CompletedTask;
    }

    private async Task ApplyPendingUpdateAsync(bool interactive)
    {
        var target = _htmlPath ?? ResolveHtmlPath() ?? Path.Combine(AppPaths.ExeDir, "Sirman_Final.html");
        var pkg = UpdateService.FindPendingPackage(AppPaths.ExeDir);
        if (pkg == null)
        {
            if (interactive)
                MessageBox.Show(
                    "آپدیتی در انتظار نیست.\n\n" +
                    "فایل Sirman_Pending_Update.json را کنار Sirman.exe بگذارید\n" +
                    "یا داخل پوشه updates یک Sirman_Update_*.json قرار دهید.",
                    "آپدیت", MessageBoxButtons.OK, MessageBoxIcon.Information);
            return;
        }

        var res = UpdateService.ApplyPackageFile(pkg, target, AppPaths.ResolveBackupFolder(_settings));
        if (!res.Applied)
        {
            MessageBox.Show(res.Message ?? "اعمال نشد.", "آپدیت", MessageBoxButtons.OK, MessageBoxIcon.Warning);
            return;
        }

        _settings = AppPaths.LoadSettings();
        if (!string.IsNullOrWhiteSpace(res.HtmlPath))
        {
            RememberHtmlPath(res.HtmlPath);
            _htmlPath = res.HtmlPath;
        }
        MessageBox.Show(res.Message, "آپدیت", MessageBoxButtons.OK, MessageBoxIcon.Information);
        await ReloadHtmlAsync();
    }

    private async Task PickAndApplyUpdateAsync()
    {
        using var dlg = new OpenFileDialog
        {
            Title = "انتخاب فایل آپدیت سیرمان",
            Filter = "آپدیت سیرمان|*.json;*.sirman-update.json|همه|*.*",
            CheckFileExists = true
        };
        if (dlg.ShowDialog(this) != DialogResult.OK) return;

        var target = _htmlPath ?? ResolveHtmlPath() ?? Path.Combine(AppPaths.ExeDir, "Sirman_Final.html");
        var res = UpdateService.ApplyPackageFile(dlg.FileName, target, AppPaths.ResolveBackupFolder(_settings));
        if (!res.Applied)
        {
            MessageBox.Show(res.Message ?? "اعمال نشد.", "آپدیت", MessageBoxButtons.OK, MessageBoxIcon.Warning);
            return;
        }
        _settings = AppPaths.LoadSettings();
        if (!string.IsNullOrWhiteSpace(res.HtmlPath))
        {
            RememberHtmlPath(res.HtmlPath);
            _htmlPath = res.HtmlPath;
        }
        MessageBox.Show(res.Message, "آپدیت", MessageBoxButtons.OK, MessageBoxIcon.Information);
        await ReloadHtmlAsync();
    }

    private void ChooseBackupFolder()
    {
        using var dlg = new FolderBrowserDialog
        {
            Description = "پوشه بک‌آپ سیرمان را انتخاب کنید",
            UseDescriptionForTitle = true,
            ShowNewFolderButton = true
        };
        var cur = AppPaths.ResolveBackupFolder(_settings);
        if (Directory.Exists(cur)) dlg.SelectedPath = cur;
        if (dlg.ShowDialog(this) != DialogResult.OK) return;
        _settings.BackupFolder = dlg.SelectedPath;
        AppPaths.SaveSettings(_settings);
        SetStatus("پوشه بک‌آپ: " + dlg.SelectedPath);
        MessageBox.Show("پوشه بک‌آپ ذخیره شد:\n" + dlg.SelectedPath, "بک‌آپ", MessageBoxButtons.OK, MessageBoxIcon.Information);
    }

    private void BackupCurrentHtml()
    {
        var src = _htmlPath ?? ResolveHtmlPath();
        if (src == null || !File.Exists(src))
        {
            MessageBox.Show("HTML فعلی پیدا نشد.", "بک‌آپ", MessageBoxButtons.OK, MessageBoxIcon.Warning);
            return;
        }
        try
        {
            var folder = AppPaths.ResolveBackupFolder(_settings);
            Directory.CreateDirectory(folder);
            var dest = Path.Combine(folder, $"Sirman_Final_manual_{DateTime.Now:yyyyMMdd_HHmmss}.html");
            File.Copy(src, dest, overwrite: true);
            MessageBox.Show("کپی شد:\n" + dest, "بک‌آپ", MessageBoxButtons.OK, MessageBoxIcon.Information);
        }
        catch (Exception ex)
        {
            MessageBox.Show(ex.Message, "بک‌آپ", MessageBoxButtons.OK, MessageBoxIcon.Error);
        }
    }

    private void DoInstall(bool desktopShortcut)
    {
        var res = InstallService.InstallCurrentBuild(desktopShortcut);
        MessageBox.Show(res.Message, "نصب", MessageBoxButtons.OK,
            res.Ok ? MessageBoxIcon.Information : MessageBoxIcon.Error);
        if (res.Ok && !string.IsNullOrWhiteSpace(res.ExePath))
            SetStatus("نصب شد: " + res.ExePath);
    }

    private void OpenFolder(string path)
    {
        try
        {
            Directory.CreateDirectory(path);
            System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo
            {
                FileName = path,
                UseShellExecute = true
            });
        }
        catch (Exception ex)
        {
            MessageBox.Show(ex.Message, "سیرمان", MessageBoxButtons.OK, MessageBoxIcon.Error);
        }
    }

    private void RememberHtmlPath(string path)
    {
        try
        {
            File.WriteAllText(Path.Combine(AppPaths.ExeDir, "sirman_html_path.txt"), path);
            _settings.PreferredHtmlPath = path;
            AppPaths.SaveSettings(_settings);
        }
        catch { /* optional */ }
    }

    private void SetStatus(string text) => _statusLabel.Text = text;

    private string? ResolveHtmlPath()
    {
        if (_args.Length > 0 && File.Exists(_args[0]) &&
            _args[0].EndsWith(".html", StringComparison.OrdinalIgnoreCase))
            return Path.GetFullPath(_args[0]);

        if (!string.IsNullOrWhiteSpace(_settings.PreferredHtmlPath) && File.Exists(_settings.PreferredHtmlPath))
            return Path.GetFullPath(_settings.PreferredHtmlPath);

        var remembered = Path.Combine(AppPaths.ExeDir, "sirman_html_path.txt");
        if (File.Exists(remembered))
        {
            try
            {
                var p = File.ReadAllText(remembered).Trim();
                if (File.Exists(p)) return Path.GetFullPath(p);
            }
            catch { /* ignore */ }
        }

        var baseDir = AppPaths.ExeDir;
        var candidates = new[]
        {
            Path.Combine(baseDir, "Sirman_Final.html"),
            Path.Combine(InstallService.InstallDir, "Sirman_Final.html"),
            Path.GetFullPath(Path.Combine(baseDir, "..", "..", "..", "..", "..", "Sirman_Final.html")),
            Path.GetFullPath(Path.Combine(baseDir, "..", "..", "..", "..", "Sirman_Final.html")),
        };

        foreach (var c in candidates)
        {
            try { if (File.Exists(c)) return Path.GetFullPath(c); }
            catch { /* ignore */ }
        }

        try
        {
            var found = Directory.GetFiles(baseDir, "Sirman_Final_*.html")
                .OrderByDescending(f => f)
                .FirstOrDefault();
            if (found != null) return found;
        }
        catch { /* ignore */ }

        return null;
    }
}
