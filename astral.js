/*
 * Conspira AI – astral.js
 * Fetches live lunar data from ipgeolocation.io and computes the Astral Intelligence Index (AII).
 * API key is visible by design (frontend-only MVP).
 */

const IPGEO_API_KEY = '82fd924c51bf4ac48bd9c64119b1d606';

// IMPORTANT: include a location so the API returns valid data
// Lunar phase/illumination are global, location mostly affects rise/set times.
// You can change this city if you want, it won't break the astral logic.
const IPGEO_ENDPOINT =
  `https://api.ipgeolocation.io/astronomy?apiKey=${IPGEO_API_KEY}&location=New York,USA`;

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

    // Debug log (safe to leave on for now; remove later if you want)
    console.log('Astronomy payload:', data);
    console.log('Parsed moonIllumination:', moonIllumination);

    return {
      date: new Date(),
      moonPhase: data.moon_phase,
      moonIllumination,
      moonrise: data.moonrise,
      moonset: data.moonset,
      moonDistanceKm: data.moon_distance,
      sunDistanceKm: data.sun_distance,
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
  let score = (normIllum * 50) + (phaseWeight * 50);
  score = Math.round(Math.max(0, Math.min(score, 100)));

  return score;
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
  let band = 'calm';
  if (score >= 70) band = 'extreme';
  else if (score >= 36) band = 'charged';

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
    phaseNote = 'Full-moon regime often aligns with emotional and liquidity extremes.';
  } else if (phase.includes('new')) {
    phaseNote = 'New-moon corridors lean toward trend resets and positioning shifts.';
  } else if (phase.includes('gibbous')) {
    phaseNote = 'Gibbous windows often sit inside broader swing moves.';
  } else if (phase.includes('crescent') || phase.includes('quarter')) {
    phaseNote = 'Transitional phases between major regime shifts.';
  }

  return `AII: ${score} (${band}). ${hook} ${phaseNote}`;
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
    return;
  }

  const score = computeAII(lunar);
  const summary = buildSummary(lunar, score);

  // Home (index)
  if (document.body.dataset.page === 'today') {
    if (score != null) setText('aii-value', score);
    setText('aii-phase', lunar.moonPhase || '–');
    setText(
      'aii-illumination',
      isNaN(lunar.moonIllumination) ? '–' : `${lunar.moonIllumination.toFixed(1)}%`
    );
    const ts = `${formatDate(lunar.date)} · ${formatTime(lunar.date)}`;
    setText('aii-updated', ts);
    setText('aii-summary', summary);
  }

  // Lunar page
  if (document.body.dataset.page === 'lunar') {
    setText('lunar-phase', lunar.moonPhase || '–');
    setText(
      'lunar-illumination',
      isNaN(lunar.moonIllumination) ? '–' : `${lunar.moonIllumination.toFixed(1)}%`
    );
    setText('lunar-rise', lunar.moonrise || '–');
    setText('lunar-set', lunar.moonset || '–');
    setText('lunar-distance', lunar.moonDistanceKm ? `${lunar.moonDistanceKm} km` : '–');
    setText('lunar-note', summary);
  }

  // Signals page
  if (document.body.dataset.page === 'signals') {
    if (score != null) setText('signals-aii', score);
    setText('signals-phase', lunar.moonPhase || '–');
    setText(
      'signals-illumination',
      isNaN(lunar.moonIllumination) ? '–' : `${lunar.moonIllumination.toFixed(1)}%`
    );
    setText('signals-summary', summary);
  }
}

document.addEventListener('DOMContentLoaded', initAstral);