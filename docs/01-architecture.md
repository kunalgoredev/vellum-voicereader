# System Architecture

**Document Version:** 1.0.0  
**Classification:** Technical Architecture Document

---

## 1. High-Level Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                        User's Browser                            │
│                    http://127.0.0.1:8000                         │
└──────────────────────────┬───────────────────────────────────────┘
                           │ HTTP (REST API)
                           ▼
┌──────────────────────────────────────────────────────────────────┐
│                       FastAPI Backend                             │
│                    uvicorn server (Python)                        │
├──────────────────────────────────────────────────────────────────┤
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────────────────┐  │
│  │  Router  │ │  Text    │ │ Chunker  │ │   TTS Engine       │  │
│  │ (main.py)│ │ Cleaner  │ │(chunker. │ │ ┌──────┐ ┌──────┐  │  │
│  │          │ │(text_    │ │ py)      │ │ │Kokoro│ │Silero│  │  │
│  │          │ │cleaner.py│ │          │ │ │TTS   │ │TTS   │  │  │
│  └──────────┘ └──────────┘ └──────────┘ │ └──────┘ └──────┘  │  │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ └────────────────────┘  │
│  │ Audio    │ │ Job      │ │ Device   │                          │
│  │ Tools    │ │ Store    │ │ Utils    │                          │
│  │(audio_   │ │(job_     │ │(device_  │                          │
│  │ tools.py)│ │ store.py)│ │ utils.py)│                          │
│  └──────────┘ └──────────┘ └──────────┘                          │
└──────────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────────┐
│                      Local File System                            │
├──────────────────────────────────────────────────────────────────┤
│  outputs/jobs/{job_id}/                                          │
│  ├── input_raw.txt          (original script)                    │
│  ├── input_cleaned.txt      (after text cleaning)                │
│  ├── metadata.json          (job metadata)                       │
│  ├── chunks/                (text chunks)                        │
│  ├── audio_chunks/          (per-chunk WAV files)                │
│  └── final/                 (combined output files)               │
└──────────────────────────────────────────────────────────────────┘
```

---

## 2. Component Descriptions

### 2.1 FastAPI Web Server (`main.py`)

The central entry point. A FastAPI application running under uvicorn that:
- Serves the static web UI
- Exposes REST API endpoints for voice generation
- Manages job lifecycle (creation, execution, completion)
- Handles file downloads

**Key design decisions:**
- Synchronous job execution within the request handler for simplicity
- File-based storage (no database dependency)
- Static file mounting for the web UI

### 2.2 Text Cleaner (`text_cleaner.py`)

A pipeline of text normalization functions that transform raw YouTube scripts into narration-ready text:

1. **Newline normalization** — Standardizes line endings
2. **Production note removal** — Strips `[pause]`, `[show image]`, `(camera zooms in)`, etc.
3. **Speaker label removal** — Removes `HOST:`, `Narrator:`, `Scene:`, etc.
4. **Markdown stripping** — Removes `#`, `*`, `---`, `___`, ` ``` `
5. **Punctuation normalization** — Converts `...` → `.`, `!!!` → `!`, `::` → `.`, etc.
6. **Symbol expansion** — `&` → "and", `%` → "percent", `$` → "dollars"
7. **URL removal** — Strips http:// and https:// URLs
8. **Bracket content removal** — Strips `(...)` and `[...]` content
9. **Whitespace normalization** — Collapses multiple spaces and blank lines

### 2.3 Chunker (`chunker.py`)

Splits cleaned text into segments suitable for TTS processing:

- **Paragraph-level splitting** — Respects natural paragraph boundaries
- **Sentence-aware** — Never cuts mid-sentence
- **Configurable max size** — Default 1200 characters per chunk
- **Punctuation termination** — Every chunk ends with `.`, `!`, or `?`

### 2.4 TTS Engine Layer

A unified interface with two implementations:

#### Kokoro TTS (`tts_engine.py`)
- **Type:** Lightweight neural TTS
- **Model:** ~300MB, auto-downloaded from HuggingFace
- **Voices:** 9 (5 female, 4 male)
- **Sample rate:** 24000 Hz (native)
- **Pipeline caching:** Pipeline is initialized once and reused for all chunks
- **Performance:** ~0.3s per chunk after pipeline load

#### Silero TTS (`tts_silero.py`)
- **Type:** High-quality neural TTS
- **Model:** ~150MB, auto-downloaded via torch.hub
- **Voices:** 2 models (LJSpeech female, v3_en multi-speaker)
- **Sample rate:** 16000 Hz (LJSpeech) / 48000 Hz (v3_en) — resampled to 24000 Hz
- **Performance:** ~1-2s per chunk

### 2.5 Audio Tools (`audio_tools.py`)

Post-processing pipeline for generated audio:

- **Chunk combination** — Reads all chunk WAV files, resamples to 24000 Hz, concatenates with 500ms silence between chunks
- **WAV output** — Standard PCM 16-bit WAV at 24000 Hz
- **MP3 conversion** — Via pydub/ffmpeg (optional, graceful degradation)

### 2.6 Device Utils (`device_utils.py`)

Cross-platform GPU detection:

```python
def get_device() -> str:
    if torch.cuda.is_available(): return "cuda"       # NVIDIA GPUs
    if torch.backends.mps.is_available(): return "mps" # Apple Silicon
    return "cpu"                                       # Fallback
```

### 2.7 Job Store (`job_store.py`)

File-based persistence for job metadata. Each job creates a directory under `outputs/jobs/` with a `metadata.json` file containing all job parameters and file references.

---

## 3. Data Flow — Generate Request

```
User clicks "Generate Voice"
        │
        ▼
POST /api/generate (text, model, voice, speed, format)
        │
        ├─► Create job directory
        ├─► Save raw text to input_raw.txt
        ├─► Clean text (text_cleaner.py)
        ├─► Save cleaned text to input_cleaned.txt
        ├─► Split into chunks (chunker.py)
        ├─► Save chunk text files
        │
        ├─► FOR each chunk:
        │     ├─► Generate audio (tts_engine.py or tts_silero.py)
        │     └─► Save to audio_chunks/chunk_NNN.wav
        │
        ├─► Combine audio chunks (audio_tools.py)
        ├─► Optionally convert to MP3
        ├─► Save metadata.json
        │
        └─► Return { job_id, status: "complete" }
```

---

## 4. Job Directory Structure

```
outputs/jobs/job_12/
├── input_raw.txt              (original pasted text)
├── input_cleaned.txt          (after text cleaning)
├── metadata.json              (job metadata)
├── chunks/
│   ├── chunk_001.txt
│   ├── chunk_002.txt
│   └── chunk_003.txt
├── audio_chunks/
│   ├── chunk_001.wav
│   ├── chunk_002.wav
│   └── chunk_003.wav
└── final/
    ├── final_af_sky_kokoro.wav
    └── final_af_sky_kokoro.mp3  (if MP3 format selected)
```

---

## 5. Technology Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Backend Framework | FastAPI | Async support, automatic OpenAPI docs, lightweight |
| Web Server | uvicorn | ASGI server, production-ready, auto-reload for dev |
| Frontend | Vanilla HTML/JS/CSS | Zero build step, no dependencies, works everywhere |
| Primary TTS | Kokoro | Lightweight, fast, natural, ~300MB model |
| Secondary TTS | Silero | High quality, PyTorch-native, MPS support |
| Deep Learning | PyTorch 2.5+ | Industry standard, CUDA + MPS support |
| Audio Processing | soundfile, pydub, scipy | WAV I/O, MP3 conversion, resampling |
| GPU Computing | CUDA (NVIDIA), MPS (Apple) | Automatic hardware acceleration |
| Package Manager | uv | Fast dependency resolution, Python version management |

---

## 6. Security & Privacy

- **Zero network requests** during operation (after initial model download)
- **No telemetry** — The application does not phone home
- **No user data collection** — All data stays on the local machine
- **File isolation** — Each job is sandboxed in its own directory
- **No database** — No SQLite, no network services, no exposed ports beyond localhost

---

## 7. Scalability Considerations

The current architecture is single-user, single-threaded. For production scaling:

- **Concurrent requests** — Implement async job queue with Celery/Redis
- **Batch processing** — Add batch job submission for multiple scripts
- **GPU resource pooling** — Queue TTS tasks to avoid GPU OOM errors
- **Streaming output** — Stream generated audio chunks as they complete

---

**Document Version:** 1.0.0  
**Last Updated:** 2026-05-31  
**Author:** Local AI Voice Generator Team
