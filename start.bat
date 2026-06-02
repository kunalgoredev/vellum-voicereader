@echo off
cd /d "%~dp0"

echo.
echo ========================================
echo  Vellum Voice Reader - Setup ^& Start
echo ========================================
echo.

REM --- Step 1: venv ---
if not exist .venv (
    echo [1/3] Creating virtual environment...
    uv venv --python 3.11
    if errorlevel 1 ( echo FAILED: venv creation & pause & exit /b 1 )
    echo [1/3] Installing dependencies...
    uv pip install -r requirements.txt
    if errorlevel 1 ( echo FAILED: dependency install & pause & exit /b 1 )
) else (
    echo [1/3] Virtual environment OK
)

REM --- Step 2: Remove old corrupt model file if present ---
if exist "models\kokoro\kokoro-v0_19.pth" (
    del /f /q "models\kokoro\kokoro-v0_19.pth"
    echo [2/3] Removed old kokoro-v0_19.pth
)

REM --- Step 2: Download kokoro model if missing ---
if not exist "models\kokoro\kokoro-v1_0.pth" (
    echo [2/3] Downloading Kokoro model ~310MB - this may take a few minutes...
    echo.
    uv run python scripts\download_kokoro_model.py
    if errorlevel 1 ( echo FAILED: model download & pause & exit /b 1 )
    echo.
    echo [2/3] Model downloaded OK
) else (
    echo [2/3] Kokoro model already present
)

REM --- Step 3: Start server ---
echo [3/3] Starting server at http://0.0.0.0:7070
echo.
uv run python -m uvicorn app.main:app --host 0.0.0.0 --port 7070 --reload
pause