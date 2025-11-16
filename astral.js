/*
 * Conspira AI – Astral data + logic
 * Uses ipgeolocation.io Astronomy API to pull live moon data and compute AII.
 */

const IPGEO_API_KEY = "82fd924c51bf4ac48bd9c64119b1d606";
// You can change this to any city string ipgeolocation understands.
const OBSERVER_LOCATION = "New York,US";

async function fetchLunarData() {
  const url = `https://api.ipgeolocation.io/astronomy?apiKey=${IPGEO_API_KEY}&location=${encodeURIComponent(
    OBSERVER_LOCATION
  )}`;

  try {
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Astronomy API error ${res.status}`);
    }
    const data = await res.json();

    return {
      phase: data.moon_phase || "Unknown",
      illumination: Number(data.moon_illumination) || null,
      distanceKm: Number(data.moon_distance) || null,
      location: OBSERVER_LOCATION,
    };
  } catch (err) {
    console.error("Conspira AI – error fetching lunar data:", err);
    return null;
  }
}

/**
 * Compute Astral Intelligence Index (0–100)
 * Basic formula using illumination + phase + distance
 */
function computeAstralIndex(lunar) {
  if (!lunar) return null;

  let score = 0;

  // base from illumination (0–100)
  if (typeof lunar.illumination === "number") {
    score += lunar.illumination * 0.7;
  }

  const phase = (lunar.phase || "").toLowerCase();

  // phase bonuses
  if (phase.includes("full")) {
    score += 20;
  } else if (phase.includes("new")) {
    score += 12;
  } else if (phase.includes("gibbous") || phase.includes("quarter")) {
    score += 6;
  } else if (phase.includes("crescent")) {
    score += 3;
  }

  // distance bonus: closer than ~365k km
  if (typeof lunar.distanceKm === "number" && lunar.distanceKm < 365000) {
    score += 5;
  }

  score = Math.round(score);
  if (score < 0) score = 0;
  if (score > 100) score = 100;

  return score;
}

function bandForIndex(index) {
  if (index == null) return { label: "Unknown", color: "neutral" };
  if (index < 25) return { label: "Reset zone", color: "low" };
  if (index < 50) return { label: "Neutral flow", color: "neutral" };
  if (index < 75) return { label: "Charged window", color: "charged" };
  return { label: "High-alert volatility", color: "high" };
}

function describeIndex(index, phase) {
  if (index == null) {
    return "Unable to load live lunar data right now.";
  }

  const p = phase || "the current moon";
  if (index >= 75) {
    return `High-charge window around ${p}. Historically associated with sharp, outsized moves within 24–48h.`;
  }
  if (index >= 55) {
    return `Charged window. ${p} tends to correlate with elevated volatility versus baseline.`;
  }
  if (index >= 35) {
    return `Neutral-to-charged window. Conditions are tradable but not extreme; flows and narrative still matter more than sky.`;
  }
  return `Low-charge window. Better for accumulation, journaling, and reset than aggressive risk.`;
}

/**
 * Generate a simple 7-day forward "timeline" from today's index.
 * Not real future API data yet – just a shaped curve based on today's reading.
 */
function generateTimeline(index) {
  const today = new Date();
  const base = index == null ? 40 : index;
  const items = [];

  for (let i = 0; i < 7; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);

    // simple shaping curve
    const offset = (i - 3) * 4;
    const dayScore = Math.max(0, Math.min(100, Math.round(base - offset)));

    const band = bandForIndex(dayScore);
    items.push({
      date: d,
      score: dayScore,
      band: band.label,
    });
  }

  return items;
}

/**
 * Generate a human-readable daily forecast text
 * based on today's index + band.
 */
function generateForecast(index, phase) {
  const band = bandForIndex(index);

  if (band.color === "high") {
    return `The field is highly charged. ${phase} plus crowd positioning often pull forward big moves here. Expect sharp swings and traps on both sides.`;
  }
  if (band.color === "charged") {
    return `Charged but not maxed. Expect more range, fake-outs, and narrative over-reactions as traders project onto the tape.`;
  }
  if (band.color === "neutral") {
    return `Neutral-leaning flow. ${phase} tends to express as rotation and digestion rather than wild expansion. Good for planning the next strike.`;
  }
  if (band.color === "low") {
    return `Low-charge space. Think reset, accumulation, and zoom-out. Great window to clean up bags, journal, and prep for the next high-charge band.`;
  }
  return `Reading the field is tricky today. Use risk lightly and let levels prove themselves.`;
}

// Expose globals for script.js
window.ConspiraAstral = {
  fetchLunarData,
  computeAstralIndex,
  bandForIndex,
  describeIndex,
  generateTimeline,
  generateForecast,
};
