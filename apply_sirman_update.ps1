# Applies Sirman_Pending_Update.json (or newest updates\Sirman_Update_*.json with full HTML)
# next to this script onto Sirman_Final.html — for mass deploy on many PCs.
$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $Root

function Get-PendingUpdatePath {
  $pending = Join-Path $Root 'Sirman_Pending_Update.json'
  if (Test-Path $pending) { return $pending }
  $updDir = Join-Path $Root 'updates'
  if (-not (Test-Path $updDir)) { return $null }
  $files = Get-ChildItem -Path $updDir -Filter 'Sirman_Update_*.json' -File | Sort-Object LastWriteTime -Descending
  foreach ($f in $files) {
    try {
      $raw = Get-Content -LiteralPath $f.FullName -Raw -Encoding UTF8
      if ($raw -match 'replaceAppFile' -or $raw -match '"fullHtml"') { return $f.FullName }
    } catch {}
  }
  return $null
}

function Extract-FullHtml([string]$jsonPath) {
  $raw = Get-Content -LiteralPath $jsonPath -Raw -Encoding UTF8
  $pkg = $raw | ConvertFrom-Json
  if (-not $pkg) { throw "Invalid update JSON: $jsonPath" }
  if ($pkg.magic -ne 'SIRMAN_UPDATE') { throw "Not a SIRMAN_UPDATE package" }
  $html = $null
  $fileName = 'Sirman_Final.html'
  if ($pkg.fullHtml) { $html = [string]$pkg.fullHtml }
  if ($pkg.patches) {
    foreach ($p in $pkg.patches) {
      $op = [string]$p.op
      if ($op -eq 'replaceAppFile' -or $op -eq 'fullHtml') {
        if ($p.content) { $html = [string]$p.content }
        elseif ($p.html) { $html = [string]$p.html }
        if ($p.fileName) { $fileName = [string]$p.fileName }
        elseif ($p.filename) { $fileName = [string]$p.filename }
      }
    }
  }
  if (-not $html) { return $null }
  return @{ Html = $html; FileName = $fileName; Version = [string]$pkg.version; Id = [string]$pkg.id }
}

$updPath = Get-PendingUpdatePath
if (-not $updPath) {
  Write-Host '[Sirman] No pending full update found.'
  exit 0
}

Write-Host "[Sirman] Applying update from: $updPath"
$info = Extract-FullHtml $updPath
if (-not $info) {
  Write-Host '[Sirman] Update has no full HTML payload — skipped (small patch-only update).'
  exit 0
}

$verFile = Join-Path $Root 'SIRMAN_VERSION.json'
if (Test-Path -LiteralPath $verFile) {
  try {
    $canon = Get-Content -LiteralPath $verFile -Raw -Encoding UTF8 | ConvertFrom-Json
    if ($canon.app -and $info.Version -and ($canon.app -ne $info.Version)) {
      Write-Host ("[Sirman] Skip stale pending " + $info.Version + " — current is " + $canon.app)
      exit 0
    }
  } catch {}
}

$target = Join-Path $Root $info.FileName
if (Test-Path -LiteralPath $target) {
  try {
    $head = Get-Content -LiteralPath $target -TotalCount 12 -Encoding UTF8
    $headText = [string]::Join("`n", $head)
    $mark = 'content="' + $info.Version + '"'
    if ($info.Version -and $headText.Contains($mark)) {
      Write-Host ("[Sirman] " + $info.FileName + " already at " + $info.Version + " — skip")
      if ([IO.Path]::GetFileName($updPath) -eq 'Sirman_Pending_Update.json') {
        $done = Join-Path $Root ('Sirman_Pending_Update.applied.' + ($info.Version -replace '[^\w\.\-]', '_') + '.json')
        try { Move-Item -LiteralPath $updPath -Destination $done -Force } catch {}
      }
      exit 0
    }
  } catch {}
}

$utf8NoBom = New-Object System.Text.UTF8Encoding $false
[System.IO.File]::WriteAllText($target, $info.Html, $utf8NoBom)

# also write versioned copy when version present
if ($info.Version) {
  $verName = "Sirman_Final_$($info.Version).html"
  $verPath = Join-Path $Root $verName
  [System.IO.File]::WriteAllText($verPath, $info.Html, $utf8NoBom)
  Write-Host "[Sirman] Wrote $verName"
}

Write-Host "[Sirman] Wrote $($info.FileName) (version $($info.Version))"

# rename pending so it is not re-applied forever (keep a .applied copy)
if ([IO.Path]::GetFileName($updPath) -eq 'Sirman_Pending_Update.json') {
  $done = Join-Path $Root ('Sirman_Pending_Update.applied.' + ($info.Version -replace '[^\w\.\-]', '_') + '.json')
  try { Move-Item -LiteralPath $updPath -Destination $done -Force } catch {}
}

exit 0
