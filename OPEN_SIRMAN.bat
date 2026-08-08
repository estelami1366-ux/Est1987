@echo off
cd /d "%~dp0"
if exist "%~dp0Sirman_Final.html" (
  start "" "%~dp0Sirman_Final.html"
) else (
  echo Sirman_Final.html not found
  pause
)
