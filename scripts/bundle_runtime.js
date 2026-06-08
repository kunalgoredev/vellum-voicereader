'use strict';

const fs   = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const RESOURCES = path.join(ROOT, 'resources');

// ── Download helper (follows redirects) ─────────────────────────────────────
function _downloadOne(url, destPath) {
  return new Promise((resolve, reject) => {
    const proto = url.startsWith('https') ? require('https') : require('http');
    const req = proto.get(url, { headers: { 'User-Agent': 'Vellum/1.0' } }, res => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
        let next = res.headers.location;
        if (!next.startsWith('http')) {
          const u = require('url').parse(url);
          next = `${u.protocol}//${u.host}${next}`;
        }
        res.resume();
        resolve(_downloadOne(next, destPath)); // follow redirect
        return;
      }
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }
      const total = parseInt(res.headers['content-length'], 10) || 0;
      let loaded = 0;
      const file = fs.createWriteStream(destPath);
      res.on('data', chunk => {
        loaded += chunk.length;
        if (total > 0 && loaded % (5 * 1024 * 1024) < 65536) {
          process.stdout.write(`\r    ${Math.round(loaded/total*100)}%  ${(loaded/1e6).toFixed(0)}/${(total/1e6).toFixed(0)} MB  `);
        }
      });
      res.pipe(file);
      file.on('finish', () => { file.close(); if (total > 0) process.stdout.write('\n'); resolve(); });
      file.on('error', reject);
    });
    req.on('error', reject);
    req.setTimeout(60000, () => { req.destroy(); reject(new Error('timeout')); });
  });
}

async function download(url, destPath, label) {
  if (fs.existsSync(destPath) && fs.statSync(destPath).size > 1000) {
    console.log(`  [skip] ${label} — already present`);
    return;
  }
  console.log(`  [downloading] ${label}…`);
  try {
    await _downloadOne(url, destPath);
    const size = fs.statSync(destPath).size;
    if (size < 1000) throw new Error('file too small');
    console.log(`  [done] ${label} (${(size/1e6).toFixed(1)} MB)`);
  } catch (e) {
    try { fs.unlinkSync(destPath); } catch (_) {}
    throw new Error(`Download failed for ${label}: ${e.message}\nURL: ${url}`);
  }
}

// ── Zip extraction ──────────────────────────────────────────────────────────
async function extractZip(zipPath, destDir) {
  // Use the built-in approach — spawn powershell Expand-Archive on Windows,
  // or try a pure-Node approach if we have an unzip utility.
  // Simplest cross-platform: use Node's built-in zlib + a simple zip reader.
  const { spawnSync } = require('child_process');
  if (process.platform === 'win32') {
    // PowerShell Expand-Archive is always available on modern Windows
    const r = spawnSync('powershell', [
      '-NoProfile', '-Command',
      `Expand-Archive -LiteralPath '${zipPath}' -DestinationPath '${destDir}' -Force`
    ], { stdio: 'pipe' });
    if (r.status !== 0) throw new Error('Failed to extract zip: ' + r.stderr.toString());
  } else {
    // macOS / Linux: use unzip
    const r = spawnSync('unzip', ['-o', '-q', zipPath, '-d', destDir], { stdio: 'pipe' });
    if (r.status !== 0) throw new Error('Failed to extract zip: ' + r.stderr.toString());
  }
}

// ── tar.gz extraction ───────────────────────────────────────────────────────
async function extractTarGz(tarPath, destDir) {
  const { spawnSync } = require('child_process');
  const r = spawnSync('tar', ['-xzf', tarPath, '-C', destDir], { stdio: 'pipe' });
  if (r.status !== 0) throw new Error('Failed to extract tar.gz: ' + r.stderr.toString());
}

// ── Windows: embedded Python + uv ───────────────────────────────────────────
const PYTHON_VERSION = '3.11.9';
const UV_VERSION     = '0.11.14';

async function bundleWindows() {
  console.log('\n── Bundling Windows runtime ──');

  const pyDir  = path.join(RESOURCES, 'python');
  const toolDir = path.join(RESOURCES, 'tools');

  fs.mkdirSync(pyDir,   { recursive: true });
  fs.mkdirSync(toolDir, { recursive: true });

  // Embedded Python (no installer needed — just extract and use)
  const pyZip = path.join(RESOURCES, 'python-embed.zip');
  const pyUrl = `https://www.python.org/ftp/python/${PYTHON_VERSION}/python-${PYTHON_VERSION}-embed-amd64.zip`;

  await download(pyUrl, pyZip, 'Python embeddable');
  if (!fs.existsSync(path.join(pyDir, 'python.exe'))) {
    console.log('  [extracting] Python…');
    await extractZip(pyZip, pyDir);
    console.log('  [done] Python extracted');
  }

  // Configure embedded Python to find packages in the standard location
  // The embeddable Python uses a ._pth file to control import paths
  const [pyMajor, pyMinor] = PYTHON_VERSION.split('.');
  const pthFile = path.join(pyDir, `python${pyMajor}${pyMinor}._pth`);
  const pthContent = `python${pyMajor}${pyMinor}.zip
.
Lib
Lib\\site-packages
import site
`;
  fs.writeFileSync(pthFile, pthContent, 'utf8');
  console.log(`  [done] Python ._pth configured (${path.basename(pthFile)})`);

  // Ensure Lib/site-packages exists
  fs.mkdirSync(path.join(pyDir, 'Lib', 'site-packages'), { recursive: true });

  // Bootstrap pip into the embedded Python (ensurepip is stripped from embeddable)
  const pipZip = path.join(pyDir, 'get-pip.py');
  await download('https://bootstrap.pypa.io/get-pip.py', pipZip, 'get-pip.py');

  console.log('  [bootstrapping] pip into embedded Python…');
  const { execFileSync } = require('child_process');
  try {
    execFileSync(path.join(pyDir, 'python.exe'), [pipZip, '--no-warn-script-location'], {
      cwd: pyDir,
      timeout: 60000,
      stdio: 'pipe',
    });
    console.log('  [done] pip installed');
  } catch (e) {
    console.error('  [warn] pip bootstrap failed:', e.stderr ? e.stderr.toString() : e.message);
    console.error('  [warn] setup will bootstrap pip on first launch');
  }

  // Cleanup get-pip.py — keep it for runtime fallback
  // (it gets excluded from the installer via !get-pip.py filter)

  // uv binary for Windows
  const uvZip = path.join(RESOURCES, 'uv-win.zip');
  const uvUrl = `https://github.com/astral-sh/uv/releases/download/${UV_VERSION}/uv-x86_64-pc-windows-msvc.zip`;
  await download(uvUrl, uvZip, 'uv (Windows)');

  if (!fs.existsSync(path.join(toolDir, 'uv.exe'))) {
    console.log('  [extracting] uv…');
    await extractZip(uvZip, toolDir);
    console.log('  [done] uv extracted');
  }

  // Cleanup
  try { fs.unlinkSync(pyZip); } catch (_) {}
  try { fs.unlinkSync(uvZip); } catch (_) {}
  try { fs.unlinkSync(pipZip); } catch (_) {}
}

// ── macOS: python-build-standalone + uv ─────────────────────────────────────
const STANDALONE_VERSION = '20260602';

async function bundleMac(arch) {
  const label = arch === 'arm64' ? 'Apple Silicon' : 'Intel';
  console.log(`\n── Bundling macOS runtime (${label}) ──`);

  const pyDir  = path.join(RESOURCES, 'python');   // same dir as Windows — extraResources expects this
  const toolDir = path.join(RESOURCES, 'tools');

  fs.mkdirSync(pyDir,   { recursive: true });
  fs.mkdirSync(toolDir, { recursive: true });

  // python-build-standalone
  const pyArch = arch === 'arm64' ? 'aarch64' : 'x86_64';
  const standaloneName = `cpython-3.11.15+${STANDALONE_VERSION}-${pyArch}-apple-darwin-install_only`;
  const pyTar = path.join(RESOURCES, 'python-mac.tar.gz');
  const pyUrl = `https://github.com/astral-sh/python-build-standalone/releases/download/${STANDALONE_VERSION}/${standaloneName}.tar.gz`;

  await download(pyUrl, pyTar, `Python standalone (macOS ${label})`);

  if (!fs.existsSync(path.join(pyDir, 'bin', 'python3'))) {
    console.log('  [extracting] Python…');
    await extractTarGz(pyTar, pyDir);
    // python-build-standalone tars wrap everything in a 'python/' directory.
    // Move files up one level if needed.
    const inner = path.join(pyDir, 'python');
    if (fs.existsSync(inner) && fs.statSync(inner).isDirectory()) {
      for (const f of fs.readdirSync(inner)) {
        const src = path.join(inner, f);
        const dst = path.join(pyDir, f);
        try { fs.renameSync(src, dst); } catch (_) { /* cross-device? copy+delete */ }
      }
      try { fs.rmdirSync(inner); } catch (_) {}
    }
    if (!fs.existsSync(path.join(pyDir, 'bin', 'python3'))) {
      throw new Error(`Python extraction failed: bin/python3 not found in ${pyDir}`);
    }
    console.log('  [done] Python extracted');
  }

  // Install pip into standalone Python
  const pipPy = path.join(pyDir, 'get-pip.py');
  await download('https://bootstrap.pypa.io/get-pip.py', pipPy, 'get-pip.py');

  // uv binary for macOS
  const uvArch = arch === 'arm64' ? 'aarch64' : 'x86_64';
  const uvTar = path.join(RESOURCES, 'uv-mac.tar.gz');
  const uvUrl = `https://github.com/astral-sh/uv/releases/download/${UV_VERSION}/uv-${uvArch}-apple-darwin.tar.gz`;
  await download(uvUrl, uvTar, `uv (macOS ${label})`);

  if (!fs.existsSync(path.join(toolDir, 'uv'))) {
    console.log('  [extracting] uv…');
    await extractTarGz(uvTar, toolDir);
    // uv tars may have a uv-{arch}-apple-darwin/ wrapper directory
    const uvDirs = fs.readdirSync(toolDir).filter(f => f.startsWith('uv-') && fs.statSync(path.join(toolDir, f)).isDirectory());
    for (const d of uvDirs) {
      const srcDir = path.join(toolDir, d);
      for (const f of fs.readdirSync(srcDir)) {
        const dst = path.join(toolDir, f);
        try { fs.renameSync(path.join(srcDir, f), dst); } catch (_) {}
      }
      try { fs.rmdirSync(srcDir); } catch (_) {}
    }
    // Make executable
    try { fs.chmodSync(path.join(toolDir, 'uv'), 0o755); } catch (_) {}
    if (!fs.existsSync(path.join(toolDir, 'uv'))) {
      throw new Error('uv extraction failed: uv binary not found');
    }
    console.log('  [done] uv extracted');
  }

  // Cleanup
  try { fs.unlinkSync(pyTar); } catch (_) {}
  try { fs.unlinkSync(uvTar); } catch (_) {}
  try { fs.unlinkSync(pipPy); } catch (_) {}
}

// ── Main ────────────────────────────────────────────────────────────────────
async function main() {
  const args = process.argv.slice(2);
  const doAll = args.includes('--all');
  const doWin = doAll || args.includes('--win') || (!doAll && process.platform === 'win32' && args.length === 0);
  const doMac = doAll || args.includes('--mac') || (!doAll && process.platform === 'darwin' && args.length === 0);

  if (args.length === 0 && process.platform !== 'win32' && process.platform !== 'darwin') {
    console.log('Unsupported platform. Use --win or --mac.');
    process.exit(1);
  }

  if (doWin) await bundleWindows();
  if (doMac) {
    await bundleMac('arm64');
    await bundleMac('x64');
  }

  console.log('\n✓ Runtime bundle complete\n');
}

main().catch(err => {
  console.error('\n✗ Bundle failed:', err.message);
  process.exit(1);
});
