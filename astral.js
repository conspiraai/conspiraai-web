// Conspira AI - Astral & Horoscope Engine
// Uses IPGeolocation.io Astronomy API + Aztro horoscope API

const ASTRONOMY_API_KEY = "82fd924c51bf4ac48bd9c64119b1d606"; // your key
const OBSERVER_LOCATION = "Rehoboth Beach,DE"; // change if you want
const DEFAULT_SIGN = "aries"; // can change later or make it user-selectable

function formatKm(value) {
  if (!value && value !== 0) return "–";
  const num = Number(value);
  if (Number.isNaN(num)) return String(value);
  return `${num.toLocaleString("en-US")} km`;
}

function computeAstralCharge(illumination, phase, distanceKm) {
  let charge = Number(illumination) || 0;

  const phaseLower = (phase || "").toLowerCase();
  if (phaseLower.includes("full")) {
    charge += 18;
  } else if (phaseLower.includes("new")) {
    charge += 12;
  } else if (
    phaseLower.includes("first quarter") ||
    phaseLower.includes("last quarter")
  ) {
    charge += 8;
  } else {
    charge += 5;
  }

  if (distanceKm && Number(distanceKm) < 365000) {
    charge += 5;
  }

  charge = Math.max(0, Math.min(100, Math.round(charge)));
  return charge;
}

function buildChargeNote(charge, phase) {
  if (!charge && charge !== 0) {
    return "Unable to load live lunar data right now.";
  }

  const phaseText = phase || "current phase";

  if (charge >= 80) {
    return `High-charge window (${phaseText}). Historically linked with strong volatility within ~24–48h.`;
  }
  if (charge >= 60) {
    return `Charged window (${phaseText}). Volatility statistically elevated vs baseline.`;
  }
  if (charge >= 40) {
    return `Neutral-to-charged window (${phaseText}). Conditions tradable but not extreme.`;
  }
  return `Low-charge window (${phaseText}). Better for accumulation, journaling, and reset than aggressive risk.`;
}

async function fetchLunarData() {
  if (!ASTRONOMY_API_KEY) {
    throw new Error("Missing astronomy API key");
  }

  const url = `https://api.ipgeolocation.io/astronomy?apiKey=${ASTRONOMY_API_KEY}&location=${encodeURIComponent(
    OBSERVER_LOCATION
  )}`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Astronomy API error: ${res.status}`);
  }
  return res.json();
}

async function fetchDailyHoroscope(sign = DEFAULT_SIGN, day = "today") {
  // Aztro API: https://aztro.sameerkumar.work
  const url = `https://aztro.sameerkumar.work?sign=${encodeURIComponent(
    sign
  )}&day=${encodeURIComponent(day)}`;

  const res = await fetch(url, {
    method: "POST",
  });

  if (!res.ok) {
    throw new Error(`Horoscope API error: ${res.status}`);
  }
  return res.json();
}

async function loadAstralData() {
  const chargeEl = document.getElementById("astral-charge");
  const noteEl = document.getElementById("astral-note");
  const phaseEl = document.getElementById("moon-phase");
  const illumEl = document.getElementById("moon-illumination");
  const distEl = document.getElementById("moon-distance");
  const locEl = document.getElementById("observer-location");
  const horoscopeTextEl = document.getElementById("horoscope-text");
  const horoscopeSignLabelEl = document.getElementById("horoscope-sign-label");

  try {
    const [astroData, horoscopeData] = await Promise.all([
      fetchLunarData(),
      fetchDailyHoroscope(DEFAULT_SIGN, "today"),
    ]);

    const phase = astroData.moon_phase || "Unknown";
    const illumination = Number(astroData.moon_illumination) || null;
    const distanceKm = Number(astroData.moon_distance) || null;

    const charge = computeAstralCharge(
      illumination,
      phase,
      distanceKm
    );
    const note = buildChargeNote(charge, phase);

    if (chargeEl) chargeEl.textContent = charge;
    if (noteEl) noteEl.textContent = note;
    if (phaseEl) phaseEl.textContent = phase;
    if (illumEl) {
      illumEl.textContent =
        illumination != null ? `${illumination.toFixed(1)}%` : "–";
    }
    if (distEl) distEl.textContent = formatKm(distanceKm);
    if (locEl) locEl.textContent = OBSERVER_LOCATION;

    if (horoscopeData && horoscopeTextEl) {
      horoscopeTextEl.textContent =
        horoscopeData.description ||
        "No astral download available for this window.";
    }
    if (horoscopeSignLabelEl) {
      horoscopeSignLabelEl.textContent =
        (DEFAULT_SIGN[0].toUpperCase() + DEFAULT_SIGN.slice(1)) +
        " · " +
        (horoscopeData?.current_date || "");
    }
  } catch (err) {
    console.error("Conspira AI: error loading astral data", err);
    if (noteEl) {
      noteEl.textContent =
        "Error loading live data. Check back in a few minutes.";
    }
    if (horoscopeTextEl) {
      horoscopeTextEl.textContent =
        "Unable to fetch today's astral energy. Network or API issue.";
    }
  }
}

document.addEventListener("DOMContentLoaded", loadAstralData);