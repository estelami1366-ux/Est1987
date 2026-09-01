@echo off
chcp 65001 >nul
setlocal EnableExtensions
cd /d "%~dp0"
title SIRMAN Full Cleanup (Level 2)
color 0C
echo.
echo SIRMAN Full Cleanup is NOT normal uninstall.
echo Business data will be listed. Deletion requires typing: تایید
echo.
set "PS1=%~dp0Uninstall-Sirman.ps1"
if not exist "%PS1%" (
  echo [ERROR] Uninstall-Sirman.ps1 missing.
  echo Full Cleanup will not run.
  pause
  exit /b 1
)
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%PS1%" -Mode Level2
endlocal
