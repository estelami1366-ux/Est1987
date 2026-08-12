# install-package.ps1 — کپی پکیج سیرمان به مسیر انتخاب‌شده + میانبرها
param(
  [Parameter(Mandatory = $true)][string]$Dest,
  [Parameter(Mandatory = $true)][string]$SourceRoot,
  [ValidateSet('0','1')][string]$DesktopShortcut = '0'
)

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

function Write-Utf8Bom([string]$Path, [string]$Content) {
  $enc = New-Object System.Text.UTF8Encoding($true)
  [System.IO.File]::WriteAllText($Path, $Content, $enc)
}

$Dest = [System.IO.Path]::GetFullPath($Dest.Trim())
# ریشه درایو → زیرپوشه Sirman
$root = [System.IO.Path]::GetPathRoot($Dest).TrimEnd('\')
if ($Dest.TrimEnd('\') -ieq $root) {
  $Dest = Join-Path $Dest 'Sirman'
}

$publish = Join-Path $SourceRoot 'publish'
if (-not (Test-Path -LiteralPath (Join-Path $publish 'Sirman.exe'))) {
  Write-Host "[ERROR] Sirman.exe در publish پیدا نشد. اول build-win.bat را اجرا کنید."
  exit 2
}

New-Item -ItemType Directory -Force -Path $Dest | Out-Null
Write-Host "کپی به: $Dest"
Copy-Item -Path (Join-Path $publish '*') -Destination $Dest -Recurse -Force

foreach ($name in @('Sirman_Final.html','Sirman_Pending_Update.json','Uninstall-Sirman.bat')) {
  $src = Join-Path $SourceRoot $name
  if (Test-Path -LiteralPath $src) {
    Copy-Item -LiteralPath $src -Destination (Join-Path $Dest $name) -Force
  }
}
$parentHtml = Join-Path (Split-Path $SourceRoot -Parent) 'Sirman_Final.html'
if ((-not (Test-Path (Join-Path $Dest 'Sirman_Final.html'))) -and (Test-Path $parentHtml)) {
  Copy-Item -LiteralPath $parentHtml -Destination (Join-Path $Dest 'Sirman_Final.html') -Force
}

$updSrc = Join-Path $SourceRoot 'updates'
$updDst = Join-Path $Dest 'updates'
if (Test-Path -LiteralPath $updSrc) {
  New-Item -ItemType Directory -Force -Path $updDst | Out-Null
  Copy-Item -Path (Join-Path $updSrc '*.json') -Destination $updDst -Force -ErrorAction SilentlyContinue
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

# Uninstall کنار exe (مسیر نسبی به همین پوشه)
$unBat = Join-Path $Dest 'Uninstall-Sirman.bat'
$unContent = @"
@echo off
chcp 65001 >nul
setlocal EnableExtensions
cd /d "%~dp0"
title حذف سیرمان
color 0C
set "INSTALL_DIR=%~dp0"
if "%INSTALL_DIR:~-1%"=="\" set "INSTALL_DIR=%INSTALL_DIR:~0,-1%"
set "APP_ROOT=%LOCALAPPDATA%\Sirman"
set "LOC_FILE=%APP_ROOT%\install-location.txt"
set "START_DIR=%APPDATA%\Microsoft\Windows\Start Menu\Programs\سیرمان"
set "DESKTOP_LNK=%USERPROFILE%\Desktop\سیرمان.lnk"
set "DESKTOP_LNK2=%USERPROFILE%\OneDrive\Desktop\سیرمان.lnk"
echo.
echo ===============================================
echo   حذف سالم سیرمان (Uninstall)
echo ===============================================
echo.
echo مسیر نصب:
echo   %INSTALL_DIR%
echo.
choice /C YN /M "حذف سیرمان انجام شود؟"
if errorlevel 2 ( echo انصراف. & pause & exit /b 0 )
echo [1/4] بستن برنامه...
taskkill /F /IM Sirman.exe >nul 2>&1
timeout /t 1 /nobreak >nul
echo [2/4] حذف میانبرها...
if exist "%START_DIR%" rd /s /q "%START_DIR%" 2>nul
if exist "%DESKTOP_LNK%" del /f /q "%DESKTOP_LNK%" 2>nul
if exist "%DESKTOP_LNK2%" del /f /q "%DESKTOP_LNK2%" 2>nul
echo [3/4] حذف ثبت مسیر نصب...
if exist "%LOC_FILE%" del /f /q "%LOC_FILE%" 2>nul
echo [4/4] حذف پوشه نصب...
cd /d "%TEMP%"
rd /s /q "%INSTALL_DIR%" 2>nul
echo.
choice /C YN /M "داده LocalAppData\Sirman هم پاک شود؟"
if not errorlevel 2 (
  if exist "%APP_ROOT%" rd /s /q "%APP_ROOT%" 2>nul
)
echo.
echo حذف تمام شد.
pause
exit /b 0
"@
Write-Utf8Bom -Path $unBat -Content $unContent

# میانبرها
$shell = New-Object -ComObject WScript.Shell
$startDir = Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs\سیرمان'
New-Item -ItemType Directory -Force -Path $startDir | Out-Null

$l = $shell.CreateShortcut((Join-Path $startDir 'سیرمان.lnk'))
$l.TargetPath = $exe
$l.WorkingDirectory = $Dest
$l.Description = 'سیرمان — خدمات پس از فروش'
$l.Save()

$u = $shell.CreateShortcut((Join-Path $startDir 'حذف سیرمان.lnk'))
$u.TargetPath = $unBat
$u.WorkingDirectory = $Dest
$u.Description = 'حذف سالم سیرمان'
$u.Save()

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
