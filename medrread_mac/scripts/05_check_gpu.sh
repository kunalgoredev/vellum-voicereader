#!/bin/bash
cd "$(dirname "$0")/.."
echo "Checking Python..."
python3 --version
echo ""
echo "Activating virtual environment..."
source venv/bin/activate
echo ""
echo "Checking PyTorch and GPU..."
python3 -c "
import torch
print('Torch version:', torch.__version__)
print('CUDA available:', torch.cuda.is_available())
print('MPS available:', torch.backends.mps.is_available())
if torch.cuda.is_available():
    print('CUDA device:', torch.cuda.get_device_name(0))
if torch.backends.mps.is_available():
    print('MPS device: Apple Silicon GPU')
"
