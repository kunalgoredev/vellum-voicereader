#!/bin/bash
cd "$(dirname "$0")/.."
echo "Downloading Kokoro TTS model..."
source venv/bin/activate
python scripts/download_kokoro_model.py
if [ $? -ne 0 ]; then
    echo "Model download failed or skipped (auto-downloads on first use)."
fi
echo ""
echo "Done. Run: bash scripts/04_start_app.sh"
