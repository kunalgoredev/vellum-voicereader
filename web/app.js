// ── State ─────────────────────────────────────────────────────────────────────
let liveEventSource = null;
let livePlayer     = null;
let currentFormat  = 'wav';
let etaDevice      = 'cpu';
let etaDebounce    = null;
let sessionId      = 0;    // incremented each session to ignore stale events

// ── Boot ──────────────────────────────────────────────────────────────────────
async function init() {
  try {
    const res  = await fetch('/api/setup/check');
    const data = await res.json();
    data.setup_needed ? showSetup() : showMain();
  } catch (_) {
    showMain();
  }
}

function showSetup() {
  document.getElementById('setupPage').classList.remove('hidden');
  document.getElementById('mainPage').classList.add('hidden');
  loadSetupStatus();
}

function showMain() {
  document.getElementById('setupPage').classList.add('hidden');
  document.getElementById('mainPage').classList.remove('hidden');
  loadVoices();
  checkDevice();
  loadHistory();
}

// ── Setup page ────────────────────────────────────────────────────────────────
let _setupPoll = null;

async function loadSetupStatus() {
  try {
    const res  = await fetch('/api/setup/status');
    const data = await res.json();
    renderModelCards(data.models);
    const allDone   = data.models.every(m => m.downloaded);
    const anyActive = data.models.some(m => m.downloading);
    if (allDone) {
      document.getElementById('continueBtn').classList.remove('hidden');
      document.getElementById('setupStatus').textContent = 'All models ready.';
      if (_setupPoll) { clearInterval(_setupPoll); _setupPoll = null; }
    } else if (anyActive) {
      if (!_setupPoll) _setupPoll = setInterval(loadSetupStatus, 1000);
      document.getElementById('setupStatus').textContent = 'Downloading…';
    } else {
      document.getElementById('setupStatus').textContent = 'Select a model to download.';
    }
  } catch (_) {
    document.getElementById('setupStatus').textContent = 'Failed to check model status.';
  }
}

function renderModelCards(models) {
  document.getElementById('modelList').innerHTML = models.map(m => {
    let action = '';
    if (m.downloaded) {
      action = '<span class="badge-ok">✓ Ready</span>';
    } else if (m.downloading) {
      action = `<div class="dl-progress">
        <div class="dl-bar"><div class="dl-fill" style="width:${m.progress}%"></div></div>
        <span class="dl-pct">${m.progress}%</span>
      </div>`;
    } else {
      action = `<button class="dl-btn" onclick="startDownload('${m.id}')">Download ${m.size_mb || '?'} MB</button>`;
      if (m.error) action += `<p class="err-text">${m.error}</p>`;
    }
    return `<div class="model-card">
      <div class="model-info"><strong>${m.filename}</strong><p>${m.description || ''}</p></div>
      <div class="model-action">${action}</div>
    </div>`;
  }).join('');
}

async function startDownload(modelId) {
  await fetch(`/api/setup/download/${modelId}`, { method: 'POST' });
  loadSetupStatus();
}

function onSetupComplete() {
  if (_setupPoll) { clearInterval(_setupPoll); _setupPoll = null; }
  showMain();
}

// ── Device + voices ───────────────────────────────────────────────────────────
async function checkDevice() {
  try {
    const res  = await fetch('/api/device');
    const data = await res.json();
    const el   = document.getElementById('deviceInfo');
    etaDevice  = data.device;
    if (data.device === 'cuda') {
      el.textContent = `⚡ GPU — ${data.gpu || 'CUDA'}`;
      el.classList.add('pill--gpu');
    } else {
      el.textContent = '🖥 CPU';
    }
    updateTextStats();
  } catch (_) {
    document.getElementById('deviceInfo').textContent = 'Device unknown';
  }
}

async function loadVoices() {
  try {
    const res  = await fetch('/api/voices?model=kokoro');
    const data = await res.json();
    document.getElementById('voiceSelect').innerHTML =
      data.voices.map(v => `<option value="${v.id}">${v.name}</option>`).join('');
  } catch (_) { /* silent */ }
}

// ── Text stats + ETA ──────────────────────────────────────────────────────────
document.getElementById('speedInput').addEventListener('input', function () {
  document.getElementById('speedValue').textContent = parseFloat(this.value).toFixed(1) + '×';
});

document.getElementById('scriptInput').addEventListener('input', () => {
  clearTimeout(etaDebounce);
  etaDebounce = setTimeout(updateTextStats, 250);
});

function updateTextStats() {
  const text   = document.getElementById('scriptInput').value.trim();
  const words  = text ? text.split(/\s+/).length : 0;
  const chars  = text.length;
  const chunks = chars > 0 ? Math.ceil(chars / 1200) : 0;

  document.getElementById('wordCount').textContent =
    words > 0 ? `${words.toLocaleString()} words` : '';

  if (chunks === 0) {
    document.getElementById('etaTime').textContent = '—';
    document.getElementById('etaMeta').textContent = 'Enter text above to see an estimate';
    return;
  }

  // Pipeline load: ~10s CUDA, ~20s CPU. Per-chunk: ~1.5s CUDA, ~5s CPU.
  const loadTime = etaDevice === 'cuda' ? 10 : 20;
  const secsPerChunk = etaDevice === 'cuda' ? 1.5 : 5;
  const totalSecs = loadTime + (chunks * secsPerChunk);

  document.getElementById('etaTime').textContent = _fmtTime(totalSecs);
  document.getElementById('etaMeta').textContent =
    `${words.toLocaleString()} words · ${chunks} part${chunks !== 1 ? 's' : ''} · ${etaDevice.toUpperCase()}`;
}

function _fmtTime(secs) {
  if (secs < 60) return `~${secs}s`;
  const m = Math.floor(secs / 60);
  const s = Math.round(secs % 60);
  return s > 0 ? `~${m}m ${s}s` : `~${m}m`;
}

// ── Format toggle ─────────────────────────────────────────────────────────────
function setFormat(val) {
  currentFormat = val;
  document.querySelectorAll('.seg-opt').forEach(b =>
    b.classList.toggle('seg-opt--on', b.dataset.val === val)
  );
}

// ── Controls lock (prevents voice-change-while-generating bug) ────────────────
function _lock() {
  ['voiceSelect', 'speedInput', 'listenBtn', 'genBtn'].forEach(id =>
    document.getElementById(id).disabled = true
  );
  document.querySelectorAll('.seg-opt').forEach(b => b.disabled = true);
}

function _unlock() {
  ['voiceSelect', 'speedInput', 'listenBtn', 'genBtn'].forEach(id =>
    document.getElementById(id).disabled = false
  );
  document.querySelectorAll('.seg-opt').forEach(b => b.disabled = false);
}

// ── Session management ────────────────────────────────────────────────────────
async function startSession(mode) {
  const text = document.getElementById('scriptInput').value.trim();
  if (!text) {
    _flashHint('Paste some text first');
    return;
  }

  // Cancel any in-flight session completely
  _teardown();
  sessionId++;

  const mySession = sessionId;
  _lock();
  document.getElementById('result').classList.add('hidden');
  document.getElementById('livePlayer').classList.add('hidden');
  document.getElementById('genProgress').classList.add('hidden');

  try {
    const fd = new FormData();
    fd.append('text',          text);
    fd.append('model',         'kokoro');
    fd.append('voice',         document.getElementById('voiceSelect').value);
    fd.append('speed',         document.getElementById('speedInput').value);
    fd.append('output_format', currentFormat);

    const res = await fetch('/api/generate/enqueue', { method: 'POST', body: fd });
    if (!res.ok) throw new Error(`Server error ${res.status}`);
    const { job_id, total_chunks } = await res.json();

    if (mode === 'listen') {
      _startListen(job_id, total_chunks, mySession);
    } else {
      _startGenerate(job_id, total_chunks, mySession);
    }
  } catch (e) {
    if (mySession === sessionId) {
      _unlock();
      _flashHint('Something went wrong — check the console');
    }
    console.error(e);
  }
}

function stopSession() {
  _teardown();
  sessionId++;
  _unlock();
  document.getElementById('livePlayer').classList.add('hidden');
  document.getElementById('genProgress').classList.add('hidden');
}

function _teardown() {
  if (liveEventSource) {
    liveEventSource.close();
    liveEventSource = null;
  }
  if (livePlayer) {
    livePlayer.stop();
    livePlayer = null;
  }
}

// ── Listen mode ───────────────────────────────────────────────────────────────
function _startListen(job_id, total, mySession) {
  document.getElementById('livePlayer').classList.remove('hidden');
  document.getElementById('lpGenFill').style.width  = '0%';
  document.getElementById('lpPlayFill').style.width = '0%';
  document.getElementById('lpGenCount').textContent  = `0 / ${total}`;
  document.getElementById('lpPlayCount').textContent = `0 / ${total}`;
  document.getElementById('pcGenStatus').textContent = `Getting ready… 0 of ${total} parts`;
  document.getElementById('playStatus').textContent  = 'Waiting for first part…';
  document.getElementById('playPauseBtn').textContent = '⏸ Pause';
  document.getElementById('playPauseBtn').disabled   = false;
  document.getElementById('stopBtn').disabled        = false;
  document.getElementById('liveDot').className       = 'live-dot';

  livePlayer = new LivePlayer(total, job_id);

  liveEventSource = new EventSource(`/api/jobs/${job_id}/stream`);

  liveEventSource.addEventListener('chunk', (e) => {
    if (mySession !== sessionId) return; // ignore stale session
    const { idx } = JSON.parse(e.data);
    if (livePlayer) livePlayer.addChunk(idx, `/api/jobs/${job_id}/chunks/${idx}`);
  });

  liveEventSource.addEventListener('done', async () => {
    if (mySession !== sessionId) return;
    liveEventSource.close();
    liveEventSource = null;
    _unlock();
    document.getElementById('pcGenStatus').textContent = 'Generation complete';
    document.getElementById('liveDot').className = 'live-dot live-dot--done';
    await loadJobFiles(job_id);
    await loadHistory();
  });

  liveEventSource.addEventListener('error', () => {
    if (mySession !== sessionId) return;
    if (!liveEventSource) return;
    liveEventSource.close();
    liveEventSource = null;
    _unlock();
    document.getElementById('pcGenStatus').textContent = 'Connection error — try again';
    document.getElementById('liveDot').className = 'live-dot live-dot--err';
  });
}

// ── Generate File mode ────────────────────────────────────────────────────────
function _startGenerate(job_id, total, mySession) {
  document.getElementById('genProgress').classList.remove('hidden');
  document.getElementById('gpFill').style.width = '0%';
  document.getElementById('gpCount').textContent = `0 / ${total}`;
  document.getElementById('gpTitle').textContent = `Generating 0 of ${total} parts…`;
  document.getElementById('gpSub').textContent   = 'Building audio chunks…';

  let ready = 0;

  liveEventSource = new EventSource(`/api/jobs/${job_id}/stream`);

  liveEventSource.addEventListener('chunk', (e) => {
    if (mySession !== sessionId) return;
    const { idx } = JSON.parse(e.data);
    ready = idx + 1;
    const pct = (ready / total) * 100;
    document.getElementById('gpFill').style.width   = pct + '%';
    document.getElementById('gpCount').textContent  = `${ready} / ${total}`;
    document.getElementById('gpTitle').textContent  = `Generating ${ready} of ${total} parts…`;
    document.getElementById('gpSub').textContent    = ready < total
      ? `${total - ready} part${total - ready !== 1 ? 's' : ''} remaining`
      : 'Finalising audio file…';
  });

  liveEventSource.addEventListener('done', async () => {
    if (mySession !== sessionId) return;
    liveEventSource.close();
    liveEventSource = null;
    _unlock();
    document.getElementById('genProgress').classList.add('hidden');
    await loadJobFiles(job_id);
    await loadHistory();
  });

  liveEventSource.addEventListener('error', () => {
    if (mySession !== sessionId) return;
    if (!liveEventSource) return;
    liveEventSource.close();
    liveEventSource = null;
    _unlock();
    document.getElementById('gpTitle').textContent = 'Something went wrong — try again';
  });
}

// ── Playback control ──────────────────────────────────────────────────────────
function togglePlayback() {
  if (livePlayer) livePlayer.togglePause();
}

// ── LivePlayer class ──────────────────────────────────────────────────────────
class LivePlayer {
  constructor(total, job_id) {
    this.total      = total;
    this.job_id     = job_id;
    this.queue      = new Array(total).fill(null);
    this.nextToPlay = 0;
    this.chunksReady = 0;
    this.started    = false;
    this.waitingForChunk = false;

    this.audio = new Audio();
    this.audio.addEventListener('ended', () => this._advance());
    this.audio.addEventListener('error', () => {
      console.warn('[LivePlayer] audio error on chunk', this.nextToPlay - 1);
      this._advance();
    });
  }

  addChunk(idx, url) {
    this.queue[idx] = url;
    this.chunksReady++;
    this._updateGenUI();

    // Start on first chunk, or resume if we were waiting for this chunk
    if (!this.started && idx === 0) {
      this.started = true;
      this._advance();
    } else if (this.waitingForChunk && idx === this.nextToPlay) {
      this.waitingForChunk = false;
      this._advance();
    }
  }

  _advance() {
    if (this.nextToPlay >= this.total) {
      this._onFinished();
      return;
    }
    const url = this.queue[this.nextToPlay];
    if (!url) {
      this.waitingForChunk = true;
      _setPlayStatus('Buffering — waiting for next part…');
      return;
    }
    this.waitingForChunk = false;
    const current = this.nextToPlay;
    this.nextToPlay++;
    this.audio.src = url;
    this.audio.play().catch(() => {
      // Autoplay blocked — let user click play
      document.getElementById('playPauseBtn').textContent = '▶ Play';
      _setPlayStatus('Click Play to start');
    });
    _setPlayStatus(`Playing part ${current + 1} of ${this.total}`);
    this._updatePlayUI(current + 1);
  }

  _updateGenUI() {
    const pct = (this.chunksReady / this.total) * 100;
    document.getElementById('lpGenFill').style.width  = pct + '%';
    document.getElementById('lpGenCount').textContent  = `${this.chunksReady} / ${this.total}`;
    document.getElementById('pcGenStatus').textContent =
      this.chunksReady < this.total
        ? `Generating part ${this.chunksReady} of ${this.total}…`
        : 'Generation complete';
  }

  _updatePlayUI(played) {
    const pct = (played / this.total) * 100;
    document.getElementById('lpPlayFill').style.width  = pct + '%';
    document.getElementById('lpPlayCount').textContent = `${played} / ${this.total}`;
  }

  _onFinished() {
    _setPlayStatus('Playback complete');
    document.getElementById('playPauseBtn').disabled = true;
    const dot = document.getElementById('liveDot');
    if (dot) { dot.className = 'live-dot live-dot--done'; }
  }

  togglePause() {
    if (this.audio.paused) {
      this.audio.play();
      document.getElementById('playPauseBtn').textContent = '⏸ Pause';
    } else {
      this.audio.pause();
      document.getElementById('playPauseBtn').textContent = '▶ Resume';
    }
  }

  stop() {
    this.audio.pause();
    this.audio.removeAttribute('src');
    this.audio.load(); // force reset
    this.queue = [];
    this.nextToPlay = 0;
    this.started = false;
  }
}

function _setPlayStatus(text) {
  const el = document.getElementById('playStatus');
  if (el) el.textContent = text;
}

// ── History / files ───────────────────────────────────────────────────────────
async function loadJobFiles(jobId) {
  const res  = await fetch(`/api/jobs/${jobId}/files`);
  const data = await res.json();
  document.getElementById('fileList').innerHTML = data.files.map(f =>
    `<li><a class="dl-link" href="${f.path}" download>
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <path d="M7 1v8M3 7l4 4 4-4M1 13h12" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      ${f.name}
    </a></li>`
  ).join('');
  document.getElementById('result').classList.remove('hidden');
}

async function loadHistory() {
  try {
    const res  = await fetch('/api/history');
    const data = await res.json();
    const list = document.getElementById('historyList');
    if (!data.jobs.length) {
      list.innerHTML = '<li class="history-empty">No generations yet</li>';
      return;
    }
    list.innerHTML = data.jobs.map(j => {
      const voice = j.voice.replace(/^(af_|am_)/, '').replace(/_/g, ' ');
      const cap   = s => s.charAt(0).toUpperCase() + s.slice(1);
      const statusClass = j.status === 'complete' ? 'hs--ok' : j.status === 'error' ? 'hs--err' : '';
      return `<li>
        <a class="history-row" href="#" onclick="loadJobFiles('${j.job_id}'); return false;">
          <span class="history-id">${j.job_id}</span>
          <span class="history-voice">${cap(voice)}</span>
          <span class="history-status ${statusClass}">${j.status}</span>
          <span class="history-date">${j.created_at || ''}</span>
        </a>
      </li>`;
    }).join('');
  } catch (_) { /* silent */ }
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function _flashHint(msg) {
  const el = document.getElementById('wordCount');
  const prev = el.textContent;
  el.textContent = msg;
  el.style.color = 'var(--error)';
  setTimeout(() => { el.textContent = prev; el.style.color = ''; }, 2500);
}

init();
