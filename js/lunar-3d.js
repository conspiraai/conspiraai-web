/*
 * lunar-3d.js
 * Renders the Lunar × Market Timeline 3D scene and UI controls.
 */

import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';
import { OrbitControls } from 'https://unpkg.com/three@0.160.0/examples/jsm/controls/OrbitControls.js';

const stage = document.getElementById('lunar-3d-stage');
const canvas = document.getElementById('lunar-3d-canvas');
const statusBadge = document.getElementById('lunar-3d-status');
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
  baseTimestamp: Date.now()
};

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x060b1f, 10, 28);

const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
camera.position.set(0, 3.5, 9);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
renderer.setClearColor(0x000000, 0);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.minDistance = 5;
controls.maxDistance = 14;
controls.maxPolarAngle = Math.PI / 1.7;

const ambientLight = new THREE.AmbientLight(0x304156, 0.6);
scene.add(ambientLight);

const sunLight = new THREE.DirectionalLight(0xffffff, 1.05);
sunLight.position.set(6, 3, 4);
scene.add(sunLight);

const earth = new THREE.Mesh(
  new THREE.SphereGeometry(1.4, 32, 32),
  new THREE.MeshStandardMaterial({
    color: 0x2e5cff,
    roughness: 0.65,
    metalness: 0.05
  })
);
scene.add(earth);

const moon = new THREE.Mesh(
  new THREE.SphereGeometry(0.42, 28, 28),
  new THREE.MeshStandardMaterial({
    color: 0xd8dbe5,
    roughness: 0.9,
    metalness: 0.02
  })
);
scene.add(moon);

const orbitRadius = 3.2;
const orbitGeometry = new THREE.BufferGeometry();
const orbitSegments = 96;
const orbitVertices = [];
for (let i = 0; i <= orbitSegments; i += 1) {
  const angle = (i / orbitSegments) * Math.PI * 2;
  orbitVertices.push(Math.cos(angle) * orbitRadius, 0, Math.sin(angle) * orbitRadius);
}
orbitGeometry.setAttribute('position', new THREE.Float32BufferAttribute(orbitVertices, 3));
const orbitLine = new THREE.Line(
  orbitGeometry,
  new THREE.LineBasicMaterial({ color: 0x75c8ff, transparent: true, opacity: 0.35 })
);
scene.add(orbitLine);

const chartGroup = new THREE.Group();
chartGroup.position.set(0, -2.4, 0);
scene.add(chartGroup);

let chartLine = null;
let cursor = null;

function buildMarketLine(points) {
  chartGroup.clear();
  chartLine = null;
  cursor = null;

  if (!points.length) {
    chartGroup.visible = false;
    return;
  }

  chartGroup.visible = true;
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  chartLine = new THREE.Line(
    geometry,
    new THREE.LineBasicMaterial({ color: 0xff9ad5, transparent: true, opacity: 0.85 })
  );
  chartGroup.add(chartLine);

  const cursorGeometry = new THREE.SphereGeometry(0.09, 16, 16);
  const cursorMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0xff9ad5,
    emissiveIntensity: 0.7
  });
  cursor = new THREE.Mesh(cursorGeometry, cursorMaterial);
  chartGroup.add(cursor);
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

function updateInfoPanel({ date, phaseName, illumination, price }) {
  timestampEl.textContent = formatTimestamp(date);
  phaseEl.textContent = phaseName || '–';
  illuminationEl.textContent =
    illumination == null || Number.isNaN(illumination)
      ? '–'
      : `${illumination.toFixed(1)}%`;
  priceEl.textContent = formatPrice(price);
}

function updateMoonPosition(angle) {
  moon.position.set(Math.cos(angle) * orbitRadius, 0, Math.sin(angle) * orbitRadius);
}

function updateCursor(index) {
  if (!cursor || !state.marketPoints.length) return;
  const clampedIndex = Math.max(0, Math.min(index, state.marketPoints.length - 1));
  cursor.position.copy(state.marketPoints[clampedIndex]);
}

function applyTimelineIndex(index) {
  if (!state.marketData.length) {
    const now = new Date();
    const phaseFraction = ((now.getTime() - state.baseTimestamp) % cycleMs()) / cycleMs();
    const angle = phaseFraction * Math.PI * 2;
    const illumination = (1 - Math.cos(angle)) * 50;
    updateMoonPosition(angle);
    updateCursor(0);
    updateInfoPanel({
      date: now,
      phaseName: moonPhaseName(phaseFraction),
      illumination,
      price: null
    });
    return;
  }

  const clampedIndex = Math.max(0, Math.min(index, state.marketData.length - 1));
  const entry = state.marketData[clampedIndex];
  const timestamp = entry.date;
  const phaseFraction = ((timestamp.getTime() - state.baseTimestamp) % cycleMs()) / cycleMs();
  const angle = phaseFraction * Math.PI * 2;
  const illumination = (1 - Math.cos(angle)) * 50;

  updateMoonPosition(angle);
  updateCursor(clampedIndex);
  updateInfoPanel({
    date: timestamp,
    phaseName: moonPhaseName(phaseFraction),
    illumination,
    price: entry.price
  });

  rangeInput.value = String(clampedIndex);
  state.playhead = clampedIndex;
}

function cycleMs() {
  return 29.53 * 24 * 60 * 60 * 1000;
}

function normalizeMarketData(raw) {
  return (raw || [])
    .map((entry) => {
      const date = new Date(entry.ts);
      const price = Number(entry.price);
      if (!entry.ts || Number.isNaN(date.getTime()) || Number.isNaN(price)) return null;
      return { date, price };
    })
    .filter(Boolean);
}

function buildMarketPoints(data) {
  if (!data.length) return [];
  const prices = data.map((entry) => entry.price);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = max - min || 1;

  const chartWidth = 6.4;
  const chartHeight = 1.6;

  return data.map((entry, index) => {
    const normalized = (entry.price - min) / range;
    const x = (index / (data.length - 1 || 1)) * chartWidth - chartWidth / 2;
    const y = normalized * chartHeight - chartHeight / 2;
    return new THREE.Vector3(x, y, 0);
  });
}

async function loadMarketData() {
  try {
    const res = await fetch('data/market-sample.json', { cache: 'no-store' });
    if (!res.ok) throw new Error('Market data unavailable');
    const json = await res.json();
    return normalizeMarketData(json);
  } catch (error) {
    console.warn(error);
    return [];
  }
}

function updateMarketUI(hasData) {
  if (hasData) {
    marketStatus.textContent = 'Market data loaded.';
    rangeInput.disabled = false;
    playButton.disabled = false;
  } else {
    marketStatus.textContent = 'Market data unavailable. Lunar model still active.';
    rangeInput.disabled = true;
    playButton.disabled = true;
  }

  if (prefersReducedMotion) {
    playButton.disabled = true;
  }
}

function setPlayState(playing) {
  state.isPlaying = playing && !prefersReducedMotion;
  playButton.textContent = state.isPlaying ? 'Pause' : 'Play';
}

function onResize() {
  const rect = stage.getBoundingClientRect();
  const width = Math.max(1, rect.width);
  const height = Math.max(1, rect.height);
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  render();
}

function render() {
  controls.update();
  renderer.render(scene, camera);
}

let frameId = null;
let lastFrameTime = performance.now();

function animate(time) {
  if (document.hidden) {
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
  if (frameId) return;
  lastFrameTime = performance.now();
  frameId = requestAnimationFrame(animate);
}

function stopAnimation() {
  if (frameId) {
    cancelAnimationFrame(frameId);
    frameId = null;
  }
}

async function init() {
  statusBadge.textContent = 'Loading data…';
  updateMarketUI(false);

  const data = await loadMarketData();
  state.marketData = data;
  state.marketPoints = buildMarketPoints(data);
  state.baseTimestamp = data.length ? data[0].date.getTime() : Date.now();

  buildMarketLine(state.marketPoints);
  updateMarketUI(Boolean(data.length));

  if (data.length) {
    rangeInput.max = String(data.length - 1);
    applyTimelineIndex(data.length - 1);
    state.playhead = data.length - 1;
  } else {
    applyTimelineIndex(0);
  }

  statusBadge.textContent = 'Scene ready';
  setPlayState(state.isPlaying);
  onResize();
  startAnimation();
}

rangeInput.addEventListener('input', (event) => {
  const value = Number(event.target.value);
  applyTimelineIndex(value);
  if (state.isPlaying) {
    setPlayState(false);
  }
});

playButton.addEventListener('click', () => {
  if (prefersReducedMotion) return;
  setPlayState(!state.isPlaying);
});

window.addEventListener('resize', onResize);

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    stopAnimation();
  } else {
    startAnimation();
  }
});

init();
