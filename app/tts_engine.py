import time
from pathlib import Path

import numpy as np
import soundfile as sf
import torch

from app.config import KOKORO_DIR


_pipeline_cache = {}


def _get_model_path() -> Path | None:
    pth_files = list(KOKORO_DIR.glob("*.pth")) + list(KOKORO_DIR.glob("*.pt"))
    return pth_files[0] if pth_files else None


_voice_map = {
    "af_heart": ("af_heart", "a"),
    "af_bella": ("af_bella", "a"),
    "af_nicole": ("af_nicole", "a"),
    "af_sarah": ("af_sarah", "a"),
    "af_sky": ("af_sky", "a"),
    "am_adam": ("am_adam", "a"),
    "am_michael": ("am_michael", "a"),
    "am_liam": ("am_liam", "a"),
    "am_onyx": ("am_onyx", "a"),
}


def _get_pipeline(lang_code: str):
    key = f"pipeline_{lang_code}"
    if key not in _pipeline_cache:
        print(f"[Kokoro] Loading pipeline for lang={lang_code}...")
        t0 = time.time()
        from kokoro import KPipeline

        device = "cuda" if torch.cuda.is_available() else "cpu"

        # kokoro's KModel hardcodes weights_only=True which breaks on PyTorch 2.6
        # with the current model file format — patch it for the duration of load
        _orig_load = torch.load
        torch.load = lambda *a, **kw: _orig_load(*a, **{**kw, "weights_only": False})
        try:
            model_path = _get_model_path()
            if model_path:
                from kokoro import KModel
                kmodel = KModel(model=str(model_path)).to(device).eval()
                _pipeline_cache[key] = KPipeline(lang_code=lang_code, model=kmodel, device=device)
            else:
                _pipeline_cache[key] = KPipeline(lang_code=lang_code, device=device)
        finally:
            torch.load = _orig_load

        print(f"[Kokoro] Pipeline loaded in {time.time() - t0:.1f}s")
    return _pipeline_cache[key]


def generate_chunk_audio(text: str, voice: str, speed: float, output_path: Path):
    voice_name, lang_code = _voice_map.get(voice, ("af_heart", "a"))

    print(f"[Kokoro] Chunk: {len(text)} chars, voice={voice_name}, speed={speed}")

    try:
        pipeline = _get_pipeline(lang_code)
        t0 = time.time()

        if not text.strip():
            print("[Kokoro] Empty text, writing silence")
            sf.write(str(output_path), np.zeros(int(24000 * speed), dtype=np.float32), 24000)
            return

        audio_segments = []
        count = 0
        for result in pipeline(text, voice=voice_name, speed=speed):
            audio_segments.append(result.audio)
            count += 1

        if audio_segments:
            full_audio = np.concatenate(audio_segments)
        else:
            full_audio = np.zeros(int(24000 * speed), dtype=np.float32)

        sf.write(str(output_path), full_audio, 24000)
        print(f"[Kokoro] Generated {count} segments, {len(full_audio)} samples in {time.time() - t0:.1f}s")

    except Exception as e:
        print(f"[Kokoro] ERROR: {type(e).__name__}: {e}")
        import traceback
        traceback.print_exc()
        sf.write(str(output_path), np.zeros(int(24000 * 2), dtype=np.float32), 24000)
