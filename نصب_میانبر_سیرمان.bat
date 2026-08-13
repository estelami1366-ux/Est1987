@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title Sirman Install Shortcuts
echo.
echo ===============================================
echo   Sirman — نصب میانبر (جایگزین منوی نصب .NET)
echo ===============================================
echo.
echo  [1] نصب در این کاربر + میانبر Start
echo  [2] نصب + میانبر Start و دسکتاپ   (پیشنهادی)
echo  [3] باز کردن پوشه برنامه
echo  [4] باز کردن پوشه میانبر Start
echo  [0] انصراف
echo.
set /p CHOICE=انتخاب (1-4): 
if "%CHOICE%"=="1" (
  powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Sirman_Install_Shortcuts.ps1" -Mode user-start
) else if "%CHOICE%"=="2" (
  powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Sirman_Install_Shortcuts.ps1" -Mode user-start-desktop
) else if "%CHOICE%"=="3" (
  powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Sirman_Install_Shortcuts.ps1" -Mode open-install
) else if "%CHOICE%"=="4" (
  powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Sirman_Install_Shortcuts.ps1" -Mode open-start-folder
) else (
  echo Cancelled.
)
echo.
pause
endlocal
