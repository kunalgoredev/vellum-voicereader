#!/bin/bash
cd "$(dirname "$0")/.."
echo "Activating virtual environment..."
source venv/bin/activate
if [ $? -ne 0 ]; then
    echo "Failed to activate. Run 01_create_venv.sh first."
    exit 1
fi
echo "Installing requirements..."
pip install --upgrade pip
pip install -r requirements.txt
if [ $? -ne 0 ]; then
    echo "Failed to install requirements."
    exit 1
fi
echo "Requirements installed successfully."
echo ""
echo "Next step: bash scripts/04_start_app.sh"
