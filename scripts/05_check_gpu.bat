@echo off
cd /d "%~dp0.."
echo Checking Python version...
python --version
echo.
echo Checking torch and CUDA...
uv run python -c "import torch; print('Torch version:', torch.__version__); print('CUDA available:', torch.cuda.is_available()); print('CUDA version:', torch.version.cuda if torch.cuda.is_available() else 'N/A'); [print(f'GPU {i}: {torch.cuda.get_device_name(i)}') for i in range(torch.cuda.device_count())]"
if %ERRORLEVEL% neq 0 (
    echo Torch check failed.
    pause
    exit /b 1
)
echo.
pause
