@echo off
chcp 65001 >nul
cd /d "%~dp0"
rem نام فارسی برای ارائه پکیج — همان نصب مسیرپرس
call "%~dp0install-sirman.bat"
