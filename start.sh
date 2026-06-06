#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
#  Vellum Voice Studio — macOS / Linux launcher
#  Run once to install, then again any time to launch.
#  Requirements: Python 3.9+  (brew install python@3.12)
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

VENV="$SCRIPT_DIR/.venv"
PORT=8000

echo ""
echo "  ┌───────────────────────────────────┐"
echo "  │        Vellum Voice Studio        │"
echo "  └───────────────────────────────────┘"
echo ""

# ── 1. Find tooling ──────────────────────────────────────────────────────────
UV_BIN=""
PYTHON_BIN=""

if command -v uv &>/dev/null; then
  UV_BIN="$(command -v uv)"
  echo "  ✓ uv found: $UV_BIN"
fi

if [ -z "$UV_BIN" ]; then
  for cmd in python3.13 python3.12 python3.11 python3.10 python3.9 python3; do
    if command -v "$cmd" &>/dev/null; then
      ok=$("$cmd" -c "import sys; print(sys.version_info >= (3,9,0))" 2>/dev/null || echo False)
      if [ "$ok" = "True" ]; then
        PYTHON_BIN="$(command -v "$cmd")"
        echo "  ✓ Python: $("$PYTHON_BIN" --version)"
        break
      fi
    fi
  done

  if [ -z "$PYTHON_BIN" ]; then
    echo ""
    echo "  ✗ Python 3.9+ not found."
    echo "    Mac:   brew install python@3.12"
    echo "    Linux: sudo apt install python3.12 python3.12-venv"
    echo ""
    exit 1
  fi
fi

# ── 2. Virtual environment ───────────────────────────────────────────────────
if [ ! -f "$VENV/bin/python3" ]; then
  echo "  → Creating virtual environment…"
  if [ -n "$UV_BIN" ]; then
    "$UV_BIN" venv "$VENV" --python 3.11 2>/dev/null || \
    "$UV_BIN" venv "$VENV"
  else
    "$PYTHON_BIN" -m venv "$VENV"
  fi
  echo "  ✓ Environment created"
fi

VENV_PYTHON="$VENV/bin/python3"

# ── 3. Install / update dependencies ────────────────────────────────────────
SENTINEL="$VENV/.deps_installed"
if [ ! -f "$SENTINEL" ]; then
  echo "  → Installing dependencies (first run — ~3 min)…"
  if [ -n "$UV_BIN" ]; then
    if [ -f "$SCRIPT_DIR/requirements-lock.txt" ]; then
      "$UV_BIN" pip install -r "$SCRIPT_DIR/requirements-lock.txt" --python "$VENV_PYTHON" --quiet
    else
      "$UV_BIN" pip install -r requirements.txt --python "$VENV_PYTHON" --quiet
    fi
  else
    "$VENV_PYTHON" -m pip install --upgrade pip --quiet
    "$VENV_PYTHON" -m pip install -r requirements.txt --quiet
  fi
  touch "$SENTINEL"
  echo "  ✓ Dependencies installed"
else
  echo "  ✓ Dependencies OK"
fi

# ── 4. Remove old corrupted model ────────────────────────────────────────────
OLD_MODEL="$SCRIPT_DIR/models/kokoro/kokoro-v0_19.pth"
[ -f "$OLD_MODEL" ] && rm -f "$OLD_MODEL" && echo "  ✓ Removed old model stub"

# ── 5. Download Kokoro model (~310 MB, once only) ────────────────────────────
MODEL_DIR="$SCRIPT_DIR/models/kokoro"
if ! ls "$MODEL_DIR"/*.pth 2>/dev/null | grep -q .; then
  echo "  → Downloading AI voice model (~310 MB, once only)…"
  VELLUM_DATA_DIR="$SCRIPT_DIR" "$VENV_PYTHON" scripts/download_kokoro_model.py
  echo ""
  echo "  ✓ Model downloaded"
else
  echo "  ✓ AI model ready"
fi

# ── 6. Launch ────────────────────────────────────────────────────────────────
echo ""
echo "  ┌───────────────────────────────────────────┐"
echo "  │  Open in your browser:                    │"
echo "  │  http://127.0.0.1:$PORT                      │"
echo "  │                                           │"
echo "  │  Press Ctrl+C to stop                     │"
echo "  └───────────────────────────────────────────┘"
echo ""

# Auto-open browser after a short delay
( sleep 2 && open "http://127.0.0.1:$PORT" 2>/dev/null || \
             xdg-open "http://127.0.0.1:$PORT" 2>/dev/null || true ) &

export VELLUM_DATA_DIR="$SCRIPT_DIR"
export PYTORCH_ENABLE_MPS_FALLBACK=1

"$VENV_PYTHON" -m uvicorn app.main:app \
  --host 127.0.0.1 \
  --port $PORT \
  --no-access-log
