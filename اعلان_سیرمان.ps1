# اعلان_سیرمان.ps1 — پل اعلان به مرکز اعلان‌های ویندوز
# مطابق ایدهٔ فایل plan.txt / کامنت پرامپت اعلان‌ها:
# برنامهٔ HTML روی http://127.0.0.1:8766/notify اعلان می‌فرستد و این اسکریپت Toast ویندوز نشان می‌دهد.
# اجرا: معمولاً از «اجرای سیرمان.bat» به‌صورت خودکار؛ یا دستی: powershell -ExecutionPolicy Bypass -File اعلان_سیرمان.ps1

param(
  [int]$Port = 8766
)

$ErrorActionPreference = 'SilentlyContinue'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

function Show-SirmanToast {
  param([string]$Title, [string]$Body)

  $Title = if ([string]::IsNullOrWhiteSpace($Title)) { 'سیرمان' } else { $Title }
  $Body  = if ($null -eq $Body) { '' } else { $Body }

  # مسیر ۱: WinRT Toast (ویندوز ۱۰/۱۱)
  try {
    $null = [Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime]
    $null = [Windows.Data.Xml.Dom.XmlDocument, Windows.Data.Xml.Dom.XmlDocument, ContentType = WindowsRuntime]

    $safeTitle = [System.Security.SecurityElement]::Escape($Title)
    $safeBody  = [System.Security.SecurityElement]::Escape($Body)
    $xml = @"
<toast>
  <visual>
    <binding template="ToastGeneric">
      <text>$safeTitle</text>
      <text>$safeBody</text>
    </binding>
  </visual>
</toast>
"@
    $doc = New-Object Windows.Data.Xml.Dom.XmlDocument
    $doc.LoadXml($xml)
    $toast = [Windows.UI.Notifications.ToastNotification]::new($doc)
    $appId = 'Sirman.AfterSales'
    [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier($appId).Show($toast)
    return
  } catch {}

  # مسیر ۲: BalloonTip از طریق NotifyIcon (سازگاری بیشتر)
  try {
    Add-Type -AssemblyName System.Windows.Forms
    Add-Type -AssemblyName System.Drawing
    $ni = New-Object System.Windows.Forms.NotifyIcon
    $ni.Icon = [System.Drawing.SystemIcons]::Information
    $ni.Visible = $true
    $ni.BalloonTipTitle = $Title
    $ni.BalloonTipText  = $(if ($Body.Length -gt 0) { $Body } else { 'یادآوری سیرمان' })
    $ni.ShowBalloonTip(6000)
    Start-Sleep -Milliseconds 700
    $ni.Dispose()
    return
  } catch {}

  Write-Host ("[SirmanNotify] " + $Title + " — " + $Body)
}

# شنوندهٔ HTTP خیلی سبک روی 127.0.0.1
$listener = New-Object System.Net.HttpListener
$prefix = "http://127.0.0.1:$Port/"
$listener.Prefixes.Add($prefix)

try {
  $listener.Start()
} catch {
  Write-Host "❌ نتوانست روی پورت $Port گوش دهد. شاید قبلاً اجرا شده."
  Write-Host $_.Exception.Message
  exit 1
}

Write-Host "===================================================="
Write-Host "  سیرمان — پل اعلان ویندوز"
Write-Host "  گوش‌دادن روی $prefix"
Write-Host "  این پنجره را باز نگه دارید."
Write-Host "===================================================="

while ($listener.IsListening) {
  try {
    $ctx = $listener.GetContext()
    $req = $ctx.Request
    $res = $ctx.Response

    # CORS برای fetch از localhost:8765
    $res.AddHeader('Access-Control-Allow-Origin', '*')
    $res.AddHeader('Access-Control-Allow-Methods', 'POST, OPTIONS, GET')
    $res.AddHeader('Access-Control-Allow-Headers', 'Content-Type')

    if ($req.HttpMethod -eq 'OPTIONS') {
      $res.StatusCode = 204
      $res.Close()
      continue
    }

    if ($req.Url.AbsolutePath -eq '/health') {
      $buf = [Text.Encoding]::UTF8.GetBytes('{"ok":true,"service":"sirman-notify"}')
      $res.ContentType = 'application/json; charset=utf-8'
      $res.OutputStream.Write($buf, 0, $buf.Length)
      $res.Close()
      continue
    }

    if ($req.HttpMethod -eq 'POST' -and $req.Url.AbsolutePath -eq '/notify') {
      $reader = New-Object IO.StreamReader($req.InputStream, $req.ContentEncoding)
      $raw = $reader.ReadToEnd()
      $reader.Close()
      $title = 'سیرمان'
      $body = ''
      try {
        $obj = $raw | ConvertFrom-Json
        if ($obj.title) { $title = [string]$obj.title }
        if ($obj.body)  { $body  = [string]$obj.body }
      } catch {
        $body = $raw
      }
      Show-SirmanToast -Title $title -Body $body
      $buf = [Text.Encoding]::UTF8.GetBytes('{"ok":true}')
      $res.ContentType = 'application/json; charset=utf-8'
      $res.StatusCode = 200
      $res.OutputStream.Write($buf, 0, $buf.Length)
      $res.Close()
      continue
    }

    $res.StatusCode = 404
    $buf = [Text.Encoding]::UTF8.GetBytes('not found')
    $res.OutputStream.Write($buf, 0, $buf.Length)
    $res.Close()
  } catch {
    Start-Sleep -Milliseconds 200
  }
}
