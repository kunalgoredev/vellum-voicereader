# Local AI Voice Generator

Offline text-to-speech for YouTube scripts and long-form narration.

## Hardware Requirements

- Windows PC with Python 3.10+
- NVIDIA GPU with 8GB+ VRAM recommended (CUDA)
- 32GB RAM recommended

## Quick Start

```cmd
scripts\01_create_venv.bat
scripts\02_install_requirements.bat
scripts\04_start_app.bat
```

Open http://127.0.0.1:8000 in your browser.

## Setup Steps

### 1. Create Virtual Environment

```cmd
scripts\01_create_venv.bat
```

### 2. Install Dependencies

```cmd
scripts\02_install_requirements.bat
```

### 3. Check GPU

```cmd
scripts\05_check_gpu.bat
```

### 4. Start the App

```cmd
scripts\04_start_app.bat
```

## Project Structure

- `app/` — FastAPI backend
- `web/` — Browser UI
- `models/` — TTS model files (downloaded separately)
- `outputs/` — Generated audio files
- `scripts/` — Setup and run scripts

## Tech Stack

- Kokoro TTS (primary), Piper TTS (fallback)
- FastAPI backend
- Simple HTML/JS UI
- Fully offline after setup
