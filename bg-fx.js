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
  const maxParallax = 3;
  const scrollParallaxMax = maxParallax * 0.6;
  const modeTransitionSeconds = 2.8;
  const intensityTransitionSeconds = 4;

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

  const parallax = {
    x: 0,
    y: 0,
    targetX: 0,
    targetY: 0,
  };

  const modeConfigs = {
    home: {
      colors: [
        [120, 196, 255],
        [164, 128, 255],
        [255, 160, 214],
      ],
      centers: [
        { x: 0.25, y: 0.2, r: 0.72 },
        { x: 0.7, y: 0.45, r: 0.62 },
        { x: 0.45, y: 0.75, r: 0.58 },
      ],
    },
    weekly: {
      colors: [
        [114, 214, 255],
        [92, 146, 255],
        [255, 182, 216],
      ],
      centers: [
        { x: 0.18, y: 0.3, r: 0.7 },
        { x: 0.68, y: 0.5, r: 0.64 },
        { x: 0.5, y: 0.78, r: 0.56 },
      ],
    },
    lunar: {
      colors: [
        [96, 186, 255],
        [160, 132, 255],
        [246, 168, 232],
      ],
      centers: [
        { x: 0.24, y: 0.22, r: 0.74 },
        { x: 0.74, y: 0.48, r: 0.6 },
        { x: 0.44, y: 0.76, r: 0.62 },
      ],
    },
    signals: {
      colors: [
        [118, 224, 250],
        [120, 158, 255],
        [255, 176, 210],
      ],
      centers: [
        { x: 0.2, y: 0.25, r: 0.7 },
        { x: 0.72, y: 0.42, r: 0.6 },
        { x: 0.5, y: 0.8, r: 0.58 },
      ],
    },
    network: {
      colors: [
        [108, 210, 255],
        [130, 150, 255],
        [255, 190, 220],
      ],
      centers: [
        { x: 0.22, y: 0.24, r: 0.72 },
        { x: 0.7, y: 0.5, r: 0.6 },
        { x: 0.48, y: 0.78, r: 0.6 },
      ],
    },
  };

  const aiiIntensityTargets = {
    calm: 0.7,
    charged: 0.95,
    extreme: 1.15,
  };

  const modeState = {
    mode: 'home',
    colors: modeConfigs.home.colors.map((color) => [...color]),
    centers: modeConfigs.home.centers.map((center) => ({ ...center })),
  };

  const intensityState = {
    value: aiiIntensityTargets.calm,
    target: aiiIntensityTargets.calm,
  };

  const randomBetween = (min, max) => min + Math.random() * (max - min);
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const driftWave = (time, period, phase = 0) =>
    Math.sin((time / period) * Math.PI * 2 + phase);

  const lerp = (from, to, amount) => from + (to - from) * amount;
  const easeToward = (from, to, delta, duration) =>
    lerp(from, to, 1 - Math.exp(-delta / duration));

  const getPageMode = () => {
    const page = document.body?.dataset?.page;
    if (page === 'today') {
      return 'home';
    }
    if (page && modeConfigs[page]) {
      return page;
    }
    return 'home';
  };

  const updateModeTarget = () => {
    const nextMode = getPageMode();
    if (nextMode !== modeState.mode) {
      modeState.mode = nextMode;
    }
  };

  const updateBandTarget = () => {
    const band = document.body?.dataset?.aiiBand;
    const target = aiiIntensityTargets[band] || aiiIntensityTargets.calm;
    intensityState.target = target;
  };

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
    updateScrollTarget();
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

  const updateScrollTarget = () => {
    if (!height) {
      return;
    }
    const docHeight = document.documentElement.scrollHeight || height;
    const maxScroll = Math.max(docHeight - height, 1);
    const ratio = window.scrollY / maxScroll;
    const drift = (ratio - 0.5) * 2 * scrollParallaxMax;
    parallax.targetY = clamp(drift, -scrollParallaxMax, scrollParallaxMax);
  };

  const drawNebula = (timeSeconds) => {
    const timeDriftX =
      driftWave(timeSeconds, 37) * width * 0.035 +
      driftWave(timeSeconds, 53, 1.4) * width * 0.025;
    const timeDriftY =
      driftWave(timeSeconds, 41, 0.8) * height * 0.04 +
      driftWave(timeSeconds, 59, 2.1) * height * 0.02;
    const pointerDriftX = pointer.x * width * 0.02;
    const pointerDriftY = pointer.y * height * 0.02;

    const alphaScale = clamp(intensityState.value, 0.6, 1.25);
    const alphas = [
      Math.min(0.055 * alphaScale, 0.079),
      Math.min(0.045 * alphaScale, 0.072),
      Math.min(0.038 * alphaScale, 0.068),
    ];

    modeState.centers.forEach((center, index) => {
      const color = modeState.colors[index];
      const baseX = width * center.x;
      const baseY = height * center.y;
      const driftX =
        timeDriftX * (0.7 + index * 0.2) +
        pointerDriftX * (0.5 + index * 0.2);
      const driftY =
        timeDriftY * (0.7 + index * 0.2) +
        pointerDriftY * (0.5 + index * 0.2);
      const radius = Math.max(width, height) * center.r;
      const gradient = ctx.createRadialGradient(
        baseX + driftX,
        baseY + driftY,
        0,
        baseX + driftX,
        baseY + driftY,
        radius
      );
      gradient.addColorStop(
        0,
        `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${alphas[index]})`
      );
      gradient.addColorStop(
        0.5,
        `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${alphas[index] * 0.45})`
      );
      gradient.addColorStop(1, 'rgba(7, 10, 28, 0)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);
    });
  };

  const drawParticles = (time, delta) => {
    ctx.save();
    const intensityScale = clamp(intensityState.value, 0.6, 1.2);
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
        particle.alpha * intensityScale * (0.6 + pulse * 0.4)
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
    const timeSeconds = time / 1000;

    pointer.x += (pointer.targetX - pointer.x) * 0.05;
    pointer.y += (pointer.targetY - pointer.y) * 0.05;

    const pointerOffsetX = isTouch ? 0 : pointer.x * maxParallax;
    const pointerOffsetY = isTouch ? 0 : pointer.y * maxParallax;
    parallax.targetX = pointerOffsetX;
    parallax.x += (parallax.targetX - parallax.x) * 0.06;
    parallax.y += (parallax.targetY + pointerOffsetY - parallax.y) * 0.06;

    const finalX = clamp(parallax.x, -maxParallax, maxParallax);
    const finalY = clamp(parallax.y, -maxParallax, maxParallax);
    canvas.style.transform = `translate3d(${finalX.toFixed(2)}px, ${finalY.toFixed(
      2
    )}px, 0)`;

    updateModeTarget();
    updateBandTarget();

    const targetConfig = modeConfigs[modeState.mode];
    const modeBlend = 1 - Math.exp(-delta / modeTransitionSeconds);
    targetConfig.colors.forEach((color, index) => {
      modeState.colors[index][0] = lerp(
        modeState.colors[index][0],
        color[0],
        modeBlend
      );
      modeState.colors[index][1] = lerp(
        modeState.colors[index][1],
        color[1],
        modeBlend
      );
      modeState.colors[index][2] = lerp(
        modeState.colors[index][2],
        color[2],
        modeBlend
      );
    });
    targetConfig.centers.forEach((center, index) => {
      modeState.centers[index].x = lerp(
        modeState.centers[index].x,
        center.x,
        modeBlend
      );
      modeState.centers[index].y = lerp(
        modeState.centers[index].y,
        center.y,
        modeBlend
      );
      modeState.centers[index].r = lerp(
        modeState.centers[index].r,
        center.r,
        modeBlend
      );
    });

    intensityState.value = easeToward(
      intensityState.value,
      intensityState.target,
      delta,
      intensityTransitionSeconds
    );

    ctx.clearRect(0, 0, width, height);
    drawNebula(timeSeconds);
    drawParticles(time, delta);
  };

  resize();

  window.addEventListener('resize', scheduleResize, { passive: true });
  window.addEventListener('scroll', updateScrollTarget, { passive: true });
  if (!isTouch) {
    window.addEventListener('pointermove', updatePointer, { passive: true });
    window.addEventListener('pointerleave', resetPointer, { passive: true });
    window.addEventListener('blur', resetPointer, { passive: true });
  }

  requestAnimationFrame(animate);
})();
