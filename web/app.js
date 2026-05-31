let pollingTimer = null;

async function init() {
  try {
    const res = await fetch('/api/setup/check');
    const data = await res.json();
    if (data.setup_needed) {
      showSetup();
    } else {
      showMain();
    }
  } catch (e) {
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
  loadModels();
  checkDevice();
  loadHistory();
}

async function loadSetupStatus() {
  try {
    const res = await fetch('/api/setup/status');
    const data = await res.json();
    renderModelCards(data.models);

    const allDone = data.models.every(m => m.downloaded);
    const anyActive = data.models.some(m => m.downloading);

    if (allDone) {
      document.getElementById('continueBtn').classList.remove('hidden');
      document.getElementById('setupStatus').textContent = 'All models ready.';
      if (pollingTimer) { clearInterval(pollingTimer); pollingTimer = null; }
    } else if (anyActive) {
      if (!pollingTimer) {
        pollingTimer = setInterval(loadSetupStatus, 1000);
      }
      document.getElementById('setupStatus').textContent = 'Downloading...';
    } else {
      document.getElementById('setupStatus').textContent = 'Select models to download below.';
    }
  } catch (e) {
    document.getElementById('setupStatus').textContent = 'Failed to check model status.';
  }
}

function renderModelCards(models) {
  const container = document.getElementById('modelList');
  container.innerHTML = models.map(m => {
    let actionHtml = '';
    if (m.downloaded) {
      actionHtml = '<span class="status-badge done">Downloaded</span>';
    } else if (m.downloading) {
      actionHtml = `
        <div class="model-progress">
          <div class="progress-bar small">
            <div class="progress-fill" style="width:${m.progress}%"></div>
          </div>
          <span class="progress-pct">${m.progress}%</span>
        </div>`;
    } else {
      actionHtml = `<button class="download-btn" onclick="startDownload('${m.id}')">Download (${m.size_mb || '?'} MB)</button>`;
      if (m.error) {
        actionHtml += `<p class="error-text">Error: ${m.error}</p>`;
      }
    }
    return `
      <div class="model-card">
        <div class="model-info">
          <strong>${m.filename}</strong>
          <p>${m.description || ''}</p>
        </div>
        <div class="model-action">${actionHtml}</div>
      </div>`;
  }).join('');
}

async function startDownload(modelId) {
  try {
    await fetch(`/api/setup/download/${modelId}`, { method: 'POST' });
    loadSetupStatus();
  } catch (e) {
    console.error('Download failed:', e);
  }
}

function onSetupComplete() {
  if (pollingTimer) { clearInterval(pollingTimer); pollingTimer = null; }
  showMain();
}

async function loadModels() {
  try {
    const res = await fetch('/api/models');
    const data = await res.json();
    const select = document.getElementById('modelSelect');
    select.innerHTML = data.models.map(m => `<option value="${m.id}">${m.name}</option>`).join('');
    select.addEventListener('change', loadVoices);
  } catch (e) {
    console.error('Failed to load models:', e);
  }
}

async function loadVoices() {
  const model = document.getElementById('modelSelect').value;
  try {
    const res = await fetch(`/api/voices?model=${model}`);
    const data = await res.json();
    const select = document.getElementById('voiceSelect');
    select.innerHTML = data.voices.map(v => `<option value="${v.id}">${v.name}</option>`).join('');
  } catch (e) {
    console.error('Failed to load voices:', e);
  }
}

async function checkDevice() {
  try {
    const res = await fetch('/api/device');
    const data = await res.json();
    document.getElementById('deviceInfo').textContent = `Device: ${data.device}${data.gpu ? ' - ' + data.gpu : ''}`;
  } catch (e) {
    document.getElementById('deviceInfo').textContent = 'Device: unknown';
  }
}

document.getElementById('speedInput').addEventListener('input', function () {
  document.getElementById('speedValue').textContent = parseFloat(this.value).toFixed(1);
});

async function generate() {
  const text = document.getElementById('scriptInput').value.trim();
  if (!text) {
    alert('Please paste some text first.');
    return;
  }

  const model = document.getElementById('modelSelect').value;
  const voice = document.getElementById('voiceSelect').value;
  const speed = document.getElementById('speedInput').value;
  const outputFormat = document.getElementById('formatSelect').value;

  const btn = document.getElementById('generateBtn');
  btn.disabled = true;
  btn.textContent = 'Generating...';

  document.getElementById('result').classList.add('hidden');
  document.getElementById('progress').classList.remove('hidden');
  setProgress(0, 'Starting...');

  try {
    const formData = new FormData();
    formData.append('text', text);
    formData.append('model', model);
    formData.append('voice', voice);
    formData.append('speed', speed);
    formData.append('output_format', outputFormat);

    const res = await fetch('/api/generate', { method: 'POST', body: formData });
    const data = await res.json();

    setProgress(100, 'Complete!');
    await loadJobFiles(data.job_id);
    await loadHistory();
  } catch (e) {
    setProgress(0, 'Error: ' + e.message);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Generate Voice';
  }
}

function setProgress(percent, text) {
  document.getElementById('progressFill').style.width = percent + '%';
  document.getElementById('progressText').textContent = text;
}

async function loadJobFiles(jobId) {
  const res = await fetch(`/api/jobs/${jobId}/files`);
  const data = await res.json();
  const list = document.getElementById('fileList');
  list.innerHTML = data.files.map(f =>
    `<li><a href="${f.path}" download>${f.name}</a></li>`
  ).join('');
  document.getElementById('result').classList.remove('hidden');
}

async function loadHistory() {
  try {
    const res = await fetch('/api/history');
    const data = await res.json();
    const list = document.getElementById('historyList');
    list.innerHTML = data.jobs.map(j =>
      `<li><a href="?job=${j.job_id}" onclick="loadJobFiles('${j.job_id}'); return false;">${j.job_id}</a> — ${j.status} — ${j.voice} [${j.model || 'kokoro'}]</li>`
    ).join('');
  } catch (e) {
    console.error('Failed to load history:', e);
  }
}

init();
