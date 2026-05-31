# Local AI Voice Generator — Technical Documentation

**Version 1.0.0**  
**Platforms:** Windows (x86_64), macOS (Apple Silicon & Intel)  
**License:** Proprietary — All Rights Reserved

---

## Table of Contents

1. [System Architecture](01-architecture.md)
2. [Installation Guide — Windows](02-installation-windows.md)
3. [Installation Guide — macOS](03-installation-macos.md)
4. [User Guide](04-user-guide.md)
5. [Developer Guide](05-developer-guide.md)
6. [API Reference](06-api-reference.md)
7. [Deployment & Distribution](07-deployment.md)
8. [Troubleshooting](08-troubleshooting.md)
9. [FAQ](09-faq.md)

---

## Quick Start

### Windows
```cmd
scripts\01_create_venv.bat
scripts\02_install_requirements.bat
scripts\04_start_app.bat
```

### macOS
```bash
bash scripts/01_create_venv.sh
bash scripts/02_install_requirements.sh
bash scripts/04_start_app.sh
```

Open http://127.0.0.1:8000 in any browser.

---

## Product Overview

Local AI Voice Generator is a fully offline, privacy-first text-to-speech application designed for content creators who need high-quality AI voice narration for YouTube scripts, podcasts, audiobooks, and long-form content.

### Key Features

- **Fully Offline** — No internet required after initial setup. No cloud APIs. No data leaves your machine.
- **Dual Engine Architecture** — Choose between Kokoro (fast, lightweight) and Silero TTS (high-quality, expressive).
- **GPU Accelerated** — Automatically detects and leverages CUDA (NVIDIA), MPS (Apple Silicon), or falls back to CPU.
- **Intelligent Text Processing** — Built-in text cleaner removes YouTube script artifacts (timestamps, speaker labels, production notes, markdown) for natural narration.
- **Smart Chunking** — Automatically splits long scripts into optimal-sized chunks while preserving sentence boundaries.
- **Progress Tracking** — Real-time generation progress for long scripts.
- **Job History** — All generated files are saved locally with metadata for easy retrieval.
- **Multiple Output Formats** — WAV and MP3 support.
- **Simple Web UI** — No installation required on client machines. Works in any browser.

### Use Cases

- YouTube narration voiceovers
- Audiobook and podcast production
- E-learning content creation
- Accessibility (text-to-speech for visual impairments)
- Voice prototyping for content creators

---

## System Requirements

### Windows
| Component | Minimum | Recommended |
|-----------|---------|-------------|
| OS | Windows 10 64-bit | Windows 11 |
| CPU | x86_64, 4 cores | AMD Ryzen 9 / Intel i9 |
| RAM | 8 GB | 32 GB |
| GPU | NVIDIA GTX 1060 6GB | NVIDIA RTX 4080 12GB+ |
| Storage | 5 GB free | 10 GB SSD |
| Python | 3.11 | 3.11 |
| Software | — | Visual C++ Build Tools (for development) |

### macOS
| Component | Minimum | Recommended |
|-----------|---------|-------------|
| OS | macOS 13 (Ventura) | macOS 14 (Sonoma) or newer |
| CPU | Intel x86_64 | Apple Silicon (M1/M2/M3/M4) |
| RAM | 8 GB | 16 GB+ |
| GPU | — | Apple Silicon (MPS acceleration) |
| Storage | 5 GB free | 10 GB SSD |
| Python | 3.11 | 3.11 |

---

## License & Commercial Use

This software is developed for commercial distribution. Each installation requires a valid license. Contact the development team for licensing inquiries.

---

**Document Version:** 1.0.0  
**Last Updated:** 2026-05-31  
**Author:** Local AI Voice Generator Team
