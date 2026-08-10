@echo off
cd /d "%~dp0"
rem Keep in sync with Sirman_Start.bat / latest HTML version
set "SIRMAN_VERSION=1405.5.19γ"
if exist "%~dp0apply_sirman_update.ps1" (
  powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0apply_sirman_update.ps1"
)
if exist "%~dp0Sirman_Final.html" (
  start "" "%~dp0Sirman_Final.html"
) else if exist "%~dp0Sirman_Final_%SIRMAN_VERSION%.html" (
  start "" "%~dp0Sirman_Final_%SIRMAN_VERSION%.html"
) else (
  echo Sirman HTML not found — expected Sirman_Final.html ^(v%SIRMAN_VERSION%^)
  pause
)
