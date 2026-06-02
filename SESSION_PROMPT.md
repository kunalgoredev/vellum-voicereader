# Vellum Voice Reader — Session Prompt

Use this at the start of a new Claude session to get up to speed instantly.

---

## Project

**Vellum Voice Reader** — a local AI text-to-speech web app.
Single-user, runs entirely on localhost. No cloud, no auth.

**Stack:** FastAPI + uvicorn backend, vanilla JS/HTML/CSS frontend, Kokoro TTS (primary), Silero TTS (secondary).

**Root:** `C:\livedevelopment\LiveProjects\personal\vellum-voicereader`

---

## How to start

```cmd
start.bat
```

This is the single entry point. It handles venv creation, model download, and server start in one step.
Server runs at `http://127.0.0.1:8000` with `--reload`.

---

## Key files

| File | What it does |
|------|-------------|
| `app/main.py` | FastAPI routes — models, voices, generate, download, history, setup |
| `app/tts_engine.py` | Kokoro TTS — pipeline caching, audio generation |
| `app/model_downloader.py` | Handles model file download + progress tracking |
| `app/model_sources.json` | Download URL config — currently points to HuggingFace `kokoro-v1_0.pth` |
| `app/config.py` | All paths and constants |
| `app/chunker.py` | Splits text into ≤1200 char chunks for TTS |
| `app/text_cleaner.py` | Strips markdown, speaker labels, stage directions from scripts |
| `app/audio_tools.py` | Combines chunk WAVs + optional MP3 conversion |
| `app/job_store.py` | File-based job persistence (metadata.json per job) |
| `web/index.html` | Single-page UI |
| `web/app.js` | All frontend logic |
| `web/style.css` | Dark theme (purple accent, CSS variables in `:root`) |
| `scripts/download_kokoro_model.py` | Standalone download script used by `start.bat` |
| `start.bat` | Master setup + start script |

---

## Current state (as of 2026-06-02)

### Working
- Kokoro TTS generates audio end-to-end ✓
- Model `kokoro-v1_0.pth` (~310 MB) downloads from HuggingFace via `start.bat` ✓
- Voices populate on page load (no need to switch model dropdown first) ✓
- Voice names display as "Female - Heart" etc., not raw HF IDs ✓
- History panel shows human-readable voice names ✓
- UI: dark theme, purple accent (`#6c63ff`), CSS variables throughout ✓

### Known limitations / not yet done
- Generation is **synchronous** — the HTTP request blocks until all chunks are done. Long scripts (100+ chunks) will make the UI appear frozen with no live progress feedback.
- Silero TTS is wired up but **not tested** in the current session — focus has been on Kokoro only.
- No streaming audio output — full file only.
- MP3 export requires ffmpeg on PATH; gracefully falls back to WAV if missing.

---

## Critical implementation notes

### PyTorch 2.6 + kokoro 0.7.16 compatibility patch
`kokoro`'s `KModel.__init__` hardcodes `torch.load(..., weights_only=True)`, which fails with PyTorch 2.6 on the `kokoro-v1_0.pth` format.

**Fix in `tts_engine.py` `_get_pipeline()`:**
```python
_orig_load = torch.load
torch.load = lambda *a, **kw: _orig_load(*a, **{**kw, "weights_only": False})
try:
    # ... KPipeline / KModel creation ...
finally:
    torch.load = _orig_load
```
This patch is scoped to pipeline init only and restores the original after.

### KPipeline API (kokoro 0.7.16)
```python
KPipeline(lang_code="a", model=KModel(...), device="cpu")
# or auto-download:
KPipeline(lang_code="a", device="cpu")   # model=True by default
```
`model_path` kwarg was **removed** in kokoro ≥0.7.12. Do not use it.

### Model file
- Correct file: `models/kokoro/kokoro-v1_0.pth` (312 MB, ZIP/safetensor format starting with `PK`)
- Old corrupt stub `kokoro-v0_19.pth` (1652 bytes, HTML) is auto-deleted by `start.bat`
- `_get_model_path()` in `tts_engine.py` globs for `*.pth` / `*.pt` in `KOKORO_DIR` and returns the first match

### Voice map (in `tts_engine.py` and `main.py`)
```
af_heart  → Female - Heart   (lang: a)
af_bella  → Female - Bella   (lang: a)
af_nicole → Female - Nicole  (lang: a)
af_sarah  → Female - Sarah   (lang: a)
af_sky    → Female - Sky     (lang: a)
am_adam   → Male - Adam      (lang: a)
am_michael→ Male - Michael   (lang: a)
am_liam   → Male - Liam      (lang: a)
am_onyx   → Male - Onyx      (lang: a)
```

### Job output structure
```
outputs/jobs/job_N/
├── input_raw.txt
├── input_cleaned.txt
├── metadata.json
├── chunks/chunk_NNN.txt
├── audio_chunks/chunk_NNN.wav
└── final/final_{voice}_{model}.wav   ← download served from here
```

---

## Useful API endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | Web UI |
| GET | `/api/models` | List TTS engines |
| GET | `/api/voices?model=kokoro` | List voices for model |
| GET | `/api/device` | CUDA/CPU device info |
| POST | `/api/generate` | Generate audio (form: text, model, voice, speed, output_format) |
| GET | `/api/jobs/{id}/files` | List output files for a job |
| GET | `/api/download/{id}/{filename}` | Download output file |
| GET | `/api/history` | List all past jobs |
| GET | `/api/setup/check` | Returns `{setup_needed: bool}` |
| GET | `/api/setup/status` | Model download status |
| POST | `/api/setup/download/kokoro` | Trigger model download |

---

## Docs
Full documentation is in `docs/`:
- `01-architecture.md` — System design
- `02-installation-windows.md` — Setup guide (updated)
- `05-developer-guide.md` — Code reference
- `08-troubleshooting.md` — Known issues including all PyTorch/kokoro compatibility fixes
