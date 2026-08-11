# sirman_server.ps1 — local static file server for Sirman (no Python required)
param(
  [int]$Port = 8765,
  [string]$DefaultFile = 'Sirman_Final.html',
  [string]$Root = ''
)

$ErrorActionPreference = 'Stop'
if ([string]::IsNullOrWhiteSpace($Root)) { $Root = (Get-Location).Path }
$Root = [IO.Path]::GetFullPath($Root)

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://127.0.0.1:$Port/")
$listener.Prefixes.Add("http://localhost:$Port/")

try {
  $listener.Start()
} catch {
  Write-Host "[ERROR] Cannot start server on port $Port"
  Write-Host $_.Exception.Message
  Write-Host "Is another program using this port?"
  Start-Sleep -Seconds 5
  exit 1
}

Write-Host "===================================================="
Write-Host "  Sirman local server"
Write-Host "  Folder: $Root"
Write-Host "  URL:    http://127.0.0.1:$Port/$DefaultFile"
Write-Host "  Close this window to stop."
Write-Host "===================================================="

function Get-ContentType([string]$ext) {
  switch ($ext.ToLowerInvariant()) {
    '.html' { return 'text/html; charset=utf-8' }
    '.htm'  { return 'text/html; charset=utf-8' }
    '.js'   { return 'application/javascript; charset=utf-8' }
    '.css'  { return 'text/css; charset=utf-8' }
    '.json' { return 'application/json; charset=utf-8' }
    '.png'  { return 'image/png' }
    '.jpg'  { return 'image/jpeg' }
    '.jpeg' { return 'image/jpeg' }
    '.gif'  { return 'image/gif' }
    '.webp' { return 'image/webp' }
    '.svg'  { return 'image/svg+xml' }
    '.ico'  { return 'image/x-icon' }
    '.woff' { return 'font/woff' }
    '.woff2'{ return 'font/woff2' }
    default { return 'application/octet-stream' }
  }
}

while ($listener.IsListening) {
  $ctx = $null
  try {
    $ctx = $listener.GetContext()
    $req = $ctx.Request
    $res = $ctx.Response

    $rel = [Uri]::UnescapeDataString(($req.Url.LocalPath).TrimStart('/'))
    if ([string]::IsNullOrWhiteSpace($rel)) { $rel = $DefaultFile }

    # block path traversal
    $full = [IO.Path]::GetFullPath((Join-Path $Root $rel))
    if (-not $full.StartsWith($Root, [StringComparison]::OrdinalIgnoreCase)) {
      $res.StatusCode = 403
      $res.Close()
      continue
    }

    if (-not (Test-Path -LiteralPath $full -PathType Leaf)) {
      $res.StatusCode = 404
      $msg = [Text.Encoding]::UTF8.GetBytes("Not found: $rel")
      $res.ContentType = 'text/plain; charset=utf-8'
      $res.OutputStream.Write($msg, 0, $msg.Length)
      $res.Close()
      continue
    }

    $bytes = [IO.File]::ReadAllBytes($full)
    $res.ContentType = Get-ContentType ([IO.Path]::GetExtension($full))
    $res.ContentLength64 = $bytes.LongLength
    $res.AddHeader('Cache-Control', 'no-cache')
    $res.StatusCode = 200
    $res.OutputStream.Write($bytes, 0, $bytes.Length)
    $res.Close()
  } catch {
    if ($ctx -ne $null) {
      try { $ctx.Response.Abort() } catch {}
    }
    Start-Sleep -Milliseconds 50
  }
}
