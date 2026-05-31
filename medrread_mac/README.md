# Local AI Voice Generator (macOS)

Offline text-to-speech for YouTube scripts and long-form narration.

## Requirements

- macOS 13+ (Ventura or newer)
- Apple Silicon (M1/M2/M3/M4) recommended for GPU acceleration
- Intel Macs will fall back to CPU (slower)
- Python 3.11 (will be auto-downloaded by build script)

## Quick Start

```bash
bash scripts/01_create_venv.sh
bash scripts/02_install_requirements.sh
bash scripts/04_start_app.sh
```

Open http://127.0.0.1:8000 in your browser.

## Setup Steps

### 1. Create Virtual Environment
```bash
bash scripts/01_create_venv.sh
```

### 2. Install Dependencies
```bash
bash scripts/02_install_requirements.sh
```

### 3. Check GPU
```bash
bash scripts/05_check_gpu.sh
```

### 4. Start the App
```bash
bash scripts/04_start_app.sh
```

## Models

- **Kokoro** (default): Fast, lightweight. ~300MB.
- **Silero TTS**: Higher quality. Auto-downloads on first use (~150MB).

Switch models via the dropdown in the UI.

## Standalone App Build

To build a distributable .app bundle:
```bash
bash scripts/06_build_app.sh
```

This bundles Python, all dependencies, and models into a single macOS application.

## Project Structure

- `app/` — FastAPI backend
- `web/` — Browser UI
- `models/` — TTS model files
- `outputs/` — Generated audio files
- `scripts/` — Setup and run scripts

## Notes

- GPU acceleration uses Apple's Metal Performance Shaders (MPS) on Apple Silicon
- No cloud services, no API keys, fully offline after setup
- MP3 export requires ffmpeg: `brew install ffmpeg`
