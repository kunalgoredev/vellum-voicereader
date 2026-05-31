import json
from pathlib import Path
from datetime import datetime, timezone

from fastapi import FastAPI, Form
from fastapi.responses import HTMLResponse, FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
import uvicorn
import torch

from app.config import WEB_DIR, JOBS_DIR, HOST, PORT, AVAILABLE_MODELS
from app.device_utils import get_device, get_device_name

app = FastAPI(title="Local AI Voice Generator (macOS)")

app.mount("/web", StaticFiles(directory=str(WEB_DIR)), name="web")


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


_kokoro_voices = [
    {"id": "af_heart", "name": "Female - Heart", "model": "kokoro"},
    {"id": "af_bella", "name": "Female - Bella", "model": "kokoro"},
    {"id": "af_nicole", "name": "Female - Nicole", "model": "kokoro"},
    {"id": "af_sarah", "name": "Female - Sarah", "model": "kokoro"},
    {"id": "af_sky", "name": "Female - Sky", "model": "kokoro"},
    {"id": "am_adam", "name": "Male - Adam", "model": "kokoro"},
    {"id": "am_michael", "name": "Male - Michael", "model": "kokoro"},
    {"id": "am_liam", "name": "Male - Liam", "model": "kokoro"},
    {"id": "am_onyx", "name": "Male - Onyx", "model": "kokoro"},
]


@app.get("/api/models")
async def list_models():
    return {"models": AVAILABLE_MODELS}


@app.get("/")
async def index():
    index_path = WEB_DIR / "index.html"
    if not index_path.exists():
        return HTMLResponse("<h1>UI not found</h1>", status_code=404)
    return HTMLResponse(index_path.read_text(encoding="utf-8"))


@app.get("/api/voices")
async def list_voices(model: str = "kokoro"):
    if model == "silero":
        from app.tts_silero import get_available_speakers
        return {"voices": get_available_speakers(), "model": model}
    return {"voices": _kokoro_voices, "model": model}


@app.post("/api/generate")
async def generate(
    text: str = Form(...),
    model: str = Form("kokoro"),
    voice: str = Form("af_heart"),
    speed: float = Form(1.0),
    output_format: str = Form("wav"),
    clean_text: bool = Form(True),
):
    job_id = _next_job_id()

    job_dir = JOBS_DIR / job_id
    chunks_dir = job_dir / "chunks"
    audio_chunks_dir = job_dir / "audio_chunks"
    final_dir = job_dir / "final"

    chunks_dir.mkdir(parents=True, exist_ok=True)
    audio_chunks_dir.mkdir(parents=True, exist_ok=True)
    final_dir.mkdir(parents=True, exist_ok=True)

    print(f"\n[JOB {job_id}] Model: {model}, Voice: {voice}, Speed: {speed}, Format: {output_format}")

    raw_path = job_dir / "input_raw.txt"
    raw_path.write_text(text, encoding="utf-8")
    print(f"[JOB] Raw text saved ({len(text)} chars)")

    cleaned = text
    if clean_text:
        from app.text_cleaner import clean_text
        cleaned = clean_text(text)

    cleaned_path = job_dir / "input_cleaned.txt"
    cleaned_path.write_text(cleaned, encoding="utf-8")
    print(f"[JOB] Cleaned text saved ({len(cleaned)} chars)")

    from app.chunker import chunk_text
    chunks = chunk_text(cleaned)
    print(f"[JOB] Split into {len(chunks)} chunks")

    for i, chunk in enumerate(chunks, 1):
        (chunks_dir / f"chunk_{i:03d}.txt").write_text(chunk, encoding="utf-8")

    if model == "silero":
        from app import tts_silero as tts
    else:
        from app import tts_engine as tts

    for i, chunk in enumerate(chunks, 1):
        print(f"\n[JOB] Generating chunk {i}/{len(chunks)} ({len(chunk)} chars)")
        wav_path = audio_chunks_dir / f"chunk_{i:03d}.wav"
        tts.generate_chunk_audio(chunk, voice, speed, wav_path)

    print(f"\n[JOB] Combining audio chunks...")
    from app.audio_tools import combine_audio_chunks
    final_wav_name = f"final_{voice}_{model}.wav"
    final_wav = final_dir / final_wav_name
    combine_audio_chunks(audio_chunks_dir, final_wav)

    final_mp3 = None
    final_mp3_name = None
    if output_format == "mp3":
        from app.audio_tools import convert_to_mp3
        final_mp3_name = f"final_{voice}_{model}.mp3"
        final_mp3 = final_dir / final_mp3_name
        convert_to_mp3(final_wav, final_mp3)

    now = datetime.now(timezone.utc)
    metadata = {
        "job_id": job_id,
        "model": model,
        "created_at": now.strftime("%Y-%m-%d %H:%M:%S"),
        "voice": voice,
        "speed": speed,
        "status": "complete",
        "raw_text_file": "input_raw.txt",
        "cleaned_text_file": "input_cleaned.txt",
        "final_wav": final_wav_name,
        "final_mp3": final_mp3_name,
    }
    (job_dir / "metadata.json").write_text(json.dumps(metadata, indent=2), encoding="utf-8")

    print(f"[JOB {job_id}] Complete\n")

    return {
        "job_id": job_id,
        "status": "complete",
    }


@app.get("/api/device")
async def get_device_info():
    return {
        "device": get_device(),
        "gpu": get_device_name(),
    }


@app.get("/api/jobs/{job_id}")
async def job_status(job_id: str):
    job_dir = JOBS_DIR / job_id
    if not job_dir.exists():
        return JSONResponse({"error": "Job not found"}, status_code=404)
    meta_path = job_dir / "metadata.json"
    if meta_path.exists():
        metadata = json.loads(meta_path.read_text(encoding="utf-8"))
        return metadata
    return {"job_id": job_id, "status": "unknown"}


@app.get("/api/jobs/{job_id}/files")
async def job_files(job_id: str):
    job_dir = JOBS_DIR / job_id
    if not job_dir.exists():
        return JSONResponse({"error": "Job not found"}, status_code=404)

    files = []
    final_dir = job_dir / "final"
    if final_dir.exists():
        for f in sorted(final_dir.iterdir()):
            files.append({"name": f.name, "path": f"api/download/{job_id}/{f.name}"})

    return {"job_id": job_id, "files": files}


@app.get("/api/download/{job_id}/{filename:path}")
async def download_file(job_id: str, filename: str):
    job_dir = JOBS_DIR / job_id
    file_path = job_dir / "final" / filename
    if not file_path.exists():
        file_path = job_dir / filename
    if not file_path.exists():
        return JSONResponse({"error": "File not found"}, status_code=404)
    media_type = "audio/wav" if file_path.suffix == ".wav" else "audio/mpeg" if file_path.suffix == ".mp3" else "text/plain"
    return FileResponse(str(file_path), media_type=media_type, filename=file_path.name)


@app.get("/api/history")
async def history():
    jobs = []
    if JOBS_DIR.exists():
        for job_dir in sorted(JOBS_DIR.iterdir(), reverse=True):
            meta_path = job_dir / "metadata.json"
            if meta_path.exists():
                jobs.append(json.loads(meta_path.read_text(encoding="utf-8")))
    return {"jobs": jobs}


if __name__ == "__main__":
    dev = get_device()
    print(f"Device: {dev}")
    print(f"GPU: {get_device_name()}")
    if dev == "cpu":
        print("Warning: No GPU detected. Running on CPU may be slow.")
    uvicorn.run(app, host=HOST, port=PORT)
