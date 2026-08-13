@echo off
chcp 65001 >nul
setlocal EnableExtensions EnableDelayedExpansion
cd /d "%~dp0"

title Sirman Install Package
color 0B

echo.
echo ===============================================
echo   Sirman Install Package
echo ===============================================
echo.
echo This installer asks for an install folder,
echo then copies files ONLY there
echo (not beside this delivery folder).
echo.

set "SRC=%~dp0"
if "%SRC:~-1%"=="\" set "SRC=%SRC:~0,-1%"

if not exist "%SRC%\publish\Sirman.exe" (
  echo [!] Sirman.exe not built yet. Run build-win.bat first.
  echo.
  choice /C YN /M "Run build-win.bat now"
  if errorlevel 2 goto :cancel
  call "%SRC%\build-win.bat"
  if not exist "%SRC%\publish\Sirman.exe" (
    echo Build failed.
    pause
    exit /b 1
  )
)

echo Opening folder picker...
set "DEST="
for /f "usebackq delims=" %%I in (`powershell -NoProfile -STA -ExecutionPolicy Bypass -Command "Add-Type -AssemblyName System.Windows.Forms; $d=New-Object System.Windows.Forms.FolderBrowserDialog; $d.Description='Choose Sirman install folder (example D:\\Sirman)'; $d.ShowNewFolderButton=$true; $s=Join-Path ([Environment]::GetFolderPath('MyDocuments')) 'Sirman'; try{New-Item -ItemType Directory -Force -Path $s|Out-Null; $d.SelectedPath=$s}catch{}; $lf=Join-Path $env:LOCALAPPDATA 'Sirman\\install-location.txt'; if(Test-Path -LiteralPath $lf){ try{ $p=(Get-Content -LiteralPath $lf -Raw).Trim(); if($p -and (Test-Path -LiteralPath $p)){$d.SelectedPath=$p} }catch{} }; if($d.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK){ [Console]::Write($d.SelectedPath) }"`) do set "DEST=%%I"

if not defined DEST goto :cancel

rem If user picked a drive root, use \Sirman under it
if /I "%DEST:~-1%"==":" set "DEST=%DEST%\Sirman"
if /I "%DEST:~-2%"==":\" set "DEST=%DEST%Sirman"

echo.
echo Install path:
echo   %DEST%
echo.
set "MAKE_DESKTOP=0"
choice /C YN /M "Also create Desktop shortcut"
if not errorlevel 2 set "MAKE_DESKTOP=1"

echo.
echo Installing...
mkdir "%DEST%" 2>nul
if not exist "%DEST%\" (
  echo Cannot create folder: %DEST%
  pause
  exit /b 1
)

xcopy /E /Y /I /Q "%SRC%\publish\*" "%DEST%\" >nul
if errorlevel 1 (
  echo Copy from publish failed.
  pause
  exit /b 1
)

if exist "%SRC%\Sirman_Final.html" copy /Y "%SRC%\Sirman_Final.html" "%DEST%\Sirman_Final.html" >nul
if exist "%SRC%\Sirman_Pending_Update.json" copy /Y "%SRC%\Sirman_Pending_Update.json" "%DEST%\Sirman_Pending_Update.json" >nul
if exist "%SRC%\Uninstall-Sirman.bat" copy /Y "%SRC%\Uninstall-Sirman.bat" "%DEST%\Uninstall-Sirman.bat" >nul

if exist "%SRC%\updates" (
  mkdir "%DEST%\updates" 2>nul
  xcopy /Y /I /Q "%SRC%\updates\*.json" "%DEST%\updates\" >nul 2>nul
)

if not exist "%DEST%\Sirman.exe" (
  echo Sirman.exe missing after copy.
  pause
  exit /b 1
)

rem Remember install location
mkdir "%LOCALAPPDATA%\Sirman" 2>nul
> "%LOCALAPPDATA%\Sirman\install-location.txt" echo %DEST%

rem Shortcuts via short ASCII-only PowerShell (paths from env)
set "SIRMAN_DEST=%DEST%"
set "SIRMAN_EXE=%DEST%\Sirman.exe"
set "SIRMAN_UN=%DEST%\Uninstall-Sirman.bat"
set "SIRMAN_DESKTOP=%MAKE_DESKTOP%"

powershell -NoProfile -ExecutionPolicy Bypass -Command "$dest=$env:SIRMAN_DEST; $exe=$env:SIRMAN_EXE; $un=$env:SIRMAN_UN; $desk=$env:SIRMAN_DESKTOP; $sh=New-Object -ComObject WScript.Shell; $dir=Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs\Sirman'; New-Item -ItemType Directory -Force -Path $dir | Out-Null; $l=$sh.CreateShortcut((Join-Path $dir 'Sirman.lnk')); $l.TargetPath=$exe; $l.WorkingDirectory=$dest; $l.Description='Sirman'; $l.Save(); if(Test-Path -LiteralPath $un){ $u=$sh.CreateShortcut((Join-Path $dir 'Uninstall Sirman.lnk')); $u.TargetPath=$un; $u.WorkingDirectory=$dest; $u.Description='Uninstall Sirman'; $u.Save() }; if($desk -eq '1'){ $dd=[Environment]::GetFolderPath('DesktopDirectory'); $d=$sh.CreateShortcut((Join-Path $dd 'Sirman.lnk')); $d.TargetPath=$exe; $d.WorkingDirectory=$dest; $d.Description='Sirman'; $d.Save() }"
if errorlevel 1 (
  echo WARNING: shortcuts may have failed, but files were copied.
)

echo.
echo ===============================================
echo   Install completed
echo ===============================================
echo Path: %DEST%
echo Run:  Start Menu \ Sirman
echo Uninstall: %DEST%\Uninstall-Sirman.bat
echo.
pause
exit /b 0

:cancel
echo Install cancelled.
pause
exit /b 0
