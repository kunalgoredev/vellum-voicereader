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

loadModels();
checkDevice();
loadHistory();
