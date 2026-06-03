import time
import platform
from pathlib import Path

import numpy as np
import soundfile as sf
import torch

from app.config import KOKORO_DIR


_pipeline_cache = {}


def _get_model_path() -> Path | None:
    pth_files = list(KOKORO_DIR.glob("*.pth")) + list(KOKORO_DIR.glob("*.pt"))
    return pth_files[0] if pth_files else None


def _best_device() -> str:
    """Return the fastest available device.
    Priority: CUDA (NVIDIA) → MPS (Apple Silicon) → CPU
    """
    if torch.cuda.is_available():
        return "cuda"
    # Apple Silicon GPU via Metal Performance Shaders
    if (
        platform.system() == "Darwin"
        and hasattr(torch.backends, "mps")
        and torch.backends.mps.is_available()
        and torch.backends.mps.is_built()
    ):
        return "mps"
    return "cpu"


def _free_device_cache(device: str) -> None:
    """Release unused GPU/MPS memory after generation."""
    try:
        if device == "cuda":
            torch.cuda.empty_cache()
        elif device == "mps":
            torch.mps.empty_cache()
    except Exception:
        pass


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
        device = _best_device()
        print(f"[Kokoro] Loading pipeline lang={lang_code} device={device}...")
        t0 = time.time()
        from kokoro import KPipeline

        # kokoro's KModel hardcodes weights_only=True which breaks on PyTorch 2.6
        # with the current model file format — patch it for the duration of load.
        _orig_load = torch.load
        torch.load = lambda *a, **kw: _orig_load(*a, **{**kw, "weights_only": False})
        try:
            model_path = _get_model_path()
            if model_path:
                from kokoro import KModel
                # Try preferred device; fall back to CPU if unsupported op
                try:
                    kmodel = KModel(model=str(model_path)).to(device).eval()
                except Exception as e:
                    print(f"[Kokoro] {device} failed ({e}), falling back to CPU")
                    device = "cpu"
                    kmodel = KModel(model=str(model_path)).to(device).eval()
                _pipeline_cache[key] = KPipeline(lang_code=lang_code, model=kmodel, device=device)
            else:
                _pipeline_cache[key] = KPipeline(lang_code=lang_code, device=device)
        finally:
            torch.load = _orig_load

        print(f"[Kokoro] Pipeline ready in {time.time() - t0:.1f}s on {device}")
    return _pipeline_cache[key]


def generate_chunk_audio(text: str, voice: str, speed: float, output_path: Path):
    voice_name, lang_code = _voice_map.get(voice, ("af_heart", "a"))

    print(f"[Kokoro] Chunk: {len(text)} chars, voice={voice_name}, speed={speed}")

    try:
        pipeline = _get_pipeline(lang_code)
        # Infer which device the cached pipeline is using
        device = "cpu"
        try:
            device = next(pipeline.model.parameters()).device.type
        except Exception:
            pass

        t0 = time.time()

        if not text.strip():
            print("[Kokoro] Empty text, writing silence")
            sf.write(str(output_path), np.zeros(int(24000 * 0.5), dtype=np.float32), 24000)
            return

        audio_segments = []
        count = 0
        # torch.inference_mode is the lightest context — no grad tracking, minimal RAM
        with torch.inference_mode():
            for result in pipeline(text, voice=voice_name, speed=speed):
                # result.audio may be a torch tensor or numpy array depending on version
                seg = result.audio
                if hasattr(seg, 'cpu'):
                    seg = seg.cpu().numpy()
                audio_segments.append(seg)
                count += 1

        if audio_segments:
            full_audio = np.concatenate(audio_segments)
        else:
            full_audio = np.zeros(int(24000 * 0.5), dtype=np.float32)

        sf.write(str(output_path), full_audio, 24000)
        print(f"[Kokoro] {count} segments, {len(full_audio)/24000:.1f}s audio in {time.time() - t0:.1f}s wall")

        # Free GPU/MPS memory immediately after each chunk — important on shared-memory
        # systems like Apple Silicon where RAM is limited
        _free_device_cache(device)

    except Exception as e:
        print(f"[Kokoro] ERROR: {type(e).__name__}: {e}")
        import traceback
        traceback.print_exc()
        sf.write(str(output_path), np.zeros(int(24000 * 0.5), dtype=np.float32), 24000)
