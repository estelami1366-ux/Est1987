using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;
using System.Runtime.InteropServices;
using Sirman.Core.Printing;

namespace Sirman.Desktop;

public sealed class MainForm : Form
{
    private const int DwmwaUseImmersiveDarkMode = 20;
    private const int DwmwaBorderColor = 34;
    private const int DwmwaCaptionColor = 35;
    private const int DwmwaTextColor = 36;
    private const int DwmwaSystemBackdropType = 38;
    private const int DwmsbtMainWindow = 2; // Mica در ویندوز 11

    [DllImport("dwmapi.dll", PreserveSig = true)]
    private static extern int DwmSetWindowAttribute(IntPtr hwnd, int attribute, ref int value, int size);

    private readonly WebView2 _webView = new();
    private readonly StatusStrip _status = new();
    private readonly ToolStripStatusLabel _statusLabel = new();
    private readonly NotifyBridgeService _notify = new();
    private readonly string[] _args;
    private string? _htmlPath;
    private DesktopSettings _settings;
    private bool _allowClose;
    private bool _closePromptOpen;
    private SirmanHostObject? _hostObject;
    private readonly IPrintService _printHost;
    private readonly PrintHardwareDiagnostic _printDiag;

    public MainForm(string[] args)
    {
        _args = args ?? Array.Empty<string>();
        _settings = AppPaths.LoadSettings();
        _printHost = new PrintServiceAdapter(new WindowsPrintHost(this));
        _printDiag = new PrintHardwareDiagnostic(this);

        Text = "سیرمان — خدمات پس از فروش";
        Width = 1280;
        Height = 800;
        MinimumSize = new Size(960, 600);
        StartPosition = FormStartPosition.CenterScreen;
        RightToLeft = RightToLeft.Yes;
        RightToLeftLayout = true;
        WindowState = FormWindowState.Maximized;
        Font = new Font("Segoe UI", 10.5f, FontStyle.Regular, GraphicsUnit.Point);
        BackColor = Color.FromArgb(246, 249, 252);
        ForeColor = Color.FromArgb(25, 45, 64);
        Padding = new Padding(1);
        DoubleBuffered = true;
        HandleCreated += (_, _) => ApplyModernWindowChrome();

        _webView.Dock = DockStyle.Fill;
        Controls.Add(_webView);

        _statusLabel.Spring = true;
        _statusLabel.TextAlign = ContentAlignment.MiddleRight;
        _status.RightToLeft = RightToLeft.Yes;
        _status.Items.Add(_statusLabel);
        Controls.Add(_status);

        var menu = BuildMenu();
        menu.Font = new Font("Segoe UI", 10.5f, FontStyle.Regular, GraphicsUnit.Point);
        menu.BackColor = Color.FromArgb(18, 74, 104);
        menu.ForeColor = Color.White;
        menu.Renderer = new ToolStripProfessionalRenderer(new ModernColorTable());
        menu.Padding = new Padding(10, 4, 10, 4);
        MainMenuStrip = menu;
        Controls.Add(menu);

        Load += async (_, _) => await InitWebViewAsync();
        FormClosed += (_, _) => _notify.Dispose();
    }

    /// <summary>
    /// ظاهر بومی مدرن: Mica در ویندوز 11 و نوار عنوان رنگی/خوانا در ویندوز 10.
    /// DWM در نسخه‌های قدیمی‌تر ویژگی ناشناخته را نادیده می‌گیرد.
    /// </summary>
    private void ApplyModernWindowChrome()
    {
        try
        {
            // ویندوز 10 نسخه 1903 به بعد: رنگ واقعی title bar / border
            // برخلاف Mica، این ظاهر در ویندوز 10 هم واضح و قابل مشاهده است.
            if (OperatingSystem.IsWindowsVersionAtLeast(10, 0, 18362))
            {
                var caption = ColorTranslator.ToWin32(Color.FromArgb(18, 92, 128));
                var border = ColorTranslator.ToWin32(Color.FromArgb(31, 128, 167));
                var text = ColorTranslator.ToWin32(Color.White);
                _ = DwmSetWindowAttribute(Handle, DwmwaCaptionColor, ref caption, sizeof(int));
                _ = DwmSetWindowAttribute(Handle, DwmwaBorderColor, ref border, sizeof(int));
                _ = DwmSetWindowAttribute(Handle, DwmwaTextColor, ref text, sizeof(int));
            }

            // ویندوز 11: لایهٔ Mica علاوه بر رنگ‌های پایه
            if (OperatingSystem.IsWindowsVersionAtLeast(10, 0, 22000))
            {
                var backdrop = DwmsbtMainWindow;
                _ = DwmSetWindowAttribute(Handle, DwmwaSystemBackdropType, ref backdrop, sizeof(int));
            }
            var darkTitle = 0;
            _ = DwmSetWindowAttribute(Handle, DwmwaUseImmersiveDarkMode, ref darkTitle, sizeof(int));
        }
        catch { /* ظاهر استاندارد ویندوز ادامه دارد */ }
    }

    public void ApplyUiSkinChrome(string? key)
    {
        if (!IsHandleCreated) return;
        try
        {
            var chrome = UiSkinPack.For(key);
            if (OperatingSystem.IsWindowsVersionAtLeast(10, 0, 18362))
            {
                var caption = ColorTranslator.ToWin32(Color.FromArgb(chrome.CaptionArgb));
                var border = ColorTranslator.ToWin32(Color.FromArgb(chrome.BorderArgb));
                var text = ColorTranslator.ToWin32(Color.FromArgb(chrome.TextArgb));
                _ = DwmSetWindowAttribute(Handle, DwmwaCaptionColor, ref caption, sizeof(int));
                _ = DwmSetWindowAttribute(Handle, DwmwaBorderColor, ref border, sizeof(int));
                _ = DwmSetWindowAttribute(Handle, DwmwaTextColor, ref text, sizeof(int));
            }
            if (chrome.PreferMica && OperatingSystem.IsWindowsVersionAtLeast(10, 0, 22000))
            {
                var backdrop = DwmsbtMainWindow;
                _ = DwmSetWindowAttribute(Handle, DwmwaSystemBackdropType, ref backdrop, sizeof(int));
            }
            var darkTitle = chrome.DarkTitle ? 1 : 0;
            _ = DwmSetWindowAttribute(Handle, DwmwaUseImmersiveDarkMode, ref darkTitle, sizeof(int));
            var cap = Color.FromArgb(chrome.CaptionArgb);
            if (MainMenuStrip != null)
            {
                MainMenuStrip.BackColor = cap;
                MainMenuStrip.ForeColor = Color.FromArgb(chrome.TextArgb);
            }
        }
        catch { /* نوار استاندارد می‌ماند */ }
    }

    private sealed class ModernColorTable : ProfessionalColorTable
    {
        public override Color MenuStripGradientBegin => Color.FromArgb(22, 92, 128);
        public override Color MenuStripGradientEnd => Color.FromArgb(14, 66, 96);
        public override Color ToolStripDropDownBackground => Color.FromArgb(249, 252, 255);
        public override Color ImageMarginGradientBegin => Color.FromArgb(239, 246, 252);
        public override Color ImageMarginGradientMiddle => Color.FromArgb(239, 246, 252);
        public override Color ImageMarginGradientEnd => Color.FromArgb(239, 246, 252);
        public override Color MenuItemSelected => Color.FromArgb(207, 232, 246);
        public override Color MenuItemSelectedGradientBegin => Color.FromArgb(207, 232, 246);
        public override Color MenuItemSelectedGradientEnd => Color.FromArgb(182, 219, 239);
        public override Color MenuItemBorder => Color.FromArgb(74, 151, 191);
    }

    protected override void OnFormClosing(FormClosingEventArgs e)
    {
        // بستن تأییدشده / خاموشی سیستم
        if (_allowClose || e.CloseReason is CloseReason.WindowsShutDown or CloseReason.TaskManagerClosing)
        {
            try { _notify.HideTray(); } catch { /* ignore */ }
            base.OnFormClosing(e);
            return;
        }

        // اگر همین الان دیالوگ باز است، بستن تکراری را قطع کن
        if (_closePromptOpen)
        {
            e.Cancel = true;
            return;
        }

        // بدون پرسش
        if (!_settings.AskBackupOnClose)
        {
            _allowClose = true;
            try { _notify.HideTray(); } catch { /* ignore */ }
            base.OnFormClosing(e);
            return;
        }

        // الگوی استاندارد WinForms:
        // FormClosing را Cancel کن، بعد از برگشت از رویداد دیالوگ را نشان بده، سپس Close قطعی.
        e.Cancel = true;
        _closePromptOpen = true;
        BeginInvoke(new Action(ShowExitPromptThenClose));
    }

    private void ShowExitPromptThenClose()
    {
        try
        {
            var ans = MessageBox.Show(
                this,
                "قبل از بستن، بک‌آپ گرفته شود؟\n\n" +
                "Yes / بله = بک‌آپ و بستن\n" +
                "No / خیر = بستن بدون بک‌آپ\n" +
                "Cancel / انصراف = بسته نشود",
                "خروج از سیرمان",
                MessageBoxButtons.YesNoCancel,
                MessageBoxIcon.Question,
                MessageBoxDefaultButton.Button1);

            if (ans == DialogResult.Cancel)
            {
                _closePromptOpen = false;
                return;
            }

            if (ans == DialogResult.Yes)
            {
                SetStatus("در حال بک‌آپ قبل از خروج…");
                try { TryQuickBackupBeforeClose(); }
                catch (Exception ex)
                {
                    var cont = MessageBox.Show(
                        this,
                        "بک‌آپ کامل نشد:\n" + ex.Message + "\n\nباز هم بسته شود؟",
                        "بک‌آپ",
                        MessageBoxButtons.YesNo,
                        MessageBoxIcon.Warning);
                    if (cont != DialogResult.Yes)
                    {
                        _closePromptOpen = false;
                        return;
                    }
                }
            }

            RequestForceClose();
        }
        catch
        {
            RequestForceClose();
        }
    }

    /// <summary>بک‌آپ سریع — بدون Wait روی UI (Wait باعث deadlock با WebView2 می‌شود).</summary>
    private void TryQuickBackupBeforeClose()
    {
        try { BackupCurrentHtmlSilent(); } catch { /* ignore */ }
        try
        {
            if (_webView.CoreWebView2 == null) return;
            const string js = """
                (function(){
                  try{
                    if(typeof clearDirty==='function') clearDirty();
                    if(typeof _buildFullBackupData==='function'){
                      localStorage.setItem('laegh_autosave_snapshot', JSON.stringify(_buildFullBackupData()));
                      localStorage.setItem('laegh_exit_backup_at', new Date().toISOString());
                    }
                  }catch(e){}
                  return 'ok';
                })()
                """;
            // Fire-and-forget: هرگز .Wait/.Result روی UI thread نزن
            _ = _webView.CoreWebView2.ExecuteScriptAsync(js);
            Thread.Sleep(250);
        }
        catch { /* ignore — بستن مهم‌تر است */ }
    }

    public void RequestNotify(string? title, string? body)
    {
        void Go() => _notify.ShowToast(title, body);
        if (InvokeRequired) BeginInvoke(Go);
        else Go();
    }

    public int GetNotifyBridgePort() => _notify.Port;

    public string ListPrintersJson() => _printHost.ListPrintersJson();
    public string GetPrintJobJson(string printJobId) => _printHost.GetJobJson(printJobId);
    public string EnqueueHtmlPrint(string html, string printerName, string paper, string orientation, int copies, string documentId, string documentType, string user, string purpose = "print")
    {
        PrintPhase0Observer.Observe("ENQUEUE_CALL",
            "purpose=" + purpose
            + " printer=" + printerName
            + " documentId=" + documentId
            + " documentType=" + documentType
            + " copies=" + copies
            + " htmlChars=" + (html ?? "").Length);
        var json = _printHost.Enqueue(html, printerName, paper, orientation, copies, documentId, documentType, user, purpose);
        PrintPhase0Observer.Observe("ENQUEUE_RETURN", json);
        return json;
    }

    public string EnqueueNativePrint(string documentJson, string printerName, string paper, string orientation, int copies, string documentId, string documentType, string user, string purpose = "print")
    {
        PrintPhase0Observer.Observe("ENQUEUE_NATIVE",
            "purpose=" + purpose
            + " printer=" + printerName
            + " documentId=" + documentId
            + " documentType=" + documentType
            + " copies=" + copies
            + " jsonChars=" + (documentJson ?? "").Length);
        var json = _printHost.EnqueueNative(documentJson, printerName, paper, orientation, copies, documentId, documentType, user, purpose);
        PrintPhase0Observer.Observe("ENQUEUE_NATIVE_RETURN", json);
        return json;
    }
    public string RunPrintHardwareDiagnostic(string json) => _printDiag.Run(json);

    /// <summary>
    /// بستن قطعی پروسه. Close()/Dispose وب‌ویو گاهی hang می‌کند —
    /// بعد از مخفی‌کردن tray مستقیم Environment.Exit.
    /// </summary>
    public void RequestForceClose()
    {
        void Go()
        {
            _allowClose = true;
            _closePromptOpen = false;
            try { _notify.HideTray(); } catch { /* ignore */ }
            try { _notify.Dispose(); } catch { /* ignore */ }
            try
            {
                if (!IsDisposed)
                {
                    Visible = false;
                    ShowInTaskbar = false;
                }
            }
            catch { /* ignore */ }
            try
            {
                if (_webView.CoreWebView2 != null)
                    _webView.CoreWebView2.Stop();
            }
            catch { /* ignore */ }

            // اول Exit سخت — Close ممکن است روی Dispose وب‌ویو گیر کند
            try { Environment.Exit(0); } catch { /* ignore */ }
            try { Application.Exit(); } catch { /* ignore */ }
            try { Close(); } catch { /* ignore */ }
        }

        if (IsDisposed)
        {
            try { Environment.Exit(0); } catch { /* ignore */ }
            return;
        }
        if (InvokeRequired) BeginInvoke(Go);
        else Go();
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
        var lockItem = new ToolStripMenuItem("قفل برنامه", null, async (_, _) => await LockAppFromUiAsync())
        {
            ShortcutKeys = Keys.Control | Keys.Shift | Keys.L,
            ShortcutKeyDisplayString = "Ctrl+Shift+L"
        };
        file.DropDownItems.Add(lockItem);
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
        backup.DropDownItems.Add(new ToolStripSeparator());
        var askBackup = new ToolStripMenuItem("هنگام بستن درباره بک‌آپ بپرس") { Checked = _settings.AskBackupOnClose, CheckOnClick = true };
        askBackup.CheckedChanged += (_, _) =>
        {
            _settings.AskBackupOnClose = askBackup.Checked;
            AppPaths.SaveSettings(_settings);
        };
        backup.DropDownItems.Add(askBackup);

        var install = new ToolStripMenuItem("نصب");
        install.DropDownItems.Add(new ToolStripMenuItem("نصب پکیج… (انتخاب مسیر + میانبر Start)", null, (_, _) => DoInstall(false)));
        install.DropDownItems.Add(new ToolStripMenuItem("نصب پکیج… (مسیر + Start و دسکتاپ)", null, (_, _) => DoInstall(true)));
        install.DropDownItems.Add(new ToolStripMenuItem("فقط ساخت میانبر Start", null, (_, _) => DoShortcutsOnly(false)));
        install.DropDownItems.Add(new ToolStripMenuItem("فقط ساخت میانبر Start و دسکتاپ", null, (_, _) => DoShortcutsOnly(true)));
        install.DropDownItems.Add(new ToolStripSeparator());
        install.DropDownItems.Add(new ToolStripMenuItem("حذف سالم برنامه (Uninstall)…", null, (_, _) => DoUninstall()));
        install.DropDownItems.Add(new ToolStripMenuItem("پاک‌سازی کامل داده (Full Cleanup)…", null, (_, _) => DoFullCleanup()));
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

        var printMenu = new ToolStripMenuItem("چاپ");
        printMenu.DropDownItems.Add(new ToolStripMenuItem("تشخیص سخت‌افزار چاپ…", null, (_, _) => OpenPrintHardwareDiagnosticUi()));
        printMenu.DropDownItems.Add(new ToolStripMenuItem("باز کردن پوشه لاگ چاپ", null, (_, _) =>
        {
            var d = Path.Combine(AppPaths.AppDataRoot, "print");
            Directory.CreateDirectory(d);
            OpenFolder(d);
        }));

        var help = new ToolStripMenuItem("راهنما");
        help.DropDownItems.Add(new ToolStripMenuItem("آزمایش اعلان ویندوز", null, (_, _) =>
        {
            _notify.ShowToast("✅ اعلان سیرمان", "پل اعلان دسکتاپ فعال است. این یک پیام آزمایشی است.");
            SetStatus(_notify.IsRunning
                ? "اعلان آزمایشی ارسال شد (پل :8766 روشن)"
                : "اعلان آزمایشی ارسال شد (Toast مستقیم)");
        }));
        help.DropDownItems.Add(new ToolStripMenuItem("درباره فاز ۲…", null, (_, _) =>
        {
            MessageBox.Show(
                "سیرمان دسکتاپ — فاز ۲ (+ اعلان)\n\n" +
                "• پوسته WebView2 برای HTML سیرمان\n" +
                "• آپدیت خودکار از Sirman_Pending_Update.json\n" +
                "• پوشه بک‌آپ قابل انتخاب\n" +
                "• نصب محلی + میانبر منوی Start\n" +
                "• حذف سالم سطح ۱ (Uninstall-Sirman.bat — برنامه، نه داده)\n" +
                "• پاک‌سازی کامل سطح ۲ (SIRMAN Full Cleanup — type CONFIRM)\n" +
                "• پل اعلان مرکز اعلان ویندوز (پورت ۸۷۶۶)\n\n" +
                "HTML:\n" + (_htmlPath ?? "—") + "\n\n" +
                "بک‌آپ:\n" + AppPaths.ResolveBackupFolder(_settings) + "\n\n" +
                "آخرین آپدیت:\n" + (_settings.LastAppliedUpdateVersion ?? "—") + "\n\n" +
                "پل اعلان: " + (_notify.IsRunning ? "روشن روی :" + _notify.Port : "Toast مستقیم / پورت اشغال"),
                "درباره",
                MessageBoxButtons.OK,
                MessageBoxIcon.Information);
        }));

        menu.Items.Add(file);
        menu.Items.Add(update);
        menu.Items.Add(backup);
        menu.Items.Add(printMenu);
        menu.Items.Add(install);
        menu.Items.Add(view);
        menu.Items.Add(help);
        return menu;
    }

    private void OpenPrintHardwareDiagnosticUi()
    {
        try
        {
            if (_webView.CoreWebView2 == null) return;
            _ = _webView.CoreWebView2.ExecuteScriptAsync(
                "try{ if(typeof showPage==='function') showPage('settings'); " +
                "var tab=Array.prototype.slice.call(document.querySelectorAll('.stg-tab')).find(function(t){ return (t.textContent||'').indexOf('تشخیص چاپگر')>=0; }); " +
                "if(typeof showStgTab==='function') showStgTab('print-diag', tab); " +
                "if(typeof phdRefresh==='function') phdRefresh(); }catch(e){}");
        }
        catch { /* HTML still has the settings tab */ }
    }

    protected override bool ProcessCmdKey(ref Message msg, Keys keyData)
    {
        if (keyData == Keys.F5)
        {
            _webView.CoreWebView2?.Reload();
            return true;
        }
        if (keyData == (Keys.Control | Keys.Shift | Keys.L))
        {
            _ = LockAppFromUiAsync();
            return true;
        }
        return base.ProcessCmdKey(ref msg, keyData);
    }

    private async Task LockAppFromUiAsync()
    {
        try
        {
            if (_webView.CoreWebView2 == null) return;
            await _webView.CoreWebView2.ExecuteScriptAsync(
                "try{ if(typeof lockApp==='function') lockApp(); }catch(e){}");
        }
        catch
        {
            /* HTML-only lock still works from the page shortcut */
        }
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

            // هر بار کنار exe، اسکریپت حذف سالم + میانبر Start را تازه کن
            try { InstallService.WriteUninstallArtifacts(AppPaths.ExeDir); } catch { /* ignore */ }

            // پل اعلان محلی (همان ۸۷۶۶ که HTML به آن fetch می‌زند)
            var bridgeOk = _notify.Start(NotifyBridgeService.DefaultPort);

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
            _hostObject = new SirmanHostObject(this);
            try
            {
                _webView.CoreWebView2.AddHostObjectToScript("sirmanHost", _hostObject);
            }
            catch { /* برخی محیط‌ها host object را محدود می‌کنند — postMessage باقی است */ }
            _webView.CoreWebView2.WebMessageReceived += OnWebMessageReceived;
            _webView.CoreWebView2.NavigationCompleted += async (_, e) =>
            {
                if (!e.IsSuccess) return;
                try { await InjectDesktopHostBridgeAsync(); } catch { /* ignore */ }
            };

            await ReloadHtmlAsync();
            var notifyHint = bridgeOk ? " — اعلان:8766" : " — اعلان:مستقیم";
            SetStatus("آماده" + (_htmlPath != null ? " — " + Path.GetFileName(_htmlPath) : "") + notifyHint);
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
        var intro = MessageBox.Show(
            this,
            "نصب پکیج سیرمان\n\n" +
            "در مرحله بعد پوشه نصب را خودتان انتخاب می‌کنید.\n" +
            "برنامه کنار این فایل‌ها نصب نمی‌شود — فقط در مسیر انتخابی شما کپی می‌گردد.\n\n" +
            "ادامه؟",
            "نصب سیرمان",
            MessageBoxButtons.OKCancel,
            MessageBoxIcon.Information);
        if (intro != DialogResult.OK) return;

        var res = InstallService.InstallCurrentBuild(desktopShortcut, targetDir: null, owner: this);
        MessageBox.Show(res.Message, "نصب", MessageBoxButtons.OK,
            res.Ok ? MessageBoxIcon.Information : MessageBoxIcon.Warning);
        if (res.Ok && !string.IsNullOrWhiteSpace(res.ExePath))
            SetStatus("نصب شد: " + res.ExePath);
    }

    private void DoShortcutsOnly(bool desktop)
    {
        var res = InstallService.CreateShortcutsOnly(desktop);
        MessageBox.Show(res.Message, "میانبر", MessageBoxButtons.OK,
            res.Ok ? MessageBoxIcon.Information : MessageBoxIcon.Error);
        if (res.Ok) SetStatus("میانبر ساخته شد");
    }

    private void DoUninstall()
    {
        var ask = MessageBox.Show(
            this,
            "پنجره حذف سالم سیرمان باز شود؟\n\n" +
            "برنامه فعلی بسته می‌شود و اسکریپت Uninstall اجرا می‌گردد.",
            "حذف سیرمان",
            MessageBoxButtons.YesNo,
            MessageBoxIcon.Warning,
            MessageBoxDefaultButton.Button2);
        if (ask != DialogResult.Yes) return;

        try { InstallService.WriteUninstallArtifacts(AppPaths.ExeDir); } catch { /* ignore */ }
        var res = InstallService.LaunchUninstall();
        if (!res.Ok)
        {
            MessageBox.Show(res.Message, "حذف", MessageBoxButtons.OK, MessageBoxIcon.Error);
            return;
        }
        // اجازه بده uninstall بات taskkill کند
        RequestForceClose();
    }

    private void DoFullCleanup()
    {
        var ask = MessageBox.Show(
            this,
            "پنجره پاک‌سازی کامل (سطح ۲) باز شود؟\n\n" +
            "این حذف عادی نیست. داده کسب‌وکار فقط بعد از تایپ CONFIRM پاک می‌شود.\n" +
            "اگر انصراف بدهید هیچ فایلی حذف نمی‌شود.",
            "پاک‌سازی کامل سیرمان",
            MessageBoxButtons.YesNo,
            MessageBoxIcon.Warning,
            MessageBoxDefaultButton.Button2);
        if (ask != DialogResult.Yes) return;

        try { InstallService.WriteUninstallArtifacts(AppPaths.ExeDir); } catch { /* ignore */ }
        var res = InstallService.LaunchFullCleanup();
        if (!res.Ok)
        {
            MessageBox.Show(res.Message, "پاک‌سازی کامل", MessageBoxButtons.OK, MessageBoxIcon.Error);
        }
    }

    private async Task RunHtmlBackupBeforeExitAsync()
    {
        // بک‌آپ سریع و بدون دیالوگ دانلود (exportData ممکن است بستن را قفل کند)
        if (_webView.CoreWebView2 != null)
        {
            const string js = """
                (async function(){
                  try{
                    if(typeof doAutoSave==='function'){
                      try{ await doAutoSave(true); }catch(_e){}
                    }
                    try{
                      if(typeof _buildFullBackupData==='function'){
                        var data = _buildFullBackupData();
                        localStorage.setItem('laegh_autosave_snapshot', JSON.stringify(data));
                        localStorage.setItem('laegh_exit_backup_at', new Date().toISOString());
                      }
                    }catch(_e2){}
                    if(typeof clearDirty==='function') clearDirty();
                    return 'ok';
                  }catch(e){ return 'err:'+String(e && e.message ? e.message : e); }
                })()
                """;
            var op = _webView.CoreWebView2.ExecuteScriptAsync(js);
            var finished = await Task.WhenAny(op, Task.Delay(7000)).ConfigureAwait(false);
            if (finished == op)
            {
                var raw = await op.ConfigureAwait(false);
                if (!string.IsNullOrWhiteSpace(raw) && raw.Contains("err:", StringComparison.Ordinal))
                    throw new InvalidOperationException(raw.Trim('"'));
            }
        }

        BackupCurrentHtmlSilent();
    }

    private void BackupCurrentHtmlSilent()
    {
        var src = _htmlPath ?? ResolveHtmlPath();
        if (src == null || !File.Exists(src)) return;
        var folder = AppPaths.ResolveBackupFolder(_settings);
        Directory.CreateDirectory(folder);
        var dest = Path.Combine(folder, $"Sirman_Final_exit_{DateTime.Now:yyyyMMdd_HHmmss}.html");
        File.Copy(src, dest, overwrite: true);
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

    private void OnWebMessageReceived(object? sender, CoreWebView2WebMessageReceivedEventArgs e)
    {
        try
        {
            string? raw = null;
            try { raw = e.TryGetWebMessageAsString(); } catch { /* ignore */ }
            if (string.IsNullOrWhiteSpace(raw))
            {
                try { raw = e.WebMessageAsJson; } catch { /* ignore */ }
            }
            if (string.IsNullOrWhiteSpace(raw)) return;

            raw = raw.Trim();
            // اگر کل پیام یک رشتهٔ JSON اینکودشده باشد
            if (raw.Length >= 2 && raw[0] == '"')
            {
                try { raw = System.Text.Json.JsonSerializer.Deserialize<string>(raw) ?? raw; } catch { /* ignore */ }
            }

            using var doc = System.Text.Json.JsonDocument.Parse(raw);
            var root = doc.RootElement;
            var type = root.TryGetProperty("type", out var t) ? t.GetString() : null;
            if (string.Equals(type, "notify", StringComparison.OrdinalIgnoreCase) ||
                string.Equals(type, "toast", StringComparison.OrdinalIgnoreCase))
            {
                var title = root.TryGetProperty("title", out var ti) ? ti.GetString() : "سیرمان";
                var body = root.TryGetProperty("body", out var b) ? b.GetString() : "";
                _notify.ShowToast(title, body);
            }
            else if (string.Equals(type, "notify-enable", StringComparison.OrdinalIgnoreCase) ||
                     string.Equals(type, "ping", StringComparison.OrdinalIgnoreCase))
            {
                _notify.ShowToast("✅ اعلان دسکتاپ سیرمان", "پل میزبان فعال است.");
            }
            else if (string.Equals(type, "host-close", StringComparison.OrdinalIgnoreCase) ||
                     string.Equals(type, "exit", StringComparison.OrdinalIgnoreCase) ||
                     string.Equals(type, "close", StringComparison.OrdinalIgnoreCase))
            {
                // HTML کار خروج/بک‌آپ را تمام کرده — پنجره را بدون پرسش دوباره ببند
                RequestForceClose();
            }
        }
        catch
        {
            // پیام نامعتبر را نادیده بگیر
        }
    }

    private async Task InjectDesktopHostBridgeAsync()
    {
        if (_webView.CoreWebView2 == null) return;
        const string script = """
            (function(){
              try{
                window.SIRMAN_DESKTOP_HOST = true;
                window.SIRMAN_HOST_CLOSE = true;
                function _sirmanHost(){
                  try{
                    return window.chrome && chrome.webview && chrome.webview.hostObjects && chrome.webview.hostObjects.sync && chrome.webview.hostObjects.sync.sirmanHost;
                  }catch(_e){ return null; }
                }
                window.sirmanDesktopNotify = function(title, opts){
                  opts = opts || {};
                  try{
                    var h = _sirmanHost();
                    if(h && h.Notify){ h.Notify(String(title || 'سیرمان'), String((opts && opts.body) || '')); return true; }
                  }catch(_n){}
                  try{
                    if(window.chrome && window.chrome.webview && window.chrome.webview.postMessage){
                      window.chrome.webview.postMessage(JSON.stringify({
                        type: 'notify',
                        title: String(title || 'سیرمان'),
                        body: String((opts && opts.body) || ''),
                        tag: String((opts && opts.tag) || '')
                      }));
                      return true;
                    }
                  }catch(_e){}
                  return false;
                };
                try{ localStorage.setItem('laegh_desktop_host','1'); }catch(_e2){}
                try{ localStorage.setItem('laegh_desktop_notify_on','1'); }catch(_e3){}
                window.sirmanRequestHostClose = function(){
                  try{
                    var h = _sirmanHost();
                    if(h && h.CloseApp){ h.CloseApp(); return true; }
                  }catch(_h){}
                  try{
                    if(window.chrome && window.chrome.webview && window.chrome.webview.postMessage){
                      window.chrome.webview.postMessage(JSON.stringify({type:'host-close'}));
                      setTimeout(function(){
                        try{ window.chrome.webview.postMessage(JSON.stringify({type:'host-close'})); }catch(_e2){}
                      }, 120);
                      return true;
                    }
                  }catch(_c){}
                  return false;
                };
                try{
                  if(typeof autoEnableDesktopNotifyOnBoot==='function') autoEnableDesktopNotifyOnBoot();
                }catch(_e4){}
                try{
                  var hSkin = _sirmanHost();
                  if(hSkin){
                    if(hSkin.GetWarrantyBrowseCss){
                      var css = String(hSkin.GetWarrantyBrowseCss() || '');
                      var st = document.getElementById('war-browse-skin-css');
                      if(!st){ st=document.createElement('style'); st.id='war-browse-skin-css'; document.head.appendChild(st); }
                      if(css) st.textContent = css;
                      window.SIRMAN_WARRANTY_BROWSE_FROM_DOTNET = true;
                    }
                    if(hSkin.GetWarrantyBrowseCatalog){
                      var cat = String(hSkin.GetWarrantyBrowseCatalog() || '');
                      if(cat){
                        try{ window.SIRMAN_WARRANTY_BROWSE_CATALOG = JSON.parse(cat); }
                        catch(_pj){ window.SIRMAN_WARRANTY_BROWSE_CATALOG = cat; }
                      }
                    }
                    if(typeof applyWarBrowseSkinFromHost==='function') applyWarBrowseSkinFromHost();
                  }
                }catch(_skin){}
                try{
                  var x=document.getElementById('sirman-win-close');
                  if(x) x.style.display='none';
                  var hint=document.getElementById('exit-close-hint');
                  if(hint) hint.remove();
                }catch(_e5){}
              }catch(_e6){}
            })();
            """;
        await _webView.CoreWebView2.ExecuteScriptAsync(script);
    }

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
