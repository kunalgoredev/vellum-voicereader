"""Download Kokoro model file for offline use.
Silero model auto-downloads via torch.hub, no separate step needed.
"""
from pathlib import Path
import urllib.request

model_dir = Path("models") / "kokoro"
model_dir.mkdir(parents=True, exist_ok=True)
model_path = model_dir / "kokoro-v1_0.pth"

if model_path.exists():
    print(f"Kokoro model already exists at {model_path}")
    exit(0)

url = "https://huggingface.co/hexgrad/Kokoro-82M/resolve/main/kokoro-v1_0.pth"
print(f"Downloading Kokoro model (~310MB) from HuggingFace...")
print(f"URL: {url}")

import sys

def progress(block_num, block_size, total_size):
    downloaded = block_num * block_size
    if total_size > 0:
        pct = min(downloaded / total_size * 100, 100)
        mb = downloaded / 1024 / 1024
        total_mb = total_size / 1024 / 1024
        sys.stdout.write(f"\r  {pct:.1f}%  {mb:.1f} / {total_mb:.1f} MB")
        sys.stdout.flush()

tmp_path = model_path.with_suffix(".pth.tmp")
urllib.request.urlretrieve(url, str(tmp_path), reporthook=progress)
print()
tmp_path.rename(model_path)
print(f"Kokoro model saved to {model_path}")
