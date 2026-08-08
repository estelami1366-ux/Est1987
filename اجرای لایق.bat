@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo.
echo ====================================================
echo   Laegh Electronic Parsian — اجرای نرم‌افزار
echo   نسخه ۱۰.۴.۲۶
echo ====================================================
echo.

REM یافتن آخرین نسخه‌ی فایل Laegh_Final_*.html در پوشه (جدیدترین بر اساس تاریخ)
set "LATEST="
for /f "delims=" %%F in ('dir /b /o-d Laegh_Final_*.html 2^>nul') do (
  set "LATEST=%%F"
  goto :found
)
:found

if not defined LATEST (
  echo ❌ هیچ فایل Laegh_Final_*.html پیدا نشد.
  echo مطمئن شو فایل در همین پوشه است:
  cd
  echo.
  pause
  exit /b 1
)

echo ✅ آخرین نسخه پیدا شد: %LATEST%
echo.
echo مرورگر بعد از ۲ ثانیه باز می‌شود...
echo برای خاموش کردن سرور، این پنجره را ببندید.
echo.

REM باز کردن مرورگر بعد از ۲ ثانیه در یک پردازش جداگانه
start /b "" cmd /c "timeout /t 2 /nobreak >nul & start http://localhost:8765/%LATEST%"

REM شروع سرور (مسدود می‌ماند تا کاربر پنجره را نبندد)
python -m http.server 8765

pause
