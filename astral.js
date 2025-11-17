/*
 * Conspira AI – Astral data + index logic
 * Uses ipgeolocation.io Astronomy API with your API key.
 */

const CONSPIRA_API_KEY = "82fd924c51bf4ac48bd9c64119b1d606"; // your key
const CONSPIRA_LOCATION = "New York,US"; // change if you want

async function fetchLunarData() {
  if (!CONSPIRA_API_KEY) {
    throw new Error("Missing API key");
  }

  const url = `https://api.ipgeolocation.io/astronomy?apiKey=${CONSPIRA_API_KEY}&location=${encodeURIComponent(
    CONSPIRA_LOCATION
  )}`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Astronomy API error ${res.status}`);
  }
  const data = await res.json();

  return {
    phase: data.moon_phase,
    illumination: Number(data.moon_illumination),
    distanceKm: Number(data.moon_distance),
    sunDistanceKm: Number(data.sun_distance),
    location: CONSPIRA_LOCATION,
  };
}

function computeAstralIndex(lunar) {
  let score = 0;

  // Base from illumination
  if (!Number.isNaN(lunar.illumination)) {
    score += lunar.illumination * 0.6; // 0–60
  }

  // Phase weighting
  const phase = (lunar.phase || "").toLowerCase();
  if (phase.includes("full")) {
    score += 25;
  } else if (phase.includes("new")) {
    score += 18;
  } else if (phase.includes("gibbous") || phase.includes("quarter")) {
    score += 10;
  } else if (phase.includes("crescent")) {
    score += 6;
  }

  // Distance tweak – closer moon slightly higher
  if (!Number.isNaN(lunar.distanceKm) && lunar.distanceKm > 0) {
    const closeness = Math.max(
      0,
      Math.min(1, (405000 - lunar.distanceKm) / (405000 - 356000))
    ); // 0 at far, 1 at close
    score += closeness * 10;
  }

  // Clamp
  score = Math.round(Math.max(0, Math.min(100, score)));
  return score;
}

function interpretIndex(score, phase) {
  let band = "";
  let note = "";

  if (score >= 75) {
    band = "High-charge window";
    note = `Strongly charged ${phase || "window"} – historically associated with elevated volatility within 24–48h.`;
  } else if (score >= 55) {
    band = "Charged volatility window";
    note = `Above-baseline tension – conditions favour outsized moves and faster trend shifts.`;
  } else if (score >= 35) {
    band = "Neutral-to-charged";
    note =
      "Tradable but not extreme. News and flows matter more than the sky; good for following trend, not forcing risk.";
  } else {
    band = "Low-charge reset";
    note =
      "Better for accumulation, journaling and planning than aggressive risk. Watch positioning rather than chasing.";
  }

  return { band, note };
}

function formatKm(km) {
  if (!km || Number.isNaN(km)) return "–";
  return `${Math.round(km).toLocaleString("en-US")} km`;
}

async function loadAstralCard() {
  const scoreEl = document.getElementById("ai-score");
  const bandEl = document.getElementById("ai-band");
  const noteEl = document.getElementById("ai-note");
  const phaseEl = document.getElementById("moon-phase");
  const illumEl = document.getElementById("moon-illumination");
  const distEl = document.getElementById("moon-distance");
  const locEl = document.getElementById("location-label");
  const timelineSummaryEl = document.getElementById("timeline-summary");

  try {
    if (bandEl) bandEl.textContent = "Loading live lunar data…";

    const lunar = await fetchLunarData();
    const score = computeAstralIndex(lunar);
    const { band, note } = interpretIndex(score, lunar.phase);

    if (scoreEl) scoreEl.textContent = score;
    if (bandEl) bandEl.textContent = band;
    if (noteEl) noteEl.textContent = note;
    if (phaseEl) phaseEl.textContent = lunar.phase || "–";
    if (illumEl)
      illumEl.textContent =
        Number.isNaN(lunar.illumination) || lunar.illumination == null
          ? "–"
          : `${lunar.illumination.toFixed(1)}%`;
    if (distEl) distEl.textContent = formatKm(lunar.distanceKm);
    if (locEl) locEl.textContent = lunar.location;

    if (timelineSummaryEl)
      timelineSummaryEl.textContent = `Based on today’s AII score of ${score}, the next week is projected as ${
        score >= 70 ? "highly charged" : score >= 50 ? "moderately charged" : "muted"
      }.`;

    // Hand off to script.js to build the 7-day timeline if available
    if (typeof window.buildTimeline === "function") {
      window.buildTimeline(score, lunar.phase);
    }
  } catch (err) {
    console.error("Conspira AI astral load error:", err);
    if (bandEl) bandEl.textContent = "Error loading data";
    if (noteEl)
      noteEl.textContent =
        "We couldn’t reach the astral API right now. Refresh in a minute or check your API key.";
  }
}

document.addEventListener("DOMContentLoaded", loadAstralCard);
