'use strict';

const { app, BrowserWindow, ipcMain, dialog, shell, Menu } = require('electron');
const path   = require('path');
const fs     = require('fs');
const http   = require('http');
const { spawn, spawnSync, execFileSync } = require('child_process');

// ── Platform flags ────────────────────────────────────────────────────────────
const IS_WIN = process.platform === 'win32';
const IS_MAC = process.platform === 'darwin';
const IS_APPLE_SILICON = IS_MAC && process.arch === 'arm64';

// Set true to bypass uv entirely and always use pip.
// Useful when uv is installed but broken (e.g. WSL symlink, corrupted binary).
const SKIP_UV = true;

// ── Paths ─────────────────────────────────────────────────────────────────────
// APP_ROOT: where the Python source lives (packaged = inside asar resources)
const APP_ROOT = app.isPackaged
  ? path.join(process.resourcesPath, 'app')
  : path.join(__dirname, '..');

// DATA_DIR: writable user directory — venv, models, outputs live here
const DATA_DIR = app.isPackaged
  ? app.getPath('userData')
  : APP_ROOT; // dev mode: use project root (reuses existing .venv)

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
function log(...args) { console.log('[Vellum]', ...args); }

// ── Find tooling ──────────────────────────────────────────────────────────────
// IMPORTANT: Never use shell: true or execSync/spawnSync here.
// Packaged Electron on Windows blocks cmd.exe spawning.
// Instead we walk PATH ourselves — pure Node.js, no subprocess.

// Probe whether a binary at a full path actually executes (no shell).
function _canRun(fullPath) {
  try {
    execFileSync(fullPath, ['--version'], { timeout: 5000, stdio: 'pipe' });
    return true;
  } catch (_) { return false; }
}

function _searchPath(name) {
  const dirs = (process.env.PATH || '').split(IS_WIN ? ';' : ':');
  const exts = IS_WIN
    ? (process.env.PATHEXT || '.EXE;.CMD;.BAT;.COM').split(';')
    : [''];
  for (const dir of dirs) {
    if (!dir.trim()) continue;
    for (const ext of exts) {
      try {
        const full = path.join(dir.trim(), name + ext);
        // existsSync + _canRun: file must exist AND actually execute
        if (fs.existsSync(full) && _canRun(full)) return full;
      } catch (_) {}
    }
  }
  return null;
}

function findUv() {
  if (SKIP_UV) return null;
  const fromPath = _searchPath('uv');
  if (fromPath) return fromPath;

  // Known uv install locations outside PATH
  const locs = IS_WIN ? [
    path.join(process.env.LOCALAPPDATA || '', 'uv',      'bin', 'uv.exe'),
    path.join(process.env.USERPROFILE  || '', '.cargo',  'bin', 'uv.exe'),
  ] : [
    path.join(process.env.HOME || '', '.cargo', 'bin', 'uv'),
    '/usr/local/bin/uv',
  ];
  return locs.find(p => { try { return fs.existsSync(p) && _canRun(p); } catch (_) { return false; } }) ?? null;
}

function findSystemPython() {
  const names = IS_WIN
    ? ['python', 'python3', 'py']
    : ['python3.13', 'python3.12', 'python3.11', 'python3.10', 'python3.9', 'python3'];
  for (const name of names) {
    const p = _searchPath(name);
    if (p) return p;
  }
  if (IS_WIN) {
    const locs = [
      path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Python', 'Python313', 'python.exe'),
      path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Python', 'Python312', 'python.exe'),
      path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Python', 'Python311', 'python.exe'),
      path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Python', 'Python310', 'python.exe'),
      'C:\\Python313\\python.exe', 'C:\\Python312\\python.exe', 'C:\\Python311\\python.exe',
    ];
    return locs.find(p => { try { return fs.existsSync(p) && _canRun(p); } catch (_) { return false; } }) ?? null;
  }
  return null;
}

// ── Setup check ───────────────────────────────────────────────────────────────
function isSetupComplete() {
  if (!fs.existsSync(PYTHON_BIN)) return false;
  if (!fs.existsSync(SETUP_FLAG)) return false;
  // Check model
  const kokDir = path.join(MODELS_DIR, 'kokoro');
  if (!fs.existsSync(kokDir)) return false;
  const models = fs.readdirSync(kokDir).filter(f => /\.(pth|pt)$/.test(f));
  return models.length > 0;
}

// ── Run a process, stream output ──────────────────────────────────────────────
function runProc(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    log(`> ${cmd} ${args.join(' ')}`);
    const proc = spawn(cmd, args, {
      cwd:   opts.cwd  || APP_ROOT,
      env:   opts.env  || process.env,
      shell: false,    // always full paths — no shell needed
    });
    proc.stdout.on('data', d => {
      const s = d.toString().trim();
      if (s) { log('[stdout]', s); opts.onLine?.(s); }
    });
    proc.stderr.on('data', d => {
      const s = d.toString().trim();
      if (s) { log('[stderr]', s); opts.onLine?.(s); }
    });
    proc.on('error', reject);
    proc.on('close', code => {
      if (code === 0 || opts.allowNonZero) resolve(code);
      else reject(new Error(`Process exited with code ${code}`));
    });
  });
}

// ── Full setup routine ────────────────────────────────────────────────────────
async function runSetup(send) {
  // ── 1. Locate tooling ──────────────────────────────────────────────────────
  send('Looking for Python…', 5);
  const uvBin     = findUv();
  const sysPython = findSystemPython();

  log(`uv: ${uvBin || 'not found'}`);
  log(`python: ${sysPython || 'not found'}`);

  if (!uvBin && !sysPython) {
    throw new Error(
      'Python 3.9+ is required but was not found.\n\n' +
      'Install from https://python.org  (Windows)\n' +
      'or  brew install python@3.12      (Mac)\n' +
      'then relaunch Vellum.'
    );
  }

  // ── 2. Create virtual environment ──────────────────────────────────────────
  const hasVenv = fs.existsSync(PYTHON_BIN);
  if (!hasVenv) {
    send('Creating isolated Python environment…', 12);
    fs.mkdirSync(DATA_DIR, { recursive: true });

    if (uvBin) {
      // uv creates faster, smarter venvs
      await runProc(uvBin, ['venv', VENV_DIR, '--python', '3.11'], { cwd: DATA_DIR });
    } else {
      await runProc(sysPython, ['-m', 'venv', VENV_DIR], { cwd: DATA_DIR });
    }
    log('venv created');
  } else {
    send('Python environment ready', 12);
  }

  // ── 3. Install / verify dependencies ──────────────────────────────────────
  const reqFile = path.join(APP_ROOT, 'requirements.txt');

  if (!fs.existsSync(SETUP_FLAG)) {
    send('Installing AI dependencies — first run takes 2–4 min…', 20);

    if (uvBin) {
      // uv pip is much faster than pip
      await runProc(uvBin, ['pip', 'install', '-r', reqFile, '--python', PYTHON_BIN], {
        cwd: APP_ROOT,
        onLine: (l) => {
          if (l.includes('Downloading') || l.includes('Installing')) {
            send(l.length > 70 ? l.slice(0, 70) + '…' : l, -1);
          }
        }
      });
    } else {
      // Upgrade pip first, then install
      await runProc(PYTHON_BIN, ['-m', 'pip', 'install', '--upgrade', 'pip', '--quiet']);
      await runProc(PYTHON_BIN, ['-m', 'pip', 'install', '-r', reqFile, '--quiet'], {
        cwd: APP_ROOT,
        onLine: (l) => {
          if (l.includes('Downloading') || l.includes('Installing')) {
            send(l.length > 70 ? l.slice(0, 70) + '…' : l, -1);
          }
        }
      });
    }

    send('Dependencies installed', 65);
  } else {
    send('Dependencies verified', 65);
  }

  // ── 4. Download Kokoro model (~310 MB) ─────────────────────────────────────
  const kokoroDir   = path.join(MODELS_DIR, 'kokoro');
  const modelExists = fs.existsSync(kokoroDir) &&
    fs.readdirSync(kokoroDir).some(f => /\.(pth|pt)$/.test(f));

  if (!modelExists) {
    send('Downloading AI voice model — 310 MB, once only…', 68);
    const dlScript = path.join(APP_ROOT, 'scripts', 'download_kokoro_model.py');
    await runProc(PYTHON_BIN, [dlScript], {
      cwd: APP_ROOT,
      env: { ...process.env, VELLUM_DATA_DIR: DATA_DIR, PYTHONIOENCODING: 'utf-8' },
      onLine: (l) => {
        const m = l.match(/(\d+(\.\d+)?)%/);
        if (m) {
          const pct = parseFloat(m[1]);
          send(`Downloading model… ${pct.toFixed(0)}%`, 68 + pct * 0.28);
        }
      }
    });
    send('Model downloaded', 97);
  } else {
    send('AI model ready', 97);
  }

  // ── 5. Write setup flag ────────────────────────────────────────────────────
  fs.writeFileSync(SETUP_FLAG, new Date().toISOString(), 'utf8');
  send('All set!', 100);
}

// ── Start Python backend ──────────────────────────────────────────────────────
function startBackend() {
  const env = {
    ...process.env,
    VELLUM_DATA_DIR:    DATA_DIR,
    PYTHONIOENCODING:   'utf-8',
    PYTHONUNBUFFERED:   '1',
    // Apple Silicon: hint PyTorch to use MPS (Metal)
    PYTORCH_ENABLE_MPS_FALLBACK: '1',
  };

  backendProc = spawn(
    PYTHON_BIN,
    ['-m', 'uvicorn', 'app.main:app',
     '--host', '127.0.0.1',
     '--port', String(PORT),
     '--no-access-log'],
    { cwd: APP_ROOT, env }
  );

  backendProc.stdout.on('data', d => log('[py]', d.toString().trim()));
  backendProc.stderr.on('data', d => log('[py-err]', d.toString().trim()));
  backendProc.on('close', code => log('[py] exited', code));
  backendProc.on('error', err => log('[py] error', err.message));
}

// ── Poll until server answers ─────────────────────────────────────────────────
function waitForServer(timeoutMs = 45000) {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + timeoutMs;
    const check = () => {
      http.get(`${SERVER_URL}/api/setup/check`, (res) => {
        log('server ready, status', res.statusCode);
        resolve();
      }).on('error', () => {
        if (Date.now() > deadline) {
          reject(new Error('Backend server did not start. Check that port 8000 is free.'));
        } else {
          setTimeout(check, 600);
        }
      });
    };
    setTimeout(check, 1200); // give uvicorn a head start
  });
}

// ── Windows ───────────────────────────────────────────────────────────────────
function createSplash() {
  splashWin = new BrowserWindow({
    width:          460,
    height:         300,
    resizable:      false,
    frame:          false,
    titleBarStyle:  IS_MAC ? 'hiddenInset' : 'default',
    backgroundColor:'#080810',
    webPreferences: {
      preload:          path.join(__dirname, 'preload.js'),
      contextIsolation: true,
    },
  });
  splashWin.loadFile(path.join(__dirname, 'splash.html'));
  if (!IS_MAC) splashWin.setAlwaysOnTop(true);
  return splashWin;
}

function createMain() {
  mainWin = new BrowserWindow({
    width:          1260,
    height:         820,
    minWidth:       920,
    minHeight:      600,
    titleBarStyle:  IS_MAC ? 'hiddenInset' : 'default',
    backgroundColor:'#080810',
    show:           false,
    webPreferences: { contextIsolation: true },
  });

  mainWin.loadURL(SERVER_URL);

  mainWin.once('ready-to-show', () => {
    if (splashWin && !splashWin.isDestroyed()) splashWin.close();
    mainWin.show();
    if (IS_MAC) app.dock.show();
  });

  mainWin.on('closed', () => { mainWin = null; });

  // Open external links in browser, not Electron
  mainWin.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

function buildMenu() {
  const template = [
    ...(IS_MAC ? [{ label: app.name, submenu: [
      { role: 'about' }, { type: 'separator' }, { role: 'quit' }
    ]}] : []),
    { label: 'Edit', submenu: [
      { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' }
    ]},
    { label: 'View', submenu: [
      { role: 'reload' }, { role: 'toggleDevTools' }, { type: 'separator' },
      { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' }, { type: 'separator' },
      { role: 'togglefullscreen' }
    ]},
    { label: 'Window', submenu: [{ role: 'minimize' }, { role: 'zoom' }] }
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// ── App lifecycle ─────────────────────────────────────────────────────────────
app.whenReady().then(async () => {
  if (IS_MAC) app.dock.hide(); // hide until main window is ready
  buildMenu();

  const splash = createSplash();

  const send = (msg, progress = -1) => {
    log(msg);
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

    startBackend();
    send('Launching…', 100);
    await waitForServer();
    createMain();

  } catch (err) {
    log('FATAL:', err.message);
    if (splash && !splash.isDestroyed()) {
      splash.webContents.send('error', err.message);
    }
    // Give user time to read the error, then show a dialog
    setTimeout(() => {
      dialog.showMessageBoxSync({
        type:    'error',
        title:   'Vellum — Setup Failed',
        message: err.message,
        detail:  'Close this dialog, fix the issue, then relaunch Vellum.',
      });
      app.quit();
    }, 3000);
  }
});

app.on('activate', () => {
  // macOS: re-show when clicking dock icon
  if (mainWin) mainWin.show();
});

function killBackend() {
  if (backendProc) {
    try { backendProc.kill('SIGTERM'); } catch (_) {}
    backendProc = null;
  }
}

app.on('before-quit', killBackend);
app.on('will-quit',   killBackend);
app.on('window-all-closed', () => {
  killBackend();
  if (!IS_MAC) app.quit();
});
