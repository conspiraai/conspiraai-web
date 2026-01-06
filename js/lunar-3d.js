/*
 * lunar-3d.js
 * Renders the Lunar × Market Timeline 3D scene and UI controls.
 */

const stage = document.getElementById('lunar-3d-stage');
const canvas = document.getElementById('lunar-3d-canvas');
const statusBadge = document.getElementById('lunar-3d-status');
const sceneStatus = document.getElementById('scene-status');
const rangeInput = document.getElementById('timeline-range');
const playButton = document.getElementById('timeline-play');
const marketStatus = document.getElementById('market-status');
const timestampEl = document.getElementById('selected-timestamp');
const phaseEl = document.getElementById('selected-phase');
const illuminationEl = document.getElementById('selected-illumination');
const priceEl = document.getElementById('selected-price');

const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const state = {
  marketData: [],
  marketPoints: [],
  playhead: 0,
  isPlaying: !prefersReducedMotion,
  baseTimestamp: Date.now(),
  threeReady: false,
  fallbackReady: false,
  lastIllumination: 50
};

const LUNAR_CYCLE_DAYS = 29.53;
const ORBIT_RADIUS = 3.2;
const FALLBACK_STATUS = '3D unavailable — showing simplified view.';
const MARKET_STATUS_LOADING = 'Loading market data…';
const MARKET_STATUS_LOADED = 'Market data loaded ✓';
const MARKET_STATUS_FALLBACK = 'Using fallback market data ✓';

let THREE = null;
let OrbitControls = null;
let scene = null;
let camera = null;
let renderer = null;
let controls = null;
let moon = null;
let chartGroup = null;
let cursor = null;
let fallbackContext = null;
let fallbackStars = [];
let threeModuleUrl = null;

function updateSceneStatus(text) {
  if (statusBadge) statusBadge.textContent = text;
  if (sceneStatus) sceneStatus.textContent = text;
}

function formatTimestamp(date) {
  if (!date || Number.isNaN(date.getTime())) return '–';
  return date.toLocaleString([], {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function formatPrice(value) {
  if (value == null || Number.isNaN(value)) return '–';
  return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function cycleMs() {
  return LUNAR_CYCLE_DAYS * 24 * 60 * 60 * 1000;
}

function moonPhaseName(phaseFraction) {
  const phase = (phaseFraction + 1) % 1;
  if (phase < 0.0625 || phase >= 0.9375) return 'New Moon';
  if (phase < 0.1875) return 'Waxing Crescent';
  if (phase < 0.3125) return 'First Quarter';
  if (phase < 0.4375) return 'Waxing Gibbous';
  if (phase < 0.5625) return 'Full Moon';
  if (phase < 0.6875) return 'Waning Gibbous';
  if (phase < 0.8125) return 'Last Quarter';
  return 'Waning Crescent';
}

function computePhase(date) {
  const phaseFraction =
    ((date.getTime() - state.baseTimestamp) % cycleMs()) / cycleMs();
  const normalized = (phaseFraction + 1) % 1;
  const angle = normalized * Math.PI * 2;
  const illumination = clamp((1 - Math.cos(angle)) * 50, 0, 100);
  return { phaseFraction: normalized, angle, illumination };
}

function updateInfoPanel({ date, phaseName, illumination, price }) {
  if (timestampEl) timestampEl.textContent = formatTimestamp(date);
  if (phaseEl) phaseEl.textContent = phaseName || '–';
  if (illuminationEl) {
    illuminationEl.textContent =
      illumination == null || Number.isNaN(illumination)
        ? '–'
        : `${illumination.toFixed(1)}%`;
  }
  if (priceEl) priceEl.textContent = formatPrice(price);
}

function updateMoonPosition(angle) {
  if (!moon) return;
  moon.position.set(Math.cos(angle) * ORBIT_RADIUS, 0, Math.sin(angle) * ORBIT_RADIUS);
}

function updateCursor(index) {
  if (!cursor || !state.marketPoints.length) return;
  const clampedIndex = clamp(index, 0, state.marketPoints.length - 1);
  cursor.position.copy(state.marketPoints[clampedIndex]);
}

function updateFallbackScene(illumination) {
  if (!fallbackContext || !stage || !canvas) return;
  const rect = stage.getBoundingClientRect();
  const width = Math.max(1, rect.width);
  const height = Math.max(1, rect.height);
  canvas.width = Math.floor(width * window.devicePixelRatio);
  canvas.height = Math.floor(height * window.devicePixelRatio);
  fallbackContext.setTransform(window.devicePixelRatio, 0, 0, window.devicePixelRatio, 0, 0);

  const gradient = fallbackContext.createRadialGradient(
    width * 0.5,
    height * 0.2,
    10,
    width * 0.5,
    height * 0.5,
    height * 0.8
  );
  gradient.addColorStop(0, 'rgba(30, 41, 59, 0.95)');
  gradient.addColorStop(1, 'rgba(2, 6, 23, 0.98)');
  fallbackContext.fillStyle = gradient;
  fallbackContext.fillRect(0, 0, width, height);

  fallbackStars.forEach((star) => {
    fallbackContext.fillStyle = star.color;
    fallbackContext.beginPath();
    fallbackContext.arc(star.x * width, star.y * height, star.size, 0, Math.PI * 2);
    fallbackContext.fill();
  });

  const moonX = width * 0.5;
  const moonY = height * 0.5;
  const moonRadius = Math.min(width, height) * 0.18;
  const phase = clamp(illumination ?? 50, 0, 100) / 100;

  fallbackContext.fillStyle = 'rgba(216, 219, 229, 0.9)';
  fallbackContext.beginPath();
  fallbackContext.arc(moonX, moonY, moonRadius, 0, Math.PI * 2);
  fallbackContext.fill();

  fallbackContext.globalCompositeOperation = 'destination-in';
  fallbackContext.beginPath();
  fallbackContext.arc(
    moonX + (0.5 - phase) * moonRadius * 2,
    moonY,
    moonRadius,
    0,
    Math.PI * 2
  );
  fallbackContext.fill();
  fallbackContext.globalCompositeOperation = 'source-over';

  fallbackContext.strokeStyle = 'rgba(148, 163, 184, 0.45)';
  fallbackContext.lineWidth = 1;
  fallbackContext.beginPath();
  fallbackContext.arc(moonX, moonY, moonRadius, 0, Math.PI * 2);
  fallbackContext.stroke();
}

function applyTimelineIndex(index) {
  const hasData = state.marketData.length > 0;
  const clampedIndex = hasData
    ? clamp(index, 0, state.marketData.length - 1)
    : 0;
  const entry = hasData ? state.marketData[clampedIndex] : null;
  const date = entry?.date ?? new Date();
  const price = entry?.price ?? null;

  const { phaseFraction, angle, illumination } = computePhase(date);

  updateMoonPosition(angle);
  updateCursor(clampedIndex);
  updateInfoPanel({
    date,
    phaseName: moonPhaseName(phaseFraction),
    illumination,
    price
  });

  if (!state.threeReady && state.fallbackReady) {
    updateFallbackScene(illumination);
  }
  state.lastIllumination = illumination;

  if (hasData) {
    rangeInput.value = String(clampedIndex);
    state.playhead = clampedIndex;
  }
}

function normalizeMarketData(raw) {
  return (raw || [])
    .map((entry) => {
      const date = new Date(entry.ts ?? entry.timestamp ?? entry.date);
      if (!entry || Number.isNaN(date.getTime())) return null;
      const price = entry.price == null ? null : Number(entry.price);
      return {
        date,
        price: Number.isNaN(price) ? null : price
      };
    })
    .filter(Boolean);
}

function buildMarketPoints(data) {
  if (!data.length || !THREE) return [];
  const validPrices = data
    .map((entry) => entry.price)
    .filter((price) => price != null && !Number.isNaN(price));
  const chartWidth = 6.4;
  const chartHeight = 1.6;
  if (!validPrices.length) {
    return data.map((entry, index) => {
      const x = (index / (data.length - 1 || 1)) * chartWidth - chartWidth / 2;
      return new THREE.Vector3(x, 0, 0);
    });
  }

  const min = Math.min(...validPrices);
  const max = Math.max(...validPrices);
  const range = max - min || 1;
  const mid = (min + max) / 2;

  return data.map((entry, index) => {
    const price = entry.price ?? mid;
    const normalized = (price - min) / range;
    const x = (index / (data.length - 1 || 1)) * chartWidth - chartWidth / 2;
    const y = normalized * chartHeight - chartHeight / 2;
    return new THREE.Vector3(x, y, 0);
  });
}

function buildMarketLine(points) {
  if (!chartGroup || !THREE) return;
  chartGroup.clear();
  cursor = null;

  if (!points.length) {
    chartGroup.visible = false;
    return;
  }

  chartGroup.visible = true;
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const line = new THREE.Line(
    geometry,
    new THREE.LineBasicMaterial({ color: 0xff9ad5, transparent: true, opacity: 0.85 })
  );
  chartGroup.add(line);

  const cursorGeometry = new THREE.SphereGeometry(0.09, 16, 16);
  const cursorMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0xff9ad5,
    emissiveIntensity: 0.7
  });
  cursor = new THREE.Mesh(cursorGeometry, cursorMaterial);
  chartGroup.add(cursor);
}

async function fetchWithTimeout(url, timeoutMs = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { cache: 'no-store', signal: controller.signal });
    if (!response.ok) throw new Error('Market data unavailable');
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

async function loadMarketData() {
  const remoteUrl = document.body?.dataset?.marketUrl;
  if (remoteUrl) {
    try {
      const remoteJson = await fetchWithTimeout(remoteUrl, 8000);
      const normalized = normalizeMarketData(remoteJson);
      if (normalized.length) {
        return { data: normalized, usedFallback: false };
      }
    } catch (error) {
      // Fallback to local data
    }
  }

  try {
    const localJson = await fetchWithTimeout('data/market-data.json', 8000);
    const normalized = normalizeMarketData(localJson);
    if (normalized.length) {
      return { data: normalized, usedFallback: Boolean(remoteUrl) };
    }
  } catch (error) {
    // Continue to sample fallback
  }

  try {
    const sampleJson = await fetchWithTimeout('data/market-sample.json', 8000);
    const normalized = normalizeMarketData(sampleJson);
    return { data: normalized, usedFallback: true };
  } catch (error) {
    return { data: [], usedFallback: true };
  }
}

function updateMarketUI(hasData, usedFallback) {
  if (marketStatus) {
    marketStatus.textContent = hasData
      ? usedFallback
        ? MARKET_STATUS_FALLBACK
        : MARKET_STATUS_LOADED
      : 'Market data unavailable. Lunar model still active.';
  }
  if (rangeInput) rangeInput.disabled = !hasData;
  if (playButton) playButton.disabled = !hasData || prefersReducedMotion;
}

function setPlayState(playing) {
  state.isPlaying = playing && !prefersReducedMotion;
  if (playButton) playButton.textContent = state.isPlaying ? 'Pause' : 'Play';
}

function onResize() {
  if (!stage) return;
  const rect = stage.getBoundingClientRect();
  const width = Math.max(1, rect.width);
  const height = Math.max(1, rect.height);

  if (state.threeReady && renderer && camera) {
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    render();
  } else if (state.fallbackReady) {
    updateFallbackScene(state.lastIllumination ?? 50);
  }
}

function render() {
  if (!renderer || !scene || !camera) return;
  if (controls) controls.update();
  renderer.render(scene, camera);
}

let frameId = null;
let lastFrameTime = performance.now();

function animate(time) {
  if (!state.threeReady || document.hidden) {
    frameId = null;
    return;
  }

  const delta = time - lastFrameTime;
  lastFrameTime = time;

  if (state.isPlaying && state.marketData.length > 1) {
    const pointsPerSecond = Math.max(state.marketData.length / 30, 0.4);
    state.playhead += (delta / 1000) * pointsPerSecond;
    if (state.playhead >= state.marketData.length) {
      state.playhead = 0;
    }
    applyTimelineIndex(Math.floor(state.playhead));
  }

  render();
  frameId = requestAnimationFrame(animate);
}

function startAnimation() {
  if (!state.threeReady || frameId) return;
  lastFrameTime = performance.now();
  frameId = requestAnimationFrame(animate);
}

function stopAnimation() {
  if (frameId) {
    cancelAnimationFrame(frameId);
    frameId = null;
  }
}

function initFallback() {
  if (!canvas) return;
  fallbackContext = canvas.getContext('2d');
  if (!fallbackContext) return;
  fallbackStars = Array.from({ length: 80 }).map(() => ({
    x: Math.random(),
    y: Math.random() * 0.6,
    size: Math.random() * 1.4 + 0.4,
    color: 'rgba(248, 250, 252, 0.8)'
  }));
  state.fallbackReady = true;
  updateFallbackScene(50);
}

async function fetchTextModule(urls) {
  for (const url of urls) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8000);
      const response = await fetch(url, { cache: 'force-cache', signal: controller.signal });
      clearTimeout(timer);
      if (!response.ok) throw new Error('Module fetch failed');
      return await response.text();
    } catch (error) {
      // Try next source
    }
  }
  return null;
}

function createModuleUrl(source) {
  return URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
}

async function loadThreeModules() {
  const moduleUrls = [
    'https://unpkg.com/three@0.160.0/build/three.module.js',
    'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js'
  ];

  const source = await fetchTextModule(moduleUrls);
  if (!source) return null;

  threeModuleUrl = createModuleUrl(source);
  return import(threeModuleUrl);
}

async function loadOrbitControls() {
  if (!threeModuleUrl) return null;

  const controlUrls = [
    'https://unpkg.com/three@0.160.0/examples/jsm/controls/OrbitControls.js',
    'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/controls/OrbitControls.js'
  ];

  const source = await fetchTextModule(controlUrls);
  if (!source) return null;

  const rewritten = source.replace(/from ['\"]three['\"]/g, `from '${threeModuleUrl}'`);
  if (rewritten === source || !rewritten.includes(threeModuleUrl)) {
    return { OrbitControls: null, rewriteFailed: true };
  }
  const controlModuleUrl = createModuleUrl(rewritten);
  const module = await import(controlModuleUrl);
  return { OrbitControls: module?.OrbitControls ?? null, rewriteFailed: false };
}

function initScene() {
  scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x060b1f, 10, 28);

  camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  camera.position.set(0, 3.5, 9);

  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.setClearColor(0x000000, 0);

  if (OrbitControls) {
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.minDistance = 5;
    controls.maxDistance = 14;
    controls.maxPolarAngle = Math.PI / 1.7;
  }

  const ambientLight = new THREE.AmbientLight(0x304156, 0.7);
  scene.add(ambientLight);

  const sunLight = new THREE.DirectionalLight(0xffffff, 1.1);
  sunLight.position.set(6, 3, 4);
  scene.add(sunLight);

  const starsGeometry = new THREE.BufferGeometry();
  const starVertices = [];
  for (let i = 0; i < 280; i += 1) {
    const radius = 12 + Math.random() * 10;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    starVertices.push(
      radius * Math.sin(phi) * Math.cos(theta),
      radius * Math.sin(phi) * Math.sin(theta),
      radius * Math.cos(phi)
    );
  }
  starsGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starVertices, 3));
  const stars = new THREE.Points(
    starsGeometry,
    new THREE.PointsMaterial({ color: 0xbddcff, size: 0.12, opacity: 0.8 })
  );
  scene.add(stars);

  const earth = new THREE.Mesh(
    new THREE.SphereGeometry(1.4, 32, 32),
    new THREE.MeshStandardMaterial({
      color: 0x2e5cff,
      roughness: 0.65,
      metalness: 0.05
    })
  );
  scene.add(earth);

  moon = new THREE.Mesh(
    new THREE.SphereGeometry(0.42, 28, 28),
    new THREE.MeshStandardMaterial({
      color: 0xd8dbe5,
      roughness: 0.9,
      metalness: 0.02
    })
  );
  scene.add(moon);

  const orbitGeometry = new THREE.BufferGeometry();
  const orbitSegments = 96;
  const orbitVertices = [];
  for (let i = 0; i <= orbitSegments; i += 1) {
    const angle = (i / orbitSegments) * Math.PI * 2;
    orbitVertices.push(Math.cos(angle) * ORBIT_RADIUS, 0, Math.sin(angle) * ORBIT_RADIUS);
  }
  orbitGeometry.setAttribute('position', new THREE.Float32BufferAttribute(orbitVertices, 3));
  const orbitLine = new THREE.Line(
    orbitGeometry,
    new THREE.LineBasicMaterial({ color: 0x75c8ff, transparent: true, opacity: 0.35 })
  );
  scene.add(orbitLine);

  chartGroup = new THREE.Group();
  chartGroup.position.set(0, -2.4, 0);
  scene.add(chartGroup);

  state.threeReady = true;
  updateSceneStatus('Scene ready');
  onResize();
  render();
  startAnimation();
}

async function initThreeScene() {
  THREE = await loadThreeModules();
  if (!THREE) {
    updateSceneStatus(FALLBACK_STATUS);
    return;
  }

  const controlsResult = await loadOrbitControls();
  if (controlsResult?.rewriteFailed) {
    updateSceneStatus(FALLBACK_STATUS);
    return;
  }
  OrbitControls = controlsResult?.OrbitControls ?? null;
  initScene();
}

function attachEventListeners() {
  if (rangeInput) {
    rangeInput.addEventListener('input', (event) => {
      const value = Number(event.target.value);
      applyTimelineIndex(value);
      if (state.isPlaying) {
        setPlayState(false);
      }
    });
  }

  if (playButton) {
    playButton.addEventListener('click', () => {
      if (prefersReducedMotion) return;
      setPlayState(!state.isPlaying);
    });
  }

  window.addEventListener('resize', onResize);
  window.addEventListener('orientationchange', onResize);

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      stopAnimation();
    } else {
      startAnimation();
    }
  });
}

async function initMarket() {
  if (marketStatus) marketStatus.textContent = MARKET_STATUS_LOADING;
  if (rangeInput) rangeInput.disabled = true;
  if (playButton) playButton.disabled = true;

  const { data, usedFallback } = await loadMarketData();
  state.marketData = data;
  state.marketPoints = buildMarketPoints(data);
  state.baseTimestamp = data.length ? data[0].date.getTime() : Date.now();

  if (state.threeReady) {
    buildMarketLine(state.marketPoints);
  }

  updateMarketUI(Boolean(data.length), usedFallback);

  if (data.length) {
    if (rangeInput) rangeInput.max = String(data.length - 1);
    applyTimelineIndex(data.length - 1);
    state.playhead = data.length - 1;
  } else {
    applyTimelineIndex(0);
  }

  setPlayState(state.isPlaying);
}

async function init() {
  if (!stage || !canvas) {
    // Defensive: avoid errors if the 3D mount is missing.
    return;
  }
  updateSceneStatus('Loading scene…');
  initFallback();
  attachEventListeners();

  await initThreeScene();

  if (!state.threeReady) {
    updateSceneStatus(FALLBACK_STATUS);
  }

  await initMarket();
}

init();
