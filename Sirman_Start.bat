@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title Sirman 1405.5.18ζ
color 0A

rem === ALWAYS keep this version equal to the latest Sirman HTML release ===
set "SIRMAN_VERSION=1405.5.18ζ"
set "SIRMAN_HTML=Sirman_Final.html"
set "SIRMAN_HTML_VER=Sirman_Final_%SIRMAN_VERSION%.html"

echo.
echo ===============================================
echo   Sirman Launcher  —  %SIRMAN_VERSION%
echo ===============================================
echo.

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

echo [1/3] Opening %APP_FILE%  (version %SIRMAN_VERSION%) ...
start "" "%~dp0%APP_FILE%"

echo [2/3] Starting local server + notify (optional)...
if exist "%~dp0sirman_run.ps1" (
  start "Sirman-Server-%SIRMAN_VERSION%" /min powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0sirman_run.ps1"
) else (
  echo [WARN] sirman_run.ps1 missing - app still opened as file.
)

echo [3/3] Done.
echo.
echo Browser should show Sirman %SIRMAN_VERSION% now.
echo If a minimized PowerShell window is running, leave it open for notifications.
echo.
echo You can close THIS window.
echo.
pause
endlocal
