// scripts/astral-autopilot.mjs
// Runs in GitHub Actions on a schedule.
// Fetches lunar data from ipgeolocation.io and writes data/astral-latest.json

import fs from "node:fs";
import path from "node:path";

// You already approved exposing this key on the frontend.
const IPGEO_API_KEY =
  process.env.IPGEO_API_KEY || "82fd924c51bf4ac48bd9c64119b1d606";
const IPGEO_ENDPOINT = `https://api.ipgeolocation.io/astronomy?apiKey=${IPGEO_API_KEY}`;

// ------------ helpers ------------

function parseIllumination(raw) {
  if (raw == null) return NaN;
  const cleaned = String(raw).replace("%", "").trim().replace(",", ".");
  const num = parseFloat(cleaned);
  return Number.isNaN(num) ? NaN : num;
}

async function fetchLunarData() {
  const res = await fetch(IPGEO_ENDPOINT);
  if (!res.ok) {
    throw new Error(`ipgeolocation non-200 status: ${res.status}`);
  }
  const data = await res.json();

  const moonIllumination = parseIllumination(data.moon_illumination);

  return {
    timestamp: new Date().toISOString(),
    moonPhase: data.moon_phase,
    moonIllumination,
    moonrise: data.moonrise,
    moonset: data.moonset,
    moonDistanceKm: data.moon_distance,
    sunDistanceKm: data.sun_distance,
  };
}

function computeAII(lunar) {
  if (!lunar) return null;

  const illum = Number.isNaN(lunar.moonIllumination)
    ? 0
    : lunar.moonIllumination;
  const phase = (lunar.moonPhase || "").toLowerCase();

  let phaseWeight = 0.2;

  if (phase.includes("full")) phaseWeight = 0.7;
  else if (phase.includes("new")) phaseWeight = 0.6;
  else if (phase.includes("gibbous")) phaseWeight = 0.45;
  else if (phase.includes("quarter")) phaseWeight = 0.35;
  else if (phase.includes("crescent")) phaseWeight = 0.25;

  const normIllum = Math.max(0, Math.min(illum, 100)) / 100;

  let score = normIllum * 50 + phaseWeight * 50;
  score = Math.round(Math.max(0, Math.min(score, 100)));

  return score;
}

function bandFromScore(score) {
  if (score == null || Number.isNaN(score)) return "–";
  if (score >= 70) return "extreme";
  if (score >= 36) return "charged";
  return "calm";
}

function buildSummary(lunar, score) {
  if (!lunar || score == null) return "Unable to load astral conditions.";

  const phase = (lunar.moonPhase || "").toLowerCase();
  const band = bandFromScore(score);

  let hook = "";
  if (band === "extreme") {
    hook = "Expect unstable or sharp moves around key levels.";
  } else if (band === "charged") {
    hook = "Watch for accelerations, fakeouts and expansion days.";
  } else {
    hook = "Tape is more likely to behave “normally”, but risk still applies.";
  }

  let phaseNote = "";
  if (phase.includes("full")) {
    phaseNote =
      "Full-moon regime often aligns with emotional and liquidity extremes.";
  } else if (phase.includes("new")) {
    phaseNote =
      "New-moon corridors lean toward trend resets and positioning shifts.";
  } else if (phase.includes("gibbous")) {
    phaseNote = "Gibbous windows often sit inside broader swing moves.";
  } else if (phase.includes("crescent") || phase.includes("quarter")) {
    phaseNote = "Transitional phases between major regime shifts.";
  }

  return `AII: ${score} (${band}). ${hook} ${phaseNote}`;
}

// ------------ main ------------

async function main() {
  try {
    const lunar = await fetchLunarData();
    const score = computeAII(lunar);
    const band = bandFromScore(score);
    const summary = buildSummary(lunar, score);

    const snapshot = {
      generatedAt: new Date().toISOString(),
      lunar,
      aii: {
        score,
        band,
        summary,
      },
    };

    const outDir = path.join(process.cwd(), "data");
    const outFile = path.join(outDir, "astral-latest.json");

    if (!fs.existsSync(outDir)) {
      fs.mkdirSync(outDir);
    }

    fs.writeFileSync(outFile, JSON.stringify(snapshot, null, 2), "utf8");
    console.log("Wrote:", outFile);
    console.log(snapshot);
  } catch (err) {
    console.error("Astral autopilot failed:", err);
    process.exit(1);
  }
}

main();
