// UI wiring for Conspira AI pages

document.addEventListener('DOMContentLoaded', () => {
  initNavActiveState();
  initTodayPage();
  initLunarPage();
  initSignalsPage();
});

/* Highlight current nav tab based on filename */
function initNavActiveState() {
  const path = window.location.pathname;
  const page = path.split('/').pop() || 'index.html';

  const map = {
    'index.html': 'nav-today',
    '': 'nav-today',
    'lunar-cycle.html': 'nav-lunar',
    'signals.html': 'nav-signals',
    'network.html': 'nav-network'
  };

  const id = map[page];
  if (!id) return;
  const el = document.getElementById(id);
  if (el) el.classList.add('is-active');
}

/* Home / Today page */
async function initTodayPage() {
  const scoreEl = document.getElementById('today-score');
  if (!scoreEl) return; // not on index

  const phaseEl = document.getElementById('today-phase');
  const illumEl = document.getElementById('today-illum');
  const distanceEl = document.getElementById('today-distance');
  const locationEl = document.getElementById('today-location');
  const tagsWrap = document.getElementById('today-tags');
  const messageEl = document.getElementById('today-message');
  const chargeLabelEl = document.getElementById('today-charge-label');

  scoreEl.textContent = '–';

  const snapshot = await getTodayAstralSnapshot();

  scoreEl.textContent = snapshot.score;
  phaseEl.textContent = snapshot.phase.replace('_', ' ');
  illumEl.textContent = `${snapshot.illumination}%`;
  distanceEl.textContent =
    snapshot.distanceKm > 0 ? `${snapshot.distanceKm.toLocaleString()} km` : '—';
  locationEl.textContent = snapshot.locationLabel;
  messageEl.textContent = snapshot.message;

  const charge = classifyCharge(snapshot.score);
  if (chargeLabelEl) {
    chargeLabelEl.textContent = charge.label;
    chargeLabelEl.classList.add(charge.className);
  }

  if (tagsWrap) {
    tagsWrap.innerHTML = '';
    snapshot.tags.forEach((tag) => {
      const chip = document.createElement('span');
      chip.className = 'tag-pill strong';
      chip.textContent = tag;
      tagsWrap.appendChild(chip);
    });
  }

  // Build a simple line of text summarizing next 7 days for the home page
  const forecastTextEl = document.getElementById('today-forecast-text');
  if (forecastTextEl) {
    const curve = buildSevenDayForecast(snapshot.score, snapshot.phase);
    const maxScore = Math.max(...curve.map((d) => d.score));
    const maxCharge = classifyCharge(maxScore);
    forecastTextEl.textContent = `Based on today’s score of ${snapshot.score}, the week is projected to stay in the ${maxCharge.label.toLowerCase()} band.`;
  }
}

/* Lunar cycle page */
async function initLunarPage() {
  const wrapper = document.getElementById('lunar-table-body');
  if (!wrapper) return;

  const headlineEl = document.getElementById('lunar-headline');

  const snapshot = await getTodayAstralSnapshot();
  const curve = buildSevenDayForecast(snapshot.score, snapshot.phase);

  if (headlineEl) {
    const charge = classifyCharge(snapshot.score);
    headlineEl.textContent = `Based on today’s score of ${snapshot.score}, the next week trends as ${charge.label.toLowerCase()}.`;
  }

  wrapper.innerHTML = '';

  const today = new Date();

  curve.forEach((entry, idx) => {
    const row = document.createElement('div');
    row.className = 'table-row';

    const dateCell = document.createElement('div');
    if (idx === 0) {
      dateCell.textContent = 'Today';
    } else if (idx === 1) {
      dateCell.textContent = 'Tomorrow';
    } else {
      const d = new Date(today);
      d.setDate(today.getDate() + idx);
      dateCell.textContent = d.toLocaleDateString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric'
      });
    }

    const descCell = document.createElement('div');
    descCell.textContent = entry.description;

    const scoreCell = document.createElement('div');
    const chip = document.createElement('span');
    chip.className = `table-chip ${entry.chargeClass}`;
    chip.textContent = `${entry.score} – ${entry.chargeLabel}`;
    scoreCell.appendChild(chip);

    row.appendChild(dateCell);
    row.appendChild(descCell);
    row.appendChild(scoreCell);

    wrapper.appendChild(row);
  });
}

/* Signals page – for now just re-use today’s score into copy */
async function initSignalsPage() {
  const el = document.getElementById('signals-summary');
  if (!el) return;

  const snapshot = await getTodayAstralSnapshot();
  const charge = classifyCharge(snapshot.score);

  el.textContent = `Today’s All Score is ${snapshot.score} (${charge.label}). In a full version of Conspira AI, this band would gate which Solana and BTC pairs show up in the signal feed and how aggressive entries are.`;
}
