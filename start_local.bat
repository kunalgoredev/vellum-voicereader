@echo off
cd /d "%~dp0"
if not exist venv (
    uv venv --python 3.11
    if errorlevel 1 exit /b 1
    uv pip install -r requirements.txt
    if errorlevel 1 exit /b 1
)
uv run python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
pause
