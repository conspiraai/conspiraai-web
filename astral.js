/*
 * Conspira AI – astral.js
 * Fetches live lunar data from ipgeolocation.io and computes the Astral Intelligence Index (AII).
 * API key is visible by design (frontend-only MVP).
 */

const IPGEO_API_KEY = '82fd924c51bf4ac48bd9c64119b1d606';
const IPGEO_ENDPOINT = `https://api.ipgeolocation.io/astronomy?apiKey=${IPGEO_API_KEY}`;

// Safely parse moon_illumination (handles strings like "4.3" or "4.3%")
function parseIllumination(raw) {
  if (raw == null) return NaN;
  const cleaned = String(raw).replace('%', '').trim().replace(',', '.');
  const num = parseFloat(cleaned);
  return isNaN(num) ? NaN : num;
}

// Basic fetch with error handling
async function fetchLunarData() {
  try {
    const res = await fetch(IPGEO_ENDPOINT);
    if (!res.ok) throw new Error('Non-200 response');
    const data = await res.json();

    const moonIllumination = parseIllumination(data.moon_illumination);
    const moonAgeDays = Number(data.moon_age);

    // Debug log (you can comment this out later)
    console.log('Astronomy payload:', data);
    console.log('Parsed moonIllumination:', moonIllumination);
    console.log('Parsed moonAgeDays:', moonAgeDays);

    return {
      date: new Date(),
      moonPhase: data.moon_phase,
      moonIllumination,
      moonrise: data.moonrise,
      moonset: data.moonset,
      moonDistanceKm: data.moon_distance,
      sunDistanceKm: data.sun_distance,
      moonAgeDays
    };
  } catch (err) {
    console.error('Error fetching lunar data:', err);
    return null;
  }
}

// Simple score model: illumination + phase bands
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
    phaseNote = 'Gibbous windows often sit inside broader swing moves.';
  } else if (phase.includes('crescent') || phase.includes('quarter')) {
    phaseNote = 'Transitional phases between major regime shifts.';
  }

  return `AII: ${score} (${band}). ${hook} ${phaseNote}`;
}

/**
 * Build cycle-level info: where we are in the 29.5-day cycle,
 * next major window (Full vs New), and a short summary.
 */
function buildCycleInfo(lunar, score) {
  const synodic = 29.53; // average length of lunar cycle in days
  let age = Number(lunar.moonAgeDays);
  if (isNaN(age)) return null;

  const half = synodic / 2;
  const band = bandFromScore(score);

  let positionLabel = 'Early / waxing cycle';
  if (age > half - 2 && age < half + 2) {
    positionLabel = 'Around full-moon peak';
  } else if (age >= half + 2 && age < synodic - 2) {
    positionLabel = 'Late / waning cycle';
  }

  let nextEventLabel;
  let daysToEvent;

  if (age < half) {
    // Moving toward full moon
    nextEventLabel = 'Full Moon';
    daysToEvent = half - age;
  } else {
    // Moving back toward new moon
    nextEventLabel = 'New Moon';
    daysToEvent = synodic - age;
  }

  const daysRounded = Math.round(daysToEvent * 10) / 10;
  const daysLabel = daysRounded.toFixed(1);

  const msOffset = daysToEvent * 24 * 60 * 60 * 1000;
  const nextDate = new Date(lunar.date.getTime() + msOffset);
  const nextDateLabel = nextDate.toLocaleDateString([], {
    month: 'short',
    day: 'numeric'
  });

  const summary = `${nextEventLabel} window in ~${daysLabel} days (${nextDateLabel}). Current band: ${band.toUpperCase()}. Full / new corridors tend to line up with liquidity grabs and expansion moves — use this as a timing overlay, not a trade signal by itself.`;

  return {
    positionLabel,
    nextEventLabel,
    daysLabel,
    nextDateLabel,
    summary
  };
}

// Populate elements if they exist
function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

// Main init
async function initAstral() {
  const lunar = await fetchLunarData();
  if (!lunar) {
    setText('aii-summary', 'Unable to fetch astral data right now.');
    setText('lunar-note', 'Unable to fetch astral data right now.');
    setText('signals-summary', 'Unable to fetch astral data right now.');
    setText('weekly-summary', 'Unable to fetch astral data right now.');
    setText('lunar-cycle-summary', 'Unable to fetch astral data right now.');
    return;
  }

  const score = computeAII(lunar);
  const summary = buildSummary(lunar, score);
  const band = bandFromScore(score);
  const timestamp = `${formatDate(lunar.date)} · ${formatTime(lunar.date)}`;
  const cycleInfo = buildCycleInfo(lunar, score);

  // Home (index)
  if (document.body.dataset.page === 'today') {
    if (score != null) setText('aii-value', score);
    setText('aii-phase', lunar.moonPhase || '–');
    setText(
      'aii-illumination',
      isNaN(lunar.moonIllumination) ? '–' : `${lunar.moonIllumination}%`
    );
    setText('aii-updated', timestamp);
    setText('aii-summary', summary);
  }

  // Lunar page
  if (document.body.dataset.page === 'lunar') {
    setText('lunar-phase', lunar.moonPhase || '–');
    setText(
      'lunar-illumination',
      isNaN(lunar.moonIllumination) ? '–' : `${lunar.moonIllumination}%`
    );
    setText('lunar-rise', lunar.moonrise || '–');
    setText('lunar-set', lunar.moonset || '–');
    setText(
      'lunar-distance',
      lunar.moonDistanceKm ? `${lunar.moonDistanceKm} km` : '–'
    );
    // Keep the AII-style summary here
    setText('lunar-note', summary);

    if (cycleInfo) {
      setText('lunar-cycle-position', cycleInfo.positionLabel);
      setText('lunar-next-event', cycleInfo.nextEventLabel);
      setText('lunar-days-to-event', `${cycleInfo.daysLabel} days`);
      setText('lunar-next-date', cycleInfo.nextDateLabel);
      setText('lunar-cycle-summary', cycleInfo.summary);
    } else {
      setText(
        'lunar-cycle-summary',
        'Unable to compute cycle position from the current data.'
      );
    }
  }

  // Signals page
  if (document.body.dataset.page === 'signals') {
    if (score != null) setText('signals-aii', score);
    setText('signals-phase', lunar.moonPhase || '–');
    setText(
      'signals-illumination',
      isNaN(lunar.moonIllumination) ? '–' : `${lunar.moonIllumination}%`
    );
    setText('signals-summary', summary);
  }

  // Weekly outlook page
  if (document.body.dataset.page === 'weekly') {
    if (score != null) setText('weekly-aii', score);
    setText('weekly-band', band);
    setText('weekly-phase', lunar.moonPhase || '–');
    setText(
      'weekly-illumination',
      isNaN(lunar.moonIllumination) ? '–' : `${lunar.moonIllumination}%`
    );
    setText('weekly-range', `Week of ${formatDate(lunar.date)}`);
    setText('weekly-summary', summary);
  }
}

document.addEventListener('DOMContentLoaded', initAstral);
