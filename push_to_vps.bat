@echo off
REM ==============================================================================
REM CODENUSA SAAS - ONE-CLICK PREPARATION, GIT PUSH & VPS DEPLOYMENT
REM ==============================================================================

echo [CODENUSA] Menjalankan Pipeline Persiapan dan Push ke VPS (/var/www/codenusa)...
node scripts/prepare_and_push_vps.js %*

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] Pipeline gagal. Silakan periksa pesan error di atas.
    exit /b %ERRORLEVEL%
)

echo.
echo [CODENUSA] Proses selesai dengan sukses!
