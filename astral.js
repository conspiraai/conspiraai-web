/*
 * Conspira AI – astral.js
 * Fetches live lunar data from ipgeolocation.io and computes the Astral Intelligence Index (AII).
 * Also reads a pre-computed lunar calendar from data/lunar-data.json (updated via GitHub Actions).
 */

const IPGEO_API_KEY = '82fd924c51bf4ac48bd9c64119b1d606';
const IPGEO_ENDPOINT = `https://api.ipgeolocation.io/astronomy?apiKey=${IPGEO_API_KEY}`;

// -----------------------------
// Helpers
// -----------------------------

// Safely parse moon_illumination (handles strings like "4.3" or "4.3%")
function parseIllumination(raw) {
  if (raw == null) return NaN;
  const cleaned = String(raw).replace('%', '').trim().replace(',', '.');
  const num = parseFloat(cleaned);
  return isNaN(num) ? NaN : num;
}

// Basic fetch with error handling – live astronomy
async function fetchLunarData() {
  try {
    const res = await fetch(IPGEO_ENDPOINT);
    if (!res.ok) throw new Error('Non-200 response');
    const data = await res.json();

    const moonIllumination = parseIllumination(data.moon_illumination);

    console.log('Astronomy payload:', data);
    console.log('Parsed moonIllumination:', moonIllumination);

    return {
      date: new Date(),
      moonPhase: data.moon_phase,
      moonIllumination,
      moonrise: data.moonrise,
      moonset: data.moonset,
      moonDistanceKm: data.moon_distance,
      sunDistanceKm: data.sun_distance
    };
  } catch (err) {
    console.error('Error fetching lunar data:', err);
    return null;
  }
}

// Fetch pre-computed lunar calendar from repo (GitHub Pages)
// This is updated by the Astral Autopilot workflow.
async function fetchLunarCalendar() {
  try {
    // cache-bust to avoid stale JSON
    const res = await fetch(`data/lunar-data.json?ts=${Date.now()}`);
    if (!res.ok) throw new Error('Non-200 response');
    const data = await res.json();
    console.log('Lunar calendar payload:', data);
    return data;
  } catch (err) {
    console.error('Error fetching lunar calendar:', err);
    return null;
  }
}

// AII score model: illumination + phase bands
function computeAII(lunar) {
  if (!lunar) return null;

  const illum = isNaN(lunar.moonIllumination) ? 0 : lunar.moonIllumination;
  const phase = (lunar.moonPhase || '').toLowerCase();

  let phaseWeight = 0.2; // default

  if (phase.includes('full')) phaseWeight = 0.7;
  else if (phase.includes('new')) phaseWeight = 0.6;
  else if (phase.includes('gibbous')) phaseWeight = 0.45;
  else if (phase.includes('quarter')) phaseWeight = 0.35;
  else if (phase.includes('crescent')) phaseWeight = 0.25;

  // Normalise illumination: 0–100 → 0–1
  const normIllum = Math.max(0, Math.min(illum, 100)) / 100;

  // Index 0–100
  let score = normIllum * 50 + phaseWeight * 50;
  score = Math.round(Math.max(0, Math.min(score, 100)));

  return score;
}

function bandFromScore(score) {
  if (score == null || isNaN(score)) return '–';
  if (score >= 70) return 'extreme';
  if (score >= 36) return 'charged';
  return 'calm';
}

function formatTime(dateObj) {
  if (!(dateObj instanceof Date)) return '–';
  return dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDate(dateObj) {
  if (!(dateObj instanceof Date)) return '–';
  return dateObj.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

// Generate a short summary string for the index
function buildSummary(lunar, score) {
  if (!lunar || score == null) return 'Unable to load astral conditions.';

  const phase = (lunar.moonPhase || '').toLowerCase();
  const band = bandFromScore(score);

  let hook = '';

  if (band === 'extreme') {
    hook = 'Expect unstable or sharp moves around key levels.';
  } else if (band === 'charged') {
    hook = 'Watch for accelerations, fakeouts and expansion days.';
  } else {
    hook = 'Tape is more likely to behave “normally”, but risk still applies.';
  }

  let phaseNote = '';
  if (phase.includes('full')) {
    phaseNote =
      'Full-moon regime often aligns with emotional and liquidity extremes.';
  } else if (phase.includes('new')) {
    phaseNote =
      'New-moon corridors lean toward trend resets and positioning shifts.';
  } else if (phase.includes('gibbous')) {
    phaseNote =
      'Gibbous windows often sit inside broader swing moves.';
  } else if (phase.includes('crescent') || phase.includes('quarter')) {
    phaseNote =
      'Transitional phases between major regime shifts.';
  }

  return `AII: ${score} (${band}). ${hook} ${phaseNote}`;
}

// Populate elements if they exist
function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

// Safely set innerHTML for simple lists
function setHTML(id, html) {
  const el = document.getElementById(id);
  if (el) el.innerHTML = html;
}

function initAstralCoreMount() {
  const mount = document.getElementById('astral-core');
  if (!mount) {
    console.warn('Astral Core mount point #astral-core not found.');
    return;
  }

  let canvas = mount.querySelector('canvas');
  if (!canvas) {
    canvas = document.createElement('canvas');
    canvas.className = 'astral-core-canvas';
    canvas.setAttribute('aria-hidden', 'true');
    mount.appendChild(canvas);
  }

  const ctx = canvas.getContext('2d');

  const resizeCanvas = () => {
    const width = Math.max(1, mount.clientWidth);
    const height = Math.max(1, mount.clientHeight);
    canvas.width = width;
    canvas.height = height;
    console.log('Astral Core canvas size:', width, height);
    if (ctx) {
      ctx.clearRect(0, 0, width, height);
    }
  };

  const drawGlowingOrb = () => {
    if (!ctx) return;
    const width = canvas.width;
    const height = canvas.height;
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.max(20, Math.min(width, height) * 0.25);

    ctx.clearRect(0, 0, width, height);

    const gradient = ctx.createRadialGradient(
      centerX,
      centerY,
      radius * 0.2,
      centerX,
      centerY,
      radius
    );
    gradient.addColorStop(0, 'rgba(248, 250, 252, 0.95)');
    gradient.addColorStop(0.4, 'rgba(129, 140, 248, 0.6)');
    gradient.addColorStop(1, 'rgba(30, 64, 175, 0.08)');

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.fill();
  };

  resizeCanvas();
  drawGlowingOrb();

  if (typeof ResizeObserver !== 'undefined') {
    const observer = new ResizeObserver(() => {
      resizeCanvas();
      drawGlowingOrb();
    });
    observer.observe(mount);
  }

  window.addEventListener('resize', () => {
    resizeCanvas();
    drawGlowingOrb();
  });

  let hasLoggedTick = false;
  const animate = () => {
    drawGlowingOrb();
    if (!hasLoggedTick) {
      console.log('Astral Core draw loop tick');
      hasLoggedTick = true;
    }
    requestAnimationFrame(animate);
  };

  requestAnimationFrame(animate);
}

// -----------------------------
// Main init
// -----------------------------

async function initAstral() {
  initAstralCoreMount();

  // Load live sky data
  const lunar = await fetchLunarData();

  if (!lunar) {
    setText('aii-summary', 'Unable to fetch astral data right now.');
    setText('lunar-note', 'Unable to fetch astral data right now.');
    setText('signals-summary', 'Unable to fetch astral data right now.');
    setText('weekly-summary', 'Unable to fetch astral data right now.');
  }

  const score = computeAII(lunar);
  const summary = buildSummary(lunar, score);
  const band = bandFromScore(score);
  const timestamp = lunar
    ? `${formatDate(lunar.date)} · ${formatTime(lunar.date)}`
    : '–';
  if (band !== '–') {
    document.body.dataset.aiiBand = band;
  } else {
    delete document.body.dataset.aiiBand;
  }

  // -----------------
  // Home (index)
  // -----------------
  if (document.body.dataset.page === 'home') {
    if (score != null) setText('aii-value', score);
    setText('aii-phase', lunar?.moonPhase || '–');
    setText(
      'aii-illumination',
      lunar && !isNaN(lunar.moonIllumination)
        ? `${lunar.moonIllumination}%`
        : '–'
    );
    setText('aii-updated', timestamp);
    setText('aii-summary', summary);
  }

  // -----------------
  // Lunar page (live sky section)
  // -----------------
  if (document.body.dataset.page === 'lunar') {
    setText('lunar-phase', lunar?.moonPhase || '–');
    setText(
      'lunar-illumination',
      lunar && !isNaN(lunar.moonIllumination)
        ? `${lunar.moonIllumination}%`
        : '–'
    );
    setText('lunar-rise', lunar?.moonrise || '–');
    setText('lunar-set', lunar?.moonset || '–');
    setText(
      'lunar-distance',
      lunar?.moonDistanceKm ? `${lunar.moonDistanceKm} km` : '–'
    );
    setText('lunar-note', summary);
  }

  // -----------------
  // Signals page
  // -----------------
  if (document.body.dataset.page === 'signals') {
    if (score != null) setText('signals-aii', score);
    setText('signals-phase', lunar?.moonPhase || '–');
    setText(
      'signals-illumination',
      lunar && !isNaN(lunar.moonIllumination)
        ? `${lunar.moonIllumination}%`
        : '–'
    );
    setText('signals-summary', summary);
  }

  // -----------------
  // Weekly outlook page
  // -----------------
  if (document.body.dataset.page === 'weekly') {
    if (score != null) setText('weekly-aii', score);
    setText('weekly-band', band);
    setText('weekly-phase', lunar?.moonPhase || '–');
    setText(
      'weekly-illumination',
      lunar && !isNaN(lunar.moonIllumination)
        ? `${lunar.moonIllumination}%`
        : '–'
    );
    setText('weekly-range', `Week of ${formatDate(lunar?.date || new Date())}`);
    setText('weekly-summary', summary);
  }

  // -----------------
  // Lunar calendar (full cycle) – uses lunar-data.json
  // -----------------
  if (document.body.dataset.page === 'lunar') {
    const calendar = await fetchLunarCalendar();

    if (!calendar || !Array.isArray(calendar.upcomingEvents)) {
      setText(
        'lunar-events-status',
        'Lunar calendar not loaded yet. Autopilot will populate upcoming full / new moon windows.'
      );
      setHTML('lunar-events-list', '');
      return;
    }

    if (calendar.upcomingEvents.length === 0) {
      setText(
        'lunar-events-status',
        'No upcoming events listed yet. Waiting for the next Astral Autopilot run.'
      );
      setHTML('lunar-events-list', '');
      return;
    }

    // Build list items for upcoming full / new / quarter moons
    const items = calendar.upcomingEvents
      .slice(0, 6) // limit to 6 events so it doesn’t get crazy long
      .map((evt) => {
        const dateLabel = evt.date || '';
        const typeLabel = (evt.type || '').replace('_', ' ');
        const label = evt.label || typeLabel;
        const note = evt.note || '';
        const illum =
          evt.illumination !== undefined && evt.illumination !== null
            ? ` · ${evt.illumination}%`
            : '';

        return `<li><strong>${label}</strong> — ${dateLabel}${illum}${
          note ? ` · ${note}` : ''
        }</li>`;
      })
      .join('');

    setText(
      'lunar-events-status',
      calendar.lastUpdated
        ? `Upcoming high-signal lunar windows (data updated ${calendar.lastUpdated}).`
        : 'Upcoming high-signal lunar windows.'
    );

    setHTML('lunar-events-list', items);
  }
}

document.addEventListener('DOMContentLoaded', initAstral);
