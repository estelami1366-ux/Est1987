@echo off
chcp 65001 >nul
setlocal EnableExtensions
cd /d "%~dp0"

title حذف سیرمان
color 0C

rem اگر از پوشه نصب اجرا شود همان را پاک می‌کند؛ وگرنه از فایل ثبت‌شده می‌خواند
set "INSTALL_DIR=%~dp0"
if "%INSTALL_DIR:~-1%"=="\" set "INSTALL_DIR=%INSTALL_DIR:~0,-1%"
set "APP_ROOT=%LOCALAPPDATA%\Sirman"
set "LOC_FILE=%APP_ROOT%\install-location.txt"
set "START_DIR=%APPDATA%\Microsoft\Windows\Start Menu\Programs\سیرمان"
set "DESKTOP_LNK=%USERPROFILE%\Desktop\سیرمان.lnk"
set "DESKTOP_LNK2=%USERPROFILE%\OneDrive\Desktop\سیرمان.lnk"

if exist "%LOC_FILE%" (
  for /f "usebackq delims=" %%P in ("%LOC_FILE%") do set "SAVED=%%P"
  if defined SAVED if exist "%SAVED%\Sirman.exe" set "INSTALL_DIR=%SAVED%"
)

echo.
echo ===============================================
echo   حذف سالم سیرمان (Uninstall)
echo ===============================================
echo.
echo مسیر نصب:
echo   %INSTALL_DIR%
echo.
choice /C YN /M "حذف سیرمان انجام شود؟"
if errorlevel 2 (
  echo انصراف.
  pause
  exit /b 0
)

echo.
echo [1/4] بستن برنامه...
taskkill /F /IM Sirman.exe >nul 2>&1
timeout /t 1 /nobreak >nul

echo [2/4] حذف میانبرها...
if exist "%START_DIR%" rd /s /q "%START_DIR%" 2>nul
if exist "%DESKTOP_LNK%" del /f /q "%DESKTOP_LNK%" 2>nul
if exist "%DESKTOP_LNK2%" del /f /q "%DESKTOP_LNK2%" 2>nul

echo [3/4] حذف ثبت مسیر نصب...
if exist "%LOC_FILE%" del /f /q "%LOC_FILE%" 2>nul

echo [4/4] حذف پوشه نصب...
cd /d "%TEMP%"
if exist "%INSTALL_DIR%" (
  rd /s /q "%INSTALL_DIR%" 2>nul
  if exist "%INSTALL_DIR%" (
    echo هشدار: بخشی از پوشه حذف نشد — شاید قفل باشد.
  ) else (
    echo پوشه نصب حذف شد.
  )
)

echo.
choice /C YN /M "داده LocalAppData\Sirman هم پاک شود؟"
if errorlevel 2 goto :done
if exist "%APP_ROOT%" rd /s /q "%APP_ROOT%" 2>nul

:done
echo.
echo حذف تمام شد.
pause
exit /b 0
