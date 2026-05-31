import time
from pathlib import Path

import numpy as np
import soundfile as sf
import torch


_model_cache = {}
_available_speakers = None


def _get_model(speaker_id: str):
    key = f"model_{speaker_id}"
    if key not in _model_cache:
        print(f"[Silero] Loading '{speaker_id}'...")
        t0 = time.time()
        model, _ = torch.hub.load(
            repo_or_dir="snakers4/silero-models",
            model="silero_tts",
            language="en",
            speaker=speaker_id,
        )
        device = "cuda" if torch.cuda.is_available() else "cpu"
        model.to(device)
        _model_cache[key] = model
        _model_cache["device"] = device
        print(f"[Silero] '{speaker_id}' loaded in {time.time() - t0:.1f}s on {device}")
    return _model_cache[key]


def get_available_speakers() -> list[dict]:
    global _available_speakers
    if _available_speakers is not None:
        return _available_speakers

    _available_speakers = [
        {"id": "lj_v2", "name": "LJSpeech (Female, Natural)"},
        {"id": "v3_en", "name": "English (Multiple Voices)"},
    ]
    return _available_speakers


def generate_chunk_audio(text: str, voice: str, speed: float, output_path: Path):
    print(f"[Silero] Chunk: {len(text)} chars, voice={voice}, speed={speed}")

    try:
        model = _get_model(voice)
        t0 = time.time()

        if not text.strip():
            sf.write(str(output_path), np.zeros(int(24000), dtype=np.float32), 24000)
            return

        if voice == "v3_en":
            audio_tensors = model.apply_tts(text=text, speaker="en_0", put_accent=True, put_yo=True)
            native_sr = 48000
        else:
            audio_tensors = model.apply_tts(texts=text)
            native_sr = 16000

        if isinstance(audio_tensors, list):
            audio = np.concatenate([a.cpu().numpy() for a in audio_tensors])
        else:
            audio = audio_tensors.cpu().numpy()

        audio = np.asarray(audio, dtype=np.float32)

        if speed != 1.0:
            from scipy import signal
            new_len = int(len(audio) / speed)
            audio = signal.resample(audio, new_len)

        if native_sr != 24000:
            from scipy import signal
            new_len = int(len(audio) * 24000 / native_sr)
            audio = signal.resample(audio, new_len)

        sf.write(str(output_path), audio, 24000)
        print(f"[Silero] Generated {len(audio)} samples at 24000Hz in {time.time() - t0:.1f}s")

    except Exception as e:
        print(f"[Silero] ERROR: {type(e).__name__}: {e}")
        import traceback
        traceback.print_exc()
        sf.write(str(output_path), np.zeros(int(24000 * 2), dtype=np.float32), 24000)
