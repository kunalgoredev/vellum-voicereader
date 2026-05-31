import json
from pathlib import Path
from app.config import JOBS_DIR


def save_job(job_id: str, metadata: dict):
    job_dir = JOBS_DIR / job_id
    job_dir.mkdir(parents=True, exist_ok=True)
    (job_dir / "metadata.json").write_text(json.dumps(metadata, indent=2), encoding="utf-8")


def load_job(job_id: str):
    meta_path = JOBS_DIR / job_id / "metadata.json"
    if not meta_path.exists():
        return None
    return json.loads(meta_path.read_text(encoding="utf-8"))


def list_jobs():
    jobs = []
    if JOBS_DIR.exists():
        for job_dir in sorted(JOBS_DIR.iterdir(), reverse=True):
            meta_path = job_dir / "metadata.json"
            if meta_path.exists():
                jobs.append(json.loads(meta_path.read_text(encoding="utf-8")))
    return jobs
