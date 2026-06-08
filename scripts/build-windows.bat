@echo off
cd /d "%~dp0.."

echo ========================================
echo  Opus Voice Studio — Windows Build
echo ========================================
echo.

REM 1. Install npm deps if missing
if not exist "node_modules" (
    echo [1/4] Installing Node dependencies...
    call npm install
    if errorlevel 1 ( echo FAILED & pause & exit /b 1 )
) else (
    echo [1/4] Node modules OK
)

REM 2. Bundle Python + uv runtime
echo [2/4] Bundling Python runtime for Windows...
node scripts\bundle_runtime.js --win
if errorlevel 1 ( echo FAILED & pause & exit /b 1 )

REM 3. Build Electron installer
echo [3/4] Building Windows installer...
call npm run build:win
if errorlevel 1 ( echo FAILED & pause & exit /b 1 )

echo.
echo [4/4] BUILD COMPLETE
echo ========================================
echo Output: dist\Vellum Setup 1.0.0.exe
echo ========================================
