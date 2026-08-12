# install-package.ps1 — کپی پکیج سیرمان به مسیر انتخاب‌شده + میانبرها
param(
  [Parameter(Mandatory = $true)][string]$Dest,
  [Parameter(Mandatory = $true)][string]$SourceRoot,
  [ValidateSet('0','1')][string]$DesktopShortcut = '0'
)

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$Dest = [System.IO.Path]::GetFullPath($Dest.Trim())
# ریشه درایو → زیرپوشه Sirman
$root = [System.IO.Path]::GetPathRoot($Dest).TrimEnd('\')
if ($Dest.TrimEnd('\') -ieq $root) {
  $Dest = Join-Path $Dest 'Sirman'
}

$publish = Join-Path $SourceRoot 'publish'
$exeSrc = Join-Path $publish 'Sirman.exe'
if (-not (Test-Path -LiteralPath $exeSrc)) {
  Write-Host "[ERROR] Sirman.exe در publish پیدا نشد. اول build-win.bat را اجرا کنید."
  exit 2
}

New-Item -ItemType Directory -Force -Path $Dest | Out-Null
Write-Host "کپی به: $Dest"
Copy-Item -Path (Join-Path $publish '*') -Destination $Dest -Recurse -Force

foreach ($name in @('Sirman_Final.html', 'Sirman_Pending_Update.json', 'Uninstall-Sirman.bat')) {
  $src = Join-Path $SourceRoot $name
  if (Test-Path -LiteralPath $src) {
    Copy-Item -LiteralPath $src -Destination (Join-Path $Dest $name) -Force
  }
}

$parentHtml = Join-Path (Split-Path $SourceRoot -Parent) 'Sirman_Final.html'
$destHtml = Join-Path $Dest 'Sirman_Final.html'
if ((-not (Test-Path -LiteralPath $destHtml)) -and (Test-Path -LiteralPath $parentHtml)) {
  Copy-Item -LiteralPath $parentHtml -Destination $destHtml -Force
}

$updSrc = Join-Path $SourceRoot 'updates'
$updDst = Join-Path $Dest 'updates'
if (Test-Path -LiteralPath $updSrc) {
  New-Item -ItemType Directory -Force -Path $updDst | Out-Null
  Get-ChildItem -LiteralPath $updSrc -Filter '*.json' -ErrorAction SilentlyContinue |
    ForEach-Object { Copy-Item -LiteralPath $_.FullName -Destination $updDst -Force }
}

$exe = Join-Path $Dest 'Sirman.exe'
if (-not (Test-Path -LiteralPath $exe)) {
  Write-Host "[ERROR] بعد از کپی Sirman.exe نبود."
  exit 3
}

# ثبت مسیر نصب برای حذف/یادآوری
$appRoot = Join-Path $env:LOCALAPPDATA 'Sirman'
New-Item -ItemType Directory -Force -Path $appRoot | Out-Null
Set-Content -LiteralPath (Join-Path $appRoot 'install-location.txt') -Value $Dest -Encoding UTF8

# Uninstall باید از فایل آماده کپی شده باشد (نه متن داخل PS1)
$unBat = Join-Path $Dest 'Uninstall-Sirman.bat'
$unSrc = Join-Path $SourceRoot 'Uninstall-Sirman.bat'
if (-not (Test-Path -LiteralPath $unBat)) {
  if (Test-Path -LiteralPath $unSrc) {
    Copy-Item -LiteralPath $unSrc -Destination $unBat -Force
  } else {
    Write-Host "[WARN] Uninstall-Sirman.bat پیدا نشد — میانبر حذف ساخته نمی‌شود."
  }
}

# میانبرها
$shell = New-Object -ComObject WScript.Shell
$startDir = Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs\سیرمان'
New-Item -ItemType Directory -Force -Path $startDir | Out-Null

$l = $shell.CreateShortcut((Join-Path $startDir 'سیرمان.lnk'))
$l.TargetPath = $exe
$l.WorkingDirectory = $Dest
$l.Description = 'سیرمان — خدمات پس از فروش'
$l.Save()

if (Test-Path -LiteralPath $unBat) {
  $u = $shell.CreateShortcut((Join-Path $startDir 'حذف سیرمان.lnk'))
  $u.TargetPath = $unBat
  $u.WorkingDirectory = $Dest
  $u.Description = 'حذف سالم سیرمان'
  $u.Save()
}

if ($DesktopShortcut -eq '1') {
  $desk = [Environment]::GetFolderPath('DesktopDirectory')
  $d = $shell.CreateShortcut((Join-Path $desk 'سیرمان.lnk'))
  $d.TargetPath = $exe
  $d.WorkingDirectory = $Dest
  $d.Description = 'سیرمان'
  $d.Save()
}

Write-Host "OK"
Write-Host "EXE: $exe"
Write-Host "Uninstall: $unBat"
exit 0
