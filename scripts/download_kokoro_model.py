"""Download Kokoro model file for offline use.
Respects VELLUM_DATA_DIR env var so Electron can write to userData.
Silero model auto-downloads via torch.hub, no separate step needed.
"""
import os
import sys
import urllib.request
from pathlib import Path

# Data root: env var (Electron) → project root (CLI)
data_root = Path(os.environ.get("VELLUM_DATA_DIR", Path(__file__).resolve().parent.parent))

model_dir  = data_root / "models" / "kokoro"
model_dir.mkdir(parents=True, exist_ok=True)

model_path = model_dir / "kokoro-v1_0.pth"

# Remove old corrupt stub if present
old = model_dir / "kokoro-v0_19.pth"
if old.exists():
    old.unlink()
    print("Removed old model stub.")

if model_path.exists() and model_path.stat().st_size > 1_000_000:
    print(f"Kokoro model already present at {model_path}  ({model_path.stat().st_size // 1_048_576} MB)")
    sys.exit(0)

url = "https://huggingface.co/hexgrad/Kokoro-82M/resolve/main/kokoro-v1_0.pth"
print(f"Downloading Kokoro model (~310 MB) from HuggingFace…")

def _progress(block_num: int, block_size: int, total_size: int) -> None:
    downloaded = block_num * block_size
    if total_size > 0:
        pct      = min(downloaded / total_size * 100, 100)
        mb       = downloaded / 1_048_576
        total_mb = total_size / 1_048_576
        sys.stdout.write(f"\r  {pct:.1f}%  {mb:.0f} / {total_mb:.0f} MB  ")
        sys.stdout.flush()

tmp = model_path.with_suffix(".pth.tmp")
try:
    urllib.request.urlretrieve(url, str(tmp), reporthook=_progress)
    print()
    tmp.rename(model_path)
    print(f"Saved to {model_path}  ({model_path.stat().st_size // 1_048_576} MB)")
except Exception as e:
    if tmp.exists():
        tmp.unlink()
    print(f"\nDownload failed: {e}", file=sys.stderr)
    sys.exit(1)
