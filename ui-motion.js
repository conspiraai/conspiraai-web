/*
 * ui-motion.js – subtle UI motion helpers
 * - hover lift handled via CSS
 * - scroll reveal + nav underline
 */

document.addEventListener('DOMContentLoaded', () => {
  const reduceMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  const shouldReduce = reduceMotionQuery.matches;

  const revealSelectors = ['.section', '.card', '.hero-copy', '.hero-core'];
  const revealTargets = Array.from(
    new Set(
      revealSelectors
        .flatMap((selector) => Array.from(document.querySelectorAll(selector)))
        .filter((el) => el && el.id !== 'bg-fx')
    )
  );

  revealTargets.forEach((element) => {
    element.classList.add('reveal');
  });

  if (shouldReduce) {
    revealTargets.forEach((element) => {
      element.classList.add('is-visible');
    });
  } else if ('IntersectionObserver' in window) {
    const revealObserver = new IntersectionObserver(
      (entries, observer) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        });
      },
      { threshold: 0.2, rootMargin: '0px 0px -10% 0px' }
    );

    revealTargets.forEach((element, index) => {
      const delay = Math.min(index * 140, 840);
      element.style.transitionDelay = `${delay}ms`;
      revealObserver.observe(element);
    });
  } else {
    revealTargets.forEach((element) => {
      element.classList.add('is-visible');
    });
  }

  const nav = document.querySelector('.nav');
  if (!nav) {
    return;
  }

  const underline = document.createElement('span');
  underline.className = 'nav-underline';
  nav.appendChild(underline);

  const navLinks = Array.from(nav.querySelectorAll('a'));
  const page = document.body.dataset.page;
  const navKey = page === 'home' ? 'today' : page;
  let activeLink = nav.querySelector('.nav-active');
  if (!activeLink && navKey) {
    activeLink = nav.querySelector(`#nav-${navKey}`);
  }
  if (!activeLink) {
    activeLink = navLinks[0];
  }

  const moveUnderline = (link, instant = false) => {
    if (!link) return;
    const navRect = nav.getBoundingClientRect();
    const linkRect = link.getBoundingClientRect();
    const offset = linkRect.left - navRect.left + nav.scrollLeft;
    if (instant || shouldReduce) {
      underline.style.transition = 'none';
    } else {
      underline.style.transition = '';
    }
    underline.style.width = `${linkRect.width}px`;
    underline.style.transform = `translateX(${offset}px)`;
    if (instant || shouldReduce) {
      requestAnimationFrame(() => {
        underline.style.transition = '';
      });
    }
  };

  moveUnderline(activeLink, true);

  navLinks.forEach((link) => {
    link.addEventListener('click', () => {
      activeLink = link;
      moveUnderline(link);
    });
  });

  window.addEventListener('resize', () => {
    moveUnderline(activeLink, true);
  });
});
