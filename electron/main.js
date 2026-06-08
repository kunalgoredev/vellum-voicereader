'use strict';

const { app, BrowserWindow, ipcMain, dialog, shell, Menu } = require('electron');
const path   = require('path');
const fs     = require('fs');
const os     = require('os');
const http   = require('http');
const { spawn, spawnSync, execFileSync } = require('child_process');

// ── Platform ───────────────────────────────────────────────────────────────────
const IS_WIN = process.platform === 'win32';
const IS_MAC = process.platform === 'darwin';

// ── Paths ─────────────────────────────────────────────────────────────────────
// Windows: everything under install directory (writable, user's AppData\Local)
// Mac:     data/logs under ~/Library/Application Support/Vellum (app bundle is read-only)

const INSTALL_DIR = app.isPackaged
  ? path.dirname(app.getPath('exe'))
  : path.join(__dirname, '..');

const APP_ROOT = app.isPackaged
  ? process.resourcesPath
  : path.join(__dirname, '..');

const DATA_DIR = (app.isPackaged && IS_MAC)
  ? app.getPath('userData')
  : app.isPackaged
    ? path.join(INSTALL_DIR, 'data')
    : INSTALL_DIR;

const LOG_DIR = (app.isPackaged && IS_MAC)
  ? path.join(app.getPath('logs'))
  : path.join(INSTALL_DIR, 'logs');

const VENV_DIR   = path.join(DATA_DIR, '.venv');
const MODELS_DIR = path.join(DATA_DIR, 'models');

const PYTHON_BIN = IS_WIN
  ? path.join(VENV_DIR, 'Scripts', 'python.exe')
  : path.join(VENV_DIR, 'bin', 'python3');

const PORT       = 8000;
const SERVER_URL = `http://127.0.0.1:${PORT}`;
const SETUP_FLAG = path.join(DATA_DIR, '.setup_complete');

let mainWin     = null;
let splashWin   = null;
let backendProc = null;

// ── Logging ───────────────────────────────────────────────────────────────────
let _logFile = null;
let _logStarted = false;

function _getLogFile() {
  if (_logFile) return _logFile;
  try { fs.mkdirSync(LOG_DIR, { recursive: true }); } catch (_) {}
  _logFile = path.join(LOG_DIR, 'vellum.log');
  return _logFile;
}

function _ts() {
  return new Date().toISOString().replace('T', ' ').slice(0, 23);
}

function log(level, ...args) {
  const line = `[${_ts()}] [${level}] ` + args.map(a => {
    if (a instanceof Error) return a.stack || a.message;
    if (typeof a === 'object') {
      try { return JSON.stringify(a, null, 2); } catch (_) { return String(a); }
    }
    return String(a);
  }).join(' ');

  if (level === 'ERROR') console.error(line);
  else console.log(line);

  try { fs.appendFileSync(_getLogFile(), line + '\n'); } catch (_) {}
}

function DEBUG(...args) { log('DEBUG', ...args); }
function INFO(...args)  { log('INFO',  ...args); }
function WARN(...args)  { log('WARN',  ...args); }
function ERROR(...args) { log('ERROR', ...args); }

// ── Sysinfo ───────────────────────────────────────────────────────────────────
function _sysinfo() {
  INFO('=== Vellum Voice Studio ===');
  INFO(`platform:  ${process.platform} ${process.arch}`);
  INFO(`electron:  ${process.versions.electron}`);
  INFO(`packaged:  ${app.isPackaged}`);
  INFO(`install:   ${INSTALL_DIR}`);
  INFO(`appRoot:   ${APP_ROOT}`);
  INFO(`dataDir:   ${DATA_DIR}`);
  INFO(`venvDir:   ${VENV_DIR}`);
  INFO(`logDir:    ${LOG_DIR}`);
  INFO(`GPU:       ${_detectGpuSync()}`);
  try {
    INFO(`RAM: ${Math.round(os.freemem()/1e6)}MB free / ${Math.round(os.totalmem()/1e6)}MB total`);
  } catch (_) {}
}

// ── Tool discovery ────────────────────────────────────────────────────────────
function _resourcesDir() {
  if (app.isPackaged) return process.resourcesPath;
  return path.join(__dirname, '..', 'resources');
}

function _canRun(fullPath) {
  try {
    execFileSync(fullPath, ['--version'], { timeout: 5000, stdio: 'pipe' });
    return true;
  } catch (_) { return false; }
}

function _tryLocations(locs) {
  for (const p of locs) {
    try {
      if (fs.existsSync(p) && _canRun(p)) return p;
    } catch (_) {}
  }
  return null;
}

function getBundledPython() {
  const resDir = _resourcesDir();
  const bundled = IS_WIN
    ? _tryLocations([path.join(resDir, 'python', 'python.exe')])
    : _tryLocations([path.join(resDir, 'python3', 'bin', 'python3')]);
  if (bundled) return bundled;
  return _findSystemPython();
}

function getBundledUv() {
  const exe = IS_WIN ? 'uv.exe' : 'uv';
  const bundled = _tryLocations([
    path.join(_resourcesDir(), 'tools', exe),
  ]);
  if (bundled) return bundled;
  return _findSystemUv();
}

function _findSystemPython() {
  const names = IS_WIN ? ['python', 'python3', 'py']
    : ['python3.13', 'python3.12', 'python3.11', 'python3.10', 'python3.9', 'python3'];
  for (const name of names) {
    for (const dir of (process.env.PATH || '').split(path.delimiter)) {
      const p = path.join(dir, name + (IS_WIN ? '.exe' : ''));
      if (fs.existsSync(p) && _canRun(p)) return p;
    }
  }
  return null;
}

function _findSystemUv() {
  for (const dir of (process.env.PATH || '').split(path.delimiter)) {
    const p = path.join(dir, IS_WIN ? 'uv.exe' : 'uv');
    if (fs.existsSync(p) && _canRun(p)) return p;
  }
  return null;
}

// ── GPU detection ─────────────────────────────────────────────────────────────
function _detectGpuSync() {
  if (!IS_WIN) return 'unknown';
  try {
    const r = spawnSync('nvidia-smi', ['-L'], { timeout: 5000, stdio: 'pipe' });
    if (r.status === 0 && r.stdout.toString().includes('GPU')) return 'cuda';
  } catch (_) {}
  return 'cpu';
}

// ── Setup check ───────────────────────────────────────────────────────────────
function isSetupComplete() {
  if (!fs.existsSync(PYTHON_BIN)) return false;
  if (!fs.existsSync(SETUP_FLAG)) return false;
  try {
    const kokDir = path.join(MODELS_DIR, 'kokoro');
    if (!fs.existsSync(kokDir)) return false;
    return fs.readdirSync(kokDir).some(f => /\.(pth|pt)$/.test(f));
  } catch (_) { return false; }
}

// ── Run process — async spawn with live output ────────────────────────────────
function runProc(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    INFO(`spawn: ${cmd} ${args.join(' ')}`);
    // Build env: always add bundled tools to PATH
    const env = { ...(opts.env || process.env) };
    const toolsDir = path.join(_resourcesDir(), 'tools');
    env.PATH = toolsDir + path.delimiter + (env.PATH || '');
    if (!env.VIRTUAL_ENV && VENV_DIR) env.VIRTUAL_ENV = VENV_DIR;

    const child = spawn(cmd, args, {
      cwd:   opts.cwd || DATA_DIR,
      env:   env,
      shell: false,
    });

    let stdoutBuf = '';
    let stderrBuf = '';

    child.stdout.on('data', d => {
      const s = d.toString('utf8');
      stdoutBuf += s;
      s.split('\n').forEach(l => { const t = l.trim(); if (t) { DEBUG('stdout:', t.slice(0, 200)); opts.onLine?.(t); } });
    });

    child.stderr.on('data', d => {
      const s = d.toString('utf8');
      stderrBuf += s;
      s.split('\n').forEach(l => { const t = l.trim(); if (t) { DEBUG('stderr:', t.slice(0, 200)); opts.onLine?.(t); } });
    });

    child.on('error', err => {
      ERROR(`spawn error: ${cmd}`, err);
      reject(err);
    });

    child.on('close', code => {
      INFO(`${cmd} exited ${code}`);
      if (code === 0 || opts.allowNonZero) {
        resolve({ code, stdout: stdoutBuf, stderr: stderrBuf });
      } else {
        reject(new Error(`${cmd} exited ${code}\n${stderrBuf.slice(0, 500)}`));
      }
    });
  });
}

// ── Bootstrap pip into bundled Python ─────────────────────────────────────────
async function bootstrapPython(pythonBin) {
  try {
    execFileSync(pythonBin, ['-m', 'pip', '--version'], { timeout: 15000, stdio: 'pipe' });
    INFO('pip already available');
    return;
  } catch (_) {}

  INFO('Bootstrapping pip…');
  const getPip = path.join(DATA_DIR, 'get-pip.py');
  if (!fs.existsSync(getPip) || fs.statSync(getPip).size < 1000) {
    INFO('Downloading get-pip.py…');
    await new Promise((resolve, reject) => {
      const file = fs.createWriteStream(getPip);
      require('https').get('https://bootstrap.pypa.io/get-pip.py', res => {
        res.pipe(file);
        file.on('finish', () => { file.close(); resolve(); });
      }).on('error', reject);
    });
  }
  await runProc(pythonBin, [getPip, '--no-warn-script-location']);
  INFO('pip bootstrapped');
}

// ── SpaCy model check ─────────────────────────────────────────────────────────
async function ensureSpacyModel(pythonBin) {
  try {
    execFileSync(pythonBin, ['-c', 'import spacy; spacy.load("en_core_web_sm")'],
      { timeout: 15000, stdio: 'pipe', env: { ...process.env, VIRTUAL_ENV: VENV_DIR } });
    INFO('spaCy model OK');
    return;
  } catch (_) {}

  INFO('Downloading spaCy model (~15 MB)…');
  await runProc(pythonBin,
    ['-m', 'spacy', 'download', 'en_core_web_sm'],
    { timeout: 120000 }
  );
  INFO('spaCy model installed');
}

// ── Setup ─────────────────────────────────────────────────────────────────────
async function runSetup(send) {
  INFO('=== SETUP ===');
  const gpu = _detectGpuSync();
  INFO(`GPU: ${gpu}`);

  // Clean stale state from previous failed attempts
  send('Cleaning up…', 1);
  if (!fs.existsSync(SETUP_FLAG) && fs.existsSync(VENV_DIR)) {
    INFO('Removing stale venv from previous install');
    try { fs.rmSync(VENV_DIR, { recursive: true, force: true }); } catch (e) { WARN('Failed to remove old venv:', e.message); }
  }

  // Ensure data directories exist
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.mkdirSync(path.join(DATA_DIR, 'models'), { recursive: true });
  fs.mkdirSync(path.join(DATA_DIR, 'outputs'), { recursive: true });

  // 1. Locate tools
  send('Preparing…', 3);
  const pythonBin = getBundledPython();
  const uvBin     = getBundledUv();
  INFO(`python: ${pythonBin}`);
  INFO(`uv:     ${uvBin || 'none'}`);

  if (!pythonBin) throw new Error('Python not found. Reinstall Vellum.');

  await bootstrapPython(pythonBin);

  // 2. Create venv
  const hasVenv = fs.existsSync(PYTHON_BIN);
  if (!hasVenv) {
    send('Creating Python environment…', 8);
    fs.mkdirSync(DATA_DIR, { recursive: true });
    if (uvBin) {
      await runProc(uvBin, ['venv', VENV_DIR, '--python', pythonBin], {
        onLine: l => send(`Creating environment… ${l.slice(0, 60)}`, -1)
      });
    } else {
      await runProc(pythonBin, ['-m', 'venv', VENV_DIR]);
    }
    INFO('venv created');
  } else {
    send('Python environment ready', 12);
  }

  // 3. Install deps
  if (!fs.existsSync(SETUP_FLAG)) {
    send('Installing AI libraries…', 15);

    const lockFile = path.join(APP_ROOT, 'requirements-lock.txt');
    const reqFile  = path.join(APP_ROOT, 'requirements.txt');

    // Track progress from uv/pip output
    let lastPct = 15;
    const onLine = (l) => {
      // uv download progress: "Downloading torch (150.2MiB / 1.2GiB)"
      let m = l.match(/(\d+\.?\d*)\s*(MiB|GiB|MB|GB)\s*\/\s*(\d+\.?\d*)\s*(MiB|GiB|MB|GB)/);
      if (m) {
        send(`Downloading… ${parseFloat(m[1]).toFixed(0)} / ${parseFloat(m[3]).toFixed(0)} ${m[4]}`, -1);
        return;
      }
      // uv percent: "Downloaded 45%"
      m = l.match(/(\d+)%/);
      if (m) {
        send(`Downloading… ${m[1]}%`, -1);
        return;
      }
      // Package names
      m = l.match(/(?:Downloading|Preparing|Building|Installing)\s+(\S+)/);
      if (m) {
        send(`Installing ${m[1]}…`, -1);
        return;
      }
      if (l.includes('Resolved')) {
        lastPct = 25;
        send(`Resolved — downloading packages…`, lastPct);
      }
    };

    if (uvBin) {
      await runProc(uvBin, ['pip', 'install', '-r', fs.existsSync(lockFile) ? lockFile : reqFile, '--python', PYTHON_BIN], { onLine });
    } else {
      await runProc(PYTHON_BIN, ['-m', 'pip', 'install', '-r', reqFile, '--quiet'], { onLine });
    }

    // GPU upgrade
    if (gpu === 'cuda') {
      send('Checking GPU acceleration…', 55);
      try {
        const check = execFileSync(PYTHON_BIN,
          ['-c', 'import torch; print("cuda" if torch.cuda.is_available() else "cpu")'],
          { timeout: 15000, stdio: 'pipe' }
        );
        if (check.toString().trim() === 'cpu') {
          send('Installing NVIDIA GPU drivers (~1.2 GB)…', 57);
          if (uvBin) {
            await runProc(uvBin, ['pip', 'install', '--reinstall', '--python', PYTHON_BIN,
              'torch', 'torchaudio', '--extra-index-url', 'https://download.pytorch.org/whl/cu126'], { onLine });
          } else {
            await runProc(PYTHON_BIN, ['-m', 'pip', 'install', '--force-reinstall',
              'torch', 'torchaudio', '--extra-index-url', 'https://download.pytorch.org/whl/cu126'], { onLine });
          }
        } else {
          INFO('CUDA torch already present');
        }
      } catch (_) { WARN('GPU check failed, keeping CPU torch'); }
    }

    send('Dependencies installed', 65);
  } else {
    send('Dependencies verified', 65);
  }

  // 4. SpaCy model
  send('Checking language model…', 66);
  await ensureSpacyModel(PYTHON_BIN);

  // 5. Download model
  const kokoroDir = path.join(MODELS_DIR, 'kokoro');
  let modelExists = false;
  try {
    if (fs.existsSync(kokoroDir)) {
      modelExists = fs.readdirSync(kokoroDir).some(f => /\.(pth|pt)$/.test(f));
    }
  } catch (_) {}

  if (!modelExists) {
    send('Downloading AI voice model (~310 MB, once only)…', 68);
    const dlScript = path.join(APP_ROOT, 'scripts', 'download_kokoro_model.py');
    await runProc(PYTHON_BIN, [dlScript], {
      env: { ...process.env, VELLUM_DATA_DIR: DATA_DIR, PYTHONIOENCODING: 'utf-8' },
      onLine: l => {
        const m = l.match(/(\d+(\.\d+)?)%/);
        if (m) {
          const pct = parseFloat(m[1]);
          send(`Downloading model… ${pct.toFixed(0)}%`, 68 + pct * 0.28);
        }
      }
    });
    send('Model ready', 97);
  } else {
    send('AI model ready', 97);
  }

  fs.writeFileSync(SETUP_FLAG, new Date().toISOString(), 'utf8');
  send('Starting Vellum…', 100);
}

// ── Backend ───────────────────────────────────────────────────────────────────
function startBackend() {
  const toolsDir = path.join(_resourcesDir(), 'tools');
  const env = {
    ...process.env,
    VELLUM_DATA_DIR:    DATA_DIR,
    PYTHONIOENCODING:   'utf-8',
    PYTHONUNBUFFERED:   '1',
    PYTORCH_ENABLE_MPS_FALLBACK: '1',
    VIRTUAL_ENV:        VENV_DIR,
    PATH:               toolsDir + path.delimiter + (process.env.PATH || ''),
  };

  backendProc = spawn(PYTHON_BIN,
    ['-m', 'uvicorn', 'app.main:app',
     '--host', '127.0.0.1', '--port', String(PORT), '--no-access-log'],
    { cwd: APP_ROOT, env });

  backendProc.stdout.on('data', d => DEBUG('py:', d.toString().trim()));
  backendProc.stderr.on('data', d => DEBUG('py:', d.toString().trim().slice(0, 300)));
  backendProc.on('close', code => INFO(`backend exited ${code}`));
  backendProc.on('error', err => ERROR('backend spawn error', err));
}

function waitForServer(timeoutMs = 45000) {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + timeoutMs;
    const check = () => {
      http.get(`${SERVER_URL}/api/setup/check`, res => {
        INFO(`server ready (${res.statusCode})`);
        resolve();
      }).on('error', () => {
        if (Date.now() > deadline) {
          reject(new Error('Backend did not start. Is port 8000 free?'));
        } else {
          setTimeout(check, 600);
        }
      });
    };
    setTimeout(check, 1200);
  });
}

// ── Windows ───────────────────────────────────────────────────────────────────
function createSplash() {
  splashWin = new BrowserWindow({
    width: 460, height: 340,
    resizable: false, frame: false,
    backgroundColor: '#080810',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
    },
  });
  splashWin.loadFile(path.join(__dirname, 'splash.html'));
  if (!IS_MAC) splashWin.setAlwaysOnTop(true);
  return splashWin;
}

function createMain() {
  mainWin = new BrowserWindow({
    width: 1260, height: 820,
    minWidth: 920, minHeight: 600,
    backgroundColor: '#080810',
    show: false,
    webPreferences: { contextIsolation: true },
  });
  mainWin.loadURL(SERVER_URL);
  mainWin.once('ready-to-show', () => {
    if (splashWin && !splashWin.isDestroyed()) splashWin.close();
    mainWin.show();
    if (IS_MAC) app.dock.show();
  });
  mainWin.on('closed', () => { mainWin = null; });
  mainWin.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

function buildMenu() {
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    ...(IS_MAC ? [{ label: app.name, submenu: [{ role: 'about' }, { type: 'separator' }, { role: 'quit' }] }] : []),
    { label: 'Edit', submenu: [{ role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' }] },
    { label: 'View', submenu: [{ role: 'reload' }, { role: 'toggleDevTools' }, { type: 'separator' },
      { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' }, { type: 'separator' }, { role: 'togglefullscreen' }] },
    { label: 'Window', submenu: [{ role: 'minimize' }, { role: 'zoom' }] },
  ]));
}

// ── App lifecycle ─────────────────────────────────────────────────────────────
app.whenReady().then(async () => {
  _sysinfo();
  if (IS_MAC) app.dock.hide();
  buildMenu();

  const splash = createSplash();
  const send = (msg, progress = -1) => {
    INFO(`progress [${progress}%]: ${msg}`);
    if (splash && !splash.isDestroyed()) {
      splash.webContents.send('status', { msg, progress });
    }
  };

  try {
    if (!isSetupComplete()) {
      await runSetup(send);
    } else {
      send('Starting Vellum…', 100);
    }

    // Ensure spaCy model if venv exists but model missing
    if (fs.existsSync(PYTHON_BIN)) {
      await ensureSpacyModel(PYTHON_BIN);
    }

    startBackend();
    send('Launching…', 100);
    await waitForServer();
    createMain();
  } catch (err) {
    ERROR('FATAL', err);
    if (splash && !splash.isDestroyed()) {
      splash.webContents.send('error',
        `${err.message}\n\nLog: ${_getLogFile()}`);
    }
    setTimeout(() => {
      dialog.showMessageBoxSync({
        type: 'error', title: 'Vellum — Setup Failed',
        message: err.message,
        detail: `Log file: ${_getLogFile()}`,
      });
      app.quit();
    }, 3000);
  }
});

app.on('activate', () => { if (mainWin) mainWin.show(); });

function killBackend() {
  if (backendProc) { try { backendProc.kill('SIGTERM'); } catch (_) {}; backendProc = null; }
}

app.on('before-quit', killBackend);
app.on('will-quit', killBackend);
app.on('window-all-closed', () => { killBackend(); if (!IS_MAC) app.quit(); });
