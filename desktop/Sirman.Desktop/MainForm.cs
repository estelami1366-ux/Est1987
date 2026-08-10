using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

namespace Sirman.Desktop;

public sealed class MainForm : Form
{
    private readonly WebView2 _webView = new();
    private readonly string[] _args;
    private string? _htmlPath;

    public MainForm(string[] args)
    {
        _args = args ?? Array.Empty<string>();

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

        var menu = BuildMenu();
        MainMenuStrip = menu;
        Controls.Add(menu);

        Load += async (_, _) => await InitWebViewAsync();
        FormClosing += (_, e) =>
        {
            // صفحه HTML خودش مودال خروج دارد؛ اینجا فقط بستن پنجره است
        };
    }

    private MenuStrip BuildMenu()
    {
        var menu = new MenuStrip
        {
            RightToLeft = RightToLeft.Yes
        };

        var file = new ToolStripMenuItem("پرونده");
        file.DropDownItems.Add(new ToolStripMenuItem("باز کردن مجدد سیرمان", null, async (_, _) => await ReloadHtmlAsync()));
        file.DropDownItems.Add(new ToolStripMenuItem("انتخاب فایل HTML…", null, async (_, _) => await PickHtmlAsync()));
        file.DropDownItems.Add(new ToolStripSeparator());
        file.DropDownItems.Add(new ToolStripMenuItem("باز کردن پوشه برنامه", null, (_, _) => OpenAppFolder()));
        file.DropDownItems.Add(new ToolStripSeparator());
        file.DropDownItems.Add(new ToolStripMenuItem("خروج", null, (_, _) => Close()));

        var view = new ToolStripMenuItem("نمایش");
        view.DropDownItems.Add(new ToolStripMenuItem("تازه‌سازی (F5)", null, async (_, _) =>
        {
            if (_webView.CoreWebView2 != null) _webView.CoreWebView2.Reload();
            else await ReloadHtmlAsync();
        }));
        view.DropDownItems.Add(new ToolStripMenuItem("ابزار توسعه‌دهنده", null, (_, _) =>
        {
            if (_webView.CoreWebView2 != null)
                _webView.CoreWebView2.OpenDevToolsWindow();
        }));

        var help = new ToolStripMenuItem("راهنما");
        help.DropDownItems.Add(new ToolStripMenuItem("درباره فاز ۱…", null, (_, _) =>
        {
            MessageBox.Show(
                "سیرمان دسکتاپ — فاز ۱\n\n" +
                "پوسته ویندوزی با WebView2 که همان فایل HTML سیرمان را باز می‌کند.\n" +
                "منطق برنامه هنوز داخل HTML است.\n\n" +
                "فایل فعلی:\n" + (_htmlPath ?? "—"),
                "درباره",
                MessageBoxButtons.OK,
                MessageBoxIcon.Information);
        }));

        menu.Items.Add(file);
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
        try
        {
            var userData = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                "Sirman", "WebView2");
            Directory.CreateDirectory(userData);

            var env = await CoreWebView2Environment.CreateAsync(userDataFolder: userData);
            await _webView.EnsureCoreWebView2Async(env);

            _webView.CoreWebView2.Settings.AreDefaultContextMenusEnabled = true;
            _webView.CoreWebView2.Settings.AreDevToolsEnabled = true;
            _webView.CoreWebView2.Settings.IsStatusBarEnabled = true;
            _webView.CoreWebView2.DocumentTitleChanged += (_, _) =>
            {
                var t = _webView.CoreWebView2?.DocumentTitle;
                Text = string.IsNullOrWhiteSpace(t) ? "سیرمان" : ("سیرمان — " + t);
            };

            await ReloadHtmlAsync();
        }
        catch (Exception ex)
        {
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
            MessageBox.Show(
                "فایل Sirman_Final.html پیدا نشد.\n\n" +
                "آن را کنار Sirman.exe بگذارید، یا از منو «انتخاب فایل HTML» را بزنید.",
                "سیرمان",
                MessageBoxButtons.OK,
                MessageBoxIcon.Warning);
            return;
        }

        if (_webView.CoreWebView2 == null) return;
        var uri = new Uri(_htmlPath).AbsoluteUri;
        _webView.CoreWebView2.Navigate(uri);
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

        try
        {
            File.WriteAllText(
                Path.Combine(AppContext.BaseDirectory, "sirman_html_path.txt"),
                dlg.FileName);
        }
        catch { /* optional remember */ }

        _htmlPath = dlg.FileName;
        if (_webView.CoreWebView2 != null)
            _webView.CoreWebView2.Navigate(new Uri(_htmlPath).AbsoluteUri);
        await Task.CompletedTask;
    }

    private void OpenAppFolder()
    {
        try
        {
            System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo
            {
                FileName = AppContext.BaseDirectory,
                UseShellExecute = true
            });
        }
        catch (Exception ex)
        {
            MessageBox.Show(ex.Message, "سیرمان", MessageBoxButtons.OK, MessageBoxIcon.Error);
        }
    }

    private string? ResolveHtmlPath()
    {
        // 1) آرگومان خط فرمان
        if (_args.Length > 0 && File.Exists(_args[0]) &&
            _args[0].EndsWith(".html", StringComparison.OrdinalIgnoreCase))
            return Path.GetFullPath(_args[0]);

        // 2) مسیر ذخیره‌شده توسط کاربر
        var remembered = Path.Combine(AppContext.BaseDirectory, "sirman_html_path.txt");
        if (File.Exists(remembered))
        {
            try
            {
                var p = File.ReadAllText(remembered).Trim();
                if (File.Exists(p)) return Path.GetFullPath(p);
            }
            catch { /* ignore */ }
        }

        // 3) کنار exe / خروجی بیلد
        var baseDir = AppContext.BaseDirectory;
        var candidates = new[]
        {
            Path.Combine(baseDir, "Sirman_Final.html"),
            Path.Combine(baseDir, "Sirman_Final_1405.5.18κ.html"),
            // توسعه: ریشه ریپو (از bin/Debug/net8.0-windows به بالا)
            Path.GetFullPath(Path.Combine(baseDir, "..", "..", "..", "..", "..", "Sirman_Final.html")),
            Path.GetFullPath(Path.Combine(baseDir, "..", "..", "..", "..", "Sirman_Final.html")),
        };

        foreach (var c in candidates)
        {
            try
            {
                if (File.Exists(c)) return Path.GetFullPath(c);
            }
            catch { /* ignore */ }
        }

        // 4) هر Sirman_Final_*.html کنار exe
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
