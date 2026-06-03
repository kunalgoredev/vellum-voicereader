# Troubleshooting Guide

**Document Version:** 1.1.0  
**Last Updated:** 2026-06-02

---

## Common Issues & Solutions

### 1. Installation Failures

#### 1.1 "python is not recognized" / "command not found"

**Windows:**
- Reinstall Python 3.11
- Ensure "Add Python to PATH" is checked during installation
- Restart terminal after installation

**macOS:**
- Install: `brew install python@3.11`
- Or download from python.org

#### 1.2 "Failed to create virtual environment"

Try manually:
```bash
# Windows
python -m venv venv

# macOS
python3 -m venv venv
```

#### 1.3 "pip install fails with build errors"

**Cause:** Building from source requires C++ build tools (Windows) or missing system dependencies.

**Windows fix:**
- Install Visual C++ Build Tools from [visualstudio.microsoft.com](https://visualstudio.microsoft.com/visual-cpp-build-tools/)
- Or use Python 3.11 (has more pre-built wheels)

**macOS fix:**
- Install Xcode Command Line Tools: `xcode-select --install`

#### 1.4 "No solution found when resolving dependencies"

**Cause:** Version conflicts in requirements. Common with kokoro + numpy.

**Fix:** Use the exact pinned versions from `requirements.txt`:
```
numpy==1.26.4
kokoro>=0.7.6,<0.8.0
```

---

### 2. GPU / Acceleration Issues

#### 2.1 "CUDA not available" on Windows with NVIDIA GPU

**Verify:**
```cmd
nvidia-smi
```

If nvidia-smi shows CUDA but torch doesn't detect it:
```cmd
uv pip uninstall torch torchaudio
uv pip install torch torchaudio --extra-index-url https://download.pytorch.org/whl/cu126
```

#### 2.2 "MPS not available" on Apple Silicon Mac

**Requirements:**
- macOS 12.3 or later
- PyTorch 2.0 or later

**Verify:**
```bash
python3 -c "import torch; print('MPS:', torch.backends.mps.is_available())"
```

**Fix:**
```bash
pip install --upgrade torch torchaudio
```

#### 2.3 App runs on CPU despite having a GPU

**Step 1:** Check detection:
```
http://127.0.0.1:8000/api/device
```

**Step 2:** Verify torch build:
```bash
python -c "import torch; print(torch.__version__); print(torch.version.cuda)"
```

**Step 3:** Reinstall with GPU support (see sections 2.1/2.2 above).

---

### 3. Audio Quality Issues

#### 3.1 Audio plays too fast / chipmunk sound

**Cause:** Sample rate mismatch. The audio data doesn't match the WAV header sample rate.

**Fix:** The TTS engines should output at 24000 Hz. If audio sounds fast:
- Check that `tts_engine.py` or `tts_silero.py` properly resamples to 24000
- Verify in `audio_tools.py` that `SAMPLE_RATE = 24000`

#### 3.2 Audio plays too slow / deep voice

**Cause:** Opposite of above — data written at lower sample rate than header indicates.

**Fix:** Same as 3.1 — ensure consistent 24000 Hz throughout the pipeline.

#### 3.3 Static/noise instead of voice

**Cause:** Audio data format issue (e.g., writing float32 as PCM16 without normalization).

**Fix:** Ensure `sf.write()` receives properly normalized float32 data in range [-1.0, 1.0].

#### 3.4 Voice sounds robotic or unnatural

**Causes and fixes:**
- **Speed too high:** Keep speed 0.9-1.0
- **Text too short:** Very short chunks (~10 chars) sound less natural
- **Voice choice:** Try different voices (af_sky is most natural for Kokoro)
- **Silero:** Use LJSpeech voice for most natural results
- **Text content:** Complex formatting or symbols in text reduce quality

#### 3.5 Silero generates silence

**Cause:** The model API might return unexpected data format.

**Fix:** Check the terminal output for errors. Try LJSpeech voice instead of v3_en.

---

### 4. Kokoro / PyTorch Compatibility Issues

#### 4.0 `KPipeline.__init__() got an unexpected keyword argument 'model_path'`

**Cause:** kokoro ≥0.7.12 removed the `model_path` kwarg from `KPipeline`. The new API accepts a `KModel` instance or a bool.

**Fix:** This is already handled in `tts_engine.py`. If you see this error, ensure you are running the latest `tts_engine.py` from this repo.

#### 4.0a `UnpicklingError: Weights only load failed` / `Unsupported operand 60`

**Cause:** PyTorch 2.6 changed `torch.load` to default `weights_only=True`. The kokoro model file format is not compatible with strict weights-only loading.

**Fix:** `tts_engine.py` monkey-patches `torch.load` during pipeline initialization to force `weights_only=False`. This is safe because the model is from a trusted source (HuggingFace `hexgrad/Kokoro-82M`). Ensure you are running the latest `tts_engine.py`.

#### 4.0b `UnpicklingError: invalid load key, '<'`

**Cause:** The `.pth` file in `models/kokoro/` is corrupted — it contains an HTML error page instead of model weights. This happens when a download fails silently (e.g. a placeholder Google Drive URL, or a network interruption that returns an error page).

**Fix:**
1. Delete the corrupt file:
   ```cmd
   del /f "models\kokoro\kokoro-v0_19.pth"
   del /f "models\kokoro\kokoro-v1_0.pth"
   ```
2. Re-run `start.bat` — it will re-download the correct model.

`start.bat` now automatically deletes `kokoro-v0_19.pth` (the old stub file) on every startup.

#### 4.0c Wrong model version — `kokoro-v0_19.pth` vs `kokoro-v1_0.pth`

**Cause:** The original project shipped with a placeholder download pointing to `kokoro-v0_19.pth`. kokoro ≥0.7.12 requires `kokoro-v1_0.pth`.

**Fix:** `start.bat` handles this automatically. If running scripts manually:
```cmd
uv run python scripts\download_kokoro_model.py
```
This downloads `kokoro-v1_0.pth` from `https://huggingface.co/hexgrad/Kokoro-82M/resolve/main/kokoro-v1_0.pth`.

---

### 5. Generation Errors

#### 5.1 "ModuleNotFoundError: No module named 'omegaconf'"

**Fix:**
```bash
pip install omegaconf
```

Silero TTS requires omegaconf for configuration loading.

#### 5.2 "Format not recognised" (LibsndfileError)

**Cause:** soundfile can't determine the audio format to write.

**Fix:** Ensure the audio data is a valid numpy array with shape (n,) for mono. Check the output of the TTS engine.

#### 5.3 "Speaker not in supported list" (Silero)

**Cause:** The speaker ID doesn't exist in the selected model.

**Fix:** The list of available speakers is shown in the error message. Use one of those.

#### 5.4 "apply_tts() got an unexpected keyword argument"

**Cause:** Different Silero model classes have different API signatures.

**Fix:** See `tts_silero.py` — the code must branch based on model type:

| Model | Class | API |
|-------|-------|-----|
| lj_v2 | TTSModel_v2 | `apply_tts(texts=str, sample_rate=int)` |
| v3_en | TTSModelMultiAcc_v3 | `apply_tts(text=str, speaker=str, sample_rate=int)` |

#### 5.5 "Pipeline loaded in Xs" repeated for every chunk

**Cause:** Pipeline caching isn't working — the model is reloaded for each chunk.

**Fix:** Check that `_pipeline_cache` in `tts_engine.py` persists across function calls (should be module-level, not function-level).

---

### 6. Server Issues

#### 6.1 "Address already in use" / port 8000 busy

**Fix 1:** Kill the existing process:
```bash
# Windows
netstat -ano | findstr :8000
taskkill /PID <PID> /F

# macOS
lsof -ti:8000 | xargs kill
```

**Fix 2:** Change port in `app/config.py`:
```python
PORT = 8001
```

#### 6.2 Server starts but page shows "404 Not Found"

**Cause:** Static files not mounted correctly or wrong working directory.

**Fix:** Start the server from the project root directory (where `app/` and `web/` exist).

#### 6.3 UI loads but API calls fail

**Cause:** Usually a network or CORS issue. For localhost usage, CORS shouldn't be needed.

**Fix:** Check the browser developer console (F12) for error messages.

---

### 7. Model Download Issues

#### 7.1 "HTTP Error 401: Unauthorized" (HuggingFace)

**Cause:** Some HuggingFace models require authentication.

**Fix:** The public Kokoro model doesn't require auth. If it fails:
```bash
pip install huggingface_hub
huggingface-cli login
# Enter your HuggingFace token
```

#### 7.2 "HTTP Error 404: Not Found"

**Cause:** The download URL has changed.

**Fix:** Check the model repository for updated URLs:
- Kokoro: https://huggingface.co/hexgrad/Kokoro-82M
- Current model file: `kokoro-v1_0.pth`

#### 7.3 Download is very slow

**Cause:** Model files are large (Kokoro: ~300MB, Silero: ~150MB).

**Fix:** Ensure a stable internet connection. The download happens once and is cached.

---

### 8. MP3 Export Issues

#### 8.1 MP3 file is just a copied WAV

**Cause:** ffmpeg is not installed. pydub requires ffmpeg for MP3 encoding.

**Fix:**
```bash
# Windows: Download from ffmpeg.org and add to PATH
# macOS: brew install ffmpeg
```

**Workaround:** Use WAV output (lossless, always works).

---

### 9. Long Script Issues

#### 9.1 Generation takes too long

**Expected behavior:**
- Kokoro: ~0.3s per chunk
- Silero: ~1-2s per chunk
- A 100-chunk script takes ~30s (Kokoro) to ~3min (Silero)

**Tips:**
- Use Kokoro for long scripts
- The progress bar shows current chunk / total chunks
- Wait for completion — the UI updates when done

#### 9.2 Out of memory with very long scripts

**Cause:** All chunks loaded into memory before writing final file.

**Fix:** Currently the system concatenates all chunks in memory. For extremely long scripts (>500 chunks), this could use significant RAM. Future versions will stream the combination.

**Workaround:** Split your script into multiple generation jobs.

---

## Debugging Tools

### Console Logs
Run the server with visible console output:
```bash
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

All `[JOB]`, `[Kokoro]`, `[Silero]` messages appear in the terminal.

### API Debugging
Use curl or browser Swagger UI at `http://127.0.0.1:8000/docs`.

### Direct Python Testing
```python
from app.text_cleaner import clean_text
print(clean_text("Your test text"))
```

---

## Getting Support

If you encounter an issue not covered here:

1. Check the terminal output for error messages
2. Verify your configuration in `app/config.py`
3. Try the [FAQ](09-faq.md)
4. Contact support with:
   - Operating system and version
   - Python version (`python --version`)
   - Torch version (`python -c "import torch; print(torch.__version__)"`)
   - GPU info (`nvidia-smi` or `bash scripts/05_check_gpu.sh`)
   - Full error message from the terminal

---

---

### 10. Electron App Errors (Windows)

#### 10.1 `spawn uv ENOENT` / `spawn C:\Users\...\uv.EXE ENOENT`

**Cause:** Three separate root causes were encountered in sequence:

1. `findBin()` used `where uv` (shell command) to locate uv, returned a path that didn't exist on disk
2. Fallback used `shell: true` → Node internally spawns `cmd.exe` → packaged Electron blocks `cmd.exe` spawn → `spawn C:\Windows\system32\cmd.exe ENOENT`
3. `_searchPath()` walked PATH and found `C:\Users\Kunal\.local\bin\uv.EXE` via `fs.existsSync` (file appears in directory listing) but the binary is broken/non-executable (stale install from WSL or corrupt uv install)

**Final fix in `electron/main.js`:**
- Removed all `shell: true` / `execSync` / `spawnSync` usage in tooling discovery
- Added `_canRun(fullPath)` which calls `execFileSync(path, ['--version'])` — no shell, direct binary test
- `_searchPath()` now validates each candidate with both `fs.existsSync` AND `_canRun` before returning
- Broken uv installs are skipped; setup falls through to plain `pip`

**Status as of 2026-06-03:** Fix applied, not yet confirmed working on user's machine. Next session should verify and debug further if needed.

#### 10.2 Electron won't find Python

If Python is installed but not found by the app:
- Ensure Python is in system PATH (not just user PATH for the current shell session)
- Check `process.env.PATH` in Electron devtools console
- Add Python path manually to system environment variables

#### 10.3 Running from `win-unpacked` vs installer

The user is running directly from `win-unpacked\Vellum.exe` without installing. This is valid. The app stores venv + models in `%APPDATA%\Vellum\` (userData). Delete that folder for a clean reinstall.

---

**Document Version:** 1.2.0
**Last Updated:** 2026-06-03
