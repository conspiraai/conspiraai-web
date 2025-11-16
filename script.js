// Conspira AI - Small UI helpers

function smoothScrollToSection(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "start" });
}

document.addEventListener("DOMContentLoaded", () => {
  // Nav clicks
  const navLinks = document.querySelectorAll(".nav__link[data-target]");
  navLinks.forEach((link) => {
    link.addEventListener("click", () => {
      const target = link.getAttribute("data-target");
      if (target) {
        smoothScrollToSection(target);
      }
      navLinks.forEach((l) => l.classList.remove("nav__link--active"));
      link.classList.add("nav__link--active");
    });
  });

  // Hero buttons
  const indexBtn = document.getElementById("scroll-to-index");
  if (indexBtn) {
    indexBtn.addEventListener("click", () => smoothScrollToSection("top"));
  }

  const networkBtn = document.getElementById("scroll-to-network");
  if (networkBtn) {
    networkBtn.addEventListener("click", () => smoothScrollToSection("network"));
  }
});