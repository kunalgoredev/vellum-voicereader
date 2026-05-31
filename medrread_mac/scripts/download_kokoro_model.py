from pathlib import Path
from app.config import KOKORO_DIR

model_dir = KOKORO_DIR
model_dir.mkdir(parents=True, exist_ok=True)
model_path = model_dir / "kokoro-v0_19.pth"

if model_path.exists():
    print(f"Kokoro model already exists at {model_path}")
    exit(0)

try:
    from huggingface_hub import hf_hub_download
    hf_hub_download(repo_id="hexgrad/Kokoro-82M", filename="kokoro-v0_19.pth", local_dir=str(model_dir))
    print(f"Kokoro model saved to {model_path}")
except Exception:
    import urllib.request
    url = "https://huggingface.co/hexgrad/Kokoro-82M/resolve/main/kokoro-v0_19.pth"
    print(f"Downloading Kokoro model from {url}...")
    urllib.request.urlretrieve(url, str(model_path))
    print(f"Kokoro model saved to {model_path}")
