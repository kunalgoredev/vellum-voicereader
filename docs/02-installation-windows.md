# Installation Guide — Windows

**Document Version:** 1.1.0  
**Platform:** Windows 10/11 (x86_64)  
**Last Updated:** 2026-06-02

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

### One-Command Start (Recommended)

```cmd
start.bat
```

`start.bat` in the project root handles everything in sequence:

1. **Creates the virtual environment** (`.venv`) if it doesn't exist and installs all dependencies
2. **Removes any corrupt leftover model files** (e.g. old `kokoro-v0_19.pth` stubs)
3. **Downloads `kokoro-v1_0.pth`** (~310 MB) from HuggingFace with a live progress bar — only if not already present
4. **Starts the FastAPI server** at http://127.0.0.1:8000

On subsequent runs, steps 1–3 are skipped automatically; the server starts in seconds.

**Expected first-run output:**
```
========================================
 Vellum Voice Reader - Setup & Start
========================================

[1/3] Virtual environment OK
[2/3] Downloading Kokoro model ~310MB - this may take a few minutes...
  100.0%  310.4 / 310.4 MB
[2/3] Model downloaded OK
[3/3] Starting server at http://127.0.0.1:8000
```

---

### Package Reference

All dependencies are installed automatically by `start.bat`. For reference:

| Package | Version | Purpose |
|---------|---------|---------|
| fastapi | ≥0.115.0 | Web framework |
| uvicorn | ≥0.34.0 | ASGI server |
| python-multipart | ≥0.0.19 | Form data parsing |
| pydantic | ≥2.10.0 | Data validation |
| numpy | ==1.26.4 | Numerical computing |
| soundfile | ≥0.12.1 | WAV audio I/O |
| pydub | ≥0.25.1 | Audio format conversion |
| torch | ≥2.6.0 | Deep learning framework |
| torchaudio | ≥2.6.0 | Audio processing for PyTorch |
| kokoro | ≥0.7.6,<0.8.0 | Primary TTS engine (tested on 0.7.16) |
| huggingface_hub | ≥0.27.0 | Model download |
| scipy | ≥1.12.0 | Signal processing (resampling) |
| omegaconf | ≥2.3.0 | Configuration (Silero dependency) |

### Verify GPU Acceleration (Optional)

```cmd
scripts\05_check_gpu.bat
```

**Expected output with NVIDIA GPU:**
```
Torch version: 2.6.0+cu126
CUDA available: True
GPU 0: NVIDIA GeForce RTX 4080
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
