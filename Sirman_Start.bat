@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title Sirman 1405.5.23γ
color 0A

rem === ALWAYS keep this version equal to the latest Sirman HTML release ===
set "SIRMAN_VERSION=1405.5.23γ"
set "SIRMAN_HTML=Sirman_Final.html"
set "SIRMAN_HTML_VER=Sirman_Final_%SIRMAN_VERSION%.html"

echo.
echo ===============================================
echo   Sirman Launcher  —  %SIRMAN_VERSION%
echo ===============================================
echo.

echo [0/3] Checking pending full update ...
if exist "%~dp0apply_sirman_update.ps1" (
  powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0apply_sirman_update.ps1"
) else (
  echo [WARN] apply_sirman_update.ps1 missing - skip auto update.
)

if exist "%~dp0%SIRMAN_HTML%" (
  set "APP_FILE=%SIRMAN_HTML%"
) else if exist "%~dp0%SIRMAN_HTML_VER%" (
  set "APP_FILE=%SIRMAN_HTML_VER%"
) else (
  echo [ERROR] App HTML not found next to this BAT.
  echo Expected: %SIRMAN_HTML%  or  %SIRMAN_HTML_VER%
  echo Folder: %~dp0
  echo.
  pause
  exit /b 1
)

echo [1/3] Starting local server + notify + browser (http)...
if exist "%~dp0sirman_run.ps1" (
  start "Sirman-Server-%SIRMAN_VERSION%" /min powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0sirman_run.ps1"
) else (
  echo [WARN] sirman_run.ps1 missing - opening file directly.
  start "" "%~dp0%APP_FILE%"
)

echo [2/3] Done.
echo.
echo Browser should open http://127.0.0.1:8765/%APP_FILE%
echo Leave the minimized PowerShell window open for notifications + stable settings.
echo Close Sirman with the RED X inside the app (asks backup). Do not rely on Windows title-bar X.
echo.
echo For Start/Desktop shortcuts: run  نصب_میانبر_سیرمان.bat  once.
echo.
echo Mass update: put Sirman_Pending_Update.json next to this BAT, then run Start.
echo.
echo You can close THIS window.
echo.
pause
endlocal
