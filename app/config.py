import os
import sys
from pathlib import Path


def _get_data_dir() -> Path:
    """Writable directory for models, outputs, venv.
    Priority: VELLUM_DATA_DIR env var → frozen-exe parent → project root.
    """
    if 'VELLUM_DATA_DIR' in os.environ:
        return Path(os.environ['VELLUM_DATA_DIR']).resolve()
    if getattr(sys, 'frozen', False):
        return Path(sys.executable).parent
    return Path(__file__).resolve().parent.parent


def _get_resource_dir() -> Path:
    """Read-only directory where app source code lives."""
    if getattr(sys, 'frozen', False):
        return Path(sys._MEIPASS)
    return Path(__file__).resolve().parent.parent


RESOURCE_DIR = _get_resource_dir()
BASE_DIR = _get_data_dir()
APP_DIR = RESOURCE_DIR / "app"
WEB_DIR = RESOURCE_DIR / "web"
MODELS_DIR = BASE_DIR / "models"
KOKORO_DIR = MODELS_DIR / "kokoro"
SILERO_DIR = MODELS_DIR / "silero"
OUTPUTS_DIR = BASE_DIR / "outputs"
JOBS_DIR = OUTPUTS_DIR / "jobs"
FINAL_DIR = OUTPUTS_DIR / "final"

HOST = "127.0.0.1"
PORT = 8000
DEFAULT_MODEL = "kokoro"
DEFAULT_VOICE = "af_heart"
DEFAULT_SPEED = 1.0
DEFAULT_FORMAT = "wav"
MAX_CHUNK_CHARS = 1200
SILENCE_BETWEEN_CHUNKS_MS = 500

AVAILABLE_MODELS = [
    {"id": "kokoro", "name": "Kokoro (fast, lightweight)"},
    {"id": "silero", "name": "Silero TTS (high quality)"},
]

os.makedirs(KOKORO_DIR, exist_ok=True)
os.makedirs(SILERO_DIR, exist_ok=True)
os.makedirs(JOBS_DIR, exist_ok=True)
os.makedirs(FINAL_DIR, exist_ok=True)
