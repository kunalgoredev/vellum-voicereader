@echo off
cd /d "%~dp0.."
echo Starting Local AI Voice Generator...
echo.
echo Open your browser to: http://127.0.0.1:8000
echo.
start http://127.0.0.1:8000
uv run python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
if %ERRORLEVEL% neq 0 (
    echo Application exited with error.
    pause
    exit /b 1
)
pause
