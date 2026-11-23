// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------
let state = {
  cvFile: null,
  cvText: '',
  cvTextPreview: '',
  jobDescription: '',
  analysis: null,
  coverLetter: '',
  improvedResume: ''
};

// ---------------------------------------------------------------------------
// DOM
// ---------------------------------------------------------------------------
const uploadSection   = document.getElementById('upload-section');
const jobSection      = document.getElementById('job-section');
const resultsSection  = document.getElementById('results-section');
const improvedSection = document.getElementById('improved-section');
const coverSection    = document.getElementById('cover-section');

const dropzone   = document.getElementById('dropzone');
const cvInput    = document.getElementById('cv-input');
const fileName   = document.getElementById('file-name');
const jobInput   = document.getElementById('job-input');
const analyzeBtn = document.getElementById('analyze-btn');
const toast      = document.getElementById('toast');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function showToast(msg, duration = 3500) {
  toast.textContent = msg;
  toast.hidden = false;
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => { toast.hidden = true; }, duration);
}

function showStep(stepEl) {
  document.querySelectorAll('.step').forEach(s => s.classList.remove('active'));
  stepEl.classList.add('active');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function setLoading(btn, loading, text = 'Working…') {
  if (loading) {
    btn.dataset.original = btn.textContent;
    btn.textContent = text;
    btn.disabled = true;
  } else {
    btn.textContent = btn.dataset.original || btn.textContent;
    btn.disabled = false;
  }
}

// ---------------------------------------------------------------------------
// Step 1: Upload
// ---------------------------------------------------------------------------
dropzone.addEventListener('click', () => cvInput.click());

dropzone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropzone.classList.add('dragging');
});
dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragging'));
dropzone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropzone.classList.remove('dragging');
  const file = e.dataTransfer.files[0];
  if (file) handleCVFile(file);
});

cvInput.addEventListener('change', (e) => {
  if (e.target.files[0]) handleCVFile(e.target.files[0]);
});

function handleCVFile(file) {
  const allowed = ['.pdf', '.docx', '.doc', '.txt'];
  const ext = '.' + file.name.split('.').pop().toLowerCase();

  if (!allowed.includes(ext)) {
    showToast('Please upload a PDF, DOCX, DOC, or TXT file.');
    return;
  }
  if (file.size > 10 * 1024 * 1024) {
    showToast('File is too large. Max 10 MB.');
    return;
  }

  state.cvFile = file;
  fileName.textContent = `📎 ${file.name} (${(file.size / 1024).toFixed(0)} KB)`;
  showStep(jobSection);
  jobInput.focus();
}

// ---------------------------------------------------------------------------
// Step 2: Analyze
// ---------------------------------------------------------------------------
jobInput.addEventListener('input', () => {
  analyzeBtn.disabled = jobInput.value.trim().length < 20;
});

analyzeBtn.addEventListener('click', async () => {
  if (!state.cvFile) {
    showToast('Please upload a CV first.');
    showStep(uploadSection);
    return;
  }

  state.jobDescription = jobInput.value.trim();
  setLoading(analyzeBtn, true, 'Analyzing your CV…');

  const formData = new FormData();
  formData.append('cv', state.cvFile);
  formData.append('jobDescription', state.jobDescription);

  try {
    const res = await fetch('/api/analyze', { method: 'POST', body: formData });
    const data = await res.json();

    if (!res.ok) throw new Error(data.error || 'Analysis failed.');

    state.cvText = data.cvText || '';
    state.cvTextPreview = data.cvPreview || '';
    state.analysis = data.analysis;

    renderResults(data.analysis);
    showStep(resultsSection);

  } catch (err) {
    console.error(err);
    showToast(err.message);
  } finally {
    setLoading(analyzeBtn, false);
  }
});

// ---------------------------------------------------------------------------
// Render results
// ---------------------------------------------------------------------------
function renderResults(analysis) {
  const score = Math.max(0, Math.min(100, analysis.matchScore || 0));
  const ring = document.getElementById('score-ring');
  ring.style.setProperty('--score', `${score}%`);
  document.getElementById('score-value').textContent = score;
  document.getElementById('summary-text').textContent = analysis.summary || '';

  const renderList = (id, items) => {
    const el = document.getElementById(id);
    el.innerHTML = '';
    if (!items || items.length === 0) {
      el.innerHTML = '<li style="color: var(--text-muted); font-style: italic;">None identified</li>';
      return;
    }
    items.forEach(item => {
      const li = document.createElement('li');
      li.textContent = item;
      el.appendChild(li);
    });
  };

  renderList('matching-list', analysis.matchingSkills);
  renderList('missing-list', analysis.missingSkills);
  renderList('strengths-list', analysis.strengths);
  renderList('improvements-list', analysis.improvements);

  const keywordContainer = document.getElementById('keywords-list');
  keywordContainer.innerHTML = '';
  (analysis.keywordsToAdd || []).forEach(kw => {
    const chip = document.createElement('span');
    chip.className = 'keyword-chip';
    chip.textContent = kw;
    keywordContainer.appendChild(chip);
  });
}

// ---------------------------------------------------------------------------
// Step 3 → Step 4: Improve resume
// ---------------------------------------------------------------------------
document.getElementById('improve-btn').addEventListener('click', async () => {
  const btn = document.getElementById('improve-btn');
  setLoading(btn, true, 'Improving your CV…');

  try {
    const res = await fetch('/api/improve-resume', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cvText: state.cvText,
        jobDescription: state.jobDescription
      })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Improvement failed.');

    state.improvedResume = data.improvedResume;
    document.getElementById('improved-output').value = data.improvedResume;
    showStep(improvedSection);

  } catch (err) {
    console.error(err);
    showToast(err.message);
  } finally {
    setLoading(btn, false);
  }
});

// ---------------------------------------------------------------------------
// Step 4 → downloads
// ---------------------------------------------------------------------------

// PDF download
document.getElementById('download-pdf').addEventListener('click', async () => {
  const text = document.getElementById('improved-output').value.trim();
  if (!text) return showToast('Nothing to download.');

  const btn = document.getElementById('download-pdf');
  setLoading(btn, true, 'Generating PDF…');

  try {
    const res = await fetch('/api/download-resume', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, format: 'pdf' })
    });

    // If the server errored, it returns JSON. If it succeeded, it returns a binary PDF.
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'PDF download failed.');
    }

    // Verify we actually got a PDF back
    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/pdf')) {
      throw new Error('Server did not return a PDF. Check server logs.');
    }

    const blob = await res.blob();

    // Sanity check: PDFs start with "%PDF-"
    const head = await blob.slice(0, 5).text();
    if (!head.startsWith('%PDF-')) {
      throw new Error('Downloaded file is not a valid PDF. Check server logs.');
    }

    triggerDownload(blob, 'improved-resume.pdf');

  } catch (err) {
    console.error(err);
    showToast(err.message);
  } finally {
    setLoading(btn, false);
  }
});

// DOCX download
document.getElementById('download-docx').addEventListener('click', async () => {
  const text = document.getElementById('improved-output').value.trim();
  if (!text) return showToast('Nothing to download.');

  const btn = document.getElementById('download-docx');
  setLoading(btn, true, 'Generating Word file…');

  try {
    const res = await fetch('/api/download-resume', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, format: 'docx' })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'DOCX download failed.');
    }
    const blob = await res.blob();
    triggerDownload(blob, 'improved-resume.docx');
  } catch (err) {
    console.error(err);
    showToast(err.message);
  } finally {
    setLoading(btn, false);
  }
});

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

document.getElementById('back-to-results-2').addEventListener('click', () => {
  showStep(resultsSection);
});

// ---------------------------------------------------------------------------
// Step 3 → Cover letter
// ---------------------------------------------------------------------------
document.getElementById('cover-letter-btn').addEventListener('click', async () => {
  const btn = document.getElementById('cover-letter-btn');
  setLoading(btn, true, 'Writing your cover letter…');

  try {
    const res = await fetch('/api/cover-letter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cvText: state.cvText,
        jobDescription: state.jobDescription
      })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Generation failed.');

    state.coverLetter = data.coverLetter;
    document.getElementById('cover-output').textContent = data.coverLetter;
    showStep(coverSection);

  } catch (err) {
    console.error(err);
    showToast(err.message);
  } finally {
    setLoading(btn, false);
  }
});

// ---------------------------------------------------------------------------
// Copy / download cover letter
// ---------------------------------------------------------------------------
document.getElementById('copy-btn').addEventListener('click', async () => {
  const text = state.coverLetter || document.getElementById('cover-output').textContent;
  try {
    await navigator.clipboard.writeText(text);
    showToast('Cover letter copied to clipboard.');
  } catch {
    showToast('Copy failed. Please select and copy manually.');
  }
});

document.getElementById('download-btn').addEventListener('click', () => {
  const text = state.coverLetter || document.getElementById('cover-output').textContent;
  const blob = new Blob([text], { type: 'text/plain' });
  triggerDownload(blob, 'cover-letter.txt');
});

// ---------------------------------------------------------------------------
// Reset
// ---------------------------------------------------------------------------
document.getElementById('reset-btn').addEventListener('click', () => {
  state = {
    cvFile: null,
    cvText: '',
    cvTextPreview: '',
    jobDescription: '',
    analysis: null,
    coverLetter: '',
    improvedResume: ''
  };
  cvInput.value = '';
  jobInput.value = '';
  fileName.textContent = '';
  analyzeBtn.disabled = true;
  document.getElementById('improved-output').value = '';
  document.getElementById('cover-output').textContent = '';
  showStep(uploadSection);
});

document.getElementById('back-to-results').addEventListener('click', () => {
  showStep(resultsSection);
});