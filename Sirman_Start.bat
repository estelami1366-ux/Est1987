@echo off
setlocal EnableExtensions
cd /d "%~dp0"

title Sirman Launcher
echo.
echo ====================================================
echo   Sirman - Local server + Windows notifications
echo ====================================================
echo.

set "LATEST="
if exist "Sirman_Final.html" set "LATEST=Sirman_Final.html"
if not defined LATEST if exist "Laegh_Final.html" set "LATEST=Laegh_Final.html"

if not defined LATEST (
  for /f "delims=" %%F in ('dir /b /a-d /o-d Sirman_Final_*.html 2^>nul') do (
    set "LATEST=%%F"
    goto :have_file
  )
)
if not defined LATEST (
  for /f "delims=" %%F in ('dir /b /a-d /o-d Laegh_Final_*.html 2^>nul') do (
    set "LATEST=%%F"
    goto :have_file
  )
)

:have_file
if not defined LATEST (
  echo [ERROR] No Sirman_Final.html found in:
  echo   %CD%
  echo.
  pause
  exit /b 1
)

echo [OK] App file: %LATEST%
echo.

set "PORT=8765"
set "URL=http://127.0.0.1:%PORT%/%LATEST%"

REM Notify bridge (optional, non-blocking)
if exist "%~dp0sirman_notify.ps1" (
  echo [OK] Starting notify bridge...
  start "Sirman-Notify" /min powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0sirman_notify.ps1"
) else (
  echo [WARN] sirman_notify.ps1 not found.
)

echo.
echo Browser will open:
echo   %URL%
echo.
echo Keep this window open. Close it to stop the server.
echo.

REM Open browser after 2 seconds
start "" cmd /c "timeout /t 2 /nobreak >nul & start %URL%"

REM Prefer PowerShell server script (works without Python)
if exist "%~dp0sirman_server.ps1" (
  echo [OK] Starting PowerShell server on port %PORT%...
  powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0sirman_server.ps1" -Port %PORT% -DefaultFile "%LATEST%" -Root "%CD%"
  goto :done
)

REM Fallback: Python
where python >nul 2>&1
if %ERRORLEVEL%==0 (
  echo [OK] Starting Python server on port %PORT%...
  python -m http.server %PORT%
  goto :done
)

where py >nul 2>&1
if %ERRORLEVEL%==0 (
  echo [OK] Starting Python server on port %PORT%...
  py -m http.server %PORT%
  goto :done
)

echo [ERROR] Cannot start server.
echo Need PowerShell script sirman_server.ps1 OR Python installed.
echo.
echo As emergency fallback, opening the HTML file directly...
start "" "%LATEST%"
pause
exit /b 1

:done
echo.
echo Server stopped.
pause
endlocal
