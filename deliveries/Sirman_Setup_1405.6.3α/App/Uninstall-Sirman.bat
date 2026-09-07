@echo off
chcp 65001 >nul
setlocal EnableExtensions
cd /d "%~dp0"
title SIRMAN Uninstall (Level 1)
color 0C
echo.
echo SIRMAN Level 1 uninstall
echo Removes this program copy and installer shortcuts.
echo Does NOT delete WebView2 business data or backups.
echo.
set "PS1=%~dp0Uninstall-Sirman.ps1"
if not exist "%PS1%" (
  echo [ERROR] Uninstall-Sirman.ps1 missing.
  echo Level 1 will not guess another install folder.
  pause
  exit /b 1
)
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%PS1%" -Mode Level1
endlocal
