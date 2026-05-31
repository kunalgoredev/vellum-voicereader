#!/bin/bash
cd "$(dirname "$0")/.."
echo "Creating Python virtual environment..."
python3 -m venv venv
if [ $? -ne 0 ]; then
    echo "Failed to create virtual environment."
    echo "Make sure Python 3.11+ is installed."
    exit 1
fi
echo "Virtual environment created successfully."
echo ""
echo "Next step: bash scripts/02_install_requirements.sh"
