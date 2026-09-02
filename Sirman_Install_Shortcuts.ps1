# Sirman_Install_Shortcuts.ps1 — canonical Start Menu + desktop shortcuts
# Folder: Programs\Sirman
# Launch: SIRMAN.lnk   Uninstall: Uninstall SIRMAN.lnk
# Desktop: Sirman.lnk
# Persian is Description metadata only — not a second folder.
param(
  [ValidateSet('user-start','user-start-desktop','open-install','open-start-folder')]
  [string]$Mode = 'user-start-desktop'
)

$ErrorActionPreference = 'Stop'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$StartBat = Join-Path $Root 'Sirman_Start.bat'
$Exe = Join-Path $Root 'Sirman.exe'
if (Test-Path -LiteralPath $Exe) {
  $Launch = $Exe
} elseif (Test-Path -LiteralPath $StartBat) {
  $Launch = $StartBat
} else {
  Write-Host "[ERROR] Sirman.exe / Sirman_Start.bat not found next to this script:"
  Write-Host "  $Root"
  Start-Sleep -Seconds 4
  exit 1
}

$life = Join-Path $Root 'Sirman-InstallLifecycle.ps1'
if (-not (Test-Path -LiteralPath $life)) {
  $life = Join-Path (Split-Path -Parent $Root) 'scripts\setup-kit\Sirman-InstallLifecycle.ps1'
}

if (Test-Path -LiteralPath $life) {
  . $life
  switch ($Mode) {
    'open-install' {
      Start-Process explorer.exe $Root
      exit 0
    }
    'open-start-folder' {
      $dir = Get-SirmanCanonicalStartMenuDir
      New-Item -ItemType Directory -Force -Path $dir | Out-Null
      Start-Process explorer.exe $dir
      exit 0
    }
    'user-start' {
      New-SirmanCanonicalShortcuts -LaunchTarget $Launch -WorkDir $Root
      Write-SirmanInstallLocation -Dest $Root
      Write-Host "[OK] Start Menu: SIRMAN.lnk + Uninstall SIRMAN.lnk"
    }
    'user-start-desktop' {
      New-SirmanCanonicalShortcuts -LaunchTarget $Launch -WorkDir $Root -Desktop
      Write-SirmanInstallLocation -Dest $Root
      Write-Host "[OK] Start Menu + Desktop (Sirman.lnk)"
    }
  }
  Start-Sleep -Seconds 2
  exit 0
}

# Fallback if lifecycle script is missing: still use the same canonical names.
$Programs = Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs\Sirman'
$Desktop = [Environment]::GetFolderPath('DesktopDirectory')
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
    $link = Join-Path $Programs 'SIRMAN.lnk'
    New-SirmanShortcut $link $Launch $Root 'سیرمان — خدمات پس از فروش'
    $unBat = Join-Path $Root 'Uninstall-Sirman.bat'
    if (Test-Path -LiteralPath $unBat) {
      New-SirmanShortcut (Join-Path $Programs 'Uninstall SIRMAN.lnk') $unBat $Root 'حذف سالم سیرمان (سطح ۱ — برنامه، نه داده کسب‌وکار)'
    }
    Set-Content -LiteralPath (Join-Path $InstallNoteDir 'install-location.txt') -Value $Root -Encoding UTF8
    Write-Host "[OK] Start Menu shortcut created:"
    Write-Host "  $link"
  }
  'user-start-desktop' {
    Ensure-Dirs
    $link1 = Join-Path $Programs 'SIRMAN.lnk'
    $link2 = Join-Path $Desktop 'Sirman.lnk'
    New-SirmanShortcut $link1 $Launch $Root 'سیرمان — خدمات پس از فروش'
    New-SirmanShortcut $link2 $Launch $Root 'سیرمان — خدمات پس از فروش'
    $unBat2 = Join-Path $Root 'Uninstall-Sirman.bat'
    if (Test-Path -LiteralPath $unBat2) {
      New-SirmanShortcut (Join-Path $Programs 'Uninstall SIRMAN.lnk') $unBat2 $Root 'حذف سالم سیرمان (سطح ۱ — برنامه، نه داده کسب‌وکار)'
    }
    $fcBat = Join-Path $Root 'Sirman-Full-Cleanup.bat'
    if (Test-Path -LiteralPath $fcBat) {
      New-SirmanShortcut (Join-Path $Programs 'SIRMAN Full Cleanup.lnk') $fcBat $Root 'پاک‌سازی کامل داده سیرمان (سطح ۲ — نیاز به تایید)'
    }
    Set-Content -LiteralPath (Join-Path $InstallNoteDir 'install-location.txt') -Value $Root -Encoding UTF8
    Write-Host "[OK] Start Menu + Desktop shortcuts created:"
    Write-Host "  $link1"
    Write-Host "  $link2"
  }
}

Write-Host ""
Write-Host "Start Menu folder: Programs\Sirman"
Write-Host "Launch: SIRMAN.lnk"
Start-Sleep -Seconds 3
