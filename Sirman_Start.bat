@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title Sirman
color 0A

echo.
echo ===============================================
echo   Sirman Launcher
echo ===============================================
echo.

if not exist "%~dp0Sirman_Final.html" (
  echo [ERROR] Sirman_Final.html not found next to this BAT.
  echo Folder: %~dp0
  echo.
  pause
  exit /b 1
)

echo [1/3] Opening app in browser...
start "" "%~dp0Sirman_Final.html"

echo [2/3] Starting local server + notify (optional)...
if exist "%~dp0sirman_run.ps1" (
  start "Sirman-Server" /min powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0sirman_run.ps1"
) else (
  echo [WARN] sirman_run.ps1 missing - app still opened as file.
)

echo [3/3] Done.
echo.
echo Browser should show Sirman now.
echo If a minimized PowerShell window is running, leave it open for notifications.
echo.
echo You can close THIS window.
echo.
pause
endlocal
