@echo off
cd /d "%~dp0.."
echo Deleting old virtual environment if it exists...
if exist venv rmdir /s /q venv
echo Creating virtual environment with Python 3.11...
uv venv --python 3.11
if %ERRORLEVEL% neq 0 (
    echo Failed to create virtual environment.
    echo Trying without specific Python version...
    uv venv
    if %ERRORLEVEL% neq 0 (
        echo Failed to create virtual environment.
        pause
        exit /b 1
    )
)
echo Virtual environment created successfully.
echo.
echo Next step: run scripts\02_install_requirements.bat
pause
