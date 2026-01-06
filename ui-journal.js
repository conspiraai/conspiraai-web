const JOURNAL_STORAGE_KEY = 'conspiraBiasCheckins';
const JOURNAL_WINDOW_DAYS = 14;

function getStoredCheckins() {
  const raw = localStorage.getItem(JOURNAL_STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.warn('Unable to parse bias check-ins:', error);
    return [];
  }
}

function saveCheckins(entries) {
  localStorage.setItem(JOURNAL_STORAGE_KEY, JSON.stringify(entries));
}

function titleCase(value) {
  return String(value || '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function getCurrentBand() {
  const band = document.body.dataset.aiiBand;
  return band || 'unknown';
}

function getCurrentMoon() {
  const phase = document.getElementById('aii-phase')?.textContent?.trim() || '—';
  const illumination =
    document.getElementById('aii-illumination')?.textContent?.trim() || '—';
  return `${phase} · ${illumination}`;
}

function getCurrentAiiValue() {
  const raw = document.getElementById('aii-value')?.textContent?.trim() || '';
  const parsed = parseInt(raw, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

function updatePatterns(entries) {
  const list = document.getElementById('bias-patterns-list');
  if (!list) return;

  const now = new Date();
  const cutoff = new Date(now.getTime() - JOURNAL_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const recent = entries.filter((entry) => {
    const date = new Date(entry.timestamp);
    return !Number.isNaN(date.getTime()) && date >= cutoff;
  });

  if (recent.length === 0) {
    list.innerHTML = '<li>No check-ins yet.</li>';
    return;
  }

  const biases = ['Bullish', 'Neutral', 'Bearish'];
  const regimes = ['calm', 'charged', 'extreme'];

  const total = recent.length;
  const overallCounts = biases.reduce((acc, bias) => {
    acc[bias] = recent.filter((entry) => entry.bias === bias).length;
    return acc;
  }, {});

  const overallLines = biases.map((bias) => {
    const pct = Math.round((overallCounts[bias] / total) * 100);
    return `<li>${bias} overall: ${pct}%</li>`;
  });

  const regimeLines = [];
  regimes.forEach((regime) => {
    const regimeEntries = recent.filter((entry) => entry.band === regime);
    if (regimeEntries.length === 0) return;
    biases.forEach((bias) => {
      const count = regimeEntries.filter((entry) => entry.bias === bias).length;
      if (count === 0) return;
      const pct = Math.round((count / regimeEntries.length) * 100);
      regimeLines.push(
        `<li>${bias} during ${titleCase(regime)}: ${pct}%</li>`
      );
    });
  });

  const mostCommonBias = biases.reduce(
    (prev, bias) => (overallCounts[bias] > overallCounts[prev] ? bias : prev),
    biases[0]
  );

  const lines = [
    ...overallLines,
    ...regimeLines,
    `<li>Most common bias: ${mostCommonBias}</li>`
  ];

  list.innerHTML = lines.join('');
}

function initBiasCheckin() {
  const buttons = Array.from(document.querySelectorAll('.bias-button'));
  const noteEl = document.getElementById('bias-note');
  const saveBtn = document.getElementById('bias-save');
  const statusEl = document.getElementById('bias-status');

  if (!buttons.length || !noteEl || !saveBtn || !statusEl) return;

  let selectedBias = null;

  const setStatus = (message) => {
    statusEl.textContent = message;
  };

  const setSelected = (bias) => {
    selectedBias = bias;
    buttons.forEach((button) => {
      const isSelected = button.dataset.bias === bias;
      button.classList.toggle('is-selected', isSelected);
    });
  };

  buttons.forEach((button) => {
    button.addEventListener('click', () => {
      setSelected(button.dataset.bias);
      setStatus('');
    });
  });

  saveBtn.addEventListener('click', () => {
    if (!selectedBias) {
      setStatus('Select a bias first.');
      return;
    }

    const entries = getStoredCheckins();
    const timestamp = new Date().toISOString();
    const entry = {
      timestamp,
      bias: selectedBias,
      note: noteEl.value.trim(),
      aii: getCurrentAiiValue(),
      band: getCurrentBand(),
      moon: getCurrentMoon()
    };

    entries.unshift(entry);
    saveCheckins(entries);
    updatePatterns(entries);
    setStatus('Saved.');
  });

  updatePatterns(getStoredCheckins());
}

document.addEventListener('DOMContentLoaded', initBiasCheckin);
