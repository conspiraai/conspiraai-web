/*
 * script.js – light UI helpers
 * - Highlights active nav tab based on current pathname
 */

document.addEventListener('DOMContentLoaded', () => {
  const navLinks = document.querySelectorAll('.nav a[href]');
  if (!navLinks.length) return;

  const currentPath = window.location.pathname;

  const normalizePath = (path) => {
    if (!path) return '/';
    const cleaned = path.replace(/\/+$/, '') || '/';
    return cleaned === '/index.html' ? '/' : cleaned;
  };

  const normalizedCurrent = normalizePath(currentPath);

  navLinks.forEach((link) => {
    const href = link.getAttribute('href') || '';
    const hrefPath = normalizePath(new URL(href, window.location.origin).pathname);

    if (normalizedCurrent === hrefPath) {
      link.classList.add('active');
    }
  });
});
