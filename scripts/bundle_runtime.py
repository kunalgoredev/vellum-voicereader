#!/usr/bin/env python3
"""Bundle runtime + build dependencies for Vellum.
Downloads and extracts portable Python (for the end-user app), uv, and Node.js
(for the build step only).

Usage:
  python scripts/bundle_runtime.py --win      # Windows runtime + Node
  python scripts/bundle_runtime.py --mac      # macOS runtime + Node
  python scripts/bundle_runtime.py --all      # all platforms
  python scripts/bundle_runtime.py --node     # Node.js only (if runtime already bundled)
"""

import argparse
import os
import shutil
import subprocess
import sys
import tarfile
import urllib.request
import zipfile
from pathlib import Path
from typing import Optional

ROOT = Path(__file__).resolve().parent.parent
RESOURCES = ROOT / "resources"

PYTHON_EMBED_VERSION = "3.11.9"
STANDALONE_VERSION = "20260602"
UV_VERSION = "0.11.14"
NODE_VERSION = "22.14.0"

CHUNK_SIZE = 8192


def _download(url: str, dest: Path, label: str = "") -> None:
    if dest.exists() and dest.stat().st_size > 1000:
        print(f"  [skip] {label or dest.name}")
        return
    print(f"  [download] {label or dest.name}")
    tmp = dest.with_suffix(dest.suffix + ".tmp")
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Vellum/1.0"})
        with urllib.request.urlopen(req, timeout=120) as resp:
            total = int(resp.headers.get("Content-Length", 0))
            loaded = 0
            with open(tmp, "wb") as f:
                while True:
                    chunk = resp.read(CHUNK_SIZE)
                    if not chunk:
                        break
                    f.write(chunk)
                    loaded += len(chunk)
                    if total > 0 and loaded % (5 * 1024 * 1024) < 65536:
                        pct = loaded * 100 // total
                        sys.stdout.write(f"\r    {pct}%  {loaded // 1048576} / {total // 1048576} MB  ")
                        sys.stdout.flush()
            if total > 0:
                print()
        tmp.rename(dest)
        mb = dest.stat().st_size / 1048576
        print(f"  [done] {mb:.0f} MB")
    except Exception as e:
        tmp.unlink(missing_ok=True)
        raise RuntimeError(f"Download failed for {label or url}") from e


def _extract_zip(zip_path: Path, dest: Path) -> None:
    print(f"  [extract] {zip_path.name}")
    with zipfile.ZipFile(zip_path, "r") as zf:
        zf.extractall(dest)


def _extract_targz(tar_path: Path, dest: Path) -> None:
    print(f"  [extract] {tar_path.name}")
    with tarfile.open(tar_path, "r:gz") as tf:
        tf.extractall(dest)


def _flatten_wrapper_dir(dest: Path, marker: str) -> None:
    """Move files out of a single wrapper directory (e.g. `python/` inside `python/`)."""
    for child in list(dest.iterdir()):
        if child.is_dir() and child.name.startswith(marker):
            for f in child.iterdir():
                dst = dest / f.name
                if dst.exists():
                    (shutil.rmtree if dst.is_dir() else dst.unlink)(dst)
                shutil.move(str(f), str(dst))
            shutil.rmtree(child)


def _bootstrap_pip(python_bin: Path, pip_py: Path) -> None:
    print("  [bootstrap] pip")
    result = subprocess.run(
        [str(python_bin), str(pip_py), "--no-warn-script-location"],
        cwd=str(python_bin.parent),
        timeout=60,
        capture_output=True,
        text=True,
    )
    if result.returncode == 0:
        print("  [done] pip installed")
    else:
        print(f"  [warn] pip bootstrap failed: {result.stderr.strip()[-200:]}")


# ── Windows ──────────────────────────────────────────────────────────────────

def bundle_windows() -> None:
    print("\n── Bundling Windows runtime ──")
    py_dir = RESOURCES / "python"
    tool_dir = RESOURCES / "tools"
    py_dir.mkdir(parents=True, exist_ok=True)
    tool_dir.mkdir(parents=True, exist_ok=True)

    py_zip = RESOURCES / "python-embed.zip"
    _download(
        f"https://www.python.org/ftp/python/{PYTHON_EMBED_VERSION}/python-{PYTHON_EMBED_VERSION}-embed-amd64.zip",
        py_zip, "Python embeddable",
    )
    if not (py_dir / "python.exe").exists():
        _extract_zip(py_zip, py_dir)

    maj, minor = PYTHON_EMBED_VERSION.split(".")[0], PYTHON_EMBED_VERSION.split(".")[1]
    pth = py_dir / f"python{maj}{minor}._pth"
    pth.write_text(
        f"python{maj}{minor}.zip\n.\nLib\nLib\\site-packages\nimport site\n"
    )
    (py_dir / "Lib" / "site-packages").mkdir(parents=True, exist_ok=True)
    print(f"  [done] {pth.name} configured")

    pip_py = py_dir / "get-pip.py"
    _download("https://bootstrap.pypa.io/get-pip.py", pip_py, "get-pip.py")
    _bootstrap_pip(py_dir / "python.exe", pip_py)

    uv_zip = RESOURCES / "uv-win.zip"
    _download(
        f"https://github.com/astral-sh/uv/releases/download/{UV_VERSION}/uv-x86_64-pc-windows-msvc.zip",
        uv_zip, "uv (Windows)",
    )
    if not (tool_dir / "uv.exe").exists():
        _extract_zip(uv_zip, tool_dir)
        _flatten_wrapper_dir(tool_dir, "uv-")

    for p in [py_zip, uv_zip, pip_py]:
        p.unlink(missing_ok=True)


# ── macOS ────────────────────────────────────────────────────────────────────

def bundle_mac(arch: str) -> None:
    label = "Apple Silicon" if arch == "arm64" else "Intel"
    py_arch = "aarch64" if arch == "arm64" else "x86_64"
    print(f"\n── Bundling macOS runtime ({label}) ──")

    py_dir = RESOURCES / "python"
    tool_dir = RESOURCES / "tools"
    py_dir.mkdir(parents=True, exist_ok=True)
    tool_dir.mkdir(parents=True, exist_ok=True)

    standalone = f"cpython-3.11.15+{STANDALONE_VERSION}-{py_arch}-apple-darwin-install_only"
    py_tar = RESOURCES / "python-mac.tar.gz"
    _download(
        f"https://github.com/astral-sh/python-build-standalone/releases/download/{STANDALONE_VERSION}/{standalone}.tar.gz",
        py_tar, f"Python standalone (macOS {label})",
    )
    if not (py_dir / "bin" / "python3").exists():
        _extract_targz(py_tar, py_dir)
        _flatten_wrapper_dir(py_dir, "python")
        if not (py_dir / "bin" / "python3").exists():
            raise RuntimeError("Python extraction failed: bin/python3 not found")
        print("  [done] Python extracted")

    pip_py = py_dir / "get-pip.py"
    _download("https://bootstrap.pypa.io/get-pip.py", pip_py, "get-pip.py")
    _bootstrap_pip(py_dir / "bin" / "python3", pip_py)

    uv_arch = "aarch64" if arch == "arm64" else "x86_64"
    uv_tar = RESOURCES / "uv-mac.tar.gz"
    _download(
        f"https://github.com/astral-sh/uv/releases/download/{UV_VERSION}/uv-{uv_arch}-apple-darwin.tar.gz",
        uv_tar, f"uv (macOS {label})",
    )
    if not (tool_dir / "uv").exists():
        _extract_targz(uv_tar, tool_dir)
        _flatten_wrapper_dir(tool_dir, "uv-")
        (tool_dir / "uv").chmod(0o755)
        if not (tool_dir / "uv").exists():
            raise RuntimeError("uv extraction failed: uv binary not found")
        print("  [done] uv extracted")

    for p in [py_tar, uv_tar, pip_py]:
        p.unlink(missing_ok=True)


# ── Node.js (for build step) ─────────────────────────────────────────────────

def bundle_node(platform: str, arch: Optional[str] = None) -> None:
    print(f"\n── Bundling Node.js v{NODE_VERSION} ({platform}) ──")
    node_dir = RESOURCES / "node"
    node_dir.mkdir(parents=True, exist_ok=True)

    if platform == "win":
        archive = RESOURCES / "node-win.zip"
        url = f"https://nodejs.org/dist/v{NODE_VERSION}/node-v{NODE_VERSION}-win-x64.zip"
        _download(url, archive, "Node.js (Windows)")
        if not (node_dir / "node.exe").exists():
            _extract_zip(archive, node_dir)
            _flatten_wrapper_dir(node_dir, "node-v")
            (node_dir / "npm.cmd").chmod(0o755)
            (node_dir / "npx.cmd").chmod(0o755)
            print("  [done] Node.js ready")
    else:
        arch_suffix = "arm64" if arch == "arm64" else "x64"
        archive = RESOURCES / f"node-mac-{arch_suffix}.tar.gz"
        url = f"https://nodejs.org/dist/v{NODE_VERSION}/node-v{NODE_VERSION}-darwin-{arch_suffix}.tar.gz"
        _download(url, archive, f"Node.js (macOS {arch_suffix})")
        if not (node_dir / "bin" / "node").exists():
            _extract_targz(archive, node_dir)
            _flatten_wrapper_dir(node_dir, "node-v")
            (node_dir / "bin" / "node").chmod(0o755)
            (node_dir / "bin" / "npm").chmod(0o755)
            if not (node_dir / "bin" / "node").exists():
                raise RuntimeError("Node.js extraction failed")
            print("  [done] Node.js ready")

    archive.unlink(missing_ok=True)


# ── Main ─────────────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(description="Bundle Vellum build/runtime dependencies")
    parser.add_argument("--win", action="store_true", help="Bundle Windows runtime + Node.js")
    parser.add_argument("--mac", action="store_true", help="Bundle macOS runtime + Node.js")
    parser.add_argument("--all", action="store_true", help="Bundle all platforms")
    parser.add_argument("--node", action="store_true", help="Bundle Node.js only")
    args = parser.parse_args()

    do_win = args.win or args.all
    do_mac = args.mac or args.all

    if args.node:
        bundle_node("win")
        bundle_node("mac", "arm64")
        bundle_node("mac", "x64")
        print("\n✓ Node.js bundle complete\n")
        return

    if not (do_win or do_mac):
        if sys.platform == "win32":
            do_win = True
        elif sys.platform == "darwin":
            do_mac = True
        else:
            parser.print_help()
            sys.exit(1)

    if do_win:
        bundle_windows()
        bundle_node("win")
    if do_mac:
        bundle_mac("arm64")
        bundle_mac("x64")
        # Node.js for the build machine's native arch only
        native_arch = "arm64" if os.uname().machine in ("arm64", "aarch64") else "x64" if sys.platform == "darwin" else "x64"
        bundle_node("mac", native_arch)

    print("\n✓ Bundle complete\n")


if __name__ == "__main__":
    main()
