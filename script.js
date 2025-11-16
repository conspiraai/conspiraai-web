/*
 * Conspira AI – UI wiring
 * Uses window.ConspiraAstral (from astral.js) to populate the page.
 */

document.addEventListener("DOMContentLoaded", () => {
  setupNavScrolling();
  loadAstralData();
});

function setupNavScrolling() {
  const navLinks = document.querySelectorAll(".nav__link, .btn[data-target]");

  navLinks.forEach((btn) => {
    btn.addEventListener("click", () => {
      const target = btn.getAttribute("data-target");
      if (target) {
        const el = document.querySelector(target);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }

      if (btn.classList.contains("nav__link")) {
        document
          .querySelectorAll(".nav__link")
          .forEach((l) => l.classList.remove("nav__link--active"));
        btn.classList.add("nav__link--active");
      }
    });
  });
}

async function loadAstralData() {
  const {
    fetchLunarData,
    computeAstralIndex,
    bandForIndex,
    describeIndex,
    generateTimeline,
    generateForecast,
  } = window.ConspiraAstral;

  const scoreEl = document.getElementById("aii-score");
  const bandEl = document.getElementById("aii-band");
  const noteEl = document.getElementById("aii-note");
  const phaseEl = document.getElementById("moon-phase");
  const illumEl = document.getElementById("moon-illum");
  const distEl = document.getElementById("moon-distance");
  const locEl = document.getElementById("observer-location");
  const timelineEl = document.getElementById("timeline");
  const forecastEl = document.getElementById("forecast-text");

  try {
    const lunar = await fetchLunarData();

    if (!lunar) {
      if (noteEl) {
        noteEl.textContent =
          "Error loading live data. Try again in a few minutes.";
      }
      return;
    }

    const index = computeAstralIndex(lunar);
    const band = bandForIndex(index);

    if (scoreEl) scoreEl.textContent = index != null ? index : "–";
    if (bandEl) bandEl.textContent = band.label;
    if (noteEl) noteEl.textContent = describeIndex(index, lunar.phase);

    if (phaseEl) phaseEl.textContent = lunar.phase || "–";
    if (illumEl)
      illumEl.textContent =
        typeof lunar.illumination === "number"
          ? `${lunar.illumination.toFixed(1)}%`
          : "–";
    if (distEl)
      distEl.textContent =
        typeof lunar.distanceKm === "number"
          ? `${lunar.distanceKm.toLocaleString("en-US")} km`
          : "–";
    if (locEl) locEl.textContent = lunar.location || "Planet Earth";

    // Timeline
    const items = generateTimeline(index);
    if (timelineEl) {
      timelineEl.innerHTML = "";
      items.forEach((item) => {
        const row = document.createElement("div");
        row.className = "timeline-item";

        const daySpan = document.createElement("div");
        daySpan.className = "timeline-day";
        daySpan.textContent = item.date.toLocaleDateString("en-US", {
          weekday: "short",
          month: "short",
          day: "numeric",
        });

        const scoreSpan = document.createElement("div");
        scoreSpan.className = "timeline-score";
        scoreSpan.textContent = item.score;

        const bandSpan = document.createElement("div");
        bandSpan.className = "timeline-band";
        bandSpan.textContent = item.band;

        row.appendChild(daySpan);
        row.appendChild(scoreSpan);
        row.appendChild(bandSpan);
        timelineEl.appendChild(row);
      });
    }

    // Forecast
    if (forecastEl) {
      forecastEl.textContent = generateForecast(index, lunar.phase);
    }
  } catch (err) {
    console.error("Conspira AI – error wiring data:", err);
    if (noteEl) {
      noteEl.textContent =
        "Error loading live data. Try again in a few minutes.";
    }
  }
}
