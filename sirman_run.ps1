# sirman_run.ps1 — reliable local server (TcpListener, no admin) + Windows toasts
# Called by Sirman_Start.bat

$ErrorActionPreference = 'Continue'
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $Root

# === ALWAYS keep this version equal to the latest Sirman HTML release ===
$SirmanVersion = '1405.5.21η'
$Port = 8765
$NotifyPort = 8766
$DefaultFile = 'Sirman_Final.html'
$VersionedFile = "Sirman_Final_$SirmanVersion.html"
if (-not (Test-Path -LiteralPath (Join-Path $Root $DefaultFile))) {
  if (Test-Path -LiteralPath (Join-Path $Root $VersionedFile)) {
    $DefaultFile = $VersionedFile
  } else {
    Write-Host "[ERROR] $DefaultFile / $VersionedFile not found in $Root"
    Start-Sleep -Seconds 5
    exit 1
  }
}
Write-Host "[Sirman] version $SirmanVersion — serving $DefaultFile"

function Show-SirmanToast([string]$Title, [string]$Body) {
  if ([string]::IsNullOrWhiteSpace($Title)) { $Title = 'Sirman' }
  if ($null -eq $Body) { $Body = '' }
  try {
    $null = [Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime]
    $null = [Windows.Data.Xml.Dom.XmlDocument, Windows.Data.Xml.Dom.XmlDocument, ContentType = WindowsRuntime]
    $safeTitle = [System.Security.SecurityElement]::Escape($Title)
    $safeBody  = [System.Security.SecurityElement]::Escape($Body)
    $xml = "<toast><visual><binding template=`"ToastGeneric`"><text>$safeTitle</text><text>$safeBody</text></binding></visual></toast>"
    $doc = New-Object Windows.Data.Xml.Dom.XmlDocument
    $doc.LoadXml($xml)
    $toast = [Windows.UI.Notifications.ToastNotification]::new($doc)
    [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier('Sirman.AfterSales').Show($toast)
    return
  } catch {}
  try {
    Add-Type -AssemblyName System.Windows.Forms | Out-Null
    Add-Type -AssemblyName System.Drawing | Out-Null
    $ni = New-Object System.Windows.Forms.NotifyIcon
    $ni.Icon = [System.Drawing.SystemIcons]::Information
    $ni.Visible = $true
    $ni.BalloonTipTitle = $Title
    $ni.BalloonTipText = $(if ($Body) { $Body } else { 'Sirman' })
    $ni.ShowBalloonTip(5000)
    Start-Sleep -Milliseconds 700
    $ni.Dispose()
  } catch {
    Write-Host "[Notify] $Title - $Body"
  }
}

function Get-ContentType([string]$ext) {
  switch ($ext.ToLowerInvariant()) {
    '.html' { 'text/html; charset=utf-8' }
    '.htm'  { 'text/html; charset=utf-8' }
    '.js'   { 'application/javascript; charset=utf-8' }
    '.css'  { 'text/css; charset=utf-8' }
    '.json' { 'application/json; charset=utf-8' }
    '.png'  { 'image/png' }
    '.jpg'  { 'image/jpeg' }
    '.jpeg' { 'image/jpeg' }
    '.gif'  { 'image/gif' }
    '.svg'  { 'image/svg+xml' }
    '.ico'  { 'image/x-icon' }
    default { 'application/octet-stream' }
  }
}

function Handle-HttpRequest([System.Net.Sockets.TcpClient]$client, [string]$mode) {
  try {
    $stream = $client.GetStream()
    $stream.ReadTimeout = 5000
    $buf = New-Object byte[] 8192
    $n = $stream.Read($buf, 0, $buf.Length)
    if ($n -le 0) { $client.Close(); return }
    $reqText = [Text.Encoding]::UTF8.GetString($buf, 0, $n)
    $first = ($reqText -split "`r`n")[0]
    if ($first -notmatch '^(GET|POST|OPTIONS)\s+(\S+)') { $client.Close(); return }
    $method = $Matches[1]
    $path = $Matches[2]
    $pathOnly = ($path -split '\?')[0]

    if ($mode -eq 'notify') {
      $cors = "Access-Control-Allow-Origin: *`r`nAccess-Control-Allow-Methods: POST, OPTIONS, GET`r`nAccess-Control-Allow-Headers: Content-Type`r`n"
      if ($method -eq 'OPTIONS') {
        $resp = "HTTP/1.1 204 No Content`r`n$cors`r`n"
        $bytes = [Text.Encoding]::ASCII.GetBytes($resp)
        $stream.Write($bytes, 0, $bytes.Length)
        $client.Close(); return
      }
      if ($pathOnly -eq '/health') {
        $body = '{"ok":true,"service":"sirman-notify"}'
        $bb = [Text.Encoding]::UTF8.GetBytes($body)
        $resp = "HTTP/1.1 200 OK`r`n$cors`Content-Type: application/json; charset=utf-8`r`nContent-Length: $($bb.Length)`r`nConnection: close`r`n`r`n"
        $hb = [Text.Encoding]::ASCII.GetBytes($resp)
        $stream.Write($hb, 0, $hb.Length)
        $stream.Write($bb, 0, $bb.Length)
        $client.Close(); return
      }
      if ($method -eq 'POST' -and $pathOnly -eq '/notify') {
        $raw = ''
        if ($reqText -match "`r`n`r`n([\s\S]*)$") { $raw = $Matches[1] }
        $title = 'Sirman'; $bodyTxt = ''
        try {
          $obj = $raw | ConvertFrom-Json
          if ($obj.title) { $title = [string]$obj.title }
          if ($obj.body) { $bodyTxt = [string]$obj.body }
        } catch { $bodyTxt = $raw }
        Show-SirmanToast $title $bodyTxt
        $body = '{"ok":true}'
        $bb = [Text.Encoding]::UTF8.GetBytes($body)
        $resp = "HTTP/1.1 200 OK`r`n$cors`Content-Type: application/json; charset=utf-8`r`nContent-Length: $($bb.Length)`r`nConnection: close`r`n`r`n"
        $hb = [Text.Encoding]::ASCII.GetBytes($resp)
        $stream.Write($hb, 0, $hb.Length)
        $stream.Write($bb, 0, $bb.Length)
        $client.Close(); return
      }
      $msg = [Text.Encoding]::ASCII.GetBytes("HTTP/1.1 404 Not Found`r`n$cors`Content-Length: 0`r`nConnection: close`r`n`r`n")
      $stream.Write($msg, 0, $msg.Length)
      $client.Close(); return
    }

    # file server mode
    $rel = [Uri]::UnescapeDataString($pathOnly.TrimStart('/'))
    if ([string]::IsNullOrWhiteSpace($rel)) { $rel = $DefaultFile }
    $full = [IO.Path]::GetFullPath((Join-Path $Root $rel))
    if (-not $full.StartsWith($Root, [StringComparison]::OrdinalIgnoreCase) -or -not (Test-Path -LiteralPath $full -PathType Leaf)) {
      $msg = [Text.Encoding]::UTF8.GetBytes("Not found")
      $resp = "HTTP/1.1 404 Not Found`r`nContent-Type: text/plain; charset=utf-8`r`nContent-Length: $($msg.Length)`r`nConnection: close`r`n`r`n"
      $hb = [Text.Encoding]::ASCII.GetBytes($resp)
      $stream.Write($hb, 0, $hb.Length)
      $stream.Write($msg, 0, $msg.Length)
      $client.Close(); return
    }
    $fileBytes = [IO.File]::ReadAllBytes($full)
    $ctype = Get-ContentType ([IO.Path]::GetExtension($full))
    $resp = "HTTP/1.1 200 OK`r`nContent-Type: $ctype`r`nContent-Length: $($fileBytes.Length)`r`nCache-Control: no-cache`r`nConnection: close`r`n`r`n"
    $hb = [Text.Encoding]::ASCII.GetBytes($resp)
    $stream.Write($hb, 0, $hb.Length)
    $stream.Write($fileBytes, 0, $fileBytes.Length)
    $client.Close()
  } catch {
    try { $client.Close() } catch {}
  }
}

# Start notify listener
$notifyListener = $null
try {
  $notifyListener = [Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback, $NotifyPort)
  $notifyListener.Start()
  Write-Host "[OK] Notify bridge on http://127.0.0.1:$NotifyPort/notify"
} catch {
  Write-Host "[WARN] Notify port $NotifyPort busy - continuing without bridge"
  $notifyListener = $null
}

# Start file server
$fileListener = $null
try {
  $fileListener = [Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback, $Port)
  $fileListener.Start()
  Write-Host "[OK] File server on http://127.0.0.1:$Port/$DefaultFile"
} catch {
  Write-Host "[WARN] Port $Port busy - file:// open from BAT is enough"
  $fileListener = $null
}

# Open as app window (Edge/Chrome --app) so user closes via in-app ✕ which asks backup
function Open-SirmanApp([string]$Url) {
  $edge1 = Join-Path ${env:ProgramFiles(x86)} 'Microsoft\Edge\Application\msedge.exe'
  $edge2 = Join-Path $env:ProgramFiles 'Microsoft\Edge\Application\msedge.exe'
  $chrome1 = Join-Path $env:ProgramFiles 'Google\Chrome\Application\chrome.exe'
  $chrome2 = Join-Path ${env:ProgramFiles(x86)} 'Google\Chrome\Application\chrome.exe'
  $list = @(
    @{ Exe = $edge2; Arg = "--app=`"$Url`"" },
    @{ Exe = $edge1; Arg = "--app=`"$Url`"" },
    @{ Exe = $chrome1; Arg = "--app=`"$Url`"" },
    @{ Exe = $chrome2; Arg = "--app=`"$Url`"" }
  )
  foreach ($item in $list) {
    if ($item.Exe -and (Test-Path -LiteralPath $item.Exe)) {
      try {
        Start-Process -FilePath $item.Exe -ArgumentList $item.Arg | Out-Null
        Write-Host "[OK] Opened app window:" $item.Exe
        return $true
      } catch {}
    }
  }
  try { Start-Process $Url | Out-Null; return $true } catch { return $false }
}

if ($fileListener) {
  $appUrl = "http://127.0.0.1:$Port/$DefaultFile?app=1&t=$([DateTimeOffset]::Now.ToUnixTimeSeconds())"
  [void](Open-SirmanApp $appUrl)
  Write-Host "Close the app with the red ✕ inside Sirman (asks for backup)."
}

Write-Host "Keep this window open for server/notifications."
Write-Host "Close it to stop."

while ($true) {
  try {
    if ($fileListener -and $fileListener.Pending()) {
      $c = $fileListener.AcceptTcpClient()
      Handle-HttpRequest $c 'file'
    }
    if ($notifyListener -and $notifyListener.Pending()) {
      $c2 = $notifyListener.AcceptTcpClient()
      Handle-HttpRequest $c2 'notify'
    }
    Start-Sleep -Milliseconds 30
  } catch {
    Start-Sleep -Milliseconds 100
  }
}
