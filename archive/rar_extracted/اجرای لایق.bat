@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo.
echo ====================================================
echo   Laegh Electronic Parsian - Local Server
echo ====================================================
echo.
echo مرورگر خودکار باز می‌شود...
echo برای خاموش کردن سرور، این پنجره را ببندید.
echo.
start "" "http://localhost:8765/"
python -m http.server 8765
pause
