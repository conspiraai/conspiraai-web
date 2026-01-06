const JOURNAL_STORAGE_KEY = 'conspiraBiasCheckins';
const JOURNAL_WINDOW_DAYS = 14;

function getStoredCheckins() {
  const raw = localStorage.getItem(JOURNAL_STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
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
  const weatherLabels = {
    calm: 'quiet',
    charged: 'active',
    extreme: 'turbulent',
    unknown: 'unclear'
  };

  const total = recent.length;
  const overallCounts = biases.reduce((acc, bias) => {
    acc[bias] = recent.filter((entry) => entry.bias === bias).length;
    return acc;
  }, {});

  const mostCommonBias = biases.reduce(
    (prev, bias) => (overallCounts[bias] > overallCounts[prev] ? bias : prev),
    biases[0]
  );

  const lines = [
    `<li>Last 14 days: ${total} check-in${total === 1 ? '' : 's'}.</li>`,
    `<li>Your most frequent bias has been ${mostCommonBias.toLowerCase()}.</li>`
  ];

  const regimeBuckets = regimes.map((regime) => ({
    regime,
    entries: recent.filter((entry) => entry.band === regime)
  }));

  const mostActiveRegime = regimeBuckets.reduce((prev, current) =>
    current.entries.length > prev.entries.length ? current : prev
  );

  if (mostActiveRegime.entries.length >= 2) {
    const regimeBiasCounts = biases.reduce((acc, bias) => {
      acc[bias] = mostActiveRegime.entries.filter(
        (entry) => entry.bias === bias
      ).length;
      return acc;
    }, {});
    const topRegimeBias = biases.reduce(
      (prev, bias) =>
        regimeBiasCounts[bias] > regimeBiasCounts[prev] ? bias : prev,
      biases[0]
    );
    lines.push(
      `<li>You tend to feel ${topRegimeBias.toLowerCase()} during ${weatherLabels[mostActiveRegime.regime]} conditions.</li>`
    );
  }

  const turbulentEntries = recent.filter((entry) => entry.band === 'extreme');
  if (turbulentEntries.length >= 2) {
    const turbulentBiasCounts = biases.reduce((acc, bias) => {
      acc[bias] = turbulentEntries.filter((entry) => entry.bias === bias).length;
      return acc;
    }, {});
    const turbulentBias = biases.reduce(
      (prev, bias) =>
        turbulentBiasCounts[bias] > turbulentBiasCounts[prev] ? bias : prev,
      biases[0]
    );
    if (turbulentBias !== 'Neutral') {
      lines.push(
        `<li>You tend to feel ${turbulentBias.toLowerCase()} during turbulent conditions.</li>`
      );
    }
  }

  const chargedClusterCount = recent.filter((entry) =>
    ['charged', 'extreme'].includes(entry.band)
  ).length;
  if (chargedClusterCount >= Math.ceil(total / 2) && total >= 3) {
    lines.push(
      '<li>Your check-ins cluster around charged lunar periods.</li>'
    );
  }

  const lunarPhaseHits = recent
    .map((entry) => entry.moon || '')
    .reduce(
      (acc, moon) => {
        const normalized = moon.toLowerCase();
        if (normalized.includes('full')) acc.full += 1;
        if (normalized.includes('new')) acc.new += 1;
        return acc;
      },
      { full: 0, new: 0 }
    );
  if (lunarPhaseHits.full + lunarPhaseHits.new >= 2) {
    const dominantPhase =
      lunarPhaseHits.full >= lunarPhaseHits.new ? 'full' : 'new';
    lines.push(
      `<li>Your bias clusters around ${dominantPhase} moon windows.</li>`
    );
  }

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
