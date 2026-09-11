using Sirman.Core.Diagnostics;

namespace Sirman.Desktop;

/// <summary>
/// Native diagnostic center. Displays Core guidance; does not classify or persist.
/// </summary>
internal sealed class DiagnosticCenterForm : Form
{
    readonly ListView _list = new();
    readonly ComboBox _severity = new();
    readonly TextBox _detail = new();
    readonly Button _export = new();
    readonly Button _refresh = new();
    string? _selectedCorrelation;

    public DiagnosticCenterForm()
    {
        Text = "مرکز گزارش و تشخیص خطا";
        Width = 980;
        Height = 640;
        MinimumSize = new Size(720, 480);
        StartPosition = FormStartPosition.CenterParent;
        RightToLeft = RightToLeft.Yes;
        RightToLeftLayout = true;
        Font = new Font("Segoe UI", 10f);
        Padding = new Padding(8);

        var top = new FlowLayoutPanel
        {
            Dock = DockStyle.Top,
            Height = 40,
            FlowDirection = FlowDirection.RightToLeft,
            WrapContents = false
        };
        top.Controls.Add(new Label { Text = "شدت:", AutoSize = true, Padding = new Padding(8, 8, 4, 0) });
        _severity.DropDownStyle = ComboBoxStyle.DropDownList;
        _severity.Width = 160;
        _severity.Items.AddRange(new object[]
        {
            new SevItem("همه", null),
            new SevItem("هشدار و بالاتر", DiagnosticSeverity.Warning),
            new SevItem("خطا و بالاتر", DiagnosticSeverity.Error),
            new SevItem("فقط بحرانی", DiagnosticSeverity.Critical)
        });
        _severity.SelectedIndex = 0;
        _severity.SelectedIndexChanged += (_, _) => Reload();
        top.Controls.Add(_severity);
        _refresh.Text = "تازه‌سازی";
        _refresh.AutoSize = true;
        _refresh.Click += (_, _) => Reload();
        top.Controls.Add(_refresh);
        _export.Text = "صدور گزارش تشخیص";
        _export.AutoSize = true;
        _export.Enabled = false;
        _export.Click += (_, _) => ExportSelected();
        top.Controls.Add(_export);

        _list.Dock = DockStyle.Fill;
        _list.View = View.Details;
        _list.FullRowSelect = true;
        _list.HideSelection = false;
        _list.MultiSelect = false;
        _list.Columns.Add("زمان", 170);
        _list.Columns.Add("شدت", 80);
        _list.Columns.Add("کد", 180);
        _list.Columns.Add("کد پیگیری", 280);
        _list.SelectedIndexChanged += (_, _) => ShowSelected();

        _detail.Dock = DockStyle.Bottom;
        _detail.Height = 280;
        _detail.Multiline = true;
        _detail.ReadOnly = true;
        _detail.ScrollBars = ScrollBars.Vertical;
        _detail.BackColor = Color.White;
        _detail.Text = "یک رویداد را از فهرست انتخاب کنید.";

        Controls.Add(_list);
        Controls.Add(_detail);
        Controls.Add(top);
        Load += (_, _) => Reload();
    }

    void Reload()
    {
        _list.Items.Clear();
        _selectedCorrelation = null;
        _export.Enabled = false;
        _detail.Text = "یک رویداد را از فهرست انتخاب کنید.";
        DiagnosticQuery query = new() { Limit = 100 };
        if (_severity.SelectedItem is SevItem { Min: { } min })
            query.MinSeverity = min;
        IReadOnlyList<DiagnosticEvent> events;
        try
        {
            events = DiagnosticRuntime.Facade.ListRecent(query);
        }
        catch (Exception ex)
        {
            _detail.Text = "خواندن رویدادها انجام نشد.\r\n" + ex.Message;
            return;
        }
        foreach (var evt in events)
        {
            var row = new ListViewItem(new[]
            {
                string.IsNullOrWhiteSpace(evt.TimestampLocal) ? evt.TimestampUtc : evt.TimestampLocal,
                SeverityFa(evt.Severity),
                evt.Code ?? "",
                evt.CorrelationId ?? ""
            })
            { Tag = evt.CorrelationId };
            _list.Items.Add(row);
        }
        if (_list.Items.Count == 0)
            _detail.Text = "رویداد تشخیصی ثبت نشده است.";
    }

    void ShowSelected()
    {
        if (_list.SelectedItems.Count == 0)
        {
            _selectedCorrelation = null;
            _export.Enabled = false;
            return;
        }
        var id = _list.SelectedItems[0].Tag as string;
        _selectedCorrelation = id;
        _export.Enabled = !string.IsNullOrWhiteSpace(id);
        if (string.IsNullOrWhiteSpace(id)) return;
        DiagnosticIncidentView? view;
        try { view = DiagnosticRuntime.Facade.LoadIncident(id); }
        catch (Exception ex)
        {
            _detail.Text = "خواندن حادثه انجام نشد.\r\n" + ex.Message;
            return;
        }
        if (view is null)
        {
            _detail.Text = "حادثه‌ای با این شناسه نیست.";
            return;
        }
        var g = view.Guidance;
        var inc = view.Incident;
        _detail.Text = string.Join("\r\n",
            "زمان: " + g.Timestamp,
            "شدت: " + SeverityFa(inc.Severity),
            "ماژول: " + g.Module,
            "کد: " + g.Code,
            "کد پیگیری: " + g.CorrelationId,
            "",
            "پیام: " + g.UserMessage,
            "علت: " + g.Why,
            "اثر: " + g.Impact,
            "اقدام بعدی: " + g.NextAction,
            "اقدام پشتیبانی: " + g.SupportAction);
    }

    void ExportSelected()
    {
        if (string.IsNullOrWhiteSpace(_selectedCorrelation)) return;
        DiagnosticExportResult exported;
        try { exported = DiagnosticRuntime.Facade.ExportIncident(_selectedCorrelation); }
        catch (Exception ex)
        {
            MessageBox.Show(this, "صدور گزارش انجام نشد.\n" + ex.Message, "مرکز تشخیص", MessageBoxButtons.OK, MessageBoxIcon.Warning);
            return;
        }
        if (!exported.Ok)
        {
            MessageBox.Show(this, exported.Message ?? "صدور گزارش انجام نشد.", "مرکز تشخیص", MessageBoxButtons.OK, MessageBoxIcon.Warning);
            return;
        }
        MessageBox.Show(this,
            "گزارش نوشته شد.\n\nفایل: " + exported.FileName + "\nپوشه: diagnostics/support",
            "مرکز تشخیص",
            MessageBoxButtons.OK,
            MessageBoxIcon.Information);
    }

    static string SeverityFa(DiagnosticSeverity s) => s switch
    {
        DiagnosticSeverity.Critical => "بحرانی",
        DiagnosticSeverity.Error => "خطا",
        DiagnosticSeverity.Warning => "هشدار",
        DiagnosticSeverity.Info => "اطلاع",
        DiagnosticSeverity.Audit => "حسابرسی",
        _ => s.ToString()
    };

    sealed class SevItem
    {
        public string Label { get; }
        public DiagnosticSeverity? Min { get; }
        public SevItem(string label, DiagnosticSeverity? min) { Label = label; Min = min; }
        public override string ToString() => Label;
    }
}
