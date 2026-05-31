"""
Setup script for building standalone macOS .app bundle.
Run: python setup.py py2app
"""
from setuptools import setup

APP = ["app/main.py"]
DATA_FILES = ["web", "models", "outputs"]
OPTIONS = {
    "argv_emulation": False,
    "includes": [
        "fastapi", "uvicorn", "pydantic", "numpy", "soundfile",
        "pydub", "torch", "kokoro", "scipy", "omegaconf",
        "app.config", "app.text_cleaner", "app.chunker",
        "app.tts_engine", "app.tts_silero", "app.audio_tools",
        "app.job_store", "app.utils", "app.device_utils",
    ],
    "packages": ["app", "web"],
    "plist": {
        "CFBundleName": "Local AI Voice Generator",
        "CFBundleDisplayName": "Local AI Voice Generator",
        "CFBundleIdentifier": "com.localtts.voicegenerator",
        "CFBundleVersion": "1.0.0",
        "CFBundleShortVersionString": "1.0.0",
        "NSHighResolutionCapable": True,
    },
}

setup(
    name="Local AI Voice Generator",
    app=APP,
    data_files=DATA_FILES,
    options={"py2app": OPTIONS},
    setup_requires=["py2app"],
)
