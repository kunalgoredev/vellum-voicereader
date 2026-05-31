# Developer Guide

**Document Version:** 1.0.0  
**Classification:** Technical Reference  
**Last Updated:** 2026-05-31

---

## 1. Project Structure

```
local-ai-voice/
│
├── app/                          # Backend application
│   ├── __init__.py
│   ├── main.py                   # FastAPI server, route handlers
│   ├── config.py                 # Global configuration, paths
│   ├── device_utils.py           # Cross-platform GPU detection (macOS)
│   ├── text_cleaner.py           # Text preprocessing pipeline
│   ├── chunker.py                # Text segmentation
│   ├── tts_engine.py             # Kokoro TTS implementation
│   ├── tts_silero.py             # Silero TTS implementation
│   ├── audio_tools.py            # Audio post-processing
│   ├── job_store.py              # Job persistence
│   └── utils.py                  # Utility functions
│
├── web/                          # Frontend
│   ├── index.html                # Main UI page
│   ├── app.js                    # Frontend logic
│   └── style.css                 # Dark theme styles
│
├── models/                       # Model storage
│   ├── kokoro/                   # Kokoro model files (*.pth)
│   └── silero/                   # (reserved, auto-downloaded by torch.hub)
│
├── outputs/                      # Generated output
│   ├── jobs/                     # Per-job directories
│   └── final/                    # (reserved)
│
├── scripts/                      # Platform-specific scripts
│   ├── 01_create_venv.bat        # Windows venv creation
│   ├── 01_create_venv.sh         # macOS venv creation
│   ├── 02_install_requirements.* # Dependency installation
│   ├── 03_download_models.*      # Model pre-download
│   ├── 04_start_app.*            # Application startup
│   ├── 05_check_gpu.*            # GPU verification
│   ├── 06_build_app.sh           # macOS .app build
│   └── download_kokoro_model.py  # Model download utility
│
├── docs/                         # Documentation
├── requirements.txt              # Python dependencies
├── setup.py                      # macOS py2app config
├── README.md                     # Quick start guide
└── .gitignore
```

---

## 2. Configuration Reference

### `app/config.py`

| Constant | Default | Description |
|----------|---------|-------------|
| `HOST` | `"127.0.0.1"` | Server bind address |
| `PORT` | `8000` | Server port |
| `DEFAULT_MODEL` | `"kokoro"` | Default TTS engine |
| `DEFAULT_VOICE` | `"af_heart"` | Default voice |
| `DEFAULT_SPEED` | `1.0` | Default speed multiplier |
| `DEFAULT_FORMAT` | `"wav"` | Default output format |
| `MAX_CHUNK_CHARS` | `1200` | Maximum characters per chunk |
| `SILENCE_BETWEEN_CHUNKS_MS` | `500` | Silence between chunks in ms |
| `AVAILABLE_MODELS` | — | List of available TTS models |

### Paths (auto-configured)

| Constant | Path |
|----------|------|
| `BASE_DIR` | Project root |
| `KOKORO_DIR` | `BASE_DIR / "models" / "kokoro"` |
| `SILERO_DIR` | `BASE_DIR / "models" / "silero"` |
| `JOBS_DIR` | `BASE_DIR / "outputs" / "jobs"` |
| `WEB_DIR` | `BASE_DIR / "web"` |

---

## 3. Adding a New Voice

### For Kokoro

1. Add the voice ID to `_voice_map` in `app/tts_engine.py`:
   ```python
   "af_newvoice": ("af_newvoice", "a"),
   ```

2. Add the voice to `_kokoro_voices` in `app/main.py`:
   ```python
   {"id": "af_newvoice", "name": "Female — New Voice", "model": "kokoro"},
   ```

3. The voice embedding file will auto-download from HuggingFace on first use.

### For Silero

1. Add the speaker to `get_available_speakers()` in `app/tts_silero.py`:
   ```python
   {"id": "new_speaker", "name": "Speaker Name"},
   ```

2. Add handling in `generate_chunk_audio()` for the new speaker's model API.

---

## 4. Adding a New TTS Engine

1. Create `app/tts_newengine.py`
2. Implement the interface:
   ```python
   def generate_chunk_audio(text: str, voice: str, speed: float, output_path: Path):
       """Generate WAV file from text."""
       pass
   
   def get_available_speakers() -> list[dict]:
       """Return list of {id, name} dicts."""
       pass
   ```

3. Add the model to `AVAILABLE_MODELS` in `app/config.py`:
   ```python
   {"id": "newengine", "name": "New Engine (description)"},
   ```

4. Add routing in `app/main.py` `generate()` function:
   ```python
   if model == "newengine":
       from app import tts_newengine as tts
   ```

5. Update `/api/voices` endpoint in `app/main.py` for the new model.

---

## 5. Extending the Text Cleaner

Add new cleaning functions to `app/text_cleaner.py` and include them in the pipeline:

```python
def _normalize_my_pattern(text: str) -> str:
    # Cleaning logic
    return text
```

Then add to the `clean_text()` function:
```python
text = _normalize_my_pattern(text)
```

### Testing the Cleaner

```python
from app.text_cleaner import clean_text
result = clean_text("Your test text with [bad stuff]")
print(result)
```

---

## 6. Modifying Chunking Behavior

Edit `app/chunker.py`:

| Parameter | Location | Default | Effect |
|-----------|----------|---------|--------|
| `max_chars` | `chunk_text()` parameter | `MAX_CHUNK_CHARS` (1200) | Maximum chunk size |
| Sentence splitting | `_split_sentences()` regex | `(?<=[.!?])\s+` | Sentence boundary detection |

---

## 7. Audio Processing Pipeline

### Sample Rate Handling

| Engine | Native Rate | Output Rate |
|--------|-------------|-------------|
| Kokoro | 24000 Hz | 24000 Hz |
| Silero LJSpeech | 16000 Hz | 24000 Hz (resampled) |
| Silero v3_en | 48000 Hz | 24000 Hz (resampled) |

### Chunk Combination Logic

1. Read each `chunk_NNN.wav` from `audio_chunks/`
2. Resample to 24000 Hz if needed
3. Append 500ms of silence between chunks
4. Concatenate all segments
5. Write to `final/{filename}.wav`

---

## 8. Device Detection

Cross-platform GPU detection in `app/device_utils.py` (macOS) or inline in `app/main.py` (Windows):

```python
def get_device() -> str:
    if torch.cuda.is_available():
        return "cuda"       # NVIDIA GPU (Windows/Linux)
    if hasattr(torch.backends, 'mps') and torch.backends.mps.is_available():
        return "mps"        # Apple Silicon (macOS)
    return "cpu"            # Fallback
```

---

## 9. Job ID Generation

Jobs use sequential numbering:

```python
def _next_job_id() -> str:
    existing = [d.name for d in JOBS_DIR.iterdir() if d.is_dir() and d.name.startswith("job_")]
    nums = []
    for name in existing:
        try:
            nums.append(int(name.split("_")[1]))
        except (IndexError, ValueError):
            pass
    next_num = max(nums) + 1 if nums else 1
    return f"job_{next_num}"
```

---

## 10. Error Handling Patterns

### TTS Engine Errors
Each TTS engine wraps its generation in try/except and writes silence on failure:
```python
try:
    # ... generation logic ...
except Exception as e:
    print(f"[Engine] ERROR: {e}")
    sf.write(str(output_path), silence_array, 24000)
```

### Pipeline Caching
Engines cache expensive resources (model loading):
```python
_pipeline_cache = {}

def _get_pipeline():
    if "key" not in _pipeline_cache:
        # Load model
        _pipeline_cache["key"] = pipeline
    return _pipeline_cache["key"]
```

---

## 11. Testing

### Running the Server Locally
```bash
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

### Testing API Endpoints
```bash
# Check device
curl http://127.0.0.1:8000/api/device

# List models
curl http://127.0.0.1:8000/api/models

# Generate (PowerShell)
Invoke-RestMethod -Uri http://127.0.0.1:8000/api/generate `
  -Method Post -Body @{text="Hello world"; voice="af_sky"; model="kokoro"}

# Generate (bash)
curl -X POST http://127.0.0.1:8000/api/generate \
  -F "text=Hello world" -F "voice=af_sky" -F "model=kokoro"
```

### Testing Text Cleaner Directly
```python
from app.text_cleaner import clean_text
print(clean_text("HOST: Welcome to [music] the show!"))
# Expected: "Welcome to the show!"
```

---

## 12. Code Style Guidelines

- **Python**: Follow PEP 8
- **Imports**: Standard library → Third-party → Local
- **Naming**: `snake_case` for functions/variables, `UPPER_CASE` for constants
- **Error handling**: Print errors with `[ENGINE_NAME]` prefix for log clarity
- **Comments**: Docstrings only for public functions
- **Type hints**: Use for function signatures

---

**Document Version:** 1.0.0  
**Last Updated:** 2026-05-31  
**Author:** Local AI Voice Generator Team
