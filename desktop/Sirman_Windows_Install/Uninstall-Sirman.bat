@echo off
chcp 65001 >nul
setlocal EnableExtensions
cd /d "%~dp0"

title حذف سیرمان
color 0C

set "INSTALL_DIR=%LOCALAPPDATA%\Sirman\App"
set "APP_ROOT=%LOCALAPPDATA%\Sirman"
set "START_DIR=%APPDATA%\Microsoft\Windows\Start Menu\Programs\سیرمان"
set "DESKTOP_LNK=%USERPROFILE%\Desktop\سیرمان.lnk"
set "DESKTOP_LNK2=%USERPROFILE%\OneDrive\Desktop\سیرمان.lnk"

echo.
echo ===============================================
echo   حذف سالم سیرمان (Uninstall)
echo ===============================================
echo.
echo این کار انجام می‌شود:
echo   - بستن Sirman.exe در صورت اجرا
echo   - حذف میانبر Start و دسکتاپ
echo   - حذف پوشه نصب: %INSTALL_DIR%
echo.
echo داده بک‌آپ و تنظیمات در صورت تمایل جداگانه پرسیده می‌شود.
echo.

choice /C YN /M "حذف سیرمان انجام شود؟"
if errorlevel 2 (
  echo انصراف.
  pause
  exit /b 0
)

echo.
echo [1/4] بستن برنامه در صورت اجرا...
taskkill /F /IM Sirman.exe >nul 2>&1
timeout /t 1 /nobreak >nul

echo [2/4] حذف میانبرها...
if exist "%START_DIR%" rd /s /q "%START_DIR%" 2>nul
if exist "%DESKTOP_LNK%" del /f /q "%DESKTOP_LNK%" 2>nul
if exist "%DESKTOP_LNK2%" del /f /q "%DESKTOP_LNK2%" 2>nul

echo [3/4] حذف پوشه نصب برنامه...
if exist "%INSTALL_DIR%" (
  rd /s /q "%INSTALL_DIR%" 2>nul
  if exist "%INSTALL_DIR%" (
    echo هشدار: بخشی از پوشه نصب حذف نشد — شاید فایل قفل باشد.
  ) else (
    echo پوشه نصب حذف شد.
  )
) else (
  echo پوشه نصب از قبل نبود.
)

echo.
choice /C YN /M "تنظیمات/کش WebView2 و داده LocalAppData\Sirman هم پاک شود؟ (بک‌آپ‌های پیش‌فرض هم می‌روند)"
if errorlevel 2 goto :skip_data

echo [4/4] حذف داده کاربر...
if exist "%APP_ROOT%" (
  rd /s /q "%APP_ROOT%" 2>nul
  if exist "%APP_ROOT%" (
    echo هشدار: بخشی از داده کاربر حذف نشد.
  ) else (
    echo داده کاربر حذف شد.
  )
) else (
  echo داده کاربر از قبل نبود.
)
goto :done

:skip_data
echo [4/4] داده کاربر نگه داشته شد.
rem اگر فقط App خالی ماند، ریشه را اگر خالی است پاک نکن — بک‌آپ ممکن است باشد

:done
echo.
echo ===============================================
echo   حذف تمام شد
echo ===============================================
echo.
echo اگر بک‌آپ جداگانه دارید، دست نخورده است.
echo این پنجره را ببندید.
pause
exit /b 0
