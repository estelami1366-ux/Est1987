@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"
title Sirman Setup
color 0B
echo.
echo  Sirman — نصب کامل
echo  فایل‌ها را کپی‌پیست نکنید. همین فایل نصب را بزنید.
echo.
if not exist "%~dp0install-setup.ps1" (
  echo [ERROR] install-setup.ps1 missing
  pause
  exit /b 1
)
powershell.exe -NoProfile -STA -ExecutionPolicy Bypass -File "%~dp0install-setup.ps1"
endlocal
