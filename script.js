// Simple mock to animate the AII bar a bit on load.
// Later this file can fetch real AII + lunar/market data from your backend.

(function () {
  const valueEl = document.getElementById("aii-value");
  const barEl = document.getElementById("aii-bar-inner");
  if (!valueEl || !barEl) return;

  const target = parseInt(valueEl.textContent, 10) || 76;
  const targetWidth = Math.max(5, Math.min(100, target));

  barEl.style.width = "0%";

  setTimeout(() => {
    barEl.style.transition = "width 1.6s cubic-bezier(0.16, 1, 0.3, 1)";
    barEl.style.width = targetWidth + "%";
  }, 200);
})();
