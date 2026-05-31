# User Guide

**Document Version:** 1.0.0  
**Last Updated:** 2026-05-31

---

## 1. Getting Started

After starting the application (see installation guide), open your browser to:
```
http://127.0.0.1:8000
```

You should see the main interface:

```
┌─────────────────────────────────────────────────────────────┐
│  Local AI Voice Generator                                    │
│  Device: cuda - NVIDIA GeForce RTX 4080    Model: [Kokoro ▼] │
│                                                              │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │  Paste your YouTube script or text here...              │ │
│  │                                                         │ │
│  │                                                         │ │
│  └─────────────────────────────────────────────────────────┘ │
│                                                              │
│  Voice: [af_sky ▼]    Speed: [====●=====] 1.0    WAV/MP3    │
│                                                              │
│  [                    Generate Voice                    ]    │
│                                                              │
│  History:                                                    │
│  • job_1 — complete — af_sky                                  │
│  • job_2 — complete — af_bella                                │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Basic Usage

### 2.1 Pasting Text

1. Copy your YouTube script or any text content
2. Paste into the large text area
3. The text can include:
   - Speaker labels (`HOST:`, `Narrator:`)
   - Production notes (`[pause]`, `[show image]`)
   - Markdown formatting
   - Timestamps
   - URLs

The text cleaner will automatically remove or normalize these elements for narration.

### 2.2 Selecting a Model

Use the **Model** dropdown at the top-right to choose:

| Model | Best For | Speed | Quality |
|-------|----------|-------|---------|
| **Kokoro** | Fast generation, short scripts | ~0.3s per chunk | Good, natural |
| **Silero TTS** | High-quality output, long-form | ~1-2s per chunk | Excellent, expressive |

The available voices update automatically when you switch models.

### 2.3 Selecting a Voice (Kokoro)

| Voice ID | Name | Description |
|----------|------|-------------|
| af_heart | Female — Heart | Warm, friendly narrator |
| af_bella | Female — Bella | Clear, articulate |
| af_nicole | Female — Nicole | Soft, soothing |
| af_sarah | Female — Sarah | Energetic, engaging |
| af_sky | Female — Sky | Most natural, smoothest |
| am_adam | Male — Adam | Deep, authoritative |
| am_michael | Male — Michael | Warm baritone |
| am_liam | Male — Liam | Youthful, energetic |
| am_onyx | Male — Onyx | Deep, resonant |

**Recommendation for YouTube narration:** Start with **af_sky** or **af_heart** for female narration, **am_adam** or **am_liam** for male narration.

### 2.4 Selecting a Voice (Silero)

| Voice ID | Name | Description |
|----------|------|-------------|
| lj_v2 | LJSpeech (Female, Natural) | Professional female voice, very natural |
| v3_en | English (Multiple Voices) | Multi-speaker model, selectable internal voices |

### 2.5 Adjusting Speed

The speed slider ranges from **0.5x** to **2.0x**:

| Speed | Effect | Use Case |
|-------|--------|----------|
| 0.5 — 0.8 | Slow, deliberate | Dramatic narration, emphasis |
| 0.9 — 1.0 | Normal speaking pace | Default for YouTube narration |
| 1.1 — 1.3 | Fast, energetic | Fast-paced content, tutorials |
| 1.5+ | Very fast | Preview/skimming only |

**Recommendation:** Keep between 0.9 and 1.0 for natural narration.

### 2.6 Selecting Output Format

| Format | Quality | Size | Notes |
|--------|---------|------|-------|
| WAV | Lossless | Large (~10MB/min) | Default, always works |
| MP3 | Good | Small (~1MB/min) | Requires ffmpeg |

If MP3 export fails, the app falls back to copying the WAV file with an `.mp3` extension.

### 2.7 Generating Voice

1. Click **Generate Voice**
2. Watch the progress bar fill as each chunk is processed
3. The console shows detailed progress:
   ```
   [JOB job_12] Model: kokoro, Voice: af_sky, Speed: 1.0
   [JOB] Split into 15 chunks
   [JOB] Generating chunk 1/15 (850 chars)
   [Kokoro] Generated 2 segments, 72000 samples in 0.3s
   [JOB] Generating chunk 2/15 (912 chars)
   ...
   [JOB job_12] Complete
   ```
4. When complete, generated files appear under **Generated Files**

---

## 3. Generated Files

### 3.1 Downloading Files

After generation completes, the **Generated Files** section shows:
- `final_{voice}_{model}.wav` — The combined audio file
- `final_{voice}_{model}.mp3` — MP3 version (if selected)
- Click any filename to download

### 3.2 Job Storage Location

All generated files are stored locally at:
```
outputs/jobs/{job_id}/
├── input_raw.txt           (original text)
├── input_cleaned.txt       (cleaned text)
├── metadata.json           (job information)
├── chunks/                 (text chunks, for debugging)
├── audio_chunks/           (individual chunk WAVs, for debugging)
└── final/                  (final combined audio)
```

### 3.3 Job History

The **History** section shows all past jobs with:
- Job ID
- Status (complete)
- Voice used
- Model used

Clicking a history entry loads its generated files for download.

---

## 4. Text Cleaning Details

The text cleaner automatically processes your script before TTS generation:

### What Gets Removed

| Element | Example | Becomes |
|---------|---------|---------|
| Production notes | `[pause]`, `[music]`, `(B-roll)` | (removed) |
| Speaker labels | `HOST:`, `Narrator:` | (removed) |
| Markdown headers | `# Title`, `## Section` | (removed) |
| Markdown emphasis | `*italic*`, `**bold**` | "italic", "bold" |
| Horizontal rules | `---`, `___` | (removed) |
| Code fences | ``` ```code``` ``` | (removed) |
| URLs | `https://example.com` | (removed) |
| Bracketed content | `[like this]`, `(or this)` | (removed) |

### What Gets Normalized

| Input | Output |
|-------|--------|
| `::` | `.` |
| `...` | `.` |
| `!!!` | `!` |
| `???` | `?` |
| `,,,` | `,` |
| `&` | "and" |
| `%` | "percent" |
| `$100` | "100 dollars" |

### What's Preserved

- Sentence-ending punctuation (`.`, `!`, `?`)
- Commas (for natural pauses)
- Paragraph breaks
- Important numbers and text

---

## 5. Advanced Usage

### 5.1 Long Scripts

The application handles scripts of any length:
- Text is automatically split into ~1200-character chunks
- Each chunk is generated separately
- Chunks are combined with 500ms silence between them
- Progress shows chunk-by-chunk status (e.g., "Generating chunk 3 of 42")

### 5.2 Debugging with Chunks

If a generation produces unexpected results, check the job directory:
- `chunks/chunk_NNN.txt` — The exact text sent to the TTS engine
- `audio_chunks/chunk_NNN.wav` — The raw audio for each chunk
- `input_cleaned.txt` — The text after all cleaning rules were applied

### 5.3 API Direct Usage

For programmatic access, all functionality is available via REST API:
- See [API Reference](06-api-reference.md) for complete endpoint documentation
- Tools like `curl`, Postman, or any HTTP client can interact with the API

---

## 6. Performance Tips

### For Faster Generation
- Use **Kokoro** model (faster per-chunk generation)
- Shorter chunks mean faster initial results
- Keep speed at 1.0 (speed adjustment requires resampling, adding overhead)

### For Higher Quality
- Use **Silero TTS** with **LJSpeech** voice
- Use WAV output (lossless)
- Set speed to 1.0 (no resampling artifacts)

### For YouTube-Undetectable Narration
- Use **af_sky** voice (most natural)
- Speed 0.95 (slightly slower sounds more natural)
- Clean your script thoroughly before pasting
- Consider adding background music in post-production
- Vary sentence length and structure in your script

---

## 7. Keyboard Shortcuts

The web UI supports standard browser shortcuts:
- `Tab` — Move between form elements
- `Enter` (in textarea) — New line
- Click **Generate Voice** or press `Enter` when button is focused

---

**Document Version:** 1.0.0  
**Last Updated:** 2026-05-31  
**Author:** Local AI Voice Generator Team
