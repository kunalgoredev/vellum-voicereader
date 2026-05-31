# Troubleshooting Guide

**Document Version:** 1.0.0  
**Last Updated:** 2026-05-31

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

### 4. Generation Errors

#### 4.1 "ModuleNotFoundError: No module named 'omegaconf'"

**Fix:**
```bash
pip install omegaconf
```

Silero TTS requires omegaconf for configuration loading.

#### 4.2 "Format not recognised" (LibsndfileError)

**Cause:** soundfile can't determine the audio format to write.

**Fix:** Ensure the audio data is a valid numpy array with shape (n,) for mono. Check the output of the TTS engine.

#### 4.3 "Speaker not in supported list" (Silero)

**Cause:** The speaker ID doesn't exist in the selected model.

**Fix:** The list of available speakers is shown in the error message. Use one of those.

#### 4.4 "apply_tts() got an unexpected keyword argument"

**Cause:** Different Silero model classes have different API signatures.

**Fix:** See `tts_silero.py` — the code must branch based on model type:

| Model | Class | API |
|-------|-------|-----|
| lj_v2 | TTSModel_v2 | `apply_tts(texts=str, sample_rate=int)` |
| v3_en | TTSModelMultiAcc_v3 | `apply_tts(text=str, speaker=str, sample_rate=int)` |

#### 4.5 "Pipeline loaded in Xs" repeated for every chunk

**Cause:** Pipeline caching isn't working — the model is reloaded for each chunk.

**Fix:** Check that `_pipeline_cache` in `tts_engine.py` persists across function calls (should be module-level, not function-level).

---

### 5. Server Issues

#### 5.1 "Address already in use" / port 8000 busy

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

#### 5.2 Server starts but page shows "404 Not Found"

**Cause:** Static files not mounted correctly or wrong working directory.

**Fix:** Start the server from the project root directory (where `app/` and `web/` exist).

#### 5.3 UI loads but API calls fail

**Cause:** Usually a network or CORS issue. For localhost usage, CORS shouldn't be needed.

**Fix:** Check the browser developer console (F12) for error messages.

---

### 6. Model Download Issues

#### 6.1 "HTTP Error 401: Unauthorized" (HuggingFace)

**Cause:** Some HuggingFace models require authentication.

**Fix:** The public Kokoro model doesn't require auth. If it fails:
```bash
pip install huggingface_hub
huggingface-cli login
# Enter your HuggingFace token
```

#### 6.2 "HTTP Error 404: Not Found"

**Cause:** The download URL has changed.

**Fix:** Check the model repository for updated URLs:
- Kokoro: https://huggingface.co/hexgrad/Kokoro-82M
- Model file: `kokoro-v0_19.pth`

#### 6.3 Download is very slow

**Cause:** Model files are large (Kokoro: ~300MB, Silero: ~150MB).

**Fix:** Ensure a stable internet connection. The download happens once and is cached.

---

### 7. MP3 Export Issues

#### 7.1 MP3 file is just a copied WAV

**Cause:** ffmpeg is not installed. pydub requires ffmpeg for MP3 encoding.

**Fix:**
```bash
# Windows: Download from ffmpeg.org and add to PATH
# macOS: brew install ffmpeg
```

**Workaround:** Use WAV output (lossless, always works).

---

### 8. Long Script Issues

#### 8.1 Generation takes too long

**Expected behavior:**
- Kokoro: ~0.3s per chunk
- Silero: ~1-2s per chunk
- A 100-chunk script takes ~30s (Kokoro) to ~3min (Silero)

**Tips:**
- Use Kokoro for long scripts
- The progress bar shows current chunk / total chunks
- Wait for completion — the UI updates when done

#### 8.2 Out of memory with very long scripts

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

**Document Version:** 1.0.0  
**Last Updated:** 2026-05-31  
**Author:** Local AI Voice Generator Team
