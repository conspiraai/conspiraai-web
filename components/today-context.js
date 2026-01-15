const MOUNT_SELECTOR = '[data-today-context]';

const PHASE_LABELS = [
  { match: 'new', label: 'New' },
  { match: 'waxing crescent', label: 'Waxing Crescent' },
  { match: 'first quarter', label: 'First Quarter' },
  { match: 'waxing gibbous', label: 'Waxing Gibbous' },
  { match: 'full', label: 'Full' },
  { match: 'waning gibbous', label: 'Waning Gibbous' },
  { match: 'last quarter', label: 'Last Quarter' },
  { match: 'waning crescent', label: 'Waning Crescent' }
];

const PHASE_BULLETS = {
  waxing: [
    'Trend persistence often improves.',
    'Breakouts tend to see better follow-through.',
    'Momentum regimes are more common.'
  ],
  waning: [
    'More chop tends to appear.',
    'False breaks often increase.',
    'Trend persistence is typically lower.'
  ],
  full: [
    'Volatility/tension windows often appear.',
    'Whipsaws can show up more frequently.',
    'Overextensions are more common.'
  ],
  new: [
    'Reset/positioning windows often appear.',
    'Ranges and accumulation phases are more common.',
    'Direction is often unclear early.'
  ],
  fallback: [
    'Phase context is updating shortly.',
    'Use the lunar views for additional context.',
    'Context, not direction.'
  ]
};

function formatLocalDate(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '–';
  return date.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric'
  });
}

function normalizePhaseName(rawPhase) {
  const phase = String(rawPhase || '').trim().toLowerCase();
  if (!phase) return '–';
  const match = PHASE_LABELS.find((entry) => phase.includes(entry.match));
  return match ? match.label : '–';
}

function resolvePhaseBucket(phaseName, illumination) {
  const phase = String(phaseName || '').toLowerCase();
  if (phase.includes('full')) return 'full';
  if (phase.includes('new')) return 'new';
  if (phase.includes('waning')) return 'waning';
  if (phase.includes('waxing')) return 'waxing';

  if (illumination != null && !Number.isNaN(illumination)) {
    if (illumination >= 90) return 'full';
    if (illumination <= 10) return 'new';
    if (illumination < 50) return 'waning';
    return 'waxing';
  }

  return 'fallback';
}

function buildContextMarkup({ date, phaseName, illumination, bullets }) {
  const illuminationLabel =
    illumination != null && !Number.isNaN(illumination)
      ? `${Math.round(illumination)}%`
      : '–';
  const bulletItems = bullets
    .map((item) => `<li>${item}</li>`)
    .join('');

  return `
    <div class="today-context-header">
      <div>
        <p class="today-context-kicker">Daily Anchor Insight</p>
        <h3 class="today-context-title">Today’s Market Context</h3>
      </div>
    </div>
    <dl class="today-context-meta">
      <div>
        <dt>Local date</dt>
        <dd>${formatLocalDate(date)}</dd>
      </div>
      <div>
        <dt>Moon phase</dt>
        <dd>${phaseName || '–'}</dd>
      </div>
      <div>
        <dt>Illumination</dt>
        <dd>${illuminationLabel}</dd>
      </div>
    </dl>
    <p class="today-context-label">Typical behavior during similar phases</p>
    <ul class="bullet-list">
      ${bulletItems}
    </ul>
    <p class="today-context-disclaimer">Context, not direction.</p>
  `;
}

async function resolveLunarData() {
  if (window.astral?.liveLunar) {
    return window.astral.liveLunar;
  }

  if (typeof window.astral?.fetchLunarData === 'function') {
    return window.astral.fetchLunarData();
  }

  return null;
}

async function initTodayContext() {
  const mounts = Array.from(document.querySelectorAll(MOUNT_SELECTOR));
  if (!mounts.length) return;

  const lunar = await resolveLunarData();
  const phaseName = normalizePhaseName(lunar?.moonPhase);
  const illumination = lunar?.moonIllumination;
  const bucket = resolvePhaseBucket(phaseName, illumination);
  const bullets = PHASE_BULLETS[bucket] || PHASE_BULLETS.fallback;

  mounts.forEach((mount) => {
    mount.classList.add('card', 'today-context');
    mount.innerHTML = buildContextMarkup({
      date: lunar?.date || new Date(),
      phaseName,
      illumination,
      bullets
    });
  });
}

document.addEventListener('DOMContentLoaded', initTodayContext);
