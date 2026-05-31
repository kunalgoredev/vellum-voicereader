import time
from pathlib import Path

import numpy as np
import soundfile as sf
import torch


_tts_cache = {}


def _get_tts():
    if "tts" not in _tts_cache:
        print("[XTTS] Loading XTTS-v2 model (this may take a few minutes)...")
        t0 = time.time()
        from TTS.api import TTS
        device = "cuda" if torch.cuda.is_available() else "cpu"
        _tts_cache["tts"] = TTS("tts_models/multilingual/multi-dataset/xtts_v2").to(device)
        print(f"[XTTS] Model loaded in {time.time() - t0:.1f}s")
    return _tts_cache["tts"]


def generate_chunk_audio(text: str, voice: str, speed: float, output_path: Path):
    print(f"[XTTS] Chunk: {len(text)} chars, speed={speed}")

    try:
        tts = _get_tts()
        t0 = time.time()

        if not text.strip():
            print("[XTTS] Empty text, writing silence")
            sf.write(str(output_path), np.zeros(int(24000), dtype=np.float32), 24000)
            return

        tts.tts_to_file(
            text=text,
            file_path=str(output_path),
            language="en",
            speed=speed,
        )
        print(f"[XTTS] Generated in {time.time() - t0:.1f}s -> {output_path.name}")

    except Exception as e:
        print(f"[XTTS] ERROR: {type(e).__name__}: {e}")
        import traceback
        traceback.print_exc()
        sf.write(str(output_path), np.zeros(int(24000 * 2), dtype=np.float32), 24000)
