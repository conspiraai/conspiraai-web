// Conspira AI - small UI helpers

// Simple scroll-to-section for nav labels (where it makes sense)
document.addEventListener("DOMContentLoaded", () => {
  const links = document.querySelectorAll(".nav__link");
  links.forEach((link) => {
    link.addEventListener("click", () => {
      const text = link.textContent?.trim().toLowerCase();
      if (text === "network") {
        document.getElementById("network")?.scrollIntoView({ behavior: "smooth" });
      } else if (text === "signals") {
        document.getElementById("how-it-works")?.scrollIntoView({ behavior: "smooth" });
      }
    });
  });
});
