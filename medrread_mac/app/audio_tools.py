from pathlib import Path

import numpy as np
import soundfile as sf


SILENCE_MS = 500
SAMPLE_RATE = 24000


def combine_audio_chunks(chunks_dir: Path, output_path: Path):
    wav_files = sorted(chunks_dir.glob("chunk_*.wav"))
    if not wav_files:
        silence = np.zeros(int(SAMPLE_RATE * 0.5), dtype=np.float32)
        sf.write(str(output_path), silence, SAMPLE_RATE)
        return

    combined = []
    sr = SAMPLE_RATE
    silence_samples = int(SAMPLE_RATE * SILENCE_MS / 1000)

    for i, wav_file in enumerate(wav_files):
        try:
            data, file_sr = sf.read(str(wav_file))
            if file_sr != sr:
                from scipy import signal
                data = signal.resample(data, int(len(data) * sr / file_sr))
            combined.append(data)
            if i < len(wav_files) - 1:
                combined.append(np.zeros(silence_samples, dtype=data.dtype))
        except Exception as e:
            print(f"Error reading {wav_file.name}: {e}")

    if combined:
        final = np.concatenate(combined)
        sf.write(str(output_path), final, sr)
    else:
        silence = np.zeros(int(SAMPLE_RATE * 0.5), dtype=np.float32)
        sf.write(str(output_path), silence, SAMPLE_RATE)


def convert_to_mp3(wav_path: Path, mp3_path: Path):
    try:
        from pydub import AudioSegment
        audio = AudioSegment.from_wav(str(wav_path))
        audio.export(str(mp3_path), format="mp3")
    except Exception as e:
        print(f"MP3 conversion failed (install ffmpeg): {e}")
        import shutil
        shutil.copy2(str(wav_path), str(mp3_path))
