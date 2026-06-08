#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."

echo ""
echo "========================================"
echo " Opus Voice Studio — macOS Build"
echo "========================================"
echo ""

# 1. Install npm deps if missing
if [ ! -d "node_modules" ]; then
    echo "[1/4] Installing Node dependencies..."
    npm install
fi

# 2. Bundle Python runtime for macOS
echo "[2/4] Bundling Python runtime for macOS..."
node scripts/bundle_runtime.js --mac

# 3. Build Electron DMG
echo "[3/4] Building macOS DMG..."
npm run build:mac

echo ""
echo "[4/4] BUILD COMPLETE"
echo "========================================"
echo "Output: dist/Vellum-1.0.0.dmg"
echo "========================================"
