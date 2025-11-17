/*
 * Conspira AI – UI wiring (nav + timeline)
 */

// Smooth scroll + active nav highlight
document.addEventListener("DOMContentLoaded", () => {
  const navLinks = Array.from(document.querySelectorAll(".nav-links a"));

  function setActive(hash) {
    navLinks.forEach((link) => {
      if (link.getAttribute("href") === hash) {
        link.classList.add("active");
      } else {
        link.classList.remove("active");
      }
    });
  }

  navLinks.forEach((link) => {
    link.addEventListener("click", (e) => {
      const href = link.getAttribute("href");
      if (href && href.startsWith("#")) {
        e.preventDefault();
        const target = document.querySelector(href);
        if (target) {
          target.scrollIntoView({ behavior: "smooth", block: "start" });
          setActive(href);
        }
      }
    });
  });

  // If loaded with a hash
  if (window.location.hash) {
    setActive(window.location.hash);
  }
});

// Build a simple 7-day trend row based on today’s AII score.
window.buildTimeline = function (todayScore, phase) {
  const container = document.getElementById("timeline-rows");
  if (!container) return;

  container.innerHTML = "";

  const base = typeof todayScore === "number" ? todayScore : 40;
  const now = new Date();
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  for (let i = 0; i < 7; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() + i);

    const label =
      i === 0
        ? "Today"
        : i === 1
        ? "Tomorrow"
        : `${dayNames[d.getDay()]} ${d.getMonth() + 1}/${d.getDate()}`;

    // Simple synthetic trend for now – you can later swap this with real future data
    const delta = (i === 0 ? 0 : (Math.sin(i) * 8).toFixed(0)) * 1;
    const score = Math.max(0, Math.min(100, Math.round(base + delta)));

    let tag = "Neutral";
    if (score >= 70) tag = "High-charge";
    else if (score >= 50) tag = "Charged";
    else if (score <= 30) tag = "Low-charge";

    const row = document.createElement("div");
    row.className = "timeline-row";

    const colDate = document.createElement("div");
    colDate.innerHTML = `<strong>${label}</strong>`;

    const colDesc = document.createElement("div");
    colDesc.textContent =
      i === 0
        ? `Current window: ${phase || "lunar cycle"}`
        : "Projected astral tension vs. today’s baseline.";

    const colTag = document.createElement("div");
    colTag.className = "timeline-pill";
    colTag.textContent = `${score} · ${tag}`;

    row.appendChild(colDate);
    row.appendChild(colDesc);
    row.appendChild(colTag);

    container.appendChild(row);
  }
};
