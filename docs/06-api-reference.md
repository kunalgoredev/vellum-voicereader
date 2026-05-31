# API Reference

**Document Version:** 1.0.0  
**Base URL:** `http://127.0.0.1:8000`  
**Content Type:** `application/json` (GET), `multipart/form-data` (POST)  
**Last Updated:** 2026-05-31

---

## Overview

The Local AI Voice Generator exposes a RESTful API for voice generation, job management, and system information. All endpoints are available at `http://127.0.0.1:8000`.

---

## Endpoints

### 1. System Information

#### GET /api/device

Returns GPU/acceleration device information.

**Response:**
```json
{
  "device": "cuda",
  "gpu": "NVIDIA GeForce RTX 4080"
}
```

**Possible device values:** `"cuda"`, `"mps"`, `"cpu"`

---

#### GET /api/models

Returns available TTS models.

**Response:**
```json
{
  "models": [
    {"id": "kokoro", "name": "Kokoro (fast, lightweight)"},
    {"id": "silero", "name": "Silero TTS (high quality)"}
  ]
}
```

---

#### GET /api/voices

Returns available voices for a given model.

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `model` | string | `"kokoro"` | Model ID |

**Response (Kokoro):**
```json
{
  "voices": [
    {"id": "af_heart", "name": "Female — Heart", "model": "kokoro"},
    {"id": "af_sky",  "name": "Female — Sky",   "model": "kokoro"}
  ],
  "model": "kokoro"
}
```

**Response (Silero):**
```json
{
  "voices": [
    {"id": "lj_v2",  "name": "LJSpeech (Female, Natural)", "model": "silero"},
    {"id": "v3_en", "name": "English (Multiple Voices)",   "model": "silero"}
  ],
  "model": "silero"
}
```

---

### 2. Voice Generation

#### POST /api/generate

Generates audio from text using the specified TTS model.

**Request (multipart/form-data):**

| Parameter | Type | Default | Required | Description |
|-----------|------|---------|----------|-------------|
| `text` | string | — | Yes | Script text to convert to speech |
| `model` | string | `"kokoro"` | No | TTS model ID |
| `voice` | string | `"af_heart"` | No | Voice/speaker ID |
| `speed` | float | `1.0` | No | Speed multiplier (0.5–2.0) |
| `output_format` | string | `"wav"` | No | Output format (`"wav"` or `"mp3"`) |
| `clean_text` | bool | `true` | No | Apply text cleaning |

**cURL Example:**
```bash
curl -X POST http://127.0.0.1:8000/api/generate \
  -F "text=Hello world. This is a test." \
  -F "model=kokoro" \
  -F "voice=af_sky" \
  -F "speed=1.0" \
  -F "output_format=wav"
```

**PowerShell Example:**
```powershell
$body = @{
  text = "Hello world. This is a test."
  model = "kokoro"
  voice = "af_sky"
  speed = "1.0"
  output_format = "wav"
}
Invoke-RestMethod -Uri http://127.0.0.1:8000/api/generate `
  -Method Post -Body $body
```

**Python Example:**
```python
import requests
resp = requests.post("http://127.0.0.1:8000/api/generate", data={
    "text": "Hello world.",
    "model": "kokoro",
    "voice": "af_sky",
    "speed": 1.0,
    "output_format": "wav",
})
print(resp.json())
# {"job_id": "job_12", "status": "complete"}
```

**Response (201 Created):**
```json
{
  "job_id": "job_12",
  "status": "complete"
}
```

**Notes:**
- Generation is synchronous. The response is returned after all chunks are processed.
- For long scripts, the request may take several minutes.
- The job ID can be used to retrieve generated files.

---

### 3. Job Management

#### GET /api/jobs/{job_id}

Returns job status and metadata.

**Path Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `job_id` | string | Job ID (e.g., `"job_12"`) |

**Response:**
```json
{
  "job_id": "job_12",
  "model": "kokoro",
  "created_at": "2026-05-24 17:43:59",
  "voice": "af_sky",
  "speed": 1.0,
  "status": "complete",
  "raw_text_file": "input_raw.txt",
  "cleaned_text_file": "input_cleaned.txt",
  "final_wav": "final_af_sky_kokoro.wav",
  "final_mp3": null
}
```

---

#### GET /api/jobs/{job_id}/files

Lists generated files for a job.

**Path Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `job_id` | string | Job ID |

**Response:**
```json
{
  "job_id": "job_12",
  "files": [
    {
      "name": "final_af_sky_kokoro.wav",
      "path": "api/download/job_12/final_af_sky_kokoro.wav"
    }
  ]
}
```

---

#### GET /api/download/{job_id}/{filename}

Downloads a generated file.

**Path Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `job_id` | string | Job ID |
| `filename` | string | Filename (e.g., `"final_af_sky_kokoro.wav"`) |

**Response:**
- Binary file content
- `Content-Type`: `audio/wav`, `audio/mpeg`, or `text/plain`
- `Content-Disposition`: attachment with filename

**cURL Example:**
```bash
curl -O http://127.0.0.1:8000/api/download/job_12/final_af_sky_kokoro.wav
```

**Browser:** Simply navigate to the URL or click the download link in the UI.

---

#### GET /api/history

Returns all past jobs, ordered newest first.

**Response:**
```json
{
  "jobs": [
    {
      "job_id": "job_15",
      "model": "silero",
      "created_at": "2026-05-24 18:30:00",
      "voice": "lj_v2",
      "speed": 1.0,
      "status": "complete",
      "final_wav": "final_lj_v2_silero.wav",
      "final_mp3": null
    },
    {
      "job_id": "job_14",
      "model": "kokoro",
      "created_at": "2026-05-24 18:00:00",
      "voice": "af_sky",
      "speed": 1.0,
      "status": "complete",
      "final_wav": "final_af_sky_kokoro.wav",
      "final_mp3": null
    }
  ]
}
```

---

### 4. Static Files

#### GET /

Serves the main web UI.

**Response:** HTML page with embedded CSS and JavaScript.

---

## Error Responses

All endpoints return appropriate HTTP status codes:

| Status Code | Meaning |
|-------------|---------|
| 200 | Success |
| 404 | Resource not found (job, file) |
| 422 | Validation error (missing parameters) |
| 500 | Internal server error |

**Error Response Format:**
```json
{
  "error": "Job not found"
}
```

**Validation Error Format (422):**
```json
{
  "detail": [
    {
      "loc": ["body", "text"],
      "msg": "field required",
      "type": "value_error.missing"
    }
  ]
}
```

---

## OpenAPI Documentation

FastAPI automatically generates OpenAPI documentation:

- **Swagger UI:** http://127.0.0.1:8000/docs
- **ReDoc:** http://127.0.0.1:8000/redoc

These provide interactive API testing directly from the browser.

---

## Rate Limiting

The current version has no rate limiting since it's designed for local single-user use. Each request processes synchronously, effectively limiting concurrent usage.

---

## Webhook / Callback Support

Not implemented in version 1.0. For programmatic workflow integration, poll the job status endpoint after submitting a generate request.

---

**Document Version:** 1.0.0  
**Last Updated:** 2026-05-31  
**Author:** Local AI Voice Generator Team
