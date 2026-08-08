@echo off
chcp 65001 >nul
cd /d "%~dp0"
REM میانبر سازگاری با نام قدیمی — همان اجرای سیرمان
call "%~dp0اجرای سیرمان.bat"
