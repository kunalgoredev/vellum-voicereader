# Deployment & Distribution

**Document Version:** 1.0.0  
**Classification:** DevOps / Build Guide  
**Last Updated:** 2026-05-31

---

## 1. Overview

This document describes how to package, distribute, and deploy the Local AI Voice Generator as a standalone commercial product.

---

## 2. Windows Distribution

### 2.1 PyInstaller Standalone Executable (Recommended)

Create a lightweight `.exe` file that includes Python, all dependencies, and the web UI — but **NOT the AI models**. Models are downloaded on first launch via the setup wizard, like how Chrome downloads its components after installation.

**Requirements:**
- Windows machine with Python 3.11
- All dependencies installed
- PyInstaller: `pip install pyinstaller`

**Build Command (using spec file):**
```cmd
pyinstaller LocalAI-Voice-Generator.spec
```

**Output:** `dist/LocalAI-Voice-Generator.exe` (~150MB, no models bundled)

**Build Command (manual, without spec file):**
```cmd
pyinstaller --onefile --console ^
  --add-data "web;web" ^
  --add-data "app/model_sources.json;." ^
  --hidden-import app.config ^
  --hidden-import app.text_cleaner ^
  --hidden-import app.chunker ^
  --hidden-import app.tts_engine ^
  --hidden-import app.tts_silero ^
  --hidden-import app.audio_tools ^
  --hidden-import app.job_store ^
  --hidden-import app.utils ^
  --hidden-import app.model_downloader ^
  --hidden-import kokoro ^
  --hidden-import scipy.signal ^
  --hidden-import requests ^
  --collect-all kokoro ^
  --collect-all soundfile ^
  -n "LocalAI-Voice-Generator" ^
  app/main.py
```

**Post-Build:**
1. The EXE is self-contained — place it anywhere
2. On first run, it creates `models/` and `outputs/` directories next to itself
3. The user sees the setup wizard to download models
4. `model_sources.json` is embedded in the EXE; place an edited copy next to the EXE to override download URLs

### 2.2 Model Hosting Configuration

Models are downloaded on first launch using URLs from `app/model_sources.json`:

```json
{
  "provider": "google_drive",
  "models": {
    "kokoro": {
      "filename": "kokoro-v0_19.pth",
      "size_mb": 320,
      "url": "https://drive.google.com/uc?export=download&id=YOUR_GOOGLE_DRIVE_FILE_ID",
      "alt_urls": {
        "huggingface": "https://huggingface.co/hexgrad/Kokoro-82M/resolve/main/kokoro-v0_19.pth"
      }
    }
  }
}
```

**Switching to S3 (or any other CDN):** Just change the `url` field:
```json
"url": "https://your-bucket.s3.us-east-1.amazonaws.com/models/kokoro-v0_19.pth"
```
No code changes needed — the downloader uses whatever URL is configured.

**Google Drive Setup:**
1. Upload `kokoro-v0_19.pth` to Google Drive
2. Get the shareable link: `https://drive.google.com/file/d/FILE_ID/view`
3. Extract the `FILE_ID` and update the URL in `model_sources.json`
4. The downloader handles Google Drive's virus scan confirmation pages automatically

### 2.3 Nuitka Compilation (Advanced)

Nuitka compiles Python to C++ for better performance.

**Requirements:**
- Visual C++ Build Tools
- Nuitka: `pip install nuitka`

**Build Command:**
```cmd
nuitka --standalone --onefile --enable-plugin=tk-inter ^
  --include-data-dir=web=web ^
  --include-data-dir=app=app ^
  --include-data-dir=models=models ^
  app/main.py
```

### 2.4 Installer Creation (NSIS/Inno Setup)

For a professional installer experience:

1. Build the PyInstaller executable
2. Use **Inno Setup** or **NSIS** to create an installer that:
   - Creates a Start Menu shortcut
   - Adds desktop shortcut
   - Creates uninstaller
   - Optionally bundles models

**Inno Setup script snippet:**
```iss
[Setup]
AppName=Local AI Voice Generator
AppVersion=1.0.0
DefaultDirName={autopf}\LocalAI-Voice-Generator
DefaultGroupName=Local AI Voice Generator
UninstallDisplayIcon={app}\LocalAI-Voice-Generator.exe

[Files]
Source: "dist\LocalAI-Voice-Generator.exe"; DestDir: "{app}"
Source: "models\*"; DestDir: "{app}\models"; Flags: recursesubdirs
Source: "outputs\*"; DestDir: "{app}\outputs"; Flags: recursesubdirs

[Icons]
Name: "{group}\Local AI Voice Generator"; Filename: "{app}\LocalAI-Voice-Generator.exe"
Name: "{group}\Uninstall"; Filename: "{uninstallexe}"
```

---

## 3. macOS Distribution

### 3.1 Standard Python Distribution

Similar to Windows ZIP: package the project folder with setup scripts.

### 3.2 py2app Standalone .app Bundle

Creates a self-contained macOS application.

**Build Script:** `scripts/06_build_app.sh`

```bash
bash scripts/06_build_app.sh
```

**Requirements:**
- macOS with Python 3.11
- All dependencies installed
- Models pre-downloaded
- py2app: `pip install py2app`

**Output:** `dist/Local AI Voice Generator.app`

**The .app bundle includes:**
- Python 3.11 interpreter
- All pip packages (torch, numpy, etc.)
- Kokoro and Silero model files
- Web UI files
- Scripts and configuration

### 3.3 DMG Packaging

For distribution, package the `.app` into a DMG:

```bash
# Create DMG
hdiutil create -volname "Local AI Voice Generator" \
  -srcfolder "dist/Local AI Voice Generator.app" \
  -ov -format UDZO \
  "dist/LocalAI-Voice-Generator-v1.0.0.dmg"
```

### 3.4 Code Signing

For macOS Gatekeeper compatibility:

```bash
# Sign the app bundle
codesign --force --deep --sign "Developer ID Application: Your Name" \
  "dist/Local AI Voice Generator.app"

# Notarize (macOS 10.15+)
xcrun notarytool submit "dist/LocalAI-Voice-Generator-v1.0.0.dmg" \
  --apple-id "your@email.com" \
  --team-id "YOUR_TEAM_ID" \
  --password "app-specific-password" \
  --wait
```

---

## 4. Cross-Platform Considerations

### 4.1 Differences Between Windows and macOS

| Aspect | Windows | macOS |
|--------|---------|-------|
| GPU | CUDA (NVIDIA) | MPS (Apple Silicon) |
| Scripts | .bat / CMD | .sh / Bash |
| Python | `python` | `python3` |
| Path separator | `\` | `/` |
| Package builder | PyInstaller | py2app |
| Model location | `models\kokoro\` | `models/kokoro/` |

### 4.2 Shared Codebase Strategy

The core Python code in `app/` is shared between platforms. Only the following differ:

| File | Windows | macOS |
|------|---------|-------|
| GPU detection | Inline in `main.py` | `device_utils.py` |
| Setup scripts | `scripts/*.bat` | `scripts/*.sh` |
| Build script | None (PyInstaller) | `scripts/06_build_app.sh` |
| Build config | N/A | `setup.py` (py2app) |

---

## 5. Model Bundling Strategy

### 5.1 Option A: Bundle with Installer

**Pros:** Fully offline from first launch
**Cons:** Large download (models are ~300MB each)

**Recommended models to bundle:**
- Kokoro: `kokoro-v0_19.pth` (~300MB)
- Silero: Auto-downloads via torch.hub (~150MB, cached per-user)

### 5.2 Option B: Download on First Launch

**Pros:** Smaller installer
**Cons:** Requires internet on first launch

The application already supports this pattern:
- Kokoro auto-downloads from HuggingFace Hub
- Silero auto-downloads via torch.hub

### 5.3 Option C: Initial Setup Wizard

Create a first-launch wizard that downloads models with progress indication:

1. User launches app for first time
2. Setup wizard shows progress bars for model downloads
3. Once complete, main UI appears
4. Subsequent launches skip the setup wizard

---

## 6. Commercial Licensing

### 6.1 License File

Implement license validation via a `license.key` file:

```json
{
  "licensee": "Customer Name",
  "email": "customer@email.com",
  "type": "single-user",
  "expires": "2027-12-31",
  "signature": "base64-encoded-signature"
}
```

### 6.2 Offline Activation

For fully offline activation:
1. Generate machine fingerprint (CPU ID + MAC + volume serial)
2. Customer sends fingerprint to licensing server (separate online process)
3. Licensing server returns signed license file
4. Customer copies license file to application directory

### 6.3 Usage Restrictions (Optional)

- Watermark free generations
- Daily generation limits
- Feature tiers (Basic: Kokoro only, Pro: Kokoro + Silero)

---

## 7. Logging & Telemetry

**Important:** The application does NOT collect telemetry by default.

Optional logging for support purposes can be enabled via configuration:
- `config.py`: Set `ENABLE_LOGGING = True`
- Logs are written to `outputs/app.log`
- No data is sent externally

---

## 8. Versioning

Follow Semantic Versioning (SemVer 2.0.0):

- **Major:** Breaking API/UI changes, model format changes
- **Minor:** New features, new voices, new models
- **Patch:** Bug fixes, performance improvements

---

## 9. Distribution Checklist

Before distributing a new version:

- [ ] Run `scripts/05_check_gpu.*` to verify GPU detection
- [ ] Test all voices in both Kokoro and Silero
- [ ] Test with a 10,000+ character script
- [ ] Test MP3 output (requires ffmpeg)
- [ ] Test WAV output (should always work)
- [ ] Verify job history persistence across restarts
- [ ] Clean outputs directory of test data
- [ ] Update version number in `setup.py` and docs
- [ ] Rebuild standalone executables
- [ ] Sign macOS .app bundle
- [ ] Create Windows installer

---

**Document Version:** 1.0.0  
**Last Updated:** 2026-05-31  
**Author:** Local AI Voice Generator Team
