// Placeholder API key - replace later
const API_KEY = "YOUR_API_KEY_HERE";

async function loadAstralData() {
  try {
    const url = `https://api.ipgeolocation.io/astronomy?apiKey=${API_KEY}&location=Washington,DC`;
    const res = await fetch(url);
    const data = await res.json();

    document.getElementById("moon-phase").innerText = data.moon_phase;
    document.getElementById("moon-illumination").innerText = data.moon_illumination;

    // Simple Astral Charge calc (0–100)
    const charge = Math.round((data.moon_illumination / 100) * 100);
    document.getElementById("astral-charge").innerText = charge;
  } catch (err) {
    console.error("Astral API error:", err);
  }
}

window.onload = loadAstralData;
