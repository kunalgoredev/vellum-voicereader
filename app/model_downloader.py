import json
import os
import time
import hashlib
import threading
from pathlib import Path

import requests

from app.config import MODELS_DIR

_download_state = {}
_download_lock = threading.Lock()

CHUNK_SIZE = 1024 * 1024
MAX_RETRIES = 3

_FALLBACK_SOURCES = {
    "provider": "google_drive",
    "models": {
        "kokoro": {
            "filename": "kokoro-v0_19.pth",
            "description": "Kokoro TTS Model (~320MB) — Required for the fast, lightweight TTS engine",
            "size_mb": 320,
            "url": "https://drive.google.com/uc?export=download&id=YOUR_GOOGLE_DRIVE_FILE_ID",
            "alt_urls": {
                "huggingface": "https://huggingface.co/hexgrad/Kokoro-82M/resolve/main/kokoro-v0_19.pth"
            }
        }
    }
}


def _load_sources() -> dict:
    sources_path = Path(__file__).parent / "model_sources.json"
    if sources_path.exists():
        try:
            return json.loads(sources_path.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, IOError):
            pass

    import sys
    if getattr(sys, 'frozen', False):
        meipass = getattr(sys, '_MEIPASS', None)
        if meipass:
            bundled = Path(meipass) / "model_sources.json"
            if bundled.exists():
                try:
                    return json.loads(bundled.read_text(encoding="utf-8"))
                except (json.JSONDecodeError, IOError):
                    pass

    return _FALLBACK_SOURCES


def _sha256(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        while True:
            chunk = f.read(65536)
            if not chunk:
                break
            h.update(chunk)
    return h.hexdigest()


def get_model_status() -> list[dict]:
    sources = _load_sources()
    result = []
    for model_id, info in sources.get("models", {}).items():
        model_dir = MODELS_DIR / model_id
        existing = list(model_dir.glob("*.pth")) + list(model_dir.glob("*.pt"))
        file_path = existing[0] if existing else None
        size_bytes = file_path.stat().st_size if file_path else None

        with _download_lock:
            state = _download_state.get(model_id, {})

        result.append({
            "id": model_id,
            "filename": info["filename"],
            "description": info.get("description", ""),
            "downloaded": file_path is not None,
            "size_bytes": size_bytes,
            "size_mb": info.get("size_mb"),
            "downloading": state.get("active", False),
            "progress": state.get("progress", 0),
            "error": state.get("error"),
        })
    return result


def _resolve_gdrive_url(url: str, session: requests.Session) -> str:
    headers = {"User-Agent": "LocalAIVoiceGenerator/1.0"}
    resp = session.get(url, stream=True, headers=headers, allow_redirects=True, timeout=30)

    first_chunk = None
    try:
        first_chunk = next(resp.iter_content(8192), None)
    except StopIteration:
        pass

    if first_chunk and first_chunk.startswith(b"<!DOCTYPE html") or (first_chunk and b"uc-download-link" in first_chunk):
        content = first_chunk + b"".join(resp.iter_content(65536))
        text = content.decode("utf-8", errors="ignore")

        import re
        confirm = None
        confirm_match = re.search(r'name="confirm"\s+value="([^"]+)"', text)
        if confirm_match:
            confirm = confirm_match.group(1)
        if not confirm:
            confirm_match = re.search(r"confirm=([0-9A-Za-z_\-]+)", text)
            if confirm_match:
                confirm = confirm_match.group(1)

        if confirm:
            file_id_match = re.search(r'id=([0-9A-Za-z_\-]+)', url)
            file_id = file_id_match.group(1) if file_id_match else ""
            return f"https://drive.google.com/uc?export=download&confirm={confirm}&id={file_id}"

    return url


def download_model(model_id: str) -> dict:
    sources = _load_sources()
    model_info = sources.get("models", {}).get(model_id)
    if not model_info:
        return {"error": f"Unknown model: {model_id}"}

    model_dir = MODELS_DIR / model_id
    model_dir.mkdir(parents=True, exist_ok=True)
    output_path = model_dir / model_info["filename"]

    if output_path.exists():
        return {"status": "already_downloaded", "path": str(output_path)}

    url = model_info.get("url", "")
    if not url:
        alt = model_info.get("alt_urls", {})
        url = alt.get("huggingface", "")

    if not url:
        return {"error": f"No download URL configured for model: {model_id}"}

    with _download_lock:
        _download_state[model_id] = {
            "active": True,
            "progress": 0,
            "total": 0,
            "speed": 0,
            "error": None,
        }

    def run():
        session = requests.Session()
        tmp_path = output_path.with_suffix(output_path.suffix + ".tmp")

        for attempt in range(1, MAX_RETRIES + 1):
            try:
                resolved_url = url
                if "drive.google.com" in url:
                    resolved_url = _resolve_gdrive_url(url, session)

                headers = {"User-Agent": "LocalAIVoiceGenerator/1.0"}
                if tmp_path.exists():
                    resume_pos = tmp_path.stat().st_size
                    headers["Range"] = f"bytes={resume_pos}-"
                else:
                    resume_pos = 0

                resp = session.get(resolved_url, stream=True, headers=headers, timeout=60)
                total = int(resp.headers.get("Content-Length", 0))

                if "Content-Range" in resp.headers:
                    range_val = resp.headers["Content-Range"]
                    if "/" in range_val:
                        total = int(range_val.split("/")[-1])

                mode = "ab" if resume_pos > 0 else "wb"
                downloaded = resume_pos

                with _download_lock:
                    _download_state[model_id]["total"] = total + resume_pos if total else 0

                t0 = time.time()
                last_progress_time = t0

                with open(tmp_path, mode) as f:
                    for chunk in resp.iter_content(chunk_size=CHUNK_SIZE):
                        if chunk:
                            f.write(chunk)
                            downloaded += len(chunk)

                            now = time.time()
                            if now - last_progress_time >= 0.5:
                                elapsed = now - t0
                                speed = (downloaded - resume_pos) / elapsed if elapsed > 0 else 0
                                total_display = total + resume_pos if total else model_info.get("size_mb", 0) * 1024 * 1024
                                pct = int(downloaded / total_display * 100) if total_display > 0 else 0
                                with _download_lock:
                                    _download_state[model_id].update({
                                        "progress": pct,
                                        "downloaded_bytes": downloaded,
                                        "speed": speed,
                                    })
                                last_progress_time = now

                tmp_path.rename(output_path)
                with _download_lock:
                    _download_state[model_id].update({
                        "active": False,
                        "progress": 100,
                        "downloaded_bytes": downloaded,
                    })
                return

            except Exception as e:
                if attempt < MAX_RETRIES:
                    time.sleep(2 ** attempt)
                else:
                    with _download_lock:
                        _download_state[model_id].update({
                            "active": False,
                            "error": str(e),
                        })
                    if tmp_path.exists():
                        tmp_path.unlink(missing_ok=True)
                    return

    threading.Thread(target=run, daemon=True).start()
    return {"status": "downloading"}


def get_download_progress(model_id: str) -> dict:
    with _download_lock:
        return _download_state.get(model_id, {"active": False, "progress": 0})


def is_setup_needed() -> bool:
    sources = _load_sources()
    if not sources.get("models"):
        return False
    for model_id in sources["models"]:
        model_dir = MODELS_DIR / model_id
        existing = list(model_dir.glob("*.pth")) + list(model_dir.glob("*.pt"))
        if not existing:
            return True
    return False
