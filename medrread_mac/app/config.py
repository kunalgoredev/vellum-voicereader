import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
APP_DIR = BASE_DIR / "app"
WEB_DIR = BASE_DIR / "web"
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
