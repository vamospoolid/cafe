@echo off
title CodePOS Bengkel Motor & Mobil Standalone
echo ========================================================
echo    MEMULAI CODEPOS BENGKEL STANDALONE OFFLINE
echo    Database: %APPDATA%\CodePOS_BENGKEL\data\app.db
echo ========================================================
echo.
start "" "%~dp0release\desktop\bengkel\win-unpacked\CodePOS Bengkel Motor & Mobil.exe"
exit
