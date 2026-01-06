/*
 * Conspira AI – astral.js
 * Fetches live lunar data from ipgeolocation.io and computes the Astral Intelligence Index (AII).
 * Also reads a pre-computed lunar calendar from data/lunar-data.json (updated via GitHub Actions).
 */

const IPGEO_API_KEY = '82fd924c51bf4ac48bd9c64119b1d606';
const IPGEO_ENDPOINT = `https://api.ipgeolocation.io/astronomy?apiKey=${IPGEO_API_KEY}`;
let lunarCalendarCache = null;

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
    if (lunarCalendarCache) return lunarCalendarCache;
    // cache-bust to avoid stale JSON
    const res = await fetch(`data/lunar-data.json?ts=${Date.now()}`);
    if (!res.ok) throw new Error('Non-200 response');
    const data = await res.json();
    console.log('Lunar calendar payload:', data);
    lunarCalendarCache = data;
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

const ASTRAL_REGIME_COPY = {
  calm: {
    name: 'CALM',
    posture: 'Lower background volatility with steadier pacing.',
    rule: 'Historically associated with tighter ranges and smoother rotations.'
  },
  charged: {
    name: 'CHARGED',
    posture: 'Volatility expanding with faster swings.',
    rule: 'Historically associated with quicker shifts and wider ranges.'
  },
  extreme: {
    name: 'EXTREME',
    posture: 'High noise with sharp, uneven bursts.',
    rule: 'Historically associated with unstable directionality across sessions.'
  }
};

const DAILY_WEATHER_COPY = {
  calm: {
    label: 'Quiet',
    summary:
      'Current conditions indicate subdued background volatility with steadier pacing.'
  },
  charged: {
    label: 'Active',
    summary:
      'Current conditions indicate elevated activity with quicker swings and sentiment shifts.'
  },
  extreme: {
    label: 'Turbulent',
    summary:
      'Current conditions indicate heavier noise with sharp, uneven moves.'
  },
  unknown: {
    label: '—',
    summary:
      'Awaiting the live AII band. Risk weather will update shortly.'
  }
};

function formatTime(dateObj) {
  if (!(dateObj instanceof Date)) return '–';
  return dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDate(dateObj) {
  if (!(dateObj instanceof Date)) return '–';
  return dateObj.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function formatShortDate(dateObj) {
  if (!(dateObj instanceof Date) || Number.isNaN(dateObj.getTime())) return '–';
  return dateObj.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

const LUNAR_EVENT_COPY = {
  full: 'Peak tension window. Historically associated with liquidity swings.',
  new: 'Reset window. Historically associated with positioning shifts.'
};

const EMPTY_LUNAR_EVENT_COPY = 'Awaiting next calendar update.';

function hasTimeComponent(dateStr) {
  return typeof dateStr === 'string' && /T\d{2}:\d{2}/.test(dateStr);
}

function formatLunarEventDate(evt) {
  if (!evt || !evt.date) return '–';
  const raw = evt.date;
  const dateObj = new Date(raw);
  if (Number.isNaN(dateObj.getTime())) return raw;

  const dateText = dateObj.toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });

  if (hasTimeComponent(raw)) {
    const timeText = dateObj.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit'
    });
    return `${dateText} · ${timeText}`;
  }

  return dateText;
}

function buildLunarEventLine(evt, fallbackNote) {
  if (!evt) return EMPTY_LUNAR_EVENT_COPY;
  const dateText = formatLunarEventDate(evt);
  const illum =
    evt.illumination !== undefined && evt.illumination !== null
      ? `${evt.illumination}%`
      : '';
  const note = evt.note || fallbackNote || '';

  return [dateText, illum, note].filter(Boolean).join(' · ');
}

function normalizeEventLabel(rawLabel) {
  if (!rawLabel) return 'Lunar event';
  const cleaned = String(rawLabel)
    .replace(/_/g, ' ')
    .replace(/-/g, ' ')
    .toLowerCase();
  return cleaned.replace(/\b\w/g, (char) => char.toUpperCase());
}

function getNextUpcomingEvent(events, now = new Date()) {
  const upcoming = (events || [])
    .filter((evt) => evt && evt.date)
    .map((evt) => ({ ...evt, parsedDate: new Date(evt.date) }))
    .filter((evt) => !Number.isNaN(evt.parsedDate.getTime()))
    .filter((evt) => evt.parsedDate >= now)
    .sort((a, b) => a.parsedDate - b.parsedDate);
  return upcoming[0] || null;
}

function getUpcomingLunarEvents(events, now = new Date()) {
  const normalized = (events || [])
    .filter((evt) => evt && evt.date)
    .map((evt) => ({ ...evt, parsedDate: new Date(evt.date) }))
    .filter((evt) => !Number.isNaN(evt.parsedDate.getTime()))
    .filter((evt) => evt.parsedDate >= now)
    .sort((a, b) => a.parsedDate - b.parsedDate);

  const fullEvents = normalized.filter((evt) =>
    String(evt.type || evt.label || '').toLowerCase().includes('full')
  );
  const newEvents = normalized.filter((evt) =>
    String(evt.type || evt.label || '').toLowerCase().includes('new')
  );

  return {
    nextFull: fullEvents[0],
    nextFull2: fullEvents[1],
    nextNew: newEvents[0],
    nextNew2: newEvents[1]
  };
}

// Generate a short summary string for the index
function buildSummary(lunar, score) {
  if (!lunar || score == null) return 'Unable to load astral conditions.';

  const phase = (lunar.moonPhase || '').toLowerCase();
  const band = bandFromScore(score);

  let hook = '';

  if (band === 'extreme') {
    hook = 'Historical context suggests wider ranges and faster sentiment shifts.';
  } else if (band === 'charged') {
    hook = 'Historical context suggests quicker swings and expansion phases.';
  } else {
    hook = 'Historical context suggests steadier pacing and tighter ranges.';
  }

  let phaseNote = '';
  if (phase.includes('full')) {
    phaseNote =
      'Full-moon regimes have historically coincided with heightened sensitivity.';
  } else if (phase.includes('new')) {
    phaseNote =
      'New-moon corridors have historically coincided with resets and repositioning.';
  } else if (phase.includes('gibbous')) {
    phaseNote =
      'Gibbous windows often sit inside broader swing cycles.';
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

function readAiiScoreFromDom() {
  const valueEl = document.getElementById('aii-value');
  const regimeEl = document.getElementById('astral-regime-value');
  const raw =
    (valueEl && valueEl.textContent) ||
    (regimeEl && regimeEl.textContent) ||
    '';
  const parsed = parseInt(raw, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

function resolveAiiBand({ band, score } = {}) {
  if (band && band !== '–') return band;
  const datasetBand = document.body.dataset.aiiBand;
  if (datasetBand) return datasetBand;
  const inferredScore = score != null ? score : readAiiScoreFromDom();
  return bandFromScore(inferredScore);
}

function updateDailyStanceBadge(id, label, value) {
  if (!label) return;
  setText(id, `${label}: ${value || '—'}`);
}

function renderDailyStance({ band, score, lunar } = {}) {
  const module = document.getElementById('daily-stance');
  if (!module) return;

  const resolvedBand = resolveAiiBand({ band, score });
  const copy = DAILY_WEATHER_COPY[resolvedBand] || DAILY_WEATHER_COPY.unknown;

  const labelEl = document.getElementById('stance-label');
  if (labelEl) {
    labelEl.textContent = copy.label;
    labelEl.classList.remove('is-calm', 'is-charged', 'is-extreme');
    if (resolvedBand === 'calm') labelEl.classList.add('is-calm');
    if (resolvedBand === 'charged') labelEl.classList.add('is-charged');
    if (resolvedBand === 'extreme') labelEl.classList.add('is-extreme');
  }

  setText('stance-summary', copy.summary);

  updateDailyStanceBadge('stance-badge-aii', 'AII', score != null ? score : '—');

  updateDailyStanceBadge(
    'stance-badge-regime',
    'Regime',
    resolvedBand !== '–' ? normalizeEventLabel(resolvedBand) : '—'
  );

  const moonLabel = lunar?.moonPhase
    ? `${lunar.moonPhase}${!isNaN(lunar.moonIllumination) ? ` · ${lunar.moonIllumination}%` : ''}`
    : '—';
  updateDailyStanceBadge('stance-badge-moon', 'Moon', moonLabel);
}

function scheduleDailyStanceRetry(getData) {
  let attempts = 0;
  const maxAttempts = 8;
  const intervalMs = 250;

  const tick = () => {
    attempts += 1;
    const data = getData();
    renderDailyStance(data);
    if (resolveAiiBand(data) !== '–' || attempts >= maxAttempts) return;
    setTimeout(tick, intervalMs);
  };

  setTimeout(tick, intervalMs);
}

function renderNextShift(nextEvent) {
  const detailEl = document.getElementById('next-shift-detail');
  if (!detailEl) return;
  if (!nextEvent) {
    detailEl.textContent = 'Next key lunar marker: —';
    return;
  }
  const label = normalizeEventLabel(nextEvent.label || nextEvent.type);
  const dateText = formatLunarEventDate(nextEvent);
  detailEl.textContent = `Next key lunar marker: ${label} · ${dateText}`;
}

function updateAstralRegimeModule(band, score) {
  const module = document.querySelector('.astral-regime');
  if (!module) return;

  const copy = ASTRAL_REGIME_COPY[band];
  if (copy) {
    setText('astral-regime-name', copy.name);
    setText('astral-regime-value', score != null ? score : '–');
    setText('astral-regime-posture', copy.posture);
    setText('astral-regime-rule', copy.rule);
  } else {
    setText('astral-regime-name', '–');
    setText('astral-regime-value', score != null ? score : '–');
    setText('astral-regime-posture', 'Unable to load astral conditions.');
    setText('astral-regime-rule', '–');
  }

  module.classList.add('is-visible');
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

  updateAstralRegimeModule(band, score);

  // -----------------
  // Home (index)
  // -----------------
  if (document.body.dataset.page === 'home') {
    renderDailyStance({ band, score, lunar });
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

    const calendar = await fetchLunarCalendar();
    if (calendar && Array.isArray(calendar.upcomingEvents)) {
      const filtered = calendar.upcomingEvents.filter((evt) => {
        const type = String(evt?.type || evt?.label || '').toLowerCase();
        return type.includes('full') || type.includes('new');
      });
      const nextEvent = getNextUpcomingEvent(filtered);
      renderNextShift(nextEvent);
    }

    scheduleDailyStanceRetry(() => ({
      band: document.body.dataset.aiiBand,
      score: readAiiScoreFromDom(),
      lunar
    }));
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
  if (
    document.body.dataset.page === 'lunar' ||
    document.body.dataset.page === 'weekly'
  ) {
    const calendar = await fetchLunarCalendar();

    if (!calendar || !Array.isArray(calendar.upcomingEvents)) {
      setText(
        'lunar-events-status',
        'Unable to load lunar calendar right now.'
      );
      setText('weekly-lunar-status', 'Unable to load lunar calendar right now.');
      setText('next-full', EMPTY_LUNAR_EVENT_COPY);
      setText('next-full-2', EMPTY_LUNAR_EVENT_COPY);
      setText('next-new', EMPTY_LUNAR_EVENT_COPY);
      setText('next-new-2', EMPTY_LUNAR_EVENT_COPY);
      return;
    }

    const { nextFull, nextFull2, nextNew, nextNew2 } = getUpcomingLunarEvents(
      calendar.upcomingEvents
    );

    if (!nextFull && !nextNew) {
      setText(
        'lunar-events-status',
        'No upcoming lunar windows listed yet. Waiting for the next Astral Autopilot run.'
      );
      setText(
        'weekly-lunar-status',
        'No upcoming lunar windows listed yet. Waiting for the next Astral Autopilot run.'
      );
      setText('next-full', EMPTY_LUNAR_EVENT_COPY);
      setText('next-full-2', EMPTY_LUNAR_EVENT_COPY);
      setText('next-new', EMPTY_LUNAR_EVENT_COPY);
      setText('next-new-2', EMPTY_LUNAR_EVENT_COPY);
      return;
    }

    setText(
      'lunar-events-status',
      calendar.lastUpdated
        ? `Upcoming lunar windows (data updated ${calendar.lastUpdated}).`
        : 'Upcoming lunar windows.'
    );

    setText(
      'weekly-lunar-status',
      calendar.lastUpdated
        ? `Upcoming lunar windows (data updated ${calendar.lastUpdated}).`
        : 'Upcoming lunar windows.'
    );

    setText(
      'next-full',
      buildLunarEventLine(nextFull, LUNAR_EVENT_COPY.full)
    );
    setText(
      'next-full-2',
      buildLunarEventLine(nextFull2, LUNAR_EVENT_COPY.full)
    );
    setText('next-new', buildLunarEventLine(nextNew, LUNAR_EVENT_COPY.new));
    setText('next-new-2', buildLunarEventLine(nextNew2, LUNAR_EVENT_COPY.new));
  }
}

document.addEventListener('DOMContentLoaded', initAstral);
