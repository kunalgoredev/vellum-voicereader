#!/bin/bash
cd "$(dirname "$0")/.."
source venv/bin/activate
if [ $? -ne 0 ]; then
    echo "Virtual environment not found. Run 01_create_venv.sh first."
    exit 1
fi
echo "Starting Local AI Voice Generator..."
echo ""
echo "Open your browser to: http://127.0.0.1:8000"
echo ""
open http://127.0.0.1:8000 2>/dev/null || xdg-open http://127.0.0.1:8000 2>/dev/null || true
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
