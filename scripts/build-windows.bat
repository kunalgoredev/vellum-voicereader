@echo off
cd /d "%~dp0.."

echo ========================================
echo  Vellum Voice Studio — Windows Build
echo ========================================
echo.

REM 1. Check for Python
where python >nul 2>nul
if errorlevel 1 (
    echo ERROR: Python is required. Install Python 3.11 from https://python.org
    pause & exit /b 1
)

REM 2. Bundle Python runtime, uv, and Node.js
echo [1/3] Bundling runtime + build dependencies...
python scripts\bundle_runtime.py --win
if errorlevel 1 ( echo FAILED & pause & exit /b 1 )

REM Add bundled Node.js to PATH
set "NODE_DIR=%~dp0..\resources\node"
if exist "%NODE_DIR%\node.exe" (
    set "PATH=%NODE_DIR%;%PATH%"
) else (
    echo ERROR: Node.js not found in resources\node. Run bundle_runtime.py first.
    pause & exit /b 1
)

REM 3. Install npm deps if missing
if not exist "node_modules" (
    echo [2/3] Installing Node dependencies...
    call npm install
    if errorlevel 1 ( echo FAILED & pause & exit /b 1 )
) else (
    echo [2/3] Node modules OK
)

REM 4. Build Electron installer
echo [3/3] Building Windows installer...
call npm run build:win
if errorlevel 1 ( echo FAILED & pause & exit /b 1 )

echo.
echo ========================================
echo  BUILD COMPLETE
echo ========================================
echo  Output: dist\Vellum Setup 1.0.0.exe
echo ========================================
pause
