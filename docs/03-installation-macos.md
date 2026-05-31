# Installation Guide — macOS

**Document Version:** 1.0.0  
**Platform:** macOS 13+ (Ventura, Sonoma, Sequoia)  
**Architecture:** Apple Silicon (M1/M2/M3/M4) and Intel x86_64  
**Last Updated:** 2026-05-31

---

## Prerequisites

### Required Software
- **Python 3.11** — macOS may come with Python 3.9. Install 3.11 via:
  ```bash
  # Using Homebrew (recommended)
  brew install python@3.11
  
  # Or download from python.org
  ```
  Verify: `python3 --version`

- **pip** (usually comes with Python):
  ```bash
  python3 -m pip install --upgrade pip
  ```

### Recommended Software
- **Homebrew** — Package manager for macOS:
  ```bash
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
  ```
- **FFmpeg** (for MP3 export):
  ```bash
  brew install ffmpeg
  ```
- **Git**:
  ```bash
  brew install git
  ```

---

## Installation Steps

### Step 1: Create Virtual Environment

```bash
bash scripts/01_create_venv.sh
```

This script creates a Python virtual environment in the `venv/` directory.

**Expected output:**
```
Creating Python virtual environment...
Virtual environment created successfully.
```

### Step 2: Install Dependencies

```bash
bash scripts/02_install_requirements.sh
```

This script:
1. Activates the virtual environment
2. Upgrades pip
3. Installs all dependencies from `requirements.txt`

**Expected output:**
```
Activating virtual environment...
Installing requirements...
Requirements installed successfully.
```

### Step 3: Verify GPU Acceleration (Optional but Recommended)

```bash
bash scripts/05_check_gpu.sh
```

**Expected output with Apple Silicon:**
```
Torch version: 2.5.1
CUDA available: False
MPS available: True
MPS device: Apple Silicon GPU
```

**Expected output on Intel Mac:**
```
Torch version: 2.5.1
CUDA available: False
MPS available: False
```

### Step 4: Download Models (Optional)

```bash
bash scripts/03_download_models.sh
```

Downloads the Kokoro model to `models/kokoro/`. If skipped, the model auto-downloads on first use.

### Step 5: Start the Application

```bash
bash scripts/04_start_app.sh
```

This script:
1. Activates the virtual environment
2. Starts the FastAPI server
3. Opens your default browser

**Expected output:**
```
Starting Local AI Voice Generator...

Open your browser to: http://127.0.0.1:8000

INFO:     Uvicorn running on http://127.0.0.1:8000
```

---

## Apple Silicon GPU Acceleration

The application uses Apple's Metal Performance Shaders (MPS) for GPU acceleration on Apple Silicon Macs.

**Requirements for MPS acceleration:**
- macOS 12.3 or later
- PyTorch 2.0 or later
- Apple Silicon (M1 series or newer)

**Verification:**
```bash
python3 -c "import torch; print('MPS available:', torch.backends.mps.is_available())"
```

**If MPS is not available:**
1. Update macOS: System Settings → Software Update
2. Update PyTorch: `pip install --upgrade torch torchaudio`
3. Verify: `python3 -c "import torch; print(torch.__version__)"`

---

## Standalone Application Build

To create a distributable macOS `.app` bundle:

```bash
bash scripts/06_build_app.sh
```

This uses `py2app` to bundle Python, all dependencies, and models into a standalone `.app` file in the `dist/` directory.

**Requirements for building:**
- All dependencies installed (run Step 2 first)
- Models downloaded (run Step 4 first)

**The resulting `.app` bundle:**
- Contains Python interpreter, all libraries, and models
- Self-contained — no external dependencies
- Can be distributed via USB, DMG, or direct download
- Fully offline

---

## Troubleshooting macOS Installation

### "python3: command not found"
Install Python 3.11:
```bash
brew install python@3.11
```

### "venv/bin/activate: No such file or directory"
The virtual environment doesn't exist. Run:
```bash
bash scripts/01_create_venv.sh
```

### "MPS not available" on Apple Silicon
Ensure you have:
- macOS 12.3+: System Settings → Software Update
- PyTorch 2.0+: `pip install --upgrade torch torchaudio`

### "ModuleNotFoundError: No module named 'omegaconf'"
```bash
pip install omegaconf
```

### "Error: That port is already in use"
Change the port or kill the process:
```bash
# Kill process on port 8000
lsof -ti:8000 | xargs kill

# Or use a different port
# Edit app/config.py and change PORT = 8000 to PORT = 8001
```

### "pip install fails with build errors"
Ensure Python 3.11 is installed (not 3.12+):
```bash
python3 --version
```

### "Can't open browser automatically"
If the browser doesn't open, manually navigate to:
```
http://127.0.0.1:8000
```

---

## Post-Installation

After successful installation:
- The web UI loads at http://127.0.0.1:8000
- Device info shows "MPS" (Apple Silicon) or "CPU"
- Available voices populate the dropdown

Proceed to the [User Guide](04-user-guide.md).

---

**Document Version:** 1.0.0  
**Last Updated:** 2026-05-31  
**Author:** Local AI Voice Generator Team
