@echo off
title Generator APK Branded Multi-Tenant - Codenusa POS
color 0B
cls
echo ================================================================
echo   GENERATOR APK ANDROID MULTI-TENANT DENGAN LOGO KUSTOM
echo ================================================================
echo.
echo Pilihan Target Build:
echo  1. Build Semua APK (Kasir Tablet & Portal Staf)
echo  2. Hanya Build APK Kasir & Tablet POS
echo  3. Hanya Build APK Portal Staf & Absensi
echo.
set /p targetChoice="Pilih nomor target [1/2/3] (default: 1): "

if "%targetChoice%"=="2" (
    set TARGET_ARG=cashier
) else if "%targetChoice%"=="3" (
    set TARGET_ARG=staff
) else (
    set TARGET_ARG=all
)

echo.
node scripts\generate_branded_apk.js --target=%TARGET_ARG%
echo.
pause
