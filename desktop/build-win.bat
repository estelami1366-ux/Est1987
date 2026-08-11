@echo off
setlocal
cd /d "%~dp0Sirman.Desktop"
echo Restoring...
dotnet restore
if errorlevel 1 goto :err
echo Publishing win-x64...
dotnet publish -c Release -r win-x64 --self-contained false -o ..\publish
if errorlevel 1 goto :err
if exist "..\..\Sirman_Final.html" copy /Y "..\..\Sirman_Final.html" "..\publish\Sirman_Final.html" >nul
if exist "..\..\Sirman_Pending_Update.json" copy /Y "..\..\Sirman_Pending_Update.json" "..\publish\Sirman_Pending_Update.json" >nul
if exist "..\Uninstall-Sirman.bat" copy /Y "..\Uninstall-Sirman.bat" "..\publish\Uninstall-Sirman.bat" >nul
if exist ".\Uninstall-Sirman.bat" copy /Y ".\Uninstall-Sirman.bat" "..\publish\Uninstall-Sirman.bat" >nul
echo.
echo OK — run: desktop\publish\Sirman.exe
echo Optional install: desktop\install-sirman.bat
echo Uninstall: Uninstall-Sirman.bat (copied next to EXE)
echo Make sure Sirman_Final.html is next to the EXE.
pause
exit /b 0
:err
echo BUILD FAILED
pause
exit /b 1
