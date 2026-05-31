# Installation Guide — Windows

**Document Version:** 1.0.0  
**Platform:** Windows 10/11 (x86_64)  
**Last Updated:** 2026-05-31

---

## Prerequisites

### Required Software
- **Python 3.11** — Download from [python.org](https://www.python.org/downloads/)
  - Ensure "Add Python to PATH" is checked during installation
  - Verify: `python --version`
- **uv** (fast package manager) — Install via:
  ```cmd
  pip install uv
  ```
- **Git** (optional, for version control) — [git-scm.com](https://git-scm.com/)

### Optional Software
- **FFmpeg** (for MP3 export) — Download from [ffmpeg.org](https://ffmpeg.org/)
  - Add `ffmpeg.exe` to your system PATH
  - Verify: `ffmpeg -version`
- **NVIDIA CUDA Toolkit 12.x** — Only if torch doesn't auto-detect CUDA
  - Verify: `nvidia-smi` (should show CUDA version)
- **Microsoft Visual C++ Build Tools** — Only needed if building from source
  - [Download](https://visualstudio.microsoft.com/visual-cpp-build-tools/)

---

## Installation Steps

### Step 1: Create Virtual Environment

```cmd
scripts\01_create_venv.bat
```

This script:
1. Removes any existing `venv/` directory
2. Creates a new Python 3.12 virtual environment using `uv`
3. Installs the `uv` package manager into the environment

**Expected output:**
```
Deleting old virtual environment if it exists...
Creating virtual environment with Python 3.12...
Using CPython 3.12.9
Creating virtual environment at: .venv
Virtual environment created successfully.
```

### Step 2: Install Dependencies

```cmd
scripts\02_install_requirements.bat
```

This script installs all Python packages from `requirements.txt`:

| Package | Version | Purpose |
|---------|---------|---------|
| fastapi | ≥0.115.0 | Web framework |
| uvicorn | ≥0.34.0 | ASGI server |
| python-multipart | ≥0.0.19 | Form data parsing |
| pydantic | ≥2.10.0 | Data validation |
| numpy | ==1.26.4 | Numerical computing |
| soundfile | ≥0.12.1 | WAV audio I/O |
| pydub | ≥0.25.1 | Audio format conversion |
| torch | ≥2.5.0 | Deep learning framework |
| torchaudio | ≥2.5.0 | Audio processing for PyTorch |
| kokoro | ≥0.7.6,<0.8.0 | Primary TTS engine |
| huggingface_hub | ≥0.27.0 | Model download |
| scipy | ≥1.12.0 | Signal processing (resampling) |
| omegaconf | ≥2.3.0 | Configuration (Silero dependency) |

**Expected output:**
```
Installing requirements with uv...
Resolved XX packages in X.Xs
Installed YY packages in XXs
Requirements installed successfully.
```

### Step 3: Verify GPU Acceleration (Optional but Recommended)

```cmd
scripts\05_check_gpu.bat
```

This script checks:
- Python version
- PyTorch version
- CUDA availability
- GPU name (if CUDA is available)

**Expected output with NVIDIA GPU:**
```
Torch version: 2.12.0+cu126
CUDA available: True
CUDA version: 12.6
GPU 0: NVIDIA GeForce RTX 4080
```

**Expected output without GPU:**
```
Torch version: 2.12.0+cpu
CUDA available: False
```

### Step 4: Download Models (Optional)

```cmd
scripts\03_download_models.bat
```

This pre-downloads the Kokoro TTS model to `models/kokoro/`. If skipped, the model auto-downloads on first generation.

**Expected output:**
```
Downloading Kokoro model...
Kokoro model saved to models\kokoro\kokoro-v0_19.pth
Model download complete.
```

### Step 5: Start the Application

```cmd
scripts\04_start_app.bat
```

This script:
1. Activates the virtual environment
2. Launches the FastAPI server on http://127.0.0.1:8000
3. Opens the default browser to the application URL

**Expected output:**
```
Device: cuda
GPU: NVIDIA GeForce RTX 4080
INFO:     Uvicorn running on http://127.0.0.1:8000
```

---

## Troubleshooting Windows Installation

### "python is not recognized"
Ensure Python is added to your PATH. Reinstall Python and check "Add Python to PATH".

### "Failed to activate virtual environment"
Delete the `venv/` or `.venv/` directory and re-run `01_create_venv.bat`.

### "Microsoft Visual C++ 14.0 or greater is required"
This occurs when building packages from source. Install [Visual C++ Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) or ensure you're using Python 3.11 (not 3.12+).

### "CUDA not available" with NVIDIA GPU
1. Verify GPU: `nvidia-smi`
2. Reinstall torch with CUDA:
   ```cmd
   uv pip uninstall torch torchaudio
   uv pip install torch torchaudio --extra-index-url https://download.pytorch.org/whl/cu126
   ```

### "Port 8000 already in use"
Either:
- Kill the existing process: `netstat -ano | findstr :8000`
- Or change port in `app\config.py`: `PORT = 8001`

### "No module named 'omegaconf'"
Install the missing dependency:
```cmd
uv pip install omegaconf
```

---

## Post-Installation

After successful installation, you should see:
- The web UI at http://127.0.0.1:8000
- Device info showing "CUDA" (or "CPU")
- Available voices in the dropdown menu

Proceed to the [User Guide](04-user-guide.md) for instructions on using the application.

---

**Document Version:** 1.0.0  
**Last Updated:** 2026-05-31  
**Author:** Local AI Voice Generator Team
