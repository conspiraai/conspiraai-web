(() => {
  const canvas = document.getElementById('bg-fx');
  if (!canvas) {
    return;
  }

  const reduceMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  if (reduceMotionQuery.matches) {
    return;
  }

  const ctx = canvas.getContext('2d', { alpha: true });
  if (!ctx) {
    return;
  }

  const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  const cores = navigator.hardwareConcurrency || 4;
  const isLowPower = isTouch || cores <= 4;
  const particleCount = isLowPower ? 32 : 64;
  const maxDpr = isLowPower ? 1.2 : 1.7;
  const targetFrameTime = isLowPower ? 1000 / 30 : 1000 / 60;

  let width = 0;
  let height = 0;
  let dpr = 1;
  let particles = [];
  let lastTime = 0;
  let resizeHandle = 0;

  const pointer = {
    x: 0,
    y: 0,
    targetX: 0,
    targetY: 0,
  };

  const randomBetween = (min, max) => min + Math.random() * (max - min);

  const initParticles = () => {
    particles = Array.from({ length: particleCount }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      radius: randomBetween(0.8, 2.4),
      alpha: randomBetween(0.08, 0.35),
      driftX: randomBetween(-0.08, 0.08),
      driftY: randomBetween(0.04, 0.18),
      twinkle: randomBetween(0.2, 1.2),
      hueShift: randomBetween(-12, 12),
    }));
  };

  const resize = () => {
    width = window.innerWidth;
    height = window.innerHeight;
    dpr = Math.min(window.devicePixelRatio || 1, maxDpr);
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    initParticles();
  };

  const scheduleResize = () => {
    if (resizeHandle) {
      cancelAnimationFrame(resizeHandle);
    }
    resizeHandle = requestAnimationFrame(resize);
  };

  const updatePointer = (event) => {
    if (!width || !height) {
      return;
    }
    const nextX = (event.clientX / width - 0.5) * 2;
    const nextY = (event.clientY / height - 0.5) * 2;
    pointer.targetX = Math.max(-1, Math.min(1, nextX));
    pointer.targetY = Math.max(-1, Math.min(1, nextY));
  };

  const resetPointer = () => {
    pointer.targetX = 0;
    pointer.targetY = 0;
  };

  const drawNebula = (time) => {
    const driftX = Math.sin(time * 0.00008) * width * 0.08 + pointer.x * width * 0.04;
    const driftY = Math.cos(time * 0.00007) * height * 0.08 + pointer.y * height * 0.04;
    const secondaryX = Math.cos(time * 0.00005) * width * 0.06 - pointer.x * width * 0.02;
    const secondaryY = Math.sin(time * 0.00006) * height * 0.06 - pointer.y * height * 0.02;

    const gradientOne = ctx.createRadialGradient(
      width * 0.2 + driftX,
      height * 0.25 + driftY,
      0,
      width * 0.2 + driftX,
      height * 0.25 + driftY,
      Math.max(width, height) * 0.7
    );
    gradientOne.addColorStop(0, 'rgba(127, 219, 255, 0.12)');
    gradientOne.addColorStop(0.45, 'rgba(83, 110, 255, 0.06)');
    gradientOne.addColorStop(1, 'rgba(7, 10, 28, 0)');

    const gradientTwo = ctx.createRadialGradient(
      width * 0.75 + secondaryX,
      height * 0.55 + secondaryY,
      0,
      width * 0.75 + secondaryX,
      height * 0.55 + secondaryY,
      Math.max(width, height) * 0.6
    );
    gradientTwo.addColorStop(0, 'rgba(255, 138, 214, 0.1)');
    gradientTwo.addColorStop(0.5, 'rgba(74, 222, 255, 0.05)');
    gradientTwo.addColorStop(1, 'rgba(7, 10, 28, 0)');

    ctx.fillStyle = gradientOne;
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = gradientTwo;
    ctx.fillRect(0, 0, width, height);
  };

  const drawParticles = (time, delta) => {
    ctx.save();
    for (const particle of particles) {
      particle.x += particle.driftX * delta * 60;
      particle.y += particle.driftY * delta * 60;

      if (particle.x < -20) {
        particle.x = width + 20;
      } else if (particle.x > width + 20) {
        particle.x = -20;
      }

      if (particle.y < -20) {
        particle.y = height + 20;
      } else if (particle.y > height + 20) {
        particle.y = -20;
      }

      const pulse = 0.5 + Math.sin(time * 0.001 * particle.twinkle) * 0.5;
      ctx.fillStyle = `rgba(${110 + particle.hueShift}, 200, 255, ${
        particle.alpha * (0.6 + pulse * 0.4)
      })`;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  };

  const animate = (time) => {
    requestAnimationFrame(animate);

    if (document.hidden) {
      lastTime = time;
      return;
    }

    if (time - lastTime < targetFrameTime) {
      return;
    }

    const delta = Math.min((time - lastTime) / 1000, 0.04);
    lastTime = time;

    pointer.x += (pointer.targetX - pointer.x) * 0.05;
    pointer.y += (pointer.targetY - pointer.y) * 0.05;

    ctx.clearRect(0, 0, width, height);
    drawNebula(time);
    drawParticles(time, delta);
  };

  resize();

  window.addEventListener('resize', scheduleResize, { passive: true });
  window.addEventListener('pointermove', updatePointer, { passive: true });
  window.addEventListener('pointerleave', resetPointer, { passive: true });
  window.addEventListener('blur', resetPointer, { passive: true });

  requestAnimationFrame(animate);
})();
