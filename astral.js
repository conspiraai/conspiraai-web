// ==============================
//  Conspira AI – Astral Engine
//  Live Lunar Data + Astral Charge
// ==============================

// YOUR API KEY (TEMPORARY — MOVE TO ENV VAR LATER)
const API_KEY = "82fd924c51bfa4ac48bd3c64119b1d606";

// API endpoint
const API_URL = `https://api.ipgeolocation.io/astronomy?apiKey=${API_KEY}`;

// DOM Elements
const indexScoreEl = document.getElementById("index-score");
const indexNoteEl = document.getElementById("index-note");
const moonPhaseEl = document.getElementById("moon-phase");
const moonIllumEl = document.getElementById("moon-illumination");
const moonDistEl = document.getElementById("moon-distance");

// ==============================
// Compute Astral Charge (0–100)
// ==============================
function computeAstralCharge(phase, illumination, distanceKm) {
  let score = Number(illumination);

  // Phase bonuses
  const phaseLower = phase.toLowerCase();
  if (phaseLower.includes("full") || phaseLower.includes("new")) {
    score += 10;
  }

  // Distance bonus (closer moon → more influence)
  if (Number(distanceKm) < 370000) {
    score += 5;
  }

  return Math.min(100, Math.round(score));
}

// ==============================
// Interpretation Text
// ==============================
function getIndexNote(score) {
  if (score >= 70) return "High-charge window — strong probability of outsized moves.";
  if (score >= 40) return "Charged — volatility statistically elevated.";
  if (score >= 20) return "Neutral — news & flows drive price more than stars.";
  return "Low charge — chop, accumulation, or reset.";
}

// ==============================
// Fetch & Update Page
// ==============================
async function loadAstralData() {
  try {
    const res = await fetch(API_URL);
    const data = await res.json();

    const phase = data.moon_phase;
    const illumination = data.moon_illumination;
    const distanceKm = data.moon_distance;

    const astralScore = computeAstralCharge(phase, illumination, distanceKm);
    const note = getIndexNote(astralScore);

    // Update UI
    if (indexScoreEl) indexScoreEl.textContent = astralScore;
    if (indexNoteEl) indexNoteEl.textContent = note;
    if (moonPhaseEl) moonPhaseEl.textContent = phase;
    if (moonIllumEl) moonIllumEl.textContent = illumination + "%";
    if (moonDistEl) moonDistEl.textContent = distanceKm + " km";
  } catch (err) {
    console.error("Astral API Error:", err);
  }
}

loadAstralData();
