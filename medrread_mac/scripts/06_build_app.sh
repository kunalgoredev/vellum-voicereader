#!/bin/bash
cd "$(dirname "$0")/.."
source venv/bin/activate
echo "Building standalone macOS app..."
pip install py2app
python setup.py py2app
echo "App bundle created in dist/ directory"
