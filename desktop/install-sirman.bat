@echo off
chcp 65001 >nul
setlocal EnableExtensions
cd /d "%~dp0"

title نصب پکیج سیرمان
color 0B

echo.
echo ===============================================
echo   پکیج نصب سیرمان
echo ===============================================
echo.
echo این نصب‌کننده مسیر نصب را از شما می‌پرسد
echo و فایل‌ها را فقط آنجا کپی می‌کند
echo (کنار پوشه تحویل/سورس نصب نمی‌شود).
echo.

if not exist "%~dp0publish\Sirman.exe" (
  echo [!] Sirman.exe ساخته نشده — اول build-win.bat را اجرا کنید.
  echo.
  choice /C YN /M "الان build اجرا شود؟"
  if errorlevel 2 goto :cancel
  call "%~dp0build-win.bat"
  if not exist "%~dp0publish\Sirman.exe" (
    echo ساخت ناموفق بود.
    pause
    exit /b 1
  )
)

echo باز کردن پنجره انتخاب پوشه...
set "DEST="
for /f "usebackq delims=" %%I in (`powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0install-choose-path.ps1"`) do set "DEST=%%I"
if not defined DEST goto :cancel

echo.
echo مسیر انتخاب‌شده:
echo   %DEST%
echo.
set "DESKTOP=0"
choice /C YN /M "میانبر دسکتاپ هم ساخته شود؟"
if not errorlevel 2 set "DESKTOP=1"

echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0install-package.ps1" -Dest "%DEST%" -SourceRoot "%~dp0" -DesktopShortcut %DESKTOP%
if errorlevel 1 (
  echo نصب ناموفق بود.
  pause
  exit /b 1
)

echo.
echo ===============================================
echo   نصب با موفقیت انجام شد
echo ===============================================
echo مسیر: %DEST%
echo اجرا از منوی Start \ سیرمان
echo حذف: Uninstall-Sirman.bat داخل همان مسیر
echo.
pause
exit /b 0

:cancel
echo نصب لغو شد.
pause
exit /b 0
