# Frequently Asked Questions (FAQ)

**Document Version:** 1.0.0  
**Last Updated:** 2026-05-31

---

## 1. General

### Q: What is this software?
A: A fully offline text-to-speech application that converts YouTube scripts and long-form text into natural-sounding AI voice narration. It runs on your local machine with no cloud dependencies.

### Q: Is it free?
A: The development version is free for personal use. Commercial licensing is available for distribution and resale.

### Q: Do I need internet?
A: Only during initial setup (model download). After that, it runs completely offline.

### Q: Does it work on any operating system?
A: Version 1.0 supports Windows (x86_64 with NVIDIA GPU) and macOS (Apple Silicon with MPS acceleration). Intel Macs work in CPU-only mode.

---

## 2. Voice & Quality

### Q: How many voices are available?
A: **Kokoro:** 9 voices (5 female, 4 male). **Silero:** 2 model options (LJSpeech female single-speaker, v3_en multi-speaker).

### Q: Which voice is most natural?
A: For Kokoro, try **af_sky** or **af_heart**. For Silero, the **LJSpeech** voice is considered very natural.

### Q: Can I clone a specific voice?
A: Not in version 1.0. Voice cloning (XTTS-v2 style) is under consideration for a future release.

### Q: Will my audio be detected as AI-generated?
A: All TTS voices carry some risk of detection. Tips to reduce detection:
- Use natural writing styles with varied sentence structure
- Add slight background music in post-production
- Keep speed at 1.0 (natural pace)
- Use Silero LJSpeech for highest quality

### Q: Why does the voice sound robotic?
A: Try:
- Lowering speed to 0.9-1.0
- Switching to a different voice
- Using Silero instead of Kokoro
- Ensuring your text is clean (proper punctuation, no symbols)

---

## 3. Technical

### Q: Why use Kokoro instead of XTTS-v2 or Bark?
A: Kokoro is lightweight (~300MB vs 2-5GB), fast (~0.3s per chunk), and works on a wider range of hardware (including Apple Silicon MPS). XTTS-v2 requires Windows C++ build tools for installation and is heavier.

### Q: Can I use my NVIDIA GPU?
A: Yes. The app auto-detects CUDA-capable NVIDIA GPUs. Your RTX 4080 with 16GB VRAM will work excellently.

### Q: Can I use Apple Silicon GPU?
A: Yes. The app uses MPS (Metal Performance Shaders) on M1/M2/M3/M4 Macs. Requires macOS 12.3+ and PyTorch 2.0+.

### Q: What if I don't have a GPU?
A: The app falls back to CPU. Generation will be slower but functional. A typical sentence takes 1-3 seconds on CPU.

### Q: Can I use this in my own application?
A: Yes. The application exposes a REST API. You can integrate it into any application that can make HTTP requests. See the [API Reference](06-api-reference.md).

### Q: Is there a database?
A: No. All data is stored as JSON files on the local filesystem. No SQLite, no MySQL, no network services.

---

## 4. Script & Text

### Q: What types of text work best?
A: Clean, well-punctuated prose works best. YouTube scripts with speaker labels and production notes are cleaned automatically.

### Q: Does it handle multiple languages?
A: The current version is optimized for English. Kokoro has some multilingual capability, but quality may vary.

### Q: What gets cleaned from my script?
A: The text cleaner removes:
- Speaker labels (HOST:, Narrator:)
- Production notes ([pause], [music], (B-roll))
- Markdown formatting
- URLs
- Repeated punctuation (... → .)
- Bracketed content

### Q: Can I disable text cleaning?
A: Yes. Set `clean_text` to `false` in the API call. The UI version doesn't expose this toggle in v1.0.

### Q: What is the maximum text length?
A: No hard limit. The text is split into ~1200-character chunks and processed sequentially.

---

## 5. Output & Files

### Q: Where are generated files saved?
A: `outputs/jobs/{job_id}/final/`. Each job has its own directory with all intermediate files.

### Q: What audio formats are supported?
A: WAV (always works) and MP3 (requires ffmpeg).

### Q: What is the audio sample rate?
A: All output is 24000 Hz, 16-bit PCM WAV.

### Q: Can I keep the intermediate chunk files?
A: Yes. They are preserved for debugging in `outputs/jobs/{job_id}/audio_chunks/`.

### Q: How do I share the generated audio?
A: Download from the browser UI, or copy from the job directory on your filesystem.

---

## 6. Performance

### Q: How fast is generation?
A: Kokoro: ~0.3 seconds per chunk (about 30 seconds for a 10-minute script). Silero: ~1-2 seconds per chunk.

### Q: Can I speed up generation?
A: Use Kokoro (faster than Silero). GPU acceleration helps significantly. CPU-only mode is 2-5x slower.

### Q: Will I run out of memory with long scripts?
A: Very long scripts (500+ chunks) may use significant RAM as all audio chunks are held in memory before combining. Most YouTube scripts are well under this limit.

---

## 7. Distribution

### Q: Can I distribute this to customers?
A: Yes, with a commercial license. Contact the development team for licensing terms.

### Q: How do I make a standalone installer?
A: See the [Deployment Guide](07-deployment.md):
- Windows: Use PyInstaller to create a single .exe
- macOS: Use py2app to create a .app bundle

### Q: Does the installed version require internet?
A: No. If models are bundled with the installer, it runs fully offline from the first launch.

### Q: Can I brand it as my own product?
A: With a commercial white-label license, yes.

---

## 8. Troubleshooting

### Q: The UI shows "Device: checking..." forever
A: The JavaScript function `checkDevice()` might not be called. Make sure `app.js` has `checkDevice()` called on load (it should be at the bottom of the file with the other initial calls).

### Q: Generation succeeds but I hear silence
A: Check the terminal for `[ERROR]` messages. The TTS engine might have failed silently and written a silence placeholder.

### Q: "Port 8000 already in use"
A: Another application is using port 8000. Kill it or change the port in `app/config.py`.

### Q: The model download fails
A: The download URL might have changed. Check the HuggingFace repository for the correct URL. You can also manually download and place the file in `models/kokoro/`.

---

## 9. Future Plans

### Q: Will you add more voices?
A: Yes. Voice additions are planned for future releases.

### Q: Will you add voice cloning?
A: It's under consideration for version 2.0. Voice cloning requires larger models and more VRAM.

### Q: Will there be a mobile app?
A: Not currently planned. The focus is on desktop content creation.

### Q: Can I contribute features?
A: This is a proprietary product. Feature requests can be submitted through official support channels.

---

## 10. Support

### Q: How do I get help?
A: Check the [Troubleshooting Guide](08-troubleshooting.md) first. For unresolved issues, contact support with your system details and the error message from the terminal.

### Q: How do I report a bug?
A: Please provide:
- Operating system and version
- Python version
- Torch version
- GPU model
- Full terminal output (including error messages)
- Steps to reproduce

---

**Document Version:** 1.0.0  
**Last Updated:** 2026-05-31  
**Author:** Local AI Voice Generator Team
