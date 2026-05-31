@echo off
cd /d "%~dp0.."
echo Installing requirements with uv...
uv pip install -r requirements.txt
if %ERRORLEVEL% neq 0 (
    echo Failed to install requirements.
    pause
    exit /b 1
)
echo Requirements installed successfully.
echo.
echo Next step: run scripts\04_start_app.bat
pause
