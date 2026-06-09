#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."

echo ""
echo "========================================"
echo " Vellum Voice Studio — macOS Build"
echo "========================================"
echo ""

# 1. Check for Python
if ! command -v python3 &>/dev/null; then
    echo "ERROR: Python 3 is required. Install via: brew install python@3.11"
    exit 1
fi

# 2. Bundle Python runtime, uv, and Node.js
echo "[1/3] Bundling runtime + build dependencies..."
python3 scripts/bundle_runtime.py --mac

# Add bundled Node.js to PATH
NODE_DIR="$SCRIPT_DIR/../resources/node"
if [ -f "$NODE_DIR/bin/node" ]; then
    export PATH="$NODE_DIR/bin:$PATH"
else
    echo "ERROR: Node.js not found in resources/node. Run bundle_runtime.py first."
    exit 1
fi

# 3. Install npm deps if missing
if [ ! -d "node_modules" ]; then
    echo "[2/3] Installing Node dependencies..."
    npm install
fi

# 4. Build Electron DMG
echo "[3/3] Building macOS DMG..."
npm run build:mac

echo ""
echo "========================================"
echo "  BUILD COMPLETE"
echo "========================================"
echo "  Output: dist/Vellum-1.0.0.dmg"
echo "========================================"
