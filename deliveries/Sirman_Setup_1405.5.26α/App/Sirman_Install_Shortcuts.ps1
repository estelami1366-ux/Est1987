# Sirman_Install_Shortcuts.ps1 — میانبر Start Menu و دسکتاپ برای سیرمان
# جایگزین منوی «نصب» پوسته قدیمی .NET
param(
  [ValidateSet('user-start','user-start-desktop','open-install','open-start-folder')]
  [string]$Mode = 'user-start-desktop'
)

$ErrorActionPreference = 'Stop'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$StartBat = Join-Path $Root 'Sirman_Start.bat'
if (-not (Test-Path -LiteralPath $StartBat)) {
  Write-Host "[ERROR] Sirman_Start.bat not found next to this script:"
  Write-Host "  $Root"
  Start-Sleep -Seconds 4
  exit 1
}

$Programs = Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs\Sirman'
$Desktop = [Environment]::GetFolderPath('Desktop')
$InstallNoteDir = Join-Path $env:LOCALAPPDATA 'Sirman'

function New-SirmanShortcut([string]$LinkPath, [string]$Target, [string]$WorkDir, [string]$Desc) {
  $w = New-Object -ComObject WScript.Shell
  $sc = $w.CreateShortcut($LinkPath)
  $sc.TargetPath = $Target
  $sc.WorkingDirectory = $WorkDir
  $sc.WindowStyle = 1
  $sc.Description = $Desc
  $sc.Save()
}

function Ensure-Dirs {
  New-Item -ItemType Directory -Force -Path $Programs | Out-Null
  New-Item -ItemType Directory -Force -Path $InstallNoteDir | Out-Null
}

switch ($Mode) {
  'open-install' {
    Ensure-Dirs
    Start-Process explorer.exe $Root
    exit 0
  }
  'open-start-folder' {
    Ensure-Dirs
    Start-Process explorer.exe $Programs
    exit 0
  }
  'user-start' {
    Ensure-Dirs
    $link = Join-Path $Programs 'سیرمان.lnk'
    New-SirmanShortcut $link $StartBat $Root 'سیرمان — خدمات پس از فروش'
    Set-Content -LiteralPath (Join-Path $InstallNoteDir 'install_path.txt') -Value $Root -Encoding UTF8
    Write-Host "[OK] Start Menu shortcut created:"
    Write-Host "  $link"
  }
  'user-start-desktop' {
    Ensure-Dirs
    $link1 = Join-Path $Programs 'سیرمان.lnk'
    $link2 = Join-Path $Desktop 'سیرمان.lnk'
    New-SirmanShortcut $link1 $StartBat $Root 'سیرمان — خدمات پس از فروش'
    New-SirmanShortcut $link2 $StartBat $Root 'سیرمان — خدمات پس از فروش'
    Set-Content -LiteralPath (Join-Path $InstallNoteDir 'install_path.txt') -Value $Root -Encoding UTF8
    Write-Host "[OK] Start Menu + Desktop shortcuts created:"
    Write-Host "  $link1"
    Write-Host "  $link2"
  }
}

Write-Host ""
Write-Host "From Start Menu / Desktop, open «سیرمان»."
Write-Host "That runs Sirman_Start.bat (local server + notify)."
Start-Sleep -Seconds 3
