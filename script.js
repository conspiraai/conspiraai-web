/*
 * script.js – light UI helpers
 * - Highlights active nav tab based on body[data-page]
 */

document.addEventListener('DOMContentLoaded', () => {
  const page = document.body.dataset.page;
  if (!page) return;

  const linkId = `nav-${page}`;
  const activeLink = document.getElementById(linkId);
  if (activeLink) {
    activeLink.classList.add('nav-active');
  }
});
