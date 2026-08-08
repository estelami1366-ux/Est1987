@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo.
echo ====================================================
echo   سیرمان — سیستم خدمات پس از فروش
echo   اجرای سرور محلی + پل اعلان ویندوز
echo ====================================================
echo.

REM یافتن آخرین نسخه: اول Sirman_Final_*.html سپس Laegh_Final_*.html
set "LATEST="
for /f "delims=" %%F in ('dir /b /o-d Sirman_Final_*.html 2^>nul') do (
  set "LATEST=%%F"
  goto :found
)
for /f "delims=" %%F in ('dir /b /o-d Laegh_Final_*.html 2^>nul') do (
  set "LATEST=%%F"
  goto :found
)
if exist "Sirman_Final.html" (
  set "LATEST=Sirman_Final.html"
  goto :found
)
if exist "Laegh_Final.html" (
  set "LATEST=Laegh_Final.html"
  goto :found
)

:found
if not defined LATEST (
  echo ❌ هیچ فایل Sirman_Final_*.html یا Laegh_Final_*.html پیدا نشد.
  cd
  echo.
  pause
  exit /b 1
)

echo ✅ فایل برنامه: %LATEST%
echo.

REM پل اعلان ویندوز (مرکز اعلان‌ها) روی پورت 8766
if exist "%~dp0اعلان_سیرمان.ps1" (
  echo 🔔 راه‌اندازی پل اعلان ویندوز...
  start "Sirman-Notify" /min powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0اعلان_سیرمان.ps1"
) else (
  echo ⚠ فایل اعلان_سیرمان.ps1 پیدا نشد — فقط اعلان مرورگر فعال می‌ماند.
)

echo مرورگر بعد از ۲ ثانیه باز می‌شود...
echo برای خاموش کردن سرور، این پنجره را ببندید.
echo.

start /b "" cmd /c "timeout /t 2 /nobreak >nul & start http://localhost:8765/%LATEST%"

where python >nul 2>&1
if %ERRORLEVEL%==0 (
  python -m http.server 8765
) else (
  where py >nul 2>&1
  if %ERRORLEVEL%==0 (
    py -m http.server 8765
  ) else (
    echo ❌ Python پیدا نشد. لطفاً Python را نصب کنید یا فایل HTML را مستقیم باز کنید.
    pause
    exit /b 1
  )
)

pause
