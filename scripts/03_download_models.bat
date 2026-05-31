@echo off
cd /d "%~dp0.."
echo.
echo ====================================
echo  Model Download Helper
echo ====================================
echo.
echo 1 - Kokoro model (~300MB, required for Kokoro TTS)
echo 2 - Quit (models auto-download on first use)
echo.
set /p choice="Enter choice (1/2): "

if "%choice%"=="1" goto kokoro
if "%choice%"=="2" goto end
echo Invalid choice.
pause
exit /b 1

:kokoro
echo.
echo Downloading Kokoro model...
uv run python scripts\download_kokoro_model.py
if %ERRORLEVEL% neq 0 (
    echo Kokoro download failed.
    pause
    exit /b 1
)
goto end

:end
echo.
echo Done. Run scripts\04_start_app.bat to start.
pause
