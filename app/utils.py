import re


def generate_job_id() -> str:
    from datetime import datetime
    return f"job_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
