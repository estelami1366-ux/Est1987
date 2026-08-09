# sirman_notify.ps1 — Windows notification bridge for Sirman
# Listens on http://127.0.0.1:8766/notify and shows Action Center toasts.
param([int]$Port = 8766)

$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}

function Show-SirmanToast {
  param([string]$Title, [string]$Body)
  if ([string]::IsNullOrWhiteSpace($Title)) { $Title = 'Sirman' }
  if ($null -eq $Body) { $Body = '' }

  # Path 1: WinRT Toast (Windows 10/11 Action Center)
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
    [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier('Sirman.AfterSales').Show($toast)
    return
  } catch {}

  # Path 2: NotifyIcon balloon
  try {
    Add-Type -AssemblyName System.Windows.Forms | Out-Null
    Add-Type -AssemblyName System.Drawing | Out-Null
    $ni = New-Object System.Windows.Forms.NotifyIcon
    $ni.Icon = [System.Drawing.SystemIcons]::Information
    $ni.Visible = $true
    $ni.BalloonTipTitle = $Title
    $ni.BalloonTipText = $(if ($Body.Length -gt 0) { $Body } else { 'Sirman reminder' })
    $ni.ShowBalloonTip(6000)
    Start-Sleep -Milliseconds 800
    $ni.Dispose()
    return
  } catch {}

  Write-Host ("[SirmanNotify] " + $Title + " - " + $Body)
}

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://127.0.0.1:$Port/")
$listener.Prefixes.Add("http://localhost:$Port/")

try {
  $listener.Start()
} catch {
  Write-Host "[ERROR] Cannot listen on port $Port"
  Write-Host $_.Exception.Message
  Write-Host "Maybe another Sirman notify bridge is already running."
  Start-Sleep -Seconds 4
  exit 1
}

Write-Host "===================================================="
Write-Host "  Sirman Windows Notify Bridge"
Write-Host "  http://127.0.0.1:$Port/notify"
Write-Host "  Keep this window open."
Write-Host "===================================================="

while ($listener.IsListening) {
  try {
    $ctx = $listener.GetContext()
    $req = $ctx.Request
    $res = $ctx.Response
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
      $reader = New-Object IO.StreamReader($req.InputStream, [Text.Encoding]::UTF8)
      $raw = $reader.ReadToEnd()
      $reader.Close()
      $title = 'Sirman'
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
