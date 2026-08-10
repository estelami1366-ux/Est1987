@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"

echo ===============================================
echo   نصب سیرمان (فاز ۲)
echo ===============================================
echo.

if not exist "%~dp0publish\Sirman.exe" (
  echo ابتدا build-win.bat را اجرا کنید تا publish ساخته شود.
  pause
  exit /b 1
)

set "DEST=%LOCALAPPDATA%\Sirman\App"
mkdir "%DEST%" 2>nul
echo کپی به: %DEST%
xcopy /E /Y /I "%~dp0publish\*" "%DEST%\" >nul
if exist "%~dp0..\Sirman_Final.html" copy /Y "%~dp0..\Sirman_Final.html" "%DEST%\Sirman_Final.html" >nul
if exist "%~dp0..\Sirman_Pending_Update.json" copy /Y "%~dp0..\Sirman_Pending_Update.json" "%DEST%\Sirman_Pending_Update.json" >nul

echo ساخت میانبر منوی Start...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$s=(New-Object -ComObject WScript.Shell); $d=Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs\سیرمان'; New-Item -ItemType Directory -Force -Path $d | Out-Null; $l=$s.CreateShortcut((Join-Path $d 'سیرمان.lnk')); $l.TargetPath=(Join-Path $env:LOCALAPPDATA 'Sirman\App\Sirman.exe'); $l.WorkingDirectory=(Join-Path $env:LOCALAPPDATA 'Sirman\App'); $l.Description='سیرمان'; $l.Save()"

echo.
echo OK
echo اجرا: %DEST%\Sirman.exe
echo میانبر: Start Menu \ سیرمان
echo.
pause
