@echo off
cd /d "%~dp0"
rem Keep in sync with Sirman_Start.bat / latest HTML version
set "SIRMAN_VERSION=1405.5.18δ"
if exist "%~dp0Sirman_Final.html" (
  start "" "%~dp0Sirman_Final.html"
) else if exist "%~dp0Sirman_Final_%SIRMAN_VERSION%.html" (
  start "" "%~dp0Sirman_Final_%SIRMAN_VERSION%.html"
) else (
  echo Sirman HTML not found — expected Sirman_Final.html ^(v%SIRMAN_VERSION%^)
  pause
)
